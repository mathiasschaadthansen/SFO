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

    c.fillStyle = '#3f8f52';
    c.fillRect(0, 0, b, h);

    // Let struktur i graesset så farten kan mærkes
    c.fillStyle = 'rgba(255,255,255,0.05)';
    for (var i = 0; i < 700; i++) {
      var gx = Math.random() * b, gy = Math.random() * h;
      c.fillRect(gx, gy, 3 + Math.random() * 9, 3);
    }

    tegnLinje(c, this.linje, v + 26, '#f2e9d8');   // kantsten
    tegnLinje(c, this.linje, v, '#5a5f68');        // asfalt
    tegnLinje(c, this.linje, 5, 'rgba(255,255,255,0.55)', [26, 34]); // midterstribe

    // Turbofelter: to gule vinkler i koereretningen
    this.turbo.forEach(function (f) {
      c.save();
      c.translate(f.x, f.y);
      c.rotate(f.vinkel);
      c.fillStyle = '#ffd23f';
      c.strokeStyle = '#12261f';
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
    c.fillStyle = '#3f8f52';
    c.beginPath();
    if (c.roundRect) c.roundRect(0, 0, canvas.width, canvas.height, 14); else c.rect(0, 0, canvas.width, canvas.height);
    c.fill();
    c.save();
    c.translate(ox, oy);
    c.scale(s, s);
    tegnLinje(c, linje, data.vejbredde + 60, '#f2e9d8');
    tegnLinje(c, linje, data.vejbredde + 10, '#5a5f68');
    c.fillStyle = '#ffd23f';
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
