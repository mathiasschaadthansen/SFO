/**
 * Vrimleskoven: find tingene i billedet. Reglerne uden skaerm, saa de kan
 * testes i Node.
 *
 * Tingene er Bogstavvejens ting (billeder og ordklip laanes derfra) plus
 * kaninen og bjoernen fra Rimhulen. Hver omgang spredes et nyt udvalg af ting
 * paa et sted (engen, skoven), nogle halvt bag en busk, saa ingen to omgange er
 * ens. Stemmen siger "Her har du ordet kat. Kan du finde den?", og ved tre
 * stjerner ogsaa "Find alle de roede" og "Find alle, der kan flyve".
 *
 * Feltet, tingene ligger i, er 1000 x 600 enheder: hele skaermens bredde og
 * den del af hoejden, der ligger under horisonten. Skaermen skalerer det.
 */
(function (rod) {
  'use strict';

  var Ting = rod.Ting || (typeof require === 'function' ? require('../../bogstaver/js/ting.js').Ting : null);

  function ordFil(t) {
    return t.fil ? t.fil.replace(/^.*\//, '').replace(/\.(svg|png)$/, '') : null;
  }

  var ORD = {}, ALLE = [];
  function laeg(o) { if (ORD[o.ord]) return; ORD[o.ord] = o; ALLE.push(o); }
  Object.keys(Ting.TING).forEach(function (n) {
    if (n !== n.toUpperCase()) return;
    Ting.TING[n].forEach(function (t) {
      if (!t.fil) return;                       // xylofon og aal har kun en tegning i kode: for svaere at finde
      var navn = ordFil(t);
      laeg({ ord: t.ord, navn: navn, fil: '../bogstaver/' + t.fil, klip: '../bogstaver/lyd/ord_' + navn + '.mp3' });
    });
  });
  laeg({ ord: 'kanin', navn: 'kanin', fil: '../rim/billeder/kanin.png', klip: '../rim/lyd/ord_kanin.mp3' });
  laeg({ ord: 'bjørn', navn: 'bjoern', fil: '../rim/billeder/bjoern.png', klip: '../rim/lyd/ord_bjoern.mp3' });

  var ORDET = 'Her har du ordet ';
  var KLIP = {
    kan_du_finde: ['lyd/kan_du_finde.mp3', 'Kan du finde den?'],
    du_fandt_den: ['lyd/du_fandt_den.mp3', 'Du fandt den!'],
    alle_sammen: ['lyd/alle_sammen.mp3', 'Der var de alle sammen!']
  };

  /**
   * Kategorierne til tre stjerner. Farverne er dem, tingene faktisk er malet
   * i (maalt paa billederne), ikke dem, man tror. Et ord kan staa i flere.
   */
  var KATEGORIER = {
    roede:   { klip: 'lyd/find_roede.mp3',   tekst: 'Find alle de røde.',        ikon: 'farve', farve: '#d95f45', ord: ['drage', 'paraply', 'æble', 'jordbær', 'tomat', 'bil', 'bold'] },
    gule:    { klip: 'lyd/find_gule.mp3',    tekst: 'Find alle de gule.',        ikon: 'farve', farve: '#f0c46a', ord: ['måne', 'banan', 'ost', 'and', 'citron', 'krone'] },
    groenne: { klip: 'lyd/find_groenne.mp3', tekst: 'Find alle de grønne.',      ikon: 'farve', farve: '#93bc63', ord: ['juletræ', 'frø', 'tog', 'slange', 'træ'] },
    flyve:   { klip: 'lyd/find_flyve.mp3',   tekst: 'Find alle, der kan flyve.', ikon: 'vinge', ord: ['fugl', 'bi', 'fly', 'ørn', 'sommerfugl', 'drage', 'raket', 'ugle', 'and'] },
    dyr:     { klip: 'lyd/find_dyr.mp3',     tekst: 'Find alle dyrene.',         ikon: 'pote',  ord: ['and', 'fisk', 'gris', 'kat', 'løve', 'abe', 'bi', 'delfin', 'edderkop', 'egern', 'frø', 'fugl', 'giraf', 'hest', 'hund', 'ko', 'mus', 'orm', 'pingvin', 'ræv', 'slange', 'tiger', 'ugle', 'ørn', 'æsel', 'elefant', 'kanin', 'bjørn', 'sommerfugl'] },
    spise:   { klip: 'lyd/find_spise.mp3',   tekst: 'Find alt det, man kan spise.', ikon: 'gaffel', ord: ['æble', 'ananas', 'banan', 'citron', 'gulerod', 'is', 'jordbær', 'kage', 'mælk', 'nød', 'ost', 'pandekage', 'pizza', 'tomat', 'vandmelon', 'æg'] },
    koere:   { klip: 'lyd/find_koere.mp3',   tekst: 'Find alt det, man kan køre i.', ikon: 'hjul', ord: ['bil', 'lastbil', 'cykel', 'tog', 'fly', 'raket'] }
  };

  /**
   * Stederne: hvor tingene maa ligge (zoner i feltet) og skjulene (kaldet
   * buske i data, tegnet som traeer af skaermen), de kan gemme sig bag. Resten
   * af stedet (soe, hus, skovbryn) tegnes af skaermen.
   */
  var STEDER = {
    eng: {
      zoner: [{ x: 20, y: 60, b: 960, h: 170 }, { x: 20, y: 230, b: 560, h: 350 }, { x: 600, y: 230, b: 380, h: 110 }, { x: 600, y: 490, b: 380, h: 90 }],
      buske: [{ x: 120, y: 330, r: 62 }, { x: 340, y: 200, r: 54 }, { x: 500, y: 520, r: 70 }, { x: 300, y: 560, r: 58 }, { x: 640, y: 300, r: 50 }, { x: 950, y: 360, r: 60 }]
    },
    skov: {
      zoner: [{ x: 20, y: 40, b: 960, h: 540 }],
      buske: [{ x: 90, y: 200, r: 56 }, { x: 260, y: 420, r: 64 }, { x: 420, y: 150, r: 52 }, { x: 560, y: 520, r: 70 }, { x: 700, y: 260, r: 58 }, { x: 860, y: 460, r: 62 }, { x: 930, y: 130, r: 50 }, { x: 180, y: 560, r: 54 }]
    }
  };
  var STEDNAVNE = Object.keys(STEDER);

  var STR = [64, 54, 44];          // tingenes stoerrelse i feltet ved 1, 2 og 3 stjerner
  var ANTAL = [18, 26, 34];        // ting paa skaermen
  var OMGANG = 6;                  // spoergsmaal pr. spiller
  var KATEGORI_VED = [1, 4];       // ved tre stjerner er spoergsmaal nr. 2 og 5 en kategori

  function bland(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function iZone(z, x, y) { return x >= z.x && x <= z.x + z.b && y >= z.y && y <= z.y + z.h; }

  /**
   * Laeg tingene i stedet som i en vrimlebog: i loese raekker fra bagerst til
   * forrest, smaa bagest og stoerre forrest (DYBDE), aldrig oven i hinanden.
   * Ca. hver tredje ligger halvt bag et af stedets skjul (traeerne), men aldrig
   * helt gemt. Raekkerne goer billedet roligt at se paa; jitteren goer, at det
   * ikke ligner et gitter.
   */
  var DYBDE = [0.78, 1.18];        // stoerrelse bagest og forrest i forhold til str
  function skala(y) { return DYBDE[0] + (DYBDE[1] - DYBDE[0]) * Math.max(0, Math.min(1, y / 600)); }

  function laegTing(sted, navne, str) {
    var st = STEDER[sted], ud = [];
    var raekker = Math.max(4, Math.round(navne.length / 5));
    var top = Math.min.apply(null, st.zoner.map(function (z) { return z.y; })), bund = Math.max.apply(null, st.zoner.map(function (z) { return z.y + z.h; }));
    function fri(x, y, s) {
      if (x < s / 2 + 1 || x > 999 - s / 2 || y < s / 2 + 1 || y > 599 - s / 2) return false;   // +1: koordinaterne rundes bagefter
      if (!st.zoner.some(function (z) { return iZone(z, x, y); })) return false;
      for (var i = 0; i < ud.length; i++) if (Math.hypot(ud[i].x - x, ud[i].y - y) < (ud[i].str + s) / 2 * 1.15) return false;
      // Skjulet daekker op til ca. 1,2 r; under 0,95 r er tingen helt vaek
      for (var j = 0; j < st.buske.length; j++) if (Math.hypot(st.buske[j].x - x, st.buske[j].y - y) < st.buske[j].r * 0.95) return false;
      return true;
    }
    navne.forEach(function (n, i) {
      var x, y, s, bag = false, skjul = -1, forsoeg = 0, ok = false;
      var raekke = i % raekker, rh = (bund - top) / raekker;
      while (!ok && forsoeg++ < 160) {
        if (i % 3 === 0 && st.buske.length && forsoeg < 60) {
          skjul = Math.floor(Math.random() * st.buske.length);
          var bu = st.buske[skjul], v = Math.random() * Math.PI * 2, d = bu.r * (1.0 + Math.random() * 0.25);
          x = bu.x + Math.cos(v) * d; y = bu.y + Math.sin(v) * d; bag = true;
        } else {
          y = top + (raekke + 0.15 + Math.random() * 0.7) * rh;
          x = 20 + Math.random() * 960; bag = false; skjul = -1;
        }
        s = str * skala(y);
        ok = fri(x, y, s);
      }
      if (ok) ud.push({ ord: n, x: Math.round(x), y: Math.round(y), str: Math.round(s), bag: bag, skjul: skjul });
    });
    return ud;
  }

  /**
   * En ny omgang: tingene paa stedet og spoergsmaalene til hver spiller.
   * Ved tre stjerner sikres, at to kategorier har 2-4 medlemmer i billedet.
   */
  function nyOmgang(sted, svaerhed, spillere) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    spillere = spillere === 2 ? 2 : 1;
    if (!STEDER[sted]) sted = STEDNAVNE[0];
    var antal = ANTAL[svaerhed], str = STR[svaerhed];
    var alle = ALLE.map(function (o) { return o.ord; });
    var valgte = [], kategorier = [];
    if (svaerhed === 2) {
      // Kategorierne overlapper (anden er baade gul, et dyr og kan flyve), saa
      // hver kategori saas kun med ord, der ikke ogsaa er i en anden valgt
      // kategori. Ellers kunne en kategori faa fem-seks i billedet.
      for (var forsoeg = 0; forsoeg < 30; forsoeg++) {
        kategorier = bland(Object.keys(KATEGORIER)).slice(0, 2 * spillere);
        var egne = kategorier.map(function (k) {
          return KATEGORIER[k].ord.filter(function (o) { return !kategorier.some(function (k2) { return k2 !== k && KATEGORIER[k2].ord.indexOf(o) >= 0; }); });
        });
        if (egne.every(function (e) { return e.length >= 2; })) {
          valgte = [];
          egne.forEach(function (e) { valgte = valgte.concat(bland(e).slice(0, 2 + Math.floor(Math.random() * 2))); });
          break;
        }
      }
    }
    // Resten fyldes op, men uden at nogen kategori faar mere end 4 i billedet
    var taelling = {};
    Object.keys(KATEGORIER).forEach(function (k) { taelling[k] = valgte.filter(function (o) { return KATEGORIER[k].ord.indexOf(o) >= 0; }).length; });
    bland(alle).forEach(function (o) {
      if (valgte.length >= antal || valgte.indexOf(o) >= 0) return;
      var forMange = kategorier.some(function (k) { return KATEGORIER[k].ord.indexOf(o) >= 0 && taelling[k] >= 4; });
      if (forMange) return;
      valgte.push(o);
      Object.keys(KATEGORIER).forEach(function (k) { if (KATEGORIER[k].ord.indexOf(o) >= 0) taelling[k]++; });
    });
    var ting = laegTing(sted, bland(valgte), str);
    var iBilledet = ting.map(function (t) { return t.ord; });
    // Spoergsmaal: enkeltord, som ikke er en kategoris medlem i samme omgang, fordelt paa spillerne
    var kandidater = bland(iBilledet.filter(function (o) { return !kategorier.some(function (k) { return KATEGORIER[k].ord.indexOf(o) >= 0; }); }));
    var sp = [];
    for (var s = 0; s < spillere; s++) {
      var liste = [], mineKat = kategorier.slice(s * 2, s * 2 + 2);
      for (var i = 0; i < OMGANG; i++) {
        var kIdx = KATEGORI_VED.indexOf(i);
        if (svaerhed === 2 && kIdx >= 0 && mineKat[kIdx]) {
          var k = mineKat[kIdx];
          liste.push({ type: 'kategori', kategori: k, ord: iBilledet.filter(function (o) { return KATEGORIER[k].ord.indexOf(o) >= 0; }), fundet: [] });
        } else {
          liste.push({ type: 'ord', ord: kandidater.length ? kandidater.pop() : iBilledet[(s * OMGANG + i) % iBilledet.length] });
        }
      }
      sp.push({ nr: s, spoergsmaal: liste, i: 0 });
    }
    return { sted: sted, svaerhed: svaerhed, ting: ting, spillere: sp };
  }

  /** Et tryk paa en ting. Svarer paa spillerens aktuelle spoergsmaal. */
  function tryk(omgang, spiller, ord) {
    var sp = omgang.spillere[spiller], q = sp.spoergsmaal[sp.i];
    if (!q) return 'faerdig';
    if (q.type === 'ord') return ord === q.ord ? 'rigtig' : 'forkert';
    if (q.ord.indexOf(ord) < 0) return 'forkert';
    if (q.fundet.indexOf(ord) >= 0) return 'allerede';
    q.fundet.push(ord);
    return q.fundet.length === q.ord.length ? 'alle' : 'rigtig';
  }

  /** Videre til naeste spoergsmaal. Sandt, hvis der er flere. */
  function naeste(omgang, spiller) {
    var sp = omgang.spillere[spiller];
    sp.i++;
    return sp.i < sp.spoergsmaal.length;
  }

  rod.Find = {
    ORD: ORD, ALLE: ALLE, KLIP: KLIP, ORDET: ORDET, KATEGORIER: KATEGORIER, STEDER: STEDER, STEDNAVNE: STEDNAVNE,
    STR: STR, ANTAL: ANTAL, OMGANG: OMGANG, KATEGORI_VED: KATEGORI_VED, DYBDE: DYBDE, skala: skala,
    nyOmgang: nyOmgang, tryk: tryk, naeste: naeste, laegTing: laegTing
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
