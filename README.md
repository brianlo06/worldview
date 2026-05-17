# worldview

> A real-time, holographic situational-awareness globe. News, weather, markets,
> and detected anomalies plotted on a rotating Earth — with an AI clustering
> layer that collapses 50 redundant articles about the same event into one
> dot, and semantic search across all of it.

Built as a personal project to explore what a Tony Stark / JARVIS-style news
dashboard would actually look like if you put a real news pipeline behind it.

---

## What it does

- **Live news on a 3D globe** — ~700 events per 15-min window pulled from GDELT
  Global Knowledge Graph (titles, images, geocoded to city level), NOAA NWS
  weather alerts. Updates automatically every 15 min via launchd.
- **AI deduplication** — every article is embedded with `BAAI/bge-small-en-v1.5`
  (local, free) and clusters of similar stories are merged with greedy kNN
  against pgvector. One Trump-Xi summit cluster ≠ 28 separate dots.
- **Claude-generated cluster summaries** — `claude-haiku-4-5` writes neutral
  AP-style headlines for multi-source clusters (with prompt caching).
- **Semantic search** — type `trade tensions in asia` in the HUD; the query
  is embedded with the same model and matched against cluster centroid
  vectors via HNSW. Globe filters to matches, camera flies to the densest.
- **Anomaly detection** — per-country rolling 7-day baseline; if the last
  hour's event rate exceeds baseline + 3σ AND ≥ 2× baseline AND ≥ 4 events,
  fires an alert. Rendered as a sonar-ring marker over the region + a HUD
  card showing the driver clusters + a JARVIS voice announcement.
- **Markets + currencies** in a side panel (14 indices via Stooq, 17 USD
  FX pairs via Frankfurter / ECB), colored by intraday change.
- **Significance tier filter** — `ALL / NOTABLE / MAJOR / TOP` toggle so
  the globe only shows what you care about.
- **Category toggles** — click a swatch in the bottom-left legend to hide
  that category. Choices persist across reloads.
- **Cinematic everything** — boot screen with `[OK]` checks streaming in,
  Stark telemetry readout, animated bracket lock-on when a dot is selected,
  country borders overlay, atmospheric rim glow, scan lines, bloom, JARVIS
  voice cues via Web Speech Synthesis.

---

## Architecture

```
        ┌────────────────────────────────────────────────────────┐
        │     Sources (free, no API key except Anthropic)        │
        │  GDELT events  ·  GDELT GKG  ·  NOAA NWS  ·  Stooq  ·  │
        │  Frankfurter (ECB)                                     │
        └──────────────────────┬─────────────────────────────────┘
                               │ every 15 min via launchd
                               ▼
                    ┌─────────────────────┐
                    │  Ingestion workers  │
                    │  (Python, FastAPI)  │
                    │                     │
                    │  parse → normalize  │
                    │  → dedupe via       │
                    │  url_hash           │
                    └──────────┬──────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │  Postgres 17                 │
                │  + PostGIS  (geo)            │
                │  + pgvector (embeddings)     │
                └──────────────┬───────────────┘
                               │
              ┌────────────────┼──────────────────┐
              ▼                ▼                  ▼
       ┌────────────┐  ┌──────────────┐  ┌────────────────┐
       │ Embedding  │  │  Clustering  │  │  Summarization │
       │  worker    │  │  worker      │  │  worker        │
       │            │  │              │  │                │
       │ fastembed  │  │  greedy kNN  │  │  Claude Haiku  │
       │ (local)    │  │  via HNSW    │  │  4.5  (cached) │
       └────────────┘  └──────────────┘  └────────────────┘
                               │
                               ▼
                ┌──────────────────────────────┐
                │  FastAPI service             │
                │  /clusters  /events  /search │
                │  /markets   /anomalies       │
                │  (launchd KeepAlive)         │
                └──────────────┬───────────────┘
                               │ CORS allowed for Vite origin
                               ▼
                ┌──────────────────────────────┐
                │  React + Vite frontend       │
                │  Custom Three.js globe       │
                │  (no high-level library)     │
                │  + post-processing           │
                │  + Web Audio + TTS           │
                │  + Zustand store             │
                └──────────────────────────────┘
```

---

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | React 19, Vite 8, TypeScript, Three.js (raw — custom shaders for Earth, atmosphere, dots, halos, pulses, anomaly rings, selection brackets), Tailwind CSS v4, Zustand (+ persist middleware) |
| Backend | FastAPI, psycopg3 with pgvector adapter, httpx |
| Database | Postgres 17 (Homebrew), PostGIS 3.6, pgvector 0.8.2 |
| AI | `BAAI/bge-small-en-v1.5` via `fastembed` (local ONNX, 384-dim), Claude Haiku 4.5 via `anthropic` Python SDK with prompt caching |
| Scheduling | macOS `launchd` (two LaunchAgents — API service + ingestion job) |

---

## Repo layout

```
~/worldview/                ← frontend (this directory)
~/worldview-api/            ← backend (sibling)

worldview/
  src/
    boot/                   boot screen
    globe/                  Three.js scene, shaders, modules
    hud/                    React HUD overlays (BREAKING, MARKETS,
                            search bar, selection, telemetry, etc.)
    store/                  Zustand store with localStorage persist
    audio/                  Web Audio + Speech Synthesis
    api/                    fetch helpers for the backend
  public/
    textures/               NASA Blue Marble + clouds + normal map
    data/                   Natural Earth country borders (110m)

worldview-api/
  src/worldview_api/
    api.py                  FastAPI app
    config.py               env config (pydantic-settings)
    db.py                   psycopg pool with pgvector adapter
    ingest/                 GDELT events, GDELT GKG, NWS, markets,
                            currencies, article enrichment
    embed/                  fastembed worker
    cluster/                kNN assignment + Claude summarization
    analyze/                anomaly baseline + detector
  sql/                      migrations
  scripts/                  run_ingest, run_embed, run_cluster,
                            run_summarize, run_anomalies, run_all,
                            serve, backfill_city
  ops/                      launchd plists (.api, .ingest)
```

---

## Quick start (macOS)

```bash
# 1. Database (one-time)
brew install postgresql@17 postgis pgvector
brew services start postgresql@17
createdb worldview_dev
psql worldview_dev -c "CREATE EXTENSION postgis; CREATE EXTENSION vector; CREATE EXTENSION pgcrypto;"

# 2. Backend setup
cd ~/worldview-api
python3.12 -m venv .venv
.venv/bin/pip install -e .
DATABASE_URL=postgresql://$(whoami)@localhost:5432/worldview_dev ./sql/apply.sh

# 3. Anthropic key (only needed for cluster summarization)
echo "ANTHROPIC_API_KEY=sk-ant-..." >> .env

# 4. First ingestion (downloads fastembed model ~130MB on first call)
.venv/bin/python scripts/run_all.py

# 5. Start the API
.venv/bin/python scripts/serve.py
# → http://127.0.0.1:8088

# 6. Frontend (new terminal)
cd ~/worldview
npm install
npm run dev
# → http://127.0.0.1:5173
```

Open `http://127.0.0.1:5173/`, click through the boot screen, the globe
should appear with real events.

---

## Operations — running it hands-off

Two `launchd` LaunchAgents keep the system alive across reboots:

| Label | What it does | Cadence |
|---|---|---|
| `com.worldview.api` | FastAPI server with `KeepAlive` | always running |
| `com.worldview.ingest` | Runs `scripts/run_all.py` (ingest → enrich → embed → cluster → summarize → detect anomalies) | every 15 min |

Install both:

```bash
cp ~/worldview-api/ops/com.worldview.api.plist    ~/Library/LaunchAgents/
cp ~/worldview-api/ops/com.worldview.ingest.plist ~/Library/LaunchAgents/
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.worldview.api.plist
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.worldview.ingest.plist
```

Check status:

```bash
launchctl print gui/$(id -u)/com.worldview.api    | grep -E "state|last exit"
launchctl print gui/$(id -u)/com.worldview.ingest | grep -E "state|last exit"
tail -f ~/worldview-api/logs/ingest.log
```

Force an immediate ingestion:

```bash
launchctl kickstart -k gui/$(id -u)/com.worldview.ingest
```

Stop / uninstall:

```bash
launchctl bootout gui/$(id -u)/com.worldview.api
launchctl bootout gui/$(id -u)/com.worldview.ingest
rm ~/Library/LaunchAgents/com.worldview.{api,ingest}.plist
```

---

## Data freshness — worst case ~16 minutes

```
GDELT publishes (every :00 :15 :30 :45)
        ↓ ≤ 15 min
launchd cron → run_all.py → Postgres
        ↓ instant
FastAPI /clusters /events /markets
        ↓ ≤ 60s
React HUD: globe updates, BREAKING list, anomaly markers
```

---

## Costs

| Item | Roughly |
|---|---:|
| Postgres + ingestion | $0 (local) |
| fastembed embedding | $0 (local) |
| Claude Haiku summarization (~10 cluster touches per 15-min run, prompt-cached) | $10–15 / month |
| Anthropic API for `/search` query embedding | bundled with summarization |
| **Total** | **~$10–15 / month** at current cadence |

---

## Operating the UI

| Action | How |
|---|---|
| Rotate the globe | drag with mouse |
| Zoom | scroll wheel |
| Click a dot | shows selection panel with image, headline, summary, location, "OPEN ARTICLE →" link |
| Click an item in BREAKING | flies to it, brackets lock on, JARVIS announces destination |
| Search | type in the top-center bar, press Enter — embeds the query and filters globe to matches |
| Toggle categories | click swatches in bottom-left legend |
| Filter by significance | `ALL / NOTABLE / MAJOR / TOP` segmented control, top-right under buttons |
| Switch clusters / raw events | `◉ CLUSTERS / ◯ EVENTS` button |
| Tour mode | `◉ TOUR` button (defaults on for new users) |
| Ambient breaking pulses | `◉ PULSE` button |
| Mute audio + voice | `◉ SND` button |

---

## What's actually impressive about this

- The whole pipeline runs locally for $10–15/month including AI inference.
- Embeddings are done locally with `fastembed` (no per-call API cost).
- Clustering uses pgvector + HNSW; kNN against 1000+ centroids is sub-10ms.
- The frontend is raw Three.js with custom GLSL shaders — no high-level
  globe library — which is why the holographic feel works.
- GDELT GKG ingestion gives ~700 globally-distributed events per 15-min
  window with real titles + images + geo, vs the ~200 (mostly US) we'd get
  from the events file alone.
- Claude's "no common theme found" responses are used as an honest signal
  that a cluster was a false-positive merge — the AI critiques its own
  output.

---

## Ideas not yet built

- **Time scrubber** — drag a timeline to see what was happening 6h ago,
  last Tuesday, last month
- **Cluster detail drawer** — click a cluster, see all N member articles
- **WebSocket realtime** — replace the 60s poll with server push
- **Public deployment** — Vercel for the frontend + Fly.io for the API
- **Mobile-responsive layout**
- **Public benchmark** for news geocoding accuracy across providers
