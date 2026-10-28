import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { movie, specs, versions, rawFilename } = await req.json();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
    const REPO_NAME = process.env.GITHUB_REPO_NAME || "My-Movies";
    const WORKER_BASE = process.env.CLOUDFLARE_WORKER_BASE || "https://gdrive-stream.moinudeentv.workers.dev/?id=";
    const USER_AGENT_TAG = "|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0";

    if (!GITHUB_TOKEN) {
      return NextResponse.json({ error: "Missing GITHUB_TOKEN in env" }, { status: 500 });
    }

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "MoinuFlix-Admin-Engine"
    };

    // 1. Fetch catalog.json
    const catalogRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/catalog.json`,
      { headers }
    );
    let catalogContent: any = { movies: [] };
    let catalogSha: string | undefined;

    if (catalogRes.ok) {
      const catData = await catalogRes.json();
      catalogSha = catData.sha;
      const parsed = JSON.parse(Buffer.from(catData.content, "base64").toString("utf-8"));
      catalogContent = Array.isArray(parsed) ? { movies: parsed } : (parsed.movies ? parsed : { movies: [] });
    }

    // 2. Calculate Chunk File (50 Movies limit per chunk)
    const totalMovies = catalogContent.movies.length;
    const chunkNum = Math.floor(totalMovies / 50) + 1;
    const chunkFileName = `chunks/chunk_${String(chunkNum).padStart(2, "0")}.json`;

    // 3. Fetch or Create Target Chunk File
    let chunkMovies: any[] = [];
    let chunkSha: string | undefined;

    const chunkRes = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${chunkFileName}`,
      { headers }
    );
    if (chunkRes.ok) {
      const chunkData = await chunkRes.json();
      chunkSha = chunkData.sha;
      const parsedChunk = JSON.parse(Buffer.from(chunkData.content, "base64").toString("utf-8"));
      chunkMovies = parsedChunk.movies || [];
    }

    // Format versions with Cloudflare stream URLs
    const formattedVersions = versions.map((v: any) => ({
      id: v.driveId,
      name: `${movie.title} (${movie.year}) [${v.resolution}] [${v.source}] [${v.language} ${v.channels} - ${specs.audioBitrate}] [${v.size}].mkv`,
      language: v.language,
      dubbed: v.dubbed || "Original Track",
      quality: v.resolution,
      resolution: v.resolution,
      source: v.source,
      codec: v.codec,
      audio: v.audio,
      channels: v.channels,
      bitrate: specs.audioBitrate,
      size: v.size,
      stream_url: `${WORKER_BASE}${v.driveId}${USER_AGENT_TAG}`
    }));

    const primaryStreamUrl = formattedVersions[0]?.stream_url || "";

    // Step 5: Full Detailed Movie Record (Heavy Tier 2)
    const fullMovieDetail = {
      id: String(movie.id),
      tmdb_id: movie.id,
      imdb_id: "tt" + String(movie.id),
      name: rawFilename || formattedVersions[0]?.name || `${movie.title} (${movie.year}).mkv`,
      title: movie.title, // Clean Kodi title
      original_title: movie.title,
      year: parseInt(movie.year, 10) || 2024,
      runtime: movie.runtime || 120,
      release_date: `${movie.year}-01-01`,
      certification: movie.cert || "UA",
      original_language: (movie.lang || "en").toLowerCase(),
      genres: movie.genres || ["Action", "Drama"],
      tagline: "",
      plot: movie.plot || "",
      country: ["India"],
      studio: ["MoinuFlix Cinema"],
      director: [{ name: "Director" }],
      writers: [{ name: "Writer" }],
      cast: [
        {
          name: "Lead Actor",
          character: "Hero",
          profile: null
        }
      ],
      artwork: {
        poster: movie.poster,
        fanart: movie.fanart,
        landscape: movie.fanart,
        keyart: specs.clearLogo || movie.poster,
        banner: movie.fanart,
        clearlogo: specs.clearLogo,
        clearart: null,
        thumbnail: movie.poster,
        title_card: movie.fanart,
        intertitle: null,
        chapter_cards: [],
        character_art: [],
        extra_posters: [],
        extra_backdrops: []
      },
      trailer: "",
      ratings: [
        { source: "TMDb", value: parseFloat(movie.rating) || 7.0, out_of: 10 },
        { source: "IMDb", value: parseFloat(movie.rating) || 7.0, out_of: 10 }
      ],
      badges: {
        quality: `https://raw.githubusercontent.com/jurialmunkey/skin.arctic.horizon.2/main/media/flags/resolution/${specs.resolution.toLowerCase().includes("2160") ? "2160p" : "1080p"}.png`,
        hdr: "",
        source: `https://raw.githubusercontent.com/jurialmunkey/skin.arctic.horizon.2/main/media/flags/source/${specs.source.toLowerCase()}.png`,
        audio_format: "https://raw.githubusercontent.com/jurialmunkey/skin.arctic.horizon.2/main/media/flags/audio/atmos.png",
        audio_channels: "https://raw.githubusercontent.com/jurialmunkey/skin.arctic.horizon.2/main/media/flags/audio/5.1.png"
      },
      specs: {
        resolution: specs.resolution,
        source: specs.source,
        codec: specs.codec,
        bit_depth: specs.colorDepth,
        audio: specs.audioCodec,
        channels: "5.1",
        bitrate: specs.audioBitrate,
        languages: Array.from(new Set(formattedVersions.map((v: any) => v.language))).join("-"),
        size: specs.fileSize
      },
      stream_url: primaryStreamUrl,
      versions: formattedVersions
    };

    // Prevent duplicate entries in chunk
    chunkMovies = chunkMovies.filter((m: any) => String(m.id) !== String(movie.id));
    chunkMovies.push(fullMovieDetail);

    // Save Chunk file to GitHub
    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${chunkFileName}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Add ${movie.title} to ${chunkFileName}`,
        content: Buffer.from(JSON.stringify({ movies: chunkMovies }, null, 2)).toString("base64"),
        sha: chunkSha
      })
    });

    // Step 5: Lightweight Catalog Entry (Tier 1)
    const catalogEntry = {
      id: String(movie.id),
      title: movie.title,
      year: parseInt(movie.year, 10) || 2024,
      poster: movie.poster,
      fanart: movie.fanart,
      logo: specs.clearLogo,
      rating: parseFloat(movie.rating) || 7.0,
      original_language: (movie.lang || "en").toLowerCase(),
      genres: movie.genres || ["Action", "Drama"],
      chunk_file: chunkFileName,
      primary_stream_url: primaryStreamUrl,
      available_languages: Array.from(new Set(formattedVersions.map((v: any) => v.language))),
      version_count: formattedVersions.length,
      available_versions: formattedVersions.map((v: any) => ({
        language: v.language,
        quality: v.quality,
        source: v.source,
        source_image: `resources/images/sources/${v.source.toLowerCase()}.png`,
        format: v.source,
        codec: v.codec,
        audio: v.audio,
        channels: v.channels,
        bitrate: v.bitrate,
        size: v.size
      }))
    };

    // Prevent duplicate entries in catalog
    catalogContent.movies = catalogContent.movies.filter((m: any) => String(m.id) !== String(movie.id));
    catalogContent.movies.push(catalogEntry);

    // Save catalog.json to GitHub
    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/catalog.json`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Update catalog.json with ${movie.title}`,
        content: Buffer.from(JSON.stringify(catalogContent, null, 2)).toString("base64"),
        sha: catalogSha
      })
    });

    return NextResponse.json({
      success: true,
      id: movie.id,
      chunk: chunkFileName
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
