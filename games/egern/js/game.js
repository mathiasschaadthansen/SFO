/**
 * Egernreden: Egernet Egons noedder paa en stubbe. Logikken ligger i egern.js.
 *
 * Se hurtigt: bladene blaeser vaek, noedderne ses et oejeblik, bladene kommer
 * tilbage, og barnet trykker paa kortet med det samme antal. Et tryk paa
 * bladene viser noedderne igen. Gemmeleg: Egons noedder deles i to; dem til
 * venstre ses, dem til hoejre gemmer sig under et stort blad. Oppe i hjoernet
 * staar del-helhedsmodellen: helheden foroven og de to dele under den.
 *
 * Ingen tid, der loeber ud, og ingen straf: et forkert kort rokker, og man
 * proever igen. Med to spillere skiftes man; kortenes kant har spillerens farve.
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

  var E = window.Egern;
  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var FARVER = ['#d95f45', '#5f9fc9'];

  var tilstand = 'menu', leg = 'se', svaerhed = 0, spillere = 1, lydTil = true;
  var tid = 0, sidsteTid = 0;
  var runde = [], qi = 0, q = null;
  var fase = 'ind', ft = 0;          // fasen i spoergsmaalet og tiden i den
  var blade = 0, bladeMaal = 0;      // Se hurtigt: 0 = bladene daekker, 1 = blaest vaek
  var loeft = 0, loeftMaal = 0;      // Gemmeleg: bladet over de gemte, 0 = ligger, 1 = loeftet
  var forkerte = 0, vip = {}, rigtigKort = -1, kurv = 0, flyv = [], bladPile = [];
  var ventet = 0;                    // Gemmeleg: hvor langt noedderne er paa vej til deres side

  /* ---------- billeder ---------- */
  var noed = new Image(); noed.src = '../bogstaver/billeder/noed.png';
  var egon = new Image(); egon.src = '../bogstaver/billeder/egern.png';
  function klar(i) { return i.complete && i.naturalWidth > 0; }
  [noed, egon].forEach(function (i) { i.addEventListener('load', function () { if (tilstand === 'menu') tegnLegIkoner(); }); });

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
  function melodi(toner, mellem) { toner.forEach(function (f, i) { tone(f, 0.22, 0.09, i * mellem / 1000); }); }
  var LYDE = {
    sus: function () { for (var i = 0; i < 5; i++) tone(500 + Math.random() * 400, 0.1, 0.02, i * 0.04, 'sine'); },
    pop: function (n) { tone(523 + n * 60, 0.08, 0.05); },
    rigtig: function () { melodi([660, 880, 1100], 90); },
    nej: function () { tone(262, 0.12, 0.05); tone(247, 0.12, 0.04, 0.09); },
    kurv: function () { tone(784, 0.06, 0.04); },
    faerdig: function () { melodi([523, 659, 784, 1047, 1319], 110); }
  };
  document.addEventListener('pointerdown', startLyd, true);
  var stemme = Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.9 });

  /* ---------- skaermen ---------- */
  var L = null;
  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr); lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px'; lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = null; jord = null;
  }
  /** Stubben i midten, Egon til hoejre, kortene forneden, modellen oppe til venstre. Venstre kant er fri til knapperne. */
  function layout() {
    if (L) return L;
    var W = window.innerWidth, H = window.innerHeight, VEN = 72;
    var kh = Math.max(96, Math.min(H * 0.24, 190)), kb = Math.min(kh * 1.15, (W - VEN - 40) / 3.4);
    var top = 50, bund = H - kh - 26, R = Math.max(60, Math.min((bund - top) / 2 * 0.94, (W - VEN) * 0.24));
    var cx = VEN + (W - VEN) * 0.46, cy = top + (bund - top) / 2;
    var kort = [0, 1, 2].map(function (i) { return { x: VEN + (W - VEN) / 2 + (i - 1) * (kb + 18) - kb / 2, y: H - kh - 12, b: kb, h: kh }; });
    var ex = Math.min(W - 70, cx + R + (W - cx - R) / 2), eh = Math.min(R * 1.45, W - cx - R);
    L = { W: W, H: H, cx: cx, cy: cy, R: R, kort: kort, egon: { x: ex, y: cy + R * 0.85, h: eh }, model: { x: VEN + Math.max(46, (cx - R - VEN) / 2), y: top + 46, r: Math.min(50, (cx - R - VEN) / 3.2) } };
    return L;
  }
  function rr(x, y, b, h, r, fyld) { ctx.beginPath(); ctx.roundRect(x, y, b, h, r); if (fyld) { ctx.fillStyle = fyld; ctx.fill(); } }

  /* ---------- spillet ---------- */
  function start() {
    tilstand = 'spil'; L = null;
    runde = E.nyRunde(leg, svaerhed, spillere); qi = 0; kurv = 0; flyv = [];
    stemme.tie();
    nytSpoergsmaal(true);
  }
  function nytSpoergsmaal(foerste) {
    q = runde[qi]; fase = 'ind'; ft = 0; forkerte = 0; vip = {}; rigtigKort = -1;
    blade = 0; bladeMaal = 0; loeft = 0; loeftMaal = 0; ventet = 0;
    // En bunke blade, der ligger lidt forskelligt hver gang
    bladPile = [];
    for (var i = 0; i < 11; i++) {
      var v = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 0.25 + Math.random() * 0.5;
      bladPile.push({ x: Math.cos(v) * r, y: Math.sin(v) * r, v: Math.random() * 6.3, s: 0.55 + Math.random() * 0.25, f: ['#93bc63', '#5f8240', '#e08a52', '#f0c46a', '#b18a56'][i % 5] });
    }
    if (q.leg === 'se') { if (foerste) stemme.sig(E.spoergTekst(q, true)); }
    else stemme.sig(E.egonHar(q.hel));
  }

  /** Hvor noed nr. i ligger paa stubben (i enhedscirklen). */
  function gemPos(i) {
    var s = q.hel <= 5 ? 0.3 : 0.26, hel = E.tierramme(q.hel, s)[i];
    if (fase === 'ind' && ft < 99) return hel;
    // Delene: dem, der ses, til venstre; de gemte til hoejre under bladet
    var del = i < q.synlig ? i : i - q.synlig, n = i < q.synlig ? q.synlig : q.skjult, sx = i < q.synlig ? -0.46 : 0.46;
    var d = n <= 6 ? E.terning(n, 0.2)[del] : E.tierramme(n, 0.16)[del];
    var maal = { x: sx + d.x, y: d.y }, e = Math.min(1, ventet), k = e * e * (3 - 2 * e);
    return { x: hel.x + (maal.x - hel.x) * k, y: hel.y + (maal.y - hel.y) * k };
  }
  function noedStr() {
    if (!q) return 0.2;
    if (q.leg === 'se') return q.str;
    return fase === 'ind' ? (q.hel <= 5 ? 0.26 : 0.2) : (Math.max(q.synlig, q.skjult) > 6 ? 0.13 : 0.18);
  }
  function noedder() {
    if (!q) return [];
    var n = q.leg === 'se' ? q.antal : q.hel, ud = [];
    for (var i = 0; i < n; i++) {
      var p = q.leg === 'se' ? q.pos[i] : gemPos(i);
      ud.push({ x: L.cx + p.x * L.R, y: L.cy + p.y * L.R, gemt: q.leg === 'gem' && i >= q.synlig });
    }
    return ud;
  }

  function vaelg(k) {
    if (fase !== 'svar') return;
    var x = q.svar[k];
    if (E.svar(q, x)) {
      rigtigKort = k; fase = 'rigtig'; ft = 0; LYDE.rigtig();
      bladeMaal = 1; loeftMaal = 1;
      stemme.sig(E.rigtigTekst(q));
    } else {
      forkerte++; vip[k] = 0.5; LYDE.nej();
      if (q.leg === 'se') {
        stemme.sig(E.tal(x) + ' ' + E.TEKST.kigIgen);
        kig(forkerte >= 2 ? 99 : q.vis + 0.4);
      } else {
        stemme.sig(E.TEKST.proevIgen);
        if (forkerte >= 2) loeftMaal = 0.45;   // bladet loefter sig lidt, saa man kan kigge ind
      }
    }
  }
  /** Se hurtigt: vis noedderne i sek sekunder (99: til svaret er fundet). */
  var kigTil = 0;
  function kig(sek) { bladeMaal = 1; kigTil = tid + 0.35 + sek; LYDE.sus(); }

  function tryk(e) {
    if (tilstand !== 'spil' || !q) return;
    var x = e.clientX, y = e.clientY;
    L.kort.forEach(function (k, i) { if (x > k.x && x < k.x + k.b && y > k.y - 10 && y < k.y + k.h + 10) vaelg(i); });
    // Et tryk paa bladene: se noedderne igen
    if (q.leg === 'se' && fase === 'svar' && Math.hypot(x - L.cx, y - L.cy) < L.R && bladeMaal === 0) kig(q.vis);
    if (q.leg === 'gem' && fase === 'svar' && Math.hypot(x - (L.cx + 0.46 * L.R), y - L.cy) < L.R * 0.5) { vip.blad = 0.5; LYDE.sus(); }
  }

  function opdater(dt) {
    ft += dt;
    blade += Math.max(-dt * 3.2, Math.min(dt * 3.2, bladeMaal - blade));
    loeft += Math.max(-dt * 2.5, Math.min(dt * 2.5, loeftMaal - loeft));
    Object.keys(vip).forEach(function (k) { vip[k] -= dt; if (vip[k] <= 0) delete vip[k]; });
    flyv.forEach(function (f) { f.t += dt; });
    flyv = flyv.filter(function (f) { if (f.t >= 0.7) { kurv++; LYDE.kurv(); return false; } return true; });
    if (!q) return;
    if (q.leg === 'se') {
      if (fase === 'ind' && ft > 1.0 && bladeMaal === 0) { kig(q.vis); fase = 'kig'; ft = 0; }
      if (fase === 'kig' && tid > kigTil) { bladeMaal = 0; fase = 'svar'; ft = 0; LYDE.sus(); if (qi > 0 || forkerte) stemme.koe(E.TEKST.seSpoerg); }
      if (fase === 'svar' && bladeMaal === 1 && tid > kigTil) { bladeMaal = 0; LYDE.sus(); }
    } else {
      if (fase === 'ind' && ft > 1.9) { fase = 'del'; ft = 0; ventet = 0; }
      if (fase === 'del') {
        ventet += dt / 0.8;
        if (ventet >= 1 && ft > 0.8) { fase = 'svar'; ft = 0; stemme.koe(E.TEKST.gemSkjul + ' ' + E.TEKST.gemSpoerg); LYDE.sus(); }
      }
    }
    if (fase === 'rigtig' && ft > 2.4 && ft - dt <= 2.4) {
      // Noedderne flyver op i Egons kurv
      noedder().forEach(function (n, i) { flyv.push({ x: n.x, y: n.y, t: -i * 0.06 }); });
      q.tom = true;
    }
    if (fase === 'rigtig' && ft > 3.4) {
      qi++;
      if (qi >= runde.length) { fase = 'slut'; q = null; stemme.koe(E.TEKST.faerdig); LYDE.faerdig(); setTimeout(afslut, 3200); return; }
      nytSpoergsmaal(false);
    }
  }

  /* ---------- tegning ---------- */
  function tegnNoed(x, y, d, glød) {
    if (glød) { ctx.fillStyle = 'rgba(240,196,106,.5)'; ctx.beginPath(); ctx.arc(x, y, d * 0.7, 0, 7); ctx.fill(); }
    if (klar(noed)) ctx.drawImage(noed, x - d / 2, y - d / 2, d, d);
    else { ctx.fillStyle = '#b18a56'; ctx.beginPath(); ctx.arc(x, y, d * 0.42, 0, 7); ctx.fill(); }
  }
  /** Et blad: spids i begge ender og en midtribbe. */
  function tegnBlad(x, y, s, v, farve, alfa, bred) {
    var b = bred || 0.55;
    ctx.save(); ctx.translate(x, y); ctx.rotate(v); ctx.globalAlpha = alfa;
    ctx.fillStyle = 'rgba(94,74,58,.18)'; ctx.beginPath(); ctx.moveTo(-s + 4, 6); ctx.quadraticCurveTo(0, -s * b + 6, s + 4, 6); ctx.quadraticCurveTo(0, s * b + 6, -s + 4, 6); ctx.fill();
    ctx.fillStyle = farve; ctx.beginPath(); ctx.moveTo(-s, 0); ctx.quadraticCurveTo(0, -s * b, s, 0); ctx.quadraticCurveTo(0, s * b, -s, 0); ctx.fill();
    ctx.strokeStyle = 'rgba(94,74,58,.35)'; ctx.lineWidth = Math.max(1.5, s * 0.04);
    ctx.beginPath(); ctx.moveTo(-s * 0.9, 0); ctx.lineTo(s * 0.95, 0);
    for (var k = -2; k <= 2; k++) { ctx.moveTo(k * s * 0.3, 0); ctx.lineTo(k * s * 0.3 + s * 0.18, -s * b * 0.38); ctx.moveTo(k * s * 0.3, 0); ctx.lineTo(k * s * 0.3 + s * 0.18, s * b * 0.38); }
    ctx.stroke(); ctx.restore(); ctx.globalAlpha = 1;
  }
  function tegnStubbe() {
    var cx = L.cx, cy = L.cy, R = L.R;
    ctx.fillStyle = 'rgba(94,74,58,.2)'; ctx.beginPath(); ctx.ellipse(cx + 8, cy + R * 0.12, R * 1.04, R * 1.0, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a663d'; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    ctx.fillStyle = '#e5d3ae'; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, 7); ctx.fill();
    ctx.strokeStyle = '#d9ba8a'; ctx.lineWidth = 3;
    for (var r = 0.18; r < 0.88; r += 0.14) { ctx.beginPath(); ctx.ellipse(cx + R * 0.02, cy - R * 0.01, R * r, R * r * 0.97, 0.3, 0, 7); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(138,102,61,.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(cx + R * 0.1, cy); ctx.lineTo(cx + R * 0.55, cy + R * 0.2); ctx.stroke();
    ctx.strokeStyle = '#6b5545'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, 7); ctx.stroke();
  }
  function tegnEgon() {
    var e = L.egon;
    if (klar(egon)) { var b = e.h * egon.naturalWidth / egon.naturalHeight; ctx.drawImage(egon, e.x - b / 2, e.y - e.h, b, e.h); }
    // kurven foran Egon, med de noedder, han har faaet
    var kb = e.h * 0.62, kh = e.h * 0.3, kx = e.x - kb / 2 - e.h * 0.05, ky = e.y - kh * 0.6;
    var vis = Math.min(kurv, 24), d = kb * 0.2;
    for (var i = 0; i < vis; i++) { var r = Math.floor(i / 6), c = i % 6; tegnNoed(kx + kb * 0.12 + c * kb * 0.152 + (r % 2) * kb * 0.07, ky + kh * 0.1 - r * d * 0.45, d); }
    rr(kx, ky, kb, kh, kh * 0.3, '#b18a56');
    ctx.strokeStyle = '#8a663d'; ctx.lineWidth = 2;
    for (var k = 1; k < 3; k++) { ctx.beginPath(); ctx.moveTo(kx + 4, ky + kh * k / 3); ctx.lineTo(kx + kb - 4, ky + kh * k / 3); ctx.stroke(); }
    for (var m = 1; m < 7; m++) { ctx.beginPath(); ctx.moveTo(kx + kb * m / 7, ky + 3); ctx.lineTo(kx + kb * m / 7, ky + kh - 3); ctx.stroke(); }
    rr(kx - 3, ky - 3, kb + 6, kh * 0.26, kh * 0.13, '#d9ba8a');
  }
  /** Noedder i et kort: terning til og med seks, ellers tierramme med tomme pladser. */
  function tegnAntal(n, cx, cy, b, h) {
    var s = Math.min(b, h), d, pos;
    if (n <= 6) { d = s * 0.28; pos = E.terning(n, s * 0.29); }
    else {
      d = Math.min(b / 6.2, h / 3.2); pos = E.tierramme(n, d * 1.12);
      E.tierramme(10, d * 1.12).forEach(function (p) { ctx.strokeStyle = 'rgba(138,102,61,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + p.x, cy + p.y, d * 0.42, 0, 7); ctx.stroke(); });
    }
    pos.forEach(function (p) { tegnNoed(cx + p.x, cy + p.y, d); });
  }
  function tegnKort() {
    if (!q || (fase !== 'svar' && fase !== 'rigtig')) return;
    var farve = spillere === 2 ? FARVER[q.spiller] : null;
    L.kort.forEach(function (k, i) {
      var dx = vip[i] ? Math.sin(vip[i] * 40) * 6 : 0, ude = fase === 'rigtig' && i !== rigtigKort;
      ctx.globalAlpha = ude ? 0.35 : 1;
      ctx.fillStyle = 'rgba(107,85,68,.18)'; rr(k.x + dx, k.y + 6, k.b, k.h, 22); ctx.fill();
      rr(k.x + dx, k.y, k.b, k.h, 22, PAPIR);
      if (farve) { ctx.strokeStyle = farve; ctx.lineWidth = 5; ctx.stroke(); }
      if (fase === 'rigtig' && i === rigtigKort) { ctx.strokeStyle = '#93bc63'; ctx.lineWidth = 7; rr(k.x + dx, k.y, k.b, k.h, 22); ctx.stroke(); }
      tegnAntal(q.svar[i], k.x + dx + k.b / 2, k.y + k.h / 2, k.b * 0.8, k.h * 0.78);
      ctx.globalAlpha = 1;
    });
  }
  /** Del-helhedsmodellen: helheden i den store cirkel, de to dele i de smaa. Den gemte del er et blad, til den er fundet. */
  function tegnModel() {
    if (!q || q.leg !== 'gem' || fase === 'ind') return;
    var M = L.model, r = M.r, y2 = M.y + r * 2.6, xs = [M.x - r * 1.25, M.x + r * 1.25];
    ctx.strokeStyle = 'rgba(94,74,58,.5)'; ctx.lineWidth = 3;
    xs.forEach(function (x) { ctx.beginPath(); ctx.moveTo(M.x, M.y + r); ctx.lineTo(x, y2 - r * 0.8); ctx.stroke(); });
    function cirkel(x, y, rr2, n, vis) {
      ctx.fillStyle = PAPIR; ctx.beginPath(); ctx.arc(x, y, rr2, 0, 7); ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 3; ctx.stroke();
      if (vis) tegnAntal(n, x, y, rr2 * 1.35, rr2 * 1.35);
      else tegnBlad(x, y, rr2 * 0.7, -0.5, '#93bc63', 1, 0.95);
    }
    cirkel(M.x, M.y, r, q.hel, true);
    cirkel(xs[0], y2, r * 0.8, q.synlig, true);
    cirkel(xs[1], y2, r * 0.8, q.skjult, fase === 'rigtig');
  }
  function tegnSpil() {
    var W = window.innerWidth;
    // omgangens taeller: cirkler, ikke tal
    for (var i = 0; i < runde.length; i++) {
      ctx.beginPath(); ctx.arc(W / 2 - (runde.length - 1) * 13 + i * 26, 26, 8, 0, 7);
      ctx.fillStyle = i < qi || (i === qi && fase === 'rigtig') ? GUL : 'rgba(248,241,230,.75)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke();
    }
    tegnStubbe();
    if (q && !q.tom) {
      var liste = noedder(), d = noedStr() * L.R * 1.25;
      liste.forEach(function (n) { if (!n.gemt || fase === 'ind') tegnNoed(n.x, n.y, d, fase === 'rigtig' && q.leg === 'se'); });
      // Gemmeleg: de gemte ligger under bladet, som loefter sig, naar svaret er fundet
      if (q.leg === 'gem' && fase !== 'ind') {
        // Under bladet ses de gemte kun, naar bladet loefter sig, eller mens de er paa vej derind
        if (loeft > 0.2 || (fase === 'del' && ventet < 0.9)) liste.forEach(function (n) { if (n.gemt) tegnNoed(n.x, n.y, d, fase === 'rigtig'); });
        if (fase !== 'del' || ventet > 0.6) {
          var bv = vip.blad ? Math.sin(vip.blad * 30) * 0.08 : 0, lx = L.cx + 0.46 * L.R + loeft * L.R * 0.5, ly = L.cy - loeft * L.R * 0.55;
          tegnBlad(lx, ly, L.R * 0.56, -0.3 + bv - loeft * 0.9, '#93bc63', fase === 'del' ? Math.min(1, (ventet - 0.6) * 3) : 1 - Math.max(0, loeft - 0.5) * 1.6, 0.95);
        }
      }
    }
    // Se hurtigt: bunken af blade over stubben
    if (q && q.leg === 'se' && blade < 1) {
      bladPile.forEach(function (b) {
        var ud = blade * L.R * 1.7, v = Math.atan2(b.y || 0.3, b.x || 0.4);
        tegnBlad(L.cx + b.x * L.R + Math.cos(v) * ud, L.cy + b.y * L.R + Math.sin(v) * ud, b.s * L.R, b.v + blade * 2, b.f, 1 - blade);
      });
    }
    tegnModel();
    tegnEgon();
    flyv.forEach(function (f) {
      if (f.t < 0) { tegnNoed(f.x, f.y, noedStr() * L.R * 1.25); return; }
      var u = Math.min(1, f.t / 0.7), e = L.egon, tx = e.x - e.h * 0.05, ty = e.y - e.h * 0.25;
      tegnNoed(f.x + (tx - f.x) * u, f.y + (ty - f.y) * u - Math.sin(u * Math.PI) * L.R * 0.5, noedStr() * L.R * (1.25 - u * 0.6));
    });
    tegnKort();
  }

  var jord = null;
  function tegnBaggrund() {
    var W = window.innerWidth, H = window.innerHeight;
    if (!jord) {
      jord = document.createElement('canvas');
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      jord.width = Math.floor(W * dpr); jord.height = Math.floor(H * dpr);
      var c = jord.getContext('2d'); c.scale(dpr, dpr);
      var g = c.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#a5c979'); g.addColorStop(1, '#8cb65c');
      c.fillStyle = g; c.fillRect(0, 0, W, H);
      var fro = 11; function tilf() { fro = (fro * 9301 + 49297) % 233280; return fro / 233280; }
      c.strokeStyle = 'rgba(95,130,64,.35)'; c.lineWidth = 2; c.lineCap = 'round';
      for (var k = 0; k < W * H / 5000; k++) {
        var x = tilf() * W, y = tilf() * H;
        c.beginPath(); c.moveTo(x - 4, y); c.lineTo(x - 6, y - 8); c.moveTo(x, y); c.lineTo(x, y - 10); c.moveTo(x + 4, y); c.lineTo(x + 6, y - 8); c.stroke();
      }
    }
    ctx.drawImage(jord, 0, 0, W, H);
  }

  /* ---------- menu og slut ---------- */
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }
  var EGON_IMG = '<img class="egon" src="../bogstaver/billeder/egern.png" alt="" onerror="this.remove()">';
  function visMenu() {
    tilstand = 'menu'; q = null;
    stemme.tie();
    visOverlay('<div class="kort">' + EGON_IMG + '<h2>Egernreden</h2>' +
      '<div class="raekke lege">' + E.LEGE.map(function (l) {
        return '<button class="knap ikon' + (l === leg ? ' valgt' : '') + '" data-handling="leg" data-leg="' + l + '" aria-label="' + (l === 'se' ? 'Se hurtigt' : 'Gemmeleg') + '"><canvas width="220" height="150" data-leg="' + l + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) + Menu.startRaekke('start') + Menu.lydRaekke(lydTil) + '</div>');
    tegnLegIkoner();
  }
  /** Legenes knapper: noedder, der kigger frem mellem blade (se hurtigt), og et blad over nogle af dem (gemmeleg). */
  function tegnLegIkoner() {
    overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height, l = cv.dataset.leg, gem = ctx;
      c.clearRect(0, 0, w, h);
      c.fillStyle = l === leg ? '#aed3e4' : '#e5d3ae'; c.beginPath(); c.roundRect(0, 0, w, h, 18); c.fill();
      ctx = c;   // de samme tegnefunktioner, paa knappen
      if (l === 'se') {
        E.terning(4, 26).forEach(function (p) { tegnNoed(w / 2 + p.x, h / 2 + p.y, 40); });
        tegnBlad(w * 0.2, h * 0.3, 34, 0.6, '#93bc63', 1); tegnBlad(w * 0.82, h * 0.72, 34, -0.8, '#e08a52', 1); tegnBlad(w * 0.8, h * 0.25, 28, 2.4, '#f0c46a', 1);
      } else {
        E.terning(3, 20).forEach(function (p) { tegnNoed(w * 0.3 + p.x, h / 2 + p.y, 34); });
        tegnBlad(w * 0.7, h / 2, 50, -0.4, '#93bc63', 1, 0.95);
      }
      ctx = gem;
    });
  }
  function afslut() {
    if (tilstand !== 'spil') return;
    tilstand = 'faerdig';
    visOverlay('<div class="kort">' + EGON_IMG + '<h2>Egernreden</h2>' + Menu.slutRaekke('igen', null) + '</div>');
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    startLyd();
    if (h === 'leg') { leg = knap.dataset.leg; visMenu(); }
    else if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stemme.tie(); visMenu(); }
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loop og input ---------- */
  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    layout();
    tegnBaggrund();
    if (tilstand === 'spil') { opdater(dt); tegnSpil(); }
    requestAnimationFrame(løkke);
  }
  // Hver finger for sig (pointerId gennem pointerdown), saa to boern ikke spaerrer for hinanden
  lærred.addEventListener('pointerdown', function (e) { e.preventDefault(); layout(); tryk(e); }, { passive: false });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  /** Til testen i browseren: kortene og det rigtige svar. */
  window.__debug = function () {
    return {
      tilstand: tilstand, leg: leg, svaerhed: svaerhed, spillere: spillere, fase: fase, qi: qi, antal: runde.length, kurv: kurv,
      q: q ? { leg: q.leg, svar: q.svar, rigtig: q.rigtig, antal: q.antal, hel: q.hel, synlig: q.synlig, skjult: q.skjult, spiller: q.spiller } : null,
      kort: L ? L.kort.map(function (k) { return { x: Math.round(k.x + k.b / 2), y: Math.round(k.y + k.h / 2) }; }) : null,
      stubbe: L ? { x: Math.round(L.cx), y: Math.round(L.cy), r: Math.round(L.R) } : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
