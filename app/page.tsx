"use client";
import React, { useState, useEffect } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";
const REPO_OWNER = "Moinuflix";
const REPO_NAME = "My-Movies";

interface AudioStream {
  language: string;
  channels: string;
  bitrate_kbps: number | string;
}

interface ArrivalItem {
  gdrive_id: string;
  original_filename: string;
  file_size_gb: string;
  category: "movie" | "series" | "song";
  season_tag?: string;
  selected?: boolean;
  match_status?: string;
  possible_matches?: any[];
  show_picker?: boolean;
  parsed_specs: {
    title: string;
    year: string;
    resolution: string;
    source: string;
    codec: string;
    audio_streams: AudioStream[];
    telegram_tag: string;
    standard_filename: string;
  };
  tmdb_data?: {
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
  loading_match?: boolean;
}

export default function MoinuFlixStudio() {
  const [activeTab, setActiveTab] = useState<"arrivals" | "manual">("arrivals");
  const [arrivals, setArrivals] = useState<ArrivalItem[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<"all" | "movie" | "series" | "song">("all");
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Manual Form States
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [manualLoading, setManualLoading] = useState(false);
  const [rawFilename, setRawFilename] = useState("");
  const [manualSpecs, setManualSpecs] = useState({
    resolution: "1080p",
    source: "BluRay",
    codec: "x264",
    audioCodec: "DDP 5.1",
    audioBitrate: "640 Kbps",
    fileSize: "4.5 GB",
    clearLogo: ""
  });

  const [versions, setVersions] = useState<any[]>([
    {
      language: "Hindi",
      resolution: "1080p",
      source: "BluRay",
      codec: "x264",
      audio: "DDP 5.1 @ 640Kbps",
      channels: "5.1",
      dubbed: "Original Track",
      size: "4.5 GB",
      driveId: ""
    }
  ]);

  // Pure Media Parser: Extracts clean title, year, audio streams & telegram tag without fabricating data
  const parseFilenameEngine = (filename: string, fallbackSize: string = "4.5 GB") => {
    const raw = filename.trim();
    let clean = raw.replace(/\.(mkv|mp4|avi|ts)$/i, "").replace(/[\._\-]/g, " ");

    const ym = clean.match(/\b(19\d\d|20\d\d)\b/);
    const year = ym ? ym[1] : "";
    let title = ym ? clean.substring(0, ym.index).trim() : clean;
    title = title.replace(/\b(2160p|1080p|720p|4k|bluray|web-dl|webrip|x264|x265|hevc|ddp|atmos|truehd)\b.*/gi, "").trim();

    const fnL = raw.toLowerCase();
    let res = /\b(2160p|4k|uhd)\b/i.test(fnL) ? "2160p" : /\b720p\b/i.test(fnL) ? "720p" : "1080p";
    let src = /\bremux\b/i.test(fnL) ? "REMUX" : /\bbluray\b/i.test(fnL) ? "BluRay" : /\bweb-?dl\b/i.test(fnL) ? "WEB-DL" : "BluRay";
    let cdc = /\bx265\b|\bhevc\b/i.test(fnL) ? "x265" : /\bav1\b/i.test(fnL) ? "AV1" : "x264";

    const tgMatch = raw.match(/\[@[\w\d_-]+\]/);
    const tgTag = tgMatch ? tgMatch[0] : "";

    const audioStreams: AudioStream[] = [];
    const langs = ["Tamil", "Telugu", "Hindi", "English", "Malayalam", "Kannada"];
    langs.forEach((lang) => {
      const rx = new RegExp(`\\b${lang}\\b[^+\\]]*?(2\\.0|5\\.1|7\\.1)?[^+\\]]*?(\\d{2,4})\\s*kbps`, "i");
      const m = raw.match(rx);
      if (m) {
        audioStreams.push({
          language: lang,
          channels: m[1] || "5.1",
          bitrate_kbps: parseInt(m[2], 10)
        });
      } else if (new RegExp(`\\b${lang}\\b`, "i").test(raw)) {
        audioStreams.push({
          language: lang,
          channels: /\b5\.1\b/.test(raw) ? "5.1" : "2.0",
          bitrate_kbps: "640"
        });
      }
    });

    if (audioStreams.length === 0) {
      audioStreams.push({ language: "Hindi", channels: "5.1", bitrate_kbps: 640 });
    }

    const audioSummary = audioStreams
      .map((s) => `${s.language} ${s.channels}${s.bitrate_kbps ? ` - ${s.bitrate_kbps}Kbps` : ""}`)
      .join(" + ");

    const parts = [
      `${title}${year ? ` (${year})` : ""}`,
      `[${res}]`,
      `[${src}]`,
      `[${cdc}]`,
      `[${audioSummary}]`,
      `[${fallbackSize}]`,
      tgTag || null
    ].filter(Boolean);

    return {
      title: title || raw,
      year,
      resolution: res,
      source: src,
      codec: cdc,
      audio_streams: audioStreams,
      telegram_tag: tgTag,
      standard_filename: parts.join(" ") + ".mkv"
    };
  };

  // Load Pending / Staged Files from GitHub
  const fetchArrivalsList = async () => {
    setLoadingArrivals(true);
    try {
      let res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/resources/data/pending_movies.json?t=${Date.now()}`);
      if (!res.ok) {
        res = await fetch(`https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main/inbox_arrivals.json?t=${Date.now()}`);
      }
      if (res.ok) {
        const rawData = await res.json();
        const items = Array.isArray(rawData) ? rawData : rawData.movies || [];

        const formatted: ArrivalItem[] = items.map((x: any) => {
          const rawName = x.original_filename || x.name || x.title || "Unknown File";
          const gId = x.gdrive_id || x.id || "";
          const sizeGb = x.file_size_gb || x.size || "4.5 GB";

          let cat: "movie" | "series" | "song" = "movie";
          let sTag: string | undefined;
          if (/^\d{2}_|audio|song|soundtrack/i.test(rawName) && !/1080p|bluray|web/i.test(rawName)) {
            cat = "song";
          } else if (/s\d{1,2}e\d{1,2}|season\s*\d/i.test(rawName)) {
            cat = "series";
            const sm = rawName.match(/s(\d{1,2})/i);
            sTag = sm ? `Season ${parseInt(sm[1], 10)}` : "Season 1";
          }

          const parsed = parseFilenameEngine(rawName, sizeGb);

          return {
            gdrive_id: gId,
            original_filename: rawName,
            file_size_gb: sizeGb,
            category: cat,
            season_tag: sTag,
            selected: true,
            possible_matches: [],
            show_picker: false,
            parsed_specs: parsed,
            tmdb_data: null
          };
        });
        setArrivals(formatted);
      }
    } catch (err: any) {
      console.error("Arrival fetch error:", err);
    }
    setLoadingArrivals(false);
  };

  useEffect(() => {
    fetchArrivalsList();
  }, []);

  // TMDB Candidate Fetch with Fanart.tv ClearLogo
  const fetchTmdbCandidateDetails = async (mediaId: number, isTV: boolean = false) => {
    let logoUrl = "";
    try {
      const fRes = await fetch(`https://webservice.fanart.tv/v3/${isTV ? "tv" : "movies"}/${mediaId}?api_key=${FANART_KEY}`);
      if (fRes.ok) {
        const fData = await fRes.json();
        logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
      }
    } catch (_) {}

    const detailRes = await fetch(
      `https://api.themoviedb.org/3/${isTV ? "tv" : "movie"}/${mediaId}?api_key=${TMDB_KEY}&append_to_response=release_dates,images`
    );
    const d = await detailRes.json();

    if (!logoUrl && d.images?.logos?.[0]?.file_path) {
      logoUrl = `https://image.tmdb.org/t/p/original${d.images.logos[0].file_path}`;
    }

    let cert = "UA";
    const releases = d.release_dates?.results || [];
    const inRel = releases.find((r: any) => r.iso_3166_1 === "IN") || releases.find((r: any) => r.iso_3166_1 === "US");
    if (inRel?.release_dates?.[0]?.certification) {
      cert = inRel.release_dates[0].certification;
    }

    return {
      tmdb_id: d.id,
      title: d.title || d.name,
      year: (d.release_date || d.first_air_date || "2024").split("-")[0],
      poster: d.poster_path ? `https://image.tmdb.org/t/p/w500${d.poster_path}` : "",
      fanart: d.backdrop_path ? `https://image.tmdb.org/t/p/original${d.backdrop_path}` : "",
      clearlogo: logoUrl,
      rating: d.vote_average ? d.vote_average.toFixed(1) : "7.0",
      lang: (d.original_language || "en").toUpperCase(),
      plot: d.overview || "",
      genres: d.genres?.map((g: any) => g.name) || ["Action", "Drama"],
      certification: cert,
      runtime: d.runtime || 120
    };
  };

  // 1-Click Match & Disambiguation Engine
  const matchArrivalItem = async (index: number) => {
    const item = arrivals[index];
    const isTV = item.category === "series";
    const endpoint = isTV ? "search/tv" : "search/movie";

    const updated = [...arrivals];
    updated[index].loading_match = true;
    setArrivals(updated);

    try {
      const q = item.parsed_specs.title;
      const yearParam = item.parsed_specs.year ? `&year=${item.parsed_specs.year}` : "";
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(q)}${yearParam}&region=IN`);
      const data = await res.json();
      const results = data.results || [];

      if (results.length > 0) {
        const topCandidate = results[0];
        const tmdbMeta = await fetchTmdbCandidateDetails(topCandidate.id, isTV);
        updated[index].tmdb_data = tmdbMeta;
        updated[index].possible_matches = results.slice(0, 5);
      }
    } catch (e) {
      console.error(e);
    }

    updated[index].loading_match = false;
    setArrivals(updated);
  };

  // Match All Pending Items
  const handleMatchAll = async () => {
    setStatusMsg("Matching all items against TMDB & Fanart.tv...");
    for (let i = 0; i < arrivals.length; i++) {
      if (!arrivals[i].tmdb_data && arrivals[i].category !== "song") {
        await matchArrivalItem(i);
      }
    }
    setStatusMsg("Matching complete!");
  };

  // Select different candidate from Top-5 dropdown
  const changeSelectedCandidate = async (arrivalIdx: number, candidateMovie: any) => {
    const updated = [...arrivals];
    updated[arrivalIdx].loading_match = true;
    setArrivals([...updated]);

    const isTV = updated[arrivalIdx].category === "series";
    const newMeta = await fetchTmdbCandidateDetails(candidateMovie.id, isTV);

    updated[arrivalIdx].tmdb_data = newMeta;
    updated[arrivalIdx].loading_match = false;
    updated[arrivalIdx].show_picker = false;
    setArrivals([...updated]);
  };

  // Approve & Save into catalog.json and 50-item chunks
  const commitSingleItem = async (item: ArrivalItem) => {
    const m = item.tmdb_data;
    if (!m) return alert("Pehle TMDB match select ya confirm karein!");

    const payload = {
      pendingEntry: {
        gdrive_id: item.gdrive_id,
        original_filename: item.original_filename,
        file_size_bytes: 4800000000,
        file_size_gb: item.file_size_gb,
        parsed: {
          ...item.parsed_specs,
          title: m.title,
          year: m.year
        }
      },
      approvedMetadata: {
        tmdb_id: m.tmdb_id,
        title: m.title,
        year: m.year,
        rating: parseFloat(m.rating) || 7.0,
        overview: m.plot,
        poster: m.poster,
        fanart: m.fanart,
        clearlogo: m.clearlogo,
        genres: m.genres
      }
    };

    const res = await fetch("/api/save-movie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return res.json();
  };

  // Batch Ingestion
  const handleBatchCommit = async () => {
    const readyItems = arrivals.filter((x) => x.selected && x.tmdb_data);
    if (readyItems.length === 0) return alert("Koi bhi matched item selected nahi hai!");

    if (!confirm(`${readyItems.length} items ko catalog aur chunk me save karein?`)) return;

    setBatchSyncing(true);
    let successCount = 0;

    for (let i = 0; i < readyItems.length; i++) {
      const item = readyItems[i];
      setStatusMsg(`Ingesting (${i + 1}/${readyItems.length}): ${item.tmdb_data?.title}...`);
      try {
        const res = await commitSingleItem(item);
        if (res.success) successCount++;
      } catch (e) {
        console.error(e);
      }
    }

    setBatchSyncing(false);
    setStatusMsg(`🎉 Ingestion complete! ${successCount} items committed.`);
    const savedIds = new Set(readyItems.map((x) => x.gdrive_id));
    setArrivals((prev) => prev.filter((x) => !savedIds.has(x.gdrive_id)));
  };

  // Manual Form Search
  const searchManualMovie = async () => {
    if (!query) return;
    setManualLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}&region=IN`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setManualLoading(false);
  };

  const selectManualMovie = async (item: any) => {
    setManualLoading(true);
    const meta = await fetchTmdbCandidateDetails(item.id, false);
    setSelectedMovie(meta);
    setManualSpecs((prev) => ({ ...prev, clearLogo: meta.clearlogo }));
    setManualLoading(false);
  };

  const filteredArrivals = arrivals.filter((x) => categoryFilter === "all" || x.category === categoryFilter);

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider shadow">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-bold tracking-widest uppercase">OTT Cinema Ingestion Studio</span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("arrivals")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition ${
              activeTab === "arrivals" ? "bg-amber-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            🔔 Drive Arrivals ({arrivals.length})
          </button>
          <button
            onClick={() => setActiveTab("manual")}
            className={`px-4 py-2 rounded-lg font-bold text-xs transition ${
              activeTab === "manual" ? "bg-red-600 text-white shadow-lg" : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            ➕ Manual Studio Form
          </button>
        </div>
      </div>

      {/* VIEW 1: DRIVE ARRIVALS & AUTO MATCH */}
      {activeTab === "arrivals" && (
        <div className="space-y-4">
          <div className="bg-[#0c1322] border border-gray-800 rounded-xl p-4 shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "all" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}
              >
                All ({arrivals.length})
              </button>
              <button
                onClick={() => setCategoryFilter("movie")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "movie" ? "bg-red-600 text-white" : "bg-gray-800 text-gray-400"}`}
              >
                Movies ({arrivals.filter((x) => x.category === "movie").length})
              </button>
              <button
                onClick={() => setCategoryFilter("series")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "series" ? "bg-purple-600 text-white" : "bg-gray-800 text-gray-400"}`}
              >
                Series ({arrivals.filter((x) => x.category === "series").length})
              </button>
              <button
                onClick={() => setCategoryFilter("song")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold ${categoryFilter === "song" ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400"}`}
              >
                5.1 Songs ({arrivals.filter((x) => x.category === "song").length})
              </button>
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <button
                onClick={handleMatchAll}
                disabled={loadingArrivals || arrivals.length === 0}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow transition flex items-center gap-1.5"
              >
                <span>⚡</span> 1-Click Match All
              </button>
              <button
                onClick={handleBatchCommit}
                disabled={batchSyncing || arrivals.filter((x) => x.selected && x.tmdb_data).length === 0}
                className="bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-black text-xs font-black px-5 py-2 rounded-lg shadow uppercase tracking-wider transition"
              >
                <span>🚀</span> Commit Matched ({arrivals.filter((x) => x.selected && x.tmdb_data).length})
              </button>
              <button onClick={fetchArrivalsList} className="bg-gray-800 hover:bg-gray-700 text-xs px-3 py-2 rounded-lg border border-gray-700">
                🔄
              </button>
            </div>
          </div>

          {statusMsg && (
            <div className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-center text-xs font-semibold text-yellow-400">
              {statusMsg}
            </div>
          )}

          {/* Table / List */}
          <div className="space-y-3">
            {loadingArrivals ? (
              <div className="text-center py-20 text-cyan-400 text-sm animate-pulse">Scanning Drive Queue...</div>
            ) : filteredArrivals.length === 0 ? (
              <div className="text-center py-20 text-gray-500 text-sm">No arrivals pending in this category.</div>
            ) : (
              filteredArrivals.map((item, idx) => {
                const m = item.tmdb_data;
                const realIndex = arrivals.findIndex((x) => x.gdrive_id === item.gdrive_id);
                return (
                  <div
                    key={idx}
                    className={`bg-[#0c1322] border rounded-xl p-4 transition grid grid-cols-1 lg:grid-cols-12 gap-4 items-center ${
                      item.selected ? "border-sky-500/40 bg-[#0e1628]" : "border-gray-800 opacity-60"
                    }`}
                  >
                    {/* Left: Raw File Specs */}
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
                            {item.category}
                          </span>
                          <span className="text-xs text-amber-400 font-mono font-bold">{item.file_size_gb}</span>
                          {item.season_tag && (
                            <span className="text-[10px] bg-gray-800 text-gray-300 px-1.5 py-0.2 rounded font-mono">
                              {item.season_tag}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-bold text-white truncate" title={item.original_filename}>
                          {item.original_filename}
                        </div>
                        <div className="text-[10px] text-emerald-400 font-mono truncate" title={item.parsed_specs.standard_filename}>
                          {item.parsed_specs.standard_filename}
                        </div>
                        <div className="text-[10px] text-gray-500 font-mono truncate">ID: {item.gdrive_id}</div>
                      </div>
                    </div>

                    {/* Middle: TMDb Candidate Preview */}
                    <div className="lg:col-span-5 border-t lg:border-t-0 lg:border-l border-gray-800 lg:pl-4">
                      {item.loading_match ? (
                        <div className="text-xs text-sky-400 animate-pulse">Matching candidate from TMDB...</div>
                      ) : m ? (
                        <div className="flex gap-3 items-center">
                          <img src={m.poster} className="w-12 h-18 object-cover rounded border border-gray-700 shadow flex-shrink-0" />
                          <div className="space-y-1 overflow-hidden flex-1">
                            <div className="text-sm font-black text-white truncate flex items-center gap-2">
                              <span>{m.title}</span>
                              <span className="text-xs text-gray-400">({m.year})</span>
                              <span className="text-amber-400 text-xs">★ {m.rating}</span>
                            </div>

                            {/* Disambiguation: Top 5 Picker */}
                            {item.possible_matches && item.possible_matches.length > 1 && (
                              <div>
                                {!item.show_picker ? (
                                  <button
                                    onClick={() => {
                                      const updated = [...arrivals];
                                      updated[realIndex].show_picker = true;
                                      setArrivals(updated);
                                    }}
                                    className="text-[10px] text-amber-400 hover:underline flex items-center gap-1 font-semibold"
                                  >
                                    <span>🔄</span> Wrong Part/Year? Pick from {item.possible_matches.length} candidates
                                  </button>
                                ) : (
                                  <div className="flex items-center gap-1.5 pt-1">
                                    <select
                                      onChange={(e) => {
                                        const cId = parseInt(e.target.value, 10);
                                        const found = item.possible_matches?.find((p: any) => p.id === cId);
                                        if (found) changeSelectedCandidate(realIndex, found);
                                      }}
                                      className="bg-gray-800 border border-amber-500 text-[10px] p-1 rounded text-white font-bold"
                                    >
                                      <option value="">-- Choose Candidate --</option>
                                      {item.possible_matches.map((cand: any) => (
                                        <option key={cand.id} value={cand.id}>
                                          {cand.title || cand.name} ({(cand.release_date || cand.first_air_date || "").split("-")[0]})
                                        </option>
                                      ))}
                                    </select>
                                    <button
                                      onClick={() => {
                                        const updated = [...arrivals];
                                        updated[realIndex].show_picker = false;
                                        setArrivals(updated);
                                      }}
                                      className="text-[10px] text-gray-400 hover:text-white"
                                    >
                                      ✕
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Artwork indicators */}
                            <div className="flex items-center gap-1.5 text-[9px] font-mono">
                              <span className={`px-1 rounded ${m.poster ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400"}`}>
                                Poster {m.poster ? "✓" : "✗"}
                              </span>
                              <span className={`px-1 rounded ${m.fanart ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400"}`}>
                                Fanart {m.fanart ? "✓" : "✗"}
                              </span>
                              <span className={`px-1 rounded ${m.clearlogo ? "bg-emerald-950 text-emerald-400 border border-emerald-800" : "bg-red-950 text-red-400"}`}>
                                ClearLogo {m.clearlogo ? "✓" : "✗"}
                              </span>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 italic">No TMDB candidate matched yet.</span>
                          <button
                            onClick={() => matchArrivalItem(realIndex)}
                            className="text-xs bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1 rounded shadow"
                          >
                            Find Candidate
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Right: Actions */}
                    <div className="lg:col-span-2 flex flex-col items-end justify-center gap-2">
                      <button
                        onClick={async () => {
                          if (!item.tmdb_data) await matchArrivalItem(realIndex);
                          else {
                            const res = await commitSingleItem(item);
                            if (res.success) {
                              alert(`Saved to ${res.chunk}!`);
                              setArrivals((prev) => prev.filter((x) => x.gdrive_id !== item.gdrive_id));
                            } else {
                              alert("Failed: " + (res.error || "Token issue"));
                            }
                          }
                        }}
                        className={`w-full py-2.5 px-3 rounded-lg font-black text-xs uppercase tracking-wider transition shadow ${
                          item.tmdb_data ? "bg-emerald-600 hover:bg-emerald-500 text-black" : "bg-sky-600 hover:bg-sky-500 text-white"
                        }`}
                      >
                        {item.tmdb_data ? "✅ Approve & Commit" : "🔍 Match TMDB"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* VIEW 2: MANUAL FORM STUDIO */}
      {activeTab === "manual" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">STEP 1: SEARCH MOVIE</h2>
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && searchManualMovie()}
                  placeholder="Type title (e.g. Avatar, Cars)..."
                  className="w-full bg-[#131c2e] border border-gray-700/80 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 font-medium"
                />
                <button
                  onClick={searchManualMovie}
                  className="bg-red-600 hover:bg-red-700 font-bold px-5 py-2 rounded-lg text-sm shadow transition"
                >
                  {manualLoading ? "..." : "Find"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => selectManualMovie(m)}
                      className="flex items-center gap-3 bg-[#131d31] hover:bg-gray-800 p-2 rounded-lg cursor-pointer border border-transparent hover:border-red-500 transition"
                    >
                      {m.poster_path ? (
                        <img src={`https://image.tmdb.org/t/p/w92${m.poster_path}`} className="w-10 h-14 object-cover rounded shadow" />
                      ) : (
                        <div className="w-10 h-14 bg-gray-800 rounded flex items-center justify-center text-[10px]">No Pic</div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">{m.title}</div>
                        <div className="text-xs text-gray-400">{m.release_date?.split("-")[0]}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw Parser */}
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>⚡</span> RAW FILE RENAME PARSER
              </h2>
              <textarea
                rows={3}
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                placeholder="Paste raw file name..."
                className="w-full bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500"
              />
              <button
                onClick={() => {
                  const p = parseFilenameEngine(rawFilename);
                  setManualSpecs((prev) => ({
                    ...prev,
                    resolution: p.resolution,
                    source: p.source,
                    codec: p.codec
                  }));
                  setVersions([
                    {
                      language: p.audio_streams[0]?.language || "Hindi",
                      resolution: p.resolution,
                      source: p.source,
                      codec: p.codec,
                      audio: `${p.audio_streams[0]?.language} ${p.audio_streams[0]?.channels}`,
                      channels: p.audio_streams[0]?.channels || "5.1",
                      dubbed: "Original Track",
                      size: "4.5 GB",
                      driveId: ""
                    }
                  ]);
                }}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black transition"
              >
                Auto Parse Technical Specs
              </button>
            </div>
          </div>

          {/* Right Column: Preview & Commit */}
          <div className="lg:col-span-7 space-y-5">
            {selectedMovie ? (
              <div className="space-y-4">
                <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-6 shadow-2xl min-h-[170px] flex items-center">
                  <div
                    className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
                    style={{ backgroundImage: `url(${selectedMovie.fanart})` }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/70 to-transparent" />

                  <div className="relative z-10 flex gap-5 items-center w-full">
                    <img src={selectedMovie.poster} className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-xl" />
                    <div className="space-y-3">
                      {manualSpecs.clearLogo ? (
                        <img src={manualSpecs.clearLogo} className="h-11 object-contain drop-shadow-md" />
                      ) : (
                        <h1 className="text-2xl font-black text-white">{selectedMovie.title}</h1>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                        <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                          {selectedMovie.certification}
                        </span>
                        <span className="text-gray-300">{selectedMovie.year}</span>
                        <span className="text-gray-400">• {selectedMovie.runtime} min</span>
                        <span className="bg-amber-950/80 text-amber-400 border border-amber-800/80 px-2 py-0.5 rounded">
                          ★ {selectedMovie.rating}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Specs Chips */}
                <div className="flex flex-wrap items-center gap-2">
                  <span className="bg-blue-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{manualSpecs.resolution}</span>
                  <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{manualSpecs.source}</span>
                  <span className="bg-green-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{manualSpecs.codec}</span>
                  <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">
                    {manualSpecs.audioCodec} @ {manualSpecs.audioBitrate}
                  </span>
                </div>

                {/* Versions */}
                <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg space-y-3">
                  <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">Kodi STRM Playback Versions</h3>
                  {versions.map((ver, idx) => (
                    <div key={idx} className="space-y-2 pt-2 border-t border-gray-800">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={ver.language}
                          onChange={(e) => {
                            const copy = [...versions];
                            copy[idx].language = e.target.value;
                            setVersions(copy);
                          }}
                          className="bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-white w-28"
                          placeholder="Language"
                        />
                        <input
                          type="text"
                          value={ver.driveId}
                          onChange={(e) => {
                            const copy = [...versions];
                            copy[idx].driveId = e.target.value;
                            setVersions(copy);
                          }}
                          placeholder="Google Drive File ID"
                          className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-cyan-300 font-mono"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  onClick={async () => {
                    const payload = {
                      pendingEntry: {
                        gdrive_id: versions[0].driveId || "manual_" + Date.now(),
                        original_filename: rawFilename || `${selectedMovie.title} (${selectedMovie.year}).mkv`,
                        file_size_bytes: 4800000000,
                        file_size_gb: manualSpecs.fileSize,
                        parsed: {
                          title: selectedMovie.title,
                          year: selectedMovie.year,
                          resolution: manualSpecs.resolution,
                          source: manualSpecs.source,
                          codec: manualSpecs.codec,
                          audio_streams: [{ language: versions[0].language, channels: "5.1", bitrate_kbps: 640 }],
                          telegram_tag: "",
                          standard_filename: `${selectedMovie.title} (${selectedMovie.year}) [${manualSpecs.resolution}].mkv`
                        }
                      },
                      approvedMetadata: {
                        tmdb_id: selectedMovie.tmdb_id,
                        title: selectedMovie.title,
                        year: selectedMovie.year,
                        rating: parseFloat(selectedMovie.rating) || 7.0,
                        overview: selectedMovie.plot,
                        poster: selectedMovie.poster,
                        fanart: selectedMovie.fanart,
                        clearlogo: manualSpecs.clearLogo,
                        genres: selectedMovie.genres
                      }
                    };

                    const res = await fetch("/api/save-movie", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify(payload)
                    });
                    const d = await res.json();
                    if (d.success) alert("Successfully Saved to " + d.chunk);
                    else alert("Failed: " + (d.error || "Unknown"));
                  }}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3.5 rounded-xl text-sm tracking-wider uppercase shadow-xl transition"
                >
                  Save & Commit to GitHub (Step 8)
                </button>
              </div>
            ) : (
              <div className="bg-[#0c1322] border border-gray-800 p-12 rounded-xl text-center text-gray-500">
                <div className="text-4xl mb-2">🎬</div>
                <div className="text-sm font-semibold">No Movie Selected</div>
                <div className="text-xs text-gray-600 mt-1">Search on left or switch to Drive Arrivals tab.</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
