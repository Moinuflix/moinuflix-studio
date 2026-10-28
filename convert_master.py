import json
import os

source_file = "data_c01.json"
if not os.path.exists(source_file):
    if os.path.exists("chunks/data_c01.json"):
        source_file = "chunks/data_c01.json"
    else:
        print("❌ data_c01.json nahi mila! Make sure file ~/moinuflix-admin/data_c01.json me hai.")
        exit(1)

with open(source_file, "r", encoding="utf-8") as f:
    master_data = json.load(f)

# Ensure list of movies
movies = master_data.get("movies", []) if isinstance(master_data, dict) else master_data
print(f"Loaded {len(movies)} movies from {source_file}")

os.makedirs("chunks", exist_ok=True)
os.makedirs("resources/data/chunks", exist_ok=True)

catalog_movies = []
chunk_size = 50
total_chunks = (len(movies) + chunk_size - 1) // chunk_size

for chunk_idx in range(total_chunks):
    start = chunk_idx * chunk_size
    end = start + chunk_size
    chunk_movies = movies[start:end]
    chunk_filename = f"chunks/chunk_{chunk_idx+1:02d}.json"
    
    # Write Chunk file
    with open(chunk_filename, "w", encoding="utf-8") as cf:
        json.dump({"movies": chunk_movies}, cf, indent=2, ensure_ascii=False)
    print(f"✅ Created {chunk_filename} ({len(chunk_movies)} movies)")

    # Generate Catalog summary for each movie
    for m in chunk_movies:
        mid = str(m.get("id", "") or m.get("gdrive_id", "")).strip()
        title = m.get("title", "") or m.get("name", "")
        year = m.get("year", 2024)
        poster = m.get("poster", "") or m.get("artwork", {}).get("poster", "")
        fanart = m.get("fanart", "") or m.get("artwork", {}).get("fanart", "")
        logo = m.get("logo", "") or m.get("artwork", {}).get("clearlogo", "")
        rating = m.get("rating", 7.0)
        lang = m.get("original_language", "ta")
        stream = m.get("stream_url", "")
        
        # Versions summary
        versions = m.get("versions", [])
        avail_vers = []
        for v in versions:
            avail_vers.append({
                "language": v.get("language", "Tamil"),
                "quality": v.get("quality", "1080p FHD"),
                "source": v.get("source", "WEB-DL"),
                "codec": v.get("codec", "H.264"),
                "audio": v.get("audio", "Dolby Atmos"),
                "channels": v.get("channels", "5.1"),
                "size": v.get("size", "10 GB")
            })
        
        catalog_movies.append({
            "id": mid,
            "title": title,
            "year": year,
            "poster": poster,
            "fanart": fanart,
            "logo": logo,
            "rating": rating,
            "original_language": lang,
            "chunk_file": chunk_filename,
            "primary_stream_url": stream,
            "available_languages": list(set([v.get("language", "Tamil") for v in avail_vers])) or ["Tamil"],
            "version_count": len(versions) or 1,
            "available_versions": avail_vers
        })

# Save Master catalog.json
with open("catalog.json", "w", encoding="utf-8") as cat_f:
    json.dump({"movies": catalog_movies}, cat_f, indent=2, ensure_ascii=False)

print(f"\n🎉 catalog.json ready with {len(catalog_movies)} movies linked to {total_chunks} chunks!")
