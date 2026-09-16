/**
 * Faelles skal for alle spilsider: en hjem-knap og en "vend enheden"-skaerm.
 *
 * Hjem-knappen ligger fast oeverst til venstre, ogsaa midt i et loeb, og
 * foerer til menuen. Paa en iPad eller iPhone med siden paa hjemmeskaermen
 * er der ingen browser-tilbageknap, saa uden den her sidder man fast.
 *
 * Vend-skaermen vises i portraet paa spil der kraever landskab. Et spil
 * der virker i portraet saetter data-portraet="ok" paa <body>.
 * Ingen tekst: et telefon-ikon der drejer.
 */
(function () {
  'use strict';

  var stil = document.createElement('style');
  stil.textContent =
    '#hjem{position:fixed;z-index:30;display:flex;align-items:center;justify-content:center;' +
    'top:max(8px,env(safe-area-inset-top));left:max(8px,env(safe-area-inset-left));' +
    'width:48px;height:48px;border-radius:16px;background:#f7f3e8;border:3px solid #12261f;' +
    'box-shadow:3px 3px 0 #12261f;opacity:.85;text-decoration:none;-webkit-tap-highlight-color:transparent}' +
    '#hjem:active{transform:translate(2px,2px);box-shadow:1px 1px 0 #12261f}' +
    '#hjem svg{display:block}' +
    '#vend{position:fixed;inset:0;z-index:25;display:none;align-items:center;justify-content:center;' +
    'background:#1b4d3e;padding:24px}' +
    '#vend svg{width:min(50vw,220px);height:auto;animation:vend 2.2s ease-in-out infinite}' +
    '@keyframes vend{0%,25%{transform:rotate(0)}60%,100%{transform:rotate(-90deg)}}' +
    '@media (orientation:portrait){body:not([data-portraet="ok"]) #vend{display:flex}}';
  document.head.appendChild(stil);

  var hjem = document.createElement('a');
  hjem.id = 'hjem';
  hjem.href = '../../';
  hjem.setAttribute('aria-label', 'Til menuen');
  hjem.innerHTML =
    '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">' +
    '<path d="M4 15L15 5l11 10" fill="none" stroke="#12261f" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 13v11h6v-7h4v7h6V13" fill="#ffd23f" stroke="#12261f" stroke-width="3" stroke-linejoin="round"/>' +
    '</svg>';
  hjem.addEventListener('pointerdown', function (e) { e.stopPropagation(); });
  hjem.addEventListener('click', function () {
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  });

  var vend = document.createElement('div');
  vend.id = 'vend';
  vend.setAttribute('aria-label', 'Vend enheden om paa siden');
  vend.innerHTML =
    '<svg viewBox="0 0 120 200" aria-hidden="true">' +
    '<rect x="8" y="8" width="104" height="184" rx="18" fill="#f7f3e8" stroke="#12261f" stroke-width="6"/>' +
    '<rect x="20" y="28" width="80" height="140" rx="6" fill="#7fd0f5"/>' +
    '<circle cx="60" cy="181" r="5" fill="#12261f"/>' +
    '<path d="M40 98a20 20 0 0 1 34-14" fill="none" stroke="#12261f" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M74 72v14H60" fill="none" stroke="#12261f" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function saet() {
    document.body.appendChild(hjem);
    document.body.appendChild(vend);
  }
  if (document.body) saet(); else document.addEventListener('DOMContentLoaded', saet);
})();
