"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

export default function ManualAddStudio() {
  const [category, setCategory] = useState<"movie" | "series" | "song">("movie");
  const [tmdbId, setTmdbId] = useState("");
  const [title, setTitle] = useState("");
  const [year, setYear] = useState("2025");
  const [rating, setRating] = useState("7.5");
  const [collection, setCollection] = useState("");
  const [plot, setPlot] = useState("");
  
  // Specs
  const [source, setSource] = useState("Netflix");
  const [resolution, setResolution] = useState("1080p FHD");
  const [audioSpecs, setAudioSpecs] = useState("Tamil 5.1 - 640Kbps");
  const [fileSize, setFileSize] = useState("10 GB");
  const [gdriveUrl, setGdriveUrl] = useState("");

  // Artwork
  const [poster, setPoster] = useState("");
  const [fanart, setFanart] = useState("");
  const [clearlogo, setClearlogo] = useState("");

  const [loadingTmdb, setLoadingTmdb] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");

  // TMDb ID se Fetch
  const handleFetchTmdb = async () => {
    if (!tmdbId.trim()) return alert("Pehle TMDb ID enter karein!");
    setLoadingTmdb(true);
    setStatusMsg("Fetching TMDb & Fanart.tv metadata...");
    try {
      const endpoint = category === "series" ? "tv" : "movie";
      const res = await fetch(`https://api.themoviedb.org/3/${endpoint}/${tmdbId}?api_key=${TMDB_KEY}&language=en-US`);
      if (!res.ok) throw new Error("TMDb ID not found");
      const d = await res.json();

      setTitle(d.title || d.name || "");
      setYear((d.release_date || d.first_air_date || "2025").split("-")[0]);
      setRating(d.vote_average ? d.vote_average.toFixed(1) : "7.5");
      setPlot(d.overview || "");
      if (d.belongs_to_collection) setCollection(d.belongs_to_collection.name);

      if (d.poster_path) setPoster(`https://image.tmdb.org/t/p/w500${d.poster_path}`);
      if (d.backdrop_path) setFanart(`https://image.tmdb.org/t/p/original${d.backdrop_path}`);

      // Fanart.tv ClearLogo fetch
      try {
        const fRes = await fetch(`https://webservice.fanart.tv/v3/${category === "series" ? "tv" : "movies"}/${tmdbId}?api_key=${FANART_KEY}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          const logo = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || fData.hdtvlogo?.[0]?.url || "";
          if (logo) setClearlogo(logo);
        }
      } catch (_) {}

      setStatusMsg("✅ Metadata & Artwork loaded successfully!");
    } catch (e: any) {
      setStatusMsg(`❌ Error: ${e.message}`);
    }
    setLoadingTmdb(false);
  };

  // Form Submit to Backend API
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gdriveUrl.trim()) return alert("Google Drive Link ya File ID daalna zaroori hai!");
    setSubmitting(true);
    setStatusMsg("Saving & Committing to GitHub...");

    const standardRename = `${title} (${year}) [${resolution.split(" ")[0]}] [${source}] [${audioSpecs}] [${fileSize}].mkv`;

    const payload = {
      movie: {
        id: tmdbId ? parseInt(tmdbId, 10) : Date.now(),
        title,
        year,
        runtime: 120,
        rating,
        cert: "UA",
        lang: "ta",
        collection,
        poster,
        fanart,
        plot,
        genres: ["Action", "Drama"]
      },
      specs: {
        source,
        audioCodec: audioSpecs,
        audioBitrate: "640 Kbps",
        fileSize,
        resolution: resolution.split(" ")[0],
        audioTrackString: audioSpecs,
        clearLogo: clearlogo
      },
      versions: [
        {
          language: "Tamil",
          resolution: resolution.split(" ")[0],
          source,
          audio: audioSpecs,
          size: fileSize,
          driveId: gdriveUrl
        }
      ],
      rawFilename: standardRename,
      category
    };

    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setStatusMsg(`🎉 Successfully committed to ${data.target || data.chunk || "resources/data/"}!`);
        // Reset essential fields
        setTitle("");
        setGdriveUrl("");
        setTmdbId("");
        setPoster("");
        setFanart("");
        setClearlogo("");
      } else {
        setStatusMsg(`❌ Save Failed: ${data.error}`);
      }
    } catch (err: any) {
      setStatusMsg(`❌ Network Error: ${err.message}`);
    }
    setSubmitting(false);
  };

  return (
    <div className="min-h-screen bg-[#040711] text-slate-100 p-4 md:p-8 font-sans">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-sky-500/20 pb-4 mb-6">
          <div className="flex items-center gap-3">
            <span className="bg-red-600 font-black px-3 py-1 rounded text-lg tracking-wider">MOINUFLIX</span>
            <span className="text-xs text-cyan-400 font-bold font-mono tracking-widest uppercase">
              MANUAL MASTER INGESTION STUDIO
            </span>
          </div>
          <span className="text-xs text-slate-400 font-mono">Destination: resources/data/</span>
        </div>

        {statusMsg && (
          <div className="mb-6 p-3 rounded-xl bg-slate-900 border border-sky-500/30 text-xs font-mono font-bold text-amber-300">
            {statusMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="bg-[#080e1c] border border-sky-500/20 rounded-3xl p-6 md:p-8 shadow-2xl space-y-6">
          {/* SECTION 1: Category & TMDb Auto-Fill */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Content Category</label>
              <select
                value={category}
                onChange={(e: any) => setCategory(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-bold text-cyan-400"
              >
                <option value="movie">🎬 Movie (chunks/chunk_XX.json)</option>
                <option value="series">📺 Web Series (data_c02.json)</option>
                <option value="song">🎵 5.1 Song (data_c03.json)</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">TMDb ID</label>
              <input
                type="number"
                placeholder="e.g. 949229"
                value={tmdbId}
                onChange={(e) => setTmdbId(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-white"
              />
            </div>
            <div className="flex items-end">
              <button
                type="button"
                onClick={handleFetchTmdb}
                disabled={loadingTmdb}
                className="w-full bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-bold py-2.5 rounded-xl text-xs transition"
              >
                {loadingTmdb ? "Fetching..." : "⚡ Auto-Fill From TMDb"}
              </button>
            </div>
          </div>

          {/* SECTION 2: Clean Title, Year & Franchise */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="text-xs font-bold text-slate-400 block mb-1">Kodi Clean Title</label>
              <input
                type="text"
                required
                placeholder="e.g. Leo"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-bold text-white"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Release Year</label>
              <input
                type="text"
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Franchise / Collection Name</label>
              <input
                type="text"
                placeholder="e.g. Lokesh Cinematic Universe"
                value={collection}
                onChange={(e) => setCollection(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-purple-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">IMDb / TMDb Rating</label>
              <input
                type="text"
                value={rating}
                onChange={(e) => setRating(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-amber-400 font-bold"
              />
            </div>
          </div>

          {/* SECTION 3: Technical Specifications */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Source / OTT</label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-white"
              >
                <option>Netflix</option>
                <option>Amazon Prime Video</option>
                <option>Sun NXT</option>
                <option>Disney+ Hotstar</option>
                <option>SonyLIV</option>
                <option>Zee5</option>
                <option>Apple TV+</option>
                <option>BluRay</option>
                <option>WEB-DL</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Resolution</label>
              <select
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-white"
              >
                <option>2160p 4K</option>
                <option>1080p FHD</option>
                <option>720p HD</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Audio Specifications</label>
              <input
                type="text"
                value={audioSpecs}
                onChange={(e) => setAudioSpecs(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-mono text-cyan-300"
              />
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Clean File Size</label>
              <input
                type="text"
                value={fileSize}
                onChange={(e) => setFileSize(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs font-mono font-bold text-red-400"
              />
            </div>
          </div>

          {/* SECTION 4: Google Drive Stream Link */}
          <div>
            <label className="text-xs font-bold text-amber-400 block mb-1">Google Drive Link or File ID</label>
            <input
              type="text"
              required
              placeholder="e.g. 1aFmu_tpwZdvV_wiA4FR5U6WzORXKIDrQ"
              value={gdriveUrl}
              onChange={(e) => setGdriveUrl(e.target.value)}
              className="w-full bg-[#0d1626] border border-amber-500/40 p-3 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* SECTION 5: Artwork URLs & Visual Previews */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Poster URL (W500)</label>
              <input
                type="text"
                value={poster}
                onChange={(e) => setPoster(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2 rounded-xl text-xs text-slate-300"
              />
              {poster && <img src={poster} className="h-28 mt-2 rounded-lg object-cover border border-slate-700" alt="" />}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">Fanart / Backdrop URL</label>
              <input
                type="text"
                value={fanart}
                onChange={(e) => setFanart(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2 rounded-xl text-xs text-slate-300"
              />
              {fanart && <img src={fanart} className="h-28 mt-2 rounded-lg object-cover border border-slate-700" alt="" />}
            </div>
            <div>
              <label className="text-xs font-bold text-slate-400 block mb-1">ClearLogo URL (.png)</label>
              <input
                type="text"
                value={clearlogo}
                onChange={(e) => setClearlogo(e.target.value)}
                className="w-full bg-[#0d1626] border border-sky-500/30 p-2 rounded-xl text-xs text-slate-300"
              />
              {clearlogo && <img src={clearlogo} className="h-16 mt-2 object-contain bg-black/40 p-2 rounded border border-slate-700" alt="" />}
            </div>
          </div>

          <div>
            <label className="text-xs font-bold text-slate-400 block mb-1">Plot Summary</label>
            <textarea
              rows={3}
              value={plot}
              onChange={(e) => setPlot(e.target.value)}
              className="w-full bg-[#0d1626] border border-sky-500/30 p-2.5 rounded-xl text-xs text-slate-300"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:opacity-95 text-black font-black py-4 rounded-2xl text-xs uppercase tracking-wider shadow-xl transition disabled:opacity-50"
          >
            {submitting ? "Committing to GitHub..." : "🚀 SAVE & DIRECT COMMIT TO MASTER (STEP 8)"}
          </button>
        </form>
      </div>
    </div>
  );
}
