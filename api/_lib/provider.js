/**
 * LLM provider (OpenAI-compatible)
 * Prefers DeepSeek on Vercel (CLōD is often blocked by Cloudflare from datacenter IPs).
 *
 * Env:
 *   DEEPSEEK_API_KEY  → https://api.deepseek.com
 *   CLOD_API_KEY      → https://api.clod.io/v1
 * Optional: ASK_PROVIDER=deepseek|clod, DEEPSEEK_MODEL, CLOD_MODEL, CLOD_BASE_URL
 */
'use strict';

function pickProvider() {
  const forced = String(process.env.ASK_PROVIDER || '').toLowerCase();
  if (forced === 'deepseek' || forced === 'clod') return forced;
  if (process.env.DEEPSEEK_API_KEY) return 'deepseek';
  if (process.env.CLOD_API_KEY) return 'clod';
  return null;
}

function providerConfig() {
  const name = pickProvider();
  if (name === 'deepseek') {
    return {
      name: 'deepseek',
      apiKey: process.env.DEEPSEEK_API_KEY,
      baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/+$/, ''),
      model: process.env.DEEPSEEK_MODEL || 'deepseek-chat'
    };
  }
  if (name === 'clod') {
    return {
      name: 'clod',
      apiKey: process.env.CLOD_API_KEY,
      baseUrl: (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/+$/, ''),
      model: process.env.CLOD_MODEL || 'GPT OSS 20B'
    };
  }
  return null;
}

function baseUrl() {
  const c = providerConfig();
  return c ? c.baseUrl : (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/+$/, '');
}

function model() {
  const c = providerConfig();
  return c ? c.model : (process.env.CLOD_MODEL || 'GPT OSS 20B');
}

const TTFB_TIMEOUT_MS = 25000;
const TOTAL_TIMEOUT_MS = 60000;

function mapError(status, err, apiKey) {
  if (err && err.name === 'AbortError') return { code: 'upstream_timeout', status: 504 };
  if (err) return { code: 'upstream_network', status: 503 };
  if (status === 401 || status === 403) {
    return {
      code: 'upstream_auth',
      status: 503,
      detail: 'Upstream rejected the request (HTTP ' + status + ', keyLen=' + (apiKey || '').length + '). If using CLōD from Vercel, Cloudflare often blocks datacenter IPs — set DEEPSEEK_API_KEY instead.'
    };
  }
  if (status === 429) return { code: 'upstream_rate_limited', status: 503 };
  if (status >= 500) return { code: 'upstream_unavailable', status: 503 };
  if (status === 400 || status === 422) return { code: 'upstream_bad_request', status: 502 };
  return { code: 'upstream_unavailable', status: 503 };
}

async function callModel(messages, opts = {}) {
  const cfg = providerConfig();
  if (!cfg || !cfg.apiKey) {
    return { ok: false, error: 'missing_api_key', status: 500, detail: 'Set DEEPSEEK_API_KEY (recommended on Vercel) or CLOD_API_KEY' };
  }
  return sendRequest(cfg, messages, opts);
}

async function sendRequest(cfg, messages, opts) {
  const stream = !!opts.stream;
  const body = {
    model: cfg.model,
    messages,
    stream,
    max_tokens: opts.maxTokens || 900,
    temperature: typeof opts.temperature === 'number' ? opts.temperature : 0.2
  };
  if (opts.jsonMode) body.response_format = { type: 'json_object' };

  const ctrl = new AbortController();
  const ttfbTimer = setTimeout(() => ctrl.abort(), TTFB_TIMEOUT_MS);
  const totalTimer = setTimeout(() => ctrl.abort(), TOTAL_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(cfg.baseUrl + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + cfg.apiKey
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (err) {
    clearTimeout(ttfbTimer);
    clearTimeout(totalTimer);
    const m = mapError(null, err, cfg.apiKey);
    return { ok: false, error: m.code, status: m.status, detail: m.detail || null };
  }
  clearTimeout(ttfbTimer);

  if (!res.ok) {
    clearTimeout(totalTimer);
    let detail = '';
    try { detail = await res.text(); } catch (_) { /* ignore */ }
    const m = mapError(res.status, null, cfg.apiKey);
    const looksLikeCf = /just a moment|cloudflare|cf-ray/i.test(detail);
    return {
      ok: false,
      error: m.code,
      status: m.status,
      upstreamStatus: res.status,
      detail: looksLikeCf
        ? ('Cloudflare blocked upstream from this host. Use DEEPSEEK_API_KEY on Vercel. (HTTP ' + res.status + ')')
        : (detail.slice(0, 200) || m.detail || null)
    };
  }

  if (stream) {
    return { ok: true, response: res, cleanup: () => clearTimeout(totalTimer), provider: cfg.name };
  }

  try {
    const data = await res.json();
    return { ok: true, data, provider: cfg.name };
  } catch (err) {
    const m = mapError(null, err, cfg.apiKey);
    return { ok: false, error: m.code, status: m.status };
  } finally {
    clearTimeout(totalTimer);
  }
}

module.exports = { callModel, model, baseUrl, pickProvider, providerConfig, TTFB_TIMEOUT_MS, TOTAL_TIMEOUT_MS };
