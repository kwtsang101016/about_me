/**
 * GET /api/ask-probe — server-side CLōD auth probe (no secrets returned)
 */
'use strict';

const { callModel, model, baseUrl } = require('./_lib/provider.js');

module.exports = async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ error: 'method_not_allowed' }));
  }

  const key = process.env.CLOD_API_KEY || '';
  const probe = await callModel(
    [{ role: 'user', content: 'Reply with exactly: OK' }],
    { stream: false, maxTokens: 20 }
  );

  res.statusCode = 200;
  res.end(JSON.stringify({
    hasKey: Boolean(key),
    keyLen: key.length,
    model: model(),
    base: baseUrl(),
    probeOk: Boolean(probe && probe.ok),
    probeError: probe && probe.error ? probe.error : null,
    upstreamStatus: probe && probe.upstreamStatus ? probe.upstreamStatus : null,
    detail: probe && probe.detail ? String(probe.detail).slice(0, 240) : null
  }));
};
