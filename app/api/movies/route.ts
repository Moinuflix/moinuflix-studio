import { NextRequest, NextResponse } from "next/server";

const OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
const REPO = process.env.GITHUB_REPO_NAME || "My-Movies";
const TOKEN = process.env.GITHUB_TOKEN;
const DATA_DIR = "resources/data";

const SOURCE_IMAGE_MAP: Record<string, string> = {
  AMZN: "resources/images/sources/amazon.png",
  NF: "resources/images/sources/netflix.png",
  DSNP: "resources/images/sources/hotstar.png",
  ZEE5: "resources/images/sources/zee5.png",
  SONYLIV: "resources/images/sources/sonyliv.png",
  BluRay: "resources/images/sources/bluray.png",
  REMUX: "resources/images/sources/bluray.png",
  "WEB-DL": "resources/images/sources/web.png",
};

function sanitizeAudio(val: string): string {
  if (!val) return "Dolby Digital";
  return val.split("@")[0].trim();
}

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

export async function GET() {
  if (!TOKEN) return NextResponse.json({ error: "Missing GITHUB_TOKEN" }, { status: 500 });
  try {
    const catalogData = await getFileFromGithub("catalog.json");
    return NextResponse.json(catalogData ? catalogData.json : { movies: [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: "Missing GITHUB_TOKEN" }, { status: 500 });

  try {
    const body = await req.json();
    const { movie, versions, specs, category, available_languages } = body;

    if (!movie || !movie.id) {
      return NextResponse.json({ error: "Invalid movie payload: ID required." }, { status: 400 });
    }

    if (!versions || versions.length === 0) {
      return NextResponse.json({ error: "At least one playback version is required." }, { status: 400 });
    }

    // 1. Fetch resources/data/catalog.json
    let catalogFile = await getFileFromGithub("catalog.json");
    let catalog = catalogFile ? catalogFile.json : { movies: [] };
    let catalogSha = catalogFile ? catalogFile.sha : null;

    const existingIndex = (catalog.movies || []).findIndex((m: any) => String(m.id) === String(movie.id));
    const isEdit = existingIndex !== -1;

    let targetChunkRelPath = "";
    if (isEdit && catalog.movies[existingIndex].chunk_file) {
      targetChunkRelPath = catalog.movies[existingIndex].chunk_file.replace(/^resources\/data\//, "");
    } else {
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

    // 2. Fetch Target Chunk
    let chunkFile = await getFileFromGithub(targetChunkRelPath);
    let chunk = chunkFile ? chunkFile.json : { movies: [] };
    let chunkSha = chunkFile ? chunkFile.sha : null;

    const primaryStreamUrl = versions.find((v: any) => v.stream_url)?.stream_url || versions[0]?.stream_url || "";
    const activeLangs = available_languages?.length > 0
      ? available_languages
      : Array.from(new Set(versions.map((v: any) => v.language)));
    const clearLogoUrl = movie.artwork?.clearlogo || "";

    const studioArray = Array.isArray(movie.studio)
      ? movie.studio
      : typeof movie.studio === "string"
      ? movie.studio.split(",").map((s: string) => s.trim()).filter(Boolean)
      : [];

    // 3. Assemble Complete Chunk Record
    const completeChunkRecord = {
      id: String(movie.id),
      title: movie.title,
      original_title: movie.original_title || movie.title,
      year: movie.year,
      tagline: movie.tagline || "",
      plot: movie.plot || "",
      runtime: movie.runtime || 0,
      release_date: movie.release_date || "",
      certification: movie.certification || "NR",
      original_language: movie.original_language || "en",
      category: category || "Hollywood (English)",
      genres: movie.genres || [],
      country: movie.countries || [],
      studio: studioArray,
      director: movie.director || [],
      writers: movie.writers || [],
      cast: movie.cast || [],
      artwork: {
        poster: movie.artwork?.poster || "",
        thumbnail: movie.artwork?.thumbnail || "",
        fanart: movie.artwork?.fanart || "",
        landscape: movie.artwork?.landscape || "",
        keyart: movie.artwork?.keyart || "",
        banner: movie.artwork?.banner || "",
        clearlogo: clearLogoUrl,
        clearart: movie.artwork?.clearart || "",
        character_art: movie.artwork?.character_art || [],
        extra_posters: movie.artwork?.extra_posters || [],
        extra_backdrops: movie.artwork?.extra_backdrops || [],
        extra_logos: movie.artwork?.extra_logos || [],
      },
      trailer: movie.trailer || "",
      external_ids: {
        tmdb_id: movie.tmdb_id || null,
        imdb_id: movie.imdb_id || null,
        wikidata_id: movie.wikidata_id || null,
      },
      collection: movie.collection || "",
      similar_movies: movie.similar_movies || [],
      awards: { summary: movie.awards || "" },
      financials: {
        budget: movie.financials?.budget || "",
        box_office: movie.financials?.box_office || "",
      },
      ratings: [
        { source: "IMDb", value: movie.ratings?.imdb ? Number(movie.ratings.imdb) : null, out_of: 10 },
        { source: "Rotten Tomatoes", value: movie.ratings?.rotten_tomatoes ? Number(movie.ratings.rotten_tomatoes) : null, unit: "percent" },
        { source: "TMDb", value: movie.ratings?.tmdb ? Number(movie.ratings.tmdb) : null, out_of: 10 },
      ],
      tags: {
        quality: Array.from(new Set(versions.map((v: any) => v.quality || specs?.resolution || "1080p"))),
        source: Array.from(new Set(versions.map((v: any) => v.source || specs?.source || "BluRay"))),
        codec: Array.from(new Set(versions.map((v: any) => v.codec || specs?.codec || "x265"))),
        hdr: [specs?.hdr || "SDR"],
        audio: Array.from(new Set(versions.map((v: any) => sanitizeAudio(v.audio)))),
        other: [specs?.enhancement || "Standard", specs?.colorDepth || "10bit"],
        language: activeLangs,
      },
      specs: {
        resolution: specs?.resolution || "1080p",
        source: specs?.source || "BluRay",
        codec: specs?.codec || "x265",
        bit_depth: specs?.colorDepth || "10bit",
        audio: sanitizeAudio(versions[0]?.audio || specs?.audioCodec || "Dolby Digital"),
        channels: versions[0]?.channels || "5.1",
        languages: activeLangs,
        subtitles: specs?.subtitles || ["ESub"],
        size: specs?.fileSize || "5 GB",
      },
      versions: versions.map((v: any) => ({
        id: v.id || `ver-${Math.random().toString(36).substring(2, 7)}`,
        name: v.dubbed || `${movie.title} [${v.language}]`,
        language: v.language,
        quality: v.quality || "1080p",
        source: v.source || "BluRay",
        source_image: SOURCE_IMAGE_MAP[v.source] || SOURCE_IMAGE_MAP["BluRay"],
        codec: v.codec || "x265",
        audio: sanitizeAudio(v.audio),
        channels: v.channels || "5.1",
        size: v.size || specs?.fileSize || "5 GB",
        stream_url: v.stream_url || "",
      })),
      stream_url: primaryStreamUrl,
      soundtrack: {},
    };

    if (!chunk.movies) chunk.movies = [];
    const chunkIdx = chunk.movies.findIndex((m: any) => String(m.id) === String(movie.id));
    if (chunkIdx !== -1) {
      chunk.movies[chunkIdx] = completeChunkRecord;
    } else {
      chunk.movies.unshift(completeChunkRecord);
    }

    // 4. Assemble Catalog Summary Record
    const catalogRecord = {
      id: String(movie.id),
      title: movie.title,
      year: movie.year,
      category: category || "Hollywood (English)",
      poster: movie.artwork?.poster || "",
      fanart: movie.artwork?.fanart || "",
      logo: clearLogoUrl,
      rating: movie.ratings?.imdb ? Number(movie.ratings.imdb) : movie.ratings?.tmdb ? Number(movie.ratings.tmdb) : null,
      original_language: movie.original_language || "en",
      chunk_file: targetChunkRelPath,
      primary_stream_url: primaryStreamUrl,
      available_languages: activeLangs,
      version_count: versions.length,
      available_versions: versions.map((v: any) => ({
        language: v.language,
        quality: v.quality || "1080p",
        source: v.source || "BluRay",
        source_image: SOURCE_IMAGE_MAP[v.source] || SOURCE_IMAGE_MAP["BluRay"],
        format: v.source === "BluRay" || v.source === "REMUX" ? "BluRay" : "WEB-DL",
        codec: v.codec || "x265",
        audio: sanitizeAudio(v.audio),
        channels: v.channels || "5.1",
      })),
    };

    if (!catalog.movies) catalog.movies = [];
    if (isEdit) {
      catalog.movies[existingIndex] = catalogRecord;
    } else {
      catalog.movies.unshift(catalogRecord);
    }

    // 5. Commit Chunk first, then Catalog
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
      chunkPath: targetChunkRelPath,
      isEdit,
      commitSha: catalogCommit.commit.sha,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  if (!TOKEN) return NextResponse.json({ error: "Missing GITHUB_TOKEN" }, { status: 500 });

  try {
    const { searchParams } = new URL(req.url);
    const movieId = searchParams.get("id");

    if (!movieId) return NextResponse.json({ error: "Missing movieId to delete." }, { status: 400 });

    const catalogFile = await getFileFromGithub("catalog.json");
    if (!catalogFile) return NextResponse.json({ error: "catalog.json not found." }, { status: 404 });

    const catalog = catalogFile.json;
    const targetIdx = (catalog.movies || []).findIndex((m: any) => String(m.id) === String(movieId));
    if (targetIdx === -1) return NextResponse.json({ error: "Movie not found in catalog." }, { status: 404 });

    const chunkRelPath = catalog.movies[targetIdx].chunk_file.replace(/^resources\/data\//, "");
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
