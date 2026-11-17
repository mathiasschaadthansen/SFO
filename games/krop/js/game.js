/**
 * Kropshuset: skaermen, lyden og stemmen. Reglerne ligger i krop.js.
 *
 * Robotten Rasmus staar til hoejre og vil laere om menneskekroppen. Emil eller
 * Ella staar midt paa gulvet (med to spillere begge to). Tre lege:
 *   peg      "Hvor er din albue?" Peg paa din egen, og tryk saa paa Emils.
 *   roentgen Flyt fingeren hen over kroppen; under fingeren ser man ind i den,
 *            som med Rasmus' roentgenoeje. Find hjertet, hjernen, maven ...
 *   sanser   "Fuglen synger. Hvad bruger du?" Tryk paa oeret.
 * Ingen tid, ingen point, intet gemmes. Et forkert tryk siger, hvad man ramte.
 * Mangler et klip i lyd/, siger enhedens egen stemme det (js/stemme.js), og en
 * vagt sender spillet videre, hvis intet kan hoeres.
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

  var K = window.Krop;
  var laerred = document.getElementById('spil');
  var ctx = laerred.getContext('2d');
  var overlay = document.getElementById('overlay');
  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a', GROEN = '#93bc63', BLAA = '#5f9fc9';

  var tilstand = 'menu', leg = 'peg', svaerhed = 0, spillere = 1, lydTil = true;
  var tid = 0, sidsteTid = 0, omgang = 0;
  var runde = [], ri = 0, laast = true, fejl = 0;
  var figurer = ['emil'];          // hvem der staar paa gulvet
  var klar = {};                    // peg: hvem der har trykket rigtigt
  var ringe = [];                   // korte ringe, der viser et tryk: {f, x, y, r, farve, t}
  var linse = null;                 // roentgen: {x, y} paa skaermen, mens fingeren er nede
  var fundneOrganer = [];
  var valgte = [], ryst = {};       // sanser

  /* ---------- billeder ---------- */
  function billede(sti) { var i = new Image(); i.src = sti; return i; }
  function erKlar(i) { return i && i.complete && i.naturalWidth > 0; }
  var BILLEDER = { emil: billede('billeder/emil.png'), ella: billede('billeder/ella.png'), rasmus: billede('../bogstaver/billeder/robot.png') };
  var KORT = {};
  Object.keys(K.SANSER).forEach(function (s) { KORT[s] = billede(K.SANSER[s].kort); });
  var TINGBILLEDER = {};
  K.TING.concat(K.TING_TO).forEach(function (t) { if (!TINGBILLEDER[t.ting]) TINGBILLEDER[t.ting] = billede('../bogstaver/billeder/' + t.ting + '.png'); });
  // Figurerne som blaa silhuetter til roentgenoejet, lavet én gang
  var SILHUET = {};
  function silhuet(f) {
    if (SILHUET[f] || !erKlar(BILLEDER[f])) return SILHUET[f];
    var i = BILLEDER[f], c = document.createElement('canvas');
    c.width = i.naturalWidth; c.height = i.naturalHeight;
    var g = c.getContext('2d'); g.drawImage(i, 0, 0);
    g.globalCompositeOperation = 'source-in'; g.fillStyle = '#7fb0d6'; g.fillRect(0, 0, c.width, c.height);
    return (SILHUET[f] = c);
  }

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
  var LYDE = {
    klik: function () { tone(660, 0.05, 0.04); },
    rigtig: function () { [660, 880, 1100].forEach(function (f, i) { tone(f, 0.2, 0.08, i * 0.09); }); },
    nej: function () { tone(262, 0.12, 0.05); tone(247, 0.12, 0.04, 0.09); },
    bip: function () { tone(1320, 0.06, 0.04, 0, 'square'); tone(990, 0.08, 0.035, 0.07, 'square'); },
    faerdig: function () { [523, 659, 784, 1047, 1319].forEach(function (f, i) { tone(f, 0.22, 0.09, i * 0.11); }); }
  };
  document.addEventListener('pointerdown', startLyd, true);
  var stemme = Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.9 });
  var taleGen = 0;
  function kanTale() { return lydTil && !!lyd && (stemme.antalKlip() > 0 || !!stemme.stemme()); }
  /** Sig flere replikker i traek. En vagt sender videre, hvis intet kan hoeres, saa spillet aldrig gaar i staa. */
  function sig(trin, faerdig) {
    if (!Array.isArray(trin)) trin = [trin];
    trin = trin.filter(Boolean);
    var g = ++taleGen, i = 0;
    stemme.tie();
    (function naeste() {
      if (g !== taleGen) return;
      if (i >= trin.length) { if (faerdig) faerdig(); return; }
      var t = trin[i++], sket = false;
      var videre = function () { if (sket) return; sket = true; clearTimeout(vagt); naeste(); };
      var vagt = setTimeout(videre, kanTale() ? 2500 + t.length * 110 : 500 + t.length * 45);
      stemme.sig(t, videre);
    })();
  }
  function tie() { taleGen++; stemme.tie(); }
  /** Et tidsskridt, der glemmes, hvis man er gaaet til menuen eller er startet forfra. */
  function senere(fn, ms) { var o = omgang; setTimeout(function () { if (o === omgang && tilstand === 'spil') fn(); }, ms); }

  /* ---------- skaermen ---------- */
  var L = null;
  function tilpas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    laerred.width = Math.floor(window.innerWidth * dpr); laerred.height = Math.floor(window.innerHeight * dpr);
    laerred.style.width = window.innerWidth + 'px'; laerred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = null;
  }
  /**
   * Gulvet, Rasmus til hoejre og figurerne. Hver figur har en kasse paa skaermen
   * {x, y, b, h, k}: k er skalaen fra billedets pixels. Venstre kant er fri til knapperne.
   */
  function layout() {
    if (L) return L;
    var W = window.innerWidth, H = window.innerHeight, VEN = 76, gulv = H * 0.86;
    var rasH = Math.min(H * 0.42, W * 0.26), ras = { x: W - rasH * 0.55, y: gulv + rasH * 0.04, h: rasH };
    var plads = ras.x - rasH * 0.55 - VEN, kasser = {};
    var hoejde = leg === 'sanser' ? H * 0.5 : leg === 'dag' ? H * 0.55 : H * (figurer.length > 1 ? 0.82 : 0.86);
    figurer.forEach(function (f, i) {
      var F = K.FIGURER[f], k = hoejde / F.h, b = F.b * k;
      var cx = VEN + plads * (figurer.length > 1 ? (i === 0 ? 0.3 : 0.72) : 0.5);
      kasser[f] = { x: cx - b / 2, y: gulv + H * 0.06 - hoejde, b: b, h: hoejde, k: k };
    });
    L = { W: W, H: H, VEN: VEN, gulv: gulv, ras: ras, kasser: kasser, hoejttaler: { x: W - 46, y: 46, r: 30 } };
    if (leg === 'dag') {
      var db = Math.min(140, (W - VEN - rasH - 60) / 6 - 14), n6 = runde[ri] ? runde[ri].kort.length : 3, midtx = VEN + (W - VEN - rasH * 0.9) / 2;
      L.vindue = { x: VEN + 40, y: H * 0.07, b: Math.min(220, W * 0.2), h: Math.min(160, H * 0.2) };
      L.kort = [];
      for (var d6 = 0; d6 < n6; d6++) L.kort.push({ x: midtx + (d6 - (n6 - 1) / 2) * (db + 14), y: H * 0.8, s: db });
      var kf = kasser[figurer[0]]; if (kf) { kf.x = midtx - kf.b / 2; kf.y = H * 0.66 - kf.h; }
      var bx = VEN + 30, bb = W - VEN - rasH - 70, by = H * 0.36, bh = H * 0.5;
      L.vask = { bord: { x: bx, y: by, b: bb, h: bh },
        hane: { x: bx + bb * 0.5, y: by + bh * 0.12, b: 140, h: 120 }, saebe: { x: bx + bb * 0.13, y: by + bh * 0.62, b: 120, h: 120 },
        haender: { x: bx + bb * 0.5, y: by + bh * 0.62, b: 280, h: 170 }, klaede: { x: bx + bb * 0.87, y: by + bh * 0.62, b: 130, h: 160 } };
    }
    if (leg === 'sanser') {
      var kb = Math.min(150, (W - VEN - rasH - 60) / 5 - 16);
      L.ting = { x: VEN + (W - VEN - rasH * 0.9) / 2, y: H * 0.33, s: Math.min(H * 0.36, 280) };
      L.kort = [];
      var n = runde[ri] ? runde[ri].kort.length : 5;
      for (var j = 0; j < n; j++) L.kort.push({ x: L.ting.x + (j - (n - 1) / 2) * (kb + 18), y: H * 0.8, s: kb });
    }
    return L;
  }
  function tilSkaerm(f, x, y) { var k = L.kasser[f]; return { x: k.x + x * k.k, y: k.y + y * k.k }; }
  function tilBillede(f, x, y) { var k = L.kasser[f]; return { x: (x - k.x) / k.k, y: (y - k.y) / k.k }; }
  function rr(x, y, b, h, r, fyld) { ctx.beginPath(); ctx.roundRect(x, y, b, h, r); ctx.fillStyle = fyld; ctx.fill(); }

  function tegnRum() {
    var W = L.W, H = L.H;
    var v = ctx.createLinearGradient(0, 0, 0, L.gulv);
    v.addColorStop(0, '#f6eee2'); v.addColorStop(1, '#efe3d0');
    ctx.fillStyle = v; ctx.fillRect(0, 0, W, L.gulv);
    // En maalestok paa vaeggen, som hos laegen
    var mx = L.VEN + 24, top = L.gulv - H * 0.7;
    rr(mx, top, 26, L.gulv - top, 8, '#e5d3ae');
    ctx.strokeStyle = '#b18a56'; ctx.lineWidth = 2;
    for (var y = L.gulv - 10, n = 0; y > top + 8; y -= H * 0.035, n++) { ctx.beginPath(); ctx.moveTo(mx + 4, y); ctx.lineTo(mx + (n % 2 ? 13 : 20), y); ctx.stroke(); }
    // Gulvet af trae
    var g = ctx.createLinearGradient(0, L.gulv, 0, H);
    g.addColorStop(0, '#d9ba8a'); g.addColorStop(1, '#b18a56');
    ctx.fillStyle = g; ctx.fillRect(0, L.gulv, W, H - L.gulv);
    ctx.strokeStyle = 'rgba(138,102,61,.25)'; ctx.lineWidth = 2;
    for (var x = -40; x < W; x += 120) { ctx.beginPath(); ctx.moveTo(x, L.gulv); ctx.lineTo(x + 50, H); ctx.stroke(); }
  }
  function tegnRasmus() {
    var r = L.ras, i = BILLEDER.rasmus, hop = laast ? 0 : Math.sin(tid * 3) * 3;
    ctx.save(); ctx.fillStyle = 'rgba(94,74,58,.16)'; ctx.beginPath(); ctx.ellipse(r.x, r.y, r.h * 0.32, r.h * 0.05, 0, 0, 7); ctx.fill(); ctx.restore();
    if (erKlar(i)) { var k = r.h / i.naturalHeight; ctx.drawImage(i, r.x - i.naturalWidth * k / 2, r.y - r.h + hop, i.naturalWidth * k, r.h); }
  }
  function tegnFigur(f, alfa) {
    var k = L.kasser[f], i = BILLEDER[f];
    ctx.save(); ctx.fillStyle = 'rgba(94,74,58,.14)'; ctx.beginPath(); ctx.ellipse(k.x + k.b / 2, k.y + k.h * 0.985, k.b * 0.42, k.h * 0.025, 0, 0, 7); ctx.fill(); ctx.restore();
    if (!erKlar(i)) return;
    ctx.save(); if (alfa != null) ctx.globalAlpha = alfa;
    ctx.drawImage(i, k.x, k.y, k.b, k.h); ctx.restore();
  }
  function tegnRinge() {
    ringe = ringe.filter(function (g) { return tid - g.t < 1.2; });
    ringe.forEach(function (g) {
      var a = 1 - (tid - g.t) / 1.2, p = tilSkaerm(g.f, g.x, g.y), r = g.r * L.kasser[g.f].k;
      ctx.save(); ctx.globalAlpha = a; ctx.strokeStyle = g.farve; ctx.lineWidth = 5;
      ctx.beginPath(); ctx.arc(p.x, p.y, r * (1 + (1 - a) * 0.3), 0, 7); ctx.stroke(); ctx.restore();
    });
  }
  function hoejttaler() {
    var k = L.hoejttaler, x = k.x, y = k.y, r = k.r;
    ctx.save(); ctx.fillStyle = PAPIR; ctx.shadowColor = 'rgba(107,85,68,.25)'; ctx.shadowBlur = 10; ctx.shadowOffsetY = 4;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.shadowColor = 'transparent';
    ctx.fillStyle = KANT; ctx.beginPath();
    ctx.moveTo(x - r * 0.45, y - r * 0.16); ctx.lineTo(x - r * 0.22, y - r * 0.16); ctx.lineTo(x + r * 0.06, y - r * 0.4); ctx.lineTo(x + r * 0.06, y + r * 0.4);
    ctx.lineTo(x - r * 0.22, y + r * 0.16); ctx.lineTo(x - r * 0.45, y + r * 0.16); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = Math.max(2, r * 0.09); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(x + r * 0.1, y, r * 0.26, -0.8, 0.8); ctx.stroke();
    ctx.beginPath(); ctx.arc(x + r * 0.1, y, r * 0.46, -0.8, 0.8); ctx.stroke();
    ctx.restore();
  }
  /** Omgangen som cirkler foroven: fyldt for hvert spoergsmaal, der er klaret. */
  function cirkler() {
    var n = runde.length, r = 9, x0 = L.W / 2 - (n - 1) * 15;
    for (var i = 0; i < n; i++) {
      ctx.beginPath(); ctx.arc(x0 + i * 30, 30, r, 0, 7);
      ctx.fillStyle = i < ri ? GROEN : 'rgba(248,241,230,.9)'; ctx.fill();
      ctx.strokeStyle = 'rgba(94,74,58,.35)'; ctx.lineWidth = 2; ctx.stroke();
    }
  }
  function iHoejttaler(x, y) { var k = L.hoejttaler; return Math.hypot(x - k.x, y - k.y) < k.r + 12; }

  /* ================= Hvor er din albue? ================= */

  function startPeg() {
    runde = K.pegRunde(svaerhed); ri = 0;
    figurer = spillere === 2 ? ['emil', 'ella'] : [Math.random() < 0.5 ? 'emil' : 'ella'];
    L = null; laast = true;
    sig([K.TEKST.pegHej, K.TEKST.pegEgen], function () { nytPeg(); });
  }
  function spoergPeg() {
    var d = runde[ri];
    sig([K.hvorEr(d), K.pegPaa(d)], function () { senere(function () { sig(K.trykPaa(d, figurer)); }, 1800); });
  }
  function nytPeg() { klar = {}; fejl = 0; laast = false; spoergPeg(); }
  function trykPeg(x, y) {
    if (iHoejttaler(x, y)) { LYDE.klik(); spoergPeg(); return; }
    var d = runde[ri];
    figurer.forEach(function (f) {
      var k = L.kasser[f];
      if (x < k.x - 20 || x > k.x + k.b + 20 || y < k.y - 20 || y > k.y + k.h + 10 || klar[f]) return;
      var p = tilBillede(f, x, y);
      if (K.rigtigtTryk(f, d, p.x, p.y)) {
        klar[f] = true;
        K.PLADS[f][d].forEach(function (c) { ringe.push({ f: f, x: c[0], y: c[1], r: Math.max(c[2], 20), farve: GROEN, t: tid }); });
        if (figurer.every(function (g) { return klar[g]; })) {
          laast = true; LYDE.rigtig();
          sig([K.derEr(d), K.DELE[d].robot], function () { ri++; if (ri >= runde.length) afslut(); else senere(nytPeg, 300); });
        } else LYDE.klik();
        return;
      }
      var r = K.ramte(f, p.x, p.y);
      LYDE.nej(); fejl++;
      ringe.push({ f: f, x: p.x, y: p.y, r: 22, farve: GUL, t: tid });
      sig(r ? [K.detEr(r), K.TEKST.igen] : K.TEKST.igen);
    });
  }
  function tegnPeg() {
    figurer.forEach(function (f) { tegnFigur(f); });
    // Efter to forkerte tryk lyser det rigtige sted blidt, saa ingen sidder fast
    if (!laast && fejl >= 2 && runde[ri]) {
      figurer.forEach(function (f) {
        if (klar[f]) return;
        K.PLADS[f][runde[ri]].forEach(function (c) {
          var p = tilSkaerm(f, c[0], c[1]), r = Math.max(c[2], 18) * L.kasser[f].k;
          ctx.save(); ctx.globalAlpha = 0.35 + Math.sin(tid * 5) * 0.2; ctx.fillStyle = GUL;
          ctx.beginPath(); ctx.arc(p.x, p.y, r, 0, 7); ctx.fill(); ctx.restore();
        });
      });
    }
    tegnRinge();
  }

  /* ================= Roentgenoejet ================= */

  function startRoentgen() {
    runde = K.roentgenRunde(svaerhed); ri = 0; fundneOrganer = [];
    figurer = [Math.random() < 0.5 ? 'emil' : 'ella'];
    L = null; laast = true; linse = null;
    sig([K.TEKST.roentgenHej, K.TEKST.roentgenFinger], function () { nytOrgan(); });
  }
  function nytOrgan() { fejl = 0; laast = false; sig(K.find(runde[ri])); }
  function slipRoentgen(x, y) {
    if (laast || !runde[ri]) return;
    var f = figurer[0], p = tilBillede(f, x, y), maal = runde[ri], o = K.paaOrgan(f, maal, p.x, p.y) ? maal : K.organ(f, p.x, p.y);
    if (o === maal) {
      laast = true; LYDE.rigtig(); fundneOrganer.push(o);
      K.INDRE[f][o].forEach(function (c) { ringe.push({ f: f, x: c[0], y: c[1], r: c[2], farve: GROEN, t: tid }); });
      sig(K.fundet(o), function () { ri++; if (ri >= runde.length) sig(K.TEKST.roentgenSlut, afslut); else senere(nytOrgan, 300); });
    } else if (o) { LYDE.nej(); sig(['Det er ' + K.ORGANER[o].bestemt + '.', K.find(maal)]); }
  }
  /** Det, man ser gennem roentgenoejet: knoglerne og organerne, tegnet ud fra pladserne. */
  function tegnIndre(f, kunFundne) {
    var P = K.PLADS[f], I = K.INDRE[f], k = L.kasser[f].k;
    function pkt(a) { return tilSkaerm(f, a[0], a[1]); }
    function midt(d) { var c = P[d]; return c.length > 1 ? c : [c[0]]; }
    function vis(o) { return !kunFundne || fundneOrganer.indexOf(o) >= 0; }
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (!kunFundne) {
      // Knoglerne i armene og benene
      ctx.strokeStyle = 'rgba(248,246,240,.9)'; ctx.lineWidth = 9 * k;
      [['skulder', 'albue', 'haandled'], ['hofte', 'knae', 'ankel']].forEach(function (kaede) {
        for (var s = 0; s < 2; s++) {
          ctx.beginPath();
          kaede.forEach(function (d, j) { var c = midt(d)[Math.min(s, midt(d).length - 1)], q = pkt(c); if (j) ctx.lineTo(q.x, q.y); else ctx.moveTo(q.x, q.y); });
          ctx.stroke();
        }
      });
      // Baekkenet
      var h0 = pkt(P.hofte[0]), h1 = pkt(P.hofte[1]);
      ctx.lineWidth = 7 * k; ctx.beginPath(); ctx.ellipse((h0.x + h1.x) / 2, h0.y - 6 * k, Math.abs(h1.x - h0.x) * 0.42, 26 * k, 0, 0, Math.PI); ctx.stroke();
    }
    I.rygrad.forEach(function (c, j) {
      if (!vis('rygrad') && kunFundne) return;
      var q = pkt(c); ctx.fillStyle = kunFundne ? 'rgba(248,246,240,.7)' : '#f8f6f0';
      for (var n = 0; n < 4; n++) { ctx.beginPath(); ctx.roundRect(q.x - 9 * k, q.y - 30 * k + n * 17 * k, 18 * k, 12 * k, 4 * k); ctx.fill(); }
    });
    if (vis('kranie')) { var kr = I.kranie[0], q = pkt(kr); ctx.strokeStyle = 'rgba(248,246,240,.95)'; ctx.lineWidth = 8 * k; ctx.beginPath(); ctx.ellipse(q.x, q.y, kr[2] * 0.82 * k, kr[2] * k, 0, 0, 7); ctx.stroke(); }
    if (vis('ribben')) {
      var rb = I.ribben[0], c = pkt(rb); ctx.strokeStyle = 'rgba(248,246,240,.9)'; ctx.lineWidth = 6 * k;
      for (var n2 = 0; n2 < 5; n2++) { var yy = c.y - rb[2] * 0.7 * k + n2 * rb[2] * 0.32 * k; ctx.beginPath(); ctx.ellipse(c.x, yy, rb[2] * (0.75 + n2 * 0.06) * k, 14 * k, 0, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    }
    if (vis('laarben')) I.laarben.forEach(function (c) { var q = pkt(c); ctx.strokeStyle = '#fffdf6'; ctx.lineWidth = 14 * k; ctx.beginPath(); ctx.moveTo(q.x, q.y - c[2] * 1.6 * k); ctx.lineTo(q.x, q.y + c[2] * 1.6 * k); ctx.stroke(); });
    if (vis('lunger')) I.lunger.forEach(function (c) { var q = pkt(c); ctx.fillStyle = 'rgba(232,150,150,.85)'; ctx.beginPath(); ctx.ellipse(q.x, q.y, c[2] * 0.62 * k, c[2] * k, 0, 0, 7); ctx.fill(); });
    if (vis('hjerne')) { var hj = I.hjerne[0], q2 = pkt(hj); ctx.fillStyle = 'rgba(240,170,185,.95)'; ctx.beginPath(); ctx.ellipse(q2.x, q2.y, hj[2] * k, hj[2] * 0.72 * k, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(190,110,130,.9)'; ctx.lineWidth = 3 * k; for (var w = -2; w <= 2; w++) { ctx.beginPath(); ctx.moveTo(q2.x - hj[2] * 0.7 * k, q2.y + w * 12 * k); ctx.quadraticCurveTo(q2.x, q2.y + w * 12 * k - 10 * k, q2.x + hj[2] * 0.7 * k, q2.y + w * 12 * k); ctx.stroke(); } }
    if (vis('mavesaek')) { var mv = I.mavesaek[0], q3 = pkt(mv); ctx.fillStyle = 'rgba(240,196,106,.95)'; ctx.beginPath(); ctx.ellipse(q3.x, q3.y, mv[2] * 1.15 * k, mv[2] * 0.75 * k, -0.4, 0, 7); ctx.fill(); }
    if (vis('tarme')) { var ta = I.tarme[0], q4 = pkt(ta); ctx.strokeStyle = 'rgba(224,138,82,.95)'; ctx.lineWidth = 9 * k; ctx.beginPath();
      for (var a = 0; a < 26; a++) { var rr2 = ta[2] * k * (0.85 - a * 0.025), v2 = a * 0.9; var xx = q4.x + Math.cos(v2) * rr2, y2 = q4.y + Math.sin(v2) * rr2 * 0.7; if (a) ctx.lineTo(xx, y2); else ctx.moveTo(xx, y2); } ctx.stroke(); }
    if (vis('hjerte')) { var he = I.hjerte[0], q5 = pkt(he), s = he[2] * k * (1 + Math.sin(tid * 7) * 0.06);
      ctx.fillStyle = '#d95f45'; ctx.beginPath(); ctx.moveTo(q5.x, q5.y + s * 0.9);
      ctx.bezierCurveTo(q5.x - s * 1.4, q5.y - s * 0.1, q5.x - s * 0.6, q5.y - s * 1.1, q5.x, q5.y - s * 0.35);
      ctx.bezierCurveTo(q5.x + s * 0.6, q5.y - s * 1.1, q5.x + s * 1.4, q5.y - s * 0.1, q5.x, q5.y + s * 0.9); ctx.fill(); }
    ctx.restore();
  }
  function tegnRoentgen() {
    var f = figurer[0], k = L.kasser[f];
    tegnFigur(f);
    // De fundne organer bliver staaende, svagt, oven paa kroppen
    if (fundneOrganer.length) { ctx.save(); ctx.globalAlpha = 0.55; tegnIndre(f, true); ctx.restore(); }
    // Straalen fra Rasmus' oeje
    var oeje = { x: L.ras.x - L.ras.h * 0.09, y: L.ras.y - L.ras.h * 0.78 };
    var mod = linse || { x: k.x + k.b / 2, y: k.y + k.h * 0.45 };
    if (linse) {
      ctx.save(); ctx.globalAlpha = 0.25; ctx.fillStyle = '#aed3e4'; ctx.beginPath(); ctx.moveTo(oeje.x, oeje.y);
      ctx.lineTo(mod.x, mod.y - 10); ctx.lineTo(mod.x, mod.y + 10); ctx.closePath(); ctx.fill(); ctx.restore();
      var R = Math.min(L.H * 0.17, 140);
      ctx.save(); ctx.beginPath(); ctx.arc(linse.x, linse.y, R, 0, 7); ctx.clip();
      ctx.fillStyle = '#25445e'; ctx.fillRect(linse.x - R, linse.y - R, R * 2, R * 2);
      var sil = silhuet(f); if (sil) { ctx.globalAlpha = 0.45; ctx.drawImage(sil, k.x, k.y, k.b, k.h); ctx.globalAlpha = 1; }
      tegnIndre(f, false);
      ctx.restore();
      ctx.save(); ctx.strokeStyle = '#5f9fc9'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(linse.x, linse.y, R, 0, 7); ctx.stroke();
      ctx.strokeStyle = 'rgba(248,241,230,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(linse.x, linse.y, R - 6, 0, 7); ctx.stroke(); ctx.restore();
    } else if (!laast) {
      // En lille haand, der viser, at man skal flytte fingeren hen over kroppen
      var px = k.x + k.b * (0.5 + Math.sin(tid * 1.5) * 0.25), py = k.y + k.h * 0.45;
      ctx.save(); ctx.globalAlpha = 0.6; ctx.strokeStyle = '#5f9fc9'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(px, py, 34, 0, 7); ctx.stroke(); ctx.restore();
    }
    tegnRinge();
  }

  /* ================= Sanserne ================= */

  function startSanser() {
    runde = K.sanseRunde(svaerhed); ri = 0;
    figurer = []; L = null; laast = true;
    sig(K.TEKST.sanserHej, function () { nySans(); });
  }
  function spoergSans() { var q = runde[ri]; sig([q.saetning, q.to ? K.TEKST.hvilkeTo : K.TEKST.hvad]); }
  function nySans() { valgte = []; ryst = {}; L = null; laast = false; spoergSans(); }
  function trykSans(x, y) {
    if (iHoejttaler(x, y)) { LYDE.klik(); spoergSans(); return; }
    var q = runde[ri], tingK = L.ting;
    if (Math.abs(x - tingK.x) < tingK.s / 2 && Math.abs(y - tingK.y) < tingK.s / 2) { LYDE.klik(); spoergSans(); return; }
    L.kort.forEach(function (c, i) {
      if (Math.abs(x - c.x) > c.s / 2 || Math.abs(y - c.y) > c.s / 2) return;
      var s = q.kort[i];
      if (q.to) {
        var j = valgte.indexOf(s);
        if (j >= 0) { valgte.splice(j, 1); LYDE.klik(); return; }
        valgte.push(s); LYDE.klik();
        if (valgte.length < 2) {
          if (q.sanser.indexOf(s) >= 0) sig([K.SANSER[s].ja, K.TEKST.enTil]);
          else { LYDE.nej(); ryst[s] = tid; valgte = []; sig([K.TEKST.igen, q.saetning]); }
          return;
        }
      } else valgte = [s];
      if (K.sanseSvar(q, valgte)) {
        laast = true; LYDE.rigtig();
        var siges = q.to ? [K.SANSER[valgte[1]].ja] : [K.SANSER[s].ja, K.SANSER[s].robot];
        sig(siges, function () { ri++; if (ri >= runde.length) afslut(); else senere(nySans, 400); });
      } else {
        LYDE.nej(); valgte.forEach(function (v) { if (q.sanser.indexOf(v) < 0) ryst[v] = tid; });
        valgte = valgte.filter(function (v) { return q.sanser.indexOf(v) >= 0; });
        sig([K.TEKST.igen, q.saetning]);
      }
    });
  }
  function tegnBillede(i, x, y, s) {
    if (!erKlar(i)) return;
    var k = s / Math.max(i.naturalWidth || i.width, i.naturalHeight || i.height), b = (i.naturalWidth || i.width) * k, h = (i.naturalHeight || i.height) * k;
    ctx.drawImage(i, x - b / 2, y - h / 2, b, h);
  }
  function tegnSanser() {
    var q = runde[ri]; if (!q) return;
    var t = L.ting;
    ctx.save(); ctx.shadowColor = 'rgba(107,85,68,.22)'; ctx.shadowBlur = 16; ctx.shadowOffsetY = 6;
    rr(t.x - t.s / 2 - 16, t.y - t.s / 2 - 16, t.s + 32, t.s + 32, 30, PAPIR); ctx.restore();
    tegnBillede(TINGBILLEDER[q.ting], t.x, t.y + Math.sin(tid * 2) * 3, t.s * 0.9);
    L.kort.forEach(function (c, i) {
      var s = q.kort[i], valgt = valgte.indexOf(s) >= 0, dx = ryst[s] && tid - ryst[s] < 0.5 ? Math.sin((tid - ryst[s]) * 40) * 8 : 0;
      ctx.save(); ctx.shadowColor = 'rgba(107,85,68,.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
      rr(c.x - c.s / 2 + dx, c.y - c.s / 2, c.s, c.s, 22, valgt ? '#aed3e4' : PAPIR); ctx.restore();
      tegnBillede(KORT[s], c.x + dx, c.y, c.s * 0.72);
    });
  }

  /* ================= Madens rejse ================= */

  var vej = null, madPos = 0, madStr = 1, tyg = 0, vinkel = 0, sidsteV = null, traekFinger = null, partikler = [], udT = 0, idle = 0;
  var MADBILLEDER = {};
  K.MAD.forEach(function (m) { MADBILLEDER[m.ting] = billede('../bogstaver/billeder/' + m.ting + '.png'); });
  function startMad() {
    var maden = K.madRunde(svaerhed); runde = [];
    maden.forEach(function (m) { K.STATIONER.forEach(function (s) { runde.push({ station: s, mad: m }); }); });
    if (svaerhed === 2) K.VEJ.forEach(function (v, i) { runde.push({ station: 'huske', i: i }); });
    ri = 0; figurer = [Math.random() < 0.5 ? 'emil' : 'ella']; L = null; laast = true; partikler = [];
    vej = K.madVej(figurer[0]);
    sig(K.MAD_TEKST.hej, function () { nyStation(); });
  }
  function nyStation() {
    var q = runde[ri], f = figurer[0]; idle = tid;
    if (q.station === 'tygge') { madPos = 0; madStr = 1; tyg = 0; laast = false; sig([K.spiser(f, q.mad), K.MAD_TEKST.tygge]); }
    else if (q.station === 'synke') { madPos = 0; laast = false; sig(K.MAD_TEKST.synke); }
    else if (q.station === 'mave') { vinkel = 0; sidsteV = null; laast = false; sig(K.MAD_TEKST.mave); }
    else if (q.station === 'tarme') { madPos = 0; laast = false; sig(K.MAD_TEKST.tarme); }
    else if (q.station === 'ud') {
      laast = true; udT = tid;
      var sidste = !runde[ri + 1] || runde[ri + 1].station !== 'tygge';
      sig(sidste ? [K.MAD_TEKST.ud, K.MAD_TEKST.robot] : K.MAD_TEKST.ud, naesteMad);
    } else { laast = false; sig(q.i === 0 ? K.MAD_TEKST.huske : K.MAD_TEKST.ogSaa); }
  }
  function naesteMad() { ri++; if (ri >= runde.length) afslut(); else senere(nyStation, 300); }
  function madSted() {
    var q = runde[ri]; if (!q) return null;
    var f = figurer[0];
    if (q.station === 'tygge') return tilSkaerm(f, vej.mund[0] + 40, vej.mund[1]);
    if (q.station === 'synke') { var a = vej.spiseroer[Math.min(madPos, vej.spiseroer.length - 1)]; return tilSkaerm(f, a[0], a[1]); }
    if (q.station === 'mave') return tilSkaerm(f, vej.mave[0], vej.mave[1]);
    if (q.station === 'tarme') { var b = vej.tarme[Math.min(madPos, vej.tarme.length - 1)]; return tilSkaerm(f, b[0], b[1]); }
    if (q.station === 'ud') { var e = vej.tarme[vej.tarme.length - 1], d = Math.min(1, (tid - udT) / 1.5); return tilSkaerm(f, e[0], e[1] + d * 120); }
    return null;
  }
  function trykMad(x, y, id) {
    var q = runde[ri], f = figurer[0]; if (!q || laast) return;
    if (iHoejttaler(x, y)) { LYDE.klik(); nyStation(); return; }
    idle = tid;
    if (q.station === 'tygge') {
      var m = tilSkaerm(f, vej.mund[0], vej.mund[1]), s = madSted();
      if (Math.hypot(x - m.x, y - m.y) < 70 || Math.hypot(x - s.x, y - s.y) < 70) {
        tyg++; madStr = 1 - tyg * 0.22; tone(180 + tyg * 40, 0.08, 0.08, 0, 'square');
        for (var n = 0; n < 5; n++) partikler.push({ x: s.x, y: s.y, vx: (Math.random() - 0.5) * 120, vy: -Math.random() * 80, t: tid, farve: '#e08a52' });
        if (tyg >= 3) { laast = true; LYDE.rigtig(); sig(K.MAD_TEKST.tygget, naesteMad); }
      }
    } else if (q.station === 'synke' || q.station === 'tarme') {
      var p = madSted(); if (Math.hypot(x - p.x, y - p.y) < 80) traekFinger = id;
    } else if (q.station === 'mave') { traekFinger = id; sidsteV = null; }
    else if (q.station === 'huske') {
      var b = tilBillede(f, x, y), sted = K.vejSted(f, b.x, b.y), v = K.VEJ[q.i];
      if (sted === v.sted) { laast = true; LYDE.rigtig(); var c = vej.steder[sted][0]; ringe.push({ f: f, x: c[0], y: c[1], r: Math.max(c[2], 22), farve: GROEN, t: tid }); sig(v.ja, naesteMad); }
      else { LYDE.nej(); sig(K.TEKST.igen); }
    }
  }
  function flytMad(x, y, id) {
    var q = runde[ri], f = figurer[0]; if (!q || laast || id !== traekFinger) return;
    idle = tid;
    if (q.station === 'synke' || q.station === 'tarme') {
      var liste = q.station === 'synke' ? vej.spiseroer : vej.tarme, bedst = -1, afst = 70;
      for (var i = madPos; i < Math.min(liste.length, madPos + 10); i++) { var s = tilSkaerm(f, liste[i][0], liste[i][1]), d = Math.hypot(x - s.x, y - s.y); if (d < afst) { afst = d; bedst = i; } }
      if (bedst > madPos) madPos = bedst;
      if (madPos >= liste.length - 1) {
        laast = true; traekFinger = null;
        if (q.station === 'synke') { tone(392, 0.12, 0.08); naesteMad(); }
        else {
          LYDE.rigtig();
          var mid = tilSkaerm(f, vej.tarm[0], vej.tarm[1]);
          ['haand', 'fod', 'hoved'].forEach(function (d) { K.PLADS[f][d].forEach(function (c) { var t = tilSkaerm(f, c[0], c[1]); for (var n = 0; n < 4; n++) partikler.push({ x: mid.x, y: mid.y, tx: t.x, ty: t.y, t: tid + n * 0.1, farve: GUL, stjerne: true }); }); });
          sig(K.MAD_TEKST.tarmeFaerdig, naesteMad);
        }
      }
    } else if (q.station === 'mave') {
      var m = tilSkaerm(f, vej.mave[0], vej.mave[1]), r = vej.mave[2] * L.kasser[f].k;
      if (Math.hypot(x - m.x, y - m.y) > r * 3) { sidsteV = null; return; }
      var v = Math.atan2(y - m.y, x - m.x);
      if (sidsteV !== null) { var dv = v - sidsteV; if (dv > Math.PI) dv -= 2 * Math.PI; if (dv < -Math.PI) dv += 2 * Math.PI; vinkel += Math.abs(dv); }
      sidsteV = v;
      if (vinkel > 4 * Math.PI) { laast = true; traekFinger = null; LYDE.rigtig(); sig(K.MAD_TEKST.maveFaerdig, naesteMad); }
    }
  }
  function slipMad(id) { if (id === traekFinger) { traekFinger = null; sidsteV = null; } }
  /** Fordoejelsen tegnet oven paa figuren: spiseroeret, maven og tarmene. */
  function tegnVej(f) {
    var k = L.kasser[f].k;
    function linje(liste, farve, b) {
      ctx.strokeStyle = farve; ctx.lineWidth = b * k; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.beginPath();
      liste.forEach(function (a, i) { var p = tilSkaerm(f, a[0], a[1]); if (i) ctx.lineTo(p.x, p.y); else ctx.moveTo(p.x, p.y); }); ctx.stroke();
    }
    ctx.save(); ctx.globalAlpha = 0.85;
    linje(vej.spiseroer, '#e9a7a0', 34); linje(vej.spiseroer, '#f6d3cd', 16);
    var mv = tilSkaerm(f, vej.mave[0], vej.mave[1]), r = vej.mave[2] * k;
    ctx.fillStyle = '#e9a7a0'; ctx.beginPath(); ctx.ellipse(mv.x, mv.y, r * 1.7, r * 1.15, -0.4, 0, 7); ctx.fill();
    ctx.fillStyle = '#f6d3cd'; ctx.beginPath(); ctx.ellipse(mv.x, mv.y, r * 1.4, r * 0.88, -0.4, 0, 7); ctx.fill();
    linje(vej.tarme.slice(1), '#e3a86f', 28); linje(vej.tarme.slice(1), '#f3d2a8', 13);
    ctx.restore();
  }
  function tegnMad() {
    var f = figurer[0], q = runde[ri];
    tegnFigur(f); tegnVej(f);
    if (q && q.station !== 'huske') {
      var p = madSted();
      // En stiplet pil foran maden viser vejen (altid med én stjerne, ellers naar man har ventet lidt)
      if (!laast && (q.station === 'synke' || q.station === 'tarme') && (svaerhed === 0 || tid - idle > 4)) {
        var liste = q.station === 'synke' ? vej.spiseroer : vej.tarme;
        ctx.save(); ctx.fillStyle = 'rgba(94,74,58,' + (0.35 + Math.sin(tid * 4) * 0.15) + ')';
        for (var i = madPos + 3; i < Math.min(liste.length, madPos + 18); i += 3) { var a = tilSkaerm(f, liste[i][0], liste[i][1]); ctx.beginPath(); ctx.arc(a.x, a.y, 4, 0, 7); ctx.fill(); }
        ctx.restore();
      }
      if (q.station === 'tygge') tegnBillede(MADBILLEDER[q.mad.ting], p.x, p.y, 90 * Math.max(0.35, madStr));
      else if (q.station === 'mave') {
        var r = 14 + Math.min(1, vinkel / (4 * Math.PI)) * 6;
        ctx.save(); ctx.fillStyle = '#e8c27a'; for (var n = 0; n < 5; n++) { var v = tid * 3 + n * 1.26 + vinkel; ctx.beginPath(); ctx.arc(p.x + Math.cos(v) * r, p.y + Math.sin(v) * r * 0.6, 9, 0, 7); ctx.fill(); } ctx.restore();
        if (!laast && vinkel < 0.5) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5f9fc9'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(p.x, p.y, 60, tid * 2, tid * 2 + 4.5); ctx.stroke(); ctx.restore(); }
      } else if (q.station === 'synke') tegnBillede(MADBILLEDER[q.mad.ting], p.x, p.y, 46);
      else { ctx.save(); ctx.fillStyle = '#d9a95f'; ctx.beginPath(); ctx.arc(p.x, p.y, 13, 0, 7); ctx.fill(); ctx.restore(); }
    }
    partikler = partikler.filter(function (d) { return tid - d.t < 1.2; });
    partikler.forEach(function (d) {
      var e = Math.max(0, tid - d.t) / 1.2, x, y;
      if (d.stjerne) { x = d.x + (d.tx - d.x) * e; y = d.y + (d.ty - d.y) * e; } else { x = d.x + d.vx * e; y = d.y + d.vy * e + 200 * e * e; }
      ctx.save(); ctx.globalAlpha = 1 - e; ctx.fillStyle = d.farve; ctx.beginPath(); ctx.arc(x, y, d.stjerne ? 7 : 5, 0, 7); ctx.fill(); ctx.restore();
    });
    tegnRinge();
  }

  /* ================= En sund dag ================= */

  var vask = null, skum = 0, vaskSidst = null, vaskT = 0, bobler = [];
  var DAGBILLEDER = {};
  Object.keys(K.DAG_KORT).forEach(function (k) { DAGBILLEDER[k] = billede(K.DAG_KORT[k]); });
  var HAAND = KORT.foele, VANDHANE = billede('ting/vandhane.svg');
  function startDag() {
    runde = K.dagRunde(svaerhed); ri = 0; vask = null;
    figurer = [Math.random() < 0.5 ? 'emil' : 'ella']; L = null; laast = true;
    sig(K.DAG_TEKST.hej, function () { nyDag(); });
  }
  function spoergDag() { var q = runde[ri]; sig([q.situation, q.spoerg]); }
  function nyDag() { valgte = []; ryst = {}; vask = null; L = null; laast = false; spoergDag(); }
  function naesteDag() { ri++; if (ri >= runde.length) afslut(); else senere(nyDag, 400); }
  function startVask() {
    vask = { i: 0 }; skum = 0; bobler = []; L = null; laast = false;
    sig([K.DAG_TEKST.vask, svaerhed === 0 ? K.VASK[0].siges : K.DAG_TEKST.nu]);
  }
  /** Hvad paa haandvaskens bord er trykket paa? */
  function vaskTing(x, y) {
    var V = L.vask, ud = null;
    [['vandhane', V.hane], ['saebe', V.saebe], ['haender', V.haender], ['haandklaede', V.klaede]].forEach(function (t) {
      if (Math.abs(x - t[1].x) < t[1].b / 2 && Math.abs(y - t[1].y) < t[1].h / 2) ud = t[0];
    });
    return ud;
  }
  function vaskMaal(trin) { return { vand: 'vandhane', saebe: 'saebe', gnid: 'haender', skyl: 'vandhane', toer: 'haandklaede' }[trin]; }
  function vaskVidere() {
    vask.i++; vaskT = tid;
    if (vask.i >= K.VASK.length) { laast = true; vask.faerdig = true; var q = runde[ri]; sig([K.DAG_TEKST.rene, q.robot], naesteDag); return; }
    sig(svaerhed === 0 ? K.VASK[vask.i].siges : K.DAG_TEKST.nu);
  }
  function trykDag(x, y, id) {
    var q = runde[ri]; if (!q || laast) return;
    if (iHoejttaler(x, y)) { LYDE.klik(); if (vask) sig(K.VASK[vask.i].siges); else spoergDag(); return; }
    if (vask) {
      var t = vaskTing(x, y), trin = K.VASK[vask.i].trin;
      if (!t) return;
      if (t === vaskMaal(trin)) {
        if (trin === 'gnid') { traekFinger = id; vaskSidst = { x: x, y: y }; return; }
        LYDE.klik(); if (trin === 'skyl') skum = 0;
        vaskVidere();
      } else { LYDE.nej(); sig([K.DAG_TEKST.foerst, K.VASK[vask.i].siges]); }
      return;
    }
    L.kort.forEach(function (c, i) {
      if (Math.abs(x - c.x) > c.s / 2 || Math.abs(y - c.y) > c.s / 2) return;
      var k = q.kort[i];
      if (k === q.svar) {
        laast = true; LYDE.rigtig(); valgte = [k];
        if (q.vask) sig(q.ja, startVask); else sig([q.ja, q.robot], naesteDag);
      } else { LYDE.nej(); ryst[k] = tid; sig([K.TEKST.igen, q.spoerg]); }
    });
  }
  function flytDag(x, y, id) {
    if (!vask || laast || id !== traekFinger || K.VASK[vask.i].trin !== 'gnid') return;
    skum += Math.hypot(x - vaskSidst.x, y - vaskSidst.y); vaskSidst = { x: x, y: y };
    if (Math.random() < 0.4) bobler.push({ x: x + (Math.random() - 0.5) * 60, y: y + (Math.random() - 0.5) * 40, r: 6 + Math.random() * 10, t: tid });
    if (skum > 1800) { traekFinger = null; LYDE.rigtig(); vaskVidere(); }
  }
  function slipDag(id) { if (id === traekFinger) traekFinger = null; }
  function himmel(x, y, b, h, tidspunkt) {
    var farver = { morgen: ['#f3c98d', '#cfe3ee'], middag: ['#8fc7e8', '#d6ebf5'], eftermiddag: ['#aed3e4', '#f3dcc0'], aften: ['#2f3f5a', '#5a6a8a'] }[tidspunkt];
    var g = ctx.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, farver[0]); g.addColorStop(1, farver[1]);
    rr(x - 10, y - 10, b + 20, h + 20, 16, '#d9ba8a'); rr(x, y, b, h, 8, g);
    var pos = { morgen: [0.2, 0.75], middag: [0.5, 0.25], eftermiddag: [0.78, 0.5], aften: [0.7, 0.3] }[tidspunkt];
    ctx.fillStyle = tidspunkt === 'aften' ? '#f8f1e6' : GUL;
    ctx.beginPath(); ctx.arc(x + b * pos[0], y + h * pos[1], h * 0.16, 0, 7); ctx.fill();
    if (tidspunkt === 'aften') { ctx.fillStyle = '#2f3f5a'; ctx.beginPath(); ctx.arc(x + b * pos[0] + h * 0.07, y + h * pos[1] - h * 0.04, h * 0.14, 0, 7); ctx.fill();
      ctx.fillStyle = '#f8f1e6'; [[0.2, 0.2], [0.35, 0.6], [0.88, 0.75], [0.15, 0.8]].forEach(function (s) { ctx.beginPath(); ctx.arc(x + b * s[0], y + h * s[1], 2.5, 0, 7); ctx.fill(); }); }
    ctx.strokeStyle = '#d9ba8a'; ctx.lineWidth = 8; ctx.beginPath(); ctx.moveTo(x + b / 2, y); ctx.lineTo(x + b / 2, y + h); ctx.moveTo(x, y + h / 2); ctx.lineTo(x + b, y + h / 2); ctx.stroke();
  }
  function tegnDag() {
    var q = runde[ri]; if (!q) return;
    var f = figurer[0], vin = L.vindue;
    himmel(vin.x, vin.y, vin.b, vin.h, q.tid);
    if (!vask) {
      tegnFigur(f);
      L.kort.forEach(function (c, i) {
        var s = q.kort[i], valgt = valgte.indexOf(s) >= 0, dx = ryst[s] && tid - ryst[s] < 0.5 ? Math.sin((tid - ryst[s]) * 40) * 8 : 0;
        ctx.save(); ctx.shadowColor = 'rgba(107,85,68,.2)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 5;
        rr(c.x - c.s / 2 + dx, c.y - c.s / 2, c.s, c.s, 22, valgt ? '#aed3e4' : PAPIR); ctx.restore();
        tegnBillede(DAGBILLEDER[s], c.x + dx, c.y, c.s * 0.72);
      });
      return;
    }
    // Haandvasken: haanen, saeben, haenderne og haandklaedet paa en hylde
    var V = L.vask, trin = vask.faerdig ? null : K.VASK[vask.i].trin;
    rr(V.bord.x, V.bord.y, V.bord.b, V.bord.h, 18, '#efe3d0');
    function lys(t) { if (svaerhed === 0 && trin && vaskMaal(trin) === t) { var o = { vandhane: V.hane, saebe: V.saebe, haender: V.haender, haandklaede: V.klaede }[t]; ctx.save(); ctx.globalAlpha = 0.3 + Math.sin(tid * 5) * 0.15; rr(o.x - o.b / 2, o.y - o.h / 2, o.b, o.h, 24, GUL); ctx.restore(); } }
    ['vandhane', 'saebe', 'haender', 'haandklaede'].forEach(lys);
    tegnBillede(VANDHANE, V.hane.x, V.hane.y, V.hane.h * 0.9);
    if (tid - vaskT < 1.2 && vask.i > 0 && ['vand', 'skyl'].indexOf(K.VASK[vask.i - 1].trin) >= 0) {
      ctx.save(); ctx.globalAlpha = 0.6; ctx.fillStyle = '#8fc7e8'; rr(V.hane.x - 8, V.hane.y + V.hane.h * 0.3, 16, V.haender.y - V.hane.y - V.hane.h * 0.3, 8, '#8fc7e8'); ctx.restore();
    }
    tegnBillede(DAGBILLEDER.saebe, V.saebe.x, V.saebe.y, V.saebe.h * 0.8);
    ctx.save(); ctx.translate(V.haender.x - V.haender.b * 0.22, V.haender.y); ctx.scale(-1, 1); tegnBillede(HAAND, 0, 0, V.haender.h * 0.8); ctx.restore();
    tegnBillede(HAAND, V.haender.x + V.haender.b * 0.22, V.haender.y, V.haender.h * 0.8);
    // Haandklaedet, tegnet i kode
    var kl = V.klaede; rr(kl.x - kl.b * 0.35, kl.y - kl.h * 0.4, kl.b * 0.7, kl.h * 0.8, 12, '#aed3e4');
    ctx.fillStyle = '#5f9fc9'; ctx.fillRect(kl.x - kl.b * 0.35, kl.y + kl.h * 0.18, kl.b * 0.7, 8); ctx.fillRect(kl.x - kl.b * 0.35, kl.y + kl.h * 0.26, kl.b * 0.7, 4);
    // Skum
    bobler = bobler.filter(function (b) { return skum > 0 && tid - b.t < 6; });
    bobler.forEach(function (b) { ctx.save(); ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.strokeStyle = 'rgba(143,199,232,.8)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); ctx.stroke(); ctx.restore(); });
    if (trin === 'gnid' && skum < 50) { ctx.save(); ctx.globalAlpha = 0.5; ctx.strokeStyle = '#5f9fc9'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(V.haender.x, V.haender.y, 70, tid * 2, tid * 2 + 4.5); ctx.stroke(); ctx.restore(); }
  }

  /* ================= menu og slut ================= */

  var LEGE = ['peg', 'roentgen', 'sanser', 'mad', 'dag'];
  function legIkon(cv, l) {
    var c = cv.getContext('2d'), W = cv.width, H = cv.height;
    c.clearRect(0, 0, W, H);
    function tegn(i, x, y, h) { if (!erKlar(i)) return; var k = h / i.naturalHeight; c.drawImage(i, x - i.naturalWidth * k / 2, y - h / 2, i.naturalWidth * k, h); }
    if (l === 'peg') { tegn(BILLEDER.emil, W * 0.5, H * 0.5, H * 0.92); c.fillStyle = 'rgba(240,196,106,.8)'; c.beginPath(); c.arc(W * 0.5 - 30, H * 0.52, 9, 0, 7); c.fill(); }
    else if (l === 'roentgen') {
      c.fillStyle = '#25445e'; c.beginPath(); c.arc(W / 2, H / 2, H * 0.44, 0, 7); c.fill();
      c.strokeStyle = '#f8f6f0'; c.lineWidth = 4; c.lineCap = 'round';
      for (var n = 0; n < 4; n++) { c.beginPath(); c.ellipse(W / 2, H * 0.3 + n * 14, 28 + n * 3, 8, 0, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }
      c.fillStyle = '#d95f45'; c.beginPath(); c.arc(W / 2 + 8, H * 0.5, 8, 0, 7); c.fill();
      c.beginPath(); c.moveTo(W / 2, H * 0.25); c.lineTo(W / 2, H * 0.8); c.stroke();
    } else if (l === 'sanser') { tegn(KORT.se, W * 0.3, H * 0.5, H * 0.5); tegn(KORT.hoere, W * 0.7, H * 0.5, H * 0.5); }
    else if (l === 'mad') {
      c.strokeStyle = '#e9a7a0'; c.lineWidth = 10; c.lineCap = 'round'; c.beginPath(); c.moveTo(W * 0.62, H * 0.12); c.lineTo(W * 0.62, H * 0.45);
      c.quadraticCurveTo(W * 0.62, H * 0.62, W * 0.48, H * 0.66); c.stroke();
      c.strokeStyle = '#e3a86f'; c.beginPath(); for (var a = 0; a < 18; a++) { var v = a * 0.7, r = 22 - a * 0.8; var px = W * 0.5 + Math.cos(v) * r, py = H * 0.74 + Math.sin(v) * r * 0.5; if (a) c.lineTo(px, py); else c.moveTo(px, py); } c.stroke();
      tegn(MADBILLEDER.gulerod, W * 0.3, H * 0.32, H * 0.5);
    } else {
      c.fillStyle = '#f0c46a'; c.beginPath(); c.arc(W * 0.33, H * 0.5, H * 0.24, 0, 7); c.fill();
      c.fillStyle = '#2f3f5a'; c.beginPath(); c.arc(W * 0.68, H * 0.5, H * 0.26, 0, 7); c.fill();
      c.fillStyle = '#f8f1e6'; c.beginPath(); c.arc(W * 0.66, H * 0.48, H * 0.17, 0, 7); c.fill(); c.fillStyle = '#2f3f5a'; c.beginPath(); c.arc(W * 0.71, H * 0.43, H * 0.15, 0, 7); c.fill();
    }
  }
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }
  function visMenu() {
    tilstand = 'menu'; omgang++; tie(); linse = null;
    var start = leg === 'peg' ? Menu.startRaekke('start')
      : '<div class="raekke start"><button class="knap groen start" data-handling="start" data-spillere="1" aria-label="Start">' + Menu.start() + '</button></div>';
    visOverlay('<div class="kort"><img class="rasmus" src="../bogstaver/billeder/robot.png" alt=""><h2>Kropshuset</h2>' +
      '<div class="raekke lege">' + LEGE.map(function (l) {
        return '<button class="knap ikon' + (l === leg ? ' valgt' : '') + '" data-handling="leg" data-leg="' + l + '" aria-label="' + l + '"><canvas width="160" height="110" data-leg="' + l + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) + start + Menu.lydRaekke(lydTil) + '</div>');
    overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) { legIkon(cv, cv.dataset.leg); });
  }
  [BILLEDER.emil, MADBILLEDER.gulerod].concat(Object.keys(KORT).map(function (s) { return KORT[s]; })).forEach(function (i) {
    i.addEventListener('load', function () { if (tilstand === 'menu') overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) { legIkon(cv, cv.dataset.leg); }); });
  });
  function afslut() {
    tilstand = 'faerdig'; LYDE.faerdig();
    sig(K.TEKST.faerdig);
    visOverlay('<div class="kort"><img class="rasmus" src="../bogstaver/billeder/robot.png" alt=""><h2>Kropshuset</h2>' + Menu.slutRaekke('igen', null) + '</div>');
  }
  function start() {
    omgang++; tilstand = 'spil'; skjulOverlay(); L = null; ringe = [];
    if (leg === 'peg') startPeg(); else if (leg === 'roentgen') startRoentgen(); else if (leg === 'sanser') startSanser(); else if (leg === 'mad') startMad(); else startDag();
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    startLyd();
    if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'leg') { leg = knap.dataset.leg; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) tie(); visMenu(); }
    else if (h === 'start') { spillere = +(knap.dataset.spillere || 1); tone(523, 0.1, 0.1); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); start(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loekken og input ---------- */
  function loekke(t) {
    requestAnimationFrame(loekke);
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    layout();
    tegnRum();
    if (tilstand === 'spil' || tilstand === 'faerdig') {
      if (leg === 'peg') tegnPeg(); else if (leg === 'roentgen') tegnRoentgen(); else if (leg === 'sanser') tegnSanser(); else if (leg === 'mad') tegnMad(); else tegnDag();
      tegnRasmus();
      if (tilstand === 'spil') { cirkler(); hoejttaler(); }
    } else tegnRasmus();
  }
  function punkt(e) { var r = laerred.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  var linseFinger = null;
  // Hver finger for sig (pointerdown, ikke click), saa to boern kan trykke samtidig
  laerred.addEventListener('pointerdown', function (e) {
    e.preventDefault(); layout();
    if (tilstand !== 'spil') return;
    var p = punkt(e);
    if (leg === 'peg') { if (!laast) trykPeg(p[0], p[1]); }
    else if (leg === 'roentgen') {
      if (iHoejttaler(p[0], p[1])) { LYDE.klik(); if (runde[ri]) sig(K.find(runde[ri])); return; }
      if (laast) return;
      linseFinger = e.pointerId; linse = { x: p[0], y: p[1] }; LYDE.bip();
    } else if (leg === 'sanser') { if (!laast) trykSans(p[0], p[1]); }
    else if (leg === 'mad') trykMad(p[0], p[1], e.pointerId);
    else trykDag(p[0], p[1], e.pointerId);
  }, { passive: false });
  laerred.addEventListener('pointermove', function (e) {
    if (tilstand !== 'spil') return;
    var p = punkt(e);
    if (leg === 'roentgen' && linse && e.pointerId === linseFinger) { linse.x = p[0]; linse.y = p[1]; }
    else if (leg === 'mad') flytMad(p[0], p[1], e.pointerId);
    else if (leg === 'dag') flytDag(p[0], p[1], e.pointerId);
  });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    laerred.addEventListener(type, function (e) {
      if (leg === 'mad') { slipMad(e.pointerId); return; }
      if (leg === 'dag') { slipDag(e.pointerId); return; }
      if (leg !== 'roentgen' || e.pointerId !== linseFinger) return;
      var p = punkt(e); linse = null; linseFinger = null;
      if (type === 'pointerup' && tilstand === 'spil') slipRoentgen(p[0], p[1]);
    });
  });
  laerred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpas);
  window.addEventListener('orientationchange', function () { setTimeout(tilpas, 220); });

  /** Til testen i browseren: tilstanden og hvor tingene er paa skaermen. */
  window.__debug = function () {
    layout();
    var maal = runde[ri], ud = { tilstand: tilstand, leg: leg, svaerhed: svaerhed, ri: ri, n: runde.length, laast: laast, figurer: figurer.slice(), maal: null };
    if (tilstand !== 'spil' || !maal) return ud;
    if (leg === 'peg') ud.maal = { del: maal, steder: figurer.map(function (f) { var c = K.PLADS[f][maal][0]; return tilSkaerm(f, c[0], c[1]); }),
      forkert: figurer.map(function (f) { var anden = Object.keys(K.PLADS[f]).filter(function (d) { return d !== maal && d !== 'hoved' && K.naer(K.PLADS[f][maal], K.PLADS[f][d][0][0], K.PLADS[f][d][0][1]) > 2; })[0]; var c = K.PLADS[f][anden][0]; return { del: anden, p: tilSkaerm(f, c[0], c[1]) }; }) };
    else if (leg === 'roentgen') { var f = figurer[0], c = K.INDRE[f][maal][0]; ud.maal = { organ: maal, p: tilSkaerm(f, c[0], c[1]) }; }
    else if (leg === 'sanser') { var q = maal; ud.maal = { ting: q.ting, sanser: q.sanser, kort: q.kort, steder: L.kort.map(function (c) { return { x: c.x, y: c.y }; }) }; }
    else if (leg === 'mad') {
      var fm = figurer[0], liste = maal.station === 'synke' ? vej.spiseroer : maal.station === 'tarme' ? vej.tarme : null;
      ud.maal = { station: maal.station, mad: madSted(), mund: tilSkaerm(fm, vej.mund[0], vej.mund[1]), mave: tilSkaerm(fm, vej.mave[0], vej.mave[1]),
        vej: liste ? liste.map(function (a) { return tilSkaerm(fm, a[0], a[1]); }) : null,
        sted: maal.station === 'huske' ? (function () { var c = vej.steder[K.VEJ[maal.i].sted][0]; return tilSkaerm(fm, c[0], c[1]); })() : null };
    } else {
      var qd = maal, V = L.vask;
      ud.maal = { svar: qd.svar, kort: qd.kort, steder: L.kort.map(function (c) { return { x: c.x, y: c.y }; }), vask: vask ? { trin: vask.faerdig ? null : K.VASK[vask.i].trin } : null,
        vaskSted: V ? { vandhane: V.hane, saebe: V.saebe, haender: V.haender, haandklaede: V.klaede } : null };
    }
    return ud;
  };

  tilpas();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(loekke);
})();
