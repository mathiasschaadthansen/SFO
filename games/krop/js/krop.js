/**
 * Kropshuset: reglerne og alt, der siges. Ingen DOM, saa testen kan koere den i node.
 *
 * Robotten Rasmus vil gerne vide, hvordan en menneskekrop virker, og Emil og Ella
 * viser ham det. Tre lege:
 *   peg     Hvor er din albue? Barnet peger paa sin egen krop og trykker saa paa
 *           Emils eller Ellas. Et forkert tryk siger, hvad man ramte ("Det er knaeet."),
 *           saa ogsaa fejl laerer barnet et ord.
 *   roentgen Rasmus' roentgenoeje: flyt fingeren hen over Ella eller Emil og find
 *           hjertet, hjernen, maven ... inde i kroppen.
 *   sanser  Hvad bruger du? Fuglen synger: oeret. Citronen smager surt: munden.
 *
 * Pladserne paa billederne (billeder/emil.png og ella.png) er i billedets egne
 * pixels: [x, y, radius]. Kropsdele med to sider (haender, knae ...) har to cirkler.
 */
(function (rod) {
  'use strict';

  var FIGURER = {
    emil: { navn: 'Emil', ejer: 'Emils', billede: 'billeder/emil.png', b: 416, h: 1000 },
    ella: { navn: 'Ella', ejer: 'Ellas', billede: 'billeder/ella.png', b: 498, h: 1000 }
  };

  /*
   * Kropsdelene. form: "din albue" (spoergsmaalet), bestemt: "albuen" (svaret).
   * niveau 0 er én stjerne, 1 to og 2 tre. robot: det, Rasmus siger om sin egen.
   */
  var DELE = {
    hoved:     { form: 'dit hoved', bestemt: 'hovedet', niveau: 0, robot: 'Mit hoved er en kasse med to lamper.' },
    haar:      { form: 'dit hår', bestemt: 'håret', niveau: 0, robot: 'Jeg har ikke noget hår. Kun en antenne.' },
    oeje:      { form: 'dit øje', bestemt: 'øjet', niveau: 0, robot: 'Mine øjne er to kameraer.' },
    oere:      { form: 'dit øre', bestemt: 'øret', niveau: 0, robot: 'Jeg hører med en mikrofon.' },
    naese:     { form: 'din næse', bestemt: 'næsen', niveau: 0, robot: 'Jeg har ingen næse, så jeg kan ikke lugte.' },
    mund:      { form: 'din mund', bestemt: 'munden', niveau: 0, robot: 'Min mund er en lille højttaler.' },
    haand:     { form: 'din hånd', bestemt: 'hånden', niveau: 0, robot: 'Min hånd er en tang.' },
    arm:       { form: 'din arm', bestemt: 'armen', niveau: 0, robot: 'Min arm er et rør af metal.' },
    mave:      { form: 'din mave', bestemt: 'maven', niveau: 0, robot: 'I min mave sidder mit batteri.' },
    ben:       { form: 'dit ben', bestemt: 'benet', niveau: 0, robot: 'Mine ben er to rør med fjedre.' },
    fod:       { form: 'din fod', bestemt: 'foden', niveau: 0, robot: 'Mine fødder er firkantede.' },
    knae:      { form: 'dit knæ', bestemt: 'knæet', niveau: 1, robot: 'Mit knæ er et hængsel.' },
    albue:     { form: 'din albue', bestemt: 'albuen', niveau: 1, robot: 'Min albue er en skrue.' },
    skulder:   { form: 'din skulder', bestemt: 'skulderen', niveau: 1, robot: 'Min skulder knirker lidt.' },
    hals:      { form: 'din hals', bestemt: 'halsen', niveau: 1, robot: 'Min hals kan dreje helt rundt.' },
    hage:      { form: 'din hage', bestemt: 'hagen', niveau: 1, robot: 'Jeg har ingen hage.' },
    pande:     { form: 'din pande', bestemt: 'panden', niveau: 1, robot: 'Min pande er af blankt metal.' },
    kind:      { form: 'din kind', bestemt: 'kinden', niveau: 1, robot: 'Mine kinder bliver aldrig røde.' },
    finger:    { form: 'din finger', bestemt: 'fingeren', niveau: 1, robot: 'Jeg har kun to fingre på hver hånd.' },
    taeer:     { form: 'dine tæer', bestemt: 'tæerne', niveau: 1, robot: 'Jeg har ingen tæer.' },
    bryst:     { form: 'dit bryst', bestemt: 'brystet', niveau: 1, robot: 'På mit bryst sidder der knapper.' },
    ankel:     { form: 'din ankel', bestemt: 'anklen', niveau: 2, robot: 'Min ankel er et lille kugleled.' },
    haandled:  { form: 'dit håndled', bestemt: 'håndleddet', niveau: 2, robot: 'Mit håndled kan dreje rundt.' },
    oejenbryn: { form: 'dit øjenbryn', bestemt: 'øjenbrynet', niveau: 2, robot: 'Jeg har ingen øjenbryn.' },
    hofte:     { form: 'din hofte', bestemt: 'hoften', niveau: 2, robot: 'Min hofte er et stort hængsel.' },
    laar:      { form: 'dit lår', bestemt: 'låret', niveau: 2, robot: 'Mit lår er et tykt rør.' },
    skinneben: { form: 'dit skinneben', bestemt: 'skinnebenet', niveau: 2, robot: 'Mit skinneben er en stang af stål.' }
  };

  /* Hvor kropsdelene sidder paa de to billeder, aflaest paa et gitter over billedet. */
  var PLADS = {
    emil: {
      hoved: [[205, 205, 120]], haar: [[200, 95, 70], [105, 160, 28], [320, 150, 28]],
      oeje: [[160, 225, 19], [253, 225, 19]], oere: [[90, 240, 22], [318, 240, 22]],
      naese: [[205, 252, 16]], mund: [[207, 283, 18]],
      haand: [[45, 622, 36], [368, 622, 36]], arm: [[90, 492, 24], [328, 492, 24]],
      mave: [[205, 540, 50]], ben: [[155, 840, 42], [265, 840, 42]], fod: [[142, 960, 30], [268, 960, 30]],
      knae: [[155, 790, 22], [265, 790, 22]], albue: [[80, 535, 17], [337, 535, 17]],
      skulder: [[102, 385, 30], [310, 385, 30]], hals: [[205, 345, 22]], hage: [[207, 316, 17]],
      pande: [[205, 172, 28]], kind: [[128, 264, 22], [285, 264, 22]],
      finger: [[33, 650, 22], [378, 650, 22]], taeer: [[125, 978, 17], [285, 978, 17]], bryst: [[205, 432, 40]],
      ankel: [[155, 930, 14], [265, 930, 14]], haandled: [[68, 585, 15], [343, 585, 15]],
      oejenbryn: [[160, 188, 15], [253, 188, 15]], hofte: [[110, 612, 22], [300, 612, 22]],
      laar: [[155, 690, 30], [255, 690, 30]], skinneben: [[155, 862, 19], [265, 862, 19]]
    },
    ella: {
      hoved: [[247, 170, 125]], haar: [[245, 75, 65], [60, 90, 40], [432, 90, 40]],
      oeje: [[188, 187, 19], [305, 183, 19]], oere: [[120, 205, 22], [375, 200, 22]],
      naese: [[245, 210, 15]], mund: [[250, 242, 18]],
      haand: [[80, 606, 36], [420, 606, 36]], arm: [[125, 470, 22], [370, 470, 22]],
      mave: [[248, 510, 50]], ben: [[198, 800, 45], [300, 800, 45]], fod: [[185, 965, 30], [305, 965, 30]],
      knae: [[200, 775, 22], [298, 775, 22]], albue: [[115, 520, 18], [385, 520, 18]],
      skulder: [[150, 345, 30], [345, 345, 30]], hals: [[250, 300, 18]], hage: [[250, 275, 16]],
      pande: [[245, 128, 30]], kind: [[155, 220, 22], [335, 218, 22]],
      finger: [[62, 632, 22], [432, 632, 22]], taeer: [[165, 981, 17], [310, 981, 17]], bryst: [[248, 390, 40]],
      ankel: [[192, 935, 14], [300, 935, 14]], haandled: [[100, 575, 16], [400, 575, 16]],
      oejenbryn: [[185, 155, 15], [310, 155, 15]], hofte: [[155, 600, 22], [345, 600, 22]],
      laar: [[200, 715, 30], [300, 715, 30]], skinneben: [[196, 860, 19], [300, 860, 19]]
    }
  };

  /*
   * Organerne til roentgenoejet, i billedets pixels. Hjertet og maven sidder lidt
   * til kroppens venstre side, altsaa til hoejre paa billedet. Rygraden er en linje.
   */
  var ORGANER = {
    hjerne: { bestemt: 'hjernen', niveau: 0, fakta: ['Hjernen bor inde i hovedet.', 'Den tænker, husker og drømmer.'], robot: 'Jeg har en computer i stedet.' },
    hjerte: { bestemt: 'hjertet', niveau: 0, fakta: ['Hjertet pumper blodet rundt i hele kroppen.', 'Læg hånden på dit bryst, og mærk det banke.'], robot: 'Jeg har en pumpe med olie.' },
    mavesaek: { bestemt: 'maven', niveau: 0, fakta: ['I maven bliver maden til grød.'], robot: 'Jeg spiser ikke. Jeg lader op.' },
    lunger: { bestemt: 'lungerne', niveau: 1, fakta: ['Lungerne fyldes med luft, når du trækker vejret.', 'Tag en dyb indånding.'], robot: 'Jeg trækker slet ikke vejret.' },
    kranie: { bestemt: 'kraniet', niveau: 1, fakta: ['Kraniet er en hård hjelm af knogle.', 'Den passer på hjernen.'], robot: 'Mit hoved er af metal.' },
    ribben: { bestemt: 'ribbenene', niveau: 1, fakta: ['Ribbenene passer på hjertet og lungerne.'], robot: 'Mine ribben er skruet sammen.' },
    tarme: { bestemt: 'tarmene', niveau: 2, fakta: ['Tarmene er et langt rør, der snor sig rundt inde i maven.'], robot: 'Jeg har ledninger i stedet.' },
    rygrad: { bestemt: 'rygraden', niveau: 2, fakta: ['Rygraden er en lang række små knogler ned ad ryggen.', 'Den gør, at du kan bøje dig.'], robot: 'Min ryg kan slet ikke bøje.' },
    laarben: { bestemt: 'lårbenet', niveau: 2, fakta: ['Lårbenet er den længste knogle i hele kroppen.'], robot: 'Mine ben er rør af stål.' }
  };
  var INDRE = {
    emil: {
      hjerne: [[205, 150, 68]], kranie: [[205, 195, 108]], hjerte: [[228, 432, 26]], lunger: [[168, 428, 40], [248, 428, 40]],
      ribben: [[205, 450, 72]], mavesaek: [[232, 520, 30]], tarme: [[205, 588, 48]],
      rygrad: [[205, 380, 14], [205, 450, 14], [205, 520, 14], [205, 590, 14]], laarben: [[155, 690, 26], [255, 690, 26]]
    },
    ella: {
      hjerne: [[245, 110, 68]], kranie: [[247, 170, 112]], hjerte: [[270, 398, 26]], lunger: [[212, 392, 40], [288, 392, 40]],
      ribben: [[248, 410, 72]], mavesaek: [[275, 485, 30]], tarme: [[248, 555, 48]],
      rygrad: [[248, 330, 14], [248, 410, 14], [248, 490, 14], [248, 570, 14]], laarben: [[200, 715, 26], [300, 715, 26]]
    }
  };

  /* Sanserne og kortene: billedet af det, man bruger. */
  var SANSER = {
    se:    { kort: '../bogstaver/billeder/oeje.png', ja: 'Ja, du ser med øjnene.', robot: 'Jeg ser med mit kamera.' },
    hoere: { kort: 'ting/oere.svg', ja: 'Ja, du hører med ørerne.', robot: 'Jeg hører med min mikrofon.' },
    lugte: { kort: '../bogstaver/billeder/naese.png', ja: 'Ja, du lugter med næsen.', robot: 'Jeg kan slet ikke lugte.' },
    smage: { kort: '../rim/billeder/mund.png', ja: 'Ja, du smager med tungen.', robot: 'Jeg kan ikke smage. Jeg spiser strøm.' },
    foele: { kort: 'ting/haand.svg', ja: 'Ja, du mærker med huden.', robot: 'Jeg mærker med små knapper.' }
  };
  var SANS_RAEKKE = ['se', 'hoere', 'lugte', 'smage', 'foele'];
  /* Tingene: Bogstavvejens malede billeder, en saetning og den sans, man bruger. */
  var B = '../bogstaver/billeder/';
  var TING = [
    { ting: 'fugl', saetning: 'Fuglen synger.', sanser: ['hoere'] },
    { ting: 'hund', saetning: 'Hunden gøer.', sanser: ['hoere'] },
    { ting: 'tog', saetning: 'Toget dytter.', sanser: ['hoere'] },
    { ting: 'regnbue', saetning: 'Regnbuen har mange farver.', sanser: ['se'] },
    { ting: 'maane', saetning: 'Månen lyser på himlen.', sanser: ['se'] },
    { ting: 'lampe', saetning: 'Lampen lyser.', sanser: ['se'] },
    { ting: 'kage', saetning: 'Kagen dufter dejligt.', sanser: ['lugte'] },
    { ting: 'ost', saetning: 'Osten lugter stærkt.', sanser: ['lugte'] },
    { ting: 'pizza', saetning: 'Pizzaen dufter godt.', sanser: ['lugte'] },
    { ting: 'citron', saetning: 'Citronen smager surt.', sanser: ['smage'] },
    { ting: 'jordbaer', saetning: 'Jordbærret smager sødt.', sanser: ['smage'] },
    { ting: 'kat', saetning: 'Katten har blød pels.', sanser: ['foele'] },
    { ting: 'is', saetning: 'Isen er kold.', sanser: ['foele'] },
    { ting: 'ild', saetning: 'Bålet er varmt.', sanser: ['foele'] }
  ];
  /* Tre stjerner: to sanser paa én gang. */
  var TING_TO = [
    { ting: 'fugl', saetning: 'Du kan se fuglen, og du kan høre den synge.', sanser: ['se', 'hoere'] },
    { ting: 'pizza', saetning: 'Pizzaen dufter godt, og den smager godt.', sanser: ['lugte', 'smage'] },
    { ting: 'kat', saetning: 'Du kan se katten, og du kan mærke den bløde pels.', sanser: ['se', 'foele'] },
    { ting: 'kage', saetning: 'Kagen dufter, og den smager sødt.', sanser: ['lugte', 'smage'] },
    { ting: 'hund', saetning: 'Hunden gøer, og den slikker dig på hånden.', sanser: ['hoere', 'foele'] },
    { ting: 'is', saetning: 'Isen er kold, og den smager sødt.', sanser: ['foele', 'smage'] }
  ].filter(function (t) { return t.sanser.length === 2; });

  var RUNDE = 6;   // spoergsmaal pr. omgang

  var TEKST = {
    pegHej: 'Rasmus vil gerne lære, hvad kroppens dele hedder.',
    pegEgen: 'Peg på din egen krop først.',
    igen: 'Prøv igen.',
    roentgenHej: 'Rasmus har et røntgenøje. Han kan se ind i kroppen.',
    roentgenFinger: 'Flyt fingeren hen over kroppen.',
    roentgenSlut: 'Nu ved Rasmus, hvordan der ser ud inde i en krop.',
    sanserHej: 'Rasmus har kamera og mikrofon. Hvad har du?',
    hvad: 'Hvad bruger du?',
    hvilkeTo: 'Hvilke to bruger du?',
    enTil: 'Godt. Der er én til.',
    faerdig: 'Tak for hjælpen, siger Rasmus.'
  };

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function delePaa(niveau) { return Object.keys(DELE).filter(function (d) { return DELE[d].niveau === niveau; }); }

  /* ---------- Hvor er din albue? ---------- */

  function hvorEr(d) { return 'Hvor er ' + DELE[d].form + '?'; }
  function pegPaa(d) { return 'Peg på ' + DELE[d].form + '.'; }
  function trykPaa(d, figurer) {
    var ejer = figurer.map(function (f) { return FIGURER[f].ejer; }).join(' og ');
    return 'Tryk så på ' + ejer + ' ' + DELE[d].form.replace(/^(din|dit|dine) /, '') + '.';
  }
  function derEr(d) { return 'Ja, der er ' + DELE[d].bestemt + '.'; }
  function detEr(d) { return 'Det er ' + DELE[d].bestemt + '.'; }

  /** En omgang: seks kropsdele. Én stjerne de lette, to og tre mest de nye og et par fra før. */
  function pegRunde(stjerner) {
    var nye = bland(delePaa(stjerner)), gamle = stjerner > 0 ? bland(delePaa(stjerner - 1)) : [];
    var ud = stjerner === 0 ? nye.slice(0, RUNDE) : nye.slice(0, 4).concat(gamle.slice(0, RUNDE - 4));
    return bland(ud);
  }

  /** Afstand fra et punkt til en plads, maalt i pladsens radius (under 1 er inde i den). */
  function naer(pladser, x, y) {
    var bedst = Infinity;
    (pladser || []).forEach(function (p) { bedst = Math.min(bedst, Math.hypot(x - p[0], y - p[1]) / p[2]); });
    return bedst;
  }
  /**
   * Hvilken kropsdel ramte trykket (i billedets pixels)? Den mindste plads, trykket er
   * inde i, saa et tryk paa naesen er naesen og ikke hovedet. null, hvis intet.
   */
  function ramte(figur, x, y) {
    var P = PLADS[figur], bedst = null, str = Infinity;
    Object.keys(P).forEach(function (d) {
      P[d].forEach(function (p) {
        if (Math.hypot(x - p[0], y - p[1]) <= p[2] && p[2] < str) { str = p[2]; bedst = d; }
      });
    });
    return bedst;
  }
  /** Er trykket rigtigt? Inde i maalets plads, med lidt luft, saa smaa fingre ogsaa rammer. */
  function rigtigtTryk(figur, maal, x, y) { return naer(PLADS[figur][maal], x, y) <= 1.25; }

  /* ---------- Roentgenoejet ---------- */

  function find(o) { return 'Find ' + ORGANER[o].bestemt + '.'; }
  function roentgenRunde(stjerner) {
    var alle = Object.keys(ORGANER).filter(function (o) { return ORGANER[o].niveau <= stjerner; });
    var nye = bland(alle.filter(function (o) { return ORGANER[o].niveau === stjerner; }));
    var gamle = bland(alle.filter(function (o) { return ORGANER[o].niveau < stjerner; }));
    return nye.concat(gamle).slice(0, 3 + stjerner * 2);
  }
  /** Hvilket organ er under fingeren (i billedets pixels)? Det mindste, fingeren er inde i. */
  function organ(figur, x, y) {
    var P = INDRE[figur], bedst = null, str = Infinity;
    Object.keys(P).forEach(function (o) {
      P[o].forEach(function (p) {
        if (Math.hypot(x - p[0], y - p[1]) <= p[2] * 1.15 && p[2] < str) { str = p[2]; bedst = o; }
      });
    });
    return bedst;
  }
  /** Er fingeren paa det organ, man leder efter? Maalet tjekkes foerst, saa kraniet kan findes, selv om hjernen ligger inden i. */
  function paaOrgan(figur, maal, x, y) { return naer(INDRE[figur][maal], x, y) <= 1.15; }
  function fundet(o) { return ORGANER[o].fakta.concat([ORGANER[o].robot]); }

  /* ---------- Sanserne ---------- */

  /** En omgang: seks ting. Én stjerne tre kort, to stjerner alle fem, tre stjerner to sanser. */
  function sanseRunde(stjerner) {
    var kilde = stjerner === 2 ? TING_TO : TING;
    var valgt = bland(kilde).slice(0, RUNDE);
    return valgt.map(function (t) {
      var kort;
      if (stjerner === 0) {
        var andre = bland(SANS_RAEKKE.filter(function (s) { return t.sanser.indexOf(s) < 0; })).slice(0, 2);
        kort = SANS_RAEKKE.filter(function (s) { return s === t.sanser[0] || andre.indexOf(s) >= 0; });
      } else kort = SANS_RAEKKE.slice();
      return { ting: t.ting, billede: B + t.ting + '.png', saetning: t.saetning, sanser: t.sanser.slice(), kort: kort, to: t.sanser.length === 2 };
    });
  }
  function sanseSvar(q, valgt) {
    if (q.to) return valgt.length === 2 && q.sanser.every(function (s) { return valgt.indexOf(s) >= 0; });
    return valgt.length === 1 && valgt[0] === q.sanser[0];
  }


  /* ---------- Madens rejse ---------- */

  var MAD = [
    { ting: 'gulerod', form: 'en gulerod' }, { ting: 'aeble', form: 'et æble' }, { ting: 'banan', form: 'en banan' },
    { ting: 'pandekage', form: 'en pandekage' }, { ting: 'ost', form: 'et stykke ost' }
  ];
  var STATIONER = ['tygge', 'synke', 'mave', 'tarme', 'ud'];
  var MAD_TEKST = {
    hej: 'Rasmus vil vide, hvor maden bliver af.',
    tygge: 'Først skal maden tygges. Tryk på munden.',
    tygget: 'Nu er maden lille nok til at synke.',
    synke: 'Træk maden ned gennem spiserøret til maven.',
    mave: 'Rør rundt i maven med fingeren.',
    maveFaerdig: 'Maven blander maden med mavesaft, så den bliver til grød.',
    tarme: 'Træk maden gennem tarmene.',
    tarmeFaerdig: 'Tarmene tager det gode fra maden, så du får kræfter i hele kroppen.',
    ud: 'Resten kommer ud, når du går på toilettet.',
    robot: 'Jeg spiser slet ikke. Jeg lader bare op.',
    huske: 'Kan du huske vejen? Tryk der, hvor maden kom hen først.',
    ogSaa: 'Og så?'
  };
  /* Vejen, man skal huske med tre stjerner, og hvad stemmen siger ved hvert sted. */
  var VEJ = [
    { sted: 'mund', ja: 'Ja, munden.' }, { sted: 'spiseroer', ja: 'Ja, spiserøret.' },
    { sted: 'mave', ja: 'Ja, maven.' }, { sted: 'tarme', ja: 'Ja, tarmene.' }
  ];
  function spiser(figur, m) { return FIGURER[figur].navn + ' spiser ' + m.form + '.'; }
  /** En omgang: én mad med én stjerne, to med to og tre (og med tre skal vejen huskes bagefter). */
  function madRunde(stjerner) { return bland(MAD).slice(0, stjerner === 0 ? 1 : 2); }
  /**
   * Madens vej gennem figuren, i billedets pixels: spiseroeret fra munden ned til
   * maven og tarmene som en spiral, der ender i bunden. Bygget ud fra pladserne.
   */
  function madVej(figur) {
    var P = PLADS[figur], I = INDRE[figur];
    var m = P.mund[0], h = P.hals[0], mv = I.mavesaek[0], t = I.tarme[0];
    var spiseroer = [];
    var a = [m[0], m[1] + 6], b = [h[0], h[1]], c = [mv[0] - mv[2] * 0.7, mv[1] - mv[2] * 0.6], d = [mv[0], mv[1]];
    [[a, b], [b, c], [c, d]].forEach(function (st) {
      for (var i = 0; i < 12; i++) spiseroer.push([st[0][0] + (st[1][0] - st[0][0]) * i / 12, st[0][1] + (st[1][1] - st[0][1]) * i / 12]);
    });
    spiseroer.push(d);
    var tarme = [d];
    var start = [t[0] + t[2] * 1.1, t[1] - t[2] * 0.6];
    for (var j = 1; j <= 8; j++) tarme.push([d[0] + (start[0] - d[0]) * j / 8, d[1] + (start[1] - d[1]) * j / 8]);
    // Spiralen gaar udefra og ind og saa ned og ud
    for (var k = 0; k <= 60; k++) {
      var v = -0.6 + k * 0.32, r = t[2] * 1.25 * (0.95 - k * 0.012);
      tarme.push([t[0] + Math.cos(v) * r, t[1] + Math.sin(v) * r * 0.62]);
    }
    var sidst = tarme[tarme.length - 1];
    for (var n = 1; n <= 8; n++) tarme.push([sidst[0] + (t[0] - sidst[0]) * n / 8, sidst[1] + (t[1] + t[2] * 1.15 - sidst[1]) * n / 8]);
    return { mund: m, mave: mv, tarm: t, spiseroer: spiseroer, tarme: tarme,
      steder: { mund: [m], spiseroer: [[h[0], (h[1] + c[1]) / 2, 22]], mave: [mv], tarme: [t] } };
  }
  /** Hvilket sted paa vejen er trykket paa (til at huske vejen)? */
  function vejSted(figur, x, y) {
    var st = madVej(figur).steder, bedst = null, str = Infinity;
    Object.keys(st).forEach(function (n) { st[n].forEach(function (p) { var r = Math.max(p[2], 22); if (Math.hypot(x - p[0], y - p[1]) <= r * 1.2 && r < str) { str = r; bedst = n; } }); });
    return bedst;
  }

  /* ---------- En sund dag ---------- */

  var DAG = [
    { id: 'mad', tid: 'morgen', situation: 'Det er morgen, og maven knurrer.', spoerg: 'Hvad skal du have?', svar: 'aeble', ja: 'Ja. Maden giver kroppen kræfter.', robot: 'Jeg får kræfter fra mit batteri.' },
    { id: 'taender', tid: 'morgen', situation: 'Du har spist morgenmad.', spoerg: 'Hvad skal tænderne have?', svar: 'tandboerste', ja: 'Ja. Når du børster tænder, bliver de rene og stærke.', robot: 'Jeg har ingen tænder, men jeg bliver pudset.' },
    { id: 'haender', tid: 'middag', situation: 'Du har leget i sandkassen, og nu skal du spise.', spoerg: 'Hvad gør du først?', svar: 'saebe', ja: 'Ja. Sæbe vasker bakterierne af hænderne.', robot: 'Mine hænder skal bare tørres af.', vask: true },
    { id: 'vand', tid: 'middag', situation: 'Du har løbet rundt og er helt varm.', spoerg: 'Hvad har du brug for?', svar: 'vand', ja: 'Ja. Kroppen har brug for vand, når den er tørstig.', robot: 'Jeg må aldrig få vand. Så kortslutter jeg.' },
    { id: 'lege', tid: 'eftermiddag', situation: 'Kroppen vil gerne bevæge sig.', spoerg: 'Hvad kan du gøre?', svar: 'bold', ja: 'Ja. Når du løber og leger, bliver kroppen stærk.', robot: 'Jeg skal smøres, så jeg kan bevæge mig.' },
    { id: 'sove', tid: 'aften', situation: 'Det er aften, og du gaber.', spoerg: 'Hvad har kroppen brug for nu?', svar: 'seng', ja: 'Ja. Når du sover, hviler kroppen og vokser.', robot: 'Om natten sætter jeg stikket i og lader op.' }
  ];
  var DAG_KORT = { aeble: B + 'aeble.png', tandboerste: 'ting/tandboerste.svg', saebe: 'ting/saebe.svg', vand: '../rim/billeder/vand.png', bold: B + 'bold.png', seng: 'ting/seng.svg' };
  var VASK = [
    { trin: 'vand', siges: 'Først vand på hænderne.' }, { trin: 'saebe', siges: 'Så sæbe.' },
    { trin: 'gnid', siges: 'Gnid hænderne, til der er masser af skum.' }, { trin: 'skyl', siges: 'Skyl skummet af.' },
    { trin: 'toer', siges: 'Tør hænderne i håndklædet.' }
  ];
  var DAG_TEKST = { hej: 'Rasmus vil vide, hvad en krop har brug for i løbet af en dag.', vask: 'Lad os vaske hænder.', nu: 'Hvad gør du nu?', foerst: 'Først skal du noget andet.', rene: 'Nu er hænderne rene.' };
  /** Dagen fra morgen til aften. Én stjerne tre kort, to stjerner fire, tre stjerner alle seks. */
  function dagRunde(stjerner) {
    var alle = Object.keys(DAG_KORT), n = [3, 4, 6][stjerner];
    return DAG.map(function (d) {
      var andre = bland(alle.filter(function (k) { return k !== d.svar; })).slice(0, n - 1);
      return { id: d.id, tid: d.tid, situation: d.situation, spoerg: d.spoerg, svar: d.svar, ja: d.ja, robot: d.robot, vask: !!d.vask, kort: bland([d.svar].concat(andre)) };
    });
  }

  /* ---------- Alt, der siges, som hele saetninger ---------- */

  function saetningerAf(t) { return (String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }
  function saetninger() {
    var ud = [];
    function laeg(t) { saetningerAf(t).forEach(function (s) { if (ud.indexOf(s) < 0) ud.push(s); }); }
    Object.keys(TEKST).forEach(function (k) { laeg(TEKST[k]); });
    Object.keys(DELE).forEach(function (d) {
      laeg(hvorEr(d)); laeg(pegPaa(d)); laeg(derEr(d)); laeg(detEr(d)); laeg(DELE[d].robot);
      [['emil'], ['ella'], ['emil', 'ella']].forEach(function (f) { laeg(trykPaa(d, f)); });
    });
    Object.keys(ORGANER).forEach(function (o) { laeg(find(o)); laeg('Det er ' + ORGANER[o].bestemt + '.'); fundet(o).forEach(laeg); });
    Object.keys(SANSER).forEach(function (s) { laeg(SANSER[s].ja); laeg(SANSER[s].robot); });
    TING.concat(TING_TO).forEach(function (t) { laeg(t.saetning); });
    Object.keys(MAD_TEKST).forEach(function (k) { laeg(MAD_TEKST[k]); });
    VEJ.forEach(function (v) { laeg(v.ja); });
    Object.keys(FIGURER).forEach(function (f) { MAD.forEach(function (m) { laeg(spiser(f, m)); }); });
    DAG.forEach(function (d) { laeg(d.situation); laeg(d.spoerg); laeg(d.ja); laeg(d.robot); });
    VASK.forEach(function (v) { laeg(v.siges); });
    Object.keys(DAG_TEKST).forEach(function (k) { laeg(DAG_TEKST[k]); });
    return ud;
  }

  rod.Krop = {
    FIGURER: FIGURER, DELE: DELE, PLADS: PLADS, ORGANER: ORGANER, INDRE: INDRE, SANSER: SANSER, SANS_RAEKKE: SANS_RAEKKE,
    TING: TING, TING_TO: TING_TO, RUNDE: RUNDE, TEKST: TEKST,
    hvorEr: hvorEr, pegPaa: pegPaa, trykPaa: trykPaa, derEr: derEr, detEr: detEr, pegRunde: pegRunde, ramte: ramte, rigtigtTryk: rigtigtTryk, naer: naer,
    find: find, roentgenRunde: roentgenRunde, organ: organ, paaOrgan: paaOrgan, fundet: fundet,
    sanseRunde: sanseRunde, sanseSvar: sanseSvar,
    MAD: MAD, STATIONER: STATIONER, MAD_TEKST: MAD_TEKST, VEJ: VEJ, spiser: spiser, madRunde: madRunde, madVej: madVej, vejSted: vejSted,
    DAG: DAG, DAG_KORT: DAG_KORT, VASK: VASK, DAG_TEKST: DAG_TEKST, dagRunde: dagRunde,
    saetninger: saetninger, saetningerAf: saetningerAf
  };
})(typeof window !== 'undefined' ? window : module.exports);
