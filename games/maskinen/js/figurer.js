/**
 * Figurerne, delene og baggrunden i Maskinen.
 *
 * Figurerne (pindsvinet Pelle, kaninen, musen, bjoernen, raeven, froeen, aeblet,
 * svampen, traeet og klokken) er
 * malede billeder i billeder/*.png — akvarel i billedbogsstil, lavet med Canvas
 * billedgenerator, se billeder/NOTICE.md. Delene og alt det, der skal kunne
 * skaleres og drejes frit, er SVG skrevet her i koden, med en let "malet" kant
 * og korn, saa det hoerer sammen med billederne. Er et billede ikke hentet
 * endnu, tegnes SVG-udgaven af figuren i stedet, saa der aldrig mangler noget.
 *
 * Hvert SVG-dokument laves her og males én gang over paa et skjult laerred i den
 * stoerrelse, der skal bruges. Bagefter er det bare et drawImage pr. billede,
 * saa det koster ikke noget i spilloekken, og tegningen er skarp paa iPad'ens
 * skaerm (der males i dobbelt stoerrelse).
 *
 * Stilen er "ler": tykke, bloede former uden streger omkring, en lys kant
 * foroven, en moerkere kant forneden og en bloed skygge under. Farverne er
 * daempede pasteller — salviegroen, sart lyseblaa, sandfarvet trae, varm
 * fersken og daempet teglsten. Ingen skarpe farver, ingen sorte konturer.
 *
 * Nye figurer skrives som en funktion i TEGNINGER. De faar bredde og hoejde
 * ind, saa den samme figur kan tegnes baade stor ude i banen og lille paa
 * hylden uden at blive udtvaeret.
 */
var Figurer = (function () {
  'use strict';

  /* ---------- farver ---------- */

  var P = {
    // trae, som stammen paa det malede trae
    traeLys: '#e9cfa0', trae: '#cfa66c', traeM: '#a67440', traeDyb: '#74502a',
    // groent, som traekronen
    salvieLys: '#cbd99c', salvie: '#a7c07a', salvieM: '#7f9f5f', salvieDyb: '#5b7c48',
    // himmel
    blaaLys: '#d9ebf3', blaa: '#b5d6e6', blaaM: '#8fbad0', blaaDyb: '#6d9bb3',
    // varm fersken
    ferskenLys: '#fbdcbd', fersken: '#f1bb92', ferskenM: '#d99060',
    // teglsten, som aeblet
    teglLys: '#e28a6d', tegl: '#c8624a', teglM: '#a04432',
    // papir, sand og skygge
    kridt: '#f8f0e0', creme: '#f0e3ca', sand: '#e5d3ae', sandM: '#cbb382',
    sten: '#b5bcbb', stenM: '#8e9896', stenDyb: '#6d7877',
    moerk: '#5e4a3a', blød: 'rgba(94,74,58,.22)'
  };

  /* ---------- SVG-vaerktoej ---------- */

  function tal(n) { return Math.round(n * 100) / 100; }

  /** Et SVG-dokument med skygge- og glansfiltre, som alle tegninger kan bruge. */
  function doc(b, h, indhold, ekstraDefs) {
    return '<svg xmlns="http://www.w3.org/2000/svg" width="' + tal(b) + '" height="' + tal(h) + '" viewBox="0 0 ' + tal(b) + ' ' + tal(h) + '">' +
      '<defs>' +
      '<filter id="s" x="-45%" y="-45%" width="190%" height="200%">' +
      '<feDropShadow dx="0" dy="' + tal(Math.max(1.5, Math.min(h, b) * 0.055)) + '" stdDeviation="' + tal(Math.max(1.2, Math.min(h, b) * 0.05)) + '" flood-color="#6b5545" flood-opacity="0.28"/></filter>' +
      '<filter id="sl" x="-45%" y="-45%" width="190%" height="200%">' +
      '<feDropShadow dx="0" dy="' + tal(Math.max(1, Math.min(h, b) * 0.03)) + '" stdDeviation="' + tal(Math.max(1, Math.min(h, b) * 0.03)) + '" flood-color="#6b5545" flood-opacity="0.2"/></filter>' +
      // "Malet" kant: en smule uro i konturen, saa formen ikke ser maskinlavet ud
      '<filter id="p" x="-8%" y="-8%" width="116%" height="116%">' +
      '<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="4" result="t"/>' +
      '<feDisplacementMap in="SourceGraphic" in2="t" scale="' + tal(Math.max(1.5, Math.min(b, h) * 0.06)) + '" xChannelSelector="R" yChannelSelector="G"/></filter>' +
      // Korn: fint papirstoej, der laegges over traeet
      '<filter id="k"><feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="1" seed="7"/>' +
      '<feColorMatrix type="matrix" values="0 0 0 0 0.35 0 0 0 0 0.24 0 0 0 0 0.12 0 0 0 0.22 0"/></filter>' +
      (ekstraDefs || '') +
      '</defs>' + indhold + '</svg>';
  }

  /** Lodret farveovergang fra lys til base — den giver leret sin runding. */
  function forløb(id, lys, base) {
    return '<linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1">' +
      '<stop offset="0" stop-color="' + lys + '"/><stop offset="1" stop-color="' + base + '"/></linearGradient>';
  }
  function stråle(id, lys, base) {
    return '<radialGradient id="' + id + '" cx="0.35" cy="0.3" r="0.78">' +
      '<stop offset="0" stop-color="' + lys + '"/><stop offset="1" stop-color="' + base + '"/></radialGradient>';
  }

  /** Lyset foroven og skyggen forneden: det er dem, der goer fladen taktil. */
  function glans(x, y, b, h, r) {
    return '<rect x="' + tal(x + b * 0.06) + '" y="' + tal(y + h * 0.08) + '" width="' + tal(b * 0.88) + '" height="' + tal(h * 0.3) + '" rx="' + tal(Math.min(r, h * 0.15)) + '" fill="#ffffff" opacity="0.4"/>';
  }
  function bund(x, y, b, h, r, farve) {
    return '<rect x="' + tal(x + b * 0.08) + '" y="' + tal(y + h * 0.66) + '" width="' + tal(b * 0.84) + '" height="' + tal(h * 0.26) + '" rx="' + tal(Math.min(r, h * 0.13)) + '" fill="' + farve + '" opacity="0.22"/>';
  }
  /** En hel ler-klods: skygge under, farveovergang, lys foroven, skygge forneden. */
  function klods(x, y, b, h, r, id, moerk) {
    return '<rect x="' + tal(x) + '" y="' + tal(y) + '" width="' + tal(b) + '" height="' + tal(h) + '" rx="' + tal(r) + '" fill="url(#' + id + ')" filter="url(#s)"/>' +
      glans(x, y, b, h, r) + bund(x, y, b, h, r, moerk);
  }
  /**
   * Et malet stykke trae: grundfarve, et par aarer, korn og en kant med lidt
   * uro i. Bruges til planker, ramper, klodser og vippens braet.
   */
  function traestykke(x, y, b, h, r, id) {
    var lodret = h > b, aarer = '', n = Math.max(2, Math.round((lodret ? b : h) / 7));
    for (var i = 1; i <= n; i++) {
      var t = i / (n + 1);
      if (lodret) {
        var ax = x + b * t;
        aarer += '<path d="M' + tal(ax) + ' ' + tal(y + h * 0.06) + 'q' + tal(b * 0.08 * (i % 2 ? 1 : -1)) + ' ' + tal(h * 0.5) + ' 0 ' + tal(h * 0.88) + '" fill="none" stroke="' + P.traeDyb + '" stroke-width="' + tal(Math.max(0.8, b * 0.035)) + '" opacity="0.28"/>';
      } else {
        var ay = y + h * t;
        aarer += '<path d="M' + tal(x + b * 0.05) + ' ' + tal(ay) + 'q' + tal(b * 0.5) + ' ' + tal(h * 0.1 * (i % 2 ? 1 : -1)) + ' ' + tal(b * 0.9) + ' 0" fill="none" stroke="' + P.traeDyb + '" stroke-width="' + tal(Math.max(0.8, h * 0.035)) + '" opacity="0.28"/>';
      }
    }
    var kant = lodret
      ? '<rect x="' + tal(x + b * 0.78) + '" y="' + tal(y) + '" width="' + tal(b * 0.22) + '" height="' + tal(h) + '" rx="' + tal(r) + '" fill="' + P.traeDyb + '" opacity="0.2"/>'
      : '<rect x="' + tal(x) + '" y="' + tal(y + h * 0.76) + '" width="' + tal(b) + '" height="' + tal(h * 0.24) + '" rx="' + tal(r) + '" fill="' + P.traeDyb + '" opacity="0.2"/>';
    return '<g filter="url(#p)">' +
      '<rect x="' + tal(x) + '" y="' + tal(y) + '" width="' + tal(b) + '" height="' + tal(h) + '" rx="' + tal(r) + '" fill="url(#' + id + ')" filter="url(#s)"/>' +
      '<clipPath id="c' + id + '"><rect x="' + tal(x) + '" y="' + tal(y) + '" width="' + tal(b) + '" height="' + tal(h) + '" rx="' + tal(r) + '"/></clipPath>' +
      '<g clip-path="url(#c' + id + ')">' + aarer + kant +
      '<rect x="' + tal(x) + '" y="' + tal(y) + '" width="' + tal(b) + '" height="' + tal(h) + '" filter="url(#k)"/></g>' +
      '</g>';
  }
  function kugleform(cx, cy, r, id, moerk) {
    return '<circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r) + '" fill="url(#' + id + ')" filter="url(#s)"/>' +
      '<ellipse cx="' + tal(cx - r * 0.3) + '" cy="' + tal(cy - r * 0.38) + '" rx="' + tal(r * 0.42) + '" ry="' + tal(r * 0.3) + '" fill="#ffffff" opacity="0.42"/>' +
      '<ellipse cx="' + tal(cx) + '" cy="' + tal(cy + r * 0.55) + '" rx="' + tal(r * 0.66) + '" ry="' + tal(r * 0.3) + '" fill="' + moerk + '" opacity="0.18"/>';
  }
  function øje(cx, cy, r) {
    return '<circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r) + '" fill="' + P.moerk + '"/>' +
      '<circle cx="' + tal(cx - r * 0.3) + '" cy="' + tal(cy - r * 0.35) + '" r="' + tal(r * 0.34) + '" fill="#ffffff" opacity="0.9"/>';
  }

  /* ---------- tegningerne ---------- */

  var TEGNINGER = {

    /* Kaninen: én rund krop, to bloede oerer. Ikke flere detaljer end det. */
    kanin: function (b, h) {
      var s = Math.min(b, h), cx = b / 2, cy = h * 0.58, r = s * 0.31;
      return doc(b, h,
        // oerer
        '<g filter="url(#sl)">' +
        '<ellipse cx="' + tal(cx - r * 0.52) + '" cy="' + tal(cy - r * 1.35) + '" rx="' + tal(r * 0.26) + '" ry="' + tal(r * 0.62) + '" fill="' + P.sandM + '" transform="rotate(-10 ' + tal(cx - r * 0.52) + ' ' + tal(cy - r * 1.35) + ')"/>' +
        '<ellipse cx="' + tal(cx + r * 0.52) + '" cy="' + tal(cy - r * 1.35) + '" rx="' + tal(r * 0.26) + '" ry="' + tal(r * 0.62) + '" fill="' + P.sandM + '" transform="rotate(10 ' + tal(cx + r * 0.52) + ' ' + tal(cy - r * 1.35) + ')"/>' +
        '</g>' +
        '<ellipse cx="' + tal(cx - r * 0.52) + '" cy="' + tal(cy - r * 1.32) + '" rx="' + tal(r * 0.12) + '" ry="' + tal(r * 0.38) + '" fill="' + P.fersken + '" transform="rotate(-10 ' + tal(cx - r * 0.52) + ' ' + tal(cy - r * 1.32) + ')"/>' +
        '<ellipse cx="' + tal(cx + r * 0.52) + '" cy="' + tal(cy - r * 1.32) + '" rx="' + tal(r * 0.12) + '" ry="' + tal(r * 0.38) + '" fill="' + P.fersken + '" transform="rotate(10 ' + tal(cx + r * 0.52) + ' ' + tal(cy - r * 1.32) + ')"/>' +
        // krop
        kugleform(cx, cy, r, 'g', P.traeDyb) +
        // snude
        '<ellipse cx="' + tal(cx) + '" cy="' + tal(cy + r * 0.28) + '" rx="' + tal(r * 0.42) + '" ry="' + tal(r * 0.3) + '" fill="' + P.kridt + '" opacity="0.85"/>' +
        '<circle cx="' + tal(cx) + '" cy="' + tal(cy + r * 0.12) + '" r="' + tal(r * 0.1) + '" fill="' + P.ferskenM + '"/>' +
        øje(cx - r * 0.34, cy - r * 0.16, r * 0.11) + øje(cx + r * 0.34, cy - r * 0.16, r * 0.11) +
        // poter
        '<ellipse cx="' + tal(cx - r * 0.5) + '" cy="' + tal(cy + r * 0.92) + '" rx="' + tal(r * 0.26) + '" ry="' + tal(r * 0.16) + '" fill="' + P.sand + '"/>' +
        '<ellipse cx="' + tal(cx + r * 0.5) + '" cy="' + tal(cy + r * 0.92) + '" rx="' + tal(r * 0.26) + '" ry="' + tal(r * 0.16) + '" fill="' + P.sand + '"/>',
        stråle('g', '#f3e9db', P.sandM));
    },

    /* Pindsvinet: samme runde krop som kaninen, med en takket ryg og en kasket. */
    pindsvin: function (b, h) {
      var s = Math.min(b, h), cx = b / 2, cy = h * 0.58, r = s * 0.31;
      // Ryggen: bloede takker hele vejen rundt om den oeverste halvdel
      var d = '', n = 9;
      for (var i = 0; i <= n; i++) {
        var v = Math.PI + (Math.PI * i) / n;
        var yd = (i % 2 ? r * 1.2 : r * 0.98);
        var x = cx + Math.cos(v) * yd, y = cy + Math.sin(v) * yd;
        d += (i ? 'L' : 'M') + tal(x) + ' ' + tal(y);
      }
      d += 'Z';
      return doc(b, h,
        '<path d="' + d + '" fill="' + P.traeM + '" filter="url(#s)"/>' +
        kugleform(cx, cy, r, 'g', P.traeDyb) +
        // ansigt
        '<ellipse cx="' + tal(cx) + '" cy="' + tal(cy + r * 0.24) + '" rx="' + tal(r * 0.54) + '" ry="' + tal(r * 0.42) + '" fill="' + P.ferskenLys + '"/>' +
        '<circle cx="' + tal(cx) + '" cy="' + tal(cy + r * 0.2) + '" r="' + tal(r * 0.12) + '" fill="' + P.moerk + '"/>' +
        øje(cx - r * 0.32, cy - r * 0.12, r * 0.11) + øje(cx + r * 0.32, cy - r * 0.12, r * 0.11) +
        // kasketten: saadan kender boernene opfinderen
        '<path d="M' + tal(cx - r * 0.95) + ' ' + tal(cy - r * 0.62) + 'q' + tal(r * 0.95) + ' ' + tal(-r * 0.95) + ' ' + tal(r * 1.9) + ' 0z" fill="' + P.salvie + '" filter="url(#sl)"/>' +
        '<path d="M' + tal(cx - r * 0.95) + ' ' + tal(cy - r * 0.62) + 'q' + tal(r * 0.95) + ' ' + tal(-r * 0.6) + ' ' + tal(r * 1.9) + ' 0" fill="' + P.salvieLys + '" opacity="0.65"/>' +
        '<rect x="' + tal(cx - r * 1.25) + '" y="' + tal(cy - r * 0.68) + '" width="' + tal(r * 1.1) + '" height="' + tal(r * 0.2) + '" rx="' + tal(r * 0.1) + '" fill="' + P.salvieM + '"/>',
        stråle('g', '#e8d3bb', '#c6a482'));
    },

    /* Aeblet: kuglen i spillet. Rund, saa den ruller, og tydelig paa afstand. */
    aeble: function (b, h) {
      var s = Math.min(b, h), cx = b / 2, cy = h * 0.56, r = s * 0.4;
      return doc(b, h,
        '<rect x="' + tal(cx - r * 0.09) + '" y="' + tal(cy - r * 1.35) + '" width="' + tal(r * 0.18) + '" height="' + tal(r * 0.5) + '" rx="' + tal(r * 0.09) + '" fill="' + P.traeDyb + '"/>' +
        '<ellipse cx="' + tal(cx + r * 0.45) + '" cy="' + tal(cy - r * 1.12) + '" rx="' + tal(r * 0.34) + '" ry="' + tal(r * 0.17) + '" fill="' + P.salvie + '" transform="rotate(-20 ' + tal(cx + r * 0.45) + ' ' + tal(cy - r * 1.12) + ')"/>' +
        kugleform(cx, cy, r, 'g', P.teglM),
        stråle('g', P.teglLys, P.teglM));
    },

    /* Svampen: pynt i banen, i samme stoerrelse som dyrenes hoveder. */
    svamp: function (b, h) {
      var s = Math.min(b, h), cx = b / 2, r = s * 0.36;
      return doc(b, h,
        '<rect x="' + tal(cx - r * 0.3) + '" y="' + tal(h * 0.48) + '" width="' + tal(r * 0.6) + '" height="' + tal(h * 0.42) + '" rx="' + tal(r * 0.3) + '" fill="' + P.creme + '" filter="url(#sl)"/>' +
        '<path d="M' + tal(cx - r) + ' ' + tal(h * 0.55) + 'a' + tal(r) + ' ' + tal(r * 0.92) + ' 0 0 1 ' + tal(r * 2) + ' 0z" fill="url(#g)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(cx - r * 0.3) + '" cy="' + tal(h * 0.4) + '" rx="' + tal(r * 0.42) + '" ry="' + tal(r * 0.2) + '" fill="#ffffff" opacity="0.32"/>' +
        '<circle cx="' + tal(cx - r * 0.42) + '" cy="' + tal(h * 0.46) + '" r="' + tal(r * 0.14) + '" fill="' + P.kridt + '" opacity="0.9"/>' +
        '<circle cx="' + tal(cx + r * 0.36) + '" cy="' + tal(h * 0.42) + '" r="' + tal(r * 0.11) + '" fill="' + P.kridt + '" opacity="0.9"/>',
        forløb('g', P.teglLys, P.tegl));
    },

    /* Traeet: stamme med tykkelse og tre bloede kroner. */
    trae: function (b, h) {
      var cx = b / 2, st = b * 0.2;
      return doc(b, h,
        klods(cx - st / 2, h * 0.42, st, h * 0.58, st * 0.42, 'st', P.traeDyb) +
        '<circle cx="' + tal(cx - b * 0.24) + '" cy="' + tal(h * 0.4) + '" r="' + tal(b * 0.26) + '" fill="' + P.salvieM + '" filter="url(#sl)"/>' +
        '<circle cx="' + tal(cx + b * 0.25) + '" cy="' + tal(h * 0.36) + '" r="' + tal(b * 0.25) + '" fill="' + P.salvieM + '" filter="url(#sl)"/>' +
        '<circle cx="' + tal(cx) + '" cy="' + tal(h * 0.24) + '" r="' + tal(b * 0.32) + '" fill="url(#k)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(cx - b * 0.1) + '" cy="' + tal(h * 0.15) + '" rx="' + tal(b * 0.16) + '" ry="' + tal(b * 0.09) + '" fill="#ffffff" opacity="0.3"/>',
        forløb('st', P.traeLys, P.traeM) + stråle('k', P.salvieLys, P.salvieDyb));
    },

    /* Busken: samme familie som traeet, men lav og bred. */
    busk: function (b, h) {
      return doc(b, h,
        '<circle cx="' + tal(b * 0.26) + '" cy="' + tal(h * 0.62) + '" r="' + tal(h * 0.38) + '" fill="' + P.salvieM + '"/>' +
        '<circle cx="' + tal(b * 0.74) + '" cy="' + tal(h * 0.6) + '" r="' + tal(h * 0.36) + '" fill="' + P.salvieM + '"/>' +
        '<circle cx="' + tal(b * 0.5) + '" cy="' + tal(h * 0.48) + '" r="' + tal(h * 0.46) + '" fill="url(#k)" filter="url(#sl)"/>' +
        '<ellipse cx="' + tal(b * 0.42) + '" cy="' + tal(h * 0.3) + '" rx="' + tal(h * 0.2) + '" ry="' + tal(h * 0.1) + '" fill="#ffffff" opacity="0.26"/>',
        stråle('k', P.salvieLys, P.salvie));
    },

    /* Klokken: maalet. Bloed ler-klokke, ingen metalglans. */
    klokke: function (b, h) {
      var cx = b / 2, r = Math.min(b, h) * 0.36;
      return doc(b, h,
        '<rect x="' + tal(cx - r * 0.12) + '" y="' + tal(h * 0.16) + '" width="' + tal(r * 0.24) + '" height="' + tal(r * 0.4) + '" rx="' + tal(r * 0.12) + '" fill="' + P.traeM + '"/>' +
        '<path d="M' + tal(cx - r) + ' ' + tal(h * 0.72) + 'v' + tal(-r * 0.15) + 'a' + tal(r) + ' ' + tal(r * 1.15) + ' 0 0 1 ' + tal(r * 2) + ' 0v' + tal(r * 0.15) + 'z" fill="url(#g)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(cx - r * 0.34) + '" cy="' + tal(h * 0.46) + '" rx="' + tal(r * 0.26) + '" ry="' + tal(r * 0.4) + '" fill="#ffffff" opacity="0.32"/>' +
        '<rect x="' + tal(cx - r * 1.08) + '" y="' + tal(h * 0.7) + '" width="' + tal(r * 2.16) + '" height="' + tal(r * 0.26) + '" rx="' + tal(r * 0.13) + '" fill="' + P.traeM + '"/>' +
        '<circle cx="' + tal(cx) + '" cy="' + tal(h * 0.86) + '" r="' + tal(r * 0.17) + '" fill="' + P.traeM + '"/>',
        forløb('g', '#f0d093', '#c99a4f'));
    },

    /* Planke: murene og platformene i banen. Malet trae med aarer. */
    planke: function (b, h) {
      var r = Math.min(Math.min(b, h) * 0.3, 12);
      return doc(b, h, traestykke(1, 1, b - 2, h - 2, r, 'g'), forløb('g', P.trae, P.traeM));
    },

    /* Isplanke: glat, lyseblaa og gennemsigtig, med et par blanke striber. */
    planke_is: function (b, h) {
      var r = Math.min(Math.min(b, h) * 0.3, 12);
      return doc(b, h,
        '<g filter="url(#p)"><rect x="1" y="1" width="' + tal(b - 2) + '" height="' + tal(h - 2) + '" rx="' + tal(r) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<rect x="' + tal(b * 0.06) + '" y="' + tal(h * 0.14) + '" width="' + tal(b * 0.5) + '" height="' + tal(Math.max(2, h * 0.16)) + '" rx="' + tal(h * 0.08) + '" fill="#ffffff" opacity="0.6"/>' +
        '<rect x="' + tal(b * 0.62) + '" y="' + tal(h * 0.2) + '" width="' + tal(b * 0.2) + '" height="' + tal(Math.max(2, h * 0.1)) + '" rx="' + tal(h * 0.05) + '" fill="#ffffff" opacity="0.5"/>' +
        '<rect x="' + tal(b * 0.04) + '" y="' + tal(h * 0.7) + '" width="' + tal(b * 0.92) + '" height="' + tal(h * 0.2) + '" rx="' + tal(h * 0.1) + '" fill="' + P.blaaDyb + '" opacity="0.25"/></g>',
        forløb('g', '#e6f4fa', '#a9d3e6'));
    },
    /* Sneplanke: en bloed, hvid drive, der bremser kuglen. */
    planke_sne: function (b, h) {
      var r = Math.min(Math.min(b, h) * 0.4, 22);
      return doc(b, h,
        '<g filter="url(#p)"><rect x="1" y="' + tal(h * 0.1) + '" width="' + tal(b - 2) + '" height="' + tal(h * 0.9 - 1) + '" rx="' + tal(r) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(b * 0.3) + '" cy="' + tal(h * 0.16) + '" rx="' + tal(b * 0.24) + '" ry="' + tal(h * 0.14) + '" fill="#ffffff"/>' +
        '<ellipse cx="' + tal(b * 0.68) + '" cy="' + tal(h * 0.14) + '" rx="' + tal(b * 0.2) + '" ry="' + tal(h * 0.12) + '" fill="#ffffff"/>' +
        '<rect x="' + tal(b * 0.06) + '" y="' + tal(h * 0.72) + '" width="' + tal(b * 0.88) + '" height="' + tal(h * 0.2) + '" rx="' + tal(h * 0.1) + '" fill="' + P.blaaM + '" opacity="0.2"/></g>',
        forløb('g', '#ffffff', '#dbe9f0'));
    },
    /* Aakandeblad: groent, rundt, med et hak — og bloedt nok til at kaste kuglen op. */
    planke_aakande: function (b, h) {
      return doc(b, h,
        '<g filter="url(#p)"><ellipse cx="' + tal(b / 2) + '" cy="' + tal(h / 2) + '" rx="' + tal(b / 2 - 1) + '" ry="' + tal(h / 2 - 1) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<path d="M' + tal(b * 0.5) + ' ' + tal(h * 0.5) + 'L' + tal(b * 0.88) + ' ' + tal(h * 0.12) + 'L' + tal(b * 0.98) + ' ' + tal(h * 0.5) + 'z" fill="' + P.blaaLys + '" opacity="0.9"/>' +
        '<ellipse cx="' + tal(b * 0.35) + '" cy="' + tal(h * 0.34) + '" rx="' + tal(b * 0.2) + '" ry="' + tal(h * 0.14) + '" fill="#ffffff" opacity="0.3"/>' +
        '<circle cx="' + tal(b * 0.24) + '" cy="' + tal(h * 0.4) + '" r="' + tal(h * 0.22) + '" fill="' + P.ferskenLys + '"/>' +
        '<circle cx="' + tal(b * 0.24) + '" cy="' + tal(h * 0.4) + '" r="' + tal(h * 0.1) + '" fill="' + P.fersken + '"/></g>',
        forløb('g', '#9fc47a', '#5f8f4c'));
    },
    /* Sten: graa, haard og lidt sprael. */
    planke_sten: function (b, h) {
      var r = Math.min(Math.min(b, h) * 0.4, 18);
      return doc(b, h,
        '<g filter="url(#p)"><rect x="1" y="1" width="' + tal(b - 2) + '" height="' + tal(h - 2) + '" rx="' + tal(r) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(b * 0.32) + '" cy="' + tal(h * 0.3) + '" rx="' + tal(b * 0.2) + '" ry="' + tal(h * 0.14) + '" fill="#ffffff" opacity="0.25"/>' +
        '<rect x="' + tal(b * 0.05) + '" y="' + tal(h * 0.7) + '" width="' + tal(b * 0.9) + '" height="' + tal(h * 0.22) + '" rx="' + tal(h * 0.1) + '" fill="' + P.stenDyb + '" opacity="0.3"/>' +
        '<rect x="0" y="0" width="' + tal(b) + '" height="' + tal(h) + '" filter="url(#k)" opacity="0.7"/></g>',
        forløb('g', '#c9cfcf', P.stenM));
    },

    /* Kanonen: et loeb af moerkt trae med messingbaand paa et lille hjul. Loebet drejes i game.js. */
    kanonloeb: function (b, h) {
      return doc(b, h,
        '<g filter="url(#p)"><rect x="1" y="1" width="' + tal(b - 2) + '" height="' + tal(h - 2) + '" rx="' + tal(h * 0.32) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<rect x="' + tal(b * 0.3) + '" y="' + tal(h * 0.06) + '" width="' + tal(b * 0.09) + '" height="' + tal(h * 0.88) + '" rx="' + tal(b * 0.03) + '" fill="#e6c26e"/>' +
        '<rect x="' + tal(b * 0.76) + '" y="' + tal(h * 0.02) + '" width="' + tal(b * 0.1) + '" height="' + tal(h * 0.96) + '" rx="' + tal(b * 0.03) + '" fill="#e6c26e"/>' +
        '<rect x="' + tal(b * 0.06) + '" y="' + tal(h * 0.14) + '" width="' + tal(b * 0.8) + '" height="' + tal(h * 0.16) + '" rx="' + tal(h * 0.08) + '" fill="#ffffff" opacity="0.22"/>' +
        '<circle cx="' + tal(b * 0.93) + '" cy="' + tal(h * 0.5) + '" r="' + tal(h * 0.3) + '" fill="' + P.moerk + '"/></g>',
        forløb('g', '#6d6660', '#3f3a37'));
    },
    kanonhjul: function (b, h) {
      var r = Math.min(b, h) / 2 - 1, cx = b / 2, cy = h / 2, eger = '';
      for (var i = 0; i < 4; i++) eger += '<rect x="' + tal(cx - r * 0.07) + '" y="' + tal(cy - r * 0.9) + '" width="' + tal(r * 0.14) + '" height="' + tal(r * 1.8) + '" fill="' + P.traeDyb + '" transform="rotate(' + (i * 45) + ' ' + tal(cx) + ' ' + tal(cy) + ')"/>';
      return doc(b, h,
        '<g filter="url(#p)"><circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r) + '" fill="url(#g)" filter="url(#s)"/>' +
        '<circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r * 0.72) + '" fill="' + P.traeLys + '"/>' + eger +
        '<circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r * 0.2) + '" fill="' + P.moerk + '"/></g>',
        forløb('g', P.traeM, P.traeDyb));
    },

    /* Tragten: en blank metaltragt med tud forneden. */
    tragt: function (b, h) {
      return doc(b, h,
        '<g filter="url(#p)"><path d="M1 ' + tal(h * 0.08) + 'H' + tal(b - 1) + 'L' + tal(b * 0.6) + ' ' + tal(h * 0.62) + 'V' + tal(h - 1) + 'H' + tal(b * 0.4) + 'V' + tal(h * 0.62) + 'z" fill="url(#g)" filter="url(#s)"/>' +
        '<ellipse cx="' + tal(b / 2) + '" cy="' + tal(h * 0.08) + '" rx="' + tal(b / 2 - 1) + '" ry="' + tal(h * 0.07) + '" fill="' + P.stenDyb + '"/>' +
        '<ellipse cx="' + tal(b / 2) + '" cy="' + tal(h * 0.08) + '" rx="' + tal(b * 0.42) + '" ry="' + tal(h * 0.045) + '" fill="#4b5558"/>' +
        '<path d="M' + tal(b * 0.12) + ' ' + tal(h * 0.16) + 'L' + tal(b * 0.42) + ' ' + tal(h * 0.58) + '" stroke="#ffffff" stroke-width="' + tal(b * 0.05) + '" stroke-linecap="round" opacity="0.45"/>' +
        '<rect x="' + tal(b * 0.42) + '" y="' + tal(h * 0.64) + '" width="' + tal(b * 0.05) + '" height="' + tal(h * 0.3) + '" rx="' + tal(b * 0.02) + '" fill="#ffffff" opacity="0.35"/></g>',
        forløb('g', '#d5dadb', '#8a9598'));
    },

    /* Tragtens tud, naar den peger til siden: et lille boejet roer. Tegnes til hoejre; spejles i game.js. */
    tragttud: function (b, h) {
      return doc(b, h,
        '<g filter="url(#p)"><path d="M' + tal(b * 0.08) + ' 1H' + tal(b * 0.3) + 'q' + tal(b * 0.25) + ' 0 ' + tal(b * 0.3) + ' ' + tal(h * 0.45) + 'H' + tal(b - 1) + 'V' + tal(h - 1) + 'H' + tal(b * 0.5) + 'q' + tal(-b * 0.2) + ' 0 ' + tal(-b * 0.22) + ' ' + tal(-h * 0.35) + 'H' + tal(b * 0.08) + 'z" fill="url(#g)" filter="url(#s)"/>' +
        '<path d="M' + tal(b * 0.12) + ' ' + tal(h * 0.2) + 'H' + tal(b * 0.28) + '" stroke="#ffffff" stroke-width="' + tal(h * 0.12) + '" stroke-linecap="round" opacity="0.4"/></g>',
        forløb('g', '#d5dadb', '#8a9598'));
    },

    /* Rampen: den glatte plade, kuglen triller ned ad. */
    rampe: function (b, h) {
      return doc(b, h, traestykke(1, 1, b - 2, h - 2, (h - 2) / 2, 'g'), forløb('g', P.traeLys, P.trae));
    },

    /* Trampolinen: bloed dug oeverst, fjedre og fod under. Dugen fylder den
       oeverste tredjedel, for det er der, kuglen rammer. */
    trampolin: function (b, h) {
      var dug = h * 0.45, f = '';
      for (var i = 0; i < 3; i++) {
        var fx = b * (0.22 + i * 0.28);
        f += '<rect x="' + tal(fx - b * 0.025) + '" y="' + tal(dug * 0.9) + '" width="' + tal(b * 0.05) + '" height="' + tal(h - dug * 0.9 - h * 0.12) + '" rx="' + tal(b * 0.025) + '" fill="' + P.stenM + '"/>';
      }
      return doc(b, h,
        f +
        '<rect x="' + tal(b * 0.1) + '" y="' + tal(h * 0.88) + '" width="' + tal(b * 0.8) + '" height="' + tal(h * 0.12) + '" rx="' + tal(h * 0.06) + '" fill="' + P.stenDyb + '"/>' +
        klods(0.5, 0.5, b - 1, dug, dug / 2, 'g', P.blaaDyb),
        forløb('g', P.blaaLys, P.blaa));
    },

    /* Klodsen: den faste mur, man selv kan flytte. En kasse af trae. */
    klods: function (b, h) {
      return doc(b, h,
        traestykke(1, 1, b - 2, h - 2, Math.min(b, h) * 0.12, 'g') +
        '<rect x="' + tal(b * 0.18) + '" y="' + tal(h * 0.18) + '" width="' + tal(b * 0.64) + '" height="' + tal(h * 0.64) + '" rx="' + tal(Math.min(b, h) * 0.06) + '" fill="none" stroke="' + P.traeDyb + '" stroke-width="' + tal(Math.max(1, b * 0.03)) + '" opacity="0.35"/>',
        forløb('g', P.trae, P.traeM));
    },

    /* Baandet: en bloed valse, der traekker kuglen med sig. */
    baand: function (b, h) {
      return doc(b, h,
        klods(0.5, 0.5, b - 1, h - 1, (h - 1) / 2, 'g', P.stenDyb) +
        '<circle cx="' + tal(h * 0.62) + '" cy="' + tal(h / 2) + '" r="' + tal(h * 0.26) + '" fill="' + P.stenDyb + '" opacity="0.5"/>' +
        '<circle cx="' + tal(b - h * 0.62) + '" cy="' + tal(h / 2) + '" r="' + tal(h * 0.26) + '" fill="' + P.stenDyb + '" opacity="0.5"/>',
        forløb('g', '#cfd7d9', P.sten));
    },

    /* Pilen paa baandet: viser hvilken vej, det koerer. */
    baandpil: function (b, h) {
      return doc(b, h,
        '<path d="M' + tal(b * 0.15) + ' ' + tal(h * 0.2) + 'L' + tal(b * 0.85) + ' ' + tal(h * 0.5) + 'L' + tal(b * 0.15) + ' ' + tal(h * 0.8) + '" fill="none" stroke="' + P.kridt + '" stroke-width="' + tal(h * 0.22) + '" stroke-linecap="round" stroke-linejoin="round" opacity="0.75"/>');
    },

    /* Blaeserens hus. Vingen tegnes for sig, saa den kan dreje rundt. */
    blaeserhus: function (b, h) {
      return doc(b, h,
        klods(1, 1, b - 2, h - 2, Math.min(b, h) * 0.26, 'g', P.stenDyb) +
        '<circle cx="' + tal(b / 2) + '" cy="' + tal(h / 2) + '" r="' + tal(Math.min(b, h) * 0.34) + '" fill="' + P.stenDyb + '" opacity="0.22"/>',
        forløb('g', P.blaaLys, P.blaaM));
    },
    blaeservinge: function (b, h) {
      var cx = b / 2, cy = h / 2, r = Math.min(b, h) * 0.44, v = '';
      for (var i = 0; i < 4; i++) {
        v += '<ellipse cx="' + tal(cx) + '" cy="' + tal(cy - r * 0.52) + '" rx="' + tal(r * 0.24) + '" ry="' + tal(r * 0.5) + '" fill="' + P.kridt + '" transform="rotate(' + (i * 90) + ' ' + tal(cx) + ' ' + tal(cy) + ')"/>';
      }
      return doc(b, h, v + '<circle cx="' + tal(cx) + '" cy="' + tal(cy) + '" r="' + tal(r * 0.2) + '" fill="' + P.ferskenM + '"/>');
    },
    /** Luften foran blaeseren: en bloed kegle, der bliver svagere udad. */
    vind: function (b, h) {
      return doc(b, h,
        '<path d="M' + tal(b * 0.34) + ' ' + tal(h) + 'L' + tal(b * 0.02) + ' 0L' + tal(b * 0.98) + ' 0L' + tal(b * 0.66) + ' ' + tal(h) + 'z" fill="url(#v)"/>',
        '<linearGradient id="v" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="' + P.blaaLys + '" stop-opacity="0.55"/><stop offset="1" stop-color="' + P.blaaLys + '" stop-opacity="0"/></linearGradient>');
    },

    /* Vippen: fod og braet hver for sig, saa braettet kan tippe. */
    vippefod: function (b, h) {
      return doc(b, h,
        '<path d="M' + tal(b * 0.5) + ' 1L' + tal(b - 1) + ' ' + tal(h - 1) + 'H1z" fill="url(#g)" filter="url(#s)"/>' +
        '<path d="M' + tal(b * 0.5) + ' ' + tal(h * 0.16) + 'L' + tal(b * 0.72) + ' ' + tal(h * 0.62) + 'H' + tal(b * 0.28) + 'z" fill="#ffffff" opacity="0.25"/>',
        forløb('g', P.traeLys, P.traeM));
    },
    vippebraet: function (b, h) {
      return doc(b, h,
        traestykke(1, 1, b - 2, h - 2, (h - 2) / 2, 'g') +
        '<rect x="' + tal(b * 0.03) + '" y="' + tal(h * 0.18) + '" width="' + tal(b * 0.14) + '" height="' + tal(h * 0.64) + '" rx="' + tal(h * 0.32) + '" fill="' + P.tegl + '" opacity="0.8"/>' +
        '<rect x="' + tal(b * 0.83) + '" y="' + tal(h * 0.18) + '" width="' + tal(b * 0.14) + '" height="' + tal(h * 0.64) + '" rx="' + tal(h * 0.32) + '" fill="' + P.tegl + '" opacity="0.8"/>',
        forløb('g', P.traeLys, P.trae));
    },

    /* Den store knap nederst til hoejre: gaa i gang, eller stil tilbage. */
    knapstart: function (b, h) {
      var r = Math.min(b, h) / 2 - 1;
      return doc(b, h,
        kugleform(b / 2, h / 2, r, 'g', P.salvieDyb) +
        '<path d="M' + tal(b / 2 - r * 0.26) + ' ' + tal(h / 2 - r * 0.44) + 'L' + tal(b / 2 + r * 0.5) + ' ' + tal(h / 2) + 'L' + tal(b / 2 - r * 0.26) + ' ' + tal(h / 2 + r * 0.44) + 'z" fill="' + P.kridt + '" stroke="' + P.kridt + '" stroke-width="' + tal(r * 0.18) + '" stroke-linejoin="round"/>',
        stråle('g', P.salvieLys, P.salvieDyb));
    },
    knapigen: function (b, h) {
      var r = Math.min(b, h) / 2 - 1, cx = b / 2, cy = h / 2;
      return doc(b, h,
        kugleform(cx, cy, r, 'g', P.ferskenM) +
        '<path d="M' + tal(cx + r * 0.42) + ' ' + tal(cy - r * 0.12) + 'a' + tal(r * 0.44) + ' ' + tal(r * 0.44) + ' 0 1 1 ' + tal(-r * 0.26) + ' ' + tal(-r * 0.33) + '" fill="none" stroke="' + P.kridt + '" stroke-width="' + tal(r * 0.2) + '" stroke-linecap="round"/>' +
        '<path d="M' + tal(cx + r * 0.08) + ' ' + tal(cy - r * 0.62) + 'l' + tal(r * 0.42) + ' ' + tal(r * 0.14) + 'l' + tal(-r * 0.3) + ' ' + tal(r * 0.32) + 'z" fill="' + P.kridt + '"/>',
        stråle('g', P.ferskenLys, P.ferskenM));
    },

    /* Prikkerne: hvor mange dele der er tilbage, og hvor mange baner der er klaret. */
    prik: function (b, h) {
      return doc(b, h, kugleform(b / 2, h / 2, Math.min(b, h) / 2 - 1, 'g', P.salvieDyb), stråle('g', P.salvieLys, P.salvie));
    },
    prikgraa: function (b, h) {
      return doc(b, h, kugleform(b / 2, h / 2, Math.min(b, h) / 2 - 1, 'g', P.traeM), stråle('g', P.sand, P.sandM));
    },
    prikgul: function (b, h) {
      return doc(b, h, kugleform(b / 2, h / 2, Math.min(b, h) / 2 - 1, 'g', P.ferskenM), stråle('g', P.ferskenLys, P.fersken));
    }
  };

  /* ---------- de malede billeder ---------- */

  // Figurer, der findes som malede billeder i billeder/<navn>.png
  var BILLEDER = { kanin: true, pindsvin: true, aeble: true, svamp: true, trae: true, klokke: true,
                   mus: true, bjoern: true, raev: true, froe: true, ugle: true,
                   gran: true, snemand: true, snebold: true, kastanje: true, siv: true, lygte: true };
  var malede = {};

  /** Det malede billede af en figur, hvis det findes og er hentet. */
  function malet(navn) {
    if (!BILLEDER[navn]) return null;
    var e = malede[navn];
    if (!e) {
      e = malede[navn] = { klar: false, img: new Image() };
      e.img.onload = function () { e.klar = true; };
      e.img.onerror = function () { BILLEDER[navn] = false; };   // mangler filen, tegnes SVG'en i stedet
      e.img.src = 'billeder/' + navn + '.png';
    }
    return e.klar ? e.img : null;
  }
  /** Hent alle billederne med det samme, saa de er klar, naar banen starter. */
  function forhent() { Object.keys(BILLEDER).forEach(malet); }

  /* ---------- fra SVG til billede ---------- */

  // Der males i dobbelt stoerrelse, saa tegningen ogsaa er skarp paa iPad'ens
  // skaerm. Hver stoerrelse males én gang og bliver liggende i lageret.
  var SKALA = 2, lager = {}, antal = 0;

  function billede(navn, b, h) {
    b = Math.max(2, Math.round(b)); h = Math.max(2, Math.round(h));
    var noegle = navn + '|' + b + '|' + h;
    var e = lager[noegle];
    if (e) return e.klar ? e.laerred : null;
    var tegning = TEGNINGER[navn];
    if (!tegning) return null;
    if (antal > 160) { lager = {}; antal = 0; }        // ryd op, hvis skaermen har skiftet stoerrelse mange gange
    e = lager[noegle] = { klar: false, laerred: document.createElement('canvas') };
    antal++;
    e.laerred.width = b * SKALA; e.laerred.height = h * SKALA;
    var img = new Image();
    img.onload = function () {
      try {
        e.laerred.getContext('2d').drawImage(img, 0, 0, b * SKALA, h * SKALA);
        e.klar = true;
      } catch (fejl) { /* tegningen springes bare over */ }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tegning(b, h));
    return null;
  }

  /**
   * Tegn en figur med midten i (x, y). Returnerer false, hvis billedet endnu
   * ikke er malet faerdigt — saa tegner spillet en enkel form i stedet.
   */
  function tegn(c, navn, x, y, b, h, vinkel) {
    var m = malet(navn);
    if (m) {
      // Det malede billede passes ind i kassen uden at blive trukket skaevt
      var sk = Math.min(b / m.naturalWidth, h / m.naturalHeight), mb = m.naturalWidth * sk, mh = m.naturalHeight * sk;
      c.save();
      c.translate(x, y);
      if (vinkel) c.rotate(vinkel);
      c.drawImage(m, -mb / 2, -mh / 2, mb, mh);
      c.restore();
      return true;
    }
    var img = billede(navn, b, h);
    if (!img) return false;
    c.save();
    c.translate(x, y);
    if (vinkel) c.rotate(vinkel);
    c.drawImage(img, -b / 2, -h / 2, b, h);
    c.restore();
    return true;
  }

  /** Tegn en figur, der staar paa jorden: foedderne i (x, bund), hoejden h. */
  function tegnStaaende(c, navn, x, bund, h) {
    var m = malet(navn);
    var b = m ? h * m.naturalWidth / m.naturalHeight : h;
    return tegn(c, navn, x, bund - h / 2, b, h);
  }

  /** Samme, men med et hjoerne i (x, y) — til murene, der har faste maal. */
  function tegnVed(c, navn, x, y, b, h) {
    var img = billede(navn, b, h);
    if (!img) return false;
    c.drawImage(img, x, y, b, h);
    return true;
  }

  return { PALET: P, tegn: tegn, tegnVed: tegnVed, tegnStaaende: tegnStaaende, forhent: forhent, malede: BILLEDER, navne: Object.keys(TEGNINGER) };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = { Figurer: Figurer };
