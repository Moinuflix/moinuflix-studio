"use client";
import React, { useState, useEffect } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const REPO_OWNER = "Moinuflix";
const REPO_NAME = "My-Movies";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/main`;

interface LedgerItem {
  id: string;
  cat: "MOVIE" | "SERIES" | "SONG";
  raw_title: string;
  clean_title: string;
  audio_specs: string;
  gdrive_id: string;
  size: string;
  tmdb_id: number;
  target_chunk: string;
  selected: boolean;
  poster?: string;
  year?: string;
}

export default function MoinuFlixLedgerStudio() {
  const [items, setItems] = useState<LedgerItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [batchSyncing, setBatchSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState("");
  const [filterCat, setFilterCat] = useState<"ALL" | "MOVIE" | "SERIES" | "SONG">("ALL");

  // Load Arrivals
  const loadLedgerArrivals = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${RAW_BASE}/inbox_arrivals.json?t=${Date.now()}`);
      if (res.ok) {
        const raw = await res.json();
        const list: LedgerItem[] = (Array.isArray(raw) ? raw : []).map((x: any, idx: number) => {
          const fn = x.title || x.name || "Untitled";
          let cat: "MOVIE" | "SERIES" | "SONG" = "MOVIE";
          let target = "resources/data/chunks/chunk_01.json";

          if (/^\d{2}_|audio|song|soundtrack|surround|bgm/i.test(fn) && !/1080p|2160p|bluray|amzn|nf/i.test(fn)) {
            cat = "SONG";
            target = "resources/data/data_c03.json";
          } else if (/s(\d{1,2})e(\d{1,2})|season/i.test(fn)) {
            cat = "SERIES";
            target = "resources/data/data_c02.json";
          }

          // Audio & Specs detection
          let audio = "Tamil 5.1 - 640Kbps";
          if (/atmos/i.test(fn)) audio = "Tamil 5.1 Atmos - 768Kbps";
          else if (/dts/i.test(fn)) audio = "DTS 5.1 - 1509Kbps";
          else if (/hindi/i.test(fn) && /telugu/i.test(fn)) audio = "Hin + Tel + Tam 5.1 - 640Kbps";

          let resTag = /2160p|4k/i.test(fn) ? "2160p 4K" : "1080p";
          let sz = x.size ? (String(x.size).includes("GB") || String(x.size).includes("MB") ? x.size : `${x.size} GB`) : "5 GB";

          let clean = fn.replace(/\.mkv|\.mp4/gi, "").replace(/[\._\-]/g, " ").replace(/\b(1080p|2160p|4k|web dl|ddp5 1|x264|x265)\b/gi, "").trim();

          return {
            id: String(idx + 199),
            cat,
            raw_title: fn,
            clean_title: `${clean} [${resTag}] [${sz}].mkv`,
            audio_specs: audio,
            gdrive_id: x.gdrive_id || x.id || "",
            size: sz,
            tmdb_id: 0,
            target_chunk: target,
            selected: true,
            poster: "",
            year: "2025"
          };
        });
        setItems(list);
      }
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadLedgerArrivals();
  }, []);

  // 1-Click Match TMDb
  const handleMatchTmdb = async () => {
    setSyncProgress("Matching TMDb metadata...");
    const updated = [...items];
    for (let i = 0; i < updated.length; i++) {
      const item = updated[i];
      if (item.cat !== "SONG") {
        const cleanQuery = item.raw_title.split(/[0-9]{4}|1080p|2160p|S\d\d/i)[0].replace(/[._-]/g, " ").trim();
        try {
          const endpoint = item.cat === "SERIES" ? "search/tv" : "search/movie";
          const res = await fetch(`https://api.themoviedb.org/3/${endpoint}?api_key=${TMDB_KEY}&query=${encodeURIComponent(cleanQuery)}&region=IN`);
          const data = await res.json();
          const top = data.results?.[0];
          if (top) {
            item.tmdb_id = top.id;
            item.year = (top.release_date || top.first_air_date || "2025").split("-")[0];
            item.poster = top.poster_path ? `https://image.tmdb.org/t/p/w92${top.poster_path}` : "";
            item.clean_title = `${top.title || top.name} (${item.year}) [${item.clean_title.includes("2160p") ? "2160p 4K" : "1080p"}] [${item.size}].mkv`;
          }
        } catch {}
      }
    }
    setItems(updated);
    setSyncProgress("✅ TMDb Matched!");
  };

  // Commit Selected
  const handleCommit = async () => {
    const selected = items.filter(x => x.selected);
    if (selected.length === 0) return alert("Pehle files select karein!");

    setBatchSyncing(true);
    let done = 0;

    for (let i = 0; i < selected.length; i++) {
      const item = selected[i];
      setSyncProgress(`Committing ${i + 1}/${selected.length}: ${item.clean_title.slice(0, 25)}...`);
      try {
        const payload = {
          movie: {
            id: item.tmdb_id || Date.now(),
            title: item.clean_title.split(" (")[0],
            year: item.year,
            runtime: 120,
            rating: "7.5",
            cert: "UA",
            lang: "ta",
            poster: item.poster,
            fanart: item.poster,
            plot: "Standard Library Stream",
            genres: ["Action"]
          },
          specs: {
            source: "WEB-DL",
            audioCodec: item.audio_specs,
            fileSize: item.size,
            resolution: item.clean_title.includes("2160p") ? "2160p" : "1080p",
            audioTrackString: item.audio_specs
          },
          versions: [
            {
              language: "Tamil",
              resolution: "1080p",
              source: "WEB-DL",
              audio: item.audio_specs,
              size: item.size,
              driveId: item.gdrive_id
            }
          ],
          rawFilename: item.clean_title,
          category: item.cat.toLowerCase()
        };

        const res = await fetch("/api/save-movie", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if ((await res.json()).success) done++;
      } catch (err) {
        console.error(err);
      }
    }

    setSyncProgress(`🎉 Complete! ${done} items successfully saved to exact target chunks!`);
    setBatchSyncing(false);
    const doneIds = new Set(selected.map(x => x.gdrive_id));
    setItems(prev => prev.filter(x => !doneIds.has(x.gdrive_id)));
  };

  const filtered = items.filter(x => filterCat === "ALL" || x.cat === filterCat);

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 p-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-sky-500/20 pb-4 mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
            <span className="text-xs text-cyan-400 font-bold font-mono tracking-widest uppercase">
              STEP 2: SMART RECONCILIATION TABLE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">PDF Ledger Standard Format • Target Chunk Auto-Partitioning</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleMatchTmdb}
            className="bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow transition"
          >
            ⚡ Match TMDb
          </button>
          <button
            onClick={handleCommit}
            disabled={batchSyncing || items.filter(x => x.selected).length === 0}
            className="bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-5 py-2.5 rounded-xl shadow uppercase tracking-wider transition disabled:opacity-50"
          >
            🚀 Commit Selected ({items.filter(x => x.selected).length})
          </button>
          <button onClick={loadLedgerArrivals} className="bg-slate-800 text-xs px-3 py-2.5 rounded-xl border border-sky-500/30">
            🔄
          </button>
        </div>
      </div>

      {/* Filter Tabs & Status */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex gap-2">
          <button onClick={() => setFilterCat("ALL")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterCat === "ALL" ? "bg-red-600 text-white" : "bg-slate-900 text-slate-400"}`}>
            ALL ({items.length})
          </button>
          <button onClick={() => setFilterCat("MOVIE")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterCat === "MOVIE" ? "bg-blue-600 text-white" : "bg-slate-900 text-slate-400"}`}>
            MOVIES ({items.filter(x => x.cat === "MOVIE").length})
          </button>
          <button onClick={() => setFilterCat("SERIES")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterCat === "SERIES" ? "bg-purple-600 text-white" : "bg-slate-900 text-slate-400"}`}>
            SERIES ({items.filter(x => x.cat === "SERIES").length})
          </button>
          <button onClick={() => setFilterCat("SONG")} className={`px-3 py-1.5 rounded-lg text-xs font-bold ${filterCat === "SONG" ? "bg-amber-600 text-white" : "bg-slate-900 text-slate-400"}`}>
            SONGS ({items.filter(x => x.cat === "SONG").length})
          </button>
        </div>
        <div className="text-amber-400 font-mono text-xs font-bold">{syncProgress}</div>
      </div>

      {/* EXACT 6-COLUMN LEDGER TABLE */}
      <div className="bg-[#080e1c] border border-sky-500/20 rounded-2xl overflow-hidden shadow-2xl">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-sky-500/20 text-slate-400 bg-black/40 font-bold uppercase text-[11px]">
              <th className="p-3.5 w-12 text-center">
                <input
                  type="checkbox"
                  checked={items.length > 0 && items.every(x => x.selected)}
                  onChange={(e) => setItems(items.map(x => ({ ...x, selected: e.target.checked })))}
                  className="rounded text-red-600 cursor-pointer"
                />
              </th>
              <th className="p-3.5 w-24">CAT</th>
              <th className="p-3.5">DETECTED & CLEAN DASH NAME</th>
              <th className="p-3.5">AUDIO & SPECS</th>
              <th className="p-3.5">GDRIVE ID & SIZE</th>
              <th className="p-3.5 text-center">TARGET CHUNK</th>
              <th className="p-3.5 text-right w-24">ACTION</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={7} className="text-center py-20 text-cyan-400 animate-pulse text-sm">
                  Scanning Drive Ledger items...
                </td>
              </tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-20 text-slate-500 text-sm">
                  🎉 No files pending in this category.
                </td>
              </tr>
            ) : (
              filtered.map((item, idx) => (
                <tr key={idx} className={`border-b border-white/5 transition hover:bg-white/5 ${item.selected ? "bg-sky-500/5" : "opacity-60"}`}>
                  {/* Select Checkbox */}
                  <td className="p-3.5 text-center">
                    <input
                      type="checkbox"
                      checked={item.selected}
                      onChange={() => {
                        const updated = [...items];
                        const realIdx = items.findIndex(x => x.gdrive_id === item.gdrive_id);
                        if (realIdx !== -1) {
                          updated[realIdx].selected = !updated[realIdx].selected;
                          setItems(updated);
                        }
                      }}
                      className="rounded text-red-600 cursor-pointer"
                    />
                  </td>

                  {/* CAT */}
                  <td className="p-3.5 font-bold">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        item.cat === "SERIES"
                          ? "bg-purple-950 text-purple-400 border border-purple-800"
                          : item.cat === "SONG"
                          ? "bg-amber-950 text-amber-400 border border-amber-800"
                          : "bg-blue-950 text-blue-400 border border-blue-800"
                      }`}
                    >
                      {item.cat}
                    </span>
                  </td>

                  {/* CLEAN DASH NAME & POSTER */}
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      {item.poster ? (
                        <img src={item.poster} className="w-8 h-12 object-cover rounded shadow border border-slate-700" alt="" />
                      ) : (
                        <div className="w-8 h-12 bg-slate-900 rounded border border-slate-800 flex items-center justify-center text-[9px] text-slate-600 font-mono">
                          NO ART
                        </div>
                      )}
                      <div className="space-y-0.5 overflow-hidden">
                        <div className="font-bold text-white text-xs truncate max-w-md">{item.clean_title}</div>
                        <div className="text-[10px] text-slate-500 font-mono truncate max-w-sm">{item.raw_title}</div>
                      </div>
                    </div>
                  </td>

                  {/* AUDIO & SPECS */}
                  <td className="p-3.5">
                    <div className="space-y-1">
                      <span className="bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded text-[10px] font-mono font-bold block w-fit">
                        {item.audio_specs}
                      </span>
                    </div>
                  </td>

                  {/* GDRIVE ID & SIZE */}
                  <td className="p-3.5 font-mono text-[11px]">
                    <div className="text-cyan-400 font-bold">{item.gdrive_id.substring(0, 14)}...</div>
                    <span className="text-red-400 font-bold bg-red-950/60 border border-red-800/60 px-1.5 py-0.2 rounded text-[10px] mt-0.5 inline-block">
                      {item.size}
                    </span>
                  </td>

                  {/* TARGET CHUNK */}
                  <td className="p-3.5 text-center font-mono">
                    <span className="bg-slate-900 border border-sky-500/30 text-sky-300 px-2 py-1 rounded text-[11px] font-bold">
                      {item.target_chunk.replace("resources/data/", "")}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="p-3.5 text-right">
                    <span className={`text-[11px] font-bold px-2 py-1 rounded ${item.selected ? "text-emerald-400" : "text-slate-500"}`}>
                      {item.selected ? "✓ Ready" : "Skipped"}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
