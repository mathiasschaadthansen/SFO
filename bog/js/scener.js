/**
 * Bogens billeder: ét pr. opslag, tegnet i kode med spillenes malede figurer
 * sat ind. Alt tegnes i et felt paa 600 x 780 enheder (Bog.BREDDE x
 * Bog.HOEJDE); skaermen og printet skalerer det.
 *
 * Figurerne laanes fra spillene, saa bogen bruger de samme billeder, som
 * boernene kender: Pelle og skovens dyr fra Noeddeskoven, husene fra
 * Vrimleskoven, klatterne fra Boldbanen, Emil og Ella fra Boblehavet, gaesterne
 * fra Skovkoekkenet, robotten fra Bogstavvejen, bilen og rummusen fra forsiden.
 * Skaden er bogens egen (billeder/skade.png). Skruenoeglen tegnes i kode, saa
 * den er den samme paa alle opslag: traeskaft og graat hoved som Pelles.
 */
(function () {
  'use strict';

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var M = '../games/maskinen/billeder/', F = '../games/find/billeder/', K = '../games/klatbold/billeder/', B = '../games/bobler/billeder/', R = '../games/restaurant/billeder/', O = '../games/bogstaver/billeder/', A = '../assets/malet/';
  var BILLEDER = {
    pindsvin: M + 'pindsvin.png', kanin: M + 'kanin.png', bjoern: M + 'bjoern.png', raev: M + 'raev.png', ugle: M + 'ugle.png', froe: M + 'froe.png', mus: M + 'mus.png',
    trae: M + 'trae.png', gran: M + 'gran.png', siv: M + 'siv.png', svamp: M + 'svamp.png', klokke: M + 'klokke.png', aeble: M + 'aeble.png', kastanje: M + 'kastanje.png', lygte: M + 'lygte.png',
    hus1: F + 'hus1.png', hus2: F + 'hus2.png', hus3: F + 'hus3.png', bod: F + 'bod.png', broend: F + 'broend.png', baenk: F + 'baenk.png',
    klatRoed: K + 'klat-roed.png', klatBlaa: K + 'klat-blaa.png', dreng: B + 'dreng.png', pige: B + 'pige.png',
    gris: R + 'gris.png', pandekager: R + 'pandekager.png', kat: R + 'kat.png', hund: R + 'hund.png', tiger: R + 'tiger.png',
    robot: O + 'robot.png', hat: O + 'hat.png', and: O + 'and.png', bold: A + 'bold.png', bil: A + 'bil.png', rummus: A + 'rummus.png', hus: A + 'hus.png',
    skade: 'billeder/skade.png'
  };
  // De malede opslag (Gemini, se billeder/opslag/NOTICE.md) hentes sammen med figurerne
  if (window.Bog) { window.Bog.OPSLAG.forEach(function (o) { if (o.malet) BILLEDER['malet-' + o.id] = o.malet.fil; }); if (window.Bog.FORSIDE) BILLEDER['malet-forside'] = window.Bog.FORSIDE; }
  var billeder = {};
  function hentAlle(naarKlar) {
    var mangler = Object.keys(BILLEDER).length;
    Object.keys(BILLEDER).forEach(function (n) {
      var i = new Image(); i.src = BILLEDER[n]; billeder[n] = i;
      function faerdig() { mangler--; if (mangler === 0 && naarKlar) naarKlar(); }
      i.addEventListener('load', faerdig); i.addEventListener('error', faerdig);
    });
  }
  function klar(n) { var i = billeder[n]; return !!(i && i.complete && i.naturalWidth); }
  /** Et billede med midten i (x, y) og bredden s. bund: foedderne i y. spejl: vendt. */
  function tegn(c, n, x, y, s, valg) {
    valg = valg || {};
    var i = billeder[n]; if (!klar(n)) return;
    var h = s * i.naturalHeight / i.naturalWidth;
    c.save(); c.translate(x, y);
    if (valg.spejl) c.scale(-1, 1);
    if (valg.drej) c.rotate(valg.drej);
    c.drawImage(i, -s / 2, valg.bund ? -h : -h / 2, s, h);
    c.restore();
  }

  var froe = 1; function rnd() { froe = (froe * 1664525 + 1013904223) % 4294967296; return froe / 4294967296; }
  function rr(c, x, y, b, h, r, fyld, kant, lw) { c.fillStyle = fyld; c.beginPath(); c.roundRect(x, y, b, h, r); c.fill(); if (kant) { c.strokeStyle = kant; c.lineWidth = lw || 3; c.stroke(); } }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  function tone(h, k, a) { var r = rgb(h).map(function (v) { return Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)); }); return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + (a === undefined ? 1 : a) + ')'; }
  /** Akvarelvask i en polygon: fyld, lyse og moerke skyer, korn og bloed kant (som husene i Vrimleskoven). */
  function vask(c, pts, farve) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (p) { c.lineTo(p[0], p[1]); }); c.closePath();
    c.save(); c.clip();
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), b = x1 - x0, h = y1 - y0;
    c.fillStyle = farve; c.fillRect(x0 - 4, y0 - 4, b + 8, h + 8);
    for (var i = 0; i < 7; i++) { c.fillStyle = tone(farve, i % 2 ? 0.88 : 1.3, 0.1); c.beginPath(); c.ellipse(x0 + rnd() * b, y0 + rnd() * h, b * (0.2 + rnd() * 0.35), h * (0.15 + rnd() * 0.35), rnd() * 3, 0, 7); c.fill(); }
    c.fillStyle = tone(farve, 0.7, 0.06); for (var k = 0; k < b * h / 90; k++) { c.beginPath(); c.arc(x0 + rnd() * b, y0 + rnd() * h, 0.8 + rnd() * 1.2, 0, 7); c.fill(); }
    c.strokeStyle = tone(farve, 0.72, 0.5); c.lineWidth = 3; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); pts.slice(1).forEach(function (p) { c.lineTo(p[0], p[1]); }); c.closePath(); c.stroke();
    c.restore();
  }
  function himmel(c, W, H, top, bund, til) { var g = c.createLinearGradient(0, 0, 0, til || H * 0.5); g.addColorStop(0, top); g.addColorStop(1, bund); c.fillStyle = g; c.fillRect(0, 0, W, H); }
  function sky(c, x, y, k) { c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(x, y, 24 * k, 0, 7); c.arc(x + 26 * k, y - 10 * k, 30 * k, 0, 7); c.arc(x + 56 * k, y, 22 * k, 0, 7); c.fill(); }
  function fugl(c, x, y, s) { c.strokeStyle = KANT; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s / 2, y - s * 0.8, x, y); c.quadraticCurveTo(x + s / 2, y - s * 0.8, x + s, y); c.stroke(); }
  function graes(c, x, y, k) { k = k || 1; c.strokeStyle = '#5f8240'; c.lineWidth = 2 * k; c.lineCap = 'round'; [-6, 0, 6].forEach(function (d, i) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d * k, y - 8 * k, x + d * 1.4 * k, y - (14 - (i % 2) * 3) * k); c.stroke(); }); }
  function blomst(c, x, y, f, k) { k = k || 1; c.strokeStyle = '#5f8240'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 12 * k); c.stroke(); c.fillStyle = f; for (var i = 0; i < 5; i++) { var v = i * Math.PI * 2 / 5; c.beginPath(); c.arc(x + Math.cos(v) * 4 * k, y - 14 * k + Math.sin(v) * 4 * k, 3.2 * k, 0, 7); c.fill(); } c.fillStyle = GUL; c.beginPath(); c.arc(x, y - 14 * k, 2.2 * k, 0, 7); c.fill(); }
  function sten(c, x, y, r) { c.fillStyle = '#b8b2a4'; c.beginPath(); c.ellipse(x, y, r, r * 0.65, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.2, 0, 0, 7); c.fill(); }
  function strø(c, antal, x0, x1, y0, y1, k) { var farver = ['#d95f45', '#9b7bd4', '#f8f1e6', '#f0c46a']; for (var i = 0; i < antal; i++) { var x = x0 + rnd() * (x1 - x0), y = y0 + rnd() * (y1 - y0); if (i % 4 === 0) sten(c, x, y, (5 + rnd() * 5) * (k || 1)); else if (i % 4 === 1) blomst(c, x, y, farver[i % 4], k); else graes(c, x, y, k); } }
  function bakke(c, W, y, farve, a, b) { c.fillStyle = farve; c.beginPath(); c.moveTo(0, y + (a || 0)); c.quadraticCurveTo(W * 0.3, y - 30, W * 0.6, y); c.quadraticCurveTo(W * 0.85, y + 18, W, y + (b || -20)); c.lineTo(W, 900); c.lineTo(0, 900); c.fill(); }
  function skygge(c, x, y, b) { c.fillStyle = 'rgba(94,74,58,.14)'; c.beginPath(); c.ellipse(x, y, b, b * 0.16, 0, 0, 7); c.fill(); }

  /** Pelles skruenoegle: lige traeskaft med runde ender og et graat gaffelhoved med gab, som den han holder. s er laengden. */
  function noegle(c, x, y, s, v) {
    c.save(); c.translate(x, y); c.rotate(v || 0);
    c.lineJoin = 'round'; c.lineCap = 'round';
    var R = s * 0.2, cy = -s * 0.3, w = R * 0.7, d = R * 1.05, a = Math.asin(w / 2 / R);
    // skaftet: brunt trae med en lys kant, som Pelles
    c.strokeStyle = '#6a4a2c'; c.lineWidth = s * 0.2; c.beginPath(); c.moveTo(0, cy); c.lineTo(0, s * 0.5); c.stroke();
    c.strokeStyle = '#a5683a'; c.lineWidth = s * 0.15; c.stroke();
    c.strokeStyle = 'rgba(255,225,190,.45)'; c.lineWidth = s * 0.035; c.beginPath(); c.moveTo(-s * 0.03, cy + R * 0.6); c.lineTo(-s * 0.03, s * 0.44); c.stroke();
    // hovedet: en cirkel med et gab oeverst, drejet lidt som paa Pelles
    c.save(); c.translate(0, cy); c.rotate(-0.35);
    var g = c.createLinearGradient(-R, -R, R, R); g.addColorStop(0, '#e9e6df'); g.addColorStop(0.5, '#b6b9bd'); g.addColorStop(1, '#7d8286');
    c.fillStyle = g; c.strokeStyle = '#4f5559'; c.lineWidth = Math.max(1.5, s * 0.03);
    c.beginPath(); c.arc(0, 0, R, -Math.PI / 2 + a, -Math.PI / 2 - a + Math.PI * 2); c.lineTo(-w / 2, -R + d); c.lineTo(w / 2, -R + d); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.4)'; c.beginPath(); c.arc(-R * 0.3, R * 0.25, R * 0.28, 0, 7); c.fill();
    c.restore();
    c.restore();
  }
  /** Skaden. Sidder hun (flyver: false), staar foedderne i y; flyver hun, er (x, y) midten, og hun haelder fremad. Naebbet er oeverst til hoejre. */
  function skade(c, o) {
    if (!o.skade) return;
    var s = o.skade;
    c.save();
    if (s.flyver) { c.translate(s.x, s.y); c.rotate(-0.5); tegn(c, 'skade', 0, 0, s.s); }
    else { skygge(c, s.x, s.y, s.s * 0.4); tegn(c, 'skade', s.x, s.y, s.s, { bund: true }); }
    c.restore();
  }
  /** En bakke med akvarelvask, saa jorden ikke er en flad farve. */
  function jord(c, W, y, farve, a, b) {
    bakke(c, W, y, farve, a, b);
    c.save(); c.beginPath(); c.moveTo(0, y + (a || 0)); c.quadraticCurveTo(W * 0.3, y - 30, W * 0.6, y); c.quadraticCurveTo(W * 0.85, y + 18, W, y + (b || -20)); c.lineTo(W, 900); c.lineTo(0, 900); c.clip();
    for (var i = 0; i < 9; i++) { c.fillStyle = tone(farve, i % 2 ? 0.9 : 1.25, 0.14); c.beginPath(); c.ellipse(rnd() * W, y + rnd() * 300, 90 + rnd() * 160, 18 + rnd() * 40, (rnd() - 0.5) * 0.4, 0, 7); c.fill(); }
    c.restore();
  }
  /** En figur, der staar paa jorden: skygge foerst, saa billedet med foedderne i y. */
  function staar(c, n, x, y, s, valg) { skygge(c, x, y - 2, s * 0.42); tegn(c, n, x, y, s, Object.assign({ bund: true }, valg || {})); }
  function vindue(c, x, y, b, h) {
    rr(c, x, y, b, h, 6, '#c9e0ea', '#8a663d', 4);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(x + 6, y + h - 6); c.lineTo(x + b * 0.5, y + 6); c.lineTo(x + b * 0.7, y + 6); c.lineTo(x + 6, y + h * 0.75); c.fill();
    c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.beginPath(); c.moveTo(x + b / 2, y); c.lineTo(x + b / 2, y + h); c.moveTo(x, y + h / 2); c.lineTo(x + b, y + h / 2); c.stroke();
    rr(c, x - 8, y + h - 2, b + 16, 10, 3, '#d9ba8a', '#8a663d', 2);
  }
  /** Ansigtet paa en malet klat: samme plads som i Boldbanen (R = kroppens halve bredde / 2.15). */
  function klatAnsigt(c, x, y, R, side, glad) {
    var ox = x + side * R * 0.32, oy = y - R * 0.8;
    [-1, 1].forEach(function (d) { var cx = ox + d * R * 0.3; c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, oy, R * 0.18, 0, 7); c.fill(); c.strokeStyle = 'rgba(94,74,58,.5)'; c.lineWidth = 1.5; c.stroke(); c.fillStyle = KANT; c.beginPath(); c.arc(cx + side * R * 0.06, oy + R * 0.02, R * 0.085, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.9)'; c.beginPath(); c.arc(cx + side * R * 0.03, oy - R * 0.02, R * 0.03, 0, 7); c.fill(); });
    c.strokeStyle = KANT; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath();
    if (glad) c.arc(ox, oy + R * 0.22, R * 0.2, 0.15, Math.PI - 0.15); else c.arc(ox, oy + R * 0.28, R * 0.13, 0.3, Math.PI - 0.3);
    c.stroke();
  }
  function klat(c, navn, x, y, b, side, glad) { tegn(c, navn, x, y, b, { bund: true }); klatAnsigt(c, x, y, b / 2.15, side, glad); }
  function maal(c, x, y, h, side) {
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 1.2;
    for (var i = 0; i <= 5; i++) { c.beginPath(); c.moveTo(x, y - h + i * h / 5); c.lineTo(x + side * 56, y - h + i * h / 5); c.stroke(); c.beginPath(); c.moveTo(x + side * i * 56 / 5, y - h); c.lineTo(x + side * i * 56 / 5, y); c.stroke(); }
    c.strokeStyle = '#b18a56'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - h); c.lineTo(x + side * 56, y - h); c.stroke();
  }
  function boble(c, x, y, r, farve) {
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.1, x, y, r); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.25, farve); g.addColorStop(1, farve);
    c.fillStyle = g; c.globalAlpha = 0.85; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 2; c.stroke();
  }
  function skilt(c, x, y, tekst, farve) {
    c.strokeStyle = '#8a663d'; c.lineWidth = 6; c.lineCap = 'round'; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 70); c.stroke();
    vask(c, [[x - 34, y - 110], [x + 34, y - 110], [x + 34, y - 62], [x - 34, y - 62]], farve || '#d9ba8a');
    c.fillStyle = KANT; c.font = '800 34px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tekst, x, y - 85);
  }
  function stjerne(c, x, y, r, f) { c.fillStyle = f || GUL; c.beginPath(); for (var j = 0; j < 10; j++) { var rr2 = j % 2 ? r * 0.42 : r, v = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(x + Math.cos(v) * rr2, y + Math.sin(v) * rr2); } c.closePath(); c.fill(); }
  function taleboble(c, x, y, tekst) {
    rr(c, x - 36, y - 30, 72, 60, 20, PAPIR, KANT, 3);
    c.fillStyle = PAPIR; c.beginPath(); c.moveTo(x - 10, y + 28); c.lineTo(x + 4, y + 46); c.lineTo(x + 12, y + 28); c.fill(); c.strokeStyle = KANT; c.lineWidth = 3; c.beginPath(); c.moveTo(x - 10, y + 29); c.lineTo(x + 4, y + 46); c.lineTo(x + 12, y + 29); c.stroke();
    c.fillStyle = KANT; c.font = '800 40px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(tekst, x, y + 2);
  }

  /* ---------------- de ti opslag ---------------- */
  var SCENER = {
    noeddeskoven: function (c, W, H, o) {
      himmel(c, W, H, '#bcd8ea', '#eef2e0', 420); sky(c, 70, 100, 1.1); sky(c, 300, 60, 0.8); fugl(c, 210, 150, 9); fugl(c, 245, 138, 7);
      jord(c, W, 330, '#93bc63');
      staar(c, 'trae', 80, 340, 190); staar(c, 'gran', 320, 322, 140); staar(c, 'trae', 545, 335, 160);
      jord(c, W, 470, '#a9c97a', 0, 10);
      // Pelles vaerkstedsbord af en stamme, med klokken og et aeble paa
      skygge(c, 300, 604, 150); rr(c, 170, 560, 260, 40, 16, '#b18a56', '#8a663d', 3); c.strokeStyle = 'rgba(94,74,58,.3)'; c.lineWidth = 2; c.beginPath(); c.moveTo(190, 574); c.lineTo(410, 574); c.moveTo(200, 588); c.lineTo(400, 588); c.stroke();
      tegn(c, 'klokke', 340, 562, 60, { bund: true }); tegn(c, 'aeble', 260, 562, 42, { bund: true });
      strø(c, 22, 0, W, 500, 760, 1); staar(c, 'svamp', 470, 700, 46); staar(c, 'kastanje', 520, 690, 34); staar(c, 'lygte', 560, 585, 46);
      staar(c, 'pindsvin', 150, 762, 250);
      skade(c, o);
    },
    susebanen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#e4eef2', 380); sky(c, 100, 80, 1); sky(c, 420, 120, 0.8); fugl(c, 300, 60, 9);
      jord(c, W, 330, '#93bc63');
      staar(c, 'trae', 60, 340, 130); staar(c, 'gran', 560, 330, 120); staar(c, 'siv', 300, 345, 60);
      // banen: en sloejfe af sand med hvid midterstribe, som i spillet, set lidt ovenfra
      function sloejfe() { c.beginPath(); c.moveTo(250, 720); c.quadraticCurveTo(230, 470, 380, 440); c.quadraticCurveTo(560, 420, 560, 560); c.quadraticCurveTo(560, 700, 420, 720); c.quadraticCurveTo(320, 730, 250, 720); c.closePath(); }
      c.strokeStyle = '#d9ba8a'; c.lineWidth = 84; c.lineJoin = 'round'; sloejfe(); c.stroke(); c.strokeStyle = '#e5d3ae'; c.lineWidth = 72; sloejfe(); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 3; c.setLineDash([16, 14]); sloejfe(); c.stroke(); c.setLineDash([]);
      // daekstablen ved svinget, hvor noeglen ligger
      skygge(c, 525, 612, 46); [0, 1, 2].forEach(function (i) { var y = 605 - i * 20; c.fillStyle = '#3e3733'; c.beginPath(); c.ellipse(525, y, 34, 13, 0, 0, 7); c.fill(); c.fillStyle = '#5a524b'; c.beginPath(); c.ellipse(525, y - 5, 34, 13, 0, 0, 7); c.fill(); c.fillStyle = '#e5d3ae'; c.beginPath(); c.ellipse(525, y - 5, 13, 5, 0, 0, 7); c.fill(); });
      // bilen paa banen med stoev bag sig
      c.fillStyle = 'rgba(217,186,138,.8)'; [[318, 706, 13], [292, 712, 9], [270, 716, 6]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
      skygge(c, 395, 712, 50); tegn(c, 'bil', 395, 715, 118, { bund: true, drej: -0.2 });
      strø(c, 14, 0, 220, 380, 760, 0.9); strø(c, 8, 250, W, 380, 430, 0.9);
      staar(c, 'raev', 175, 690, 130);
      staar(c, 'pindsvin', 90, 740, 190);
    },
    boldbanen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#e4eef2', 420); c.fillStyle = '#f0c46a'; c.beginPath(); c.arc(90, 100, 42, 0, 7); c.fill(); c.fillStyle = 'rgba(240,196,106,.35)'; c.beginPath(); c.arc(90, 100, 60, 0, 7); c.fill();
      sky(c, 200, 150, 0.9); sky(c, 400, 80, 1);
      jord(c, W, 400, '#93bc63');
      staar(c, 'trae', 40, 410, 120); staar(c, 'gran', 570, 400, 110);
      // banen: klippet graes med striber, midterlinje og straffesparksfelter
      c.fillStyle = '#a9c97a'; c.fillRect(0, 520, W, H); c.fillStyle = 'rgba(255,255,255,.08)'; for (var y = 520; y < H; y += 60) c.fillRect(0, y, W, 30);
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = 4; c.beginPath(); c.moveTo(W / 2, 520); c.lineTo(W / 2, H); c.moveTo(0, 520); c.lineTo(W, 520); c.stroke(); c.beginPath(); c.arc(W / 2, 660, 60, 0, 7); c.stroke();
      maal(c, 8, 640, 130, 1); maal(c, W - 8, 640, 130, -1);
      // bolden hoejt oppe med tre fartstreger bag sig
      c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 3; c.lineCap = 'round'; [[470, 250], [455, 270], [445, 292]].forEach(function (p, i) { c.beginPath(); c.moveTo(p[0], p[1]); c.lineTo(p[0] - 30 + i * 4, p[1] + 24); c.stroke(); });
      tegn(c, 'bold', 520, 230, 66);
      skygge(c, 330, 640, 50); klat(c, 'klatRoed', 330, 640, 104, 1, true);
      skygge(c, 470, 660, 44); klat(c, 'klatBlaa', 470, 660, 92, -1, true);
      // Pelle er maalmand foran maalet til venstre
      staar(c, 'pindsvin', 120, 740, 190);
    },
    boblehavet: function (c, W, H, o) {
      var g = c.createLinearGradient(0, 0, 0, 520); g.addColorStop(0, '#5f5a8c'); g.addColorStop(0.5, '#d98a72'); g.addColorStop(1, '#f0c46a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(255,255,255,.35)'; [[80, 380, 60, 8], [470, 420, 80, 9], [220, 450, 50, 6]].forEach(function (p) { c.beginPath(); c.ellipse(p[0], p[1], p[2], p[3], 0, 0, 7); c.fill(); });
      // solen halvt i havet, havet med boelger, stranden med sand
      c.fillStyle = '#f7d27a'; c.beginPath(); c.arc(400, 520, 70, Math.PI, 0); c.fill();
      var hav = c.createLinearGradient(0, 520, 0, 620); hav.addColorStop(0, '#7fb6d6'); hav.addColorStop(1, '#4f8fb8'); c.fillStyle = hav; c.fillRect(0, 520, W, 110);
      c.fillStyle = 'rgba(255,255,255,.5)'; for (var i = 0; i < 14; i++) { c.beginPath(); c.ellipse(20 + i * 46 + (i % 2) * 14, 540 + (i % 3) * 22, 20, 4, 0, 0, 7); c.fill(); }
      c.fillStyle = '#e5d3ae'; c.beginPath(); c.moveTo(0, 630); c.quadraticCurveTo(300, 610, W, 632); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(0, 630); c.quadraticCurveTo(300, 610, W, 632); c.quadraticCurveTo(300, 618, 0, 636); c.fill();
      c.fillStyle = 'rgba(94,74,58,.1)'; for (var k = 0; k < 70; k++) { c.beginPath(); c.arc(rnd() * W, 640 + rnd() * 140, 1.5, 0, 7); c.fill(); }
      // boblerne stiger op af vandet; en skal, en sok, og noeglen i den sidste helt derude
      [[110, 400, 46, '#7ab648'], [250, 290, 40, '#3f9ad6'], [340, 450, 30, '#f2c14e'], [190, 530, 20, '#ef94b8'], [528, 300, 40, '#9b7bd4'], [470, 480, 16, '#8fc7e8']].forEach(function (b) { boble(c, b[0], b[1], b[2], b[3]); });
      c.fillStyle = '#f3e9d8'; c.beginPath(); c.moveTo(94, 408); c.quadraticCurveTo(110, 376, 126, 408); c.closePath(); c.fill(); c.strokeStyle = '#b18a56'; c.lineWidth = 1.5; c.stroke(); c.beginPath(); c.moveTo(110, 380); c.lineTo(104, 404); c.moveTo(110, 380); c.lineTo(116, 404); c.stroke();
      c.fillStyle = '#d95f45'; c.beginPath(); c.roundRect(240, 276, 18, 26, 5); c.fill(); c.fillStyle = PAPIR; c.fillRect(240, 276, 18, 6);
      c.strokeStyle = PAPIR; c.lineWidth = 3; c.lineCap = 'round'; for (var a = 0; a < 8; a++) { var v = a * Math.PI / 4; c.beginPath(); c.moveTo(340 + Math.cos(v) * 36, 450 + Math.sin(v) * 36); c.lineTo(340 + Math.cos(v) * 46, 450 + Math.sin(v) * 46); c.stroke(); }
      staar(c, 'dreng', 360, 740, 84); staar(c, 'pige', 460, 745, 100);
      staar(c, 'pindsvin', 150, 760, 210);
      skade(c, o);
    },
    bogstavvejen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#e4eef2', 380); sky(c, 90, 90, 1); sky(c, 380, 60, 0.7);
      jord(c, W, 330, '#93bc63'); staar(c, 'trae', 70, 345, 140); staar(c, 'gran', 560, 330, 120);
      // vejen af sand, hvor Ulla skriver bogstaverne
      c.fillStyle = '#e5d3ae'; c.beginPath(); c.moveTo(0, 470); c.quadraticCurveTo(300, 440, W, 470); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.fillStyle = 'rgba(94,74,58,.08)'; for (var k = 0; k < 80; k++) { c.beginPath(); c.arc(rnd() * W, 480 + rnd() * 300, 1.5, 0, 7); c.fill(); }
      c.strokeStyle = '#b18a56'; c.lineWidth = 8; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(260, 740); c.lineTo(260, 650); c.lineTo(330, 740); c.lineTo(330, 650); c.stroke();
      c.strokeStyle = 'rgba(177,138,86,.5)'; c.beginPath(); c.moveTo(400, 740); c.lineTo(400, 660); c.quadraticCurveTo(470, 660, 440, 700); c.lineTo(400, 700); c.stroke();
      // skiltene langs vejen; skaden sidder paa det sidste
      skilt(c, 110, 460, 'N', '#d9ba8a'); skilt(c, 300, 445, 'P', '#aed3e4'); skilt(c, 470, 460, 'S', '#f0c46a');
      strø(c, 12, 0, W, 350, 440, 0.9);
      // Ulla med fjeren
      staar(c, 'ugle', 450, 740, 130);
      c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.moveTo(398, 690); c.quadraticCurveTo(370, 660, 350, 690); c.stroke(); c.fillStyle = '#f3e9d8'; c.beginPath(); c.ellipse(358, 674, 16, 7, -0.7, 0, 7); c.fill(); c.strokeStyle = '#b18a56'; c.lineWidth = 1; c.beginPath(); c.moveTo(346, 686); c.lineTo(370, 662); c.stroke();
      staar(c, 'pindsvin', 130, 760, 200);
      skade(c, o);
    },
    rimhulen: function (c, W, H, o) {
      // hulen set indefra: klippevaegge, en aabning til hoejre ud til dagen, hvor laden ligger
      himmel(c, W, H, '#8fc7e8', '#e4eef2', 300); jord(c, W, 300, '#93bc63');
      // laden ude paa marken
      rr(c, 470, 250, 90, 70, 4, '#c8624a', KANT, 2); c.fillStyle = '#8a663d'; c.beginPath(); c.moveTo(462, 252); c.lineTo(515, 212); c.lineTo(568, 252); c.closePath(); c.fill(); rr(c, 500, 280, 30, 40, 3, '#5e4a3a');
      vask(c, [[0, 0], [W, 0], [W, 70], [470, 110], [410, 230], [420, 360], [470, 450], [W, 480], [W, H], [0, H]], '#6b5545');
      vask(c, [[0, 0], [W, 0], [W, 50], [430, 40], [300, 100], [120, 60], [0, 90]], '#5e4a3a');
      vask(c, [[0, 200], [60, 180], [110, 300], [40, 420], [0, 400]], '#5e4a3a');
      c.fillStyle = '#4a3a2c'; c.fillRect(0, 660, W, H); c.fillStyle = 'rgba(255,255,255,.05)'; for (var i = 0; i < 40; i++) { c.beginPath(); c.ellipse(rnd() * W, 660 + rnd() * 120, 10 + rnd() * 30, 3 + rnd() * 4, 0, 0, 7); c.fill(); }
      // baalet og dets lys
      var b = c.createRadialGradient(200, 640, 10, 200, 640, 280); b.addColorStop(0, 'rgba(240,196,106,.5)'); b.addColorStop(1, 'rgba(240,196,106,0)'); c.fillStyle = b; c.fillRect(0, 300, W, 480);
      c.fillStyle = '#8a663d'; [[-1, 0.35], [1, -0.35]].forEach(function (p) { c.save(); c.translate(200, 660); c.rotate(p[1]); c.beginPath(); c.roundRect(-36, -7, 72, 14, 6); c.fill(); c.restore(); });
      c.fillStyle = '#e08a52'; c.beginPath(); c.moveTo(168, 654); c.quadraticCurveTo(178, 590, 200, 570); c.quadraticCurveTo(222, 600, 232, 654); c.fill(); c.fillStyle = GUL; c.beginPath(); c.moveTo(184, 654); c.quadraticCurveTo(192, 616, 200, 600); c.quadraticCurveTo(210, 620, 216, 654); c.fill();
      // rimkortene paa gulvet, som i spillet
      [[290, 700, 'kat'], [370, 712, 'hat']].forEach(function (k) { c.save(); c.translate(k[0], k[1]); c.rotate((k[0] - 330) / 600); rr(c, -30, -38, 60, 76, 8, PAPIR, KANT, 2); tegn(c, k[2], 0, -2, 42); c.restore(); });
      staar(c, 'bjoern', 470, 735, 200);
      staar(c, 'pindsvin', 100, 760, 180);
      skade(c, o);
    },
    vrimleskoven: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#e4eef2', 300); sky(c, 100, 60, 0.9); fugl(c, 300, 90, 9);
      jord(c, W, 280, '#93bc63');
      staar(c, 'trae', 40, 300, 110); staar(c, 'hus1', 130, 290, 130); staar(c, 'hus3', 300, 282, 130); staar(c, 'hus2', 480, 288, 130); staar(c, 'gran', 575, 292, 100);
      // brostensvejen og pladsen med boden, broenden og baenken
      c.fillStyle = '#e5d3ae'; c.fillRect(0, 330, W, 120); c.strokeStyle = 'rgba(94,74,58,.16)'; c.lineWidth = 1.5; for (var r = 0; r < 5; r++) for (var x = (r % 2) * 21 - 10; x < W; x += 42) { c.beginPath(); c.roundRect(x, 334 + r * 24, 36, 20, 6); c.stroke(); }
      jord(c, W, 450, '#a9c97a', 0, 0);
      staar(c, 'bod', 110, 450, 160); staar(c, 'broend', 330, 452, 84); staar(c, 'baenk', 500, 450, 110);
      // tingene ligger i vinduer, paa baenken og bag hegnet, som i spillet
      tegn(c, 'kat', 486, 226, 30); tegn(c, 'bold', 512, 428, 30); tegn(c, 'and', 372, 440, 34); tegn(c, 'hat', 150, 370, 34);
      // toerresnoren, hvor skaden sad: nu er der kun en fjer
      c.strokeStyle = '#8a663d'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(200, 590); c.lineTo(200, 490); c.moveTo(400, 590); c.lineTo(400, 490); c.stroke(); c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(200, 494); c.quadraticCurveTo(300, 512, 400, 494); c.stroke();
      ['#d95f45', '#8fc7e8', '#f0c46a'].forEach(function (f, i) { rr(c, 236 + i * 44, 500 + (i % 2) * 4, 18, 24, 4, f, KANT, 2); });
      c.save(); c.translate(300, 560); c.rotate(0.5); c.fillStyle = KANT; c.beginPath(); c.ellipse(0, 0, 5, 18, 0, 0, 7); c.fill(); c.strokeStyle = PAPIR; c.lineWidth = 1; c.beginPath(); c.moveTo(0, -16); c.lineTo(0, 14); c.stroke(); c.restore();
      // stakittet med hunden bag
      tegn(c, 'hund', 480, 610, 44);
      var x0 = 410, x1 = 560, y = 660, h = 44; c.strokeStyle = '#b18a56'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y - h * 0.7); c.lineTo(x1, y - h * 0.7); c.moveTo(x0, y - h * 0.3); c.lineTo(x1, y - h * 0.3); c.stroke();
      for (var px = x0 + 5; px < x1; px += 20) { c.fillStyle = '#d9ba8a'; c.beginPath(); c.moveTo(px - 5, y); c.lineTo(px - 5, y - h * 0.85); c.lineTo(px, y - h); c.lineTo(px + 5, y - h * 0.85); c.lineTo(px + 5, y); c.closePath(); c.fill(); c.strokeStyle = tone('#d9ba8a', 0.65, 0.6); c.lineWidth = 2; c.stroke(); }
      strø(c, 20, 0, W, 600, 770, 0.9);
      staar(c, 'kanin', 270, 745, 120);
      staar(c, 'pindsvin', 110, 765, 180);
      skade(c, o);
    },
    tegnestuen: function (c, W, H, o) {
      // vaerkstedet: lys vaeg, vindue med udsigt, plankegulv
      c.fillStyle = '#f3e9d8'; c.fillRect(0, 0, W, H); c.fillStyle = 'rgba(94,74,58,.05)'; for (var i = 0; i < 14; i++) { c.beginPath(); c.ellipse(rnd() * W, rnd() * 540, 60 + rnd() * 120, 20 + rnd() * 50, 0, 0, 7); c.fill(); }
      c.save(); c.beginPath(); c.rect(60, 90, 150, 170); c.clip(); himmel(c, W, H, '#8fc7e8', '#e4eef2', 300); jord(c, W, 200, '#93bc63'); tegn(c, 'trae', 100, 205, 90, { bund: true }); c.restore(); vindue(c, 60, 90, 150, 170);
      vask(c, [[0, 545], [W, 545], [W, H], [0, H]], '#d9ba8a'); c.strokeStyle = 'rgba(94,74,58,.22)'; c.lineWidth = 2; for (var y = 575; y < H; y += 32) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      // staffeliet med plakaten af noeglen
      skygge(c, 415, 700, 110);
      c.strokeStyle = '#8a663d'; c.lineWidth = 9; c.lineCap = 'round'; c.beginPath(); c.moveTo(335, 700); c.lineTo(385, 190); c.moveTo(495, 700); c.lineTo(445, 190); c.moveTo(415, 700); c.lineTo(415, 520); c.moveTo(330, 505); c.lineTo(500, 505); c.stroke();
      rr(c, 300, 225, 230, 285, 4, PAPIR, KANT, 3); c.fillStyle = 'rgba(94,74,58,.08)'; c.fillRect(300, 500, 230, 10);
      noegle(c, 415, 350, 150, 0.45);
      c.strokeStyle = '#d95f45'; c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.arc(415, 360, 95, 0, 7); c.stroke();
      // malerboetter paa gulvet; i den groenne staar noeglen
      [[110, 700, '#d95f45'], [180, 712, '#5f9fc9'], [548, 700, '#7ab648']].forEach(function (b) { skygge(c, b[0], b[1] + 2, 30); rr(c, b[0] - 26, b[1] - 50, 52, 50, 6, '#b8b2a4', KANT, 2.5); c.fillStyle = b[2]; c.beginPath(); c.ellipse(b[0], b[1] - 50, 26, 8, 0, 0, 7); c.fill(); });
      // penslen laener sig op ad staffeliet
      c.strokeStyle = '#8a663d'; c.lineWidth = 6; c.beginPath(); c.moveTo(318, 700); c.lineTo(345, 600); c.stroke(); c.fillStyle = '#5f9fc9'; c.beginPath(); c.ellipse(348, 592, 8, 14, 0.27, 0, 7); c.fill();
      staar(c, 'robot', 250, 720, 130);
      staar(c, 'pindsvin', 100, 640, 170);
    },
    stjerneuret: function (c, W, H, o) {
      var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#22284f'); g.addColorStop(0.65, '#3f4573'); g.addColorStop(1, '#5a5f80'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (var i = 0; i < 70; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.35 + rnd() * 0.65) + ')'; c.beginPath(); c.arc(rnd() * W, rnd() * 560, 0.8 + rnd() * 1.6, 0, 7); c.fill(); }
      stjerne(c, 70, 110, 11); stjerne(c, 540, 70, 8); stjerne(c, 500, 430, 7); stjerne(c, 150, 420, 6);
      // det store ur med viserne paa syv
      c.fillStyle = 'rgba(240,196,106,.18)'; c.beginPath(); c.arc(300, 250, 150, 0, 7); c.fill();
      c.fillStyle = '#f3e9d8'; c.beginPath(); c.arc(300, 250, 120, 0, 7); c.fill(); c.strokeStyle = GUL; c.lineWidth = 8; c.stroke();
      for (var t = 0; t < 12; t++) { var v = t * Math.PI / 6; c.fillStyle = KANT; c.beginPath(); c.arc(300 + Math.cos(v) * 100, 250 + Math.sin(v) * 100, t % 3 === 0 ? 6 : 3.5, 0, 7); c.fill(); }
      c.strokeStyle = KANT; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(300, 250); c.lineTo(300 + Math.cos(Math.PI * 7 / 6 - Math.PI / 2) * 60, 250 + Math.sin(Math.PI * 7 / 6 - Math.PI / 2) * 60); c.stroke(); c.lineWidth = 5; c.beginPath(); c.moveTo(300, 250); c.lineTo(300, 160); c.stroke(); c.fillStyle = KANT; c.beginPath(); c.arc(300, 250, 8, 0, 7); c.fill();
      // planeter og Milo, der svaever
      c.fillStyle = '#e08a52'; c.beginPath(); c.arc(520, 200, 28, 0, 7); c.fill(); c.strokeStyle = '#f0c46a'; c.lineWidth = 4; c.beginPath(); c.ellipse(520, 200, 44, 10, -0.3, 0, 7); c.stroke();
      c.fillStyle = '#5f9fc9'; c.beginPath(); c.arc(70, 300, 22, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.25)'; c.beginPath(); c.arc(62, 292, 8, 0, 7); c.fill();
      tegn(c, 'rummus', 480, 380, 120);
      // jorden: moerke bakker, et lille hus langt vaek (Skovkoekkenet, hvor skaden sidder), traeet Pelle sover under
      jord(c, W, 560, '#3a5236'); c.fillStyle = '#44603f'; c.beginPath(); c.moveTo(0, 600); c.quadraticCurveTo(120, 560, 260, 610); c.lineTo(260, H); c.lineTo(0, H); c.fill();
      tegn(c, 'hus', 100, 565, 90, { bund: true }); c.fillStyle = 'rgba(240,196,106,.9)'; c.fillRect(84, 545, 8, 9); c.fillRect(110, 545, 8, 9);
      staar(c, 'trae', 430, 610, 180);
      skygge(c, 320, 700, 90); tegn(c, 'pindsvin', 330, 700, 160, { bund: true, drej: -0.22 });
      c.fillStyle = 'rgba(248,241,230,.85)'; c.textAlign = 'center'; [[400, 560, 22], [418, 530, 28], [440, 495, 34]].forEach(function (z) { c.font = '800 ' + z[2] + 'px ui-rounded, system-ui, sans-serif'; c.fillText('z', z[0], z[1]); });
      skade(c, o);
    },
    skovkoekkenet: function (c, W, H, o) {
      // morgen uden for Skovkoekkenet: huset, boden med Gustav og pandekagerne, det lange bord med alle vennerne
      himmel(c, W, H, '#f7dcc0', '#c9e0ea', 380); c.fillStyle = '#f7d27a'; c.beginPath(); c.arc(520, 120, 40, 0, 7); c.fill(); c.fillStyle = 'rgba(247,210,122,.3)'; c.beginPath(); c.arc(520, 120, 60, 0, 7); c.fill();
      sky(c, 80, 90, 0.9); fugl(c, 300, 130, 8);
      jord(c, W, 400, '#93bc63'); staar(c, 'gran', 40, 410, 110);
      staar(c, 'hus', 190, 450, 250);
      jord(c, W, 520, '#a9c97a', 0, 0);
      staar(c, 'bod', 460, 610, 190); tegn(c, 'gris', 462, 548, 74); tegn(c, 'pandekager', 470, 592, 56);
      // det lange bord
      skygge(c, 260, 690, 200); c.fillStyle = '#b18a56'; [80, 400].forEach(function (bx) { c.fillRect(bx, 640, 14, 90); }); rr(c, 40, 615, 420, 30, 8, '#d9ba8a', '#8a663d', 3);
      tegn(c, 'pandekager', 250, 612, 56); tegn(c, 'pandekager', 120, 612, 44); tegn(c, 'aeble', 360, 612, 30);
      // vennerne bag bordet ...
      staar(c, 'raev', 90, 620, 90); staar(c, 'ugle', 180, 618, 66); staar(c, 'bjoern', 300, 622, 110); skygge(c, 400, 620, 30); klat(c, 'klatRoed', 400, 620, 62, 1, true);
      // ... og foran det
      staar(c, 'dreng', 330, 740, 62); staar(c, 'pige', 400, 742, 72); staar(c, 'kanin', 250, 745, 84); skygge(c, 520, 735, 28); klat(c, 'klatBlaa', 520, 735, 58, -1, true); staar(c, 'robot', 575, 748, 72);
      tegn(c, 'rummus', 545, 300, 80); c.fillStyle = 'rgba(255,255,255,.6)'; [[590, 250], [510, 250], [560, 360]].forEach(function (p) { stjerne(c, p[0], p[1], 5, 'rgba(255,255,255,.7)'); });
      staar(c, 'pindsvin', 110, 775, 190);
      skade(c, o);
    }
  };

  /** Er opslagets malede billede hentet, saa det er det, der vises? */
  function erMalet(o) { return !!(o.malet && klar('malet-' + o.id)); }
  /** Noeglens plads i det billede, der faktisk vises: det malede eller det kodetegnede. */
  function noeglePlads(o) { return erMalet(o) ? o.malet.noegle : o.noegle; }
  /** Tegn et opslag i (c) i felt 600 x 780: det malede billede, hvis det er hentet, ellers scenen i kode.
      valg.kode tvinger koden (testen). I koden laegges noeglen sidst, medmindre scenen selv har lagt den (bag hegnet). */
  function tegnOpslag(c, o, valg) {
    if (erMalet(o) && !(valg && valg.kode)) { c.drawImage(billeder['malet-' + o.id], 0, 0, 600, 780); return; }
    froe = 3 + o.id.length;
    o.noegleTegnet = false;
    (SCENER[o.id] || function () {})(c, 600, 780, o);
    if (!o.noegleTegnet) noegle(c, o.noegle.x, o.noegle.y, o.noegle.s, o.noegle.v);
  }
  /** Forsiden: det malede billede af Pelle ved sit hus, ellers Pelle stor med skaden i hjoernet. Titlen skrives af siden. */
  function tegnForside(c, valg) {
    if (klar('malet-forside') && !(valg && valg.kode)) { c.drawImage(billeder['malet-forside'], 0, 0, 600, 780); return; }
    froe = 11;
    himmel(c, 600, 780, '#8fc7e8', '#dcecf3', 400); sky(c, 90, 90, 1.1); sky(c, 400, 60, 0.8);
    bakke(c, 600, 480, '#93bc63'); tegn(c, 'trae', 80, 490, 180, { bund: true }); tegn(c, 'gran', 520, 470, 150, { bund: true });
    bakke(c, 600, 640, '#a9c97a', 0, 10); strø(c, 20, 0, 600, 660, 770, 1);
    tegn(c, 'pindsvin', 300, 760, 320, { bund: true });
    tegn(c, 'skade', 500, 300, 120, { drej: -0.25 });
  }

  window.Scener = { BILLEDER: BILLEDER, hentAlle: hentAlle, tegnOpslag: tegnOpslag, tegnForside: tegnForside, noegle: noegle, klar: klar, erMalet: erMalet, noeglePlads: noeglePlads };
})();
