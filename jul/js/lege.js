/**
 * Pelles julekalender: opgavernes skaerme.
 *
 * Reglerne og alt, der siges, kommer fra opgaver.js (Opgaver.forbered og
 * Opgaver.runde); her er kun tegningen og trykkene. Dagens opgave er en raekke
 * dele (f.dele), let foerst og saa svaerere. serie() viser dem én ad gangen:
 * en lille fejring efter hver del (en melodi, konfetti og en stjerne i raekken
 * af prikker til hoejre), og til sidst den store fejring i game.js. Under
 * hoejttaleren sidder en pil frem, saa en voksen kan springe en del over.
 *
 * Hver del har sin skaerm: en funktion (del, dag, J, faerdig), der svarer med
 * { tegn, opdater, ned, flyt, op, gentag, info }. J er hjaelperne fra game.js:
 * sige, klip (ordklippene), raekke, tone, fest ... serie() giver hver del sin
 * egen vagt om J, saa en del, der er sprunget over, aldrig taler igen.
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

  var M = window.Maleri, O = window.Opgaver, P = window.Puslespil, T = O.TEKST;
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
  function klem(v) { return Math.max(0, Math.min(1, v)); }
  function blød(v) { v = klem(v); return 1 - Math.pow(1 - v, 3); }

  /** Et kort af papir med et billede, som i Rimhulen. */
  function kort(c, x, y, s, billede, glad) {
    c.save();
    if (glad > 0) {
      c.shadowColor = 'rgba(240,196,106,.9)'; c.shadowBlur = 26;
      M.rr(c, x - s / 2 - 6, y - s / 2 - 6, s + 12, s + 12, s * 0.16, 'rgba(240,196,106,' + (0.5 + 0.3 * glad) + ')');
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
  /** Et bogstav, stort og lille, som paa skolens bogstavkort: "Kk". */
  function bogstavTekst(c, b, x, y, h) {
    c.fillStyle = KANT; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.font = '800 ' + Math.round(h) + 'px ' + SKRIFT;
    c.fillText(b + b.toLowerCase(), x, y + h * 0.04);
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
  function tegnOrdISky(c, S, o) {
    var info = O.ord(o), i = M.hent(info.billede), s = S.h * 0.66;
    if (M.klar(info.billede)) { var k = Math.min(s / i.naturalWidth, s / i.naturalHeight); c.drawImage(i, S.x - i.naturalWidth * k / 2, S.y + S.h * 0.04 - i.naturalHeight * k / 2, i.naturalWidth * k, i.naturalHeight * k); }
  }

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
  /** Pilen frem (til den voksne): spring denne del over. Samme pil som i historien. */
  function pilFrem(c, x, y, r) {
    c.save();
    c.fillStyle = PAPIR; c.shadowColor = 'rgba(107,85,68,.25)'; c.shadowBlur = 10; c.shadowOffsetY = 4;
    c.beginPath(); c.arc(x, y, r, 0, 7); c.fill(); c.shadowColor = 'transparent';
    c.strokeStyle = '#6b5545'; c.lineWidth = Math.max(3, r * 0.17); c.lineCap = 'round'; c.lineJoin = 'round';
    c.beginPath(); c.moveTo(x - r * 0.45, y); c.lineTo(x + r * 0.35, y); c.stroke();
    c.beginPath(); c.moveTo(x + r * 0.02, y - r * 0.36); c.lineTo(x + r * 0.4, y); c.lineTo(x + r * 0.02, y + r * 0.36); c.stroke();
    c.restore();
  }
  /** Pynten paa guirlanden og traeet: { t: 'kugle' | 'stjerne' | 'lys' | 'klokke', f: kuglens farve }. */
  function tegnPynt(c, sl, x, y, s, tid) {
    if (sl.t === 'kugle') M.julekugle(c, x, y, s * 0.36, M.KUGLEFARVER[sl.f]);
    else if (sl.t === 'stjerne') M.stjerne(c, x, y, s * 0.42);
    else if (sl.t === 'lys') M.lys(c, x, y, s * 0.75, tid);
    else M.ting(c, 'klokke', x, y, s * 0.8);
  }

  /* ================= talraekken: svaret gives ved at trykke paa et tal ================= */

  /**
   * Tallene 1..max i en raekke forneden, med smaa prikker under (til ti), saa
   * man ogsaa kan taelle sig frem. Over ti: to raekker, 1-10 og 11-20.
   */
  function talraekke(max) {
    var knapper = [];
    for (var n = 1; n <= max; n++) knapper.push({ n: n, ryst: 0 });
    var TR = { knapper: knapper, valgt: null, aktiv: false, synlig: 1 };
    TR.layout = function (W, H) {
      var to = max > 10, pr = to ? 10 : max;
      var r = Math.min(to ? 33 : 40, (W - 160) / (pr * 2.3)), gab = r * 2.3, x0 = W / 2 - (pr - 1) * gab / 2;
      var yB = H - r - 20, yA = to ? yB - r * 2.45 : yB;
      return { r: r, top: yA - r - 14, pos: function (k) { return { x: x0 + ((k - 1) % 10) * gab, y: to && k <= 10 ? yA : yB }; } };
    };
    TR.opdater = function (dt) { knapper.forEach(function (k) { ned(k, 'ryst', dt); }); };
    TR.tegn = function (c, W, H) {
      var L = TR.layout(W, H);
      knapper.forEach(function (k) {
        var p = L.pos(k.n), x = p.x + rystX(k), y = p.y;
        c.save(); c.globalAlpha = (TR.aktiv || TR.valgt === k.n ? 1 : 0.5) * TR.synlig;
        c.shadowColor = 'rgba(107,85,68,.2)'; c.shadowBlur = 8; c.shadowOffsetY = 5;
        c.fillStyle = TR.valgt === k.n ? GUL : PAPIR; c.beginPath(); c.arc(x, y, L.r, 0, 7); c.fill();
        c.shadowColor = 'transparent';
        c.fillStyle = KANT; c.font = '800 ' + Math.round(L.r * (k.n > 9 ? 0.82 : 0.95)) + 'px ' + SKRIFT; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(k.n), x, y - (k.n <= 10 ? L.r * 0.08 : 0));
        if (k.n <= 10) {
          var pr = Math.max(1.6, L.r * 0.07);
          for (var q = 0; q < k.n; q++) { c.beginPath(); c.arc(x + ((q % 5) - Math.min(4, k.n - 1) / 2) * pr * 2.6, y + L.r * 0.5 + Math.floor(q / 5) * pr * 2.4, pr, 0, 7); c.fill(); }
        }
        c.restore();
      });
    };
    TR.find = function (x, y, W, H) {
      var L = TR.layout(W, H);
      return knapper.filter(function (k) { var p = L.pos(k.n); return Math.hypot(x - p.x, y - p.y) < L.r + 8; })[0] || null;
    };
    TR.info = function (W, H) { var L = TR.layout(W, H); return knapper.map(function (k) { var p = L.pos(k.n); return { n: k.n, x: p.x, y: p.y }; }); };
    return TR;
  }

  /* ================= felterne til tael (og regnestykkerne bagefter) ================= */

  /** Feltet, tingene ligger i: et juletrae (0.8 saa bredt som hoejt) eller et felt paa 4:3 over bund. */
  function taelFelt(J, pl, bund) {
    var W = J.W(), H = J.H(), top = 20;
    bund = bund || H - 20;
    var hh = bund - top;
    if (pl.trae) { var h = hh, b = h * 0.8; return { x: W / 2 - b / 2, y: top, b: b, h: h }; }
    var bb = Math.min(W - 210, hh * 4 / 3), bh = bb * 0.75;
    return { x: (W - bb) / 2, y: top + (hh - bh) / 2, b: bb, h: bh };
  }
  /** Det, tingene ligger paa: juletraeet, bagepladen, banen, nattehimlen eller sneen. */
  function tegnFeltBund(c, F, ting, trae, tid) {
    if (trae) { M.juletrae(c, F.x + F.b / 2, F.y + F.h * 0.04, F.y + F.h * 0.96, F.b * 0.8, false, tid); return; }
    c.save();
    if (ting === 'kage') {
      c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
      M.rr(c, F.x - 10, F.y, F.b + 20, F.h, 26, '#8a8478'); c.shadowColor = 'transparent';
      M.rr(c, F.x + 4, F.y + 14, F.b - 8, F.h - 28, 18, '#b8b2a4');
    } else if (ting === 'stjerne') {
      c.shadowColor = 'rgba(94,74,58,.28)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
      M.rr(c, F.x - 10, F.y - 10, F.b + 20, F.h + 20, 30, '#56688f'); c.shadowColor = 'transparent';
      M.rr(c, F.x - 2, F.y - 2, F.b + 4, F.h + 4, 24, '#6b7ba3');
    } else {
      c.fillStyle = 'rgba(251,247,240,.92)'; c.beginPath(); c.roundRect(F.x - 16, F.y - 10, F.b + 32, F.h + 20, 40); c.fill();
      c.fillStyle = 'rgba(143,199,232,.16)';
      for (var s = 0; s < 5; s++) { c.beginPath(); c.ellipse(F.x + F.b * (0.12 + s * 0.2), F.y + F.h * (0.25 + (s % 2) * 0.5), F.b * 0.1, F.h * 0.05, 0, 0, 7); c.fill(); }
      if (ting === 'gran') {
        c.strokeStyle = 'rgba(177,138,86,.3)'; c.lineWidth = F.h * 0.07; c.lineCap = 'round';
        c.beginPath(); c.moveTo(F.x, F.y + F.h * 0.25); c.bezierCurveTo(F.x + F.b * 0.4, F.y + F.h * 0.1, F.x + F.b * 0.6, F.y + F.h * 0.95, F.x + F.b, F.y + F.h * 0.7); c.stroke();
      }
    }
    c.restore();
  }

  /* ================= tael: tryk paa hver ting, stemmen taeller med ================= */

  function tael(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, slut = false;
    var ting = f.pladser.pos.map(function (p, i) { return { x: p.x, y: p.y, nr: i, talt: 0, ryst: 0, hop: 0 }; });
    function felt() { return taelFelt(J, f.pladser); }
    function plads(t, F) { return { x: F.x + t.x * F.b, y: F.y + t.y * F.h, s: f.pladser.str * F.h }; }
    J.sige(f.spoerg);
    return {
      info: function () { var F = felt(); return { ting: ting.map(function (t) { var p = plads(t, F); return { x: p.x, y: p.y, talt: t.talt }; }) }; },
      gentag: function () { J.sige(slut ? f.slut : f.spoerg); },
      opdater: function (dt) { tid += dt; ting.forEach(function (t) { ned(t, 'ryst', dt); ned(t, 'hop', dt, 2.5); }); },
      tegn: function (c) {
        var F = felt();
        tegnFeltBund(c, F, f.ting, f.pladser.trae, tid);
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
        var s = R.svar(bedst.nr);
        if (!s.rigtig) { bedst.ryst = 0.5; return; }       // allerede talt: en lille rysten, ingen straf
        bedst.talt = s.nr; bedst.hop = 1;
        f.pladser.pos[bedst.nr].taltSom = s.nr;          // saa regnestykket bagefter viser de samme tal
        var p = plads(bedst, F);
        J.tone(420 + s.nr * 45, 0.16, 0.12);
        J.fest(p.x, p.y, 8, 120, 'gnist');
        if (!s.faerdig) { J.sige(O.tal(s.nr)); return; }
        slut = true;
        J.sige(O.tal(s.nr), function () { setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 500); }); }, 450); });
      }
    };
  }

  /* ================= regn: en lille regnehistorie, svaret paa en talraekke ================= */

  /*
   * To slags: 'felt' er tael-feltet bagefter ("Der kommer to til."), hvor de
   * talte ting staar med deres tal; 'gruppe' er en regnehistorie, hvor tingene
   * dukker op i pæne raekker paa fem, mens stemmen fortaeller. daek: tingene
   * ligger under et viskestykke eller bag en snemand, saa man skal taenke; efter
   * to forkerte svar loeftes daekket, saa man kan taelle.
   */
  function regn(f, dag, J, faerdig) {
    var R = O.runde(f), TR = talraekke(f.max), tid = 0, fase = 'fortael', daek = 0, daekMaal = 0, vente = [];
    var total = f.foer + f.plus, figurer = Array.isArray(f.ting);
    var ting = [];
    for (var i = 0; i < total; i++) ting.push({ nr: i, ind: f.layout === 'felt' && i < f.foer ? -10 : null, ud: null, ryst: 0 });
    var vaek = [];                                         // dem, der forsvinder: de sidste af de foerste
    for (var v = f.foer - f.minus; v < f.foer; v++) vaek.push(v);
    function naar(test, fn) { vente.push({ test: test, fn: fn }); }
    function dukOp(fra, til, mellem) { for (var k = fra; k < til; k++) ting[k].ind = tid + (k - fra) * mellem; return tid + (til - fra) * mellem + 0.3; }
    function gaaVaek(mellem) { vaek.forEach(function (k, n) { ting[k].ud = tid + n * mellem; }); return tid + vaek.length * mellem + 0.6; }

    function aendring() {
      var faerdigT = f.plus ? dukOp(f.foer, total, 0.4) : gaaVaek(0.4), snakket = false;
      if (f.plus) J.tone(660, 0.1, 0.06);
      J.sige(f.saetninger[f.saetninger.length - 1], function () { snakket = true; });
      naar(function () { return snakket && tid >= faerdigT; }, function () { setTimeout(spoerg, 250); });
    }
    function spoerg() { fase = 'svar'; TR.aktiv = true; J.sige(f.spoerg); }
    setTimeout(function () {
      if (f.layout === 'felt') { aendring(); return; }
      var faerdigT = dukOp(0, f.foer, 0.28), snakket = false;
      J.sige(f.saetninger[0], function () { snakket = true; });
      naar(function () { return snakket && tid >= faerdigT; }, function () {
        if (f.daek) { daekMaal = 1; setTimeout(aendring, 900); } else setTimeout(aendring, 300);
      });
    }, 400);

    /* ---- hvor tingene staar ---- */
    function scene() { var W = J.W(), H = J.H(), L = TR.layout(W, H); return { x: 96, y: 24, b: W - 96 - 104, h: L.top - 34 }; }
    function felt() { return taelFelt(J, f.pladser, TR.layout(J.W(), J.H()).top - 14); }
    /** Gruppens pladser: raekker paa fem (tierrammens orden), gruppe 1 til venstre, gruppe 2 til hoejre. */
    function gruppeLayout() {
      var S = scene(), to = f.plus > 0;
      if (figurer) {
        var h = Math.min(S.h * 0.45, S.b / 10.5 * 1.5), gab = h * 0.56;
        var cx1 = S.x + S.b * (to ? 0.27 : 0.5), cx2 = S.x + S.b * 0.76, bund = S.y + S.h * 0.74;
        var bakker = [{ x: cx1, b: f.foer * gab + h * 0.7 }];
        if (to) bakker.push({ x: cx2, b: f.plus * gab + h * 0.7 });
        return { figurer: true, h: h, bund: bund, bakker: bakker, pos: ting.map(function (t) {
          var g2 = t.nr >= f.foer, j = g2 ? t.nr - f.foer : t.nr, n = g2 ? f.plus : f.foer;
          return { x: (g2 ? cx2 : cx1) + (j - (n - 1) / 2) * gab, y: bund };
        }) };
      }
      // Gruppe 1 foroven og gruppe 2 under den, hver paa sin plade, saa man kan se, at det er to grupper
      var raek1 = Math.ceil(f.foer / 5), raek2 = to ? Math.ceil(f.plus / 5) : 0, gab = to ? 0.95 : 0, rh = 1.2;
      var u = Math.min(S.h / ((raek1 + raek2) * rh + gab + 0.8), S.b * 0.68 / 5.9, 100);
      var cx = S.x + S.b * 0.57, y0 = S.y + (S.h - ((raek1 + raek2) * rh + gab) * u) / 2 + rh * u / 2;
      function raekY(g2, r) { return y0 + ((g2 ? raek1 * rh + gab : 0) + r * rh) * u; }
      var plader = [{ y0: raekY(false, 0), y1: raekY(false, raek1 - 1) }];
      if (to) plader.push({ y0: raekY(true, 0), y1: raekY(true, raek2 - 1) });
      return { u: u, cx: cx, plader: plader, pos: ting.map(function (t) {
        var g2 = t.nr >= f.foer, j = g2 ? t.nr - f.foer : t.nr;
        return { x: cx + (j % 5 - 2) * u * 1.15, y: raekY(g2, Math.floor(j / 5)) };
      }) };
    }
    /** Pladen under en gruppe: bagepladen til kager, en snebunke til snebolde, ellers papir. */
    function tegnPlade(c, G, p) {
      var x = G.cx - G.u * 3.05, y = p.y0 - G.u * 0.68, b = G.u * 6.1, h = p.y1 - p.y0 + G.u * 1.36;
      c.save(); c.shadowColor = 'rgba(94,74,58,.25)'; c.shadowBlur = 14; c.shadowOffsetY = 6;
      if (f.ting === 'kage') { M.rr(c, x, y, b, h, 18, '#8a8478'); c.shadowColor = 'transparent'; M.rr(c, x + 8, y + 8, b - 16, h - 16, 12, '#b8b2a4'); }
      else if (f.ting === 'snebold') { M.rr(c, x, y, b, h, h * 0.4, '#aed3e4'); c.shadowColor = 'transparent'; M.rr(c, x + 6, y + 6, b - 12, h - 12, h * 0.36, 'rgba(95,159,201,.35)'); }
      else M.rr(c, x, y, b, h, 18, '#efe3d0');
      c.restore();
    }
    /** Hvad daekket skal daekke: gruppe 1 med lidt luft. */
    function daekFelt(G) {
      var p = G.pos.slice(0, f.foer), s = G.figurer ? G.h * 0.5 : G.u * 0.85;
      if (!G.figurer) return { x: G.cx - G.u * 3.2, y: G.plader[0].y0 - G.u * 0.85, b: G.u * 6.4, h: G.plader[0].y1 - G.plader[0].y0 + G.u * 1.7 };
      var x0 = Math.min.apply(null, p.map(function (q) { return q.x; })) - s, x1 = Math.max.apply(null, p.map(function (q) { return q.x; })) + s;
      var y0 = Math.min.apply(null, p.map(function (q) { return q.y; })) - s, y1 = Math.max.apply(null, p.map(function (q) { return q.y; })) + s;
      return { x: x0, y: y0, b: x1 - x0, h: y1 - y0 };
    }
    function tegnDaek(c, D) {
      if (daek <= 0) return;
      var e = blød(daek), dy = (1 - e) * -(D.y + D.h + 40);
      c.save(); c.translate(0, dy);
      if (f.daek === 'snemand') {
        M.snebunke(c, D.x + D.b / 2, D.y + D.h + D.h * 0.12, D.b * 1.32, D.h * 1.3);
        var sti = O.tingBillede('snemand'), im = M.hent(sti), sh = D.h * 1.25;
        if (M.klar(sti)) { var sb = sh * im.naturalWidth / im.naturalHeight; c.drawImage(im, D.x + D.b / 2 - sb / 2, D.y + D.h - sh * 0.98, sb, sh); }
      } else M.klud(c, D.x, D.y, D.b, D.h);
      c.restore();
    }
    function tegnTing(c, t, p, s, alfa, skala) {
      c.save(); c.globalAlpha = alfa;
      if (figurer) M.figur(c, f.ting[t.nr], p.x, p.y, s * skala, { spejl: p.x > J.W() / 2 });
      else M.ting(c, f.ting, p.x + rystX(t), p.y, s * skala, t.nr, tid);
      c.restore();
    }
    /** Hvor langt en ting er: skala (dukket op) og alfa/forskydning (paa vej vaek). */
    function tilstand(t) {
      var ind = t.ind === null ? 0 : blød((tid - t.ind) / 0.3), ud = t.ud === null ? 0 : klem((tid - t.ud) / 0.9);
      return { ind: ind, ud: ud };
    }

    return {
      info: function () { var W = J.W(), H = J.H(); return { fase: fase, svar: f.svar, knapper: TR.info(W, H) }; },
      gentag: function () { if (fase === 'svar') J.sige(f.saetninger.concat([f.spoerg]).join(' ')); },
      opdater: function (dt) {
        tid += dt; TR.opdater(dt);
        daek += Math.max(-dt * 1.6, Math.min(dt * 1.6, daekMaal - daek));
        for (var k = vente.length - 1; k >= 0; k--) if (vente[k].test()) { var fn = vente[k].fn; vente.splice(k, 1); fn(); }
      },
      tegn: function (c, W, H) {
        if (f.layout === 'felt') {
          var F = felt(), s = f.pladser.str * F.h;
          tegnFeltBund(c, F, f.ting, f.pladser.trae, tid);
          ting.forEach(function (t) {
            var st = tilstand(t), q = f.pladser.pos[t.nr], p = { x: F.x + q.x * F.b, y: F.y + q.y * F.h };
            if (st.ind <= 0) return;
            if (vaek.indexOf(t.nr) >= 0 && f.stil === 'sne') {
              tegnTing(c, t, p, s, 1, st.ind);
              if (st.ud > 0) M.snebunke(c, p.x, p.y + s * 0.5, s * 1.25 * blød(st.ud * 1.4), s * 1.05 * blød(st.ud * 1.4));
              return;
            }
            if (st.ud >= 1) return;
            // Tallene fra optaellingen staar kun, naar der kommer flere til (saa man kan taelle videre)
            var fx = p.x + (W - 40 - p.x) * st.ud * st.ud, fy = p.y - Math.sin(st.ud * Math.PI) * 80 - (p.y - 40) * st.ud * st.ud;
            tegnTing(c, t, { x: fx, y: fy }, s, 1 - st.ud * 0.7, st.ind * (1 - st.ud * 0.3));
            if (f.plus && t.nr < f.talt && st.ud === 0) talMaerke(c, p.x + s * 0.45, p.y - s * 0.45, q.taltSom || t.nr + 1, Math.max(12, s * 0.2));
          });
        } else {
          var G = gruppeLayout(), S = scene(), us = G.figurer ? G.h : G.u;
          // Personerne i historien: til venstre for hver sin gruppe
          (f.figur || []).forEach(function (n, k) {
            var pl = G.plader && (G.plader[k] || G.plader[0]), fh = Math.min(S.h * 0.36, S.b * 0.16, G.u * 2.2);
            M.figur(c, n, S.x + S.b * 0.1, pl ? (pl.y0 + pl.y1) / 2 + fh * 0.5 : S.y + S.h * 0.9, fh);
          });
          if (G.plader) G.plader.forEach(function (pl, k) { if (k === 0 || ting[f.foer].ind !== null) tegnPlade(c, G, pl); });
          // Vennerne staar i to grupper, hver paa sin lille snebakke
          if (G.bakker) G.bakker.forEach(function (bk, k) {
            if (k === 1 && ting[f.foer].ind === null) return;
            c.fillStyle = 'rgba(251,247,240,.95)'; c.beginPath(); c.ellipse(bk.x, G.bund, bk.b / 2, G.h * 0.14, 0, 0, 7); c.fill();
            c.fillStyle = 'rgba(143,199,232,.25)'; c.beginPath(); c.ellipse(bk.x, G.bund + G.h * 0.05, bk.b * 0.42, G.h * 0.07, 0, 0, 7); c.fill();
          });
          var D = daekFelt(G);
          ting.forEach(function (t) {
            var st = tilstand(t);
            if (st.ind <= 0 || st.ud > 0) return;
            tegnTing(c, t, G.pos[t.nr], us, 1, st.ind);
          });
          tegnDaek(c, D);
          // Dem, der forsvinder, flyver ud til hoejre, oven paa daekket, saa man kan se dem gaa
          ting.forEach(function (t) {
            var st = tilstand(t);
            if (st.ind <= 0 || st.ud <= 0 || st.ud >= 1) return;
            var p = G.pos[t.nr], fx = p.x + (W + 60 - p.x) * st.ud * st.ud, fy = p.y - Math.sin(st.ud * Math.PI) * us * 1.2;
            tegnTing(c, t, { x: fx, y: fy }, us, 1 - st.ud * 0.5, 1);
          });
        }
        TR.synlig = fase === 'fortael' ? 0.6 : 1;
        TR.tegn(c, W, H);
      },
      ned: function (x, y) {
        if (fase !== 'svar') return;
        var W = J.W(), H = J.H(), k = TR.find(x, y, W, H);
        if (!k) return;
        var s = R.svar(k.n);
        if (s.rigtig) {
          fase = 'rigtig'; TR.valgt = k.n; TR.aktiv = false; daekMaal = 0;
          J.melodi([660, 880, 1100], 90);
          var S = scene(); J.fest(S.x + S.b / 2, S.y + S.h / 2, 24, 240, 'gnist');
          J.sige(f.rigtigTekst, function () { setTimeout(faerdig, 700); });
        } else {
          k.ryst = 1; J.dunk();
          if (f.daek && R.t.forkerte >= 2) daekMaal = 0;     // hjaelp: loeft daekket, saa man kan taelle
          J.sige(T.proevIgen);
        }
      }
    };
  }

  /* ================= se: tingene ses kort, svaret paa en talraekke ================= */

  function se(f, dag, J, faerdig) {
    var R = O.runde(f), TR = talraekke(f.max), tid = 0, fase = 'klar', visT = 0, daekke = 1, tomme = 0;
    function startRunde() {
      fase = 'klar'; daekke = 1;
      if (f.foer) J.sige(f.foer, function () { setTimeout(vis, 300); }); else setTimeout(vis, 700);
    }
    function vis() { fase = 'vis'; visT = 0; TR.aktiv = false; J.tone(660, 0.1, 0.08); }
    function skjul() { fase = 'svar'; TR.aktiv = true; TR.valgt = null; J.sige(f.spoerg); }
    function felt() {
      var W = J.W(), H = J.H(), top = TR.layout(W, H).top, b = Math.min(W * 0.6, (top - 44) * 1.6), h = b / 1.6;
      return { x: (W - b) / 2, y: Math.max(24, (top - 10 - h) / 2), b: b, h: h };
    }
    startRunde();
    return {
      info: function () { var W = J.W(), H = J.H(); return { fase: fase, antal: f.antal, svar: R.t.fase === 0 ? f.antal : f.mangler.svar, knapper: TR.info(W, H) }; },
      gentag: function () { if (fase === 'svar') J.sige(f.spoerg); else if (fase === 'mangler') J.sige(f.mangler.spoerg); },
      opdater: function (dt) {
        tid += dt; TR.opdater(dt);
        if (fase === 'vis') { visT += dt; daekke = Math.max(0, daekke - dt * 4); if (visT >= f.vis) skjul(); }
        else if (fase === 'rigtig' || fase === 'mangler' || fase === 'slut') daekke = Math.max(0, daekke - dt * 4);
        else daekke = Math.min(1, daekke + dt * 4);
        if (fase === 'mangler') tomme = Math.min(1, tomme + dt * 2);
      },
      tegn: function (c, W, H) {
        var F = felt(), nat = f.ting === 'stjerne', m = f.moenster;
        c.save(); c.shadowColor = 'rgba(94,74,58,.28)'; c.shadowBlur = 18; c.shadowOffsetY = 8;
        M.rr(c, F.x, F.y, F.b, F.h, 30, nat ? '#56688f' : '#b18a56'); c.restore();
        if (nat) M.rr(c, F.x + 8, F.y + 8, F.b - 16, F.h - 16, 24, '#6b7ba3');
        else {
          // Stubben: aarringe, set fra oven
          c.fillStyle = '#e5d3ae'; c.beginPath(); c.roundRect(F.x + 10, F.y + 10, F.b - 20, F.h - 20, 24); c.fill();
          c.strokeStyle = 'rgba(138,102,61,.25)'; c.lineWidth = 3;
          [0.85, 0.62, 0.4].forEach(function (k) { c.beginPath(); c.ellipse(F.x + F.b / 2, F.y + F.h / 2, F.b * 0.46 * k, F.h * 0.42 * k, 0, 0, 7); c.stroke(); });
        }
        var u = Math.min(F.b / 5.6, F.h / 2.8), cx = F.x + F.b / 2, cy = F.y + F.h / 2;
        if (daekke < 1) {
          c.save(); c.globalAlpha = 1 - daekke;
          if (m.navn === 'tierramme') {
            // Tierrammen: to raekker paa fem huller; de tomme lyser, naar man skal finde dem
            for (var q = 0; q < 10; q++) {
              var hx = cx + (q % 5 - 2) * u, hy = cy + (Math.floor(q / 5) - 0.5) * u, tom = q >= f.antal;
              M.rr(c, hx - u * 0.45, hy - u * 0.45, u * 0.9, u * 0.9, u * 0.18, nat ? 'rgba(86,104,143,.55)' : 'rgba(138,102,61,.28)', nat ? 'rgba(248,241,230,.35)' : 'rgba(94,74,58,.3)', 2);
              if (tom && tomme > 0) {
                c.strokeStyle = 'rgba(240,196,106,' + (tomme * (0.6 + 0.4 * Math.sin(tid * 5))) + ')'; c.lineWidth = 4;
                c.beginPath(); c.roundRect(hx - u * 0.42, hy - u * 0.42, u * 0.84, u * 0.84, u * 0.16); c.stroke();
              }
            }
          }
          m.pos.forEach(function (p, i) { M.ting(c, f.ting, cx + p.x * u, cy + p.y * u, u * 0.76, i, tid); });
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
        TR.tegn(c, W, H);
      },
      ned: function (x, y) {
        if (fase !== 'svar' && fase !== 'mangler') return;
        var W = J.W(), H = J.H(), k = TR.find(x, y, W, H);
        if (!k) return;
        var foer = fase, s = R.svar(k.n), F = felt();
        if (s.rigtig) {
          TR.valgt = k.n; TR.aktiv = false;
          J.melodi([660, 880, 1100], 90); J.fest(F.x + F.b / 2, F.y + F.h / 2, 24, 240, 'gnist');
          if (!s.faerdig) {
            fase = 'rigtig';
            J.sige(f.svar, function () { setTimeout(function () { fase = 'mangler'; TR.valgt = null; TR.aktiv = true; J.sige(f.mangler.spoerg); }, 500); });
          } else {
            fase = 'slut';
            J.sige(foer === 'mangler' ? f.mangler.rigtigTekst : f.svar, function () { setTimeout(faerdig, 800); });
          }
        } else {
          k.ryst = 1; J.dunk();
          if (foer === 'svar') { fase = 'igen'; TR.aktiv = false; J.sige(f.igen, function () { setTimeout(vis, 250); }); }
          else J.sige(T.proevIgen);
        }
      }
    };
  }

  /* ================= flest: tryk paa den bunke, der er flest i, og hvor mange flere ================= */

  function flest(f, dag, J, faerdig) {
    var R = O.runde(f), TR = talraekke(f.max), tid = 0, fase = 'flest', laast = false, glad = { venstre: 0, hoejre: 0 };
    TR.synlig = 0;                                       // talraekken kommer frem, naar man skal svare paa "hvor mange flere"
    var ryst = { venstre: { ryst: 0 }, hoejre: { ryst: 0 } }, paaRaekke = 0, raekkeMaal = 0;
    var figurer = (dag.moeder || []).filter(function (n) { return n !== 'sanne'; });
    J.sige(f.spoerg);
    function maal() {
      var W = J.W(), H = J.H(), B = f.bunker;
      var raekker = Math.max(-B.venstre[B.venstre.length - 1].y / 0.86, -B.hoejre[B.hoejre.length - 1].y / 0.86) + 1;
      var bred = Math.max.apply(null, B.venstre.concat(B.hoejre).map(function (p) { return Math.abs(p.x); })) * 2 + 1;
      var y0 = TR.layout(W, H).top - 24;
      var u = Math.min(W * 0.27 / bred, (y0 - 60) / (raekker * 0.86 + 0.3), 110);
      // To raekker ved siden af hinanden, saa man kan se, hvor mange flere der er
      var u2 = Math.min(u, (W * 0.62) / (Math.max(f.venstre, f.hoejre) * 1.1), (y0 - 60) / 3);
      return { u: u, u2: u2, y0: y0, cx: { venstre: W * 0.31, hoejre: W * 0.69 }, rx: W * 0.19 };
    }
    function pos(side, i, m) {
      var p = f.bunker[side][i], bunkeP = { x: m.cx[side] + p.x * m.u, y: m.y0 - m.u * 0.5 + p.y * m.u, s: m.u * 1.02 };
      if (paaRaekke <= 0) return bunkeP;
      var raekP = { x: m.rx + i * m.u2 * 1.1, y: m.y0 - m.u2 * (side === 'venstre' ? 2.1 : 0.7), s: m.u2 * 1.0 }, e = blød(paaRaekke);
      return { x: bunkeP.x + (raekP.x - bunkeP.x) * e, y: bunkeP.y + (raekP.y - bunkeP.y) * e, s: bunkeP.s + (raekP.s - bunkeP.s) * e };
    }
    function flere() { fase = 'flere'; TR.aktiv = true; if (f.flere.raekke) raekkeMaal = 1; J.sige(f.flere.spoerg); }
    return {
      info: function () { var W = J.W(), H = J.H(); return { fase: fase, flest: f.flest, laast: laast, x: f.flest === 'venstre' ? W * 0.28 : W * 0.72, y: H * 0.55, xForkert: f.flest === 'venstre' ? W * 0.72 : W * 0.28, svar: f.flere.svar, knapper: TR.info(W, H) }; },
      gentag: function () { J.sige(fase === 'flere' ? f.flere.spoerg : f.spoerg); },
      opdater: function (dt) {
        tid += dt; TR.opdater(dt);
        ned(glad, 'venstre', dt, 0.6); ned(glad, 'hoejre', dt, 0.6); ned(ryst.venstre, 'ryst', dt); ned(ryst.hoejre, 'ryst', dt);
        paaRaekke += Math.max(-dt * 1.2, Math.min(dt * 1.2, raekkeMaal - paaRaekke));
      },
      tegn: function (c, W, H) {
        var m = maal();
        c.fillStyle = 'rgba(251,247,240,.9)'; c.beginPath(); c.ellipse(W / 2, m.y0 + 10, W * 0.46, H * 0.08, 0, 0, 7); c.fill();
        ['venstre', 'hoejre'].forEach(function (side, si) {
          var dx = rystX(ryst[side]);
          if (figurer.length === 2) M.figur(c, figurer[si], si ? W * 0.9 : W * 0.1, m.y0 - 4, H * 0.24, { spejl: si === 1 });
          if (glad[side] > 0 && paaRaekke <= 0) {
            var g = c.createRadialGradient(m.cx[side], m.y0 - m.u, 4, m.cx[side], m.y0 - m.u, m.u * 3);
            g.addColorStop(0, 'rgba(240,196,106,' + (0.6 * glad[side]) + ')'); g.addColorStop(1, 'rgba(240,196,106,0)');
            c.fillStyle = g; c.beginPath(); c.arc(m.cx[side], m.y0 - m.u, m.u * 3, 0, 7); c.fill();
          }
          f.bunker[side].forEach(function (q, i) { var p = pos(side, i, m); M.ting(c, f.ting, p.x + dx, p.y, p.s, i, tid); });
        });
        TR.synlig = Math.min(1, Math.max(0, TR.synlig + (fase === 'flest' ? -0.1 : 0.06)));
        TR.tegn(c, W, H);
      },
      ned: function (x, y) {
        var H = J.H(), W = J.W();
        if (laast) return;
        if (fase === 'flest') {
          if (y < H * 0.12 || y > maal().y0 + 30) return;
          var side = x < W / 2 ? 'venstre' : 'hoejre', s = R.svar(side);
          if (s.rigtig) {
            laast = true; glad[side] = 1;
            J.melodi([660, 880, 1100], 90);
            var m = maal(); J.fest(m.cx[side], m.y0 - m.u, 22, 220, 'gnist');
            J.sige(f.svar, function () { setTimeout(function () { laast = false; flere(); }, 500); });
          } else { ryst[side].ryst = 1; J.dunk(); J.sige(T.proevIgen); }
          return;
        }
        if (fase !== 'flere') return;
        var k = TR.find(x, y, W, H);
        if (!k) return;
        var s2 = R.svar(k.n);
        if (s2.rigtig) {
          fase = 'slut'; laast = true; TR.valgt = k.n; TR.aktiv = false;
          J.melodi([660, 880, 1100], 90); J.fest(W / 2, H * 0.4, 24, 240, 'gnist');
          J.sige(f.flere.rigtigTekst, function () { setTimeout(faerdig, 700); });
        } else { k.ryst = 1; J.dunk(); J.sige(T.proevIgen); }
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
      gentag: function () { J.sige(slut && f.slut ? f.slut : f.spoerg); },
      opdater: function (dt) { tid += dt; hint = (hint + dt * 0.35) % 1; if (jubel > 0) jubel = Math.max(0, jubel - dt); },
      tegn: function (c) {
        var k = kasse(), pad = k.s * 0.08;
        c.save(); c.shadowColor = 'rgba(94,74,58,.3)'; c.shadowBlur = 24; c.shadowOffsetY = 10;
        M.rr(c, k.x - pad, k.y - pad, k.s + 2 * pad, k.s + 2 * pad, 30, '#fffaf0'); c.restore();
        if (!f.stor) {
          // Det lille bogstav: skrivelinjerne, saa man kan se, hvor smaat det er
          c.strokeStyle = 'rgba(95,159,201,.35)'; c.lineWidth = 2;
          [0.45, 0.8].forEach(function (yy) { c.beginPath(); c.moveTo(k.x - pad * 0.6, k.y + yy * k.s); c.lineTo(k.x + k.s + pad * 0.6, k.y + yy * k.s); c.stroke(); });
        }
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
          if (f.slut) setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 700); }); }, 500);
          else setTimeout(faerdig, 1100);
        }
      },
      op: function (x, y, id) { if (id === finger) { finger = null; sp.slip(); } }
    };
  }

  /* ================= kort: billeder eller bogstaver at vaelge imellem ================= */

  /*
   * Varianter: forlyd (find alle, der starter med lyden), bogstav (hvilket
   * bogstav starter ordet med), rim (hvad rimer paa ordet), rimIkke (hvilket
   * rimer ikke), rimPar (find de to, der rimer) og klapFlest (hvilket ord har
   * flest klap). Ordklippene spilles hele og for sig.
   */
  function kortleg(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, laast = false, visKlap = false;
    var kortene = bland(f.kort.map(function (k, i) { return { k: k, i: i, ryst: 0, glad: 0, lys: 0, info: k.ord ? O.ord(k.ord) : null }; }));
    kortene.forEach(function (k) { if (k.info) M.hent(k.info.billede); });
    if (f.hoved && f.hoved.ord) M.hent(O.ord(f.hoved.ord).billede);
    /** Spil en raekke: saetninger, ordklip ({ ord }) og ordklip, hvor kortet lyser imens ({ ord, kort }). */
    function afspil(trin, faerdigFn) {
      var n = 0;
      (function naeste() {
        kortene.forEach(function (k) { k.lys = 0; });
        if (n >= trin.length) { if (faerdigFn) faerdigFn(); return; }
        var t = trin[n++];
        if (typeof t === 'string') J.sige(t, naeste);
        else { if (t.kort) t.kort.lys = 1; J.klip(t.ord, function () { setTimeout(naeste, 250); }); }
      })();
    }
    function spoerg(foerste) {
      var trin = [];
      if (f.laes && foerste) kortene.forEach(function (k) { trin.push({ ord: k.k.ord, kort: k }); });   // ordene foerst, ét ad gangen
      afspil(trin.concat(f.spoerg));
    }
    function layout() {
      var W = J.W(), H = J.H(), n = kortene.length, hoved = !!f.hoved, S = skyFelt(W, H);
      var s = Math.min((W - 210) / (n * 1.2 - 0.2), H * (hoved ? 0.36 : 0.42), n <= 2 ? 260 : 240);
      var y = hoved ? Math.min(H - s / 2 - 30, S.y + S.h * 0.6 + s / 2 + 30) : H * 0.52;
      return kortene.map(function (k, i) { return { x: W / 2 + (i - (n - 1) / 2) * s * 1.2, y: y, s: s }; });
    }
    setTimeout(function () { spoerg(true); }, 300);
    return {
      info: function () { var L = layout(); return { laast: laast, variant: f.variant, kort: kortene.map(function (k, i) { return { noegle: k.k.noegle, rigtig: f.rigtige.indexOf(k.k.noegle) >= 0, x: L[i].x, y: L[i].y }; }) }; },
      gentag: function () { if (!laast) afspil(f.igen); },
      opdater: function (dt) { tid += dt; kortene.forEach(function (k) { ned(k, 'ryst', dt); }); },
      tegn: function (c, W, H) {
        if (f.hoved) {
          var S = skyFelt(W, H);
          sky(c, S.x, S.y, S.b, S.h);
          if (f.hoved.bogstav) bogstavTekst(c, f.hoved.bogstav, S.x, S.y + S.h * 0.02, S.h * 0.56);
          else tegnOrdISky(c, S, f.hoved.ord);
        }
        var L = layout();
        kortene.forEach(function (k, i) {
          var x = L[i].x + rystX(k), y = L[i].y - k.glad * 10 - k.lys * 8, s = L[i].s;
          var glans = Math.max(k.glad, k.lys * 0.6);
          if (k.k.bogstav) {
            kort(c, x, y, s, null, glans);
            bogstavTekst(c, k.k.bogstav, x, y, s * 0.46);
          } else kort(c, x, y, s, k.info && k.info.billede, glans);
          if (visKlap && f.stavelser) {
            // Hjaelp efter et forkert svar: én prik for hvert klap under kortene
            var n = f.stavelser[k.i], r = Math.min(14, s * 0.07);
            for (var q = 0; q < n; q++) { c.fillStyle = GUL; c.strokeStyle = KANT; c.lineWidth = 2.5; c.beginPath(); c.arc(x + (q - (n - 1) / 2) * r * 3, y + s / 2 + r * 2.4, r, 0, 7); c.fill(); c.stroke(); }
          }
        });
      },
      ned: function (x, y) {
        var W = J.W(), H = J.H();
        if (f.hoved && iSky(skyFelt(W, H), x, y)) { if (!laast) afspil(f.igen); return; }
        if (laast) return;
        var L = layout(), i = -1;
        L.forEach(function (p, n) { if (Math.abs(x - p.x) < p.s * 0.55 && Math.abs(y - p.y) < p.s * 0.55) i = n; });
        if (i < 0) return;
        var k = kortene[i], s = R.svar(k.i);
        if (s.ingenting) return;
        if (s.rigtig) {
          k.glad = 1;
          if (s.faerdig) laast = true;
          var efter = function () {
            J.melodi([660, 880, 1100], 90); J.fest(L[i].x, L[i].y, 22, 220, 'gnist');
            if (s.faerdig) J.sige(f.rigtigTekst, function () { setTimeout(faerdig, 700); });
            else if (f.endnu) J.sige(f.rigtigTekst + ' ' + f.endnu);
          };
          if (k.k.ord) J.klip(k.k.ord, efter); else efter();
        } else {
          k.ryst = 1; J.dunk();
          if (f.variant === 'klapFlest') visKlap = true;
          if (f.forkert === 'klip+spoerg' && k.k.ord) J.klip(k.k.ord, function () { setTimeout(function () { if (!laast) afspil(f.igen); }, 300); });
          else if (f.forkert === 'klip+proev' && k.k.ord) J.klip(k.k.ord, function () { J.sige(T.proevIgen); });
          else J.sige(T.proevIgen);
        }
      }
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
    var R = O.runde(f), tid = 0, ro = 0, faerdigR = false, vip = { ryst: 0 }, tryk = 0, glad = 0;
    function sigOrd() { J.raekke([{ ord: f.ord }, f.spoerg]); }      // "Her har du ordet kage." "Klap det på trommen."
    function layout() {
      var W = J.W(), H = J.H(), rb = Math.min(W * 0.2, 210, H * 0.24), rh = rb * 0.38, ty = H * 0.68;
      return { x: W / 2, y: ty, rb: rb, rh: rh, prikY: ty - rh * 1.3 - 52, prikR: Math.min(30, rb * 0.16), gab: Math.min(84, rb * 0.48) };
    }
    M.hent(O.ord(f.ord).billede);
    setTimeout(sigOrd, 300);
    return {
      info: function () { var l = layout(); return { stavelser: f.stavelser, antal: R.t.antal, faerdig: faerdigR, x: l.x, y: l.y }; },
      gentag: sigOrd,
      opdater: function (dt) {
        tid += dt; ro += dt; ned(vip, 'ryst', dt, 1.4); if (tryk > 0) tryk = Math.max(0, tryk - dt); if (glad > 0) glad += dt;
        if (!faerdigR && R.t.antal === f.stavelser && ro > 0.8 && R.svar('faerdig').faerdig) {
          faerdigR = true; glad = 0.001;
          J.melodi([660, 880, 1100], 90);
          var l = layout(); J.fest(l.x, l.prikY, 26, 240, 'gnist');
          J.sige(f.rigtigTekst, function () { setTimeout(faerdig, 800); });
        }
      },
      tegn: function (c, W, H) {
        var S = skyFelt(W, H);
        sky(c, S.x, S.y, S.b, S.h);
        tegnOrdISky(c, S, f.ord);
        var l = layout();
        for (var n = 0; n < f.stavelser; n++) {
          var px = l.x + (n - (f.stavelser - 1) / 2) * l.gab + rystX(vip), fyldt = n < R.t.antal || faerdigR;
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
        tryk = 0.25; ro = 0;
        J.tone(150, 0.28, 0.4, 'sine'); J.tone(95, 0.16, 0.25, 'triangle');
        if (!R.svar('klap').rigtig) {     // én for meget: forfra, uden straf, prikkerne vipper bare
          vip.ryst = 0.8;
          J.melodi([330, 262], 110);
          setTimeout(function () { if (!faerdigR) sigOrd(); }, 900);
        }
      }
    };
  }

  /* ================= moenster: haeng den naeste paa guirlanden ================= */

  function moenster(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, laast = true, hop = -1, glad = 0, flyv = null;
    var valg = f.valg.map(function (v) { return { v: v, ryst: 0 }; });
    var TONER = { roed: 523, blaa: 659, gul: 784, lilla: 698, groen: 587, stjerne: 880, klokke: 988, lys: 740 };
    /** Moensteret spilles: pynten hopper én ad gangen med hver sin tone, saa man kan hoere det. */
    function vis(faerdigFn) {
      laast = true;
      f.raekke.slice(0, f.vist).forEach(function (sl, i) {
        setTimeout(function () { hop = i; J.tone(TONER[sl] || 660, 0.18, 0.08); }, 200 + i * 420);
      });
      setTimeout(function () { hop = -1; laast = false; if (faerdigFn) faerdigFn(); }, 200 + f.vist * 420 + 150);
    }
    vis(function () { J.sige(f.spoerg); });
    function guirlande() {
      var W = J.W(), H = J.H(), n = f.raekke.length, x0 = W * 0.12, x1 = W - 150, s = Math.min(78, (x1 - x0) / n * 0.82);
      return f.raekke.map(function (sl, i) { var u = n > 1 ? i / (n - 1) : 0.5; return { x: x0 + (x1 - x0) * u, y: H * 0.26 + Math.sin(u * Math.PI) * H * 0.09, s: s }; });
    }
    function knapper() {
      var W = J.W(), H = J.H(), s = Math.min(150, H * 0.22, (W - 240) / 3.6);
      return valg.map(function (v, i) { return { x: W / 2 + (i - 1) * s * 1.4, y: H - s / 2 - 34, s: s }; });
    }
    return {
      info: function () { var K = knapper(); return { laast: laast, svar: f.svar[R.t.udfyldt], valg: valg.map(function (v, i) { return { v: v.v, x: K[i].x, y: K[i].y }; }) }; },
      gentag: function () { if (!laast) vis(function () { J.sige(f.spoerg); }); },
      opdater: function (dt) { tid += dt; valg.forEach(function (v) { ned(v, 'ryst', dt); }); if (glad > 0) glad += dt; if (flyv) { flyv.t += dt * 2.2; if (flyv.t >= 1) flyv = null; } },
      tegn: function (c, W, H) {
        var G = guirlande(), fyldt = f.vist + R.t.udfyldt - (flyv ? 1 : 0);
        // Snoren mellem pynten, i en bloed bue
        c.strokeStyle = '#8a663d'; c.lineWidth = 4; c.lineCap = 'round';
        c.beginPath(); c.moveTo(G[0].x - 60, G[0].y - 30);
        G.forEach(function (p) { c.lineTo(p.x, p.y - p.s * 0.55); });
        c.lineTo(G[G.length - 1].x + 50, G[G.length - 1].y - 34); c.stroke();
        c.strokeStyle = 'rgba(147,188,99,.85)'; c.lineWidth = 9; c.setLineDash([2, 12]); c.stroke(); c.setLineDash([]);
        G.forEach(function (p, i) {
          if (i < fyldt) {
            var dy = i === hop ? -p.s * 0.25 : 0, b = glad > 0 ? Math.sin(glad * 8 - i * 0.7) * p.s * 0.06 : 0;
            tegnPynt(c, O.PYNT[f.raekke[i]], p.x, p.y + p.s * 0.1 + dy + b, p.s, tid);
          } else {
            var nu = i === fyldt;
            c.save(); c.setLineDash([6, 7]); c.lineWidth = nu ? 4 : 2;
            c.strokeStyle = nu ? 'rgba(240,196,106,' + (0.65 + 0.35 * Math.sin(tid * 4)) + ')' : 'rgba(138,102,61,.35)';
            c.beginPath(); c.arc(p.x, p.y + p.s * 0.1, p.s * 0.42 * (nu ? 1 + Math.sin(tid * 4) * 0.05 : 1), 0, 7); c.stroke(); c.restore();
          }
        });
        var K = knapper();
        valg.forEach(function (v, i) {
          var k = K[i];
          c.save(); c.shadowColor = 'rgba(107,85,68,.22)'; c.shadowBlur = 12; c.shadowOffsetY = 6;
          M.rr(c, k.x - k.s / 2 + rystX(v), k.y - k.s / 2, k.s, k.s, k.s * 0.18, PAPIR); c.restore();
          tegnPynt(c, O.PYNT[v.v], k.x + rystX(v), k.y + k.s * 0.06, k.s * 0.9, tid);
        });
        if (flyv) {
          var e = blød(flyv.t), mx = flyv.fra.x + (flyv.til.x - flyv.fra.x) * e, my = flyv.fra.y + (flyv.til.y - flyv.fra.y) * e - Math.sin(e * Math.PI) * 60;
          tegnPynt(c, O.PYNT[flyv.v], mx, my, flyv.til.s + (K[0].s * 0.9 - flyv.til.s) * (1 - e), tid);
        }
      },
      ned: function (x, y) {
        if (laast || flyv) return;
        var K = knapper(), i = -1;
        K.forEach(function (k, n) { if (Math.abs(x - k.x) < k.s * 0.6 && Math.abs(y - k.y) < k.s * 0.6) i = n; });
        if (i < 0) return;
        var v = valg[i], plads = f.vist + R.t.udfyldt, s = R.svar(v.v);
        if (s.rigtig) {
          var G = guirlande();
          flyv = { v: v.v, t: 0, fra: { x: K[i].x, y: K[i].y }, til: { x: G[plads].x, y: G[plads].y + G[plads].s * 0.1, s: G[plads].s } };
          J.tone(TONER[v.v] || 660, 0.2, 0.1);
          setTimeout(function () {
            J.fest(G[plads].x, G[plads].y, 14, 160, 'gnist');
            if (!s.faerdig) return;
            laast = true; glad = 0.001;
            J.melodi([660, 880, 1100], 90);
            J.sige(f.rigtigTekst, function () { setTimeout(faerdig, 700); });
          }, 480);
        } else { v.ryst = 1; J.dunk(); J.sige(f.igen); }
      }
    };
  }

  /* ================= pynt: traek pynt op paa juletraeet, frit ================= */

  function pynt(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, haengt = [], holdt = {}, falder = [], slut = false, knap = 0;
    var SLAGS = [O.PYNT.roed, O.PYNT.blaa, O.PYNT.stjerne, O.PYNT.gul, O.PYNT.lys, O.PYNT.lilla, O.PYNT.klokke];
    J.sige(f.spoerg);
    function trae() { var W = J.W(), H = J.H(), top = H * 0.05, bund = H * 0.8; return { x: W / 2, top: top, bund: bund, b: (bund - top) * 0.72 }; }
    function bakke() {
      var W = J.W(), H = J.H(), s = Math.min(70, H * 0.1, (W - 200) / (SLAGS.length * 1.5));
      return SLAGS.map(function (sl, i) { return { sl: sl, x: W / 2 + (i - (SLAGS.length - 1) / 2) * s * 1.5, y: H - s * 0.75 - 14, s: s }; });
    }
    function paaTraeet(x, y) {
      var T2 = trae(), h = T2.bund - T2.top, u = (y - T2.top) / h;
      if (u < 0.04 || u > 0.88) return false;
      return Math.abs(x - T2.x) < T2.b / 2 * (u / 0.9) * 0.98;
    }
    function knapPlads() { var W = J.W(), H = J.H(), r = Math.min(46, H * 0.07); return { x: W - r - 26, y: H - r - 26, r: r }; }
    function faerdigNu() {
      if (slut || !R.svar('faerdig').faerdig) return;
      slut = true;
      J.melodi([523, 659, 784, 1047], 100);
      var T2 = trae(); J.fest(T2.x, (T2.top + T2.bund) / 2, 40, 300);
      J.sige(f.slut, function () { setTimeout(faerdig, 600); });
    }
    return {
      info: function () { var T2 = trae(); return { haengt: haengt.length, knap: knap > 0 ? knapPlads() : null, bakke: bakke().map(function (b) { return { x: b.x, y: b.y }; }), trae: T2 }; },
      gentag: function () { J.sige(f.spoerg); },
      opdater: function (dt) {
        tid += dt;
        if (knap > 0) knap = Math.min(1, knap + dt * 3);
        for (var i = falder.length - 1; i >= 0; i--) { falder[i].t += dt * 2.5; if (falder[i].t >= 1) falder.splice(i, 1); }
      },
      tegn: function (c, W, H) {
        var T2 = trae(), h = T2.bund - T2.top;
        M.juletrae(c, T2.x, T2.top, T2.bund, T2.b, false, tid);
        haengt.forEach(function (p) { tegnPynt(c, p.sl, T2.x + p.u * T2.b, T2.top + p.v * h, p.s, tid); });
        var B = bakke();
        M.rr(c, B[0].x - B[0].s, B[0].y - B[0].s * 0.75, B[B.length - 1].x - B[0].x + B[0].s * 2, B[0].s * 1.5, 22, 'rgba(248,241,230,.92)');
        B.forEach(function (b) { tegnPynt(c, b.sl, b.x, b.y, b.s, tid); });
        falder.forEach(function (p) {
          var e = p.t * p.t; tegnPynt(c, p.sl, p.x + (p.tx - p.x) * e, p.y + (p.ty - p.y) * e, p.s, tid);
        });
        Object.keys(holdt).forEach(function (id) { var p = holdt[id]; tegnPynt(c, p.sl, p.x, p.y, p.s * 1.15, tid); });
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
        var T2 = trae(), h = T2.bund - T2.top;
        if (p.sl.t === 'stjerne' && Math.hypot(p.x - T2.x, p.y - T2.top) < h * 0.12) { p.x = T2.x; p.y = T2.top + h * 0.01; }
        if ((p.x === T2.x && p.sl.t === 'stjerne') || paaTraeet(p.x, p.y)) {
          haengt.push({ sl: p.sl, u: (p.x - T2.x) / T2.b, v: (p.y - T2.top) / h, s: p.s });
          J.tone(700 + (haengt.length % 6) * 70, 0.14, 0.1);
          J.fest(p.x, p.y, 8, 110, 'gnist');
          if (R.svar('haeng').flueben && knap === 0) { knap = 0.001; J.melodi([784, 988], 90); }
        } else {
          R.svar('tabt');
          falder.push({ sl: p.sl, x: p.x, y: p.y, tx: p.fra.x, ty: p.fra.y, s: p.s, t: 0 });
        }
      }
    };
  }

  /* ================= venner: vennerne kommer én ad gangen; tryk og tael ================= */

  function venner(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, aktiv = -1, slut = false;
    var liste = f.venner.map(function (n, i) { return { navn: n, nr: i, fase: 'vent', t: 0, x: 0, y: 0, talt: 0 }; });
    /*
     * Pladserne om traeet: forreste raekke (de foerste, der kommer) fra midten og
     * ud, skiftevis til venstre og hoejre, saa bagerste raekke, uden om traeet.
     */
    var forrest = Math.ceil(liste.length * 8 / 14);
    function plads(v) {
      var W = J.W(), H = J.H(), i = v.nr, bag = i >= forrest, j = bag ? i - forrest : i, n = bag ? liste.length - forrest : forrest;
      var side = j % 2 ? 1 : -1, trin = Math.floor(j / 2), antal = Math.ceil(n / 2);
      var inde = bag ? 0.19 : 0.14, ude = bag ? 0.39 : 0.42, afst = inde + (antal > 1 ? trin * (ude - inde) / (antal - 1) : 0);
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
      info: function () { var v = liste[aktiv]; return { aktiv: aktiv, talt: R.t.aktiv, fase: v && v.fase, x: v && v.x, y: v && v.y - hoejde(v) * 0.5 }; },
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
        var s = R.svar(aktiv);
        if (!s.rigtig) return;
        v.talt = s.nr; v.fase = 'talt'; v.t = 0;
        J.tone(420 + s.nr * 40, 0.16, 0.12);
        J.fest(v.x, v.y - h * 0.5, 10, 140, 'gnist');
        if (!s.faerdig) { J.sige(O.tal(s.nr)); setTimeout(naeste, 700); return; }
        slut = true;
        J.sige(O.tal(s.nr), function () { setTimeout(function () { J.sige(f.slut, function () { setTimeout(faerdig, 500); }); }, 500); });
      }
    };
  }

  /* ================= sorter: dem, der kan flyve, op i traeet, og resten ned paa jorden ================= */

  function sorter(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, holdt = {}, slut = false, antal = { op: 0, ned: 0 };
    var fig = f.figurer.map(function (x, i) { return { navn: x.navn, op: x.op, i: i, sted: null, plads: -1, ryst: 0, tilbage: 0, fx: 0, fy: 0, x: 0, y: 0 }; });
    J.sige(f.spoerg);
    function trae() { var W = J.W(), H = J.H(), top = H * 0.06, bund = H * 0.74; return { x: W * 0.3, top: top, bund: bund, b: (bund - top) * 0.78 }; }
    function iTraeet(x, y) {
      var T2 = trae(), h = T2.bund - T2.top, u = (y - T2.top) / h;
      return u > 0.08 && u < 0.92 && Math.abs(x - T2.x) < T2.b / 2 * Math.min(1, u / 0.9) * 1.05;
    }
    function jordY() { return J.H() * 0.8; }
    function h0() { return J.H() * 0.19; }
    /** Hvor hver figur venter: to raekker til hoejre. */
    function start(v) { var W = J.W(), H = J.H(); return { x: W * (0.6 + (v.i % 3) * 0.13), y: H * (v.i < 3 ? 0.4 : 0.66) }; }
    /** Pladserne paa grenene og paa jorden. */
    function sted(v) {
      var T2 = trae(), h = T2.bund - T2.top, W = J.W(), H = J.H();
      if (v.sted === 'op') { var G = [[0, 0.38], [-0.2, 0.62], [0.2, 0.64], [0, 0.8]][v.plads % 4]; return { x: T2.x + G[0] * T2.b, y: T2.top + G[1] * h }; }
      return { x: W * 0.08 + v.plads * W * 0.115, y: H * 0.96 };
    }
    function hvor(v) {
      if (holdt[v.holdtAf] && holdt[v.holdtAf] === v) return { x: v.x, y: v.y };
      var S = v.sted ? sted(v) : start(v);
      if (v.tilbage > 0) { var e = blød(1 - v.tilbage); return { x: v.fx + (S.x - v.fx) * e, y: v.fy + (S.y - v.fy) * e }; }
      return S;
    }
    return {
      info: function () { return { figurer: fig.map(function (v) { var p = hvor(v); return { navn: v.navn, op: v.op, sted: v.sted, x: p.x, y: p.y - h0() * 0.5 }; }), trae: trae(), jord: jordY() }; },
      gentag: function () { J.sige(f.spoerg); },
      opdater: function (dt) { tid += dt; fig.forEach(function (v) { ned(v, 'ryst', dt); ned(v, 'tilbage', dt, 2.4); }); },
      tegn: function (c, W, H) {
        var T2 = trae();
        c.fillStyle = 'rgba(251,247,240,.94)'; c.beginPath(); c.roundRect(-20, jordY() - 6, W + 40, H - jordY() + 30, 30); c.fill();
        c.fillStyle = 'rgba(143,199,232,.18)'; c.beginPath(); c.ellipse(W * 0.3, H * 0.92, W * 0.25, H * 0.03, 0, 0, 7); c.fill();
        M.juletrae(c, T2.x, T2.top, T2.bund, T2.b, false, tid);
        fig.filter(function (v) { return !holdt[v.holdtAf] || holdt[v.holdtAf] !== v; }).forEach(function (v) {
          var p = hvor(v), h = v.sted === 'op' ? h0() * 0.72 : h0();
          M.figur(c, v.navn, p.x + rystX(v), p.y, h, { spejl: v.sted === 'op' && p.x > T2.x });
        });
        Object.keys(holdt).forEach(function (id) { var v = holdt[id]; M.figur(c, v.navn, v.x, v.y, h0() * 1.08); });
      },
      ned: function (x, y, id) {
        if (slut) return;
        var h = h0(), v = fig.filter(function (q) { var p = hvor(q); return !q.sted && !holdt[q.holdtAf] && Math.abs(x - p.x) < h * 0.42 && y > p.y - h * 1.05 && y < p.y + 16; })[0];
        if (!v) return;
        var p = hvor(v);
        v.holdtAf = id; v.dx = x - p.x; v.dy = y - p.y; v.x = p.x; v.y = p.y; holdt[id] = v;
        J.tone(520, 0.08, 0.08);
      },
      flyt: function (x, y, id) { var v = holdt[id]; if (v) { v.x = x - v.dx; v.y = y - v.dy; } },
      op: function (x, y, id) {
        var v = holdt[id]; if (!v) return;
        delete holdt[id]; v.holdtAf = null;
        var hvorhen = iTraeet(v.x, v.y - h0() * 0.4) ? 'op' : v.y > jordY() ? 'ned' : null;
        v.fx = v.x; v.fy = v.y;
        if (!hvorhen) { v.tilbage = 1; return; }                       // sluppet midt i: tilbage, uden at det er forkert
        var s = R.svar({ navn: v.navn, sted: hvorhen });
        if (s.rigtig) {
          v.sted = hvorhen; v.plads = antal[hvorhen]++; v.tilbage = 1;
          J.tone(hvorhen === 'op' ? 880 : 520, 0.16, 0.1); J.fest(v.x, v.y - h0() * 0.5, 12, 150, 'gnist');
          if (s.faerdig) { slut = true; J.melodi([660, 880, 1100], 90); J.sige(f.rigtigTekst, function () { setTimeout(faerdig, 700); }); }
        } else {
          v.ryst = 1; v.tilbage = 1; J.dunk();
          J.sige(v.op ? f.op : f.ned);
        }
      }
    };
  }

  /* ================= puslespil: brikkerne traekkes paa plads ================= */

  function puslespil(f, dag, J, faerdig) {
    var R = O.runde(f), tid = 0, glans = 0, slut = false;
    var spil = P.nytSpil(f.loese.concat(f.skjult), f.steder.concat(f.skjult.map(function () { return [99, 99]; })));
    J.sige(f.spoerg);
    function skjult(br) { return f.skjult.indexOf(br.dag) >= 0; }
    function braet() {
      var W = J.W(), H = J.H(), cb = Math.min((W - 230) / 9.6, (H - 70) / (4 * CELLE + 0.5)), ch = cb * CELLE;   // fri af knapperne i hjoernerne
      return { x: (W - 6 * cb) / 2, y: (H - 4 * ch) / 2 + 10, cb: cb, ch: ch };
    }
    function celle(x, y) { var B = braet(); return [(x - B.x) / B.cb, (y - B.y) / B.ch]; }
    return {
      info: function () { var B = braet(); return { faerdig: slut, loese: spil.brikker.filter(function (b) { return !b.paa && !skjult(b); }).map(function (b) { return { dag: b.dag, x: B.x + (b.x + 0.5) * B.cb, y: B.y + (b.y + 0.5) * B.ch, mx: B.x + (b.kol + 0.5) * B.cb, my: B.y + (b.raek + 0.5) * B.ch }; }) }; },
      gentag: function () { J.sige(slut && f.slut ? f.slut : f.spoerg); },
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
          c.strokeStyle = skjult(br) ? 'rgba(138,102,61,.35)' : 'rgba(240,196,106,' + (0.6 + 0.4 * Math.sin(tid * 3)) + ')'; c.lineWidth = skjult(br) ? 2 : 3; c.stroke();
          c.restore();
        });
        // Nis staar ved siden af puslespillet med den sidste brik
        if (f.nis) M.nis(c, B.x - 0.9 * B.cb, B.y + 4 * B.ch, B.ch * 1.7);
        spil.raekkefoelge.forEach(function (br) {
          if (skjult(br) && !br.paa) return;
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
        if (slut) return;
        var p = celle(x, y);
        if (P.tag(spil, p[0], p[1], id)) J.tone(520, 0.08, 0.08);
      },
      flyt: function (x, y, id) { var p = celle(x, y); P.flyt(spil, p[0], p[1], id); },
      op: function (x, y, id) {
        if (!P.slip(spil, id)) return;
        var B = braet(), br = spil.netopPaa, s = R.svar({ dag: br.dag, kol: br.kol, raek: br.raek });
        J.klik(); J.fest(B.x + (br.kol + 0.5) * B.cb, B.y + (br.raek + 0.5) * B.ch, 30, 240, 'gnist');
        if (!s.faerdig) return;
        slut = true;
        if (!f.slut) { J.melodi([523, 659, 784], 100); setTimeout(faerdig, 700); return; }
        glans = 0.001;
        J.melodi([523, 659, 784, 1047, 1319, 1568], 120);
        setTimeout(function () { J.fest(J.W() / 2, J.H() / 2, 60, 380, 'gnist'); }, 400);
        J.sige(f.slut, function () { setTimeout(faerdig, 1200); });
      }
    };
  }

  /* ================= serie: dagens dele efter hinanden, med fejring og pil frem ================= */

  var LEGE = { tael: tael, regn: regn, se: se, flest: flest, spor: spor, kort: kortleg, klap: klap, moenster: moenster, pynt: pynt, venner: venner, sorter: sorter, puslespil: puslespil };

  function serie(f, dag, J, faerdig) {
    var nr = -1, aktuel = null, gen = 0, tid = 0, skifter = false, slut = false, frem = { ryst: 0 };
    var prik = f.dele.map(function () { return { fyldt: 0, sprunget: false, hop: 0 }; });
    /** J til én del: naar delen er forbi (faerdig eller sprunget over), tier den. */
    function vagt(g) {
      function ok() { return g === gen; }
      function cb(fn) { return fn ? function () { if (ok()) fn.apply(null, arguments); } : fn; }
      function hvis(navn) { return function () { if (ok()) return J[navn].apply(null, arguments); }; }
      return {
        sige: function (t, fn) { if (ok()) J.sige(t, cb(fn)); },
        klip: function (o, fn) { if (ok()) J.klip(o, cb(fn)); },
        raekke: function (tr, fn) { if (ok()) J.raekke(tr, cb(fn)); },
        tie: hvis('tie'), tone: hvis('tone'), melodi: hvis('melodi'), dunk: hvis('dunk'), klik: hvis('klik'), fest: hvis('fest'),
        motivKilde: J.motivKilde, paaPlads: J.paaPlads, tegnBaggrund: J.tegnBaggrund, W: J.W, H: J.H
      };
    }
    function hp() { var r = Math.min(34, J.H() * 0.05); return { x: J.W() - r - 18, y: r + 18, r: r }; }
    function fremPlads() { var h = hp(); return { x: h.x, y: h.y + h.r * 2 + 16, r: h.r }; }
    function prikPlads(i) { var F = fremPlads(), r = Math.max(8, F.r * 0.3); return { x: F.x, y: F.y + F.r + 24 + i * r * 2.9, r: r }; }
    function start(n) {
      gen++; J.tie(); nr = n; skifter = false;
      var del = f.dele[nr], L = LEGE[del.type], g = gen;
      // En laage kan have dele fra to historier: hver del faar sin egen dag (figurerne, Pelle moeder)
      var dagen = (window.Kalender && del.dag && window.Kalender.DAGE[del.dag - 1]) || dag;
      aktuel = L ? L(del, dagen, vagt(g), function () { if (g === gen) delFaerdig(); }) : null;
      if (!aktuel) delFaerdig();
    }
    /** Den lille fejring: en melodi, konfetti, og prikken bliver til en stjerne. */
    function delFaerdig() {
      gen++; skifter = true;
      var g = gen, p = prikPlads(nr);
      prik[nr].fyldt = 0.001; prik[nr].hop = 1;
      J.melodi([784, 988, 1175], 80);
      J.fest(J.W() / 2, J.H() * 0.42, 26, 260); J.fest(p.x, p.y, 12, 150, 'gnist');
      if (nr >= f.dele.length - 1) { setTimeout(function () { if (g === gen) slutNu(); }, 600); return; }
      setTimeout(function () { if (g === gen) start(nr + 1); }, 1400);
    }
    function spring() {
      J.tone(660, 0.1); frem.ryst = 0.4;
      if (!prik[nr].fyldt) prik[nr].sprunget = true;
      if (nr >= f.dele.length - 1) { gen++; J.tie(); slutNu(); } else start(nr + 1);
    }
    /** Den store fejring kommer fra game.js; her hopper alle stjernerne, og der kommer mere konfetti. */
    function slutNu() {
      if (slut) return;
      slut = true; gen++;
      prik.forEach(function (q, i) { setTimeout(function () { q.hop = 1; }, i * 90); });
      J.fest(J.W() * 0.5, J.H() * 0.5, 50, 340);
      faerdig();
    }
    start(0);
    return {
      info: function () {
        var del = f.dele[nr];
        return { del: nr, antal: f.dele.length, type: del && del.type, variant: del && del.variant, skifter: skifter, slut: slut, frem: fremPlads(),
          leg: aktuel && aktuel.info ? aktuel.info() : null };
      },
      gentag: function () { if (!skifter && !slut && aktuel && aktuel.gentag) aktuel.gentag(); },
      opdater: function (dt) {
        tid += dt; ned(frem, 'ryst', dt);
        prik.forEach(function (q) { if (q.fyldt > 0) q.fyldt = Math.min(1, q.fyldt + dt * 3); ned(q, 'hop', dt, 1.6); });
        if (aktuel && aktuel.opdater) aktuel.opdater(dt);
      },
      tegn: function (c, W, H) {
        if (aktuel) aktuel.tegn(c, W, H);
        if (slut) { prik.forEach(function (q, i) { var p = prikPlads(i); if (q.sprunget) { c.fillStyle = 'rgba(138,102,61,.25)'; c.beginPath(); c.arc(p.x, p.y, p.r * 0.8, 0, 7); c.fill(); } else M.stjerne(c, p.x, p.y - Math.sin(q.hop * Math.PI) * 10, p.r * 1.25); }); return; }
        var F = fremPlads();
        pilFrem(c, F.x + rystX(frem), F.y, F.r);
        // Prikkerne: én for hver del. Faerdige er stjerner, den nuvaerende pulserer.
        prik.forEach(function (q, i) {
          var p = prikPlads(i), y = p.y - Math.sin(q.hop * Math.PI) * 10;
          if (q.fyldt > 0) { M.stjerne(c, p.x, y, p.r * (0.8 + 0.45 * blød(q.fyldt))); return; }
          c.save();
          if (i === nr && !skifter) {
            c.strokeStyle = 'rgba(240,196,106,' + (0.7 + 0.3 * Math.sin(tid * 4)) + ')'; c.lineWidth = 3;
            c.beginPath(); c.arc(p.x, y, p.r * (1.1 + Math.sin(tid * 4) * 0.08), 0, 7); c.stroke();
          }
          c.fillStyle = q.sprunget ? 'rgba(138,102,61,.25)' : 'rgba(248,241,230,.9)'; c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 2;
          c.beginPath(); c.arc(p.x, y, p.r * 0.8, 0, 7); c.fill(); c.stroke();
          c.restore();
        });
      },
      ned: function (x, y, id) {
        if (slut) return;
        var F = fremPlads();
        if (Math.hypot(x - F.x, y - F.y) < F.r + 10) { spring(); return; }
        if (!skifter && aktuel && aktuel.ned) aktuel.ned(x, y, id);
      },
      flyt: function (x, y, id) { if (!skifter && aktuel && aktuel.flyt) aktuel.flyt(x, y, id); },
      op: function (x, y, id) { if (aktuel && aktuel.op) aktuel.op(x, y, id); }
    };
  }

  /* Alle dagenes typer starter serien; delene finder selv deres skaerm i LEGE. */
  window.JulLege = { dele: LEGE, serie: serie };
  ['tael', 'se', 'flest', 'regn', 'spor', 'forlyd', 'rim', 'klap', 'pynt', 'venner', 'puslespil'].forEach(function (t) { window.JulLege[t] = serie; });
})();
