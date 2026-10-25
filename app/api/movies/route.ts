import { NextRequest, NextResponse } from "next/server";

const OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
const REPO = process.env.GITHUB_REPO_NAME || "My-Movies";
const TOKEN = process.env.GITHUB_TOKEN;
const DATA_DIR = "resources/data";

// Map OTT source to Kodi local skin badge paths
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
    const { movie, versions, specs } = body;

    if (!movie || !movie.id) {
      return NextResponse.json({ error: "Invalid movie payload." }, { status: 400 });
    }

    // 1. Fetch catalog.json
    let catalogFile = await getFileFromGithub("catalog.json");
    let catalog = catalogFile ? catalogFile.json : { movies: [] };
    let catalogSha = catalogFile ? catalogFile.sha : null;

    const existingIndex = (catalog.movies || []).findIndex((m: any) => String(m.id) === String(movie.id));
    const isEdit = existingIndex !== -1;

    let targetChunkRelPath = "";
    if (isEdit) {
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

    // 2. Fetch target chunk
    let chunkFile = await getFileFromGithub(targetChunkRelPath);
    let chunk = chunkFile ? chunkFile.json : { movies: [] };
    let chunkSha = chunkFile ? chunkFile.sha : null;

    const primaryStreamUrl = versions.find((v: any) => v.stream_url)?.stream_url || "";
    const availableLangs = Array.from(new Set(versions.map((v: any) => v.language)));

    // 3. Complete Detailed Record for chunk_XX.json matching your schema
    const completeChunkRecord = {
      id: String(movie.id),
      title: movie.title,
      original_title: movie.original_title || movie.title,
      year: movie.year,
      tagline: movie.tagline || "",
      plot: movie.plot || "",
      runtime: movie.runtime || 120,
      release_date: movie.release_date || "",
      certification: movie.certification || "UA",
      original_language: movie.original_language || "ta",
      genres: movie.genres || [],
      country: movie.countries || ["India"],
      studio: movie.studio ? [movie.studio] : [],
      director: movie.director || [],
      writers: movie.writers || [],
      cast: movie.cast || [],
      artwork: {
        poster: movie.artwork?.poster || "",
        thumbnail: movie.artwork?.thumbnail || null,
        fanart: movie.artwork?.fanart || "",
        clearlogo: movie.artwork?.clearlogo || "",
        clearart: movie.artwork?.clearart || null,
        banner: movie.artwork?.banner || null,
        landscape: movie.artwork?.landscape || null,
        character_art: [],
      },
      trailer: movie.trailer || "",
      external_ids: {
        tmdb_id: movie.tmdb_id || null,
        imdb_id: movie.imdb_id || null,
      },
      collection: movie.collection || "",
      similar_movies: [],
      awards: {
        summary: movie.awards || "",
      },
      financials: {
        box_office: movie.financials?.box_office || "",
      },
      ratings: [
        { source: "IMDb", value: movie.ratings?.imdb || null, out_of: 10 },
        { source: "Rotten Tomatoes", value: movie.ratings?.rotten_tomatoes || null, unit: "percent" },
        { source: "TMDb", value: movie.ratings?.tmdb || null, out_of: 10 },
      ],
      tags: {
        quality: [specs.resolution],
        source: [specs.source],
        codec: [specs.codec],
        hdr: [specs.hdr],
        audio: [specs.audioCodec],
        other: [specs.enhancement, specs.colorDepth],
        language: availableLangs,
      },
      specs: {
        resolution: specs.resolution,
        source: specs.source,
        codec: specs.codec,
        bit_depth: specs.colorDepth,
        audio: `${specs.audioCodec} @ ${specs.audioBitrate}`,
        channels: specs.channels || "5.1",
        languages: availableLangs,
        subtitles: ["ESub"],
        size: specs.fileSize || "14 GB",
      },
      versions: versions.map((v: any) => ({
        id: v.id,
        name: v.dubbed || `${movie.title} [${v.language}]`,
        language: v.language,
        quality: v.quality,
        source: v.source,
        source_image: SOURCE_IMAGE_MAP[v.source] || SOURCE_IMAGE_MAP["BluRay"],
        codec: v.codec,
        audio: v.audio,
        size: v.size || specs.fileSize,
        stream_url: v.stream_url,
      })),
      stream_url: primaryStreamUrl,
      soundtrack: {},
    };

    if (!chunk.movies) chunk.movies = [];
    const chunkMovieIdx = chunk.movies.findIndex((m: any) => String(m.id) === String(movie.id));
    if (chunkMovieIdx !== -1) {
      chunk.movies[chunkMovieIdx] = completeChunkRecord;
    } else {
      chunk.movies.unshift(completeChunkRecord);
    }

    // 4. Exact catalog.json structure
    const catalogRecord = {
      id: String(movie.id),
      title: movie.title,
      year: movie.year,
      poster: movie.artwork?.poster || "",
      fanart: movie.artwork?.fanart || "",
      rating: movie.ratings?.imdb || movie.ratings?.tmdb || 7.5,
      original_language: movie.original_language || "ta",
      chunk_file: `${DATA_DIR}/${targetChunkRelPath}`,
      primary_stream_url: primaryStreamUrl,
      available_languages: availableLangs,
      version_count: versions.length,
      available_versions: versions.map((v: any) => ({
        language: v.language,
        dubbed: v.dubbed || "",
        quality: v.quality,
        source: v.source,
        source_image: SOURCE_IMAGE_MAP[v.source] || SOURCE_IMAGE_MAP["BluRay"],
        format: specs.source === "BluRay" || specs.source === "REMUX" ? "BluRay" : "WEB-DL",
        codec: v.codec || specs.codec,
        audio: v.audio,
        channels: specs.channels || "5.1",
      })),
    };

    if (!catalog.movies) catalog.movies = [];
    if (isEdit) {
      catalog.movies[existingIndex] = catalogRecord;
    } else {
      catalog.movies.unshift(catalogRecord);
    }

    // 5. Commit Chunk and Catalog
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
      commitSha: catalogCommit.commit.sha,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
