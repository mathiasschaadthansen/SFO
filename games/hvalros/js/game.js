/**
 * Isvigen: Hvalrossen Helle paa sit isflag. Logikken ligger i helle.js.
 *
 * Foerst isflagerne: Pelle staar paa kysten til venstre, Helle ligger ude paa
 * sit store isflag til hoejre, og imellem er der fem tomme pladser. Helle
 * brummer et ord i lyde, og tre isflager med billeder vugger nederst. Den, der
 * passer, glider op paa den naeste plads, og Pelle hopper ud paa den. Et forkert
 * tryk faar flagen til at vippe, og Helle brummer ordet igen. Ingen straf.
 *
 * Saa flaskeposten: en flaske flyder ind, og sedlen foldes ud midt paa
 * skaermen. Et tryk paa et ord faar Helle til at lydere det og sige det. Med
 * én og to stjerner vaelger man billedet; med tre traekker man tingen hen til
 * Helle, Pelle eller isflagen.
 *
 * Mangler et klip i lyd/, siger enhedens egen stemme det (js/stemme.js).
 * Ingen tid, ingen point og intet, der gemmes.
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

  var H = window.Helle;
  var laerred = document.getElementById('spil');
  var ctx = laerred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', KNAP = '#efe3d0', GUL = '#f0c46a', ROED = '#d95f45', BLAA = '#5f9fc9';

  var tilstand = 'menu', svaerhed = 0, lydTil = true;
  var tid = 0, sidsteTid = 0;
  var del = 'flager';                    // 'flager' eller 'post'
  var flager = [], fi = 0, q = null;     // isflagernes ord og det nuvaerende
  var pelle = -1, pelleFra = -1, hop = 1; // Pelles plads: -1 kysten, 0-4 flagerne, 5 Helles flag
  var lagt = 0;                          // isflager paa plads
  var vip = {}, glid = null, laast = false;
  var lys = -1, lysTil = 0;              // bogstavet, der lyser, mens Helle brummer (to stjerner)
  var sedler = [], si = 0, s = null, flaske = 0, foldet = 0, traek = null, givet = null;

  /* ---------- billeder ---------- */
  function billede(sti) { var i = new Image(); i.src = sti; return i; }
  function klar(i) { return i && i.complete && i.naturalWidth > 0; }
  var HELLE = billede('billeder/helle.png');
  var PELLE = billede('../maskinen/billeder/pindsvin.png');
  var BILLEDER = {};
  Object.keys(H.FORM).forEach(function (o) { var t = H.ting(o); if (t && t.billede) BILLEDER[o] = billede(t.billede); });

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
    klik: function () { tone(660, 0.05, 0.04); },
    rigtig: function () { melodi([660, 880, 1100], 90); },
    nej: function () { tone(262, 0.12, 0.05); tone(247, 0.12, 0.04, 0.09); },
    plask: function () { for (var i = 0; i < 5; i++) tone(300 + Math.random() * 300, 0.08, 0.03, i * 0.03, 'sine'); },
    hop: function () { tone(523, 0.08, 0.06); tone(784, 0.1, 0.06, 0.08); },
    faerdig: function () { melodi([523, 659, 784, 1047, 1319], 110); }
  };
  document.addEventListener('pointerdown', startLyd, true);
  var stemme = Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.85 });
  var taleGen = 0;
  /** Kan noget hoeres? Lyden er slaaet til, og der er klip eller en stemme paa enheden. */
  function kanTale() { return lydTil && !!lyd && (stemme.antalKlip() > 0 || !!stemme.stemme()); }
  /**
   * Sig flere ting i traek: tekst eller { klip } (Bogstavvejens ordklip). Afbrydes af det, der siges bagefter.
   * En vagt sender spillet videre, hvis intet kan hoeres eller enhedens stemme glemmer at sige, at den er faerdig,
   * saa spillet aldrig gaar i staa uden lyd.
   */
  function sig(trin, faerdig) {
    if (!Array.isArray(trin)) trin = [trin];
    var g = ++taleGen, i = 0;
    stemme.tie();
    (function naeste() {
      if (g !== taleGen) return;
      if (i >= trin.length) { if (faerdig) faerdig(); return; }
      var t = trin[i++], tekst = typeof t === 'string' ? t : t.reserve, sket = false;
      var videre = function () { if (sket) return; sket = true; clearTimeout(vagt); naeste(); };
      var vagt = setTimeout(videre, kanTale() ? 2500 + tekst.length * 110 : 500 + tekst.length * 45);
      if (typeof t === 'string') stemme.sig(t, videre);
      else spilKlip(t.klip, t.reserve, videre);
    })();
  }
  function tie() { taleGen++; stemme.tie(); }
  var buffere = {};
  /** Et ordklip fra Bogstavvejen ("Her har du ordet sol."). Mangler det, siger enhedens stemme reserven. */
  function spilKlip(sti, reserve, faerdig) {
    var g = taleGen;
    if (!lyd || !lydTil || !sti) { stemme.sig(reserve, faerdig); return; }
    if (!buffere[sti]) buffere[sti] = fetch(sti).then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
      .then(function (ab) { return new Promise(function (ok, nej) { lyd.decodeAudioData(ab, ok, nej); }); });
    buffere[sti].then(function (buf) {
      if (g !== taleGen) return;
      var k = lyd.createBufferSource(); k.buffer = buf; k.connect(lyd.destination); k.start();
      k.onended = function () { if (g === taleGen && faerdig) faerdig(); };
    }).catch(function () { delete buffere[sti]; if (g === taleGen) stemme.sig(reserve, faerdig); });
  }
  function ordKlip(o) { var t = H.ting(o); return { klip: t && t.klip, reserve: 'Her har du ordet ' + o + '.' }; }

  /* ---------- skaermen ---------- */
  var L = null;
  function tilpas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    laerred.width = Math.floor(window.innerWidth * dpr); laerred.height = Math.floor(window.innerHeight * dpr);
    laerred.style.width = window.innerWidth + 'px'; laerred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    L = null;
  }
  /** Himlen og havet, kysten til venstre, Helles flag til hoejre, pladserne imellem og valgene forneden. Venstre kant er fri til knapperne. */
  function layout() {
    if (L) return L;
    var W = window.innerWidth, Hh = window.innerHeight, VEN = 72;
    var hav = Hh * 0.36, sti = Hh * 0.5;
    var kyst = VEN + Math.min(90, W * 0.08);
    var helle = { x: W - Math.min(170, W * 0.17), y: sti, b: Math.min(230, W * 0.24) };
    var fra = kyst + 40, til = helle.x - helle.b * 0.55, pl = [];
    for (var i = 0; i < H.ISFLAGER; i++) pl.push({ x: fra + (til - fra) * (i + 0.5) / H.ISFLAGER, y: sti + Math.sin(i * 1.3) * Hh * 0.012 });
    var fb = Math.min((til - fra) / H.ISFLAGER * 0.92, 130);
    var vb = Math.min(200, (W - VEN - 60) / 3 - 24), vh = Math.min(vb * 0.78, Hh * 0.24);
    var valg = [0, 1, 2].map(function (k) { return { x: VEN + (W - VEN) / 2 + (k - 1) * (vb + 26), y: Hh - vh / 2 - 18, b: vb, h: vh }; });
    L = { W: W, H: Hh, VEN: VEN, hav: hav, sti: sti, kyst: kyst, helle: helle, pladser: pl, fb: fb, valg: valg,
          hoejttaler: { x: W - 44, y: 44, r: 30 }, boble: { x: VEN + (W - VEN) * 0.42, y: Hh * 0.17 } };
    return L;
  }
  function rr(x, y, b, h, r, fyld, kant, lw) {
    ctx.beginPath(); ctx.roundRect(x, y, b, h, r);
    if (fyld) { ctx.fillStyle = fyld; ctx.fill(); }
    if (kant) { ctx.strokeStyle = kant; ctx.lineWidth = lw || 2; ctx.stroke(); }
  }
  function skrift(str, vaegt) { return (vaegt || 800) + ' ' + Math.round(str) + 'px ui-rounded,"SF Pro Rounded",system-ui,-apple-system,sans-serif'; }

  function tegnBaggrund() {
    var W = L.W, Hh = L.H;
    var g = ctx.createLinearGradient(0, 0, 0, L.hav);
    g.addColorStop(0, '#cfe3ee'); g.addColorStop(1, '#f3ebe0');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, L.hav);
    // Fjerne isbjerge i horisonten
    ctx.fillStyle = '#eef5f8';
    [[0.18, 0.06], [0.42, 0.045], [0.7, 0.07], [0.9, 0.05]].forEach(function (b) {
      ctx.beginPath(); ctx.moveTo(W * (b[0] - 0.07), L.hav); ctx.lineTo(W * (b[0] - 0.02), L.hav - Hh * b[1]); ctx.lineTo(W * (b[0] + 0.03), L.hav - Hh * b[1] * 0.7); ctx.lineTo(W * (b[0] + 0.08), L.hav); ctx.fill();
    });
    var h = ctx.createLinearGradient(0, L.hav, 0, Hh);
    h.addColorStop(0, '#aed3e4'); h.addColorStop(1, '#5f9fc9');
    ctx.fillStyle = h; ctx.fillRect(0, L.hav, W, Hh - L.hav);
    // Smaa boelger
    ctx.strokeStyle = 'rgba(248,241,230,.45)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (var r = 0; r < 7; r++) {
      var y = L.hav + 18 + r * (Hh - L.hav) / 7, sk = (tid * 12 + r * 47) % 80;
      for (var x = -80 + sk; x < W; x += 140) { ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 14, y - 5, x + 28, y); ctx.stroke(); }
    }
    // Kysten til venstre: sne og is
    ctx.fillStyle = '#f8f6f2';
    ctx.beginPath(); ctx.moveTo(0, L.hav - 6); ctx.lineTo(L.kyst - 10, L.hav + 4); ctx.quadraticCurveTo(L.kyst + 30, L.sti, L.kyst - 4, Hh);
    ctx.lineTo(0, Hh); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d7e7ef'; ctx.lineWidth = 4; ctx.stroke();
  }

  /** En isflage med top og en blaa kant under vandet. */
  function isflage(x, y, b, vipVinkel, fyld) {
    var h = b * 0.36;
    ctx.save(); ctx.translate(x, y); ctx.rotate(vipVinkel || 0);
    ctx.fillStyle = 'rgba(95,159,201,.35)'; ctx.beginPath(); ctx.ellipse(0, h * 0.42, b * 0.54, h * 0.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#d3e8f1'; ctx.beginPath(); ctx.ellipse(0, h * 0.18, b * 0.5, h * 0.48, 0, 0, 7); ctx.fill();
    ctx.fillStyle = fyld || '#fbfdfe'; ctx.beginPath(); ctx.ellipse(0, 0, b * 0.5, h * 0.42, 0, 0, 7); ctx.fill();
    ctx.restore();
  }
  function tegnBillede(o, x, y, str) {
    var i = BILLEDER[o];
    if (klar(i)) { var k = str / Math.max(i.naturalWidth, i.naturalHeight); ctx.drawImage(i, x - i.naturalWidth * k / 2, y - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k); }
    else { ctx.fillStyle = KANT; ctx.font = skrift(str * 0.3); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(o, x, y); }
  }
  /** Helle: det malede billede, eller en rund hvalros tegnet i kode, til billedet er malet. */
  function tegnHelle(x, y, b) {
    if (klar(HELLE)) { var k = b / HELLE.naturalWidth; ctx.drawImage(HELLE, x - b / 2, y - HELLE.naturalHeight * k * 0.92, b, HELLE.naturalHeight * k); return; }
    var hv = b * 0.5, brum = q && !laast ? Math.sin(tid * 6) * 0.03 : 0;
    ctx.save(); ctx.translate(x, y - hv * 0.55);
    ctx.fillStyle = '#9c7a63'; ctx.beginPath(); ctx.ellipse(0, hv * 0.25, hv * 0.95, hv * 0.62, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(-hv * 0.35, -hv * 0.25, hv * 0.48, hv * (0.44 + brum), 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#b8957c'; ctx.beginPath(); ctx.ellipse(-hv * 0.5, -hv * 0.12, hv * 0.26, hv * 0.17, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fffaf2'; [-0.6, -0.4].forEach(function (dx) { ctx.beginPath(); ctx.moveTo(hv * dx - hv * 0.04, -hv * 0.02); ctx.lineTo(hv * dx, hv * 0.26); ctx.lineTo(hv * dx + hv * 0.04, -hv * 0.02); ctx.fill(); });
    ctx.fillStyle = KANT; [-0.56, -0.2].forEach(function (dx) { ctx.beginPath(); ctx.arc(hv * dx, -hv * 0.38, hv * 0.05, 0, 7); ctx.fill(); });
    ctx.fillStyle = 'rgba(217,95,69,.35)'; ctx.beginPath(); ctx.arc(-hv * 0.12, -hv * 0.18, hv * 0.08, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6a55'; ctx.beginPath(); ctx.ellipse(-hv * 0.7, hv * 0.62, hv * 0.28, hv * 0.11, 0.3, 0, 7); ctx.fill();
    ctx.restore();
  }
  function tegnPelle(x, y, h) {
    if (klar(PELLE)) { var k = h / PELLE.naturalHeight; ctx.drawImage(PELLE, x - PELLE.naturalWidth * k / 2, y - h, PELLE.naturalWidth * k, h); return; }
    ctx.fillStyle = '#8a663d'; ctx.beginPath(); ctx.ellipse(x, y - h * 0.4, h * 0.35, h * 0.4, 0, 0, 7); ctx.fill();
  }
  /** Hvor Pelle staar paa plads p (-1 kysten, 5 Helles flag). */
  function pellePlads(p) {
    if (p < 0) return { x: L.kyst - 14, y: L.sti };
    if (p >= H.ISFLAGER) return { x: L.helle.x - L.helle.b * 0.62, y: L.helle.y };
    return L.pladser[p];
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

  /* ---------- bogstaverne i boblen og ordene paa sedlen ---------- */
  var felter = [];   // trykbare bogstaver eller ord: { x, y, b, h, tekst }
  /** En raekke trykbare felter (bogstaver eller ord), centreret om cx. Svarer med felterne. */
  function feltRaekke(dele, cx, cy, str, lysNr, mellemrum) {
    ctx.font = skrift(str);
    var b = dele.map(function (d) { return ctx.measureText(d).width + str * 0.5; }), sum = b.reduce(function (a, v) { return a + v; }, 0) + (dele.length - 1) * mellemrum;
    var x = cx - sum / 2, ud = [];
    dele.forEach(function (d, i) {
      var f = { x: x, y: cy - str * 0.72, b: b[i], h: str * 1.44, tekst: d };
      rr(f.x, f.y, f.b, f.h, str * 0.28, i === lysNr ? GUL : 'rgba(239,227,208,.75)');
      ctx.fillStyle = KANT; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d, f.x + f.b / 2, cy + str * 0.04);
      ud.push(f); x += b[i] + mellemrum;
    });
    return ud;
  }

  /* ================= isflagerne ================= */

  /** Et tidsskridt, der glemmes, hvis man er gaaet til menuen eller er startet forfra imens. */
  var omgang = 0;
  function senere(fn, ms) { var o = omgang; setTimeout(function () { if (o === omgang && tilstand === 'spil') fn(); }, ms); }

  function startFlager() {
    omgang++; efterHop = null; glid = null; vip = {};
    del = 'flager'; flager = H.isflager(svaerhed); fi = 0; pelle = -1; pelleFra = -1; hop = 1; lagt = 0;
    tilstand = 'spil'; laast = true;
    sig(H.TEKST.hej, function () { nytOrd(); });
  }
  function nytOrd() {
    q = flager[fi]; vip = {}; glid = null; laast = false; lys = -1; lysTil = 0;
    if (q.laesSelv) sig(H.TEKST.laesSelv);
    else brum();
  }
  /** Helle brummer ordet. Med to stjerner lyser bogstaverne ét ad gangen undervejs. */
  function brum() {
    if (!q) return;
    sig([H.TEKST.lyt, q.brum, H.TEKST.hvilket]);
    if (q.visBogstaver && !q.laesSelv) { lys = -1; lysTil = tid + 1.2; }
  }
  /** Venter paa n ting (fx stemmen og et hop), foer det naeste sker. */
  function naarAlle(n, fn) { return function () { if (--n === 0) fn(); }; }
  var efterHop = null;
  function trykFlager(x, y) {
    if (laast || !q) return;
    var k = L.hoejttaler;
    if (Math.hypot(x - k.x, y - k.y) < k.r + 10) { LYDE.klik(); brum(); return; }
    // Tre stjerner: et tryk paa et bogstav siger dets lyd
    for (var f = 0; f < felter.length; f++) {
      var fl = felter[f];
      if (x >= fl.x && x <= fl.x + fl.b && y >= fl.y && y <= fl.y + fl.h) { LYDE.klik(); sig(H.stort(H.LYD[fl.tekst.toLowerCase()]) + '.'); return; }
    }
    L.valg.forEach(function (v, i) {
      if (Math.abs(x - v.x) > v.b / 2 || Math.abs(y - v.y) > v.h / 2) return;
      var o = q.valg[i];
      if (o === q.ord) {
        laast = true; LYDE.rigtig(); lys = -1; lysTil = 0;
        glid = { i: i, t: 0 };
        // Videre, naar baade Helle har talt faerdig og Pelle er landet
        efterHop = naarAlle(2, efterFlage);
        sig([ordKlip(o), H.TEKST.hop], efterHop);
      } else {
        vip[i] = 1;
        LYDE.nej();
        sig([H.TEKST.igen, q.brum]);
      }
    });
  }
  function opdaterFlager(dt) {
    Object.keys(vip).forEach(function (k) { vip[k] = Math.max(0, vip[k] - dt * 1.6); });
    // To stjerner: bogstaverne lyser ét ad gangen, mens Helle brummer, og slukker til sidst
    if (!q) lysTil = 0;
    if (lysTil > 0 && tid > lysTil) {
      lys++;
      if (lys >= q.ord.length) { lys = -1; lysTil = 0; } else lysTil = tid + 0.8;
    }
    if (glid) {
      glid.t += dt * 0.9;
      if (glid.t >= 1) { glid = null; lagt++; LYDE.plask(); pelleFra = pelle; pelle = lagt - 1; hop = 0; LYDE.hop(); }
    }
    if (hop < 1) {
      hop = Math.min(1, hop + dt * 2.2);
      if (hop >= 1) {
        if (pelle === H.ISFLAGER) { senere(startPost, 400); }
        else if (efterHop) { var e = efterHop; efterHop = null; e(); }
      }
    }
  }
  /** En isflage er lagt, og Pelle staar paa den. Naeste ord, eller det sidste hop over til Helle. */
  function efterFlage() {
    fi++;
    if (fi < flager.length) { senere(nytOrd, 300); return; }
    q = null;
    senere(function () { pelleFra = pelle; pelle = H.ISFLAGER; hop = 0; LYDE.hop(); }, 400);
  }
  function tegnFlager() {
    // Pladserne: lagte isflager og tomme pladser
    L.pladser.forEach(function (p, i) {
      if (i < lagt) isflage(p.x, p.y + Math.sin(tid * 1.5 + i) * 2, L.fb);
      else { ctx.save(); ctx.setLineDash([6, 8]); ctx.strokeStyle = 'rgba(248,241,230,.7)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.ellipse(p.x, p.y, L.fb * 0.5, L.fb * 0.15, 0, 0, 7); ctx.stroke(); ctx.restore(); }
    });
    // Helle paa sit store flag
    isflage(L.helle.x, L.helle.y + 6, L.helle.b * 1.3);
    tegnHelle(L.helle.x + L.helle.b * 0.08, L.helle.y + 8, L.helle.b);
    // Pelle, med et hop mellem to pladser
    var a = pellePlads(pelleFra), b = pellePlads(pelle), e = hop, px = a.x + (b.x - a.x) * e, py = a.y + (b.y - a.y) * e - Math.sin(e * Math.PI) * 60;
    tegnPelle(px, py + 4, Math.min(110, L.H * 0.16));
    // Valgene nederst: tre isflager med billeder
    felter = [];
    if (q) {
      L.valg.forEach(function (v, i) {
        var o = q.valg[i], vv = vip[i] ? Math.sin(vip[i] * 20) * 0.2 * vip[i] : 0, x = v.x, y = v.y + Math.sin(tid * 1.4 + i * 2) * 4;
        if (glid && glid.i === i) {
          var m = L.pladser[lagt], e2 = glid.t * glid.t * (3 - 2 * glid.t);
          x = v.x + (m.x - v.x) * e2; y = v.y + (m.y - v.y) * e2;
          isflage(x, y, v.b + (L.fb - v.b) * e2); tegnBillede(o, x, y - v.h * 0.25 * (1 - e2), v.h * 0.7 * (1 - e2 * 0.6));
          return;
        }
        isflage(x, y + v.h * 0.18, v.b, vv);
        tegnBillede(o, x, y - v.h * 0.05, v.h * 0.72);
      });
      // Boblen: bogstaverne, naar stjernerne viser dem
      if (q.visBogstaver) {
        var bo = L.boble, str = Math.min(64, L.H * 0.085), bogst = Array.from(q.ord.toUpperCase());
        felter = feltRaekke(bogst, bo.x, bo.y, str, q.laesSelv ? -1 : lys, str * 0.18);
        if (!q.laesSelv) felter = [];
      }
      hoejttaler();
    }
  }

  /* ================= flaskeposten ================= */

  function startPost() {
    del = 'post'; sedler = H.sedler(svaerhed); si = 0; laast = true; q = null;
    sig(H.TEKST.fremme, function () { nySeddel(); });
  }
  function nySeddel() {
    s = sedler[si]; flaske = 0; foldet = 0; traek = null; givet = null; vip = {}; laast = true;
  }
  function seddelKlar() {
    laast = false;
    sig([H.TEKST.seddel, si === 0 ? H.TEKST.hjaelp : null, s.type === 'goer' ? H.TEKST.goer : H.TEKST.billede].filter(Boolean));
  }
  /** Tingene, man kan traekke, med tre stjerner: nederst, og hvor de er lige nu. */
  function tingPladser() {
    return L.valg.map(function (v, i) {
      if (traek && traek.i === i) return { x: traek.x, y: traek.y, b: v.b * 0.7 };
      return { x: v.x, y: v.y, b: v.b * 0.7 };
    });
  }
  /** Maalene, man kan traekke tingen hen til. */
  function maal() {
    var he = L.helle, p = pellePlads(H.ISFLAGER), pl = L.pladser[H.ISFLAGER - 1];
    return { helle: { x: he.x + he.b * 0.05, y: he.y - he.b * 0.25, r: he.b * 0.42 }, pelle: { x: p.x, y: p.y - 50, r: 62 }, isflage: { x: pl.x, y: pl.y, r: L.fb * 0.55 } };
  }
  function laesOrd(o) {
    var lo = H.lydOrd(o.replace(/[.,]/g, ''));
    var trin = [];
    if (H.kanLyderes(lo)) trin.push(H.brum(lo));
    trin.push(H.ordet(lo));
    sig(trin);
  }
  function rigtigSeddel() {
    laast = true; LYDE.rigtig();
    var sagt = s.type === 'ord' ? ordKlip(s.ord) : s.tekst;
    sig([H.TEKST.rigtig, sagt], function () {
      si++;
      if (si >= sedler.length) { afslut(); return; }
      sig(H.TEKST.naeste, function () { nySeddel(); });
    });
  }
  function trykPost(x, y, id) {
    if (laast || !s) return;
    var k = L.hoejttaler;
    if (Math.hypot(x - k.x, y - k.y) < k.r + 10) { LYDE.klik(); seddelKlar(); return; }
    for (var f = 0; f < felter.length; f++) {
      var fl = felter[f];
      if (x >= fl.x && x <= fl.x + fl.b && y >= fl.y && y <= fl.y + fl.h) { LYDE.klik(); laesOrd(fl.tekst); return; }
    }
    if (s.type === 'goer') {
      tingPladser().forEach(function (t, i) {
        if (!traek && Math.hypot(x - t.x, y - t.y) < t.b * 0.6) traek = { i: i, id: id, x: x, y: y };
      });
      return;
    }
    L.valg.forEach(function (v, i) {
      if (Math.abs(x - v.x) > v.b / 2 || Math.abs(y - v.y) > v.h / 2) return;
      if (H.svar(s, s.valg[i])) rigtigSeddel();
      else { vip[i] = 1; LYDE.nej(); sig(H.TEKST.igen); }
    });
  }
  function flytPost(x, y, id) { if (traek && traek.id === id) { traek.x = x; traek.y = y; } }
  function slipPost(x, y, id) {
    if (!traek || traek.id !== id) return;
    var m = maal(), hvor = null;
    Object.keys(m).forEach(function (n) { if (Math.hypot(x - m[n].x, y - m[n].y) < m[n].r) hvor = n; });
    var t = s.ting[traek.i];
    if (hvor && H.svar(s, { ting: t, maal: hvor })) { givet = { ting: t, maal: hvor, t: 0 }; traek = null; rigtigSeddel(); return; }
    if (hvor) { vip[traek.i] = 1; LYDE.nej(); sig(H.TEKST.igen); }
    traek = null;
  }
  function opdaterPost(dt) {
    Object.keys(vip).forEach(function (k) { vip[k] = Math.max(0, vip[k] - dt * 1.6); });
    if (!s) return;
    if (flaske < 1) { flaske = Math.min(1, flaske + dt * 0.55); if (flaske >= 1) LYDE.plask(); }
    else if (foldet < 1) { foldet = Math.min(1, foldet + dt * 1.8); if (foldet >= 1) seddelKlar(); }
    if (givet) givet.t = Math.min(1, givet.t + dt);
  }
  function tegnPost() {
    L.pladser.forEach(function (p, i) { isflage(p.x, p.y + Math.sin(tid * 1.5 + i) * 2, L.fb); });
    isflage(L.helle.x, L.helle.y + 6, L.helle.b * 1.3);
    tegnHelle(L.helle.x + L.helle.b * 0.08, L.helle.y + 8, L.helle.b);
    var pp = pellePlads(H.ISFLAGER);
    tegnPelle(pp.x, pp.y + 4, Math.min(110, L.H * 0.16));
    felter = [];
    if (!s) return;
    // Flasken flyder ind fra hoejre, og sedlen foldes ud
    var bo = L.boble;
    if (foldet <= 0) {
      var fx = L.W + 60 - (L.W + 60 - bo.x) * (1 - Math.pow(1 - flaske, 3)), fy = L.hav + 40 + Math.sin(tid * 2) * 6;
      ctx.save(); ctx.translate(fx, fy); ctx.rotate(-0.5 + Math.sin(tid * 2) * 0.1);
      rr(-34, -12, 56, 24, 10, 'rgba(174,211,228,.85)', '#5f9fc9', 2); rr(20, -6, 14, 12, 3, '#b18a56');
      rr(-22, -6, 30, 12, 3, PAPIR); ctx.restore();
      return;
    }
    // Sedlen
    var str = Math.min(s.type === 'ord' ? 70 : 52, L.H * (s.type === 'ord' ? 0.1 : 0.075));
    ctx.font = skrift(str);
    var bredde = Math.min(L.W - L.VEN - 120, Math.max(260, ctx.measureText(s.tekst).width + s.ordene.length * str * 0.7 + 60)) * foldet;
    var hh = str * 2.4;
    ctx.save(); ctx.shadowColor = 'rgba(107,85,68,.25)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 6;
    rr(bo.x - bredde / 2, bo.y - hh / 2, bredde, hh, 16, PAPIR); ctx.restore();
    if (foldet >= 1) {
      var dele = s.ordene.map(function (o, i) { return i === s.ordene.length - 1 && s.type !== 'ord' ? o + '.' : o; });
      felter = feltRaekke(dele, bo.x, bo.y, str, -1, str * 0.3);
    }
    if (foldet < 1) return;
    // Svarene: billeder (én og to stjerner) eller ting at traekke (tre)
    if (s.type === 'goer') {
      var m = maal();
      if (traek) Object.keys(m).forEach(function (n) { ctx.save(); ctx.setLineDash([6, 7]); ctx.strokeStyle = 'rgba(240,196,106,.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(m[n].x, m[n].y, m[n].r, 0, 7); ctx.stroke(); ctx.restore(); });
      if (givet) { var gm = m[givet.maal]; tegnBillede(givet.ting, gm.x, gm.y + (givet.maal === 'pelle' ? 10 : 0), L.valg[0].h * 0.55); }
      tingPladser().forEach(function (t, i) {
        var o = s.ting[i];
        if (givet && givet.ting === o) return;
        var vv = vip[i] ? Math.sin(vip[i] * 20) * 8 * vip[i] : 0;
        if (!(traek && traek.i === i)) rr(t.x - t.b / 2 + vv, t.y - t.b * 0.45, t.b, t.b * 0.9, 18, 'rgba(248,241,230,.92)');
        tegnBillede(o, t.x + vv, t.y, t.b * 0.72);
      });
    } else {
      L.valg.forEach(function (v, i) {
        var vv = vip[i] ? Math.sin(vip[i] * 20) * 8 * vip[i] : 0;
        rr(v.x - v.b / 2 + vv, v.y - v.h / 2, v.b, v.h, 20, 'rgba(248,241,230,.94)');
        tegnBillede(s.valg[i], v.x + vv, v.y, v.h * 0.78);
      });
    }
    hoejttaler();
  }

  /* ================= menu og slut ================= */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }
  function tegnMenuHelle() {
    var cv = overlay.querySelector('canvas.helle');
    if (!cv) return;
    var c = cv.getContext('2d'), gem = ctx, gemL = L;
    c.clearRect(0, 0, cv.width, cv.height);
    ctx = c; L = { H: 600 };
    isflage(cv.width / 2, cv.height * 0.78, cv.width * 0.9);
    tegnHelle(cv.width / 2 + 6, cv.height * 0.8, cv.width * 0.62);
    ctx = gem; L = gemL;
  }
  HELLE.addEventListener('load', function () { if (tilstand !== 'spil') tegnMenuHelle(); });
  function visMenu() {
    tilstand = 'menu'; omgang++; q = null; s = null; tie();
    visOverlay('<div class="kort"><canvas class="helle" width="300" height="240"></canvas><h2>Isvigen</h2>' +
      Menu.stjerneRaekke(svaerhed) +
      '<div class="raekke start"><button class="knap groen start" data-handling="start" aria-label="Start">' + Menu.start() + '</button></div>' +
      Menu.lydRaekke(lydTil) + '</div>');
    tegnMenuHelle();
  }
  function afslut() {
    tilstand = 'faerdig'; LYDE.faerdig();
    sig(H.TEKST.slut);
    visOverlay('<div class="kort"><canvas class="helle" width="300" height="240"></canvas><h2>Isvigen</h2>' + Menu.slutRaekke('igen', null) + '</div>');
    tegnMenuHelle();
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    startLyd();
    if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) tie(); visMenu(); }
    else if (h === 'start' || h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); L = null; layout(); startFlager(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loekken og input ---------- */
  function loekke(t) {
    requestAnimationFrame(loekke);
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    layout();
    tegnBaggrund();
    if (tilstand === 'spil') {
      if (del === 'flager') { opdaterFlager(dt); tegnFlager(); }
      else { opdaterPost(dt); tegnPost(); }
    }
  }
  function punkt(e) { var r = laerred.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  // Hver finger for sig (pointerdown, ikke click), saa to boern ikke spaerrer for hinanden
  laerred.addEventListener('pointerdown', function (e) {
    e.preventDefault(); layout();
    if (tilstand !== 'spil') return;
    var p = punkt(e);
    if (del === 'flager') trykFlager(p[0], p[1]); else trykPost(p[0], p[1], e.pointerId);
  }, { passive: false });
  laerred.addEventListener('pointermove', function (e) { if (tilstand === 'spil' && del === 'post') { var p = punkt(e); flytPost(p[0], p[1], e.pointerId); } });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    laerred.addEventListener(type, function (e) { if (tilstand === 'spil' && del === 'post') { var p = punkt(e); slipPost(p[0], p[1], e.pointerId); } });
  });
  laerred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpas);
  window.addEventListener('orientationchange', function () { setTimeout(tilpas, 220); });

  /** Til testen i browseren: hvor tingene er, og hvad der er rigtigt. */
  window.__debug = function () {
    layout();
    return {
      tilstand: tilstand, del: del, svaerhed: svaerhed, fi: fi, lagt: lagt, pelle: pelle, hop: hop, omgang: omgang, laast: laast, si: si, foldet: foldet,
      q: q ? { ord: q.ord, valg: q.valg, laesSelv: q.laesSelv } : null,
      s: s ? { type: s.type, ord: s.ord, tekst: s.tekst, valg: s.valg, ting: s.ting, maal: s.maal } : null,
      valg: L.valg, maal: del === 'post' ? maal() : null, felter: felter
    };
  };

  tilpas();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(loekke);
})();
