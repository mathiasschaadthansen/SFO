/**
 * Tegn og pusl.
 *
 * Foerst tegnes en figur ved at foelge de stiplede streger med fingeren. Hver
 * del faar farve, saa snart den er tegnet. Naar figuren er faerdig, bliver
 * billedet til et puslespil, som samles ved at traekke brikkerne paa plads.
 * Fire universer med fire figurer hver. Ingen tid, ingen forkerte traek.
 *
 * Denne fil er kun skaerm og lyd. Figurerne ligger i figurer.js, puslespillets
 * regler i pusle.js, og fingeren foelges af Spor fra bogstav-spillet.
 */
(function () {
  'use strict';

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
  var TOLERANCE = [15, 12, 10];        // hvor taet fingeren skal foelge stregen, pr. stjerne
  var SKYGGE = [0.3, 0.12, 0];         // hvor tydeligt billedet anes paa braettet under puslespillet

  var svaerhed = 0;
  var lydTil = true;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var tilstand = 'menu';               // menu | tegn | farv | split | pusl | jubel | slut
  var univers = null, koe = [], lavet = [], figur = null, spor = null, pusle = null;
  var billede = null, brikBilleder = [];
  var t0 = 0, tid = 0, sidsteTid = 0;
  var tegneFinger = null, fingerSted = null;
  var partikler = [];
  var slutCanvas = null;
  var lyd = null;

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
      var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
      o.type = type || 'triangle'; o.frequency.value = frekvens;
      g.gain.value = styrke || 0.15;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination); o.start(); o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) { toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.13); }, i * mellemrum); }); }

  // Kun enhedens egne stemmer (localService), saa intet gaar over nettet
  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    stemme = window.speechSynthesis.getVoices().filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }
  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try {
      var u = new SpeechSynthesisUtterance(tekst);
      u.voice = stemme; u.lang = stemme.lang; u.rate = 0.9;
      window.speechSynthesis.cancel(); window.speechSynthesis.speak(u);
    } catch (e) { /* stemme er pynt */ }
  }

  /* ---------- laerred og plads ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (pusle && figur) lavBilleder();
  }

  /** Braettet: en firkant midt paa skaermen. u er pixels pr. enhed i 100 x 100-kassen. */
  function braet() {
    var B = window.innerWidth, H = window.innerHeight;
    var str = Math.min(H * 0.84, B * 0.46);
    return { x: (B - str) / 2, y: (H - str) / 2, str: str, u: str / 100 };
  }
  function tilEnheder(e) {
    var r = lærred.getBoundingClientRect(), b = braet();
    return { x: (e.clientX - r.left - b.x) / b.u, y: (e.clientY - r.top - b.y) / b.u, px: e.clientX - r.left, py: e.clientY - r.top };
  }

  /**
   * Hvor brikkernes midte ligger fra start: paa hver side af braettet. Er der plads (telefon paa
   * tvaers), ligger de i to soejler pr. side, ellers i en soejle, forskudt som trappetrin, saa der
   * altid stikker noget frem at tage fat i.
   */
  function pladser(kol, raek) {
    var b = braet(), side = b.x / b.u, pb = 100 / kol, ph = 100 / raek, antal = kol * raek;
    var soejler = side >= pb * 2.25 ? 2 : 1;
    var ud = [];
    [Math.ceil(antal / 2), Math.floor(antal / 2)].forEach(function (n, hoejre) {
      var raekker = Math.ceil(n / soejler);
      var top = ph / 2 - 3, bund = 100 - ph / 2 + 3;
      var taet = raekker * ph > bund - top + ph;                     // de overlapper: forskyd dem
      for (var i = 0; i < n; i++) {
        var r = Math.floor(i / soejler), s = i % soejler;
        var y = raekker === 1 ? 50 : top + (bund - top) * r / (raekker - 1);
        var x = side * (s + 0.5) / soejler + (taet && soejler === 1 ? (r % 2 ? 1 : -1) * Math.min(8, side * 0.12) : 0);
        ud.push([hoejre ? 100 + x : -x, y]);
      }
    });
    return ud;
  }

  /* ---------- tegning af figurer ---------- */

  function sti(c, punkter) {
    c.beginPath();
    c.moveTo(punkter[0][0], punkter[0][1]);
    for (var i = 1; i < punkter.length; i++) c.lineTo(punkter[i][0], punkter[i][1]);
  }

  function tegnDel(c, d) {
    c.lineJoin = 'round'; c.lineCap = 'round';
    if (Figurer.lukket(d)) {
      sti(c, d.sti); c.closePath();
      if (d.fyld) { c.fillStyle = d.fyld; c.fill(); }
      c.strokeStyle = '#12261f'; c.lineWidth = d.pynt ? 1.3 : 2; c.stroke();
    } else if (d.pynt) {
      sti(c, d.sti); c.strokeStyle = d.farve; c.lineWidth = 1.6; c.stroke();
    } else {
      sti(c, d.sti); c.strokeStyle = '#12261f'; c.lineWidth = 6.2; c.stroke();
      sti(c, d.sti); c.strokeStyle = d.farve; c.lineWidth = 3.6; c.stroke();
    }
  }

  /** Hele figuren i 100 x 100-enheder. c skal allerede vaere skaleret. */
  function tegnFigur(c, f, pyntAlfa) {
    f.dele.forEach(function (d) {
      if (d.pynt) { if (pyntAlfa <= 0) return; c.globalAlpha = pyntAlfa; }
      tegnDel(c, d);
      c.globalAlpha = 1;
    });
  }

  function tegnBaggrund(c, id) {
    var g = c.createLinearGradient(0, 0, 0, 100);
    if (id === 'hav') {
      g.addColorStop(0, '#bfe9ff'); g.addColorStop(1, '#6fc3ee'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
      c.fillStyle = '#f3dcae'; c.beginPath(); c.moveTo(0, 100); c.lineTo(0, 92);
      for (var x = 0; x <= 100; x += 10) c.quadraticCurveTo(x + 5, 88 + (x % 20 ? 3 : -1), x + 10, 92);
      c.lineTo(100, 100); c.closePath(); c.fill();
      c.strokeStyle = 'rgba(255,255,255,0.8)'; c.lineWidth = 1;
      [[10, 20, 3], [16, 12, 2], [88, 30, 3.5], [82, 18, 2], [92, 60, 2.5], [6, 66, 2]].forEach(function (b) { c.beginPath(); c.arc(b[0], b[1], b[2], 0, Math.PI * 2); c.stroke(); });
      c.strokeStyle = '#3f9b52'; c.lineWidth = 2.4; c.lineCap = 'round';
      [[8, 0], [93, 1]].forEach(function (s) { c.beginPath(); c.moveTo(s[0], 94); c.quadraticCurveTo(s[0] - 5, 84, s[0] + 1, 76); c.quadraticCurveTo(s[0] + 5, 70, s[0], 64); c.stroke(); });
    } else {
      g.addColorStop(0, '#bfe9ff'); g.addColorStop(1, '#e9f8ff'); c.fillStyle = g; c.fillRect(0, 0, 100, 100);
      c.fillStyle = '#fff';
      [[16, 14], [80, 10]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], 6, 0, Math.PI * 2); c.arc(s[0] + 7, s[1] + 1, 5, 0, Math.PI * 2); c.arc(s[0] - 7, s[1] + 2, 4.5, 0, Math.PI * 2); c.fill(); });
      if (id === 'maskiner') {
        c.fillStyle = '#9bd17a'; c.fillRect(0, 78, 100, 22);
        c.fillStyle = '#6d727b'; c.fillRect(0, 84, 100, 16);
        c.fillStyle = '#fff'; for (var v = 4; v < 100; v += 16) c.fillRect(v, 91, 8, 1.6);
      } else {
        c.fillStyle = id === 'dyr' ? '#8fd16a' : '#9bd17a';
        c.beginPath(); c.moveTo(0, 100); c.lineTo(0, 84); c.quadraticCurveTo(30, 74, 60, 84); c.quadraticCurveTo(82, 90, 100, 80); c.lineTo(100, 100); c.closePath(); c.fill();
        if (id === 'dyr') {
          c.strokeStyle = '#a97a4a'; c.lineWidth = 1.8;
          for (var p = 4; p < 100; p += 12) { c.beginPath(); c.moveTo(p, 72); c.lineTo(p, 84); c.stroke(); }
          c.beginPath(); c.moveTo(0, 76); c.lineTo(100, 76); c.moveTo(0, 81); c.lineTo(100, 81); c.stroke();
        } else {
          [[10, 92, '#ff7eb6'], [24, 95, '#ffd23f'], [78, 93, '#e8442e'], [92, 90, '#ff7eb6']].forEach(function (b) { c.fillStyle = b[2]; c.beginPath(); c.arc(b[0], b[1], 1.8, 0, Math.PI * 2); c.fill(); });
        }
      }
    }
  }

  /* ---------- puslespillets billeder ---------- */

  function kant(c, x0, y0, x1, y1, fortegn, tap) {
    if (!fortegn) { c.lineTo(x1, y1); return; }
    var dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy), nx = dy / l, ny = -dx / l;      // normalen peger ud af brikken
    function p(t, ud) { return [x0 + dx * t + nx * ud * tap * fortegn, y0 + dy * t + ny * ud * tap * fortegn]; }
    var a = p(0.36, 0), c1 = p(0.48, 0.25), c2 = p(0.26, 0.98), top = p(0.5, 1), c3 = p(0.74, 0.98), c4 = p(0.52, 0.25), b = p(0.64, 0);
    c.lineTo(a[0], a[1]);
    c.bezierCurveTo(c1[0], c1[1], c2[0], c2[1], top[0], top[1]);
    c.bezierCurveTo(c3[0], c3[1], c4[0], c4[1], b[0], b[1]);
    c.lineTo(x1, y1);
  }

  /** Brikkens omrids med (0,0) i brikkens oeverste venstre hjoerne, i enheder. */
  function brikSti(c, br) {
    var b = pusle.b, h = pusle.h, tap = Math.min(b, h) * 0.24;
    c.beginPath(); c.moveTo(0, 0);
    kant(c, 0, 0, b, 0, br.kanter.op, tap);
    kant(c, b, 0, b, h, br.kanter.hoejre, tap);
    kant(c, b, h, 0, h, br.kanter.ned, tap);
    kant(c, 0, h, 0, 0, br.kanter.venstre, tap);
    c.closePath();
  }

  /** Tegn hele billedet en gang, og klip hver brik ud i sit eget lille laerred. */
  function lavBilleder() {
    var b = braet(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    var sk = Math.min(10, b.u * dpr);                      // pixels pr. enhed i billedet
    billede = document.createElement('canvas');
    billede.width = billede.height = Math.ceil(100 * sk);
    var c = billede.getContext('2d');
    c.scale(sk, sk);
    tegnBaggrund(c, univers.id);
    tegnFigur(c, figur, 1);

    var m = Math.min(pusle.b, pusle.h) * 0.28;             // luft til tappene
    brikBilleder = pusle.brikker.map(function (br) {
      var l = document.createElement('canvas');
      l.width = Math.ceil((pusle.b + 2 * m) * sk); l.height = Math.ceil((pusle.h + 2 * m) * sk);
      var k = l.getContext('2d');
      k.scale(sk, sk); k.translate(m, m);
      k.save(); brikSti(k, br); k.clip();
      k.drawImage(billede, -br.kol * pusle.b, -br.raek * pusle.h, 100, 100);
      k.restore();
      brikSti(k, br); k.strokeStyle = '#12261f'; k.lineWidth = 0.9; k.lineJoin = 'round'; k.stroke();
      return { billede: l, m: m };
    });
  }

  /* ---------- spillets gang ---------- */

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  function startUnivers(u) {
    univers = u;
    koe = bland(u.figurer);
    lavet = [];
    naesteFigur();
  }

  function naesteFigur() {
    if (!koe.length) { afslut(); return; }
    figur = koe.shift();
    spor = new Spor(Figurer.glyf(figur), TOLERANCE[svaerhed]);
    pusle = null; billede = null; brikBilleder = [];
    tegneFinger = null; fingerSted = null;
    tilstand = 'tegn'; t0 = tid;
    melodi([523, 659], 110);
  }

  function figurTegnet() {
    tilstand = 'farv'; t0 = tid;
    melodi([660, 880, 1100, 1320], 100);
    var b = braet();
    for (var i = 0; i < 26; i++) gnist(b.x + Math.random() * b.str, b.y + Math.random() * b.str);
    setTimeout(function () { sig(figur.navn.charAt(0).toUpperCase() + figur.navn.slice(1) + '!'); }, 350);
  }

  function startPusle() {
    var g = Pusle.INDSTIL.gitter[svaerhed];
    pusle = Pusle.nyt(svaerhed, pladser(g[0], g[1]));
    lavBilleder();
    tilstand = 'split'; t0 = tid;
    tone(200, 0.25, 0.14, 'square'); setTimeout(function () { tone(150, 0.3, 0.12, 'square'); }, 120);
  }

  function pusleFaerdigt() {
    tilstand = 'jubel'; t0 = tid;
    lavet.push(figur);
    melodi([660, 880, 1100, 1320, 1760], 100);
    var b = braet();
    for (var i = 0; i < 40; i++) gnist(b.x + Math.random() * b.str, b.y + Math.random() * b.str);
  }

  /* ---------- partikler ---------- */

  function gnist(x, y) {
    if (partikler.length > 250) return;
    var v = Math.random() * Math.PI * 2, f = 60 + Math.random() * 160;
    partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f - 80, liv: 0.9, maxLiv: 0.9, r: 3 + Math.random() * 4, farve: FARVER[Math.floor(Math.random() * FARVER.length)] });
  }
  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy += 420 * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.liv -= dt;
      if (p.liv <= 0) partikler.splice(i, 1);
    }
  }

  /* ---------- fingre ---------- */

  function ned(e) {
    var s = tilEnheder(e);
    if (tilstand === 'tegn') {
      if (tegneFinger !== null) return;
      tegneFinger = e.pointerId; fingerSted = s;
      var aktiv = spor.aktiv;
      spor.start(s.x, s.y);
      efterSpor(aktiv, s);
    } else if (tilstand === 'pusl') {
      if (Pusle.tag(pusle, s.x, s.y, e.pointerId)) tone(440, 0.06, 0.08);
    }
  }

  function flyt(e) {
    var s = tilEnheder(e);
    if (tilstand === 'tegn' && e.pointerId === tegneFinger) {
      fingerSted = s;
      var aktiv = spor.aktiv, foer = spor.indeks;
      spor.flyt(s.x, s.y);
      if (spor.aktiv === aktiv && spor.indeks > foer && Math.random() < 0.25) tone(300 + spor.andel() * 500, 0.05, 0.04, 'sine');
      efterSpor(aktiv, s);
    } else if (tilstand === 'pusl') {
      Pusle.flyt(pusle, s.x, s.y, e.pointerId);
    }
  }

  function efterSpor(aktivFoer, s) {
    if (spor.aktiv !== aktivFoer || spor.faerdig) {
      tone(880, 0.14, 0.13); setTimeout(function () { tone(1320, 0.18, 0.1); }, 70);
      for (var i = 0; i < 8; i++) gnist(s.px, s.py);
    }
    if (spor.faerdig) { tegneFinger = null; figurTegnet(); }
  }

  function op(e) {
    if (tilstand === 'tegn' && e.pointerId === tegneFinger) { tegneFinger = null; spor.slip(); }
    else if (tilstand === 'pusl') {
      if (Pusle.slip(pusle, e.pointerId)) {
        tone(700, 0.07, 0.14, 'square'); setTimeout(function () { tone(1050, 0.12, 0.1); }, 60);
        var b = braet(), br = pusle.netopPaa;
        for (var i = 0; i < 10; i++) gnist(b.x + (br.x + pusle.b / 2) * b.u, b.y + (br.y + pusle.h / 2) * b.u);
        if (pusle.faerdig) pusleFaerdigt();
      }
    }
  }

  /* ---------- tegning ---------- */

  function tegnRum() {
    var B = window.innerWidth, H = window.innerHeight;
    var farver = { hav: ['#d5f0ff', '#a8dcf7'], dyr: ['#e6f7d4', '#c6eaa6'], maskiner: ['#eceff3', '#d3d9e2'], have: ['#fff3c9', '#ffe39a'] }[univers ? univers.id : 'have'];
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, farver[0]); g.addColorStop(1, farver[1]);
    ctx.fillStyle = g; ctx.fillRect(0, 0, B, H);
  }

  function tegnPapir(b) {
    ctx.fillStyle = 'rgba(18,38,31,0.18)'; ctx.beginPath(); ctx.roundRect(b.x + 6, b.y + 8, b.str, b.str, 18); ctx.fill();
    ctx.fillStyle = '#fffdf6'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(b.x, b.y, b.str, b.str, 18); ctx.fill(); ctx.stroke();
  }

  function tegnTegning(b) {
    tegnPapir(b);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(b.u, b.u);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    var dele = figur.dele.filter(function (d) { return !d.pynt; });
    // Det der mangler: stiplet. Det der er tegnet: med farve.
    dele.forEach(function (d, k) {
      if (k < spor.aktiv) return;
      sti(ctx, d.sti);
      ctx.setLineDash([2.5, 3.5]); ctx.strokeStyle = k === spor.aktiv ? '#7c8a84' : '#c9cfc9'; ctx.lineWidth = k === spor.aktiv ? 2.4 : 1.8; ctx.stroke();
      ctx.setLineDash([]);
    });
    dele.forEach(function (d, k) { if (k < spor.aktiv) tegnDel(ctx, d); });
    if (!spor.faerdig) {
      var d = dele[spor.aktiv], punkter = spor.streger[spor.aktiv];
      if (spor.indeks > 0) {
        sti(ctx, punkter.slice(0, spor.indeks + 1));
        ctx.strokeStyle = '#12261f'; ctx.lineWidth = 5.4; ctx.stroke();
        sti(ctx, punkter.slice(0, spor.indeks + 1));
        ctx.strokeStyle = d.fyld || d.farve; ctx.lineWidth = 3.2; ctx.stroke();
      }
      // En lille prik loeber i forvejen og viser vejen
      var frem = Math.min(punkter.length - 1, spor.indeks + Math.floor(((tid * 1.1) % 1) * Math.min(30, punkter.length)));
      ctx.fillStyle = 'rgba(18,38,31,0.35)'; ctx.beginPath(); ctx.arc(punkter[frem][0], punkter[frem][1], 1.6, 0, Math.PI * 2); ctx.fill();
      // Her skal fingeren vaere
      var n = spor.naeste(), puls = 1 + Math.sin(tid * 6) * 0.18;
      ctx.fillStyle = 'rgba(255,210,63,0.45)'; ctx.beginPath(); ctx.arc(n[0], n[1], 7 * puls, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd23f'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(n[0], n[1], 3.6, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    if (tegneFinger !== null && fingerSted) tegnBlyant(fingerSted.px, fingerSted.py, b.u);
    tegnFremskridt();
  }

  function tegnBlyant(x, y, u) {
    ctx.save();
    ctx.translate(x, y); ctx.rotate(-0.6);
    var l = u * 22, t = u * 5;
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3; ctx.lineJoin = 'round';
    ctx.fillStyle = '#f3dcae'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(t * 0.9, -t / 2); ctx.lineTo(t * 0.9, t / 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ffd23f'; ctx.beginPath(); ctx.rect(t * 0.9, -t / 2, l, t); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff7eb6'; ctx.beginPath(); ctx.roundRect(t * 0.9 + l, -t / 2, t * 0.8, t, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#12261f'; ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(t * 0.3, -t * 0.17); ctx.lineTo(t * 0.3, t * 0.17); ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /** Fire cirkler oeverst: hvor mange figurer er lavet i dette univers. */
  function tegnFremskridt() {
    var B = window.innerWidth, n = univers.figurer.length;
    for (var i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(B / 2 + (i - (n - 1) / 2) * 28, 20, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < lavet.length ? '#4cb944' : 'rgba(255,255,255,0.75)'; ctx.fill();
      ctx.lineWidth = 3; ctx.strokeStyle = '#12261f'; ctx.stroke();
    }
  }

  function tegnHeltBillede(b, pyntAlfa, hop) {
    tegnPapir(b);
    ctx.save();
    ctx.translate(b.x, b.y - (hop || 0)); ctx.scale(b.u, b.u);
    ctx.beginPath(); ctx.roundRect(1, 1, 98, 98, 3.5); ctx.clip();
    tegnBaggrund(ctx, univers.id);
    tegnFigur(ctx, figur, pyntAlfa);
    ctx.restore();
  }

  function tegnBrik(b, br, nr, x, y, loeftet) {
    var bb = brikBilleder[nr];
    if (!bb) return;
    var px = b.x + (x - bb.m) * b.u, py = b.y + (y - bb.m) * b.u;
    var bred = (pusle.b + 2 * bb.m) * b.u, hoej = (pusle.h + 2 * bb.m) * b.u;
    if (!br.paa) { ctx.shadowColor = 'rgba(18,38,31,0.35)'; ctx.shadowBlur = loeftet ? 18 : 6; ctx.shadowOffsetY = loeftet ? 10 : 3; }
    ctx.drawImage(bb.billede, px, py, bred, hoej);
    ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
  }

  function tegnPusle(b, andel) {
    // Braettet med et svagt billede (paa 3 stjerner kun gitteret)
    tegnPapir(b);
    ctx.save();
    ctx.translate(b.x, b.y); ctx.scale(b.u, b.u);
    if (SKYGGE[svaerhed] > 0 && billede) { ctx.globalAlpha = SKYGGE[svaerhed]; ctx.drawImage(billede, 1, 1, 98, 98); ctx.globalAlpha = 1; }
    ctx.strokeStyle = 'rgba(18,38,31,0.18)'; ctx.lineWidth = 0.6; ctx.setLineDash([2, 2]);
    for (var k = 1; k < pusle.kol; k++) { ctx.beginPath(); ctx.moveTo(k * pusle.b, 2); ctx.lineTo(k * pusle.b, 98); ctx.stroke(); }
    for (var r = 1; r < pusle.raek; r++) { ctx.beginPath(); ctx.moveTo(2, r * pusle.h); ctx.lineTo(98, r * pusle.h); ctx.stroke(); }
    ctx.restore();
    pusle.raekkefoelge.forEach(function (br) {
      var nr = pusle.brikker.indexOf(br), h = Pusle.hjem(pusle, br);
      var e = andel * andel * (3 - 2 * andel);
      tegnBrik(b, br, nr, h[0] + (br.x - h[0]) * e, h[1] + (br.y - h[1]) * e, br.holdtAf !== null);
    });
    tegnFremskridt();
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnRum();
    if (!figur || tilstand === 'menu' || tilstand === 'slut') return;
    var b = braet();
    if (tilstand === 'tegn') tegnTegning(b);
    else if (tilstand === 'farv') { tegnHeltBillede(b, Math.min(1, (tid - t0) / 0.6), Math.abs(Math.sin((tid - t0) * 7)) * 8 * Math.max(0, 1 - (tid - t0))); tegnFremskridt(); }
    else if (tilstand === 'split') tegnPusle(b, Math.min(1, (tid - t0) / 0.9));
    else if (tilstand === 'pusl') tegnPusle(b, 1);
    else if (tilstand === 'jubel') { tegnHeltBillede(b, 1, Math.abs(Math.sin((tid - t0) * 6)) * 14 * Math.max(0, 1 - (tid - t0) / 1.6)); tegnFremskridt(); }
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv); ctx.fillStyle = p.farve;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function opdater(dt) {
    if (tilstand === 'farv' && tid - t0 > 1.9) startPusle();
    else if (tilstand === 'split' && tid - t0 > 0.95) tilstand = 'pusl';
    else if (tilstand === 'jubel' && tid - t0 > 2.4) naesteFigur();
    opdaterPartikler(dt);
  }

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    opdater(dt);
    tegn();
    if (tilstand === 'slut') tegnSlut();
    requestAnimationFrame(løkke);
  }

  /* ---------- menu og slut ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; slutCanvas = null; }

  function visMenu() {
    tilstand = 'menu'; figur = null; univers = null;
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
    var universer = Figurer.UNIVERSER.map(function (u, i) {
      return '<button class="bane" data-handling="univers" data-n="' + i + '"><canvas width="200" height="200" data-univers="' + i + '" style="position:static;display:block;width:100%;aspect-ratio:1;border-radius:10px"></canvas><span>' + u.navn + '</span></button>';
    }).join('');
    visOverlay(
      '<div class="kort">' +
      '<h2>Tegn og pusl</h2>' +
      '<p class="hjaelp">Tegn figuren med fingeren. Så bliver den til et puslespil.</p>' +
      '<div class="baner">' + universer + '</div>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    Array.prototype.forEach.call(overlay.querySelectorAll('canvas[data-univers]'), function (l) {
      var u = Figurer.UNIVERSER[parseInt(l.dataset.univers, 10)], c = l.getContext('2d');
      c.scale(2, 2); tegnBaggrund(c, u.id); tegnFigur(c, u.figurer[0], 1);
    });
  }

  function afslut() {
    tilstand = 'slut'; figur = null;
    melodi([523, 659, 784, 1047, 1319], 120);
    visOverlay(
      '<div class="kort">' +
      '<h2>' + univers.navn + ' er færdig!</h2>' +
      '<canvas class="eksempel" width="720" height="200" style="position:static;display:block;width:100%;max-width:360px;aspect-ratio:3.6;align-self:center;border-radius:12px"></canvas>' +
      Menu.slutRaekke('igen', null) +
      '</div>'
    );
    slutCanvas = overlay.querySelector('canvas.eksempel');
  }

  /** Slutbilledet: alle fire figurer hopper paa raekke i deres univers. */
  function tegnSlut() {
    if (!slutCanvas || !slutCanvas.isConnected) return;
    var c = slutCanvas.getContext('2d'), w = slutCanvas.width, h = slutCanvas.height;
    c.setTransform(1, 0, 0, 1, 0, 0); c.clearRect(0, 0, w, h);
    c.save(); c.scale(w / 100, h / 100); tegnBaggrund(c, univers.id); c.restore();
    lavet.forEach(function (f, i) {
      var str = h * 0.8, x = w / 2 + (i - (lavet.length - 1) / 2) * (w / lavet.length) - str / 2;
      c.save(); c.translate(x, h * 0.12 - Math.abs(Math.sin(tid * 4 + i * 0.9)) * h * 0.08); c.scale(str / 100, str / 100);
      tegnFigur(c, f, 1); c.restore();
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'svaerhed') { svaerhed = parseInt(knap.dataset.n, 10); melodi([520, 660, 780].slice(0, svaerhed + 1), 70); visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (lydTil) tone(660, 0.12); visMenu(); }
    else if (h === 'univers') { var u = Figurer.UNIVERSER[parseInt(knap.dataset.n, 10)]; skjulOverlay(); startUnivers(u); }
    else if (h === 'igen') { var samme = univers; skjulOverlay(); startUnivers(samme); }
    else if (h === 'menu') visMenu();
  });

  lærred.addEventListener('pointerdown', function (e) { e.preventDefault(); try { lærred.setPointerCapture(e.pointerId); } catch (fejl) { /* ikke alle browsere */ } ned(e); }, { passive: false });
  lærred.addEventListener('pointermove', function (e) { e.preventDefault(); flyt(e); }, { passive: false });
  window.addEventListener('pointerup', op);
  window.addEventListener('pointercancel', op);
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    var b = braet();
    function px(p) { return { x: Math.round(b.x + p[0] * b.u), y: Math.round(b.y + p[1] * b.u) }; }
    return {
      tilstand: tilstand, svaerhed: svaerhed, univers: univers ? univers.id : null, figur: figur ? figur.id : null, lavet: lavet.length,
      streg: spor && !spor.faerdig ? spor.streger[spor.aktiv].slice(spor.indeks).filter(function (p, i) { return i % 3 === 0; }).concat([spor.streger[spor.aktiv][spor.streger[spor.aktiv].length - 1]]).map(px) : [],
      brikker: pusle ? pusle.raekkefoelge.slice().reverse().filter(function (br) { return !br.paa; }).map(function (br) {
        var h = Pusle.hjem(pusle, br);
        return { fra: px([br.x + pusle.b / 2, br.y + pusle.h / 2]), til: px([h[0] + pusle.b / 2, h[1] + pusle.h / 2]) };
      }) : []
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
