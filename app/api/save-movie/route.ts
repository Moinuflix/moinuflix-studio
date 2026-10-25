import { NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

export async function POST(req: Request) {
  try {
    const { movieDetail, versions, primaryDriveUrl } = await req.json();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
    const REPO = process.env.GITHUB_REPO_NAME || "My-Movies";
    const WORKER_BASE = process.env.CLOUDFLARE_WORKER_BASE || "https://gdrive-stream.moinudeentv.workers.dev/?id=";

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "GITHUB_TOKEN not found in .env.local" }, { status: 500 });
    }

    const octokit = new Octokit({ auth: GITHUB_TOKEN });

    // Function to extract Google Drive file ID
    const extractDriveId = (url: string) => {
      const match = url.match(/[-\\w]{25,}/);
      return match ? match[0] : url;
    };

    const primaryStreamUrl = `${WORKER_BASE}${extractDriveId(primaryDriveUrl)}|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0`;

    // Map source to local Kodi source_image
    const getSourceImage = (src: string) => {
      const s = (src || "").toLowerCase();
      if (s.includes("amzn") || s.includes("amazon")) return "resources/images/sources/amazon.png";
      if (s.includes("nf") || s.includes("netflix")) return "resources/images/sources/netflix.png";
      if (s.includes("dsnp") || s.includes("hotstar")) return "resources/images/sources/hotstar.png";
      if (s.includes("zee")) return "resources/images/sources/zee5.png";
      if (s.includes("sony")) return "resources/images/sources/sonyliv.png";
      return "resources/images/sources/bluray.png";
    };

    // Prepare processed available_versions for catalog.json & chunk
    const processedVersions = (versions || []).map((v: any) => ({
      language: v.language || "Tamil",
      quality: v.quality || "1080p",
      source: v.source || "AMZN",
      source_image: getSourceImage(v.source),
      format: v.format || "WEB-DL",
      codec: v.codec || "x265",
      audio: v.audio || "Dolby Atmos",
      channels: v.channels || "5.1",
      stream_url: v.drive_url ? `${WORKER_BASE}${extractDriveId(v.drive_url)}|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0` : primaryStreamUrl
    }));

    // Unique Movie ID
    const sanitizedTitle = movieDetail.title.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
    const movieId = `${sanitizedTitle}_${movieDetail.year}`;

    // 1. Fetch or initialize catalog.json
    let catalogSha = "";
    let catalogData: any = { total_movies: 0, movies: [] };
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: "catalog.json",
      });
      if (!Array.isArray(data) && data.type === "file") {
        catalogSha = data.sha;
        catalogData = JSON.parse(Buffer.from(data.content, "base64").toString());
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }

    // Determine Chunk File (50 movies per chunk)
    const existingIndex = catalogData.movies.findIndex((m: any) => m.id === movieId);
    let chunkFileName = "";
    let chunkNumber = 1;

    if (existingIndex !== -1) {
      chunkFileName = catalogData.movies[existingIndex].chunk_file;
    } else {
      chunkNumber = Math.floor(catalogData.movies.length / 50) + 1;
      const pad = String(chunkNumber).padStart(2, "0");
      chunkFileName = `chunks/chunk_${pad}.json`;
    }

    // 2. Exact catalog item schema matching your plan
    const catalogItem = {
      id: movieId,
      title: movieDetail.title,
      year: movieDetail.year,
      poster: movieDetail.artwork?.poster || "",
      fanart: movieDetail.artwork?.fanart || "",
      rating: movieDetail.ratings?.[0]?.value || 7.0,
      original_language: movieDetail.original_language || "ta",
      chunk_file: chunkFileName,
      primary_stream_url: primaryStreamUrl,
      available_languages: Array.from(new Set(processedVersions.map((v: any) => v.language))),
      version_count: processedVersions.length,
      available_versions: processedVersions.map((v: any) => ({
        language: v.language,
        quality: v.quality,
        source: v.source,
        source_image: v.source_image,
        format: v.format,
        codec: v.codec,
        audio: v.audio,
        channels: v.channels
      }))
    };

    if (existingIndex !== -1) {
      catalogData.movies[existingIndex] = catalogItem;
    } else {
      catalogData.movies.unshift(catalogItem);
      catalogData.total_movies = catalogData.movies.length;
    }

    // 3. Exact chunk item schema matching your plan
    const firstVer = processedVersions[0] || {};
    const chunkMovieItem = {
      id: movieId,
      title: movieDetail.title,
      original_title: movieDetail.original_title || movieDetail.title,
      year: movieDetail.year,
      tagline: movieDetail.tagline || "",
      plot: movieDetail.plot || "",
      runtime: movieDetail.runtime || 0,
      release_date: movieDetail.release_date || "",
      certification: movieDetail.certification || "UA",
      original_language: movieDetail.original_language || "en",
      genres: movieDetail.genres || [],
      country: movieDetail.country || [],
      studio: movieDetail.studio || [],
      director: movieDetail.director || [],
      writers: movieDetail.writers || [],
      cast: movieDetail.cast || [],
      artwork: movieDetail.artwork || {},
      trailer: movieDetail.trailer || "",
      external_ids: movieDetail.external_ids || {},
      collection: movieDetail.collection || null,
      similar_movies: [],
      awards: movieDetail.awards || { summary: "" },
      financials: movieDetail.financials || { box_office: "$0" },
      ratings: movieDetail.ratings || [],
      tags: {
        quality: Array.from(new Set(processedVersions.map((v: any) => v.quality))),
        source: Array.from(new Set(processedVersions.map((v: any) => v.source))),
        codec: Array.from(new Set(processedVersions.map((v: any) => v.codec))),
        hdr: ["HDR10", "SDR"],
        audio: Array.from(new Set(processedVersions.map((v: any) => v.audio))),
        other: ["MKV", "REMUX"],
        language: Array.from(new Set(processedVersions.map((v: any) => v.language)))
      },
      specs: {
        resolution: firstVer.quality || "1080p",
        source: firstVer.source || "AMZN",
        codec: firstVer.codec || "x265",
        bit_depth: "10bit",
        audio: firstVer.audio || "Dolby Atmos 5.1",
        channels: firstVer.channels || "5.1",
        languages: Array.from(new Set(processedVersions.map((v: any) => v.language))),
        subtitles: ["MSubs"],
        size: null
      },
      versions: processedVersions,
      stream_url: primaryStreamUrl,
      soundtrack: {}
    };

    // Fetch or initialize Chunk File
    let chunkSha = "";
    let chunkData: any = { movies: [] };
    try {
      const { data } = await octokit.rest.repos.getContent({
        owner: OWNER,
        repo: REPO,
        path: chunkFileName,
      });
      if (!Array.isArray(data) && data.type === "file") {
        chunkSha = data.sha;
        chunkData = JSON.parse(Buffer.from(data.content, "base64").toString());
      }
    } catch (e: any) {
      if (e.status !== 404) throw e;
    }

    const chunkMovieIndex = chunkData.movies.findIndex((m: any) => m.id === movieId);
    if (chunkMovieIndex !== -1) {
      chunkData.movies[chunkMovieIndex] = chunkMovieItem;
    } else {
      chunkData.movies.unshift(chunkMovieItem);
    }

    // 4. Commit Chunk File to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: chunkFileName,
      message: `MoinuFlix Admin: Ingest ${movieDetail.title} (${movieDetail.year}) into ${chunkFileName}`,
      content: Buffer.from(JSON.stringify(chunkData, null, 2)).toString("base64"),
      sha: chunkSha || undefined,
    });

    // 5. Commit catalog.json to GitHub
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: OWNER,
      repo: REPO,
      path: "catalog.json",
      message: `MoinuFlix Admin: Update catalog.json for ${movieDetail.title}`,
      content: Buffer.from(JSON.stringify(catalogData, null, 2)).toString("base64"),
      sha: catalogSha || undefined,
    });

    return NextResponse.json({ success: true, chunk: chunkFileName });
  } catch (error: any) {
    console.error("Save Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}