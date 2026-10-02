/**
 * Boblehavet.
 *
 * Skyd boblerne med snoren, saa deler de sig, til de er vaek. Loeb med
 * siderne, skyd med midten. To spillere hjaelper hinanden — banen er
 * klaret sammen, og begge vinder. Ingen liv: rammer en boble dig, er du
 * svimmel et par sekunder.
 *
 * Denne fil er kun skaerm og lyd. Fysik og baner ligger i js/physics.js.
 */
(function () {
  'use strict';

  var INDSTIL = Bobler.INDSTIL;

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

  var FARVER = [
    { lak: '#d95f45', navn: 'Rød' },
    { lak: '#5f9fc9', navn: 'Blå' },
    { lak: '#7ab648', navn: 'Grøn' },
    { lak: '#f0c46a', navn: 'Gul' },
    { lak: '#9b7bd4', navn: 'Lilla' },
    { lak: '#e08a52', navn: 'Orange' }
  ];
  var FIGURER = ['dreng', 'pige'];          // sprites fra Kenneys Platformer Characters
  // De malede figurer i billeder/ (akvarel, samme stil som resten af spillene). En figur, der
  // staar her, tegnes malet; gang, svimmel og jubel laves i kode paa det ene billede. De andre
  // bruger Kenneys sprites som foer. Mangler et billede, falder figuren tilbage til Kenney.
  var MALEDE = ['dreng', 'pige'];
  // Alle poser hentes med det samme, saa de er klar foer foerste bane
  var ALLE_SPRITES = MALEDE.map(function (f) { return 'billeder/' + f + '.png'; });
  ['dreng', 'pige'].forEach(function (f) { ['idle', 'walk1', 'walk2', 'hurt', 'cheer1', 'cheer2'].forEach(function (p) { ALLE_SPRITES.push('../../assets/kenney/' + f + '_' + p + '.png'); }); });
  Sprites.forhent(ALLE_SPRITES);
  var HATTE = ['kasket', 'hjelm', 'sloejfe']; // kodetegningens hatte, bruges kun som reserve
  var BOBLEFARVER = ['#5f9fc9', '#7ab648', '#f0c46a'];

  /** Samme farve, dybere eller lysere. Bruges til boblens malede kant. */
  function skift(hex, k) {
    var n = parseInt(hex.slice(1), 16);
    function d(v) { return Math.max(0, Math.min(255, Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k))); }
    return 'rgb(' + d(n >> 16 & 255) + ',' + d(n >> 8 & 255) + ',' + d(n & 255) + ')';
  }
  function dybere(hex) { return skift(hex, -0.38); }

  var valg = [{ farve: 0, form: 0 }, { farve: 1, form: 1 }];
  var svaerhed = 0;
  var lydTil = true;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');
  var styring = new Styring(lærred);

  var spil = null;
  var tilstand = 'venter';     // venter | spiller | faerdig
  var antalSpillere = 1;
  var udseende = [null, null];
  var sidsteTid = 0;
  var lyd = null;
  var tid = 0;                 // samlet spilletid til animation
  var flotTekst = 0;           // sekunder tilbage hvor "Flot!" vises
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

  function tone(frekvens, længde, styrke, type, glid) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      if (glid) o.frequency.exponentialRampToValueAtTime(glid, k.currentTime + længde);
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
    var knapper = ['venstre', 'skyd', 'hoejre'];
    var spillere = antalSpillere === 1 ? 1 : 2;
    // Telefon med én spiller: den holdes i begge haender, og tommelfingrene
    // sidder i hjoernerne. Venstre og hoejre samles under venstre tommel,
    // og skyd er hele hoejre side. iPad beholder de tre lige store felter.
    if (spillere === 1 && window.innerWidth < 900) {
      styring.saetZoner([
        { x0: 0,   x1: 0.2, y0: 0, y1: 1, spiller: 0, knap: 'venstre' },
        { x0: 0.2, x1: 0.4, y0: 0, y1: 1, spiller: 0, knap: 'hoejre' },
        { x0: 0.4, x1: 1,   y0: 0, y1: 1, spiller: 0, knap: 'skyd' }
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

  function sx(x) { return visning.ox + x * visning.skala; }
  function sy(y) { return visning.oy + (INDSTIL.hoejde - y) * visning.skala; }

  /* ---------- spil ---------- */

  function nytSpil(spillere) {
    antalSpillere = spillere;
    Bobler.saetSvaerhed(svaerhed);
    spil = Bobler.nytSpil(spillere);
    for (var i = 0; i < spillere; i++) udseende[i] = { farve: FARVER[valg[i].farve], hat: HATTE[valg[i].form % HATTE.length], figur: FIGURER[valg[i].form] };
    partikler = [];
    flotTekst = 0;
    tilstand = 'spiller';
    styring.nulstil();
    opdaterZoner();
    melodi([520, 660], 90);
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 320) return;
      var v = Math.random() * Math.PI * 2;
      var f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f, liv: liv, maxLiv: liv,
        r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }

  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy -= 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liv -= dt;
      if (p.liv <= 0 || p.y < -20) partikler.splice(i, 1);
    }
  }

  /* ---------- opdatering ---------- */

  function opdater(dt) {
    tid += dt;
    var inputs = [styring.input(0), styring.input(1)];
    Bobler.opdater(spil, inputs, dt);

    spil.spillere.forEach(function (s) {
      if (s.skoed) tone(500, 0.12, 0.08, 'square', 1400);
      if (s.ramt) {
        tone(200, 0.35, 0.14, 'triangle', 90);
        puf(s.x, INDSTIL.spillerRadius, '#fff', 10, 120, 3, 0.4);
      }
      if (s.prellede) {
        tone(700, 0.2, 0.12, 'triangle', 1200);
        puf(s.x, INDSTIL.spillerRadius * 1.5, '#8fc7e8', 16, 200, 4, 0.5);
      }
      if (s.samlede) {
        melodi(s.samlede === 'frys' ? [880, 660, 440] : [660, 880, 1100], 60);
        puf(s.x, INDSTIL.spillerRadius, SPECIALFARVE[s.samlede], 14, 180, 4, 0.6);
      }
    });
    if (spil.dryppede) tone(300, 0.2, 0.08, 'sine', 150);
    spil.poppet.forEach(function (p) {
      tone(420 + p.str * 240, 0.14, 0.14, 'sine');
      puf(p.x, p.y, BOBLEFARVER[p.str], 12 + (2 - p.str) * 6, 220, 4, 0.6);
    });
    if (spil.baneKlaret) {
      flotTekst = 1.6;
      melodi([660, 880, 1100], 90);
      for (var c = 0; c < 6; c++) puf(200 + c * 120, 420, FARVER[c].lak, 12, 260, 5, 1.3);
      if (spil.faerdig) afslut();
    }

    flotTekst = Math.max(0, flotTekst - dt);
    opdaterPartikler(dt);
  }

  /* ---------- tegning ---------- */

  /* ---------- akvarel ---------- */

  // Baggrundene er malet i kode som vandfarve: tynde, gennemsigtige lag oven paa
  // hinanden, bloede kanter og papirkorn. De males én gang pr. bane og skaermstoerrelse
  // ind i et lærred ved siden af og genbruges i hvert billede. Kun boelgerne og
  // stjernerne bevaeger sig og tegnes hver gang.

  // Fast tilfaeldighed, saa baggrunden males ens hver gang den males om
  function tilfaeldig(frø) {
    var a = frø >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /** En bloed, lukket kurve gennem punkterne. */
  function bloedForm(c, pkt) {
    var n = pkt.length;
    c.beginPath();
    c.moveTo((pkt[n - 1][0] + pkt[0][0]) / 2, (pkt[n - 1][1] + pkt[0][1]) / 2);
    for (var i = 0; i < n; i++) {
      var a = pkt[i], b = pkt[(i + 1) % n];
      c.quadraticCurveTo(a[0], a[1], (a[0] + b[0]) / 2, (a[1] + b[1]) / 2);
    }
    c.closePath();
  }

  /** En ujaevn ellipse, som en pensel laver den. */
  function ujaevnEllipse(c, x, y, rx, ry, r, uro) {
    var pkt = [], n = 16;
    for (var i = 0; i < n; i++) {
      var v = i / n * Math.PI * 2, k = 1 + (r() - 0.5) * uro;
      pkt.push([x + Math.cos(v) * rx * k, y + Math.sin(v) * ry * k]);
    }
    bloedForm(c, pkt);
  }

  /**
   * En vandfarveplet: tynde lag oven paa hinanden, hvert lidt forskudt, og en kant
   * hvor farven samler sig, som naar vandet toerrer.
   */
  function plet(c, x, y, rx, ry, farve, styrke, r, lag) {
    c.save();
    c.fillStyle = farve;
    c.strokeStyle = farve;
    for (var l = 0; l < (lag || 3); l++) {
      var k = 1 - l * 0.09;
      c.globalAlpha = styrke;
      ujaevnEllipse(c, x + (r() - 0.5) * rx * 0.1, y + (r() - 0.5) * ry * 0.1, rx * k, ry * k, r, 0.16);
      c.fill();
      if (l === 0) { c.globalAlpha = styrke * 0.8; c.lineWidth = Math.max(1, Math.min(rx, ry) * 0.04); c.stroke(); }
    }
    c.restore();
  }

  /** Et bloedt skaer uden kant: vaad maling, der flyder ud i papiret. rgb som 'r,g,b'. */
  function skaer(c, x, y, rx, ry, rgb, styrke) {
    c.save();
    c.translate(x, y);
    c.scale(1, ry / rx);
    var g = c.createRadialGradient(0, 0, 0, 0, 0, rx);
    g.addColorStop(0, 'rgba(' + rgb + ',' + styrke + ')');
    g.addColorStop(0.6, 'rgba(' + rgb + ',' + (styrke * 0.45) + ')');
    g.addColorStop(1, 'rgba(' + rgb + ',0)');
    c.fillStyle = g;
    c.beginPath(); c.arc(0, 0, rx, 0, Math.PI * 2); c.fill();
    c.restore();
  }

  /**
   * En bjergkam eller bakke: toppunkterne (skaerm-px) deles op og rystes lidt, og
   * fladen males i et par lag ned til bund. Kanten foroven faar lidt mere farve.
   */
  function kam(c, top, bund, farve, styrke, r, lag, uro) {
    var fin = [];
    for (var i = 0; i < top.length - 1; i++) {
      var a = top[i], b = top[i + 1];
      for (var t = 0; t < 8; t++) {
        fin.push([a[0] + (b[0] - a[0]) * t / 8, a[1] + (b[1] - a[1]) * t / 8]);
      }
    }
    fin.push(top[top.length - 1]);
    c.save();
    c.fillStyle = farve;
    c.strokeStyle = farve;
    for (var l = 0; l < (lag || 2); l++) {
      var fase = r() * 6;
      c.globalAlpha = styrke;
      c.beginPath();
      c.moveTo(fin[0][0], bund);
      fin.forEach(function (p, j) {
        // Penslen ryster lidt, men i lange, bloede svaj, ikke i takker
        var ende = j === 0 || j === fin.length - 1;
        var svaj = ende ? 0 : (Math.sin(j * 0.7 + fase) * 0.6 + (r() - 0.5) * 0.5) * uro;
        c.lineTo(p[0] + (ende ? 0 : (r() - 0.5) * uro * 0.5), p[1] + svaj);
      });
      c.lineTo(fin[fin.length - 1][0], bund);
      c.closePath();
      c.fill();
      if (l === 0) { c.globalAlpha = styrke * 0.7; c.lineWidth = 1.5; c.lineJoin = 'round'; c.stroke(); }
    }
    c.restore();
  }

  // Papirkorn: lyse og moerke prikker, lagt som moenster over det hele
  var korn = null;
  function kornLaerred() {
    if (!korn) {
      korn = document.createElement('canvas');
      korn.width = 160; korn.height = 160;
      var k = korn.getContext('2d'), r = tilfaeldig(7);
      for (var i = 0; i < 2600; i++) {
        k.fillStyle = 'rgba(74,58,44,' + (0.02 + r() * 0.05).toFixed(3) + ')';
        k.fillRect(r() * 160, r() * 160, 1, 1);
      }
      for (i = 0; i < 1100; i++) {
        k.fillStyle = 'rgba(255,250,240,' + (0.04 + r() * 0.08).toFixed(3) + ')';
        k.fillRect(r() * 160, r() * 160, 1, 1);
      }
    }
    return korn;
  }

  function papir(c, B, H, styrke) {
    c.save();
    c.globalAlpha = styrke;
    c.fillStyle = c.createPattern(kornLaerred(), 'repeat');
    c.fillRect(0, 0, B, H);
    c.restore();
  }

  /** Solen: varm glorie og en malet skive. */
  function malSol(c, x, y, R, r, kant) {
    var skin = c.createRadialGradient(x, y, R * 0.6, x, y, R * 2.8);
    skin.addColorStop(0, 'rgba(255,226,160,0.5)');
    skin.addColorStop(0.5, 'rgba(255,226,160,0.16)');
    skin.addColorStop(1, 'rgba(255,226,160,0)');
    c.fillStyle = skin;
    c.beginPath(); c.arc(x, y, R * 2.8, 0, Math.PI * 2); c.fill();
    plet(c, x, y, R * 1.05, R * 1.05, kant, 0.28, r, 2);
    c.save();
    var g = c.createRadialGradient(x - R * 0.25, y - R * 0.25, R * 0.1, x, y, R);
    g.addColorStop(0, '#fff1c8');
    g.addColorStop(0.55, '#ffdf9e');
    g.addColorStop(1, kant);
    c.fillStyle = g;
    c.globalAlpha = 0.92;
    ujaevnEllipse(c, x, y, R * 0.97, R * 0.97, r, 0.07);
    c.fill();
    c.clip();
    c.fillStyle = '#e08a52';
    for (var i = 0; i < 120; i++) {
      c.globalAlpha = 0.05 + r() * 0.1;
      c.beginPath();
      c.arc(x + (r() - 0.5) * R * 2, y + (r() - 0.5) * R * 2, R * (0.01 + r() * 0.018), 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
    plet(c, x - R * 0.3, y - R * 0.32, R * 0.4, R * 0.32, '#fff8e6', 0.22, r, 2);
  }

  /** En sky: skyggede pust forneden, hvide pust ovenpaa. */
  function malSky(c, x, y, R, r, skygge, lys) {
    var i;
    for (i = 0; i < 6; i++) {
      plet(c, x + (i / 5 - 0.5) * R * 2.4 + (r() - 0.5) * R * 0.3, y + R * (0.28 + r() * 0.15),
        R * (0.5 + r() * 0.25), R * (0.3 + r() * 0.1), skygge, 0.36, r, 2);
    }
    [[0, -0.05, 1], [1.05, 0.12, 0.78], [-1.05, 0.18, 0.72], [0.42, -0.42, 0.62], [-0.42, -0.32, 0.58],
     [1.6, 0.3, 0.45], [-1.6, 0.32, 0.42]].forEach(function (d) {
      plet(c, x + R * d[0], y + R * d[1], R * d[2] * 1.1, R * d[2] * 0.85, lys, 0.3, r, 3);
    });
    plet(c, x - R * 0.25, y - R * 0.38, R * 0.7, R * 0.36, lys, 0.35, r, 2);
  }

  /** En lang, flad sky i solnedgangen. */
  function malStribe(c, x, y, b, h, farve, rgb, styrke, r) {
    for (var i = 0; i < 5; i++) {
      skaer(c, x + (r() - 0.5) * b * 0.7, y + (r() - 0.5) * h * 0.6, b * (0.3 + r() * 0.3), h * (0.6 + r() * 0.4), rgb, styrke * 1.6);
    }
    for (i = 0; i < 3; i++) {
      plet(c, x + (r() - 0.5) * b * 0.5, y + (r() - 0.5) * h * 0.5, b * (0.25 + r() * 0.2), h * (0.25 + r() * 0.2), farve, styrke * 0.6, r, 1);
    }
  }

  /** Den vaade kant paa jorden, lige hvor man staar. Jorden begynder praecis ved sy(0). */
  function malJord(c, B, H, s, lys, midt, dyb, kant, r, prik) {
    var jord = sy(0);
    var g = c.createLinearGradient(0, jord, 0, H);
    g.addColorStop(0, lys);
    g.addColorStop(0.35, midt);
    g.addColorStop(1, dyb);
    c.fillStyle = g;
    c.fillRect(0, jord, B, H - jord);
    // Store, svage pletter, saa jorden ikke staar flad
    for (var i = 0; i < 16; i++) {
      plet(c, r() * B, jord + (0.25 + r() * 0.8) * (H - jord), (60 + r() * 110) * s, (12 + r() * 16) * s,
        i % 2 ? dyb : lys, 0.14, r, 2);
    }
    // Kanten: samme sted og samme bredde som foer, men malet bloedt ned i jorden
    var k = c.createLinearGradient(0, jord, 0, jord + 14 * s);
    k.addColorStop(0, kant);
    k.addColorStop(0.55, kant);
    k.addColorStop(1, 'rgba(0,0,0,0)');
    c.save();
    c.globalAlpha = 0.85;
    c.fillStyle = k;
    c.fillRect(0, jord, B, 14 * s);
    c.restore();
    // Korn i jorden
    c.save();
    c.fillStyle = prik;
    for (i = 0; i < Math.round(B * 0.5); i++) {
      c.globalAlpha = 0.12 + r() * 0.2;
      c.beginPath();
      c.arc(r() * B, jord + 6 * s + r() * (H - jord), (0.6 + r() * 1.1) * s, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  function malStrand(c, B, H, s, r) {
    var i, jord = sy(0);
    var himmel = c.createLinearGradient(0, 0, 0, jord);
    himmel.addColorStop(0, '#8576b8');
    himmel.addColorStop(0.5, '#d98f86');
    himmel.addColorStop(0.85, '#f0b98a');
    himmel.addColorStop(1, '#f6d9a6');
    c.fillStyle = himmel;
    c.fillRect(0, 0, B, H);
    for (i = 0; i < 12; i++) {
      var hy = r();
      skaer(c, r() * B, hy * jord * 0.9, (180 + r() * 240) * s, (40 + r() * 60) * s,
        hy < 0.4 ? '155,123,212' : (i % 2 ? '240,196,106' : '217,95,69'), hy < 0.4 ? 0.22 : 0.16);
    }
    // Lange, flade skyer, lyse foroven og roedlige forneden, som solen rammer dem
    [[170, 470, 300, 22], [520, 520, 260, 18], [880, 400, 320, 24], [330, 300, 240, 16], [640, 250, 200, 14]].forEach(function (sk) {
      malStribe(c, sx(sk[0]), sy(sk[1]) + sk[3] * 0.5 * s, sk[2] * s, sk[3] * s, '#d95f45', '217,95,69', 0.12, r);
      malStribe(c, sx(sk[0]), sy(sk[1]), sk[2] * s, sk[3] * s, '#f8f1e6', '248,241,230', 0.2, r);
    });
    // Solen gaar ned i havet: samme sted og samme stoerrelse som foer
    malSol(c, sx(780), sy(120), 60 * s, r, '#f0b45a');
    // Et naes langt ude i det blaa
    kam(c, [[sx(-60), sy(70)], [sx(40), sy(92)], [sx(120), sy(100)], [sx(210), sy(86)], [sx(300), sy(70)]],
      sy(68), '#9b7bd4', 0.28, r, 2, 3 * s);

    // Havet fra horisonten og ned til stranden, samme sted som foer
    var hav = c.createLinearGradient(0, sy(70), 0, jord);
    hav.addColorStop(0, '#5689b8');
    hav.addColorStop(0.5, '#5f9fc9');
    hav.addColorStop(1, '#8fc7e8');
    c.fillStyle = hav;
    c.fillRect(0, sy(70), B, 70 * s);
    for (i = 0; i < 26; i++) {
      var by = sy(8 + r() * 60);
      plet(c, r() * B, by, (50 + r() * 120) * s, (2 + r() * 3) * s,
        i % 3 ? '#8fc7e8' : '#4f7fae', 0.22, r, 1);
    }
    // Solens spejling i vandet
    skaer(c, sx(780), sy(40), 70 * s, 34 * s, '240,196,106', 0.35);
    for (i = 0; i < 22; i++) {
      var dy = r() * 62;
      skaer(c, sx(780 + (r() - 0.5) * (40 + dy * 0.9)), sy(66 - dy), (12 + r() * 22) * s * (1 - dy / 120), 2.2 * s,
        i % 2 ? '240,196,106' : '248,241,230', 0.7);
    }
    // Horisonten: en bloed, lidt dybere streg
    c.save();
    c.globalAlpha = 0.45;
    c.fillStyle = '#4f7fae';
    c.fillRect(0, sy(70), B, 2 * s);
    c.restore();
    // Skum langs stranden
    c.save();
    c.strokeStyle = '#f8f1e6';
    c.lineCap = 'round';
    for (i = 0; i < 2; i++) {
      c.globalAlpha = 0.5 - i * 0.2;
      c.lineWidth = (3 - i) * s;
      c.beginPath();
      for (var x = -20; x <= B + 20; x += 24 * s) {
        var y = jord - (3 + i * 5 + Math.sin(x * 0.03 + i * 2) * 1.6) * s;
        if (x === -20) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();

    malJord(c, B, H, s, '#efdcb6', '#e5d3ae', '#d9ba8a', '#d9ba8a', r, '#b18a56');
    papir(c, B, H, 0.55);
  }

  function malBjerge(c, B, H, s, r) {
    var i, jord = sy(0);
    var himmel = c.createLinearGradient(0, 0, 0, jord);
    himmel.addColorStop(0, '#7fb8dc');
    himmel.addColorStop(0.55, '#b9dbea');
    himmel.addColorStop(1, '#eef2e8');
    c.fillStyle = himmel;
    c.fillRect(0, 0, B, H);
    for (i = 0; i < 10; i++) {
      skaer(c, r() * B, r() * jord * 0.7, (160 + r() * 220) * s, (40 + r() * 50) * s,
        i % 3 ? '143,199,232' : '248,241,230', i % 3 ? 0.22 : 0.3);
    }
    // Solen: samme sted og samme stoerrelse som foer
    malSol(c, sx(150), sy(520), 40 * s, r, '#f0c46a');
    malSky(c, sx(470), sy(500), 30 * s, r, '#b4cbdb', '#ffffff');
    malSky(c, sx(860), sy(455), 24 * s, r, '#b4cbdb', '#ffffff');

    // Bjergene bagved: lyse og blaa i luften
    kam(c, [[sx(-200), sy(150)], [sx(60), sy(250)], [sx(200), sy(210)], [sx(330), sy(290)], [sx(470), sy(230)],
      [sx(580), sy(300)], [sx(730), sy(240)], [sx(850), sy(320)], [sx(1000), sy(230)], [sx(1200), sy(260)]],
      jord, '#9b7bd4', 0.12, r, 2, 4 * s);
    kam(c, [[sx(-200), sy(150)], [sx(60), sy(250)], [sx(200), sy(210)], [sx(330), sy(290)], [sx(470), sy(230)],
      [sx(580), sy(300)], [sx(730), sy(240)], [sx(850), sy(320)], [sx(1000), sy(230)], [sx(1200), sy(260)]],
      jord, '#8fc7e8', 0.3, r, 2, 4 * s);

    // De store bjerge, samme toppe som foer. Farven er tungest foroven og loeber ud i disen
    var toppe = [[-200, 60], [0, 120], [120, 300], [260, 160], [400, 340], [520, 200], [650, 380], [800, 180], [920, 280], [1000, 140], [1200, 200]];
    var pkt = toppe.map(function (p) { return [sx(p[0]), sy(p[1])]; });
    var bjerg = c.createLinearGradient(0, sy(380), 0, jord);
    bjerg.addColorStop(0, '#5f8fc0');
    bjerg.addColorStop(0.6, '#7fa9cf');
    bjerg.addColorStop(1, '#a9c9e0');
    kam(c, pkt, jord, bjerg, 0.5, r, 2, 7 * s);
    kam(c, pkt, jord, '#9b7bd4', 0.1, r, 1, 7 * s);
    // Skyggesiden af hvert bjerg (solen staar til venstre), malet i tre tynde lag,
    // saa kanten mod lyset bliver bloed
    for (i = 1; i < toppe.length - 1; i++) {
      var a = toppe[i], b = toppe[i + 1];
      if (a[1] < b[1]) continue;
      c.save();
      c.fillStyle = '#46679a';
      for (var l = 0; l < 3; l++) {
        c.globalAlpha = 0.09;
        c.beginPath();
        c.moveTo(sx(a[0]), sy(a[1]));
        c.lineTo(sx(b[0]), sy(b[1]));
        c.lineTo(sx(a[0] + (b[0] - a[0]) * (0.12 + l * 0.14) + (r() - 0.5) * 20), jord);
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    // Pigment, der har samlet sig i pletter paa bjergsiderne
    c.save();
    c.beginPath();
    c.moveTo(pkt[0][0], jord);
    pkt.forEach(function (q) { c.lineTo(q[0], q[1]); });
    c.lineTo(pkt[pkt.length - 1][0], jord);
    c.closePath();
    c.clip();
    for (i = 0; i < 36; i++) {
      var bx = -100 + r() * 1200, by = 40 + r() * 260;
      skaer(c, sx(bx), sy(by), (30 + r() * 60) * s, (14 + r() * 26) * s, i % 3 ? '70,103,154' : '223,238,240', 0.16);
    }
    c.restore();
    // Sne paa de tre hoeje toppe. Sneen foelger bjergets kanter ned og ender i en
    // flosset kant, malet i tre lag, saa den bliver bloed
    [[2, 52], [4, 58], [6, 64]].forEach(function (sn) {
      var p = toppe[sn[0]], v = toppe[sn[0] - 1], h = toppe[sn[0] + 1], fald = sn[1];
      var fv = fald / (p[1] - v[1]), fh = (fald + 6) / (p[1] - h[1]);
      var venstre = [p[0] + (v[0] - p[0]) * fv, p[1] - fald], hoejre = [p[0] + (h[0] - p[0]) * fh, p[1] - fald - 6];
      // Den flossede kant, regnet én gang, og malet tre gange lidt rystet
      var kant = [];
      for (var k = 1; k < 6; k++) {
        kant.push([venstre[0] + (hoejre[0] - venstre[0]) * k / 6,
          venstre[1] + (hoejre[1] - venstre[1]) * k / 6 + (k % 2 ? 12 : -2) + (r() - 0.5) * 6]);
      }
      function sneForm(ryst) {
        c.beginPath();
        c.moveTo(sx(p[0]), sy(p[1]));
        c.lineTo(sx(venstre[0]), sy(venstre[1]));
        kant.forEach(function (q) { c.lineTo(sx(q[0] + (r() - 0.5) * ryst), sy(q[1] + (r() - 0.5) * ryst)); });
        c.lineTo(sx(hoejre[0]), sy(hoejre[1]));
        c.closePath();
      }
      c.save();
      c.fillStyle = '#f8f1e6';
      for (var l = 0; l < 3; l++) {
        c.globalAlpha = l ? 0.35 : 0.8;
        sneForm(l ? 5 : 0);
        c.fill();
      }
      // Sneens skyggeside, kun inden i sneen
      sneForm(0);
      c.clip();
      c.fillStyle = '#aed3e4';
      c.globalAlpha = 0.8;
      c.beginPath();
      c.moveTo(sx(p[0]), sy(p[1] + 4));
      c.lineTo(sx(p[0] + 50), sy(p[1] - 30));
      c.lineTo(sx(p[0] + 50), sy(p[1] - 90));
      c.lineTo(sx(p[0] + 6), sy(p[1] - 90));
      c.closePath();
      c.fill();
      c.restore();
    });
    // Dis ved foden af bjergene
    var dis = c.createLinearGradient(0, sy(150), 0, jord);
    dis.addColorStop(0, 'rgba(248,241,230,0)');
    dis.addColorStop(1, 'rgba(248,241,230,0.45)');
    c.fillStyle = dis;
    c.fillRect(0, sy(150), B, jord - sy(150));

    // Bakkerne: en lys bagved og en dybere foran, med smaa graner
    var bag = [], foran = [];
    for (i = -3; i <= 13; i++) {
      bag.push([sx(i * 100 + 40), sy(48 + 30 * Math.abs(Math.sin(i * 0.8 + 1)))]);
      foran.push([sx(i * 100), sy(20 + 50 * Math.abs(Math.cos(i * 0.9)))]);
    }
    kam(c, bag, jord, '#a9c97c', 0.7, r, 2, 3 * s);
    for (i = 0; i < 14; i++) {
      var tx = r() * 1100 - 50, ty = 40 + r() * 25, th = (18 + r() * 16);
      c.save();
      c.fillStyle = '#5f8240';
      c.globalAlpha = 0.55;
      for (var e = 0; e < 3; e++) {
        c.beginPath();
        c.moveTo(sx(tx), sy(ty + th * (1 - e * 0.22)));
        c.lineTo(sx(tx - th * 0.28 * (1 + e * 0.35)), sy(ty + th * (0.42 - e * 0.22)));
        c.lineTo(sx(tx + th * 0.28 * (1 + e * 0.35)), sy(ty + th * (0.42 - e * 0.22)));
        c.closePath();
        c.fill();
      }
      c.restore();
    }
    kam(c, foran, jord, '#93bc63', 0.75, r, 2, 3 * s);
    kam(c, foran, jord, '#5f8240', 0.12, r, 1, 3 * s);

    malJord(c, B, H, s, '#93bc63', '#7fa654', '#5f8240', '#6f9448', r, '#4d6b34');
    papir(c, B, H, 0.55);
  }

  function malNat(c, B, H, s, r) {
    var i, jord = sy(0);
    var himmel = c.createLinearGradient(0, 0, 0, jord);
    himmel.addColorStop(0, '#17203a');
    himmel.addColorStop(0.55, '#2a3358');
    himmel.addColorStop(1, '#4a5580');
    c.fillStyle = himmel;
    c.fillRect(0, 0, B, H);
    for (i = 0; i < 14; i++) {
      var farve = ['155,123,212', '95,159,201', '20,26,46'][i % 3];
      skaer(c, r() * B, r() * jord, (160 + r() * 240) * s, (60 + r() * 90) * s, farve, i % 3 === 2 ? 0.3 : 0.16);
    }
    // Maanen: samme sted og samme stoerrelse som foer, nu en rigtig segl
    var mx = sx(820), my = sy(480), mR = 44 * s;
    skaer(c, mx, my, mR * 2.6, mR * 2.6, '248,238,201', 0.16);
    c.drawImage(maleMaane(mR, r), mx - mR * 1.2, my - mR * 1.2, mR * 2.4, mR * 2.4);

    // Bakker i silhuet: en blaalig bagved, en dyb groen foran med traeer
    var bag = [], foran = [];
    for (i = -3; i <= 13; i++) {
      bag.push([sx(i * 100 + 50), sy(55 + 35 * Math.abs(Math.sin(i * 0.7 + 0.4)))]);
      foran.push([sx(i * 100), sy(30 + 40 * Math.abs(Math.sin(i * 1.3)))]);
    }
    kam(c, bag, jord, '#3a4670', 0.75, r, 2, 3 * s);
    // Runde traeer, der staar paa den bageste bakke
    for (i = 0; i < 12; i++) {
      var tx = r() * 1100 - 50, tr = 9 + r() * 9;
      var j = Math.floor((tx - 50) / 100) + 3, f = (tx - 50) / 100 + 3 - j;
      var a = bag[Math.max(0, Math.min(bag.length - 1, j))], b2 = bag[Math.max(0, Math.min(bag.length - 1, j + 1))];
      var ty = a[1] + (b2[1] - a[1]) * f;                    // bakkens kant i skaerm-px
      plet(c, sx(tx), ty - tr * 0.35 * s, tr * s, tr * 1.15 * s, '#323e66', 0.9, r, 2);
      plet(c, sx(tx + tr * 0.9), ty + tr * 0.1 * s, tr * 0.7 * s, tr * 0.8 * s, '#323e66', 0.9, r, 2);
    }
    kam(c, foran, jord, '#1d3328', 0.85, r, 2, 3 * s);
    kam(c, foran, jord, '#2f4a3c', 0.25, r, 1, 3 * s);

    malJord(c, B, H, s, '#3f5545', '#36483a', '#2b3a30', '#4a6a50', r, '#1d2a22');
    papir(c, B, H, 0.4);
  }

  /** Den malede segl. Skiven males paa et lille lærred, og en cirkel skaeres ud med destination-out. */
  function maleMaane(R, r) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var cv = document.createElement('canvas');
    var side = Math.ceil(R * 2.4 * dpr);
    cv.width = side; cv.height = side;
    var c = cv.getContext('2d');
    c.scale(side / (R * 2.4), side / (R * 2.4));
    var m = R * 1.2;
    var g = c.createRadialGradient(m - R * 0.3, m - R * 0.2, R * 0.1, m, m, R);
    g.addColorStop(0, '#fffaf0');
    g.addColorStop(0.6, '#f8eec9');
    g.addColorStop(1, '#ecd9a0');
    c.fillStyle = g;
    ujaevnEllipse(c, m, m, R, R, r, 0.05);
    c.fill();
    plet(c, m - R * 0.1, m + R * 0.05, R * 0.8, R * 0.8, '#fffaf0', 0.25, r, 2);
    // Graa skygger i maanen, svage og bloede
    for (var i = 0; i < 7; i++) {
      var v = r() * Math.PI * 2, d = r() * R * 0.7;
      plet(c, m + Math.cos(v) * d, m + Math.sin(v) * d, R * (0.08 + r() * 0.12), R * (0.07 + r() * 0.1), '#d9ba8a', 0.18, r, 1);
    }
    // Skaer seglen ud: samme cirkel som den himmelfarvede, der laa ovenpaa foer
    c.globalCompositeOperation = 'destination-out';
    c.globalAlpha = 1;
    c.fillStyle = '#000';
    c.beginPath();
    c.arc(m + R * 16 / 44, m - R * 12 / 44, R * 38 / 44, 0, Math.PI * 2);
    c.fill();
    return cv;
  }

  // Baggrunden males én gang pr. tema og skaermstoerrelse
  var baggrund = { laerred: null, noegle: '' };

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var tema = spil ? spil.tema : 'strand';
    var noegle = tema + ':' + B + 'x' + H + '@' + dpr + ':' + visning.skala;
    if (baggrund.noegle !== noegle) {
      var cv = baggrund.laerred || document.createElement('canvas');
      cv.width = Math.max(1, Math.floor(B * dpr));
      cv.height = Math.max(1, Math.floor(H * dpr));
      var c = cv.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      var r = tilfaeldig(tema === 'strand' ? 3 : (tema === 'nat' ? 5 : 9));
      if (tema === 'nat') malNat(c, B, H, visning.skala, r);
      else if (tema === 'bjerge') malBjerge(c, B, H, visning.skala, r);
      else malStrand(c, B, H, visning.skala, r);
      baggrund.laerred = cv;
      baggrund.noegle = noegle;
    }
    ctx.drawImage(baggrund.laerred, 0, 0, B, H);
    tegnLevende(tema);
  }

  /** Det, der bevaeger sig i baggrunden: boelgerne paa havet og stjernerne, der blinker. */
  function tegnLevende(tema) {
    var s = visning.skala, i;
    if (tema === 'strand') {
      ctx.save();
      ctx.strokeStyle = '#f8f1e6';
      ctx.lineCap = 'round';
      ctx.lineWidth = 2 * s;
      for (i = 0; i < 12; i++) {
        var x = sx(i * 90 + ((tid * 30) % 90)), y = sy(40 + (i % 3) * 8);
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.moveTo(x - 28 * s, y + 1.5 * s);
        ctx.quadraticCurveTo(x, y - 3 * s, x + 28 * s, y + 1.5 * s);
        ctx.stroke();
      }
      ctx.restore();
    } else if (tema === 'nat') {
      ctx.save();
      ctx.fillStyle = '#f8f1e6';
      for (i = 0; i < 40; i++) {
        var stx = (i * 137) % 1000, sty = 220 + (i * 71) % 370;
        if (Math.abs(stx - 820) < 60 && Math.abs(sty - 480) < 60) continue;   // ikke oven i maanen
        var blink = 0.5 + 0.5 * Math.sin(tid * 2 + i);
        var rr = (1.2 + (i % 3) * 0.6) * s;
        ctx.globalAlpha = (0.4 + 0.6 * blink) * 0.25;
        ctx.beginPath(); ctx.arc(sx(stx), sy(sty), rr * 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 0.4 + 0.6 * blink;
        ctx.beginPath(); ctx.arc(sx(stx), sy(sty), rr, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  /* ---------- platforme ---------- */

  // Hver bane har sit stof: drivtoemmer paa stranden, sten om natten og braedder i
  // bjergene. Rektanglet er praecis det samme som foer, saa man staar, hvor man ser.
  // Hver platform males én gang paa sit eget lille lærred.
  var platformBilleder = { platforme: null, noegle: '', billeder: [] };

  function tegnPlatforme() {
    var s = visning.skala;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var noegle = spil.tema + '@' + dpr + ':' + s;
    if (platformBilleder.platforme !== spil.platforme || platformBilleder.noegle !== noegle) {
      platformBilleder.platforme = spil.platforme;
      platformBilleder.noegle = noegle;
      platformBilleder.billeder = spil.platforme.map(function (p, i) {
        return malPlatform(p, spil.tema, s, dpr, tilfaeldig(31 + i * 17 + Math.round(p.x)));
      });
    }
    spil.platforme.forEach(function (p, i) {
      var cv = platformBilleder.billeder[i], luft = 8 * s;
      ctx.drawImage(cv, sx(p.x) - luft, sy(p.y + p.tykkelse) - luft, p.bredde * s + luft * 2, p.tykkelse * s + luft * 2);
    });
  }

  function malPlatform(p, tema, s, dpr, r) {
    var b = p.bredde * s, h = p.tykkelse * s, luft = 8 * s, i, x;
    var cv = document.createElement('canvas');
    cv.width = Math.ceil((b + luft * 2) * dpr);
    cv.height = Math.ceil((h + luft * 2) * dpr);
    var c = cv.getContext('2d');
    c.scale(cv.width / (b + luft * 2), cv.height / (h + luft * 2));
    c.translate(luft, luft);
    // Skyggen under, samme sted som foer, men bloed
    c.save();
    c.fillStyle = 'rgba(60,48,40,0.12)';
    for (i = 0; i < 3; i++) {
      c.beginPath();
      c.roundRect(-i * s, 4 * s - i * 0.5 * s, b + i * 2 * s, h + i * s, 6 * s);
      c.fill();
    }
    c.restore();
    // Selve formen: praecis rektanglet fra fysikken
    c.save();
    c.beginPath();
    c.roundRect(0, 0, b, h, 6 * s);
    c.clip();
    if (tema === 'nat') {
      // Sten: en graalilla bund og flade sten med fuger imellem
      c.fillStyle = '#4e4866';
      c.fillRect(0, 0, b, h);
      x = 0;
      var raekke = 0;
      while (x < b) {
        var sb = (22 + r() * 22) * s;
        var g = c.createLinearGradient(0, 0, 0, h);
        var tone = ['#8a83a6', '#7d7a98', '#958aa8', '#837c96'][Math.floor(r() * 4)];
        g.addColorStop(0, tone);
        g.addColorStop(1, '#5e5874');
        c.fillStyle = g;
        c.beginPath();
        c.roundRect(x + 1 * s, 1 * s + (raekke % 2) * 0.5 * s, sb - 2 * s, h - 2 * s, 4 * s);
        c.fill();
        // Lidt lys paa toppen af stenen og et par pletter
        c.fillStyle = 'rgba(248,241,230,0.18)';
        c.fillRect(x + 3 * s, 2 * s, sb - 6 * s, 2 * s);
        skaer(c, x + sb * (0.3 + r() * 0.4), h * (0.45 + r() * 0.3), sb * 0.3, h * 0.25, '78,72,102', 0.3);
        x += sb;
        raekke++;
      }
      // Mos paa kanten
      for (i = 0; i < b / (14 * s); i++) {
        plet(c, r() * b, 1.5 * s, (4 + r() * 8) * s, (1.6 + r() * 1.4) * s, i % 2 ? '#4d6b34' : '#5f8240', 0.6, r, 1);
      }
    } else if (tema === 'bjerge') {
      // Braedder: varmt trae med aarer, fuger og soem
      var g2 = c.createLinearGradient(0, 0, 0, h);
      g2.addColorStop(0, '#d9ba8a');
      g2.addColorStop(0.3, '#b18a56');
      g2.addColorStop(1, '#8a663d');
      c.fillStyle = g2;
      c.fillRect(0, 0, b, h);
      aarer(c, b, h, s, r, 'rgba(94,74,58,0.35)', 4);
      x = (30 + r() * 30) * s;
      while (x < b - 20 * s) {
        c.fillStyle = 'rgba(94,74,58,0.45)';
        c.fillRect(x, 0, 1.6 * s, h);
        c.fillStyle = 'rgba(248,241,230,0.25)';
        c.fillRect(x + 1.6 * s, 0, 1 * s, h);
        c.fillStyle = '#5e4a3a';
        [-1, 1].forEach(function (d) {
          c.beginPath(); c.arc(x + d * 5 * s, h * 0.5, 1.3 * s, 0, Math.PI * 2); c.fill();
        });
        x += (55 + r() * 40) * s;
      }
      c.fillStyle = 'rgba(248,241,230,0.35)';
      c.fillRect(0, 1.5 * s, b, 1.5 * s);
    } else {
      // Drivtoemmer: blegt af sol og salt, med aarer og et par knaster
      var g3 = c.createLinearGradient(0, 0, 0, h);
      g3.addColorStop(0, '#efe3d0');
      g3.addColorStop(0.35, '#d9ba8a');
      g3.addColorStop(1, '#b18a56');
      c.fillStyle = g3;
      c.fillRect(0, 0, b, h);
      var ender = c.createLinearGradient(0, 0, b, 0);
      ender.addColorStop(0, 'rgba(138,102,61,0.35)');
      ender.addColorStop(0.08, 'rgba(138,102,61,0)');
      ender.addColorStop(0.92, 'rgba(138,102,61,0)');
      ender.addColorStop(1, 'rgba(138,102,61,0.35)');
      c.fillStyle = ender;
      c.fillRect(0, 0, b, h);
      aarer(c, b, h, s, r, 'rgba(138,102,61,0.45)', 5);
      for (i = 0; i < Math.max(1, Math.round(b / (120 * s))); i++) {
        var kx = (0.15 + r() * 0.7) * b, ky = h * (0.4 + r() * 0.2);
        c.strokeStyle = 'rgba(138,102,61,0.6)';
        c.lineWidth = 1.2 * s;
        c.beginPath(); c.ellipse(kx, ky, 5 * s, 2.6 * s, 0, 0, Math.PI * 2); c.stroke();
        c.fillStyle = 'rgba(94,74,58,0.45)';
        c.beginPath(); c.ellipse(kx, ky, 2 * s, 1 * s, 0, 0, Math.PI * 2); c.fill();
      }
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(0, 1.5 * s, b, 1.5 * s);
    }
    papir(c, b, h, 0.6);
    c.restore();
    // Bloed blaekkant om det hele
    c.strokeStyle = 'rgba(94,74,58,0.45)';
    c.lineWidth = 1.5 * s;
    c.beginPath();
    c.roundRect(0, 0, b, h, 6 * s);
    c.stroke();
    return cv;
  }

  /** Aarer i trae: lange, boelgende streger paa langs. */
  function aarer(c, b, h, s, r, farve, antal) {
    c.save();
    c.strokeStyle = farve;
    c.lineCap = 'round';
    for (var i = 0; i < antal; i++) {
      var y0 = h * (0.2 + 0.65 * i / Math.max(1, antal - 1)) + (r() - 0.5) * 2 * s;
      var fase = r() * 6, boelge = (0.6 + r()) * s;
      c.lineWidth = (0.7 + r() * 0.7) * s;
      c.beginPath();
      for (var x = 0; x <= b; x += 6 * s) {
        var y = y0 + Math.sin(x / (30 * s) + fase) * boelge;
        if (x === 0) c.moveTo(x, y); else c.lineTo(x, y);
      }
      c.stroke();
    }
    c.restore();
  }

  /* ---------- specials ---------- */

  var SPECIALFARVE = { dobbelt: '#f0c46a', klaebe: '#e08a52', frys: '#8fc7e8', skjold: '#7ab648' };

  /** Ikon for en special, tegnet omkring (0,0) i en cirkel med radius r. */
  function tegnSpecialIkon(c, type, r) {
    c.fillStyle = SPECIALFARVE[type];
    c.strokeStyle = '#5e4a3a';
    c.lineWidth = 3;
    c.beginPath(); c.arc(0, 0, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.lineWidth = 2.5;
    c.lineCap = 'round';
    if (type === 'dobbelt') {
      [-1, 1].forEach(function (d) {
        c.beginPath(); c.moveTo(d * r * 0.35, r * 0.55); c.lineTo(d * r * 0.35, -r * 0.4); c.stroke();
        c.fillStyle = '#5e4a3a';
        c.beginPath(); c.moveTo(d * r * 0.35, -r * 0.65); c.lineTo(d * r * 0.35 - 5, -r * 0.35); c.lineTo(d * r * 0.35 + 5, -r * 0.35); c.closePath(); c.fill();
      });
    } else if (type === 'klaebe') {
      c.beginPath(); c.moveTo(0, r * 0.55); c.lineTo(0, -r * 0.3); c.stroke();
      c.beginPath(); c.arc(0, -r * 0.35, r * 0.28, Math.PI, Math.PI * 2.2); c.stroke();
      c.fillStyle = '#5e4a3a';
      c.fillRect(-r * 0.6, -r * 0.75, r * 1.2, 4);
    } else if (type === 'frys') {
      for (var k = 0; k < 3; k++) {
        c.save(); c.rotate(k * Math.PI / 3);
        c.beginPath(); c.moveTo(0, -r * 0.65); c.lineTo(0, r * 0.65); c.stroke();
        [-1, 1].forEach(function (d) {
          c.beginPath(); c.moveTo(0, d * r * 0.45); c.lineTo(4, d * r * 0.25); c.stroke();
          c.beginPath(); c.moveTo(0, d * r * 0.45); c.lineTo(-4, d * r * 0.25); c.stroke();
        });
        c.restore();
      }
    } else {
      c.fillStyle = '#f8f1e6';
      c.beginPath();
      c.moveTo(0, r * 0.65); c.lineTo(-r * 0.55, r * 0.25); c.lineTo(-r * 0.5, -r * 0.5); c.lineTo(r * 0.5, -r * 0.5); c.lineTo(r * 0.55, r * 0.25);
      c.closePath(); c.fill(); c.stroke();
    }
  }

  function tegnSpecials() {
    var s = visning.skala;
    spil.specials.forEach(function (sp) {
      var blinker = sp.tid < 2 && Math.floor(sp.tid * 6) % 2 === 0;
      if (blinker) return;
      ctx.save();
      ctx.translate(sx(sp.x), sy(sp.y + Math.sin(tid * 5) * 3));
      ctx.scale(s, s);
      tegnSpecialIkon(ctx, sp.type, INDSTIL.specialRadius);
      ctx.restore();
    });
  }

  function tegnBoble(b) {
    var s = visning.skala, r = b.r * s;
    var x = sx(b.x), y = sy(b.y);
    var farve = spil.frys > 0 ? '#dfeef0' : BOBLEFARVER[b.str];
    ctx.save();
    // Malet boble: lys foroven, dyb mod kanten. Radius og plads er uaendret.
    ctx.shadowColor = 'rgba(40,50,60,0.28)';
    ctx.shadowBlur = r * 0.35;
    ctx.shadowOffsetY = r * 0.14;
    var maling = ctx.createRadialGradient(x - r * 0.32, y - r * 0.36, r * 0.08, x, y, r);
    maling.addColorStop(0, '#ffffff');
    maling.addColorStop(0.24, farve);
    maling.addColorStop(0.86, farve);
    maling.addColorStop(1, dybere(farve));
    ctx.fillStyle = maling;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.34, y - r * 0.36, r * 0.24, r * 0.15, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = Math.max(2, r * 0.09);
    ctx.beginPath();
    ctx.arc(x, y, r * 0.8, 0.5, 2.1);
    ctx.stroke();
  }

  /** Figuren: rund krop, oejne der kigger mod naermeste boble, hat, ben. */
  /** Sprite-udgaven: figur fra Kenney med pose efter hvad der sker. Returnerer false hvis ikke hentet. */
  function tegnFigurSprite(c, farve, figur, kigX, gang, svimmel, jubler) {
    var R = INDSTIL.spillerRadius;
    var img, h, w, dy = 0, vip = 0;
    var malet = MALEDE.indexOf(figur) >= 0 ? Sprites.hent('billeder/' + figur + '.png') : null;
    if (malet && Sprites.venter(malet)) return true;
    if (malet && Sprites.klar(malet)) {
      // Den malede figur: ét billede, som gaar ved at vippe og hoppe lidt, og jubler ved at hoppe hoejt
      img = malet; h = R * 3.4; w = h * img.naturalWidth / img.naturalHeight;
      if (jubler) { dy = -Math.abs(Math.sin(tid * 8)) * 10; }
      else if (gang) { dy = -Math.abs(Math.sin(gang * 0.22)) * 3; vip = Math.sin(gang * 0.22) * 0.05; }
    } else {
      var pose = svimmel > 0 ? 'hurt' : (jubler ? (Math.floor(tid * 6) % 2 ? 'cheer1' : 'cheer2') : (gang ? (Math.floor(gang / 14) % 2 ? 'walk1' : 'walk2') : 'idle'));
      img = Sprites.hent('../../assets/kenney/' + figur + '_' + pose + '.png');
      if (Sprites.venter(img)) return true;     // paa vej: tegn ingenting, saa den gamle figur ikke blinker frem
      if (!Sprites.klar(img)) return false;     // fejlet: brug kodetegningen
      h = R * 2.7; w = h * 80 / 110;
    }
    // Farvet maatte under figuren, saa man ved hvilken der er ens
    c.fillStyle = farve.lak;
    c.globalAlpha = 0.55;
    c.beginPath(); c.ellipse(0, R - 2, Math.max(w * 0.6, R * 0.9), 7, 0, 0, Math.PI * 2); c.fill();
    c.globalAlpha = 1;
    c.save();
    if (kigX < 0) c.scale(-1, 1);
    if (svimmel > 0) c.rotate(Math.sin(tid * 12) * 0.08);
    else if (vip) { c.translate(0, R); c.rotate(vip); c.translate(0, -R); }
    c.drawImage(img, -w / 2, R - h + dy, w, h);
    c.restore();
    if (svimmel > 0) {
      c.fillStyle = '#f0c46a';
      for (var k = 0; k < 3; k++) {
        var v = tid * 5 + k * Math.PI * 2 / 3;
        var x = Math.cos(v) * 22, y = R - h - 6 + Math.sin(v) * 5;
        c.beginPath();
        for (var j = 0; j < 10; j++) {
          var rr = j % 2 ? 2.5 : 6, vv = -Math.PI / 2 + j * Math.PI / 5;
          c.lineTo(x + Math.cos(vv) * rr, y + Math.sin(vv) * rr);
        }
        c.closePath();
        c.fill();
      }
    }
    return true;
  }

  function tegnFigurForm(c, farve, hat, kigX, kigY, gang, svimmel, figur, jubler) {
    if (figur && tegnFigurSprite(c, farve, figur, kigX, gang, svimmel, jubler)) return;
    var R = INDSTIL.spillerRadius;
    c.save();
    if (svimmel > 0) c.rotate(Math.sin(tid * 12) * 0.12);

    // Ben
    c.strokeStyle = '#5e4a3a';
    c.lineWidth = 4;
    c.lineCap = 'round';
    [-1, 1].forEach(function (d) {
      var sving = Math.sin(gang * 0.12 + (d > 0 ? Math.PI : 0)) * 6;
      c.beginPath();
      c.moveTo(d * 9, -R * 0.2);
      c.lineTo(d * 9 + sving, R * 0.95);
      c.stroke();
    });

    // Krop
    c.fillStyle = farve.lak;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    c.ellipse(-R * 0.35, -R * 0.45, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2);
    c.fill();

    // Oejne
    var vinkel = Math.atan2(kigY, kigX);
    [-1, 1].forEach(function (d) {
      var cx = d * 9, cy = -4;
      c.fillStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#5e4a3a';
      c.beginPath();
      if (svimmel > 0) {
        c.arc(cx + Math.cos(tid * 15 + d) * 3, cy + Math.sin(tid * 15) * 3, 3, 0, Math.PI * 2);
      } else {
        c.arc(cx + Math.cos(vinkel) * 3, cy + Math.sin(vinkel) * 3, 3.2, 0, Math.PI * 2);
      }
      c.fill();
    });
    // Mund
    c.lineWidth = 2.5;
    c.beginPath();
    if (svimmel > 0) c.arc(0, 12, 5, 0, Math.PI * 2);
    else c.arc(0, 6, 7, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();

    // Hat
    c.fillStyle = '#5e4a3a';
    if (hat === 'kasket') {
      c.fillStyle = farve.lak === '#5e4a3a' ? '#f8f1e6' : '#5e4a3a';
      c.beginPath(); c.arc(0, -R * 0.55, R * 0.72, Math.PI, 0); c.closePath(); c.fill();
      c.fillRect(-R * 0.2, -R * 0.6, R * 1.1, 6);
    } else if (hat === 'hjelm') {
      c.fillStyle = '#f8f1e6';
      c.beginPath(); c.arc(0, -R * 0.4, R * 0.8, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#d95f45';
      c.fillRect(-4, -R * 1.2, 8, R * 0.7);
    } else {
      c.fillStyle = '#d95f45';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.moveTo(0, -R * 0.95);
        c.lineTo(d * 16, -R * 1.25);
        c.lineTo(d * 16, -R * 0.65);
        c.closePath();
        c.fill();
        c.stroke();
      });
      c.beginPath(); c.arc(0, -R * 0.95, 4, 0, Math.PI * 2); c.fill();
    }

    // Svimmel: stjerner over hovedet
    if (svimmel > 0) {
      c.fillStyle = '#f0c46a';
      for (var k = 0; k < 3; k++) {
        var v = tid * 5 + k * Math.PI * 2 / 3;
        var x = Math.cos(v) * 22, y = -R * 1.35 + Math.sin(v) * 6;
        c.beginPath();
        for (var j = 0; j < 10; j++) {
          var rr = j % 2 ? 2.5 : 6, vv = -Math.PI / 2 + j * Math.PI / 5;
          c.lineTo(x + Math.cos(vv) * rr, y + Math.sin(vv) * rr);
        }
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }

  function naermesteBoble(x) {
    var bedst = null;
    spil.bobler.forEach(function (b) { if (!bedst || Math.abs(b.x - x) < Math.abs(bedst.x - x)) bedst = b; });
    return bedst;
  }

  function tegnSpiller(s, i) {
    var u = udseende[i];
    var sk = visning.skala, R = INDSTIL.spillerRadius;
    // Snore. En klaebesnor der haenger, tegnes fra loftet og ned til der hvor den blev skudt fra.
    s.skud.forEach(function (k) {
      ctx.save();
      ctx.strokeStyle = '#5e4a3a';
      ctx.lineWidth = 6 * sk;
      ctx.lineCap = 'round';
      ctx.beginPath();
      var fra = k.haenger > 0 ? R * 0.5 : R * 1.6, til = k.y;
      for (var y = fra; y <= til; y += 8) {
        var x = k.x + Math.sin(y * 0.15 + tid * 30) * (k.haenger > 0 ? 1.5 : 4);
        if (y === fra) ctx.moveTo(sx(x), sy(y)); else ctx.lineTo(sx(x), sy(y));
      }
      ctx.stroke();
      ctx.strokeStyle = k.klaeber ? '#e08a52' : '#f0c46a';
      ctx.lineWidth = 2.5 * sk;
      ctx.stroke();
      ctx.fillStyle = k.klaeber ? '#e08a52' : '#f0c46a';
      ctx.beginPath();
      if (k.haenger > 0) {
        ctx.arc(sx(k.x), sy(til - 6), 7 * sk, 0, Math.PI * 2);
      } else {
        ctx.moveTo(sx(k.x), sy(til + 14));
        ctx.lineTo(sx(k.x - 8), sy(til));
        ctx.lineTo(sx(k.x + 8), sy(til));
        ctx.closePath();
      }
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
    // Skygge
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx(s.x), sy(0) + 2 * sk, R * sk, 5 * sk, 0, 0, Math.PI * 2);
    ctx.fill();

    var b = naermesteBoble(s.x);
    ctx.save();
    ctx.translate(sx(s.x), sy(R));
    ctx.scale(sk, sk);
    if (s.skjold) {
      ctx.fillStyle = 'rgba(76,185,68,0.28)';
      ctx.strokeStyle = '#7ab648';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, R * 1.45 + Math.sin(tid * 6) * 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    }
    var retning = b ? b.x - s.x : (s.vx < 0 ? -1 : 1);   // kigger mod naermeste boble
    tegnFigurForm(ctx, u.farve, u.hat, retning, b ? -(b.y - R) : -0.3, s.vx !== 0 ? s.x : 0, s.svimmel, u.figur, flotTekst > 0 || spil.faerdig);
    // Aktiv special over hovedet med en ring der loeber ud
    var aktiv = s.dobbelt > 0 ? ['dobbelt', s.dobbelt / INDSTIL.dobbeltTid] : (s.klaebe > 0 ? ['klaebe', s.klaebe / INDSTIL.klaebeTid] : null);
    if (aktiv) {
      ctx.save();
      ctx.translate(0, -R * 2.1);
      ctx.scale(0.65, 0.65);
      tegnSpecialIkon(ctx, aktiv[0], INDSTIL.specialRadius);
      ctx.strokeStyle = '#5e4a3a';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(0, 0, INDSTIL.specialRadius + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * aktiv[1]); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  function tegnFremskridt() {
    var s = visning.skala;
    var antal = Bobler.BANER.length;
    var y = visning.oy + 26 * s;
    var midt = window.innerWidth / 2;
    for (var i = 0; i < antal; i++) {
      var x = midt + (i - (antal - 1) / 2) * 30 * s;
      var aktuel = i === spil.bane && !spil.faerdig;
      ctx.beginPath();
      ctx.arc(x, y, (aktuel ? 11 + Math.sin(tid * 6) : 9) * s, 0, Math.PI * 2);
      ctx.fillStyle = i < spil.bane || spil.faerdig ? '#f0c46a' : (aktuel ? '#f8f1e6' : 'rgba(255,255,255,0.35)');
      ctx.fill();
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = '#5e4a3a';
      ctx.stroke();
    }
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

  function tegnKnapper() {
    var B = window.innerWidth, H = window.innerHeight;
    var y = H - 60;
    styring.zoner.forEach(function (z) {
      var aktiv = styring.trykket(z.spiller, z.knap);
      var midt = (z.x0 + z.x1) / 2 * B;
      var s = aktiv ? 1.3 : 1;
      ctx.save();
      ctx.globalAlpha = aktiv ? 1 : 0.55;
      ctx.fillStyle = aktiv ? '#f0c46a' : udseende[z.spiller].farve.lak;
      ctx.strokeStyle = '#5e4a3a';
      ctx.lineWidth = aktiv ? 4 : 0;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (z.knap === 'skyd') {
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
      ctx.fillStyle = 'rgba(94,74,58,0.4)';
      ctx.fillRect(B / 2 - 2, H - 100, 4, 90);
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnBaggrund();
    if (!spil) return;
    tegnPlatforme();
    tegnPartikler();
    tegnSpecials();
    spil.bobler.forEach(tegnBoble);
    spil.spillere.forEach(tegnSpiller);
    if (spil.frys > 0) {
      ctx.fillStyle = 'rgba(127,208,245,' + (0.12 + 0.1 * Math.min(1, spil.frys)) + ')';
      ctx.fillRect(0, 0, B, H);
    }
    tegnFremskridt();
    tegnKnapper();

    if (flotTekst > 0 && !spil.faerdig) {
      var t = Math.min(1, (1.6 - flotTekst) * 4);
      ctx.save();
      ctx.translate(B / 2, H * 0.4);
      ctx.scale(t, t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 120px ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#5e4a3a';
      ctx.fillStyle = '#f0c46a';
      ctx.strokeText('Flot!', 0, 0);
      ctx.fillText('Flot!', 0, 0);
      ctx.restore();
    }
  }

  /* ---------- slutskaerm ---------- */

  function tegnEksempel(canvas, farve, hat, skala, figur) {
    var c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(canvas.width / 2, canvas.height * 0.58);
    c.scale(skala, skala);
    tegnFigurForm(c, farve, hat, 1, -0.3, 0, 0, figur, false);
    c.restore();
  }

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) {
      konfetti.push({
        x: Math.random() * canvas.width, y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
        b: 6 + Math.random() * 6, h: 4 + Math.random() * 4, farve: FARVER[i % FARVER.length].lak
      });
    }
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d');
    c.clearRect(0, 0, vinderCanvas.width, vinderCanvas.height);
    var n = antalSpillere;
    for (var i = 0; i < n; i++) {
      c.save();
      c.translate(vinderCanvas.width * (n === 1 ? 0.5 : 0.3 + i * 0.4), vinderCanvas.height * 0.58);
      c.scale(2.2, 2.2);
      tegnFigurForm(c, udseende[i].farve, udseende[i].hat, i === 0 ? 1 : -1, -0.3, 0, 0, udseende[i].figur, true);
      c.restore();
    }
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
    visOverlay(
      '<div class="kort">' +
      '<h2>' + (antalSpillere === 1 ? 'Du klarede alle baner!' : 'I klarede alle baner!') + '</h2>' +
      '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '"></canvas>' +
      Menu.slutRaekke('igen', { handling: 'figurvalg', navn: 'Vælg figur' }) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    startKonfetti(vinderCanvas);
  }

  /* ---------- loop ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t;
    if (tilstand === 'spiller') opdater(dt);
    else if (tilstand === 'faerdig') { tid += dt; opdaterPartikler(dt); tegnVinder(dt); }
    else tid += dt;
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
      '<h2>Boblehavet</h2>' +
      '<p class="hjaelp">Løb med siderne, skyd med midten. Saml det, der falder ned.</p>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
  }

  var EKSEMPEL_STIL = 'position:static;display:block;width:150px;height:110px;align-self:center';
  var MINI_STIL = 'position:static;display:block;width:100%;height:100%';

  function visFigurValg() {
    tilstand = 'venter';
    var soejler = '';
    for (var s = 0; s < antalSpillere; s++) {
      var v = valg[s];
      var anden = antalSpillere === 2 ? valg[1 - s] : null;
      var former = FIGURER.map(function (f, i) {
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
      tegnEksempel(cv, FARVER[+cv.dataset.farve], HATTE[+cv.dataset.form % HATTE.length], 1.1, FIGURER[+cv.dataset.form]);
    });
    overlay.querySelectorAll('canvas.eksempel[data-spiller]').forEach(function (cv) {
      var v = valg[+cv.dataset.spiller];
      tegnEksempel(cv, FARVER[v.farve], HATTE[v.form % HATTE.length], 2.2, FIGURER[v.form]);
    });
    // Sprites kan vaere paa vej: tegn igen naar de er hentet
    if (!visFigurValg.venter) {
      visFigurValg.venter = Sprites.naarKlar(ALLE_SPRITES, function () { visFigurValg.venter = false; if (overlay.querySelector('canvas[data-form]')) visFigurValg(); });
    }
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
      visFigurValg();
    } else if (h === 'form' || h === 'farve') {
      var v = valg[parseInt(knap.dataset.spiller, 10)];
      v[h] = parseInt(knap.dataset.i, 10);
      tone(h === 'form' ? 600 : 700, 0.08);
      visFigurValg();
    } else if (h === 'figurvalg') {
      visFigurValg();
    } else if (h === 'spil' || h === 'igen') {
      skjulOverlay();
      nytSpil(antalSpillere);
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
      bane: spil ? spil.bane : null, faerdig: spil ? spil.faerdig : null,
      tema: spil ? spil.tema : null, frys: spil ? +spil.frys.toFixed(2) : null,
      specials: spil ? spil.specials.map(function (p) { return { x: Math.round(p.x), y: Math.round(p.y), type: p.type }; }) : null,
      bobler: spil ? spil.bobler.map(function (b) { return { x: Math.round(b.x), y: Math.round(b.y), str: b.str }; }) : null,
      spillere_: spil ? spil.spillere.map(function (s) { return { x: Math.round(s.x), svimmel: +s.svimmel.toFixed(2), skud: s.skud.length, dobbelt: +s.dobbelt.toFixed(1), klaebe: +s.klaebe.toFixed(1), skjold: s.skjold, poppede: s.poppede }; }) : null,
      input: [styring.input(0), styring.input(1)]
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
