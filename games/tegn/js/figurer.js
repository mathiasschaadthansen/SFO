/**
 * Figurer til Tegn og pusl.
 *
 * Hver figur ligger i en kasse paa 100 x 100 (y nedad) og bestaar af dele, der
 * tegnes bagfra og frem. En del er en streg (sti), som barnet foelger med
 * fingeren. Er delen lukket, fyldes den med farve, saa snart den er tegnet.
 * Dele med pynt: true (oejne, smil) skal ikke tegnes. De dukker op, naar
 * figuren er faerdig.
 *
 * Ingen DOM, saa filen kan testes i Node.
 */
(function (rod) {
  'use strict';

  function bue(cx, cy, rx, ry, a0, a1) {
    var ud = [], n = Math.max(6, Math.round(Math.abs(a1 - a0) / 10));
    for (var i = 0; i <= n; i++) {
      var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      ud.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return ud;
  }
  /** Lukket ellipse, tegnet fra toppen og uret rundt. */
  function oval(cx, cy, rx, ry) { return bue(cx, cy, rx, ry, -90, 270); }
  /** Lukket mangekant: foerste punkt gentages til sidst. */
  function kant() { var p = Array.prototype.slice.call(arguments); return p.concat([p[0]]); }
  function kasse(x, y, b, h) { return kant([x, y], [x + b, y], [x + b, y + h], [x, y + h]); }
  function sammen() { var ud = []; for (var i = 0; i < arguments.length; i++) ud = ud.concat(arguments[i]); return ud; }
  function boelge(x0, y0, x1, y1, udsving, antal) {
    var ud = [], n = antal * 8, dx = x1 - x0, dy = y1 - y0, l = Math.hypot(dx, dy);
    for (var i = 0; i <= n; i++) {
      var t = i / n, s = Math.sin(t * antal * Math.PI) * udsving;
      ud.push([x0 + dx * t - dy / l * s, y0 + dy * t + dx / l * s]);
    }
    return ud;
  }
  function stjerne(cx, cy, ry, ri, takker) {
    var p = [];
    for (var i = 0; i < takker * 2; i++) {
      var a = -Math.PI / 2 + i * Math.PI / takker, r = i % 2 ? ri : ry;
      p.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return p.concat([p[0]]);
  }

  function del(sti, fyld, farve) { return { sti: sti, fyld: fyld || null, farve: farve || '#5e4a3a' }; }
  function pynt(sti, fyld, farve) { var d = del(sti, fyld, farve); d.pynt = true; return d; }
  function oeje(x, y, r) { return pynt(oval(x, y, r || 2.6, r || 2.6), '#5e4a3a'); }
  function smil(x, y, b) { return pynt(bue(x, y, b, b * 0.7, 20, 160)); }

  var UNIVERSER = [
    { id: 'hav', navn: 'Havet', figurer: [
      { id: 'fisk', navn: 'en fisk', dele: [
        del(kant([72, 50], [94, 30], [94, 70]), '#e08a52'),
        del(oval(44, 50, 32, 21), '#edaf63'),
        oeje(28, 45), smil(27, 52, 5), pynt(bue(52, 50, 8, 14, -70, 70)) ] },
      { id: 'soestjerne', navn: 'en søstjerne', dele: [
        del(stjerne(50, 53, 42, 19, 5), '#f0c46a'),
        oeje(43, 48), oeje(57, 48), smil(50, 54, 6) ] },
      { id: 'hval', navn: 'en hval', dele: [
        del(kant([78, 58], [96, 38], [90, 58], [96, 76]), '#5f9fc9'),
        del(oval(45, 58, 37, 24), '#7bb6d8'),
        del(sammen([[45, 34]], [[45, 22]], bue(38, 22, 7, 7, 0, -180)), null, '#5f9fc9'),
        oeje(24, 54), smil(22, 64, 7), pynt(bue(52, 22, 7, 7, 180, 360), null, '#5f9fc9') ] },
      { id: 'blaeksprutte', navn: 'en blæksprutte', dele: [
        del(boelge(32, 52, 18, 92, 4, 3), null, '#9b7bd4'),
        del(boelge(44, 56, 40, 94, 4, 3), null, '#9b7bd4'),
        del(boelge(56, 56, 60, 94, 4, 3), null, '#9b7bd4'),
        del(boelge(68, 52, 82, 92, 4, 3), null, '#9b7bd4'),
        del(oval(50, 36, 27, 25), '#bba4e0'),
        oeje(41, 34, 3), oeje(59, 34, 3), smil(50, 42, 6) ] }
    ] },
    { id: 'dyr', navn: 'Dyrene', figurer: [
      { id: 'kat', navn: 'en kat', dele: [
        del(kant([24, 40], [26, 8], [48, 26]), '#e08a52'),
        del(kant([76, 40], [74, 8], [52, 26]), '#e08a52'),
        del(oval(50, 56, 33, 30), '#edaf63'),
        oeje(38, 50, 3), oeje(62, 50, 3), pynt(kant([46, 60], [54, 60], [50, 65]), '#d95f45'), smil(50, 66, 7),
        pynt([[30, 62], [12, 58]]), pynt([[30, 67], [12, 70]]), pynt([[70, 62], [88, 58]]), pynt([[70, 67], [88, 70]]) ] },
      { id: 'snegl', navn: 'en snegl', dele: [
        del(sammen([[10, 84]], [[84, 84]], bue(84, 72, 10, 12, 90, -90), [[78, 60], [78, 40]]), null, '#93bc63'),
        del(oval(44, 56, 29, 28), '#e08a52'),
        pynt(sammen(bue(44, 56, 19, 18, 100, -200), bue(47, 56, 10, 10, 160, -120)), null, '#a8643a'),
        oeje(78, 36, 3.4), smil(86, 70, 4) ] },
      { id: 'sommerfugl', navn: 'en sommerfugl', dele: [
        del(oval(28, 34, 22, 22), '#d95f45'),
        del(oval(72, 34, 22, 22), '#d95f45'),
        del(oval(32, 72, 17, 16), '#e08a52'),
        del(oval(68, 72, 17, 16), '#e08a52'),
        del(oval(50, 52, 6, 30), '#7a5638'),
        pynt(sammen([[47, 24]], bue(40, 14, 7, 9, 60, -120))), pynt(sammen([[53, 24]], bue(60, 14, 7, 9, 120, 300))),
        pynt(oval(28, 34, 8, 8), '#f0c46a'), pynt(oval(72, 34, 8, 8), '#f0c46a') ] },
      { id: 'kylling', navn: 'en kylling', dele: [
        del([[42, 80], [42, 94], [34, 94]], null, '#e08a52'),
        del([[58, 80], [58, 94], [66, 94]], null, '#e08a52'),
        del(oval(50, 60, 28, 24), '#f0c46a'),
        del(oval(62, 28, 17, 17), '#f3d28a'),
        del(kant([78, 24], [94, 30], [78, 35]), '#e08a52'),
        oeje(66, 25, 2.8), pynt(bue(40, 60, 12, 10, -40, 140)) ] }
    ] },
    { id: 'maskiner', navn: 'Maskiner', figurer: [
      { id: 'bil', navn: 'en bil', dele: [
        del(kant([30, 44], [38, 24], [68, 24], [78, 44]), '#b5dcef'),
        del(sammen([[8, 46]], [[92, 46]], [[92, 70]], [[8, 70]], [[8, 46]]), '#d95f45'),
        del(oval(28, 72, 12, 12), '#4e4a45'),
        del(oval(72, 72, 12, 12), '#4e4a45'),
        pynt(oval(28, 72, 4, 4), '#ddd4c0'), pynt(oval(72, 72, 4, 4), '#ddd4c0'), pynt([[53, 24], [53, 44]]), pynt(oval(87, 54, 3, 3), '#f0c46a') ] },
      { id: 'raket', navn: 'en raket', dele: [
        del(kant([32, 62], [14, 86], [34, 80]), '#d95f45'),
        del(kant([68, 62], [86, 86], [66, 80]), '#d95f45'),
        del(sammen([[50, 6]], bue(50, 50, 20, 44, -90, 40).slice(1), [[64, 82], [36, 82]], bue(50, 50, 20, 44, 140, 270).slice(0)), '#f4efe4'),
        del(oval(50, 42, 10, 10), '#7bb6d8'),
        pynt(kant([40, 84], [50, 99], [60, 84]), '#edaf63') ] },
      { id: 'tog', navn: 'et tog', dele: [
        del(kasse(58, 22, 30, 50), '#d95f45'),
        del(kasse(10, 42, 48, 30), '#5f9fc9'),
        del(kasse(20, 22, 12, 20), '#4e4a45'),
        del(oval(24, 78, 10, 10), '#4e4a45'),
        del(oval(50, 78, 10, 10), '#4e4a45'),
        del(oval(76, 78, 10, 10), '#4e4a45'),
        pynt(kasse(65, 30, 16, 16), '#f7e3b8'), pynt(oval(22, 12, 6, 5), '#f4efe4'), pynt(oval(34, 6, 5, 4), '#f4efe4') ] },
      { id: 'robot', navn: 'en robot', dele: [
        del([[50, 18], [50, 6]], null, '#4e4a45'),
        del(kasse(30, 18, 40, 28), '#b5dcef'),
        del(kasse(24, 50, 52, 36), '#7bb6d8'),
        del([[24, 58], [8, 58], [8, 76]], null, '#4e4a45'),
        del([[76, 58], [92, 58], [92, 76]], null, '#4e4a45'),
        pynt(oval(50, 5, 4, 4), '#d95f45'), pynt(oval(41, 30, 5, 5), '#f0c46a'), pynt(oval(59, 30, 5, 5), '#f0c46a'),
        pynt([[42, 40], [58, 40]]), pynt(oval(38, 64, 4, 4), '#d95f45'), pynt(oval(50, 64, 4, 4), '#f0c46a'), pynt(oval(62, 64, 4, 4), '#7ab648') ] }
    ] },
    { id: 'have', navn: 'Haven', figurer: [
      { id: 'hus', navn: 'et hus', dele: [
        del(kasse(20, 46, 60, 46), '#f2d5a0'),
        del(kant([10, 48], [50, 10], [90, 48]), '#d95f45'),
        del(kasse(42, 66, 16, 26), '#97714a'),
        pynt(kasse(62, 56, 12, 12), '#b5dcef'), pynt(kasse(26, 56, 12, 12), '#b5dcef'), pynt(oval(54, 80, 1.6, 1.6), '#f0c46a') ] },
      { id: 'trae', navn: 'et træ', dele: [
        del(kasse(42, 56, 16, 38), '#97714a'),
        del(oval(50, 36, 32, 30), '#7ab648'),
        pynt(oval(36, 30, 4, 4), '#d95f45'), pynt(oval(58, 24, 4, 4), '#d95f45'), pynt(oval(64, 44, 4, 4), '#d95f45'), pynt(oval(42, 48, 4, 4), '#d95f45') ] },
      { id: 'sol', navn: 'en sol', dele: [
        del(oval(50, 50, 22, 22), '#f0c46a'),
        del([[50, 22], [50, 6]], null, '#edaf63'),
        del([[74, 36], [88, 28]], null, '#edaf63'),
        del([[74, 64], [88, 72]], null, '#edaf63'),
        del([[50, 78], [50, 94]], null, '#edaf63'),
        del([[26, 64], [12, 72]], null, '#edaf63'),
        del([[26, 36], [12, 28]], null, '#edaf63'),
        oeje(42, 46), oeje(58, 46), smil(50, 52, 8) ] },
      { id: 'blomst', navn: 'en blomst', dele: [
        del([[50, 50], [50, 96]], null, '#7ab648'),
        del(oval(50, 18, 12, 12), '#e894b4'),
        del(oval(71, 33, 12, 12), '#e894b4'),
        del(oval(63, 57, 12, 12), '#e894b4'),
        del(oval(37, 57, 12, 12), '#e894b4'),
        del(oval(29, 33, 12, 12), '#e894b4'),
        del(oval(50, 40, 11, 11), '#f0c46a'),
        pynt(sammen([[50, 80]], bue(62, 80, 12, 8, 180, 360), bue(62, 80, 12, 8, 0, 180)), '#93bc63') ] }
    ] }
  ];

  /** Kun de dele barnet skal tegne, i raekkefoelge. Passer til Spor fra bogstav-spillet. */
  function glyf(figur) {
    return { streger: figur.dele.filter(function (d) { return !d.pynt; }).map(function (d) { return d.sti; }) };
  }

  function lukket(d) {
    var a = d.sti[0], b = d.sti[d.sti.length - 1];
    return Math.hypot(a[0] - b[0], a[1] - b[1]) < 0.01;
  }

  rod.Figurer = { UNIVERSER: UNIVERSER, glyf: glyf, lukket: lukket };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
