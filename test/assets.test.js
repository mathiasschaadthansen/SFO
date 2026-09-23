/**
 * Test af sprites: alt der refereres i spillene findes, er med i offline-cachen,
 * og licensen ligger ved siden af. Koeres med `npm test`.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nSprites\n');

const jsFiler = [];
(function find(d) {
  fs.readdirSync(d).forEach(n => {
    const p = path.join(d, n);
    if (fs.statSync(p).isDirectory()) { if (n !== 'node_modules' && n !== '.git') find(p); }
    else if (n.endsWith('.js')) jsFiler.push(p);
  });
})(path.join(ROD, 'games'));

const brugte = new Set();
jsFiler.forEach(f => {
  const kilde = fs.readFileSync(f, 'utf8');
  (kilde.match(/assets\/kenney\/[\w.-]+\.png/g) || []).forEach(s => brugte.add(s));
  // Praefiks + navn bygget af dele: fx 'bil_' + farve + '_' + n + '.png'
});
const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
const iMappen = fs.readdirSync(path.join(ROD, 'assets', 'kenney')).filter(n => n.endsWith('.png'));

tjek('der er sprites i assets/kenney', iMappen.length > 0, iMappen.length + ' filer');
const ikkeICache = iMappen.filter(n => !sw.includes("'assets/kenney/" + n + "'"));
tjek('alle sprites er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache.join(', '));
const mangler = [...brugte].filter(s => !fs.existsSync(path.join(ROD, s)));
tjek('alle sprites spillene naevner direkte findes', mangler.length === 0, 'mangler: ' + mangler.join(', '));
tjek('licens og NOTICE ligger ved siden af sprites',
  fs.existsSync(path.join(ROD, 'assets', 'kenney', 'LICENSE.txt')) && fs.existsSync(path.join(ROD, 'assets', 'kenney', 'NOTICE.md')));
const total = iMappen.reduce((a, n) => a + fs.statSync(path.join(ROD, 'assets', 'kenney', n)).size, 0);
tjek('sprites fylder under 300 KB i alt', total < 300 * 1024, Math.round(total / 1024) + ' KB');
tjek('sprites.js er med i service workerens FILER', sw.includes("'js/sprites.js'"));
tjek('skal.js er med i service workerens FILER', sw.includes("'js/skal.js'"));
// En ny version skal hentes uden om browserens egen cache. Uden det fik cachen det
// nye navn, men det gamle indhold, og iPad'en blev ved med at vise det gamle spil.
tjek('service workeren henter nye filer uden om browserens cache', /cache:\s*'reload'/.test(sw));
// Forsiden linker til mapper (games/racer/), men FILER indeholder filen
// (games/racer/index.html). De to adresser er ikke den samme, saa uden et fald
// tilbage til index.html kan spillene ikke aabnes uden net — kun forsiden.
tjek('service workeren falder tilbage til index.html paa en mappe-adresse',
  /mode === 'navigate'/.test(sw) && /index\.html'/.test(sw));
const stier = [...fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8')
  .matchAll(/sti:\s*'([^']+)'/g)].map(m => m[1]);
const spilStier = stier.filter(s2 => s2.startsWith('games/'));
tjek('forsiden linker til alle elleve spil', spilStier.length === 11, spilStier.length + ' stier');
tjek('forsiden linker til bogen', stier.includes('bog/'));
const udenIndex = stier.filter(s2 => !sw.includes("'" + s2 + "index.html'"));
tjek('hvert spil forsiden linker til har sin index.html i FILER', udenIndex.length === 0, udenIndex.join());

// Findes en fil i FILER ikke, fejler addAll i install med en 404, og iPad'en
// beholder den gamle version i stilhed. Det skete med Bogstavvejens SVG'er i v77.
const alleFiler = [...sw.match(/const FILER = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const ikkePaaDisk = alleFiler.filter(f => !f.endsWith('/') && !fs.existsSync(path.join(ROD, f)));
tjek('alle filer i FILER findes paa disken', ikkePaaDisk.length === 0, 'mangler: ' + ikkePaaDisk.slice(0, 5).join());
const dubletter = alleFiler.filter((f, i) => alleFiler.indexOf(f) !== i);
tjek('ingen fil staar to gange i FILER (addAll afviser dubletter)', dubletter.length === 0, 'to gange: ' + dubletter.join());
const spilSider = ['racer', 'klatbold', 'bobler', 'bogstaver', 'restaurant', 'tegn', 'klokken', 'maskinen', 'rim', 'find', 'flyv'].map(s => fs.readFileSync(path.join(ROD, 'games', s, 'index.html'), 'utf8'));
tjek('alle spilsider har skallen med hjem-knappen', spilSider.every(h => h.includes('js/skal.js')));
tjek('menu.js er med i service workerens FILER', sw.includes("'js/menu.js'"));
tjek('alle spilsider bruger de faelles menu-ikoner', spilSider.every(h => h.includes('js/menu.js')));
// Ingen knap i menuerne maa kraeve laesning: start, igen og menu er ikoner
const spilKode = ['racer', 'klatbold', 'bobler', 'bogstaver', 'restaurant', 'tegn', 'klokken', 'maskinen', 'rim', 'find', 'flyv'].map(s => fs.readFileSync(path.join(ROD, 'games', s, 'js', 'game.js'), 'utf8'));
// Hvert spil skal kunne komme tilbage til sin egen menu midt i et spil
const udenMenuKnap = ['racer', 'klatbold', 'bobler', 'bogstaver', 'restaurant', 'tegn', 'klokken', 'maskinen', 'rim', 'find', 'flyv']
  .filter((s, i) => !/Skal\.menuKnap\(/.test(spilKode[i]));
tjek('alle spil melder deres menu til pilen i hjoernet', udenMenuKnap.length === 0, udenMenuKnap.join());
tjek('ingen spil har tekstknapper til start, igen eller menu', spilKode.every(k => !/>(1 spiller|2 spillere|Spil!|Kør!|Spil igen|Kør igen|Igen|Menu|Fri leg|Tegn alle)</.test(k)), 'tekstknapper: ' + ['racer', 'klatbold', 'bobler', 'bogstaver', 'restaurant', 'tegn', 'klokken', 'maskinen', 'rim', 'find', 'flyv'].filter((s, i) => /(>(1 spiller|2 spillere|Spil!|Kør!|Spil igen|Kør igen|Igen|Menu|Fri leg|Tegn alle)<)/.test(spilKode[i])));
// Overlayet skal vaere det der ruller (ikke kortet med en hoejde i vh: paa iOS er 100vh hoejere
// end det synlige felt, saa knappen i bunden fjedrede tilbage), og lave skaerme skal have et kompakt layout.
tjek('alle spilsider lader overlayet rulle og centrerer kortet med margin:auto',
  spilSider.every(h => h.includes('overflow-y:auto') && h.includes('.kort{margin:auto') && !h.includes('.kort{max-height')));
tjek('alle spilsider har et kompakt layout til lave skaerme', spilSider.every(h => h.includes('@media (max-height:520px)')));

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
