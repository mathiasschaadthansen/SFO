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
const spilSider = ['racer', 'klatbold', 'bobler', 'bogstaver', 'restaurant', 'tegn'].map(s => fs.readFileSync(path.join(ROD, 'games', s, 'index.html'), 'utf8'));
tjek('alle spilsider har skallen med hjem-knappen', spilSider.every(h => h.includes('js/skal.js')));
// Overlayet skal vaere det der ruller (ikke kortet med en hoejde i vh: paa iOS er 100vh hoejere
// end det synlige felt, saa knappen i bunden fjedrede tilbage), og lave skaerme skal have et kompakt layout.
tjek('alle spilsider lader overlayet rulle og centrerer kortet med margin:auto',
  spilSider.every(h => h.includes('overflow-y:auto') && h.includes('.kort{margin:auto') && !h.includes('.kort{max-height')));
tjek('alle spilsider har et kompakt layout til lave skaerme', spilSider.every(h => h.includes('@media (max-height:520px)')));

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
