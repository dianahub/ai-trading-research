"""
YouTube Data API v3 — upload Shorts/Reels to a YouTube channel.

Env vars:
  YOUTUBE_CLIENT_ID      — OAuth 2.0 client ID (from Google Cloud Console)
  YOUTUBE_CLIENT_SECRET  — OAuth 2.0 client secret
  YOUTUBE_REFRESH_TOKEN  — long-lived refresh token (generated once via youtube_auth.py)
"""

import io
import os
import requests
from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload


def _youtube_client():
    creds = Credentials(
        token=None,
        refresh_token=os.environ["YOUTUBE_REFRESH_TOKEN"],
        token_uri="https://oauth2.googleapis.com/token",
        client_id=os.environ["YOUTUBE_CLIENT_ID"],
        client_secret=os.environ["YOUTUBE_CLIENT_SECRET"],
        scopes=["https://www.googleapis.com/auth/youtube.upload"],
    )
    creds.refresh(Request())
    return build("youtube", "v3", credentials=creds, cache_discovery=False)


def post_to_youtube(video_url: str, title: str, description: str) -> dict:
    """Download video_url and upload to YouTube. Returns {"video_id": ..., "permalink": ...}.
    No-ops (returns empty dict) if YOUTUBE_REFRESH_TOKEN is not set."""
    if not os.getenv("YOUTUBE_REFRESH_TOKEN"):
        return {}

    # Download video into memory
    r = requests.get(video_url, stream=True, timeout=120)
    r.raise_for_status()
    video_data = io.BytesIO(r.content)

    youtube = _youtube_client()

    body = {
        "snippet": {
            "title": title[:100],  # YouTube title max 100 chars
            "description": description,
            "tags": ["financialastrology", "astrotrading", "stockmarket", "cryptotrading", "trading", "starsignal"],
            "categoryId": "22",  # People & Blogs
        },
        "status": {
            "privacyStatus": "public",
            "selfDeclaredMadeForKids": False,
            "madeForKids": False,
        },
    }

    media = MediaIoBaseUpload(video_data, mimetype="video/mp4", resumable=True, chunksize=5 * 1024 * 1024)
    response = youtube.videos().insert(part="snippet,status", body=body, media_body=media).execute()

    video_id = response["id"]
    return {
        "video_id":  video_id,
        "permalink": f"https://www.youtube.com/shorts/{video_id}",
    }
