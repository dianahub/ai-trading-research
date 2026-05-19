"""
One-time script to generate a YOUTUBE_REFRESH_TOKEN.

Run this locally (not on Railway):
  pip install google-auth-oauthlib
  python backend/youtube_auth.py

You need YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET set in your environment
(or in backend/.env). Get these from Google Cloud Console → APIs & Services →
Credentials → your OAuth 2.0 Client ID (same project as Gmail).

Make sure "YouTube Data API v3" is enabled in that project:
  https://console.cloud.google.com/apis/library/youtube.googleapis.com

After running, copy the printed YOUTUBE_REFRESH_TOKEN into Railway env vars.
"""

import os
from dotenv import load_dotenv
from google_auth_oauthlib.flow import InstalledAppFlow

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

CLIENT_ID     = os.environ.get("YOUTUBE_CLIENT_ID")
CLIENT_SECRET = os.environ.get("YOUTUBE_CLIENT_SECRET")

if not CLIENT_ID or not CLIENT_SECRET:
    raise SystemExit(
        "Set YOUTUBE_CLIENT_ID and YOUTUBE_CLIENT_SECRET in backend/.env or your shell environment.\n"
        "Get them from: https://console.cloud.google.com/apis/credentials"
    )

SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]

client_config = {
    "installed": {
        "client_id":                  CLIENT_ID,
        "client_secret":              CLIENT_SECRET,
        "auth_uri":                   "https://accounts.google.com/o/oauth2/auth",
        "token_uri":                  "https://oauth2.googleapis.com/token",
        "redirect_uris":              ["urn:ietf:wg:oauth:2.0:oob", "http://localhost"],
    }
}

flow = InstalledAppFlow.from_client_config(client_config, SCOPES)
creds = flow.run_local_server(port=0)

print("\n✅ Auth complete! Add this to Railway env vars:\n")
print(f"YOUTUBE_REFRESH_TOKEN={creds.refresh_token}")
print(f"YOUTUBE_CLIENT_ID={CLIENT_ID}")
print(f"YOUTUBE_CLIENT_SECRET={CLIENT_SECRET}")
