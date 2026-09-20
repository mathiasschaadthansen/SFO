/**
 * Racerbanen.
 *
 * Styring: hold fingeren i venstre eller hoejre side af din halvdel.
 * Bilen koerer af sig selv. Ingen speeder, ingen bremse, ingen game over.
 *
 * Denne fil er kun skaerm og lyd: menu, kamera, split screen, tegning,
 * partikler og toner. Fysik, AI og alle tal der bestemmer hvordan det
 * FOELES ligger i js/physics.js.
 */
(function () {
  'use strict';

  var INDSTIL = Fysik.INDSTIL;

  // roundRect kom foerst i Safari 16. Skole-iPads er tit et par aar bagud.
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

  // Farver boernene kan vaelge. Hver bil er malet: lys top, lak og dyb kant,
  // og ruder i en koelig tone, saa de kan ses mod lakken.
  var FARVER = [
    { navn: 'Rød',    lys: '#f6a68d', lak: '#e4644a', moerk: '#a83a24', rude: '#7f96a2', rudeLys: '#cfe0e6' },
    { navn: 'Blå',    lys: '#9ad2f0', lak: '#3f9ad6', moerk: '#23648f', rude: '#7f96a2', rudeLys: '#dceaf0' },
    { navn: 'Grøn',   lys: '#c3e08e', lak: '#7ab648', moerk: '#4a7a2c', rude: '#7f96a2', rudeLys: '#dceaf0' },
    { navn: 'Gul',    lys: '#ffe2a0', lak: '#f2c14e', moerk: '#c48f24', rude: '#8a8f7e', rudeLys: '#e4e8d8' },
    { navn: 'Lilla',  lys: '#d3bff2', lak: '#9b7bd4', moerk: '#654a9c', rude: '#8b8ba2', rudeLys: '#e0dcee' },
    { navn: 'Orange', lys: '#ffc9a0', lak: '#ef9152', moerk: '#bd6226', rude: '#8a8f7e', rudeLys: '#e8e2d4' }
  ];
  var FORMER = ['racer', 'bus', 'truck'];

  // Hvad hver spiller har valgt. Ligger kun i hukommelsen, saa det
  // forsvinder naar siden lukkes. Intet gemmes om boernene.
  var valg = [
    { farve: 0, form: 0 },
    { farve: 1, form: 0 }
  ];
  var svaerhed = 0;       // 0, 1 eller 2 stjerner ud over den foerste
  var lydTil = true;      // paedagogerne kan slaa lyden fra i menuen

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');
  var styring = new Styring(lærred);

  var bane = null;
  var biler = [];
  var tilstand = 'venter';     // venter | nedtaelling | koerer | faerdig
  var nedtaelling = 0;
  var antalSpillere = 1;
  var sidsteTid = 0;
  var lyd = null;

  var partikler = [];          // stoev, gnister og puf
  var spor = null;             // bremsespor, tegnes oven paa banen
  var vinderCanvas = null;     // konfetti paa slutskaermen
  var konfetti = [];

  /* ---------- lyd (ingen filer, kun toner) ---------- */

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

  function tone(frekvens, længde, styrke) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination);
      o.start();
      o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt, aldrig kritisk */ }
  }

  /** Flere toner efter hinanden, fx et lille hurra. */
  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum);
    });
  }

  /**
   * Motorlyd: en savtak gennem et lavpasfilter pr. spillerbil.
   * Tonehoejden foelger farten, saa man kan hoere naar man rammer turbo
   * eller koerer i graesset.
   */
  function startMotorer() {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      biler.forEach(function (bil) {
        if (bil.erAI) return;
        var o = k.createOscillator();
        var f = k.createBiquadFilter();
        var g = k.createGain();
        o.type = 'sawtooth';
        o.frequency.value = 60;
        f.type = 'lowpass';
        f.frequency.value = 320;
        g.gain.value = 0;
        o.connect(f).connect(g).connect(k.destination);
        o.start();
        bil.motor = { o: o, g: g };
      });
    } catch (e) { /* ingen motorlyd, spillet koerer alligevel */ }
  }

  function opdaterMotor(bil, påAsfalt) {
    if (!bil.motor || !lyd) return;
    var f = 55 + bil.fart * 0.42 + (bil.turbo > 0 ? 70 : 0);
    var styrke = bil.faerdig ? 0.012 : (påAsfalt ? 0.035 : 0.022);
    bil.motor.o.frequency.setTargetAtTime(f, lyd.currentTime, 0.06);
    bil.motor.g.gain.setTargetAtTime(styrke, lyd.currentTime, 0.12);
  }

  function stopMotorer() {
    biler.forEach(function (bil) {
      if (!bil.motor) return;
      try {
        bil.motor.g.gain.setTargetAtTime(0, lyd.currentTime, 0.05);
        bil.motor.o.stop(lyd.currentTime + 0.4);
      } catch (e) { /* ignorer */ }
      bil.motor = null;
    });
  }

  /* ---------- lærred ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    opdaterZoner();
  }

  function opdaterZoner() {
    var zoner = [];
    if (antalSpillere === 1) {
      zoner.push({ x0: 0, x1: 0.5, y0: 0, y1: 1, spiller: 0, retning: -1 });
      zoner.push({ x0: 0.5, x1: 1, y0: 0, y1: 1, spiller: 0, retning: 1 });
    } else {
      zoner.push({ x0: 0,    x1: 0.25, y0: 0, y1: 1, spiller: 0, retning: -1 });
      zoner.push({ x0: 0.25, x1: 0.5,  y0: 0, y1: 1, spiller: 0, retning: 1 });
      zoner.push({ x0: 0.5,  x1: 0.75, y0: 0, y1: 1, spiller: 1, retning: -1 });
      zoner.push({ x0: 0.75, x1: 1,    y0: 0, y1: 1, spiller: 1, retning: 1 });
    }
    styring.saetZoner(zoner);
  }

  /* ---------- biler ---------- */

  function ledigFarve(brugte) {
    for (var i = 0; i < FARVER.length; i++) {
      if (brugte.indexOf(i) < 0) return i;
    }
    return 0;
  }

  /** plads og antal bestemmer hvor paa startlinjen bilen staar. */
  function nyBil(spiller, erAI, plads, antal, v) {
    var vinkelret = bane.startVinkel + Math.PI / 2;
    var forskyd = (plads - (antal - 1) / 2) * 42;
    return {
      x: bane.start.x + Math.cos(vinkelret) * forskyd,
      y: bane.start.y + Math.sin(vinkelret) * forskyd,
      vinkel: bane.startVinkel,
      fart: 0,
      farve: FARVER[v.farve],
      form: FORMER[v.form],
      omgang: 0,
      næsteCp: 1,
      graestid: 0,
      genstart: 0,
      turbo: 0,
      erAI: !!erAI,
      spiller: spiller,
      placering: 0,
      faerdig: false
    };
  }

  function nulstilLøb(spillere) {
    antalSpillere = spillere;
    var niveau = Fysik.saetSvaerhed(svaerhed);
    var antalAI = (spillere === 1 ? 1 : 0) + niveau.ekstraAI;
    var antal = spillere + antalAI;
    var brugte = [];

    biler = [];
    for (var s = 0; s < spillere; s++) {
      brugte.push(valg[s].farve);
      biler.push(nyBil(s, false, s, antal, valg[s]));
    }
    // AI'erne tager farver ingen boern har valgt og en tilfaeldig form.
    // Er der to, faar de hver sin koerebane, saa de ikke skubber til hinanden.
    for (var a = 0; a < antalAI; a++) {
      var farve = ledigFarve(brugte);
      brugte.push(farve);
      var ai = nyBil(spillere + a, true, spillere + a, antal,
        { farve: farve, form: Math.floor(Math.random() * FORMER.length) });
      ai.koerebane = antalAI > 1 ? (a === 0 ? 0.7 : -0.7) : 0;
      biler.push(ai);
    }

    partikler = [];
    nulstilSpor();
    tilstand = 'nedtaelling';
    nedtaelling = 3.2;
    styring.nulstil();
    opdaterZoner();
    startMotorer();
  }

  function mennesker() {
    return biler.filter(function (b) { return !b.erAI; });
  }

  /** Den spiller der er laengst fremme. AI'ens elastik maaler sig mod den. */
  function foerendeMenneske() {
    var bedst = null, bedstF = -1;
    biler.forEach(function (b) {
      if (b.erAI) return;
      var f = Fysik.fremdrift(b, bane);
      if (f > bedstF) { bedstF = f; bedst = b; }
    });
    return bedst;
  }

  /* ---------- partikler og spor ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 320) return;
      var v = Math.random() * Math.PI * 2;
      var f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({
        x: x, y: y,
        vx: Math.cos(v) * f, vy: Math.sin(v) * f,
        liv: liv, maxLiv: liv, r: r * (0.6 + Math.random() * 0.8), farve: farve
      });
    }
  }

  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.92;
      p.vy *= 0.92;
      p.liv -= dt;
      if (p.liv <= 0) partikler.splice(i, 1);
    }
  }

  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv) * 0.8;
      ctx.fillStyle = p.farve;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function nulstilSpor() {
    if (!spor || spor.width !== bane.bredde || spor.height !== bane.hoejde) {
      spor = document.createElement('canvas');
      spor.width = bane.bredde;
      spor.height = bane.hoejde;
    }
    spor.getContext('2d').clearRect(0, 0, spor.width, spor.height);
  }

  /** Moerke maerker efter baghjulene naar man svinger haardt i fart. */
  function tegnSpor(bil) {
    var c = spor.getContext('2d');
    var L = INDSTIL.bilLaengde, B = INDSTIL.bilBredde;
    var cos = Math.cos(bil.vinkel), sin = Math.sin(bil.vinkel);
    c.fillStyle = 'rgba(94,74,58,0.18)';
    [-1, 1].forEach(function (side) {
      var lx = -L / 2 + 8, ly = side * B / 2;
      var x = bil.x + lx * cos - ly * sin;
      var y = bil.y + lx * sin + ly * cos;
      c.beginPath();
      c.arc(x, y, 2.6, 0, Math.PI * 2);
      c.fill();
    });
  }

  /* ---------- opdatering ---------- */

  function opdaterBil(bil, dt) {
    var ret;
    if (bil.faerdig) {
      // Aeresrunde: bilen koerer selv videre i roligt tempo, til alle er i maal.
      ret = Fysik.aiStyring(bil, bane);
      bil.fartLoft = (bil.fartLoft || 1) * 0.6;
    } else if (bil.erAI) {
      ret = Fysik.aiStyring(bil, bane, foerendeMenneske());
    } else {
      ret = styring.retning(bil.spiller);
    }

    var turboFør = bil.turbo > 0;
    var genstartFør = bil.genstart;
    var nyOmgang = Fysik.opdaterBil(bil, bane, ret, dt);
    var påAsfalt = bane.paaAsfalt(bil.x, bil.y);

    if (!turboFør && bil.turbo > 0) {
      if (!bil.erAI) melodi([660, 990], 60);
      puf(bil.x, bil.y, '#f0c46a', 14, 160, 3, 0.5);
    }
    if (bil.genstart > genstartFør) {
      // Sat tilbage paa vejen: et lille puf, saa man ser hvad der skete
      puf(bil.x, bil.y, '#f7f3e8', 22, 120, 4, 0.7);
      if (!bil.erAI) tone(220, 0.3, 0.12);
    }
    if (bil.turbo > 0 && Math.random() < 0.7) {
      puf(bil.x - Math.cos(bil.vinkel) * 14, bil.y - Math.sin(bil.vinkel) * 14, '#f0c46a', 1, 60, 2.5, 0.35);
    }
    if (!påAsfalt && bil.fart > 50 && Math.random() < 0.6) {
      puf(bil.x - Math.cos(bil.vinkel) * 10, bil.y - Math.sin(bil.vinkel) * 10, '#8a6d3b', 1, 40, 3, 0.6);
    }
    if (påAsfalt && ret !== 0 && bil.fart > 200 && !bil.faerdig) tegnSpor(bil);

    if (nyOmgang && !bil.faerdig) {
      if (!bil.erAI) melodi(bil.omgang >= INDSTIL.omgange ? [660, 880, 1100, 1320] : [660, 880], 90);
      if (bil.omgang >= INDSTIL.omgange) {
        bil.faerdig = true;
        bil.placering = biler.filter(function (b) { return b.faerdig; }).length;
      }
    }

    if (!bil.erAI) opdaterMotor(bil, påAsfalt);
  }

  /* ---------- tegning ---------- */

  /**
   * Tegner et karosseri omkring (0,0) med fronten mod hoejre.
   * Bruges baade paa banen og i vaelg-din-bil-skaermen, derfor faar den
   * sin egen context. Alle tre former har samme laengde og bredde, saa
   * kollisionen i physics.js er ens for dem alle.
   */
  function tegnKaross(c, farve, form) {
    var L = INDSTIL.bilLaengde, B = INDSTIL.bilBredde;

    // Skygge paa jorden
    c.fillStyle = 'rgba(74,58,44,0.22)';
    c.beginPath();
    c.ellipse(-2, 3, L * 0.54, B * 0.6, 0, 0, Math.PI * 2);
    c.fill();

    // Hjul: samme sorte gummi paa alle tre former, tegnet foerst
    function hjul(x, br, ud) {
      c.fillStyle = '#4a4239';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.roundRect(x, d * (B / 2 + ud) - (d > 0 ? 0 : 5), br, 5, 2.5);
        c.fill();
      });
    }

    // Malet karosseri: lyst ovenfra, dybere mod kanten
    function krop(x, y, br, h, r) {
      var g = c.createLinearGradient(0, y, 0, y + h);
      g.addColorStop(0, farve.moerk);
      g.addColorStop(0.28, farve.lak);
      g.addColorStop(0.5, farve.lys);
      g.addColorStop(0.72, farve.lak);
      g.addColorStop(1, farve.moerk);
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(x, y, br, h, r);
      c.fill();
    }

    function rude(x, y, br, h, r) {
      var g = c.createLinearGradient(x, 0, x + br, 0);
      g.addColorStop(0, farve.rude);
      g.addColorStop(1, farve.rudeLys);
      c.fillStyle = g;
      c.beginPath();
      c.roundRect(x, y, br, h, r);
      c.fill();
    }

    if (form === 'truck') {
      // Monstertruck: store hjul, lille foererhus, lad bagpaa
      hjul(-L / 2 + 1, 12, 3);
      hjul(L / 2 - 13, 12, 3);
      krop(-L / 2, -B / 2, L, B, 5);
      c.fillStyle = 'rgba(74,58,44,0.18)';
      c.beginPath(); c.roundRect(-L / 2 + 3, -B / 2 + 3, 13, B - 6, 3); c.fill();
      rude(3, -B / 2 + 3, 10, B - 6, 3);
    } else if (form === 'bus') {
      // Bus: lang kasse med en raekke ruder
      hjul(-L / 2 + 5, 8, 1);
      hjul(L / 2 - 13, 8, 1);
      krop(-L / 2, -B / 2 - 1, L, B + 2, 4);
      for (var i = 0; i < 3; i++) rude(-L / 2 + 5 + i * 8, -B / 2 + 3, 5, B - 6, 2);
      rude(L / 2 - 7, -B / 2 + 3, 4, B - 6, 2);
    } else {
      // Racer: den klassiske, med haekvinge
      hjul(-L / 2 + 4, 9, 1);
      hjul(L / 2 - 13, 9, 1);
      c.fillStyle = farve.moerk;
      c.beginPath(); c.roundRect(-L / 2 - 3, -B / 2 - 2, 4, B + 4, 2); c.fill();
      krop(-L / 2, -B / 2, L, B, 7);
      rude(-4, -B / 2 + 4, 13, B - 8, 4);
    }

    // Lys glans hen over taget
    c.fillStyle = 'rgba(255,255,255,0.22)';
    c.beginPath();
    c.ellipse(-L * 0.1, -B * 0.26, L * 0.3, B * 0.13, 0, 0, Math.PI * 2);
    c.fill();
  }

  function tegnBil(bil) {
    ctx.save();
    // En bil paa aeresrunde tegnes gennemsigtig: den er ude af loebet
    if (bil.faerdig) ctx.globalAlpha = 0.55;
    ctx.translate(bil.x, bil.y);
    ctx.rotate(bil.vinkel);
    if (bil.turbo > 0) {
      // Gul glød og flammer bagud mens turboen virker
      ctx.fillStyle = 'rgba(240,196,106,0.35)';
      ctx.beginPath();
      ctx.arc(0, 0, INDSTIL.bilLaengde * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ef9152';
      ctx.beginPath();
      ctx.moveTo(-INDSTIL.bilLaengde / 2 - 2, -6);
      ctx.lineTo(-INDSTIL.bilLaengde / 2 - 14 - Math.random() * 8, 0);
      ctx.lineTo(-INDSTIL.bilLaengde / 2 - 2, 6);
      ctx.closePath();
      ctx.fill();
    }
    tegnKaross(ctx, bil.farve, bil.form);
    ctx.restore();
  }

  /** Tegner en bil stor og med fronten opad i et lille canvas i menuen. */
  function tegnEksempel(canvas, farve, form, skala) {
    var c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(canvas.width / 2, canvas.height / 2);
    c.scale(skala, skala);
    c.rotate(-Math.PI / 2);
    tegnKaross(c, farve, form);
    c.restore();
  }

  function tegnUdsnit(bil, x, y, bredde, højde) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, bredde, højde);
    ctx.clip();
    ctx.translate(x, y);

    var skala = Math.max(bredde, højde) / 780;
    skala = Math.max(0.45, Math.min(1.25, skala));

    var kx = Math.max(bredde / (2 * skala), Math.min(bane.bredde - bredde / (2 * skala), bil.x));
    var ky = Math.max(højde / (2 * skala), Math.min(bane.hoejde - højde / (2 * skala), bil.y));

    ctx.scale(skala, skala);
    ctx.translate(bredde / (2 * skala) - kx, højde / (2 * skala) - ky);

    ctx.drawImage(bane.billede, 0, 0);
    if (spor) ctx.drawImage(spor, 0, 0);
    tegnPartikler();
    biler.forEach(tegnBil);
    ctx.restore();

    // Omgangstæller — cirkler i stedet for tal, saa 6-aarige kan aflaese den
    ctx.save();
    // Til hoejre for hjem-knappen i det foerste udsnit
    ctx.translate(x + (x === 0 ? 74 : 18), y + 32);
    for (var i = 0; i < INDSTIL.omgange; i++) {
      ctx.beginPath();
      ctx.arc(i * 26, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < bil.omgang ? bil.farve.lak : 'rgba(255,248,232,0.55)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(94,74,58,0.55)';
      ctx.stroke();
    }
    // Ternet flag naar bilen er i maal
    if (bil.faerdig) tegnFlag(INDSTIL.omgange * 26 - 4, -12);
    ctx.restore();
  }

  function tegnFlag(x, y) {
    var felt = 6;
    ctx.fillStyle = '#5e4a3a';
    ctx.fillRect(x - 2, y - 2, felt * 4 + 4, felt * 4 + 4);
    for (var r = 0; r < 4; r++) {
      for (var k = 0; k < 4; k++) {
        ctx.fillStyle = (r + k) % 2 ? '#5e4a3a' : '#f8f1e6';
        ctx.fillRect(x + k * felt, y + r * felt, felt, felt);
      }
    }
  }

  /**
   * Styrepile i bunden. Den side barnet trykker paa lyser op, saa det
   * aldrig er i tvivl om fingeren virker.
   */
  function tegnPile(x, bredde, højde, spiller) {
    var ret = styring.retning(spiller);
    var midt = x + bredde / 2;
    var y = højde - 78;
    [[midt - bredde * 0.28, -1], [midt + bredde * 0.28, 1]].forEach(function (p) {
      var aktiv = ret === p[1];
      ctx.save();
      ctx.globalAlpha = aktiv ? 0.95 : 0.5;
      ctx.fillStyle = aktiv ? '#f0c46a' : '#fff8ea';
      ctx.strokeStyle = 'rgba(94,74,58,0.6)';
      ctx.lineWidth = aktiv ? 5 : 3;
      ctx.lineJoin = 'round';
      var s = aktiv ? 1.3 : 1;
      ctx.beginPath();
      ctx.moveTo(p[0] - 18 * s * p[1], y - 24 * s);
      ctx.lineTo(p[0] + 16 * s * p[1], y);
      ctx.lineTo(p[0] - 18 * s * p[1], y + 24 * s);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    });
  }

  /**
   * Nedtaelling som lyskurv: tre roede lys taendes ét ad gangen, saa
   * bliver alle groenne. Roed, gul, groen forstaar alle, ogsaa uden tal.
   */
  function tegnLyskurv(B, H) {
    var tal = Math.ceil(nedtaelling - 0.2);
    var taendt = Math.max(0, Math.min(3, 4 - tal));
    var groen = tal <= 0;
    var r = 26, gab = 70;
    var cx = B / 2, cy = H / 2 - 30;

    ctx.save();
    ctx.fillStyle = '#6b5545';
    ctx.beginPath();
    ctx.roundRect(cx - gab - r - 18, cy - r - 18, gab * 2 + r * 2 + 36, r * 2 + 36, 24);
    ctx.fill();
    for (var i = 0; i < 3; i++) {
      var lys = groen || i < taendt;
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * gab, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = !lys ? '#4e4034' : (groen ? '#8fae86' : '#d95f45');
      ctx.fill();
      if (lys) {
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath();
        ctx.arc(cx + (i - 1) * gab - 8, cy - 8, r * 0.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    if (groen) {
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 96px ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 10;
      ctx.strokeStyle = '#6b5545';
      ctx.fillStyle = '#f0c46a';
      ctx.strokeText('KØR!', cx, cy + 110);
      ctx.fillText('KØR!', cx, cy + 110);
    }
    ctx.restore();
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);

    if (!bane) return;

    var spillere = mennesker();
    if (spillere.length === 1) {
      tegnUdsnit(spillere[0], 0, 0, B, H);
      tegnPile(0, B, H, 0);
    } else if (spillere.length === 2) {
      var halv = Math.floor(B / 2);
      tegnUdsnit(spillere[0], 0, 0, halv, H);
      tegnUdsnit(spillere[1], halv, 0, B - halv, H);
      tegnPile(0, halv, H, 0);
      tegnPile(halv, B - halv, H, 1);
      ctx.fillStyle = '#6b5545';
      ctx.fillRect(halv - 3, 0, 6, H);
    }

    if (tilstand === 'nedtaelling') tegnLyskurv(B, H);
  }

  /* ---------- slutskaerm med konfetti ---------- */

  function startKonfetti(canvas) {
    konfetti = [];
    var farver = ['#e4644a', '#3f9ad6', '#7ab648', '#f2c14e', '#9b7bd4', '#ef9152'];
    for (var i = 0; i < 70; i++) {
      konfetti.push({
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 40,
        vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI,
        vr: (Math.random() - 0.5) * 6,
        b: 6 + Math.random() * 6,
        h: 4 + Math.random() * 4,
        farve: farver[i % farver.length]
      });
    }
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d');
    var vinder = vinderCanvas._vinder;
    tegnEksempel(vinderCanvas, vinder.farve, vinder.form, 4.5);
    konfetti.forEach(function (k) {
      k.x += k.vx * dt;
      k.y += k.vy * dt;
      k.rot += k.vr * dt;
      if (k.y > vinderCanvas.height + 10) { k.y = -10; k.x = Math.random() * vinderCanvas.width; }
      c.save();
      c.translate(k.x, k.y);
      c.rotate(k.rot);
      c.fillStyle = k.farve;
      c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h);
      c.restore();
    });
  }

  /* ---------- loop ---------- */

  function løkke(tid) {
    var dt = Math.min((tid - sidsteTid) / 1000, 0.05);
    sidsteTid = tid;

    if (tilstand === 'nedtaelling') {
      var før = Math.ceil(nedtaelling - 0.2);
      nedtaelling -= dt;
      var efter = Math.ceil(nedtaelling - 0.2);
      if (efter !== før && efter >= 0) tone(efter > 0 ? 440 : 780, 0.2);
      if (nedtaelling <= -0.6) tilstand = 'koerer';
      biler.forEach(function (b) { if (!b.erAI) opdaterMotor(b, true); });
    } else if (tilstand === 'koerer') {
      biler.forEach(function (b) { opdaterBil(b, dt); });
      // Biler paa aeresrunde maa ikke staa i vejen for dem der stadig koerer
      for (var i = 0; i < biler.length; i++) {
        for (var j = i + 1; j < biler.length; j++) {
          if (!biler[i].faerdig && !biler[j].faerdig) Fysik.skubFraHinanden(biler[i], biler[j]);
        }
      }
      opdaterPartikler(dt);
      // Loebet slutter foerst naar alle boern er i maal. Ingen faar taget
      // skaermen vaek midt i sin omgang, heller ikke hvis AI'en vandt.
      if (biler.every(function (b) { return b.erAI || b.faerdig; })) afslut();
    } else if (tilstand === 'faerdig') {
      opdaterPartikler(dt);
      tegnVinder(dt);
    }

    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- skærme ---------- */

  function afslut() {
    tilstand = 'faerdig';
    stopMotorer();
    melodi([660, 880, 1100, 1320, 1760], 110);

    var vinder = biler.filter(function (b) { return b.faerdig; })
      .sort(function (a, b) { return a.placering - b.placering; })[0];
    // Vinderen vises som tegning, saa man ikke behoever at kunne laese
    var titel = antalSpillere === 1 && !vinder.erAI ? 'Du vandt!' : 'Vinder!';
    visOverlay(
      '<div class="kort">' +
      '<h2>' + titel + '</h2>' +
      '<canvas class="eksempel" width="300" height="180" style="' + EKSEMPEL_STIL + '"></canvas>' +
      Menu.slutRaekke('igen', { handling: 'bilvalg', navn: 'Vælg bil' }, { handling: 'menu', navn: 'Vælg bane', ikon: Menu.bane() }) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    vinderCanvas._vinder = vinder;
    startKonfetti(vinderCanvas);
  }

  function visOverlay(html) {
    overlay.innerHTML = html;
    overlay.hidden = false;
  }

  function skjulOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
    vinderCanvas = null;
  }

  var valgtBane = 'tracks/rundbanen.json';

  // Banernes punkter hentes én gang til de smaa tegninger i menuen
  var baneData = {};
  function tegnMiniaturer() {
    overlay.querySelectorAll('canvas[data-bane]').forEach(function (cv) {
      var d = baneData[cv.dataset.bane];
      if (d) Bane.miniature(d, cv);
    });
  }
  window.BANER.forEach(function (b) {
    fetch(b.fil).then(function (r) { return r.json(); }).then(function (d) { baneData[b.fil] = d; tegnMiniaturer(); })
      .catch(function () { /* uden tegning vises kun navnet */ });
  });

  /** Tre stjerner, hvoraf `fyldt` er gule. Ingen tekst. */
  function visMenu() {
    tilstand = 'venter';
    stopMotorer();
    vinderCanvas = null;

    // Banerne vises som smaa tegninger, saa man kan vaelge uden at laese navnet
    var baneKnapper = window.BANER.map(function (b) {
      return '<button class="bane' + (b.fil === valgtBane ? ' valgt' : '') +
             '" data-handling="bane" data-fil="' + b.fil + '" aria-label="' + b.navn + '">' +
             '<canvas width="180" height="126" style="position:static;display:block;width:100%;height:auto" data-bane="' + b.fil + '"></canvas>' +
             '<span>' + b.navn + '</span></button>';
    }).join('');

    visOverlay(
      '<div class="kort">' +
      '<h2>Racerbanen</h2>' +
      '<p class="hjaelp">Hold fingeren i venstre eller højre side. Bilen kører selv.</p>' +
      '<div class="baner">' + baneKnapper + '</div>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    tegnMiniaturer();
  }

  var EKSEMPEL_STIL = 'position:static;display:block;width:150px;height:90px;align-self:center';
  var MINI_STIL = 'position:static;display:block;width:100%;height:100%';

  /**
   * Vaelg din bil. Hver spiller faar sin egen soejle med en stor tegning,
   * tre former og seks farver. Ingen tekst ud over overskriften.
   * En farve den anden spiller har taget, er graa, saa bilerne kan kendes
   * fra hinanden paa banen.
   */
  function visBilValg() {
    tilstand = 'venter';
    var soejler = '';
    for (var s = 0; s < antalSpillere; s++) {
      var v = valg[s];
      var anden = antalSpillere === 2 ? valg[1 - s] : null;

      var former = FORMER.map(function (f, i) {
        return '<button class="form' + (i === v.form ? ' valgt' : '') +
               '" data-handling="form" data-spiller="' + s + '" data-i="' + i + '" aria-label="' + f + '">' +
               '<canvas width="128" height="96" style="' + MINI_STIL + '" data-form="' + i + '" data-farve="' + v.farve + '"></canvas>' +
               '</button>';
      }).join('');

      var farver = FARVER.map(function (f, i) {
        var optaget = anden && anden.farve === i;
        return '<button class="farve' + (i === v.farve ? ' valgt' : '') + (optaget ? ' optaget' : '') +
               '" style="background:' + f.lak + '" data-handling="farve" data-spiller="' + s +
               '" data-i="' + i + '"' + (optaget ? ' disabled' : '') + ' aria-label="' + f.navn + '"></button>';
      }).join('');

      soejler += '<div class="spiller" style="border-color:' + FARVER[v.farve].lak + '">' +
                 '<canvas class="eksempel" width="300" height="180" style="' + EKSEMPEL_STIL + '" data-spiller="' + s + '"></canvas>' +
                 '<div class="former">' + former + '</div>' +
                 '<div class="farver">' + farver + '</div>' +
                 '</div>';
    }

    visOverlay(
      '<div class="kort' + (antalSpillere === 2 ? ' bred' : '') + '">' +
      '<h2>Vælg din bil</h2>' +
      '<div class="valg">' + soejler + '</div>' +
      '<div class="raekke start"><button class="knap groen start" data-handling="koer" aria-label="Kør">' + Menu.start() + '</button></div>' +
      '</div>'
    );

    overlay.querySelectorAll('canvas[data-form]').forEach(function (cv) {
      tegnEksempel(cv, FARVER[+cv.dataset.farve], FORMER[+cv.dataset.form], 2.2);
    });
    overlay.querySelectorAll('canvas.eksempel[data-spiller]').forEach(function (cv) {
      var v = valg[+cv.dataset.spiller];
      tegnEksempel(cv, FARVER[v.farve], FORMER[v.form], 4.5);
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;

    if (h === 'bane') {
      valgtBane = knap.dataset.fil;
      tone(520, 0.08);
      visMenu();
    } else if (h === 'svaerhed') {
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
      visBilValg();
    } else if (h === 'form' || h === 'farve') {
      var v = valg[parseInt(knap.dataset.spiller, 10)];
      v[h] = parseInt(knap.dataset.i, 10);
      tone(h === 'form' ? 600 : 700, 0.08);
      visBilValg();
    } else if (h === 'bilvalg') {
      stopMotorer();
      visBilValg();
    } else if (h === 'koer') {
      skjulOverlay();
      indlæsBane(valgtBane).then(function () { nulstilLøb(antalSpillere); });
    } else if (h === 'igen') {
      skjulOverlay();
      nulstilLøb(antalSpillere);
    } else if (h === 'menu') {
      visMenu();
    }
  });

  function indlæsBane(fil) {
    if (bane && bane._fil === fil) return Promise.resolve();
    return Bane.hent(fil).then(function (b) {
      b._fil = fil;
      bane = b;
    });
  }

  /* ---------- start ---------- */

  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () {
    setTimeout(tilpasStørrelse, 220);
  });

  // Kroge til fejlsoegning og automatiske tests. Se README.
  window.__debug = function () {
    return {
      tilstand: tilstand,
      spillere: antalSpillere,
      svaerhed: svaerhed,
      lyd: lydTil,
      bane: bane ? bane.navn : null,
      styring: [styring.retning(0), styring.retning(1)],
      biler: biler.map(function (b) {
        return {
          spiller: b.spiller, erAI: b.erAI,
          x: Math.round(b.x), y: Math.round(b.y),
          fart: Math.round(b.fart), omgang: b.omgang, cp: b.næsteCp,
          turbo: +(b.turbo || 0).toFixed(2), turboTaget: b.turboTaget || 0,
          faerdig: b.faerdig,
          paaAsfalt: bane ? bane.paaAsfalt(b.x, b.y) : null
        };
      })
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
