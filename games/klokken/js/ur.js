/**
 * Logik for Klokken: rummusen, der laerer, hvordan uret virker.
 *
 * Tre lege i ét spil:
 *   stil  Planeturet. To slags opgaver skiftevis:
 *           'stil' — musen siger en tid, og barnet stiller uret.
 *           'laes' — uret staar allerede, og barnet trykker paa det tal, der
 *                    siges ("klokken tre" er 3, "halv fire" er 4).
 *         At stille uret og at aflaese det er to forskellige ting; foer blev
 *         kun den foerste oevet.
 *   dag   Musens dag. Uret viser en tid, og barnet vaelger, hvad musen goer nu.
 *   sol   Jorden drejer. Musen beder om et af dagens goeremaal, og barnet
 *         drejer jorden, til uret staar der. Naar fingeren slipper, lander
 *         jorden paa et tidspunkt, uret kan sige.
 *
 * Tiden regnes i minutter siden klokken 12 (0-719), saa én omgang paa uret er
 * 720. Viserne haenger sammen som paa et rigtigt ur: traekker man den blaa
 * viser en hel omgang, gaar den roede en time frem. Uret laaser paa hele timer
 * (1 stjerne) eller halve timer (2 og 3 stjerner). Kvarter er med vilje ikke
 * med; "halv fire" er svaert nok, fordi det betyder 3:30.
 *
 * Ingen DOM, saa filen kan testes i Node. Se test/klokken.test.js.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    planeterPrRejse: [6, 8],        // hvor mange opgaver der skal loeses: [1 spiller, 2 spillere i alt]
    trin: [60, 30, 30],             // uret laaser paa hele timer (60) eller halve (30) pr. stjerne
    visUr: [true, true, false],     // om musen viser det lille ur, eller kun siger tiden (3 stjerner)
    kortAntal: [3, 4, 4],           // hvor mange kort der er at vaelge mellem i Musens dag
    laes: [false, true, true]       // om hver anden planet spoerger "Hvad er klokken?"
  };

  // Timerne, som de siges: "klokken et", "halv to". Plads 0 er tolv, saa TIMEORD[t % 12] passer.
  var TIMEORD = ['tolv', 'et', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve'];

  /**
   * Musens dag. t er minutter siden midnat (doegnet har 1440). Kortet er tegningen i
   * assets/noto/, og teksten siges, naar barnet har fundet det rigtige.
   * Klokken 7 og 19 ser ens ud paa uret; det er solen og maanen, der afgoer det.
   */
  var DAGEN = [
    { t: 7 * 60,  kort: 'tandboerste', tekst: 'Musen børster tænder.' },
    { t: 8 * 60,  kort: 'skoletaske',  tekst: 'Musen går i skole.' },
    { t: 12 * 60, kort: 'madpakke',    tekst: 'Musen spiser madpakke.' },
    { t: 14 * 60, kort: 'bold',        tekst: 'Musen spiller bold.' },
    { t: 18 * 60, kort: 'aftensmad',   tekst: 'Musen spiser aftensmad.' },
    { t: 19 * 60, kort: 'bad',         tekst: 'Musen går i bad.' },
    { t: 20 * 60, kort: 'seng',        tekst: 'Musen går i seng.' }
  ];

  var TAU = Math.PI * 2;

  function norm(t) { return ((Math.round(t) % 720) + 720) % 720; }
  function normDoegn(t) { return ((Math.round(t) % 1440) + 1440) % 1440; }
  /** Timen 1-12. */
  function time(t) { var h = Math.floor(norm(t) / 60); return h === 0 ? 12 : h; }
  function minut(t) { return norm(t) % 60; }
  /** Vinkel fra klokken 12 og med uret, 0 til 2 pi. */
  function timeVinkel(t) { return norm(t) / 720 * TAU; }
  function minutVinkel(t) { return minut(t) / 60 * TAU; }
  /** Rund til naermeste trin (60 = hele timer, 30 = halve). */
  function laas(t, trin) { return norm(Math.round(t / trin) * trin); }

  /**
   * Det tal, der siges i tiden, og som barnet trykker paa i 'laes'-opgaver.
   * "Klokken tre" er 3. "Halv fire" er 4, fordi uret er paa vej mod fire — det
   * er netop den regel, der er svaer paa dansk.
   */
  function talFor(t) { var h = time(t); return minut(t) === 0 ? h : (h % 12) + 1; }

  /** Den af kandidaterne, der ligger taettest paa t (saa viseren gaar den korte vej og aldrig springer). */
  function taettest(t, kandidater) {
    return kandidater.reduce(function (a, k) { return Math.abs(k - t) < Math.abs(a - t) ? k : a; }, kandidater[0]);
  }

  /**
   * Traek en viser til en vinkel. Den anden viser foelger med, som paa et rigtigt ur.
   * Paa hele timer (trin 60) kan den blaa viser ikke traekkes; den staar paa 12.
   * Returnerer den nye tid.
   */
  function traek(ur, viser, vinkel, trin) {
    var v = ((vinkel % TAU) + TAU) % TAU, t = ur.t, ny;
    if (viser === 'minut') {
      if (trin >= 60) return ur.t;
      var m = v / TAU * 60, bund = Math.floor(t / 60) * 60;
      ny = taettest(t, [bund + m - 60, bund + m, bund + m + 60]);
    } else {
      var raa = v / TAU * 720;
      ny = taettest(t, [raa - 720, raa, raa + 720]);
    }
    ur.t = laas(ny, trin);
    return ur.t;
  }

  /** "klokken tre" eller "halv fire". */
  function tekst(t) {
    var h = time(t);
    if (minut(t) === 0) return 'klokken ' + TIMEORD[h % 12];
    return 'halv ' + TIMEORD[(h + 1) % 12];
  }
  /** Klippet, der siger tiden: klokken_3.mp3 eller halv_4.mp3 (tallet er det, der siges). */
  function klip(t) {
    var h = time(t);
    if (minut(t) === 0) return 'klokken_' + h + '.mp3';
    var n = (h + 1) % 12; return 'halv_' + (n === 0 ? 12 : n) + '.mp3';
  }

  /** Afstand i timer paa urskiven mellem to doegn-tider (7 og 19 ligger paa samme sted). */
  function skiveAfstand(a, b) {
    var d = Math.abs(norm(a) - norm(b)) / 60;
    return Math.min(d, 12 - d);
  }

  /* ---------- doegnet, til Musens dag og Jorden drejer ---------- */

  /** Minutter siden midnat -> minutter paa uret. */
  function doegnTilUr(t) { return norm(normDoegn(t)); }
  /** Tidspunkt paa dagen, til himlen og til stemmen ("om morgenen"). */
  function himmel(t) {
    var h = normDoegn(t) / 60;
    if (h < 6 || h >= 21) return 'nat';
    if (h < 10) return 'morgen';
    if (h < 17) return 'dag';
    return 'aften';
  }
  var HIMMELORD = { nat: 'om natten', morgen: 'om morgenen', dag: 'om dagen', aften: 'om aftenen' };

  /**
   * Jorden drejer: husets vinkel paa skaermen (radianer, 0 = mod solen til hoejre,
   * positiv nedad som paa et laerred) -> minutter siden midnat. Bunden er klokken 6,
   * mod solen er middag, toppen er 18, og vaek fra solen er midnat.
   */
  function vinkelTilDoegn(v) { return normDoegn(720 - v / TAU * 1440); }
  function doegnTilVinkel(t) { return (720 - normDoegn(t)) / 1440 * TAU; }
  /** Jorden drejer frit, men uret kan kun sige hele og halve timer. */
  var DREJ_TRIN = 30;
  /** Saa taet paa et goeremaal skal man vaere, foer det er "nu". */
  var NAER = 20;

  /** Dagens goeremaal taet paa tiden, hvis der er et. */
  function goeremaal(t) {
    var d = normDoegn(t);
    for (var i = 0; i < DAGEN.length; i++) if (Math.abs(DAGEN[i].t - d) <= NAER) return DAGEN[i];
    return null;
  }

  function laasDoegn(t, trin) { return normDoegn(Math.round(normDoegn(t) / trin) * trin); }
  /**
   * Hvor jorden lander, naar fingeren slipper: paa dagens goeremaal, hvis et er
   * taet nok paa, ellers paa naermeste halve time. Uden det kunne uret staa paa
   * 7:17, mens musen sagde "halv otte" — tekst() og klip() kender kun hele og
   * halve timer. Jorden flytter sig hoejst 20 minutter, naar den lander, og
   * bagefter er uret, kortet paa dagens ring og det, musen siger, altid enige.
   */
  function landDoegn(t) {
    var d = normDoegn(t), gm = goeremaal(d);
    return gm ? gm.t : laasDoegn(d, DREJ_TRIN);
  }

  /* ---------- rejsen: opgaver og fremskridt ---------- */

  function bland(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1)), x = a[i]; a[i] = a[j]; a[j] = x;
    }
    return a;
  }
  function vaelgEn(liste) { return liste[Math.floor(Math.random() * liste.length)]; }

  /** Alle tider paa gitteret for niveauet. */
  function tider(niveau) {
    var ud = [], trin = INDSTIL.trin[niveau];
    for (var t = 0; t < 720; t += trin) ud.push(t);
    return ud;
  }

  /**
   * Ny rejse. Alle tre lege bruger den: stil, dag og sol.
   * Hver station har sit eget ur og sin egen opgave; maalet er faelles.
   */
  function nyRejse(antalSpillere, niveau, leg) {
    var r = {
      leg: leg, niveau: niveau, trin: INDSTIL.trin[niveau], visUr: INDSTIL.visUr[niveau],
      maal: INDSTIL.planeterPrRejse[antalSpillere > 1 ? 1 : 0], klaret: 0, faerdig: false, stationer: []
    };
    for (var i = 0; i < antalSpillere; i++) r.stationer.push({ ur: { t: 0 }, opgave: null, sidste: null, forsoeg: 0, nr: 0, planet: i });
    r.stationer.forEach(function (s, i) { nyOpgave(r, i); });
    return r;
  }

  /**
   * Den naeste opgave paa en station. Aldrig den samme tid to gange i raekke.
   * I Planeturet skifter det mellem at stille uret og at aflaese det.
   */
  function nyOpgave(r, station) {
    var s = r.stationer[station];
    s.forsoeg = 0;
    if (r.leg === 'stil') {
      var slags = INDSTIL.laes[r.niveau] && s.nr % 2 === 1 ? 'laes' : 'stil';
      var mulige = tider(r.niveau).filter(function (t) { return s.sidste === null || t !== s.sidste.t; });
      var t = vaelgEn(mulige);
      if (slags === 'laes') {
        s.ur.t = t;
        s.opgave = { slags: 'laes', t: t, svar: talFor(t), klip: klip(t), tekst: tekst(t) };
      } else {
        // Uret starter et andet sted, saa der er noget at stille. Paa hele timer staar den blaa paa 12.
        s.ur.t = vaelgEn(tider(r.niveau).filter(function (x) { return x !== t && skiveAfstand(x, t) >= 2; }));
        s.opgave = { slags: 'stil', t: t, klip: klip(t), tekst: tekst(t) };
      }
    } else if (r.leg === 'sol') {
      // Jorden drejer: musen beder om et goeremaal, og barnet drejer derhen.
      var drej = vaelgEn(DAGEN.filter(function (d) { return s.sidste === null || d.t !== s.sidste.t; }));
      s.ur.t = doegnTilUr(drej.t);
      s.opgave = { slags: 'drej', t: drej.t, kort: drej.kort, tekst: drej.tekst,
        klip: klip(doegnTilUr(drej.t)), himmel: himmel(drej.t) };
    } else {
      var maal = vaelgEn(DAGEN.filter(function (d) { return s.sidste === null || d.t !== s.sidste.t; }));
      s.ur.t = doegnTilUr(maal.t);
      s.opgave = { slags: 'kort', t: maal.t, kort: maal.kort, tekst: maal.tekst, klip: klip(doegnTilUr(maal.t)),
        himmel: himmel(maal.t), kortene: kortTil(maal, r.niveau) };
    }
    s.sidste = s.opgave;
    s.nr++;
    s.planet++;
  }

  /**
   * Kortene at vaelge mellem. 1 stjerne: kort, der ligger mindst to timer fra
   * hinanden paa urskiven (taettere kan tre af dagens syv ikke komme). 2 stjerner: tilfaeldige. 3 stjerner: dem, der ligger taettest paa uret,
   * saa 7 om morgenen og 7 om aftenen ligger ved siden af hinanden.
   */
  function kortTil(maal, niveau) {
    var andre = DAGEN.filter(function (d) { return d !== maal; }), antal = INDSTIL.kortAntal[niveau], valgt = [maal];
    if (niveau === 0) {
      bland(andre).forEach(function (d) {
        if (valgt.length < antal && valgt.every(function (v) { return skiveAfstand(v.t, d.t) >= 2; })) valgt.push(d);
      });
      // Faldskaerm: er der ikke nok med god afstand, fyldes op med de fjerneste
      bland(andre).sort(function (a, b) { return skiveAfstand(b.t, maal.t) - skiveAfstand(a.t, maal.t); })
        .forEach(function (d) { if (valgt.length < antal && valgt.indexOf(d) < 0) valgt.push(d); });
    } else if (niveau === 1) {
      bland(andre).slice(0, antal - 1).forEach(function (d) { valgt.push(d); });
    } else {
      andre.sort(function (a, b) { return skiveAfstand(a.t, maal.t) - skiveAfstand(b.t, maal.t) || Math.random() - 0.5; })
        .slice(0, antal - 1).forEach(function (d) { valgt.push(d); });
    }
    return bland(valgt).map(function (d) { return d.kort; });
  }

  /** En opgave er loest: tael op, og find den naeste, eller slut rejsen. */
  function loest(r, station) {
    r.klaret++;
    if (r.klaret >= r.maal) { r.faerdig = true; r.stationer.forEach(function (s) { s.opgave = null; }); }
    else nyOpgave(r, station);
  }

  /** Planeturet, 'stil': staar uret rigtigt? Sandt, hvis opgaven blev loest. */
  function tjek(r, station) {
    var s = r.stationer[station];
    if (r.faerdig || !s.opgave || s.opgave.slags !== 'stil') return false;
    if (s.ur.t !== s.opgave.t) { s.forsoeg++; return false; }
    loest(r, station);
    return true;
  }

  /** Planeturet, 'laes': barnet trykkede paa et tal paa skiven. */
  function tjekTal(r, station, n) {
    var s = r.stationer[station];
    if (r.faerdig || !s.opgave || s.opgave.slags !== 'laes') return 'forkert';
    if (n !== s.opgave.svar) { s.forsoeg++; return 'forkert'; }
    loest(r, station);
    return 'rigtigt';
  }

  /**
   * Jorden drejer: fingeren slap jorden ved doegn-tiden t. Jorden lander paa
   * landDoegn(t); er det musens goeremaal, er opgaven loest.
   */
  function tjekDrej(r, station, t) {
    var s = r.stationer[station];
    if (r.faerdig || !s.opgave || s.opgave.slags !== 'drej') return false;
    if (landDoegn(t) !== s.opgave.t) { s.forsoeg++; return false; }
    loest(r, station);
    return true;
  }

  /** Musens dag: vaelg et kort. 'rigtigt' eller 'forkert' (ingen straf, kortet ryster bare). */
  function vaelg(r, station, kort) {
    var s = r.stationer[station];
    if (r.faerdig || !s.opgave) return 'forkert';
    if (kort !== s.opgave.kort) { s.forsoeg++; return 'forkert'; }
    loest(r, station);
    return 'rigtigt';
  }

  rod.Ur = {
    INDSTIL: INDSTIL, TIMEORD: TIMEORD, DAGEN: DAGEN, HIMMELORD: HIMMELORD,
    norm: norm, normDoegn: normDoegn, time: time, minut: minut, talFor: talFor, timeVinkel: timeVinkel, minutVinkel: minutVinkel, laas: laas, traek: traek,
    tekst: tekst, klip: klip, skiveAfstand: skiveAfstand, doegnTilUr: doegnTilUr, himmel: himmel, vinkelTilDoegn: vinkelTilDoegn,
    doegnTilVinkel: doegnTilVinkel, goeremaal: goeremaal, laasDoegn: laasDoegn, landDoegn: landDoegn, DREJ_TRIN: DREJ_TRIN, NAER: NAER,
    tider: tider, nyRejse: nyRejse, nyOpgave: nyOpgave, kortTil: kortTil,
    tjek: tjek, tjekTal: tjekTal, vaelg: vaelg, tjekDrej: tjekDrej
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
