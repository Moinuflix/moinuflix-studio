"use client";
import React, { useState } from "react";

const TMDB_KEY = "051ccf72e026820cb53b8b8531b6a2ba";
const FANART_KEY = "b207628faa5a1fc82f7dc07575c224f7";

export default function MoinuFlixStudio() {
  const [query, setQuery] = useState("cars");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedMovie, setSelectedMovie] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [commitStatus, setCommitStatus] = useState("");

  const [rawFilename, setRawFilename] = useState(
    "Cars (2006) 1080p BluRay x265 10bit HEVC [Org Hindi BD 5.1 ~ 448Kbps + English AAC 5.1] ESub ~ Tigole.mkv"
  );

  // Master Specs Configuration
  const [specs, setSpecs] = useState({
    source: "BluRay",
    audioCodec: "Dolby Atmos",
    audioBitrate: "448 Kbps",
    fileSize: "5 GB",
    resolution: "1080p",
    enhancement: "DS4K",
    colorDepth: "10bit",
    codec: "x265",
    clearLogo: "https://assets.fanart.tv/fanart/cars-503b8ddaf365d.png"
  });

  // Playback Versions Rows
  const [versions, setVersions] = useState([
    {
      language: "English",
      resolution: "1080p",
      source: "BluRay",
      codec: "x265",
      audio: "Dolby Atmos",
      channels: "5.1",
      dubbed: "Hindi Dub",
      size: "5 GB",
      driveId: ""
    }
  ]);

  const searchMovies = async () => {
    if (!query) return;
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_KEY}&query=${encodeURIComponent(query)}`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (e: any) {
      alert("Error: " + e.message);
    }
    setLoading(false);
  };

  const selectMovie = async (item: any) => {
    setLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/movie/${item.id}?api_key=${TMDB_KEY}&append_to_response=release_dates,images`);
      const data = await res.json();

      let logoUrl = "";
      try {
        const fRes = await fetch(`https://webservice.fanart.tv/v3/movies/${item.id}?api_key=${FANART_KEY}`);
        if (fRes.ok) {
          const fData = await fRes.json();
          logoUrl = fData.hdmovielogo?.[0]?.url || fData.movielogo?.[0]?.url || "";
        }
      } catch (err) {}

      if (!logoUrl && data.images?.logos?.[0]?.file_path) {
        logoUrl = `https://image.tmdb.org/t/p/original${data.images.logos[0].file_path}`;
      }

      setSpecs(prev => ({ ...prev, clearLogo: logoUrl }));

      setSelectedMovie({
        id: data.id,
        title: data.title,
        year: data.release_date ? data.release_date.split("-")[0] : "2006",
        runtime: data.runtime || 117,
        rating: data.vote_average ? data.vote_average.toFixed(1) : "7.3",
        cert: "UA",
        lang: (data.original_language || "en").toUpperCase(),
        poster: data.poster_path ? `https://image.tmdb.org/t/p/w500${data.poster_path}` : "",
        fanart: data.backdrop_path ? `https://image.tmdb.org/t/p/original${data.backdrop_path}` : ""
      });
    } catch (e: any) {
      alert("Error loading: " + e.message);
    }
    setLoading(false);
  };

  const parseSpecs = () => {
    if (!rawFilename) return;
    const fn = rawFilename.toLowerCase();

    let res = "1080p";
    if (fn.includes("2160p") || fn.includes("4k")) res = "2160p";
    else if (fn.includes("720p")) res = "720p";

    let src = "BluRay";
    if (fn.includes("web-dl") || fn.includes("web")) src = "WEB-DL";
    else if (fn.includes("amzn")) src = "AMZN";

    let aud = "Dolby Atmos";
    if (fn.includes("ddp") || fn.includes("5.1")) aud = "Dolby Atmos";
    else if (fn.includes("dts")) aud = "DTS 5.1";

    let br = "448 Kbps";
    if (fn.includes("640kbps") || fn.includes("640")) br = "640 Kbps";
    else if (fn.includes("768kbps") || fn.includes("768")) br = "768 Kbps";

    setSpecs(prev => ({
      ...prev,
      resolution: res,
      source: src,
      codec: fn.includes("x265") || fn.includes("hevc") ? "x265" : "x264",
      audioCodec: aud,
      audioBitrate: br,
      fileSize: "5 GB"
    }));
  };

  const addVersionRow = () => {
    setVersions(prev => [
      ...prev,
      {
        language: "Hindi",
        resolution: specs.resolution,
        source: specs.source,
        codec: specs.codec,
        audio: specs.audioCodec,
        channels: "5.1",
        dubbed: "Original Track",
        size: specs.fileSize,
        driveId: ""
      }
    ]);
  };

  const handleCommit = async () => {
    if (!selectedMovie) return alert("Pehle movie select karein!");
    setCommitStatus("Committing to GitHub...");
    try {
      const res = await fetch("/api/save-movie", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          movie: selectedMovie,
          specs: specs,
          versions: versions
        })
      });
      const data = await res.json();
      if (data.success) {
        setCommitStatus("🎉 Successfully Synced to catalog.json & chunk!");
      } else {
        setCommitStatus("Failed: " + (data.error || "Check GitHub Token"));
      }
    } catch (e: any) {
      setCommitStatus("Error syncing: " + e.message);
    }
  };

  return (
    <div className="min-h-screen bg-[#070b14] text-white p-4 md:p-8 font-sans">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEFT PANEL */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* STEP 1 & 2: SEARCH */}
          <div className="bg-[#0c1322] border border-gray-850 p-4 rounded-xl shadow-lg">
            <h2 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3">STEP 1 & 2: SEARCH TITLE</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMovies()}
                placeholder="Type movie name..."
                className="w-full bg-[#131c2e] border border-gray-700/80 px-3 py-2 rounded-lg text-sm text-white focus:outline-none focus:border-red-500 font-medium"
              />
              <button
                onClick={searchMovies}
                className="bg-red-600 hover:bg-red-700 font-bold px-5 py-2 rounded-lg text-sm shadow transition"
              >
                {loading ? "..." : "Find"}
              </button>
            </div>

            {/* List Results */}
            <div className="space-y-2">
              <div
                onClick={() => selectMovie({ id: 920, title: "Cars" })}
                className="flex items-center gap-3 bg-[#131d31] border border-cyan-900/40 p-2.5 rounded-lg cursor-pointer hover:border-cyan-500 transition"
              >
                <img src="https://image.tmdb.org/t/p/w92/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg" className="w-10 h-14 object-cover rounded shadow" />
                <div>
                  <div className="font-bold text-sm text-white">Cars</div>
                  <div className="text-xs text-gray-400">2006</div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#131d31]/60 border border-transparent p-2.5 rounded-lg cursor-pointer hover:border-gray-700">
                <img src="https://image.tmdb.org/t/p/w92/okIz15243Gv0kLq7XAZZhhv9iN.jpg" className="w-10 h-14 object-cover rounded shadow" />
                <div>
                  <div className="font-bold text-sm text-white">Cars 2</div>
                  <div className="text-xs text-gray-400">2011</div>
                </div>
              </div>

              <div className="flex items-center gap-3 bg-[#131d31]/60 border border-transparent p-2.5 rounded-lg cursor-pointer hover:border-gray-700">
                <img src="https://image.tmdb.org/t/p/w92/jWENI54k0yAebqK9mXzMkWaQG0q.jpg" className="w-10 h-14 object-cover rounded shadow" />
                <div>
                  <div className="font-bold text-sm text-white">Cars 3</div>
                  <div className="text-xs text-gray-400">2017</div>
                </div>
              </div>
            </div>
          </div>

          {/* RAW PARSER */}
          <div className="bg-[#0c1322] border border-gray-850 p-4 rounded-xl shadow-lg">
            <h2 className="text-xs font-bold text-cyan-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <span>⚡</span> RAW FILE RENAME PARSER (AUTO-FILL)
            </h2>
            <textarea
              rows={4}
              value={rawFilename}
              onChange={(e) => setRawFilename(e.target.value)}
              className="w-full bg-[#131c2e] border border-gray-700/80 p-3 rounded-lg text-xs font-mono text-gray-300 focus:outline-none focus:border-cyan-500 leading-relaxed"
            />
            <button
              onClick={parseSpecs}
              className="mt-3 w-full bg-[#00bcd4] hover:bg-[#00acc1] font-extrabold py-2.5 rounded-lg text-xs tracking-wider uppercase text-black shadow transition"
            >
              PARSE SPECS & AUTO-FILL EVERYTHING
            </button>
          </div>
        </div>

        {/* RIGHT PANEL */}
        <div className="lg:col-span-7 space-y-5">
          
          {/* BANNER + POSTER + LOGO CARD */}
          <div className="relative rounded-2xl overflow-hidden border border-gray-800 bg-[#0c1322] p-6 shadow-2xl min-h-[170px] flex items-center">
            <div
              className="absolute inset-0 bg-cover bg-center opacity-25 filter blur-[1px]"
              style={{ backgroundImage: `url(${selectedMovie?.fanart || "https://image.tmdb.org/t/p/original/sd4xN5xi8tKRPrJOWwNiZEile7f.jpg"})` }}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#070b14] via-[#070b14]/70 to-transparent" />

            <div className="relative z-10 flex gap-5 items-center w-full">
              <img
                src={selectedMovie?.poster || "https://image.tmdb.org/t/p/w500/2Touk3m5gzsqr1VsvxypdyHY5ci.jpg"}
                className="w-24 h-36 object-cover rounded-lg border border-gray-700 shadow-xl"
              />
              <div className="space-y-3">
                {specs.clearLogo ? (
                  <img src={specs.clearLogo} className="h-11 object-contain drop-shadow-md" />
                ) : (
                  <h1 className="text-2xl font-black text-white">{selectedMovie?.title || "Cars"}</h1>
                )}
                <div className="flex flex-wrap items-center gap-2 text-xs font-bold">
                  <span className="bg-red-950/80 text-red-400 border border-red-800 px-2 py-0.5 rounded">
                    {selectedMovie?.cert || "UA"}
                  </span>
                  <span className="text-gray-300">{selectedMovie?.year || "2006"}</span>
                  <span className="text-gray-400">• {selectedMovie?.runtime || "117"} min</span>
                  <span className="bg-amber-950/80 text-amber-400 border border-amber-800/80 px-2 py-0.5 rounded flex items-center gap-1">
                    ★ IMDb {selectedMovie?.rating || "7.3"}
                  </span>
                  <span className="bg-cyan-950/80 text-cyan-400 border border-cyan-800 px-2 py-0.5 rounded">
                    LANG: {selectedMovie?.lang || "EN"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* CLEARLOGO INPUT */}
          <div className="bg-[#0c1322] border border-gray-850 p-4 rounded-xl shadow-lg">
            <label className="text-[11px] font-bold text-gray-400 block mb-2">
              Kodi ClearLogo URL (Auto-fetched from Fanart.tv)
            </label>
            <input
              type="text"
              value={specs.clearLogo}
              onChange={(e) => setSpecs({ ...specs, clearLogo: e.target.value })}
              className="w-full bg-[#131c2e] border border-gray-700/80 px-3 py-2 rounded-lg text-xs text-amber-300 font-mono focus:outline-none focus:border-amber-400"
            />
          </div>

          {/* SPECS CHIPS BAR */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-blue-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.resolution}</span>
            <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.source}</span>
            <span className="bg-amber-600 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.enhancement}</span>
            <span className="bg-purple-800 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.colorDepth}</span>
            <span className="bg-green-700 font-bold text-xs px-3 py-1 rounded text-white shadow">{specs.codec}</span>
            <span className="bg-amber-700 font-bold text-xs px-3 py-1 rounded text-white shadow">
              {specs.audioCodec} @ {specs.audioBitrate}
            </span>
            <span className="bg-[#8b2d18] font-bold text-xs px-3 py-1 rounded text-white shadow flex items-center gap-1">
              📦 {specs.fileSize}
            </span>
          </div>

          {/* MASTER TECH & SOURCE CONFIGURATION */}
          <div className="bg-[#0c1322] border border-gray-850 p-4 rounded-xl shadow-lg space-y-2">
            <div className="text-xs font-bold text-gray-300">Master Tech & Source Configuration</div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Source (OTT / BD)</label>
                <select
                  value={specs.source}
                  onChange={(e) => setSpecs({ ...specs, source: e.target.value })}
                  className="w-full bg-[#131c2e] border border-gray-700 p-2 rounded-lg text-xs text-white"
                >
                  <option>BluRay</option>
                  <option>WEB-DL</option>
                  <option>AMZN</option>
                  <option>NF</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Audio Codec</label>
                <select
                  value={specs.audioCodec}
                  onChange={(e) => setSpecs({ ...specs, audioCodec: e.target.value })}
                  className="w-full bg-[#131c2e] border border-gray-700 p-2 rounded-lg text-xs text-white"
                >
                  <option>Dolby Atmos</option>
                  <option>DDP 5.1</option>
                  <option>DTS 5.1</option>
                  <option>AAC 5.1</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">Audio Bitrate</label>
                <select
                  value={specs.audioBitrate}
                  onChange={(e) => setSpecs({ ...specs, audioBitrate: e.target.value })}
                  className="w-full bg-[#131c2e] border border-gray-700 p-2 rounded-lg text-xs text-white"
                >
                  <option>448 Kbps</option>
                  <option>640 Kbps</option>
                  <option>768 Kbps</option>
                  <option>1509 Kbps</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] text-gray-400 block mb-1">File Size</label>
                <input
                  type="text"
                  value={specs.fileSize}
                  onChange={(e) => setSpecs({ ...specs, fileSize: e.target.value })}
                  className="w-full bg-[#131c2e] border border-gray-700 p-2 rounded-lg text-xs text-white font-mono"
                />
              </div>
            </div>
          </div>

          {/* STEP 7: PLAYBACK VERSIONS & AUDIO TRACKS */}
          <div className="bg-[#0c1322] border border-gray-850 p-4 rounded-xl shadow-lg space-y-3">
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xs font-bold text-red-500 uppercase tracking-widest">
                  STEP 7: PLAYBACK VERSIONS & AUDIO TRACKS
                </h3>
                <p className="text-[10px] text-gray-500">Configured with Dropdowns for Kodi Titan Bingie / Arctic Horizon</p>
              </div>
              <button
                onClick={addVersionRow}
                className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-xs font-bold px-3 py-1 rounded-lg text-gray-200"
              >
                + Add Another Version
              </button>
            </div>

            {versions.map((ver, idx) => (
              <div key={idx} className="space-y-2 pt-2 border-t border-gray-800/80">
                <div className="grid grid-cols-6 gap-2">
                  <select
                    value={ver.language}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].language = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-white"
                  >
                    <option>English</option>
                    <option>Tamil</option>
                    <option>Telugu</option>
                    <option>Hindi</option>
                  </select>

                  <select
                    value={ver.resolution}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].resolution = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-blue-950/60 border border-blue-700/80 p-1.5 rounded text-xs text-blue-300 font-bold"
                  >
                    <option>1080p</option>
                    <option>2160p</option>
                    <option>720p</option>
                  </select>

                  <select
                    value={ver.source}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].source = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-amber-950/60 border border-amber-700/80 p-1.5 rounded text-xs text-amber-300 font-bold"
                  >
                    <option>BluRay</option>
                    <option>WEB-DL</option>
                    <option>AMZN</option>
                  </select>

                  <select
                    value={ver.codec}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].codec = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-emerald-950/60 border border-emerald-700/80 p-1.5 rounded text-xs text-emerald-300 font-bold"
                  >
                    <option>x265</option>
                    <option>x264</option>
                  </select>

                  <select
                    value={ver.audio}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].audio = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-amber-950/60 border border-amber-700/80 p-1.5 rounded text-xs text-amber-300 font-bold"
                  >
                    <option>Dolby Atmos</option>
                    <option>DDP 5.1</option>
                    <option>DTS 5.1</option>
                  </select>

                  <select
                    value={ver.channels}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].channels = e.target.value;
                      setVersions(updated);
                    }}
                    className="bg-blue-950/60 border border-blue-700/80 p-1.5 rounded text-xs text-blue-300 font-bold"
                  >
                    <option>5.1</option>
                    <option>7.1</option>
                    <option>2.0</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <input
                    type="text"
                    value={ver.dubbed}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].dubbed = e.target.value;
                      setVersions(updated);
                    }}
                    className="w-1/3 bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-white"
                  />
                  <input
                    type="text"
                    value={ver.size}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].size = e.target.value;
                      setVersions(updated);
                    }}
                    className="w-24 bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-amber-400 font-mono"
                  />
                </div>

                <div className="flex gap-2">
                  <select className="bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-gray-300">
                    <option>GDrive ID</option>
                  </select>
                  <input
                    type="text"
                    value={ver.driveId}
                    onChange={(e) => {
                      const updated = [...versions];
                      updated[idx].driveId = e.target.value;
                      setVersions(updated);
                    }}
                    placeholder="https://drive.google.com/file/d/..."
                    className="w-full bg-[#131c2e] border border-gray-700 p-1.5 rounded text-xs text-cyan-300 font-mono focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

          {/* COMMIT BUTTON */}
          <button
            onClick={handleCommit}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-black font-black py-3.5 rounded-xl text-sm tracking-wider uppercase shadow-xl transition"
          >
            Save to JSON & Commit to GitHub (Step 8)
          </button>

          {commitStatus && (
            <div className="p-3 bg-[#0c1322] border border-gray-700 rounded-lg text-center text-xs font-semibold text-yellow-400">
              {commitStatus}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
