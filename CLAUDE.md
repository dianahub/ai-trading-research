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
