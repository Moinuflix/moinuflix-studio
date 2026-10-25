'use client';
import { useState } from "react";

export default function MoinuFlixAdmin() {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedMovie, setSelectedMovie] = useState(null);

  const [primaryUrl, setPrimaryUrl] = useState("");
  const [versions, setVersions] = useState([
    { language: "Tamil", quality: "1080p", source: "AMZN", format: "WEB-DL", codec: "x265", audio: "Dolby Atmos 5.1", channels: "5.1", drive_url: "" }
  ]);

  const searchMovie = async () => {
    if (!query) return;
    setLoading(true);
    const res = await fetch("/api/fetch-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query }),
    });
    const data = await res.json();
    setSearchResults(data.results || []);
    setLoading(false);
  };

  const selectMovie = async (tmdbId) => {
    setLoading(true);
    const res = await fetch("/api/fetch-meta", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tmdbId }),
    });
    const data = await res.json();
    setSelectedMovie(data);
    setLoading(false);
  };

  const addVersion = () => {
    setVersions([
      ...versions,
      { language: "Hindi", quality: "1080p", source: "NF", format: "WEB-DL", codec: "x265", audio: "Dolby Atmos 5.1", channels: "5.1", drive_url: "" }
    ]);
  };

  const updateVersion = (index, field, value) => {
    const updated = [...versions];
    updated[index][field] = value;
    setVersions(updated);
  };

  const removeVersion = (index) => {
    setVersions(versions.filter((_, i) => i !== index));
  };

  const saveToGithub = async () => {
    if (!primaryUrl) {
      alert("Primary Google Drive link daalna zaroori hai!");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/save-movie", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        movieDetail: selectedMovie,
        versions,
        primaryDriveUrl: primaryUrl,
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (data.success) {
      alert("Successfully Added to " + data.chunk + " & catalog.json!");
      setSelectedMovie(null);
      setSearchResults([]);
      setPrimaryUrl("");
    } else {
      alert("Error: " + data.error);
    }
  };

  // Dynamic tags from versions
  const activeTags = Array.from(new Set([
    ...versions.map(v => v.quality),
    ...versions.map(v => v.source),
    ...versions.map(v => v.codec || "x265"),
    ...versions.map(v => v.audio.includes("Atmos") ? "Atmos" : "5.1 Surround"),
    "5.1 Passthrough"
  ]));

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#08090c", color: "#f3f4f6", padding: "24px", fontFamily: "system-ui, sans-serif" }}>
      <header style={{ maxWidth: "1350px", margin: "0 auto 24px", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #1f242d", paddingBottom: "16px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ background: "linear-gradient(135deg, #e50914, #b20710)", padding: "8px 14px", borderRadius: "8px", fontWeight: "900", letterSpacing: "1px", fontSize: "18px", boxShadow: "0 0 15px rgba(229,9,20,0.4)" }}>
            MOINUFLIX
          </div>
          <div>
            <h1 style={{ fontSize: "18px", fontWeight: "700", margin: 0, color: "#fff" }}>Movie Indexer & Metadata Studio</h1>
            <p style={{ fontSize: "12px", color: "#6b7280", margin: 0 }}>Automated 2-Tier JSON Pipeline (TMDb + OMDb + Fanart + Wiki)</p>
          </div>
        </div>
        <div style={{ background: "rgba(56,189,248,0.1)", border: "1px solid rgba(56,189,248,0.3)", padding: "6px 14px", borderRadius: "20px", color: "#38bdf8", fontSize: "12px", fontWeight: "600" }}>
          5.1 Cinema Passthrough Mode
        </div>
      </header>

      <main style={{ maxWidth: "1350px", margin: "0 auto", display: "grid", gridTemplateColumns: "360px 1fr", gap: "24px" }}>
        
        {/* Left Side: Step 1 & 2 */}
        <section style={{ background: "#0e1117", border: "1px solid #1a1f29", borderRadius: "16px", padding: "20px", height: "fit-content" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", color: "#e50914", letterSpacing: "1.5px", textTransform: "uppercase" }}>Step 1 & 2</span>
          <h2 style={{ fontSize: "16px", fontWeight: "700", margin: "4px 0 14px" }}>Search Movie</h2>
          
          <div style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
            <input
              type="text"
              placeholder="Type movie name (e.g. Leo)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && searchMovie()}
              style={{ flex: 1, background: "#161b24", border: "1px solid #262e3d", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "13px", outline: "none" }}
            />
            <button
              onClick={searchMovie}
              disabled={loading}
              style={{ background: "#e50914", color: "#fff", border: "none", borderRadius: "8px", padding: "0 18px", fontWeight: "600", fontSize: "13px", cursor: "pointer" }}
            >
              {loading ? "..." : "Find"}
            </button>
          </div>

          <div style={{ maxHeight: "620px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
            {searchResults.map((m) => (
              <div
                key={m.id}
                onClick={() => selectMovie(m.id)}
                style={{ display: "flex", gap: "12px", padding: "10px", background: "#141822", border: "1px solid #1f2636", borderRadius: "10px", cursor: "pointer" }}
              >
                <img
                  src={m.poster_path ? "https://image.tmdb.org/t/p/w92" + m.poster_path : "https://via.placeholder.com/92x138?text=No+Poster"}
                  style={{ width: "42px", height: "60px", objectFit: "cover", borderRadius: "6px" }}
                  alt=""
                />
                <div style={{ overflow: "hidden" }}>
                  <div style={{ fontWeight: "600", fontSize: "14px", color: "#f3f4f6", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.title}</div>
                  <div style={{ fontSize: "12px", color: "#8a94a6", marginTop: "4px" }}>
                    {m.release_date?.split("-")[0] || "N/A"} • ★ {m.vote_average?.toFixed(1) || "NR"}
                  </div>
                </div>
              </div>
            ))}
            {searchResults.length === 0 && (
              <div style={{ textAlign: "center", color: "#4b5563", fontSize: "13px", padding: "40px 0" }}>
                Search movie title to see list
              </div>
            )}
          </div>
        </section>

        {/* Right Side: Step 3 to 8 */}
        <section style={{ background: "#0e1117", border: "1px solid #1a1f29", borderRadius: "16px", padding: "24px" }}>
          {!selectedMovie ? (
            <div style={{ height: "450px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#4b5563" }}>
              <div style={{ fontSize: "36px", marginBottom: "12px" }}>🎬</div>
              <div style={{ fontSize: "16px", fontWeight: "600" }}>No Movie Selected</div>
              <div style={{ fontSize: "13px", marginTop: "4px" }}>Search on left & click on movie to auto-populate metadata</div>
            </div>
          ) : (
            <div>
              {/* Banner Preview */}
              <div style={{ display: "flex", gap: "20px", background: "#141822", border: "1px solid #202738", borderRadius: "12px", padding: "16px", position: "relative", overflow: "hidden" }}>
                {selectedMovie.artwork?.fanart && (
                  <img
                    src={selectedMovie.artwork.fanart}
                    style={{ position: "absolute", right: 0, top: 0, height: "100%", width: "60%", objectFit: "cover", opacity: 0.15, maskImage: "linear-gradient(to right, transparent, black)" }}
                    alt=""
                  />
                )}
                <img
                  src={selectedMovie.artwork?.poster || "https://via.placeholder.com/150x225"}
                  style={{ width: "95px", height: "140px", objectFit: "cover", borderRadius: "8px", boxShadow: "0 8px 16px rgba(0,0,0,0.5)", zIndex: 1 }}
                  alt=""
                />
                <div style={{ flex: 1, zIndex: 1 }}>
                  {selectedMovie.artwork?.clearlogo ? (
                    <img src={selectedMovie.artwork.clearlogo} style={{ height: "42px", objectFit: "contain", marginBottom: "8px" }} alt="Logo" />
                  ) : (
                    <h2 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 6px" }}>{selectedMovie.title}</h2>
                  )}
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", fontSize: "12px", color: "#9ca3af", marginBottom: "8px" }}>
                    <span style={{ background: "#e50914", color: "#fff", padding: "2px 8px", borderRadius: "4px", fontWeight: "700" }}>{selectedMovie.certification || "UA"}</span>
                    <span>{selectedMovie.year}</span>
                    <span>•</span>
                    <span>{selectedMovie.runtime} min</span>
                    <span>•</span>
                    <span style={{ color: "#38bdf8" }}>{selectedMovie.genres?.join(", ")}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "#d1d5db", lineHeight: 1.5, margin: 0, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {selectedMovie.plot}
                  </p>
                </div>
              </div>

              {/* Dynamic Tags */}
              <div style={{ marginTop: "16px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
                {activeTags.map((tag) => (
                  <span key={tag} style={{ background: "#18202f", border: "1px solid #27344c", color: "#60a5fa", fontSize: "11px", fontWeight: "600", padding: "3px 10px", borderRadius: "6px" }}>
                    {tag}
                  </span>
                ))}
              </div>

              {/* Versions & Drive */}
              <div style={{ marginTop: "24px", borderTop: "1px solid #1f242d", paddingTop: "20px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#e50914", letterSpacing: "1.5px", textTransform: "uppercase" }}>Step 7</span>
                <h3 style={{ fontSize: "16px", fontWeight: "700", margin: "4px 0 16px" }}>Playback Versions & Google Drive URLs</h3>

                <div style={{ marginBottom: "16px" }}>
                  <label style={{ display: "block", fontSize: "12px", color: "#9ca3af", marginBottom: "6px" }}>Primary Google Drive URL (Master Stream):</label>
                  <input
                    type="text"
                    placeholder="https://drive.google.com/file/d/1kNRa26pDssehRE..."
                    value={primaryUrl}
                    onChange={(e) => setPrimaryUrl(e.target.value)}
                    style={{ width: "100%", background: "#161b24", border: "1px solid #262e3d", borderRadius: "8px", padding: "10px 14px", color: "#fff", fontSize: "13px", boxSizing: "border-box" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {versions.map((v, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "110px 120px 100px 140px 1fr 36px", gap: "8px", background: "#121620", border: "1px solid #1c2333", padding: "10px", borderRadius: "8px", alignItems: "center" }}>
                      
                      {/* Language */}
                      <select
                        value={v.language}
                        onChange={(e) => updateVersion(i, "language", e.target.value)}
                        style={{ background: "#1a2130", border: "1px solid #2a354d", borderRadius: "6px", padding: "7px 8px", color: "#fff", fontSize: "12px", outline: "none" }}
                      >
                        <option value="Tamil">Tamil</option>
                        <option value="Hindi">Hindi</option>
                        <option value="Telugu">Telugu</option>
                        <option value="Malayalam">Malayalam</option>
                        <option value="Kannada">Kannada</option>
                        <option value="English">English</option>
                      </select>

                      {/* Quality (Width Adjusted) */}
                      <select
                        value={v.quality}
                        onChange={(e) => updateVersion(i, "quality", e.target.value)}
                        style={{ background: "#1a2130", border: "1px solid #2a354d", borderRadius: "6px", padding: "7px 8px", color: "#38bdf8", fontWeight: "600", fontSize: "12px", outline: "none" }}
                      >
                        <option value="2160p">2160p (4K)</option>
                        <option value="1080p">1080p (FHD)</option>
                        <option value="720p">720p (HD)</option>
                        <option value="480p">480p (SD)</option>
                      </select>

                      {/* Source */}
                      <select
                        value={v.source}
                        onChange={(e) => updateVersion(i, "source", e.target.value)}
                        style={{ background: "#1a2130", border: "1px solid #2a354d", borderRadius: "6px", padding: "7px 8px", color: "#fbbf24", fontWeight: "600", fontSize: "12px", outline: "none" }}
                      >
                        <option value="AMZN">AMZN</option>
                        <option value="NF">Netflix</option>
                        <option value="DSNP">Hotstar</option>
                        <option value="ZEE5">ZEE5</option>
                        <option value="SONYL">SonyLIV</option>
                        <option value="BluRay">BluRay</option>
                        <option value="WEB-DL">WEB-DL</option>
                        <option value="Remux">Remux</option>
                      </select>

                      {/* Audio */}
                      <select
                        value={v.audio}
                        onChange={(e) => updateVersion(i, "audio", e.target.value)}
                        style={{ background: "#1a2130", border: "1px solid #2a354d", borderRadius: "6px", padding: "7px 8px", color: "#34d399", fontSize: "12px", outline: "none" }}
                      >
                        <option value="Dolby Atmos 5.1">Dolby Atmos 5.1</option>
                        <option value="TrueHD 7.1 Atmos">TrueHD 7.1 Atmos</option>
                        <option value="DD+ 5.1">DD+ 5.1</option>
                        <option value="DD 5.1">DD 5.1</option>
                        <option value="Stereo 2.0">Stereo 2.0</option>
                      </select>

                      {/* Drive URL */}
                      <input
                        type="text"
                        value={v.drive_url}
                        onChange={(e) => updateVersion(i, "drive_url", e.target.value)}
                        placeholder="Google Drive link for this version"
                        style={{ background: "#1a2130", border: "1px solid #2a354d", borderRadius: "6px", padding: "7px 10px", color: "#fff", fontSize: "12px", outline: "none" }}
                      />

                      <button
                        onClick={() => removeVersion(i)}
                        style={{ background: "transparent", color: "#ef4444", border: "none", cursor: "pointer", fontSize: "16px" }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}

                  <button
                    onClick={addVersion}
                    style={{ alignSelf: "flex-start", background: "#1c2333", border: "1px dashed #34425e", color: "#38bdf8", padding: "7px 16px", borderRadius: "6px", fontSize: "12px", cursor: "pointer", marginTop: "6px", fontWeight: "600" }}
                  >
                    + Add Another Version
                  </button>
                </div>
              </div>

              {/* Step 8 Push to Repo */}
              <div style={{ marginTop: "24px", borderTop: "1px solid #1f242d", paddingTop: "20px" }}>
                <button
                  onClick={saveToGithub}
                  disabled={loading}
                  style={{ width: "100%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", border: "none", borderRadius: "10px", padding: "14px", fontSize: "15px", fontWeight: "700", cursor: "pointer", boxShadow: "0 4px 15px rgba(16,185,129,0.3)" }}
                >
                  {loading ? "Syncing with GitHub..." : "Save to JSON & Commit to GitHub (Step 8)"}
                </button>
              </div>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}