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
    var hoejde = leg === 'sanser' ? H * 0.5 : H * (figurer.length > 1 ? 0.82 : 0.86);
    figurer.forEach(function (f, i) {
      var F = K.FIGURER[f], k = hoejde / F.h, b = F.b * k;
      var cx = VEN + plads * (figurer.length > 1 ? (i === 0 ? 0.3 : 0.72) : 0.5);
      kasser[f] = { x: cx - b / 2, y: gulv + H * 0.06 - hoejde, b: b, h: hoejde, k: k };
    });
    L = { W: W, H: H, VEN: VEN, gulv: gulv, ras: ras, kasser: kasser, hoejttaler: { x: W - 46, y: 46, r: 30 } };
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

  /* ================= menu og slut ================= */

  var LEGE = ['peg', 'roentgen', 'sanser'];
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
    } else { tegn(KORT.se, W * 0.3, H * 0.5, H * 0.5); tegn(KORT.hoere, W * 0.7, H * 0.5, H * 0.5); }
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
  [BILLEDER.emil].concat(Object.keys(KORT).map(function (s) { return KORT[s]; })).forEach(function (i) {
    i.addEventListener('load', function () { if (tilstand === 'menu') overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) { legIkon(cv, cv.dataset.leg); }); });
  });
  function afslut() {
    tilstand = 'faerdig'; LYDE.faerdig();
    sig(K.TEKST.faerdig);
    visOverlay('<div class="kort"><img class="rasmus" src="../bogstaver/billeder/robot.png" alt=""><h2>Kropshuset</h2>' + Menu.slutRaekke('igen', null) + '</div>');
  }
  function start() {
    omgang++; tilstand = 'spil'; skjulOverlay(); L = null; ringe = [];
    if (leg === 'peg') startPeg(); else if (leg === 'roentgen') startRoentgen(); else startSanser();
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
      if (leg === 'peg') tegnPeg(); else if (leg === 'roentgen') tegnRoentgen(); else tegnSanser();
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
    } else if (!laast) trykSans(p[0], p[1]);
  }, { passive: false });
  laerred.addEventListener('pointermove', function (e) { if (leg === 'roentgen' && linse && e.pointerId === linseFinger) { var p = punkt(e); linse.x = p[0]; linse.y = p[1]; } });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    laerred.addEventListener(type, function (e) {
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
    else { var q = maal; ud.maal = { ting: q.ting, sanser: q.sanser, kort: q.kort, steder: L.kort.map(function (c) { return { x: c.x, y: c.y }; }) }; }
    return ud;
  };

  tilpas();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(loekke);
})();
