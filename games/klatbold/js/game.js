/**
 * Klatbold.
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

  // Farverne er dem der findes i Kenneys Shape Characters (sprite-navn).
  var FARVER = [
    { lak: '#e8442e', navn: 'Rød', sprite: 'red' },
    { lak: '#3aa7e0', navn: 'Blå', sprite: 'blue' },
    { lak: '#4cb944', navn: 'Grøn', sprite: 'green' },
    { lak: '#ffd23f', navn: 'Gul', sprite: 'yellow' },
    { lak: '#9b5de5', navn: 'Lilla', sprite: 'purple' },
    { lak: '#f28cc0', navn: 'Pink', sprite: 'pink' }
  ];
  var FJAES = ['glad', 'sej', 'soed'];
  var ANSIGT = { glad: 'a', sej: 'e', soed: 'c', jubel: 'c', sur: 'k' };   // -> assets/kenney/ansigt_<x>.png
  // Alle sprites hentes med det samme, saa de er klar foer foerste kamp
  var ALLE_SPRITES = ['red', 'blue', 'green', 'yellow', 'purple', 'pink'].map(function (f) { return '../../assets/kenney/klat_' + f + '.png'; })
    .concat(['a', 'c', 'e', 'k'].map(function (a) { return '../../assets/kenney/ansigt_' + a + '.png'; }));
  Sprites.forhent(ALLE_SPRITES);

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

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    var himmel = ctx.createLinearGradient(0, 0, 0, H);
    himmel.addColorStop(0, '#7fd0f5');
    himmel.addColorStop(1, '#c9ecfb');
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, B, H);

    // Sol
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(sx(120), sy(INDSTIL.hoejde - 70), 38 * visning.skala, 0, Math.PI * 2);
    ctx.fill();

    // Skyer (faste, saa de ikke flimrer)
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    [[300, 450, 1], [640, 500, 0.8], [850, 430, 1.1]].forEach(function (s) {
      var x = sx(s[0]), y = sy(s[1]), r = 26 * s[2] * visning.skala;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - r * 1.1, y + r * 0.25, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });

    // Graes under jorden og helt ned
    ctx.fillStyle = '#3f8f52';
    ctx.fillRect(0, sy(0), B, H - sy(0));
    ctx.fillStyle = '#4cb944';
    ctx.fillRect(sx(0), sy(0), INDSTIL.bredde * visning.skala, 10 * visning.skala);

    // Midterlinje og midtercirkel
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3 * visning.skala;
    ctx.beginPath();
    ctx.moveTo(sx(INDSTIL.bredde / 2), sy(0));
    ctx.lineTo(sx(INDSTIL.bredde / 2), sy(0) + 40 * visning.skala);
    ctx.stroke();
  }

  function tegnMaal(side) {
    var MD = INDSTIL.maalDybde, MH = INDSTIL.maalHoejde, B = INDSTIL.bredde;
    var x0 = side === 0 ? 0 : B - MD, x1 = side === 0 ? MD : B;
    var s = visning.skala;
    // Net
    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 1.5 * s;
    for (var x = x0; x <= x1; x += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x), sy(0)); ctx.lineTo(sx(x), sy(MH)); ctx.stroke();
    }
    for (var y = 0; y <= MH; y += 12) {
      ctx.beginPath(); ctx.moveTo(sx(x0), sy(y)); ctx.lineTo(sx(x1), sy(y)); ctx.stroke();
    }
    // Overligger og stolpe
    ctx.strokeStyle = '#f7f3e8';
    ctx.lineWidth = 8 * s;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(sx(side === 0 ? 0 : B), sy(MH));
    ctx.lineTo(sx(side === 0 ? MD : B - MD), sy(MH));
    ctx.stroke();
    ctx.strokeStyle = '#12261f';
    ctx.lineWidth = 2 * s;
    ctx.beginPath();
    ctx.moveTo(sx(side === 0 ? 0 : B), sy(MH) - 4 * s);
    ctx.lineTo(sx(side === 0 ? MD : B - MD), sy(MH) - 4 * s);
    ctx.stroke();
  }

  /**
   * Tegner en klat med fronten mod (kigX, kigY). Bruges baade paa banen og
   * i menuen, derfor egen context. Enheder i verden-px, skaleres udenom.
   */
  function tegnKlatForm(c, farve, fjaes, kigX, kigY, sq, stemning) {
    var R = INDSTIL.klatRadius;
    var sqx = 1 + sq * 0.25, sqy = 1 - sq * 0.3;
    stemning = stemning || 0;

    // Sprite fra Kenney: en rund krop klippet til en halvcirkel, og et ansigt
    // der kigger lidt mod bolden. Falder tilbage til kodetegningen til det er hentet.
    var krop = Sprites.hent('../../assets/kenney/klat_' + farve.sprite + '.png');
    var ansigt = Sprites.hent('../../assets/kenney/ansigt_' + (stemning > 0 ? ANSIGT.jubel : (stemning < 0 ? ANSIGT.sur : ANSIGT[fjaes] || 'a')) + '.png');
    // Paa vej: tegn ingenting, saa den gamle kodetegning ikke blinker frem foerst
    if (Sprites.venter(krop) || Sprites.venter(ansigt)) return;
    if (Sprites.klar(krop) && Sprites.klar(ansigt)) {
      c.save();
      c.scale(sqx, sqy);
      c.beginPath();
      c.rect(-R - 4, -R - 4, R * 2 + 8, R + 4);
      c.clip();
      c.drawImage(krop, -R, -R, R * 2, R * 2);
      c.restore();
      var side = kigX >= 0 ? 1 : -1;
      var aw = R * 1.05, ah = aw * 29 / 50;
      var dx = Math.max(-1, Math.min(1, kigX / 200)) * R * 0.08;
      c.drawImage(ansigt, -aw / 2 + dx + side * R * 0.05, -R * 0.78 + Math.max(0, stemning) * -2, aw, ah);
      return;
    }

    c.save();
    c.scale(sqx, sqy);
    // Krop: halvcirkel
    c.fillStyle = farve.lak;
    c.strokeStyle = '#12261f';
    c.lineWidth = 4;
    c.beginPath();
    c.arc(0, 0, R, Math.PI, 0);
    c.closePath();
    c.fill();
    c.stroke();
    // Glans
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath();
    c.ellipse(-R * 0.35, -R * 0.55, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2);
    c.fill();
    c.restore();

    // Oejne kigger mod bolden
    var vinkel = Math.atan2(kigY, kigX);
    var side = kigX >= 0 ? 1 : -1;
    var øx = side * R * 0.45, øy = -R * 0.5;
    if (fjaes === 'sej') {
      c.fillStyle = '#12261f';
      c.beginPath();
      c.roundRect(øx - 30, øy - 9, 60, 18, 6);
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.fillRect(øx - 24, øy - 6, 10, 4);
    } else if (fjaes === 'stjerne') {
      c.fillStyle = '#ffd23f';
      c.strokeStyle = '#12261f';
      c.lineWidth = 2;
      [-1, 1].forEach(function (d) {
        var cx = øx + d * 14, cy = øy;
        c.beginPath();
        for (var k = 0; k < 10; k++) {
          var r = k % 2 ? 4 : 10, v = -Math.PI / 2 + k * Math.PI / 5;
          c.lineTo(cx + Math.cos(v) * r, cy + Math.sin(v) * r);
        }
        c.closePath();
        c.fill();
        c.stroke();
      });
    } else {
      [-1, 1].forEach(function (d) {
        var cx = øx + d * 13, cy = øy;
        c.fillStyle = '#fff';
        c.strokeStyle = '#12261f';
        c.lineWidth = 2.5;
        c.beginPath();
        c.arc(cx, cy, 10, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.fillStyle = '#12261f';
        c.beginPath();
        c.arc(cx + Math.cos(vinkel) * 4, cy + Math.sin(vinkel) * 4, 4.5, 0, Math.PI * 2);
        c.fill();
      });
    }
    // Mund: smil, stort smil naar man har scoret, sur naar man har faaet et maal imod
    c.strokeStyle = '#12261f';
    c.lineWidth = 3;
    c.lineCap = 'round';
    c.beginPath();
    if (stemning < 0) {
      c.arc(side * R * 0.5, -R * 0.08, 9, 1.15 * Math.PI, 1.85 * Math.PI);
    } else {
      var størrelse = stemning > 0 ? 14 : 9;
      c.arc(side * R * 0.5, -R * 0.2, størrelse, 0.15 * Math.PI, 0.85 * Math.PI);
    }
    c.stroke();
    if (stemning > 0) {
      // Roede kinder
      c.fillStyle = 'rgba(232,68,46,0.45)';
      c.beginPath(); c.arc(side * R * 0.15, -R * 0.15, 6, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(side * R * 0.85, -R * 0.15, 6, 0, Math.PI * 2); c.fill();
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
      ctx.globalAlpha = h.liv * 1.6;
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(sx(h.x), sy(h.y), r * h.liv * 3, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.ellipse(sx(b.x), sy(0) + 3 * s, r * Math.max(0.3, 1 - b.y / 500), 4 * s, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.translate(sx(b.x), sy(b.y));
    ctx.rotate(b.x / 40);
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#12261f';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#12261f';
    for (var k = 0; k < 5; k++) {
      var v = k * Math.PI * 2 / 5;
      ctx.beginPath();
      ctx.arc(Math.cos(v) * r * 0.55, Math.sin(v) * r * 0.55, r * 0.22, 0, Math.PI * 2);
      ctx.fill();
    }
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
        ctx.strokeStyle = '#12261f';
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
      ctx.fillStyle = aktiv ? '#ffd23f' : udseende[z.spiller].farve.lak;
      ctx.strokeStyle = '#12261f';
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
      ctx.fillStyle = 'rgba(18,38,31,0.5)';
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
      ctx.strokeStyle = '#12261f';
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
      '<h2>Klatbold</h2>' +
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
      '<h2>Vælg din klat</h2>' +
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
    if (!visKlatValg.venter) {
      visKlatValg.venter = Sprites.naarKlar(ALLE_SPRITES, function () { visKlatValg.venter = false; if (overlay.querySelector('canvas[data-form]')) visKlatValg(); });
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
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
