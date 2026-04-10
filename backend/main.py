import os
import json
import time
import requests
import anthropic
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timezone
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

load_dotenv()

app = FastAPI(title="AI Trading Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
NEWS_API_KEY        = os.getenv("NEWS_API_KEY")
ETHERSCAN_API_KEY   = os.getenv("ETHERSCAN_API_KEY", "")
WHALE_ALERT_API_KEY = os.getenv("WHALE_ALERT_API_KEY", "")

COINGECKO_BASE   = "https://api.coingecko.com/api/v3"
NEWSAPI_BASE     = "https://newsapi.org/v2"
ETHERSCAN_BASE   = "https://api.etherscan.io/api"
BLOCKCHAIN_INFO  = "https://blockchain.info"
WHALE_ALERT_BASE = "https://api.whale-alert.io/v1"

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
    whale_data: dict = {}


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
    whale_sentiment_analysis: str = ""
    disclaimer: str


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}


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


@app.get("/technicals/{ticker}")
def get_technicals(ticker: str):
    """
    Fetch 90 days of daily close+volume from CoinGecko market_chart and compute:
    MACD, RSI, SMA20, SMA50, Bollinger Bands, volume analysis,
    support (30-day low close), and resistance (30-day high close).
    """
    coin_id = resolve_coin_id(ticker)

    # market_chart with interval=daily reliably returns ~91 daily data points on the free tier.
    # The /ohlc endpoint returns 4-h candles on the free tier for long ranges (too few for SMA50).
    try:
        chart_resp = requests.get(
            f"{COINGECKO_BASE}/coins/{coin_id}/market_chart",
            params={"vs_currency": "usd", "days": 90, "interval": "daily"},
            timeout=15,
        )
        chart_resp.raise_for_status()
    except requests.RequestException as e:
        raise HTTPException(status_code=502, detail=f"CoinGecko request failed: {str(e)}")

    chart = chart_resp.json()
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

    # --- Indicators ---
    # pandas-ta macd() column order: MACD_12_26_9, MACDh_12_26_9, MACDs_12_26_9
    #   iloc[:,0] = MACD line, iloc[:,1] = histogram, iloc[:,2] = signal
    macd_df = ta.macd(df["close"], fast=12, slow=26, signal=9)
    df["macd"]        = macd_df.iloc[:, 0]
    df["macd_hist"]   = macd_df.iloc[:, 1]
    df["macd_signal"] = macd_df.iloc[:, 2]

    df["rsi"]   = ta.rsi(df["close"], length=14)
    df["sma20"] = ta.sma(df["close"], length=20)
    df["sma50"] = ta.sma(df["close"], length=50)

    bb_df = ta.bbands(df["close"], length=20, std=2)
    # bbands columns: BBL (lower), BBM (middle), BBU (upper), BBB (bandwidth), BBP (percent)
    df["bb_lower"] = bb_df.iloc[:, 0]
    df["bb_mid"]   = bb_df.iloc[:, 1]
    df["bb_upper"] = bb_df.iloc[:, 2]

    last = df.iloc[-1]
    current_price  = float(last["close"])
    current_volume = float(last["volume"])
    avg_volume     = float(df["volume"].tail(30).mean())

    # Support/resistance from 30-day close range (no high/low available from market_chart)
    support    = float(df["close"].tail(30).min())
    resistance = float(df["close"].tail(30).max())

    # --- Interpretations ---
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

    macd_val = r2(last["macd"])
    signal_val = r2(last["macd_signal"])
    hist_val = r2(last["macd_hist"])
    if macd_val is not None and signal_val is not None:
        if macd_val > signal_val:
            macd_interp = f"MACD ({macd_val}) is above signal ({signal_val}) — bullish momentum"
        else:
            macd_interp = f"MACD ({macd_val}) is below signal ({signal_val}) — bearish momentum"
    else:
        macd_interp = "MACD unavailable"

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

    bb_upper = r2(last["bb_upper"])
    bb_lower = r2(last["bb_lower"])
    bb_mid = r2(last["bb_mid"])
    if bb_upper and bb_lower:
        bb_width_pct = r2(((bb_upper - bb_lower) / bb_mid) * 100) if bb_mid else None
        if current_price >= bb_upper:
            bb_interp = f"Price touching upper Bollinger Band (${bb_upper:,.2f}) — possible overbought or strong breakout"
        elif current_price <= bb_lower:
            bb_interp = f"Price touching lower Bollinger Band (${bb_lower:,.2f}) — possible oversold or breakdown"
        else:
            bb_interp = f"Price within Bollinger Bands (${bb_lower:,.2f}–${bb_upper:,.2f}), band width {bb_width_pct}%"
    else:
        bb_interp = "Bollinger Bands unavailable"

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

    support_pct = r2(((current_price - support) / support) * 100) if support else None
    resistance_pct = r2(((resistance - current_price) / current_price) * 100) if resistance else None
    support_interp = f"Support at ${support:,.2f} ({support_pct}% below current price)" if support_pct is not None else "Support unavailable"
    resistance_interp = f"Resistance at ${resistance:,.2f} ({resistance_pct}% above current price)" if resistance_pct is not None else "Resistance unavailable"

    return {
        "ticker": ticker.upper(),
        "current_price": r2(current_price),
        "indicators": {
            "rsi": {
                "value": rsi_val,
                "interpretation": rsi_interp,
            },
            "macd": {
                "macd": macd_val,
                "signal": signal_val,
                "histogram": hist_val,
                "interpretation": macd_interp,
            },
            "sma": {
                "sma20": sma20_val,
                "sma50": sma50_val,
                "interpretation": sma_interp,
            },
            "bollinger_bands": {
                "upper": bb_upper,
                "middle": bb_mid,
                "lower": bb_lower,
                "interpretation": bb_interp,
            },
            "volume": {
                "current": r2(current_volume),
                "avg_30d": r2(avg_volume),
                "ratio_vs_avg": vol_ratio,
                "interpretation": vol_interp,
            },
            "support_resistance": {
                "support": r2(support),
                "resistance": r2(resistance),
                "support_interpretation": support_interp,
                "resistance_interpretation": resistance_interp,
            },
        },
    }


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    """Send price data, technicals, and news to Claude for structured research analysis."""
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "your_anthropic_api_key_here":
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured")

    headlines_block = "\n".join(f"- {h}" for h in req.headlines) if req.headlines else "No headlines provided."

    price = req.price_data

    def _fmt(v):
        if v is None:
            return "N/A"
        if isinstance(v, (int, float)):
            return f"${v:,.2f}"
        return str(v)

    price_block = (
        f"Current price: {_fmt(price.get('price_usd'))}\n"
        f"24h change:    {price.get('change_24h_pct', 'N/A')}%\n"
        f"Market cap:    {_fmt(price.get('market_cap_usd'))}\n"
        f"24h volume:    {_fmt(price.get('volume_24h_usd'))}"
    )

    tech = req.technical_data.get("indicators", req.technical_data)

    def fmt_tech(data: dict) -> str:
        lines = []
        for key, val in data.items():
            if isinstance(val, dict):
                interp = val.get("interpretation", "")
                numeric = {k: v for k, v in val.items() if k != "interpretation"}
                lines.append(f"{key.upper()}: {numeric} — {interp}")
            else:
                lines.append(f"{key}: {val}")
        return "\n".join(lines)

    tech_block = fmt_tech(tech)

    # Build whale block
    w = req.whale_data
    if w:
        directions = [t.get("direction", "") for t in w.get("large_transactions", [])[:5]]
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

    prompt = f"""Analyze the following data for {req.ticker.upper()} and respond with a JSON object only — no markdown, no extra text.

## Price Data
{price_block}

## Technical Indicators
{tech_block}

## Recent News Headlines
{headlines_block}

## Whale & Smart Money Activity
{whale_block}

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
  "disclaimer": "This is educational research only. Not financial advice."
}}

Rules:
- overall_sentiment and news_sentiment must each be exactly one of: bullish, bearish, neutral
- confidence_score is an integer from 1 (very uncertain) to 10 (very certain)
- key_opportunities and key_risks must each have exactly 4-5 items
- technical_summary must be exactly 2 paragraphs interpreting all indicators together
- research_summary must be exactly 3 paragraphs combining technical analysis, news, and whale activity
- whale_sentiment_analysis must be one paragraph explaining whether whale behavior supports or contradicts the technical indicators
- disclaimer must be exactly: "This is educational research only. Not financial advice."
"""

    system_prompt = (
        "You are a professional crypto market analyst. "
        "Analyze the provided price data, technical indicators, recent news, and whale/smart money activity "
        "to give a comprehensive research report. "
        "Never give direct buy or sell advice. Always frame analysis as educational research."
    )

    try:
        client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
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

    # Strip accidental markdown fences
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
        raw = raw.strip()

    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(status_code=500, detail=f"Claude returned non-JSON response: {raw[:200]}")

    required = {
        "overall_sentiment", "confidence_score", "technical_summary",
        "support_resistance_analysis", "macd_analysis", "volume_analysis",
        "news_sentiment", "key_opportunities", "key_risks",
        "research_summary", "whale_sentiment_analysis", "disclaimer",
    }
    missing = required - parsed.keys()
    if missing:
        raise HTTPException(status_code=500, detail=f"Claude response missing fields: {missing}")

    for field in ("overall_sentiment", "news_sentiment"):
        if parsed[field] not in ("bullish", "bearish", "neutral"):
            parsed[field] = "neutral"

    parsed["confidence_score"] = max(1, min(10, int(parsed["confidence_score"])))
    parsed["disclaimer"] = "This is educational research only. Not financial advice."

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
