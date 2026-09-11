# Personal site ? Tsang Ka Wai

Live:
- Site: https://about-me-tan-omega.vercel.app
- Repo: https://github.com/kwtsang101016/about_me

## Why Vercel (not GitHub Pages)

GitHub Pages only hosts static files. The **Ask** feature needs a serverless API (`/api/ask`) plus `CLOD_API_KEY`, so this project is deployed on **Vercel**.

## Local preview

```bash
# optional Ask backend
set CLOD_API_KEY=your_key
node scripts/local-server.mjs
# open http://127.0.0.1:4173
```

Or open `index.html` directly (Ask falls back to canned answers).

## Vercel env

In the Vercel project, set `CLOD_API_KEY` (Production / Preview). Optional: `CLOD_MODEL`, `CLOD_BASE_URL`.
