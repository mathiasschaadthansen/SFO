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
    styrehjaelpSigte: 14,  // hvor langt frem styrehjaelpen kigger
    turboFaktor:    1.35,  // fart ganget op mens turboen virker
    turboTid:       1.1,   // sekunder turboen virker efter et turbofelt
    turboPause:     1.5,   // sekunder foer samme bil kan tage turbo igen
    aiTurbo:        false  // maa AI'en tage turbofelter? Saettes af svaerhedsgraden
  };

  /**
   * Svaerhedsgrader. Vaelges i menuen med 1, 2 eller 3 stjerner.
   * Vaerdierne kopieres ind i INDSTIL naar et loeb starter.
   *
   *   1 stjerne: til de mindste. AI'en holder sig taet paa, koerer en blid
   *              linje og bremser foer sving. Bilen faar hjaelp til at blive
   *              paa vejen.
   *   2 stjerner: AI'en koerer lige saa hurtigt som spilleren, strammere
   *              linje, bremser kun lidt. Mindre hjaelp.
   *   3 stjerner: to AI-biler der koerer den stramme linje uden at bremse
   *              og tager turbofelterne. Ingen hjaelp, ingen elastik.
   *
   * aiSigte er det der betyder mest: 30 giver en bred, langsom linje,
   * 20 en stram og hurtig. Maalt i simulering: paa Slangen koerer AI'en
   * en omgang paa 14,7 s med sigte 30 og 10,1 s med sigte 20.
   */
  var SVAERHED = [
    { aiFart: 0.93, aiElastik: 0.25, styrehjaelp: 0.20, svingBremse: 0.45, aiSigte: 30, ekstraAI: 0, aiTurbo: false },
    { aiFart: 1.00, aiElastik: 0.10, styrehjaelp: 0.10, svingBremse: 0.85, aiSigte: 24, ekstraAI: 0, aiTurbo: false },
    { aiFart: 1.00, aiElastik: 0.00, styrehjaelp: 0.00, svingBremse: 1.00, aiSigte: 20, ekstraAI: 1, aiTurbo: true }
  ];

  function saetSvaerhed(niveau) {
    var s = SVAERHED[Math.max(0, Math.min(SVAERHED.length - 1, niveau | 0))];
    INDSTIL.aiFart = s.aiFart;
    INDSTIL.aiElastik = s.aiElastik;
    INDSTIL.styrehjaelp = s.styrehjaelp;
    INDSTIL.svingBremse = s.svingBremse;
    INDSTIL.aiSigte = s.aiSigte;
    INDSTIL.aiTurbo = s.aiTurbo;
    return s;
  }

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

  /**
   * -1, 0 eller 1: hvilken vej skal der drejes for at ramme punktet `sigte` foran.
   * forskyd: hvor langt til siden for midterlinjen maalet ligger (px, + = hoejre).
   */
  function drejMod(bil, bane, indeks, sigte, doedzone, forskyd) {
    var linje = bane.linje;
    var n = linje.length;
    var mål = linje[(indeks + sigte) % n];
    var mx = mål.x, my = mål.y;
    if (forskyd) {
      var næste = linje[(indeks + sigte + 3) % n];
      var v = Math.atan2(næste.y - mål.y, næste.x - mål.x) + Math.PI / 2;
      mx += Math.cos(v) * forskyd;
      my += Math.sin(v) * forskyd;
    }
    var ønsket = Math.atan2(my - bil.y, mx - bil.x);
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
    var sigte = Math.round(INDSTIL.aiSigte * (bane.aiSigteFaktor || 1) * (0.45 + 0.55 * fartAndel) * (1 - sving * 0.45));
    sigte = Math.max(6, sigte);

    // Hver AI-bil har sin egen koerebane (bil.koerebane, -1..1), saa to
    // AI-biler ikke ligger og skubber til hinanden paa samme linje.
    // I skarpe sving traekkes de ind mod midten igen.
    var forskyd = (bil.koerebane || 0) * bane.vejbredde * 0.2 * (1 - sving);

    return drejMod(bil, bane, i, sigte, 0.04, forskyd);
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

    // Elastikken maa ikke goere AI'en hurtigere end svaerhedsgraden tillader:
    // hoejst spillerens topfart, eller aiFart hvis den er sat over 1.
    var top = bil.erAI
      ? INDSTIL.topfart * Math.min(Math.max(1, INDSTIL.aiFart), INDSTIL.aiFart * (bil.fartLoft || 1))
      : INDSTIL.topfart * (bil.fartLoft || 1);

    // Turbofelter: koer hen over et felt og faa et kort skub. Baade boern og
    // AI kan tage dem, men AI'en koerer midt paa vejen og rammer dem sjaeldent.
    bil.turbo = Math.max(0, (bil.turbo || 0) - dt);
    bil.turboPause = Math.max(0, (bil.turboPause || 0) - dt);
    if (bil.turboPause <= 0 && bane.turbo && (!bil.erAI || INDSTIL.aiTurbo)) {
      for (var t = 0; t < bane.turbo.length; t++) {
        var felt = bane.turbo[t];
        var fx = felt.x - bil.x, fy = felt.y - bil.y;
        if (fx * fx + fy * fy < felt.r * felt.r) {
          bil.turbo = INDSTIL.turboTid;
          bil.turboPause = INDSTIL.turboTid + INDSTIL.turboPause;
          bil.turboTaget = (bil.turboTaget || 0) + 1;
          break;
        }
      }
    }
    if (bil.turbo > 0) top *= INDSTIL.turboFaktor;
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

  /**
   * Skubber to biler fra hinanden naar de rammer sammen. Kun den bil der
   * koerer ind i den anden mister fart. Den der bliver ramt bagfra, koerer
   * videre — ellers kan man bremse den foerende ved bare at ligge og skubbe.
   */
  function skubFraHinanden(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var af = Math.hypot(dx, dy);
    var min = INDSTIL.bilLaengde;
    if (af > 0.001 && af < min) {
      var skub = (min - af) / 2;
      var nx = dx / af, ny = dy / af;
      a.x -= nx * skub; a.y -= ny * skub;
      b.x += nx * skub; b.y += ny * skub;
      // Hvem koerer mod den anden?
      var aMod = Math.cos(a.vinkel) * nx + Math.sin(a.vinkel) * ny;
      var bMod = -(Math.cos(b.vinkel) * nx + Math.sin(b.vinkel) * ny);
      if (aMod > 0.3) a.fart *= 0.94;
      if (bMod > 0.3) b.fart *= 0.94;
    }
  }

  rod.Fysik = {
    INDSTIL: INDSTIL,
    SVAERHED: SVAERHED,
    saetSvaerhed: saetSvaerhed,
    opdaterBil: opdaterBil,
    aiStyring: aiStyring,
    skubFraHinanden: skubFraHinanden,
    svingForude: svingForude,
    styrehjaelp: styrehjaelp,
    fremdrift: fremdrift,
    nærmesteIndeks: nærmesteIndeks
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
