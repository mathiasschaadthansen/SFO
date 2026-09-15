/**
 * Fysik og AI for Klatbold.
 *
 * To klatter (halvcirkler) paa hver sin banehalvdel, én bold, to maal.
 * Ligger for sig selv og roerer hverken DOM eller canvas, saa den kan
 * koeres i Node uden browser. Se test/klatbold.test.js.
 *
 * Koordinater: x fra venstre, y fra JORDEN og opad. Tegningen vender y.
 * Spiller 0 staar til venstre og scorer i det hoejre maal.
 * Spiller 1 staar til hoejre og scorer i det venstre maal.
 */
(function (rod) {
  'use strict';

  var INDSTIL = {
    bredde:        1000,
    hoejde:        560,
    tyngde:        1900,   // px/s^2
    klatRadius:    52,
    klatFart:      430,    // px/s sidelaens
    hopFart:       640,    // px/s opad ved afsaet. Hop = hopFart^2 / (2*tyngde) = 108 px
    boldRadius:    17,
    boldHop:       0.72,   // hvor meget af farten bolden beholder naar den rammer jorden
    boldVaeg:      0.75,   // ... og vaeggen eller overliggeren
    boldKlat:      0.9,    // ... og en klat
    boldRul:       1.4,    // hvor hurtigt bolden mister fart naar den ruller paa jorden
    boldMaksFart:  1150,
    maalHoejde:    175,    // overliggerens hoejde over jorden
    maalDybde:     48,     // hvor langt maalet gaar ind paa banen
    maal:          5,      // maal der skal til for at vinde
    pauseEfterMaal: 1.6,   // sekunder foer bolden laegges paa igen
    doedbold:      3.0,    // sekunder bolden maa ligge stille foer den laegges paa igen
    skudHjaelp:    120,    // px/s der laegges til mod modstanderens maal naar et barn rammer bolden
    // AI
    aiFart:        0.85,   // andel af klatFart
    aiReaktion:    0.22,   // sekunder mellem AI'en kigger paa bolden
    aiHopIver:     0.6,    // 0-1: hvor gerne AI'en hopper, afgoeres hver gang den kigger
    aiFejl:        0,      // px AI'en kan tage fejl af hvor bolden lander
    aiDoven:       0,      // 0-1: chance for at AI'en bare gaar hjem i stedet for efter bolden
    aiBag:         0.55    // hvor langt bag bolden AI'en stiller sig (andel af klatRadius)
  };

  /**
   * Svaerhedsgrader, vaelges med stjerner i menuen. De styrer baade AI'en
   * og boldens tempo, saa 1 stjerne ogsaa er roligere med to boern.
   *   1 stjerne: langsom bold, skudhjaelp, langsom AI der tit kommer for sent.
   *   2 stjerner: normal bold, lidt hjaelp, AI lige saa hurtig som barnet.
   *   3 stjerner: hurtig bold, ingen hjaelp, AI hurtigere end barnet.
   */
  var SVAERHED = [
    { boldMaksFart: 760,  skudHjaelp: 120, aiFart: 0.6,  aiReaktion: 0.5,  aiHopIver: 0.35, aiFejl: 70, aiDoven: 0.35, aiBag: 0.2 },
    { boldMaksFart: 980,  skudHjaelp: 50,  aiFart: 0.95, aiReaktion: 0.22, aiHopIver: 0.7,  aiFejl: 25, aiDoven: 0.1,  aiBag: 0.45 },
    { boldMaksFart: 1150, skudHjaelp: 0,   aiFart: 1.15, aiReaktion: 0.06, aiHopIver: 1.0,  aiFejl: 0,  aiDoven: 0,    aiBag: 0.55 }
  ];

  function saetSvaerhed(niveau) {
    var s = SVAERHED[Math.max(0, Math.min(SVAERHED.length - 1, niveau | 0))];
    Object.keys(s).forEach(function (k) { INDSTIL[k] = s[k]; });
    return s;
  }

  function nyKlat(spiller, erAI) {
    var B = INDSTIL.bredde;
    return {
      spiller: spiller,
      erAI: !!erAI,
      x: spiller === 0 ? B * 0.25 : B * 0.75,
      y: 0,
      vx: 0,
      vy: 0,
      paaJorden: true,
      landede: false,        // true i det skridt klatten lander (til lyd/squash)
      ramteBold: false,      // true i det skridt klatten rammer bolden
      aiMaal: null,          // hvor AI'en vil hen
      aiTimer: 0,
      hopper: false
    };
  }

  function nyBold(mod) {
    // Bolden laegges paa i midten, lidt oppe, og falder ned mod den der
    // lige har faaet et maal imod sig (mod = 0 eller 1), saa de faar den.
    var B = INDSTIL.bredde;
    return {
      x: B / 2 + (mod === 0 ? -80 : mod === 1 ? 80 : 0),
      y: 320,
      vx: 0,
      vy: 0,
      r: INDSTIL.boldRadius,
      sidsteRoert: -1,
      hoppede: false         // true i det skridt bolden rammer noget (til lyd)
    };
  }

  function nyKamp(antalSpillere) {
    return {
      klatter: [nyKlat(0, false), nyKlat(1, antalSpillere < 2)],
      bold: nyBold(-1),
      maal: [0, 0],
      pause: 0.8,            // sekunder foer bolden er i spil
      stilleTid: 0,          // hvor laenge bolden har ligget stille
      doedbold: false,       // true i det skridt bolden laegges paa igen
      sidsteMaal: -1,        // hvem scorede sidst (-1 ingen)
      nytMaal: -1,           // saettes i det skridt der scores, ellers -1
      faerdig: false,
      vinder: -1
    };
  }

  /** Klattens halvdel: den maa ikke krydse midten. */
  function begraens(klat) {
    var R = INDSTIL.klatRadius, B = INDSTIL.bredde;
    var min = klat.spiller === 0 ? R : B / 2 + R;
    var maks = klat.spiller === 0 ? B / 2 - R : B - R;
    if (klat.x < min) klat.x = min;
    if (klat.x > maks) klat.x = maks;
  }

  /**
   * input: { retning: -1|0|1, hop: bool } for spillerstyrede klatter.
   */
  function opdaterKlat(klat, input, dt) {
    klat.landede = false;
    klat.vx = input.retning * INDSTIL.klatFart * (klat.erAI ? INDSTIL.aiFart : 1);
    klat.x += klat.vx * dt;
    begraens(klat);

    if (input.hop && klat.paaJorden) {
      klat.vy = INDSTIL.hopFart;
      klat.paaJorden = false;
      klat.hopper = true;
    }
    if (!klat.paaJorden) {
      klat.vy -= INDSTIL.tyngde * dt;
      klat.y += klat.vy * dt;
      if (klat.y <= 0) {
        klat.y = 0;
        klat.vy = 0;
        klat.paaJorden = true;
        klat.landede = true;
        klat.hopper = false;
      }
    }
  }

  function begraensFart(bold) {
    var f = Math.hypot(bold.vx, bold.vy);
    if (f > INDSTIL.boldMaksFart) {
      bold.vx *= INDSTIL.boldMaksFart / f;
      bold.vy *= INDSTIL.boldMaksFart / f;
    }
  }

  /** Bold mod cirkel (klat eller maalstolpe). Returnerer true ved traef. */
  function boldModCirkel(bold, cx, cy, radius, cvx, cvy, elastik) {
    var dx = bold.x - cx, dy = bold.y - cy;
    var d = Math.hypot(dx, dy);
    var min = radius + bold.r;
    if (d >= min || d < 0.0001) return false;
    var nx = dx / d, ny = dy / d;
    bold.x = cx + nx * min;
    bold.y = cy + ny * min;
    var rvx = bold.vx - cvx, rvy = bold.vy - cvy;
    var vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      bold.vx -= (1 + elastik) * vn * nx;
      bold.vy -= (1 + elastik) * vn * ny;
    }
    return true;
  }

  /** Ét lille fysikskridt for bolden. Returnerer 0/1 hvis der blev scoret paa spiller 0/1's maal, ellers -1. */
  function opdaterBold(kamp, dt) {
    var bold = kamp.bold;
    var B = INDSTIL.bredde, H = INDSTIL.hoejde, r = bold.r;
    var MH = INDSTIL.maalHoejde, MD = INDSTIL.maalDybde;
    var førY = bold.y;

    bold.vy -= INDSTIL.tyngde * dt;
    bold.x += bold.vx * dt;
    bold.y += bold.vy * dt;

    // Jorden
    if (bold.y < r) {
      bold.y = r;
      if (bold.vy < 0) {
        if (bold.vy < -60) bold.hoppede = true;
        bold.vy = -bold.vy * INDSTIL.boldHop;
        if (Math.abs(bold.vy) < 40) bold.vy = 0;
      }
      bold.vx *= Math.max(0, 1 - INDSTIL.boldRul * dt);
    }
    // Loftet
    if (bold.y > H - r) { bold.y = H - r; if (bold.vy > 0) { bold.vy = -bold.vy * INDSTIL.boldVaeg; bold.hoppede = true; } }

    // Overliggere: vandret bjaelke fra vaeggen og MD ind paa banen, i hoejden MH
    [0, 1].forEach(function (side) {
      var indenfor = side === 0 ? bold.x - r < MD : bold.x + r > B - MD;
      if (!indenfor) return;
      if (førY - r >= MH && bold.y - r < MH && bold.vy < 0) {          // lander oven paa
        bold.y = MH + r; bold.vy = -bold.vy * INDSTIL.boldVaeg; bold.hoppede = true;
        // Overliggeren er rund: en bold der naesten ligger stille triller ind
        // mod banen i stedet for at blive liggende. Kun ét skub, ikke ét pr. hop.
        if (Math.abs(bold.vx) < 90) bold.vx += (side === 0 ? 1 : -1) * 90;
      } else if (førY + r <= MH && bold.y + r > MH && bold.vy > 0) {   // rammer nedefra
        bold.y = MH - r; bold.vy = -bold.vy * INDSTIL.boldVaeg; bold.hoppede = true;
      }
    });
    // Forreste ende af overliggeren som en lille stolpe. Ikke naar bolden
    // ligger oven paa bjaelken — saa skal den kunne trille ud over kanten.
    if (bold.y - r < MH - 1) {
      if (boldModCirkel(bold, MD, MH, 6, 0, 0, INDSTIL.boldVaeg)) bold.hoppede = true;
      if (boldModCirkel(bold, B - MD, MH, 6, 0, 0, INDSTIL.boldVaeg)) bold.hoppede = true;
    }

    // Maal: hele bolden inde i maalet under overliggeren
    if (bold.x + r < MD && bold.y + r < MH) return 0;
    if (bold.x - r > B - MD && bold.y + r < MH) return 1;

    // Vaegge (bag maalene)
    if (bold.x < r) { bold.x = r; if (bold.vx < 0) { bold.vx = -bold.vx * INDSTIL.boldVaeg; bold.hoppede = true; } }
    if (bold.x > B - r) { bold.x = B - r; if (bold.vx > 0) { bold.vx = -bold.vx * INDSTIL.boldVaeg; bold.hoppede = true; } }

    // Klatter
    kamp.klatter.forEach(function (k) {
      if (boldModCirkel(bold, k.x, k.y, INDSTIL.klatRadius, k.vx, k.vy, INDSTIL.boldKlat)) {
        var mod = k.spiller === 0 ? 1 : -1;   // retning mod modstanderens maal
        var ny = (bold.y - k.y) / (INDSTIL.klatRadius + r);   // 1 = lige oven paa hovedet
        var fart = Math.hypot(bold.vx, bold.vy);
        if (ny > 0.8 && fart < 200) {
          // Bold der ligger naesten stille oven paa hovedet triller af mod modstanderen
          bold.vx = mod * 170;
          bold.vy = 220;
        } else {
          // Sidetraef naer jorden: et lille skub opad, saa bolden ikke ruller doedt
          if (bold.vy < 120 && bold.y < INDSTIL.klatRadius + r + 4) bold.vy += 120;
          // Skudhjaelp: boern rammer tilfaeldigt, saa bolden faar et lille
          // skub mod modstanderens maal. 0 paa 3 stjerner.
          if (!k.erAI && INDSTIL.skudHjaelp > 0) {
            bold.vx += mod * INDSTIL.skudHjaelp;
            bold.vy += INDSTIL.skudHjaelp * 0.4;
          }
        }
        k.ramteBold = true;
        bold.sidsteRoert = k.spiller;
      }
    });

    begraensFart(bold);
    return -1;
  }

  /**
   * AI: stil dig lidt bag bolden (set fra eget maal) og hop naar den er taet paa.
   * Kigger kun paa bolden hvert aiReaktion sekund, saa den kan komme for sent.
   */
  function aiInput(klat, kamp, dt) {
    var bold = kamp.bold;
    var R = INDSTIL.klatRadius;
    var hjem = klat.spiller === 0 ? INDSTIL.bredde * 0.3 : INDSTIL.bredde * 0.7;
    klat.aiTimer -= dt;
    if (klat.aiTimer <= 0 || klat.aiMaal === null) {
      klat.aiTimer = INDSTIL.aiReaktion;
      // Alle tilfaeldige valg traeffes her, én gang pr. kig — ikke pr. fysikskridt.
      klat.aiVilHoppe = Math.random() < INDSTIL.aiHopIver;
      if (Math.random() < INDSTIL.aiDoven) {
        // Doven: gaar bare hjem denne gang
        klat.aiMaal = hjem;
      } else {
        // Hvor lander bolden? Simpelt gaet: foelg vx i den tid det tager at falde
        var tid = 0;
        if (bold.vy < 0 || bold.y > R) {
          var g = INDSTIL.tyngde, h = bold.y - R;
          // loes h + vy*t - g/2 t^2 = 0 for t > 0
          var disc = bold.vy * bold.vy + 2 * g * Math.max(0, h);
          tid = (bold.vy + Math.sqrt(disc)) / g;
        }
        var landX = bold.x + bold.vx * Math.min(tid, 0.9);
        // Staa lidt bag bolden, saa den bliver ramt mod modstanderens maal
        var bag = (klat.spiller === 0 ? -1 : 1) * R * INDSTIL.aiBag;
        var fejl = (Math.random() * 2 - 1) * INDSTIL.aiFejl;
        klat.aiMaal = landX + bag + fejl;
        // Bold langt paa modstanderens halvdel: gaa hjem mod midten af egen halvdel
        var egenHalvdel = klat.spiller === 0 ? bold.x < INDSTIL.bredde * 0.6 : bold.x > INDSTIL.bredde * 0.4;
        if (!egenHalvdel) klat.aiMaal = hjem;
      }
    }
    var dx = klat.aiMaal - klat.x;
    var retning = Math.abs(dx) < 6 ? 0 : (dx > 0 ? 1 : -1);

    var taet = Math.abs(bold.x - klat.x) < R + bold.r + 40;
    var hoejde = bold.y - klat.y;
    var hop = taet && hoejde > R * 0.6 && hoejde < R + 200 && !!klat.aiVilHoppe;
    return { retning: retning, hop: hop };
  }

  /**
   * Ét skridt for hele kampen. inputs: [{retning,hop}, {retning,hop}] for
   * spillerstyrede klatter (AI'ens felt ignoreres).
   */
  function opdater(kamp, inputs, dt) {
    kamp.nytMaal = -1;
    kamp.doedbold = false;
    kamp.bold.hoppede = false;
    kamp.klatter.forEach(function (k) { k.ramteBold = false; });
    if (kamp.faerdig) return;

    var trin = Math.max(1, Math.ceil(dt / (1 / 120)));
    var h = dt / trin;
    for (var t = 0; t < trin; t++) {
      kamp.klatter.forEach(function (k, i) {
        var input = k.erAI ? aiInput(k, kamp, h) : (inputs[i] || { retning: 0, hop: false });
        opdaterKlat(k, input, h);
      });
      if (kamp.pause > 0) {
        kamp.pause -= h;
        // Bolden holdes stille i luften til spillet gaar i gang
        if (kamp.pause <= 0) { kamp.pause = 0; kamp.bold.vy = 0; }
        continue;
      }
      var maalPaa = opdaterBold(kamp, h);

      // Doedbold: ligger bolden stille (fx paa en halvdel hvor ingen roerer
      // den), laegges den paa igen i midten, saa spillet aldrig gaar i staa.
      var bold = kamp.bold;
      // Stille = naesten ingen fart, uanset om den ligger paa jorden, en klat eller overliggeren
      var stille = Math.abs(bold.vx) < 8 && Math.abs(bold.vy) < 60;
      kamp.stilleTid = stille ? kamp.stilleTid + h : 0;
      if (kamp.stilleTid > INDSTIL.doedbold) {
        kamp.bold = nyBold(-1);
        kamp.stilleTid = 0;
        kamp.pause = 0.6;
        kamp.doedbold = true;
        break;
      }

      if (maalPaa >= 0) {
        var scorer = 1 - maalPaa;
        kamp.maal[scorer]++;
        kamp.nytMaal = scorer;
        kamp.sidsteMaal = scorer;
        if (kamp.maal[scorer] >= INDSTIL.maal) {
          kamp.faerdig = true;
          kamp.vinder = scorer;
        } else {
          kamp.bold = nyBold(maalPaa);
          kamp.pause = INDSTIL.pauseEfterMaal;
        }
        break;
      }
    }
  }

  rod.Klatbold = {
    INDSTIL: INDSTIL,
    SVAERHED: SVAERHED,
    saetSvaerhed: saetSvaerhed,
    nyKamp: nyKamp,
    nyBold: nyBold,
    opdater: opdater,
    aiInput: aiInput
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
