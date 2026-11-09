/**
 * Pelles julekalender: opgaverne efter hver dags historie, uden skaerm.
 *
 * Opgaven staar i kalender.js ved hver dag ({ type, ... }). forbered() goer
 * den klar til skaermen som en raekke dele (f.dele), der kommer efter
 * hinanden: let foerst, saa svaerere. Hver del er én skaerm med én opgave
 * (lege.js) og alt, den skal sige, som hele saetninger. Alt er data, saa det
 * samme kan bruges af et vaerktoej, der laver printbare opgaveark, og af testen.
 *
 * Dagenes typer, og de dele, de bliver til:
 *   tael      tael tingene (8-15, spredt), og bagefter "Der kommer to til. Hvor mange er der nu?" paa en talraekke
 *   se        tingene ses kort (terning, tierramme), svaret paa en talraekke; "Hvor mange mangler, foer der er ti?"
 *   flest     tryk paa bunken med flest, og bagefter "Hvor mange flere er der?" paa en talraekke
 *   regn      smaa regnehistorier med billeder: "Gustav har fem kager. Han bager tre mere. Hvor mange har han nu?"
 *   spor      tegn det store og det lille bogstav, find to billeder med bogstavets lyd, og hvilket bogstav et ord starter med
 *   forlyd    find alle kort, der starter med lyden (1-2 af 4), og hvilket bogstav et ord starter med
 *   rim       hvad rimer paa ordet (1 af 4), hvilket ord rimer ikke (1 af 3), og find to, der rimer (2 af 4)
 *   klap      klap ordet paa trommen (1-4 stavelser), og hvilket ord har flest klap (1 af 2)
 *   pynt      haeng den naeste i guirlandens moenster (AB, AAB, ABC), og pynt saa juletraeet frit
 *   venner    tael vennerne, tael to grupper i alt, og sorter dem, der kan flyve, op i traeet
 *   puslespil laeg de fem loese brikker, vennerne har lagt frem, og saa Nis' sidste brik
 *
 * Delenes typer (skaermene i lege.js): tael, regn, se, flest, spor, kort, klap,
 * moenster, pynt, venner, sorter, puslespil. runde(del) er reglerne for én del:
 * hvad der er rigtigt, hvornaar den er faerdig, og (til testens robot) hvad der
 * er en loesning, og hvad der er et forkert svar. Skaermen og testen bruger de
 * samme regler.
 *
 * Ingen point, ingen tid og ingen straf: et forkert tryk giver en blid
 * rysten og et nyt forsoeg.
 *
 * Ordklippene ("Her har du ordet kat.") laanes fra Bogstavvejen og Rimhulen og
 * spilles for sig, aldrig midt i en saetning (se CLAUDE.md). Et spoergsmaal om
 * et ord er en raekke: [{ ord: 'kat' }, 'Hvad rimer på det?']. saetninger()
 * er alt, julekalenderens egen stemme skal indtale til opgaverne;
 * ordene() er de ord, hvis klip laanes.
 *
 * Stier er fra roden af appen (games/bogstaver/...); skaermen saetter ../ foran.
 */
(function (rod) {
  'use strict';

  var kraev = typeof require === 'function';
  var Rim = rod.Rim || (kraev ? require('../../games/rim/js/rim.js').Rim : null);
  var P = rod.Puslespil || (kraev ? require('./puslespil.js').Puslespil : null);

  var TALORD = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni', 'ti', 'elleve', 'tolv',
    'tretten', 'fjorten', 'femten', 'seksten', 'sytten', 'atten', 'nitten', 'tyve', 'enogtyve', 'toogtyve',
    'treogtyve', 'fireogtyve'];
  function stort(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  /** Talordet, med "én" for 1, saa stemmen laegger trykket rigtigt ("Sanne tager én."). */
  function talord(n) { return n === 1 ? 'én' : TALORD[n]; }
  /** Talordet som en hel saetning: "En." ... "Fireogtyve." Det, stemmen siger, naar der taelles. */
  function tal(n) { return stort(TALORD[n]) + '.'; }
  function derVar(n) { return 'Der var ' + TALORD[n] + '.'; }
  function flereEnd(a, b) { return stort(TALORD[a]) + ' er flere end ' + TALORD[b] + '.'; }
  /** Svaret paa en talraekke: "Ja, det er otte." */
  function jaDetEr(n) { return 'Ja, det er ' + talord(n) + '.'; }

  /** Det, der siges i alle opgaver. Hver er én eller flere hele saetninger. */
  var TEKST = {
    findBrikken: 'Kan I finde brikken? Tryk på den.',
    brikLagt: 'Nu ligger brikken i puslespillet.',
    godt: 'Godt klaret.',
    helt: 'I klarede det hele.',
    ja: 'Ja.',
    proevIgen: 'Prøv igen.',
    kigIgen: 'Vi kigger en gang til.',
    nu: 'Hvor mange er der nu?',
    tilbage: 'Hvor mange er der tilbage?',
    flere: 'Hvor mange flere er der?',
    mangler: 'Hvor mange mangler, før der er ti?',
    toRigtige: 'Der er to. Find dem begge.',
    enTil: 'Find én til.',
    hvilketBogstav: 'Hvilket bogstav starter det med?',
    rimer: 'Hvad rimer på det?',
    rimerJa: 'Ja, det rimer.',
    rimerIkke: 'Hvilket ord rimer ikke?',
    rimerIkkeJa: 'Ja, det rimer ikke.',
    rimPar: 'Find to ord, der rimer.',
    klap: 'Klap det på trommen.',
    klapJa: 'Flot klappet.',
    flestKlap: 'Hvilket ord har flest klap?',
    flestKlapJa: 'Ja, det har flest klap.',
    moenster: 'Se på guirlanden. Hvad skal hænge der nu?',
    moensterJa: 'Ja, det passer i mønstret.',
    sorterOp: 'Dem, der kan flyve, skal op i træet.',
    sorterNed: 'Dem, der ikke kan flyve, skal ned på jorden.',
    sorterJa: 'Ja, det er rigtigt.',
    nisBrik: 'Nis har den sidste brik.',
    pyntSlut: 'Hvor er træet flot.',
    pusleSlut: 'Puslespillet er helt.',
    glaedeligJul: 'Glædelig jul.'
  };

  /*
   * Tingene i tael, se, flest og regn. Nogle tegnes i kode i malet stil (maleri.js),
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
  /** Hvem der kan flyve af sig selv (til sorteringen). Milo flyver kun i sin raket og er ikke med. */
  var FLYVER = { sanne: true, ulla: true, egon: false, gustav: false, bodil: false, klaus: false, klara: false, rikke: false, rasmus: false, kaja: false, emil: false, ella: false, bo: false };

  /** Pynten paa guirlanden og juletraeet: julekugler i paletten og tre former. */
  var PYNT = {
    roed: { t: 'kugle', f: 0 }, blaa: { t: 'kugle', f: 1 }, gul: { t: 'kugle', f: 2 }, lilla: { t: 'kugle', f: 3 },
    groen: { t: 'kugle', f: 5 }, stjerne: { t: 'stjerne' }, klokke: { t: 'klokke' }, lys: { t: 'lys' }
  };

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
   * Terningens prikker til seks, og tierrammen (to raekker paa fem, den oeverste
   * fyldes foerst), som i Egernreden.
   */
  function moenster(n, navn) {
    var T = {
      1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]],
      5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]]
    };
    if ((navn || (n <= 6 ? 'terning' : 'tierramme')) === 'terning' && n <= 6) {
      return { navn: 'terning', pos: T[n].map(function (p) { return { x: p[0] * 0.75, y: p[1] * 0.75 }; }) };
    }
    var ud = [];
    for (var i = 0; i < n; i++) ud.push({ x: i % 5 - 2, y: Math.floor(i / 5) - 0.5 });
    return { navn: 'tierramme', pos: ud, celler: 10 };
  }

  /** En lille, fast tilfaeldighed, saa tingene ligger spredt, men ens hver gang (og testen kan se dem). */
  function tilfaeldig(froe) {
    var s = (froe * 2654435761) % 4294967296 || 1;
    return function () { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; };
  }
  /**
   * n pladser spredt i et omraade (broekdele af feltet), med mindst afstanden d
   * mellem midterne, maalt i feltets hoejde (forhold er bredde/hoejde).
   */
  function spred(n, froe, d, omr) {
    for (var forsoeg = 0; forsoeg < 40; forsoeg++, d *= 0.96) {
      var rnd = tilfaeldig(froe + forsoeg), ud = [];
      for (var k = 0; k < 6000 && ud.length < n; k++) {
        var x = omr.x0 + rnd() * (omr.x1 - omr.x0), y = omr.y0 + rnd() * (omr.y1 - omr.y0);
        if (omr.inde && !omr.inde(x, y)) continue;
        if (ud.some(function (p) { return Math.hypot((p.x - x) * omr.forhold, p.y - y) < d; })) continue;
        ud.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
      }
      if (ud.length === n) return ud;
    }
    return ud;
  }

  /*
   * Tael: hvor tingene staar, som broekdele af feltet (x af bredden, y af hoejden),
   * og hvor store de er (str, broekdel af hoejden). Julekuglerne haenger spredt paa
   * et juletrae med toppen i (0.5, 0.04) og bunden ved y = 0.96 (feltet er 0.8 saa
   * bredt, som det er hoejt); alt andet ligger spredt i et felt paa 4:3.
   */
  var KUGLER = [[0.5, 0.30], [0.31, 0.62], [0.69, 0.63], [0.40, 0.45], [0.60, 0.47], [0.42, 0.76], [0.58, 0.78], [0.50, 0.60], [0.25, 0.78], [0.75, 0.77]];
  function taelPladser(ting, n, froe) {
    if (ting === 'julekugle' || ting === 'lys') {
      var str = 0.095;
      return {
        trae: true, str: str, forhold: 0.8,
        pos: spred(n, froe, str * 1.12, { x0: 0.12, x1: 0.88, y0: 0.2, y1: 0.84, forhold: 0.8, inde: function (x, y) { return Math.abs(x - 0.5) < 0.36 * (y - 0.1) / 0.8; } })
      };
    }
    var s = Math.min(0.2, 0.64 / Math.sqrt(n));
    return { str: s, forhold: 4 / 3, pos: spred(n, froe, s * 1.12, { x0: 0.08, x1: 0.92, y0: 0.1, y1: 0.9, forhold: 4 / 3 }) };
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

  /** Guirlandens raekke: moensteret (fx 'AAB') gentaget med pynten i dele, saa vist + mangler i alt. */
  function guirlande(m) {
    var ud = [];
    for (var i = 0; i < m.vist + (m.mangler || 1); i++) ud.push(m.dele[m.moenster.charCodeAt(i % m.moenster.length) - 65]);
    return ud;
  }

  /* ---------- opgaven klar til skaermen: dagens dele ---------- */

  var BOGSTAVNAVN = { 'Æ': 'AE', 'Ø': 'OE', 'Å': 'AA', 'æ': 'ae', 'ø': 'oe', 'å': 'aa' };
  function glyfNavn(b) { return BOGSTAVNAVN[b] || b; }
  var LOESE = [19, 20, 21, 22, 23];  // puslespil: de brikker, vennerne har lagt frem juleaften
  var NIS = 24;                       // og den sidste, som Nis har passet paa
  var STEDER = [[6.35, 1.4], [-1.35, 1.4], [6.35, 2.8], [-1.35, 2.8], [6.35, 0], [-1.35, 0]];

  /** Kortene i en kortleg: { ord } eller { bogstav }, og noeglen, reglerne kender dem paa. */
  function kortAf(liste, bogstaver) { return liste.map(function (k) { return bogstaver ? { bogstav: k, noegle: k } : { ord: k, noegle: k }; }); }

  /** "Hvad starter med J, ligesom jul?" og, naar to er rigtige, "Der er to. Find dem begge." */
  function forlydDel(lyd, eksempel, r, variant) {
    var rigtige = r.rigtige || [r.rigtig];
    var spoerg = 'Hvad starter med ' + lyd + ', ligesom ' + eksempel + '?';
    return {
      type: 'kort', variant: variant, lyd: lyd, eksempel: eksempel, hoved: { bogstav: lyd },
      kort: kortAf(rigtige.concat(r.andre)), rigtige: rigtige.slice(),
      spoerg: rigtige.length > 1 ? [spoerg + ' ' + TEKST.toRigtige] : [spoerg], igen: [spoerg],
      rigtigTekst: 'Ja, det starter med ' + lyd + '.', endnu: TEKST.enTil, forkert: 'klip+spoerg'
    };
  }
  /** "Her har du ordet kat." "Hvilket bogstav starter det med?" Tre bogstaver at vaelge imellem. */
  function hvilketDel(h) {
    var rigtig = h.ord.charAt(0).toUpperCase();
    return {
      type: 'kort', variant: 'bogstav', ord: h.ord, hoved: { ord: h.ord },
      kort: kortAf(h.valg, true), rigtige: [rigtig],
      spoerg: [{ ord: h.ord }, TEKST.hvilketBogstav], igen: [{ ord: h.ord }, TEKST.hvilketBogstav],
      rigtigTekst: 'Ja, det starter med ' + rigtig + '.', forkert: 'proev'
    };
  }
  function gruppe(o) { return Rim ? Rim.GRUPPE[o] : undefined; }
  /** De kort, der ikke rimer paa nogen af de andre. */
  function enlige(kort) { return kort.filter(function (k) { return kort.filter(function (q) { return gruppe(q) === gruppe(k); }).length === 1; }); }

  function forbered(d) {
    var o = d.opgave || {}, ud = { type: o.type, dag: d.dag, fejring: TEKST.godt + ' ' + TEKST.helt, dele: [] };
    var dele = ud.dele;
    switch (o.type) {
      case 'tael':
        (o.runder || []).forEach(function (r, ri) {
          var ting = r.ting || o.ting, efter = r.efter || [], n = r.antal, top = n;
          efter.forEach(function (e) { n += (e.plus || 0) - (e.minus || 0); top = Math.max(top, n); });
          var pl = taelPladser(ting, top, d.dag * 7 + ri);
          dele.push({ type: 'tael', ting: ting, antal: r.antal, spoerg: r.spoerg, slut: derVar(r.antal),
            pladser: { trae: pl.trae, str: pl.str, forhold: pl.forhold, pos: pl.pos.slice(0, r.antal) } });
          n = r.antal;
          efter.forEach(function (e) {
            var plus = e.plus || 0, minus = e.minus || 0, svar = n + plus - minus;
            var tekst = e.tekst || (plus ? 'Der kommer ' + talord(plus) + ' til.' : 'Sanne tager ' + talord(minus) + '.');
            dele.push({ type: 'regn', layout: 'felt', ting: ting, pladser: pl, talt: r.antal, foer: n, plus: plus, minus: minus,
              stil: e.stil || 'flyv', saetninger: [tekst], spoerg: e.spoerg || (plus ? TEKST.nu : TEKST.tilbage),
              svar: svar, max: Math.max(n, svar) > 10 ? 20 : 10, rigtigTekst: jaDetEr(svar) });
            n = svar;
          });
        });
        break;
      case 'regn':
        if (o.foerst) {
          // Foerst taelles tingene, saa kommer regnehistorierne
          var pl0 = taelPladser(o.foerst.ting || o.ting, o.foerst.antal, d.dag * 7);
          dele.push({ type: 'tael', ting: o.foerst.ting || o.ting, antal: o.foerst.antal, spoerg: o.foerst.spoerg, slut: derVar(o.foerst.antal), pladser: pl0 });
        }
        (o.runder || []).forEach(function (r) {
          var s = saetningerAf(r.tekst), plus = r.plus || 0, minus = r.minus || 0, svar = r.foer + plus - minus;
          dele.push({ type: 'regn', layout: 'gruppe', ting: r.ting || o.ting, figur: r.figur || null, daek: r.daek || null,
            foer: r.foer, plus: plus, minus: minus, saetninger: s.slice(0, 2), spoerg: s.slice(2).join(' '), tekst: r.tekst,
            svar: svar, max: 10, rigtigTekst: jaDetEr(svar) });
        });
        break;
      case 'se':
        var dele0 = saetningerAf(o.spoerg);
        (o.runder || []).forEach(function (r) {
          var m = moenster(r.antal, r.moenster);
          dele.push({ type: 'se', ting: r.ting || o.ting, antal: r.antal, moenster: m, vis: r.vis || 2, max: o.max || 10,
            foer: dele0.length > 1 ? dele0[0] : null, spoerg: dele0.length > 1 ? dele0.slice(1).join(' ') : o.spoerg,
            igen: TEKST.kigIgen, svar: TEKST.ja + ' ' + derVar(r.antal),
            mangler: r.mangler ? { spoerg: TEKST.mangler, svar: 10 - r.antal, rigtigTekst: jaDetEr(10 - r.antal) } : null });
        });
        break;
      case 'flest':
        (o.runder || []).forEach(function (r) {
          var flest = r.venstre > r.hoejre ? 'venstre' : 'hoejre', forskel = Math.abs(r.venstre - r.hoejre);
          dele.push({ type: 'flest', ting: r.ting || o.ting, venstre: r.venstre, hoejre: r.hoejre, flest: flest,
            bunker: { venstre: bunke(r.venstre), hoejre: bunke(r.hoejre) }, spoerg: o.spoerg,
            svar: TEKST.ja + ' ' + flereEnd(Math.max(r.venstre, r.hoejre), Math.min(r.venstre, r.hoejre)),
            flere: { spoerg: TEKST.flere, svar: forskel, rigtigTekst: jaDetEr(forskel), raekke: !!r.raekke }, max: 10 });
        });
        break;
      case 'spor':
        var lille = o.bogstav.toLowerCase();
        dele.push({ type: 'spor', bogstav: o.bogstav, glyf: glyfNavn(o.bogstav), stor: true, spoerg: 'Tegn et stort ' + o.bogstav + ' med fingeren.', slut: o.ord });
        dele.push({ type: 'spor', bogstav: lille, glyf: glyfNavn(lille), stor: false, spoerg: 'Tegn et lille ' + lille + ' med fingeren.', slut: null });
        (o.find || []).forEach(function (r) { dele.push(forlydDel(o.bogstav, o.eksempel, r, 'forlyd')); });
        (o.hvilket || []).forEach(function (h) { dele.push(hvilketDel(h)); });
        break;
      case 'forlyd':
        (o.runder || []).forEach(function (r) { dele.push(forlydDel(o.lyd, o.eksempel, r, 'forlyd')); });
        (o.hvilket || []).forEach(function (h) { dele.push(hvilketDel(h)); });
        break;
      case 'rim':
        (o.runder || []).forEach(function (r) {
          dele.push({ type: 'kort', variant: 'rim', ord: r.ord, hoved: { ord: r.ord }, kort: kortAf([r.rigtig].concat(r.andre)), rigtige: [r.rigtig],
            spoerg: [{ ord: r.ord }, TEKST.rimer], igen: [{ ord: r.ord }, TEKST.rimer], rigtigTekst: TEKST.rimerJa, forkert: 'klip+spoerg' });
        });
        (o.ikke || []).forEach(function (kort) {
          dele.push({ type: 'kort', variant: 'rimIkke', hoved: null, kort: kortAf(kort), rigtige: enlige(kort), laes: true,
            spoerg: [TEKST.rimerIkke], igen: [TEKST.rimerIkke], rigtigTekst: TEKST.rimerIkkeJa, forkert: 'klip+proev' });
        });
        (o.par || []).forEach(function (kort) {
          var par = kort.filter(function (k) { return enlige(kort).indexOf(k) < 0; });
          dele.push({ type: 'kort', variant: 'rimPar', hoved: null, kort: kortAf(kort), rigtige: par, laes: true,
            spoerg: [TEKST.rimPar], igen: [TEKST.rimPar], rigtigTekst: TEKST.rimerJa, forkert: 'klip+proev' });
        });
        break;
      case 'klap':
        (o.runder || []).forEach(function (r) {
          dele.push({ type: 'klap', ord: r.ord, stavelser: Rim ? Rim.STAVELSER[r.ord] || 0 : 0, spoerg: TEKST.klap, rigtigTekst: TEKST.klapJa });
        });
        (o.flest || []).forEach(function (kort) {
          var st = kort.map(function (k) { return Rim ? Rim.STAVELSER[k] || 0 : 0; }), maks = Math.max.apply(null, st);
          dele.push({ type: 'kort', variant: 'klapFlest', hoved: null, kort: kortAf(kort), stavelser: st, laes: true,
            rigtige: kort.filter(function (k, i) { return st[i] === maks; }),
            spoerg: [TEKST.flestKlap], igen: [TEKST.flestKlap], rigtigTekst: TEKST.flestKlapJa, forkert: 'klip+proev' });
        });
        break;
      case 'pynt':
        (o.moenstre || []).forEach(function (m) {
          var raekke = guirlande(m), vist = raekke.slice(0, m.vist);
          dele.push({ type: 'moenster', moenster: m.moenster, raekke: raekke, vist: m.vist, svar: raekke.slice(m.vist), valg: m.valg,
            spoerg: TEKST.moenster, rigtigTekst: TEKST.moensterJa, igen: TEKST.proevIgen, enheder: vist.length });
        });
        dele.push({ type: 'pynt', spoerg: o.spoerg, slut: TEKST.pyntSlut, mindst: o.mindst || 5 });
        break;
      case 'venner':
        var venner = o.venner || VENNER;
        dele.push({ type: 'venner', spoerg: o.spoerg, venner: venner, slut: 'Der var ' + TALORD[venner.length] + ' venner.' });
        (o.grupper || []).forEach(function (r) {
          var s = saetningerAf(r.tekst), svar = r.ting.length;
          dele.push({ type: 'regn', layout: 'gruppe', ting: r.ting.slice(), figurer: true, foer: r.foer, plus: r.ting.length - r.foer, minus: 0,
            saetninger: s.slice(0, 2), spoerg: s.slice(2).join(' '), tekst: r.tekst, svar: svar, max: 10, rigtigTekst: jaDetEr(svar) });
        });
        if (o.sorter) {
          dele.push({ type: 'sorter', figurer: o.sorter.map(function (n) { return { navn: n, op: !!FLYVER[n] }; }),
            spoerg: TEKST.sorterOp + ' ' + TEKST.sorterNed, op: TEKST.sorterOp, ned: TEKST.sorterNed, rigtigTekst: TEKST.sorterJa });
        }
        break;
      case 'puslespil':
        var loese = o.loese || LOESE, nis = o.nis || NIS;
        dele.push({ type: 'puslespil', loese: loese, skjult: [nis], steder: STEDER.slice(0, loese.length), spoerg: o.spoergLoese, slut: null });
        dele.push({ type: 'puslespil', loese: [nis], skjult: [], steder: [[-1.4, 0.9]], nis: true, spoerg: TEKST.nisBrik + ' ' + o.spoerg,
          slut: TEKST.pusleSlut + ' ' + TEKST.glaedeligJul });
        break;
    }
    dele.forEach(function (x, i) { x.nr = i; x.dag = d.dag; });
    return ud;
  }

  /* ---------- reglerne for én del ---------- */

  /**
   * runde(del): { svar(valg) -> { rigtig, faerdig }, loesning(), forkert(), t }.
   * valg er det, et barn goer: et tal paa talraekken, et kort, en side, et klap ...
   * loesning() er naeste rigtige valg, og forkert() er en liste af valg, hvor det
   * sidste er forkert (eller null, hvis man ikke kan goere noget forkert).
   * Skaermen (lege.js) spoerger reglerne, og testens robot spiller med dem.
   */
  /**
   * Laagens opgave: de foerste (letteste) dele af hver af laagens historiers opgaver, i traek.
   * L er en laage fra Kalender.LAAGER ({ dage, opgave: { dag: antal dele } }). Hver del beholder
   * sin dag, saa legen kan finde dagens figurer.
   */
  function forberedLaage(L, Kalender) {
    var dele = [], forste = null;
    L.dage.forEach(function (n) {
      var f = forbered(Kalender.DAGE[n - 1]);
      if (!forste) forste = f;
      var antal = L.opgave && L.opgave[n] != null ? L.opgave[n] : f.dele.length;
      dele = dele.concat(f.dele.slice(0, antal));
    });
    dele.forEach(function (x, i) { x.nr = i; });
    return { type: forste.type, laage: L.nr, dag: L.dage[L.dage.length - 1], fejring: forste.fejring, dele: dele };
  }
  function andetTal(svar, max) { return svar === 1 ? 2 : svar - 1 >= 1 && svar - 1 <= max ? svar - 1 : 1; }
  var REGLER = {
    tael: {
      svar: function (d, t, i) {
        if (!(i >= 0 && i < d.antal) || t.talt.indexOf(i) >= 0) return { rigtig: false };
        t.talt.push(i);
        return { rigtig: true, faerdig: t.talt.length === d.antal, nr: t.talt.length };
      },
      loesning: function (d, t) { for (var i = 0; i < d.antal; i++) if (t.talt.indexOf(i) < 0) return i; return null; },
      forkert: function (d, t) { return t.talt.length ? [t.talt[0]] : null; }
    },
    regn: {
      svar: function (d, t, n) { var ok = n === d.svar; if (!ok) t.forkerte++; return { rigtig: ok, faerdig: ok }; },
      loesning: function (d) { return d.svar; },
      forkert: function (d) { return [andetTal(d.svar, d.max)]; }
    },
    se: {
      svar: function (d, t, n) {
        var maal = t.fase === 0 ? d.antal : d.mangler.svar;
        if (n !== maal) return { rigtig: false };
        if (t.fase === 0 && d.mangler) { t.fase = 1; return { rigtig: true, faerdig: false }; }
        return { rigtig: true, faerdig: true };
      },
      loesning: function (d, t) { return t.fase === 0 ? d.antal : d.mangler.svar; },
      forkert: function (d, t) { return [andetTal(t.fase === 0 ? d.antal : d.mangler.svar, d.max)]; }
    },
    flest: {
      svar: function (d, t, v) {
        if (t.fase === 0) {
          if (v !== d.flest) return { rigtig: false };
          t.fase = 1; return { rigtig: true, faerdig: !d.flere };
        }
        return { rigtig: v === d.flere.svar, faerdig: v === d.flere.svar };
      },
      loesning: function (d, t) { return t.fase === 0 ? d.flest : d.flere.svar; },
      forkert: function (d, t) { return [t.fase === 0 ? (d.flest === 'venstre' ? 'hoejre' : 'venstre') : andetTal(d.flere.svar, d.max)]; }
    },
    spor: {
      svar: function (d, t, v) { return { rigtig: v === 'faerdig', faerdig: v === 'faerdig' }; },
      loesning: function () { return 'faerdig'; },
      forkert: function () { return null; }
    },
    kort: {
      /** valg: kortets nummer. Et kort, der allerede er fundet, goer ingenting. */
      svar: function (d, t, i) {
        var k = d.kort[i];
        if (!k) return { rigtig: false };
        if (t.fundet.indexOf(k.noegle) >= 0) return { rigtig: false, ingenting: true };
        if (d.rigtige.indexOf(k.noegle) < 0) return { rigtig: false };
        t.fundet.push(k.noegle);
        return { rigtig: true, faerdig: t.fundet.length === d.rigtige.length };
      },
      loesning: function (d, t) { for (var i = 0; i < d.kort.length; i++) if (d.rigtige.indexOf(d.kort[i].noegle) >= 0 && t.fundet.indexOf(d.kort[i].noegle) < 0) return i; return null; },
      forkert: function (d) { for (var i = 0; i < d.kort.length; i++) if (d.rigtige.indexOf(d.kort[i].noegle) < 0) return [i]; return null; }
    },
    klap: {
      /** 'klap' er ét slag paa trommen; 'faerdig' er, naar trommen har vaeret stille et oejeblik. */
      svar: function (d, t, v) {
        if (v === 'klap') {
          t.antal++;
          if (t.antal > d.stavelser) { t.antal = 0; return { rigtig: false }; }   // én for meget: forfra, uden straf
          return { rigtig: true, faerdig: false, naaet: t.antal === d.stavelser };
        }
        return { rigtig: t.antal === d.stavelser, faerdig: t.antal === d.stavelser };
      },
      loesning: function (d, t) { return t.antal < d.stavelser ? 'klap' : 'faerdig'; },
      forkert: function (d) { var ud = []; for (var i = 0; i <= d.stavelser; i++) ud.push('klap'); return ud; }
    },
    moenster: {
      svar: function (d, t, v) {
        if (v !== d.svar[t.udfyldt]) return { rigtig: false };
        t.udfyldt++;
        return { rigtig: true, faerdig: t.udfyldt === d.svar.length };
      },
      loesning: function (d, t) { return d.svar[t.udfyldt]; },
      forkert: function (d, t) { var v = d.valg.filter(function (x) { return x !== d.svar[t.udfyldt]; }); return v.length ? [v[0]] : null; }
    },
    pynt: {
      /** 'haeng' er en pynt paa traeet, 'tabt' en, der faldt ved siden af, og 'faerdig' er fluebenet. */
      svar: function (d, t, v) {
        if (v === 'haeng') { t.haengt++; return { rigtig: true, faerdig: false, flueben: t.haengt >= d.mindst }; }
        if (v === 'faerdig' && t.haengt >= d.mindst) return { rigtig: true, faerdig: true };
        return { rigtig: false };
      },
      loesning: function (d, t) { return t.haengt < d.mindst ? 'haeng' : 'faerdig'; },
      forkert: function () { return ['tabt']; }
    },
    venner: {
      svar: function (d, t, i) {
        if (i !== t.aktiv) return { rigtig: false };
        t.aktiv++;
        return { rigtig: true, faerdig: t.aktiv === d.venner.length, nr: t.aktiv };
      },
      loesning: function (d, t) { return t.aktiv; },
      forkert: function () { return null; }
    },
    sorter: {
      /** valg: { navn, sted: 'op' | 'ned' }. Et forkert sted: figuren hopper tilbage. */
      svar: function (d, t, v) {
        var f = d.figurer.filter(function (x) { return x.navn === v.navn; })[0];
        if (!f || t.placeret[v.navn] || (v.sted === 'op') !== f.op) return { rigtig: false };
        t.placeret[v.navn] = v.sted;
        return { rigtig: true, faerdig: d.figurer.every(function (x) { return t.placeret[x.navn]; }) };
      },
      loesning: function (d, t) { var f = d.figurer.filter(function (x) { return !t.placeret[x.navn]; })[0]; return f ? { navn: f.navn, sted: f.op ? 'op' : 'ned' } : null; },
      forkert: function (d, t) { var f = d.figurer.filter(function (x) { return !t.placeret[x.navn]; })[0]; return f ? [{ navn: f.navn, sted: f.op ? 'ned' : 'op' }] : null; }
    },
    puslespil: {
      /** valg: { dag, kol, raek }, hvor brikken slippes. Den klikker kun paa sin egen plads. */
      svar: function (d, t, v) {
        var br = P && P.brik(v.dag);
        if (!br || d.loese.indexOf(v.dag) < 0 || t.lagt.indexOf(v.dag) >= 0 || br.kol !== v.kol || br.raek !== v.raek) return { rigtig: false };
        t.lagt.push(v.dag);
        return { rigtig: true, faerdig: t.lagt.length === d.loese.length };
      },
      loesning: function (d, t) { var dag = d.loese.filter(function (x) { return t.lagt.indexOf(x) < 0; })[0]; var br = P.brik(dag); return { dag: dag, kol: br.kol, raek: br.raek }; },
      forkert: function (d, t) { var dag = d.loese.filter(function (x) { return t.lagt.indexOf(x) < 0; })[0]; var br = P.brik(dag); return [{ dag: dag, kol: (br.kol + 2) % 6, raek: br.raek }]; }
    }
  };
  function runde(del) {
    var R = REGLER[del.type];
    var t = { fase: 0, talt: [], fundet: [], antal: 0, udfyldt: 0, haengt: 0, aktiv: 0, placeret: {}, lagt: [], forkerte: 0, faerdig: false };
    return {
      t: t,
      svar: function (v) { var s = R.svar(del, t, v); if (s.faerdig) t.faerdig = true; return s; },
      loesning: function () { return R.loesning(del, t); },
      forkert: function () { return R.forkert(del, t); }
    };
  }

  /* ---------- det, der siges ---------- */

  /** Alle replikker, én del kan sige (uden ordklippene og talordene). */
  function replikker(del) {
    var ud = [del.spoerg, del.slut, del.igen, del.rigtigTekst, del.svar, del.endnu, del.op, del.ned, TEKST.proevIgen];
    if (del.foer) ud.push(del.foer);
    (del.saetninger || []).forEach(function (s) { ud.push(s); });
    if (del.mangler) ud.push(del.mangler.spoerg, del.mangler.rigtigTekst);
    if (del.flere) ud.push(del.flere.spoerg, del.flere.rigtigTekst);
    if (del.type === 'regn' && del.saetninger) ud.push(del.saetninger.concat([del.spoerg]).join(' '));
    // Kortlegenes spoergsmaal er raekker af saetninger og ordklip
    [del.spoerg, del.igen].forEach(function (s) { if (Array.isArray(s)) s.forEach(function (x) { if (typeof x === 'string') ud.push(x); }); });
    return ud.filter(function (t) { return typeof t === 'string' && t; });
  }
  /** En dags replikker: alle dele og fejringen. */
  function dagensReplikker(f) {
    var ud = [f.fejring];
    f.dele.forEach(function (x) { ud = ud.concat(replikker(x)); });
    return ud;
  }

  /** En replik delt i saetninger, praecis som js/stemme.js deler den. */
  function saetningerAf(t) { return (String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }

  /** Alt, opgaverne kan sige, som hele saetninger, saa det kan indtales. */
  function saetninger(Kalender) {
    var ud = [];
    function laeg(t) { saetningerAf(t).forEach(function (s) { if (ud.indexOf(s) < 0) ud.push(s); }); }
    Object.keys(TEKST).forEach(function (k) { laeg(TEKST[k]); });
    for (var n = 1; n <= 24; n++) laeg(tal(n));
    (Kalender ? Kalender.DAGE : []).forEach(function (d) { dagensReplikker(forbered(d)).forEach(laeg); });
    return ud;
  }

  /** De ord, hvis klip og billeder laanes fra Bogstavvejen og Rimhulen. */
  function ordene(Kalender) {
    var ud = [];
    function laeg(o) { if (o && ud.indexOf(o) < 0) ud.push(o); }
    (Kalender ? Kalender.DAGE : []).forEach(function (d) {
      forbered(d).dele.forEach(function (x) {
        if (x.type === 'kort') { x.kort.forEach(function (k) { laeg(k.ord); }); if (x.hoved) laeg(x.hoved.ord); }
        if (x.type === 'klap') laeg(x.ord);
      });
    });
    return ud;
  }

  rod.Opgaver = {
    TALORD: TALORD, TEKST: TEKST, TING: TING, FIGURER: FIGURER, VENNER: VENNER, FLYVER: FLYVER, PYNT: PYNT, KUGLER: KUGLER,
    LOESE: LOESE, NIS: NIS,
    tal: tal, talord: talord, derVar: derVar, flereEnd: flereEnd, jaDetEr: jaDetEr, ord: ord, tingBillede: tingBillede, tingFindes: tingFindes,
    moenster: moenster, taelPladser: taelPladser, bunke: bunke, guirlande: guirlande, glyfNavn: glyfNavn, forbered: forbered, forberedLaage: forberedLaage,
    runde: runde, replikker: replikker, dagensReplikker: dagensReplikker, saetningerAf: saetningerAf, saetninger: saetninger, ordene: ordene
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
