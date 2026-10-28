"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

export default function SmartAutoFilterStudio() {
  const [rawDriveInput, setRawDriveInput] = useState("");
  const [driveId, setDriveId] = useState("");
  const [step2Ready, setStep2Ready] = useState(false);
  const [loading, setLoading] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // Step 2 Clean Parsed State
  const [parsedData, setParsedData] = useState<any>({
    cleanTitle: "",
    year: "2024",
    resolution: "1080p",
    source: "BluRay",
    audioString: "",
    cleanSize: "5 GB",
    standardDashName: "",
    tmdbId: 0,
    rating: "7.0",
    poster: "",
    fanart: "",
    clearlogo: "",
    targetChunk: "resources/data/chunks/chunk_01.json"
  });

  // Intelligent Regex Parser for Audio, Codec & Clean GB
  const parseRawDriveName = (raw: string) => {
    if (!raw.trim()) return null;

    // 1. Title & Year
    const yearMatch = raw.match(/\b(19\d\d|20\d\d)\b/);
    const yr = yearMatch ? yearMatch[1] : "2024";
    let titlePart = raw.split(/\b(19\d\d|20\d\d|1080p|2160p|4k|bluray|web-dl)\b/i)[0]
      .replace(/[\._\-]/g, " ")
      .trim();

    // 2. Resolution & Source
    let res = "1080p";
    if (/2160p|4k/i.test(raw)) res = "2160p 4K";
    else if (/720p/i.test(raw)) res = "720p";

    let src = "WEB-DL";
    if (/bluray/i.test(raw)) src = "BluRay";
    else if (/amzn|prime/i.test(raw)) src = "AMZN";
    else if (/nf|netflix/i.test(raw)) src = "Netflix";
    else if (/hotstar|dsnp/i.test(raw)) src = "Hotstar";

    // 3. Size Auto-Rounding (4.6GB -> 5 GB)
    let cleanSize = "5 GB";
    const sizeMatch = raw.match(/(\d+\.?\d*)\s*(?:gb|mb)/i);
    if (sizeMatch) {
      let num = parseFloat(sizeMatch[1]);
      if (/mb/i.test(sizeMatch[0])) num = num / 1024;
      cleanSize = `${Math.round(num)} GB`;
    }

    // 4. Complex Multi-Audio Parser with Channels & Kbps
    const parsedTracks: string[] = [];
    const langMap: Record<string, string> = {
      tam: "Tamil",
      tamil: "Tamil",
      tel: "Telugu",
      telugu: "Telugu",
      hin: "Hindi",
      hindi: "Hindi",
      eng: "English",
      english: "English",
      mal: "Malayalam",
      kan: "Kannada"
    };

    // Extract inside brackets or tags
    const bracketContent = raw.match(/\[(.*?)\]/);
    const searchArea = bracketContent ? bracketContent[1] : raw;

    Object.keys(langMap).forEach((key) => {
      const reg = new RegExp(`\\b${key}\\b`, "i");
      if (reg.test(searchArea)) {
        const fullLang = langMap[key];
        if (!parsedTracks.some(t => t.startsWith(fullLang))) {
          // Detect channels & bitrate nearby
          let ch = "5.1";
          if (new RegExp(`${key}[^\\+\\)]*2\\.0`, "i").test(searchArea)) ch = "2.0";
          else if (new RegExp(`${key}[^\\+\\)]*7\\.1`, "i").test(searchArea)) ch = "7.1";

          let br = "640Kbps";
          const brMatch = searchArea.match(new RegExp(`${key}[^\\+\\)]*?(\\d{3,4})\\s*k`, "i"));
          if (brMatch) br = `${brMatch[1]}Kbps`;
          else if (ch === "2.0") br = "224Kbps";

          parsedTracks.push(`${fullLang} ${ch} - ${br}`);
        }
      }
    });

    const finalAudio = parsedTracks.length > 0 ? parsedTracks.join(" + ") : "Tamil 5.1 - 640Kbps";
    const standardDashName = `${titlePart} (${yr}) [${res.split(" ")[0]}] [${src}] [${finalAudio}] [${cleanSize}].mkv`;

    return {
      cleanTitle: titlePart,
      year: yr,
      resolution: res,
      source: src,
      audioString: finalAudio,
      cleanSize,
      standardDashName
    };
  };

  // Step 2 Trigger: Trigger from Raw GDrive Name -> Auto Filter -> TMDb Match
  const triggerAutoFilterPipeline = async () => {
    if (!rawDriveInput.trim()) return alert("Pehle raw Google Drive name paste karein!");
    setLoading(true);
    setStatusMsg("⚡ Filtering specs & searching TMDb/Fanart...");

    const parsed = parseRawDriveName(rawDriveInput);
    if (!parsed) {
      setLoading(false);
      return;
    }

    try {
      // TMDb Match
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(parsed.cleanTitle)}&year=${parsed.year}&language=en-US`);
      const data = await res.json();
      const top = data.results?.[0];

      let poster = "";
      let fanart = "";
      let tmdbId = 0;
      let rating = "7.2";
      let logo = "";

      if (top) {
        tmdbId = top.id;
        rating = top.vote_average ? top.vote_average.toFixed(1) : "7.2";
        if (top.poster_path) poster = `https://image.tmdb.org/t/p/w500${top.poster_path}`;
        if (top.backdrop_path) fanart = `https://image.tmdb.org/t/p/original${top.backdrop_path}`;

        // Fanart ClearLogo
        try {
          const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${top.id}?api_key=${FANART_KEY}`);
          if (fRes.ok) {
            const fData = await fRes.json();
            logo = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
          }
        } catch (_) {}
      }

      setParsedData({
        ...parsed,
        tmdbId,
        rating,
        poster,
        fanart,
        clearlogo: logo,
        targetChunk: "resources/data/chunks/chunk_01.json"
      });

      setStep2Ready(true);
      setStatusMsg("✅ Step 2 Ready: Auto-filtered to Standard Dash format & Metadata confirmed!");
    } catch (err: any) {
      setStatusMsg(`❌ Error: ${err.message}`);
    }
    setLoading(false);
  };

  // Final Commit to resources/data/
  const handleCommitToLibrary = async () => {
    if (!driveId.trim()) return alert("Google Drive File ID enter karein!");
    setCommitting(true);
    setStatusMsg("Committing to resources/data/catalog.json and chunk_01.json...");

    const payload = {
      movie: {
        id: parsedData.tmdbId || Date.now(),
        title: parsedData.cleanTitle,
        year: parsedData.year,
        runtime: 120,
        rating: parsedData.rating,
        cert: "UA",
        lang: "ta",
        poster: parsedData.poster,
        fanart: parsedData.fanart,
        plot: "Auto-ingested standard movie release",
        genres: ["Action", "Sci-Fi"]
      },
      specs: {
        source: parsedData.source,
        audioCodec: parsedData.audioString,
        fileSize: parsedData.cleanSize,
        resolution: parsedData.resolution.split(" ")[0],
        audioTrackString: parsedData.audioString,
        clearLogo: parsedData.clearlogo
      },
      versions: [
        {
          language: "Tamil",
          resolution: parsedData.resolution.split(" ")[0],
          source: parsedData.source,
          audio: parsedData.audioString,
          size: parsedData.cleanSize,
          driveId: driveId.trim()
        }
      ],
      rawFilename: parsedData.standardDashName,
      category: "movie"
    };

    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg("🎉 ALL STEP COMPLETE! Successfully committed to resources/data/!");
        setStep2Ready(false);
        setRawDriveInput("");
        setDriveId("");
      } else {
        setStatusMsg(`❌ Save failed: ${data.error}`);
      }
    } catch (e: any) {
      setStatusMsg(`❌ Network error: ${e.message}`);
    }
    setCommitting(false);
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* Banner */}
        <div className="bg-[#0c1322] border border-sky-500/20 rounded-2xl p-5 shadow-xl flex justify-between items-center">
          <div>
            <div className="flex items-center gap-3">
              <span className="bg-red-600 px-2 py-0.5 rounded text-xs font-black">MOINUFLIX</span>
              <h1 className="text-lg font-black text-white">Drive Name Auto-Filter Pipeline</h1>
            </div>
            <p className="text-xs text-sky-400 font-mono mt-1">Raw Drive Format ➔ Standard Kodi Dash Name Auto-Filter</p>
          </div>
          <span className="text-xs font-mono bg-slate-900 border border-slate-700 px-3 py-1 rounded-xl text-emerald-400 font-bold">
            resources/data/
          </span>
        </div>

        {statusMsg && (
          <div className="p-3.5 rounded-xl bg-slate-900 border border-sky-500/30 text-xs font-mono font-bold text-amber-300">
            {statusMsg}
          </div>
        )}

        {/* STEP 1: RAW DRIVE INPUT */}
        <div className="bg-[#080e1c] border border-sky-500/20 rounded-3xl p-6 shadow-2xl space-y-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white font-black text-xs flex items-center justify-center">1</span>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">
              Paste Raw Google Drive Name (With Audio Specs & Size)
            </h2>
          </div>

          <textarea
            rows={3}
            placeholder="e.g. Elysium (2013) 1080p BluRay x264 [Tamil + Tel (DD 2.0 - 224k) + Hin (DD+5.1 - 640k) + Eng (DD+5.1 - 384k)] 4.6GB"
            value={rawDriveInput}
            onChange={(e) => setRawDriveInput(e.target.value)}
            className="w-full bg-[#0d1626] border border-sky-500/30 rounded-xl p-3 text-xs font-mono text-white focus:outline-none focus:border-cyan-400 placeholder-slate-600"
          />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-400 block mb-1">Google Drive File ID</label>
              <input
                type="text"
                placeholder="e.g. 1weC0Qp05eEMwTb0Q17krWXGcM5SDFVV0"
                value={driveId}
                onChange={(e) => setDriveId(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 rounded-xl p-2.5 text-xs font-mono text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={triggerAutoFilterPipeline}
                disabled={loading}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-extrabold py-2.5 rounded-xl text-xs transition shadow-lg"
              >
                {loading ? "Parsing & Matching..." : "⚡ Trigger Auto-Filter & TMDb Ingest"}
              </button>
            </div>
          </div>
        </div>

        {/* STEP 2: VERIFICATION & AUTO-FILL CONFIRMATION */}
        {step2Ready && (
          <div className="bg-[#080e1c] border border-emerald-500/40 rounded-3xl p-6 shadow-2xl space-y-6 animate-fadeIn">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-500 text-black font-black text-xs flex items-center justify-center">2</span>
                <h2 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400">
                  Step 2: Auto-Filtered Standard Kodi Dash Result (Ready to Commit)
                </h2>
              </div>
              <span className="bg-emerald-950 text-emerald-300 border border-emerald-800 text-[10px] font-mono px-2 py-0.5 rounded font-bold">
                ✓ ALL FIELDS AUTO-FILLED
              </span>
            </div>

            {/* Standard Dash Box */}
            <div>
              <label className="text-[11px] font-bold text-slate-400 block mb-1">
                Standard Kodi Dash File Name (Auto-Cleaned & Expanded)
              </label>
              <div className="bg-[#050b16] border border-emerald-500/30 p-3 rounded-xl font-mono text-xs text-emerald-300 break-all">
                {parsedData.standardDashName}
              </div>
            </div>

            {/* Visual Metadata & Signals Card */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#0d1626] p-4 rounded-2xl border border-slate-800">
              <div className="md:col-span-3">
                {parsedData.poster ? (
                  <img src={parsedData.poster} className="w-24 h-36 object-cover rounded-xl shadow border border-slate-700" alt="" />
                ) : (
                  <div className="w-24 h-36 bg-slate-900 rounded-xl border border-slate-800 flex items-center justify-center text-xs text-slate-600">No Poster</div>
                )}
              </div>

              <div className="md:col-span-9 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-base font-black text-white">{parsedData.cleanTitle} ({parsedData.year})</h3>
                  <span className="text-amber-400 text-xs font-bold">★ {parsedData.rating}</span>
                  <span className="bg-sky-950 text-cyan-300 border border-sky-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    TMDb: {parsedData.tmdbId}
                  </span>
                </div>

                <div className="flex flex-wrap gap-2 text-xs font-mono">
                  <span className="bg-slate-800 text-cyan-400 px-2 py-0.5 rounded border border-slate-700">{parsedData.resolution}</span>
                  <span className="bg-slate-800 text-amber-400 px-2 py-0.5 rounded border border-slate-700">{parsedData.source}</span>
                  <span className="bg-red-950 text-red-300 px-2 py-0.5 rounded border border-red-800 font-bold">{parsedData.cleanSize}</span>
                  <span className="bg-purple-950 text-purple-300 px-2 py-0.5 rounded border border-purple-800">Target: chunk_01.json</span>
                </div>

                <div className="text-xs font-mono text-emerald-400">
                  <b>Audio:</b> {parsedData.audioString}
                </div>

                {parsedData.clearlogo && (
                  <div className="pt-1">
                    <img src={parsedData.clearlogo} className="h-8 object-contain bg-black/40 px-2 py-0.5 rounded border border-slate-700" alt="" />
                  </div>
                )}
              </div>
            </div>

            {/* Final Commit Button */}
            <button
              onClick={handleCommitToLibrary}
              disabled={committing}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-500 hover:opacity-95 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-2xl transition disabled:opacity-50"
            >
              {committing ? "Writing to resources/data/..." : "🚀 SAVE TO JSON & COMMIT TO GITHUB (FINAL STEP)"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
