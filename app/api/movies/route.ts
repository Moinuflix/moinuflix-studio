import { NextRequest, NextResponse } from "next/server";

const OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
const REPO = process.env.GITHUB_REPO_NAME || "My-Movies";
const TOKEN = process.env.GITHUB_TOKEN;

// Exact repo folder path from screenshot: resources/data/
const DATA_DIR = "resources/data";

async function getFileFromGithub(relativePath: string) {
  const fullPath = `${DATA_DIR}/${relativePath}`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${fullPath}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub get failed on ${fullPath}: ${res.statusText}`);
  const data = await res.json();
  const content = Buffer.from(data.content, "base64").toString("utf8");
  return { sha: data.sha, json: JSON.parse(content) };
}

async function putFileToGithub(relativePath: string, contentJson: any, sha: string | null, message: string) {
  const fullPath = `${DATA_DIR}/${relativePath}`;
  const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${fullPath}`;
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
    throw new Error(`GitHub commit failed on ${fullPath}: ${err.message || res.statusText}`);
  }
  return await res.json();
}

// GET: Library Manager read from resources/data/catalog.json
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

// POST: Save to resources/data/chunks/ & resources/data/catalog.json
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

    // 1. Fetch resources/data/catalog.json
    let catalogFile = await getFileFromGithub("catalog.json");
    let catalog = catalogFile ? catalogFile.json : { movies: [] };
    let catalogSha = catalogFile ? catalogFile.sha : null;

    const existingIndex = (catalog.movies || []).findIndex((m: any) => String(m.id) === String(movie.id));
    const isEdit = existingIndex !== -1;

    let targetChunkRelPath = "";
    if (isEdit) {
      targetChunkRelPath = catalog.movies[existingIndex].chunk_file.replace(/^resources\/data\//, "");
    } else {
      // Find chunk with space (< 50 movies) in resources/data/chunks/
      let chunkNum = 1;
      while (true) {
        const padded = String(chunkNum).padStart(2, "0");
        const candidateRelPath = `chunks/chunk_${padded}.json`;
        const cFile = await getFileFromGithub(candidateRelPath);
        if (!cFile || (cFile.json.movies && cFile.json.movies.length < 50)) {
          targetChunkRelPath = candidateRelPath;
          break;
        }
        chunkNum++;
      }
    }

    // 2. Fetch target chunk
    let chunkFile = await getFileFromGithub(targetChunkRelPath);
    let chunk = chunkFile ? chunkFile.json : { movies: [] };
    let chunkSha = chunkFile ? chunkFile.sha : null;

    // 3. Assemble Full Metadata Record for Chunk
    const primaryStreamUrl = versions.find((v: any) => v.stream_url)?.stream_url || "";
    const availableLangs = Array.from(new Set(versions.map((v: any) => v.language)));

    const completeChunkRecord = {
      ...movie,
      specs: specs || {},
      stream_url: primaryStreamUrl,
      versions: versions,
      updated_at: new Date().toISOString(),
    };

    if (!chunk.movies) chunk.movies = [];
    const chunkMovieIdx = chunk.movies.findIndex((m: any) => String(m.id) === String(movie.id));
    if (chunkMovieIdx !== -1) {
      chunk.movies[chunkMovieIdx] = completeChunkRecord;
    } else {
      chunk.movies.unshift(completeChunkRecord);
    }

    // 4. Assemble Catalog Summary Record (Points to resources/data/chunks/...)
    const catalogRecord = {
      id: String(movie.id),
      title: movie.title,
      year: movie.year,
      poster: movie.artwork?.poster || "",
      fanart: movie.artwork?.fanart || "",
      rating: movie.ratings?.imdb || movie.ratings?.tmdb || null,
      original_language: movie.original_language || "en",
      chunk_file: `${DATA_DIR}/${targetChunkRelPath}`,
      primary_stream_url: primaryStreamUrl,
      available_languages: availableLangs,
      version_count: versions.length,
      available_versions: versions.map((v: any) => ({
        language: v.language,
        dubbed: v.dubbed || "",
        quality: v.quality,
        source: v.source,
        codec: v.codec,
        audio: v.audio,
        size: v.size || specs?.fileSize || "",
      })),
    };

    if (!catalog.movies) catalog.movies = [];
    if (isEdit) {
      catalog.movies[existingIndex] = catalogRecord;
    } else {
      catalog.movies.unshift(catalogRecord);
    }

    // 5. Commit Chunk First, Then Catalog
    await putFileToGithub(
      targetChunkRelPath,
      chunk,
      chunkSha,
      `${isEdit ? "Update" : "Add"} movie: ${movie.title} in ${DATA_DIR}/${targetChunkRelPath}`
    );

    const catalogCommit = await putFileToGithub(
      "catalog.json",
      catalog,
      catalogSha,
      `Update ${DATA_DIR}/catalog.json: ${movie.title}`
    );

    return NextResponse.json({
      success: true,
      chunkPath: `${DATA_DIR}/${targetChunkRelPath}`,
      isEdit,
      commitSha: catalogCommit.commit.sha,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// DELETE: Remove from resources/data/catalog.json & chunks
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
      return NextResponse.json({ error: "catalog.json not found in resources/data." }, { status: 404 });
    }

    const catalog = catalogFile.json;
    const targetIdx = (catalog.movies || []).findIndex((m: any) => String(m.id) === String(movieId));
    if (targetIdx === -1) {
      return NextResponse.json({ error: "Movie not found in catalog." }, { status: 404 });
    }

    const targetMovie = catalog.movies[targetIdx];
    const chunkRelPath = targetMovie.chunk_file.replace(/^resources\/data\//, "");

    const chunkFile = await getFileFromGithub(chunkRelPath);
    if (chunkFile && chunkFile.json.movies) {
      const chunk = chunkFile.json;
      chunk.movies = chunk.movies.filter((m: any) => String(m.id) !== String(movieId));
      await putFileToGithub(chunkRelPath, chunk, chunkFile.sha, `Delete movie ${movieId} from ${DATA_DIR}/${chunkRelPath}`);
    }

    catalog.movies.splice(targetIdx, 1);
    await putFileToGithub("catalog.json", catalog, catalogFile.sha, `Remove movie ${movieId} from ${DATA_DIR}/catalog.json`);

    return NextResponse.json({ success: true, deletedId: movieId });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
