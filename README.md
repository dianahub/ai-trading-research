# 🐋 AI Crypto Research Dashboard

An AI-powered cryptocurrency research tool that combines real-time price data, technical analysis, news sentiment, and whale/smart money on-chain activity — all analysed by Claude AI to produce a structured research report.

> **Educational research only. Not financial advice.**

---

## Features

- **Live price data** — current price, 24h change, market cap, volume, and 7-day sparkline via CoinGecko
- **Technical indicators** — MACD, RSI, SMA 20/50, Bollinger Bands, volume analysis, support & resistance (90 days of daily data)
- **News sentiment** — 10 most recent headlines via NewsAPI, sentiment-labelled by Claude
- **Whale & smart money activity** — large transactions (≥ $500k USD) with exchange inflow/outflow detection and sentiment scoring
  - BTC → Blockchain.info (no API key required)
  - ETH + ERC-20 tokens → Etherscan
  - All other tickers → Whale Alert API
- **Claude AI analysis** — structured JSON report covering technical summary, MACD, volume, support/resistance, opportunities, risks, whale vs technicals cross-analysis, and a full research summary

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 · FastAPI · pandas-ta · Anthropic SDK |
| Frontend | React 19 · Vite · Tailwind CSS 4 · Recharts |
| AI | Claude claude-sonnet-4-5 |
| Data | CoinGecko · NewsAPI · Blockchain.info · Etherscan · Whale Alert |

---

## Quick Start

### 1. Clone & set up backend

```bash
git clone https://github.com/dianahub/ai-trading-research.git
cd ai-trading-research

python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r backend/requirements.txt
```

Copy and fill in your API keys:

```bash
cp backend/.env.example backend/.env
# edit backend/.env with your keys
```

Start the API server:

```bash
cd backend
uvicorn main:app --reload
# → http://localhost:8000
```

### 2. Set up & run frontend

```bash
cd frontend
cp .env.example .env            # default points to localhost:8000
npm install
npm run dev
# → http://localhost:5173
```

---

## API Keys

| Key | Required | Free tier | Where to get |
|-----|----------|-----------|--------------|
| `ANTHROPIC_API_KEY` | Yes | Pay-per-use | [console.anthropic.com](https://console.anthropic.com) |
| `NEWS_API_KEY` | No | 100 req/day | [newsapi.org](https://newsapi.org) |
| `ETHERSCAN_API_KEY` | No | 5 req/s | [etherscan.io/apis](https://etherscan.io/apis) |
| `WHALE_ALERT_API_KEY` | No | 10 req/min | [whale-alert.io](https://whale-alert.io) |

BTC whale data works with no API key at all (Blockchain.info).

---

## API Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /price/{ticker}` | Price, market cap, volume, 7d sparkline |
| `GET /news/{ticker}` | 10 recent news headlines |
| `GET /technicals/{ticker}` | MACD, RSI, SMA, Bollinger Bands, volume, support/resistance |
| `GET /whales/{ticker}` | Large transactions, exchange flow sentiment, supply concentration |
| `POST /analyze` | Claude AI structured research report |

---

## Supported Tickers

Any ticker resolvable via CoinGecko. Built-in mappings: BTC, ETH, SOL, BNB, XRP, ADA, DOGE, AVAX, DOT, MATIC, LINK, UNI, LTC, ATOM, and more.

---

## License

MIT — see [LICENSE](LICENSE).
