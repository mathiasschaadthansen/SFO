/**
 * Bogen om Noeddeskoven: skaermen.
 *
 * Forsiden er bogens egen menu (overlayet): start, print og lyd. Naar bogen er
 * aaben, viser hvert opslag billedet til venstre og teksten til hoejre, og
 * stemmen laeser teksten hoejt, naar man blader. Paa hvert opslag gemmer
 * skruenoeglen sig i billedet (det malede fra Gemini, ellers det kodetegnede);
 * trykker man paa den, faar den en ring, og
 * stemmen siger "Du fandt den" (klippet laanes fra Vrimleskoven).
 *
 * Der er ingen printknap i appen: PDF'en laves én gang med
 * vaerktoej/lav-bog-pdf.js (byggePrint tegner alle sider i #print, ét ark A4
 * paa tvaers pr. opslag). Ingen netvaerk, ingen lagring: bogen husker ikke,
 * hvor man kom til.
 */
(function () {
  'use strict';

  var B = window.Bog, S = window.Scener, OPSLAG = B.OPSLAG, W = B.BREDDE, H = B.HOEJDE;
  var KANT = '#5e4a3a', GUL = '#f0c46a';

  // Skallen tror, den ligger to mapper nede (games/x/); bogen ligger én.
  var hjem = document.getElementById('hjem'); if (hjem) hjem.href = '../';

  var bog = document.getElementById('bog'), overlay = document.getElementById('overlay'), scene = document.getElementById('scene');
  var tekstEl = document.getElementById('tekst'), rimEl = document.getElementById('rim'), besoegEl = document.getElementById('besoeg'), findEl = document.getElementById('find');
  var prikker = document.getElementById('prikker'), frem = document.getElementById('frem'), tilbage = document.getElementById('tilbage'), hoer = document.getElementById('hoer');
  var ctx = scene.getContext('2d');

  /* ---------- lyd og stemme (som i Vrimleskoven) ---------- */

  var lydTil = true, lyd = null;
  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();
    return lyd;
  }
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });
  function tone(frekvens, laengde, styrke) {
    if (!lydTil) return;
    try {
      var k = lydKontekst(), o = k.createOscillator(), g = k.createGain();
      o.type = 'triangle'; o.frequency.value = frekvens; g.gain.value = styrke || 0.14;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + laengde);
      o.connect(g).connect(k.destination); o.start(); o.stop(k.currentTime + laengde);
    } catch (e) { /* lyd er pynt */ }
  }
  function melodi(toner, mellemrum) { toner.forEach(function (f, i) { setTimeout(function () { tone(f, 0.18, 0.12); }, i * mellemrum); }); }

  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    stemme = window.speechSynthesis.getVoices().filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }

  /*
   * Klippene hentes direkte. Spillene spoerger foerst lyd/klip.json, om et klip
   * findes, men det maa bogen ikke: staar der en gammel klip.json i iPadens
   * cache, tror bogen, at klippene mangler, og laeser hele bogen op med
   * enhedens robotstemme — selv om filerne ligger lige ved siden af. Derfor
   * proeves klippet altid, og enhedens stemme bruges kun, hvis det slaar fejl.
   */
  var buffere = {}, aktivtKlip = null;
  function hentKlip(sti) {
    if (!buffere[sti]) {
      buffere[sti] = fetch(sti).then(function (r) { if (!r.ok) throw new Error(sti); return r.arrayBuffer(); })
        .then(function (ab) { return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); }); })
        .catch(function (fejl) { delete buffere[sti]; throw fejl; });   // glem fejlen, saa naeste tryk proever igen
    }
    return buffere[sti];
  }
  function stopKlip() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }
  function afspil(stier, reserveTekst) {
    stopKlip();
    if (!lydTil) return;
    Promise.all(stier.map(hentKlip)).then(function (bufs) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      stopKlip();
      bufs.forEach(function (buf) { var kilde = k.createBufferSource(); kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start); start += buf.duration - 0.04; aktivtKlip = kilde; });
    }).catch(function () { sig(reserveTekst); });
  }
  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try { window.speechSynthesis.cancel(); var u = new SpeechSynthesisUtterance(tekst); u.voice = stemme; u.lang = stemme.lang; u.rate = 0.85; window.speechSynthesis.speak(u); } catch (e) { /* stemme er pynt */ }
  }
  /** Hele opslaget som én tekst: de tre stykker, saa rimet. */
  function opslagTekst(o) { return o.tekst.join(' ') + ' ' + o.rim.join(' '); }
  function laesHoejt(o) { afspil(['lyd/' + o.id + '.mp3'], opslagTekst(o)); }

  /* ---------- opslaget paa skaermen ---------- */

  var side = 0, fundet = {};

  function ring(c, n) {
    c.strokeStyle = GUL; c.lineWidth = 6; c.lineCap = 'round';
    c.beginPath(); c.arc(n.x, n.y, Math.max(n.s * 1.15, 34), 0, Math.PI * 2); c.stroke();
    c.strokeStyle = 'rgba(94,74,58,.55)'; c.lineWidth = 2; c.stroke();
  }
  function tegnScene() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2), r = scene.getBoundingClientRect();
    var b = Math.max(1, Math.round(r.width * dpr)), h = Math.max(1, Math.round(r.height * dpr));
    if (scene.width !== b || scene.height !== h) { scene.width = b; scene.height = h; }
    var o = OPSLAG[side];
    ctx.setTransform(b / W, 0, 0, h / H, 0, 0);
    ctx.clearRect(0, 0, W, H);
    S.tegnOpslag(ctx, o);
    if (fundet[o.id]) ring(ctx, S.noeglePlads(o));
  }
  function tegnPrikker() {
    prikker.innerHTML = OPSLAG.map(function (o, i) { return '<i class="' + (i === side ? 'her' : '') + '"></i>'; }).join('');
  }
  function visSide(n, stille) {
    side = Math.max(0, Math.min(OPSLAG.length - 1, n));
    var o = OPSLAG[side];
    tekstEl.innerHTML = o.tekst.map(function (t) { return '<p>' + t + '</p>'; }).join('');
    rimEl.innerHTML = o.rim.join('<br>');
    besoegEl.textContent = o.besoeg;
    findEl.textContent = fundet[o.id] ? 'Du fandt Pelles skruenøgle!' : 'Kan du finde Pelles skruenøgle?';
    findEl.className = 'find' + (fundet[o.id] ? ' fundet' : '');
    tilbage.hidden = side === 0;
    frem.innerHTML = side === OPSLAG.length - 1 ? window.Menu.igen() : PIL_FREM;
    frem.setAttribute('aria-label', side === OPSLAG.length - 1 ? 'Forfra' : 'Næste side');
    tegnPrikker();
    tegnScene();
    if (!stille) laesHoejt(o);
  }
  var PIL_FREM = '<svg viewBox="0 0 56 56" aria-hidden="true"><path d="M10 28h30" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round"/><path d="M30 14l15 14-15 14" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var PIL_TILBAGE = '<svg viewBox="0 0 56 56" aria-hidden="true"><path d="M46 28H16" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round"/><path d="M26 14L11 28l15 14" fill="none" stroke="#6b5545" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  tilbage.innerHTML = PIL_TILBAGE;
  hoer.innerHTML = window.Menu.lyd(true);

  frem.addEventListener('click', function () { tone(660, 0.12); if (side === OPSLAG.length - 1) visMenu(); else visSide(side + 1); });
  tilbage.addEventListener('click', function () { tone(520, 0.12); visSide(side - 1); });
  hoer.addEventListener('click', function () { laesHoejt(OPSLAG[side]); });
  document.addEventListener('keydown', function (e) {
    if (!overlay.hidden) return;
    if (e.key === 'ArrowRight') frem.click(); else if (e.key === 'ArrowLeft' && side > 0) visSide(side - 1);
  });

  /* Trykker man paa noeglen, faar den en ring, og stemmen siger, at man fandt den. */
  scene.addEventListener('pointerdown', function (e) {
    var r = scene.getBoundingClientRect(), o = OPSLAG[side], n = S.noeglePlads(o);
    var x = (e.clientX - r.left) / r.width * W, y = (e.clientY - r.top) / r.height * H;
    if (Math.hypot(x - n.x, y - n.y) > Math.max(n.s * 1.3, 42)) return;
    if (!fundet[o.id]) { fundet[o.id] = true; melodi([523, 659, 784, 1047], 110); }
    afspil(['../games/find/lyd/du_fandt_den.mp3'], 'Du fandt den!');
    visSide(side, true);
  });

  window.addEventListener('resize', function () { if (overlay.hidden) tegnScene(); tegnForside(); });

  /* ---------- forsiden: bogens menu ---------- */

  var forsideCanvas = null;
  function tegnForside() {
    if (!forsideCanvas) return;
    var c = forsideCanvas.getContext('2d');
    c.setTransform(forsideCanvas.width / W, 0, 0, forsideCanvas.height / H, 0, 0);
    c.clearRect(0, 0, W, H);
    S.tegnForside(c);
  }
  function visMenu() {
    stopKlip();
    bog.hidden = true;
    overlay.innerHTML =
      '<div class="kort">' +
      '<h2>' + B.TITEL + '</h2>' +
      '<p class="under">Pelle Pindsvin leder efter sin skruenøgle. Kan du finde den, før han gør?</p>' +
      '<div class="forside"><canvas width="600" height="780" aria-hidden="true"></canvas>' +
      '<div class="valg">' +
      '<button class="knap groen start" data-handling="start" aria-label="Læs bogen">' + window.Menu.start() + '</button>' +
      window.Menu.lydRaekke(lydTil) +
      '</div></div></div>';
    overlay.hidden = false;
    forsideCanvas = overlay.querySelector('canvas');
    tegnForside();
  }
  overlay.addEventListener('click', function (e) {
    var k = e.target.closest('[data-handling]'); if (!k) return;
    var h = k.getAttribute('data-handling');
    if (h === 'start') { tone(660, 0.12); overlay.hidden = true; bog.hidden = false; visSide(0); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) stopKlip(); k.innerHTML = window.Menu.lyd(lydTil); }
  });
  window.Skal.menuKnap(visMenu);

  /* ---------- print: kun til vaerktoej/lav-bog-pdf.js ---------- */

  var printEl = document.getElementById('print');
  /* Et malet opslag er selv 600 x 780, saa dets ark tegnes 1:1; kodetegnede sider faar dobbelt oploesning */
  function ark(klasse, indhold, malet) {
    var k = malet ? 1 : 2;
    var d = document.createElement('div'); d.className = 'ark ' + klasse;
    var cv = document.createElement('canvas'); cv.width = W * k; cv.height = H * k; d.appendChild(cv);
    d.insertAdjacentHTML('beforeend', indhold);
    printEl.appendChild(d);
    var c = cv.getContext('2d'); c.setTransform(k, 0, 0, k, 0, 0);
    return c;
  }
  function byggePrint() {
    printEl.innerHTML = '';
    S.tegnForside(ark('forside', '<div class="side"><h1>' + B.TITEL + '</h1><p class="under">Pelle Pindsvin leder efter sin skruenøgle. Kan du finde den på hver side, før han gør?</p></div>', S.klar('malet-forside')));
    OPSLAG.forEach(function (o, i) {
      var c = ark('opslag', '<div class="side"><div class="tekst">' + o.tekst.map(function (t) { return '<p>' + t + '</p>'; }).join('') + '</div>' +
        '<div class="rim">' + o.rim.join('<br>') + '</div><div class="besoeg">' + o.besoeg + '</div>' +
        '<div class="find">Kan du finde Pelles skruenøgle?</div><div class="sidetal">' + (i + 1) + '</div></div>', S.erMalet(o));
      S.tegnOpslag(c, o);
    });
  }

  /* ---------- start ---------- */

  S.hentAlle(function () { tegnForside(); if (overlay.hidden) tegnScene(); });
  visMenu();
  window.BogSkaerm = { visSide: visSide, visMenu: visMenu, byggePrint: byggePrint, side: function () { return side; }, fundet: fundet };
})();
