/**
 * Bæverdammen: logikken, uden skaerm. Kan koeres i node (testen og
 * vaerktoej/lav-baever-baner.js) og i browseren.
 *
 * Pladsen er 6 x 6 felter set oppefra. Stammerne er 2 eller 3 felter lange og
 * ligger enten paa tvaers eller paa langs; en stamme kan kun glide den vej,
 * den ligger. Bodils lyse stamme ligger paa tvaers i raekke 3 (UD_RAEKKE) og
 * skal ud gennem aabningen i hoejre side, hvor Bodil bygger sin daemning.
 *
 * En bane skrives som 36 tegn, raekke for raekke: '.' er tomt, 'A' er Bodils
 * stamme og de andre bogstaver er de andre stammer. Om en stamme ligger paa
 * tvaers eller paa langs, ses af, hvilke felter bogstavet staar paa.
 *
 * Et traek er at skubbe én stamme et vilkaarligt stykke. loes() finder det
 * mindste antal traek med en bredde-foerst-soegning; pladsen er saa lille, at
 * det tager et oejeblik. Den samme loeser giver hjaelpen i spillet.
 */
(function (rod) {
  'use strict';

  var N = 6, UD_RAEKKE = 2;
  var RUNDE = 5;                  // stammer til daemningen, foer den er faerdig

  /* Banerne er fundet af vaerktoej/lav-baever-baner.js og sorteret efter, hvor mange traek de kraever.
     Én stjerne: 2-4 traek, to stjerner: 5-8, tre stjerner: 9-14. */
  var BANER = [
    [
      { bane: '.....B.D...B.DAA.E.D.C.E...C.....C..', traek: 2 },
      { bane: '.F..BB.F.....AAD.....D..CCCEE.......', traek: 2 },
      { bane: '........BB..AAD.....D.....D.......CC', traek: 2 },
      { bane: '..EC....EC..AA...B...DDB............', traek: 2 },
      { bane: '....BBFFCCCD..AA.D.....D...EEE......', traek: 3 },
      { bane: '..CF....CF..AA.F...EE..B.....B...DDB', traek: 3 },
      { bane: '........EE.D.AA.CD....C..B.....B....', traek: 3 },
      { bane: '.......DDD..AA.C.....C...EEE......BB', traek: 3 },
      { bane: '..D.....DEE.AAD...B.....BFF...B.CC..', traek: 4 },
      { bane: '........E..DAAE.BD.C..B..C..........', traek: 4 },
      { bane: '.......BBE..AAFE....F....CCD.....D..', traek: 4 },
      { bane: '..E.C...EBC..AABC....B..........DD..', traek: 4 }
    ],
    [
      { bane: '..CC..DD.E..BAAEFIBGGEFIB........HH.', traek: 5 },
      { bane: 'IIIFFH...G.H.AAGD....BD..CCB.....EE.', traek: 5 },
      { bane: '.....HDDD.GH..AAG.EE..G.B..FCCB..F..', traek: 5 },
      { bane: '...CCC.B.FFD.BAA.DIB...DI..HHHIGGEEE', traek: 6 },
      { bane: '..ED..FFED.IAAED.I.BHHG.CB..G.C.....', traek: 6 },
      { bane: '....EC..FFEC.BAAEC.BG.DD.BG.....HH..', traek: 6 },
      { bane: 'HGGBC.HEEBC.AAD.C...D.....III.FFF...', traek: 7 },
      { bane: '..G..D..G..DAA.C.F.E.C.F.EHHBB......', traek: 7 },
      { bane: '..E..B..EIIBAA.DCF.HHDCF...G.F...G..', traek: 7 },
      { bane: '.GG.D...FFD.AAB.D..CB....CEEE..HHH..', traek: 8 },
      { bane: '...GFF...GHH..AAEB....EB..CCD.....D.', traek: 8 },
      { bane: 'IDD.FFI.E.BBAAE..G.HHH.G....CG....C.', traek: 8 }
    ],
    [
      { bane: '..EE....GBBKAAGHLK.FFHLCJDDDICJ...I.', traek: 9 },
      { bane: 'GGI..C.BI..CLBAA.CLBJJFFDDD.KK.HHEE.', traek: 9 },
      { bane: '.EFFFH.EJJCHAABGCI..BGDIL..GD.LKKKD.', traek: 10 },
      { bane: '.GG.FD..HHFDB.AAFDBE.LL.BECCJJ.KKII.', traek: 10 },
      { bane: '...DDF..LLGF..AAGFK.JJJ.KBBEHH.CCEII', traek: 11 },
      { bane: '....LE...GLE.AAGIBJCKKIBJC.FDD...FHH', traek: 11 },
      { bane: '..II..GJ..FKGJAAFKEE.B.K..CBHH..CBDD', traek: 12 },
      { bane: '....KJDDIIKJH.AA.JH..BCC.GGBEEFFF.LL', traek: 12 },
      { bane: '...EDD.GGEFH.AA.FHCCC.F...BII...B...', traek: 13 },
      { bane: '.IDDFF.I.BB.AAJ..K..JLLKHHCCG.EEE.G.', traek: 13 },
      { bane: '...I....BI..AABCG.DE.CGHDEFFGH.....H', traek: 14 },
      { bane: 'H..LLLH..FFJHAACGJDD.CGJ.EBBII.E.KKK', traek: 14 }
    ]
  ];
  var TRAEK = [[2, 4], [5, 8], [9, 14]];

  /** Banen som stammer: { x, y, len, lodret, maal } */
  function lav(tekst) {
    var set = {}, stammer = [];
    for (var i = 0; i < N * N; i++) {
      var c = tekst.charAt(i);
      if (c === '.' || set[c]) continue;
      set[c] = true;
      var x = i % N, y = Math.floor(i / N), lodret = tekst.charAt(i + N) === c && y < N - 1, len = 1;
      if (lodret) while (y + len < N && tekst.charAt(i + len * N) === c) len++;
      else while (x + len < N && tekst.charAt(i + len) === c) len++;
      stammer.push({ x: x, y: y, len: len, lodret: lodret, maal: c === 'A', navn: c });
    }
    // Bodils stamme foerst, saa den altid er nummer 0
    stammer.sort(function (a, b) { return (b.maal ? 1 : 0) - (a.maal ? 1 : 0); });
    return { stammer: stammer };
  }
  function tekst(plade) {
    var t = [];
    for (var i = 0; i < N * N; i++) t.push('.');
    var navne = 'BCDEFGHIJKLMNOPQRSTUVWXYZ', n = 0;
    plade.stammer.forEach(function (s) {
      var c = s.maal ? 'A' : navne.charAt(n++);
      for (var k = 0; k < s.len; k++) t[(s.y + (s.lodret ? k : 0)) * N + s.x + (s.lodret ? 0 : k)] = c;
    });
    return t.join('');
  }
  function kopi(plade) { return { stammer: plade.stammer.map(function (s) { return { x: s.x, y: s.y, len: s.len, lodret: s.lodret, maal: s.maal, navn: s.navn }; }) }; }

  /** Hvilke felter er optaget, uden stamme nr. uden. */
  function optaget(plade, uden) {
    var o = [];
    for (var i = 0; i < N * N; i++) o.push(false);
    plade.stammer.forEach(function (s, j) {
      if (j === uden) return;
      for (var k = 0; k < s.len; k++) o[(s.y + (s.lodret ? k : 0)) * N + s.x + (s.lodret ? 0 : k)] = true;
    });
    return o;
  }
  /** Hvor langt stamme i kan glide: den mindste og stoerste plads (x paa tvaers, y paa langs). */
  function fri(plade, i) {
    var s = plade.stammer[i], o = optaget(plade, i), p = s.lodret ? s.y : s.x, lo = p, hi = p;
    function tom(q) { return !o[s.lodret ? q * N + s.x : s.y * N + q]; }
    while (lo > 0 && tom(lo - 1)) lo--;
    while (hi + s.len < N && tom(hi + s.len)) hi++;
    return { min: lo, max: hi };
  }
  function plads(s) { return s.lodret ? s.y : s.x; }
  function flyt(plade, i, til) {
    var f = fri(plade, i), s = plade.stammer[i];
    if (til < f.min || til > f.max || til === plads(s)) return false;
    if (s.lodret) s.y = til; else s.x = til;
    return true;
  }
  /** Bodils stamme staar ved aabningen og kan glide ud. */
  function loest(plade) { var a = plade.stammer[0]; return a.x + a.len === N; }

  function noegle(plade) { return plade.stammer.map(plads).join(','); }

  /** Alle traek fra en stilling: [{ i, til }] */
  function traek(plade) {
    var ud = [];
    plade.stammer.forEach(function (s, i) {
      var f = fri(plade, i), p = plads(s);
      for (var q = f.min; q <= f.max; q++) if (q !== p) ud.push({ i: i, til: q });
    });
    return ud;
  }
  function saet(plade, t) { var s = plade.stammer[t.i]; if (s.lodret) s.y = t.til; else s.x = t.til; }

  /** Den korteste loesning: en liste af traek, [] hvis den er loest, null hvis den ikke kan loeses. */
  function loes(start, graense) {
    if (loest(start)) return [];
    var set = {}, koe = [{ p: kopi(start), vej: null }], k0 = 0;
    set[noegle(start)] = true;
    graense = graense || 200000;
    while (k0 < koe.length && k0 < graense) {
      var cur = koe[k0++], alle = traek(cur.p);
      for (var j = 0; j < alle.length; j++) {
        var n = kopi(cur.p); saet(n, alle[j]);
        var k = noegle(n);
        if (set[k]) continue;
        set[k] = true;
        var vej = { t: alle[j], far: cur.vej };
        if (loest(n)) { var ud = []; for (var v = vej; v; v = v.far) ud.unshift(v.t); return ud; }
        koe.push({ p: n, vej: vej });
      }
    }
    return null;
  }
  /** Hjaelpen: det foerste traek i den korteste loesning. */
  function hjaelp(plade) { var l = loes(plade); return l && l.length ? l[0] : null; }

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }

  /** En runde: RUNDE baner pr. spiller, forskellige spillerne imellem, fra de nemmeste til de svaereste. */
  function nyRunde(svaerhed, spillere) {
    var b = bland(BANER[svaerhed].map(function (x, i) { return i; }));
    var ud = [];
    for (var s = 0; s < spillere; s++) {
      var mine = b.slice(s * RUNDE, s * RUNDE + RUNDE);
      if (mine.length < RUNDE) mine = bland(b).slice(0, RUNDE);
      mine.sort(function (x, y) { return BANER[svaerhed][x].traek - BANER[svaerhed][y].traek; });
      ud.push(mine);
    }
    return ud;
  }

  /* ---------- det, der siges ---------- */
  var TEKST = {
    start: 'Bodil skal bruge den lyse stamme til sin dæmning. Kan du skubbe den ud til hende?',
    tak: ['Tak! Nu bliver dæmningen større.', 'Sådan! Den kan Bodil bruge.', 'Flot! Bodil har fået sin stamme.'],
    paaTvaers: 'Stammen kan kun glide den vej, den ligger.',
    hjaelp: 'Prøv at skubbe den stamme, der lyser.',
    faerdig: 'Dæmningen er færdig! Tak for hjælpen.',
    venter: 'Du er færdig. Nu venter vi på din ven.'
  };
  function saetninger() {
    var ud = [];
    Object.keys(TEKST).forEach(function (k) { [].concat(TEKST[k]).forEach(function (t) { if (ud.indexOf(t) < 0) ud.push(t); }); });
    return ud;
  }

  var Daemning = {
    N: N, UD_RAEKKE: UD_RAEKKE, RUNDE: RUNDE, BANER: BANER, TRAEK: TRAEK, TEKST: TEKST,
    lav: lav, tekst: tekst, kopi: kopi, fri: fri, flyt: flyt, plads: plads, loest: loest, noegle: noegle,
    traek: traek, saet: saet, loes: loes, hjaelp: hjaelp, nyRunde: nyRunde, saetninger: saetninger, bland: bland
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Daemning: Daemning };
  else rod.Daemning = Daemning;
})(this);
