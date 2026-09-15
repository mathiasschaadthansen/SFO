/**
 * Fysik og AI for racerbanen.
 *
 * Ligger for sig selv og roerer hverken DOM eller canvas, saa den kan
 * koeres i Node uden browser. Se test/racer.test.js.
 *
 * INDSTIL er alle de tal der bestemmer hvordan spillet FOELES.
 * Det er dem man skruer paa — resten af koden skal ikke roeres.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    topfart:        310,   // px/sek paa asfalt
    graesfart:      115,   // px/sek i graesset
    accel:          3.2,   // hvor hurtigt farten naar sit maal
    opbremsning:    7.0,   // hvor haardt graesset bremser
    drejehastighed: 3.3,   // radianer/sek ved fuld fart
    bilLaengde:     34,
    bilBredde:      19,
    omgange:        3,
    aiFart:         0.93,  // andel af spillerens topfart
    aiSigte:        30,    // hvor langt frem ad midterlinjen AI'en kigger
    svingBremse:    0.45,  // laveste fartloft i et skarpt sving
    fastIGraes:     2.6,   // sekunder i graesset foer bilen saettes tilbage
    aiElastik:      0.25,  // hvor meget AI'en saenker/haever farten efter afstand til spilleren
    styrehjaelp:    0.20,  // hvor meget bilen selv traekker mod vejen naar ingen finger er nede
    styrehjaelpSigte: 14   // hvor langt frem styrehjaelpen kigger
  };

  function nærmesteIndeks(bil, bane) {
    // Soeger kun omkring det checkpoint bilen er paa vej mod, saa det ikke
    // bliver dyrere af at banen har mange punkter.
    var linje = bane.linje;
    var midte = Math.floor((bil.næsteCp / bane.checkpoints.length) * linje.length);
    var bedst = midte, bedstAfstand = Infinity;
    for (var d = -60; d <= 60; d++) {
      var i = (midte + d + linje.length) % linje.length;
      var dx = linje[i].x - bil.x, dy = linje[i].y - bil.y;
      var a = dx * dx + dy * dy;
      if (a < bedstAfstand) { bedstAfstand = a; bedst = i; }
    }
    return bedst;
  }

  /**
   * Hvor skarpt svinger banen forude? 0 = lige ud, 1 = naesten et haarnaal.
   * Bruges baade af AI'en til at lette foden og — hvis man vil — til at
   * vise et advarselsskilt for spilleren.
   */
  function svingForude(indeks, bane) {
    var linje = bane.linje;
    var n = linje.length;
    var spring = 14;
    var a = linje[indeks % n];
    var b = linje[(indeks + spring) % n];
    var c = linje[(indeks + spring * 2) % n];
    var v1 = Math.atan2(b.y - a.y, b.x - a.x);
    var v2 = Math.atan2(c.y - b.y, c.x - b.x);
    var forskel = Math.abs(Math.atan2(Math.sin(v2 - v1), Math.cos(v2 - v1)));
    return Math.min(1, forskel / 0.85);
  }

  /** Hvor mange checkpoints bilen har naaet i alt, paa tvaers af omgange. */
  function fremdrift(bil, bane) {
    return bil.omgang * bane.checkpoints.length + bil.næsteCp;
  }

  /** -1, 0 eller 1: hvilken vej skal der drejes for at ramme punktet `sigte` foran. */
  function drejMod(bil, bane, indeks, sigte, doedzone) {
    var linje = bane.linje;
    var mål = linje[(indeks + sigte) % linje.length];
    var ønsket = Math.atan2(mål.y - bil.y, mål.x - bil.x);
    var forskel = Math.atan2(Math.sin(ønsket - bil.vinkel), Math.cos(ønsket - bil.vinkel));
    if (forskel > doedzone) return 1;
    if (forskel < -doedzone) return -1;
    return 0;
  }

  /**
   * Styrer AI-bilen og saetter samtidig dens fartloft.
   *
   * To ting goer forskellen paa om den kan tage et sving:
   *   1. den letter foden foer svinget i stedet for at braemse i det
   *   2. den kigger laengere frem naar den koerer staerkt
   * Uden dem koerer den lige ud i graesset paa de snoede baner.
   *
   * modstander (valgfri): spillerens bil. Er den med, faar AI'en elastik:
   * den letter foden naar den er foran og giver gas naar den er bagud, saa
   * loebet bliver taet, og barnet vinder cirka hver anden gang.
   */
  function aiStyring(bil, bane, modstander) {
    var i = nærmesteIndeks(bil, bane);

    var sving = svingForude(i, bane);
    bil.fartLoft = 1 - sving * (1 - INDSTIL.svingBremse);

    if (modstander) {
      var forspring = fremdrift(bil, bane) - fremdrift(modstander, bane);
      var andel = Math.max(-1, Math.min(1, forspring / 6));
      bil.fartLoft *= 1 - INDSTIL.aiElastik * andel;
    }

    var fartAndel = Math.min(1, bil.fart / INDSTIL.topfart);
    var sigte = Math.round(INDSTIL.aiSigte * (0.45 + 0.55 * fartAndel) * (1 - sving * 0.45));
    sigte = Math.max(6, sigte);

    return drejMod(bil, bane, i, sigte, 0.04);
  }

  /**
   * Blid styrehjaelp til spillerbiler: naar ingen finger er nede, traekker
   * bilen en anelse mod vejen. De 8-aarige maerker det knap, de 6-aarige
   * koerer markant mindre i graesset. Returnerer en brøkdel af fuldt udslag.
   */
  function styrehjaelp(bil, bane) {
    if (INDSTIL.styrehjaelp <= 0) return 0;
    var i = nærmesteIndeks(bil, bane);
    return drejMod(bil, bane, i, INDSTIL.styrehjaelpSigte, 0.08) * INDSTIL.styrehjaelp;
  }

  /**
   * Flytter én bil ét skridt frem.
   * ret: -1 venstre, 0 ligeud, 1 hoejre.
   * Returnerer true hvis bilen lige har fuldfoert en omgang.
   */
  function opdaterBil(bil, bane, ret, dt) {
    var påAsfalt = bane.paaAsfalt(bil.x, bil.y);

    // AI'ens elastik maa aldrig goere den hurtigere end spillerens topfart.
    var top = bil.erAI
      ? INDSTIL.topfart * Math.min(1, INDSTIL.aiFart * (bil.fartLoft || 1))
      : INDSTIL.topfart * (bil.fartLoft || 1);
    var mål = påAsfalt ? top : INDSTIL.graesfart;
    var hastighed = påAsfalt ? INDSTIL.accel : INDSTIL.opbremsning;
    bil.fart += (mål - bil.fart) * Math.min(1, hastighed * dt);

    // Ingen finger nede? Saa hjaelper bilen selv lidt med at blive paa vejen.
    var udslag = ret;
    if (ret === 0 && !bil.erAI) udslag = styrehjaelp(bil, bane);

    // Drej mindre naar bilen naesten holder stille, ellers snurrer den paa stedet
    var greb = Math.min(1, bil.fart / 90);
    bil.vinkel += udslag * INDSTIL.drejehastighed * greb * dt;

    bil.x += Math.cos(bil.vinkel) * bil.fart * dt;
    bil.y += Math.sin(bil.vinkel) * bil.fart * dt;

    bil.x = Math.max(10, Math.min(bane.bredde - 10, bil.x));
    bil.y = Math.max(10, Math.min(bane.hoejde - 10, bil.y));

    // Sat fast i graesset? Saet bilen tilbage paa banen i stedet for at straffe.
    bil.graestid = påAsfalt ? 0 : bil.graestid + dt;
    if (bil.graestid > INDSTIL.fastIGraes) {
      var antal = bane.checkpoints.length;
      var cp = bane.checkpoints[(bil.næsteCp - 1 + antal) % antal];
      var næste = bane.checkpoints[bil.næsteCp % antal];
      bil.x = cp.x;
      bil.y = cp.y;
      bil.vinkel = Math.atan2(næste.y - cp.y, næste.x - cp.x);
      bil.fart = 0;
      bil.graestid = 0;
      bil.genstart = (bil.genstart || 0) + 1;
    }

    // Checkpoints skal tages i raekkefoelge, saa man ikke kan snyde ved at
    // skyde genvej hen over graesset.
    var cpMål = bane.checkpoints[bil.næsteCp];
    var afx = cpMål.x - bil.x, afy = cpMål.y - bil.y;
    if (afx * afx + afy * afy < Math.pow(bane.vejbredde * 0.9, 2)) {
      bil.næsteCp++;
      if (bil.næsteCp >= bane.checkpoints.length) {
        bil.næsteCp = 0;
        bil.omgang++;
        return true;
      }
    }
    return false;
  }

  function skubFraHinanden(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var af = Math.hypot(dx, dy);
    var min = INDSTIL.bilLaengde;
    if (af > 0.001 && af < min) {
      var skub = (min - af) / 2;
      var nx = dx / af, ny = dy / af;
      a.x -= nx * skub; a.y -= ny * skub;
      b.x += nx * skub; b.y += ny * skub;
      a.fart *= 0.86; b.fart *= 0.86;
    }
  }

  rod.Fysik = {
    INDSTIL: INDSTIL,
    opdaterBil: opdaterBil,
    aiStyring: aiStyring,
    skubFraHinanden: skubFraHinanden,
    svingForude: svingForude,
    styrehjaelp: styrehjaelp,
    fremdrift: fremdrift,
    nærmesteIndeks: nærmesteIndeks
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
