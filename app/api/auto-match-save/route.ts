import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { title, gdrive_id, size } = await req.json();
    if (!title || !gdrive_id) {
      return NextResponse.json({ error: "Missing title or gdrive_id" }, { status: 400 });
    }

    const tmdbKey = process.env.TMDB_API_KEY;
    if (!tmdbKey) {
      return NextResponse.json({ error: "Missing TMDB_API_KEY on server" }, { status: 500 });
    }

    const cleanTitle = title
      .replace(/\[.*?\]|\(.*?\)/g, " ")
      .replace(/\b(2160p|1080p|720p|4k|bluray|remux|web-dl|hevc|x265|x264|atmos|ddp|aac)\b.*/gi, "")
      .replace(/[\._-]/g, " ")
      .trim();

    const searchRes = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${tmdbKey}&query=${encodeURIComponent(cleanTitle)}`);
    const searchData = await searchRes.json();
    const match = searchData.results?.[0];

    if (!match) {
      return NextResponse.json({ error: `TMDB match not found for: ${cleanTitle}` }, { status: 404 });
    }

    const host = req.headers.get("host") || "localhost:3000";
    const protocol = host.includes("localhost") ? "http" : "https";
    const metaRes = await fetch(`${protocol}://${host}/api/fetch-meta?id=${match.id}`);
    const movieData = await metaRes.json();

    if (movieData.error) {
      return NextResponse.json({ error: movieData.error }, { status: 500 });
    }

    const streamUrl = `https://gdrive-stream.moinudeentv.workers.dev/?id=${gdrive_id}|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0`;
    movieData.stream_url = streamUrl;
    movieData.specs = {
      quality: "1080p FHD",
      source: "WEB-DL",
      codec: "x265 HEVC",
      audio: "Dolby Atmos",
      channels: "5.1",
      size: size || "10 GB"
    };

    movieData.versions = [
      {
        id: gdrive_id,
        language: (movieData.original_language || "en").toUpperCase(),
        quality: "1080p FHD",
        source: "WEB-DL",
        codec: "x265 HEVC",
        audio: "Dolby Atmos",
        channels: "5.1",
        size: size || "10 GB",
        stream_url: streamUrl
      }
    ];

    const saveRes = await fetch(`${protocol}://${host}/api/movies`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(movieData)
    });
    const saveResult = await saveRes.json();

    return NextResponse.json({ success: true, saved: movieData.title, result: saveResult });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
