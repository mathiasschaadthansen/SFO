/**
 * Fysik for Bobler.
 *
 * Bobler hopper rundt paa skaermen. Skyd dem med en lodret snor, saa deler
 * de sig i to mindre, til de mindste forsvinder. Banen er klaret naar alle
 * bobler er vaek. Bliver man ramt, er man svimmel et par sekunder — ingen
 * liv, intet game over. To spillere hjaelper hinanden.
 *
 * Specials falder ud af poppede bobler og samles op ved at gaa hen til dem:
 *   dobbelt  to snore ad gangen
 *   klaebe   snoren haenger fast i loftet et stykke tid
 *   frys     alle bobler staar stille et stykke tid
 *   skjold   naeste boble der rammer dig preller af
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
    skudPause:     0.22,   // sekunder mellem to skud naar knappen holdes nede
    // Tre stoerrelser: stor -> 2 mellem -> 4 smaa = 7 skud pr. stor boble.
    bobleStr:      [58, 40, 24],         // radius pr. stoerrelse, 0 = stoerst
    bobleHop:      [330, 275, 215],      // hvor hoejt hver stoerrelse hopper
    bobleVx:       [110, 135, 160],      // sidelaens fart pr. stoerrelse
    delFart:       260,    // fart opad naar en boble deler sig
    bobleFart:     1.0,    // ganges paa alle boblers fart (svaerhedsgrad)
    svimmelTid:    2.0,    // sekunder man er svimmel efter at vaere ramt
    pauseEfterBane: 2.2,   // sekunder mellem to baner
    platformTykkelse: 16,
    // Specials
    specialChance: 0.22,   // chance for at en poppet boble taber en special
    specialRadius: 18,
    specialLigger: 7.0,    // sekunder en special ligger paa jorden
    dobbeltTid:    9.0,
    klaebeTid:     9.0,    // saa laenge kan man skyde klaebesnore
    klaebeHaenger: 3.0,    // saa laenge haenger en klaebesnor i loftet
    frysTid:       4.0
  };

  var SPECIALS = ['dobbelt', 'klaebe', 'frys', 'skjold'];

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
   * Banerne. tema bestemmer baggrunden. Hver boble: x, stoerrelse (0-2),
   * retning (-1/1), starthoejde og valgfrit hvor mange sekunder inde i
   * banen den drypper ned fra oven. Platforme: x, hoejde, bredde.
   */
  var BANER = [
    { tema: 'strand', tempo: 1.00, bobler: [[500, 1, 1, 350]] },
    { tema: 'strand', tempo: 1.00, bobler: [[300, 0, 1, 380]] },
    { tema: 'strand', tempo: 1.05, bobler: [[250, 1, 1, 350], [750, 1, -1, 350]] },
    { tema: 'strand', tempo: 1.05, bobler: [[200, 0, 1, 380], [800, 2, -1, 300]], platforme: [[350, 200, 300]] },
    { tema: 'nat',    tempo: 1.10, bobler: [[200, 0, 1, 380], [800, 0, -1, 380]] },
    { tema: 'nat',    tempo: 1.10, bobler: [[150, 1, 1, 350], [500, 1, -1, 300], [850, 1, 1, 350], [500, 2, 1, 200, 4]] },
    { tema: 'nat',    tempo: 1.15, bobler: [[200, 0, 1, 380], [800, 0, -1, 380], [400, 2, 1, 250], [600, 2, -1, 250]], platforme: [[100, 180, 220], [680, 180, 220]] },
    { tema: 'nat',    tempo: 1.15, bobler: [[150, 0, 1, 380], [500, 0, 1, 300], [850, 0, -1, 380]] },
    { tema: 'bjerge', tempo: 1.20, bobler: [[150, 0, 1, 380], [850, 0, -1, 380], [350, 1, 1, 320], [650, 1, -1, 320], [450, 2, 1, 250, 3], [550, 2, -1, 250, 3]], platforme: [[400, 240, 200]] },
    { tema: 'bjerge', tempo: 1.20, bobler: [[120, 0, 1, 380], [380, 0, 1, 380], [620, 0, -1, 380], [880, 0, -1, 380]] },
    { tema: 'bjerge', tempo: 1.25, bobler: [[200, 1, 1, 350], [800, 1, -1, 350], [300, 0, 1, 380, 2], [700, 0, -1, 380, 5]], platforme: [[80, 160, 200], [720, 160, 200], [400, 280, 200]] },
    { tema: 'bjerge', tempo: 1.25, bobler: [[150, 0, 1, 380], [450, 0, -1, 380], [550, 0, 1, 380], [850, 0, -1, 380], [500, 2, 1, 200, 6]] }
  ];

  function nySpiller(spiller, antal) {
    return {
      spiller: spiller,
      x: antal === 1 ? INDSTIL.bredde / 2 : (spiller === 0 ? INDSTIL.bredde * 0.35 : INDSTIL.bredde * 0.65),
      vx: 0,
      svimmel: 0,
      skud: [],          // aktive snore: { x, y, klaeber, haenger }
      dobbelt: 0,        // sekunder tilbage med to snore
      klaebe: 0,         // sekunder tilbage med klaebesnor
      skjold: false,
      ramt: false,       // true i det skridt spilleren bliver ramt
      prellede: false,   // true i det skridt skjoldet tog et traef
      skoed: false,      // true i det skridt spilleren skyder
      samlede: null,     // navnet paa en special samlet op i dette skridt
      poppede: 0
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
    spil.tema = bane.tema;
    spil.bobler = [];
    spil.ventende = [];
    bane.bobler.forEach(function (b) {
      if (b[4]) spil.ventende.push({ x: b[0], str: b[1], retning: b[2], tid: b[4], tempo: bane.tempo });
      else spil.bobler.push(nyBoble(b[0], b[3], b[1], b[2], bane.tempo));
    });
    spil.platforme = (bane.platforme || []).map(function (p) {
      return { x: p[0], y: p[1], bredde: p[2], tykkelse: INDSTIL.platformTykkelse };
    });
    spil.specials = [];
    spil.frys = 0;
    spil.spillere.forEach(function (s) { s.skud = []; s.svimmel = 0; });
    spil.pause = 1.0;
  }

  function nytSpil(antalSpillere) {
    var spil = {
      spillere: [],
      bobler: [],
      ventende: [],       // bobler der drypper ned senere
      platforme: [],
      specials: [],       // specials der ligger paa jorden: { x, y, vy, type, tid }
      frys: 0,            // sekunder tilbage hvor boblerne staar stille
      tema: 'strand',
      bane: 0,
      pause: 0,
      poppet: [],         // bobler poppet i dette skridt
      dryppede: false,    // true i det skridt en boble dryppede ned
      baneKlaret: false,
      faerdig: false
    };
    for (var i = 0; i < antalSpillere; i++) spil.spillere.push(nySpiller(i, antalSpillere));
    lavBane(spil, 0);
    return spil;
  }

  function opdaterSpiller(s, input, spil, dt) {
    var R = INDSTIL.spillerRadius;
    var fart = INDSTIL.spillerFart * (s.svimmel > 0 ? 0.4 : 1);
    s.vx = input.retning * fart;
    s.x = Math.max(R, Math.min(INDSTIL.bredde - R, s.x + s.vx * dt));
    s.svimmel = Math.max(0, s.svimmel - dt);
    s.dobbelt = Math.max(0, s.dobbelt - dt);
    s.klaebe = Math.max(0, s.klaebe - dt);

    // Boern holder knappen nede. Saa skydes der igen, saa snart der er plads til
    // en ny snor, med en lille pause imellem, saa to snore ikke ligger oven i
    // hinanden. Et nyt tryk skyder med det samme.
    var maksSnore = s.dobbelt > 0 ? 2 : 1;
    var voksende = s.skud.filter(function (k) { return !k.haenger; }).length;
    s.skudPause = Math.max(0, (s.skudPause || 0) - dt);
    var nytTryk = input.skyd && !s.holdtSkyd;
    if (input.skyd && voksende < maksSnore && s.svimmel <= 0 && (nytTryk || s.skudPause <= 0)) {
      s.skud.push({ x: s.x, y: R * 2, klaeber: s.klaebe > 0, haenger: 0 });
      s.skoed = true;
      s.skudPause = INDSTIL.skudPause;
    }
    s.holdtSkyd = !!input.skyd;

    for (var i = s.skud.length - 1; i >= 0; i--) {
      var k = s.skud[i];
      if (k.haenger > 0) {
        k.haenger -= dt;
        if (k.haenger <= 0) s.skud.splice(i, 1);
        continue;
      }
      k.y += INDSTIL.skudFart * dt;
      if (k.y >= INDSTIL.hoejde) {
        if (k.klaeber) { k.y = INDSTIL.hoejde; k.haenger = INDSTIL.klaebeHaenger; }
        else s.skud.splice(i, 1);
      }
    }
  }

  function opdaterBoble(b, spil, dt) {
    var g = INDSTIL.tyngde;
    var førX = b.x, førY = b.y;
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

    // Platforme: bobler hopper paa dem og preller af under og paa siderne
    spil.platforme.forEach(function (p) {
      var top = p.y + p.tykkelse, bund = p.y;
      var indenforX = b.x + b.r > p.x && b.x - b.r < p.x + p.bredde;
      if (!indenforX) return;
      if (førY - b.r >= top && b.y - b.r < top && b.vy < 0) {
        b.y = top + b.r;
        b.vy = Math.sqrt(2 * g * INDSTIL.bobleHop[b.str]);
      } else if (førY + b.r <= bund && b.y + b.r > bund && b.vy > 0) {
        b.y = bund - b.r;
        b.vy = -b.vy * 0.5;
      } else if (b.y + b.r > bund && b.y - b.r < top) {
        // Rammer siden
        if (førX + b.r <= p.x && b.vx > 0) { b.x = p.x - b.r; b.vx = -b.vx; }
        else if (førX - b.r >= p.x + p.bredde && b.vx < 0) { b.x = p.x + p.bredde + b.r; b.vx = -b.vx; }
      }
    });
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
    if (Math.random() < INDSTIL.specialChance) {
      spil.specials.push({
        x: b.x, y: b.y, vy: 0,
        type: SPECIALS[Math.floor(Math.random() * SPECIALS.length)],
        tid: INDSTIL.specialLigger
      });
    }
  }

  function givSpecial(s, type) {
    if (type === 'dobbelt') s.dobbelt = INDSTIL.dobbeltTid;
    else if (type === 'klaebe') s.klaebe = INDSTIL.klaebeTid;
    else if (type === 'skjold') s.skjold = true;
    s.samlede = type;
  }

  /**
   * Ét skridt. inputs: [{retning, skyd}] pr. spiller.
   */
  function opdater(spil, inputs, dt) {
    spil.poppet = [];
    spil.baneKlaret = false;
    spil.dryppede = false;
    // Haendelses-flag nulstilles én gang pr. kald, ikke pr. delskridt,
    // ellers forsvinder en haendelse fra foerste delskridt igen.
    spil.spillere.forEach(function (s) {
      s.ramt = false; s.prellede = false; s.skoed = false; s.samlede = null;
    });
    if (spil.faerdig) return;

    var trin = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / trin;
    for (var t = 0; t < trin; t++) {
      spil.spillere.forEach(function (s, i) {
        opdaterSpiller(s, inputs[i] || { retning: 0, skyd: false }, spil, h);
      });
      if (spil.pause > 0) { spil.pause -= h; continue; }

      // Bobler der drypper ned fra oven
      for (var v = spil.ventende.length - 1; v >= 0; v--) {
        var w = spil.ventende[v];
        w.tid -= h;
        if (w.tid <= 0) {
          var ny = nyBoble(w.x, INDSTIL.hoejde - INDSTIL.bobleStr[w.str] - 4, w.str, w.retning, w.tempo);
          spil.bobler.push(ny);
          spil.ventende.splice(v, 1);
          spil.dryppede = true;
        }
      }

      spil.frys = Math.max(0, spil.frys - h);
      if (spil.frys <= 0) spil.bobler.forEach(function (b) { opdaterBoble(b, spil, h); });

      // Specials falder ned og ligger paa jorden et stykke tid
      var R = INDSTIL.spillerRadius, SR = INDSTIL.specialRadius;
      for (var q = spil.specials.length - 1; q >= 0; q--) {
        var sp = spil.specials[q];
        if (sp.y > SR) { sp.vy -= INDSTIL.tyngde * h; sp.y += sp.vy * h; if (sp.y < SR) { sp.y = SR; sp.vy = 0; } }
        else { sp.tid -= h; if (sp.tid <= 0) { spil.specials.splice(q, 1); continue; } }
        // Samles op af den foerste spiller der roerer den
        for (var si = 0; si < spil.spillere.length; si++) {
          var s0 = spil.spillere[si];
          var ddx = sp.x - s0.x, ddy = sp.y - R;
          if (ddx * ddx + ddy * ddy < (SR + R) * (SR + R)) {
            if (sp.type === 'frys') { spil.frys = INDSTIL.frysTid; s0.samlede = 'frys'; }
            else givSpecial(s0, sp.type);
            spil.specials.splice(q, 1);
            break;
          }
        }
      }

      // Snore mod bobler: én boble pr. snor pr. skridt
      spil.spillere.forEach(function (s) {
        for (var ki = s.skud.length - 1; ki >= 0; ki--) {
          var k = s.skud[ki];
          for (var i = 0; i < spil.bobler.length; i++) {
            if (snorRammer(k, spil.bobler[i])) {
              var b = spil.bobler.splice(i, 1)[0];
              pop(spil, b, s);
              if (!k.haenger) s.skud.splice(ki, 1);   // en haengende klaebesnor bliver haengende
              break;
            }
          }
        }
      });

      // Bobler mod spillere: svimmel, ikke doed. Frosne bobler goer ikke noget.
      if (spil.frys <= 0) {
        spil.spillere.forEach(function (s) {
          if (s.svimmel > 0) return;
          for (var i = 0; i < spil.bobler.length; i++) {
            var b = spil.bobler[i];
            var dx = b.x - s.x, dy = b.y - R;
            if (dx * dx + dy * dy < (b.r + R) * (b.r + R)) {
              if (s.skjold) {
                // Preller af: boblen skubbes fri af spilleren og opad
                s.skjold = false;
                s.prellede = true;
                b.y = Math.max(b.y, R + (b.r + R) + 2);   // spillerens centrum + begge radier
                b.vy = Math.max(b.vy, 320);
                b.vx = (dx >= 0 ? 1 : -1) * Math.abs(b.vx);
              } else {
                s.svimmel = INDSTIL.svimmelTid;
                s.skud = [];
                s.ramt = true;
              }
              break;
            }
          }
        });
      }

      if (spil.bobler.length === 0 && spil.ventende.length === 0) {
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
    SPECIALS: SPECIALS,
    BANER: BANER,
    saetSvaerhed: saetSvaerhed,
    nytSpil: nytSpil,
    opdater: opdater,
    snorRammer: snorRammer
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
