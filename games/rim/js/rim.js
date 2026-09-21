/**
 * Rimhulen: rim og stavelser. Det, barnet hoerer og traener, foer det laerer at
 * laese. Denne fil er reglerne uden skaerm, saa de kan testes i Node.
 *
 * Ordene er Bogstavvejens ting (billeder og stemme genbruges derfra, saa
 * intet skal males eller indtales to gange) plus nogle faa ekstra ord, som
 * rimer paa dem: stol, mur, maal, bog, pil, vand, mund, sky, ski (Noto Emoji i
 * ting/), bjoern og kanin (Noeddeskovens malede) og salat (Skovkoekkenets).
 *
 * RIM er grupperne af ord, der rimer. STAVELSER er antal stavelser i hvert ord.
 * Begge er skrevet i haanden, fordi dansk ikke kan rimes eller deles i kode.
 */
(function (rod) {
  'use strict';

  var Ting = rod.Ting || (typeof require === 'function' ? require('../../bogstaver/js/ting.js').Ting : null);

  /** Filnavn uden mappe og endelse: det, klippet hedder (ord_<navn>.mp3). */
  function ordFil(t) {
    return t.fil ? t.fil.replace(/^.*\//, '').replace(/\.(svg|png)$/, '') : ({ 'xylofon': 'xylofon', 'ål': 'aal' })[t.ord];
  }

  // Alle ord: Bogstavvejens ting foerst (ét pr. ord), saa de ekstra.
  var ORD = {};
  var ALLE = [];
  function laeg(o) { if (ORD[o.ord]) return; ORD[o.ord] = o; ALLE.push(o); }

  Object.keys(Ting.TING).forEach(function (n) {
    if (n !== n.toUpperCase()) return;            // de smaa bogstaver deler ting med de store
    Ting.TING[n].forEach(function (t) {
      var navn = ordFil(t);
      laeg({ ord: t.ord, navn: navn, fil: t.fil ? '../bogstaver/' + t.fil : null, tegn: t.tegn || null,
             klip: '../bogstaver/lyd/ord_' + navn + '.mp3' });
    });
  });

  var EKSTRA = [
    ['stol', 'stol', 'ting/stol.svg'], ['mur', 'mur', 'ting/mur.svg'], ['mål', 'maal', 'ting/maal.svg'],
    ['bog', 'bog', 'ting/bog.svg'], ['pil', 'pil', 'ting/pil.svg'], ['vand', 'vand', 'ting/vand.svg'],
    ['mund', 'mund', 'ting/mund.svg'], ['sky', 'sky', 'ting/sky.svg'], ['ski', 'ski', 'ting/ski.svg'],
    ['bjørn', 'bjoern', 'billeder/bjoern.png'], ['kanin', 'kanin', 'billeder/kanin.png'], ['salat', 'salat', 'billeder/salat.png']
  ];
  EKSTRA.forEach(function (e) { laeg({ ord: e[0], navn: e[1], fil: e[2], tegn: null, klip: 'lyd/ord_' + e[1] + '.mp3' }); });

  /** Grupper af ord, der rimer. Et ord staar kun i én gruppe. */
  var RIM = [
    ['kat', 'hat'], ['hus', 'mus'], ['ko', 'sko'], ['is', 'gris'], ['ø', 'frø'], ['ørn', 'bjørn'],
    ['salat', 'tomat'], ['sol', 'stol'], ['ur', 'mur'], ['ål', 'mål'], ['tog', 'bog'], ['bil', 'pil'],
    ['and', 'vand'], ['hund', 'mund'], ['fly', 'sky', 'paraply'], ['bi', 'ski'],
    ['pingvin', 'delfin', 'kanin'], ['vulkan', 'banan'], ['vandmelon', 'citron']
  ];
  var GRUPPE = {};
  RIM.forEach(function (g, i) { g.forEach(function (o) { GRUPPE[o] = i; }); });

  /** Antal stavelser. Dansk deles ikke i kode, saa tallene staar her. */
  var STAVELSER = {
    and: 1, bold: 1, cykel: 2, drage: 2, elefant: 3, fisk: 1, gris: 1, hus: 1, is: 1, 'jordbær': 2, kat: 1, 'løve': 2,
    'måne': 2, 'nøgle': 2, ost: 1, paraply: 3, regnbue: 3, sol: 1, 'træ': 1, ur: 1, vante: 2, xylofon: 3, yoyo: 2,
    'æble': 2, 'øje': 2, 'ål': 1, abe: 2, ananas: 3, bil: 1, banan: 2, bi: 1, citron: 2, cirkus: 2, delfin: 2, 'dør': 1,
    edderkop: 3, egern: 2, 'frø': 1, fugl: 1, fly: 1, giraf: 2, gave: 2, gulerod: 3, hest: 1, hat: 1, hund: 1, ild: 1,
    jakke: 2, 'juletræ': 3, ko: 1, kage: 2, krone: 2, lastbil: 2, lampe: 2, mus: 1, 'mælk': 1, 'næse': 2, 'nød': 1,
    orm: 1, pandekage: 4, pingvin: 2, pizza: 2, raket: 2, robot: 2, 'ræv': 1, slange: 2, sko: 1, sommerfugl: 3, tog: 1,
    tiger: 2, tomat: 2, ugle: 2, vandmelon: 3, vulkan: 2, 'æg': 1, 'æsel': 2, 'ø': 1, 'ørn': 1,
    stol: 1, mur: 1, 'mål': 1, bog: 1, pil: 1, vand: 1, mund: 1, sky: 1, ski: 1, 'bjørn': 1, kanin: 2, salat: 2
  };

  /** Faelles klip (ud over ordene), med den tekst enhedens stemme siger, hvis klippet mangler. */
  var KLIP = {
    hvad_rimer: ['lyd/hvad_rimer.mp3', 'Hvad rimer på'],
    klap_ordet: ['lyd/klap_ordet.mp3', 'Klap ordet'],
    det_rimer: ['lyd/det_rimer.mp3', 'Ja! Det rimer!'],
    flot_klappet: ['lyd/flot_klappet.mp3', 'Flot klappet!']
  };

  var KORT = [2, 3, 4];            // kort pr. spoergsmaal ved 1, 2 og 3 stjerner
  var STAV_MAKS = [2, 3, 9];       // stavelser hoejst ved 1, 2 og 3 stjerner
  var OMGANG = 8;                  // spoergsmaal pr. omgang; taelleren er cirkler

  function bland(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /**
   * En omgang rim: OMGANG spoergsmaal fra hver sin gruppe. Hvert spoergsmaal
   * er et ord, og kortene er ét ord fra samme gruppe og resten fra andre
   * grupper. Ved tre stjerner ligner de forkerte kort mere: samme antal
   * stavelser som det rigtige, naar det kan lade sig goere.
   */
  function nyRimOmgang(svaerhed) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    var antalKort = KORT[svaerhed];
    var grupper = bland(RIM).slice(0, OMGANG);
    return grupper.map(function (g) {
      var medlemmer = bland(g);
      var ord = medlemmer[0], rigtig = medlemmer[1];
      var andre = ALLE.filter(function (o) { return GRUPPE[o.ord] !== GRUPPE[ord]; }).map(function (o) { return o.ord; });
      if (svaerhed === 2) {
        var ens = andre.filter(function (o) { return STAVELSER[o] === STAVELSER[rigtig]; });
        if (ens.length >= antalKort - 1) andre = ens;
      }
      var kort = bland([rigtig].concat(bland(andre).slice(0, antalKort - 1)));
      return { ord: ord, kort: kort.map(function (o) { return { ord: o, rigtig: o === rigtig }; }) };
    });
  }

  /** Svar paa et rimspoergsmaal. */
  function svar(opgave, ord) {
    var k = opgave.kort.filter(function (x) { return x.ord === ord; })[0];
    return k && k.rigtig ? 'rigtig' : 'forkert';
  }

  /** En omgang klap: OMGANG ord, ingen gengangere, hoejst STAV_MAKS stavelser. */
  function nyKlapOmgang(svaerhed) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    var maks = STAV_MAKS[svaerhed];
    var ord = ALLE.filter(function (o) { return STAVELSER[o.ord] <= maks; }).map(function (o) { return o.ord; });
    return bland(ord).slice(0, OMGANG).map(function (o) { return { ord: o, n: STAVELSER[o] }; });
  }

  /**
   * Et klap paa trommen. taeller er { antal }. Rammer man antallet, er ordet
   * klappet; det afgoer skaermen, naar der har vaeret ro et oejeblik. Klapper
   * man én gang for meget, starter man forfra — uden straf, prikkerne vipper bare.
   */
  function klap(opgave, taeller) {
    taeller.antal++;
    if (taeller.antal > opgave.n) { taeller.antal = 0; return 'for_mange'; }
    return taeller.antal === opgave.n ? 'fuld' : 'klap';
  }

  rod.Rim = {
    ORD: ORD, ALLE: ALLE, RIM: RIM, GRUPPE: GRUPPE, STAVELSER: STAVELSER, KLIP: KLIP,
    KORT: KORT, STAV_MAKS: STAV_MAKS, OMGANG: OMGANG,
    nyRimOmgang: nyRimOmgang, svar: svar, nyKlapOmgang: nyKlapOmgang, klap: klap, ordFil: ordFil
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
