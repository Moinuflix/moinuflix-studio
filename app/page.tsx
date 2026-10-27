"use client";

import React, { useState, useEffect } from "react";

export default function AdminStudio() {
  const [activeTab, setActiveTab] = useState<"list" | "add" | "arrivals">("arrivals");
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [filterType, setFilterType] = useState<"all" | "movie" | "series" | "song">("all");

  // Fetch Arrivals
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

  // Smart Detection Logic (Split without saving)
  const detectCategory = (title: string) => {
    const t = (title || "").toLowerCase();
    
    // 1. Series check: S01, E01, Season, Episode, Ep
    if (/(s\d{1,2}e\d{1,2}|season|\bep\d{1,3}\b|s\d{1,2})/i.test(t)) {
      return { type: "series", label: "Web Series", badge: "bg-purple-500/20 text-purple-400 border-purple-500/30" };
    }
    
    // 2. Songs check: 01_, 02_, track, song, flac, dts audio
    if (/^(\d{2}[_\s]|track|song)|(flac|mp3|dts audio)/i.test(t)) {
      return { type: "song", label: "5.1 Song", badge: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" };
    }

    // 3. Default Movie
    return { type: "movie", label: "Movie", badge: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" };
  };

  // Filtered List
  const categorizedArrivals = arrivals.map(item => ({
    ...item,
    category: detectCategory(item.title)
  }));

  const filteredItems = categorizedArrivals.filter(item => {
    if (filterType === "all") return true;
    return item.category.type === filterType;
  });

  const movieCount = categorizedArrivals.filter(x => x.category.type === "movie").length;
  const seriesCount = categorizedArrivals.filter(x => x.category.type === "series").length;
  const songCount = categorizedArrivals.filter(x => x.category.type === "song").length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      {/* Top Bar */}
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
            onClick={() => { setActiveTab("arrivals"); fetchArrivals(); }}
            className={`px-4 py-2 rounded-lg font-bold text-xs flex items-center gap-2 transition-all ${
              activeTab === "arrivals"
                ? "bg-amber-600 text-white shadow-md shadow-amber-600/30"
                : "text-amber-400 hover:text-amber-300"
            }`}
          >
            <span>🔔</span> Drive Arrivals
            {arrivals.length > 0 && (
              <span className="bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full text-[10px] font-black">
                {arrivals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "add" ? "bg-slate-800 text-white shadow" : "text-slate-400 hover:text-white"
            }`}
          >
            Manual Add / Search
          </button>
        </nav>
      </header>

      {/* Main Split Hub */}
      {activeTab === "arrivals" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl">
          {/* Header & Category Split Filter Buttons */}
          <div className="flex flex-wrap items-center justify-between pb-6 mb-6 border-b border-slate-800 gap-4">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>🗂️</span> Drive Arrivals: Split & Organization Hub
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Pehle files ko category ke mutabiq alag dekhein. Verify karne ke baad chunenge ki kahan inject karna hai.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchArrivals}
                disabled={loadingArrivals}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold transition-all disabled:opacity-50"
              >
                {loadingArrivals ? "🔄 Loading..." : "🔄 Refresh List"}
              </button>
            </div>
          </div>

          {/* 4 Categorization Pills */}
          <div className="flex flex-wrap items-center gap-2 mb-6">
            <button
              onClick={() => setFilterType("all")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border transition-all ${
                filterType === "all"
                  ? "bg-slate-700 text-white border-slate-600 shadow"
                  : "bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700"
              }`}
            >
              All Items ({arrivals.length})
            </button>
            <button
              onClick={() => setFilterType("movie")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                filterType === "movie"
                  ? "bg-cyan-600 text-white border-cyan-500 shadow-lg shadow-cyan-600/30"
                  : "bg-slate-950 text-cyan-400 border-slate-800 hover:border-cyan-500/40"
              }`}
            >
              🎬 Movies ({movieCount})
            </button>
            <button
              onClick={() => setFilterType("series")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                filterType === "series"
                  ? "bg-purple-600 text-white border-purple-500 shadow-lg shadow-purple-600/30"
                  : "bg-slate-950 text-purple-400 border-slate-800 hover:border-purple-500/40"
              }`}
            >
              📺 Web Series ({seriesCount})
            </button>
            <button
              onClick={() => setFilterType("song")}
              className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-all ${
                filterType === "song"
                  ? "bg-emerald-600 text-white border-emerald-500 shadow-lg shadow-emerald-600/30"
                  : "bg-slate-950 text-emerald-400 border-slate-800 hover:border-emerald-500/40"
              }`}
            >
              🎵 5.1 Songs ({songCount})
            </button>
          </div>

          {/* Table */}
          {loadingArrivals ? (
            <div className="py-16 text-center text-slate-400 text-sm">
              Loading Google Drive files...
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="py-16 text-center border border-dashed border-slate-800 rounded-xl">
              <p className="text-slate-400 font-bold text-sm">Is category me koi file nahi mili.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4">Detected Category</th>
                    <th className="py-3 px-4">Drive File Name</th>
                    <th className="py-3 px-4">Size</th>
                    <th className="py-3 px-4">Drive ID</th>
                    <th className="py-3 px-4 text-right">Destination Routing</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs">
                  {filteredItems.map((item, idx) => (
                    <tr key={item.gdrive_id || idx} className="hover:bg-slate-800/40 transition-colors">
                      <td className="py-3 px-4">
                        <span className={`px-2.5 py-1 rounded-md text-[11px] font-bold border ${item.category.badge}`}>
                          {item.category.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-200 max-w-md truncate">
                        {item.title}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {item.size || "10 GB"}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                        {item.gdrive_id ? `${item.gdrive_id.substring(0, 12)}...` : "-"}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span className="text-[11px] font-mono text-slate-400 bg-slate-950 px-2.5 py-1 rounded border border-slate-800">
                          {item.category.type === "movie" && "➔ catalog.json + chunks/chunk_XX.json"}
                          {item.category.type === "series" && "➔ chunks/data_c02.json (Series Pack)"}
                          {item.category.type === "song" && "➔ chunks/data_c03.json (5.1 Audio)"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* Manual Add Placeholder */}
      {activeTab === "add" && (
        <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center py-16 text-slate-400 text-xs">
          Manual Add Form View
        </section>
      )}
    </div>
  );
}
