/**
 * Faelles ikoner til menuerne i alle spil.
 *
 * Boernene kan ikke laese, saa hver knap skal kunne forstaas paa billedet
 * alene: én eller to figurer for antal spillere, en trekant for start, en
 * pil rundt for igen, en pil tilbage for menuen, stjerner for svaerhed.
 * Tekst maa gerne staa der for de voksne, men den er aldrig noedvendig.
 *
 * Alle spil har samme raekkefoelge i menuen: overskrift, spillets egne valg
 * (bane, figur, bogstaver), stjerner, og nederst de store groenne
 * startknapper. Groen betyder "gaa i gang" i alle spil.
 *
 * Ikonerne er SVG i kode, ingen filer. Stilen laegges ind her, saa alle
 * spilsider faar den samme.
 */
(function () {
  'use strict';

  var K = '#12261f', KRIDT = '#f7f3e8';

  var stil = document.createElement('style');
  stil.textContent =
    /* Startknapper: store, groenne, kun et billede */
    '.knap.groen{background:#4cb944;color:#f7f3e8}' +
    '.knap.groen.valgt{background:#3aa7e0}' +
    '.knap.start{flex:1 1 0;display:flex;align-items:center;justify-content:center;padding:12px 16px;min-height:88px}' +
    '.knap.start svg{display:block;height:64px;width:auto}' +
    /* Valg af svaerhed og indstillinger: mindre og lettere, saa de ikke konkurrerer med start */
    '.raekke.valg .knap{flex:1 1 0;min-width:0;box-shadow:3px 3px 0 #12261f;border-width:3px;padding:9px 8px}' +
    '.raekke.valg .knap svg{display:block;height:30px;width:auto;max-width:100%}' +
    '.raekke.valg .knap.valgt{transform:translate(2px,2px);box-shadow:1px 1px 0 #12261f}' +
    /* Slutskaerme: igen, skift udseende, tilbage til menuen */
    '.raekke.slut{margin:0}' +
    '.raekke.slut .knap{flex:1 1 0;display:flex;align-items:center;justify-content:center;padding:14px 12px}' +
    '.raekke.slut .knap svg{display:block;height:46px;width:auto}' +
    '.knap.ikon.stor svg{height:48px;width:auto}' +
    '@media (max-height:520px){' +
    '.knap.start{min-height:0;padding:8px 12px}.knap.start svg{height:44px}' +
    '.raekke.slut .knap{padding:8px}.raekke.slut .knap svg{height:34px}' +
    '.raekke.valg .knap{padding:6px 10px}.raekke.valg .knap svg{height:24px}}';
  document.head.appendChild(stil);

  function svg(b, h, indhold) {
    return '<svg width="' + b + '" height="' + h + '" viewBox="0 0 ' + b + ' ' + h + '" aria-hidden="true">' + indhold + '</svg>';
  }

  function stjerne(cx, cy, r, fyld) {
    var d = '';
    for (var k = 0; k < 10; k++) {
      var rr = k % 2 ? r * 0.42 : r, v = -Math.PI / 2 + k * Math.PI / 5;
      d += (k ? 'L' : 'M') + (cx + Math.cos(v) * rr).toFixed(1) + ' ' + (cy + Math.sin(v) * rr).toFixed(1);
    }
    return '<path d="' + d + 'Z" fill="' + fyld + '" stroke="' + K + '" stroke-width="2.5" stroke-linejoin="round"/>';
  }

  /** Én, to eller tre gule stjerner. Antallet er forskellen, ikke fyldet, saa det kan ses paa afstand. */
  function stjerner(antal) {
    var b = 30 * antal + 4, s = '';
    for (var i = 0; i < antal; i++) s += stjerne(17 + i * 30, 16, 13, '#ffd23f');
    return svg(b, 32, s);
  }

  /** Et barn set forfra: rundt hoved og en bluse i spillerens farve. */
  function barn(x, farve) {
    return '<circle cx="' + (x + 22) + '" cy="16" r="12" fill="#f9d7b5" stroke="' + K + '" stroke-width="3"/>' +
      '<circle cx="' + (x + 17) + '" cy="15" r="1.8" fill="' + K + '"/><circle cx="' + (x + 27) + '" cy="15" r="1.8" fill="' + K + '"/>' +
      '<path d="M' + (x + 17) + ' 21q5 4 10 0" fill="none" stroke="' + K + '" stroke-width="2" stroke-linecap="round"/>' +
      '<path d="M' + (x + 4) + ' 56v-16a18 18 0 0 1 36 0v16z" fill="' + farve + '" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>';
  }

  /** Én eller to spillere: én figur, eller en roed og en blaa ved siden af hinanden. */
  function spillere(antal) {
    if (antal === 1) return svg(44, 58, barn(0, '#e8442e'));
    return svg(92, 58, barn(0, '#e8442e') + barn(48, '#3aa7e0'));
  }

  /** Start: en trekant, som paa en afspiller. */
  function start() {
    return svg(56, 56, '<circle cx="28" cy="28" r="25" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3"/>' +
      '<path d="M21 16l20 12-20 12z" fill="#4cb944" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>');
  }

  /** Igen: en pil der gaar rundt. */
  function igen() {
    return svg(56, 56, '<path d="M43 30a15 15 0 1 1-6-12" fill="none" stroke="' + K + '" stroke-width="6" stroke-linecap="round"/>' +
      '<path d="M32 8l12 9-13 7z" fill="' + K + '"/>');
  }

  /** Tilbage til menuen: en pil mod venstre. */
  function tilbage() {
    return svg(56, 56, '<path d="M46 28H16" fill="none" stroke="' + K + '" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M26 14L11 28l15 14" fill="none" stroke="' + K + '" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>');
  }

  /** Skift udseende: en malerpalet, saa man kan vaelge farve og form igen. */
  function palet() {
    return svg(56, 56, '<path d="M28 6C15 6 5 16 5 28c0 10 8 16 14 16 4 0 4-3 4-5 0-3 2-5 5-5h5c8 0 18-4 18-13C51 12 41 6 28 6z" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<circle cx="17" cy="22" r="4" fill="#e8442e"/><circle cx="27" cy="15" r="4" fill="#ffd23f"/><circle cx="38" cy="18" r="4" fill="#4cb944"/><circle cx="42" cy="29" r="4" fill="#3aa7e0"/>');
  }

  /** Vaelg bane: en lille rundbane. */
  function bane() {
    return svg(56, 56, '<rect x="6" y="12" width="44" height="32" rx="14" fill="none" stroke="#8a8f97" stroke-width="10"/>' +
      '<rect x="6" y="12" width="44" height="32" rx="14" fill="none" stroke="' + KRIDT + '" stroke-width="1.5" stroke-dasharray="4 4"/>' +
      '<circle cx="14" cy="16" r="4" fill="#ffd23f" stroke="' + K + '" stroke-width="2"/>');
  }

  /** Fri leg: en tallerken med et hjerte. Man laver det, man selv har lyst til. */
  function fri() {
    return svg(56, 56, '<ellipse cx="28" cy="40" rx="24" ry="9" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3"/>' +
      '<ellipse cx="28" cy="40" rx="15" ry="5" fill="none" stroke="' + K + '" stroke-width="2" opacity=".5"/>' +
      '<path d="M28 34l-11-11a6.5 6.5 0 0 1 11-7 6.5 6.5 0 0 1 11 7z" fill="#e8442e" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>');
  }

  /** Tegn alle: en blyant over tre kasser. */
  function tegnAlle() {
    return svg(64, 56, '<rect x="4" y="30" width="16" height="20" rx="4" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3"/>' +
      '<rect x="24" y="30" width="16" height="20" rx="4" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3"/>' +
      '<rect x="44" y="30" width="16" height="20" rx="4" fill="' + KRIDT + '" stroke="' + K + '" stroke-width="3"/>' +
      '<path d="M14 24l4-12 30-9 5 6-30 12z" fill="#ffd23f" stroke="' + K + '" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M14 24l4-12 5 4z" fill="' + K + '"/>');
  }

  /** Lyd til eller fra. */
  function lyd(til) {
    return svg(30, 30, '<path d="M4 11h6l7-6v20l-7-6H4z" fill="' + K + '"/>' +
      (til
        ? '<path d="M20 10c2 2.5 2 7.5 0 10M23.5 7c3.5 4.5 3.5 11.5 0 16" fill="none" stroke="' + K + '" stroke-width="2.5" stroke-linecap="round"/>'
        : '<path d="M20 11l7 8M27 11l-7 8" fill="none" stroke="#e8442e" stroke-width="3" stroke-linecap="round"/>'));
  }

  /* ---------- faerdige knapper og raekker ---------- */

  /** Tre stjerneknapper. Den valgte er blaa. */
  function stjerneRaekke(valgt, ekstra) {
    return '<div class="raekke valg">' + [0, 1, 2].map(function (n) {
      return '<button class="knap smal ikon' + (n === valgt ? ' valgt' : '') + '" data-handling="svaerhed" data-n="' + n +
             '" aria-label="' + (n + 1) + ' stjerner">' + stjerner(n + 1) + '</button>';
    }).join('') + (ekstra || '') + '</div>';
  }

  /** De to store groenne startknapper: én spiller og to spillere. */
  function startRaekke(handling) {
    return '<div class="raekke start">' +
      '<button class="knap groen start" data-handling="' + (handling || 'start') + '" data-spillere="1" aria-label="1 spiller">' + spillere(1) + '</button>' +
      '<button class="knap groen start" data-handling="' + (handling || 'start') + '" data-spillere="2" aria-label="2 spillere">' + spillere(2) + '</button>' +
      '</div>';
  }

  /** Lydknappen nederst. */
  function lydRaekke(til) {
    return '<div class="raekke bund"><button class="knap lille ikon" data-handling="lyd" aria-label="Lyd til eller fra">' + lyd(til) + '</button></div>';
  }

  /**
   * Slutskaerm: igen (gul), eventuelt skift udseende (palet), og tilbage til
   * menuen (pil). skift og menu er { handling, navn, ikon }; ikon kan udelades.
   */
  function slutRaekke(igenHandling, skift, menu) {
    menu = menu || {};
    return '<div class="raekke slut">' +
      '<button class="knap gul" data-handling="' + igenHandling + '" aria-label="Spil igen">' + igen() + '</button>' +
      (skift ? '<button class="knap" data-handling="' + skift.handling + '" aria-label="' + skift.navn + '">' + (skift.ikon || palet()) + '</button>' : '') +
      '<button class="knap" data-handling="' + (menu.handling || 'menu') + '" aria-label="' + (menu.navn || 'Menu') + '">' + (menu.ikon || tilbage()) + '</button>' +
      '</div>';
  }

  window.Menu = {
    stjerner: stjerner, spillere: spillere, start: start, igen: igen, tilbage: tilbage, palet: palet, bane: bane,
    fri: fri, tegnAlle: tegnAlle, lyd: lyd,
    stjerneRaekke: stjerneRaekke, startRaekke: startRaekke, lydRaekke: lydRaekke, slutRaekke: slutRaekke
  };
})();
