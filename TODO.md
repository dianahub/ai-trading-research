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

- [ ] Submit site to **Google Search Console** — verify ownership, submit sitemap at `https://www.starsignal.io/sitemap.xml`
- [ ] Submit site to **Bing Webmaster Tools** — bing.com/webmasters
- [ ] Check **PageSpeed Insights** for Core Web Vitals score
- [ ] Confirm `og-image.png` exists at 1200×630 and looks good when shared on social

---

## 🟢 Promotion

- [ ] **Product Hunt** — launch the product
- [ ] **There's An AI For That** (theresanaiforthat.com) — submit as AI tool
- [ ] **Futurepedia** (futurepedia.io) — AI tools directory
- [ ] **X/Twitter** — @starsignalio, post daily insights + Congress trade highlights
- [ ] **TikTok** — cross-post the daily Reels (huge reach for finance content)
- [ ] **Reddit** — engage in r/stocks, r/investing, r/financialastrology (add value, don't spam)
- [ ] **Post "Show HN"** on Hacker News
- [ ] **Medium/Substack article** — explain financial astrology + AI, link back to site
- [ ] **AlternativeTo** — list as alternative to Bloomberg/TradingView

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
