# Release Notes — May 10, 2026

## New Features

### Company Incorporation Date Lookup (Natal Chart Data)
The AI now automatically fetches the founding/incorporation date for any ticker before generating analysis — no more asking the user for it. For stocks, it queries the SEC EDGAR API (`data.sec.gov/submissions/`) via the company's CIK. For crypto, a built-in genesis-date map covers BTC, ETH, SOL, XRP, DOGE, and 10+ others.

This date is silently injected into:
- **Symbol search (`/analyze`)** — appended to the `astro_block` as a `## Natal Chart Data` section.
- **Astro chat widget (`/astro/ticker-summary`)** — prepended to the system context so Claude references active planetary cycles in its response.

Claude is instructed to compute active cycles based on elapsed years (Jupiter=11.9yr, Saturn=29.5yr, Uranus opposition=42yr, Chiron return=50.7yr, Uranus return=84yr) and weave the timing naturally into responses without mentioning that the date was provided.

Backend endpoints added:
- `GET /admin/company-info?symbol=AAPL` — lookup a single symbol (EDGAR + crypto map)
- `POST /admin/company-info/batch` — batch lookup `{ "symbols": [...] }`
- `DELETE /admin/company-info/cache` — clear the in-memory lookup cache
- `POST /admin/natal-analysis` — run a full natal planetary cycle analysis via Claude for a given symbol

### Claude Prompts Viewer (Admin)
A new admin page at `/admin/prompts` shows all Claude system and user prompts used in the pipeline. Click any prompt to expand it and see the full text. Prompts are color-coded by role (system / template / user). Covers:
1. Insight extraction (batch)
2. Insight verification
3. Astro chat (ticker-summary widget)
4. Natal analysis

Backend: `GET /admin/prompts` (requires admin email + password headers).

## UI Changes

### Astro Outlook Label
The subtitle under the `♅ {ticker} Astrological Outlook` heading in `AstroInsightsPanel` now reads:
> *(AI generated from all astrologers insights and incorporation date)*

File: `frontend/src/components/AstroInsightsPanel.jsx` line 549.

## Bug Fixes

### Google OAuth — Staging Cross-Origin Session Cookie
After fixing the OAuth redirect URI for staging, login succeeded but the session cookie (`ss_session`) was silently dropped by the browser because the backend (Railway domain) and frontend (starsignal.io domain) are different same-site groups.

Fix: all 5 `set_cookie("ss_session")` calls now read `samesite` from a `COOKIE_SAMESITE` env var (default `lax` for production, `none` for staging). With `samesite=none` + `secure=true`, the cookie is sent cross-origin as required. Railway staging env var `COOKIE_SAMESITE=none` is set.

### Google OAuth — Staging Redirect URI
The staging backend was using `BACKEND_URL` (which pointed to the prod backend) for the OAuth `redirect_uri`. Fixed with a `GOOGLE_OAUTH_REDIRECT_URI` env var that can be set independently of `BACKEND_URL`. Railway staging vars:
- `GOOGLE_OAUTH_REDIRECT_URI=https://ai-trading-backend-staging.up.railway.app/auth/oauth/google/callback`
- `SITE_URL=https://staging.starsignal.io`

---

# Release Notes — May 9, 2026

## New Features

### Google Sign-In
Users can now log in or create an account using their Google account. A "Continue with Google" button appears on both the login and signup pages. New accounts created via Google are automatically placed on the beta tier. Existing accounts with a matching email are linked automatically, and the user's name is pulled from Google if it wasn't previously set.

### Fundamental Analysis (Stocks)
A new Fundamentals card now appears for stock tickers alongside the existing technical analysis. It shows:
- Revenue, Net Income, and Free Cash Flow (trailing twelve months)
- Revenue growth year-over-year
- Gross, operating, and net profit margins
- Debt-to-equity ratio and current ratio
- Earnings history with EPS actuals vs. estimates and surprise %
- Annual revenue trend chart (last 4 years)
- A health score (0–10) summarizing overall financial strength
- A written fundamentals analysis from the AI alongside the existing technical analysis

Data is sourced from Financial Datasets and cached for 6 hours since fundamentals update quarterly.

## Bug Fixes

- **Stock analysis prompt** — Stock tickers were incorrectly receiving the crypto analysis prompt. Fixed so stocks and crypto each get the correct context.
- **OAuth redirect after login** — After signing in with Google, users were landing on the wrong domain (raw Vercel URL instead of starsignal.io). Fixed to always redirect to the main site.
- **Astro insights fallback** — When no astro insight matched a stock ticker, the fallback was pulling from all categories including oil/commodities. Fixed to only pull from the stock market, tech, banking, and currency pool.
