/**
 * Klokken: rummusen, der laerer, hvordan uret virker.
 *
 * Tre lege. Planeturet: musen siger en tid, og barnet traekker viserne paa den
 * store planet, til uret staar rigtigt; saa flyver raketten til naeste planet.
 * Musens dag: uret viser en tid, himlen viser sol eller maane, og barnet vaelger
 * kortet med det, musen goer nu. Jorden drejer: barnet drejer jorden med
 * fingeren, huset gaar fra dag til nat, og uret nedenunder foelger med.
 *
 * Viserne haenger sammen som paa et rigtigt ur, og begge er der altid: klokken
 * 3 er den roede paa 3 og den blaa paa 12. Ingen tid, ingen fejl: staar uret
 * forkert, blinker det rigtige tal, og musen siger "Naesten!".
 *
 * Denne fil er kun skaerm og lyd. Tider, laasning af viserne, opgaver og dagens
 * goeremaal ligger i js/ur.js, som testes i Node.
 */
(function () {
  'use strict';

  var U = Ur;

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
  var PLANETER = ['#e8442e', '#ff8c42', '#4cb944', '#9b5de5', '#3aa7e0', '#f28cb1', '#ffd23f', '#5bd1c9'];
  var HIMMEL = { nat: ['#0b1030', '#1a2350'], morgen: ['#ffb37a', '#ffe0b8'], dag: ['#5cc1f5', '#b9e6ff'], aften: ['#f07f5a', '#ffc38a'] };
  var STI = '../../assets/noto/';
  var TAU = Math.PI * 2;

  var leg = 'stil';             // stil | dag | sol
  var svaerhed = 0;
  var lydTil = true;
  var antalSpillere = 1;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var rejse = null;
  var visning = [];             // pr. station: animationer og det barnet ser
  var tilstand = 'venter';      // venter | spiller | faerdig
  var sidsteTid = 0, tid = 0;
  var lyd = null;
  var partikler = [];
  var vinderCanvas = null, konfetti = [], besoegt = [];
  var dpr = 1;
  // Jorden drejer: husets vinkel paa skaermen (0 = mod solen). Starter klokken 7 om morgenen.
  var sol = { vinkel: U.doegnTilVinkel(7 * 60), roert: false, sidsteGoeremaal: null };

  var ALLE = ['mus', 'jord', 'sol', 'maane'].concat(U.DAGEN.map(function (d) { return d.kort; })).map(function (n) { return STI + n + '.svg'; });
  Sprites.forhent(ALLE);
  var RAKET = '../../assets/kenney/raket.png';
  Sprites.forhent([RAKET]);
  function billede(navn) { return Sprites.hent(STI + navn + '.svg'); }
  function tegnBillede(navn, x, y, str, vinkel, c) {
    c = c || ctx;
    var img = navn === 'raket' ? Sprites.hent(RAKET) : billede(navn);
    if (!Sprites.klar(img)) return false;
    c.save();
    c.translate(x, y);
    if (vinkel) c.rotate(vinkel);
    c.drawImage(img, -str / 2, -str / 2, str, str);
    c.restore();
    return true;
  }

  /* ---------- lyd og stemme ---------- */

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
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination);
      o.start();
      o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }

  /** Susen fra raketten. */
  function syd(længde) {
    if (!lydTil) return;
    try {
      var k = lydKontekst(), n = Math.floor(k.sampleRate * længde);
      var buf = k.createBuffer(1, n, k.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n) * (i / n < 0.2 ? i / n / 0.2 : 1);
      var kilde = k.createBufferSource(), f = k.createBiquadFilter(), g = k.createGain();
      f.type = 'lowpass'; f.frequency.value = 900; g.gain.value = 0.18;
      kilde.buffer = buf; kilde.connect(f).connect(g).connect(k.destination); kilde.start();
    } catch (e) { /* lyd er pynt */ }
  }

  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum); });
  }
  /** Et lille tik, naar viseren laaser paa et tal. */
  function tik() { tone(1500, 0.035, 0.07, 'square'); }

  // Stemme: rigtige klip hvis de staar i lyd/klip.json, ellers enhedens egen talesyntese (kun lokale stemmer)
  var stemme = null, klipFindes = {}, buffere = {}, aktiveKlip = [], talerTil = 0;
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
  function hentKlip(fil) {
    if (!buffere[fil]) {
      buffere[fil] = fetch('lyd/' + fil).then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    return buffere[fil];
  }
  function stopTale() {
    aktiveKlip.forEach(function (k) { try { k.stop(); } catch (e) { /* stoppet */ } });
    aktiveKlip = [];
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  /**
   * Flere klip lige efter hinanden: "Stil uret paa" + "klokken tre". Mangler et af
   * dem, siger enhedens stemme hele reserveteksten.
   */
  function afspilRaekke(filer, reserveTekst, varighed) {
    if (!lydTil) return;
    talerTil = tid + (varighed || 2.5);
    if (!filer.every(function (f) { return klipFindes[f]; })) { stopTale(); sig(reserveTekst); return; }
    Promise.all(filer.map(hentKlip)).then(function (bufs) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      stopTale();
      bufs.forEach(function (buf) {
        var kilde = k.createBufferSource();
        kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start);
        start += buf.duration - 0.03;
        aktiveKlip.push(kilde);
      });
      talerTil = tid + (start - k.currentTime) + 0.2;
    }).catch(function () { sig(reserveTekst); });
  }
  function afspil(fil, reserveTekst, varighed) { afspilRaekke([fil], reserveTekst, varighed); }

  var FLOT = [['flot_1.mp3', 'Flot!'], ['flot_2.mp3', 'Sådan!'], ['flot_3.mp3', 'Rigtigt!']];
  function sigFlot() { var f = FLOT[Math.floor(Math.random() * FLOT.length)]; afspil(f[0], f[1], 1.2); }
  function stort(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Musen siger opgaven: "Stil uret paa klokken tre" eller "Hvad goer musen klokken syv om morgenen?" */
  function sigOpgave(i) {
    var s = rejse.stationer[i], o = s.opgave;
    if (!o) return;
    if (rejse.leg === 'stil') afspilRaekke(['stil_uret.mp3', o.klip], 'Stil uret på ' + o.tekst + '.', 2.6);
    else afspilRaekke(['hvad_goer.mp3', o.klip, 'om_' + o.himmel + '.mp3'], 'Hvad gør musen ' + o.tekst + ' ' + U.HIMMELORD[o.himmel] + '?', 3.4);
  }
  /** Tiden paa uret, som paa jorden: "klokken syv om morgenen". */
  function sigDoegn(doegn) {
    var t = U.doegnTilUr(doegn), h = U.himmel(doegn);
    afspilRaekke([U.klip(t), 'om_' + h + '.mp3'], stort(U.tekst(t)) + ' ' + U.HIMMELORD[h] + '.', 2.4);
  }

  /* ---------- laerred, baggrund og plan ---------- */

  var lag = document.createElement('canvas');     // rummet med stjerner, tegnet én gang
  var lagFor = '';
  var stjerner = [];
  for (var si = 0; si < 90; si++) stjerner.push({ x: Math.random(), y: Math.random(), r: 0.6 + Math.random() * 1.6, blink: Math.random() * TAU });

  function tilpasStørrelse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lagFor = '';
  }

  function tegnLag() {
    var B = window.innerWidth, H = window.innerHeight;
    var noegle = B + 'x' + H + 'x' + dpr;
    if (lagFor === noegle) return;
    lagFor = noegle;
    lag.width = Math.floor(B * dpr); lag.height = Math.floor(H * dpr);
    var c = lag.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#1e2a5e');
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    // En blid taage af lys nederst
    var t = c.createRadialGradient(B * 0.5, H * 1.1, 10, B * 0.5, H * 1.1, B * 0.7);
    t.addColorStop(0, 'rgba(120,90,200,.25)'); t.addColorStop(1, 'rgba(120,90,200,0)');
    c.fillStyle = t; c.fillRect(0, 0, B, H);
    c.fillStyle = '#fff';
    stjerner.forEach(function (s) { c.globalAlpha = 0.5 + Math.sin(s.blink) * 0.3; c.beginPath(); c.arc(s.x * B, s.y * H, s.r, 0, TAU); c.fill(); });
    c.globalAlpha = 1;
  }

  /** Hvor tingene staar i en station. Alt regnes ud fra skaermen, saa det passer paa iPad og iPhone. */
  function plan(i) {
    var B = window.innerWidth, H = window.innerHeight;
    var n = rejse ? rejse.stationer.length : 1;
    var sw = B / n, x0 = i * sw;
    var luft = i === 0 ? Math.min(48, sw * 0.08) : 0;        // plads til hjem-knappen
    var musStr = Math.min(sw * 0.17, H * 0.19);
    var top = Math.max(H * 0.055, 46);                       // under taelleren oeverst
    var mus = { x: x0 + luft + sw * 0.03 + musStr / 2, y: top + H * 0.025 + musStr / 2, str: musStr };
    var bh = Math.min(H * 0.2, musStr * 1.05);
    // Boblen er kun saa bred som indholdet: lille ur og hoejttaler, eller sol, spoergsmaalstegn og hoejttaler
    var indhold = !rejse || rejse.leg === 'stil' ? (rejse && !rejse.visUr ? 1.6 : 2.9) : 2.6;
    var boble = { x: mus.x + musStr * 0.62, y: top, b: Math.min(x0 + sw * 0.97 - (mus.x + musStr * 0.62), bh * indhold), h: bh };
    var p = { x0: x0, sw: sw, mus: mus, boble: boble, kort: [] };
    if (!rejse || rejse.leg === 'stil') {
      p.ur = { cx: x0 + sw / 2, cy: H * 0.615, r: Math.min(sw * 0.33, H * 0.29) };
    } else if (sw >= 640) {
      // Uret til venstre, kortene i et gitter til hoejre
      p.ur = { cx: x0 + sw * 0.29, cy: H * 0.62, r: Math.min(sw * 0.2, H * 0.26) };
      var ax = p.ur.cx + p.ur.r * 1.35, ab = x0 + sw * 0.97 - ax, ay = H * 0.32, ah = H * 0.6;
      var antal = rejse.stationer[i].opgave ? rejse.stationer[i].opgave.kortene.length : 4;
      var kol = 2, rk = Math.ceil(antal / kol), mellem = 14;
      var str = Math.min((ab - mellem) / kol, (ah - mellem * (rk - 1)) / rk, H * 0.3);
      var gb = kol * str + mellem, gh = rk * str + mellem * (rk - 1);
      for (var k = 0; k < antal; k++) p.kort.push({ x: ax + ab / 2 - gb / 2 + (k % kol) * (str + mellem) + str / 2, y: ay + ah / 2 - gh / 2 + Math.floor(k / kol) * (str + mellem) + str / 2, str: str });
    } else {
      // Smal: uret oeverst, kortene i en raekke nederst
      p.ur = { cx: x0 + sw / 2, cy: H * 0.47, r: Math.min(sw * 0.26, H * 0.2) };
      var antal2 = rejse.stationer[i].opgave ? rejse.stationer[i].opgave.kortene.length : 4;
      var str2 = Math.min((sw * 0.92 - 10 * (antal2 - 1)) / antal2, H * 0.22);
      for (var q = 0; q < antal2; q++) p.kort.push({ x: x0 + sw / 2 + (q - (antal2 - 1) / 2) * (str2 + 10), y: H * 0.84, str: str2 });
    }
    return p;
  }

  /** Jorden drejer: jorden i midten, solen til hoejre, maanen til venstre, uret nederst til venstre. */
  function planSol() {
    var B = window.innerWidth, H = window.innerHeight;
    var jr = Math.min(B * 0.19, H * 0.27);
    return {
      jord: { cx: B * 0.47, cy: H * 0.43, r: jr },
      sol: { x: B * 0.88, y: H * 0.17, r: Math.min(B * 0.06, H * 0.09) },
      maane: { x: B * 0.1, y: H * 0.18, r: Math.min(B * 0.035, H * 0.05) },
      ur: { cx: Math.max(B * 0.17, 110), cy: H * 0.76, r: Math.min(B * 0.11, H * 0.17) },
      mus: { x: B * 0.86, y: H * 0.76, str: Math.min(B * 0.14, H * 0.2) }
    };
  }

  /* ---------- tegning: ur, planet, mus ---------- */

  function rr(c, x, y, b, h, r, fyld, streg, lw) {
    c.beginPath(); c.roundRect(x, y, b, h, r);
    if (fyld) { c.fillStyle = fyld; c.fill(); }
    if (streg) { c.strokeStyle = streg; c.lineWidth = lw || 3; c.stroke(); }
  }
  function spids(cx, cy, vinkel, laengde) { return { x: cx + Math.sin(vinkel) * laengde, y: cy - Math.cos(vinkel) * laengde }; }
  /** Vinkel fra klokken 12 og med uret, til fingeren. */
  function vinkelTil(cx, cy, x, y) { var a = Math.atan2(x - cx, -(y - cy)); return a < 0 ? a + TAU : a; }

  /**
   * Urskiven med begge visere. Den roede (kort, tyk) er timerne, den blaa (lang,
   * tynd) er minutterne. Tallene 1-12 staar paa skiven, ingen streger at taelle.
   * fremhaev: hvilken viser fingeren holder. hint: et tal, der blinker gult.
   */
  function tegnUr(c, cx, cy, r, t, valg) {
    valg = valg || {};
    c.save();
    // Skygge og skive
    c.fillStyle = 'rgba(0,0,0,.25)'; c.beginPath(); c.arc(cx + r * 0.04, cy + r * 0.06, r, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(3, r * 0.045); c.strokeStyle = MOERK; c.stroke();
    if (valg.glow > 0) { c.globalAlpha = valg.glow; c.lineWidth = r * 0.12; c.strokeStyle = GROEN; c.beginPath(); c.arc(cx, cy, r * 1.02, 0, TAU); c.stroke(); c.globalAlpha = 1; }
    // Smaa maerker for minutterne, lidt stoerre paa hver time
    for (var m = 0; m < 60; m++) {
      var v = m / 60 * TAU, ydre = spids(cx, cy, v, r * 0.95), indre = spids(cx, cy, v, r * (m % 5 ? 0.91 : 0.87));
      c.strokeStyle = m % 5 ? 'rgba(18,38,31,.35)' : MOERK; c.lineWidth = m % 5 ? Math.max(1, r * 0.012) : Math.max(2, r * 0.03);
      c.beginPath(); c.moveTo(ydre.x, ydre.y); c.lineTo(indre.x, indre.y); c.stroke();
    }
    // Tallene
    c.font = '800 ' + Math.round(r * 0.2) + 'px ui-rounded, system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var h = 1; h <= 12; h++) {
      var pos = spids(cx, cy, h / 12 * TAU, r * 0.78);
      if (valg.hint === h) {
        c.fillStyle = GUL; c.globalAlpha = 0.55 + Math.sin(tid * 6) * 0.35; c.beginPath(); c.arc(pos.x, pos.y, r * 0.15, 0, TAU); c.fill(); c.globalAlpha = 1;
      }
      c.fillStyle = MOERK; c.fillText(String(h), pos.x, pos.y + r * 0.01);
    }
    // Viserne: foerst den roede timeviser, saa den blaa minutviser ovenpaa
    var tv = U.timeVinkel(t), mv = U.minutVinkel(t);
    viser(c, cx, cy, tv, r * 0.4, r * 0.085, ROED, valg.fremhaev === 'time', r);
    viser(c, cx, cy, mv, r * 0.6, r * 0.055, BLAA, valg.fremhaev === 'minut', r);
    // Midten
    c.fillStyle = MOERK; c.beginPath(); c.arc(cx, cy, r * 0.06, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r * 0.025, 0, TAU); c.fill();
    c.restore();
  }
  function viser(c, cx, cy, vinkel, laengde, bredde, farve, holdt, r) {
    var sp = spids(cx, cy, vinkel, laengde), hale = spids(cx, cy, vinkel + Math.PI, laengde * 0.16);
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (holdt) { c.strokeStyle = 'rgba(255,210,63,.55)'; c.lineWidth = bredde * 2.6; c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke(); }
    c.strokeStyle = MOERK; c.lineWidth = bredde + Math.max(2, r * 0.022); c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke();
    c.strokeStyle = farve; c.lineWidth = bredde; c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke();
    // En rund knop paa spidsen, saa der er noget at tage fat i
    c.fillStyle = farve; c.beginPath(); c.arc(sp.x, sp.y, bredde * 0.95, 0, TAU); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.02); c.stroke();
  }

  /** Planeten bag uret: en farvet kugle med kratere og somme tider en ring. */
  function tegnPlanet(c, cx, cy, r, farve, nr, skala) {
    skala = skala === undefined ? 1 : skala;
    if (skala <= 0) return;
    c.save(); c.translate(cx, cy); c.scale(skala, skala); c.translate(-cx, -cy);
    var pr = r * 1.2;
    if (nr % 3 === 1) {
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = r * 0.09;
      c.beginPath(); c.ellipse(cx, cy, pr * 1.55, pr * 0.42, -0.25, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    }
    var g = c.createRadialGradient(cx - pr * 0.35, cy - pr * 0.4, pr * 0.1, cx, cy, pr);
    g.addColorStop(0, lysere(farve, 0.35)); g.addColorStop(0.7, farve); g.addColorStop(1, moerkere(farve, 0.35));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, pr, 0, TAU); c.fill();
    c.lineWidth = Math.max(3, r * 0.04); c.strokeStyle = MOERK; c.stroke();
    // Kratere i randen uden om urskiven
    c.fillStyle = 'rgba(18,38,31,.16)';
    [[0.4, 1.09, 0.05], [1.9, 1.1, 0.04], [3.3, 1.08, 0.06], [4.6, 1.11, 0.035], [5.6, 1.1, 0.045]].forEach(function (k) {
      var p = spids(cx, cy, k[0] + nr, r * k[1]); c.beginPath(); c.arc(p.x, p.y, r * k[2], 0, TAU); c.fill();
    });
    if (nr % 3 === 1) {
      c.strokeStyle = 'rgba(255,255,255,.75)'; c.lineWidth = r * 0.09;
      c.beginPath(); c.ellipse(cx, cy, pr * 1.55, pr * 0.42, -0.25, -0.05, Math.PI * 0.95); c.stroke();
    }
    c.restore();
  }
  function lysere(hex, k) { return bland(hex, [255, 255, 255], k); }
  function moerkere(hex, k) { return bland(hex, [18, 38, 31], k); }
  function bland(hex, mod, k) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + Math.round(r + (mod[0] - r) * k) + ',' + Math.round(g + (mod[1] - g) * k) + ',' + Math.round(b + (mod[2] - b) * k) + ')';
  }

  /** Rummusen: Noto-musen i en glashjelm med krave. */
  function tegnMus(c, x, y, str, hop) {
    hop = hop || 0;
    c.save();
    c.translate(0, -hop);
    // Krave
    rr(c, x - str * 0.36, y + str * 0.42, str * 0.72, str * 0.22, str * 0.1, '#c9d1dc', MOERK, Math.max(2, str * 0.03));
    rr(c, x - str * 0.14, y + str * 0.47, str * 0.28, str * 0.1, str * 0.05, '#e8442e', MOERK, 2);
    tegnBillede('mus', x, y + str * 0.02, str * 0.72, 0, c);
    // Hjelm: glas med et lysskaer
    c.beginPath(); c.arc(x, y, str * 0.5, 0, TAU);
    c.fillStyle = 'rgba(190,230,255,.22)'; c.fill();
    c.lineWidth = Math.max(3, str * 0.04); c.strokeStyle = MOERK; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = Math.max(2, str * 0.035); c.lineCap = 'round';
    c.beginPath(); c.arc(x, y, str * 0.4, -Math.PI * 0.85, -Math.PI * 0.55); c.stroke();
    c.restore();
  }

  /** Solen: en gul kugle med straaler, der drejer langsomt. */
  function tegnSol(c, x, y, r, t) {
    c.save();
    c.translate(x, y); c.rotate(t * 0.15);
    c.strokeStyle = GUL; c.lineWidth = Math.max(3, r * 0.14); c.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var v = i / 12 * TAU, l = r * (i % 2 ? 1.55 : 1.8);
      c.beginPath(); c.moveTo(Math.cos(v) * r * 1.25, Math.sin(v) * r * 1.25); c.lineTo(Math.cos(v) * l, Math.sin(v) * l); c.stroke();
    }
    c.rotate(-t * 0.15);
    var g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fff3b0'); g.addColorStop(1, '#ffb13d');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(3, r * 0.08); c.strokeStyle = MOERK; c.stroke();
    // Et venligt ansigt
    c.fillStyle = MOERK; c.beginPath(); c.arc(-r * 0.3, -r * 0.15, r * 0.08, 0, TAU); c.arc(r * 0.3, -r * 0.15, r * 0.08, 0, TAU); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.07); c.beginPath(); c.arc(0, r * 0.1, r * 0.35, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    c.restore();
  }
  /** Maanen: en lys skive med en moerk skygge, saa den bliver et segl. */
  function tegnMaane(c, x, y, r) {
    c.save();
    c.fillStyle = '#f2f0dc'; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, r * 0.08); c.strokeStyle = MOERK; c.stroke();
    c.fillStyle = 'rgba(18,38,31,.18)'; [[-0.3, 0.1, 0.22], [0.25, -0.35, 0.14], [0.3, 0.35, 0.16]].forEach(function (k) { c.beginPath(); c.arc(x + r * k[0], y + r * k[1], r * k[2], 0, TAU); c.fill(); });
    c.restore();
  }
  /** Sol eller maane som lille maerke ved uret: viser om det er dag eller nat. */
  function tegnHimmelMaerke(c, x, y, r, himmel) {
    if (himmel === 'nat') tegnMaane(c, x, y, r);
    else tegnSol(c, x, y, r * 0.65, tid);
    if (himmel === 'morgen' || himmel === 'aften') {
      // En lille horisont under solen: den er lavt paa himlen
      c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.1); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 1.5, y + r * 1.15); c.lineTo(x + r * 1.5, y + r * 1.15); c.stroke();
    }
  }

  /* ---------- Planeturet og Musens dag ---------- */

  function nyVisning() {
    return { ind: 0, raket: null, glow: 0, ryst: null, hint: false, sigTid: tid + 0.9, holdt: null, hop: 0, frossen: null, bobleInd: 0 };
  }

  function nyRejse(spillere) {
    antalSpillere = spillere;
    rejse = U.nyRejse(spillere, svaerhed, leg);
    visning = rejse.stationer.map(function () { return nyVisning(); });
    besoegt = [];
    partikler = [];
    tilstand = 'spiller';
    stopTale();
  }

  function planetFarve(s) { return PLANETER[s.planet % PLANETER.length]; }

  /** Uret staar rigtigt, eller det rigtige kort er fundet: fest, og raketten flyver videre. */
  function loest(i, ventTid) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i);
    v.frossen = { t: s.ur.t, planet: s.planet, kort: s.opgave ? s.opgave.kort : null, kortene: s.opgave ? s.opgave.kortene : [] };
    besoegt.push(planetFarve(s));
    v.glow = 1;
    puf(p.ur.cx, p.ur.cy - p.ur.r * 0.5, GUL, 26, 260, 7, 1.1);
    melodi([660, 880, 1100], 90);
    v.raket = { t: -(ventTid || 0.9) };
    v.holdt = null;
    Object.keys(fingre).forEach(function (id) { if (fingre[id].i === i) delete fingre[id]; });
  }

  function opdater(dt) {
    opdaterPartikler(dt);
    if (!rejse) return;
    rejse.stationer.forEach(function (s, i) {
      var v = visning[i], p = plan(i);
      v.ind = Math.min(1, v.ind + dt * 1.8);
      v.bobleInd = Math.min(1, v.bobleInd + dt * 3);
      v.glow = Math.max(0, v.glow - dt * 0.9);
      v.hop = Math.max(0, v.hop - dt * 60);
      if (v.ryst && tid > v.ryst.til) v.ryst = null;
      if (v.raket) {
        v.raket.t += dt;
        if (v.raket.t > 0 && !v.raket.startet) { v.raket.startet = true; syd(0.9); }
        if (v.raket.t > 0.35 && v.raket.t < 0.9) puf(p.ur.cx + (v.raket.t - 0.2) * p.sw * 0.9 - p.ur.r * 0.3, p.ur.cy - p.ur.r * 0.9 + (v.raket.t - 0.2) * 40, '#ff8c42', 1, 60, 5, 0.5);
        if (v.raket.t > 1.15) {
          v.raket = null; v.frossen = null; v.ind = 0; v.bobleInd = 0; v.hint = false;
          if (rejse.faerdig) { afslut(); return; }
          v.sigTid = tid + 0.5;
        }
      }
      if (v.sigTid && tid >= v.sigTid && s.opgave && !rejse.faerdig) { v.sigTid = 0; v.hop = 10; sigOpgave(i); }
    });
  }

  function tegnStation(i) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i);
    var t = v.frossen ? v.frossen.t : s.ur.t;
    var planet = v.frossen ? v.frossen.planet : s.planet;
    var opgave = s.opgave;
    var himmel = rejse.leg === 'dag' && opgave ? opgave.himmel : null;
    // Planeten kommer ind ved at vokse; uret ovenpaa
    var skala = v.raket && v.raket.t > 0 ? Math.max(0, 1 - v.raket.t * 1.6) : 0.6 + 0.4 * (1 - Math.pow(1 - v.ind, 3));
    var farve = himmel ? HIMMEL[himmel][0] : PLANETER[planet % PLANETER.length];
    tegnPlanet(ctx, p.ur.cx, p.ur.cy, p.ur.r, farve, planet, skala);
    if (skala > 0.05) {
      ctx.save(); ctx.translate(p.ur.cx, p.ur.cy); ctx.scale(skala, skala); ctx.translate(-p.ur.cx, -p.ur.cy);
      var hint = null;
      if (rejse.leg === 'stil' && opgave && v.hint && !v.frossen) hint = U.time(opgave.t);
      tegnUr(ctx, p.ur.cx, p.ur.cy, p.ur.r, t, { fremhaev: v.holdt, hint: hint, glow: v.glow });
      if (himmel) tegnHimmelMaerke(ctx, p.ur.cx + p.ur.r * 0.95, p.ur.cy - p.ur.r * 0.95, p.ur.r * 0.19, himmel);
      ctx.restore();
    }
    // Raketten flyver til hoejre og ud
    if (v.raket && v.raket.t > 0) {
      var rt = v.raket.t, rx = p.ur.cx + rt * p.sw * 0.9, ry = p.ur.cy - p.ur.r * 0.9 - Math.sin(rt * 2) * 30;
      if (!tegnBillede('raket', rx, ry, p.ur.r * 0.6, Math.PI / 2 + 0.15)) {
        ctx.fillStyle = KRIDT; ctx.beginPath(); ctx.ellipse(rx, ry, p.ur.r * 0.28, p.ur.r * 0.12, 0.15, 0, TAU); ctx.fill(); ctx.strokeStyle = MOERK; ctx.lineWidth = 3; ctx.stroke();
      }
    }
    // Kortene i Musens dag
    if (rejse.leg === 'dag') {
      var kortene = v.frossen ? v.frossen.kortene : (opgave ? opgave.kortene : []);
      kortene.forEach(function (kort, k) {
        var pk = p.kort[k]; if (!pk) return;
        var dx = v.ryst && v.ryst.kort === kort ? Math.sin(tid * 45) * 6 : 0;
        var rigtigt = v.frossen && v.frossen.kort === kort;
        var fremhaev = (v.hint && opgave && opgave.kort === kort && !v.frossen) || rigtigt;
        var sk = v.frossen && !rigtigt ? 0.85 : 1;
        var str = pk.str * sk;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(pk.x - str / 2 + 4 + dx, pk.y - str / 2 + 6, str, str, str * 0.16); ctx.fill();
        rr(ctx, pk.x - str / 2 + dx, pk.y - str / 2, str, str, str * 0.16, rigtigt ? GROEN : (fremhaev ? GUL : KRIDT), MOERK, Math.max(3, str * 0.035));
        if (fremhaev && !rigtigt) { ctx.globalAlpha = 0.5 + Math.sin(tid * 6) * 0.3; rr(ctx, pk.x - str / 2 + dx, pk.y - str / 2, str, str, str * 0.16, null, GUL, str * 0.07); ctx.globalAlpha = 1; }
        tegnBillede(kort, pk.x + dx, pk.y, str * 0.68);
      });
    }
    // Musen og boblen
    tegnMus(ctx, p.mus.x, p.mus.y, p.mus.str, v.hop);
    if (opgave && !v.frossen && v.ind > 0.5) tegnBoble(p, s, v);
  }

  /** Boblen ved musen: det lille ur (1 og 2 stjerner) og en hoejttaler, man kan trykke paa. */
  function tegnBoble(p, s, v) {
    var b = p.boble, o = s.opgave, sk = 0.6 + 0.4 * (1 - Math.pow(1 - v.bobleInd, 3));
    ctx.save();
    ctx.translate(b.x, b.y + b.h / 2); ctx.scale(sk, sk); ctx.translate(-b.x, -(b.y + b.h / 2));
    var rad = Math.min(22, b.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 7, b.b, b.h, rad); ctx.fill();
    rr(ctx, b.x, b.y, b.b, b.h, rad, '#fff', MOERK, 4);
    // Spidsen mod musen
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.35); ctx.lineTo(b.x - b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + 2, b.y + b.h * 0.65); ctx.fill();
    ctx.strokeStyle = MOERK; ctx.lineWidth = 4; ctx.lineJoin = 'round'; ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.35); ctx.lineTo(b.x - b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + 2, b.y + b.h * 0.65); ctx.stroke();
    var cy = b.y + b.h / 2, x = b.x + b.h * 0.55;
    if (rejse.leg === 'stil' && rejse.visUr) {
      var ur = b.h * 0.4;
      tegnUr(ctx, x, cy, ur, o.t, {});
      x += ur * 1.35;
    } else if (rejse.leg === 'dag') {
      // Dagen: sol eller maane og et spoergsmaalstegn
      tegnHimmelMaerke(ctx, x, cy, b.h * 0.2, o.himmel);
      x += b.h * 0.55;
      ctx.fillStyle = MOERK; ctx.font = '800 ' + Math.round(b.h * 0.55) + 'px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x + b.h * 0.2, cy); x += b.h * 0.6;
    }
    tegnHoejttaler(ctx, x + b.h * 0.1, cy, b.h * 0.22, tid < talerTil);
    ctx.restore();
  }
  function tegnHoejttaler(c, x, y, r, taler) {
    c.save();
    c.fillStyle = MOERK; c.beginPath(); c.moveTo(x - r, y - r * 0.45); c.lineTo(x - r * 0.4, y - r * 0.45); c.lineTo(x + r * 0.2, y - r); c.lineTo(x + r * 0.2, y + r); c.lineTo(x - r * 0.4, y + r * 0.45); c.lineTo(x - r, y + r * 0.45); c.closePath(); c.fill();
    c.strokeStyle = taler ? BLAA : MOERK; c.lineWidth = Math.max(2, r * 0.22); c.lineCap = 'round';
    var n = taler ? 1 + Math.floor((tid * 6) % 3) : 2;
    for (var i = 1; i <= n; i++) { c.beginPath(); c.arc(x + r * 0.2, y, r * (0.45 + i * 0.4), -0.7, 0.7); c.stroke(); }
    c.restore();
  }

  function tegnFremskridt() {
    var B = window.innerWidth, n = rejse.maal;
    var afstand = Math.min(28, (B - 240) / n), r = Math.min(9, afstand * 0.36);
    var bred = (n - 1) * afstand + r * 2 + 28;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = MOERK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(B / 2 - bred / 2, 22 - r - 8, bred, r * 2 + 16, r + 8); ctx.fill(); ctx.stroke();
    for (var i = 0; i < n; i++) {
      var x = B / 2 + (i - (n - 1) / 2) * afstand;
      ctx.beginPath(); ctx.arc(x, 22, r, 0, TAU);
      ctx.fillStyle = i < rejse.klaret ? (besoegt[i] || GUL) : '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = MOERK; ctx.stroke();
    }
  }

  /* ---------- Jorden drejer ---------- */

  function startSol() {
    tilstand = 'spiller';
    rejse = null;
    partikler = [];
    sol.roert = false;
    sol.sidsteGoeremaal = null;
    stopTale();
    setTimeout(function () { if (tilstand === 'spiller' && leg === 'sol') sigDoegn(U.vinkelTilDoegn(sol.vinkel)); }, 700);
  }

  function tegnSolLeg() {
    var p = planSol(), doegn = U.vinkelTilDoegn(sol.vinkel), himmel = U.himmel(doegn);
    tegnMaane(ctx, p.maane.x, p.maane.y, p.maane.r);
    tegnSol(ctx, p.sol.x, p.sol.y, p.sol.r, tid);
    // Solens lys mod jorden
    var g = ctx.createLinearGradient(p.sol.x, p.sol.y, p.jord.cx, p.jord.cy);
    g.addColorStop(0, 'rgba(255,220,120,.25)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.sol.x, p.sol.y - p.sol.r); ctx.lineTo(p.jord.cx, p.jord.cy - p.jord.r * 1.1); ctx.lineTo(p.jord.cx, p.jord.cy + p.jord.r * 1.1); ctx.lineTo(p.sol.x, p.sol.y + p.sol.r); ctx.fill();
    // Jorden drejer med huset
    var j = p.jord;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.arc(j.cx + 6, j.cy + 8, j.r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r, 0, TAU); ctx.clip();
    if (!tegnBillede('jord', j.cx, j.cy, j.r * 2.08, sol.vinkel - U.doegnTilVinkel(7 * 60))) {
      ctx.fillStyle = '#3aa7e0'; ctx.fillRect(j.cx - j.r, j.cy - j.r, j.r * 2, j.r * 2);
      ctx.fillStyle = GROEN; ctx.beginPath(); ctx.ellipse(j.cx - j.r * 0.3, j.cy - j.r * 0.2, j.r * 0.4, j.r * 0.3, 0.4, 0, TAU); ctx.fill();
    }
    // Natten: siden vaek fra solen ligger i skygge, med en bloed kant
    var retning = Math.atan2(p.sol.y - j.cy, p.sol.x - j.cx);
    var sg = ctx.createLinearGradient(j.cx + Math.cos(retning) * j.r * 0.3, j.cy + Math.sin(retning) * j.r * 0.3, j.cx - Math.cos(retning) * j.r * 0.5, j.cy - Math.sin(retning) * j.r * 0.5);
    sg.addColorStop(0, 'rgba(5,10,40,0)'); sg.addColorStop(1, 'rgba(5,10,40,.7)');
    ctx.fillStyle = sg; ctx.fillRect(j.cx - j.r, j.cy - j.r, j.r * 2, j.r * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(3, j.r * 0.035); ctx.strokeStyle = MOERK; ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r, 0, TAU); ctx.stroke();
    // Huset staar paa kanten og drejer med
    tegnHus(ctx, j.cx + Math.cos(sol.vinkel) * j.r, j.cy + Math.sin(sol.vinkel) * j.r, sol.vinkel, j.r * 0.22, himmel === 'nat');
    // Hvad musen goer lige nu, hvis det er tid til noget
    var gm = U.goeremaal(doegn);
    if (gm) {
      var hx = j.cx + Math.cos(sol.vinkel) * j.r * 1.55, hy = j.cy + Math.sin(sol.vinkel) * j.r * 1.55, str = j.r * 0.36;
      ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(hx + 3, hy + 5, str * 0.72, 0, TAU); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(hx, hy, str * 0.72, 0, TAU); ctx.fill(); ctx.strokeStyle = MOERK; ctx.lineWidth = 3; ctx.stroke();
      tegnBillede(gm.kort, hx, hy, str);
    }
    // Pile rundt om jorden, til man har proevet at dreje
    if (!sol.roert) {
      ctx.save(); ctx.globalAlpha = 0.55 + Math.sin(tid * 3) * 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, j.r * 0.05); ctx.lineCap = 'round';
      [0.3, Math.PI + 0.3].forEach(function (a0) {
        ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r * 1.32, a0, a0 + 1.2); ctx.stroke();
        var ex = j.cx + Math.cos(a0 + 1.2) * j.r * 1.32, ey = j.cy + Math.sin(a0 + 1.2) * j.r * 1.32, d = a0 + 1.2 + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(d + 2.6) * j.r * 0.13, ey + Math.sin(d + 2.6) * j.r * 0.13); ctx.lineTo(ex, ey); ctx.lineTo(ex + Math.cos(d - 2.6) * j.r * 0.13, ey + Math.sin(d - 2.6) * j.r * 0.13); ctx.stroke();
      });
      ctx.restore();
    }
    // Uret nederst med sol eller maane ved siden
    var u = p.ur;
    tegnPlanet(ctx, u.cx, u.cy, u.r, HIMMEL[himmel][0], 5, 1);
    tegnUr(ctx, u.cx, u.cy, u.r, U.doegnTilUr(doegn), {});
    tegnHimmelMaerke(ctx, u.cx + u.r * 1.55, u.cy - u.r * 0.6, u.r * 0.28, himmel);
    tegnHoejttaler(ctx, u.cx + u.r * 1.55, u.cy + u.r * 0.55, u.r * 0.2, tid < talerTil);
    tegnMus(ctx, p.mus.x, p.mus.y, p.mus.str, Math.max(0, Math.sin(tid * 2)) * 4);
  }

  /** Musens hus paa jordens kant. Om natten er der lys i vinduet. */
  function tegnHus(ctx, x, y, vinkel, str, nat) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(vinkel + Math.PI / 2);
    ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, str * 0.09); ctx.strokeStyle = MOERK;
    ctx.fillStyle = '#f2d9a6'; ctx.beginPath(); ctx.rect(-str * 0.45, -str * 0.85, str * 0.9, str * 0.85); ctx.fill(); ctx.stroke();
    ctx.fillStyle = ROED; ctx.beginPath(); ctx.moveTo(-str * 0.6, -str * 0.85); ctx.lineTo(0, -str * 1.45); ctx.lineTo(str * 0.6, -str * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = nat ? GUL : '#9ad5f5'; ctx.beginPath(); ctx.rect(-str * 0.2, -str * 0.65, str * 0.4, str * 0.35); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#8b5e34'; ctx.beginPath(); ctx.rect(-str * 0.12, -str * 0.3, str * 0.24, str * 0.3); ctx.fill(); ctx.stroke();
    if (nat) { ctx.fillStyle = MOERK; ctx.font = '800 ' + Math.round(str * 0.45) + 'px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('z z', str * 0.75, -str * 1.2); }
    ctx.restore();
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 300) return;
      var v = Math.random() * TAU, f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f - fart * 0.3, liv: liv, maxLiv: liv, r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }
  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy += 120 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.liv -= dt;
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

  /* ---------- tryk ---------- */

  // Hver finger foelges for sig via pointerId, saa to boern kan stille hver sit ur samtidig
  var fingre = {};

  function sted(e) {
    var r = lærred.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }
  function iBoble(p, x, y) { var b = p.boble; return x > b.x - b.h * 0.3 && x < b.x + b.b && y > b.y && y < b.y + b.h; }
  function paaMus(p, x, y) { return Math.hypot(x - p.mus.x, y - p.mus.y) < p.mus.str * 0.6; }

  function ned(e) {
    if (tilstand !== 'spiller') return;
    var pos = sted(e), x = pos.x, y = pos.y;
    if (leg === 'sol') {
      var ps = planSol();
      if (Math.hypot(x - ps.jord.cx, y - ps.jord.cy) < ps.jord.r * 1.45) { fingre[e.pointerId] = { type: 'jord', vinkel: Math.atan2(y - ps.jord.cy, x - ps.jord.cx) }; sol.roert = true; return; }
      if (Math.hypot(x - ps.ur.cx, y - ps.ur.cy) < ps.ur.r * 1.9 || Math.hypot(x - ps.mus.x, y - ps.mus.y) < ps.mus.str * 0.6) sigDoegn(U.vinkelTilDoegn(sol.vinkel));
      return;
    }
    for (var i = 0; i < rejse.stationer.length; i++) {
      var p = plan(i), v = visning[i], s = rejse.stationer[i];
      if (x < p.x0 || x >= p.x0 + p.sw) continue;
      if (v.raket || v.frossen || !s.opgave || v.ind < 0.8) return;
      if (iBoble(p, x, y) || paaMus(p, x, y)) { v.hop = 10; sigOpgave(i); return; }
      if (rejse.leg === 'stil') {
        var u = p.ur, d = Math.hypot(x - u.cx, y - u.cy);
        if (d > u.r * 1.25) return;
        // Hvilken viser? Paa hele timer kun den roede. Ellers den, hvis spids er naermest, eller den, der peger naermest fingeren
        var viser = 'time';
        if (rejse.trin < 60) {
          var a = vinkelTil(u.cx, u.cy, x, y), ts = spids(u.cx, u.cy, U.timeVinkel(s.ur.t), u.r * 0.4), ms = spids(u.cx, u.cy, U.minutVinkel(s.ur.t), u.r * 0.6);
          var dm = Math.hypot(x - ms.x, y - ms.y), dtm = Math.hypot(x - ts.x, y - ts.y);
          if (dm < u.r * 0.3 && dm <= dtm) viser = 'minut';
          else if (dtm < u.r * 0.3) viser = 'time';
          else viser = vinkelAfstand(a, U.minutVinkel(s.ur.t)) < vinkelAfstand(a, U.timeVinkel(s.ur.t)) ? 'minut' : 'time';
        }
        fingre[e.pointerId] = { type: 'viser', i: i, viser: viser, flyttet: false };
        v.holdt = viser;
        return;
      }
      // Musens dag: kortene
      for (var k = 0; k < p.kort.length; k++) {
        var pk = p.kort[k], kort = s.opgave.kortene[k];
        if (kort && Math.abs(x - pk.x) < pk.str * 0.55 && Math.abs(y - pk.y) < pk.str * 0.55) { vaelgKort(i, kort); return; }
      }
      return;
    }
  }
  function vinkelAfstand(a, b) { var d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); }

  function flyt(e) {
    var f = fingre[e.pointerId];
    if (!f || tilstand !== 'spiller') return;
    var pos = sted(e);
    if (f.type === 'jord') {
      var ps = planSol(), a = Math.atan2(pos.y - ps.jord.cy, pos.x - ps.jord.cx), d = a - f.vinkel;
      if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      f.vinkel = a;
      var foer = U.himmel(U.vinkelTilDoegn(sol.vinkel));
      sol.vinkel = ((sol.vinkel + d) % TAU + TAU) % TAU;
      var nu = U.vinkelTilDoegn(sol.vinkel), gm = U.goeremaal(nu);
      if (U.himmel(nu) !== foer) tone(U.himmel(nu) === 'nat' ? 330 : 660, 0.12, 0.1);
      if (gm && gm !== sol.sidsteGoeremaal) { sol.sidsteGoeremaal = gm; tik(); }
      if (!gm) sol.sidsteGoeremaal = null;
      return;
    }
    if (f.type === 'viser') {
      var s = rejse.stationer[f.i], p = plan(f.i);
      if (!s.opgave) return;
      var foerT = s.ur.t;
      U.traek(s.ur, f.viser, vinkelTil(p.ur.cx, p.ur.cy, pos.x, pos.y), rejse.trin);
      f.flyttet = true;
      if (s.ur.t !== foerT) tik();
    }
  }

  function op(e) {
    var f = fingre[e.pointerId];
    if (!f) return;
    delete fingre[e.pointerId];
    if (tilstand !== 'spiller') return;
    if (f.type === 'jord') {
      var doegn = U.vinkelTilDoegn(sol.vinkel), gm = U.goeremaal(doegn);
      if (gm) afspilRaekke([U.klip(U.doegnTilUr(doegn)), 'om_' + U.himmel(doegn) + '.mp3', 'goer_' + gm.kort + '.mp3'], stort(U.tekst(U.doegnTilUr(doegn))) + ' ' + U.HIMMELORD[U.himmel(doegn)] + '. ' + gm.tekst, 3.6);
      else sigDoegn(doegn);
      return;
    }
    if (f.type !== 'viser' || !rejse) return;
    var i = f.i, s = rejse.stationer[i], v = visning[i];
    v.holdt = null;
    if (!f.flyttet || !s.opgave) return;
    if (U.tjek(rejse, i)) { sigFlot(); loest(i, 1.0); return; }
    // Forkert: ingen straf. Efter to forsoeg blinker det rigtige tal, og musen siger "Naesten!"
    tone(300, 0.15, 0.08);
    if (s.forsoeg >= 2 && !v.hint) { v.hint = true; afspil('naesten.mp3', 'Næsten!', 1.2); }
  }

  function vaelgKort(i, kort) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i), o = s.opgave;
    var svar = U.vaelg(rejse, i, kort);
    if (svar === 'rigtigt') {
      afspilRaekke(['goer_' + kort + '.mp3'], o.tekst, 2.2);
      var k = o.kortene.indexOf(kort), pk = p.kort[k];
      if (pk) puf(pk.x, pk.y, GROEN, 20, 220, 6, 1);
      loest(i, 2.2);
      return;
    }
    tone(300, 0.15, 0.08);
    v.ryst = { kort: kort, til: tid + 0.4 };
    if (s.forsoeg >= 2 && !v.hint) { v.hint = true; afspil('naesten.mp3', 'Næsten!', 1.2); }
  }

  /* ---------- tegning og loekke ---------- */

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    tegnLag();
    ctx.drawImage(lag, 0, 0, B, H);
    if (tilstand === 'venter') return;
    if (leg === 'sol') { if (tilstand === 'spiller') tegnSolLeg(); }
    else if (rejse) {
      if (tilstand === 'spiller') for (var i = 0; i < rejse.stationer.length; i++) tegnStation(i);
      tegnFremskridt();
    }
    tegnPartikler();
  }

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    if (tilstand === 'spiller') opdater(dt);
    else if (tilstand === 'faerdig') { opdaterPartikler(dt); tegnVinder(dt); }
    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- slutskaerm ---------- */

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) konfetti.push({ x: Math.random() * canvas.width, y: -Math.random() * canvas.height, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6, b: 6 + Math.random() * 6, h: 4 + Math.random() * 4, farve: FARVER[i % FARVER.length] });
  }

  /** De planeter, musen har besoegt, og raketten der flyver hen over dem. */
  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d'), w = vinderCanvas.width, h = vinderCanvas.height;
    c.clearRect(0, 0, w, h);
    var n = Math.min(besoegt.length, 8), str = Math.min(56, (w - 20) / Math.max(1, n));
    for (var i = 0; i < n; i++) tegnPlanet(c, w / 2 + (i - (n - 1) / 2) * str, h * 0.62 - Math.abs(Math.sin(tid * 4 + i)) * 8, str * 0.3, besoegt[i], i, 1);
    tegnBillede('raket', ((tid * 90) % (w + 120)) - 60, h * 0.22 + Math.sin(tid * 3) * 6, 46, Math.PI / 2, c);
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > h + 10) { k.y = -10; k.x = Math.random() * w; }
      c.save(); c.translate(k.x, k.y); c.rotate(k.rot); c.fillStyle = k.farve; c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h); c.restore();
    });
  }

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    setTimeout(function () { afspil('rejse.mp3', 'Sikke en rumrejse!', 2.5); }, 700);
    visOverlay(
      '<div class="kort">' +
      '<h2>Sikke en rumrejse!</h2>' +
      '<canvas class="eksempel" width="560" height="200" style="position:static;display:block;width:280px;height:100px;align-self:center"></canvas>' +
      Menu.slutRaekke('igen', null) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    startKonfetti(vinderCanvas);
  }

  /* ---------- menu ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; vinderCanvas = null; }

  var FLISE_STIL = 'position:static;display:block;width:100%;height:100%';

  /**
   * Menuen: oeverst de tre lege som billeder (planet med ur, kort med tandboerste,
   * jorden med solen), saa stjerner, og nederst de groenne startknapper. Jorden
   * drejer har hverken stjerner eller to spillere; den har én stor startknap.
   */
  function visMenu() {
    tilstand = 'venter';
    rejse = null;
    stopTale();
    var legeKnapper = [['stil', 'Stil uret'], ['dag', 'Musens dag'], ['sol', 'Jorden drejer']].map(function (v) {
      return '<button class="knap smal ikon' + (leg === v[0] ? ' valgt' : '') + '" data-handling="leg" data-k="' + v[0] + '" aria-label="' + v[1] + '">' +
             '<canvas width="200" height="140" style="' + FLISE_STIL + '" data-leg="' + v[0] + '"></canvas></button>';
    }).join('');
    var start = leg === 'sol'
      ? '<div class="raekke start"><button class="knap groen start" data-handling="start" data-spillere="1" aria-label="Start">' + Menu.start() + '</button></div>'
      : Menu.startRaekke('start');
    visOverlay(
      '<div class="kort">' +
      '<h2>Klokken</h2>' +
      '<div class="raekke valg lege">' + legeKnapper + '</div>' +
      (leg === 'sol' ? '' : Menu.stjerneRaekke(svaerhed)) +
      start +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    tegnMenuBilleder();
    if (!visMenu.venter) {
      visMenu.venter = Sprites.naarKlar(ALLE, function () { visMenu.venter = false; if (tilstand === 'venter' && overlay.querySelector('canvas[data-leg]')) tegnMenuBilleder(); });
    }
  }

  /** Billederne paa legeknapperne, tegnet med spillets egne streger. */
  function tegnMenuBilleder() {
    overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height, k = cv.dataset.leg;
      c.clearRect(0, 0, w, h);
      var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b1030'); g.addColorStop(1, '#1e2a5e');
      c.fillStyle = g; c.beginPath(); c.roundRect(0, 0, w, h, 16); c.fill();
      c.fillStyle = '#fff'; [[20, 18], [60, 120], [170, 30], [185, 110], [110, 12], [40, 70]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], 1.6, 0, TAU); c.fill(); });
      if (k === 'stil') {
        tegnPlanet(c, w * 0.5, h * 0.55, 40, PLANETER[0], 1, 1);
        tegnUr(c, w * 0.5, h * 0.55, 40, 180, {});
      } else if (k === 'dag') {
        tegnPlanet(c, w * 0.3, h * 0.5, 30, HIMMEL.morgen[0], 0, 1);
        tegnUr(c, w * 0.3, h * 0.5, 30, 420, {});
        tegnSol(c, w * 0.3 + 34, h * 0.52 - 34, 7, 0);
        rr(c, w * 0.6, 14, 50, 50, 10, KRIDT, MOERK, 3);
        tegnBillede('tandboerste', w * 0.6 + 25, 39, 36, 0, c);
        rr(c, w * 0.6, 74, 50, 50, 10, KRIDT, MOERK, 3);
        tegnBillede('seng', w * 0.6 + 25, 99, 36, 0, c);
      } else {
        tegnSol(c, w * 0.8, h * 0.25, 14, 0);
        c.save(); c.beginPath(); c.arc(w * 0.42, h * 0.55, 44, 0, TAU); c.clip();
        if (!tegnBillede('jord', w * 0.42, h * 0.55, 92, 0, c)) { c.fillStyle = BLAA; c.fillRect(0, 0, w, h); }
        var sg = c.createLinearGradient(w * 0.42 + 10, h * 0.55, w * 0.42 - 30, h * 0.55); sg.addColorStop(0, 'rgba(5,10,40,0)'); sg.addColorStop(1, 'rgba(5,10,40,.7)');
        c.fillStyle = sg; c.fillRect(0, 0, w, h); c.restore();
        c.lineWidth = 3; c.strokeStyle = MOERK; c.beginPath(); c.arc(w * 0.42, h * 0.55, 44, 0, TAU); c.stroke();
        tegnHus(c, w * 0.42 + 44 * Math.cos(-0.4), h * 0.55 + 44 * Math.sin(-0.4), -0.4, 10, false);
      }
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'leg') { leg = knap.dataset.k; tone(660, 0.12); visMenu(); }
    else if (h === 'svaerhed') { svaerhed = parseInt(knap.dataset.n, 10); melodi([520, 660, 780].slice(0, svaerhed + 1), 70); visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (lydTil) tone(660, 0.12); else stopTale(); visMenu(); }
    else if (h === 'start') { skjulOverlay(); if (leg === 'sol') startSol(); else nyRejse(parseInt(knap.dataset.spillere, 10)); }
    else if (h === 'igen') { skjulOverlay(); if (leg === 'sol') startSol(); else nyRejse(antalSpillere); }
    else if (h === 'menu') visMenu();
  });

  lærred.addEventListener('pointerdown', function (e) { e.preventDefault(); try { lærred.setPointerCapture(e.pointerId); } catch (fejl) { /* ikke alle browsere */ } ned(e); }, { passive: false });
  lærred.addEventListener('pointermove', function (e) { e.preventDefault(); flyt(e); }, { passive: false });
  window.addEventListener('pointerup', op);
  window.addEventListener('pointercancel', op);
  document.addEventListener('visibilitychange', function () { fingre = {}; visning.forEach(function (v) { v.holdt = null; }); });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    var ps = planSol();
    return {
      tilstand: tilstand, leg: leg, svaerhed: svaerhed, spillere: antalSpillere, lyd: lydTil,
      klaret: rejse ? rejse.klaret : null, maal: rejse ? rejse.maal : null, faerdig: rejse ? rejse.faerdig : null,
      stationer: rejse ? rejse.stationer.map(function (s, i) {
        var p = plan(i), v = visning[i];
        var ts = spids(p.ur.cx, p.ur.cy, U.timeVinkel(s.ur.t), p.ur.r * 0.4), ms = spids(p.ur.cx, p.ur.cy, U.minutVinkel(s.ur.t), p.ur.r * 0.6);
        return { t: s.ur.t, opgave: s.opgave ? { t: s.opgave.t, kort: s.opgave.kort, kortene: s.opgave.kortene, tekst: s.opgave.tekst } : null, forsoeg: s.forsoeg,
          ur: { cx: Math.round(p.ur.cx), cy: Math.round(p.ur.cy), r: Math.round(p.ur.r) }, time: { x: Math.round(ts.x), y: Math.round(ts.y) }, minut: { x: Math.round(ms.x), y: Math.round(ms.y) },
          kort: p.kort.map(function (k, q) { return { kort: s.opgave ? s.opgave.kortene[q] : null, x: Math.round(k.x), y: Math.round(k.y), str: Math.round(k.str) }; }),
          mus: { x: Math.round(p.mus.x), y: Math.round(p.mus.y) }, boble: { x: Math.round(p.boble.x), y: Math.round(p.boble.y), b: Math.round(p.boble.b), h: Math.round(p.boble.h) },
          optaget: !!v.raket || !!v.frossen || v.ind < 0.8, hint: v.hint, holdt: v.holdt };
      }) : null,
      sol: { vinkel: sol.vinkel, doegn: U.vinkelTilDoegn(sol.vinkel), himmel: U.himmel(U.vinkelTilDoegn(sol.vinkel)), jord: { cx: Math.round(ps.jord.cx), cy: Math.round(ps.jord.cy), r: Math.round(ps.jord.r) }, ur: { cx: Math.round(ps.ur.cx), cy: Math.round(ps.ur.cy), r: Math.round(ps.ur.r) } }
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
