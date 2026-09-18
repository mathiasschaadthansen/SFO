/**
 * Faelles sprite-indlaesning til alle spil.
 *
 * Sprites ligger i assets/kenney/ (CC0). Billeder hentes én gang og
 * tegnes kun naar de er klar — indtil da tegner spillene deres egne
 * kodetegninger, saa intet venter paa et billede.
 *
 * tint() farver et sprite om ved at bytte farvetone (hue) og beholde lys
 * og skygge. Bruges til farver der ikke findes i pakken, fx orange biler.
 */
(function () {
  'use strict';

  var cache = {};
  var tintCache = {};

  function hent(sti) {
    if (!cache[sti]) {
      var img = new Image();
      img.src = sti;
      cache[sti] = img;
    }
    return cache[sti];
  }

  function klar(img) {
    return !!img && img.complete && img.naturalWidth > 0;
  }

  /** Billedet er paa vej. Saa tegnes ingenting — kodetegningen bruges kun hvis billedet fejler. */
  function venter(img) {
    return !!img && !img.complete;
  }

  /** Hent en liste af sprites med det samme, saa de er klar foer spillet starter. */
  function forhent(stier) {
    return stier.map(hent);
  }

  /**
   * Kald fn naar de sprites der stadig er paa vej, er hentet (eller fejlet).
   * Er alt allerede hentet, kaldes fn IKKE: der er intet at tegne om. Det er
   * vigtigt, for fn tegner typisk skaermen igen og ender her paany — et
   * synkront kald ville give en uendelig loekke.
   */
  function naarKlar(stier, fn) {
    var billeder = forhent(stier);
    var tilbage = billeder.filter(function (b) { return !b.complete; });
    if (!tilbage.length) return false;
    var mangler = tilbage.length;
    tilbage.forEach(function (b) {
      function faerdig() { mangler--; if (mangler === 0) fn(); }
      b.addEventListener('load', faerdig, { once: true });
      b.addEventListener('error', faerdig, { once: true });
    });
    return true;
  }

  function tint(img, farve) {
    if (!klar(img)) return null;
    var noegle = img.src + '|' + farve;
    if (tintCache[noegle]) return tintCache[noegle];
    var c = document.createElement('canvas');
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    var g = c.getContext('2d');
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = 'hue';
    g.fillStyle = farve;
    g.fillRect(0, 0, c.width, c.height);
    g.globalCompositeOperation = 'destination-in';
    g.drawImage(img, 0, 0);
    tintCache[noegle] = c;
    return c;
  }

  window.Sprites = { hent: hent, klar: klar, venter: venter, forhent: forhent, naarKlar: naarKlar, tint: tint };
})();
