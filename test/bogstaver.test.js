/**
 * Test af Bogstaver — koeres med `npm test`. Kraever ingen browser.
 */
'use strict';

const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'bogstaver', 'js');
const { Glyffer } = require(path.join(ROD, 'glyffer.js'));
const { Spor } = require(path.join(ROD, 'spor.js'));
const { Ting } = require(path.join(ROD, 'ting.js'));

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

/* Skrivemaaden foelger dansk grundskrift. Reglerne tjekkes paa selve stregerne, saa de ikke skrider igen. */
{
  const G = Glyffer.GLYFFER;
  const foerste = n => G[n].streger[0], sidste = n => G[n].streger[G[n].streger.length - 1];
  const nedad = s => s[s.length - 1][1] > s[0][1] + 20 && Math.abs(s[s.length - 1][0] - s[0][0]) < 6;
  const modHoejre = s => s[s.length - 1][0] > s[0][0] + 20 && Math.abs(s[s.length - 1][1] - s[0][1]) < 6;
  /* Hvilken vej en bue drejer: summen af krydsproduktet mellem stykkerne (y peger nedad, saa positivt = med uret) */
  const drej = s => { let d = 0; for (let i = 0; i < s.length - 2; i++) { const ax = s[i + 1][0] - s[i][0], ay = s[i + 1][1] - s[i][1], bx = s[i + 2][0] - s[i + 1][0], by = s[i + 2][1] - s[i + 1][1]; d += ax * by - ay * bx; } return d; };
  const medUret = s => drej(s) > 0, modUret = s => drej(s) < 0;
  /* Stammen er stregens foerste stykke ned, og for grundskriftens smaa bogstaver gaar man tilbage op ad den */
  const nedOgOp = n => { const s = foerste(n); let bund = 0; for (let i = 1; i < s.length; i++) if (s[i][1] > s[bund][1]) bund = i; return bund > 0 && bund < s.length - 1 && s[bund][1] > s[0][1] + 20 && s[bund + 1][1] < s[bund][1] && Math.abs(s[bund + 1][0] - s[bund][0]) < 3; };

  const stammeNed = ['B', 'D', 'E', 'F', 'H', 'I', 'K', 'L', 'M', 'N', 'P', 'R', 'T', 'AE', 'i', 'l', 'b', 'h', 'k', 'p', 'n', 'm', 'r', '1'];
  const forkertStamme = stammeNed.filter(n => { const s = n === 'T' ? G[n].streger[1] : (n === '1' ? foerste(n).slice(1) : foerste(n)); return !(s[0][1] < s[Math.min(s.length - 1, 40)][1]); });
  tjek('lodrette stammer skrives oppefra og ned', forkertStamme.length === 0, forkertStamme.join());
  tjek('vandrette streger skrives fra venstre mod hoejre (E, F, T, H, A, 5, 7, t, f)',
    modHoejre(G.E.streger[1]) && modHoejre(G.E.streger[2]) && modHoejre(G.F.streger[1]) && modHoejre(G.T.streger[0]) && modHoejre(G.H.streger[2]) && modHoejre(G.A.streger[2]) && modHoejre(sidste('5')) && modHoejre(foerste('7').slice(0, 2)) && modHoejre(sidste('t')) && modHoejre(sidste('f')));
  tjek('A, Æ og Å begynder i toppen med to streger ned', [['A', 0], ['A', 1], ['AE', 0], ['AA', 0], ['AA', 1]].every(([n, i]) => G[n].streger[i][0][1] < G[n].streger[i][1][1] - 40));
  tjek('runde former gaar mod uret: o O 0 c C a d g q e G Q ae aa', ['o', 'O', '0', 'c', 'C', 'a', 'd', 'g', 'q', 'e', 'G', 'Q', 'ae', 'aa'].every(n => modUret(foerste(n).slice(0, 25))));
  tjek('maver ud fra en stamme gaar med uret: b p B D P R 2 3', ['b', 'p'].every(n => medUret(foerste(n).slice(-25))) && ['B', 'D', 'P', 'R'].every(n => medUret(G[n].streger[1].slice(0, 25))) && ['2', '3'].every(n => medUret(foerste(n).slice(0, 15))));
  tjek('5: ned og mave foerst, hatten til sidst; 6 rundt mod uret; 8 begynder oeverst til hoejre og gaar til venstre',
    nedad(foerste('5').slice(0, 2)) && G['5'].streger.length === 2 && modUret(foerste('6').slice(-30)) && foerste('8')[0][0] > 55 && foerste('8')[3][0] < foerste('8')[0][0]);
  tjek('b, h, n, m, r, p, k-stammen: ned ad stammen og tilbage op i samme streg', ['b', 'h', 'n', 'm', 'r', 'p'].every(nedOgOp), ['b', 'h', 'n', 'm', 'r', 'p'].filter(n => !nedOgOp(n)).join());
  tjek('a, d, g, q, u er én streg: rundt eller ned, og saa stammen', ['a', 'd', 'g', 'q', 'u'].every(n => G[n].streger.length === 1) && ['a', 'd', 'q'].every(n => nedad(foerste(n).slice(-2))));
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

/* Ting til minispillet: ordet starter med bogstavet, og alle dets bogstaver kan tegnes */
{
  const tilNavn = ch => ({ 'æ': 'ae', 'ø': 'oe', 'å': 'aa' }[ch] || ch);
  const med = Glyffer.BOGSTAVER.filter(n => Ting.TING[n] && Ting.TING[n].length);
  const alleTing = [].concat(...med.map(n => Ting.TING[n].map(t => Object.assign({ bogstav: n }, t))));
  const forkertStart = alleTing.filter(t => tilNavn(t.ord[0]) !== t.bogstav.toLowerCase()).map(t => t.ord);
  const manglerGlyf = alleTing.filter(t => t.ord.split('').some(ch => !Glyffer.GLYFFER[tilNavn(ch)])).map(t => t.ord);
  const udenTegning = med.filter(n => typeof Ting.TING[n][0].tegn !== 'function');
  const faaTing = med.filter(n => Ting.TING[n].length < 2 && !['X', 'Y', 'AA'].includes(n));
  tjek('mindst 25 bogstaver har ting', med.length >= 25, med.length + ' har');
  tjek('der er mindst 70 ting i alt', alleTing.length >= 70, alleTing.length + ' ting');
  tjek('alle bogstaver har mindst to ting (undtagen X, Y og Å)', faaTing.length === 0, 'kun én: ' + faaTing);
  tjek('hver ting starter med sit bogstav', forkertStart.length === 0, 'forkert: ' + forkertStart);
  tjek('alle bogstaver i ordene kan tegnes', manglerGlyf.length === 0, 'mangler: ' + manglerGlyf);
  tjek('den foerste ting pr. bogstav har en tegning i kode som reserve', udenTegning.length === 0, 'uden: ' + udenTegning);
  tjek('smaa bogstaver deler ting med de store', Glyffer.SMAA.filter(n => Ting.TING[n]).length === med.length);
  const ord = alleTing.map(t => t.ord);
  tjek('ingen to ting har samme ord', new Set(ord).size === ord.length);
  const fs = require('fs');
  const manglerFil = alleTing.filter(t => t.fil && !fs.existsSync(path.join(ROD, '..', t.fil))).map(t => t.ord);
  tjek('alle tingenes billeder findes paa disken', manglerFil.length === 0, 'mangler: ' + manglerFil);
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const ikkeICache = alleTing.filter(t => t.fil && !sw.includes("'games/bogstaver/" + t.fil + "'")).map(t => t.ord);
  tjek('alle tingenes billeder er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache);
  // De malede billeder tegnes som kvadrater (drawImage med samme bredde og hoejde),
  // saa et billede, der ikke er kvadratisk, bliver trukket skaevt. Og de skal vaere smaa.
  const malede = alleTing.filter(t => t.fil && t.fil.startsWith('billeder/'));
  const png = t => fs.readFileSync(path.join(ROD, '..', t.fil));
  const skaeve = malede.filter(t => { const d = png(t); return d.readUInt32BE(16) !== d.readUInt32BE(20); }).map(t => t.ord);
  const store = malede.filter(t => png(t).length > 40 * 1024).map(t => t.ord);
  tjek('der er mindst 60 malede billeder', malede.length >= 60, malede.length + ' malede');
  tjek('alle malede billeder er kvadratiske', skaeve.length === 0, 'skaeve: ' + skaeve);
  tjek('ingen malet billede fylder over 40 KB', store.length === 0, 'for store: ' + store);
  const billedMappe = fs.readdirSync(path.join(ROD, '..', 'billeder')).filter(f => f.endsWith('.png')).map(f => f.slice(0, -4));
  const brugte = new Set(malede.map(t => t.fil.slice('billeder/'.length, -4)));
  tjek('alle billeder i billeder/ bruges af en ting', billedMappe.every(n => brugte.has(n)), 'ubrugte: ' + billedMappe.filter(n => !brugte.has(n)));
  tjek('billeder/ og ting/ har en NOTICE.md med kilden', fs.existsSync(path.join(ROD, '..', 'billeder', 'NOTICE.md')) && fs.existsSync(path.join(ROD, '..', 'ting', 'NOTICE.md')));
  // vaelg() skifter ting naar der er flere at vaelge imellem
  let skiftede = 0;
  for (let i = 0; i < 20; i++) { const a = Ting.vaelg('B'), b = Ting.vaelg('B'); if (a !== b) skiftede++; }
  tjek('vaelg() giver aldrig den samme ting to gange i traek', skiftede === 20, skiftede + ' af 20');
  tjek('licensen ligger ved siden af tegningerne', fs.existsSync(path.join(ROD, '..', 'ting', 'LICENSE')) && fs.existsSync(path.join(ROD, '..', 'ting', 'NOTICE.md')));
}

/* ORD-legen: ord til hver stjerne, og alle ordklip er indtalt */
{
  const fs = require('fs');
  const tilNavn = ch => ({ 'æ': 'ae', 'ø': 'oe', 'å': 'aa' }[ch] || ch);
  const [en, to, tre] = [0, 1, 2].map(n => Ting.ordKandidater(n));
  tjek('1 stjerne: mindst 12 ord paa hoejst 3 bogstaver', en.length >= 12 && en.every(t => t.ord.length <= 3), en.length + ' ord: ' + en.map(t => t.ord).join(' '));
  tjek('2 stjerner: mindst 30 ord paa hoejst 5 bogstaver', to.length >= 30 && to.every(t => t.ord.length <= 5), to.length + ' ord');
  tjek('3 stjerner: alle ord er med', tre.length >= 70 && tre.length === new Set(tre.map(t => t.ord)).size, tre.length + ' ord');
  tjek('ingen ord gaar igen i en stjerne', [en, to, tre].every(l => new Set(l.map(t => t.ord)).size === l.length));
  // Hvert bogstav i hvert ord kan tegnes baade stort og smaat, saa ordet kan skrives i begge kategorier
  const manglerStor = tre.filter(t => t.ord.split('').some(ch => !Glyffer.GLYFFER[tilNavn(ch).toUpperCase()])).map(t => t.ord);
  const manglerLille = tre.filter(t => t.ord.split('').some(ch => !Glyffer.GLYFFER[tilNavn(ch)])).map(t => t.ord);
  tjek('alle ord kan tegnes med store bogstaver', manglerStor.length === 0, 'mangler: ' + manglerStor);
  tjek('alle ord kan tegnes med smaa bogstaver', manglerLille.length === 0, 'mangler: ' + manglerLille);
  // Ordet siges med Camillas stemme, naar det skal tegnes, saa alle ord skal vaere indtalt
  const klip = JSON.parse(fs.readFileSync(path.join(ROD, '..', 'lyd', 'klip.json'), 'utf8'));
  const ordFil = t => t.fil ? t.fil.replace(/^.*\//, '').replace(/\.(svg|png)$/, '') : ({ 'xylofon': 'xylofon', 'ål': 'aal' })[t.ord];
  const udenKlip = tre.filter(t => !klip.includes('ord_' + ordFil(t) + '.mp3')).map(t => t.ord);
  tjek('alle ord har et indtalt klip', udenKlip.length === 0, 'mangler: ' + udenKlip);
  // Det laengste ord skal kunne staa paa en iPad i landskab (1024 x 768) med kasser, en finger kan ramme
  const laengste = Math.max(...tre.map(t => t.ord.length));
  const kasse = Math.min(1024 * 0.55 * 0.9, (1024 - 70) / (0.8 * (laengste - 1) + 1), 768 * 0.46);
  tjek('det laengste ord (' + laengste + ' bogstaver) faar kasser paa mindst 110 px paa en iPad', kasse >= 110, Math.round(kasse) + ' px');
}

/* Lydklip: rigtige optagelser (hvis der er nogen) er listet i klip.json og i cachen */
{
  const fs = require('fs');
  const LYD = path.join(ROD, '..', 'lyd');
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const klip = JSON.parse(fs.readFileSync(path.join(LYD, 'klip.json'), 'utf8'));
  const iMappen = fs.readdirSync(LYD).filter(f => f.endsWith('.mp3'));
  const ikkeListet = iMappen.filter(f => !klip.includes(f));
  const manglerFil = klip.filter(f => !fs.existsSync(path.join(LYD, f)));
  const ikkeICache = klip.filter(f => !sw.includes("'games/bogstaver/lyd/" + f + "'"));
  tjek('klip.json findes og er en liste', Array.isArray(klip));
  tjek('alle mp3-filer i lyd/ staar i klip.json', ikkeListet.length === 0, 'ikke listet: ' + ikkeListet.slice(0, 5));
  tjek('alle klip i klip.json findes', manglerFil.length === 0, 'mangler: ' + manglerFil.slice(0, 5));
  tjek('alle klip i klip.json er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache.slice(0, 5));
  tjek('klip.json er med i service workerens FILER', sw.includes("'games/bogstaver/lyd/klip.json'"));
}

/* Regnestykker efter tallene */
{
  const { Regn } = require('../games/bogstaver/js/regn.js');
  let forkerte = [], minusPaaEt = 0, nulLed = 0, daarligeValg = [];
  for (let niveau = 0; niveau < 3; niveau++) for (let svar = 0; svar <= 9; svar++) for (let n = 0; n < 200; n++) {
    const o = Regn.opgave(svar, niveau);
    const r = o.op === '+' ? o.a + o.b : o.a - o.b;
    if (r !== svar || o.a < 0 || o.a > 9 || o.b < 0 || o.b > 9 || o.svar !== svar) forkerte.push(JSON.stringify(o));
    if (niveau === 0 && o.op === '-' && svar > 0) minusPaaEt++;
    if (o.op === '+' && svar >= 2 && (o.a === 0 || o.b === 0)) nulLed++;
    const v = Regn.valg(svar);
    if (v.length !== 3 || new Set(v).size !== 3 || !v.includes(svar) || v.some(x => x < 0 || x > 9)) daarligeValg.push(svar + ': ' + v);
  }
  tjek('regnestykker: svaret er altid det tegnede tal, og alle tal er 0-9', forkerte.length === 0, forkerte.slice(0, 3).join(' '));
  tjek('regnestykker: 1 stjerne er kun plus (bortset fra 0)', minusPaaEt === 0, minusPaaEt + ' minusstykker');
  tjek('regnestykker: plus bruger ikke 0 som led, naar svaret er 2 eller mere', nulLed === 0, nulLed + ' med 0');
  tjek('regnestykker: tre forskellige svarmuligheder med det rigtige imellem', daarligeValg.length === 0, daarligeValg.slice(0, 3).join(' | '));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
