/**
 * Pelles julekalender: opgaverne efter hver dags historie, uden skaerm.
 *
 * Opgaven staar i kalender.js ved hver dag ({ type, ... }). forbered() goer
 * den klar til skaermen: runderne, kortene, moenstrene, bunkerne og alt, der
 * skal siges, som hele saetninger. Alt er data, saa det samme kan bruges af
 * et vaerktoej, der laver printbare opgaveark, og af testen.
 *
 *   tael      tryk paa hver ting, stemmen taeller med ("En." "To." ...), til sidst "Der var fem."
 *   se        tingene ses kort i et fast moenster (terning, femmerstruktur), svaret paa en talraekke 1..max
 *   flest     to bunker: tryk paa den, der er flest i. "Fire er flere end to."
 *   spor      tegn bogstavet med fingeren (Bogstavvejens streger og sporing), saa "S som i sne."
 *   forlyd    "Hvad starter med J, ligesom jul?", tre kort med Bogstavvejens billeder og ordklip
 *   rim       "Her har du ordet kat." (ordklippet) "Hvad rimer på det?" (Rimhulens ramme)
 *   klap      "Her har du ordet kage." "Klap det på trommen." Stavelserne fra Rimhulen
 *   pynt      traek pynt op paa juletraeet, intet rigtigt eller forkert
 *   venner    vennerne kommer én ad gangen; tryk paa dem og tael med
 *   puslespil den sidste brik (eller flere, loese: [...]) traekkes paa plads, og billedet lyser op
 *
 * Ingen point, ingen tid og ingen straf: et forkert tryk giver en blid
 * rysten og et nyt forsoeg.
 *
 * Ordklippene ("Her har du ordet kat.") laanes fra Bogstavvejen og Rimhulen og
 * spilles for sig, aldrig midt i en saetning (se CLAUDE.md). saetninger()
 * er alt, julekalenderens egen stemme skal indtale til opgaverne;
 * ordene() er de ord, hvis klip laanes.
 *
 * Stier er fra roden af appen (games/bogstaver/...); skaermen saetter ../ foran.
 */
(function (rod) {
  'use strict';

  var Rim = rod.Rim || (typeof require === 'function' ? require('../../games/rim/js/rim.js').Rim : null);

  var TALORD = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv',
    'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve', 'enogtyve', 'toogtyve',
    'treogtyve', 'fireogtyve'];
  function stort(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  /** Talordet som en hel saetning: "En." ... "Fireogtyve." Det, stemmen siger, naar der taelles. */
  function tal(n) { return stort(TALORD[n]) + '.'; }
  function derVar(n) { return 'Der var ' + TALORD[n] + '.'; }
  function flereEnd(a, b) { return stort(TALORD[a]) + ' er flere end ' + TALORD[b] + '.'; }

  /** Det, der siges i alle opgaver. Hver er én eller flere hele saetninger. */
  var TEKST = {
    findBrikken: 'Kan I finde brikken? Tryk på den.',
    brikLagt: 'Nu ligger brikken i puslespillet.',
    godt: 'Godt klaret.',
    ja: 'Ja.',
    kigIgen: 'Vi kigger en gang til.',
    rimer: 'Hvad rimer på det?',
    rimerJa: 'Ja, det rimer.',
    klap: 'Klap det på trommen.',
    klapJa: 'Flot klappet.',
    pyntSlut: 'Hvor er træet flot.',
    pusleSlut: 'Puslespillet er helt.',
    glaedeligJul: 'Glædelig jul.'
  };

  /*
   * Tingene i tael, se og flest. Nogle tegnes i kode i malet stil (maleri.js),
   * resten er malede billeder fra spillene. Et ord, der ikke staar her, men
   * findes i Rimhulen/Bogstavvejen, bruger det billede.
   */
  var TING = {
    julekugle: { tegnes: true },
    lys: { tegnes: true },
    stjerne: { tegnes: true },
    stamme: { tegnes: true },
    'nød': { billede: 'games/bogstaver/billeder/noed.png' },
    kage: { billede: 'games/bogstaver/billeder/kage.png' },
    gran: { billede: 'games/maskinen/billeder/gran.png' },
    snebold: { billede: 'games/maskinen/billeder/snebold.png' },
    snemand: { billede: 'games/maskinen/billeder/snemand.png' },
    kastanje: { billede: 'games/maskinen/billeder/kastanje.png' },
    'æble': { billede: 'games/maskinen/billeder/aeble.png' },
    klokke: { billede: 'games/maskinen/billeder/klokke.png' }
  };

  /*
   * Figurerne fra spillene, til vennerne og til pladsholderbillederne.
   * Nissen Nis har intet billede: han er en hemmelighed til juleaften og tegnes i kode.
   */
  var FIGURER = {
    pelle: 'games/maskinen/billeder/pindsvin.png',
    sanne: 'bog/billeder/skade.png',
    egon: 'games/bogstaver/billeder/egern.png',
    gustav: 'games/restaurant/billeder/gris.png',
    bodil: 'games/baever/billeder/bodil.png',
    klaus: 'games/klatbold/billeder/klat-roed.png',
    klara: 'games/klatbold/billeder/klat-blaa.png',
    rikke: 'games/maskinen/billeder/raev.png',
    milo: 'assets/malet/rummus.png',
    ulla: 'games/maskinen/billeder/ugle.png',
    rasmus: 'games/bogstaver/billeder/robot.png',
    kaja: 'games/maskinen/billeder/kanin.png',
    emil: 'games/bobler/billeder/dreng.png',
    ella: 'games/bobler/billeder/pige.png',
    bo: 'games/maskinen/billeder/bjoern.png',
    nis: null
  };
  /** Vennerne, der kommer lillejuleaften, i den raekkefoelge de kommer. */
  var VENNER = ['sanne', 'egon', 'gustav', 'bodil', 'klaus', 'klara', 'rikke', 'milo', 'ulla', 'rasmus', 'kaja', 'emil', 'ella', 'bo'];

  /* ---------- stier ---------- */

  /** Rimhulens stier er fra games/rim/. Her goeres de til stier fra roden. */
  function fraRim(rel) {
    if (!rel) return null;
    var dele = ('games/rim/' + rel).split('/'), ud = [];
    dele.forEach(function (d) { if (d === '..') ud.pop(); else if (d !== '.') ud.push(d); });
    return ud.join('/');
  }
  /** Et ord fra Bogstavvejen eller Rimhulen: billedet, ordklippet og stavelserne. null, hvis ordet ikke findes. */
  function ord(o) {
    var r = Rim && Rim.ORD[o];
    if (!r) return null;
    return { ord: o, billede: fraRim(r.fil), klip: fraRim(r.klip), reserve: Rim.ORDET + o + '.', stavelser: Rim.STAVELSER[o] || 0 };
  }
  /** Billedet til en ting i tael, se og flest, eller null, hvis den tegnes i kode. */
  function tingBillede(t) {
    if (TING[t]) return TING[t].billede || null;
    var o = ord(t);
    return o ? o.billede : null;
  }
  function tingFindes(t) { return !!(TING[t] || ord(t)); }

  /* ---------- moenstre og pladser (i enheder, uden skaerm) ---------- */

  /**
   * Se: tingene i et fast moenster med afstanden 1 mellem dem og midten i (0, 0).
   * Terningens prikker til seks, og femmerstruktur over fem (en fuld raekke paa
   * fem og resten under), som i Egernreden.
   */
  function moenster(n) {
    var T = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
    };
    if (n <= 6) return { navn: 'terning', pos: T[n].map(function (p) { return { x: p[0] * 0.75, y: p[1] * 0.75 }; }) };
    var ud = [];
    for (var i = 0; i < n; i++) ud.push({ x: i % 5 - 2, y: Math.floor(i / 5) - 0.5 });
    return { navn: 'femmer', pos: ud };
  }

  /*
   * Tael: hvor tingene staar, som broekdele af feltet (x af bredden, y af hoejden),
   * og hvor store de er (str, broekdel af hoejden). Kuglerne haenger paa et
   * juletrae med toppen i (0.5, 0.04) og bunden ved y = 0.84.
   */
  var KUGLER = [[0.5, 0.30], [0.31, 0.62], [0.69, 0.63], [0.40, 0.45], [0.60, 0.47], [0.42, 0.76], [0.58, 0.78], [0.50, 0.60], [0.25, 0.78], [0.75, 0.77]];
  function taelPladser(ting, n) {
    if (ting === 'julekugle' || ting === 'lys') {
      return { trae: true, str: 0.1, pos: KUGLER.slice(0, n).map(function (p) { return { x: p[0], y: p[1] }; }) };
    }
    var ud = [];
    if (ting === 'gran') {
      // Langs banen: skiftevis lidt hoejere og lavere, saa de ikke staar i en lige linje
      for (var i = 0; i < n; i++) ud.push({ x: n === 1 ? 0.5 : 0.1 + i * 0.8 / (n - 1), y: i % 2 ? 0.62 : 0.4 });
      return { str: Math.min(0.34, 1.4 / n), pos: ud };
    }
    var pr = ting === 'kage' ? 3 : Math.min(n, 4), raekker = Math.ceil(n / pr);
    for (var k = 0; k < n; k++) {
      var r = Math.floor(k / pr), iRaekke = Math.min(pr, n - r * pr), c = k - r * pr;
      ud.push({ x: 0.5 + (c - (iRaekke - 1) / 2) * 0.24, y: 0.5 + (r - (raekker - 1) / 2) * 0.3 });
    }
    return { str: 0.24, pos: ud };
  }

  /** Flest: en bunke paa n ting, bredest nederst. Afstand 1, y = 0 er nederste raekke, opad er negativ. */
  function bunke(n) {
    var bund = 1;
    while (bund * (bund + 1) / 2 < n) bund++;
    var ud = [], raekke = 0, igen = n;
    while (igen > 0) {
      var m = Math.min(igen, bund - raekke);
      for (var i = 0; i < m; i++) ud.push({ x: i - (m - 1) / 2, y: -raekke * 0.86 });
      igen -= m; raekke++;
    }
    return ud;
  }

  /* ---------- opgaven klar til skaermen ---------- */

  var BOGSTAVNAVN = { 'Æ': 'AE', 'Ø': 'OE', 'Å': 'AA' };
  var LOESE = [24];                 // puslespil: brikkerne, der ligger loese juleaften (historien: kun den sidste)

  function forbered(d) {
    var o = d.opgave || {}, ud = { type: o.type, dag: d.dag, fejring: TEKST.godt };
    switch (o.type) {
      case 'tael':
        ud.ting = o.ting; ud.antal = o.antal; ud.spoerg = o.spoerg;
        ud.pladser = taelPladser(o.ting, o.antal);
        ud.slut = derVar(o.antal);
        break;
      case 'se':
        ud.max = o.max; ud.spoerg = o.spoerg; ud.vis = o.vis || 2; ud.igen = TEKST.kigIgen;
        ud.runder = (o.runder || []).map(function (r) {
          return { ting: r.ting || o.ting, antal: r.antal, moenster: moenster(r.antal), svar: TEKST.ja + ' ' + derVar(r.antal) };
        });
        break;
      case 'flest':
        ud.spoerg = o.spoerg;
        ud.runder = (o.runder || []).map(function (r) {
          var flest = r.venstre > r.hoejre ? 'venstre' : 'hoejre';
          return {
            ting: r.ting || o.ting, venstre: r.venstre, hoejre: r.hoejre, flest: flest,
            bunker: { venstre: bunke(r.venstre), hoejre: bunke(r.hoejre) },
            svar: TEKST.ja + ' ' + flereEnd(Math.max(r.venstre, r.hoejre), Math.min(r.venstre, r.hoejre))
          };
        });
        break;
      case 'spor':
        ud.bogstav = o.bogstav; ud.glyf = BOGSTAVNAVN[o.bogstav] || String(o.bogstav).toUpperCase();
        ud.spoerg = 'Tegn et ' + o.bogstav + ' med fingeren.';
        ud.slut = o.ord;
        break;
      case 'forlyd':
        ud.lyd = o.lyd; ud.eksempel = o.eksempel;
        ud.spoerg = 'Hvad starter med ' + o.lyd + ', ligesom ' + o.eksempel + '?';
        ud.rigtigTekst = 'Ja, det starter med ' + o.lyd + '.';
        ud.runder = (o.runder || []).map(function (r) { return { rigtig: r.rigtig, andre: r.andre, kort: [r.rigtig].concat(r.andre) }; });
        break;
      case 'rim':
        ud.spoerg = TEKST.rimer; ud.rigtigTekst = TEKST.rimerJa;
        ud.runder = (o.runder || []).map(function (r) { return { ord: r.ord, rigtig: r.rigtig, andre: r.andre, kort: [r.rigtig].concat(r.andre) }; });
        break;
      case 'klap':
        ud.spoerg = TEKST.klap; ud.rigtigTekst = TEKST.klapJa;
        ud.runder = (o.runder || []).map(function (r) { return { ord: r.ord, stavelser: Rim ? Rim.STAVELSER[r.ord] || 0 : 0 }; });
        break;
      case 'pynt':
        ud.spoerg = o.spoerg; ud.slut = TEKST.pyntSlut; ud.mindst = o.mindst || 5;
        break;
      case 'venner':
        ud.spoerg = o.spoerg; ud.venner = o.venner || VENNER;
        ud.slut = 'Der var ' + TALORD[ud.venner.length] + ' venner.';
        break;
      case 'puslespil':
        ud.spoerg = o.spoerg; ud.loese = o.loese || LOESE;
        ud.slut = TEKST.pusleSlut + ' ' + TEKST.glaedeligJul;
        break;
    }
    return ud;
  }

  /** Alle replikker, én opgave kan sige (uden ordklippene og talordene). */
  function replikker(f) {
    var ud = [f.spoerg, f.slut, f.igen, f.rigtigTekst, f.fejring];
    (f.runder || []).forEach(function (r) { ud.push(r.svar); });
    return ud.filter(function (t) { return typeof t === 'string' && t; });
  }

  /** En replik delt i saetninger, praecis som js/stemme.js deler den. */
  function saetningerAf(t) { return (String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }

  /** Alt, opgaverne kan sige, som hele saetninger, saa det kan indtales. */
  function saetninger(Kalender) {
    var ud = [];
    function laeg(t) { saetningerAf(t).forEach(function (s) { if (ud.indexOf(s) < 0) ud.push(s); }); }
    Object.keys(TEKST).forEach(function (k) { laeg(TEKST[k]); });
    for (var n = 1; n <= 24; n++) laeg(tal(n));
    (Kalender ? Kalender.DAGE : []).forEach(function (d) { replikker(forbered(d)).forEach(laeg); });
    return ud;
  }

  /** De ord, hvis klip og billeder laanes fra Bogstavvejen og Rimhulen. */
  function ordene(Kalender) {
    var ud = [];
    function laeg(o) { if (o && ud.indexOf(o) < 0) ud.push(o); }
    (Kalender ? Kalender.DAGE : []).forEach(function (d) {
      var f = forbered(d);
      (f.runder || []).forEach(function (r) {
        if (f.type === 'forlyd') r.kort.forEach(laeg);
        if (f.type === 'rim') { laeg(r.ord); r.kort.forEach(laeg); }
        if (f.type === 'klap') laeg(r.ord);
      });
    });
    return ud;
  }

  rod.Opgaver = {
    TALORD: TALORD, TEKST: TEKST, TING: TING, FIGURER: FIGURER, VENNER: VENNER, KUGLER: KUGLER, LOESE: LOESE,
    tal: tal, derVar: derVar, flereEnd: flereEnd, ord: ord, tingBillede: tingBillede, tingFindes: tingFindes,
    moenster: moenster, taelPladser: taelPladser, bunke: bunke, forbered: forbered, replikker: replikker,
    saetningerAf: saetningerAf, saetninger: saetninger, ordene: ordene
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
