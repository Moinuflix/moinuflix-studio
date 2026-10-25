"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const OMDB_KEY = "119b8ea5";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

export default function MoinuFlixStudio() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState("");

  // Raw Filename for Auto-Parser
  const [rawFilename, setRawFilename] = useState("");

  // Video / Audio Specs State
  const [specs, setSpecs] = useState({
    edition: "Extended Collector's Edition",
    resolution: "1080p",
    enhancement: "DS4K",
    colorDepth: "10bit",
    hdr: "SDR",
    codec: "x265 HEVC",
    source: "BluRay",
    audioCodec: "DDP 5.1",
    audioBitrate: "448 Kbps",
    languages: "Hindi-Tamil-Telugu-English"
  });

  const [masterUrl, setMasterUrl] = useState("");
  const [versions, setVersions] = useState<any[]>([
    {
      language: "Hindi",
      quality: "1080p DS4K 10bit",
      source: "BluRay",
      audio: "DDP 5.1 @ 448Kbps",
      stream_url: ""
    }
  ]);

  // SMART AUTO-PARSER ENGINE
  const parseFilename = () => {
    if (!rawFilename) return;
    const fn = rawFilename.toLowerCase();

    let res = "1080p";
    if (fn.includes("2160p") || fn.includes("4k")) res = "2160p (4K)";
    else if (fn.includes("720p")) res = "720p";

    let enh = "Standard";
    if (fn.includes("ds4k")) enh = "DS4K";
    else if (fn.includes("remux")) enh = "Remux";
    else if (fn.includes("imax")) enh = "IMAX Enhanced";

    let col = fn.includes("10bit") ? "10bit" : "8bit";
    let dyn = fn.includes("hdr") ? "HDR10" : fn.includes("dv") ? "Dolby Vision" : "SDR";
    let cdc = fn.includes("hevc") || fn.includes("x265") ? "x265 HEVC" : "x264";
    let src = fn.includes("bluray") || fn.includes("bd") ? "BluRay" : fn.includes("web") ? "WEB-DL" : "AMZN";

    let aud = "DDP 5.1";
    if (fn.includes("1509") || (fn.includes("dts") && fn.includes("1509k"))) aud = "DTS 5.1 (1509k)";
    else if (fn.includes("atmos")) aud = "Dolby Atmos 5.1";
    else if (fn.includes("truehd")) aud = "Dolby TrueHD 7.1";
    else if (fn.includes("ddp") || fn.includes("eac3")) aud = "DDP 5.1";
    else if (fn.includes("ac3") || fn.includes("dd 5.1")) aud = "DD 5.1";

    let br = "448 Kbps";
    if (fn.includes("448kbps") || fn.includes("448")) br = "448 Kbps";
    else if (fn.includes("640kbps") || fn.includes("640")) br = "640 Kbps";
    else if (fn.includes("1509kbps") || fn.includes("1509")) br = "1509 Kbps";

    let detectedLangs: string[] = [];
    if (fn.includes("hindi")) detectedLangs.push("Hindi");
    if (fn.includes("tamil")) detectedLangs.push("Tamil");
    if (fn.includes("telugu")) detectedLangs.push("Telugu");
    if (fn.includes("malayalam")) detectedLangs.push("Malayalam");
    if (fn.includes("kannada")) detectedLangs.push("Kannada");
    if (fn.includes("english") || fn.includes("eng")) detectedLangs.push("English");

    if (detectedLangs.length === 0) detectedLangs = ["Multi Audio"];

    const editionName = fn.includes("extended") ? "Extended Collector's Edition" : fn.includes("imax") ? "IMAX Edition" : "Theatrical";

    setSpecs({
      edition: editionName,
      resolution: res,
      enhancement: enh,
      colorDepth: col,
      hdr: dyn,
      codec: cdc,
      source: src,
      audioCodec: aud,
      audioBitrate: br,
      languages: detectedLangs.join("-")
    });

    // Automatically create version rows for all detected languages
    const newVersions = detectedLangs.map((lang) => ({
      language: lang,
      quality: `${res} ${enh} ${col}`,
      source: src,
      audio: `${aud} ~ ${br}`,
      stream_url: masterUrl
    }));
    setVersions(newVersions);
  };

  // Direct TMDb Search
  const searchMovies = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      alert("Error searching movie: " + e.message);
    }
    setLoading(false);
  };

  // Full Movie Ingestion (TMDb + OMDb + Fanart ClearLogo)
  const selectMovie = async (item: any) => {
    setLoading(true);
    try {
      // 1. Fetch TMDB details
      const tmdbRes = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_KEY}&append_to_response=release_dates,credits`);
      const tmdbData = await tmdbRes.json();

      let cert = "UA";
      const releases = tmdbData.release_dates?.results || [];
      const inRelease = releases.find((r: any) => r.iso_3166_1 === "IN") || releases.find((r: any) => r.iso_3166_1 === "US");
      if (inRelease && inRelease.release_dates?.[0]?.certification) {
        cert = inRelease.release_dates[0].certification;
      }

      // 2. Fetch OMDb (IMDb, Rotten Tomatoes, Ratings)
      let omdbData: any = {};
      if (tmdbData.imdb_id) {
        try {
          const omdbRes = await fetch(`https://www.omdbapi.com/?apikey=${OMDB_KEY}&i=${tmdbData.imdb_id}`);
          omdbData = await omdbRes.json();
        } catch (_) {}
      }

      // 3. Fetch Fanart.tv ClearLogo
      let clearLogoUrl = "";
      try {
        const fanartRes = await fetch(`https://webservice.fanart.tv/v3/movies/${item.id}?api_key=${FANART_KEY}`);
        const fanartData = await fanartRes.json();
        const logos = fanartData.hdmovielogo || fanartData.movielogo || [];
        const englishLogo = logos.find((l: any) => l.lang === "en") || logos[0];
        if (englishLogo) clearLogoUrl = englishLogo.url;
      } catch (_) {}

      const rtRating = (omdbData.Ratings || []).find((r: any) => r.Source === "Rotten Tomatoes")?.Value || "";

      setSelectedMovie({
        id: tmdbData.id,
        imdb_id: tmdbData.imdb_id,
        title: tmdbData.title,
        original_title: tmdbData.original_title,
        year: tmdbData.release_date ? tmdbData.release_date.split("-")[0] : "",
        runtime: tmdbData.runtime || 120,
        genres: tmdbData.genres?.map((g: any) => g.name) || [],
        plot: tmdbData.overview || omdbData.Plot || "",
        poster: tmdbData.poster_path ? `https://image.tmdb.org/t/p/w500${tmdbData.poster_path}` : "",
        backdrop: tmdbData.backdrop_path ? `https://image.tmdb.org/t/p/original${tmdbData.backdrop_path}` : "",
        clearlogo: clearLogoUrl,
        certification: cert,
        imdb_rating: omdbData.imdbRating || tmdbData.vote_average?.toFixed(1) || "N/A",
        rotten_tomatoes: rtRating
      });

      if (rawFilename) {
        parseFilename();
      }
    } catch (e: any) {
      alert("Error loading movie details: " + e.message);
    }
    setLoading(false);
  };

  const addVersionRow = () => {
    setVersions([
      ...versions,
      {
        language: "Hindi",
        quality: `${specs.resolution} ${specs.enhancement}`,
        source: specs.source,
        audio: `${specs.audioCodec} @ ${specs.audioBitrate}`,
        stream_url: masterUrl
      }
    ]);
  };

  const removeVersionRow = (index: number) => {
    setVersions(versions.filter((_, i) => i !== index));
  };

  const updateVersionField = (index: number, field: string, val: string) => {
    const updated = [...versions];
    updated[index][field] = val;
    setVersions(updated);
  };

  const handleCommit = async () => {
    if (!selectedMovie) {
      alert("Pehle movie select karein!");
      return;
    }
    setCommitStatus("Committing to GitHub My-Movies...");
    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie: selectedMovie,
          specs: specs,
          masterUrl: masterUrl,
          versions: versions
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus("🎉 Successfully Synced to GitHub & Kodi Live!");
      } else {
        setCommitStatus("Failed: " + (data.error || "Check GitHub Token"));
      }
    } catch (e: any) {
      setCommitStatus("Error syncing: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg">MOINUFLIX</span>
          <span className="text-sm font-semibold tracking-wide text-gray-300">CINEMA STUDIO MANAGER</span>
        </div>
        <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800 px-3 py-1 rounded-full font-bold">
          ⚡ 5.1 Surround & IMAX Core Mode
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Raw Parser */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1 & 2: TMDB Search */}
          <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl shadow-lg">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Step 1 & 2: Search Title</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type movie name (e.g. Avatar)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMovies()}
                className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm outline-none focus:border-red-500"
              />
              <button onClick={searchMovies} className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2 rounded text-sm">
                {loading ? "..." : "Find"}
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => selectMovie(m)}
                    className="flex items-center gap-3 bg-[#1e293b] hover:bg-gray-800 p-2 rounded cursor-pointer border border-transparent hover:border-red-500 transition-all"
                  >
                    {m.poster_path ? (
                      <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-10 h-14 object-cover rounded shadow" />
                    ) : (
                      <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center text-xs">No Pic</div>
                    )}
                    <div>
                      <div className="font-bold text-sm">{m.title}</div>
                      <div className="text-xs text-gray-400">{m.release_date ? m.release_date.split("-")[0] : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Raw Filename Parser */}
          <div className="bg-[#0f172a] border border-cyan-900/60 p-4 rounded-xl shadow-lg">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">⚡ Raw File Rename Parser (Auto-Fill)</h2>
            </div>
            <textarea
              rows={3}
              placeholder="Paste raw file name here (e.g. Avatar (2009) Extended Collector's Edition 1080p DS4K 10bit BluRay x265 DDP 5.1 ~ 448Kbps...)"
              value={rawFilename}
              onChange={(e) => setRawFilename(e.target.value)}
              className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={parseFilename}
              className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black transition-all"
            >
              Parse Specs & Auto-Fill Everything
            </button>
          </div>
        </div>

        {/* Right Column: Metadata & Full Version Form */}
        <div className="lg:col-span-7 space-y-6">
          {selectedMovie ? (
            <div className="bg-[#0f172a] border border-gray-800 p-5 rounded-xl space-y-5 shadow-2xl relative overflow-hidden">
              {/* Movie Backdrop with ClearLogo Header */}
              <div className="relative rounded-lg overflow-hidden border border-gray-700 p-4 min-h-[160px] flex items-end">
                {selectedMovie.backdrop && (
                  <img
                    src={selectedMovie.backdrop}
                    className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-xs"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent" />
                
                <div className="relative z-10 flex gap-4 items-center">
                  <img src={selectedMovie.poster} className="w-20 h-28 object-cover rounded shadow-lg border border-gray-600" />
                  <div className="space-y-1">
                    {selectedMovie.clearlogo ? (
                      <img src={selectedMovie.clearlogo} className="max-h-12 max-w-[200px] object-contain mb-1" />
                    ) : (
                      <h1 className="text-xl font-black text-white">{selectedMovie.title}</h1>
                    )}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold border border-red-800">
                        {selectedMovie.certification}
                      </span>
                      <span className="text-gray-300 font-semibold">{selectedMovie.year}</span>
                      <span className="text-gray-400">• {selectedMovie.runtime} min</span>
                      <span className="bg-yellow-950 text-yellow-400 px-2 py-0.5 rounded font-bold border border-yellow-800">
                        ⭐ IMDb {selectedMovie.imdb_rating}
                      </span>
                      {selectedMovie.rotten_tomatoes && (
                        <span className="bg-red-900 text-white px-2 py-0.5 rounded font-bold">
                          🍅 {selectedMovie.rotten_tomatoes}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Plot */}
              <p className="text-xs text-gray-300 leading-relaxed bg-[#0a0f1d] p-3 rounded border border-gray-800">
                {selectedMovie.plot}
              </p>

              {/* Dynamic Tech Badges */}
              <div className="flex flex-wrap gap-2 py-1">
                <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.resolution}
                </span>
                <span className="bg-yellow-950 text-yellow-400 border border-yellow-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.enhancement}
                </span>
                <span className="bg-purple-950 text-purple-400 border border-purple-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.colorDepth}
                </span>
                <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.hdr}
                </span>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.codec}
                </span>
                <span className="bg-orange-950 text-orange-400 border border-orange-800 px-2.5 py-1 rounded text-xs font-bold">
                  {specs.audioCodec} @ {specs.audioBitrate}
                </span>
              </div>

              {/* Primary Google Drive Master Link */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Primary Google Drive Master Link</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/file/d/..."
                  value={masterUrl}
                  onChange={(e) => {
                    setMasterUrl(e.target.value);
                    const updated = versions.map((v) => ({ ...v, stream_url: e.target.value }));
                    setVersions(updated);
                  }}
                  className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-xs text-cyan-300 outline-none focus:border-red-500 font-mono"
                />
              </div>

              {/* Stream Specs Configuration Grid */}
              <div className="bg-[#0a0f1d] p-3 rounded-lg border border-gray-800 space-y-2">
                <div className="text-xs font-bold text-gray-400">Master Specs Configuration</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  <div>
                    <label className="text-[10px] text-gray-500">Resolution</label>
                    <select
                      value={specs.resolution}
                      onChange={(e) => setSpecs({ ...specs, resolution: e.target.value })}
                      className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                    >
                      <option>2160p (4K)</option>
                      <option>1080p</option>
                      <option>720p</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Quality / Bit</label>
                    <select
                      value={specs.enhancement}
                      onChange={(e) => setSpecs({ ...specs, enhancement: e.target.value })}
                      className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                    >
                      <option>DS4K</option>
                      <option>Remux</option>
                      <option>BluRay Pure</option>
                      <option>IMAX Enhanced</option>
                      <option>WEB-DL</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Color Depth</label>
                    <select
                      value={specs.colorDepth}
                      onChange={(e) => setSpecs({ ...specs, colorDepth: e.target.value })}
                      className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                    >
                      <option>10bit</option>
                      <option>8bit</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] text-gray-500">Audio Bitrate</label>
                    <select
                      value={specs.audioBitrate}
                      onChange={(e) => setSpecs({ ...specs, audioBitrate: e.target.value })}
                      className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                    >
                      <option>448 Kbps</option>
                      <option>640 Kbps</option>
                      <option>1509 Kbps</option>
                      <option>Lossless TrueHD</option>
                      <option>384 Kbps</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* STEP 7: Playback Versions & Multi-Language Rows */}
              <div className="space-y-3 bg-[#0a0f1d] p-3.5 rounded-lg border border-gray-800">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">
                    Step 7: Playback Versions & Audio Tracks
                  </h3>
                  <button
                    onClick={addVersionRow}
                    className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded font-bold border border-gray-600"
                  >
                    + Add Another Version
                  </button>
                </div>

                <div className="space-y-2">
                  {versions.map((ver, idx) => (
                    <div key={idx} className="flex flex-col md:flex-row gap-2 bg-[#1e293b] p-2.5 rounded border border-gray-700">
                      <select
                        value={ver.language}
                        onChange={(e) => updateVersionField(idx, "language", e.target.value)}
                        className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white"
                      >
                        <option>Hindi</option>
                        <option>Tamil</option>
                        <option>Telugu</option>
                        <option>Malayalam</option>
                        <option>Kannada</option>
                        <option>English</option>
                        <option>Multi Audio</option>
                      </select>
                      <input
                        type="text"
                        value={ver.quality}
                        onChange={(e) => updateVersionField(idx, "quality", e.target.value)}
                        placeholder="Quality (e.g. 1080p DS4K)"
                        className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white w-32"
                      />
                      <input
                        type="text"
                        value={ver.audio}
                        onChange={(e) => updateVersionField(idx, "audio", e.target.value)}
                        placeholder="Audio (e.g. DDP 5.1 ~ 448Kbps)"
                        className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white w-40"
                      />
                      <input
                        type="text"
                        value={ver.stream_url}
                        onChange={(e) => updateVersionField(idx, "stream_url", e.target.value)}
                        placeholder="Google Drive link for this version"
                        className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-cyan-300 flex-1 font-mono"
                      />
                      {versions.length > 1 && (
                        <button
                          onClick={() => removeVersionRow(idx)}
                          className="text-red-400 hover:text-red-300 text-xs px-2 py-1 font-bold"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Step 8 Commit */}
              <button
                onClick={handleCommit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-3.5 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg"
              >
                Save to JSON & Commit to GitHub (Step 8)
              </button>

              {commitStatus && (
                <div className="p-3 bg-gray-900 border border-gray-700 rounded text-center text-xs font-semibold text-yellow-400">
                  {commitStatus}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-[#0f172a] border border-gray-800 p-12 rounded-xl text-center text-gray-500">
              <div className="text-4xl mb-2">🎬</div>
              <div className="text-sm font-semibold">No Movie Selected</div>
              <div className="text-xs text-gray-600 mt-1">Search on left or paste raw file name to auto-populate metadata</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
