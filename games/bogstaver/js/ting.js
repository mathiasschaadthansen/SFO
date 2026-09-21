/**
 * Ting der starter med et bogstav, til minispillet efter et tegnet bogstav og
 * til ORD-legen, hvor hele ordet tegnes.
 *
 * Hvert bogstav har to til fire ting med et billede: et malet billede i
 * billeder/ (se billeder/NOTICE.md), ellers Noto Emoji som SVG i ting/ (Apache
 * 2.0, se ting/NOTICE.md). Den foerste har ogsaa en tegning i kode som
 * reserve, hvis billedet ikke er hentet. Xylofon og aal har intet billede og
 * bruger kun kodetegningen. Q, W og Z har ingen gode danske boerneord og er
 * derfor ikke med — for dem springes minispillet over.
 *
 * Ordene skrives med de samme streger som gitteret (glyffer.js), saa det
 * barnet ser, er det barnet lige har tegnet.
 * Data kan testes i Node; tegnefunktionerne kraever et canvas.
 */
(function (rod) {
  'use strict';

  var K = '#5e4a3a';

  /** Ting med et malet billede i billeder/. De andre bruger Noto-SVG'en i ting/. */
  var MALET = [
    'abe', 'aeble', 'aeg', 'aesel', 'ananas', 'and', 'banan', 'bi', 'bil', 'bold',
    'cirkus', 'citron', 'cykel', 'delfin', 'doer', 'drage', 'edderkop', 'egern', 'elefant', 'fisk',
    'fly', 'froe', 'fugl', 'gave', 'giraf', 'gris', 'gulerod', 'hat', 'hest', 'hund',
    'hus', 'ild', 'is', 'jakke', 'jordbaer', 'juletrae', 'kage', 'kat', 'ko', 'krone',
    'lampe', 'lastbil', 'loeve', 'maane', 'maelk', 'mus', 'naese', 'noed', 'noegle', 'oe',
    'oeje', 'oern', 'orm', 'ost', 'pandekage', 'paraply', 'pingvin', 'pizza', 'raev', 'raket',
    'regnbue', 'robot', 'sko', 'slange', 'tiger', 'tog', 'tomat', 'trae', 'ugle'
  ];
  function sti(navn) {
    return MALET.indexOf(navn) >= 0 ? 'billeder/' + navn + '.png' : 'ting/' + navn + '.svg';
  }

  function cirkel(c, x, y, r, fyld) {
    c.fillStyle = fyld; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  function ellipse(c, x, y, rx, ry, fyld, rot) {
    c.fillStyle = fyld; c.beginPath(); c.ellipse(x, y, rx, ry, rot || 0, 0, Math.PI * 2); c.fill(); c.stroke();
  }
  function poly(c, pts, fyld) {
    c.fillStyle = fyld; c.beginPath();
    pts.forEach(function (p, i) { if (i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); });
    c.closePath(); c.fill(); c.stroke();
  }
  function prik(c, x, y, r) { c.fillStyle = K; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); }
  function smil(c, x, y, r) { c.beginPath(); c.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke(); }

  var TEGN = {
    A: { fil: sti('and'), ord: 'and', tegn: function (c) {
      ellipse(c, 0, 12, 34, 22, '#f0c46a');
      cirkel(c, 22, -16, 16, '#f0c46a');
      poly(c, [[34, -14], [52, -8], [34, -4]], '#e08a52');
      prik(c, 26, -20, 3);
      poly(c, [[-38, 6], [-22, 14], [-30, 24]], '#f0c46a');
    } },
    B: { fil: sti('bold'), ord: 'bold', tegn: function (c) {
      cirkel(c, 0, 0, 38, '#f8f1e6');
      for (var k = 0; k < 5; k++) { var v = k * Math.PI * 2 / 5 - Math.PI / 2; cirkel(c, Math.cos(v) * 22, Math.sin(v) * 22, 8, K); }
      cirkel(c, 0, 0, 7, K);
    } },
    C: { fil: sti('cykel'), ord: 'cykel', tegn: function (c) {
      c.lineWidth = 3;
      c.strokeStyle = K; c.fillStyle = 'rgba(0,0,0,0)';
      c.beginPath(); c.arc(-26, 14, 18, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(26, 14, 18, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#d95f45'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-26, 14); c.lineTo(-4, -14); c.lineTo(26, 14); c.lineTo(4, 14); c.lineTo(-4, -14); c.stroke();
      c.strokeStyle = K; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-4, -14); c.lineTo(-10, -24); c.lineTo(-18, -24); c.stroke();
      c.beginPath(); c.moveTo(24, 10); c.lineTo(20, -20); c.lineTo(12, -22); c.lineTo(28, -22); c.stroke();
    } },
    D: { fil: sti('drage'), ord: 'drage', tegn: function (c) {
      poly(c, [[0, -44], [26, -6], [0, 24], [-26, -6]], '#d95f45');
      c.beginPath(); c.moveTo(0, -44); c.lineTo(0, 24); c.moveTo(-26, -6); c.lineTo(26, -6); c.stroke();
      c.beginPath(); c.moveTo(0, 24); c.quadraticCurveTo(14, 34, 6, 44); c.quadraticCurveTo(0, 50, 10, 50); c.stroke();
      poly(c, [[10, 36], [18, 30], [16, 40]], '#f0c46a');
    } },
    E: { fil: sti('elefant'), ord: 'elefant', tegn: function (c) {
      ellipse(c, 6, 4, 34, 26, '#aaa89c');
      cirkel(c, -24, -10, 18, '#aaa89c');
      ellipse(c, -34, -2, 12, 16, '#c2beb2', -0.4);
      c.lineWidth = 8; c.strokeStyle = '#aaa89c'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-34, 0); c.quadraticCurveTo(-48, 20, -36, 34); c.stroke();
      c.strokeStyle = K; c.lineWidth = 3;
      prik(c, -20, -14, 3);
      c.fillStyle = '#aaa89c';
      [[-4, 26], [20, 26]].forEach(function (p) { c.beginPath(); c.roundRect(p[0], p[1], 12, 16, 4); c.fill(); c.stroke(); });
    } },
    F: { fil: sti('fisk'), ord: 'fisk', tegn: function (c) {
      poly(c, [[26, 0], [46, -18], [46, 18]], '#5f9fc9');
      ellipse(c, -2, 0, 32, 20, '#5f9fc9');
      prik(c, -20, -6, 3.5);
      c.beginPath(); c.arc(-6, 0, 14, -0.5, 0.5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.ellipse(-4, -8, 12, 5, 0, 0, Math.PI * 2); c.fill();
    } },
    G: { fil: sti('gris'), ord: 'gris', tegn: function (c) {
      poly(c, [[-30, -20], [-18, -40], [-8, -22]], '#eaa7c0');
      poly(c, [[30, -20], [18, -40], [8, -22]], '#eaa7c0');
      cirkel(c, 0, 0, 34, '#eaa7c0');
      ellipse(c, 0, 10, 14, 10, '#dc8cae');
      prik(c, -5, 10, 2.5); prik(c, 5, 10, 2.5);
      prik(c, -13, -8, 3.5); prik(c, 13, -8, 3.5);
    } },
    H: { fil: sti('hus'), ord: 'hus', tegn: function (c) {
      poly(c, [[-40, -6], [0, -44], [40, -6]], '#d95f45');
      c.fillStyle = '#f0c46a'; c.beginPath(); c.rect(-30, -6, 60, 46); c.fill(); c.stroke();
      c.fillStyle = '#5e4a3a'; c.beginPath(); c.roundRect(-8, 12, 16, 28, 3); c.fill();
      c.fillStyle = '#8fc7e8'; c.beginPath(); c.rect(12, 4, 12, 12); c.fill(); c.stroke();
      c.beginPath(); c.rect(-24, 4, 12, 12); c.fill(); c.stroke();
    } },
    I: { fil: sti('is'), ord: 'is', tegn: function (c) {
      poly(c, [[-18, 0], [18, 0], [0, 46]], '#ddb377');
      cirkel(c, -10, -8, 14, '#eaa7c0');
      cirkel(c, 10, -8, 14, '#f8f1e6');
      cirkel(c, 0, -24, 15, '#9a5f3c');
      cirkel(c, 0, -40, 4, '#d95f45');
    } },
    J: { fil: sti('jordbaer'), ord: 'jordbær', tegn: function (c) {
      c.fillStyle = '#d95f45'; c.beginPath();
      c.moveTo(0, 44); c.quadraticCurveTo(-40, 10, -26, -14); c.quadraticCurveTo(0, -26, 26, -14); c.quadraticCurveTo(40, 10, 0, 44);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#f0c46a';
      [[-12, 0], [8, -4], [0, 16], [-8, 24], [14, 14], [-18, 12]].forEach(function (p) { c.beginPath(); c.ellipse(p[0], p[1], 2.5, 3.5, 0, 0, Math.PI * 2); c.fill(); });
      poly(c, [[-22, -18], [-8, -26], [0, -40], [8, -26], [22, -18], [0, -12]], '#7ab648');
    } },
    K: { fil: sti('kat'), ord: 'kat', tegn: function (c) {
      poly(c, [[-34, -10], [-30, -44], [-8, -26]], '#e08a52');
      poly(c, [[34, -10], [30, -44], [8, -26]], '#e08a52');
      cirkel(c, 0, 0, 34, '#e08a52');
      cirkel(c, -13, -6, 6, '#7ab648'); cirkel(c, 13, -6, 6, '#7ab648');
      prik(c, -13, -6, 2.5); prik(c, 13, -6, 2.5);
      poly(c, [[-4, 8], [4, 8], [0, 13]], K);
      c.beginPath(); c.moveTo(-14, 12); c.lineTo(-40, 8); c.moveTo(-14, 16); c.lineTo(-40, 20); c.moveTo(14, 12); c.lineTo(40, 8); c.moveTo(14, 16); c.lineTo(40, 20); c.stroke();
    } },
    L: { fil: sti('loeve'), ord: 'løve', tegn: function (c) {
      c.fillStyle = '#b9874f';
      for (var k = 0; k < 12; k++) { var v = k * Math.PI / 6; c.beginPath(); c.arc(Math.cos(v) * 34, Math.sin(v) * 34, 11, 0, Math.PI * 2); c.fill(); c.stroke(); }
      cirkel(c, 0, 0, 30, '#f0c46a');
      prik(c, -11, -6, 3.5); prik(c, 11, -6, 3.5);
      ellipse(c, 0, 8, 7, 5, '#b9874f');
      smil(c, 0, 10, 10);
    } },
    M: { fil: sti('maane'), ord: 'måne', tegn: function (c) {
      c.fillStyle = '#f0c46a'; c.beginPath();
      c.arc(0, 0, 38, 0.6, Math.PI * 2 - 0.6, false);
      c.arc(14, 0, 30, Math.PI * 2 - 0.9, 0.9, true);
      c.closePath(); c.fill(); c.stroke();
      prik(c, -16, -8, 3);
      smil(c, -14, 6, 6);
    } },
    N: { fil: sti('noegle'), ord: 'nøgle', tegn: function (c) {
      c.save(); c.rotate(-Math.PI / 4);
      cirkel(c, -22, 0, 16, '#f0c46a');
      c.fillStyle = '#f8f1e6'; c.beginPath(); c.arc(-22, 0, 6, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#f0c46a'; c.beginPath(); c.roundRect(-8, -4, 48, 8, 3); c.fill(); c.stroke();
      c.beginPath(); c.rect(26, 4, 6, 10); c.fill(); c.stroke();
      c.beginPath(); c.rect(36, 4, 5, 8); c.fill(); c.stroke();
      c.restore();
    } },
    O: { fil: sti('ost'), ord: 'ost', tegn: function (c) {
      poly(c, [[-40, 28], [40, 28], [40, -8], [-40, 10]], '#f0c46a');
      poly(c, [[-40, 10], [40, -8], [20, -28], [-40, -6]], '#f5dfa2');
      c.fillStyle = '#ddb377';
      [[-10, 18], [16, 14], [26, 4], [-24, 22]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 5, 0, Math.PI * 2); c.fill(); c.stroke(); });
    } },
    P: { fil: sti('paraply'), ord: 'paraply', tegn: function (c) {
      c.fillStyle = '#d95f45'; c.beginPath(); c.arc(0, 0, 40, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = K;
      c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-13, -30, 0, -40); c.moveTo(20, 0); c.quadraticCurveTo(13, -30, 0, -40); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34); c.arc(8, 34, 8, Math.PI, 0, true); c.stroke();
      c.lineWidth = 3;
    } },
    R: { fil: sti('regnbue'), ord: 'regnbue', tegn: function (c) {
      var farver = ['#d95f45', '#e08a52', '#f0c46a', '#7ab648', '#5f9fc9', '#9b7bd4'];
      c.lineWidth = 7; c.lineCap = 'butt';
      farver.forEach(function (f, i) { c.strokeStyle = f; c.beginPath(); c.arc(0, 22, 44 - i * 7, Math.PI, 0); c.stroke(); });
      c.strokeStyle = K; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 22, 47.5, Math.PI, 0); c.stroke();
      c.beginPath(); c.arc(0, 22, 5, Math.PI, 0); c.stroke();
    } },
    S: { fil: sti('sol'), ord: 'sol', tegn: function (c) {
      c.lineWidth = 4;
      for (var k = 0; k < 8; k++) { var v = k * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(v) * 30, Math.sin(v) * 30); c.lineTo(Math.cos(v) * 44, Math.sin(v) * 44); c.stroke(); }
      c.lineWidth = 3;
      cirkel(c, 0, 0, 24, '#f0c46a');
      prik(c, -8, -4, 3); prik(c, 8, -4, 3);
      smil(c, 0, 2, 10);
    } },
    T: { fil: sti('trae'), ord: 'træ', tegn: function (c) {
      c.fillStyle = '#b9874f'; c.beginPath(); c.roundRect(-8, 10, 16, 36, 4); c.fill(); c.stroke();
      cirkel(c, -18, 0, 20, '#7ab648');
      cirkel(c, 18, 0, 20, '#7ab648');
      cirkel(c, 0, -20, 24, '#7ab648');
      cirkel(c, -8, -6, 4, '#d95f45'); cirkel(c, 12, 4, 4, '#d95f45');
    } },
    U: { fil: sti('ur'), ord: 'ur', tegn: function (c) {
      cirkel(c, 0, 0, 40, '#f8f1e6');
      for (var k = 0; k < 12; k++) { var v = k * Math.PI / 6; prik(c, Math.cos(v) * 32, Math.sin(v) * 32, k % 3 === 0 ? 3 : 1.5); }
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -22); c.moveTo(0, 0); c.lineTo(16, 8); c.stroke();
      c.lineWidth = 3; prik(c, 0, 0, 3.5);
    } },
    V: { fil: sti('vante'), ord: 'vante', tegn: function (c) {
      c.fillStyle = '#d95f45'; c.beginPath();
      c.moveTo(-18, 40); c.lineTo(-18, 0); c.arc(2, 0, 20, Math.PI, 0); c.lineTo(22, 40); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-18, 12); c.quadraticCurveTo(-42, 4, -34, -10); c.quadraticCurveTo(-26, -18, -16, -4); c.fill(); c.stroke();
      c.fillStyle = '#f8f1e6'; c.beginPath(); c.roundRect(-20, 30, 44, 14, 4); c.fill(); c.stroke();
    } },
    X: { ord: 'xylofon', tegn: function (c) {
      var farver = ['#d95f45', '#e08a52', '#f0c46a', '#7ab648', '#5f9fc9', '#9b7bd4'];
      farver.forEach(function (f, i) {
        var h = 44 - i * 5;
        c.fillStyle = f; c.beginPath(); c.roundRect(-40 + i * 13.5, -h / 2, 11, h, 3); c.fill(); c.stroke();
      });
      c.lineWidth = 3; c.beginPath(); c.moveTo(22, 30); c.lineTo(40, 6); c.stroke();
      cirkel(c, 41, 4, 5, '#5e4a3a');
    } },
    Y: { fil: sti('yoyo'), ord: 'yoyo', tegn: function (c) {
      c.beginPath(); c.moveTo(0, -46); c.lineTo(0, -6); c.stroke();
      cirkel(c, 0, 14, 30, '#d95f45');
      cirkel(c, 0, 14, 20, '#f0c46a');
      cirkel(c, 0, 14, 6, '#f8f1e6');
      prik(c, 0, -46, 4);
    } },
    AE: { fil: sti('aeble'), ord: 'æble', tegn: function (c) {
      cirkel(c, 0, 6, 34, '#d95f45');
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-12, -8, 9, 5, -0.6, 0, Math.PI * 2); c.fill();
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, -26); c.lineTo(3, -42); c.stroke(); c.lineWidth = 3;
      ellipse(c, 12, -36, 12, 6, '#7ab648', -0.5);
    } },
    OE: { fil: sti('oeje'), ord: 'øje', tegn: function (c) {
      c.fillStyle = '#f8f1e6'; c.beginPath();
      c.moveTo(-44, 0); c.quadraticCurveTo(0, -40, 44, 0); c.quadraticCurveTo(0, 40, -44, 0); c.closePath(); c.fill(); c.stroke();
      cirkel(c, 0, 0, 17, '#5f9fc9');
      prik(c, 0, 0, 8);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -6, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-30, -16); c.lineTo(-36, -24); c.moveTo(0, -22); c.lineTo(0, -32); c.moveTo(30, -16); c.lineTo(36, -24); c.stroke();
    } },
    AA: { ord: 'ål', tegn: function (c) {
      c.lineWidth = 12; c.strokeStyle = '#7ab648'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-40, 10); c.quadraticCurveTo(-20, -30, 0, 0); c.quadraticCurveTo(20, 30, 40, -10); c.stroke();
      c.lineWidth = 3; c.strokeStyle = K;
      c.beginPath(); c.moveTo(-40, 10); c.quadraticCurveTo(-20, -30, 0, 0); c.quadraticCurveTo(20, 30, 40, -10); c.stroke();
      cirkel(c, 40, -10, 9, '#7ab648');
      prik(c, 42, -13, 2.5);
    } }
  };

  /**
   * Ekstra ting pr. bogstav, kun som billede. Saa er det ikke altid "bold" ved B.
   * Format: bogstav, ord, filnavn (uden ae/oe/aa).
   */
  var EKSTRA = [
    ['A', 'abe', 'abe'],
    ['A', 'ananas', 'ananas'],
    ['B', 'bil', 'bil'],
    ['B', 'banan', 'banan'],
    ['B', 'bi', 'bi'],
    ['C', 'citron', 'citron'],
    ['C', 'cirkus', 'cirkus'],
    ['D', 'delfin', 'delfin'],
    ['D', 'dør', 'doer'],
    ['E', 'edderkop', 'edderkop'],
    ['E', 'egern', 'egern'],
    ['F', 'frø', 'froe'],
    ['F', 'fugl', 'fugl'],
    ['F', 'fly', 'fly'],
    ['G', 'giraf', 'giraf'],
    ['G', 'gave', 'gave'],
    ['G', 'gulerod', 'gulerod'],
    ['H', 'hest', 'hest'],
    ['H', 'hat', 'hat'],
    ['H', 'hund', 'hund'],
    ['I', 'ild', 'ild'],
    ['J', 'jakke', 'jakke'],
    ['J', 'juletræ', 'juletrae'],
    ['K', 'ko', 'ko'],
    ['K', 'kage', 'kage'],
    ['K', 'krone', 'krone'],
    ['L', 'lastbil', 'lastbil'],
    ['L', 'lampe', 'lampe'],
    ['M', 'mus', 'mus'],
    ['M', 'mælk', 'maelk'],
    ['N', 'næse', 'naese'],
    ['N', 'nød', 'noed'],
    ['O', 'orm', 'orm'],
    ['P', 'pandekage', 'pandekage'],
    ['P', 'pingvin', 'pingvin'],
    ['P', 'pizza', 'pizza'],
    ['R', 'raket', 'raket'],
    ['R', 'robot', 'robot'],
    ['R', 'ræv', 'raev'],
    ['S', 'slange', 'slange'],
    ['S', 'sko', 'sko'],
    ['S', 'sommerfugl', 'sommerfugl'],
    ['T', 'tog', 'tog'],
    ['T', 'tiger', 'tiger'],
    ['T', 'tomat', 'tomat'],
    ['U', 'ugle', 'ugle'],
    ['V', 'vandmelon', 'vandmelon'],
    ['V', 'vulkan', 'vulkan'],
    ['AE', 'æg', 'aeg'],
    ['AE', 'æsel', 'aesel'],
    ['OE', 'ø', 'oe'],
    ['OE', 'ørn', 'oern'],
  ];

  // TING[bogstav] = liste af ting: den foerste har ogsaa en tegning i kode som reserve.
  var TING = {};
  Object.keys(TEGN).forEach(function (n) { TING[n] = [TEGN[n]]; });
  EKSTRA.forEach(function (e) {
    if (!TING[e[0]]) TING[e[0]] = [];
    TING[e[0]].push({ ord: e[1], fil: sti(e[2]) });
  });

  // Samme ting for smaa bogstaver: navnene i glyffer.js er a, b, ... ae, oe, aa
  Object.keys(TING).forEach(function (n) { TING[n.toLowerCase()] = TING[n]; });

  /** Vaelg en ting for et bogstav, helst ikke den samme som sidst. */
  var sidste = {};
  function vaelg(navn) {
    var liste = TING[navn];
    if (!liste || !liste.length) return null;
    var kandidater = liste.length > 1 ? liste.filter(function (t) { return t !== sidste[navn]; }) : liste;
    var t = kandidater[Math.floor(Math.random() * kandidater.length)];
    sidste[navn] = t;
    return t;
  }

  /**
   * Til ORD-legen: alle ting med et ord, der er kort nok til stjernerne, uden
   * gengangere. Én stjerne giver de korte ord (is, ko, hus), to stjerner op til
   * fem bogstaver, tre stjerner alle.
   */
  var ORD_LAENGDE = [3, 5, 99];
  function ordKandidater(svaerhed) {
    var set = {}, ud = [];
    Object.keys(TING).forEach(function (n) {
      if (n !== n.toUpperCase()) return;   // de smaa deler ting med de store
      TING[n].forEach(function (t) {
        if (set[t.ord] || t.ord.length > ORD_LAENGDE[Math.max(0, Math.min(2, svaerhed))]) return;
        set[t.ord] = true;
        ud.push(t);
      });
    });
    return ud;
  }

  rod.Ting = { TING: TING, vaelg: vaelg, ordKandidater: ordKandidater, ORD_LAENGDE: ORD_LAENGDE };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
