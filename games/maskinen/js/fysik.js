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
    vippe:     { b: 210, h: 14, hop: 0.15, gnid: 0.45, drejer: true, maksVinkel: 26, vinkler: [0] },
    // Kanonen fanger kuglen og skyder den af sted i den retning, den peger:
    // 0 op, 90 hoejre, 180 ned, 270 venstre. Den skyder én gang pr. koersel.
    kanon:     { b: 76, h: 44, skyder: true, fart: 980, vinkler: [45, 90, 135, 180, 225, 270, 315, 0] },
    // Tragten fanger kuglen oppefra og sender den ud af tuden: 0 lige ned, 90 til hoejre, 270 til venstre.
    tragt:     { b: 96, h: 64, fanger: true, fart: 340, vinkler: [0, 90, 270] }
  };
  var DELNAVNE_GRUND = ['rampe', 'trampolin', 'klods', 'baand', 'blaeser', 'vippe'];

  /**
   * Hvad murene er lavet af. Trae er det almindelige. Is er glat, saa kuglen
   * glider langt. Sne bremser den. Aakandebladet er bloedt og kaster kuglen
   * op igen. Sten er haard og lidt sprael.
   */
  var STOF = {
    trae:    { hop: 0.15, gnid: 0.25 },
    is:      { hop: 0.06, gnid: 0.01 },
    sne:     { hop: 0.02, gnid: 0.9 },
    aakande: { hop: 0.95, gnid: 0.2 },
    sten:    { hop: 0.3, gnid: 0.3 }
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
      tid: 0, loest: false, stoppet: false, vipper: [], blaesere: [], kanoner: [], tragte: [], stykker: [], spor: [], stoed: []
    };
    // Murene: banens faste kanter, klodser og grene. Stoffet bestemmer hop og gnid.
    bane.mur.forEach(function (m) {
      var st = STOF[m.stof || 'trae'];
      var stil = { hop: m.hop === undefined ? st.hop : m.hop, gnid: m.gnid === undefined ? st.gnid : m.gnid };
      if (m.b !== undefined) kasseStykker(m.x + m.b / 2, m.y + m.h / 2, m.b, m.h, 0, stil).forEach(function (s) { v.stykker.push(s); });
      else v.stykker.push({ x1: m.x1, y1: m.y1, x2: m.x2, y2: m.y2, hop: stil.hop, gnid: stil.gnid });
    });
    // Delene
    v.lagte.forEach(function (d, i) {
      var s = DELE[d.slags];
      if (s.drejer) {
        v.vipper.push({ i: i, x: d.x, y: d.y, b: s.b, h: s.h, vinkel: 0, fart: 0, maks: s.maksVinkel, stil: s });
      } else if (s.kraft) {
        v.blaesere.push({ i: i, x: d.x, y: d.y, vinkel: d.vinkel, kraft: s.kraft, raekke: s.raekke, b: s.b });
      } else if (s.skyder) {
        v.kanoner.push({ i: i, x: d.x, y: d.y, vinkel: d.vinkel, fart: s.fart, b: s.b, h: s.h, skudt: false, lader: 0 });
      } else if (s.fanger) {
        v.tragte.push({ i: i, x: d.x, y: d.y, b: s.b, h: s.h, vinkel: d.vinkel, fart: s.fart, fanget: 0 });
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

    // Kanoner: kommer kuglen ind i kanonen, holdes den et oejeblik og skydes saa af sted
    for (var ki = 0; ki < v.kanoner.length; ki++) {
      var ka = v.kanoner[ki];
      if (ka.skudt) continue;
      if (ka.lader > 0) {
        ka.lader -= DT;
        k.x = ka.x; k.y = ka.y; k.vx = 0; k.vy = 0;
        if (ka.lader <= 0) {
          var kx = Math.sin(grader(ka.vinkel)), ky = -Math.cos(grader(ka.vinkel));
          k.x = ka.x + kx * (ka.b * 0.5 + k.r); k.y = ka.y + ky * (ka.b * 0.5 + k.r);
          k.vx = kx * ka.fart; k.vy = ky * ka.fart;
          ka.skudt = true;
          v.stoed.push({ x: k.x, y: k.y, styrke: 1, tid: v.tid, kanon: true });
        }
        return;
      }
      if (Math.hypot(k.x - ka.x, k.y - ka.y) < ka.b * 0.5) { ka.lader = 0.45; k.vx = 0; k.vy = 0; k.x = ka.x; k.y = ka.y; return; }
    }
    // Tragte: rammer kuglen aabningen oppefra, glider den ned og falder ud af tuden
    for (var ti = 0; ti < v.tragte.length; ti++) {
      var tr = v.tragte[ti];
      if (tr.fanget > 0) {
        tr.fanget -= DT;
        k.x = tr.x; k.y = tr.y; k.vx = 0; k.vy = 0;
        if (tr.fanget <= 0) {
          if (tr.vinkel === 90) { k.x = tr.x + tr.b * 0.5 + k.r; k.y = tr.y + tr.h * 0.3; k.vx = tr.fart; k.vy = 0; }
          else if (tr.vinkel === 270) { k.x = tr.x - tr.b * 0.5 - k.r; k.y = tr.y + tr.h * 0.3; k.vx = -tr.fart; k.vy = 0; }
          else { k.y = tr.y + tr.h * 0.5 + k.r + 1; k.vy = 60; }
        }
        return;
      }
      if (k.vy >= 0 && Math.abs(k.x - tr.x) < tr.b * 0.5 && k.y > tr.y - tr.h * 0.5 - k.r && k.y < tr.y + tr.h * 0.2) {
        tr.fanget = 0.3; k.x = tr.x; k.y = tr.y; k.vx = 0; k.vy = 0;
        v.stoed.push({ x: tr.x, y: tr.y, styrke: 0.4, tid: v.tid });
        return;
      }
    }

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
   * Kapitlerne: hvor i Noeddeskoven banen foregaar. Kuglen skifter med stedet
   * (aeble, kastanje, snebold, lygte), og skaermen tegner himmel og pynt efter
   * kapitlet. Intet er laast: alle kapitler kan vaelges fra start.
   */
  var KAPITLER = [
    { id: 'engen',  kugle: 'aeble' },
    { id: 'skoven', kugle: 'aeble' },
    { id: 'soeen',  kugle: 'kastanje' },
    { id: 'vinter', kugle: 'snebold' },
    { id: 'natten', kugle: 'lygte' }
  ];
  /** Banerne i et kapitel, i raekkefoelge. */
  function banerI(kapitel) { return BANER.filter(function (b) { return b.kapitel === kapitel; }); }

  /**
   * Banerne. mur er faste klodser {x, y, b, h} eller streger {x1, y1, x2, y2},
   * begge med et stof (trae, is, sne, aakande, sten), der giver hop og gnid.
   * hylde er de dele, barnet har til raadighed: { slags: antal }.
   * loesning er én maade at klare banen paa; testen gennemspiller den, saa en
   * bane aldrig kan blive umulig.
   */
  var BANER = [
    { navn: 'rampen', kapitel: 'engen',
      start: { x: 140, y: 60 }, maal: { x: 560, y: 485 },
      mur: [{ x: 260, y: 520, b: 500, h: 60 }],
      pladser: [{ x: 160, y: 300, vinkel: 20 }, { x: 420, y: 200, vinkel: 20 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 160, y: 300, vinkel: 20 }] },
    { navn: 'hoppet', kapitel: 'engen',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 300 },
      mur: [{ x: 60, y: 460, b: 420, h: 60 }, { x: 520, y: 260, b: 40, h: 260 }, { x: 600, y: 350, b: 400, h: 60 }],
      pladser: [{ x: 140, y: 300, vinkel: 22 }, { x: 680, y: 200, vinkel: 22 }],
      hylde: { trampolin: 1 },
      loesning: [{ slags: 'trampolin', x: 140, y: 300, vinkel: 22 }] },
    { navn: 'blaesten', kapitel: 'engen',
      start: { x: 150, y: 60 }, maal: { x: 500, y: 385 },
      mur: [{ x: 60, y: 520, b: 220, h: 60 }, { x: 340, y: 420, b: 300, h: 60 }],
      pladser: [{ x: 80, y: 120, vinkel: 90 }, { x: 200, y: 400, vinkel: 90 }],
      hylde: { blaeser: 1 },
      loesning: [{ slags: 'blaeser', x: 80, y: 120, vinkel: 90 }] },
    { navn: 'baandet', kapitel: 'engen',
      start: { x: 130, y: 60 }, maal: { x: 880, y: 485 },
      mur: [{ x: 60, y: 520, b: 940, h: 60 }],
      pladser: [{ x: 220, y: 140, vinkel: 0 }, { x: 580, y: 200, vinkel: 0 }],
      hylde: { baand: 1 },
      loesning: [{ slags: 'baand', x: 220, y: 140, vinkel: 0 }] },
    { navn: 'trappen', kapitel: 'engen',
      start: { x: 110, y: 60 }, maal: { x: 860, y: 505 },
      mur: [{ x: 60, y: 260, b: 260, h: 60 }, { x: 360, y: 380, b: 240, h: 60 }, { x: 700, y: 540, b: 300, h: 60 }],
      pladser: [{ x: 80, y: 160, vinkel: 40 }, { x: 640, y: 200, vinkel: 0 }, { x: 760, y: 320, vinkel: 0 }],
      hylde: { rampe: 2 },
      loesning: [{ slags: 'rampe', x: 640, y: 200, vinkel: 0 }, { slags: 'rampe', x: 80, y: 160, vinkel: 40 }] },
    { navn: 'vippen', kapitel: 'engen',
      start: { x: 150, y: 60 }, maal: { x: 820, y: 220 },
      mur: [{ x: 60, y: 420, b: 300, h: 60 }, { x: 560, y: 260, b: 40, h: 300 }, { x: 700, y: 280, b: 300, h: 60 }],
      pladser: [{ x: 160, y: 240, vinkel: 22 }, { x: 320, y: 300, vinkel: 0 }, { x: 540, y: 140, vinkel: 0 }],
      hylde: { vippe: 1, trampolin: 1 },
      loesning: [{ slags: 'vippe', x: 540, y: 140, vinkel: 0 }, { slags: 'trampolin', x: 160, y: 240, vinkel: 22 }] },
    { navn: 'klodsen', kapitel: 'engen',
      start: { x: 500, y: 60 }, maal: { x: 120, y: 480 },
      mur: [{ x: 60, y: 540, b: 300, h: 60 }, { x: 700, y: 400, b: 300, h: 60 }],
      pladser: [{ x: 360, y: 460, vinkel: 0 }, { x: 480, y: 240, vinkel: -40 }, { x: 760, y: 280, vinkel: -40 }],
      hylde: { rampe: 1, klods: 1 },
      loesning: [{ slags: 'rampe', x: 480, y: 240, vinkel: -40 }, { slags: 'klods', x: 360, y: 460, vinkel: 0 }] },
    { navn: 'blaeser-og-rampe', kapitel: 'engen',
      start: { x: 160, y: 60 }, maal: { x: 500, y: 540 },
      mur: [{ x: 60, y: 240, b: 220, h: 60 }, { x: 400, y: 590, b: 240, h: 60 }, { x: 320, y: 380, b: 40, h: 220 }],
      pladser: [{ x: 200, y: 460, vinkel: 90 }, { x: 220, y: 140, vinkel: 20 }, { x: 660, y: 220, vinkel: 20 }],
      hylde: { rampe: 1, blaeser: 1 },
      loesning: [{ slags: 'rampe', x: 220, y: 140, vinkel: 20 }, { slags: 'blaeser', x: 200, y: 460, vinkel: 90 }] },
    { navn: 'baand-og-hop', kapitel: 'engen',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 180 },
      mur: [{ x: 60, y: 400, b: 340, h: 60 }, { x: 700, y: 240, b: 300, h: 60 }],
      pladser: [{ x: 120, y: 280, vinkel: 22 }, { x: 620, y: 480, vinkel: 0 }, { x: 620, y: 260, vinkel: 0 }],
      hylde: { baand: 1, trampolin: 1 },
      loesning: [{ slags: 'baand', x: 620, y: 480, vinkel: 0 }, { slags: 'trampolin', x: 120, y: 280, vinkel: 22 }] },
    { navn: 'lang-vej', kapitel: 'engen',
      start: { x: 110, y: 60 }, maal: { x: 880, y: 445 },
      mur: [{ x: 60, y: 240, b: 240, h: 60 }, { x: 420, y: 300, b: 40, h: 320 }, { x: 640, y: 480, b: 360, h: 60 }],
      pladser: [{ x: 80, y: 320, vinkel: 20 }, { x: 80, y: 220, vinkel: 22 }, { x: 560, y: 320, vinkel: 40 }, { x: 780, y: 160, vinkel: 20 }],
      hylde: { rampe: 2, trampolin: 1 },
      loesning: [{ slags: 'rampe', x: 80, y: 320, vinkel: 20 }, { slags: 'rampe', x: 560, y: 320, vinkel: 40 }, { slags: 'trampolin', x: 80, y: 220, vinkel: 22 }] },
    { navn: 'over-muren', kapitel: 'engen',
      start: { x: 140, y: 60 }, maal: { x: 860, y: 480 },
      mur: [{ x: 60, y: 420, b: 300, h: 60 }, { x: 480, y: 200, b: 40, h: 420 }, { x: 700, y: 530, b: 300, h: 60 }],
      pladser: [{ x: 140, y: 220, vinkel: 22 }, { x: 340, y: 340, vinkel: 40 }, { x: 520, y: 320, vinkel: 40 }],
      hylde: { rampe: 1, trampolin: 1 },
      loesning: [{ slags: 'rampe', x: 520, y: 320, vinkel: 40 }, { slags: 'trampolin', x: 140, y: 220, vinkel: 22 }] },
    { navn: 'hele-maskinen', kapitel: 'engen',
      start: { x: 120, y: 60 }, maal: { x: 520, y: 540 },
      mur: [{ x: 60, y: 280, b: 220, h: 60 }, { x: 820, y: 300, b: 180, h: 60 }, { x: 400, y: 590, b: 240, h: 60 }, { x: 300, y: 420, b: 40, h: 180 }],
      pladser: [{ x: 180, y: 140, vinkel: 0 }, { x: 420, y: 440, vinkel: 40 }, { x: 640, y: 260, vinkel: 0 }, { x: 900, y: 120, vinkel: 40 }],
      hylde: { rampe: 1, baand: 1, vippe: 1 },
      loesning: [{ slags: 'rampe', x: 900, y: 120, vinkel: 40 }, { slags: 'baand', x: 180, y: 140, vinkel: 0 }, { slags: 'vippe', x: 640, y: 260, vinkel: 0 }] },

    /* Skoven: grene at trille paa */
    { navn: 'grenen', kapitel: 'skoven',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 485 },
      mur: [{ x1: 60, y1: 300, x2: 380, y2: 380 }, { x: 620, y: 520, b: 380, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 460, y: 440, vinkel: 0 }, { x: 780, y: 140, vinkel: 0 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 460, y: 440, vinkel: 0 }] },
    { navn: 'to-grene', kapitel: 'skoven',
      start: { x: 120, y: 60 }, maal: { x: 140, y: 555 },
      mur: [{ x1: 60, y1: 200, x2: 400, y2: 290 }, { x1: 940, y1: 330, x2: 560, y2: 420 }, { x: 60, y: 590, b: 260, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 200, y: 340, vinkel: -40 }, { x: 460, y: 380, vinkel: -40 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 460, y: 380, vinkel: -40 }] },
    { navn: 'hulen', kapitel: 'skoven',
      start: { x: 130, y: 60 }, maal: { x: 880, y: 425 },
      mur: [{ x: 60, y: 260, b: 240, h: 60 }, { x: 420, y: 440, b: 40, h: 180 }, { x: 620, y: 460, b: 380, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 80, y: 240, vinkel: 90 }, { x: 280, y: 420, vinkel: 90 }],
      hylde: { blaeser: 1 },
      loesning: [{ slags: 'blaeser', x: 80, y: 240, vinkel: 90 }] },
    { navn: 'svampene', kapitel: 'skoven',
      start: { x: 860, y: 60 }, maal: { x: 140, y: 505 },
      mur: [{ x: 620, y: 300, b: 380, h: 60 }, { x: 60, y: 540, b: 580, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 180, y: 120, vinkel: -40 }, { x: 400, y: 520, vinkel: 180 }, { x: 840, y: 160, vinkel: -40 }],
      hylde: { rampe: 1, baand: 1 },
      loesning: [{ slags: 'rampe', x: 840, y: 160, vinkel: -40 }, { slags: 'baand', x: 400, y: 520, vinkel: 180 }] },
    { navn: 'ned-ad-stammen', kapitel: 'skoven',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 545 },
      mur: [{ x1: 60, y1: 230, x2: 320, y2: 300 }, { x: 560, y: 320, b: 40, h: 300 }, { x: 660, y: 580, b: 340, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 420, y: 380, vinkel: 0 }, { x: 820, y: 220, vinkel: 0 }],
      hylde: { trampolin: 1 },
      loesning: [{ slags: 'trampolin', x: 420, y: 380, vinkel: 0 }] },
    { navn: 'skovens-maskine', kapitel: 'skoven',
      start: { x: 500, y: 60 }, maal: { x: 120, y: 555 },
      mur: [{ x1: 200, y1: 260, x2: 560, y2: 340 }, { x: 560, y: 420, b: 440, h: 60 }, { x: 60, y: 590, b: 260, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 400, y: 160, vinkel: 180 }, { x: 460, y: 480, vinkel: 0 }, { x: 640, y: 400, vinkel: 180 }],
      hylde: { baand: 1, rampe: 1 },
      loesning: [{ slags: 'baand', x: 640, y: 400, vinkel: 180 }, { slags: 'rampe', x: 460, y: 480, vinkel: 0 }] },
    /* Soeen: aakandeblade der kaster kuglen op, og tragten der fanger den */
    { navn: 'aakanden', kapitel: 'soeen',
      start: { x: 120, y: 60 }, maal: { x: 760, y: 265 },
      mur: [{ x: 300, y: 520, b: 120, h: 16, stof: 'aakande' }, { x: 620, y: 300, b: 380, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 120, y: 180, vinkel: 40 }, { x: 180, y: 440, vinkel: 40 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 120, y: 180, vinkel: 40 }] },
    { navn: 'sivene', kapitel: 'soeen',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 505 },
      mur: [{ x: 60, y: 400, b: 300, h: 60 }, { x: 500, y: 200, b: 20, h: 200 }, { x: 560, y: 540, b: 440, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 120, y: 340, vinkel: 40 }, { x: 660, y: 380, vinkel: 40 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 120, y: 340, vinkel: 40 }] },
    { navn: 'tragten', kapitel: 'soeen',
      start: { x: 150, y: 60 }, maal: { x: 660, y: 425 },
      mur: [{ x: 60, y: 560, b: 220, h: 60 }, { x: 340, y: 460, b: 660, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 140, y: 240, vinkel: 90 }, { x: 300, y: 180, vinkel: 90 }],
      hylde: { tragt: 1 },
      loesning: [{ slags: 'tragt', x: 140, y: 240, vinkel: 90 }] },
    { navn: 'over-vandet', kapitel: 'soeen',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 265 },
      mur: [{ x: 80, y: 520, b: 120, h: 16, stof: 'aakande' }, { x: 440, y: 480, b: 120, h: 16, stof: 'aakande' }, { x: 760, y: 300, b: 240, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 120, y: 300, vinkel: 22 }, { x: 620, y: 360, vinkel: 22 }, { x: 820, y: 500, vinkel: 22 }],
      hylde: { trampolin: 2 },
      loesning: [{ slags: 'trampolin', x: 120, y: 300, vinkel: 22 }, { slags: 'trampolin', x: 620, y: 360, vinkel: 22 }] },
    { navn: 'froens-hop', kapitel: 'soeen',
      start: { x: 860, y: 60 }, maal: { x: 140, y: 425 },
      mur: [{ x1: 1000, y1: 280, x2: 660, y2: 340 }, { x: 420, y: 520, b: 120, h: 16, stof: 'aakande' }, { x: 60, y: 400, b: 200, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 300, y: 380, vinkel: 0 }, { x: 720, y: 480, vinkel: 0 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 300, y: 380, vinkel: 0 }] },
    { navn: 'soeens-maskine', kapitel: 'soeen',
      start: { x: 140, y: 60 }, maal: { x: 900, y: 325 },
      mur: [{ x1: 60, y1: 200, x2: 300, y2: 260 }, { x: 480, y: 440, b: 40, h: 180 }, { x: 560, y: 520, b: 120, h: 16, stof: 'aakande' }, { x: 820, y: 360, b: 180, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 340, y: 240, vinkel: 90 }, { x: 760, y: 380, vinkel: 90 }],
      hylde: { tragt: 1 },
      loesning: [{ slags: 'tragt', x: 340, y: 240, vinkel: 90 }] },
    /* Vinter: is der er glat, sne der bremser, og kanonen */
    { navn: 'isen', kapitel: 'vinter',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 505 },
      mur: [{ x: 60, y: 540, b: 940, h: 40, stof: 'is' }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 80, y: 360, vinkel: 20 }, { x: 420, y: 320, vinkel: 20 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 80, y: 360, vinkel: 20 }] },
    { navn: 'snedriven', kapitel: 'vinter',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 445 },
      mur: [{ x: 60, y: 380, b: 500, h: 40, stof: 'is' }, { x: 620, y: 480, b: 380, h: 60, stof: 'sne' }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 100, y: 140, vinkel: 22 }, { x: 780, y: 300, vinkel: 22 }],
      hylde: { trampolin: 1 },
      loesning: [{ slags: 'trampolin', x: 100, y: 140, vinkel: 22 }] },
    { navn: 'kanonen', kapitel: 'vinter',
      start: { x: 150, y: 60 }, maal: { x: 900, y: 445 },
      mur: [{ x: 60, y: 300, b: 240, h: 60 }, { x: 480, y: 260, b: 40, h: 360 }, { x: 640, y: 480, b: 360, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 140, y: 120, vinkel: 90 }, { x: 820, y: 320, vinkel: 90 }],
      hylde: { kanon: 1 },
      loesning: [{ slags: 'kanon', x: 140, y: 120, vinkel: 90 }] },
    { navn: 'is-og-kanon', kapitel: 'vinter',
      start: { x: 860, y: 60 }, maal: { x: 140, y: 385 },
      mur: [{ x: 560, y: 340, b: 440, h: 40, stof: 'is' }, { x: 420, y: 200, b: 40, h: 420 }, { x: 60, y: 420, b: 240, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 160, y: 160, vinkel: -20 }, { x: 620, y: 240, vinkel: 315 }, { x: 800, y: 160, vinkel: -20 }],
      hylde: { kanon: 1, rampe: 1 },
      loesning: [{ slags: 'rampe', x: 800, y: 160, vinkel: -20 }, { slags: 'kanon', x: 620, y: 240, vinkel: 315 }] },
    { navn: 'skiloebet', kapitel: 'vinter',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 545 },
      mur: [{ x1: 60, y1: 220, x2: 420, y2: 340, stof: 'is' }, { x1: 940, y1: 380, x2: 600, y2: 470, stof: 'is' }, { x: 640, y: 580, b: 360, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 160, y: 440, vinkel: 20 }, { x: 580, y: 520, vinkel: 20 }],
      hylde: { rampe: 1 },
      loesning: [{ slags: 'rampe', x: 580, y: 520, vinkel: 20 }] },
    { navn: 'vinterens-maskine', kapitel: 'vinter',
      start: { x: 140, y: 60 }, maal: { x: 520, y: 545 },
      mur: [{ x: 60, y: 280, b: 320, h: 40, stof: 'is' }, { x: 760, y: 300, b: 240, h: 60, stof: 'sne' }, { x: 420, y: 580, b: 200, h: 60 }, { x: 300, y: 400, b: 40, h: 220 }, { x: 680, y: 400, b: 40, h: 220 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 100, y: 120, vinkel: 20 }, { x: 520, y: 220, vinkel: 180 }, { x: 700, y: 240, vinkel: 20 }],
      hylde: { kanon: 1, rampe: 1 },
      loesning: [{ slags: 'rampe', x: 100, y: 120, vinkel: 20 }, { slags: 'kanon', x: 520, y: 220, vinkel: 180 }] },
    /* Natten: alt paa én gang, i moerket */
    { navn: 'lygten', kapitel: 'natten',
      start: { x: 120, y: 60 }, maal: { x: 860, y: 465 },
      mur: [{ x: 60, y: 300, b: 240, h: 60 }, { x: 640, y: 500, b: 360, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 120, y: 240, vinkel: 40 }, { x: 460, y: 380, vinkel: 0 }, { x: 680, y: 300, vinkel: 40 }],
      hylde: { rampe: 2 },
      loesning: [{ slags: 'rampe', x: 120, y: 240, vinkel: 40 }, { slags: 'rampe', x: 460, y: 380, vinkel: 0 }] },
    { navn: 'uglehullet', kapitel: 'natten',
      start: { x: 500, y: 60 }, maal: { x: 140, y: 545 },
      mur: [{ x: 360, y: 260, b: 280, h: 60 }, { x: 60, y: 580, b: 260, h: 60 }, { x: 340, y: 380, b: 40, h: 240 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 140, y: 400, vinkel: 0 }, { x: 400, y: 180, vinkel: 270 }, { x: 660, y: 220, vinkel: 270 }],
      hylde: { blaeser: 1, tragt: 1 },
      loesning: [{ slags: 'blaeser', x: 660, y: 220, vinkel: 270 }, { slags: 'tragt', x: 140, y: 400, vinkel: 0 }] },
    { navn: 'stjerneskud', kapitel: 'natten',
      start: { x: 120, y: 60 }, maal: { x: 880, y: 225 },
      mur: [{ x: 60, y: 340, b: 240, h: 60 }, { x: 500, y: 120, b: 40, h: 500 }, { x: 740, y: 260, b: 260, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 100, y: 280, vinkel: 45 }, { x: 320, y: 420, vinkel: 225 }, { x: 440, y: 280, vinkel: 45 }],
      hylde: { kanon: 2 },
      loesning: [{ slags: 'kanon', x: 100, y: 280, vinkel: 45 }, { slags: 'kanon', x: 320, y: 420, vinkel: 225 }] },
    { navn: 'maanen', kapitel: 'natten',
      start: { x: 860, y: 60 }, maal: { x: 140, y: 245 },
      mur: [{ x: 620, y: 360, b: 380, h: 60 }, { x: 440, y: 160, b: 40, h: 460 }, { x: 60, y: 280, b: 260, h: 60 }, { x: -40, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 560, y: 180, vinkel: 315 }, { x: 880, y: 360, vinkel: 315 }],
      hylde: { kanon: 1 },
      loesning: [{ slags: 'kanon', x: 880, y: 360, vinkel: 315 }] },
    { navn: 'moerket', kapitel: 'natten',
      start: { x: 140, y: 60 }, maal: { x: 860, y: 545 },
      mur: [{ x: 60, y: 260, b: 300, h: 60 }, { x: 400, y: 420, b: 200, h: 40, stof: 'sten' }, { x: 640, y: 580, b: 360, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 100, y: 120, vinkel: 40 }, { x: 320, y: 400, vinkel: 40 }, { x: 500, y: 400, vinkel: 0 }],
      hylde: { baand: 1, rampe: 1 },
      loesning: [{ slags: 'rampe', x: 100, y: 120, vinkel: 40 }, { slags: 'baand', x: 500, y: 400, vinkel: 0 }] },
    { navn: 'den-store-maskine', kapitel: 'natten',
      start: { x: 120, y: 60 }, maal: { x: 500, y: 545 },
      mur: [{ x: 60, y: 240, b: 220, h: 60 }, { x: 780, y: 240, b: 220, h: 60 }, { x: 300, y: 380, b: 40, h: 240 }, { x: 660, y: 380, b: 40, h: 240 }, { x: 400, y: 580, b: 200, h: 60 }, { x: 1000, y: -200, b: 40, h: 880 }],
      pladser: [{ x: 80, y: 120, vinkel: 20 }, { x: 260, y: 340, vinkel: 135 }, { x: 500, y: 400, vinkel: 0 }, { x: 720, y: 200, vinkel: 20 }],
      hylde: { kanon: 1, tragt: 1, rampe: 1 },
      loesning: [{ slags: 'rampe', x: 80, y: 120, vinkel: 20 }, { slags: 'kanon', x: 260, y: 340, vinkel: 135 }, { slags: 'tragt', x: 500, y: 400, vinkel: 0 }] }
  ];

  /** Fri leg: en tom bane med alle dele og ingen klokke. Her bygger man bare. */
  var FRI = {
    navn: 'fri', fri: true, kapitel: 'engen',
    start: { x: 120, y: 60 }, maal: null,
    mur: [{ x: 60, y: 560, b: 880, h: 60 }],
    hylde: { rampe: 4, trampolin: 3, klods: 3, baand: 2, blaeser: 2, vippe: 2, kanon: 2, tragt: 2 },
    loesning: []
  };

  rod.Fysik = {
    BREDDE: BREDDE, HOEJDE: HOEJDE, TYNGDE: TYNGDE, DT: DT, GITTER: GITTER, KUGLE_R: KUGLE_R, MAAL_R: MAAL_R,
    DELE: DELE, DELNAVNE: DELNAVNE, STOF: STOF, KAPITLER: KAPITLER, BANER: BANER, FRI: FRI, banerI: banerI,
    grader: grader, kasseStykker: kasseStykker, naermest: naermest, kanter: kanter,
    nyVerden: nyVerden, vippeStykker: vippeStykker, trin: trin, koer: koer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
