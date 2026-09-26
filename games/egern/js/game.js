/**
 * Egernreden: Egernet Egons noedder paa en stubbe. Logikken ligger i egern.js.
 *
 * Stubben er helheden. I Gemmeleg og Ryst og haeld deler en streg den i to:
 * dem, der ses, og dem under bladet, eller dem i reden og dem udenfor. Man
 * svarer paa en raekke med alle antal (1-5 eller 1-10, som terning og
 * tierramme), saa et tilfaeldigt tryk sjaeldent er rigtigt. Et forkert svar
 * rokker kortet, og noedderne vises igen, nu med delene i hver sin farve i
 * stedet for at blive talt én ad gangen. Et rigtigt svar siges som dele og
 * helhed: "Fem og to er syv."
 *
 * Ingen tid, der loeber ud, og ingen straf. Med to spillere skiftes man; i
 * Gemmeleg gemmer den ene noedder for den anden.
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
  var FARVER = ['#d95f45', '#5f9fc9'];              // spillerne
  var DEL = ['#e08a52', '#5f9fc9'];                 // de to dele: fersken og blaa

  var tilstand = 'menu', leg = 'se', svaerhed = 0, spillere = 1, lydTil = true;
  var tid = 0, sidsteTid = 0;
  var runde = [], qi = 0, q = null, tur = 0;
  var fase = 'ind', ft = 0;          // fasen i spoergsmaalet og tiden i den
  var blade = 0, bladeMaal = 0;      // Se hurtigt: 0 = bladene daekker, 1 = blaest vaek
  var loeft = 0, loeftMaal = 0;      // Gemmeleg: bladet over de gemte, 0 = ligger, 1 = loeftet
  var visDele = false;               // delene lyser i hver sin farve
  var forkerte = 0, vip = {}, rigtigKort = -1, kurv = 0, flyv = [], bladPile = [], kigTil = 0;
  var noed = [];                     // hver noeds plads lige nu (enhedscirklen), glider mod sit maal
  var skjultTo = 0;                  // to spillere i Gemmeleg: saa mange er gemt indtil nu
  var nyMaade = -1;                  // Ryst og haeld: maaden, der lige blev fundet, lyser paa tavlen

  /* ---------- billeder ---------- */
  var noedBillede = new Image(); noedBillede.src = '../bogstaver/billeder/noed.png';
  var egon = new Image(); egon.src = '../bogstaver/billeder/egern.png';
  function klar(i) { return i.complete && i.naturalWidth > 0; }
  [noedBillede, egon].forEach(function (i) { i.addEventListener('load', function () { if (tilstand === 'menu') tegnLegIkoner(); }); });

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
    klik: function () { tone(660, 0.05, 0.04); },
    rigtig: function () { melodi([660, 880, 1100], 90); },
    ny: function () { melodi([660, 880, 1100, 1320], 80); },
    nej: function () { tone(262, 0.12, 0.05); tone(247, 0.12, 0.04, 0.09); },
    kast: function () { for (var i = 0; i < 6; i++) tone(700 + i * 90, 0.06, 0.03, i * 0.05); },
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
  /** Stubben i midten, Egon til hoejre, svarene forneden, tavlen (Ryst og haeld) til venstre. Venstre kant er fri til knapperne. */
  function layout() {
    if (L) return L;
    var W = window.innerWidth, H = window.innerHeight, VEN = 72;
    var kh = Math.max(100, Math.min(H * 0.25, 196));
    var top = 50, bund = H - kh - 26, R = Math.max(60, Math.min((bund - top) / 2 * 0.94, (W - VEN) * 0.24));
    var cx = VEN + (W - VEN) * 0.47, cy = top + (bund - top) / 2;
    var ex = Math.min(W - 70, cx + R + (W - cx - R) / 2), eh = Math.min(R * 1.45, W - cx - R);
    L = { W: W, H: H, VEN: VEN, kh: kh, cx: cx, cy: cy, R: R, egon: { x: ex, y: cy + R * 0.85, h: eh },
          tavle: { x: VEN + 6, y: top + 10, b: Math.max(60, cx - R - VEN - 24), h: bund - top - 20 } };
    return L;
  }
  /** Svarkortene: én raekke til fem eller seks, ellers to raekker (1-5 og 6-10), som en talraekke. */
  function kortene() {
    if (!q) return [];
    var n = q.svar.length, W = L.W, H = L.H, VEN = L.VEN, rk = n > 6 ? 2 : 1, pr = Math.ceil(n / rk);
    var h = rk === 1 ? L.kh : (L.kh - 10) / 2, b = Math.min(h * (rk === 1 ? 0.95 : 1.6), (W - VEN - 30) / pr - 12), ud = [];
    for (var i = 0; i < n; i++) {
      var r = Math.floor(i / pr), c = i % pr;
      ud.push({ x: VEN + (W - VEN) / 2 + (c - (pr - 1) / 2) * (b + 12) - b / 2, y: H - L.kh - 12 + r * (h + 10), b: b, h: h });
    }
    return ud;
  }
  function rr(x, y, b, h, r, fyld) { ctx.beginPath(); ctx.roundRect(x, y, b, h, r); if (fyld) { ctx.fillStyle = fyld; ctx.fill(); } }
  function iStubbe(x, y) { return { x: (x - L.cx) / L.R, y: (y - L.cy) / L.R }; }

  /* ---------- hvor noedderne skal ligge ---------- */
  /** En del paa den ene side af stubben: terning til seks, ellers tierramme. */
  function side(n, sx) {
    var d = n <= 6 ? E.terning(n, 0.2) : E.tierramme(n, 0.16);
    return d.map(function (p) { return { x: sx + p.x, y: p.y }; });
  }
  /** Maalene for noedderne i denne fase. */
  function maal() {
    if (!q) return [];
    if (q.leg === 'se') return q.pos;
    if (q.leg === 'ryst') {
      if (fase === 'klar') return noed.map(function () { return iStubbe(L.egon.x - L.egon.h * 0.05, L.egon.y - L.egon.h * 0.3); });
      return side(q.iReden, -0.46).concat(side(q.hel - q.iReden, 0.46));
    }
    if (q.selv) {
      var ses = q.hel - skjultTo;
      return side(ses, -0.46).concat(skjultTo ? side(skjultTo, 0.46) : []);
    }
    if (fase === 'ind') return E.tierramme(q.hel, q.hel <= 5 ? 0.3 : 0.26);
    return side(q.synlig, -0.46).concat(side(q.skjult, 0.46));
  }
  function noedStr() {
    if (!q) return 0.2;
    if (q.leg === 'se') return q.str;
    if (q.leg === 'gem' && fase === 'ind' && !q.selv) return q.hel <= 5 ? 0.26 : 0.2;
    var stor = q.leg === 'ryst' ? Math.max(q.iReden || 0, q.hel - (q.iReden || 0)) : Math.max(q.synlig || 0, q.skjult || 0, q.hel - skjultTo);
    return stor > 6 ? 0.13 : 0.18;
  }
  /** Hvilken del noed nr. i hoerer til: 0, 1 eller -1 (ingen). */
  function delAf(i) {
    if (!q) return -1;
    if (q.leg === 'se') return q.dele ? (i < q.dele[0] ? 0 : 1) : -1;
    if (q.leg === 'ryst') return i < q.iReden ? 0 : 1;
    var ses = q.selv ? q.hel - skjultTo : q.synlig;
    return i < ses ? 0 : 1;
  }
  function gemtNoed(i) { return q && q.leg === 'gem' && fase !== 'ind' && delAf(i) === 1; }

  /* ---------- spillet ---------- */
  function start() {
    tilstand = 'spil'; layout();
    runde = E.nyRunde(leg, svaerhed, spillere); qi = 0; kurv = 0; flyv = []; tur = 0;
    stemme.tie();
    nytSpoergsmaal(true);
  }
  function nytSpoergsmaal(foerste) {
    q = runde[qi]; ft = 0; forkerte = 0; vip = {}; rigtigKort = -1; visDele = false;
    blade = 0; bladeMaal = 0; loeft = 0; loeftMaal = 0; skjultTo = 0; nyMaade = -1;
    bladPile = [];
    for (var i = 0; i < 11; i++) {
      var v = Math.random() * Math.PI * 2, r = i === 0 ? 0 : 0.25 + Math.random() * 0.5;
      bladPile.push({ x: Math.cos(v) * r, y: Math.sin(v) * r, v: Math.random() * 6.3, s: 0.55 + Math.random() * 0.25, f: ['#93bc63', '#5f8240', '#e08a52', '#f0c46a', '#b18a56'][i % 5] });
    }
    if (q.leg === 'ryst') {
      fase = 'klar'; noed = [];
      for (var k = 0; k < q.hel; k++) noed.push(iStubbe(L.egon.x, L.egon.y - L.egon.h * 0.3));
      if (foerste) stemme.sig(E.spoergTekst(q, true));
      return;
    }
    fase = q.selv ? 'gemmer' : 'ind';
    noed = maal().map(function (p) { return { x: p.x, y: p.y }; });
    if (q.leg === 'se') { if (foerste) stemme.sig(E.spoergTekst(q, true)); }
    else if (q.selv) stemme.sig(foerste ? E.spoergTekst(q) : E.TEKST.gemToStart);
    else stemme.sig(E.egonHar(q.hel));
  }
  /** Ryst og haeld: Egon kaster, og det er naeste spillers tur. */
  function kast() {
    E.kast(q); fase = 'kast'; ft = 0; forkerte = 0; rigtigKort = -1; visDele = false; nyMaade = -1; vip = {};
    q.spiller = spillere === 2 ? tur : 0;
    noed.forEach(function (n) { n.x = (L.egon.x - L.cx) / L.R + (Math.random() - 0.5) * 0.2; n.y = (L.egon.y - L.egon.h * 0.4 - L.cy) / L.R; });
    LYDE.kast();
  }

  function vaelg(k) {
    if (fase !== 'svar') return;
    var x = q.svar[k];
    if (E.svar(q, x)) {
      rigtigKort = k; fase = 'rigtig'; ft = 0; LYDE.rigtig();
      bladeMaal = 1; loeftMaal = 1; visDele = true;
      if (q.leg === 'ryst') {
        var ny = E.fundet(q); nyMaade = q.iReden;
        if (!ny) { stemme.sig(E.rigtigTekst(q) + ' ' + E.TEKST.rystIgen); fase = 'kendt'; }
        else if (E.alleFundet(q)) { LYDE.ny(); stemme.sig(E.rigtigTekst(q) + ' ' + E.TEKST.rystAlle); fase = 'alle'; }
        else { LYDE.ny(); stemme.sig(E.rigtigTekst(q)); }
      } else stemme.sig(E.rigtigTekst(q));
    } else {
      forkerte++; vip[k] = 0.5; LYDE.nej();
      if (q.leg === 'se') {
        // Vis dem igen; anden gang med delene i farver, og saa bliver de liggende
        stemme.sig(E.tal(x) + ' ' + E.TEKST.kigIgen);
        if (forkerte >= 2) visDele = true;
        kig(forkerte >= 2 ? 99 : q.vis + 0.4);
      } else {
        stemme.sig(E.TEKST.proevIgen);
        if (forkerte >= 2) { loeftMaal = 0.45; visDele = true; }   // bladet loefter sig lidt, saa man kan kigge ind
      }
    }
  }
  /** Se hurtigt: vis noedderne i sek sekunder (99: til svaret er fundet). */
  function kig(sek) { bladeMaal = 1; kigTil = tid + 0.35 + sek; LYDE.sus(); }
  function oejeKnap() { return { x: L.cx + 0.46 * L.R, y: L.cy + 0.72 * L.R, r: Math.max(26, L.R * 0.16) }; }

  function tryk(e) {
    if (tilstand !== 'spil' || !q) return;
    var x = e.clientX, y = e.clientY, p = iStubbe(x, y);
    kortene().forEach(function (k, i) { if (x > k.x - 6 && x < k.x + k.b + 6 && y > k.y - 6 && y < k.y + k.h + 6) vaelg(i); });
    if (q.leg === 'se' && fase === 'svar' && Math.hypot(p.x, p.y) < 1 && bladeMaal === 0) kig(q.vis);   // se dem igen
    if (q.leg === 'gem' && !q.selv && fase === 'svar' && Math.hypot(p.x - 0.46, p.y) < 0.5) { vip.blad = 0.5; LYDE.sus(); }
    if (q.leg === 'ryst' && fase === 'klar' && Math.abs(x - L.egon.x) < L.egon.h * 0.45 && y > L.egon.y - L.egon.h && y < L.egon.y + 20) kast();
    if (q.selv && fase === 'gemmer') {
      var o = oejeKnap();
      if (skjultTo > 0 && Math.hypot(x - o.x, y - o.y) < o.r * 1.3) {
        // Faerdig: den anden kigger og gaetter
        E.gemt(q, skjultTo); fase = 'svar'; ft = 0; LYDE.klik();
        stemme.sig(E.TEKST.kigNu + ' ' + E.TEKST.gemSpoerg);
      } else if (p.x < 0 && Math.hypot(p.x, p.y) < 0.95 && skjultTo < q.hel - 1) { skjultTo++; LYDE.klik(); }       // en noed ind under bladet
      else if (p.x > 0 && Math.hypot(p.x, p.y) < 0.95 && skjultTo > 0) { skjultTo--; LYDE.klik(); }                  // en ud igen
    }
  }

  function opdater(dt) {
    ft += dt;
    blade += Math.max(-dt * 3.2, Math.min(dt * 3.2, bladeMaal - blade));
    loeft += Math.max(-dt * 2.5, Math.min(dt * 2.5, loeftMaal - loeft));
    Object.keys(vip).forEach(function (k) { vip[k] -= dt; if (vip[k] <= 0) delete vip[k]; });
    flyv.forEach(function (f) { f.t += dt; });
    flyv = flyv.filter(function (f) { if (f.t >= 0.7) { kurv++; LYDE.kurv(); return false; } return true; });
    if (!q) return;
    // Noedderne glider mod deres pladser
    var m = maal(), fart = q.leg === 'ryst' && fase === 'kast' ? 5 : 7;
    noed.forEach(function (n, i) { if (m[i]) { n.x += (m[i].x - n.x) * Math.min(1, dt * fart); n.y += (m[i].y - n.y) * Math.min(1, dt * fart); } });
    if (q.leg === 'se') {
      if (fase === 'ind' && ft > 1.0 && bladeMaal === 0) { kig(q.vis); fase = 'kig'; ft = 0; }
      if (fase === 'kig' && tid > kigTil) { bladeMaal = 0; fase = 'svar'; ft = 0; LYDE.sus(); if (qi > 0) stemme.koe(E.TEKST.seSpoerg); }
      if (fase === 'svar' && bladeMaal === 1 && tid > kigTil) { bladeMaal = 0; LYDE.sus(); }
    } else if (q.leg === 'gem' && !q.selv) {
      if (fase === 'ind' && ft > 1.9) { fase = 'del'; ft = 0; }
      if (fase === 'del' && ft > 1.0) { fase = 'svar'; ft = 0; stemme.koe(E.TEKST.gemSkjul + ' ' + E.TEKST.gemSpoerg); LYDE.sus(); }
    } else if (q.leg === 'ryst') {
      if (fase === 'kast' && ft > 0.9) { fase = 'svar'; ft = 0; stemme.koe(E.TEKST.rystSpoerg); }
      if ((fase === 'rigtig' || fase === 'kendt') && ft > (fase === 'kendt' ? 3.6 : 3.0)) {
        // Noedderne hopper tilbage til Egon, og det er naeste spillers tur
        fase = 'klar'; ft = 0; tur = spillere === 2 ? 1 - tur : 0; q.spiller = tur;
      }
      if (fase === 'alle' && ft > 3.4) { fase = 'slut'; q.tom = true; LYDE.faerdig(); setTimeout(afslut, 1800); }
      return;
    }
    if (fase === 'rigtig' && ft > 2.6 && ft - dt <= 2.6) {
      // Noedderne flyver op i Egons kurv
      noed.forEach(function (n, i) { flyv.push({ x: L.cx + n.x * L.R, y: L.cy + n.y * L.R, t: -i * 0.06 }); });
      q.tom = true;
    }
    if (fase === 'rigtig' && ft > 3.6) {
      qi++;
      if (qi >= runde.length) { fase = 'slut'; q = null; stemme.koe(E.TEKST.faerdig); LYDE.faerdig(); setTimeout(afslut, 3200); return; }
      nytSpoergsmaal(false);
    }
  }

  /* ---------- tegning ---------- */
  function tegnNoed(x, y, d, glød) {
    if (glød) { ctx.fillStyle = glød; ctx.globalAlpha *= 0.55; ctx.beginPath(); ctx.arc(x, y, d * 0.66, 0, 7); ctx.fill(); ctx.globalAlpha /= 0.55; }
    if (klar(noedBillede)) ctx.drawImage(noedBillede, x - d / 2, y - d / 2, d, d);
    else { ctx.fillStyle = '#b18a56'; ctx.beginPath(); ctx.arc(x, y, d * 0.42, 0, 7); ctx.fill(); }
  }
  /** Et blad: spids i begge ender og en midtribbe. bred er bladets bredde i forhold til laengden. */
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
    // Den der gemmer, har sin farve om stubben
    ctx.strokeStyle = q && q.selv && fase === 'gemmer' ? FARVER[q.gemmer] : '#6b5545'; ctx.lineWidth = q && q.selv && fase === 'gemmer' ? 7 : 3;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.9, 0, 7); ctx.stroke();
    // Stubben er helheden; stregen deler den i to dele
    if (q && (q.leg === 'ryst' || (q.leg === 'gem' && fase !== 'ind'))) {
      ctx.strokeStyle = 'rgba(94,74,58,.45)'; ctx.lineWidth = 4; ctx.setLineDash([10, 10]);
      ctx.beginPath(); ctx.moveTo(cx, cy - R * 0.86); ctx.lineTo(cx, cy + R * 0.86); ctx.stroke(); ctx.setLineDash([]);
    }
    // Ryst og haeld: reden paa venstre halvdel
    if (q && q.leg === 'ryst') {
      var rx = cx - 0.46 * R;
      ctx.fillStyle = '#b18a56'; ctx.beginPath(); ctx.ellipse(rx, cy, R * 0.36, R * 0.34, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#d9ba8a'; ctx.beginPath(); ctx.ellipse(rx, cy, R * 0.28, R * 0.26, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#8a663d'; ctx.lineWidth = 2;
      for (var k = 0; k < 14; k++) { var v = k / 14 * Math.PI * 2; ctx.beginPath(); ctx.arc(rx + Math.cos(v) * R * 0.32, cy + Math.sin(v) * R * 0.3, R * 0.07, v, v + 2.2); ctx.stroke(); }
    }
    // Se hurtigt: femmer- og tierrammens tomme pladser
    if (q && q.leg === 'se' && q.ramme) {
      var s = q.felt, pl = q.ramme === 5 ? E.femmerramme(5, s) : E.tierramme(10, s);
      ctx.strokeStyle = 'rgba(138,102,61,.4)'; ctx.lineWidth = 2;
      pl.forEach(function (p) { rr(cx + (p.x - s / 2) * R, cy + (p.y - s / 2) * R, s * R, s * R, 6); ctx.stroke(); });
    }
  }
  function tegnEgon() {
    var e = L.egon;
    if (klar(egon)) { var b = e.h * egon.naturalWidth / egon.naturalHeight; ctx.drawImage(egon, e.x - b / 2, e.y - e.h, b, e.h); }
    // Ryst og haeld: Egon hopper lidt, naar han vil kaste
    if (q && q.leg === 'ryst' && fase === 'klar') {
      var a = 0.4 + Math.sin(tid * 4) * 0.3;
      ctx.strokeStyle = spillere === 2 ? FARVER[tur] : 'rgba(240,196,106,' + a.toFixed(2) + ')'; ctx.globalAlpha = spillere === 2 ? a + 0.3 : 1; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(e.x, e.y - e.h * 0.45, e.h * 0.42, e.h * 0.55, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    }
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
  /** Noedder i et kort: terning til og med fem, fra seks tierramme med tomme pladser, saa 6-10 ses som fem og lidt. */
  function tegnAntal(n, cx, cy, b, h) {
    var s = Math.min(b, h), d, pos;
    if (n <= 5) { d = s * 0.28; pos = E.terning(n, s * 0.29); }
    else {
      d = Math.min(b / 6.2, h / 3.2); pos = E.tierramme(n, d * 1.12);
      E.tierramme(10, d * 1.12).forEach(function (p) { ctx.strokeStyle = 'rgba(138,102,61,.3)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(cx + p.x, cy + p.y, d * 0.42, 0, 7); ctx.stroke(); });
    }
    pos.forEach(function (p) { tegnNoed(cx + p.x, cy + p.y, d); });
  }
  function tegnKort() {
    if (!q || ['svar', 'rigtig', 'kendt', 'alle'].indexOf(fase) < 0) return;
    var farve = spillere === 2 ? FARVER[q.spiller] : null;
    kortene().forEach(function (k, i) {
      var dx = vip[i] ? Math.sin(vip[i] * 40) * 6 : 0, ude = fase !== 'svar' && i !== rigtigKort;
      ctx.globalAlpha = ude ? 0.35 : 1;
      ctx.fillStyle = 'rgba(107,85,68,.18)'; rr(k.x + dx, k.y + 5, k.b, k.h, 18); ctx.fill();
      rr(k.x + dx, k.y, k.b, k.h, 18, PAPIR);
      if (farve) { ctx.strokeStyle = farve; ctx.lineWidth = 4; ctx.stroke(); }
      if (fase !== 'svar' && i === rigtigKort) { ctx.strokeStyle = '#93bc63'; ctx.lineWidth = 7; rr(k.x + dx, k.y, k.b, k.h, 18); ctx.stroke(); }
      tegnAntal(q.svar[i], k.x + dx + k.b / 2, k.y + k.h / 2, k.b * 0.82, k.h * 0.8);
      ctx.globalAlpha = 1;
    });
  }
  /** Ryst og haeld: tavlen med alle maader at dele tallet paa, som en trappe. De fundne i farver, resten som skygger. */
  function tegnTavle() {
    if (!q || q.leg !== 'ryst') return;
    var T = L.tavle, n = q.hel - 1, rh = Math.min(T.h / n, 40), d = Math.min(rh * 0.8, (T.b - 16) / (q.hel + 0.8));
    rr(T.x, T.y, T.b, rh * n + 14, 14, 'rgba(248,241,230,.85)');
    for (var i = 1; i <= n; i++) {
      var y = T.y + 7 + (i - 0.5) * rh, fundet = q.fundet.indexOf(i) >= 0, ny = nyMaade === i && fase !== 'klar';
      if (ny) { rr(T.x + 3, y - rh / 2 + 1, T.b - 6, rh - 2, 10, 'rgba(240,196,106,.55)'); }
      for (var k = 0; k < q.hel; k++) {
        var x = T.x + 8 + d * 0.5 + k * d + (k >= i ? d * 0.8 : 0);
        if (!fundet) { ctx.strokeStyle = 'rgba(138,102,61,.28)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, d * 0.36, 0, 7); ctx.stroke(); continue; }
        ctx.fillStyle = DEL[k < i ? 0 : 1]; ctx.beginPath(); ctx.arc(x, y, d * 0.4, 0, 7); ctx.fill();
      }
    }
  }
  function tegnSpil() {
    var W = window.innerWidth;
    // omgangens taeller: cirkler, ikke tal. I Ryst og haeld: én pr. maade at dele paa
    var antal = q && q.leg === 'ryst' ? q.hel - 1 : runde.length, fyldt = q && q.leg === 'ryst' ? q.fundet.length : qi + (fase === 'rigtig' ? 1 : 0);
    for (var i = 0; i < antal; i++) {
      ctx.beginPath(); ctx.arc(W / 2 - (antal - 1) * 13 + i * 26, 26, 8, 0, 7);
      ctx.fillStyle = i < fyldt ? GUL : 'rgba(248,241,230,.75)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke();
    }
    tegnStubbe();
    tegnTavle();
    if (q && !q.tom) {
      var d = noedStr() * L.R * 1.25, farvet = visDele && (q.leg !== 'se' || !!q.dele);
      noed.forEach(function (n, i) {
        if (gemtNoed(i) && !(loeft > 0.2)) return;       // under bladet ses de gemte kun, naar det loefter sig
        var del = delAf(i), glød = farvet && del >= 0 ? DEL[del] : (fase !== 'svar' && fase !== 'kig' && visDele && q.leg === 'se' ? GUL : null);
        tegnNoed(L.cx + n.x * L.R, L.cy + n.y * L.R, d, glød);
      });
      // Gemmeleg: bladet over de gemte
      if (q.leg === 'gem' && fase !== 'ind') {
        var bv = vip.blad ? Math.sin(vip.blad * 30) * 0.08 : 0, lx = L.cx + 0.46 * L.R + loeft * L.R * 0.5, ly = L.cy - loeft * L.R * 0.55;
        tegnBlad(lx, ly, L.R * 0.56, -0.3 + bv - loeft * 0.9, '#93bc63', fase === 'del' ? Math.min(1, ft * 2) : 1 - Math.max(0, loeft - 0.5) * 1.6, 0.95);
      }
      // To spillere: oejet, der trykkes paa, naar noedderne er gemt
      if (q.selv && fase === 'gemmer' && skjultTo > 0) {
        var o = oejeKnap();
        ctx.fillStyle = '#8fae86'; ctx.beginPath(); ctx.arc(o.x, o.y, o.r, 0, 7); ctx.fill(); ctx.strokeStyle = PAPIR; ctx.lineWidth = 3; ctx.stroke();
        ctx.fillStyle = PAPIR; ctx.beginPath(); ctx.ellipse(o.x, o.y, o.r * 0.62, o.r * 0.36, 0, 0, 7); ctx.fill();
        ctx.fillStyle = KANT; ctx.beginPath(); ctx.arc(o.x, o.y, o.r * 0.2, 0, 7); ctx.fill();
      }
    }
    // Se hurtigt: bunken af blade over stubben
    if (q && q.leg === 'se' && blade < 1) {
      bladPile.forEach(function (b) {
        var ud = blade * L.R * 1.7, v = Math.atan2(b.y || 0.3, b.x || 0.4);
        tegnBlad(L.cx + b.x * L.R + Math.cos(v) * ud, L.cy + b.y * L.R + Math.sin(v) * ud, b.s * L.R, b.v + blade * 2, b.f, 1 - blade);
      });
    }
    tegnEgon();
    flyv.forEach(function (f) {
      if (f.t < 0) { tegnNoed(f.x, f.y, 0.18 * L.R * 1.25); return; }
      var u = Math.min(1, f.t / 0.7), e = L.egon, tx = e.x - e.h * 0.05, ty = e.y - e.h * 0.25;
      tegnNoed(f.x + (tx - f.x) * u, f.y + (ty - f.y) * u - Math.sin(u * Math.PI) * L.R * 0.5, 0.18 * L.R * (1.25 - u * 0.6));
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
  var LEG_NAVN = { se: 'Se hurtigt', gem: 'Gemmeleg', ryst: 'Ryst og hæld' };
  function visMenu() {
    tilstand = 'menu'; q = null;
    stemme.tie();
    visOverlay('<div class="kort">' + EGON_IMG + '<h2>Egernreden</h2>' +
      '<div class="raekke lege">' + E.LEGE.map(function (l) {
        return '<button class="knap ikon' + (l === leg ? ' valgt' : '') + '" data-handling="leg" data-leg="' + l + '" aria-label="' + LEG_NAVN[l] + '"><canvas width="220" height="150" data-leg="' + l + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) + Menu.startRaekke('start') + Menu.lydRaekke(lydTil) + '</div>');
    tegnLegIkoner();
  }
  /** Legenes knapper: noedder mellem blade (se hurtigt), et blad over nogle af dem (gemmeleg), en rede med noedder i og udenfor (ryst og haeld). */
  function tegnLegIkoner() {
    overlay.querySelectorAll('canvas[data-leg]').forEach(function (cv) {
      var c = cv.getContext('2d'), w = cv.width, h = cv.height, l = cv.dataset.leg, gem = ctx;
      c.clearRect(0, 0, w, h);
      c.fillStyle = l === leg ? '#aed3e4' : '#e5d3ae'; c.beginPath(); c.roundRect(0, 0, w, h, 18); c.fill();
      ctx = c;   // de samme tegnefunktioner, paa knappen
      if (l === 'se') {
        E.terning(4, 26).forEach(function (p) { tegnNoed(w / 2 + p.x, h / 2 + p.y, 40); });
        tegnBlad(w * 0.2, h * 0.3, 34, 0.6, '#93bc63', 1); tegnBlad(w * 0.82, h * 0.72, 34, -0.8, '#e08a52', 1); tegnBlad(w * 0.8, h * 0.25, 28, 2.4, '#f0c46a', 1);
      } else if (l === 'gem') {
        E.terning(3, 20).forEach(function (p) { tegnNoed(w * 0.3 + p.x, h / 2 + p.y, 34); });
        tegnBlad(w * 0.7, h / 2, 50, -0.4, '#93bc63', 1, 0.95);
      } else {
        c.fillStyle = '#b18a56'; c.beginPath(); c.ellipse(w * 0.33, h * 0.55, 52, 40, 0, 0, 7); c.fill();
        c.fillStyle = '#d9ba8a'; c.beginPath(); c.ellipse(w * 0.33, h * 0.55, 40, 29, 0, 0, 7); c.fill();
        E.terning(3, 15).forEach(function (p) { tegnNoed(w * 0.33 + p.x, h * 0.55 + p.y, 28); });
        E.terning(2, 16).forEach(function (p) { tegnNoed(w * 0.76 + p.x, h * 0.55 + p.y, 28); });
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
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); layout(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); layout(); start(); }
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
  // Hver finger for sig (pointerdown, ikke click), saa to boern ikke spaerrer for hinanden
  lærred.addEventListener('pointerdown', function (e) { e.preventDefault(); layout(); tryk(e); }, { passive: false });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  /** Til testen i browseren: kortene, det rigtige svar, Egon, oejet og stubben. */
  window.__debug = function () {
    layout();
    var o = q && q.selv ? oejeKnap() : null;
    return {
      tilstand: tilstand, leg: leg, svaerhed: svaerhed, spillere: spillere, fase: fase, qi: qi, antal: runde.length, kurv: kurv, visDele: visDele,
      q: q ? { leg: q.leg, svar: q.svar, rigtig: q.rigtig, antal: q.antal, hel: q.hel, synlig: q.synlig, skjult: q.skjult, spiller: q.spiller, selv: !!q.selv, gemmer: q.gemmer, dele: q.dele, fundet: q.fundet, iReden: q.iReden } : null,
      skjultTo: skjultTo,
      kort: kortene().map(function (k) { return { x: Math.round(k.x + k.b / 2), y: Math.round(k.y + k.h / 2) }; }),
      stubbe: { x: Math.round(L.cx), y: Math.round(L.cy), r: Math.round(L.R) },
      egon: { x: Math.round(L.egon.x), y: Math.round(L.egon.y - L.egon.h * 0.5) },
      oeje: o ? { x: Math.round(o.x), y: Math.round(o.y) } : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
