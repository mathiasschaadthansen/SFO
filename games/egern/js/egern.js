/**
 * Egernreden: logikken, uden skaerm. Kan koeres i node (testen og
 * vaerktoej/lav-lyd-gemini.py) og i browseren.
 *
 * Ét spil om at se tal som dele og helhed. Subitizing er vejen ind, del og
 * helhed er maalet (se README: forskningen bag). Tre lege med Egernet Egons
 * noedder:
 *
 * Se hurtigt: noedderne ses et oejeblik (cirka 2 sekunder), bladene kommer, og
 * barnet vaelger antallet paa en raekke med alle antal. Bagefter lyser delene
 * i hver sin farve, og stemmen siger, hvordan man kunne se det: "Fem og to er
 * syv." Seksaarige ser ikke selv grupperne; de skal vises og siges.
 *
 * Gemmeleg: Egon har fem noedder, nogle gemmer sig under bladet. Hvor mange?
 * Med to spillere gemmer den ene for den anden.
 *
 * Ryst og haeld: Egon kaster sine noedder, nogle lander i reden. Hvor mange?
 * Hver maade at dele tallet paa skrives op, til alle er fundet.
 *
 * Positioner er i en enhedscirkel: stubben har radius 1, midten er (0, 0).
 */
(function (rod) {
  'use strict';

  var LEGE = ['se', 'gem', 'ryst'];
  var RUNDE = [6, 8];                          // spoergsmaal med én og to spillere
  var VIS = [2.0, 2.0, 1.5];                   // sekunder, noedderne ses ved Se hurtigt
  var SE_ANTAL = [[1, 5], [3, 10], [1, 10]];   // sikker til 5 foerst, saa 6-10 med femmer-struktur, saa alt
  var GEM_HEL = [[2, 5], [5, 8], [6, 10]];
  var GEM_TO = [5, 8, 10];                     // to spillere: saa mange noedder har den, der gemmer
  var RYST_HEL = [5, 7, 10];                   // Ryst og haeld: find alle maader at dele dette tal
  var NOED = [0.3, 0.24, 0.22];                // noeddens stoerrelse paa stubben (diameter) ved Se hurtigt

  var TAL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti'];
  function stor(t) { return t.charAt(0).toUpperCase() + t.slice(1); }

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function mellem(lo, hi) { return lo + Math.floor(Math.random() * (hi - lo + 1)); }
  function valgAf(a) { return a[Math.floor(Math.random() * a.length)]; }
  /** Hver saetning for sig, som js/stemme.js deler en replik. */
  function saetningerAf(t) { return (String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }

  /* ---------- moenstrene ---------- */

  /** Terningens prikker for 1-6, med afstanden s mellem dem. Venstre soejle foerst, saa 4 er 2 og 2 og 6 er 3 og 3. */
  function terning(n, s) {
    var P = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
    };
    return P[n].map(function (p) { return { x: p[0] * s, y: p[1] * s }; });
  }
  /** n paa en raekke. */
  function raekke(n, s) { var ud = []; for (var i = 0; i < n; i++) ud.push({ x: (i - (n - 1) / 2) * s, y: 0 }); return ud; }
  /** Trekant (3) eller pyramide (6), oeverst foerst. */
  function trekant(n, s) {
    var rk = n === 3 ? [1, 2] : [1, 2, 3], ud = [], h = s * 0.87;
    rk.forEach(function (m, r) { for (var i = 0; i < m; i++) ud.push({ x: (i - (m - 1) / 2) * s, y: (r - (rk.length - 1) / 2) * h }); });
    return ud;
  }
  /** Tierramme: to raekker af fem, fyldt fra venstre i oeverste raekke foerst. */
  function tierramme(n, s) { var ud = []; for (var i = 0; i < n; i++) ud.push({ x: (i % 5 - 2) * s, y: (Math.floor(i / 5) - 0.5) * s }); return ud; }
  /** Femmerramme: én raekke paa fem pladser, fyldt fra venstre. */
  function femmerramme(n, s) { var ud = []; for (var i = 0; i < n; i++) ud.push({ x: (i - 2) * s, y: 0 }); return ud; }
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
  /** To grupper side om side, fx 5 og 2; den foerste gruppe er de foerste a noedder. Fem staar som en soejle. */
  function toGrupper(a, b, str) {
    var s = str * 1.12;
    function gruppe(n) { return n === 5 ? femmerramme(5, s * 0.92).map(function (p) { return { x: p.y, y: p.x }; }) : terning(n, s); }
    return gruppe(a).map(function (p) { return { x: p.x - 0.42, y: p.y }; })
      .concat(gruppe(b).map(function (p) { return { x: p.x + 0.42, y: p.y }; }));
  }

  /**
   * Hvordan n noedder ligger paa stubben ved Se hurtigt, og hvordan de kan ses
   * som to dele (dele: [a, b]; de foerste a noedder er den ene del), eller null,
   * naar antallet ses paa én gang.
   * Én stjerne: faste moenstre til 5. To: til 5 som foer, 6-10 som "fem og".
   * Tre: tierramme, to grupper paa alle maader og spredt til 6.
   */
  function moenster(n, svaerhed) {
    var str = NOED[svaerhed], s = str * 1.3, sr = Math.min(s, (0.86 - str / 2) / 2), struktur = [];   // sr: fem paa en raekke naar ikke ud paa barken
    if (n <= 5) struktur.push('raekke', 'femmer');
    if (n <= 6 && n !== 5) struktur.push('terning');
    if (n === 5) struktur.push('terning');
    if (n === 3 || n === 6) struktur.push('trekant');
    var valg;
    if (svaerhed === 0) valg = struktur;
    else if (svaerhed === 1) valg = n <= 5 ? struktur : ['tierramme', 'fem og'];
    else if (n < 4) valg = ['spredt', 'terning', 'raekke'];
    else { valg = ['tierramme', 'grupper', 'grupper']; if (n <= 6) valg.push('spredt', 'spredt'); }
    var navn = valgAf(valg), pos, dele = null;
    if (navn === 'terning') { pos = terning(n, s); dele = { 4: [2, 2], 5: [4, 1], 6: [3, 3] }[n] || null; }
    else if (navn === 'raekke') pos = raekke(n, sr);
    else if (navn === 'femmer') pos = femmerramme(n, sr);
    else if (navn === 'trekant') { pos = trekant(n, s); dele = n === 6 ? [3, 3] : [1, 2]; }
    else if (navn === 'spredt') pos = spredt(n, str);
    else if (navn === 'tierramme') { pos = tierramme(n, sr); dele = n > 5 ? [5, n - 5] : null; }
    else {
      // To grupper: "fem og" ved to stjerner, ellers en tilfaeldig deling med hoejst seks i hver
      var a = navn === 'fem og' ? 5 : mellem(Math.max(2, n - 6), Math.min(6, n - 2)), b = n - a;
      if (navn === 'grupper' && a < b) { var t = a; a = b; b = t; }
      pos = toGrupper(a, b, str); dele = [a, b]; navn = 'grupper ' + a + '+' + b;
    }
    return { navn: navn, pos: pos, str: str, ramme: navn === 'femmer' ? 5 : navn === 'tierramme' ? 10 : 0, felt: sr, dele: dele };
  }

  /** Talraekken, der svares paa: alle antal fra 1 til 5 eller 10. */
  function raekken(max) { var ud = []; for (var i = 1; i <= max; i++) ud.push(i); return ud; }

  /* ---------- runderne ---------- */

  function nyRunde(leg, svaerhed, spillere) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    spillere = spillere === 2 ? 2 : 1;
    if (leg === 'ryst') {
      var hel0 = RYST_HEL[svaerhed];
      return [{ leg: 'ryst', hel: hel0, fundet: [], svar: raekken(hel0 <= 5 ? 5 : 10), spiller: 0, rigtig: null, iReden: null }];
    }
    var antal = RUNDE[spillere - 1], ud = [], sidst = null, opgaver = [];
    for (var i = 0; i < antal; i++) {
      var q;
      if (leg === 'se') {
        var lo = SE_ANTAL[svaerhed][0], hi = SE_ANTAL[svaerhed][1], n, f = 0;
        // Ved to stjerner er hver anden fra 6 til 10
        do { n = mellem(lo, hi); } while ((n === sidst || (svaerhed === 1 && i % 2 === 0 && n <= 5)) && f++ < 60);
        sidst = n;
        var m = moenster(n, svaerhed);
        q = { leg: 'se', antal: n, moenster: m.navn, pos: m.pos, str: m.str, dele: m.dele, ramme: m.ramme, felt: m.felt, vis: VIS[svaerhed], svar: raekken(hi <= 5 ? 5 : 10), rigtig: n };
      } else if (spillere === 2) {
        // To spillere: den ene gemmer, den anden gaetter; hvor mange der gemmes, bestemmes i spillet
        q = { leg: 'gem', selv: true, hel: GEM_TO[svaerhed], synlig: null, skjult: null, svar: raekken(GEM_TO[svaerhed] <= 5 ? 5 : 10), rigtig: null, gemmer: i % 2 };
      } else {
        // Alle opgaver ved stjernen i tilfaeldig raekkefoelge; ingen to ens, og ikke samme helhed to gange i traek.
        // Ved tre stjerner kommer tiervennerne (helheden 10) dobbelt saa tit i puljen.
        if (!opgaver.length) {
          for (var h = GEM_HEL[svaerhed][0]; h <= GEM_HEL[svaerhed][1]; h++) for (var g = 1; g < h; g++) {
            opgaver.push({ hel: h, skjult: g });
            if (svaerhed === 2 && h === 10) opgaver.push({ hel: h, skjult: g });
          }
          opgaver = bland(opgaver);
        }
        var j = 0;
        while (j < opgaver.length - 1 && (opgaver[j].hel === sidst || ud.some(function (x) { return x.hel === opgaver[j].hel && x.skjult === opgaver[j].skjult; }))) j++;
        var o = opgaver.splice(j, 1)[0];
        sidst = o.hel;
        q = { leg: 'gem', hel: o.hel, synlig: o.hel - o.skjult, skjult: o.skjult, svar: raekken(GEM_HEL[svaerhed][1] <= 5 ? 5 : 10), rigtig: o.skjult };
      }
      q.spiller = spillere === 2 ? (q.gemmer !== undefined ? 1 - q.gemmer : i % 2) : 0;
      ud.push(q);
    }
    return ud;
  }
  /** Er svaret rigtigt? */
  function svar(q, x) { return x === q.rigtig; }

  /** To spillere i Gemmeleg: saa mange blev gemt. */
  function gemt(q, skjult) { q.skjult = skjult; q.synlig = q.hel - skjult; q.rigtig = skjult; }

  /**
   * Ryst og haeld: Egon kaster, og saa mange lander i reden. Oftest en maade,
   * der ikke er fundet endnu, saa runden ikke trakker ud; ellers en tilfaeldig.
   */
  function kast(q) {
    var mangler = [];
    for (var i = 1; i < q.hel; i++) if (q.fundet.indexOf(i) < 0) mangler.push(i);
    var k = mangler.length && Math.random() < 0.7 ? valgAf(mangler) : mellem(1, q.hel - 1);
    q.iReden = k; q.rigtig = k;
    return k;
  }
  /** Ryst og haeld: svaret var rigtigt; er maaden ny? */
  function fundet(q) { if (q.fundet.indexOf(q.iReden) >= 0) return false; q.fundet.push(q.iReden); return true; }
  function alleFundet(q) { return q.fundet.length >= q.hel - 1; }

  /* ---------- det, der siges ---------- */
  var TEKST = {
    seStart: 'Kig godt efter. Hvor mange nødder er der?',
    seSpoerg: 'Hvor mange nødder var der?',
    kigIgen: 'Kig igen.',
    ja: 'Ja!',
    gemSkjul: 'Nogle af dem gemmer sig under bladet.',
    gemSpoerg: 'Hvor mange gemmer sig?',
    proevIgen: 'Prøv igen.',
    gemToStart: 'Den ene lukker øjnene. Den anden gemmer nogle nødder under bladet.',
    gemToFaerdig: 'Tryk på øjet, når du er færdig.',
    kigNu: 'Kig nu.',
    rystStart: 'Tryk på Egon, så kaster han nødderne.',
    rystFind: 'Find alle måder at dele dem på.',
    rystSpoerg: 'Hvor mange landede i reden?',
    rystIgen: 'Den har vi allerede fundet. Tryk på Egon igen.',
    rystAlle: 'Nu er alle måderne fundet!',
    faerdig: 'Egons kurv er fuld. Tak for hjælpen!'
  };
  function tal(n) { return stor(TAL[n]) + '.'; }
  function egonHar(n) { return 'Egon har ' + TAL[n] + ' nødder.'; }
  function del(a, b) { return stor(TAL[a]) + ' og ' + TAL[b] + ' er ' + TAL[a + b] + '.'; }
  /** Det, der siges, naar svaret er rigtigt: "Ja! Fem og to er syv." eller "Ja! Tre." */
  function rigtigTekst(q) {
    if (q.leg === 'se') return TEKST.ja + ' ' + (q.dele ? del(q.dele[0], q.dele[1]) : tal(q.antal));
    if (q.leg === 'ryst') return TEKST.ja + ' ' + del(q.iReden, q.hel - q.iReden);
    return TEKST.ja + ' ' + del(q.synlig, q.skjult);
  }
  /** Spoergsmaalet, som stemmen siger det. */
  function spoergTekst(q, foerste) {
    if (q.leg === 'se') return foerste ? TEKST.seStart : TEKST.seSpoerg;
    if (q.leg === 'ryst') return egonHar(q.hel) + ' ' + TEKST.rystFind + ' ' + TEKST.rystStart;
    if (q.selv) return egonHar(q.hel) + ' ' + TEKST.gemToStart + ' ' + TEKST.gemToFaerdig;
    return egonHar(q.hel) + ' ' + TEKST.gemSkjul + ' ' + TEKST.gemSpoerg;
  }
  function saetninger() {
    var ud = [];
    function laeg(t) { if (ud.indexOf(t) < 0) ud.push(t); }
    Object.keys(TEKST).forEach(function (k) { saetningerAf(TEKST[k]).forEach(laeg); });
    for (var n = 1; n <= 10; n++) laeg(tal(n));
    for (var h = 2; h <= 10; h++) { laeg(egonHar(h)); for (var a = 1; a < h; a++) laeg(del(a, h - a)); }
    return ud;
  }

  var Egern = {
    LEGE: LEGE, RUNDE: RUNDE, VIS: VIS, SE_ANTAL: SE_ANTAL, GEM_HEL: GEM_HEL, GEM_TO: GEM_TO, RYST_HEL: RYST_HEL, NOED: NOED, TAL: TAL, TEKST: TEKST,
    terning: terning, raekke: raekke, trekant: trekant, tierramme: tierramme, femmerramme: femmerramme, spredt: spredt, toGrupper: toGrupper,
    moenster: moenster, raekken: raekken, nyRunde: nyRunde, svar: svar, gemt: gemt, kast: kast, fundet: fundet, alleFundet: alleFundet,
    tal: tal, egonHar: egonHar, del: del, rigtigTekst: rigtigTekst, spoergTekst: spoergTekst, saetninger: saetninger, saetningerAf: saetningerAf, bland: bland
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Egern: Egern };
  else rod.Egern = Egern;
})(this);
