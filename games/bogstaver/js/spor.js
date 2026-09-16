/**
 * Sporing: foelger barnets finger langs et tegns streger.
 *
 * Hver streg samples i taette punkter. Fingeren skal starte ved det naeste
 * punkt paa den aktuelle streg og bevaeger sig frem punkt for punkt, saa
 * laenge den er inden for tolerancen. Loefter man fingeren eller kommer
 * paa afveje, mister man ikke det, man har tegnet — man tager bare fat igen.
 * Ingen fejl, ingen straf.
 *
 * Koordinater er i tegnets kasse (0-100). Ingen DOM, testes i Node.
 */
(function (rod) {
  'use strict';

  var AFSTAND = 2.5;   // afstand mellem samplede punkter

  function sampl(streg) {
    var ud = [streg[0]];
    for (var i = 1; i < streg.length; i++) {
      var a = streg[i - 1], b = streg[i];
      var l = Math.hypot(b[0] - a[0], b[1] - a[1]);
      var n = Math.max(1, Math.round(l / AFSTAND));
      for (var k = 1; k <= n; k++) ud.push([a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n]);
    }
    return ud;
  }

  /**
   * glyf: { streger: [[[x,y],...], ...] }
   * tolerance: hvor langt fra stregen fingeren maa vaere (i kasse-enheder)
   */
  function Spor(glyf, tolerance) {
    this.streger = glyf.streger.map(sampl);
    this.tolerance = tolerance;
    this.aktiv = 0;          // hvilken streg der tegnes
    this.indeks = 0;         // hvor langt paa den (index i samplede punkter)
    this.holder = false;     // fingeren er "paa" stregen lige nu
    this.faerdig = false;
    this.stregFaerdig = false;   // true i det kald hvor en streg blev faerdig
    this.afveje = 0;             // hvor mange gange fingeren kom paa afveje (til progression)
  }

  Spor.prototype.naeste = function () {
    return this.faerdig ? null : this.streger[this.aktiv][this.indeks];
  };

  Spor.prototype.andel = function () {
    if (this.faerdig) return 1;
    var alle = 0, gjort = 0;
    for (var i = 0; i < this.streger.length; i++) {
      alle += this.streger[i].length;
      if (i < this.aktiv) gjort += this.streger[i].length;
      else if (i === this.aktiv) gjort += this.indeks;
    }
    return gjort / alle;
  };

  Spor.prototype.start = function (x, y) {
    this.stregFaerdig = false;
    if (this.faerdig) return false;
    var p = this.naeste();
    this.holder = Math.hypot(x - p[0], y - p[1]) <= this.tolerance * 1.8;
    if (this.holder) this.flyt(x, y);
    return this.holder;
  };

  Spor.prototype.flyt = function (x, y) {
    this.stregFaerdig = false;
    if (this.faerdig || !this.holder) return;
    var streg = this.streger[this.aktiv];
    var t = this.tolerance;
    var slut = streg.length - 1;
    function afstand(k) { return Math.hypot(x - streg[k][0], y - streg[k][1]); }

    // Find det foerste punkt inden for raekkevidde et stykke fremme (en hurtig
    // finger kan springe et par punkter), og gaa derefter frem punkt for punkt
    // saa laenge stregen er inden for tolerancen. Saa kan man ikke springe hen
    // over et hjoerne til den naeste streg-del.
    var vindue = Math.max(12, Math.round(t * 2.5 / AFSTAND));
    var j = -1;
    for (var k = this.indeks; k <= Math.min(slut, this.indeks + vindue); k++) {
      if (afstand(k) <= t) { j = k; break; }
    }
    if (j < 0) {
      if (afstand(this.indeks) > t * 2.2) { this.holder = false; this.afveje++; }   // paa afveje: slip, men behold fremskridt
      return;
    }
    while (j < slut && afstand(j + 1) <= t) j++;
    this.indeks = j;
    if (this.indeks >= streg.length - 1) {
      this.stregFaerdig = true;
      this.aktiv++;
      this.indeks = 0;
      this.holder = false;
      if (this.aktiv >= this.streger.length) this.faerdig = true;
    }
  };

  Spor.prototype.slip = function () {
    this.holder = false;
    this.stregFaerdig = false;
  };

  rod.Spor = Spor;
  rod.Spor.sampl = sampl;
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
