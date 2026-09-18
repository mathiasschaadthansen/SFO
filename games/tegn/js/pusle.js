/**
 * Puslespillets regler.
 *
 * Braettet er 100 x 100. En brik har et hjem (kolonne, raekke) og en plads lige
 * nu (x, y er brikkens oeverste venstre hjoerne i braet-enheder, og maa gerne
 * ligge uden for braettet). Slippes en brik taet nok paa sit hjem, klikker den
 * paa plads og kan ikke flyttes igen. Ingen tid, ingen forkerte traek.
 *
 * Ingen DOM, saa filen kan testes i Node.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    gitter: [[2, 2], [3, 2], [3, 3]],     // kolonner x raekker pr. stjerne
    snap: [20, 16, 13]                    // hvor taet paa hjemmet brikken skal slippes
  };

  function bland(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }

  /**
   * pladser: [[x, y], ...] hvor brikkernes MIDTE skal ligge fra start (uden for braettet).
   * Hver indre kant faar en tap, der vender tilfaeldigt: 1 = ud af brikken til hoejre/ned, -1 = ind.
   */
  function nyt(niveau, pladser) {
    niveau = Math.max(0, Math.min(2, niveau | 0));
    var g = INDSTIL.gitter[niveau], kol = g[0], raek = g[1];
    var b = 100 / kol, h = 100 / raek;
    var lodret = [], vandret = [];       // lodret[r][k]: kanten mellem kolonne k og k+1. vandret[r][k]: mellem raekke r og r+1
    for (var r = 0; r < raek; r++) { lodret.push([]); for (var k = 0; k < kol - 1; k++) lodret[r].push(Math.random() < 0.5 ? 1 : -1); }
    for (var r2 = 0; r2 < raek - 1; r2++) { vandret.push([]); for (var k2 = 0; k2 < kol; k2++) vandret[r2].push(Math.random() < 0.5 ? 1 : -1); }
    var brikker = [];
    for (var rr = 0; rr < raek; rr++) for (var kk = 0; kk < kol; kk++) {
      brikker.push({
        kol: kk, raek: rr, x: 0, y: 0, paa: false, holdtAf: null,
        kanter: {
          op: rr === 0 ? 0 : -vandret[rr - 1][kk], ned: rr === raek - 1 ? 0 : vandret[rr][kk],
          venstre: kk === 0 ? 0 : -lodret[rr][kk - 1], hoejre: kk === kol - 1 ? 0 : lodret[rr][kk]
        }
      });
    }
    var steder = bland(pladser);
    bland(brikker).forEach(function (br, i) {
      var s = steder[i % steder.length];
      br.x = s[0] - b / 2; br.y = s[1] - h / 2;
    });
    return { niveau: niveau, kol: kol, raek: raek, b: b, h: h, brikker: brikker, raekkefoelge: brikker.slice(), faerdig: false, netopPaa: null };
  }

  function hjem(spil, br) { return [br.kol * spil.b, br.raek * spil.h]; }

  /** Tag den oeverste loese brik under (x, y). id er fingerens pointerId. */
  function tag(spil, x, y, id) {
    for (var i = spil.raekkefoelge.length - 1; i >= 0; i--) {
      var br = spil.raekkefoelge[i];
      if (br.paa || br.holdtAf !== null) continue;
      if (x >= br.x - 2 && x <= br.x + spil.b + 2 && y >= br.y - 2 && y <= br.y + spil.h + 2) {
        br.holdtAf = id; br.dx = x - br.x; br.dy = y - br.y;
        spil.raekkefoelge.splice(i, 1); spil.raekkefoelge.push(br);      // oeverst
        return br;
      }
    }
    return null;
  }

  function flyt(spil, x, y, id) {
    spil.brikker.forEach(function (br) { if (br.holdtAf === id) { br.x = x - br.dx; br.y = y - br.dy; } });
  }

  /** Slip brikken. Returnerer true, hvis den klikkede paa plads. */
  function slip(spil, id) {
    var paa = false;
    spil.netopPaa = null;
    spil.brikker.forEach(function (br) {
      if (br.holdtAf !== id) return;
      br.holdtAf = null;
      var h = hjem(spil, br);
      if (Math.hypot(br.x - h[0], br.y - h[1]) <= INDSTIL.snap[spil.niveau]) {
        br.x = h[0]; br.y = h[1]; br.paa = true; paa = true; spil.netopPaa = br;
        // Brikker paa plads ligger nederst, saa loese brikker aldrig gemmer sig under dem
        spil.raekkefoelge.splice(spil.raekkefoelge.indexOf(br), 1); spil.raekkefoelge.unshift(br);
      }
    });
    spil.faerdig = spil.brikker.every(function (br) { return br.paa; });
    return paa;
  }

  rod.Pusle = { INDSTIL: INDSTIL, nyt: nyt, hjem: hjem, tag: tag, flyt: flyt, slip: slip };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
