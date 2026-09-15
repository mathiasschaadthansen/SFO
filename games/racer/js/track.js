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
    this.linje = udjaevn(data.punkter, 24);

    this._byg();
    this._checkpoints(data.checkpoints || 24);
  }

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
