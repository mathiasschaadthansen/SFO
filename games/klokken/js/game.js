/**
 * Stjerneuret: rummusen, der laerer, hvordan uret virker.
 *
 * Tre lege. Planeturet: musen flyver fra planet til planet, og hver planet er
 * et ur. Skiftevis skal uret stilles ("Stil uret paa klokken tre") og aflaeses
 * ("Hvad er klokken?", hvor barnet trykker paa tallet). Paa hver planet bor et
 * lille rumvaesen, der sover, til uret er rigtigt — saa vaagner det og hopper.
 * Musens dag: uret viser en tid, hele himlen skifter farve efter tidspunktet,
 * og barnet vaelger kortet med det, musen goer nu. Jorden drejer: barnet drejer
 * jorden, huset gaar fra dag til nat, og dagens ring af goeremaal viser, at et
 * doegn er en cirkel ligesom uret.
 *
 * Viserne haenger sammen som paa et rigtigt ur, og begge er der altid: klokken
 * 3 er den roede viser paa 3 og den blaa paa 12. Ingen tid, ingen fejl: staar
 * uret forkert, blinker det rigtige tal, musen peger, og hun siger "Naesten!".
 *
 * Grafikken: stjernehimlen er tre lag, der glider forskelligt, saa rummet faar
 * dybde, naar raketten flyver. Urskiver og planeter tegnes én gang til smaa
 * billeder og kopieres ind pr. frame; kun viserne og det, der bevaeger sig,
 * tegnes hver gang.
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

  var MOERK = '#5e4a3a', KRIDT = '#f8f1e6', ROED = '#d95f45', BLAA = '#5f9fc9', GUL = '#f0c46a', GROEN = '#7ab648';
  var FARVER = [ROED, BLAA, GROEN, GUL, '#9b7bd4', '#e08a52'];
  /** De otte planeter. Hver har sin farve og sit saerpraeg, saa rejsen foeles som et sted. */
  var PLANETER = [
    { farve: '#d95f45', slags: 'kratere' },
    { farve: '#e08a52', slags: 'ring' },
    { farve: '#7ab648', slags: 'plet' },
    { farve: '#9b7bd4', slags: 'maane' },
    { farve: '#5f9fc9', slags: 'is' },
    { farve: '#e894b4', slags: 'striber' },
    { farve: '#f0c46a', slags: 'ring' },
    { farve: '#86c7c1', slags: 'kratere' }
  ];
  var VAESENFARVER = ['#f0c46a', '#86c7c1', '#e894b4', '#b3d383', '#f0b6d2', '#b5dcef', '#c3b0e6', '#eeb389'];
  var HIMMEL = {
    nat:    { top: '#151b33', bund: '#2a3358', skaer: 'rgba(90,105,180,.22)' },
    morgen: { top: '#4a4f80', bund: '#efb08e', skaer: 'rgba(240,200,165,.30)' },
    dag:    { top: '#5f8fc4', bund: '#bfdcef', skaer: 'rgba(200,225,238,.28)' },
    aften:  { top: '#3a3060', bund: '#dd9678', skaer: 'rgba(235,175,145,.28)' }
  };
  var RUMMET = { top: '#161c36', bund: '#2f3963', skaer: 'rgba(130,120,190,.25)' };
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
  var rul = 0;                  // hvor langt stjernerne er gledet; raketten skubber til den
  var stjerneskud = null, naesteSkud = 6;
  // Jorden drejer: husets vinkel paa skaermen (0 = mod solen). Starter klokken 7 om morgenen.
  var sol = { vinkel: U.doegnTilVinkel(7 * 60), roert: false, sidsteGoeremaal: null, omgang: 0, maal: null, glow: 0 };

  var ALLE = ['mus', 'jord', 'sol', 'maane'].concat(U.DAGEN.map(function (d) { return d.kort; })).map(function (n) { return STI + n + '.svg'; });
  Sprites.forhent(ALLE);
  var RAKET = '../../assets/kenney/raket.png';
  Sprites.forhent([RAKET]);
  function billede(navn) { return Sprites.hent(navn === 'raket' ? RAKET : STI + navn + '.svg'); }
  function tegnBillede(navn, x, y, str, vinkel, c) {
    c = c || ctx;
    var img = billede(navn);
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
  /** Hver planet har sin egen lille melodi, saa rejsen kan hoeres. */
  function planetMelodi(nr) {
    var grund = [523, 587, 659, 698, 784, 880, 988, 1047][nr % 8];
    melodi([grund, grund * 1.25, grund * 1.5], 95);
  }

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
  function flotKlip() { return FLOT[Math.floor(Math.random() * FLOT.length)]; }
  function sigFlot() { var f = flotKlip(); afspil(f[0], f[1], 1.2); }
  function stort(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

  /** Musen siger opgaven. */
  function sigOpgave(i) {
    var s = rejse.stationer[i], o = s.opgave;
    if (!o) return;
    if (o.slags === 'stil') afspilRaekke(['stil_uret.mp3', o.klip], 'Stil uret på ' + o.tekst + '.', 2.6);
    else if (o.slags === 'laes') afspil('hvad_klokken.mp3', 'Hvad er klokken?', 1.7);
    else if (o.slags === 'drej') afspilRaekke(['drej_' + o.kort + '.mp3'], 'Drej jorden, til ' + o.tekst.replace(/^Musen /, 'musen ').replace(/\.$/, '') + '.', 3.2);
    else afspilRaekke(['hvad_goer.mp3', o.klip, 'om_' + o.himmel + '.mp3'], 'Hvad gør musen ' + o.tekst + ' ' + U.HIMMELORD[o.himmel] + '?', 3.4);
  }
  /** Tiden paa uret, som paa jorden: "klokken syv om morgenen". */
  function sigDoegn(doegn) {
    var t = U.doegnTilUr(doegn), h = U.himmel(doegn);
    afspilRaekke([U.klip(t), 'om_' + h + '.mp3'], stort(U.tekst(t)) + ' ' + U.HIMMELORD[h] + '.', 2.4);
  }

  /* ---------- baggrund: taager, stjerner i tre lag, stjerneskud ---------- */

  var lag = document.createElement('canvas');     // taagerne, tegnet én gang
  var lagFor = '';
  var stjerner = [];
  (function () {
    // Tre lag: fjerne, smaa stjerner glider langsomt, naere glider hurtigt
    [[70, 0.12, 0.9], [45, 0.35, 1.4], [22, 0.8, 2.0]].forEach(function (l, n) {
      for (var i = 0; i < l[0]; i++) {
        stjerner.push({ x: Math.random(), y: Math.random(), fart: l[1], r: l[2] * (0.6 + Math.random() * 0.7),
          blink: Math.random() * TAU, lag: n,
          farve: Math.random() < 0.12 ? '#f2d9b6' : (Math.random() < 0.12 ? '#d4dcea' : '#ffffff') });
      }
    });
  })();

  function tilpasStørrelse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lagFor = '';
    urCache = {};
    planetCache = {};
  }

  /** Himlen bag det hele. I Musens dag og Jorden drejer skifter den med tidspunktet. */
  function tegnLag(h) {
    var B = window.innerWidth, H = window.innerHeight;
    var noegle = B + 'x' + H + 'x' + dpr + 'x' + h;
    if (lagFor === noegle) return;
    lagFor = noegle;
    var f = h ? HIMMEL[h] : RUMMET;
    lag.width = Math.floor(B * dpr); lag.height = Math.floor(H * dpr);
    var c = lag.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, f.top); g.addColorStop(1, f.bund);
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    // Taager: bloede skyer af lys, saa rummet ikke er en flad flade
    [[0.2, 0.75, 0.55], [0.85, 0.25, 0.4], [0.5, 1.15, 0.7]].forEach(function (t) {
      var r = c.createRadialGradient(B * t[0], H * t[1], 10, B * t[0], H * t[1], Math.max(B, H) * t[2]);
      r.addColorStop(0, f.skaer); r.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = r; c.fillRect(0, 0, B, H);
    });
  }

  function tegnStjerner() {
    var B = window.innerWidth, H = window.innerHeight, bred = B + 60;
    stjerner.forEach(function (s) {
      var x = ((s.x * bred - rul * s.fart) % bred + bred) % bred - 30;
      ctx.globalAlpha = Math.min(1, 0.3 + Math.sin(tid * 1.6 + s.blink) * 0.28 + s.fart * 0.3);
      ctx.fillStyle = s.farve;
      ctx.beginPath(); ctx.arc(x, s.y * H, s.r, 0, TAU); ctx.fill();
    });
    ctx.globalAlpha = 1;
    if (stjerneskud) {
      var k = stjerneskud;
      ctx.strokeStyle = 'rgba(255,255,255,' + Math.max(0, k.liv).toFixed(2) + ')';
      ctx.lineWidth = 2.5; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(k.x, k.y); ctx.lineTo(k.x - k.vx * 0.09, k.y - k.vy * 0.09); ctx.stroke();
    }
  }
  function opdaterHimmel(dt) {
    rul += dt * 14;
    if (stjerneskud) {
      stjerneskud.x += stjerneskud.vx * dt; stjerneskud.y += stjerneskud.vy * dt; stjerneskud.liv -= dt * 0.7;
      if (stjerneskud.liv <= 0) stjerneskud = null;
    } else if ((naesteSkud -= dt) <= 0) {
      naesteSkud = 7 + Math.random() * 9;
      stjerneskud = { x: window.innerWidth * (0.4 + Math.random() * 0.6), y: window.innerHeight * Math.random() * 0.4,
        vx: -260 - Math.random() * 180, vy: 130 + Math.random() * 90, liv: 1 };
    }
  }

  /* ---------- plan: hvor tingene staar ---------- */

  /** Hvor mange kort der skal vaere plads til, ogsaa mens det loeste billede staar frosset. */
  function kortAntal(i) {
    var o = rejse.stationer[i].opgave, v = visning[i];
    if (o && o.kortene) return o.kortene.length;
    if (v && v.frossen && v.frossen.kortene.length) return v.frossen.kortene.length;
    return U.INDSTIL.kortAntal[rejse.niveau];
  }

  function plan(i) {
    var B = window.innerWidth, H = window.innerHeight;
    var n = rejse ? rejse.stationer.length : 1;
    var sw = B / n, x0 = i * sw;
    var luft = i === 0 ? Math.min(48, sw * 0.08) : 0;        // plads til hjem-knappen
    var musStr = Math.min(sw * 0.17, H * 0.19);
    var top = Math.max(H * 0.055, 46);                       // under taelleren oeverst
    var mus = { x: x0 + luft + sw * 0.03 + musStr / 2, y: top + H * 0.025 + musStr / 2, str: musStr };
    var bh = Math.min(H * 0.2, musStr * 1.05);
    var indhold = !rejse || rejse.leg === 'stil' ? (rejse && !rejse.visUr ? 1.8 : 2.9) : 2.6;
    var boble = { x: mus.x + musStr * 0.6, y: top, b: Math.min(x0 + sw * 0.97 - (mus.x + musStr * 0.6), bh * indhold), h: bh };
    var p = { x0: x0, sw: sw, mus: mus, boble: boble, kort: [] };
    if (!rejse || rejse.leg === 'stil') {
      p.ur = { cx: x0 + sw / 2, cy: H * 0.6, r: Math.min(sw * 0.275, H * 0.24) };
    } else if (sw >= 640) {
      // Uret til venstre, kortene i et gitter til hoejre
      p.ur = { cx: x0 + sw * 0.28, cy: H * 0.6, r: Math.min(sw * 0.175, H * 0.225) };
      var ax = p.ur.cx + p.ur.r * 1.8, ab = x0 + sw * 0.97 - ax, ay = H * 0.32, ah = H * 0.58;
      var antal = kortAntal(i);
      var kol = 2, rk = Math.ceil(antal / kol), mellem = 14;
      var str = Math.min((ab - mellem) / kol, (ah - mellem * (rk - 1)) / rk, H * 0.29);
      var gb = kol * str + mellem, gh = rk * str + mellem * (rk - 1);
      for (var k = 0; k < antal; k++) p.kort.push({ x: ax + ab / 2 - gb / 2 + (k % kol) * (str + mellem) + str / 2, y: ay + ah / 2 - gh / 2 + Math.floor(k / kol) * (str + mellem) + str / 2, str: str });
    } else {
      // Smal: uret oeverst, kortene i en raekke nederst
      p.ur = { cx: x0 + sw / 2, cy: H * 0.45, r: Math.min(sw * 0.23, H * 0.175) };
      var antal2 = kortAntal(i);
      var str2 = Math.min((sw * 0.92 - 10 * (antal2 - 1)) / antal2, H * 0.22);
      for (var q = 0; q < antal2; q++) p.kort.push({ x: x0 + sw / 2 + (q - (antal2 - 1) / 2) * (str2 + 10), y: H * 0.84, str: str2 });
    }
    return p;
  }

  /** Jorden drejer: jorden i midten, solen til hoejre, maanen til venstre, uret nederst til venstre. */
  function planSol() {
    var B = window.innerWidth, H = window.innerHeight;
    var jr = Math.min(B * 0.15, H * 0.215);
    return {
      jord: { cx: B * 0.47, cy: H * 0.43, r: jr },
      sol: { x: B * 0.88, y: H * 0.16, r: Math.min(B * 0.05, H * 0.08) },
      maane: { x: B * 0.09, y: H * 0.15, r: Math.min(B * 0.03, H * 0.045) },
      ur: { cx: Math.max(B * 0.14, 100), cy: H * 0.79, r: Math.min(B * 0.095, H * 0.145) },
      mus: { x: B * 0.88, y: H * 0.75, str: Math.min(B * 0.12, H * 0.18) },
      boble: { x: B * 0.53, y: H * 0.845, b: Math.min(B * 0.29, 300), h: Math.min(H * 0.125, 92) }
    };
  }

  /* ---------- smaa tegnehjaelpere ---------- */

  function rr(c, x, y, b, h, r, fyld, streg, lw) {
    c.beginPath(); c.roundRect(x, y, b, h, r);
    if (fyld) { c.fillStyle = fyld; c.fill(); }
    if (streg) { c.strokeStyle = streg; c.lineWidth = lw || 3; c.stroke(); }
  }
  function spids(cx, cy, vinkel, laengde) { return { x: cx + Math.sin(vinkel) * laengde, y: cy - Math.cos(vinkel) * laengde }; }
  /** Vinkel fra klokken 12 og med uret, til fingeren. */
  function vinkelTil(cx, cy, x, y) { var a = Math.atan2(x - cx, -(y - cy)); return a < 0 ? a + TAU : a; }
  function bland(hex, mod, k) {
    var r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
    return 'rgb(' + Math.round(r + (mod[0] - r) * k) + ',' + Math.round(g + (mod[1] - g) * k) + ',' + Math.round(b + (mod[2] - b) * k) + ')';
  }
  function lysere(hex, k) { return bland(hex, [255, 255, 255], k); }
  function moerkere(hex, k) { return bland(hex, [18, 38, 31], k); }
  /** Hvor tallet h staar paa skiven. */
  function talSted(ur, h) { return spids(ur.cx, ur.cy, h / 12 * TAU, ur.r * 0.78); }

  /* ---------- urskiven ---------- */

  var urCache = {};
  /**
   * Selve skiven (kant, maerker og tal) tegnes én gang pr. stoerrelse og kopieres
   * ind. Kun viserne tegnes hver frame. tapbar giver tallene en blid knapring,
   * saa man kan se, at de kan trykkes paa.
   */
  function urSkive(r, tapbar) {
    var noegle = Math.round(r) + (tapbar ? 't' : 'f') + dpr;
    if (urCache[noegle]) return urCache[noegle];
    var pad = Math.ceil(r * 0.12) + 6, str = Math.ceil((r + pad) * 2);
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(str * dpr); cv.height = Math.ceil(str * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = str / 2, cy = str / 2;
    // Kant med lys ovenfra, saa skiven staar frem fra planeten
    var kg = c.createLinearGradient(cx, cy - r, cx, cy + r);
    kg.addColorStop(0, '#ffffff'); kg.addColorStop(1, '#ccccc4');
    c.fillStyle = kg; c.beginPath(); c.arc(cx, cy, r * 1.06, 0, TAU); c.fill();
    c.lineWidth = Math.max(3, r * 0.045); c.strokeStyle = MOERK; c.stroke();
    var fg = c.createRadialGradient(cx - r * 0.3, cy - r * 0.35, r * 0.1, cx, cy, r);
    fg.addColorStop(0, '#ffffff'); fg.addColorStop(1, '#eeeae0');
    c.fillStyle = fg; c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, r * 0.028); c.strokeStyle = MOERK; c.stroke();
    // Smaa maerker for minutterne, stoerre paa hver time
    c.lineCap = 'round';
    for (var m = 0; m < 60; m++) {
      var v = m / 60 * TAU, ydre = spids(cx, cy, v, r * 0.94), indre = spids(cx, cy, v, r * (m % 5 ? 0.9 : 0.85));
      c.strokeStyle = m % 5 ? 'rgba(94,74,58,.3)' : MOERK;
      c.lineWidth = m % 5 ? Math.max(1, r * 0.012) : Math.max(2, r * 0.032);
      c.beginPath(); c.moveTo(ydre.x, ydre.y); c.lineTo(indre.x, indre.y); c.stroke();
    }
    // Tallene
    c.font = '800 ' + Math.round(r * 0.21) + 'px ui-rounded, system-ui, sans-serif';
    c.textAlign = 'center'; c.textBaseline = 'middle';
    for (var h = 1; h <= 12; h++) {
      var pos = spids(cx, cy, h / 12 * TAU, r * 0.78);
      if (tapbar) {
        c.fillStyle = 'rgba(58,167,224,.13)'; c.beginPath(); c.arc(pos.x, pos.y, r * 0.155, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(58,167,224,.5)'; c.lineWidth = Math.max(1.5, r * 0.016); c.stroke();
      }
      c.fillStyle = MOERK; c.fillText(String(h), pos.x, pos.y + r * 0.008);
    }
    // Glassets lysstribe
    c.save();
    c.beginPath(); c.arc(cx, cy, r, 0, TAU); c.clip();
    var sg = c.createLinearGradient(cx - r, cy - r, cx + r * 0.2, cy + r * 0.4);
    sg.addColorStop(0, 'rgba(255,255,255,.5)'); sg.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = sg; c.beginPath(); c.ellipse(cx - r * 0.25, cy - r * 0.35, r * 0.78, r * 0.55, -0.5, 0, TAU); c.fill();
    c.restore();
    urCache[noegle] = { cv: cv, str: str };
    return urCache[noegle];
  }

  /**
   * Urskiven med begge visere. Den roede (kort, tyk) er timerne, den blaa (lang,
   * tynd) er minutterne. valg: fremhaev (hvilken viser fingeren holder), hint (et
   * tal der blinker), rigtigt, ryst, tapbar og glow.
   */
  function tegnUr(c, cx, cy, r, t, valg) {
    valg = valg || {};
    var skive = urSkive(r, !!valg.tapbar);
    if (valg.glow > 0) {
      c.save(); c.globalAlpha = valg.glow * 0.8;
      c.strokeStyle = GROEN; c.lineWidth = r * 0.14;
      c.beginPath(); c.arc(cx, cy, r * 1.12, 0, TAU); c.stroke();
      c.restore();
    }
    c.drawImage(skive.cv, cx - skive.str / 2, cy - skive.str / 2, skive.str, skive.str);
    if (valg.hint || valg.rigtigt || valg.ryst) {
      c.save();
      c.font = '800 ' + Math.round(r * 0.21) + 'px ui-rounded, system-ui, sans-serif';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      [['hint', GUL], ['rigtigt', GROEN], ['ryst', ROED]].forEach(function (par) {
        var n = valg[par[0]];
        if (!n) return;
        var pos = spids(cx, cy, n / 12 * TAU, r * 0.78);
        var dx = par[0] === 'ryst' ? Math.sin(tid * 45) * r * 0.03 : 0;
        var vokser = par[0] === 'rigtigt' ? 1.18 : 1;
        c.globalAlpha = par[0] === 'hint' ? 0.55 + Math.sin(tid * 6) * 0.35 : 1;
        c.fillStyle = par[1];
        c.beginPath(); c.arc(pos.x + dx, pos.y, r * 0.155 * vokser, 0, TAU); c.fill();
        c.lineWidth = Math.max(2, r * 0.022); c.strokeStyle = MOERK; c.stroke();
        c.globalAlpha = 1;
        c.fillStyle = par[0] === 'rigtigt' ? '#fff' : MOERK;
        c.fillText(String(n), pos.x + dx, pos.y + r * 0.008);
      });
      c.restore();
    }
    // Viserne: foerst den roede timeviser, saa den blaa minutviser ovenpaa
    viser(c, cx, cy, U.timeVinkel(t), r * 0.4, r * 0.085, ROED, valg.fremhaev === 'time', r);
    viser(c, cx, cy, U.minutVinkel(t), r * 0.6, r * 0.055, BLAA, valg.fremhaev === 'minut', r);
    c.fillStyle = MOERK; c.beginPath(); c.arc(cx, cy, r * 0.062, 0, TAU); c.fill();
    c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, r * 0.026, 0, TAU); c.fill();
  }
  function viser(c, cx, cy, vinkel, laengde, bredde, farve, holdt, r) {
    var sp = spids(cx, cy, vinkel, laengde), hale = spids(cx, cy, vinkel + Math.PI, laengde * 0.16);
    c.lineCap = 'round'; c.lineJoin = 'round';
    // Skygge under viseren, saa den ligger oven paa skiven
    c.strokeStyle = 'rgba(94,74,58,.16)'; c.lineWidth = bredde + Math.max(2, r * 0.022);
    c.beginPath(); c.moveTo(hale.x + r * 0.015, hale.y + r * 0.025); c.lineTo(sp.x + r * 0.015, sp.y + r * 0.025); c.stroke();
    if (holdt) { c.strokeStyle = 'rgba(240,196,106,.6)'; c.lineWidth = bredde * 2.8; c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke(); }
    c.strokeStyle = MOERK; c.lineWidth = bredde + Math.max(2, r * 0.022); c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke();
    c.strokeStyle = farve; c.lineWidth = bredde; c.beginPath(); c.moveTo(hale.x, hale.y); c.lineTo(sp.x, sp.y); c.stroke();
    // En rund knop paa spidsen, saa der er noget at tage fat i
    c.fillStyle = farve; c.beginPath(); c.arc(sp.x, sp.y, bredde * 0.98, 0, TAU); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.02); c.stroke();
    c.fillStyle = 'rgba(255,255,255,.45)'; c.beginPath(); c.arc(sp.x - bredde * 0.3, sp.y - bredde * 0.3, bredde * 0.32, 0, TAU); c.fill();
  }

  /* ---------- planeter ---------- */

  var planetCache = {};
  /** Planeten bag uret. Hver har sit saerpraeg: ring, striber, kratere, is, maane eller en stor plet. */
  function planetBillede(nr, r, farveOverstyr) {
    var noegle = nr + 'x' + Math.round(r) + 'x' + (farveOverstyr || '') + 'x' + dpr;
    if (planetCache[noegle]) return planetCache[noegle];
    var pl = PLANETER[nr % PLANETER.length];
    var farve = farveOverstyr || pl.farve, slags = farveOverstyr ? 'kratere' : pl.slags;
    var pr = r * 1.45, pad = Math.ceil(pr * 0.95), str = Math.ceil((pr + pad) * 2);
    var cv = document.createElement('canvas');
    cv.width = Math.ceil(str * dpr); cv.height = Math.ceil(str * dpr);
    var c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var cx = str / 2, cy = str / 2;

    if (slags === 'ring') {   // bagerste halvdel af ringen
      c.strokeStyle = 'rgba(255,255,255,.4)'; c.lineWidth = pr * 0.1;
      c.beginPath(); c.ellipse(cx, cy, pr * 1.5, pr * 0.4, -0.3, Math.PI * 0.95, Math.PI * 2.05); c.stroke();
    }
    if (slags === 'maane') {  // en lille maane bagved
      c.fillStyle = '#e9e4cf'; c.beginPath(); c.arc(cx + pr * 1.12, cy - pr * 0.82, pr * 0.2, 0, TAU); c.fill();
      c.lineWidth = Math.max(2, pr * 0.03); c.strokeStyle = MOERK; c.stroke();
    }
    // Kuglen
    var g = c.createRadialGradient(cx - pr * 0.38, cy - pr * 0.42, pr * 0.08, cx, cy, pr);
    g.addColorStop(0, lysere(farve, 0.45)); g.addColorStop(0.62, farve); g.addColorStop(1, moerkere(farve, 0.42));
    c.fillStyle = g; c.beginPath(); c.arc(cx, cy, pr, 0, TAU); c.fill();

    c.save(); c.beginPath(); c.arc(cx, cy, pr, 0, TAU); c.clip();
    if (slags === 'striber') {
      c.fillStyle = 'rgba(255,255,255,.2)';
      [-0.6, -0.1, 0.42, 0.78].forEach(function (y, k) {
        c.beginPath(); c.ellipse(cx, cy + pr * y, pr * 1.2, pr * (0.1 + (k % 2) * 0.05), 0, 0, TAU); c.fill();
      });
    } else if (slags === 'is') {
      c.fillStyle = 'rgba(255,255,255,.75)';
      c.beginPath(); c.ellipse(cx, cy - pr * 0.95, pr * 0.72, pr * 0.3, 0, 0, TAU); c.fill();
      c.beginPath(); c.ellipse(cx, cy + pr * 0.98, pr * 0.6, pr * 0.26, 0, 0, TAU); c.fill();
    } else if (slags === 'plet') {
      c.fillStyle = 'rgba(255,255,255,.28)';
      c.beginPath(); c.ellipse(cx + pr * 0.28, cy + pr * 0.18, pr * 0.34, pr * 0.24, 0.5, 0, TAU); c.fill();
      c.fillStyle = 'rgba(94,74,58,.12)';
      c.beginPath(); c.ellipse(cx - pr * 0.4, cy - pr * 0.3, pr * 0.22, pr * 0.16, -0.4, 0, TAU); c.fill();
    } else {
      [[0.42, -0.5, 0.16], [-0.5, 0.15, 0.12], [0.1, 0.6, 0.1], [-0.2, -0.62, 0.08], [0.62, 0.32, 0.07]].forEach(function (k) {
        c.fillStyle = 'rgba(94,74,58,.15)';
        c.beginPath(); c.arc(cx + pr * k[0], cy + pr * k[1], pr * k[2], 0, TAU); c.fill();
        c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = pr * 0.02; c.stroke();
      });
    }
    // Skygge langs randen, saa kuglen ser rund ud
    var skygge = c.createRadialGradient(cx - pr * 0.3, cy - pr * 0.35, pr * 0.4, cx, cy, pr);
    skygge.addColorStop(0, 'rgba(0,0,0,0)'); skygge.addColorStop(1, 'rgba(6,10,30,.45)');
    c.fillStyle = skygge; c.fillRect(cx - pr, cy - pr, pr * 2, pr * 2);
    c.restore();

    c.lineWidth = Math.max(3, pr * 0.028); c.strokeStyle = MOERK;
    c.beginPath(); c.arc(cx, cy, pr, 0, TAU); c.stroke();
    if (slags === 'ring') {   // forreste halvdel af ringen
      c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = pr * 0.1;
      c.beginPath(); c.ellipse(cx, cy, pr * 1.5, pr * 0.4, -0.3, -0.05, Math.PI * 0.95); c.stroke();
      c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = pr * 0.02;
      c.beginPath(); c.ellipse(cx, cy, pr * 1.5, pr * 0.4, -0.3, -0.05, Math.PI * 0.95); c.stroke();
    }
    planetCache[noegle] = { cv: cv, str: str };
    return planetCache[noegle];
  }
  function tegnPlanet(c, cx, cy, r, nr, skala, farve) {
    skala = skala === undefined ? 1 : skala;
    if (skala <= 0.02) return;
    var b = planetBillede(nr, r, farve), s = b.str * skala;
    c.drawImage(b.cv, cx - s / 2, cy - s / 2, s, s);
  }

  /* ---------- rumvaesenet paa planeten ---------- */

  /**
   * Et lille vaesen paa planetens rand. Det sover, til uret er rigtigt, og
   * vaagner saa og hopper. Saa er der en at goere det for.
   */
  function tegnVaesen(c, x, y, str, nr, vaagen, hop) {
    var farve = VAESENFARVER[nr % VAESENFARVER.length];
    var oejne = 1 + (nr % 3), horn = nr % 2 ? 2 : 1;
    c.save();
    c.translate(x, y - (vaagen ? Math.abs(Math.sin(hop * 7)) * str * 0.45 : 0));
    c.lineJoin = 'round'; c.lineCap = 'round';
    var lw = Math.max(2, str * 0.09);
    c.fillStyle = 'rgba(94,74,58,.18)';
    c.beginPath(); c.ellipse(0, str * 0.52, str * 0.42, str * 0.12, 0, 0, TAU); c.fill();
    // Antenner
    for (var a = 0; a < horn; a++) {
      var vx = (horn === 1 ? 0 : (a ? 1 : -1)) * str * 0.22;
      var sving = vaagen ? Math.sin(hop * 9 + a) * str * 0.08 : 0;
      c.strokeStyle = MOERK; c.lineWidth = lw * 0.8;
      c.beginPath(); c.moveTo(vx, -str * 0.32); c.quadraticCurveTo(vx + sving, -str * 0.55, vx + sving * 1.4, -str * 0.68); c.stroke();
      c.fillStyle = vaagen ? GUL : moerkere(farve, 0.15);
      c.beginPath(); c.arc(vx + sving * 1.4, -str * 0.72, str * 0.1, 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = lw * 0.7; c.stroke();
    }
    // Arme: oppe naar den er vaagen
    c.strokeStyle = MOERK; c.lineWidth = lw;
    [-1, 1].forEach(function (d) {
      c.beginPath(); c.moveTo(d * str * 0.3, -str * 0.02);
      if (vaagen) c.quadraticCurveTo(d * str * 0.6, -str * 0.2, d * str * 0.58, -str * 0.46);
      else c.quadraticCurveTo(d * str * 0.52, str * 0.14, d * str * 0.46, str * 0.3);
      c.stroke();
    });
    // Krop
    var kg = c.createLinearGradient(0, -str * 0.4, 0, str * 0.5);
    kg.addColorStop(0, lysere(farve, 0.3)); kg.addColorStop(1, moerkere(farve, 0.12));
    c.fillStyle = kg;
    c.beginPath(); c.roundRect(-str * 0.36, -str * 0.38, str * 0.72, str * 0.86, str * 0.34); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = lw; c.stroke();
    // Oejne
    for (var o = 0; o < oejne; o++) {
      var ox = oejne === 1 ? 0 : (o - (oejne - 1) / 2) * str * 0.22;
      var orr = str * (oejne === 1 ? 0.19 : 0.11);
      if (vaagen) {
        c.fillStyle = '#fff'; c.beginPath(); c.arc(ox, -str * 0.08, orr, 0, TAU); c.fill();
        c.strokeStyle = MOERK; c.lineWidth = lw * 0.7; c.stroke();
        c.fillStyle = MOERK; c.beginPath(); c.arc(ox + orr * 0.15, -str * 0.08, orr * 0.45, 0, TAU); c.fill();
      } else {
        c.strokeStyle = MOERK; c.lineWidth = lw * 0.8;
        c.beginPath(); c.arc(ox, -str * 0.1, orr, 0.35, Math.PI - 0.35); c.stroke();
      }
    }
    // Mund
    c.strokeStyle = MOERK; c.lineWidth = lw * 0.75;
    c.beginPath();
    if (vaagen) c.arc(0, str * 0.13, str * 0.16, 0.2, Math.PI - 0.2);
    else { c.moveTo(-str * 0.1, str * 0.18); c.lineTo(str * 0.1, str * 0.18); }
    c.stroke();
    if (!vaagen) {
      c.fillStyle = KRIDT;
      c.font = '800 ' + Math.round(str * 0.3) + 'px ui-rounded, system-ui, sans-serif';
      c.textAlign = 'center';
      c.globalAlpha = 0.45 + Math.sin(tid * 2) * 0.35;
      c.fillText('z z', str * 0.62, -str * 0.5);
      c.globalAlpha = 1;
    }
    c.restore();
  }

  /* ---------- rummusen ---------- */

  /**
   * Rummusen som hel astronaut: rygsaek, dragt, arme, stoevler og glashjelm med
   * Noto-musen indeni. peg er en vinkel, armen skal pege i (mod uret, naar musen
   * hjaelper); ellers svaever armene.
   */
  function tegnMus(c, x, y, str, valg) {
    valg = valg || {};
    var hop = valg.hop || 0, sv = Math.sin(tid * 1.6) * str * 0.035;
    c.save();
    c.translate(x, y - hop + sv);
    c.lineJoin = 'round'; c.lineCap = 'round';
    var lw = Math.max(2.5, str * 0.045), hjelm = str * 0.34;
    // Rygsaek
    rr(c, -str * 0.3, -str * 0.02, str * 0.6, str * 0.42, str * 0.14, '#c3c6c0', MOERK, lw);
    rr(c, -str * 0.12, str * 0.04, str * 0.24, str * 0.12, str * 0.05, '#9a9c96', MOERK, lw * 0.7);
    // Ben og stoevler
    [-1, 1].forEach(function (d) {
      var fx = d * str * (0.16 + Math.sin(tid * 1.4 + d) * 0.04);
      c.strokeStyle = MOERK; c.lineWidth = str * 0.15;
      c.beginPath(); c.moveTo(d * str * 0.12, str * 0.36); c.lineTo(fx, str * 0.58); c.stroke();
      c.strokeStyle = '#e9e6dd'; c.lineWidth = str * 0.11;
      c.beginPath(); c.moveTo(d * str * 0.12, str * 0.36); c.lineTo(fx, str * 0.58); c.stroke();
      rr(c, fx - str * 0.1, str * 0.56, str * 0.2, str * 0.12, str * 0.05, ROED, MOERK, lw * 0.8);
    });
    // Dragt
    var dg = c.createLinearGradient(0, -str * 0.1, 0, str * 0.42);
    dg.addColorStop(0, '#ffffff'); dg.addColorStop(1, '#d9d9d0');
    c.fillStyle = dg;
    c.beginPath(); c.roundRect(-str * 0.27, -str * 0.04, str * 0.54, str * 0.46, str * 0.18); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = lw; c.stroke();
    rr(c, -str * 0.27, str * 0.22, str * 0.54, str * 0.1, str * 0.04, BLAA, MOERK, lw * 0.6);
    c.fillStyle = GUL; c.beginPath(); c.arc(-str * 0.12, str * 0.09, str * 0.07, 0, TAU); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = lw * 0.6; c.stroke();
    // Arme
    [-1, 1].forEach(function (d) {
      var ax = d * str * 0.26, ay = str * 0.06, hx, hy;
      if (valg.peg !== undefined && d === (Math.cos(valg.peg) >= 0 ? 1 : -1)) {
        hx = ax + Math.cos(valg.peg) * str * 0.46; hy = ay + Math.sin(valg.peg) * str * 0.46;
      } else {
        hx = ax + d * str * 0.24; hy = ay + str * (0.2 + Math.sin(tid * 1.8 + d) * 0.06);
      }
      c.strokeStyle = MOERK; c.lineWidth = str * 0.14;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(hx, hy); c.stroke();
      c.strokeStyle = '#f0ece2'; c.lineWidth = str * 0.1;
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(hx, hy); c.stroke();
      c.fillStyle = ROED; c.beginPath(); c.arc(hx, hy, str * 0.085, 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = lw * 0.8; c.stroke();
    });
    // Krave og hjelm
    rr(c, -str * 0.3, -str * 0.1, str * 0.6, str * 0.14, str * 0.06, '#d2d2c9', MOERK, lw);
    tegnBillede('mus', 0, -hjelm * 0.62, hjelm * 1.5, 0, c);
    c.beginPath(); c.arc(0, -hjelm * 0.62, hjelm, 0, TAU);
    c.fillStyle = 'rgba(190,230,255,.2)'; c.fill();
    c.lineWidth = Math.max(3, str * 0.045); c.strokeStyle = MOERK; c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = Math.max(2, str * 0.035);
    c.beginPath(); c.arc(0, -hjelm * 0.62, hjelm * 0.78, -Math.PI * 0.88, -Math.PI * 0.55); c.stroke();
    c.restore();
  }

  /* ---------- raket, sol, maane, hus, kort ---------- */

  function tegnRaket(c, x, y, str, vinkel) {
    c.save();
    c.translate(x, y); c.rotate(vinkel);
    var f = 0.7 + Math.random() * 0.5;
    var fg = c.createLinearGradient(-str * 0.4, 0, -str * (0.45 + f * 0.85), 0);
    fg.addColorStop(0, '#fdefc4'); fg.addColorStop(0.45, '#e08a52'); fg.addColorStop(1, 'rgba(217,95,69,0)');
    c.fillStyle = fg;
    c.beginPath(); c.moveTo(-str * 0.38, -str * 0.17); c.quadraticCurveTo(-str * (0.5 + f * 0.9), 0, -str * 0.38, str * 0.17); c.closePath(); c.fill();
    if (!tegnBillede('raket', 0, 0, str, Math.PI / 2, c)) {
      c.fillStyle = KRIDT; c.beginPath(); c.ellipse(0, 0, str * 0.42, str * 0.17, 0, 0, TAU); c.fill();
      c.strokeStyle = MOERK; c.lineWidth = 3; c.stroke();
    }
    c.restore();
  }

  /** Solen: en gul kugle med straaler, der drejer langsomt. */
  function tegnSol(c, x, y, r, t) {
    c.save();
    c.translate(x, y);
    var glo = c.createRadialGradient(0, 0, r, 0, 0, r * 2.6);
    glo.addColorStop(0, 'rgba(240,196,106,.3)'); glo.addColorStop(1, 'rgba(240,196,106,0)');
    c.fillStyle = glo; c.beginPath(); c.arc(0, 0, r * 2.6, 0, TAU); c.fill();
    c.rotate(t * 0.15);
    c.strokeStyle = GUL; c.lineWidth = Math.max(3, r * 0.14); c.lineCap = 'round';
    for (var i = 0; i < 12; i++) {
      var v = i / 12 * TAU, l = r * (i % 2 ? 1.55 : 1.85);
      c.beginPath(); c.moveTo(Math.cos(v) * r * 1.25, Math.sin(v) * r * 1.25); c.lineTo(Math.cos(v) * l, Math.sin(v) * l); c.stroke();
    }
    c.rotate(-t * 0.15);
    var g = c.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
    g.addColorStop(0, '#fdefc4'); g.addColorStop(1, '#edaf63');
    c.fillStyle = g; c.beginPath(); c.arc(0, 0, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(3, r * 0.08); c.strokeStyle = MOERK; c.stroke();
    c.fillStyle = MOERK; c.beginPath(); c.arc(-r * 0.3, -r * 0.15, r * 0.08, 0, TAU); c.arc(r * 0.3, -r * 0.15, r * 0.08, 0, TAU); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.07); c.beginPath(); c.arc(0, r * 0.1, r * 0.35, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    c.restore();
  }
  /** Maanen: en lys skive med kratere. */
  function tegnMaane(c, x, y, r) {
    c.save();
    var g = c.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
    g.addColorStop(0, '#fffaf0'); g.addColorStop(1, '#d8cfb4');
    c.fillStyle = g; c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
    c.lineWidth = Math.max(2, r * 0.08); c.strokeStyle = MOERK; c.stroke();
    c.fillStyle = 'rgba(94,74,58,.16)';
    [[-0.3, 0.1, 0.22], [0.25, -0.35, 0.14], [0.3, 0.35, 0.16]].forEach(function (k) { c.beginPath(); c.arc(x + r * k[0], y + r * k[1], r * k[2], 0, TAU); c.fill(); });
    c.restore();
  }
  /** Sol eller maane som lille maerke ved uret: viser om det er dag eller nat. */
  function tegnHimmelMaerke(c, x, y, r, himmel) {
    if (himmel === 'nat') tegnMaane(c, x, y, r);
    else tegnSol(c, x, y, r * 0.62, tid);
    if (himmel === 'morgen' || himmel === 'aften') {
      c.strokeStyle = MOERK; c.lineWidth = Math.max(2, r * 0.1); c.lineCap = 'round';
      c.beginPath(); c.moveTo(x - r * 1.5, y + r * 1.15); c.lineTo(x + r * 1.5, y + r * 1.15); c.stroke();
    }
  }
  /** Musens hus paa jordens kant. Om natten er der lys i vinduet. */
  function tegnHus(c, x, y, vinkel, str, nat) {
    c.save();
    c.translate(x, y); c.rotate(vinkel + Math.PI / 2);
    c.lineJoin = 'round'; c.lineWidth = Math.max(2, str * 0.09); c.strokeStyle = MOERK;
    if (nat) {
      var lys = c.createRadialGradient(0, -str * 0.48, str * 0.1, 0, -str * 0.48, str * 1.8);
      lys.addColorStop(0, 'rgba(240,196,106,.4)'); lys.addColorStop(1, 'rgba(240,196,106,0)');
      c.fillStyle = lys; c.beginPath(); c.arc(0, -str * 0.48, str * 1.8, 0, TAU); c.fill();
    }
    c.fillStyle = '#eed9b2'; c.beginPath(); c.rect(-str * 0.45, -str * 0.85, str * 0.9, str * 0.85); c.fill(); c.stroke();
    c.fillStyle = ROED; c.beginPath(); c.moveTo(-str * 0.6, -str * 0.85); c.lineTo(0, -str * 1.45); c.lineTo(str * 0.6, -str * 0.85); c.closePath(); c.fill(); c.stroke();
    c.fillStyle = nat ? GUL : '#b5dcef'; c.beginPath(); c.rect(-str * 0.2, -str * 0.65, str * 0.4, str * 0.35); c.fill(); c.stroke();
    c.fillStyle = '#97714a'; c.beginPath(); c.rect(-str * 0.12, -str * 0.3, str * 0.24, str * 0.3); c.fill(); c.stroke();
    if (nat) {
      c.fillStyle = KRIDT; c.font = '800 ' + Math.round(str * 0.45) + 'px ui-rounded, system-ui, sans-serif';
      c.textAlign = 'center'; c.fillText('z z', str * 0.8, -str * 1.2);
    }
    c.restore();
  }

  /** Et kort i Musens dag. */
  function tegnKort(c, x, y, str, kort, valg) {
    valg = valg || {};
    var dx = valg.ryst ? Math.sin(tid * 45) * str * 0.05 : 0;
    var lft = valg.rigtigt ? str * 0.06 : 0;
    c.save();
    c.fillStyle = 'rgba(0,0,0,.3)';
    c.beginPath(); c.roundRect(x - str / 2 + 4 + dx, y - str / 2 + 8 + lft, str, str, str * 0.17); c.fill();
    var g = c.createLinearGradient(0, y - str / 2, 0, y + str / 2);
    if (valg.rigtigt) { g.addColorStop(0, '#a4cf9d'); g.addColorStop(1, GROEN); }
    else if (valg.hint) { g.addColorStop(0, '#f6e0a4'); g.addColorStop(1, GUL); }
    else { g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#e7e2d2'); }
    c.fillStyle = g;
    c.beginPath(); c.roundRect(x - str / 2 + dx, y - str / 2 - lft, str, str, str * 0.17); c.fill();
    c.strokeStyle = MOERK; c.lineWidth = Math.max(3, str * 0.035); c.stroke();
    if (valg.hint && !valg.rigtigt) {
      c.globalAlpha = 0.5 + Math.sin(tid * 6) * 0.3;
      c.strokeStyle = GUL; c.lineWidth = str * 0.08;
      c.beginPath(); c.roundRect(x - str / 2 + dx, y - str / 2 - lft, str, str, str * 0.17); c.stroke();
      c.globalAlpha = 1;
    }
    c.restore();
    tegnBillede(kort, x + dx, y - lft, str * 0.68, 0, c);
  }

  /* ---------- Planeturet og Musens dag ---------- */

  function nyVisning() {
    return { ind: 0, raket: null, glow: 0, ryst: null, rystTal: 0, hint: false, sigTid: tid + 0.9,
      holdt: null, hop: 0, frossen: null, bobleInd: 0, vaagen: 0 };
  }

  function nyRejse(spillere) {
    antalSpillere = spillere;
    rejse = U.nyRejse(spillere, svaerhed, leg);
    visning = rejse.stationer.map(function () { return nyVisning(); });
    besoegt = [];
    partikler = [];
    tilstand = 'spiller';
    lagFor = '';
    stopTale();
  }

  /**
   * Opgaven er loest: vaesenet vaagner, planeten lyser, og raketten flyver videre.
   * foer er stationens tilstand, FOER logikken gik videre til den naeste opgave —
   * ellers ville uret og planeten skifte, mens raketten endnu flyver.
   */
  function loest(i, ventTid, foer, svarTal) {
    var v = visning[i], p = plan(i);
    v.frossen = { t: foer.t, planet: foer.planet, svar: svarTal || 0,
      kort: foer.kort || null, kortene: foer.kortene || [] };
    besoegt.push(foer.planet);
    v.glow = 1;
    v.vaagen = tid;
    puf(p.ur.cx, p.ur.cy - p.ur.r * 0.5, GUL, 26, 260, 7, 1.1);
    planetMelodi(foer.planet);
    v.raket = { t: -(ventTid || 0.9) };
    v.holdt = null;
    Object.keys(fingre).forEach(function (id) { if (fingre[id].i === i) delete fingre[id]; });
  }

  /** Raketten flyver i en blid bue opad og ud til hoejre. */
  function raketSted(p, t) {
    return { x: p.ur.cx + t * p.sw, y: p.ur.cy - p.ur.r * 0.6 - Math.sin(Math.min(1, t) * Math.PI) * p.ur.r * 0.7 - t * p.ur.r * 0.5 };
  }

  function opdater(dt) {
    opdaterPartikler(dt);
    if (leg === 'sol') { opdaterSol(dt); sol.glow = Math.max(0, sol.glow - dt * 0.9); return; }
    if (!rejse) return;
    var fart = 0;
    rejse.stationer.forEach(function (s, i) {
      var v = visning[i], p = plan(i);
      v.ind = Math.min(1, v.ind + dt * 1.8);
      v.bobleInd = Math.min(1, v.bobleInd + dt * 3);
      v.glow = Math.max(0, v.glow - dt * 0.9);
      v.hop = Math.max(0, v.hop - dt * 60);
      if (v.ryst && tid > v.ryst.til) { v.ryst = null; v.rystTal = 0; }
      if (v.raket) {
        v.raket.t += dt;
        if (v.raket.t > 0 && !v.raket.startet) { v.raket.startet = true; syd(1.0); }
        if (v.raket.t > 0) {
          fart = Math.max(fart, Math.min(1, v.raket.t));
          if (v.raket.t < 0.95) {
            var rp = raketSted(p, v.raket.t);
            puf(rp.x - p.ur.r * 0.32, rp.y + p.ur.r * 0.04, Math.random() < 0.5 ? '#e08a52' : GUL, 1, 70, 5, 0.45);
          }
        }
        if (v.raket.t > 1.3) {
          v.raket = null; v.frossen = null; v.ind = 0; v.bobleInd = 0; v.hint = false;
          if (rejse.faerdig) { afslut(); return; }
          v.sigTid = tid + 0.5;
        }
      }
      if (v.sigTid && tid >= v.sigTid && s.opgave && !rejse.faerdig) { v.sigTid = 0; v.hop = 10; sigOpgave(i); }
    });
    rul += fart * dt * 520;
  }

  function tegnStation(i) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i);
    var t = v.frossen ? v.frossen.t : s.ur.t;
    var planet = v.frossen ? v.frossen.planet : s.planet;
    var opgave = s.opgave, loestNu = !!v.frossen;
    var himmel = rejse.leg === 'dag' && opgave ? opgave.himmel : null;
    // Planeten kommer ind ved at vokse og forsvinder, naar raketten letter
    var skala = v.raket && v.raket.t > 0 ? Math.max(0, 1 - v.raket.t * 1.5) : 0.55 + 0.45 * (1 - Math.pow(1 - v.ind, 3));
    tegnPlanet(ctx, p.ur.cx, p.ur.cy, p.ur.r, planet, skala, himmel ? HIMMEL[himmel].bund : null);
    if (skala > 0.05) {
      ctx.save(); ctx.translate(p.ur.cx, p.ur.cy); ctx.scale(skala, skala); ctx.translate(-p.ur.cx, -p.ur.cy);
      // Rumvaesenet bor paa randen i Planeturet
      if (rejse.leg === 'stil') {
        var vp = spids(p.ur.cx, p.ur.cy, 3.78, p.ur.r * 1.32);
        tegnVaesen(ctx, vp.x, vp.y, p.ur.r * 0.36, planet, loestNu, tid - v.vaagen);
      }
      // Mens det loeste ur staar frosset, maa den naeste opgaves tryk-ringe ikke snige sig ind
      var slags = loestNu ? null : (opgave ? opgave.slags : null);
      tegnUr(ctx, p.ur.cx, p.ur.cy, p.ur.r, t, {
        fremhaev: v.holdt,
        hint: v.hint && opgave && !loestNu ? (slags === 'laes' ? opgave.svar : U.time(opgave.t)) : 0,
        rigtigt: loestNu && v.frossen.svar ? v.frossen.svar : 0,
        ryst: v.rystTal,
        tapbar: slags === 'laes',
        glow: v.glow
      });
      if (himmel) tegnHimmelMaerke(ctx, p.ur.cx + p.ur.r * 1.08, p.ur.cy - p.ur.r * 1.03, p.ur.r * 0.2, himmel);
      ctx.restore();
    }
    if (v.raket && v.raket.t > 0) {
      var rp = raketSted(p, v.raket.t);
      tegnRaket(ctx, rp.x, rp.y, p.ur.r * 0.62, -0.5);
    }
    // Kortene i Musens dag
    if (rejse.leg === 'dag') {
      var kortene = v.frossen ? v.frossen.kortene : (opgave ? opgave.kortene : []);
      kortene.forEach(function (kort, k) {
        var pk = p.kort[k]; if (!pk) return;
        var rigtigt = v.frossen && v.frossen.kort === kort;
        tegnKort(ctx, pk.x, pk.y, pk.str * (v.frossen && !rigtigt ? 0.86 : 1), kort, {
          ryst: v.ryst && v.ryst.kort === kort,
          rigtigt: rigtigt,
          hint: v.hint && opgave && opgave.kort === kort && !loestNu
        });
      });
    }
    // Musen og boblen
    var peg;
    if (v.hint && !loestNu) peg = Math.atan2(p.ur.cy - p.mus.y, p.ur.cx - p.mus.x);
    tegnMus(ctx, p.mus.x, p.mus.y, p.mus.str, { hop: v.hop, peg: peg });
    if (opgave && !loestNu && v.ind > 0.5) tegnBoble(p, s, v);
  }

  /** Boblen ved musen: det lille ur, et spoergsmaalstegn og en hoejttaler, man kan trykke paa. */
  function tegnBoble(p, s, v) {
    var b = p.boble, o = s.opgave, sk = 0.6 + 0.4 * (1 - Math.pow(1 - v.bobleInd, 3));
    ctx.save();
    ctx.translate(b.x, b.y + b.h / 2); ctx.scale(sk, sk); ctx.translate(-b.x, -(b.y + b.h / 2));
    var rad = Math.min(22, b.h * 0.3);
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 7, b.b, b.h, rad); ctx.fill();
    var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ebe8dc');
    rr(ctx, b.x, b.y, b.b, b.h, rad, g, MOERK, 4);
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.35); ctx.lineTo(b.x - b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + 2, b.y + b.h * 0.65); ctx.fill();
    ctx.strokeStyle = MOERK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.35); ctx.lineTo(b.x - b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + 2, b.y + b.h * 0.65); ctx.stroke();
    var cy = b.y + b.h / 2, x = b.x + b.h * 0.55;
    if (o.slags === 'stil' && rejse.visUr) {
      var ur = b.h * 0.4;
      tegnUr(ctx, x, cy, ur, o.t, {});
      x += ur * 1.4;
    } else if (o.slags === 'laes') {
      // Et ur med et spoergsmaalstegn i stedet for visere
      var u2 = b.h * 0.36;
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x, cy, u2, 0, TAU); ctx.fill();
      ctx.strokeStyle = MOERK; ctx.lineWidth = Math.max(3, u2 * 0.14); ctx.stroke();
      for (var h = 0; h < 12; h++) {
        var pm = spids(x, cy, h / 12 * TAU, u2 * 0.76);
        ctx.fillStyle = MOERK; ctx.beginPath(); ctx.arc(pm.x, pm.y, u2 * 0.06, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = BLAA; ctx.font = '800 ' + Math.round(u2 * 1.05) + 'px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('?', x, cy + u2 * 0.06);
      x += u2 * 1.5;
    } else if (o.slags === 'kort') {
      tegnHimmelMaerke(ctx, x, cy, b.h * 0.2, o.himmel);
      x += b.h * 0.55;
      ctx.fillStyle = MOERK; ctx.font = '800 ' + Math.round(b.h * 0.55) + 'px ui-rounded, system-ui, sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
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

  /** Taelleren: én lille planet pr. opgave, de besoegte i deres egen farve. */
  function tegnFremskridt() {
    var B = window.innerWidth, n = rejse.maal;
    var afstand = Math.min(30, (B - 240) / n), r = Math.min(10, afstand * 0.38);
    var bred = (n - 1) * afstand + r * 2 + 28;
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.strokeStyle = MOERK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(B / 2 - bred / 2, 22 - r - 9, bred, r * 2 + 18, r + 9); ctx.fill(); ctx.stroke();
    for (var i = 0; i < n; i++) {
      var x = B / 2 + (i - (n - 1) / 2) * afstand;
      if (i < rejse.klaret) {
        tegnPlanet(ctx, x, 22, r * 0.69, besoegt[i] || 0, 1);
      } else {
        ctx.beginPath(); ctx.arc(x, 22, r, 0, TAU);
        ctx.fillStyle = '#eae7dd'; ctx.fill();
        ctx.lineWidth = 2.5; ctx.strokeStyle = 'rgba(94,74,58,.45)'; ctx.stroke();
      }
    }
  }

  /* ---------- Jorden drejer ---------- */

  function startSol() {
    tilstand = 'spiller';
    antalSpillere = 1;
    rejse = U.nyRejse(1, svaerhed, 'sol');
    visning = [nyVisning()];
    besoegt = [];
    partikler = [];
    lagFor = '';
    sol.roert = false;
    sol.sidsteGoeremaal = null;
    sol.omgang = 0;
    sol.maal = null;
    sol.glow = 0;
    stopTale();
    setTimeout(function () { if (tilstand === 'spiller' && leg === 'sol') sigOpgave(0); }, 700);
  }

  /** Jorden glider paa plads, naar fingeren har sluppet den. */
  function opdaterSol(dt) {
    if (sol.maal === null || sol.maal === undefined) return;
    var d = sol.maal - sol.vinkel;
    while (d > Math.PI) d -= TAU;
    while (d < -Math.PI) d += TAU;
    if (Math.abs(d) < 0.004) { sol.vinkel = ((sol.maal % TAU) + TAU) % TAU; sol.maal = null; return; }
    sol.vinkel = ((sol.vinkel + d * Math.min(1, dt * 12)) % TAU + TAU) % TAU;
  }

  function tegnSolLeg() {
    var p = planSol(), doegn = U.vinkelTilDoegn(sol.vinkel), himmel = U.himmel(doegn);
    tegnMaane(ctx, p.maane.x, p.maane.y, p.maane.r);
    tegnSol(ctx, p.sol.x, p.sol.y, p.sol.r, tid);
    // Solens lys mod jorden
    var g = ctx.createLinearGradient(p.sol.x, p.sol.y, p.jord.cx, p.jord.cy);
    g.addColorStop(0, 'rgba(255,220,120,.28)'); g.addColorStop(1, 'rgba(255,220,120,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(p.sol.x, p.sol.y - p.sol.r); ctx.lineTo(p.jord.cx, p.jord.cy - p.jord.r * 1.1); ctx.lineTo(p.jord.cx, p.jord.cy + p.jord.r * 1.1); ctx.lineTo(p.sol.x, p.sol.y + p.sol.r); ctx.fill();
    tegnDagsring(p, doegn);
    // Jorden drejer med huset
    var j = p.jord;
    ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.arc(j.cx + 6, j.cy + 9, j.r, 0, TAU); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r, 0, TAU); ctx.clip();
    if (!tegnBillede('jord', j.cx, j.cy, j.r * 2.08, sol.vinkel - U.doegnTilVinkel(7 * 60))) {
      ctx.fillStyle = BLAA; ctx.fillRect(j.cx - j.r, j.cy - j.r, j.r * 2, j.r * 2);
      ctx.fillStyle = GROEN; ctx.beginPath(); ctx.ellipse(j.cx - j.r * 0.3, j.cy - j.r * 0.2, j.r * 0.4, j.r * 0.3, 0.4, 0, TAU); ctx.fill();
    }
    // Natten: siden vaek fra solen ligger i skygge, med en bloed kant
    var retning = Math.atan2(p.sol.y - j.cy, p.sol.x - j.cx);
    var sg = ctx.createLinearGradient(j.cx + Math.cos(retning) * j.r * 0.3, j.cy + Math.sin(retning) * j.r * 0.3, j.cx - Math.cos(retning) * j.r * 0.55, j.cy - Math.sin(retning) * j.r * 0.55);
    sg.addColorStop(0, 'rgba(5,10,40,0)'); sg.addColorStop(1, 'rgba(5,10,40,.72)');
    ctx.fillStyle = sg; ctx.fillRect(j.cx - j.r, j.cy - j.r, j.r * 2, j.r * 2);
    ctx.restore();
    ctx.lineWidth = Math.max(3, j.r * 0.035); ctx.strokeStyle = MOERK; ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r, 0, TAU); ctx.stroke();
    tegnHus(ctx, j.cx + Math.cos(sol.vinkel) * j.r, j.cy + Math.sin(sol.vinkel) * j.r, sol.vinkel, j.r * 0.23, himmel === 'nat');
    // Pile rundt om jorden, til man har proevet at dreje
    if (!sol.roert) {
      ctx.save(); ctx.globalAlpha = 0.5 + Math.sin(tid * 3) * 0.3; ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(4, j.r * 0.05); ctx.lineCap = 'round';
      [0.35, Math.PI + 0.35].forEach(function (a0) {
        ctx.beginPath(); ctx.arc(j.cx, j.cy, j.r * 1.16, a0, a0 + 0.95); ctx.stroke();
        var ex = j.cx + Math.cos(a0 + 0.95) * j.r * 1.16, ey = j.cy + Math.sin(a0 + 0.95) * j.r * 1.16, d = a0 + 0.95 + Math.PI / 2;
        ctx.beginPath(); ctx.moveTo(ex + Math.cos(d + 2.6) * j.r * 0.13, ey + Math.sin(d + 2.6) * j.r * 0.13); ctx.lineTo(ex, ey); ctx.lineTo(ex + Math.cos(d - 2.6) * j.r * 0.13, ey + Math.sin(d - 2.6) * j.r * 0.13); ctx.stroke();
      });
      ctx.restore();
    }
    // Uret nederst med sol eller maane ved siden
    var u = p.ur;
    tegnPlanet(ctx, u.cx, u.cy, u.r, 4, 1, HIMMEL[himmel].bund);
    tegnUr(ctx, u.cx, u.cy, u.r, U.doegnTilUr(doegn), {});
    tegnHimmelMaerke(ctx, u.cx + u.r * 1.62, u.cy - u.r * 0.62, u.r * 0.3, himmel);
    tegnHoejttaler(ctx, u.cx + u.r * 1.62, u.cy + u.r * 0.62, u.r * 0.22, tid < talerTil);
    var opg = rejse && rejse.stationer[0] ? rejse.stationer[0].opgave : null;
    var pegMod;
    if (opg && visning[0] && visning[0].hint) {
      var hv = U.doegnTilVinkel(opg.t);
      pegMod = Math.atan2(j.cy + Math.sin(hv) * j.r * 1.78 - p.mus.y, j.cx + Math.cos(hv) * j.r * 1.78 - p.mus.x);
    }
    tegnMus(ctx, p.mus.x, p.mus.y, p.mus.str, { peg: pegMod });
    if (opg) tegnSolBoble(p, opg);
    // Hele doegn, der er drejet: en lille stjerne pr. dag
    for (var d2 = 0; d2 < Math.min(sol.omgang, 6); d2++) {
      var sx = j.cx + (d2 - (Math.min(sol.omgang, 6) - 1) / 2) * j.r * 0.36, sy = j.cy + j.r * 2.35;
      ctx.fillStyle = GUL; ctx.beginPath(); ctx.arc(sx, sy, j.r * 0.12, 0, TAU); ctx.fill();
      ctx.strokeStyle = MOERK; ctx.lineWidth = 2.5; ctx.stroke();
    }
  }

  /** Musens opgave i Jorden drejer: "drej hen til det her". */
  function tegnSolBoble(p, o) {
    var b = p.boble, rad = Math.min(22, b.h * 0.3);
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 7, b.b, b.h, rad); ctx.fill();
    var g = ctx.createLinearGradient(0, b.y, 0, b.y + b.h);
    g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#ebe8dc');
    rr(ctx, b.x, b.y, b.b, b.h, rad, g, MOERK, 4);
    // Spidsen peger mod musen til hoejre
    ctx.fillStyle = '#ebe8dc'; ctx.beginPath();
    ctx.moveTo(b.x + b.b - 2, b.y + b.h * 0.35); ctx.lineTo(b.x + b.b + b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + b.b - 2, b.y + b.h * 0.65); ctx.fill();
    ctx.strokeStyle = MOERK; ctx.lineWidth = 4; ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(b.x + b.b - 2, b.y + b.h * 0.35); ctx.lineTo(b.x + b.b + b.h * 0.22, b.y + b.h * 0.5); ctx.lineTo(b.x + b.b - 2, b.y + b.h * 0.65); ctx.stroke();
    var cy = b.y + b.h / 2, x = b.x + b.h * 0.62;
    // En pil rundt: drej jorden
    ctx.strokeStyle = BLAA; ctx.lineWidth = Math.max(4, b.h * 0.08); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x, cy, b.h * 0.26, -2.4, 1.6); ctx.stroke();
    var px = x + Math.cos(1.6) * b.h * 0.26, py = cy + Math.sin(1.6) * b.h * 0.26;
    ctx.beginPath();
    ctx.moveTo(px + Math.cos(1.6 + Math.PI / 2 + 2.6) * b.h * 0.1, py + Math.sin(1.6 + Math.PI / 2 + 2.6) * b.h * 0.1);
    ctx.lineTo(px, py);
    ctx.lineTo(px + Math.cos(1.6 + Math.PI / 2 - 2.6) * b.h * 0.1, py + Math.sin(1.6 + Math.PI / 2 - 2.6) * b.h * 0.1);
    ctx.stroke();
    x += b.h * 0.62;
    // Kortet med det, musen skal naa at goere
    tegnKort(ctx, x + b.h * 0.3, cy, b.h * 0.78, o.kort, {});
    x += b.h * 0.9;
    tegnHoejttaler(ctx, x + b.h * 0.2, cy, b.h * 0.22, tid < talerTil);
    ctx.restore();
  }

  /**
   * Dagens ring: doegnet som en cirkel om jorden med goeremaalene, hvor de
   * hoerer til. Den viser, at en dag gaar rundt ligesom uret.
   */
  function tegnDagsring(p, doegn) {
    var j = p.jord, ring = j.r * 1.78;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = Math.max(2, j.r * 0.03);
    ctx.beginPath(); ctx.arc(j.cx, j.cy, ring, 0, TAU); ctx.stroke();
    for (var h = 0; h < 24; h++) {
      var v = U.doegnTilVinkel(h * 60), hel = h % 6 === 0;
      var l = hel ? j.r * 0.08 : j.r * 0.04;
      ctx.strokeStyle = 'rgba(255,255,255,' + (hel ? 0.6 : 0.28) + ')';
      ctx.lineWidth = hel ? 3 : 1.5;
      ctx.beginPath();
      ctx.moveTo(j.cx + Math.cos(v) * ring, j.cy + Math.sin(v) * ring);
      ctx.lineTo(j.cx + Math.cos(v) * (ring + l), j.cy + Math.sin(v) * (ring + l));
      ctx.stroke();
    }
    var soegt = rejse && rejse.stationer[0] && rejse.stationer[0].opgave && visning[0] && visning[0].hint
      ? rejse.stationer[0].opgave.t : null;
    U.DAGEN.forEach(function (d) {
      var v = U.doegnTilVinkel(d.t), x = j.cx + Math.cos(v) * ring, y = j.cy + Math.sin(v) * ring;
      var naer = Math.abs(U.normDoegn(doegn) - d.t) <= 30;
      var str = j.r * (naer ? 0.4 : 0.26);
      if (soegt === d.t) {
        ctx.fillStyle = 'rgba(240,196,106,' + (0.25 + Math.sin(tid * 5) * 0.2) + ')';
        ctx.beginPath(); ctx.arc(x, y, str * 1.15, 0, TAU); ctx.fill();
      }
      ctx.fillStyle = naer ? GUL : 'rgba(247,243,232,.92)';
      ctx.beginPath(); ctx.arc(x, y, str * 0.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = MOERK; ctx.lineWidth = naer ? 3 : 2; ctx.stroke();
      tegnBillede(d.kort, x, y, str * 0.78);
    });
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
  function paaMus(p, x, y) { return Math.hypot(x - p.mus.x, y - p.mus.y) < p.mus.str * 0.7; }
  function vinkelAfstand(a, b) { var d = Math.abs(a - b) % TAU; return Math.min(d, TAU - d); }

  function ned(e) {
    if (tilstand !== 'spiller') return;
    var pos = sted(e), x = pos.x, y = pos.y;
    if (leg === 'sol') {
      var ps = planSol();
      if (Math.hypot(x - ps.jord.cx, y - ps.jord.cy) < ps.jord.r * 1.45) { fingre[e.pointerId] = { type: 'jord', vinkel: Math.atan2(y - ps.jord.cy, x - ps.jord.cx) }; sol.roert = true; return; }
      if (Math.hypot(x - ps.ur.cx, y - ps.ur.cy) < ps.ur.r * 1.9 || Math.hypot(x - ps.mus.x, y - ps.mus.y) < ps.mus.str * 0.7) sigDoegn(U.vinkelTilDoegn(sol.vinkel));
      return;
    }
    for (var i = 0; i < rejse.stationer.length; i++) {
      var p = plan(i), v = visning[i], s = rejse.stationer[i];
      if (x < p.x0 || x >= p.x0 + p.sw) continue;
      if (v.raket || v.frossen || !s.opgave || v.ind < 0.8) return;
      if (iBoble(p, x, y) || paaMus(p, x, y)) { v.hop = 10; sigOpgave(i); return; }
      if (s.opgave.slags === 'laes') {
        for (var h = 1; h <= 12; h++) {          // tryk paa et tal paa skiven
          var tp = talSted(p.ur, h);
          if (Math.hypot(x - tp.x, y - tp.y) < p.ur.r * 0.2) { svarTal(i, h); return; }
        }
        return;
      }
      if (s.opgave.slags === 'stil') {
        var u = p.ur, d = Math.hypot(x - u.cx, y - u.cy);
        if (d > u.r * 1.25) return;
        // Hvilken viser? Paa hele timer kun den roede. Ellers den, hvis spids er naermest
        var viserNavn = 'time';
        if (rejse.trin < 60) {
          var a = vinkelTil(u.cx, u.cy, x, y), ts = spids(u.cx, u.cy, U.timeVinkel(s.ur.t), u.r * 0.4), ms = spids(u.cx, u.cy, U.minutVinkel(s.ur.t), u.r * 0.6);
          var dm = Math.hypot(x - ms.x, y - ms.y), dtm = Math.hypot(x - ts.x, y - ts.y);
          if (dm < u.r * 0.3 && dm <= dtm) viserNavn = 'minut';
          else if (dtm < u.r * 0.3) viserNavn = 'time';
          else viserNavn = vinkelAfstand(a, U.minutVinkel(s.ur.t)) < vinkelAfstand(a, U.timeVinkel(s.ur.t)) ? 'minut' : 'time';
        }
        fingre[e.pointerId] = { type: 'viser', i: i, viser: viserNavn, flyttet: false };
        v.holdt = viserNavn;
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

  function flyt(e) {
    var f = fingre[e.pointerId];
    if (!f || tilstand !== 'spiller') return;
    var pos = sted(e);
    if (f.type === 'jord') {
      var ps = planSol(), a = Math.atan2(pos.y - ps.jord.cy, pos.x - ps.jord.cx), d = a - f.vinkel;
      if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU;
      f.vinkel = a;
      sol.maal = null;
      var foerHimmel = U.himmel(U.vinkelTilDoegn(sol.vinkel)), foerDoegn = U.vinkelTilDoegn(sol.vinkel);
      sol.vinkel = ((sol.vinkel + d) % TAU + TAU) % TAU;
      var nu = U.vinkelTilDoegn(sol.vinkel), gm = U.goeremaal(nu);
      // Midnat passeret fremad: en hel dag mere
      if (d < 0 && foerDoegn > 1320 && nu < 120) { sol.omgang++; melodi([880, 1100], 110); }
      if (U.himmel(nu) !== foerHimmel) tone(U.himmel(nu) === 'nat' ? 330 : 660, 0.12, 0.1);
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
      // Jorden lander et sted, uret kan sige — ellers ville musen sige "halv otte",
      // mens uret stod paa 7:17.
      var raa = U.vinkelTilDoegn(sol.vinkel), doegn = U.landDoegn(raa);
      sol.maal = U.doegnTilVinkel(doegn);
      var s0 = rejse && rejse.stationer[0], v0 = visning[0];
      if (s0 && s0.opgave && U.tjekDrej(rejse, 0, raa)) {
        var ps = planSol();
        sol.glow = 1;
        besoegt.push(besoegt.length % 8);
        puf(ps.jord.cx, ps.jord.cy, GUL, 26, 260, 7, 1.1);
        melodi([660, 880, 1100], 110);
        setTimeout(function () { if (tilstand === 'spiller' && leg === 'sol') sigFlot(); }, 260);
        if (rejse.faerdig) setTimeout(function () { if (tilstand === 'spiller') afslut(); }, 1100);
        else { v0.hint = false; setTimeout(function () { if (tilstand === 'spiller' && leg === 'sol') sigOpgave(0); }, 1500); }
        return;
      }
      var gm = U.goeremaal(doegn);
      if (gm) afspilRaekke([U.klip(U.doegnTilUr(doegn)), 'om_' + U.himmel(doegn) + '.mp3', 'goer_' + gm.kort + '.mp3'], stort(U.tekst(U.doegnTilUr(doegn))) + ' ' + U.HIMMELORD[U.himmel(doegn)] + '. ' + gm.tekst, 3.6);
      else sigDoegn(doegn);
      // Efter to forsoeg lyser det rigtige goeremaal paa dagens ring
      if (s0 && s0.forsoeg >= 2 && v0) v0.hint = true;
      return;
    }
    if (f.type !== 'viser' || !rejse) return;
    var i = f.i, s = rejse.stationer[i], v = visning[i];
    v.holdt = null;
    if (!f.flyttet || !s.opgave) return;
    var foer = { t: s.ur.t, planet: s.planet };
    if (U.tjek(rejse, i)) { sigFlot(); loest(i, 1.0, foer); return; }
    // Forkert: ingen straf. Efter to forsoeg blinker det rigtige tal, og musen peger
    tone(300, 0.15, 0.08);
    if (s.forsoeg >= 2 && !v.hint) { v.hint = true; afspil('naesten.mp3', 'Næsten!', 1.2); }
  }

  /** "Hvad er klokken?": barnet trykkede paa et tal paa skiven. */
  function svarTal(i, n) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i), o = s.opgave;
    var foer = { t: s.ur.t, planet: s.planet };
    if (U.tjekTal(rejse, i, n) === 'rigtigt') {
      var f = flotKlip();
      afspilRaekke([o.klip, f[0]], stort(o.tekst) + '. ' + f[1], 2.4);
      var tp = talSted(p.ur, n);
      puf(tp.x, tp.y, GROEN, 16, 190, 5, 0.9);
      loest(i, 1.5, foer, n);
      return;
    }
    tone(300, 0.15, 0.08);
    v.rystTal = n;
    v.ryst = { kort: null, til: tid + 0.4 };
    if (s.forsoeg >= 2 && !v.hint) { v.hint = true; afspil('naesten.mp3', 'Næsten!', 1.2); }
  }

  function vaelgKort(i, kort) {
    var s = rejse.stationer[i], v = visning[i], p = plan(i), o = s.opgave;
    var foer = { t: s.ur.t, planet: s.planet, kort: o.kort, kortene: o.kortene };
    if (U.vaelg(rejse, i, kort) === 'rigtigt') {
      afspilRaekke(['goer_' + kort + '.mp3'], o.tekst, 2.2);
      var k = o.kortene.indexOf(kort), pk = p.kort[k];
      if (pk) puf(pk.x, pk.y, GROEN, 20, 220, 6, 1);
      loest(i, 2.2, foer);
      return;
    }
    tone(300, 0.15, 0.08);
    v.ryst = { kort: kort, til: tid + 0.4 };
    if (s.forsoeg >= 2 && !v.hint) { v.hint = true; afspil('naesten.mp3', 'Næsten!', 1.2); }
  }

  /* ---------- tegning og loekke ---------- */

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    var h = null;
    if (leg === 'dag' && rejse && rejse.stationer[0].opgave) h = rejse.stationer[0].opgave.himmel;
    else if (leg === 'sol' && tilstand === 'spiller') h = U.himmel(U.vinkelTilDoegn(sol.vinkel));
    tegnLag(h);
    ctx.drawImage(lag, 0, 0, B, H);
    tegnStjerner();
    if (tilstand === 'venter') return;
    if (leg === 'sol') { if (tilstand === 'spiller') { tegnSolLeg(); if (rejse) tegnFremskridt(); } }
    else if (rejse) {
      if (tilstand === 'spiller') for (var i = 0; i < rejse.stationer.length; i++) tegnStation(i);
      tegnFremskridt();
    }
    tegnPartikler();
  }

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    opdaterHimmel(dt);
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
    var n = Math.min(besoegt.length, 8), str = Math.min(60, (w - 24) / Math.max(1, n));
    for (var i = 0; i < n; i++) tegnPlanet(c, w / 2 + (i - (n - 1) / 2) * str, h * 0.62 - Math.abs(Math.sin(tid * 4 + i)) * 9, str * 0.29, besoegt[i], 1);
    tegnRaket(c, ((tid * 95) % (w + 140)) - 70, h * 0.2 + Math.sin(tid * 3) * 7, 52, 0);
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
   * Menuen: oeverst de tre lege som billeder (planet med ur og rumvaesen, ur med
   * kort, jorden med solen), saa stjerner, og nederst de groenne startknapper.
   * Jorden drejer har hverken stjerner eller to spillere; den har én startknap.
   */
  function visMenu() {
    tilstand = 'venter';
    rejse = null;
    lagFor = '';
    stopTale();
    var legeKnapper = [['stil', 'Planeturet'], ['dag', 'Musens dag'], ['sol', 'Jorden drejer']].map(function (v) {
      return '<button class="knap smal ikon' + (leg === v[0] ? ' valgt' : '') + '" data-handling="leg" data-k="' + v[0] + '" aria-label="' + v[1] + '">' +
             '<canvas width="200" height="140" style="' + FLISE_STIL + '" data-leg="' + v[0] + '"></canvas></button>';
    }).join('');
    var start = leg === 'sol'
      ? '<div class="raekke start"><button class="knap groen start" data-handling="start" data-spillere="1" aria-label="Start">' + Menu.start() + '</button></div>'
      : Menu.startRaekke('start');
    visOverlay(
      '<div class="kort">' +
      '<h2>Stjerneuret</h2>' +
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
      c.save(); c.beginPath(); c.roundRect(0, 0, w, h, 16); c.clip();
      var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, RUMMET.top); g.addColorStop(1, RUMMET.bund);
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff';
      [[20, 18], [60, 120], [170, 30], [185, 110], [110, 12], [40, 70], [150, 76]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], 1.6, 0, TAU); c.fill(); });
      if (k === 'stil') {
        tegnPlanet(c, w * 0.44, h * 0.55, 36, 1, 1);
        tegnUr(c, w * 0.44, h * 0.55, 36, 180, {});
        tegnVaesen(c, w * 0.84, h * 0.72, 26, 1, true, 0.22);
      } else if (k === 'dag') {
        tegnPlanet(c, w * 0.29, h * 0.52, 27, 0, 1, HIMMEL.morgen.bund);
        tegnUr(c, w * 0.29, h * 0.52, 27, 420, {});
        tegnSol(c, w * 0.29 + 30, h * 0.52 - 31, 7, 0);
        tegnKort(c, w * 0.72, h * 0.31, 46, 'tandboerste', {});
        tegnKort(c, w * 0.72, h * 0.77, 46, 'seng', {});
      } else {
        tegnSol(c, w * 0.82, h * 0.24, 13, 0);
        c.save(); c.beginPath(); c.arc(w * 0.42, h * 0.55, 40, 0, TAU); c.clip();
        if (!tegnBillede('jord', w * 0.42, h * 0.55, 84, 0, c)) { c.fillStyle = BLAA; c.fillRect(0, 0, w, h); }
        var sg = c.createLinearGradient(w * 0.42 + 10, h * 0.55, w * 0.42 - 28, h * 0.55); sg.addColorStop(0, 'rgba(5,10,40,0)'); sg.addColorStop(1, 'rgba(5,10,40,.7)');
        c.fillStyle = sg; c.fillRect(0, 0, w, h); c.restore();
        c.lineWidth = 3; c.strokeStyle = MOERK; c.beginPath(); c.arc(w * 0.42, h * 0.55, 40, 0, TAU); c.stroke();
        tegnHus(c, w * 0.42 + 40 * Math.cos(-0.5), h * 0.55 + 40 * Math.sin(-0.5), -0.5, 10, false);
      }
      c.restore();
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
      stationer: rejse && leg !== 'sol' ? rejse.stationer.map(function (s, i) {
        var p = plan(i), v = visning[i];
        var ts = spids(p.ur.cx, p.ur.cy, U.timeVinkel(s.ur.t), p.ur.r * 0.4), ms = spids(p.ur.cx, p.ur.cy, U.minutVinkel(s.ur.t), p.ur.r * 0.6);
        var tal = [];
        for (var h = 1; h <= 12; h++) { var tp = talSted(p.ur, h); tal.push({ n: h, x: Math.round(tp.x), y: Math.round(tp.y) }); }
        return { t: s.ur.t, forsoeg: s.forsoeg,
          opgave: s.opgave ? { slags: s.opgave.slags, t: s.opgave.t, svar: s.opgave.svar, kort: s.opgave.kort, kortene: s.opgave.kortene, tekst: s.opgave.tekst } : null,
          ur: { cx: Math.round(p.ur.cx), cy: Math.round(p.ur.cy), r: Math.round(p.ur.r) },
          time: { x: Math.round(ts.x), y: Math.round(ts.y) }, minut: { x: Math.round(ms.x), y: Math.round(ms.y) }, tal: tal,
          kort: p.kort.map(function (k, q) { return { kort: s.opgave ? s.opgave.kortene[q] : null, x: Math.round(k.x), y: Math.round(k.y), str: Math.round(k.str) }; }),
          mus: { x: Math.round(p.mus.x), y: Math.round(p.mus.y) },
          boble: { x: Math.round(p.boble.x), y: Math.round(p.boble.y), b: Math.round(p.boble.b), h: Math.round(p.boble.h) },
          optaget: !!v.raket || !!v.frossen || v.ind < 0.8, hint: v.hint, holdt: v.holdt };
      }) : null,
      sol: { vinkel: sol.vinkel, doegn: U.vinkelTilDoegn(sol.vinkel), himmel: U.himmel(U.vinkelTilDoegn(sol.vinkel)), omgang: sol.omgang,
        opgave: leg === 'sol' && rejse && rejse.stationer[0].opgave ? rejse.stationer[0].opgave.kort : null,
        maalTid: leg === 'sol' && rejse && rejse.stationer[0].opgave ? rejse.stationer[0].opgave.t : null,
        forsoeg: leg === 'sol' && rejse ? rejse.stationer[0].forsoeg : 0,
        lander: sol.maal !== null && sol.maal !== undefined,
        jord: { cx: Math.round(ps.jord.cx), cy: Math.round(ps.jord.cy), r: Math.round(ps.jord.r) },
        ur: { cx: Math.round(ps.ur.cx), cy: Math.round(ps.ur.cy), r: Math.round(ps.ur.r) } }
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
