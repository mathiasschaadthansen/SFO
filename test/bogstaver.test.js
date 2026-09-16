/**
 * Test af Bogstaver — koeres med `npm test`. Kraever ingen browser.
 */
'use strict';

const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'bogstaver', 'js');
const { Glyffer } = require(path.join(ROD, 'glyffer.js'));
const { Spor } = require(path.join(ROD, 'spor.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nBogstaver\n');

const alle = Glyffer.BOGSTAVER.concat(Glyffer.SMAA, Glyffer.TAL);

/* Alle tegn findes, ligger i kassen og har streger af rimelig laengde */
{
  let mangler = [], udenfor = [], korte = [];
  alle.forEach(n => {
    const g = Glyffer.GLYFFER[n];
    if (!g || !g.streger.length || !g.tegn) { mangler.push(n); return; }
    g.streger.forEach(s => {
      s.forEach(([x, y]) => { if (x < 0 || x > 100 || y < 0 || y > 100) udenfor.push(n); });
      let l = 0;
      for (let i = 1; i < s.length; i++) l += Math.hypot(s[i][0] - s[i - 1][0], s[i][1] - s[i - 1][1]);
      if (l < 15) korte.push(n);
    });
  });
  tjek('alle 29 store, 29 smaa bogstaver og 10 tal findes', alle.length === 68 && mangler.length === 0, 'mangler: ' + mangler);
  // Grundlinjen ligger ved y=80. Hvert lille bogstav skal roere eller krydse den (nedstreger krydser).
  const smaaUdenGrundlinje = Glyffer.SMAA.filter(n => !Glyffer.GLYFFER[n].streger.some(s => Spor.sampl(s).some(p => Math.abs(p[1] - 80) < 3)));
  tjek('alle smaa bogstaver roerer grundlinjen', smaaUdenGrundlinje.length === 0, 'ikke paa grundlinjen: ' + smaaUdenGrundlinje);
  tjek('alle streger ligger inden for kassen', udenfor.length === 0, 'udenfor: ' + [...new Set(udenfor)]);
  tjek('ingen streg er kortere end 15', korte.length === 0, 'korte: ' + [...new Set(korte)]);
  tjek('Æ, Ø og Å vises som danske tegn', Glyffer.GLYFFER.AE.tegn === 'Æ' && Glyffer.GLYFFER.OE.tegn === 'Ø' && Glyffer.GLYFFER.AA.tegn === 'Å');
}

/** Flyt fingeren i smaa skridt fra a til b. */
function traek(spor, a, b, skridt) {
  const l = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const n = Math.max(1, Math.ceil(l / skridt));
  for (let i = 1; i <= n; i++) spor.flyt(a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n);
}

/* En finger der foelger stregen praecist, tegner hele tegnet */
function foelg(glyf, tolerance, afvig) {
  const spor = new Spor(glyf, tolerance);
  let stregerFaerdige = 0;
  spor.streger.forEach(streg => {
    let i = 0;
    const p0 = streg[0];
    spor.start(p0[0] + (afvig || 0), p0[1]);
    for (i = 1; i < streg.length; i++) {
      const p = streg[i];
      spor.flyt(p[0] + (afvig || 0), p[1]);
      if (spor.stregFaerdig) { stregerFaerdige++; break; }
    }
    spor.slip();
  });
  return { faerdig: spor.faerdig, streger: stregerFaerdige, andel: spor.andel() };
}
{
  let ikkeFaerdige = [];
  alle.forEach(n => { if (!foelg(Glyffer.GLYFFER[n], 8).faerdig) ikkeFaerdige.push(n); });
  tjek('en finger langs stregen tegner alle 68 tegn faerdige', ikkeFaerdige.length === 0, 'ikke faerdige: ' + ikkeFaerdige);

  let skaeve = [];
  alle.forEach(n => { if (!foelg(Glyffer.GLYFFER[n], 12, 6).faerdig) skaeve.push(n); });
  tjek('en finger 6 enheder ved siden af tegner stadig alle tegn med bred tolerance', skaeve.length === 0, 'ikke faerdige: ' + skaeve);
}

/* Fingeren skal starte ved startprikken, og fremskridt bevares naar man slipper */
{
  const spor = new Spor(Glyffer.GLYFFER.L, 8);
  tjek('man kan ikke starte langt fra startprikken', spor.start(75, 50) === false && spor.holder === false);
  tjek('man kan starte ved startprikken', spor.start(26, 12) === true);
  spor.flyt(25, 30); spor.flyt(25, 50);
  const andel = spor.andel();
  spor.slip();
  tjek('fremskridt bevares naar fingeren loeftes', spor.andel() === andel && andel > 0.2 && andel < 0.6, 'andel=' + andel.toFixed(2));
  tjek('man tager fat igen dér hvor man slap', spor.start(25, 52) === true);
  traek(spor, [25, 52], [25, 90], 4); traek(spor, [25, 90], [75, 90], 4);
  tjek('L er faerdigt efter én streg', spor.faerdig === true);
}

/* En hurtig finger, der springer 15 enheder ad gangen, tegner stadig */
{
  let langsomme = [];
  ['I', 'O', 'L', 'S', 'Z', '8'].forEach(n => {
    const spor = new Spor(Glyffer.GLYFFER[n], 8);
    spor.streger.forEach(streg => {
      spor.start(streg[0][0], streg[0][1]);
      for (let i = 6; i < streg.length; i += 6) { spor.flyt(streg[i][0], streg[i][1]); if (spor.stregFaerdig) break; }
      if (!spor.stregFaerdig && !spor.faerdig) { const s = streg[streg.length - 1]; spor.flyt(s[0], s[1]); }
      spor.slip();
    });
    if (!spor.faerdig) langsomme.push(n);
  });
  tjek('en hurtig finger med 15 enheder pr. skridt tegner tegnene faerdige', langsomme.length === 0, 'ikke faerdige: ' + langsomme);
}

/* Paa afveje mister man ikke noget */
{
  const spor = new Spor(Glyffer.GLYFFER.I, 8);
  spor.start(50, 10); spor.flyt(50, 40);
  const andel = spor.andel();
  spor.flyt(90, 40);   // langt vaek fra stregen
  tjek('fingeren paa afveje stopper sporingen uden at miste fremskridt', spor.holder === false && spor.andel() === andel);
  tjek('afveje taelles, saa spillet kan skrue op og ned', spor.afveje === 1, 'afveje=' + spor.afveje);
}

/* Man kan ikke springe direkte til slutningen */
{
  const spor = new Spor(Glyffer.GLYFFER.I, 8);
  spor.start(50, 10); spor.flyt(50, 90);
  tjek('et hop til slutpunktet taeller ikke som at tegne stregen', spor.faerdig === false && spor.andel() < 0.5, 'andel=' + spor.andel().toFixed(2));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
