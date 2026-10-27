import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tmdbId = searchParams.get("id");

  if (!tmdbId) {
    return NextResponse.json({ error: "Missing movie ID parameter." }, { status: 400 });
  }

  const tmdbKey = process.env.TMDB_API_KEY;
  const omdbKey = process.env.OMDB_API_KEY;
  const fanartKey = process.env.FANART_API_KEY;

  if (!tmdbKey) {
    return NextResponse.json({ error: "Server missing TMDB_API_KEY configuration." }, { status: 500 });
  }

  try {
    // 1. Fetch TMDB Core, Credits, Releases, Videos, External IDs & Images
    const tmdbRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${tmdbKey}&append_to_response=credits,videos,release_dates,external_ids,images&include_image_language=en,ta,te,hi,null`,
      { next: { revalidate: 3600 } }
    );
    const tmdb = await tmdbRes.json();

    if (tmdb.success === false) {
      return NextResponse.json({ error: tmdb.status_message || "TMDb fetch failed." }, { status: 404 });
    }

    const imdbId = tmdb.external_ids?.imdb_id || tmdb.imdb_id || null;
    const wikidataId = tmdb.external_ids?.wikidata_id || null;

    // Certification (Priority: CBFC India -> MPAA US)
    let certification = "NR";
    const releaseResults = tmdb.release_dates?.results || [];
    const inRelease = releaseResults.find((r: any) => r.iso_3166_1 === "IN");
    const usRelease = releaseResults.find((r: any) => r.iso_3166_1 === "US");
    const targetRelease = inRelease || usRelease || releaseResults[0];
    if (targetRelease?.release_dates?.length > 0) {
      const match = targetRelease.release_dates.find((d: any) => d.certification);
      if (match?.certification) certification = match.certification;
    }

    // Credits
    const rawCrew = tmdb.credits?.crew || [];
    const directors = rawCrew
      .filter((c: any) => c.job === "Director")
      .map((c: any) => ({ name: c.name, job: "Director" }));
    const writers = rawCrew
      .filter((c: any) => ["Writer", "Screenplay", "Story"].includes(c.job))
      .map((c: any) => ({ name: c.name, job: c.job }));
    const cast = (tmdb.credits?.cast || []).slice(0, 15).map((c: any) => ({
      name: c.name,
      character: c.character || "",
      profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
    }));

    // Official Trailer Extraction
    const videos = tmdb.videos?.results || [];
    const trailerObj =
      videos.find((v: any) => v.type === "Trailer" && v.site === "YouTube") ||
      videos.find((v: any) => v.site === "YouTube");
    const trailerUrl = trailerObj?.key ? `https://www.youtube.com/watch?v=${trailerObj.key}` : "";

    // 2. OMDb Ratings, Box Office, Awards
    let omdbData: any = {};
    if (omdbKey && imdbId) {
      try {
        const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${omdbKey}&i=${imdbId}`);
        if (omdbRes.ok) omdbData = await omdbRes.json();
      } catch (_) {}
    }

    // 3. Complete 13-Asset Artwork Extraction (Fanart.tv + TMDb Fallbacks)
    let clearlogo = "";
    let clearart = "";
    let banner = "";
    let landscape = tmdb.backdrop_path ? `https://image.tmdb.org/t/p/w780${tmdb.backdrop_path}` : "";
    let keyart = "";
    let characterArt: string[] = [];

    if (fanartKey) {
      try {
        const fanartRes = await fetch(`https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${fanartKey}`);
        if (fanartRes.ok) {
          const fa = await fanartRes.json();
          const logos = fa.hdmovielogo || fa.movielogo || [];
          if (logos.length > 0) {
            const preferred =
              logos.find((l: any) => l.lang === "en") ||
              logos.find((l: any) => l.lang === tmdb.original_language) ||
              logos[0];
            clearlogo = preferred ? preferred.url : "";
          }

          const arts = fa.hdmovieclearart || fa.movieclearart || [];
          if (arts[0]) clearart = arts[0].url;

          const banners = fa.moviebanner || [];
          if (banners[0]) banner = banners[0].url;

          const thumbs = fa.moviethumb || [];
          if (thumbs[0]) landscape = thumbs[0].url;

          if (fa.characterart?.length > 0) {
            characterArt = fa.characterart.slice(0, 5).map((a: any) => a.url);
          }
        }
      } catch (_) {}
    }

    // Fallbacks from TMDb Images
    if (!clearlogo && tmdb.images?.logos?.length > 0) {
      const bestLogo =
        tmdb.images.logos.find((l: any) => l.iso_639_1 === "en") ||
        tmdb.images.logos.find((l: any) => l.iso_639_1 === tmdb.original_language) ||
        tmdb.images.logos[0];
      if (bestLogo?.file_path) clearlogo = `https://image.tmdb.org/t/p/w500${bestLogo.file_path}`;
    }

    if (!banner && tmdb.images?.backdrops?.length > 0) {
      banner = `https://image.tmdb.org/t/p/w1280${tmdb.images.backdrops[0].file_path}`;
    }

    const extraPosters = (tmdb.images?.posters || [])
      .slice(1, 6)
      .map((p: any) => `https://image.tmdb.org/t/p/w500${p.file_path}`);
    const extraBackdrops = (tmdb.images?.backdrops || [])
      .slice(1, 6)
      .map((b: any) => `https://image.tmdb.org/t/p/original${b.file_path}`);
    const extraLogos = (tmdb.images?.logos || [])
      .slice(1, 6)
      .map((l: any) => `https://image.tmdb.org/t/p/w500${l.file_path}`);

    // Clean RT Percentage
    let rtScore: number | null = null;
    const rtRaw = (omdbData.Ratings || []).find((r: any) => r.Source === "Rotten Tomatoes")?.Value;
    if (rtRaw) {
      const parsed = parseInt(String(rtRaw).replace(/[^0-9]/g, ""), 10);
      if (!isNaN(parsed)) rtScore = parsed;
    }

    const completePayload = {
      id: String(tmdb.id),
      tmdb_id: tmdb.id,
      imdb_id: imdbId,
      wikidata_id: wikidataId,
      title: tmdb.title || "",
      original_title: tmdb.original_title || tmdb.title || "",
      tagline: tmdb.tagline || "",
      year: tmdb.release_date ? parseInt(tmdb.release_date.split("-")[0], 10) : null,
      release_date: tmdb.release_date || null,
      runtime: tmdb.runtime || 0,
      certification,
      original_language: tmdb.original_language || "en",
      genres: (tmdb.genres || []).map((g: any) => g.name),
      countries: (tmdb.production_countries || []).map((c: any) => c.name),
      studio: (tmdb.production_companies || []).map((c: any) => c.name),
      plot: tmdb.overview || "",
      director: directors,
      writers: writers,
      cast: cast,
      artwork: {
        poster: tmdb.poster_path ? `https://image.tmdb.org/t/p/w780${tmdb.poster_path}` : "",
        thumbnail: tmdb.poster_path ? `https://image.tmdb.org/t/p/w342${tmdb.poster_path}` : "",
        fanart: tmdb.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdb.backdrop_path}` : "",
        landscape,
        keyart,
        banner,
        clearlogo,
        clearart,
        character_art: characterArt,
        extra_posters: extraPosters,
        extra_backdrops: extraBackdrops,
        extra_logos: extraLogos,
      },
      trailer: trailerUrl,
      ratings: {
        tmdb: tmdb.vote_average ? Number(tmdb.vote_average) : null,
        imdb: omdbData.imdbRating && omdbData.imdbRating !== "N/A" ? parseFloat(omdbData.imdbRating) : null,
        rotten_tomatoes: rtScore,
      },
      awards: omdbData.Awards && omdbData.Awards !== "N/A" ? omdbData.Awards : "",
      financials: {
        budget: tmdb.budget ? `$${tmdb.budget.toLocaleString()}` : "",
        box_office: omdbData.BoxOffice && omdbData.BoxOffice !== "N/A" ? omdbData.BoxOffice : "",
      },
      collection: tmdb.belongs_to_collection ? tmdb.belongs_to_collection.name : "",
      similar_movies: [],
    };

    return NextResponse.json(completePayload);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
