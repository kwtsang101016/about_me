# Personal site demo ‚Ä?Tsang Ka Wai

A polished personal webpage inspired by `../portfolio`, filled with content from `../Profile` (CV + photo).

## Open

Open `index.html` in a browser (double-click or Live Preview).

## What‚Äôs included

- Hero, intro, trajectory (footprint + timeline), teaching deep dive with stats/tabs
- Flip cards ‚Ü?`pages/teaching.html`, `pages/research.html`, `pages/publications.html`
- Contact (email, ORCID, office)
- Same visual/motion stack as the portfolio demo (GSAP + ScrollTrigger)

## What‚Äôs intentionally lighter

- No DeepSeek / Ask copilot (workshop demo focus; optional later)
- No hobby flipbook
- City photos are decorative placeholders from the original portfolio assets

## Ask (CL≈çD, not DeepSeek)

Uses your environment variable `CLOD_API_KEY` via OpenAI-compatible endpoint `https://api.clod.io/v1`.

```bash
# from personal-site/
node scripts/local-server.mjs
# open http://127.0.0.1:4173/pages/ask.html
```

Optional env:
- `CLOD_MODEL` (default `GPT OSS 20B` ‚Ä?works on free-tier balance)
- `CLOD_BASE_URL` (default `https://api.clod.io/v1`)
- `PORT` (default `4173`)

Never commit the API key. For Vercel, set `CLOD_API_KEY` in Project ‚Ü?Environment Variables.

