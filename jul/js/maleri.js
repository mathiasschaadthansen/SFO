/**
 * Pelles julekalender: det, der tegnes i kode, i den malede palet.
 *
 * Indtil de malede billeder findes (billeder/kalender.jpg, billeder/puslespil.jpg
 * og billeder/dagNN-k.jpg), tegnes der en blød pladsholder i kode: Noeddeskoven i
 * sne til kalenderen, juleaften med juletraeet og vennerne til puslespillet, og
 * et lille maleri af hvert sted med stedets navn til historierne. Figurerne er
 * spillenes egne malede billeder (Opgaver.FIGURER). Desuden tingene i opgaverne,
 * der ikke findes som billeder: julekugler, lys, stjerner, stammer, juletraeet og
 * Nissen Nis, brikkerne med den gyldne kant, og Gustavs viskestykke og
 * snebunkerne, der daekker tingene i regnehistorierne.
 *
 * Alt tegnes paa et 2D-canvas; ingen DOM ud over Image til billederne.
 */
(function () {
  'use strict';

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a', GROEN = '#93bc63', DYB = '#5f8240';
  var KUGLEFARVER = ['#d95f45', '#5f9fc9', GUL, '#9b7bd4', '#e08a52', GROEN];
  var O = window.Opgaver, P = window.Puslespil;

  /* ---------- billeder ---------- */

  var billeder = {}, lyttere = [];
  /** Hent et billede (sti fra appens rod, eller fra jul/ med jul: foran). naar: kaldes, naar det er hentet. */
  function hent(sti) {
    if (!sti) return null;
    if (!billeder[sti]) {
      var i = new Image();
      i.addEventListener('load', function () { lyttere.forEach(function (f) { f(sti); }); });
      i.src = sti.indexOf('jul:') === 0 ? sti.slice(4) : '../' + sti;
      billeder[sti] = i;
    }
    return billeder[sti];
  }
  function klar(sti) { var i = sti && billeder[sti]; return !!(i && i.complete && i.naturalWidth); }
  function naarHentet(f) { lyttere.push(f); }

  /* ---------- smaa hjaelpere ---------- */

  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, b, h, r) {
      r = Math.min(typeof r === 'number' ? r : 0, b / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + b, y, x + b, y + h, r);
      this.arcTo(x + b, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + b, y, r);
      this.closePath();
    };
  }
  var froe = 1;
  function saa(n) { froe = n || 1; }
  function rnd() { froe = (froe * 1664525 + 1013904223) % 4294967296; return froe / 4294967296; }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  /** En farve lysere (k > 1) eller moerkere (k < 1), med gennemsigtighed a. */
  function tone(h, k, a) {
    var r = rgb(h).map(function (v) { return Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)); });
    return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + (a === undefined ? 1 : a) + ')';
  }
  function rr(c, x, y, b, h, r, fyld, kant, lw) {
    c.beginPath(); c.roundRect(x, y, b, h, r);
    if (fyld) { c.fillStyle = fyld; c.fill(); }
    if (kant) { c.strokeStyle = kant; c.lineWidth = lw || 3; c.stroke(); }
  }
  function lodret(c, x, y, b, h, farver) {
    var g = c.createLinearGradient(0, y, 0, y + h);
    farver.forEach(function (f, i) { g.addColorStop(i / (farver.length - 1), f); });
    c.fillStyle = g; c.fillRect(x, y, b, h);
  }
  /** Akvarelskyer oven i et felt: lyse og moerke pletter og korn, saa fladen ser malet ud. */
  function vask(c, x, y, b, h, farve, styrke) {
    styrke = styrke || 1;
    for (var i = 0; i < 9; i++) {
      c.fillStyle = tone(farve, i % 2 ? 0.86 : 1.25, 0.09 * styrke);
      c.beginPath(); c.ellipse(x + rnd() * b, y + rnd() * h, b * (0.15 + rnd() * 0.3), h * (0.12 + rnd() * 0.3), rnd() * 3, 0, 7); c.fill();
    }
    c.fillStyle = tone(farve, 0.7, 0.05 * styrke);
    for (var k = 0; k < Math.min(900, b * h / 260); k++) { c.beginPath(); c.arc(x + rnd() * b, y + rnd() * h, 0.6 + rnd() * 1.3, 0, 7); c.fill(); }
  }
  /** Bloede sneklitter paa jorden fra y og ned, med blaa skygger. */
  function snedriver(c, w, y, h, farve) {
    c.fillStyle = farve || '#fbf7f0';
    c.beginPath(); c.moveTo(0, y);
    for (var i = 0; i <= 8; i++) c.quadraticCurveTo(w * (i - 0.5) / 8, y - h * (0.03 + rnd() * 0.05), w * i / 8, y + (rnd() - 0.5) * h * 0.04);
    c.lineTo(w, y + h * 2); c.lineTo(0, y + h * 2); c.closePath(); c.fill();
    c.fillStyle = 'rgba(143,199,232,.22)';
    for (var k = 0; k < 7; k++) { c.beginPath(); c.ellipse(rnd() * w, y + h * (0.1 + rnd() * 0.8), w * (0.06 + rnd() * 0.1), h * 0.03, 0, 0, 7); c.fill(); }
  }
  function bakke(c, w, y, farve, top) {
    c.fillStyle = farve; c.beginPath(); c.moveTo(0, y);
    c.quadraticCurveTo(w * 0.25, y - top, w * 0.5, y - top * 0.3); c.quadraticCurveTo(w * 0.78, y + top * 0.4, w, y - top * 0.6);
    c.lineTo(w, y + 4000); c.lineTo(0, y + 4000); c.closePath(); c.fill();
  }
  /** Et grantrae med sne paa grenene. x er midten, bund er foden af stammen. */
  function gran(c, x, bund, hoejde, farve, sne) {
    var b = hoejde * 0.62;
    c.fillStyle = '#8a663d'; c.fillRect(x - hoejde * 0.04, bund - hoejde * 0.12, hoejde * 0.08, hoejde * 0.12);
    for (var i = 0; i < 3; i++) {
      var top = bund - hoejde * (1 - i * 0.24), fod = bund - hoejde * (0.1 + (2 - i) * 0.17) + hoejde * 0.06, bb = b * (0.55 + i * 0.22);
      c.fillStyle = farve || DYB;
      c.beginPath(); c.moveTo(x, top); c.lineTo(x + bb / 2, fod); c.quadraticCurveTo(x, fod + hoejde * 0.05, x - bb / 2, fod); c.closePath(); c.fill();
      if (sne !== false) {
        c.fillStyle = 'rgba(251,247,240,.92)';
        c.beginPath(); c.moveTo(x - bb * 0.42, fod - hoejde * 0.02); c.quadraticCurveTo(x - bb * 0.2, fod - hoejde * 0.07, x, fod - hoejde * 0.03);
        c.quadraticCurveTo(x + bb * 0.2, fod - hoejde * 0.08, x + bb * 0.44, fod - hoejde * 0.015); c.quadraticCurveTo(x, fod + hoejde * 0.02, x - bb * 0.42, fod - hoejde * 0.02); c.fill();
        c.beginPath(); c.moveTo(x, top); c.lineTo(x + bb * 0.12, top + hoejde * 0.08); c.lineTo(x - bb * 0.12, top + hoejde * 0.08); c.closePath(); c.fill();
      }
    }
  }
  function stjerneSti(c, x, y, r, ind) {
    c.beginPath();
    for (var k = 0; k < 10; k++) {
      var rr2 = k % 2 ? r * (ind || 0.45) : r, v = -Math.PI / 2 + k * Math.PI / 5;
      if (k) c.lineTo(x + Math.cos(v) * rr2, y + Math.sin(v) * rr2); else c.moveTo(x + Math.cos(v) * rr2, y + Math.sin(v) * rr2);
    }
    c.closePath();
  }

  /* ---------- tingene ---------- */

  function julekugle(c, x, y, r, farve) {
    farve = farve || KUGLEFARVER[0];
    c.save();
    c.strokeStyle = '#b18a56'; c.lineWidth = Math.max(1, r * 0.08);
    c.beginPath(); c.moveTo(x, y - r * 1.25); c.lineTo(x, y - r * 1.7); c.stroke();
    rr(c, x - r * 0.28, y - r * 1.25, r * 0.56, r * 0.32, r * 0.08, '#d9ba8a');
    var g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, tone(farve, 1.45)); g.addColorStop(0.55, farve); g.addColorStop(1, tone(farve, 0.72));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    c.strokeStyle = tone(farve, 0.6, 0.55); c.lineWidth = Math.max(1, r * 0.06); c.stroke();
    c.strokeStyle = 'rgba(248,241,230,.55)'; c.lineWidth = Math.max(1, r * 0.1);
    c.beginPath(); c.ellipse(x, y + r * 0.1, r * 0.95, r * 0.28, 0, 0.1, Math.PI - 0.1); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.75)'; c.beginPath(); c.ellipse(x - r * 0.38, y - r * 0.42, r * 0.2, r * 0.12, -0.6, 0, 7); c.fill();
    c.restore();
  }
  function stjerne(c, x, y, r, farve) {
    c.save();
    var g = c.createRadialGradient(x, y, r * 0.2, x, y, r * 1.8);
    g.addColorStop(0, 'rgba(240,196,106,.45)'); g.addColorStop(1, 'rgba(240,196,106,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 1.8, 0, 7); c.fill();
    stjerneSti(c, x, y, r);
    var f = c.createLinearGradient(x, y - r, x, y + r);
    f.addColorStop(0, '#fbe3a8'); f.addColorStop(1, farve || GUL);
    c.fillStyle = f; c.fill();
    c.strokeStyle = '#b18a56'; c.lineWidth = Math.max(1, r * 0.09); c.lineJoin = 'round'; c.stroke();
    c.restore();
  }
  /** Et lys med flamme. h er hoejden af lyset; t blafrer flammen. */
  function lys(c, x, y, h, t) {
    var b = h * 0.32;
    c.save();
    rr(c, x - b / 2, y - h / 2, b, h, b * 0.2, '#f8f1e6', '#d9ba8a', Math.max(1, h * 0.04));
    c.fillStyle = 'rgba(217,95,69,.35)'; c.fillRect(x - b / 2 + 2, y - h * 0.1, b - 4, h * 0.12);
    var fy = y - h / 2 - h * 0.22, s = 1 + Math.sin((t || 0) * 9) * 0.06;
    var g = c.createRadialGradient(x, fy, 1, x, fy, h * 0.5);
    g.addColorStop(0, 'rgba(240,196,106,.5)'); g.addColorStop(1, 'rgba(240,196,106,0)');
    c.fillStyle = g; c.beginPath(); c.arc(x, fy, h * 0.5, 0, 7); c.fill();
    c.fillStyle = '#e08a52'; c.beginPath(); c.ellipse(x, fy, h * 0.09 * s, h * 0.2 * s, 0, 0, 7); c.fill();
    c.fillStyle = '#fbe3a8'; c.beginPath(); c.ellipse(x, fy + h * 0.04, h * 0.045, h * 0.1, 0, 0, 7); c.fill();
    c.restore();
  }
  /** En stamme set fra enden: aarringe og bark. Til bunkerne ved Baeverdammen. */
  function stamme(c, x, y, r) {
    c.save();
    c.fillStyle = '#8a663d'; c.beginPath(); c.arc(x, y, r, 0, 7); c.fill();
    var g = c.createRadialGradient(x - r * 0.2, y - r * 0.2, r * 0.1, x, y, r * 0.82);
    g.addColorStop(0, '#f0dcb8'); g.addColorStop(1, '#d9ba8a');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r * 0.82, 0, 7); c.fill();
    c.strokeStyle = 'rgba(138,102,61,.45)'; c.lineWidth = Math.max(1, r * 0.06);
    [0.6, 0.4, 0.2].forEach(function (k) { c.beginPath(); c.arc(x + r * 0.03, y + r * 0.02, r * k, 0, 7); c.stroke(); });
    c.strokeStyle = KANT; c.lineWidth = Math.max(1, r * 0.07); c.beginPath(); c.arc(x, y, r, 0, 7); c.stroke();
    c.restore();
  }
  /** En ting midt i (x, y), str bred. Tegnes i kode eller fra et malet billede. */
  function ting(c, navn, x, y, str, nr, t) {
    if (navn === 'julekugle') return julekugle(c, x, y + str * 0.08, str * 0.4, KUGLEFARVER[(nr || 0) % KUGLEFARVER.length]);
    if (navn === 'stjerne') return stjerne(c, x, y, str * 0.46);
    if (navn === 'lys') return lys(c, x, y, str * 0.8, t);
    if (navn === 'stamme') return stamme(c, x, y, str * 0.46);
    var sti = O.tingBillede(navn), i = hent(sti);
    if (klar(sti)) {
      var k = Math.min(str / i.naturalWidth, str / i.naturalHeight);
      c.drawImage(i, x - i.naturalWidth * k / 2, y - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k);
    } else {
      c.fillStyle = 'rgba(177,138,86,.35)'; c.beginPath(); c.arc(x, y, str * 0.3, 0, 7); c.fill();
    }
  }

  /** Juletraeet: tre lag grene, sne og eventuelt pynt. x er midten, top og bund er spidsen og foden. */
  function juletrae(c, x, top, bund, bredde, pynt, t) {
    var h = bund - top;
    c.save();
    c.fillStyle = 'rgba(94,74,58,.16)'; c.beginPath(); c.ellipse(x, bund, bredde * 0.55, h * 0.04, 0, 0, 7); c.fill();
    c.fillStyle = '#8a663d'; c.fillRect(x - bredde * 0.06, bund - h * 0.12, bredde * 0.12, h * 0.12);
    var lag = [[0, 0.36, 0.42], [0.22, 0.62, 0.7], [0.45, 0.9, 1]];
    lag.forEach(function (l, i) {
      var t0 = top + h * l[0], t1 = top + h * l[1], bb = bredde * l[2];
      var g = c.createLinearGradient(x - bb / 2, 0, x + bb / 2, 0);
      g.addColorStop(0, '#4f6f36'); g.addColorStop(0.45, i === 0 ? GROEN : '#7fa752'); g.addColorStop(1, DYB);
      c.fillStyle = g;
      c.beginPath(); c.moveTo(x, t0);
      c.quadraticCurveTo(x + bb * 0.2, t0 + (t1 - t0) * 0.5, x + bb / 2, t1);
      for (var k = 4; k >= -4; k--) c.quadraticCurveTo(x + bb * (k + 0.5) / 9, t1 + h * 0.035, x + bb * k / 9, t1 - h * 0.005);
      c.quadraticCurveTo(x - bb / 2, t1, x - bb / 2, t1);
      c.quadraticCurveTo(x - bb * 0.2, t0 + (t1 - t0) * 0.5, x, t0);
      c.fill();
      c.fillStyle = 'rgba(251,247,240,.9)';
      c.beginPath(); c.moveTo(x - bb * 0.4, t1 - h * 0.01);
      c.quadraticCurveTo(x - bb * 0.2, t1 - h * 0.05, x, t1 - h * 0.02); c.quadraticCurveTo(x + bb * 0.22, t1 - h * 0.055, x + bb * 0.42, t1 - h * 0.005);
      c.quadraticCurveTo(x, t1 + h * 0.012, x - bb * 0.4, t1 - h * 0.01); c.fill();
    });
    if (pynt) {
      // Lyskaede i bloede buer og kugler, saa kan det ses, at det er jul
      c.strokeStyle = 'rgba(240,196,106,.7)'; c.lineWidth = Math.max(1, bredde * 0.008);
      [[0.3, 0.3], [0.55, 0.55], [0.8, 0.8]].forEach(function (b, i) {
        var y = top + h * b[0], bb = bredde * b[1];
        c.beginPath(); c.moveTo(x - bb * 0.4, y - h * 0.03); c.quadraticCurveTo(x, y + h * 0.06, x + bb * 0.42, y - h * 0.05); c.stroke();
        for (var k = 0; k < 5; k++) {
          var u = (k + 0.5) / 5, px = x - bb * 0.4 + u * bb * 0.82, py = y - h * 0.03 + Math.sin(u * Math.PI) * h * 0.045;
          c.fillStyle = 'rgba(251,227,168,' + (0.6 + 0.4 * Math.sin((t || 0) * 3 + k + i)) + ')';
          c.beginPath(); c.arc(px, py, Math.max(1.5, bredde * 0.012), 0, 7); c.fill();
        }
      });
      O.KUGLER.forEach(function (p, i) {
        if (i % 2) return;
        julekugle(c, x + (p[0] - 0.5) * bredde * 1.05, top + p[1] * h * 0.98, bredde * 0.035, KUGLEFARVER[i % KUGLEFARVER.length]);
      });
      stjerne(c, x, top + h * 0.01, bredde * 0.08);
    }
    c.restore();
  }

  /* ---------- figurerne ---------- */

  /** Nissen Nis: lillebitte, roed hue med lidt uld, der mangler. Tegnet i kode, for han er en hemmelighed. */
  function nis(c, x, bund, h) {
    c.save();
    c.translate(x, bund); c.scale(h / 100, h / 100);
    c.lineJoin = 'round'; c.lineCap = 'round'; c.strokeStyle = KANT; c.lineWidth = 3;
    c.fillStyle = '#8a663d'; c.beginPath(); c.ellipse(-10, -3, 9, 4, 0, 0, 7); c.ellipse(10, -3, 9, 4, 0, 0, 7); c.fill();
    c.fillStyle = '#5f9fc9'; c.beginPath(); c.roundRect(-16, -36, 32, 33, 10); c.fill(); c.stroke();
    c.fillStyle = '#d95f45'; c.beginPath(); c.roundRect(-18, -46, 36, 16, 8); c.fill(); c.stroke();
    c.fillStyle = '#f4d3b4'; c.beginPath(); c.arc(0, -56, 14, 0, 7); c.fill(); c.stroke();
    c.fillStyle = PAPIR; c.beginPath(); c.ellipse(0, -46, 12, 6, 0, 0, Math.PI); c.fill();
    c.fillStyle = KANT; c.beginPath(); c.arc(-5, -58, 1.8, 0, 7); c.arc(5, -58, 1.8, 0, 7); c.fill();
    c.fillStyle = 'rgba(217,95,69,.4)'; c.beginPath(); c.arc(-8, -52, 3, 0, 7); c.arc(8, -52, 3, 0, 7); c.fill();
    c.fillStyle = '#d95f45'; c.beginPath(); c.moveTo(-15, -64); c.quadraticCurveTo(0, -100, 22, -90); c.quadraticCurveTo(8, -78, 15, -64); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = PAPIR; c.beginPath(); c.roundRect(-17, -68, 34, 8, 4); c.fill(); c.stroke();
    c.beginPath(); c.arc(22, -90, 5, 0, 7); c.fill(); c.stroke();
    c.restore();
  }
  /** Klatten (Klaus eller Klara) har en malet krop uden ansigt; ansigtet tegnes her, som i Boldbanen. */
  function klatAnsigt(c, x, y, b) {
    c.fillStyle = PAPIR; c.strokeStyle = KANT; c.lineWidth = Math.max(1, b * 0.025);
    [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(x + s * b * 0.14, y, b * 0.09, b * 0.11, 0, 0, 7); c.fill(); c.stroke(); });
    c.fillStyle = KANT; [-1, 1].forEach(function (s) { c.beginPath(); c.arc(x + s * b * 0.14 + b * 0.02, y + b * 0.02, b * 0.045, 0, 7); c.fill(); });
    c.beginPath(); c.arc(x, y + b * 0.12, b * 0.08, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
  }
  /** En figur med foedderne i (x, bund) og hoejden h. Svarer med bredden. */
  function figur(c, navn, x, bund, h, valg) {
    valg = valg || {};
    if (navn === 'nis') { nis(c, x, bund, h); return h * 0.5; }
    var sti = O.FIGURER[navn], i = hent(sti);
    if (!klar(sti)) return 0;
    var hh = navn === 'klaus' || navn === 'klara' ? h * 0.62 : h, b = hh * i.naturalWidth / i.naturalHeight;
    c.save();
    c.fillStyle = 'rgba(94,74,58,.16)'; c.beginPath(); c.ellipse(x, bund, b * 0.45, hh * 0.05, 0, 0, 7); c.fill();
    c.translate(x, bund);
    if (valg.spejl) c.scale(-1, 1);
    c.drawImage(i, -b / 2, -hh, b, hh);
    if (navn === 'klaus' || navn === 'klara') klatAnsigt(c, 0, -hh * 0.52, b);
    c.restore();
    return b;
  }

  /* ---------- kalenderens baggrund: Noeddeskoven i sne ---------- */

  /** udenTrae: uden det store juletrae og stubben, som baggrund til opgaverne. */
  function vinterscene(c, w, h, udenTrae) {
    saa(7);
    lodret(c, 0, 0, w, h, ['#aed3e4', '#d9e8ee', '#f8f1e6']);
    vask(c, 0, 0, w, h * 0.6, '#aed3e4', 0.8);
    // Bloed sol bag skyerne
    var g = c.createRadialGradient(w * 0.82, h * 0.16, 4, w * 0.82, h * 0.16, h * 0.3);
    g.addColorStop(0, 'rgba(251,227,168,.85)'); g.addColorStop(1, 'rgba(251,227,168,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    bakke(c, w, h * 0.5, '#c9dbe3', h * 0.08);
    for (var i = 0; i < 16; i++) gran(c, w * (i + rnd() * 0.6) / 15, h * (0.5 + rnd() * 0.04), h * (0.12 + rnd() * 0.06), '#7f9a77');
    bakke(c, w, h * 0.62, '#e6eef1', h * 0.06);
    for (var k = 0; k < 9; k++) gran(c, w * (k + rnd() * 0.5) / 8.5, h * (0.64 + rnd() * 0.04), h * (0.2 + rnd() * 0.08), '#5f8240');
    snedriver(c, w, h * 0.7, h);
    if (!udenTrae) {
      // Det store juletrae midt i skoven, med stubben under
      juletrae(c, w * 0.5, h * 0.12, h * 0.8, h * 0.5, true, 0);
      c.fillStyle = '#b18a56'; c.beginPath(); c.ellipse(w * 0.5, h * 0.85, h * 0.16, h * 0.04, 0, 0, 7); c.fill();
      c.fillStyle = '#8a663d'; c.fillRect(w * 0.5 - h * 0.16, h * 0.85, h * 0.32, h * 0.05);
      c.fillStyle = '#fbf7f0'; c.beginPath(); c.ellipse(w * 0.5, h * 0.845, h * 0.15, h * 0.03, 0, 0, 7); c.fill();
    }
    snedriver(c, w, h * 0.9, h);
    vask(c, 0, h * 0.7, w, h * 0.3, '#d9e8ee', 0.6);
  }

  /* ---------- puslespillets motiv: juleaften om juletraeet ---------- */

  /** Motivet tegnes paa 4:3. Vennerne staar i en bue om juletraeet, i to raekker. */
  function motiv(c, w, h, t) {
    saa(24);
    lodret(c, 0, 0, w, h, ['#56688f', '#7f8fb6', '#c9d5e6']);
    vask(c, 0, 0, w, h * 0.6, '#7f8fb6', 1);
    for (var i = 0; i < 40; i++) {
      var sx = rnd() * w, sy = rnd() * h * 0.45, r = 1 + rnd() * 2.4;
      c.fillStyle = 'rgba(251,247,240,' + (0.5 + rnd() * 0.5) + ')'; c.beginPath(); c.arc(sx, sy, r * w / 800, 0, 7); c.fill();
    }
    c.fillStyle = 'rgba(251,247,240,.9)'; c.beginPath(); c.arc(w * 0.85, h * 0.14, h * 0.05, 0, 7); c.fill();
    bakke(c, w, h * 0.55, '#aab8cc', h * 0.06);
    for (var k = 0; k < 12; k++) gran(c, w * (k + rnd() * 0.6) / 11.5, h * (0.56 + rnd() * 0.03), h * (0.14 + rnd() * 0.06), '#5d7360');
    snedriver(c, w, h * 0.68, h, '#eef1f4');
    var g = c.createRadialGradient(w * 0.5, h * 0.6, 4, w * 0.5, h * 0.6, h * 0.55);
    g.addColorStop(0, 'rgba(251,227,168,.55)'); g.addColorStop(1, 'rgba(251,227,168,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    juletrae(c, w * 0.5, h * 0.27, h * 0.86, h * 0.48, true, t || 0);
    // Vennerne i en bue om traeet: bagerste raekke foerst, saa den forreste
    var bag = ['ulla', 'bo', 'milo', 'rasmus', 'kaja', 'bodil', 'rikke'], for_ = ['egon', 'klaus', 'emil', 'pelle', 'sanne', 'ella', 'klara', 'gustav'];
    bag.forEach(function (n, j) {
      var side = j < 3 ? -1 : 1, nr = j < 3 ? j : j - 3, x = w * 0.5 + side * w * (0.2 + nr * 0.085);
      figur(c, n, x, h * 0.82 - nr * h * 0.01, h * 0.2, { spejl: side > 0 });
    });
    for_.forEach(function (n, j) {
      var x = w * (0.08 + j * 0.12), y = h * 0.95 - Math.sin((j + 0.5) / for_.length * Math.PI) * h * 0.04;
      figur(c, n, x, y, n === 'pelle' ? h * 0.2 : h * 0.19, { spejl: j >= 4 });
    });
    vask(c, 0, h * 0.7, w, h * 0.3, '#eef1f4', 0.5);
  }

  /* ---------- pladsholderbilleder til historierne ---------- */

  /*
   * Hvert sted har sin egen lille scene. stemning: 'dag', 'aften' eller 'nat'.
   * Billederne er kun til at proeve det hele, indtil de malede billeder findes.
   */
  function himmel(c, w, h, stemning) {
    var f = stemning === 'nat' ? ['#4d5f88', '#7f8fb6', '#b7c4dc'] : stemning === 'aften' ? ['#9b8fc4', '#e5b9a0', '#f8e3c4'] : ['#aed3e4', '#d9e8ee', '#f8f1e6'];
    lodret(c, 0, 0, w, h * 0.75, f);
    vask(c, 0, 0, w, h * 0.6, f[0], 0.8);
    if (stemning === 'nat') for (var i = 0; i < 30; i++) { c.fillStyle = 'rgba(251,247,240,.8)'; c.beginPath(); c.arc(rnd() * w, rnd() * h * 0.45, 1 + rnd() * 2, 0, 7); c.fill(); }
  }
  function skov(c, w, h, farve) {
    bakke(c, w, h * 0.56, farve || '#c9dbe3', h * 0.07);
    for (var i = 0; i < 10; i++) gran(c, w * (i + rnd() * 0.6) / 9.5, h * (0.57 + rnd() * 0.04), h * (0.16 + rnd() * 0.07), '#6f8d62');
  }
  var STEDER = {
    'Nøddeskoven': function (c, w, h) { skov(c, w, h); snedriver(c, w, h * 0.7, h); juletrae(c, w * 0.62, h * 0.12, h * 0.76, h * 0.42, false); },
    'Egernreden': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.7, h);
      c.fillStyle = '#8a663d'; rr(c, w * 0.5, h * 0.46, w * 0.22, h * 0.3, 18, '#8a663d');
      c.fillStyle = '#d9ba8a'; c.beginPath(); c.ellipse(w * 0.61, h * 0.46, w * 0.11, h * 0.045, 0, 0, 7); c.fill();
      c.fillStyle = '#5e4a3a'; c.beginPath(); c.ellipse(w * 0.61, h * 0.58, w * 0.03, h * 0.05, 0, 0, 7); c.fill();
      for (var i = 0; i < 4; i++) ting(c, 'nød', w * (0.54 + i * 0.04), h * 0.44, h * 0.06);
    },
    'Skovkøkkenet': function (c, w, h) {
      lodret(c, 0, 0, w, h, ['#f0dcb8', '#e5d3ae']); vask(c, 0, 0, w, h, '#e5d3ae', 1);
      rr(c, w * 0.08, h * 0.12, w * 0.3, h * 0.32, 12, '#aed3e4', '#8a663d', 8);
      c.fillStyle = '#fbf7f0'; c.fillRect(w * 0.08, h * 0.38, w * 0.3, h * 0.06);
      rr(c, w * 0.55, h * 0.25, w * 0.3, h * 0.35, 16, '#b18a56', KANT, 4);
      c.fillStyle = '#e08a52'; rr(c, w * 0.6, h * 0.36, w * 0.2, h * 0.16, 10, '#5e4a3a');
      c.fillStyle = 'rgba(240,196,106,.6)'; c.fillRect(w * 0.62, h * 0.38, w * 0.16, h * 0.12);
      c.fillStyle = '#8a663d'; c.fillRect(0, h * 0.72, w, h * 0.28);
      for (var i = 0; i < 3; i++) ting(c, 'kage', w * (0.3 + i * 0.1), h * 0.7, h * 0.09);
    },
    'Bæverdammen': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.62, h);
      c.fillStyle = '#c7e0ec'; c.beginPath(); c.ellipse(w * 0.45, h * 0.8, w * 0.38, h * 0.12, 0, 0, 7); c.fill();
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * 0.2, h * 0.78); c.lineTo(w * 0.35, h * 0.82); c.stroke();
      for (var i = 0; i < 7; i++) stamme(c, w * (0.7 + (i % 4) * 0.05 + (i > 3 ? 0.025 : 0)), h * (0.72 - (i > 3 ? 0.07 : 0)), h * 0.035);
    },
    'Boldbanen': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.62, h);
      c.strokeStyle = '#f8f1e6'; c.lineWidth = 8; [0.1, 0.9].forEach(function (x) { c.strokeRect(w * x - w * 0.05, h * 0.5, w * 0.1, h * 0.2); });
      for (var i = 0; i < 5; i++) ting(c, 'snebold', w * (0.4 + (i % 3) * 0.06), h * (0.8 - Math.floor(i / 3) * 0.05), h * 0.07);
    },
    'Susebanen': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.62, h);
      c.strokeStyle = 'rgba(177,138,86,.35)'; c.lineWidth = h * 0.09; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-20, h * 0.95); c.bezierCurveTo(w * 0.3, h * 0.6, w * 0.6, h * 1.0, w + 20, h * 0.68); c.stroke();
      for (var i = 0; i < 4; i++) gran(c, w * (0.15 + i * 0.25), h * (0.72 + (i % 2) * 0.06), h * 0.18);
    },
    'Stjerneuret': function (c, w, h) {
      bakke(c, w, h * 0.78, '#9aa8c4', h * 0.05); snedriver(c, w, h * 0.86, h, '#dde4ee');
      c.fillStyle = 'rgba(248,241,230,.92)'; c.beginPath(); c.arc(w * 0.7, h * 0.36, h * 0.16, 0, 7); c.fill();
      c.strokeStyle = KANT; c.lineWidth = 4; c.stroke();
      c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.7, h * 0.36); c.lineTo(w * 0.7, h * 0.25); c.moveTo(w * 0.7, h * 0.36); c.lineTo(w * 0.77, h * 0.38); c.stroke();
      for (var i = 0; i < 7; i++) stjerne(c, w * (0.12 + i * 0.06), h * (0.2 + Math.sin(i) * 0.06), h * 0.025);
    },
    'Bogstavvejen': function (c, w, h, dag) {
      skov(c, w, h); snedriver(c, w, h * 0.62, h);
      c.fillStyle = 'rgba(177,138,86,.3)'; c.beginPath(); c.moveTo(w * 0.42, h * 0.62); c.lineTo(w * 0.58, h * 0.62); c.lineTo(w * 0.9, h); c.lineTo(w * 0.1, h); c.closePath(); c.fill();
      c.fillStyle = 'rgba(94,74,58,.5)'; c.font = '800 ' + Math.round(h * 0.12) + 'px ui-rounded,system-ui,sans-serif'; c.textAlign = 'center';
      c.fillText((dag && dag.opgave && dag.opgave.bogstav) || 'A', w * 0.5, h * 0.88);
    },
    'Himmelvejen': function (c, w, h) {
      c.fillStyle = 'rgba(255,255,255,.85)';
      [[0.2, 0.3, 1], [0.6, 0.2, 1.3], [0.8, 0.55, 0.9], [0.35, 0.65, 1.1]].forEach(function (s) {
        var x = w * s[0], y = h * s[1], k = h * 0.06 * s[2];
        c.beginPath(); c.arc(x, y, k, 0, 7); c.arc(x + k, y - k * 0.4, k * 1.2, 0, 7); c.arc(x + k * 2.2, y, k * 0.9, 0, 7); c.fill();
      });
      bakke(c, w, h * 0.9, '#93bc63', h * 0.04); snedriver(c, w, h * 0.92, h);
    },
    'Tegnestuen': function (c, w, h) {
      lodret(c, 0, 0, w, h, ['#e9e2d2', '#dccdb0']); vask(c, 0, 0, w, h, '#dccdb0', 1);
      rr(c, w * 0.12, h * 0.15, w * 0.24, h * 0.24, 10, '#aed3e4', '#8a663d', 7);
      c.strokeStyle = '#8a663d'; c.lineWidth = 7; c.beginPath(); c.moveTo(w * 0.6, h * 0.85); c.lineTo(w * 0.68, h * 0.2); c.lineTo(w * 0.76, h * 0.85); c.stroke();
      rr(c, w * 0.58, h * 0.22, w * 0.2, h * 0.3, 6, PAPIR, KANT, 3);
      KUGLEFARVER.forEach(function (f, i) { c.fillStyle = f; c.beginPath(); c.arc(w * (0.2 + i * 0.04), h * 0.82, h * 0.022, 0, 7); c.fill(); });
    },
    'Vrimleskoven': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.66, h);
      [[0.18, '#d95f45'], [0.42, '#f0c46a'], [0.7, '#8fc7e8']].forEach(function (hus) {
        var x = w * hus[0], b = w * 0.16, y = h * 0.42;
        c.fillStyle = hus[1]; c.fillRect(x, y, b, h * 0.26);
        c.fillStyle = '#8a663d'; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + b / 2, y - h * 0.12); c.lineTo(x + b + 8, y); c.fill();
        c.fillStyle = '#fbf7f0'; c.beginPath(); c.moveTo(x - 8, y); c.lineTo(x + b / 2, y - h * 0.12); c.lineTo(x + b / 2, y - h * 0.08); c.lineTo(x, y + 4); c.fill();
        rr(c, x + b * 0.3, y + h * 0.07, b * 0.4, h * 0.08, 4, 'rgba(240,196,106,.8)', KANT, 2);
      });
    },
    'Årstidshaven': function (c, w, h) {
      skov(c, w, h); snedriver(c, w, h * 0.62, h);
      for (var i = 0; i < 3; i++) rr(c, w * (0.1 + i * 0.22), h * 0.74, w * 0.18, h * 0.08, 10, '#b18a56');
      for (var k = 0; k < 3; k++) rr(c, w * (0.1 + k * 0.22), h * 0.72, w * 0.18, h * 0.04, 10, '#fbf7f0');
      var sm = hent(O.TING.snemand.billede); if (klar(O.TING.snemand.billede)) c.drawImage(sm, w * 0.74, h * 0.45, h * 0.3 * sm.naturalWidth / sm.naturalHeight, h * 0.3);
    },
    'Boblehavet': function (c, w, h) {
      c.fillStyle = '#8fc7e8'; c.fillRect(0, h * 0.5, w, h * 0.25); vask(c, 0, h * 0.5, w, h * 0.25, '#8fc7e8', 1);
      c.fillStyle = '#e5d3ae'; c.beginPath(); c.moveTo(0, h * 0.72); c.quadraticCurveTo(w * 0.5, h * 0.66, w, h * 0.74); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = 'rgba(251,247,240,.85)'; c.beginPath(); c.moveTo(0, h * 0.75); c.quadraticCurveTo(w * 0.5, h * 0.7, w, h * 0.77); c.lineTo(w, h * 0.8); c.quadraticCurveTo(w * 0.5, h * 0.76, 0, h * 0.8); c.fill();
      [[0.3, 0.58, 0.05], [0.55, 0.62, 0.035], [0.75, 0.56, 0.045]].forEach(function (b) {
        var g = c.createRadialGradient(w * b[0] - h * b[2] * 0.3, h * b[1] - h * b[2] * 0.3, 2, w * b[0], h * b[1], h * b[2]);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.4, '#cfe6f2'); g.addColorStop(1, '#8fc7e8');
        c.fillStyle = g; c.beginPath(); c.arc(w * b[0], h * b[1], h * b[2], 0, 7); c.fill();
      });
    },
    'Rimhulen': function (c, w, h) {
      lodret(c, 0, 0, w, h, ['#6b5545', '#8a7360', '#b18a56']); vask(c, 0, 0, w, h, '#8a7360', 1.2);
      c.fillStyle = 'rgba(248,241,230,.12)'; c.beginPath(); c.ellipse(w * 0.5, h * 0.55, w * 0.42, h * 0.42, 0, 0, 7); c.fill();
      [[0.15, 0.4], [0.85, 0.36]].forEach(function (l) {
        var g = c.createRadialGradient(w * l[0], h * l[1], 2, w * l[0], h * l[1], h * 0.16);
        g.addColorStop(0, 'rgba(240,196,106,.85)'); g.addColorStop(1, 'rgba(240,196,106,0)');
        c.fillStyle = g; c.beginPath(); c.arc(w * l[0], h * l[1], h * 0.16, 0, 7); c.fill();
      });
      c.fillStyle = '#d9ba8a'; c.fillRect(0, h * 0.82, w, h * 0.18);
    }
  };

  /** Pladsholderen til et afsnit: stedet, en stemning, figurerne og stedets navn. */
  function pladsholder(c, w, h, dag, nr) {
    saa(dag.dag * 10 + nr);
    var stemning = dag.sted === 'Stjerneuret' || dag.dag === 24 || (dag.dag === 23 && nr === 2) ? 'nat' : nr === 2 ? 'aften' : 'dag';
    var inde = dag.sted === 'Skovkøkkenet' || dag.sted === 'Tegnestuen' || dag.sted === 'Rimhulen';
    if (!inde) himmel(c, w, h, stemning);
    (STEDER[dag.sted] || STEDER['Nøddeskoven'])(c, w, h, dag);
    if (stemning === 'aften' && !inde) { c.fillStyle = 'rgba(155,123,212,.12)'; c.fillRect(0, 0, w, h); }
    if (stemning === 'nat' && !inde) { c.fillStyle = 'rgba(77,95,136,.18)'; c.fillRect(0, 0, w, h); }
    // Pelle til venstre, de andre til hoejre; Sanne flyver oppe til venstre
    var bund = h * 0.92;
    figur(c, 'pelle', w * 0.2, bund, h * 0.3);
    var andre = (dag.moeder || []).filter(function (n) { return n !== 'sanne'; });
    andre.forEach(function (n, i) { figur(c, n, w * (0.78 - i * 0.14), bund - i * h * 0.02, h * 0.32, { spejl: true }); });
    var skade = hent(O.FIGURER.sanne);
    if (klar(O.FIGURER.sanne)) { var sh = h * 0.2; c.drawImage(skade, w * 0.3, h * 0.12 + nr * h * 0.04, sh * skade.naturalWidth / skade.naturalHeight, sh); }
    vask(c, 0, 0, w, h, '#f8f1e6', 0.5);
    // Stedets navn paa et lille stykke papir: til den voksne, der proever kalenderen
    var fs = Math.round(h * 0.055);
    c.font = '800 ' + fs + 'px ui-rounded,"SF Pro Rounded",system-ui,sans-serif';
    var tekst = dag.sted, bb = c.measureText(tekst).width + fs * 1.4;
    rr(c, w * 0.03, h * 0.04, bb, fs * 2.5, fs * 0.6, 'rgba(248,241,230,.92)');
    c.fillStyle = KANT; c.textAlign = 'left'; c.textBaseline = 'middle';
    c.fillText(tekst, w * 0.03 + fs * 0.7, h * 0.04 + fs * 0.9);
    c.font = '700 ' + Math.round(fs * 0.62) + 'px ui-rounded,"SF Pro Rounded",system-ui,sans-serif';
    c.fillStyle = '#8a7360'; c.fillText('Dag ' + dag.dag + ' · ' + (nr + 1) + ' af 3', w * 0.03 + fs * 0.7, h * 0.04 + fs * 1.85);
  }

  /* ---------- brikkerne ---------- */

  function brikSti(c, br, b, h) {
    c.beginPath();
    P.sti(br, b, h).forEach(function (o) {
      if (o[0] === 'M') c.moveTo(o[1], o[2]);
      else if (o[0] === 'L') c.lineTo(o[1], o[2]);
      else if (o[0] === 'C') c.bezierCurveTo(o[1], o[2], o[3], o[4], o[5], o[6]);
      else c.closePath();
    });
  }
  /**
   * En brik med sin del af motivet og den gyldne kant, cellens oeverste venstre
   * hjoerne i (0, 0), cellen b x h. motiv er et canvas eller billede paa 4:3.
   * t faar et lys til at loebe rundt langs kanten; glans (0-1) goer det staerkere.
   */
  function brik(c, br, b, h, motivBillede, t, glans) {
    c.save();
    brikSti(c, br, b, h);
    c.save(); c.clip();
    if (motivBillede) c.drawImage(motivBillede, -br.kol * b, -br.raek * h, P.KOL * b, P.RAEK * h);
    else { c.fillStyle = '#d9ba8a'; c.fillRect(-b, -h, b * 3, h * 3); }
    // Lidt lys foroven og skygge forneden, saa brikken ser ud som trae med et billede paa
    var g = c.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, 'rgba(255,250,240,.16)'); g.addColorStop(1, 'rgba(94,74,58,.14)');
    c.fillStyle = g; c.fillRect(-b, -h, b * 3, h * 3);
    c.restore();
    var lw = Math.max(1.2, Math.min(b, h) * 0.035);
    c.lineJoin = 'round';
    c.strokeStyle = '#8a663d'; c.lineWidth = lw * 2; c.stroke();
    c.strokeStyle = GUL; c.lineWidth = lw; c.stroke();
    // Glimtet: et kort, lyst stykke af kanten, der loeber rundt
    if (t !== undefined && t !== null) {
      var omkreds = 2 * (b + h) * 1.25;
      c.setLineDash([omkreds * 0.08, omkreds * 0.92]);
      c.lineDashOffset = -((t * 0.35) % 1) * omkreds;
      c.strokeStyle = 'rgba(255,250,228,' + (0.55 + 0.45 * (glans || 0)) + ')'; c.lineWidth = lw * 1.3; c.stroke();
      c.setLineDash([]);
    }
    c.restore();
  }
  /** En lille gnist: fire spidser, til glimt og fest. */
  function gnist(c, x, y, r, a) {
    c.save(); c.globalAlpha = Math.max(0, Math.min(1, a === undefined ? 1 : a));
    c.fillStyle = '#fbe3a8';
    c.beginPath(); c.moveTo(x, y - r); c.quadraticCurveTo(x, y, x + r, y); c.quadraticCurveTo(x, y, x, y + r); c.quadraticCurveTo(x, y, x - r, y); c.quadraticCurveTo(x, y, x, y - r); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r * 0.18, 0, 7); c.fill();
    c.restore();
  }

  /* ---------- det, der daekker tingene i regnehistorierne ---------- */

  /** Gustavs viskestykke: ternet i roedt og papir, med bloede folder og en boelget kant forneden. */
  function klud(c, x, y, b, h) {
    c.save();
    c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 16; c.shadowOffsetY = 8;
    function form() {
      c.beginPath(); c.moveTo(x + 10, y); c.lineTo(x + b - 10, y); c.quadraticCurveTo(x + b, y, x + b, y + 10);
      c.lineTo(x + b, y + h - 8);
      for (var k = 6; k >= 0; k--) c.quadraticCurveTo(x + b * (k + 0.5) / 6, y + h + (k % 2 ? 7 : -3), x + b * k / 6, y + h - 4);
      c.lineTo(x, y + 10); c.quadraticCurveTo(x, y, x + 10, y); c.closePath();
    }
    form(); c.fillStyle = PAPIR; c.fill();
    c.shadowColor = 'transparent';
    c.save(); form(); c.clip();
    var t = Math.max(14, Math.min(b, h) / 6);
    c.fillStyle = 'rgba(217,95,69,.55)';
    for (var i = 0; i * t < b; i += 2) c.fillRect(x + i * t, y, t, h + 10);
    for (var j = 0; j * t < h + 10; j += 2) c.fillRect(x, y + j * t, b, t);
    var g = c.createLinearGradient(x, y, x + b, y);
    g.addColorStop(0, 'rgba(94,74,58,.12)'); g.addColorStop(0.35, 'rgba(255,255,255,.12)'); g.addColorStop(0.7, 'rgba(94,74,58,.1)'); g.addColorStop(1, 'rgba(255,255,255,.1)');
    c.fillStyle = g; c.fillRect(x, y, b, h + 10);
    c.restore();
    form(); c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 2; c.stroke();
    c.restore();
  }
  /** En bunke sne, der daekker noget: bloede, hvide buer med en lille blaa skygge. */
  function snebunke(c, x, bund, b, h) {
    c.save();
    c.fillStyle = 'rgba(143,199,232,.35)';
    c.beginPath(); c.ellipse(x, bund, b * 0.52, h * 0.16, 0, 0, 7); c.fill();
    c.fillStyle = '#fbf7f0';
    c.beginPath(); c.moveTo(x - b / 2, bund);
    c.bezierCurveTo(x - b * 0.48, bund - h * 0.7, x - b * 0.2, bund - h * 1.02, x, bund - h);
    c.bezierCurveTo(x + b * 0.24, bund - h * 1.0, x + b * 0.5, bund - h * 0.64, x + b / 2, bund);
    c.closePath(); c.fill();
    c.fillStyle = 'rgba(143,199,232,.3)';
    c.beginPath(); c.ellipse(x + b * 0.16, bund - h * 0.28, b * 0.2, h * 0.16, 0, 0, 7); c.fill();
    c.fillStyle = 'rgba(255,255,255,.9)';
    c.beginPath(); c.ellipse(x - b * 0.12, bund - h * 0.72, b * 0.14, h * 0.1, -0.4, 0, 7); c.fill();
    c.restore();
  }

  window.Maleri = {
    KUGLEFARVER: KUGLEFARVER, hent: hent, klar: klar, naarHentet: naarHentet, tone: tone, rr: rr, saa: saa, rnd: rnd,
    julekugle: julekugle, stjerne: stjerne, lys: lys, stamme: stamme, ting: ting, juletrae: juletrae, gran: gran,
    figur: figur, nis: nis, vinterscene: vinterscene, motiv: motiv, pladsholder: pladsholder,
    brikSti: brikSti, brik: brik, gnist: gnist, stjerneSti: stjerneSti, klud: klud, snebunke: snebunke
  };
})();
