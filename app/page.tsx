"use client";
import React, { useState, useEffect } from "react";

export default function MoinuFlixCinemaStudio() {
  const [activeTab, setActiveTab] = useState<"editor" | "library" | "json">("editor");

  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ text: string; success: boolean } | null>(null);

  const [library, setLibrary] = useState<any[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  const [movie, setMovie] = useState<any>(null);
  const [rawFilename, setRawFilename] = useState("");

  const [specs, setSpecs] = useState({
    resolution: "1080p",
    source: "BluRay",
    enhancement: "DS4K",
    colorDepth: "10bit",
    hdr: "SDR",
    codec: "x265 HEVC",
    audioCodec: "DDP 5.1",
    audioBitrate: "448 Kbps",
    channels: "5.1",
  });

  const [versions, setVersions] = useState<any[]>([
    {
      id: "ver-1",
      language: "Hindi",
      quality: "1080p DS4K 10bit",
      source: "BluRay",
      codec: "x265 HEVC",
      audio: "DDP 5.1 @ 448Kbps",
      channels: "5.1",
      stream_url: "",
    },
  ]);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/movies");
      const data = await res.json();
      if (data.movies) setLibrary(data.movies);
    } catch (_) {}
    setLoadingLibrary(false);
  };

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

    let src = "BluRay";
    if (fn.includes("web-dl") || fn.includes("webdl") || fn.includes("webrip")) src = "WEB-DL";
    else if (fn.includes("bluray") || fn.includes("bd")) src = "BluRay";
    else if (fn.includes("amzn")) src = "AMZN WEB-DL";

    const col = fn.includes("10bit") ? "10bit" : "8bit";
    let hdr = "SDR";
    if (fn.includes("hdr10+")) hdr = "HDR10+";
    else if (fn.includes("hdr")) hdr = "HDR10";
    else if (fn.includes("dv") || fn.includes("dolby vision")) hdr = "Dolby Vision";

    let cdc = "x264";
    if (fn.includes("x265") || fn.includes("hevc") || fn.includes("h.265")) cdc = "x265 HEVC";
    else if (fn.includes("av1")) cdc = "AV1";

    let aud = "DDP 5.1";
    if (fn.includes("1509") || fn.includes("dts")) aud = "DTS 5.1";
    else if (fn.includes("atmos")) aud = "Dolby Atmos 5.1";
    else if (fn.includes("truehd")) aud = "TrueHD 7.1";
    else if (fn.includes("ddp") || fn.includes("eac3")) aud = "DDP 5.1";
    else if (fn.includes("ac3") || fn.includes("dd 5.1")) aud = "DD 5.1";

    let br = "448 Kbps";
    if (fn.includes("448kbps") || fn.includes("448")) br = "448 Kbps";
    else if (fn.includes("640kbps") || fn.includes("640")) br = "640 Kbps";
    else if (fn.includes("1509kbps") || fn.includes("1509")) br = "1509 Kbps";

    const detectedLangs: string[] = [];
    if (fn.includes("hindi")) detectedLangs.push("Hindi");
    if (fn.includes("tamil")) detectedLangs.push("Tamil");
    if (fn.includes("telugu")) detectedLangs.push("Telugu");
    if (fn.includes("malayalam")) detectedLangs.push("Malayalam");
    if (fn.includes("kannada")) detectedLangs.push("Kannada");
    if (fn.includes("english") || fn.includes("eng")) detectedLangs.push("English");

    const activeLangs = detectedLangs.length > 0 ? detectedLangs : ["Multi Audio"];

    const updatedSpecs = {
      resolution: res,
      source: src,
      enhancement: enh,
      colorDepth: col,
      hdr: hdr,
      codec: cdc,
      audioCodec: aud,
      audioBitrate: br,
      channels: aud.includes("7.1") ? "7.1" : "5.1",
    };
    setSpecs(updatedSpecs);

    const masterStream = versions[0]?.stream_url || "";
    const newVersions = activeLangs.map((lang, idx) => ({
      id: `ver-${idx + 1}`,
      language: lang,
      quality: `${res} ${enh} ${col}`,
      source: src,
      codec: cdc,
      audio: `${aud} @ ${br}`,
      channels: updatedSpecs.channels,
      stream_url: masterStream,
    }));
    setVersions(newVersions);
  };

  const handleSearch = async () => {
    if (!query) return;
    setLoading(true);
    setCommitStatus(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err: any) {
      alert("Search failed: " + err.message);
    }
    setLoading(false);
  };

  const handleSelectMovie = async (tmdbId: number) => {
    setLoading(true);
    setCommitStatus(null);
    try {
      const res = await fetch(`/api/fetch-meta?id=${tmdbId}`);
      const data = await res.json();
      setMovie(data);
      if (rawFilename) parseFilename();
    } catch (err: any) {
      alert("Metadata load failed: " + err.message);
    }
    setLoading(false);
  };

  const addVersionRow = () => {
    setVersions([
      ...versions,
      {
        id: `ver-${versions.length + 1}`,
        language: "Hindi",
        quality: `${specs.resolution} ${specs.enhancement} ${specs.colorDepth}`,
        source: specs.source,
        codec: specs.codec,
        audio: `${specs.audioCodec} @ ${specs.audioBitrate}`,
        channels: specs.channels,
        stream_url: versions[0]?.stream_url || "",
      },
    ]);
  };

  const removeVersionRow = (idx: number) => {
    setVersions(versions.filter((_, i) => i !== idx));
  };

  const updateVersion = (idx: number, field: string, val: string) => {
    const updated = [...versions];
    updated[idx][field] = val;
    setVersions(updated);
  };

  const handleCommit = async () => {
    if (!movie) {
      alert("Please select a movie first!");
      return;
    }
    setCommitStatus({ text: "Validating & committing to GitHub...", success: true });
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ movie, specs, versions }),
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          text: `🎉 Successfully synced to ${data.chunkPath} & catalog.json!`,
          success: true,
        });
        fetchLibrary();
      } else {
        setCommitStatus({ text: "Failed: " + data.error, success: false });
      }
    } catch (err: any) {
      setCommitStatus({ text: "Commit Error: " + err.message, success: false });
    }
  };

  const handleDeleteMovie = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to permanently delete "${title}" from catalog and chunks?`)) return;
    try {
      const res = await fetch(`/api/movies?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert("Movie deleted successfully.");
        fetchLibrary();
        if (movie?.id === id) setMovie(null);
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch (err: any) {
      alert("Delete request failed: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 font-sans p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 text-white font-black px-3.5 py-1 rounded text-lg tracking-wider">
            MOINUFLIX
          </span>
          <span className="text-sm font-semibold tracking-widest text-gray-400">
            CINEMA STUDIO ADMIN
          </span>
        </div>

        <div className="flex items-center bg-[#0f172a] p-1 rounded-lg border border-gray-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "editor" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Studio Editor
          </button>
          <button
            onClick={() => setActiveTab("library")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "library" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Library Manager ({library.length})
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "json" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            JSON Audit
          </button>
        </div>

        <span className="text-xs bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-3 py-1 rounded-full font-bold shadow-sm">
          ⚡ 5.1 Passthrough & 2-Tier Architecture
        </span>
      </header>

      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">
                Step 1 & 2: Search Title
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type movie name (e.g. Avatar)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm outline-none focus:border-red-500 text-white"
                />
                <button
                  onClick={handleSearch}
                  className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2 rounded text-sm text-white"
                >
                  {loading ? "..." : "Find"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMovie(m.id)}
                      className="flex items-center gap-3 bg-[#1e293b] hover:bg-gray-800 p-2 rounded cursor-pointer border border-transparent hover:border-red-500 transition"
                    >
                      {m.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                          className="w-10 h-14 object-cover rounded shadow"
                          alt={m.title}
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center text-[10px]">
                          No Pic
                        </div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">{m.title}</div>
                        <div className="text-xs text-gray-400">
                          {m.release_date ? m.release_date.split("-")[0] : "N/A"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0f172a] border border-cyan-900/60 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
                ⚡ Raw File Rename Parser (Auto-Fill)
              </h2>
              <textarea
                rows={3}
                placeholder="Paste filename: Avatar (2009) Extended 1080p DS4K 10bit BluRay x265 Multi Audio [Org BD Hindi-Tamil-Telugu DDP 5.1 ~ 448Kbps + Eng]..."
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs outline-none focus:border-cyan-500 font-mono text-gray-200"
              />
              <button
                onClick={parseFilename}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black transition"
              >
                Parse Specs & Auto-Fill Everything
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {movie ? (
              <div className="bg-[#0f172a] border border-gray-800 p-5 rounded-xl space-y-5 shadow-2xl relative overflow-hidden">
                <div className="relative rounded-lg overflow-hidden border border-gray-700 p-4 min-h-[160px] flex items-end">
                  {movie.artwork?.fanart && (
                    <img
                      src={movie.artwork.fanart}
                      className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-xs"
                      alt="Backdrop"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent" />

                  <div className="relative z-10 flex gap-4 items-center">
                    <img
                      src={movie.artwork?.poster}
                      className="w-20 h-28 object-cover rounded shadow-lg border border-gray-600"
                      alt={movie.title}
                    />
                    <div className="space-y-1">
                      {movie.artwork?.clearlogo ? (
                        <img
                          src={movie.artwork.clearlogo}
                          className="max-h-12 max-w-[220px] object-contain mb-1"
                          alt="ClearLogo"
                        />
                      ) : (
                        <h1 className="text-xl font-black text-white">{movie.title}</h1>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold border border-red-800">
                          {movie.certification || "UA"}
                        </span>
                        <span className="text-gray-300 font-semibold">{movie.year}</span>
                        <span className="text-gray-400">• {movie.runtime} min</span>
                        <span className="bg-yellow-950 text-yellow-400 px-2 py-0.5 rounded font-bold border border-yellow-800">
                          ⭐ IMDb {movie.ratings?.imdb || "N/A"}
                        </span>
                        {movie.ratings?.rotten_tomatoes && (
                          <span className="bg-red-900 text-white px-2 py-0.5 rounded font-bold">
                            🍅 {movie.ratings.rotten_tomatoes}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-gray-300 leading-relaxed bg-[#0a0f1d] p-3 rounded border border-gray-800">
                  {movie.plot}
                </p>

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

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">
                    Primary Google Drive Stream URL
                  </label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/d/..."
                    value={versions[0]?.stream_url || ""}
                    onChange={(e) => {
                      const updated = versions.map((v) => ({ ...v, stream_url: e.target.value }));
                      setVersions(updated);
                    }}
                    className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-xs text-cyan-300 outline-none focus:border-red-500 font-mono"
                  />
                </div>

                <div className="bg-[#0a0f1d] p-3 rounded-lg border border-gray-800 space-y-2">
                  <div className="text-xs font-bold text-gray-400">Master Technical Parameters</div>
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
                      <div
                        key={ver.id || idx}
                        className="flex flex-col md:flex-row gap-2 bg-[#1e293b] p-2.5 rounded border border-gray-700"
                      >
                        <select
                          value={ver.language}
                          onChange={(e) => updateVersion(idx, "language", e.target.value)}
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
                          onChange={(e) => updateVersion(idx, "quality", e.target.value)}
                          placeholder="Quality"
                          className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white w-32"
                        />
                        <input
                          type="text"
                          value={ver.audio}
                          onChange={(e) => updateVersion(idx, "audio", e.target.value)}
                          placeholder="Audio"
                          className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white w-40"
                        />
                        <input
                          type="text"
                          value={ver.stream_url}
                          onChange={(e) => updateVersion(idx, "stream_url", e.target.value)}
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

                <button
                  onClick={handleCommit}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-3.5 rounded-lg text-sm tracking-wider uppercase transition shadow-lg"
                >
                  Save to JSON & Commit to GitHub (Step 8)
                </button>

                {commitStatus && (
                  <div
                    className={`p-3 rounded text-center text-xs font-semibold border ${
                      commitStatus.success
                        ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                        : "bg-red-950/80 border-red-800 text-red-300"
                    }`}
                  >
                    {commitStatus.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0f172a] border border-gray-800 p-16 rounded-xl text-center text-gray-500">
                <div className="text-4xl mb-2">🎬</div>
                <div className="text-sm font-semibold text-gray-400">No Movie Selected</div>
                <div className="text-xs text-gray-600 mt-1">
                  Search on left or paste release file name to populate details
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "library" && (
        <div className="bg-[#0f172a] border border-gray-800 p-6 rounded-xl shadow-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-bold text-red-500 uppercase tracking-widest">
              Existing Database Records (catalog.json)
            </h2>
            <button
              onClick={fetchLibrary}
              className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded font-semibold text-gray-300 border border-gray-700"
            >
              🔄 Refresh List
            </button>
          </div>

          {loadingLibrary ? (
            <div className="text-center py-12 text-xs text-gray-500">Loading catalog from GitHub...</div>
          ) : library.length === 0 ? (
            <div className="text-center py-12 text-xs text-gray-500">No movies found in catalog.json.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="py-2.5 px-3">Poster</th>
                    <th className="py-2.5 px-3">Title & Year</th>
                    <th className="py-2.5 px-3">Chunk File</th>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3">Versions</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {library.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1e293b]/50">
                      <td className="py-2 px-3">
                        {item.poster ? (
                          <img src={item.poster} className="w-8 h-12 object-cover rounded shadow" alt={item.title} />
                        ) : (
                          <div className="w-8 h-12 bg-gray-800 rounded text-[9px] flex items-center justify-center">
                            N/A
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-white">{item.title}</div>
                        <div className="text-gray-500 text-[11px]">{item.year}</div>
                      </td>
                      <td className="py-2 px-3 font-mono text-cyan-400">{item.chunk_file}</td>
                      <td className="py-2 px-3 font-bold text-yellow-400">⭐ {item.rating || "N/A"}</td>
                      <td className="py-2 px-3">
                        <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {item.version_count} versions
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            handleSelectMovie(item.id);
                            setActiveTab("editor");
                          }}
                          className="bg-blue-600/80 hover:bg-blue-600 text-white px-2.5 py-1 rounded text-[11px] font-semibold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMovie(item.id, item.title)}
                          className="bg-red-600/80 hover:bg-red-600 text-white px-2.5 py-1 rounded text-[11px] font-semibold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "json" && (
        <div className="bg-[#0f172a] border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
          <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">
            Active JSON Payload Verification
          </h2>
          <pre className="bg-[#0a0f1d] border border-gray-800 p-4 rounded text-xs font-mono text-emerald-400 overflow-x-auto max-h-[550px]">
            {JSON.stringify({ movie, specs, versions }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
