/**
 * Rimhulen — skaerm og lyd. Reglerne ligger i rim.js.
 *
 * To lege i en hule, hvor ekkoet svarer:
 *  - Rim: stemmen siger "Her har du ordet kat. Hvad rimer paa det?", og barnet
 *    finder det kort, der rimer. Fluebenet
 *    under kortet er svaret, som i Bogstavvejens minispil. Et tryk paa kortet
 *    siger kortets ord, saa man kan hoere, om det rimer.
 *  - Klap: stemmen siger "Her har du ordet elefant. Klap det!", og barnet
 *    klapper stavelserne paa trommen.
 *    En prik pr. stavelse fyldes. Klapper man for meget, vipper prikkerne og
 *    man begynder forfra — ingen straf.
 * To spillere: hver sin raekke kort, eller hver sin tromme (roed og blaa).
 *
 * Billeder og ordklip er Bogstavvejens (../bogstaver/), de faa ekstra ord
 * ligger her i ting/, billeder/ og lyd/. Alt er i service workerens cache.
 */
(function () {
  'use strict';

  // roundRect mangler i Safari foer 16, som skole-iPads kan koere
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

  var R = window.Rim;
  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var FARVER = ['#d95f45', '#5f9fc9'];        // spiller 1 roed, spiller 2 blaa, som figurerne i menuen

  var tilstand = 'menu';        // menu | rim | klap | faerdig
  var hvad = 'rim';             // rim | klap
  var svaerhed = 0;
  var spillere = 1;
  var lydTil = true;
  var tid = 0, sidsteTid = 0;
  var stationer = [];           // én pr. spiller
  var klapOpgaver = [], klapI = 0, klapSkift = 0;   // klap: ordet er faelles for begge trommer
  var ekko = 0;                 // ringe fra skyen, mens stemmen taler
  var ekkoFra = null;           // {x, y} hvor ringene kommer fra

  /* ---------- billeder ---------- */

  var billeder = {};
  R.ALLE.forEach(function (o) {
    if (!o.fil || billeder[o.fil]) return;
    var img = new Image();
    img.src = o.fil;
    billeder[o.fil] = img;
  });
  var pelle = new Image(); pelle.src = '../../assets/malet/pindsvin.png';

  /* ---------- lyd og stemme (som i Bogstavvejen) ---------- */

  var lyd = null;
  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();      // iOS bruger ogsaa 'interrupted'
    return lyd;
  }
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });

  function tone(frekvens, længde, styrke, type) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator(), g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination);
      o.start(); o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum); });
  }
  /** Trommen: et dybt, blødt slag. */
  function tromme() {
    tone(150, 0.28, 0.4, 'sine');
    tone(95, 0.16, 0.25, 'triangle');
  }

  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    var alle = window.speechSynthesis.getVoices();
    stemme = alle.filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;   // kun paa enheden
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }

  // Klippene ligger to steder: Bogstavvejens ord og hulens egne. Begge lister laeses.
  var klipFindes = {};
  ['lyd/', '../bogstaver/lyd/'].forEach(function (mappe) {
    fetch(mappe + 'klip.json').then(function (r) { return r.ok ? r.json() : []; })
      .then(function (liste) { liste.forEach(function (f) { klipFindes[mappe + f] = true; }); })
      .catch(function () { /* ingen klip, enhedens stemme bruges */ });
  });
  var buffere = {}, aktivtKlip = null, afspillet = 0;
  function hentKlip(sti) {
    if (!buffere[sti]) {
      buffere[sti] = fetch(sti)
        .then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    return buffere[sti];
  }
  function stopKlip() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  /** Flere klip lige efter hinanden: "Hvad rimer paa", "kat". Mangler ét, siger enhedens stemme det hele. */
  function afspil(stier, reserveTekst, fra) {
    if (!lydTil) return;
    ekko = 1.4; ekkoFra = fra || null;
    if (stier.some(function (s) { return !klipFindes[s]; })) { sig(reserveTekst); return; }
    Promise.all(stier.map(hentKlip)).then(function (bufs) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      stopKlip();
      bufs.forEach(function (buf) {
        var kilde = k.createBufferSource();
        kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start);
        start += buf.duration - 0.04;
        aktivtKlip = kilde;
      });
      afspillet++;
    }).catch(function () { sig(reserveTekst); });
  }
  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(tekst);
      u.voice = stemme; u.lang = stemme.lang; u.rate = 0.85;
      window.speechSynthesis.speak(u);
    } catch (e) { /* stemme er pynt */ }
  }
  function ordKlip(ord) { return R.ORD[ord].klip; }

  /* ---------- laerred og hulen ---------- */

  var bag = null;    // hulen tegnet én gang pr. stoerrelse: farveovergange over hele skaermen er dyre pr. frame

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bag = null;
  }

  function tegnHule(c, B, H) {
    c.fillStyle = '#b18a56'; c.fillRect(0, 0, B, H);
    var g = c.createRadialGradient(B / 2, -H * 0.1, H * 0.1, B / 2, H * 0.3, H * 0.95);
    g.addColorStop(0, '#f3e4c4'); g.addColorStop(0.55, '#d9ba8a'); g.addColorStop(1, '#a37d4c');
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    // Klippekanten hele vejen rundt, bloede buler
    c.fillStyle = '#8a663d';
    c.beginPath(); c.moveTo(0, 0);
    for (var x = 0; x <= B; x += B / 9) c.quadraticCurveTo(x + B / 18, 44 + Math.sin(x * 0.01) * 10, x + B / 9, 22 + Math.cos(x * 0.02) * 6);
    c.lineTo(B, 0); c.closePath(); c.fill();
    c.beginPath(); c.moveTo(0, H);
    for (var x2 = 0; x2 <= B; x2 += B / 7) c.quadraticCurveTo(x2 + B / 14, H - 46 - Math.sin(x2 * 0.013) * 8, x2 + B / 7, H - 26 + Math.cos(x2 * 0.02) * 5);
    c.lineTo(B, H); c.closePath(); c.fill();
    [[0, 1], [B, -1]].forEach(function (s) {
      c.beginPath(); c.moveTo(s[0], 0);
      for (var y = 0; y <= H; y += H / 6) c.quadraticCurveTo(s[0] + s[1] * 44, y + H / 12, s[0] + s[1] * (26 + Math.sin(y * 0.02) * 6), y + H / 6);
      c.lineTo(s[0], H); c.closePath(); c.fill();
    });
    // Drypsten oeverst
    [0.12, 0.3, 0.72, 0.9].forEach(function (a, i) {
      var x = B * a, h = 40 + i * 10;
      c.beginPath(); c.moveTo(x - 20, 24); c.quadraticCurveTo(x, 30, x + 4, 24 + h); c.quadraticCurveTo(x + 6, 30, x + 22, 24); c.closePath(); c.fill();
    });
    // Lygter i palettens farver, med et bloedt lys om sig
    [[B * 0.08, H * 0.45, '#f0c46a'], [B * 0.92, H * 0.4, '#9b7bd4'], [B * 0.9, H * 0.8, '#8fc7e8']].forEach(function (l) {
      var lg = c.createRadialGradient(l[0], l[1], 4, l[0], l[1], 90);
      lg.addColorStop(0, l[2] + 'aa'); lg.addColorStop(1, l[2] + '00');
      c.fillStyle = lg; c.fillRect(l[0] - 90, l[1] - 90, 180, 180);
      c.strokeStyle = KANT; c.lineWidth = 3; c.beginPath(); c.moveTo(l[0], l[1] - 34); c.lineTo(l[0], l[1] - 20); c.stroke();
      c.fillStyle = l[2]; c.beginPath(); c.roundRect(l[0] - 13, l[1] - 20, 26, 30, 8); c.fill(); c.stroke();
    });
    // Smaa svampe paa gulvet
    [[B * 0.2, H - 46, '#d95f45'], [B * 0.24, H - 40, '#e08a52'], [B * 0.66, H - 44, '#d95f45']].forEach(function (s) {
      c.fillStyle = PAPIR; c.beginPath(); c.roundRect(s[0] - 5, s[1], 10, 16, 4); c.fill();
      c.fillStyle = s[2]; c.beginPath(); c.arc(s[0], s[1], 14, Math.PI, 0); c.fill(); c.strokeStyle = KANT; c.lineWidth = 2.5; c.stroke();
      c.fillStyle = PAPIR; c.beginPath(); c.arc(s[0] - 5, s[1] - 6, 2.5, 0, 7); c.arc(s[0] + 4, s[1] - 4, 2, 0, 7); c.fill();
    });
  }

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    if (!bag || bag.b !== B || bag.h !== H) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      bag = document.createElement('canvas');
      bag.width = Math.floor(B * dpr); bag.height = Math.floor(H * dpr); bag.b = B; bag.h = H;
      var c = bag.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      tegnHule(c, B, H);
    }
    ctx.drawImage(bag, 0, 0, B, H);
    // Pelle sidder i hjoernet og lytter
    if (pelle.complete && pelle.naturalWidth) {
      var s = Math.min(120, H * 0.18);
      ctx.drawImage(pelle, B - s * 0.8 - 30, H - s * 0.75 - 26, s, s * (pelle.naturalHeight / pelle.naturalWidth));
    }
  }

  /* ---------- faelles tegning ---------- */

  function rr(x, y, b, h, r, fyld, kant, lw) {
    ctx.fillStyle = fyld; ctx.beginPath(); ctx.roundRect(x, y, b, h, r); ctx.fill();
    if (kant) { ctx.strokeStyle = kant; ctx.lineWidth = lw || 4; ctx.stroke(); }
  }

  /** En ting (billedet, ellers tegningen i kode) centreret om (cx, cy). Billederne er kvadratiske. */
  function tegnTing(o, cx, cy, str) {
    var img = o.fil && billeder[o.fil];
    ctx.save();
    ctx.translate(cx, cy);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -str / 2, -str / 2, str, str);
    } else if (o.tegn) {
      ctx.scale(str / 80, str / 80);
      ctx.strokeStyle = KANT; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      o.tegn(ctx);
    } else {
      ctx.fillStyle = '#e7ddc8'; ctx.beginPath(); ctx.arc(0, 0, str * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function tegnFlueben(x, y, r) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = '#7ab648'; ctx.strokeStyle = KANT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = PAPIR; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.45, 0.02 * r); ctx.lineTo(-r * 0.12, r * 0.34); ctx.lineTo(r * 0.48, -r * 0.32); ctx.stroke();
    ctx.restore();
  }

  function tegnHoejttaler(x, y, s) {
    ctx.save(); ctx.translate(x, y);
    ctx.fillStyle = KANT;
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.35); ctx.lineTo(-s * 0.4, -s * 0.35); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.4, s * 0.35); ctx.lineTo(-s, s * 0.35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.7, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  }

  /** Skyen med det ord, stemmen siger. Et tryk gentager det. */
  function tegnSky(sky, ord) {
    rr(sky.x, sky.y, sky.b, sky.h, 24, PAPIR, KANT);
    tegnTing(R.ORD[ord], sky.x + sky.b / 2 - sky.h * 0.08, sky.y + sky.h / 2, sky.h * 0.78);
    tegnHoejttaler(sky.x + sky.b - 22, sky.y + sky.h - 20, 9);
  }

  /** Ekkoet: ringe der breder sig fra skyen, mens stemmen taler. */
  function tegnEkko(sky) {
    if (ekko <= 0) return;
    var x = ekkoFra ? ekkoFra.x : sky.x + sky.b / 2, y = ekkoFra ? ekkoFra.y : sky.y + sky.h;
    var t = 1.4 - ekko;
    for (var i = 0; i < 3; i++) {
      var r = 20 + ((t * 90 + i * 34) % 110);
      ctx.strokeStyle = 'rgba(248,241,230,' + (0.55 * (1 - r / 130)).toFixed(2) + ')';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    }
  }

  /** Omgangstaelleren: cirkler, ikke tal. */
  function tegnTaeller(x, y, n, af) {
    for (var i = 0; i < af; i++) {
      ctx.beginPath(); ctx.arc(x - (af - 1) * 12 + i * 24, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = i < n ? GUL : 'rgba(248,241,230,.6)'; ctx.fill();
      ctx.strokeStyle = KANT; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }

  /* ---------- RIM ---------- */

  function startRim() {
    tilstand = 'rim';
    stationer = [];
    for (var s = 0; s < spillere; s++) {
      stationer.push({ nr: s, opgaver: R.nyRimOmgang(svaerhed), i: 0, loest: 0, pause: 0.8, vip: {}, ventTil: 0 });
    }
    setTimeout(function () { stationer.forEach(function (st) { if (tilstand === 'rim') sigRimSpoergsmaal(st); }); }, 500);
  }

  function sigRimSpoergsmaal(st) {
    var o = st.opgaver[st.i], l = rimLayout(st);
    // "Her har du ordet kat. Hvad rimer paa det?" — ordklippet foerst, saa rammen passer
    afspil([ordKlip(o.ord), R.KLIP.hvad_rimer_det[0]], R.ORDET + o.ord + '. ' + R.KLIP.hvad_rimer_det[1], { x: l.sky.x + l.sky.b / 2, y: l.sky.y + l.sky.h });
  }

  /** Hvor skyen, kortene og fluebenene staar for en station. Én spiller: sky oeverst, kort under. To: hver sin baane. */
  function rimLayout(st) {
    var B = window.innerWidth, H = window.innerHeight, n = stationer.length, antal = R.KORT[svaerhed];
    var o = st.opgaver[Math.min(st.i, st.opgaver.length - 1)];
    var sky, ks, gab, y, r, x0, baand = null;
    if (n === 1) {
      var ms = Math.min(B, H) * 0.16;
      sky = { x: B / 2 - ms * 0.85, y: 40, b: ms * 1.7, h: ms * 1.25 };
      gab = Math.min(30, B * 0.03);
      ks = Math.min((B * 0.86 - gab * (antal - 1)) / antal, H * 0.34, 240);
      r = Math.max(26, Math.min(40, ks * 0.17));
      y = sky.y + sky.h + 30 + ks / 2 + Math.max(0, (H - (sky.y + sky.h + 30) - ks - r * 2 - 30) / 2);
      x0 = B / 2 - (antal - 1) * (ks + gab) / 2;
    } else {
      var bh = H / 2, y0 = st.nr * bh;
      baand = { x: 10, y: y0 + 8, b: B - 20, h: bh - 14 };
      var ms2 = Math.min(bh * 0.34, B * 0.12);
      sky = { x: 74, y: y0 + bh / 2 - ms2 * 0.62 - 12, b: ms2 * 1.7, h: ms2 * 1.25 };
      var startX = sky.x + sky.b + 26, w = B - startX - 26;
      gab = 14;
      ks = Math.min((w - gab * (antal - 1)) / antal, bh * 0.56, 200);
      r = Math.max(22, Math.min(34, ks * 0.17));
      y = y0 + bh / 2 - r * 0.7;
      x0 = startX + (w - (antal * ks + (antal - 1) * gab)) / 2 + ks / 2;
    }
    return {
      sky: sky, r: r, baand: baand,
      kort: o.kort.map(function (k, i) { return { ord: k.ord, rigtig: k.rigtig, x: x0 + i * (ks + gab), y: y, str: ks }; })
    };
  }
  function knapY(k, r) { return k.y + k.str / 2 + 14 + r; }

  function rimTryk(x, y) {
    for (var s = 0; s < stationer.length; s++) {
      var st = stationer[s];
      if (st.loest || st.pause > 0 || st.i >= st.opgaver.length) continue;
      var l = rimLayout(st);
      if (x > l.sky.x - 10 && x < l.sky.x + l.sky.b + 10 && y > l.sky.y - 10 && y < l.sky.y + l.sky.h + 10) { sigRimSpoergsmaal(st); return; }
      for (var i = 0; i < l.kort.length; i++) {
        var k = l.kort[i];
        if (Math.hypot(x - k.x, y - knapY(k, l.r)) < l.r * 1.3) { rimSvar(st, k, l); return; }
        if (Math.abs(x - k.x) < k.str / 2 && Math.abs(y - k.y) < k.str / 2) {
          // Hoer kortets ord, saa man kan hoere om det rimer
          tone(520, 0.06, 0.06);
          afspil([ordKlip(k.ord)], R.ORDET + k.ord, { x: k.x, y: k.y - k.str / 2 });
          return;
        }
      }
    }
  }

  function rimSvar(st, k, l) {
    var o = st.opgaver[st.i];
    if (R.svar(o, k.ord) === 'rigtig') {
      st.loest = { ord: k.ord, t: 0 };
      melodi([660, 880, 1100, 1320], 90);
      afspil([R.KLIP.det_rimer[0]], R.KLIP.det_rimer[1], { x: k.x, y: k.y - k.str / 2 });
      setTimeout(function () { naesteRim(st); }, 2400);
    } else {
      st.vip[k.ord] = 0.7;
      melodi([330, 262], 110);
      afspil([ordKlip(k.ord)], R.ORDET + k.ord, { x: k.x, y: k.y - k.str / 2 });
      st.pause = 1.2;
      setTimeout(function () { if (tilstand === 'rim' && !st.loest) sigRimSpoergsmaal(st); }, 1800);
    }
  }

  function naesteRim(st) {
    if (tilstand !== 'rim') return;
    st.i++; st.loest = 0; st.vip = {}; st.pause = 0.6;
    if (stationer.every(function (s) { return s.i >= s.opgaver.length; })) { afslut(); return; }
    if (st.i < st.opgaver.length) setTimeout(function () { if (tilstand === 'rim' && !st.loest) sigRimSpoergsmaal(st); }, 400);
  }

  function tegnRim() {
    var B = window.innerWidth;
    stationer.forEach(function (st) {
      var faerdig = st.i >= st.opgaver.length;
      var l = rimLayout(st), o = st.opgaver[Math.min(st.i, st.opgaver.length - 1)];
      if (l.baand) {
        ctx.fillStyle = FARVER[st.nr] + '22'; ctx.beginPath(); ctx.roundRect(l.baand.x, l.baand.y, l.baand.b, l.baand.h, 26); ctx.fill();
        ctx.strokeStyle = FARVER[st.nr] + '88'; ctx.lineWidth = 3; ctx.stroke();
      }
      tegnTaeller(l.baand ? l.baand.x + l.baand.b / 2 : B / 2, l.baand ? l.baand.y + 14 : 22, Math.min(st.i, st.opgaver.length), st.opgaver.length);
      if (faerdig) return;
      tegnEkko(l.sky);
      tegnSky(l.sky, o.ord);
      l.kort.forEach(function (k) {
        var vip = st.vip[k.ord] || 0, vundet = st.loest && st.loest.ord === k.ord;
        ctx.save();
        ctx.translate(k.x, k.y);
        if (vip > 0) ctx.rotate(Math.sin(vip * 40) * 0.12);
        if (vundet) { var sk = 1 + Math.sin(tid * 8) * 0.04; ctx.scale(sk, sk); }
        rr(-k.str / 2, -k.str / 2, k.str, k.str, 24, vundet ? GUL : PAPIR, KANT);
        tegnTing(R.ORD[k.ord], 0, 0, k.str * 0.62);
        ctx.restore();
        if (!st.loest) tegnFlueben(k.x, knapY(k, l.r), l.r);
      });
    });
  }

  /* ---------- KLAP ---------- */

  function startKlap() {
    tilstand = 'klap';
    klapOpgaver = R.nyKlapOmgang(svaerhed);
    klapI = 0; klapSkift = 0;
    stationer = [];
    for (var s = 0; s < spillere; s++) stationer.push({ nr: s, antal: 0, ro: 0, faerdig: 0, vip: 0, tryk: 0 });
    setTimeout(function () { if (tilstand === 'klap') sigKlapOrd(); }, 500);
  }

  function sigKlapOrd() {
    var o = klapOpgaver[klapI], l = klapLayout();
    // "Her har du ordet elefant. Klap det!"
    afspil([ordKlip(o.ord), R.KLIP.klap_det[0]], R.ORDET + o.ord + '. ' + R.KLIP.klap_det[1], { x: l.sky.x + l.sky.b / 2, y: l.sky.y + l.sky.h });
  }

  function klapLayout() {
    var B = window.innerWidth, H = window.innerHeight, n = stationer.length;
    var ms = Math.min(B, H) * 0.16;
    var sky = { x: B / 2 - ms * 0.85, y: 40, b: ms * 1.7, h: ms * 1.25 };
    var rb = n === 1 ? Math.min(B * 0.2, 200, H * 0.26) : Math.min(B * 0.18, 170, H * 0.24), rh = rb * 0.38;
    var ty = H * 0.76;
    var trommer = (n === 1 ? [B / 2] : [B * 0.28, B * 0.72]).map(function (x) { return { x: x, y: ty, rb: rb, rh: rh }; });
    return { sky: sky, trommer: trommer, prikY: ty - rh * 1.4 - 62, prikR: Math.min(30, rb * 0.16), prikGab: Math.min(90, rb * 0.5) };
  }

  function klapTryk(x, y) {
    var l = klapLayout();
    if (x > l.sky.x - 10 && x < l.sky.x + l.sky.b + 10 && y > l.sky.y - 10 && y < l.sky.y + l.sky.h + 10) { sigKlapOrd(); return; }
    for (var s = 0; s < stationer.length; s++) {
      var st = stationer[s], t = l.trommer[s];
      if (st.faerdig || klapSkift > 0) continue;
      var dx = (x - t.x) / (t.rb * 1.15), dy = (y - t.y - t.rh * 0.6) / (t.rh * 2.4);
      if (dx * dx + dy * dy < 1) {
        var o = klapOpgaver[klapI], r = R.klap(o, st);
        st.tryk = 0.25; st.ro = 0;
        tromme();
        if (r === 'for_mange') { st.vip = 0.8; melodi([330, 262], 110); setTimeout(function () { if (tilstand === 'klap' && !st.faerdig) sigKlapOrd(); }, 900); }
        return;
      }
    }
  }

  function klapFaerdig(st) {
    var o = klapOpgaver[klapI], l = klapLayout(), t = l.trommer[st.nr];
    st.faerdig = { t: 0 };
    melodi([660, 880, 1100], 90);
    afspil([R.KLIP.flot_klappet[0]], R.KLIP.flot_klappet[1], { x: t.x, y: t.y - t.rh });
    if (stationer.every(function (s) { return s.faerdig; })) klapSkift = 2.6;
  }

  function naesteKlap() {
    klapI++;
    if (klapI >= klapOpgaver.length) { afslut(); return; }
    stationer.forEach(function (s) { s.antal = 0; s.ro = 0; s.faerdig = 0; s.vip = 0; });
    setTimeout(function () { if (tilstand === 'klap') sigKlapOrd(); }, 300);
  }

  function opdaterKlap(dt) {
    var o = klapOpgaver[klapI];
    stationer.forEach(function (st) {
      st.ro += dt;
      if (st.tryk > 0) st.tryk -= dt;
      if (st.vip > 0) st.vip -= dt;
      if (st.faerdig) st.faerdig.t += dt;
      // Ordet er klappet, naar prikkerne er fulde og der har vaeret ro et oejeblik
      else if (o && st.antal === o.n && st.ro > 0.7) klapFaerdig(st);
    });
    if (klapSkift > 0) { klapSkift -= dt; if (klapSkift <= 0) { klapSkift = 0; naesteKlap(); } }
  }

  function tegnKlap() {
    var B = window.innerWidth, l = klapLayout(), o = klapOpgaver[klapI];
    if (!o) return;
    tegnTaeller(B / 2, 22, klapI, klapOpgaver.length);
    tegnEkko(l.sky);
    tegnSky(l.sky, o.ord);
    stationer.forEach(function (st) {
      var t = l.trommer[st.nr], farve = FARVER[st.nr];
      // Prikkerne: en pr. stavelse
      for (var i = 0; i < o.n; i++) {
        var px = t.x + (i - (o.n - 1) / 2) * l.prikGab, py = l.prikY;
        var fyldt = i < st.antal || st.faerdig;
        var puls = st.faerdig ? 1 + Math.max(0, Math.sin((st.faerdig.t * 4 - i * 0.8) * Math.PI)) * 0.25 : 1;
        if (st.vip > 0) px += Math.sin(st.vip * 40) * 6;
        ctx.beginPath(); ctx.arc(px, py, l.prikR * puls, 0, Math.PI * 2);
        ctx.fillStyle = fyldt ? GUL : 'rgba(248,241,230,.5)'; ctx.fill();
        ctx.strokeStyle = KANT; ctx.lineWidth = 4; ctx.stroke();
      }
      // Trommen: den store trykflade. Den dukker, naar der slaas.
      var squash = st.tryk > 0 ? 1 - st.tryk * 0.5 : 1, ty = t.y + (1 - squash) * t.rh;
      ctx.fillStyle = 'rgba(94,74,58,.2)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + t.rh * 1.9, t.rb * 1.05, t.rh * 0.6, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = farve; ctx.strokeStyle = KANT; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.ellipse(t.x, t.y + t.rh * 1.5, t.rb, t.rh, 0, 0, Math.PI); ctx.lineTo(t.x - t.rb, ty); ctx.ellipse(t.x, ty, t.rb, t.rh, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fdf3d9'; ctx.beginPath(); ctx.ellipse(t.x, ty, t.rb, t.rh, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(94,74,58,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(t.x, ty, t.rb * 0.55, t.rh * 0.55, 0, 0, Math.PI * 2); ctx.stroke();
    });
  }

  /* ---------- slut, menu ---------- */

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay('<div class="kort"><h2>Flot!</h2>' +
      '<canvas class="eksempel" width="440" height="240"></canvas>' +
      Menu.slutRaekke('igen', null) + '</div>');
    var cv = overlay.querySelector('canvas.eksempel'), c = cv.getContext('2d');
    // Pelle klapper: et lille billede af hulens gæst
    if (pelle.complete && pelle.naturalWidth) c.drawImage(pelle, 150, 10, 140, 140 * (pelle.naturalHeight / pelle.naturalWidth));
    [0, 1, 2].forEach(function (i) { c.beginPath(); c.arc(90 + i * 130, 200, 22, 0, Math.PI * 2); c.fillStyle = GUL; c.fill(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke(); });
  }

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }

  /** Menuikonerne: to kort der rimer (kat og hat), og en tromme med prikker. Tegnet i kode, som de andre spil. */
  function tegnLegIkon(cv) {
    var w = cv.width, h = cv.height, c = cv.getContext('2d'), leg = cv.dataset.leg;
    c.clearRect(0, 0, w, h);
    c.fillStyle = '#fffaf0'; c.beginPath(); c.roundRect(0, 0, w, h, 16); c.fill();
    c.strokeStyle = KANT; c.lineWidth = 4;
    if (leg === 'rim') {
      [['kat', w * 0.3], ['hat', w * 0.7]].forEach(function (k) {
        c.fillStyle = PAPIR; c.beginPath(); c.roundRect(k[1] - 44, h / 2 - 44, 88, 88, 14); c.fill(); c.stroke();
        var img = billeder[R.ORD[k[0]].fil];
        if (img && img.complete && img.naturalWidth) c.drawImage(img, k[1] - 32, h / 2 - 32, 64, 64);
      });
      // Et lille ekko imellem: to buer
      c.strokeStyle = '#e08a52'; c.lineWidth = 4; c.lineCap = 'round';
      c.beginPath(); c.arc(w / 2, h / 2, 10, -0.8, 0.8); c.stroke();
      c.beginPath(); c.arc(w / 2, h / 2, 10, Math.PI - 0.8, Math.PI + 0.8); c.stroke();
    } else {
      var x = w / 2, ty = h * 0.62, rb = 62, rh = 22;
      c.fillStyle = '#d95f45'; c.beginPath(); c.ellipse(x, ty + 30, rb, rh, 0, 0, Math.PI); c.lineTo(x - rb, ty); c.ellipse(x, ty, rb, rh, 0, Math.PI, 0, true); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#fdf3d9'; c.beginPath(); c.ellipse(x, ty, rb, rh, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      [-1, 0, 1].forEach(function (d, i) { c.fillStyle = i < 2 ? GUL : 'rgba(248,241,230,.9)'; c.beginPath(); c.arc(x + d * 40, 34, 13, 0, Math.PI * 2); c.fill(); c.stroke(); });
    }
  }

  function visMenu() {
    tilstand = 'menu';
    stopKlip();
    visOverlay(
      '<div class="kort">' +
      '<h2>Rimhulen</h2>' +
      '<div class="raekke lege">' +
      ['rim', 'klap'].map(function (l) {
        return '<button class="knap smal ikon' + (hvad === l ? ' valgt' : '') + '" data-handling="hvad" data-k="' + l + '" aria-label="' + (l === 'rim' ? 'Rim' : 'Klap stavelser') + '">' +
               '<canvas width="220" height="150" data-leg="' + l + '"></canvas></button>';
      }).join('') +
      '</div>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    var ikoner = overlay.querySelectorAll('canvas[data-leg]');
    ikoner.forEach(tegnLegIkon);
    // Billederne kan vaere paa vej: tegn ikonerne igen, naar de er hentet
    ['kat', 'hat'].forEach(function (o) {
      var img = billeder[R.ORD[o].fil];
      if (img && !(img.complete && img.naturalWidth)) img.addEventListener('load', function () { overlay.querySelectorAll('canvas[data-leg]').forEach(tegnLegIkon); }, { once: true });
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'hvad') { hvad = knap.dataset.k; visMenu(); }
    else if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stopKlip(); visMenu(); }
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'menu') visMenu();
  });

  function start() { if (hvad === 'klap') startKlap(); else startRim(); }

  /* ---------- loop og input ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    if (ekko > 0) ekko -= dt;
    if (tilstand === 'rim') {
      stationer.forEach(function (st) {
        if (st.pause > 0) st.pause -= dt;
        if (st.loest) st.loest.t += dt;
        Object.keys(st.vip).forEach(function (o) { if (st.vip[o] > 0) st.vip[o] -= dt; });
      });
    } else if (tilstand === 'klap') opdaterKlap(dt);
    tegnBaggrund();
    if (tilstand === 'rim') tegnRim();
    else if (tilstand === 'klap') tegnKlap();
    requestAnimationFrame(løkke);
  }

  // Hvert tryk er sit eget pointerdown, saa to fingre paa hver sin tromme virker samtidig.
  lærred.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var r = lærred.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    if (tilstand === 'rim') rimTryk(x, y);
    else if (tilstand === 'klap') klapTryk(x, y);
  }, { passive: false });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, hvad: hvad, svaerhed: svaerhed, spillere: spillere, lyd: lydTil, stemme: stemme ? stemme.name : null, afspillet: afspillet,
      rim: tilstand === 'rim' ? stationer.map(function (st) {
        var l = rimLayout(st), o = st.opgaver[Math.min(st.i, st.opgaver.length - 1)];
        return { i: st.i, antal: st.opgaver.length, ord: o.ord, loest: !!st.loest, pause: +st.pause.toFixed(2), sky: l.sky, r: l.r,
                 kort: l.kort.map(function (k) { return { ord: k.ord, rigtig: k.rigtig, x: Math.round(k.x), y: Math.round(k.y), str: Math.round(k.str), knapY: Math.round(knapY(k, l.r)) }; }) };
      }) : null,
      klap: tilstand === 'klap' ? (function () {
        var l = klapLayout(), o = klapOpgaver[klapI];
        return { i: klapI, antal: klapOpgaver.length, ord: o ? o.ord : null, n: o ? o.n : 0, skift: +klapSkift.toFixed(2), sky: l.sky,
                 stationer: stationer.map(function (st) { var t = l.trommer[st.nr]; return { antal: st.antal, faerdig: !!st.faerdig, x: Math.round(t.x), y: Math.round(t.y + t.rh * 0.6) }; }) };
      })() : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);      // pilen i hjoernet foerer tilbage hertil, ogsaa midt i et spil
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
