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

  window.Sprites = { hent: hent, klar: klar, tint: tint };
})();
