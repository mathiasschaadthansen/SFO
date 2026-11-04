/**
 * Pelles julekalender — opgaveark: tegnekoden.
 *
 * Alt tegnes som SVG-tekst i millimeter (A4 er 210 x 297), sort-hvide
 * stregtegninger uden store farveflader, saa arkene er billige at printe og
 * boernene kan farvelaegge dem.
 *
 *   skrift()   bogstaver og tal med Bogstavvejens streger (glyffer.js): fuld
 *              streg, prikket, eller prikket med startprik og pile i
 *              skriveretningen. Det er grundskriften fra appen.
 *   TING       ting, der taelles og tegnes: kugle, kage, noed, snebold, stamme,
 *              gran, stjerne, gave, hjerte, brik
 *   trae, pelle, sanne, nis, ur, terning, tierramme, tromme, ansigt
 *   IKON       piktogrammerne: blyant, farve, saks, forbind, ring, kryds, klap, tale
 *   Linjer     (kun i browseren) goer et malet billede til en stregtegning med
 *              et kantfilter i canvas, saa det kan farvelaegges.
 *
 * Ingen DOM ved indlaesning, saa testen kan hente filen i Node.
 */
(function (rod) {
  'use strict';

  var Glyffer = (rod.Glyffer) || (typeof require === 'function' ? require('../../games/bogstaver/js/glyffer.js').Glyffer : null);

  var BLAEK = '#2b2522', GRAA = '#8d847c', LYS = '#c8c0b8', VEJ = '#ebe6e1';

  function n(v) { return Math.round(v * 100) / 100; }
  function attr(o) {
    var s = '';
    Object.keys(o).forEach(function (k) { if (o[k] !== undefined && o[k] !== null && o[k] !== false) s += ' ' + k + '="' + o[k] + '"'; });
    return s;
  }
  function stilAf(o) {
    o = o || {};
    return {
      fill: o.fyld || 'none', stroke: o.kant === undefined ? BLAEK : o.kant, 'stroke-width': n(o.w === undefined ? 0.45 : o.w),
      'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'stroke-dasharray': o.stiplet || null, opacity: o.opacitet
    };
  }
  function linje(x1, y1, x2, y2, o) { return '<line' + attr(Object.assign({ x1: n(x1), y1: n(y1), x2: n(x2), y2: n(y2) }, stilAf(o))) + '/>'; }
  function cirkel(cx, cy, r, o) { return '<circle' + attr(Object.assign({ cx: n(cx), cy: n(cy), r: n(r) }, stilAf(o))) + '/>'; }
  function ellipse(cx, cy, rx, ry, o) { return '<ellipse' + attr(Object.assign({ cx: n(cx), cy: n(cy), rx: n(rx), ry: n(ry) }, stilAf(o))) + '/>'; }
  function rekt(x, y, b, h, r, o) { return '<rect' + attr(Object.assign({ x: n(x), y: n(y), width: n(b), height: n(h), rx: n(r || 0) }, stilAf(o))) + '/>'; }
  function sti(d, o) { return '<path' + attr(Object.assign({ d: d }, stilAf(o))) + '/>'; }
  function poly(pts, luk, o) {
    return sti(pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join(' ') + (luk ? ' Z' : ''), o);
  }
  function gruppe(indhold, transform) { return '<g' + (transform ? ' transform="' + transform + '"' : '') + '>' + indhold + '</g>'; }
  function esc(t) { return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  /** Almindelig tekst (til den voksne) i SVG. str er skriftens hoejde i mm. */
  function tekst(x, y, t, o) {
    o = o || {};
    return '<text' + attr({ x: n(x), y: n(y), 'font-size': n(o.str || 3.5), 'text-anchor': o.anker || 'start', 'font-weight': o.vaegt || null,
      fill: o.farve || BLAEK, 'font-family': 'inherit' }) + '>' + esc(t) + '</text>';
  }
  function svg(b, h, indhold, klasse) {
    return '<svg xmlns="http://www.w3.org/2000/svg"' + (klasse ? ' class="' + klasse + '"' : '') + ' width="' + n(b) + 'mm" height="' + n(h) + 'mm" viewBox="0 0 ' + n(b) + ' ' + n(h) + '">' + indhold + '</svg>';
  }

  /* ================= grundskrift med Bogstavvejens streger ================= */

  var NAVN = { 'Æ': 'AE', 'Ø': 'OE', 'Å': 'AA', 'æ': 'ae', 'ø': 'oe', 'å': 'aa' };
  function glyfNavn(ch) { return NAVN[ch] || ch; }
  function glyf(ch) { return Glyffer.GLYFFER[glyfNavn(ch)] || null; }
  function erLille(ch) { return Glyffer.SMAA.indexOf(glyfNavn(ch)) >= 0; }
  var kasser = {};
  function kasse(ch) {
    var k = glyfNavn(ch);
    if (!kasser[k]) {
      var g = glyf(ch), mx = 1e9, Mx = -1e9;
      g.streger.forEach(function (s) { s.forEach(function (p) { mx = Math.min(mx, p[0]); Mx = Math.max(Mx, p[0]); }); });
      kasser[k] = { min: mx, max: Mx };
    }
    return kasser[k];
  }
  /*
   * Maal: h er hoejden af et stort bogstav (og af opstregerne paa de smaa) i mm.
   * Store bogstaver og tal staar i glyffer.js fra y=10 til 90, smaa har grundlinje
   * ved 80 og opstreg til 12. Derfor to skalaer.
   */
  function skala(ch, h) { return erLille(ch) ? h / 68 : h / 80; }
  function bundY(ch) { return erLille(ch) ? 80 : 90; }
  function bredde(ch, h) {
    if (ch === ' ') return h * 0.5;
    var k = kasse(ch), s = skala(ch, h);
    return Math.max((k.max - k.min) * s, h * 0.1);
  }
  function afstand(h) { return h * 0.22; }
  /** Hele tekstens bredde i mm. */
  function maal(t, h) {
    var b = 0, tegn = Array.from(String(t));
    tegn.forEach(function (ch, i) { b += bredde(ch, h) + (i < tegn.length - 1 ? afstand(h) : 0); });
    return b;
  }
  /** Strengene i et tegn som punkter i mm, med tegnets venstre kant i x og grundlinjen i base. */
  function strengePunkter(ch, x, base, h) {
    var g = glyf(ch), k = kasse(ch), s = skala(ch, h), by = bundY(ch);
    return g.streger.map(function (st) { return st.map(function (p) { return [x + (p[0] - k.min) * s, base - (by - p[1]) * s]; }); });
  }
  function laengde(pts) { var l = 0; for (var i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]); return l; }
  /** Punktet og retningen et stykke (broekdel t) inde ad en streg. */
  function punktPaa(pts, t) {
    var L = laengde(pts) * t, l = 0;
    for (var i = 1; i < pts.length; i++) {
      var d = Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
      if (l + d >= L && d > 0) {
        var f = (L - l) / d;
        return { x: pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * f, y: pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * f, dx: (pts[i][0] - pts[i - 1][0]) / d, dy: (pts[i][1] - pts[i - 1][1]) / d };
      }
      l += d;
    }
    var a = pts[pts.length - 2] || pts[0], b = pts[pts.length - 1];
    var dd = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    return { x: b[0], y: b[1], dx: (b[0] - a[0]) / dd, dy: (b[1] - a[1]) / dd };
  }
  function dAf(pts) { return pts.map(function (p, i) { return (i ? 'L' : 'M') + n(p[0]) + ' ' + n(p[1]); }).join(' '); }
  function pil(x, y, dx, dy, str, farve) {
    var px = -dy, py = dx;
    return poly([[x + dx * str, y + dy * str], [x - dx * str * 0.6 + px * str * 0.75, y - dy * str * 0.6 + py * str * 0.75],
      [x - dx * str * 0.25, y - dy * str * 0.25], [x - dx * str * 0.6 - px * str * 0.75, y - dy * str * 0.6 - py * str * 0.75]], true,
      { fyld: farve || BLAEK, kant: farve || BLAEK, w: 0.15 });
  }

  /**
   * Skriv en tekst med grundskriftens streger. o: { x, base, h, stil, anker, farve, tyk, pile, numre, vej }
   *   stil: 'fuld' (sort streg), 'prik' (prikket, til at skrive efter), 'spor' (prikket med startprik og pile)
   *   anker: 'start' | 'midte' | 'slut'
   * Svarer { svg, bredde }.
   */
  function skrift(t, o) {
    var h = o.h, stil = o.stil || 'fuld', tegn = Array.from(String(t));
    var b = maal(t, h), x = o.x - (o.anker === 'midte' ? b / 2 : o.anker === 'slut' ? b : 0);
    var w = o.tyk || (stil === 'fuld' ? Math.max(0.35, h * 0.1) : Math.min(1.7, Math.max(0.5, h * 0.03 + 0.3)));
    var ud = '';
    tegn.forEach(function (ch, i) {
      if (ch !== ' ') {
        var st = strengePunkter(ch, x, o.base, h), starter = [];
        st.forEach(function (pts, j) {
          var lille = laengde(pts) < h * 0.2;      // prikken over i og j
          if (stil === 'fuld') {
            ud += lille ? cirkel(pts[0][0], (pts[0][1] + pts[Math.floor(pts.length / 2)][1]) / 2, w * 0.7, { fyld: o.farve || BLAEK, kant: 'none' })
              : sti(dAf(pts), { kant: o.farve || BLAEK, w: w });
            return;
          }
          if (o.vej) ud += sti(dAf(pts), { kant: VEJ, w: h * 0.14 });
          if (lille) {
            var c = pts[Math.floor(pts.length / 2)];
            ud += cirkel((pts[0][0] + c[0]) / 2, (pts[0][1] + c[1]) / 2, w * 1.2, { fyld: LYS, kant: 'none' });
          } else {
            ud += sti(dAf(pts), { kant: o.farve || GRAA, w: w, stiplet: '0 ' + n(w * 2.3) });
          }
          if (stil === 'spor' && (o.pile !== false || i === 0)) {
            var r0 = Math.max(0.75, w * 1.25);
            if (!lille && (o.pile === undefined || o.pile === true || (o.pile === 'foerste' && i === 0))) {
              var L = laengde(pts), steder = L > h * 1.4 ? [0.35, 0.75] : [0.55];
              steder.forEach(function (f) {
                var p = punktPaa(pts, f), afs = o.vedSiden ? w * 3.2 : 0;
                ud += pil(p.x + (-p.dy) * afs, p.y + p.dx * afs, p.dx, p.dy, Math.max(0.9, w * 1.9));
              });
            }
            ud += cirkel(pts[0][0], pts[0][1], r0, { fyld: BLAEK, kant: 'none' });
            if (o.numre && st.length > 1) {
              // Starter to streger samme sted (N, E, P), staar det andet nummer paa den anden side af prikken
              var samme = starter.filter(function (q) { return Math.hypot(q[0] - pts[0][0], q[1] - pts[0][1]) < r0 * 2; }).length;
              var str = Math.max(2.6, h * 0.075);
              ud += samme ? tekst(pts[0][0] + r0 * 1.6, pts[0][1] - r0 * 1.2, String(j + 1), { str: str, anker: 'start', vaegt: 700 })
                : tekst(pts[0][0] - r0 * 1.6, pts[0][1] - r0 * 1.2, String(j + 1), { str: str, anker: 'end', vaegt: 700 });
              starter.push(pts[0]);
            }
          }
        });
      }
      x += bredde(ch, h) + afstand(h);
    });
    return { svg: ud, bredde: b };
  }

  /**
   * Skrivelinjer som i skolen: oeverste linje (store bogstaver og opstreger),
   * en stiplet midterlinje (de smaa bogstavers hoejde), grundlinjen og en svag
   * linje til nedstregerne. base er grundlinjen, h hoejden af et stort bogstav.
   */
  function skrivelinjer(x, b, base, h, svag) {
    var mid = base - h * (35 / 68), ned = base + h * (18 / 68);
    return linje(x, base - h, x + b, base - h, { kant: svag ? LYS : GRAA, w: 0.25 }) +
      linje(x, mid, x + b, mid, { kant: LYS, w: 0.25, stiplet: '1.2 1.2' }) +
      linje(x, base, x + b, base, { kant: BLAEK, w: 0.4 }) +
      linje(x, ned, x + b, ned, { kant: LYS, w: 0.2 });
  }

  /* ================= tingene ================= */

  function stjernePunkter(cx, cy, R, r, spidser, rot) {
    var pts = [];
    spidser = spidser || 5;
    for (var i = 0; i < spidser * 2; i++) {
      var a = (rot === undefined ? -Math.PI / 2 : rot) + i * Math.PI / spidser, rr = i % 2 ? r : R;
      pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]);
    }
    return pts;
  }
  function tykAf(s) { return Math.max(0.35, Math.min(0.6, s * 0.03)); }

  var TING = {
    kugle: function (cx, cy, s) {
      var w = tykAf(s), r = s * 0.4, y = cy + s * 0.08;
      return sti('M' + n(cx) + ' ' + n(y - r - s * 0.1) + ' q ' + n(-s * 0.08) + ' ' + n(-s * 0.1) + ' 0 ' + n(-s * 0.13) + ' q ' + n(s * 0.08) + ' ' + n(s * 0.04) + ' 0 ' + n(s * 0.13), { w: w * 0.7 }) +
        rekt(cx - s * 0.09, y - r - s * 0.11, s * 0.18, s * 0.1, s * 0.02, { fyld: '#fff', w: w * 0.8 }) +
        cirkel(cx, y, r, { fyld: '#fff', w: w }) +
        sti('M' + n(cx - r * 0.93) + ' ' + n(y - r * 0.15) + ' Q ' + n(cx) + ' ' + n(y + r * 0.25) + ' ' + n(cx + r * 0.93) + ' ' + n(y - r * 0.15), { w: w * 0.6 }) +
        sti('M' + n(cx - r * 0.85) + ' ' + n(y + r * 0.3) + ' Q ' + n(cx) + ' ' + n(y + r * 0.7) + ' ' + n(cx + r * 0.85) + ' ' + n(y + r * 0.3), { w: w * 0.6 }) +
        sti('M' + n(cx - r * 0.5) + ' ' + n(y - r * 0.5) + ' q ' + n(r * 0.15) + ' ' + n(-r * 0.2) + ' ' + n(r * 0.35) + ' ' + n(-r * 0.25), { w: w * 0.6 });
    },
    kage: function (cx, cy, s) {
      var w = tykAf(s), r = s * 0.44, pts = [];
      for (var i = 0; i < 48; i++) { var a = i / 48 * Math.PI * 2, rr = r * (1 + 0.05 * Math.cos(a * 12)); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
      return poly(pts, true, { fyld: '#fff', w: w }) + cirkel(cx, cy, r * 0.7, { w: w * 0.5, stiplet: '0.1 ' + n(s * 0.07) }) +
        ellipse(cx, cy, r * 0.22, r * 0.36, { fyld: '#fff', w: w * 0.8 }) + linje(cx, cy - r * 0.25, cx, cy + r * 0.25, { w: w * 0.5 });
    },
    noed: function (cx, cy, s) {
      // En hasselnoed: rund krop og en lys, ru hat paa toppen med en lille spids
      var w = tykAf(s), r = s * 0.4, y = cy + s * 0.07, kt = y - r * 0.15;
      var hat = 'M' + n(cx - r * 0.98) + ' ' + n(kt) + ' C ' + n(cx - r * 0.95) + ' ' + n(y - r * 1.25) + ' ' + n(cx + r * 0.95) + ' ' + n(y - r * 1.25) + ' ' + n(cx + r * 0.98) + ' ' + n(kt) +
        ' Q ' + n(cx + r * 0.5) + ' ' + n(kt + r * 0.22) + ' ' + n(cx) + ' ' + n(kt + r * 0.1) + ' Q ' + n(cx - r * 0.5) + ' ' + n(kt + r * 0.22) + ' ' + n(cx - r * 0.98) + ' ' + n(kt) + ' Z';
      return cirkel(cx, y, r, { fyld: '#fff', w: w }) + sti(hat, { fyld: '#fff', w: w }) +
        linje(cx, y - r * 1.0, cx, y - r * 1.28, { w: w * 1.2 }) +
        linje(cx - r * 0.4, kt - r * 0.1, cx - r * 0.25, y - r * 0.82, { w: w * 0.5 }) + linje(cx + r * 0.4, kt - r * 0.1, cx + r * 0.25, y - r * 0.82, { w: w * 0.5 }) +
        sti('M' + n(cx + r * 0.35) + ' ' + n(y + r * 0.65) + ' q ' + n(r * 0.3) + ' ' + n(-r * 0.15) + ' ' + n(r * 0.4) + ' ' + n(-r * 0.5), { w: w * 0.5 });
    },
    snebold: function (cx, cy, s) {
      var w = tykAf(s), r = s * 0.42;
      return cirkel(cx, cy, r, { fyld: '#fff', w: w }) +
        sti('M' + n(cx + r * 0.1) + ' ' + n(cy + r * 0.75) + ' q ' + n(r * 0.45) + ' ' + n(-r * 0.1) + ' ' + n(r * 0.62) + ' ' + n(-r * 0.55), { w: w * 0.55 }) +
        cirkel(cx - r * 0.35, cy - r * 0.3, r * 0.06, { fyld: BLAEK, kant: 'none' }) + cirkel(cx + r * 0.2, cy - r * 0.45, r * 0.05, { fyld: BLAEK, kant: 'none' }) +
        cirkel(cx - r * 0.1, cy + r * 0.15, r * 0.05, { fyld: BLAEK, kant: 'none' });
    },
    stamme: function (cx, cy, s) {
      var w = tykAf(s), l = s, hh = s * 0.32, x0 = cx - l / 2, x1 = cx + l / 2 - hh * 0.3;
      return sti('M' + n(x1) + ' ' + n(cy - hh / 2) + ' L ' + n(x0 + hh * 0.3) + ' ' + n(cy - hh / 2) + ' Q ' + n(x0) + ' ' + n(cy) + ' ' + n(x0 + hh * 0.3) + ' ' + n(cy + hh / 2) + ' L ' + n(x1) + ' ' + n(cy + hh / 2), { fyld: '#fff', w: w }) +
        ellipse(x1, cy, hh * 0.3, hh / 2, { fyld: '#fff', w: w }) + ellipse(x1, cy, hh * 0.17, hh * 0.3, { w: w * 0.5 }) + ellipse(x1, cy, hh * 0.05, hh * 0.1, { w: w * 0.5 }) +
        linje(x0 + l * 0.2, cy - hh * 0.15, x0 + l * 0.5, cy - hh * 0.15, { w: w * 0.5 }) + linje(x0 + l * 0.35, cy + hh * 0.18, x0 + l * 0.7, cy + hh * 0.18, { w: w * 0.5 });
    },
    gran: function (cx, cy, s) {
      var w = tykAf(s), top = cy - s * 0.5, b = s * 0.32;
      var d = 'M' + n(cx) + ' ' + n(top) + ' L ' + n(cx + b * 0.55) + ' ' + n(top + s * 0.3) + ' L ' + n(cx + b * 0.3) + ' ' + n(top + s * 0.3) +
        ' L ' + n(cx + b * 0.8) + ' ' + n(top + s * 0.58) + ' L ' + n(cx + b * 0.45) + ' ' + n(top + s * 0.58) + ' L ' + n(cx + b) + ' ' + n(top + s * 0.85) +
        ' L ' + n(cx - b) + ' ' + n(top + s * 0.85) + ' L ' + n(cx - b * 0.45) + ' ' + n(top + s * 0.58) + ' L ' + n(cx - b * 0.8) + ' ' + n(top + s * 0.58) +
        ' L ' + n(cx - b * 0.3) + ' ' + n(top + s * 0.3) + ' L ' + n(cx - b * 0.55) + ' ' + n(top + s * 0.3) + ' Z';
      return rekt(cx - s * 0.06, top + s * 0.85, s * 0.12, s * 0.15, 0, { fyld: '#fff', w: w }) + sti(d, { fyld: '#fff', w: w });
    },
    stjerne: function (cx, cy, s) {
      return poly(stjernePunkter(cx, cy + s * 0.04, s * 0.5, s * 0.21), true, { fyld: '#fff', w: tykAf(s) });
    },
    hjerte: function (cx, cy, s) {
      var r = s * 0.45, y = cy - s * 0.12;
      var d = 'M' + n(cx) + ' ' + n(y + r * 1.15) + ' C ' + n(cx - r * 1.5) + ' ' + n(y + r * 0.2) + ' ' + n(cx - r * 0.9) + ' ' + n(y - r * 0.8) + ' ' + n(cx) + ' ' + n(y - r * 0.15) +
        ' C ' + n(cx + r * 0.9) + ' ' + n(y - r * 0.8) + ' ' + n(cx + r * 1.5) + ' ' + n(y + r * 0.2) + ' ' + n(cx) + ' ' + n(y + r * 1.15) + ' Z';
      return sti(d, { fyld: '#fff', w: tykAf(s) });
    },
    gave: function (cx, cy, s) {
      var w = tykAf(s), b = s * 0.8, h = s * 0.55, x = cx - b / 2, y = cy - s * 0.18;
      return rekt(x, y, b, h, s * 0.03, { fyld: '#fff', w: w }) + rekt(x - s * 0.05, y - s * 0.16, b + s * 0.1, s * 0.16, s * 0.03, { fyld: '#fff', w: w }) +
        linje(cx - s * 0.06, y - s * 0.16, cx - s * 0.06, y + h, { w: w * 0.7 }) + linje(cx + s * 0.06, y - s * 0.16, cx + s * 0.06, y + h, { w: w * 0.7 }) +
        sti('M' + n(cx) + ' ' + n(y - s * 0.16) + ' C ' + n(cx - s * 0.3) + ' ' + n(y - s * 0.45) + ' ' + n(cx - s * 0.32) + ' ' + n(y - s * 0.14) + ' ' + n(cx) + ' ' + n(y - s * 0.16) +
          ' C ' + n(cx + s * 0.32) + ' ' + n(y - s * 0.14) + ' ' + n(cx + s * 0.3) + ' ' + n(y - s * 0.45) + ' ' + n(cx) + ' ' + n(y - s * 0.16), { fyld: '#fff', w: w * 0.8 });
    },
    brik: function (cx, cy, s) {
      // En lille puslespilsbrik: tap op og til hoejre, hul til venstre
      var a = s * 0.34, x = cx - a, y = cy - a + s * 0.06, k = s * 0.13;
      var d = 'M' + n(x) + ' ' + n(y) + ' L ' + n(cx - k * 0.7) + ' ' + n(y) +
        ' C ' + n(cx - k * 1.3) + ' ' + n(y - k * 1.6) + ' ' + n(cx + k * 1.3) + ' ' + n(y - k * 1.6) + ' ' + n(cx + k * 0.7) + ' ' + n(y) +
        ' L ' + n(x + 2 * a) + ' ' + n(y) + ' L ' + n(x + 2 * a) + ' ' + n(y + a - k * 0.7) +
        ' C ' + n(x + 2 * a + k * 1.6) + ' ' + n(y + a - k * 1.3) + ' ' + n(x + 2 * a + k * 1.6) + ' ' + n(y + a + k * 1.3) + ' ' + n(x + 2 * a) + ' ' + n(y + a + k * 0.7) +
        ' L ' + n(x + 2 * a) + ' ' + n(y + 2 * a) + ' L ' + n(x) + ' ' + n(y + 2 * a) + ' L ' + n(x) + ' ' + n(y + a + k * 0.7) +
        ' C ' + n(x + k * 1.6) + ' ' + n(y + a + k * 1.3) + ' ' + n(x + k * 1.6) + ' ' + n(y + a - k * 1.3) + ' ' + n(x) + ' ' + n(y + a - k * 0.7) + ' Z';
      return sti(d, { fyld: '#fff', w: tykAf(s) });
    }
  };

  /**
   * Et stort juletrae med top i (cx, top) og hoejden h. o.kugler: pladser som
   * broekdele [fx, fy] af traeets bredde og hoejde (fx fra -0.5 til 0.5). o.stjerne.
   */
  function trae(cx, top, h, o) {
    o = o || {};
    var bf = o.bredde || 1, w = Math.max(0.5, h * 0.007), b = h * 0.42 * bf, lag = [[0.05, 0.36, 0.22], [0.26, 0.6, 0.34], [0.48, 0.86, 0.5]];
    var ud = rekt(cx - h * 0.05, top + h * 0.84, h * 0.1, h * 0.14, h * 0.01, { fyld: '#fff', w: w });
    // Tre lag fra bunden, saa det oeverste ligger ovenpaa
    for (var i = lag.length - 1; i >= 0; i--) {
      var y0 = top + lag[i][0] * h, y1 = top + lag[i][1] * h, hb = lag[i][2] * h * bf;
      var form ='M' + n(cx) + ' ' + n(y0) + ' Q ' + n(cx + hb * 0.35) + ' ' + n(y0 + (y1 - y0) * 0.55) + ' ' + n(cx + hb) + ' ' + n(y1) +
        ' Q ' + n(cx + hb * 0.5) + ' ' + n(y1 + h * 0.03) + ' ' + n(cx) + ' ' + n(y1 + h * 0.01) +
        ' Q ' + n(cx - hb * 0.5) + ' ' + n(y1 + h * 0.03) + ' ' + n(cx - hb) + ' ' + n(y1) +
        ' Q ' + n(cx - hb * 0.35) + ' ' + n(y0 + (y1 - y0) * 0.55) + ' ' + n(cx) + ' ' + n(y0) + ' Z';
      ud +=sti(form, { fyld: '#fff', w: w });
      // Smaa naale-buer langs kanten
      for (var q = 1; q < 4; q++) {
        var fy = y1 - (y1 - y0) * 0.18 * q, fx = hb * (1 - 0.22 * q);
        ud += sti('M' + n(cx - fx * 0.55) + ' ' + n(fy) + ' q ' + n(fx * 0.12) + ' ' + n(h * 0.012) + ' ' + n(fx * 0.25) + ' 0', { w: w * 0.5 });
        ud += sti('M' + n(cx + fx * 0.3) + ' ' + n(fy + h * 0.01) + ' q ' + n(fx * 0.12) + ' ' + n(h * 0.012) + ' ' + n(fx * 0.25) + ' 0', { w: w * 0.5 });
      }
    }
    if (o.stjerne !== false) ud += poly(stjernePunkter(cx, top + h * 0.02, h * 0.07, h * 0.03), true, { fyld: '#fff', w: w });
    (o.kugler || []).forEach(function (p) { ud += TING.kugle(cx + p[0] * 2 * b, top + p[1] * h, h * 0.1); });
    return ud;
  }

  /*
   * Pelle, Sanne og Nis er tegninger til at farvelaegge (pelle.png, sanne.png, nis.png i denne mappe),
   * lavet med Gemini ud fra de malede figurer i appen, saa de ligner sig selv. FIGUR: bredde/hoejde for hvert billede og hvilken vej det vender (1 = hoejre).
   */
  var FIGUR = { pelle: [283 / 360, 0], sanne: [1, 1], nis: [215 / 360, 0] };
  function figur(navn, cx, cy, s, spejl) {
    var f = FIGUR[navn], h = s * 1.05, b = h * f[0], vend = f[1] && !spejl ? -1 : 1;
    var t = vend < 0 ? ' transform="translate(' + n(2 * cx) + ' 0) scale(-1 1)"' : '';
    return '<image href="' + navn + '.png" x="' + n(cx - b / 2) + '" y="' + n(cy - h / 2) + '" width="' + n(b) + '" height="' + n(h) + '"' + t + '/>';
  }

  function pelle(cx, cy, s, spejl) { return figur('pelle', cx, cy, s, spejl); }
  function sanne(cx, cy, s, spejl) { return figur('sanne', cx, cy, s, spejl); }
  function nis(cx, cy, s) { return figur('nis', cx, cy, s, true); }

  /** Et ur med tallene i grundskrift. o.time: den lille viser; o.stor: den store viser lige op; o.lille: tegn den lille viser. */
  function ur(cx, cy, r, o) {
    o = o || {};
    var w = Math.max(0.45, r * 0.02), ud = cirkel(cx, cy, r, { fyld: '#fff', w: w * 1.6 }) + cirkel(cx, cy, r * 0.93, { w: w * 0.4, kant: LYS });
    for (var i = 0; i < 60; i++) {
      var a = i / 60 * Math.PI * 2, lang = i % 5 === 0;
      ud += linje(cx + Math.sin(a) * r * (lang ? 0.86 : 0.9), cy - Math.cos(a) * r * (lang ? 0.86 : 0.9), cx + Math.sin(a) * r * 0.93, cy - Math.cos(a) * r * 0.93, { w: lang ? w : w * 0.4 });
    }
    for (var t = 1; t <= 12; t++) {
      var v = t / 12 * Math.PI * 2, hh = r * 0.17;
      ud += skrift(String(t), { x: cx + Math.sin(v) * r * 0.68, base: cy - Math.cos(v) * r * 0.68 + hh / 2, h: hh, anker: 'midte', tyk: Math.max(0.35, hh * 0.1) }).svg;
    }
    if (o.stor !== false) ud += linje(cx, cy, cx, cy - r * 0.54, { w: w * 1.5 }) + pil(cx, cy - r * 0.54, 0, -1, r * 0.06);
    if (o.time) {
      var vh = o.time / 12 * Math.PI * 2;
      ud += linje(cx, cy, cx + Math.sin(vh) * r * 0.36, cy - Math.cos(vh) * r * 0.36, { w: w * 2.8 });
    }
    return ud + cirkel(cx, cy, r * 0.04, { fyld: BLAEK, kant: 'none' });
  }

  function terning(cx, cy, s, antal, tegnTing) {
    var w = tykAf(s), ud = rekt(cx - s / 2, cy - s / 2, s, s, s * 0.16, { fyld: '#fff', w: w });
    var P = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [-1, 1], [1, -1], [1, 1]], 5: [[-1, -1], [-1, 1], [1, -1], [1, 1], [0, 0]], 6: [[-1, -1], [-1, 0], [-1, 1], [1, -1], [1, 0], [1, 1]] };
    (P[antal] || []).forEach(function (p) {
      ud += tegnTing ? tegnTing(cx + p[0] * s * 0.28, cy + p[1] * s * 0.28, s * 0.26) : cirkel(cx + p[0] * s * 0.28, cy + p[1] * s * 0.28, s * 0.08, { fyld: BLAEK, kant: 'none' });
    });
    return ud;
  }

  function tierramme(x, y, felt) {
    var ud = '';
    for (var r = 0; r < 2; r++) for (var k = 0; k < 5; k++) ud += rekt(x + k * felt, y + r * felt, felt, felt, 0, { fyld: '#fff', w: 0.45 });
    return ud + rekt(x, y, felt * 5, felt * 2, 0, { w: 0.8 });
  }

  /** En tromme med antal slag som prikker over sig. */
  function tromme(cx, cy, s, antal) {
    var w = tykAf(s), b = s * 0.8, h = s * 0.45, y = cy - h / 2 + s * 0.1, ud = '';
    ud += sti('M' + n(cx - b / 2) + ' ' + n(y) + ' L ' + n(cx - b / 2) + ' ' + n(y + h) + ' A ' + n(b / 2) + ' ' + n(b * 0.14) + ' 0 0 0 ' + n(cx + b / 2) + ' ' + n(y + h) + ' L ' + n(cx + b / 2) + ' ' + n(y), { fyld: '#fff', w: w });
    ud += ellipse(cx, y, b / 2, b * 0.14, { fyld: '#fff', w: w });
    for (var i = 0; i < 4; i++) { var x0 = cx - b / 2 + b * (i + 0.5) / 4; ud += linje(x0, y + b * 0.12, x0 + b / 8 * (i % 2 ? -1 : 1), y + h + b * 0.08, { w: w * 0.5 }); }
    ud += linje(cx - b * 0.25, y - s * 0.32, cx - b * 0.05, y - s * 0.05, { w: w * 1.3 }) + cirkel(cx - b * 0.27, y - s * 0.34, s * 0.04, { fyld: BLAEK, kant: 'none' });
    for (var p = 0; p < antal; p++) ud += cirkel(cx + (p - (antal - 1) / 2) * s * 0.2, cy - s * 0.52, s * 0.065, { fyld: BLAEK, kant: 'none' });
    return ud;
  }

  function ansigt(cx, cy, s, slags) {
    var w = Math.max(0.5, s * 0.025), r = s * 0.45, ud = cirkel(cx, cy, r, { fyld: '#fff', w: w * 1.2 });
    var oy = cy - r * 0.2, ox = r * 0.35;
    ud += cirkel(cx - ox, oy, r * 0.07, { fyld: BLAEK, kant: 'none' }) + cirkel(cx + ox, oy, r * 0.07, { fyld: BLAEK, kant: 'none' });
    if (slags === 'glad') ud += sti('M' + n(cx - r * 0.45) + ' ' + n(cy + r * 0.2) + ' Q ' + n(cx) + ' ' + n(cy + r * 0.7) + ' ' + n(cx + r * 0.45) + ' ' + n(cy + r * 0.2), { w: w });
    if (slags === 'ked') {
      ud += sti('M' + n(cx - r * 0.4) + ' ' + n(cy + r * 0.5) + ' Q ' + n(cx) + ' ' + n(cy + r * 0.15) + ' ' + n(cx + r * 0.4) + ' ' + n(cy + r * 0.5), { w: w });
      ud += sti('M' + n(cx + ox) + ' ' + n(oy + r * 0.15) + ' q ' + n(-r * 0.08) + ' ' + n(r * 0.18) + ' 0 ' + n(r * 0.24) + ' q ' + n(r * 0.08) + ' ' + n(-r * 0.06) + ' 0 ' + n(-r * 0.24), { w: w * 0.6 });
      ud += linje(cx - ox - r * 0.15, oy - r * 0.18, cx - ox + r * 0.12, oy - r * 0.26, { w: w * 0.8 }) + linje(cx + ox + r * 0.15, oy - r * 0.18, cx + ox - r * 0.12, oy - r * 0.26, { w: w * 0.8 });
    }
    if (slags === 'vred') {
      ud += linje(cx - r * 0.35, cy + r * 0.42, cx + r * 0.35, cy + r * 0.42, { w: w });
      ud += linje(cx - ox - r * 0.18, oy - r * 0.3, cx - ox + r * 0.15, oy - r * 0.14, { w: w }) + linje(cx + ox + r * 0.18, oy - r * 0.3, cx + ox - r * 0.15, oy - r * 0.14, { w: w });
    }
    if (slags === 'bange') {
      ud += ellipse(cx, cy + r * 0.42, r * 0.14, r * 0.18, { w: w });
      ud += sti('M' + n(cx - ox - r * 0.15) + ' ' + n(oy - r * 0.2) + ' q ' + n(r * 0.15) + ' ' + n(-r * 0.12) + ' ' + n(r * 0.3) + ' 0', { w: w * 0.8 }) +
        sti('M' + n(cx + ox - r * 0.15) + ' ' + n(oy - r * 0.2) + ' q ' + n(r * 0.15) + ' ' + n(-r * 0.12) + ' ' + n(r * 0.3) + ' 0', { w: w * 0.8 });
    }
    return ud;
  }

  /** Lille laage med dagens nummer (til overskriften). */
  function laage(x, y, b, h, nr) {
    var ud = rekt(x, y, b, h, 1.6, { fyld: '#fff', w: 0.6 }) + rekt(x + 1.4, y + 1.4, b - 2.8, h - 2.8, 1, { w: 0.3, kant: GRAA });
    ud += skrift(String(nr), { x: x + b / 2, base: y + h / 2 + h * 0.22, h: h * 0.44, anker: 'midte', tyk: Math.max(0.6, h * 0.05) }).svg;
    return ud;
  }

  /* ================= piktogrammer ================= */

  /* Hvert ikon tegnes i en kasse paa 10 x 10 med (0, 0) oeverst til venstre. */
  var IKON = {
    blyant: function () {
      return gruppe(rekt(-1.1, -4.6, 2.2, 7.6, 0.3, { fyld: '#fff', w: 0.4 }) + poly([[-1.1, 3], [0, 5.4], [1.1, 3]], true, { fyld: '#fff', w: 0.4 }) +
        poly([[-0.4, 4.6], [0, 5.4], [0.4, 4.6]], true, { fyld: BLAEK, w: 0.2 }) + rekt(-1.1, -4.6, 2.2, 1.4, 0.3, { fyld: LYS, w: 0.4 }), 'translate(5.6 4.4) rotate(35)') +
        sti('M1.2 9.2 q 1.2 -1.4 2.4 0 q 1.2 1.4 2.4 0', { w: 0.4 });
    },
    farve: function () {
      var ud = '';
      [[-28, 3.4], [0, 5], [28, 6.6]].forEach(function (p, i) {
        ud += gruppe(rekt(-0.9, -3.4, 1.8, 6, 0.3, { fyld: i === 1 ? LYS : '#fff', w: 0.35 }) + poly([[-0.9, 2.6], [0, 4.4], [0.9, 2.6]], true, { fyld: BLAEK, w: 0.3 }),
          'translate(' + p[1] + ' 4) rotate(' + (p[0] + 180) + ')');
      });
      return ud + sti('M1 9.3 l 1.4 -1.6 l 0.6 1.6 l 1.4 -1.6 l 0.6 1.6 l 1.4 -1.6 l 0.6 1.6 l 1.4 -1.6', { w: 0.35 });
    },
    saks: function () {
      return cirkel(2.4, 7.4, 1.6, { w: 0.5 }) + cirkel(7.6, 7.4, 1.6, { w: 0.5 }) +
        sti('M3.6 6.3 L 7.2 0.8', { w: 0.6 }) + sti('M6.4 6.3 L 2.8 0.8', { w: 0.6 }) + cirkel(5, 4.1, 0.35, { fyld: BLAEK, kant: 'none' });
    },
    forbind: function () {
      return cirkel(1.8, 7.6, 1.1, { fyld: BLAEK, kant: 'none' }) + cirkel(8.2, 2.4, 1.1, { fyld: BLAEK, kant: 'none' }) + linje(1.8, 7.6, 8.2, 2.4, { w: 0.55 });
    },
    ring: function () {
      return TING.stjerne(5, 5, 4.2) + sti('M8.6 3.4 C 10.2 6.8 7.6 9.4 4.4 9.2 C 1.2 9 -0.2 6.2 0.8 3.6 C 1.8 1 5 0.2 7.6 1.4 L 9.2 2.6', { w: 0.55 });
    },
    kryds: function () {
      return rekt(1, 1, 8, 8, 1.4, { fyld: '#fff', w: 0.4 }) + linje(2.6, 2.6, 7.4, 7.4, { w: 0.8 }) + linje(7.4, 2.6, 2.6, 7.4, { w: 0.8 });
    },
    klap: function () {
      // To flade haender, der klapper, med fingrene opad og smaa streger for lyden
      var haand = function (t) {
        return gruppe(sti('M-1.5 3.6 L -1.7 -0.6 Q -1.8 -3.6 -0.9 -3.7 Q -0.4 -3.8 -0.3 -2.6 L -0.3 -3.9 Q -0.2 -4.6 0.4 -4.5 Q 0.9 -4.4 0.9 -3.6 L 0.9 -3.4 Q 1.2 -4 1.6 -3.8 Q 2 -3.6 1.9 -2.8 L 1.7 1 Q 2.4 -0.2 2.9 0.2 Q 3.3 0.6 2.6 1.6 L 1.2 3.6 Z', { fyld: '#fff', w: 0.35 }), t);
      };
      return haand('translate(3.4 5.6) rotate(-14) scale(-1 1)') + haand('translate(6.6 5.6) rotate(14)') +
        linje(1.4, 1.4, 0.4, 0.4, { w: 0.4 }) + linje(5, 0.9, 5, -0.4, { w: 0.4 }) + linje(8.6, 1.4, 9.6, 0.4, { w: 0.4 });
    },
    tale: function () {
      return sti('M1 2 Q 1 0.8 2.2 0.8 L 7.8 0.8 Q 9 0.8 9 2 L 9 6 Q 9 7.2 7.8 7.2 L 4 7.2 L 2 9.2 L 2.4 7.2 L 2.2 7.2 Q 1 7.2 1 6 Z', { fyld: '#fff', w: 0.45 }) +
        cirkel(3.2, 4, 0.55, { fyld: BLAEK, kant: 'none' }) + cirkel(5, 4, 0.55, { fyld: BLAEK, kant: 'none' }) + cirkel(6.8, 4, 0.55, { fyld: BLAEK, kant: 'none' });
    },
    lim: function () {
      return rekt(3, 3, 4, 6.4, 0.6, { fyld: '#fff', w: 0.4 }) + rekt(3.4, 1, 3.2, 2, 0.4, { fyld: LYS, w: 0.4 }) + linje(3.6, 5.2, 6.4, 5.2, { w: 0.3 });
    }
  };
  /** Et piktogram i et lille kort paa s x s mm med oeverste venstre hjoerne i (x, y). */
  function ikon(navn, x, y, s) {
    var k = s / 10;
    return rekt(x, y, s, s, s * 0.2, { fyld: '#fff', w: 0.5 }) + gruppe(IKON[navn](), 'translate(' + n(x + s * 0.1) + ' ' + n(y + s * 0.1) + ') scale(' + n(k * 0.8) + ')');
  }

  /* ================= malede billeder som stregtegninger (kun i browseren) ================= */

  var Linjer = (function () {
    var cache = {};
    /** Kantfilter: Sobel paa et let sloeret graatonebillede plus omridset af gennemsigtigheden. Moerke streger paa gennemsigtig baggrund. */
    function filtrer(img) {
      var W = img.naturalWidth, H = img.naturalHeight, c = document.createElement('canvas');
      c.width = W; c.height = H;
      var x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      var d = x.getImageData(0, 0, W, H).data, g = new Float32Array(W * H), a = new Float32Array(W * H), b = new Float32Array(W * H);
      for (var i = 0; i < W * H; i++) {
        var al = d[i * 4 + 3] / 255;
        a[i] = al;
        g[i] = ((0.3 * d[i * 4] + 0.59 * d[i * 4 + 1] + 0.11 * d[i * 4 + 2]) / 255) * al + (1 - al);
      }
      for (var y = 1; y < H - 1; y++) for (var X = 1; X < W - 1; X++) {
        var s = 0;
        for (var j = -1; j <= 1; j++) for (var k = -1; k <= 1; k++) s += g[(y + j) * W + X + k];
        b[y * W + X] = s / 9;
      }
      var ud = x.createImageData(W, H), o = ud.data, kant = 3;
      for (var yy = kant; yy < H - kant; yy++) for (var xx = kant; xx < W - kant; xx++) {
        var p = function (j, k) { return b[(yy + j) * W + xx + k]; }, q = function (j, k) { return a[(yy + j) * W + xx + k]; };
        var gx = -p(-1, -1) - 2 * p(0, -1) - p(1, -1) + p(-1, 1) + 2 * p(0, 1) + p(1, 1);
        var gy = -p(-1, -1) - 2 * p(-1, 0) - p(-1, 1) + p(1, -1) + 2 * p(1, 0) + p(1, 1);
        var ax = -q(-1, -1) - 2 * q(0, -1) - q(1, -1) + q(-1, 1) + 2 * q(0, 1) + q(1, 1);
        var ay = -q(-1, -1) - 2 * q(-1, 0) - q(-1, 1) + q(1, -1) + 2 * q(1, 0) + q(1, 1);
        var v = Math.min(1, Math.max(Math.hypot(gx, gy) * 2 - 0.2, 0) / 0.8);
        v = Math.max(v, Math.min(1, Math.hypot(ax, ay) * 1.2));
        // Stregen ovenpaa hvidt, hvor billedet har farve, saa figurerne daekker det, de staar foran
        var idx = (yy * W + xx) * 4, li = Math.min(1, v * 1.05), al2 = Math.max(li, a[yy * W + xx] > 0.5 ? 1 : 0), f = al2 ? li / al2 : 0;
        o[idx] = Math.round(255 - (255 - 43) * f); o[idx + 1] = Math.round(255 - (255 - 37) * f); o[idx + 2] = Math.round(255 - (255 - 34) * f); o[idx + 3] = Math.round(al2 * 255);
      }
      x.putImageData(ud, 0, 0);
      return { url: c.toDataURL('image/png'), b: W, h: H };
    }
    function hent(sti, rodSti) {
      if (cache[sti]) return Promise.resolve(cache[sti]);
      return new Promise(function (ok, nej) {
        var img = new Image();
        img.onload = function () { cache[sti] = filtrer(img); ok(cache[sti]); };
        img.onerror = function () { nej(new Error('Billedet mangler: ' + sti)); };
        img.src = (rodSti || '../../') + sti;
      });
    }
    /** Et hentet billede som <image>, inden for en kasse paa b x h med midten i (cx, cy). */
    function billede(sti, cx, cy, b, h) {
      var c = cache[sti];
      if (!c) return rekt(cx - b / 2, cy - h / 2, b, h, 2, { kant: '#d33', stiplet: '1 1' });
      var k = Math.min(b / c.b, h / c.h), bb = c.b * k, hh = c.h * k;
      return '<image href="' + c.url + '" x="' + n(cx - bb / 2) + '" y="' + n(cy - hh / 2) + '" width="' + n(bb) + '" height="' + n(hh) + '"/>';
    }
    return { hent: hent, billede: billede, cache: cache };
  })();

  rod.Tegn = {
    BLAEK: BLAEK, GRAA: GRAA, LYS: LYS, VEJ: VEJ,
    n: n, linje: linje, cirkel: cirkel, ellipse: ellipse, rekt: rekt, sti: sti, poly: poly, gruppe: gruppe, tekst: tekst, svg: svg, esc: esc, pil: pil,
    glyf: glyf, erLille: erLille, maal: maal, skrift: skrift, skrivelinjer: skrivelinjer, strengePunkter: strengePunkter,
    TING: TING, stjernePunkter: stjernePunkter, trae: trae, pelle: pelle, sanne: sanne, nis: nis, ur: ur, terning: terning,
    tierramme: tierramme, tromme: tromme, ansigt: ansigt, laage: laage, IKON: IKON, ikon: ikon, Linjer: Linjer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
