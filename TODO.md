# Starsignal.io — Todo List

Items ordered by priority. Check off as completed.

---

## 🔴 Fix Email Deliverability (Resend)

Emails are currently landing in spam because they send from `onboarding@resend.dev` — Resend's shared sandbox domain. Code is already updated to read from `RESEND_FROM` env var; just need the domain verified.

- [ ] **Verify `starsignal.io` domain in Resend**
  1. Resend dashboard → Domains → Add domain → enter `starsignal.io`
  2. Copy the DNS records Resend provides (2 DKIM TXT records + 1 SPF TXT record)
  3. Add them in your DNS provider (Cloudflare, Namecheap, etc.)
  4. Click Verify in Resend — wait for green checkmark

- [ ] **Set `RESEND_FROM` env var on Railway** (run from `backend/`)
  ```
  railway variables set RESEND_FROM="Star Signal <YOUR_ADDRESS@starsignal.io>"
  ```
  Pick any `@starsignal.io` address — the mailbox doesn't need to exist.
  If you want replies to go to your real inbox, use `diana@starsignal.io` or set a separate `reply_to` field.
  Common choices: `noreply@starsignal.io` · `diana@starsignal.io` · `updates@starsignal.io`

- [ ] **Add DMARC DNS record** (strongly recommended — raises trust score)
  Add a TXT record for `_dmarc.starsignal.io`:
  ```
  v=DMARC1; p=quarantine; rua=mailto:dianahelene@gmail.com
  ```

- [ ] **Add an unsubscribe link** to all broadcast/newsletter emails
  Gmail requires one-click unsubscribe for bulk senders. Add a line at the bottom of each email:
  ```html
  <p style="font-size:12px;color:#666">
    <a href="https://www.starsignal.io/unsubscribe?email={{email}}">Unsubscribe</a>
  </p>
  ```

---

## 🟡 Send User Email — Congressional Trades

- [ ] Send newsletter email announcing `/congress` page and AI analysis tab
  - Draft is ready (see conversation)
  - Wait until domain is verified first so it doesn't go to spam

---

## 🟡 YouTube API

- [ ] Enable **YouTube Data API v3** for project `205137234281`
  Visit: https://console.developers.google.com/apis/api/youtube.googleapis.com/overview?project=205137234281
  Click Enable → wait ~2 min → retry cross-posting

---

## 🟢 Search Engine Setup

- [x] **Request indexing of `/congress` in Google Search Console** — done 2026-06-03
- [ ] **Submit sitemap** in Google Search Console — paste `https://www.starsignal.io/sitemap.xml` under Sitemaps
- [ ] **Submit site to Bing Webmaster Tools** — bing.com/webmasters
- [ ] **Check PageSpeed Insights** for Core Web Vitals score
- [ ] **Confirm `og-image.png`** exists at 1200×630 and looks good when shared on social

---

## 🟢 Promote /congress Page

### Reddit (post in each — lead with a specific recent trade, include screenshot)
- [ ] r/stocks — "I built a free tracker for congressional stock disclosures — STOCK Act data updated daily"
- [ ] r/investing — same, more serious tone
- [ ] r/wallstreetbets — lean into the meme: "Nancy Pelosi bought X, I built a tool so you don't miss the next one"
- [ ] r/StockMarket — straightforward data tool post
- [ ] r/unusual_whales — this community specifically follows congressional trading
- [ ] r/algotrading — mention the AI analysis + API angle

### X/Twitter
- [ ] Post a thread: "Pelosi. Burr. Collins. Congress trades billions in stocks yearly. Here's a free real-time tracker with AI analysis 🧵" → show screenshots
- [ ] Tag **@unusual_whales** (1M+ followers, posts congressional trades daily) — reply to one of their posts with your link
- [ ] Daily: highlight a notable recent trade from the feed

### TikTok / Instagram Reels
- [ ] Record a Reel using the HeyGen pipeline with angle: *"Did you know senators must disclose every stock trade? Here's what they bought last week..."* — show the page on screen, highlight a notable trade, mention AI analysis tab

### Written Content (each post = backlink + new audience)
- [ ] **Medium article** — "How to Track What Congress Is Buying in Real Time (Free Tool)"
- [ ] **Substack post** — same article, different audience
- [ ] **Dev.to post** — angle toward the API/data side
- [ ] **LinkedIn article** — professional investing audience

### Product Listings
- [ ] **Product Hunt** — launch Starsignal.io, feature the Congress page as a highlight
- [ ] **There's An AI For That** (theresanaiforthat.com) — submit as AI tool
- [ ] **Futurepedia** (futurepedia.io) — AI tools directory
- [ ] **AI Tools Directory** (aitoolsdirectory.com)
- [ ] **AlternativeTo** — list as alternative to Bloomberg/TradingView, Capitol Trades, Quiver Quant

### Features to add that make the page more shareable
- [ ] **"Share this trade" button** — one click to tweet a specific trade
- [ ] **Email alert signup** — "Get notified when Congress buys/sells a ticker you follow"
- [ ] **Most-traded tickers leaderboard** — "NVDA · AAPL · TSLA · most bought by Congress this month" (good for SEO + shareability)

---

## 🟢 Congress Infor API

- [ ] Enable **Stripe customer portal** in Stripe dashboard
  Dashboard → Settings → Billing → Customer portal → Enable → Save
- [ ] **Demo video** (1 min) — record live API tester on landing page (Loom or OBS)
- [ ] Post **"Show HN"** — "Real-time API for U.S. congressional stock trade disclosures"
- [ ] Post on **Reddit** — r/Python, r/algotrading, r/stocks
- [ ] Post thread on **X/Twitter**
- [ ] Submit to **public-apis** GitHub repo (PR under Finance/Government)
- [ ] List on **RapidAPI**
- [ ] Submit to **APIs.guru** (GitHub PR with OpenAPI spec)
- [ ] Publish collection on **Postman API Network**
