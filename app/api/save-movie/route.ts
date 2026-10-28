import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { movie, specs, versions, rawFilename, category } = await req.json();

    const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
    const REPO_OWNER = process.env.GITHUB_REPO_OWNER || "Moinuflix";
    const REPO_NAME = process.env.GITHUB_REPO_NAME || "My-Movies";
    const WORKER_BASE = process.env.CLOUDFLARE_WORKER_BASE || "https://gdrive-stream.moinudeentv.workers.dev/?id=";
    const USER_AGENT_TAG = "|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0";

    const headers = {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "MoinuFlix-Ingestion-Engine"
    };

    // ROUTE 1: SONGS (chunks/data_c03.json)
    if (category === "song") {
      const songPath = "chunks/data_c03.json";
      let songList: any[] = [];
      let songSha: string | undefined;

      const sRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${songPath}`, { headers });
      if (sRes.ok) {
        const sData = await sRes.json();
        songSha = sData.sha;
        songList = JSON.parse(Buffer.from(sData.content, "base64").toString("utf-8"));
      }

      songList.push({
        id: String(movie.id),
        movie_title: movie.title,
        song_title: rawFilename.replace(/\.mkv|\.mp4/i, ""),
        artist: "Anirudh / Harris",
        quality: "5.1 Surround",
        poster: movie.poster,
        stream_url: `${WORKER_BASE}${versions[0]?.driveId}${USER_AGENT_TAG}`
      });

      await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${songPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add song ${movie.title}`,
          content: Buffer.from(JSON.stringify(songList, null, 2)).toString("base64"),
          sha: songSha
        })
      });

      return NextResponse.json({ success: true, target: songPath });
    }

    // ROUTE 2: WEB SERIES (chunks/data_c02.json)
    if (category === "series") {
      const seriesPath = "chunks/data_c02.json";
      let seriesList: any[] = [];
      let seriesSha: string | undefined;

      const serRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${seriesPath}`, { headers });
      if (serRes.ok) {
        const serData = await serRes.json();
        seriesSha = serData.sha;
        seriesList = JSON.parse(Buffer.from(serData.content, "base64").toString("utf-8"));
      }

      seriesList.push({
        id: String(movie.id),
        name: rawFilename,
        title: movie.title,
        year: parseInt(movie.year, 10) || 2024,
        poster: movie.poster,
        fanart: movie.fanart,
        clearlogo: specs.clearLogo,
        stream_url: `${WORKER_BASE}${versions[0]?.driveId}${USER_AGENT_TAG}`
      });

      await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${seriesPath}`, {
        method: "PUT",
        headers,
        body: JSON.stringify({
          message: `Add series ${movie.title}`,
          content: Buffer.from(JSON.stringify(seriesList, null, 2)).toString("base64"),
          sha: seriesSha
        })
      });

      return NextResponse.json({ success: true, target: seriesPath });
    }

    // ROUTE 3: MOVIES (catalog.json + chunks/chunk_XX.json - 50 Movies Limit)
    const catalogRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/catalog.json`, { headers });
    let catalogContent: any = { movies: [] };
    let catalogSha: string | undefined;

    if (catalogRes.ok) {
      const catData = await catalogRes.json();
      catalogSha = catData.sha;
      const parsed = JSON.parse(Buffer.from(catData.content, "base64").toString("utf-8"));
      catalogContent = Array.isArray(parsed) ? { movies: parsed } : (parsed.movies ? parsed : { movies: [] });
    }

    const chunkNum = Math.floor(catalogContent.movies.length / 50) + 1;
    const chunkFileName = `chunks/chunk_${String(chunkNum).padStart(2, "0")}.json`;

    let chunkMovies: any[] = [];
    let chunkSha: string | undefined;

    const chunkRes = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${chunkFileName}`, { headers });
    if (chunkRes.ok) {
      const chunkData = await chunkRes.json();
      chunkSha = chunkData.sha;
      const parsedChunk = JSON.parse(Buffer.from(chunkData.content, "base64").toString("utf-8"));
      chunkMovies = parsedChunk.movies || [];
    }

    const primaryStreamUrl = `${WORKER_BASE}${versions[0]?.driveId}${USER_AGENT_TAG}`;

    const fullMovie = {
      id: String(movie.id),
      tmdb_id: movie.id,
      name: rawFilename,
      title: movie.title,
      year: parseInt(movie.year, 10) || 2024,
      runtime: 120,
      original_language: (movie.lang || "en").toLowerCase(),
      artwork: {
        poster: movie.poster,
        fanart: movie.fanart,
        clearlogo: specs.clearLogo,
        banner: movie.fanart,
        landscape: movie.fanart,
        thumbnail: movie.poster
      },
      specs: specs,
      stream_url: primaryStreamUrl,
      versions: versions.map((v: any) => ({
        ...v,
        stream_url: `${WORKER_BASE}${v.driveId}${USER_AGENT_TAG}`
      }))
    };

    chunkMovies = chunkMovies.filter((m: any) => String(m.id) !== String(movie.id));
    chunkMovies.push(fullMovie);

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${chunkFileName}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Add ${movie.title} to ${chunkFileName}`,
        content: Buffer.from(JSON.stringify({ movies: chunkMovies }, null, 2)).toString("base64"),
        sha: chunkSha
      })
    });

    const catalogEntry = {
      id: String(movie.id),
      title: movie.title,
      year: parseInt(movie.year, 10) || 2024,
      poster: movie.poster,
      fanart: movie.fanart,
      logo: specs.clearLogo,
      rating: parseFloat(movie.rating) || 7.0,
      original_language: (movie.lang || "en").toLowerCase(),
      genres: ["Action", "Drama"],
      chunk_file: chunkFileName,
      primary_stream_url: primaryStreamUrl,
      version_count: 1
    };

    catalogContent.movies = catalogContent.movies.filter((m: any) => String(m.id) !== String(movie.id));
    catalogContent.movies.push(catalogEntry);

    await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/catalog.json`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        message: `Update catalog.json with ${movie.title}`,
        content: Buffer.from(JSON.stringify(catalogContent, null, 2)).toString("base64"),
        sha: catalogSha
      })
    });

    return NextResponse.json({ success: true, chunk: chunkFileName });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
