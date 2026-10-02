/**
 * Bæverdammen: skub stammerne til side, saa Bodils lyse stamme kan glide ud
 * til daemningen. Pladsen set oppefra, 6 x 6 felter; logikken ligger i
 * daemning.js.
 *
 * En stamme flyttes ved at traekke den med fingeren. Den kan kun glide den
 * vej, den ligger, og kun saa langt, der er plads. Hver finger foelges for sig
 * (pointerId), saa to boern kan flytte hver sin stamme paa samme tid.
 *
 * Med to spillere har hver sin plads, og den ene er spejlet, saa begge
 * aabninger vender ind mod vandet i midten, hvor Bodil bygger én daemning af
 * begges stammer. Der er ingen taeller, intet ur og ingen game over; sidder
 * man fast, lyser den stamme, der skal flyttes nu.
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

  var D = window.Daemning, N = D.N;
  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', GUL = '#f0c46a';
  var HJAELP_EFTER = 14;          // sekunder uden et traek, foer den rigtige stamme lyser
  var RAMME = 0.34;               // bredden af bredden om pladsen, i felter

  var tilstand = 'menu';          // menu | spil | faerdig
  var svaerhed = 0, spillere = 1, lydTil = true;
  var tid = 0, sidsteTid = 0;
  var spil = [];                  // pr. spiller: plade, vis, baner, nr, ...
  var greb = {};                  // pointerId -> { s, i, fra, start, paaTvaers }
  var daem = 0, daemMaal = D.RUNDE, hop = 0, glimt = [];
  var landede = [], reserveret = 0;     // pladserne i daemningen: de stammer, der er landet, og dem, der er paa vej
  var sidstPaaTvaers = -99, hjaelpSagt = false;
  var L = null;                   // layoutet: plader og vandet

  /* ---------- billeder ---------- */
  var bodil = new Image();
  bodil.src = 'billeder/bodil.png';
  function harBodil() { return bodil.complete && bodil.naturalWidth > 0; }

  /* ---------- lyd og stemme ---------- */
  var lyd = null;
  function startLyd() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!lyd) lyd = new AC();
    if (lyd.state !== 'running') lyd.resume();
  }
  function tone(fr, l, st, forsink, type) {
    if (!lyd || !lydTil) return;
    var t0 = lyd.currentTime + (forsink || 0), o = lyd.createOscillator(), g = lyd.createGain();
    o.type = type || 'triangle'; o.frequency.value = fr;
    g.gain.setValueAtTime(st || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + l);
    o.connect(g); g.connect(lyd.destination); o.start(t0); o.stop(t0 + l + 0.05);
  }
  function melodi(toner, mellem) { toner.forEach(function (f, i) { tone(f, 0.22, 0.09, i * mellem / 1000); }); }
  var LYDE = {
    tag: function () { tone(330, 0.05, 0.03); },
    klonk: function () { tone(196, 0.12, 0.09); tone(147, 0.1, 0.06, 0.02); },
    nej: function () { tone(262, 0.1, 0.05); tone(247, 0.1, 0.04, 0.08); },
    plask: function () { for (var i = 0; i < 6; i++) tone(700 + Math.random() * 700, 0.08, 0.03, i * 0.06, 'sine'); },
    ud: function () { melodi([523, 659, 784, 1047], 90); },
    daemning: function () { melodi([523, 659, 784, 1047, 1319, 1568], 110); }
  };
  document.addEventListener('pointerdown', startLyd, true);

  /* Stemmen: klippene i lyd/ (Gemini, stemmen Kore), ellers enhedens egen danske stemme. Se js/stemme.js. */
  var stemme = Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.9 });
  function en(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  /* ---------- skaermen ---------- */
  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr); lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px'; lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = null;
  }
  /**
   * Pladserne og vandet. Venstre kant holdes fri til husknappen og pilen.
   * Én spiller: pladsen og vandet til hoejre. To: plads, vand, spejlet plads.
   */
  function layout() {
    if (L) return L;
    var W = window.innerWidth, H = window.innerHeight, VEN = 72, c, x0, oy, vb;
    if (spillere === 1) {
      vb = 3.1;
      c = Math.min((W - VEN - 16) / (N + 2 * RAMME + vb), (H - 28) / (N + 2 * RAMME + 0.4));
      var bred = (N + 2 * RAMME + vb) * c;
      x0 = VEN + Math.max(0, (W - VEN - 16 - bred) / 2); oy = (H - N * c) / 2;
      L = { c: c, plader: [{ ox: x0 + RAMME * c, oy: oy, spejl: false }], vand: { x: x0 + (N + 2 * RAMME) * c, y: oy - RAMME * c, b: vb * c, h: (N + 2 * RAMME) * c } };
    } else {
      vb = 3.2;
      c = Math.min((W - VEN - 12) / (2 * (N + 2 * RAMME) + vb), (H - 28) / (N + 2 * RAMME + 0.4));
      var bred2 = (2 * (N + 2 * RAMME) + vb) * c;
      x0 = VEN + Math.max(0, (W - VEN - 12 - bred2) / 2); oy = (H - N * c) / 2;
      var vx = x0 + (N + 2 * RAMME) * c;
      L = { c: c, plader: [{ ox: x0 + RAMME * c, oy: oy, spejl: false }, { ox: vx + vb * c + RAMME * c, oy: oy, spejl: true }],
            vand: { x: vx, y: oy - RAMME * c, b: vb * c, h: (N + 2 * RAMME) * c } };
    }
    return L;
  }
  /** Fra skaermen til felter paa spiller s' plads (spejlet for den anden spiller). */
  function lokal(s, x, y) {
    var P = layout().plader[s], c = L.c, lx = (x - P.ox) / c;
    return { x: P.spejl ? N - lx : lx, y: (y - P.oy) / c };
  }
  /** Fra felter paa spiller s' plads til skaermen. */
  function skaerm(s, gx, gy) {
    var P = layout().plader[s], c = L.c;
    return { x: P.ox + (P.spejl ? N - gx : gx) * c, y: P.oy + gy * c };
  }
  function rr(x, y, b, h, r, fyld) { ctx.beginPath(); ctx.roundRect(x, y, b, h, r); if (fyld) { ctx.fillStyle = fyld; ctx.fill(); } }

  /* ---------- spillet ---------- */
  function start() {
    tilstand = 'spil'; L = null; greb = {}; daem = 0; hop = 0; glimt = []; landede = []; reserveret = 0;
    daemMaal = D.RUNDE * spillere; hjaelpSagt = false; sidstPaaTvaers = -99;
    var runde = D.nyRunde(svaerhed, spillere);
    spil = runde.map(function (baner) { return { baner: baner, nr: 0, faerdig: false }; });
    spil.forEach(function (sp, s) { nyPlade(s); });
    stemme.tie();
    setTimeout(function () { if (tilstand === 'spil') stemme.sig(D.TEKST.start); }, 450);
  }
  function nyPlade(s) {
    var sp = spil[s], b = D.BANER[svaerhed][sp.baner[sp.nr]];
    sp.plade = D.lav(b.bane); sp.optimalt = b.traek;
    sp.vis = sp.plade.stammer.map(D.plads);
    sp.traek = 0; sp.stille = 0; sp.hint = null; sp.ud = null; sp.ind = 0; sp.vip = {}; sp.vis0 = null;
  }

  /** Stamme i paa spiller s' plads, hvor fingeren er, eller -1. Lidt ved siden af taeller med. */
  function stammeVed(s, x, y) {
    var p = lokal(s, x, y), sp = spil[s], bedst = -1, bd = 0.25;
    sp.plade.stammer.forEach(function (st, i) {
      var pos = sp.vis[i], x0 = st.lodret ? st.x : pos, y0 = st.lodret ? pos : st.y;
      var b = st.lodret ? 1 : st.len, h = st.lodret ? st.len : 1;
      var dx = Math.max(x0 - p.x, 0, p.x - (x0 + b)), dy = Math.max(y0 - p.y, 0, p.y - (y0 + h)), d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; bedst = i; }
    });
    return bedst;
  }
  /** Hvor langt stamme i kan glide lige nu. Stammer, en anden finger holder, optager begge de felter, de er imellem. */
  function graenser(s, i) {
    var sp = spil[s], st = sp.plade.stammer[i], o = [];
    for (var k = 0; k < N * N; k++) o.push(false);
    sp.plade.stammer.forEach(function (t, j) {
      if (j === i) return;
      var a = Math.floor(sp.vis[j] + 1e-6), b = Math.ceil(sp.vis[j] - 1e-6);
      [a, b].forEach(function (pos) {
        for (var q = 0; q < t.len; q++) o[(t.lodret ? pos + q : t.y) * N + (t.lodret ? t.x : pos + q)] = true;
      });
    });
    function tom(q) { return !o[st.lodret ? q * N + st.x : st.y * N + q]; }
    var p = D.plads(st), lo = p, hi = p;
    while (lo > 0 && tom(lo - 1)) lo--;
    while (hi + st.len < N && tom(hi + st.len)) hi++;
    return { min: lo, max: hi };
  }

  function tryk(e) {
    if (tilstand !== 'spil') return;
    var x = e.clientX, y = e.clientY;
    for (var s = 0; s < spillere; s++) {
      var sp = spil[s];
      if (sp.faerdig || sp.ud || sp.ind < 1) continue;
      var i = stammeVed(s, x, y);
      if (i < 0) continue;
      var holdt = Object.keys(greb).some(function (k) { return greb[k].s === s && greb[k].i === i; });
      if (holdt) return;
      var st = sp.plade.stammer[i], p = lokal(s, x, y);
      greb[e.pointerId] = { s: s, i: i, fra: st.lodret ? p.y : p.x, tvaers: st.lodret ? p.x : p.y, start: D.plads(st), g: graenser(s, i) };
      LYDE.tag();
      return;
    }
  }
  function traekFinger(e) {
    var g = greb[e.pointerId];
    if (!g) return;
    var sp = spil[g.s], st = sp.plade.stammer[g.i], p = lokal(g.s, e.clientX, e.clientY);
    var d = (st.lodret ? p.y : p.x) - g.fra, t = (st.lodret ? p.x : p.y) - g.tvaers;
    g.g = graenser(g.s, g.i);
    sp.vis[g.i] = Math.max(g.g.min, Math.min(g.g.max, g.start + d));
    // Traekker man paa tvaers, rokker stammen, og stemmen siger én gang imellem, hvordan den kan glide
    if (Math.abs(t) > 0.7 && Math.abs(d) < 0.3 && !g.paaTvaers) {
      g.paaTvaers = true; sp.vip[g.i] = 0.5; LYDE.nej();
      if (tid - sidstPaaTvaers > 25) { sidstPaaTvaers = tid; stemme.sig(D.TEKST.paaTvaers); }
    }
  }
  function slip(e) {
    var g = greb[e.pointerId];
    if (!g) return;
    delete greb[e.pointerId];
    var sp = spil[g.s], st = sp.plade.stammer[g.i];
    var til = Math.max(g.g.min, Math.min(g.g.max, Math.round(sp.vis[g.i])));
    if (til !== D.plads(st)) {
      if (st.lodret) st.y = til; else st.x = til;
      sp.traek++; sp.stille = 0; sp.hint = null;
      LYDE.klonk();
      if (D.loest(sp.plade)) ud(g.s);
    }
  }

  /** Bodils stamme er fri: den glider ud i vandet og flyver op paa daemningen. */
  function ud(s) {
    var sp = spil[s];
    sp.ud = { t: 0, plads: reserveret++ };
    LYDE.ud();
    Object.keys(greb).forEach(function (k) { if (greb[k].s === s) delete greb[k]; });
  }
  function landet(s) {
    var sp = spil[s];
    daem++; landede.push(sp.ud.plads); hop = 0.6; LYDE.plask();
    var pl = daemPlads(sp.ud.plads);
    for (var i = 0; i < 14; i++) { var v = Math.random() * Math.PI * 2; glimt.push({ x: pl.x, y: pl.y, vx: Math.cos(v) * 90, vy: Math.sin(v) * 90 - 60, liv: 0.8 }); }
    sp.nr++;
    if (sp.nr >= D.RUNDE) {
      sp.faerdig = true; sp.ud = null;
      if (spil.every(function (x) { return x.faerdig; })) {
        stemme.sig(D.TEKST.faerdig); LYDE.daemning();
        setTimeout(afslut, 3200);
      } else { stemme.sig(D.TEKST.tak[0]); stemme.koe(D.TEKST.venter); }
      return;
    }
    stemme.sig(en(D.TEKST.tak));
    setTimeout(function () { if (tilstand === 'spil') nyPlade(s); }, 700);
    sp.ud.t = 99;
  }

  function opdater(dt) {
    if (hop > 0) hop -= dt;
    glimt.forEach(function (g) { g.x += g.vx * dt; g.y += g.vy * dt; g.vy += 220 * dt; g.liv -= dt; });
    glimt = glimt.filter(function (g) { return g.liv > 0; });
    spil.forEach(function (sp, s) {
      if (sp.faerdig) return;
      if (sp.ind < 1) sp.ind = Math.min(1, sp.ind + dt * 2.2);
      Object.keys(sp.vip).forEach(function (k) { sp.vip[k] -= dt; if (sp.vip[k] <= 0) delete sp.vip[k]; });
      // Stammer, ingen holder, glider paa plads
      sp.plade.stammer.forEach(function (st, i) {
        var holdt = Object.keys(greb).some(function (k) { return greb[k].s === s && greb[k].i === i; });
        if (!holdt && !(sp.ud && i === 0)) sp.vis[i] += (D.plads(st) - sp.vis[i]) * Math.min(1, dt * 16);
      });
      if (sp.ud && sp.ud.t < 99) {
        sp.ud.t += dt;
        if (sp.ud.t < 0.45) sp.vis[0] = (N - 2) + (sp.ud.t / 0.45) * 2.5;
        else if (sp.ud.t >= 1.15) landet(s);
        return;
      }
      if (sp.ud) return;
      var holder = Object.keys(greb).some(function (k) { return greb[k].s === s; });
      if (!holder) sp.stille += dt;
      // Sidder man fast, lyser den stamme, der skal flyttes nu
      var efter = sp.traek > sp.optimalt * 2 + 6 ? 5 : HJAELP_EFTER;
      if (!sp.hint && sp.stille > efter) {
        sp.hint = D.hjaelp(sp.plade);
        if (sp.hint && !hjaelpSagt) { hjaelpSagt = true; stemme.sig(D.TEKST.hjaelp); }
      }
    });
  }

  /* ---------- tegning ---------- */

  /**
   * Hvor stamme nr. k ligger i daemningen: en bunke, nederst flest, lige under
   * Bodil. Hver stamme ligger lidt paa skraa, saa bunken ligner en rigtig
   * daemning, men de kan stadig taelles én for én.
   */
  function daemPlads(k) {
    var V = layout().vand, c = L.c, bund = 1;
    while (bund * (bund + 1) / 2 < daemMaal) bund++;
    var raekke = 0, i = k, n = bund;
    while (i >= n && n > 1) { i -= n; raekke++; n--; }
    var lb = Math.min(1.15 * c, V.b / (bund + 0.3));
    var v = (((k * 7) % 5) - 2) * 0.04, dx = (((k * 3) % 4) - 1.5) * 0.035 * lb;
    return { x: V.x + V.b / 2 + (i - (n - 1) / 2) * lb + dx, y: V.y + V.h - 0.72 * c - raekke * lb * 0.36, b: lb * 0.98, v: v, lb: lb, bund: bund };
  }

  /** Smaa forskelle i barken, saa ikke alle stammer har praecis samme brune farve: lys, moerk, roedlig og graalig. */
  var BARK = [
    ['#b18a56', '#9c7648', '#6b5545'], ['#bb955f', '#a37d4c', '#735b46'], ['#a6804f', '#906c40', '#634d3c'],
    ['#b6875a', '#9d6d45', '#6e5141'], ['#ac8d62', '#957a55', '#685747'], ['#b38f5a', '#a07e4c', '#6f5a44']
  ];
  /** Et lille fast tal ud fra stammens navn, saa den samme stamme altid ser ens ud. */
  function froe(navn) { var f = 0; for (var q = 0; q < navn.length; q++) f += navn.charCodeAt(q) * (q + 3); return f; }

  /** En stamme paa tvaers, len felter lang, med oeverste venstre hjoerne i (0,0) og hoejde 1. Tegnes paa c. */
  function tegnStammeForm(c, len, birk, navn) {
    var h = 0.74, y0 = (1 - h) / 2, x0 = 0.07, b = len - 0.14;
    var fro = froe(navn);
    function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
    var farve = BARK[froe(navn) % BARK.length];
    function form() { c.beginPath(); c.roundRect(x0, y0, b, h, 0.33); }
    // en blød skygge under stammen, der hvor den ligger paa jorden
    c.fillStyle = 'rgba(94,74,58,.10)'; c.beginPath(); c.roundRect(x0 + 0.03, y0 + 0.06, b, h, 0.33); c.fill();
    var gr = c.createLinearGradient(0, y0, 0, y0 + h);
    if (birk) { gr.addColorStop(0, '#fdf9f1'); gr.addColorStop(0.5, '#f3e9d8'); gr.addColorStop(1, '#e2cfa8'); }
    else { gr.addColorStop(0, farve[0]); gr.addColorStop(0.45, farve[1]); gr.addColorStop(1, farve[2]); }
    form(); c.fillStyle = gr; c.fill();
    c.save(); form(); c.clip();
    // akvarel: lidt lysere og moerkere pletter i barken, saa farven ikke er helt jaevn
    for (var p = 0; p < len * 3; p++) {
      var px = x0 + tilf() * b, py = y0 + 0.1 + tilf() * (h - 0.2), pr = 0.25 + tilf() * 0.35;
      c.fillStyle = birk ? 'rgba(229,211,174,.18)' : (tilf() < 0.6 ? 'rgba(94,74,58,.09)' : 'rgba(229,211,174,.07)');
      c.beginPath(); c.ellipse(px, py, pr * 2.2, 0.06 + tilf() * 0.05, 0, 0, 7); c.fill();
    }
    // lys ovenpaa og skygge forneden giver stammen sin rundhed
    c.fillStyle = 'rgba(255,255,255,' + (birk ? '.35' : '.13') + ')'; c.beginPath(); c.roundRect(x0 + 0.2, y0 + 0.08, b - 0.5, 0.13, 0.06); c.fill();
    c.fillStyle = 'rgba(94,74,58,' + (birk ? '.12' : '.16') + ')'; c.fillRect(x0, y0 + h - 0.13, b, 0.13);
    c.restore();
    form(); c.lineWidth = 0.035; c.strokeStyle = birk ? 'rgba(94,74,58,.45)' : 'rgba(94,74,58,.55)'; c.stroke();
    // Barken: striber paa langs, eller birkens moerke pletter
    c.lineCap = 'round';
    if (birk) {
      // birkens smaa moerke streger, jaevnt fordelt over hele stammen
      c.strokeStyle = KANT;
      var antal = len * 5;
      for (var m = 0; m < antal; m++) {
        var mx = x0 + 0.28 + (m + tilf() * 0.7) / antal * (b - 0.7), my = y0 + h * [0.22, 0.62, 0.4, 0.8, 0.3][m % 5] + (tilf() - 0.5) * 0.06;
        c.lineWidth = 0.03 + tilf() * 0.025; c.globalAlpha = 0.65 + tilf() * 0.3;
        c.beginPath(); c.moveTo(mx, my); c.lineTo(mx + 0.07 + tilf() * 0.16, my + (tilf() - 0.5) * 0.02); c.stroke();
      }
      c.globalAlpha = 1;
    } else {
      c.strokeStyle = 'rgba(94,74,58,.4)'; c.lineWidth = 0.035;
      for (var l = 0; l < len * 2 + 1; l++) {
        var ly = y0 + 0.15 + tilf() * (h - 0.3), lx = x0 + 0.3 + tilf() * (b - 1.35);
        c.beginPath(); c.moveTo(lx, ly); c.lineTo(lx + 0.4 + tilf() * 0.5, ly + (tilf() - 0.5) * 0.04); c.stroke();
      }
      // en knast, der hvor en gren har siddet: en lille moerk plet med en ring, og barken boejer uden om
      var knaster = len > 2 ? 2 : 1;
      for (var k = 0; k < knaster; k++) {
        var kx = x0 + 0.5 + (k + 0.2 + tilf() * 0.4) * (b - 1.1) / knaster, ky = k ? y0 + h * 0.68 : y0 + h * 0.3;
        c.fillStyle = 'rgba(94,74,58,.22)'; c.beginPath(); c.ellipse(kx + 0.015, ky + 0.02, 0.09, 0.065, 0, 0, 7); c.fill();
        c.fillStyle = farve[0]; c.beginPath(); c.ellipse(kx, ky, 0.08, 0.06, 0, 0, 7); c.fill();
        c.fillStyle = 'rgba(255,255,255,.18)'; c.beginPath(); c.ellipse(kx - 0.02, ky - 0.02, 0.05, 0.03, 0, 0, 7); c.fill();
        c.fillStyle = farve[2]; c.beginPath(); c.ellipse(kx + 0.01, ky + 0.008, 0.035, 0.026, 0, 0, 7); c.fill();
      }
    }
    // Den savede ende med aarringe
    var ex = x0 + b - 0.16;
    var eg = c.createRadialGradient(ex, 0.5, 0.01, ex, 0.5, h / 2);
    eg.addColorStop(0, birk ? '#f6e8cc' : '#efe0c0'); eg.addColorStop(1, birk ? '#ead6b2' : '#d9ba8a');
    c.fillStyle = eg; c.beginPath(); c.ellipse(ex, 0.5, 0.12, h / 2 - 0.04, 0, 0, 7); c.fill();
    c.strokeStyle = '#b18a56'; c.lineWidth = 0.03; c.stroke();
    c.beginPath(); c.ellipse(ex, 0.5, 0.06, 0.17, 0, 0, 7); c.stroke();
    c.lineWidth = 0.018; c.strokeStyle = 'rgba(177,138,86,.6)'; c.beginPath(); c.ellipse(ex, 0.5, 0.025, 0.07, 0, 0, 7); c.stroke();
    // Bodils stamme har en lille gren med et blad, saa den kan kendes
    if (birk) {
      c.strokeStyle = '#8a663d'; c.lineWidth = 0.05;
      c.beginPath(); c.moveTo(x0 + 0.55, y0 + 0.12); c.lineTo(x0 + 0.75, y0 - 0.08); c.stroke();
      c.save(); c.translate(x0 + 0.8, y0 - 0.1); c.rotate(-0.6);
      c.fillStyle = '#93bc63'; c.beginPath(); c.ellipse(0.12, 0, 0.16, 0.08, 0, 0, 7); c.fill();
      c.strokeStyle = '#5f8240'; c.lineWidth = 0.025; c.beginPath(); c.moveTo(-0.02, 0); c.lineTo(0.26, 0); c.stroke();
      c.restore();
    }
  }
  /**
   * Stammerne males én gang hver i et lille lærred og tegnes derfra, saa
   * barken ikke skal males forfra i hvert billede. Lærredet har en margen,
   * saa birkens blad og skyggen kommer med.
   */
  var stammeBilleder = {}, stammeSkala = 0, SM = 0.25;
  function tegnStammeBillede(len, birk, navn) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), sk = Math.ceil((L ? L.c : 60) * dpr);
    if (sk !== stammeSkala) { stammeBilleder = {}; stammeSkala = sk; }
    var noegle = len + (birk ? 'b' : 'x') + navn, bil = stammeBilleder[noegle];
    if (!bil) {
      bil = document.createElement('canvas');
      bil.width = Math.ceil((len + 2 * SM) * sk); bil.height = Math.ceil((1 + 2 * SM) * sk);
      var c = bil.getContext('2d');
      c.setTransform(sk, 0, 0, sk, SM * sk, SM * sk);
      tegnStammeForm(c, len, birk, navn);
      stammeBilleder[noegle] = bil;
    }
    ctx.drawImage(bil, -SM, -SM, len + 2 * SM, 1 + 2 * SM);
  }
  /** Stamme i paa en plads, tegnet i felter (koordinatsystemet er allerede sat op). */
  function tegnStamme(sp, i, holdt, glød) {
    var st = sp.plade.stammer[i], pos = sp.vis[i], x = st.lodret ? st.x : pos, y = st.lodret ? pos : st.y;
    var b = st.lodret ? 1 : st.len, h = st.lodret ? st.len : 1, vip = sp.vip[i] ? Math.sin(sp.vip[i] * 40) * 0.05 : 0;
    // skygge
    ctx.fillStyle = holdt ? 'rgba(94,74,58,.28)' : 'rgba(94,74,58,.2)';
    rr(x + 0.1, y + 0.13 + (holdt ? 0.08 : 0), b - 0.2, h - 0.2, 0.3); ctx.fill();
    ctx.save();
    ctx.translate(x + b / 2, y + h / 2 - (holdt ? 0.05 : 0));
    ctx.rotate(vip);
    if (holdt) ctx.scale(1.04, 1.04);
    if (glød) {
      var a = 0.45 + Math.sin(tid * 5) * 0.3;
      ctx.strokeStyle = 'rgba(240,196,106,' + a.toFixed(2) + ')'; ctx.lineWidth = 0.16;
      rr(-b / 2 + 0.02, -h / 2 + 0.06, b - 0.04, h - 0.12, 0.36); ctx.stroke();
    }
    if (st.lodret) { ctx.rotate(Math.PI / 2); ctx.translate(-h / 2, -b / 2); }
    else ctx.translate(-b / 2, -h / 2);
    tegnStammeBillede(st.len, st.maal, st.navn || 'x');
    ctx.restore();
  }
  /** En gul pil ved den stamme, der lyser, den vej den skal. */
  function tegnHintPil(sp) {
    var h = sp.hint, st = sp.plade.stammer[h.i], fra = D.plads(st), op = h.til < fra;
    var pos = sp.vis[h.i], bev = Math.sin(tid * 5) * 0.08;
    var cx, cy, v;
    if (st.lodret) { cx = st.x + 0.5; cy = op ? pos - 0.25 - bev : pos + st.len + 0.25 + bev; v = op ? -Math.PI / 2 : Math.PI / 2; }
    else { cy = st.y + 0.5; cx = op ? pos - 0.25 - bev : pos + st.len + 0.25 + bev; v = op ? Math.PI : 0; }
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(v);
    ctx.fillStyle = GUL; ctx.strokeStyle = KANT; ctx.lineWidth = 0.04; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(0.2, 0); ctx.lineTo(-0.1, -0.2); ctx.lineTo(-0.1, 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.restore();
  }

  /** Pladsen paa skaermen: bredden, jorden og felterne ligger i det faste billede (se tegnScene); her kun stammerne. */
  function tegnPlads(s) {
    var sp = spil[s], P = layout().plader[s], c = L.c;
    ctx.save();
    ctx.translate(P.ox, P.oy);
    if (P.spejl) { ctx.translate(N * c, 0); ctx.scale(-1, 1); }
    ctx.scale(c, c);
    // stammerne: den, der holdes, oeverst
    ctx.globalAlpha = sp.faerdig ? 1 : Math.min(1, sp.ind * 1.2);
    var holdte = {};
    Object.keys(greb).forEach(function (k) { if (greb[k].s === s) holdte[greb[k].i] = true; });
    if (!sp.faerdig) {
      sp.plade.stammer.forEach(function (st, i) { if (!holdte[i] && !(sp.ud && i === 0)) tegnStamme(sp, i, false, sp.hint && sp.hint.i === i); });
      Object.keys(holdte).forEach(function (i) { tegnStamme(sp, +i, true, false); });
      if (sp.hint && !Object.keys(holdte).length) tegnHintPil(sp);
      if (sp.ud && sp.ud.t < 0.45) tegnStamme(sp, 0, false, false);
    }
    ctx.globalAlpha = 1;
    ctx.restore();
    // Stammen paa vej op paa daemningen
    if (sp.ud && sp.ud.t >= 0.45 && sp.ud.t < 99) {
      var u = Math.min(1, (sp.ud.t - 0.45) / 0.7), e = u * u * (3 - 2 * u);
      var a = skaerm(s, N + 1.25, D.UD_RAEKKE + 0.5), m = daemPlads(sp.ud.plads);
      var x = a.x + (m.x - a.x) * e, y = a.y + (m.y - a.y) * e - Math.sin(u * Math.PI) * c * 1.2;
      var str = c + (m.b / 2 - c) * e;
      tegnFriStamme(x, y, str, P.spejl ? -1 : 1, m.v * e);
    }
  }
  /** Bodils stamme uden for pladsen: midten i (x, y), str er et felts stoerrelse. */
  function tegnFriStamme(x, y, str, retning, drej) {
    ctx.save(); ctx.translate(x, y); if (drej) ctx.rotate(drej);
    ctx.scale(str * (retning || 1), str); ctx.translate(-1, -0.5);
    tegnStammeBillede(2, true, 'A');
    ctx.restore();
  }

  /** En lille sten i graabrune toner, malet med lys fra venstre og en skygge under. r er dens stoerrelse. */
  function tegnSten(g, x, y, r, farve, tilf) {
    var n = 7, pkt = [];
    for (var i = 0; i < n; i++) { var v = i / n * Math.PI * 2, rr2 = r * (0.8 + tilf() * 0.35); pkt.push([x + Math.cos(v) * rr2 * 1.25, y + Math.sin(v) * rr2 * 0.85]); }
    function form(dx, dy) {
      g.beginPath();
      for (var i = 0; i < n; i++) {
        var a = pkt[i], b = pkt[(i + 1) % n], mx = (a[0] + b[0]) / 2 + dx, my = (a[1] + b[1]) / 2 + dy;
        if (i === 0) g.moveTo(mx, my); else g.quadraticCurveTo(a[0] + dx, a[1] + dy, mx, my);
      }
      var a0 = pkt[0], b0 = pkt[1]; g.quadraticCurveTo(a0[0] + dx, a0[1] + dy, (a0[0] + b0[0]) / 2 + dx, (a0[1] + b0[1]) / 2 + dy);
      g.closePath();
    }
    form(r * 0.15, r * 0.3); g.fillStyle = 'rgba(70,52,40,.28)'; g.fill();
    var gr = g.createRadialGradient(x - r * 0.45, y - r * 0.4, r * 0.1, x, y, r * 1.35);
    gr.addColorStop(0, farve[0]); gr.addColorStop(0.55, farve[1]); gr.addColorStop(1, farve[2]);
    form(0, 0); g.fillStyle = gr; g.fill();
    g.lineWidth = r * 0.12; g.strokeStyle = 'rgba(94,74,58,.35)'; g.stroke();
  }
  var STEN = [['#c3b9a9', '#a2988a', '#7c7266'], ['#b8ab98', '#958877', '#6f6356'], ['#cbc1b2', '#aca293', '#867b6e'], ['#b4aa9f', '#8f857b', '#6b6259'], ['#c6b49b', '#a3917a', '#7d6d5a']];

  /** Mudder, kviste og Bodils stammer: daemningen vokser med én stamme for hver bane. */
  function tegnDaemning() {
    var V = layout().vand, c = L.c, m0 = daemPlads(0), lb = m0.lb, bund = m0.bund;
    var f = Math.min(1, landede.length / Math.max(1, daemMaal));
    var cx = V.x + V.b / 2, yb = m0.y, base = yb + 0.78 * c;
    var halv = Math.min(V.b * 0.48, (0.55 + 0.45 * f) * bund * lb * 0.5 + 0.15 * c);
    var top = yb - 0.08 * c - f * 0.14 * c;
    var vl = base - 0.12 * c;      // vandlinjen: her stikker bunken op af vandet
    function bunke() {
      ctx.beginPath();
      ctx.moveTo(cx - halv, vl);
      ctx.bezierCurveTo(cx - halv * 0.95, top + 0.2 * c, cx - halv * 0.5, top, cx - halv * 0.1, top + 0.02 * c);
      ctx.bezierCurveTo(cx + halv * 0.3, top + 0.04 * c, cx + halv * 0.9, top + 0.1 * c, cx + halv, vl);
      ctx.closePath();
    }
    // under vandet: bunken anes som en moerk skygge
    ctx.fillStyle = 'rgba(95,120,140,.2)';
    ctx.beginPath(); ctx.ellipse(cx, vl, halv * 1.02, 0.2 * c, 0, 0, Math.PI); ctx.fill();
    // mudderbunken under stammerne
    var gr = ctx.createLinearGradient(0, top, 0, vl);
    gr.addColorStop(0, '#9c7a52'); gr.addColorStop(0.6, '#86684a'); gr.addColorStop(1, '#6f5643');
    bunke(); ctx.fillStyle = gr; ctx.fill();
    // klumper af mudder paa toppen, saa bunken bliver knoldet
    for (var q = 0; q < 7; q++) {
      var qx = cx + (q / 6 - 0.5) * 1.55 * halv, qd = Math.abs(qx - cx) / halv, qr = (0.15 + ((q * 5) % 3) * 0.03) * c;
      var qy = top + 0.08 * c + qd * qd * 0.3 * c;
      ctx.fillStyle = q % 2 ? '#94744d' : '#8a6b48'; ctx.beginPath(); ctx.ellipse(qx, qy, qr * 1.25, qr, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(94,74,58,.35)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.ellipse(qx, qy, qr * 1.25, qr, 0, 0.3, 2.6); ctx.stroke();
      ctx.fillStyle = 'rgba(229,211,174,.28)'; ctx.beginPath(); ctx.ellipse(qx - qr * 0.3, qy - qr * 0.45, qr * 0.5, qr * 0.18, -0.2, 0, 7); ctx.fill();
    }
    ctx.save(); bunke(); ctx.clip();
    // vaade pletter, og forneden er bunken under vand
    ctx.fillStyle = 'rgba(217,186,138,.3)';
    ctx.beginPath(); ctx.ellipse(cx - halv * 0.4, top + 0.12 * c, halv * 0.3, 0.05 * c, -0.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + halv * 0.35, top + 0.2 * c, halv * 0.22, 0.04 * c, 0.1, 0, 7); ctx.fill();
    ctx.restore();
    // vandet slaar mod mudderet
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx - halv * 1.08, vl + 0.01 * c);
    for (var w = 1; w <= 8; w++) ctx.quadraticCurveTo(cx - halv * 1.08 + (w - 0.5) * halv * 0.27, vl + (w % 2 ? 0.05 : -0.03) * c, cx - halv * 1.08 + w * halv * 0.27, vl + 0.01 * c);
    ctx.stroke();
    // kviste, der stikker ud af bunken: et par fra begyndelsen og flere, jo flere stammer der er
    ctx.lineCap = 'round'; ctx.strokeStyle = '#8a663d';
    var kviste = 2 + landede.length;
    for (var k = 0; k < kviste; k++) {
      var side = k % 2 ? 1 : -1, t = ((k * 37) % 10) / 10;
      var kx = cx + side * halv * (0.55 + 0.35 * t), ky = top + 0.14 * c + t * 0.14 * c;
      var lg = (0.3 + 0.2 * ((k * 13) % 5) / 5) * c, v = -Math.PI / 2 + side * (1.0 + 0.45 * t);
      var ex = kx + Math.cos(v) * lg, ey = ky + Math.sin(v) * lg;
      ctx.lineWidth = Math.max(1.5, 0.038 * c);
      ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.lineWidth = Math.max(1, 0.025 * c);
      var mx = kx + (ex - kx) * 0.55, my = ky + (ey - ky) * 0.55, v2 = v - side * 0.6;
      ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + Math.cos(v2) * lg * 0.4, my + Math.sin(v2) * lg * 0.4); ctx.stroke();
    }
    var fro = 23; function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
    for (var s2 = 0; s2 < 5; s2++) tegnSten(ctx, cx + (tilf() - 0.5) * halv * 1.3, top + (0.16 + tilf() * 0.1) * c, (0.04 + tilf() * 0.025) * c, STEN[s2 % STEN.length], tilf);
    // stammerne, nederste raekke foerst, med lidt mudder i enderne
    landede.forEach(function (k) {
      var p = daemPlads(k);
      tegnFriStamme(p.x, p.y, p.b / 2, 1, p.v);
    });
  }

  function tegnVand() {
    var V = layout().vand, c = L.c;
    // krusninger, der flyder nedad (vandet selv ligger i det faste billede)
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (var k = 0; k < 9; k++) {
      var yy = V.y - 0.4 * c + ((k * 0.37 * c * 3 + tid * 18) % (V.h + 0.8 * c));
      var xx = V.x + V.b * (0.2 + ((k * 0.61) % 0.6));
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 0.18 * c, yy - 0.08 * c, xx + 0.36 * c, yy); ctx.stroke();
    }
    // daemningen: Bodils stammer, der allerede er kommet
    tegnDaemning();
    // Bodil sidder i vandet ved aabningen
    var bx = V.x + V.b / 2, by = V.y + (D.UD_RAEKKE + 0.9) * c - (hop > 0 ? Math.sin(hop / 0.6 * Math.PI) * 0.4 * c : Math.sin(tid * 2) * 0.03 * c);
    var bs = Math.min(V.b * 0.95, 2.5 * c);
    // krusningen om Bodil, der hvor hun sidder i vandet
    ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(bx, by + bs * 0.5, bs * (0.42 + Math.sin(tid * 2) * 0.02), bs * 0.08, 0, 0, 7); ctx.stroke();
    if (harBodil()) {
      var bh = bs * bodil.naturalHeight / bodil.naturalWidth;
      ctx.drawImage(bodil, bx - bs / 2, by - bh * 0.55, bs, bh);
    } else tegnBodilKode(bx, by, bs);
    glimt.forEach(function (g) { ctx.fillStyle = 'rgba(240,196,106,' + Math.max(0, g.liv).toFixed(2) + ')'; ctx.beginPath(); ctx.arc(g.x, g.y, 4, 0, 7); ctx.fill(); });
  }
  /** Bodil tegnet i kode, hvis billedet mangler. */
  function tegnBodilKode(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.scale(s / 100, s / 100);
    ctx.fillStyle = '#5e4a3a'; ctx.beginPath(); ctx.ellipse(-30, 34, 26, 14, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a663d'; ctx.beginPath(); ctx.ellipse(0, 18, 30, 34, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d9ba8a'; ctx.beginPath(); ctx.ellipse(0, 26, 18, 22, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a663d'; ctx.beginPath(); ctx.arc(0, -24, 24, 0, 7); ctx.fill();
    [-17, 17].forEach(function (ox) { ctx.beginPath(); ctx.arc(ox, -42, 7, 0, 7); ctx.fill(); });
    ctx.fillStyle = KANT; [-9, 9].forEach(function (ox) { ctx.beginPath(); ctx.arc(ox, -28, 3.4, 0, 7); ctx.fill(); });
    ctx.beginPath(); ctx.ellipse(0, -18, 6, 4, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#f8f1e6'; ctx.fillRect(-5, -13, 4.6, 8); ctx.fillRect(0.4, -13, 4.6, 8);
    ctx.fillStyle = '#93bc63'; ctx.beginPath(); ctx.ellipse(-24, -44, 10, 5, -0.6, 0, 7); ctx.fill();
    ctx.restore();
  }

  var jord = null;
  function lavJord() {
    var W = window.innerWidth, H = window.innerHeight;
    if (!jord || jord.b !== W || jord.h !== H) {
      jord = document.createElement('canvas'); jord.b = W; jord.h = H;
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      jord.width = Math.floor(W * dpr); jord.height = Math.floor(H * dpr);
      var c = jord.getContext('2d'); c.scale(dpr, dpr);
      var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a5c979'); g.addColorStop(1, '#8cb65c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      // graestotter
      var fro = 7; function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
      c.strokeStyle = 'rgba(95,130,64,.35)'; c.lineWidth = 2; c.lineCap = 'round';
      for (var k = 0; k < W * H / 5000; k++) {
        var x = tilf() * W, y = tilf() * H;
        c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 6, y - 8); c.moveTo(x, y); c.lineTo(x, y - 10); c.moveTo(x + 4, y); c.lineTo(x + 6, y - 8); c.stroke();
      }
    }
    return jord;
  }
  function tegnBaggrund() { ctx.drawImage(lavJord(), 0, 0, window.innerWidth, window.innerHeight); }

  /* ---------- det faste billede: graes, bred, vand, siv og pladsernes skovbund ---------- */
  var siv = new Image();
  siv.src = '../maskinen/billeder/siv.png';
  function harSiv() { return siv.complete && siv.naturalWidth > 0; }

  /** Papirkorn: smaa lyse og moerke prikker, der lægges ovenpaa vandet og jorden. */
  var korn = null;
  function papirKorn(g) {
    if (!korn) {
      korn = document.createElement('canvas'); korn.width = korn.height = 128;
      var c = korn.getContext('2d'), fro = 11;
      function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
      for (var i = 0; i < 1100; i++) {
        c.fillStyle = tilf() < 0.5 ? 'rgba(255,255,255,' + (0.12 + tilf() * 0.3).toFixed(2) + ')' : 'rgba(94,74,58,' + (0.05 + tilf() * 0.12).toFixed(2) + ')';
        c.fillRect(Math.floor(tilf() * 128), Math.floor(tilf() * 128), 1 + Math.floor(tilf() * 2), 1);
      }
    }
    return g.createPattern(korn, 'repeat');
  }

  /**
   * Vandets omrids: et afrundet rektangel, hvis kanter boelger blødt. Mod
   * pladserne er kanten lige og ligger under bredden, saa stammen glider
   * direkte fra aabningen ud i vandet.
   */
  function vandOmrids(ud) {
    var V = L.vand, c = L.c, x0 = V.x - 2, y0 = V.y - 0.6 * c, b = V.b + 4, h = V.h + 1.2 * c, r = 0.6 * c, pkt = [];
    var trin = Math.max(6, c * 0.12);
    function linje(ax, ay, bx, by, nx, ny) {
      var l = Math.hypot(bx - ax, by - ay), n = Math.max(1, Math.round(l / trin));
      for (var i = 0; i < n; i++) pkt.push({ x: ax + (bx - ax) * i / n, y: ay + (by - ay) * i / n, nx: nx, ny: ny });
    }
    function bue(cx, cy, v0) {
      var n = Math.max(3, Math.round(r * Math.PI / 2 / trin));
      for (var i = 0; i < n; i++) { var v = v0 + i / n * Math.PI / 2; pkt.push({ x: cx + Math.cos(v) * r, y: cy + Math.sin(v) * r, nx: Math.cos(v), ny: Math.sin(v) }); }
    }
    linje(x0 + r, y0, x0 + b - r, y0, 0, -1); bue(x0 + b - r, y0 + r, -Math.PI / 2);
    linje(x0 + b, y0 + r, x0 + b, y0 + h - r, 1, 0); bue(x0 + b - r, y0 + h - r, 0);
    linje(x0 + b - r, y0 + h, x0 + r, y0 + h, 0, 1); bue(x0 + r, y0 + h - r, Math.PI / 2);
    linje(x0, y0 + h - r, x0, y0 + r, -1, 0); bue(x0 + r, y0 + r, Math.PI);
    var s = 0, hoejrePlads = spillere === 2;
    return pkt.map(function (p, i) {
      if (i) s += Math.hypot(p.x - pkt[i - 1].x, p.y - pkt[i - 1].y);
      var u = s / c, boelge = Math.sin(u * 2.1 + 1.3) * 0.6 + Math.sin(u * 4.7 + 0.4) * 0.3 + Math.sin(u * 9.3) * 0.1;
      var a = 0.09 * c, ved = p.x < V.x + V.b / 2 || hoejrePlads;
      if (ved) { var dy = Math.max(V.y - p.y, p.y - (V.y + V.h), 0); a *= Math.max(0, Math.min(1, dy / (0.5 * c))); }
      var d = a * boelge + (ud || 0) * (ved ? Math.max(0, Math.min(1, Math.max(V.y - p.y, p.y - (V.y + V.h), 0) / (0.5 * c))) : 1);
      return { x: p.x + p.nx * d, y: p.y + p.ny * d };
    });
  }
  function omridsSti(g, pkt) {
    g.beginPath();
    var n = pkt.length, m0 = { x: (pkt[n - 1].x + pkt[0].x) / 2, y: (pkt[n - 1].y + pkt[0].y) / 2 };
    g.moveTo(m0.x, m0.y);
    for (var i = 0; i < n; i++) { var a = pkt[i], b = pkt[(i + 1) % n]; g.quadraticCurveTo(a.x, a.y, (a.x + b.x) / 2, (a.y + b.y) / 2); }
    g.closePath();
  }

  /** Vandet malet som akvarel: bred af vaadt sand, en vask, der er dybest ved kanten, og papirkorn. */
  function tegnVandBund(g) {
    var V = L.vand, c = L.c, fro = 31;
    function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
    var omrids = vandOmrids(0), bred = vandOmrids(0.16 * c);
    // bredden: sand, der er vaadt og moerkere ind mod vandet
    omridsSti(g, bred); g.fillStyle = '#d9ba8a'; g.fill();
    g.lineWidth = 0.06 * c; g.strokeStyle = 'rgba(177,138,86,.35)'; g.stroke();
    omridsSti(g, omrids); g.lineWidth = 0.14 * c; g.strokeStyle = 'rgba(138,102,61,.35)'; g.stroke();
    // vandet
    var gr = g.createLinearGradient(V.x, 0, V.x + V.b, 0);
    gr.addColorStop(0, '#7db7dc'); gr.addColorStop(0.3, '#9bcde9'); gr.addColorStop(0.5, '#a8d5ed'); gr.addColorStop(0.7, '#9bcde9'); gr.addColorStop(1, '#7db7dc');
    omridsSti(g, omrids); g.fillStyle = gr; g.fill();
    g.save(); omridsSti(g, omrids); g.clip();
    var dyb = g.createLinearGradient(0, V.y - 0.6 * c, 0, V.y + V.h + 0.6 * c);
    dyb.addColorStop(0, 'rgba(95,159,201,.18)'); dyb.addColorStop(0.4, 'rgba(95,159,201,0)'); dyb.addColorStop(1, 'rgba(95,159,201,.16)');
    g.fillStyle = dyb; g.fillRect(V.x - c, V.y - c, V.b + 2 * c, V.h + 2 * c);
    // akvarelpletter: farven samler sig nogle steder og er lysere andre steder
    for (var k = 0; k < 30; k++) {
      var px = V.x + tilf() * V.b, py = V.y - 0.5 * c + tilf() * (V.h + c), pr = (0.35 + tilf() * 0.9) * c;
      var pg = g.createRadialGradient(px, py, 0, px, py, pr), farve = k % 3 === 0 ? '255,255,255' : (k % 3 === 1 ? '95,159,201' : '174,211,228');
      pg.addColorStop(0, 'rgba(' + farve + ',' + (k % 3 === 1 ? 0.16 : 0.22) + ')'); pg.addColorStop(1, 'rgba(' + farve + ',0)');
      g.fillStyle = pg; g.fillRect(px - pr, py - pr, 2 * pr, 2 * pr);
    }
    // farven er dybest ved kanten, som naar en akvarel toerrer
    g.lineJoin = 'round';
    omridsSti(g, omrids);
    g.lineWidth = 0.55 * c; g.strokeStyle = 'rgba(95,159,201,.16)'; g.stroke();
    g.lineWidth = 0.2 * c; g.strokeStyle = 'rgba(95,159,201,.28)'; g.stroke();
    g.lineWidth = 4; g.strokeStyle = 'rgba(79,140,184,.5)'; g.stroke();
    g.fillStyle = papirKorn(g); g.globalAlpha = 0.6; g.fillRect(V.x - c, V.y - c, V.b + 2 * c, V.h + 2 * c); g.globalAlpha = 1;
    g.restore();
    // en lys stribe langs kanten, hvor vandet moeder sandet
    g.save(); g.translate(0, 2); omridsSti(g, omrids); g.restore();
    g.lineWidth = 1.5; g.strokeStyle = 'rgba(255,255,255,.45)'; g.stroke();
  }

  /** Sivene staar langs kanten, hvor der ikke er en plads, og aldrig hvor Bodil sidder eller daemningen vokser. */
  function tegnSiv(g) {
    if (!harSiv()) return;
    var V = L.vand, c = L.c, f = siv.naturalWidth / siv.naturalHeight;
    var steder = spillere === 1
      ? [[V.x + V.b - 0.05 * c, V.y + 1.25 * c, 1.3, 1], [V.x + V.b + 0.12 * c, V.y + V.h * 0.58, 1.6, -1], [V.x + V.b + 0.05 * c, V.y + V.h + 0.5 * c, 1.2, 1]]
      : [[V.x + 0.2 * c, V.y - 0.3 * c, 1.15, -1], [V.x + V.b - 0.25 * c, V.y - 0.15 * c, 1.45, 1]];
    steder.forEach(function (s) {
      var h = s[2] * c, b = h * f;
      g.save(); g.translate(s[0], s[1]); g.scale(s[3], 1);
      // en lille skygge og krusning, hvor sivene staar i vandet
      g.fillStyle = 'rgba(94,74,58,.16)'; g.beginPath(); g.ellipse(0, -0.02 * c, b * 0.42, 0.08 * c, 0, 0, 7); g.fill();
      g.drawImage(siv, -b / 2, -h, b, h);
      g.restore();
    });
  }

  /** Pladsens faste dele: bredden af skovbund med smaa sten, jorden, felterne og pilene. Tegnes i felter. */
  function tegnPladsBund(g, s) {
    var P = L.plader[s], c = L.c, R = RAMME, ud = D.UD_RAEKKE, fro = 17 + s * 101;
    function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
    g.save();
    g.translate(P.ox, P.oy);
    if (P.spejl) { g.translate(N * c, 0); g.scale(-1, 1); }
    g.scale(c, c);
    // skyggen under bredden
    g.fillStyle = 'rgba(94,74,58,.16)'; g.beginPath(); g.roundRect(-R + 0.02, -R + 0.08, N + 2 * R, N + 2 * R, 0.5); g.fill();
    // bredden: skovbund i jordfarver, med lidt mos
    var gr = g.createLinearGradient(0, -R, 0, N + R);
    gr.addColorStop(0, '#b8925e'); gr.addColorStop(1, '#a07b4b');
    g.beginPath(); g.roundRect(-R, -R, N + 2 * R, N + 2 * R, 0.5); g.fillStyle = gr; g.fill();
    g.save(); g.clip();
    var FARVER = ['rgba(138,102,61,.22)', 'rgba(217,186,138,.25)', 'rgba(107,85,69,.16)', 'rgba(95,130,64,.16)'];
    for (var k = 0; k < 60; k++) {
      var bx = -R + tilf() * (N + 2 * R), by = -R + tilf() * (N + 2 * R), br = 0.12 + tilf() * 0.3;
      g.fillStyle = FARVER[k % FARVER.length]; g.beginPath(); g.ellipse(bx, by, br * 1.4, br, tilf() * 3, 0, 7); g.fill();
    }
    g.fillStyle = papirKorn(g); g.save(); g.scale(1 / c, 1 / c); g.fillRect(-R * c, -R * c, (N + 2 * R) * c, (N + 2 * R) * c); g.restore();
    g.restore();
    g.lineWidth = 0.025; g.strokeStyle = 'rgba(94,74,58,.25)'; g.beginPath(); g.roundRect(-R, -R, N + 2 * R, N + 2 * R, 0.5); g.stroke();
    // smaa sten og blade rundt paa bredden, men ikke i aabningen
    function fri(x, y) { return !(x > N - 0.2 && y > ud - 0.25 && y < ud + 1.25); }
    var omkreds = 4 * (N + R), antal = 40;
    for (k = 0; k < antal; k++) {
      var t = (k + tilf() * 0.6) / antal * omkreds, side = Math.floor(t / (N + R)), q = t % (N + R) - R / 2, tv = -R / 2 + (tilf() - 0.5) * 0.12;
      var sx = side === 0 ? q : side === 1 ? N - tv : side === 2 ? N - q : tv, sy = side === 0 ? tv : side === 1 ? q : side === 2 ? N - tv : N - q;
      if (!fri(sx, sy)) continue;
      if (k % 7 === 3) {
        // et blad, der er faldet
        g.save(); g.translate(sx, sy); g.rotate(tilf() * 6.3);
        g.fillStyle = ['#93bc63', '#e08a52', '#f0c46a'][k % 3]; g.globalAlpha = 0.85;
        g.beginPath(); g.ellipse(0, 0, 0.11, 0.055, 0, 0, 7); g.fill();
        g.globalAlpha = 1; g.strokeStyle = 'rgba(94,74,58,.4)'; g.lineWidth = 0.015; g.beginPath(); g.moveTo(-0.11, 0); g.lineTo(0.11, 0); g.stroke();
        g.restore();
      } else tegnSten(g, sx, sy, 0.055 + tilf() * 0.045, STEN[Math.floor(tilf() * STEN.length)], tilf);
    }
    // jorden: en sandet vask med papirkorn; aabningen fortsaetter ud gennem bredden
    function jordSti() { g.beginPath(); g.roundRect(0, 0, N, N, 0.22); g.rect(N - 0.3, ud, 0.3 + R + 0.02, 1); }
    jordSti(); g.fillStyle = '#e5d3ae'; g.fill();
    g.save(); jordSti(); g.clip();
    for (k = 0; k < 34; k++) {
      var jx = tilf() * N, jy = tilf() * N, jr = 0.4 + tilf() * 1.1;
      var jg = g.createRadialGradient(jx, jy, 0, jx, jy, jr), jf = k % 3 === 0 ? '239,227,208' : (k % 3 === 1 ? '217,186,138' : '177,138,86');
      jg.addColorStop(0, 'rgba(' + jf + ',' + (k % 3 === 2 ? 0.1 : 0.3) + ')'); jg.addColorStop(1, 'rgba(' + jf + ',0)');
      g.fillStyle = jg; g.fillRect(jx - jr, jy - jr, 2 * jr, 2 * jr);
    }
    // jorden ligger lidt lavere end bredden: en blød skygge langs den oeverste og venstre kant
    var sk = g.createLinearGradient(0, 0, 0, 0.18); sk.addColorStop(0, 'rgba(94,74,58,.16)'); sk.addColorStop(1, 'rgba(94,74,58,0)');
    g.fillStyle = sk; g.fillRect(0, 0, N, 0.18);
    sk = g.createLinearGradient(0, 0, 0.14, 0); sk.addColorStop(0, 'rgba(94,74,58,.12)'); sk.addColorStop(1, 'rgba(94,74,58,0)');
    g.fillStyle = sk; g.fillRect(0, 0, 0.14, N);
    g.fillStyle = papirKorn(g); g.save(); g.scale(1 / c, 1 / c); g.globalAlpha = 0.8; g.fillRect(0, 0, (N + R + 0.1) * c, N * c); g.restore();
    g.restore();
    // felterne: kun en svag fordybning i jorden
    for (var gy = 0; gy < N; gy++) for (var gx = 0; gx < N; gx++) {
      g.beginPath(); g.roundRect(gx + 0.06, gy + 0.06, 0.88, 0.88, 0.16);
      g.fillStyle = 'rgba(177,138,86,.09)'; g.fill();
      g.lineWidth = 0.016; g.strokeStyle = 'rgba(138,102,61,.1)'; g.stroke();
    }
    // smaa pile paa jorden i Bodils raekke: den vej skal stammen
    g.strokeStyle = 'rgba(138,102,61,.28)'; g.lineWidth = 0.06; g.lineCap = 'round'; g.lineJoin = 'round';
    [N - 0.55, N + 0.05].forEach(function (ax) { g.beginPath(); g.moveTo(ax, ud + 0.32); g.lineTo(ax + 0.16, ud + 0.5); g.lineTo(ax, ud + 0.68); g.stroke(); });
    g.restore();
  }

  /** Alt det, der staar stille under spillet, males én gang i et lærred og tegnes derfra i hvert billede. */
  var scene = null;
  function tegnScene() {
    var W = window.innerWidth, H = window.innerHeight, l = layout();
    if (!scene || scene.b !== W || scene.h !== H || scene.L !== l || scene.siv !== harSiv()) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      scene = document.createElement('canvas'); scene.b = W; scene.h = H; scene.L = l; scene.siv = harSiv();
      scene.width = Math.floor(W * dpr); scene.height = Math.floor(H * dpr);
      var g = scene.getContext('2d'); g.scale(dpr, dpr);
      g.drawImage(lavJord(), 0, 0, W, H);
      tegnVandBund(g);
      for (var s = 0; s < spillere; s++) tegnPladsBund(g, s);
      tegnSiv(g);
    }
    ctx.drawImage(scene, 0, 0, W, H);
  }
  function tegnSpil() {
    tegnVand();
    for (var s = 0; s < spillere; s++) tegnPlads(s);
  }

  /* ---------- menu og slut ---------- */
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }
  var BODIL_IMG = '<img class="bodil" src="billeder/bodil.png" alt="" onerror="this.remove()">';
  function visMenu() {
    tilstand = 'menu'; greb = {};
    stemme.tie();
    visOverlay('<div class="kort">' + BODIL_IMG + '<h2>Bæverdammen</h2>' +
      Menu.stjerneRaekke(svaerhed) + Menu.startRaekke('start') + Menu.lydRaekke(lydTil) + '</div>');
  }
  function afslut() {
    if (tilstand !== 'spil') return;
    tilstand = 'faerdig';
    visOverlay('<div class="kort">' + BODIL_IMG + '<h2>Bæverdammen</h2>' + Menu.slutRaekke('igen', null) + '</div>');
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    startLyd();
    if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stemme.tie(); visMenu(); }
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loop og input ---------- */
  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    if (tilstand === 'spil' || tilstand === 'faerdig') { tegnScene(); if (tilstand === 'spil') opdater(dt); tegnSpil(); }
    else tegnBaggrund();
    requestAnimationFrame(løkke);
  }
  lærred.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    try { lærred.setPointerCapture(e.pointerId); } catch (fejl) { /* gamle browsere */ }
    tryk(e);
  }, { passive: false });
  lærred.addEventListener('pointermove', function (e) { e.preventDefault(); traekFinger(e); }, { passive: false });
  lærred.addEventListener('pointerup', slip);
  lærred.addEventListener('pointercancel', slip);
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  /** Til testen i browseren: stammerne paa skaermen, saa en robot kan traekke dem. */
  window.__debug = function () {
    return {
      tilstand: tilstand, spillere: spillere, svaerhed: svaerhed, daem: daem, daemMaal: daemMaal, bodil: harBodil(),
      spil: spil.map(function (sp, s) {
        return {
          nr: sp.nr, faerdig: sp.faerdig, bane: sp.plade ? D.tekst(sp.plade) : null, klar: !sp.ud && sp.ind >= 1, hint: sp.hint,
          stammer: sp.plade ? sp.plade.stammer.map(function (st, i) {
            var pos = D.plads(st), x = st.lodret ? st.x + 0.5 : pos + st.len / 2, y = st.lodret ? pos + st.len / 2 : st.y + 0.5;
            var p = skaerm(s, x, y);
            return { x: Math.round(p.x), y: Math.round(p.y), gx: st.x, gy: st.y, lodret: st.lodret, len: st.len, maal: st.maal, pos: pos };
          }) : null
        };
      }),
      felt: L ? L.c : null, spejl: L ? L.plader.map(function (p) { return p.spejl; }) : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
