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

  /** Hvor stamme nr. k ligger i daemningen: en bunke, nederst flest. */
  function daemPlads(k) {
    var V = layout().vand, c = L.c, bund = 1;
    while (bund * (bund + 1) / 2 < daemMaal) bund++;
    var raekke = 0, i = k, n = bund;
    while (i >= n && n > 1) { i -= n; raekke++; n--; }
    var lb = Math.min(1.15 * c, V.b / (bund + 0.3));
    return { x: V.x + V.b / 2 + (i - (n - 1) / 2) * lb, y: V.y + V.h - 0.5 * c - raekke * lb * 0.36, b: lb * 0.98 };
  }

  /** En stamme paa tvaers, len felter lang, med oeverste venstre hjoerne i (0,0) og hoejde 1. */
  function tegnStammeForm(len, birk, navn, loeft) {
    var h = 0.74, y0 = (1 - h) / 2, x0 = 0.07, b = len - 0.14;
    var gr = ctx.createLinearGradient(0, y0, 0, y0 + h);
    if (birk) { gr.addColorStop(0, '#fbf6ee'); gr.addColorStop(0.5, '#f1e7d6'); gr.addColorStop(1, '#e5d3ae'); }
    else { gr.addColorStop(0, '#b18a56'); gr.addColorStop(0.45, '#9c7648'); gr.addColorStop(1, '#6b5545'); }
    rr(x0, y0, b, h, 0.33, gr);
    ctx.lineWidth = 0.035; ctx.strokeStyle = birk ? 'rgba(94,74,58,.45)' : 'rgba(94,74,58,.55)'; ctx.stroke();
    // Barken: striber paa langs, eller birkens moerke pletter
    var fro = 0; for (var q = 0; q < navn.length; q++) fro += navn.charCodeAt(q) * (q + 3);
    function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
    ctx.lineCap = 'round';
    if (birk) {
      ctx.strokeStyle = KANT; ctx.lineWidth = 0.05;
      for (var m = 0; m < len * 3; m++) {
        var mx = x0 + 0.35 + tilf() * (b - 0.8), my = y0 + 0.14 + tilf() * (h - 0.28);
        ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx + 0.1 + tilf() * 0.16, my); ctx.stroke();
      }
    } else {
      ctx.strokeStyle = 'rgba(94,74,58,.4)'; ctx.lineWidth = 0.035;
      for (var l = 0; l < len * 2 + 1; l++) {
        var ly = y0 + 0.15 + tilf() * (h - 0.3), lx = x0 + 0.3 + tilf() * (b - 1.35);
        ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 0.4 + tilf() * 0.5, ly + (tilf() - 0.5) * 0.04); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,.14)'; rr(x0 + 0.2, y0 + 0.1, b - 0.5, 0.12, 0.06); ctx.fill();
    }
    // Den savede ende med aarringe
    var ex = x0 + b - 0.16;
    ctx.fillStyle = birk ? '#f3e2c4' : '#e5d3ae'; ctx.beginPath(); ctx.ellipse(ex, 0.5, 0.12, h / 2 - 0.04, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b18a56'; ctx.lineWidth = 0.03; ctx.stroke();
    ctx.beginPath(); ctx.ellipse(ex, 0.5, 0.06, 0.17, 0, 0, 7); ctx.stroke();
    // Bodils stamme har en lille gren med et blad, saa den kan kendes
    if (birk) {
      ctx.strokeStyle = '#8a663d'; ctx.lineWidth = 0.05;
      ctx.beginPath(); ctx.moveTo(x0 + 0.55, y0 + 0.12); ctx.lineTo(x0 + 0.75, y0 - 0.08); ctx.stroke();
      ctx.save(); ctx.translate(x0 + 0.8, y0 - 0.1); ctx.rotate(-0.6);
      ctx.fillStyle = '#93bc63'; ctx.beginPath(); ctx.ellipse(0.12, 0, 0.16, 0.08, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#5f8240'; ctx.lineWidth = 0.025; ctx.beginPath(); ctx.moveTo(-0.02, 0); ctx.lineTo(0.26, 0); ctx.stroke();
      ctx.restore();
    }
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
    tegnStammeForm(st.len, st.maal, st.navn || 'x', holdt);
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

  function tegnPlads(s) {
    var sp = spil[s], P = layout().plader[s], c = L.c;
    ctx.save();
    ctx.translate(P.ox, P.oy);
    if (P.spejl) { ctx.translate(N * c, 0); ctx.scale(-1, 1); }
    ctx.scale(c, c);
    // bredden: fugtigt sand med smaa sten, og aabningen ud til vandet
    rr(-RAMME, -RAMME, N + 2 * RAMME, N + 2 * RAMME, 0.5, '#b18a56');
    ctx.fillStyle = 'rgba(94,74,58,.12)'; rr(-RAMME, -RAMME + 0.06, N + 2 * RAMME, N + 2 * RAMME, 0.5); ctx.fill();
    rr(-RAMME, -RAMME, N + 2 * RAMME, N + 2 * RAMME - 0.06, 0.5, '#b18a56');
    for (var k = 0; k < 26; k++) {
      var t = k / 26, sx, sy;
      if (t < 0.25) { sx = -0.17; sy = t * 4 * N; } else if (t < 0.5) { sx = (t - 0.25) * 4 * N; sy = -0.17; }
      else if (t < 0.75) { sx = (t - 0.5) * 4 * N; sy = N + 0.17; } else { sx = N + 0.17; sy = (t - 0.75) * 4 * N; }
      if (sx > N && sy > D.UD_RAEKKE - 0.2 && sy < D.UD_RAEKKE + 1.2) continue;
      ctx.fillStyle = k % 3 ? '#d9ba8a' : '#e5d3ae'; ctx.beginPath(); ctx.ellipse(sx, sy, 0.09 + (k % 4) * 0.015, 0.065, k, 0, 7); ctx.fill();
    }
    rr(0, 0, N, N, 0.22, '#e5d3ae');
    // aabningen: jorden fortsaetter ud gennem bredden
    ctx.fillStyle = '#e5d3ae'; ctx.fillRect(N - 0.3, D.UD_RAEKKE, 0.3 + RAMME + 0.02, 1);
    // felterne
    for (var gy = 0; gy < N; gy++) for (var gx = 0; gx < N; gx++) rr(gx + 0.06, gy + 0.06, 0.88, 0.88, 0.14, 'rgba(177,138,86,.14)');
    // smaa pile paa jorden i Bodils raekke: den vej skal stammen
    ctx.strokeStyle = 'rgba(138,102,61,.28)'; ctx.lineWidth = 0.06; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    [N - 0.55, N + 0.05].forEach(function (ax) { ctx.beginPath(); ctx.moveTo(ax, D.UD_RAEKKE + 0.32); ctx.lineTo(ax + 0.16, D.UD_RAEKKE + 0.5); ctx.lineTo(ax, D.UD_RAEKKE + 0.68); ctx.stroke(); });
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
      tegnFriStamme(x, y, str, P.spejl ? -1 : 1);
    }
  }
  /** Bodils stamme uden for pladsen: midten i (x, y), str er et felts stoerrelse. */
  function tegnFriStamme(x, y, str, retning) {
    ctx.save(); ctx.translate(x, y); ctx.scale(str * (retning || 1), str); ctx.translate(-1, -0.5);
    tegnStammeForm(2, true, 'A', false);
    ctx.restore();
  }

  function tegnVand() {
    var V = layout().vand, c = L.c;
    var gr = ctx.createLinearGradient(V.x, 0, V.x + V.b, 0);
    gr.addColorStop(0, '#8fc7e8'); gr.addColorStop(0.5, '#a4d2ec'); gr.addColorStop(1, '#8fc7e8');
    rr(V.x - 2, V.y - 0.6 * c, V.b + 4, V.h + 1.2 * c, 0.6 * c, gr);
    ctx.strokeStyle = 'rgba(95,159,201,.55)'; ctx.lineWidth = 4; ctx.stroke();
    // krusninger, der flyder nedad
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 2.5; ctx.lineCap = 'round';
    for (var k = 0; k < 9; k++) {
      var yy = V.y - 0.4 * c + ((k * 0.37 * c * 3 + tid * 18) % (V.h + 0.8 * c));
      var xx = V.x + V.b * (0.2 + ((k * 0.61) % 0.6));
      ctx.beginPath(); ctx.moveTo(xx, yy); ctx.quadraticCurveTo(xx + 0.18 * c, yy - 0.08 * c, xx + 0.36 * c, yy); ctx.stroke();
    }
    // daemningen: Bodils stammer, der allerede er kommet
    landede.forEach(function (k) { var p = daemPlads(k); tegnFriStamme(p.x, p.y, p.b / 2, 1); });
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
  function tegnBaggrund() {
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
    ctx.drawImage(jord, 0, 0, W, H);
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
    tegnBaggrund();
    if (tilstand === 'spil' || tilstand === 'faerdig') { if (tilstand === 'spil') opdater(dt); tegnSpil(); }
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
