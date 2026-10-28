import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST() {
  const tmdbKey = process.env.TMDB_API_KEY;
  const fanartKey = process.env.FANART_API_KEY;

  if (!tmdbKey) {
    return NextResponse.json({ error: "Missing TMDB_API_KEY" }, { status: 500 });
  }

  const catalogPath = path.join(process.cwd(), "catalog.json");
  if (!fs.existsSync(catalogPath)) {
    return NextResponse.json({ error: "catalog.json not found" }, { status: 404 });
  }

  const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf-8"));
  let updatedCount = 0;

  for (let movie of catalog.movies || []) {
    // Check if fanart or logo missing
    if (movie.fanart && movie.logo) continue;

    let tmdbId = movie.tmdb_id || movie.id;
    if (tmdbId) {
      try {
        const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}`);
        if (tmdbRes.ok) {
          const tmdbData = await tmdbRes.json();
          if (!movie.fanart && tmdbData.backdrop_path) {
            movie.fanart = `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}`;
            updatedCount++;
          }
        }

        // Fanart.tv ClearLogo check
        if (!movie.logo && fanartKey) {
          const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${fanartKey}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            const logoObj = fData.hdmovielogo?.[0] || fData.movielogo?.[0];
            if (logoObj?.url) {
              movie.logo = logoObj.url;
              updatedCount++;
            }
          }
        }
      } catch (err) {
        console.error("Error fetching for:", movie.title, err);
      }
    }
  }

  if (updatedCount > 0) {
    fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), "utf-8");
  }

  return NextResponse.json({
    success: true,
    message: `Updated missing fanart/logos for ${updatedCount} items!`,
    totalMovies: catalog.movies?.length || 0
  });
}
