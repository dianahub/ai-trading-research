"""
Senate EFD (Electronic Financial Disclosures) scraper.

Scrapes efdsearch.senate.gov to get Periodic Transaction Reports (PTRs)
and indexes them by ticker so we can answer per-ticker queries quickly.

Data is loaded once per day in a background thread. On first startup,
the cache warms up in roughly 2-3 minutes (60+ reports × 1s rate limit).
"""

import time
import threading
import requests
from bs4 import BeautifulSoup
from typing import Dict, List

ROOT = "https://efdsearch.senate.gov"
LANDING = f"{ROOT}/search/home/"
REPORTS_URL = f"{ROOT}/search/report/data/"
SEARCH_URL = f"{ROOT}/search/"
PDF_PREFIX = "/search/view/paper/"

_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36"

_cache_lock = threading.Lock()
_trades_by_ticker: Dict[str, List[dict]] = {}
_cache_loaded_at: float = 0.0
_loading = False

CACHE_TTL = 24 * 60 * 60  # 24 hours
RATE_LIMIT = 1.0           # seconds between requests
LOOKBACK_DAYS = 180        # how far back to search (about 6 months)


def _make_session() -> requests.Session:
    s = requests.Session()
    s.headers.update({"User-Agent": _UA})
    # GET landing page for CSRF token
    r = s.get(LANDING, timeout=20)
    soup = BeautifulSoup(r.text, "html.parser")
    csrf_input = soup.find("input", {"name": "csrfmiddlewaretoken"})
    if not csrf_input:
        raise RuntimeError("Could not find CSRF token on Senate EFD landing page")
    csrf = csrf_input["value"]
    # POST agreement to landing page — establishes session
    s.post(
        LANDING,
        data={"csrfmiddlewaretoken": csrf, "prohibition_agreement": "1"},
        headers={"Referer": LANDING},
        timeout=20,
    )
    return s


def _fetch_ptr_list(s: requests.Session, lookback_days: int = LOOKBACK_DAYS) -> List[List[str]]:
    csrf = s.cookies.get("csrftoken", "")
    from datetime import datetime, timedelta
    start_date = (datetime.now() - timedelta(days=lookback_days)).strftime("%m/%d/%Y 00:00:00")

    all_rows: List[List[str]] = []
    offset = 0
    while True:
        r = s.post(
            REPORTS_URL,
            data={
                "start": str(offset),
                "length": "100",
                "report_types": "[11]",
                "filer_types": "[]",
                "submitted_start_date": start_date,
                "submitted_end_date": "",
                "csrfmiddlewaretoken": csrf,
            },
            headers={"Referer": SEARCH_URL, "X-Requested-With": "XMLHttpRequest"},
            timeout=20,
        )
        data = r.json()
        rows = data.get("data", [])
        all_rows.extend(rows)
        if len(all_rows) >= data.get("recordsTotal", 0) or not rows:
            break
        offset += 100
        time.sleep(RATE_LIMIT)

    return all_rows


def _parse_ptr(s: requests.Session, link: str, first: str, last: str, date_filed: str) -> List[dict]:
    if link.startswith(PDF_PREFIX):
        return []
    try:
        r = s.get(f"{ROOT}{link}", timeout=20)
        if r.status_code != 200:
            return []
        # Check if redirected back to landing (session expired)
        if r.url == LANDING:
            return []
        soup = BeautifulSoup(r.text, "html.parser")
        tbodies = soup.find_all("tbody")
        if not tbodies:
            return []

        trades = []
        for tr in tbodies[0].find_all("tr"):
            cols = [c.get_text(strip=True) for c in tr.find_all("td")]
            if len(cols) < 8:
                continue
            tx_date = cols[1]
            ticker = cols[3].strip()
            asset_name = cols[4]
            asset_type = cols[5]
            order_type = cols[6]
            amount = cols[7]

            if not ticker or ticker == "--":
                continue
            if asset_type not in ("Stock", "Stock Option"):
                continue

            trades.append({
                "member":     f"{first} {last}".strip(),
                "chamber":    "Senate",
                "trade_type": "buy" if "purchase" in order_type.lower() else "sell",
                "amount":     amount,
                "tx_date":    tx_date,
                "disclosed":  date_filed,
                "asset":      asset_name,
                "ticker":     ticker,
                "link":       f"{ROOT}{link}",
            })
        return trades
    except Exception as e:
        print(f"[congress_senate] Error parsing {link}: {e}", flush=True)
        return []


def _load_cache() -> None:
    global _trades_by_ticker, _cache_loaded_at, _loading
    try:
        _loading = True
        print("[congress_senate] Starting Senate PTR cache load…", flush=True)
        s = _make_session()
        rows = _fetch_ptr_list(s)
        print(f"[congress_senate] {len(rows)} PTR reports found", flush=True)

        by_ticker: Dict[str, List[dict]] = {}
        for i, row in enumerate(rows):
            first, last, _role, link_html, date_filed = row
            link_soup = BeautifulSoup(link_html, "html.parser")
            a = link_soup.find("a")
            if not a:
                continue
            link = a.get("href", "")
            trades = _parse_ptr(s, link, first, last, date_filed)
            for trade in trades:
                t = trade["ticker"].upper()
                by_ticker.setdefault(t, []).append(trade)
            if i % 10 == 0:
                print(f"[congress_senate] Processed {i+1}/{len(rows)} reports ({len(by_ticker)} tickers so far)", flush=True)
            time.sleep(RATE_LIMIT)

        with _cache_lock:
            _trades_by_ticker = by_ticker
            _cache_loaded_at = time.time()
        print(f"[congress_senate] Cache ready: {len(by_ticker)} unique tickers across {len(rows)} reports", flush=True)
    except Exception as e:
        print(f"[congress_senate] Cache load failed: {e}", flush=True)
    finally:
        _loading = False


def _maybe_refresh() -> None:
    global _loading
    now = time.time()
    with _cache_lock:
        age = now - _cache_loaded_at
    if age > CACHE_TTL and not _loading:
        t = threading.Thread(target=_load_cache, daemon=True)
        t.start()


def start_background_load() -> None:
    """Kick off the initial cache load. Call once at app startup."""
    global _loading
    if not _loading and _cache_loaded_at == 0:
        t = threading.Thread(target=_load_cache, daemon=True)
        t.start()


def get_trades_for_ticker(ticker: str) -> List[dict]:
    """Return Senate trades for a ticker, sorted newest-first."""
    _maybe_refresh()
    with _cache_lock:
        trades = list(_trades_by_ticker.get(ticker.upper(), []))
    # Sort by tx_date descending
    from datetime import datetime
    def _key(x):
        try:
            return datetime.strptime(x.get("tx_date", "")[:10], "%m/%d/%Y")
        except Exception:
            return datetime.min
    trades.sort(key=_key, reverse=True)
    return trades


def is_ready() -> bool:
    return _cache_loaded_at > 0
