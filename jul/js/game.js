/**
 * Pelles julekalender: skaermen, lyden og stemmen.
 *
 * Kalenderen er forsiden (overlayet, saa pilen i hjoernet altid foerer hertil):
 * én laage pr. skoledag (Kalender.LAAGER, 14 laager) rundt om Pelles puslespil
 * med 24 brikker. Laagerne frem til dagens skoledag kan aabnes, fremtidige
 * ryster blidt, og tidligere dages laager staar aabne. Det bestemmes KUN af
 * datoen (Kalender.aaben); intet gemmes. Dagens brikker ligger paa plads, naar
 * de er fundet i dag, og alle tidligere dages brikker ligger der altid.
 * ?dag=N i adressen lader, som om det er den N. december (til voksne og test).
 *
 * Et tryk paa en laage aabner dagens historier (én eller to i traek), hver med
 * tre afsnit med hvert sit billede
 * (billeder/dagNN-k.jpg, ellers en pladsholder i kode), og stemmen laeser
 * replikkerne én saetning ad gangen med underteksten paa en papirstrimmel. Ved
 * et spoergsmaal holdes en pause med et pulserende oere, saa boernene kan svare
 * hoejt. I hver histories tredje afsnit glimter brikken i billedet; et tryk paa
 * den, og den flyver ind i et lille puslespil. Bagefter kommer laagens opgave (lege.js),
 * en lille fejring og tilbage til kalenderen.
 *
 * Mangler et klip, siger enhedens stemme det, og er der ingen stemme (fx i en
 * test uden lyd), gaar afspilleren videre efter en beregnet tid pr. saetning.
 * Ingen netvaerk, ingen lagring: intet huskes, naar siden lukkes.
 */
(function () {
  'use strict';

  var K = window.Kalender, P = window.Puslespil, O = window.Opgaver, M = window.Maleri;
  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a';
  var LYT_TID = 5;                 // sekunder til at svare hoejt paa et spoergsmaal i historien
  var CELLE = (3 / 4 / 4) / (1 / 6); // en celles hoejde i forhold til bredden: 4:3 delt i 6 x 4

  // Skallen tror, den ligger to mapper nede (games/x/); julekalenderen ligger én, som bogen.
  var hjem = document.getElementById('hjem'); if (hjem) hjem.href = '../';

  var scene = document.getElementById('scene'), ctx = scene.getContext('2d');
  var overlay = document.getElementById('overlay'), kal = document.getElementById('kalender'), kctx = kal.getContext('2d');
  var styring = document.getElementById('styring'), undertekst = document.getElementById('undertekst'), linje = document.getElementById('linje');
  var knapTilbage = document.getElementById('tilbage'), knapPause = document.getElementById('pause'), knapFrem = document.getElementById('frem');
  var prikker = document.getElementById('prikker'), lydknap = document.getElementById('lydknap');

  /* ---------- datoen ---------- */

  function hentDato() {
    var m = /[?&]dag=(\d+)/.exec(window.location.search), nu = new Date();
    if (m) { var n = parseInt(m[1], 10); if (n >= 1 && n <= 31) return new Date(nu.getFullYear(), 11, n, 12); }
    return nu;
  }
  var DATO = hentDato();
  var fundet = {};          // brikker fundet i denne omgang (kun i hukommelsen)
  var aabnet = {};          // laager aabnet i denne omgang
  /* Laagerne har numre 1-14 (skoledage); brikkerne hoerer til historierne (dag 1-24). */
  function kanAabnes(nr) { return K.aaben(nr, DATO); }
  function idagNr() { return DATO.getMonth() === 11 && K.hverdag(DATO) ? K.skoledag(DATO) : 0; }
  function erIDag(nr) { return nr === idagNr(); }
  function staarAaben(nr) { return kanAabnes(nr) && (!erIDag(nr) || !!aabnet[nr]); }
  function paaPlads(dag) {
    var m = DATO.getMonth();
    if (m === 11) { var nr = K.laageFor(dag).nr; return nr < K.skoledag(DATO) || (nr <= K.skoledag(DATO) && !K.hverdag(DATO)) || !!fundet[dag]; }
    return m !== 10;
  }

  /* ---------- lyd ---------- */

  var lydTil = true, lyd = null;
  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();
    return lyd;
  }
  // iOS: lyden maa foerst starte efter et tryk. Derfor laves konteksten foerst her.
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });
  function tone(frekvens, laengde, styrke, type) {
    if (!lydTil || !lyd) return;
    try {
      var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
      o.type = type || 'triangle'; o.frequency.value = frekvens; g.gain.value = styrke || 0.12;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + laengde);
      o.connect(g); g.connect(k.destination); o.start(); o.stop(k.currentTime + laengde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) { toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 0.11); }, i * (mellemrum || 110)); }); }
  function dunk() { tone(180, 0.16, 0.16, 'sine'); }
  function klik() { tone(880, 0.06, 0.1, 'square'); tone(1320, 0.12, 0.08); }

  /* ---------- stemmen ---------- */

  var stemme = window.Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.9 });
  var taleGen = 0, taleTimer = null, kilder = [];
  function tie() {
    taleGen++; clearTimeout(taleTimer);
    stemme.tie();
    kilder.forEach(function (k) { try { k.stop(); } catch (e) { /* allerede stoppet */ } });
    kilder = [];
  }
  /** Saa laenge tager en saetning cirka at sige. Bruges, naar der ingen stemme er, og som vagt. */
  function varighed(tekst) { return 700 + String(tekst).length * 62; }
  /**
   * Sig en replik og kald faerdig bagefter. Med klip: naar klippet er faerdigt.
   * Med enhedens stemme: naar den er faerdig. Uden stemme: efter den beregnede tid.
   */
  function sige(tekst, faerdig) {
    tie();
    var g = taleGen, start = Date.now(), slut = false, anslag = varighed(tekst);
    function done() { if (slut || g !== taleGen) return; slut = true; clearTimeout(taleTimer); if (faerdig) faerdig(); }
    function vagt() {
      if (g !== taleGen) return;
      try {
        if (window.speechSynthesis && window.speechSynthesis.speaking && Date.now() - start < anslag * 3) { taleTimer = setTimeout(vagt, 300); return; }
      } catch (e) { /* ingen stemme */ }
      done();
    }
    taleTimer = setTimeout(vagt, anslag);
    stemme.sig(tekst, done, function (sek) { if (g !== taleGen) return; clearTimeout(taleTimer); taleTimer = setTimeout(done, sek * 1000 + 700); });
  }
  /* Ordklippene ("Her har du ordet kat.") laanes fra Bogstavvejen og Rimhulen og spilles hele, for sig. */
  var buffere = {};
  function hentKlip(sti) {
    if (!buffere[sti]) {
      buffere[sti] = fetch('../' + sti).then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); });
      buffere[sti].catch(function () { delete buffere[sti]; });
    }
    return buffere[sti];
  }
  function klip(ord, faerdig) {
    var info = O.ord(ord);
    if (!info) { if (faerdig) faerdig(); return; }
    if (!lydTil || !lyd) { sige(info.reserve, faerdig); return; }
    tie();
    var g = taleGen, slut = false;
    function done() { if (slut || g !== taleGen) return; slut = true; clearTimeout(taleTimer); if (faerdig) faerdig(); }
    taleTimer = setTimeout(function () { if (g === taleGen && !slut) sige(info.reserve, faerdig); }, 5000);
    hentKlip(info.klip).then(function (buf) {
      if (g !== taleGen) return;
      clearTimeout(taleTimer);
      var k = lydKontekst(), s = k.createBufferSource();
      s.buffer = buf; s.connect(k.destination); s.start(); kilder.push(s);
      s.onended = done; taleTimer = setTimeout(done, buf.duration * 1000 + 500);
    }).catch(function () { if (g === taleGen) sige(info.reserve, faerdig); });
  }
  /** Flere ting i traek: tekst (sige) eller { ord } (ordklip). Afbrydes, naar noget andet siges. */
  function raekke(trin, faerdig) {
    var i = 0;
    (function naeste() {
      if (i >= trin.length) { if (faerdig) faerdig(); return; }
      var t = trin[i++];
      if (typeof t === 'string') sige(t, naeste); else klip(t.ord, naeste);
    })();
  }

  /* ---------- billeder ---------- */

  Object.keys(O.FIGURER).forEach(function (n) { M.hent(O.FIGURER[n]); });
  Object.keys(O.TING).forEach(function (n) { M.hent(O.TING[n].billede); });
  var MOTIV = 'jul:billeder/puslespil.jpg', BAGGRUND = 'jul:billeder/kalender.jpg';
  M.hent(MOTIV); M.hent(BAGGRUND);
  var motivLaerred = document.createElement('canvas'); motivLaerred.width = 1200; motivLaerred.height = 900;
  var motivSnavset = true, pladsholdere = {};
  var baggrunde = { kalender: document.createElement('canvas'), opgave: document.createElement('canvas') }, baggrundSnavset = { kalender: true, opgave: true };
  var snavsetTimer = null;
  M.naarHentet(function () {
    clearTimeout(snavsetTimer);
    snavsetTimer = setTimeout(function () { motivSnavset = true; baggrundSnavset = { kalender: true, opgave: true }; pladsholdere = {}; }, 120);
  });
  function motivKilde() {
    if (M.klar(MOTIV)) return M.hent(MOTIV);
    if (motivSnavset) { var c = motivLaerred.getContext('2d'); c.clearRect(0, 0, 1200, 900); M.motiv(c, 1200, 900, 0); motivSnavset = false; }
    return motivLaerred;
  }
  /** Billedet daekker hele felt (som CSS cover). */
  function daek(c, billede, bb, bh, x, y, b, h) {
    var k = Math.max(b / bb, h / bh);
    c.drawImage(billede, x + (b - bb * k) / 2, y + (h - bh * k) / 2, bb * k, bh * k);
  }
  /**
   * Baggrunden. Kalenderen: det malede vinterbillede, ellers Noeddeskoven i sne
   * tegnet i kode. Opgaverne: den samme skov uden det store juletrae, saa der er ro.
   */
  function tegnBaggrund(c, W, H, hvad) {
    hvad = hvad || 'kalender';
    if (hvad === 'kalender' && M.klar(BAGGRUND)) { var i = M.hent(BAGGRUND); daek(c, i, i.naturalWidth, i.naturalHeight, 0, 0, W, H); return; }
    var dpr = dprNu(), cv = baggrunde[hvad];
    if (baggrundSnavset[hvad] || cv.width !== Math.round(W * dpr) || cv.height !== Math.round(H * dpr)) {
      cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
      var b = cv.getContext('2d'); b.setTransform(dpr, 0, 0, dpr, 0, 0); M.vinterscene(b, W, H, hvad === 'opgave'); baggrundSnavset[hvad] = false;
    }
    c.drawImage(cv, 0, 0, W, H);
  }

  /* ---------- laerreder og stoerrelse ---------- */

  var W = 0, H = 0;
  function dprNu() { return Math.min(window.devicePixelRatio || 1, 2); }
  function tilpas() {
    W = window.innerWidth; H = window.innerHeight;
    var d = dprNu();
    [scene, kal].forEach(function (cv) {
      cv.width = Math.round(W * d); cv.height = Math.round(H * d);
    });
    ctx.setTransform(d, 0, 0, d, 0, 0); kctx.setTransform(d, 0, 0, d, 0, 0);
    placerUndertekst();
  }
  window.addEventListener('resize', tilpas);

  /* ---------- partikler: fest og gnister ---------- */

  var FARVER = ['#d95f45', '#5f9fc9', '#93bc63', GUL, '#9b7bd4', '#e08a52'];
  var partikler = [], kalPartikler = [];
  function fest(liste, x, y, antal, fart, form) {
    for (var i = 0; i < (antal || 30); i++) {
      var v = Math.random() * Math.PI * 2, s = (fart || 260) * (0.35 + Math.random() * 0.75);
      liste.push({ x: x, y: y, vx: Math.cos(v) * s, vy: Math.sin(v) * s - (fart || 260) * 0.3, liv: 0, maks: 1 + Math.random() * 0.9,
        farve: FARVER[i % FARVER.length], r: 4 + Math.random() * 5, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10, form: form || (i % 3 ? 'konfetti' : 'gnist') });
    }
  }
  function opdaterPartikler(liste, dt) {
    for (var i = liste.length - 1; i >= 0; i--) {
      var p = liste[i];
      p.liv += dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 420 * dt; p.vx *= 0.985; p.rot += p.vr * dt;
      if (p.liv > p.maks) liste.splice(i, 1);
    }
  }
  function tegnPartikler(c, liste) {
    liste.forEach(function (p) {
      var a = 1 - p.liv / p.maks;
      if (p.form === 'gnist') { M.gnist(c, p.x, p.y, p.r * 1.6, a); return; }
      c.save(); c.globalAlpha = a; c.translate(p.x, p.y); c.rotate(p.rot);
      c.fillStyle = p.farve; c.fillRect(-p.r, -p.r * 0.45, p.r * 2, p.r * 0.9);
      c.restore();
    });
  }
  /* Sneen, der falder over kalenderen */
  var sne = [];
  for (var s0 = 0; s0 < 46; s0++) sne.push({ x: Math.random(), y: Math.random(), r: 1.5 + Math.random() * 3, v: 0.02 + Math.random() * 0.04, f: Math.random() * 6 });
  function tegnSne(c, dt) {
    c.fillStyle = 'rgba(255,255,255,.75)';
    sne.forEach(function (f) {
      f.y += f.v * dt; f.f += dt; if (f.y > 1.02) { f.y = -0.02; f.x = Math.random(); }
      c.beginPath(); c.arc((f.x + Math.sin(f.f * 0.8) * 0.01) * W, f.y * H, f.r, 0, 7); c.fill();
    });
  }

  /* ---------- ikoner ---------- */

  var PIL_FREM = '<svg viewBox="0 0 56 56" aria-hidden="true"><path d="M10 28h30" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round"/><path d="M30 14l15 14-15 14" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PIL_TILBAGE = '<svg viewBox="0 0 56 56" aria-hidden="true"><path d="M46 28H16" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round"/><path d="M26 14L11 28l15 14" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PAUSE = '<svg viewBox="0 0 56 56" aria-hidden="true"><rect x="15" y="12" width="9" height="32" rx="3" fill="#f8f1e6"/><rect x="32" y="12" width="9" height="32" rx="3" fill="#f8f1e6"/></svg>';
  var SPIL = '<svg viewBox="0 0 56 56" aria-hidden="true"><path d="M19 12l24 16-24 16z" fill="#f8f1e6" stroke="#f8f1e6" stroke-width="3" stroke-linejoin="round"/></svg>';
  knapTilbage.innerHTML = PIL_TILBAGE; knapFrem.innerHTML = PIL_FREM; knapPause.innerHTML = PAUSE;
  lydknap.innerHTML = window.Menu.lyd(lydTil);
  lydknap.addEventListener('click', function () { lydTil = !lydTil; if (!lydTil) tie(); lydknap.innerHTML = window.Menu.lyd(lydTil); });

  /** Hoejttaleren: tryk for at hoere spoergsmaalet igen. Tegnes paa laerredet. */
  function tegnHoejttaler(c, x, y, r) {
    c.save();
    c.fillStyle = PAPIR; c.shadowColor = 'rgba(107,85,68,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = KANT; c.beginPath();
    c.moveTo(x - r * 0.45, y - r * 0.16); c.lineTo(x - r * 0.22, y - r * 0.16); c.lineTo(x + r * 0.06, y - r * 0.4); c.lineTo(x + r * 0.06, y + r * 0.4);
    c.lineTo(x - r * 0.22, y + r * 0.16); c.lineTo(x - r * 0.45, y + r * 0.16); c.closePath(); c.fill();
    c.strokeStyle = KANT; c.lineWidth = Math.max(2, r * 0.09); c.lineCap = 'round';
    c.beginPath(); c.arc(x + r * 0.1, y, r * 0.26, -0.8, 0.8); c.stroke();
    c.beginPath(); c.arc(x + r * 0.1, y, r * 0.46, -0.8, 0.8); c.stroke();
    c.restore();
  }
  /** Oeret, der pulserer, mens boernene svarer hoejt. */
  function tegnOere(c, x, y, r, t) {
    var puls = 1 + Math.sin(t * 5) * 0.08;
    c.save();
    for (var i = 0; i < 3; i++) {
      var k = ((t * 0.7 + i / 3) % 1);
      c.strokeStyle = 'rgba(240,196,106,' + (0.7 * (1 - k)) + ')'; c.lineWidth = 6;
      c.beginPath(); c.arc(x, y, r * (1.05 + k * 0.8), 0, 7); c.stroke();
    }
    c.fillStyle = 'rgba(248,241,230,.95)'; c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 16; c.shadowOffsetY = 6;
    c.beginPath(); c.arc(x, y, r * puls, 0, 7); c.fill(); c.shadowColor = 'transparent';
    c.translate(x, y); c.scale(r / 50 * puls, r / 50 * puls);
    c.lineJoin = 'round'; c.lineCap = 'round';
    c.fillStyle = '#f4d3b4'; c.strokeStyle = KANT; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-6, 30); c.bezierCurveTo(-26, 26, -24, -2, -20, -14); c.bezierCurveTo(-14, -34, 18, -38, 22, -12);
    c.bezierCurveTo(25, 4, 10, 8, 8, 20); c.bezierCurveTo(6, 30, 0, 32, -6, 30); c.closePath(); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(-8, -6); c.bezierCurveTo(-6, -20, 12, -22, 10, -6); c.bezierCurveTo(9, 2, 0, 2, 0, 10); c.stroke();
    c.restore();
  }

  /* ================= kalenderen ================= */

  var LAAGEFARVER = ['#e9a08c', '#9fc6e2', '#b9d48f', '#f2d58f', '#c1aee6', '#efb48a'];
  var laager = [], ramme = null, kalNy = null, kalTid = 0;

  /** Laagerne rundt om puslespillet, med uret fra oeverst til venstre: 5 foroven, 2 til hoejre, 5 forneden, 2 til venstre. */
  function kalLayout() {
    var V = 66, Hm = 16, TOP = H > 520 ? 70 : 64, BUND = H > 520 ? 14 : 8;
    var N = K.LAAGER.length, NT = 5, NS = (N - 2 * NT) / 2;
    // Siderne skal have plads til to raekker og NS laager med luft imellem
    var d = Math.max(34, Math.min(100, (W - V - Hm - (NT - 1) * 12) / NT, (H - TOP - BUND) / (NS + 2 + (NS + 1) * 0.6)));
    var spann = W - V - Hm, dx = (spann - d) / (NT - 1);
    var yTop = TOP, yBund = H - BUND - d, R = yBund - (yTop + d), gy = (R - NS * d) / (NS + 1);
    var pos = [];
    for (var i = 0; i < NT; i++) pos.push([V + i * dx, yTop]);
    for (var j = 0; j < NS; j++) pos.push([W - Hm - d, yTop + d + gy * (j + 1) + j * d]);
    for (var k = 0; k < NT; k++) pos.push([W - Hm - d - k * dx, yBund]);
    for (var l = 0; l < NS; l++) pos.push([V, yBund - gy * (l + 1) - (l + 1) * d]);
    var gamle = laager;
    laager = pos.map(function (p, n) {
      var g = gamle[n] || {};
      return { nr: n + 1, x: p[0], y: p[1], d: d, ryst: g.ryst || 0, sving: g.sving || 0, aabner: g.aabner || false };
    });
    // Puslespillet i midten, i en trae-ramme
    var x0 = V + d + 18, x1 = W - Hm - d - 18, y0 = yTop + d + 14, y1 = yBund - 14;
    var bb = Math.min(x1 - x0, (y1 - y0) * 4 / 3) * 0.94, bh = bb * 3 / 4;
    ramme = { x: (x0 + x1) / 2 - bb / 2, y: (y0 + y1) / 2 - bh / 2, b: bb, h: bh, cb: bb / P.KOL, ch: bh / P.RAEK };
  }

  function tegnLaage(c, l, t) {
    var x = l.x, y = l.y, d = l.d, aaben = staarAaben(l.nr), idag = erIDag(l.nr) && !aabnet[l.nr], dage = K.LAAGER[l.nr - 1].dage;
    var sving = aaben ? 1 : l.sving;
    c.save();
    if (l.ryst > 0) { c.translate(x + d / 2, y + d); c.rotate(Math.sin(l.ryst * 34) * 0.09 * l.ryst); c.translate(-x - d / 2, -y - d); }
    // Glimt om dagens laage
    if (idag && sving === 0) {
      var p = 0.5 + 0.5 * Math.sin(t * 3.2), ud = 5 + 4 * p;
      c.save(); c.shadowColor = 'rgba(240,196,106,.95)'; c.shadowBlur = 20 + 16 * p;
      M.rr(c, x - ud, y - ud, d + 2 * ud, d + 2 * ud, d * 0.22, 'rgba(240,196,106,' + (0.65 + 0.35 * p) + ')'); c.restore();
    }
    // Indersiden: varmt lys og laagens brikker (én eller to), naar de er fundet
    if (sving > 0) {
      var g = c.createRadialGradient(x + d / 2, y + d / 2, 2, x + d / 2, y + d / 2, d * 0.7);
      g.addColorStop(0, '#f8e3b4'); g.addColorStop(1, '#b18a56');
      M.rr(c, x, y, d, d, d * 0.18, g, '#8a663d', 3);
      dage.forEach(function (dag, i) {
        var mx = x + d / 2 + (dage.length > 1 ? (i - 0.5) * d * 0.4 : 0);
        if (paaPlads(dag)) {
          var br = P.brik(dag), cb = d * (dage.length > 1 ? 0.32 : 0.4), ch = cb * CELLE;
          c.save(); c.translate(mx - cb / 2, y + d / 2 - ch / 2);
          M.brik(c, br, cb, ch, motivKilde(), t + dag * 0.3, 0.3);
          c.restore();
        } else {
          M.gnist(c, mx, y + d / 2, d * 0.14, 0.6 + 0.4 * Math.sin(t * 4 + dag));
        }
      });
    }
    // Selve laagen, haengslet i venstre side
    var vinkel = Math.min(1, sving) * Math.PI * 0.62, kx = Math.cos(vinkel);
    if (kx > 0.02 || sving === 0) {
      c.save();
      c.translate(x, y); c.transform(kx, -Math.sin(vinkel) * 0.12, 0, 1, 0, 0);
      var farve = LAAGEFARVER[(l.nr * 5) % LAAGEFARVER.length];
      c.shadowColor = 'rgba(107,85,68,.22)'; c.shadowBlur = 8; c.shadowOffsetY = 5;
      M.rr(c, 0, 0, d, d, d * 0.18, farve);
      c.shadowColor = 'transparent';
      var lys = c.createLinearGradient(0, 0, 0, d);
      lys.addColorStop(0, 'rgba(255,255,255,.35)'); lys.addColorStop(1, 'rgba(94,74,58,.08)');
      M.rr(c, 0, 0, d, d, d * 0.18, lys);
      M.rr(c, d * 0.09, d * 0.09, d * 0.82, d * 0.82, d * 0.12, null, 'rgba(94,74,58,.22)', 2);
      c.fillStyle = KANT; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.font = '800 ' + Math.round(d * 0.44) + 'px ui-rounded,"SF Pro Rounded",system-ui,sans-serif';
      c.fillText(String(l.nr), d * 0.5, d * 0.53);
      c.fillStyle = '#b18a56'; c.beginPath(); c.arc(d * 0.84, d * 0.5, d * 0.045, 0, 7); c.fill();
      c.restore();
    }
    if (idag && sving === 0) {
      for (var i = 0; i < 3; i++) { var v = t * 1.6 + i * 2.1; M.gnist(c, x + d / 2 + Math.cos(v) * d * 0.62, y + d / 2 + Math.sin(v) * d * 0.62, d * 0.09, 0.5 + 0.5 * Math.sin(t * 5 + i)); }
    }
    c.restore();
  }

  function tegnRamme(c, t) {
    var r = ramme, f = Math.max(10, r.b * 0.035);
    c.save();
    c.shadowColor = 'rgba(94,74,58,.32)'; c.shadowBlur = 22; c.shadowOffsetY = 10;
    M.rr(c, r.x - f, r.y - f, r.b + 2 * f, r.h + 2 * f, f * 1.2, '#b18a56');
    c.restore();
    var g = c.createLinearGradient(r.x - f, r.y - f, r.x + r.b + f, r.y + r.h + f);
    g.addColorStop(0, '#d9ba8a'); g.addColorStop(0.5, '#b18a56'); g.addColorStop(1, '#8a663d');
    M.rr(c, r.x - f, r.y - f, r.b + 2 * f, r.h + 2 * f, f * 1.2, g);
    M.rr(c, r.x - 3, r.y - 3, r.b + 6, r.h + 6, 6, '#8a663d');
    M.rr(c, r.x, r.y, r.b, r.h, 4, '#efe3d0');
    // Tomme pladser: svagt stiplede omrids. Dagens plads glimter, indtil brikken er fundet.
    P.BRIKKER.forEach(function (br) {
      if (paaPlads(br.dag)) return;
      c.save(); c.translate(r.x + br.kol * r.cb, r.y + br.raek * r.ch);
      M.brikSti(c, br, r.cb, r.ch);
      var idag = erIDag(K.laageFor(br.dag).nr);
      c.setLineDash([5, 6]);
      c.strokeStyle = idag ? 'rgba(240,196,106,' + (0.6 + 0.4 * Math.sin(t * 3)) + ')' : 'rgba(138,102,61,.35)';
      c.lineWidth = idag ? 3 : 1.5; c.stroke();
      c.restore();
    });
    var motivB = motivKilde();
    P.BRIKKER.forEach(function (br) {
      if (!paaPlads(br.dag)) return;
      var ny = kalNy && kalNy.dage.indexOf(br.dag) >= 0, k = ny ? 1 + Math.max(0, Math.sin(Math.min(1, kalNy.t) * Math.PI)) * 0.25 : 1;
      c.save();
      c.translate(r.x + (br.kol + 0.5) * r.cb, r.y + (br.raek + 0.5) * r.ch); c.scale(k, k); c.translate(-r.cb / 2, -r.ch / 2);
      M.brik(c, br, r.cb, r.ch, motivB, t + br.dag * 0.37, ny ? 1 : 0);
      c.restore();
    });
  }

  function tegnKalender(dt) {
    kalTid += dt;
    var c = kctx;
    tegnBaggrund(c, W, H);
    tegnSne(c, dt);
    laager.forEach(function (l) {
      if (l.ryst > 0) l.ryst = Math.max(0, l.ryst - dt * 1.6);
      if (l.aabner) l.sving = Math.min(1, l.sving + dt * 1.5);
    });
    tegnRamme(c, kalTid);
    laager.forEach(function (l) { tegnLaage(c, l, kalTid); });
    if (kalNy) { kalNy.t += dt; if (kalNy.t > 3) kalNy = null; }
    opdaterPartikler(kalPartikler, dt);
    tegnPartikler(c, kalPartikler);
  }

  var aabnerNu = null;
  kal.addEventListener('pointerdown', function (e) {
    if (overlay.hidden || aabnerNu) return;
    var r = kal.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    var l = laager.filter(function (q) { return x >= q.x - 6 && x <= q.x + q.d + 6 && y >= q.y - 6 && y <= q.y + q.d + 6; })[0];
    if (!l) return;
    if (!kanAabnes(l.nr)) { l.ryst = 1; dunk(); return; }        // fremtidig laage: blid rysten, ingen straf
    aabnet[l.nr] = true;
    aabnerNu = l;
    if (l.sving < 1) { l.aabner = true; melodi([523, 659, 784], 90); } else tone(660, 0.12);
    fest(kalPartikler, l.x + l.d / 2, l.y + l.d / 2, 16, 180, 'gnist');
    setTimeout(function () { aabnerNu = null; startHistorie(K.LAAGER[l.nr - 1]); }, l.sving < 1 ? 850 : 350);
  });

  /** Tilbage til kalenderen. nyLaage: laagen, der lige er klaret; dens nye brikker gnistrer paa plads. */
  function visKalender(nyLaage) {
    tie();
    if (hist) hist.gen++;
    skaerm = 'kalender'; hist = null; leg = null;
    overlay.hidden = false; styring.hidden = true; undertekst.hidden = true;
    var nye = nyLaage ? K.LAAGER[nyLaage - 1].dage.filter(paaPlads) : [];
    if (nye.length) {
      kalNy = { dage: nye, t: 0 };
      if (ramme) setTimeout(function () {
        nye.forEach(function (dag) { var br = P.brik(dag); fest(kalPartikler, ramme.x + (br.kol + 0.5) * ramme.cb, ramme.y + (br.raek + 0.5) * ramme.ch, 26, 220, 'gnist'); });
        melodi([784, 988, 1175], 90);
      }, 300);
    }
  }

  /* ================= historien ================= */

  var skaerm = 'kalender', hist = null, leg = null, LEGE = window.JulLege;

  function billedFelt() {
    var V = 70, Hm = W > 700 ? 122 : 86, top = 12, bund = H > 520 ? 92 : 58;
    var b = Math.min(W - V - Hm, (H - top - bund) * 4 / 3), h = b * 3 / 4;
    return { x: V + (W - V - Hm - b) / 2, y: top + (H - top - bund - h) / 2, b: b, h: h };
  }
  function placerUndertekst() {
    var f = billedFelt();
    undertekst.style.left = f.x + 'px'; undertekst.style.width = f.b + 'px';
    undertekst.style.top = (f.y + f.h + 10) + 'px';
    undertekst.style.minHeight = Math.max(40, H - (f.y + f.h + 10) - 10) + 'px';
  }
  function visLinje(t) { linje.textContent = t; }
  function opdaterPrikker() {
    prikker.innerHTML = hist.liste.map(function (x, i) { return '<i class="' + (i === hist.afsnit ? 'her' : i < hist.afsnit ? 'set' : '') + '"></i>'; }).join('');
  }

  /** Laagens historier i traek: liste er alle afsnittene, hvert med sin dag og sit nummer (0-2) i historien. */
  function startHistorie(L) {
    tie();
    overlay.hidden = true; styring.hidden = false; undertekst.hidden = false;
    skaerm = 'historie'; leg = null;
    var liste = [], brikker = {};
    L.dage.forEach(function (n) {
      var dag = K.DAGE[n - 1];
      dag.afsnit.forEach(function (a, i) { M.hent('jul:' + a.billede); liste.push({ a: a, dag: dag, nr: i }); });
      brikker[n] = { taget: false, lagt: false, flyv: null, lomme: 0 };
    });
    hist = { laage: L, liste: liste, dag: liste[0].dag, f: O.forberedLaage(L, K), afsnit: 0, replik: 0, del: 0, saetning: 0, pause: false, lyt: null, slut: false, gen: 0,
             brikker: brikker, brik: brikker[L.dage[0]], vent: 0, tid: 0 };
    knapPause.innerHTML = PAUSE;
    placerUndertekst();
    visAfsnit(0);
  }
  /** Er vi i en histories tredje afsnit, hvor brikken ligger? Og er det laagens sidste afsnit? */
  function brikAfsnit() { return hist.liste[hist.afsnit].nr === 2; }
  function sidsteAfsnit() { return hist.afsnit === hist.liste.length - 1; }
  /** Videre efter en historie: naeste historie, eller opgaven efter den sidste. */
  function videre() { if (sidsteAfsnit()) startOpgave(); else visAfsnit(hist.afsnit + 1); }
  function visAfsnit(n) {
    tie();
    hist.afsnit = n; hist.dag = hist.liste[n].dag; hist.brik = hist.brikker[hist.dag.dag];
    hist.replik = 0; hist.del = 0; hist.saetning = 0; hist.slut = false; hist.lyt = null; hist.vent = 0;
    hist.pause = false; knapPause.innerHTML = PAUSE;
    opdaterPrikker();
    hist.gen++;
    var g = hist.gen;
    visLinje('');
    setTimeout(function () { if (hist && g === hist.gen) laes(); }, 500);
  }
  /** Laes fra det sted, historien er naaet til: én saetning ad gangen, med pause efter et spoergsmaal. */
  function laes() {
    if (!hist || hist.pause || hist.brik.flyv) return;
    hist.gen++;
    var g = hist.gen, a = hist.liste[hist.afsnit].a, r = a.tekst[hist.replik];
    if (!r) { afsnitSlut(); return; }
    var dele = typeof r === 'string' ? [r] : [r.spoerg, null, r.svar];
    if (hist.del >= dele.length) { hist.replik++; hist.del = 0; hist.saetning = 0; laes(); return; }
    if (dele[hist.del] === null) { hist.lyt = { t: 0, varer: LYT_TID }; return; }
    var s = O.saetningerAf(dele[hist.del]);
    if (hist.saetning >= s.length) { hist.del++; hist.saetning = 0; laes(); return; }
    visLinje(s[hist.saetning]);
    sige(s[hist.saetning], function () {
      if (!hist || g !== hist.gen) return;
      hist.saetning++;
      setTimeout(function () { if (hist && g === hist.gen) laes(); }, 160);
    });
  }
  function afsnitSlut() {
    hist.slut = true;
    var g = hist.gen;
    if (!brikAfsnit()) { setTimeout(function () { if (hist && g === hist.gen && !hist.pause) visAfsnit(hist.afsnit + 1); }, 1300); return; }
    if (hist.brik.lagt) { setTimeout(function () { if (hist && g === hist.gen && !hist.pause) videre(); }, 900); return; }
    if (!hist.brik.taget) { hist.vent = 0; visLinje(O.TEKST.findBrikken); sige(O.TEKST.findBrikken); }
  }
  function startOpgave() {
    if (!hist) return;
    var dag = hist.dag, L = hist.laage, f = hist.f;
    tie();
    styring.hidden = true; undertekst.hidden = true;
    skaerm = 'opgave';
    leg = LEGE[f.type] ? LEGE[f.type](f, dag, J, function () { opgaveFaerdig(L, f); }) : null;
    hist = null;
    if (!leg) opgaveFaerdig(L, f);
  }
  /** Er historien juleaften, hvor den sidste brik laegges i det store puslespil i opgaven? */
  function erPusleDag(dag) { return dag.opgave && dag.opgave.type === 'puslespil'; }
  function opgaveFaerdig(L, f) {
    f.dele.forEach(function (x) { if (x.type === 'puslespil') fundet[x.dag] = true; });
    skaerm = 'fejring';
    melodi([523, 659, 784, 1047, 1319], 110);
    fest(partikler, W * 0.3, H * 0.4, 40, 320); fest(partikler, W * 0.7, H * 0.4, 40, 320);
    setTimeout(function () { if (skaerm === 'fejring') fest(partikler, W * 0.5, H * 0.3, 50, 360); }, 500);
    sige(f.fejring, function () { setTimeout(function () { if (skaerm === 'fejring') visKalender(L.nr); }, 1400); });
  }

  /** Hvor brikken ligger i billedet, og hvor stor den er. */
  function brikIBilledet(f) {
    var br = P.brik(hist.dag.dag), cb = f.b * 0.1, ch = cb * CELLE;
    return { br: br, x: f.x + hist.dag.brik.x * f.b, y: f.y + hist.dag.brik.y * f.h, cb: cb, ch: ch };
  }
  /** Det lille puslespil, der toner frem, naar brikken flyver ind. */
  function lilleRamme(f) {
    var b = f.b * 0.46, h = b * 3 / 4;
    return { x: f.x + f.b / 2 - b / 2, y: f.y + f.h / 2 - h / 2, b: b, h: h, cb: b / P.KOL, ch: h / P.RAEK };
  }
  function tagBrik() {
    var bk = hist.brik;
    bk.taget = true;
    melodi([784, 988, 1175], 80);
    var f = billedFelt(), p = brikIBilledet(f);
    fest(partikler, p.x, p.y, 20, 200, 'gnist');
    if (erPusleDag(hist.dag)) {
      // Juleaften laegges den sidste brik i det store puslespil i opgaven; her tager Pelle den bare med.
      bk.lomme = 0.0001; bk.lagt = true;
      if (hist.slut) { var g0 = hist.gen; setTimeout(function () { if (hist && g0 === hist.gen) videre(); }, 1400); }
      return;
    }
    // Historien holder pause, mens brikken flyver ind i puslespillet
    tie(); hist.gen++; hist.lyt = null;
    bk.flyv = { t: 0, landet: false, ud: 0 };
  }
  function brikLandet() {
    var bk = hist.brik, dag = hist.dag.dag;
    bk.flyv.landet = true;
    fundet[dag] = true;
    klik();
    var f = billedFelt(), l = lilleRamme(f), br = P.brik(dag);
    fest(partikler, l.x + (br.kol + 0.5) * l.cb, l.y + (br.raek + 0.5) * l.ch, 30, 240, 'gnist');
    var g = hist.gen;
    visLinje(O.TEKST.brikLagt);
    sige(O.TEKST.brikLagt, function () {
      setTimeout(function () {
        if (!hist || g !== hist.gen) return;
        bk.flyv.ud = 0.0001;
      }, 700);
    });
  }
  function flyvSlut() {
    var bk = hist.brik;
    bk.flyv = null; bk.lagt = true;
    if (hist.slut) videre(); else laes();
  }

  function opdaterHistorie(dt) {
    hist.tid += dt;
    if (hist.pause) return;
    if (hist.lyt) {
      hist.lyt.t += dt;
      if (hist.lyt.t >= hist.lyt.varer) { hist.lyt = null; hist.del++; hist.saetning = 0; laes(); }
    }
    var bk = hist.brik;
    if (bk.lomme > 0) bk.lomme = Math.min(1, bk.lomme + dt * 1.2);
    if (bk.flyv) {
      bk.flyv.t += dt;
      if (!bk.flyv.landet && bk.flyv.t >= 1.9) brikLandet();
      if (bk.flyv.ud > 0) { bk.flyv.ud += dt * 2; if (bk.flyv.ud >= 1) flyvSlut(); }
    }
    if (!hist || hist.brik !== bk) return;     // flyvningen sluttede, og opgaven eller naeste historie er begyndt
    if (hist.slut && brikAfsnit() && !bk.taget) {
      hist.vent += dt;
      if (hist.vent > 16) { hist.vent = 0; sige(O.TEKST.findBrikken); }
    }
  }

  function pladsholder(dag, nr, b, h) {
    var noegle = dag.dag + '-' + nr + '-' + Math.round(b) + 'x' + Math.round(h);
    if (!pladsholdere[noegle]) {
      var d = dprNu(), cv = document.createElement('canvas');
      cv.width = Math.round(b * d); cv.height = Math.round(h * d);
      var c = cv.getContext('2d'); c.setTransform(d, 0, 0, d, 0, 0);
      M.pladsholder(c, b, h, dag, nr);
      pladsholdere = {}; pladsholdere[noegle] = cv;     // kun den, der vises nu
    }
    return pladsholdere[noegle];
  }

  function tegnHistorie(c, dt) {
    var f = billedFelt(), t = hist.tid, dag = hist.dag, a = hist.liste[hist.afsnit].a, sti = 'jul:' + a.billede;
    c.fillStyle = '#e5d3ae'; c.fillRect(0, 0, W, H);
    // Billedet i en bloed ramme med skygge
    c.save(); c.shadowColor = 'rgba(94,74,58,.35)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
    M.rr(c, f.x - 6, f.y - 6, f.b + 12, f.h + 12, 18, PAPIR); c.restore();
    c.save(); c.beginPath(); c.roundRect(f.x, f.y, f.b, f.h, 12); c.clip();
    if (M.klar(sti)) c.drawImage(M.hent(sti), f.x, f.y, f.b, f.h);
    else c.drawImage(pladsholder(dag, hist.liste[hist.afsnit].nr, f.b, f.h), f.x, f.y, f.b, f.h);
    c.restore();

    var bk = hist.brik;
    // Brikken i historiens tredje afsnit: den glimter, til den er taget
    if (brikAfsnit()) {
      var p = brikIBilledet(f), motivB = motivKilde();
      if (!bk.taget) {
        var glans = hist.slut ? 1 : 0.5, puls = 1 + Math.sin(t * 4) * 0.05 * (hist.slut ? 2 : 1);
        var g = c.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.cb * 1.3);
        g.addColorStop(0, 'rgba(251,227,168,' + (0.55 + 0.25 * Math.sin(t * 3)) + ')'); g.addColorStop(1, 'rgba(251,227,168,0)');
        c.fillStyle = g; c.beginPath(); c.arc(p.x, p.y, p.cb * 1.3, 0, 7); c.fill();
        c.save(); c.translate(p.x, p.y); c.rotate(-0.18); c.scale(puls, puls); c.translate(-p.cb / 2, -p.ch / 2);
        M.brik(c, p.br, p.cb, p.ch, motivB, t, glans); c.restore();
        for (var i = 0; i < 3; i++) {
          var v = t * 1.3 + i * 2.1;
          M.gnist(c, p.x + Math.cos(v) * p.cb * 0.75, p.y + Math.sin(v * 1.3) * p.ch * 0.7, p.cb * 0.12, 0.5 + 0.5 * Math.sin(t * 5 + i));
        }
      } else if (bk.lomme > 0) {
        // Juleaften: brikken ligger klar nede i hjoernet, til den skal laegges i puslespillet
        var e = 1 - Math.pow(1 - bk.lomme, 3), lx = f.x + f.b - p.cb * 1.1, ly = f.y + f.h - p.ch * 1.1;
        var x = p.x + (lx - p.x) * e, y = p.y + (ly - p.y) * e, k = 1 + e * 0.4;
        c.save(); c.translate(x, y); c.scale(k, k); c.translate(-p.cb / 2, -p.ch / 2);
        M.brik(c, p.br, p.cb, p.ch, motivB, t, 1); c.restore();
      }
      if (bk.flyv) tegnFlyvning(c, f, p, bk.flyv, t);
    }

    // Oeret, mens boernene svarer
    if (hist.lyt) tegnOere(c, f.x + f.b / 2, f.y + f.h * 0.78, Math.min(64, f.h * 0.11), hist.lyt.t);
    // Pause: et blegt lag over billedet
    if (hist.pause) { c.fillStyle = 'rgba(248,241,230,.35)'; c.beginPath(); c.roundRect(f.x, f.y, f.b, f.h, 12); c.fill(); }
  }

  function tegnFlyvning(c, f, p, fl, t) {
    var l = lilleRamme(f), synlig = Math.min(1, fl.t / 0.45) * (1 - Math.min(1, fl.ud));
    var br = p.br, motivB = motivKilde();
    c.save(); c.globalAlpha = synlig;
    c.fillStyle = 'rgba(94,74,58,.25)'; c.beginPath(); c.roundRect(f.x, f.y, f.b, f.h, 12); c.fill();
    var fr = Math.max(6, l.b * 0.035);
    M.rr(c, l.x - fr, l.y - fr, l.b + 2 * fr, l.h + 2 * fr, fr, '#b18a56');
    M.rr(c, l.x, l.y, l.b, l.h, 3, '#efe3d0');
    P.BRIKKER.forEach(function (q) {
      c.save(); c.translate(l.x + q.kol * l.cb, l.y + q.raek * l.ch);
      if (q.dag !== br.dag && paaPlads(q.dag)) M.brik(c, q, l.cb, l.ch, motivB, null);
      else if (q.dag === br.dag || !paaPlads(q.dag)) {
        M.brikSti(c, q, l.cb, l.ch); c.setLineDash([4, 5]);
        c.strokeStyle = q.dag === br.dag ? 'rgba(240,196,106,.95)' : 'rgba(138,102,61,.3)'; c.lineWidth = q.dag === br.dag ? 2.5 : 1.2; c.stroke();
      }
      c.restore();
    });
    c.restore();
    // Brikken flyver i en bue fra billedet til sin plads
    var u = Math.max(0, Math.min(1, (fl.t - 0.35) / 1.5)), e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
    var mx = l.x + (br.kol + 0.5) * l.cb, my = l.y + (br.raek + 0.5) * l.ch;
    var x = p.x + (mx - p.x) * e, y = p.y + (my - p.y) * e - Math.sin(e * Math.PI) * f.h * 0.18;
    var skala = (1 - e) + e * (l.cb / p.cb), drej = -0.18 * (1 - e) + Math.sin(e * Math.PI) * 0.6;
    c.save(); c.globalAlpha = fl.landet ? synlig : 1;
    c.translate(x, y); c.rotate(drej); c.scale(skala, skala); c.translate(-p.cb / 2, -p.ch / 2);
    M.brik(c, br, p.cb, p.ch, motivB, t, 1);
    c.restore();
  }

  /* Knapperne i historien */
  knapPause.addEventListener('click', function () {
    if (!hist || hist.brik.flyv) return;
    hist.pause = !hist.pause;
    knapPause.innerHTML = hist.pause ? SPIL : PAUSE;
    knapPause.setAttribute('aria-label', hist.pause ? 'Fortsæt' : 'Pause');
    if (hist.pause) { tie(); hist.gen++; return; }
    if (hist.lyt) return;
    if (hist.slut) afsnitSlut(); else laes();
  });
  knapTilbage.addEventListener('click', function () {
    if (!hist || hist.brik.flyv) return;
    tone(520, 0.1);
    visAfsnit(Math.max(0, hist.afsnit - 1));
  });
  knapFrem.addEventListener('click', function () {
    if (!hist || hist.brik.flyv) return;
    tone(660, 0.1);
    if (!brikAfsnit()) { visAfsnit(hist.afsnit + 1); return; }
    if (hist.brik.lagt) { videre(); return; }
    tie(); hist.gen++; hist.lyt = null; hist.pause = false; knapPause.innerHTML = PAUSE;
    afsnitSlut();
  });

  /* ================= opgaverne ================= */

  /** Hjaelperne, legene i lege.js bruger. */
  var J = {
    sige: sige, klip: klip, raekke: raekke, tie: tie, tone: tone, melodi: melodi, dunk: dunk, klik: klik,
    fest: function (x, y, antal, fart, form) { fest(partikler, x, y, antal, fart, form); },
    motivKilde: motivKilde, paaPlads: paaPlads, tegnBaggrund: tegnBaggrund,
    W: function () { return W; }, H: function () { return H; }
  };
  function hoejttalerPlads() { var r = Math.min(34, H * 0.05); return { x: W - r - 18, y: r + 18, r: r }; }

  function tegnOpgave(c, dt) {
    tegnBaggrund(c, W, H, 'opgave');
    c.fillStyle = 'rgba(248,241,230,.55)'; c.fillRect(0, 0, W, H);
    if (leg) { if (leg.opdater) leg.opdater(dt); leg.tegn(c, W, H); }
    if (skaerm === 'opgave' && leg && leg.gentag) { var hp = hoejttalerPlads(); tegnHoejttaler(c, hp.x, hp.y, hp.r); }
  }

  /* ---------- tryk paa laerredet: hver finger for sig (pointerId) ---------- */

  function punkt(e) { var r = scene.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  scene.addEventListener('pointerdown', function (e) {
    var p = punkt(e);
    if (skaerm === 'historie' && hist) {
      if (hist.lyt) { hist.lyt.varer = 0; return; }                 // et tryk springer pausen over
      if (brikAfsnit() && !hist.brik.taget && !hist.pause) {
        var f = billedFelt(), b = brikIBilledet(f);
        if (Math.hypot(p[0] - b.x, p[1] - b.y) < Math.max(56, b.cb * 1.1)) tagBrik();
      }
      return;
    }
    if (skaerm === 'opgave' && leg) {
      var hp = hoejttalerPlads();
      if (leg.gentag && Math.hypot(p[0] - hp.x, p[1] - hp.y) < hp.r + 10) { tone(600, 0.08); leg.gentag(); return; }
      if (leg.ned) leg.ned(p[0], p[1], e.pointerId);
    }
  });
  scene.addEventListener('pointermove', function (e) { if (skaerm === 'opgave' && leg && leg.flyt) { var p = punkt(e); leg.flyt(p[0], p[1], e.pointerId); } });
  ['pointerup', 'pointercancel'].forEach(function (type) {
    scene.addEventListener(type, function (e) { if (skaerm === 'opgave' && leg && leg.op) { var p = punkt(e); leg.op(p[0], p[1], e.pointerId); } });
  });
  // Dobbelttryk-zoom findes stadig paa iPad selv med user-scalable=no.
  var sidsteTryk = 0;
  document.addEventListener('touchend', function (e) { var nu = Date.now(); if (nu - sidsteTryk < 320) e.preventDefault(); sidsteTryk = nu; }, { passive: false });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) return;
    tie();
    if (hist && !hist.pause && !hist.brik.flyv) { hist.pause = true; hist.gen++; knapPause.innerHTML = SPIL; }
  });

  /* ---------- loekken ---------- */

  var sidst = 0;
  function loekke(nu) {
    var dt = Math.min(0.05, sidst ? (nu - sidst) / 1000 : 0.016); sidst = nu;
    if (!overlay.hidden) tegnKalender(dt);
    else {
      ctx.clearRect(0, 0, W, H);
      if (skaerm === 'historie' && hist) { opdaterHistorie(dt); if (hist) tegnHistorie(ctx, dt); }
      else if (skaerm === 'opgave' || skaerm === 'fejring') tegnOpgave(ctx, dt);
      opdaterPartikler(partikler, dt);
      tegnPartikler(ctx, partikler);
    }
    window.requestAnimationFrame(loekke);
  }

  tilpas();
  kalLayout();
  window.addEventListener('resize', kalLayout);
  window.Skal.menuKnap(function () { visKalender(); });
  visKalender();
  window.requestAnimationFrame(loekke);

  /* Til test i en browser-automat: hvor er vi, og hvor ligger tingene */
  window.JulSkaerm = {
    skaerm: function () { return skaerm; }, hist: function () { return hist; }, leg: function () { return leg; },
    laager: function () { return laager; }, ramme: function () { return ramme; }, billedFelt: billedFelt,
    brik: function () { return hist ? brikIBilledet(billedFelt()) : null; }, fundet: fundet, dato: DATO,
    startHistorie: function (n) { startHistorie(K.LAAGER[n - 1]); }, startOpgave: function (n) { startHistorie(K.LAAGER[n - 1]); startOpgave(); }
  };
})();
