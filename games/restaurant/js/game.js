/**
 * Restauranten.
 *
 * En kunde kommer ind og bestiller: boblen viser retten og ingredienserne som
 * billeder, og stemmen siger bestillingen. Tryk ingredienserne op paa
 * tallerkenen, og ring paa klokken, naar retten er klar. En forkert ingrediens
 * hopper bare tilbage. Ingen tid, ingen sure kunder. To boern har hver sin
 * station og serverer sammen.
 *
 * Denne fil er kun skaerm og lyd. Bestillinger og regler ligger i js/koekken.js.
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

  var FARVER = ['#e8442e', '#3aa7e0', '#4cb944', '#ffd23f', '#9b5de5', '#ff8c42'];
  var STI = '../../assets/noto/';

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
  var ALLE = Object.keys(K.INGREDIENSER).concat(Object.keys(K.RETTER), K.KUNDER, ['klokke', 'hjerte']).map(function (n) { return STI + n + '.svg'; });
  Sprites.forhent(ALLE);
  function billede(navn) { return Sprites.hent(STI + navn + '.svg'); }
  function tegnBillede(navn, x, y, str, vinkel) {
    var img = billede(navn);
    if (!Sprites.klar(img)) return;
    ctx.save();
    ctx.translate(x, y);
    if (vinkel) ctx.rotate(vinkel);
    ctx.drawImage(img, -str / 2, -str / 2, str, str);
    ctx.restore();
  }

  /* ---------- lyd og stemme ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state === 'suspended') lyd.resume();
    return lyd;
  }

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

  function stopTale() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* ignorer */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }

  var TAK = ['Mmm, tak!', 'Det smager dejligt!', 'Tusind tak!'];
  function sigBestilling(b) {
    if (b.fri) afspil('fri.mp3', 'Overrask mig!', 1.8);
    else afspil('bestil_' + b.id + '.mp3', K.saetning(b), 3.5);
  }

  /* ---------- laerred ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /** Hvor tingene staar i en station. Alt regnes ud fra skaermen, saa det passer paa iPad og iPhone. */
  function plan(i) {
    var B = window.innerWidth, H = window.innerHeight;
    var n = dag ? dag.stationer.length : 1;
    var sw = B / n, x0 = i * sw;
    var luft = i === 0 ? Math.min(48, sw * 0.08) : 0;        // plads til hjem-knappen
    var kundeStr = Math.min(sw * 0.2, H * 0.27);
    var kunde = { x: x0 + luft + sw * 0.05 + kundeStr / 2, y: H * 0.115 + kundeStr / 2, str: kundeStr };
    var boble = { x: kunde.x + kundeStr * 0.62, y: H * 0.1, b: x0 + sw * 0.97 - (kunde.x + kundeStr * 0.62), h: Math.min(H * 0.24, kundeStr * 0.95) };
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
    return { x0: x0, sw: sw, kunde: kunde, boble: boble, ret: ret, knapper: knapper, klokke: klokke };
  }

  /* ---------- dag ---------- */

  function nyVisning(i) {
    return { ind: 0, flyvere: [], ryst: null, serverer: 0, gammel: null, bobleTil: 0, glad: 0, sidsteUps: -9, vend: 0, vink: 0, bidder: 0, rul: 0, haeld: 0, rengoer: null, glimt: 0 };
  }

  function nyDag(spillere) {
    antalSpillere = spillere;
    dag = K.nyDag(spillere, svaerhed, friLeg);
    visning = dag.stationer.map(function (s, i) { return nyVisning(i); });
    serverede = [];
    partikler = [];
    tilstand = 'spiller';
    melodi([660, 880], 120);
    dag.stationer.forEach(function (s, i) { kundeKommer(i, i * 0.9); });
  }

  function kundeKommer(i, forsinkelse) {
    var v = visning[i];
    v.ind = -(forsinkelse || 0);
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
    if (K.laeg(dag, i, ting) === 'ok') {
      v.flyvere.push({ ting: ting, fx: fx, fy: fy, t: 0, plads: s.lagt.length - 1 });
      tone(520 + s.lagt.length * 90, 0.1, 0.12);
      if (K.klar(dag, i)) setTimeout(function () { melodi([880, 1100], 90); }, 250);
    } else {
      // Forkert: den hopper bare tilbage. Ingen straf.
      v.ryst = { ting: ting, t: 0.45 };
      melodi([330, 262], 110);
      v.bobleTil = Math.max(v.bobleTil, tid + 2.5);      // vis bestillingen igen, saa man kan se hvad der mangler
      if (!friLeg && tid - v.sidsteUps > 6 && tid >= talerTil) { v.sidsteUps = tid; afspil('ups.mp3', 'Ups, det bestilte jeg ikke.', 2.2); }
    }
  }

  /* Rengoering: naar kunden er gaaet, toerres tallerken og disk af med svampen */

  function startRengoering(i) {
    var pletter = [], antal = 3 + Math.floor(Math.random() * 3);
    for (var k = 0; k < antal; k++) {
      var vinkel = (k / antal) * Math.PI * 2 + Math.random() * 0.8;
      pletter.push({ dx: Math.cos(vinkel) * (0.5 + Math.random() * 0.9), dy: Math.sin(vinkel) * 0.45, styrke: 1, form: Math.random() * 6, farve: ['#8a5236', '#d9432e', '#e8b96a', '#6b3e26'][k % 4] });
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
        if (plet.styrke <= 0) { tone(900 + Math.random() * 400, 0.1, 0.1, 'sine'); puf(st.x, st.y, '#bfe9ff', 8, 120, 4, 0.5); }
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

  function alleFaerdige() { return visning.every(function (x) { return x.serverer <= 0 && !x.rengoer; }); }

  function ned(e) {
    if (tilstand !== 'spiller') return;
    var pos = sted(e), x = pos.x, y = pos.y;
    for (var i = 0; i < dag.stationer.length; i++) {
      var p = plan(i), v = visning[i], s = dag.stationer[i];
      if (x < p.x0 || x >= p.x0 + p.sw) continue;
      if (v.rengoer) { fingre[e.pointerId] = { type: 'svamp', i: i, x: x, y: y }; toer(i, x, y, 0.5); return; }
      if (v.serverer > 0 || v.ind < 1 || !s.bestilling) return;      // kunden er paa vej ind eller ud

      // Kunden eller boblen: hoer og se bestillingen igen
      var iBoble = x > p.boble.x && x < p.boble.x + p.boble.b && y > p.boble.y && y < p.boble.y + p.boble.h;
      if (iBoble || Math.hypot(x - p.kunde.x, y - p.kunde.y) < p.kunde.str * 0.6) {
        v.bobleTil = tid + ((!friLeg && K.INDSTIL.huskeTid[svaerhed]) || 1e9);
        sigBestilling(s.bestilling);
        return;
      }
      // Foerst laves retten. Pizza: rul dejen ud med fingeren. Burger: svirp boeffen op i luften.
      // Pandekager: hold fingeren paa panden og haeld dej paa. Et almindeligt tryk tæller altid som et trin,
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
      for (var k = 0; k < p.knapper.length; k++) {
        var kn = p.knapper[k];
        if (Math.hypot(x - kn.x, y - kn.y) < kn.r * 1.15) {
          fingre[e.pointerId] = { type: 'traek', i: i, ting: kn.ting, kx: kn.x, ky: kn.y, x: x, y: y, flyttet: false };
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
      hjerter(p.kunde.x, p.kunde.y - p.kunde.str * 0.3);
      if (tid >= talerTil) { var n = Math.floor(Math.random() * TAK.length); afspil('tak_' + (n + 1) + '.mp3', TAK[n], 2); }
    }, 650);
  }

  /* ---------- opdatering ---------- */

  function opdater(dt) {
    visning.forEach(function (v, i) {
      if (v.ind < 1) v.ind = Math.min(1, v.ind + dt * 2.2);
      v.flyvere.forEach(function (f) { f.t = Math.min(1, f.t + dt * 3.6); });
      v.vend = Math.max(0, v.vend - dt); v.vink = Math.max(0, v.vink - dt); v.glimt = Math.max(0, v.glimt - dt);
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
          v.serverer = 0; v.gammel = null; v.bidder = 0;
          startRengoering(i);           // kunden er gaaet: toer af, saa kommer den naeste
        }
      }
    });
    opdaterPartikler(dt);
  }

  /* ---------- tegning af retterne ---------- */

  function tallerken(x, y, r) {
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath(); ctx.ellipse(x + 4, y + r * 0.18, r * 1.18, r * 0.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 1.15, r * 0.5, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#d9d4c7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(x, y + r * 0.1, r * 0.85, r * 0.36, 0, 0, Math.PI * 2); ctx.stroke();
  }

  function tegnPizza(x, y, r, lagt) {
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    ctx.fillStyle = '#e8b96a'; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#d9432e'; ctx.beginPath(); ctx.arc(x, y, r * 0.86, 0, Math.PI * 2); ctx.fill();
    var ostSet = false, plads = 0;
    lagt.forEach(function (t) {
      if (t === 'ost' && !ostSet) {
        ostSet = true;
        ctx.fillStyle = '#ffd86b';
        for (var k = 0; k < 9; k++) {
          var v = k * 0.7, rr = r * (k === 0 ? 0 : 0.5);
          ctx.beginPath(); ctx.arc(x + Math.cos(v) * rr, y + Math.sin(v) * rr, r * (k === 0 ? 0.5 : 0.32), 0, Math.PI * 2); ctx.fill();
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
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    ctx.fillStyle = '#e0a458';
    ctx.beginPath(); ctx.roundRect(x - b / 2, bund - lh, b, lh * 1.1, lh * 0.5); ctx.fill(); ctx.stroke();
    var top = bund - lh;
    lagt.forEach(function (t) {
      var yy = top - lh * 0.9;
      if (t === 'boef') { ctx.fillStyle = '#6b3e26'; ctx.beginPath(); ctx.roundRect(x - b * 0.52, yy, b * 1.04, lh, lh * 0.45); ctx.fill(); ctx.stroke(); }
      else if (t === 'ost') {
        ctx.fillStyle = '#ffd23f'; ctx.beginPath();
        ctx.moveTo(x - b * 0.55, yy + lh * 0.35); ctx.lineTo(x + b * 0.55, yy + lh * 0.35); ctx.lineTo(x + b * 0.55, yy + lh * 0.75);
        ctx.lineTo(x + b * 0.3, yy + lh * 0.75); ctx.lineTo(x + b * 0.2, yy + lh * 1.25); ctx.lineTo(x + b * 0.1, yy + lh * 0.75); ctx.lineTo(x - b * 0.55, yy + lh * 0.75);
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (t === 'salat') {
        ctx.fillStyle = '#4cb944'; ctx.beginPath(); ctx.moveTo(x - b * 0.58, yy + lh * 0.8);
        for (var k = 0; k <= 12; k++) ctx.lineTo(x - b * 0.58 + b * 1.16 * k / 12, yy + lh * (k % 2 ? 0.15 : 0.55));
        ctx.lineTo(x + b * 0.58, yy + lh * 0.8); ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if (t === 'tomat') {
        ctx.fillStyle = '#e8442e'; ctx.beginPath(); ctx.roundRect(x - b * 0.5, yy + lh * 0.15, b, lh * 0.65, lh * 0.3); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#ff9a8a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - b * 0.4, yy + lh * 0.48); ctx.lineTo(x + b * 0.4, yy + lh * 0.48); ctx.stroke();
        ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
      } else if (t === 'agurk') {
        ctx.fillStyle = '#7ccf5a';
        for (var a = 0; a < 4; a++) { ctx.beginPath(); ctx.ellipse(x - b * 0.36 + a * b * 0.24, yy + lh * 0.5, b * 0.13, lh * 0.38, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke(); }
      } else if (t === 'bacon') {
        ctx.fillStyle = '#c0453a'; ctx.beginPath(); ctx.moveTo(x - b * 0.56, yy + lh * 0.75);
        for (var m = 0; m <= 8; m++) ctx.lineTo(x - b * 0.56 + b * 1.12 * m / 8, yy + lh * (m % 2 ? 0.2 : 0.5));
        for (var q = 8; q >= 0; q--) ctx.lineTo(x - b * 0.56 + b * 1.12 * q / 8, yy + lh * (q % 2 ? 0.55 : 0.85));
        ctx.closePath(); ctx.fill(); ctx.stroke();
      }
      top = yy + lh * 0.1;
    });
    if (medTop) {
      var ty = top - lh * 0.1;
      ctx.fillStyle = '#e0a458'; ctx.beginPath();
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
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    for (var k = 0; k < antal; k++) {
      var yy = y + r * 0.2 - k * r * 0.22, b = r * (0.98 - k * 0.04);
      ctx.fillStyle = '#c98f4a'; ctx.beginPath(); ctx.ellipse(x, yy + r * 0.12, b, r * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f0c27a'; ctx.beginPath(); ctx.ellipse(x, yy, b, r * 0.34, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
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
        ctx.fillStyle = '#ffe680'; ctx.beginPath(); ctx.roundRect(x - r * 0.16, topY - r * 0.16, r * 0.32, r * 0.2, 4); ctx.fill(); ctx.stroke();
      } else {
        var sted = [[-0.4, -0.05], [0.4, -0.02], [0, -0.16], [-0.18, 0.06], [0.2, 0.08]][plads % 5];
        tegnBillede(t, x + sted[0] * r, topY + sted[1] * r - r * 0.12, r * 0.42);
        plads++;
      }
    });
  }

  function pande(x, y, r) {
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    ctx.fillStyle = '#3a3f47'; ctx.beginPath(); ctx.roundRect(x + r * 0.9, y - r * 0.09, r * 0.9, r * 0.18, r * 0.09); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#2b2f36'; ctx.beginPath(); ctx.ellipse(x, y, r, r * 0.55, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#4a505a'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.04, r * 0.84, r * 0.42, 0, 0, Math.PI * 2); ctx.fill();
  }

  /** Retten mens den laves: trin 0-2. vend er 1 lige efter et tryk og falder til 0. */
  function tegnForberedelse(ret, x, y, r, trin, vend, delvis) {
    delvis = Math.min(1, delvis || 0);
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    if (ret === 'pizza') {
      ctx.fillStyle = '#d9b07a'; ctx.beginPath(); ctx.roundRect(x - r * 1.15, y - r * 1.05, r * 2.3, r * 2.1, 18); ctx.fill(); ctx.stroke();
      var str = [0.34, 0.56, 0.78, 0.95];
      var dr = r * (str[trin] + (str[trin + 1] - str[trin]) * delvis) * (1 + vend * 0.12);
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      [[-0.8, -0.6], [0.75, -0.7], [0.85, 0.5], [-0.7, 0.75], [0.1, -0.9]].forEach(function (m) { ctx.beginPath(); ctx.arc(x + m[0] * r, y + m[1] * r, r * 0.05, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#f3dcae'; ctx.beginPath(); ctx.ellipse(x, y, dr, dr * (1 - vend * 0.15), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else if (ret === 'burger') {
      pande(x, y + r * 0.2, r * 1.05);
      var hop = Math.sin(vend * Math.PI) * r * 0.7, klem = Math.abs(Math.cos(vend * Math.PI));
      ctx.fillStyle = ['#e89a9a', '#b8705a', '#8a5236'][trin];
      ctx.beginPath(); ctx.ellipse(x, y + r * 0.2 - hop, r * 0.62, r * 0.3 * Math.max(0.15, klem), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    } else {
      tallerken(x - r * 0.55, y + r * 0.35, r * 0.75);
      tegnPandekager(x - r * 0.55, y + r * 0.1, r * 0.72, [], vend > 0 ? trin - 1 : trin);
      pande(x + r * 0.85, y + r * 0.3, r * 0.62);
      // Den nye pandekage flyver fra panden over paa stakken
      if (vend > 0 && trin > 0) {
        var e = 1 - vend, fx = x + r * 0.85 - r * 1.4 * e, fy = y + r * 0.3 - r * 0.6 * e - Math.sin(e * Math.PI) * r * 0.9;
        ctx.fillStyle = '#f0c27a'; ctx.beginPath(); ctx.ellipse(fx, fy, r * 0.5, r * 0.2 * Math.max(0.2, Math.abs(Math.cos(e * Math.PI * 2))), 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      } else {
        var dej = 0.12 + 0.3 * delvis;      // dejen breder sig, mens der haeldes
        ctx.fillStyle = '#f6dc9c'; ctx.beginPath(); ctx.ellipse(x + r * 0.85, y + r * 0.32, r * dej, r * dej * 0.48, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      }
    }
  }

  function tegnRet(ret, x, y, r, lagt, faerdig) {
    if (ret === 'pizza') { tallerken(x, y + r * 0.55, r * 1.02); tegnPizza(x, y, r * 0.95, lagt); }
    else if (ret === 'burger') { tallerken(x, y + r * 0.45, r); tegnBurger(x, y, r, lagt, faerdig); }
    else { tallerken(x, y + r * 0.35, r); tegnPandekager(x, y, r, lagt); }
  }

  /* ---------- tegning af stationen ---------- */

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.fillStyle = '#ffe9c7'; ctx.fillRect(0, 0, B, H);
    // Fliser paa vaeggen
    ctx.strokeStyle = 'rgba(201,143,74,0.25)'; ctx.lineWidth = 2;
    var f = Math.max(48, H * 0.09);
    for (var x = 0; x < B; x += f) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H * 0.4); ctx.stroke(); }
    for (var y = 0; y < H * 0.4; y += f) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(B, y); ctx.stroke(); }
    // Disk
    ctx.fillStyle = '#c98f4a'; ctx.fillRect(0, H * 0.4, B, H * 0.36);
    ctx.fillStyle = '#b07a3a'; ctx.fillRect(0, H * 0.4, B, 8);
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    for (var k = 0; k < 6; k++) ctx.fillRect(0, H * (0.45 + k * 0.05), B, 3);
    // Hylde
    ctx.fillStyle = '#8b5e34'; ctx.fillRect(0, H * 0.76, B, H * 0.24);
    ctx.fillStyle = '#6f4a28'; ctx.fillRect(0, H * 0.76, B, 8);
  }

  function tegnBoble(p, s, v) {
    var b = p.boble, synlig = tid < v.bobleTil;
    ctx.save();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.b, b.h, Math.min(26, b.h * 0.3)); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.42); ctx.lineTo(b.x - b.h * 0.2, b.y + b.h * 0.58); ctx.lineTo(b.x + 2, b.y + b.h * 0.72); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(b.x + 2, b.y + b.h * 0.42); ctx.lineTo(b.x - b.h * 0.2, b.y + b.h * 0.58); ctx.lineTo(b.x + 2, b.y + b.h * 0.72); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(b.x + 1, b.y + b.h * 0.44, 6, b.h * 0.27);

    var ting = s.bestilling.ting;
    if (s.bestilling.fri) {
      // Fri leg: kunden vil have retten, resten bestemmer kokken
      tegnBillede(s.bestilling.ret, b.x + b.b * 0.3, b.y + b.h / 2, b.h * 0.75);
      tegnBillede('hjerte', b.x + b.b * 0.68, b.y + b.h / 2 + Math.sin(tid * 4) * b.h * 0.05, b.h * 0.5);
      ctx.restore();
      return;
    }
    if (!synlig) {
      // 3 stjerner: bestillingen skal huskes. Tryk paa kunden for at se den igen.
      ctx.fillStyle = '#d9d4c7';
      for (var q = 0; q < 3; q++) { ctx.beginPath(); ctx.arc(b.x + b.b / 2 + (q - 1) * b.h * 0.34, b.y + b.h / 2, b.h * 0.1, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
      return;
    }
    var ikon = Math.min(b.h * 0.66, b.b / (ting.length + 1.9));
    var x = b.x + b.b * 0.04 + ikon * 0.6, y = b.y + b.h / 2;
    tegnBillede(s.bestilling.ret, x, y, ikon * 1.15);
    x += ikon * 0.95;
    ctx.fillStyle = '#12261f'; ctx.fillRect(x - ikon * 0.04, y - ikon * 0.34, ikon * 0.07, ikon * 0.68);
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
        ctx.strokeStyle = '#4cb944'; ctx.lineWidth = Math.max(4, ikon * 0.12); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x - ikon * 0.26, y + ikon * 0.02); ctx.lineTo(x - ikon * 0.06, y + ikon * 0.24); ctx.lineTo(x + ikon * 0.3, y - ikon * 0.22); ctx.stroke();
      }
      x += ikon * 1.02;
    });
    ctx.restore();
  }

  /** Kagerulle, pil eller kande: viser hvilken bevaegelse retten vil have. Foelger fingeren, naar den er nede. */
  function tegnRedskab(i, ret, x, y, r) {
    var f = null;
    Object.keys(fingre).forEach(function (id) { if (fingre[id].i === i && fingre[id].type !== 'traek') f = fingre[id]; });
    ctx.save();
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    if (ret === 'pizza') {
      var kx = f ? f.x : x + Math.sin(tid * 2.5) * r * 0.7, ky = f ? f.y : y;
      ctx.translate(kx, ky); ctx.rotate(-0.5);
      ctx.fillStyle = '#8b5e34'; ctx.beginPath(); ctx.roundRect(-r * 0.95, -r * 0.06, r * 1.9, r * 0.12, r * 0.06); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#d9a066'; ctx.beginPath(); ctx.roundRect(-r * 0.65, -r * 0.15, r * 1.3, r * 0.3, r * 0.12); ctx.fill(); ctx.stroke();
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
      ctx.fillStyle = '#fff6e3'; ctx.beginPath(); ctx.roundRect(-r * 0.25, -r * 0.3, r * 0.5, r * 0.6, r * 0.08); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.25, -r * 0.3); ctx.lineTo(-r * 0.42, -r * 0.36); ctx.lineTo(-r * 0.25, -r * 0.14); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#f6dc9c'; ctx.fillRect(-r * 0.2, -r * 0.1, r * 0.4, r * 0.35);
    }
    ctx.restore();
  }

  function tegnRengoering(i, p, v) {
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
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
    ctx.fillStyle = '#4cb944'; ctx.beginPath(); ctx.roundRect(sx - b / 2, sy - b * 0.36, b, b * 0.3, 6); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.roundRect(sx - b / 2, sy - b * 0.14, b, b * 0.44, 8); ctx.fill(); ctx.stroke();
  }

  function tegnStation(i) {
    var p = plan(i), s = dag.stationer[i], v = visning[i];
    if (v.rengoer) { tegnRengoering(i, p, v); return; }
    var ser = v.serverer > 0, g = v.gammel;
    var kundeNavn = ser && g ? g.kunde : s.kunde;
    if (!kundeNavn) return;

    // Kunden glider ind fra siden, hopper naar maden kommer, og glider ud igen
    var ind = Math.max(0, v.ind), skub = (1 - ind) * -p.kunde.str * 1.6;
    var hop = 0;
    if (ser) {
      var t = 2.0 - v.serverer;
      if (t > 0.6 && t < 1.5) hop = Math.abs(Math.sin((t - 0.6) * 9)) * p.kunde.str * 0.12;
      if (t >= 1.5) skub = -(t - 1.5) / 0.5 * p.kunde.str * 1.8;
    }
    tegnBillede(kundeNavn, p.kunde.x + skub, p.kunde.y - hop, p.kunde.str);

    if (!ser && ind >= 1 && s.bestilling) tegnBoble(p, s, v);

    // Retten: under servering flyver den op til kunden
    var lagtPaa = ser && g ? g.lagt : s.lagt.filter(function (t, n) { return !v.flyvere.some(function (f) { return f.plads === n && f.t < 1; }); });
    var ret = ser && g ? g.bestilling.ret : (s.bestilling ? s.bestilling.ret : null);
    if (ret && (ser || ind >= 1)) {
      var rx = p.ret.x, ry = p.ret.y, rr = p.ret.r;
      if (ser) {
        var tt = Math.min(1, (2.0 - v.serverer) / 0.6), e = tt * tt * (3 - 2 * tt);
        rx += (p.kunde.x + p.kunde.str * 0.1 - rx) * e; ry += (p.kunde.y + p.kunde.str * 0.45 - ry) * e; rr *= 1 - e * 0.55;
        rr *= [1, 0.78, 0.55, 0][v.bidder];      // kunden spiser retten i tre bidder
      }
      if (!ser && !K.forberedtFaerdig(dag, i)) {
        var vink = v.vink > 0 ? Math.sin(v.vink * 40) * rr * 0.06 : 0;
        // En ring der pulserer viser, hvor man skal trykke
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.5 + Math.sin(tid * 5) * 0.3) + ')'; ctx.lineWidth = 6; ctx.setLineDash([14, 12]);
        ctx.beginPath(); ctx.arc(rx, ry + rr * 0.15, rr * (1.28 + Math.sin(tid * 5) * 0.04), 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
        tegnForberedelse(ret, rx + vink, ry, rr, s.forberedt, v.vend / 0.35, ret === 'pizza' ? v.rul : v.haeld);
        tegnRedskab(i, ret, rx, ry, rr);
      } else if (rr > 0) tegnRet(ret, rx, ry, rr, lagtPaa, ser || K.klar(dag, i));
      ctx.globalAlpha = 1;
    }

    // Ingredienser der flyver fra hylden til tallerkenen
    v.flyvere.forEach(function (f) {
      if (f.t >= 1) return;
      var e = f.t * f.t * (3 - 2 * f.t);
      var x = f.fx + (p.ret.x - f.fx) * e, y = f.fy + (p.ret.y - f.fy) * e - Math.sin(e * Math.PI) * p.ret.r * 0.9;
      tegnBillede(f.ting, x, y, p.ret.r * 0.6);
    });

    if (ser) return;

    // Hylden
    var klar = K.klar(dag, i);
    if (!K.forberedtFaerdig(dag, i)) ctx.globalAlpha = 0.35;
    p.knapper.forEach(function (kn) {
      var ryst = v.ryst && v.ryst.ting === kn.ting ? Math.sin(v.ryst.t * 50) * kn.r * 0.18 : 0;
      ctx.fillStyle = '#fff6e3'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(kn.x + ryst, kn.y, kn.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      tegnBillede(kn.ting, kn.x + ryst, kn.y, kn.r * 1.35);
    });
    ctx.globalAlpha = 1;
    // Klokken lyser og vipper, naar retten er klar
    var kl = p.klokke, vip = klar ? Math.sin(tid * 9) * 0.18 : (v.ryst && v.ryst.ting === 'klokke' ? Math.sin(v.ryst.t * 50) * 0.12 : 0);
    ctx.fillStyle = klar ? '#ffd23f' : '#d9c7a8'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(kl.x, kl.y, kl.r * (klar ? 1 + Math.sin(tid * 6) * 0.05 : 1), 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.globalAlpha = klar ? 1 : 0.45;
    tegnBillede('klokke', kl.x, kl.y, kl.r * 1.4, vip);
    ctx.globalAlpha = 1;
  }

  function tegnFremskridt() {
    var B = window.innerWidth, n = dag.maal;
    var afstand = Math.min(28, (B - 240) / n), r = Math.min(9, afstand * 0.36);
    for (var i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(B / 2 + (i - (n - 1) / 2) * afstand, 22, r, 0, Math.PI * 2);
      ctx.fillStyle = i < dag.serveret ? '#4cb944' : 'rgba(255,255,255,0.7)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#12261f'; ctx.stroke();
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnBaggrund();
    if (!dag) return;
    if (tilstand === 'spiller') for (var i = 0; i < dag.stationer.length; i++) tegnStation(i);
    if (dag.stationer.length === 2) { ctx.fillStyle = 'rgba(18,38,31,0.55)'; ctx.fillRect(B / 2 - 3, 0, 6, H); }
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
      '<button class="knap gul" data-handling="igen">Spil igen</button>' +
      '<button class="knap" data-handling="menu">Menu</button>' +
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

  function stjerner(fyldt) {
    var s = '<svg width="84" height="26" viewBox="0 0 84 26" aria-hidden="true">';
    for (var i = 0; i < 3; i++) {
      var cx = 13 + i * 29, cy = 13, d = '';
      for (var k = 0; k < 10; k++) { var r = k % 2 ? 5 : 12, v = -Math.PI / 2 + k * Math.PI / 5; d += (k ? 'L' : 'M') + (cx + Math.cos(v) * r).toFixed(1) + ' ' + (cy + Math.sin(v) * r).toFixed(1); }
      s += '<path d="' + d + 'Z" fill="' + (i < fyldt ? '#ffd23f' : '#d9d4c7') + '" stroke="#12261f" stroke-width="2" stroke-linejoin="round"/>';
    }
    return s + '</svg>';
  }

  function lydIkon(til) {
    return '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M4 11h6l7-6v20l-7-6H4z" fill="#12261f"/>' +
      (til ? '<path d="M20 10c2 2.5 2 7.5 0 10M23.5 7c3.5 4.5 3.5 11.5 0 16" fill="none" stroke="#12261f" stroke-width="2.5" stroke-linecap="round"/>'
           : '<path d="M20 11l7 8M27 11l-7 8" fill="none" stroke="#e8442e" stroke-width="3" stroke-linecap="round"/>') + '</svg>';
  }

  function visMenu() {
    tilstand = 'venter';
    dag = null;
    stopTale();
    var stjerneKnapper = [0, 1, 2].map(function (n) {
      return '<button class="knap smal ikon' + (n === svaerhed && !friLeg ? ' valgt' : '') + '" data-handling="svaerhed" data-n="' + n + '" aria-label="' + (n + 1) + ' stjerner">' + stjerner(n + 1) + '</button>';
    }).join('');
    visOverlay(
      '<div class="kort">' +
      '<h2>Restauranten</h2>' +
      '<p class="hjaelp">Se hvad kunden vil have. Tryk maden op på tallerkenen, og ring på klokken.</p>' +
      '<div class="raekke">' + stjerneKnapper + '</div>' +
      '<div class="raekke"><button class="knap smal' + (friLeg ? ' valgt' : '') + '" data-handling="fri">Fri leg</button></div>' +
      '<div class="raekke start">' +
      '<button class="knap gul" data-handling="start" data-spillere="1">1 spiller</button>' +
      '<button class="knap gul" data-handling="start" data-spillere="2">2 spillere</button>' +
      '</div>' +
      '<div class="raekke bund">' +
      '<button class="knap lille ikon" data-handling="lyd" aria-label="Lyd til eller fra">' + lydIkon(lydTil) + '</button>' +
      '</div>' +
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
        var p = plan(i);
        return { kunde: s.kunde, bestilling: s.bestilling ? s.bestilling.id : null, ting: s.bestilling ? s.bestilling.ting : [], lagt: s.lagt.slice(), forberedt: s.forberedt, forberedtFaerdig: s.bestilling ? K.forberedtFaerdig(dag, i) : false, ret: { x: Math.round(p.ret.x), y: Math.round(p.ret.y) }, hylde: s.hylde.slice(), fri: friLeg, klar: s.bestilling ? K.klar(dag, i) : false,
          optaget: visning[i].serverer > 0 || (visning[i].ind < 1 && !visning[i].rengoer),
          pletter: visning[i].rengoer ? visning[i].rengoer.pletter.filter(function (pl) { return pl.styrke > 0; }).map(function (pl) { var st = pletSted(p, pl); return { x: Math.round(st.x), y: Math.round(st.y) }; }) : [],
          knapper: p.knapper.map(function (k) { return { ting: k.ting, x: Math.round(k.x), y: Math.round(k.y) }; }), klokke: { x: Math.round(p.klokke.x), y: Math.round(p.klokke.y) } };
      }) : null
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
