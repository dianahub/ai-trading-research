"""
CoinGecko API client with in-memory caching, exponential-backoff retry,
and request throttling.

Features
--------
- In-memory cache with per-call TTLs (price: 60 s, market/detail: 5 min, search: 15 min)
- Retries up to 3 times on 429 with 2 / 4 / 8-second backoff
- Serves stale cache when all retries fail rather than crashing the caller
- Throttles to ≤ 10 requests per 60-second window (free-tier limit)
- Optional Pro API support: set COINGECKO_API_KEY in the environment to use
  https://pro-api.coingecko.com with a much higher rate limit
"""

import json
import os
import time
import threading
from collections import deque

import requests

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

FREE_BASE_URL = "https://api.coingecko.com/api/v3"
PRO_BASE_URL  = "https://pro-api.coingecko.com/api/v3"

# Demo keys (free tier) start with "CG-" and use the standard URL
# with x-cg-demo-api-key header.  Paid Pro keys use the pro URL
# with x-cg-pro-api-key header.

# Cache TTLs (seconds)
PRICE_TTL  = 60    # /coins/markets, /simple/price — refresh every minute
MARKET_TTL = 300   # /coins/{id}/market_chart, /coins/{id} — refresh every 5 min
SEARCH_TTL = 900   # /search — coin IDs rarely change; refresh every 15 min

_MAX_RETRIES  = 3
_BACKOFF_SECS = (2, 4, 8)   # wait before attempt 1, 2, 3
_RATE_LIMIT   = 10           # max requests per 60-second rolling window


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class CoinGeckoError(Exception):
    """
    Raised when CoinGecko is unreachable and no cached data is available.
    Callers should catch this and return a graceful error to the user.
    """


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class CoinGeckoClient:
    """Thread-safe CoinGecko client with caching, retry, and rate throttling."""

    def __init__(self) -> None:
        api_key = os.getenv("COINGECKO_API_KEY", "").strip()
        # Demo keys start with "CG-" → standard URL + x-cg-demo-api-key header
        # Pro keys (paid) → pro URL + x-cg-pro-api-key header
        if not api_key:
            self._base_url = FREE_BASE_URL
            self._headers: dict[str, str] = {}
        elif api_key.startswith("CG-"):
            self._base_url = FREE_BASE_URL
            self._headers = {"x-cg-demo-api-key": api_key}
        else:
            self._base_url = PRO_BASE_URL
            self._headers = {"x-cg-pro-api-key": api_key}

        # key → (data, expires_at_unix_timestamp)
        self._cache: dict[str, tuple[object, float]] = {}

        # Rolling window of request timestamps for rate limiting
        self._req_times: deque[float] = deque()
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get(
        self,
        path: str,
        params: dict | None = None,
        ttl: int = PRICE_TTL,
    ) -> object:
        """
        GET ``path`` from CoinGecko with caching and retry.

        Returns fresh cache immediately if available.  On 429 (or any
        transient failure) retries up to 3 times with 2 / 4 / 8-second
        backoff.  If all retries are exhausted, returns stale cache if
        any exists, otherwise raises ``CoinGeckoError``.

        :param path:   URL path, e.g. ``"/coins/markets"``
        :param params: Query-string parameters dict
        :param ttl:    Cache lifetime in seconds
        """
        key = _cache_key(path, params)
        cached_val, expires_at = self._cache.get(key, (None, 0.0))

        # Serve fresh cache
        if cached_val is not None and time.time() < expires_at:
            return cached_val

        last_err: Exception | None = None

        for attempt in range(_MAX_RETRIES + 1):
            # Exponential backoff before each retry (not before the first attempt)
            if attempt:
                time.sleep(_BACKOFF_SECS[attempt - 1])

            self._throttle()

            try:
                resp = requests.get(
                    f"{self._base_url}{path}",
                    params=params,
                    headers=self._headers,
                    timeout=15,
                )

                if resp.status_code == 429:
                    last_err = CoinGeckoError("429 Too Many Requests")
                    continue  # retry with backoff

                resp.raise_for_status()
                data = resp.json()
                self._cache[key] = (data, time.time() + ttl)
                return data

            except CoinGeckoError:
                raise
            except Exception as exc:
                last_err = exc
                # Don't retry on permanent 4xx errors (but do retry 429 via the branch above)
                if isinstance(exc, requests.HTTPError) and exc.response is not None:
                    if 400 <= exc.response.status_code < 500:
                        break

        # All attempts exhausted — serve stale data rather than crashing
        if cached_val is not None:
            return cached_val

        raise CoinGeckoError(
            f"CoinGecko unavailable after {_MAX_RETRIES} retries: {last_err}"
        )

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _throttle(self) -> None:
        """Block until we are below the 10-requests-per-minute cap."""
        with self._lock:
            now    = time.time()
            cutoff = now - 60.0

            # Evict timestamps outside the rolling window
            while self._req_times and self._req_times[0] < cutoff:
                self._req_times.popleft()

            if len(self._req_times) >= _RATE_LIMIT:
                # Wait until the oldest request leaves the 60-second window
                sleep_for = 60.0 - (now - self._req_times[0])
                if sleep_for > 0:
                    time.sleep(sleep_for)
                # Re-prune after sleeping
                now    = time.time()
                cutoff = now - 60.0
                while self._req_times and self._req_times[0] < cutoff:
                    self._req_times.popleft()

            self._req_times.append(time.time())


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _cache_key(path: str, params: dict | None) -> str:
    if not params:
        return path
    return f"{path}?{json.dumps(sorted(params.items()), separators=(',', ':'))}"


# ---------------------------------------------------------------------------
# Module-level singleton — shared across all FastAPI request handlers
# ---------------------------------------------------------------------------

coingecko = CoinGeckoClient()
