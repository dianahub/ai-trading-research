"""
One-time script to generate a YOUTUBE_REFRESH_TOKEN.

WSL-friendly two-step flow:

  Step 1 — print the auth URL:
    python3 youtube_auth.py

  Step 2 — exchange the code (paste the full redirect URL as an argument):
    python3 youtube_auth.py "http://localhost/?code=4/0A..."

You need YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET set in backend/.env.
After running step 2, copy the printed YOUTUBE_REFRESH_TOKEN into Railway env vars.
"""

import os
import sys
import urllib.parse
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

CLIENT_ID     = os.environ.get("YOUTUBE_CLIENT_ID") or os.environ.get("GOOGLE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET") or os.environ.get("GOOGLE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit(
        "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env\n"
        "Get them from: https://console.cloud.google.com/apis/credentials"
    )

SCOPE        = "https://www.googleapis.com/auth/youtube.upload"
REDIRECT_URI = "http://localhost"

# ── Step 2: exchange code ─────────────────────────────────────────────────────
if len(sys.argv) > 1:
    redirected = sys.argv[1].strip()
    parsed = urllib.parse.urlparse(redirected)
    code   = urllib.parse.parse_qs(parsed.query).get("code", [None])[0]
    if not code:
        raise SystemExit("No 'code' found in that URL. Make sure you pasted the full redirect URL.")

    r = requests.post("https://oauth2.googleapis.com/token", data={
        "code":          code,
        "client_id":     CLIENT_ID,
        "client_secret": CLIENT_SECRET,
        "redirect_uri":  REDIRECT_URI,
        "grant_type":    "authorization_code",
    })
    r.raise_for_status()
    tokens = r.json()

    refresh_token = tokens.get("refresh_token")
    if not refresh_token:
        raise SystemExit(f"No refresh_token in response: {tokens}")

    print("\n✅ Auth complete!\n")
    print(f"YOUTUBE_REFRESH_TOKEN={refresh_token}\n")
    print("Run this to save it to Railway:")
    print(f'! railway variables set YOUTUBE_REFRESH_TOKEN_2="{refresh_token}"')
    sys.exit(0)

# ── Step 1: print auth URL ────────────────────────────────────────────────────
params = {
    "client_id":     CLIENT_ID,
    "redirect_uri":  REDIRECT_URI,
    "response_type": "code",
    "scope":         SCOPE,
    "access_type":   "offline",
    "prompt":        "consent",
}
auth_url = "https://accounts.google.com/o/oauth2/auth?" + urllib.parse.urlencode(params)

print("\n" + "="*60)
print("STEP 1 — Open this URL in Chrome/Edge (select & copy it):\n")
print(auth_url)
print("\nSTEP 2 — After approving, your browser will try to load")
print("  http://localhost/?code=...  (it will fail — that's OK)")
print("  Copy the FULL URL from the address bar, then run:\n")
print('  python3 youtube_auth.py "<paste-the-full-url-here>"')
print("="*60 + "\n")
