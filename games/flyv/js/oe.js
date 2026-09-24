/**
 * Himmelvejen: oeen, som Sanne flyver over.
 *
 * Landskabet (hoejde og farve), stederne, floden og broen, det store
 * noeddetrae, pynten og dyrene paa de steder, brevene skal hen til, og
 * brevene selv. Rene tal og funktioner uden browser, saa testen kan
 * laese det hele i node.
 */
(function (rod) {
  'use strict';

  /* ---------- regnestykker ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function klem(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function jaevn(a, b, x) { var t = klem((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function vinkelForskel(a, b) { var d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; }

  function tilfaeldig(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function stoej(x, z) {
    var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }

  /* ---------- farver fra appens malede palet ---------- */
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function blend(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  var P = {
    groen: hex('#93bc63'), lysgroen: hex('#a9c97a'), skraent: hex('#7fa955'), dyb: hex('#5f8240'),
    skovbund: hex('#6f9a4c'), sand: hex('#e5d3ae'), sand2: hex('#d9ba8a'), sten: hex('#b8b2a4'),
    bane1: hex('#9cc769'), bane2: hex('#88b35a'), hvid: hex('#f3efe6'), vand: hex('#5f9fc9'),
    tag: hex('#d95f45'), mur: hex('#e5d3ae'), guld: hex('#f0c46a'), blaa: hex('#5f9fc9'),
    himmelTop: hex('#8fc7e8'), horisont: hex('#dcebf2')
  };

  /* ---------- oeen og stederne ---------- */
  var OE_R = 225;
  var RUNDT = ['susebanen', 'boldbanen', 'boblehavet', 'bogstavvejen', 'rimhulen', 'vrimleskoven', 'tegnestuen', 'stjerneuret', 'skovkoekkenet'];
  var FLAD = { noeddeskoven: 16, susebanen: 44, boldbanen: 38, boblehavet: 20, bogstavvejen: 34, rimhulen: 22, vrimleskoven: 34, tegnestuen: 16, stjerneuret: 14, skovkoekkenet: 24 };
  var STED = { noeddeskoven: { id: 'noeddeskoven', x: 0, z: 0, ud: [0, 1] } };
  RUNDT.forEach(function (id, i) {
    var v = i * 40 * Math.PI / 180, r = id === 'boblehavet' ? 196 : 146;
    STED[id] = { id: id, x: Math.sin(v) * r, z: Math.cos(v) * r, ud: [Math.sin(v), Math.cos(v)] };
  });
  var ALLE = ['noeddeskoven'].concat(RUNDT).map(function (id) { var s = STED[id]; s.flad = FLAD[id]; return s; });

  /* Floden loeber fra midten af oeen ud i havet mellem Rimhulen og Vrimleskoven. Broen gaar over den. */
  var FLOD = { x: 0, z0: -240, z1: -92 };
  function flodAfstand(x, z) {
    var dz = z < FLOD.z0 ? FLOD.z0 - z : (z > FLOD.z1 ? z - FLOD.z1 : 0);
    return Math.sqrt((x - FLOD.x) * (x - FLOD.x) + dz * dz);
  }
  var TRAE = { x: 0, z: -4, h: 32 };   // det store noeddetrae, man flyver rundt om

  function raa(x, z) {
    var d = Math.sqrt(x * x + z * z) / OE_R;
    var bakker = 7 * Math.sin(x * 0.019 + 0.6) * Math.cos(z * 0.016 - 0.4) + 4.5 * Math.sin(x * 0.043 + z * 0.021 + 1.3) + 5 * (stoej(x * 0.03, z * 0.03) - 0.5);
    var maske = jaevn(1.05, 0.78, d);
    return (9 + bakker) * maske - 7 * (1 - maske);
  }
  ALLE.forEach(function (s) { s.h = s.id === 'boblehavet' ? 1.8 : klem(raa(s.x, s.z), 5, 11); });
  /* Stederne i brevene vender mod den vej, Sanne kommer fra, saa "mellem" og "inde i" ses forfra.
     a er retningen ind mod stedet, p er hoejre, som Sanne ser det. */
  var START = { x: -14, z: 34 };
  function retning(fra, til) { var dx = til.x - fra.x, dz = til.z - fra.z, l = Math.sqrt(dx * dx + dz * dz); return [dx / l, dz / l]; }
  function vend(s, a) { s.a = a; s.p = [-a[1], a[0]]; }
  ALLE.forEach(function (s) { vend(s, [0, -1]); });
  vend(STED.vrimleskoven, retning(START, STED.vrimleskoven));
  vend(STED.rimhulen, retning(STED.vrimleskoven, STED.rimhulen));
  vend(STED.bogstavvejen, retning(STED.rimhulen, STED.bogstavvejen));
  /* dx til hoejre, dz mod Sanne (minus er laengere vaek) */
  function lokalt(s, dx, dz) { return [s.x + s.p[0] * dx - s.a[0] * dz, s.z + s.p[1] * dx - s.a[1] * dz]; }
  function lokaleKoord(s, x, z) { var u = x - s.x, v = z - s.z; return [u * s.p[0] + v * s.p[1], -(u * s.a[0] + v * s.a[1])]; }
  var BAKKE = (function () { var b = lokalt(STED.rimhulen, 0, -20); return { x: b[0], z: b[1] }; })();

  function hoejde(x, z) {
    var h = raa(x, z);
    for (var i = 0; i < ALLE.length; i++) {
      var s = ALLE[i], dx = x - s.x, dz = z - s.z, d = Math.sqrt(dx * dx + dz * dz);
      if (d < s.flad + 16) h = mix(h, s.h, jaevn(s.flad + 16, s.flad, d));
    }
    var bx = x - BAKKE.x, bz = z - BAKKE.z;
    h += 24 * Math.exp(-(bx * bx + bz * bz) / 512);
    var fd = flodAfstand(x, z);
    if (fd < 19) h = mix(h, Math.min(h, -2.6), jaevn(19, 7.5, fd));
    return h;
  }
  var BRO = { z: STED.rimhulen.z, x0: -22, x1: 22 };
  BRO.y = Math.max(hoejde(-23, BRO.z), hoejde(23, BRO.z), 8) + 2.5;

  function stedFarve(x, z, c) {
    var s = STED.susebanen, u = x - s.x, v = z - s.z;
    var e = Math.sqrt(u * u / 1156 + v * v / 484);
    if (Math.abs(e - 1) * 27 < 4.2) c = P.sand;
    s = STED.boldbanen; u = x - s.x; v = z - s.z;
    if (Math.abs(u) < 27 && Math.abs(v) < 17) c = Math.floor((u + 27) / 6) % 2 ? P.bane1 : P.bane2;
    var l = lokaleKoord(STED.bogstavvejen, x, z);
    if (Math.abs(l[1]) < 3.8 && Math.abs(l[0]) < 44) c = P.sand;
    l = lokaleKoord(STED.vrimleskoven, x, z); u = l[0]; v = l[1];
    if (Math.abs(u) < 36 && Math.abs(v) < 16) c = (((Math.floor(u / 4) + Math.floor(v / 4)) % 2) + 2) % 2 ? P.sand : blend(P.sand, P.sand2, 0.45);
    s = STED.skovkoekkenet; u = x - s.x; v = z - s.z;
    if (u * u + v * v < 150) c = P.sand;
    s = STED.tegnestuen; u = x - s.x; v = z - s.z;
    if (u * u + v * v < 70) c = P.sand2;
    s = STED.stjerneuret; u = x - s.x; v = z - s.z;
    if (u * u + v * v < 60) c = P.sten;
    if (x * x + z * z < 130) c = P.lysgroen;
    return c;
  }
  function jordFarve(x, z, h, haeld) {
    var n1 = stoej(x * 0.045 + 11, z * 0.045 - 5), n2 = stoej(x * 0.13, z * 0.13);
    var c = blend(P.groen, P.lysgroen, klem(n1 * 1.3 - 0.25, 0, 1));
    c = blend(c, P.skraent, klem((haeld - 0.1) * 4, 0, 1) * 0.8);
    if (h > 19) c = blend(c, P.sten, klem((h - 19) / 9, 0, 0.75));
    c = blend(c, P.dyb, klem(0.32 - n2, 0, 0.32));
    var dn = Math.sqrt(x * x + z * z);
    if (dn > 14 && dn < 74) c = blend(c, P.skovbund, jaevn(14, 24, dn) * jaevn(74, 56, dn) * 0.5);
    c = blend(c, P.sand, jaevn(3.6, 1.4, h));
    if (h < 0.3) c = blend(P.sand, P.sand2, 0.5);
    return stedFarve(x, z, c);
  }

  /* Marchhoejden: et godt stykke over det hoejeste i naerheden */
  function krydsHoejde(x, z) {
    var h = Math.max(hoejde(x, z), 0);
    for (var a = 0; a < 6; a++) { var v = a * Math.PI / 3; h = Math.max(h, hoejde(x + Math.cos(v) * 12, z + Math.sin(v) * 12)); }
    return h + 23;
  }
  function staaY(x, z) { return hoejde(x, z) - 0.4; }

  /* ---------- stederne i brevene: pynten og de tre dyr paa hvert sted ----------
     Alt her er rene tal, saa testen kan tjekke det uden browser. tx er billedets navn i spillet,
     h er hoejden, y er fodens hoejde. Dyrene faar ord (det, de svarer paa) og hvor (det, de siger). */
  function lavSteder() {
    var pynt = [], dyr = { noeddeskoven: [], vrimleskoven: [], rimhulen: [], bogstavvejen: [] };
    function ting(tx, q, h, ekstra) {
      var t = { tx: tx, x: q[0], z: q[1], h: h, y: staaY(q[0], q[1]) };
      for (var k in ekstra) t[k] = ekstra[k];
      pynt.push(t); return t;
    }
    function modtager(sted, tx, q, h, ord, hvor, ekstra) {
      var m = { tx: tx, x: q[0], z: q[1], h: h, y: staaY(q[0], q[1]), ord: ord, hvor: hvor, foran: 2 };
      for (var k in ekstra) m[k] = ekstra[k];
      dyr[sted].push(m); return m;
    }
    var s;
    function her(dx, dz) { return lokalt(s, dx, dz); }

    /* Noeddeskoven: det store trae og Pelle */
    ting('trae', [TRAE.x, TRAE.z], TRAE.h);
    modtager('noeddeskoven', 'pindsvin', [0, 10], 10, 'rundtom', 'rundt om træet');

    /* Vrimleskoven: tre huse, en bod og en broend. Kaninerne: oven paa taget, mellem husene, ved broenden */
    s = STED.vrimleskoven;
    ting('hus1', her(-30, -9), 18, { venstre: 'mellem' });
    ting('hus3', her(-3, -9), 18, { hoejre: 'mellem' });
    var hus2 = ting('hus2', her(20, -2), 20);
    modtager('vrimleskoven', 'kanin', her(20, -2), 6, 'ovenpaa', 'oven på taget', { y: hus2.y + 20 * 0.84, foran: 3 });
    ting('bod', her(-22, 10), 12);
    ting('broend', her(8, 9), 8);
    modtager('vrimleskoven', 'kanin', her(-16.9, -9), 6.5, 'mellem', 'mellem de to huse', { foran: 1 });
    modtager('vrimleskoven', 'kanin', her(14.6, 9), 6.5, 'vedsiden', 'ved siden af brønden');

    /* Rimhulen: hulen ligger ind i bakken. Bjoernene: inde i hulen, oven paa hulen og ved siden af hulen */
    s = STED.rimhulen;
    var mund = her(0, -8);
    var hule = ting('hule', mund, 15, { fast: [s.p[0], 0, s.p[1]] });
    modtager('rimhulen', 'bjoern', mund, 7, 'indei', 'inde i hulen', { y: hule.y + 0.3, foran: 3 });
    modtager('rimhulen', 'bjoern', mund, 6.5, 'ovenpaa', 'oven på hulen', { y: hule.y + 15 * 0.86, foran: 3 });
    modtager('rimhulen', 'bjoern', her(15, -8), 8, 'vedsiden', 'ved siden af hulen');

    /* Bogstavvejen: tre skilte og et trae. Uglerne: mellem to skilte, oven paa et skilt, under traeet */
    s = STED.bogstavvejen;
    ting('skiltN', her(-22, -7), 12, { venstre: 'mellem' });
    ting('skiltP', her(-4, -7), 12, { hoejre: 'mellem' });
    var skiltS = ting('skiltS', her(14, -7), 12);
    modtager('bogstavvejen', 'ugle', her(14, -7), 5.5, 'ovenpaa', 'oven på skiltet', { y: skiltS.y + 12 * 0.89, foran: 3 });
    ting('trae', her(30, 8), 16);
    modtager('bogstavvejen', 'ugle', her(30, 8.5), 5.5, 'under', 'under træet', { foran: 3 });
    modtager('bogstavvejen', 'ugle', her(-13, -7), 6.5, 'mellem', 'mellem de to skilte', { foran: 1 });
    return { pynt: pynt, dyr: dyr };
  }

  /* ---------- brevene: hvem de skal til, og hvor modtageren sidder ---------- */
  var BUD = [
    { sted: 'vrimleskoven', vaert: 'kanin', ord: 'ovenpaa',
      start: 'Sanne! Vil du flyve med et brev? Det skal til kaninen i Vrimleskoven. Kaninen sidder oven på taget.',
      spoerg: 'Her er Vrimleskoven. Hvor er kaninen, der sidder oven på taget? Tryk på den.',
      mangler: 'Brevet skal til kaninen oven på taget.',
      tak: 'Tak, Sanne! Ja, det er mig, der sidder oven på taget.' },
    { sted: 'rimhulen', vaert: 'bjoern', ord: 'indei',
      start: 'Her er et brev mere. Det skal til bjørnen i Rimhulen, på den anden side af broen. Bjørnen sidder inde i hulen.',
      spoerg: 'Her er Rimhulen. Hvor er bjørnen, der sidder inde i hulen? Tryk på den.',
      mangler: 'Brevet skal til bjørnen inde i hulen.',
      tak: 'Tak, Sanne! Ja, det er mig, der sidder inde i hulen.' },
    { sted: 'bogstavvejen', vaert: 'ugle', ord: 'mellem',
      start: 'Nu skal brevet til uglen på Bogstavvejen. Uglen sidder mellem de to skilte.',
      spoerg: 'Her er Bogstavvejen. Hvor er uglen, der sidder mellem de to skilte? Tryk på den.',
      mangler: 'Brevet skal til uglen mellem de to skilte.',
      tak: 'Tak, Sanne! Ja, det er mig, der sidder mellem de to skilte.' },
    { sted: 'noeddeskoven', vaert: 'pindsvin', ord: 'rundtom',
      start: 'Det sidste brev er til Pelle i Nøddeskoven. Flyv hjem, og flyv rundt om det store træ.',
      spoerg: 'Flyv hele vejen rundt om det store træ. Du kan også trykke på træet.',
      mangler: '',
      tak: 'Du fløj rundt om træet! Tak, Sanne. Nu er alle brevene fløjet ud.' }
  ];
  var BRO_SPOERG = 'Se, en bro! Kan du flyve under broen?', BRO_ROS = 'Du fløj under broen!';
  var ORDENE = ['ovenpaa', 'indei', 'mellem', 'under', 'rundtom'];
  var STEDNAVN = { noeddeskoven: 'Nøddeskoven', vrimleskoven: 'Vrimleskoven', rimhulen: 'Rimhulen', bogstavvejen: 'Bogstavvejen' };

  /* Alle saetninger, stemmen kan sige, hver som ét klip. Et forkert dyrs svar er to af dem:
     "Nej, jeg sidder mellem de to huse." og brevets "Brevet skal til ...". Bruges af
     vaerktoej/lav-lyd-gemini.py og testen; js/stemme.js saetter klippene sammen. */
  function saetninger() {
    var ud = [];
    function laeg(t) { if (t && ud.indexOf(t) < 0) ud.push(t); }
    BUD.forEach(function (b) { laeg(b.start); laeg(b.spoerg); laeg(b.mangler); laeg(b.tak); });
    laeg(BRO_SPOERG); laeg(BRO_ROS);
    var dyr = lavSteder().dyr;
    Object.keys(dyr).forEach(function (st) { dyr[st].forEach(function (m) { if (m.hvor) laeg('Nej, jeg sidder ' + m.hvor + '.'); }); });
    return ud;
  }

  var Oe = {
    sub: sub, dot: dot, cross: cross, norm: norm, mix: mix, klem: klem, jaevn: jaevn, vinkelForskel: vinkelForskel,
    tilfaeldig: tilfaeldig, stoej: stoej, hex: hex, blend: blend, P: P,
    OE_R: OE_R, RUNDT: RUNDT, STED: STED, ALLE: ALLE, FLOD: FLOD, TRAE: TRAE, BRO: BRO, BAKKE: BAKKE, START: START,
    flodAfstand: flodAfstand, hoejde: hoejde, jordFarve: jordFarve, krydsHoejde: krydsHoejde, lokalt: lokalt, lokaleKoord: lokaleKoord,
    lavSteder: lavSteder, saetninger: saetninger, BUD: BUD, BRO_SPOERG: BRO_SPOERG, BRO_ROS: BRO_ROS, ORDENE: ORDENE, STEDNAVN: STEDNAVN
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Oe: Oe };
  else rod.FlyvOe = Oe;
})(this);
