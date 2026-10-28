import json
import os
import requests

TMDB_API_KEY = "051ccf72e026820cb53b8b8531b6a2ba"
target_path = "chunks/data_c01.json"

if not os.path.exists(target_path):
    print("❌ chunks/data_c01.json nahi mila!")
    exit(1)

with open(target_path, "r", encoding="utf-8") as f:
    movies = json.load(f)

print(f"📊 Loaded {len(movies)} movies from {target_path}")

enriched = 0
for idx, movie in enumerate(movies):
    title = movie.get("title") or movie.get("name")
    tmdb_id = movie.get("tmdb_id")
    has_fanart = bool(movie.get("fanart"))
    has_poster = bool(movie.get("poster"))

    if (not has_fanart or not has_poster) and tmdb_id:
        try:
            url = f"https://api.themoviedb.org/3/movie/{tmdb_id}?api_key={TMDB_API_KEY}"
            res = requests.get(url, timeout=5).json()
            if res.get("backdrop_path") and not has_fanart:
                movie["fanart"] = f"https://image.tmdb.org/t/p/original{res['backdrop_path']}"
                enriched += 1
            if res.get("poster_path") and not has_poster:
                movie["poster"] = f"https://image.tmdb.org/t/p/w500{res['poster_path']}"
                enriched += 1
            print(f"[{idx+1}/{len(movies)}] Enriched: {title}")
        except Exception:
            pass

with open(target_path, "w", encoding="utf-8") as f:
    json.dump(movies, f, indent=2, ensure_ascii=False)

print(f"\n🎉 Done! Total {enriched} artworks enriched in {target_path}")
