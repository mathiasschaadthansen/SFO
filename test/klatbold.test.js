/**
 * Test af Klatbold — koeres med `npm test`. Kraever ingen browser.
 * Fysikken ligger i games/klatbold/js/physics.js uden DOM.
 */
'use strict';

const path = require('path');
const { Klatbold } = require(path.join(__dirname, '..', 'games', 'klatbold', 'js', 'physics.js'));
const I = Klatbold.INDSTIL;

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

const dt = 1 / 60;
const stille = [{ retning: 0, hop: false }, { retning: 0, hop: false }];

function koer(kamp, sekunder, inputs, hvert) {
  for (let f = 0; f < sekunder * 60; f++) {
    Klatbold.opdater(kamp, inputs || stille, dt);
    if (hvert && hvert(kamp, f) === true) return f / 60;
  }
  return sekunder;
}

console.log('\nKlatbold\n');

/* Bolden falder til ro paa jorden */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter.forEach(k => { k.x = k.spiller === 0 ? 60 : I.bredde - 60; });
  kamp.bold.x = I.bredde / 2; kamp.bold.y = 400;
  koer(kamp, 6);
  tjek('bolden falder til ro paa jorden',
    Math.abs(kamp.bold.y - I.boldRadius) < 0.5 && kamp.bold.vy === 0,
    'y=' + kamp.bold.y.toFixed(1) + ' vy=' + kamp.bold.vy.toFixed(1));
}

/* Rullende bold under overliggeren giver maal til den anden */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter[0].x = I.bredde * 0.45;
  kamp.bold.x = I.bredde * 0.3; kamp.bold.y = I.boldRadius; kamp.bold.vx = -400; kamp.bold.vy = 0;
  const t = koer(kamp, 5, null, k => k.nytMaal >= 0);
  tjek('bold i venstre maal giver point til spiller 1', kamp.maal[1] === 1 && kamp.maal[0] === 0,
    'maal=' + kamp.maal + ' efter ' + t + ' s');
  tjek('bolden laegges paa igen efter maal', kamp.pause > 0 && Math.abs(kamp.bold.x - I.bredde / 2) < 100);
}

/* Bold der falder ovenfra rammer overliggeren og gaar ikke i maal */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter[0].x = I.bredde * 0.45;
  kamp.bold.x = I.maalDybde * 0.5; kamp.bold.y = 400; kamp.bold.vx = 0; kamp.bold.vy = 0;
  let iMaalet = false;
  koer(kamp, 3, null, k => { if (k.bold.x < I.maalDybde && k.bold.y < I.maalHoejde) iMaalet = true; });
  tjek('overliggeren holder bolden ude ovenfra, og den triller ned foran maalet',
    kamp.maal[1] === 0 && !iMaalet && kamp.bold.x > I.maalDybde,
    'i maalet=' + iMaalet + ' x=' + kamp.bold.x.toFixed(0) + ' maal=' + kamp.maal);
}

/* Hoej bold over overliggeren rammer bagvaeggen og kommer tilbage */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter[0].x = I.bredde * 0.45;   // vaek fra boldens vej
  kamp.bold.x = 200; kamp.bold.y = 400; kamp.bold.vx = -700; kamp.bold.vy = 300;
  koer(kamp, 0.6);
  tjek('bold over maalet rammer vaeggen og kommer tilbage', kamp.bold.vx > 0 && kamp.maal[1] === 0,
    'vx=' + kamp.bold.vx.toFixed(0));
}

/* Klatterne kan ikke krydse midten, og hoppet naar op til overliggeren */
{
  const kamp = Klatbold.nyKamp(2);
  koer(kamp, 3, [{ retning: 1, hop: false }, { retning: -1, hop: false }]);
  tjek('spiller 1 bliver paa venstre halvdel', kamp.klatter[0].x <= I.bredde / 2 - I.klatRadius + 0.01);
  tjek('spiller 2 bliver paa hoejre halvdel', kamp.klatter[1].x >= I.bredde / 2 + I.klatRadius - 0.01);

  let top = 0;
  koer(kamp, 1.5, [{ retning: 0, hop: true }, stille[1]], k => { top = Math.max(top, k.klatter[0].y); });
  tjek('et hop loefter klatten mindst 90 px', top >= 90, top.toFixed(0) + ' px');
  tjek('klatten kan naa en bold i overliggerhoejde', top + I.klatRadius + I.boldRadius >= I.maalHoejde - 10,
    (top + I.klatRadius + I.boldRadius).toFixed(0) + ' px raekkevidde, overligger ' + I.maalHoejde);
}

/* Doedbold: en bold der ligger stille, laegges paa igen i midten */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter[0].x = I.bredde * 0.45;
  kamp.bold.x = 150; kamp.bold.y = I.boldRadius; kamp.bold.vx = 0; kamp.bold.vy = 0;
  let t = koer(kamp, 8, null, k => k.doedbold);
  tjek('en doed bold laegges paa igen inden for 5 sekunder', kamp.doedbold && t < 5 && Math.abs(kamp.bold.x - I.bredde / 2) < 1,
    'efter ' + t.toFixed(1) + ' s, x=' + kamp.bold.x.toFixed(0));
}

/* Bold der lander oven paa overliggeren triller ned paa banen */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.klatter[0].x = I.bredde * 0.45;
  kamp.bold.x = I.maalDybde * 0.5; kamp.bold.y = I.maalHoejde + I.boldRadius + 1; kamp.bold.vx = 0; kamp.bold.vy = 0;
  koer(kamp, 4);
  tjek('bold paa overliggeren triller ned paa banen', kamp.bold.y < I.maalHoejde && kamp.bold.x > I.maalDybde,
    'x=' + kamp.bold.x.toFixed(0) + ' y=' + kamp.bold.y.toFixed(0));
}

/* Klat der loeber ind i bolden sender den mod modstanderen */
{
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  kamp.bold.x = I.bredde * 0.35; kamp.bold.y = I.boldRadius; kamp.bold.vx = 0; kamp.bold.vy = 0;
  kamp.klatter[0].x = I.bredde * 0.2;
  let ramte = false, vxEfter = 0;
  koer(kamp, 1.5, [{ retning: 1, hop: false }, stille[1]], k => { if (k.klatter[0].ramteBold) { ramte = true; vxEfter = k.bold.vx; return true; } });
  tjek('klatten rammer bolden og sender den fremad', ramte && vxEfter > 300,
    'ramte=' + ramte + ' vx=' + vxEfter.toFixed(0));
}

/* En bold der lander stille oven paa en klat triller af mod modstanderen */
{
  Klatbold.saetSvaerhed(2);   // ingen skudhjaelp, saa det er selve reglen der testes
  const kamp = Klatbold.nyKamp(2);
  kamp.pause = 0;
  const k = kamp.klatter[0];
  kamp.bold.x = k.x; kamp.bold.y = I.klatRadius + I.boldRadius + 2; kamp.bold.vx = 0; kamp.bold.vy = 0;
  koer(kamp, 2);
  tjek('bold paa hovedet triller af mod modstanderen', kamp.bold.x > k.x + I.klatRadius,
    'x=' + kamp.bold.x.toFixed(0) + ' klat=' + k.x.toFixed(0));
  Klatbold.saetSvaerhed(0);
}

/* Skudhjaelp paa 1 stjerne sender et tilfaeldigt traef mod modstanderens maal */
{
  const resultat = [0, 2].map(niveau => {
    Klatbold.saetSvaerhed(niveau);
    const kamp = Klatbold.nyKamp(2);
    kamp.pause = 0;
    kamp.klatter[0].x = I.bredde * 0.3;
    kamp.bold.x = I.bredde * 0.3 - 30; kamp.bold.y = 260; kamp.bold.vx = 0; kamp.bold.vy = 0;  // falder ned paa klattens bagside
    let vx = 0;
    koer(kamp, 2.5, null, k => { if (k.klatter[0].ramteBold) { vx = k.bold.vx; return true; } });
    return vx;
  });
  Klatbold.saetSvaerhed(0);
  tjek('skudhjaelp paa 1 stjerne sender bolden mere fremad end paa 3', resultat[0] > resultat[1] + 50,
    '1 stjerne vx=' + resultat[0].toFixed(0) + ', 3 stjerner vx=' + resultat[1].toFixed(0));
}

/* AI'en naar bolden og slaar den tilbage, paa alle svaerhedsgrader */
Klatbold.SVAERHED.forEach((s, niveau) => {
  Klatbold.saetSvaerhed(niveau);
  const kamp = Klatbold.nyKamp(1);
  kamp.pause = 0;
  kamp.bold.x = I.bredde * 0.6; kamp.bold.y = 300; kamp.bold.vx = 250; kamp.bold.vy = 0;
  let ramte = false, vxEfter = 0;
  const t = koer(kamp, 6, null, k => { if (k.klatter[1].ramteBold) { ramte = true; vxEfter = k.bold.vx; return true; } });
  // Paa 1 stjerne er AI'en med vilje klodset, saa der kraeves kun at den naar bolden
  tjek('AI paa ' + (niveau + 1) + ' stjerne(r) naar bolden' + (niveau ? ' og slaar den tilbage' : ''),
    ramte && (niveau === 0 || vxEfter < 0),
    'ramte=' + ramte + ' vx=' + vxEfter.toFixed(0) + ' efter ' + t.toFixed(1) + ' s');
});
Klatbold.saetSvaerhed(0);

/* En kamp mellem to AI'er bliver faerdig, og der scores rimeligt tit */
{
  Klatbold.saetSvaerhed(1);
  const kamp = Klatbold.nyKamp(1);
  kamp.klatter[0].erAI = true;
  const t = koer(kamp, 240, null, k => k.faerdig);
  const maal = kamp.maal[0] + kamp.maal[1];
  tjek('en kamp mellem to AI\'er bliver faerdig', kamp.faerdig, 'maal=' + kamp.maal + ' efter ' + t.toFixed(0) + ' s');
  tjek('der scores mindst hvert 30. sekund', kamp.faerdig && t / maal < 30, (t / Math.max(1, maal)).toFixed(0) + ' s pr. maal');
  // Et skridts tyngdekraft kan naa at laegge sig oven paa graensen, foer kampen stopper ved sidste maal
  const graense = I.boldMaksFart + I.tyngde / 120 + 1;
  tjek('bolden bliver aldrig sindssygt hurtig', Math.hypot(kamp.bold.vx, kamp.bold.vy) <= graense,
    Math.hypot(kamp.bold.vx, kamp.bold.vy).toFixed(0) + ' > ' + graense.toFixed(0));
  Klatbold.saetSvaerhed(0);
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
