/**
 * On GitHub Pages (static), hide Ask entry points — live Ask only on Vercel.
 */
(function () {
  'use strict';

  if (!/github\.io$/i.test(location.hostname || '')) return;

  document.documentElement.classList.add('is-static-host');

  function hideAskNav() {
    document.querySelectorAll('a[data-nav="ask"], a[href$="ask.html"], a[href*="/ask.html"]').forEach(function (a) {
      var li = a.closest('li');
      if (li) li.hidden = true;
      else a.hidden = true;
    });
  }

  function demoteHeroAsk() {
    var link = document.querySelector('a.hero__ask');
    if (!link) return;
    var note = link.querySelector('.hero__ask-note');
    if (note) note.remove();
    var img = link.querySelector('img');
    var wrap = document.createElement('div');
    wrap.className = 'hero__ask';
    if (img) wrap.appendChild(img.cloneNode(true));
    link.replaceWith(wrap);
  }

  function disableAskPage() {
    if (!/\/pages\/ask\.html$/i.test(location.pathname || '')) return;
    var section = document.querySelector('#askWidget');
    if (!section) return;
    section.innerHTML =
      '<p class="ask__banner ask__banner--warn">' +
      'Ask is not available on the GitHub Pages copy (no AI API). ' +
      'Browse the site here, or use the Vercel demo with VPN if you want live Ask.' +
      '</p>';
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      hideAskNav();
      demoteHeroAsk();
      disableAskPage();
    });
  } else {
    hideAskNav();
    demoteHeroAsk();
    disableAskPage();
  }
})();
