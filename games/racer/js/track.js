/**
 * Banemotor.
 *
 * En bane er en lukket midterlinje af få punkter. Herfra bygges:
 *   1. et baggrundsbillede (græs, asfalt, kantsten, midterstribe)
 *   2. en kollisionsmaske i halv oplosning — bruges til at se om en bil er på asfalt
 *   3. en raekke checkpoints — bruges til omgaengstaelling og genstart
 *
 * Kollisionsopslag er ét array-index pr. bil pr. frame. Ingen getImageData
 * under spillet, den koeres kun én gang naar banen bygges.
 */
(function () {
  'use strict';

  var MASKE_SKALA = 0.5;

  // Malet palet. Samme toner som i Maskinen og de andre spil.
  var FARVE = {
    graesLys: '#a3c976', graes: '#8fb85f', graesDyb: '#6b9147',
    kantLys: '#f2e6cb', vej: '#ddc69c', vejLys: '#e7d4b0',
    turbo: '#f0c46a', turboKant: '#b1873f'
  };

  // Grus: en lille flise med lyse og moerke prikker, tegnet én gang og
  // genbrugt paa alle baner.
  var grus = null;
  function grusMoenster() {
    if (!grus) {
      grus = document.createElement('canvas');
      grus.width = 96; grus.height = 96;
      var g = grus.getContext('2d');
      for (var i = 0; i < 900; i++) {
        g.fillStyle = i % 2 ? 'rgba(138,102,61,0.13)' : 'rgba(255,248,226,0.16)';
        g.fillRect(Math.random() * 96, Math.random() * 96, 2, 2);
      }
    }
    return grus;
  }

  // Catmull-Rom gennem en lukket raekke punkter. Giver bloede kurver
  // uden at man skal angive kontrolpunkter i JSON-filen.
  function udjaevn(punkter, trinPrSegment) {
    var ud = [];
    var n = punkter.length;
    for (var i = 0; i < n; i++) {
      var p0 = punkter[(i - 1 + n) % n];
      var p1 = punkter[i];
      var p2 = punkter[(i + 1) % n];
      var p3 = punkter[(i + 2) % n];
      for (var t = 0; t < trinPrSegment; t++) {
        var s = t / trinPrSegment;
        var s2 = s * s;
        var s3 = s2 * s;
        ud.push({
          x: 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * s +
               (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * s2 +
               (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * s3),
          y: 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * s +
               (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * s2 +
               (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * s3)
        });
      }
    }
    return ud;
  }

  function tegnLinje(ctx, linje, bredde, farve, stiplet) {
    ctx.beginPath();
    ctx.moveTo(linje[0].x, linje[0].y);
    for (var i = 1; i < linje.length; i++) ctx.lineTo(linje[i].x, linje[i].y);
    ctx.closePath();
    ctx.lineWidth = bredde;
    ctx.strokeStyle = farve;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.setLineDash(stiplet || []);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function Bane(data) {
    this.navn = data.navn;
    this.bredde = data.bredde;
    this.hoejde = data.hoejde;
    this.vejbredde = data.vejbredde;
    // Baner med lange lige stykker og faa sving koeres bedst med et laengere sigte.
    // 1 = som svaerhedsgraden siger. Se aiSigte i physics.js.
    this.aiSigteFaktor = data.aiSigteFaktor || 1;
    this.linje = udjaevn(data.punkter, 24);

    this._checkpoints(data.checkpoints || 24);
    this._turbofelter();
    this._byg();
  }

  /**
   * Turbofelter: smaa pile paa asfalten, forskudt fra midten skiftevis til
   * hoejre og venstre. Man skal styre efter dem for at faa skubbet, saa de
   * beloenner den der styrer aktivt uden at straffe den der ikke goer.
   */
  Bane.prototype._turbofelter = function () {
    var felter = [];
    var linje = this.linje;
    var n = linje.length;
    var antal = this.checkpoints.length;
    var side = 1;
    for (var c = 3; c < antal; c += 5) {
      var i = Math.floor((c / antal) * n);
      var a = linje[i], b = linje[(i + 4) % n];
      var vinkel = Math.atan2(b.y - a.y, b.x - a.x);
      var forskyd = this.vejbredde * 0.22 * side;
      felter.push({
        x: a.x + Math.cos(vinkel + Math.PI / 2) * forskyd,
        y: a.y + Math.sin(vinkel + Math.PI / 2) * forskyd,
        r: this.vejbredde * 0.2,
        vinkel: vinkel
      });
      side = -side;
    }
    this.turbo = felter;
  };

  Bane.prototype._byg = function () {
    var b = this.bredde, h = this.hoejde, v = this.vejbredde;

    // Synligt lag
    var lag = document.createElement('canvas');
    lag.width = b;
    lag.height = h;
    var c = lag.getContext('2d');

    // Malet eng: et bloedt forloeb, store lyse pletter og smaa graesstrejf.
    // Laget tegnes én gang, saa det maa gerne tage lidt tid.
    var eng = c.createLinearGradient(0, 0, b * 0.3, h);
    eng.addColorStop(0, FARVE.graesLys);
    eng.addColorStop(0.5, FARVE.graes);
    eng.addColorStop(1, FARVE.graesDyb);
    c.fillStyle = eng;
    c.fillRect(0, 0, b, h);
    for (var pl = 0; pl < 90; pl++) {
      var r = 120 + Math.random() * 320;
      c.fillStyle = pl % 2 ? 'rgba(199,222,150,0.09)' : 'rgba(93,130,64,0.08)';
      c.beginPath();
      c.ellipse(Math.random() * b, Math.random() * h, r, r * 0.5, Math.random() * 3, 0, Math.PI * 2);
      c.fill();
    }
    c.lineCap = 'round';
    c.lineWidth = 1.8;
    var antalStraa = Math.round(b * h / 1400);
    for (var i = 0; i < antalStraa; i++) {
      var gx = Math.random() * b, gy = Math.random() * h, gh = 4 + Math.random() * 6;
      c.strokeStyle = i % 3 ? 'rgba(77,122,60,0.24)' : 'rgba(214,232,170,0.3)';
      c.beginPath();
      c.moveTo(gx, gy);
      c.quadraticCurveTo(gx + 1.5, gy - gh * 0.6, gx + (Math.random() * 5 - 2.5), gy - gh);
      c.stroke();
    }

    // Vejen: en malet grussti. Skyggen ligger UNDER vejen og er lige saa bred,
    // saa den ikke kan forveksles med kanten. Asfaltbredden er praecis v —
    // den samme som masken bruger, saa det, man ser, er det, man kan koere paa.
    tegnLinje(c, this.linje, v + 30, 'rgba(74,58,44,0.14)');   // bloed skygge
    tegnLinje(c, this.linje, v + 22, FARVE.kantLys);           // lys kant
    tegnLinje(c, this.linje, v, FARVE.vej);                    // selve vejen
    tegnLinje(c, this.linje, v - 10, FARVE.vejLys);            // lysere midte
    tegnLinje(c, this.linje, 5, 'rgba(255,255,255,0.6)', [26, 34]); // midterstribe

    // Korn i vejen, saa den ligner grus og ikke maling. Kornet males som et
    // moenster paa selve vejstregen, saa det aldrig kan smitte af paa graesset.
    tegnLinje(c, this.linje, v, c.createPattern(grusMoenster(), 'repeat'));

    // Turbofelter: to malede vinkler i koereretningen
    this.turbo.forEach(function (f) {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.vinkel);
      c.fillStyle = FARVE.turbo;
      c.strokeStyle = FARVE.turboKant;
      c.lineWidth = 2;
      for (var k = -1; k <= 0; k++) {
        c.beginPath();
        c.moveTo(k * 14 - 8, -14);
        c.lineTo(k * 14 + 4, 0);
        c.lineTo(k * 14 - 8, 14);
        c.lineTo(k * 14 - 2, 14);
        c.lineTo(k * 14 + 10, 0);
        c.lineTo(k * 14 - 2, -14);
        c.closePath();
        c.fill();
        c.stroke();
      }
      c.restore();
    });

    this.billede = lag;

    // Maske: hvid = asfalt
    var mb = Math.round(b * MASKE_SKALA);
    var mh = Math.round(h * MASKE_SKALA);
    var m = document.createElement('canvas');
    m.width = mb;
    m.height = mh;
    var mc = m.getContext('2d');
    mc.fillStyle = '#000';
    mc.fillRect(0, 0, mb, mh);
    mc.save();
    mc.scale(MASKE_SKALA, MASKE_SKALA);
    tegnLinje(mc, this.linje, v, '#fff');
    mc.restore();

    var pix = mc.getImageData(0, 0, mb, mh).data;
    var maske = new Uint8Array(mb * mh);
    for (var p = 0; p < maske.length; p++) maske[p] = pix[p * 4] > 128 ? 1 : 0;

    this.maske = maske;
    this.maskeB = mb;
    this.maskeH = mh;
  };

  Bane.prototype._checkpoints = function (antal) {
    var cps = [];
    var spring = this.linje.length / antal;
    for (var i = 0; i < antal; i++) cps.push(this.linje[Math.floor(i * spring)]);
    this.checkpoints = cps;

    // Startretning: mod checkpoint 1
    var a = cps[0], bb = cps[1];
    this.startVinkel = Math.atan2(bb.y - a.y, bb.x - a.x);
    this.start = a;
  };

  Bane.prototype.paaAsfalt = function (x, y) {
    var mx = (x * MASKE_SKALA) | 0;
    var my = (y * MASKE_SKALA) | 0;
    if (mx < 0 || my < 0 || mx >= this.maskeB || my >= this.maskeH) return false;
    return this.maske[my * this.maskeB + mx] === 1;
  };

  /**
   * Tegner banen som et lille billede til menuen: vej, kantsten og en startprik.
   * Bygger hverken maske eller stort billede, saa det er billigt at tegne alle baner.
   */
  Bane.miniature = function (data, canvas) {
    var c = canvas.getContext('2d');
    var linje = udjaevn(data.punkter, 12);
    var marg = 10;
    var s = Math.min((canvas.width - marg * 2) / data.bredde, (canvas.height - marg * 2) / data.hoejde);
    var ox = (canvas.width - data.bredde * s) / 2, oy = (canvas.height - data.hoejde * s) / 2;
    c.clearRect(0, 0, canvas.width, canvas.height);
    var eng = c.createLinearGradient(0, 0, 0, canvas.height);
    eng.addColorStop(0, FARVE.graesLys);
    eng.addColorStop(1, FARVE.graesDyb);
    c.fillStyle = eng;
    c.beginPath();
    if (c.roundRect) c.roundRect(0, 0, canvas.width, canvas.height, 14); else c.rect(0, 0, canvas.width, canvas.height);
    c.fill();
    c.save();
    c.translate(ox, oy);
    c.scale(s, s);
    tegnLinje(c, linje, data.vejbredde + 60, FARVE.kantLys);
    tegnLinje(c, linje, data.vejbredde + 10, FARVE.vej);
    c.fillStyle = FARVE.turbo;
    c.beginPath();
    c.arc(linje[0].x, linje[0].y, data.vejbredde * 0.42, 0, Math.PI * 2);
    c.fill();
    c.restore();
  };

  Bane.hent = function (fil) {
    return fetch(fil)
      .then(function (r) {
        if (!r.ok) throw new Error('Banen kunne ikke hentes: ' + fil);
        return r.json();
      })
      .then(function (data) { return new Bane(data); });
  };

  window.Bane = Bane;
})();
