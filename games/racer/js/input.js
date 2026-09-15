/**
 * Styring med flere fingre samtidig.
 *
 * Det her er den del der gaar galt hvis man bruger almindelige click-handlere:
 * saa snart spiller 1 holder en finger nede, doer spiller 2's input.
 * Loesningen er at foelge hver finger for sig via pointerId og foerst
 * regne styringen ud naar alle aktive fingre er kendt.
 *
 * En zone er angivet i braekdele af skaermen (0-1), saa den samme kode
 * virker uanset skaermstoerrelse og uanset 1- eller 2-spillertilstand.
 */
(function () {
  'use strict';

  function Styring(element) {
    this.el = element;
    this.zoner = [];
    this.fingre = new Map();   // pointerId -> zone
    this.taster = new Set();
    this.tastKort = {
      ArrowLeft:  { spiller: 0, retning: -1 },
      ArrowRight: { spiller: 0, retning:  1 },
      a: { spiller: 1, retning: -1 },
      d: { spiller: 1, retning:  1 }
    };

    var self = this;

    function zoneFor(e) {
      var r = self.el.getBoundingClientRect();
      var fx = (e.clientX - r.left) / r.width;
      var fy = (e.clientY - r.top) / r.height;
      for (var i = 0; i < self.zoner.length; i++) {
        var z = self.zoner[i];
        if (fx >= z.x0 && fx < z.x1 && fy >= z.y0 && fy < z.y1) return z;
      }
      return null;
    }

    this._ned = function (e) {
      e.preventDefault();
      var z = zoneFor(e);
      if (z) self.fingre.set(e.pointerId, z);
    };
    this._flyt = function (e) {
      if (!self.fingre.has(e.pointerId)) return;
      // Fingeren kan glide over i den anden zone midt i et sving.
      var z = zoneFor(e);
      if (z) self.fingre.set(e.pointerId, z);
      else self.fingre.delete(e.pointerId);
    };
    this._op = function (e) { self.fingre.delete(e.pointerId); };

    element.addEventListener('pointerdown', this._ned, { passive: false });
    element.addEventListener('pointermove', this._flyt, { passive: false });
    element.addEventListener('pointerup', this._op);
    element.addEventListener('pointercancel', this._op);
    element.addEventListener('pointerleave', this._op);
    element.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    window.addEventListener('keydown', function (e) { self.taster.add(e.key); });
    window.addEventListener('keyup', function (e) { self.taster.delete(e.key); });
    window.addEventListener('blur', function () {
      self.fingre.clear();
      self.taster.clear();
    });
  }

  /** zoner: [{x0,y0,x1,y1,spiller,retning}] i braekdele 0-1 */
  Styring.prototype.saetZoner = function (zoner) {
    this.zoner = zoner;
    this.fingre.clear();
  };

  /** -1 = venstre, 0 = ligeud, 1 = hoejre */
  Styring.prototype.retning = function (spiller) {
    var sum = 0;
    this.fingre.forEach(function (z) {
      if (z.spiller === spiller) sum += z.retning;
    });
    var self = this;
    this.taster.forEach(function (t) {
      var k = self.tastKort[t];
      if (k && k.spiller === spiller) sum += k.retning;
    });
    return sum < 0 ? -1 : (sum > 0 ? 1 : 0);
  };

  Styring.prototype.nulstil = function () {
    this.fingre.clear();
    this.taster.clear();
  };

  window.Styring = Styring;
})();
