/**
 * Pelles julekalender — opgaveark: siderne.
 *
 * Stiller arkene op ud fra indholdet i ark.js: forsiden til laereren, en
 * oversigt over dagene, ét eller to ark pr. dag og facit bagerst. Hver
 * opgavetype har en tegner (OPG), der svarer { h, svg, html } for en bredde
 * paa B mm. Tingene og bogstaverne tegnes af tegn.js.
 *
 * Kraever en browser (billederne goeres til stregtegninger i canvas). Naar alt
 * er bygget, saettes window.KLAR = true, og window.OVERLOEB lister de ark,
 * hvor indholdet ikke kan vaere paa siden.
 */
(function () {
  'use strict';

  var A = window.JulArk, T = window.Tegn, L = T.Linjer, P = window.Puslespil;
  var MOTIV_STREG = true;   // vaerktoej/jul-ark/puslespil-streg.png findes
  var B = 182;                         // indholdets bredde i mm (A4 minus margen)
  var n = T.n;

  /* ---------- smaa hjaelpere ---------- */

  var froe = 1;
  function saa(s) { froe = s; }
  function tilfaeldig() { froe = (froe * 1664525 + 1013904223) % 4294967296; return froe / 4294967296; }
  function el(tag, klasse, html) { var e = document.createElement(tag); if (klasse) e.className = klasse; if (html !== undefined) e.innerHTML = html; return e; }

  /** Et ords billede som stregtegning i en kasse paa s x s med midten i (cx, cy). */
  function ord(o, cx, cy, s) { return L.billede(A.ordBillede(o), cx, cy, s, s); }
  function kort(x, y, b, h, o) { return T.rekt(x, y, b, h, Math.min(4, b * 0.12), Object.assign({ kant: T.LYS, w: 0.4, fyld: '#fff' }, o || {})); }
  function prik(x, y) { return T.cirkel(x, y, 1.3, { fyld: T.BLAEK, kant: 'none' }); }
  /** En svarboks; med prikket = tallet er prikket med startprik og pile. */
  function svarboks(x, y, b, h, tal, prikket) {
    var ud = T.rekt(x, y, b, h, 3, { w: 0.6, fyld: '#fff' });
    if (prikket) ud += T.skrift(String(tal), { x: x + b / 2, base: y + h * 0.8, h: h * 0.6, stil: 'spor', anker: 'midte' }).svg;
    return ud;
  }
  function tal(t, x, base, h, o) { return T.skrift(String(t), Object.assign({ x: x, base: base, h: h, anker: 'midte' }, o || {})).svg; }
  /** Plus, minus og lig med som streger, saa de passer til tallene. */
  function tegnTegn(t, cx, cy, s) {
    var w = Math.max(0.6, s * 0.12), o = { w: w };
    if (t === '+') return T.linje(cx - s / 2, cy, cx + s / 2, cy, o) + T.linje(cx, cy - s / 2, cx, cy + s / 2, o);
    if (t === '-') return T.linje(cx - s / 2, cy, cx + s / 2, cy, o);
    if (t === '=') return T.linje(cx - s / 2, cy - s * 0.2, cx + s / 2, cy - s * 0.2, o) + T.linje(cx - s / 2, cy + s * 0.2, cx + s / 2, cy + s * 0.2, o);
    return '';
  }
  /** n ting i raekker paa hoejst pr, centreret om (cx, cy). */
  function gitter(ting, antal, cx, cy, s, afst, pr) {
    var ud = '', raek = Math.ceil(antal / pr);
    for (var i = 0; i < antal; i++) {
      var r = Math.floor(i / pr), iR = Math.min(pr, antal - r * pr), c = i - r * pr;
      ud += T.TING[ting](cx + (c - (iR - 1) / 2) * afst, cy + (r - (raek - 1) / 2) * afst, s);
    }
    return ud;
  }
  /** En bunke stammer (bredest nederst) med bunden i (cx, bund). */
  function bunke(antal, cx, bund, s) {
    var nb = 1, ud = '', raekke = 0, igen = antal;
    while (nb * (nb + 1) / 2 < antal) nb++;
    var hh = s * 0.34;
    while (igen > 0) {
      var m = Math.min(igen, nb - raekke);
      for (var i = 0; i < m; i++) ud += T.TING.stamme(cx + (i - (m - 1) / 2) * s * 1.02, bund - hh / 2 - raekke * hh * 0.98, s);
      igen -= m; raekke++;
    }
    return ud;
  }
  var KUGLEPLADS = [[0, 0.3], [-0.12, 0.52], [0.13, 0.5], [-0.25, 0.76], [0.24, 0.78], [0.02, 0.68], [-0.02, 0.44], [0.33, 0.83], [-0.34, 0.84], [0.1, 0.82]];

  /* ---------- opgaverne ---------- */

  var OPG = {
    taelTrae: function (o) {
      var kugler = KUGLEPLADS.slice(0, o.antal);
      return { h: 94, svg: T.trae(62, 4, 88, { kugler: kugler }) + svarboks(128, 26, 40, 48, o.antal, o.prikket) };
    },

    taelSkriv: function (o) {
      var ud = '', y = 0;
      o.raekker.forEach(function (r) {
        var rh = r.mangler ? 40 : 28, s = r.mangler ? 17 : 17, i;
        if (r.mangler) {
          var plads = r.antal + r.mangler, pr = Math.ceil(plads / 2), x0 = 18;
          ud += T.rekt(6, y + 1, pr * 24 + 14, 38, 3, { w: 0.6, fyld: '#fff' }) + T.rekt(9, y + 4, pr * 24 + 8, 32, 2, { w: 0.3, kant: T.GRAA });
          for (i = 0; i < plads; i++) {
            var cx = x0 + 5 + (i % pr) * 24, cy = y + 12 + Math.floor(i / pr) * 16;
            ud += i < r.antal ? T.TING[r.ting](cx, cy, 14) : T.cirkel(cx, cy, 6, { kant: T.GRAA, w: 0.35, stiplet: '1 1.2' });
          }
        } else {
          for (i = 0; i < r.antal; i++) ud += T.TING[r.ting](14 + i * 24, y + rh / 2, s + 2);
        }
        ud += svarboks(146, y + (rh - 24) / 2, 30, 24, r.antal, o.prikket);
        y += rh + 2;
      });
      return { h: y, svg: ud };
    },

    forbindTal: function (o) {
      var ud = '', rh = 30;
      o.maengder.forEach(function (m, i) {
        var cy = i * rh + rh / 2, cx = 32;
        ud += T.ellipse(cx, cy, 24, 14, { w: 0.6, fyld: '#fff' }) + T.ellipse(cx, cy, 21.5, 11.5, { w: 0.3, kant: T.GRAA });
        if (m.moenster === 'raekke') { for (var k = 0; k < m.antal; k++) ud += T.TING.noed(cx + (k - (m.antal - 1) / 2) * 11, cy, 10); }
        else {
          var Pm = { 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] }[m.antal];
          Pm.forEach(function (p) { ud += T.TING.noed(cx + p[0] * 10, cy + p[1] * 5.2, 8); });
        }
        ud += prik(62, cy);
        var t = o.tal[i];
        ud += T.rekt(140, cy - 12, 22, 24, 3, { w: 0.6, fyld: '#fff' }) + tal(t, 151, cy + 7, 14) + prik(132, cy);
      });
      return { h: o.maengder.length * rh, svg: ud };
    },

    tegnSaa: function (o) {
      if (o.ramme === 'trae') {
        var f = o.felter[0];
        return { h: 94, svg: T.trae(66, 4, 88, { kugler: [] }) + T.rekt(126, 20, 46, 54, 4, { w: 0.6, fyld: '#fff' }) + tal(f.antal, 149, 62, 30) + T.TING[o.ting](168, 28, 8) };
      }
      var ud = '', k = o.felter.length, bb = (B - (k - 1) * 8) / k;
      o.felter.forEach(function (f, i) {
        var x = i * (bb + 8);
        ud += T.rekt(x, 2, bb, 54, 4, { w: 0.6, fyld: '#fff' }) + T.cirkel(x + 13, 15, 9, { w: 0.5 }) + tal(f.antal, x + 13, 20.5, 11) +
          T.ellipse(x + bb / 2 + 8, 32, bb / 2 - 16, 19, { w: 0.5, kant: T.GRAA, stiplet: '1.4 1.4' });
      });
      return { h: 58, svg: ud };
    },

    regne: function (o) {
      var ud = '', y = 0;
      o.stykker.forEach(function (st) {
        var rh = 46, cy = y + 18, maks = Math.min(5, Math.max(st.a, st.b));
        // Plads til to kasser, tegnene og svarboksen paa én linje
        var af = st.op === '+' ? Math.min(12.5, (B - 96) / (2 * maks)) : 12.5, s = af * 0.84;
        function boks(antal, x, kryds) {
          var pr = Math.min(antal, 5), b = pr * af + 8, raek = Math.ceil(antal / pr);
          var r = T.rekt(x, cy - 15, b, 30, 4, { w: 0.5, kant: T.GRAA, fyld: '#fff' }) + gitter(st.ting, antal, x + b / 2, cy, s, af, pr);
          if (kryds) {
            for (var i = antal - kryds; i < antal; i++) {
              var rr = Math.floor(i / pr), iR = Math.min(pr, antal - rr * pr), c = i - rr * pr;
              var px = x + b / 2 + (c - (iR - 1) / 2) * af, py = cy + (rr - (raek - 1) / 2) * af;
              r += T.linje(px - 5, py - 5, px + 5, py + 5, { w: 0.7 }) + T.linje(px + 5, py - 5, px - 5, py + 5, { w: 0.7 });
            }
          }
          return { svg: r, b: b };
        }
        var x = 2, ba, bb;
        if (st.op === '+') {
          ba = boks(st.a, x, 0); ud += ba.svg + tal(st.a, x + ba.b / 2, y + 43, 8); x += ba.b + 5;
          ud += tegnTegn('+', x + 5, cy, 8); x += 15;
          bb = boks(st.b, x, 0); ud += bb.svg + tal(st.b, x + bb.b / 2, y + 43, 8); x += bb.b + 5;
          ud += tegnTegn('=', x + 5, cy, 8); x += 13;
          ud += svarboks(Math.min(B - 31, Math.max(x, 140)), cy - 14, 30, 28, st.facit, false);
        } else {
          ba = boks(st.a, x, st.b); ud += ba.svg; x += ba.b + 10;
          var ex = Math.max(x, 96), base = cy + 5;
          ud += tal(st.a, ex + 4, base, 10) + tegnTegn('-', ex + 16, cy, 7) + tal(st.b, ex + 28, base, 10) + tegnTegn('=', ex + 40, cy, 7);
          ud += svarboks(ex + 50, cy - 14, 30, 28, st.facit, false);
        }
        y += rh;
      });
      return { h: y, svg: ud };
    },

    farvSaa: function (o) {
      var ud = '', y = 0;
      o.raekker.forEach(function (r) {
        var rh = 26, cy = y + rh / 2, af = Math.min(19, (B - 34) / r.vist);
        ud += T.cirkel(11, cy, 10, { w: 0.6, fyld: '#fff' }) + tal(r.antal, 11, cy + 5.5, 11);
        for (var i = 0; i < r.vist; i++) ud += T.TING[o.ting](34 + i * af, cy, Math.min(17, af - 2));
        y += rh;
      });
      return { h: y, svg: ud };
    },

    flest: function (o) {
      var ud = '', y = 0;
      o.runder.forEach(function (r) {
        var rh = 38;
        ud += kort(2, y + 2, 84, rh - 4) + kort(96, y + 2, 84, rh - 4);
        ud += bunke(r.venstre, 44, y + rh - 6, 19) + bunke(r.hoejre, 138, y + rh - 6, 19);
        y += rh;
      });
      return { h: y, svg: ud };
    },

    ligeMange: function (o) {
      return { h: 40, svg: kort(2, 2, 78, 36) + bunke(o.antal, 41, 33, 19) + tegnTegn('=', 91, 20, 9) + T.rekt(102, 2, 78, 36, 4, { w: 0.5, kant: T.GRAA, stiplet: '1.5 1.5' }) };
    },

    tierramme: function (o) {
      var ud = '', y = 0;
      o.raekker.forEach(function (r) {
        var rh = 34, cy = y + rh / 2;
        ud += kort(2, y + 2, 72, rh - 4) + gitter(o.ting, r.antal, 38, cy, 9.5, 12, 5);
        ud += T.pil(84, cy, 1, 0, 2.2) + T.linje(78, cy, 84, cy, { w: 0.5 });
        ud += T.tierramme(98, cy - 13, 13);
        y += rh;
      });
      return { h: y, svg: ud };
    },

    talraekke: function (o) {
      var ud = T.sti('M0 46 C 40 38 60 50 100 44 S 160 40 182 46', { w: 0.5, kant: T.GRAA }), af = 18;
      o.raekke.forEach(function (t, i) {
        var cx = 10 + i * af;
        ud += T.TING.gran(cx, 15, 18) + T.rekt(cx - 7.5, 26, 15, 14, 2.5, { w: 0.55, fyld: '#fff' });
        if (t !== null) ud += tal(t, cx, 37, 8.5);
      });
      return { h: 50, svg: ud };
    },

    prikTilPrik: function (o) {
      var ud = '', k = 1.25, dx = 14, dy = 6;
      ud += T.sti('M' + n(dx + 6) + ' ' + n(dy + 70 * k) + ' Q ' + n(dx + 80 * k) + ' ' + n(dy + 64 * k) + ' ' + n(dx + 130 * k) + ' ' + n(dy + 70 * k), { w: 0.4, kant: T.LYS });
      o.punkter.forEach(function (p, i) {
        var x = dx + p[0] * k, y = dy + p[1] * k;
        ud += T.TING.stjerne(x, y, 8) + T.cirkel(x, y, 0.9, { fyld: T.BLAEK, kant: 'none' });
        ud += tal(i + 1, x + (i < 4 ? -7 : 7), y - 3, 6);
      });
      return { h: 92, svg: ud };
    },

    urTegn: function (o) {
      return { h: 88, svg: T.ur(62, 44, 42, { stor: true }) + T.rekt(132, 18, 40, 46, 4, { w: 0.6, fyld: '#fff' }) + tal(o.time, 152, 52, 26) };
    },

    urRing: function (o) {
      var ud = '';
      o.ure.forEach(function (t, i) { ud += T.ur(31 + i * 60, 22, 20, { stor: true, time: t }); });
      return { h: 46, svg: ud };
    },

    sporBogstav: function (o) {
      var H = 50, base = 62, ud = T.skrivelinjer(0, B, base, H, false);
      ud += T.skrift(o.bogstav, { x: 52, base: base, h: H, stil: 'spor', anker: 'midte', vej: true, numre: true }).svg;
      ud += T.skrift(o.bogstav.toLowerCase(), { x: 130, base: base, h: H, stil: 'spor', anker: 'midte', vej: true, numre: true }).svg;
      return { h: 78, svg: ud };
    },

    skriveLinjer: function (o) {
      var ud = '', y = 0, H = 16, rh = 29;
      o.raekker.forEach(function (r) {
        var base = y + 4 + H, ch = r.lille ? o.bogstav.toLowerCase() : o.bogstav, plads = r.prikket + r.tomme, af = B / plads;
        ud += T.skrivelinjer(0, B, base, H, true);
        for (var i = 0; i < r.prikket; i++) {
          ud += T.skrift(ch, { x: af * (i + 0.5), base: base, h: H, stil: i === 0 ? 'spor' : 'prik', anker: 'midte', pile: i === 0 }).svg;
        }
        y += rh;
      });
      if (o.ord) {
        var base2 = y + 4 + H;
        ud += T.skrivelinjer(30, B - 30, base2, H, true) + kort(0, y, 25, 25) + ord(o.ord, 12.5, y + 12.5, 22);
        ud += T.skrift(o.ord, { x: 36, base: base2, h: H, stil: 'spor', pile: 'foerste' }).svg;
        y += rh + 2;
      }
      return { h: y, svg: ud };
    },

    forlydRing: function (o) {
      var k = o.billeder.length, kol = k <= 8 ? 4 : 5, raek = Math.ceil(k / kol), cb = B / kol, ch = Math.min(cb, 40), ud = '';
      o.billeder.forEach(function (b, i) {
        var r = Math.floor(i / kol), iR = Math.min(kol, k - r * kol), c = i - r * kol;
        var cx = B / 2 + (c - (iR - 1) / 2) * cb, cy = r * ch + ch / 2, s = Math.min(cb, ch) - 6;
        ud += kort(cx - s / 2, cy - s / 2, s, s) + ord(b, cx, cy, s - 5);
      });
      return { h: raek * ch, svg: ud };
    },

    skjult: function (o) {
      var g = A.MOTIVER[o.motiv], c = 11, x0 = (B - g[0].length * c) / 2, ud = '';
      saa(o.bogstav.charCodeAt(0) * 7919 + 17);
      g.forEach(function (raekke, r) {
        Array.from(raekke).forEach(function (ch, k) {
          var x = x0 + k * c, y = r * c, b;
          if (ch === '#') b = tilfaeldig() < 0.5 ? o.bogstav : o.bogstav.toLowerCase();
          else b = o.andre[Math.floor(tilfaeldig() * o.andre.length)];
          ud += T.rekt(x, y, c, c, 0, { w: 0.35, kant: T.GRAA, fyld: '#fff' });
          ud += T.skrift(b, { x: x + c / 2, base: y + c * 0.78, h: c * 0.58, anker: 'midte', tyk: 0.55 }).svg;
        });
      });
      ud += T.rekt(x0, 0, g[0].length * c, g.length * c, 0, { w: 0.6 });
      return { h: g.length * c + 1, svg: ud };
    },

    forbindBogstav: function (o) {
      var k = o.par.length, cb = B / k, ud = '';
      o.par.forEach(function (p, i) {
        var cx = cb * (i + 0.5);
        ud += kort(cx - 13, 2, 26, 26) + ord(p[0], cx, 15, 23) + prik(cx, 33);
      });
      o.bogstaver.forEach(function (b, i) {
        var cx = cb * (i + 0.5);
        ud += prik(cx, 54) + T.rekt(cx - 10, 59, 20, 21, 3, { w: 0.6, fyld: '#fff' }) + tal(b, cx, 75, 12);
      });
      return { h: 82, svg: ud };
    },

    rimForbind: function (o) {
      var k = o.venstre.length, rh = k >= 5 ? 23 : 29, s = rh - 3, ud = '';
      o.venstre.forEach(function (v, i) {
        var cy = i * rh + rh / 2;
        ud += kort(28 - s / 2, cy - s / 2, s, s) + ord(v, 28, cy, s - 4) + prik(28 + s / 2 + 6, cy);
        ud += kort(154 - s / 2, cy - s / 2, s, s) + ord(o.hoejre[i], 154, cy, s - 4) + prik(154 - s / 2 - 6, cy);
      });
      return { h: k * rh, svg: ud };
    },

    rimRing: function (o) {
      var ud = '', rh = 34;
      o.raekker.forEach(function (r, i) {
        var cy = i * rh + rh / 2;
        ud += T.rekt(4, cy - 15, 30, 30, 4, { w: 0.9, fyld: '#fff' }) + ord(r.ord, 19, cy, 26);
        ud += T.linje(42, cy, 54, cy, { w: 0.5 }) + T.pil(56, cy, 1, 0, 2);
        r.kort.forEach(function (w, j) { var cx = 82 + j * 42; ud += kort(cx - 15, cy - 15, 30, 30) + ord(w, cx, cy, 26); });
      });
      return { h: o.raekker.length * rh, svg: ud };
    },

    rimKryds: function (o) {
      var ud = '', rh = o.raekker.length >= 3 ? 29 : 33, s = rh - 3;
      o.raekker.forEach(function (r, i) {
        var cy = i * rh + rh / 2, k = r.kort.length, af = k === 3 ? 50 : 42;
        r.kort.forEach(function (w, j) { var cx = B / 2 + (j - (k - 1) / 2) * af; ud += kort(cx - s / 2, cy - s / 2, s, s) + ord(w, cx, cy, s - 4); });
      });
      return { h: o.raekker.length * rh, svg: ud };
    },

    klapStreg: function (o) {
      var ud = '', rh = o.ord.length >= 5 ? 23 : (o.maade === 'prik' ? 23 : 27);
      o.ord.forEach(function (w, i) {
        var cy = i * rh + rh / 2, s = rh - 4;
        ud += kort(4, cy - s / 2, s, s) + ord(w, 4 + s / 2, cy, s - 3);
        ud += T.gruppe(T.IKON.klap(), 'translate(' + n(s + 10) + ' ' + n(cy - 4) + ') scale(0.8)');
        if (o.maade === 'prik') { for (var k = 0; k < 4; k++) ud += T.cirkel(62 + k * 18, cy, 6, { w: 0.6, fyld: '#fff' }); }
        else ud += T.rekt(44, cy - s / 2 + 2, 134, s - 4, 3, { w: 0.4, kant: T.GRAA, stiplet: '1.4 1.4' });
      });
      return { h: o.ord.length * rh, svg: ud };
    },

    langstOrd: function (o) {
      var ud = '', rh = 34;
      o.raekker.forEach(function (r, i) {
        var cy = i * rh + rh / 2;
        r.kort.forEach(function (w, j) { var cx = B / 2 + (j - 1) * 52; ud += kort(cx - 15, cy - 15, 30, 30) + ord(w, cx, cy, 26); });
      });
      return { h: o.raekker.length * rh, svg: ud };
    },

    sorter: function (o) {
      var ud = '', k = o.kolonner.length;
      if (o.maade === 'klip') {
        var bb = (B - (k - 1) * 6) / k;
        o.kolonner.forEach(function (antal, i) {
          var x = i * (bb + 6);
          ud += T.rekt(x, 2, bb, 54, 4, { w: 0.6, fyld: '#fff' }) + T.tromme(x + bb / 2, 15, 14, antal) + T.linje(x + 4, 24, x + bb - 4, 24, { w: 0.3, kant: T.LYS });
        });
        var cb = 28, y = 64;
        ud += T.linje(0, y - 3, B, y - 3, { w: 0.35, kant: T.GRAA, stiplet: '2 1.5' }) + T.gruppe(T.IKON.saks(), 'translate(0 ' + (y - 9) + ') scale(0.6) rotate(-90 5 5)');
        o.ord.forEach(function (w, i) {
          var x = B / 2 + (i - (o.ord.length - 1) / 2) * cb;
          ud += T.rekt(x - cb / 2, y, cb, cb, 0, { w: 0.4, kant: T.BLAEK, stiplet: '2 1.5', fyld: '#fff' }) + ord(w, x, y + cb / 2, cb - 6);
        });
        return { h: y + cb + 2, svg: ud };
      }
      var cbb = B / o.ord.length;
      o.ord.forEach(function (w, i) { var cx = cbb * (i + 0.5); ud += kort(cx - 13, 2, 26, 26) + ord(w, cx, 15, 23) + prik(cx, 33); });
      o.kolonner.forEach(function (antal, i) { var cx = B / 2 + (i - (k - 1) / 2) * 60; ud += prik(cx, 50) + T.tromme(cx, 70, 20, antal); });
      return { h: 84, svg: ud };
    },

    guirlande: function (o) {
      var ud = '', rh = 40;
      o.raekker.forEach(function (r, i) {
        var y = i * rh, alle = r.vist + r.tomme, kurve = function (t) { return y + 6 + 9 * 4 * t * (1 - t); };
        ud += T.sti('M2 ' + n(y + 4) + ' ' + Array.from({ length: 41 }, function (_, q) { var t = q / 40; return 'L' + n(2 + t * (B - 4)) + ' ' + n(kurve(t)); }).join(' '), { w: 0.6 });
        for (var j = 0; j < alle; j++) {
          var t = (j + 0.5) / alle, cx = 2 + t * (B - 4), cy = kurve(t) + 9;
          ud += T.linje(cx, kurve(t), cx, cy - 6, { w: 0.4 });
          if (j < r.vist) ud += T.TING[r.ting[A.moensterIndeks(r.moenster, j)]](cx, cy, 12);
          else ud += T.cirkel(cx, cy, 6.5, { w: 0.45, kant: T.GRAA, stiplet: '1.3 1.3' });
        }
      });
      return { h: o.raekker.length * rh, svg: ud };
    },

    egenGuirlande: function (o) {
      return OPG.guirlande({ raekker: [{ moenster: 'A', ting: ['kugle'], vist: 0, tomme: o.tomme || 10 }] });
    },

    tegnSelv: function () {
      var ud = T.rekt(0, 0, B, 204, 5, { w: 0.6, fyld: '#fff' });
      ud += T.sti('M4 176 Q 50 168 91 172 T 178 174', { w: 0.45, kant: T.GRAA });
      ud += T.trae(91, 12, 150, { kugler: KUGLEPLADS.slice(0, 7), bredde: 0.82 });
      var F = A.FIGURER, pladser = [['sanne', 160, 26, 30], ['egon', 22, 56, 32], ['kaja', 160, 76, 34], ['rikke', 22, 112, 36], ['pelle', 26, 160, 40], ['gustav', 72, 178, 32], ['bodil', 112, 180, 28]];
      pladser.forEach(function (p) { ud += L.billede(F[p[0]], p[1], p[2], p[3], p[3]); });
      ud += T.rekt(140, 122, 34, 60, 13, { w: 0.6, kant: T.GRAA, stiplet: '2 1.6' }) + T.gruppe(T.IKON.blyant(), 'translate(152 146) scale(1)');
      return { h: 206, svg: ud };
    },

    invitation: function () {
      // Hele kortet: A4-arket foldes to gange. Oeverste halvdel staar paa hovedet (forside og bagside), nederste er indersiden.
      var b = B, h = 212, hb = b / 2, hh = h / 2, ud = '';
      ud += T.rekt(0, 0, b, h, 3, { w: 0.5, stiplet: '2.2 1.6', fyld: '#fff' });
      ud += T.linje(0, hh, b, hh, { w: 0.35, kant: T.GRAA, stiplet: '5 2 1 2' }) + T.linje(hb, 0, hb, h, { w: 0.35, kant: T.GRAA, stiplet: '5 2 1 2' });
      ud += T.gruppe(T.IKON.saks(), 'translate(-4.5 6) scale(0.7) rotate(90 5 5)');
      // Forsiden (oeverst til venstre) og bagsiden (oeverst til hoejre), drejet en halv omgang
      // Forsiden er oeverst til venstre og bagsiden oeverst til hoejre, hver drejet en halv omgang om sin egen midte
      var forside = T.skrift('Kom', { x: hb / 2, base: 16, h: 8, anker: 'midte' }).svg + T.trae(hb / 2, 22, 58, { kugler: KUGLEPLADS.slice(0, 5) }) +
        T.pelle(hb / 2 - 25, 86, 24) + T.sanne(hb / 2 + 26, 84, 22, true) + T.TING.gave(hb / 2, 92, 12);
      var bagside = T.TING.brik(hb + hb / 2, hh / 2 - 4, 24) + T.cirkel(hb + hb / 2, hh / 2 - 4, 22, { w: 0.4, kant: T.LYS }) +
        T.tekst(hb + hb / 2, hh - 10, 'Pelles julekalender', { str: 3, anker: 'middle', farve: T.GRAA });
      ud += T.gruppe(forside, 'rotate(180 ' + n(hb / 2) + ' ' + n(hh / 2) + ')') + T.gruppe(bagside, 'rotate(180 ' + n(hb * 1.5) + ' ' + n(hh / 2) + ')');
      // Indersiden: til venstre "Til" (tegn din ven), til hoejre "Fra" (tegn dig selv)
      [['Til', 0], ['Fra', hb]].forEach(function (s) {
        var x = s[1];
        ud += T.rekt(x + 8, hh + 8, hb - 16, 66, 4, { w: 0.45, kant: T.GRAA, stiplet: '1.5 1.5' }) + T.gruppe(T.IKON.blyant(), 'translate(' + n(x + 12) + ' ' + n(hh + 14) + ') scale(0.8)');
        ud += T.skrift(s[0], { x: x + 10, base: hh + 88, h: 7 }).svg + T.linje(x + 28, hh + 88, x + hb - 8, hh + 88, { w: 0.4 });
      });
      ud += T.TING.hjerte(hb + hb / 2, hh + 98, 8) + T.TING.stjerne(hb / 2, hh + 98, 8);
      return { h: h + 2, svg: ud };
    },

    samtale: function (o, ark) {
      var ud = '', k = o.ansigter.length, af = B / k;
      o.ansigter.forEach(function (a, i) { ud += T.ansigt(af * (i + 0.5), 22, 38, a); });
      var html = '<div class="spoergsmaal"><b>Spørgsmål til samtalen</b><ol>' + (ark.spoergsmaal || []).map(function (s) { return '<li>' + T.esc(s) + '</li>'; }).join('') + '</ol></div>';
      return { h: 46, svg: ud, html: html };
    },

    tegnRamme: function () {
      return { h: 100, svg: T.rekt(0, 1, B, 98, 5, { w: 0.6, fyld: '#fff' }) + T.nis(B - 16, 80, 26) + T.pelle(18, 84, 24) };
    },

    puslespilMotiv: function () {
      var bb = B, hh = B * 3 / 4, ud = motiv(bb, hh) + gitterPuslespil(bb, hh, true);
      // Nis, som boernene kan tegne efter, og en pil op til hans tomme plads i hjoernet
      ud += T.nis(B - 46, hh + 30, 46) + T.sti('M' + n(B - 22) + ' ' + n(hh + 20) + ' Q ' + n(B - 8) + ' ' + n(hh + 14) + ' ' + n(B - 10) + ' ' + n(hh - 4), { w: 0.5 }) + T.pil(B - 10, hh - 5, 0, -1, 2.2);
      ud += T.gruppe(T.IKON.saks(), 'translate(4 ' + n(hh + 10) + ') scale(1.4)');
      ud += T.linje(22, hh + 17, 60, hh + 17, { w: 1.1 }) + T.tekst(64, hh + 18.4, '12 brikker', { str: 3.6 });
      ud += T.linje(22, hh + 29, 60, hh + 29, { w: 0.45, stiplet: '2 1.4' }) + T.linje(22, hh + 32, 60, hh + 32, { w: 1.1 }) + T.tekst(64, hh + 32, '24 brikker', { str: 3.6 });
      return { h: hh + 58, svg: ud };
    },

    kalenderArk: function () {
      var bb = B, hh = B * 3 / 4, ud = T.rekt(0, 0, bb, hh, 0, { fyld: '#fff', w: 0.9 }) + gitterPuslespil(bb, hh, false), cb = bb / 6, ch = hh / 4;
      P.BRIKKER.forEach(function (br) { ud += tal(br.dag, (br.kol + 0.5) * cb, (br.raek + 0.5) * ch + 4, 8, { farve: T.GRAA, tyk: 0.6 }); });
      ud += T.pelle(34, hh + 40, 48) + T.sanne(B - 32, hh + 38, 46, true) + T.trae(B / 2, hh + 8, 64, { kugler: KUGLEPLADS.slice(0, 6) });
      return { h: hh + 74, svg: ud };
    }
  };

  /** Puslespillets motiv: det malede motiv fra appen (jul/billeder/puslespil.jpg) som tegning til at
      farvelaegge (puslespil-streg.png, lavet med Gemini ud fra det malede billede), saa boernene farver det
      samme billede, de samler paa iPad'en. Mangler tegningen, tegnes vennerne om juletraeet i kode. */
  function motiv(bb, hh) {
    if (MOTIV_STREG) return T.rekt(0, 0, bb, hh, 0, { fyld: '#fff', w: 0.9 }) + '<image href="puslespil-streg.png" x="0" y="0" width="' + n(bb) + '" height="' + n(hh) + '" preserveAspectRatio="xMidYMid slice"/>' + T.cirkel(bb * 0.94, hh * 0.88, 9, { w: 0.6, kant: T.GRAA, stiplet: '1.4 1.4', fyld: '#fff' });
    var F = A.FIGURER, ud = T.rekt(0, 0, bb, hh, 0, { fyld: '#fff', w: 0.9 });
    ud += T.sti('M0 ' + n(hh * 0.8) + ' Q ' + n(bb * 0.3) + ' ' + n(hh * 0.74) + ' ' + n(bb * 0.5) + ' ' + n(hh * 0.78) + ' T ' + n(bb) + ' ' + n(hh * 0.76), { w: 0.4, kant: T.GRAA });
    for (var i = 0; i < 9; i++) ud += T.TING.stjerne(8 + i * 21 + (i % 2) * 6, 7 + (i % 3) * 4, 4.5);
    ud += T.trae(bb / 2, 8, hh * 0.76, { kugler: KUGLEPLADS.slice(0, 8), bredde: 0.62 });
    var bag = [['milo', 0.08, 0.36, 26], ['ulla', 0.2, 0.3, 22], ['rasmus', 0.31, 0.4, 24], ['bo', 0.69, 0.38, 28], ['kaja', 0.8, 0.3, 24], ['rikke', 0.92, 0.38, 26]];
    var for_ = [['emil', 0.07, 0.72, 32], ['ella', 0.19, 0.74, 32], ['egon', 0.3, 0.77, 26], ['klaus', 0.38, 0.88, 14], ['pelle', 0.45, 0.84, 26], ['sanne', 0.56, 0.84, 24], ['klara', 0.63, 0.88, 14], ['gustav', 0.71, 0.76, 28], ['bodil', 0.82, 0.75, 26]];
    bag.concat(for_).forEach(function (p) { ud += L.billede(F[p[0]], bb * p[1], hh * p[2], p[3], p[3]); });
    ud += T.cirkel(bb * 0.94, hh * 0.86, 9, { w: 0.5, kant: T.GRAA, stiplet: '1.4 1.4' });
    return ud;
  }

  /** Puslespillets 24 brikker (som i appen, jul/js/puslespil.js). tyndt: de streger, der kun deler 12 til 24, tegnes stiplet. */
  function gitterPuslespil(bb, hh, tyndt) {
    var cb = bb / P.KOL, ch = hh / P.RAEK, ud = '';
    P.BRIKKER.forEach(function (br) {
      var cmd = P.sti(br, cb, ch), x0 = br.kol * cb, y0 = br.raek * ch, i = 1;
      var kanter = ['op', 'hoejre', 'ned', 'venstre'], cur = [cmd[0][1], cmd[0][2]];
      kanter.forEach(function (navn) {
        var d = 'M' + n(x0 + cur[0]) + ' ' + n(y0 + cur[1]), m = br.kanter[navn] ? 6 : 1;
        for (var j = 0; j < m; j++, i++) {
          var c = cmd[i];
          if (c[0] === 'L') { d += ' L ' + n(x0 + c[1]) + ' ' + n(y0 + c[2]); cur = [c[1], c[2]]; }
          else { d += ' C ' + [1, 2, 3, 4, 5, 6].map(function (q) { return n((q % 2 ? x0 : y0) + c[q]); }).join(' '); cur = [c[5], c[6]]; }
        }
        // Hver indre kant tegnes kun én gang: brikkens hoejre og nederste kant
        if (navn === 'hoejre' && br.kol < P.KOL - 1) {
          var tynd = tyndt && br.kol % 2 === 0;
          ud += T.sti(d, { w: tynd ? 0.45 : (tyndt ? 1.1 : 0.6), stiplet: tynd ? '2 1.4' : null });
        }
        if (navn === 'ned' && br.raek < P.RAEK - 1) ud += T.sti(d, { w: tyndt ? 1.1 : 0.6 });
      });
    });
    return ud + T.rekt(0, 0, bb, hh, 0, { w: tyndt ? 1.1 : 0.9 });
  }

  /* ---------- siderne ---------- */

  var EMNE_NAVN = {}; A.UGER.forEach(function (u) { EMNE_NAVN[u.emne] = u.navn; });

  function side(klasse) { var s = el('section', 'side ' + (klasse || '')); document.getElementById('sider').appendChild(s); return s; }

  function hoved(s, d) {
    var h = el('header', 'arkhoved');
    var titelB = T.maal(d.titel, 7.2);
    h.innerHTML = T.svg(26 + titelB + 2, 22, T.laage(0.5, 0.5, 19, 21, d.dag) + T.skrift(d.titel, { x: 26, base: 13, h: 7.2 }).svg, 'titel') +
      '<div class="sted">' + T.esc(d.sted) + ' · ' + T.esc(EMNE_NAVN[d.emne]) + '</div>' +
      '<div class="navn"><span>Navn</span><i></i></div>';
    s.appendChild(h);
  }

  /** Det lille ekstra-ikon ved flest/faerrest: en stor eller lille bunke. */
  function ekstraIkon(o) {
    if (o.type !== 'flest') return '';
    var flest = o.hvad === 'flest';
    return T.svg(16, 11, T.rekt(0.3, 0.3, 15.4, 10.4, 2, { fyld: '#fff', w: 0.5 }) + (flest ? bunke(6, 8, 9.4, 4.2) : bunke(1, 8, 9.4, 6)), 'ekstra');
  }

  function bygArk(d, ark, nr) {
    var s = side('ark');
    s.dataset.navn = 'Dag ' + d.dag + (d.ark.length > 1 ? ' (' + (nr + 1) + ')' : '');
    hoved(s, d);
    var ind = el('div', 'indhold');
    ark.opgaver.forEach(function (o) {
      var r = OPG[o.type](o, ark, d), boks = el('div', 'opgave');
      boks.innerHTML = '<div class="ophoved">' + T.svg(11, 11, T.ikon(o.ikon, 0.3, 0.3, 10.4)) + ekstraIkon(o) + '<p>' + T.esc(o.tekst) + '</p></div>' +
        T.svg(B, r.h, r.svg, 'tegning') + (r.html || '');
      ind.appendChild(boks);
    });
    s.appendChild(ind);
    s.appendChild(el('footer', 'laerer', '<b>Til læreren</b> ' + T.esc(ark.laerer)));
  }

  /* ---------- forsiden, oversigten og facit ---------- */

  function forside() {
    var s = side('forside');
    var titel = T.skrift('Pelles julekalender', { x: B / 2, base: 22, h: 14, anker: 'midte' }).svg;
    var pynt = T.pelle(26, 40, 40) + T.sanne(B - 26, 34, 36, true) + T.TING.stjerne(B / 2 - 70, 8, 6) + T.TING.stjerne(B / 2 + 72, 10, 5);
    s.innerHTML = T.svg(B, 46, titel + pynt, 'forsidetitel') +
      '<p class="undertitel">– opgaveark til 0. klasse –</p>' +
      '<div class="spalter">' +
      '<div><h3>Historien</h3><p>Pelle Pindsvin har lavet et julepuslespil af træ med 24 brikker og malet alle vennerne om juletræet på det. Men vinterstormen blæser brikkerne ud over hele den lille verden. Hver dag i december besøger Pelle og Skaden Sanne et nyt sted, møder en ven og finder én brik. Undervejs går en lille hjælper rundt i det skjulte – og juleaften er puslespillet helt, og alle er med.</p>' +
      '<p>Historien læses op i appen (Pelles julekalender på forsiden af SFO-appen). Arkene her bygger videre på det, dagens historie øvede, og bruges gerne lige bagefter.</p></div>' +
      '<div><h3>Ugernes emner</h3><ul class="uger">' + A.UGER.map(function (u) {
        return '<li><b>' + u.fra + '.–' + u.til + '. december</b> ' + T.esc(u.navn) + '<br><span>' + T.esc(UGEBESKRIVELSE[u.emne]) + '</span></li>';
      }).join('') + '</ul></div>' +
      '</div>' +
      '<h3>Sådan bruger I arkene</h3><ul class="brug">' + BRUG.map(function (b) { return '<li>' + b + '</li>'; }).join('') + '</ul>' +
      '<h3>Piktogrammerne</h3><div class="ikoner">' + IKONFORKLARING.map(function (i) {
        return '<div>' + T.svg(10, 10, T.ikon(i[0], 0.3, 0.3, 9.4)) + '<span>' + i[1] + '</span></div>';
      }).join('') + '</div>' +
      '<p class="lille">Bogstaver og tal er skrevet med de samme streger som i Bogstavvejen i appen: dansk grundskrift med startprik og pile i skriveretningen. Billederne er appens egne malede billeder, lavet om til stregtegninger, så de kan farvelægges. Arkene er sort-hvide og kan printes på en almindelig printer.</p>';
  }
  var UGEBESKRIVELSE = {
    tal: 'Tælle og skrive tal, terningmønstre, flest og færrest, tierrammer, plus og minus med billeder, talrækken og klokken syv.',
    bogstaver: 'Dagens bogstav stort og lille i grundskrift: S, J, N, K, G, E og P. Skrivelinjer, lyden først i ordet og skjulte billeder.',
    rim: 'Forbind det, der rimer, find det, der ikke rimer, klap stavelser og sortér efter antal klap.',
    faellesskab: 'Mønstre på guirlanden, en invitation til en ven, et samtaleark, tegn dig selv til festen og Pelles puslespil.'
  };
  var BRUG = [
    'Læs eller hør dagens historie først. Arkene bruger dagens figurer, ord og tal.',
    'Gennemgå arket mundtligt sammen: peg på piktogrammet, og sig, hvad man gør. Linjen nederst på hvert ark siger, hvad opgaven øver, og giver et forslag til, hvad I kan sige.',
    'Børnene skal ikke kunne læse. Den lille tekst ved hver opgave er til den voksne.',
    'Sig ordene højt sammen ved alle billedopgaver – ved lyde, rim og klap er det det, der hører, ikke det, der står.',
    'Der er ingen point og ingen tid. Et forkert svar er bare et nyt forsøg. Facit står bagerst.',
    'Kalender-arket (dag 24) kan deles ud den 1. december, så børnene farver en brik hver dag. Dag 22 og 24 skal klippes.'
  ];
  var IKONFORKLARING = [['blyant', 'skriv eller tegn'], ['farve', 'farvelæg'], ['ring', 'sæt ring om'], ['forbind', 'tegn en streg mellem'], ['kryds', 'sæt kryds'], ['klap', 'klap ordet'], ['saks', 'klip ud'], ['tale', 'vi taler sammen']];

  function oversigt() {
    var s = side('oversigt');
    var raekker = A.DAGE.map(function (d) {
      return '<tr class="' + d.emne + '"><td class="nr">' + T.svg(8, 8.6, T.laage(0.3, 0.3, 7.4, 8, d.dag)) + '</td><td><b>' + T.esc(d.titel) + '</b><br><span>' + T.esc(d.sted) + '</span></td>' +
        '<td>' + T.esc(EMNE_NAVN[d.emne]) + (d.bogstav ? ': ' + d.bogstav : '') + '</td><td>' + d.ark.map(function (a) { return T.esc(a.navn); }).join(' · ') + '</td></tr>';
    }).join('');
    s.innerHTML = '<h2>Oversigt over dagene</h2><table class="dage"><thead><tr><th>Dag</th><th>Historien</th><th>Emne</th><th>Ark</th></tr></thead><tbody>' + raekker + '</tbody></table>';
  }

  /** Facit som tekst til hver opgave, eller null, hvis der intet facit er. */
  function facitTekst(o) {
    switch (o.type) {
      case 'taelTrae': return o.facit + ' kugler';
      case 'taelSkriv': return o.raekker.map(function (r) { return r.facit + (r.mangler ? ' (én mangler)' : ''); }).join(' · ');
      case 'forbindTal': return o.maengder.map(function (m, i) { return (m.moenster === 'raekke' ? 'rækken' : 'terningen') + ' → ' + o.facit[i]; }).join(' · ');
      case 'tegnSaa': return o.felter.map(function (f) { return f.facit; }).join(' og ') + ' tegnet';
      case 'regne': return o.stykker.map(function (st) { return st.a + ' ' + (st.op === '+' ? '+' : '−') + ' ' + st.b + ' = ' + st.facit; }).join(' · ');
      case 'farvSaa': return o.raekker.map(function (r) { return r.facit + ' af ' + r.vist; }).join(' · ') + ' farvet';
      case 'flest': return (o.hvad === 'flest' ? 'Flest: ' : 'Færrest: ') + o.runder.map(function (r) { return (r.facit === 'venstre' ? 'venstre (' + r.venstre : 'højre (' + r.hoejre) + ')'; }).join(' · ');
      case 'ligeMange': return o.facit + ' stammer';
      case 'tierramme': return o.raekker.map(function (r) { return r.facit; }).join(' · ') + ' felter';
      case 'talraekke': return 'mangler ' + o.facit.join(', ');
      case 'prikTilPrik': return o.facit;
      case 'urTegn': return 'den lille viser på ' + o.facit;
      case 'urRing': return 'uret nr. ' + (o.facit + 1) + ' (klokken ' + o.ure[o.facit] + ')';
      case 'forlydRing': return o.facit.join(', ');
      case 'skjult': return o.facit;
      case 'forbindBogstav': return o.par.map(function (p) { return p[0] + ' – ' + p[1]; }).join(' · ');
      case 'rimForbind': return o.facit.map(function (p) { return p[0] + ' – ' + p[1]; }).join(' · ');
      case 'rimRing': return o.raekker.map(function (r) { return r.ord + ': ' + r.facit; }).join(' · ');
      case 'rimKryds': return 'kryds ved ' + o.raekker.map(function (r) { return r.facit; }).join(', ');
      case 'klapStreg': return o.ord.map(function (w, i) { return w + ' ' + o.facit[i]; }).join(' · ');
      case 'langstOrd': return o.raekker.map(function (r) { return r.facit; }).join(', ');
      case 'sorter': return o.kolonner.map(function (k) { return k + ' klap: ' + o.facit[k].join(', '); }).join(' · ');
      case 'guirlande': return o.raekker.map(function (r) { return r.moenster.split('').join('') + ': ' + r.facit.join(', '); }).join(' · ');
      default: return null;
    }
  }

  function facit() {
    var s = side('facit'), html = '<h2>Facit</h2><div class="facitliste">';
    A.DAGE.forEach(function (d) {
      var linjer = [];
      d.ark.forEach(function (a) { a.opgaver.forEach(function (o) { var t = facitTekst(o); if (t) linjer.push(T.esc(t)); }); });
      html += '<div class="facitdag"><b>' + d.dag + '. ' + T.esc(d.titel) + '</b>' + (linjer.length ? '<ul>' + linjer.map(function (l) { return '<li>' + l + '</li>'; }).join('') + '</ul>' : '<p>Ingen facit – her er alle svar gode.</p>') + '</div>';
    });
    s.innerHTML = html + '</div>';
  }

  /* ---------- byg det hele ---------- */

  function byg() {
    forside();
    oversigt();
    A.alleArk().forEach(function (x) { bygArk(x.dag, x.ark, x.nr); });
    facit();
    // Tjek, at intet loeber ud over siden
    var over = [];
    Array.prototype.forEach.call(document.querySelectorAll('.side'), function (s, i) {
      var ind = s.querySelector('.indhold'), m = ind ? ind.scrollHeight - ind.clientHeight : s.scrollHeight - s.clientHeight;
      if (m > 1) over.push((s.dataset.navn || 'side ' + (i + 1)) + ': ' + m + ' px for meget');
    });
    window.OVERLOEB = over;
    window.SIDER = document.querySelectorAll('.side').length;
    if (over.length) console.log('For meget paa: ' + over.join('; '));
    window.KLAR = true;
  }

  Promise.all(A.billeder().map(function (b) { return L.hent(b); })).then(byg, function (e) { console.log('FEJL ' + e.message); window.FEJL = e.message; byg(); });
})();
