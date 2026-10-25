import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const { query, tmdbId } = await req.json();
    const TMDB_KEY = process.env.TMDB_API_KEY;
    const OMDB_KEY = process.env.OMDB_API_KEY;
    const FANART_KEY = process.env.FANART_API_KEY;

    if (query && !tmdbId) {
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`
      );
      const searchData = await searchRes.json();
      return NextResponse.json({ results: searchData.results || [] });
    }

    const movieRes = await fetch(
      `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_KEY}&append_to_response=credits,videos,release_dates`
    );
    const movie = await movieRes.json();

    // 1. Fanart.tv (Strictly English Logo First)
    let clearlogo = "";
    if (FANART_KEY) {
      try {
        const fanartRes = await fetch(
          `https://webservice.fanart.tv/v3/movies/${tmdbId}?api_key=${FANART_KEY}`
        );
        const fanartData = await fanartRes.json();
        const logos = (fanartData.hdmovielogo || []).concat(fanartData.movielogo || []);
        // Prefer English first
        const enLogo = logos.find((l: any) => l.lang === "en") || logos.find((l: any) => l.lang === "" || l.lang === "00");
        clearlogo = enLogo ? enLogo.url : (logos.length > 0 ? logos[0].url : "");
      } catch (err) {}
    }

    // 2. OMDb API
    let omdbRatings: any[] = [];
    let boxOffice = "$0";
    let awards = "";
    if (movie.imdb_id && OMDB_KEY) {
      try {
        const omdbRes = await fetch(`https://www.omdbapi.com/?i=${movie.imdb_id}&apikey=${OMDB_KEY}`);
        const omdbData = await omdbRes.json();
        awards = omdbData.Awards || "";
        boxOffice = omdbData.BoxOffice || "";
        omdbRatings = (omdbData.Ratings || []).map((r: any) => {
          if (r.Source === "Rotten Tomatoes") return { source: r.Source, value: parseInt(r.Value), unit: "percent" };
          if (r.Source === "Metacritic") return { source: r.Source, value: parseInt(r.Value.split("/")[0]), out_of: 100 };
          return { source: r.Source, value: parseFloat(r.Value.split("/")[0]), out_of: 10 };
        });
      } catch (err) {}
    }

    // 3. Wikipedia Summary
    let wikiPlot = "";
    try {
      const movieYear = new Date(movie.release_date).getFullYear();
      const wikiSearchUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(movie.title + " " + movieYear + " film")}&format=json&origin=*`;
      const wikiSearchRes = await fetch(wikiSearchUrl);
      const wikiSearchData = await wikiSearchRes.json();

      if (wikiSearchData?.query?.search?.length > 0) {
        const pageTitle = wikiSearchData.query.search[0].title;
        const pageUrl = `https://en.wikipedia.org/w/api.php?prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(pageTitle)}&format=json&origin=*`;
        const pageRes = await fetch(pageUrl);
        const pageData = await pageRes.json();
        const pages = pageData?.query?.pages || {};
        const firstPageId = Object.keys(pages)[0];
        if (firstPageId && pages[firstPageId]?.extract) {
          wikiPlot = pages[firstPageId].extract;
        }
      }
    } catch (err) {}

    // 4. Certification (Priority: India -> US -> Default)
    let certification = "NR";
    const releaseDates = movie.release_dates?.results || [];
    const inRelease = releaseDates.find((r: any) => r.iso_3166_1 === "IN");
    const usRelease = releaseDates.find((r: any) => r.iso_3166_1 === "US");
    const chosenRelease = inRelease || usRelease || releaseDates[0];

    if (chosenRelease && chosenRelease.release_dates?.length > 0) {
      const certEntry = chosenRelease.release_dates.find((d: any) => d.certification && d.certification.trim() !== "");
      if (certEntry) {
        certification = certEntry.certification;
      }
    }

    // Trailer Link
    const trailers = (movie.videos?.results || []).filter((v: any) => v.type === "Trailer" && v.site === "YouTube");
    const trailerUrl = trailers.length > 0 ? `https://www.youtube.com/watch?v=${trailers[0].key}` : "";

    return NextResponse.json({
      title: movie.title,
      original_title: movie.original_title,
      year: new Date(movie.release_date).getFullYear() || 2024,
      tagline: movie.tagline || "",
      plot: movie.overview || wikiPlot || "",
      wiki_summary: wikiPlot || null,
      runtime: movie.runtime || 0,
      release_date: movie.release_date || "",
      certification,
      original_language: movie.original_language,
      genres: (movie.genres || []).map((g: any) => g.name),
      country: (movie.production_countries || []).map((c: any) => c.name),
      studio: (movie.production_companies || []).map((c: any) => c.name),
      director: (movie.credits?.crew || []).filter((c: any) => c.job === "Director").map((c: any) => ({ name: c.name })),
      writers: (movie.credits?.crew || []).filter((c: any) => ["Writer", "Screenplay"].includes(c.job)).map((c: any) => ({ name: c.name })),
      cast: (movie.credits?.cast || []).slice(0, 10).map((c: any) => ({
        name: c.name,
        character: c.character,
        profile: c.profile_path ? `https://image.tmdb.org/t/p/w185${c.profile_path}` : null,
      })),
      artwork: {
        poster: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : "",
        thumbnail: null,
        fanart: movie.backdrop_path ? `https://image.tmdb.org/t/p/original${movie.backdrop_path}` : "",
        clearlogo,
        clearart: null,
        banner: null,
        landscape: null,
        character_art: [],
      },
      trailer: trailerUrl,
      external_ids: { tmdb_id: movie.id, imdb_id: movie.imdb_id },
      collection: movie.belongs_to_collection?.name || null,
      awards: { summary: awards },
      financials: { box_office: boxOffice },
      ratings: omdbRatings.length > 0 ? omdbRatings : [{ source: "TMDb", value: movie.vote_average, out_of: 10 }],
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}