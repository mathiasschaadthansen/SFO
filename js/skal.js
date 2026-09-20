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
    'width:48px;height:48px;border-radius:18px;background:#f8f1e6;border:0;' +
    'box-shadow:0 5px 0 rgba(107,85,68,.18),0 8px 16px rgba(107,85,68,.18),inset 0 2px 0 rgba(255,255,255,.85);' +
    'opacity:.92;text-decoration:none;-webkit-tap-highlight-color:transparent}' +
    '#hjem:active{transform:translateY(3px);box-shadow:0 2px 0 rgba(107,85,68,.18)}' +
    '#hjem svg{display:block}' +
    '#vend{position:fixed;inset:0;z-index:25;display:none;align-items:center;justify-content:center;' +
    'background:#e5d3ae;padding:24px}' +
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
    '<path d="M4 15L15 5l11 10" fill="none" stroke="#6b5545" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>' +
    '<path d="M7 13v11h6v-7h4v7h6V13" fill="#f0c46a" stroke="#6b5545" stroke-width="3" stroke-linejoin="round"/>' +
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
    '<rect x="8" y="8" width="104" height="184" rx="18" fill="#f8f1e6" stroke="#6b5545" stroke-width="6"/>' +
    '<rect x="20" y="28" width="80" height="140" rx="6" fill="#b5d6e6"/>' +
    '<circle cx="60" cy="181" r="5" fill="#6b5545"/>' +
    '<path d="M40 98a20 20 0 0 1 34-14" fill="none" stroke="#6b5545" stroke-width="6" stroke-linecap="round"/>' +
    '<path d="M74 72v14H60" fill="none" stroke="#6b5545" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>' +
    '</svg>';

  function saet() {
    document.body.appendChild(hjem);
    document.body.appendChild(vend);
  }
  if (document.body) saet(); else document.addEventListener('DOMContentLoaded', saet);

  /*
   * Lyd paa iPhone. Spillenes lyd laves med Web Audio, og den regner iOS for "ringelyd": staar
   * knappen paa siden af telefonen paa lydloes, er spillet helt stumt, selv om lydstyrken er skruet
   * op. Her bedes iOS om at behandle siden som et spil (medieafspilning), saa lyden foelger
   * lydstyrke-knapperne i stedet. Nyere iOS har navigator.audioSession til det. Paa aeldre iOS
   * goer en loekke af stilhed i et <audio>-element det samme. Stilheden laves her i koden, saa
   * der hverken er en fil eller et netvaerkskald.
   */
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* ikke understoettet */ }

  var erIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (erIOS && !navigator.audioSession) {
    var stilhed = null;
    var startStilhed = function () {
      if (stilhed) { if (stilhed.paused) stilhed.play().catch(function () { /* naeste tryk proever igen */ }); return; }
      var n = 4000, buf = new ArrayBuffer(44 + n), v = new DataView(buf);
      function tekst(sted, t) { for (var i = 0; i < t.length; i++) v.setUint8(sted + i, t.charCodeAt(i)); }
      tekst(0, 'RIFF'); v.setUint32(4, 36 + n, true); tekst(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, 8000, true); v.setUint32(28, 8000, true); v.setUint16(32, 1, true); v.setUint16(34, 8, true); tekst(36, 'data'); v.setUint32(40, n, true);
      for (var i = 0; i < n; i++) v.setUint8(44 + i, 128);
      stilhed = document.createElement('audio');
      stilhed.setAttribute('playsinline', ''); stilhed.loop = true;
      stilhed.src = URL.createObjectURL(new Blob([buf], { type: 'audio/wav' }));
      stilhed.play().catch(function () { /* naeste tryk proever igen */ });
    };
    document.addEventListener('touchend', startStilhed, true);
    document.addEventListener('click', startStilhed, true);
    document.addEventListener('visibilitychange', function () { if (stilhed && document.hidden) stilhed.pause(); });
  }
})();
