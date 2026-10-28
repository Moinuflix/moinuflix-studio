"use client";
import React, { useState, useEffect } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";
const REPO_OWNER = "Moinuflix";
const REPO_NAME = "My-Movies";

interface ArrivalItem {
  title: string;
  gdrive_id: string;
  size: string;
  target_category?: string;
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
  const [activeTab, setActiveTab] = useState<"arrivals" | "form">("arrivals");
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);

  // Studio Form State
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ msg: string; isError: boolean } | null>(null);
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
    clearLogo: ""
  });

  const [versions, setVersions] = useState<any[]>([]);

  // 1. Fetch Real Google Drive Arrivals from inbox_arrivals.json
  const fetchRealArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const cleanList = Array.isArray(data) ? data.map((x: any) => ({
          title: x.title || x.name || "Untitled File",
          gdrive_id: x.gdrive_id || x.id || "",
          size: x.size ? (x.size.includes("GB") ? x.size : `${x.size} GB`) : "5 GB",
          target_category: x.target_category || "Movie",
          match: null
        })) : [];
        setArrivals(cleanList);
      } else {
        setArrivals([]);
      }
    } catch (e) {
      console.error("Error fetching inbox_arrivals.json", e);
    }
    setLoadingArrivals(false);
  };

  useEffect(() => {
    fetchRealArrivals();
  }, []);

  // 2. Clean Title Parser for TMDb Search
  const cleanTitleForSearch = (fn: string) => {
    let clean = fn.replace(/\.mkv|\.mp4|\.avi/i, "");
    clean = clean.split(/[0-9]{4}|1080p|720p|2160p|4k|WEB-DL|BluRay|AMZN|NF|HDTV/i)[0];
    clean = clean.replace(/[._-]/g, " ").trim();
    return clean || fn;
  };

  // 3. Indian TMDb Match Bajuk
  const fetchArrivalMatch = async (index: number) => {
    const item = arrivals[index];
    const cleanTitle = cleanTitleForSearch(item.title);
    const yearMatch = item.title.match(/\b(19\d\d|20\d\d)\b/);
    const yearParam = yearMatch ? `&primary_release_year=${yearMatch[1]}` : "";

    const updated = [...arrivals];
    updated[index].loadingMatch = true;
    setArrivals(updated);

    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanTitle)}&region=IN${yearParam}`
      );
      const data = await res.json();
      const top = data.results?.[0];

      if (top) {
        let logoUrl = "";
        try {
          const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${top.id}?api_key=${FANART_KEY}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
          }
        } catch (_) {}

        if (!logoUrl) {
          const imgRes = await fetch(`https://api.themoviedb.org/3/movie/${top.id}/images?api_key=${TMDB_KEY}`);
          const imgData = await imgRes.json();
          if (imgData.logos?.[0]?.file_path) {
            logoUrl = `https://image.tmdb.org/t/p/original${imgData.logos[0].file_path}`;
          }
        }

        updated[index].match = {
          tmdb_id: top.id,
          title: top.title,
          year: top.release_date ? top.release_date.split("-")[0] : (yearMatch ? yearMatch[1] : "2024"),
          poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
          fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
          clearlogo: logoUrl,
          rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
          lang: (top.original_language || "hi").toUpperCase(),
          plot: top.overview || "",
          genres: [],
          certification: "UA",
          runtime: 120
        };
      }
    } catch (e) {
      console.error(e);
    }

    updated[index].loadingMatch = false;
    setArrivals(updated);
  };

  // 4. Strict Confirmation: Only loads into form upon clicking Confirm
  const handleConfirmArrival = (item: ArrivalItem) => {
    if (!item.match) return alert("Pehle bajuk TMDb Match fetch karein!");

    // Parse technical tags from raw filename
    const fn = item.title.toLowerCase();
    let res = "1080p";
    if (fn.includes("2160p") || fn.includes("4k")) res = "2160p";
    else if (fn.includes("720p")) res = "720p";

    let src = "BluRay";
    if (fn.includes("web-dl") || fn.includes("web")) src = "WEB-DL";
    else if (fn.includes("amzn")) src = "AMZN";
    else if (fn.includes("nf")) src = "NF";

    let aud = "Dolby Atmos";
    if (fn.includes("ddp") || fn.includes("dd+")) aud = "Dolby Atmos";
    else if (fn.includes("dts")) aud = "DTS 5.1";

    let bitr = "448 Kbps";
    if (fn.includes("640")) bitr = "640 Kbps";
    else if (fn.includes("768")) bitr = "768 Kbps";
    else if (fn.includes("1509")) bitr = "1509 Kbps";

    const langName = item.match.lang === "TA" ? "Tamil" : item.match.lang === "TE" ? "Telugu" : item.match.lang === "HI" ? "Hindi" : "English";

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

    setSpecs({
      source: src,
      audioCodec: aud,
      audioBitrate: bitr,
      fileSize: item.size,
      resolution: res,
      enhancement: "DS4K",
      colorDepth: "10bit",
      codec: fn.includes("x265") || fn.includes("hevc") ? "x265" : "x264",
      clearLogo: item.match.clearlogo
    });

    setVersions([
      {
        language: langName,
        resolution: res,
        source: src,
        codec: fn.includes("x265") || fn.includes("hevc") ? "x265" : "x264",
        audio: aud,
        channels: "5.1",
        dubbed: "Original Track",
        size: item.size,
        driveId: item.gdrive_id
      }
    ]);

    setRawFilename(item.title);
    setCommitStatus(null);
    setActiveTab("form");
  };

  // 5. Save & Commit with Schema Protection
  const handleCommit = async () => {
    if (!selectedMovie || !selectedMovie.title) {
      return alert("Corruption Alert: Koi valid movie select nahi hui!");
    }
    if (versions.length === 0 || !versions[0].driveId) {
      return alert("Corruption Alert: Google Drive ID missing hai!");
    }

    setLoadingCommit(true);
    setCommitStatus({ msg: "Committing to GitHub Two-Tier Database...", isError: false });

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
        setCommitStatus({
          msg: `🎉 Verified & Saved! catalog.json + ${data.chunk} successfully synced!`,
          isError: false
        });
        // Remove from local arrivals after successful commit
        setArrivals(prev => prev.filter(x => x.gdrive_id !== versions[0].driveId));
      } else {
        setCommitStatus({
          msg: `❌ Save Failed: ${data.error || "GitHub commit rejected."}`,
          isError: true
        });
      }
    } catch (e: any) {
      setCommitStatus({ msg: `❌ Network Error: ${e.message}`, isError: true });
    }
    setLoadingCommit(false);
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-widest uppercase">CINEMA STUDIO INGESTION</span>
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
            onClick={() => setActiveTab("form")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-2 ${
              activeTab === "form" ? "bg-red-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            <span>🎬</span> Verified Movie Studio
          </button>
        </div>
      </div>

      {/* VIEW 1: REAL DRIVE ARRIVALS WITH SIDE-BY-SIDE VERIFICATION */}
      {activeTab === "arrivals" && (
        <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex justify-between items-center mb-6 border-b border-gray-800 pb-4">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>⚡</span> Step 2: Google Drive Ingestion & Side-by-Side TMDb Verification
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Data inbox_arrivals.json se live read ho raha hai. Confirmation ke baad hi Movie Form active hoga.
              </p>
            </div>
            <button
              onClick={fetchRealArrivals}
              className="bg-gray-800 hover:bg-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-700"
            >
              🔄 Refresh Arrivals
            </button>
          </div>

          {loadingArrivals ? (
            <div className="text-center py-16 text-cyan-400 animate-pulse text-sm">
              Loading Google Drive arrivals from repository...
            </div>
          ) : arrivals.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">
              🎉 No pending Drive arrivals! All Google Drive files are 100% synced with catalog & chunks.
            </div>
          ) : (
            <div className="space-y-4">
              {arrivals.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#10192d] border border-gray-800 hover:border-gray-700 rounded-xl p-4 transition grid grid-cols-1 lg:grid-cols-12 gap-4 items-center"
                >
                  {/* Left: Raw Drive File Details */}
                  <div className="lg:col-span-5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold">
                        {item.target_category || "Movie"}
                      </span>
                      <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                    </div>
                    <div className="text-sm font-bold text-white break-all">{item.title}</div>
                    <div className="text-[11px] text-gray-500 font-mono">ID: {item.gdrive_id || "Direct File"}</div>
                    {!item.match && !item.loadingMatch && (
                      <button
                        onClick={() => fetchArrivalMatch(idx)}
                        className="mt-2 text-xs text-sky-400 hover:underline flex items-center gap-1 font-semibold"
                      >
                        <span>🔍</span> Fetch TMDb Match Bajuk
                      </button>
                    )}
                  </div>

                  {/* Center: Real TMDb Poster Preview Bajuk */}
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-4">
                    {item.loadingMatch ? (
                      <div className="text-xs text-cyan-400 animate-pulse font-mono">
                        Matching against Indian TMDb (region=IN)...
                      </div>
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
                      <div className="text-xs text-gray-500 italic">
                        No TMDb match loaded yet. Click "Fetch TMDb Match Bajuk" to verify artwork.
                      </div>
                    )}
                  </div>

                  {/* Right: Confirm & Load Button */}
                  <div className="lg:col-span-2 flex flex-col items-end justify-center">
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
          )}
        </div>
      )}

      {/* VIEW 2: FORM (ACTIVE ONLY AFTER YOU CONFIRM OR CHOOSE TO EDIT) */}
      {activeTab === "form" && (
        <div>
          {!selectedMovie ? (
            <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-12 text-center shadow-2xl space-y-3">
              <div className="text-4xl">🛑</div>
              <h3 className="text-base font-bold text-gray-300">Form Empty (Anti-Corruption Lock)</h3>
              <p className="text-xs text-gray-500 max-w-md mx-auto">
                Direct bina verify kiye fake save rokne ke liye form blank hai. Pehle <strong>Drive Arrivals</strong> tab me jakar kisi movie ka poster bajuk me verify karein aur <strong>✅ Confirm & Load</strong> dabayein.
              </p>
              <button
                onClick={() => setActiveTab("arrivals")}
                className="bg-amber-600 hover:bg-amber-500 font-bold px-5 py-2.5 rounded-lg text-xs tracking-wider uppercase text-white shadow"
              >
                Go to Drive Arrivals
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left Column: Raw Parser & Details */}
              <div className="lg:col-span-5 space-y-6">
                <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
                  <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <span>⚡</span> STEP 4: STANDARD RENAME FORMAT
                  </h2>
                  <div className="bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-emerald-300 break-all leading-relaxed">
                    {`${selectedMovie.title} (${selectedMovie.year}) [${specs.resolution}] [${specs.source}] [${versions[0]?.language || "Hindi"} 5.1 - ${specs.audioBitrate}] [${specs.fileSize}].mkv`}
                  </div>
                  <div className="mt-3 text-[11px] text-gray-400 flex justify-between">
                    <span>Kodi Clean Title: <strong className="text-white">{selectedMovie.title}</strong></span>
                    <span>TMDb ID: <strong className="text-amber-400">{selectedMovie.id}</strong></span>
                  </div>
                </div>

                <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg space-y-2">
                  <h3 className="text-xs font-bold text-gray-300 uppercase">Master Tech Configuration</h3>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="text-[10px] text-gray-400">Resolution</label>
                      <input
                        type="text"
                        value={specs.resolution}
                        onChange={(e) => setSpecs({ ...specs, resolution: e.target.value })}
                        className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">Source</label>
                      <input
                        type="text"
                        value={specs.source}
                        onChange={(e) => setSpecs({ ...specs, source: e.target.value })}
                        className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">Audio Bitrate</label>
                      <input
                        type="text"
                        value={specs.audioBitrate}
                        onChange={(e) => setSpecs({ ...specs, audioBitrate: e.target.value })}
                        className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-400">Clean Size</label>
                      <input
                        type="text"
                        value={specs.fileSize}
                        onChange={(e) => setSpecs({ ...specs, fileSize: e.target.value })}
                        className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Cinema Card Preview & GitHub Commit */}
              <div className="lg:col-span-7 space-y-5">
                {/* Wide Banner + ClearLogo Spotlight */}
                <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-6 shadow-2xl min-h-[170px] flex items-center">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
                    style={{ backgroundImage: `url(${selectedMovie.fanart || "https://image.tmdb.org/t/p/original/sd4xN5xi8tKRPrJOWwNiZEile7f.jpg"})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/70 to-transparent" />

                  <div className="relative z-10 flex gap-5 items-center w-full">
                    <img
                      src={selectedMovie.poster || "https://image.tmdb.org/t/p/w500/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"}
                      className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-xl"
                    />
                    <div className="space-y-3">
                      {specs.clearLogo ? (
                        <img src={specs.clearLogo} className="h-11 object-contain drop-shadow-md" alt="ClearLogo" />
                      ) : (
                        <h1 className="text-2xl font-black text-white">{selectedMovie.title}</h1>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                          {selectedMovie.cert || "UA"}
                        </span>
                        <span className="text-gray-300">{selectedMovie.year}</span>
                        <span className="text-gray-400">• {selectedMovie.runtime} min</span>
                        <span className="bg-amber-950/80 text-amber-400 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">
                          ★ IMDb {selectedMovie.rating}
                        </span>
                        <span className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">
                          LANG: {selectedMovie.lang}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ClearLogo Input */}
                <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
                  <label className="text-[11px] font-bold text-gray-400 block mb-2">
                    Kodi ClearLogo URL (Auto-fetched from Fanart.tv / TMDb)
                  </label>
                  <input
                    type="text"
                    value={specs.clearLogo}
                    onChange={(e) => setSpecs({ ...specs, clearLogo: e.target.value })}
                    className="w-full bg-[#131c2e] border border-gray-700 px-3 py-2 rounded-lg text-xs text-amber-300 font-mono focus:outline-none"
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

                {/* Commit Action */}
                <button
                  disabled={loadingCommit}
                  onClick={handleCommit}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-black py-4 rounded-xl text-sm tracking-wider uppercase shadow-xl transition"
                >
                  {loadingCommit ? "Validating & Committing to GitHub..." : "Save to JSON & Commit to GitHub (Step 8)"}
                </button>

                {commitStatus && (
                  <div className={`p-3 border rounded-lg text-center text-xs font-bold ${
                    commitStatus.isError
                      ? "bg-red-950/80 border-red-800 text-red-300"
                      : "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                  }`}>
                    {commitStatus.msg}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
