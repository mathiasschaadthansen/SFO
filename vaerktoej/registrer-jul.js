#!/usr/bin/env node
/**
 * Skriver FILER_JUL i sw.js ud fra det, der ligger i jul/billeder/ og jul/lyd/klip.json.
 *
 * Julekalenderens billeder og stemmeklip ligger i service workerens egen cache
 * ('sfo-jul'), der ikke hentes forfra ved hver ny VERSION (se kommentaren i sw.js).
 * Koer vaerktoejet, naar der er kommet billeder eller klip til:
 *
 *     node vaerktoej/registrer-jul.js            skriv FILER_JUL i sw.js
 *     node vaerktoej/registrer-jul.js --proev    vis kun, hvad der ville komme med
 *
 * Billeder: alle .jpg, .jpeg, .png og .webp i jul/billeder/ (ogsaa i undermapper).
 * Lyd: alle filer, klip.json naevner, og som findes i jul/lyd/. Mp3-filer, som
 * klip.json ikke naevner, kommer ikke med; de naevnes, saa de kan slettes.
 *
 * Et AENDRET billede skal have et nyt filnavn, ellers beholder iPad'erne det gamle
 * i cachen. Lydfilernes navne har allerede en hash af teksten.
 * Bagefter: npm test, tael VERSION op i sw.js, commit.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const JUL = path.join(ROD, 'jul');
const PROEV = process.argv.includes('--proev');

function billeder(mappe, rel) {
  if (!fs.existsSync(mappe)) return [];
  let ud = [];
  fs.readdirSync(mappe).sort().forEach(n => {
    const p = path.join(mappe, n), r = rel + '/' + n;
    if (fs.statSync(p).isDirectory()) ud = ud.concat(billeder(p, r));
    else if (/\.(jpe?g|png|webp)$/i.test(n)) ud.push(r);
  });
  return ud;
}

const billedFiler = billeder(path.join(JUL, 'billeder'), 'jul/billeder');

let klip = {};
const klipSti = path.join(JUL, 'lyd', 'klip.json');
if (fs.existsSync(klipSti)) klip = JSON.parse(fs.readFileSync(klipSti, 'utf8'));
const naevnt = [...new Set(Object.values(klip))].sort();
const lydFiler = naevnt.filter(f => fs.existsSync(path.join(JUL, 'lyd', f))).map(f => 'jul/lyd/' + f);
const mangler = naevnt.filter(f => !fs.existsSync(path.join(JUL, 'lyd', f)));
const iMappen = fs.existsSync(path.join(JUL, 'lyd')) ? fs.readdirSync(path.join(JUL, 'lyd')).filter(f => f.endsWith('.mp3')) : [];
const ubrugte = iMappen.filter(f => naevnt.indexOf(f) < 0);

const alle = billedFiler.concat(lydFiler);
const ugyldige = alle.filter(f => /[æøåÆØÅ\s'"]/.test(f));
const stoerrelse = alle.reduce((a, f) => a + fs.statSync(path.join(ROD, f)).size, 0);

console.log('%d billeder og %d klip, i alt %s MB.', billedFiler.length, lydFiler.length, (stoerrelse / 1048576).toFixed(1));
if (mangler.length) console.log('OBS: klip.json naevner %d filer, der ikke findes, fx %s', mangler.length, mangler.slice(0, 3).join(', '));
if (ubrugte.length) console.log('OBS: %d mp3-filer i jul/lyd/ staar ikke i klip.json og kommer ikke med, fx %s', ubrugte.length, ubrugte.slice(0, 3).join(', '));
if (ugyldige.length) { console.log('Filnavne maa ikke have æ, ø, å, mellemrum eller anfoerselstegn: ' + ugyldige.join(', ')); process.exit(1); }

if (PROEV) { alle.forEach(f => console.log('  ' + f)); process.exit(0); }

const swSti = path.join(ROD, 'sw.js');
const sw = fs.readFileSync(swSti, 'utf8');
const blok = /const FILER_JUL = \[[\s\S]*?\];/;
if (!blok.test(sw)) { console.log('Fandt ikke "const FILER_JUL = [ ... ];" i sw.js.'); process.exit(1); }
const ny = 'const FILER_JUL = [\n' + alle.map(f => "  '" + f + "'").join(',\n') + (alle.length ? '\n' : '') + '];';
fs.writeFileSync(swSti, sw.replace(blok, ny));
console.log('FILER_JUL i sw.js har nu %d filer. Husk: npm test, tael VERSION op, commit.', alle.length);
