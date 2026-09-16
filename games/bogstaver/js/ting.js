/**
 * Ting der starter med et bogstav, til minispillet efter et tegnet bogstav.
 *
 * Hvert bogstav har ét ord og en tegning i kode. Tegningerne tegnes i en
 * kasse fra -50 til 50 med fronten mod barnet, enkle og i samme streg som
 * resten af spillet. Q, W og Z har ingen gode danske boerneord og er
 * derfor ikke med — for dem springes minispillet over.
 *
 * Ordene skrives med de samme streger som gitteret (glyffer.js), saa det
 * barnet ser, er det barnet lige har tegnet.
 * Data kan testes i Node; tegnefunktionerne kraever et canvas.
 */
(function (rod) {
  'use strict';

  var K = '#12261f';

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

  var TING = {
    A: { ord: 'and', tegn: function (c) {
      ellipse(c, 0, 12, 34, 22, '#ffd23f');
      cirkel(c, 22, -16, 16, '#ffd23f');
      poly(c, [[34, -14], [52, -8], [34, -4]], '#ff8c42');
      prik(c, 26, -20, 3);
      poly(c, [[-38, 6], [-22, 14], [-30, 24]], '#ffd23f');
    } },
    B: { ord: 'bold', tegn: function (c) {
      cirkel(c, 0, 0, 38, '#f7f3e8');
      for (var k = 0; k < 5; k++) { var v = k * Math.PI * 2 / 5 - Math.PI / 2; cirkel(c, Math.cos(v) * 22, Math.sin(v) * 22, 8, K); }
      cirkel(c, 0, 0, 7, K);
    } },
    C: { ord: 'cykel', tegn: function (c) {
      c.lineWidth = 3;
      c.strokeStyle = K; c.fillStyle = 'rgba(0,0,0,0)';
      c.beginPath(); c.arc(-26, 14, 18, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(26, 14, 18, 0, Math.PI * 2); c.stroke();
      c.strokeStyle = '#e8442e'; c.lineWidth = 4;
      c.beginPath(); c.moveTo(-26, 14); c.lineTo(-4, -14); c.lineTo(26, 14); c.lineTo(4, 14); c.lineTo(-4, -14); c.stroke();
      c.strokeStyle = K; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-4, -14); c.lineTo(-10, -24); c.lineTo(-18, -24); c.stroke();
      c.beginPath(); c.moveTo(24, 10); c.lineTo(20, -20); c.lineTo(12, -22); c.lineTo(28, -22); c.stroke();
    } },
    D: { ord: 'drage', tegn: function (c) {
      poly(c, [[0, -44], [26, -6], [0, 24], [-26, -6]], '#e8442e');
      c.beginPath(); c.moveTo(0, -44); c.lineTo(0, 24); c.moveTo(-26, -6); c.lineTo(26, -6); c.stroke();
      c.beginPath(); c.moveTo(0, 24); c.quadraticCurveTo(14, 34, 6, 44); c.quadraticCurveTo(0, 50, 10, 50); c.stroke();
      poly(c, [[10, 36], [18, 30], [16, 40]], '#ffd23f');
    } },
    E: { ord: 'elefant', tegn: function (c) {
      ellipse(c, 6, 4, 34, 26, '#9aa7b5');
      cirkel(c, -24, -10, 18, '#9aa7b5');
      ellipse(c, -34, -2, 12, 16, '#b8c2cc', -0.4);
      c.lineWidth = 8; c.strokeStyle = '#9aa7b5'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-34, 0); c.quadraticCurveTo(-48, 20, -36, 34); c.stroke();
      c.strokeStyle = K; c.lineWidth = 3;
      prik(c, -20, -14, 3);
      c.fillStyle = '#9aa7b5';
      [[-4, 26], [20, 26]].forEach(function (p) { c.beginPath(); c.roundRect(p[0], p[1], 12, 16, 4); c.fill(); c.stroke(); });
    } },
    F: { ord: 'fisk', tegn: function (c) {
      poly(c, [[26, 0], [46, -18], [46, 18]], '#3aa7e0');
      ellipse(c, -2, 0, 32, 20, '#3aa7e0');
      prik(c, -20, -6, 3.5);
      c.beginPath(); c.arc(-6, 0, 14, -0.5, 0.5); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath(); c.ellipse(-4, -8, 12, 5, 0, 0, Math.PI * 2); c.fill();
    } },
    G: { ord: 'gris', tegn: function (c) {
      poly(c, [[-30, -20], [-18, -40], [-8, -22]], '#f4a3c4');
      poly(c, [[30, -20], [18, -40], [8, -22]], '#f4a3c4');
      cirkel(c, 0, 0, 34, '#f4a3c4');
      ellipse(c, 0, 10, 14, 10, '#e77aa8');
      prik(c, -5, 10, 2.5); prik(c, 5, 10, 2.5);
      prik(c, -13, -8, 3.5); prik(c, 13, -8, 3.5);
    } },
    H: { ord: 'hus', tegn: function (c) {
      poly(c, [[-40, -6], [0, -44], [40, -6]], '#e8442e');
      c.fillStyle = '#ffd23f'; c.beginPath(); c.rect(-30, -6, 60, 46); c.fill(); c.stroke();
      c.fillStyle = '#12261f'; c.beginPath(); c.roundRect(-8, 12, 16, 28, 3); c.fill();
      c.fillStyle = '#7fd0f5'; c.beginPath(); c.rect(12, 4, 12, 12); c.fill(); c.stroke();
      c.beginPath(); c.rect(-24, 4, 12, 12); c.fill(); c.stroke();
    } },
    I: { ord: 'is', tegn: function (c) {
      poly(c, [[-18, 0], [18, 0], [0, 46]], '#e0b46c');
      cirkel(c, -10, -8, 14, '#f4a3c4');
      cirkel(c, 10, -8, 14, '#f7f3e8');
      cirkel(c, 0, -24, 15, '#a0522d');
      cirkel(c, 0, -40, 4, '#e8442e');
    } },
    J: { ord: 'jordbær', tegn: function (c) {
      c.fillStyle = '#e8442e'; c.beginPath();
      c.moveTo(0, 44); c.quadraticCurveTo(-40, 10, -26, -14); c.quadraticCurveTo(0, -26, 26, -14); c.quadraticCurveTo(40, 10, 0, 44);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f';
      [[-12, 0], [8, -4], [0, 16], [-8, 24], [14, 14], [-18, 12]].forEach(function (p) { c.beginPath(); c.ellipse(p[0], p[1], 2.5, 3.5, 0, 0, Math.PI * 2); c.fill(); });
      poly(c, [[-22, -18], [-8, -26], [0, -40], [8, -26], [22, -18], [0, -12]], '#4cb944');
    } },
    K: { ord: 'kat', tegn: function (c) {
      poly(c, [[-34, -10], [-30, -44], [-8, -26]], '#ff8c42');
      poly(c, [[34, -10], [30, -44], [8, -26]], '#ff8c42');
      cirkel(c, 0, 0, 34, '#ff8c42');
      cirkel(c, -13, -6, 6, '#4cb944'); cirkel(c, 13, -6, 6, '#4cb944');
      prik(c, -13, -6, 2.5); prik(c, 13, -6, 2.5);
      poly(c, [[-4, 8], [4, 8], [0, 13]], K);
      c.beginPath(); c.moveTo(-14, 12); c.lineTo(-40, 8); c.moveTo(-14, 16); c.lineTo(-40, 20); c.moveTo(14, 12); c.lineTo(40, 8); c.moveTo(14, 16); c.lineTo(40, 20); c.stroke();
    } },
    L: { ord: 'løve', tegn: function (c) {
      c.fillStyle = '#c98f4a';
      for (var k = 0; k < 12; k++) { var v = k * Math.PI / 6; c.beginPath(); c.arc(Math.cos(v) * 34, Math.sin(v) * 34, 11, 0, Math.PI * 2); c.fill(); c.stroke(); }
      cirkel(c, 0, 0, 30, '#ffd23f');
      prik(c, -11, -6, 3.5); prik(c, 11, -6, 3.5);
      ellipse(c, 0, 8, 7, 5, '#c98f4a');
      smil(c, 0, 10, 10);
    } },
    M: { ord: 'måne', tegn: function (c) {
      c.fillStyle = '#ffd23f'; c.beginPath();
      c.arc(0, 0, 38, 0.6, Math.PI * 2 - 0.6, false);
      c.arc(14, 0, 30, Math.PI * 2 - 0.9, 0.9, true);
      c.closePath(); c.fill(); c.stroke();
      prik(c, -16, -8, 3);
      smil(c, -14, 6, 6);
    } },
    N: { ord: 'nøgle', tegn: function (c) {
      c.save(); c.rotate(-Math.PI / 4);
      cirkel(c, -22, 0, 16, '#ffd23f');
      c.fillStyle = '#f7f3e8'; c.beginPath(); c.arc(-22, 0, 6, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f'; c.beginPath(); c.roundRect(-8, -4, 48, 8, 3); c.fill(); c.stroke();
      c.beginPath(); c.rect(26, 4, 6, 10); c.fill(); c.stroke();
      c.beginPath(); c.rect(36, 4, 5, 8); c.fill(); c.stroke();
      c.restore();
    } },
    O: { ord: 'ost', tegn: function (c) {
      poly(c, [[-40, 28], [40, 28], [40, -8], [-40, 10]], '#ffd23f');
      poly(c, [[-40, 10], [40, -8], [20, -28], [-40, -6]], '#ffe680');
      c.fillStyle = '#e0b46c';
      [[-10, 18], [16, 14], [26, 4], [-24, 22]].forEach(function (p) { c.beginPath(); c.arc(p[0], p[1], 5, 0, Math.PI * 2); c.fill(); c.stroke(); });
    } },
    P: { ord: 'paraply', tegn: function (c) {
      c.fillStyle = '#e8442e'; c.beginPath(); c.arc(0, 0, 40, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = K;
      c.beginPath(); c.moveTo(-20, 0); c.quadraticCurveTo(-13, -30, 0, -40); c.moveTo(20, 0); c.quadraticCurveTo(13, -30, 0, -40); c.stroke();
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, 34); c.arc(8, 34, 8, Math.PI, 0, true); c.stroke();
      c.lineWidth = 3;
    } },
    R: { ord: 'regnbue', tegn: function (c) {
      var farver = ['#e8442e', '#ff8c42', '#ffd23f', '#4cb944', '#3aa7e0', '#9b5de5'];
      c.lineWidth = 7; c.lineCap = 'butt';
      farver.forEach(function (f, i) { c.strokeStyle = f; c.beginPath(); c.arc(0, 22, 44 - i * 7, Math.PI, 0); c.stroke(); });
      c.strokeStyle = K; c.lineWidth = 3; c.lineCap = 'round';
      c.beginPath(); c.arc(0, 22, 47.5, Math.PI, 0); c.stroke();
      c.beginPath(); c.arc(0, 22, 5, Math.PI, 0); c.stroke();
    } },
    S: { ord: 'sol', tegn: function (c) {
      c.lineWidth = 4;
      for (var k = 0; k < 8; k++) { var v = k * Math.PI / 4; c.beginPath(); c.moveTo(Math.cos(v) * 30, Math.sin(v) * 30); c.lineTo(Math.cos(v) * 44, Math.sin(v) * 44); c.stroke(); }
      c.lineWidth = 3;
      cirkel(c, 0, 0, 24, '#ffd23f');
      prik(c, -8, -4, 3); prik(c, 8, -4, 3);
      smil(c, 0, 2, 10);
    } },
    T: { ord: 'træ', tegn: function (c) {
      c.fillStyle = '#c98f4a'; c.beginPath(); c.roundRect(-8, 10, 16, 36, 4); c.fill(); c.stroke();
      cirkel(c, -18, 0, 20, '#4cb944');
      cirkel(c, 18, 0, 20, '#4cb944');
      cirkel(c, 0, -20, 24, '#4cb944');
      cirkel(c, -8, -6, 4, '#e8442e'); cirkel(c, 12, 4, 4, '#e8442e');
    } },
    U: { ord: 'ur', tegn: function (c) {
      cirkel(c, 0, 0, 40, '#f7f3e8');
      for (var k = 0; k < 12; k++) { var v = k * Math.PI / 6; prik(c, Math.cos(v) * 32, Math.sin(v) * 32, k % 3 === 0 ? 3 : 1.5); }
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -22); c.moveTo(0, 0); c.lineTo(16, 8); c.stroke();
      c.lineWidth = 3; prik(c, 0, 0, 3.5);
    } },
    V: { ord: 'vante', tegn: function (c) {
      c.fillStyle = '#e8442e'; c.beginPath();
      c.moveTo(-18, 40); c.lineTo(-18, 0); c.arc(2, 0, 20, Math.PI, 0); c.lineTo(22, 40); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-18, 12); c.quadraticCurveTo(-42, 4, -34, -10); c.quadraticCurveTo(-26, -18, -16, -4); c.fill(); c.stroke();
      c.fillStyle = '#f7f3e8'; c.beginPath(); c.roundRect(-20, 30, 44, 14, 4); c.fill(); c.stroke();
    } },
    X: { ord: 'xylofon', tegn: function (c) {
      var farver = ['#e8442e', '#ff8c42', '#ffd23f', '#4cb944', '#3aa7e0', '#9b5de5'];
      farver.forEach(function (f, i) {
        var h = 44 - i * 5;
        c.fillStyle = f; c.beginPath(); c.roundRect(-40 + i * 13.5, -h / 2, 11, h, 3); c.fill(); c.stroke();
      });
      c.lineWidth = 3; c.beginPath(); c.moveTo(22, 30); c.lineTo(40, 6); c.stroke();
      cirkel(c, 41, 4, 5, '#12261f');
    } },
    Y: { ord: 'yoyo', tegn: function (c) {
      c.beginPath(); c.moveTo(0, -46); c.lineTo(0, -6); c.stroke();
      cirkel(c, 0, 14, 30, '#e8442e');
      cirkel(c, 0, 14, 20, '#ffd23f');
      cirkel(c, 0, 14, 6, '#f7f3e8');
      prik(c, 0, -46, 4);
    } },
    AE: { ord: 'æble', tegn: function (c) {
      cirkel(c, 0, 6, 34, '#e8442e');
      c.fillStyle = 'rgba(255,255,255,0.35)'; c.beginPath(); c.ellipse(-12, -8, 9, 5, -0.6, 0, Math.PI * 2); c.fill();
      c.lineWidth = 4; c.beginPath(); c.moveTo(0, -26); c.lineTo(3, -42); c.stroke(); c.lineWidth = 3;
      ellipse(c, 12, -36, 12, 6, '#4cb944', -0.5);
    } },
    OE: { ord: 'øje', tegn: function (c) {
      c.fillStyle = '#f7f3e8'; c.beginPath();
      c.moveTo(-44, 0); c.quadraticCurveTo(0, -40, 44, 0); c.quadraticCurveTo(0, 40, -44, 0); c.closePath(); c.fill(); c.stroke();
      cirkel(c, 0, 0, 17, '#3aa7e0');
      prik(c, 0, 0, 8);
      c.fillStyle = '#fff'; c.beginPath(); c.arc(-5, -6, 3, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.moveTo(-30, -16); c.lineTo(-36, -24); c.moveTo(0, -22); c.lineTo(0, -32); c.moveTo(30, -16); c.lineTo(36, -24); c.stroke();
    } },
    AA: { ord: 'ål', tegn: function (c) {
      c.lineWidth = 12; c.strokeStyle = '#4cb944'; c.lineCap = 'round';
      c.beginPath(); c.moveTo(-40, 10); c.quadraticCurveTo(-20, -30, 0, 0); c.quadraticCurveTo(20, 30, 40, -10); c.stroke();
      c.lineWidth = 3; c.strokeStyle = K;
      c.beginPath(); c.moveTo(-40, 10); c.quadraticCurveTo(-20, -30, 0, 0); c.quadraticCurveTo(20, 30, 40, -10); c.stroke();
      cirkel(c, 40, -10, 9, '#4cb944');
      prik(c, 42, -13, 2.5);
    } }
  };

  // Samme ord for smaa bogstaver: navnene i glyffer.js er a, b, ... ae, oe, aa
  Object.keys(TING).forEach(function (n) { TING[n.toLowerCase()] = TING[n]; });

  rod.Ting = { TING: TING };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
