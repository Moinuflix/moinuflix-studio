"use client";
import React, { useState } from "react";

export default function MoinuFlixStudio() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [selectedMovie, setSelectedMovie] = useState(null);
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
    languages: ["Hindi", "Tamil", "Telugu", "English"]
  });

  const [masterUrl, setMasterUrl] = useState("");
  const [versions, setVersions] = useState([
    {
      language: "Multi Audio (Hindi-Tamil-Telugu-Eng)",
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
    else if (fn.includes("atmos")) aud = "Dolby Atmos";
    else if (fn.includes("truehd")) aud = "Dolby TrueHD";
    else if (fn.includes("ddp") || fn.includes("eac3")) aud = "DDP 5.1";

    let br = "Auto";
    if (fn.includes("448kbps") || fn.includes("448")) br = "448 Kbps";
    else if (fn.includes("640kbps") || fn.includes("640")) br = "640 Kbps";
    else if (fn.includes("1509kbps") || fn.includes("1509")) br = "1509 Kbps";

    let langs = [];
    if (fn.includes("hindi")) langs.push("Hindi");
    if (fn.includes("tamil")) langs.push("Tamil");
    if (fn.includes("telugu")) langs.push("Telugu");
    if (fn.includes("english") || fn.includes("eng")) langs.push("English");
    if (langs.length === 0) langs = ["Tamil", "Hindi"];

    setSpecs({
      edition: fn.includes("extended") ? "Extended Collector's Edition" : "Standard",
      resolution: res,
      enhancement: enh,
      colorDepth: col,
      hdr: dyn,
      codec: cdc,
      source: src,
      audioCodec: aud,
      audioBitrate: br,
      languages: langs
    });

    setVersions([
      {
        language: langs.join("-"),
        quality: `${res} ${enh} ${col}`,
        source: src,
        audio: `${aud} ~ ${br}`,
        stream_url: masterUrl
      }
    ]);
  };

  // Search Movie
  const searchMovies = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/search-tmdb?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      alert("Error searching movie");
    }
    setLoading(false);
  };

  const selectMovie = async (item) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/fetch-meta?id=${item.id}`);
      const data = await res.json();
      setSelectedMovie(data);
    } catch (e) {
      alert("Error loading metadata");
    }
    setLoading(false);
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
        setCommitStatus("Failed: " + data.error);
      }
    } catch (e) {
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
        <span className="text-xs bg-cyan-950 text-cyan-400 border border-cyan-800 px-3 py-1 rounded-full">
          ⚡ 5.1 Surround & Remux Mode
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Search & Raw Parser */}
        <div className="lg:col-span-5 space-y-6">
          {/* Step 1: TMDB Search */}
          <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Step 1 & 2: Search Title</h2>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Type movie name (e.g. Avatar)..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm outline-none focus:border-red-500"
              />
              <button onClick={searchMovies} className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2 rounded text-sm">
                Find
              </button>
            </div>

            {/* Results */}
            {searchResults.length > 0 && (
              <div className="mt-3 max-h-52 overflow-y-auto space-y-2 pr-1">
                {searchResults.map((m) => (
                  <div
                    key={m.id}
                    onClick={() => selectMovie(m)}
                    className="flex items-center gap-3 bg-[#1e293b] hover:bg-gray-800 p-2 rounded cursor-pointer border border-transparent hover:border-red-500"
                  >
                    <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-10 h-14 object-cover rounded" />
                    <div>
                      <div className="font-bold text-sm">{m.title}</div>
                      <div className="text-xs text-gray-400">{m.release_date ? m.release_date.split("-")[0] : ""}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Step 3: Raw Filename Parser (Auto-Fill Feature) */}
          <div className="bg-[#0f172a] border border-cyan-900/60 p-4 rounded-xl">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">⚡ Raw File Rename Parser (Auto-Fill)</h2>
            </div>
            <textarea
              rows={3}
              placeholder="Paste raw file name here (e.g. Avatar (2009) Extended 1080p DS4K 10bit BluRay x265 DDP 5.1 ~ 448Kbps...)"
              value={rawFilename}
              onChange={(e) => setRawFilename(e.target.value)}
              className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs outline-none focus:border-cyan-500 font-mono"
            />
            <button
              onClick={parseFilename}
              className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black"
            >
              Parse Specs & Auto-Fill Everything
            </button>
          </div>
        </div>

        {/* Right Column: Metadata & Live Specs Matrix */}
        <div className="lg:col-span-7 space-y-6">
          {selectedMovie ? (
            <div className="bg-[#0f172a] border border-gray-800 p-5 rounded-xl space-y-4">
              {/* Movie Header Card */}
              <div className="flex gap-4 items-start">
                <img src={selectedMovie.poster} className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-md" />
                <div className="space-y-1">
                  <h1 className="text-xl font-black text-white">{selectedMovie.title}</h1>
                  <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                    <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold border border-red-800">
                      {selectedMovie.certification || "UA"}
                    </span>
                    <span>{selectedMovie.year}</span>
                    <span>• {selectedMovie.runtime} min</span>
                    <span>• {selectedMovie.genres?.join(", ")}</span>
                  </div>
                  <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed mt-2">{selectedMovie.plot}</p>
                </div>
              </div>

              {/* Badges Preview */}
              <div className="flex flex-wrap gap-2 border-t border-b border-gray-800 py-3">
                <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.resolution}
                </span>
                <span className="bg-yellow-950 text-yellow-400 border border-yellow-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.enhancement}
                </span>
                <span className="bg-purple-950 text-purple-400 border border-purple-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.colorDepth}
                </span>
                <span className="bg-indigo-950 text-indigo-400 border border-indigo-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.hdr}
                </span>
                <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.codec}
                </span>
                <span className="bg-orange-950 text-orange-400 border border-orange-800 px-2 py-1 rounded text-xs font-semibold">
                  {specs.audioCodec} @ {specs.audioBitrate}
                </span>
              </div>

              {/* Master Stream Link */}
              <div>
                <label className="text-xs font-bold text-gray-400 block mb-1">Primary Google Drive Master Link</label>
                <input
                  type="text"
                  placeholder="https://drive.google.com/file/d/..."
                  value={masterUrl}
                  onChange={(e) => {
                    setMasterUrl(e.target.value);
                    if (versions[0]) {
                      const updated = [...versions];
                      updated[0].stream_url = e.target.value;
                      setVersions(updated);
                    }
                  }}
                  className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-xs text-cyan-300 outline-none focus:border-red-500 font-mono"
                />
              </div>

              {/* Versions Form Dropdowns */}
              <div className="space-y-3 bg-[#0a0f1d] p-3 rounded-lg border border-gray-800">
                <div className="text-xs font-bold text-gray-400">Stream Specs Configuration</div>
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

              {/* Commit Button */}
              <button
                onClick={handleCommit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-3 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg"
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
