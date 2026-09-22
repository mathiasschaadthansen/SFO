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

  /** Pelles skruenoegle: traeskaft og graat hoved med gab, som den han holder. */
  function noegle(c, x, y, s, v) {
    c.save(); c.translate(x, y); c.rotate(v || 0);
    c.lineJoin = 'round';
    rr(c, -s * 0.13, -s * 0.15, s * 0.26, s * 1.05, s * 0.08, '#b18a56', '#8a663d', 2);
    c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(-s * 0.08, -s * 0.1, s * 0.07, s * 0.9);
    c.fillStyle = '#b9bcbf'; c.strokeStyle = '#6d7276'; c.lineWidth = 2;
    c.beginPath(); c.arc(0, -s * 0.35, s * 0.36, 0.55, Math.PI * 2 - 0.55); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = '#f0e9db'; c.beginPath(); c.moveTo(s * 0.02, -s * 0.35); c.lineTo(s * 0.5, -s * 0.62); c.lineTo(s * 0.5, -s * 0.08); c.closePath(); c.fill();
    c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.arc(-s * 0.12, -s * 0.45, s * 0.12, 0, 7); c.fill();
    c.restore();
  }
  /** Skaden med noeglen i naebbet. Naebbet sidder oeverst til hoejre i billedet. */
  function skade(c, o) {
    if (!o.skade) return;
    var s = o.skade, sp = !!s.spejl;
    c.save(); c.translate(s.x, s.y);
    if (s.flyver) { c.rotate(-0.25); }
    tegn(c, 'skade', 0, 0, s.s, { spejl: sp });
    c.restore();
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
      himmel(c, W, H, '#c9dfe9', '#eaf0d8'); sky(c, 90, 90, 1.1); sky(c, 380, 60, 0.8); fugl(c, 250, 130, 10); fugl(c, 280, 118, 8);
      bakke(c, W, H * 0.62, '#93bc63');
      tegn(c, 'trae', 95, H * 0.62, 190, { bund: true }); tegn(c, 'gran', 300, H * 0.58, 150, { bund: true }); tegn(c, 'trae', 540, H * 0.6, 170, { bund: true });
      bakke(c, W, H * 0.78, '#a9c97a', 0, 10);
      rr(c, 180, H * 0.66, 300, 34, 14, '#b18a56'); c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(200, H * 0.66 + 12); c.lineTo(460, H * 0.66 + 12); c.moveTo(215, H * 0.66 + 24); c.lineTo(445, H * 0.66 + 24); c.stroke();
      tegn(c, 'klokke', 330, H * 0.66 + 2, 54, { bund: true });
      c.setLineDash([4, 6]); c.strokeStyle = 'rgba(94,74,58,.4)'; c.lineWidth = 2; c.beginPath(); c.arc(240, H * 0.42, 34, 0, 7); c.stroke(); c.beginPath(); c.arc(400, H * 0.36, 30, 0, 7); c.stroke(); c.setLineDash([]);
      tegn(c, 'aeble', 240, H * 0.25, 40);
      strø(c, 26, 0, W, H * 0.8, H * 0.98, 1); tegn(c, 'svamp', 370, H * 0.9, 36, { bund: true }); tegn(c, 'kastanje', 120, H * 0.94, 30, { bund: true });
      tegn(c, 'pindsvin', 130, H * 0.97, 250, { bund: true });
      taleboble(c, 205, H * 0.4, '?');
      skade(c, o);
    },
    susebanen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#dcecf3'); sky(c, 120, 70, 1); sky(c, 420, 110, 0.8); fugl(c, 300, 60, 9);
      bakke(c, W, H * 0.4, '#93bc63');
      tegn(c, 'trae', 60, H * 0.42, 130, { bund: true }); tegn(c, 'gran', 560, H * 0.4, 120, { bund: true });
      // banen: en sloejfe af sand
      c.strokeStyle = '#e5d3ae'; c.lineWidth = 78; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(80, 720); c.quadraticCurveTo(60, 480, 220, 440); c.quadraticCurveTo(420, 400, 470, 540); c.quadraticCurveTo(520, 690, 330, 700); c.quadraticCurveTo(160, 710, 80, 720); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 3; c.setLineDash([16, 14]); c.beginPath(); c.moveTo(80, 720); c.quadraticCurveTo(60, 480, 220, 440); c.quadraticCurveTo(420, 400, 470, 540); c.quadraticCurveTo(520, 690, 330, 700); c.stroke(); c.setLineDash([]);
      // daekstablen ved svinget
      [0, 1, 2].forEach(function (i) { c.fillStyle = '#4a4239'; c.beginPath(); c.ellipse(520, 600 - i * 22, 34, 14, 0, 0, 7); c.fill(); c.fillStyle = '#6b6259'; c.beginPath(); c.ellipse(520, 600 - i * 22 - 4, 34, 14, 0, 0, 7); c.fill(); c.fillStyle = '#e5d3ae'; c.beginPath(); c.ellipse(520, 596 - i * 22, 14, 6, 0, 0, 7); c.fill(); });
      // stoevskyer bag bilen
      c.fillStyle = 'rgba(229,211,174,.8)'; [[300, 690, 14], [270, 700, 10], [245, 705, 7]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
      tegn(c, 'bil', 380, 690, 120, { bund: true, drej: -0.15 });
      tegn(c, 'raev', 250, 600, 120, { bund: true });
      tegn(c, 'pindsvin', 130, 560, 150, { bund: true });
      strø(c, 24, 0, W, 430, 780, 0.9);
    },
    boldbanen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#dcecf3'); c.fillStyle = 'rgba(240,196,106,.9)'; c.beginPath(); c.arc(80, 90, 40, 0, 7); c.fill(); sky(c, 180, 120, 0.9); sky(c, 420, 70, 1);
      bakke(c, W, H * 0.72, '#a9c97a'); c.fillStyle = '#93bc63'; c.fillRect(0, H * 0.78, W, H);
      c.strokeStyle = '#7fa955'; c.lineWidth = 2; for (var x = 20; x < W; x += 26) { c.beginPath(); c.moveTo(x, H * 0.78); c.lineTo(x + 4, H * 0.78 - 10); c.stroke(); }
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 3; c.beginPath(); c.moveTo(W / 2, H * 0.8); c.lineTo(W / 2, H * 0.96); c.stroke();
      maal(c, 8, H * 0.78, 120, 1); maal(c, W - 8, H * 0.78, 120, -1);
      klat(c, 'klatRoed', 200, H * 0.78, 104, 1, true); klat(c, 'klatBlaa', 380, H * 0.78, 92, -1, true);
      tegn(c, 'pindsvin', 80, H * 0.96, 170, { bund: true });
      tegn(c, 'bold', 540, H * 0.3, 60);
      c.setLineDash([6, 8]); c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 2; c.beginPath(); c.moveTo(200, H * 0.66); c.quadraticCurveTo(380, H * 0.05, 540, H * 0.3); c.stroke(); c.setLineDash([]);
    },
    boblehavet: function (c, W, H, o) {
      var g = c.createLinearGradient(0, 0, 0, H * 0.7); g.addColorStop(0, '#6a5a8c'); g.addColorStop(0.5, '#d98a72'); g.addColorStop(1, '#f0c46a'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = 'rgba(240,196,106,.9)'; c.beginPath(); c.arc(430, H * 0.64, 60, 0, 7); c.fill();
      c.fillStyle = '#5f9fc9'; c.fillRect(0, H * 0.66, W, H * 0.12);
      c.fillStyle = 'rgba(174,211,228,.7)'; for (var i = 0; i < 12; i++) { c.beginPath(); c.ellipse(20 + i * W / 11 + (i % 2) * 20, H * 0.7 + (i % 3) * 14, 22, 5, 0, 0, 7); c.fill(); }
      c.fillStyle = '#e5d3ae'; c.fillRect(0, H * 0.78, W, H * 0.22);
      c.fillStyle = 'rgba(94,74,58,.08)'; for (var k = 0; k < 60; k++) { c.beginPath(); c.arc(rnd() * W, H * 0.8 + rnd() * H * 0.19, 1.5, 0, 7); c.fill(); }
      [[120, 430, 46, '#7ab648'], [270, 300, 38, '#3f9ad6'], [372, 470, 30, '#f2c14e'], [210, 530, 22, '#ef94b8'], [528, 300, 40, '#9b7bd4']].forEach(function (b) { boble(c, b[0], b[1], b[2], b[3]); });
      c.fillStyle = '#d95f45'; c.beginPath(); c.roundRect(262, 288, 16, 22, 4); c.fill(); c.fillStyle = PAPIR; c.fillRect(262, 288, 16, 5);
      c.fillStyle = '#f3e9d8'; c.beginPath(); c.moveTo(106, 438); c.quadraticCurveTo(120, 410, 134, 438); c.closePath(); c.fill(); c.strokeStyle = '#b18a56'; c.lineWidth = 1.5; c.stroke();
      c.strokeStyle = PAPIR; c.lineWidth = 3; c.lineCap = 'round'; for (var a = 0; a < 8; a++) { var v = a * Math.PI / 4; c.beginPath(); c.moveTo(372 + Math.cos(v) * 36, 470 + Math.sin(v) * 36); c.lineTo(372 + Math.cos(v) * 46, 470 + Math.sin(v) * 46); c.stroke(); }
      tegn(c, 'dreng', 330, H * 0.95, 78, { bund: true }); tegn(c, 'pige', 420, H * 0.94, 92, { bund: true });
      tegn(c, 'pindsvin', 140, H * 0.99, 190, { bund: true });
      skade(c, o);
    },
    bogstavvejen: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#dcecf3'); sky(c, 110, 80, 1); sky(c, 400, 60, 0.7);
      bakke(c, W, H * 0.4, '#93bc63'); tegn(c, 'trae', 70, H * 0.42, 140, { bund: true }); tegn(c, 'gran', 380, H * 0.38, 120, { bund: true });
      // vejen af sand med bogstaverne skrevet i det
      c.fillStyle = '#e5d3ae'; c.beginPath(); c.moveTo(0, H * 0.62); c.quadraticCurveTo(W * 0.5, H * 0.56, W, H * 0.6); c.lineTo(W, H); c.lineTo(0, H); c.fill();
      c.strokeStyle = '#b18a56'; c.lineWidth = 7; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(250, 720); c.lineTo(250, 630); c.lineTo(320, 720); c.lineTo(320, 630); c.stroke();
      skilt(c, 120, 400, 'N', '#d9ba8a'); skilt(c, 300, 380, 'P', '#aed3e4'); skilt(c, 470, 400, 'S', '#f0c46a');
      tegn(c, 'ugle', 430, 700, 120, { bund: true });
      c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.beginPath(); c.moveTo(395, 640); c.quadraticCurveTo(360, 610, 340, 640); c.stroke(); c.fillStyle = '#f3e9d8'; c.beginPath(); c.ellipse(348, 626, 14, 6, -0.6, 0, 7); c.fill();
      tegn(c, 'pindsvin', 130, 740, 170, { bund: true });
      strø(c, 14, 0, W, H * 0.44, H * 0.6, 0.9);
      skade(c, o);
    },
    rimhulen: function (c, W, H, o) {
      // hulen: moerkt loft og vaegge, lys ved udgangen til hoejre
      c.fillStyle = '#4a3a2c'; c.fillRect(0, 0, W, H);
      var g = c.createRadialGradient(560, 200, 20, 560, 200, 420); g.addColorStop(0, '#dcecf3'); g.addColorStop(0.35, '#93bc63'); g.addColorStop(0.5, 'rgba(74,58,44,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      c.fillStyle = '#5e4a3a'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 60); c.quadraticCurveTo(480, 120, 470, 200); c.quadraticCurveTo(460, 330, W, 360); c.lineTo(W, H); c.lineTo(0, H); c.closePath(); c.fill();
      c.fillStyle = '#6b5545'; c.beginPath(); c.moveTo(0, 0); c.lineTo(W, 0); c.lineTo(W, 40); c.quadraticCurveTo(300, 90, 0, 60); c.fill();
      // baal og lyset fra det
      var b = c.createRadialGradient(180, 600, 10, 180, 600, 260); b.addColorStop(0, 'rgba(240,196,106,.55)'); b.addColorStop(1, 'rgba(240,196,106,0)'); c.fillStyle = b; c.fillRect(0, 300, W, 480);
      c.fillStyle = '#8a663d'; [[-30, 0.4], [30, -0.4]].forEach(function (p) { c.save(); c.translate(180, 640); c.rotate(p[1]); c.fillRect(p[0] - 30, -6, 60, 12); c.restore(); });
      c.fillStyle = '#e08a52'; c.beginPath(); c.moveTo(150, 632); c.quadraticCurveTo(160, 580, 180, 560); c.quadraticCurveTo(200, 590, 210, 632); c.fill(); c.fillStyle = GUL; c.beginPath(); c.moveTo(166, 632); c.quadraticCurveTo(175, 600, 182, 588); c.quadraticCurveTo(190, 604, 196, 632); c.fill();
      c.fillStyle = '#6b5545'; c.fillRect(0, 660, W, H);
      // rimkortene paa gulvet
      [[240, 690, 'kat'], [330, 700, 'hat']].forEach(function (k) { rr(c, k[0] - 30, k[1] - 38, 60, 76, 8, PAPIR, KANT, 2); tegn(c, k[2], k[0], k[1] - 2, 42); });
      tegn(c, 'bjoern', 420, 700, 190, { bund: true });
      tegn(c, 'pindsvin', 100, 730, 150, { bund: true });
      skade(c, o);
    },
    vrimleskoven: function (c, W, H, o) {
      himmel(c, W, H, '#8fc7e8', '#dcecf3'); sky(c, 120, 60, 0.9); fugl(c, 300, 80, 9);
      bakke(c, W, H * 0.36, '#93bc63');
      tegn(c, 'hus1', 120, H * 0.36, 130, { bund: true }); tegn(c, 'hus3', 300, H * 0.35, 130, { bund: true }); tegn(c, 'hus2', 490, H * 0.36, 130, { bund: true });
      tegn(c, 'trae', 30, H * 0.4, 110, { bund: true }); tegn(c, 'gran', 570, H * 0.37, 100, { bund: true });
      c.fillStyle = '#e5d3ae'; c.fillRect(0, H * 0.42, W, H * 0.16); c.strokeStyle = 'rgba(94,74,58,.16)'; c.lineWidth = 1.5; for (var r = 0; r < 4; r++) for (var x = (r % 2) * 21 - 10; x < W; x += 42) { c.beginPath(); c.roundRect(x, H * 0.42 + 4 + r * 24, 36, 20, 6); c.stroke(); }
      c.fillStyle = '#a9c97a'; c.fillRect(0, H * 0.58, W, H);
      tegn(c, 'bod', 110, H * 0.57, 150, { bund: true }); tegn(c, 'broend', 330, H * 0.56, 70, { bund: true }); tegn(c, 'baenk', 500, H * 0.56, 100, { bund: true });
      // toerresnoren, som skaden sidder paa
      c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.beginPath(); c.moveTo(210, 500); c.lineTo(210, 420); c.moveTo(390, 500); c.lineTo(390, 420); c.stroke(); c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(210, 424); c.quadraticCurveTo(300, 440, 390, 424); c.stroke();
      ['#d95f45', '#8fc7e8', '#f0c46a'].forEach(function (f, i) { rr(c, 232 + i * 38, 428 + (i % 2) * 4, 16, 20, 3, f, KANT, 2); });
      // stakittet med noeglen bag
      var x0 = 400, x1 = 560, y = 660, h = 40;
      c.strokeStyle = '#b18a56'; c.lineWidth = 4; c.beginPath(); c.moveTo(x0, y - h * 0.7); c.lineTo(x1, y - h * 0.7); c.moveTo(x0, y - h * 0.3); c.lineTo(x1, y - h * 0.3); c.stroke();
      noegle(c, o.noegle.x, o.noegle.y, o.noegle.s, o.noegle.v); o.noegleTegnet = true;
      for (var px = x0 + 5; px < x1; px += 20) { c.fillStyle = '#d9ba8a'; c.beginPath(); c.moveTo(px - 5, y); c.lineTo(px - 5, y - h * 0.85); c.lineTo(px, y - h); c.lineTo(px + 5, y - h * 0.85); c.lineTo(px + 5, y); c.closePath(); c.fill(); c.strokeStyle = tone('#d9ba8a', 0.65, 0.6); c.lineWidth = 2; c.stroke(); }
      // ting overalt, som i spillet
      tegn(c, 'kat', 150, 560, 40); tegn(c, 'and', 260, 590, 36); tegn(c, 'hund', 470, 600, 40); tegn(c, 'tiger', 60, 610, 40); tegn(c, 'bold', 560, 590, 34); tegn(c, 'hat', 330, 640, 36); tegn(c, 'ugle', 40, 700, 44, { bund: true });
      c.fillStyle = KANT; c.beginPath(); c.ellipse(300, 560, 4, 12, 0.6, 0, 7); c.fill();  // fjeren, der er tilbage
      strø(c, 24, 0, W, 600, 780, 0.9);
      tegn(c, 'kanin', 240, 760, 110, { bund: true });
      tegn(c, 'pindsvin', 110, 775, 150, { bund: true });
      skade(c, o);
    },
    tegnestuen: function (c, W, H, o) {
      c.fillStyle = '#f3e9d8'; c.fillRect(0, 0, W, H); c.fillStyle = '#d9ba8a'; c.fillRect(0, H * 0.7, W, H);
      c.strokeStyle = 'rgba(94,74,58,.2)'; c.lineWidth = 2; for (var y = H * 0.7 + 20; y < H; y += 26) { c.beginPath(); c.moveTo(0, y); c.lineTo(W, y); c.stroke(); }
      rr(c, 60, 80, 130, 160, 8, '#aed3e4', KANT, 3); c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(125, 80); c.lineTo(125, 240); c.moveTo(60, 160); c.lineTo(190, 160); c.stroke();
      // staffeliet med plakaten
      c.strokeStyle = '#8a663d'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(330, 700); c.lineTo(380, 200); c.moveTo(500, 700); c.lineTo(450, 200); c.moveTo(415, 700); c.lineTo(415, 520); c.stroke();
      rr(c, 300, 230, 230, 290, 6, PAPIR, KANT, 3);
      noegle(c, 415, 380, 110, 0.5);
      c.fillStyle = KANT; c.font = '800 30px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('?', 500, 490);
      // malerboetter, den ene med noeglen i
      [[120, 690, '#d95f45'], [190, 700, '#5f9fc9'], [548, 690, '#7ab648']].forEach(function (b) { rr(c, b[0] - 26, b[1] - 50, 52, 50, 6, '#b8b2a4', KANT, 2.5); c.fillStyle = b[2]; c.beginPath(); c.ellipse(b[0], b[1] - 50, 26, 8, 0, 0, 7); c.fill(); });
      tegn(c, 'robot', 250, 700, 130, { bund: true });
      c.strokeStyle = '#8a663d'; c.lineWidth = 5; c.beginPath(); c.moveTo(300, 560); c.lineTo(330, 500); c.stroke(); c.fillStyle = '#d95f45'; c.beginPath(); c.ellipse(334, 494, 8, 12, 0.5, 0, 7); c.fill();
      tegn(c, 'pindsvin', 100, 620, 150, { bund: true });
    },
    stjerneuret: function (c, W, H, o) {
      var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#2a2f5a'); g.addColorStop(0.7, '#4a4a7a'); g.addColorStop(1, '#5e6a78'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (var i = 0; i < 60; i++) { c.fillStyle = 'rgba(255,255,255,' + (0.4 + rnd() * 0.6) + ')'; c.beginPath(); c.arc(rnd() * W, rnd() * H * 0.6, 1 + rnd() * 1.5, 0, 7); c.fill(); }
      stjerne(c, 90, 90, 12); stjerne(c, 520, 60, 9); stjerne(c, 470, 400, 8);
      // det store ur med viserne paa syv
      c.fillStyle = '#f3e9d8'; c.beginPath(); c.arc(300, 250, 120, 0, 7); c.fill(); c.strokeStyle = GUL; c.lineWidth = 8; c.stroke();
      for (var t = 0; t < 12; t++) { var v = t * Math.PI / 6; c.fillStyle = KANT; c.beginPath(); c.arc(300 + Math.cos(v) * 100, 250 + Math.sin(v) * 100, t % 3 === 0 ? 6 : 3.5, 0, 7); c.fill(); }
      c.strokeStyle = KANT; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); c.moveTo(300, 250); c.lineTo(300 + Math.cos(Math.PI * 7 / 6 - Math.PI / 2) * 60, 250 + Math.sin(Math.PI * 7 / 6 - Math.PI / 2) * 60); c.stroke(); c.lineWidth = 5; c.beginPath(); c.moveTo(300, 250); c.lineTo(300, 160); c.stroke();
      // planeter
      c.fillStyle = '#e08a52'; c.beginPath(); c.arc(520, 200, 28, 0, 7); c.fill(); c.strokeStyle = '#f0c46a'; c.lineWidth = 4; c.beginPath(); c.ellipse(520, 200, 44, 10, -0.3, 0, 7); c.stroke();
      c.fillStyle = '#5f9fc9'; c.beginPath(); c.arc(80, 300, 22, 0, 7); c.fill();
      tegn(c, 'rummus', 470, 330, 120);
      // jorden: bakke, trae, Pelle sover, et lille hus langt vaek
      bakke(c, W, H * 0.7, '#3f5a3a');
      c.fillStyle = '#4f6f46'; c.beginPath(); c.moveTo(0, H * 0.72); c.quadraticCurveTo(80, H * 0.66, 160, H * 0.71); c.lineTo(160, H); c.lineTo(0, H); c.fill();
      rr(c, 70, 530, 44, 34, 4, '#e5d3ae', KANT, 2); c.fillStyle = '#d95f45'; c.beginPath(); c.moveTo(64, 532); c.lineTo(92, 508); c.lineTo(120, 532); c.closePath(); c.fill(); c.strokeStyle = KANT; c.lineWidth = 2; c.stroke(); rr(c, 100, 508, 8, 16, 1, '#8a663d', KANT, 1.5);
      c.fillStyle = GUL; c.fillRect(82, 542, 8, 8); c.fillRect(96, 542, 8, 8);
      tegn(c, 'trae', 440, H * 0.76, 170, { bund: true });
      tegn(c, 'pindsvin', 330, H * 0.9, 150, { bund: true, drej: -0.35 });
      c.fillStyle = PAPIR; c.font = '800 26px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.fillText('z', 420, 560); c.font = '800 34px ui-rounded, system-ui, sans-serif'; c.fillText('z', 445, 530);
    },
    skovkoekkenet: function (c, W, H, o) {
      // koekkenet: vaeg, vindue med morgenlys, taget oeverst med skaden
      c.fillStyle = '#f3e9d8'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#e5d3ae'; c.fillRect(0, 0, W, 150); c.strokeStyle = '#b18a56'; c.lineWidth = 6; for (var x = 0; x <= W; x += 100) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x + 50, 150); c.stroke(); }
      c.fillStyle = '#8a663d'; c.fillRect(0, 145, W, 16);
      rr(c, 380, 200, 160, 130, 8, '#8fc7e8', KANT, 3); c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(460, 200); c.lineTo(460, 330); c.moveTo(380, 265); c.lineTo(540, 265); c.stroke(); c.fillStyle = GUL; c.beginPath(); c.arc(420, 240, 18, 0, 7); c.fill();
      // Gustav bag komfuret: kun hovedet og skuldrene stikker op over pladen, panden damper
      tegn(c, 'gris', 115, 440, 130, { bund: true });
      rr(c, 30, 400, 170, 90, 10, '#b8b2a4', KANT, 3); rr(c, 30, 396, 170, 14, 6, '#d9ba8a', KANT, 2);
      c.fillStyle = '#4a4239'; c.beginPath(); c.ellipse(120, 403, 34, 9, 0, 0, 7); c.fill(); c.strokeStyle = '#4a4239'; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.moveTo(152, 401); c.lineTo(184, 392); c.stroke();
      c.fillStyle = GUL; c.beginPath(); c.ellipse(120, 401, 22, 5, 0, 0, 7); c.fill();
      rr(c, 60, 430, 50, 44, 6, '#8a8377', KANT, 2); c.fillStyle = '#e08a52'; c.fillRect(66, 448, 38, 14);
      c.fillStyle = 'rgba(255,255,255,.75)'; [[112, 380, 7], [120, 364, 9], [110, 344, 11]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], p[2], 0, 7); c.fill(); });
      // bordet med pandekager og gaesterne rundt om
      c.fillStyle = '#d9ba8a'; c.beginPath(); c.ellipse(340, 560, 230, 70, 0, 0, 7); c.fill(); c.strokeStyle = KANT; c.lineWidth = 3; c.stroke();
      c.fillStyle = '#b18a56'; [150, 530].forEach(function (bx) { c.fillRect(bx, 600, 14, 120); });
      tegn(c, 'pandekager', 340, 560, 90);
      tegn(c, 'raev', 250, 520, 70, { bund: true }); tegn(c, 'ugle', 420, 520, 56, { bund: true }); tegn(c, 'bjoern', 500, 530, 76, { bund: true });
      klat(c, 'klatRoed', 200, 560, 56, 1, false); klat(c, 'klatBlaa', 480, 560, 52, -1, true);
      tegn(c, 'dreng', 300, 640, 44, { bund: true }); tegn(c, 'pige', 400, 640, 50, { bund: true }); tegn(c, 'kanin', 340, 630, 52, { bund: true });
      tegn(c, 'robot', 560, 640, 60, { bund: true }); tegn(c, 'rummus', 560, 330, 60);
      tegn(c, 'pindsvin', 200, 770, 170, { bund: true });
      skade(c, o);
    }
  };

  /** Tegn et opslag i (c) i felt 600 x 780. Noeglen laegges sidst, medmindre scenen selv har lagt den (bag hegnet). */
  function tegnOpslag(c, o) {
    froe = 3 + o.id.length;
    o.noegleTegnet = false;
    (SCENER[o.id] || function () {})(c, 600, 780, o);
    if (!o.noegleTegnet) noegle(c, o.noegle.x, o.noegle.y, o.noegle.s, o.noegle.v);
  }
  /** Forsiden: Pelle stor, skaden i hjoernet, titlen skrives af siden. */
  function tegnForside(c) {
    froe = 11;
    himmel(c, 600, 780, '#8fc7e8', '#dcecf3', 400); sky(c, 90, 90, 1.1); sky(c, 400, 60, 0.8);
    bakke(c, 600, 480, '#93bc63'); tegn(c, 'trae', 80, 490, 180, { bund: true }); tegn(c, 'gran', 520, 470, 150, { bund: true });
    bakke(c, 600, 640, '#a9c97a', 0, 10); strø(c, 20, 0, 600, 660, 770, 1);
    tegn(c, 'pindsvin', 300, 760, 320, { bund: true });
    tegn(c, 'skade', 500, 300, 120, { drej: -0.25 });
  }

  window.Scener = { BILLEDER: BILLEDER, hentAlle: hentAlle, tegnOpslag: tegnOpslag, tegnForside: tegnForside, noegle: noegle, klar: klar };
})();
