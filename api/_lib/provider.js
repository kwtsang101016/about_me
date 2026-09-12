/**
 * CLōD provider (OpenAI-compatible)
 * Env: CLOD_API_KEY (required), CLOD_BASE_URL, CLOD_MODEL
 */
'use strict';

function baseUrl() {
  return (process.env.CLOD_BASE_URL || 'https://api.clod.io/v1').replace(/\/+$/, '');
}

function model() {
  // Free-tier friendly default on CLōD (OpenAI-compatible model id)
  return process.env.CLOD_MODEL || 'GPT OSS 20B';
}

const TTFB_TIMEOUT_MS = 25000;
const TOTAL_TIMEOUT_MS = 60000;

function mapError(status, err) {
  if (err && err.name === 'AbortError') return { code: 'upstream_timeout', status: 504 };
  if (err) return { code: 'upstream_network', status: 503 };
  if (status === 401 || status === 403) return { code: 'upstream_auth', status: 503 };
  if (status === 429) return { code: 'upstream_rate_limited', status: 503 };
  if (status >= 500) return { code: 'upstream_unavailable', status: 503 };
  if (status === 400 || status === 422) return { code: 'upstream_bad_request', status: 502 };
  return { code: 'upstream_unavailable', status: 503 };
}

async function callModel(messages, opts = {}) {
  const apiKey = process.env.CLOD_API_KEY;
  if (!apiKey) return { ok: false, error: 'missing_api_key', status: 500 };
  return sendRequest(apiKey, messages, opts);
}

async function sendRequest(apiKey, messages, opts) {
  const stream = !!opts.stream;
  const body = {
    model: model(),
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
    res = await fetch(baseUrl() + '/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + apiKey
      },
      body: JSON.stringify(body),
      signal: ctrl.signal
    });
  } catch (err) {
    clearTimeout(ttfbTimer);
    clearTimeout(totalTimer);
    const m = mapError(null, err);
    return { ok: false, error: m.code, status: m.status };
  }
  clearTimeout(ttfbTimer);

  if (!res.ok) {
    clearTimeout(totalTimer);
    let detail = '';
    try { detail = await res.text(); } catch (_) { /* ignore */ }
    const m = mapError(res.status, null);
    return { ok: false, error: m.code, status: m.status, upstreamStatus: res.status, detail: detail.slice(0, 300) };
  }

  if (stream) {
    return { ok: true, response: res, cleanup: () => clearTimeout(totalTimer) };
  }

  try {
    const data = await res.json();
    return { ok: true, data };
  } catch (err) {
    const m = mapError(null, err);
    return { ok: false, error: m.code, status: m.status };
  } finally {
    clearTimeout(totalTimer);
  }
}

module.exports = { callModel, model, baseUrl, TTFB_TIMEOUT_MS, TOTAL_TIMEOUT_MS };
