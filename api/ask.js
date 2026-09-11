/**
 * POST /api/ask — QA (SSE) + optional JD JSON match
 * Provider: CLōD (CLOD_API_KEY)
 */
'use strict';

const { callModel } = require('./_lib/provider.js');
const { buildMessages, MAX_INPUT_CHARS } = require('./_lib/prompt.js');
const ratelimit = require('./_lib/ratelimit.js');
const profile = require('./_data/profile.json');

const VALID_REFS = (function collect(node, acc) {
  if (Array.isArray(node)) node.forEach(n => collect(n, acc));
  else if (node && typeof node === 'object') {
    for (const r of node.refs || []) {
      if (r && r.page && r.anchor) acc.add(r.page + '/' + r.anchor);
    }
    Object.values(node).forEach(v => collect(v, acc));
  }
  return acc;
})(profile, new Set());

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(payload));
}

function checkOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers.host;
  const allowed = String(process.env.ALLOWED_ORIGINS || '')
    .split(',').map(s => s.trim()).filter(Boolean);
  let sameHost = false;
  try { sameHost = new URL(origin).host === host; } catch (e) { sameHost = false; }
  if (sameHost) return true;
  if (allowed.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
    return true;
  }
  // local demo: allow localhost origins
  try {
    const u = new URL(origin);
    if (u.hostname === 'localhost' || u.hostname === '127.0.0.1') {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
      return true;
    }
  } catch (e) { /* ignore */ }
  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch (e) { return null; }
  }
  const chunks = [];
  for await (const c of req) chunks.push(c);
  if (!chunks.length) return {};
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch (e) { return null; }
}

function validate(body) {
  if (!body || typeof body !== 'object') return 'invalid_json';
  const mode = body.mode === 'jd' ? 'jd' : 'qa';
  const text = mode === 'jd' ? body.jd : body.question;
  if (typeof text !== 'string' || !text.trim()) return 'empty_input';
  if (text.length > MAX_INPUT_CHARS) return 'input_too_long';
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    checkOrigin(req, res);
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.statusCode = 204;
    return res.end();
  }
  if (req.method !== 'POST') return json(res, 405, { error: 'method_not_allowed' });
  if (!checkOrigin(req, res)) return json(res, 403, { error: 'forbidden_origin' });

  const gate = ratelimit.check(req);
  if (!gate.ok) {
    res.setHeader('Retry-After', String(gate.retryAfter));
    return json(res, 429, { error: 'rate_limited', reason: gate.reason, retryAfter: gate.retryAfter });
  }

  const body = await readBody(req);
  const bad = validate(body);
  if (bad) return json(res, 400, { error: bad });

  const mode = body.mode === 'jd' ? 'jd' : 'qa';
  const userText = mode === 'jd' ? body.jd : body.question;
  const messages = buildMessages(profile, mode, userText, body.history);

  if (mode === 'jd') return handleJd(res, messages);
  return handleQa(res, messages);
};

async function handleJd(res, messages) {
  const r = await callModel(messages, { stream: false, maxTokens: 1200, jsonMode: false });
  if (!r.ok) return json(res, r.status || 503, { error: r.error, detail: r.detail });

  const raw = r.data && r.data.choices && r.data.choices[0]
    && r.data.choices[0].message && r.data.choices[0].message.content;
  let parsed;
  try {
    const start = String(raw).indexOf('{');
    const end = String(raw).lastIndexOf('}');
    parsed = JSON.parse(String(raw).slice(start, end + 1));
  } catch (e) {
    return json(res, 502, { error: 'bad_model_output' });
  }

  const matches = Array.isArray(parsed.matches) ? parsed.matches : [];
  const gaps = Array.isArray(parsed.gaps) ? parsed.gaps : [];
  const clean = {
    matches: matches
      .filter(m => m && typeof m.requirement === 'string')
      .map(m => ({
        requirement: m.requirement,
        level: m.level === 'strong' ? 'strong' : 'partial',
        evidence: typeof m.evidence === 'string' ? m.evidence : '',
        refs: (Array.isArray(m.refs) ? m.refs : []).filter(x => x && VALID_REFS.has(x.page + '/' + x.anchor))
      })),
    gaps: gaps
      .filter(g => g && typeof g.requirement === 'string')
      .map(g => ({ requirement: g.requirement, note: typeof g.note === 'string' ? g.note : '' })),
    summary: typeof parsed.summary === 'string' ? parsed.summary : ''
  };
  clean.trustworthy = clean.gaps.length > 0 && clean.matches.length > 0;
  return json(res, 200, clean);
}

function sse(res, obj) {
  res.write('data: ' + JSON.stringify(obj) + '\n\n');
}

async function handleQa(res, messages) {
  const r = await callModel(messages, { stream: true, maxTokens: 900 });
  if (!r.ok) return json(res, r.status || 503, { error: r.error, detail: r.detail });

  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  let full = '';
  let buf = '';
  const reader = r.response.body.getReader();
  const decoder = new TextDecoder();

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 1);
        if (!line.startsWith('data:')) continue;
        const payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        let chunk;
        try { chunk = JSON.parse(payload); } catch (e) { continue; }
        const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
        const text = delta && delta.content;
        if (text) { full += text; sse(res, { type: 'delta', text }); }
      }
    }

    const refs = [];
    const seen = new Set();
    for (const m of full.matchAll(/\[\[ref:([\w-]+)\/([\w-]+)\]\]/g)) {
      const key = m[1] + '/' + m[2];
      if (VALID_REFS.has(key) && !seen.has(key)) {
        seen.add(key);
        refs.push({ page: m[1], anchor: m[2] });
      }
    }
    sse(res, { type: 'refs', refs });
    sse(res, { type: 'done' });
  } catch (err) {
    sse(res, { type: 'error', error: 'stream_interrupted' });
  } finally {
    if (r.cleanup) r.cleanup();
    res.end();
  }
}
