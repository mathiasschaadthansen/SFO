/**
 * Racerbanen.
 *
 * Styring: hold fingeren i venstre eller hoejre side af din halvdel.
 * Bilen koerer af sig selv. Ingen speeder, ingen bremse, ingen game over.
 *
 * Denne fil er kun skaerm: menu, kamera, split screen og tegning.
 * Fysik, AI og alle tal der bestemmer hvordan det FOELES ligger i js/physics.js.
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

  var FARVER = [
    { lak: '#e8442e', tag: '#ffd23f', navn: 'Rød' },
    { lak: '#3aa7e0', tag: '#f7f3e8', navn: 'Blå' }
  ];

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

  /* ---------- lyd (ingen filer, kun toner) ---------- */

  function tone(frekvens, længde, styrke) {
    try {
      if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
      if (lyd.state === 'suspended') lyd.resume();
      var o = lyd.createOscillator();
      var g = lyd.createGain();
      o.type = 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, lyd.currentTime + længde);
      o.connect(g).connect(lyd.destination);
      o.start();
      o.stop(lyd.currentTime + længde);
    } catch (e) { /* lyd er pynt, aldrig kritisk */ }
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

  function nyBil(indeks, erAI) {
    var vinkelret = bane.startVinkel + Math.PI / 2;
    var forskyd = (indeks - 0.5) * 46;
    return {
      x: bane.start.x + Math.cos(vinkelret) * forskyd,
      y: bane.start.y + Math.sin(vinkelret) * forskyd,
      vinkel: bane.startVinkel,
      fart: 0,
      farve: FARVER[indeks],
      omgang: 0,
      næsteCp: 1,
      graestid: 0,
      erAI: !!erAI,
      spiller: indeks,
      placering: 0,
      faerdig: false
    };
  }

  function nulstilLøb(spillere) {
    antalSpillere = spillere;
    biler = [nyBil(0, false), nyBil(1, spillere === 1)];
    tilstand = 'nedtaelling';
    nedtaelling = 3.2;
    styring.nulstil();
    opdaterZoner();
  }

  /* ---------- opdatering ---------- */

  function opdaterBil(bil, dt) {
    var ret = bil.erAI ? Fysik.aiStyring(bil, bane) : styring.retning(bil.spiller);
    var nyOmgang = Fysik.opdaterBil(bil, bane, ret, dt);

    if (nyOmgang) {
      if (!bil.erAI) tone(bil.omgang >= INDSTIL.omgange ? 880 : 660, 0.18);
      if (bil.omgang >= INDSTIL.omgange && !bil.faerdig) {
        bil.faerdig = true;
        bil.placering = biler.filter(function (b) { return b.faerdig; }).length;
      }
    }
  }

  /* ---------- tegning ---------- */

  function tegnBil(bil) {
    var L = INDSTIL.bilLaengde, B = INDSTIL.bilBredde;
    ctx.save();
    ctx.translate(bil.x, bil.y);
    ctx.rotate(bil.vinkel);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.roundRect(-L / 2 + 3, -B / 2 + 4, L, B, 7);
    ctx.fill();

    ctx.fillStyle = '#12261f';
    ctx.fillRect(-L / 2 + 4, -B / 2 - 3, 8, B + 6);
    ctx.fillRect(L / 2 - 12, -B / 2 - 3, 8, B + 6);

    ctx.fillStyle = bil.farve.lak;
    ctx.strokeStyle = '#12261f';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.roundRect(-L / 2, -B / 2, L, B, 7);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = bil.farve.tag;
    ctx.beginPath();
    ctx.roundRect(-4, -B / 2 + 4, 13, B - 8, 4);
    ctx.fill();

    ctx.restore();
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
    biler.forEach(tegnBil);
    ctx.restore();

    // Omgangstæller — cirkler i stedet for tal, saa 6-aarige kan aflaese den
    ctx.save();
    ctx.translate(x + 18, y + 22);
    for (var i = 0; i < INDSTIL.omgange; i++) {
      ctx.beginPath();
      ctx.arc(i * 26, 0, 9, 0, Math.PI * 2);
      ctx.fillStyle = i < bil.omgang ? bil.farve.lak : 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#12261f';
      ctx.stroke();
    }
    ctx.restore();
  }

  function tegnPile(x, bredde, højde) {
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.fillStyle = '#fff';
    var midt = x + bredde / 2;
    var y = højde - 78;
    [[midt - bredde * 0.28, -1], [midt + bredde * 0.28, 1]].forEach(function (p) {
      ctx.beginPath();
      ctx.moveTo(p[0] + 16 * p[1], y - 20);
      ctx.lineTo(p[0] - 14 * p[1], y);
      ctx.lineTo(p[0] + 16 * p[1], y + 20);
      ctx.closePath();
      ctx.fill();
    });
    ctx.restore();
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);

    if (!bane) return;

    if (antalSpillere === 1) {
      tegnUdsnit(biler[0], 0, 0, B, H);
      tegnPile(0, B, H);
    } else {
      var halv = Math.floor(B / 2);
      tegnUdsnit(biler[0], 0, 0, halv, H);
      tegnUdsnit(biler[1], halv, 0, B - halv, H);
      tegnPile(0, halv, H);
      tegnPile(halv, B - halv, H);
      ctx.fillStyle = '#12261f';
      ctx.fillRect(halv - 3, 0, 6, H);
    }

    if (tilstand === 'nedtaelling') {
      var tal = Math.ceil(nedtaelling - 0.2);
      ctx.save();
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 150px ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#12261f';
      ctx.fillStyle = '#ffd23f';
      var tekst = tal > 0 ? String(tal) : 'KØR!';
      ctx.strokeText(tekst, B / 2, H / 2);
      ctx.fillText(tekst, B / 2, H / 2);
      ctx.restore();
    }
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
    } else if (tilstand === 'koerer') {
      biler.forEach(function (b) { if (!b.faerdig) opdaterBil(b, dt); });
      Fysik.skubFraHinanden(biler[0], biler[1]);
      if (biler.some(function (b) { return b.faerdig; })) afslut();
    }

    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- skærme ---------- */

  function afslut() {
    tilstand = 'faerdig';
    tone(660, 0.15); setTimeout(function () { tone(880, 0.3); }, 150);

    var vinder = biler.filter(function (b) { return b.faerdig; })[0];
    var titel;
    if (antalSpillere === 1) {
      titel = vinder.erAI ? 'Den blå bil vandt' : 'Du vandt!';
    } else {
      titel = vinder.farve.navn + ' bil vandt!';
    }
    visOverlay(
      '<div class="kort">' +
      '<h2>' + titel + '</h2>' +
      '<button class="knap gul" data-handling="igen">Kør igen</button>' +
      '<button class="knap" data-handling="menu">Vælg bane</button>' +
      '</div>'
    );
  }

  function visOverlay(html) {
    overlay.innerHTML = html;
    overlay.hidden = false;
  }

  function skjulOverlay() {
    overlay.hidden = true;
    overlay.innerHTML = '';
  }

  var valgtBane = 'tracks/rundbanen.json';

  function visMenu() {
    tilstand = 'venter';
    var baneKnapper = window.BANER.map(function (b) {
      return '<button class="knap smal' + (b.fil === valgtBane ? ' valgt' : '') +
             '" data-handling="bane" data-fil="' + b.fil + '">' + b.navn + '</button>';
    }).join('');

    visOverlay(
      '<div class="kort">' +
      '<h2>Racerbanen</h2>' +
      '<p class="hjaelp">Hold fingeren i venstre eller højre side. Bilen kører selv.</p>' +
      '<div class="raekke">' + baneKnapper + '</div>' +
      '<button class="knap gul" data-handling="start" data-spillere="1">1 spiller</button>' +
      '<button class="knap gul" data-handling="start" data-spillere="2">2 spillere</button>' +
      '<a class="knap lille" href="../../">Tilbage</a>' +
      '</div>'
    );
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;

    if (h === 'bane') {
      valgtBane = knap.dataset.fil;
      visMenu();
    } else if (h === 'start') {
      var spillere = parseInt(knap.dataset.spillere, 10);
      skjulOverlay();
      indlæsBane(valgtBane).then(function () { nulstilLøb(spillere); });
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
      bane: bane ? bane.navn : null,
      styring: [styring.retning(0), styring.retning(1)],
      biler: biler.map(function (b) {
        return {
          spiller: b.spiller, erAI: b.erAI,
          x: Math.round(b.x), y: Math.round(b.y),
          fart: Math.round(b.fart), omgang: b.omgang, cp: b.næsteCp,
          paaAsfalt: bane ? bane.paaAsfalt(b.x, b.y) : null
        };
      })
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
