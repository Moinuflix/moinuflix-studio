"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";

const sampleArrivals = [
  { category: "Movie", name: "Billa 2007 1080p AMZN WEB-DL DD+5 1 H 264-TR", size: "9.7 GB", id: "1pn1LE4MoDJd..." },
  { category: "Movie", name: "Jilla 2014 1080p AMZN WEB-DL DD+5 1 H264-BeAsT", size: "12.1 GB", id: "1GNYi1EPuHS3..." },
  { category: "5.1 Song", name: "01_Thuli_Thuli_Mazhaiyai", size: "0.0 GB", id: "15NaQP5ruH30..." },
  { category: "5.1 Song", name: "06_Poongatre_Poongatre_Full", size: "0.3 GB", id: "1zztk8bzUV07..." },
  { category: "5.1 Song", name: "05_Suthuthe_Suthuthe_Bhoomi", size: "0.4 GB", id: "1Nrlq1bR5dqf..." },
  { category: "5.1 Song", name: "04_Adada_Mazhaida", size: "0.5 GB", id: "1vKiwCGCWWKY..." }
];

export default function MoinuFlixStudio() {
  const [activeTab, setActiveTab] = useState<"add" | "arrivals">("add");
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState("");
  const [rawFilename, setRawFilename] = useState("");
  const [masterUrl, setMasterUrl] = useState("");

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

  const parseFilename = (customName?: string) => {
    const textToParse = customName || rawFilename;
    if (!textToParse) return;
    const fn = textToParse.toLowerCase();

    let res = "1080p";
    if (fn.includes("2160p") || fn.includes("4k")) res = "2160p (4K)";
    else if (fn.includes("720p")) res = "720p";

    let enh = "Standard";
    if (fn.includes("ds4k")) enh = "DS4K";
    else if (fn.includes("remux")) enh = "Remux";

    let col = fn.includes("10bit") ? "10bit" : "8bit";
    let dyn = fn.includes("hdr") ? "HDR10" : fn.includes("dv") ? "Dolby Vision" : "SDR";
    let cdc = fn.includes("hevc") || fn.includes("x265") ? "x265 HEVC" : "x264";
    let src = fn.includes("bluray") || fn.includes("bd") ? "BluRay" : fn.includes("web") ? "WEB-DL" : "AMZN";

    let aud = "DDP 5.1";
    if (fn.includes("atmos")) aud = "Dolby Atmos";
    else if (fn.includes("dts")) aud = "DTS 5.1";
    else if (fn.includes("ddp") || fn.includes("dd+")) aud = "DDP 5.1";

    let br = "448 Kbps";
    if (fn.includes("640kbps") || fn.includes("640")) br = "640 Kbps";
    else if (fn.includes("768kbps") || fn.includes("768")) br = "768 Kbps";

    setSpecs({
      edition: "Standard",
      resolution: res,
      enhancement: enh,
      colorDepth: col,
      hdr: dyn,
      codec: cdc,
      source: src,
      audioCodec: aud,
      audioBitrate: br,
      languages: "Hindi-Tamil-Telugu"
    });
  };

  const searchMovies = async (searchTitle?: string) => {
    const term = searchTitle || query;
    if (!term) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(term)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      alert("Error searching movie: " + e.message);
    }
    setLoading(false);
  };

  const selectMovie = async (item: any) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_KEY}`);
      const data = await res.json();
      setSelectedMovie({
        id: data.id,
        title: data.title,
        year: data.release_date ? data.release_date.split("-")[0] : "",
        runtime: data.runtime || 120,
        genres: data.genres?.map((g: any) => g.name) || [],
        plot: data.overview || "",
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : ""
      });
    } catch (e: any) {
      alert("Error loading movie: " + e.message);
    }
    setLoading(false);
  };

  const handleIngestFromArrivals = (item: any) => {
    setActiveTab("add");
    setRawFilename(item.name);
    parseFilename(item.name);

    // Auto extract clean movie title
    let clean = item.name.split(/[0-9]{4}|1080p|720p|WEB|BluRay/i)[0].replace(/[._-]/g, " ").trim();
    setQuery(clean);
    searchMovies(clean);

    if (item.id) {
      setMasterUrl(`https://drive.google.com/file/d/${item.id}/view`);
    }
  };

  const handleCommit = async () => {
    if (!selectedMovie) return alert("Pehle movie select karein!");
    setCommitStatus("Committing to GitHub...");
    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie: selectedMovie,
          specs: specs,
          masterUrl: masterUrl
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus("🎉 Successfully Synced into catalog.json & chunks!");
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
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-wider">ADMIN STUDIO</span>
        </div>

        {/* Tab Switcher Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("add")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "add" ? "bg-red-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            ➕ Add / Edit Movie
          </button>
          <button
            onClick={() => setActiveTab("arrivals")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all ${
              activeTab === "arrivals" ? "bg-amber-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            🔔 Drive Arrivals (65)
          </button>
        </div>
      </div>

      {/* VIEW 1: ADD / EDIT MOVIE FORM */}
      {activeTab === "add" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">Movie Search & TMDb Selector</h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type movie name (e.g. Avatar, Billa)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchMovies()}
                  className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm outline-none focus:border-red-500"
                />
                <button onClick={() => searchMovies()} className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2 rounded text-sm">
                  {loading ? "..." : "Find"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => selectMovie(m)}
                      className="flex items-center gap-3 bg-[#1e293b] hover:bg-gray-800 p-2 rounded cursor-pointer border border-transparent hover:border-red-500"
                    >
                      {m.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-10 h-14 object-cover rounded" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center text-xs">No Pic</div>
                      )}
                      <div>
                        <div className="font-bold text-sm">{m.title}</div>
                        <div className="text-xs text-gray-400">{m.release_date?.split("-")[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-[#0f172a] border border-cyan-900/60 p-4 rounded-xl">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">⚡ Raw File Rename Parser (Auto-Fill)</h2>
              <textarea
                rows={3}
                placeholder="Paste filename: Billa 2007 1080p AMZN WEB-DL DD+5 1 H 264-TR..."
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs outline-none focus:border-cyan-500 font-mono"
              />
              <button
                onClick={() => parseFilename()}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black"
              >
                Parse Specs & Auto-Fill Everything
              </button>
            </div>
          </div>

          <div className="lg:col-span-7 space-y-6">
            {selectedMovie ? (
              <div className="bg-[#0f172a] border border-gray-800 p-5 rounded-xl space-y-4">
                <div className="flex gap-4 items-start">
                  <img src={selectedMovie.poster} className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-md" />
                  <div className="space-y-1">
                    <h1 className="text-xl font-black text-white">{selectedMovie.title}</h1>
                    <div className="flex flex-wrap gap-2 text-xs text-gray-400">
                      <span>{selectedMovie.year}</span>
                      <span>• {selectedMovie.runtime} min</span>
                      <span>• {selectedMovie.genres?.join(", ")}</span>
                    </div>
                    <p className="text-xs text-gray-300 line-clamp-3 leading-relaxed mt-2">{selectedMovie.plot}</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 border-t border-b border-gray-800 py-3">
                  <span className="bg-blue-950 text-blue-400 border border-blue-800 px-2 py-1 rounded text-xs font-semibold">{specs.resolution}</span>
                  <span className="bg-yellow-950 text-yellow-400 border border-yellow-800 px-2 py-1 rounded text-xs font-semibold">{specs.source}</span>
                  <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 px-2 py-1 rounded text-xs font-semibold">{specs.codec}</span>
                  <span className="bg-orange-950 text-orange-400 border border-orange-800 px-2 py-1 rounded text-xs font-semibold">{specs.audioCodec} @ {specs.audioBitrate}</span>
                </div>

                <div>
                  <label className="text-xs font-bold text-gray-400 block mb-1">Google Drive Stream URL</label>
                  <input
                    type="text"
                    value={masterUrl}
                    onChange={(e) => setMasterUrl(e.target.value)}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-xs text-cyan-300 font-mono outline-none"
                  />
                </div>

                <button
                  onClick={handleCommit}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-3 rounded-lg text-sm tracking-wider uppercase transition-all shadow-lg"
                >
                  Save to JSON & Commit to GitHub
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
                <div className="text-xs text-gray-600 mt-1">Search on left or select from Drive Arrivals</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: DRIVE ARRIVALS HUB */}
      {activeTab === "arrivals" && (
        <div className="bg-[#0f172a] border border-gray-800 rounded-xl p-6 shadow-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <span>📁</span> Drive Arrivals: Split & Organization Hub
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Pehle files ko category ke mutabiq alag dekhein. Verify karne ke baad chunenge ki kahan inject karna hai.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-xs font-semibold uppercase text-gray-400">
                  <th className="py-3 px-4">Detected Category</th>
                  <th className="py-3 px-4">Drive File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Drive ID</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60 text-sm">
                {sampleArrivals.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded text-xs font-bold bg-cyan-950 text-cyan-400 border border-cyan-800">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-medium text-white max-w-md truncate">
                      {item.name}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-amber-400">
                      {item.size}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-gray-500">
                      {item.id}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleIngestFromArrivals(item)}
                        className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-black font-extrabold text-xs rounded transition shadow"
                      >
                        ⚡ Ingest to Form
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
