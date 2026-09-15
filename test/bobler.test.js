/**
 * Test af Bobler — koeres med `npm test`. Kraever ingen browser.
 */
'use strict';

const path = require('path');
const { Bobler } = require(path.join(__dirname, '..', 'games', 'bobler', 'js', 'physics.js'));
const I = Bobler.INDSTIL;

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

const dt = 1 / 60;
const stille = [{ retning: 0, skyd: false }, { retning: 0, skyd: false }];

function koer(spil, sekunder, inputFn, hvert) {
  for (let f = 0; f < sekunder * 60; f++) {
    const inputs = inputFn ? inputFn(spil, f) : stille;
    Bobler.opdater(spil, inputs, dt);
    if (hvert && hvert(spil, f) === true) return f / 60;
  }
  return sekunder;
}

/** Simpel robot: stil dig under den naermeste boble og skyd. */
function robot(spil) {
  return spil.spillere.map(s => {
    if (!spil.bobler.length) return { retning: 0, skyd: false };
    let naermest = spil.bobler[0];
    spil.bobler.forEach(b => { if (Math.abs(b.x - s.x) < Math.abs(naermest.x - s.x)) naermest = b; });
    const dx = naermest.x - s.x;
    return { retning: Math.abs(dx) < 8 ? 0 : (dx > 0 ? 1 : -1), skyd: Math.abs(dx) < naermest.r };
  });
}

console.log('\nBobler\n');

/* Alle baner ligger inden for skaermen */
{
  let udenfor = 0;
  Bobler.BANER.forEach(b => b.bobler.forEach(([x, str, , y]) => {
    const r = I.bobleStr[str];
    if (x - r < 0 || x + r > I.bredde || y - r < 0 || y + r > I.hoejde) udenfor++;
  }));
  tjek('alle bobler i alle baner starter inden for skaermen', udenfor === 0, udenfor + ' udenfor');
  tjek('der er 10 baner', Bobler.BANER.length === 10);
}

/* En boble hopper til samme hoejde hver gang */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 50;
  spil.bobler = [Object.assign({}, spil.bobler[0], { x: 600, y: 200, vx: 0, vy: 0 })];
  const toppe = [];
  let sidsteVy = 0;
  koer(spil, 8, null, s => {
    const b = s.bobler[0];
    if (sidsteVy > 0 && b.vy <= 0) toppe.push(b.y);
    sidsteVy = b.vy;
  });
  const forventet = I.bobleHop[1] + I.bobleStr[1];
  const ens = toppe.length >= 3 && toppe.slice(1).every(t => Math.abs(t - forventet) < 6);
  tjek('boblen hopper til samme hoejde hver gang', ens, 'toppe: ' + toppe.map(t => t.toFixed(0)).join(', ') + ' forventet ' + forventet);
}

/* Et skud deler en boble i to mindre, og de mindste forsvinder */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.bobler = [Object.assign({}, spil.bobler[0], { x: 500, y: 250, vx: 0, vy: 0, str: 0, r: I.bobleStr[0] })];
  spil.spillere[0].x = 500;
  koer(spil, 1, () => [{ retning: 0, skyd: true }], s => s.poppet.length > 0);
  tjek('et skud deler en stor boble i to mindre', spil.bobler.length === 2 && spil.bobler.every(b => b.str === 1),
    spil.bobler.length + ' bobler af str ' + spil.bobler.map(b => b.str));

  const mindst = I.bobleStr.length - 1;
  spil.bobler = [Object.assign({}, spil.bobler[0], { x: 500, y: 250, vx: 0, vy: 0, str: mindst, r: I.bobleStr[mindst] })];
  spil.spillere[0].skud = null;
  koer(spil, 1, () => [{ retning: 0, skyd: true }], s => s.poppet.length > 0);
  tjek('den mindste boble forsvinder, og banen er klaret', spil.baneKlaret && spil.bane === 1,
    'baneKlaret=' + spil.baneKlaret + ' bane=' + spil.bane);
}

/* At blive ramt goer én svimmel, og man kan ikke skyde imens */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 500;
  spil.bobler = [Object.assign({}, spil.bobler[0], { x: 500, y: 80, vx: 0, vy: 0 })];
  koer(spil, 0.5, null, s => s.spillere[0].ramt);
  koer(spil, 0.1, () => [{ retning: 0, skyd: true }]);   // proev at skyde mens man er svimmel
  const s = spil.spillere[0];
  tjek('en boble goer spilleren svimmel', s.svimmel > 0, 'svimmel=' + s.svimmel.toFixed(2));
  tjek('svimmel spiller kan ikke skyde', s.skud === null);
  tjek('spilleren har ikke liv der kan tabes', s.liv === undefined);
}

/* Robotten kan klare alle ti baner paa alle svaerhedsgrader */
Bobler.SVAERHED.forEach((sv, niveau) => {
  Bobler.saetSvaerhed(niveau);
  const spil = Bobler.nytSpil(1);
  const t = koer(spil, 600, robot, s => s.faerdig);
  tjek('én robot klarer alle baner paa ' + (niveau + 1) + ' stjerne(r)', spil.faerdig,
    'naaede bane ' + (spil.bane + 1) + ' paa ' + t.toFixed(0) + ' s');
  tjek('det tager under 5 minutter', t < 300, t.toFixed(0) + ' s');
});
Bobler.saetSvaerhed(0);

/* To robotter er hurtigere end én */
{
  Bobler.saetSvaerhed(1);
  const en = koer(Bobler.nytSpil(1), 600, robot, s => s.faerdig);
  const to = koer(Bobler.nytSpil(2), 600, robot, s => s.faerdig);
  tjek('to spillere klarer banerne hurtigere end én', to < en, 'én: ' + en.toFixed(0) + ' s, to: ' + to.toFixed(0) + ' s');
  Bobler.saetSvaerhed(0);
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
