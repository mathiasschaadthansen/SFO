/**
 * Maskinen: byg en kaedereaktion.
 *
 * En kugle skal ned til klokken. Paa hylden nederst ligger de dele, banen har
 * med: ramper, trampoliner, klodser, baand, blaesere og vipper. Barnet traekker
 * en del ud i banen, trykker paa den for at dreje den, og trykker saa paa den
 * store groenne knap. Maskinen koerer, og man ser, hvad der sker. Virkede det
 * ikke, trykker man paa pilen og proever igen — delene bliver liggende, saa man
 * kan rette én ting ad gangen. Der er ingen tid, ingen forsoeg der taelles, og
 * ingen maade at tabe paa.
 *
 * Fri leg har ingen klokke og alle dele: der bygger man bare.
 *
 * To boern kan traekke hver sin del samtidig; hver finger foelges via
 * pointerId.
 *
 * Denne fil er kun skaerm og lyd. Fysikken, delene og banerne ligger i
 * js/fysik.js, som testes i Node.
 */
(function () {
  'use strict';

  var F = Fysik;

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, b, h, r) {
      r = Math.min(r, b / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + b, y, x + b, y + h, r);
      this.arcTo(x + b, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + b, y, r);
      this.closePath();
    };
  }

  var MOERK = '#12261f', KRIDT = '#f7f3e8', ROED = '#e8442e', BLAA = '#3aa7e0', GUL = '#ffd23f', GROEN = '#4cb944';
  var FARVER = [ROED, BLAA, GROEN, GUL, '#9b5de5', '#ff8c42'];
  var TRAE_M = '#9c6b34';
  var STI = '../../assets/noto/';
  var TAU = Math.PI * 2;

  var bane = null, verden = null;
  var baneNr = 0, friLeg = false;
  var klaret = [];                  // hvilke baner der er klaret i denne omgang (kun i hukommelsen)
  var lagte = [];                   // delene barnet har lagt ud: { slags, x, y, vinkel }
  var tilbage = {};                 // hvor mange af hver slags der er tilbage paa hylden
  var tilstand = 'venter';          // venter | bygger | koerer | loest
  var lydTil = true;
  var sidsteTid = 0, tid = 0, rest = 0;
  var lyd = null;
  var partikler = [], konfetti = [], vinderCanvas = null;
  var spor = [], klokkeRyst = 0, sidsteKlik = 0, hintTid = 0;
  var dpr = 1;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  Sprites.forhent([STI + 'klokke.svg']);
  function tegnBillede(navn, x, y, str, vinkel, c) {
    c = c || ctx;
    var img = Sprites.hent(STI + navn + '.svg');
    if (!Sprites.klar(img)) return false;
    c.save();
    c.translate(x, y);
    if (vinkel) c.rotate(vinkel);
    c.drawImage(img, -str / 2, -str / 2, str, str);
    c.restore();
    return true;
  }

  /* ---------- lyd ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();      // iOS bruger ogsaa 'interrupted', fx efter et opkald
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
  function klik(styrke) { tone(140 + Math.random() * 60, 0.05 + styrke * 0.05, 0.03 + styrke * 0.12, 'square'); }
  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 0.14); }, i * mellemrum); });
  }
  /** Klokken: to toner oven i hinanden, der klinger ud. */
  function ding() {
    if (!lydTil) return;
    [1320, 1980].forEach(function (f, i) {
      try {
        var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
        o.type = 'sine'; o.frequency.value = f;
        g.gain.value = i ? 0.06 : 0.14;
        g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + 1.6);
        o.connect(g).connect(k.destination); o.start(); o.stop(k.currentTime + 1.6);
      } catch (e) { /* lyd er pynt */ }
    });
  }

  // Stemme: rigtige klip hvis de staar i lyd/klip.json, ellers enhedens egen talesyntese
  var stemme = null, klipFindes = {}, buffere = {}, aktivtKlip = null, talerTil = 0;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    stemme = window.speechSynthesis.getVoices().filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }
  fetch('lyd/klip.json').then(function (r) { return r.ok ? r.json() : []; })
    .then(function (liste) { liste.forEach(function (f) { klipFindes[f] = true; }); }).catch(function () { /* ingen klip */ });

  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try {
      var u = new SpeechSynthesisUtterance(tekst);
      u.voice = stemme; u.lang = stemme.lang; u.rate = 0.9;
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    } catch (e) { /* stemme er pynt */ }
  }
  function stopTale() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* stoppet */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  function afspil(fil, reserveTekst, varighed) {
    if (!lydTil) return;
    talerTil = tid + (varighed || 2.5);
    if (!klipFindes[fil]) { stopTale(); sig(reserveTekst); return; }
    if (!buffere[fil]) {
      buffere[fil] = fetch('lyd/' + fil).then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    buffere[fil].then(function (buf) {
      var k = lydKontekst();
      stopTale();
      var kilde = k.createBufferSource();
      kilde.buffer = buf; kilde.connect(k.destination); kilde.start();
      aktivtKlip = kilde;
      talerTil = tid + buf.duration + 0.2;
    }).catch(function () { sig(reserveTekst); });
  }
  var FLOT = [['flot_1.mp3', 'Flot!'], ['flot_2.mp3', 'Sådan! Maskinen virker!']];
  function sigFlot() { var f = FLOT[Math.floor(Math.random() * FLOT.length)]; afspil(f[0], f[1], 1.8); }

  /* ---------- skaerm og maal ---------- */

  function tilpasStørrelse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lagFor = '';
  }

  /** Hvordan verdenen ligger paa skaermen, og hvor hylden er. */
  function plan() {
    var B = window.innerWidth, H = window.innerHeight;
    var hyldeH = Math.max(86, Math.min(150, H * 0.2));
    var sk = Math.min(B / F.BREDDE, (H - hyldeH) / F.HOEJDE);
    var b = F.BREDDE * sk, h = F.HOEJDE * sk;
    var ox = (B - b) / 2, oy = (H - hyldeH - h) / 2;
    var knapR = Math.min(hyldeH * 0.38, 46);
    return { B: B, H: H, sk: sk, ox: ox, oy: oy, b: b, h: h,
      hylde: { y: H - hyldeH, h: hyldeH },
      knap: { x: B - knapR - 18, y: H - hyldeH / 2, r: knapR } };
  }
  function tilSkaerm(p, x, y) { return { x: p.ox + x * p.sk, y: p.oy + y * p.sk }; }
  function tilVerden(p, x, y) { return { x: (x - p.ox) / p.sk, y: (y - p.oy) / p.sk }; }

  /** Pladserne paa hylden: én pr. slags, banen har med. */
  function hyldePladser(p) {
    var slags = Object.keys(bane ? bane.hylde : {});
    var plads = Math.min(110, (p.knap.x - 30) / Math.max(1, slags.length));
    return slags.map(function (s, i) {
      return { slags: s, x: 20 + plads * (i + 0.5), y: p.hylde.y + p.hylde.h * 0.44, b: plads, str: Math.min(plads * 0.9, p.hylde.h * 0.62) };
    });
  }

  /* ---------- tegning af delene ---------- */

  function rr(c, x, y, b, h, r, fyld, streg, lw) {
    c.beginPath(); c.roundRect(x, y, b, h, r);
    if (fyld) { c.fillStyle = fyld; c.fill(); }
    if (streg) { c.strokeStyle = streg; c.lineWidth = lw || 3; c.stroke(); }
  }

  /**
   * Tegn en del. sk er hvor stor en verdensenhed er paa skaermen, saa den
   * samme tegning kan bruges baade ude i banen og som ikon paa hylden.
   */
  function tegnDel(c, slags, x, y, vinkel, sk, valg) {
    valg = valg || {};
    var s = F.DELE[slags], b = s.b * sk, h = s.h * sk;
    c.save();
    c.translate(x, y);
    if (!s.fart && !s.kraft) c.rotate(F.grader(vinkel));
    c.lineJoin = 'round'; c.lineCap = 'round';
    var lw = Math.max(2, 3 * sk);
    if (valg.skygge) { c.fillStyle = 'rgba(18,38,31,.22)'; c.beginPath(); c.roundRect(-b / 2 + 4, -h / 2 + 6, b, h, 6 * sk); c.fill(); }

    if (slags === 'rampe') {
      var g = c.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, '#e0a869'); g.addColorStop(1, TRAE_M);
      rr(c, -b / 2, -h / 2, b, h, h * 0.4, g, MOERK, lw);
      c.strokeStyle = 'rgba(18,38,31,.22)'; c.lineWidth = Math.max(1, sk);
      for (var i = 1; i < 4; i++) { c.beginPath(); c.moveTo(-b / 2 + b * i / 4, -h / 2 + 2); c.lineTo(-b / 2 + b * i / 4, h / 2 - 2); c.stroke(); }
    } else if (slags === 'trampolin') {
      // Maatte med fjedre under
      c.strokeStyle = MOERK; c.lineWidth = lw;
      for (var q = 0; q < 5; q++) {
        var fx = -b / 2 + b * (q + 0.5) / 5;
        c.beginPath();
        for (var z = 0; z <= 6; z++) c.lineTo(fx + (z % 2 ? 3 : -3) * sk, h / 2 - 2 + z * (h * 0.55) / 6);
        c.stroke();
      }
      var tg = c.createLinearGradient(0, -h / 2, 0, h / 2);
      tg.addColorStop(0, '#6fc8f7'); tg.addColorStop(1, '#2b86c0');
      rr(c, -b / 2, -h / 2, b, h, h * 0.45, tg, MOERK, lw);
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.roundRect(-b / 2 + 4 * sk, -h / 2 + 2 * sk, b - 8 * sk, h * 0.3, h * 0.15); c.fill();
    } else if (slags === 'klods') {
      var kg = c.createLinearGradient(-b / 2, -h / 2, b / 2, h / 2);
      kg.addColorStop(0, '#e0a869'); kg.addColorStop(1, '#a9712f');
      rr(c, -b / 2, -h / 2, b, h, 6 * sk, kg, MOERK, lw);
      c.strokeStyle = TRAE_M; c.lineWidth = Math.max(2, 4 * sk);
      c.beginPath(); c.moveTo(-b / 2 + 6 * sk, -h / 2 + 6 * sk); c.lineTo(b / 2 - 6 * sk, h / 2 - 6 * sk);
      c.moveTo(b / 2 - 6 * sk, -h / 2 + 6 * sk); c.lineTo(-b / 2 + 6 * sk, h / 2 - 6 * sk); c.stroke();
      rr(c, -b / 2, -h / 2, b, h, 6 * sk, null, MOERK, lw);
    } else if (slags === 'baand') {
      // Ruller og et baand, der loeber
      rr(c, -b / 2, -h / 2, b, h, h / 2, '#4a5460', MOERK, lw);
      var ret = vinkel === 180 ? -1 : 1;
      c.save(); c.beginPath(); c.roundRect(-b / 2, -h / 2, b, h, h / 2); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = Math.max(2, 3 * sk);
      for (var w = -1; w < 7; w++) {
        var wx = -b / 2 + ((w + (valg.koerer ? (tid * 1.4 * ret) % 1 : 0)) * b / 6);
        c.beginPath(); c.moveTo(wx, -h / 2 + 3 * sk); c.lineTo(wx + ret * h * 0.4, 0); c.lineTo(wx, h / 2 - 3 * sk); c.stroke();
      }
      c.restore();
      [-1, 1].forEach(function (d) {
        c.fillStyle = '#8d97a6'; c.beginPath(); c.arc(d * (b / 2 - h * 0.28), 0, h * 0.3, 0, TAU); c.fill();
        c.strokeStyle = MOERK; c.lineWidth = lw; c.stroke();
      });
    } else if (slags === 'blaeser') {
      // Hus med vinger, der drejer, og luft der blaeser opad i delens retning
      c.rotate(F.grader(vinkel));
      if (valg.ibane) {                     // luftstroemmen vises kun ude i banen, ikke paa hylden
        c.fillStyle = 'rgba(180,220,255,.35)';
        c.beginPath(); c.moveTo(-b * 0.32, -h * 0.5); c.lineTo(-b * 0.75, -h * 0.5 - s.raekke * sk); c.lineTo(b * 0.75, -h * 0.5 - s.raekke * sk); c.lineTo(b * 0.32, -h * 0.5); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(1.5, 2 * sk);
        for (var l = 0; l < 3; l++) {
          var ly = -h * 0.5 - ((tid * 190 + l * s.raekke / 3) % s.raekke) * sk;
          var br = b * (0.32 + 0.43 * (1 - (ly + h * 0.5) / (-s.raekke * sk)));
          c.beginPath(); c.moveTo(-br, ly); c.lineTo(br, ly); c.stroke();
        }
      }
      rr(c, -b / 2, -h / 2, b, h, 10 * sk, '#6d7684', MOERK, lw);
      c.save(); c.rotate(valg.koerer ? tid * 14 : tid * 1.2);
      c.fillStyle = '#dfe5ec';
      for (var v2 = 0; v2 < 4; v2++) {
        c.rotate(TAU / 4);
        c.beginPath(); c.ellipse(0, -h * 0.22, b * 0.1, h * 0.2, 0, 0, TAU); c.fill();
        c.strokeStyle = MOERK; c.lineWidth = Math.max(1.5, 2 * sk); c.stroke();
      }
      c.restore();
      c.fillStyle = MOERK; c.beginPath(); c.arc(0, 0, h * 0.08, 0, TAU); c.fill();
    } else if (slags === 'vippe') {
      // Foden staar stille; braettet drejer
      var vv = valg.vippeVinkel || 0;
      c.fillStyle = TRAE_M;
      c.beginPath(); c.moveTo(-h * 1.4, h * 2.4); c.lineTo(0, h * 0.2); c.lineTo(h * 1.4, h * 2.4); c.closePath(); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = lw; c.stroke();
      c.rotate(F.grader(vv));
      var vg = c.createLinearGradient(0, -h / 2, 0, h / 2);
      vg.addColorStop(0, '#e0a869'); vg.addColorStop(1, TRAE_M);
      rr(c, -b / 2, -h / 2, b, h, h * 0.4, vg, MOERK, lw);
      c.fillStyle = ROED;
      [-1, 1].forEach(function (d) { c.beginPath(); c.roundRect(d * (b / 2 - 14 * sk) - 6 * sk, -h / 2, 12 * sk, h, h * 0.3); c.fill(); });
      c.rotate(-F.grader(vv));
      c.fillStyle = '#8d97a6'; c.beginPath(); c.arc(0, 0, h * 0.42, 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = lw; c.stroke();
    }
    c.restore();
  }

  /* ---------- baggrund ---------- */

  var lag = document.createElement('canvas'), lagFor = '';

  /** Vaerkstedets vaeg og banens faste klodser tegnes én gang. */
  function tegnLag(p) {
    var noegle = p.B + 'x' + p.H + 'x' + dpr + 'x' + (bane ? bane.navn : '') + 'x' + lagte.length;
    if (lagFor === noegle) return;
    lagFor = noegle;
    lag.width = Math.floor(p.B * dpr); lag.height = Math.floor(p.H * dpr);
    var c = lag.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    // Vaeggen: lyst papir med et blidt ternet moenster, som en tegning til en opfindelse
    var g = c.createLinearGradient(0, 0, 0, p.H);
    g.addColorStop(0, '#fbf3e2'); g.addColorStop(1, '#efe2c8');
    c.fillStyle = g; c.fillRect(0, 0, p.B, p.H);
    c.strokeStyle = 'rgba(58,167,224,.16)'; c.lineWidth = 1;
    for (var x = p.ox % 30; x < p.B; x += 30) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, p.H); c.stroke(); }
    for (var y = p.oy % 30; y < p.H; y += 30) { c.beginPath(); c.moveTo(0, y); c.lineTo(p.B, y); c.stroke(); }
    // Selve banen staar lidt lysere end vaeggen
    c.fillStyle = 'rgba(255,255,255,.45)';
    c.beginPath(); c.roundRect(p.ox, p.oy, p.b, p.h, 14); c.fill();
    c.strokeStyle = 'rgba(18,38,31,.35)'; c.lineWidth = 3; c.stroke();
    if (!bane) return;
    // Murene: bjaelker af trae
    c.save(); c.beginPath(); c.roundRect(p.ox, p.oy, p.b, p.h, 14); c.clip();
    bane.mur.forEach(function (m) {
      if (m.b === undefined) return;
      var a = tilSkaerm(p, m.x, m.y), b2 = m.b * p.sk, h2 = m.h * p.sk;
      c.fillStyle = 'rgba(18,38,31,.2)';
      c.beginPath(); c.roundRect(a.x + 3, a.y + 5, b2, h2, 6); c.fill();
      var mg = c.createLinearGradient(0, a.y, 0, a.y + h2);
      mg.addColorStop(0, '#d79b5c'); mg.addColorStop(1, '#8f5f2c');
      c.fillStyle = mg; c.beginPath(); c.roundRect(a.x, a.y, b2, h2, 6); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = 3; c.stroke();
      // Traeaarer
      c.strokeStyle = 'rgba(18,38,31,.16)'; c.lineWidth = 1.5;
      for (var i = 1; i < Math.max(2, Math.round(h2 / 18)); i++) {
        var yy = a.y + h2 * i / Math.max(2, Math.round(h2 / 18));
        c.beginPath(); c.moveTo(a.x + 4, yy); c.lineTo(a.x + b2 - 4, yy); c.stroke();
      }
    });
    c.restore();
  }

  /* ---------- kuglen, klokken, sporet ---------- */

  function tegnKugle(p, k, drej) {
    var s = tilSkaerm(p, k.x, k.y), r = k.r * p.sk;
    ctx.fillStyle = 'rgba(18,38,31,.25)';
    ctx.beginPath(); ctx.ellipse(s.x + 3, s.y + 5, r, r * 0.95, 0, 0, TAU); ctx.fill();
    var g = ctx.createRadialGradient(s.x - r * 0.35, s.y - r * 0.4, r * 0.1, s.x, s.y, r);
    g.addColorStop(0, '#ff9a86'); g.addColorStop(0.6, ROED); g.addColorStop(1, '#a32718');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    ctx.strokeStyle = MOERK; ctx.lineWidth = Math.max(2, 3 * p.sk); ctx.stroke();
    // En stribe, saa man kan se kuglen rulle
    ctx.save(); ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.clip();
    ctx.translate(s.x, s.y); ctx.rotate(drej);
    ctx.fillStyle = 'rgba(18,38,31,.35)';
    ctx.beginPath(); ctx.roundRect(-r * 0.22, -r, r * 0.44, r * 2, r * 0.2); ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,.65)';
    ctx.beginPath(); ctx.ellipse(s.x - r * 0.35, s.y - r * 0.4, r * 0.28, r * 0.2, -0.6, 0, TAU); ctx.fill();
  }

  function tegnKlokke(p) {
    if (!bane.maal) return;
    var s = tilSkaerm(p, bane.maal.x, bane.maal.y), r = F.MAAL_R * p.sk;
    var ryst = klokkeRyst > 0 ? Math.sin(tid * 42) * klokkeRyst * r * 0.18 : 0;
    // Stativ
    ctx.strokeStyle = MOERK; ctx.lineWidth = Math.max(3, 5 * p.sk);
    ctx.beginPath(); ctx.moveTo(s.x - r * 0.8, s.y + r * 1.25); ctx.lineTo(s.x + r * 0.8, s.y + r * 1.25); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x, s.y + r * 1.25); ctx.lineTo(s.x, s.y - r * 0.9); ctx.stroke();
    if (tilstand !== 'loest') {
      ctx.globalAlpha = 0.35 + Math.sin(tid * 3) * 0.2;
      ctx.strokeStyle = GUL; ctx.lineWidth = Math.max(3, 5 * p.sk);
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.save(); ctx.translate(ryst, 0);
    if (!tegnBillede('klokke', s.x, s.y, r * 2)) {
      ctx.fillStyle = GUL; ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.8, Math.PI, 0); ctx.fill();
      ctx.strokeStyle = MOERK; ctx.lineWidth = 3; ctx.stroke();
    }
    ctx.restore();
    if (klokkeRyst > 0) {
      ctx.strokeStyle = GUL; ctx.lineWidth = Math.max(2, 3 * p.sk);
      ctx.globalAlpha = klokkeRyst;
      for (var i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(s.x, s.y, r * (1 + i * 0.4) + (1 - klokkeRyst) * 40, -2.4, -0.7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }

  /** Sporet efter kuglen: en stiplet vej, saa man kan se, hvad der skete. */
  function tegnSpor(p) {
    if (spor.length < 2) return;
    ctx.strokeStyle = 'rgba(232,68,46,.35)';
    ctx.lineWidth = Math.max(2, 3 * p.sk); ctx.lineCap = 'round';
    ctx.setLineDash([2 * p.sk, 7 * p.sk]);
    ctx.beginPath();
    spor.forEach(function (s, i) { var a = tilSkaerm(p, s.x, s.y); if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------- hylden og knappen ---------- */

  function tegnHylde(p) {
    var h = p.hylde;
    ctx.fillStyle = '#e4d4b4'; ctx.fillRect(0, h.y, p.B, h.h);
    ctx.strokeStyle = MOERK; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, h.y); ctx.lineTo(p.B, h.y); ctx.stroke();
    ctx.fillStyle = 'rgba(18,38,31,.07)';
    for (var x = 16; x < p.B; x += 26) { ctx.beginPath(); ctx.arc(x, h.y + 12, 3, 0, TAU); ctx.fill(); }

    hyldePladser(p).forEach(function (hp) {
      var n = tilbage[hp.slags] || 0;
      ctx.globalAlpha = n > 0 ? 1 : 0.28;
      var sk = hp.str / Math.max(F.DELE[hp.slags].b, F.DELE[hp.slags].h);
      tegnDel(ctx, hp.slags, hp.x, hp.y - hp.str * 0.12, F.DELE[hp.slags].vinkler[0], sk, { skygge: true });
      // Hvor mange der er tilbage: prikker, ikke tal
      var pr = Math.min(5, hp.b * 0.06);
      for (var i = 0; i < n; i++) {
        var px = hp.x + (i - (n - 1) / 2) * pr * 2.8;
        ctx.fillStyle = GROEN; ctx.beginPath(); ctx.arc(px, hp.y + hp.str * 0.62, pr, 0, TAU); ctx.fill();
        ctx.strokeStyle = MOERK; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    });

    // Den store knap: groen trekant naar man bygger, gul pil naar maskinen koerer
    var k = p.knap;
    ctx.fillStyle = 'rgba(18,38,31,.3)'; ctx.beginPath(); ctx.arc(k.x + 4, k.y + 6, k.r, 0, TAU); ctx.fill();
    ctx.fillStyle = tilstand === 'koerer' ? GUL : GROEN;
    ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = MOERK; ctx.lineWidth = 4; ctx.stroke();
    ctx.save(); ctx.translate(k.x, k.y);
    if (tilstand === 'koerer') {
      ctx.strokeStyle = MOERK; ctx.lineWidth = k.r * 0.22; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(0, 0, k.r * 0.46, -0.6, Math.PI * 1.35); ctx.stroke();
      ctx.fillStyle = MOERK;
      ctx.beginPath(); ctx.moveTo(k.r * 0.16, -k.r * 0.66); ctx.lineTo(k.r * 0.68, -k.r * 0.3); ctx.lineTo(k.r * 0.12, -k.r * 0.06); ctx.fill();
    } else {
      ctx.fillStyle = KRIDT;
      ctx.beginPath(); ctx.moveTo(-k.r * 0.28, -k.r * 0.45); ctx.lineTo(k.r * 0.5, 0); ctx.lineTo(-k.r * 0.28, k.r * 0.45); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = MOERK; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.stroke();
    }
    ctx.restore();
  }

  /** Taelleren: én prik pr. bane, de klarede i groent. */
  function tegnFremskridt(p) {
    if (friLeg) return;
    var n = F.BANER.length, afstand = Math.min(26, (p.B - 260) / n), r = Math.min(8, afstand * 0.34);
    var bred = (n - 1) * afstand + r * 2 + 24;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = MOERK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(p.B / 2 - bred / 2, 18 - r - 8, bred, r * 2 + 16, r + 8); ctx.fill(); ctx.stroke();
    for (var i = 0; i < n; i++) {
      var x = p.B / 2 + (i - (n - 1) / 2) * afstand;
      ctx.beginPath(); ctx.arc(x, 18, i === baneNr ? r * 1.25 : r, 0, TAU);
      ctx.fillStyle = klaret[i] ? GROEN : (i === baneNr ? GUL : '#fff'); ctx.fill();
      ctx.lineWidth = i === baneNr ? 3.5 : 2.5; ctx.strokeStyle = MOERK; ctx.stroke();
    }
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 260) return;
      var v = Math.random() * TAU, f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f - fart * 0.3, liv: liv, maxLiv: liv, r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }
  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy += 500 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.liv -= dt;
      if (p.liv <= 0) partikler.splice(i, 1);
    }
  }
  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv);
      ctx.fillStyle = p.farve; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- spillets gang ---------- */

  function startBane(nr, fri) {
    friLeg = !!fri;
    baneNr = fri ? -1 : nr;
    bane = fri ? F.FRI : F.BANER[nr];
    lagte = [];
    tilbage = {};
    Object.keys(bane.hylde).forEach(function (s) { tilbage[s] = bane.hylde[s]; });
    verden = null;
    spor = [];
    partikler = [];
    klokkeRyst = 0;
    tilstand = 'bygger';
    lagFor = '';
    hintTid = tid + 1.2;
    stopTale();
  }

  function startMaskinen() {
    verden = F.nyVerden(bane, lagte);
    spor = [];
    rest = 0;
    tilstand = 'koerer';
    stopTale();
    tone(520, 0.12); setTimeout(function () { tone(780, 0.12); }, 90);
  }

  function nulstil() {
    verden = null;
    spor = [];
    tilstand = 'bygger';
    tone(400, 0.1);
  }

  function opdater(dt) {
    opdaterPartikler(dt);
    if (klokkeRyst > 0) klokkeRyst = Math.max(0, klokkeRyst - dt * 0.8);
    if (tilstand === 'bygger' && !friLeg && hintTid && tid >= hintTid) {
      hintTid = 0;
      afspil('opgave.mp3', 'Kan du få kuglen ned til klokken?', 2.6);
    }
    if (tilstand !== 'koerer' || !verden) return;
    // Fysikken koerer med sit eget faste skridt, uanset hvor tit skaermen tegnes
    rest += Math.min(dt, 0.05);
    var vagt = 0;
    while (rest >= F.DT && vagt++ < 12) {
      rest -= F.DT;
      var foer = verden.stoed.length;
      F.trin(verden);
      for (var i = foer; i < verden.stoed.length; i++) {
        var st = verden.stoed[i];
        if (tid - sidsteKlik > 0.05) { sidsteKlik = tid; klik(st.styrke); }
        var p = plan(), s = tilSkaerm(p, st.x, st.y);
        puf(s.x, s.y, '#d8c49a', 3, 90 * st.styrke + 20, 3, 0.4);
      }
      if (verden.stoed.length > 60) verden.stoed = verden.stoed.slice(-20);
      if (spor.length === 0 || Math.hypot(verden.kugle.x - spor[spor.length - 1].x, verden.kugle.y - spor[spor.length - 1].y) > 10) {
        spor.push({ x: verden.kugle.x, y: verden.kugle.y });
        if (spor.length > 400) spor.shift();
      }
    }
    if (verden.loest) { klarede(); return; }
    if (verden.stoppet) {
      tilstand = 'bygger';
      if (!friLeg) afspil('igen.mp3', 'Prøv igen!', 1.4);
    }
  }

  function klarede() {
    tilstand = 'loest';
    klokkeRyst = 1;
    ding();
    melodi([660, 880, 1100, 1320], 110);
    var p = plan(), s = tilSkaerm(p, bane.maal.x, bane.maal.y);
    puf(s.x, s.y, GUL, 34, 320, 6, 1.2);
    if (!friLeg) klaret[baneNr] = true;
    setTimeout(sigFlot, 700);
    setTimeout(visSlut, 1500);
  }

  /* ---------- tryk ---------- */

  var fingre = {};

  function sted(e) {
    var r = lærred.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  /** Den del, der ligger under punktet, hvis der er en. */
  function delVed(p, x, y) {
    for (var i = lagte.length - 1; i >= 0; i--) {
      var d = lagte[i], s = F.DELE[d.slags];
      var a = tilSkaerm(p, d.x, d.y);
      var r = Math.max(s.b, s.h) * 0.5 * p.sk + 6;
      if (Math.abs(x - a.x) < r && Math.abs(y - a.y) < r) return i;
    }
    return -1;
  }
  function snap(v) { return Math.round(v / F.GITTER) * F.GITTER; }

  function ned(e) {
    var p = plan(), pos = sted(e), x = pos.x, y = pos.y;
    if (tilstand === 'venter') return;
    // Den store knap
    if (Math.hypot(x - p.knap.x, y - p.knap.y) < p.knap.r * 1.2) {
      if (tilstand === 'koerer') nulstil();
      else if (tilstand === 'bygger') startMaskinen();
      return;
    }
    if (tilstand !== 'bygger') return;
    // Hylden: tag en ny del
    if (y > p.hylde.y) {
      var pladser = hyldePladser(p);
      for (var i = 0; i < pladser.length; i++) {
        var hp = pladser[i];
        if (Math.abs(x - hp.x) < hp.b * 0.5 && (tilbage[hp.slags] || 0) > 0) {
          fingre[e.pointerId] = { type: 'ny', slags: hp.slags, x: x, y: y, flyttet: false };
          tone(700, 0.06, 0.08);
          return;
        }
      }
      return;
    }
    // En del i banen: traek den, eller drej den med et tryk
    var n = delVed(p, x, y);
    if (n >= 0) {
      fingre[e.pointerId] = { type: 'flyt', n: n, x: x, y: y, startX: x, startY: y, flyttet: false };
      return;
    }
  }

  function flyt(e) {
    var f = fingre[e.pointerId];
    if (!f) return;
    var pos = sted(e);
    if (Math.hypot(pos.x - (f.startX === undefined ? f.x : f.startX), pos.y - (f.startY === undefined ? f.y : f.startY)) > 8) f.flyttet = true;
    f.x = pos.x; f.y = pos.y;
    if (f.type === 'flyt' && f.flyttet) {
      var p = plan(), v = tilVerden(p, pos.x, pos.y);
      lagte[f.n].x = snap(v.x);
      lagte[f.n].y = snap(v.y);
      lagFor = '';
    }
  }

  function op(e) {
    var f = fingre[e.pointerId];
    if (!f) return;
    delete fingre[e.pointerId];
    if (tilstand !== 'bygger') return;
    var p = plan();
    if (f.type === 'ny') {
      if (f.y < p.hylde.y) {                 // sluppet ude i banen: laeg den
        var v = tilVerden(p, f.x, f.y);
        lagte.push({ slags: f.slags, x: snap(v.x), y: snap(v.y), vinkel: F.DELE[f.slags].vinkler[0] });
        tilbage[f.slags]--;
        tone(520, 0.08, 0.1);
        lagFor = '';
      }
      return;
    }
    if (f.type === 'flyt') {
      var d = lagte[f.n];
      if (!f.flyttet) {                      // et tryk drejer delen
        var vinkler = F.DELE[d.slags].vinkler;
        d.vinkel = vinkler[(vinkler.indexOf(d.vinkel) + 1) % vinkler.length];
        tone(880, 0.07, 0.09);
        lagFor = '';
        return;
      }
      if (f.y > p.hylde.y) {                 // traukket ned paa hylden: laeg den tilbage
        tilbage[d.slags]++;
        lagte.splice(f.n, 1);
        tone(300, 0.1, 0.09);
        lagFor = '';
      }
    }
  }

  /* ---------- tegning ---------- */

  function tegn() {
    var p = plan();
    tegnLag(p);
    ctx.drawImage(lag, 0, 0, p.B, p.H);
    if (tilstand === 'venter') return;
    ctx.save();
    ctx.beginPath(); ctx.roundRect(p.ox, p.oy, p.b, p.h, 14); ctx.clip();
    tegnKlokke(p);
    if (tilstand === 'koerer' || tilstand === 'loest') tegnSpor(p);
    // Delene
    lagte.forEach(function (d, i) {
      var a = tilSkaerm(p, d.x, d.y);
      var vv = 0;
      if (verden) {
        for (var q = 0; q < verden.vipper.length; q++) if (verden.vipper[q].i === i) vv = verden.vipper[q].vinkel;
      }
      tegnDel(ctx, d.slags, a.x, a.y, d.vinkel, p.sk, { skygge: true, ibane: true, koerer: tilstand === 'koerer', vippeVinkel: vv });
    });
    // Kuglen: enten paa sin plads, eller hvor fysikken har ført den hen
    var k = verden ? verden.kugle : { x: bane.start.x, y: bane.start.y, r: F.KUGLE_R };
    tegnKugle(p, k, verden ? verden.tid * 6 : 0);
    if (!verden) {
      // Vis hvor kuglen falder fra
      var s = tilSkaerm(p, bane.start.x, bane.start.y);
      ctx.strokeStyle = 'rgba(18,38,31,.3)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
      ctx.beginPath(); ctx.moveTo(s.x, s.y + F.KUGLE_R * p.sk); ctx.lineTo(s.x, p.oy + p.h); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
    tegnPartikler();
    // Delen, der haenger i fingeren
    Object.keys(fingre).forEach(function (id) {
      var f = fingre[id];
      if (f.type === 'ny' && f.flyttet) {
        ctx.globalAlpha = 0.85;
        tegnDel(ctx, f.slags, f.x, f.y, F.DELE[f.slags].vinkler[0], p.sk, { skygge: true, ibane: true });
        ctx.globalAlpha = 1;
      }
    });
    tegnHylde(p);
    tegnFremskridt(p);
  }

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    if (tilstand !== 'venter') opdater(dt);
    else if (vinderCanvas) tegnVinder(dt);
    tegn();
    if (tilstand === 'loest') tegnVinder(dt);
    requestAnimationFrame(løkke);
  }

  /* ---------- menu og slutskaerm ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; vinderCanvas = null; konfetti = []; }

  var FLISE_STIL = 'position:static;display:block;width:100%;height:100%';

  function visMenu() {
    tilstand = 'venter';
    bane = null; verden = null; lagte = [];
    lagFor = '';
    stopTale();
    var fliser = F.BANER.map(function (b, i) {
      return '<button class="flise' + (baneNr === i && !friLeg ? ' valgt' : '') + '" data-handling="bane" data-n="' + i +
             '" aria-label="Bane ' + (i + 1) + '"><canvas width="150" height="100" style="' + FLISE_STIL + '" data-bane="' + i + '"></canvas></button>';
    }).join('');
    visOverlay(
      '<div class="kort bred">' +
      '<h2>Maskinen</h2>' +
      '<div class="baner">' + fliser + '</div>' +
      '<div class="raekke valg">' +
      '<button class="knap smal ikon' + (friLeg ? ' valgt' : '') + '" data-handling="fri" aria-label="Fri leg">' + Menu.fri() + '</button>' +
      '</div>' +
      '<div class="raekke start"><button class="knap groen start" data-handling="start" aria-label="Start">' + Menu.start() + '</button></div>' +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    tegnMenuBilleder();
  }

  /** Hver bane vises som et lille billede af sig selv, saa man kan vaelge uden at laese. */
  function tegnMenuBilleder() {
    overlay.querySelectorAll('canvas[data-bane]').forEach(function (cv) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height;
      var b = F.BANER[parseInt(cv.dataset.bane, 10)];
      var sk = Math.min(w / F.BREDDE, h / F.HOEJDE);
      var ox = (w - F.BREDDE * sk) / 2, oy = (h - F.HOEJDE * sk) / 2;
      c.clearRect(0, 0, w, h);
      c.fillStyle = '#fbf3e2'; c.fillRect(0, 0, w, h);
      c.strokeStyle = 'rgba(58,167,224,.2)'; c.lineWidth = 0.5;
      for (var x = 0; x < w; x += 10) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); }
      for (var y = 0; y < h; y += 10) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); }
      b.mur.forEach(function (m) {
        if (m.b === undefined) return;
        c.fillStyle = '#b8762f';
        c.beginPath(); c.roundRect(ox + m.x * sk, oy + m.y * sk, m.b * sk, m.h * sk, 2); c.fill();
        c.strokeStyle = MOERK; c.lineWidth = 1; c.stroke();
      });
      c.fillStyle = ROED;
      c.beginPath(); c.arc(ox + b.start.x * sk, oy + b.start.y * sk, Math.max(3, F.KUGLE_R * sk), 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = 1; c.stroke();
      c.fillStyle = GUL;
      c.beginPath(); c.arc(ox + b.maal.x * sk, oy + b.maal.y * sk, Math.max(4, F.MAAL_R * sk * 0.7), 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = 1.5; c.stroke();
      // Klaret: et groent flueben i hjoernet
      if (klaret[parseInt(cv.dataset.bane, 10)]) {
        c.fillStyle = GROEN; c.beginPath(); c.arc(w - 13, 13, 10, 0, TAU); c.fill();
        c.strokeStyle = MOERK; c.lineWidth = 2; c.stroke();
        c.strokeStyle = '#fff'; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(w - 18, 13); c.lineTo(w - 14, 17); c.lineTo(w - 8, 9); c.stroke();
      }
    });
  }

  function startKonfetti() {
    konfetti = [];
    var p = plan();
    for (var i = 0; i < 80; i++) konfetti.push({ x: Math.random() * p.B, y: -Math.random() * p.H * 0.5, vx: (Math.random() - 0.5) * 60, vy: 90 + Math.random() * 140,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 7, b: 8 + Math.random() * 7, h: 5 + Math.random() * 5, farve: FARVER[i % FARVER.length] });
  }
  function tegnVinder(dt) {
    var p = plan();
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > p.H + 10) { k.y = -10; k.x = Math.random() * p.B; }
      ctx.save(); ctx.translate(k.x, k.y); ctx.rotate(k.rot); ctx.fillStyle = k.farve; ctx.fillRect(-k.b / 2, -k.h / 2, k.b, k.h); ctx.restore();
    });
  }

  /** Slutskaerm: igen, naeste bane og tilbage til menuen. */
  function visSlut() {
    if (tilstand !== 'loest') return;
    startKonfetti();
    var naeste = !friLeg && baneNr + 1 < F.BANER.length;
    visOverlay(
      '<div class="kort">' +
      '<h2>Maskinen virker!</h2>' +
      '<div class="raekke slut">' +
      '<button class="knap gul" data-handling="igen" aria-label="Byg igen">' + Menu.igen() + '</button>' +
      (naeste ? '<button class="knap groen" data-handling="naeste" aria-label="Næste bane">' + naestePil() + '</button>' : '') +
      '<button class="knap" data-handling="menu" aria-label="Menu">' + Menu.tilbage() + '</button>' +
      '</div></div>'
    );
  }
  /** Pil mod hoejre: naeste bane. */
  function naestePil() {
    return '<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">' +
      '<path d="M10 28h30" fill="none" stroke="#f7f3e8" stroke-width="7" stroke-linecap="round"/>' +
      '<path d="M30 14l15 14-15 14" fill="none" stroke="#f7f3e8" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'bane') { friLeg = false; baneNr = parseInt(knap.dataset.n, 10); tone(660, 0.1); visMenu(); }
    else if (h === 'fri') { friLeg = !friLeg; tone(friLeg ? 880 : 520, 0.12); visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (lydTil) tone(660, 0.12); else stopTale(); visMenu(); }
    else if (h === 'start') { skjulOverlay(); startBane(Math.max(0, baneNr), friLeg); }
    else if (h === 'igen') { skjulOverlay(); startBane(baneNr, friLeg); }
    else if (h === 'naeste') { skjulOverlay(); startBane(baneNr + 1, false); }
    else if (h === 'menu') { skjulOverlay(); visMenu(); }
  });

  lærred.addEventListener('pointerdown', function (e) { e.preventDefault(); try { lærred.setPointerCapture(e.pointerId); } catch (fejl) { /* ikke alle browsere */ } ned(e); }, { passive: false });
  lærred.addEventListener('pointermove', function (e) { e.preventDefault(); flyt(e); }, { passive: false });
  window.addEventListener('pointerup', op);
  window.addEventListener('pointercancel', op);
  document.addEventListener('visibilitychange', function () { fingre = {}; });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    var p = plan();
    return {
      tilstand: tilstand, bane: bane ? bane.navn : null, baneNr: baneNr, fri: friLeg, lyd: lydTil,
      klaret: klaret.slice(), tilbage: JSON.parse(JSON.stringify(tilbage)),
      lagte: lagte.map(function (d) { return { slags: d.slags, x: d.x, y: d.y, vinkel: d.vinkel }; }),
      kugle: verden ? { x: Math.round(verden.kugle.x), y: Math.round(verden.kugle.y) } : (bane ? bane.start : null),
      loest: verden ? verden.loest : false, stoppet: verden ? verden.stoppet : false,
      knap: { x: Math.round(p.knap.x), y: Math.round(p.knap.y), r: Math.round(p.knap.r) },
      hylde: hyldePladser(p).map(function (h) { return { slags: h.slags, x: Math.round(h.x), y: Math.round(h.y), tilbage: tilbage[h.slags] || 0 }; }),
      steder: (bane ? bane.loesning : []).map(function (d) { var s = tilSkaerm(p, d.x, d.y); return { slags: d.slags, vinkel: d.vinkel, x: Math.round(s.x), y: Math.round(s.y) }; })
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
