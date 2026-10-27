import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("id");

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing movie ID" }, { status: 400 });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  const fanartKey = process.env.FANART_API_KEY;

  if (!tmdbKey) {
    return NextResponse.json({ error: "Server missing TMDB_API_KEY" }, { status: 500 });
  }

  try {
    // 1. TMDB Details + Images + Credits + Videos + External IDs
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits,videos,release_dates,external_ids,images&include_image_language=en,ta,te,hi,null`,
      { next: { revalidate: 3600 } }
    );
    const tmdb = await tmdbRes.json();

    if (tmdb.success === false) {
      return NextResponse.json({ error: tmdb.status_message }, { status: 404 });
    }

    const imdbId = tmdb.external_ids?.imdb_id || tmdb.imdb_id;
    const wikidataId = tmdb.external_ids?.wikidata_id || null;

    // Certification
    let certification = "UA";
    const releaseResults = tmdb.release_dates?.results || [];
    const inRelease = releaseResults.find((r: any) => r.iso_3166_1 === "IN");
    const usRelease = releaseResults.find((r: any) => r.iso_3166_1 === "US");
    const targetRelease = inRelease || usRelease;
    if (targetRelease?.release_dates?.length > 0) {
      const match = targetRelease.release_dates.find((d: any) => d.certification);
      if (match?.certification) certification = match.certification;
    }

    // Credits
    const rawCrew = tmdb.credits?.crew || [];
    const directors = rawCrew.filter((c: any) => c.job === "Director").map((c: any) => ({ name: c.name, job: "Director" }));
    const writers = rawCrew.filter((c: any) => ["Writer", "Screenplay", "Story"].includes(c.job)).map((c: any) => ({ name: c.name, job: c.job }));
    const cast = (tmdb.credits?.cast || []).slice(0, 15).map((c: any) => ({
      name: c.name,
      character: c.character,
      profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));

    // Trailer
    const videos = tmdb.videos?.results || [];
    const trailer = videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") || videos[0];

    // 2. OMDb Ratings
    let omdbData: any = {};
    if (omdbKey && imdbId) {
      try {
        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&i=${imdbId}`);
        omdbData = await omdbRes.json();
      } catch (_) {}
    }

    // 3. High-Res Artwork (Fanart.tv Priority -> TMDb Fallback)
    let clearlogo = "";
    let clearart = "";
    let banner = "";
    let landscape = tmdb.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdb.backdrop_path}` : "";

    if (fanartKey) {
      try {
        const fanartRes = await fetch(`https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${fanartKey}`);
        if (fanartRes.ok) {
          const fa = await fanartRes.json();
          const logos = fa.hdmovielogo || fa.movielogo || [];
          if (logos.length > 0) {
            // Find English logo first, or native, or first available
            const preferredLogo = logos.find((l: any) => l.lang === "en") || logos.find((l: any) => l.lang === tmdb.original_language) || logos[0];
            clearlogo = preferredLogo ? preferredLogo.url : "";
          }

          const arts = fa.hdmovieclearart || fa.movieclearart || [];
          if (arts[0]) clearart = arts[0].url;

          const banners = fa.moviebanner || [];
          if (banners[0]) banner = banners[0].url;

          const thumbs = fa.moviethumb || [];
          if (thumbs[0]) landscape = thumbs[0].url;
        }
      } catch (_) {}
    }

    // Fallback to TMDb Logos if Fanart.tv didn't have one!
    if (!clearlogo && tmdb.images?.logos && tmdb.images.logos.length > 0) {
      const tmdbLogos = tmdb.images.logos;
      const bestLogo = tmdbLogos.find((l: any) => l.iso_639_1 === "en") ||
                       tmdbLogos.find((l: any) => l.iso_639_1 === tmdb.original_language) ||
                       tmdbLogos[0];
      if (bestLogo?.file_path) {
        clearlogo = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
      }
    }

    // Fallback for banner from backdrops if not on Fanart
    if (!banner && tmdb.images?.backdrops && tmdb.images.backdrops.length > 0) {
      banner = `https://image.tmdb.org/t/p/w1280${tmdb.images.backdrops[0].file_path}`;
    }

    const completeMetadata = {
      id: String(tmdb.id),
      tmdb_id: tmdb.id,
      imdb_id: imdbId || null,
      wikidata_id: wikidataId || null,
      title: tmdb.title,
      original_title: tmdb.original_title || tmdb.title,
      tagline: tmdb.tagline || "",
      year: tmdb.release_date ? parseInt(tmdb.release_date.split("-")[0], 10) : null,
      release_date: tmdb.release_date || null,
      runtime: tmdb.runtime || 120,
      certification: certification,
      original_language: tmdb.original_language || "en",
      genres: (tmdb.genres || []).map((g: any) => g.name),
      countries: (tmdb.production_countries || []).map((c: any) => c.name),
      studio: (tmdb.production_companies || []).map((c: any) => c.name).join(", "),
      plot: tmdb.overview || "",
      director: directors,
      writers: writers,
      cast: cast,
      artwork: {
        poster: tmdb.poster_path ? `https://image.tmdb.org/t/p/w780${tmdb.poster_path}` : "",
        thumbnail: tmdb.poster_path ? `https://image.tmdb.org/t/p/w342${tmdb.poster_path}` : "",
        fanart: tmdb.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}` : "",
        clearlogo: clearlogo,
        clearart: clearart,
        banner: banner,
        landscape: landscape,
      },
      trailer: trailer ? `https://www.youtube.com/watch?v=${trailer.key}` : "",
      ratings: {
        tmdb: tmdb.vote_average || null,
        imdb: omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? parseFloat(omdbData.imdbRating) : null,
        rotten_tomatoes: (omdbData.Ratings || []).find((r: any) => r.Source === "Rotten Tomatoes")?.Value || null,
      },
      awards: omdbData.Awards && omdbData.Awards !== "N/A" ? omdbData.Awards : "",
      financials: {
        budget: tmdb.budget || null,
        box_office: omdbData.BoxOffice || null,
      },
      collection: tmdb.belongs_to_collection ? tmdb.belongs_to_collection.name : null,
    };

    return NextResponse.json(completeMetadata);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
