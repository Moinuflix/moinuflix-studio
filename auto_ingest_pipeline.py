import os
import re
import json
import requests
import subprocess

TMDB_API_KEY = os.environ.get("TMDB_API_KEY", "")
FANART_API_KEY = os.environ.get("FANART_API_KEY", "")
STREAM_WORKER_BASE = "https://gdrive-stream.moinudeentv.workers.dev/?id="

# 1. Helper to clean movie title from raw torrent/drive filename
def extract_clean_title(filename):
    name = os.path.splitext(os.path.basename(filename))[0]
    # Remove bracket tags [NF], (2024), etc
    name = re.sub(r'\[.*?\]|\(.*?\)|\{.*?\}', ' ', name)
    # Detect Year
    year_match = re.search(r'\b(19\d\d|20\d\d)\b', name)
    year = int(year_match.group(1)) if year_match else None
    
    # Cut off technical tags
    tags = r'\b(2160p|1080p|720p|4k|uhd|bluray|remux|web-dl|webrip|hdr|10bit|ddp|atmos|x264|x265|hevc|aac|dts)\b.*'
    name = re.sub(tags, '', name, flags=re.IGNORECASE)
    
    clean_title = re.sub(r'[\._-]', ' ', name).strip()
    clean_title = re.sub(r'\s+', ' ', clean_title)
    return clean_title, year

# 2. Check if file is series or movie
def is_series_file(filename):
    fn = filename.lower()
    return bool(re.search(r's\d{1,2}e\d{1,2}|season|\bep\d{1,3}\b', fn))

# 3. Parse Tech Specs
def parse_specs(filename, file_bytes=0):
    fn = filename.lower()
    quality = "1080p FHD"
    if "2160p" in fn or "4k" in fn: quality = "4K UHD"
    elif "720p" in fn: quality = "720p HD"

    source = "WEB-DL"
    if "nf" in fn or "netflix" in fn: source = "Netflix"
    elif "amzn" in fn or "prime" in fn: source = "Prime Video"
    elif "hotstar" in fn or "dsnp" in fn: source = "Disney+ Hotstar"
    elif "remux" in fn: source = "REMUX"
    elif "bluray" in fn: source = "BluRay"

    codec = "x265 HEVC" if ("x265" in fn or "hevc" in fn) else "x264"
    audio = "Dolby Atmos" if "atmos" in fn else ("DDP 5.1" if "ddp" in fn else "AAC 2.0")
    
    gb_val = round(file_bytes / (1024 ** 3))
    size_str = f"{gb_val} GB" if gb_val >= 1 else f"{round(file_bytes / (1024 ** 2))} MB"

    return {
        "quality": quality,
        "source": source,
        "codec": codec,
        "audio": audio,
        "size": size_str,
        "channels": "5.1" if ("5.1" in fn or "atmos" in fn or "ddp" in fn) else "2.0"
    }

# 4. TMDB Metadata Fetch
def fetch_tmdb_metadata(query, year=None):
    if not TMDB_API_KEY:
        return None
    url = f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={requests.utils.quote(query)}"
    if year:
        url += f"&year={year}"
    res = requests.get(url).json()
    results = res.get("results", [])
    if not results:
        # Retry without year
        res = requests.get(f"https://api.themoviedb.org/3/search/movie?api_key={TMDB_API_KEY}&query={requests.utils.quote(query)}").json()
        results = res.get("results", [])
    if not results:
        return None
    
    movie_id = results[0]["id"]
    deep = requests.get(f"https://api.themoviedb.org/3/movie/{movie_id}?api_key={TMDB_API_KEY}&append_to_response=credits,release_dates,external_ids").json()
    
    # Artwork clearlogo via Fanart.tv if available
    clearlogo = ""
    if FANART_API_KEY:
        try:
            fa = requests.get(f"https://webservice.fanart.tv/v3/movies/{movie_id}?api_key={FANART_API_KEY}").json()
            logos = fa.get("hdmovielogo", []) or fa.get("movielogo", [])
            if logos: clearlogo = logos[0].get("url", "")
        except:
            pass

    directors = [{"name": c["name"], "job": "Director"} for c in deep.get("credits", {}).get("crew", []) if c.get("job") == "Director"]
    writers = [{"name": c["name"], "job": c.get("job")} for c in deep.get("credits", {}).get("crew", []) if c.get("job") in ["Writer", "Screenplay", "Story"]]
    cast = [{"name": c["name"], "character": c.get("character", ""), "profile": f"https://image.tmdb.org/t/p/w185{c.get('profile_path')}" if c.get("profile_path") else None} for c in deep.get("credits", {}).get("cast", [])[:10]]

    return {
        "id": str(deep["id"]),
        "tmdb_id": deep["id"],
        "imdb_id": deep.get("external_ids", {}).get("imdb_id"),
        "title": deep.get("title"),
        "original_title": deep.get("original_title"),
        "year": int(deep["release_date"].split("-")[0]) if deep.get("release_date") else year,
        "release_date": deep.get("release_date"),
        "runtime": deep.get("runtime", 120),
        "certification": "UA",
        "original_language": deep.get("original_language", "en"),
        "genres": [g["name"] for g in deep.get("genres", [])],
        "plot": deep.get("overview", ""),
        "director": directors,
        "writers": writers,
        "cast": cast,
        "artwork": {
            "poster": f"https://image.tmdb.org/t/p/w780{deep.get('poster_path')}" if deep.get("poster_path") else "",
            "fanart": f"https://image.tmdb.org/t/p/original{deep.get('backdrop_path')}" if deep.get("backdrop_path") else "",
            "clearlogo": clearlogo
        },
        "ratings": {
            "tmdb": deep.get("vote_average", 0),
            "imdb": None
        }
    }

def run_full_auto_sync():
    print("--- 1. SCANNING DRIVE FOR RAW FILES ---")
    res = subprocess.run(["rclone", "lsjson", "gdrive:", "-R", "--files-only"], stdout=subprocess.PIPE, text=True)
    drive_files = json.loads(res.stdout) if res.stdout else []
    print(f"Total raw files in Google Drive: {len(drive_files)}")

    # Load Existing Catalog to skip duplicates
    data_dir = "resources/data"
    catalog_path = f"{data_dir}/catalog.json"
    os.makedirs(f"{data_dir}/chunks", exist_ok=True)

    catalog = {"movies": []}
    if os.path.exists(catalog_path):
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)

    existing_ids = {str(m.get("id")) for m in catalog.get("movies", [])}
    
    series_list = []
    movies_processed = 0

    for file in drive_files:
        path = file.get("Path", "")
        fid = file.get("ID", "")
        fbytes = file.get("Size", 0)

        if not path.lower().endswith(('.mkv', '.mp4', '.avi', '.ts')):
            continue

        # Split Series vs Movies
        if is_series_file(path):
            series_list.append({"file": path, "id": fid, "size_bytes": fbytes})
            continue

        # Movie Match
        title, year = extract_clean_title(path)
        print(f"\n🔍 Auto Matching Movie: {title} ({year})")
        meta = fetch_tmdb_metadata(title, year)
        if not meta:
            print(f"⚠️ Could not match TMDB for: {title}")
            continue

        if meta["id"] in existing_ids:
            print(f"⏩ Movie already in catalog: {meta['title']}")
            continue

        specs = parse_specs(path, fbytes)
        stream_url = f"{STREAM_WORKER_BASE}{fid}|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0"

        # Determine target chunk (< 50 movies)
        chunk_num = 1
        target_chunk_rel = ""
        while True:
            candidate_rel = f"chunks/chunk_{str(chunk_num).padStart(2, '0') if hasattr(str, 'padStart') else f'{chunk_num:02d}'}.json"
            full_chunk_path = f"{data_dir}/{candidate_rel}"
            if not os.path.exists(full_chunk_path):
                target_chunk_rel = candidate_rel
                break
            with open(full_chunk_path, "r", encoding="utf-8") as cf:
                chunk_data = json.load(cf)
                if len(chunk_data.get("movies", [])) < 50:
                    target_chunk_rel = candidate_rel
                    break
            chunk_num += 1

        full_chunk_path = f"{data_dir}/{target_chunk_rel}"
        chunk_data = {"movies": []}
        if os.path.exists(full_chunk_path):
            with open(full_chunk_path, "r", encoding="utf-8") as cf:
                chunk_data = json.load(cf)

        # Build Version & Full Record
        version_obj = {
            "id": fid,
            "language": meta.get("original_language", "English").title(),
            "quality": specs["quality"],
            "source": specs["source"],
            "codec": specs["codec"],
            "audio": specs["audio"],
            "channels": specs["channels"],
            "size": specs["size"],
            "stream_url": stream_url
        }

        full_record = {
            **meta,
            "stream_url": stream_url,
            "specs": specs,
            "versions": [version_obj]
        }
        chunk_data.setdefault("movies", []).append(full_record)
        with open(full_chunk_path, "w", encoding="utf-8") as cf:
            json.dump(chunk_data, cf, indent=2, ensure_ascii=False)

        # Update Catalog
        catalog_summary = {
            "id": meta["id"],
            "title": meta["title"],
            "year": meta["year"],
            "poster": meta["artwork"]["poster"],
            "fanart": meta["artwork"]["fanart"],
            "logo": meta["artwork"].get("clearlogo", ""),
            "rating": meta["ratings"]["tmdb"],
            "original_language": meta["original_language"],
            "chunk_file": f"{data_dir}/{target_chunk_rel}",
            "primary_stream_url": stream_url,
            "available_languages": [meta.get("original_language", "en")],
            "version_count": 1,
            "available_versions": [{
                "language": meta.get("original_language", "en"),
                "quality": specs["quality"],
                "source": specs["source"],
                "codec": specs["codec"],
                "audio": specs["audio"],
                "channels": specs["channels"],
                "size": specs["size"]
            }]
        }
        catalog.setdefault("movies", []).append(catalog_summary)
        existing_ids.add(meta["id"])
        movies_processed += 1
        print(f"✅ Added {meta['title']} to {target_chunk_rel} & catalog.json")

    # Save Catalog and Series Inbox
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    with open("series_inbox.json", "w", encoding="utf-8") as f:
        json.dump(series_list, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Finished: Processed {movies_processed} movies into Catalog & Chunks! Series split into series_inbox.json ({len(series_list)} items).")

if __name__ == "__main__":
    run_full_auto_sync()

def run_full_auto_sync():
    print("--- 1. SCANNING DRIVE FOR RAW FILES ---")
    res = subprocess.run(["rclone", "lsjson", "gdrive:", "-R", "--files-only"], stdout=subprocess.PIPE, text=True)
    drive_files = json.loads(res.stdout) if res.stdout else []
    print(f"Total raw files in Google Drive: {len(drive_files)}")

    # Load Existing Catalog to skip duplicates
    data_dir = "resources/data"
    catalog_path = f"{data_dir}/catalog.json"
    os.makedirs(f"{data_dir}/chunks", exist_ok=True)

    catalog = {"movies": []}
    if os.path.exists(catalog_path):
        with open(catalog_path, "r", encoding="utf-8") as f:
            catalog = json.load(f)

    existing_ids = {str(m.get("id")) for m in catalog.get("movies", [])}
    
    series_list = []
    movies_processed = 0

    for file in drive_files:
        path = file.get("Path", "")
        fid = file.get("ID", "")
        fbytes = file.get("Size", 0)

        if not path.lower().endswith(('.mkv', '.mp4', '.avi', '.ts')):
            continue

        # Split Series vs Movies
        if is_series_file(path):
            series_list.append({"file": path, "id": fid, "size_bytes": fbytes})
            continue

        # Movie Match
        title, year = extract_clean_title(path)
        print(f"\n🔍 Auto Matching Movie: {title} ({year})")
        meta = fetch_tmdb_metadata(title, year)
        if not meta:
            print(f"⚠️ Could not match TMDB for: {title}")
            continue

        if meta["id"] in existing_ids:
            print(f"⏩ Movie already in catalog: {meta['title']}")
            continue

        specs = parse_specs(path, fbytes)
        stream_url = f"{STREAM_WORKER_BASE}{fid}|User-Agent=Kodi-MoinuTV-PrivatePlayer/1.0"

        # Determine target chunk (< 50 movies)
        chunk_num = 1
        target_chunk_rel = ""
        while True:
            candidate_rel = f"chunks/chunk_{str(chunk_num).padStart(2, '0') if hasattr(str, 'padStart') else f'{chunk_num:02d}'}.json"
            full_chunk_path = f"{data_dir}/{candidate_rel}"
            if not os.path.exists(full_chunk_path):
                target_chunk_rel = candidate_rel
                break
            with open(full_chunk_path, "r", encoding="utf-8") as cf:
                chunk_data = json.load(cf)
                if len(chunk_data.get("movies", [])) < 50:
                    target_chunk_rel = candidate_rel
                    break
            chunk_num += 1

        full_chunk_path = f"{data_dir}/{target_chunk_rel}"
        chunk_data = {"movies": []}
        if os.path.exists(full_chunk_path):
            with open(full_chunk_path, "r", encoding="utf-8") as cf:
                chunk_data = json.load(cf)

        # Build Version & Full Record
        version_obj = {
            "id": fid,
            "language": meta.get("original_language", "English").title(),
            "quality": specs["quality"],
            "source": specs["source"],
            "codec": specs["codec"],
            "audio": specs["audio"],
            "channels": specs["channels"],
            "size": specs["size"],
            "stream_url": stream_url
        }

        full_record = {
            **meta,
            "stream_url": stream_url,
            "specs": specs,
            "versions": [version_obj]
        }
        chunk_data.setdefault("movies", []).append(full_record)
        with open(full_chunk_path, "w", encoding="utf-8") as cf:
            json.dump(chunk_data, cf, indent=2, ensure_ascii=False)

        # Update Catalog
        catalog_summary = {
            "id": meta["id"],
            "title": meta["title"],
            "year": meta["year"],
            "poster": meta["artwork"]["poster"],
            "fanart": meta["artwork"]["fanart"],
            "logo": meta["artwork"].get("clearlogo", ""),
            "rating": meta["ratings"]["tmdb"],
            "original_language": meta["original_language"],
            "chunk_file": f"{data_dir}/{target_chunk_rel}",
            "primary_stream_url": stream_url,
            "available_languages": [meta.get("original_language", "en")],
            "version_count": 1,
            "available_versions": [{
                "language": meta.get("original_language", "en"),
                "quality": specs["quality"],
                "source": specs["source"],
                "codec": specs["codec"],
                "audio": specs["audio"],
                "channels": specs["channels"],
                "size": specs["size"]
            }]
        }
        catalog.setdefault("movies", []).append(catalog_summary)
        existing_ids.add(meta["id"])
        movies_processed += 1
        print(f"✅ Added {meta['title']} to {target_chunk_rel} & catalog.json")

    # Save Catalog and Series Inbox
    with open(catalog_path, "w", encoding="utf-8") as f:
        json.dump(catalog, f, indent=2, ensure_ascii=False)

    with open("series_inbox.json", "w", encoding="utf-8") as f:
        json.dump(series_list, f, indent=2, ensure_ascii=False)

    print(f"\n🎉 Finished: Processed {movies_processed} movies into Catalog & Chunks! Series split into series_inbox.json ({len(series_list)} items).")

if __name__ == "__main__":
    run_full_auto_sync()
