/**
 * Vrimleskoven: find tingene i billedet. Reglerne uden skaerm, saa de kan
 * testes i Node.
 *
 * Tingene er Bogstavvejens ting (billeder og ordklip laanes derfra) plus
 * kaninen og bjoernen fra Rimhulen. Hver omgang spredes et nyt udvalg af ting
 * paa et sted (engen, skoven, byen), saa ingen to omgange er ens. Stemmen
 * siger "Her har du ordet kat. Kan du finde den?", og ved tre stjerner ogsaa
 * "Find alle de roede" og "Find alle, der kan flyve".
 *
 * Som i en vrimlebog ligger tingene tre slags steder:
 *  - paa en PLADS: i et vindue, i en doer, paa baenken, i baaden, oppe i et
 *    trae, paa boden, bag hegnet. Pladserne er faste pr. sted, og hver omgang
 *    bruger et tilfaeldigt udvalg af dem.
 *  - halvt bag et SKJUL: et trae eller en gran, aldrig helt gemt.
 *  - frit i loese raekker, smaa bagest og stoerre forrest.
 * Ved tre stjerner ligger der desuden en LOOKALIKE taet ved hver ting, der
 * spoerges om: tigeren ved katten, lastbilen ved bilen.
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
   * Lookalikes: ting, der ligner hinanden, saa man skal se ordentligt efter
   * ved tre stjerner. Grupperne er adskilte; et ord staar kun i én.
   */
  var LIGNER = [
    ['kat', 'tiger', 'løve'], ['hund', 'ræv', 'bjørn'], ['mus', 'egern', 'kanin'], ['and', 'fugl', 'ugle', 'ørn', 'pingvin'],
    ['bil', 'lastbil'], ['æble', 'tomat', 'jordbær'], ['citron', 'banan'], ['ko', 'hest', 'æsel'], ['fisk', 'delfin'],
    ['slange', 'orm'], ['fly', 'raket'], ['is', 'kage'], ['måne', 'sol'], ['hat', 'krone'],
    ['træ', 'juletræ'], ['hus', 'dør', 'cirkus'], ['bold', 'yoyo'], ['pizza', 'pandekage', 'ost'], ['drage', 'sommerfugl'],
    ['ild', 'vulkan', 'ø'], ['nød', 'æg'], ['edderkop', 'bi'], ['regnbue', 'paraply'], ['abe', 'elefant', 'giraf'], ['næse', 'øje'], ['jakke', 'sko', 'vante']
  ];
  var LIGNER_AF = {};
  LIGNER.forEach(function (g) { g.forEach(function (o) { LIGNER_AF[o] = g; }); });
  var NAER = 120;                  // saa taet skal en lookalike ligge paa sin makker (enheder i feltet)

  /**
   * Husene i byen. x, y, b og h er i feltets enheder; vinduerne og doeren
   * bliver til pladser (husPladser), saa reglerne og skaermen er enige om,
   * hvor de er. Taget rager op over horisonten og tegnes i himlen.
   */
  function husPladser(hus) {
    var pl = [], vb = Math.min(56, hus.b / (hus.vind + 1) * 0.8), vh = vb * 4 / 3, vy = hus.y + hus.h * 0.16;
    for (var i = 0; i < hus.vind; i++) {
      var vx = hus.x + hus.b * (i + 1) / (hus.vind + 1) - vb / 2;
      pl.push({ x: Math.round(vx + vb / 2), y: Math.round(vy + vh / 2), s: Math.round(vb * 0.95), type: 'vindue', klip: { x: Math.round(vx), y: Math.round(vy), b: Math.round(vb), h: Math.round(vh) } });
    }
    var db = Math.min(46, hus.b * 0.3), dh = hus.h * 0.42, dx = hus.x + hus.b / 2 - db / 2, dy = hus.y + hus.h - dh;
    pl.push({ x: Math.round(hus.x + hus.b / 2), y: Math.round(dy + dh * 0.5), s: Math.round(db), type: 'doer', klip: { x: Math.round(dx), y: Math.round(dy), b: Math.round(db), h: Math.round(dh) } });
    return pl;
  }

  /* Paa skaermen er feltet trykket sammen paa hoejden: 600 enheder hoejt bliver 0,6 af skaermhoejden,
     1000 enheder bredt hele bredden. Paa en iPad (4:3) er en enhed lodret derfor 0,75 af en vandret.
     Afstande maales, som de ser ud dér, saa tingene ikke staar oven i hinanden. */
  var LODRET = 0.75;

  /**
   * Skjulene: hvad tingene kan gemme sig halvt bag. Traeer og graner tegnes
   * som malede billeder med foden i (x, y); hegn og broend tegnes i kode. daek() giver
   * den ellipse, billedet daekker, saa en ting kan laegges paa kanten af den.
   * Traeerne er maalt paa de malede billeder (games/maskinen/billeder/), der tegnes
   * 2,6 r brede i skaermens maal; hoejden regnes om til feltets med LODRET.
   */
  function daek(sk) {
    if (sk.type === 'gran') return { x: sk.x, y: sk.y - sk.r * 0.45 / LODRET, rx: sk.r * 1.05, ry: sk.r * 1.2 / LODRET };
    if (sk.type === 'hegn') return { x: sk.x + sk.b / 2, y: sk.y - sk.h * 0.35, rx: sk.b / 2, ry: sk.h * 0.5 };
    if (sk.type === 'broend') return { x: sk.x, y: sk.y - sk.r * 0.5, rx: sk.r, ry: sk.r * 0.6 };
    return { x: sk.x, y: sk.y - sk.r * 1.03 / LODRET, rx: sk.r * 1.25, ry: sk.r * 0.87 / LODRET };     // loevtrae: kronen
  }
  /**
   * Hvor langt (x, y) er fra skjulets midte, maalt saa 1 er kanten af det, skjulet daekker.
   * a og b er afstanden vandret og lodret i forhold til rx og ry. Kronerne er flade forneden,
   * saa under midten er formen en firkant med runde hjoerner, ikke en ellipse.
   */
  function form(sk, a, b) {
    if (b > 0 && (sk.type === 'trae' || sk.type === 'gran')) return Math.pow(a * a * a * a + b * b * b * b, 0.25);
    return Math.hypot(a, b);
  }
  function skjulAfstand(sk, x, y) {
    var d = daek(sk);
    return form(sk, Math.abs(x - d.x) / d.rx, (y - d.y) / d.ry);
  }
  /** Staar (x, y) bag stammen: under kronen, lige bag traeet? Saa kan man ikke se tingen. */
  function bagStamme(sk, x, y) {
    return (sk.type === 'trae' || sk.type === 'gran') && Math.abs(x - sk.x) < sk.r * 0.45 && y > daek(sk).y && y < skjulFod(sk);
  }


  /**
   * Stederne. zoner: hvor loese ting maa ligge. optaget: kasser, loese ting
   * skal holde sig fra (baenke, boder, soeen ...). skjul: traeer, graner og hegn.
   * pladser: faste steder at sidde; 'klip' klipper tingen til et vindue eller
   * en doer, 'bag' laegger den bag et skjul (hegn, broend), 'paa' oven paa et skjul (i et trae).
   * Alt andet paa stedet er maling og tegnes af skaermen.
   */
  var PINDSVIN = { x: 885, y: 445, b: 115, h: 155 };   // Pelle staar i hjoernet nederst til hoejre og maa ikke daekke noget
  var STEDER = {
    eng: {
      zoner: [{ x: 20, y: 60, b: 960, h: 170 }, { x: 20, y: 230, b: 560, h: 350 }, { x: 600, y: 230, b: 380, h: 110 }, { x: 600, y: 490, b: 380, h: 90 }],
      optaget: [{ x: 60, y: 100, b: 180, h: 70 }, { x: 320, y: 420, b: 120, h: 70 }, { x: 540, y: 10, b: 260, h: 70 }, PINDSVIN],
      skjul: [
        { type: 'trae', x: 120, y: 330, r: 62 }, { type: 'gran', x: 340, y: 200, r: 54 }, { type: 'trae', x: 500, y: 520, r: 70 },
        { type: 'gran', x: 300, y: 560, r: 58 }, { type: 'trae', x: 640, y: 300, r: 50 }, { type: 'trae', x: 950, y: 360, r: 60 },
        { type: 'hegn', x: 560, y: 66, b: 230, h: 40 }
      ],
      hoestakke: [{ x: 105, y: 150, r: 36 }, { x: 195, y: 135, r: 32 }],
      baenk: { x: 380, y: 470 }, baad: { x: 790, y: 408 }, soe: { x: 790, y: 415, rx: 160, ry: 58 },
      pladser: [
        { x: 90, y: 275, s: 36, type: 'gren', paa: 0 }, { x: 155, y: 255, s: 36, type: 'gren', paa: 0 },
        { x: 600, y: 42, s: 40, type: 'hegn', bag: 6 }, { x: 675, y: 42, s: 40, type: 'hegn', bag: 6 }, { x: 750, y: 42, s: 40, type: 'hegn', bag: 6 },
        { x: 105, y: 102, s: 40, type: 'hoestak' }, { x: 195, y: 92, s: 38, type: 'hoestak' },
        { x: 790, y: 388, s: 44, type: 'baad' }, { x: 380, y: 442, s: 42, type: 'baenk' }
      ]
    },
    skov: {
      zoner: [{ x: 20, y: 40, b: 960, h: 540 }],
      optaget: [{ x: 265, y: 220, b: 70, h: 55 }, { x: 685, y: 450, b: 70, h: 55 }, { x: 420, y: 300, b: 145, h: 55 }, PINDSVIN],
      skjul: [
        { type: 'trae', x: 90, y: 200, r: 56 }, { type: 'trae', x: 260, y: 420, r: 64 }, { type: 'gran', x: 420, y: 150, r: 52 },
        { type: 'gran', x: 560, y: 520, r: 70 }, { type: 'trae', x: 700, y: 260, r: 58 }, { type: 'gran', x: 860, y: 460, r: 62 },
        { type: 'trae', x: 930, y: 130, r: 50 }, { type: 'gran', x: 180, y: 560, r: 54 }
      ],
      stubbe: [{ x: 300, y: 250 }, { x: 720, y: 480 }],
      stamme: { x: 420, y: 310, b: 145, h: 42 },
      pladser: [
        { x: 228, y: 365, s: 36, type: 'gren', paa: 1 }, { x: 296, y: 350, s: 36, type: 'gren', paa: 1 },
        { x: 670, y: 210, s: 34, type: 'gren', paa: 4 }, { x: 732, y: 198, s: 34, type: 'gren', paa: 4 },
        { x: 300, y: 226, s: 40, type: 'stub' }, { x: 720, y: 456, s: 40, type: 'stub' },
        { x: 448, y: 331, s: 40, type: 'stamme', klip: { x: 427, y: 312, b: 42, h: 38 } }
      ]
    },
    by: {
      zoner: [{ x: 20, y: 240, b: 960, h: 150 }, { x: 20, y: 410, b: 960, h: 170 }],
      optaget: [{ x: 55, y: 210, b: 210, h: 125 }, { x: 560, y: 235, b: 80, h: 100 }, { x: 795, y: 295, b: 110, h: 55 }, { x: 375, y: 355, b: 95, h: 55 }, { x: 610, y: 495, b: 220, h: 55 }, { x: 875, y: 232, b: 115, h: 60 }, PINDSVIN],
      skjul: [{ type: 'trae', x: 330, y: 540, r: 56 }, { type: 'trae', x: 560, y: 455, r: 50 }, { type: 'hegn', x: 620, y: 545, b: 200, h: 40 }, { type: 'broend', x: 600, y: 332, r: 28 }],
      huse: [
        { x: 40, y: 40, b: 150, h: 165, farve: '#f0c46a', tag: '#d95f45', vind: 2, skorsten: true },
        { x: 230, y: 15, b: 190, h: 190, farve: '#f8f1e6', tag: '#5f9fc9', vind: 3, skorsten: false },
        { x: 470, y: 55, b: 140, h: 150, farve: '#e08a52', tag: '#8a663d', vind: 2, skorsten: true },
        { x: 650, y: 10, b: 200, h: 195, farve: '#aed3e4', tag: '#d95f45', vind: 3, skorsten: false },
        { x: 890, y: 60, b: 95, h: 145, farve: '#e5d3ae', tag: '#5f8240', vind: 1, skorsten: true }
      ],
      bod: { x: 160, y: 330, b: 200 }, baenk: { x: 850, y: 345 }, trillebør: { x: 420, y: 405 }, toerresnor: { x1: 885, y1: 268, x2: 980, y2: 272 },
      pladser: [
        { x: 105, y: 286, s: 40, type: 'bod' }, { x: 160, y: 286, s: 40, type: 'bod' }, { x: 215, y: 286, s: 40, type: 'bod' },
        { x: 600, y: 300, s: 40, type: 'broend', bag: 3 },
        { x: 850, y: 320, s: 42, type: 'baenk' }, { x: 415, y: 383, s: 40, type: 'trillebør' },
        { x: 655, y: 522, s: 40, type: 'hegn', bag: 2 }, { x: 720, y: 522, s: 40, type: 'hegn', bag: 2 }, { x: 785, y: 522, s: 40, type: 'hegn', bag: 2 }
      ]
    }
  };
  STEDER.by.huse.forEach(function (h) { STEDER.by.pladser = STEDER.by.pladser.concat(husPladser(h)); });
  var STEDNAVNE = Object.keys(STEDER);

  var STR = [64, 54, 44];          // tingenes stoerrelse i feltet ved 1, 2 og 3 stjerner
  var PLADS_FAKTOR = [1.15, 1, 0.85]; // pladsernes ting skaleres med stjernerne paa samme maade
  var ANTAL = [18, 26, 34];        // ting paa skaermen
  var OMGANG = 6;                  // spoergsmaal pr. spiller
  var KATEGORI_VED = [1, 4];       // ved tre stjerner er spoergsmaal nr. 2 og 5 en kategori

  function bland(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function iZone(z, x, y) { return x >= z.x && x <= z.x + z.b && y >= z.y && y <= z.y + z.h; }
  function iKasse(k, x, y, s) { return x > k.x - s / 2 && x < k.x + k.b + s / 2 && y > k.y - s / 2 && y < k.y + k.h + s / 2; }
  /** Tingens fodaftryk: en ting i et vindue fylder kun vinduet. */
  function fod(t) { return t.klip ? Math.min(t.str, t.klip.b) : t.str; }

  /**
   * Laeg tingene i stedet som i en vrimlebog. Foerst dem, der spoerges om
   * (saa de faar plads), lige efter hver af dem dens lookalike, og saa
   * resten. Omkring en tredjedel saettes paa stedets pladser, resten ligger i
   * loese raekker fra bagerst til forrest, smaa bagest og stoerre forrest
   * (DYBDE), og ca. hver tredje af dem halvt bag et trae, aldrig helt gemt.
   *
   * navne: [{ ord, makker }] i den raekkefoelge, de skal laegges. 'makker' er
   * ordet, tingen skal ligge taet ved (dens lookalike), hvis det er lagt.
   */
  var DYBDE = [0.78, 1.18];        // stoerrelse bagest og forrest i forhold til str
  function afstand(ax, ay, bx, by) { return Math.hypot(ax - bx, (ay - by) * LODRET); }
  /** Hvor lang en enhed i retningen v er paa skaermen: 1 vandret, LODRET lodret. */
  function retning(v) { return Math.hypot(Math.cos(v), Math.sin(v) * LODRET); }
  function skala(y) { return DYBDE[0] + (DYBDE[1] - DYBDE[0]) * Math.max(0, Math.min(1, y / 600)); }

  function laegTing(sted, navne, svaerhed) {
    var st = STEDER[sted], ud = [], str = STR[svaerhed];
    var loese = navne.filter(function (n) { return !n.makker; }).length;
    var raekker = Math.max(4, Math.round(loese / 5));
    var top = Math.min.apply(null, st.zoner.map(function (z) { return z.y; })), bund = Math.max.apply(null, st.zoner.map(function (z) { return z.y + z.h; }));
    var traeer = st.skjul.map(function (s, i) { return i; }).filter(function (i) { return st.skjul[i].type === 'trae' || st.skjul[i].type === 'gran'; });
    var ledige = bland(st.pladser.map(function (p, i) { return i; }));
    var nPlads = Math.min(ledige.length, Math.round(navne.length / 3));
    // Hvilke af de loese (ikke-makkere) skal paa en plads? nPlads tilfaeldige.
    var paaPlads = {};
    bland(navne.map(function (n, i) { return i; }).filter(function (i) { return !navne[i].makker; })).slice(0, nPlads).forEach(function (i) { paaPlads[i] = true; });

    function fri(x, y, s, klip, plads) {
      if (x < s / 2 + 1 || x > 999 - s / 2 || y < s / 2 + 1 || y > 599 - s / 2) return false;   // +1: koordinaterne rundes bagefter
      if (!plads) {
        if (!st.zoner.some(function (z) { return iZone(z, x, y); })) return false;
        if (st.optaget.some(function (k) { return iKasse(k, x, y, s); })) return false;
        // Skjulet daekker ud til 1,0; under 0,95 er tingen helt vaek
        for (var j = 0; j < st.skjul.length; j++) if (skjulAfstand(st.skjul[j], x, y) < 0.95 || bagStamme(st.skjul[j], Math.round(x), Math.round(y))) return false;
      }
      var f = klip ? Math.min(s, klip.b) : s;
      for (var i = 0; i < ud.length; i++) if (afstand(ud[i].x, ud[i].y, x, y) < (fod(ud[i]) + f) / 2 * 1.15) return false;
      return true;
    }
    function tagPlads(i) {
      var p = st.pladser[i], s = Math.round(p.s * PLADS_FAKTOR[svaerhed]);
      return { x: p.x, y: p.y, str: s, plads: i, klip: p.klip || null, bag: p.bag !== undefined, skjul: p.bag !== undefined ? p.bag : -1, paa: p.paa !== undefined ? p.paa : -1 };
    }
    function laegPaaPlads(i) {
      var t = tagPlads(i);
      ledige.splice(ledige.indexOf(i), 1);
      return fri(t.x, t.y, t.str, t.klip, true) ? t : null;
    }
    /** Er der plads til en makker i ringen om (x, y)? */
    function pladsTilMakker(x, y, s) {
      for (var f = 0; f < 30; f++) {
        var v = Math.random() * Math.PI * 2, d = (s + str * skala(y)) / 2 * (1.2 + Math.random() * 0.5) / retning(v);
        var mx = x + Math.cos(v) * d, my = y + Math.sin(v) * d;
        if (fri(mx, my, str * skala(my))) return true;
      }
      return false;
    }
    function laegFrit(i, raekke, rh, medMakker) {
      var x, y, s, bag = false, skjul = -1, forsoeg = 0;
      while (forsoeg++ < 260) {
        if (i % 3 === 0 && traeer.length && forsoeg < 60) {
          skjul = traeer[Math.floor(Math.random() * traeer.length)];
          // Bag kronens top og sider, ikke forneden, hvor stammen og den flade bund er
          var d = daek(st.skjul[skjul]), v = -Math.PI / 2 + (Math.random() - 0.5) * 1.2 * Math.PI, k = 0.95 + Math.random() * 0.12;
          x = d.x + Math.cos(v) * d.rx * k; y = d.y + Math.sin(v) * d.ry * k; bag = true;
        } else {
          // Foerst i sin egen raekke; er der fyldt, hvor som helst fra bagerst til forrest
          y = forsoeg < 140 ? top + (raekke + 0.15 + Math.random() * 0.7) * rh : top + Math.random() * (bund - top);
          x = 20 + Math.random() * 960; bag = false; skjul = -1;
        }
        s = str * skala(y);
        if (fri(x, y, s) && (!medMakker || pladsTilMakker(x, y, s))) return { x: Math.round(x), y: Math.round(y), str: Math.round(s), plads: -1, klip: null, bag: bag, skjul: skjul, paa: -1 };
      }
      return null;
    }
    /** Makkeren: en ledig plads taet ved, ellers et frit sted i en ring om makkeren. */
    function laegVed(m) {
      var naere = bland(ledige.filter(function (i) { return Math.hypot(st.pladser[i].x - m.x, st.pladser[i].y - m.y) < NAER; }));
      for (var i = 0; i < naere.length; i++) { var t = laegPaaPlads(naere[i]); if (t) return t; }
      for (var forsoeg = 0; forsoeg < 200; forsoeg++) {
        var s0 = str * skala(m.y), v = Math.random() * Math.PI * 2, d = (fod(m) + s0) / 2 * (1.2 + Math.random() * 0.5) / retning(v);
        var x = m.x + Math.cos(v) * d, y = m.y + Math.sin(v) * d, s = str * skala(y);
        if (Math.hypot(x - m.x, y - m.y) < NAER && fri(x, y, s)) return { x: Math.round(x), y: Math.round(y), str: Math.round(s), plads: -1, klip: null, bag: false, skjul: -1, paa: -1 };
      }
      return null;
    }

    var lagt = {}, nr = 0, rh = (bund - top) / raekker, harMakker = {};
    navne.forEach(function (n) { if (n.makker) harMakker[n.makker] = true; });
    navne.forEach(function (n, i) {
      var t = null;
      if (n.makker && lagt[n.makker]) t = laegVed(lagt[n.makker]);
      if (!t && n.makker) {
        // Er der ikke plads ved makkeren, duer en anden fra gruppen, der allerede ligger der
        (LIGNER_AF[n.ord] || []).forEach(function (o) { if (!t && o !== n.ord && lagt[o]) t = laegVed(lagt[o]); });
      }
      if (!t && paaPlads[i]) {
        // Faar tingen en makker, skal pladsen have en ledig naboplads, makkeren kan faa
        var mulige = ledige.filter(function (a) { return !harMakker[n.ord] || ledige.some(function (b) { return b !== a && Math.hypot(st.pladser[a].x - st.pladser[b].x, st.pladser[a].y - st.pladser[b].y) < NAER; }); });
        while (!t && mulige.length) t = laegPaaPlads(mulige.shift());
      }
      if (!t) t = laegFrit(nr, nr % raekker, rh, harMakker[n.ord]);
      if (!t) return;
      t.ord = n.ord; t.makker = n.makker && lagt[n.makker] ? n.makker : null;
      if (t.plads < 0) nr++;
      ud.push(t); lagt[n.ord] = t;
    });
    return ud;
  }

  /**
   * En ny omgang: tingene paa stedet og spoergsmaalene til hver spiller.
   * Ved tre stjerner sikres, at to kategorier pr. spiller har 2-4 medlemmer
   * i billedet, og at hvert enkeltord har en lookalike taet paa sig.
   */
  /* ---------- lagene og trykket ----------
     Alt paa jorden tegnes bagfra og frem: det, der staar laengst nede, er naermest. En ting bag et skjul
     tegnes lige foer skjulet, en ting oppe i et trae lige efter. Trykket bruger den samme raekkefoelge. */
  function skjulFod(sk) { return sk.type === 'trae' || sk.type === 'gran' ? sk.y + sk.r * 0.75 : sk.y; }
  function lagOrden(omgang, sted) {
    var st = STEDER[sted], lag = [];
    st.skjul.forEach(function (sk) { lag.push({ y: skjulFod(sk), skjul: sk }); });
    omgang.ting.forEach(function (t) {
      var y = t.y + t.str / 2;
      if (t.bag) y = skjulFod(st.skjul[t.skjul]) - 0.5;
      else if (t.paa >= 0) y = skjulFod(st.skjul[t.paa]) + 0.5;
      lag.push({ y: y, ting: t });
    });
    return lag.sort(function (a, b) { return a.y - b.y; });
  }
  /** Kan man se tingen dér, hvor fingeren er? p er feltet paa skaermen: { fx, fy, fs, fh }. */
  function serTing(t, x, y, p) {
    var s = p.fs(t.str), cx = p.fx(t.x), cy = p.fy(t.y) + (t.klip ? s * 0.12 : 0);
    if (Math.hypot(x - cx, y - cy) > s * 0.46) return false;
    var k = t.klip;
    return !k || (x >= p.fx(k.x) && x <= p.fx(k.x + k.b) && y >= p.fy(k.y) && y <= p.fy(k.y) + p.fh(k.h));
  }
  function daekkerSkjul(sk, x, y, p) {
    var d = daek(sk);
    return form(sk, Math.abs(x - p.fx(d.x)) / p.fs(d.rx), (y - p.fy(d.y)) / p.fh(d.ry)) < 1;
  }
  /**
   * Hvad rammer et tryk? Det, man ser oeverst dér, hvor fingeren er. Staar et skjul foran, eller rammer
   * fingeren ved siden af, vaelges den ting, hvis midte er naermest, hvis den er taet nok. Den rigtige ting
   * foretraekkes aldrig; det er barnet, der skal finde den.
   */
  function rammer(omgang, sted, x, y, p) {
    var lag = lagOrden(omgang, sted);
    for (var i = lag.length - 1; i >= 0; i--) {
      if (lag[i].ting) { if (serTing(lag[i].ting, x, y, p)) return lag[i].ting; }
      else if (daekkerSkjul(lag[i].skjul, x, y, p)) break;
    }
    var bedst = null, bd = 0.62;
    omgang.ting.forEach(function (t) {
      var d = Math.hypot(x - p.fx(t.x), y - p.fy(t.y)) / p.fs(t.str);
      if (d < bd) { bd = d; bedst = t; }
    });
    return bedst;
  }

  function nyOmgang(sted, svaerhed, spillere) {
    svaerhed = Math.max(0, Math.min(2, svaerhed | 0));
    spillere = spillere === 2 ? 2 : 1;
    if (!STEDER[sted]) sted = STEDNAVNE[0];
    var antal = ANTAL[svaerhed];
    var alle = ALLE.map(function (o) { return o.ord; });
    var valgte = [], kategorier = [], liste = [];
    function iValgtKategori(o) { return kategorier.some(function (k) { return KATEGORIER[k].ord.indexOf(o) >= 0; }); }
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
    // Enkeltordene, der spoerges om: aldrig medlem af en valgt kategori. Ved
    // tre stjerner skal de have en lookalike, som heller ikke er det.
    var antalEnkelt = spillere * (svaerhed === 2 ? OMGANG - KATEGORI_VED.length : OMGANG);
    var enkelte = [], makkere = {};
    bland(alle).forEach(function (o) {
      if (enkelte.length >= antalEnkelt || valgte.indexOf(o) >= 0 || iValgtKategori(o)) return;
      if (svaerhed === 2) {
        var g = LIGNER_AF[o];
        if (!g) return;
        // Er der allerede to fra gruppen med (et spoergsmaal og dets makker), er gruppen brugt; er der én, bliver de to hinandens lookalike
        var iGruppen = g.filter(function (x) { return x !== o && valgte.indexOf(x) >= 0; });
        if (iGruppen.length >= 2) return;
        var m = iGruppen[0]
          || bland(g.filter(function (x) { return x !== o && valgte.indexOf(x) < 0 && !iValgtKategori(x); }))[0];
        if (!m) return;
        makkere[o] = m; if (valgte.indexOf(m) < 0) valgte.push(m);
      }
      enkelte.push(o); valgte.push(o);
    });
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
    // Raekkefoelgen, de laegges i: enkeltordene foerst, hver fulgt af sin makker, saa resten blandet
    enkelte.forEach(function (o) {
      var m = makkere[o];
      if (m && enkelte.indexOf(m) >= 0) {
        // Makkeren spoerges der ogsaa om: laeg denne lige efter den (og efter dens egen makker), saa den kan komme taet paa
        var efter = liste.map(function (l) { return l.ord; }).indexOf(m);
        while (liste[efter + 1] && liste[efter + 1].makker === m) efter++;
        liste.splice(efter + 1, 0, { ord: o, makker: m });
      } else { liste.push({ ord: o }); if (m) liste.push({ ord: m, makker: o }); }
    });
    bland(valgte.filter(function (o) { return !liste.some(function (l) { return l.ord === o; }); })).forEach(function (o) { liste.push({ ord: o }); });
    var ting = laegTing(sted, liste, svaerhed);
    var iBilledet = ting.map(function (t) { return t.ord; });
    // Spoergsmaal: enkeltordene, der kom med i billedet, fordelt paa spillerne. Loeb de op, tages andre uden for kategorierne.
    var reserve = bland(iBilledet.filter(function (o) { return enkelte.indexOf(o) < 0 && !iValgtKategori(o) && !liste.some(function (l) { return l.ord === o && l.makker; }); }));
    var kandidater = reserve.concat(enkelte.filter(function (o) { return iBilledet.indexOf(o) >= 0; }));
    var sp = [];
    for (var s = 0; s < spillere; s++) {
      var q = [], mineKat = kategorier.slice(s * 2, s * 2 + 2);
      for (var i = 0; i < OMGANG; i++) {
        var kIdx = KATEGORI_VED.indexOf(i);
        if (svaerhed === 2 && kIdx >= 0 && mineKat[kIdx]) {
          var k = mineKat[kIdx];
          q.push({ type: 'kategori', kategori: k, ord: iBilledet.filter(function (o) { return KATEGORIER[k].ord.indexOf(o) >= 0; }), fundet: [] });
        } else {
          q.push({ type: 'ord', ord: kandidater.length ? kandidater.pop() : iBilledet[(s * OMGANG + i) % iBilledet.length] });
        }
      }
      sp.push({ nr: s, spoergsmaal: q, i: 0 });
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
    ORD: ORD, ALLE: ALLE, KLIP: KLIP, ORDET: ORDET, KATEGORIER: KATEGORIER, LIGNER: LIGNER, LIGNER_AF: LIGNER_AF, NAER: NAER,
    STEDER: STEDER, STEDNAVNE: STEDNAVNE, husPladser: husPladser, daek: daek, skjulAfstand: skjulAfstand, bagStamme: bagStamme, fod: fod,
    STR: STR, PLADS_FAKTOR: PLADS_FAKTOR, ANTAL: ANTAL, OMGANG: OMGANG, KATEGORI_VED: KATEGORI_VED, DYBDE: DYBDE, skala: skala,
    nyOmgang: nyOmgang, tryk: tryk, naeste: naeste, laegTing: laegTing,
    LODRET: LODRET, afstand: afstand, skjulFod: skjulFod, lagOrden: lagOrden, serTing: serTing, daekkerSkjul: daekkerSkjul, rammer: rammer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
