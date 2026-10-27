"use client";
import React, { useState, useEffect } from "react";

const CATEGORIES = [
  "Hollywood (English)",
  "Bollywood (Hindi)",
  "Kollywood (Tamil)",
  "Tollywood (Telugu)",
  "Mollywood (Malayalam)",
  "Sandalwood (Kannada)",
  "Animation / Kids",
  "World Cinema",
];

const ALL_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Malayalam", "Kannada"];

export default function MoinuFlixAdminStudio() {
  const [activeTab, setActiveTab] = useState<"movies" | "editor" | "json">("editor");
  const [arrivals, setArrivals] = useState<any[]>([]);
  const [loadingArrivals, setLoadingArrivals] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const fetchArrivals = async () => {
    setLoadingArrivals(true);
    try {
      const res = await fetch("/api/drive-arrivals");
      const data = await res.json();
      setArrivals(data.arrivals || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingArrivals(false);
    }
  };

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
        alert(`🎉 Successfully matched & saved: ${data.saved} into catalog & chunk!`);
        setArrivals(prev => prev.filter(x => x.gdrive_id !== item.gdrive_id));
      } else {
        alert(`❌ Error: ${data.error || 'Failed to auto match'}`);
      }
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setSyncingId(null);
    }
  };


  // Search & Loading
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [commitStatus, setCommitStatus] = useState<{ text: string; success: boolean } | null>(null);

  // Library State
  const [library, setLibrary] = useState<any[]>([]);
  const [libSearch, setLibSearch] = useState("");
  const [loadingLibrary, setLoadingLibrary] = useState(false);

  // Active Movie State
  const [movie, setMovie] = useState<any>(null);
  const [category, setCategory] = useState("Hollywood (English)");
  const [selectedLangs, setSelectedLangs] = useState<string[]>(["English"]);
  const [rawFilename, setRawFilename] = useState("");

  // Technical Specs
  const [specs, setSpecs] = useState({
    resolution: "1080p",
    source: "BluRay",
    enhancement: "Standard",
    colorDepth: "10bit",
    hdr: "SDR",
    codec: "x265",
    audioCodec: "Dolby Atmos",
    channels: "5.1",
    fileSize: "5 GB",
    format: "MKV",
    subtitles: ["ESub"],
  });

  // Playback Versions
  const [versions, setVersions] = useState<any[]>([
    {
      id: "ver-1",
      language: "English",
      dubbed: "Original Track",
      quality: "1080p",
      source: "BluRay",
      codec: "x265",
      audio: "Dolby Atmos",
      channels: "5.1",
      size: "5 GB",
      linkType: "gdrive",
      stream_url: "",
    },
  ]);

  useEffect(() => {
    fetchLibrary();
  }, []);

  const fetchLibrary = async () => {
    setLoadingLibrary(true);
    try {
      const res = await fetch("/api/movies");
      const data = await res.json();
      if (data.movies) setLibrary(data.movies);
    } catch (_) {}
    setLoadingLibrary(false);
  };

  const detectCategory = (lang: string) => {
    switch (lang) {
      case "en": return "Hollywood (English)";
      case "hi": return "Bollywood (Hindi)";
      case "ta": return "Kollywood (Tamil)";
      case "te": return "Tollywood (Telugu)";
      case "ml": return "Mollywood (Malayalam)";
      case "kn": return "Sandalwood (Kannada)";
      default: return "Hollywood (English)";
    }
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setSearching(true);
    setCommitStatus(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err: any) {
      alert("Search failed: " + err.message);
    }
    setSearching(false);
  };

  const handleSelectMovie = async (tmdbId: number) => {
    setLoadingMeta(true);
    setCommitStatus(null);
    try {
      const res = await fetch(`/api/fetch-meta?id=${tmdbId}`);
      const data = await res.json();
      if (data.error) {
        alert(data.error);
      } else {
        setMovie(data);
        const cat = detectCategory(data.original_language);
        setCategory(cat);
        const initialLang =
          data.original_language === "en" ? "English" :
          data.original_language === "ta" ? "Tamil" :
          data.original_language === "te" ? "Telugu" :
          data.original_language === "hi" ? "Hindi" : "English";
        setSelectedLangs([initialLang]);
        setVersions([
          {
            id: `ver-${Date.now()}`,
            language: initialLang,
            dubbed: "Original Track",
            quality: specs.resolution,
            source: specs.source,
            codec: specs.codec,
            audio: specs.audioCodec,
            channels: specs.channels,
            size: specs.fileSize,
            linkType: "gdrive",
            stream_url: "",
          },
        ]);
      }
    } catch (err: any) {
      alert("Metadata load error: " + err.message);
    }
    setLoadingMeta(false);
  };

  const parseFilename = () => {
    if (!rawFilename.trim()) return;
    const fn = rawFilename.toLowerCase();

    let res = "1080p";
    if (fn.includes("2160p") || fn.includes("4k")) res = "2160p";
    else if (fn.includes("720p")) res = "720p";

    let enh = "Standard";
    if (fn.includes("ds4k")) enh = "DS4K";
    else if (fn.includes("remux")) enh = "Remux";
    else if (fn.includes("imax")) enh = "IMAX";

    let src = "BluRay";
    if (fn.includes("amzn") || fn.includes("prime")) src = "AMZN";
    else if (fn.includes("nf") || fn.includes("netflix")) src = "NF";
    else if (fn.includes("dsnp") || fn.includes("hotstar")) src = "DSNP";
    else if (fn.includes("zee5")) src = "ZEE5";
    else if (fn.includes("sonyliv")) src = "SONYLIV";
    else if (fn.includes("bluray") || fn.includes("bd")) src = "BluRay";
    else if (fn.includes("web-dl") || fn.includes("webdl")) src = "WEB-DL";

    const col = fn.includes("10bit") ? "10bit" : "8bit";
    let hdr = "SDR";
    if (fn.includes("hdr10+")) hdr = "HDR10+";
    else if (fn.includes("hdr")) hdr = "HDR10";
    else if (fn.includes("dv") || fn.includes("dolby vision")) hdr = "Dolby Vision";

    let cdc = "x265";
    if (fn.includes("x264") || fn.includes("h.264") || fn.includes("avc")) cdc = "x264";
    else if (fn.includes("x265") || fn.includes("hevc")) cdc = "x265";

    let sz = specs.fileSize;
    const sizeMatch = rawFilename.match(/(\d+(\.\d+)?)\s*(gb|mb)/i);
    if (sizeMatch) sz = `${sizeMatch[1]} ${sizeMatch[3].toUpperCase()}`;

    const detected: string[] = [];
    if (fn.includes("english") || fn.includes("eng")) detected.push("English");
    if (fn.includes("hindi")) detected.push("Hindi");
    if (fn.includes("tamil")) detected.push("Tamil");
    if (fn.includes("telugu")) detected.push("Telugu");
    if (fn.includes("malayalam")) detected.push("Malayalam");
    if (fn.includes("kannada")) detected.push("Kannada");

    const activeLangs = detected.length > 0 ? detected : selectedLangs;
    setSelectedLangs(activeLangs);

    setSpecs({
      ...specs,
      resolution: res,
      source: src,
      enhancement: enh,
      colorDepth: col,
      hdr: hdr,
      codec: cdc,
      fileSize: sz,
    });

    const masterStream = versions[0]?.stream_url || "";
    const origLangName =
      movie?.original_language === "en" ? "English" :
      movie?.original_language === "ta" ? "Tamil" :
      movie?.original_language === "te" ? "Telugu" :
      movie?.original_language === "hi" ? "Hindi" : "English";

    const newVersions = activeLangs.map((lang, idx) => {
      let verAudio = "Dolby Digital";
      let verChannels = "5.1";
      let verDub = "";

      if (lang === origLangName) {
        verDub = "Original Track";
        if (fn.includes("dts-hd") || fn.includes("dtshd")) { verAudio = "DTS-HD MA"; verChannels = "7.1"; }
        else if (fn.includes("truehd")) { verAudio = "Dolby TrueHD"; verChannels = "7.1"; }
        else if (fn.includes("atmos")) { verAudio = "Dolby Atmos"; verChannels = "7.1"; }
        else if (fn.includes("aac")) { verAudio = "AAC"; verChannels = "5.1"; }
      } else {
        verDub = `${lang} Dub`;
        if (fn.includes("ddp") || fn.includes("eac3")) { verAudio = "Dolby Digital Plus"; verChannels = "5.1"; }
        else if (fn.includes("aac")) { verAudio = "AAC"; verChannels = "5.1"; }
        else { verAudio = "Dolby Digital"; verChannels = "5.1"; }
      }

      return {
        id: `ver-${idx + 1}-${Date.now()}`,
        language: lang,
        dubbed: verDub,
        quality: res,
        source: src,
        codec: cdc,
        audio: verAudio,
        channels: verChannels,
        size: sz,
        linkType: masterStream.includes("dropbox") ? "direct_strm" : "gdrive",
        stream_url: masterStream,
      };
    });

    setVersions(newVersions);
  };

  const updateArtworkField = (field: string, val: string) => {
    if (!movie) return;
    setMovie({
      ...movie,
      artwork: {
        ...movie.artwork,
        [field]: val,
      },
    });
  };

  const toggleLanguage = (lang: string) => {
    if (selectedLangs.includes(lang)) {
      if (selectedLangs.length === 1) return;
      setSelectedLangs(selectedLangs.filter((l) => l !== lang));
    } else {
      setSelectedLangs([...selectedLangs, lang]);
    }
  };

  const addVersionRow = () => {
    setVersions([
      ...versions,
      {
        id: `ver-${Date.now()}`,
        language: "Hindi",
        dubbed: "Hindi Dub",
        quality: specs.resolution,
        source: specs.source,
        codec: specs.codec,
        audio: "Dolby Digital",
        channels: "5.1",
        size: specs.fileSize,
        linkType: "gdrive",
        stream_url: versions[0]?.stream_url || "",
      },
    ]);
  };

  const removeVersionRow = (idx: number) => {
    if (versions.length === 1) {
      alert("At least one version must be retained.");
      return;
    }
    if (confirm("Are you sure you want to delete this playback version?")) {
      setVersions(versions.filter((_, i) => i !== idx));
    }
  };

  const updateVersion = (idx: number, field: string, val: string) => {
    const updated = [...versions];
    updated[idx][field] = val;
    setVersions(updated);
  };

  const handleCommit = async () => {
    if (!movie) {
      alert("Please select a movie before committing.");
      return;
    }

    setCommitStatus({ text: "Validating & saving to GitHub resources/data...", success: true });
    try {
      const res = await fetch("/api/movies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie,
          specs,
          versions,
          category,
          available_languages: selectedLangs,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setCommitStatus({
          text: `🎉 Synced cleanly to ${data.chunkPath} & catalog.json! (Commit: ${data.commitSha.substring(0, 7)})`,
          success: true,
        });
        fetchLibrary();
      } else {
        setCommitStatus({ text: `❌ Save Failed: ${data.error}`, success: false });
      }
    } catch (err: any) {
      setCommitStatus({ text: `❌ Network Error: ${err.message}`, success: false });
    }
  };

  const handleDeleteMovie = async (id: string, title: string) => {
    if (!confirm(`Permanently delete "${title}" from catalog and chunks?`)) return;
    try {
      const res = await fetch(`/api/movies?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        alert(`"${title}" deleted successfully.`);
        fetchLibrary();
      } else {
        alert("Delete failed: " + data.error);
      }
    } catch (err: any) {
      alert("Delete failed: " + err.message);
    }
  };

  const filteredLibrary = library.filter((m) =>
    m.title?.toLowerCase().includes(libSearch.toLowerCase()) ||
    m.year?.toString().includes(libSearch) ||
    m.category?.toLowerCase().includes(libSearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-[#070b14] text-gray-100 font-sans p-4 md:p-8">
      {/* TOP NAVIGATION */}
      <header className="flex flex-wrap items-center justify-between border-b border-gray-800 pb-4 mb-6 gap-4">
        <div className="flex items-center gap-3">
          <span className="bg-red-600 text-white font-black px-3.5 py-1 rounded text-lg tracking-wider shadow">
            MOINUFLIX
          </span>
          <span className="text-sm font-semibold tracking-widest text-gray-400">
            ADMIN STUDIO
          </span>
        </div>

        <nav className="flex items-center bg-[#0f172a] p-1 rounded-lg border border-gray-800 text-xs font-semibold">
          <button
            onClick={() => setActiveTab("movies")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "movies" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Movies List ({library.length})
          </button>
          <button
            onClick={() => setActiveTab("editor")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "editor" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            Add / Edit Movie
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-3 py-1.5 rounded transition ${
              activeTab === "json" ? "bg-red-600 text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            JSON Audit
          </button>
        </nav>

        <span className="text-xs bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-3 py-1 rounded-full font-bold shadow-sm">
          ⚡ Production Engine
        </span>
      </header>

      {/* VIEW 1: MOVIES LIST (DATABASE RECORDS) */}
      {activeTab === "movies" && (
        <div className="bg-[#0f172a] border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-red-500 uppercase tracking-widest">
                Database Records (resources/data/catalog.json)
              </h2>
              <p className="text-xs text-gray-400">Click any movie to edit its metadata or delete records safely.</p>
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="Search catalog by title, year, category..."
                value={libSearch}
                onChange={(e) => setLibSearch(e.target.value)}
                className="bg-[#1e293b] border border-gray-700 px-3 py-1.5 rounded text-xs text-white outline-none w-64"
              />
              <button
                onClick={fetchLibrary}
                className="text-xs bg-gray-800 hover:bg-gray-700 px-3 py-1.5 rounded font-semibold text-gray-300 border border-gray-700"
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          {loadingLibrary ? (
            <div className="text-center py-16 text-xs text-gray-500">Loading catalog from GitHub...</div>
          ) : filteredLibrary.length === 0 ? (
            <div className="text-center py-16 text-xs text-gray-500">No matching movies found in catalog.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-800 text-gray-400">
                    <th className="py-2.5 px-3">Poster</th>
                    <th className="py-2.5 px-3">Title & Year</th>
                    <th className="py-2.5 px-3">Industry Category</th>
                    <th className="py-2.5 px-3">Chunk Path</th>
                    <th className="py-2.5 px-3">Rating</th>
                    <th className="py-2.5 px-3">Versions</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredLibrary.map((item) => (
                    <tr key={item.id} className="hover:bg-[#1e293b]/50 transition">
                      <td className="py-2 px-3">
                        {item.poster ? (
                          <img src={item.poster} className="w-8 h-12 object-cover rounded shadow" alt={item.title} />
                        ) : (
                          <div className="w-8 h-12 bg-gray-800 rounded text-[9px] flex items-center justify-center">N/A</div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="font-bold text-white">{item.title}</div>
                        <div className="text-gray-500 text-[11px]">{item.year}</div>
                      </td>
                      <td className="py-2 px-3 font-semibold text-yellow-400">{item.category || "Hollywood"}</td>
                      <td className="py-2 px-3 font-mono text-cyan-400">{item.chunk_file}</td>
                      <td className="py-2 px-3 font-bold text-yellow-400">⭐ {item.rating || "N/A"}</td>
                      <td className="py-2 px-3">
                        <span className="bg-gray-800 text-gray-300 px-2 py-0.5 rounded text-[10px] font-semibold">
                          {item.version_count} versions
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right space-x-2">
                        <button
                          onClick={() => {
                            handleSelectMovie(item.id);
                            setActiveTab("editor");
                          }}
                          className="bg-blue-600/80 hover:bg-blue-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeleteMovie(item.id, item.title)}
                          className="bg-red-600/80 hover:bg-red-600 text-white px-2 py-1 rounded text-[10px] font-bold"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: ADD / EDIT STUDIO */}
      {activeTab === "editor" && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Search & Raw Parser */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-[#0f172a] border border-gray-800 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-2">
                Movie Search & TMDb Selector
              </h2>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Type movie name (e.g. Avatar, Cars, Leo, Master)..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="w-full bg-[#1e293b] border border-gray-700 px-3 py-2 rounded text-sm outline-none focus:border-red-500 text-white"
                />
                <button
                  onClick={handleSearch}
                  className="bg-red-600 hover:bg-red-700 font-bold px-4 py-2 rounded text-sm text-white transition"
                >
                  {searching ? "..." : "Find"}
                </button>
              </div>

              {searchResults.length > 0 && (
                <div className="mt-3 max-h-56 overflow-y-auto space-y-2 pr-1">
                  {searchResults.map((m) => (
                    <div
                      key={m.id}
                      onClick={() => handleSelectMovie(m.id)}
                      className="flex items-center gap-3 bg-[#1e293b] hover:bg-gray-800 p-2 rounded cursor-pointer border border-transparent hover:border-red-500 transition"
                    >
                      {m.poster_path ? (
                        <img
                          src={`https://image.tmdb.org/t/p/w92${m.poster_path}`}
                          className="w-10 h-14 object-cover rounded shadow"
                          alt={m.title}
                        />
                      ) : (
                        <div className="w-10 h-14 bg-gray-700 rounded flex items-center justify-center text-[10px]">No Pic</div>
                      )}
                      <div>
                        <div className="font-bold text-sm text-white">{m.title}</div>
                        <div className="text-xs text-gray-400">
                          {m.release_date ? m.release_date.split("-")[0] : "N/A"} • ID: {m.id}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Raw Rename Parser */}
            <div className="bg-[#0f172a] border border-cyan-900/60 p-4 rounded-xl shadow-lg">
              <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">
                ⚡ Raw File Rename Parser (Auto-Fill)
              </h2>
              <textarea
                rows={3}
                placeholder="Paste filename: Cars (2006) 1080p BluRay x265 10bit HEVC [Org Hindi BD 5.1 ~ 448Kbps + English AAC 5.1] ESub ~ Tigole.mkv"
                value={rawFilename}
                onChange={(e) => setRawFilename(e.target.value)}
                className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs outline-none focus:border-cyan-500 font-mono text-gray-200"
              />
              <button
                onClick={parseFilename}
                className="mt-2 w-full bg-cyan-600 hover:bg-cyan-500 font-bold py-2 rounded text-xs tracking-wider uppercase text-black transition"
              >
                Parse Specs & Auto-Fill Everything
              </button>
            </div>
          </div>

          {/* Right Column: Full Metadata & Artwork Studio */}
          <div className="lg:col-span-7 space-y-6">
            {loadingMeta ? (
              <div className="bg-[#0f172a] border border-gray-800 p-16 rounded-xl text-center text-gray-400">
                <div className="text-4xl animate-bounce mb-2">⏳</div>
                <div className="text-sm font-semibold">Ingesting multi-provider metadata (TMDb, Fanart, OMDb)...</div>
              </div>
            ) : movie ? (
              <div className="bg-[#0f172a] border border-gray-800 p-5 rounded-xl space-y-5 shadow-2xl relative">
                {/* Spotlight Backdrop Header */}
                <div className="relative rounded-lg overflow-hidden border border-gray-700 p-4 min-h-[140px] flex items-end">
                  {movie.artwork?.fanart && (
                    <img
                      src={movie.artwork.fanart}
                      className="absolute inset-0 w-full h-full object-cover opacity-25 filter blur-xs"
                      alt="Backdrop"
                    />
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/70 to-transparent" />

                  <div className="relative z-10 flex gap-4 items-center">
                    <img
                      src={movie.artwork?.poster || "/placeholder.png"}
                      className="w-20 h-28 object-cover rounded shadow-lg border border-gray-600 bg-gray-800"
                      alt={movie.title}
                    />
                    <div className="space-y-1">
                      {movie.artwork?.clearlogo ? (
                        <img
                          src={movie.artwork.clearlogo}
                          className="max-h-12 max-w-[200px] object-contain mb-1"
                          alt="ClearLogo"
                        />
                      ) : (
                        <h1 className="text-xl font-black text-white">{movie.title}</h1>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold border border-red-800">
                          {movie.certification || "NR"}
                        </span>
                        <span className="text-gray-300 font-semibold">{movie.year}</span>
                        <span className="text-gray-400">• {movie.runtime} min</span>
                        <span className="bg-yellow-950 text-yellow-400 px-2 py-0.5 rounded font-bold border border-yellow-800">
                          ⭐ IMDb {movie.ratings?.imdb || movie.ratings?.tmdb || "N/A"}
                        </span>
                        {movie.ratings?.rotten_tomatoes && (
                          <span className="bg-red-950 text-red-400 px-2 py-0.5 rounded font-bold border border-red-800">
                            🍅 {movie.ratings.rotten_tomatoes}%
                          </span>
                        )}
                        <span className="bg-cyan-950 text-cyan-400 px-2 py-0.5 rounded font-bold border border-cyan-800 uppercase">
                          Lang: {movie.original_language}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* COMPLETE 13-ASSET ARTWORK STUDIO */}
                <div className="bg-[#0a0f1d] p-4 rounded-xl border border-gray-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-gray-800 pb-2">
                    <div>
                      <h3 className="text-xs font-bold text-cyan-400 uppercase tracking-widest">
                        🖼️ Complete Artwork & Asset Studio (13 Assets)
                      </h3>
                      <p className="text-[10px] text-gray-500">Live visual previews with manual URL editability. Blank if missing.</p>
                    </div>
                    {/* Trailer Status Masked (No visible URL) */}
                    <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border bg-[#1e293b]">
                      {movie.trailer && movie.trailer.includes("youtube.com") ? (
                        <span className="text-emerald-400 flex items-center gap-1">
                          ✓ Trailer Found
                        </span>
                      ) : (
                        <span className="text-red-400 flex items-center gap-1">
                          ✕ Trailer Not Found
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
                    {/* 1. Poster */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">1. Poster (780w)</label>
                      <div className="h-20 bg-[#070b14] rounded flex items-center justify-center overflow-hidden border border-gray-800">
                        {movie.artwork?.poster ? (
                          <img src={movie.artwork.poster} alt="Poster" className="h-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.poster || ""}
                        onChange={(e) => updateArtworkField("poster", e.target.value)}
                        placeholder="Poster URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-gray-300 font-mono"
                      />
                    </div>

                    {/* 2. ClearLogo */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">2. ClearLogo (Transparent Title)</label>
                      <div className="h-20 bg-[#070b14] rounded flex items-center justify-center p-2 border border-gray-800">
                        {movie.artwork?.clearlogo ? (
                          <img src={movie.artwork.clearlogo} alt="ClearLogo" className="max-h-14 max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.clearlogo || ""}
                        onChange={(e) => updateArtworkField("clearlogo", e.target.value)}
                        placeholder="ClearLogo URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-yellow-300 font-mono"
                      />
                    </div>

                    {/* 3. ClearArt */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">3. ClearArt (Character PNG)</label>
                      <div className="h-20 bg-[#070b14] rounded flex items-center justify-center p-2 border border-gray-800">
                        {movie.artwork?.clearart ? (
                          <img src={movie.artwork.clearart} alt="ClearArt" className="max-h-16 max-w-full object-contain" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.clearart || ""}
                        onChange={(e) => updateArtworkField("clearart", e.target.value)}
                        placeholder="ClearArt URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-cyan-300 font-mono"
                      />
                    </div>

                    {/* 4. Banner */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">4. Wide Banner (1000x185)</label>
                      <div className="h-16 bg-[#070b14] rounded flex items-center justify-center overflow-hidden border border-gray-800">
                        {movie.artwork?.banner ? (
                          <img src={movie.artwork.banner} alt="Banner" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.banner || ""}
                        onChange={(e) => updateArtworkField("banner", e.target.value)}
                        placeholder="Banner URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-gray-300 font-mono"
                      />
                    </div>

                    {/* 5. Landscape / Thumbnail */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">5. Landscape / Thumb (16:9)</label>
                      <div className="h-16 bg-[#070b14] rounded flex items-center justify-center overflow-hidden border border-gray-800">
                        {movie.artwork?.landscape ? (
                          <img src={movie.artwork.landscape} alt="Landscape" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.landscape || ""}
                        onChange={(e) => updateArtworkField("landscape", e.target.value)}
                        placeholder="Landscape URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-gray-300 font-mono"
                      />
                    </div>

                    {/* 6. Keyart */}
                    <div className="bg-[#1e293b]/70 p-2.5 rounded-lg border border-gray-700/80 space-y-1.5">
                      <label className="text-[11px] font-bold text-gray-300">6. Keyart</label>
                      <div className="h-16 bg-[#070b14] rounded flex items-center justify-center overflow-hidden border border-gray-800">
                        {movie.artwork?.keyart ? (
                          <img src={movie.artwork.keyart} alt="Keyart" className="w-full h-full object-cover" />
                        ) : (
                          <span className="text-[10px] text-gray-600">Blank</span>
                        )}
                      </div>
                      <input
                        type="text"
                        value={movie.artwork?.keyart || ""}
                        onChange={(e) => updateArtworkField("keyart", e.target.value)}
                        placeholder="Keyart URL"
                        className="w-full bg-[#0f172a] border border-gray-700 px-2 py-1 rounded text-[10px] text-gray-300 font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* INDUSTRY CATEGORY & MULTI-LANGUAGE SELECTION */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-[#0a0f1d] p-3 rounded-lg border border-gray-800">
                  <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">
                      Industry Category (Auto-Locked / Editable)
                    </label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full bg-[#1e293b] border border-gray-700 p-2 rounded text-xs text-yellow-400 font-bold"
                    >
                      {CATEGORIES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-gray-400 block mb-1">
                      Available Languages in Catalog
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {ALL_LANGUAGES.map((l) => (
                        <button
                          type="button"
                          key={l}
                          onClick={() => toggleLanguage(l)}
                          className={`px-2.5 py-1 rounded text-[11px] font-semibold border transition ${
                            selectedLangs.includes(l)
                              ? "bg-red-600 border-red-500 text-white"
                              : "bg-[#1e293b] border-gray-700 text-gray-400 hover:text-white"
                          }`}
                        >
                          {l}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MASTER TECHNICAL PARAMETERS */}
                <div className="bg-[#0a0f1d] p-3 rounded-lg border border-gray-800 space-y-3">
                  <div className="text-xs font-bold text-gray-400">Master Tech & Source Configuration</div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5">
                    <div>
                      <label className="text-[10px] text-gray-500">Source (OTT / BD)</label>
                      <select
                        value={specs.source}
                        onChange={(e) => setSpecs({ ...specs, source: e.target.value })}
                        className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                      >
                        <option>AMZN</option>
                        <option>NF</option>
                        <option>DSNP</option>
                        <option>ZEE5</option>
                        <option>SONYLIV</option>
                        <option>BluRay</option>
                        <option>REMUX</option>
                        <option>WEB-DL</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500">Video Codec</label>
                      <select
                        value={specs.codec}
                        onChange={(e) => setSpecs({ ...specs, codec: e.target.value })}
                        className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                      >
                        <option>x265</option>
                        <option>x264</option>
                        <option>AV1</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500">Quality Enhancement</label>
                      <select
                        value={specs.enhancement}
                        onChange={(e) => setSpecs({ ...specs, enhancement: e.target.value })}
                        className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white"
                      >
                        <option>Standard</option>
                        <option>DS4K</option>
                        <option>Remux</option>
                        <option>IMAX</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[10px] text-gray-500">Total File Size</label>
                      <input
                        type="text"
                        value={specs.fileSize}
                        onChange={(e) => setSpecs({ ...specs, fileSize: e.target.value })}
                        placeholder="e.g. 5 GB"
                        className="w-full bg-[#1e293b] border border-gray-700 p-1.5 rounded text-xs text-white font-semibold"
                      />
                    </div>
                  </div>
                </div>

                {/* PLAYBACK VERSIONS (Exactly One Section) */}
                <div className="space-y-3 bg-[#0a0f1d] p-3.5 rounded-lg border border-gray-800">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">
                        Playback Versions & Audio Tracks
                      </h3>
                      <p className="text-[10px] text-gray-400">
                        Independent audio format, channels, source badge, and playable stream URL.
                      </p>
                    </div>
                    <button
                      onClick={addVersionRow}
                      className="text-[11px] bg-gray-800 hover:bg-gray-700 text-gray-200 px-2.5 py-1 rounded font-bold border border-gray-600"
                    >
                      + Add Another Version
                    </button>
                  </div>

                  <div className="space-y-2.5">
                    {versions.map((ver, idx) => (
                      <div
                        key={ver.id || idx}
                        className="bg-[#1e293b] p-3 rounded-lg border border-gray-700 space-y-2"
                      >
                        <div className="flex flex-wrap items-center gap-2">
                          <select
                            value={ver.language}
                            onChange={(e) => updateVersion(idx, "language", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-white"
                          >
                            <option>English</option>
                            <option>Hindi</option>
                            <option>Tamil</option>
                            <option>Telugu</option>
                            <option>Malayalam</option>
                            <option>Kannada</option>
                          </select>

                          <select
                            value={ver.quality}
                            onChange={(e) => updateVersion(idx, "quality", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-blue-400 font-bold"
                          >
                            <option>2160p</option>
                            <option>1080p</option>
                            <option>720p</option>
                          </select>

                          <select
                            value={ver.source}
                            onChange={(e) => updateVersion(idx, "source", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-amber-400 font-bold"
                          >
                            <option>AMZN</option>
                            <option>NF</option>
                            <option>DSNP</option>
                            <option>ZEE5</option>
                            <option>SONYLIV</option>
                            <option>BluRay</option>
                            <option>REMUX</option>
                            <option>WEB-DL</option>
                          </select>

                          <select
                            value={ver.audio}
                            onChange={(e) => updateVersion(idx, "audio", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-orange-400 font-semibold"
                          >
                            <option>DTS-HD MA</option>
                            <option>Dolby Atmos</option>
                            <option>Dolby TrueHD</option>
                            <option>Dolby Digital Plus</option>
                            <option>Dolby Digital</option>
                            <option>DTS 5.1</option>
                            <option>AAC</option>
                          </select>

                          <select
                            value={ver.channels || "5.1"}
                            onChange={(e) => updateVersion(idx, "channels", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-cyan-300 font-semibold"
                          >
                            <option>7.1</option>
                            <option>5.1</option>
                            <option>2.0</option>
                          </select>

                          <input
                            type="text"
                            value={ver.dubbed || ""}
                            onChange={(e) => updateVersion(idx, "dubbed", e.target.value)}
                            placeholder="Tag (e.g. Original Track)"
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-yellow-300 w-32"
                          />

                          <input
                            type="text"
                            value={ver.size || specs.fileSize}
                            onChange={(e) => updateVersion(idx, "size", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-rose-300 w-16 text-center font-bold"
                          />

                          {versions.length > 1 && (
                            <button
                              onClick={() => removeVersionRow(idx)}
                              className="text-red-400 hover:text-red-300 text-xs px-2 py-1 font-bold ml-auto"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        {/* Stream URL Row */}
                        <div className="flex items-center gap-2">
                          <select
                            value={ver.linkType || "gdrive"}
                            onChange={(e) => updateVersion(idx, "linkType", e.target.value)}
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-[11px] text-gray-300 font-semibold"
                          >
                            <option value="gdrive">GDrive ID</option>
                            <option value="direct_strm">Direct / Dropbox STRM</option>
                          </select>

                          <input
                            type="text"
                            value={ver.stream_url}
                            onChange={(e) => updateVersion(idx, "stream_url", e.target.value)}
                            placeholder="https://drive.google.com/file/d/... or Direct STRM URL"
                            className="bg-[#0f172a] border border-gray-600 px-2 py-1 rounded text-xs text-cyan-300 flex-1 font-mono"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Commit Action */}
                <button
                  onClick={handleCommit}
                  className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-extrabold py-3.5 rounded-lg text-sm tracking-wider uppercase transition shadow-lg"
                >
                  Save to JSON & Commit to GitHub
                </button>

                {commitStatus && (
                  <div
                    className={`p-3 rounded text-center text-xs font-semibold border ${
                      commitStatus.success
                        ? "bg-emerald-950/80 border-emerald-800 text-emerald-300"
                        : "bg-red-950/80 border-red-800 text-red-300"
                    }`}
                  >
                    {commitStatus.text}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-[#0f172a] border border-gray-800 p-16 rounded-xl text-center text-gray-500">
                <div className="text-4xl mb-2">🎬</div>
                <div className="text-sm font-semibold text-gray-400">No Movie Selected</div>
                <div className="text-xs text-gray-600 mt-1">Search on left or paste release file name to populate details</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW 3: JSON AUDIT */}
      {activeTab === "json" && (
        <div className="bg-[#0f172a] border border-gray-800 p-6 rounded-xl shadow-lg space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-cyan-400 uppercase tracking-widest">Active Two-Tier JSON Payload Audit</h2>
            <span className="text-xs text-gray-400 font-mono">Target: resources/data/chunks/ & catalog.json</span>
          </div>
          <pre className="bg-[#0a0f1d] border border-gray-800 p-4 rounded text-xs font-mono text-emerald-400 overflow-x-auto max-h-[550px]">
            {JSON.stringify({ movie, specs, versions, category, selectedLangs }, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
