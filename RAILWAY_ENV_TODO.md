# Railway Env Vars — HeyGen Social Pipeline

These variables are missing from the Railway staging environment and need to be added before the Instagram pipeline will work.

## Missing Variables

| Variable | Required | Notes |
|---|---|---|
| `HEYGEN_API_KEY` | Yes | From app.heygen.com → API section |
| `HEYGEN_AVATAR_ID` | Yes | Your trained twin avatar ID from HeyGen |
| `HEYGEN_VOICE_ID` | No | Uses avatar's default voice if not set |
| `INSTAGRAM_ACCESS_TOKEN` | Yes | Long-lived page access token from Meta Graph API |
| `INSTAGRAM_ACCOUNT_ID` | Yes | IG Business Account ID |
| `AUTO_POST_ENABLED` | No | Set to `true` when ready to go live (default: `false`) |

## How to Add

```bash
railway variables --set "HEYGEN_API_KEY=..." \
  --set "HEYGEN_AVATAR_ID=..." \
  --set "HEYGEN_VOICE_ID=..." \
  --set "INSTAGRAM_ACCESS_TOKEN=..." \
  --set "INSTAGRAM_ACCOUNT_ID=..."
```

## Context

As of 2026-05-12, the social pipeline (script → HeyGen twin video → Instagram Reel) was moved from astro-api into this project (`ai-trading-research/backend`). New files:
- `backend/heygen.py` — HeyGen video generation
- `backend/instagram.py` — Instagram posting via Meta Graph API

The pipeline is triggered from the Admin → Social Content page. Auto-posting runs daily at 08:00 UTC when `AUTO_POST_ENABLED=true`.
