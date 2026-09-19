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

  // Alle farver kommer fra figurernes palet, saa skaerm og figurer er ét sted.
  var P = Figurer.PALET;
  var MOERK = P.moerk, KRIDT = P.kridt, ROED = P.tegl, BLAA = P.blaa, GUL = P.fersken, GROEN = P.salvieM;
  var FARVER = [P.tegl, P.blaaM, P.salvieM, P.fersken, P.trae, P.salvie];
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

  Figurer.forhent();

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

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
    var raadighed = p.knap.x - p.knap.r - 30;
    var plads = Math.min(160, raadighed / Math.max(1, slags.length));
    var start = Math.max(16, (raadighed - plads * slags.length) / 2);
    return slags.map(function (s, i) {
      return { slags: s, x: start + plads * (i + 0.5), y: p.hylde.y + p.hylde.h * 0.42,
               b: Math.min(plads, 190), str: Math.min(plads * 0.78, p.hylde.h * 0.64) };
    });
  }

  /* ---------- tegning af delene ---------- */

  /** Farven en del har, indtil dens tegning er malet faerdig foerste gang. */
  var GRUNDFARVE = { rampe: P.trae, trampolin: P.blaa, klods: P.trae, baand: P.sten, blaeser: P.blaaM, vippe: P.trae };
  function reserve(c, b, h, farve) {
    c.fillStyle = farve;
    c.beginPath(); c.roundRect(-b / 2, -h / 2, b, h, Math.min(b, h) * 0.3); c.fill();
  }

  /**
   * Tegn en del. sk er hvor stor en verdensenhed er paa skaermen, saa den
   * samme tegning kan bruges baade ude i banen og som ikon paa hylden.
   * Selve formen er SVG (se figurer.js); her drejes og sammensaettes den kun.
   */
  function tegnDel(c, slags, x, y, vinkel, sk, valg) {
    valg = valg || {};
    var s = F.DELE[slags], b = s.b * sk, h = s.h * sk;
    c.save();
    c.translate(x, y);
    if (!s.fart && !s.kraft) c.rotate(F.grader(vinkel));

    if (slags === 'baand') {
      // Baandet ligger altid vandret; stillingen siger kun, hvilken vej det koerer
      if (!Figurer.tegn(c, 'baand', 0, 0, b, h)) reserve(c, b, h, GRUNDFARVE.baand);
      var ret = vinkel === 180 ? -1 : 1;
      c.save();
      c.beginPath(); c.roundRect(-b / 2, -h / 2, b, h, h / 2); c.clip();
      var pil = h * 0.6, skridt = b / 4, rul = valg.koerer ? (tid * 1.3) % 1 : 0;
      for (var w = -1; w <= 4; w++) {
        c.save();
        c.translate(-b / 2 + (w + rul) * skridt + skridt / 2, 0);
        if (ret < 0) c.scale(-1, 1);
        Figurer.tegn(c, 'baandpil', 0, 0, pil, pil);
        c.restore();
      }
      c.restore();

    } else if (slags === 'blaeser') {
      c.rotate(F.grader(vinkel));
      if (valg.ibane) {                     // luften vises kun ude i banen, ikke paa hylden
        var vh = s.raekke * sk;
        c.save(); c.translate(0, -h / 2 - vh / 2);
        Figurer.tegn(c, 'vind', 0, 0, b * 1.6, vh);
        c.restore();
      }
      if (!Figurer.tegn(c, 'blaeserhus', 0, 0, b, h)) reserve(c, b, h, GRUNDFARVE.blaeser);
      c.save();
      c.rotate(valg.koerer ? tid * 12 : tid * 1.1);
      Figurer.tegn(c, 'blaeservinge', 0, 0, b * 0.76, h * 0.76);
      c.restore();

    } else if (slags === 'vippe') {
      // Foden staar stille; braettet tipper
      Figurer.tegn(c, 'vippefod', 0, h * 1.3, h * 2.8, h * 2.2);
      c.save();
      c.rotate(F.grader(valg.vippeVinkel || 0));
      if (!Figurer.tegn(c, 'vippebraet', 0, 0, b, h)) reserve(c, b, h, GRUNDFARVE.vippe);
      c.restore();

    } else if (slags === 'trampolin') {
      // Dugen ligger, hvor fysikken rammer; fjedrene haenger neden under
      if (!Figurer.tegn(c, 'trampolin', 0, h * 0.6, b, h * 2.2)) reserve(c, b, h, GRUNDFARVE.trampolin);

    } else if (!Figurer.tegn(c, slags, 0, 0, b, h)) {
      reserve(c, b, h, GRUNDFARVE[slags] || P.trae);
    }
    c.restore();
  }

  /* ---------- baggrund ---------- */

  var lag = document.createElement('canvas'), lagFor = '', altMalet = true;

  /** Tegn en figur og husk, om den var faerdigmalet — ellers tegnes laget igen. */
  function fig(c, navn, x, y, b, h) {
    if (!Figurer.tegn(c, navn, x, y, b, h)) altMalet = false;
  }
  function staar(c, navn, x, bund, h) {
    if (!Figurer.tegnStaaende(c, navn, x, bund, h)) altMalet = false;
  }
  /** Papirkorn: smaa prikker, tegnet én gang og lagt over med lav styrke. */
  var korn = null;
  function tegnKorn(c, B, H) {
    if (!korn) {
      korn = document.createElement('canvas'); korn.width = 160; korn.height = 160;
      var k = korn.getContext('2d');
      for (var i = 0; i < 3200; i++) {
        k.fillStyle = 'rgba(94,74,58,' + (0.02 + Math.random() * 0.05).toFixed(2) + ')';
        k.fillRect(Math.random() * 160, Math.random() * 160, 1, 1);
      }
    }
    c.save(); c.fillStyle = c.createPattern(korn, 'repeat'); c.fillRect(0, 0, B, H); c.restore();
  }
  /** Samme tal hver gang for samme bane, saa pynten ikke hopper rundt. */
  function taelling(tekst) {
    var n = 7;
    for (var i = 0; i < tekst.length; i++) n = (n * 31 + tekst.charCodeAt(i)) % 99991;
    return function () { n = (n * 1103515 + 12345) % 2147483647; return n / 2147483647; };
  }

  /** Himlen, bakkerne, pynten og banens faste bjaelker tegnes én gang. */
  function tegnLag(p) {
    var noegle = p.B + 'x' + p.H + 'x' + dpr + 'x' + (bane ? bane.navn : '') + 'x' + lagte.length;
    if (lagFor === noegle) return;
    lagFor = noegle;
    altMalet = true;
    lag.width = Math.floor(p.B * dpr); lag.height = Math.floor(p.H * dpr);
    var c = lag.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);

    // Himlen: en rolig overgang fra sart lyseblaa til creme
    var g = c.createLinearGradient(0, 0, 0, p.H);
    g.addColorStop(0, P.blaaM); g.addColorStop(0.55, P.blaa); g.addColorStop(1, P.sand);
    c.fillStyle = g; c.fillRect(0, 0, p.B, p.H);
    tegnKorn(c, p.B, p.H);

    if (!bane) return;

    // Selve banen: en bloed ler-bakke med skygge under
    c.save();
    c.shadowColor = 'rgba(107,85,68,.22)'; c.shadowBlur = 22; c.shadowOffsetY = 8;
    c.fillStyle = P.kridt;
    c.beginPath(); c.roundRect(p.ox, p.oy, p.b, p.h, 26); c.fill();
    c.restore();

    c.save();
    c.beginPath(); c.roundRect(p.ox, p.oy, p.b, p.h, 26); c.clip();

    // Luften inde i banen
    var bg = c.createLinearGradient(0, p.oy, 0, p.oy + p.h);
    bg.addColorStop(0, '#c9e2ee'); bg.addColorStop(0.7, '#eef3ec'); bg.addColorStop(1, P.kridt);
    c.fillStyle = bg; c.fillRect(p.ox, p.oy, p.b, p.h);
    // Et par bløde skyer af akvarel
    c.fillStyle = 'rgba(255,255,255,.55)';
    [[0.18, 0.14, 0.09], [0.62, 0.08, 0.12], [0.85, 0.2, 0.07]].forEach(function (sky) {
      var sx = p.ox + p.b * sky[0], sy = p.oy + p.h * sky[1], sr = p.b * sky[2];
      c.beginPath(); c.ellipse(sx, sy, sr, sr * 0.42, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(sx + sr * 0.5, sy - sr * 0.18, sr * 0.6, sr * 0.36, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(sx - sr * 0.45, sy - sr * 0.1, sr * 0.5, sr * 0.3, 0, 0, TAU); c.fill();
    });

    // To bloede bakker langs bunden
    var bund = p.oy + p.h;
    // Bakkerne males i lag med lidt gennemsigtighed, saa kanterne bliver bløde som akvarel
    c.globalAlpha = 0.8; c.fillStyle = P.salvieLys;
    c.beginPath(); c.ellipse(p.ox + p.b * 0.26, bund + p.h * 0.08, p.b * 0.46, p.h * 0.16, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(p.ox + p.b * 0.84, bund + p.h * 0.09, p.b * 0.4, p.h * 0.14, 0, 0, TAU); c.fill();
    c.fillStyle = P.salvie;
    c.beginPath(); c.ellipse(p.ox + p.b * 0.3, bund + p.h * 0.1, p.b * 0.4, p.h * 0.13, 0, 0, TAU); c.fill();
    c.beginPath(); c.ellipse(p.ox + p.b * 0.8, bund + p.h * 0.11, p.b * 0.34, p.h * 0.11, 0, 0, TAU); c.fill();
    c.fillStyle = P.salvieM;
    c.beginPath(); c.ellipse(p.ox + p.b * 0.55, bund + p.h * 0.12, p.b * 0.66, p.h * 0.11, 0, 0, TAU); c.fill();
    c.globalAlpha = 1;
    // Græsstraa langs bakkekammen
    c.strokeStyle = P.salvieDyb; c.lineWidth = Math.max(1, p.sk * 1.5); c.lineCap = 'round'; c.globalAlpha = 0.5;
    var tg = taelling(bane.navn + 'g');
    for (var gx = p.ox + 8; gx < p.ox + p.b; gx += 14 + tg() * 10) {
      var gy = bund - p.h * 0.008 - tg() * p.h * 0.02, gl = p.h * (0.015 + tg() * 0.02);
      c.beginPath(); c.moveTo(gx, gy + gl); c.quadraticCurveTo(gx + gl * 0.3, gy + gl * 0.4, gx + gl * (tg() - 0.5) * 1.2, gy - gl * 0.4); c.stroke();
    }
    c.globalAlpha = 1;

    // Pynt: traeer, buske og svampe, altid de samme steder paa den samme bane
    var t = taelling(bane.navn), h1 = p.h * 0.24;
    var maal = bane.maal ? tilSkaerm(p, bane.maal.x, bane.maal.y) : null;
    function fri(x, afstand) { return !maal || Math.abs(x - maal.x) > afstand; }   // pynt maa aldrig staa oven i klokken
    var t1 = p.ox + p.b * (0.17 + t() * 0.06), t2 = p.ox + p.b * (0.88 + t() * 0.05);
    c.globalAlpha = 0.92;
    if (fri(t1, h1 * 0.7)) staar(c, 'trae', t1, bund + p.h * 0.01, h1 * 1.1);
    if (fri(t2, h1 * 0.6)) staar(c, 'trae', t2, bund + p.h * 0.015, h1 * 0.95);
    c.globalAlpha = 1;
    var sv = p.h * 0.085;
    var s1 = p.ox + p.b * (0.2 + t() * 0.2), s2 = p.ox + p.b * (0.62 + t() * 0.2);
    if (fri(s1, sv)) staar(c, 'svamp', s1, bund + p.h * 0.005, sv);
    if (fri(s2, sv)) staar(c, 'svamp', s2, bund + p.h * 0.01, sv * 0.75);

    // Opfinderen og kaninen staar i hver sin side og ser paa
    var dyr = Math.max(48, p.h * 0.17);
    staar(c, 'pindsvin', p.ox + dyr * 0.55, bund + p.h * 0.02, dyr);
    if (fri(p.ox + p.b - dyr * 0.5, dyr)) staar(c, 'kanin', p.ox + p.b - dyr * 0.5, bund + p.h * 0.02, dyr * 0.9);

    // Murene: planker af blødt ler
    bane.mur.forEach(function (m) {
      if (m.b === undefined) return;
      var a = tilSkaerm(p, m.x, m.y);
      if (!Figurer.tegnVed(c, 'planke', a.x, a.y, m.b * p.sk, m.h * p.sk)) {
        altMalet = false;
        c.fillStyle = P.trae;
        c.beginPath(); c.roundRect(a.x, a.y, m.b * p.sk, m.h * p.sk, 10); c.fill();
      }
    });
    c.restore();

    if (!altMalet) lagFor = '';            // en tegning var ikke faerdig: proev igen naeste gang
  }

  /* ---------- kuglen, klokken, sporet ---------- */

  function tegnKugle(p, k, drej) {
    var s = tilSkaerm(p, k.x, k.y), r = k.r * p.sk;
    if (!Figurer.tegn(ctx, 'aeble', s.x, s.y, r * 2.3, r * 2.3, drej)) {
      ctx.fillStyle = P.tegl;
      ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    }
  }

  function tegnKlokke(p) {
    if (!bane.maal) return;
    var s = tilSkaerm(p, bane.maal.x, bane.maal.y), r = F.MAAL_R * p.sk;
    var ryst = klokkeRyst > 0 ? Math.sin(tid * 42) * klokkeRyst * r * 0.18 : 0;
    if (tilstand !== 'loest') {
      // En rolig ring, der aander: her skal kuglen hen
      ctx.globalAlpha = 0.45 + Math.sin(tid * 2.2) * 0.18;
      ctx.strokeStyle = P.ferskenM; ctx.lineWidth = Math.max(5, 9 * p.sk);
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 1.5, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (!Figurer.tegn(ctx, 'klokke', s.x + ryst, s.y - r * 0.1, r * 2.6, r * 2.6)) {
      ctx.fillStyle = P.sand;
      ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.8, Math.PI, 0); ctx.fill();
    }
    if (klokkeRyst > 0) {
      ctx.strokeStyle = P.ferskenM; ctx.lineWidth = Math.max(3, 4 * p.sk);
      ctx.globalAlpha = klokkeRyst * 0.8;
      for (var i = 1; i <= 3; i++) { ctx.beginPath(); ctx.arc(s.x, s.y, r * (1 + i * 0.4) + (1 - klokkeRyst) * 40, -2.4, -0.7); ctx.stroke(); }
      ctx.globalAlpha = 1;
    }
  }

  /** Sporet efter kuglen: en stiplet vej, saa man kan se, hvad der skete. */
  function tegnSpor(p) {
    if (spor.length < 2) return;
    ctx.strokeStyle = 'rgba(201,119,95,.4)';
    ctx.lineWidth = Math.max(3, 4 * p.sk); ctx.lineCap = 'round';
    ctx.setLineDash([1, 9 * p.sk]);
    ctx.beginPath();
    spor.forEach(function (s, i) { var a = tilSkaerm(p, s.x, s.y); if (i) ctx.lineTo(a.x, a.y); else ctx.moveTo(a.x, a.y); });
    ctx.stroke();
    ctx.setLineDash([]);
  }

  /* ---------- hylden og knappen ---------- */

  function tegnHylde(p) {
    var h = p.hylde;
    // Hylden: en bloed ler-bakke, der ligger foran banen
    ctx.save();
    ctx.shadowColor = 'rgba(107,85,68,.28)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = -6;
    ctx.fillStyle = P.sandM;
    ctx.beginPath(); ctx.roundRect(-20, h.y, p.B + 40, h.h + 40, 28); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(94,74,58,.18)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, h.y + 3); ctx.lineTo(p.B, h.y + 3); ctx.stroke();

    hyldePladser(p).forEach(function (hp) {
      var n = tilbage[hp.slags] || 0;
      // Pladsen: en bloed fordybning, saa man kan se, hvor delene ligger
      var sy = h.y + h.h * 0.1, sh = h.h * 0.64;
      ctx.fillStyle = 'rgba(94,74,58,.13)';
      ctx.beginPath(); ctx.roundRect(hp.x - hp.b * 0.46, sy, hp.b * 0.92, sh, sh * 0.3); ctx.fill();
      ctx.strokeStyle = 'rgba(94,74,58,.16)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.roundRect(hp.x - hp.b * 0.46 + 1, sy + 1, hp.b * 0.92 - 2, sh - 2, sh * 0.3); ctx.stroke();
      ctx.globalAlpha = n > 0 ? 1 : 0.3;
      var sk = hp.str / Math.max(F.DELE[hp.slags].b, F.DELE[hp.slags].h);
      tegnDel(ctx, hp.slags, hp.x, hp.y, F.DELE[hp.slags].vinkler[0], sk, {});
      // Hvor mange der er tilbage: prikker, ikke tal
      var pr = Math.min(9, hp.b * 0.09), py = p.hylde.y + p.hylde.h * 0.82;
      for (var i = 0; i < n; i++) {
        var px = hp.x + (i - (n - 1) / 2) * pr * 2.5;
        if (!Figurer.tegn(ctx, 'prik', px, py, pr * 2, pr * 2)) {
          ctx.fillStyle = P.salvieM; ctx.beginPath(); ctx.arc(px, py, pr, 0, TAU); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    });

    // Den store knap: groen trekant naar man bygger, fersken pil naar maskinen koerer
    var k = p.knap, navn = tilstand === 'koerer' ? 'knapigen' : 'knapstart';
    if (!Figurer.tegn(ctx, navn, k.x, k.y, k.r * 2.3, k.r * 2.3)) {
      ctx.fillStyle = tilstand === 'koerer' ? P.fersken : P.salvieM;
      ctx.beginPath(); ctx.arc(k.x, k.y, k.r, 0, TAU); ctx.fill();
    }
  }

  /** Taelleren: én prik pr. bane, de klarede i groent. */
  function tegnFremskridt(p) {
    if (friLeg) return;
    var n = F.BANER.length, afstand = Math.min(26, (p.B - 260) / n), r = Math.min(9, afstand * 0.36);
    var bred = (n - 1) * afstand + r * 2 + 26;
    ctx.save();
    ctx.shadowColor = 'rgba(107,85,68,.22)'; ctx.shadowBlur = 12; ctx.shadowOffsetY = 4;
    ctx.fillStyle = P.kridt;
    ctx.beginPath(); ctx.roundRect(p.B / 2 - bred / 2, 18 - r - 9, bred, r * 2 + 18, r + 9); ctx.fill();
    ctx.restore();
    for (var i = 0; i < n; i++) {
      var x = p.B / 2 + (i - (n - 1) / 2) * afstand;
      var str = (i === baneNr ? r * 2.5 : r * 2);
      var navn = klaret[i] ? 'prik' : (i === baneNr ? 'prikgul' : 'prikgraa');
      if (!Figurer.tegn(ctx, navn, x, 18, str, str)) {
        ctx.fillStyle = klaret[i] ? P.salvieM : (i === baneNr ? P.fersken : P.sand);
        ctx.beginPath(); ctx.arc(x, 18, str / 2, 0, TAU); ctx.fill();
      }
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
        puf(s.x, s.y, P.sandM, 3, 90 * st.styrke + 20, 3, 0.4);
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
    puf(s.x, s.y, P.ferskenM, 34, 320, 6, 1.2);
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
      ctx.strokeStyle = 'rgba(155,187,144,.7)'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.setLineDash([1, 8]);
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

  // De faelles menu-ikoner tegnes med haard sort streg. Her i ler-verdenen
  // byttes de to farver ud, saa pil og klokke faar samme varme brune streg som
  // resten. Ikonerne selv er de samme som i de andre spil.
  var IKONFARVER = { '#12261f': P.moerk, '#f7f3e8': P.kridt, '#4cb944': P.salvieM, '#ffd23f': P.fersken,
                     '#e8442e': P.tegl, '#3aa7e0': P.blaaM, '#8a8f97': P.stenM, '#f9d7b5': P.ferskenLys };
  function visOverlay(html) {
    overlay.innerHTML = html.replace(/#[0-9a-f]{6}/g, function (f) { return IKONFARVER[f] || f; });
    overlay.hidden = false;
  }
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
      // Samme ler-verden i lille: himmel, bakke, planker, aeble og klokke
      var g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, P.blaaLys); g.addColorStop(1, P.kridt);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = P.salvieLys;
      c.beginPath(); c.ellipse(w * 0.4, h * 1.02, w * 0.5, h * 0.16, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(w * 0.85, h * 1.04, w * 0.35, h * 0.13, 0, 0, TAU); c.fill();
      b.mur.forEach(function (m) {
        if (m.b === undefined) return;
        c.fillStyle = P.traeM;
        c.beginPath(); c.roundRect(ox + m.x * sk, oy + m.y * sk + 1, m.b * sk, m.h * sk, 3); c.fill();
        c.fillStyle = P.trae;
        c.beginPath(); c.roundRect(ox + m.x * sk, oy + m.y * sk, m.b * sk, Math.max(1, m.h * sk - 1.5), 3); c.fill();
      });
      c.fillStyle = P.tegl;
      c.beginPath(); c.arc(ox + b.start.x * sk, oy + b.start.y * sk, Math.max(3, F.KUGLE_R * sk), 0, TAU); c.fill();
      c.fillStyle = P.sand;
      c.beginPath(); c.arc(ox + b.maal.x * sk, oy + b.maal.y * sk, Math.max(4, F.MAAL_R * sk * 0.7), 0, TAU); c.fill();
      c.fillStyle = 'rgba(255,255,255,.45)';
      c.beginPath(); c.arc(ox + b.maal.x * sk - 1, oy + b.maal.y * sk - 1.5, Math.max(2, F.MAAL_R * sk * 0.35), 0, TAU); c.fill();
      // Klaret: en groen prik i hjoernet
      if (klaret[parseInt(cv.dataset.bane, 10)]) {
        c.fillStyle = P.salvieM; c.beginPath(); c.arc(w - 13, 13, 10, 0, TAU); c.fill();
        c.strokeStyle = P.kridt; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round';
        c.beginPath(); c.moveTo(w - 18, 13); c.lineTo(w - 14.5, 16.5); c.lineTo(w - 8, 9); c.stroke();
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
