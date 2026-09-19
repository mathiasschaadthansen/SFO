/**
 * Logik for Restauranten.
 *
 * En kunde kommer ind med en bestilling: en ret og nogle ingredienser. Barnet
 * laegger ingredienserne paa tallerkenen og ringer paa klokken. En forkert
 * ingrediens bliver bare ikke lagt paa — ingen straf, ingen sure kunder,
 * intet ur. Kunden venter, til maden er klar.
 *
 * Én ingrediens pr. bestilling mangler paa hylden og skal hentes paa gaarden:
 * barnet finder, hvor den kommer fra (koen, bien, tomatplanten, slagteren).
 * Naar kunden har spist, kommer regningen: hver ingrediens har en pris i
 * moenter, og barnet betaler med moenter, til det passer. En moent for meget
 * hopper bare tilbage.
 *
 * To boern har hver sin station og serverer sammen mod det samme maal.
 *
 * Ingen DOM, saa filen kan testes i Node. Se test/restaurant.test.js.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    forberedTrin: 3,          // tryk for at rulle dej, vende boef eller bage pandekager
    friMaks: 6,               // saa mange ting kan der ligge paa en ret i fri leg,
    kunderPrDag: [6, 8],     // hvor mange der skal serveres: [1 spiller, 2 spillere i alt]
    hyldeStr:    [4, 6, 6],  // hvor mange ingredienser der staar paa hylden pr. stjerne
    huskeTid:    [0, 0, 5]   // sekunder boblen vises paa 3 stjerner, foer man skal huske den. 0 = altid
  };

  // navn = som det siges, fil = tegning i assets/noto/
  var INGREDIENSER = {
    ost: { navn: 'ost' }, tomat: { navn: 'tomat' }, champignon: { navn: 'champignon' },
    peberfrugt: { navn: 'peberfrugt' }, ananas: { navn: 'ananas' }, oliven: { navn: 'oliven' },
    boef: { navn: 'bøf' }, salat: { navn: 'salat' }, agurk: { navn: 'agurk' }, bacon: { navn: 'bacon' },
    jordbaer: { navn: 'jordbær' }, banan: { navn: 'banan' }, blaabaer: { navn: 'blåbær' },
    chokolade: { navn: 'chokolade' }, honning: { navn: 'honning' }, smoer: { navn: 'smør' }
  };

  var RETTER = {
    pizza:      { navn: 'En pizza',    hylde: ['ost', 'tomat', 'champignon', 'peberfrugt', 'ananas', 'oliven'] },
    burger:     { navn: 'En burger',   hylde: ['boef', 'ost', 'salat', 'tomat', 'agurk', 'bacon'] },
    pandekager: { navn: 'Pandekager',  hylde: ['jordbaer', 'banan', 'blaabaer', 'chokolade', 'honning', 'smoer'] }
  };

  var KUNDER = ['hund', 'kat', 'bjoern', 'kanin', 'raev', 'panda', 'froe', 'gris', 'abe', 'loeve', 'tiger', 'koala'];

  /**
   * Priser i moenter. Prisen traekkes tilfaeldigt pr. kunde, saa regnestykket
   * varierer: paa 1 stjerne koster alt 1, saa regningen er at taelle. Paa 2 og
   * 3 stjerner koster en ting 1 eller 2. Regningen viser tingen lige saa mange
   * gange, som den koster, med en moent under hver, saa barnet kan taelle sig
   * til prisen. Derfor hoejst 2: fire ting til 2 er allerede otte billeder.
   * Den samme ting koster det samme inden for én bestilling (dobbelt ost = to
   * gange prisen). Summen er hoejst 8 og kan altid betales med pungens moenter.
   */
  var PRIS_MAKS = [1, 2, 2];
  // Moenterne i pungen pr. stjerne. Der er altid nok af hver, saa man kan aldrig koere fast.
  var MOENTER = [[1], [1, 2], [1, 2, 5]];

  /**
   * Gaarden: hvor hver ingrediens kommer fra. kilde er det, man trykker paa.
   * Koen giver maelk, som bliver til ost og smoer. Bien giver honning. Koed
   * kommer fra slagteren (en butik med et gris-skilt), ikke fra et dyr paa
   * gaarden. Resten vokser paa planter, buske og traeer.
   * form bestemmer tegningen: ko, bi, slagter, plante, busk, trae, palme, ranke, bed, stok, kakao.
   */
  var KILDER = {
    ko:        { form: 'ko',      giver: ['ost', 'smoer'],  navn: 'koen' },
    bi:        { form: 'bi',      giver: ['honning'],       navn: 'bien' },
    slagter:   { form: 'slagter', giver: ['boef', 'bacon'], navn: 'slagteren' },
    tomat:     { form: 'plante',  giver: ['tomat'],         navn: 'tomatplanten' },
    champignon:{ form: 'stok',    giver: ['champignon'],    navn: 'skovbunden' },
    peberfrugt:{ form: 'plante',  giver: ['peberfrugt'],    navn: 'peberplanten' },
    ananas:    { form: 'ananas',  giver: ['ananas'],        navn: 'ananasplanten' },
    oliven:    { form: 'trae',    giver: ['oliven'],        navn: 'oliventraeet' },
    salat:     { form: 'bed',     giver: ['salat'],         navn: 'koekkenhaven' },
    agurk:     { form: 'ranke',   giver: ['agurk'],         navn: 'agurkeranken' },
    jordbaer:  { form: 'bed',     giver: ['jordbaer'],      navn: 'jordbaerbedet' },
    banan:     { form: 'palme',   giver: ['banan'],         navn: 'bananpalmen' },
    blaabaer:  { form: 'busk',    giver: ['blaabaer'],      navn: 'blaabaerbusken' },
    chokolade: { form: 'kakao',   giver: ['chokolade'],     navn: 'kakaotraeet' }
  };
  function kildeFor(ting) {
    var ud = null;
    Object.keys(KILDER).forEach(function (k) { if (KILDER[k].giver.indexOf(ting) >= 0) ud = k; });
    return ud;
  }
  /** Kilderne for en ret, i hyldens raekkefoelge, uden gengangere. */
  function gaardKilder(ret) {
    var ud = [];
    RETTER[ret].hylde.forEach(function (t) { var k = kildeFor(t); if (k && ud.indexOf(k) < 0) ud.push(k); });
    return ud;
  }

  /**
   * Faste bestillinger, saa hver har ét id og kan faa sit eget lydklip.
   * 1 stjerne: to ingredienser. 2 stjerner: tre. 3 stjerner: fire, hvoraf én er dobbelt,
   * saa man ogsaa skal taelle.
   */
  var BESTILLINGER = [
    { id: 'p1a', ret: 'pizza', stjerner: 1, ting: ['ost', 'tomat'] },
    { id: 'p1b', ret: 'pizza', stjerner: 1, ting: ['ost', 'champignon'] },
    { id: 'p1c', ret: 'pizza', stjerner: 1, ting: ['tomat', 'peberfrugt'] },
    { id: 'p1d', ret: 'pizza', stjerner: 1, ting: ['ost', 'ananas'] },
    { id: 'b1a', ret: 'burger', stjerner: 1, ting: ['boef', 'ost'] },
    { id: 'b1b', ret: 'burger', stjerner: 1, ting: ['boef', 'salat'] },
    { id: 'b1c', ret: 'burger', stjerner: 1, ting: ['boef', 'tomat'] },
    { id: 'b1d', ret: 'burger', stjerner: 1, ting: ['boef', 'bacon'] },
    { id: 'k1a', ret: 'pandekager', stjerner: 1, ting: ['jordbaer', 'banan'] },
    { id: 'k1b', ret: 'pandekager', stjerner: 1, ting: ['banan', 'chokolade'] },
    { id: 'k1c', ret: 'pandekager', stjerner: 1, ting: ['jordbaer', 'honning'] },
    { id: 'k1d', ret: 'pandekager', stjerner: 1, ting: ['blaabaer', 'smoer'] },

    { id: 'p2a', ret: 'pizza', stjerner: 2, ting: ['ost', 'tomat', 'champignon'] },
    { id: 'p2b', ret: 'pizza', stjerner: 2, ting: ['ost', 'peberfrugt', 'oliven'] },
    { id: 'p2c', ret: 'pizza', stjerner: 2, ting: ['ost', 'ananas', 'tomat'] },
    { id: 'p2d', ret: 'pizza', stjerner: 2, ting: ['tomat', 'champignon', 'oliven'] },
    { id: 'b2a', ret: 'burger', stjerner: 2, ting: ['boef', 'ost', 'salat'] },
    { id: 'b2b', ret: 'burger', stjerner: 2, ting: ['boef', 'tomat', 'agurk'] },
    { id: 'b2c', ret: 'burger', stjerner: 2, ting: ['boef', 'ost', 'bacon'] },
    { id: 'b2d', ret: 'burger', stjerner: 2, ting: ['boef', 'salat', 'tomat'] },
    { id: 'k2a', ret: 'pandekager', stjerner: 2, ting: ['jordbaer', 'banan', 'chokolade'] },
    { id: 'k2b', ret: 'pandekager', stjerner: 2, ting: ['blaabaer', 'honning', 'smoer'] },
    { id: 'k2c', ret: 'pandekager', stjerner: 2, ting: ['jordbaer', 'blaabaer', 'honning'] },
    { id: 'k2d', ret: 'pandekager', stjerner: 2, ting: ['banan', 'chokolade', 'smoer'] },

    { id: 'p3a', ret: 'pizza', stjerner: 3, ting: ['ost', 'ost', 'tomat', 'champignon'] },
    { id: 'p3b', ret: 'pizza', stjerner: 3, ting: ['ost', 'peberfrugt', 'peberfrugt', 'oliven'] },
    { id: 'p3c', ret: 'pizza', stjerner: 3, ting: ['ost', 'ananas', 'ananas', 'tomat'] },
    { id: 'p3d', ret: 'pizza', stjerner: 3, ting: ['tomat', 'tomat', 'champignon', 'oliven'] },
    { id: 'b3a', ret: 'burger', stjerner: 3, ting: ['boef', 'boef', 'ost', 'salat'] },
    { id: 'b3b', ret: 'burger', stjerner: 3, ting: ['boef', 'ost', 'ost', 'bacon'] },
    { id: 'b3c', ret: 'burger', stjerner: 3, ting: ['boef', 'tomat', 'tomat', 'agurk'] },
    { id: 'b3d', ret: 'burger', stjerner: 3, ting: ['boef', 'bacon', 'bacon', 'salat'] },
    { id: 'k3a', ret: 'pandekager', stjerner: 3, ting: ['jordbaer', 'jordbaer', 'banan', 'chokolade'] },
    { id: 'k3b', ret: 'pandekager', stjerner: 3, ting: ['blaabaer', 'blaabaer', 'honning', 'smoer'] },
    { id: 'k3c', ret: 'pandekager', stjerner: 3, ting: ['banan', 'banan', 'chokolade', 'smoer'] },
    { id: 'k3d', ret: 'pandekager', stjerner: 3, ting: ['jordbaer', 'blaabaer', 'honning', 'honning'] }
  ];

  /** Bestillingen som en dansk saetning: "En pizza med dobbelt ost, tomat og champignon, tak!" */
  function saetning(b) {
    var antal = {}, orden = [];
    b.ting.forEach(function (t) { if (!antal[t]) { antal[t] = 0; orden.push(t); } antal[t]++; });
    var led = orden.map(function (t) { return (antal[t] > 1 ? 'dobbelt ' : '') + INGREDIENSER[t].navn; });
    var med = led.length > 1 ? led.slice(0, -1).join(', ') + ' og ' + led[led.length - 1] : led[0];
    return RETTER[b.ret].navn + ' med ' + med + ', tak!';
  }

  function bland(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function nyKunde(dag, station) {
    var s = dag.stationer[station];
    s.forberedt = 0;
    if (dag.fri) {
      // Fri leg: kunden vil overraskes. Retterne skifter, og alt paa hylden maa bruges.
      var retter = Object.keys(RETTER);
      s.friNr = (s.friNr === undefined ? station : s.friNr + 1);
      var ret = retter[s.friNr % retter.length];
      var opt = dag.stationer.map(function (x) { return x.kunde; });
      s.bestilling = { id: 'fri', ret: ret, ting: [], fri: true, stjerner: 0 };
      s.kunde = bland(KUNDER.filter(function (k) { return opt.indexOf(k) < 0 && k !== s.sidsteKunde; }))[0];
      s.sidsteKunde = s.kunde;
      s.lagt = [];
      s.hylde = RETTER[ret].hylde.slice();
      return;
    }
    var mulige = BESTILLINGER.filter(function (b) { return b.stjerner === dag.niveau + 1 && b.id !== s.sidsteId; });
    // To stationer skal helst ikke have samme bestilling paa samme tid
    var andre = dag.stationer.filter(function (x, i) { return i !== station && x.bestilling; }).map(function (x) { return x.bestilling.id; });
    var frie = mulige.filter(function (b) { return andre.indexOf(b.id) < 0; });
    var b = bland(frie.length ? frie : mulige)[0];
    var optaget = dag.stationer.map(function (x) { return x.kunde; });
    var kunder = KUNDER.filter(function (k) { return optaget.indexOf(k) < 0 && k !== s.sidsteKunde; });
    s.bestilling = b;
    s.sidsteId = b.id;
    s.kunde = bland(kunder)[0];
    s.sidsteKunde = s.kunde;
    s.lagt = [];
    s.regning = null;
    // Hylden: altid alt hvad bestillingen kraever, fyldt op med andre fra rettens hylde
    var brug = b.ting.filter(function (t, i) { return b.ting.indexOf(t) === i; });
    var resten = bland(RETTER[b.ret].hylde.filter(function (t) { return brug.indexOf(t) < 0; }));
    s.hylde = bland(brug.concat(resten).slice(0, Math.max(brug.length, INDSTIL.hyldeStr[dag.niveau])));
    // Én ting mangler paa hylden og skal hentes paa gaarden foerst
    s.hent = bland(brug.filter(function (t) { return kildeFor(t) && t !== s.sidsteHent; }))[0] || bland(brug)[0];
    s.sidsteHent = s.hent;
    s.hentet = false;
  }

  /**
   * Gaarden: barnet trykker paa en kilde. 'ok' hvis den giver det, der mangler,
   * 'forkert' ellers. Ingen straf: man maa proeve igen.
   */
  function hent(dag, station, kilde) {
    var s = dag.stationer[station];
    if (dag.faerdig || !s.bestilling || !s.hent || s.hentet) return 'forkert';
    if (kildeFor(s.hent) !== kilde) return 'forkert';
    s.hentet = true;
    return 'ok';
  }

  function nyDag(antalSpillere, niveau, fri) {
    niveau = Math.max(0, Math.min(2, niveau | 0));
    var dag = {
      niveau: niveau,
      fri: !!fri,
      maal: INDSTIL.kunderPrDag[antalSpillere === 2 ? 1 : 0],
      serveret: 0,
      faerdig: false,
      stationer: []
    };
    for (var i = 0; i < antalSpillere; i++) dag.stationer.push({ kunde: null, bestilling: null, lagt: [], hylde: [], sidsteId: null, sidsteKunde: null, hent: null, hentet: false, sidsteHent: null, regning: null });
    for (var k = 0; k < antalSpillere; k++) nyKunde(dag, k);
    return dag;
  }

  function antalAf(liste, ting) { return liste.filter(function (t) { return t === ting; }).length; }

  /** Hvad mangler stadig paa tallerkenen? */
  function mangler(dag, station) {
    var s = dag.stationer[station];
    var ud = [], lagt = s.lagt.slice();
    s.bestilling.ting.forEach(function (t) {
      var i = lagt.indexOf(t);
      if (i >= 0) lagt.splice(i, 1); else ud.push(t);
    });
    return ud;
  }

  /**
   * Foer ingredienserne skal retten laves: dejen rulles ud, boeffen vendes, pandekagerne bages.
   * Et tryk er et trin. Returnerer true, hvis trykket talte.
   */
  function forbered(dag, station) {
    var s = dag.stationer[station];
    if (dag.faerdig || !s.bestilling || s.forberedt >= INDSTIL.forberedTrin) return false;
    s.forberedt++;
    return true;
  }

  function forberedtFaerdig(dag, station) { return dag.stationer[station].forberedt >= INDSTIL.forberedTrin; }

  /** Laeg en ingrediens paa. 'ok' hvis den hoerer til og der mangler en, ellers 'forkert'. */
  function laeg(dag, station, ting) {
    var s = dag.stationer[station];
    if (dag.faerdig || !s.bestilling) return 'forkert';
    if (s.forberedt < INDSTIL.forberedTrin) return 'vent';
    if (s.bestilling.fri) {
      if (s.lagt.length >= INDSTIL.friMaks || s.hylde.indexOf(ting) < 0) return 'forkert';
      s.lagt.push(ting);
      return 'ok';
    }
    if (ting === s.hent && !s.hentet) return 'hent';       // den mangler paa hylden: ud paa gaarden
    if (antalAf(s.lagt, ting) >= antalAf(s.bestilling.ting, ting)) return 'forkert';
    s.lagt.push(ting);
    return 'ok';
  }

  function klar(dag, station) {
    var s = dag.stationer[station];
    if (!s.bestilling || s.forberedt < INDSTIL.forberedTrin) return false;
    return s.bestilling.fri ? s.lagt.length > 0 : mangler(dag, station).length === 0;
  }

  /** En tilfaeldig pris paa dette niveau: 1 paa 1 stjerne, 1 eller 2 paa 2 og 3 stjerner. */
  function pris(niveau) { return 1 + Math.floor(Math.random() * PRIS_MAKS[Math.max(0, Math.min(2, niveau))]); }

  /** Regningen for en bestilling: én post pr. ting (dobbelt = to poster med samme pris) og summen. */
  function regningFor(b, niveau) {
    var priser = {};
    var poster = b.ting.map(function (t) {
      if (!priser[t]) priser[t] = pris(niveau);
      return { ting: t, pris: priser[t] };
    });
    return { poster: poster, sum: poster.reduce(function (a, p) { return a + p.pris; }, 0), betalt: 0, moenter: MOENTER[niveau].slice() };
  }

  /** Naar kunden er faerdig med at spise eller betale, kommer den naeste, eller dagen er slut. */
  function videre(dag, station) {
    if (dag.serveret >= dag.maal) {
      dag.faerdig = true;
      dag.stationer.forEach(function (s) { s.bestilling = null; s.regning = null; });
    } else {
      nyKunde(dag, station);
    }
  }

  /**
   * Ring paa klokken. Returnerer true hvis retten blev serveret. Bagefter skal
   * regningen betales (i fri leg er der ingen regning).
   */
  function server(dag, station) {
    if (dag.faerdig || !klar(dag, station)) return false;
    var s = dag.stationer[station];
    dag.serveret++;
    if (s.bestilling.fri) videre(dag, station);
    else s.regning = regningFor(s.bestilling, dag.niveau);
    return true;
  }

  /**
   * Laeg en moent i kassen. 'ok' hvis den passer, 'klar' hvis regningen nu er betalt,
   * 'forkert' hvis den er for stor (den hopper tilbage, ingen straf).
   */
  function betal(dag, station, moent) {
    var s = dag.stationer[station], r = s.regning;
    if (!r || r.moenter.indexOf(moent) < 0) return 'forkert';
    if (r.betalt + moent > r.sum) return 'forkert';
    r.betalt += moent;
    if (r.betalt < r.sum) return 'ok';
    s.regning = null;
    videre(dag, station);
    return 'klar';
  }

  rod.Koekken = {
    INDSTIL: INDSTIL, INGREDIENSER: INGREDIENSER, RETTER: RETTER, KUNDER: KUNDER, BESTILLINGER: BESTILLINGER,
    PRIS_MAKS: PRIS_MAKS, MOENTER: MOENTER, KILDER: KILDER, kildeFor: kildeFor, gaardKilder: gaardKilder, pris: pris,
    saetning: saetning, nyDag: nyDag, forbered: forbered, forberedtFaerdig: forberedtFaerdig, laeg: laeg, klar: klar,
    server: server, mangler: mangler, hent: hent, betal: betal
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
