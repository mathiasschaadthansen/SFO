/**
 * Fysik for Bobler.
 *
 * Bobler hopper rundt paa skaermen. Skyd dem med en lodret snor, saa deler
 * de sig i to mindre, til de mindste forsvinder. Banen er klaret naar alle
 * bobler er vaek. Bliver man ramt, er man svimmel et par sekunder — ingen
 * liv, intet game over. To spillere hjaelper hinanden.
 *
 * Ingen DOM, saa filen kan testes i Node. Se test/bobler.test.js.
 * Koordinater: x fra venstre, y fra JORDEN og opad.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    bredde:        1000,
    hoejde:        600,
    tyngde:        520,
    spillerRadius: 26,
    spillerFart:   380,    // px/s
    skudFart:      950,    // px/s snoren vokser opad
    // Tre stoerrelser: stor -> 2 mellem -> 4 smaa = 7 skud pr. stor boble.
    // Fire stoerrelser gav 15 og blev for langt for 6-aarige.
    bobleStr:      [58, 40, 24],         // radius pr. stoerrelse, 0 = stoerst
    bobleHop:      [330, 275, 215],      // hvor hoejt hver stoerrelse hopper
    bobleVx:       [110, 135, 160],      // sidelaens fart pr. stoerrelse
    delFart:       260,    // fart opad naar en boble deler sig
    bobleFart:     1.0,    // ganges paa alle boblers fart (svaerhedsgrad)
    svimmelTid:    2.0,    // sekunder man er svimmel efter at vaere ramt
    pauseEfterBane: 2.2    // sekunder mellem to baner
  };

  /** Svaerhedsgrader: boblernes tempo og hvor laenge man er svimmel. */
  var SVAERHED = [
    { bobleFart: 0.7, svimmelTid: 1.2 },
    { bobleFart: 1.0, svimmelTid: 2.0 },
    { bobleFart: 1.3, svimmelTid: 2.5 }
  ];

  function saetSvaerhed(niveau) {
    var s = SVAERHED[Math.max(0, Math.min(SVAERHED.length - 1, niveau | 0))];
    Object.keys(s).forEach(function (k) { INDSTIL[k] = s[k]; });
    return s;
  }

  /**
   * Banerne. Hver boble: x, stoerrelse (0-3), retning (-1/1), starthoejde.
   * Tempoet stiger lidt for hver bane.
   */
  var BANER = [
    { tempo: 1.00, bobler: [[500, 1, 1, 350]] },
    { tempo: 1.00, bobler: [[300, 0, 1, 380]] },
    { tempo: 1.05, bobler: [[250, 1, 1, 350], [750, 1, -1, 350]] },
    { tempo: 1.05, bobler: [[200, 0, 1, 380], [800, 2, -1, 300]] },
    { tempo: 1.10, bobler: [[200, 0, 1, 380], [800, 0, -1, 380]] },
    { tempo: 1.10, bobler: [[150, 1, 1, 350], [500, 1, -1, 300], [850, 1, 1, 350], [500, 2, 1, 200]] },
    { tempo: 1.15, bobler: [[200, 0, 1, 380], [800, 0, -1, 380], [400, 2, 1, 250], [600, 2, -1, 250]] },
    { tempo: 1.15, bobler: [[150, 0, 1, 380], [500, 0, 1, 300], [850, 0, -1, 380]] },
    { tempo: 1.20, bobler: [[150, 0, 1, 380], [850, 0, -1, 380], [350, 1, 1, 320], [650, 1, -1, 320], [450, 2, 1, 250], [550, 2, -1, 250]] },
    { tempo: 1.25, bobler: [[120, 0, 1, 380], [380, 0, 1, 380], [620, 0, -1, 380], [880, 0, -1, 380]] }
  ];

  function nySpiller(spiller, antal) {
    return {
      spiller: spiller,
      x: antal === 1 ? INDSTIL.bredde / 2 : (spiller === 0 ? INDSTIL.bredde * 0.35 : INDSTIL.bredde * 0.65),
      vx: 0,
      svimmel: 0,
      skud: null,        // { x, y } y = snorens top
      ramt: false,       // true i det skridt spilleren bliver ramt
      skoed: false,      // true i det skridt spilleren skyder
      poppede: 0         // hvor mange bobler spilleren har poppet i alt
    };
  }

  function nyBoble(x, y, str, retning, tempo) {
    return {
      x: x, y: y, str: str, r: INDSTIL.bobleStr[str],
      vx: retning * INDSTIL.bobleVx[str] * tempo * INDSTIL.bobleFart,
      vy: 0,
      tempo: tempo
    };
  }

  function lavBane(spil, nr) {
    var bane = BANER[nr];
    spil.bobler = bane.bobler.map(function (b) { return nyBoble(b[0], b[3], b[1], b[2], bane.tempo); });
    spil.spillere.forEach(function (s) { s.skud = null; s.svimmel = 0; });
    spil.pause = 1.0;
  }

  function nytSpil(antalSpillere) {
    var spil = {
      spillere: [],
      bobler: [],
      bane: 0,
      pause: 0,
      poppet: [],         // bobler poppet i dette skridt (til lyd og partikler)
      baneKlaret: false,  // true i det skridt banen blev klaret
      faerdig: false
    };
    for (var i = 0; i < antalSpillere; i++) spil.spillere.push(nySpiller(i, antalSpillere));
    lavBane(spil, 0);
    return spil;
  }

  function opdaterSpiller(s, input, dt) {
    s.ramt = false;
    s.skoed = false;
    var R = INDSTIL.spillerRadius;
    var fart = INDSTIL.spillerFart * (s.svimmel > 0 ? 0.4 : 1);
    s.vx = input.retning * fart;
    s.x = Math.max(R, Math.min(INDSTIL.bredde - R, s.x + s.vx * dt));
    s.svimmel = Math.max(0, s.svimmel - dt);

    if (input.skyd && !s.skud && s.svimmel <= 0) {
      s.skud = { x: s.x, y: R * 2 };
      s.skoed = true;
    }
    if (s.skud) {
      s.skud.y += INDSTIL.skudFart * dt;
      if (s.skud.y >= INDSTIL.hoejde) s.skud = null;
    }
  }

  function opdaterBoble(b, dt) {
    var g = INDSTIL.tyngde;
    b.vy -= g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.y - b.r <= 0 && b.vy < 0) {
      b.y = b.r;
      // Hopper altid til samme hoejde, saa boernene kan laere moenstret
      b.vy = Math.sqrt(2 * g * INDSTIL.bobleHop[b.str]);
    }
    if (b.y + b.r >= INDSTIL.hoejde && b.vy > 0) { b.y = INDSTIL.hoejde - b.r; b.vy = -b.vy * 0.5; }
    if (b.x - b.r <= 0 && b.vx < 0) { b.x = b.r; b.vx = -b.vx; }
    if (b.x + b.r >= INDSTIL.bredde && b.vx > 0) { b.x = INDSTIL.bredde - b.r; b.vx = -b.vx; }
  }

  /** Rammer snoren (lodret fra jorden op til skud.y ved skud.x) boblen? */
  function snorRammer(skud, b) {
    if (b.y <= skud.y) return Math.abs(b.x - skud.x) < b.r;
    var dx = b.x - skud.x, dy = b.y - skud.y;
    return dx * dx + dy * dy < b.r * b.r;
  }

  function pop(spil, b, s) {
    spil.poppet.push({ x: b.x, y: b.y, str: b.str });
    if (s) s.poppede++;
    if (b.str < INDSTIL.bobleStr.length - 1) {
      var ny = b.str + 1;
      [-1, 1].forEach(function (retning) {
        var barn = nyBoble(b.x + retning * 6, b.y, ny, retning, b.tempo);
        barn.vy = INDSTIL.delFart;
        spil.bobler.push(barn);
      });
    }
  }

  /**
   * Ét skridt. inputs: [{retning, skyd}] pr. spiller.
   */
  function opdater(spil, inputs, dt) {
    spil.poppet = [];
    spil.baneKlaret = false;
    if (spil.faerdig) return;

    var trin = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / trin;
    for (var t = 0; t < trin; t++) {
      spil.spillere.forEach(function (s, i) {
        opdaterSpiller(s, inputs[i] || { retning: 0, skyd: false }, h);
      });
      if (spil.pause > 0) { spil.pause -= h; continue; }

      spil.bobler.forEach(function (b) { opdaterBoble(b, h); });

      // Snore mod bobler: én boble pr. snor pr. skridt
      spil.spillere.forEach(function (s) {
        if (!s.skud) return;
        for (var i = 0; i < spil.bobler.length; i++) {
          if (snorRammer(s.skud, spil.bobler[i])) {
            var b = spil.bobler.splice(i, 1)[0];
            pop(spil, b, s);
            s.skud = null;
            break;
          }
        }
      });

      // Bobler mod spillere: svimmel, ikke doed
      var R = INDSTIL.spillerRadius;
      spil.spillere.forEach(function (s) {
        if (s.svimmel > 0) return;
        for (var i = 0; i < spil.bobler.length; i++) {
          var b = spil.bobler[i];
          var dx = b.x - s.x, dy = b.y - R;
          if (dx * dx + dy * dy < (b.r + R) * (b.r + R)) {
            s.svimmel = INDSTIL.svimmelTid;
            s.skud = null;
            s.ramt = true;
            break;
          }
        }
      });

      if (spil.bobler.length === 0) {
        spil.baneKlaret = true;
        if (spil.bane + 1 >= BANER.length) {
          spil.faerdig = true;
        } else {
          spil.bane++;
          lavBane(spil, spil.bane);
          spil.pause = INDSTIL.pauseEfterBane;
        }
        break;
      }
    }
  }

  rod.Bobler = {
    INDSTIL: INDSTIL,
    SVAERHED: SVAERHED,
    BANER: BANER,
    saetSvaerhed: saetSvaerhed,
    nytSpil: nytSpil,
    opdater: opdater,
    snorRammer: snorRammer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
