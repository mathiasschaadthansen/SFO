/**
 * Egernreden: logikken, uden skaerm. Kan koeres i node (testen og
 * vaerktoej/lav-lyd-gemini.py) og i browseren.
 *
 * To lege med Egernet Egons noedder:
 *
 * Se hurtigt (subitizing): noedderne ligger paa stubben et kort oejeblik og
 * daekkes saa af blade. Barnet vaelger kortet med det samme antal. Kortene
 * viser antallet som en terning (1-6) eller en tierramme (7-10), saa man skal
 * genkende maengden, ikke moenstret. Ved tre stjerner er der to grupper eller
 * en tierramme, saa 7 ses som 5 og 2 (konceptuel subitizing).
 *
 * Gemmeleg (del og helhed): Egon har fx fem noedder. Nogle af dem gemmer sig
 * under bladet, resten ligger paa stubben. Hvor mange gemmer sig? Svaret siges
 * som helheden delt i to: "Tre og to er fem."
 *
 * Positioner er i en enhedscirkel: stubben har radius 1, midten er (0, 0).
 */
(function (rod) {
  'use strict';

  var LEGE = ['se', 'gem'];
  var RUNDE = [6, 8];                     // spoergsmaal med én og to spillere
  var VIS = [2.0, 1.4, 1.5];              // sekunder, noedderne ses ved Se hurtigt
  var SE_ANTAL = [[1, 4], [1, 6], [4, 10]];
  var GEM_HEL = [[2, 5], [4, 7], [6, 10]];
  var NOED = [0.3, 0.27, 0.2];            // noeddens stoerrelse paa stubben (diameter)

  var TAL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti'];
  function stor(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mellem(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }

  /* ---------- moenstrene ---------- */

  /** Terningens prikker for 1-6, med afstanden s mellem dem. */
  function terning(n, s) {
    var P = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]],
      5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]]
    };
    return P[n].map(function (p) { return { x: p[0] * s, y: p[1] * s }; });
  }
  /** n paa en raekke. */
  function raekke(n, s) { var ud = []; for (var i = 0; i < n; i++) ud.push({ x: (i - (n - 1) / 2) * s, y: 0 }); return ud; }
  /** Trekant (3) eller pyramide (6). */
  function trekant(n, s) {
    var rk = n === 3 ? [1, 2] : [1, 2, 3], ud = [], h = s * 0.87;
    rk.forEach(function (m, r) { for (var i = 0; i < m; i++) ud.push({ x: (i - (m - 1) / 2) * s, y: (r - (rk.length - 1) / 2) * h }); });
    return ud;
  }
  /** Tierramme: to raekker af fem, fyldt fra venstre i oeverste raekke foerst. */
  function tierramme(n, s) { var ud = []; for (var i = 0; i < n; i++) ud.push({ x: (i % 5 - 2) * s, y: (Math.floor(i / 5) - 0.5) * s }); return ud; }
  /** Spredt, men aldrig for taet og altid inde paa stubben. */
  function spredt(n, str) {
    for (var forsoeg = 0; forsoeg < 200; forsoeg++) {
      var ud = [];
      for (var k = 0; k < n; k++) {
        for (var f = 0; f < 80; f++) {
          var v = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (0.78 - str / 2), p = { x: Math.cos(v) * r, y: Math.sin(v) * r };
          if (ud.every(function (q) { return Math.hypot(q.x - p.x, q.y - p.y) > str * 1.35; })) { ud.push(p); break; }
        }
      }
      if (ud.length === n) return ud;
    }
    return terning(Math.min(n, 6), str * 1.25);
  }
  /** To grupper side om side, fx 5 og 2. */
  function toGrupper(a, b, str) {
    var s = str * 1.2;
    return terning(a, s).map(function (p) { return { x: p.x - 0.44, y: p.y }; })
      .concat(terning(b, s).map(function (p) { return { x: p.x + 0.44, y: p.y }; }));
  }

  /** Hvordan n noedder ligger paa stubben ved Se hurtigt. */
  function moenster(n, svaerhed) {
    var str = NOED[svaerhed], s = str * 1.3, valg = [];
    if (svaerhed === 0) { valg.push('terning', 'raekke'); if (n === 3) valg.push('trekant'); }
    else if (svaerhed === 1) {
      valg.push('terning'); if (n <= 5) valg.push('raekke', 'spredt'); if (n === 3 || n === 6) valg.push('trekant');
    } else valg.push('tierramme', 'grupper', 'grupper');
    var navn = valg[Math.floor(Math.random() * valg.length)], pos;
    if (navn === 'terning') pos = terning(n, s);
    else if (navn === 'raekke') pos = raekke(n, s);
    else if (navn === 'trekant') pos = trekant(n, s);
    else if (navn === 'spredt') pos = spredt(n, str);
    else if (navn === 'tierramme') pos = tierramme(n, s);
    else {
      // To grupper paa hoejst seks, den store foerst og ingen gruppe paa én
      var b = mellem(Math.max(2, n - 6), Math.floor(n / 2)), a = n - b;
      pos = toGrupper(a, b, str);
      navn = 'grupper ' + a + '+' + b;
    }
    return { navn: navn, pos: pos, str: str };
  }

  /** Tre kort: det rigtige og to naboer, forskellige og inden for lo..hi. */
  function svarKort(rigtig, lo, hi) {
    var andre = bland([-1, 1]).concat(bland([-2, 2])).map(function (d) { return rigtig + d; })
      .filter(function (x) { return x >= lo && x <= hi; });
    for (var x = lo; andre.length < 2 && x <= hi; x++) if (x !== rigtig && andre.indexOf(x) < 0) andre.push(x);
    return bland([rigtig].concat(andre.slice(0, 2)));
  }

  /* ---------- runderne ---------- */

  function nyRunde(leg, svaerhed, spillere) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    var antal = RUNDE[spillere === 2 ? 1 : 0], ud = [], sidst = null, brugt = {};
    for (var i = 0; i < antal; i++) {
      var q;
      if (leg === 'se') {
        var lo = SE_ANTAL[svaerhed][0], hi = SE_ANTAL[svaerhed][1], n;
        do { n = mellem(lo, hi); } while (n === sidst);
        sidst = n;
        var m = moenster(n, svaerhed);
        q = { leg: 'se', antal: n, moenster: m.navn, pos: m.pos, str: m.str, vis: VIS[svaerhed], svar: svarKort(n, 1, Math.max(hi, 5)), rigtig: n };
      } else {
        // Alle opgaver ved stjernen i tilfaeldig raekkefoelge; ingen to ens, og ikke samme helhed to gange i traek
        if (!brugt.liste || !brugt.liste.length) {
          brugt.liste = [];
          for (var h = GEM_HEL[svaerhed][0]; h <= GEM_HEL[svaerhed][1]; h++) for (var g = 1; g < h; g++) brugt.liste.push({ hel: h, skjult: g });
          brugt.liste = bland(brugt.liste);
        }
        var j = 0;
        while (j < brugt.liste.length - 1 && brugt.liste[j].hel === sidst) j++;
        var o = brugt.liste.splice(j, 1)[0], hel = o.hel, skjult = o.skjult;
        sidst = hel;
        q = { leg: 'gem', hel: hel, synlig: hel - skjult, skjult: skjult, svar: svarKort(skjult, 1, Math.max(hel, 3)), rigtig: skjult };
      }
      q.spiller = spillere === 2 ? i % 2 : 0;
      ud.push(q);
    }
    return ud;
  }
  /** Er svaret rigtigt? */
  function svar(q, x) { return x === q.rigtig; }

  /* ---------- det, der siges ---------- */
  var TEKST = {
    seStart: 'Kig godt efter. Hvor mange nødder er der?',
    seSpoerg: 'Hvor mange nødder var der?',
    kigIgen: 'Kig igen.',
    ja: 'Ja!',
    gemSkjul: 'Nogle af dem gemmer sig under bladet.',
    gemSpoerg: 'Hvor mange gemmer sig?',
    proevIgen: 'Prøv igen.',
    faerdig: 'Egons kurv er fuld. Tak for hjælpen!'
  };
  function tal(n) { return stor(TAL[n]) + '.'; }
  function egonHar(n) { return 'Egon har ' + TAL[n] + ' nødder.'; }
  function del(a, b) { return stor(TAL[a]) + ' og ' + TAL[b] + ' er ' + TAL[a + b] + '.'; }
  /** Det, der siges, naar svaret er rigtigt: "Ja! Fire." eller "Ja! Tre og to er fem." */
  function rigtigTekst(q) { return TEKST.ja + ' ' + (q.leg === 'se' ? tal(q.antal) : del(q.synlig, q.skjult)); }
  /** Spoergsmaalet, som stemmen siger det. */
  function spoergTekst(q, foerste) {
    if (q.leg === 'se') return foerste ? TEKST.seStart : TEKST.seSpoerg;
    return egonHar(q.hel) + ' ' + TEKST.gemSkjul + ' ' + TEKST.gemSpoerg;
  }
  function saetninger() {
    var ud = [];
    function laeg(t) { if (ud.indexOf(t) < 0) ud.push(t); }
    Object.keys(TEKST).forEach(function (k) { laeg(TEKST[k]); });
    for (var n = 1; n <= 10; n++) laeg(tal(n));
    for (var h = 2; h <= 10; h++) { laeg(egonHar(h)); for (var a = 1; a < h; a++) laeg(del(a, h - a)); }
    return ud;
  }

  var Egern = {
    LEGE: LEGE, RUNDE: RUNDE, VIS: VIS, SE_ANTAL: SE_ANTAL, GEM_HEL: GEM_HEL, NOED: NOED, TAL: TAL, TEKST: TEKST,
    terning: terning, raekke: raekke, trekant: trekant, tierramme: tierramme, spredt: spredt, toGrupper: toGrupper,
    moenster: moenster, svarKort: svarKort, nyRunde: nyRunde, svar: svar,
    tal: tal, egonHar: egonHar, del: del, rigtigTekst: rigtigTekst, spoergTekst: spoergTekst, saetninger: saetninger, bland: bland
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Egern: Egern };
  else rod.Egern = Egern;
})(this);
