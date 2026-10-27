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
