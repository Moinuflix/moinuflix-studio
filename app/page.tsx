"use client";

import React, { useState, useEffect } from "react";

export default function AdminStudio() {
  const [activeTab, setActiveTab] = useState<"list" | "add" | "audit" | "arrivals">("add");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loadingMeta, setLoadingMeta] = useState(false);

  // Drive Arrivals State
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Raw Parser State
  const [rawFilename, setRawFilename] = useState("");
  const [specs, setSpecs] = useState({
    resolution: "1080p FHD",
    source: "WEB-DL",
    codec: "x265 HEVC",
    audio: "Dolby Atmos",
    channels: "5.1",
    size: "10 GB"
  });

  // Fetch Drive Arrivals from Backend
  const fetchArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch("/api/drive-arrivals");
      const data = await res.json();
      setArrivals(data.arrivals || []);
    } catch (e) {
      console.error("Arrivals fetch error:", e);
    } finally {
      setLoadingArrivals(false);
    }
  };

  useEffect(() => {
    fetchArrivals();
  }, []);

  // 1-Click Auto Match & Direct Save
  const handleAutoMatchSave = async (item: any) => {
    setSyncingId(item.gdrive_id);
    try {
      const res = await fetch("/api/auto-match-save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: item.title,
          gdrive_id: item.gdrive_id,
          size: item.size
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(`🎉 Saved: "${data.saved}" direct into catalog.json & chunks!`);
        setArrivals((prev) => prev.filter((x) => x.gdrive_id !== item.gdrive_id));
      } else {
        alert(`❌ Error: ${data.error || "Auto-match failed"}`);
      }
    } catch (err: any) {
      alert(`Network Error: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };

  // Search TMDB
  const handleSearchTMDB = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSearching(false);
    }
  };

  // Select TMDB Movie
  const handleSelectMovie = async (id: number) => {
    setLoadingMeta(true);
    try {
      const res = await fetch(`/api/fetch-meta?id=${id}`);
      const data = await res.json();
      setSelectedMovie(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMeta(false);
    }
  };

  // Parse Raw Specs
  const handleParseSpecs = () => {
    if (!rawFilename.trim()) return;
    const fn = rawFilename.toLowerCase();
    
    let res = "1080p FHD";
    if (fn.includes("2160p") || fn.includes("4k")) res = "4K UHD";
    else if (fn.includes("720p")) res = "720p HD";

    let src = "WEB-DL";
    if (fn.includes("nf") || fn.includes("netflix")) src = "Netflix";
    else if (fn.includes("amzn") || fn.includes("prime")) src = "Prime Video";
    else if (fn.includes("hotstar") || fn.includes("dsnp")) src = "Disney+ Hotstar";
    else if (fn.includes("bluray")) src = "BluRay";
    else if (fn.includes("remux")) src = "REMUX";

    let cdc = (fn.includes("x265") || fn.includes("hevc")) ? "x265 HEVC" : "x264";
    let aud = fn.includes("atmos") ? "Dolby Atmos" : (fn.includes("ddp") ? "DDP 5.1" : "AAC 2.0");

    const szMatch = rawFilename.match(/(\d+(\.\d+)?)\s*(gb|mb)/i);
    let sz = szMatch ? `${szMatch[1]} ${szMatch[3].toUpperCase()}` : "10 GB";

    setSpecs({
      resolution: res,
      source: src,
      codec: cdc,
      audio: aud,
      channels: "5.1",
      size: sz
    });

    // Auto extract title to search box
    const clean = rawFilename
      .replace(/\[.*?\]|\(.*?\)/g, " ")
      .replace(/\b(2160p|1080p|720p|4k|bluray|remux|web-dl|hevc|x265|x264|atmos|ddp|aac)\b.*/gi, "")
      .replace(/[\._-]/g, " ")
      .trim();
    if (clean) {
      setSearchQuery(clean);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Top Navbar */}
      <header className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-5 mb-8 gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-red-600 px-3 py-1.5 rounded-lg font-black tracking-widest text-lg text-white shadow-md shadow-red-600/30">
            MOINUFLIX
          </div>
          <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold border-l border-slate-700 pl-3">
            Admin Studio
          </span>
        </div>

        <nav className="flex items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl">
          <button
            onClick={() => setActiveTab("list")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "list" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Movies List
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "add" ? "bg-red-600 text-white shadow-md shadow-red-600/30" : "text-slate-400 hover:text-white"
            }`}
          >
            Add / Edit Movie
          </button>
          <button
            onClick={() => {
              setActiveTab("arrivals");
              fetchArrivals();
            }}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all ${
              activeTab === "arrivals"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "text-amber-400 hover:text-amber-300"
            }`}
          >
            <span>🔔</span> Drive Arrivals
            {arrivals.length > 0 && (
              <span className="bg-amber-400 text-slate-950 px-1.5 py-0.2 rounded-full text-[10px] font-black">
                {arrivals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("audit")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "audit" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            JSON Audit
          </button>
        </nav>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/30 text-cyan-400 text-xs font-semibold">
            ⚡ Production Engine
          </span>
        </div>
      </header>

      {/* VIEW: Drive Arrivals (1-Click Auto Hub) */}
      {activeTab === "arrivals" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-wrap items-center justify-between pb-6 mb-6 border-b border-slate-800 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>⚡</span> Google Drive Arrivals Hub
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Drive se scan ki hui nayi files ko bina manual form bhare, direct 1-Click se TMDB match karke catalog aur chunk me inject karein.
              </p>
            </div>
            <button
              onClick={fetchArrivals}
              disabled={loadingArrivals}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
            >
              {loadingArrivals ? "🔄 Scanning..." : "🔄 Refresh Arrivals"}
            </button>
          </div>

          {loadingArrivals ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Connecting with GitHub and loading arrivals list...
            </div>
          ) : arrivals.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-emerald-400 font-bold text-base">🎉 All 100% Synced!</p>
              <p className="text-xs text-slate-500 mt-1">Koi bhi nayi missing movie Drive par pending nahi hai.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Drive File Title</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Drive ID</th>
                    <th className="py-3 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {arrivals.map((item, idx) => (
                    <tr key={item.gdrive_id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3.5 px-4 font-semibold text-slate-200 max-w-md truncate">
                        {item.title}
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {item.size || "10 GB"}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-[11px] text-slate-500">
                        {item.gdrive_id ? `${item.gdrive_id.substring(0, 14)}...` : "-"}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <button
                          onClick={() => handleAutoMatchSave(item)}
                          disabled={syncingId === item.gdrive_id}
                          className="px-3.5 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-xs rounded-lg shadow-md transition-all disabled:opacity-50"
                        >
                          {syncingId === item.gdrive_id ? "⏳ Matching & Saving..." : "⚡ 1-Click Auto Match & Save"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* VIEW: Add / Edit Movie Form */}
      {activeTab === "add" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-5 space-y-6">
            {/* Search Box */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <label className="block text-[11px] uppercase tracking-wider font-bold text-red-500 mb-2">
                Movie Search & TMDB Selector
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type movie name (e.g. Avatar, Cars, Leo)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchTMDB()}
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-red-500"
                />
                <button
                  onClick={handleSearchTMDB}
                  disabled={searching}
                  className="bg-red-600 hover:bg-red-500 text-white px-5 py-2.5 rounded-xl font-bold text-xs transition-all shadow-md shadow-red-600/30"
                >
                  {searching ? "..." : "Find"}
                </button>
              </div>

              {/* Search Results Dropdown */}
              {searchResults.length > 0 && (
                <div className="mt-4 max-h-60 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMovie(m.id)}
                      className="flex items-center gap-3 p-2 bg-slate-950 hover:bg-slate-800/80 rounded-xl cursor-pointer border border-slate-800/60 transition-all"
                    >
                      {m.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                          alt=""
                          className="w-8 h-12 object-cover rounded-md"
                        />
                      ) : (
                        <div className="w-8 h-12 bg-slate-800 rounded-md" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{m.title}</p>
                        <p className="text-[10px] text-slate-400">
                          {m.release_date ? m.release_date.split("-")[0] : "N/A"} • ⭐ {m.vote_average}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw Specs Parser */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 shadow-xl">
              <label className="block text-[11px] uppercase tracking-wider font-bold text-cyan-400 mb-2">
                ⚡ Raw File Rename Parser (Auto-Fill)
              </label>
              <textarea
                rows={3}
                placeholder="Paste filename: Cars (2006) 1080p BluRay x265 10bit HEVC [Org Hindi BD 5.1 ~ 448Kbps + English AAC 5.1] ESub ~ Tigole.mkv"
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono resize-none"
              />
              <button
                onClick={handleParseSpecs}
                className="w-full mt-3 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 py-2.5 rounded-xl font-bold text-xs transition-all"
              >
                PARSE SPECS & AUTO-FILL EVERYTHING
              </button>
            </div>
          </div>

          {/* Movie Preview / Form */}
          <div className="lg:col-span-7">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl min-h-[420px] flex flex-col justify-center items-center">
              {loadingMeta ? (
                <div className="text-center text-slate-400 text-xs">Loading metadata from TMDB, OMDb & Fanart...</div>
              ) : selectedMovie ? (
                <div className="w-full space-y-4 text-left">
                  <div className="flex gap-4 items-start">
                    {selectedMovie.artwork?.poster && (
                      <img
                        src={selectedMovie.artwork.poster}
                        alt=""
                        className="w-24 h-36 object-cover rounded-xl shadow-lg"
                      />
                    )}
                    <div>
                      <h3 className="text-xl font-black text-white">{selectedMovie.title}</h3>
                      <p className="text-xs text-slate-400 mt-1">
                        {selectedMovie.year} • {selectedMovie.runtime} min • {selectedMovie.genres?.join(", ")}
                      </p>
                      <p className="text-xs text-slate-300 mt-2 line-clamp-3">{selectedMovie.plot}</p>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-800 grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 font-semibold block">Quality:</span>
                      <span className="text-white font-bold">{specs.resolution}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block">Source OTT:</span>
                      <span className="text-white font-bold">{specs.source}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block">Audio & Codec:</span>
                      <span className="text-white font-bold">{specs.audio} • {specs.codec}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 font-semibold block">Clean Size:</span>
                      <span className="text-amber-400 font-bold">{specs.size}</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-4xl mb-3">🎬</div>
                  <h4 className="text-sm font-bold text-slate-300">No Movie Selected</h4>
                  <p className="text-xs text-slate-500 mt-1 max-w-sm">
                    Search on the left or switch to <strong>Drive Arrivals</strong> tab to 1-click auto-match directly from Google Drive.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* VIEW: Movies List */}
      {activeTab === "list" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center py-16 text-slate-400 text-xs">
          Movies list view from catalog.json will load here.
        </section>
      )}

      {/* VIEW: JSON Audit */}
      {activeTab === "audit" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center py-16 text-slate-400 text-xs">
          Two-Tier Chunk audit view (50 movies per chunk limit).
        </section>
      )}
    </div>
  );
}
