# Personal site ? Tsang Ka Wai

## Live URLs

| Version | URL | Notes |
|--------|-----|--------|
| **Homepage (preferred)** | https://kwtsang101016.github.io/ | Profile root ? share this going forward |
| **Project path (kept)** | https://kwtsang101016.github.io/about_me/ | Same site; old link still works |
| **Vercel (Ask API)** | https://about-ka-wai-tsang.vercel.app | Live Ask ? may need VPN |

Repos:
- https://github.com/kwtsang101016/about_me
- https://github.com/kwtsang101016/kwtsang101016.github.io

To update both GitHub Pages sites from this folder:

```bash
git push origin main
git push github-io main
```

Workshop tip: share the homepage link for browsing (Ask is hidden on GitHub Pages). Live Ask is only on Vercel and may need VPN.

## Why Vercel (not GitHub Pages) for Ask

GitHub Pages only hosts static files. Live Ask needs a serverless API plus an API key, so that part is on Vercel.

## Local preview

```bash
set CLOD_API_KEY=your_key
node server.mjs
# open http://127.0.0.1:4173
```

## Vercel Ask (important)

CL?D works on your laptop, but Vercel datacenter IPs are often blocked by Cloudflare on `api.clod.io`.

For live Ask on Vercel, set `DEEPSEEK_API_KEY` in the Vercel project env, then redeploy. Local preview can keep using `CLOD_API_KEY`.
