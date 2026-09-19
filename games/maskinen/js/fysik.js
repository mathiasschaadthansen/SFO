/**
 * Fysik og baner til Maskinen.
 *
 * Barnet bygger en kaedereaktion: en kugle skal ned til klokken. Paa hylden
 * ligger et par dele — ramper, trampoliner, blaesere, klodser, baand og vipper
 * — og barnet traekker dem ud i banen og trykker paa start. Saa ruller kuglen,
 * og man ser, om det virkede. Gjorde det ikke, trykker man bare paa igen.
 * Ingen tid, ingen forsoeg der taelles, ingen maade at tabe paa.
 *
 * Verden har faste maal (BREDDE x HOEJDE), saa fysikken er den samme paa en
 * iPad, en iPhone og i Node. Skaermen skalerer kun billedet. Simulationen
 * koerer med et fast tidsskridt, saa den er forudsigelig: samme opstilling
 * giver altid samme forloeb, og testen kan derfor gennemspille hver bane.
 *
 * Alt er linjestykker. En kugle stoeder mod et linjestykke, bliver skubbet ud
 * og kaster sig tilbage efter stykkets hop (elasticitet) og gnid (friktion).
 * Et baand giver desuden fart langs stykket, og en blaeser skubber kuglen
 * inden for sin raekkevidde. Vippen er det eneste, der selv drejer.
 *
 * Ingen DOM, saa filen kan testes i Node. Se test/maskinen.test.js.
 */
(function (rod) {
  'use strict';

  var BREDDE = 1000, HOEJDE = 620;
  var TYNGDE = 1250;
  var DT = 1 / 120;                 // fast tidsskridt
  var GITTER = 20;                  // dele klikker fast paa et gitter, saa det er nemt at ramme
  var KUGLE_R = 17;
  var MAAL_R = 34;                  // hvor taet paa klokken kuglen skal vaere
  var MAKS_FART = 1900;

  /**
   * Delene paa hylden. b og h er delens maal. vinkler er de stillinger, man
   * kan trykke den rundt i. hop er hvor meget kuglen kastes tilbage, gnid hvor
   * meget fart den mister langs fladen.
   */
  var DELE = {
    // Et braet at rulle ned ad. Fem stillinger: flad, og skraat til hver side.
    rampe:     { b: 170, h: 14, hop: 0.10, gnid: 0.04, vinkler: [0, 20, 40, -20, -40] },
    // Kaster kuglen op igen.
    trampolin: { b: 120, h: 16, hop: 1.45, gnid: 0.10, vinkler: [0, -22, 22] },
    // En klods at spaerre med eller lande paa.
    klods:     { b: 80,  h: 80, hop: 0.22, gnid: 0.35, vinkler: [0] },
    // Baandet traekker kuglen med. Et tryk vender retningen.
    baand:     { b: 180, h: 20, hop: 0.05, gnid: 0.85, fart: 300, vinkler: [0, 180] },
    // Blaeseren puster i den retning, den peger: 0 op, 90 hoejre, 180 ned, 270 venstre.
    blaeser:   { b: 84,  h: 84, kraft: 2600, raekke: 300, vinkler: [0, 90, 180, 270] },
    // Vippen drejer om sin midte, naar kuglen lander paa den ene side.
    vippe:     { b: 210, h: 14, hop: 0.15, gnid: 0.45, drejer: true, maksVinkel: 26, vinkler: [0] }
  };
  var DELNAVNE = Object.keys(DELE);

  /* ---------- geometri ---------- */

  function grader(v) { return v * Math.PI / 180; }

  /** De fire sider af en drejet kasse som linjestykker. */
  function kasseStykker(x, y, b, h, vinkel, stil) {
    var c = Math.cos(grader(vinkel)), s = Math.sin(grader(vinkel));
    var hj = [[-b / 2, -h / 2], [b / 2, -h / 2], [b / 2, h / 2], [-b / 2, h / 2]].map(function (p) {
      return { x: x + p[0] * c - p[1] * s, y: y + p[0] * s + p[1] * c };
    });
    var ud = [];
    for (var i = 0; i < 4; i++) {
      var a = hj[i], b2 = hj[(i + 1) % 4];
      var st = { x1: a.x, y1: a.y, x2: b2.x, y2: b2.y, hop: stil.hop, gnid: stil.gnid };
      // Baandet traekker kun langs oversiden (stykke 0 er toppen)
      if (stil.baand && i === 0) st.baand = stil.baand;
      ud.push(st);
    }
    return ud;
  }

  /** Naermeste punkt paa et linjestykke. */
  function naermest(st, x, y) {
    var dx = st.x2 - st.x1, dy = st.y2 - st.y1;
    var l2 = dx * dx + dy * dy;
    var t = l2 === 0 ? 0 : ((x - st.x1) * dx + (y - st.y1) * dy) / l2;
    t = t < 0 ? 0 : (t > 1 ? 1 : t);
    return { x: st.x1 + t * dx, y: st.y1 + t * dy, t: t };
  }

  /* ---------- verden ---------- */

  /**
   * Byg verdenen for en bane med de dele, barnet har lagt ud.
   * lagte er [{ slags, x, y, vinkel }]. fri betyder ingen klokke og frit valg.
   */
  function nyVerden(bane, lagte) {
    var v = {
      bane: bane, lagte: lagte.map(function (d) { return { slags: d.slags, x: d.x, y: d.y, vinkel: d.vinkel }; }),
      kugle: { x: bane.start.x, y: bane.start.y, vx: 0, vy: 0, r: KUGLE_R, hviler: 0, spin: 0 },
      tid: 0, loest: false, stoppet: false, vipper: [], blaesere: [], stykker: [], spor: [], stoed: []
    };
    // Murene: banens faste kanter og klodser
    bane.mur.forEach(function (m) {
      if (m.b !== undefined) kasseStykker(m.x + m.b / 2, m.y + m.h / 2, m.b, m.h, 0, { hop: m.hop === undefined ? 0.15 : m.hop, gnid: m.gnid === undefined ? 0.25 : m.gnid }).forEach(function (s) { v.stykker.push(s); });
      else v.stykker.push({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, hop: m.hop === undefined ? 0.15 : m.hop, gnid: m.gnid === undefined ? 0.25 : m.gnid });
    });
    // Delene
    v.lagte.forEach(function (d, i) {
      var s = DELE[d.slags];
      if (s.drejer) {
        v.vipper.push({ i: i, x: d.x, y: d.y, b: s.b, h: s.h, vinkel: 0, fart: 0, maks: s.maksVinkel, stil: s });
      } else if (s.kraft) {
        v.blaesere.push({ i: i, x: d.x, y: d.y, vinkel: d.vinkel, kraft: s.kraft, raekke: s.raekke, b: s.b });
      } else {
        var stil = { hop: s.hop, gnid: s.gnid };
        if (s.fart) stil.baand = d.vinkel === 180 ? -s.fart : s.fart;
        kasseStykker(d.x, d.y, s.b, s.h, s.fart ? 0 : d.vinkel, stil).forEach(function (st) { st.del = i; v.stykker.push(st); });
      }
    });
    return v;
  }

  /** Vippens linjestykker ved dens nuvaerende vinkel. */
  function vippeStykker(vp) {
    return kasseStykker(vp.x, vp.y, vp.b, vp.h, vp.vinkel, { hop: vp.stil.hop, gnid: vp.stil.gnid });
  }

  /** Et skridt frem. Kaldes 120 gange i sekundet, ogsaa naar billedet tegnes 60 gange. */
  function trin(v) {
    if (v.loest || v.stoppet) return;
    var k = v.kugle;
    v.tid += DT;

    // Blaesere: skubber kuglen, hvis den er inden for raekkevidde i den retning, de peger
    v.blaesere.forEach(function (b) {
      var rx = Math.sin(grader(b.vinkel)), ry = -Math.cos(grader(b.vinkel));
      var dx = k.x - b.x, dy = k.y - b.y;
      var langs = dx * rx + dy * ry;                       // hvor langt ude i luftstroemmen
      var side = Math.abs(dx * -ry + dy * rx);             // hvor langt til siden
      if (langs > 0 && langs < b.raekke && side < b.b * 0.62) {
        var styrke = b.kraft * (1 - langs / b.raekke) * (1 - side / (b.b * 0.62) * 0.5);
        k.vx += rx * styrke * DT;
        k.vy += ry * styrke * DT;
      }
    });

    k.vy += TYNGDE * DT;
    // Luftmodstand, saa farten ikke loeber loebsk
    k.vx *= 0.9995; k.vy *= 0.9995;
    var fart = Math.hypot(k.vx, k.vy);
    if (fart > MAKS_FART) { k.vx *= MAKS_FART / fart; k.vy *= MAKS_FART / fart; }
    k.x += k.vx * DT;
    k.y += k.vy * DT;

    // Vipperne: tyngden trykker dem tilbage mod vandret, og de daemper
    v.vipper.forEach(function (vp) {
      vp.fart += -vp.vinkel * 7.0 * DT;
      vp.fart *= 0.985;
      vp.vinkel += vp.fart * DT;
      if (vp.vinkel > vp.maks) { vp.vinkel = vp.maks; vp.fart = Math.min(0, vp.fart); }
      if (vp.vinkel < -vp.maks) { vp.vinkel = -vp.maks; vp.fart = Math.max(0, vp.fart); }
    });

    // Kollisioner: tre omgange, saa kuglen ogsaa finder ro i et hjoerne. Farten
    // aendres kun i foerste omgang — ellers ville gnidningen blive lagt paa tre
    // gange pr. skridt, og kuglen kunne slet ikke trille.
    var roert = false;
    for (var omgang = 0; omgang < 3; omgang++) {
      var svar = omgang === 0;
      for (var i = 0; i < v.stykker.length; i++) if (stoed(v, v.stykker[i], null, svar)) roert = true;
      for (var q = 0; q < v.vipper.length; q++) {
        var vp = v.vipper[q], st = vippeStykker(vp);
        for (var j = 0; j < st.length; j++) if (stoed(v, st[j], vp, svar)) roert = true;
      }
    }

    // Uden for banen: kuglen er faldet ud, og maskinen er stoppet
    if (k.y > HOEJDE + 200 || k.x < -200 || k.x > BREDDE + 200) v.stoppet = true;

    // Klokken
    if (v.bane.maal && Math.hypot(k.x - v.bane.maal.x, k.y - v.bane.maal.y) < MAAL_R + k.r) {
      v.loest = true;
      return;
    }

    // Staar kuglen stille laenge nok, er der ikke mere at vente paa
    if (Math.hypot(k.vx, k.vy) < 24 && roert) k.hviler += DT; else k.hviler = 0;
    if (k.hviler > 1.4) v.stoppet = true;
  }

  /**
   * Kuglen mod ét linjestykke. Returnerer sandt, hvis de roerte hinanden.
   * vp er vippen, stykket hoerer til, hvis det er en vippe.
   */
  function stoed(v, st, vp, svar) {
    var k = v.kugle;
    var p = naermest(st, k.x, k.y);
    var dx = k.x - p.x, dy = k.y - p.y;
    var d = Math.hypot(dx, dy);
    if (d >= k.r || d === 0) return false;
    var nx = dx / d, ny = dy / d;
    // Skub kuglen ud af fladen
    k.x += nx * (k.r - d);
    k.y += ny * (k.r - d);
    if (!svar) return true;

    // Fladens egen fart i beroeringspunktet (vippen drejer, baandet loeber)
    var fx = 0, fy = 0;
    if (vp) {
      var ax = p.x - vp.x, ay = p.y - vp.y;
      fx = -ay * vp.fart; fy = ax * vp.fart;
    }
    var rvx = k.vx - fx, rvy = k.vy - fy;
    var vn = rvx * nx + rvy * ny;
    if (vn > 0) return true;                       // paa vej vaek igen

    var tx = -ny, ty = nx;
    var vt = rvx * tx + rvy * ty;
    if (st.baand) vt += (st.baand - vt) * 0.08;    // baandet traekker kuglen op i sin egen fart
    var nyVn = -vn * st.hop;
    if (nyVn < 40) nyVn = 0;                       // smaa hop doer ud, saa kuglen falder til ro
    // Gnidningen er lille pr. skridt: en kugle skal kunne trille et langt stykke
    var nyVt = vt * (1 - st.gnid * 0.006);
    k.vx = fx + nx * nyVn + tx * nyVt;
    k.vy = fy + ny * nyVn + ty * nyVt;
    k.spin = nyVt / k.r;

    if (vp) {
      // Kuglen trykker vippen ned i den side, den ramte
      var arm = (p.x - vp.x) * Math.cos(grader(vp.vinkel)) + (p.y - vp.y) * Math.sin(grader(vp.vinkel));
      // En kugle, der bare ligger yderst, skal kunne tippe vippen helt ned
      vp.fart += arm * (0.02 + Math.max(0, -vn) * 0.00012);
    }
    if (-vn > 120) v.stoed.push({ x: p.x, y: p.y, styrke: Math.min(1, -vn / 700), tid: v.tid });
    return true;
  }

  /**
   * Koer maskinen fra begyndelsen. Bruges af testen og af den soegning, der
   * finder en loesning. Returnerer verdenen, naar den er loest eller stoppet.
   */
  function koer(bane, lagte, maksTid) {
    var v = nyVerden(bane, lagte);
    var maks = (maksTid || 22) / DT;
    for (var i = 0; i < maks && !v.loest && !v.stoppet; i++) trin(v);
    return v;
  }

  /* ---------- baner ---------- */

  /** En kant hele vejen rundt om banen, saa kuglen ikke bare triller ud. */
  function kanter(uden) {
    var ud = [];
    if (uden !== 'venstre') ud.push({ x: -40, y: -200, b: 40, h: HOEJDE + 260 });
    if (uden !== 'hoejre') ud.push({ x: BREDDE, y: -200, b: 40, h: HOEJDE + 260 });
    return ud;
  }

  /**
   * Banerne. mur er faste klodser {x, y, b, h} eller streger {x1, y1, x2, y2}.
   * hylde er de dele, barnet har til raadighed: { slags: antal }.
   * loesning er én maade at klare banen paa; testen gennemspiller den, saa en
   * bane aldrig kan blive umulig.
   */
  var BANER = [
    { navn: 'rampen',
      start: { x: 140, y: 60 }, maal: { x: 560, y: 485 },
      mur: [{ x: 260, y: 520, b: 500, h: 60 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 160, y: 300, vinkel: 20 }] },
    { navn: 'hoppet',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 300 },
      mur: [{ x: 60, y: 460, b: 420, h: 60 }, { x: 520, y: 260, b: 40, h: 260 }, { x: 600, y: 350, b: 400, h: 60 }],
      hylde: { trampolin: 1 },
      loesning: [{ slags: 'trampolin', x: 140, y: 300, vinkel: 22 }] },
    { navn: 'blaesten',
      start: { x: 150, y: 60 }, maal: { x: 500, y: 385 },
      mur: [{ x: 60, y: 520, b: 220, h: 60 }, { x: 340, y: 420, b: 300, h: 60 }],
      hylde: { blaeser: 1 },
      loesning: [{ slags: 'blaeser', x: 80, y: 120, vinkel: 90 }] },
    { navn: 'baandet',
      start: { x: 130, y: 60 }, maal: { x: 880, y: 485 },
      mur: [{ x: 60, y: 520, b: 940, h: 60 }],
      hylde: { baand: 1 },
      loesning: [{ slags: 'baand', x: 220, y: 140, vinkel: 0 }] },
    { navn: 'trappen',
      start: { x: 110, y: 60 }, maal: { x: 860, y: 505 },
      mur: [{ x: 60, y: 260, b: 260, h: 60 }, { x: 360, y: 380, b: 240, h: 60 }, { x: 700, y: 540, b: 300, h: 60 }],
      hylde: { rampe: 2 },
      loesning: [{ slags: 'rampe', x: 640, y: 200, vinkel: 0 }, { slags: 'rampe', x: 80, y: 160, vinkel: 40 }] },
    { navn: 'vippen',
      start: { x: 150, y: 60 }, maal: { x: 820, y: 220 },
      mur: [{ x: 60, y: 420, b: 300, h: 60 }, { x: 560, y: 260, b: 40, h: 300 }, { x: 700, y: 280, b: 300, h: 60 }],
      hylde: { vippe: 1, trampolin: 1 },
      loesning: [{ slags: 'vippe', x: 540, y: 140, vinkel: 0 }, { slags: 'trampolin', x: 160, y: 240, vinkel: 22 }] },
    { navn: 'klodsen',
      start: { x: 500, y: 60 }, maal: { x: 120, y: 480 },
      mur: [{ x: 60, y: 540, b: 300, h: 60 }, { x: 700, y: 400, b: 300, h: 60 }],
      hylde: { rampe: 1, klods: 1 },
      loesning: [{ slags: 'rampe', x: 480, y: 240, vinkel: -40 }, { slags: 'klods', x: 360, y: 460, vinkel: 0 }] },
    { navn: 'blaeser-og-rampe',
      start: { x: 160, y: 60 }, maal: { x: 500, y: 540 },
      mur: [{ x: 60, y: 240, b: 220, h: 60 }, { x: 400, y: 590, b: 240, h: 60 }, { x: 320, y: 380, b: 40, h: 220 }],
      hylde: { rampe: 1, blaeser: 1 },
      loesning: [{ slags: 'rampe', x: 220, y: 140, vinkel: 20 }, { slags: 'blaeser', x: 200, y: 460, vinkel: 90 }] },
    { navn: 'baand-og-hop',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 180 },
      mur: [{ x: 60, y: 400, b: 340, h: 60 }, { x: 700, y: 240, b: 300, h: 60 }],
      hylde: { baand: 1, trampolin: 1 },
      loesning: [{ slags: 'baand', x: 620, y: 480, vinkel: 0 }, { slags: 'trampolin', x: 120, y: 280, vinkel: 22 }] },
    { navn: 'lang-vej',
      start: { x: 110, y: 60 }, maal: { x: 880, y: 445 },
      mur: [{ x: 60, y: 240, b: 240, h: 60 }, { x: 420, y: 300, b: 40, h: 320 }, { x: 640, y: 480, b: 360, h: 60 }],
      hylde: { rampe: 2, trampolin: 1 },
      loesning: [{ slags: 'rampe', x: 200, y: 460, vinkel: 40 }, { slags: 'rampe', x: 700, y: 200, vinkel: 40 }, { slags: 'trampolin', x: 160, y: 140, vinkel: 22 }] },
    { navn: 'over-muren',
      start: { x: 140, y: 60 }, maal: { x: 860, y: 480 },
      mur: [{ x: 60, y: 420, b: 300, h: 60 }, { x: 480, y: 200, b: 40, h: 420 }, { x: 700, y: 530, b: 300, h: 60 }],
      hylde: { rampe: 1, trampolin: 1, blaeser: 1 },
      loesning: [{ slags: 'rampe', x: 660, y: 180, vinkel: -20 }, { slags: 'trampolin', x: 160, y: 260, vinkel: 22 }, { slags: 'blaeser', x: 280, y: 140, vinkel: 180 }] },
    { navn: 'hele-maskinen',
      start: { x: 120, y: 60 }, maal: { x: 520, y: 540 },
      mur: [{ x: 60, y: 280, b: 220, h: 60 }, { x: 820, y: 300, b: 180, h: 60 }, { x: 400, y: 590, b: 240, h: 60 }, { x: 300, y: 420, b: 40, h: 180 }],
      hylde: { rampe: 1, baand: 1, vippe: 1 },
      loesning: [{ slags: 'rampe', x: 900, y: 120, vinkel: 40 }, { slags: 'baand', x: 180, y: 140, vinkel: 0 }, { slags: 'vippe', x: 640, y: 260, vinkel: 0 }] }
  ];

  /** Fri leg: en tom bane med alle dele og ingen klokke. Her bygger man bare. */
  var FRI = {
    navn: 'fri', fri: true,
    start: { x: 120, y: 60 }, maal: null,
    mur: [{ x: 60, y: 560, b: 880, h: 60 }],
    hylde: { rampe: 4, trampolin: 3, klods: 3, baand: 2, blaeser: 2, vippe: 2 },
    loesning: []
  };

  rod.Fysik = {
    BREDDE: BREDDE, HOEJDE: HOEJDE, TYNGDE: TYNGDE, DT: DT, GITTER: GITTER, KUGLE_R: KUGLE_R, MAAL_R: MAAL_R,
    DELE: DELE, DELNAVNE: DELNAVNE, BANER: BANER, FRI: FRI,
    grader: grader, kasseStykker: kasseStykker, naermest: naermest, kanter: kanter,
    nyVerden: nyVerden, vippeStykker: vippeStykker, trin: trin, koer: koer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
