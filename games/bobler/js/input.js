/**
 * Styring med flere fingre samtidig, tre knapper pr. spiller:
 * venstre, skyd og hoejre.
 *
 * Samme princip som i racerbanen: hver finger foelges via pointerId, og
 * knapperne regnes ud af alle aktive fingre. Uden det doer spiller 2's
 * input, saa snart spiller 1 holder en finger nede.
 *
 * Zoner angives i braekdele af skaermen (0-1) med et knapnavn.
 */
(function () {
  'use strict';

  function Styring(element) {
    this.el = element;
    this.zoner = [];
    this.fingre = new Map();   // pointerId -> zone
    this.taster = new Set();
    this.tastKort = {
      ArrowLeft:  { spiller: 0, knap: 'venstre' },
      ArrowRight: { spiller: 0, knap: 'hoejre' },
      ArrowUp:    { spiller: 0, knap: 'skyd' },
      KeyA: { spiller: 1, knap: 'venstre' },
      KeyD: { spiller: 1, knap: 'hoejre' },
      KeyW: { spiller: 1, knap: 'skyd' }
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
    // Loeftes fingeren over en anden flade (hjem-knappen, en menu), eller afbryder
    // iOS beroeringen, kommer slippet ikke til laerredet. Lyt ogsaa paa vinduet,
    // saa en knap aldrig bliver haengende.
    window.addEventListener('pointerup', this._op);
    window.addEventListener('pointercancel', this._op);
    document.addEventListener('visibilitychange', function () { self.fingre.clear(); self.taster.clear(); });
    element.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // e.code er tastens fysiske plads. e.key skifter mellem "a" og "A" med Shift og
    // Caps Lock, saa et slip kunne komme med et andet navn end trykket, og tasten blev haengende.
    window.addEventListener('keydown', function (e) { self.taster.add(e.code); });
    window.addEventListener('keyup', function (e) { self.taster.delete(e.code); });
    window.addEventListener('blur', function () {
      self.fingre.clear();
      self.taster.clear();
    });
  }

  /** zoner: [{x0,y0,x1,y1,spiller,knap}] i braekdele 0-1 */
  Styring.prototype.saetZoner = function (zoner) {
    this.zoner = zoner;
    this.fingre.clear();
  };

  Styring.prototype.trykket = function (spiller, knap) {
    var ja = false;
    this.fingre.forEach(function (z) {
      if (z.spiller === spiller && z.knap === knap) ja = true;
    });
    var self = this;
    this.taster.forEach(function (t) {
      var k = self.tastKort[t];
      if (k && k.spiller === spiller && k.knap === knap) ja = true;
    });
    return ja;
  };

  /** { retning: -1|0|1, skyd: bool } — det fysikken skal bruge */
  Styring.prototype.input = function (spiller) {
    var v = this.trykket(spiller, 'venstre'), h = this.trykket(spiller, 'hoejre');
    return { retning: v && !h ? -1 : (h && !v ? 1 : 0), skyd: this.trykket(spiller, 'skyd') };
  };

  Styring.prototype.nulstil = function () {
    this.fingre.clear();
    this.taster.clear();
  };

  window.Styring = Styring;
})();
