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
  mediaType: "movie" | "series" | "song";
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
  const [categoryFilter, setCategoryFilter] = useState<"all" | "movie" | "series" | "song">("all");
  const [batchProgress, setBatchProgress] = useState("");

  // Verified Form State
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ msg: string; isError: boolean } | null>(null);
  const [standardRenameString, setStandardRenameString] = useState("");
  const [specs, setSpecs] = useState<any>({});
  const [versions, setVersions] = useState<any[]>([]);

  // 1. Auto Classify MediaType (Movie vs Series vs 5.1 Song)
  const detectMediaType = (fn: string): "movie" | "series" | "song" => {
    const lower = fn.toLowerCase();
    // Song markers (01_Title, Track, Song, 60fps_kmw audio rips)
    if (/^\d{2}_|\bsong\b|\baudio\b|_full\b|\bkmw\b/i.test(lower)) {
      return "song";
    }
    // Series markers (S01, E01, Season, Episode)
    if (/s\d{1,2}e\d{1,2}|season|episode|s\d{1,2}\b/i.test(lower)) {
      return "series";
    }
    return "movie";
  };

  // 2. Fetch Arrivals
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
          const fullTitle = x.title || x.name || "Untitled File";
          return {
            title: fullTitle,
            gdrive_id: x.gdrive_id || x.id || "",
            size: cleanGb,
            mediaType: detectMediaType(fullTitle),
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

  // 3. Technical Parser with DVD / DVDRip / DTH / NF / AMZN Support
  const parseTechnicalTokens = (rawName: string, defaultLang: string, defaultSize: string) => {
    const raw = rawName;

    // Source Priority: DVDRip, DVD, BluRay, REMUX, NF, AMZN, WEB-DL
    let src = "WEB-DL";
    if (/\bdvdrip\b/i.test(raw)) src = "DVDRip";
    else if (/\bdvd\b/i.test(raw)) src = "DVD";
    else if (/\bnf\b|netflix/i.test(raw)) src = "NF";
    else if (/\bamzn\b|prime|amazon/i.test(raw)) src = "AMZN";
    else if (/\bdsnp\b|hotstar/i.test(raw)) src = "DSNP";
    else if (/\bzee5\b/i.test(raw)) src = "ZEE5";
    else if (/\bsonyliv\b|\bsony\b/i.test(raw)) src = "SONYLIV";
    else if (/\bremux\b/i.test(raw)) src = "REMUX";
    else if (/\bbluray\b|\bbd\b/i.test(raw)) src = "BluRay";
    else if (/\bhdtv\b|\bdth\b/i.test(raw)) src = "HDTV";

    // Resolution
    let res = "1080p";
    if (/2160p|4k|uhd/i.test(raw)) res = "2160p";
    else if (/720p/i.test(raw)) res = "720p";
    else if (/576p|480p/i.test(raw)) res = "576p";

    // Codec
    let cdc = "x264";
    if (/x265|hevc|h\.265/i.test(raw)) cdc = "x265";
    else if (/x264|avc|h\.264/i.test(raw)) cdc = "x264";

    // Audio & Channels & Bitrate
    let parsedAudioTracks: string[] = [];
    const langList = ["Hindi", "Tamil", "Telugu", "English", "Malayalam", "Kannada"];
    langList.forEach((lng) => {
      const reg = new RegExp(`(${lng})[^+\\]\\[]*`, "i");
      const match = raw.match(reg);
      if (match) {
        let chunk = match[0];
        let ch = /7\.1|7\s1/i.test(chunk) ? "7.1" : /2\.0|2\s0|stereo/i.test(chunk) ? "2.0" : "5.1";
        let br = "640Kbps";
        if (/dts/i.test(chunk) || /1509/i.test(raw)) br = "1509Kbps";
        else {
          const brMatch = chunk.match(/(\d{3,4})\s*k/i);
          if (brMatch) br = `${brMatch[1]}Kbps`;
          else if (/768/i.test(raw)) br = "768Kbps";
          else if (/448/i.test(raw)) br = "448Kbps";
        }
        parsedAudioTracks.push(`${lng} ${ch} - ${br}`);
      }
    });

    if (parsedAudioTracks.length === 0) {
      let ch = /7\.1/i.test(raw) ? "7.1" : /2\.0/i.test(raw) ? "2.0" : "5.1";
      let br = /1509|dts/i.test(raw) ? "1509Kbps" : "640Kbps";
      parsedAudioTracks.push(`${defaultLang} ${ch} - ${br}`);
    }

    const audioTrackString = parsedAudioTracks.join(" + ");
    return { source: src, resolution: res, codec: cdc, audioTrackString, size: defaultSize };
  };

  // 4. TMDb Match Single (Handles Movie vs Series vs Songs)
  const fetchSingleMatch = async (titleStr: string, defaultSize: string, mediaType: "movie" | "series" | "song") => {
    if (mediaType === "song") {
      // Direct Clean Song Format (No Movie TMDb Pollution)
      const cleanSong = titleStr.replace(/\.mkv|\.mp4/i, "").replace(/[._-]/g, " ").trim();
      return {
        tmdb_id: 0,
        title: cleanSong,
        year: "2024",
        poster: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=500",
        fanart: "",
        clearlogo: "",
        rating: "8.0",
        lang: "TA",
        plot: "5.1 Surround Audio Track / Master Video Song",
        certification: "U",
        runtime: 5,
        standardRename: `${cleanSong} [1080p] [5.1 Surround - 640Kbps] [${defaultSize}].mkv`,
        source: "Audio 5.1",
        resolution: "1080p",
        codec: "x264",
        audioTrackString: "Tamil 5.1 Surround"
      };
    }

    let clean = titleStr.replace(/\.mkv|\.mp4/i, "").split(/[0-9]{4}|1080p|720p|2160p|WEB|NF|AMZN|DVD|DVDRIP/i)[0].replace(/[._-]/g, " ").trim();
    const yearMatch = titleStr.match(/\b(19\d\d|20\d\d)\b/);
    const yearParam = yearMatch ? `&primary_release_year=${yearMatch[1]}` : "";
    const endpoint = mediaType === "series" ? "search/tv" : "search/movie";

    try {
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(clean)}&region=IN${yearParam}`);
      const data = await res.json();
      const top = data.results?.[0];
      if (!top) return null;

      let logoUrl = "";
      if (mediaType === "movie") {
        try {
          const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${top.id}?api_key=${FANART_KEY}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
          }
        } catch (_) {}
      }

      if (!logoUrl) {
        const imgRes = await fetch(`https://api.themoviedb.org/3/${mediaType === "series" ? "tv" : "movie"}/${top.id}/images?api_key=${TMDB_KEY}`);
        const imgData = await imgRes.json();
        if (imgData.logos?.[0]?.file_path) {
          logoUrl = `https://image.tmdb.org/t/p/original${imgData.logos[0].file_path}`;
        }
      }

      const rawTitle = top.title || top.name;
      const langCode = (top.original_language || "hi").toUpperCase();
      const fallbackLang = langCode === "TA" ? "Tamil" : langCode === "TE" ? "Telugu" : langCode === "HI" ? "Hindi" : "English";
      const parsed = parseTechnicalTokens(titleStr, fallbackLang, defaultSize);
      const relDate = top.release_date || top.first_air_date;
      const year = relDate ? relDate.split("-")[0] : (yearMatch ? yearMatch[1] : "2024");
      const standardRename = `${rawTitle} (${year}) [${parsed.resolution}] [${parsed.source}] [${parsed.audioTrackString}] [${parsed.size}].mkv`;

      return {
        tmdb_id: top.id,
        title: rawTitle,
        year,
        poster: top.poster_path ? `https://image.tmdb.org/t/p/w500${top.poster_path}` : "",
        fanart: top.backdrop_path ? `https://image.tmdb.org/t/p/original${top.backdrop_path}` : "",
        clearlogo: logoUrl,
        rating: top.vote_average ? top.vote_average.toFixed(1) : "7.0",
        lang: langCode,
        plot: top.overview || "",
        certification: "UA",
        runtime: mediaType === "series" ? 45 : 130,
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

  // 5. 1-Click Match All
  const handleMatchAll = async () => {
    if (arrivals.length === 0) return;
    setMatchingAll(true);
    const updated = [...arrivals];

    for (let i = 0; i < updated.length; i++) {
      if (!updated[i].match) {
        setBatchProgress(`Fetching (${i + 1}/${updated.length}): ${updated[i].title.slice(0, 25)}...`);
        const matchData = await fetchSingleMatch(updated[i].title, updated[i].size, updated[i].mediaType);
        if (matchData) updated[i].match = matchData;
      }
    }
    setArrivals(updated);
    setMatchingAll(false);
    setBatchProgress("✅ All items categorized & matched!");
  };

  // 6. Submit Item into Detailed Verified Form (Direct Visual Verification)
  const openDetailedForm = (item: ArrivalItem) => {
    if (!item.match) return alert("Pehle is item ka TMDb Match fetch karein!");

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
      mediaType: item.mediaType,
      gdrive_id: item.gdrive_id
    });

    setStandardRenameString(m.standardRename || "");
    setSpecs({
      source: m.source || "WEB-DL",
      audioCodec: "Dolby Atmos",
      audioBitrate: "640 Kbps",
      fileSize: item.size,
      resolution: m.resolution || "1080p",
      enhancement: "DS4K",
      colorDepth: "10bit",
      codec: m.codec || "x264",
      audioTrackString: m.audioTrackString || "Tamil 5.1 - 640Kbps",
      clearLogo: m.clearlogo || ""
    });

    setVersions([
      {
        language: m.audioTrackString?.includes("Hindi") ? "Hindi" : (m.lang === "TA" ? "Tamil" : "Telugu"),
        resolution: m.resolution || "1080p",
        source: m.source || "WEB-DL",
        codec: m.codec || "x264",
        audio: "Dolby Atmos",
        channels: "5.1",
        dubbed: m.audioTrackString,
        size: item.size,
        driveId: item.gdrive_id
      }
    ]);

    setCommitStatus(null);
    setActiveTab("form");
  };

  // 7. Commit Single Verified Form to GitHub (Two-Tier catalog.json + chunks)
  const handleCommitForm = async () => {
    if (!selectedMovie) return;
    setLoadingCommit(true);
    setCommitStatus({ msg: "Committing verified record to GitHub...", isError: false });

    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie: selectedMovie,
          specs: specs,
          versions: versions,
          rawFilename: standardRenameString
        })
      });

      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          msg: `🎉 Success! Verified & Saved to catalog.json & ${data.chunk}!`,
          isError: false
        });
        setArrivals(prev => prev.filter(x => x.gdrive_id !== selectedMovie.gdrive_id));
      } else {
        setCommitStatus({ msg: `❌ Failed: ${data.error}`, isError: true });
      }
    } catch (e: any) {
      setCommitStatus({ msg: `❌ Error: ${e.message}`, isError: true });
    }
    setLoadingCommit(false);
  };

  const filteredArrivals = arrivals.filter(item => {
    if (categoryFilter === "all") return true;
    return item.mediaType === categoryFilter;
  });

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      {/* Top Navbar */}
      <div className="flex items-center justify-between border-b border-gray-800 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
          <span className="text-xs text-gray-400 font-semibold tracking-widest uppercase">VERIFIED STUDIO MANAGER</span>
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

      {/* VIEW 1: SEPARATED ARRIVALS WITH CATEGORY PILLS */}
      {activeTab === "arrivals" && (
        <div className="bg-[#0c1322] border border-gray-800 rounded-2xl p-6 shadow-2xl">
          <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-4 mb-6 border-b border-gray-800 pb-5">
            <div>
              <h2 className="text-lg font-black text-white flex items-center gap-2">
                <span>⚡</span> Drive Arrivals ({filteredArrivals.length}) — Categorized Verification
              </h2>
              <p className="text-xs text-gray-400 mt-1">
                Movies, Web Series aur 5.1 Songs alag filter me hain taaki galat TMDb match ka koi chance na rahe.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                disabled={matchingAll || arrivals.length === 0}
                onClick={handleMatchAll}
                className="bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white text-xs font-bold px-4 py-2 rounded-lg shadow flex items-center gap-1.5 transition"
              >
                <span>⚡</span> {matchingAll ? "Matching..." : "1-Click Match All"}
              </button>
              <button onClick={fetchRealArrivals} className="bg-gray-800 hover:bg-gray-700 text-xs font-bold px-3 py-2 rounded-lg border border-gray-700">
                🔄 Refresh
              </button>
            </div>
          </div>

          {/* Category Filter Pills (Separate Songs & Series) */}
          <div className="flex flex-wrap gap-2 mb-4 text-xs font-bold">
            <button
              onClick={() => setCategoryFilter("all")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                categoryFilter === "all" ? "bg-red-600 border-red-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              🍿 All Items ({arrivals.length})
            </button>
            <button
              onClick={() => setCategoryFilter("movie")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                categoryFilter === "movie" ? "bg-red-600 border-red-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              🎬 Movies ({arrivals.filter(x => x.mediaType === "movie").length})
            </button>
            <button
              onClick={() => setCategoryFilter("series")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                categoryFilter === "series" ? "bg-red-600 border-red-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              📺 Web Series ({arrivals.filter(x => x.mediaType === "series").length})
            </button>
            <button
              onClick={() => setCategoryFilter("song")}
              className={`px-3 py-1.5 rounded-lg border transition ${
                categoryFilter === "song" ? "bg-red-600 border-red-500 text-white" : "bg-gray-900 border-gray-800 text-gray-400 hover:text-white"
              }`}
            >
              🎵 5.1 Songs ({arrivals.filter(x => x.mediaType === "song").length})
            </button>
          </div>

          {batchProgress && (
            <div className="text-amber-400 font-mono text-xs mb-4 bg-amber-950/40 p-2 rounded border border-amber-800">
              {batchProgress}
            </div>
          )}

          {loadingArrivals ? (
            <div className="text-center py-16 text-cyan-400 animate-pulse text-sm">Loading Google Drive arrivals from repository...</div>
          ) : filteredArrivals.length === 0 ? (
            <div className="text-center py-16 text-gray-500 text-sm">🎉 No pending arrivals in this category!</div>
          ) : (
            <div className="space-y-3">
              {filteredArrivals.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#10192d] border border-gray-800 hover:border-gray-700 rounded-xl p-3.5 transition grid grid-cols-1 lg:grid-cols-12 gap-3 items-center"
                >
                  {/* Left Info */}
                  <div className="lg:col-span-5 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                        item.mediaType === "movie"
                          ? "bg-cyan-950 text-cyan-400 border-cyan-800"
                          : item.mediaType === "series"
                          ? "bg-purple-950 text-purple-400 border-purple-800"
                          : "bg-emerald-950 text-emerald-400 border-emerald-800"
                      }`}>
                        {item.mediaType === "movie" ? "🎬 Movie" : item.mediaType === "series" ? "📺 Series" : "🎵 5.1 Song"}
                      </span>
                      <span className="text-xs text-amber-400 font-mono font-bold">{item.size}</span>
                    </div>
                    <div className="text-xs font-bold text-white break-all" title={item.title}>{item.title}</div>
                    <div className="text-[10px] text-gray-500 font-mono">ID: {item.gdrive_id}</div>
                  </div>

                  {/* Center TMDb Match Bajuk */}
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
                            <span className="bg-red-950 text-red-400 px-1 py-0.2 rounded border border-red-800 text-[9px]">
                              {item.match.source}
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

                  {/* Right Action: Open Verified Form */}
                  <div className="lg:col-span-2 flex justify-end">
                    <button
                      onClick={() => openDetailedForm(item)}
                      className="w-full bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-extrabold text-xs py-2 px-3 rounded-lg shadow transition"
                    >
                      ✏️ Inspect & Submit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: VERIFIED FORM (OPENS UPON CLICKING SUBMIT) */}
      {activeTab === "form" && selectedMovie && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Rename & Specs */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                <span>⚡</span> STEP 4: STANDARD RENAME FORMAT
              </h2>
              <div className="bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-emerald-300 break-all leading-relaxed">
                {standardRenameString}
              </div>
              <div className="mt-3 text-[11px] text-gray-400 flex justify-between">
                <span>Kodi Clean Title: <strong className="text-white">{selectedMovie.title}</strong></span>
                <span>TMDb ID: <strong className="text-amber-400">{selectedMovie.id}</strong></span>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg space-y-3">
              <h3 className="text-xs font-bold text-gray-300 uppercase">Master Tech Configuration</h3>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="text-[10px] text-gray-400">Source (DVDRip / DVD / NF / BluRay)</label>
                  <input
                    type="text"
                    value={specs.source || ""}
                    onChange={(e) => {
                      setSpecs({ ...specs, source: e.target.value });
                      setStandardRenameString(`${selectedMovie.title} (${selectedMovie.year}) [${specs.resolution}] [${e.target.value}] [${specs.audioTrackString}] [${specs.fileSize}].mkv`);
                    }}
                    className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-amber-400 font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Resolution</label>
                  <input
                    type="text"
                    value={specs.resolution || ""}
                    onChange={(e) => setSpecs({ ...specs, resolution: e.target.value })}
                    className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                  />
                </div>
                <div className="col-span-2">
                  <label className="text-[10px] text-gray-400">Multi-Audio Track Details</label>
                  <input
                    type="text"
                    value={specs.audioTrackString || ""}
                    onChange={(e) => {
                      setSpecs({ ...specs, audioTrackString: e.target.value });
                      setStandardRenameString(`${selectedMovie.title} (${selectedMovie.year}) [${specs.resolution}] [${specs.source}] [${e.target.value}] [${specs.fileSize}].mkv`);
                    }}
                    className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-cyan-300 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-400">Clean Size</label>
                  <input
                    type="text"
                    value={specs.fileSize || ""}
                    onChange={(e) => setSpecs({ ...specs, fileSize: e.target.value })}
                    className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Visual Cinema Card + Save Button */}
          <div className="lg:col-span-7 space-y-5">
            <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-6 shadow-2xl min-h-[170px] flex items-center">
              <div
                className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
                style={{ backgroundImage: `url(${selectedMovie.fanart || "https://image.tmdb.org/t/p/original/sd4xN5xi8tKRPrJOWwNiZEile7f.jpg"})` }}
              />
              <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/70 to-transparent" />

              <div className="relative z-10 flex gap-5 items-center w-full">
                <img src={selectedMovie.poster || "https://image.tmdb.org/t/p/w500/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"} className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-xl" />
                <div className="space-y-3">
                  {specs.clearLogo ? (
                    <img src={specs.clearLogo} className="h-11 object-contain drop-shadow-md" alt="ClearLogo" />
                  ) : (
                    <h1 className="text-2xl font-black text-white">{selectedMovie.title}</h1>
                  )}
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                    <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded">{selectedMovie.cert || "UA"}</span>
                    <span className="text-gray-300">{selectedMovie.year}</span>
                    <span className="text-gray-400">• {selectedMovie.runtime} min</span>
                    <span className="bg-amber-950/80 text-amber-400 border border-amber-800 px-2 py-0.5 rounded flex items-center gap-1">★ IMDb {selectedMovie.rating}</span>
                    <span className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">LANG: {selectedMovie.lang}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0c1322] border border-gray-800 p-4 rounded-xl shadow-lg">
              <label className="text-[11px] font-bold text-gray-400 block mb-2">Kodi ClearLogo URL</label>
              <input
                type="text"
                value={specs.clearLogo || ""}
                onChange={(e) => setSpecs({ ...specs, clearLogo: e.target.value })}
                className="w-full bg-[#131c2e] border border-gray-700 px-3 py-2 rounded-lg text-xs text-amber-300 font-mono focus:outline-none"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="bg-blue-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.resolution}</span>
              <span className="bg-red-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.source}</span>
              <span className="bg-green-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.codec}</span>
              <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.audioTrackString}</span>
              <span className="bg-[#8b2d18] font-bold text-xs px-3 py-1 rounded text-white shadow flex items-center gap-1">📦 {specs.fileSize}</span>
            </div>

            <button
              disabled={loadingCommit}
              onClick={handleCommitForm}
              className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-black font-black py-4 rounded-xl text-sm tracking-wider uppercase shadow-xl transition"
            >
              {loadingCommit ? "Validating & Committing to GitHub..." : "Save Verified Record to GitHub (Step 8)"}
            </button>

            {commitStatus && (
              <div className={`p-3 border rounded-lg text-center text-xs font-bold ${
                commitStatus.isError ? "bg-red-950/80 border-red-800 text-red-300" : "bg-emerald-950/80 border-emerald-800 text-emerald-300"
              }`}>
                {commitStatus.msg}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
