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

/** Simpel robot: stil dig under den naermeste boble og tryk skyd i korte tryk. */
function robot(spil, f) {
  return spil.spillere.map(s => {
    if (!spil.bobler.length) return { retning: 0, skyd: false };
    let naermest = spil.bobler[0];
    spil.bobler.forEach(b => { if (Math.abs(b.x - s.x) < Math.abs(naermest.x - s.x)) naermest = b; });
    const dx = naermest.x - s.x;
    return { retning: Math.abs(dx) < 8 ? 0 : (dx > 0 ? 1 : -1), skyd: Math.abs(dx) < naermest.r && f % 4 < 2 };
  });
}

function tryk(spil, f) { return [{ retning: 0, skyd: f % 4 < 2 }]; }

function boble(spil, x, y, str, vx, vy) {
  return Object.assign({}, spil.bobler[0] || { tempo: 1 }, { x, y, str, r: I.bobleStr[str], vx: vx || 0, vy: vy || 0 });
}

console.log('\nBobler\n');

/* Alle baner ligger inden for skaermen */
{
  let udenfor = 0, platformUdenfor = 0;
  Bobler.BANER.forEach(b => {
    b.bobler.forEach(([x, str, , y]) => {
      const r = I.bobleStr[str];
      if (x - r < 0 || x + r > I.bredde || y - r < 0 || y + r > I.hoejde) udenfor++;
    });
    (b.platforme || []).forEach(([x, y, br]) => { if (x < 0 || x + br > I.bredde || y < 60 || y > I.hoejde - 100) platformUdenfor++; });
  });
  tjek('alle bobler i alle baner starter inden for skaermen', udenfor === 0, udenfor + ' udenfor');
  tjek('alle platforme ligger inden for skaermen', platformUdenfor === 0, platformUdenfor + ' udenfor');
  tjek('der er 12 baner med tre temaer', Bobler.BANER.length === 12 && new Set(Bobler.BANER.map(b => b.tema)).size === 3);
}

/* En boble hopper til samme hoejde hver gang */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 50;
  spil.bobler = [boble(spil, 600, 200, 1)];
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

/* Bobler hopper paa platforme */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 50;
  spil.platforme = [{ x: 400, y: 200, bredde: 200, tykkelse: I.platformTykkelse }];
  spil.bobler = [boble(spil, 500, 400, 2)];
  let laveste = 999;
  koer(spil, 4, null, s => { laveste = Math.min(laveste, s.bobler[0].y); });
  tjek('en boble hopper oven paa en platform', laveste >= 200 + I.platformTykkelse + I.bobleStr[2] - 1,
    'laveste y=' + laveste.toFixed(0));

  spil.bobler = [boble(spil, 500, 100, 2, 0, 400)];
  let hoejest = 0;
  koer(spil, 1, null, s => { hoejest = Math.max(hoejest, s.bobler[0].y); });
  tjek('en boble preller af under en platform', hoejest <= 200 - I.bobleStr[2] + 1, 'hoejest y=' + hoejest.toFixed(0));
}

/* Et skud deler en boble i to mindre, og de mindste forsvinder */
{
  I.specialChance = 0;
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.bobler = [boble(spil, 500, 250, 0)];
  spil.spillere[0].x = 500;
  koer(spil, 1, tryk, s => s.poppet.length > 0);
  tjek('et skud deler en stor boble i to mindre', spil.bobler.length === 2 && spil.bobler.every(b => b.str === 1),
    spil.bobler.length + ' bobler af str ' + spil.bobler.map(b => b.str));

  const mindst = I.bobleStr.length - 1;
  spil.bobler = [boble(spil, 500, 250, mindst)];
  spil.spillere[0].skud = [];
  koer(spil, 1, tryk, s => s.poppet.length > 0);
  tjek('den mindste boble forsvinder, og banen er klaret', spil.baneKlaret && spil.bane === 1,
    'baneKlaret=' + spil.baneKlaret + ' bane=' + spil.bane);
  I.specialChance = 0.22;
}

/* Man kan kun have én snor ad gangen, og et tryk giver ét skud */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.bobler = [];
  spil.ventende = [{ x: 500, str: 2, retning: 1, tid: 99, tempo: 1 }];   // holder banen aaben
  koer(spil, 0.2, () => [{ retning: 0, skyd: true }]);
  tjek('at holde skyd nede giver kun én snor ad gangen', spil.spillere[0].skud.length === 1, spil.spillere[0].skud.length + ' snore');
  // Holder barnet knappen nede, skal der komme en ny snor, naar den foerste er vaek
  let skud = 0;
  koer(spil, 3, () => [{ retning: 0, skyd: true }], s => { if (s.spillere[0].skoed) skud++; });
  tjek('holder man skyd nede, bliver der ved med at komme snore', skud >= 3, skud + ' skud paa 3 sekunder');
}

/* At blive ramt goer én svimmel, og man kan ikke skyde imens */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 500;
  spil.bobler = [boble(spil, 500, 80, 1)];
  koer(spil, 0.5, null, s => s.spillere[0].ramt);
  koer(spil, 0.1, tryk);
  const s = spil.spillere[0];
  tjek('en boble goer spilleren svimmel', s.svimmel > 0, 'svimmel=' + s.svimmel.toFixed(2));
  tjek('svimmel spiller kan ikke skyde', s.skud.length === 0);
  tjek('spilleren har ikke liv der kan tabes', s.liv === undefined);
}

/* Bobler drypper ned senere */
{
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = 50;
  spil.bobler = [boble(spil, 900, 300, 0)];
  spil.ventende = [{ x: 500, str: 2, retning: 1, tid: 1.0, tempo: 1 }];
  const t = koer(spil, 3, null, s => s.dryppede);
  tjek('en ventende boble drypper ned fra oven efter sin tid', spil.bobler.length === 2 && t >= 0.9 && t <= 1.1 && spil.bobler[1].y > I.hoejde - 60,
    'efter ' + t.toFixed(2) + ' s, y=' + (spil.bobler[1] ? spil.bobler[1].y.toFixed(0) : '-'));
}

/* Specials */
function medSpecial(type, x) {
  const spil = Bobler.nytSpil(1);
  spil.pause = 0;
  spil.spillere[0].x = x || 500;
  spil.bobler = [boble(spil, 900, 380, 0)];   // langt vaek, saa den ikke forstyrrer
  spil.specials = [{ x: spil.spillere[0].x, y: I.specialRadius, vy: 0, type, tid: 5 }];
  Bobler.opdater(spil, stille, dt);
  return spil;
}
{
  const spil = medSpecial('dobbelt');
  tjek('en special samles op ved at gaa hen til den', spil.spillere[0].samlede === 'dobbelt' && spil.specials.length === 0);
  spil.ventende = [{ x: 500, str: 2, retning: 1, tid: 99, tempo: 1 }];
  koer(spil, 0.3, tryk);
  tjek('dobbelt giver to snore ad gangen', spil.spillere[0].skud.length === 2, spil.spillere[0].skud.length + ' snore');
}
{
  const spil = medSpecial('klaebe');
  spil.ventende = [{ x: 500, str: 2, retning: 1, tid: 99, tempo: 1 }];
  koer(spil, 1.2, tryk, s => s.spillere[0].skud.some(k => k.haenger > 0));
  const haenger = spil.spillere[0].skud.find(k => k.haenger > 0);
  tjek('klaebesnoren haenger fast i loftet', !!haenger && haenger.y === I.hoejde);
  spil.bobler.push(boble(spil, haenger.x, I.hoejde - 30, 2));
  koer(spil, 0.1);
  tjek('en haengende snor popper bobler der roerer den, og bliver haengende', spil.poppet.length === 0 && spil.bobler.length === 1 && spil.spillere[0].skud.length === 1,
    spil.bobler.length + ' bobler, ' + spil.spillere[0].skud.length + ' snore');
}
{
  const spil = medSpecial('frys');
  const før = { x: spil.bobler[0].x, y: spil.bobler[0].y };
  koer(spil, 1);
  tjek('frys stopper alle bobler', spil.frys > 0 && spil.bobler[0].x === før.x && spil.bobler[0].y === før.y);
  spil.spillere[0].x = spil.bobler[0].x;
  koer(spil, 0.2);
  tjek('frosne bobler goer ikke svimmel', spil.spillere[0].svimmel === 0);
}
{
  const spil = medSpecial('skjold');
  tjek('skjoldet er paa', spil.spillere[0].skjold === true);
  spil.bobler = [boble(spil, spil.spillere[0].x, 70, 1)];
  koer(spil, 0.5, null, s => s.spillere[0].prellede);
  tjek('skjoldet tager ét traef uden svimmelhed', spil.spillere[0].prellede && spil.spillere[0].svimmel === 0 && spil.spillere[0].skjold === false);
}

/* Robotten kan klare alle baner paa alle svaerhedsgrader, ogsaa uden specials */
I.specialChance = 0;
Bobler.SVAERHED.forEach((sv, niveau) => {
  Bobler.saetSvaerhed(niveau);
  const spil = Bobler.nytSpil(1);
  const t = koer(spil, 900, robot, s => s.faerdig);
  tjek('én robot klarer alle baner paa ' + (niveau + 1) + ' stjerne(r) uden specials', spil.faerdig,
    'naaede bane ' + (spil.bane + 1) + ' paa ' + t.toFixed(0) + ' s');
  tjek('det tager under 10 minutter for 12 baner', t < 600, t.toFixed(0) + ' s');
});
I.specialChance = 0.22;
Bobler.saetSvaerhed(0);

/* To robotter er hurtigere end én */
{
  Bobler.saetSvaerhed(1);
  I.specialChance = 0;
  const en = koer(Bobler.nytSpil(1), 900, robot, s => s.faerdig);
  const to = koer(Bobler.nytSpil(2), 900, robot, s => s.faerdig);
  tjek('to spillere klarer banerne hurtigere end én', to < en, 'én: ' + en.toFixed(0) + ' s, to: ' + to.toFixed(0) + ' s');
  I.specialChance = 0.22;
  Bobler.saetSvaerhed(0);
}

/* De malede figurer: dem, skaermen lister, findes, er smaa, er i FILER og har NOTICE */
{
  const fs = require('fs');
  const mappe = path.join(__dirname, '..', 'games', 'bobler', 'billeder');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const game = fs.readFileSync(path.join(__dirname, '..', 'games', 'bobler', 'js', 'game.js'), 'utf8');
  const m = game.match(/var MALEDE = \[([^\]]*)\]/);
  const malede = m ? m[1].split(',').map(x => x.trim().replace(/'/g, '')).filter(Boolean) : [];
  tjek('skaermen lister mindst én malet figur', malede.length >= 1, malede.join(','));
  const mangler = malede.filter(f => !fs.existsSync(path.join(mappe, f + '.png')));
  tjek('hver malet figur har et billede', mangler.length === 0, mangler.join(','));
  const store = malede.filter(f => fs.existsSync(path.join(mappe, f + '.png')) && fs.statSync(path.join(mappe, f + '.png')).size > 40 * 1024);
  tjek('ingen af dem fylder over 40 KB', store.length === 0, store.join(','));
  const ikkeICache = malede.filter(f => !sw.includes("'games/bobler/billeder/" + f + ".png'"));
  tjek('alle malede figurer er med i FILER', ikkeICache.length === 0, ikkeICache.join(','));
  tjek('billeder/ har en NOTICE.md', fs.existsSync(path.join(mappe, 'NOTICE.md')));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
