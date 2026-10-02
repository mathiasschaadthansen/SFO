/**
 * Skovkoekkenet.
 *
 * En kunde kommer ind og bestiller: boblen viser retten og ingredienserne som
 * billeder, og stemmen siger bestillingen. Én ting mangler paa hylden: den
 * hentes paa gaarden, hvor barnet finder, hvor den kommer fra. Saa laves
 * retten, ingredienserne laegges paa, og der ringes paa klokken. Kunden spiser,
 * og saa kommer regningen: barnet betaler med moenter, til det passer. En
 * forkert ingrediens eller en moent for meget hopper bare tilbage. Ingen tid,
 * ingen sure kunder. To boern har hver sin station og serverer sammen.
 *
 * Grafikken: alt der staar stille (vaeg, fliser, vindue, hylde, disk, skab)
 * tegnes én gang til et baggrundslag og kopieres ind pr. frame. Kun det, der
 * bevaeger sig, tegnes hver gang. Rekvisitter er tegnet i kode; maden og
 * gaesterne er malede PNG'er, klokken og traeet paa gaarden er laant fra
 * Noeddeskoven, og koen, bien, maelken og hjertet er Noto-tegninger. Gaarden
 * er malet i kode i akvarelstil og males én gang til lag.
 *
 * Denne fil er kun skaerm og lyd. Bestillinger, priser, kilder og regler
 * ligger i js/koekken.js.
 */
(function () {
  'use strict';

  var K = Koekken;

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

  var FARVER = ['#d95f45', '#5f9fc9', '#7ab648', '#f0c46a', '#9b7bd4', '#e08a52'];
  var MOERK = '#5e4a3a', KRIDT = '#f8f1e6';
  // Konturen er malet, ikke tegnet med tusch: en tynd, varm kant i stedet for
  // en sort streg. MOERK bruges stadig, hvor der skal FYLDES med blaek.
  var KANT = 'rgba(94,74,58,0.42)';
  // Maden, gaesterne og koen er malede PNG'er i spillets egen mappe. Hjertet,
  // maelken og bien er stadig Noto Emoji (klokken ogsaa, hvis den malede mangler). sti() vaelger den rigtige mappe,
  // saa resten af koden bare siger navnet.
  var MALET = 'billeder/', NOTO = '../../assets/noto/';
  var MALET_NAVNE = {};
  Object.keys(K.INGREDIENSER).concat(Object.keys(K.RETTER), K.KUNDER)
    .forEach(function (n) { MALET_NAVNE[n] = true; });
  MALET_NAVNE.ko = true;
  function sti(navn) {
    return MALET_NAVNE[navn] ? MALET + navn + '.png' : NOTO + navn + '.svg';
  }
  var RETFARVE = { pizza: '#d95f45', burger: '#7ab648', pandekager: '#e08a52' };
  // Bestemt form, til stemmen: "Hvor kommer osten fra?"
  var BESTEMT = {
    ost: 'osten', tomat: 'tomaten', champignon: 'champignonen', peberfrugt: 'peberfrugten', ananas: 'ananassen', oliven: 'olivenerne',
    boef: 'bøffen', salat: 'salaten', agurk: 'agurken', bacon: 'baconen',
    jordbaer: 'jordbærrene', banan: 'bananen', blaabaer: 'blåbærrene', chokolade: 'chokoladen', honning: 'honningen', smoer: 'smørret'
  };

  var svaerhed = 0;
  var friLeg = false;
  var lydTil = true;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var dag = null;
  var visning = [];            // pr. station: animationer og det barnet ser
  var antalSpillere = 1;
  var tilstand = 'venter';     // venter | spiller | faerdig
  var sidsteTid = 0, tid = 0;
  var lyd = null;
  var partikler = [];
  var serverede = [];          // kunder der er serveret i dag, til slutskaermen
  var vinderCanvas = null, konfetti = [];

  // Alle tegninger hentes med det samme, saa de er klar foer foerste kunde
  // Klokken og traeet paa gaarden er Noeddeskovens malede billeder; de ligger allerede i cachen
  var KLOKKE = '../maskinen/billeder/klokke.png', TRAE = '../maskinen/billeder/trae.png';
  var ALLE = Object.keys(K.INGREDIENSER).concat(Object.keys(K.RETTER), K.KUNDER, ['klokke', 'hjerte', 'ko', 'maelk', 'bi']).map(sti).concat([KLOKKE, TRAE]);
  Sprites.forhent(ALLE);
  function billede(navn) { return Sprites.hent(sti(navn)); }
  function tegnBillede(navn, x, y, str, vinkel, c) {
    c = c || ctx;
    var img = billede(navn);
    if (!Sprites.klar(img)) return;
    c.save();
    c.translate(x, y);
    if (vinkel) c.rotate(vinkel);
    c.drawImage(img, -str / 2, -str / 2, str, str);
    c.restore();
  }

  /* ---------- lyd og stemme ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();      // iOS bruger ogsaa 'interrupted', fx efter et opkald
    return lyd;
  }
  // iOS laaser kun lyden op i et rigtigt tryk (touchend eller click), ikke i pointerdown, en timer
  // eller et svar fra fetch. Derfor vaekkes lyden ved hvert tryk, uanset hvad der ellers sker.
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

  function syd(længde) {
    if (!lydTil) return;
    try {
      var k = lydKontekst(), n = Math.floor(k.sampleRate * længde);
      var buf = k.createBuffer(1, n, k.sampleRate), d = buf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      var kilde = k.createBufferSource(), f = k.createBiquadFilter(), g = k.createGain();
      f.type = 'highpass'; f.frequency.value = 3000; g.gain.value = 0.12;
      kilde.buffer = buf; kilde.connect(f).connect(g).connect(k.destination); kilde.start();
    } catch (e) { /* lyd er pynt */ }
  }

  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum); });
  }

  // Stemme: rigtige klip hvis de staar i lyd/klip.json, ellers enhedens egen talesyntese (kun lokale stemmer)
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

  function afspil(fil, reserveTekst, varighed) {
    if (!lydTil) return;
    talerTil = tid + (varighed || 2.5);
    if (!klipFindes[fil]) { sig(reserveTekst); return; }
    if (!buffere[fil]) {
      buffere[fil] = fetch('lyd/' + fil).then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    buffere[fil].then(function (buf) {
      var k = lydKontekst();
      if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* stoppet */ } }
      var kilde = k.createBufferSource();
      kilde.buffer = buf; kilde.connect(k.destination); kilde.start();
      aktivtKlip = kilde;
      talerTil = tid + buf.duration + 0.2;
    }).catch(function () { sig(reserveTekst); });
  }

  /**
   * Talklip fra bogstavspillet (Kore): "to", "plus", "er lig med". De ligger i
   * games/bogstaver/lyd/ og er med i offline-cachen. Findes de, siges regnestykket
   * med dem; ellers siger enhedens stemme det.
   */
  var TAL_STI = '../bogstaver/lyd/', talKlip = {}, talBuffere = {};
  fetch(TAL_STI + 'klip.json').then(function (r) { return r.ok ? r.json() : []; })
    .then(function (liste) { liste.forEach(function (f) { talKlip[f] = true; }); }).catch(function () { /* ingen talklip */ });
  function hentTalKlip(fil) {
    if (!talBuffere[fil]) {
      talBuffere[fil] = fetch(TAL_STI + fil).then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    return talBuffere[fil];
  }
  /** Flere talklip lige efter hinanden. Mangler et af dem, siger enhedens stemme reserveteksten. */
  function afspilTal(filer, reserveTekst, varighed) {
    if (!lydTil) return;
    talerTil = tid + (varighed || 2.5);
    if (!filer.every(function (f) { return talKlip[f]; })) { sig(reserveTekst); return; }
    Promise.all(filer.map(hentTalKlip)).then(function (buffere) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* stoppet */ } }
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
      buffere.forEach(function (buf) {
        var kilde = k.createBufferSource();
        kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start);
        start += buf.duration - 0.04;
        aktivtKlip = kilde;
      });
      talerTil = tid + (start - k.currentTime) + 0.2;
    }).catch(function () { sig(reserveTekst); });
  }
  var TALORD = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv'];
  /** Et tal som klip: 0-9 findes som klip, 10-12 siges af enhedens stemme. */
  function sigTal(n, efter) {
    if (n <= 9) afspilTal(['tal_' + n + '.mp3'], TALORD[n] + (efter || ''), 1);
    else sig(TALORD[n] + (efter || ''));
  }
  /** Regnestykket: "to plus to plus en er lig med". */
  function sigRegning(r) {
    var filer = [], ord = [];
    r.poster.forEach(function (post, i) {
      if (i) { filer.push('plus.mp3'); ord.push('plus'); }
      filer.push('tal_' + post.pris + '.mp3'); ord.push(TALORD[post.pris]);
    });
    filer.push('er_lig_med.mp3'); ord.push('er lig med');
    afspilTal(filer, ord.join(' ') + '?', 1.2 + r.poster.length * 0.9);
  }

  function stopTale() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* ignorer */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }

  var TAK = ['Mmm, tak!', 'Det smager dejligt!', 'Tusind tak!'];
  function sigBestilling(b) {
    if (b.fri) afspil('fri.mp3', 'Overrask mig!', 1.8);
    else afspil('bestil_' + b.id + '.mp3', K.saetning(b), 3.5);
  }

  /* ---------- laerred og baggrundslag ---------- */

  var lag = document.createElement('canvas');     // alt der staar stille, tegnet én gang
  var lagFor = '';                                 // hvad laget er tegnet til: stoerrelse og antal stationer
  var dpr = 1;

  function tilpasStørrelse() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lagFor = '';
    kasseCache = {};
  }

  /** Hvor tingene staar i en station. Alt regnes ud fra skaermen, saa det passer paa iPad og iPhone. */
  function plan(i) {
    var B = window.innerWidth, H = window.innerHeight;
    var n = dag ? dag.stationer.length : 1;
    var sw = B / n, x0 = i * sw;
    var luft = i === 0 ? Math.min(48, sw * 0.08) : 0;        // plads til hjem-knappen
    var kundeStr = Math.min(sw * 0.2, H * 0.27);
    var kunde = { x: x0 + luft + sw * 0.05 + kundeStr / 2, y: H * 0.115 + kundeStr / 2, str: kundeStr };
    // Vinduet vises kun, naar der er én spiller og god plads. Saa slutter boblen foer vinduet.
    var vindue = n === 1 && B >= 900 && H >= 600;
    var bobleSlut = vindue ? B - Math.min(190, B * 0.19) - 24 : x0 + sw * 0.97;
    var boble = { x: kunde.x + kundeStr * 0.62, y: H * 0.1, b: bobleSlut - (kunde.x + kundeStr * 0.62), h: Math.min(H * 0.24, kundeStr * 0.95) };
    var ret = { x: x0 + sw * 0.5, y: H * 0.57, r: Math.min(sw * 0.2, H * 0.19) };
    var hylde = dag ? dag.stationer[i].hylde : [];
    var antal = hylde.length + 1.5;
    var kr = Math.min(sw * 0.92 / antal / 2 * 0.9, H * 0.088);
    var y = H - kr - Math.max(14, H * 0.035);
    var bred = sw * 0.94, trin = bred / antal;
    var knapper = hylde.map(function (t, k) { return { ting: t, x: x0 + sw * 0.03 + trin * (k + 0.5), y: y, r: kr }; });
    var klokke = { x: x0 + sw * 0.03 + trin * (hylde.length + 0.75), y: y - kr * 0.1, r: kr * 1.25 };
    // Bliver knapperne for smaa i en raekke (to spillere paa iPad), staar de i to raekker i stedet
    if (kr < 36 && H >= 600) {
      var pr = Math.ceil(hylde.length / 2), felt = H * 0.24;
      kr = Math.min(sw * 0.74 / pr / 2 * 0.9, felt / 4 * 0.86);
      trin = sw * 0.74 / pr;
      knapper = hylde.map(function (t, k) { return { ting: t, x: x0 + sw * 0.03 + trin * (k % pr + 0.5), y: H * 0.76 + 4 + felt * (k < pr ? 0.27 : 0.75), r: kr }; });
      klokke = { x: x0 + sw * 0.87, y: H * 0.76 + felt * 0.5, r: Math.min(sw * 0.1, felt * 0.36) };
    }
    // Moenterne under betalingen staar, hvor hylden ellers er
    var mr = Math.min(sw * 0.1, H * 0.088), mk = dag ? K.MOENTER[dag.niveau] : [1];
    var moenter = mk.map(function (v, k) { return { moent: v, x: x0 + sw * 0.5 + (k - (mk.length - 1) / 2) * mr * 2.6, y: H - mr - Math.max(14, H * 0.035), r: mr }; });
    // Gaarden: kilderne staar i to raekker paa marken
    var gk = dag && dag.stationer[i].bestilling ? K.gaardKilder(dag.stationer[i].bestilling.ret) : [];
    var kol = Math.min(3, gk.length), rk = Math.ceil(gk.length / Math.max(1, kol));
    var cb = sw * 0.9 / Math.max(1, kol), ch = (H * 0.66) / Math.max(1, rk);
    var kilder = gk.map(function (k, q) {
      return { kilde: k, x: x0 + sw * 0.05 + cb * (q % kol + 0.5), y: H * 0.32 + ch * (Math.floor(q / kol) + 0.55), r: Math.min(cb * 0.42, ch * 0.42) };
    });
    return { x0: x0, sw: sw, kunde: kunde, boble: boble, ret: ret, knapper: knapper, klokke: klokke, moenter: moenter, kilder: kilder,
      vindue: vindue, hyldeSkab: sw >= 380 && H >= 480 };
  }

  /* ---------- baggrundslaget: vaeg, fliser, vindue, hylde, disk og skab ---------- */

  function rr(c, x, y, b, h, r, fyld, streg, lw) {
    c.beginPath(); c.roundRect(x, y, b, h, r);
    if (fyld) { c.fillStyle = fyld; c.fill(); }
    if (streg) { c.strokeStyle = streg; c.lineWidth = lw || 4; c.stroke(); }
  }
  function skygge(c, fn, blur, dy, alpha) {
    c.save(); c.shadowColor = 'rgba(94,74,58,' + (alpha || 0.28) + ')'; c.shadowBlur = blur; c.shadowOffsetY = dy; fn(); c.restore();
  }
  function sky(c, x, y, r) {
    c.fillStyle = '#fff'; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2); c.arc(x - r * 1.1, y + r * 0.25, r * 0.75, 0, Math.PI * 2); c.fill();
  }
  function krukke(c, x, y, b, h, glas, laag, indhold) {
    skygge(c, function () { rr(c, x, y, b, h, b * 0.22, glas); }, 8, 4, 0.2);
    rr(c, x, y, b, h, b * 0.22, null, KANT, 3);
    rr(c, x - 3, y - h * 0.16, b + 6, h * 0.26, 5, laag, KANT, 3);
    rr(c, x + b * 0.13, y + h * 0.2, b * 0.13, h - h * 0.4, 4, 'rgba(255,255,255,.55)');
    if (indhold) tegnBillede(indhold, x + b / 2, y + h * 0.56, b * 0.62, 0, c);
  }
  function potte(c, x, y, s) {
    c.fillStyle = '#bd7048'; c.beginPath(); c.moveTo(x - s * 0.42, y); c.lineTo(x + s * 0.42, y); c.lineTo(x + s * 0.3, y + s * 0.55); c.lineTo(x - s * 0.3, y + s * 0.55); c.closePath(); c.fill(); c.strokeStyle = KANT; c.lineWidth = 3; c.stroke();
    rr(c, x - s * 0.5, y - s * 0.15, s, s * 0.22, 4, '#c8794f', KANT, 3);
    // en urt i kode: tre blade
    c.fillStyle = '#7ab648'; c.strokeStyle = KANT; c.lineWidth = 2.5;
    [[-0.3, -0.5, -0.6], [0.3, -0.5, 0.6], [0, -0.75, 0]].forEach(function (b) {
      c.save(); c.translate(x + b[0] * s, y + b[1] * s); c.rotate(b[2]);
      c.beginPath(); c.ellipse(0, 0, s * 0.14, s * 0.3, 0, 0, Math.PI * 2); c.fill(); c.stroke(); c.restore();
    });
  }
  function redskab(c, x, y, art, s) {
    c.strokeStyle = KANT; c.lineWidth = 3;
    c.fillStyle = '#a9a396'; c.beginPath(); c.arc(x, y - s * 0.08, s * 0.06, 0, Math.PI * 2); c.fill(); c.stroke();
    rr(c, x - s * 0.06, y, s * 0.12, s * 0.6, s * 0.06, '#b9874f', KANT, 3);
    if (art === 'spatel') {
      rr(c, x - s * 0.2, y + s * 0.58, s * 0.4, s * 0.38, s * 0.07, '#5a564e', KANT, 3);
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 2;
      for (var i = 0; i < 3; i++) { c.beginPath(); c.moveTo(x - s * 0.1 + i * s * 0.1, y + s * 0.66); c.lineTo(x - s * 0.1 + i * s * 0.1, y + s * 0.9); c.stroke(); }
    } else if (art === 'ske') {
      c.fillStyle = '#5a564e'; c.beginPath(); c.ellipse(x, y + s * 0.78, s * 0.2, s * 0.24, 0, 0, Math.PI * 2); c.fill(); c.strokeStyle = KANT; c.lineWidth = 3; c.stroke();
      c.fillStyle = 'rgba(255,255,255,.35)'; c.beginPath(); c.ellipse(x - s * 0.06, y + s * 0.72, s * 0.07, s * 0.1, 0, 0, Math.PI * 2); c.fill();
    } else {
      for (var k = -2; k <= 2; k++) {
        c.strokeStyle = '#a9a396'; c.lineWidth = 3; c.beginPath(); c.moveTo(x, y + s * 0.58); c.quadraticCurveTo(x + k * s * 0.12, y + s * 0.82, x, y + s * 1.04); c.stroke();
        c.strokeStyle = KANT; c.lineWidth = 1.2; c.beginPath(); c.moveTo(x, y + s * 0.58); c.quadraticCurveTo(x + k * s * 0.12, y + s * 0.82, x, y + s * 1.04); c.stroke();
      }
    }
  }

  function tegnLag() {
    var B = window.innerWidth, H = window.innerHeight;
    var n = dag ? dag.stationer.length : 1;
    var noegle = B + 'x' + H + 'x' + dpr + 'x' + n;
    if (lagFor === noegle) return;
    lagFor = noegle;
    lag.width = Math.floor(B * dpr); lag.height = Math.floor(H * dpr);
    var c = lag.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    var diskY = H * 0.4, skabY = H * 0.76, fliseY = H * 0.26;

    // Vaeg med lys ovenfra
    var g = c.createLinearGradient(0, 0, 0, diskY); g.addColorStop(0, '#fff7e8'); g.addColorStop(1, '#f7e1c2');
    c.fillStyle = g; c.fillRect(0, 0, B, diskY);
    // Fliser i nederste del af vaeggen, hver med sin egen lille glans
    var fh = Math.max(26, (diskY - fliseY) / 4), fb = fh * 2;
    for (var r = 0; r < 4; r++) {
      var y = fliseY + r * fh;
      for (var x = (r % 2 ? -fb / 2 : 0); x < B; x += fb) {
        var fg = c.createLinearGradient(0, y, 0, y + fh); fg.addColorStop(0, '#fdebd3'); fg.addColorStop(1, '#f5dcbb');
        c.fillStyle = fg; c.beginPath(); c.roundRect(x + 2, y + 2, fb - 4, fh - 4, 5); c.fill();
        c.strokeStyle = 'rgba(120,80,40,.16)'; c.lineWidth = 1.5; c.stroke();
        c.strokeStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.moveTo(x + 8, y + 6); c.lineTo(x + fb * 0.5, y + 6); c.stroke();
      }
    }
    c.fillStyle = 'rgba(120,80,40,.22)'; c.fillRect(0, fliseY - 2, B, 3);

    for (var i = 0; i < n; i++) {
      var p = plan(i);
      if (p.vindue) {
        // Vindue med karm, gardinkappe i roede tern, himmel og en urtepotte paa karmen
        var vb = Math.min(190, B * 0.19), vh = vb * 0.94, vx = B - vb - 12, vy = Math.max(30, H * 0.04);
        skygge(c, function () { rr(c, vx, vy, vb, vh, 20, KRIDT); }, 12, 6, 0.2);
        rr(c, vx, vy, vb, vh, 20, null, KANT, 4.5);
        var gx = vx + 14, gy = vy + 14, gb = vb - 28, gh = vh - 28;
        c.save(); c.beginPath(); c.roundRect(gx, gy, gb, gh, 12); c.clip();
        var hg = c.createLinearGradient(0, gy, 0, gy + gh); hg.addColorStop(0, '#8fc7e8'); hg.addColorStop(1, '#dfeef0'); c.fillStyle = hg; c.fillRect(gx, gy, gb, gh);
        sky(c, gx + gb * 0.3, gy + gh * 0.36, gb * 0.1); sky(c, gx + gb * 0.78, gy + gh * 0.52, gb * 0.075);
        c.fillStyle = '#a3c98e'; c.fillRect(gx, gy + gh * 0.78, gb, gh * 0.3);
        c.fillStyle = '#7aa254'; c.beginPath(); c.ellipse(gx + gb * 0.6, gy + gh * 0.84, gb * 0.4, gh * 0.09, 0, 0, Math.PI * 2); c.fill();
        c.restore();
        c.strokeStyle = KANT; c.lineWidth = 4; c.beginPath(); c.roundRect(gx, gy, gb, gh, 12); c.stroke();
        c.beginPath(); c.moveTo(gx + gb / 2, gy); c.lineTo(gx + gb / 2, gy + gh); c.moveTo(gx, gy + gh / 2); c.lineTo(gx + gb, gy + gh / 2); c.stroke();
        c.save(); c.beginPath(); c.moveTo(vx, vy); c.lineTo(vx + vb, vy); c.lineTo(vx + vb, vy + 30);
        for (var kx = vx + vb; kx > vx; kx -= 30) c.arc(kx - 15, vy + 30, 15, 0, Math.PI, false);
        c.lineTo(vx, vy); c.closePath(); c.clip();
        c.fillStyle = '#d95f45'; c.fillRect(vx, vy, vb, 80);
        c.fillStyle = 'rgba(255,255,255,.35)';
        for (var tx = vx; tx < vx + vb; tx += 20) c.fillRect(tx, vy, 10, 80);
        for (var ty = vy; ty < vy + 80; ty += 20) c.fillRect(vx, ty, vb, 10);
        c.restore();
        c.strokeStyle = KANT; c.lineWidth = 3.5; c.beginPath();
        for (var kx2 = vx + vb; kx2 > vx; kx2 -= 30) c.arc(kx2 - 15, vy + 30, 15, 0, Math.PI, false);
        c.stroke();
        rr(c, vx - 10, vy + vh - 4, vb + 20, 16, 5, KRIDT, KANT, 4);
        potte(c, vx + vb - 22, vy + vh - 26, 44);
        // Redskaber under karmen: spatel, ske og piskeris
        var rs = Math.min(56, (diskY - (vy + vh + 22)) / 1.1);
        if (rs > 30) {
          rr(c, vx + 6, vy + vh + 14, vb * 0.62, 8, 4, '#a9a396', KANT, 3);
          redskab(c, vx + 26, vy + vh + 26, 'spatel', rs); redskab(c, vx + 26 + vb * 0.2, vy + vh + 26, 'ske', rs); redskab(c, vx + 26 + vb * 0.4, vy + vh + 26, 'pisker', rs);
        }
      }
      if (p.hyldeSkab) {
        // Hylde med krukker over kundens hoved
        var hx = p.x0 + (i === 0 ? 70 : 24), hb = Math.min(240, p.sw * 0.34), hy = Math.max(60, H * 0.085);
        var kb = hb * 0.22, kh = kb * 1.0;
        skygge(c, function () { rr(c, hx, hy, hb, 14, 5, '#d9a05b'); }, 10, 5, 0.25); rr(c, hx, hy, hb, 14, 5, null, KANT, 4);
        c.fillStyle = '#b27b3c'; c.strokeStyle = KANT; c.lineWidth = 3;
        [hx + 20, hx + hb - 38].forEach(function (bx) { c.beginPath(); c.moveTo(bx, hy + 14); c.lineTo(bx + 18, hy + 14); c.lineTo(bx, hy + 30); c.closePath(); c.fill(); c.stroke(); });
        krukke(c, hx + hb * 0.08, hy - kh - 2, kb, kh, '#fff2c8', '#bd7048', 'honning');
        krukke(c, hx + hb * 0.38, hy - kh * 1.08 - 2, kb, kh * 1.08, '#eef2f4', '#5a6069', 'maelk');
        krukke(c, hx + hb * 0.68, hy - kh * 0.92 - 2, kb, kh * 0.92, '#eef0dc', '#5c7a44', 'oliven');
      }
    }

    // Disk: bordplade med aarer i traeet, lys kant og skygge under kanten
    var d = c.createLinearGradient(0, diskY, 0, skabY); d.addColorStop(0, '#eec38a'); d.addColorStop(0.03, '#d9a05b'); d.addColorStop(1, '#bf8542');
    c.fillStyle = d; c.fillRect(0, diskY, B, skabY - diskY);
    c.save(); c.beginPath(); c.rect(0, diskY + 10, B, skabY - diskY - 10); c.clip();
    c.strokeStyle = 'rgba(90,55,20,.22)'; c.lineWidth = 2;
    for (var ay = diskY + 40; ay < skabY; ay += 34) {
      c.beginPath(); c.moveTo(0, ay);
      for (var ax = 0; ax <= B; ax += 64) c.quadraticCurveTo(ax + 32, ay + ((ax / 64) % 2 ? -5 : 5), ax + 64, ay);
      c.stroke();
    }
    var planke = (skabY - diskY) / 3.2;
    for (var py = diskY + planke; py < skabY - 10; py += planke) {
      c.strokeStyle = 'rgba(90,55,20,.5)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, py); c.lineTo(B, py); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.14)'; c.beginPath(); c.moveTo(0, py + 3); c.lineTo(B, py + 3); c.stroke();
    }
    c.restore();
    c.fillStyle = 'rgba(94,74,58,.22)'; c.fillRect(0, diskY, B, 8);
    c.fillStyle = 'rgba(255,255,255,.35)'; c.fillRect(0, diskY + 2, B, 2);
    // Underskab
    c.fillStyle = '#8a5a2b'; c.fillRect(0, skabY, B, H - skabY);
    c.fillStyle = '#6f4720'; c.fillRect(0, skabY, B, 14);
    c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, skabY + 40); c.lineTo(B, skabY + 40); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.moveTo(0, skabY + 43); c.lineTo(B, skabY + 43); c.stroke();
    c.fillStyle = MOERK; c.fillRect(0, diskY - 4, B, 5); c.fillRect(0, skabY - 3, B, 5);
    // To spillere: en vaeg imellem
    if (n === 2) { c.fillStyle = 'rgba(94,74,58,0.55)'; c.fillRect(B / 2 - 3, 0, 6, H); }
  }

  /* ---------- gaardens baggrund (pr. station, tegnet naar man er derude) ---------- */

  /*
   * Gaarden er malet i kode i samme akvarelstil som de malede billeder: flere
   * gennemsigtige lag i paletfarverne, ujaevne kanter, en lidt moerkere rand,
   * hvor farven samler sig, og papirkorn. Alt, der staar stille, males én gang
   * til et lag (baggrunden pr. stoerrelse, hver kilde pr. radius) og kopieres
   * ind pr. frame. Pladserne og stoerrelserne er de samme som foer: det er kun
   * malingen, der er skiftet.
   */

  /** Samme tal hver gang for samme navn, saa malingen ikke hopper, naar laget males igen. */
  function taelling(tekst) {
    var s = 7;
    for (var i = 0; i < tekst.length; i++) s = (s * 31 + tekst.charCodeAt(i)) % 2147483647;
    s = s || 1;
    return function () { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
  }
  function rgb(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }
  /** Farven h, moerkere (k < 1) eller lysere (k > 1, blandet med hvid), med alfa a. */
  function farvetone(h, k, a) {
    var v = rgb(h).map(function (t) { return Math.round(k <= 1 ? t * k : t + (255 - t) * (k - 1)); });
    return 'rgba(' + v[0] + ',' + v[1] + ',' + v[2] + ',' + (a === undefined ? 1 : a) + ')';
  }
  function nytLag(b, h) {
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.ceil(b * dpr)); c.height = Math.max(1, Math.ceil(h * dpr));
    var cx = c.getContext('2d'); cx.scale(dpr, dpr);
    return { c: c, cx: cx };
  }
  /** Papirkorn: smaa prikker, tegnet én gang og lagt over med lav styrke. */
  var kornLag = null;
  function korn(c, x, y, b, h, styrke) {
    if (!kornLag) {
      kornLag = document.createElement('canvas'); kornLag.width = kornLag.height = 160;
      var k = kornLag.getContext('2d'), t = taelling('korn');
      for (var i = 0; i < 3400; i++) {
        k.fillStyle = t() < 0.5 ? 'rgba(94,74,58,' + (0.03 + t() * 0.06).toFixed(3) + ')' : 'rgba(255,255,255,' + (0.05 + t() * 0.08).toFixed(3) + ')';
        k.fillRect(t() * 160, t() * 160, 1 + (t() < 0.2 ? 1 : 0), 1);
      }
    }
    c.save(); c.globalAlpha = styrke || 1; c.fillStyle = c.createPattern(kornLag, 'repeat'); c.fillRect(x, y, b, h); c.restore();
  }
  /** En ujaevn, rund form, som naar penslen saetter en klat: radius rx/ry med lidt stoej. */
  function klatSti(c, x, y, rx, ry, t, ujaevn, vinkel) {
    var n = 16, pts = [], v0 = t() * 6.28;
    for (var i = 0; i < n; i++) {
      var a = v0 + i / n * Math.PI * 2, f = 1 + (t() - 0.5) * ujaevn;
      var px = Math.cos(a) * rx * f, py = Math.sin(a) * ry * f;
      if (vinkel) { var cs = Math.cos(vinkel), sn = Math.sin(vinkel), q = px; px = q * cs - py * sn; py = q * sn + py * cs; }
      pts.push([x + px, y + py]);
    }
    c.beginPath();
    c.moveTo((pts[0][0] + pts[n - 1][0]) / 2, (pts[0][1] + pts[n - 1][1]) / 2);
    for (var k = 0; k < n; k++) { var p = pts[k], q2 = pts[(k + 1) % n]; c.quadraticCurveTo(p[0], p[1], (p[0] + q2[0]) / 2, (p[1] + q2[1]) / 2); }
    c.closePath();
  }
  /** En akvarelklat: en bloed yderkant, selve farven, en moerkere rand og et lyst sted, hvor vandet har loeftet farven. */
  function klat(c, x, y, rx, ry, farve, a, t, vinkel) {
    a = a === undefined ? 1 : a;
    c.save();
    c.fillStyle = farve;
    c.globalAlpha = a * 0.3; klatSti(c, x, y, rx * 1.07, ry * 1.07, t, 0.2, vinkel); c.fill();
    c.globalAlpha = a * 0.85; klatSti(c, x, y, rx, ry, t, 0.14, vinkel); c.fill();
    c.globalAlpha = a * 0.45; c.strokeStyle = farvetone(farve, 0.72); c.lineWidth = Math.max(1, Math.min(rx, ry) * 0.06); c.stroke();
    c.globalAlpha = a * 0.4; c.fillStyle = farvetone(farve, 1.28);
    klatSti(c, x - rx * 0.22, y - ry * 0.28, rx * 0.48, ry * 0.42, t, 0.3, vinkel); c.fill();
    c.restore();
  }
  /** Et penselstrøg gennem punkterne: en bred, gennemsigtig streg og en smallere oven i. */
  function stroeg(c, pts, farve, bredde, a) {
    c.save(); c.lineCap = 'round'; c.lineJoin = 'round';
    function sti2() {
      c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
      if (pts.length === 2) c.lineTo(pts[1][0], pts[1][1]);
      for (var i = 1; i < pts.length - 1; i++) {
        var p = pts[i], q = pts[i + 1], sidst = i === pts.length - 2;
        c.quadraticCurveTo(p[0], p[1], sidst ? q[0] : (p[0] + q[0]) / 2, sidst ? q[1] : (p[1] + q[1]) / 2);
      }
    }
    c.globalAlpha = (a || 1) * 0.5; c.strokeStyle = farvetone(farve, 0.75); c.lineWidth = bredde * 1.18; sti2(); c.stroke();
    c.globalAlpha = (a || 1) * 0.9; c.strokeStyle = farve; c.lineWidth = bredde; sti2(); c.stroke();
    c.globalAlpha = (a || 1) * 0.35; c.strokeStyle = farvetone(farve, 1.35); c.lineWidth = bredde * 0.35; c.translate(-bredde * 0.15, 0); sti2(); c.stroke();
    c.restore();
  }
  /** Et blad fra (x, y) mod spidsen: lys og moerk halvdel, en moerkere rand og en ribbe. */
  function blad(c, x, y, l, b, vinkel, farve, boej) {
    boej = boej || 0;
    c.save(); c.translate(x, y); c.rotate(vinkel);
    function form() { c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(b + boej, -l * 0.45, boej * 0.6, -l); c.quadraticCurveTo(-b + boej, -l * 0.5, 0, 0); c.closePath(); }
    c.fillStyle = farve; c.globalAlpha = 0.92; form(); c.fill();
    c.globalAlpha = 0.5; c.strokeStyle = farvetone(farve, 0.7); c.lineWidth = Math.max(1, b * 0.12); c.stroke();
    // den lyse halvdel
    c.globalAlpha = 0.35; c.fillStyle = farvetone(farve, 1.35);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(-b * 0.9 + boej, -l * 0.5, boej * 0.6, -l); c.quadraticCurveTo(boej * 0.3, -l * 0.5, 0, 0); c.fill();
    c.globalAlpha = 0.4; c.strokeStyle = farvetone(farve, 0.62); c.lineWidth = Math.max(1, b * 0.1);
    c.beginPath(); c.moveTo(0, 0); c.quadraticCurveTo(boej * 0.4, -l * 0.5, boej * 0.6, -l * 0.92); c.stroke();
    c.restore();
  }

  var gaardLag = null, gaardLagFor = '';
  /** Himmel, sol, bakker, mark og hegn, malet én gang i stationens stoerrelse. */
  function malGaard(sw, H) {
    var l = nytLag(sw, H), c = l.cx, t = taelling('gaard' + Math.round(sw));
    // Himlen: en vask fra blaa til lys, med lyse og blaa skyer af vand
    var g = c.createLinearGradient(0, 0, 0, H * 0.48);
    g.addColorStop(0, '#8fc7e8'); g.addColorStop(0.65, '#cfe5ef'); g.addColorStop(1, '#f3efe2');
    c.fillStyle = g; c.fillRect(0, 0, sw, H * 0.5);
    for (var i = 0; i < 9; i++) {
      c.fillStyle = i % 3 ? '#ffffff' : '#8fc7e8'; c.globalAlpha = 0.22;
      klatSti(c, t() * sw, t() * H * 0.38, sw * (0.16 + t() * 0.2), H * (0.012 + t() * 0.02), t, 0.3); c.fill();
    }
    c.globalAlpha = 1;
    // Solen: et varmt skin, saa en klat i lag
    var sx = sw * 0.9, sy = H * 0.06, sr = sw * 0.04;
    var sg = c.createRadialGradient(sx, sy, sr * 0.5, sx, sy, sr * 3);
    sg.addColorStop(0, 'rgba(240,196,106,.45)'); sg.addColorStop(1, 'rgba(240,196,106,0)');
    c.fillStyle = sg; c.fillRect(sx - sr * 3, sy - sr * 3, sr * 6, sr * 6);
    c.fillStyle = '#f0c46a';
    c.globalAlpha = 0.35; klatSti(c, sx, sy, sr * 1.15, sr * 1.12, t, 0.12); c.fill();
    c.globalAlpha = 0.85; klatSti(c, sx, sy, sr, sr * 0.98, t, 0.08); c.fill();
    c.fillStyle = '#f6dc9c'; c.globalAlpha = 0.7; klatSti(c, sx - sr * 0.15, sy - sr * 0.15, sr * 0.6, sr * 0.55, t, 0.2); c.fill();
    c.globalAlpha = 1;
    // Bakkerne: fjerne, blaalige bagerst og varmere grønne forrest
    klat(c, sw * 0.85, H * 0.465, sw * 0.42, H * 0.065, '#a9c9a0', 0.75, t);
    klat(c, sw * 0.3, H * 0.475, sw * 0.52, H * 0.085, '#b3d18e', 0.8, t);
    klat(c, sw * 0.62, H * 0.49, sw * 0.4, H * 0.06, '#93bc63', 0.5, t);
    // Marken: en boelgende kant mod bakkerne, ikke en lige linje
    var m = c.createLinearGradient(0, H * 0.45, 0, H);
    m.addColorStop(0, '#a8cb8d'); m.addColorStop(0.5, '#93bc63'); m.addColorStop(1, '#7c9f52');
    var f1 = t() * 6, f2 = t() * 6;
    c.fillStyle = m; c.beginPath(); c.moveTo(0, H);
    for (var mx = 0; mx <= sw + 8; mx += 8) c.lineTo(mx, H * (0.478 + 0.01 * Math.sin(mx / sw * 5 + f1) + 0.005 * Math.sin(mx / sw * 13 + f2)));
    c.lineTo(sw, H); c.closePath(); c.fill();
    c.globalAlpha = 0.35; c.strokeStyle = '#c4dca5'; c.lineWidth = 3; c.stroke(); c.globalAlpha = 1;
    // vaade, flade strøg i marken, som naar penslen er traekket hen over papiret
    for (var j = 0; j < 14; j++) {
      var wy = H * (0.52 + t() * 0.44);
      c.fillStyle = ['#b3d18e', '#8fae86', '#93bc63', '#c4dca5'][j % 4]; c.globalAlpha = 0.18;
      klatSti(c, t() * sw, wy, sw * (0.12 + t() * 0.2), H * (0.012 + t() * 0.018), t, 0.3); c.fill();
    }
    c.globalAlpha = 1;
    // Graesstraa og smaa blomster, spredt ud over marken
    c.lineCap = 'round';
    for (var s = 0; s < sw * H / 2600; s++) {
      var gx = t() * sw, gy = H * (0.5 + t() * 0.5), gl = H * (0.008 + t() * 0.014) * (0.6 + (gy / H - 0.5));
      c.strokeStyle = t() < 0.6 ? 'rgba(95,130,64,.35)' : 'rgba(184,214,140,.45)'; c.lineWidth = 1.3 + t();
      c.beginPath(); c.moveTo(gx, gy); c.quadraticCurveTo(gx + gl * 0.2, gy - gl * 0.6, gx + (t() - 0.5) * gl, gy - gl); c.stroke();
    }
    var blomster = ['#f8f1e6', '#f0c46a', '#9b7bd4', '#e08a52'];
    for (var f = 0; f < sw * H / 26000; f++) {
      var bx = t() * sw, by = H * (0.52 + t() * 0.44), br = 1.6 + t() * 1.6;
      c.fillStyle = blomster[f % 4]; c.globalAlpha = 0.75;
      for (var kb = 0; kb < 4; kb++) { c.beginPath(); c.arc(bx + Math.cos(kb * 1.57) * br, by + Math.sin(kb * 1.57) * br, br, 0, 7); c.fill(); }
      c.fillStyle = '#f0c46a'; c.beginPath(); c.arc(bx, by, br * 0.6, 0, 7); c.fill();
      c.globalAlpha = 1;
    }
    // Hegnet nederst: malede pæle og to rafter, samme sted som altid
    function braet(x, y, b, h, farve) {
      c.save(); c.beginPath(); c.roundRect(x, y, b, h, Math.min(b, h) * 0.35); c.clip();
      c.fillStyle = farve; c.globalAlpha = 1; c.fillRect(x, y, b, h);
      c.fillStyle = farvetone(farve, 1.3, 0.45); c.fillRect(x, y, b, Math.max(1.5, h * 0.3));
      c.fillStyle = farvetone(farve, 1.3, 0.35); c.fillRect(x, y, Math.max(1.5, b * 0.3), h);
      c.strokeStyle = farvetone(farve, 0.7, 0.35); c.lineWidth = 1;
      for (var k = 0; k < 2; k++) { var ly = y + h * (0.3 + t() * 0.5); c.beginPath(); c.moveTo(x + 2, ly); c.lineTo(x + b - 2, ly + (t() - 0.5) * 2); c.stroke(); }
      c.restore();
      c.globalAlpha = 0.55; c.strokeStyle = farvetone(farve, 0.68); c.lineWidth = 1.5; c.beginPath(); c.roundRect(x, y, b, h, Math.min(b, h) * 0.35); c.stroke();
      c.globalAlpha = 1;
    }
    c.fillStyle = 'rgba(94,74,58,.12)'; c.fillRect(0, H * 0.975, sw, H * 0.012);
    for (var x = 20; x < sw; x += 54) {
      c.fillStyle = 'rgba(94,74,58,.12)'; c.beginPath(); c.ellipse(x + 6, H * 0.982, 11, 3, 0, 0, 7); c.fill();
      braet(x, H * 0.9, 10, H * 0.08, t() < 0.5 ? '#d9ba8a' : '#cfae7c');
    }
    braet(-4, H * 0.915, sw + 8, 7, '#d9ba8a');
    braet(-4, H * 0.95, sw + 8, 7, '#cfae7c');
    // Graestuer ved pælene
    for (var x2 = 20; x2 < sw; x2 += 54) {
      for (var gs = 0; gs < 5; gs++) {
        var tx = x2 + 5 + (gs - 2) * 4, ty = H * 0.985, tl = H * (0.012 + t() * 0.012);
        c.strokeStyle = gs % 2 ? 'rgba(95,130,64,.6)' : 'rgba(147,188,99,.7)'; c.lineWidth = 1.6;
        c.beginPath(); c.moveTo(tx, ty); c.quadraticCurveTo(tx + (gs - 2) * 1.5, ty - tl * 0.6, tx + (gs - 2) * 3, ty - tl); c.stroke();
      }
    }
    korn(c, 0, 0, sw, H, 1);
    return l.c;
  }
  var skyLag = {};      // toemmes ikke: der er kun to skystoerrelser pr. skaerm
  /** En malet sky: hvide klatter i lag med en blaalig skygge forneden. */
  function malSky(r) {
    var n = Math.round(r);
    if (skyLag[n + '@' + dpr]) return skyLag[n + '@' + dpr];
    var b = r * 4.4, h = r * 2.6, l = nytLag(b, h), c = l.cx, t = taelling('sky' + n), cx0 = b / 2, cy0 = h * 0.55;
    klat(c, cx0, cy0 + r * 0.35, r * 1.9, r * 0.5, '#aed3e4', 0.35, t);
    [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.25, 0.75], [0.5, -0.35, 0.65]].forEach(function (d) { klat(c, cx0 + d[0] * r, cy0 + d[1] * r, r * d[2], r * d[2] * 0.9, '#ffffff', 0.8, t); });
    klat(c, cx0 - r * 0.2, cy0 - r * 0.2, r * 0.6, r * 0.45, '#ffffff', 0.7, t);
    skyLag[n + '@' + dpr] = { c: l.c, b: b, h: h };
    return skyLag[n + '@' + dpr];
  }
  function tegnSky(x, y, r) {
    var s = malSky(r);
    ctx.drawImage(s.c, x - s.b / 2, y - s.h * 0.55, s.b, s.h);
  }

  function tegnGaardBaggrund(p) {
    var H = window.innerHeight, x0 = p.x0, sw = p.sw, noegle = Math.round(sw) + 'x' + H + '@' + dpr;
    if (gaardLagFor !== noegle) { gaardLag = malGaard(sw, H); gaardLagFor = noegle; }
    ctx.drawImage(gaardLag, x0, 0, sw, H);
    tegnSky(x0 + sw * 0.2 + Math.sin(tid * 0.2) * 10, H * 0.12, sw * 0.03); tegnSky(x0 + sw * 0.75 + Math.sin(tid * 0.25 + 2) * 10, H * 0.08, sw * 0.035);
  }

  /* ---------- dag ---------- */

  function nyVisning() {
    return { ind: 0, flyvere: [], ryst: null, serverer: 0, gammel: null, bobleTil: 0, bobleInd: 0, sidsteUps: -9, vend: 0, vink: 0, bidder: 0, rul: 0, haeld: 0,
      rengoer: null, glimt: 0, gaard: null, betaler: false, betalt: 0, kasseRyst: 0, gaar: null, hentHop: 0, kvit: 0 };
  }

  function nyDag(spillere) {
    antalSpillere = spillere;
    dag = K.nyDag(spillere, svaerhed, friLeg);
    visning = dag.stationer.map(function () { return nyVisning(); });
    serverede = [];
    partikler = [];
    tilstand = 'spiller';
    lagFor = '';
    melodi([660, 880], 120);
    dag.stationer.forEach(function (s, i) { kundeKommer(i, i * 0.9); });
  }

  function kundeKommer(i, forsinkelse) {
    var v = visning[i];
    v.ind = -(forsinkelse || 0);
    v.bobleInd = 0;
    v.bobleTil = tid + (forsinkelse || 0) + 0.6 + ((!friLeg && K.INDSTIL.huskeTid[svaerhed]) || 1e9);
    setTimeout(function () {
      if (tilstand !== 'spiller' || !dag.stationer[i].bestilling) return;
      tone(880, 0.12, 0.08);
      if (tid >= talerTil) sigBestilling(dag.stationer[i].bestilling);
    }, ((forsinkelse || 0) + 0.55) * 1000);
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 300) return;
      var v = Math.random() * Math.PI * 2, f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f - fart * 0.4, liv: liv, maxLiv: liv, r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }
  function hjerter(x, y) {
    for (var i = 0; i < 6; i++) partikler.push({ x: x + (Math.random() - 0.5) * 60, y: y, vx: (Math.random() - 0.5) * 40, vy: -70 - Math.random() * 60, liv: 1.4, maxLiv: 1.4, r: 16 + Math.random() * 10, hjerte: true });
  }
  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      if (!p.hjerte) p.vy += 500 * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.liv -= dt;
      if (p.liv <= 0) partikler.splice(i, 1);
    }
  }
  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv);
      if (p.hjerte) tegnBillede('hjerte', p.x, p.y, p.r * 2);
      else { ctx.fillStyle = p.farve; ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill(); }
    });
    ctx.globalAlpha = 1;
  }

  /* ---------- tryk ---------- */

  // Hver finger foelges for sig via pointerId, saa to boern kan rulle, vende og toerre af samtidig
  var fingre = {};

  function sted(e) {
    var r = lærred.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  /** Et trin i tilberedningen er taget: lyd, stoev og damp. */
  function forberedTrin(i) {
    var p = plan(i), v = visning[i], s = dag.stationer[i];
    if (!K.forbered(dag, i)) return;
    v.vend = 0.35; v.rul = 0; v.haeld = 0;
    var ret = s.bestilling.ret;
    if (ret === 'pizza') { tone(300 + s.forberedt * 80, 0.12, 0.12, 'sine'); puf(p.ret.x, p.ret.y, '#fff', 10, 160, 4, 0.5); }
    else { syd(0.35); tone(ret === 'burger' ? 200 : 440 + s.forberedt * 110, 0.1, 0.08); puf(p.ret.x, p.ret.y - p.ret.r * 0.3, 'rgba(255,255,255,0.7)', 6, 90, 6, 0.6); }
    if (K.forberedtFaerdig(dag, i)) setTimeout(function () { melodi([660, 990], 90); }, 200);
  }

  /** Laeg en ingrediens paa. Den flyver fra (fx, fy): hyldeknappen ved et tryk, fingeren ved et traek. */
  function laegPaa(i, ting, fx, fy) {
    var v = visning[i], s = dag.stationer[i];
    var svar = K.laeg(dag, i, ting);
    if (svar === 'ok') {
      v.flyvere.push({ ting: ting, fx: fx, fy: fy, t: 0, plads: s.lagt.length - 1 });
      tone(520 + s.lagt.length * 90, 0.1, 0.12);
      if (K.klar(dag, i)) setTimeout(function () { melodi([880, 1100], 90); }, 250);
    } else if (svar === 'hent') {
      startGaard(i);
    } else {
      // Forkert: den hopper bare tilbage. Ingen straf.
      v.ryst = { ting: ting, t: 0.45 };
      melodi([330, 262], 110);
      v.bobleTil = Math.max(v.bobleTil, tid + 2.5);      // vis bestillingen igen, saa man kan se hvad der mangler
      if (!friLeg && tid - v.sidsteUps > 6 && tid >= talerTil) { v.sidsteUps = tid; afspil('ups.mp3', 'Ups, det bestilte jeg ikke.', 2.2); }
    }
  }

  /* Gaarden: den ting, der mangler paa hylden, hentes der, hvor den kommer fra */

  function startGaard(i) {
    var v = visning[i], s = dag.stationer[i];
    if (v.gaard || !s.hent || s.hentet) return;
    v.gaard = { ting: s.hent, t: 0, fundet: null, ryst: null, tanke: null, spand: 0, kvit: 0 };
    melodi([523, 659, 784], 90);
    var navn = BESTEMT[s.hent] || K.INGREDIENSER[s.hent].navn;
    setTimeout(function () { if (v.gaard && tid >= talerTil - 1) afspil('hvor_' + s.hent + '.mp3', 'Hvor kommer ' + navn + ' fra?', 2.4); }, 500);
  }

  function gaardTryk(i, kildeNavn, kx, ky) {
    var v = visning[i], s = dag.stationer[i], g = v.gaard;
    if (!g || g.fundet) return;
    var kilde = K.KILDER[kildeNavn];
    // Koen: skal der ost eller smoer, malkes der foerst, saa bliver maelken til det
    if (kilde.malk && kilde.malk.indexOf(g.ting) >= 0 && g.spand < 1) {
      g.spand = 1; g.spandT = 0;
      tone(392, 0.2, 0.1, 'sine'); tone(330, 0.3, 0.08, 'sine');
      puf(kx, ky, '#fff', 8, 90, 4, 0.5);
      return;
    }
    if (K.hent(dag, i, kildeNavn) === 'ok') {
      g.fundet = { x: kx, y: ky, t: 0 };
      melodi([660, 880, 1100, 1320], 90);
      puf(kx, ky, '#f0c46a', 14, 160, 5, 0.7);
      var navn = BESTEMT[g.ting] || K.INGREDIENSER[g.ting].navn;
      afspil('fra_' + g.ting + '.mp3', 'Ja! ' + navn.charAt(0).toUpperCase() + navn.slice(1) + ' kommer fra ' + kilde.navn + '.', 2.6);
    } else {
      // Forkert kilde: den vipper og viser, hvad den giver. Ingen straf.
      g.ryst = { kilde: kildeNavn, t: 0.5 };
      g.tanke = { kilde: kildeNavn, t: 1.8, x: kx, y: ky };
      melodi([330, 262], 110);
    }
  }

  /* Regningen: naar kunden har spist, betales der med moenter */

  function startBetaling(i) {
    var v = visning[i];
    v.betaler = true; v.betalt = 0; v.bobleInd = 0; v.bobleTil = tid + 1e9;
    melodi([523, 659], 100);
    // Foerst "Hvad koster det?", saa regnestykket med tal: "to plus to plus en er lig med"
    setTimeout(function () { if (v.betaler) afspil('regning.mp3', 'Hvad koster det?', 1.6); }, 400);
    setTimeout(function () { if (v.betaler && dag.stationer[i].regning) sigRegning(dag.stationer[i].regning); }, 2100);
  }

  function betalMed(i, moent, fx, fy) {
    var v = visning[i], s = dag.stationer[i], p = plan(i);
    if (!v.betaler || !s.regning) return;
    var gammelKunde = s.kunde;
    var svar = K.betal(dag, i, moent);
    if (svar === 'forkert') {
      v.ryst = { ting: 'moent' + moent, t: 0.45 }; v.kasseRyst = 0.4;
      melodi([330, 262], 110);
      return;
    }
    v.flyvere.push({ ting: 'moent', moent: moent, fx: fx, fy: fy, t: 0, plads: v.betalt });
    v.betalt += moent;
    tone(1046 + moent * 60, 0.12, 0.12, 'sine');
    // Stemmen taeller med: den loebende sum for hver moent, og facit til sidst
    var sum = v.betalt;
    if (svar === 'klar') {
      v.betaler = false;
      v.kvit = 1.2;
      setTimeout(function () { sigTal(sum, '!'); }, 250);
      setTimeout(function () {
        melodi([660, 880, 1100], 90);
        hjerter(p.kunde.x, p.kunde.y - p.kunde.str * 0.3);
        var n = Math.floor(Math.random() * TAK.length); afspil('tak_' + (n + 1) + '.mp3', TAK[n], 2);
      }, 1300);
      // Kunden gaar, saa toerres der af, og den naeste kommer
      v.gaar = { kunde: gammelKunde, t: 2.2 };
    } else {
      setTimeout(function () { if (v.betaler) sigTal(sum); }, 250);
    }
  }

  /* Rengoering: naar kunden er gaaet, toerres tallerken og disk af med svampen */

  function startRengoering(i) {
    var pletter = [], antal = 3 + Math.floor(Math.random() * 3);
    for (var k = 0; k < antal; k++) {
      var vinkel = (k / antal) * Math.PI * 2 + Math.random() * 0.8;
      pletter.push({ dx: Math.cos(vinkel) * (0.5 + Math.random() * 0.9), dy: Math.sin(vinkel) * 0.45, styrke: 1, form: Math.random() * 6, farve: ['#8a5236', '#c8624a', '#e8b96a', '#7a5638'][k % 4] });
    }
    visning[i].rengoer = { pletter: pletter };
  }

  function pletSted(p, plet) { return { x: p.ret.x + plet.dx * p.ret.r, y: p.ret.y + p.ret.r * 0.2 + plet.dy * p.ret.r, r: p.ret.r * 0.34 }; }

  function toer(i, x, y, maengde) {
    var v = visning[i], p = plan(i);
    if (!v.rengoer) return;
    v.rengoer.pletter.forEach(function (plet) {
      if (plet.styrke <= 0) return;
      var st = pletSted(p, plet);
      if (Math.hypot(x - st.x, y - st.y) < st.r * 1.5) {
        plet.styrke -= maengde;
        if (Math.random() < 0.5) puf(x, y, 'rgba(255,255,255,0.85)', 1, 60, 5, 0.5);
        if (plet.styrke <= 0) { tone(900 + Math.random() * 400, 0.1, 0.1, 'sine'); puf(st.x, st.y, '#cfe6f2', 8, 120, 4, 0.5); }
      }
    });
    if (v.rengoer.pletter.every(function (pl) { return pl.styrke <= 0; })) {
      v.rengoer = null;
      v.glimt = 0.8;
      melodi([880, 1175, 1568], 80);
      if (dag.faerdig) { if (alleFaerdige()) setTimeout(afslut, 600); }
      else kundeKommer(i, 0.4);
    }
  }

  function alleFaerdige() { return visning.every(function (x) { return x.serverer <= 0 && !x.rengoer && !x.betaler && !x.gaar; }); }

  function ned(e) {
    if (tilstand !== 'spiller') return;
    var pos = sted(e), x = pos.x, y = pos.y;
    for (var i = 0; i < dag.stationer.length; i++) {
      var p = plan(i), v = visning[i], s = dag.stationer[i];
      if (x < p.x0 || x >= p.x0 + p.sw) continue;
      if (v.rengoer) { fingre[e.pointerId] = { type: 'svamp', i: i, x: x, y: y }; toer(i, x, y, 0.5); return; }
      if (v.gaard) {
        if (v.gaard.fundet) return;
        for (var q = 0; q < p.kilder.length; q++) {
          var kl = p.kilder[q];
          if (Math.hypot(x - kl.x, y - kl.y) < kl.r * 1.2) { gaardTryk(i, kl.kilde, kl.x, kl.y); return; }
        }
        return;
      }
      if (v.betaler) {
        for (var m = 0; m < p.moenter.length; m++) {
          var mo = p.moenter[m];
          if (Math.hypot(x - mo.x, y - mo.y) < mo.r * 1.2) { betalMed(i, mo.moent, mo.x, mo.y); return; }
        }
        // Kunden eller boblen: hoer regnestykket igen
        var iB = x > p.boble.x && x < p.boble.x + p.boble.b && y > p.boble.y && y < p.boble.y + p.boble.h;
        if (iB || Math.hypot(x - p.kunde.x, y - p.kunde.y) < p.kunde.str * 0.6) sigRegning(s.regning);
        return;
      }
      if (v.serverer > 0 || v.gaar || v.ind < 1 || !s.bestilling) return;      // kunden er paa vej ind eller ud

      // Kunden eller boblen: hoer og se bestillingen igen
      var iBoble = x > p.boble.x && x < p.boble.x + p.boble.b && y > p.boble.y && y < p.boble.y + p.boble.h;
      if (iBoble || Math.hypot(x - p.kunde.x, y - p.kunde.y) < p.kunde.str * 0.6) {
        v.bobleTil = tid + ((!friLeg && K.INDSTIL.huskeTid[svaerhed]) || 1e9);
        sigBestilling(s.bestilling);
        return;
      }
      // Hylden: den ting, der mangler, sender én paa gaarden, ogsaa foer retten er lavet
      for (var k = 0; k < p.knapper.length; k++) {
        var kn = p.knapper[k];
        if (Math.hypot(x - kn.x, y - kn.y) < kn.r * 1.15 && kn.ting === s.hent && !s.hentet) { startGaard(i); return; }
      }
      // Foerst laves retten. Pizza: rul dejen ud med fingeren. Burger: svirp boeffen op i luften.
      // Pandekager: hold fingeren paa panden og haeld dej paa. Et almindeligt tryk taeller altid som et trin,
      // saa ingen sidder fast, hvis bevaegelsen driller.
      if (!K.forberedtFaerdig(dag, i)) {
        if (Math.hypot(x - p.ret.x, y - p.ret.y) < p.ret.r * 1.7) {
          var type = { pizza: 'rul', burger: 'vend', pandekager: 'haeld' }[s.bestilling.ret];
          fingre[e.pointerId] = { type: type, i: i, x: x, y: y, y0: y, talt: false };
        } else if (y > window.innerHeight * 0.76) {
          v.vink = 0.6;                       // tryk paa hylden for tidligt: retten vinker
        }
        return;
      }
      // Klokken
      if (Math.hypot(x - p.klokke.x, y - p.klokke.y) < p.klokke.r * 1.15) {
        if (K.klar(dag, i)) server(i, p);
        else { v.ryst = { ting: 'klokke', t: 0.4 }; tone(240, 0.15, 0.08); }
        return;
      }
      // Hylden: tryk, eller traek ingrediensen op paa retten
      for (var k2 = 0; k2 < p.knapper.length; k2++) {
        var kn2 = p.knapper[k2];
        if (Math.hypot(x - kn2.x, y - kn2.y) < kn2.r * 1.15) {
          fingre[e.pointerId] = { type: 'traek', i: i, ting: kn2.ting, kx: kn2.x, ky: kn2.y, x: x, y: y, flyttet: false };
          return;
        }
      }
      return;
    }
  }

  function flyt(e) {
    var f = fingre[e.pointerId];
    if (!f || tilstand !== 'spiller') return;
    var pos = sted(e), d = Math.hypot(pos.x - f.x, pos.y - f.y);
    var v = visning[f.i], p = plan(f.i);
    if (f.type === 'svamp') {
      toer(f.i, pos.x, pos.y, d / 110);
    } else if (f.type === 'rul' && !K.forberedtFaerdig(dag, f.i)) {
      if (Math.hypot(pos.x - p.ret.x, pos.y - p.ret.y) < p.ret.r * 2) {
        v.rul = (v.rul || 0) + d / (p.ret.r * 2.2);
        f.talt = true;
        if (Math.random() < 0.15) puf(pos.x, pos.y, '#fff', 1, 70, 3, 0.4);
        if (v.rul >= 1) forberedTrin(f.i);
      }
    } else if (f.type === 'vend' && !f.talt && f.y0 - pos.y > 40) {
      f.talt = true;
      forberedTrin(f.i);
    } else if (f.type === 'traek') {
      if (Math.hypot(pos.x - f.kx, pos.y - f.ky) > 24) f.flyttet = true;
    }
    f.x = pos.x; f.y = pos.y;
  }

  function op(e) {
    var f = fingre[e.pointerId];
    if (!f) return;
    delete fingre[e.pointerId];
    if (tilstand !== 'spiller' || e.type === 'pointercancel') return;
    if (f.type === 'traek') {
      if (!f.flyttet) laegPaa(f.i, f.ting, f.kx, f.ky);
      else if (f.y < window.innerHeight * 0.76) laegPaa(f.i, f.ting, f.x, f.y);
    } else if ((f.type === 'rul' || f.type === 'vend' || f.type === 'haeld') && !f.talt && !K.forberedtFaerdig(dag, f.i)) {
      forberedTrin(f.i);              // et almindeligt tryk
    }
  }

  function server(i, p) {
    var s = dag.stationer[i], v = visning[i];
    v.gammel = { kunde: s.kunde, bestilling: s.bestilling, lagt: s.lagt.slice() };
    serverede.push(s.kunde);
    v.serverer = 2.0;
    v.flyvere = [];
    K.server(dag, i);
    tone(1320, 0.5, 0.16, 'sine'); setTimeout(function () { tone(1760, 0.6, 0.12, 'sine'); }, 90);
    setTimeout(function () {
      melodi([660, 880, 1100], 90);
      if (!s.regning) {
        hjerter(p.kunde.x, p.kunde.y - p.kunde.str * 0.3);
        if (tid >= talerTil) { var n = Math.floor(Math.random() * TAK.length); afspil('tak_' + (n + 1) + '.mp3', TAK[n], 2); }
      }
    }, 650);
  }

  /* ---------- opdatering ---------- */

  function opdater(dt) {
    visning.forEach(function (v, i) {
      var s = dag.stationer[i];
      if (v.ind < 1) v.ind = Math.min(1, v.ind + dt * 2.2);
      if (v.ind >= 1 && v.bobleInd < 1) v.bobleInd = Math.min(1, v.bobleInd + dt * 3.5);
      v.flyvere.forEach(function (f) { f.t = Math.min(1, f.t + dt * 3.6); });
      v.vend = Math.max(0, v.vend - dt); v.vink = Math.max(0, v.vink - dt); v.glimt = Math.max(0, v.glimt - dt);
      v.kasseRyst = Math.max(0, v.kasseRyst - dt); v.kvit = Math.max(0, v.kvit - dt);
      v.hentHop = (v.hentHop + dt) % 3;
      if (v.gaard) {
        var g = v.gaard;
        g.t = Math.min(1, g.t + dt * 2.5);
        if (g.spand >= 1) g.spandT = Math.min(1, (g.spandT || 0) + dt * 2);
        if (g.ryst) { g.ryst.t -= dt; if (g.ryst.t <= 0) g.ryst = null; }
        if (g.tanke) { g.tanke.t -= dt; if (g.tanke.t <= 0) g.tanke = null; }
        if (g.fundet) {
          g.fundet.t += dt;
          if (g.fundet.t > 1.6) { v.gaard = null; v.glimt = 0.6; melodi([784, 1046], 90); }
        }
      }
      // Pandekager: dejen loeber ud paa panden, mens fingeren holdes nede
      Object.keys(fingre).forEach(function (id) {
        var f = fingre[id];
        if (f.i !== i || f.type !== 'haeld' || f.talt || K.forberedtFaerdig(dag, i)) return;
        v.haeld += dt / 0.55;
        if (Math.random() < 0.3) tone(500 + v.haeld * 300, 0.05, 0.03, 'sine');
        if (v.haeld >= 1) { f.talt = true; forberedTrin(i); }
      });
      if (!Object.keys(fingre).some(function (id) { return fingre[id].i === i && fingre[id].type === 'haeld' && !fingre[id].talt; })) v.haeld = 0;
      if (v.serverer > 0) {
        var bt = 2.0 - v.serverer, skal = bt > 1.3 ? 3 : bt > 1.05 ? 2 : bt > 0.8 ? 1 : 0;
        if (skal > v.bidder) {
          v.bidder = skal;
          var pl = plan(i);
          tone(180 - skal * 20, 0.09, 0.14, 'square');
          puf(pl.kunde.x + pl.kunde.str * 0.1, pl.kunde.y + pl.kunde.str * 0.4, '#e8b96a', 8, 140, 4, 0.5);
        }
      }
      if (v.ryst) { v.ryst.t -= dt; if (v.ryst.t <= 0) v.ryst = null; }
      if (v.serverer > 0) {
        v.serverer -= dt;
        if (v.serverer <= 0) {
          v.serverer = 0; v.bidder = 0;
          if (s.regning) { startBetaling(i); }          // kunden bliver siddende og betaler
          else { v.gammel = null; startRengoering(i); }  // fri leg: kunden er gaaet, toer af
        }
      }
      if (v.betaler && !s.regning) { v.betaler = false; v.gaar = { kunde: s.kunde, t: 1.0 }; }   // dagen sluttede midt i det
      if (v.gaar) {
        v.gaar.t -= dt;
        if (v.gaar.t <= 0) { v.gaar = null; v.gammel = null; v.flyvere = []; startRengoering(i); }
      }
    });
    opdaterPartikler(dt);
  }

  /* ---------- tegning af retterne ---------- */

  /**
   * Maleren: en blod overgang fra midten og ud. Bruges i stedet for en flad
   * farve, saa tingene ser malede ud i stedet for udklippede. Geometrien er
   * uroert — det er kun fyldet, der skifter.
   */
  /*
   * Overgangene genbruges. At lave dem forfra hver frame koster 2,7 ms pr.
   * billede — maalt som den eneste forskel mellem to ellers ens udgaver, og
   * nok til at tage spillet fra 60 til 51 billeder i sekundet. De fleste af
   * dem staar stille (tallerkenen, panden, bollen, pandekagerne), saa noeglen
   * rammer plet hver gang. De faa, der bevaeger sig — dejen, boeffen, den
   * flyvende pandekage — laver en ny hver frame ligesom foer, og cachen
   * toemmes, naar den bliver for stor, saa den ikke vokser i det uendelige.
   */
  var overgange = {}, overgangAntal = 0;
  function husk(noegle, lav) {
    var g = overgange[noegle];
    if (!g) {
      if (overgangAntal > 300) { overgange = {}; overgangAntal = 0; }
      g = overgange[noegle] = lav();
      overgangAntal++;
    }
    return g;
  }
  /**
   * Et lille lysstroeg i stedet for en overgang over hele fladen. At MALE en
   * overgang ud over et stort felt koster 2,7 ms pr. billede — det er selve
   * udfyldningen, ikke det at lave den (en cache aendrede intet). Derfor faar
   * de store flader en flad farve og saa dette streg, som kun daekker en
   * brokdel af arealet.
   */
  function glans(x, y, rb, rh, styrke) {
    ctx.save();
    ctx.fillStyle = 'rgba(255,255,255,' + styrke + ')';
    ctx.beginPath(); ctx.ellipse(x, y, rb, rh, -0.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
  function blod(x, y, r0, r1, indre, ydre) {
    return husk('b' + (x | 0) + ',' + (y | 0) + ',' + (r0 | 0) + ',' + (r1 | 0) + indre + ydre, function () {
      var g = ctx.createRadialGradient(x, y, r0, x, y, r1);
      g.addColorStop(0, indre); g.addColorStop(1, ydre);
      return g;
    });
  }
  function lodret(y0, y1, oeverst, nederst) {
    return husk('l' + (y0 | 0) + ',' + (y1 | 0) + oeverst + nederst, function () {
      var g = ctx.createLinearGradient(0, y0, 0, y1);
      g.addColorStop(0, oeverst); g.addColorStop(1, nederst);
      return g;
    });
  }


  function tallerken(x, y, r) {
    ctx.fillStyle = 'rgba(94,74,58,0.16)';
    ctx.beginPath(); ctx.ellipse(x + 3, y + r * 0.2, r * 1.2, r * 0.52, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fbf6ec';
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    glans(x - r * 0.45, y - r * 0.07, r * 0.28, r * 0.09, 0.5);
    ctx.strokeStyle = '#8fc7e8'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.02, r * 0.43, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(94,74,58,.16)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.12, r * 0.85, r * 0.34, 0, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.95)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.15, r * 0.5, 0, Math.PI * 1.15, Math.PI * 1.5); ctx.stroke();
  }

  /** Daekkeservietten under tallerkenen: roed med syet kant. Det er ogsaa zonen, man laegger ting i. */
  function serviet(x, y, r, lys) {
    ctx.fillStyle = 'rgba(94,74,58,0.14)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.45, r * 1.55, r * 0.68, 0, 0, Math.PI * 2); ctx.fill();
    var dug = ctx.createRadialGradient(x - r * 0.4, y + r * 0.1, r * 0.2, x, y + r * 0.4, r * 1.6);
    dug.addColorStop(0, lys ? '#eb9880' : '#e07a63');
    dug.addColorStop(0.7, lys ? '#dd7a63' : '#d16450');
    dug.addColorStop(1, '#a8483a');
    ctx.fillStyle = dug; ctx.strokeStyle = 'rgba(94,74,58,0.3)'; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.4, r * 1.5, r * 0.64, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.save(); ctx.setLineDash([8, 6]); ctx.strokeStyle = 'rgba(255,255,255,' + (lys ? 0.95 : 0.65) + ')'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.4, r * 1.36, r * 0.53, 0, 0, Math.PI * 2); ctx.stroke(); ctx.restore();
  }

  function tegnPizza(x, y, r, lagt) {
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.fillStyle = '#e3b476';
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c05e48';
    ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.fill();
    glans(x - r * 0.3, y - r * 0.34, r * 0.3, r * 0.12, 0.13);
    // Skorpen er ikke helt jaevn: et par lysere pletter i kanten
    ctx.fillStyle = 'rgba(255,240,210,.14)';
    for (var pl = 0; pl < 7; pl++) {
      var pv = pl * 1.4;
      ctx.beginPath(); ctx.ellipse(x + Math.cos(pv) * r * 0.93, y + Math.sin(pv) * r * 0.93, r * 0.05, r * 0.03, pv, 0, Math.PI * 2); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r * 0.93, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
    ctx.strokeStyle = KANT;
    var ostSet = false, plads = 0;
    lagt.forEach(function (t) {
      if (t === 'ost' && !ostSet) {
        ostSet = true;
        ctx.fillStyle = '#f4d391';
        for (var k = 0; k < 9; k++) {
          var v = k * 0.7, rr2 = r * (k === 0 ? 0 : 0.5);
          ctx.beginPath(); ctx.arc(x + Math.cos(v) * rr2, y + Math.sin(v) * rr2, r * (k === 0 ? 0.5 : 0.32), 0, Math.PI * 2); ctx.fill();
        }
        return;
      }
      var antal = 4, start = plads * 0.9;
      for (var j = 0; j < antal; j++) {
        var vv = start + j * Math.PI * 2 / antal;
        var afst = r * (0.5 + (plads % 2) * 0.12);
        tegnBillede(t, x + Math.cos(vv) * afst, y + Math.sin(vv) * afst, r * 0.4, vv);
      }
      plads++;
    });
  }

  function tegnBurger(x, y, r, lagt, medTop) {
    var b = r * 1.5, lh = r * 0.26;
    var bund = y + r * 0.62;
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.fillStyle = lodret(bund - lh, bund + lh * 0.1, '#eab473', '#c2833f');
    ctx.beginPath(); ctx.roundRect(x - b / 2, bund - lh, b, lh * 1.1, lh * 0.5); ctx.fill(); ctx.stroke();
    var top = bund - lh;
    lagt.forEach(function (t) {
      var yy = top - lh * 0.9;
      if (t === 'boef') { ctx.fillStyle = lodret(yy, yy + lh, '#8d6442', '#5f4029'); ctx.beginPath(); ctx.roundRect(x - b * 0.52, yy, b * 1.04, lh, lh * 0.45); ctx.fill(); ctx.stroke(); }
      else if (t === 'ost') {
        ctx.fillStyle = lodret(yy + lh * 0.3, yy + lh * 1.3, '#f8d489', '#e0ac54'); ctx.beginPath();
        ctx.moveTo(x - b * 0.55, yy + lh * 0.35); ctx.lineTo(x + b * 0.55, yy + lh * 0.35); ctx.lineTo(x + b * 0.55, yy + lh * 0.75);
        ctx.lineTo(x + b * 0.3, yy + lh * 0.75); ctx.lineTo(x + b * 0.2, yy + lh * 1.25); ctx.lineTo(x + b * 0.1, yy + lh * 0.75); ctx.lineTo(x - b * 0.55, yy + lh * 0.75);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (t === 'salat') {
        ctx.fillStyle = lodret(yy, yy + lh, '#a3ca6f', '#6f9e3f'); ctx.beginPath(); ctx.moveTo(x - b * 0.58, yy + lh * 0.8);
        for (var k = 0; k <= 12; k++) ctx.lineTo(x - b * 0.58 + b * 1.16 * k / 12, yy + lh * (k % 2 ? 0.15 : 0.55));
        ctx.lineTo(x + b * 0.58, yy + lh * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (t === 'tomat') {
        ctx.fillStyle = lodret(yy + lh * 0.15, yy + lh * 0.8, '#e3745a', '#bf4a34'); ctx.beginPath(); ctx.roundRect(x - b * 0.5, yy + lh * 0.15, b, lh * 0.65, lh * 0.3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#eda394'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - b * 0.4, yy + lh * 0.48); ctx.lineTo(x + b * 0.4, yy + lh * 0.48); ctx.stroke();
        ctx.strokeStyle = KANT; ctx.lineWidth = 3;
      } else if (t === 'agurk') {
        ctx.fillStyle = lodret(yy + lh * 0.1, yy + lh * 0.9, '#aacd7f', '#7da94f');
        for (var a = 0; a < 4; a++) { ctx.beginPath(); ctx.ellipse(x - b * 0.36 + a * b * 0.24, yy + lh * 0.5, b * 0.13, lh * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else if (t === 'bacon') {
        ctx.fillStyle = lodret(yy + lh * 0.2, yy + lh * 0.85, '#d07a5c', '#a44e38'); ctx.beginPath(); ctx.moveTo(x - b * 0.56, yy + lh * 0.75);
        for (var m = 0; m <= 8; m++) ctx.lineTo(x - b * 0.56 + b * 1.12 * m / 8, yy + lh * (m % 2 ? 0.2 : 0.5));
        for (var q = 8; q >= 0; q--) ctx.lineTo(x - b * 0.56 + b * 1.12 * q / 8, yy + lh * (q % 2 ? 0.55 : 0.85));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      top = yy + lh * 0.1;
    });
    if (medTop) {
      var ty = top - lh * 0.1;
      ctx.fillStyle = blod(x - b * 0.2, ty - lh * 2.1, lh * 0.2, b * 0.75, '#f4cd88', '#c2833f'); ctx.beginPath();
      ctx.moveTo(x - b / 2, ty); ctx.quadraticCurveTo(x - b / 2, ty - lh * 2.4, x, ty - lh * 2.4); ctx.quadraticCurveTo(x + b / 2, ty - lh * 2.4, x + b / 2, ty);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff3d6';
      [[-0.25, -1.4], [0.05, -1.9], [0.28, -1.3], [-0.05, -1.0], [0.18, -0.7], [-0.3, -0.7]].forEach(function (s) {
        ctx.beginPath(); ctx.ellipse(x + s[0] * b, ty + s[1] * lh, lh * 0.18, lh * 0.1, 0.5, 0, Math.PI * 2); ctx.fill();
      });
    }
  }

  function tegnPandekager(x, y, r, lagt, antal) {
    if (antal === undefined) antal = 3;
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    for (var k = 0; k < antal; k++) {
      var yy = y + r * 0.2 - k * r * 0.22, b = r * (0.98 - k * 0.04);
      ctx.fillStyle = '#b6834b';
      ctx.beginPath(); ctx.ellipse(x, yy + r * 0.12, b, r * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#eec37f';
      ctx.beginPath(); ctx.ellipse(x, yy, b, r * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      glans(x - b * 0.34, yy - r * 0.1, b * 0.22, r * 0.055, 0.22);
    }
    var topY = y + r * 0.2 - 2 * r * 0.22;
    var plads = 0;
    lagt.forEach(function (t) {
      if (t === 'honning' || t === 'chokolade') {
        ctx.fillStyle = t === 'honning' ? 'rgba(240,160,30,0.9)' : 'rgba(90,50,25,0.95)';
        ctx.beginPath(); ctx.ellipse(x, topY, r * 0.62, r * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        [-0.5, 0.1, 0.55].forEach(function (d, n) {
          ctx.beginPath(); ctx.roundRect(x + d * r - r * 0.07, topY, r * 0.14, r * (0.3 + n * 0.1), r * 0.07); ctx.fill();
        });
      } else if (t === 'smoer') {
        ctx.fillStyle = lodret(topY - r * 0.16, topY + r * 0.04, '#fceec0', '#eccf7f');
        ctx.beginPath(); ctx.roundRect(x - r * 0.16, topY - r * 0.16, r * 0.32, r * 0.2, 4); ctx.fill(); ctx.stroke();
      } else {
        var sted2 = [[-0.4, -0.05], [0.4, -0.02], [0, -0.16], [-0.18, 0.06], [0.2, 0.08]][plads % 5];
        tegnBillede(t, x + sted2[0] * r, topY + sted2[1] * r - r * 0.12, r * 0.42);
        plads++;
      }
    });
  }

  function pande(x, y, r) {
    ctx.fillStyle = 'rgba(94,74,58,.25)'; ctx.beginPath(); ctx.ellipse(x + 3, y + r * 0.1, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    // Haandtaget er traet fra paletten i stedet for en flad graa klods
    ctx.fillStyle = lodret(y - r * 0.09, y + r * 0.09, '#b18a56', '#8a663d');
    ctx.beginPath(); ctx.roundRect(x + r * 0.9, y - r * 0.09, r * 0.9, r * 0.18, r * 0.09); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(x + r * 0.98, y - r * 0.05, r * 0.7, r * 0.05);
    // Jernet: lysest bagtil, hvor lyset falder
    ctx.fillStyle = '#413d38';
    ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#585349';
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.04, r * 0.84, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
    glans(x - r * 0.3, y - r * 0.12, r * 0.28, r * 0.1, 0.10);
    ctx.strokeStyle = 'rgba(255,240,215,.35)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.ellipse(x, y, r * 0.92, r * 0.48, 0, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();
  }

  /** Damp, der bølger op fra panden. */
  function damp(x, y, r, styrke) {
    ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 * styrke) + ')'; ctx.lineWidth = 3.5; ctx.lineCap = 'round';
    for (var k = -1; k <= 1; k++) {
      var f = tid * 1.6 + k * 1.3, dy = (f % 1) * r * 0.5;
      ctx.globalAlpha = 1 - (f % 1);
      ctx.beginPath(); ctx.moveTo(x + k * r * 0.28, y - dy); ctx.quadraticCurveTo(x + k * r * 0.28 + r * 0.12, y - dy - r * 0.2, x + k * r * 0.28, y - dy - r * 0.4); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** Bagepladen med aarer i traet og lidt mel. */
  function bageplade(x, y, r) {
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.fillStyle = 'rgba(94,74,58,.16)'; ctx.beginPath(); ctx.roundRect(x - r * 1.15 + 4, y - r * 1.05 + 6, r * 2.3, r * 2.1, 18); ctx.fill();
    ctx.fillStyle = '#dbb47f';
    ctx.beginPath(); ctx.roundRect(x - r * 1.15, y - r * 1.05, r * 2.3, r * 2.1, 18); ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.roundRect(x - r * 1.15, y - r * 1.05, r * 2.3, r * 2.1, 18); ctx.clip();
    ctx.strokeStyle = 'rgba(138,102,61,.16)'; ctx.lineWidth = 2;
    for (var aa = 0; aa < 6; aa++) {
      var ay = y - r * 0.95 + aa * r * 0.38;
      ctx.beginPath(); ctx.moveTo(x - r * 1.15, ay);
      ctx.quadraticCurveTo(x, ay + (aa % 2 ? r * 0.07 : -r * 0.07), x + r * 1.15, ay); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    [[-0.8, -0.6], [0.75, -0.7], [0.85, 0.5], [-0.7, 0.75], [0.1, -0.9]].forEach(function (m) {
      ctx.beginPath(); ctx.arc(x + m[0] * r, y + m[1] * r, r * 0.05, 0, Math.PI * 2); ctx.fill();
    });
  }
  /** Retten mens den laves: trin 0-2. vend er 1 lige efter et tryk og falder til 0. */
  function tegnForberedelse(ret, x, y, r, trin, vend, delvis) {
    delvis = Math.min(1, delvis || 0);
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    if (ret === 'pizza') {
      bageplade(x, y, r);
      var str = [0.34, 0.56, 0.78, 0.95];
      var dr = r * (str[trin] + (str[trin + 1] - str[trin]) * delvis) * (1 + vend * 0.12);
      ctx.fillStyle = '#f5e2b8';
      ctx.beginPath(); ctx.ellipse(x, y, dr, dr * (1 - vend * 0.15), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      glans(x - dr * 0.32, y - dr * 0.32, dr * 0.2, dr * 0.085, 0.33);
    } else if (ret === 'burger') {
      pande(x, y + r * 0.2, r * 1.05);
      var hop = Math.sin(vend * Math.PI) * r * 0.7, klem = Math.abs(Math.cos(vend * Math.PI));
      var bf = [['#e8b5af', '#c98a83'], ['#c98066', '#a15f47'], ['#9a6040', '#6d4026']][trin];
      ctx.fillStyle = blod(x - r * 0.2, y + r * 0.1 - hop, r * 0.05, r * 0.75, bf[0], bf[1]);
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.2 - hop, r * 0.62, r * 0.3 * Math.max(0.15, klem), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (trin > 0) damp(x, y - r * 0.2, r, 0.5 + trin * 0.25);
    } else {
      tallerken(x - r * 0.55, y + r * 0.35, r * 0.75);
      tegnPandekager(x - r * 0.55, y + r * 0.1, r * 0.72, [], vend > 0 ? trin - 1 : trin);
      pande(x + r * 0.85, y + r * 0.3, r * 0.62);
      // Den nye pandekage flyver fra panden over paa stakken
      if (vend > 0 && trin > 0) {
        var e = 1 - vend, fx = x + r * 0.85 - r * 1.4 * e, fy = y + r * 0.3 - r * 0.6 * e - Math.sin(e * Math.PI) * r * 0.9;
        ctx.fillStyle = blod(fx - r * 0.15, fy - r * 0.06, r * 0.03, r * 0.6, '#f8dba4', '#dfab68');
        ctx.beginPath(); ctx.ellipse(fx, fy, r * 0.5, r * 0.2 * Math.max(0.2, Math.abs(Math.cos(e * Math.PI * 2))), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        var dej = 0.12 + 0.3 * delvis;      // dejen breder sig, mens der haeldes
        ctx.fillStyle = blod(x + r * 0.85, y + r * 0.32, r * dej * 0.1, r * dej * 1.2, '#fbe9bb', '#e9c67f');
        ctx.beginPath(); ctx.ellipse(x + r * 0.85, y + r * 0.32, r * dej, r * dej * 0.48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        damp(x + r * 0.85, y - r * 0.05, r * 0.8, 0.5);
      }
    }
  }

  function tegnRet(ret, x, y, r, lagt, faerdig) {
    if (ret === 'pizza') { tallerken(x, y + r * 0.55, r * 1.02); tegnPizza(x, y, r * 0.95, lagt); }
    else if (ret === 'burger') { tallerken(x, y + r * 0.45, r); tegnBurger(x, y, r, lagt, faerdig); }
    else { tallerken(x, y + r * 0.35, r); tegnPandekager(x, y, r, lagt); }
  }

  /* ---------- knapper: kasser, moenter og klokke (bunden tegnes én gang pr. stoerrelse) ---------- */

  var kasseCache = {};
  function kasseBund(art, r, farve) {
    var noegle = art + r + farve;
    if (kasseCache[noegle]) return kasseCache[noegle];
    var m = 16, cv = document.createElement('canvas');
    var b = art === 'kasse' ? r * 2.2 : r * 2, h = r * 2;
    cv.width = Math.ceil((b + m * 2) * dpr); cv.height = Math.ceil((h + m * 2) * dpr);
    var c = cv.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (art === 'kasse') {
      skygge(c, function () { rr(c, m, m, b, h, r * 0.34, KRIDT); }, 12, 6, 0.32);
      rr(c, m, m, b, h, r * 0.34, null, KANT, 3.5);
      rr(c, m + 5, m + 5, b - 10, h * 0.34, r * 0.24, 'rgba(255,255,255,.9)');
      rr(c, m + 5, m + h - h * 0.24 - 5, b - 10, h * 0.2, r * 0.16, farve, KANT, 2.5);
      rr(c, m + 12, m + h - h * 0.24 - 1, b * 0.3, h * 0.05, 3, 'rgba(255,255,255,.55)');
    } else {
      // rund bund til klokke og moenter
      skygge(c, function () { c.fillStyle = farve; c.beginPath(); c.arc(m + r, m + r, r, 0, Math.PI * 2); c.fill(); }, 12, 6, 0.32);
      c.strokeStyle = KANT; c.lineWidth = 3.5; c.beginPath(); c.arc(m + r, m + r, r, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 4; c.lineCap = 'round'; c.beginPath(); c.arc(m + r, m + r, r * 0.82, Math.PI * 1.1, Math.PI * 1.5); c.stroke();
    }
    kasseCache[noegle] = { cv: cv, m: m, b: b, h: h };
    return kasseCache[noegle];
  }
  function tegnKasseBund(art, x, y, r, farve) {
    var k = kasseBund(art, Math.round(r), farve);
    ctx.drawImage(k.cv, x - k.b / 2 - k.m, y - k.h / 2 - k.m, k.b + k.m * 2, k.h + k.m * 2);
  }

  /** En moent: gul med tal. */
  function moent(x, y, r, v, c) {
    c = c || ctx;
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fillStyle = '#eec06a'; c.fill(); c.strokeStyle = KANT; c.lineWidth = Math.max(2, r * 0.12); c.stroke();
    c.beginPath(); c.arc(x, y, r * 0.72, 0, Math.PI * 2); c.strokeStyle = 'rgba(94,74,58,.3)'; c.lineWidth = Math.max(1.5, r * 0.08); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = Math.max(1.5, r * 0.1); c.lineCap = 'round'; c.beginPath(); c.arc(x, y, r * 0.84, Math.PI * 1.15, Math.PI * 1.45); c.stroke();
    c.fillStyle = MOERK; c.font = '800 ' + Math.round(r * 1.15) + 'px ui-rounded, "SF Pro Rounded", system-ui, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(v), x, y + r * 0.06);
  }

  /** En lille spire: maerket paa den kasse, der er tom og skal hentes paa gaarden. */
  function spire(x, y, s) {
    ctx.fillStyle = '#7ab648'; ctx.strokeStyle = KANT; ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = KRIDT; ctx.lineWidth = s * 0.16; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y + s * 0.55); ctx.lineTo(x, y - s * 0.1); ctx.stroke();
    ctx.fillStyle = KRIDT;
    ctx.beginPath(); ctx.ellipse(x - s * 0.3, y - s * 0.15, s * 0.32, s * 0.16, -0.7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + s * 0.3, y - s * 0.3, s * 0.32, s * 0.16, 0.7, 0, Math.PI * 2); ctx.fill();
  }

  /* ---------- tegning af stationen ---------- */

  /** Boblen popper ind: bobleStart saetter skalaen, og bobleSlut rydder op. Alt imellem tegnes i boblen. */
  function bobleStart(b, skala) {
    ctx.save();
    if (skala !== 1) { ctx.translate(b.x, b.y + b.h * 0.6); ctx.scale(skala, skala); ctx.translate(-b.x, -(b.y + b.h * 0.6)); }
    var rad = Math.min(26, b.h * 0.3);
    ctx.fillStyle = 'rgba(94,74,58,.16)'; ctx.beginPath(); ctx.roundRect(b.x + 4, b.y + 8, b.b, b.h, rad); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = KANT; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.b, b.h, rad); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.42); ctx.lineTo(b.x - b.h * 0.2, b.y + b.h * 0.58); ctx.lineTo(b.x + 2, b.y + b.h * 0.72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.42); ctx.lineTo(b.x - b.h * 0.2, b.y + b.h * 0.58); ctx.lineTo(b.x + 2, b.y + b.h * 0.72); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 1, b.y + b.h * 0.44, 6, b.h * 0.27);
    ctx.fillStyle = 'rgba(94,74,58,.05)'; ctx.beginPath(); ctx.roundRect(b.x + 10, b.y + 8, b.b - 20, b.h * 0.14, 12); ctx.fill();
  }
  function bobleSlut() { ctx.restore(); }
  function bobleSkala(v) { var t = v.bobleInd; return t >= 1 ? 1 : 0.6 + 0.4 * (1 - Math.pow(1 - t, 3)) + Math.sin(t * Math.PI) * 0.08; }

  function tegnBoble(p, s, v) {
    var b = p.boble, synlig = tid < v.bobleTil;
    bobleStart(b, bobleSkala(v));
    var ting = s.bestilling.ting;
    if (s.bestilling.fri) {
      // Fri leg: kunden vil have retten, resten bestemmer kokken
      tegnBillede(s.bestilling.ret, b.x + b.b * 0.3, b.y + b.h / 2, b.h * 0.75);
      tegnBillede('hjerte', b.x + b.b * 0.68, b.y + b.h / 2 + Math.sin(tid * 4) * b.h * 0.05, b.h * 0.5);
      bobleSlut();
      return;
    }
    if (!synlig) {
      // 3 stjerner: bestillingen skal huskes. Tryk paa kunden for at se den igen.
      ctx.fillStyle = '#ddd4c0';
      for (var q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(b.x + b.b / 2 + (q - 1) * b.h * 0.34, b.y + b.h / 2, b.h * 0.1, 0, Math.PI * 2); ctx.fill(); }
      bobleSlut();
      return;
    }
    var ikon = Math.min(b.h * 0.66, b.b / (ting.length + 1.9));
    var x = b.x + b.b * 0.04 + ikon * 0.6, y = b.y + b.h / 2;
    tegnBillede(s.bestilling.ret, x, y, ikon * 1.15);
    x += ikon * 0.95;
    ctx.fillStyle = 'rgba(94,74,58,.25)'; ctx.fillRect(x - ikon * 0.04, y - ikon * 0.34, ikon * 0.07, ikon * 0.68);
    x += ikon * 0.55;
    // Det der er lagt paa, faar et flueben. Saa kan man se hvad der mangler uden at laese.
    var lagt = s.lagt.slice();
    ting.forEach(function (t) {
      var i = lagt.indexOf(t), paa = i >= 0;
      if (paa) lagt.splice(i, 1);
      ctx.globalAlpha = paa ? 0.35 : 1;
      tegnBillede(t, x, y, ikon);
      ctx.globalAlpha = 1;
      if (paa) {
        ctx.strokeStyle = '#7ab648'; ctx.lineWidth = Math.max(4, ikon * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x - ikon * 0.26, y + ikon * 0.02); ctx.lineTo(x - ikon * 0.06, y + ikon * 0.24); ctx.lineTo(x + ikon * 0.3, y - ikon * 0.22); ctx.stroke();
      } else if (t === s.hent && !s.hentet) {
        spire(x + ikon * 0.32, y - ikon * 0.32, ikon * 0.16);      // den skal hentes paa gaarden
      }
      x += ikon * 1.02;
    });
    bobleSlut();
  }

  /**
   * Regningen i boblen: kun moenter, ingen billeder af maden. Én 1-moent pr.
   * krone, samlet i en gruppe pr. ting, med "+" imellem, "=" og det, der skal
   * betales. Billederne af maden viser ofte flere stykker (blaabaer, oliven),
   * saa de ville snyde, naar man taeller. Stemmen siger stykket med tal.
   */
  function tegnRegningBoble(p, s, v) {
    var b = p.boble, r = s.regning;
    bobleStart(b, bobleSkala(v));
    var poster = r.poster, n = poster.length;
    var visSum = dag.niveau === 0;                 // 1 stjerne: summen vises som tomme pladser, saa man kan taelle
    // Bredden i moentbredder (én moent = 2.3 radier): grupperne, plusserne, lighedstegnet og resultatet
    var enheder = 0.5;
    poster.forEach(function (post) { enheder += post.pris + 0.15; });
    enheder += (n - 1) * 0.8 + 0.9 + (visSum ? r.sum + 0.3 : 1.4) + 0.4;
    var mr = Math.min(b.h * 0.2, b.b / enheder / 2.3);
    var trin = mr * 2.3, x = b.x + mr * 1.2, y = b.y + b.h / 2;
    ctx.font = '800 ' + Math.round(mr * 1.6) + 'px ui-rounded, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    poster.forEach(function (post, i) {
      // gruppen staar paa en blid plade, saa man kan se, hvad der hoerer sammen
      var gb = post.pris * trin + mr * 0.3;
      ctx.fillStyle = 'rgba(94,74,58,.06)'; ctx.beginPath(); ctx.roundRect(x - mr * 0.15, y - mr * 1.35, gb, mr * 2.7, mr); ctx.fill();
      for (var k = 0; k < post.pris; k++) moent(x + mr + k * trin, y, mr, 1);
      x += gb;
      if (i < n - 1) { ctx.fillStyle = MOERK; ctx.fillText('+', x + trin * 0.4, y); x += trin * 0.8; }
    });
    ctx.fillStyle = MOERK; ctx.fillText('=', x + trin * 0.45, y); x += trin * 0.9;
    if (visSum) {
      for (var q = 0; q < r.sum; q++) {
        var mx = x + q * trin + mr;
        if (q < r.betalt) moent(mx, y, mr, 1);
        else { ctx.setLineDash([4, 3]); ctx.strokeStyle = '#a9a396'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(mx, y, mr, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]); }
      }
    } else {
      ctx.setLineDash([5, 4]); ctx.strokeStyle = '#a9a396'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.roundRect(x, y - mr * 1.3, trin * 1.3, mr * 2.6, 12); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = '#a9a396'; ctx.font = '800 ' + Math.round(mr * 1.8) + 'px ui-rounded, system-ui, sans-serif'; ctx.fillText('?', x + trin * 0.65, y);
    }
    ctx.textAlign = 'left';
    bobleSlut();
  }

  /** Kassen paa disken, hvor moenterne laegges. Viser dem, der er lagt. */
  function tegnKasse(p, s, v) {
    var x = p.ret.x, y = p.ret.y, r = p.ret.r, ryst = v.kasseRyst > 0 ? Math.sin(v.kasseRyst * 40) * r * 0.05 : 0;
    var b = r * 2.1, h = r * 1.5;
    ctx.fillStyle = 'rgba(94,74,58,.18)'; ctx.beginPath(); ctx.roundRect(x - b / 2 + 5, y - h / 2 + 8, b, h, 20); ctx.fill();
    var faerdig = !s.regning;
    rr(ctx, x - b / 2 + ryst, y - h / 2, b, h, 20, faerdig ? '#7ab648' : '#b1ab9d', KANT, 4);
    rr(ctx, x - b / 2 + r * 0.2 + ryst, y - h / 2 + r * 0.18, b - r * 0.4, h * 0.42, 10, '#5e4a3a');
    rr(ctx, x - b / 2 + r * 0.2 + ryst, y + h * 0.12, b - r * 0.4, h * 0.3, 10, KRIDT, KANT, 3);
    // Moenterne i kassen
    var lagt = [], sum = 0;
    v.flyvere.forEach(function (f) { if (f.ting === 'moent' && f.t >= 1) { lagt.push(f.moent); sum += f.moent; } });
    var mr = Math.min(r * 0.2, (b - r * 0.6) / Math.max(1, lagt.length) / 2.2);
    lagt.forEach(function (m, i) { moent(x - b / 2 + r * 0.32 + mr + i * mr * 2.2 + ryst, y - h / 2 + r * 0.18 + h * 0.21, mr, m); });
    if (faerdig) {
      ctx.strokeStyle = KRIDT; ctx.lineWidth = r * 0.12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y + h * 0.27); ctx.lineTo(x - r * 0.08, y + h * 0.4); ctx.lineTo(x + r * 0.34, y + h * 0.15); ctx.stroke();
    }
    ctx.textAlign = 'left';
  }

  /** Kagerulle, pil eller kande: viser hvilken bevaegelse retten vil have. Foelger fingeren, naar den er nede. */
  function tegnRedskab(i, ret, x, y, r) {
    var f = null;
    Object.keys(fingre).forEach(function (id) { if (fingre[id].i === i && fingre[id].type !== 'traek') f = fingre[id]; });
    ctx.save();
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    if (ret === 'pizza') {
      var kx = f ? f.x : x + Math.sin(tid * 2.5) * r * 0.7, ky = f ? f.y : y;
      ctx.translate(kx, ky); ctx.rotate(-0.5);
      ctx.fillStyle = lodret(-r * 0.06, r * 0.06, '#a8804f', '#7f5c39');
      ctx.beginPath(); ctx.roundRect(-r * 0.95, -r * 0.06, r * 1.9, r * 0.12, r * 0.06); ctx.fill(); ctx.stroke();
      ctx.fillStyle = lodret(-r * 0.15, r * 0.15, '#e6b379', '#bd8449');
      ctx.beginPath(); ctx.roundRect(-r * 0.65, -r * 0.15, r * 1.3, r * 0.3, r * 0.12); ctx.fill(); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.beginPath(); ctx.roundRect(-r * 0.6, -r * 0.13, r * 1.2, r * 0.07, r * 0.03); ctx.fill();
    } else if (ret === 'burger') {
      // En pil der hopper opad: svirp!
      var py = y - r * 0.75 - Math.abs(Math.sin(tid * 4)) * r * 0.35;
      ctx.globalAlpha = f ? 0.3 : 0.9; ctx.fillStyle = '#fff'; ctx.lineJoin = 'round';
      ctx.beginPath(); ctx.moveTo(x, py - r * 0.35); ctx.lineTo(x + r * 0.3, py); ctx.lineTo(x + r * 0.12, py); ctx.lineTo(x + r * 0.12, py + r * 0.3);
      ctx.lineTo(x - r * 0.12, py + r * 0.3); ctx.lineTo(x - r * 0.12, py); ctx.lineTo(x - r * 0.3, py); ctx.closePath(); ctx.fill(); ctx.stroke();
    } else {
      // Kanden med dej haelder, naar fingeren holdes nede
      var hx = x + r * 1.25, hy = y - r * 0.55;
      ctx.translate(hx, hy); ctx.rotate(f ? -0.9 : -0.2 + Math.sin(tid * 3) * 0.12);
      ctx.fillStyle = lodret(-r * 0.3, r * 0.3, '#fffaf0', '#ecdcc2');
      ctx.beginPath(); ctx.roundRect(-r * 0.25, -r * 0.3, r * 0.5, r * 0.6, r * 0.08); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.3); ctx.lineTo(-r * 0.42, -r * 0.36); ctx.lineTo(-r * 0.25, -r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = lodret(-r * 0.1, r * 0.25, '#fbe9bb', '#e9c67f');
      ctx.fillRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.35);
    }
    ctx.restore();
  }

  function tegnRengoering(i, p, v) {
    serviet(p.ret.x, p.ret.y, p.ret.r, false);
    tallerken(p.ret.x, p.ret.y + p.ret.r * 0.45, p.ret.r);
    var foerste = null;
    v.rengoer.pletter.forEach(function (plet) {
      if (plet.styrke <= 0) return;
      var st = pletSted(p, plet);
      if (!foerste) foerste = st;
      ctx.globalAlpha = 0.35 + 0.65 * plet.styrke; ctx.fillStyle = plet.farve;
      for (var k = 0; k < 5; k++) {
        var a = plet.form + k * 1.3;
        ctx.beginPath(); ctx.arc(st.x + Math.cos(a) * st.r * 0.45, st.y + Math.sin(a) * st.r * 0.25, st.r * (0.35 + (k % 3) * 0.12), 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    });
    // Svampen: under fingeren, ellers vipper den ved den foerste plet og viser hvad man skal
    var f = null;
    Object.keys(fingre).forEach(function (id) { if (fingre[id].i === i && fingre[id].type === 'svamp') f = fingre[id]; });
    var sx = f ? f.x : (foerste ? foerste.x + Math.sin(tid * 4) * p.ret.r * 0.3 : p.ret.x), sy = f ? f.y : (foerste ? foerste.y - p.ret.r * 0.1 : p.ret.y);
    var b = p.ret.r * 0.7;
    ctx.fillStyle = 'rgba(94,74,58,.2)'; ctx.beginPath(); ctx.roundRect(sx - b / 2 + 4, sy - b * 0.3, b, b * 0.7, 8); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.fillStyle = '#7ab648'; ctx.beginPath(); ctx.roundRect(sx - b / 2, sy - b * 0.36, b, b * 0.3, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#f0c46a'; ctx.beginPath(); ctx.roundRect(sx - b / 2, sy - b * 0.14, b, b * 0.44, 8); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; [[0.2, 0.1], [0.5, 0.25], [0.75, 0.05]].forEach(function (h) { ctx.beginPath(); ctx.arc(sx - b / 2 + h[0] * b, sy + h[1] * b, b * 0.04, 0, Math.PI * 2); ctx.fill(); });
  }

  /** Kunden med skygge under, og et lille vip, saa den ser levende ud. */
  function tegnKunde(navn, x, y, str, vip) {
    ctx.fillStyle = 'rgba(94,74,58,0.16)'; ctx.beginPath(); ctx.ellipse(x, y + str * 0.56, str * 0.45, str * 0.07, 0, 0, Math.PI * 2); ctx.fill();
    var sq = 1 + Math.sin(tid * 2.2 + x * 0.01) * 0.012;
    ctx.save(); ctx.translate(x, y + str * 0.5); ctx.scale(1 / sq, sq); ctx.rotate(vip || 0); ctx.translate(-x, -(y + str * 0.5));
    tegnBillede(navn, x, y, str);
    ctx.restore();
  }

  function tegnStation(i) {
    var p = plan(i), s = dag.stationer[i], v = visning[i];
    if (v.gaard) { tegnGaard(i, p, s, v); return; }
    if (v.rengoer) { tegnRengoering(i, p, v); return; }
    var ser = v.serverer > 0, g = v.gammel;
    var kundeNavn = v.gaar ? v.gaar.kunde : (ser && g ? g.kunde : s.kunde);
    if (!kundeNavn) return;

    // Kunden glider ind fra siden, hopper naar maden kommer, og glider ud igen
    var ind = Math.max(0, v.ind), skub = (1 - ind) * -p.kunde.str * 1.6;
    var hop = 0;
    if (ser) {
      var t = 2.0 - v.serverer;
      if (t > 0.6 && t < 1.5) hop = Math.abs(Math.sin((t - 0.6) * 9)) * p.kunde.str * 0.12;
    }
    if (v.gaar) { var gt = 1.6 - v.gaar.t; if (gt > 0.9) skub = -(gt - 0.9) / 0.7 * p.kunde.str * 1.9; else hop = Math.abs(Math.sin(gt * 12)) * p.kunde.str * 0.06; }
    tegnKunde(kundeNavn, p.kunde.x + skub, p.kunde.y - hop, p.kunde.str, v.kvit > 0 ? Math.sin(v.kvit * 20) * 0.06 : 0);

    if (v.betaler && s.regning) tegnRegningBoble(p, s, v);
    else if (!ser && !v.gaar && ind >= 1 && s.bestilling) tegnBoble(p, s, v);

    // Daekkeserviet og retten. Under servering flyver retten op til kunden. Under betaling staar kassen der.
    var lagtPaa = ser && g ? g.lagt : s.lagt.filter(function (t2, n) { return !v.flyvere.some(function (f) { return f.plads === n && f.t < 1 && f.ting !== 'moent'; }); });
    var ret = ser && g ? g.bestilling.ret : (s.bestilling ? s.bestilling.ret : null);
    var klarNu = !ser && !v.gaar && !v.betaler && s.bestilling && K.klar(dag, i);
    serviet(p.ret.x, p.ret.y, p.ret.r, klarNu);
    if (v.betaler || v.gaar) {
      tegnKasse(p, s, v);
    } else if (ret && (ser || ind >= 1)) {
      var rx = p.ret.x, ry = p.ret.y, rr2 = p.ret.r;
      if (ser) {
        var tt = Math.min(1, (2.0 - v.serverer) / 0.6), e = tt * tt * (3 - 2 * tt);
        rx += (p.kunde.x + p.kunde.str * 0.1 - rx) * e; ry += (p.kunde.y + p.kunde.str * 0.45 - ry) * e; rr2 *= 1 - e * 0.55;
        rr2 *= [1, 0.78, 0.55, 0][v.bidder];      // kunden spiser retten i tre bidder
      }
      if (!ser && !K.forberedtFaerdig(dag, i)) {
        var vink = v.vink > 0 ? Math.sin(v.vink * 40) * rr2 * 0.06 : 0;
        tegnForberedelse(ret, rx + vink, ry, rr2, s.forberedt, v.vend / 0.35, ret === 'pizza' ? v.rul : v.haeld);
        tegnRedskab(i, ret, rx, ry, rr2);
      } else if (rr2 > 0) tegnRet(ret, rx, ry, rr2, lagtPaa, ser || K.klar(dag, i));
      ctx.globalAlpha = 1;
    }

    // Ingredienser og moenter, der flyver fra hylden til tallerkenen eller kassen
    v.flyvere.forEach(function (f) {
      if (f.t >= 1) return;
      var e = f.t * f.t * (3 - 2 * f.t);
      var x = f.fx + (p.ret.x - f.fx) * e, y = f.fy + (p.ret.y - f.fy) * e - Math.sin(e * Math.PI) * p.ret.r * 0.9;
      if (f.ting === 'moent') moent(x, y, p.ret.r * 0.22, f.moent);
      else tegnBillede(f.ting, x, y, p.ret.r * 0.6);
    });

    if (ser || v.gaar) return;

    if (v.betaler) {
      // Pungen: moenterne staar, hvor hylden ellers er. Der er altid nok af hver.
      p.moenter.forEach(function (mo) {
        var ryst = v.ryst && v.ryst.ting === 'moent' + mo.moent ? Math.sin(v.ryst.t * 50) * mo.r * 0.18 : 0;
        tegnKasseBund('rund', mo.x + ryst, mo.y, mo.r, '#e6c28a');
        moent(mo.x + ryst, mo.y - mo.r * 0.05, mo.r * 0.62, mo.moent);
        moent(mo.x + ryst - mo.r * 0.12, mo.y - mo.r * 0.18, mo.r * 0.62, mo.moent);
      });
      return;
    }

    // Hylden: kasser med ingredienser. Den, der mangler, er tom og har en spire: den hentes paa gaarden.
    var klar = K.klar(dag, i), forberedt = K.forberedtFaerdig(dag, i);
    p.knapper.forEach(function (kn) {
      var ryst = v.ryst && v.ryst.ting === kn.ting ? Math.sin(v.ryst.t * 50) * kn.r * 0.18 : 0;
      var mangler = kn.ting === s.hent && !s.hentet;
      var hop2 = mangler && v.hentHop < 0.5 ? Math.abs(Math.sin(v.hentHop * Math.PI * 2)) * kn.r * 0.25 : 0;
      ctx.globalAlpha = forberedt || mangler ? 1 : 0.45;
      tegnKasseBund('kasse', kn.x + ryst, kn.y - hop2, kn.r, RETFARVE[s.bestilling.ret] || '#5f9fc9');
      ctx.globalAlpha = mangler ? 0.28 : (forberedt ? 1 : 0.45);
      tegnBillede(kn.ting, kn.x + ryst, kn.y - hop2 - kn.r * 0.12, kn.r * 1.3);
      ctx.globalAlpha = 1;
      if (mangler) spire(kn.x + kn.r * 0.72 + ryst, kn.y - hop2 - kn.r * 0.62, kn.r * 0.3);
    });
    // Klokken lyser og vipper, naar retten er klar
    var kl = p.klokke, vip = klar ? Math.sin(tid * 9) * 0.18 : (v.ryst && v.ryst.ting === 'klokke' ? Math.sin(v.ryst.t * 50) * 0.12 : 0);
    tegnKasseBund('rund', kl.x, kl.y, kl.r, klar ? '#f0c46a' : '#e6c28a');
    if (klar) { ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.sin(tid * 6) * 0.15) + ')'; ctx.beginPath(); ctx.arc(kl.x, kl.y, kl.r * 0.9, 0, Math.PI * 2); ctx.fill(); }
    ctx.globalAlpha = klar || !forberedt ? 1 : 0.55;
    tegnKlokke(kl.x, kl.y - kl.r * 0.05, kl.r * 1.4, vip);
    ctx.globalAlpha = 1;
  }

  /**
   * Klokken er Noeddeskovens malede klokke. Den er hoejere end bred, saa den tegnes
   * i sine egne proportioner i det samme kvadrat, som Noto-klokken stod i.
   * Er den ikke hentet, staar Noto-klokken der i stedet.
   */
  function tegnKlokke(x, y, str, vinkel) {
    var img = Sprites.hent(KLOKKE);
    if (!Sprites.klar(img)) { tegnBillede('klokke', x, y, str, vinkel); return; }
    var h = str * 1.1, b = h * img.naturalWidth / img.naturalHeight;      // skaftet goer den hoej og smal, saa den maa gerne naa lidt ud over kvadratet i hoejden
    ctx.save(); ctx.translate(x, y); if (vinkel) ctx.rotate(vinkel);
    ctx.drawImage(img, -b / 2, -h / 2, b, h);
    ctx.restore();
  }

  /* ---------- gaarden ---------- */

  var GROEN = '#93bc63', MELLEM = '#6f9447', DYB = '#5f8240', SALVIE = '#8fae86';
  var TRAE_LYS = '#d9ba8a', TRAE_MEL = '#b18a56', TRAE_MOERK = '#8a663d';

  /**
   * Maler selve kilden (planten, stubben, bistadet) i lag c med origo i kildens
   * midte. Frugterne skrives i frugter og males sidst, oven paa papirkornet.
   * Pladserne og stoerrelserne er de samme som i den gamle, flade tegning.
   */
  function malKilde(c, navn, r, t, frugter, brugte) {
    var form = K.KILDER[navn].form;
    function frugt(x, y, s) { frugter.push([x, y, s]); }
    function jord(x, y, b) {
      klat(c, x, y, b, b * 0.24, TRAE_MOERK, 0.7, t);
      for (var k = 0; k < 7; k++) {
        var gx = x + (t() - 0.5) * b * 1.7, gl = r * (0.08 + t() * 0.08);
        c.strokeStyle = k % 2 ? 'rgba(95,130,64,.7)' : 'rgba(147,188,99,.8)'; c.lineWidth = Math.max(1.2, r * 0.025); c.lineCap = 'round';
        c.beginPath(); c.moveTo(gx, y + b * 0.08); c.quadraticCurveTo(gx + (t() - 0.5) * gl * 0.6, y - gl * 0.5, gx + (t() - 0.5) * gl, y - gl); c.stroke();
      }
    }
    // Skyggen: to bloede lag, ikke en flad ellipse
    c.fillStyle = 'rgba(94,74,58,.08)'; klatSti(c, 0, r * 0.85, r * 0.95, r * 0.18, t, 0.15); c.fill();
    c.fillStyle = 'rgba(94,74,58,.08)'; klatSti(c, 0, r * 0.85, r * 0.7, r * 0.12, t, 0.15); c.fill();

    if (form === 'plante') {
      jord(0, r * 0.8, r * 0.36);
      stroeg(c, [[r * 0.13, r * 0.82], [r * 0.11, -r * 0.78]], TRAE_LYS, r * 0.06);
      stroeg(c, [[0, r * 0.8], [-r * 0.05, r * 0.3], [r * 0.04, -r * 0.2], [-r * 0.02, -r * 0.62]], DYB, r * 0.065);
      [[-0.02, -0.58, -0.25, 0.36, GROEN], [0.0, -0.52, 0.55, 0.34, MELLEM], [-0.03, -0.25, -1.0, 0.44, MELLEM], [0.02, -0.35, 1.0, 0.42, GROEN],
       [-0.02, 0.08, -1.2, 0.46, GROEN], [0.03, -0.02, 1.15, 0.44, DYB], [-0.03, 0.45, -1.4, 0.38, DYB], [0.0, 0.5, 1.35, 0.36, MELLEM],
       [-0.02, -0.4, -0.55, 0.3, DYB], [0.02, 0.2, 0.8, 0.3, GROEN], [-0.02, 0.3, -0.75, 0.32, MELLEM], [0.03, -0.15, 0.6, 0.3, DYB],
       [0.0, -0.62, 0.15, 0.28, GROEN], [-0.03, 0.65, -1.1, 0.26, MELLEM]].forEach(function (b) {
        blad(c, b[0] * r, b[1] * r, b[3] * r, b[3] * r * 0.45, b[2], b[4], (b[2] < 0 ? -1 : 1) * r * 0.05);
      });
      // smaa stilke ud til frugterne
      stroeg(c, [[-r * 0.03, -r * 0.05], [-r * 0.2, -r * 0.08], [-r * 0.3, -r * 0.1]], DYB, r * 0.03);
      stroeg(c, [[r * 0.03, -r * 0.45], [r * 0.25, -r * 0.55], [r * 0.35, -r * 0.55]], DYB, r * 0.03);
      frugt(-r * 0.3, r * 0.1, r * 0.5); frugt(r * 0.35, -r * 0.35, r * 0.45);
    } else if (form === 'busk') {
      jord(0, r * 0.78, r * 0.5);
      [[-0.15, 0.75, -0.2, 0.35], [0.12, 0.75, 0.25, 0.35]].forEach(function (k) { stroeg(c, [[k[0] * r, k[1] * r], [(k[0] + k[2]) * r, (k[1] - k[3]) * r]], TRAE_MOERK, r * 0.05); });
      klat(c, 0, -r * 0.22, r * 0.6, r * 0.5, DYB, 0.95, t);
      klat(c, -r * 0.42, r * 0.2, r * 0.48, r * 0.45, DYB, 0.95, t);
      klat(c, r * 0.42, r * 0.2, r * 0.48, r * 0.45, DYB, 0.95, t);
      klat(c, -r * 0.3, -r * 0.05, r * 0.38, r * 0.34, MELLEM, 0.85, t);
      klat(c, r * 0.32, -r * 0.12, r * 0.36, r * 0.32, MELLEM, 0.85, t);
      klat(c, 0, r * 0.3, r * 0.5, r * 0.3, MELLEM, 0.7, t);
      klat(c, -r * 0.22, -r * 0.42, r * 0.26, r * 0.2, GROEN, 0.75, t);
      klat(c, r * 0.18, -r * 0.4, r * 0.2, r * 0.16, GROEN, 0.6, t);
      // smaa blade langs kanten, saa busken ikke er en klump
      for (var k = 0; k < 26; k++) {
        var a = k / 26 * Math.PI * 2, ex = Math.cos(a) * r * 0.82, ey = -r * 0.05 + Math.sin(a) * r * 0.62;
        if (ey > r * 0.55) continue;
        blad(c, ex * 0.92, ey * 0.92, r * (0.16 + t() * 0.06), r * 0.06, a + Math.PI / 2 + (t() - 0.5) * 0.5, [GROEN, MELLEM, DYB][k % 3]);
      }
      frugt(-r * 0.35, 0, r * 0.45); frugt(r * 0.3, -r * 0.2, r * 0.42); frugt(0, r * 0.3, r * 0.4);
    } else if (form === 'trae' || form === 'kakao') {
      var img = Sprites.hent(TRAE); brugte.push(img);
      if (Sprites.klar(img)) {
        var h = r * 2.15, b = h * img.naturalWidth / img.naturalHeight;
        if (form === 'kakao') {
          // Kakaotraeet er det samme trae, farvet dybere og varmere i kronen
          var l2 = nytLag(b, h), k2 = l2.cx;
          k2.drawImage(img, 0, 0, b, h);
          k2.globalCompositeOperation = 'source-atop';
          k2.fillStyle = 'rgba(70,104,48,.4)'; k2.fillRect(0, 0, b, h * 0.62);
          k2.fillStyle = 'rgba(224,138,82,.12)'; k2.fillRect(0, 0, b, h * 0.62);
          c.drawImage(l2.c, -b / 2, r * 0.9 - h, b, h);
        } else c.drawImage(img, -b / 2, r * 0.9 - h, b, h);
      } else {
        stroeg(c, [[0, r * 0.85], [0, -r * 0.3]], TRAE_MEL, r * 0.2);
        klat(c, 0, -r * 0.55, r * 0.9, r * 0.65, DYB, 0.95, t);
      }
      if (form === 'trae') {
        frugt(-r * 0.4, -r * 0.4, r * 0.4); frugt(r * 0.35, -r * 0.65, r * 0.4); frugt(0.05 * r, -r * 0.15, r * 0.38);
      } else {
        // Kakaofrugter haenger paa stammen, og chokoladen ligger under
        [[-0.25, 0.1, 0.3], [0.28, 0.3, -0.3]].forEach(function (p) {
          stroeg(c, [[p[0] * r * 0.4, (p[1] - 0.18) * r], [p[0] * r, (p[1] - 0.16) * r]], TRAE_MOERK, r * 0.03);
          klat(c, p[0] * r, p[1] * r, r * 0.13, r * 0.22, '#e08a52', 1, t, p[2]);
          c.save(); c.translate(p[0] * r, p[1] * r); c.rotate(p[2]);
          c.strokeStyle = 'rgba(138,102,61,.55)'; c.lineWidth = Math.max(1, r * 0.018);
          [-0.5, 0, 0.5].forEach(function (d) { c.beginPath(); c.moveTo(d * r * 0.1, -r * 0.19); c.quadraticCurveTo(d * r * 0.2, 0, d * r * 0.1, r * 0.19); c.stroke(); });
          c.restore();
        });
        frugt(r * 0.55, r * 0.6, r * 0.5);
      }
    } else if (form === 'palme') {
      jord(0, r * 0.84, r * 0.3);
      // Stammen: lidt boejet, smallere opad, med ringe
      stroeg(c, [[r * 0.04, r * 0.86], [r * 0.08, r * 0.2], [-r * 0.02, -r * 0.5]], TRAE_MEL, r * 0.19);
      stroeg(c, [[r * 0.07, r * 0.2], [-r * 0.02, -r * 0.52]], TRAE_MEL, r * 0.14);
      c.strokeStyle = 'rgba(138,102,61,.55)'; c.lineWidth = Math.max(1, r * 0.025); c.lineCap = 'round';
      for (var ry = r * 0.78; ry > -r * 0.45; ry -= r * 0.14) {
        var mx = ry > r * 0.2 ? r * 0.04 + (r * 0.86 - ry) / (r * 0.66) * r * 0.04 : r * 0.08 - (r * 0.2 - ry) / (r * 0.7) * r * 0.1, hw = ry > 0 ? r * 0.085 : r * 0.065;
        c.beginPath(); c.moveTo(mx - hw, ry); c.quadraticCurveTo(mx, ry + r * 0.04, mx + hw, ry); c.stroke();
      }
      // Store blade ud fra toppen, de bagerste moerkest
      var vinkler = [-2.4, 2.4, -1.6, 1.6, -0.9, 0.9, -0.3, 0.3];
      vinkler.forEach(function (a, n) {
        var farve = n < 2 ? DYB : n < 4 ? MELLEM : n < 6 ? GROEN : MELLEM;
        blad(c, -r * 0.02, -r * 0.5, r * 0.88, r * 0.17, a, farve, (a < 0 ? -1 : 1) * r * 0.12 * Math.min(1, Math.abs(a)));
      });
      // de flossede kanter: lyse snit paa skraa ud fra ribben
      vinkler.forEach(function (a) {
        c.save(); c.translate(-r * 0.02, -r * 0.5); c.rotate(a);
        c.strokeStyle = 'rgba(248,241,230,.45)'; c.lineWidth = Math.max(1, r * 0.012);
        for (var d = 0.3; d < 0.85; d += 0.14) { var s = (a < 0 ? -1 : 1); c.beginPath(); c.moveTo(s * r * 0.03, -r * d); c.lineTo(s * r * 0.14, -r * (d + 0.05)); c.stroke(); }
        c.restore();
      });
      klat(c, -r * 0.02, -r * 0.5, r * 0.08, r * 0.07, DYB, 1, t);
      frugt(-r * 0.15, -r * 0.2, r * 0.5); frugt(r * 0.2, -r * 0.1, r * 0.45);
    } else if (form === 'ranke') {
      jord(0, r * 0.84, r * 0.6);
      // Espalieret: tre pæle og tre lægter i malet træ
      for (var p2 = -1; p2 <= 1; p2++) stroeg(c, [[p2 * r * 0.45, r * 0.85], [p2 * r * 0.45 + r * 0.01, -r * 0.7]], TRAE_MEL, r * 0.06);
      [-0.35, 0.05, 0.45].forEach(function (d) { stroeg(c, [[-r * 0.6, r * d], [r * 0.6, r * (d - 0.01)]], TRAE_LYS, r * 0.05); });
      // Ranken med blade og smaa krøller
      stroeg(c, [[-r * 0.5, r * 0.85], [-r * 0.32, r * 0.42], [-r * 0.12, r * 0.08], [r * 0.15, -r * 0.22], [r * 0.4, -r * 0.48], [r * 0.5, -r * 0.7]], DYB, r * 0.045);
      stroeg(c, [[r * 0.42, r * 0.85], [r * 0.3, r * 0.45], [r * 0.05, r * 0.25], [-r * 0.25, -r * 0.05], [-r * 0.45, -r * 0.3]], MELLEM, r * 0.035);
      c.strokeStyle = MELLEM; c.lineWidth = Math.max(1, r * 0.016);
      [[-0.15, 0.1], [0.38, -0.45], [0.05, 0.25], [-0.4, -0.25]].forEach(function (k) {
        c.beginPath(); for (var a = 0; a < 9; a += 0.4) { var rr2 = r * 0.07 * (1 - a / 10); c[a ? 'lineTo' : 'moveTo'](k[0] * r + Math.cos(a) * rr2, k[1] * r - r * 0.05 + Math.sin(a) * rr2); } c.stroke();
      });
      // Agurkeblade: tre brede lapper ud fra stilken
      [[-0.3, 0.38, MELLEM, -0.5], [0.15, -0.02, DYB, 0.4], [0.42, -0.42, MELLEM, 0.6], [-0.45, -0.12, DYB, -0.6], [0.32, 0.4, MELLEM, 0.5], [-0.05, 0.68, DYB, -0.2], [0.0, -0.28, MELLEM, -0.3]].forEach(function (b) {
        [-0.75, 0, 0.75].forEach(function (a) { blad(c, b[0] * r, b[1] * r, r * (a ? 0.2 : 0.25), r * 0.11, b[3] + a, b[2]); });
      });
      frugt(-r * 0.05, r * 0.35, r * 0.5); frugt(r * 0.4, -r * 0.2, r * 0.42);
    } else if (form === 'bed') {
      // Et bed: en bunke muld med furer og smaa planter i raekker
      klat(c, 0, r * 0.38, r * 0.97, r * 0.42, TRAE_MOERK, 0.95, t);
      klat(c, -r * 0.05, r * 0.3, r * 0.8, r * 0.28, TRAE_MEL, 0.5, t);
      c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = Math.max(1.5, r * 0.03); c.lineCap = 'round';
      [-0.15, 0.1, 0.35].forEach(function (d) {
        var fy = r * (0.35 + d * 0.9), hw = r * 0.72 * Math.sqrt(1 - Math.pow((fy - r * 0.38) / (r * 0.45), 2));
        c.beginPath(); c.moveTo(-hw, fy); c.quadraticCurveTo(0, fy + r * 0.05, hw, fy); c.stroke();
      });
      [[-0.55, 0.05], [-0.2, -0.05], [0.2, -0.05], [0.55, 0.05], [-0.4, 0.4], [0.4, 0.4]].forEach(function (b) {
        var bx = b[0] * r, by = b[1] * r + r * 0.18;
        if (navn === 'salat') {
          for (var k = 0; k < 6; k++) blad(c, bx, by, r * (0.2 + t() * 0.06), r * 0.09, -1.3 + k * 0.52, k % 2 ? GROEN : '#b3d18e');
        } else {
          [-0.7, 0, 0.7].forEach(function (a, n) {
            stroeg(c, [[bx, by], [bx + Math.sin(a) * r * 0.12, by - Math.cos(a) * r * 0.14]], DYB, r * 0.02);
            klat(c, bx + Math.sin(a) * r * 0.16, by - Math.cos(a) * r * 0.2, r * 0.08, r * 0.065, n === 1 ? MELLEM : DYB, 0.95, t);
          });
          c.fillStyle = '#f8f1e6'; c.beginPath(); c.arc(bx + r * 0.1, by - r * 0.04, r * 0.035, 0, 7); c.fill();
          c.fillStyle = '#f0c46a'; c.beginPath(); c.arc(bx + r * 0.1, by - r * 0.04, r * 0.013, 0, 7); c.fill();
        }
      });
      frugt(-r * 0.35, r * 0.15, r * 0.45); frugt(r * 0.35, r * 0.2, r * 0.45);
    } else if (form === 'ananas') {
      jord(0, r * 0.62, r * 0.42);
      // En roset af lange, spidse blade: de bagerste moerke, de forreste lyse og blaalige
      [-1.35, -0.95, -0.5, -0.15, 0.15, 0.5, 0.95, 1.35].forEach(function (a) {
        blad(c, 0, r * 0.55, r * (0.95 + t() * 0.2), r * 0.1, a, DYB, (a < 0 ? -1 : 1) * r * 0.15);
      });
      [-1.1, -0.7, -0.3, 0.3, 0.7, 1.1].forEach(function (a, n) {
        blad(c, 0, r * 0.55, r * 1.1, r * 0.12, a, n % 2 ? SALVIE : MELLEM, (a < 0 ? -1 : 1) * r * 0.12);
      });
      [-1.5, -1.2, 1.2, 1.5].forEach(function (a) { blad(c, 0, r * 0.6, r * 0.6, r * 0.09, a, SALVIE, (a < 0 ? -1 : 1) * r * 0.1); });
      frugt(0, -r * 0.05, r * 0.85);
    } else if (form === 'stok') {
      // En gammel stamme i skovbunden, hvor champignonerne vokser
      jord(0, r * 0.68, r * 0.9);
      c.save();
      c.beginPath(); c.roundRect(-r * 0.95, r * 0.15, r * 1.9, r * 0.55, r * 0.25); c.clip();
      c.fillStyle = TRAE_MOERK; c.fillRect(-r, r * 0.1, r * 2, r * 0.65);
      klat(c, -r * 0.2, r * 0.3, r * 0.9, r * 0.14, TRAE_MEL, 0.8, t);
      klat(c, r * 0.3, r * 0.6, r * 0.7, r * 0.1, '#5e4a3a', 0.35, t);
      c.strokeStyle = 'rgba(94,74,58,.4)'; c.lineWidth = Math.max(1, r * 0.022); c.lineCap = 'round';
      for (var bk = 0; bk < 9; bk++) {
        var by2 = r * (0.22 + t() * 0.42), bx2 = -r * 0.9 + t() * r * 1.4, bl = r * (0.25 + t() * 0.4);
        c.beginPath(); c.moveTo(bx2, by2); c.quadraticCurveTo(bx2 + bl / 2, by2 + (t() - 0.5) * r * 0.06, bx2 + bl, by2); c.stroke();
      }
      c.restore();
      c.strokeStyle = farvetone(TRAE_MOERK, 0.7, 0.55); c.lineWidth = Math.max(1.5, r * 0.03);
      c.beginPath(); c.roundRect(-r * 0.95, r * 0.15, r * 1.9, r * 0.55, r * 0.25); c.stroke();
      // Enden med aarringe
      klat(c, r * 0.95, r * 0.42, r * 0.15, r * 0.28, '#e5d3ae', 1, t);
      c.strokeStyle = 'rgba(177,138,86,.7)'; c.lineWidth = Math.max(1, r * 0.018);
      [0.75, 0.5, 0.25].forEach(function (f) { c.beginPath(); c.ellipse(r * 0.95, r * 0.42, r * 0.14 * f, r * 0.26 * f, 0, 0, 7); c.stroke(); });
      // Mos paa toppen
      klat(c, -r * 0.55, r * 0.18, r * 0.22, r * 0.06, GROEN, 0.8, t);
      klat(c, r * 0.5, r * 0.17, r * 0.16, r * 0.05, MELLEM, 0.7, t);
      frugt(-r * 0.4, -r * 0.05, r * 0.5); frugt(r * 0.2, -r * 0.1, r * 0.55);
    } else if (form === 'bi') {
      // Et bistade af flettet halm paa en lille bænk
      stroeg(c, [[-r * 0.42, r * 0.82], [-r * 0.45, r * 0.95]], TRAE_MOERK, r * 0.06);
      stroeg(c, [[r * 0.42, r * 0.82], [r * 0.45, r * 0.95]], TRAE_MOERK, r * 0.06);
      stroeg(c, [[-r * 0.62, r * 0.8], [r * 0.62, r * 0.8]], TRAE_MEL, r * 0.09);
      for (var n = 0; n < 6; n++) {
        var yb = r * (0.66 - n * 0.21), w = r * 0.6 * Math.sqrt(1 - Math.pow(n / 6.4, 2)), hb = r * 0.24;
        var farve = n % 2 ? TRAE_LYS : '#e5c98e';
        c.save();
        c.beginPath(); c.roundRect(-w, yb - hb / 2, w * 2, hb, hb / 2);
        c.fillStyle = farve; c.fill();
        c.clip();
        c.fillStyle = farvetone(farve, 1.3, 0.55); c.fillRect(-w, yb - hb / 2, w * 2, hb * 0.35);
        c.fillStyle = farvetone(farve, 0.8, 0.35); c.fillRect(-w, yb + hb * 0.15, w * 2, hb * 0.35);
        c.strokeStyle = farvetone(farve, 0.7, 0.4); c.lineWidth = Math.max(1, r * 0.014);
        for (var sx = -w + r * 0.08; sx < w; sx += r * 0.11) { c.beginPath(); c.moveTo(sx, yb - hb / 2); c.lineTo(sx + r * 0.05, yb + hb / 2); c.stroke(); }
        c.restore();
        c.strokeStyle = farvetone(TRAE_MEL, 0.8, 0.6); c.lineWidth = Math.max(1, r * 0.02);
        c.beginPath(); c.roundRect(-w, yb - hb / 2, w * 2, hb, hb / 2); c.stroke();
      }
      klat(c, 0, -r * 0.62, r * 0.09, r * 0.06, TRAE_MEL, 1, t);
      // Indgangen
      c.fillStyle = 'rgba(94,74,58,.85)'; c.beginPath(); c.ellipse(0, r * 0.68, r * 0.16, r * 0.08, 0, Math.PI, 0); c.closePath(); c.fill();
      frugt(-r * 0.6, r * 0.55, r * 0.55);
    }
  }

  /** Hver kilde males én gang pr. stoerrelse. Var et billede ikke hentet endnu, males den igen, naar det er. */
  var kildeLag = {};
  function kildeBillede(navn, r) {
    var noegle = navn + '|' + Math.round(r) + '@' + dpr, gl = kildeLag[noegle];
    if (gl && !(gl.venter.length && gl.venter.every(function (img) { return img.complete; }))) return gl;
    var ox = r * 1.5, oy = r * 1.8, b = r * 3, h = r * 2.95, l = nytLag(b, h), c = l.cx;
    var frugter = [], brugte = [], ting = K.KILDER[navn].giver[0], t = taelling(navn);
    c.translate(ox, oy);
    malKilde(c, navn, r, t, frugter, brugte);
    c.globalCompositeOperation = 'source-atop';
    korn(c, -ox, -oy, b, h, 0.9);
    c.globalCompositeOperation = 'source-over';
    brugte.push(billede(ting));
    frugter.forEach(function (f) { tegnBillede(ting, f[0], f[1], f[2], 0, c); });
    gl = kildeLag[noegle] = { c: l.c, ox: ox, oy: oy, b: b, h: h, venter: brugte.filter(Sprites.venter) };
    return gl;
  }

  /** En kilde paa gaarden: dyr eller plante, med den ting den giver haengende paa. */
  function tegnKilde(navn, x, y, r, ryst, g) {
    var kilde = K.KILDER[navn], form = kilde.form, ting = kilde.giver[0];
    ctx.save();
    ctx.translate(x, y);
    if (ryst) ctx.rotate(Math.sin(ryst * 40) * 0.06);
    var lag = kildeBillede(navn, r);
    ctx.drawImage(lag.c, -lag.ox, -lag.oy, lag.b, lag.h);
    var frugt = function (fx, fy, s) { tegnBillede(ting, fx, fy, s); };
    if (form === 'ko') {
      tegnBillede('ko', 0, 0, r * 1.7);
      // Spanden: fyldes, naar der malkes
      var sp = g && g.spand ? Math.min(1, g.spandT || 0) : 0;
      ctx.fillStyle = '#ddd4c0'; ctx.strokeStyle = KANT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(r * 0.55, r * 0.35); ctx.lineTo(r * 1.05, r * 0.35); ctx.lineTo(r * 0.98, r * 0.85); ctx.lineTo(r * 0.62, r * 0.85); ctx.closePath(); ctx.fill(); ctx.stroke();
      if (sp > 0) { ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.ellipse(r * 0.8, r * 0.38 + (1 - sp) * r * 0.3, r * 0.22 * sp + r * 0.02, r * 0.07, 0, 0, Math.PI * 2); ctx.fill(); }
      ctx.beginPath(); ctx.arc(r * 0.8, r * 0.36, r * 0.24, Math.PI, 0); ctx.strokeStyle = KANT; ctx.stroke();
      if (sp >= 1) tegnBillede('maelk', r * 0.8, r * 0.05 - Math.abs(Math.sin(tid * 3)) * r * 0.05, r * 0.45);
    } else if (form === 'bi') {
      tegnBillede('bi', r * 0.55 + Math.sin(tid * 3) * r * 0.15, -r * 0.55 + Math.cos(tid * 4) * r * 0.1, r * 0.55);
    } else if (form === 'gris') {
      // Grisen staar paa marken som koen, med baconen ved siden af
      tegnBillede('gris', 0, 0, r * 1.7);
      frugt(r * 0.8, r * 0.05, r * 0.55);
    }
    ctx.restore();
  }

  /** Et malet spoergsmaalstegn: en krog og en prik, penselstroeg i to lag. */
  function spoergsmaal(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    function krog() {
      ctx.beginPath(); ctx.moveTo(-s * 0.2, -s * 0.2);
      ctx.bezierCurveTo(-s * 0.2, -s * 0.42, s * 0.22, -s * 0.44, s * 0.22, -s * 0.18);
      ctx.bezierCurveTo(s * 0.22, -s * 0.02, 0, -s * 0.02, 0, s * 0.12);
    }
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#e08a52'; ctx.lineWidth = s * 0.2; krog(); ctx.stroke();
    ctx.globalAlpha = 0.9; ctx.strokeStyle = '#d95f45'; ctx.lineWidth = s * 0.13; krog(); ctx.stroke();
    ctx.globalAlpha = 0.45; ctx.strokeStyle = '#f0c46a'; ctx.lineWidth = s * 0.035; ctx.translate(-s * 0.025, -s * 0.02); krog(); ctx.stroke(); ctx.translate(s * 0.025, s * 0.02);
    ctx.fillStyle = '#e08a52'; ctx.globalAlpha = 0.4; ctx.beginPath(); ctx.arc(0, s * 0.33, s * 0.105, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#d95f45'; ctx.globalAlpha = 0.9; ctx.beginPath(); ctx.arc(0, s * 0.33, s * 0.075, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function tegnGaard(i, p, s, v) {
    var g = v.gaard, H = window.innerHeight;
    ctx.save();
    ctx.beginPath(); ctx.rect(p.x0, 0, p.sw, H); ctx.clip();
    tegnGaardBaggrund(p);
    // Kunden staar og venter, og boblen viser, hvad der mangler: [ting] ?
    tegnKunde(s.kunde, p.kunde.x, p.kunde.y, p.kunde.str, 0);
    var b = p.boble;
    bobleStart(b, Math.min(1, g.t * 1.5 + 0.6));
    var ikon = Math.min(b.h * 0.66, b.b * 0.3);
    if (g.fundet) {
      // Tingen flyver op i boblen
      var e = Math.min(1, g.fundet.t / 0.7), ee = e * e * (3 - 2 * e);
      var fx = g.fundet.x + (b.x + b.b * 0.35 - g.fundet.x) * ee, fy = g.fundet.y + (b.y + b.h / 2 - g.fundet.y) * ee - Math.sin(ee * Math.PI) * 60;
      tegnBillede(g.ting, fx, fy, ikon * (1 + Math.sin(ee * Math.PI) * 0.4));
      if (e >= 1) {
        ctx.strokeStyle = '#7ab648'; ctx.lineWidth = Math.max(5, ikon * 0.14); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(b.x + b.b * 0.6, b.y + b.h * 0.52); ctx.lineTo(b.x + b.b * 0.67, b.y + b.h * 0.68); ctx.lineTo(b.x + b.b * 0.8, b.y + b.h * 0.34); ctx.stroke();
      }
    } else {
      tegnBillede(g.ting, b.x + b.b * 0.35, b.y + b.h / 2, ikon);
      spoergsmaal(b.x + b.b * 0.68, b.y + b.h / 2 + Math.sin(tid * 3) * b.h * 0.04, ikon * 0.9);
    }
    bobleSlut();
    // Kilderne
    p.kilder.forEach(function (kl, q) {
      var ind = Math.max(0, Math.min(1, g.t * 1.6 - q * 0.1)), rigtigFundet = g.fundet && K.kildeFor(g.ting) === kl.kilde;
      ctx.save(); ctx.globalAlpha = ind;
      var hop = rigtigFundet ? Math.abs(Math.sin(g.fundet.t * 8)) * kl.r * 0.1 : 0;
      tegnKilde(kl.kilde, kl.x, kl.y - hop + (1 - ind) * 30, kl.r, g.ryst && g.ryst.kilde === kl.kilde ? g.ryst.t : 0, kl.kilde === 'ko' ? g : null);
      ctx.restore();
    });
    // Forkert kilde: en lille tankeboble viser, hvad den giver
    if (g.tanke) {
      var t = g.tanke, kilde = K.KILDER[t.kilde], th = Math.min(p.sw * 0.28, 150) * 0.5;
      var tb = th * 2 * Math.max(1, kilde.giver.length / 2);      // bred nok til koens tre ting
      var tx = Math.max(p.x0 + tb / 2 + 8, Math.min(p.x0 + p.sw - tb / 2 - 8, t.x));
      var ty = Math.max(p.boble.y + p.boble.h + th * 0.8, t.y - th * 1.9);      // aldrig oven i kunden
      ctx.globalAlpha = Math.min(1, t.t * 3);
      ctx.fillStyle = '#fff'; ctx.strokeStyle = KANT; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.roundRect(tx - tb / 2, ty - th / 2, tb, th, 16); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx - tb * 0.1, ty + th * 0.75, th * 0.12, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.arc(tx - tb * 0.18, ty + th * 1.05, th * 0.07, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      kilde.giver.forEach(function (ting2, n) { tegnBillede(ting2, tx + (n - (kilde.giver.length - 1) / 2) * th * 0.9, ty, th * 0.75); });
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  /* ---------- faelles ---------- */

  function tegnFremskridt() {
    var B = window.innerWidth, n = dag.maal;
    var afstand = Math.min(28, (B - 240) / n), r = Math.min(9, afstand * 0.36);
    var bred = (n - 1) * afstand + r * 2 + 28;
    ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = KANT; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.roundRect(B / 2 - bred / 2, 22 - r - 8, bred, r * 2 + 16, r + 8); ctx.fill(); ctx.stroke();
    for (var i = 0; i < n; i++) {
      var x = B / 2 + (i - (n - 1) / 2) * afstand;
      ctx.beginPath(); ctx.arc(x, 22, r, 0, Math.PI * 2);
      ctx.fillStyle = i < dag.serveret ? '#f0c46a' : '#fff'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = KANT; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, 22, r * 0.55, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(94,74,58,.3)'; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    tegnLag();
    ctx.drawImage(lag, 0, 0, B, H);
    if (!dag) return;
    if (tilstand === 'spiller') for (var i = 0; i < dag.stationer.length; i++) tegnStation(i);
    // Ingredienser der traekkes med fingeren
    Object.keys(fingre).forEach(function (id) {
      var f = fingre[id];
      if (f.type === 'traek' && f.flyttet) tegnBillede(f.ting, f.x, f.y - 10, plan(f.i).ret.r * 0.75);
    });
    tegnPartikler();
    tegnFremskridt();
  }

  /* ---------- slutskaerm ---------- */

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) konfetti.push({ x: Math.random() * canvas.width, y: -Math.random() * canvas.height, vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
      rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6, b: 6 + Math.random() * 6, h: 4 + Math.random() * 4, farve: FARVER[i % FARVER.length] });
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d'), w = vinderCanvas.width, h = vinderCanvas.height;
    c.clearRect(0, 0, w, h);
    var n = Math.min(serverede.length, 8), str = Math.min(70, (w - 20) / Math.max(1, n));
    for (var i = 0; i < n; i++) {
      var img = billede(serverede[i]);
      if (Sprites.klar(img)) c.drawImage(img, w / 2 + (i - (n - 1) / 2) * str - str / 2, h * 0.55 - str / 2 - Math.abs(Math.sin(tid * 5 + i)) * 10, str, str);
    }
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > h + 10) { k.y = -10; k.x = Math.random() * w; }
      c.save(); c.translate(k.x, k.y); c.rotate(k.rot); c.fillStyle = k.farve; c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h); c.restore();
    });
  }

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    setTimeout(function () { afspil('dag.mp3', 'Sikke en god dag i restauranten!', 3); }, 700);
    visOverlay(
      '<div class="kort">' +
      '<h2>Alle er mætte!</h2>' +
      '<canvas class="eksempel" width="560" height="200" style="position:static;display:block;width:280px;height:100px;align-self:center"></canvas>' +
      Menu.slutRaekke('igen', null) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    startKonfetti(vinderCanvas);
  }

  /* ---------- loop ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    if (tilstand === 'spiller') opdater(dt);
    else if (tilstand === 'faerdig') { opdaterPartikler(dt); tegnVinder(dt); }
    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- menu ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; vinderCanvas = null; }

  function visMenu() {
    tilstand = 'venter';
    dag = null;
    lagFor = '';
    stopTale();
    visOverlay(
      '<div class="kort">' +
      '<h2>Skovkøkkenet</h2>' +
      '<p class="hjaelp">Hent det, der mangler, på gården. Lav maden, ring på klokken, og tag imod betalingen.</p>' +
      // Stjernerne og fri leg staar paa samme raekke: fri leg er et fjerde valg, en tallerken med et hjerte
      Menu.stjerneRaekke(friLeg ? -1 : svaerhed,
        '<button class="knap smal ikon' + (friLeg ? ' valgt' : '') + '" data-handling="fri" aria-label="Fri leg">' + Menu.fri() + '</button>') +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'fri') { friLeg = !friLeg; tone(friLeg ? 880 : 520, 0.12); visMenu(); }
    else if (h === 'svaerhed') { friLeg = false; svaerhed = parseInt(knap.dataset.n, 10); melodi([520, 660, 780].slice(0, svaerhed + 1), 70); visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (lydTil) tone(660, 0.12); else stopTale(); visMenu(); }
    else if (h === 'start') { skjulOverlay(); nyDag(parseInt(knap.dataset.spillere, 10)); }
    else if (h === 'igen') { skjulOverlay(); nyDag(antalSpillere); }
    else if (h === 'menu') visMenu();
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
    return {
      tilstand: tilstand, spillere: antalSpillere, svaerhed: svaerhed, lyd: lydTil,
      serveret: dag ? dag.serveret : null, maal: dag ? dag.maal : null,
      stationer: dag ? dag.stationer.map(function (s, i) {
        var p = plan(i), v = visning[i];
        return { kunde: s.kunde, bestilling: s.bestilling ? s.bestilling.id : null, ting: s.bestilling ? s.bestilling.ting : [], lagt: s.lagt.slice(), forberedt: s.forberedt, forberedtFaerdig: s.bestilling ? K.forberedtFaerdig(dag, i) : false, ret: { x: Math.round(p.ret.x), y: Math.round(p.ret.y) }, hylde: s.hylde.slice(), fri: friLeg, klar: s.bestilling ? K.klar(dag, i) : false,
          hent: s.hent, hentet: s.hentet, gaard: v.gaard ? { ting: v.gaard.ting, fundet: !!v.gaard.fundet, kilder: p.kilder.map(function (k) { return { kilde: k.kilde, x: Math.round(k.x), y: Math.round(k.y) }; }) } : null,
          regning: s.regning ? { sum: s.regning.sum, betalt: s.regning.betalt } : null, betaler: v.betaler, moenter: p.moenter.map(function (m) { return { moent: m.moent, x: Math.round(m.x), y: Math.round(m.y) }; }),
          optaget: v.serverer > 0 || !!v.gaar || (v.ind < 1 && !v.rengoer),
          pletter: v.rengoer ? v.rengoer.pletter.filter(function (pl) { return pl.styrke > 0; }).map(function (pl) { var st = pletSted(p, pl); return { x: Math.round(st.x), y: Math.round(st.y) }; }) : [],
          knapper: p.knapper.map(function (k) { return { ting: k.ting, x: Math.round(k.x), y: Math.round(k.y) }; }), klokke: { x: Math.round(p.klokke.x), y: Math.round(p.klokke.y) } };
      }) : null
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
