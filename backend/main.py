import os
import json
import time
import requests
import anthropic
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timezone, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Trading Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        os.getenv("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
NEWS_API_KEY        = os.getenv("NEWS_API_KEY")
ETHERSCAN_API_KEY   = os.getenv("ETHERSCAN_API_KEY", "")
WHALE_ALERT_API_KEY = os.getenv("WHALE_ALERT_API_KEY", "")
FINNHUB_API_KEY     = os.getenv("FINNHUB_API_KEY", "")

# Astro API integration
ASTRO_API_URL          = os.getenv("ASTRO_API_URL", "http://localhost:3001")
ASTRO_API_KEY_INTERNAL = os.getenv("ASTRO_API_KEY_INTERNAL", "")
ASTRO_SIGNAL_WEIGHT    = float(os.getenv("ASTRO_SIGNAL_WEIGHT", "0.1"))

# Astro cache — 30-minute TTL, shared across requests
_astro_cache: dict = {"data": None, "fetched_at": 0.0}

COINGECKO_BASE   = "https://api.coingecko.com/api/v3"
NEWSAPI_BASE     = "https://newsapi.org/v2"
ETHERSCAN_BASE   = "https://api.etherscan.io/api"
BLOCKCHAIN_INFO  = "https://blockchain.info"
WHALE_ALERT_BASE = "https://api.whale-alert.io/v1"
FINNHUB_BASE     = "https://finnhub.io/api/v1"

# Tickers that live on Ethereum (Etherscan can provide on-chain data)
ETH_CHAIN_TICKERS = frozenset({
    "ETH", "LINK", "UNI", "AAVE", "COMP", "WBTC", "SHIB",
    "MATIC", "CRV", "MKR", "LDO", "ARB", "OP", "RPL",
    "YFI", "SUSHI", "BAL", "SNX", "ENS", "PEPE", "1INCH",
})

# Exchange detection — ETH addresses (user-supplied prefixes)
ETH_EXCHANGE_PREFIXES: dict[str, str] = {
    "Binance":  "0x3f5",
    "Coinbase": "0x71",
    "Kraken":   "0x2910",
}

# Exchange detection — BTC addresses (known cold-wallet prefixes, best-effort)
BTC_EXCHANGE_PREFIXES: dict[str, list[str]] = {
    "Binance":  ["1NDyJtN", "34xp4vR", "3Cbq7aT", "bc1qm34lss"],
    "Coinbase": ["3JRN5K1", "1FzWLkd", "3QJmV3q"],
    "Kraken":   ["3AfBQ6F", "3EytSom"],
}

# Common ticker → CoinGecko coin ID mappings
TICKER_TO_ID = {
    "BTC": "bitcoin",
    "ETH": "ethereum",
    "SOL": "solana",
    "BNB": "binancecoin",
    "XRP": "ripple",
    "ADA": "cardano",
    "DOGE": "dogecoin",
    "AVAX": "avalanche-2",
    "DOT": "polkadot",
    "MATIC": "matic-network",
    "LINK": "chainlink",
    "UNI": "uniswap",
    "LTC": "litecoin",
    "ATOM": "cosmos",
    "FIL": "filecoin",
    "NEAR": "near",
    "ARB": "arbitrum",
    "OP": "optimism",
    "SUI": "sui",
    "APT": "aptos",
}


def resolve_coin_id(ticker: str) -> str:
    """Resolve a ticker symbol to a CoinGecko coin ID."""
    upper = ticker.upper()
    if upper in TICKER_TO_ID:
        return TICKER_TO_ID[upper]

    try:
        resp = requests.get(f"{COINGECKO_BASE}/search", params={"query": ticker}, timeout=10)
        resp.raise_for_status()
        coins = resp.json().get("coins", [])
        if not coins:
            raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on CoinGecko")
        for coin in coins:
            if coin.get("symbol", "").upper() == upper:
                return coin["id"]
        return coins[0]["id"]
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"CoinGecko search failed: {str(e)}")


def r2(val) -> float | None:
    """Round to 2 decimal places, return None if not a valid number."""
    try:
        return round(float(val), 2)
    except (TypeError, ValueError):
        return None


# ---------------------------------------------------------------------------
# Whale / smart-money helpers
# ---------------------------------------------------------------------------

def _shorten(addr: str, prefix: int = 6) -> str:
    if not addr or len(addr) < prefix + 4:
        return addr or "Unknown"
    return f"{addr[:prefix]}...{addr[-4:]}"


def _detect_exchange_eth(addr: str) -> str | None:
    if not addr:
        return None
    low = addr.lower()
    for name, prefix in ETH_EXCHANGE_PREFIXES.items():
        if low.startswith(prefix.lower()):
            return name
    return None


def _detect_exchange_btc(addr: str) -> str | None:
    if not addr:
        return None
    for name, prefixes in BTC_EXCHANGE_PREFIXES.items():
        if any(addr.startswith(p) for p in prefixes):
            return name
    return None


def _direction(from_ex: str | None, to_ex: str | None) -> str:
    if to_ex:
        return "Exchange Inflow"
    if from_ex:
        return "Exchange Outflow"
    return "Whale Transfer"


def _whale_sentiment(txs: list) -> tuple[str, str, int, int, float]:
    inflow  = sum(1 for t in txs if t["direction"] == "Exchange Inflow")
    outflow = sum(1 for t in txs if t["direction"] == "Exchange Outflow")
    total   = len(txs) or 1
    ratio   = round(inflow / max(outflow, 1), 2)

    if inflow / total > 0.6:
        return "Bearish - Whales moving to exchanges to sell",           "bearish", inflow, outflow, ratio
    if outflow / total > 0.6:
        return "Bullish - Whales accumulating and moving to cold storage", "bullish", inflow, outflow, ratio
    return     "Neutral - Mixed whale activity",                           "neutral", inflow, outflow, ratio


def _whale_summary(ticker: str, txs: list, sentiment: str,
                   inflow: int, outflow: int) -> str:
    total = len(txs)
    if total == 0:
        return (
            f"Insufficient on-chain data was available for {ticker} via free public APIs. "
            f"For comprehensive smart money analytics consider services such as Glassnode or Nansen. "
            f"This is educational research only — not financial advice."
        )

    base = (
        f"Analysis of the {total} most recent large {ticker} transaction"
        f"{'s' if total != 1 else ''} exceeding $500,000 USD identified "
        f"{inflow} exchange inflow{'s' if inflow != 1 else ''} and "
        f"{outflow} exchange outflow{'s' if outflow != 1 else ''}. "
    )

    if sentiment.startswith("Bearish"):
        return base + (
            "The dominant flow toward centralized exchanges suggests large holders may be positioning "
            "to liquidate. Historically, elevated exchange inflows have preceded periods of increased "
            "sell-side pressure. Monitoring this trend alongside order book depth and funding rates "
            "provides useful educational context. This is educational research only — not financial advice."
        )
    if sentiment.startswith("Bullish"):
        return base + (
            "The dominant outflow away from exchanges toward private wallets indicates large holders are "
            "accumulating and securing assets in cold storage. Exchange outflows reduce available "
            "circulating sell-side supply — a pattern often observed during institutional accumulation phases. "
            "This is educational research only — not financial advice."
        )
    return base + (
        "The balanced mix of inflows and outflows suggests no strongly directional conviction from large "
        "holders at this time. This is consistent with a consolidation or distribution phase where both "
        "large buyers and sellers are active. This is educational research only — not financial advice."
    )


_HEADERS = {"User-Agent": "Mozilla/5.0 (compatible; ai-trading-research/1.0)"}


def _fetch_btc_whales(btc_price: float, min_usd: float = 500_000) -> list:
    """Scan recent BTC blocks via Blockchain.info for transactions above min_usd."""
    min_sat = int((min_usd / btc_price) * 1e8)
    results: list = []

    try:
        latest   = requests.get(
            f"{BLOCKCHAIN_INFO}/latestblock", timeout=10, headers=_HEADERS
        ).json()
        cur_hash = latest.get("hash", "")

        for _ in range(4):          # scan at most 4 blocks
            if len(results) >= 10 or not cur_hash:
                break

            blk = requests.get(
                f"{BLOCKCHAIN_INFO}/rawblock/{cur_hash}", timeout=25, headers=_HEADERS
            ).json()
            ts  = datetime.fromtimestamp(blk.get("time", 0), tz=timezone.utc).isoformat()

            for tx in blk.get("tx", []):
                if len(results) >= 10:
                    break

                total_sat = sum(o.get("value", 0) for o in tx.get("out", []))
                if total_sat < min_sat:
                    continue

                from_addrs = [
                    inp.get("prev_out", {}).get("addr", "")
                    for inp in tx.get("inputs", [])
                    if inp.get("prev_out", {}).get("addr")
                ]
                to_addrs = [
                    o.get("addr", "")
                    for o in tx.get("out", [])
                    if o.get("addr")
                ]

                from_addr = from_addrs[0] if from_addrs else ""
                to_addr   = to_addrs[0]   if to_addrs   else ""
                from_ex   = _detect_exchange_btc(from_addr)
                to_ex     = _detect_exchange_btc(to_addr)
                amount_btc = total_sat / 1e8

                results.append({
                    "hash":           tx.get("hash", ""),
                    "amount_crypto":  round(amount_btc, 6),
                    "amount_usd":     round(amount_btc * btc_price, 2),
                    "from_address":   _shorten(from_addr),
                    "to_address":     _shorten(to_addr),
                    "from_exchange":  from_ex,
                    "to_exchange":    to_ex,
                    "to_is_exchange": bool(to_ex),
                    "exchange_name":  to_ex or from_ex,
                    "direction":      _direction(from_ex, to_ex),
                    "timestamp":      ts,
                    "chain":          "BTC",
                })

            cur_hash = blk.get("prev_block", "")
            time.sleep(0.3)

    except Exception:
        pass

    return results[:10]


def _fetch_eth_whales(eth_price: float, min_usd: float = 500_000) -> tuple[list, str]:
    """Scan recent ETH blocks via Etherscan for transactions above min_usd."""
    if not ETHERSCAN_API_KEY or ETHERSCAN_API_KEY == "your_etherscan_api_key_here":
        return [], "ETHERSCAN_API_KEY not configured — add it to backend/.env to enable ETH whale tracking"

    min_wei = int((min_usd / eth_price) * 1e18)
    results: list = []

    try:
        bn = requests.get(ETHERSCAN_BASE, params={
            "module": "proxy", "action": "eth_blockNumber",
            "apikey": ETHERSCAN_API_KEY,
        }, timeout=10).json()
        latest_block = int(bn["result"], 16)

        for i in range(6):          # scan at most 6 blocks
            if len(results) >= 10:
                break

            blk_data = requests.get(ETHERSCAN_BASE, params={
                "module":  "proxy",
                "action":  "eth_getBlockByNumber",
                "tag":     hex(latest_block - i),
                "boolean": "true",
                "apikey":  ETHERSCAN_API_KEY,
            }, timeout=12).json()

            blk = blk_data.get("result") or {}
            ts  = datetime.fromtimestamp(
                int(blk.get("timestamp", "0x0"), 16), tz=timezone.utc
            ).isoformat()

            for tx in blk.get("transactions", []):
                if len(results) >= 10:
                    break

                value_wei = int(tx.get("value", "0x0"), 16)
                if value_wei < min_wei:
                    continue

                from_addr  = tx.get("from", "") or ""
                to_addr    = tx.get("to",   "") or ""
                from_ex    = _detect_exchange_eth(from_addr)
                to_ex      = _detect_exchange_eth(to_addr)
                amount_eth = value_wei / 1e18

                results.append({
                    "hash":           tx.get("hash", ""),
                    "amount_crypto":  round(amount_eth, 6),
                    "amount_usd":     round(amount_eth * eth_price, 2),
                    "from_address":   _shorten(from_addr),
                    "to_address":     _shorten(to_addr),
                    "from_exchange":  from_ex,
                    "to_exchange":    to_ex,
                    "to_is_exchange": bool(to_ex),
                    "exchange_name":  to_ex or from_ex,
                    "direction":      _direction(from_ex, to_ex),
                    "timestamp":      ts,
                    "chain":          "ETH",
                })

            time.sleep(0.2)

    except Exception:
        pass

    return results[:10], "Data from Etherscan"


def _fetch_whale_alert(ticker: str, min_usd: float = 500_000) -> tuple[list, str]:
    """Fetch large transactions from Whale Alert API for any ticker."""
    if not WHALE_ALERT_API_KEY or WHALE_ALERT_API_KEY == "your_whale_alert_api_key_here":
        return [], "WHALE_ALERT_API_KEY not configured — add it to backend/.env to enable whale tracking for this token"

    results: list = []
    try:
        resp = requests.get(
            f"{WHALE_ALERT_BASE}/transactions",
            params={
                "api_key":   WHALE_ALERT_API_KEY,
                "min_value": int(min_usd),
                "limit":     10,
                "currency":  ticker.lower(),
            },
            timeout=10,
            headers=_HEADERS,
        )
        resp.raise_for_status()
        txs = resp.json().get("transactions", [])

        for tx in txs:
            from_info  = tx.get("from", {})
            to_info    = tx.get("to", {})
            from_addr  = from_info.get("address", "")
            to_addr    = to_info.get("address", "")
            from_ex    = from_info.get("owner") if from_info.get("owner_type") == "exchange" else None
            to_ex      = to_info.get("owner")   if to_info.get("owner_type")   == "exchange" else None
            amount     = tx.get("amount", 0)
            amount_usd = tx.get("amount_usd", 0)
            ts         = datetime.fromtimestamp(tx.get("timestamp", 0), tz=timezone.utc).isoformat()

            results.append({
                "hash":           tx.get("hash", tx.get("id", "")),
                "amount_crypto":  round(float(amount), 6),
                "amount_usd":     round(float(amount_usd), 2),
                "from_address":   _shorten(from_addr),
                "to_address":     _shorten(to_addr),
                "from_exchange":  from_ex,
                "to_exchange":    to_ex,
                "to_is_exchange": bool(to_ex),
                "exchange_name":  to_ex or from_ex,
                "direction":      _direction(from_ex, to_ex),
                "timestamp":      ts,
                "chain":          tx.get("blockchain", ticker.upper()),
            })

    except Exception:
        pass

    return results[:10], "On-chain data sourced from Whale Alert API."


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class AnalyzeRequest(BaseModel):
    ticker: str
    price_data: dict
    headlines: list[str]
    technical_data: dict
    asset_type: str = "crypto"       # "crypto" | "stock"
    whale_data: dict = {}            # crypto only
    insider_data: dict = {}          # stock only
    options_data: dict = {}          # stock only
    astro_signal: float | None = None  # -1.0 to 1.0 from astro service, None if unavailable


class AnalyzeResponse(BaseModel):
    overall_sentiment: str
    confidence_score: int
    technical_summary: str
    support_resistance_analysis: str
    macd_analysis: str
    volume_analysis: str
    news_sentiment: str
    key_opportunities: list[str]
    key_risks: list[str]
    research_summary: str
    asset_type: str = "crypto"
    whale_sentiment_analysis: str = ""
    insider_analysis: str = ""
    options_analysis: str = ""
    smart_money_summary: str = ""
    astro_signal: float | None = None
    disclaimer: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Astro service helpers
# ---------------------------------------------------------------------------

def _fetch_astro_data() -> dict | None:
    """
    Fetch summary + insights from the Astro API.
    Returns None on any failure — caller must handle gracefully.
    Caches for 30 minutes to avoid blocking the main platform.
    """
    now = time.time()
    if _astro_cache["data"] is not None and (now - _astro_cache["fetched_at"]) < 1800:
        return _astro_cache["data"]

    if not ASTRO_API_KEY_INTERNAL:
        return None

    headers = {"x-api-key": ASTRO_API_KEY_INTERNAL}
    try:
        summary_resp = requests.get(
            f"{ASTRO_API_URL}/api/v1/insights/summary",
            headers=headers,
            timeout=8,
        )
        summary_resp.raise_for_status()
        summary = summary_resp.json()

        insights_resp = requests.get(
            f"{ASTRO_API_URL}/api/v1/insights",
            headers=headers,
            timeout=8,
        )
        insights_resp.raise_for_status()
        insights = insights_resp.json()

        data = {
            "sentiment_score":  summary.get("sentimentScore", 0),
            "overall_summary":  summary.get("overallSummary", ""),
            "total_insights":   summary.get("totalInsights", 0),
            "breakdown":        summary.get("breakdown", {}),
            "insights":         insights.get("insights", []),
            "astro_signal":     round(summary.get("sentimentScore", 0) * ASTRO_SIGNAL_WEIGHT, 4),
        }

        _astro_cache["data"]       = data
        _astro_cache["fetched_at"] = now
        return data

    except Exception:
        # Silent failure — never let astro service errors surface to users
        return None


@app.get("/astro")
def get_astro():
    """Return current astro insights to the frontend. Returns empty payload if service unavailable."""
    data = _fetch_astro_data()
    if data is None:
        return {
            "available":       False,
            "sentiment_score": 0,
            "astro_signal":    0,
            "overall_summary": "",
            "total_insights":  0,
            "breakdown":       {},
            "insights":        [],
        }
    return {"available": True, **data}


@app.get("/price/{ticker}")
def get_price(ticker: str):
    """Fetch current price, 24h change, market cap, and volume from CoinGecko."""
    coin_id = resolve_coin_id(ticker)

    try:
        resp = requests.get(
            f"{COINGECKO_BASE}/coins/markets",
            params={"vs_currency": "usd", "ids": coin_id, "sparkline": "true"},
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"CoinGecko request failed: {str(e)}")

    data = resp.json()
    if not data:
        raise HTTPException(status_code=404, detail=f"No market data found for '{ticker}'")

    coin = data[0]
    return {
        "ticker": ticker.upper(),
        "coin_id": coin_id,
        "name": coin["name"],
        "price_usd": coin["current_price"],
        "change_24h_pct": coin["price_change_percentage_24h"],
        "market_cap_usd": coin["market_cap"],
        "volume_24h_usd": coin["total_volume"],
        "last_updated": coin["last_updated"],
        "sparkline_7d": coin.get("sparkline_in_7d", {}).get("price", []),
    }


@app.get("/news/{ticker}")
def get_news(ticker: str):
    """Fetch 10 most recent news articles for a ticker from NewsAPI."""
    if not NEWS_API_KEY or NEWS_API_KEY == "your_news_api_key_here":
        return {"ticker": ticker.upper(), "articles": [], "warning": "NEWS_API_KEY not configured"}

    try:
        resp = requests.get(
            f"{NEWSAPI_BASE}/everything",
            params={
                "q": ticker,
                "sortBy": "publishedAt",
                "pageSize": 10,
                "language": "en",
                "apiKey": NEWS_API_KEY,
            },
            timeout=10,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"NewsAPI request failed: {str(e)}")

    body = resp.json()
    if body.get("status") != "ok":
        raise HTTPException(status_code=502, detail=f"NewsAPI error: {body.get('message', 'unknown')}")

    articles = [
        {
            "title": a["title"],
            "source": a["source"]["name"],
            "published_at": a["publishedAt"],
            "url": a["url"],
            "description": a.get("description"),
        }
        for a in body.get("articles", [])
    ]
    return {"ticker": ticker.upper(), "articles": articles}


def _compute_indicators(df: pd.DataFrame) -> dict:
    """
    Compute MACD (12,26,9), RSI (14), SMA 20/50, Bollinger Bands (20,2),
    volume analysis, and support/resistance from a DataFrame that has at minimum
    'close' and 'volume' columns.  If 'high' and 'low' are present they are used
    for tighter support/resistance levels (stock candles); otherwise 30-day close
    range is used (crypto market_chart).

    Returns the indicators sub-dict shared by /technicals and /stock/technicals.
    """
    df = df.copy()

    # pandas-ta macd() column order: MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
    macd_df        = ta.macd(df["close"], fast=12, slow=26, signal=9)
    df["macd"]     = macd_df.iloc[:, 0]
    df["macd_hist"]= macd_df.iloc[:, 1]
    df["macd_sig"] = macd_df.iloc[:, 2]
    df["rsi"]      = ta.rsi(df["close"], length=14)
    df["sma20"]    = ta.sma(df["close"], length=20)
    df["sma50"]    = ta.sma(df["close"], length=50)
    bb_df          = ta.bbands(df["close"], length=20, std=2)
    df["bb_lower"] = bb_df.iloc[:, 0]
    df["bb_mid"]   = bb_df.iloc[:, 1]
    df["bb_upper"] = bb_df.iloc[:, 2]

    last           = df.iloc[-1]
    current_price  = float(last["close"])
    current_volume = float(last["volume"])
    avg_volume     = float(df["volume"].tail(30).mean())

    # Support/resistance — use high/low (stock OHLCV) when available, else close range
    if "high" in df.columns and "low" in df.columns:
        support    = float(df["low"].tail(30).min())
        resistance = float(df["high"].tail(30).max())
    else:
        support    = float(df["close"].tail(30).min())
        resistance = float(df["close"].tail(30).max())

    # RSI
    rsi_val = r2(last["rsi"])
    if rsi_val is not None:
        if rsi_val >= 70:
            rsi_interp = f"RSI at {rsi_val} indicates overbought conditions — potential pullback ahead"
        elif rsi_val <= 30:
            rsi_interp = f"RSI at {rsi_val} indicates oversold conditions — potential bounce ahead"
        else:
            rsi_interp = f"RSI at {rsi_val} is in neutral territory with no extreme signal"
    else:
        rsi_interp = "RSI unavailable"

    # MACD
    macd_val   = r2(last["macd"])
    signal_val = r2(last["macd_sig"])
    hist_val   = r2(last["macd_hist"])
    if macd_val is not None and signal_val is not None:
        macd_interp = (
            f"MACD ({macd_val}) is above signal ({signal_val}) — bullish momentum"
            if macd_val > signal_val else
            f"MACD ({macd_val}) is below signal ({signal_val}) — bearish momentum"
        )
    else:
        macd_interp = "MACD unavailable"

    # SMA
    sma20_val = r2(last["sma20"])
    sma50_val = r2(last["sma50"])
    if sma20_val and sma50_val:
        if current_price > sma20_val > sma50_val:
            sma_interp = f"Price (${current_price:,.2f}) is above both SMA20 (${sma20_val:,.2f}) and SMA50 (${sma50_val:,.2f}) — strong uptrend"
        elif current_price < sma20_val < sma50_val:
            sma_interp = f"Price (${current_price:,.2f}) is below both SMA20 (${sma20_val:,.2f}) and SMA50 (${sma50_val:,.2f}) — downtrend"
        elif sma20_val > sma50_val:
            sma_interp = f"SMA20 (${sma20_val:,.2f}) crossed above SMA50 (${sma50_val:,.2f}) — golden cross signal"
        else:
            sma_interp = f"SMA20 (${sma20_val:,.2f}) below SMA50 (${sma50_val:,.2f}) — death cross signal"
    else:
        sma_interp = "SMA data unavailable"

    # Bollinger Bands
    bb_upper_v = r2(last["bb_upper"])
    bb_lower_v = r2(last["bb_lower"])
    bb_mid_v   = r2(last["bb_mid"])
    if bb_upper_v and bb_lower_v:
        bb_width_pct = r2(((bb_upper_v - bb_lower_v) / bb_mid_v) * 100) if bb_mid_v else None
        if current_price >= bb_upper_v:
            bb_interp = f"Price touching upper Bollinger Band (${bb_upper_v:,.2f}) — possible overbought or strong breakout"
        elif current_price <= bb_lower_v:
            bb_interp = f"Price touching lower Bollinger Band (${bb_lower_v:,.2f}) — possible oversold or breakdown"
        else:
            bb_interp = f"Price within Bollinger Bands (${bb_lower_v:,.2f}–${bb_upper_v:,.2f}), band width {bb_width_pct}%"
    else:
        bb_interp = "Bollinger Bands unavailable"

    # Volume
    vol_ratio = r2(current_volume / avg_volume) if avg_volume > 0 else None
    if vol_ratio is not None:
        if vol_ratio >= 1.5:
            vol_interp = f"Volume is {vol_ratio}x the 30-day average — significantly elevated, confirms price move"
        elif vol_ratio <= 0.5:
            vol_interp = f"Volume is {vol_ratio}x the 30-day average — well below average, weak conviction"
        else:
            vol_interp = f"Volume is {vol_ratio}x the 30-day average — near normal levels"
    else:
        vol_interp = "Volume data unavailable"

    # Support / Resistance
    support_pct    = r2(((current_price - support) / support) * 100) if support else None
    resistance_pct = r2(((resistance - current_price) / current_price) * 100) if resistance else None
    support_interp    = f"Support at ${support:,.2f} ({support_pct}% below current price)" if support_pct is not None else "Support unavailable"
    resistance_interp = f"Resistance at ${resistance:,.2f} ({resistance_pct}% above current price)" if resistance_pct is not None else "Resistance unavailable"

    return {
        "rsi":   {"value": rsi_val, "interpretation": rsi_interp},
        "macd":  {"macd": macd_val, "signal": signal_val, "histogram": hist_val, "interpretation": macd_interp},
        "sma":   {"sma20": sma20_val, "sma50": sma50_val, "interpretation": sma_interp},
        "bollinger_bands": {"upper": bb_upper_v, "middle": bb_mid_v, "lower": bb_lower_v, "interpretation": bb_interp},
        "volume": {"current": r2(current_volume), "avg_30d": r2(avg_volume), "ratio_vs_avg": vol_ratio, "interpretation": vol_interp},
        "support_resistance": {
            "support": r2(support),
            "resistance": r2(resistance),
            "support_interpretation": support_interp,
            "resistance_interpretation": resistance_interp,
        },
    }


@app.get("/technicals/{ticker}")
def get_technicals(ticker: str):
    """
    Fetch 90 days of daily close+volume from CoinGecko market_chart and compute
    MACD, RSI, SMA20/50, Bollinger Bands, volume analysis, support/resistance.
    """
    coin_id = resolve_coin_id(ticker)

    try:
        chart_resp = requests.get(
            f"{COINGECKO_BASE}/coins/{coin_id}/market_chart",
            params={"vs_currency": "usd", "days": 90, "interval": "daily"},
            timeout=15,
        )
        chart_resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"CoinGecko request failed: {str(e)}")

    chart   = chart_resp.json()
    prices  = chart.get("prices", [])
    volumes = chart.get("total_volumes", [])

    if not prices:
        raise HTTPException(status_code=404, detail=f"No market data for '{ticker}'")

    price_df = pd.DataFrame(prices,  columns=["ts", "close"])
    vol_df   = pd.DataFrame(volumes, columns=["ts", "volume"])

    for frame in (price_df, vol_df):
        frame["ts"] = pd.to_datetime(frame["ts"], unit="ms").dt.normalize()
        frame.set_index("ts", inplace=True)
        frame.sort_index(inplace=True)

    price_df = price_df[~price_df.index.duplicated(keep="last")]
    vol_df   = vol_df[~vol_df.index.duplicated(keep="last")]

    df = price_df.join(vol_df, how="left")
    df["volume"] = df["volume"].fillna(0)

    if len(df) < 26:
        raise HTTPException(status_code=422, detail="Not enough data to compute indicators (need ≥ 26 candles)")

    return {
        "ticker":        ticker.upper(),
        "current_price": r2(float(df.iloc[-1]["close"])),
        "indicators":    _compute_indicators(df),
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """
    Send all available data to Claude for a structured research report.
    Handles both crypto (whale data) and stock (insider + options) asset types.
    """
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "your_anthropic_api_key_here":
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured")

    asset_type = req.asset_type
    upper      = req.ticker.upper()

    # ── Shared formatters ──────────────────────────────────────────────────────
    def _fmt(v):
        if v is None:              return "N/A"
        if isinstance(v, (int, float)): return f"${v:,.2f}"
        return str(v)

    def fmt_tech(data: dict) -> str:
        lines = []
        for key, val in data.items():
            if isinstance(val, dict):
                interp  = val.get("interpretation", "")
                numeric = {k: v for k, v in val.items() if k != "interpretation"}
                lines.append(f"{key.upper()}: {numeric} — {interp}")
            else:
                lines.append(f"{key}: {val}")
        return "\n".join(lines)

    # ── Common blocks ──────────────────────────────────────────────────────────
    price = req.price_data
    if asset_type == "stock":
        price_block = (
            f"Current price:  {_fmt(price.get('price_usd'))}\n"
            f"Day change:     {price.get('change', 'N/A')} ({price.get('change_pct', 'N/A')}%)\n"
            f"52-week high:   {_fmt(price.get('week_52_high'))}\n"
            f"52-week low:    {_fmt(price.get('week_52_low'))}\n"
            f"Market cap:     {_fmt(price.get('market_cap_usd'))}\n"
            f"P/E ratio:      {price.get('pe_ratio', 'N/A')}\n"
            f"EPS:            {_fmt(price.get('eps'))}"
        )
    else:
        price_block = (
            f"Current price: {_fmt(price.get('price_usd'))}\n"
            f"24h change:    {price.get('change_24h_pct', 'N/A')}%\n"
            f"Market cap:    {_fmt(price.get('market_cap_usd'))}\n"
            f"24h volume:    {_fmt(price.get('volume_24h_usd'))}"
        )

    tech_block       = fmt_tech(req.technical_data.get("indicators", req.technical_data))
    headlines_block  = "\n".join(f"- {h}" for h in req.headlines) if req.headlines else "No headlines provided."

    # ── Asset-specific smart-money blocks + prompt ─────────────────────────────
    if asset_type == "stock":
        # Insider block
        ins = req.insider_data
        if ins and not ins.get("error"):
            cluster = ins.get("cluster_buying_alert", False)
            tx_lines = "\n".join(
                f"  {t.get('name','?')} {t.get('transaction_type','?')} "
                f"{t.get('shares', 0):,} shares @ {_fmt(t.get('price_per_share'))} "
                f"= {_fmt(t.get('value_usd'))} on {t.get('transaction_date','?')}"
                for t in ins.get("transactions", [])[:5]
            )
            insider_block = (
                f"Insider Sentiment: {ins.get('insider_sentiment', 'N/A')}\n"
                f"90d purchases: {_fmt(ins.get('total_buy_value_usd'))} ({ins.get('buy_count', 0)} transactions)\n"
                f"90d sales:     {_fmt(ins.get('total_sell_value_usd'))} ({ins.get('sell_count', 0)} transactions)\n"
                f"Net value:     {_fmt(ins.get('net_value_usd'))}\n"
                f"Cluster buying alert (3+ insiders in 30d): {'YES — historically very bullish signal' if cluster else 'No'}\n"
                f"Recent transactions:\n{tx_lines or '  None filed'}"
            )
        else:
            insider_block = ins.get("error", "No insider data available.") if ins else "No insider data available."

        # Options block
        opt = req.options_data
        if opt and not opt.get("error"):
            top_calls = ", ".join(f"${s}" for s in (opt.get("top_call_strikes") or []))
            top_puts  = ", ".join(f"${s}" for s in (opt.get("top_put_strikes")  or []))
            options_block = (
                f"Put/Call Ratio: {opt.get('put_call_ratio', 'N/A')} — {opt.get('put_call_interpretation', 'N/A')}\n"
                f"Options Sentiment: {opt.get('options_sentiment', 'N/A')}\n"
                f"Max Pain Price: {_fmt(opt.get('max_pain'))}\n"
                f"Average IV: {opt.get('avg_iv_pct', 'N/A')}%\n"
                f"Unusual activity (volume > 3x OI): {len(opt.get('unusual_activity', []))} positions\n"
                f"Smart money flags (>$1M notional): {len(opt.get('smart_money_flags', []))}\n"
                f"Top call OI strikes: {top_calls or 'N/A'}\n"
                f"Top put OI strikes:  {top_puts  or 'N/A'}"
            )
        else:
            options_block = opt.get("error", "No options data available.") if opt else "No options data available."

        # Astro signal block (stocks)
        astro_block = ""
        astro_signal_val = req.astro_signal
        astro_data = _fetch_astro_data()
        if astro_signal_val is not None:
            astro_direction = "bullish" if astro_signal_val > 0.05 else ("bearish" if astro_signal_val < -0.05 else "neutral")
            astro_summary = astro_data.get("overall_summary", "") if astro_data else ""
            astro_block = (
                f"\n## Astrological / Alternative Signal (weight: {ASTRO_SIGNAL_WEIGHT*100:.0f}%)\n"
                f"Astro Signal Score: {astro_signal_val:+.4f} (range -1.0 to 1.0, direction: {astro_direction})\n"
                + (f"Astro Summary: {astro_summary}\n" if astro_summary else "")
                + f"Note: This is a minor alternative data signal derived from financial astrology sources. "
                f"Weight it at {ASTRO_SIGNAL_WEIGHT*100:.0f}% in your overall assessment.\n"
            )

        prompt = f"""Analyze the following data for {upper} (Stock) and respond with a JSON object only — no markdown, no extra text.

## Price Data
{price_block}

## Technical Indicators
{tech_block}

## Recent News Headlines
{headlines_block}

## Insider Trading Activity (SEC Form 4 — last 90 days)
{insider_block}

## Options Market Analysis
{options_block}
{astro_block}
Respond with this exact JSON structure:
{{
  "overall_sentiment": "<bullish|bearish|neutral>",
  "confidence_score": <integer 1-10>,
  "technical_summary": "<paragraph 1>\\n\\n<paragraph 2>",
  "support_resistance_analysis": "<one paragraph>",
  "macd_analysis": "<one paragraph>",
  "volume_analysis": "<one paragraph>",
  "news_sentiment": "<bullish|bearish|neutral>",
  "key_opportunities": ["<opp 1>", "<opp 2>", "<opp 3>", "<opp 4>", "<opp 5>"],
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>", "<risk 4>", "<risk 5>"],
  "research_summary": "<paragraph 1>\\n\\n<paragraph 2>\\n\\n<paragraph 3>",
  "insider_analysis": "<one paragraph>",
  "options_analysis": "<one paragraph>",
  "smart_money_summary": "<one paragraph>",
  "asset_type": "stock",
  "disclaimer": "This is educational research only. Not financial advice."
}}

Rules:
- overall_sentiment and news_sentiment must be exactly one of: bullish, bearish, neutral
- confidence_score is an integer from 1 (very uncertain) to 10 (very certain)
- key_opportunities and key_risks must each have exactly 4-5 items
- technical_summary must be exactly 2 paragraphs
- research_summary must be exactly 3 paragraphs combining technicals, news, insider activity, and options
- insider_analysis must explain what the insider activity signals about management conviction
- options_analysis must explain what the options market is pricing in (P/C ratio, max pain, unusual flow)
- smart_money_summary must combine insider and options signals into one overall smart money assessment
- Pay special attention to cluster buying and unusual options activity — these are historically significant
- disclaimer must be exactly: "This is educational research only. Not financial advice."
"""
        required = {
            "overall_sentiment", "confidence_score", "technical_summary",
            "support_resistance_analysis", "macd_analysis", "volume_analysis",
            "news_sentiment", "key_opportunities", "key_risks",
            "research_summary", "insider_analysis", "options_analysis",
            "smart_money_summary", "asset_type", "disclaimer",
        }

    else:  # crypto
        w = req.whale_data
        if w:
            directions  = [t.get("direction", "") for t in w.get("large_transactions", [])[:5]]
            whale_block = (
                f"Whale Sentiment: {w.get('whale_sentiment', 'N/A')}\n"
                f"Exchange Inflows (selling pressure): {w.get('exchange_inflow_count', 0)}\n"
                f"Exchange Outflows (accumulation):    {w.get('exchange_outflow_count', 0)}\n"
                f"Inflow/Outflow Ratio: {w.get('inflow_outflow_ratio', 'N/A')}\n"
                f"Recent large tx directions: {', '.join(directions) if directions else 'N/A'}\n"
                f"Whale Summary: {w.get('whale_summary', 'N/A')}"
            )
        else:
            whale_block = "No whale data available for this ticker."

        # Astro signal block (optional — only included when available)
        astro_block = ""
        astro_signal_val = req.astro_signal
        astro_data = _fetch_astro_data()
        if astro_signal_val is not None:
            astro_direction = "bullish" if astro_signal_val > 0.05 else ("bearish" if astro_signal_val < -0.05 else "neutral")
            astro_summary = astro_data.get("overall_summary", "") if astro_data else ""
            astro_block = (
                f"\n## Astrological / Alternative Signal (weight: {ASTRO_SIGNAL_WEIGHT*100:.0f}%)\n"
                f"Astro Signal Score: {astro_signal_val:+.4f} (range -1.0 to 1.0, direction: {astro_direction})\n"
                + (f"Astro Summary: {astro_summary}\n" if astro_summary else "")
                + f"Note: This is a minor alternative data signal derived from financial astrology sources. "
                f"Weight it at {ASTRO_SIGNAL_WEIGHT*100:.0f}% in your overall assessment.\n"
            )

        prompt = f"""Analyze the following data for {upper} (Crypto) and respond with a JSON object only — no markdown, no extra text.

## Price Data
{price_block}

## Technical Indicators
{tech_block}

## Recent News Headlines
{headlines_block}

## Whale & Smart Money Activity
{whale_block}
{astro_block}
Respond with this exact JSON structure:
{{
  "overall_sentiment": "<bullish|bearish|neutral>",
  "confidence_score": <integer 1-10>,
  "technical_summary": "<paragraph 1>\\n\\n<paragraph 2>",
  "support_resistance_analysis": "<one paragraph>",
  "macd_analysis": "<one paragraph>",
  "volume_analysis": "<one paragraph>",
  "news_sentiment": "<bullish|bearish|neutral>",
  "key_opportunities": ["<opp 1>", "<opp 2>", "<opp 3>", "<opp 4>", "<opp 5>"],
  "key_risks": ["<risk 1>", "<risk 2>", "<risk 3>", "<risk 4>", "<risk 5>"],
  "research_summary": "<paragraph 1>\\n\\n<paragraph 2>\\n\\n<paragraph 3>",
  "whale_sentiment_analysis": "<one paragraph>",
  "smart_money_summary": "<one paragraph>",
  "asset_type": "crypto",
  "disclaimer": "This is educational research only. Not financial advice."
}}

Rules:
- overall_sentiment and news_sentiment must be exactly one of: bullish, bearish, neutral
- confidence_score is an integer from 1 (very uncertain) to 10 (very certain)
- key_opportunities and key_risks must each have exactly 4-5 items
- technical_summary must be exactly 2 paragraphs interpreting all indicators together
- research_summary must be exactly 3 paragraphs combining technical analysis, news, and whale activity
- whale_sentiment_analysis must explain whether whale behaviour supports or contradicts the technical signals
- smart_money_summary must summarise overall whale flow significance
- disclaimer must be exactly: "This is educational research only. Not financial advice."
"""
        required = {
            "overall_sentiment", "confidence_score", "technical_summary",
            "support_resistance_analysis", "macd_analysis", "volume_analysis",
            "news_sentiment", "key_opportunities", "key_risks",
            "research_summary", "whale_sentiment_analysis", "smart_money_summary",
            "asset_type", "disclaimer",
        }

    # ── Claude call ────────────────────────────────────────────────────────────
    system_prompt = (
        "You are a professional market analyst specializing in both crypto and equities. "
        "Analyze all provided data including technical indicators, insider activity, options flow, "
        "and news sentiment to produce comprehensive educational research. "
        "For stocks, pay special attention to insider cluster buying and unusual options activity "
        "as these are historically significant signals. "
        "Never give direct buy or sell recommendations. "
        "Always frame as educational research for informed decision making."
    )

    try:
        client  = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
        message = client.messages.create(
            model="claude-sonnet-4-5",
            max_tokens=2048,
            system=system_prompt,
            messages=[{"role": "user", "content": prompt}],
        )
    except anthropic.APIStatusError as e:
        raise HTTPException(status_code=502, detail=f"Anthropic API error: {e.message}")
    except anthropic.APIConnectionError:
        raise HTTPException(status_code=502, detail="Could not connect to Anthropic API")

    raw = message.content[0].text.strip()
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Claude returned non-JSON response: {raw[:200]}")

    missing = required - parsed.keys()
    if missing:
        raise HTTPException(status_code=500, detail=f"Claude response missing fields: {missing}")

    for field in ("overall_sentiment", "news_sentiment"):
        if parsed.get(field) not in ("bullish", "bearish", "neutral"):
            parsed[field] = "neutral"

    parsed["confidence_score"] = max(1, min(10, int(parsed.get("confidence_score", 5))))
    parsed["disclaimer"]       = "This is educational research only. Not financial advice."
    parsed["asset_type"]       = asset_type
    parsed["astro_signal"]     = req.astro_signal  # pass through for frontend display

    # Ensure all optional fields exist with safe defaults
    for field in ("whale_sentiment_analysis", "insider_analysis", "options_analysis", "smart_money_summary"):
        parsed.setdefault(field, "")

    return AnalyzeResponse(**parsed)


@app.get("/whales/{ticker}")
def get_whales(ticker: str):
    """
    Fetch whale and smart money on-chain activity for a crypto ticker.

    - BTC  → Blockchain.info (no API key required)
    - ETH-ecosystem tokens → Etherscan (requires ETHERSCAN_API_KEY in .env)
    - All others → returns empty transactions with an explanatory note
    """
    upper   = ticker.upper()
    coin_id = resolve_coin_id(ticker)

    # ── 1. Current USD price (needed for threshold conversion) ──────────────
    try:
        px_resp = requests.get(
            f"{COINGECKO_BASE}/simple/price",
            params={"ids": coin_id, "vs_currencies": "usd"},
            timeout=10,
        )
        px_resp.raise_for_status()
        price_usd = px_resp.json().get(coin_id, {}).get("usd", 0)
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Price fetch failed: {e}")

    if not price_usd:
        raise HTTPException(status_code=404, detail=f"No USD price found for '{ticker}'")

    # ── 2. Fetch large transactions from the appropriate chain ───────────────
    if upper == "BTC":
        large_txs  = _fetch_btc_whales(price_usd)
        chain_note = "On-chain data sourced from Blockchain.info (no API key required)."
    elif upper in ETH_CHAIN_TICKERS:
        large_txs, chain_note = _fetch_eth_whales(price_usd)
    else:
        large_txs, chain_note = _fetch_whale_alert(upper, min_usd=500_000)

    # ── 3. Sentiment & narrative ─────────────────────────────────────────────
    sentiment, label, inflow, outflow, ratio = _whale_sentiment(large_txs)
    summary = _whale_summary(upper, large_txs, sentiment, inflow, outflow)

    # ── 4. Top holders — CoinGecko free tier does not expose this field ──────
    #    We attempt the /coins/{id} call and surface whatever CoinGecko returns.
    top_holders_pct = None
    holders_note    = "Top-holder concentration data is not available on the CoinGecko free tier."
    try:
        cg = requests.get(
            f"{COINGECKO_BASE}/coins/{coin_id}",
            params={
                "localization":   "false",
                "tickers":        "false",
                "market_data":    "true",
                "community_data": "false",
                "developer_data": "false",
                "sparkline":      "false",
            },
            timeout=10,
        )
        if cg.ok:
            coin_data = cg.json()
            # Extract circulating / total supply ratio as a basic concentration proxy
            market = coin_data.get("market_data", {})
            circ   = market.get("circulating_supply")
            total  = market.get("total_supply")
            if circ and total and total > 0:
                pct = round((1 - circ / total) * 100, 2)
                top_holders_pct = pct
                holders_note = (
                    f"{pct}% of {upper} total supply is not in circulation "
                    f"(held by team, locked, burned, or unreleased). "
                    f"Per-address holder distribution requires a paid analytics service."
                )
    except Exception:
        pass

    return {
        "ticker":                    upper,
        "whale_sentiment":           sentiment,
        "whale_sentiment_label":     label,
        "large_transactions":        large_txs,
        "exchange_inflow_count":     inflow,
        "exchange_outflow_count":    outflow,
        "inflow_outflow_ratio":      ratio,
        "whale_summary":             summary,
        "top_holders_concentration": top_holders_pct,
        "holders_note":              holders_note,
        "chain_note":                chain_note,
        "min_transaction_usd":       500_000,
        "disclaimer":                "This is educational research only. Not financial advice.",
    }


@app.get("/insiders/{ticker}")
def get_insiders(ticker: str):
    """
    Fetch insider trading activity for a stock symbol via Finnhub (SEC Form 4 filings).
    Filters to open-market purchases (P) and sales (S) in the last 90 days.
    """
    if not FINNHUB_API_KEY or FINNHUB_API_KEY == "your_finnhub_api_key_here":
        raise HTTPException(
            status_code=503,
            detail="FINNHUB_API_KEY not configured — add it to backend/.env",
        )

    upper  = ticker.upper()
    cutoff = (datetime.now(tz=timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")

    try:
        resp = requests.get(
            f"{FINNHUB_BASE}/stock/insider-transactions",
            params={"symbol": upper, "token": FINNHUB_API_KEY},
            timeout=10,
            headers=_HEADERS,
        )
        resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Finnhub request failed: {e}")

    raw = resp.json().get("data", [])

    # Keep only open-market purchases (P) and sales (S) within the last 90 days
    recent = [
        t for t in raw
        if t.get("transactionDate", "") >= cutoff
        and t.get("transactionCode") in ("P", "S")
    ]

    buys  = [t for t in recent if t.get("transactionCode") == "P"]
    sells = [t for t in recent if t.get("transactionCode") == "S"]

    def _tx_value(t: dict) -> float:
        return abs(t.get("change", 0)) * (t.get("transactionPrice") or 0)

    buy_value  = sum(_tx_value(t) for t in buys)
    sell_value = sum(_tx_value(t) for t in sells)
    net_value  = buy_value - sell_value

    # Sentiment — require 10 % imbalance to avoid noise
    if buy_value > sell_value * 1.1:
        sentiment_label = "bullish"
        sentiment       = "Bullish — Insiders are net buyers"
    elif sell_value > buy_value * 1.1:
        sentiment_label = "bearish"
        sentiment       = "Bearish — Insiders are net sellers"
    else:
        sentiment_label = "neutral"
        sentiment       = "Neutral — Mixed insider activity"

    # Largest single transaction by USD value
    largest = max(recent, key=_tx_value, default=None)

    def _fmt_tx(t: dict) -> dict:
        shares = abs(t.get("change", 0))
        price  = t.get("transactionPrice") or 0
        return {
            "name":             t.get("name", "Unknown"),
            "transaction_type": "Purchase" if t.get("transactionCode") == "P" else "Sale",
            "shares":           shares,
            "price_per_share":  round(price, 2) if price else None,
            "value_usd":        round(shares * price, 2) if price else None,
            "transaction_date": t.get("transactionDate", ""),
            "filing_date":      t.get("filingDate", ""),
        }

    transactions = [
        _fmt_tx(t)
        for t in sorted(recent, key=lambda x: x.get("transactionDate", ""), reverse=True)
    ]

    # Plain-English summary
    total = len(recent)
    if total == 0:
        summary = (
            f"No open-market insider purchases or sales were filed for {upper} "
            f"in the last 90 days. This is educational research only — not financial advice."
        )
    else:
        base = (
            f"Over the last 90 days, {upper} insiders filed {total} open-market "
            f"transaction{'s' if total != 1 else ''}: {len(buys)} "
            f"purchase{'s' if len(buys) != 1 else ''} totalling ${buy_value:,.0f} and "
            f"{len(sells)} sale{'s' if len(sells) != 1 else ''} totalling ${sell_value:,.0f}. "
        )
        if sentiment_label == "bullish":
            detail = (
                "The dominant pattern of insider buying suggests those with the deepest knowledge "
                "of the company's prospects are adding exposure. Large open-market purchases in "
                "particular — where insiders use personal funds — are historically viewed as a "
                "constructive signal."
            )
        elif sentiment_label == "bearish":
            detail = (
                "The dominant pattern of insider selling may reflect profit-taking, diversification, "
                "or personal liquidity needs rather than a negative outlook. However, heavy or "
                "coordinated selling has historically preceded periods of price weakness. Note that "
                "pre-planned 10b5-1 sales and option exercises are routine and may not be directional."
            )
        else:
            detail = (
                "The balanced mix of purchases and sales does not indicate strongly directional "
                "conviction from company insiders at this time."
            )
        summary = base + detail + " This is educational research only — not financial advice."

    return {
        "ticker":                  upper,
        "insider_sentiment":       sentiment,
        "insider_sentiment_label": sentiment_label,
        "transactions":            transactions,
        "total_transactions_90d":  total,
        "buy_count":               len(buys),
        "sell_count":              len(sells),
        "total_buy_value_usd":     round(buy_value, 2),
        "total_sell_value_usd":    round(sell_value, 2),
        "net_value_usd":           round(net_value, 2),
        "largest_transaction":     _fmt_tx(largest) if largest else None,
        "insider_summary":         summary,
        "data_source":             "Finnhub — SEC Form 4 filings (last 90 days, open-market only)",
        "disclaimer":              "This is educational research only. Not financial advice.",
    }


# ===========================================================================
# Stock endpoints — Finnhub
# ===========================================================================

def _finnhub_get(path: str, params: dict | None = None) -> dict:
    """GET from Finnhub; raises HTTPException on missing key or request failure."""
    if not FINNHUB_API_KEY or FINNHUB_API_KEY == "your_finnhub_api_key_here":
        raise HTTPException(status_code=503, detail="FINNHUB_API_KEY not configured — add it to backend/.env")
    try:
        resp = requests.get(
            f"{FINNHUB_BASE}/{path}",
            params={"token": FINNHUB_API_KEY, **(params or {})},
            timeout=12,
            headers=_HEADERS,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"Finnhub request failed: {e}")


def _calc_max_pain(calls: list, puts: list) -> float | None:
    """
    Strike price at which total intrinsic value owed to option buyers is minimised
    (= maximum pain for option buyers / maximum premium retention for sellers).
    """
    strikes = sorted(
        {c["strike"] for c in calls if c.get("strike")} |
        {p["strike"] for p in puts  if p.get("strike")}
    )
    if not strikes:
        return None
    min_pain, pain_strike = float("inf"), strikes[0]
    for s in strikes:
        call_payout = sum(max(0.0, s - c["strike"]) * (c.get("openInterest") or 0) * 100 for c in calls if c.get("strike"))
        put_payout  = sum(max(0.0, p["strike"] - s) * (p.get("openInterest") or 0) * 100 for p in puts  if p.get("strike"))
        total = call_payout + put_payout
        if total < min_pain:
            min_pain, pain_strike = total, s
    return pain_strike


@app.get("/detect/{ticker}")
def detect_asset(ticker: str):
    """Determine whether a ticker is crypto (CoinGecko) or a stock (Finnhub)."""
    upper = ticker.upper()

    # ── 1. Known crypto map first (zero API calls) ────────────────────────────
    if upper in TICKER_TO_ID:
        coin_id = TICKER_TO_ID[upper]
        name    = upper
        try:
            cg = requests.get(
                f"{COINGECKO_BASE}/coins/{coin_id}",
                params={"localization": "false", "market_data": "false",
                        "community_data": "false", "developer_data": "false"},
                timeout=8,
            )
            if cg.ok:
                name = cg.json().get("name", upper)
        except Exception:
            pass
        return {"ticker": upper, "asset_type": "crypto", "name": name, "coin_id": coin_id, "exchange": None}

    # ── 2. CoinGecko search ───────────────────────────────────────────────────
    try:
        cg = requests.get(f"{COINGECKO_BASE}/search", params={"query": ticker}, timeout=8)
        if cg.ok:
            for coin in cg.json().get("coins", []):
                if coin.get("symbol", "").upper() == upper:
                    return {
                        "ticker":     upper,
                        "asset_type": "crypto",
                        "name":       coin.get("name", upper),
                        "coin_id":    coin["id"],
                        "exchange":   None,
                    }
    except Exception:
        pass

    # ── 3. Finnhub stock search ───────────────────────────────────────────────
    name, exchange = upper, ""
    if FINNHUB_API_KEY and FINNHUB_API_KEY != "your_finnhub_api_key_here":
        try:
            resp = requests.get(
                f"{FINNHUB_BASE}/search",
                params={"q": upper, "token": FINNHUB_API_KEY},
                timeout=8,
            )
            if resp.ok:
                for r in resp.json().get("result", []):
                    if r.get("symbol", "").upper() == upper:
                        name     = r.get("description", upper)
                        exchange = r.get("primaryExchange", "")
                        break
        except Exception:
            pass

    return {"ticker": upper, "asset_type": "stock", "name": name, "coin_id": None, "exchange": exchange}


@app.get("/stock/price/{ticker}")
def get_stock_price(ticker: str):
    """Current quote + fundamental metrics for a stock ticker via Finnhub."""
    upper  = ticker.upper()
    errors: list[str] = []

    try:
        quote = _finnhub_get("quote", {"symbol": upper})
    except HTTPException as e:
        raise e

    current = quote.get("c")
    if not current:
        raise HTTPException(
            status_code=404,
            detail=f"No price data found for '{ticker}'. Verify this is a valid stock symbol.",
        )

    metrics: dict = {}
    try:
        m       = _finnhub_get("stock/metric", {"symbol": upper, "metric": "all"})
        metrics = m.get("metric", {})
    except HTTPException as e:
        errors.append(f"Fundamentals unavailable: {e.detail}")

    cap_raw = metrics.get("marketCapitalization")   # Finnhub returns in millions USD
    return {
        "ticker":         upper,
        "asset_type":     "stock",
        "price_usd":      current,
        "change":         round(quote.get("d",  0) or 0, 2),
        "change_pct":     round(quote.get("dp", 0) or 0, 2),
        "prev_close":     quote.get("pc"),
        "day_high":       quote.get("h"),
        "day_low":        quote.get("l"),
        "week_52_high":   metrics.get("52WeekHigh"),
        "week_52_low":    metrics.get("52WeekLow"),
        "market_cap_usd": round(cap_raw * 1_000_000) if cap_raw else None,
        "pe_ratio":       metrics.get("peNormalizedAnnual"),
        "eps":            metrics.get("epsBasicExclExtraItemsAnnual"),
        "beta":           metrics.get("beta"),
        "dividend_yield": metrics.get("dividendYieldIndicatedAnnual"),
        "errors":         errors or None,
    }


@app.get("/stock/technicals/{ticker}")
def get_stock_technicals(ticker: str):
    """90-day OHLCV from Yahoo Finance daily candles + same indicator set as /technicals."""
    import yfinance as yf
    upper = ticker.upper()

    try:
        hist = yf.Ticker(upper).history(period="3mo", interval="1d")
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"yfinance error for '{ticker}': {exc}")

    if hist.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No price history available for '{ticker}'. Verify it is a valid stock ticker.",
        )

    df = hist[["Open", "High", "Low", "Close", "Volume"]].rename(columns={
        "Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume",
    })
    df.index = df.index.tz_localize(None)

    if len(df) < 26:
        raise HTTPException(
            status_code=422,
            detail=f"Not enough data for '{ticker}' (need ≥ 26 candles, got {len(df)})",
        )

    return {
        "ticker":        upper,
        "asset_type":    "stock",
        "current_price": r2(float(df.iloc[-1]["close"])),
        "indicators":    _compute_indicators(df),
    }


@app.get("/stock/news/{ticker}")
def get_stock_news(ticker: str):
    """Last 10 company news articles from Finnhub — same shape as /news/{ticker}."""
    upper     = ticker.upper()
    to_date   = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
    from_date = (datetime.now(tz=timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        data = _finnhub_get("company-news", {"symbol": upper, "from": from_date, "to": to_date})
    except HTTPException as e:
        raise e

    articles = [
        {
            "title":        a.get("headline", ""),
            "source":       a.get("source", ""),
            "published_at": datetime.fromtimestamp(a["datetime"], tz=timezone.utc).isoformat()
                            if a.get("datetime") else None,
            "url":          a.get("url", ""),
            "description":  a.get("summary", ""),
        }
        for a in data[:10]
        if a.get("headline")
    ]
    return {"ticker": upper, "asset_type": "stock", "articles": articles}


@app.get("/stock/insiders/{ticker}")
def get_stock_insiders(ticker: str):
    """
    Insider trading activity via Finnhub (SEC Form 4).
    Open-market purchases (P) and sales (S) only, last 90 days.
    Includes cluster buying detection: 3+ unique insiders buying in last 30 days.
    """
    upper      = ticker.upper()
    cutoff_90  = (datetime.now(tz=timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    cutoff_30  = (datetime.now(tz=timezone.utc) - timedelta(days=30)).strftime("%Y-%m-%d")

    try:
        raw_data = _finnhub_get("stock/insider-transactions", {"symbol": upper})
    except HTTPException as e:
        raise e

    raw    = raw_data.get("data", [])
    recent = [t for t in raw if t.get("transactionDate", "") >= cutoff_90 and t.get("transactionCode") in ("P", "S")]
    buys   = [t for t in recent if t.get("transactionCode") == "P"]
    sells  = [t for t in recent if t.get("transactionCode") == "S"]

    def _tx_value(t: dict) -> float:
        return abs(t.get("change", 0)) * (t.get("transactionPrice") or 0)

    buy_value  = sum(_tx_value(t) for t in buys)
    sell_value = sum(_tx_value(t) for t in sells)
    net_value  = buy_value - sell_value

    # Cluster buying: 3+ unique insiders purchased in the last 30 days
    cluster_buyers       = {t.get("name") for t in buys if t.get("transactionDate", "") >= cutoff_30 and t.get("name")}
    cluster_buying_alert = len(cluster_buyers) >= 3

    if buy_value > sell_value * 1.1:
        sentiment_label, sentiment = "bullish", "Bullish — Insiders are net buyers"
    elif sell_value > buy_value * 1.1:
        sentiment_label, sentiment = "bearish", "Bearish — Insiders are net sellers"
    else:
        sentiment_label, sentiment = "neutral", "Neutral — Mixed insider activity"

    largest = max(recent, key=_tx_value, default=None)

    def _fmt_tx(t: dict) -> dict:
        shares = abs(t.get("change", 0))
        price  = t.get("transactionPrice") or 0
        return {
            "name":             t.get("name", "Unknown"),
            "title":            t.get("reportingTitle", t.get("title", "")),
            "transaction_type": "Purchase" if t.get("transactionCode") == "P" else "Sale",
            "shares":           shares,
            "price_per_share":  round(price, 2) if price else None,
            "value_usd":        round(shares * price, 2) if price else None,
            "transaction_date": t.get("transactionDate", ""),
            "filing_date":      t.get("filingDate", ""),
        }

    transactions = [_fmt_tx(t) for t in sorted(recent, key=lambda x: x.get("transactionDate", ""), reverse=True)]

    total = len(recent)
    if total == 0:
        summary = (
            f"No open-market insider purchases or sales were filed for {upper} in the last 90 days. "
            "This is educational research only — not financial advice."
        )
    else:
        base = (
            f"Over the last 90 days, {upper} insiders filed {total} open-market transaction"
            f"{'s' if total != 1 else ''}: {len(buys)} purchase{'s' if len(buys) != 1 else ''} "
            f"totalling ${buy_value:,.0f} and {len(sells)} sale{'s' if len(sells) != 1 else ''} "
            f"totalling ${sell_value:,.0f}. "
        )
        if cluster_buying_alert:
            base += f"{len(cluster_buyers)} different insiders bought in the last 30 days — cluster buying is historically a very bullish signal. "
        if sentiment_label == "bullish":
            detail = (
                "The dominant insider buying pattern suggests those with the deepest knowledge of the company's "
                "prospects are adding personal exposure. Large open-market purchases — where insiders use their own "
                "funds rather than exercising pre-granted options — are viewed as particularly constructive."
            )
        elif sentiment_label == "bearish":
            detail = (
                "The dominant selling may reflect profit-taking, diversification, or liquidity needs. Context matters: "
                "pre-planned 10b5-1 sales and option exercises are routine and may not be directional. However, "
                "heavy unplanned selling has historically preceded periods of price weakness."
            )
        else:
            detail = "The balanced mix of purchases and sales does not indicate strongly directional conviction from insiders."
        summary = base + detail + " This is educational research only — not financial advice."

    return {
        "ticker":                  upper,
        "asset_type":              "stock",
        "insider_sentiment":       sentiment,
        "insider_sentiment_label": sentiment_label,
        "transactions":            transactions,
        "total_transactions_90d":  total,
        "buy_count":               len(buys),
        "sell_count":              len(sells),
        "total_buy_value_usd":     round(buy_value, 2),
        "total_sell_value_usd":    round(sell_value, 2),
        "net_value_usd":           round(net_value, 2),
        "cluster_buying_alert":    cluster_buying_alert,
        "cluster_buyers":          sorted(cluster_buyers),
        "largest_transaction":     _fmt_tx(largest) if largest else None,
        "insider_summary":         summary,
        "data_source":             "Finnhub — SEC Form 4 filings (last 90 days, open-market only)",
        "disclaimer":              "This is educational research only. Not financial advice.",
    }


@app.get("/stock/options/{ticker}")
def get_stock_options(ticker: str):
    """
    Options chain analysis via Yahoo Finance (yfinance):
    put/call ratio, max pain, unusual activity (vol > 3x OI),
    smart money flags (notional > $1M), IV summary, top OI strikes.
    Returns a structured error rather than crashing if data is unavailable.
    """
    import yfinance as yf
    upper  = ticker.upper()
    errors: list[str] = []

    try:
        ticker_obj   = yf.Ticker(upper)
        exp_dates    = ticker_obj.options          # tuple of expiry strings
    except Exception as exc:
        return {"ticker": upper, "asset_type": "stock", "error": str(exc), "options_sentiment": "neutral"}

    if not exp_dates:
        return {
            "ticker": upper, "asset_type": "stock",
            "error": f"No options chain found for '{ticker}'. The symbol may not have listed options.",
            "options_sentiment": "neutral",
        }

    # Flatten across the next 4 expirations to keep response size reasonable
    all_calls: list[dict] = []
    all_puts:  list[dict] = []
    expirations_analyzed = 0
    for exp in exp_dates[:4]:
        try:
            chain = ticker_obj.option_chain(exp)
        except Exception as exc:
            errors.append(f"Could not fetch chain for {exp}: {exc}")
            continue
        expirations_analyzed += 1

        def _row_to_dict(row) -> dict:
            def _get(key):
                val = row[key] if key in row.index else None
                return val if val == val else None  # NaN check
            return {
                "strike":            _get("strike"),
                "volume":            int(_get("volume") or 0),
                "openInterest":      int(_get("openInterest") or 0),
                "impliedVolatility": float(_get("impliedVolatility") or 0),
            }

        all_calls.extend(_row_to_dict(r) for _, r in chain.calls.iterrows())
        all_puts.extend(_row_to_dict(r)  for _, r in chain.puts.iterrows())

    # ── Put/Call ratio ─────────────────────────────────────────────────────────
    call_vol = sum(c.get("volume") or 0 for c in all_calls)
    put_vol  = sum(p.get("volume") or 0 for p in all_puts)
    call_oi  = sum(c.get("openInterest") or 0 for c in all_calls)
    put_oi   = sum(p.get("openInterest") or 0 for p in all_puts)

    if call_vol > 0:
        pc_ratio, pc_basis = round(put_vol / call_vol, 3), "volume"
    elif call_oi > 0:
        pc_ratio, pc_basis = round(put_oi / call_oi, 3),  "open interest"
    else:
        pc_ratio, pc_basis = None, "unavailable"

    if pc_ratio is None:
        pc_interp, opt_sentiment = "Put/Call ratio unavailable", "neutral"
    elif pc_ratio > 1.0:
        pc_interp, opt_sentiment = f"P/C ratio {pc_ratio} (bearish — more puts than calls)", "bearish"
    elif pc_ratio < 0.7:
        pc_interp, opt_sentiment = f"P/C ratio {pc_ratio} (bullish — significantly more calls than puts)", "bullish"
    else:
        pc_interp, opt_sentiment = f"P/C ratio {pc_ratio} (neutral)", "neutral"

    # ── Max pain ───────────────────────────────────────────────────────────────
    max_pain = _calc_max_pain(all_calls, all_puts)

    # ── Unusual activity: volume ≥ 10 contracts AND volume > 3× OI ────────────
    unusual: list[dict] = []
    for opt_list, kind in ((all_calls, "CALL"), (all_puts, "PUT")):
        for o in opt_list:
            vol = o.get("volume") or 0
            oi  = o.get("openInterest") or 0
            if vol >= 10 and oi > 0 and vol >= oi * 3:
                unusual.append({
                    "type":           kind,
                    "strike":         o.get("strike"),
                    "volume":         vol,
                    "open_interest":  oi,
                    "volume_oi_ratio":round(vol / oi, 1),
                    "implied_volatility_pct": round((o.get("impliedVolatility") or 0) * 100, 1),
                })
    unusual.sort(key=lambda x: x["volume"], reverse=True)

    # ── Smart money: notional > $1M (volume × strike × 100 shares/contract) ───
    smart_money: list[dict] = []
    for opt_list, kind in ((all_calls, "CALL"), (all_puts, "PUT")):
        for o in opt_list:
            strike   = o.get("strike") or 0
            vol      = o.get("volume") or 0
            notional = vol * strike * 100
            if notional >= 1_000_000:
                smart_money.append({
                    "type":         kind,
                    "strike":       strike,
                    "volume":       vol,
                    "notional_usd": round(notional),
                    "implied_volatility_pct": round((o.get("impliedVolatility") or 0) * 100, 1),
                })
    smart_money.sort(key=lambda x: x["notional_usd"], reverse=True)

    # Upgrade/downgrade sentiment if smart money skews strongly one way
    if smart_money:
        call_notional = sum(s["notional_usd"] for s in smart_money if s["type"] == "CALL")
        put_notional  = sum(s["notional_usd"] for s in smart_money if s["type"] == "PUT")
        if call_notional > put_notional * 1.5:
            opt_sentiment = "bullish"
        elif put_notional > call_notional * 1.5:
            opt_sentiment = "bearish"

    # ── Average IV ─────────────────────────────────────────────────────────────
    ivs    = [(o.get("impliedVolatility") or 0) * 100 for o in all_calls + all_puts if (o.get("impliedVolatility") or 0) > 0]
    avg_iv = round(sum(ivs) / len(ivs), 1) if ivs else None

    # ── Top open-interest strikes ──────────────────────────────────────────────
    top_call_strikes = [c["strike"] for c in sorted(all_calls, key=lambda x: x.get("openInterest") or 0, reverse=True)[:3] if c.get("strike")]
    top_put_strikes  = [p["strike"] for p in sorted(all_puts,  key=lambda x: x.get("openInterest") or 0, reverse=True)[:3] if p.get("strike")]

    # ── Plain-English summary ──────────────────────────────────────────────────
    if not (all_calls or all_puts):
        options_summary = f"No options data could be retrieved for {upper}."
    else:
        options_summary = (
            f"The {upper} options market shows a put/call ratio of {pc_ratio} (based on {pc_basis}), "
            f"indicating {'bearish hedging activity' if opt_sentiment == 'bearish' else 'bullish call positioning' if opt_sentiment == 'bullish' else 'neutral positioning'}. "
        )
        if max_pain:
            options_summary += f"The max pain price is ${max_pain:,.2f} — the strike at which the most option premium expires worthless. "
        if avg_iv is not None:
            options_summary += f"Average implied volatility across the chain is {avg_iv}%. "
        if unusual:
            options_summary += f"{len(unusual)} position{'s' if len(unusual) != 1 else ''} showed volume exceeding 3× open interest — potentially informed activity. "
        if smart_money:
            options_summary += f"{len(smart_money)} trade{'s' if len(smart_money) != 1 else ''} exceeded $1M notional and may represent institutional positioning. "
        options_summary += "This is educational research only — not financial advice."

    return {
        "ticker":                  upper,
        "asset_type":              "stock",
        "options_sentiment":       opt_sentiment,
        "put_call_ratio":          pc_ratio,
        "put_call_basis":          pc_basis,
        "put_call_interpretation": pc_interp,
        "max_pain":                max_pain,
        "avg_iv_pct":              avg_iv,
        "total_call_volume":       call_vol,
        "total_put_volume":        put_vol,
        "total_call_oi":           call_oi,
        "total_put_oi":            put_oi,
        "unusual_activity":        unusual[:10],
        "smart_money_flags":       smart_money[:10],
        "top_call_strikes":        top_call_strikes,
        "top_put_strikes":         top_put_strikes,
        "options_summary":         options_summary,
        "expirations_analyzed":    expirations_analyzed,
        "errors":                  errors or None,
        "disclaimer":              "This is educational research only. Not financial advice.",
    }
