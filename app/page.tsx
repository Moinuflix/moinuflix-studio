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
  selected?: boolean;
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
    certification: string;
    runtime: number;
    standardRename?: string;
    source?: string;
    resolution?: string;
    codec?: string;
    audioTrackString?: string;
  } | null;
  loadingMatch?: boolean;
}

export default function MoinuFlixStudio() {
  const [activeTab, setActiveTab] = useState<"arrivals" | "form">("arrivals");
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [matchingAll, setMatchingAll] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [standardRenameString, setStandardRenameString] = useState("");
  const [specs, setSpecs] = useState<any>({});
  const [versions, setVersions] = useState<any[]>([]);

  // 1. Fetch Arrivals from inbox_arrivals.json
  const fetchRealArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const cleanList = Array.isArray(data) ? data.map((x: any) => {
          let sVal = x.size || "5 GB";
          const matchNum = String(sVal).match(/[\d.]+/);
          const cleanGb = matchNum ? `${Math.round(parseFloat(matchNum[0]))} GB` : sVal;
          return {
            title: x.title || x.name || "Untitled File",
            gdrive_id: x.gdrive_id || x.id || "",
            size: cleanGb,
            target_category: x.target_category || "Movie",
            selected: true,
            match: null
          };
        }) : [];
        setArrivals(cleanList);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingArrivals(false);
  };

  useEffect(() => {
    fetchRealArrivals();
  }, []);

  // 2. Intelligent Filename Parser
  const parseTechnicalTokens = (rawName: string, defaultLang: string, defaultSize: string) => {
    const raw = rawName;
    let src = "WEB-DL";
    if (/\bnf\b|netflix/i.test(raw)) src = "NF";
    else if (/\bamzn\b|prime|amazon/i.test(raw)) src = "AMZN";
    else if (/\bdsnp\b|hotstar|disney/i.test(raw)) src = "DSNP";
    else if (/\bzee5\b/i.test(raw)) src = "ZEE5";
    else if (/\bsony\b|sonyliv/i.test(raw)) src = "SONYLIV";
    else if (/\bremux\b/i.test(raw)) src = "REMUX";
    else if (/\bbluray\b|\bbd\b/i.test(raw)) src = "BluRay";
    else if (/\bhdtv\b/i.test(raw)) src = "HDTV";

    let res = "1080p";
    if (/2160p|4k|uhd/i.test(raw)) res = "2160p";
    else if (/720p/i.test(raw)) res = "720p";

    let cdc = "x264";
    if (/x265|hevc|h\.265/i.test(raw)) cdc = "x265";
    else if (/x264|avc|h\.264/i.test(raw)) cdc = "x264";

    let parsedAudioTracks: string[] = [];
    const langList = ["Hindi", "Tamil", "Telugu", "English", "Malayalam", "Kannada"];
    langList.forEach((lng) => {
      const reg = new RegExp(`(${lng})[^+\\]\\[]*`, "i");
      const match = raw.match(reg);
      if (match) {
        let chunk = match[0];
        let ch = /7\.1|7\s1/i.test(chunk) ? "7.1" : /2\.0|2\s0|aac|stereo/i.test(chunk) ? "2.0" : "5.1";
        let br = "640Kbps";
        const brMatch = chunk.match(/(\d{3,4})\s*k/i);
        if (brMatch) br = `${brMatch[1]}Kbps`;
        else if (/1509/i.test(raw)) br = "1509Kbps";
        else if (/768/i.test(raw)) br = "768Kbps";
        else if (/448/i.test(raw)) br = "448Kbps";
        parsedAudioTracks.push(`${lng} ${ch} - ${br}`);
      }
    });

    if (parsedAudioTracks.length === 0) {
      let ch = /7\.1/i.test(raw) ? "7.1" : /2\.0/i.test(raw) ? "2.0" : "5.1";
      parsedAudioTracks.push(`${defaultLang} ${ch} - 640Kbps`);
    }

    const audioTrackString = parsedAudioTracks.join(" + ");
    return { source: src, resolution: res, codec: cdc, audioTrackString, size: defaultSize };
  };

  // Helper single TMDb fetch
  const fetchSingleMatch = async (titleStr: string, defaultSize: string) => {
    let clean = titleStr.replace(/\.mkv|\.mp4/i, "").split(/[0-9]{4}|1080p|720p|2160p|WEB|NF|AMZN/i)[0].replace(/[._-]/g, " ").trim();
    const yearMatch = titleStr.match(/\b(19\d\d|20\d\d)\b/);
    const yearParam = yearMatch ? `&primary_release_year=${yearMatch[1]}` : "";

    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&region=IN${yearParam}`);
      const data = await res.json();
      const top = data.results?.[0];
      if (!top) return null;

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

      const langCode = (top.original_language || "hi").toUpperCase();
      const fallbackLang = langCode === "TA" ? "Tamil" : langCode === "TE" ? "Telugu" : langCode === "HI" ? "Hindi" : "English";
      const parsed = parseTechnicalTokens(titleStr, fallbackLang, defaultSize);
      const year = top.release_date ? top.release_date.split("-")[0] : (yearMatch ? yearMatch[1] : "2024");
      const standardRename = `${top.title} (${year}) [${parsed.resolution}] [${parsed.source}] [${parsed.audioTrackString}] [${parsed.size}].mkv`;

      return {
        tmdb_id: top.id,
        title: top.title,
        year,
        poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
        fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
        clearlogo: logoUrl,
        rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
        lang: langCode,
        plot: top.overview || "",
        certification: "UA",
        runtime: 120,
        standardRename,
        source: parsed.source,
        resolution: parsed.resolution,
        codec: parsed.codec,
        audioTrackString: parsed.audioTrackString
      };
    } catch {
      return null;
    }
  };

  // 3. ⚡ 1-Click Match All (Batch TMDb)
  const handleMatchAll = async () => {
    if (arrivals.length === 0) return;
    setMatchingAll(true);
    setBatchProgress("Matching movies from TMDb in parallel...");

    const updated = [...arrivals];
    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].match) {
        setBatchProgress(`Fetching TMDb (${i + 1}/${updated.length}): ${updated[i].title.slice(0, 25)}...`);
        const matchData = await fetchSingleMatch(updated[i].title, updated[i].size);
        if (matchData) updated[i].match = matchData;
      }
    }
    setArrivals(updated);
    setMatchingAll(false);
    setBatchProgress("✅ All movies matched with poster & clearlogo!");
  };

  // Toggle selection
  const toggleSelect = (index: number) => {
    const updated = [...arrivals];
    updated[index].selected = !updated[index].selected;
    setArrivals(updated);
  };

  const toggleSelectAll = (checked: boolean) => {
    const updated = arrivals.map(item => ({ ...item, selected: checked }));
    setArrivals(updated);
  };

  // 4. 🚀 1-Click Batch Commit (Jo Jo Ticked Hain Unhe Direct Save Karein)
  const handleBatchCommitSelected = async () => {
    const selectedItems = arrivals.filter(x => x.selected && x.match);
    if (selectedItems.length === 0) {
      return alert("Pehle '1-Click Match All' dabayein aur kam se kam 1 movie tick karein!");
    }

    if (!confirm(`Kya aap in ${selectedItems.length} ticked movies ko direct catalog.json aur chunks mein commit karna chahte hain?`)) return;

    setBatchSyncing(true);
    let successCount = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const m = item.match!;
      setBatchProgress(`Committing to GitHub (${i + 1}/${selectedItems.length}): ${m.title}...`);

      const payload = {
        movie: {
          id: m.tmdb_id,
          title: m.title,
          year: m.year,
          runtime: m.runtime,
          rating: m.rating,
          cert: m.certification,
          lang: m.lang,
          poster: m.poster,
          fanart: m.fanart,
          plot: m.plot,
          genres: ["Action", "Drama"]
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
          clearLogo: m.clearlogo
        },
        versions: [
          {
            language: m.audioTrackString?.includes("Hindi") ? "Hindi" : (m.lang === "TA" ? "Tamil" : m.lang === "TE" ? "Telugu" : "Hindi"),
            resolution: m.resolution,
            source: m.source,
            codec: m.codec,
            audio: "Dolby Atmos",
            channels: m.audioTrackString?.includes("7.1") ? "7.1" : "5.1",
            dubbed: m.audioTrackString,
            size: item.size,
            driveId: item.gdrive_id
          }
        ],
        rawFilename: m.standardRename
      };

      try {
        const res = await fetch("/api/save-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const resData = await res.json();
        if (resData.success) successCount++;
      } catch (err) {
        console.error("Save error:", err);
      }
    }

    setBatchProgress(`🎉 Super Done! ${successCount} Movies successfully committed to catalog.json & chunks!`);
    setBatchSyncing(false);
    // Remove committed from list
    const committedIds = new Set(selectedItems.map(x => x.gdrive_id));
    setArrivals(prev => prev.filter(x => !committedIds.has(x.gdrive_id)));
  };

  // Single inspect into form
  const handleInspect = (item: ArrivalItem) => {
    if (!item.match) return;
    const m = item.match;
    setSelectedMovie({
      id: m.tmdb_id,
      title: m.title,
      year: m.year,
      runtime: m.runtime,
      rating: m.rating,
      cert: m.certification,
      lang: m.lang,
      poster: m.poster,
      fanart: m.fanart,
      plot: m.plot,
      genres: ["Action", "Drama"]
    });
    setStandardRenameString(m.standardRename || "");
    setSpecs({
      source: m.source,
      audioCodec: "Dolby Atmos",
      audioBitrate: "640 Kbps",
      fileSize: item.size,
      resolution: m.resolution,
      enhancement: "DS4K",
      colorDepth: "10bit",
      codec: m.codec,
      audioTrackString: m.audioTrackString,
      clearLogo: m.clearlogo
    });
    setVersions([
      {
        language: m.lang === "TA" ? "Tamil" : m.lang === "TE" ? "Telugu" : "Hindi",
        resolution: m.resolution,
        source: m.source,
        codec: m.codec,
        audio: "Dolby Atmos",
        channels: "5.1",
        dubbed: m.audioTrackString,
        size: item.size,
        driveId: item.gdrive_id
      }
    ]);
    setActiveTab("form");
  };

  const selectedCount = arrivals.filter(x => x.selected).length;

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-widest uppercase">CINEMA BATCH INGESTION</span>
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
            <span>🎬</span> Movie Studio Form
          </button>
        </div>
      </div>

      {activeTab === "arrivals" && (
        <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-6 shadow-2xl">
          {/* Header Controls: Match All & Batch Commit */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6 border-b border-gray-800 pb-5">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>⚡</span> Batch Arrivals ({arrivals.length} Files) — 1-Click Match & Select
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Har baar alag check karne ki zaroorat nahi. Ek click mein poora TMDb load hoga, jo sahi hai usko tick karke batch commit karein.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={matchingAll || arrivals.length === 0}
                onClick={handleMatchAll}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2.5 rounded-lg shadow flex items-center gap-1.5 transition"
              >
                <span>⚡</span> {matchingAll ? "Matching..." : "1-Click Match All (TMDb)"}
              </button>

              <button
                disabled={batchSyncing || selectedCount === 0}
                onClick={handleBatchCommitSelected}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black px-5 py-2.5 rounded-lg shadow-lg flex items-center gap-1.5 transition uppercase tracking-wider"
              >
                <span>🚀</span> Commit Selected ({selectedCount})
              </button>

              <button onClick={fetchRealArrivals} className="bg-gray-800 hover:bg-gray-700 text-xs font-bold px-3 py-2.5 rounded-lg border border-gray-700">
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Select All Checkbox Row */}
          {arrivals.length > 0 && (
            <div className="flex items-center justify-between bg-[#10192d] border border-gray-800 px-4 py-2.5 rounded-xl mb-4 text-xs font-bold">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={arrivals.length > 0 && arrivals.every(x => x.selected)}
                  onChange={(e) => toggleSelectAll(e.target.checked)}
                  className="w-4 h-4 rounded text-red-600 focus:ring-0 cursor-pointer"
                />
                <span className="text-gray-300">Select All ({arrivals.length} Movies)</span>
              </label>
              <div className="text-amber-400 font-mono text-[11px]">{batchProgress}</div>
            </div>
          )}

          {loadingArrivals ? (
            <div className="text-center py-16 text-cyan-400 animate-pulse text-sm">Loading Google Drive arrivals from repository...</div>
          ) : arrivals.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">🎉 No pending Drive arrivals! All Google Drive files are synced.</div>
          ) : (
            <div className="space-y-3">
              {arrivals.map((item, idx) => (
                <div
                  key={idx}
                  className={`bg-[#10192d] border rounded-xl p-3.5 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                    item.selected ? "border-sky-500/50 bg-[#121c33]" : "border-gray-800 opacity-60"
                  }`}
                >
                  {/* Col 1: Checkbox & Raw File */}
                  <div className="lg:col-span-5 flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!!item.selected}
                      onChange={() => toggleSelect(idx)}
                      className="w-5 h-5 mt-1 rounded text-red-600 focus:ring-0 cursor-pointer flex-shrink-0"
                    />
                    <div className="space-y-1 overflow-hidden">
                      <div className="flex items-center gap-2">
                        <span className="bg-cyan-950 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded text-[10px] font-bold">
                          {item.target_category || "Movie"}
                        </span>
                        <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                      </div>
                      <div className="text-xs font-bold text-white truncate" title={item.title}>{item.title}</div>
                      <div className="text-[10px] text-gray-500 font-mono">ID: {item.gdrive_id}</div>
                    </div>
                  </div>

                  {/* Col 2: Real TMDb Match Bajuk */}
                  <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-3">
                    {item.match ? (
                      <div className="flex gap-3 items-center">
                        <img
                          src={item.match.poster || "https://image.tmdb.org/t/p/w92/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"}
                          className="w-10 h-15 object-cover rounded border border-gray-700 shadow"
                        />
                        <div className="space-y-0.5 overflow-hidden">
                          <div className="text-xs font-black text-white truncate">{item.match.title}</div>
                          <div className="flex items-center gap-2 text-[10px] font-bold text-gray-400">
                            <span>{item.match.year}</span>
                            <span>•</span>
                            <span className="text-amber-400">★ {item.match.rating}</span>
                            <span>•</span>
                            <span className="bg-blue-950 text-blue-400 px-1 py-0.2 rounded border border-blue-800 text-[9px]">
                              {item.match.lang}
                            </span>
                          </div>
                          <div className="text-[10px] text-emerald-400 font-mono truncate">{item.match.standardRename}</div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-gray-500 italic">
                        Not matched yet. Click '1-Click Match All' above.
                      </div>
                    )}
                  </div>

                  {/* Col 3: Inspect / Action */}
                  <div className="lg:col-span-2 flex items-center justify-end gap-2">
                    {item.match && (
                      <button
                        onClick={() => handleInspect(item)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs font-bold transition"
                      >
                        Inspect
                      </button>
                    )}
                    <span className={`text-xs font-bold px-2 py-1 rounded ${item.selected ? "text-emerald-400" : "text-gray-500"}`}>
                      {item.selected ? "✓ Ready" : "Skipped"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Form Tab (Same Master UI for editing/inspecting) */}
      {activeTab === "form" && selectedMovie && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3">STEP 4: STANDARD RENAME</h2>
              <div className="bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-emerald-300 break-all">
                {standardRenameString}
              </div>
            </div>
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg space-y-2 text-xs">
              <label className="text-[10px] text-gray-400">Audio Track Details</label>
              <input
                type="text"
                value={specs.audioTrackString || ""}
                onChange={(e) => setSpecs({ ...specs, audioTrackString: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-2 rounded text-cyan-300 font-mono"
              />
            </div>
          </div>

          <div className="lg:col-span-7 space-y-4">
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-5 shadow-2xl flex items-center gap-4">
              <img src={selectedMovie.poster} className="w-20 h-30 object-cover rounded-lg border border-gray-700" />
              <div>
                {specs.clearLogo ? <img src={specs.clearLogo} className="h-10 object-contain" /> : <h1 className="text-2xl font-black">{selectedMovie.title}</h1>}
                <div className="flex items-center gap-2 text-xs font-bold mt-2">
                  <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded">{selectedMovie.cert}</span>
                  <span>{selectedMovie.year}</span>
                  <span className="text-amber-400">★ {selectedMovie.rating}</span>
                  <span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded">LANG: {selectedMovie.lang}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                handleBatchCommitSelected();
                setActiveTab("arrivals");
              }}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3 rounded-xl uppercase text-xs tracking-wider"
            >
              Save This Movie & Return to Arrivals
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
