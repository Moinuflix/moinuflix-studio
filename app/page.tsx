"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

interface ArrivalItem {
  id: string;
  name: string;
  size: string;
  category: string;
  match?: {
    tmdb_id: number;
    title: string;
    year: string;
    poster: string;
    fanart: string;
    clearlogo: string;
    rating: string;
    lang: string;
    plot: string;
    genres: string[];
    certification: string;
    runtime: number;
  } | null;
  loadingMatch?: boolean;
}

export default function MoinuFlixStudio() {
  const [activeTab, setActiveTab] = useState<"add" | "arrivals">("arrivals");

  // Drive Arrivals (1 to 50 Items)
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([
    {
      id: "1pn1LE4MoDJdxxx_Billa",
      name: "Billa 2007 1080p AMZN WEB-DL DD+5 1 H 264-TR.mkv",
      size: "10 GB",
      category: "Movie",
      match: null
    },
    {
      id: "1GNYi1EPuHS3xxx_Jilla",
      name: "Jilla 2014 1080p AMZN WEB-DL DD+5 1 H264-BeAsT.mkv",
      size: "12 GB",
      category: "Movie",
      match: null
    },
    {
      id: "1ushheQ_CAw_Cars",
      name: "Cars (2006) 1080p BluRay x265 10bit HEVC [Org Hindi BD 5.1 ~ 448Kbps + English AAC 5.1] [5 GB].mkv",
      size: "5 GB",
      category: "Movie",
      match: null
    }
  ]);

  // Form State
  const [query, setQuery] = useState("Cars");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState("");
  const [rawFilename, setRawFilename] = useState("");

  const [specs, setSpecs] = useState({
    source: "BluRay",
    audioCodec: "Dolby Atmos",
    audioBitrate: "448 Kbps",
    fileSize: "5 GB",
    resolution: "1080p",
    enhancement: "DS4K",
    colorDepth: "10bit",
    codec: "x265",
    clearLogo: "https://assets.fanart.tv/fanart/cars-503b8ddaf365d.png"
  });

  const [versions, setVersions] = useState([
    {
      language: "Hindi",
      resolution: "1080p",
      source: "BluRay",
      codec: "x265",
      audio: "Dolby Atmos",
      channels: "5.1",
      dubbed: "Org Hindi BD 5.1 ~ 448Kbps",
      size: "5 GB",
      driveId: "1ushheQ_CAw_r91b9dkvfNV_aleosCy9u"
    }
  ]);

  // Clean title extraction for regional search
  const cleanTitleFromFilename = (fn: string) => {
    let clean = fn.replace(/\.mkv|\.mp4/i, "");
    clean = clean.split(/[0-9]{4}|1080p|720p|2160p|4k|WEB|BluRay|AMZN|NF|HDTV/i)[0];
    clean = clean.replace(/[._-]/g, " ").trim();
    return clean || fn;
  };

  // Auto fetch TMDB Bajuk preview for Drive Arrivals
  const fetchArrivalMatch = async (index: number) => {
    const item = arrivals[index];
    const cleanTitle = cleanTitleFromFilename(item.name);
    
    // Extract year if available
    const yearMatch = item.name.match(/\b(19\d\d|20\d\d)\b/);
    const yearParam = yearMatch ? `&primary_release_year=${yearMatch[1]}` : "";

    const updated = [...arrivals];
    updated[index].loadingMatch = true;
    setArrivals(updated);

    try {
      // Prioritize Indian regional search
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}&region=IN${yearParam}`
      );
      const data = await res.json();
      const top = data.results?.[0];

      if (top) {
        // Fetch detailed artworks including ClearLogo
        let logoUrl = "";
        try {
          const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${top.id}?api_key=${FANART_KEY}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
          }
        } catch (_) {}

        updated[index].match = {
          tmdb_id: top.id,
          title: top.title,
          year: top.release_date ? top.release_date.split("-")[0] : "",
          poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
          fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
          clearlogo: logoUrl,
          rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
          lang: (top.original_language || "hi").toUpperCase(),
          plot: top.overview || "",
          genres: [],
          certification: "UA",
          runtime: 130
        };
      }
    } catch (e) {
      console.error(e);
    }

    updated[index].loadingMatch = false;
    setArrivals(updated);
  };

  // Confirm bajuk TMDb match & load directly into Step 3/4/5
  const handleConfirmArrival = (item: ArrivalItem) => {
    if (!item.match) return;
    setSelectedMovie({
      id: item.match.tmdb_id,
      title: item.match.title,
      year: item.match.year,
      runtime: item.match.runtime,
      rating: item.match.rating,
      cert: item.match.certification,
      lang: item.match.lang,
      poster: item.match.poster,
      fanart: item.match.fanart,
      plot: item.match.plot,
      genres: ["Action", "Drama"]
    });

    setSpecs(prev => ({
      ...prev,
      clearLogo: item.match?.clearlogo || "",
      fileSize: item.size
    }));

    setVersions([
      {
        language: item.match.lang === "TA" ? "Tamil" : item.match.lang === "TE" ? "Telugu" : "Hindi",
        resolution: "1080p",
        source: "WEB-DL",
        codec: "x265",
        audio: "Dolby Atmos",
        channels: "5.1",
        dubbed: "Original Track",
        size: item.size,
        driveId: item.id
      }
    ]);

    setRawFilename(item.name);
    setActiveTab("add");
  };

  const searchMovies = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&region=IN`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const selectMovie = async (item: any) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_KEY}&append_to_response=release_dates,images`);
      const data = await res.json();

      let logoUrl = "";
      try {
        const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${item.id}?api_key=${FANART_KEY}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
        }
      } catch (_) {}

      if (!logoUrl && data.images?.logos?.[0]?.file_path) {
        logoUrl = `https://image.tmdb.org/t/p/original${data.images.logos[0].file_path}`;
      }

      setSpecs(prev => ({ ...prev, clearLogo: logoUrl }));

      setSelectedMovie({
        id: data.id,
        title: data.title,
        year: data.release_date ? data.release_date.split("-")[0] : "2024",
        runtime: data.runtime || 120,
        rating: data.vote_average ? data.vote_average.toFixed(1) : "7.2",
        cert: "UA",
        lang: (data.original_language || "en").toUpperCase(),
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
        fanart: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : "",
        plot: data.overview || "",
        genres: data.genres?.map((g: any) => g.name) || []
      });
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const handleCommit = async () => {
    if (!selectedMovie) return alert("Pehle movie confirm ya select karein!");
    setCommitStatus("Committing to GitHub catalog & chunk_XX.json...");
    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie: selectedMovie,
          specs: specs,
          versions: versions,
          rawFilename: rawFilename
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus(`🎉 Successfully Saved to catalog.json & ${data.chunk}!`);
      } else {
        setCommitStatus("Failed: " + (data.error || "Check GitHub Token"));
      }
    } catch (e: any) {
      setCommitStatus("Error syncing: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-4">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-wider">CINEMA STUDIO INGESTION</span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("arrivals")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === "arrivals" ? "bg-amber-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <span>🔔</span> Drive Arrivals ({arrivals.length})
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === "add" ? "bg-red-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <span>➕</span> Movie Studio Form
          </button>
        </div>
      </div>

      {/* VIEW: DRIVE ARRIVALS WITH BAJUK TMDB PREVIEW */}
      {activeTab === "arrivals" && (
        <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="mb-6">
            <h2 className="text-lg font-black text-white flex items-center gap-2">
              <span>⚡</span> Step 2: Google Drive Arrivals & Bajuk TMDb Confirmation Hub
            </h2>
            <p className="text-xs text-gray-400 mt-1">
              Google Drive file ke theek bajuk me TMDb official poster preview hoga. Confirm karne ke baad hi Step 3/4 execute hoga.
            </p>
          </div>

          <div className="space-y-4">
            {arrivals.map((item, idx) => (
              <div
                key={idx}
                className="bg-[#10192d] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
              >
                {/* Left: Raw File Details */}
                <div className="lg:col-span-5 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold">
                      {item.category}
                    </span>
                    <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                  </div>
                  <div className="text-sm font-bold text-white break-all">{item.name}</div>
                  <div className="text-[11px] text-gray-500 font-mono">ID: {item.id}</div>
                  {!item.match && !item.loadingMatch && (
                    <button
                      onClick={() => fetchArrivalMatch(idx)}
                      className="mt-2 text-xs text-sky-400 hover:underline flex items-center gap-1"
                    >
                      <span>🔍</span> Fetch TMDb Match Bajuk
                    </button>
                  )}
                </div>

                {/* Center: BAJUK TMDb Preview */}
                <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-4">
                  {item.loadingMatch ? (
                    <div className="text-xs text-gray-400 animate-pulse">Matching Indian TMDb...</div>
                  ) : item.match ? (
                    <div className="flex gap-3 items-center">
                      <img
                        src={item.match.poster || "https://image.tmdb.org/t/p/w92/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"}
                        className="w-12 h-18 object-cover rounded border border-gray-700 shadow"
                      />
                      <div className="space-y-0.5">
                        <div className="text-sm font-black text-white">{item.match.title}</div>
                        <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                          <span>{item.match.year}</span>
                          <span>•</span>
                          <span className="text-amber-400">★ {item.match.rating}</span>
                          <span>•</span>
                          <span className="bg-blue-950 text-blue-400 px-1.5 py-0.2 rounded border border-blue-800">
                            LANG: {item.match.lang}
                          </span>
                        </div>
                        <p className="text-[11px] text-gray-400 line-clamp-1">{item.match.plot}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500 italic">No TMDb match loaded yet. Click fetch to preview bajuk.</div>
                  )}
                </div>

                {/* Right: Confirm Action */}
                <div className="lg:col-span-2 flex flex-col items-end justify-center gap-2">
                  <button
                    onClick={() => {
                      if (!item.match) fetchArrivalMatch(idx);
                      else handleConfirmArrival(item);
                    }}
                    className={`w-full py-2.5 px-4 rounded-lg font-black text-xs uppercase tracking-wider transition shadow ${
                      item.match
                        ? "bg-emerald-600 hover:bg-emerald-500 text-black"
                        : "bg-sky-600 hover:bg-sky-500 text-white"
                    }`}
                  >
                    {item.match ? "✅ Confirm & Load" : "🔍 Auto Match"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW: MOVIE STUDIO FORM (STEP 3, 4, 5 TWO-TIER COMMIT) */}
      {activeTab === "add" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">STEP 1 & 2: SEARCH TITLE</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchMovies()}
                  placeholder="Type Indian or Hollywood movie..."
                  className="w-full bg-[#131c2e] border border-gray-700/80 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 font-medium"
                />
                <button
                  onClick={searchMovies}
                  className="bg-red-600 hover:bg-red-700 font-bold px-5 py-2 rounded-lg text-sm shadow transition"
                >
                  {loading ? "..." : "Find"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => selectMovie(m)}
                      className="flex items-center gap-3 bg-[#131d31] hover:bg-gray-800 p-2 rounded-lg cursor-pointer border border-transparent hover:border-red-500 transition"
                    >
                      {m.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-10 h-14 object-cover rounded shadow" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-800 rounded flex items-center justify-center text-[10px]">No Pic</div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">{m.title}</div>
                        <div className="text-xs text-gray-400">{m.release_date?.split("-")[0]} • {m.original_language?.toUpperCase()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* RAW FILE RENAME PARSER */}
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>⚡</span> RAW FILE RENAME PARSER (STEP 4)
              </h2>
              <textarea
                rows={3}
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                placeholder="Paste raw file name here..."
                className="w-full bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500"
              />
              <div className="text-[10px] text-gray-500 mt-1">
                Kodi Clean Title: <span className="text-emerald-400 font-bold">{selectedMovie?.title || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Right Column: Complete Cinema Card & Two-Tier Commit */}
          <div className="lg:col-span-7 space-y-5">
            {/* Wide Banner + Transparent ClearLogo */}
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-6 shadow-2xl min-h-[170px] flex items-center">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
                style={{ backgroundImage: `url(${selectedMovie?.fanart || "https://image.tmdb.org/t/p/original/sd4xN5xi8tKRPrJOWwNiZEile7f.jpg"})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/70 to-transparent" />

              <div className="relative z-10 flex gap-5 items-center w-full">
                <img
                  src={selectedMovie?.poster || "https://image.tmdb.org/t/p/w500/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"}
                  className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-xl"
                />
                <div className="space-y-3">
                  {specs.clearLogo ? (
                    <img src={specs.clearLogo} className="h-11 object-contain drop-shadow-md" />
                  ) : (
                    <h1 className="text-2xl font-black text-white">{selectedMovie?.title || "Cars"}</h1>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                      {selectedMovie?.cert || "UA"}
                    </span>
                    <span className="text-gray-300">{selectedMovie?.year || "2006"}</span>
                    <span className="text-gray-400">• {selectedMovie?.runtime || "117"} min</span>
                    <span className="bg-amber-950/80 text-amber-400 border border-amber-800/80 px-2 py-0.5 rounded flex items-center gap-1">
                      ★ IMDb {selectedMovie?.rating || "7.3"}
                    </span>
                    <span className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">
                      LANG: {selectedMovie?.lang || "EN"}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ClearLogo Box */}
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <label className="text-[11px] font-bold text-gray-400 block mb-2">
                Kodi ClearLogo URL (Auto-fetched from Fanart.tv / TMDb)
              </label>
              <input
                type="text"
                value={specs.clearLogo}
                onChange={(e) => setSpecs({ ...specs, clearLogo: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700/80 px-3 py-2 rounded-lg text-xs text-amber-300 font-mono focus:outline-none"
              />
            </div>

            {/* Color Chips */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.resolution}</span>
              <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.source}</span>
              <span className="bg-amber-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.enhancement}</span>
              <span className="bg-purple-800 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.colorDepth}</span>
              <span className="bg-green-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.codec}</span>
              <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">
                {specs.audioCodec} @ {specs.audioBitrate}
              </span>
              <span className="bg-[#8b2d18] font-bold text-xs px-3 py-1 rounded text-white shadow flex items-center gap-1">
                📦 {specs.fileSize}
              </span>
            </div>

            {/* Step 7 Playback Versions */}
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg space-y-3">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">
                    STEP 7: PLAYBACK VERSIONS & AUDIO TRACKS
                  </h3>
                  <p className="text-[10px] text-gray-500">Configured for Kodi Arctic Fuse 2 / Horizon 2</p>
                </div>
              </div>

              {versions.map((ver, idx) => (
                <div key={idx} className="space-y-2 pt-2 border-t border-gray-800">
                  <div className="grid grid-cols-6 gap-2">
                    <select
                      value={ver.language}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].language = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-white"
                    >
                      <option>Hindi</option>
                      <option>Tamil</option>
                      <option>Telugu</option>
                      <option>English</option>
                    </select>

                    <select
                      value={ver.resolution}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].resolution = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-blue-950/60 border border-blue-700 p-1.5 rounded text-xs text-blue-300 font-bold"
                    >
                      <option>1080p</option>
                      <option>2160p</option>
                      <option>720p</option>
                    </select>

                    <select
                      value={ver.source}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].source = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-amber-950/60 border border-amber-700 p-1.5 rounded text-xs text-amber-300 font-bold"
                    >
                      <option>BluRay</option>
                      <option>WEB-DL</option>
                      <option>AMZN</option>
                    </select>

                    <select
                      value={ver.codec}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].codec = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-emerald-950/60 border border-emerald-700 p-1.5 rounded text-xs text-emerald-300 font-bold"
                    >
                      <option>x265</option>
                      <option>x264</option>
                    </select>

                    <select
                      value={ver.audio}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].audio = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-amber-950/60 border border-amber-700 p-1.5 rounded text-xs text-amber-300 font-bold"
                    >
                      <option>Dolby Atmos</option>
                      <option>DDP 5.1</option>
                      <option>DTS 5.1</option>
                    </select>

                    <select
                      value={ver.channels}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].channels = e.target.value;
                        setVersions(copy);
                      }}
                      className="bg-blue-950/60 border border-blue-700 p-1.5 rounded text-xs text-blue-300 font-bold"
                    >
                      <option>5.1</option>
                      <option>7.1</option>
                      <option>2.0</option>
                    </select>
                  </div>

                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={ver.dubbed}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].dubbed = e.target.value;
                        setVersions(copy);
                      }}
                      className="w-1/3 bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-white"
                    />
                    <input
                      type="text"
                      value={ver.size}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].size = e.target.value;
                        setVersions(copy);
                      }}
                      className="w-24 bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-amber-400 font-mono"
                    />
                    <input
                      type="text"
                      value={ver.driveId}
                      onChange={(e) => {
                        const copy = [...versions];
                        copy[idx].driveId = e.target.value;
                        setVersions(copy);
                      }}
                      placeholder="Google Drive File ID"
                      className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-cyan-300 font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Commit Button */}
            <button
              onClick={handleCommit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3.5 rounded-xl text-sm tracking-wider uppercase shadow-xl transition"
            >
              Save to JSON & Commit to GitHub (Step 8)
            </button>

            {commitStatus && (
              <div className="p-3 bg-[#0c1322] border border-gray-700 rounded-lg text-center text-xs font-semibold text-yellow-400">
                {commitStatus}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
