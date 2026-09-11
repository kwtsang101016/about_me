/**
 * copilot.js —— Q&A widget for pages/ask.html
 * States: live SSE → local mock → degrade with page links
 */

(function () {
  'use strict';

  var API_BASE = window.__COPILOT_API__ || '';
  var TIMEOUT_MS = 45000;

  var PAGES = {
    home: '/index.html',
    teaching: '/pages/teaching.html',
    research: '/pages/research.html',
    publications: '/pages/publications.html'
  };

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

  function degrade(reason) {
    var links =
      '<p class="ask__jd-evidence">' +
      '<a class="ask__ref" href="/pages/teaching.html">Teaching ↗</a> · ' +
      '<a class="ask__ref" href="/pages/research.html">Research ↗</a> · ' +
      '<a class="ask__ref" href="/pages/publications.html">Publications ↗</a></p>';
    showAnswer(banner(reason, true) + links);
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
      var info = {};
      try { info = await res.json(); } catch (e) {}
      throw { kind: res.status === 429 ? 'rate' : 'unavailable', info: info };
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
    return 'This site doesn\'t cover that. Try the Teaching / Research / Publications pages, or start the local server with your API key set.';
  }

  function runMock(question) {
    var note = 'Local fallback — canned answers (API not reachable). Start node server.mjs with your API key for live answers.';
    var text = mockAnswer(question);
    showAnswer(banner(note, true) + '<p>' + resolveRefs(escapeHtml(text)) + '</p>');
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
      if (location.protocol === 'file:') { runMock(text); }
      else { await runQa(text); }
    } catch (err) {
      var kind = (err && err.kind) || 'unavailable';
      if (kind === 'nomock') runMock(text);
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
