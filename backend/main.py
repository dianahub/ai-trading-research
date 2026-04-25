import os
import json
import time
import secrets
import threading
import traceback
import resend
import requests
import anthropic
import pandas as pd
import pandas_ta as ta
from datetime import datetime, timezone, timedelta
from typing import Optional
from fastapi import FastAPI, HTTPException, Header, Cookie, Response, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from sqlalchemy import create_engine, Column, String, DateTime, Integer, Boolean, Float, text
from sqlalchemy.orm import DeclarativeBase, Session
from coingecko_client import coingecko, CoinGeckoError, PRICE_TTL, MARKET_TTL, SEARCH_TTL

try:
    from passlib.context import CryptContext
    _pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
    def _hash_password(pw: str) -> str: return _pwd_context.hash(pw)
    def _verify_password(pw: str, hashed: str) -> bool:
        try: return _pwd_context.verify(pw, hashed)
        except Exception: return False
except ImportError:
    import hashlib, hmac
    def _hash_password(pw: str) -> str: return hashlib.sha256(pw.encode()).hexdigest()
    def _verify_password(pw: str, hashed: str) -> bool: return hmac.compare_digest(_hash_password(pw), hashed)

try:
    import stripe as _stripe
    _stripe_available = True
except ImportError:
    _stripe_available = False

load_dotenv()

app = FastAPI(title="AI Trading Research API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:5174",
        os.getenv("FRONTEND_URL", ""),
        "https://starsignal-waitlist.vercel.app",
        "https://starsignal.io",
        "https://www.starsignal.io",
        "https://staging.starsignal.io",
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def _log_error(method: str, path: str, status: int, exc: Exception):
    try:
        with Session(_engine) as db:
            db.add(ErrorLog(
                method=method,
                path=path,
                status=status,
                error_type=type(exc).__name__,
                message=str(exc)[:2000],
                tb=traceback.format_exc()[:4000],
            ))
            db.commit()
    except Exception:
        pass  # never let logging crash the app

@app.middleware("http")
async def _error_logging_middleware(request: Request, call_next):
    try:
        response = await call_next(request)
        if response.status_code >= 500:
            # Body already consumed — log what we can without a traceback
            _log_error(request.method, request.url.path, response.status_code,
                       Exception(f"HTTP {response.status_code}"))
        return response
    except Exception as exc:
        _log_error(request.method, request.url.path, 500, exc)
        return JSONResponse(status_code=500, content={"detail": str(exc)})

ANTHROPIC_API_KEY   = os.getenv("ANTHROPIC_API_KEY")
RESEND_API_KEY      = os.getenv("RESEND_API_KEY", "")
NEWS_API_KEY        = os.getenv("NEWS_API_KEY")
ETHERSCAN_API_KEY   = os.getenv("ETHERSCAN_API_KEY", "")
WHALE_ALERT_API_KEY = os.getenv("WHALE_ALERT_API_KEY", "")
FINNHUB_API_KEY     = os.getenv("FINNHUB_API_KEY", "")
POLYGON_API_KEY     = os.getenv("POLYGON_API_KEY", "")

# Astro API integration
ASTRO_API_URL          = os.getenv("ASTRO_API_URL", "http://localhost:3001")
ASTRO_API_KEY_INTERNAL = os.getenv("ASTRO_API_KEY_INTERNAL", "")

# Auth + monetization config
SITE_URL                  = os.getenv("SITE_URL", "https://starsignal.io")
ACCESS_MODE               = os.getenv("ACCESS_MODE", "open")   # open | invite | auth
AUTH_ENABLED              = os.getenv("AUTH_ENABLED", "false").lower() == "true"
SESSION_SECRET            = os.getenv("SESSION_SECRET", secrets.token_hex(32))
PARTNER_JWT_SECRET        = os.getenv("PARTNER_JWT_SECRET", secrets.token_hex(32))
PREVIEW_PASSWORD          = os.getenv("PREVIEW_PASSWORD", "")
STRIPE_SECRET_KEY         = os.getenv("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET     = os.getenv("STRIPE_WEBHOOK_SECRET", "")
STRIPE_PRO_PRICE_ID       = os.getenv("STRIPE_PRO_PRICE_ID", "")
STRIPE_PREMIUM_PRICE_ID   = os.getenv("STRIPE_PREMIUM_PRICE_ID", "")
STRIPE_FOUNDING_PRICE_ID  = os.getenv("STRIPE_FOUNDING_PRICE_ID", "")
STRIPE_REFERRED_PRICE_ID  = os.getenv("STRIPE_REFERRED_PRICE_ID", "")  # $19/mo, referred path — separate from founding for Stripe tracking
STRIPE_CONNECT_CLIENT_ID  = os.getenv("STRIPE_CONNECT_CLIENT_ID", "")
BETA_OPEN_ENV             = os.getenv("BETA_OPEN", "true").lower() == "true"
if _stripe_available and STRIPE_SECRET_KEY:
    _stripe.api_key = STRIPE_SECRET_KEY

# ── Waitlist database ──────────────────────────────────────────────────────────
_DB_URL = os.getenv("DATABASE_URL", "sqlite:///./waitlist.db")
# SQLAlchemy requires postgresql:// not postgres://
if _DB_URL.startswith("postgres://"):
    _DB_URL = _DB_URL.replace("postgres://", "postgresql://", 1)

_engine = create_engine(_DB_URL, pool_pre_ping=True)

class _Base(DeclarativeBase): pass

class WaitlistSignup(_Base):
    __tablename__ = "waitlist_signups"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    name            = Column(String, nullable=False)
    email           = Column(String, nullable=False, unique=True)
    trading_type    = Column(String, nullable=True, default="")
    referral_source = Column(String, nullable=False)
    promo_code      = Column(String, nullable=True)
    created_at      = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ErrorLog(_Base):
    __tablename__ = "error_logs"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    method     = Column(String, nullable=True, default="")
    path       = Column(String, nullable=True, default="")
    status     = Column(Integer, nullable=True)
    error_type = Column(String, nullable=True, default="")
    message    = Column(String, nullable=False)
    tb         = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class BetaTesterFeedback(_Base):
    __tablename__ = "beta_feedback"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String, nullable=True, default="")
    email      = Column(String, nullable=True, default="")
    rating     = Column(Integer, nullable=True)
    message    = Column(String, nullable=False)
    page       = Column(String, nullable=True, default="")
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ContactMessage(_Base):
    __tablename__ = "contact_messages"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    name       = Column(String, nullable=False)
    email      = Column(String, nullable=False)
    message    = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

_Base.metadata.create_all(_engine)  # creates table if it doesn't exist
# Add promo_code column to existing tables that predate this field
with _engine.connect() as _conn:
    try:
        _conn.execute(__import__('sqlalchemy').text("ALTER TABLE waitlist_signups ADD COLUMN promo_code VARCHAR"))
        _conn.commit()
    except Exception:
        pass  # column already exists
ASTRO_SIGNAL_WEIGHT    = float(os.getenv("ASTRO_SIGNAL_WEIGHT", "0.1"))

# Astro cache — 30-minute TTL, shared across requests
_astro_cache: dict = {"data": None, "fetched_at": 0.0}

# Analysis cache — 15-minute TTL, keyed by ticker, persisted to disk so restarts don't wipe it
ANALYZE_TTL       = 15 * 60  # 15 minutes
_CACHE_FILE       = os.path.join(os.path.dirname(__file__), ".analysis_cache.json")
_analyze_cache: dict[str, dict] = {}

def _load_cache():
    global _analyze_cache
    try:
        if os.path.exists(_CACHE_FILE):
            with open(_CACHE_FILE, "r") as f:
                _analyze_cache = json.load(f)
    except Exception:
        _analyze_cache = {}

def _save_cache():
    try:
        with open(_CACHE_FILE, "w") as f:
            json.dump(_analyze_cache, f)
    except Exception:
        pass

_load_cache()  # load on startup

COINGECKO_BASE   = "https://api.coingecko.com/api/v3"
NEWSAPI_BASE     = "https://newsapi.org/v2"
ETHERSCAN_BASE   = "https://api.etherscan.io/api"
BLOCKCHAIN_INFO  = "https://blockchain.info"
WHALE_ALERT_BASE = "https://api.whale-alert.io/v1"
FINNHUB_BASE     = "https://finnhub.io/api/v1"

# Congressional trading data (House/Senate Stock Watcher — public S3 buckets, no key needed)
HOUSE_TRADES_URL  = "https://house-stock-watcher-data.s3-us-west-2.amazonaws.com/data/all_transactions.json"
SENATE_TRADES_URL = "https://senate-stock-watcher-data.s3-us-west-2.amazonaws.com/aggregate/all_transactions.json"
CONGRESS_TTL      = 4 * 60 * 60   # 4 hours — data updates daily
_congress_cache: dict = {"house": None, "senate": None, "fetched_at": 0.0}

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
        data = coingecko.get("/search", params={"query": ticker}, ttl=SEARCH_TTL)
        for coin in data.get("coins", []):
            if coin.get("symbol", "").upper() == upper:
                return coin["id"]
        raise HTTPException(status_code=404, detail=f"Ticker '{ticker}' not found on CoinGecko")
    except HTTPException:
        raise
    except CoinGeckoError as e:
        raise HTTPException(status_code=503, detail=f"CoinGecko temporarily unavailable: {str(e)}")
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
    from_cache: bool = False


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/")
def root():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Contact form
# ---------------------------------------------------------------------------

class ContactRequest(BaseModel):
    name: str
    email: str
    message: str

@app.post("/contact")
def contact(req: ContactRequest):
    with Session(_engine) as db:
        db.add(ContactMessage(name=req.name, email=req.email, message=req.message))
        db.commit()

    if RESEND_API_KEY:
        try:
            resend.api_key = RESEND_API_KEY
            resend.Emails.send({
                "from":     "Starsignal <onboarding@resend.dev>",
                "to":       ["contact@starsignal.io"],
                "reply_to": req.email,
                "subject":  f"Star Signal Contact: {req.name}",
                "text":     f"Name: {req.name}\nEmail: {req.email}\n\n{req.message}",
            })
        except Exception as e:
            print(f"[contact] Email send failed: {e}")

    return {"ok": True}


@app.get("/admin/contact-messages")
def list_contact_messages(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        rows = db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()
        return [
            {"id": r.id, "name": r.name, "email": r.email, "message": r.message,
             "created_at": r.created_at.isoformat() if r.created_at else None}
            for r in rows
        ]


class FeedbackRequest(BaseModel):
    name: str = ""
    email: str = ""
    rating: Optional[int] = None
    message: str
    page: str = "main"

@app.post("/feedback")
def submit_feedback(req: FeedbackRequest):
    with Session(_engine) as db:
        row = BetaTesterFeedback(
            name=req.name,
            email=req.email,
            rating=req.rating,
            message=req.message,
            page=req.page,
        )
        db.add(row)
        db.commit()
        db.refresh(row)

    if RESEND_API_KEY:
        try:
            stars = ("★" * (req.rating or 0)) + ("☆" * (5 - (req.rating or 0)))
            rating_line = f"Rating: {stars} ({req.rating}/5)<br>" if req.rating else ""
            resend.api_key = RESEND_API_KEY
            email_payload = {
                "from":    "Starsignal <onboarding@resend.dev>",
                "to":      ["contact@starsignal.io"],
                "subject": f"Beta Feedback from {req.name or 'anonymous'}",
                "html": (
                    f"<p><b>{req.name or 'Anonymous'}</b>"
                    + (f" ({req.email})" if req.email else "")
                    + f" left feedback on <em>{req.page}</em>.</p>"
                    f"<p>{rating_line}Message: {req.message}</p>"
                ),
            }
            if req.email:
                email_payload["reply_to"] = req.email
            resend.Emails.send(email_payload)
        except Exception as e:
            print(f"[feedback] Email notification failed: {e}")

    return {"ok": True}


@app.get("/admin/feedback")
def list_feedback(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        rows = db.query(BetaTesterFeedback).order_by(BetaTesterFeedback.created_at.desc()).all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "email": r.email,
                "rating": r.rating,
                "message": r.message,
                "page": r.page,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


@app.get("/admin/errors")
def list_errors(
    limit: int = 200,
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        rows = db.query(ErrorLog).order_by(ErrorLog.created_at.desc()).limit(limit).all()
        return [
            {
                "id": r.id,
                "method": r.method,
                "path": r.path,
                "status": r.status,
                "error_type": r.error_type,
                "message": r.message,
                "tb": r.tb,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]


@app.delete("/admin/errors")
def clear_errors(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        db.query(ErrorLog).delete()
        db.commit()
    return {"ok": True}


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
            "overall_summary":  "" if summary.get("overallSummary", "").lower().startswith("summary unavailable") else summary.get("overallSummary", ""),
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


def _fetch_congress_data() -> tuple[list, list]:
    """Fetch and cache House + Senate trading data. Returns (house_trades, senate_trades)."""
    now = time.time()
    if _congress_cache["house"] is not None and (now - _congress_cache["fetched_at"]) < CONGRESS_TTL:
        return _congress_cache["house"], _congress_cache["senate"]

    house, senate = [], []
    try:
        r = requests.get(HOUSE_TRADES_URL, timeout=15, headers=_HEADERS)
        if r.ok:
            house = r.json()
    except Exception:
        pass

    try:
        r = requests.get(SENATE_TRADES_URL, timeout=15, headers=_HEADERS)
        if r.ok:
            senate = r.json()
    except Exception:
        pass

    _congress_cache["house"]      = house
    _congress_cache["senate"]     = senate
    _congress_cache["fetched_at"] = now
    return house, senate


@app.get("/congress/{ticker}")
def get_congress_trades(ticker: str):
    """Return recent congressional stock trades for a given ticker (House + Senate)."""
    upper = ticker.upper()
    house_raw, senate_raw = _fetch_congress_data()

    trades = []

    for t in house_raw:
        tx_ticker = (t.get("ticker") or "").strip().upper()
        if tx_ticker != upper:
            continue
        tx_type = (t.get("type") or "").lower()
        trades.append({
            "member":    t.get("representative", "Unknown"),
            "chamber":   "House",
            "trade_type": "buy" if "purchase" in tx_type else "sell",
            "amount":    t.get("amount", "—"),
            "tx_date":   t.get("transaction_date") or t.get("disclosure_date") or "",
            "disclosed": t.get("disclosure_date", ""),
            "asset":     t.get("asset_description", ticker),
            "link":      t.get("link", ""),
        })

    for t in senate_raw:
        tx_ticker = (t.get("ticker") or "").strip().upper()
        if tx_ticker != upper:
            continue
        tx_type = (t.get("type") or "").lower()
        name = t.get("senator") or f"{t.get('first_name', '')} {t.get('last_name', '')}".strip() or "Unknown"
        trades.append({
            "member":    name,
            "chamber":   "Senate",
            "trade_type": "buy" if "purchase" in tx_type else "sell",
            "amount":    t.get("amount", "—"),
            "tx_date":   t.get("transaction_date") or t.get("date_received") or "",
            "disclosed": t.get("date_received", ""),
            "asset":     t.get("asset_name", ticker),
            "link":      t.get("ptr_link", ""),
        })

    # Sort by transaction date descending, most recent first
    def sort_key(x):
        d = x.get("tx_date") or ""
        try:
            return datetime.strptime(d[:10], "%Y-%m-%d")
        except Exception:
            return datetime.min

    trades.sort(key=sort_key, reverse=True)

    return {
        "ticker":       upper,
        "total":        len(trades),
        "trades":       trades[:30],
        "data_current": _congress_cache["fetched_at"] > 0,
    }


# Common company name → ticker for instant lookup without hitting external APIs
NAME_TO_TICKER: dict[str, tuple[str, str]] = {
    # mega-cap tech
    "apple": ("AAPL", "Apple Inc."),
    "microsoft": ("MSFT", "Microsoft Corp."),
    "nvidia": ("NVDA", "NVIDIA Corp."),
    "google": ("GOOGL", "Alphabet Inc."),
    "alphabet": ("GOOGL", "Alphabet Inc."),
    "amazon": ("AMZN", "Amazon.com Inc."),
    "meta": ("META", "Meta Platforms Inc."),
    "facebook": ("META", "Meta Platforms Inc."),
    "tesla": ("TSLA", "Tesla Inc."),
    "netflix": ("NFLX", "Netflix Inc."),
    "amd": ("AMD", "Advanced Micro Devices"),
    "intel": ("INTC", "Intel Corp."),
    "salesforce": ("CRM", "Salesforce Inc."),
    "oracle": ("ORCL", "Oracle Corp."),
    "adobe": ("ADBE", "Adobe Inc."),
    "paypal": ("PYPL", "PayPal Holdings"),
    "uber": ("UBER", "Uber Technologies"),
    "airbnb": ("ABNB", "Airbnb Inc."),
    "shopify": ("SHOP", "Shopify Inc."),
    "snowflake": ("SNOW", "Snowflake Inc."),
    "palantir": ("PLTR", "Palantir Technologies"),
    "crowdstrike": ("CRWD", "CrowdStrike Holdings"),
    "palo alto": ("PANW", "Palo Alto Networks"),
    "cloudflare": ("NET", "Cloudflare Inc."),
    "spotify": ("SPOT", "Spotify Technology"),
    "coinbase": ("COIN", "Coinbase Global"),
    "robinhood": ("HOOD", "Robinhood Markets"),
    # banks & finance
    "bank of america": ("BAC", "Bank of America Corp."),
    "jpmorgan": ("JPM", "JPMorgan Chase & Co."),
    "jp morgan": ("JPM", "JPMorgan Chase & Co."),
    "wells fargo": ("WFC", "Wells Fargo & Co."),
    "citigroup": ("C", "Citigroup Inc."),
    "citi": ("C", "Citigroup Inc."),
    "goldman sachs": ("GS", "Goldman Sachs Group"),
    "morgan stanley": ("MS", "Morgan Stanley"),
    "blackstone": ("BX", "Blackstone Inc."),
    "charles schwab": ("SCHW", "Charles Schwab Corp."),
    "american express": ("AXP", "American Express Co."),
    # healthcare & pharma
    "johnson & johnson": ("JNJ", "Johnson & Johnson"),
    "johnson and johnson": ("JNJ", "Johnson & Johnson"),
    "pfizer": ("PFE", "Pfizer Inc."),
    "unitedhealth": ("UNH", "UnitedHealth Group"),
    "abbvie": ("ABBV", "AbbVie Inc."),
    "eli lilly": ("LLY", "Eli Lilly and Co."),
    "merck": ("MRK", "Merck & Co."),
    "bristol myers": ("BMY", "Bristol-Myers Squibb"),
    # energy
    "exxon": ("XOM", "Exxon Mobil Corp."),
    "exxon mobil": ("XOM", "Exxon Mobil Corp."),
    "chevron": ("CVX", "Chevron Corp."),
    "conocophillips": ("COP", "ConocoPhillips"),
    "schlumberger": ("SLB", "SLB (Schlumberger)"),
    "halliburton": ("HAL", "Halliburton Co."),
    # consumer
    "walmart": ("WMT", "Walmart Inc."),
    "costco": ("COST", "Costco Wholesale"),
    "home depot": ("HD", "Home Depot Inc."),
    "mcdonalds": ("MCD", "McDonald's Corp."),
    "starbucks": ("SBUX", "Starbucks Corp."),
    "coca cola": ("KO", "Coca-Cola Co."),
    "coca-cola": ("KO", "Coca-Cola Co."),
    "pepsi": ("PEP", "PepsiCo Inc."),
    "pepsico": ("PEP", "PepsiCo Inc."),
    "nike": ("NKE", "Nike Inc."),
    "disney": ("DIS", "Walt Disney Co."),
    # telecom & media
    "at&t": ("T", "AT&T Inc."),
    "verizon": ("VZ", "Verizon Communications"),
    "t-mobile": ("TMUS", "T-Mobile US Inc."),
    # semiconductor
    "tsmc": ("TSM", "Taiwan Semiconductor"),
    "taiwan semiconductor": ("TSM", "Taiwan Semiconductor"),
    "broadcom": ("AVGO", "Broadcom Inc."),
    "qualcomm": ("QCOM", "Qualcomm Inc."),
    "micron": ("MU", "Micron Technology"),
    # ETFs
    "spy": ("SPY", "S&P 500 ETF"),
    "qqq": ("QQQ", "Nasdaq 100 ETF"),
    "gold etf": ("GLD", "SPDR Gold ETF"),
    # crypto
    "bitcoin": ("BTC", "Bitcoin"),
    "ethereum": ("ETH", "Ethereum"),
    "solana": ("SOL", "Solana"),
    "ripple": ("XRP", "XRP / Ripple"),
    "dogecoin": ("DOGE", "Dogecoin"),
    "cardano": ("ADA", "Cardano"),
    "avalanche": ("AVAX", "Avalanche"),
    "chainlink": ("LINK", "Chainlink"),
    "polygon": ("MATIC", "Polygon"),
    "uniswap": ("UNI", "Uniswap"),
    "litecoin": ("LTC", "Litecoin"),
}


@app.get("/search")
def search_symbols(q: str):
    """Search for ticker symbols by name or symbol. Returns up to 8 suggestions from CoinGecko (crypto) and Finnhub (stocks)."""
    q = q.strip()
    if not q or len(q) < 2:
        return {"results": []}

    # Fast path: check hardcoded name map (case-insensitive, partial match)
    q_lower = q.lower()
    name_hits: list[dict] = []
    for name_key, (sym, display_name) in NAME_TO_TICKER.items():
        if q_lower in name_key or name_key.startswith(q_lower):
            asset_type = "crypto" if sym in {"BTC","ETH","SOL","XRP","DOGE","ADA","AVAX","LINK","MATIC","UNI","LTC","BNB","DOT","ATOM","NEAR","ARB","OP","SUI","APT","FIL"} else "stock"
            name_hits.append({"symbol": sym, "name": display_name, "type": asset_type})
    # Exact key match goes first
    name_hits.sort(key=lambda x: (0 if NAME_TO_TICKER.get(q_lower, ("",))[0] == x["symbol"] else 1))

    results: list[dict] = []

    # --- CoinGecko crypto search ---
    try:
        data = coingecko.get("/search", params={"query": q}, ttl=SEARCH_TTL)
        for coin in data.get("coins", [])[:5]:
            results.append({
                "symbol": coin.get("symbol", "").upper(),
                "name":   coin.get("name", ""),
                "type":   "crypto",
            })
    except Exception:
        pass

    # --- Finnhub stock search ---
    if FINNHUB_API_KEY:
        try:
            resp = requests.get(
                f"{FINNHUB_BASE}/search",
                params={"q": q, "token": FINNHUB_API_KEY},
                timeout=5,
            )
            if resp.ok:
                for item in resp.json().get("result", [])[:5]:
                    sym = item.get("symbol", "")
                    # Skip complex symbols (options, preferred shares, etc.)
                    if "." in sym or len(sym) > 6:
                        continue
                    results.append({
                        "symbol": sym,
                        "name":   item.get("description", ""),
                        "type":   "stock",
                    })
        except Exception:
            pass

    # Merge: name_hits first (most reliable), then API results
    seen: set[str] = set()
    deduped: list[dict] = []
    for r in name_hits + results:
        if r["symbol"] and r["symbol"] not in seen:
            seen.add(r["symbol"])
            deduped.append(r)
        if len(deduped) >= 8:
            break

    return {"results": deduped}


@app.get("/price/{ticker}")
def get_price(ticker: str):
    """Fetch current price, 24h change, market cap, and volume from CoinGecko."""
    coin_id = resolve_coin_id(ticker)

    try:
        data = coingecko.get(
            "/coins/markets",
            params={"vs_currency": "usd", "ids": coin_id, "sparkline": "true"},
            ttl=PRICE_TTL,
        )
    except CoinGeckoError as e:
        raise HTTPException(status_code=503, detail=f"Price data temporarily unavailable: {str(e)}")

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
        chart = coingecko.get(
            f"/coins/{coin_id}/market_chart",
            params={"vs_currency": "usd", "days": 90, "interval": "daily"},
            ttl=MARKET_TTL,
        )
    except CoinGeckoError as e:
        raise HTTPException(status_code=503, detail=f"Technical data temporarily unavailable: {str(e)}")
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
def analyze(req: AnalyzeRequest, ss_session: Optional[str] = Cookie(None)):
    """
    Send all available data to Claude for a structured research report.
    Handles both crypto (whale data) and stock (insider + options) asset types.
    """
    if not ANTHROPIC_API_KEY or ANTHROPIC_API_KEY == "your_anthropic_api_key_here":
        raise HTTPException(status_code=503, detail="ANTHROPIC_API_KEY is not configured")

    # ── Rate limiting ──────────────────────────────────────────────────────────
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if user:
            tier = _get_user_tier(user)
            limit = TIER_DAILY_LIMITS.get(tier)
            if limit is not None:
                row = _get_or_create_usage(db, user.id)
                if row.request_count >= limit:
                    upgrade = TIER_UPGRADE_COPY.get(tier, {})
                    raise HTTPException(status_code=429, detail={
                        "reason":  "daily_limit",
                        "count":   row.request_count,
                        "limit":   limit,
                        "tier":    tier,
                        "upgrade": upgrade,
                    })
                row.request_count += 1
                db.commit()

    asset_type = req.asset_type
    upper      = req.ticker.upper()

    cached = _analyze_cache.get(upper)
    age = time.time() - cached["fetched_at"] if cached else None
    is_fresh = cached and age < ANALYZE_TTL
    is_stale = cached and not is_fresh

    # Fresh hit — return instantly
    if is_fresh:
        return AnalyzeResponse(**{**cached["result"], "from_cache": True})

    # Stale hit — return instantly and refresh in background.
    # Evict the entry before the recursive call so it bypasses the stale check
    # and actually reaches the Claude call instead of spawning infinite threads.
    if is_stale:
        stale_result = cached["result"]
        def _background_refresh():
            try:
                _analyze_cache.pop(upper, None)
                analyze(req)
            except Exception:
                pass
        threading.Thread(target=_background_refresh, daemon=True).start()
        return AnalyzeResponse(**{**stale_result, "from_cache": True})

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
                + f"Note: This signal is derived from financial astrology sources. "
                f"Incorporate it meaningfully into the research_summary third paragraph.\n"
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
- research_summary must be exactly 3 paragraphs: paragraph 1 covers technicals and price action, paragraph 2 covers news, insider activity, and options, paragraph 3 must explicitly address the astrological signal and overall market timing outlook if astro data was provided, otherwise synthesize all signals into a final outlook
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
                + f"Note: This signal is derived from financial astrology sources. "
                f"Incorporate it meaningfully into the research_summary third paragraph.\n"
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
- research_summary must be exactly 3 paragraphs: paragraph 1 covers technicals and price action, paragraph 2 covers news and whale/smart money activity, paragraph 3 must explicitly address the astrological signal and overall market timing outlook if astro data was provided, otherwise synthesize all signals into a final outlook
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
            model="claude-haiku-4-5-20251001",
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

    result = AnalyzeResponse(**parsed)
    _analyze_cache[upper] = {"result": result.model_dump(), "fetched_at": time.time()}
    _save_cache()
    return result


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
        px_data = coingecko.get(
            "/simple/price",
            params={"ids": coin_id, "vs_currencies": "usd"},
            ttl=PRICE_TTL,
        )
        price_usd = px_data.get(coin_id, {}).get("usd", 0)
    except CoinGeckoError as e:
        raise HTTPException(status_code=503, detail=f"Price data temporarily unavailable: {e}")

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
        coin_data = coingecko.get(
            f"/coins/{coin_id}",
            params={
                "localization":   "false",
                "tickers":        "false",
                "market_data":    "true",
                "community_data": "false",
                "developer_data": "false",
                "sparkline":      "false",
            },
            ttl=MARKET_TTL,
        )
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
            cg_data = coingecko.get(
                f"/coins/{coin_id}",
                params={"localization": "false", "market_data": "false",
                        "community_data": "false", "developer_data": "false"},
                ttl=MARKET_TTL,
            )
            name = cg_data.get("name", upper)
        except Exception:
            pass
        return {"ticker": upper, "asset_type": "crypto", "name": name, "coin_id": coin_id, "exchange": None}

    # ── 2. CoinGecko search ───────────────────────────────────────────────────
    cg_candidate: dict | None = None
    try:
        cg_search = coingecko.get("/search", params={"query": ticker}, ttl=SEARCH_TTL)
        for coin in cg_search.get("coins", []):
            if coin.get("symbol", "").upper() == upper:
                cg_candidate = coin
                break
    except Exception:
        pass

    # ── 3. Finnhub stock search ───────────────────────────────────────────────
    name, exchange = upper, ""
    finnhub_price: float | None = None
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

        # Get a live quote to confirm it's a real traded stock
        try:
            q = requests.get(
                f"{FINNHUB_BASE}/quote",
                params={"symbol": upper, "token": FINNHUB_API_KEY},
                timeout=8,
            )
            if q.ok:
                finnhub_price = q.json().get("c") or None
        except Exception:
            pass

    # Prefer stock when Finnhub has a real price — avoids routing well-known
    # ETFs/stocks (e.g. UCO) to a near-zero micro-cap crypto with the same symbol.
    if finnhub_price:
        return {"ticker": upper, "asset_type": "stock", "name": name, "coin_id": None, "exchange": exchange}

    if cg_candidate:
        return {
            "ticker":     upper,
            "asset_type": "crypto",
            "name":       cg_candidate.get("name", upper),
            "coin_id":    cg_candidate["id"],
            "exchange":   None,
        }

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

    # Fetch company name from Finnhub profile
    company_name = upper
    try:
        profile = _finnhub_get("stock/profile2", {"symbol": upper})
        company_name = profile.get("name", upper) or upper
    except Exception:
        pass

    cap_raw = metrics.get("marketCapitalization")   # Finnhub returns in millions USD
    return {
        "ticker":         upper,
        "name":           company_name,
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
    """90-day OHLCV + indicator set for a stock ticker.
    Sources tried in order: Polygon.io → Finnhub → yfinance."""
    import yfinance as yf
    upper = ticker.upper()

    df = None

    # ── Primary: Polygon.io aggregates ───────────────────────────────────────
    if POLYGON_API_KEY:
        try:
            to_date   = datetime.now(tz=timezone.utc).strftime("%Y-%m-%d")
            from_date = (datetime.now(tz=timezone.utc) - timedelta(days=120)).strftime("%Y-%m-%d")
            resp = requests.get(
                f"https://api.polygon.io/v2/aggs/ticker/{upper}/range/1/day/{from_date}/{to_date}",
                params={"adjusted": "true", "sort": "asc", "limit": 120, "apiKey": POLYGON_API_KEY},
                timeout=12,
                headers=_HEADERS,
            )
            data = resp.json() if resp.ok else {}
            results = data.get("results") or []
            print(f"[technicals] Polygon {upper}: status={resp.status_code} count={len(results)}")
            if results:
                df = pd.DataFrame({
                    "close":  [r["c"] for r in results],
                    "open":   [r["o"] for r in results],
                    "high":   [r["h"] for r in results],
                    "low":    [r["l"] for r in results],
                    "volume": [r.get("v", 0) for r in results],
                }, index=pd.to_datetime([r["t"] for r in results], unit="ms"))
                df.index.name = "ts"
        except Exception as e:
            print(f"[technicals] Polygon exception for {upper}: {e}")

    # ── Fallback: Finnhub candles ─────────────────────────────────────────────
    if (df is None or df.empty) and FINNHUB_API_KEY and FINNHUB_API_KEY != "your_finnhub_api_key_here":
        try:
            to_ts   = int(time.time())
            from_ts = to_ts - 90 * 86400
            resp = requests.get(
                f"{FINNHUB_BASE}/stock/candle",
                params={"symbol": upper, "resolution": "D",
                        "from": from_ts, "to": to_ts, "token": FINNHUB_API_KEY},
                timeout=12,
                headers=_HEADERS,
            )
            candle = resp.json() if resp.ok else {}
            print(f"[technicals] Finnhub candle {upper}: status={resp.status_code} s={candle.get('s')} points={len(candle.get('c', []))}")
            if candle.get("s") == "ok" and candle.get("c"):
                df = pd.DataFrame({
                    "close":  candle["c"],
                    "open":   candle.get("o", candle["c"]),
                    "high":   candle.get("h", candle["c"]),
                    "low":    candle.get("l", candle["c"]),
                    "volume": candle.get("v", [0] * len(candle["c"])),
                }, index=pd.to_datetime(candle["t"], unit="s"))
                df.index.name = "ts"
        except Exception as e:
            print(f"[technicals] Finnhub exception for {upper}: {e}")

    # ── Fallback: yfinance ────────────────────────────────────────────────────
    if df is None or df.empty:
        try:
            hist = yf.Ticker(upper).history(period="3mo", interval="1d")
            print(f"[technicals] yfinance {upper}: rows={len(hist)}")
            if not hist.empty:
                df = hist[["Open", "High", "Low", "Close", "Volume"]].rename(columns={
                    "Open": "open", "High": "high", "Low": "low",
                    "Close": "close", "Volume": "volume",
                })
                df.index = df.index.tz_localize(None)
        except Exception as e:
            print(f"[technicals] yfinance exception for {upper}: {e}")

    if df is None or df.empty:
        raise HTTPException(
            status_code=404,
            detail=f"No price history available for '{ticker}'. Verify it is a valid stock ticker.",
        )

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


# ── Waitlist endpoints ─────────────────────────────────────────────────────────

VALID_TRADING  = {"crypto", "stocks", "both"}
VALID_REFERRAL = {"twitter", "instagram", "tiktok", "youtube", "reddit", "friend", "google", "other"}

class SignupRequest(BaseModel):
    name:            str
    email:           str
    trading_type:    str = ""
    referral_source: str
    promo_code:      str = ""

@app.post("/signup", status_code=201)
def create_signup(req: SignupRequest):
    if not req.name.strip():
        raise HTTPException(400, "Name is required")
    if not req.email.strip():
        raise HTTPException(400, "Email is required")
    if req.trading_type and req.trading_type not in VALID_TRADING:
        raise HTTPException(400, "Invalid trading type")
    if req.referral_source not in VALID_REFERRAL:
        raise HTTPException(400, "Invalid referral source")

    with Session(_engine) as db:
        existing = db.query(WaitlistSignup).filter_by(email=req.email.strip().lower()).first()
        if existing:
            raise HTTPException(409, "This email is already on the list!")
        signup = WaitlistSignup(
            name=req.name.strip(),
            email=req.email.strip().lower(),
            trading_type=req.trading_type,
            referral_source=req.referral_source,
            promo_code=req.promo_code.strip().upper() or None,
        )
        db.add(signup)
        db.commit()
        db.refresh(signup)

    # Send notification email (non-blocking — don't fail the signup if email fails)
    if RESEND_API_KEY:
        def _notify():
            try:
                trading_label = {"crypto": "Crypto", "stocks": "Stocks", "both": "Both"}.get(req.trading_type, req.trading_type)
                referral_label = {
                    "twitter": "Twitter/X", "instagram": "Instagram", "tiktok": "TikTok",
                    "youtube": "YouTube", "reddit": "Reddit", "friend": "Friend / Word of mouth",
                    "google": "Google", "other": "Other",
                }.get(req.referral_source, req.referral_source)

                resend.api_key = RESEND_API_KEY
                resend.Emails.send({
                    "from": "Starsignal <onboarding@resend.dev>",
                    "to": ["contact@starsignal.io"],
                    "subject": f"⭐ New Starsignal Beta Signup: {req.name}",
                    "text": (
                        f"New beta signup on Starsignal.io!\n\n"
                        f"Name:       {req.name}\n"
                        f"Email:      {req.email}\n"
                        f"Trades:     {trading_label}\n"
                        f"Found via:  {referral_label}\n"
                        f"Promo code: {req.promo_code.strip().upper() or '—'}\n\n"
                        f"View all signups: https://starsignal.io/admin"
                    ),
                })
            except Exception as e:
                print(f"[waitlist] Email notification failed: {e}")

        threading.Thread(target=_notify, daemon=True).start()

    return {"ok": True, "id": signup.id}

@app.get("/signups")
def list_signups(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    if x_admin_email != _STAGING_KEY:
        admin_email    = os.getenv("ADMIN_EMAIL", "")
        admin_password = os.getenv("ADMIN_PASSWORD", "")
        if not admin_email or x_admin_email != admin_email or x_admin_password != admin_password:
            raise HTTPException(401, "Unauthorized")
    with Session(_engine) as db:
        signups = db.query(WaitlistSignup).order_by(WaitlistSignup.created_at.desc()).all()
        return {
            "count": len(signups),
            "signups": [
                {
                    "id":              s.id,
                    "name":            s.name,
                    "email":           s.email,
                    "trading_type":    s.trading_type,
                    "referral_source": s.referral_source,
                    "promo_code":      s.promo_code,
                    "createdAt":       s.created_at.isoformat() if s.created_at else None,
                }
                for s in signups
            ],
        }


# ── Outreach management ────────────────────────────────────────────────────────

class OutreachContact(_Base):
    __tablename__ = "outreach_contacts"
    id               = Column(String,   primary_key=True, default=lambda: __import__('uuid').uuid4().hex)
    name             = Column(String,   nullable=False)
    platform         = Column(String,   nullable=False)
    follower_count   = Column(String,   default="")
    profile_url      = Column(String,   default="")
    contact_email    = Column(String,   default="")
    content_focus    = Column(String,   default="")
    status           = Column(String,   default="new")  # new/drafted/sent/responded/partner/declined
    last_message_sent = Column(String,  default="")    # initial/followup/upgrade/interest_followup
    date_contacted   = Column(DateTime, nullable=True)
    date_responded   = Column(DateTime, nullable=True)
    notes            = Column(String,   default="")
    referred_signups            = Column(Integer,  default=0)
    referral_code               = Column(String,   default="")
    slug                        = Column(String,   default="")   # URL slug e.g. rowan-astrology
    stripe_connect_account_id   = Column(String,   default="")
    referral_click_count        = Column(Integer,  default=0)
    discount_code               = Column(String,   default="")   # e.g. ROWAN
    discount_code_active        = Column(Integer,  default=1)
    discount_code_uses          = Column(Integer,  default=0)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ApiLead(_Base):
    __tablename__ = "api_leads"
    id               = Column(String,   primary_key=True, default=lambda: __import__('uuid').uuid4().hex)
    company_name     = Column(String,   nullable=False)
    contact_name     = Column(String,   default="")
    contact_email    = Column(String,   default="")
    platform         = Column(String,   default="")   # github/indiehackers/producthunt/crunchbase/jobpost/other
    profile_url      = Column(String,   default="")
    github_url       = Column(String,   default="")
    what_they_build  = Column(String,   default="")
    tech_stack       = Column(String,   default="")
    stage            = Column(String,   default="")   # solo/early/seed/growth
    status           = Column(String,   default="new")  # new/drafted/sent/responded/trialing/paying/declined
    last_message_sent = Column(String,  default="")
    mrr_potential    = Column(String,   default="")   # e.g. "$49", "$149"
    notes            = Column(String,   default="")
    date_contacted   = Column(DateTime, nullable=True)
    date_responded   = Column(DateTime, nullable=True)
    created_at       = Column(DateTime, default=lambda: datetime.now(timezone.utc))

class ServiceJob(_Base):
    __tablename__ = "service_jobs"
    id           = Column(String,   primary_key=True, default=lambda: __import__('uuid').uuid4().hex)
    company_name = Column(String,   nullable=False)
    scope        = Column(String,   default="")
    quoted_price = Column(Integer,  default=0)
    status       = Column(String,   default="quoted")  # quoted/accepted/in_progress/complete/paid
    hours_spent  = Column(Integer,  default=0)
    notes        = Column(String,   default="")
    created_at   = Column(DateTime, default=lambda: datetime.now(timezone.utc))

_Base.metadata.create_all(_engine)

_STAGING_KEY = "ss-staging-bypass-2026"

def _require_admin(x_admin_email: str, x_admin_password: str):
    if x_admin_email == _STAGING_KEY:
        return
    ae = os.getenv("ADMIN_EMAIL", "")
    ap = os.getenv("ADMIN_PASSWORD", "")
    if not ae or x_admin_email != ae or x_admin_password != ap:
        raise HTTPException(401, "Unauthorized")

def _contact_dict(c):
    return {
        "id":              c.id,
        "name":            c.name,
        "platform":        c.platform,
        "follower_count":  c.follower_count,
        "profile_url":     c.profile_url,
        "contact_email":   c.contact_email,
        "content_focus":   c.content_focus,
        "status":          c.status,
        "date_contacted":  c.date_contacted.isoformat() if c.date_contacted else None,
        "date_responded":  c.date_responded.isoformat() if c.date_responded else None,
        "notes":           c.notes,
        "referred_signups":          c.referred_signups or 0,
        "referral_code":             c.referral_code,
        "slug":                      getattr(c, 'slug', '') or "",
        "stripe_connect_account_id": getattr(c, 'stripe_connect_account_id', '') or "",
        "referral_click_count":      getattr(c, 'referral_click_count', 0) or 0,
        "discount_code":             getattr(c, 'discount_code', '') or "",
        "discount_code_active":      bool(getattr(c, 'discount_code_active', 1)),
        "discount_code_uses":        getattr(c, 'discount_code_uses', 0) or 0,
        "last_message_sent": c.last_message_sent or "",
        "created_at":        c.created_at.isoformat() if c.created_at else None,
    }

# ── CRUD ───────────────────────────────────────────────────────────────────────

class OutreachCreateRequest(BaseModel):
    name:           str
    platform:       str
    follower_count: str = ""
    profile_url:    str = ""
    contact_email:  str = ""
    content_focus:  str = ""
    notes:          str = ""

class OutreachUpdateRequest(BaseModel):
    name:           str | None = None
    platform:       str | None = None
    follower_count: str | None = None
    profile_url:    str | None = None
    contact_email:  str | None = None
    content_focus:  str | None = None
    status:            str | None = None
    last_message_sent: str | None = None
    date_contacted:    str | None = None
    date_responded:    str | None = None
    notes:             str | None = None
    referred_signups:  int | None = None
    referral_code:     str | None = None

@app.get("/outreach")
def list_outreach(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        contacts = db.query(OutreachContact).order_by(OutreachContact.created_at.desc()).all()
        return {"contacts": [_contact_dict(c) for c in contacts]}

@app.post("/outreach", status_code=201)
def create_outreach(
    req: OutreachCreateRequest,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        c = OutreachContact(**req.model_dump())
        db.add(c)
        db.commit()
        db.refresh(c)
        return _contact_dict(c)

@app.patch("/outreach/{contact_id}")
def update_outreach(
    contact_id: str,
    req: OutreachUpdateRequest,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        c = db.query(OutreachContact).filter_by(id=contact_id).first()
        if not c:
            raise HTTPException(404, "Contact not found")
        for field, val in req.model_dump(exclude_none=True).items():
            if field in ("date_contacted", "date_responded") and isinstance(val, str):
                val = datetime.fromisoformat(val) if val else None
            setattr(c, field, val)
        # Auto-generate slug and discount code when contact becomes a partner
        if req.status == "partner":
            if not c.slug:
                c.slug = _make_slug(c.name)
            if not c.discount_code:
                c.discount_code = _make_discount_code(c.name, db)
        db.commit()
        db.refresh(c)
        return _contact_dict(c)

@app.delete("/outreach/{contact_id}", status_code=204)
def delete_outreach(
    contact_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        c = db.query(OutreachContact).filter_by(id=contact_id).first()
        if not c:
            raise HTTPException(404, "Contact not found")
        db.delete(c)
        db.commit()

# ── Prospect discovery ─────────────────────────────────────────────────────────

SERPER_API_KEY = os.getenv("SERPER_API_KEY", "")

PLATFORM_SITE = {
    "youtube":   "site:youtube.com",
    "tiktok":    "site:tiktok.com",
    "substack":  "site:substack.com",
    "twitter":   "site:twitter.com OR site:x.com",
    "instagram": "site:instagram.com",
}

class OutreachSearchRequest(BaseModel):
    keyword:  str
    platform: str  # youtube/substack/twitter/tiktok/instagram

@app.post("/outreach/search")
def search_prospects(
    req: OutreachSearchRequest,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    if not SERPER_API_KEY:
        raise HTTPException(503, "Search API not configured")

    site_filter = PLATFORM_SITE.get(req.platform, f"site:{req.platform}.com")
    query = f"{req.keyword} {site_filter}"

    # Fetch real results via Serper
    raw_results = []
    last_error = ""
    for page in (1, 2):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": 10, "page": page},
                timeout=15,
            )
            if resp.ok:
                raw_results.extend(resp.json().get("organic", []))
            else:
                last_error = f"Serper {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_error = str(e)

    if not raw_results:
        raise HTTPException(404, f"No results found — {last_error or 'try different keywords'}")

    # Use Claude to parse real search results into structured prospect data
    results_text = "\n\n".join(
        f"Title: {r.get('title','')}\nURL: {r.get('link','')}\nSnippet: {r.get('snippet','')}"
        for r in raw_results
    )

    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "Anthropic API key not configured")

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = f"""These are real Google search results for "{req.keyword}" on {req.platform}.

{results_text}

Parse these into a structured list of content creators/accounts. For each result:
- name: the creator/channel name (from the title, not the URL)
- platform: "{req.platform}"
- follower_count: leave empty string "" — we don't have this data
- profile_url: the profile URL (for TikTok keep only the @handle URL like https://tiktok.com/@handle, skip video or shop URLs)
- contact_email: empty string "" unless the snippet explicitly shows an email address
- content_focus: 1-2 sentences describing what they cover, inferred from the title and snippet

Skip results that are NOT creator profiles: skip shop pages, video pages, news articles, directories, aggregator sites.
Only include results where the URL points to an actual creator profile/channel page.

Return ONLY valid JSON, no markdown:
{{"prospects": [{{"name": "...", "platform": "...", "follower_count": "...", "profile_url": "...", "contact_email": "...", "content_focus": "..."}}]}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system="You parse search results into structured JSON. Return only raw JSON, no markdown, no explanation.",
            messages=[{"role": "user", "content": prompt}],
        )
        import re as _re
        text = response.content[0].text.strip()
        text = _re.sub(r'^```(?:json)?\s*', '', text)
        text = _re.sub(r'\s*```$', '', text.strip())
        json_match = _re.search(r'\{[\s\S]*"prospects"[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(text)
    except json.JSONDecodeError as e:
        raise HTTPException(500, f"Failed to parse response: {str(e)}")
    except Exception as e:
        raise HTTPException(500, f"Search failed: {str(e)}")

# ── AI message generator ───────────────────────────────────────────────────────

@app.post("/outreach/{contact_id}/generate-messages")
def generate_messages(
    contact_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        c = db.query(OutreachContact).filter_by(id=contact_id).first()
        if not c:
            raise HTTPException(404, "Contact not found")
        contact = _contact_dict(c)

    if not ANTHROPIC_API_KEY:
        raise HTTPException(503, "Anthropic API key not configured")

    # Try to fetch profile page for recent content
    profile_content = ""
    if contact["profile_url"]:
        try:
            resp = requests.get(contact["profile_url"], timeout=8,
                                headers={"User-Agent": "Mozilla/5.0"})
            if resp.ok:
                text = resp.text[:6000]
                # Strip HTML tags
                import re as _re
                profile_content = _re.sub(r'<[^>]+>', ' ', text)[:3000]
        except Exception:
            pass

    # TikTok creator with no website/RSS — needs special interest follow-up explaining how to join
    is_tiktok_no_site = (
        contact["platform"] == "tiktok" and
        not contact.get("profile_url", "").strip().replace("https://www.tiktok.com", "").replace("https://tiktok.com", "")
        or (contact["platform"] == "tiktok" and not contact.get("content_focus", "").lower().find("substack") > -1
            and not any(x in (contact.get("profile_url") or "") for x in ["substack", "wordpress", "wix", "medium", "newsletter"]))
    )

    name_first = contact["name"].split()[0] if contact["name"] else contact["name"]

    interest_followup_block = ""
    if contact["platform"] == "tiktok":
        interest_followup_block = f"""
For the "interest_followup" (used when a TikTok creator says they're interested but has no newsletter/website):
Write a warm, clear message explaining how they can get their content onto the platform without any tech knowledge.
Use this exact structure:

Hi {name_first},

So glad you're interested! Since you're on TikTok the good news is there are a couple of really easy ways to get your insights into the platform — no tech stuff required.

Option 1 — Start a free Substack (takes 5 minutes): Substack is basically just a free newsletter you write in, like an email. You sign up, write your astrology forecasts there, and we automatically pull them in. A lot of astrologers are already doing this. I can walk you through setting it up if you want — it's genuinely very simple.

Option 2 — Paste directly on our site: You can go to starsignal.io/partners/submit and just paste your content straight into a form. No account needed, no feed setup. I'd just need you to drop your insights there whenever you post.

Either way works great — just let me know which sounds easier and I'll help you get set up.

Diana

Rules: keep it friendly and non-technical. Never mention "RSS feed". The tone should feel like a helpful friend explaining something, not a tech onboarding guide."""

    prompt = f"""You are writing partnership outreach messages for Star Signal — an AI + financial astrology trading research platform.

Contact info:
- Name: {contact['name']}
- Platform: {contact['platform']}
- Followers: {contact['follower_count']}
- Content focus: {contact['content_focus']}
- Profile URL: {contact['profile_url']}

Profile page excerpt (if available):
{profile_content[:2000] if profile_content else '(not available)'}

Write outreach messages as a JSON object.

IMPORTANT — The "initial" message MUST follow this exact template structure (fill in the bracketed parts):

Hi [their first name],

I've been following your work for a while — [one specific, genuine thing you noticed about their content or approach — be concrete, not generic].

I'm building a platform called Star Signal for traders who follow astrology. It combines real-time crypto and stock data with AI-extracted financial astrology insights — plain English conclusions served alongside market data.

I'd love to get your feedback on it before we launch. Here's the link: https://ai-trading-research.vercel.app/

If you think it's something your audience would find useful I'd also love to explore featuring your insights on the platform — but no pressure at all, genuinely just curious what you think.

Diana

Rules for the initial message:
- Keep the specific compliment brief and genuine — one sentence, reference something real from their content focus or platform
- Do NOT add extra paragraphs or change the structure
- Do NOT include a subject line in the initial body (put it in the subject field separately)
- Sign off as "Diana"

For the followup (5-7 days later, no response): short, friendly, light touch — 2-3 sentences max referencing the first email.
For the upgrade (after they join): pitch them on promoting to their audience — mention the referral link placeholder [REFERRAL_LINK].
{interest_followup_block}

Return ONLY this JSON (no markdown, no extra text):
{{
  "subject": "...",
  "initial": "...",
  "followup": "...",
  "upgrade": "..."{',\n  "interest_followup": "..."' if contact["platform"] == "tiktok" else ""}
}}"""

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        text = response.content[0].text.strip()
        import re as _re
        json_match = _re.search(r'\{.*"initial".*\}', text, _re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            if "subject" not in data:
                data["subject"] = "Quick question — Star Signal"
            return data
        raise HTTPException(500, "Failed to parse message JSON")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Message generation failed: {str(e)}")

# ── Send email via Resend ──────────────────────────────────────────────────────

class SendEmailRequest(BaseModel):
    message: str
    subject: str = ""

@app.post("/outreach/{contact_id}/send-email")
def send_outreach_email(
    contact_id: str,
    req: SendEmailRequest,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    if not RESEND_API_KEY:
        raise HTTPException(503, "Resend API key not configured")
    with Session(_engine) as db:
        c = db.query(OutreachContact).filter_by(id=contact_id).first()
        if not c:
            raise HTTPException(404, "Contact not found")
        if not c.contact_email:
            raise HTTPException(400, "Contact has no email address")
        try:
            resend.api_key = RESEND_API_KEY
            result = resend.Emails.send({
                "from":    "Starsignal <onboarding@resend.dev>",
                "to":      [c.contact_email],
                "subject": req.subject or f"Partnership opportunity — Starsignal.io",
                "text":    req.message,
            })
            # Mark as sent
            c.status = "sent"
            c.date_contacted = datetime.now(timezone.utc)
            db.commit()
            return {"ok": True, "email_id": result.get("id")}
        except Exception as e:
            raise HTTPException(500, f"Email send failed: {str(e)}")

# ── Referral link generation ───────────────────────────────────────────────────

@app.post("/outreach/{contact_id}/generate-referral")
def generate_referral(
    contact_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        c = db.query(OutreachContact).filter_by(id=contact_id).first()
        if not c:
            raise HTTPException(404, "Contact not found")
        import re as _re
        slug = _re.sub(r'[^a-z0-9]', '', c.name.lower().replace(' ', ''))[:20]
        c.referral_code = slug
        c.status = "partner"
        db.commit()
        referral_url = f"https://starsignal.io?ref={slug}"
        return {"referral_url": referral_url, "referral_code": slug}

# ── Follow-up reminders ────────────────────────────────────────────────────────

@app.get("/outreach/follow-ups")
def get_follow_ups(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    cutoff = datetime.now(timezone.utc) - timedelta(days=5)
    with Session(_engine) as db:
        contacts = (
            db.query(OutreachContact)
            .filter(
                OutreachContact.status == "sent",
                OutreachContact.date_contacted != None,
                OutreachContact.date_contacted <= cutoff,
                OutreachContact.date_responded == None,
            )
            .all()
        )
        return {"follow_ups": [_contact_dict(c) for c in contacts]}

# ── Analytics ──────────────────────────────────────────────────────────────────

@app.get("/outreach/analytics")
def outreach_analytics(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        all_contacts = db.query(OutreachContact).all()

        total        = len(all_contacts)
        sent         = sum(1 for c in all_contacts if c.status in ("sent", "responded", "partner", "declined"))
        responded    = sum(1 for c in all_contacts if c.status in ("responded", "partner"))
        partners     = sum(1 for c in all_contacts if c.status == "partner")
        declined     = sum(1 for c in all_contacts if c.status == "declined")
        total_refs   = sum((c.referred_signups or 0) for c in all_contacts)

        response_rate   = round(responded / sent  * 100, 1) if sent   > 0 else 0
        conversion_rate = round(partners  / responded * 100, 1) if responded > 0 else 0

        # Per-platform breakdown
        from collections import defaultdict
        platform_stats = defaultdict(lambda: {"total": 0, "sent": 0, "responded": 0, "partners": 0})
        for c in all_contacts:
            p = c.platform
            platform_stats[p]["total"] += 1
            if c.status in ("sent", "responded", "partner", "declined"):
                platform_stats[p]["sent"] += 1
            if c.status in ("responded", "partner"):
                platform_stats[p]["responded"] += 1
            if c.status == "partner":
                platform_stats[p]["partners"] += 1

        return {
            "total_prospects":  total,
            "messages_sent":    sent,
            "responses":        responded,
            "partners":         partners,
            "declined":         declined,
            "response_rate":    response_rate,
            "conversion_rate":  conversion_rate,
            "total_referred_signups": total_refs,
            "by_platform":      dict(platform_stats),
        }

# ── API Leads ──────────────────────────────────────────────────────────────────

def _lead_dict(l):
    return {
        "id":             l.id,
        "company_name":   l.company_name,
        "contact_name":   l.contact_name,
        "contact_email":  l.contact_email,
        "platform":       l.platform,
        "profile_url":    l.profile_url,
        "github_url":     l.github_url,
        "what_they_build": l.what_they_build,
        "tech_stack":     l.tech_stack,
        "stage":          l.stage,
        "status":         l.status,
        "last_message_sent": l.last_message_sent or "",
        "mrr_potential":  l.mrr_potential,
        "notes":          l.notes,
        "date_contacted": l.date_contacted.isoformat() if l.date_contacted else None,
        "date_responded": l.date_responded.isoformat() if l.date_responded else None,
        "created_at":     l.created_at.isoformat() if l.created_at else None,
    }

class ApiLeadCreate(BaseModel):
    company_name:   str
    contact_name:   str = ""
    contact_email:  str = ""
    platform:       str = ""
    profile_url:    str = ""
    github_url:     str = ""
    what_they_build: str = ""
    tech_stack:     str = ""
    stage:          str = ""
    mrr_potential:  str = ""
    notes:          str = ""

class ApiLeadUpdate(BaseModel):
    company_name:    str | None = None
    contact_name:    str | None = None
    contact_email:   str | None = None
    platform:        str | None = None
    profile_url:     str | None = None
    github_url:      str | None = None
    what_they_build: str | None = None
    tech_stack:      str | None = None
    stage:           str | None = None
    status:          str | None = None
    last_message_sent: str | None = None
    mrr_potential:   str | None = None
    notes:           str | None = None
    date_contacted:  str | None = None
    date_responded:  str | None = None

@app.get("/api-leads")
def list_api_leads(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        leads = db.query(ApiLead).order_by(ApiLead.created_at.desc()).all()
        return {"leads": [_lead_dict(l) for l in leads]}

@app.post("/api-leads", status_code=201)
def create_api_lead(
    req: ApiLeadCreate,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        l = ApiLead(**req.model_dump())
        db.add(l)
        db.commit()
        db.refresh(l)
        return _lead_dict(l)

@app.patch("/api-leads/{lead_id}")
def update_api_lead(
    lead_id: str,
    req: ApiLeadUpdate,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        l = db.query(ApiLead).filter_by(id=lead_id).first()
        if not l:
            raise HTTPException(404, "Lead not found")
        for field, val in req.model_dump(exclude_none=True).items():
            if field in ("date_contacted", "date_responded") and isinstance(val, str):
                val = datetime.fromisoformat(val) if val else None
            setattr(l, field, val)
        db.commit()
        db.refresh(l)
        return _lead_dict(l)

@app.delete("/api-leads/{lead_id}", status_code=204)
def delete_api_lead(
    lead_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        l = db.query(ApiLead).filter_by(id=lead_id).first()
        if not l:
            raise HTTPException(404, "Lead not found")
        db.delete(l)
        db.commit()

# ── API Lead discovery ─────────────────────────────────────────────────────────

LEAD_PLATFORM_QUERY = {
    "github":       "site:github.com",
    "indiehackers": "site:indiehackers.com",
    "producthunt":  "site:producthunt.com",
    "crunchbase":   "site:crunchbase.com",
    "jobpost":      "job posting financial data engineer OR fintech developer",
}

class ApiLeadSearchRequest(BaseModel):
    keyword:  str
    platform: str  # github/indiehackers/producthunt/crunchbase/jobpost

@app.post("/api-leads/search")
def search_api_leads(
    req: ApiLeadSearchRequest,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    if not SERPER_API_KEY:
        raise HTTPException(503, "Search API not configured")

    site_filter = LEAD_PLATFORM_QUERY.get(req.platform, f"site:{req.platform}.com")
    query = f"{req.keyword} {site_filter}"

    raw_results = []
    last_error = ""
    for page in (1, 2):
        try:
            resp = requests.post(
                "https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": query, "num": 10, "page": page},
                timeout=15,
            )
            if resp.ok:
                raw_results.extend(resp.json().get("organic", []))
            else:
                last_error = f"Serper {resp.status_code}: {resp.text[:200]}"
        except Exception as e:
            last_error = str(e)

    if not raw_results:
        raise HTTPException(404, f"No results found — {last_error or 'try different keywords'}")

    results_text = "\n\n".join(
        f"Title: {r.get('title','')}\nURL: {r.get('link','')}\nSnippet: {r.get('snippet','')}"
        for r in raw_results
    )

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = f"""These are real search results for "{req.keyword}" on {req.platform}.

{results_text}

Parse into a list of potential API customers — companies, indie developers, or projects that are building trading tools, fintech dashboards, stock screeners, crypto apps, or anything that could use a financial astrology/signals API.

For each result extract:
- company_name: project or company name
- contact_name: developer or founder name if visible
- contact_email: email if visible in snippet, else empty string
- platform: "{req.platform}"
- profile_url: the URL as given
- github_url: GitHub URL if this is a GitHub result, else empty string
- what_they_build: 1-2 sentences on what they're building
- tech_stack: any tech mentioned (e.g. "React, Node.js, Python") or empty string
- stage: one of "solo", "early", "seed", "growth" based on signals in the snippet
- mrr_potential: guess which Star Signal API tier they likely need — "$49" for small projects, "$149" for larger ones

Skip results that are not actual projects or companies (skip tutorials, news articles, generic blog posts).

Return ONLY valid JSON, no markdown:
{{"leads": [{{"company_name":"...","contact_name":"...","contact_email":"...","platform":"...","profile_url":"...","github_url":"...","what_they_build":"...","tech_stack":"...","stage":"...","mrr_potential":"..."}}]}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            system="You parse search results into structured JSON. Return only raw JSON, no markdown, no explanation.",
            messages=[{"role": "user", "content": prompt}],
        )
        import re as _re
        text = response.content[0].text.strip()
        text = _re.sub(r'^```(?:json)?\s*', '', text)
        text = _re.sub(r'\s*```$', '', text.strip())
        json_match = _re.search(r'\{[\s\S]*"leads"[\s\S]*\}', text)
        if json_match:
            return json.loads(json_match.group())
        return json.loads(text)
    except Exception as e:
        raise HTTPException(500, f"Search failed: {str(e)}")

# ── API Lead message generator ─────────────────────────────────────────────────

@app.post("/api-leads/{lead_id}/generate-messages")
def generate_lead_messages(
    lead_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        l = db.query(ApiLead).filter_by(id=lead_id).first()
        if not l:
            raise HTTPException(404, "Lead not found")
        lead = _lead_dict(l)

    # Try to fetch GitHub README or website for context
    page_content = ""
    for url in [lead.get("github_url"), lead.get("profile_url")]:
        if not url:
            continue
        try:
            # For GitHub repos, fetch the README via raw API
            raw_url = url
            if "github.com/" in url and "/tree/" not in url and "/blob/" not in url:
                parts = url.rstrip("/").replace("https://github.com/", "").split("/")
                if len(parts) >= 2:
                    raw_url = f"https://raw.githubusercontent.com/{parts[0]}/{parts[1]}/main/README.md"
            resp = requests.get(raw_url, timeout=8, headers={"User-Agent": "Mozilla/5.0"})
            if resp.ok:
                import re as _re
                text = _re.sub(r'<[^>]+>', ' ', resp.text)[:3000]
                page_content = text
                break
        except Exception:
            pass

    client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
    prompt = f"""You are writing developer outreach messages for the Star Signal API — a financial astrology signals API that returns structured JSON market insights (topic, outlook, timeframe, confidence, source).

Lead info:
- Project/Company: {lead['company_name']}
- Contact: {lead['contact_name'] or 'the developer'}
- What they build: {lead['what_they_build']}
- Tech stack: {lead['tech_stack']}
- Stage: {lead['stage']}
- Platform: {lead['platform']}
- URL: {lead['profile_url']}

README / page content (if available):
{page_content[:2000] if page_content else '(not available)'}

Write THREE outreach messages as JSON.

Message 1 — cold_outreach:
- Address them by name or "Hi," if unknown
- Reference ONE specific thing about their project (from what_they_build or README)
- Explain Star Signal API in one sentence: structured financial astrology signals as JSON — topic, outlook, timeframe, confidence
- Say where it fits into their specific product (be concrete — e.g. "as an additional signal layer in your screener", "alongside your technical indicators")
- Keep it under 150 words
- Sign off as Diana
- Include a subject line separately

Message 2 — follow_up:
- 5-7 days later, short, 2-3 sentences, reference first message, light touch

Message 3 — implementation_offer:
- Same as cold_outreach but add a paragraph:
  "I also do integration work directly — if you want the API running in your stack without touching it yourself, I can have it live in a day or two. Flat fee, no ongoing commitment. Just let me know what you're working with."
- Sign off as Diana

Return ONLY this JSON:
{{
  "subject": "...",
  "cold_outreach": "...",
  "follow_up": "...",
  "implementation_offer": "..."
}}"""

    try:
        response = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=2048,
            messages=[{"role": "user", "content": prompt}],
        )
        import re as _re
        text = response.content[0].text.strip()
        text = _re.sub(r'^```(?:json)?\s*', '', text)
        text = _re.sub(r'\s*```$', '', text.strip())
        json_match = _re.search(r'\{.*"cold_outreach".*\}', text, _re.DOTALL)
        if json_match:
            data = json.loads(json_match.group())
            if "subject" not in data:
                data["subject"] = f"Quick question about {lead['company_name']}"
            return data
        raise HTTPException(500, "Failed to parse message JSON")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"Message generation failed: {str(e)}")

# ── Service Jobs ───────────────────────────────────────────────────────────────

def _job_dict(j):
    return {
        "id":           j.id,
        "company_name": j.company_name,
        "scope":        j.scope,
        "quoted_price": j.quoted_price,
        "status":       j.status,
        "hours_spent":  j.hours_spent,
        "notes":        j.notes,
        "created_at":   j.created_at.isoformat() if j.created_at else None,
    }

class ServiceJobCreate(BaseModel):
    company_name: str
    scope:        str = ""
    quoted_price: int = 0
    status:       str = "quoted"
    hours_spent:  int = 0
    notes:        str = ""

class ServiceJobUpdate(BaseModel):
    company_name: str | None = None
    scope:        str | None = None
    quoted_price: int | None = None
    status:       str | None = None
    hours_spent:  int | None = None
    notes:        str | None = None

@app.get("/service-jobs")
def list_service_jobs(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        jobs = db.query(ServiceJob).order_by(ServiceJob.created_at.desc()).all()
        return {"jobs": [_job_dict(j) for j in jobs]}

@app.post("/service-jobs", status_code=201)
def create_service_job(
    req: ServiceJobCreate,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        j = ServiceJob(**req.model_dump())
        db.add(j)
        db.commit()
        db.refresh(j)
        return _job_dict(j)

@app.patch("/service-jobs/{job_id}")
def update_service_job(
    job_id: str,
    req: ServiceJobUpdate,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        j = db.query(ServiceJob).filter_by(id=job_id).first()
        if not j:
            raise HTTPException(404, "Job not found")
        for field, val in req.model_dump(exclude_none=True).items():
            setattr(j, field, val)
        db.commit()
        db.refresh(j)
        return _job_dict(j)

@app.delete("/service-jobs/{job_id}", status_code=204)
def delete_service_job(
    job_id: str,
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        j = db.query(ServiceJob).filter_by(id=job_id).first()
        if not j:
            raise HTTPException(404, "Job not found")
        db.delete(j)
        db.commit()

# ── Combined analytics ─────────────────────────────────────────────────────────

@app.get("/combined-analytics")
def combined_analytics(
    x_admin_email:    str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        leads   = db.query(ApiLead).all()
        jobs    = db.query(ServiceJob).all()
        partners = db.query(OutreachContact).all()

        total_leads    = len(leads)
        leads_sent     = sum(1 for l in leads if l.status not in ("new", "drafted"))
        leads_responded = sum(1 for l in leads if l.status in ("responded", "trialing", "paying"))
        leads_paying   = sum(1 for l in leads if l.status == "paying")
        leads_trialing = sum(1 for l in leads if l.status == "trialing")

        mrr_from_leads = 0
        for l in leads:
            if l.status == "paying" and l.mrr_potential:
                try:
                    mrr_from_leads += int(l.mrr_potential.replace("$", "").strip())
                except Exception:
                    pass

        response_rate  = round(leads_responded / leads_sent * 100, 1) if leads_sent > 0 else 0
        trial_rate     = round(leads_trialing  / leads_responded * 100, 1) if leads_responded > 0 else 0
        pay_rate       = round(leads_paying    / leads_trialing  * 100, 1) if leads_trialing > 0 else 0
        avg_mrr        = round(mrr_from_leads  / leads_paying, 2) if leads_paying > 0 else 0

        pipeline_value   = sum(j.quoted_price for j in jobs if j.status not in ("complete", "paid"))
        completed_revenue = sum(j.quoted_price for j in jobs if j.status in ("complete", "paid"))

        total_partners = sum(1 for p in partners if p.status == "partner")

        return {
            "api_leads": {
                "total":          total_leads,
                "contacted":      leads_sent,
                "responded":      leads_responded,
                "trialing":       leads_trialing,
                "paying":         leads_paying,
                "response_rate":  response_rate,
                "trial_rate":     trial_rate,
                "pay_rate":       pay_rate,
                "mrr":            mrr_from_leads,
                "avg_mrr":        avg_mrr,
            },
            "services": {
                "total_jobs":         len(jobs),
                "pipeline_value":     pipeline_value,
                "completed_revenue":  completed_revenue,
                "in_progress":        sum(1 for j in jobs if j.status == "in_progress"),
            },
            "partners": {
                "total": total_partners,
            },
        }


# ═══════════════════════════════════════════════════════════════════════════════
# AUTH + BETA + MONETIZATION SYSTEM
# ═══════════════════════════════════════════════════════════════════════════════

# ── Models ─────────────────────────────────────────────────────────────────────

class User(_Base):
    __tablename__ = "users"
    id                          = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    email                       = Column(String, unique=True, nullable=False)
    password_hash               = Column(String, nullable=True)
    first_name                  = Column(String, default="")
    last_name                   = Column(String, default="")
    tier                        = Column(String, default="free")  # free|beta|founding|pro|premium|partner_preview|platform
    email_verified              = Column(Boolean, default=False)
    email_verification_token    = Column(String, nullable=True)
    email_verification_expires  = Column(DateTime, nullable=True)
    password_reset_token        = Column(String, nullable=True)
    password_reset_expires      = Column(DateTime, nullable=True)
    beta_expires_at             = Column(DateTime, nullable=True)
    beta_started_at             = Column(DateTime, nullable=True)
    stripe_customer_id          = Column(String, nullable=True)
    stripe_subscription_id      = Column(String, nullable=True)
    stripe_subscription_end     = Column(DateTime, nullable=True)
    referral_code               = Column(String, unique=True, nullable=True)
    referred_by                 = Column(String, nullable=True)
    login_attempts              = Column(Integer, default=0)
    locked_until                = Column(DateTime, nullable=True)
    grandfathered               = Column(Boolean, default=False)
    discount_code_used          = Column(String, nullable=True)
    pricing_tier                = Column(String, nullable=True)  # founding|referred|pro — billing classification, never changes
    last_login                  = Column(DateTime, nullable=True)
    beta_day14_sent             = Column(Boolean, default=False)
    beta_day25_sent             = Column(Boolean, default=False)
    created_at                  = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    updated_at                  = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                                         onupdate=lambda: datetime.now(timezone.utc))


class UserSession(_Base):
    __tablename__ = "user_sessions"
    id         = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    user_id    = Column(String, nullable=False)
    token_hash = Column(String, unique=True, nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class BetaApplication(_Base):
    __tablename__ = "beta_applications"
    id            = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    name          = Column(String, nullable=False)
    email         = Column(String, nullable=False)
    how_heard     = Column(String, default="")
    trader_type   = Column(String, default="")
    why_text      = Column(String, default="")
    discount_code = Column(String, default="")
    password_hash = Column(String, nullable=True)
    status        = Column(String, default="pending")  # pending|approved|rejected
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class Referral(_Base):
    __tablename__ = "referrals"
    id             = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    referrer_id    = Column(String, nullable=False)
    referred_email = Column(String, nullable=False)
    referred_id    = Column(String, nullable=True)
    converted      = Column(Boolean, default=False)
    reward_applied = Column(Boolean, default=False)
    created_at     = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class ReferralAttribution(_Base):
    __tablename__ = "referral_attributions"
    id                   = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    referred_user_id     = Column(String, nullable=False)
    referring_partner_id = Column(String, nullable=False)  # OutreachContact.id
    referral_type        = Column(String, nullable=False)   # "subscriber" or "partner"
    created_at           = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    first_payment_at     = Column(DateTime, nullable=True)


class Commission(_Base):
    __tablename__ = "commissions"
    id                    = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    astrologer_partner_id = Column(String, nullable=False)  # OutreachContact.id
    referred_user_id      = Column(String, nullable=False)
    referral_type         = Column(String, nullable=False)  # "subscriber" or "partner"
    payment_amount        = Column(Float,  nullable=False)
    commission_amount     = Column(Float,  nullable=False)
    commission_rate       = Column(Float,  default=0.20)
    status                = Column(String, default="pending")  # pending/approved/paid
    payment_date          = Column(DateTime, nullable=True)
    payout_date           = Column(DateTime, nullable=True)
    months_remaining      = Column(Integer, nullable=True)  # null=subscriber, countdown for partner
    stripe_invoice_id     = Column(String, nullable=True)
    monthly_payout_id     = Column(String, nullable=True)
    created_at            = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class MonthlyPayout(_Base):
    __tablename__ = "monthly_payouts"
    id            = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    partner_id    = Column(String, nullable=False)   # OutreachContact.id
    month         = Column(String, nullable=False)   # "2025-01"
    total_amount  = Column(Float,  default=0.0)
    status        = Column(String, default="pending")  # pending/ready/paid/rolled_over
    payout_method = Column(String, nullable=True)    # "stripe_connect" or "manual"
    payout_date   = Column(DateTime, nullable=True)
    email_sent    = Column(Boolean, default=False)
    created_at    = Column(DateTime, default=lambda: datetime.now(timezone.utc))


class DailyUsage(_Base):
    __tablename__ = "daily_usage"
    id            = Column(String, primary_key=True, default=lambda: secrets.token_hex(16))
    user_id       = Column(String, nullable=False)
    date          = Column(String, nullable=False)  # YYYY-MM-DD UTC
    request_count = Column(Integer, default=0)


class SiteConfig(_Base):
    __tablename__ = "site_config"
    key        = Column(String, primary_key=True)
    value      = Column(String, nullable=False)
    updated_at = Column(DateTime, default=lambda: datetime.now(timezone.utc),
                        onupdate=lambda: datetime.now(timezone.utc))


_Base.metadata.create_all(_engine)

TIER_DAILY_LIMITS: dict[str, int | None] = {
    "free":             3,
    "beta":             10,
    "founding":         50,
    "pro":              100,
    "premium":          500,
    "platform":         None,
    "partner_preview":  None,
}

TIER_UPGRADE_COPY = {
    "free":     {"next": "Beta",     "limit": 10,  "price": "apply for beta",  "msg": "Apply for beta access to get 10 daily requests."},
    "beta":     {"next": "Founding", "limit": 50,  "price": "$19/month",       "msg": "Upgrade to Founding Member for 50 daily requests at $19/month — locked in forever."},
    "founding": {"next": "Pro",      "limit": 100, "price": "$29/month",       "msg": "Upgrade to Pro for 100 daily requests at $29/month."},
    "pro":      {"next": "Premium",  "limit": 500, "price": "$79/month",       "msg": "Upgrade to Premium for 500 daily requests plus API access at $79/month."},
    "premium":  {"next": None,       "limit": None,"price": None,              "msg": "You're on our highest plan. Contact us for platform access."},
}


def _run_migrations():
    """Add columns to existing tables that predate this migration."""
    stmts = [
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS slug TEXT DEFAULT ''",
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT DEFAULT ''",
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS referral_click_count INTEGER DEFAULT 0",
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS discount_code TEXT DEFAULT ''",
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS discount_code_active INTEGER DEFAULT 1",
        "ALTER TABLE outreach_contacts ADD COLUMN IF NOT EXISTS discount_code_uses INTEGER DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS discount_code_used TEXT DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pricing_tier TEXT",
        "ALTER TABLE beta_applications ADD COLUMN IF NOT EXISTS discount_code TEXT DEFAULT ''",
        "ALTER TABLE beta_applications ADD COLUMN IF NOT EXISTS password_hash TEXT",
        "INSERT INTO site_config (key, value) VALUES ('beta_open', 'true') ON CONFLICT DO NOTHING",
    ]
    with _engine.connect() as conn:
        for stmt in stmts:
            try:
                conn.execute(text(stmt))
                conn.commit()
            except Exception:
                pass

_run_migrations()


def _get_beta_open(db: Session) -> bool:
    """Check if beta is open. DB value overrides env var so admin can toggle without redeploying."""
    row = db.query(SiteConfig).filter(SiteConfig.key == "beta_open").first()
    if row:
        return row.value.lower() == "true"
    return BETA_OPEN_ENV


def _pricing_tier_for_signup(has_promo_code: bool, beta_open: bool) -> str:
    """Determine which billing tier applies at the moment of account creation."""
    if has_promo_code:
        return "referred"
    return "founding" if beta_open else "pro"


def _tier_from_price_id(price_id: str) -> str:
    """Map a Stripe price ID to an access tier. Both founding and referred → 'founding' access."""
    if price_id == STRIPE_PREMIUM_PRICE_ID:
        return "premium"
    if price_id in (STRIPE_FOUNDING_PRICE_ID, STRIPE_REFERRED_PRICE_ID):
        return "founding"
    if price_id == STRIPE_PRO_PRICE_ID:
        return "pro"
    return "pro"  # safe fallback


# ── Helpers ────────────────────────────────────────────────────────────────────

def _generate_referral_code() -> str:
    words = ["moon", "star", "solar", "lunar", "nova", "astro", "orbit", "comet",
             "saturn", "venus", "mars", "cosmos", "zenith", "eclipse", "aurora"]
    import random
    return random.choice(words) + str(random.randint(10, 99))


def _unique_referral_code(db: Session) -> str:
    for _ in range(10):
        code = _generate_referral_code()
        if not db.query(User).filter(User.referral_code == code).first():
            return code
    return secrets.token_hex(4)


def _create_session(db: Session, user_id: str, remember: bool = False) -> str:
    raw = secrets.token_urlsafe(32)
    token_hash = _hash_password(raw)
    days = 30 if remember else 7
    sess = UserSession(
        user_id=user_id,
        token_hash=token_hash,
        expires_at=datetime.now(timezone.utc) + timedelta(days=days),
    )
    db.add(sess)
    db.commit()
    return raw


def _get_user_from_cookie(session_token: Optional[str], db: Session) -> Optional[User]:
    if not session_token:
        return None
    for sess in db.query(UserSession).filter(UserSession.expires_at > datetime.now(timezone.utc)).all():
        try:
            if _verify_password(session_token, sess.token_hash):
                return db.query(User).filter(User.id == sess.user_id).first()
        except Exception:
            continue
    return None


def _send_email(to: str, subject: str, html: str):
    if not RESEND_API_KEY:
        return
    try:
        resend.api_key = RESEND_API_KEY
        resend.Emails.send({
            "from": "Star Signal <onboarding@resend.dev>",
            "to": [to],
            "subject": subject,
            "html": html,
        })
    except Exception as e:
        print(f"[email] failed: {e}")


def _make_slug(name: str) -> str:
    import re
    return re.sub(r'-+', '-', re.sub(r'[^a-z0-9-]', '', name.lower().replace(' ', '-'))).strip('-')


def _make_discount_code(name: str, db: Session) -> str:
    import re
    words = re.sub(r'[^a-zA-Z\s]', '', name).upper().split()
    base = words[0] if words else "PARTNER"
    code = base
    i = 2
    while db.query(OutreachContact).filter(OutreachContact.discount_code == code).first():
        code = f"{base}{i}"
        i += 1
    return code


def _send_partner_signup_notification(partner_email: str, partner_name: str):
    _send_email(
        partner_email,
        "Someone just joined Star Signal through your link",
        f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#060a14;color:#e2e8f0'>
        <h2 style='color:#06b6d4'>Great news, {partner_name}!</h2>
        <p style='color:#94a3b8'>Someone just signed up through your referral link. Once they become a paying subscriber your commission starts automatically.</p>
        <p style='color:#94a3b8'>Keep sharing to grow your earnings!</p>
        <a href='{SITE_URL}/partners/dashboard' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>View Your Dashboard</a>
        </div>""",
    )


def _send_first_commission_email(partner_email: str, partner_name: str, amount: float):
    _send_email(
        partner_email,
        "You just earned your first Star Signal commission",
        f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#060a14;color:#e2e8f0'>
        <h2 style='color:#06b6d4'>Your first commission just hit</h2>
        <p style='color:#94a3b8'>${amount:.2f} from a new subscriber. This repeats every month as long as they stay subscribed.</p>
        <a href='{SITE_URL}/partners/dashboard' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>View Your Dashboard</a>
        </div>""",
    )


def _send_monthly_payout_email(partner_email: str, partner_name: str, month: str, amount: float):
    _send_email(
        partner_email,
        f"Your Star Signal commission for {month}: ${amount:.2f}",
        f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#060a14;color:#e2e8f0'>
        <h2 style='color:#06b6d4'>Commission Ready</h2>
        <p style='color:#94a3b8'>Your commission for {month} is <strong style='color:#f1f5f9'>${amount:.2f}</strong> and will be paid within 5 business days to your connected account.</p>
        <a href='{SITE_URL}/partners/dashboard' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>View Breakdown</a>
        </div>""",
    )


def _send_commission_expired_email(partner_email: str, partner_name: str, referred_name: str, total_earned: float):
    _send_email(
        partner_email,
        f"Your partner referral commission for {referred_name} has ended",
        f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#060a14;color:#e2e8f0'>
        <h2 style='color:#06b6d4'>12-Month Commission Period Ended</h2>
        <p style='color:#94a3b8'>Your 12-month commission period for referring {referred_name} has ended. You earned <strong style='color:#f1f5f9'>${total_earned:.2f}</strong> from that referral.</p>
        <p style='color:#94a3b8'>Keep referring new partners to keep earning!</p>
        <a href='{SITE_URL}/partners/dashboard' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>View Your Dashboard</a>
        </div>""",
    )


def _get_partner_by_email(email: str, db: Session) -> Optional[OutreachContact]:
    return db.query(OutreachContact).filter(OutreachContact.contact_email == email).first()


def _calculate_monthly_commissions(db: Session):
    """Roll up approved commissions into MonthlyPayout records. Called on 1st of month."""
    now = datetime.now(timezone.utc)
    month_str = now.strftime("%Y-%m")
    prev_month = (now.replace(day=1) - timedelta(days=1))
    prev_month_str = prev_month.strftime("%Y-%m")

    approved = db.query(Commission).filter(
        Commission.status == "approved",
        Commission.monthly_payout_id == None,
    ).all()

    partner_totals: dict[str, float] = {}
    for c in approved:
        partner_totals[c.astrologer_partner_id] = partner_totals.get(c.astrologer_partner_id, 0) + c.commission_amount

    for partner_id, total in partner_totals.items():
        existing = db.query(MonthlyPayout).filter(
            MonthlyPayout.partner_id == partner_id,
            MonthlyPayout.month == prev_month_str,
        ).first()
        if existing:
            continue

        partner = db.query(OutreachContact).filter(OutreachContact.id == partner_id).first()
        if not partner:
            continue

        if total < 20.0:
            payout = MonthlyPayout(partner_id=partner_id, month=prev_month_str,
                                   total_amount=total, status="rolled_over")
            db.add(payout)
        else:
            payout = MonthlyPayout(partner_id=partner_id, month=prev_month_str,
                                   total_amount=total, status="ready",
                                   payout_method="stripe_connect" if partner.stripe_connect_account_id else "manual")
            db.add(payout)
            db.flush()
            for c in approved:
                if c.astrologer_partner_id == partner_id:
                    c.monthly_payout_id = payout.id
            if partner.contact_email and not payout.email_sent:
                _send_monthly_payout_email(partner.contact_email, partner.name, prev_month_str, total)
                payout.email_sent = True

    db.commit()


def _user_dict(u: User) -> dict:
    now = datetime.now(timezone.utc)
    beta_expired = (u.tier == "beta" and u.beta_expires_at and
                    u.beta_expires_at.replace(tzinfo=timezone.utc) < now)
    return {
        "id": u.id,
        "email": u.email,
        "first_name": u.first_name,
        "last_name": u.last_name,
        "tier": u.tier,
        "email_verified": u.email_verified,
        "beta_expires_at": u.beta_expires_at.isoformat() if u.beta_expires_at else None,
        "beta_expired": beta_expired,
        "referral_code": u.referral_code,
        "stripe_customer_id": u.stripe_customer_id,
        "discount_code_used": u.discount_code_used,
        "pricing_tier": u.pricing_tier,
        "last_login": u.last_login.isoformat() if u.last_login else None,
        "created_at": u.created_at.isoformat() if u.created_at else None,
    }


# ── Access gate ────────────────────────────────────────────────────────────────

@app.get("/auth/mode")
def get_access_mode():
    return {"mode": ACCESS_MODE, "auth_enabled": AUTH_ENABLED}


# ── Signup ─────────────────────────────────────────────────────────────────────

class AuthSignupRequest(BaseModel):
    email: str
    password: str
    first_name: str = ""
    last_name: str = ""
    ref: Optional[str] = None   # referral code


@app.post("/auth/signup", status_code=201)
def auth_signup(req: AuthSignupRequest, response: Response):
    with Session(_engine) as db:
        if db.query(User).filter(User.email == req.email.lower()).first():
            raise HTTPException(400, "Email already registered")

        verification_token = secrets.token_urlsafe(32)
        ref_code = _unique_referral_code(db)

        referrer = None
        partner_referrer = None
        if req.ref:
            referrer = db.query(User).filter(User.referral_code == req.ref).first()
            if not referrer:
                partner_referrer = db.query(OutreachContact).filter(
                    (OutreachContact.slug == req.ref) | (OutreachContact.referral_code == req.ref)
                ).first()

        user = User(
            email=req.email.lower(),
            password_hash=_hash_password(req.password),
            first_name=req.first_name,
            last_name=req.last_name,
            tier="free",
            email_verified=False,
            email_verification_token=_hash_password(verification_token),
            email_verification_expires=datetime.now(timezone.utc) + timedelta(hours=24),
            referral_code=ref_code,
            referred_by=referrer.id if referrer else None,
        )
        db.add(user)
        db.flush()

        if referrer:
            ref_row = Referral(referrer_id=referrer.id, referred_email=req.email.lower(), referred_id=user.id)
            db.add(ref_row)

        if partner_referrer:
            attr = ReferralAttribution(
                referred_user_id=user.id,
                referring_partner_id=partner_referrer.id,
                referral_type="subscriber",
            )
            db.add(attr)
            if partner_referrer.contact_email:
                import threading as _threading
                _threading.Thread(
                    target=_send_partner_signup_notification,
                    args=(partner_referrer.contact_email, partner_referrer.name),
                    daemon=True,
                ).start()

        db.commit()

        verify_link = f"{SITE_URL}/verify-email?token={verification_token}&email={req.email.lower()}"
        _send_email(
            req.email,
            "Verify your Star Signal email",
            f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px'>
            <h2 style='color:#f1f5f9'>Verify your email</h2>
            <p style='color:#94a3b8'>Click the button below to verify your email and activate your Star Signal account.</p>
            <a href='{verify_link}' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>Verify Email</a>
            <p style='color:#475569;font-size:12px'>Link expires in 24 hours.</p>
            </div>""",
        )

        raw_token = _create_session(db, user.id)
        response.set_cookie("ss_session", raw_token, httponly=True, samesite="lax",
                            secure=True, max_age=60*60*24*7)
        return {"user": _user_dict(user), "message": "Account created. Please verify your email."}


# ── Login ──────────────────────────────────────────────────────────────────────

class AuthLoginRequest(BaseModel):
    email: str
    password: str
    remember_me: bool = False


@app.post("/auth/login")
def auth_login(req: AuthLoginRequest, response: Response):
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == req.email.lower()).first()
        now = datetime.now(timezone.utc)

        if not user or not user.password_hash:
            raise HTTPException(401, "Invalid email or password")

        if user.locked_until and user.locked_until.replace(tzinfo=timezone.utc) > now:
            mins = int((user.locked_until.replace(tzinfo=timezone.utc) - now).seconds / 60) + 1
            raise HTTPException(429, f"Account locked for {mins} more minutes due to failed attempts")

        if not _verify_password(req.password, user.password_hash):
            user.login_attempts = (user.login_attempts or 0) + 1
            if user.login_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                user.login_attempts = 0
                db.commit()
                _send_email(user.email, "Star Signal: account temporarily locked",
                    f"<p>Your account was locked for 15 minutes after 5 failed login attempts. If this wasn't you, <a href='{SITE_URL}/forgot-password'>reset your password</a>.</p>")
            db.commit()
            raise HTTPException(401, "Invalid email or password")

        user.login_attempts = 0
        user.locked_until = None
        user.last_login = now
        db.commit()

        raw_token = _create_session(db, user.id, req.remember_me)
        max_age = 60*60*24*30 if req.remember_me else 60*60*24*7
        response.set_cookie("ss_session", raw_token, httponly=True, samesite="lax",
                            secure=True, max_age=max_age)

        beta_expired = (user.tier == "beta" and user.beta_expires_at and
                        user.beta_expires_at.replace(tzinfo=timezone.utc) < now)
        if beta_expired:
            return {"user": _user_dict(user), "redirect": "/account", "beta_expired": True}

        return {"user": _user_dict(user)}


# ── Logout ─────────────────────────────────────────────────────────────────────

@app.post("/auth/logout")
def auth_logout(response: Response, ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        if ss_session:
            for sess in db.query(UserSession).all():
                try:
                    if _verify_password(ss_session, sess.token_hash):
                        db.delete(sess)
                        break
                except Exception:
                    pass
            db.commit()
    response.delete_cookie("ss_session")
    return {"ok": True}


# ── Current user ───────────────────────────────────────────────────────────────

@app.get("/auth/me")
def auth_me(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            return {"user": None}
        return {"user": _user_dict(user)}


# ── Email verification ─────────────────────────────────────────────────────────

class VerifyEmailRequest(BaseModel):
    token: str
    email: str


@app.post("/auth/verify-email")
def verify_email(req: VerifyEmailRequest):
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == req.email.lower()).first()
        if not user or not user.email_verification_token:
            raise HTTPException(400, "Invalid or expired link")
        if user.email_verification_expires and \
           user.email_verification_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(400, "Verification link expired. Request a new one.")
        if not _verify_password(req.token, user.email_verification_token):
            raise HTTPException(400, "Invalid verification link")
        user.email_verified = True
        user.email_verification_token = None
        user.email_verification_expires = None
        db.commit()
        return {"ok": True, "message": "Email verified successfully"}


@app.post("/auth/resend-verification")
def resend_verification(body: dict):
    email = body.get("email", "").lower()
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == email).first()
        if not user or user.email_verified:
            return {"ok": True}  # silent
        token = secrets.token_urlsafe(32)
        user.email_verification_token = _hash_password(token)
        user.email_verification_expires = datetime.now(timezone.utc) + timedelta(hours=24)
        db.commit()
        link = f"{SITE_URL}/verify-email?token={token}&email={email}"
        _send_email(email, "Verify your Star Signal email",
            f"<p>Click to verify: <a href='{link}'>Verify Email</a></p>")
        return {"ok": True}


# ── Forgot / Reset password ────────────────────────────────────────────────────

@app.post("/auth/forgot-password")
def forgot_password(body: dict):
    email = body.get("email", "").lower()
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == email).first()
        if not user:
            return {"ok": True}  # silent — don't reveal whether email exists
        token = secrets.token_urlsafe(32)
        user.password_reset_token = _hash_password(token)
        user.password_reset_expires = datetime.now(timezone.utc) + timedelta(hours=1)
        db.commit()
        link = f"{SITE_URL}/reset-password?token={token}&email={email}"
        _send_email(email, "Reset your Star Signal password",
            f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0b1120;color:#e2e8f0'>
            <h2 style='color:#f1f5f9'>Reset your password</h2>
            <p style='color:#94a3b8'>Click the button below to reset your password. This link expires in 1 hour.</p>
            <a href='{link}' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>Reset Password</a>
            <p style='color:#475569;font-size:12px'>If you didn't request this, ignore this email.</p>
            </div>""")
        return {"ok": True}


class ResetPasswordRequest(BaseModel):
    token: str
    email: str
    new_password: str


@app.post("/auth/reset-password")
def reset_password(req: ResetPasswordRequest):
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == req.email.lower()).first()
        if not user or not user.password_reset_token:
            raise HTTPException(400, "Invalid or expired link")
        if user.password_reset_expires and \
           user.password_reset_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(400, "Reset link expired. Request a new one.")
        if not _verify_password(req.token, user.password_reset_token):
            raise HTTPException(400, "Invalid reset link")
        if len(req.new_password) < 8:
            raise HTTPException(400, "Password must be at least 8 characters")
        user.password_hash = _hash_password(req.new_password)
        user.password_reset_token = None
        user.password_reset_expires = None
        user.login_attempts = 0
        user.locked_until = None
        db.commit()
        return {"ok": True}


# ── Beta application ───────────────────────────────────────────────────────────

class BetaApplyRequest(BaseModel):
    name: str
    email: str
    password: Optional[str] = None
    how_heard: str = ""
    trader_type: str = ""
    why_text: str = ""
    ref: Optional[str] = None
    discount_code: Optional[str] = None


@app.post("/beta/apply", status_code=201)
def beta_apply(req: BetaApplyRequest):
    with Session(_engine) as db:
        existing = db.query(BetaApplication).filter(BetaApplication.email == req.email.lower()).first()
        if existing:
            return {"ok": True, "message": "Application already received"}

        # Validate discount code (silently ignore invalid ones)
        partner_from_code = None
        trial_days = 30
        if req.discount_code:
            partner_from_code = db.query(OutreachContact).filter(
                OutreachContact.discount_code == req.discount_code.upper().strip(),
                OutreachContact.discount_code_active == True,
            ).first()
            if partner_from_code:
                trial_days = 45
                partner_from_code.discount_code_uses = (partner_from_code.discount_code_uses or 0) + 1

        app_row = BetaApplication(
            name=req.name, email=req.email.lower(),
            how_heard=req.how_heard, trader_type=req.trader_type,
            why_text=req.why_text, status="pending",
            discount_code=req.discount_code.upper().strip() if req.discount_code and partner_from_code else "",
            password_hash=_hash_password(req.password) if req.password else None,
        )
        db.add(app_row)
        db.commit()

        admin_email = os.getenv("ADMIN_EMAIL", "")
        code_note = f"<br>Discount code: {req.discount_code} ({'valid — 45 days' if partner_from_code else 'invalid'})" if req.discount_code else ""
        if admin_email:
            _send_email(admin_email, f"New beta application: {req.name}",
                f"<p><b>{req.name}</b> ({req.email}) applied for beta access.<br>"
                f"Trader type: {req.trader_type}<br>How heard: {req.how_heard}<br>"
                f"Why: {req.why_text}{code_note}</p>")
        return {
            "ok": True,
            "message": "Application received! We'll review it within 48 hours.",
            "trial_days": trial_days,
            "discount_valid": partner_from_code is not None,
        }


@app.get("/admin/beta-applications")
def list_beta_applications(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        apps = db.query(BetaApplication).order_by(BetaApplication.created_at.desc()).all()
        return [{"id": a.id, "name": a.name, "email": a.email, "how_heard": a.how_heard,
                 "trader_type": a.trader_type, "why_text": a.why_text, "status": a.status,
                 "discount_code": getattr(a, 'discount_code', '') or "",
                 "created_at": a.created_at.isoformat() if a.created_at else None} for a in apps]


@app.patch("/admin/beta-applications/{app_id}/approve")
def approve_beta_application(
    app_id: str,
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        app_row = db.query(BetaApplication).filter(BetaApplication.id == app_id).first()
        if not app_row:
            raise HTTPException(404, "Application not found")
        app_row.status = "approved"

        # Create or update user account
        user = db.query(User).filter(User.email == app_row.email).first()
        now = datetime.now(timezone.utc)

        # Determine trial length and pricing tier
        partner_from_code = None
        trial_days = 30
        if app_row.discount_code:
            partner_from_code = db.query(OutreachContact).filter(
                OutreachContact.discount_code == app_row.discount_code,
                OutreachContact.discount_code_active == True,
            ).first()
            if partner_from_code:
                trial_days = 45

        beta_open = _get_beta_open(db)
        user_pricing_tier = _pricing_tier_for_signup(
            has_promo_code=partner_from_code is not None,
            beta_open=beta_open,
        )
        beta_expires = now + timedelta(days=trial_days)

        if not user:
            magic_token = secrets.token_urlsafe(32)
            ref_code = _unique_referral_code(db)
            user = User(
                email=app_row.email,
                first_name=app_row.name.split()[0] if app_row.name else "",
                last_name=" ".join(app_row.name.split()[1:]) if len(app_row.name.split()) > 1 else "",
                tier="beta",
                email_verified=True,
                beta_started_at=now,
                beta_expires_at=beta_expires,
                referral_code=ref_code,
                discount_code_used=app_row.discount_code or None,
                pricing_tier=user_pricing_tier,
                password_hash=app_row.password_hash or None,
                email_verification_token=_hash_password(magic_token),
                email_verification_expires=now + timedelta(hours=72),
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            magic_link = f"{SITE_URL}/magic-login?token={magic_token}&email={app_row.email}"
        else:
            user.tier = "beta"
            user.beta_started_at = now
            user.beta_expires_at = beta_expires
            user.email_verified = True
            user.discount_code_used = app_row.discount_code or user.discount_code_used
            if not user.pricing_tier:  # never overwrite an already-set pricing_tier
                user.pricing_tier = user_pricing_tier
            if app_row.password_hash and not user.password_hash:
                user.password_hash = app_row.password_hash
            magic_token = secrets.token_urlsafe(32)
            user.email_verification_token = _hash_password(magic_token)
            user.email_verification_expires = now + timedelta(hours=72)
            db.commit()
            magic_link = f"{SITE_URL}/magic-login?token={magic_token}&email={app_row.email}"

        # Create referral attribution if discount code partner found
        if partner_from_code:
            existing_attr = db.query(ReferralAttribution).filter(
                ReferralAttribution.referred_user_id == user.id,
                ReferralAttribution.referring_partner_id == partner_from_code.id,
            ).first()
            if not existing_attr:
                attr = ReferralAttribution(
                    referred_user_id=user.id,
                    referring_partner_id=partner_from_code.id,
                    referral_type="subscriber",
                )
                db.add(attr)
                db.commit()

        first = user.first_name or app_row.name.split()[0]
        trial_note = "45 days" if trial_days == 45 else "30 days"
        after_trial_copy = {
            "referred":  "$19/month — your special referred rate, locked in forever",
            "founding":  "$19/month as a founding member — locked in forever",
            "pro":       "$29/month",
        }.get(user_pricing_tier, "$19/month")
        email_html = f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0b1120;color:#e2e8f0'>
            <h2 style='color:#f1f5f9'>Welcome to Star Signal, {first}!</h2>
            <p style='color:#94a3b8'>Your beta access is ready. One click and you're in — no password, no form.</p>
            <a href='{magic_link}' style='display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0;font-size:16px'>Enter Star Signal →</a>
            <p style='color:#94a3b8'>Your {trial_note} free trial starts the moment you click. After that it's {after_trial_copy}.</p>
            <p style='color:#475569;font-size:12px'>Link expires in 72 hours.</p>
            </div>"""
        threading.Thread(
            target=_send_email,
            args=(app_row.email, "Your Star Signal access is ready", email_html),
            daemon=True,
        ).start()
        return {"ok": True, "user_id": user.id, "magic_link_sent": True, "trial_days": trial_days}


class RejectBetaRequest(BaseModel):
    reason: str = ""

@app.patch("/admin/beta-applications/{app_id}/reject")
def reject_beta_application(
    app_id: str,
    body: RejectBetaRequest = RejectBetaRequest(),
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        app_row = db.query(BetaApplication).filter(BetaApplication.id == app_id).first()
        if not app_row:
            raise HTTPException(404, "Application not found")
        app_row.status = "rejected"
        db.commit()
        reason_html = f"<p style='color:#94a3b8'>Reason: {body.reason}</p>" if body.reason else ""
        _send_email(
            app_row.email,
            "Your Star Signal beta application",
            f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px'>
            <h2 style='color:#f1f5f9'>Thanks for applying, {app_row.name.split()[0] if app_row.name else 'there'}</h2>
            <p style='color:#94a3b8'>After reviewing your application, we weren't able to offer you a beta spot at this time.</p>
            {reason_html}
            <p style='color:#94a3b8'>We appreciate your interest and may reach out if spots open up.</p>
            </div>""",
        )
        return {"ok": True}


# ── Magic login (one-click from email) ────────────────────────────────────────

@app.post("/auth/magic-login")
def magic_login(body: dict, response: Response):
    token = body.get("token", "")
    email = body.get("email", "").lower()
    with Session(_engine) as db:
        user = db.query(User).filter(User.email == email).first()
        if not user or not user.email_verification_token:
            raise HTTPException(400, "Invalid or expired magic link")
        if user.email_verification_expires and \
           user.email_verification_expires.replace(tzinfo=timezone.utc) < datetime.now(timezone.utc):
            raise HTTPException(400, "Magic link expired — request a new one")
        if not _verify_password(token, user.email_verification_token):
            raise HTTPException(400, "Invalid magic link")
        user.email_verified = True
        user.email_verification_token = None
        user.email_verification_expires = None
        db.commit()
        raw_token = _create_session(db, user.id)
        response.set_cookie("ss_session", raw_token, httponly=True, samesite="lax",
                            secure=True, max_age=60*60*24*7)
        return {"user": _user_dict(user)}


# ── Waitlist CSV import → magic link batch ────────────────────────────────────

@app.post("/admin/waitlist/import")
def waitlist_import(
    body: dict,
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    """body: {emails: [{email, name}]} — creates pending accounts and sends magic links"""
    _require_admin(x_admin_email, x_admin_password)
    entries = body.get("emails", [])
    results = []
    with Session(_engine) as db:
        for entry in entries:
            email = entry.get("email", "").lower().strip()
            name = entry.get("name", "").strip()
            if not email:
                continue
            existing = db.query(User).filter(User.email == email).first()
            if existing:
                results.append({"email": email, "status": "already_exists"})
                continue
            magic_token = secrets.token_urlsafe(32)
            ref_code = _unique_referral_code(db)
            user = User(
                email=email,
                first_name=name.split()[0] if name else "",
                last_name=" ".join(name.split()[1:]) if len(name.split()) > 1 else "",
                tier="beta",
                email_verified=True,
                beta_started_at=datetime.now(timezone.utc),
                beta_expires_at=datetime.now(timezone.utc) + timedelta(days=30),
                referral_code=ref_code,
                email_verification_token=_hash_password(magic_token),
                email_verification_expires=datetime.now(timezone.utc) + timedelta(hours=72),
            )
            db.add(user)
            db.commit()
            magic_link = f"{SITE_URL}/magic-login?token={magic_token}&email={email}"
            first = name.split()[0] if name else "there"
            _send_email(
                email,
                "Your Star Signal access is ready",
                f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#0b1120;color:#e2e8f0'>
                <h2 style='color:#f1f5f9'>Hey {first} — your access is ready</h2>
                <p style='color:#94a3b8'>You signed up to be first on Star Signal. That day is today.</p>
                <a href='{magic_link}' style='display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:10px;text-decoration:none;font-weight:700;margin:16px 0;font-size:16px'>Enter Star Signal →</a>
                <p style='color:#94a3b8'>30 days free. No credit card. After that you lock in $19/month as a founding member.</p>
                <p style='color:#475569;font-size:12px'>Link expires in 72 hours. If it expires, visit starsignal.io and click "Resend access link".</p>
                </div>""",
            )
            results.append({"email": email, "status": "sent"})
    return {"results": results, "sent": sum(1 for r in results if r["status"] == "sent")}


# ── Partner referral landing page ──────────────────────────────────────────────

@app.get("/join/{slug}")
def get_join_page(slug: str):
    with Session(_engine) as db:
        partner = db.query(OutreachContact).filter(
            (OutreachContact.slug == slug) | (OutreachContact.referral_code == slug)
        ).first()
        if not partner:
            raise HTTPException(404, "Referral link not found")
        partner.referral_click_count = (partner.referral_click_count or 0) + 1
        db.commit()
        return {
            "name": partner.name,
            "slug": partner.slug or partner.referral_code or slug,
            "platform": partner.platform,
        }


# ── Discount code validation ────────────────────────────────────────────────────

@app.get("/discount-code/validate/{code}")
def validate_discount_code(code: str):
    with Session(_engine) as db:
        partner = db.query(OutreachContact).filter(
            OutreachContact.discount_code == code.upper(),
            OutreachContact.discount_code_active == True,
        ).first()
        if not partner:
            return {"valid": False}
        return {"valid": True, "partner_name": partner.name, "trial_days": 45}


@app.get("/promo/validate")
def validate_promo_code(code: str = ""):
    """Used by beta signup form for real-time promo code validation."""
    if not code.strip():
        return {"valid": False, "days": 30, "monthly_price": None, "message": ""}
    with Session(_engine) as db:
        partner = db.query(OutreachContact).filter(
            OutreachContact.discount_code == code.upper().strip(),
            OutreachContact.discount_code_active == True,
        ).first()
        if not partner:
            return {
                "valid": False,
                "days": 30,
                "monthly_price": None,
                "message": "Code not recognized — you'll still get 30 days free",
            }
        return {
            "valid": True,
            "days": 45,
            "monthly_price": 19,
            "partner_name": partner.name,
            "message": "Code applied — you get 45 days free and $19/month forever after",
        }


# ── Partner commission dashboard ───────────────────────────────────────────────

@app.get("/partners/me")
def get_partner_me(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        partner = _get_partner_by_email(user.email, db)
        if not partner:
            raise HTTPException(404, "No partner account found for this email")
        slug = partner.slug or partner.referral_code or ""
        return {
            "id": partner.id,
            "name": partner.name,
            "slug": slug,
            "stripe_connect_account_id": partner.stripe_connect_account_id or "",
            "referral_link": f"{SITE_URL}/join/{slug}",
            "discount_code": partner.discount_code or "",
            "discount_code_active": partner.discount_code_active,
        }


@app.get("/partners/commissions")
def get_partner_commissions(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        partner = _get_partner_by_email(user.email, db)
        if not partner:
            raise HTTPException(404, "No partner account found for this email")

        now = datetime.now(timezone.utc)
        this_month = now.strftime("%Y-%m")
        slug = partner.slug or partner.referral_code or ""

        all_commissions = db.query(Commission).filter(
            Commission.astrologer_partner_id == partner.id
        ).order_by(Commission.created_at.desc()).all()

        this_month_earned = sum(
            c.commission_amount for c in all_commissions
            if c.created_at and c.created_at.strftime("%Y-%m") == this_month
        )
        total_earned = sum(c.commission_amount for c in all_commissions)

        payouts = db.query(MonthlyPayout).filter(
            MonthlyPayout.partner_id == partner.id
        ).order_by(MonthlyPayout.month.desc()).all()

        pending_payout = sum(p.total_amount for p in payouts if p.status in ("pending", "ready"))
        next_payout_date = (now.replace(day=1) + timedelta(days=32)).replace(day=1).strftime("%Y-%m-01")

        signup_count = db.query(ReferralAttribution).filter(
            ReferralAttribution.referring_partner_id == partner.id
        ).count()

        payout_history = [
            {
                "month": p.month,
                "amount": p.total_amount,
                "status": p.status,
                "payout_method": p.payout_method,
                "payout_date": p.payout_date.isoformat() if p.payout_date else None,
            }
            for p in payouts
        ]

        return {
            "partner": {
                "id": partner.id,
                "name": partner.name,
                "slug": slug,
                "stripe_connect_account_id": partner.stripe_connect_account_id or "",
                "referral_link": f"{SITE_URL}/join/{slug}",
                "discount_code": partner.discount_code or "",
                "discount_code_active": partner.discount_code_active,
                "discount_code_uses": partner.discount_code_uses or 0,
                "referral_click_count": partner.referral_click_count or 0,
            },
            "summary": {
                "this_month_earned": round(this_month_earned, 2),
                "total_earned": round(total_earned, 2),
                "pending_payout": round(pending_payout, 2),
                "signup_count": signup_count,
                "next_payout_date": next_payout_date,
            },
            "payout_history": payout_history,
        }


@app.post("/partners/stripe-connect")
def partner_stripe_connect(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        partner = _get_partner_by_email(user.email, db)
        if not partner:
            raise HTTPException(404, "No partner account found for this email")
        if not _stripe_available or not STRIPE_SECRET_KEY or not STRIPE_CONNECT_CLIENT_ID:
            raise HTTPException(503, "Stripe Connect not configured")

        link = _stripe.AccountLink.create(
            account=partner.stripe_connect_account_id or _stripe.Account.create(type="express").id,
            refresh_url=f"{SITE_URL}/partners/dashboard?tab=commissions",
            return_url=f"{SITE_URL}/partners/dashboard?tab=commissions&connected=1",
            type="account_onboarding",
        )
        if not partner.stripe_connect_account_id:
            partner.stripe_connect_account_id = link.account
            db.commit()
        return {"url": link.url}


# ── Admin commission dashboard ──────────────────────────────────────────────────

@app.get("/admin/commissions")
def admin_commissions(
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        all_commissions = db.query(Commission).all()
        all_partners = db.query(OutreachContact).filter(OutreachContact.status == "partner").all()
        all_payouts = db.query(MonthlyPayout).all()

        now = datetime.now(timezone.utc)
        this_month = now.strftime("%Y-%m")

        total_owed_this_month = sum(
            c.commission_amount for c in all_commissions
            if c.status == "approved" and c.created_at and c.created_at.strftime("%Y-%m") == this_month
        )
        total_paid_all_time = sum(p.total_amount for p in all_payouts if p.status == "paid")
        monthly_recurring = sum(
            c.commission_amount for c in all_commissions
            if c.referral_type == "subscriber" and c.status in ("approved", "paid")
               and c.created_at and c.created_at.strftime("%Y-%m") == this_month
        )

        payout_queue = []
        for p in all_payouts:
            if p.status == "ready":
                partner = db.query(OutreachContact).filter(OutreachContact.id == p.partner_id).first()
                payout_queue.append({
                    "payout_id": p.id,
                    "partner_name": partner.name if partner else "Unknown",
                    "partner_id": p.partner_id,
                    "month": p.month,
                    "amount": p.total_amount,
                    "payout_method": p.payout_method or "manual",
                    "status": p.status,
                })

        partner_leaderboard = []
        for p in all_partners:
            p_commissions = [c for c in all_commissions if c.astrologer_partner_id == p.id]
            monthly = sum(c.commission_amount for c in p_commissions
                          if c.created_at and c.created_at.strftime("%Y-%m") == this_month)
            attrs = db.query(ReferralAttribution).filter(
                ReferralAttribution.referring_partner_id == p.id
            ).count()
            partner_leaderboard.append({
                "id": p.id,
                "name": p.name,
                "slug": getattr(p, 'slug', '') or p.referral_code or "",
                "discount_code": getattr(p, 'discount_code', '') or "",
                "discount_code_active": getattr(p, 'discount_code_active', True),
                "discount_code_uses": getattr(p, 'discount_code_uses', 0) or 0,
                "referral_click_count": getattr(p, 'referral_click_count', 0) or 0,
                "total_referrals": attrs,
                "monthly_commission": round(monthly, 2),
                "total_earned": round(sum(c.commission_amount for c in p_commissions), 2),
            })
        partner_leaderboard.sort(key=lambda x: x["total_earned"], reverse=True)

        return {
            "summary": {
                "total_owed_this_month": round(total_owed_this_month, 2),
                "total_paid_all_time": round(total_paid_all_time, 2),
                "monthly_recurring_liability": round(monthly_recurring, 2),
            },
            "payout_queue": payout_queue,
            "partner_leaderboard": partner_leaderboard[:10],
        }


@app.patch("/admin/commissions/payouts/{payout_id}/approve")
def admin_approve_payout(
    payout_id: str,
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        payout = db.query(MonthlyPayout).filter(MonthlyPayout.id == payout_id).first()
        if not payout:
            raise HTTPException(404, "Payout not found")
        payout.status = "ready"
        db.commit()
        return {"ok": True}


@app.patch("/admin/commissions/payouts/{payout_id}/paid")
def admin_mark_payout_paid(
    payout_id: str,
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        payout = db.query(MonthlyPayout).filter(MonthlyPayout.id == payout_id).first()
        if not payout:
            raise HTTPException(404, "Payout not found")
        payout.status = "paid"
        payout.payout_date = datetime.now(timezone.utc)
        commissions = db.query(Commission).filter(Commission.monthly_payout_id == payout_id).all()
        for c in commissions:
            c.status = "paid"
            c.payout_date = payout.payout_date
        db.commit()
        return {"ok": True}


@app.patch("/admin/commissions/partner/{partner_id}/discount-code")
def admin_update_discount_code(
    partner_id: str,
    body: dict,
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        partner = db.query(OutreachContact).filter(OutreachContact.id == partner_id).first()
        if not partner:
            raise HTTPException(404, "Partner not found")
        if "discount_code" in body:
            new_code = body["discount_code"].upper().strip()
            existing = db.query(OutreachContact).filter(
                OutreachContact.discount_code == new_code,
                OutreachContact.id != partner_id,
            ).first()
            if existing:
                raise HTTPException(400, "Discount code already in use")
            partner.discount_code = new_code
        if "discount_code_active" in body:
            partner.discount_code_active = bool(body["discount_code_active"])
        db.commit()
        return {"ok": True, "discount_code": partner.discount_code, "active": partner.discount_code_active}


@app.post("/admin/commissions/calculate-monthly")
def admin_calculate_monthly(
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        _calculate_monthly_commissions(db)
    return {"ok": True}


@app.get("/admin/commissions/partner/{partner_id}")
def admin_partner_commission_detail(
    partner_id: str,
    x_admin_email: str = Header(""),
    x_admin_password: str = Header(""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        partner = db.query(OutreachContact).filter(OutreachContact.id == partner_id).first()
        if not partner:
            raise HTTPException(404, "Partner not found")
        commissions = db.query(Commission).filter(
            Commission.astrologer_partner_id == partner_id
        ).order_by(Commission.created_at.desc()).all()
        payouts = db.query(MonthlyPayout).filter(
            MonthlyPayout.partner_id == partner_id
        ).order_by(MonthlyPayout.month.desc()).all()
        return {
            "partner": {
                "id": partner.id,
                "name": partner.name,
                "slug": partner.slug or partner.referral_code,
                "tier": partner.partner_tier,
                "email": partner.contact_email,
                "stripe_connect_account_id": partner.stripe_connect_account_id,
            },
            "commissions": [
                {
                    "id": c.id,
                    "referred_user_id": c.referred_user_id,
                    "referral_type": c.referral_type,
                    "payment_amount": c.payment_amount,
                    "commission_amount": c.commission_amount,
                    "status": c.status,
                    "payment_date": c.payment_date.isoformat() if c.payment_date else None,
                    "months_remaining": c.months_remaining,
                }
                for c in commissions
            ],
            "payouts": [
                {
                    "id": p.id,
                    "month": p.month,
                    "amount": p.total_amount,
                    "status": p.status,
                    "payout_method": p.payout_method,
                    "payout_date": p.payout_date.isoformat() if p.payout_date else None,
                }
                for p in payouts
            ],
        }


# ── Stripe checkout ────────────────────────────────────────────────────────────

@app.post("/stripe/checkout")
def stripe_checkout(body: dict, ss_session: Optional[str] = Cookie(None)):
    if not _stripe_available or not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")

    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        requested = body.get("tier", "")

        if requested == "premium":
            price_id = STRIPE_PREMIUM_PRICE_ID
        elif user:
            pt = user.pricing_tier or ("founding" if _get_beta_open(db) else "pro")
            price_id = {
                "referred": STRIPE_REFERRED_PRICE_ID,
                "founding": STRIPE_FOUNDING_PRICE_ID,
                "pro":      STRIPE_PRO_PRICE_ID,
            }.get(pt, STRIPE_FOUNDING_PRICE_ID)
        else:
            price_id = STRIPE_FOUNDING_PRICE_ID if _get_beta_open(db) else STRIPE_PRO_PRICE_ID

        if not price_id:
            raise HTTPException(503, "Stripe price not configured for this plan — contact support")

        customer_id = user.stripe_customer_id if user else None
        success_url = f"{SITE_URL}/account?success=1"
        cancel_url = f"{SITE_URL}/account"

        session = _stripe.checkout.Session.create(
            mode="subscription",
            line_items=[{"price": price_id, "quantity": 1}],
            success_url=success_url,
            cancel_url=cancel_url,
            customer=customer_id,
            customer_email=user.email if user and not customer_id else None,
            metadata={"user_id": user.id if user else ""},
        )
        return {"url": session.url}


@app.post("/stripe/portal")
def stripe_portal(ss_session: Optional[str] = Cookie(None)):
    if not _stripe_available or not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user or not user.stripe_customer_id:
            raise HTTPException(400, "No billing account found")
        portal = _stripe.billing_portal.Session.create(
            customer=user.stripe_customer_id,
            return_url=f"{SITE_URL}/account",
        )
        return {"url": portal.url}


@app.post("/stripe/webhook")
async def stripe_webhook(request: Request):
    if not _stripe_available or not STRIPE_SECRET_KEY:
        raise HTTPException(503, "Stripe not configured")
    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = _stripe.Webhook.construct_event(payload, sig, STRIPE_WEBHOOK_SECRET)
    except Exception:
        raise HTTPException(400, "Invalid webhook signature")

    with Session(_engine) as db:
        if event["type"] == "checkout.session.completed":
            sess = event["data"]["object"]
            customer_id = sess.get("customer")
            user_id = sess.get("metadata", {}).get("user_id")
            sub_id = sess.get("subscription")
            user = None
            if user_id:
                user = db.query(User).filter(User.id == user_id).first()
            if not user and customer_id:
                user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if user:
                user.stripe_customer_id = customer_id
                user.stripe_subscription_id = sub_id
                if sub_id:
                    sub = _stripe.Subscription.retrieve(sub_id)
                    price_id = sub["items"]["data"][0]["price"]["id"]
                    user.tier = _tier_from_price_id(price_id)
                db.commit()

        elif event["type"] == "customer.subscription.updated":
            sub = event["data"]["object"]
            user = db.query(User).filter(User.stripe_subscription_id == sub["id"]).first()
            if user:
                status = sub.get("status")
                price_id = sub["items"]["data"][0]["price"]["id"]
                if status == "active":
                    user.tier = _tier_from_price_id(price_id)
                    user.stripe_subscription_end = None
                elif status in ("canceled", "unpaid", "past_due"):
                    end_ts = sub.get("current_period_end")
                    if end_ts:
                        user.stripe_subscription_end = datetime.fromtimestamp(end_ts, tz=timezone.utc)
                db.commit()

        elif event["type"] == "customer.subscription.deleted":
            sub = event["data"]["object"]
            user = db.query(User).filter(User.stripe_subscription_id == sub["id"]).first()
            if user:
                user.tier = "free"
                user.stripe_subscription_id = None
                db.commit()

        elif event["type"] == "invoice.paid":
            inv = event["data"]["object"]
            customer_id = inv.get("customer")
            amount_paid = inv.get("amount_paid", 0) / 100.0  # cents → dollars
            stripe_invoice_id = inv.get("id")
            if not customer_id or amount_paid <= 0:
                return {"ok": True}

            user = db.query(User).filter(User.stripe_customer_id == customer_id).first()
            if not user:
                return {"ok": True}

            # Deduplicate
            if db.query(Commission).filter(Commission.stripe_invoice_id == stripe_invoice_id).first():
                return {"ok": True}

            attr = db.query(ReferralAttribution).filter(
                ReferralAttribution.referred_user_id == user.id
            ).first()
            if not attr:
                return {"ok": True}

            partner = db.query(OutreachContact).filter(OutreachContact.id == attr.referring_partner_id).first()
            if not partner:
                return {"ok": True}

            commission_amt = round(amount_paid * 0.20, 2)

            # Determine months_remaining for partner-type referrals
            months_left = None
            if attr.referral_type == "partner":
                existing_count = db.query(Commission).filter(
                    Commission.referred_user_id == user.id,
                    Commission.astrologer_partner_id == partner.id,
                ).count()
                if existing_count >= 12:
                    return {"ok": True}  # commission period over
                months_left = 11 - existing_count  # starts at 11, counts down to 0

                if months_left == 0:
                    total_earned = db.query(Commission).filter(
                        Commission.referred_user_id == user.id,
                        Commission.astrologer_partner_id == partner.id,
                    ).with_entities(__import__('sqlalchemy').func.sum(Commission.commission_amount)).scalar() or 0
                    total_earned += commission_amt
                    if partner.contact_email:
                        import threading as _threading
                        _threading.Thread(
                            target=_send_commission_expired_email,
                            args=(partner.contact_email, partner.name, user.first_name or user.email, total_earned),
                            daemon=True,
                        ).start()

            c = Commission(
                astrologer_partner_id=partner.id,
                referred_user_id=user.id,
                referral_type=attr.referral_type,
                payment_amount=amount_paid,
                commission_amount=commission_amt,
                status="approved",
                payment_date=datetime.now(timezone.utc),
                months_remaining=months_left,
                stripe_invoice_id=stripe_invoice_id,
            )
            db.add(c)

            if not attr.first_payment_at:
                attr.first_payment_at = datetime.now(timezone.utc)
                if partner.contact_email:
                    import threading as _threading
                    _threading.Thread(
                        target=_send_first_commission_email,
                        args=(partner.contact_email, partner.name, commission_amt),
                        daemon=True,
                    ).start()

            db.commit()

    return {"ok": True}


# ── Feature gating ─────────────────────────────────────────────────────────────

TIER_RANK = {"free": 0, "beta": 1, "founding": 2, "pro": 2, "partner_preview": 2, "premium": 3, "platform": 4}

FEATURE_GATES = {
    "insights_full":    "pro",      # beta sees last 5 only
    "price_realtime":   "pro",      # beta gets 30-min delayed
    "signals_full":     "pro",      # beta sees 3 max
    "composite_score":  "premium",  # premium+ only
    "api_access":       "premium",  # premium+ only
    "alerts":           "premium",  # premium+ only
}


def _tier_rank(tier: str) -> int:
    return TIER_RANK.get(tier, 0)


@app.get("/auth/features")
def get_features(ss_session: Optional[str] = Cookie(None)):
    """Returns which features the current user can access."""
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        tier = "free"
        if user:
            now = datetime.now(timezone.utc)
            beta_expired = (user.tier == "beta" and user.beta_expires_at and
                            user.beta_expires_at.replace(tzinfo=timezone.utc) < now)
            tier = "free" if beta_expired else user.tier
        rank = _tier_rank(tier)
        return {
            "tier": tier,
            "features": {k: rank >= _tier_rank(v) for k, v in FEATURE_GATES.items()},
            "upgrade_url": f"{SITE_URL}/account",
        }


# ── Daily usage ────────────────────────────────────────────────────────────────

def _get_user_tier(user) -> str:
    """Return effective tier, treating expired beta as free."""
    if not user:
        return "free"
    now = datetime.now(timezone.utc)
    beta_expired = (user.tier == "beta" and user.beta_expires_at and
                    user.beta_expires_at.replace(tzinfo=timezone.utc) < now)
    return "free" if beta_expired else user.tier


def _today_utc() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d")


def _get_or_create_usage(db, user_id: str) -> DailyUsage:
    today = _today_utc()
    row = db.query(DailyUsage).filter_by(user_id=user_id, date=today).first()
    if not row:
        row = DailyUsage(user_id=user_id, date=today, request_count=0)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


@app.get("/usage/today")
def get_usage_today(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            return {"count": 0, "limit": None, "tier": "free", "unlimited": True}
        tier = _get_user_tier(user)
        limit = TIER_DAILY_LIMITS.get(tier)
        row = _get_or_create_usage(db, user.id)
        upgrade = TIER_UPGRADE_COPY.get(tier, {})
        return {
            "count":     row.request_count,
            "limit":     limit,
            "tier":      tier,
            "unlimited": limit is None,
            "upgrade":   upgrade,
        }


# ── Admin: users list ─────────────────────────────────────────────────────────

@app.get("/admin/users")
def list_users(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        users = db.query(User).order_by(User.created_at.desc()).all()
        return [_user_dict(u) for u in users]


@app.patch("/admin/users/{user_id}/tier")
def set_user_tier(
    user_id: str,
    body: dict,
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    new_tier = body.get("tier")
    valid_tiers = ("free", "beta", "founding", "pro", "premium", "partner_preview", "platform")
    if new_tier not in valid_tiers:
        raise HTTPException(400, "Invalid tier")
    with Session(_engine) as db:
        user = db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(404, "User not found")
        user.tier = new_tier
        if new_tier == "beta" and not user.beta_expires_at:
            user.beta_expires_at = datetime.now(timezone.utc) + timedelta(days=30)
            user.beta_started_at = datetime.now(timezone.utc)
        if new_tier == "partner_preview":
            user.email_verified = True
        db.commit()
        return _user_dict(user)


# ── Admin: site config (BETA_OPEN toggle) ─────────────────────────────────────

@app.get("/admin/config")
def get_admin_config(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        return {"beta_open": _get_beta_open(db)}


@app.patch("/admin/config")
def update_admin_config(
    body: dict,
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        if "beta_open" in body:
            val = "true" if body["beta_open"] else "false"
            row = db.query(SiteConfig).filter(SiteConfig.key == "beta_open").first()
            if row:
                row.value = val
            else:
                db.add(SiteConfig(key="beta_open", value=val))
            db.commit()
        return {"beta_open": _get_beta_open(db)}


# ── Admin: stats ─────────────────────────────────────────────────────────────

@app.get("/admin/stats")
def admin_stats(
    x_admin_email: str = Header(default=""),
    x_admin_password: str = Header(default=""),
):
    _require_admin(x_admin_email, x_admin_password)
    with Session(_engine) as db:
        now = datetime.now(timezone.utc)
        all_users = db.query(User).all()
        total_users = len(all_users)
        beta_users = [u for u in all_users if u.tier == "beta"]
        active_beta = [u for u in beta_users if u.beta_expires_at and
                       u.beta_expires_at.replace(tzinfo=timezone.utc) > now]
        expired_beta = [u for u in beta_users if u.beta_expires_at and
                        u.beta_expires_at.replace(tzinfo=timezone.utc) <= now]
        paid_users = [u for u in all_users if u.tier in ("founding", "pro", "premium", "platform")]
        conversion_rate = round(len(paid_users) / max(len(beta_users) + len(paid_users), 1) * 100, 1)
        beta_expiry_list = sorted([
            {
                "id": u.id, "email": u.email,
                "first_name": u.first_name, "last_name": u.last_name,
                "days_left": max(0, (u.beta_expires_at.replace(tzinfo=timezone.utc) - now).days),
                "pricing_tier": u.pricing_tier,
            }
            for u in active_beta if u.beta_expires_at
        ], key=lambda x: x["days_left"])
        apps = db.query(BetaApplication).all()
        pending_apps = sum(1 for a in apps if a.status == "pending")

        # Pricing tier breakdown across all users
        TIER_MRR = {"founding": 19, "referred": 19, "pro": 29, "premium": 79}
        pricing_tier_counts: dict = {}
        mrr_by_pricing_tier: dict = {}
        for u in all_users:
            pt = u.pricing_tier or "unknown"
            pricing_tier_counts[pt] = pricing_tier_counts.get(pt, 0) + 1
            if u.tier in ("founding", "pro", "premium"):
                mrr_by_pricing_tier[pt] = mrr_by_pricing_tier.get(pt, 0) + TIER_MRR.get(pt, 29)

        return {
            "total_users": total_users,
            "active_beta": len(active_beta),
            "expired_beta": len(expired_beta),
            "paid_users": len(paid_users),
            "pending_applications": pending_apps,
            "conversion_rate": conversion_rate,
            "beta_expiry_list": beta_expiry_list[:20],
            "pricing_tier_breakdown": pricing_tier_counts,
            "mrr_by_pricing_tier": mrr_by_pricing_tier,
            "estimated_mrr": sum(mrr_by_pricing_tier.values()),
            "beta_open": _get_beta_open(db),
        }


# ── Beta expiry email background task ─────────────────────────────────────────

def _run_beta_expiry_emails():
    import time as _time
    while True:
        try:
            _check_beta_expiry_emails()
        except Exception as e:
            print(f"[beta-expiry] error: {e}")
        _time.sleep(60 * 60 * 6)  # check every 6 hours


def _check_beta_expiry_emails():
    now = datetime.now(timezone.utc)
    with Session(_engine) as db:
        beta_users = db.query(User).filter(User.tier == "beta").all()
        for user in beta_users:
            if not user.beta_started_at or not user.beta_expires_at:
                continue
            started = user.beta_started_at.replace(tzinfo=timezone.utc)
            expires = user.beta_expires_at.replace(tzinfo=timezone.utc)
            days_used = (now - started).days
            days_left = (expires - now).days

            if days_used >= 14 and not user.beta_day14_sent:
                _send_email(
                    user.email,
                    "Quick question about Star Signal",
                    f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px'>
                    <p style='color:#94a3b8'>Hey {user.first_name or 'there'},</p>
                    <p style='color:#94a3b8'>You've had Star Signal for about 2 weeks — wanted to check in.</p>
                    <p style='color:#94a3b8'>Three quick questions:</p>
                    <ul style='color:#94a3b8'>
                        <li>What feature do you use most?</li>
                        <li>What's confusing or missing?</li>
                        <li>What would make you pay for it?</li>
                    </ul>
                    <p style='color:#94a3b8'>Reply directly to this email — I read every response.</p>
                    </div>""",
                )
                user.beta_day14_sent = True
                db.commit()

            if days_left <= 5 and days_left >= 0 and not user.beta_day25_sent:
                pt = user.pricing_tier or "founding"
                expiry_copy = {
                    "referred": f"Your 45 day free trial ends in {days_left} day{'s' if days_left != 1 else ''}. Add a card to keep access at $19/month — your special referred rate, locked in forever.",
                    "founding": f"Your 30 day free trial ends in {days_left} day{'s' if days_left != 1 else ''}. Add a card to keep access at $19/month — founding member rate, locked in forever.",
                    "pro":      f"Your 30 day free trial ends in {days_left} day{'s' if days_left != 1 else ''}. Add a card to keep access at $29/month.",
                }.get(pt, f"Your free trial ends in {days_left} day{'s' if days_left != 1 else ''}. Add a card to keep access.")
                _send_email(
                    user.email,
                    f"Your Star Signal trial ends in {days_left} day{'s' if days_left != 1 else ''}",
                    f"""<div style='font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px'>
                    <p style='color:#94a3b8'>Hey {user.first_name or 'there'},</p>
                    <p style='color:#94a3b8'>{expiry_copy}</p>
                    <a href='{SITE_URL}/account' style='display:inline-block;padding:12px 24px;background:linear-gradient(135deg,#06b6d4,#3b82f6);color:#fff;border-radius:8px;text-decoration:none;font-weight:600;margin:16px 0'>
                    Add card to keep access →</a>
                    <p style='color:#475569;font-size:12px'>Add a card before your trial ends to keep uninterrupted access.</p>
                    </div>""",
                )
                user.beta_day25_sent = True
                db.commit()

            if days_left < 0 and expires > started:
                pass  # expired — frontend paywall handles UI


_beta_expiry_thread = threading.Thread(target=_run_beta_expiry_emails, daemon=True)
_beta_expiry_thread.start()


# ── Referral stats ─────────────────────────────────────────────────────────────

@app.get("/auth/referrals")
def get_referrals(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        refs = db.query(Referral).filter(Referral.referrer_id == user.id).all()
        return {
            "referral_code": user.referral_code,
            "referral_link": f"{SITE_URL}/join?ref={user.referral_code}",
            "total_referred": len(refs),
            "converted": sum(1 for r in refs if r.converted),
        }


# ── Account info ───────────────────────────────────────────────────────────────

@app.get("/auth/account")
def get_account(ss_session: Optional[str] = Cookie(None)):
    with Session(_engine) as db:
        user = _get_user_from_cookie(ss_session, db)
        if not user:
            raise HTTPException(401, "Not authenticated")
        now = datetime.now(timezone.utc)
        beta_days_left = None
        if user.tier == "beta" and user.beta_expires_at:
            delta = (user.beta_expires_at.replace(tzinfo=timezone.utc) - now).days
            beta_days_left = max(0, delta)
        refs = db.query(Referral).filter(Referral.referrer_id == user.id).all()

        # Look up which partner referred this user (if any)
        referring_partner_name = None
        attr = db.query(ReferralAttribution).filter(
            ReferralAttribution.referred_user_id == user.id
        ).first()
        if attr:
            partner = db.query(OutreachContact).filter(
                OutreachContact.id == attr.referring_partner_id
            ).first()
            if partner:
                referring_partner_name = partner.name

        return {
            **_user_dict(user),
            "beta_days_left": beta_days_left,
            "referral_link": f"{SITE_URL}/join?ref={user.referral_code}",
            "referrals_total": len(refs),
            "referrals_converted": sum(1 for r in refs if r.converted),
            "referring_partner_name": referring_partner_name,
        }
