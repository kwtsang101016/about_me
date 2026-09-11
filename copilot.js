/**
 * copilot.js — Ask widget for pages/ask.html
 * Live SSE on Vercel → static hosts point to Vercel Ask (VPN) + light mock
 */

(function () {
  'use strict';

  var LIVE_ASK_URL = 'https://about-ka-wai-tsang.vercel.app/pages/ask.html';
  var API_BASE = window.__COPILOT_API__ || '';
  var TIMEOUT_MS = 45000;

  function siteRoot() {
    var path = location.pathname || '/';
    var pagesAt = path.lastIndexOf('/pages/');
    if (pagesAt >= 0) return path.slice(0, pagesAt + 1);
    var slash = path.lastIndexOf('/');
    return slash >= 0 ? path.slice(0, slash + 1) : '/';
  }

  var ROOT = siteRoot();
  var PAGES = {
    home: ROOT + 'index.html',
    teaching: ROOT + 'pages/teaching.html',
    research: ROOT + 'pages/research.html',
    publications: ROOT + 'pages/publications.html'
  };

  function isStaticHost() {
    if (location.protocol === 'file:') return true;
    var host = location.hostname || '';
    if (/github\.io$/i.test(host)) return true;
    if (host === 'localhost' || host === '127.0.0.1') return false;
    return false;
  }

  var widget = document.getElementById('askWidget');
  if (!widget) return;

  var form = document.getElementById('askForm');
  var input = document.getElementById('askInput');
  var submit = document.getElementById('askSubmit');
  var counter = document.getElementById('askCounter');
  var statusEl = document.getElementById('askStatus');
  var answerEl = document.getElementById('askAnswer');
  var chipsWrap = document.getElementById('askChips');

  var busy = false;

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function resolveRefs(escaped) {
    return escaped.replace(/\[\[ref:([\w-]+)\/([\w-]+)\]\]/g, function (m, page, anchor) {
      var file = PAGES[page];
      if (!file) return '';
      return '<a class="ask__ref" href="' + file + '#' + anchor +
             '" title="Jump to the source section">↗</a>';
    });
  }

  function setStatus(text) { statusEl.textContent = text || ''; }

  function showAnswer(html) {
    answerEl.hidden = false;
    answerEl.innerHTML = html;
  }

  function banner(text, warn) {
    return '<p class="ask__banner' + (warn ? ' ask__banner--warn' : '') + '">' +
           escapeHtml(text) + '</p>';
  }

  function liveAskLink() {
    return '<p class="ask__jd-evidence"><a class="ask__ref" href="' +
      escapeHtml(LIVE_ASK_URL) + '" target="_blank" rel="noopener">Open live Ask on Vercel (VPN) ↗</a></p>';
  }

  function degrade(reason) {
    var links =
      '<p class="ask__jd-evidence">' +
      '<a class="ask__ref" href="' + escapeHtml(PAGES.teaching) + '">Teaching ↗</a> · ' +
      '<a class="ask__ref" href="' + escapeHtml(PAGES.research) + '">Research ↗</a> · ' +
      '<a class="ask__ref" href="' + escapeHtml(PAGES.publications) + '">Publications ↗</a></p>';
    showAnswer(banner(reason, true) + liveAskLink() + links);
    setStatus('');
  }

  function updateCounter() {
    counter.textContent = input.value.length + ' / 2000';
    submit.disabled = busy || !input.value.trim();
  }

  async function runQa(question) {
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, TIMEOUT_MS);

    var res;
    try {
      res = await fetch(API_BASE + '/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'qa', question: question }),
        signal: ctrl.signal
      });
    } catch (e) {
      clearTimeout(timer);
      throw { kind: e && e.name === 'AbortError' ? 'timeout' : 'network' };
    }

    if (res.status === 404) { clearTimeout(timer); throw { kind: 'nomock' }; }
    if (!res.ok) {
      clearTimeout(timer);
      throw { kind: res.status === 429 ? 'rate' : 'unavailable' };
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buf = '', full = '', first = true;

    for (;;) {
      var chunk = await reader.read();
      if (chunk.done) break;
      buf += decoder.decode(chunk.value, { stream: true });

      var idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        var raw = buf.slice(0, idx).trim();
        buf = buf.slice(idx + 2);
        if (raw.indexOf('data:') !== 0) continue;
        var evt;
        try { evt = JSON.parse(raw.slice(5).trim()); } catch (e) { continue; }

        if (evt.type === 'delta') {
          if (first) { clearTimeout(timer); setStatus(''); first = false; }
          full += evt.text;
          showAnswer(resolveRefs(escapeHtml(full)) + '<span class="ask__caret"></span>');
        } else if (evt.type === 'error') {
          full += '\n（回答被中断）';
        }
      }
    }
    clearTimeout(timer);
    showAnswer(resolveRefs(escapeHtml(full)));
    return full;
  }

  var MOCK = [
    { keys: ['role', 'title', 'professor', '职位', '职称', '当前'],
      text: 'He is Associate Professor (Teaching) at the School of Data Science, CUHK-Shenzhen. He joined in December 2015 and is Program Coordinator for Statistics. [[ref:home/hero]]' },
    { keys: ['ai', 'teaching', 'learn', '教育', '教学', '人工智能'],
      text: 'He is on the teaching track and is actively studying how AI can enhance teaching and learning in statistics. He is Co-PI on an AI-powered personalized learning project (2025–2027). [[ref:teaching/next]]' },
    { keys: ['research', 'interest', 'inference', 'time series', '研究', '时间序列'],
      text: 'Research interests include time series, high-dimensional regression, and post-selection inference. He was PI of an NSFC project (2021–2023) on post-selection estimators for time-series models. [[ref:research/nsfc]]' },
    { keys: ['teach', 'course', 'class', '课程', '授课'],
      text: 'He teaches Time Series, Probability & Statistics, Forecasting and Predictive Analytics, AI Exploration I, and related courses. [[ref:teaching/courses]]' },
    { keys: ['paper', 'publication', 'statistica', '论文', '发表'],
      text: 'A signature paper is Dai & Tsang (2021), hybrid resampling confidence intervals, Statistica Sinica — he is corresponding author. [[ref:publications/sig]]' }
  ];

  function mockAnswer(q) {
    var low = q.toLowerCase();
    for (var i = 0; i < MOCK.length; i++) {
      for (var j = 0; j < MOCK[i].keys.length; j++) {
        if (low.indexOf(MOCK[i].keys[j]) >= 0) return MOCK[i].text;
      }
    }
    return 'This static copy doesn\'t answer that live. Browse Teaching / Research / Publications, or open the Vercel Ask page with VPN.';
  }

  function runStatic(question) {
    var note = 'This is the GitHub Pages (static) copy — no AI API here. For live Ask, open VPN and use the Vercel link below.';
    var text = mockAnswer(question);
    showAnswer(banner(note, true) + liveAskLink() + '<p>' + resolveRefs(escapeHtml(text)) + '</p>');
  }

  var ERRORS = {
    rate: 'Too many questions in a short window. Give it a minute and try again.',
    timeout: 'The model didn\'t respond in time. The pages below have the same information.',
    network: 'Couldn\'t reach the answering service. The pages below have the same information.',
    unavailable: 'The answering service is unavailable right now. The pages below have the same information.'
  };

  async function onSubmit(e) {
    e.preventDefault();
    var text = input.value.trim();
    if (!text || busy) return;
    if (text.length > 2000) return;

    busy = true;
    updateCounter();
    answerEl.hidden = true;
    answerEl.innerHTML = '';
    setStatus('Reading the site…');

    try {
      if (isStaticHost()) { runStatic(text); }
      else { await runQa(text); }
    } catch (err) {
      var kind = (err && err.kind) || 'unavailable';
      if (kind === 'nomock') runStatic(text);
      else degrade(ERRORS[kind] || ERRORS.unavailable);
    } finally {
      busy = false;
      setStatus('');
      updateCounter();
    }
  }

  chipsWrap.addEventListener('click', function (e) {
    var chip = e.target.closest('.ask__chip');
    if (!chip) return;
    input.value = chip.textContent.trim();
    updateCounter();
    input.focus();
  });
  input.addEventListener('input', updateCounter);
  input.addEventListener('keydown', function (e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') form.requestSubmit();
  });
  form.addEventListener('submit', onSubmit);

  updateCounter();
})();
