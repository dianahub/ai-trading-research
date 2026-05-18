# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

AI-powered cryptocurrency research dashboard. Two services:

| Directory | Stack | Purpose |
|-----------|-------|---------|
| `backend/` | Python + FastAPI | Aggregates crypto data, computes technicals, proxies Claude AI |
| `frontend/` | React 19 + Vite + Tailwind CSS 4 | Dark-themed dashboard UI |

## Commands

### Backend
```bash
source ../venv/bin/activate      # Activate shared venv (at repo root)
uvicorn main:app --reload        # Dev server at http://localhost:8000
```

### Frontend
```bash
npm run dev      # Dev server at http://localhost:5173
npm run build
npm run lint     # ESLint
```

## Environment Variables

Backend reads from `backend/.env`:
```
ANTHROPIC_API_KEY=...
NEWS_API_KEY=...           # newsapi.org — optional, news endpoint degrades gracefully
ETHERSCAN_API_KEY=...      # optional, only needed for ETH whale tracking
```

Frontend: set `VITE_API_URL` to override the default backend URL (`http://localhost:8000`).

## Architecture

### Data flow per search
1. User enters a ticker → `App.jsx` fires three parallel API calls: `/price/{ticker}`, `/news/{ticker}`, `/technicals/{ticker}`
2. Results render immediately; then a POST to `/analyze` sends all three payloads to Claude (`claude-sonnet-4-5`) for structured JSON analysis
3. Analysis cards and sentiment banner render once Claude responds

### Backend endpoints (`backend/main.py`)
| Endpoint | Source | Notes |
|----------|--------|-------|
| `GET /price/{ticker}` | CoinGecko `/coins/markets` | Returns sparkline (7d) |
| `GET /news/{ticker}` | NewsAPI `/everything` | Returns up to 10 articles |
| `GET /technicals/{ticker}` | CoinGecko `/coins/{id}/market_chart` (90d daily) | Computes MACD, RSI, SMA20/50, Bollinger Bands, volume, support/resistance via `pandas-ta` |
| `POST /analyze` | Claude API | Structured JSON response validated against `AnalyzeResponse` Pydantic model |
| `GET /whales/{ticker}` | Blockchain.info (BTC) or Etherscan (ETH-ecosystem) | Scans recent blocks for transactions >$500k USD |

### Ticker resolution
`resolve_coin_id()` maps tickers to CoinGecko IDs via `TICKER_TO_ID` dict, falling back to CoinGecko search. `ETH_CHAIN_TICKERS` determines which tokens use Etherscan for whale data.

### Claude integration
`POST /analyze` builds a structured prompt from price data, computed technicals, and news headlines, then validates Claude's JSON response against required fields. Sentiment fields are normalized to `bullish|bearish|neutral`; `confidence_score` is clamped to 1–10.

### Frontend components (`frontend/src/components/`)
Each component is a pure presentational component receiving props from `App.jsx` state (`data.price`, `data.technicals`, `data.news`, `data.analysis`). Components render a loading/empty state when `analysis` is null (Claude call still in progress).

## Social Media Pipeline (Instagram auto-post)

Admin UI at `/admin/social` — generates a daily Instagram Reel via HeyGen twin video + caption burn.

Key files: `backend/main.py` (pipeline, routes), `backend/heygen.py` (HeyGen API + ffmpeg), `frontend/src/pages/AdminSocialContent.jsx` (admin UI).

### Pipeline flow
1. Pick best unused insight from DB → fetch matching financial news (NewsAPI)
2. Generate 30s script via Claude (insight + headline)
3. Submit HeyGen Talking Photo job → poll until complete (returns `video_url` + `caption_url`)
4. `burn_captions()` — download video, burn dark panel + captions with ffmpeg, return `/media/temp/{id}.mp4`
5. Post Reel to Instagram (or return preview URL)

### Caption burn — how it works
`backend/heygen.py` → `burn_captions()`:
- Downloads the raw HeyGen MP4 to `/tmp/social_videos/{id}_raw.mp4`
- Fetches HeyGen's VTT caption file → converts to SRT via `_vtt_to_srt()`; falls back to `_script_to_srt()` if VTT unavailable
- **Uses `textfile=` not `text=`** — each SRT cue is written to `/tmp/social_videos/{id}_caps/cue_N.txt`; the drawtext filter uses `textfile='/path/cue_N.txt'`. This avoids all ffmpeg filter escaping issues (apostrophes in `text='...'` broke the parser for 29-cue chains).
- Dark panel: `drawbox=x=0:y=922:w=iw:h=358:color=black@0.82:t=fill`
- Text: `drawtext=textfile='...':enable='between(t,T0,T1)':fontsize=28:fontfile=/app/DejaVuSans.ttf:fontcolor=white:x=(w-text_w)/2:y=1002`
- Font: `/app/DejaVuSans.ttf` (bundled binary, 759KB). `_find_font_file()` searches nix store first, then system paths, then bundled file (rejects files < 100KB to catch corrupted HTML downloads).
- ffmpeg binary: imageio_ffmpeg v4.2.2 static binary (no libass — that's why drawtext/FreeType is used instead of `subtitles=` filter).

### Railway env vars (social)
```
HEYGEN_API_KEY, HEYGEN_AVATAR_ID, HEYGEN_AVATAR_TYPE=avatar
HEYGEN_VOICE_ID, HEYGEN_BACKGROUND=https://www.starsignal.io/starsignal-bg.png
HEYGEN_CAPTIONS=true
HEYGEN_CAPTION_TEST=0   # set to 1 to replace captions with "HELLO" for testing (keeps real HeyGen video)
HEYGEN_PIPELINE_TEST=0  # set to 1 to skip HeyGen entirely, generate black test video locally
BACKEND_URL=https://aitrading.starsignal.io
```

### nixpacks.toml
Installs `ffmpeg` and `dejavu_fonts` via nixpkgs so the nix-store font path is available as a fallback.

### News selection rules
- Currency insight → searches `"forex" OR "exchange rate" OR "US dollar" OR "yuan"...`
- Crypto insight → searches `"bitcoin" OR "ethereum" OR "BTC" OR "ETH"` only — no altcoins
- Script prompt explicitly skips altcoins (Solana, XRP, etc.) and lifestyle/sports crossover headlines
- Step 2 question must name the SAME asset as step 1 headline (enforced in prompt)
