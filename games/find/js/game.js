/**
 * Vrimleskoven — skaerm og lyd. Reglerne ligger i find.js.
 *
 * Et stort billede (engen eller skoven) tegnet i kode, med Bogstavvejens
 * malede ting spredt ud, nogle halvt bag en busk. Stemmen siger "Her har du
 * ordet kat. Kan du finde den?", og barnet trykker paa tingen. Rigtigt: en
 * ring i spillerens farve og "Du fandt den!". Forkert: tingens eget ord, saa
 * et forkert tryk ogsaa laerer noget. Har man ledt laenge, lyser et bloedt
 * skaer om tingen. To spillere: to skyer, roed og blaa, i det samme billede.
 *
 * Stedet tegnes én gang pr. skaermstoerrelse til et lærred i baggrunden;
 * tingene, buskene, ringene og skyerne tegnes hver frame.
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

  var F = window.Find;
  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var FARVER = ['#d95f45', '#5f9fc9'];
  var HORISONT = 0.40;            // feltets top som andel af skaermhoejden
  var HJAELP_EFTER = 12;          // sekunder uden fund, foer skaeret om tingen kommer

  var tilstand = 'menu';          // menu | spil | faerdig
  var sted = 'eng';
  var svaerhed = 0;
  var spillere = 1;
  var lydTil = true;
  var tid = 0, sidsteTid = 0;
  var omgang = null;              // fra Find.nyOmgang
  var spil = [];                  // pr. spiller: { ringe: [ord], venter, sidenFund, faerdig }
  var vip = {};                   // ord -> tid tilbage af et vip efter et forkert tryk
  var ekko = 0, ekkoFra = null;

  /* ---------- billeder ---------- */

  var billeder = {};
  function hent(n, sti) { if (billeder[n]) return; var img = new Image(); img.src = sti; billeder[n] = img; }
  F.ALLE.forEach(function (o) { hent(o.ord, o.fil); });
  ['trae', 'gran', 'siv', 'svamp', 'kastanje', 'pindsvin'].forEach(function (n) { hent('#' + n, '../maskinen/billeder/' + n + '.png'); });
  hent('#hus', '../../assets/malet/hus.png');
  function tegnB(n, x, y, s, h) {
    var i = billeder[n];
    if (!(i && i.complete && i.naturalWidth)) return false;
    var hh = h || s * (i.naturalHeight / i.naturalWidth);
    ctx.drawImage(i, x - s / 2, y - hh / 2, s, hh);
    return true;
  }

  /* ---------- lyd og stemme (som i Rimhulen) ---------- */

  var lyd = null;
  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();
    return lyd;
  }
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });
  function tone(frekvens, længde, styrke, type) {
    if (!lydTil) return;
    try {
      var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
      o.type = type || 'triangle'; o.frequency.value = frekvens; g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination); o.start(); o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) { toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum); }); }

  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    stemme = window.speechSynthesis.getVoices().filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }

  var klipFindes = {};
  ['lyd/', '../bogstaver/lyd/', '../rim/lyd/'].forEach(function (mappe) {
    fetch(mappe + 'klip.json').then(function (r) { return r.ok ? r.json() : []; })
      .then(function (liste) { liste.forEach(function (f) { klipFindes[mappe + f] = true; }); })
      .catch(function () { /* ingen klip, enhedens stemme bruges */ });
  });
  var buffere = {}, aktivtKlip = null, afspillet = 0;
  function hentKlip(sti) {
    if (!buffere[sti]) {
      buffere[sti] = fetch(sti).then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
    }
    return buffere[sti];
  }
  function stopKlip() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  function afspil(stier, reserveTekst, fra) {
    if (!lydTil) return;
    ekko = 1.4; ekkoFra = fra || null;
    if (stier.some(function (s) { return !klipFindes[s]; })) { sig(reserveTekst); return; }
    Promise.all(stier.map(hentKlip)).then(function (bufs) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      stopKlip();
      bufs.forEach(function (buf) { var kilde = k.createBufferSource(); kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start); start += buf.duration - 0.04; aktivtKlip = kilde; });
      afspillet++;
    }).catch(function () { sig(reserveTekst); });
  }
  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(tekst); u.voice = stemme; u.lang = stemme.lang; u.rate = 0.85; window.speechSynthesis.speak(u); } catch (e) { /* stemme er pynt */ }
  }

  /* ---------- laerred, felt og sted ---------- */

  var bag = null;
  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr); lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px'; lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    bag = null;
  }
  // Feltet 1000 x 600 ligger under horisonten og fylder hele bredden
  function fx(X) { return X / 1000 * window.innerWidth; }
  function fy(Y) { return window.innerHeight * HORISONT + Y / 600 * window.innerHeight * (1 - HORISONT); }
  function fs(S) { return S / 1000 * window.innerWidth; }

  function sky(c, B, H, farve1, farve2) {
    var g = c.createLinearGradient(0, 0, 0, H * HORISONT); g.addColorStop(0, farve1); g.addColorStop(1, farve2);
    c.fillStyle = g; c.fillRect(0, 0, B, H);
    c.fillStyle = 'rgba(255,255,255,.9)';
    [[B * 0.2, 60, 1], [B * 0.62, 40, 0.8]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], 24 * s[2], 0, 7); c.arc(s[0] + 26 * s[2], s[1] - 10 * s[2], 30 * s[2], 0, 7); c.arc(s[0] + 56 * s[2], s[1], 22 * s[2], 0, 7); c.fill(); });
  }
  function billede(c, n, x, y, s) { var i = billeder[n]; if (i && i.complete && i.naturalWidth) c.drawImage(i, x - s / 2, y - s * (i.naturalHeight / i.naturalWidth) / 2, s, s * (i.naturalHeight / i.naturalWidth)); }

  function tegnEng(c, B, H) {
    sky(c, B, H, '#8fc7e8', '#dcecf3');
    var hor = H * HORISONT;
    c.fillStyle = '#7fa955'; c.beginPath(); c.moveTo(0, hor - 30); c.quadraticCurveTo(B * 0.25, hor - 70, B * 0.5, hor - 40); c.quadraticCurveTo(B * 0.78, hor - 10, B, hor - 60); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    for (var i = 0; i < 7; i++) billede(c, i % 3 === 1 ? '#gran' : '#trae', 40 + i * B * 0.135, hor - 62 - (i % 2) * 10, 96 + (i % 3) * 14);
    c.fillStyle = '#93bc63'; c.beginPath(); c.moveTo(0, hor + 10); c.quadraticCurveTo(B * 0.4, hor - 14, B * 0.7, hor + 8); c.quadraticCurveTo(B * 0.9, hor + 22, B, hor); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    c.fillStyle = '#a9c97a'; c.beginPath(); c.moveTo(0, H * 0.7); c.quadraticCurveTo(B * 0.5, H * 0.62, B, H * 0.72); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 44; c.lineCap = 'round'; c.beginPath(); c.moveTo(B * 0.05, H); c.quadraticCurveTo(B * 0.3, H * 0.7, B * 0.55, H * 0.62); c.quadraticCurveTo(B * 0.8, H * 0.55, B * 0.95, hor + 10); c.stroke();
    // Soeen ligger, hvor feltet ikke lader ting ligge (zonerne i find.js)
    c.fillStyle = '#8fc7e8'; c.beginPath(); c.ellipse(fx(790), fy(415), fs(160), fs(58), 0, 0, 7); c.fill(); c.strokeStyle = '#5f9fc9'; c.lineWidth = 4; c.stroke();
    billede(c, '#siv', fx(660), fy(380), fs(60)); billede(c, '#siv', fx(910), fy(400), fs(50));
    billede(c, '#hus', B * 0.88, hor - 34, 150);
    c.strokeStyle = '#b18a56'; c.lineWidth = 5; for (var x = B * 0.55; x < B * 0.8; x += 30) { c.beginPath(); c.moveTo(x, hor + 14); c.lineTo(x, hor + 50); c.stroke(); }
    c.beginPath(); c.moveTo(B * 0.55, hor + 30); c.lineTo(B * 0.79, hor + 30); c.stroke();
  }
  function tegnSkov(c, B, H) {
    sky(c, B, H, '#c9dfe9', '#eaf0d8');
    var hor = H * HORISONT;
    c.fillStyle = '#5f8240'; c.beginPath(); c.moveTo(0, hor - 20); c.quadraticCurveTo(B * 0.3, hor - 80, B * 0.6, hor - 30); c.quadraticCurveTo(B * 0.85, hor - 5, B, hor - 50); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    for (var i = 0; i < 10; i++) billede(c, i % 2 ? '#gran' : '#trae', 30 + i * B * 0.105, hor - 66 - (i % 3) * 12, 104 + (i % 2) * 24);
    c.fillStyle = '#7fa955'; c.beginPath(); c.moveTo(0, hor + 6); c.quadraticCurveTo(B * 0.5, hor - 16, B, hor + 4); c.lineTo(B, H); c.lineTo(0, H); c.fill();
    // Moerkere pletter, stubbe, svampe og kastanjer paa skovbunden
    c.fillStyle = 'rgba(95,130,64,.35)';
    [[0.15, 0.62, 140, 40], [0.55, 0.75, 180, 46], [0.85, 0.58, 120, 34], [0.35, 0.9, 160, 40]].forEach(function (p) { c.beginPath(); c.ellipse(B * p[0], H * p[1], p[2], p[3], 0, 0, 7); c.fill(); });
    [[0.3, 0.55], [0.72, 0.85]].forEach(function (p) { var x = B * p[0], y = H * p[1]; c.fillStyle = '#8a663d'; c.beginPath(); c.roundRect(x - 26, y - 18, 52, 30, 6); c.fill(); c.fillStyle = '#d9ba8a'; c.beginPath(); c.ellipse(x, y - 18, 26, 10, 0, 0, 7); c.fill(); c.strokeStyle = KANT; c.lineWidth = 2.5; c.stroke(); });
    c.strokeStyle = '#e5d3ae'; c.lineWidth = 34; c.lineCap = 'round'; c.beginPath(); c.moveTo(B * 0.9, H); c.quadraticCurveTo(B * 0.6, H * 0.8, B * 0.5, H * 0.62); c.quadraticCurveTo(B * 0.35, hor + 40, B * 0.1, hor + 20); c.stroke();
  }
  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    if (!bag || bag.b !== B || bag.h !== H || bag.sted !== sted) {
      var dpr = Math.min(window.devicePixelRatio || 1, 2);
      bag = document.createElement('canvas');
      bag.width = Math.floor(B * dpr); bag.height = Math.floor(H * dpr); bag.b = B; bag.h = H; bag.sted = sted;
      var c = bag.getContext('2d'); c.setTransform(dpr, 0, 0, dpr, 0, 0);
      (sted === 'skov' ? tegnSkov : tegnEng)(c, B, H);
    }
    ctx.drawImage(bag, 0, 0, B, H);
  }
  // Baggrunden tegnes igen, naar traeerne og huset er hentet
  ['#trae', '#gran', '#hus', '#siv', '#svamp', '#kastanje'].forEach(function (n) { billeder[n].addEventListener('load', function () { bag = null; }); });

  /** Skjulet: et malet trae, gran eller loevtrae, med foden i skjulets midte. Tingene bag det tegnes lige foer det. */
  function tegnSkjul(b, i) {
    var x = fx(b.x), y = fy(b.y), r = fs(b.r);
    ctx.fillStyle = 'rgba(94,74,58,.14)'; ctx.beginPath(); ctx.ellipse(x, y + r * 0.75, r * 1.1, r * 0.22, 0, 0, 7); ctx.fill();
    if (!tegnB(i % 3 === 1 ? '#gran' : '#trae', x, y - r * 0.5, r * 2.6)) { ctx.fillStyle = '#5f8240'; ctx.beginPath(); ctx.arc(x, y - r * 0.3, r, 0, 7); ctx.fill(); }
  }

  /* ---------- spillet ---------- */

  function start() {
    tilstand = 'spil';
    omgang = F.nyOmgang(sted, svaerhed, spillere);
    spil = omgang.spillere.map(function () { return { ringe: [], venter: 0, sidenFund: 0, faerdig: false }; });
    vip = {};
    setTimeout(function () { if (tilstand === 'spil') omgang.spillere.forEach(function (sp, s) { setTimeout(function () { sigSpoergsmaal(s); }, s * 2600); }); }, 500);
  }

  function skyRect(s) {
    var B = window.innerWidth, H = window.innerHeight, ms = Math.min(B, H);
    var b = ms * 0.24, h = b * 0.62, x = spillere === 1 ? B / 2 : B * (s === 0 ? 0.3 : 0.7);
    return { x: x - b / 2, y: 12, b: b, h: h, midt: x };
  }
  function aktuelt(s) { var sp = omgang.spillere[s]; return sp.spoergsmaal[sp.i]; }

  function sigSpoergsmaal(s) {
    if (tilstand !== 'spil' || spil[s].faerdig) return;
    var q = aktuelt(s), r = skyRect(s), fra = { x: r.midt, y: r.y + r.h };
    if (q.type === 'ord') afspil([F.ORD[q.ord].klip, F.KLIP.kan_du_finde[0]], F.ORDET + q.ord + '. ' + F.KLIP.kan_du_finde[1], fra);
    else afspil([F.KATEGORIER[q.kategori].klip], F.KATEGORIER[q.kategori].tekst, fra);
  }

  function tingVed(x, y) {
    // Forreste foerst: de, der ikke ligger bag en busk, og saa de andre
    var t = omgang.ting, ud = null;
    for (var pas = 0; pas < 2 && !ud; pas++) {
      for (var i = t.length - 1; i >= 0; i--) {
        if ((pas === 0) === !!t[i].bag) continue;
        var s = fs(t[i].str);
        if (Math.hypot(x - fx(t[i].x), y - fy(t[i].y)) < s * 0.62) { ud = t[i]; break; }
      }
    }
    return ud;
  }

  function spilTryk(x, y) {
    for (var s = 0; s < spillere; s++) {
      var r = skyRect(s);
      if (x > r.x - 8 && x < r.x + r.b + 8 && y > r.y - 8 && y < r.y + r.h + 8) { sigSpoergsmaal(s); return; }
    }
    var t = tingVed(x, y);
    if (!t) return;
    // Hvem passer tingen til? Enkeltordene er forskellige spillerne imellem, og kategorierne overlapper dem ikke.
    for (var p = 0; p < spillere; p++) {
      if (spil[p].faerdig || spil[p].venter > 0) continue;
      var res = F.tryk(omgang, p, t.ord);
      if (res === 'rigtig' || res === 'alle') { fundet(p, t, res === 'alle'); return; }
      if (res === 'allerede') { tone(520, 0.06, 0.06); return; }
    }
    // Forkert for alle: tingen vipper og siger sit ord, saa man laerer det alligevel
    vip[t.ord] = 0.6;
    melodi([330, 262], 110);
    afspil([F.ORD[t.ord].klip], F.ORDET + t.ord, { x: fx(t.x), y: fy(t.y) - fs(t.str) / 2 });
  }

  function fundet(p, t, alle) {
    var st = spil[p], q = aktuelt(p);
    st.ringe.push(t.ord); st.sidenFund = 0;
    melodi(alle ? [660, 880, 1100, 1320] : [660, 880, 1100], 90);
    var er = q.type === 'ord' || alle;
    if (er) {
      st.venter = 2.2;
      afspil([alle ? F.KLIP.alle_sammen[0] : F.KLIP.du_fandt_den[0]], alle ? F.KLIP.alle_sammen[1] : F.KLIP.du_fandt_den[1], { x: fx(t.x), y: fy(t.y) - fs(t.str) / 2 });
      setTimeout(function () { naeste(p); }, 2000);
    }
  }

  function naeste(p) {
    if (tilstand !== 'spil') return;
    var st = spil[p];
    st.ringe = []; st.venter = 0; st.sidenFund = 0;
    if (!F.naeste(omgang, p)) {
      st.faerdig = true;
      if (spil.every(function (s) { return s.faerdig; })) { setTimeout(afslut, 600); return; }
      return;
    }
    setTimeout(function () { sigSpoergsmaal(p); }, 300);
  }

  function opdater(dt) {
    spil.forEach(function (st) { if (st.venter > 0) st.venter -= dt; if (!st.faerdig && st.venter <= 0) st.sidenFund += dt; });
    Object.keys(vip).forEach(function (o) { if (vip[o] > 0) vip[o] -= dt; });
    if (ekko > 0) ekko -= dt;
  }

  /* ---------- tegning ---------- */

  function tegnTing(t) {
    var x = fx(t.x), y = fy(t.y), s = fs(t.str), v = vip[t.ord] || 0;
    ctx.save(); ctx.translate(x, y);
    if (v > 0) ctx.rotate(Math.sin(v * 40) * 0.12);
    ctx.fillStyle = 'rgba(94,74,58,.12)'; ctx.beginPath(); ctx.ellipse(0, s * 0.44, s * 0.38, s * 0.08, 0, 0, 7); ctx.fill();
    if (!tegnB(t.ord, 0, 0, s, s)) { ctx.fillStyle = '#e7ddc8'; ctx.beginPath(); ctx.arc(0, 0, s * 0.4, 0, 7); ctx.fill(); }
    ctx.restore();
  }
  function ring(x, y, r, farve) {
    ctx.strokeStyle = farve; ctx.lineWidth = 7; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(x, y, r - 6, 0, 7); ctx.stroke();
  }
  function tegnHoejttaler(x, y, s) {
    ctx.save(); ctx.translate(x, y); ctx.fillStyle = KANT;
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.35); ctx.lineTo(-s * 0.4, -s * 0.35); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.4, s * 0.35); ctx.lineTo(-s, s * 0.35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = KANT; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round'; ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.7, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  }
  /** Kategoriens tegn: farveplet, vinge, pote, gaffel eller hjul. Tegnet i kode. */
  function tegnKategoriIkon(k, x, y, r) {
    var kat = F.KATEGORIER[k];
    ctx.save(); ctx.translate(x, y); ctx.strokeStyle = KANT; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (kat.ikon === 'farve') { ctx.fillStyle = kat.farve; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill(); ctx.stroke(); }
    else if (kat.ikon === 'vinge') { ctx.beginPath(); ctx.moveTo(-r, r * 0.1); ctx.quadraticCurveTo(-r * 0.5, -r * 0.9, 0, r * 0.1); ctx.quadraticCurveTo(r * 0.5, -r * 0.9, r, r * 0.1); ctx.stroke(); }
    else if (kat.ikon === 'pote') { ctx.fillStyle = KANT; ctx.beginPath(); ctx.ellipse(0, r * 0.3, r * 0.45, r * 0.4, 0, 0, 7); ctx.fill(); [[-0.6, -0.2], [-0.22, -0.55], [0.22, -0.55], [0.6, -0.2]].forEach(function (p) { ctx.beginPath(); ctx.arc(p[0] * r, p[1] * r, r * 0.2, 0, 7); ctx.fill(); }); }
    else if (kat.ikon === 'gaffel') { ctx.beginPath(); ctx.moveTo(-r * 0.3, r); ctx.lineTo(-r * 0.3, -r * 0.2); ctx.moveTo(-r * 0.6, -r); ctx.lineTo(-r * 0.6, -r * 0.3); ctx.quadraticCurveTo(-r * 0.3, 0, 0, -r * 0.3); ctx.lineTo(0, -r); ctx.moveTo(-r * 0.3, -r); ctx.lineTo(-r * 0.3, -r * 0.3); ctx.moveTo(r * 0.5, r); ctx.lineTo(r * 0.5, -r); ctx.stroke(); ctx.fillStyle = KANT; ctx.beginPath(); ctx.ellipse(r * 0.5, -r * 0.5, r * 0.2, r * 0.5, 0, 0, 7); ctx.fill(); }
    else if (kat.ikon === 'hjul') { ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * 0.25, 0, 7); ctx.stroke(); for (var i = 0; i < 6; i++) { var v = i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(v) * r * 0.25, Math.sin(v) * r * 0.25); ctx.lineTo(Math.cos(v) * r, Math.sin(v) * r); ctx.stroke(); } }
    ctx.restore();
  }
  function tegnSky(s) {
    var r = skyRect(s), q = aktuelt(s), sp = omgang.spillere[s], farve = spillere === 2 ? FARVER[s] : KANT;
    ctx.fillStyle = PAPIR; ctx.strokeStyle = farve; ctx.lineWidth = spillere === 2 ? 6 : 4;
    ctx.beginPath(); ctx.roundRect(r.x, r.y, r.b, r.h, 24); ctx.fill(); ctx.stroke();
    if (spil[s].faerdig) { ring(r.midt, r.y + r.h / 2, r.h * 0.3, '#7ab648'); }
    else if (q.type === 'ord') tegnB(q.ord, r.midt - r.h * 0.08, r.y + r.h / 2, r.h * 0.72, r.h * 0.72);
    else {
      tegnKategoriIkon(q.kategori, r.midt - r.h * 0.1, r.y + r.h * 0.42, r.h * 0.2);
      // en prik pr. ting, der skal findes
      q.ord.forEach(function (o, i) { ctx.beginPath(); ctx.arc(r.midt - (q.ord.length - 1) * 11 + i * 22 - r.h * 0.1, r.y + r.h * 0.78, 7, 0, 7); ctx.fillStyle = q.fundet.indexOf(o) >= 0 ? GUL : 'rgba(94,74,58,.15)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke(); });
    }
    tegnHoejttaler(r.x + r.b - 22, r.y + r.h - 20, 9);
    // omgangens taeller: cirkler, ikke tal
    for (var i = 0; i < sp.spoergsmaal.length; i++) {
      ctx.beginPath(); ctx.arc(r.midt - (sp.spoergsmaal.length - 1) * 11 + i * 22, r.y + r.h + 16, 6, 0, 7);
      ctx.fillStyle = i < sp.i ? GUL : 'rgba(248,241,230,.75)'; ctx.fill(); ctx.strokeStyle = KANT; ctx.lineWidth = 2; ctx.stroke();
    }
    // ekko-ringe mens stemmen taler
    if (ekko > 0 && ekkoFra && Math.abs(ekkoFra.x - r.midt) < 2) {
      var t = 1.4 - ekko;
      for (var j = 0; j < 3; j++) { var rr = 20 + ((t * 90 + j * 34) % 110); ctx.strokeStyle = 'rgba(248,241,230,' + (0.55 * (1 - rr / 130)).toFixed(2) + ')'; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(r.midt, r.y + r.h, rr, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke(); }
    }
  }
  /** Skaeret: har man ledt laenge, lyser det bloedt om en ting, man mangler. */
  function tegnHjaelp(s) {
    var st = spil[s];
    if (st.faerdig || st.sidenFund < HJAELP_EFTER) return;
    var q = aktuelt(s), maal = q.type === 'ord' ? q.ord : q.ord.filter(function (o) { return q.fundet.indexOf(o) < 0; })[0];
    var t = omgang.ting.filter(function (x) { return x.ord === maal; })[0];
    if (!t) return;
    var x = fx(t.x), y = fy(t.y), r = fs(t.str) * (0.9 + Math.sin(tid * 3) * 0.12);
    var g = ctx.createRadialGradient(x, y, r * 0.4, x, y, r);
    g.addColorStop(0, 'rgba(240,196,106,0)'); g.addColorStop(0.7, 'rgba(240,196,106,.45)'); g.addColorStop(1, 'rgba(240,196,106,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  }
  /** Alt paa jorden tegnes bagfra og frem: det, der staar laengst nede, er naermest. En ting bag et skjul tegnes lige foer skjulet. */
  var lag = null, lagFor = null;
  function tegnJorden() {
    var st = F.STEDER[sted];
    if (lagFor !== omgang) {
      lag = [];
      st.buske.forEach(function (b, i) { lag.push({ y: b.y + b.r * 0.75, skjul: b, i: i }); });
      omgang.ting.forEach(function (t) { lag.push({ y: t.bag ? st.buske[t.skjul].y + st.buske[t.skjul].r * 0.75 - 0.5 : t.y + t.str / 2, ting: t }); });
      lag.sort(function (a, b) { return a.y - b.y; });
      lagFor = omgang;
    }
    lag.forEach(function (l) { if (l.ting) tegnTing(l.ting); else tegnSkjul(l.skjul, l.i); });
  }
  function tegnSpil() {
    var B = window.innerWidth, H = window.innerHeight;
    tegnJorden();
    for (var s = 0; s < spillere; s++) {
      tegnHjaelp(s);
      spil[s].ringe.forEach(function (o) { var t = omgang.ting.filter(function (x) { return x.ord === o; })[0]; if (t) ring(fx(t.x), fy(t.y), fs(t.str) * 0.6, spillere === 2 ? FARVER[s] : GUL); });
    }
    tegnB('#pindsvin', B - 70, H - 74, Math.min(96, H * 0.14));
    for (var p = 0; p < spillere; p++) tegnSky(p);
  }

  /* ---------- menu og slut ---------- */

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay('<div class="kort"><h2>Flot!</h2><canvas class="eksempel" width="440" height="240"></canvas>' + Menu.slutRaekke('igen', null) + '</div>');
    var cv = overlay.querySelector('canvas.eksempel'), c = cv.getContext('2d'), p = billeder['#pindsvin'];
    if (p.complete && p.naturalWidth) c.drawImage(p, 150, 10, 140, 140 * (p.naturalHeight / p.naturalWidth));
    [0, 1, 2].forEach(function (i) { c.beginPath(); c.arc(90 + i * 130, 200, 22, 0, 7); c.fillStyle = GUL; c.fill(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke(); });
  }
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }

  /** Stedernes knapper: engen med buske, skoven med graner. Tegnet i kode. */
  function tegnStedIkon(cv) {
    var w = cv.width, h = cv.height, c = cv.getContext('2d'), s = cv.dataset.sted;
    c.clearRect(0, 0, w, h);
    c.fillStyle = s === 'skov' ? '#c9dfe9' : '#8fc7e8'; c.beginPath(); c.roundRect(0, 0, w, h, 14); c.fill();
    c.fillStyle = s === 'skov' ? '#5f8240' : '#93bc63'; c.beginPath(); c.roundRect(0, h * 0.55, w, h * 0.45, [0, 0, 14, 14]); c.fill();
    if (s === 'skov') { c.fillStyle = '#4f6f36'; [0.2, 0.5, 0.8].forEach(function (a) { c.beginPath(); c.moveTo(w * a - 24, h * 0.62); c.lineTo(w * a, h * 0.12); c.lineTo(w * a + 24, h * 0.62); c.closePath(); c.fill(); }); }
    else { c.fillStyle = '#5f8240'; c.beginPath(); c.arc(w * 0.28, h * 0.56, 24, 0, 7); c.arc(w * 0.7, h * 0.6, 19, 0, 7); c.fill(); c.fillStyle = GUL; c.beginPath(); c.arc(w * 0.82, h * 0.22, 14, 0, 7); c.fill(); }
  }
  function visMenu() {
    tilstand = 'menu';
    stopKlip();
    visOverlay(
      '<div class="kort"><h2>Vrimleskoven</h2>' +
      '<div class="raekke steder">' + F.STEDNAVNE.map(function (s) {
        return '<button class="knap smal ikon' + (s === sted ? ' valgt' : '') + '" data-handling="sted" data-k="' + s + '" aria-label="' + s + '"><canvas width="160" height="120" data-sted="' + s + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) + Menu.startRaekke('start') + Menu.lydRaekke(lydTil) + '</div>'
    );
    overlay.querySelectorAll('canvas[data-sted]').forEach(tegnStedIkon);
  }
  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'sted') { sted = knap.dataset.k; visMenu(); }
    else if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stopKlip(); visMenu(); }
    else if (h === 'start') { spillere = +knap.dataset.spillere || 1; tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'igen') { tone(523, 0.1, 0.1); skjulOverlay(); start(); }
    else if (h === 'menu') visMenu();
  });

  /* ---------- loop og input ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t; tid += dt;
    tegnBaggrund();
    if (tilstand === 'spil') { opdater(dt); tegnSpil(); }
    requestAnimationFrame(løkke);
  }
  lærred.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    var r = lærred.getBoundingClientRect();
    if (tilstand === 'spil') spilTryk(e.clientX - r.left, e.clientY - r.top);
  }, { passive: false });
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, sted: sted, svaerhed: svaerhed, spillere: spillere, lyd: lydTil, afspillet: afspillet,
      ting: omgang ? omgang.ting.map(function (t) { return { ord: t.ord, x: Math.round(fx(t.x)), y: Math.round(fy(t.y)), str: Math.round(fs(t.str)), bag: t.bag }; }) : null,
      spil: omgang ? omgang.spillere.map(function (sp, s) {
        var q = sp.spoergsmaal[sp.i], r = skyRect(s);
        return { i: sp.i, antal: sp.spoergsmaal.length, faerdig: spil[s].faerdig, venter: +spil[s].venter.toFixed(2), sky: { x: Math.round(r.midt), y: Math.round(r.y + r.h / 2) },
                 spoergsmaal: q ? { type: q.type, ord: q.type === 'ord' ? q.ord : null, kategori: q.kategori || null, medlemmer: q.type === 'kategori' ? q.ord : null, fundet: q.fundet || null } : null };
      }) : null
    };
  };

  tilpasStørrelse();
  Skal.menuKnap(visMenu);
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
