/**
 * Pelles julekalender: opgavernes skaerme.
 *
 * Reglerne og alt, der siges, kommer fra opgaver.js (Opgaver.forbered); her er
 * kun tegningen og trykkene. Hver leg er en funktion (f, dag, J, faerdig), der
 * svarer med { tegn, opdater, ned, flyt, op, gentag }. J er hjaelperne fra
 * game.js: sige, klip (ordklippene), raekke, tone, fest ...
 *
 * Ingen point, ingen tid, ingen straf: et forkert tryk ryster blidt, og man
 * proever igen. Hver finger foelges for sig (pointerId), saa to boern kan
 * trykke paa én gang.
 *
 * info() bruges kun af en browser-automat, der proever legene: hvor tingene
 * ligger, og hvor langt legen er.
 */
(function () {
  'use strict';

  var M = window.Maleri, O = window.Opgaver, P = window.Puslespil;
  var KANT = '#5e4a3a', PAPIR = '#f8f1e6', GUL = '#f0c46a', GROEN = '#8fae86';
  var CELLE = (3 / 4 / 4) / (1 / 6);
  var SKRIFT = 'ui-rounded,"SF Pro Rounded",system-ui,sans-serif';

  function bland(a) {
    a = a.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  /** Blid rysten: et lille sving fra side til side, der doer ud. */
  function rystX(o) { return o.ryst > 0 ? Math.sin(o.ryst * 38) * 12 * o.ryst : 0; }
  function ned(o, felt, dt, k) { if (o[felt] > 0) o[felt] = Math.max(0, o[felt] - dt * (k || 2)); }

  /** Et kort af papir med et billede, som i Rimhulen. */
  function kort(c, x, y, s, billede, glad, t) {
    c.save();
    if (glad > 0) {
      c.shadowColor = 'rgba(240,196,106,.9)'; c.shadowBlur = 26;
      M.rr(c, x - s / 2 - 6, y - s / 2 - 6, s + 12, s + 12, s * 0.16, 'rgba(240,196,106,.8)');
    }
    c.shadowColor = 'rgba(107,85,68,.22)'; c.shadowBlur = 12; c.shadowOffsetY = 6;
    M.rr(c, x - s / 2, y - s / 2, s, s, s * 0.14, PAPIR);
    c.shadowColor = 'transparent';
    var i = M.hent(billede);
    if (M.klar(billede)) {
      var k = Math.min(s * 0.82 / i.naturalWidth, s * 0.82 / i.naturalHeight);
      c.drawImage(i, x - i.naturalWidth * k / 2, y - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k);
    }
    c.restore();
  }
  /** En sky oeverst, hvor ordet eller bogstavet staar. Et tryk paa den siger spoergsmaalet igen. */
  function sky(c, x, y, b, h) {
    c.save();
    c.shadowColor = 'rgba(107,85,68,.18)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
    c.fillStyle = PAPIR;
    c.beginPath();
    c.ellipse(x, y + h * 0.08, b * 0.5, h * 0.36, 0, 0, 7);
    c.ellipse(x - b * 0.22, y - h * 0.06, b * 0.26, h * 0.32, 0, 0, 7);
    c.ellipse(x + b * 0.18, y - h * 0.14, b * 0.3, h * 0.36, 0, 0, 7);
    c.fill();
    c.restore();
  }
  function skyFelt(W, H) { var h = Math.min(H * 0.26, 190), b = h * 1.7; return { x: W / 2, y: h * 0.62 + 10, b: b, h: h }; }
  function iSky(s, x, y) { return Math.abs(x - s.x) < s.b * 0.55 && Math.abs(y - s.y) < s.h * 0.5; }

  /** Det groenne flueben, der afslutter pynten. */
  function flueben(c, x, y, r, puls) {
    c.save();
    c.translate(x, y); c.scale(puls, puls);
    c.shadowColor = 'rgba(95,127,88,.45)'; c.shadowBlur = 12; c.shadowOffsetY = 6;
    c.fillStyle = GROEN; c.beginPath(); c.arc(0, 0, r, 0, 7); c.fill();
    c.shadowColor = 'transparent';
    c.strokeStyle = PAPIR; c.lineWidth = r * 0.2; c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(-r * 0.42, 0); c.lineTo(-r * 0.1, r * 0.32); c.lineTo(r * 0.45, -r * 0.3); c.stroke();
    c.restore();
  }
  /** Et lille guldmaerke med tallet, naar en ting er talt. Tallene maa gerne staa der. */
  function talMaerke(c, x, y, n, r) {
    c.save();
    c.fillStyle = GUL; c.strokeStyle = KANT; c.lineWidth = 2.5;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.stroke();
    c.fillStyle = KANT; c.font = '800 ' + Math.round(r * 1.15) + 'px ' + SKRIFT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.fillText(String(n), x, y + r * 0.06);
    c.restore();
  }

  /* ================= tael: tryk paa hver ting, stemmen taeller med ================= */

  function tael(f, dag, J, faerdig) {
    var tid = 0, talt = 0, slut = false;
    var ting = f.pladser.pos.map(function (p, i) { return { x: p.x, y: p.y, nr: i, talt: 0, ryst: 0, hop: 0 }; });
    function felt() {
      var W = J.W(), H = J.H();
      if (f.pladser.trae) { var h = H * 0.84, b = h * 0.8; return { x: W / 2 - b / 2, y: H * 0.08, b: b, h: h }; }
      var bb = Math.min(W * 0.76, (H - 120) * 4 / 3), bh = bb * 0.75;
      return { x: (W - bb) / 2, y: (H - bh) / 2 + 20, b: bb, h: bh };
    }
    function plads(t, F) { return { x: F.x + t.x * F.b, y: F.y + t.y * F.h, s: f.pladser.str * F.h }; }
    J.sige(f.spoerg);
    return {
      info: function () { var F = felt(); return { ting: ting.map(function (t) { var p = plads(t, F); return { x: p.x, y: p.y, talt: t.talt }; }) }; },
      gentag: function () { J.sige(slut ? f.slut : f.spoerg); },
      opdater: function (dt) { tid += dt; ting.forEach(function (t) { ned(t, 'ryst', dt); ned(t, 'hop', dt, 2.5); }); },
      tegn: function (c) {
        var F = felt();
        if (f.pladser.trae) M.juletrae(c, F.x + F.b / 2, F.y + F.h * 0.04, F.y + F.h * 0.96, F.b * 0.8, false, tid);
        else if (f.ting === 'kage') {
          // Bagepladen
          c.save(); c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
          M.rr(c, F.x - 10, F.y + F.h * 0.08, F.b + 20, F.h * 0.84, 26, '#8a8478'); c.restore();
          M.rr(c, F.x + 4, F.y + F.h * 0.08 + 14, F.b - 8, F.h * 0.84 - 28, 18, '#b8b2a4');
        } else if (f.ting === 'gran') {
          c.fillStyle = 'rgba(251,247,240,.9)'; c.beginPath(); c.roundRect(F.x - 20, F.y + F.h * 0.3, F.b + 40, F.h * 0.5, 40); c.fill();
          c.strokeStyle = 'rgba(177,138,86,.35)'; c.lineWidth = F.h * 0.08; c.lineCap = 'round';
          c.beginPath(); c.moveTo(F.x, F.y + F.h * 0.56); c.bezierCurveTo(F.x + F.b * 0.35, F.y + F.h * 0.46, F.x + F.b * 0.65, F.y + F.h * 0.66, F.x + F.b, F.y + F.h * 0.54); c.stroke();
        }
        ting.forEach(function (t) {
          var p = plads(t, F), dy = -Math.sin(t.hop * Math.PI) * p.s * 0.18;
          M.ting(c, f.ting, p.x + rystX(t), p.y + dy, p.s, t.nr, tid);
          if (t.talt) {
            c.strokeStyle = 'rgba(240,196,106,.95)'; c.lineWidth = 4;
            c.beginPath(); c.arc(p.x, p.y + dy, p.s * 0.58, 0, 7); c.stroke();
            talMaerke(c, p.x + p.s * 0.45, p.y + dy - p.s * 0.45, t.talt, Math.max(12, p.s * 0.2));
          }
        });
      },
      ned: function (x, y) {
        if (slut) return;
        var F = felt(), bedst = null, afst = 1e9;
        ting.forEach(function (t) { var p = plads(t, F), d = Math.hypot(x - p.x, y - p.y); if (d < Math.max(p.s * 0.62, 34) && d < afst) { afst = d; bedst = t; } });
        if (!bedst) return;
        if (bedst.talt) { bedst.ryst = 0.5; return; }
        talt++; bedst.talt = talt; bedst.hop = 1;
        var p = plads(bedst, F);
        J.tone(420 + talt * 55, 0.16, 0.12);
        J.fest(p.x, p.y, 8, 120, 'gnist');
        if (talt < ting.length) { J.sige(O.tal(talt)); return; }
        slut = true;
        J.sige(O.tal(talt), function () { setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 500); }); }, 450); });
      }
    };
  }

  /* ================= se: tingene ses kort, svaret paa en talraekke ================= */

  function se(f, dag, J, faerdig) {
    var tid = 0, r = 0, fase = 'klar', visT = 0, daekke = 1, valgt = null;
    var knapper = [];
    for (var n = 1; n <= f.max; n++) knapper.push({ n: n, ryst: 0 });
    var dele = O.saetningerAf(f.spoerg), foer = dele.length > 1 ? dele[0] : null, spoerg = dele.length > 1 ? dele.slice(1).join(' ') : f.spoerg;
    function runde() { return f.runder[r]; }
    function startRunde() {
      fase = 'klar'; valgt = null; daekke = 1;
      if (foer) J.sige(foer, function () { setTimeout(vis, 300); }); else setTimeout(vis, 700);
    }
    function vis() { fase = 'vis'; visT = 0; J.tone(660, 0.1, 0.08); }
    function skjul() { fase = 'svar'; J.sige(spoerg); }
    function felt() {
      var W = J.W(), H = J.H(), b = Math.min(W * 0.6, (H - 230) * 1.6), h = b / 1.6;
      return { x: (W - b) / 2, y: Math.max(24, (H - 150 - h) / 2), b: b, h: h };
    }
    function knapFelt() {
      var W = J.W(), H = J.H(), F = felt(), rr = Math.min(42, (W - 160) / (f.max * 2.35));
      return { y: Math.min(H - rr - 18, F.y + F.h + 30 + rr), r: rr, gab: rr * 2.35, x0: W / 2 - (f.max - 1) * rr * 2.35 / 2 };
    }
    startRunde();
    return {
      info: function () { var K = knapFelt(); return { fase: fase, antal: runde() && runde().antal, knapper: knapper.map(function (k, i) { return { n: k.n, x: K.x0 + i * K.gab, y: K.y }; }) }; },
      gentag: function () { if (fase === 'svar') J.sige(spoerg); },
      opdater: function (dt) {
        tid += dt;
        knapper.forEach(function (k) { ned(k, 'ryst', dt); });
        if (fase === 'vis') { visT += dt; daekke = Math.max(0, daekke - dt * 4); if (visT >= f.vis) skjul(); }
        else if (fase === 'rigtig') daekke = Math.max(0, daekke - dt * 4);
        else daekke = Math.min(1, daekke + dt * 4);
      },
      tegn: function (c) {
        var F = felt(), R = runde(); if (!R) return;
        var nat = R.ting === 'stjerne';
        c.save(); c.shadowColor = 'rgba(94,74,58,.28)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
        M.rr(c, F.x, F.y, F.b, F.h, 30, nat ? '#56688f' : '#b18a56'); c.restore();
        if (nat) M.rr(c, F.x + 8, F.y + 8, F.b - 16, F.h - 16, 24, '#6b7ba3');
        else {
          // Stubben: aarringe, set fra oven
          c.fillStyle = '#e5d3ae'; c.beginPath(); c.roundRect(F.x + 10, F.y + 10, F.b - 20, F.h - 20, 24); c.fill();
          c.strokeStyle = 'rgba(138,102,61,.25)'; c.lineWidth = 3;
          [0.85, 0.62, 0.4].forEach(function (k) { c.beginPath(); c.ellipse(F.x + F.b / 2, F.y + F.h / 2, F.b * 0.46 * k, F.h * 0.42 * k, 0, 0, 7); c.stroke(); });
        }
        var u = Math.min(F.b / 5.4, F.h / 2.7);
        if (daekke < 1) {
          c.save(); c.globalAlpha = 1 - daekke;
          R.moenster.pos.forEach(function (p, i) { M.ting(c, R.ting, F.x + F.b / 2 + p.x * u, F.y + F.h / 2 + p.y * u, u * 0.78, i, tid); });
          c.restore();
        }
        if (daekke > 0) {
          // Et snetaeppe ligger over tingene, naar de ikke skal ses
          c.save(); c.globalAlpha = daekke;
          M.rr(c, F.x + 6, F.y + 6, F.b - 12, F.h - 12, 26, '#fbf7f0');
          c.fillStyle = 'rgba(143,199,232,.25)';
          for (var s = 0; s < 6; s++) { c.beginPath(); c.ellipse(F.x + F.b * (0.15 + s * 0.14), F.y + F.h * (0.3 + (s % 2) * 0.35), F.b * 0.08, F.h * 0.06, 0, 0, 7); c.fill(); }
          M.gnist(c, F.x + F.b / 2, F.y + F.h / 2, Math.min(F.b, F.h) * 0.12, 0.7);
          c.restore();
        }
        var K = knapFelt();
        knapper.forEach(function (k, i) {
          var x = K.x0 + i * K.gab + rystX(k), y = K.y, aktiv = fase === 'svar';
          c.save(); c.globalAlpha = aktiv || valgt === k.n ? 1 : 0.55;
          c.shadowColor = 'rgba(107,85,68,.2)'; c.shadowBlur = 8; c.shadowOffsetY = 5;
          c.fillStyle = valgt === k.n ? GUL : PAPIR; c.beginPath(); c.arc(x, y, K.r, 0, 7); c.fill();
          c.shadowColor = 'transparent';
          c.fillStyle = KANT; c.font = '800 ' + Math.round(K.r * 0.95) + 'px ' + SKRIFT; c.textAlign = 'center'; c.textBaseline = 'middle';
          c.fillText(String(k.n), x, y - K.r * 0.08);
          // Smaa prikker under tallet, saa man ogsaa kan taelle sig frem
          var pr = Math.max(1.6, K.r * 0.07);
          for (var q = 0; q < k.n; q++) { c.beginPath(); c.arc(x + ((q % 5) - Math.min(4, k.n - 1) / 2) * pr * 2.6, y + K.r * 0.5 + Math.floor(q / 5) * pr * 2.4, pr, 0, 7); c.fill(); }
          c.restore();
        });
      },
      ned: function (x, y) {
        if (fase !== 'svar') return;
        var K = knapFelt(), R = runde();
        var k = knapper.filter(function (q, i) { return Math.hypot(x - (K.x0 + i * K.gab), y - K.y) < K.r + 8; })[0];
        if (!k) return;
        if (k.n === R.antal) {
          fase = 'rigtig'; valgt = k.n;
          J.melodi([660, 880, 1100], 90);
          var F = felt(); J.fest(F.x + F.b / 2, F.y + F.h / 2, 24, 240, 'gnist');
          J.sige(R.svar, function () {
            setTimeout(function () { r++; if (r >= f.runder.length) faerdig(); else startRunde(); }, 900);
          });
        } else {
          k.ryst = 1; J.dunk(); fase = 'igen';
          J.sige(f.igen, function () { setTimeout(vis, 250); });
        }
      }
    };
  }

  /* ================= flest: tryk paa den bunke, der er flest i ================= */

  function flest(f, dag, J, faerdig) {
    var tid = 0, r = 0, laast = false, glad = { venstre: 0, hoejre: 0 }, ryst = { venstre: { ryst: 0 }, hoejre: { ryst: 0 } };
    var figurer = (dag.moeder || []).filter(function (n) { return n !== 'sanne'; });
    J.sige(f.spoerg);
    function maal(R) {
      var W = J.W(), H = J.H();
      var raekker = Math.max(R.bunker.venstre.length ? -R.bunker.venstre[R.bunker.venstre.length - 1].y / 0.86 : 0, R.bunker.hoejre.length ? -R.bunker.hoejre[R.bunker.hoejre.length - 1].y / 0.86 : 0) + 1;
      var bred = Math.max.apply(null, R.bunker.venstre.concat(R.bunker.hoejre).map(function (p) { return Math.abs(p.x); })) * 2 + 1;
      var u = Math.min(W * 0.27 / bred, H * 0.46 / (raekker * 0.86 + 0.3), 120);
      return { u: u, y0: H * 0.78, cx: { venstre: W * 0.31, hoejre: W * 0.69 } };
    }
    return {
      info: function () { var R = f.runder[r]; return R ? { flest: R.flest, laast: laast, x: R.flest === 'venstre' ? J.W() * 0.28 : J.W() * 0.72, y: J.H() * 0.7, xForkert: R.flest === 'venstre' ? J.W() * 0.72 : J.W() * 0.28 } : null; },
      gentag: function () { J.sige(f.spoerg); },
      opdater: function (dt) { tid += dt; ned(glad, 'venstre', dt, 0.6); ned(glad, 'hoejre', dt, 0.6); ned(ryst.venstre, 'ryst', dt); ned(ryst.hoejre, 'ryst', dt); },
      tegn: function (c, W, H) {
        var R = f.runder[r]; if (!R) return;
        var m = maal(R);
        c.fillStyle = 'rgba(251,247,240,.9)'; c.beginPath(); c.ellipse(W / 2, m.y0 + 10, W * 0.48, H * 0.1, 0, 0, 7); c.fill();
        ['venstre', 'hoejre'].forEach(function (side, si) {
          var cx = m.cx[side] + rystX(ryst[side]);
          if (figurer.length === 2) M.figur(c, figurer[si], si ? W * 0.92 : W * 0.08, m.y0 - 4, H * 0.28, { spejl: si === 1 });
          if (glad[side] > 0) {
            var g = c.createRadialGradient(cx, m.y0 - m.u, 4, cx, m.y0 - m.u, m.u * 3);
            g.addColorStop(0, 'rgba(240,196,106,' + (0.6 * glad[side]) + ')'); g.addColorStop(1, 'rgba(240,196,106,0)');
            c.fillStyle = g; c.beginPath(); c.arc(cx, m.y0 - m.u, m.u * 3, 0, 7); c.fill();
          }
          R.bunker[side].forEach(function (p, i) { M.ting(c, R.ting, cx + p.x * m.u, m.y0 - m.u * 0.5 + p.y * m.u, m.u * 1.02, i, tid); });
        });
      },
      ned: function (x, y) {
        var H = J.H(), W = J.W(), R = f.runder[r];
        if (laast || !R || y < H * 0.16) return;
        var side = x < W / 2 ? 'venstre' : 'hoejre';
        if (side === R.flest) {
          laast = true; glad[side] = 1;
          J.melodi([660, 880, 1100], 90);
          var m = maal(R); J.fest(m.cx[side], m.y0 - m.u, 22, 220, 'gnist');
          J.sige(R.svar, function () {
            setTimeout(function () { r++; laast = false; if (r >= f.runder.length) faerdig(); else J.sige(f.spoerg); }, 800);
          });
        } else {
          ryst[side].ryst = 1; J.dunk();
          J.sige(f.spoerg);
        }
      }
    };
  }

  /* ================= spor: tegn bogstavet med fingeren (Bogstavvejens streger og sporing) ================= */

  function spor(f, dag, J, faerdig) {
    var glyf = window.Glyffer.GLYFFER[f.glyf], sp = new window.Spor(glyf, 14);
    var tid = 0, finger = null, jubel = 0, hint = 0, slut = false, sidsteNode = -1;
    var SKALA = [262, 294, 330, 349, 392, 440, 494, 523, 587];
    J.sige(f.spoerg);
    function kasse() { var W = J.W(), H = J.H(), s = Math.min(W * 0.5, H * 0.7); return { x: (W - s) / 2, y: (H - s) / 2 + 14, s: s }; }
    function iKasse(x, y) { var k = kasse(); return [(x - k.x) / k.s * 100, (y - k.y) / k.s * 100]; }
    function streg(c, k, punkter, til, farve, bredde) {
      if (til < 1) return;
      c.beginPath(); c.moveTo(k.x + punkter[0][0] * k.s / 100, k.y + punkter[0][1] * k.s / 100);
      for (var i = 1; i <= til; i++) c.lineTo(k.x + punkter[i][0] * k.s / 100, k.y + punkter[i][1] * k.s / 100);
      c.strokeStyle = farve; c.lineWidth = bredde * k.s / 100; c.stroke();
    }
    return {
      info: function () { var k = kasse(); return { slut: slut, streger: sp.streger.map(function (st) { return st.map(function (q) { return [k.x + q[0] * k.s / 100, k.y + q[1] * k.s / 100]; }); }) }; },
      gentag: function () { J.sige(slut ? f.slut : f.spoerg); },
      opdater: function (dt) { tid += dt; hint = (hint + dt * 0.35) % 1; if (jubel > 0) jubel = Math.max(0, jubel - dt); },
      tegn: function (c) {
        var k = kasse(), pad = k.s * 0.08;
        c.save(); c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
        M.rr(c, k.x - pad, k.y - pad, k.s + 2 * pad, k.s + 2 * pad, 30, '#fffaf0'); c.restore();
        c.save();
        if (jubel > 0) { c.translate(k.x + k.s / 2, k.y + k.s / 2); c.rotate(Math.sin(jubel * 14) * 0.07); c.translate(-k.x - k.s / 2, -k.y - k.s / 2); }
        c.lineCap = 'round'; c.lineJoin = 'round';
        // Skabelonen: et blegt, bredt stroeg
        sp.streger.forEach(function (st) { streg(c, k, st, st.length - 1, 'rgba(94,74,58,.08)', 17); streg(c, k, st, st.length - 1, '#e7ddc8', 13); streg(c, k, st, st.length - 1, '#f0e8d8', 8); });
        // Det, der er tegnet
        sp.streger.forEach(function (st, i) {
          var til = sp.faerdig || i < sp.aktiv ? st.length - 1 : i === sp.aktiv ? sp.indeks : 0;
          streg(c, k, st, til, sp.faerdig ? GUL : '#e08a52', 13);
        });
        c.restore();
        if (sp.faerdig) return;
        var st = sp.streger[sp.aktiv], sk = k.s / 100;
        // Fingerhjaelp: en prik, der loeber langs resten af stregen
        var rest = st.length - 1 - sp.indeks;
        if (rest > 0) {
          var hp = st[sp.indeks + Math.floor(hint * rest)];
          c.fillStyle = 'rgba(255,255,255,.9)'; c.strokeStyle = KANT; c.lineWidth = 2;
          c.beginPath(); c.arc(k.x + hp[0] * sk, k.y + hp[1] * sk, 4.5 * sk, 0, 7); c.fill(); c.stroke();
        }
        // Maalflaget for enden af stregen
        var sl = st[st.length - 1];
        c.save(); c.translate(k.x + sl[0] * sk, k.y + sl[1] * sk);
        c.strokeStyle = KANT; c.lineWidth = 2; c.beginPath(); c.moveTo(0, 0); c.lineTo(0, -14 * sk); c.stroke();
        for (var rr = 0; rr < 2; rr++) for (var kk = 0; kk < 3; kk++) { c.fillStyle = (rr + kk) % 2 ? KANT : PAPIR; c.fillRect(kk * 3 * sk, -14 * sk + rr * 3 * sk, 3 * sk, 3 * sk); }
        c.restore();
        // Her tager man fat: en groen ring, der pulserer
        var np = sp.naeste(), puls = sp.holder ? 1 : 1 + Math.sin(tid * 5) * 0.12;
        var g = c.createRadialGradient(k.x + np[0] * sk, k.y + np[1] * sk, 2, k.x + np[0] * sk, k.y + np[1] * sk, 12 * sk * puls);
        g.addColorStop(0, 'rgba(143,174,134,.75)'); g.addColorStop(0.7, 'rgba(143,174,134,.45)'); g.addColorStop(1, 'rgba(143,174,134,0)');
        c.fillStyle = g; c.beginPath(); c.arc(k.x + np[0] * sk, k.y + np[1] * sk, 12 * sk * puls, 0, 7); c.fill();
        c.fillStyle = GUL; c.strokeStyle = KANT; c.lineWidth = 2.5; c.beginPath(); c.arc(k.x + np[0] * sk, k.y + np[1] * sk, 5 * sk, 0, 7); c.fill(); c.stroke();
      },
      ned: function (x, y, id) {
        if (slut || finger !== null) return;
        finger = id;
        var p = iKasse(x, y);
        if (sp.start(p[0], p[1])) J.tone(440, 0.06, 0.06);
      },
      flyt: function (x, y, id) {
        if (id !== finger || slut) return;
        var p = iKasse(x, y), foer = sp.andel(), aktivFoer = sp.aktiv;
        if (sp.holder) sp.flyt(p[0], p[1]); else sp.start(p[0], p[1]);
        if (sp.andel() > foer && !sp.faerdig) {
          var st = sp.streger[sp.aktiv], andel = sp.aktiv > aktivFoer ? 1 : sp.indeks / (st.length - 1), node = Math.floor(andel * 8);
          if (node !== sidsteNode) { sidsteNode = node; J.tone(SKALA[Math.min(8, node)], 0.18, 0.1); }
          if (sp.aktiv > aktivFoer) sidsteNode = -1;
        }
        if (sp.faerdig) {
          slut = true; jubel = 2.2;
          J.melodi([660, 880, 1100, 1320], 90);
          var k = kasse(); J.fest(k.x + k.s / 2, k.y + k.s / 2, 40, 300);
          setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 700); }); }, 500);
        }
      },
      op: function (x, y, id) { if (id === finger) { finger = null; sp.slip(); } }
    };
  }

  /* ================= forlyd og rim: tre kort med billeder og ordklip ================= */

  function kortleg(type) {
    return function (f, dag, J, faerdig) {
      var tid = 0, r = 0, kortene = [], laast = false;
      function runde() {
        var R = f.runder[r];
        kortene = bland(R.kort).map(function (o) { return { ord: o, rigtig: o === R.rigtig, ryst: 0, glad: 0, info: O.ord(o) }; });
        kortene.forEach(function (k) { if (k.info) M.hent(k.info.billede); });
        if (type === 'rim') M.hent(O.ord(R.ord).billede);
        laast = false;
        spoerg();
      }
      function spoerg() {
        if (type === 'rim') J.raekke([{ ord: f.runder[r].ord }, f.spoerg]);   // "Her har du ordet kat." "Hvad rimer på det?"
        else J.sige(f.spoerg);                                                  // "Hvad starter med J, ligesom jul?"
      }
      function layout() {
        var W = J.W(), H = J.H(), s = Math.min(W * 0.25, H * 0.4, 240), y = Math.min(H - s / 2 - 30, skyFelt(W, H).y + skyFelt(W, H).h * 0.6 + s / 2 + 30);
        return kortene.map(function (k, i) { return { x: W / 2 + (i - (kortene.length - 1) / 2) * s * 1.22, y: y, s: s }; });
      }
      setTimeout(runde, 300);
      return {
        info: function () { var L = layout(); return { laast: laast, r: r, kort: kortene.map(function (k, i) { return { ord: k.ord, rigtig: k.rigtig, x: L[i].x, y: L[i].y }; }) }; },
        gentag: spoerg,
        opdater: function (dt) { tid += dt; kortene.forEach(function (k) { ned(k, 'ryst', dt); }); },
        tegn: function (c, W, H) {
          var S = skyFelt(W, H);
          sky(c, S.x, S.y, S.b, S.h);
          if (type === 'forlyd') {
            c.fillStyle = KANT; c.font = '800 ' + Math.round(S.h * 0.62) + 'px ' + SKRIFT; c.textAlign = 'center'; c.textBaseline = 'middle';
            c.fillText(f.lyd, S.x, S.y + S.h * 0.06);
          } else if (f.runder[r]) {
            var o = O.ord(f.runder[r].ord), i = M.hent(o.billede), s = S.h * 0.66;
            if (M.klar(o.billede)) { var k2 = Math.min(s / i.naturalWidth, s / i.naturalHeight); c.drawImage(i, S.x - i.naturalWidth * k2 / 2, S.y + S.h * 0.04 - i.naturalHeight * k2 / 2, i.naturalWidth * k2, i.naturalHeight * k2); }
          }
          var L = layout();
          kortene.forEach(function (k, i) { kort(c, L[i].x + rystX(k), L[i].y - k.glad * 10, L[i].s, k.info && k.info.billede, k.glad, tid); });
        },
        ned: function (x, y) {
          var W = J.W(), H = J.H();
          if (iSky(skyFelt(W, H), x, y)) { if (!laast) spoerg(); return; }
          if (laast) return;
          var L = layout();
          var i = -1;
          L.forEach(function (p, n) { if (Math.abs(x - p.x) < p.s * 0.55 && Math.abs(y - p.y) < p.s * 0.55) i = n; });
          if (i < 0) return;
          var k = kortene[i];
          if (k.rigtig) {
            laast = true; k.glad = 1;
            J.klip(k.ord, function () {
              J.melodi([660, 880, 1100], 90); J.fest(L[i].x, L[i].y, 22, 220, 'gnist');
              J.sige(f.rigtigTekst, function () { setTimeout(function () { r++; if (r >= f.runder.length) faerdig(); else runde(); }, 700); });
            });
          } else {
            k.ryst = 1; J.dunk();
            J.klip(k.ord, function () { setTimeout(function () { if (!laast) spoerg(); }, 300); });
          }
        }
      };
    };
  }

  /* ================= klap: klap stavelserne paa trommen, som i Rimhulen ================= */

  /** Trommen: krop af trae, snoer i zigzag og et skind. Forenklet efter Rimhulens tegnTromme. */
  function tromme(c, x, top, bund, rb, rh) {
    var PI = Math.PI, farve = '#d95f45';
    function krop() { c.beginPath(); c.ellipse(x, bund, rb, rh, 0, 0, PI); c.lineTo(x - rb, top); c.ellipse(x, top, rb, rh, 0, PI, 0, true); c.closePath(); }
    c.save(); c.lineJoin = 'round';
    var kg = c.createLinearGradient(x - rb, 0, x + rb, 0);
    kg.addColorStop(0, M.tone(farve, 0.7)); kg.addColorStop(0.38, M.tone(farve, 1.15)); kg.addColorStop(1, M.tone(farve, 0.65));
    krop(); c.fillStyle = kg; c.fill();
    var bb = (bund - top) * 0.16;
    [top, bund - bb].forEach(function (y0) {
      c.beginPath(); c.ellipse(x, y0 + bb, rb, rh, 0, 0, PI); c.lineTo(x - rb, y0); c.ellipse(x, y0, rb, rh, 0, PI, 0, true); c.closePath();
      c.fillStyle = M.tone(farve, 0.72); c.fill();
    });
    c.beginPath();
    for (var n = 0; n <= 18; n++) {
      var a = 0.08 + n / 18 * (PI - 0.16), y = (n % 2 ? bund - bb * 0.55 : top + bb * 0.55) + Math.sin(a) * rh;
      if (n) c.lineTo(x + Math.cos(a) * rb, y); else c.moveTo(x + Math.cos(a) * rb, y);
    }
    c.strokeStyle = KANT; c.lineWidth = 5; c.stroke(); c.strokeStyle = PAPIR; c.lineWidth = 2.4; c.stroke();
    krop(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke();
    var sg = c.createRadialGradient(x - rb * 0.18, top - rh * 0.25, rb * 0.05, x, top, rb);
    sg.addColorStop(0, '#fffaf0'); sg.addColorStop(0.6, '#f8ecd2'); sg.addColorStop(1, '#e5d3ae');
    c.fillStyle = sg; c.beginPath(); c.ellipse(x, top, rb, rh, 0, 0, PI * 2); c.fill(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke();
    c.strokeStyle = 'rgba(94,74,58,.3)'; c.lineWidth = 2.5; c.beginPath(); c.ellipse(x, top, rb * 0.55, rh * 0.55, 0, 0, PI * 2); c.stroke();
    c.restore();
  }

  function klap(f, dag, J, faerdig) {
    var tid = 0, r = 0, antal = 0, ro = 0, faerdigR = false, vip = { ryst: 0 }, tryk = 0, glad = 0;
    function R() { return f.runder[r]; }
    function sigOrd() { J.raekke([{ ord: R().ord }, f.spoerg]); }      // "Her har du ordet kage." "Klap det på trommen."
    function layout() {
      var W = J.W(), H = J.H(), rb = Math.min(W * 0.2, 210, H * 0.24), rh = rb * 0.38, ty = H * 0.68;
      return { x: W / 2, y: ty, rb: rb, rh: rh, prikY: ty - rh * 1.3 - 52, prikR: Math.min(30, rb * 0.16), gab: Math.min(84, rb * 0.48) };
    }
    M.hent(O.ord(R().ord).billede);
    setTimeout(sigOrd, 300);
    return {
      info: function () { var l = layout(); return { r: r, stavelser: R() && R().stavelser, antal: antal, faerdig: faerdigR, x: l.x, y: l.y }; },
      gentag: sigOrd,
      opdater: function (dt) {
        tid += dt; ro += dt; ned(vip, 'ryst', dt, 1.4); if (tryk > 0) tryk = Math.max(0, tryk - dt); if (glad > 0) glad += dt;
        if (!faerdigR && R() && antal === R().stavelser && ro > 0.8) {
          faerdigR = true; glad = 0.001;
          J.melodi([660, 880, 1100], 90);
          var l = layout(); J.fest(l.x, l.prikY, 26, 240, 'gnist');
          J.sige(f.rigtigTekst, function () {
            setTimeout(function () {
              r++;
              if (r >= f.runder.length) { faerdig(); return; }
              antal = 0; ro = 0; faerdigR = false; glad = 0;
              M.hent(O.ord(R().ord).billede);
              sigOrd();
            }, 800);
          });
        }
      },
      tegn: function (c, W, H) {
        var o = R(); if (!o) return;
        var S = skyFelt(W, H), info = O.ord(o.ord), i = M.hent(info.billede), s = S.h * 0.66;
        sky(c, S.x, S.y, S.b, S.h);
        if (M.klar(info.billede)) { var k = Math.min(s / i.naturalWidth, s / i.naturalHeight); c.drawImage(i, S.x - i.naturalWidth * k / 2, S.y + S.h * 0.04 - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k); }
        var l = layout();
        for (var n = 0; n < o.stavelser; n++) {
          var px = l.x + (n - (o.stavelser - 1) / 2) * l.gab + rystX(vip), fyldt = n < antal || faerdigR;
          var puls = glad > 0 ? 1 + Math.max(0, Math.sin((glad * 4 - n * 0.8) * Math.PI)) * 0.25 : 1;
          c.beginPath(); c.arc(px, l.prikY, l.prikR * puls, 0, 7);
          c.fillStyle = fyldt ? GUL : 'rgba(248,241,230,.6)'; c.fill(); c.strokeStyle = KANT; c.lineWidth = 4; c.stroke();
        }
        var squash = tryk > 0 ? 1 - tryk * 0.5 : 1, ty = l.y + (1 - squash) * l.rh;
        c.fillStyle = 'rgba(94,74,58,.2)'; c.beginPath(); c.ellipse(l.x, l.y + l.rh * 1.9, l.rb * 1.05, l.rh * 0.6, 0, 0, 7); c.fill();
        tromme(c, l.x, ty, l.y + l.rh * 1.5, l.rb, l.rh);
      },
      ned: function (x, y) {
        var W = J.W(), H = J.H(), l = layout();
        if (iSky(skyFelt(W, H), x, y)) { if (!faerdigR) sigOrd(); return; }
        if (faerdigR) return;
        var dx = (x - l.x) / (l.rb * 1.2), dy = (y - l.y - l.rh * 0.6) / (l.rh * 2.8);
        if (dx * dx + dy * dy > 1) return;
        antal++; tryk = 0.25; ro = 0;
        J.tone(150, 0.28, 0.4, 'sine'); J.tone(95, 0.16, 0.25, 'triangle');
        if (antal > R().stavelser) {     // én for meget: forfra, uden straf, prikkerne vipper bare
          antal = 0; vip.ryst = 0.8;
          J.melodi([330, 262], 110);
          setTimeout(function () { if (!faerdigR) sigOrd(); }, 900);
        }
      }
    };
  }

  /* ================= pynt: traek pynt op paa juletraeet, frit ================= */

  function pynt(f, dag, J, faerdig) {
    var tid = 0, haengt = [], holdt = {}, falder = [], slut = false, knap = 0;
    var SLAGS = [{ t: 'kugle', f: 0 }, { t: 'kugle', f: 1 }, { t: 'stjerne' }, { t: 'kugle', f: 2 }, { t: 'lys' }, { t: 'kugle', f: 3 }, { t: 'klokke' }];
    J.sige(f.spoerg);
    function trae() { var W = J.W(), H = J.H(), top = H * 0.05, bund = H * 0.8; return { x: W / 2, top: top, bund: bund, b: (bund - top) * 0.72 }; }
    function bakke() {
      var W = J.W(), H = J.H(), s = Math.min(70, H * 0.1, (W - 200) / (SLAGS.length * 1.5));
      return SLAGS.map(function (sl, i) { return { sl: sl, x: W / 2 + (i - (SLAGS.length - 1) / 2) * s * 1.5, y: H - s * 0.75 - 14, s: s }; });
    }
    function paaTraeet(x, y) {
      var T = trae(), h = T.bund - T.top, u = (y - T.top) / h;
      if (u < 0.04 || u > 0.88) return false;
      return Math.abs(x - T.x) < T.b / 2 * (u / 0.9) * 0.98;
    }
    function knapPlads() { var W = J.W(), H = J.H(), r = Math.min(46, H * 0.07); return { x: W - r - 26, y: H - r - 26, r: r }; }
    function tegnPynt(c, sl, x, y, s) {
      if (sl.t === 'kugle') M.julekugle(c, x, y, s * 0.36, M.KUGLEFARVER[sl.f]);
      else if (sl.t === 'stjerne') M.stjerne(c, x, y, s * 0.42);
      else if (sl.t === 'lys') M.lys(c, x, y, s * 0.75, tid);
      else M.ting(c, 'klokke', x, y, s * 0.8);
    }
    function faerdigNu() {
      if (slut) return;
      slut = true;
      J.melodi([523, 659, 784, 1047], 100);
      var T = trae(); J.fest(T.x, (T.top + T.bund) / 2, 40, 300);
      J.sige(f.slut, function () { setTimeout(faerdig, 600); });
    }
    return {
      info: function () { var T = trae(); return { haengt: haengt.length, knap: knap > 0 ? knapPlads() : null, bakke: bakke().map(function (b) { return { x: b.x, y: b.y }; }), trae: T }; },
      gentag: function () { J.sige(f.spoerg); },
      opdater: function (dt) {
        tid += dt;
        if (knap > 0) knap = Math.min(1, knap + dt * 3);
        for (var i = falder.length - 1; i >= 0; i--) { falder[i].t += dt * 2.5; if (falder[i].t >= 1) falder.splice(i, 1); }
      },
      tegn: function (c, W, H) {
        var T = trae(), h = T.bund - T.top;
        M.juletrae(c, T.x, T.top, T.bund, T.b, false, tid);
        haengt.forEach(function (p) { tegnPynt(c, p.sl, T.x + p.u * T.b, T.top + p.v * h, p.s); });
        var B = bakke();
        M.rr(c, B[0].x - B[0].s, B[0].y - B[0].s * 0.75, B[B.length - 1].x - B[0].x + B[0].s * 2, B[0].s * 1.5, 22, 'rgba(248,241,230,.92)');
        B.forEach(function (b) { tegnPynt(c, b.sl, b.x, b.y, b.s); });
        falder.forEach(function (p) {
          var e = p.t * p.t; tegnPynt(c, p.sl, p.x + (p.tx - p.x) * e, p.y + (p.ty - p.y) * e, p.s);
        });
        Object.keys(holdt).forEach(function (id) { var p = holdt[id]; tegnPynt(c, p.sl, p.x, p.y, p.s * 1.15); });
        if (knap > 0 && !slut) { var K = knapPlads(); flueben(c, K.x, K.y, K.r, knap * (1 + Math.sin(tid * 4) * 0.05)); }
      },
      ned: function (x, y, id) {
        if (slut) return;
        if (knap > 0) { var K = knapPlads(); if (Math.hypot(x - K.x, y - K.y) < K.r + 10) { faerdigNu(); return; } }
        var b = bakke().filter(function (q) { return Math.hypot(x - q.x, y - q.y) < q.s * 0.7; })[0];
        if (!b) return;
        holdt[id] = { sl: b.sl, x: x, y: y, s: b.s, fra: b };
        J.tone(520, 0.08, 0.08);
      },
      flyt: function (x, y, id) { var p = holdt[id]; if (p) { p.x = x; p.y = y; } },
      op: function (x, y, id) {
        var p = holdt[id]; if (!p) return;
        delete holdt[id];
        var T = trae(), h = T.bund - T.top;
        if (p.sl.t === 'stjerne' && Math.hypot(p.x - T.x, p.y - T.top) < h * 0.12) { p.x = T.x; p.y = T.top + h * 0.01; }
        if ((p.x === T.x && p.sl.t === 'stjerne') || paaTraeet(p.x, p.y)) {
          haengt.push({ sl: p.sl, u: (p.x - T.x) / T.b, v: (p.y - T.top) / h, s: p.s });
          J.tone(700 + (haengt.length % 6) * 70, 0.14, 0.1);
          J.fest(p.x, p.y, 8, 110, 'gnist');
          if (haengt.length >= f.mindst && knap === 0) { knap = 0.001; J.melodi([784, 988], 90); }
        } else {
          falder.push({ sl: p.sl, x: p.x, y: p.y, tx: p.fra.x, ty: p.fra.y, s: p.s, t: 0 });
        }
      }
    };
  }

  /* ================= venner: vennerne kommer én ad gangen; tryk og tael ================= */

  function venner(f, dag, J, faerdig) {
    var tid = 0, aktiv = -1, talt = 0, slut = false;
    var liste = f.venner.map(function (n, i) { return { navn: n, nr: i, fase: 'vent', t: 0, x: 0, y: 0, talt: 0 }; });
    /*
     * Pladserne om traeet: forreste raekke (de foerste, der kommer) fra midten og
     * ud, skiftevis til venstre og hoejre, saa bagerste raekke, uden om traeet.
     */
    var forrest = Math.ceil(liste.length * 8 / 14);
    function plads(v) {
      var W = J.W(), H = J.H(), i = v.nr, bag = i >= forrest, j = bag ? i - forrest : i, n = bag ? liste.length - forrest : forrest;
      var side = j % 2 ? 1 : -1, trin = Math.floor(j / 2), antal = Math.ceil(n / 2);
      var inde = bag ? 0.19 : 0.14, ude = bag ? 0.41 : 0.44, afst = inde + (antal > 1 ? trin * (ude - inde) / (antal - 1) : 0);
      return { x: W / 2 + side * afst * W, y: bag ? H * 0.66 : H * 0.86, bag: bag };
    }
    function hoejde(v) { return J.H() * (v.fase === 'staar' && plads(v).bag ? 0.17 : 0.21); }
    function vent() { var W = J.W(), H = J.H(); return { x: W / 2, y: H * 0.96 }; }
    function naeste() {
      aktiv++;
      if (aktiv >= liste.length) return;
      var v = liste[aktiv], W = J.W();
      v.fase = 'ind'; v.t = 0; v.fraX = aktiv % 2 ? W + 90 : -90; v.x = v.fraX; v.y = vent().y;
      J.tone(392, 0.12, 0.06);
    }
    J.sige(f.spoerg, function () { setTimeout(naeste, 300); });
    return {
      info: function () { var v = liste[aktiv]; return { aktiv: aktiv, talt: talt, fase: v && v.fase, x: v && v.x, y: v && v.y - hoejde(v) * 0.5 }; },
      gentag: function () { J.sige(f.spoerg); },
      opdater: function (dt) {
        tid += dt;
        liste.forEach(function (v) {
          v.t += dt;
          var V = vent(), P2 = plads(v);
          if (v.fase === 'ind') { var e = Math.min(1, v.t / 1.4); v.x = v.fraX + (V.x - v.fraX) * (1 - Math.pow(1 - e, 2)); v.y = V.y; if (e >= 1) v.fase = 'klar'; }
          else if (v.fase === 'klar') { v.x = V.x; v.y = V.y; }
          else if (v.fase === 'talt') { var u = Math.min(1, v.t / 1.1); v.x = V.x + (P2.x - V.x) * u; v.y = V.y + (P2.y - V.y) * u; if (u >= 1) v.fase = 'staar'; }
          else if (v.fase === 'staar') { v.x = P2.x; v.y = P2.y; }
        });
      },
      tegn: function (c, W, H) {
        c.fillStyle = 'rgba(251,247,240,.92)'; c.beginPath(); c.ellipse(W / 2, H * 0.84, W * 0.52, H * 0.2, 0, 0, 7); c.fill();
        M.juletrae(c, W / 2, H * 0.08, H * 0.66, H * 0.42, true, tid);
        liste.filter(function (v) { return v.fase !== 'vent'; }).sort(function (a, b) { return a.y - b.y; }).forEach(function (v) {
          var h = hoejde(v), bob = v.fase === 'ind' || v.fase === 'talt' ? Math.abs(Math.sin(v.t * 9)) * h * 0.05 : 0;
          if (v.fase === 'klar') {
            var g = c.createRadialGradient(v.x, v.y - h * 0.4, 4, v.x, v.y - h * 0.4, h * 0.75);
            g.addColorStop(0, 'rgba(240,196,106,' + (0.45 + 0.25 * Math.sin(tid * 4)) + ')'); g.addColorStop(1, 'rgba(240,196,106,0)');
            c.fillStyle = g; c.beginPath(); c.arc(v.x, v.y - h * 0.4, h * 0.75, 0, 7); c.fill();
          }
          M.figur(c, v.navn, v.x, v.y - bob, h, { spejl: v.x > W / 2 });
          var top = v.navn === 'klaus' || v.navn === 'klara' ? h * 0.62 : h;
          if (v.talt) talMaerke(c, v.x, v.y - top - 14, v.talt, Math.max(13, h * 0.09));
        });
      },
      ned: function (x, y) {
        if (slut || aktiv < 0 || aktiv >= liste.length) return;
        var v = liste[aktiv];
        if (v.fase !== 'klar' && v.fase !== 'ind') return;
        var h = hoejde(v);
        if (Math.abs(x - v.x) > h * 0.45 || y < v.y - h * 1.1 || y > v.y + 20) return;
        talt++; v.talt = talt; v.fase = 'talt'; v.t = 0;
        J.tone(420 + talt * 40, 0.16, 0.12);
        J.fest(v.x, v.y - h * 0.5, 10, 140, 'gnist');
        if (talt < liste.length) { J.sige(O.tal(talt)); setTimeout(naeste, 700); return; }
        slut = true;
        J.sige(O.tal(talt), function () { setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 500); }); }, 500); });
      }
    };
  }

  /* ================= puslespil: den sidste brik traekkes paa plads ================= */

  function puslespil(f, dag, J, faerdig) {
    var tid = 0, glans = 0;
    // De loese brikker ligger ude i siderne, skiftevis til hoejre og venstre for braettet
    var steder = [[6.35, 1.4], [-1.35, 1.4], [6.35, 2.8], [-1.35, 2.8], [6.35, 0], [-1.35, 0]];
    var spil = P.nytSpil(f.loese, steder);
    J.sige(f.spoerg);
    function braet() {
      var W = J.W(), H = J.H(), cb = Math.min((W - 60) / 9.6, (H - 70) / (4 * CELLE + 0.5)), ch = cb * CELLE;
      return { x: (W - 6 * cb) / 2, y: (H - 4 * ch) / 2 + 10, cb: cb, ch: ch };
    }
    function celle(x, y) { var B = braet(); return [(x - B.x) / B.cb, (y - B.y) / B.ch]; }
    return {
      info: function () { var B = braet(); return { faerdig: spil.faerdig, loese: spil.brikker.filter(function (b) { return !b.paa; }).map(function (b) { return { x: B.x + (b.x + 0.5) * B.cb, y: B.y + (b.y + 0.5) * B.ch, mx: B.x + (b.kol + 0.5) * B.cb, my: B.y + (b.raek + 0.5) * B.ch }; }) }; },
      gentag: function () { J.sige(spil.faerdig ? f.slut : f.spoerg); },
      opdater: function (dt) { tid += dt; if (glans > 0) glans = Math.min(1, glans + dt * 0.8); },
      tegn: function (c, W, H) {
        var B = braet(), fr = Math.max(10, B.cb * 0.22), motivB = J.motivKilde();
        c.save(); c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
        M.rr(c, B.x - fr, B.y - fr, B.cb * 6 + 2 * fr, B.ch * 4 + 2 * fr, fr * 1.2, '#b18a56'); c.restore();
        M.rr(c, B.x - 3, B.y - 3, B.cb * 6 + 6, B.ch * 4 + 6, 6, '#8a663d');
        M.rr(c, B.x, B.y, B.cb * 6, B.ch * 4, 4, '#efe3d0');
        spil.brikker.forEach(function (br) {
          if (br.paa) return;
          c.save(); c.translate(B.x + br.kol * B.cb, B.y + br.raek * B.ch);
          M.brikSti(c, br, B.cb, B.ch); c.setLineDash([6, 6]);
          c.strokeStyle = 'rgba(240,196,106,' + (0.6 + 0.4 * Math.sin(tid * 3)) + ')'; c.lineWidth = 3; c.stroke();
          c.restore();
        });
        spil.raekkefoelge.forEach(function (br) {
          var holdt = br.holdtAf !== null, k = holdt ? 1.08 : 1;
          c.save();
          c.translate(B.x + (br.x + 0.5) * B.cb, B.y + (br.y + 0.5) * B.ch); c.scale(k, k); c.translate(-B.cb / 2, -B.ch / 2);
          if (holdt || !br.paa) { c.shadowColor = 'rgba(94,74,58,.35)'; c.shadowBlur = holdt ? 18 : 10; c.shadowOffsetY = holdt ? 10 : 5; }
          M.brik(c, br, B.cb, B.ch, motivB, br.paa && !glans ? null : tid + br.dag * 0.3, !br.paa ? 0.8 : glans);
          c.restore();
        });
        if (glans > 0) {
          // Billedet lyser op, og gnisterne danser hen over det
          var g = c.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, B.cb * 5);
          g.addColorStop(0, 'rgba(251,227,168,' + (0.35 * glans) + ')'); g.addColorStop(1, 'rgba(251,227,168,0)');
          c.fillStyle = g; c.fillRect(B.x, B.y, B.cb * 6, B.ch * 4);
          for (var i = 0; i < 18; i++) {
            var gx = B.x + ((i * 0.37 + tid * 0.05 * (1 + i % 3)) % 1) * B.cb * 6, gy = B.y + ((i * 0.61) % 1) * B.ch * 4;
            M.gnist(c, gx, gy, B.cb * 0.12, glans * (0.5 + 0.5 * Math.sin(tid * 4 + i)));
          }
        }
      },
      ned: function (x, y, id) {
        if (spil.faerdig) return;
        var p = celle(x, y);
        if (P.tag(spil, p[0], p[1], id)) J.tone(520, 0.08, 0.08);
      },
      flyt: function (x, y, id) { var p = celle(x, y); P.flyt(spil, p[0], p[1], id); },
      op: function (x, y, id) {
        if (!P.slip(spil, id)) return;
        var B = braet(), br = spil.netopPaa;
        J.klik(); J.fest(B.x + (br.kol + 0.5) * B.cb, B.y + (br.raek + 0.5) * B.ch, 30, 240, 'gnist');
        if (!spil.faerdig) return;
        glans = 0.001;
        J.melodi([523, 659, 784, 1047, 1319, 1568], 120);
        setTimeout(function () { J.fest(J.W() / 2, J.H() / 2, 60, 380, 'gnist'); }, 400);
        J.sige(f.slut, function () { setTimeout(faerdig, 1200); });
      }
    };
  }

  window.JulLege = {
    tael: tael, se: se, flest: flest, spor: spor, forlyd: kortleg('forlyd'), rim: kortleg('rim'),
    klap: klap, pynt: pynt, venner: venner, puslespil: puslespil
  };
})();
