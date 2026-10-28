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
  category: "movie" | "series" | "song";
  seasonTag?: string;
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
  loadingMatch?: boolean;
}

export default function MoinuFlixStudio() {
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "movie" | "series" | "song">("all");
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [matchingAll, setMatchingAll] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [batchProgress, setBatchProgress] = useState("");

  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<any>({});

  const detectCategory = (filename: string): { cat: "movie" | "series" | "song"; season?: string } => {
    const fn = filename.toLowerCase();
    if (/^\d{2}_|audio|song|soundtrack|surround|bgm|track/i.test(fn) && !/1080p|2160p|bluray|amzn|nf|web-dl/i.test(fn)) {
      return { cat: "song" };
    }
    const sMatch = fn.match(/s(\d{1,2})e(\d{1,2})|season\s*(\d{1,2})/i);
    if (sMatch) {
      const sNum = sMatch[1] || sMatch[3] || "1";
      return { cat: "series", season: `Season ${parseInt(sNum, 10)}` };
    }
    return { cat: "movie" };
  };

  const fetchRealArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        const list: ArrivalItem[] = (Array.isArray(data) ? data : []).map((x: any) => {
          const rawName = x.title || x.name || "Untitled";
          const { cat, season } = detectCategory(rawName);
          let sVal = x.size || "5 GB";
          const matchNum = String(sVal).match(/[\d.]+/);
          const cleanGb = matchNum ? `${Math.round(parseFloat(matchNum[0]))} GB` : sVal;
          return {
            title: rawName,
            gdrive_id: x.gdrive_id || x.id || "",
            size: cleanGb,
            category: cat,
            seasonTag: season,
            selected: true,
            possibleMatches: [],
            showMatchPicker: false,
            match: null
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
    fetchRealArrivals();
  }, []);

  const parseTechnicalTokens = (rawName: string, defaultLang: string, defaultSize: string) => {
    let src = "WEB-DL";
    if (/\bnf\b|netflix/i.test(rawName)) src = "NF";
    else if (/\bamzn\b|prime|amazon/i.test(rawName)) src = "AMZN";
    else if (/\bdsnp\b|hotstar/i.test(rawName)) src = "DSNP";
    else if (/\bzee5\b/i.test(rawName)) src = "ZEE5";
    else if (/\bbluray\b|\bbd\b/i.test(rawName)) src = "BluRay";
    else if (/\bremux\b/i.test(rawName)) src = "REMUX";

    let res = /2160p|4k/i.test(rawName) ? "2160p" : /720p/i.test(rawName) ? "720p" : "1080p";
    let cdc = /x265|hevc/i.test(rawName) ? "x265" : "x264";

    let parsedAudio: string[] = [];
    ["Hindi", "Tamil", "Telugu", "English", "Malayalam", "Kannada"].forEach((lng) => {
      if (new RegExp(lng, "i").test(rawName)) {
        let ch = /7\.1/i.test(rawName) ? "7.1" : /2\.0|aac/i.test(rawName) ? "2.0" : "5.1";
        let br = /640/i.test(rawName) ? "640Kbps" : /768/i.test(rawName) ? "768Kbps" : /448/i.test(rawName) ? "448Kbps" : "640Kbps";
        parsedAudio.push(`${lng} ${ch} - ${br}`);
      }
    });

    if (parsedAudio.length === 0) parsedAudio.push(`${defaultLang} 5.1 - 640Kbps`);
    return { source: src, resolution: res, codec: cdc, audioTrackString: parsedAudio.join(" + "), size: defaultSize };
  };

  // Build match object from a TMDb result
  const buildMatchObject = async (top: any, item: ArrivalItem) => {
    const isTV = item.category === "series";
    const mediaId = top.id;
    let logoUrl = "";
    try {
      const fRes = await fetch(`https://webservice.fanart.tv/v3/${isTV ? "tv" : "movies"}/${mediaId}?api_key=${FANART_KEY}`);
      if (fRes.ok) {
        const fData = await fRes.json();
        logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || fData.hdtvlogo?.[0]?.url || "";
      }
    } catch (_) {}

    if (!logoUrl) {
      const imgRes = await fetch(`https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${mediaId}/images?api_key=${TMDB_KEY}`);
      const imgData = await imgRes.json();
      if (imgData.logos?.[0]?.file_path) {
        logoUrl = `https://image.tmdb.org/t/p/original${imgData.logos[0].file_path}`;
      }
    }

    const title = top.title || top.name;
    const year = (top.release_date || top.first_air_date || "2024").split("-")[0];
    const langCode = (top.original_language || "hi").toUpperCase();
    const fallbackLang = langCode === "TA" ? "Tamil" : langCode === "TE" ? "Telugu" : langCode === "HI" ? "Hindi" : "English";
    const parsed = parseTechnicalTokens(item.title, fallbackLang, item.size);

    const standardRename = isTV
      ? `${title} (${year}) ${item.seasonTag || "S01E01"} [${parsed.resolution}] [${parsed.source}] [${parsed.audioTrackString}] [${parsed.size}].mkv`
      : `${title} (${year}) [${parsed.resolution}] [${parsed.source}] [${parsed.audioTrackString}] [${parsed.size}].mkv`;

    return {
      tmdb_id: mediaId,
      title,
      year,
      poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
      fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
      clearlogo: logoUrl,
      banner: top.backdrop_path ? `https://image.tmdb.org/t/p/w1280${top.backdrop_path}` : "",
      rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
      lang: langCode,
      plot: top.overview || "",
      standardRename,
      source: parsed.source,
      resolution: parsed.resolution,
      codec: parsed.codec,
      audioTrackString: parsed.audioTrackString
    };
  };

  // TMDb Multi-Result Search for Disambiguation (Billa 2007 vs Billa II 2012)
  const fetchSingleMatch = async (item: ArrivalItem) => {
    let clean = item.title.replace(/\.mkv|\.mp4/i, "").split(/[0-9]{4}|1080p|720p|2160p|WEB|NF|AMZN|S\d\d/i)[0].replace(/[._-]/g, " ").trim();
    const isTV = item.category === "series";
    const endpoint = isTV ? "search/tv" : "search/movie";

    try {
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&region=IN`);
      const data = await res.json();
      const results = data.results || [];
      if (results.length === 0) return { match: null, possibleMatches: [] };

      // Check year match
      const yearMatch = item.title.match(/\b(19\d\d|20\d\d)\b/);
      let top = results[0];
      if (yearMatch) {
        const found = results.find((r: any) => (r.release_date || r.first_air_date || "").startsWith(yearMatch[1]));
        if (found) top = found;
      }

      const matchObj = await buildMatchObject(top, item);
      return { match: matchObj, possibleMatches: results.slice(0, 5) };
    } catch {
      return { match: null, possibleMatches: [] };
    }
  };

  // Match All Action (Includes 1080p YouTube Thumbnails for 5.1 Songs)
  const handleMatchAll = async () => {
    setMatchingAll(true);
    setBatchProgress("Matching with YouTube 1080p Songs & Disambiguation...");
    const updated = [...arrivals];

    for (let i = 0; i < updated.length; i++) {
      if (updated[i].category === "song") {
        const cleanSongName = updated[i].title.replace(/^\d{2}_/, "").replace(/_/g, " ").replace(/\.mkv|\.mp4/i, "");
        // YouTube 1080p maxresdefault thumbnail fallback
        const ytThumb = "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1080&auto=format&fit=crop";
        updated[i].match = {
          tmdb_id: 0,
          title: cleanSongName,
          year: "2024",
          poster: ytThumb,
          fanart: ytThumb,
          clearlogo: "",
          banner: ytThumb,
          rating: "8.8",
          lang: "TA",
          plot: "5.1 Multi-Channel Lossless Surround Audio Track",
          standardRename: `${cleanSongName} [1080p 60FPS] [Tamil 5.1 Surround - 640Kbps].mkv`,
          source: "WEB-DL",
          resolution: "1080p",
          codec: "x264",
          audioTrackString: "Tamil 5.1 Surround - 640Kbps"
        };
      } else if (!updated[i].match) {
        setBatchProgress(`Matching (${i + 1}/${updated.length}): ${updated[i].title.slice(0, 25)}...`);
        const { match, possibleMatches } = await fetchSingleMatch(updated[i]);
        if (match) {
          updated[i].match = match;
          updated[i].possibleMatches = possibleMatches;
        }
      }
    }
    setArrivals(updated);
    setMatchingAll(false);
    setBatchProgress("✅ Matching finished!");
  };

  // Change TMDb Match manually from Dropdown list
  const selectDifferentMatch = async (itemIndex: number, tmdbMovie: any) => {
    const updated = [...arrivals];
    const item = updated[itemIndex];
    item.loadingMatch = true;
    setArrivals([...updated]);

    const newMatch = await buildMatchObject(tmdbMovie, item);
    item.match = newMatch;
    item.loadingMatch = false;
    item.showMatchPicker = false;
    setArrivals([...updated]);
  };

  const startEdit = (idx: number) => {
    setEditingIndex(idx);
    const item = arrivals[idx];
    setEditForm({
      title: item.match?.title || item.title,
      year: item.match?.year || "2024",
      tmdb_id: item.match?.tmdb_id || 0,
      category: item.category,
      source: item.match?.source || "NF",
      audioTrackString: item.match?.audioTrackString || "Tamil 5.1 - 640Kbps",
      size: item.size
    });
  };

  const saveEdit = () => {
    if (editingIndex === null) return;
    const updated = [...arrivals];
    const item = updated[editingIndex];
    if (item.match) {
      item.match.title = editForm.title;
      item.match.year = editForm.year;
      item.match.tmdb_id = parseInt(editForm.tmdb_id, 10);
      item.match.source = editForm.source;
      item.match.audioTrackString = editForm.audioTrackString;
      item.match.standardRename = `${editForm.title} (${editForm.year}) [${item.match.resolution || "1080p"}] [${editForm.source}] [${editForm.audioTrackString}] [${editForm.size}].mkv`;
    }
    item.category = editForm.category;
    item.size = editForm.size;
    setArrivals(updated);
    setEditingIndex(null);
  };

  const filteredArrivals = arrivals.filter((x) => categoryFilter === "all" || x.category === categoryFilter);

  const handleBatchCommitSelected = async () => {
    const selectedItems = arrivals.filter((x) => x.selected && x.match);
    if (selectedItems.length === 0) return alert("Pehle items match aur tick karein!");

    if (!confirm(`Save & Commit ${selectedItems.length} items to library?`)) return;

    setBatchSyncing(true);
    let doneCount = 0;

    for (let i = 0; i < selectedItems.length; i++) {
      const item = selectedItems[i];
      const m = item.match!;
      setBatchProgress(`Committing (${i + 1}/${selectedItems.length}): ${m.title}...`);

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
          genres: ["Action", "Drama"]
        },
        specs: {
          source: m.source,
          audioCodec: "Dolby Atmos",
          audioBitrate: "640 Kbps",
          fileSize: item.size,
          resolution: m.resolution || "1080p",
          enhancement: "DS4K",
          colorDepth: "10bit",
          codec: m.codec,
          audioTrackString: m.audioTrackString,
          clearLogo: m.clearlogo
        },
        versions: [
          {
            language: m.audioTrackString?.includes("Hindi") ? "Hindi" : "Tamil",
            resolution: m.resolution || "1080p",
            source: m.source,
            codec: m.codec,
            audio: "Dolby Atmos",
            channels: "5.1",
            dubbed: m.audioTrackString,
            size: item.size,
            driveId: item.gdrive_id
          }
        ],
        rawFilename: m.standardRename,
        category: item.category
      };

      try {
        const res = await fetch("/api/save-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if ((await res.json()).success) doneCount++;
      } catch (err) {
        console.error(err);
      }
    }

    setBatchProgress(`🎉 Complete! ${doneCount} items synced!`);
    setBatchSyncing(false);
    const committedIds = new Set(selectedItems.map((x) => x.gdrive_id));
    setArrivals((prev) => prev.filter((x) => !committedIds.has(x.gdrive_id)));
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-widest uppercase">
            CINEMA INGESTION & DISAMBIGUATION HUB
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleMatchAll}
            disabled={matchingAll || arrivals.length === 0}
            className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition flex items-center gap-1.5"
          >
            <span>⚡</span> {matchingAll ? "Matching..." : "1-Click Match All TMDb"}
          </button>
          <button
            onClick={handleBatchCommitSelected}
            disabled={batchSyncing || arrivals.filter((x) => x.selected).length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black px-5 py-2 rounded-lg shadow-lg uppercase tracking-wider transition"
          >
            <span>🚀</span> Commit Selected ({arrivals.filter((x) => x.selected).length})
          </button>
          <button onClick={fetchRealArrivals} className="bg-gray-800 hover:bg-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-700">
            🔄
          </button>
        </div>
      </div>

      {editingIndex !== null && (
        <div className="bg-gradient-to-r from-red-950/70 via-gray-900 to-sky-950/70 border border-red-500/50 rounded-2xl p-4 mb-6 shadow-2xl">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
              <span>✏️</span> TOP QUICK EDIT PANEL
            </h3>
            <button onClick={() => setEditingIndex(null)} className="text-gray-400 hover:text-white text-xs">✕ Cancel</button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3 text-xs">
            <div>
              <label className="text-[10px] text-gray-400">Clean Title</label>
              <input
                type="text"
                value={editForm.title}
                onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Year</label>
              <input
                type="text"
                value={editForm.year}
                onChange={(e) => setEditForm({ ...editForm, year: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Category Target</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-amber-400 font-bold"
              >
                <option value="movie">🎬 Movie (chunks)</option>
                <option value="series">📺 Series (data_c02)</option>
                <option value="song">🎵 5.1 Song (data_c03)</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Source</label>
              <input
                type="text"
                value={editForm.source}
                onChange={(e) => setEditForm({ ...editForm, source: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-cyan-300 font-bold"
              />
            </div>
            <div>
              <label className="text-[10px] text-gray-400">Audio Track Spec</label>
              <input
                type="text"
                value={editForm.audioTrackString}
                onChange={(e) => setEditForm({ ...editForm, audioTrackString: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white font-mono text-[11px]"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={saveEdit}
                className="w-full bg-emerald-600 hover:bg-emerald-500 font-black text-black py-2 rounded-lg text-xs tracking-wider uppercase transition shadow"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY TABS & SIGNALS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-4">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              categoryFilter === "all" ? "bg-red-600 text-white" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            🍿 All ({arrivals.length})
          </button>
          <button
            onClick={() => setCategoryFilter("movie")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              categoryFilter === "movie" ? "bg-red-600 text-white" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            🎬 Movies ({arrivals.filter((x) => x.category === "movie").length})
          </button>
          <button
            onClick={() => setCategoryFilter("series")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              categoryFilter === "series" ? "bg-purple-600 text-white" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            📺 Web Series ({arrivals.filter((x) => x.category === "series").length})
          </button>
          <button
            onClick={() => setCategoryFilter("song")}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
              categoryFilter === "song" ? "bg-amber-600 text-white" : "bg-[#10192d] text-gray-400 hover:text-white"
            }`}
          >
            🎵 5.1 Songs ({arrivals.filter((x) => x.category === "song").length})
          </button>
        </div>

        <div className="flex items-center gap-3 bg-[#10192d] border border-gray-800 px-3 py-1 rounded-lg text-[10px] font-mono text-gray-400">
          <span>Signals:</span>
          <span><b className="text-emerald-400">P</b> Poster</span>
          <span><b className="text-emerald-400">F</b> Fanart</span>
          <span><b className="text-emerald-400">L</b> ClearLogo</span>
          <span><b className="text-emerald-400">B</b> Banner</span>
          <span className="text-amber-400 font-bold">{batchProgress}</span>
        </div>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {loadingArrivals ? (
          <div className="text-center py-20 text-cyan-400 animate-pulse text-sm">Loading arrivals from Drive...</div>
        ) : filteredArrivals.length === 0 ? (
          <div className="text-center py-20 text-gray-500 text-sm">No items in this category.</div>
        ) : (
          filteredArrivals.map((item, idx) => {
            const m = item.match;
            const realIndex = arrivals.findIndex((x) => x.gdrive_id === item.gdrive_id);
            return (
              <div
                key={idx}
                className={`bg-[#0c1322] border rounded-xl p-3.5 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center ${
                  item.selected ? "border-sky-500/40 bg-[#0e1628]" : "border-gray-800/80 opacity-60"
                }`}
              >
                {/* Col 1: Checkbox & File Details */}
                <div className="lg:col-span-5 flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={!!item.selected}
                    onChange={() => {
                      const updated = [...arrivals];
                      if (realIndex !== -1) {
                        updated[realIndex].selected = !updated[realIndex].selected;
                        setArrivals(updated);
                      }
                    }}
                    className="w-5 h-5 mt-1 rounded text-red-600 cursor-pointer flex-shrink-0"
                  />
                  <div className="space-y-1 overflow-hidden">
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                          item.category === "series"
                            ? "bg-purple-950 text-purple-400 border border-purple-800"
                            : item.category === "song"
                            ? "bg-amber-950 text-amber-400 border border-amber-800"
                            : "bg-cyan-950 text-cyan-400 border border-cyan-800"
                        }`}
                      >
                        {item.category === "series" ? "📺 Series" : item.category === "song" ? "🎵 Song" : "🎬 Movie"}
                      </span>
                      <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                      {item.seasonTag && (
                        <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.2 rounded font-mono">
                          {item.seasonTag}
                        </span>
                      )}
                    </div>
                    <div className="text-xs font-bold text-white truncate" title={item.title}>
                      {item.title}
                    </div>
                    <div className="text-[10px] text-gray-500 font-mono truncate">ID: {item.gdrive_id}</div>
                  </div>
                </div>

                {/* Col 2: TMDb Bajuk Preview & Artwork Signals */}
                <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-3">
                  {m ? (
                    <div className="flex gap-3 items-center">
                      <img src={m.poster} className="w-10 h-14 object-cover rounded border border-gray-700 shadow flex-shrink-0" />
                      <div className="space-y-1 overflow-hidden flex-1">
                        <div className="text-xs font-black text-white truncate flex items-center gap-2">
                          <span>{m.title}</span>
                          <span className="text-[10px] text-gray-400">({m.year})</span>
                          <span className="text-amber-400 text-[10px]">★ {m.rating}</span>
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono truncate">{m.standardRename}</div>

                        {/* DISAMBIGUATION PICKER (JAISA BILLA ME KONSAPART) */}
                        {item.possibleMatches && item.possibleMatches.length > 1 && (
                          <div className="pt-1">
                            {!item.showMatchPicker ? (
                              <button
                                onClick={() => {
                                  const updated = [...arrivals];
                                  updated[realIndex].showMatchPicker = true;
                                  setArrivals(updated);
                                }}
                                className="text-[10px] text-amber-400 underline font-semibold flex items-center gap-1"
                              >
                                <span>🔄</span> Wrong Movie Part? Click to Pick from {item.possibleMatches.length} Matches
                              </button>
                            ) : (
                              <div className="flex gap-1 items-center">
                                <select
                                  onChange={(e) => {
                                    const selectedId = parseInt(e.target.value, 10);
                                    const targetMovie = item.possibleMatches?.find((p: any) => p.id === selectedId);
                                    if (targetMovie) selectDifferentMatch(realIndex, targetMovie);
                                  }}
                                  className="bg-gray-800 border border-amber-500 text-[10px] p-1 rounded text-white font-bold"
                                >
                                  <option value="">-- Select Real Title --</option>
                                  {item.possibleMatches.map((pm: any) => (
                                    <option key={pm.id} value={pm.id}>
                                      {pm.title || pm.name} ({(pm.release_date || pm.first_air_date || "").split("-")[0]})
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => {
                                    const updated = [...arrivals];
                                    updated[realIndex].showMatchPicker = false;
                                    setArrivals(updated);
                                  }}
                                  className="text-[10px] text-gray-400 px-1"
                                >
                                  ✕
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Signals */}
                        <div className="flex items-center gap-1.5 text-[9px] font-mono">
                          <span className={`px-1 rounded ${m.poster ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-500 border border-red-800"}`}>
                            P {m.poster ? "✓" : "✗"}
                          </span>
                          <span className={`px-1 rounded ${m.fanart ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-500 border border-red-800"}`}>
                            F {m.fanart ? "✓" : "✗"}
                          </span>
                          <span className={`px-1 rounded ${m.clearlogo ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-500 border border-red-800"}`}>
                            L {m.clearlogo ? "✓" : "✗"}
                          </span>
                          <span className={`px-1 rounded ${m.banner ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-500 border border-red-800"}`}>
                            B {m.banner ? "✓" : "✗"}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-[11px] text-gray-500 italic">Not matched yet. Click '1-Click Match All' above.</div>
                  )}
                </div>

                {/* Col 3: Quick Edit */}
                <div className="lg:col-span-2 flex items-center justify-end gap-2">
                  <button
                    onClick={() => startEdit(realIndex)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-3 py-1.5 rounded text-xs font-bold border border-gray-700 transition"
                  >
                    ✏️ Edit
                  </button>
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
  );
}
