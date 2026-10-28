"use client";
import React, { useState, useEffect } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";
const REPO_OWNER = "Moinuflix";
const REPO_NAME = "My-Movies";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;

interface ArrivalItem {
  title: string;
  gdrive_id: string;
  size: string;
  category: "movie" | "series" | "song";
  selected?: boolean;
  possibleMatches?: any[];
  showMatchPicker?: boolean;
  match?: {
    tmdb_id: number;
    title: string;
    year: string;
    poster: string;
    fanart: string;
    clearlogo: string;
    banner: string;
    rating: string;
    lang: string;
    plot: string;
    standardRename?: string;
    source?: string;
    resolution?: string;
    codec?: string;
    audioTrackString?: string;
  } | null;
}

export default function StudioManagerPro() {
  const [activeTab, setActiveTab] = useState<"arrivals" | "catalog" | "chunks">("arrivals");

  // Real Data State Read from resources/data/
  const [catalogMovies, setCatalogMovies] = useState<any[]>([]);
  const [chunkMovies, setChunkMovies] = useState<any[]>([]);
  const [loadingRepoData, setLoadingRepoData] = useState(false);

  // Drive Arrivals
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [matchingAll, setMatchingAll] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<"all" | "movie" | "series" | "song">("all");

  // 1. LIVE READ: Fetch from resources/data/catalog.json & resources/data/chunks/chunk_01.json
  const fetchLiveRepoData = async () => {
    setLoadingRepoData(true);
    try {
      // A. Read catalog.json
      const catRes = await fetch(`${RAW_BASE}/resources/data/catalog.json?t=${Date.now()}`);
      if (catRes.ok) {
        const catData = await catRes.json();
        const cList = Array.isArray(catData) ? catData : catData.movies || [];
        setCatalogMovies(cList);
      }

      // B. Read current chunk_01.json
      const chkRes = await fetch(`${RAW_BASE}/resources/data/chunks/chunk_01.json?t=${Date.now()}`);
      if (chkRes.ok) {
        const chkData = await chkRes.json();
        const chkList = Array.isArray(chkData) ? chkData : chkData.movies || [];
        setChunkMovies(chkList);
      }
    } catch (e) {
      console.error("Error reading resources/data/", e);
    }
    setLoadingRepoData(false);
  };

  // 2. LIVE READ: Fetch inbox_arrivals.json
  const fetchArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch(`${RAW_BASE}/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const list: ArrivalItem[] = (Array.isArray(data) ? data : []).map((x: any) => {
          const raw = x.title || x.name || "Untitled";
          let cat: "movie" | "series" | "song" = "movie";
          if (/^\d{2}_|audio|song|soundtrack/i.test(raw)) cat = "song";
          else if (/s(\d{1,2})e(\d{1,2})|season/i.test(raw)) cat = "series";

          const matchNum = String(x.size || "").match(/[\d.]+/);
          const cleanSize = matchNum ? `${Math.round(parseFloat(matchNum[0]))} GB` : "5 GB";

          return {
            title: raw,
            gdrive_id: x.gdrive_id || x.id || "",
            size: cleanSize,
            category: cat,
            selected: true,
            possibleMatches: [],
            showMatchPicker: false,
            match: null,
          };
        });
        setArrivals(list);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingArrivals(false);
  };

  useEffect(() => {
    fetchLiveRepoData();
    fetchArrivals();
  }, []);

  // 3. Technical Token Parser
  const parseTokens = (rawName: string, defaultLang: string, defaultSize: string) => {
    let src = "WEB-DL";
    if (/\bnf\b|netflix/i.test(rawName)) src = "NF";
    else if (/\bamzn\b|prime|amazon/i.test(rawName)) src = "AMZN";
    else if (/\bdsnp\b|hotstar/i.test(rawName)) src = "DSNP";
    else if (/\bbluray\b|\bbd\b/i.test(rawName)) src = "BluRay";

    let res = /2160p|4k/i.test(rawName) ? "2160p" : /720p/i.test(rawName) ? "720p" : "1080p";
    let cdc = /x265|hevc/i.test(rawName) ? "x265" : "x264";

    let parsedAudio: string[] = [];
    ["Hindi", "Tamil", "Telugu", "English"].forEach((lng) => {
      if (new RegExp(lng, "i").test(rawName)) {
        let ch = /7\.1/i.test(rawName) ? "7.1" : "5.1";
        let br = /640/i.test(rawName) ? "640Kbps" : /448/i.test(rawName) ? "448Kbps" : "640Kbps";
        parsedAudio.push(`${lng} ${ch} - ${br}`);
      }
    });

    if (parsedAudio.length === 0) parsedAudio.push(`${defaultLang} 5.1 - 640Kbps`);
    return { source: src, resolution: res, codec: cdc, audioTrackString: parsedAudio.join(" + "), size: defaultSize };
  };

  // 4. Match All TMDb
  const handleMatchAll = async () => {
    setMatchingAll(true);
    setBatchProgress("Matching TMDb metadata & artwork signals...");
    const updated = [...arrivals];

    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.category === "song") {
        const cleanSong = item.title.replace(/^\d{2}_/, "").replace(/_/g, " ").replace(/\.mkv|\.mp4/i, "");
        item.match = {
          tmdb_id: 0,
          title: cleanSong,
          year: "2024",
          poster: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1080&auto=format&fit=crop",
          fanart: "",
          clearlogo: "",
          banner: "",
          rating: "8.5",
          lang: "TA",
          plot: "5.1 Lossless Surround Soundtrack Track",
          standardRename: `${cleanSong} [1080p 60FPS] [Tamil 5.1 Surround - 640Kbps].mkv`,
          source: "WEB-DL",
          resolution: "1080p",
          codec: "x264",
          audioTrackString: "Tamil 5.1 Surround - 640Kbps",
        };
      } else {
        const isTV = item.category === "series";
        const clean = item.title.replace(/\.mkv|\.mp4/i, "").split(/[0-9]{4}|1080p|720p|2160p|WEB|NF|AMZN/i)[0].replace(/[._-]/g, " ").trim();
        try {
          const res = await fetch(`https://api.themoviedb.org/3/${isTV ? "search/tv" : "search/movie"}?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&region=IN`);
          const data = await res.json();
          const top = data.results?.[0];
          if (top) {
            let logoUrl = "";
            try {
              const fRes = await fetch(`https://webservice.fanart.tv/v3/${isTV ? "tv" : "movies"}/${top.id}?api_key=${FANART_KEY}`);
              if (fRes.ok) {
                const fData = await fRes.json();
                logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
              }
            } catch {}

            const parsed = parseTokens(item.title, (top.original_language || "hi").toUpperCase(), item.size);
            const yr = (top.release_date || top.first_air_date || "2024").split("-")[0];

            item.match = {
              tmdb_id: top.id,
              title: top.title || top.name,
              year: yr,
              poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
              fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
              clearlogo: logoUrl,
              banner: top.backdrop_path ? `https://image.tmdb.org/t/p/w1280${top.backdrop_path}` : "",
              rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
              lang: (top.original_language || "hi").toUpperCase(),
              plot: top.overview || "",
              standardRename: `${top.title || top.name} (${yr}) [${parsed.resolution}] [${parsed.source}] [${parsed.audioTrackString}] [${parsed.size}].mkv`,
              source: parsed.source,
              resolution: parsed.resolution,
              codec: parsed.codec,
              audioTrackString: parsed.audioTrackString,
            };
            item.possibleMatches = data.results?.slice(0, 5) || [];
          }
        } catch {}
      }
    }

    setArrivals(updated);
    setMatchingAll(false);
    setBatchProgress("✅ All items matched!");
  };

  // 5. REAL PUSH: Commit directly to resources/data/ and immediately update screen
  const handleBatchCommit = async () => {
    const selected = arrivals.filter((x) => x.selected && x.match);
    if (selected.length === 0) return alert("Pehle 1-Click Match All dabayein!");

    if (!confirm(`Commit ${selected.length} items directly to resources/data/ in GitHub?`)) return;

    setBatchSyncing(true);
    let done = 0;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      const m = item.match!;
      setBatchProgress(`Pushing to resources/data/ (${i + 1}/${selected.length}): ${m.title}...`);

      const payload = {
        movie: {
          id: m.tmdb_id || Date.now(),
          title: m.title,
          year: m.year,
          runtime: 120,
          rating: m.rating,
          cert: "UA",
          lang: m.lang,
          poster: m.poster,
          fanart: m.fanart,
          plot: m.plot,
          genres: ["Action", "Drama"],
        },
        specs: {
          source: m.source,
          audioCodec: "Dolby Atmos",
          audioBitrate: "640 Kbps",
          fileSize: item.size,
          resolution: m.resolution,
          enhancement: "DS4K",
          colorDepth: "10bit",
          codec: m.codec,
          audioTrackString: m.audioTrackString,
          clearLogo: m.clearlogo,
        },
        versions: [
          {
            language: m.audioTrackString?.includes("Hindi") ? "Hindi" : "Tamil",
            resolution: m.resolution,
            source: m.source,
            codec: m.codec,
            audio: "Dolby Atmos",
            channels: "5.1",
            dubbed: m.audioTrackString,
            size: item.size,
            driveId: item.gdrive_id,
          },
        ],
        rawFilename: m.standardRename,
        category: item.category,
      };

      try {
        const res = await fetch("/api/save-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const resData = await res.json();
        if (resData.success) done++;
      } catch (err) {
        console.error(err);
      }
    }

    setBatchProgress(`🎉 Complete! ${done} items successfully pushed to resources/data/!`);
    setBatchSyncing(false);

    // Refresh Live Display after push
    const committedIds = new Set(selected.map((x) => x.gdrive_id));
    setArrivals((prev) => prev.filter((x) => !committedIds.has(x.gdrive_id)));
    await fetchLiveRepoData();
  };

  const filtered = arrivals.filter((x) => categoryFilter === "all" || x.category === categoryFilter);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-6 font-sans">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-gray-800 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
            <span className="text-xs text-emerald-400 font-bold font-mono uppercase bg-emerald-950/60 border border-emerald-800 px-2 py-0.5 rounded">
              LIVE REPO: resources/data/
            </span>
          </div>
          <div className="text-[11px] text-gray-400 mt-1">
            Catalog: <strong className="text-white">{catalogMovies.length} movies</strong> • Chunk 01: <strong className="text-white">{chunkMovies.length} movies</strong>
          </div>
        </div>

        {/* Top Navigation & Push Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTab("arrivals")}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "arrivals" ? "bg-amber-600 text-white shadow" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            🔔 Drive Arrivals ({arrivals.length})
          </button>
          <button
            onClick={() => setActiveTab("catalog")}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "catalog" ? "bg-sky-600 text-white shadow" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            📁 Live Catalog ({catalogMovies.length})
          </button>
          <button
            onClick={() => setActiveTab("chunks")}
            className={`px-3 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === "chunks" ? "bg-purple-600 text-white shadow" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            📦 Chunk 01 ({chunkMovies.length}/50)
          </button>

          <button
            onClick={handleMatchAll}
            disabled={matchingAll || arrivals.length === 0}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition"
          >
            ⚡ {matchingAll ? "Matching..." : "1-Click Match All TMDb"}
          </button>
          <button
            onClick={handleBatchCommit}
            disabled={batchSyncing || arrivals.filter((x) => x.selected).length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black px-4 py-2 rounded-lg shadow-lg uppercase tracking-wider transition"
          >
            🚀 Push to resources/data/
          </button>
          <button
            onClick={() => {
              fetchLiveRepoData();
              fetchArrivals();
            }}
            className="bg-gray-800 text-xs font-bold px-3 py-2 rounded-lg border border-gray-700"
          >
            🔄 Refresh
          </button>
        </div>
      </div>

      {/* VIEW 1: DRIVE ARRIVALS */}
      {activeTab === "arrivals" && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <div className="flex gap-2">
              <button onClick={() => setCategoryFilter("all")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "all" ? "bg-red-600 text-white" : "bg-[#10192d] text-gray-400"}`}>
                🍿 All ({arrivals.length})
              </button>
              <button onClick={() => setCategoryFilter("movie")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "movie" ? "bg-red-600 text-white" : "bg-[#10192d] text-gray-400"}`}>
                🎬 Movies ({arrivals.filter((x) => x.category === "movie").length})
              </button>
              <button onClick={() => setCategoryFilter("series")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "series" ? "bg-purple-600 text-white" : "bg-[#10192d] text-gray-400"}`}>
                📺 Series ({arrivals.filter((x) => x.category === "series").length})
              </button>
              <button onClick={() => setCategoryFilter("song")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "song" ? "bg-amber-600 text-white" : "bg-[#10192d] text-gray-400"}`}>
                🎵 5.1 Songs ({arrivals.filter((x) => x.category === "song").length})
              </button>
            </div>
            <div className="text-amber-400 font-mono text-xs font-bold">{batchProgress}</div>
          </div>

          <div className="space-y-3">
            {loadingArrivals ? (
              <div className="text-center py-20 text-cyan-400 animate-pulse text-sm">Scanning Drive arrivals...</div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-sm">🎉 No pending arrivals! All Drive files are synced.</div>
            ) : (
              filtered.map((item, idx) => {
                const m = item.match;
                return (
                  <div key={idx} className="bg-[#0c1322] border border-gray-800 rounded-xl p-3.5 grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
                    <div className="lg:col-span-5 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!!item.selected}
                        onChange={() => {
                          const updated = [...arrivals];
                          const rIdx = arrivals.findIndex((x) => x.gdrive_id === item.gdrive_id);
                          if (rIdx !== -1) {
                            updated[rIdx].selected = !updated[rIdx].selected;
                            setArrivals(updated);
                          }
                        }}
                        className="w-5 h-5 mt-1 rounded text-red-600 cursor-pointer"
                      />
                      <div className="space-y-1 overflow-hidden">
                        <div className="flex items-center gap-2">
                          <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold uppercase">
                            {item.category}
                          </span>
                          <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                        </div>
                        <div className="text-xs font-bold text-white truncate">{item.title}</div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">ID: {item.gdrive_id}</div>
                      </div>
                    </div>

                    <div className="lg:col-span-6 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-3">
                      {m ? (
                        <div className="flex gap-3 items-center">
                          <img src={m.poster} className="w-10 h-14 object-cover rounded border border-gray-700 shadow flex-shrink-0" alt="" />
                          <div className="space-y-1 overflow-hidden flex-1">
                            <div className="text-xs font-black text-white truncate flex items-center gap-2">
                              <span>{m.title}</span>
                              <span className="text-[10px] text-gray-400">({m.year})</span>
                              <span className="text-amber-400 text-[10px]">★ {m.rating}</span>
                            </div>
                            <div className="text-[10px] text-emerald-400 font-mono truncate">{m.standardRename}</div>
                            <div className="flex items-center gap-1.5 text-[9px] font-mono text-slate-400">
                              <span className="text-cyan-400">Push Destination:</span>
                              <span className="text-white font-bold">
                                {item.category === "song" ? "resources/data/data_c03.json" : item.category === "series" ? "resources/data/data_c02.json" : "resources/data/chunks/chunk_01.json"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-[11px] text-gray-500 italic">Click '1-Click Match All' above to fetch TMDb artwork.</div>
                      )}
                    </div>

                    <div className="lg:col-span-1 flex justify-end">
                      <span className={`text-xs font-bold px-2 py-1 rounded ${item.selected ? "text-emerald-400" : "text-gray-500"}`}>
                        {item.selected ? "✓ Ready" : "Skipped"}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: LIVE CATALOG (resources/data/catalog.json) */}
      {activeTab === "catalog" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#0c1322] border border-sky-500/20 p-4 rounded-xl">
            <div>
              <h2 className="text-sm font-bold text-sky-400 uppercase">Live Content in resources/data/catalog.json</h2>
              <p className="text-xs text-gray-400">Lightweight Master index currently stored on GitHub.</p>
            </div>
            <span className="bg-sky-950 text-sky-300 border border-sky-800 text-xs px-3 py-1 rounded-full font-bold">
              Total: {catalogMovies.length} Records
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {catalogMovies.map((m, idx) => (
              <div key={idx} className="bg-[#0c1322] border border-gray-800 rounded-xl overflow-hidden shadow p-2 space-y-2">
                <img src={m.poster} className="w-full h-44 object-cover rounded-lg bg-gray-900" alt="" />
                <div className="text-xs font-bold text-white truncate">{m.title}</div>
                <div className="flex justify-between items-center text-[10px] text-gray-400">
                  <span>{m.year}</span>
                  <span className="text-amber-400">★ {m.rating}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* VIEW 3: LIVE CHUNK 01 (resources/data/chunks/chunk_01.json) */}
      {activeTab === "chunks" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#0c1322] border border-purple-500/20 p-4 rounded-xl">
            <div>
              <h2 className="text-sm font-bold text-purple-400 uppercase">Live Content in resources/data/chunks/chunk_01.json</h2>
              <p className="text-xs text-gray-400">Heavy detailed metadata, technical tags, and versions.</p>
            </div>
            <span className="bg-purple-950 text-purple-300 border border-purple-800 text-xs px-3 py-1 rounded-full font-bold">
              Limit: {chunkMovies.length} / 50 Movies
            </span>
          </div>

          <div className="space-y-2">
            {chunkMovies.map((m, idx) => (
              <div key={idx} className="bg-[#0c1322] border border-gray-800 p-3 rounded-xl flex items-center justify-between text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-gray-500">#{idx + 1}</span>
                  <img src={m.artwork?.poster || m.poster} className="w-8 h-12 object-cover rounded" alt="" />
                  <div>
                    <div className="font-bold text-white">{m.title} ({m.year})</div>
                    <div className="text-[10px] text-gray-400 font-mono">{m.name}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[10px]">
                  <span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded">{m.specs?.resolution || "1080p"}</span>
                  <span className="bg-amber-950 text-amber-400 px-2 py-0.5 rounded">{m.specs?.source || "WEB-DL"}</span>
                  <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded">{m.specs?.size || "5 GB"}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
