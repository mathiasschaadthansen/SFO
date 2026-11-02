/**
 * Pelles julepuslespil: brikkernes form og plads, uden skaerm.
 *
 * Puslespillet har 24 brikker i 6 x 4 over et billede paa 4:3 (alle vennerne
 * om juletraeet juleaften). Hver dag i kalenderen finder boernene én brik.
 * Brikkerne er blaest ud over hele verden, saa de findes spredt over
 * billedet: den foerste nede ved stubben under juletraeet, og de to sidste
 * oppe i hjoernet, som historien siger lillejuleaften ("oppe i hjoernet er der
 * to huller").
 *
 * Hver indre kant har en tap, der vender fast den ene eller anden vej, saa
 * brikkerne har den samme form hver dag. sti() giver brikkens omrids som
 * tegnekommandoer (M, L, C, Z) i pixels for en celle paa b x h, med cellens
 * oeverste venstre hjoerne i (0, 0); tappene stikker ud over cellen.
 * polygon() giver det samme omrids som punkter, til test og trykflader.
 *
 * Til dag 24 er der ogsaa selve laeggelegen: den sidste brik (eller flere)
 * ligger loes, og man traekker den paa plads med fingeren. Slippes en brik taet nok paa sin
 * plads, klikker den fast, som i Tegnestuens puslespil. Ingen tid, ingen
 * forkerte traek. Positioner i laeggelegen er i celler: (0, 0) er braettets
 * oeverste venstre hjoerne, og braettet er 6 x 4 celler.
 *
 * Ingen DOM, saa filen kan testes i Node.
 */
(function (rod) {
  'use strict';

  var KOL = 6, RAEK = 4, FORHOLD = 4 / 3;
  var SNAP = 0.4;                       // hvor taet paa sin plads en brik skal slippes, i celler

  /* Dag -> [kolonne, raekke]. Spredt, saa billedet kommer frem lidt overalt; 23 og 24 er oeverst til hoejre. */
  var ORDEN = [
    [2, 2], [3, 2], [0, 3], [2, 3], [5, 3], [1, 2], [3, 1], [4, 2], [0, 1], [3, 3], [1, 0], [5, 2],
    [2, 1], [1, 3], [4, 1], [0, 0], [4, 3], [2, 0], [0, 2], [5, 1], [1, 1], [3, 0], [4, 0], [5, 0]
  ];

  /*
   * Tappenes retning. lodret[r][k] er kanten mellem kolonne k og k+1 i raekke r,
   * vandret[r][k] kanten mellem raekke r og r+1 i kolonne k. 1: tappen stikker
   * ud af brikken til venstre/oven for kanten, -1: ind i den. Fast moenster, saa
   * brikkerne ser ens ud hver gang.
   */
  var LODRET = [[1, -1, 1, 1, -1], [-1, 1, -1, 1, 1], [1, 1, -1, -1, 1], [-1, 1, 1, -1, -1]];
  var VANDRET = [[-1, 1, 1, -1, 1, -1], [1, -1, 1, 1, -1, 1], [-1, 1, -1, 1, 1, -1]];

  var BRIKKER = ORDEN.map(function (p, i) {
    var k = p[0], r = p[1];
    return {
      dag: i + 1, kol: k, raek: r,
      kanter: {
        op: r === 0 ? 0 : -VANDRET[r - 1][k],
        hoejre: k === KOL - 1 ? 0 : LODRET[r][k],
        ned: r === RAEK - 1 ? 0 : VANDRET[r][k],
        venstre: k === 0 ? 0 : -LODRET[r][k - 1]
      }
    };
  });

  function brik(dag) { return BRIKKER[dag - 1] || null; }
  /** Brikken paa en plads. */
  function paaPlads(kol, raek) { return BRIKKER.filter(function (b) { return b.kol === kol && b.raek === raek; })[0] || null; }

  /*
   * Tappen i enheder af s = den korteste side af cellen, med du langs kanten
   * fra kantens midte og dv ud af brikken. Formen er spejlvendt om midten, saa
   * nabobrikken, der loeber kanten den anden vej, faar praecis den samme kurve.
   */
  var TAP = [
    ['L', -0.15, 0],
    ['C', -0.10, 0, -0.08, 0.05, -0.12, 0.10],
    ['C', -0.17, 0.17, -0.10, 0.25, 0, 0.25],
    ['C', 0.10, 0.25, 0.17, 0.17, 0.12, 0.10],
    ['C', 0.08, 0.05, 0.10, 0, 0.15, 0]
  ];

  /** Omridset af en brik i en celle paa b x h. Med uret rundt fra oeverste venstre hjoerne. */
  function sti(br, b, h) {
    var s = Math.min(b, h), ud = [['M', 0, 0]];
    // Hver kant: start, retning langs kanten, retning ud af brikken, laengde og tappen
    var kanter = [
      { x: 0, y: 0, ux: 1, uy: 0, nx: 0, ny: -1, l: b, k: br.kanter.op },
      { x: b, y: 0, ux: 0, uy: 1, nx: 1, ny: 0, l: h, k: br.kanter.hoejre },
      { x: b, y: h, ux: -1, uy: 0, nx: 0, ny: 1, l: b, k: br.kanter.ned },
      { x: 0, y: h, ux: 0, uy: -1, nx: -1, ny: 0, l: h, k: br.kanter.venstre }
    ];
    kanter.forEach(function (e) {
      function p(du, dv) {
        var u = e.l / 2 + du * s, v = dv * s * e.k;
        return [e.x + e.ux * u + e.nx * v, e.y + e.uy * u + e.ny * v];
      }
      if (e.k) {
        TAP.forEach(function (t) {
          if (t[0] === 'L') { var q = p(t[1], t[2]); ud.push(['L', q[0], q[1]]); }
          else { var a = p(t[1], t[2]), c = p(t[3], t[4]), d = p(t[5], t[6]); ud.push(['C', a[0], a[1], c[0], c[1], d[0], d[1]]); }
        });
      }
      ud.push(['L', e.x + e.ux * e.l, e.y + e.uy * e.l]);
    });
    ud.push(['Z']);
    return ud;
  }

  /** Omridset som punkter (kurverne delt i trin stykker). */
  function polygon(br, b, h, trin) {
    trin = trin || 10;
    var ud = [], x = 0, y = 0;
    sti(br, b, h).forEach(function (o) {
      if (o[0] === 'M' || o[0] === 'L') { x = o[1]; y = o[2]; ud.push([x, y]); }
      else if (o[0] === 'C') {
        for (var i = 1; i <= trin; i++) {
          var t = i / trin, m = 1 - t;
          ud.push([m * m * m * x + 3 * m * m * t * o[1] + 3 * m * t * t * o[3] + t * t * t * o[5],
                   m * m * m * y + 3 * m * m * t * o[2] + 3 * m * t * t * o[4] + t * t * t * o[6]]);
        }
        x = o[5]; y = o[6];
      }
    });
    return ud;
  }

  /** Ligger punktet inde i polygonen? (lige linje mod hoejre, tael krydsninger) */
  function inde(poly, x, y) {
    var ind = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], c = poly[j];
      if ((a[1] > y) !== (c[1] > y) && x < (c[0] - a[0]) * (y - a[1]) / (c[1] - a[1]) + a[0]) ind = !ind;
    }
    return ind;
  }

  /** Hvor meget en tap stikker ud over cellen, i enheder af den korteste side. Til at give plads rundt om brikken. */
  var UDHAENG = 0.25;

  /** Hvilke brikker ligger paa plads i kalenderen paa denne dag: alle dage foer, og dagen selv, hvis den er fundet. */
  function lagt(dag, fundetIDag) {
    return BRIKKER.filter(function (b) { return b.dag < dag || (b.dag === dag && fundetIDag); }).map(function (b) { return b.dag; });
  }

  /* ---------- laeggelegen (dag 24) ---------- */

  /**
   * loese: de dage, hvis brikker ligger loese. pladser: [[x, y], ...] hvor de
   * loese brikkers oeverste venstre hjoerne ligger fra start, i celler.
   */
  function nytSpil(loese, pladser) {
    var brikker = BRIKKER.map(function (b, i) {
      var l = loese.indexOf(b.dag);
      var p = l >= 0 ? pladser[l % pladser.length] : [b.kol, b.raek];
      return { dag: b.dag, kol: b.kol, raek: b.raek, kanter: b.kanter, x: p[0], y: p[1], paa: l < 0, holdtAf: null, dx: 0, dy: 0 };
    });
    var loeseBrikker = brikker.filter(function (b) { return !b.paa; });
    return { brikker: brikker, raekkefoelge: brikker.filter(function (b) { return b.paa; }).concat(loeseBrikker), faerdig: false, netopPaa: null };
  }

  /** Tag den oeverste loese brik under (x, y). id er fingerens pointerId. */
  function tag(spil, x, y, id) {
    for (var i = spil.raekkefoelge.length - 1; i >= 0; i--) {
      var br = spil.raekkefoelge[i];
      if (br.paa || br.holdtAf !== null) continue;
      if (x >= br.x - 0.2 && x <= br.x + 1.2 && y >= br.y - 0.2 && y <= br.y + 1.2) {
        br.holdtAf = id; br.dx = x - br.x; br.dy = y - br.y;
        spil.raekkefoelge.splice(i, 1); spil.raekkefoelge.push(br);
        return br;
      }
    }
    return null;
  }

  function flyt(spil, x, y, id) {
    spil.brikker.forEach(function (br) { if (br.holdtAf === id) { br.x = x - br.dx; br.y = y - br.dy; } });
  }

  /** Slip brikken, fingeren holder. Svarer true, hvis den klikkede paa plads. */
  function slip(spil, id) {
    var paa = false;
    spil.netopPaa = null;
    spil.brikker.forEach(function (br) {
      if (br.holdtAf !== id) return;
      br.holdtAf = null;
      if (Math.hypot(br.x - br.kol, br.y - br.raek) <= SNAP) {
        br.x = br.kol; br.y = br.raek; br.paa = true; paa = true; spil.netopPaa = br;
        spil.raekkefoelge.splice(spil.raekkefoelge.indexOf(br), 1); spil.raekkefoelge.unshift(br);
      }
    });
    spil.faerdig = spil.brikker.every(function (br) { return br.paa; });
    return paa;
  }

  rod.Puslespil = {
    KOL: KOL, RAEK: RAEK, FORHOLD: FORHOLD, SNAP: SNAP, UDHAENG: UDHAENG, ORDEN: ORDEN, BRIKKER: BRIKKER,
    brik: brik, paaPlads: paaPlads, sti: sti, polygon: polygon, inde: inde, lagt: lagt,
    nytSpil: nytSpil, tag: tag, flyt: flyt, slip: slip
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
