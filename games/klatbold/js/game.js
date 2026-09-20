/**
 * Boldbanen.
 *
 * To klatter, én bold, to maal. Hold fingeren i venstre eller hoejre side
 * af din del af skaermen for at loebe, midten for at hoppe.
 *
 * Denne fil er kun skaerm og lyd. Fysik og AI ligger i js/physics.js.
 */
(function () {
  'use strict';

  var INDSTIL = Klatbold.INDSTIL;

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, b, h, r) {
      r = Math.min(r, b / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + b, y, x + b, y + h, r);
      this.arcTo(x + b, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + b, y, r);
      this.closePath();
    };
  }

  // Malede farver. Hver klat har en lys top, sin grundfarve og en dyb bund.
  // Grundfarven (lak) bruges ogsaa paa knappen og maalcirklerne, saa barnet
  // kan se hvilken klat der er dets.
  var FARVER = [
    { navn: 'Rød',   lys: '#f6a68d', lak: '#e4644a', moerk: '#a83a24' },
    { navn: 'Blå',   lys: '#9ad2f0', lak: '#3f9ad6', moerk: '#23648f' },
    { navn: 'Grøn',  lys: '#c3e08e', lak: '#7ab648', moerk: '#4a7a2c' },
    { navn: 'Gul',   lys: '#ffe2a0', lak: '#f2c14e', moerk: '#c48f24' },
    { navn: 'Lilla', lys: '#d3bff2', lak: '#9b7bd4', moerk: '#654a9c' },
    { navn: 'Pink',  lys: '#fbc9dc', lak: '#ef94b8', moerk: '#c25f88' }
  ];
  var FJAES = ['glad', 'sej', 'soed'];

  // Malet palet til banen. Samme toner som i Maskinen, saa spillene ligner hinanden.
  var P = {
    himmelTop: '#8fc7e8', himmelBund: '#dfeef0',
    sol: '#ffdf9e', solKant: 'rgba(255,214,120,0)',
    graesLys: '#93bc63', graesDyb: '#5d8240', straa: '#4d7a3c',
    traeLys: '#f0dcb8', trae: '#d9ba8a', traeM: '#b18a56', traeDyb: '#8a663d',
    blaek: '#4a3a2c', kridt: '#f8f0e0'
  };

  // Kun i hukommelsen. Intet gemmes om boernene.
  var valg = [
    { farve: 0, form: 0 },
    { farve: 1, form: 0 }
  ];
  var svaerhed = 0;
  var lydTil = true;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');
  var styring = new Styring(lærred);

  var kamp = null;
  var tilstand = 'venter';     // venter | spiller | faerdig
  var antalSpillere = 1;
  var udseende = [null, null]; // farve/fjaes pr. klat, ogsaa AI'ens
  var sidsteTid = 0;
  var lyd = null;
  var maalTekst = 0;           // sekunder tilbage hvor "MÅL!" vises
  var maalFarve = '#fff';
  var squash = [0, 0];         // sekunder tilbage af landings-squash pr. klat
  var humoer = [0, 0];         // +1 glad, -1 sur, med tid tilbage i humoerTid
  var humoerTid = [0, 0];
  var hale = [];               // boldens seneste positioner, til en hale i fart
  var partikler = [];
  var vinderCanvas = null;
  var konfetti = [];
  var visning = { skala: 1, ox: 0, oy: 0 };

  /* ---------- lyd ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();      // iOS bruger ogsaa 'interrupted', fx efter et opkald
    return lyd;
  }
  // iOS laaser kun lyden op i et rigtigt tryk (touchend eller click), ikke i pointerdown, en timer
  // eller et svar fra fetch. Derfor vaekkes lyden ved hvert tryk, uanset hvad der ellers sker.
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });

  function tone(frekvens, længde, styrke, type) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination);
      o.start();
      o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }

  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum);
    });
  }

  function floejt() {
    tone(1800, 0.25, 0.1, 'square');
    setTimeout(function () { tone(1800, 0.4, 0.1, 'square'); }, 280);
  }

  /* ---------- laerred og zoner ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    var B = window.innerWidth, H = window.innerHeight;
    visning.skala = Math.min(B / INDSTIL.bredde, H / (INDSTIL.hoejde + 90));
    visning.ox = (B - INDSTIL.bredde * visning.skala) / 2;
    visning.oy = (H - (INDSTIL.hoejde + 90) * visning.skala) / 2;
    opdaterZoner();
  }

  function opdaterZoner() {
    var zoner = [];
    var knapper = ['venstre', 'hop', 'hoejre'];
    var spillere = antalSpillere === 1 ? 1 : 2;
    // Telefon med én spiller: den holdes i begge haender, og tommelfingrene
    // sidder i hjoernerne. Venstre og hoejre samles under venstre tommel,
    // og hop er hele hoejre side. iPad beholder de tre lige store felter.
    if (spillere === 1 && window.innerWidth < 900) {
      styring.saetZoner([
        { x0: 0,   x1: 0.2, y0: 0, y1: 1, spiller: 0, knap: 'venstre' },
        { x0: 0.2, x1: 0.4, y0: 0, y1: 1, spiller: 0, knap: 'hoejre' },
        { x0: 0.4, x1: 1,   y0: 0, y1: 1, spiller: 0, knap: 'hop' }
      ]);
      return;
    }
    for (var s = 0; s < spillere; s++) {
      for (var k = 0; k < 3; k++) {
        var start = s / spillere + k / (3 * spillere);
        zoner.push({ x0: start, x1: start + 1 / (3 * spillere), y0: 0, y1: 1, spiller: s, knap: knapper[k] });
      }
    }
    styring.saetZoner(zoner);
  }

  /* ---------- verden -> skaerm ---------- */

  function sx(x) { return visning.ox + x * visning.skala; }
  function sy(y) { return visning.oy + (INDSTIL.hoejde - y) * visning.skala; }

  /* ---------- kamp ---------- */

  function ledigFarve(brugte) {
    for (var i = 0; i < FARVER.length; i++) if (brugte.indexOf(i) < 0) return i;
    return 0;
  }

  function nyKamp(spillere) {
    antalSpillere = spillere;
    Klatbold.saetSvaerhed(svaerhed);
    kamp = Klatbold.nyKamp(spillere);
    kamp.pause = 1.2;
    udseende[0] = { farve: FARVER[valg[0].farve], fjaes: FJAES[valg[0].form] };
    if (spillere === 2) {
      udseende[1] = { farve: FARVER[valg[1].farve], fjaes: FJAES[valg[1].form] };
    } else {
      var f = ledigFarve([valg[0].farve]);
      udseende[1] = { farve: FARVER[f], fjaes: FJAES[Math.floor(Math.random() * FJAES.length)] };
    }
    partikler = [];
    hale = [];
    humoer = [0, 0];
    humoerTid = [0, 0];
    maalTekst = 0;
    tilstand = 'spiller';
    styring.nulstil();
    opdaterZoner();
    floejt();
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 300) return;
      var v = Math.random() * Math.PI * 2;
      var f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f + fart * 0.4,
        liv: liv, maxLiv: liv, r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }

  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy -= 900 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liv -= dt;
      if (p.liv <= 0 || p.y < -20) partikler.splice(i, 1);
    }
  }

  /* ---------- opdatering ---------- */

  function opdater(dt) {
    var inputs = [styring.input(0), styring.input(1)];
    var førMaal = kamp.maal.slice();
    Klatbold.opdater(kamp, inputs, dt);

    var bold = kamp.bold;
    kamp.klatter.forEach(function (k, i) {
      if (k.landede) { squash[i] = 0.18; tone(140, 0.08, 0.05); }
      if (k.ramteBold) {
        var f = Math.hypot(bold.vx, bold.vy);
        tone(300 + f * 0.4, 0.09, 0.12, 'square');
        puf(bold.x, bold.y, '#fff', 6, 140, 3, 0.35);
      }
    });
    if (bold.hoppede) tone(220, 0.05, 0.04);

    if (kamp.nytMaal >= 0) {
      var scorer = kamp.nytMaal;
      humoer[scorer] = 1; humoer[1 - scorer] = -1;
      humoerTid[scorer] = 2.2; humoerTid[1 - scorer] = 2.2;
      maalTekst = 1.4;
      maalFarve = udseende[scorer].farve.lak;
      melodi([660, 880, 1100, 1320], 90);
      var mx = scorer === 0 ? INDSTIL.bredde - INDSTIL.maalDybde : INDSTIL.maalDybde;
      for (var c = 0; c < 4; c++) {
        puf(mx, 60 + c * 30, FARVER[c % FARVER.length].lak, 12, 260, 5, 1.2);
      }
      puf(mx, 90, udseende[scorer].farve.lak, 30, 320, 5, 1.4);
    }

    squash[0] = Math.max(0, squash[0] - dt);
    squash[1] = Math.max(0, squash[1] - dt);
    [0, 1].forEach(function (i) {
      humoerTid[i] = Math.max(0, humoerTid[i] - dt);
      if (humoerTid[i] === 0) humoer[i] = 0;
    });
    // Hale efter bolden naar den er hurtig
    if (Math.hypot(bold.vx, bold.vy) > 480) hale.push({ x: bold.x, y: bold.y, liv: 0.25 });
    for (var h = hale.length - 1; h >= 0; h--) { hale[h].liv -= dt; if (hale[h].liv <= 0) hale.splice(h, 1); }
    maalTekst = Math.max(0, maalTekst - dt);
    opdaterPartikler(dt);

    if (kamp.faerdig && tilstand === 'spiller') afslut();
  }

  /* ---------- tegning ---------- */

  // Papirkorn. Tegnes én gang og laegges som moenster hen over banen, saa
  // farverne ikke staar helt flade. Ét moenster-fyld pr. billede, intet mere.
  var korn = null, kornFyld = null;
  function kornMoenster() {
    if (!korn) {
      korn = document.createElement('canvas');
      korn.width = 160; korn.height = 160;
      var k = korn.getContext('2d');
      for (var i = 0; i < 2600; i++) {
        k.fillStyle = 'rgba(74,58,44,' + (0.02 + Math.random() * 0.04).toFixed(3) + ')';
        k.fillRect(Math.random() * 160, Math.random() * 160, 1, 1);
      }
    }
    if (!kornFyld) kornFyld = ctx.createPattern(korn, 'repeat');
    return kornFyld;
  }

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight, s = visning.skala;
    var jord = sy(0);

    var himmel = ctx.createLinearGradient(0, 0, 0, Math.max(jord, 1));
    himmel.addColorStop(0, P.himmelTop);
    himmel.addColorStop(1, P.himmelBund);
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, B, H);

    // Sol: en bloed malet plet, samme sted og samme stoerrelse som foer
    var solX = sx(120), solY = sy(INDSTIL.hoejde - 70), solR = 38 * s;
    var skin = ctx.createRadialGradient(solX, solY, solR * 0.5, solX, solY, solR * 2.4);
    skin.addColorStop(0, 'rgba(255,222,150,0.55)');
    skin.addColorStop(1, 'rgba(255,222,150,0)');
    ctx.fillStyle = skin;
    ctx.beginPath(); ctx.arc(solX, solY, solR * 2.4, 0, Math.PI * 2); ctx.fill();
    var kugle = ctx.createRadialGradient(solX - solR * 0.3, solY - solR * 0.3, solR * 0.15, solX, solY, solR);
    kugle.addColorStop(0, '#fff4d2');
    kugle.addColorStop(1, P.sol);
    ctx.fillStyle = kugle;
    ctx.beginPath(); ctx.arc(solX, solY, solR, 0, Math.PI * 2); ctx.fill();

    // Skyer (faste, saa de ikke flimrer) — malede, bloede kanter
    [[300, 450, 1], [640, 500, 0.8], [850, 430, 1.1]].forEach(function (sk) {
      var x = sx(sk[0]), y = sy(sk[1]), r = 26 * sk[2] * s;
      ctx.save();
      ctx.globalAlpha = 0.72;
      ctx.fillStyle = '#ffffff';
      [[0, 0, 1], [1.1, 0.2, 0.8], [-1.1, 0.25, 0.75], [0.4, -0.45, 0.6]].forEach(function (d) {
        ctx.beginPath();
        ctx.ellipse(x + r * d[0], y + r * d[1], r * d[2] * 1.15, r * d[2] * 0.8, 0, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalAlpha = 0.5;
      ctx.fillStyle = '#d8e9f2';
      ctx.beginPath();
      ctx.ellipse(x, y + r * 0.45, r * 1.5, r * 0.32, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });

    // Bloede bakker bag banen, saa himlen ikke moeder graesset i en lige streg.
    // De ligger lavt og daempet, saa bolden og figurerne staar klart foran dem.
    ctx.save();
    [[0.16, 62, 'rgba(120,160,105,0.5)'], [0.62, 78, 'rgba(120,160,105,0.42)'], [0.92, 50, 'rgba(120,160,105,0.5)']].forEach(function (bk) {
      ctx.fillStyle = bk[2];
      ctx.beginPath();
      ctx.ellipse(B * bk[0], jord + 6 * s, B * 0.3, bk[1] * s, 0, Math.PI, 0);
      ctx.fill();
    });
    ctx.restore();

    // Graes under jorden og helt ned
    var graes = ctx.createLinearGradient(0, jord, 0, H);
    graes.addColorStop(0, P.graesLys);
    graes.addColorStop(1, P.graesDyb);
    ctx.fillStyle = graes;
    ctx.fillRect(0, jord, B, H - jord);
    // Malede pletter i graesset, saa det ikke staar helt fladt. Faste steder.
    ctx.save();
    for (var pl = 0; pl < 14; pl++) {
      var px = ((pl * 173) % 100) / 100 * B, py = jord + ((pl * 61) % 100) / 100 * (H - jord);
      ctx.fillStyle = pl % 2 ? 'rgba(199,222,150,0.16)' : 'rgba(93,130,64,0.12)';
      ctx.beginPath();
      ctx.ellipse(px, py, (90 + (pl * 37) % 120) * s, (34 + (pl * 19) % 40) * s, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    // Bloed kant af lys graes og spredte totter. Faste vaerdier, saa de staar stille.
    ctx.save();
    var kant = ctx.createLinearGradient(0, jord - 9 * s, 0, jord + 14 * s);
    kant.addColorStop(0, 'rgba(190,214,140,0)');
    kant.addColorStop(0.45, 'rgba(190,214,140,0.85)');
    kant.addColorStop(1, 'rgba(147,188,99,0)');
    ctx.fillStyle = kant;
    ctx.fillRect(0, jord - 9 * s, B, 23 * s);
    ctx.lineCap = 'round';
    for (var n = 0; n < Math.ceil(B / (17 * s)); n++) {
      var x = (n * 17 + (n * 13) % 11) * s;
      var h = (7 + (n * 7) % 9) * s;
      var lud = (((n % 3) - 1)) * 4 * s;
      ctx.globalAlpha = n % 2 ? 0.28 : 0.4;
      ctx.strokeStyle = n % 2 ? P.graesLys : P.straa;
      ctx.lineWidth = 2.4 * s;
      ctx.beginPath();
      ctx.moveTo(x, jord + 5 * s);
      ctx.quadraticCurveTo(x + 2 * s, jord - h * 0.5, x + lud, jord - h);
      ctx.stroke();
    }
    ctx.restore();

    // Papirkorn hen over det hele
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = kornMoenster();
    ctx.fillRect(0, 0, B, H);
    ctx.restore();

    // Midterlinje, samme sted og samme laengde som foer
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 3 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(INDSTIL.bredde / 2), jord);
    ctx.lineTo(sx(INDSTIL.bredde / 2), jord + 40 * s);
    ctx.stroke();
    ctx.restore();
  }

  function tegnMaal(side) {
    var MD = INDSTIL.maalDybde, MH = INDSTIL.maalHoejde, B = INDSTIL.bredde;
    var x0 = side === 0 ? 0 : B - MD, x1 = side === 0 ? MD : B;
    var s = visning.skala;

    // Net: samme traadafstand som foer, men malet garn i to toner
    ctx.save();
    ctx.lineCap = 'round';
    var x, y;
    ctx.strokeStyle = 'rgba(90,110,100,0.14)';
    ctx.lineWidth = 1.8 * s;
    for (x = x0; x <= x1; x += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x) + s, sy(0)); ctx.lineTo(sx(x) + s, sy(MH) + s); ctx.stroke();
    }
    for (y = 0; y <= MH; y += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x0), sy(y) + s); ctx.lineTo(sx(x1), sy(y) + s); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(255,255,255,0.42)';
    ctx.lineWidth = 1.2 * s;
    for (x = x0; x <= x1; x += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x), sy(0)); ctx.lineTo(sx(x), sy(MH)); ctx.stroke();
    }
    for (y = 0; y <= MH; y += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x0), sy(y)); ctx.lineTo(sx(x1), sy(y)); ctx.stroke();
    }
    ctx.restore();

    // Overliggeren: malet trae, samme hoejde og samme tykkelse som foer
    var xa = sx(side === 0 ? 0 : B), xb = sx(side === 0 ? MD : B - MD), yb = sy(MH);
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(74,58,44,0.22)';
    ctx.lineWidth = 9 * s;
    ctx.beginPath(); ctx.moveTo(xa, yb + 3 * s); ctx.lineTo(xb, yb + 3 * s); ctx.stroke();
    var bjaelke = ctx.createLinearGradient(0, yb - 5 * s, 0, yb + 5 * s);
    bjaelke.addColorStop(0, P.traeLys);
    bjaelke.addColorStop(0.55, P.trae);
    bjaelke.addColorStop(1, P.traeM);
    ctx.strokeStyle = bjaelke;
    ctx.lineWidth = 8 * s;
    ctx.beginPath(); ctx.moveTo(xa, yb); ctx.lineTo(xb, yb); ctx.stroke();
    // Aarer i traeet
    ctx.strokeStyle = 'rgba(138,102,61,0.35)';
    ctx.lineWidth = 1.2 * s;
    ctx.beginPath(); ctx.moveTo(xa, yb - 1.5 * s); ctx.lineTo(xb, yb - 1.5 * s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(xa, yb + 2 * s); ctx.lineTo(xb, yb + 2 * s); ctx.stroke();
    ctx.restore();

    // Stolpen forrest. Den er rund i fysikken med radius 6, og saa stor tegnes den.
    ctx.save();
    var kugle = ctx.createRadialGradient(xb - 2 * s, yb - 2 * s, 1, xb, yb, 6 * s);
    kugle.addColorStop(0, P.traeLys);
    kugle.addColorStop(1, P.traeM);
    ctx.fillStyle = kugle;
    ctx.beginPath(); ctx.arc(xb, yb, 6 * s, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(138,102,61,0.5)';
    ctx.lineWidth = 1.2 * s;
    ctx.stroke();
    ctx.restore();
  }

  /**
   * Tegner en klat med fronten mod (kigX, kigY). Bruges baade paa banen og
   * i menuen, derfor egen context. Enheder i verden-px, skaleres udenom.
   *
   * Fem ansigter: glad, sej og soed vaelger barnet selv, og jubel og sur
   * kommer af sig selv, naar der bliver scoret (stemning +1 / -1).
   * Kroppen er stadig en halvcirkel med radius klatRadius, praecis som i fysikken.
   */
  function tegnKlatForm(c, farve, fjaes, kigX, kigY, sq, stemning) {
    var R = INDSTIL.klatRadius;
    var sqx = 1 + sq * 0.25, sqy = 1 - sq * 0.3;
    stemning = stemning || 0;
    var side = kigX >= 0 ? 1 : -1;
    var vinkel = Math.atan2(kigY, kigX);

    /* ---- krop ---- */
    c.save();
    c.scale(sqx, sqy);

    // Oerer bag kroppen
    [-1, 1].forEach(function (d) {
      c.fillStyle = farve.moerk;
      c.beginPath();
      c.ellipse(d * R * 0.5, -R * 0.92, R * 0.19, R * 0.3, d * 0.3, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = farve.lak;
      c.beginPath();
      c.ellipse(d * R * 0.5, -R * 0.94, R * 0.12, R * 0.21, d * 0.3, 0, Math.PI * 2);
      c.fill();
    });

    // Malet halvcirkel: lys foroven, dyb forneden
    var maling = c.createRadialGradient(-side * R * 0.28, -R * 0.62, R * 0.06, 0, -R * 0.2, R * 1.25);
    maling.addColorStop(0, farve.lys);
    maling.addColorStop(0.42, farve.lak);
    maling.addColorStop(1, farve.moerk);
    c.beginPath();
    c.arc(0, 0, R, Math.PI, 0);
    c.closePath();
    c.fillStyle = maling;
    c.fill();
    c.strokeStyle = farve.moerk;
    c.lineWidth = 3;
    c.stroke();

    // Skygge langs jorden, saa den staar paa banen
    c.save();
    c.beginPath();
    c.arc(0, 0, R, Math.PI, 0);
    c.closePath();
    c.clip();
    var bund = c.createLinearGradient(0, -R * 0.35, 0, 0);
    bund.addColorStop(0, 'rgba(74,58,44,0)');
    bund.addColorStop(1, 'rgba(74,58,44,0.28)');
    c.fillStyle = bund;
    c.fillRect(-R, -R, R * 2, R);
    c.restore();

    // Glans
    c.fillStyle = 'rgba(255,255,255,0.26)';
    c.beginPath();
    c.ellipse(-side * R * 0.36, -R * 0.66, R * 0.2, R * 0.09, -side * 0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    /* ---- ansigt ---- */
    // Ansigtet sidder paa den side klatten kigger, men holder sig inden for kroppen.
    var øx = side * R * 0.36, øy = -R * 0.48;

    function oejne(rr, laag) {
      [-1, 1].forEach(function (d) {
        var cx = øx + d * 12, cy = øy;
        c.fillStyle = '#fff';
        c.beginPath(); c.arc(cx, cy, rr, 0, Math.PI * 2); c.fill();
        c.strokeStyle = farve.moerk; c.lineWidth = 2; c.stroke();
        var px = cx + Math.cos(vinkel) * rr * 0.38, py = cy + Math.sin(vinkel) * rr * 0.38;
        c.fillStyle = P.blaek;
        c.beginPath(); c.arc(px, py, rr * 0.46, 0, Math.PI * 2); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.9)';
        c.beginPath(); c.arc(px - rr * 0.17, py - rr * 0.2, rr * 0.17, 0, Math.PI * 2); c.fill();
        if (laag) {
          c.strokeStyle = P.blaek; c.lineWidth = 2.5; c.lineCap = 'round';
          c.beginPath(); c.arc(cx, cy, rr + 1, Math.PI * 1.1, Math.PI * 1.9); c.stroke();
        }
      });
    }

    function kinder(styrke, br) {
      c.fillStyle = 'rgba(226,104,84,' + styrke + ')';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.ellipse(øx + d * 24, øy + 15, br, br * 0.68, 0, 0, Math.PI * 2);
        c.fill();
      });
    }

    c.lineCap = 'round';
    c.lineJoin = 'round';

    if (stemning > 0) {
      // Jubel: lukkede glade oejne, aaben mund og roede kinder
      kinder(0.42, 8);
      c.strokeStyle = P.blaek; c.lineWidth = 3.5;
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.arc(øx + d * 12, øy + 4, 10, Math.PI * 1.12, Math.PI * 1.88);
        c.stroke();
      });
      c.fillStyle = P.blaek;
      c.beginPath(); c.ellipse(øx, øy + 14, 12, 9, 0, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#e4644a';
      c.beginPath(); c.ellipse(øx, øy + 17, 6, 4, 0, 0, Math.PI * 2); c.fill();
    } else if (stemning < 0) {
      // Sur: bryn ned mod naesen og en nedadvendt mund
      oejne(10, false);
      c.strokeStyle = P.blaek; c.lineWidth = 3.5;
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.moveTo(øx + d * 17, øy - 11);
        c.lineTo(øx + d * 4, øy - 5);
        c.stroke();
      });
      c.lineWidth = 3;
      c.beginPath();
      c.arc(øx, øy + 21, 9, Math.PI * 1.15, Math.PI * 1.85);
      c.stroke();
    } else if (fjaes === 'sej') {
      // Sej: solbriller og et skaevt smil
      c.fillStyle = P.blaek;
      c.beginPath();
      c.roundRect(øx - 21, øy - 8, 42, 16, 7);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      c.ellipse(øx - 11, øy - 2, 5, 2.6, -0.5, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = P.blaek; c.lineWidth = 3;
      c.beginPath();
      c.moveTo(øx - 9, øy + 16);
      c.quadraticCurveTo(øx + 1, øy + 23, øx + 11, øy + 15);
      c.stroke();
    } else if (fjaes === 'soed') {
      // Soed: store oejne med vipper, roede kinder og et lille smil
      kinder(0.3, 7);
      oejne(11, true);
      c.strokeStyle = P.blaek; c.lineWidth = 3;
      c.beginPath();
      c.arc(øx, øy + 16, 7, 0.2 * Math.PI, 0.8 * Math.PI);
      c.stroke();
    } else {
      // Glad: runde oejne og et bredt smil
      oejne(10, false);
      c.strokeStyle = P.blaek; c.lineWidth = 3;
      c.beginPath();
      c.arc(øx, øy + 12, 11, 0.15 * Math.PI, 0.85 * Math.PI);
      c.stroke();
    }
  }

  function tegnKlat(klat, i) {
    var u = udseende[i];
    var s = visning.skala;
    ctx.save();
    // Skygge paa jorden
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx(klat.x), sy(0) + 3 * s, INDSTIL.klatRadius * s * (1 - klat.y / 400), 6 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx(klat.x), sy(klat.y));
    ctx.scale(s, s);
    ctx.rotate(klat.vx * 0.00035);   // haelder lidt fremad naar den loeber
    var sq = squash[i] > 0 ? squash[i] / 0.18 : (klat.hopper ? -0.3 : 0);
    tegnKlatForm(ctx, u.farve, u.fjaes, kamp.bold.x - klat.x, -(kamp.bold.y - klat.y - INDSTIL.klatRadius * 0.5), sq, humoer[i]);
    ctx.restore();
  }

  function tegnBold() {
    var b = kamp.bold, s = visning.skala, r = b.r * s;
    hale.forEach(function (h) {
      ctx.globalAlpha = h.liv * 1.1;
      ctx.fillStyle = '#fff6e2';
      ctx.beginPath();
      ctx.arc(sx(h.x), sy(h.y), r * h.liv * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.fillStyle = 'rgba(74,58,44,0.2)';
    ctx.beginPath();
    ctx.ellipse(sx(b.x), sy(0) + 3 * s, r * Math.max(0.3, 1 - b.y / 500), 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx(b.x), sy(b.y));
    ctx.rotate(b.x / 40);
    // Malet laederbold: lys foroven, varm skygge forneden
    var maling = ctx.createRadialGradient(-r * 0.32, -r * 0.34, r * 0.08, 0, 0, r);
    maling.addColorStop(0, '#ffffff');
    maling.addColorStop(0.7, '#ffffff');
    maling.addColorStop(1, '#e9e2d2');
    ctx.fillStyle = maling;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    // Moerk kant, saa bolden kan ses mod himlen naar den er hurtig
    ctx.strokeStyle = '#3c4a42';
    ctx.lineWidth = 3 * s;
    ctx.stroke();
    // De fem felter, samme steder som foer
    ctx.fillStyle = '#3c4a42';
    for (var k = 0; k < 5; k++) {
      var v = k * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(v) * r * 0.55, Math.sin(v) * r * 0.55, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(-r * 0.36, -r * 0.4, r * 0.26, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function tegnStilling() {
    var s = visning.skala;
    var y = visning.oy + 26 * s;
    [0, 1].forEach(function (side) {
      var u = udseende[side];
      for (var i = 0; i < INDSTIL.maal; i++) {
        var x = side === 0 ? Math.max(sx(30), 74) + i * 30 * s : sx(INDSTIL.bredde - 30) - i * 30 * s;
        ctx.beginPath();
        ctx.arc(x, y, 10 * s, 0, Math.PI * 2);
        ctx.fillStyle = i < kamp.maal[side] ? u.farve.lak : 'rgba(255,255,255,0.5)';
        ctx.fill();
        ctx.lineWidth = 3 * s;
        ctx.strokeStyle = 'rgba(94,74,58,0.6)';
        ctx.stroke();
      }
    });
  }

  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv) * 0.9;
      ctx.fillStyle = p.farve;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), p.r * visning.skala, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  /** Knapperne i bunden: pil venstre, pil op, pil hoejre pr. spiller. Den man trykker paa lyser. */
  function tegnKnapper() {
    var B = window.innerWidth, H = window.innerHeight;
    var y = H - 60;
    styring.zoner.forEach(function (z) {
      var aktiv = styring.trykket(z.spiller, z.knap);
      var midt = (z.x0 + z.x1) / 2 * B;
      var s = aktiv ? 1.3 : 1;
      ctx.save();
      // Knapperne har spillerens egen farve, saa man ved hvilken klat der er ens
      ctx.globalAlpha = aktiv ? 1 : 0.55;
      ctx.fillStyle = aktiv ? '#f0c46a' : udseende[z.spiller].farve.lak;
      ctx.strokeStyle = 'rgba(94,74,58,0.7)';
      ctx.lineWidth = aktiv ? 4 : 0;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (z.knap === 'hop') {
        ctx.moveTo(midt, y - 22 * s);
        ctx.lineTo(midt + 20 * s, y + 14 * s);
        ctx.lineTo(midt - 20 * s, y + 14 * s);
      } else {
        var d = z.knap === 'hoejre' ? 1 : -1;
        ctx.moveTo(midt - 16 * s * d, y - 20 * s);
        ctx.lineTo(midt + 14 * s * d, y);
        ctx.lineTo(midt - 16 * s * d, y + 20 * s);
      }
      ctx.closePath();
      if (aktiv) ctx.stroke();
      ctx.fill();
      ctx.restore();
    });
    if (antalSpillere === 2) {
      ctx.fillStyle = 'rgba(94,74,58,0.5)';
      ctx.fillRect(B / 2 - 2, H - 100, 4, 90);
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnBaggrund();
    if (!kamp) return;
    tegnMaal(0);
    tegnMaal(1);
    tegnPartikler();
    kamp.klatter.forEach(tegnKlat);
    tegnBold();
    tegnStilling();
    tegnKnapper();

    if (maalTekst > 0) {
      var t = Math.min(1, (1.4 - maalTekst) * 4);
      ctx.save();
      ctx.translate(B / 2, H * 0.38);
      ctx.scale(t, t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 130px ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#5e4a3a';
      ctx.fillStyle = maalFarve;
      ctx.strokeText('MÅL!', 0, 0);
      ctx.fillText('MÅL!', 0, 0);
      ctx.restore();
    }
  }

  /* ---------- slutskaerm ---------- */

  function tegnEksempel(canvas, farve, fjaes, skala) {
    var c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(canvas.width / 2, canvas.height * 0.78);
    c.scale(skala, skala);
    tegnKlatForm(c, farve, fjaes, 1, -0.3, 0);
    c.restore();
  }

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) {
      konfetti.push({
        x: Math.random() * canvas.width, y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
        b: 6 + Math.random() * 6, h: 4 + Math.random() * 4,
        farve: FARVER[i % FARVER.length].lak
      });
    }
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d');
    var u = vinderCanvas._vinder;
    tegnEksempel(vinderCanvas, u.farve, u.fjaes, 1.6);
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > vinderCanvas.height + 10) { k.y = -10; k.x = Math.random() * vinderCanvas.width; }
      c.save(); c.translate(k.x, k.y); c.rotate(k.rot);
      c.fillStyle = k.farve; c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h);
      c.restore();
    });
  }

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    var v = kamp.vinder;
    var titel = antalSpillere === 1 ? (v === 0 ? 'Du vandt!' : 'Vinder!') : 'Vinder!';
    visOverlay(
      '<div class="kort">' +
      '<h2>' + titel + '</h2>' +
      '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '"></canvas>' +
      Menu.slutRaekke('igen', { handling: 'klatvalg', navn: 'Vælg klat' }) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    vinderCanvas._vinder = udseende[v];
    startKonfetti(vinderCanvas);
  }

  /* ---------- loop ---------- */

  function løkke(tid) {
    var dt = Math.min((tid - sidsteTid) / 1000, 0.05);
    sidsteTid = tid;
    if (tilstand === 'spiller') opdater(dt);
    else if (tilstand === 'faerdig') { opdaterPartikler(dt); tegnVinder(dt); }
    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- menu ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; vinderCanvas = null; }

  function visMenu() {
    tilstand = 'venter';
    vinderCanvas = null;
    visOverlay(
      '<div class="kort">' +
      '<h2>Boldbanen</h2>' +
      '<p class="hjaelp">Løb med siderne, hop med midten. Først til fem mål.</p>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
  }

  var EKSEMPEL_STIL = 'position:static;display:block;width:150px;height:110px;align-self:center';
  var MINI_STIL = 'position:static;display:block;width:100%;height:100%';

  function visKlatValg() {
    tilstand = 'venter';
    var soejler = '';
    for (var s = 0; s < antalSpillere; s++) {
      var v = valg[s];
      var anden = antalSpillere === 2 ? valg[1 - s] : null;
      var former = FJAES.map(function (f, i) {
        return '<button class="form' + (i === v.form ? ' valgt' : '') + '" data-handling="form" data-spiller="' + s +
               '" data-i="' + i + '" aria-label="' + f + '">' +
               '<canvas width="128" height="104" style="' + MINI_STIL + '" data-form="' + i + '" data-farve="' + v.farve + '"></canvas></button>';
      }).join('');
      var farver = FARVER.map(function (f, i) {
        var optaget = anden && anden.farve === i;
        return '<button class="farve' + (i === v.farve ? ' valgt' : '') + (optaget ? ' optaget' : '') +
               '" style="background:' + f.lak + '" data-handling="farve" data-spiller="' + s + '" data-i="' + i + '"' +
               (optaget ? ' disabled' : '') + ' aria-label="' + f.navn + '"></button>';
      }).join('');
      soejler += '<div class="spiller" style="border-color:' + FARVER[v.farve].lak + '">' +
                 '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '" data-spiller="' + s + '"></canvas>' +
                 '<div class="former">' + former + '</div>' +
                 '<div class="farver">' + farver + '</div></div>';
    }
    visOverlay(
      '<div class="kort' + (antalSpillere === 2 ? ' bred' : '') + '">' +
      '<h2>Vælg din figur</h2>' +
      '<div class="valg">' + soejler + '</div>' +
      '<div class="raekke start"><button class="knap groen start" data-handling="spil" aria-label="Spil">' + Menu.start() + '</button></div>' +
      '</div>'
    );
    overlay.querySelectorAll('canvas[data-form]').forEach(function (cv) {
      tegnEksempel(cv, FARVER[+cv.dataset.farve], FJAES[+cv.dataset.form], 0.8);
    });
    overlay.querySelectorAll('canvas.eksempel[data-spiller]').forEach(function (cv) {
      var v = valg[+cv.dataset.spiller];
      tegnEksempel(cv, FARVER[v.farve], FJAES[v.form], 1.6);
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'svaerhed') {
      svaerhed = parseInt(knap.dataset.n, 10);
      melodi([520, 660, 780].slice(0, svaerhed + 1), 70);
      visMenu();
    } else if (h === 'lyd') {
      lydTil = !lydTil;
      if (lydTil) tone(660, 0.12);
      visMenu();
    } else if (h === 'start') {
      antalSpillere = parseInt(knap.dataset.spillere, 10);
      tone(520, 0.08);
      visKlatValg();
    } else if (h === 'form' || h === 'farve') {
      var v = valg[parseInt(knap.dataset.spiller, 10)];
      v[h] = parseInt(knap.dataset.i, 10);
      tone(h === 'form' ? 600 : 700, 0.08);
      visKlatValg();
    } else if (h === 'klatvalg') {
      visKlatValg();
    } else if (h === 'spil' || h === 'igen') {
      skjulOverlay();
      nyKamp(antalSpillere);
    } else if (h === 'menu') {
      visMenu();
    }
  });

  /* ---------- start ---------- */

  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, spillere: antalSpillere, svaerhed: svaerhed, lyd: lydTil,
      maal: kamp ? kamp.maal.slice() : null,
      bold: kamp ? { x: Math.round(kamp.bold.x), y: Math.round(kamp.bold.y), vx: Math.round(kamp.bold.vx), vy: Math.round(kamp.bold.vy) } : null,
      klatter: kamp ? kamp.klatter.map(function (k) { return { x: Math.round(k.x), y: Math.round(k.y), erAI: k.erAI }; }) : null,
      input: [styring.input(0), styring.input(1)]
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
