# Personal site demo — Tsang Ka Wai

A polished personal webpage inspired by `../portfolio`, filled with content from `../Profile` (CV + photo).

## Open

Open `index.html` in a browser (double-click or Live Preview).

## What’s included

- Hero, intro, trajectory (footprint + timeline), teaching deep dive with stats/tabs
- Flip cards → `pages/teaching.html`, `pages/research.html`, `pages/publications.html`
- Contact (email, ORCID, office)
- Same visual/motion stack as the portfolio demo (GSAP + ScrollTrigger)

## What’s intentionally lighter

- No DeepSeek / Ask copilot (workshop demo focus; optional later)
- No hobby flipbook
- City photos are decorative placeholders from the original portfolio assets

## Ask (CLōD, not DeepSeek)

Uses your environment variable `CLOD_API_KEY` via OpenAI-compatible endpoint `https://api.clod.io/v1`.

```bash
# from personal-site/
node server.mjs
# open http://127.0.0.1:4173/pages/ask.html
```

Optional env:
- `CLOD_MODEL` (default `GPT OSS 20B` — works on free-tier balance)
- `CLOD_BASE_URL` (default `https://api.clod.io/v1`)
- `PORT` (default `4173`)

Never commit the API key. For Vercel, set `CLOD_API_KEY` in Project → Environment Variables.

