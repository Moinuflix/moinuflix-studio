"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

export default function LedgerAutoFillStudio() {
  // Input row fields (matching Ledger screenshot)
  const [tmdbId, setTmdbId] = useState("");
  const [driveId, setDriveId] = useState("");
  const [standardName, setStandardName] = useState("");
  const [targetChunk, setTargetChunk] = useState("chunk_01.json");
  const [category, setCategory] = useState<"MOVIE" | "SERIES" | "SONG">("MOVIE");

  // Auto-filled States
  const [cleanTitle, setCleanTitle] = useState("");
  const [year, setYear] = useState("2024");
  const [rating, setRating] = useState("7.5");
  const [source, setSource] = useState("WEB-DL");
  const [resolution, setResolution] = useState("1080p");
  const [audioSpecs, setAudioSpecs] = useState("");
  const [fileSize, setFileSize] = useState("10 GB");

  // Artwork
  const [poster, setPoster] = useState("");
  const [fanart, setFanart] = useState("");
  const [clearlogo, setClearlogo] = useState("");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Parse Standard Kodi Dash Name (e.g. Elysium (2013) [1080p] [BluRay] [Tamil 2.0 - 224Kbps] [5 GB].mkv)
  const parseStandardDashName = (nameStr: string) => {
    setStandardName(nameStr);
    if (!nameStr) return;

    // 1. Resolution
    if (/2160p|4k/i.test(nameStr)) setResolution("2160p 4K");
    else if (/720p/i.test(nameStr)) setResolution("720p HD");
    else setResolution("1080p FHD");

    // 2. Source
    if (/bluray/i.test(nameStr)) setSource("BluRay");
    else if (/amzn|prime/i.test(nameStr)) setSource("Amazon Prime Video");
    else if (/nf|netflix/i.test(nameStr)) setSource("Netflix");
    else if (/hotstar|dsnp/i.test(nameStr)) setSource("Disney+ Hotstar");
    else setSource("WEB-DL");

    // 3. Audio Specs inside square brackets
    const audioMatch = nameStr.match(/\[([^\]]*(?:5\.1|2\.0|7\.1|Atmos|DTS|Kbps)[^\]]*)\]/i);
    if (audioMatch) {
      setAudioSpecs(audioMatch[1]);
    }

    // 4. Clean Size
    const sizeMatch = nameStr.match(/\[(\d+\.?\d*\s*(?:GB|MB))\]/i);
    if (sizeMatch) {
      setFileSize(sizeMatch[1]);
    }
  };

  // 1-Click Auto Fill from TMDB ID
  const handleAutoFillFromTmdb = async () => {
    if (!tmdbId.trim()) return alert("Pehle TMDB ID enter karein!");
    setLoading(true);
    setStatusMsg("⚡ Fetching TMDB details, IMDb ID & ClearLogo...");

    try {
      const endpoint = category === "SERIES" ? "tv" : "movie";
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId.trim()}?api_key=${TMDB_KEY}&language=en-US`);
      if (!res.ok) throw new Error("TMDB ID not found");
      const d = await res.json();

      const movieTitle = d.title || d.name || "";
      const relYear = (d.release_date || d.first_air_date || "2024").split("-")[0];
      setCleanTitle(movieTitle);
      setYear(relYear);
      setRating(d.vote_average ? d.vote_average.toFixed(1) : "7.5");

      if (d.poster_path) setPoster(`https://image.tmdb.org/t/p/w500${d.poster_path}`);
      if (d.backdrop_path) setFanart(`https://image.tmdb.org/t/p/original${d.backdrop_path}`);

      // Fanart ClearLogo
      try {
        const fRes = await fetch(`https://webservice.fanart.tv/v3/${category === "SERIES" ? "tv" : "movies"}/${tmdbId.trim()}?api_key=${FANART_KEY}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          const logo = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || fData.hdtvlogo?.[0]?.url || "";
          if (logo) setClearlogo(logo);
        }
      } catch (_) {}

      // Agar standard name abhi tak khali hai toh auto-generate kar dein
      if (!standardName) {
        const autoDash = `${movieTitle} (${relYear}) [${resolution.split(" ")[0]}] [${source}] [${audioSpecs || "Tamil 5.1 - 640Kbps"}] [${fileSize}].mkv`;
        setStandardName(autoDash);
      }

      setStatusMsg("✅ Metadata & Artworks successfully auto-filled!");
    } catch (e: any) {
      setStatusMsg(`❌ Error: ${e.message}`);
    }
    setLoading(false);
  };

  // Submit to Backend (Targeting resources/data/catalog.json and Target Chunk)
  const handleCommitToLibrary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driveId.trim()) return alert("Google Drive File ID enter karein!");

    setSubmitting(true);
    setStatusMsg(`Committing to resources/data/chunks/${targetChunk}...`);

    const payload = {
      movie: {
        id: parseInt(tmdbId, 10) || Date.now(),
        title: cleanTitle || standardName.split(" (")[0],
        year,
        runtime: 120,
        rating,
        cert: "UA",
        lang: "ta",
        poster,
        fanart,
        plot: "Standard Library Stream",
        genres: ["Action"]
      },
      specs: {
        source,
        audioCodec: audioSpecs || "Tamil 5.1 - 640Kbps",
        fileSize,
        resolution: resolution.split(" ")[0],
        audioTrackString: audioSpecs || "Tamil 5.1 - 640Kbps",
        clearLogo: clearlogo
      },
      versions: [
        {
          language: "Tamil",
          resolution: resolution.split(" ")[0],
          source,
          audio: audioSpecs || "Tamil 5.1 - 640Kbps",
          size: fileSize,
          driveId: driveId.trim()
        }
      ],
      rawFilename: standardName,
      targetChunkFile: `resources/data/chunks/${targetChunk}`,
      category: category.toLowerCase()
    };

    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`🎉 SUCCESS! Committed to resources/data/catalog.json & ${targetChunk}!`);
        // Reset inputs for next row
        setTmdbId("");
        setDriveId("");
        setStandardName("");
        setAudioSpecs("");
        setPoster("");
        setFanart("");
        setClearlogo("");
      } else {
        setStatusMsg(`❌ Failed: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`❌ Network Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Top Ledger Header */}
        <div className="bg-[#0c1322] border border-sky-500/20 rounded-2xl p-5 shadow-xl flex justify-between items-center">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <span className="bg-red-600 px-2 py-0.5 rounded text-xs">MOINUFLIX</span>
              Master Ledger Auto-Fill Ingestion
            </h1>
            <p className="text-xs text-sky-400 font-mono mt-1">
              Ledger Row → 1-Click Auto Fill → Direct Target Chunk Commit
            </p>
          </div>
          <span className="text-xs font-mono bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl text-emerald-400 font-bold">
            Target: resources/data/
          </span>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-sky-500/30 text-xs font-mono font-bold text-amber-300">
            {statusMsg}
          </div>
        )}

        {/* LEDGER ROW INPUT BOX */}
        <form onSubmit={handleCommitToLibrary} className="bg-[#080e1c] border border-sky-500/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          <div className="border-b border-slate-800 pb-3">
            <h2 className="text-sm font-bold uppercase tracking-wider text-cyan-400">
              📋 Step 1: Copy-Paste Values From Your Ledger PDF Row
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">CAT</label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-bold text-white"
              >
                <option value="MOVIE">MOVIE</option>
                <option value="SERIES">SERIES</option>
                <option value="SONG">SONG</option>
              </select>
            </div>

            <div>
              <label className="text-[11px] font-bold text-amber-400 block mb-1">TMDB ID</label>
              <input
                type="number"
                placeholder="e.g. 68724"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                className="w-full bg-[#0d1626] border border-amber-500/40 p-2.5 rounded-xl text-xs font-bold text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="text-[11px] font-bold text-cyan-400 block mb-1">GOOGLE DRIVE FILE ID</label>
              <input
                type="text"
                placeholder="e.g. 1weC0Qp05eEMwTb0Q17krWXGcM5SDFVV0"
                value={driveId}
                onChange={(e) => setDriveId(e.target.value)}
                className="w-full bg-[#0d1626] border border-cyan-500/40 p-2.5 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-cyan-400"
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-400 block mb-1">
              STANDARD KODI DASH NAME (CHANNEL - KBPS)
            </label>
            <input
              type="text"
              placeholder="e.g. Elysium (2013) [1080p] [BluRay] [Tamil 2.0 - 224Kbps + Telugu 2.0 - 224Kbps + Hindi 5.1 - 640Kbps] [5 GB].mkv"
              value={standardName}
              onChange={(e) => parseStandardDashName(e.target.value)}
              className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-mono text-emerald-300"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[11px] font-bold text-purple-400 block mb-1">TARGET CHUNK</label>
              <input
                type="text"
                value={targetChunk}
                onChange={(e) => setTargetChunk(e.target.value)}
                placeholder="e.g. chunk_01.json"
                className="w-full bg-[#0d1626] border border-purple-500/40 p-2.5 rounded-xl text-xs font-mono text-purple-300 font-bold"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleAutoFillFromTmdb}
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs shadow transition"
              >
                {loading ? "Fetching TMDB..." : "⚡ 1-Click Auto Fill Metadata & Artwork"}
              </button>
            </div>
          </div>

          {/* VERIFICATION & PREVIEW SECTION */}
          {(cleanTitle || poster) && (
            <div className="bg-[#0d1626] border border-slate-800 rounded-2xl p-4 space-y-4">
              <div className="flex items-start gap-4">
                {poster && <img src={poster} className="w-16 h-24 object-cover rounded-lg border border-slate-700 shadow" alt="" />}
                <div className="space-y-1 overflow-hidden flex-1">
                  <div className="text-sm font-black text-white">{cleanTitle} ({year})</div>
                  <div className="flex gap-2 text-xs font-bold text-slate-400">
                    <span className="text-amber-400">★ {rating}</span>
                    <span>•</span>
                    <span className="text-cyan-400">{resolution}</span>
                    <span>•</span>
                    <span>{source}</span>
                    <span>•</span>
                    <span className="text-red-400">{fileSize}</span>
                  </div>
                  <div className="text-xs font-mono text-emerald-400 truncate">{audioSpecs || "Standard Multi Audio"}</div>
                  {clearlogo && (
                    <div className="pt-1">
                      <img src={clearlogo} className="h-8 object-contain bg-black/40 px-2 py-0.5 rounded border border-slate-800" alt="" />
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* COMMIT BUTTON */}
          <button
            type="submit"
            disabled={submitting || !driveId.trim()}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-2xl transition disabled:opacity-50"
          >
            {submitting ? "Writing to GitHub..." : `🚀 COMMIT TO ${targetChunk.toUpperCase()} (STEP 8)`}
          </button>
        </form>
      </div>
    </div>
  );
}
