# Personal site ? Tsang Ka Wai

## Two live URLs

| Version | URL | Best for |
|--------|-----|----------|
| **GitHub Pages (static, no API)** | https://kwtsang101016.github.io/about_me/ | Everyday browsing in mainland China |
| **Vercel (Ask API)** | https://about-ka-wai-tsang.vercel.app | Live **Ask** ? may need VPN |

Repo: https://github.com/kwtsang101016/about_me

Workshop tip: share the GitHub Pages link for the site (Ask is hidden there). Live Ask is only on Vercel and may need VPN.

## Local preview

```bash
# optional Ask backend
set CLOD_API_KEY=your_key
node scripts/local-server.mjs
# open http://127.0.0.1:4173
```

Or open `index.html` directly (Ask uses canned answers).

## Vercel env

Set `CLOD_API_KEY` in the Vercel project (Production / Preview). Optional: `CLOD_MODEL`, `CLOD_BASE_URL`.
