import { NextRequest, NextResponse } from "next/server";

const OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
const REPO = process.env.GITHUB_REPO_NAME || "My-Movies";
const TOKEN = process.env.GITHUB_TOKEN;

async function getFileFromGithub(path: string) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get failed on ${path}: ${res.statusText}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { sha: data.sha, json: JSON.parse(content) };
}

async function putFileToGithub(path: string, contentJson: any, sha: string | null, message: string) {
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${path}`;
  const body: any = {
    message,
    content: Buffer.from(JSON.stringify(contentJson, null, 2)).toString("base64"),
  };
  if (sha) body.sha = sha;

  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(`GitHub commit failed on ${path}: ${err.message || res.statusText}`);
  }
  return await res.json();
}

export async function GET() {
  if (!TOKEN) {
    return NextResponse.json({ error: "Server missing GITHUB_TOKEN" }, { status: 500 });
  }
  try {
    const catalogData = await getFileFromGithub("catalog.json");
    if (!catalogData) {
      return NextResponse.json({ movies: [] });
    }
    return NextResponse.json(catalogData.json);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "Server missing GITHUB_TOKEN" }, { status: 500 });
  }

  try {
    const body = await req.json();
    const { movie, versions, specs } = body;

    if (!movie || !movie.id) {
      return NextResponse.json({ error: "Invalid movie payload." }, { status: 400 });
    }

    let catalogFile = await getFileFromGithub("catalog.json");
    let catalog = catalogFile ? catalogFile.json : { movies: [] };
    let catalogSha = catalogFile ? catalogFile.sha : null;

    const existingIndex = catalog.movies.findIndex((m: any) => String(m.id) === String(movie.id));
    const isEdit = existingIndex !== -1;

    let targetChunkPath = "";
    if (isEdit) {
      targetChunkPath = catalog.movies[existingIndex].chunk_file;
    } else {
      let chunkNum = 1;
      while (true) {
        const padded = String(chunkNum).padStart(2, "0");
        const candidatePath = `chunks/chunk_${padded}.json`;
        const cFile = await getFileFromGithub(candidatePath);
        if (!cFile || (cFile.json.movies && cFile.json.movies.length < 50)) {
          targetChunkPath = candidatePath;
          break;
        }
        chunkNum++;
      }
    }

    let chunkFile = await getFileFromGithub(targetChunkPath);
    let chunk = chunkFile ? chunkFile.json : { movies: [] };
    let chunkSha = chunkFile ? chunkFile.sha : null;

    const primaryStreamUrl = versions.find((v: any) => v.stream_url)?.stream_url || "";
    const availableLangs = Array.from(new Set(versions.map((v: any) => v.language)));

    const completeChunkRecord = {
      ...movie,
      specs: specs || {},
      stream_url: primaryStreamUrl,
      versions: versions,
      updated_at: new Date().toISOString(),
    };

    const chunkMovieIdx = chunk.movies.findIndex((m: any) => String(m.id) === String(movie.id));
    if (chunkMovieIdx !== -1) {
      chunk.movies[chunkMovieIdx] = completeChunkRecord;
    } else {
      chunk.movies.unshift(completeChunkRecord);
    }

    const catalogRecord = {
      id: String(movie.id),
      title: movie.title,
      year: movie.year,
      poster: movie.artwork?.poster || "",
      fanart: movie.artwork?.fanart || "",
      rating: movie.ratings?.imdb || movie.ratings?.tmdb || null,
      original_language: movie.original_language || "en",
      chunk_file: targetChunkPath,
      primary_stream_url: primaryStreamUrl,
      available_languages: availableLangs,
      version_count: versions.length,
      available_versions: versions.map((v: any) => ({
        language: v.language,
        quality: v.quality,
        source: v.source,
        codec: v.codec,
        audio: v.audio,
        channels: v.channels,
      })),
    };

    if (isEdit) {
      catalog.movies[existingIndex] = catalogRecord;
    } else {
      catalog.movies.unshift(catalogRecord);
    }

    await putFileToGithub(
      targetChunkPath,
      chunk,
      chunkSha,
      `${isEdit ? "Update" : "Add"} movie: ${movie.title} in ${targetChunkPath}`
    );

    const catalogCommit = await putFileToGithub(
      "catalog.json",
      catalog,
      catalogSha,
      `Update catalog: ${movie.title} (${targetChunkPath})`
    );

    return NextResponse.json({
      success: true,
      chunkPath: targetChunkPath,
      isEdit,
      commitSha: catalogCommit.commit.sha,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!TOKEN) {
    return NextResponse.json({ error: "Server missing GITHUB_TOKEN" }, { status: 500 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const movieId = searchParams.get("id");

    if (!movieId) {
      return NextResponse.json({ error: "Missing movieId to delete." }, { status: 400 });
    }

    const catalogFile = await getFileFromGithub("catalog.json");
    if (!catalogFile) {
      return NextResponse.json({ error: "catalog.json not found." }, { status: 404 });
    }

    const catalog = catalogFile.json;
    const targetIdx = catalog.movies.findIndex((m: any) => String(m.id) === String(movieId));
    if (targetIdx === -1) {
      return NextResponse.json({ error: "Movie not found in catalog." }, { status: 404 });
    }

    const targetMovie = catalog.movies[targetIdx];
    const chunkPath = targetMovie.chunk_file;

    const chunkFile = await getFileFromGithub(chunkPath);
    if (chunkFile) {
      const chunk = chunkFile.json;
      chunk.movies = chunk.movies.filter((m: any) => String(m.id) !== String(movieId));
      await putFileToGithub(chunkPath, chunk, chunkFile.sha, `Delete movie ${movieId} from ${chunkPath}`);
    }

    catalog.movies.splice(targetIdx, 1);
    await putFileToGithub("catalog.json", catalog, catalogFile.sha, `Remove movie ${movieId} from catalog`);

    return NextResponse.json({ success: true, deletedId: movieId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
