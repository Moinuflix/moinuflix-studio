"use client";
import React, { useState, useEffect } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const GH_REPO = "Moinuflix/My-Movies";
const GH_BRANCH = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${GH_REPO}/${GH_BRANCH}`;
const WORKER_BASE = "https://gdrive-stream.moinudeentv.workers.dev/?id=";
const USER_AGENT = "|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0";
const CONFIRM_PIN = "24592";

export default function StudioManagerPro() {
  const [activeTab, setActiveTab] = useState<"overview" | "arrivals" | "movies" | "add">("overview");

  // Databases
  const [moviesData, setMoviesData] = useState<any[]>([]);
  const [imaxData, setImaxData] = useState<any[]>([]);
  const [tamilData, setTamilData] = useState<any[]>([]);
  const [teluguData, setTeluguData] = useState<any[]>([]);
  const [hindiData, setHindiData] = useState<any[]>([]);
  const [englishData, setEnglishData] = useState<any[]>([]);
  const [malayalamData, setMalayalamData] = useState<any[]>([]);
  const [kannadaData, setKannadaData] = useState<any[]>([]);
  const [kidsData, setKidsData] = useState<any[]>([]);
  const [inboxArrivals, setInboxArrivals] = useState<any[]>([]);

  // UI Filters & Search
  const [currentCategory, setCurrentCategory] = useState("packs");
  const [searchQuery, setSearchQuery] = useState("");
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  // Form State
  const [smartFilename, setSmartFilename] = useState("");
  const [tmdbSuggestions, setTmdbSuggestions] = useState<any[]>([]);
  const [tmdbId, setTmdbId] = useState("");
  const [collectionName, setCollectionName] = useState("");
  const [quality, setQuality] = useState("4K UHD");
  const [audio, setAudio] = useState("Dolby Atmos");
  const [sourceStudio, setSourceStudio] = useState("Amazon Prime Video");
  const [fileSize, setFileSize] = useState("10GB");
  const [isImax, setIsImax] = useState(false);
  const [gdriveUrl, setGdriveUrl] = useState("");
  const [fetchedMeta, setFetchedMeta] = useState<any>(null);

  // Regional Sync Checkboxes
  const [regionChecks, setRegionChecks] = useState({
    ta: true,
    te: false,
    hi: false,
    en: false,
    ml: false,
    kn: false,
    kids: false,
  });

  // Merge Mode
  const [isMergeMode, setIsMergeMode] = useState(false);
  const [targetExistingMovie, setTargetExistingMovie] = useState<any>(null);
  const [showMergeDock, setShowMergeDock] = useState(false);

  // Pack Checklist Modal
  const [packModalOpen, setPackModalOpen] = useState(false);
  const [packModalTitle, setPackModalTitle] = useState("");
  const [packOwnedList, setPackOwnedList] = useState<any[]>([]);
  const [packMissingList, setPackMissingList] = useState<any[]>([]);
  const [loadingMissingPack, setLoadingMissingPack] = useState(false);

  const showToast = (msg: string, isError = false) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3500);
  };

  const getStoredToken = () => (typeof window !== "undefined" ? localStorage.getItem("moinuflix_gh_token") || "" : "");

  const configureGithubToken = () => {
    const cur = getStoredToken();
    const token = prompt("Enter your GitHub Personal Access Token (ghp_...):", cur);
    if (token !== null) {
      if (token.trim()) {
        localStorage.setItem("moinuflix_gh_token", token.trim());
        showToast("GitHub Token Saved!");
      } else {
        localStorage.removeItem("moinuflix_gh_token");
        showToast("GitHub Token Removed!", true);
      }
    }
  };

  // Clean & Round Size (e.g. 14.2 GB -> 14GB)
  const cleanAndRoundSize = (raw: string) => {
    if (!raw) return "10GB";
    const match = String(raw).match(/([\d\.]+)\s*(gb|mb)?/i);
    if (!match) return "10GB";
    let num = parseFloat(match[1]);
    if ((match[2] || "gb").toLowerCase() === "mb") num = num / 1024;
    let rounded = Math.round(num);
    if (rounded < 1) rounded = 1;
    if (rounded > 50) rounded = 50;
    return `${rounded}GB`;
  };

  const extractGDriveId = (url: string) => {
    if (!url) return "";
    const clean = url.trim();
    const pMatch = clean.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (pMatch && pMatch[1]) return pMatch[1];
    const fMatch = clean.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    if (fMatch && fMatch[1]) return fMatch[1];
    const rMatch = clean.match(/^[a-zA-Z0-9_-]{25,}$/);
    if (rMatch) return rMatch[0];
    return clean;
  };

  // Load All Chunks from GitHub
  const loadAllChunks = async () => {
    const fetchChunk = async (path: string) => {
      try {
        const res = await fetch(`${RAW_BASE}/${path}?t=${Date.now()}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    };

    const [c01, imax, tam, tel, hin, eng, mal, kan, kid] = await Promise.all([
      fetchChunk("chunks/data_c01.json"),
      fetchChunk("chunks/data_c01_imax.json"),
      fetchChunk("chunks/data_c01_tamil.json"),
      fetchChunk("chunks/data_c01_telugu.json"),
      fetchChunk("chunks/data_c01_hindi.json"),
      fetchChunk("chunks/data_c01_english.json"),
      fetchChunk("chunks/data_c01_malayalam.json"),
      fetchChunk("chunks/data_c01_kannada.json"),
      fetchChunk("chunks/data_c05_kids.json"),
    ]);

    setMoviesData(c01);
    setImaxData(imax);
    setTamilData(tam);
    setTeluguData(tel);
    setHindiData(hin);
    setEnglishData(eng);
    setMalayalamData(mal);
    setKannadaData(kan);
    setKidsData(kid);

    // Poll Inbox
    try {
      const res = await fetch(`${RAW_BASE}/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const raw = await res.json();
        const known = new Set<string>();
        c01.forEach((m: any) => {
          if (m.id) known.add(String(m.id).trim());
          (m.versions || []).forEach((v: any) => {
            if (v.id) known.add(String(v.id).trim());
          });
        });
        const unhandled = Array.isArray(raw) ? raw.filter((x: any) => !known.has(String(x.gdrive_id).trim())) : [];
        setInboxArrivals(unhandled);
      }
    } catch {}
  };

  useEffect(() => {
    loadAllChunks();
  }, []);

  // Storage Meter Calculation
  const calculateTotalGB = () => {
    let total = 0;
    moviesData.forEach((m) => {
      let szStr = m.specs?.size || (m.versions && m.versions[0]?.size) || "";
      let mMatch = szStr.match(/([\d\.]+)\s*(gb|mb)/i);
      if (mMatch) {
        let v = parseFloat(mMatch[1]);
        if (mMatch[2].toLowerCase() === "gb") total += v;
        else total += v / 1024;
      } else {
        total += 4;
      }
    });
    return total;
  };

  // Smart Filename Parser
  const parseSmartFileName = (filename: string) => {
    setSmartFilename(filename);
    if (!filename || !filename.trim()) return;

    if (/sun\s*nxt|sunnxt/i.test(filename)) setSourceStudio("Sun NXT");
    else if (/amzn|prime/i.test(filename)) setSourceStudio("Amazon Prime Video");
    else if (/nf|netflix/i.test(filename)) setSourceStudio("Netflix");
    else if (/hotstar|dsnp|disney/i.test(filename)) setSourceStudio("Disney+ Hotstar");
    else if (/sonyliv/i.test(filename)) setSourceStudio("SonyLIV");
    else if (/zee5/i.test(filename)) setSourceStudio("Zee5");
    else if (/bluray|remux/i.test(filename)) setSourceStudio("BluRay");
    else setSourceStudio("WEB-DL");

    const sizeMatch = filename.match(/(\d+\.?\d*)\s*(gb|mb)/i);
    if (sizeMatch) {
      setFileSize(cleanAndRoundSize(sizeMatch[0]));
    }

    let raw = filename.replace(/\.(mkv|mp4|avi|ts)$/i, "").replace(/[\._\-]/g, " ");
    const ym = raw.match(/\b(19\d\d|20\d\d)\b/);
    let year = ym ? ym[1] : "";
    let cutoff = ym ? ym.index : raw.length;
    let title = raw.substring(0, cutoff).trim();
    title = title.replace(/\b(1080p|720p|2160p|4k|uhd|bluray|web-dl|dts|atmos|ddp|x264|x265|hevc|hindi|tamil|telugu|sunnxt)\b/gi, "").trim();

    setQuality(/2160p|4k|uhd/i.test(filename) ? "4K UHD" : "1080p FHD");
    setIsImax(/1509k|dts|imax/i.test(filename));

    // Search TMDB live suggestions
    if (title.length >= 2) {
      fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(title)}${year ? `&year=${year}` : ""}`)
        .then((r) => r.json())
        .then((data) => {
          setTmdbSuggestions(data.results?.slice(0, 4) || []);
        })
        .catch(() => setTmdbSuggestions([]));
    }
  };

  // Fetch TMDB Metadata Details
  const fetchTmdbMetadata = async (id: string | number) => {
    if (!id) return;
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${id}?api_key=${TMDB_KEY}&append_to_response=credits,videos`);
      if (!res.ok) return;
      const data = await res.json();

      let colName = data.belongs_to_collection ? data.belongs_to_collection.name : "";
      setCollectionName(colName);

      const meta = {
        title: data.title,
        original_title: data.original_title,
        original_language: data.original_language,
        year: data.release_date ? parseInt(data.release_date.split("-")[0]) : 2024,
        runtime: data.runtime || 140,
        tmdb_id: data.id,
        rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : 7.0,
        collection: colName,
        genres: data.genres ? data.genres.map((g: any) => g.name) : ["Action"],
        director: data.credits?.crew?.filter((c: any) => c.job === "Director").map((c: any) => c.name) || [],
        cast: data.credits?.cast?.slice(0, 5).map((c: any) => ({ name: c.name, role: c.character })) || [],
        plot: data.overview || "",
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
        fanart: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : "",
      };
      setFetchedMeta(meta);

      // Auto check language
      const l = data.original_language;
      setRegionChecks((prev) => ({
        ...prev,
        ta: l === "ta",
        te: l === "te",
        hi: l === "hi",
        en: l === "en",
        ml: l === "ml",
        kn: l === "kn",
      }));

      // Check existing for merge dock
      const existing = moviesData.find((m) => String(m.tmdb_id) === String(id));
      if (existing) {
        setTargetExistingMovie(existing);
        setShowMergeDock(true);
      } else {
        setShowMergeDock(false);
      }
      showToast(`Loaded: "${data.title}"`);
    } catch {}
  };

  // Direct GitHub API Commit
  const commitFileDirect = async (chunkPath: string, arrayData: any[], message: string, token: string) => {
    const url = `https://api.github.com/repos/${GH_REPO}/contents/${chunkPath}`;
    let currentSha: string | undefined = undefined;

    try {
      const getRes = await fetch(`${url}?t=${Date.now()}`, {
        headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.v3+json" },
      });
      if (getRes.ok) {
        const fileInfo = await getRes.json();
        currentSha = fileInfo.sha;
      }
    } catch {}

    const finalJson = JSON.stringify(arrayData, null, 2);
    const uint8Array = new TextEncoder().encode(finalJson);
    let binary = "";
    for (let i = 0; i < uint8Array.byteLength; i++) {
      binary += String.fromCharCode(uint8Array[i]);
    }
    const encoded = btoa(binary);

    const putRes = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message, content: encoded, branch: GH_BRANCH, sha: currentSha }),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      throw new Error(err.message || `Commit failed for ${chunkPath}`);
    }
  };

  // Submit Movie or Merge Version
  const handleMovieSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = getStoredToken();
    if (!token) return showToast("GitHub Token required! Click Token button.", true);

    const fileId = extractGDriveId(gdriveUrl);
    if (!fileId) return showToast("Valid Drive link or ID required!", true);

    const meta = fetchedMeta || {
      title: `Movie ${tmdbId}`,
      original_title: `Movie ${tmdbId}`,
      original_language: "ta",
      year: 2024,
      runtime: 140,
      tmdb_id: parseInt(tmdbId, 10),
      rating: 7.0,
      genres: ["Action"],
      director: [],
      cast: [],
      plot: "",
      poster: "",
      fanart: "",
    };
    meta.collection = collectionName;

    const streamUrl = `${WORKER_BASE}${fileId}${USER_AGENT}`;
    const versionObj = {
      id: fileId,
      name: `${meta.title} (${meta.year}) [${quality}] [${sourceStudio}] [${audio}].mkv`,
      quality: `${quality} • ${sourceStudio} • ${audio}`,
      source: sourceStudio,
      studio: sourceStudio,
      resolution: quality,
      audio: audio,
      size: fileSize,
      stream_url: streamUrl,
    };

    // MERGE VERSION FLOW
    if (isMergeMode && targetExistingMovie) {
      const updatedMovies = [...moviesData];
      const match = updatedMovies.find((m) => String(m.id) === String(targetExistingMovie.id));
      if (match) {
        match.versions = match.versions || [];
        if (!match.versions.some((v: any) => v.id === fileId)) {
          match.versions.push(versionObj);
        }
      }
      showToast(`Merging version into "${targetExistingMovie.title}"...`);
      try {
        await commitFileDirect("chunks/data_c01.json", updatedMovies, `Merge Version: ${targetExistingMovie.title} (${quality})`, token);
        showToast(`✅ Successfully merged into "${targetExistingMovie.title}"!`);
        setIsMergeMode(false);
        setTargetExistingMovie(null);
        setShowMergeDock(false);
        loadAllChunks();
      } catch (err: any) {
        showToast(`Merge Failed: ${err.message}`, true);
      }
      return;
    }

    // NEW MOVIE INGESTION FLOW
    const newEntry = {
      id: fileId,
      name: versionObj.name,
      title: meta.title,
      original_title: meta.original_title,
      original_language: meta.original_language,
      year: meta.year,
      runtime: meta.runtime,
      tmdb_id: meta.tmdb_id,
      rating: meta.rating,
      collection: collectionName,
      studio: sourceStudio,
      genres: meta.genres || ["Action"],
      director: meta.director,
      cast: meta.cast,
      plot: meta.plot,
      poster: meta.poster,
      fanart: meta.fanart,
      stream_url: streamUrl,
      specs: {
        resolution: quality,
        audio: audio,
        source: sourceStudio,
        size: fileSize,
        channels: "5.1",
        codec: "H.264",
      },
      versions: [versionObj],
    };

    showToast(`Committing "${meta.title}" to Master Library...`);

    try {
      // 1. Commit to Master (data_c01.json)
      const newMaster = [newEntry, ...moviesData];
      await commitFileDirect("chunks/data_c01.json", newMaster, `Add Movie: ${meta.title}`, token);

      // 2. IMAX Core Chunk
      if (isImax) {
        await commitFileDirect("chunks/data_c01_imax.json", [newEntry, ...imaxData], `Sync IMAX: ${meta.title}`, token);
      }

      // 3. Regional Sync
      if (regionChecks.ta) await commitFileDirect("chunks/data_c01_tamil.json", [newEntry, ...tamilData], `Sync Tamil: ${meta.title}`, token);
      if (regionChecks.te) await commitFileDirect("chunks/data_c01_telugu.json", [newEntry, ...teluguData], `Sync Telugu: ${meta.title}`, token);
      if (regionChecks.hi) await commitFileDirect("chunks/data_c01_hindi.json", [newEntry, ...hindiData], `Sync Hindi: ${meta.title}`, token);
      if (regionChecks.en) await commitFileDirect("chunks/data_c01_english.json", [newEntry, ...englishData], `Sync English: ${meta.title}`, token);
      if (regionChecks.ml) await commitFileDirect("chunks/data_c01_malayalam.json", [newEntry, ...malayalamData], `Sync Malayalam: ${meta.title}`, token);
      if (regionChecks.kn) await commitFileDirect("chunks/data_c01_kannada.json", [newEntry, ...kannadaData], `Sync Kannada: ${meta.title}`, token);
      if (regionChecks.kids) await commitFileDirect("chunks/data_c05_kids.json", [newEntry, ...kidsData], `Sync Kids: ${meta.title}`, token);

      showToast(`🎉 "${meta.title}" committed successfully!`);
      // Reset Form
      setSmartFilename("");
      setTmdbId("");
      setCollectionName("");
      setGdriveUrl("");
      setFetchedMeta(null);
      loadAllChunks();
    } catch (err: any) {
      showToast(`Commit Error: ${err.message}`, true);
    }
  };

  // 1-Click Sync All Drive Arrivals
  const executeOneClickBatchSyncAll = async () => {
    const token = getStoredToken();
    if (!token) return showToast("GitHub Token required!", true);
    if (inboxArrivals.length === 0) return showToast("No arrivals to sync!", true);

    if (!confirm(`Sync all ${inboxArrivals.length} arrivals directly to Master data_c01.json?`)) return;

    showToast("Processing 1-click batch sync...");
    let added = 0;
    const currentMovies = [...moviesData];

    for (const item of inboxArrivals) {
      const fileId = item.gdrive_id;
      const streamUrl = `${WORKER_BASE}${fileId}${USER_AGENT}`;
      const rawName = item.title.replace(/\.(mkv|mp4)/gi, "");
      const finalSize = cleanAndRoundSize(item.size || "10GB");

      const entry = {
        id: fileId,
        name: item.title,
        title: rawName,
        original_title: rawName,
        original_language: "ta",
        year: 2024,
        runtime: 140,
        tmdb_id: 0,
        rating: 7.0,
        collection: "",
        studio: "Amazon Prime Video",
        genres: ["Action"],
        director: [],
        cast: [],
        plot: "Streamed via MoinuFlix Private High-Speed Server.",
        poster: "",
        fanart: "",
        stream_url: streamUrl,
        specs: { resolution: "1080p FHD", audio: "Dolby Digital", source: "WEB-DL", size: finalSize, channels: "5.1", codec: "H.264" },
        versions: [{ id: fileId, name: item.title, quality: "1080p FHD", studio: "Amazon Prime Video", stream_url: streamUrl }],
      };

      if (!currentMovies.some((m) => m.id === fileId)) {
        currentMovies.unshift(entry);
        added++;
      }
    }

    try {
      await commitFileDirect("chunks/data_c01.json", currentMovies, `Batch Sync: Added ${added} files to Master`, token);
      await commitFileDirect("inbox_arrivals.json", [], `Batch Sync: Cleared Inbox Arrivals`, token);
      showToast(`✅ Synced ${added} files!`);
      loadAllChunks();
    } catch (e: any) {
      showToast(`Batch Sync Failed: ${e.message}`, true);
    }
  };

  // Delete Movie Protected with PIN
  const deleteMovie = async (targetId: string, targetTmdb: number | string, title: string) => {
    const pin = prompt(`Delete "${title}"?\nEnter confirmation PIN:`);
    if (pin !== CONFIRM_PIN) {
      if (pin !== null) showToast("Incorrect PIN! Deletion aborted.", true);
      return;
    }
    const token = getStoredToken();
    if (!token) return showToast("GitHub Token missing!", true);

    showToast(`Deleting "${title}" from GitHub...`);
    try {
      const updated = moviesData.filter((m) => {
        if (targetTmdb && String(targetTmdb) !== "0" && m.tmdb_id) {
          return String(m.tmdb_id) !== String(targetTmdb);
        }
        return String(m.id).trim() !== String(targetId).trim();
      });

      await commitFileDirect("chunks/data_c01.json", updated, `Studio Delete: Removed ${title}`, token);
      showToast(`✅ "${title}" successfully deleted!`);
      loadAllChunks();
    } catch (err: any) {
      showToast(`Delete Failed: ${err.message}`, true);
    }
  };

  // Open Dynamic Franchise Modal
  const openDynamicPackModal = async (packTitle: string) => {
    setPackModalTitle(packTitle);
    const owned = moviesData.filter((m) => m.collection && m.collection.trim() === packTitle);
    setPackOwnedList(owned);
    setPackMissingList([]);
    setLoadingMissingPack(true);
    setPackModalOpen(true);

    try {
      const sRes = await fetch(`https://api.themoviedb.org/3/search/collection?api_key=${TMDB_KEY}&query=${encodeURIComponent(packTitle)}`);
      const sData = await sRes.json();
      if (sData.results && sData.results.length > 0) {
        const colId = sData.results[0].id;
        const cRes = await fetch(`https://api.themoviedb.org/3/collection/${colId}?api_key=${TMDB_KEY}`);
        const cData = await cRes.json();
        const parts = cData.parts || [];
        const missing = parts.filter(
          (p: any) => !owned.some((o: any) => (o.tmdb_id && Number(o.tmdb_id) === p.id) || o.title.toLowerCase().includes(p.title.toLowerCase()))
        );
        setPackMissingList(missing);
      }
    } catch {}
    setLoadingMissingPack(false);
  };

  const totalGB = calculateTotalGB();
  const storagePct = Math.min(100, (totalGB / 5000) * 100).toFixed(1);

  // Franchise Map
  const packMap = new Map<string, any[]>();
  moviesData.forEach((m) => {
    if (m.collection && m.collection.trim()) {
      const c = m.collection.trim();
      if (!packMap.has(c)) packMap.set(c, []);
      packMap.get(c)!.push(m);
    }
  });

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 flex font-sans">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl border shadow-2xl text-sm font-bold backdrop-blur-xl ${
            toast.isError ? "bg-red-950/90 border-red-500 text-red-200" : "bg-cyan-950/90 border-cyan-400 text-cyan-200"
          }`}
        >
          {toast.isError ? "❌ " : "⚡ "}
          {toast.msg}
        </div>
      )}

      {/* Auto Merge Bottom Dock */}
      {showMergeDock && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#0e121c]/95 border border-cyan-400 rounded-2xl p-4 shadow-2xl flex items-center gap-6 max-w-xl w-[90%] backdrop-blur-2xl">
          <div>
            <div className="font-bold text-sm text-white">⚡ Existing Movie Detected!</div>
            <div className="text-xs text-cyan-400">Click to merge this version without creating duplicates.</div>
          </div>
          <button
            onClick={() => {
              if (targetExistingMovie) {
                setIsMergeMode(true);
                setActiveTab("add");
                setTmdbId(String(targetExistingMovie.tmdb_id));
                fetchTmdbMetadata(targetExistingMovie.tmdb_id);
                setShowMergeDock(false);
              }
            }}
            className="bg-cyan-400 hover:bg-cyan-300 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider transition ml-auto"
          >
            One-Click Merge
          </button>
        </div>
      )}

      {/* SIDEBAR */}
      <aside className="w-64 border-r border-sky-500/20 bg-[#080e1c]/95 backdrop-blur-2xl p-5 flex flex-col fixed h-screen z-30">
        <div className="flex items-center gap-3 pb-5 border-b border-sky-500/20 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-emerald-400 flex items-center justify-center font-black text-black text-xl shadow-lg shadow-cyan-500/30">
            M
          </div>
          <div className="text-xl font-extrabold tracking-tight">MoinuFlix</div>
        </div>

        <nav className="flex flex-col gap-1.5">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "overview" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            <span>📊 Overview</span>
          </button>
          <button
            onClick={() => {
              setActiveTab("arrivals");
              loadAllChunks();
            }}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "arrivals" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            <span className="flex items-center gap-2">🔔 Drive Arrivals</span>
            {inboxArrivals.length > 0 && (
              <span className="bg-red-600 text-white px-2 py-0.5 rounded-full text-[10px] animate-pulse">
                {inboxArrivals.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("movies")}
            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "movies" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-lg shadow-cyan-500/20" : "text-slate-400 hover:bg-white/5"
            }`}
          >
            <span>🎬 Movies & Packs</span>
            <span className="bg-white/10 px-2 py-0.5 rounded-full text-[10px]">{moviesData.length}</span>
          </button>
          <button
            onClick={() => setActiveTab("add")}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold transition ${
              activeTab === "add" ? "bg-cyan-500/20 text-cyan-300 border border-cyan-400 shadow-lg shadow-cyan-500/20" : "text-cyan-400 hover:bg-white/5"
            }`}
          >
            <span>➕ Add Movie</span>
          </button>

          <div className="h-px bg-sky-500/20 my-3" />

          <a href="https://moinuflix.vercel.app" target="_blank" className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-purple-400 border border-purple-500/30 hover:bg-purple-500/10 transition">
            <span>📺 Web Series ➔</span>
          </a>
          <a href="https://moinuflix.vercel.app" target="_blank" className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold text-amber-400 border border-amber-500/30 hover:bg-amber-500/10 transition">
            <span>🎵 5.1 Songs ➔</span>
          </a>
        </nav>

        <div className="mt-auto pt-4 border-t border-sky-500/20">
          <button
            onClick={configureGithubToken}
            className="w-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 py-2.5 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition flex items-center justify-center gap-2"
          >
            <span>⚙️</span> {getStoredToken() ? "Token Active ✅" : "GitHub Token"}
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="ml-64 flex-1 p-8 max-w-7xl">
        {/* VIEW 1: OVERVIEW & JIO 5TB BAR */}
        {activeTab === "overview" && (
          <div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h1 className="text-2xl font-black">Unified Movies Overview</h1>
                <p className="text-xs text-slate-400 mt-1">Live Master chunk status and dynamic TMDB franchise packs</p>
              </div>
              <div className="flex gap-2">
                <button onClick={configureGithubToken} className="bg-slate-800 text-xs px-3 py-1.5 rounded-full border border-sky-500/30">⚙️ Token</button>
                <button onClick={loadAllChunks} className="bg-slate-800 text-xs px-3 py-1.5 rounded-full border border-sky-500/30">🔄 Refresh</button>
              </div>
            </div>

            {/* 5TB JIO STORAGE BAR */}
            <div className="bg-[#0d1626]/85 border border-sky-500/30 rounded-2xl p-5 mb-6 shadow-xl">
              <div className="flex justify-between items-center mb-2">
                <span className="font-bold text-sm text-white">💾 Jio 5TB Storage Meter (Calculated)</span>
                <span className="font-extrabold text-xs text-cyan-400">{totalGB.toFixed(1)} GB / 5000 GB ({storagePct}%)</span>
              </div>
              <div className="w-full h-2.5 bg-white/10 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-blue-600 transition-all duration-500"
                  style={{ width: `${storagePct}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <div className="bg-[#0d1626]/85 border border-sky-500/20 p-4 rounded-2xl">
                <div className="text-[11px] font-bold text-slate-400">🎬 MASTER MOVIES (c01)</div>
                <div className="text-2xl font-extrabold text-white mt-1">{moviesData.length}</div>
              </div>
              <div className="bg-[#0d1626]/85 border border-sky-500/20 p-4 rounded-2xl">
                <div className="text-[11px] font-bold text-amber-400">⚡ IMAX CORE (Lossless)</div>
                <div className="text-2xl font-extrabold text-amber-400 mt-1">{imaxData.length}</div>
              </div>
              <div className="bg-[#0d1626]/85 border border-sky-500/20 p-4 rounded-2xl">
                <div className="text-[11px] font-bold text-purple-400">👑 FRANCHISE PACKS</div>
                <div className="text-2xl font-extrabold text-purple-400 mt-1">{packMap.size}</div>
              </div>
              <div className="bg-[#0d1626]/85 border border-sky-500/20 p-4 rounded-2xl">
                <div className="text-[11px] font-bold text-red-400">📥 PENDING ARRIVALS</div>
                <div className="text-2xl font-extrabold text-red-400 mt-1">{inboxArrivals.length}</div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: DRIVE ARRIVALS */}
        {activeTab === "arrivals" && (
          <div>
            <div className="flex justify-between items-end mb-6">
              <div>
                <h1 className="text-2xl font-black">📡 Google Drive Arrivals & Audit</h1>
                <p className="text-xs text-slate-400 mt-1">Unprocessed files waiting for ingest into data_c01.json</p>
              </div>
              <div className="flex gap-2">
                <button onClick={executeOneClickBatchSyncAll} className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 rounded-xl uppercase tracking-wider shadow-lg transition">
                  🚀 1-Click Sync All Arrivals
                </button>
                <button onClick={loadAllChunks} className="bg-slate-800 text-xs px-3 py-2 rounded-xl border border-sky-500/30">
                  🔄 Refresh List
                </button>
              </div>
            </div>

            <div className="bg-[#0d1626]/85 border border-sky-500/20 rounded-2xl overflow-hidden shadow-2xl">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sky-500/20 text-slate-400 bg-black/20">
                    <th className="p-3.5">Drive ID</th>
                    <th className="p-3.5">Raw File Name</th>
                    <th className="p-3.5">Detected Title</th>
                    <th className="p-3.5">Size</th>
                    <th className="p-3.5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {inboxArrivals.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-emerald-400 font-bold">
                        🎉 All Google Drive files are 100% Synced!
                      </td>
                    </tr>
                  ) : (
                    inboxArrivals.map((item, idx) => (
                      <tr key={idx} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="p-3.5 font-mono text-cyan-400">{item.gdrive_id?.substring(0, 14)}...</td>
                        <td className="p-3.5 font-semibold text-white max-w-xs truncate">{item.title}</td>
                        <td className="p-3.5 text-amber-400">{item.title.replace(/\.mkv|\.mp4/gi, "")}</td>
                        <td className="p-3.5">
                          <span className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/30 px-2 py-0.5 rounded font-bold font-mono">
                            {cleanAndRoundSize(item.size)}
                          </span>
                        </td>
                        <td className="p-3.5 text-right">
                          <button
                            onClick={() => {
                              setActiveTab("add");
                              parseSmartFileName(item.title);
                              setGdriveUrl(item.gdrive_id);
                              setFileSize(cleanAndRoundSize(item.size));
                            }}
                            className="bg-cyan-500/15 hover:bg-cyan-400 text-cyan-300 hover:text-black border border-cyan-500/30 px-3 py-1.5 rounded-lg font-bold text-xs transition"
                          >
                            ⚡ Load Form ➔
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: MOVIES, PACKS & REGIONS */}
        {activeTab === "movies" && (
          <div>
            <div className="flex justify-between items-end mb-5">
              <div>
                <h1 className="text-2xl font-black">Movies & Collections</h1>
                <p className="text-xs text-slate-400 mt-1">Dynamic Franchise Collections, IMAX Core, Languages, and Genres</p>
              </div>
            </div>

            {/* Category Pills Bar */}
            <div className="flex gap-2 mb-4 overflow-x-auto pb-2 scrollbar-none">
              <button onClick={() => setCurrentCategory("packs")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "packs" ? "bg-purple-600 text-white shadow-lg shadow-purple-500/30" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>👑 Franchise Collections</button>
              <button onClick={() => setCurrentCategory("imax")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "imax" ? "bg-amber-600 text-white shadow-lg shadow-amber-500/30" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>⚡ IMAX Core</button>
              <button onClick={() => setCurrentCategory("all")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "all" ? "bg-cyan-600 text-white shadow-lg shadow-cyan-500/30" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>🍿 All Movies</button>
              <button onClick={() => setCurrentCategory("lang_ta")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "lang_ta" ? "bg-cyan-600 text-white" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>🌴 Tamil</button>
              <button onClick={() => setCurrentCategory("lang_te")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "lang_te" ? "bg-cyan-600 text-white" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>🏛️ Telugu</button>
              <button onClick={() => setCurrentCategory("lang_hi")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "lang_hi" ? "bg-cyan-600 text-white" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>✨ Hindi</button>
              <button onClick={() => setCurrentCategory("lang_en")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "lang_en" ? "bg-cyan-600 text-white" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>🌐 English</button>
              <button onClick={() => setCurrentCategory("kids")} className={`px-4 py-2 rounded-full text-xs font-bold transition whitespace-nowrap ${currentCategory === "kids" ? "bg-emerald-600 text-white" : "bg-[#0d1626] border border-sky-500/20 text-slate-400"}`}>🧸 Kids</button>
            </div>

            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Search by movie title, year, audio, collection..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 px-4 py-3 rounded-2xl text-sm text-white focus:outline-none focus:border-cyan-400"
              />
            </div>

            {/* DYNAMIC PACKS VIEW */}
            {currentCategory === "packs" ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {Array.from(packMap.entries())
                  .filter(([packTitle]) => !searchQuery || packTitle.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(([packTitle, ownedList], idx) => {
                    const poster = ownedList[0]?.poster || "";
                    return (
                      <div key={idx} className="bg-gradient-to-b from-purple-950/20 to-[#0f172a] border border-purple-500/40 rounded-2xl overflow-hidden shadow-2xl flex flex-col justify-between hover:scale-[1.02] transition">
                        <div className="h-64 bg-slate-900 relative">
                          <span className="absolute top-2.5 left-2.5 bg-black/80 border border-purple-400 text-purple-300 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                            👑 FRANCHISE
                          </span>
                          <span className="absolute top-2.5 right-2.5 bg-emerald-950/80 border border-emerald-400 text-emerald-300 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                            🟢 {ownedList.length} IN LIBRARY
                          </span>
                          {poster ? (
                            <img src={poster} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">No Poster</div>
                          )}
                        </div>
                        <div className="p-4 flex flex-col justify-between flex-1">
                          <div>
                            <h3 className="font-bold text-sm text-white truncate">{packTitle}</h3>
                            <p className="text-xs text-slate-400 mt-1">{ownedList.length} Movie(s) in Library</p>
                          </div>
                          <button
                            onClick={() => openDynamicPackModal(packTitle)}
                            className="w-full mt-4 bg-purple-600/20 hover:bg-purple-600 text-purple-300 hover:text-white border border-purple-500/40 py-2 rounded-xl text-xs font-bold transition"
                          >
                            🔍 Open Pack & Checklist
                          </button>
                        </div>
                      </div>
                    );
                  })}
              </div>
            ) : (
              /* REGULAR MOVIES GRID */
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                {(currentCategory === "imax"
                  ? imaxData
                  : currentCategory === "lang_ta"
                  ? tamilData
                  : currentCategory === "lang_te"
                  ? teluguData
                  : currentCategory === "lang_hi"
                  ? hindiData
                  : currentCategory === "lang_en"
                  ? englishData
                  : currentCategory === "kids"
                  ? kidsData
                  : moviesData
                )
                  .filter((m) => !searchQuery || m.title?.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((m, idx) => {
                    const vCount = m.versions?.length || 1;
                    return (
                      <div key={idx} className="bg-[#0d1626]/85 border border-sky-500/20 rounded-2xl overflow-hidden shadow-xl flex flex-col justify-between hover:border-cyan-400 transition">
                        <div className="h-64 bg-slate-900 relative">
                          {m.collection && (
                            <span className="absolute top-2.5 left-2.5 bg-black/80 border border-cyan-400 text-cyan-300 text-[10px] font-extrabold px-2 py-0.5 rounded-lg">
                              👑 {m.collection}
                            </span>
                          )}
                          {m.poster ? (
                            <img src={m.poster} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs text-slate-500">No Poster</div>
                          )}
                        </div>
                        <div className="p-4 flex flex-col justify-between flex-1">
                          <div>
                            <h3 className="font-bold text-sm text-white truncate">{m.title}</h3>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[11px] font-bold">
                              <span className="text-slate-400">{m.year || 2024}</span>
                              <span>•</span>
                              <span className="text-cyan-400">{m.specs?.resolution || "1080p"}</span>
                              {vCount > 1 && (
                                <span className="bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded border border-emerald-500/40">
                                  ⚡ {vCount} VERSIONS
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] font-semibold">
                              <span className="bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/30">
                                {m.specs?.audio || "Dolby Atmos"}
                              </span>
                              <span className="bg-yellow-500/10 text-yellow-300 px-1.5 py-0.5 rounded border border-yellow-500/30">
                                {m.studio || "Prime"}
                              </span>
                              {m.specs?.size && (
                                <span className="bg-red-500/15 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 font-bold">
                                  {m.specs.size}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => {
                                setIsMergeMode(true);
                                setTargetExistingMovie(m);
                                setActiveTab("add");
                                setTmdbId(String(m.tmdb_id));
                                fetchTmdbMetadata(m.tmdb_id);
                              }}
                              className="flex-1 bg-cyan-500/15 text-cyan-300 hover:bg-cyan-500 hover:text-black py-1.5 rounded-lg text-xs font-bold transition border border-cyan-500/30"
                            >
                              + Version
                            </button>
                            <button
                              onClick={() => {
                                navigator.clipboard.writeText(m.stream_url || "");
                                showToast("Stream link copied!");
                              }}
                              className="bg-slate-800 text-slate-300 px-2.5 py-1.5 rounded-lg text-xs font-bold border border-white/10"
                            >
                              📋
                            </button>
                            <button
                              onClick={() => deleteMovie(m.id, m.tmdb_id, m.title)}
                              className="bg-red-500/15 hover:bg-red-600 text-red-400 hover:text-white px-2.5 py-1.5 rounded-lg text-xs font-bold border border-red-500/30 transition"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}

        {/* VIEW 4: ADD SINGLE MOVIE / MERGE FORM */}
        {activeTab === "add" && (
          <div className="max-w-4xl">
            <div className="mb-6">
              <h1 className="text-2xl font-black">
                {isMergeMode ? `⚡ Merge Version: ${targetExistingMovie?.title}` : "🎬 Ingest Movie to Master Library"}
              </h1>
              <p className="text-xs text-slate-400 mt-1">Direct commit to Master `chunks/data_c01.json` with multi-region syncing</p>
            </div>

            <form onSubmit={handleMovieSubmit} className="bg-[#0d1626]/85 border border-sky-500/30 rounded-3xl p-8 shadow-2xl space-y-6">
              <div>
                <label className="text-xs font-bold text-cyan-400 block mb-2">⚡ Release File Name (Auto-detects specs & searches TMDB)</label>
                <input
                  type="text"
                  value={smartFilename}
                  onChange={(e) => parseSmartFileName(e.target.value)}
                  placeholder="e.g. K.G.F.Chapter.1.2018.Tamil.2160p.WEB-DL.DDP5.1.x265.mkv"
                  className="w-full bg-[#091224] border border-cyan-500/40 p-3 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
                />

                {/* Suggestions Box */}
                {tmdbSuggestions.length > 0 && (
                  <div className="mt-2 bg-[#0b1329] border border-cyan-400 rounded-xl p-2 space-y-1">
                    {tmdbSuggestions.map((s) => (
                      <div
                        key={s.id}
                        onClick={() => {
                          setTmdbId(String(s.id));
                          fetchTmdbMetadata(s.id);
                          setTmdbSuggestions([]);
                        }}
                        className="p-2 hover:bg-white/10 rounded-lg cursor-pointer text-xs font-semibold text-white flex justify-between"
                      >
                        <span>🎯 {s.title} ({s.release_date?.split("-")[0] || "N/A"})</span>
                        <span className="text-cyan-400 font-mono">ID: {s.id}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">TMDB Movie ID</label>
                  <input
                    type="number"
                    value={tmdbId}
                    onChange={(e) => {
                      setTmdbId(e.target.value);
                      fetchTmdbMetadata(e.target.value);
                    }}
                    required
                    placeholder="e.g. 564147"
                    className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Franchise Collection Name</label>
                  <input
                    type="text"
                    value={collectionName}
                    onChange={(e) => setCollectionName(e.target.value)}
                    placeholder="e.g. K.G.F Collection"
                    className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white"
                  />
                </div>
              </div>

              {/* Regional Sync Checkboxes */}
              <div>
                <label className="text-xs font-bold text-amber-400 block mb-2">⚡ Regional Language Sync (Chunks in /chunks):</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#0b1329]/60 p-4 rounded-xl border border-sky-500/20 text-xs font-bold">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.ta} onChange={(e) => setRegionChecks({ ...regionChecks, ta: e.target.checked })} />
                    <span>🌴 Tamil</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.te} onChange={(e) => setRegionChecks({ ...regionChecks, te: e.target.checked })} />
                    <span>🏛️ Telugu</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.hi} onChange={(e) => setRegionChecks({ ...regionChecks, hi: e.target.checked })} />
                    <span>✨ Hindi</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.en} onChange={(e) => setRegionChecks({ ...regionChecks, en: e.target.checked })} />
                    <span>🌐 English</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.ml} onChange={(e) => setRegionChecks({ ...regionChecks, ml: e.target.checked })} />
                    <span>🥥 Malayalam</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.kn} onChange={(e) => setRegionChecks({ ...regionChecks, kn: e.target.checked })} />
                    <span>🏔️ Kannada</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regionChecks.kids} onChange={(e) => setRegionChecks({ ...regionChecks, kids: e.target.checked })} />
                    <span>🧸 Kids</span>
                  </label>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Quality Format</label>
                  <select value={quality} onChange={(e) => setQuality(e.target.value)} className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white">
                    <option>4K UHD</option>
                    <option>1080p FHD</option>
                    <option>720p HD</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Audio Format</label>
                  <select value={audio} onChange={(e) => setAudio(e.target.value)} className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white">
                    <option>Dolby Atmos</option>
                    <option>DTS-HD Master / 1509k DTS</option>
                    <option>Dolby Digital Plus</option>
                    <option>Dolby Digital</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-400 block mb-1">Studio / OTT Source</label>
                  <select value={sourceStudio} onChange={(e) => setSourceStudio(e.target.value)} className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white">
                    <option>Amazon Prime Video</option>
                    <option>Netflix</option>
                    <option>Sun NXT</option>
                    <option>Disney+ Hotstar</option>
                    <option>SonyLIV</option>
                    <option>Zee5</option>
                    <option>Apple TV+</option>
                    <option>WEB-DL</option>
                    <option>BluRay</option>
                  </select>
                </div>
              </div>

              {/* Dynamic 1GB to 50GB Slider with Auto-Rounding */}
              <div>
                <div className="flex justify-between items-center mb-1 text-xs">
                  <span className="font-bold text-slate-400">File Size (1GB to 50GB Auto-Rounded)</span>
                  <span className="font-extrabold text-cyan-400">{fileSize}</span>
                </div>
                <div className="flex items-center gap-4">
                  <input
                    type="range"
                    min="1"
                    max="50"
                    step="1"
                    value={parseInt(fileSize, 10) || 10}
                    onChange={(e) => setFileSize(`${e.target.value}GB`)}
                    className="flex-1 accent-cyan-400"
                  />
                  <input
                    type="text"
                    value={fileSize}
                    onChange={(e) => setFileSize(cleanAndRoundSize(e.target.value))}
                    className="w-20 bg-[#091224] border border-sky-500/20 p-2 rounded-xl text-xs text-center font-bold text-white"
                  />
                </div>
              </div>

              {/* IMAX Core Check */}
              <label className="flex items-center gap-3 bg-amber-500/10 border border-amber-500/30 p-3 rounded-xl cursor-pointer">
                <input type="checkbox" checked={isImax} onChange={(e) => setIsImax(e.target.checked)} />
                <span className="text-xs font-bold text-amber-300">⚡ Push to IMAX Core Chunk (chunks/data_c01_imax.json)</span>
              </label>

              {/* Drive Link */}
              <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">Google Drive Link or File ID</label>
                <input
                  type="text"
                  value={gdriveUrl}
                  onChange={(e) => setGdriveUrl(e.target.value)}
                  placeholder="Paste full Google Drive link or File ID"
                  required
                  className="w-full bg-[#091224] border border-sky-500/20 p-3 rounded-xl text-xs text-white"
                />
              </div>

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="flex-1 bg-gradient-to-r from-cyan-400 to-blue-600 hover:opacity-95 text-black font-extrabold py-3.5 rounded-xl text-xs uppercase tracking-wider shadow-lg transition"
                >
                  {isMergeMode ? "⚡ ONE-CLICK MERGE VERSION" : "🚀 COMMIT TO MASTER (C01)"}
                </button>
                {isMergeMode && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsMergeMode(false);
                      setTargetExistingMovie(null);
                    }}
                    className="bg-slate-800 text-slate-300 px-6 py-3.5 rounded-xl text-xs font-bold border border-white/10"
                  >
                    Cancel Merge
                  </button>
                )}
              </div>
            </form>
          </div>
        )}

        {/* DYNAMIC PACK CHECKLIST MODAL */}
        {packModalOpen && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-4">
            <div className="bg-[#0f172a] border border-cyan-400/40 rounded-3xl max-w-2xl w-full p-6 shadow-2xl max-h-[85vh] overflow-y-auto">
              <div className="flex justify-between items-start border-b border-white/10 pb-4 mb-4">
                <div>
                  <h2 className="text-lg font-black text-white">{packModalTitle}</h2>
                  <span className="text-xs text-cyan-400 font-bold">Dynamic Franchise Checklist</span>
                </div>
                <button onClick={() => setPackModalOpen(false)} className="text-slate-400 hover:text-white text-lg">✕</button>
              </div>

              <div className="mb-6">
                <div className="text-xs font-bold text-emerald-400 mb-2">✅ OWNED IN YOUR MASTER LIBRARY:</div>
                <div className="space-y-2">
                  {packOwnedList.map((m, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 border border-white/10 p-3 rounded-xl">
                      <div>
                        <div className="text-xs font-bold text-white">{m.title} ({m.year})</div>
                        <div className="text-[10px] text-emerald-400">Ready in Master Library</div>
                      </div>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(m.stream_url || "");
                          showToast("Stream link copied!");
                        }}
                        className="bg-cyan-500/20 text-cyan-300 px-3 py-1 rounded-lg text-xs font-bold border border-cyan-500/30"
                      >
                        📋 Stream
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="text-xs font-bold text-red-400 mb-2">❌ MISSING MOVIES IN THIS FRANCHISE:</div>
                {loadingMissingPack ? (
                  <div className="text-xs text-cyan-400 animate-pulse">Checking TMDB live collection parts...</div>
                ) : packMissingList.length === 0 ? (
                  <div className="text-xs text-emerald-400 font-bold">🎉 100% Complete! You own all movies in this collection.</div>
                ) : (
                  <div className="space-y-2">
                    {packMissingList.map((m, i) => (
                      <div key={i} className="flex justify-between items-center bg-red-950/20 border border-red-500/30 p-3 rounded-xl">
                        <div>
                          <div className="text-xs font-bold text-red-300">{m.title} ({m.release_date?.split("-")[0] || "N/A"})</div>
                          <div className="text-[10px] text-slate-500">TMDB ID: {m.id} • Missing from Library</div>
                        </div>
                        <span className="text-[11px] font-bold text-red-400">Not Added</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
