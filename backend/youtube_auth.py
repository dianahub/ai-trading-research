"""
One-time script to generate a YOUTUBE_REFRESH_TOKEN.

Run this locally (not on Railway):
  pip install google-auth-oauthlib
  python backend/youtube_auth.py

You need YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET set in backend/.env.
After running, copy the printed YOUTUBE_REFRESH_TOKEN into Railway env vars.
"""

import os
import urllib.parse
import requests
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

CLIENT_ID     = os.environ.get("YOUTUBE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit(
        "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env\n"
        "Get them from: https://console.cloud.google.com/apis/credentials"
    )

SCOPE        = "https://www.googleapis.com/auth/youtube.upload"
REDIRECT_URI = "http://localhost"

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
print("1. Open this URL in your browser:")
print()
print(auth_url)
print()
print("2. Sign in and approve access.")
print("3. You'll be redirected to a page that fails to load.")
print("   Copy the FULL URL from the browser address bar.")
print("="*60 + "\n")

redirected = input("Paste the full redirect URL here: ").strip()

parsed = urllib.parse.urlparse(redirected)
code   = urllib.parse.parse_qs(parsed.query).get("code", [None])[0]
if not code:
    raise SystemExit("No 'code' found in that URL. Make sure you pasted the full URL.")

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

print("\n✅ Auth complete! Run these commands to add to Railway:\n")
print(f"railway variables set YOUTUBE_REFRESH_TOKEN={refresh_token}")
print(f"railway variables set YOUTUBE_CLIENT_ID={CLIENT_ID}")
print(f"railway variables set YOUTUBE_CLIENT_SECRET={CLIENT_SECRET}")
