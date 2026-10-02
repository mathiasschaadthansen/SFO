/**
 * Vrimleskoven — skaerm og lyd. Reglerne ligger i find.js.
 *
 * Et stort billede (engen, skoven eller byen) tegnet i kode, med Bogstavvejens
 * malede ting spredt ud som i en vrimlebog: i vinduerne, paa baenken, i
 * baaden, oppe i traeerne, halvt bag et trae eller et hegn, og loest paa
 * jorden. Stemmen siger "Her har du ordet kat. Kan du finde den?", og barnet
 * trykker paa tingen. Rigtigt: en ring i spillerens farve og "Du fandt den!".
 * Forkert: tingens eget ord, saa et forkert tryk ogsaa laerer noget. Har man
 * ledt laenge, lyser et bloedt skaer om tingen. To spillere: to skyer, roed og
 * blaa, i det samme billede.
 *
 * Stedet (himmel, huse, soe, sti, blomster, sten, fugle, roeg) tegnes én gang.
 * Byens bod, broend og baenk og landsbyen paa bakken er malede billeder fra
 * billeder/; husene forrest er tegnet i kode, fordi tingene skal kunne sidde i
 * vinduerne. Mangler et billede, tegnes stykket i kode.
 * Stedet tegnes
 * pr. skaermstoerrelse til et laerred i baggrunden; tingene, skjulene
 * (traeer, hegn, broend), ringene og skyerne tegnes hver frame, bagfra og
 * frem.
 */
(function () {
  'use strict';

  if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) {
      r = Math.min(typeof r === 'number' ? r : (r && r[0]) || 0, w / 2, h / 2);
      this.moveTo(x + r, y); this.lineTo(x + w - r, y); this.arcTo(x + w, y, x + w, y + r, r);
      this.lineTo(x + w, y + h - r); this.arcTo(x + w, y + h, x + w - r, y + h, r);
      this.lineTo(x + r, y + h); this.arcTo(x, y + h, x, y + h - r, r);
      this.lineTo(x, y + r); this.arcTo(x, y, x + r, y, r); this.closePath();
      return this;
    };
  }

  var F = window.Find;
  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var FARVER = ['#d95f45', '#5f9fc9'];
  var HORISONT = 0.40;            // feltets top som andel af skaermhoejden
  var HJAELP_EFTER = 12;          // sekunder uden fund, foer skaeret om tingen kommer

  var tilstand = 'menu';          // menu | spil | faerdig
  var sted = 'eng';
  var svaerhed = 0;
  var spillere = 1;
  var lydTil = true;
  var tid = 0, sidsteTid = 0;
  var omgang = null;              // fra Find.nyOmgang
  var spil = [];                  // pr. spiller: { ringe: [ord], venter, sidenFund, faerdig }
  var vip = {};                   // ord -> tid tilbage af et vip efter et forkert tryk
  var ekko = 0, ekkoFra = null;

  /* ---------- billeder ---------- */

  var billeder = {};
  function hent(n, sti) { if (billeder[n]) return; var img = new Image(); img.src = sti; billeder[n] = img; }
  F.ALLE.forEach(function (o) { hent(o.ord, o.fil); });
  ['trae', 'gran', 'siv', 'svamp', 'kastanje', 'pindsvin'].forEach(function (n) { hent('#' + n, '../maskinen/billeder/' + n + '.png'); });
  var SKJUL_BILLEDE = { trae: '#trae', gran: '#gran' };
  // Byens malede stykker (games/find/billeder/): staar der intet billede, tegnes stykket i kode
  ['hus1', 'hus2', 'hus3', 'bod', 'broend', 'baenk'].forEach(function (n) { hent('#by-' + n, 'billeder/' + n + '.png'); });
  hent('#hus', '../../assets/malet/hus.png');
  function tegnB(n, x, y, s, h) {
    var i = billeder[n];
    if (!(i && i.complete && i.naturalWidth)) return false;
    var hh = h || s * (i.naturalHeight / i.naturalWidth);
    ctx.drawImage(i, x - s / 2, y - hh / 2, s, hh);
    return true;
  }

  /* ---------- lyd og stemme (som i Rimhulen) ---------- */

  var lyd = null;
  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();
    return lyd;
  }
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });
  function tone(frekvens, længde, styrke, type) {
    if (!lydTil) return;
    try {
      var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
      o.type = type || 'triangle'; o.frequency.value = frekvens; g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination); o.start(); o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) { toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum); }); }

  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    stemme = window.speechSynthesis.getVoices().filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }

  var klipFindes = {};
  ['lyd/', '../bogstaver/lyd/', '../rim/lyd/'].forEach(function (mappe) {
    fetch(mappe + 'klip.json').then(function (r) { return r.ok ? r.json() : []; })
      .then(function (liste) { liste.forEach(function (f) { klipFindes[mappe + f] = true; }); })
      .catch(function () { /* ingen klip, enhedens stemme bruges */ });
  });
  var buffere = {}, aktivtKlip = null, afspillet = 0;
  function hentKlip(sti) {
    if (!buffere[sti]) {
      buffere[sti] = fetch(sti).then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    return buffere[sti];
  }
  function stopKlip() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  function afspil(stier, reserveTekst, fra) {
    if (!lydTil) return;
    ekko = 1.4; ekkoFra = fra || null;
    if (stier.some(function (s) { return !klipFindes[s]; })) { sig(reserveTekst); return; }
    Promise.all(stier.map(hentKlip)).then(function (bufs) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      stopKlip();
      bufs.forEach(function (buf) { var kilde = k.createBufferSource(); kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start); start += buf.duration - 0.04; aktivtKlip = kilde; });
      afspillet++;
    }).catch(function () { sig(reserveTekst); });
  }
  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(tekst); u.voice = stemme; u.lang = stemme.lang; u.rate = 0.85; window.speechSynthesis.speak(u); } catch (e) { /* stemme er pynt */ }
  }

  /* ---------- laerred, felt og sted ---------- */

  var bag = null;
  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr); lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px'; lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bag = null;
  }
  // Feltet 1000 x 600 ligger under horisonten og fylder hele bredden
  function fx(X) { return X / 1000 * window.innerWidth; }
  function fy(Y) { return window.innerHeight * HORISONT + Y / 600 * window.innerHeight * (1 - HORISONT); }
  function fs(S) { return S / 1000 * window.innerWidth; }
  function fh(S) { return S / 600 * window.innerHeight * (1 - HORISONT); }     // en hoejde i feltets enheder

  function sky(c, B, H, farve1, farve2) {
    var g = c.createLinearGradient(0, 0, 0, H * HORISONT); g.addColorStop(0, farve1); g.addColorStop(1, farve2);
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    c.fillStyle = 'rgba(255,255,255,.9)';
    [[B * 0.2, 60, 1], [B * 0.62, 40, 0.8]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], 24 * s[2], 0, 7); c.arc(s[0] + 26 * s[2], s[1] - 10 * s[2], 30 * s[2], 0, 7); c.arc(s[0] + 56 * s[2], s[1], 22 * s[2], 0, 7); c.fill(); });
  }
  function billede(c, n, x, y, s) { var i = billeder[n]; if (i && i.complete && i.naturalWidth) c.drawImage(i, x - s / 2, y - s * (i.naturalHeight / i.naturalWidth) / 2, s, s * (i.naturalHeight / i.naturalWidth)); }
  /** Et billede med foden i (x, y): bredden s, og kun den oeverste 'andel' af billedet, hvis den er sat. Falsk, hvis billedet mangler. */
  function billedeFod(c, n, x, y, s, andel) {
    var i = billeder[n]; if (!(i && i.complete && i.naturalWidth)) return false;
    andel = andel || 1;
    var h = s * (i.naturalHeight / i.naturalWidth) * andel;
    c.fillStyle = 'rgba(94,74,58,.14)'; c.beginPath(); c.ellipse(x, y, s * 0.5, s * 0.08, 0, 0, 7); c.fill();
    c.drawImage(i, 0, 0, i.naturalWidth, i.naturalHeight * andel, x - s / 2, y - h, s, h);
    return true;
  }
  function rr(c, x, y, b, h, r, fyld, kant, lw) { c.fillStyle = fyld; c.beginPath(); c.roundRect(x, y, b, h, r); c.fill(); if (kant) { c.strokeStyle = kant; c.lineWidth = lw || 3; c.stroke(); } }

  /* Fyld og liv: det, der goer et sted levende uden at vaere noget, man kan finde.
     Tegnet med en fast frø, saa billedet er det samme efter en drejning af skaermen. */
  var froe = 1;
  function rnd() { froe = (froe * 1664525 + 1013904223) % 4294967296; return froe / 4294967296; }
  function blomst(c, x, y, f, k) {
    k = k || 1;
    c.strokeStyle = '#5f8240'; c.lineWidth = 2 * k; c.beginPath(); c.moveTo(x, y); c.lineTo(x, y - 12 * k); c.stroke();
    c.fillStyle = f; for (var i = 0; i < 5; i++) { var v = i * Math.PI * 2 / 5; c.beginPath(); c.arc(x + Math.cos(v) * 4 * k, y - 14 * k + Math.sin(v) * 4 * k, 3.2 * k, 0, 7); c.fill(); }
    c.fillStyle = GUL; c.beginPath(); c.arc(x, y - 14 * k, 2.2 * k, 0, 7); c.fill();
  }
  function graes(c, x, y, k) { k = k || 1; c.strokeStyle = '#5f8240'; c.lineWidth = 2 * k; c.lineCap = 'round'; [-6, 0, 6].forEach(function (d, i) { c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + d * k, y - 8 * k, x + d * 1.4 * k, y - (14 - (i % 2) * 3) * k); c.stroke(); }); }
  function sten(c, x, y, r) { c.fillStyle = '#b8b2a4'; c.beginPath(); c.ellipse(x, y, r, r * 0.65, 0, 0, 7); c.fill(); c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - r * 0.3, y - r * 0.25, r * 0.4, r * 0.2, 0, 0, 7); c.fill(); }
  function fugl(c, x, y, s) { c.strokeStyle = KANT; c.lineWidth = 2.5; c.lineCap = 'round'; c.beginPath(); c.moveTo(x - s, y); c.quadraticCurveTo(x - s / 2, y - s * 0.8, x, y); c.quadraticCurveTo(x + s / 2, y - s * 0.8, x + s, y); c.stroke(); }
  function fugle(c, B, H) { fugl(c, B * 0.3, H * 0.09, 10); fugl(c, B * 0.34, H * 0.075, 8); fugl(c, B * 0.75, H * 0.12, 9); }
  function roeg(c, x, y, k) { c.fillStyle = 'rgba(255,255,255,.75)'; [[0, 0, 8], [6, -14, 10], [-2, -30, 12], [8, -48, 14]].forEach(function (p) { c.beginPath(); c.arc(x + p[0] * k, y + p[1] * k, p[2] * k, 0, 7); c.fill(); }); }
  /** Blomster, graes og sten spredt i feltet, uden om det, der er optaget (soeen, boden ...). */
  function strø(c, sted, antal, yFra, yTil, k) {
    var st = F.STEDER[sted], farver = ['#d95f45', '#9b7bd4', '#f8f1e6', '#f0c46a'];
    for (var i = 0; i < antal; i++) {
      var X = 15 + rnd() * 970, Y = yFra + rnd() * (yTil - yFra);
      if (st.optaget.some(function (o) { return X > o.x - 10 && X < o.x + o.b + 10 && Y > o.y - 10 && Y < o.y + o.h + 10; })) continue;
      if (st.soe && Math.hypot((X - st.soe.x) / (st.soe.rx + 20), (Y - st.soe.y) / (st.soe.ry + 20)) < 1) continue;
      var x = fx(X), y = fy(Y), kk = (k || 1) * (0.85 + F.skala(Y) * 0.25);
      if (i % 4 === 0) sten(c, x, y, (5 + rnd() * 5) * kk); else if (i % 4 === 1) blomst(c, x, y, farver[i % farver.length], kk); else graes(c, x, y, kk);
    }
  }
  /* Rekvisitterne har praecis de samme omrids som foer; kun malingen er ny: bloede overgange, straa, aarringe og en tynd, halvgennemsigtig kant. */
  var TYND = 'rgba(94,74,58,.5)';
  function hoestak(c, x, y, r) {
    c.fillStyle = 'rgba(94,74,58,.14)'; c.beginPath(); c.ellipse(x, y + r * 0.3, r * 1.15, r * 0.16, 0, 0, 7); c.fill();
    c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.lineTo(x + r, y + r * 0.3); c.lineTo(x - r, y + r * 0.3); c.closePath();
    var g = c.createLinearGradient(0, y - r, 0, y + r * 0.3); g.addColorStop(0, '#f2d690'); g.addColorStop(0.6, '#e5c37a'); g.addColorStop(1, '#c9a25c');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    var l = c.createRadialGradient(x - r * 0.35, y - r * 0.6, 0, x - r * 0.35, y - r * 0.6, r * 0.9);
    l.addColorStop(0, 'rgba(255,246,214,.55)'); l.addColorStop(1, 'rgba(255,246,214,0)'); c.fillStyle = l; c.fillRect(x - r, y - r, r * 2, r * 1.3);
    // straa: tynde buer fra toppen og ned ad siderne, skiftevis lyse og moerke
    c.lineCap = 'round';
    for (var i = 0; i < 26; i++) {
      var t = (i + 0.5) / 26, sx = x - r + t * r * 2, sy = y - Math.sqrt(Math.max(0, 1 - (t * 2 - 1) * (t * 2 - 1))) * r, bo = (t - 0.5) * r * 0.5;
      c.strokeStyle = i % 3 ? 'rgba(150,108,48,.32)' : 'rgba(255,240,196,.6)'; c.lineWidth = i % 3 ? 1 : 1.3;
      c.beginPath(); c.moveTo(sx, sy + 2); c.quadraticCurveTo(sx + bo * 0.5, (sy + y) / 2 + r * 0.1, sx + bo, y + r * 0.3); c.stroke();
    }
    var b = c.createLinearGradient(0, y, 0, y + r * 0.3); b.addColorStop(0, 'rgba(120,86,40,0)'); b.addColorStop(1, 'rgba(120,86,40,.3)');
    c.fillStyle = b; c.fillRect(x - r, y, r * 2, r * 0.3);
    c.restore();
    c.strokeStyle = TYND; c.lineWidth = 1.5; c.lineJoin = 'round'; c.beginPath(); c.arc(x, y, r, Math.PI, 0); c.lineTo(x + r, y + r * 0.3); c.lineTo(x - r, y + r * 0.3); c.closePath(); c.stroke();
  }
  function baenk(c, x, y, k) {
    if (billedeFod(c, '#by-baenk', x, y + 6 * (k || 1), 104 * (k || 1))) return;
    k = k || 1; rr(c, x - 40 * k, y - 12 * k, 80 * k, 8 * k, 3, '#b18a56', KANT, 2); rr(c, x - 40 * k, y - 34 * k, 80 * k, 8 * k, 3, '#b18a56', KANT, 2); c.strokeStyle = KANT; c.lineWidth = 3; [-30, 30].forEach(function (d) { c.beginPath(); c.moveTo(x + d * k, y - 34 * k); c.lineTo(x + d * k, y + 6 * k); c.stroke(); }); }
  function baad(c, x, y, k) {
    k = k || 1;
    // skyggen i vandet og et par lyse kruser
    c.fillStyle = 'rgba(60,110,150,.22)'; c.beginPath(); c.ellipse(x, y + 13 * k, 44 * k, 6 * k, 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.5; c.lineCap = 'round';
    [[-52, 16, 14], [40, 18, 18], [-20, 21, 12]].forEach(function (p) { c.beginPath(); c.moveTo(x + p[0] * k, y + p[1] * k); c.quadraticCurveTo(x + (p[0] + p[2] / 2) * k, y + (p[1] - 2) * k, x + (p[0] + p[2]) * k, y + p[1] * k); c.stroke(); });
    c.beginPath(); c.moveTo(x - 46 * k, y - 10 * k); c.lineTo(x + 46 * k, y - 10 * k); c.lineTo(x + 34 * k, y + 12 * k); c.lineTo(x - 34 * k, y + 12 * k); c.closePath();
    var g = c.createLinearGradient(0, y - 10 * k, 0, y + 12 * k); g.addColorStop(0, '#c9a06a'); g.addColorStop(0.5, '#b18a56'); g.addColorStop(1, '#8a663d');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    // plankerne og traeets aarer
    c.strokeStyle = 'rgba(94,74,58,.28)'; c.lineWidth = 1.2;
    [-3, 5].forEach(function (d) { c.beginPath(); c.moveTo(x - 46 * k, y + d * k); c.lineTo(x + 46 * k, y + d * k); c.stroke(); });
    c.strokeStyle = 'rgba(255,236,200,.25)'; c.lineWidth = 1;
    [[-30, -6], [8, 1], [-12, 9], [22, -7]].forEach(function (p) { c.beginPath(); c.moveTo(x + p[0] * k, y + p[1] * k); c.lineTo(x + (p[0] + 14) * k, y + p[1] * k); c.stroke(); });
    c.restore();
    c.beginPath(); c.moveTo(x - 46 * k, y - 10 * k); c.lineTo(x + 46 * k, y - 10 * k); c.lineTo(x + 34 * k, y + 12 * k); c.lineTo(x - 34 * k, y + 12 * k); c.closePath();
    c.strokeStyle = TYND; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke();
    // raelingen: en lys kant foroven, og den gamle planke paa siden
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 44 * k, y - 9 * k); c.lineTo(x + 44 * k, y - 9 * k); c.stroke();
    c.strokeStyle = 'rgba(138,102,61,.8)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - 40 * k, y); c.lineTo(x + 40 * k, y); c.stroke();
  }
  function stub(c, x, y, k) {
    k = k || 1;
    c.fillStyle = 'rgba(94,74,58,.16)'; c.beginPath(); c.ellipse(x, y + 12 * k, 32 * k, 6 * k, 0, 0, 7); c.fill();
    // barken: moerk i siderne og lysere, hvor lyset rammer
    c.beginPath(); c.roundRect(x - 26 * k, y - 18 * k, 52 * k, 30 * k, 6);
    var g = c.createLinearGradient(x - 26 * k, 0, x + 26 * k, 0); g.addColorStop(0, '#6a4c2c'); g.addColorStop(0.35, '#9c7647'); g.addColorStop(1, '#6f5030');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.lineCap = 'round';
    for (var i = 0; i < 9; i++) { var bx = x - 23 * k + i * 5.8 * k; c.strokeStyle = i % 2 ? 'rgba(60,42,26,.35)' : 'rgba(214,180,130,.25)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(bx, y - 12 * k); c.quadraticCurveTo(bx + 1.5 * k, y, bx - 0.5 * k, y + 12 * k); c.stroke(); }
    c.restore();
    c.strokeStyle = TYND; c.lineWidth = 1.3; c.beginPath(); c.roundRect(x - 26 * k, y - 18 * k, 52 * k, 30 * k, 6); c.stroke();
    // snitfladen: lyst trae med aarringe
    c.beginPath(); c.ellipse(x, y - 18 * k, 26 * k, 10 * k, 0, 0, 7);
    var t = c.createRadialGradient(x - 4 * k, y - 20 * k, 0, x, y - 18 * k, 26 * k); t.addColorStop(0, '#ecd5a6'); t.addColorStop(0.7, '#d9ba8a'); t.addColorStop(1, '#c29d66');
    c.fillStyle = t; c.fill();
    c.strokeStyle = 'rgba(138,102,61,.4)'; c.lineWidth = 0.9;
    [5, 10, 15, 20].forEach(function (rx) { c.beginPath(); c.ellipse(x + rx * 0.04 * k, y - 18 * k, rx * k, rx * 0.38 * k, 0, 0, 7); c.stroke(); });
    c.strokeStyle = 'rgba(138,102,61,.45)'; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x + 2 * k, y - 18 * k); c.lineTo(x + 12 * k, y - 21 * k); c.stroke();
    c.strokeStyle = 'rgba(111,80,48,.7)'; c.lineWidth = 2; c.beginPath(); c.ellipse(x, y - 18 * k, 26 * k, 10 * k, 0, 0, 7); c.stroke();
  }
  /** En vaeltet stamme med et hul i enden, som en ting kan kigge ud af (pladsen 'stamme'). */
  function stamme(c, st) {
    var x = fx(st.x), y = fy(st.y), b = fs(st.b), h = fh(st.h);
    c.fillStyle = 'rgba(94,74,58,.15)'; c.beginPath(); c.ellipse(x + b / 2, y + h, b * 0.55, h * 0.25, 0, 0, 7); c.fill();
    // stammen: rund, lys foroven og moerk forneden, med barkens lange furer
    c.beginPath(); c.roundRect(x + h * 0.4, y, b - h * 0.4, h, h / 2);
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#a98251'); g.addColorStop(0.45, '#8a663d'); g.addColorStop(1, '#5e4430');
    c.fillStyle = g; c.fill();
    c.save(); c.clip();
    c.lineCap = 'round';
    for (var i = 0; i < 7; i++) {
      var fy0 = y + h * (0.14 + i * 0.12);
      c.strokeStyle = i % 2 ? 'rgba(60,42,26,.3)' : 'rgba(222,190,140,.22)'; c.lineWidth = 1.3;
      c.beginPath(); c.moveTo(x + h * 0.6, fy0); c.bezierCurveTo(x + b * 0.4, fy0 + 2, x + b * 0.7, fy0 - 2, x + b, fy0 + 1); c.stroke();
    }
    c.strokeStyle = 'rgba(94,74,58,.3)'; c.lineWidth = 1.5; [0.35, 0.6, 0.85].forEach(function (t) { c.beginPath(); c.moveTo(x + b * t, y + 4); c.lineTo(x + b * t - 8, y + h - 4); c.stroke(); });
    c.restore();
    c.strokeStyle = TYND; c.lineWidth = 1.5; c.beginPath(); c.roundRect(x + h * 0.4, y, b - h * 0.4, h, h / 2); c.stroke();
    // hullet i enden: moerkt inderst og en kant af lyst trae
    c.beginPath(); c.ellipse(x + h * 0.5, y + h / 2, h * 0.5, h * 0.48, 0, 0, 7);
    var hul = c.createRadialGradient(x + h * 0.55, y + h * 0.55, 0, x + h * 0.5, y + h / 2, h * 0.5); hul.addColorStop(0, '#241b14'); hul.addColorStop(0.75, '#3a2d22'); hul.addColorStop(1, '#5a4532');
    c.fillStyle = hul; c.fill();
    c.strokeStyle = '#c9a56f'; c.lineWidth = 2.5; c.stroke();
    c.strokeStyle = TYND; c.lineWidth = 1; c.stroke();
  }
  /* ---- malet i kode: vask, korn og bloede kanter, saa kodehusene passer til de malede stykker ---- */
  /** Et andet froe til papiret og stenene, saa blomsterne og graesset ligger, hvor de altid har ligget. */
  var froe2 = 1;
  function rnd2() { froe2 = (froe2 * 1664525 + 1013904223) % 4294967296; return froe2 / 4294967296; }
  /** Papirets struktur: bloede pletter og fibre paa et lille laerred, lavet én gang og lagt som moenster. */
  var papir = null;
  function papirLaerred() {
    if (papir) return papir;
    papir = document.createElement('canvas'); papir.width = papir.height = 160;
    var k = papir.getContext('2d'), gem = froe2; froe2 = 21;
    function overalt(x, y, r, tegn) { [-160, 0, 160].forEach(function (dx) { [-160, 0, 160].forEach(function (dy) { if (x + dx > -r && x + dx < 160 + r && y + dy > -r && y + dy < 160 + r) tegn(x + dx, y + dy); }); }); }
    for (var i = 0; i < 50; i++) {
      var lys = rnd2() < 0.5, a = (lys ? 0.07 : 0.045) * (0.5 + rnd2()), r = 8 + rnd2() * 16;
      overalt(rnd2() * 160, rnd2() * 160, r, function (x, y) {
        var g = k.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, lys ? 'rgba(255,255,255,' + a.toFixed(3) + ')' : 'rgba(94,74,58,' + a.toFixed(3) + ')'); g.addColorStop(1, lys ? 'rgba(255,255,255,0)' : 'rgba(94,74,58,0)');
        k.fillStyle = g; k.beginPath(); k.arc(x, y, r, 0, 7); k.fill();
      });
    }
    k.lineCap = 'round';
    for (var j = 0; j < 120; j++) {
      var fx0 = rnd2() * 160, fy0 = rnd2() * 160, v = rnd2() * 7, l = 3 + rnd2() * 7, lysF = rnd2() < 0.5;
      k.strokeStyle = lysF ? 'rgba(255,255,255,.16)' : 'rgba(94,74,58,.08)'; k.lineWidth = 0.7;
      overalt(fx0, fy0, l, function (x, y) { k.beginPath(); k.moveTo(x, y); k.quadraticCurveTo(x + Math.cos(v) * l * 0.5 + 1, y + Math.sin(v) * l * 0.5 - 1, x + Math.cos(v) * l, y + Math.sin(v) * l); k.stroke(); });
    }
    froe2 = gem;
    return papir;
  }
  function papirFyld(c, x, y, b, h) {
    if (!c.papirMoenster) c.papirMoenster = c.createPattern(papirLaerred(), 'repeat');
    c.fillStyle = c.papirMoenster; c.fillRect(x, y, b, h);
  }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  /** Farven h, moerkere (k < 1) eller lysere (k > 1, blandet med hvid), med alfa a. */
  function farvetone(h, k, a) {
    var r = rgb(h).map(function (v) { return Math.round(k <= 1 ? v * k : v + (255 - v) * (k - 1)); });
    return 'rgba(' + r[0] + ',' + r[1] + ',' + r[2] + ',' + (a === undefined ? 1 : a) + ')';
  }
  /** En haandtegnet streg gennem punkterne: hvert stykke boejer lidt, som en pensel goer. */
  function haandsti(c, pts, luk) {
    c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
    var n = luk ? pts.length : pts.length - 1;
    for (var i = 0; i < n; i++) {
      var p = pts[i], q = pts[(i + 1) % pts.length], mx = (p[0] + q[0]) / 2 + (rnd() - 0.5) * 3, my = (p[1] + q[1]) / 2 + (rnd() - 0.5) * 3;
      c.quadraticCurveTo(mx, my, q[0], q[1]);
    }
    if (luk) c.closePath();
  }
  /** Akvarelvask inden i den aktuelle sti: fyld, lyse og moerke skyer, papirkorn og en bloed kant i samme farve. */
  function vask(c, pts, farve, luk) {
    haandsti(c, pts, luk !== false);
    c.save(); c.clip();
    var xs = pts.map(function (p) { return p[0]; }), ys = pts.map(function (p) { return p[1]; });
    var x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs), y0 = Math.min.apply(null, ys), y1 = Math.max.apply(null, ys), b = x1 - x0, h = y1 - y0;
    c.fillStyle = farve; c.fillRect(x0 - 4, y0 - 4, b + 8, h + 8);
    for (var i = 0; i < 7; i++) {
      c.fillStyle = farvetone(farve, i % 2 ? 0.88 : 1.3, 0.1);
      c.beginPath(); c.ellipse(x0 + rnd() * b, y0 + rnd() * h, b * (0.2 + rnd() * 0.35), h * (0.15 + rnd() * 0.35), rnd() * 3, 0, 7); c.fill();
    }
    c.fillStyle = farvetone(farve, 0.7, 0.06);
    for (var k = 0; k < b * h / 90; k++) { c.beginPath(); c.arc(x0 + rnd() * b, y0 + rnd() * h, 0.8 + rnd() * 1.2, 0, 7); c.fill(); }
    papirFyld(c, x0 - 4, y0 - 4, b + 8, h + 8);
    // kanten er moerkere, som naar vandet samler farven yderst: en bloed overgang i stedet for en streg
    haandsti(c, pts, luk !== false);
    c.strokeStyle = farvetone(farve, 0.78, 0.1); c.lineWidth = 10; c.stroke();
    c.strokeStyle = farvetone(farve, 0.75, 0.14); c.lineWidth = 5; c.stroke();
    c.strokeStyle = farvetone(farve, 0.72, 0.32); c.lineWidth = 2; c.stroke();
    c.restore();
    // og farven er loebet en smule ud i papiret
    c.strokeStyle = farvetone(farve, 0.85, 0.16); c.lineWidth = 2.2; c.stroke();
  }
  /** Et hus i byen, malet i kode efter Find.STEDER.by.huse: vinduerne og doeren er pladser og ligger praecis, hvor reglerne siger. */
  function hus(c, h) {
    var x = fx(h.x), y = fy(h.y), b = fs(h.b), hh = fh(h.h), top = y - hh * 0.42;
    c.fillStyle = 'rgba(94,74,58,.15)'; c.beginPath(); c.ellipse(x + b / 2, y + hh + 4, b * 0.6, 8, 0, 0, 7); c.fill();
    // vaeggen
    vask(c, [[x, y + 3], [x + b, y + 3], [x + b, y + hh], [x, y + hh]], h.farve);
    var lys = c.createLinearGradient(x, 0, x + b, 0); lys.addColorStop(0, 'rgba(255,250,235,.16)'); lys.addColorStop(0.5, 'rgba(255,250,235,0)'); lys.addColorStop(1, 'rgba(94,74,58,.08)');
    c.fillStyle = lys; c.fillRect(x + 1, y + 4, b - 2, hh - 5);
    // skorstenen: mursten
    if (h.skorsten) {
      var sx = x + b * 0.72, sy = y - fh(34), sb = fs(18), sh = fh(40);
      vask(c, [[sx, sy], [sx + sb, sy], [sx + sb, sy + sh], [sx, sy + sh]], '#b0705a');
      c.strokeStyle = farvetone('#b0705a', 0.7, 0.4); c.lineWidth = 1; for (var r = sy + 5; r < sy + sh; r += 6) { c.beginPath(); c.moveTo(sx + 1, r); c.lineTo(sx + sb - 1, r); c.stroke(); }
      roeg(c, sx + sb / 2, sy - 6, 0.8);
    }
    // taget: vask og raekker af tegl, og en skygge under udhaenget
    var tag = [[x - 12, y + 2], [x + b / 2, top], [x + b + 12, y + 2]];
    vask(c, tag, h.tag);
    c.save(); haandsti(c, tag, true); c.clip();
    c.strokeStyle = farvetone(h.tag, 0.72, 0.45); c.lineWidth = 1.3;
    for (var ry = top + 9, n = 0; ry < y + 6; ry += 8, n++) { for (var tx = x - 16 + (n % 2) * 7; tx < x + b + 16; tx += 14) { c.beginPath(); c.arc(tx, ry - 4, 6.5, 0.15, Math.PI - 0.15); c.stroke(); } }
    c.restore();
    var g = c.createLinearGradient(0, y + 2, 0, y + 14); g.addColorStop(0, 'rgba(94,74,58,.28)'); g.addColorStop(1, 'rgba(94,74,58,0)');
    c.fillStyle = g; c.fillRect(x, y + 2, b, 12);
    // vinduer og doer
    F.husPladser(h).forEach(function (p) {
      var k = p.klip, kx = fx(k.x), ky = fy(k.y), kb = fs(k.b), kh = fh(k.h);
      if (p.type === 'vindue') {
        vask(c, [[kx - 4, ky - 4], [kx + kb + 4, ky - 4], [kx + kb + 4, ky + kh + 3], [kx - 4, ky + kh + 3]], '#f3e9d8');
        var gl = c.createLinearGradient(kx, ky, kx + kb, ky + kh); gl.addColorStop(0, '#e4f0f7'); gl.addColorStop(1, '#b6d3e4');
        c.fillStyle = gl; c.beginPath(); c.roundRect(kx, ky, kb, kh, 3); c.fill();
        c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.moveTo(kx + kb * 0.1, ky + kh); c.lineTo(kx + kb * 0.55, ky); c.lineTo(kx + kb * 0.8, ky); c.lineTo(kx + kb * 0.35, ky + kh); c.closePath(); c.fill();
        vask(c, [[kx - 6, ky + kh + 2], [kx + kb + 6, ky + kh + 2], [kx + kb + 6, ky + kh + 8], [kx - 6, ky + kh + 8]], '#d9ba8a');
      } else {
        vask(c, [[kx - 4, ky - 3], [kx + kb + 4, ky - 3], [kx + kb + 4, ky + kh + 2], [kx - 4, ky + kh + 2]], '#b18a56');
        vask(c, [[kx, ky], [kx + kb, ky], [kx + kb, ky + kh], [kx, ky + kh]], '#4f3f30');
        c.fillStyle = GUL; c.beginPath(); c.arc(kx + kb * 0.8, ky + kh * 0.5, 3, 0, 7); c.fill();
      }
    });
  }
  /** Vindueskorset og karmen tegnes oven paa den ting, der sidder i vinduet, saa den ser ud til at vaere indenfor. */
  function vindueskors(k) {
    var kx = fx(k.x), ky = fy(k.y), kb = fs(k.b), kh = fh(k.h);
    ctx.strokeStyle = 'rgba(94,74,58,.55)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(kx + kb / 2, ky); ctx.lineTo(kx + kb / 2, ky + kh); ctx.moveTo(kx, ky + kh / 2); ctx.lineTo(kx + kb, ky + kh / 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(94,74,58,.45)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(kx, ky, kb, kh, 3); ctx.stroke();
  }
  function bod(c, bo) {
    var x = fx(bo.x), y = fy(bo.y), b = fs(bo.b), h = fh(30), tag = fh(22), top = y - fh(110);
    // Den malede bod: disken staar, hvor tingene paa boden har foedderne; det nederste af forsiden klippes fra, saa den ikke rager ud paa gaden
    var i = billeder['#by-bod'];
    if (i && i.complete && i.naturalWidth) {
      var bb = fs(bo.b * 0.8), hh = bb * (i.naturalHeight / i.naturalWidth), diskY = fy(bo.y - 20), t = diskY - hh * 0.6;   // markisen maa ikke naa op over doeren i huset bagved
      c.fillStyle = 'rgba(94,74,58,.14)'; c.beginPath(); c.ellipse(x, t + hh * 0.74, bb * 0.5, 8, 0, 0, 7); c.fill();
      c.drawImage(i, 0, 0, i.naturalWidth, i.naturalHeight * 0.74, x - bb / 2, t, bb, hh * 0.74);
      return;
    }
    rr(c, x - b / 2, y - h, b, h, 6, '#d9ba8a', KANT, 3);
    c.strokeStyle = KANT; c.lineWidth = 3; c.beginPath(); c.moveTo(x - b / 2 + 4, top + tag); c.lineTo(x - b / 2 + 4, y - h); c.moveTo(x + b / 2 - 4, top + tag); c.lineTo(x + b / 2 - 4, y - h); c.stroke();
    for (var i = 0; i < 6; i++) { c.fillStyle = i % 2 ? PAPIR : '#d95f45'; c.fillRect(x - b / 2 + i * b / 6, top, b / 6, tag); }
    c.strokeStyle = KANT; c.lineWidth = 3; c.strokeRect(x - b / 2, top, b, tag);
    c.fillStyle = '#d95f45'; for (var j = 0; j < 6; j++) { c.beginPath(); c.moveTo(x - b / 2 + j * b / 6, top + tag); c.lineTo(x - b / 2 + (j + 0.5) * b / 6, top + tag + 8); c.lineTo(x - b / 2 + (j + 1) * b / 6, top + tag); c.fill(); }
  }
  function trillebør(c, t) {
    var x = fx(t.x), y = fy(t.y);
    vask(c, [[x - 30, y - 22], [x + 26, y - 22], [x + 18, y], [x - 22, y]], '#5f9fc9');
    c.strokeStyle = farvetone('#8a663d', 1, 0.9); c.lineWidth = 3; c.lineCap = 'round'; c.beginPath(); c.moveTo(x + 26, y - 22); c.lineTo(x + 52, y - 26); c.stroke();
    var dk = c.createRadialGradient(x - 22, y + 2, 1, x - 20, y + 4, 9); dk.addColorStop(0, '#6a6055'); dk.addColorStop(1, '#3e3730');
    c.fillStyle = dk; c.beginPath(); c.arc(x - 20, y + 4, 9, 0, 7); c.fill();
    c.strokeStyle = 'rgba(229,211,174,.55)'; c.lineWidth = 1; for (var e = 0; e < 4; e++) { var ev = e * Math.PI / 4; c.beginPath(); c.moveTo(x - 20 - Math.cos(ev) * 5, y + 4 - Math.sin(ev) * 5); c.lineTo(x - 20 + Math.cos(ev) * 5, y + 4 + Math.sin(ev) * 5); c.stroke(); }
    c.fillStyle = '#d9ba8a'; c.beginPath(); c.arc(x - 20, y + 4, 2, 0, 7); c.fill();
  }
  function toerresnor(c, sn) {
    var x1 = fx(sn.x1), y1 = fy(sn.y1), x2 = fx(sn.x2), y2 = fy(sn.y2);
    c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.beginPath(); c.moveTo(x1, y1 - 30); c.lineTo(x1, y1 + 14); c.moveTo(x2, y2 - 30); c.lineTo(x2, y2 + 14); c.stroke();
    c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(x1, y1 - 28); c.quadraticCurveTo((x1 + x2) / 2, y1 - 16, x2, y2 - 28); c.stroke();
    ['#d95f45', '#8fc7e8', '#f0c46a', '#9b7bd4'].forEach(function (f, i) { var t = 0.2 + i * 0.2, x = x1 + (x2 - x1) * t, yy = y1 - 28 + 12 * 4 * t * (1 - t), hh = 18 + (i % 2) * 6; vask(c, [[x - 8, yy], [x + 8, yy], [x + 8, yy + hh], [x - 8, yy + hh]], f); });
  }
  /** Gaden: ujaevne brosten i lidt forskellige farver, lagt i raekker paa sandet. */
  function brosten(c, B, yFra, yTil) {
    var y0 = fy(yFra), y1 = fy(yTil);
    c.fillStyle = '#dcc8a0'; c.fillRect(0, y0, B, y1 - y0);
    var toner = ['#e9d9b8', '#e5d3ae', '#eadcbf', '#dfcba4', '#e6d6b4'];
    for (var r = 0; r * 24 < y1 - y0 - 20; r++) {
      var x = (r % 2) * 21 - 10 - rnd2() * 8;
      while (x < B) {
        var sb = 28 + rnd2() * 12, sh = 17 + rnd2() * 4, sy = y0 + 4 + r * 24 + (rnd2() - 0.5) * 2.5, rad = 5 + rnd2() * 3;
        c.fillStyle = toner[Math.floor(rnd2() * toner.length)];
        c.beginPath(); c.roundRect(x, sy, sb, sh, rad); c.fill();
        c.fillStyle = 'rgba(255,255,255,.28)'; c.beginPath(); c.ellipse(x + sb * 0.38, sy + sh * 0.32, sb * 0.26, sh * 0.16, -0.1, 0, 7); c.fill();
        c.strokeStyle = 'rgba(94,74,58,.14)'; c.lineWidth = 1.2; c.beginPath(); c.roundRect(x, sy, sb, sh, rad); c.stroke();
        x += sb + 4 + rnd2() * 4;
      }
    }
    papirFyld(c, 0, y0, B, y1 - y0);
  }

  function tegnEng(c, B, H) {
    var st = F.STEDER.eng; froe = 7;
    sky(c, B, H, '#8fc7e8', '#dcecf3'); fugle(c, B, H);
    var hor = H * HORISONT;
    c.fillStyle = '#7fa955'; c.beginPath(); c.moveTo(0, hor - 30); c.quadraticCurveTo(B * 0.25, hor - 70, B * 0.5, hor - 40); c.quadraticCurveTo(B * 0.78, hor - 10, B, hor - 60); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    for (var i = 0; i < 7; i++) billede(c, i % 3 === 1 ? '#gran' : '#trae', 40 + i * B * 0.135, hor - 62 - (i % 2) * 10, 96 + (i % 3) * 14);
    c.fillStyle = '#93bc63'; c.beginPath(); c.moveTo(0, hor + 10); c.quadraticCurveTo(B * 0.4, hor - 14, B * 0.7, hor + 8); c.quadraticCurveTo(B * 0.9, hor + 22, B, hor); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#a9c97a'; c.beginPath(); c.moveTo(0, H * 0.7); c.quadraticCurveTo(B * 0.5, H * 0.62, B, H * 0.72); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 44; c.lineCap = 'round'; c.beginPath(); c.moveTo(B * 0.05, H); c.quadraticCurveTo(B * 0.3, H * 0.7, B * 0.55, H * 0.62); c.quadraticCurveTo(B * 0.8, H * 0.55, B * 0.95, hor + 10); c.stroke();
    // Soeen ligger, hvor feltet ikke lader ting ligge (zonerne i find.js); baaden er en plads
    var sg = c.createRadialGradient(fx(st.soe.x) - fs(30), fy(st.soe.y) - fh(12), 0, fx(st.soe.x), fy(st.soe.y), fs(st.soe.rx));
    sg.addColorStop(0, '#b4dcf0'); sg.addColorStop(0.7, '#8fc7e8'); sg.addColorStop(1, '#73b2db');
    c.fillStyle = sg; c.beginPath(); c.ellipse(fx(st.soe.x), fy(st.soe.y), fs(st.soe.rx), fh(st.soe.ry), 0, 0, 7); c.fill();
    c.strokeStyle = 'rgba(95,159,201,.45)'; c.lineWidth = 5; c.stroke(); c.strokeStyle = 'rgba(95,130,64,.35)'; c.lineWidth = 1.5; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2; [[-60, -10], [20, 14], [70, -18]].forEach(function (p) { c.beginPath(); c.moveTo(fx(st.soe.x) + p[0], fy(st.soe.y) + p[1]); c.lineTo(fx(st.soe.x) + p[0] + 30, fy(st.soe.y) + p[1]); c.stroke(); });
    baad(c, fx(st.baad.x), fy(st.baad.y), fs(1));
    billede(c, '#siv', fx(660), fy(380), fs(60)); billede(c, '#siv', fx(910), fy(400), fs(50));
    billede(c, '#hus', B * 0.88, hor - 34, 150);
    st.hoestakke.forEach(function (h) { hoestak(c, fx(h.x), fy(h.y), fs(h.r)); });
    baenk(c, fx(st.baenk.x), fy(st.baenk.y), fs(1));
    strø(c, 'eng', 46, 70, 590, 1);
  }
  function tegnSkov(c, B, H) {
    var st = F.STEDER.skov; froe = 3;
    sky(c, B, H, '#c9dfe9', '#eaf0d8'); fugle(c, B, H);
    var hor = H * HORISONT;
    c.fillStyle = '#5f8240'; c.beginPath(); c.moveTo(0, hor - 20); c.quadraticCurveTo(B * 0.3, hor - 80, B * 0.6, hor - 30); c.quadraticCurveTo(B * 0.85, hor - 5, B, hor - 50); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    for (var i = 0; i < 10; i++) billede(c, i % 2 ? '#gran' : '#trae', 30 + i * B * 0.105, hor - 66 - (i % 3) * 12, 104 + (i % 2) * 24);
    c.fillStyle = '#7fa955'; c.beginPath(); c.moveTo(0, hor + 6); c.quadraticCurveTo(B * 0.5, hor - 16, B, hor + 4); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    // Moerkere pletter, stien, stubbe, den vaeltede stamme, svampe og kastanjer paa skovbunden
    c.fillStyle = 'rgba(95,130,64,.35)';
    [[0.15, 0.62, 140, 40], [0.55, 0.75, 180, 46], [0.85, 0.58, 120, 34], [0.35, 0.9, 160, 40]].forEach(function (p) { c.beginPath(); c.ellipse(B * p[0], H * p[1], p[2], p[3], 0, 0, 7); c.fill(); });
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(B * 0.9, H); c.quadraticCurveTo(B * 0.6, H * 0.8, B * 0.5, H * 0.62); c.quadraticCurveTo(B * 0.35, hor + 40, B * 0.1, hor + 20); c.stroke();
    st.stubbe.forEach(function (p) { stub(c, fx(p.x), fy(p.y), fs(1)); });
    stamme(c, st.stamme);
    [[60, 470], [620, 90], [800, 560], [980, 300]].forEach(function (p, i) { billede(c, i % 2 ? '#kastanje' : '#svamp', fx(p[0]), fy(p[1]), fs(30)); });
    strø(c, 'skov', 40, 50, 590, 1);
  }
  function tegnBy(c, B, H) {
    var st = F.STEDER.by; froe = 5;
    sky(c, B, H, '#8fc7e8', '#dcecf3'); fugle(c, B, H);
    var hor = H * HORISONT;
    c.fillStyle = '#93bc63'; c.beginPath(); c.moveTo(0, hor - 40); c.quadraticCurveTo(B * 0.3, hor - 75, B * 0.6, hor - 45); c.quadraticCurveTo(B * 0.85, hor - 20, B, hor - 60); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    [[0.06, 0], [0.45, 8], [0.98, 6]].forEach(function (p, i) { billede(c, i % 2 ? '#gran' : '#trae', B * p[0], hor - 70 + p[1], 110 + (i % 2) * 16); });
    // Landsbyen bag byen: de malede huse paa bakken, i mellemrummene mellem husene forrest
    [['#by-hus1', 210], ['#by-hus3', 630], ['#by-hus2', 870]].forEach(function (h) { billedeFod(c, h[0], fx(h[1]), hor - 4, 112); });
    // Gaden af brosten mellem husene og haven forrest
    brosten(c, B, 232, 402);
    c.fillStyle = '#a9c97a'; c.beginPath(); c.moveTo(0, fy(402)); c.lineTo(B, fy(402)); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 36; c.lineCap = 'round'; c.beginPath(); c.moveTo(B * 0.48, H); c.quadraticCurveTo(B * 0.5, fy(480), B * 0.52, fy(402)); c.stroke();
    // Husene bagest, fra venstre; roeg fra skorstenene, toejet paa snoren
    st.huse.forEach(function (h) { hus(c, h); });
    strø(c, 'by', 14, 212, 232, 0.9);
    bod(c, st.bod); baenk(c, fx(st.baenk.x), fy(st.baenk.y), fs(1)); trillebør(c, st.trillebør); toerresnor(c, st.toerresnor);
    [[40, 470], [560, 560], [975, 430]].forEach(function (p, i) { billede(c, i % 2 ? '#svamp' : '#kastanje', fx(p[0]), fy(p[1]), fs(26)); });
    strø(c, 'by', 40, 410, 590, 1);
  }
  var SCENER = { eng: tegnEng, skov: tegnSkov, by: tegnBy };
  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    if (!bag || bag.b !== B || bag.h !== H || bag.sted !== sted) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      bag = document.createElement('canvas');
      bag.width = Math.floor(B * dpr); bag.height = Math.floor(H * dpr); bag.b = B; bag.h = H; bag.sted = sted;
      var c = bag.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      froe2 = 11;
      (SCENER[sted] || tegnEng)(c, B, H);
    }
    ctx.drawImage(bag, 0, 0, B, H);
  }
  // Baggrunden tegnes igen, naar traeerne og huset er hentet
  // og menuens stedknapper, hvis menuen staar fremme
  ['#trae', '#gran', '#hus', '#siv', '#svamp', '#kastanje', '#by-hus1', '#by-hus2', '#by-hus3', '#by-bod', '#by-baenk', '#by-broend'].forEach(function (n) {
    billeder[n].addEventListener('load', function () { bag = null; if (tilstand === 'menu') overlay.querySelectorAll('canvas[data-sted]').forEach(tegnStedIkon); });
  });

  /** Skjulet: et malet trae eller en gran med foden i (x, y), et stakit eller en broend tegnet i kode. Tingene bag det tegnes lige foer det. */
  function tegnSkjul(sk) {
    if (sk.type === 'hegn') {
      var x0 = fx(sk.x), x1 = fx(sk.x + sk.b), y = fy(sk.y), h = fh(sk.h), bb = fs(9);
      ctx.strokeStyle = '#b18a56'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x0, y - h * 0.7); ctx.lineTo(x1, y - h * 0.7); ctx.moveTo(x0, y - h * 0.3); ctx.lineTo(x1, y - h * 0.3); ctx.stroke();
      ctx.strokeStyle = 'rgba(229,211,174,.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0, y - h * 0.7 - 1.2); ctx.lineTo(x1, y - h * 0.7 - 1.2); ctx.moveTo(x0, y - h * 0.3 - 1.2); ctx.lineTo(x1, y - h * 0.3 - 1.2); ctx.stroke();
      var pg = ctx.createLinearGradient(0, y - h, 0, y); pg.addColorStop(0, '#ecd8b0'); pg.addColorStop(0.6, '#d9ba8a'); pg.addColorStop(1, '#bf9a64');
      for (var x = x0 + bb / 2; x < x1; x += fs(20)) { ctx.fillStyle = pg; ctx.beginPath(); ctx.moveTo(x - bb / 2, y); ctx.lineTo(x - bb / 2, y - h * 0.85); ctx.lineTo(x, y - h); ctx.lineTo(x + bb / 2, y - h * 0.85); ctx.lineTo(x + bb / 2, y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = farvetone('#b18a56', 0.7, 0.45); ctx.lineWidth = 1.2; ctx.stroke(); }
      return;
    }
    if (sk.type === 'broend') {
      var bx = fx(sk.x), by = fy(sk.y), r = fs(sk.r);
      if (billedeFod(ctx, '#by-broend', bx, by + fs(4), r * 2.7)) return;
      ctx.fillStyle = 'rgba(94,74,58,.15)'; ctx.beginPath(); ctx.ellipse(bx, by + 4, r * 1.3, r * 0.3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#b8b2a4'; ctx.beginPath(); ctx.roundRect(bx - r, by - r * 1.1, r * 2, r * 1.1, 6); ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 3; ctx.stroke();
      ctx.strokeStyle = 'rgba(94,74,58,.3)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(bx - r, by - r * 0.55); ctx.lineTo(bx + r, by - r * 0.55); ctx.moveTo(bx - r * 0.3, by - r * 1.1); ctx.lineTo(bx - r * 0.3, by - r * 0.55); ctx.moveTo(bx + r * 0.4, by - r * 0.55); ctx.lineTo(bx + r * 0.4, by); ctx.stroke();
      ctx.strokeStyle = '#8a663d'; ctx.lineWidth = 5; ctx.beginPath(); ctx.moveTo(bx - r * 0.75, by - r * 1.1); ctx.lineTo(bx - r * 0.75, by - r * 2.6); ctx.moveTo(bx + r * 0.75, by - r * 1.1); ctx.lineTo(bx + r * 0.75, by - r * 2.6); ctx.stroke();
      ctx.fillStyle = '#d95f45'; ctx.beginPath(); ctx.moveTo(bx - r * 1.2, by - r * 2.5); ctx.lineTo(bx, by - r * 3.2); ctx.lineTo(bx + r * 1.2, by - r * 2.5); ctx.closePath(); ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 3; ctx.stroke();
      return;
    }
    var x = fx(sk.x), y = fy(sk.y), rr2 = fs(sk.r);
    ctx.fillStyle = 'rgba(94,74,58,.14)'; ctx.beginPath(); ctx.ellipse(x, y + rr2 * 0.75, rr2 * 1.1, rr2 * 0.22, 0, 0, 7); ctx.fill();
    if (!tegnB(SKJUL_BILLEDE[sk.type] || '#trae', x, y - rr2 * 0.5, rr2 * 2.6)) { ctx.fillStyle = '#5f8240'; ctx.beginPath(); ctx.arc(x, y - rr2 * 0.3, rr2, 0, 7); ctx.fill(); }
  }

  /* ---------- spillet ---------- */

  function start() {
    tilstand = 'spil';
    omgang = F.nyOmgang(sted, svaerhed, spillere);
    spil = omgang.spillere.map(function () { return { ringe: [], venter: 0, sidenFund: 0, faerdig: false }; });
    vip = {};
    setTimeout(function () { if (tilstand === 'spil') omgang.spillere.forEach(function (sp, s) { setTimeout(function () { sigSpoergsmaal(s); }, s * 2600); }); }, 500);
  }

  function skyRect(s) {
    var B = window.innerWidth, H = window.innerHeight, ms = Math.min(B, H);
    var b = ms * 0.24, h = b * 0.62, x = spillere === 1 ? B / 2 : B * (s === 0 ? 0.3 : 0.7);
    return { x: x - b / 2, y: 12, b: b, h: h, midt: x };
  }
  function aktuelt(s) { var sp = omgang.spillere[s]; return sp.spoergsmaal[sp.i]; }

  function sigSpoergsmaal(s) {
    if (tilstand !== 'spil' || spil[s].faerdig) return;
    var q = aktuelt(s), r = skyRect(s), fra = { x: r.midt, y: r.y + r.h };
    if (q.type === 'ord') afspil([F.ORD[q.ord].klip, F.KLIP.kan_du_finde[0]], F.ORDET + q.ord + '. ' + F.KLIP.kan_du_finde[1], fra);
    else afspil([F.KATEGORIER[q.kategori].klip], F.KATEGORIER[q.kategori].tekst, fra);
  }

  /* Trykket rammer det, man ser oeverst; se Find.rammer */
  var PROJ = { fx: function (X) { return fx(X); }, fy: function (Y) { return fy(Y); }, fs: function (S) { return fs(S); }, fh: function (S) { return fh(S); } };
  function tingVed(x, y) { return F.rammer(omgang, sted, x, y, PROJ); }

  function spilTryk(x, y) {
    for (var s = 0; s < spillere; s++) {
      var r = skyRect(s);
      if (x > r.x - 8 && x < r.x + r.b + 8 && y > r.y - 8 && y < r.y + r.h + 8) { sigSpoergsmaal(s); return; }
    }
    var t = tingVed(x, y);
    if (!t) return;
    // Hvem passer tingen til? Enkeltordene er forskellige spillerne imellem, og kategorierne overlapper dem ikke.
    for (var p = 0; p < spillere; p++) {
      if (spil[p].faerdig || spil[p].venter > 0) continue;
      var res = F.tryk(omgang, p, t.ord);
      if (res === 'rigtig' || res === 'alle') { fundet(p, t, res === 'alle'); return; }
      if (res === 'allerede') { tone(520, 0.06, 0.06); return; }
    }
    // Forkert for alle: tingen vipper og siger sit ord, saa man laerer det alligevel
    vip[t.ord] = 0.6;
    melodi([330, 262], 110);
    afspil([F.ORD[t.ord].klip], F.ORDET + t.ord, { x: fx(t.x), y: fy(t.y) - fs(t.str) / 2 });
  }

  function fundet(p, t, alle) {
    var st = spil[p], q = aktuelt(p);
    st.ringe.push(t.ord); st.sidenFund = 0;
    melodi(alle ? [660, 880, 1100, 1320] : [660, 880, 1100], 90);
    var er = q.type === 'ord' || alle;
    if (er) {
      st.venter = 2.2;
      afspil([alle ? F.KLIP.alle_sammen[0] : F.KLIP.du_fandt_den[0]], alle ? F.KLIP.alle_sammen[1] : F.KLIP.du_fandt_den[1], { x: fx(t.x), y: fy(t.y) - fs(t.str) / 2 });
      setTimeout(function () { naeste(p); }, 2000);
    }
  }

  function naeste(p) {
    if (tilstand !== 'spil') return;
    var st = spil[p];
    st.ringe = []; st.venter = 0; st.sidenFund = 0;
    if (!F.naeste(omgang, p)) {
      st.faerdig = true;
      if (spil.every(function (s) { return s.faerdig; })) { setTimeout(afslut, 600); return; }
      return;
    }
    setTimeout(function () { sigSpoergsmaal(p); }, 300);
  }

  function opdater(dt) {
    spil.forEach(function (st) { if (st.venter > 0) st.venter -= dt; if (!st.faerdig && st.venter <= 0) st.sidenFund += dt; });
    Object.keys(vip).forEach(function (o) { if (vip[o] > 0) vip[o] -= dt; });
    if (ekko > 0) ekko -= dt;
  }

  /* ---------- tegning ---------- */

  function tegnTing(t) {
    var x = fx(t.x), y = fy(t.y), s = fs(t.str), v = vip[t.ord] || 0, k = t.klip;
    ctx.save();
    if (k) { ctx.beginPath(); ctx.rect(fx(k.x), fy(k.y), fs(k.b), fh(k.h)); ctx.clip(); }   // i et vindue, en doer eller hullet i stammen
    ctx.translate(x, y + (k ? s * 0.12 : 0));
    if (v > 0) ctx.rotate(Math.sin(v * 40) * 0.12);
    if (!k) { ctx.fillStyle = 'rgba(94,74,58,.12)'; ctx.beginPath(); ctx.ellipse(0, s * 0.44, s * 0.38, s * 0.08, 0, 0, 7); ctx.fill(); }
    if (!tegnB(t.ord, 0, 0, s, s)) { ctx.fillStyle = '#e7ddc8'; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.fill(); }
    ctx.restore();
    if (k && t.plads >= 0 && F.STEDER[sted].pladser[t.plads].type === 'vindue') vindueskors(k);
  }
  function ring(x, y, r, farve) {
    ctx.strokeStyle = farve; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r - 6, 0, 7); ctx.stroke();
  }
  function tegnHoejttaler(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = KANT;
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.35); ctx.lineTo(-s * 0.4, -s * 0.35); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.4, s * 0.35); ctx.lineTo(-s, s * 0.35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.7, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  }
  /** Kategoriens tegn: farveplet, vinge, pote, gaffel eller hjul. Tegnet i kode. */
  function tegnKategoriIkon(k, x, y, r) {
    var kat = F.KATEGORIER[k];
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = KANT; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kat.ikon === 'farve') { ctx.fillStyle = kat.farve; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke(); }
    else if (kat.ikon === 'vinge') { ctx.beginPath(); ctx.moveTo(-r, r * 0.1); ctx.quadraticCurveTo(-r * 0.5, -r * 0.9, 0, r * 0.1); ctx.quadraticCurveTo(r * 0.5, -r * 0.9, r, r * 0.1); ctx.stroke(); }
    else if (kat.ikon === 'pote') { ctx.fillStyle = KANT; ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.45, r * 0.4, 0, 0, 7); ctx.fill(); [[-0.6, -0.2], [-0.22, -0.55], [0.22, -0.55], [0.6, -0.2]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, r * 0.2, 0, 7); ctx.fill(); }); }
    else if (kat.ikon === 'gaffel') { ctx.beginPath(); ctx.moveTo(-r * 0.3, r); ctx.lineTo(-r * 0.3, -r * 0.2); ctx.moveTo(-r * 0.6, -r); ctx.lineTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 0.3, 0, 0, -r * 0.3); ctx.lineTo(0, -r); ctx.moveTo(-r * 0.3, -r); ctx.lineTo(-r * 0.3, -r * 0.3); ctx.moveTo(r * 0.5, r); ctx.lineTo(r * 0.5, -r); ctx.stroke(); ctx.fillStyle = KANT; ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.5, r * 0.2, r * 0.5, 0, 0, 7); ctx.fill(); }
    else if (kat.ikon === 'hjul') { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 7); ctx.stroke(); for (var i = 0; i < 6; i++) { var v = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(v) * r * 0.25, Math.sin(v) * r * 0.25); ctx.lineTo(Math.cos(v) * r, Math.sin(v) * r); ctx.stroke(); } }
    ctx.restore();
  }
  function tegnSky(s) {
    var r = skyRect(s), q = aktuelt(s), sp = omgang.spillere[s], farve = spillere === 2 ? FARVER[s] : KANT;
    ctx.fillStyle = PAPIR; ctx.strokeStyle = farve; ctx.lineWidth = spillere === 2 ? 6 : 4;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.b, r.h, 24); ctx.fill(); ctx.stroke();
    if (spil[s].faerdig) { ring(r.midt, r.y + r.h / 2, r.h * 0.3, '#7ab648'); }
    else if (q.type === 'ord') tegnB(q.ord, r.midt - r.h * 0.08, r.y + r.h / 2, r.h * 0.72, r.h * 0.72);
    else {
      tegnKategoriIkon(q.kategori, r.midt - r.h * 0.1, r.y + r.h * 0.42, r.h * 0.2);
      // en prik pr. ting, der skal findes
      q.ord.forEach(function (o, i) { ctx.beginPath(); ctx.arc(r.midt - (q.ord.length - 1) * 11 + i * 22 - r.h * 0.1, r.y + r.h * 0.78, 7, 0, 7); ctx.fillStyle = q.fundet.indexOf(o) >= 0 ? GUL : 'rgba(94,74,58,.15)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke(); });
    }
    tegnHoejttaler(r.x + r.b - 22, r.y + r.h - 20, 9);
    // omgangens taeller: cirkler, ikke tal
    for (var i = 0; i < sp.spoergsmaal.length; i++) {
      ctx.beginPath(); ctx.arc(r.midt - (sp.spoergsmaal.length - 1) * 11 + i * 22, r.y + r.h + 16, 6, 0, 7);
      ctx.fillStyle = i < sp.i ? GUL : 'rgba(248,241,230,.75)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke();
    }
    // ekko-ringe mens stemmen taler
    if (ekko > 0 && ekkoFra && Math.abs(ekkoFra.x - r.midt) < 2) {
      var t = 1.4 - ekko;
      for (var j = 0; j < 3; j++) { var rr = 20 + ((t * 90 + j * 34) % 110); ctx.strokeStyle = 'rgba(248,241,230,' + (0.55 * (1 - rr / 130)).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.midt, r.y + r.h, rr, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    }
  }
  /** Skaeret: har man ledt laenge, lyser det bloedt om en ting, man mangler. */
  function tegnHjaelp(s) {
    var st = spil[s];
    if (st.faerdig || st.sidenFund < HJAELP_EFTER) return;
    var q = aktuelt(s), maal = q.type === 'ord' ? q.ord : q.ord.filter(function (o) { return q.fundet.indexOf(o) < 0; })[0];
    var t = omgang.ting.filter(function (x) { return x.ord === maal; })[0];
    if (!t) return;
    var x = fx(t.x), y = fy(t.y), r = fs(t.str) * (0.9 + Math.sin(tid * 3) * 0.12);
    var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, 'rgba(240,196,106,0)'); g.addColorStop(0.7, 'rgba(240,196,106,.45)'); g.addColorStop(1, 'rgba(240,196,106,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  /** Alt paa jorden tegnes bagfra og frem: det, der staar laengst nede, er naermest. En ting bag et skjul tegnes lige foer skjulet. */
  var lag = null, lagFor = null;
  function tegnJorden() {
    if (lagFor !== omgang) { lag = F.lagOrden(omgang, sted); lagFor = omgang; }   // samme raekkefoelge som trykket
    lag.forEach(function (l) { if (l.ting) tegnTing(l.ting); else tegnSkjul(l.skjul); });
  }
  function tegnSpil() {
    var B = window.innerWidth, H = window.innerHeight;
    tegnJorden();
    for (var s = 0; s < spillere; s++) {
      tegnHjaelp(s);
      spil[s].ringe.forEach(function (o) { var t = omgang.ting.filter(function (x) { return x.ord === o; })[0]; if (t) ring(fx(t.x), fy(t.y), fs(t.str) * 0.6, spillere === 2 ? FARVER[s] : GUL); });
    }
    tegnB('#pindsvin', B - 70, H - 74, Math.min(96, H * 0.14));
    for (var p = 0; p < spillere; p++) tegnSky(p);
  }

  /* ---------- menu og slut ---------- */

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay('<div class="kort"><h2>Flot!</h2><canvas class="eksempel" width="440" height="240"></canvas>' + Menu.slutRaekke('igen', null) + '</div>');
    var cv = overlay.querySelector('canvas.eksempel'), c = cv.getContext('2d'), p = billeder['#pindsvin'];
    if (p.complete && p.naturalWidth) c.drawImage(p, 150, 10, 140, 140 * (p.naturalHeight / p.naturalWidth));
    [0, 1, 2].forEach(function (i) { c.beginPath(); c.arc(90 + i * 130, 200, 22, 0, 7); c.fillStyle = GUL; c.fill(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke(); });
  }
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }

  /**
   * Stedernes knapper: et lille malet billede af hvert sted, med de samme malede traeer, graner og huse
   * som i spillet, paa en bloed himmel og jord. Mangler et billede endnu, tegnes knappen igen, naar det kommer.
   */
  function tegnStedIkon(cv) {
    var w = cv.width, h = cv.height, c = cv.getContext('2d'), s = cv.dataset.sted, gem = froe2;
    froe2 = s === 'skov' ? 3 : s === 'by' ? 5 : 7;
    c.clearRect(0, 0, w, h);
    c.save();
    c.beginPath(); c.roundRect(0, 0, w, h, 14); c.clip();
    // himlen
    var g = c.createLinearGradient(0, 0, 0, h * 0.6);
    g.addColorStop(0, s === 'skov' ? '#b9d6e4' : '#8fc7e8'); g.addColorStop(1, s === 'skov' ? '#eaf0d8' : '#dcecf3');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
    if (s === 'eng') { var sol = c.createRadialGradient(w * 0.84, h * 0.2, 0, w * 0.84, h * 0.2, 26); sol.addColorStop(0, 'rgba(240,196,106,1)'); sol.addColorStop(0.45, 'rgba(240,196,106,.9)'); sol.addColorStop(1, 'rgba(240,196,106,0)'); c.fillStyle = sol; c.fillRect(0, 0, w, h); }
    c.fillStyle = 'rgba(255,255,255,.85)'; c.beginPath(); c.arc(w * 0.22, h * 0.17, 8, 0, 7); c.arc(w * 0.22 + 10, h * 0.17 - 4, 10, 0, 7); c.arc(w * 0.22 + 21, h * 0.17, 7, 0, 7); c.fill();
    // bakken bagved og jorden forrest
    c.fillStyle = s === 'skov' ? '#5f8240' : '#7fa955';
    c.beginPath(); c.moveTo(0, h * 0.5); c.quadraticCurveTo(w * 0.3, h * 0.36, w * 0.6, h * 0.48); c.quadraticCurveTo(w * 0.85, h * 0.56, w, h * 0.44); c.lineTo(w, h); c.lineTo(0, h); c.fill();
    if (s === 'skov') {
      [[0.1, 0.6, 46, '#gran'], [0.32, 0.56, 42, '#trae'], [0.55, 0.6, 50, '#gran'], [0.8, 0.56, 44, '#trae'], [0.98, 0.6, 46, '#gran']].forEach(function (t) { billedeFod(c, t[3], w * t[0], h * t[1], t[2]); });
      c.fillStyle = '#7fa955'; c.beginPath(); c.moveTo(0, h * 0.64); c.quadraticCurveTo(w * 0.5, h * 0.56, w, h * 0.64); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.strokeStyle = '#e5d3ae'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(w * 0.62, h + 4); c.quadraticCurveTo(w * 0.45, h * 0.82, w * 0.3, h * 0.68); c.stroke();
      billedeFod(c, '#gran', w * 0.2, h * 0.98, 52);
      billedeFod(c, '#trae', w * 0.84, h * 1.02, 60);
      stub(c, w * 0.5, h * 0.86, 0.42);
      billede(c, '#svamp', w * 0.64, h * 0.9, 14);
    } else if (s === 'by') {
      billedeFod(c, '#trae', w * 0.07, h * 0.5, 34); billedeFod(c, '#gran', w * 0.95, h * 0.5, 30);
      // gaden af brosten
      c.fillStyle = '#dcc8a0'; c.fillRect(0, h * 0.68, w, h * 0.32);
      for (var r = 0; r < 4; r++) for (var x = (r % 2) * 8 - 8; x < w; x += 18) {
        c.fillStyle = ['#e9d9b8', '#e5d3ae', '#eadcbf', '#dfcba4'][Math.floor(rnd2() * 4)];
        c.beginPath(); c.roundRect(x + rnd2() * 2, h * 0.7 + r * 9, 14 + rnd2() * 2, 7, 3); c.fill();
      }
      [['#by-hus1', 0.22, 52], ['#by-hus3', 0.5, 50], ['#by-hus2', 0.78, 52]].forEach(function (t) { billedeFod(c, t[0], w * t[1], h * 0.76, t[2]); });
      billedeFod(c, '#by-broend', w * 0.5, h * 0.98, 24);
    } else {
      billedeFod(c, '#gran', w * 0.12, h * 0.52, 30); billedeFod(c, '#trae', w * 0.36, h * 0.5, 34);
      c.fillStyle = '#93bc63'; c.beginPath(); c.moveTo(0, h * 0.58); c.quadraticCurveTo(w * 0.45, h * 0.5, w, h * 0.6); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      c.fillStyle = '#a9c97a'; c.beginPath(); c.moveTo(0, h * 0.82); c.quadraticCurveTo(w * 0.5, h * 0.74, w, h * 0.84); c.lineTo(w, h); c.lineTo(0, h); c.fill();
      // soeen med baaden
      var sg = c.createRadialGradient(w * 0.74, h * 0.72, 0, w * 0.76, h * 0.74, 36); sg.addColorStop(0, '#b4dcf0'); sg.addColorStop(1, '#73b2db');
      c.fillStyle = sg; c.beginPath(); c.ellipse(w * 0.76, h * 0.74, 34, 10, 0, 0, 7); c.fill();
      baad(c, w * 0.78, h * 0.72, 0.3);
      hoestak(c, w * 0.3, h * 0.76, 17);
      billedeFod(c, '#trae', w * 0.1, h * 1.02, 52);
      billede(c, '#siv', w * 0.95, h * 0.68, 16);
      for (var i = 0; i < 9; i++) blomst(c, w * (0.3 + rnd2() * 0.65), h * (0.88 + rnd2() * 0.1), ['#d95f45', '#9b7bd4', '#f8f1e6', '#f0c46a'][i % 4], 0.55);
    }
    // papiret og en bloed, lys kant inderst, som paa et malet kort
    papirFyld(c, 0, 0, w, h);
    c.beginPath(); c.roundRect(0, 0, w, h, 14);
    c.strokeStyle = 'rgba(248,241,230,.55)'; c.lineWidth = 6; c.stroke();
    c.strokeStyle = 'rgba(94,74,58,.12)'; c.lineWidth = 2; c.stroke();
    c.restore();
    froe2 = gem;
  }
  function visMenu() {
    tilstand = 'menu';
    stopKlip();
    visOverlay(
      '<div class="kort"><h2>Vrimleskoven</h2>' +
      '<div class="raekke steder">' + F.STEDNAVNE.map(function (s) {
        return '<button class="knap smal ikon' + (s === sted ? ' valgt' : '') + '" data-handling="sted" data-k="' + s + '" aria-label="' + s + '"><canvas width="160" height="120" data-sted="' + s + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) + Menu.startRaekke('start') + Menu.lydRaekke(lydTil) + '</div>'
    );
    overlay.querySelectorAll('canvas[data-sted]').forEach(tegnStedIkon);
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'sted') { sted = knap.dataset.k; visMenu(); }
    else if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stopKlip(); visMenu(); }
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loop og input ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    tegnBaggrund();
    if (tilstand === 'spil') { opdater(dt); tegnSpil(); }
    requestAnimationFrame(løkke);
  }
  lærred.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var r = lærred.getBoundingClientRect();
    if (tilstand === 'spil') spilTryk(e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, sted: sted, svaerhed: svaerhed, spillere: spillere, lyd: lydTil, afspillet: afspillet,
      ting: omgang ? omgang.ting.map(function (t) { return { ord: t.ord, x: Math.round(fx(t.x)), y: Math.round(fy(t.y)), str: Math.round(fs(t.str)), bag: t.bag, plads: t.plads, makker: t.makker }; }) : null,
      spil: omgang ? omgang.spillere.map(function (sp, s) {
        var q = sp.spoergsmaal[sp.i], r = skyRect(s);
        return { i: sp.i, antal: sp.spoergsmaal.length, faerdig: spil[s].faerdig, venter: +spil[s].venter.toFixed(2), sky: { x: Math.round(r.midt), y: Math.round(r.y + r.h / 2) },
                 spoergsmaal: q ? { type: q.type, ord: q.type === 'ord' ? q.ord : null, kategori: q.kategori || null, medlemmer: q.type === 'kategori' ? q.ord : null, fundet: q.fundet || null } : null };
      }) : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
