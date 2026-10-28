"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";
const WORKER_BASE = "https://gdrive-stream.moinudeentv.workers.dev/?id=";
const USER_AGENT = "|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0";

interface VersionItem {
  id: string;
  language: string;
  quality: string;
  source: string;
  audio: string;
  channels: string;
  codec: string;
  size: string;
  driveId: string;
}

export default function MoinuFlixAutomaticFlow() {
  // Step 1 & 2: Search & Select
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMoviePreview, setSelectedMoviePreview] = useState<any>(null);

  // Step 4: Auto Fill Form Details
  const [movieData, setMovieData] = useState<any>({
    title: "",
    year: "2024",
    rating: "7.5",
    runtime: 120,
    genres: ["Action", "Thriller"],
    lang: "en",
    cert: "PG-13",
    releaseDate: "2024-01-01",
    plot: "",
    collection: "",
    tmdb_id: 0,
    imdb_id: ""
  });

  // Step 5: Cast & Crew
  const [directors, setDirectors] = useState<any[]>([]);
  const [writers, setWriters] = useState<any[]>([]);
  const [cast, setCast] = useState<any[]>([]);

  // Step 6: Artwork & Photos
  const [artwork, setArtwork] = useState<any>({
    poster: "",
    fanart: "",
    clearlogo: "",
    stills: []
  });

  // Step 7: Tags & Versions
  const [activeTags, setActiveTags] = useState<string[]>([
    "2160p", "1080p", "WEB-DL", "x265", "Atmos", "5.1"
  ]);
  const [versions, setVersions] = useState<VersionItem[]>([
    {
      id: "v1",
      language: "Tamil",
      quality: "4K UHD",
      source: "Netflix",
      audio: "Dolby Atmos",
      channels: "5.1",
      codec: "x265",
      size: "14 GB",
      driveId: ""
    }
  ]);
  const [primaryDriveId, setPrimaryDriveId] = useState("");

  // Status & Submit
  const [fetchingDetails, setFetchingDetails] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  // Step 1: Live TMDb Search
  const handleSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&language=en-US`);
      const data = await res.json();
      setSearchResults(data.results?.slice(0, 5) || []);
    } catch (e) {
      console.error(e);
    }
    setSearching(false);
  };

  // Step 2 & 3: Select Movie & Deep Auto Fetch
  const handleSelectMovie = async (basic: any) => {
    setSearchResults([]);
    setFetchingDetails(true);
    setSaveStatus("Auto-fetching Metadata, IMDb, Credits & ClearLogo...");

    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${basic.id}?api_key=${TMDB_KEY}&append_to_response=credits,release_dates,external_ids,images&include_image_language=en,ta,te,hi,null`);
      const d = await res.json();

      // Certification extraction
      let cert = "UA";
      const rels = d.release_dates?.results || [];
      const inRel = rels.find((r: any) => r.iso_3166_1 === "IN") || rels.find((r: any) => r.iso_3166_1 === "US");
      if (inRel?.release_dates?.[0]?.certification) {
        cert = inRel.release_dates[0].certification;
      }

      // Fanart.tv ClearLogo fetch
      let logo = "";
      try {
        const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${d.id}?api_key=${FANART_KEY}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          logo = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
        }
      } catch (_) {}

      // Fallback TMDb logo
      if (!logo && d.images?.logos?.[0]?.file_path) {
        logo = `https://image.tmdb.org/t/p/original${d.images.logos[0].file_path}`;
      }

      // Crew & Cast
      const crew = d.credits?.crew || [];
      const dirList = crew.filter((c: any) => c.job === "Director");
      const wriList = crew.filter((c: any) => ["Writer", "Screenplay", "Story"].includes(c.job));
      const castList = (d.credits?.cast || []).slice(0, 8);

      // Stills
      const stillsList = (d.images?.backdrops || []).slice(0, 6).map((b: any) => `https://image.tmdb.org/t/p/w300${b.file_path}`);

      // Set State
      setSelectedMoviePreview({
        title: d.title,
        year: (d.release_date || "2024").split("-")[0],
        cert,
        runtime: d.runtime ? `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` : "2h 10m",
        genres: (d.genres || []).map((g: any) => g.name).join(", "),
        director: dirList.map((x: any) => x.name).join(", ") || "N/A",
        tmdb_id: d.id,
        imdb_id: d.external_ids?.imdb_id || d.imdb_id || `tt${d.id}`,
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : ""
      });

      setMovieData({
        title: d.title,
        year: (d.release_date || "2024").split("-")[0],
        rating: d.vote_average ? d.vote_average.toFixed(1) : "7.5",
        runtime: d.runtime || 130,
        genres: (d.genres || []).map((g: any) => g.name),
        lang: d.original_language || "en",
        cert,
        releaseDate: d.release_date || "2024-01-01",
        plot: d.overview || "",
        collection: d.belongs_to_collection?.name || "",
        tmdb_id: d.id,
        imdb_id: d.external_ids?.imdb_id || d.imdb_id || `tt${d.id}`
      });

      setDirectors(dirList);
      setWriters(wriList);
      setCast(castList);

      setArtwork({
        poster: d.poster_path ? `https://image.tmdb.org/t/p/w780${d.poster_path}` : "",
        fanart: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : "",
        clearlogo: logo,
        stills: stillsList
      });

      setSaveStatus("✅ Data fetched & form auto-filled! Add Drive link in Step 7.");
    } catch (e: any) {
      setSaveStatus(`❌ Error fetching details: ${e.message}`);
    }
    setFetchingDetails(false);
  };

  // Add / Remove Version
  const addVersionRow = () => {
    setVersions([
      ...versions,
      {
        id: `v${versions.length + 1}`,
        language: "Hindi",
        quality: "1080p FHD",
        source: "Netflix",
        audio: "Dolby Digital Plus",
        channels: "5.1",
        codec: "x264",
        size: "4 GB",
        driveId: ""
      }
    ]);
  };

  const removeVersionRow = (idx: number) => {
    if (versions.length === 1) return alert("Kam se kam 1 playback version hona zaroori hai!");
    setVersions(versions.filter((_, i) => i !== idx));
  };

  const updateVersion = (idx: number, field: string, val: string) => {
    const updated = [...versions];
    (updated[idx] as any)[field] = val;
    setVersions(updated);
  };

  // Step 8: Save to JSON & Commit to GitHub (resources/data/catalog.json & chunks/chunk_XX.json)
  const handleSaveToGitHub = async () => {
    const primaryId = primaryDriveId.trim() || versions[0]?.driveId?.trim();
    if (!primaryId) {
      return alert("Kripya Step 7 me Playback Version ya Primary Stream URL me Google Drive ID/Link enter karein!");
    }

    setSaving(true);
    setSaveStatus("Committing to resources/data/catalog.json & chunks/chunk_01.json (Limit 50)...");

    const payload = {
      movie: {
        id: movieData.tmdb_id || Date.now(),
        title: movieData.title,
        year: movieData.year,
        runtime: movieData.runtime,
        rating: movieData.rating,
        cert: movieData.cert,
        lang: movieData.lang,
        collection: movieData.collection,
        poster: artwork.poster,
        fanart: artwork.fanart,
        plot: movieData.plot,
        genres: movieData.genres,
        director: directors.map(d => d.name),
        cast: cast.map(c => ({ name: c.name, role: c.character }))
      },
      specs: {
        source: versions[0]?.source || "WEB-DL",
        audioCodec: versions[0]?.audio || "Dolby Atmos",
        audioBitrate: "640 Kbps",
        fileSize: versions[0]?.size || "10 GB",
        resolution: versions[0]?.quality || "1080p",
        enhancement: "DS4K",
        colorDepth: "10bit",
        codec: versions[0]?.codec || "x265",
        audioTrackString: `${versions[0]?.language} ${versions[0]?.channels} - 640Kbps`,
        clearLogo: artwork.clearlogo
      },
      versions: versions.map(v => ({
        id: v.driveId || primaryId,
        language: v.language,
        quality: v.quality,
        source: v.source,
        codec: v.codec,
        audio: v.audio,
        channels: v.channels,
        size: v.size,
        driveId: v.driveId || primaryId
      })),
      rawFilename: `${movieData.title} (${movieData.year}) [${versions[0]?.quality?.split(" ")[0] || "1080p"}] [${versions[0]?.source || "WEB-DL"}].mkv`,
      category: "movie"
    };

    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus(`🎉 SUCCESS! Committed to resources/data/catalog.json and ${data.chunk || "chunks/chunk_01.json"}!`);
      } else {
        setSaveStatus(`❌ Failed: ${data.error}`);
      }
    } catch (e: any) {
      setSaveStatus(`❌ Network error: ${e.message}`);
    }
    setSaving(false);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 p-4 md:p-8 font-sans">
      {/* Top Banner Title */}
      <div className="bg-[#0c1322] border border-sky-500/20 rounded-2xl p-5 mb-8 shadow-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <span className="bg-red-600 text-white px-2.5 py-0.5 rounded text-sm">MOINUFLIX</span>
            Add Movies (Automatic Flow)
          </h1>
          <p className="text-xs text-sky-400 mt-1 font-mono">
            Enter Movie Name → Auto Fetch → Auto Fill → Add Versions → Save to JSON
          </p>
        </div>
        <div className="text-xs bg-black/40 border border-slate-800 px-3 py-1.5 rounded-xl font-mono text-emerald-400">
          Target: resources/data/
        </div>
      </div>

      {saveStatus && (
        <div className="mb-6 p-3.5 rounded-xl bg-slate-900 border border-sky-500/30 text-xs font-mono font-bold text-amber-300">
          {saveStatus}
        </div>
      )}

      {/* 8-STEP WORKFLOW GRID */}
      <div className="space-y-8">
        
        {/* ROW 1: STEP 1 TO STEP 4 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          {/* STEP 1: Enter Movie Name */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Enter Movie Name</h3>
              </div>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Leo or Mission Impossible"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  className="w-full bg-[#101b33] border border-sky-500/30 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400"
                />
                {searching && <span className="absolute right-3 top-2.5 text-[10px] text-cyan-400">...</span>}
              </div>

              {/* Suggestions */}
              {searchResults.length > 0 && (
                <div className="mt-2 space-y-1.5 bg-[#0e172c] border border-sky-500/30 rounded-xl p-1.5 max-h-60 overflow-y-auto">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMovie(m)}
                      className="flex items-center gap-2 p-1.5 hover:bg-white/10 rounded-lg cursor-pointer transition"
                    >
                      <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-7 h-10 object-cover rounded" alt="" />
                      <div className="overflow-hidden">
                        <div className="text-xs font-bold text-white truncate">{m.title}</div>
                        <div className="text-[10px] text-slate-400">{m.release_date?.split("-")[0] || "N/A"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-4">Type movie name → Auto search from TMDb + Wikipedia + IMDb</p>
          </div>

          {/* STEP 2: Select Movie */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">2</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Select Movie</h3>
              </div>
              {selectedMoviePreview ? (
                <div className="flex gap-3 items-start">
                  <img src={selectedMoviePreview.poster} className="w-16 h-24 object-cover rounded-lg border border-slate-700 shadow" alt="" />
                  <div className="space-y-1 text-[11px] overflow-hidden">
                    <div className="font-black text-white text-xs truncate">{selectedMoviePreview.title}</div>
                    <div className="flex gap-1.5 text-[10px] font-bold text-slate-400">
                      <span className="bg-slate-800 px-1 rounded">{selectedMoviePreview.year}</span>
                      <span className="bg-slate-800 px-1 rounded">{selectedMoviePreview.cert}</span>
                      <span>{selectedMoviePreview.runtime}</span>
                    </div>
                    <div className="text-[10px] text-cyan-400 truncate">{selectedMoviePreview.genres}</div>
                    <div className="text-[10px] text-slate-400">Director: <b>{selectedMoviePreview.director}</b></div>
                    <div className="text-[9px] font-mono text-slate-500">TMDb: {selectedMoviePreview.tmdb_id}</div>
                  </div>
                </div>
              ) : (
                <div className="h-28 flex items-center justify-center text-xs text-slate-500 italic border border-dashed border-slate-800 rounded-xl">
                  Search & pick movie from Step 1
                </div>
              )}
            </div>
            <p className="text-[10px] text-slate-500 mt-4">Shows verification specs and exact database keys</p>
          </div>

          {/* STEP 3: Auto Fetch Metadata */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">3</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Auto Fetch Metadata</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-slate-800">
                  <span className="text-cyan-400 font-bold">TMDB</span>
                  <span className="text-[10px] text-slate-400">Poster, Fanart, Title, Year, Crew, Cast</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-slate-800">
                  <span className="text-white font-bold">IMDb</span>
                  <span className="text-[10px] text-slate-400">IMDb ID, Certification, Rating</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-lg bg-black/30 border border-slate-800">
                  <span className="text-amber-400 font-bold">Fanart.tv</span>
                  <span className="text-[10px] text-slate-400">HD ClearLogo, Banners, Landscapes</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-4">Fetch all available data automatically (no manual entry)</p>
          </div>

          {/* STEP 4: Auto Fill Form */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-4 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">4</span>
                <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Auto Fill Form</h3>
              </div>
              <div className="space-y-2 text-xs">
                <div>
                  <label className="text-[10px] text-slate-400">Title</label>
                  <input
                    type="text"
                    value={movieData.title}
                    onChange={(e) => setMovieData({ ...movieData, title: e.target.value })}
                    className="w-full bg-[#101b33] border border-slate-700 rounded-lg p-1.5 text-xs text-white font-bold"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-400">Year</label>
                    <input
                      type="text"
                      value={movieData.year}
                      onChange={(e) => setMovieData({ ...movieData, year: e.target.value })}
                      className="w-full bg-[#101b33] border border-slate-700 rounded-lg p-1.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Rating</label>
                    <input
                      type="text"
                      value={movieData.rating}
                      onChange={(e) => setMovieData({ ...movieData, rating: e.target.value })}
                      className="w-full bg-[#101b33] border border-slate-700 rounded-lg p-1.5 text-xs text-amber-400 font-bold"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-slate-400">Genres</label>
                  <div className="flex flex-wrap gap-1 mt-0.5">
                    {movieData.genres.map((g: string, i: number) => (
                      <span key={i} className="bg-sky-950 text-cyan-300 border border-sky-800 text-[10px] px-1.5 py-0.2 rounded">
                        {g}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-4">All fields pre-filled from metadata sources</p>
          </div>
        </div>

        {/* ROW 2: STEP 5 & STEP 6 */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* STEP 5: Cast, Crew & Studio */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">5</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Cast, Crew & Studio</h3>
            </div>

            <div className="space-y-3">
              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">Director</span>
                <div className="flex flex-wrap gap-2">
                  {directors.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 bg-[#101b33] border border-slate-700 px-3 py-1.5 rounded-xl text-xs font-bold text-white">
                      <span>🎬</span> {d.name}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <span className="text-[11px] font-bold text-slate-400 block mb-1">Top Cast</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {cast.map((c, i) => (
                    <div key={i} className="bg-[#101b33] border border-slate-800 p-2 rounded-xl flex items-center gap-2">
                      {c.profile_path ? (
                        <img src={`https://image.tmdb.org/t/p/w185${c.profile_path}`} className="w-7 h-9 object-cover rounded" alt="" />
                      ) : (
                        <div className="w-7 h-9 bg-slate-800 rounded flex items-center justify-center text-[8px]">NO</div>
                      )}
                      <div className="overflow-hidden">
                        <div className="text-[10px] font-bold text-white truncate">{c.name}</div>
                        <div className="text-[9px] text-slate-400 truncate">{c.character}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500 mt-4">Automatically fetched full cast, characters and director</p>
          </div>

          {/* STEP 6: Artwork & Photos */}
          <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">6</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Artwork & Photos</h3>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <div>
                <span className="text-[10px] text-slate-400 block mb-1">Poster</span>
                {artwork.poster ? (
                  <img src={artwork.poster} className="h-32 w-full object-cover rounded-xl border border-slate-700 shadow" alt="" />
                ) : (
                  <div className="h-32 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-xs text-slate-600">Poster</div>
                )}
              </div>
              <div className="col-span-2 space-y-2">
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Fanart Backdrop</span>
                  {artwork.fanart ? (
                    <img src={artwork.fanart} className="h-16 w-full object-cover rounded-xl border border-slate-700" alt="" />
                  ) : (
                    <div className="h-16 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-xs text-slate-600">Fanart</div>
                  )}
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 block mb-1">Clear Logo</span>
                  {artwork.clearlogo ? (
                    <img src={artwork.clearlogo} className="h-12 w-full object-contain bg-black/50 p-1 rounded-xl border border-slate-700" alt="" />
                  ) : (
                    <div className="h-12 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-xs text-slate-600">ClearLogo</div>
                  )}
                </div>
              </div>
            </div>
            <p className="text-[10px] text-slate-500">Auto-fetches Poster, Fanart, ClearLogo and Stills</p>
          </div>
        </div>

        {/* ROW 3: STEP 7: OPTIONS & PLAYBACK VERSIONS */}
        <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">7</span>
              <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Options & Playback Versions</h3>
            </div>
            <button
              onClick={addVersionRow}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow transition"
            >
              + Add Another Version
            </button>
          </div>

          {/* Quick Badges */}
          <div className="flex flex-wrap gap-2 mb-4">
            {["2160p", "1080p", "720p", "WEB-DL", "BluRay", "x265", "x264", "HDR10+", "Atmos", "TrueHD 7.1"].map((tag, idx) => (
              <span key={idx} className="bg-slate-800/80 border border-slate-700 text-slate-300 px-2.5 py-1 rounded-lg text-xs font-mono font-bold">
                {tag}
              </span>
            ))}
          </div>

          {/* Playback Versions Rows */}
          <div className="space-y-3">
            {versions.map((ver, idx) => (
              <div key={idx} className="bg-[#101b33] border border-sky-500/20 p-3.5 rounded-xl space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-xs">
                  <div>
                    <label className="text-[10px] text-slate-400">Language</label>
                    <select
                      value={ver.language}
                      onChange={(e) => updateVersion(idx, "language", e.target.value)}
                      className="w-full bg-[#0a1122] border border-slate-700 p-2 rounded-lg text-white font-bold"
                    >
                      <option>Tamil</option>
                      <option>Telugu</option>
                      <option>Hindi</option>
                      <option>English</option>
                      <option>Malayalam</option>
                      <option>Kannada</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Quality</label>
                    <select
                      value={ver.quality}
                      onChange={(e) => updateVersion(idx, "quality", e.target.value)}
                      className="w-full bg-[#0a1122] border border-slate-700 p-2 rounded-lg text-cyan-400 font-bold"
                    >
                      <option>4K UHD</option>
                      <option>1080p FHD</option>
                      <option>720p HD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Source/OTT</label>
                    <select
                      value={ver.source}
                      onChange={(e) => updateVersion(idx, "source", e.target.value)}
                      className="w-full bg-[#0a1122] border border-slate-700 p-2 rounded-lg text-white"
                    >
                      <option>Netflix</option>
                      <option>Amazon Prime Video</option>
                      <option>Sun NXT</option>
                      <option>Disney+ Hotstar</option>
                      <option>SonyLIV</option>
                      <option>Zee5</option>
                      <option>BluRay</option>
                      <option>WEB-DL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Audio</label>
                    <input
                      type="text"
                      value={ver.audio}
                      onChange={(e) => updateVersion(idx, "audio", e.target.value)}
                      className="w-full bg-[#0a1122] border border-slate-700 p-2 rounded-lg text-amber-300 font-mono text-[11px]"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400">Size</label>
                    <input
                      type="text"
                      value={ver.size}
                      onChange={(e) => updateVersion(idx, "size", e.target.value)}
                      className="w-full bg-[#0a1122] border border-slate-700 p-2 rounded-lg text-red-400 font-bold"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={() => removeVersionRow(idx)}
                      className="w-full bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-400 py-2 rounded-lg text-xs font-bold"
                    >
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-amber-400 font-bold block mb-1">
                    Google Drive Link or File ID for this Version
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 1aFmu_tpwZdvV_wiA4FR5U6WzORXKIDrQ or full URL"
                    value={ver.driveId}
                    onChange={(e) => updateVersion(idx, "driveId", e.target.value)}
                    className="w-full bg-[#0a1122] border border-amber-500/30 p-2 rounded-lg text-xs font-mono text-white focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ROW 4: STEP 8: SAVE TO JSON (PREVIEWS & COMMIT BUTTON) */}
        <div className="bg-[#0b1325] border border-sky-500/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">8</span>
            <h3 className="font-bold text-xs uppercase tracking-wider text-slate-300">Save to JSON & Commit</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {/* Catalog Preview */}
            <div className="bg-[#070d19] border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] font-bold text-sky-400 block mb-2">Catalog Entry (resources/data/catalog.json)</span>
              <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-44 p-2 bg-black/40 rounded-lg">
{JSON.stringify(
  {
    id: String(movieData.tmdb_id || "id"),
    title: movieData.title,
    year: movieData.year,
    poster: artwork.poster,
    fanart: artwork.fanart,
    logo: artwork.clearlogo,
    rating: parseFloat(movieData.rating) || 7.5,
    chunk_file: "resources/data/chunks/chunk_01.json",
    version_count: versions.length
  },
  null,
  2
)}
              </pre>
            </div>

            {/* Chunk Preview */}
            <div className="bg-[#070d19] border border-slate-800 rounded-xl p-3">
              <span className="text-[11px] font-bold text-purple-400 block mb-2">Chunk Entry (resources/data/chunks/chunk_01.json)</span>
              <pre className="text-[10px] font-mono text-slate-400 overflow-x-auto max-h-44 p-2 bg-black/40 rounded-lg">
{JSON.stringify(
  {
    id: String(movieData.tmdb_id || "id"),
    title: movieData.title,
    runtime: movieData.runtime,
    genres: movieData.genres,
    director: directors.map(d => d.name),
    cast: cast.slice(0, 3).map(c => ({ name: c.name, role: c.character })),
    versions_count: versions.length
  },
  null,
  2
)}
              </pre>
            </div>
          </div>

          <button
            onClick={handleSaveToGitHub}
            disabled={saving}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-black font-black py-4 rounded-xl text-xs uppercase tracking-wider shadow-2xl transition disabled:opacity-50"
          >
            {saving ? "Writing to GitHub..." : "🚀 SAVE TO JSON & COMMIT TO GITHUB (STEP 8)"}
          </button>
        </div>

      </div>
    </div>
  );
}
