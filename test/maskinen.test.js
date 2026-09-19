/**
 * Test af Maskinen — koeres med `npm test`. Kraever ingen browser.
 *
 * Den vigtigste proeve er den samme som racertestens: hver bane har en gemt
 * loesning, og testen bygger maskinen og lader fysikken koere den. Gaar kuglen
 * ikke ned til klokken, er banen blevet uloeselig, og testen siger fra. Den
 * tjekker ogsaa, at en bane ikke kan klares uden at laegge noget ud (saa der
 * er en opgave), at hylden raekker til loesningen, og at fysikken er
 * forudsigelig: samme opstilling skal give samme forloeb hver gang.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const { Fysik: F } = require(path.join(ROD, 'games', 'maskinen', 'js', 'fysik.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nMaskinen\n');

/* Delene */
{
  const slags = Object.keys(F.DELE);
  tjek('der er dele at bygge med', slags.length >= 8, slags.join());
  const daarlige = slags.filter(s => {
    const d = F.DELE[s];
    return !d.vinkler || !d.vinkler.length || !(d.b > 0) || !(d.h > 0);
  });
  tjek('hver del har maal og mindst én stilling', daarlige.length === 0, daarlige.join());
  tjek('trampolinen kaster kuglen tilbage, rampen goer ikke', F.DELE.trampolin.hop > 1 && F.DELE.rampe.hop < 0.3);
  tjek('blaeseren har kraft og raekkevidde, baandet har fart', F.DELE.blaeser.kraft > 0 && F.DELE.blaeser.raekke > 0 && F.DELE.baand.fart > 0);
}

/* Banerne: hver loesning skal virke */
{
  const problemer = [], tider = [];
  F.BANER.forEach((b, i) => {
    const v = F.koer(b, b.loesning, 25);
    if (!v.loest) problemer.push('bane ' + (i + 1) + ' (' + b.navn + ') blev ikke loest');
    else tider.push(v.tid);
  });
  tjek('alle ' + F.BANER.length + ' baner loeses af deres egen loesning', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('ingen bane tager mere end 20 sekunder', tider.every(t => t < 20), Math.max(...tider).toFixed(1) + 's');
}

/* Loesningen skal taale, at delene ligger lidt ved siden af: ellers er banen en naal i en hoestak,
   som ingen kan finde med fingeren. Hver del flyttes op til 40 px i alle retninger. */
{
  const SKRIDT = [-40, -20, 0, 20, 40];
  const skroebelige = [];
  F.BANER.forEach((b, i) => {
    // Alle 25 forskydninger af foerste del, og et fast udvalg for resten (samme hver gang)
    let hits = 0, n = 0, frø = 11 + i;
    const rnd = () => { frø = (frø * 1103515 + 12345) % 2147483647; return frø / 2147483647; };
    for (let a = 0; a < 25; a++) {
      const lagte = b.loesning.map((d, j) => ({ slags: d.slags, vinkel: d.vinkel,
        x: d.x + (j === 0 ? SKRIDT[a % 5] : SKRIDT[Math.floor(rnd() * 5)]),
        y: d.y + (j === 0 ? SKRIDT[Math.floor(a / 5)] : SKRIDT[Math.floor(rnd() * 5)]) }));
      n++; if (F.koer(b, lagte, 14).loest) hits++;
    }
    if (hits / n < 0.2) skroebelige.push('bane ' + (i + 1) + ' (' + b.navn + ') ' + Math.round(100 * hits / n) + '%');
  });
  tjek('hver banes loesning virker ogsaa, naar delene ligger lidt skaevt (mindst 20 %)', skroebelige.length === 0, skroebelige.join(' | '));
}

/* Der skal vaere en opgave: banen maa ikke klare sig selv */
{
  const gratis = F.BANER.filter(b => F.koer(b, [], 25).loest).map(b => b.navn);
  tjek('ingen bane klarer sig selv uden dele', gratis.length === 0, gratis.join());
}

/* Hylden skal raekke til loesningen */
{
  const mangler = [];
  F.BANER.forEach((b, i) => {
    const brugt = {};
    b.loesning.forEach(d => { brugt[d.slags] = (brugt[d.slags] || 0) + 1; });
    Object.keys(brugt).forEach(s => {
      if (!b.hylde[s] || b.hylde[s] < brugt[s]) mangler.push('bane ' + (i + 1) + ' mangler ' + s);
      if (F.DELE[s].vinkler.indexOf(b.loesning.find(d => d.slags === s).vinkel) < 0) mangler.push('bane ' + (i + 1) + ': ' + s + ' i en stilling man ikke kan dreje til');
    });
    Object.keys(b.hylde).forEach(s => { if (!F.DELE[s]) mangler.push('bane ' + (i + 1) + ' har en ukendt del: ' + s); });
  });
  tjek('hylden raekker til loesningen, og delene kan drejes derhen', mangler.length === 0, mangler.slice(0, 3).join(' | '));
}

/* Delene i loesningen ligger inde i banen og ikke oven i en mur */
{
  const udenfor = [];
  F.BANER.forEach((b, i) => {
    b.loesning.forEach(d => {
      const s = F.DELE[d.slags], r = Math.max(s.b, s.h) / 2;
      if (d.x - r < -20 || d.x + r > F.BREDDE + 20 || d.y - r < -20 || d.y + r > F.HOEJDE + 20) udenfor.push('bane ' + (i + 1) + ': ' + d.slags + ' uden for banen');
      if (d.x % F.GITTER !== 0 || d.y % F.GITTER !== 0) udenfor.push('bane ' + (i + 1) + ': ' + d.slags + ' ligger ikke paa gitteret');
    });
    if (b.start.x < 0 || b.start.x > F.BREDDE || b.start.y < 0) udenfor.push('bane ' + (i + 1) + ': kuglen starter uden for banen');
    if (!b.maal) udenfor.push('bane ' + (i + 1) + ' har ingen klokke');
  });
  tjek('alle dele i loesningerne ligger inde i banen og paa gitteret', udenfor.length === 0, udenfor.slice(0, 3).join(' | '));
}

/* Fysikken skal vaere forudsigelig: samme opstilling, samme forloeb */
{
  const uens = [];
  F.BANER.forEach((b, i) => {
    const a = F.koer(b, b.loesning, 25), c = F.koer(b, b.loesning, 25);
    if (a.loest !== c.loest || Math.abs(a.tid - c.tid) > 1e-9) uens.push('bane ' + (i + 1));
  });
  tjek('to gennemspilninger af samme maskine giver det samme', uens.length === 0, uens.join());
}

/* Kuglen maa ikke smutte gennem gulvet, selv naar den falder langt */
{
  const gulv = { navn: 'proeve', start: { x: 500, y: 20 }, maal: null,
    mur: [{ x: 0, y: 560, b: 1000, h: 60 }], hylde: {}, loesning: [] };
  const v = F.koer(gulv, [], 8);
  tjek('kuglen bliver liggende paa gulvet i stedet for at falde igennem',
    v.kugle.y < 560 && v.kugle.y > 400, 'y = ' + Math.round(v.kugle.y));
  // Fra helt oppe og med fuld fart skal den ogsaa blive fanget
  const hurtig = F.nyVerden(gulv, []);
  hurtig.kugle.vy = 1800;
  for (let i = 0; i < 8 / F.DT && !hurtig.stoppet; i++) F.trin(hurtig);
  tjek('heller ikke en kugle i fuld fart smutter gennem gulvet', hurtig.kugle.y < 570, 'y = ' + Math.round(hurtig.kugle.y));
}

/* Delene skal virke hver for sig */
{
  const tom = (mur) => ({ navn: 'proeve', start: { x: 500, y: 40 }, maal: null, mur: mur || [{ x: 0, y: 560, b: 1000, h: 60 }], hylde: {}, loesning: [] });
  // Trampolinen skal kaste kuglen hoejere op, end den kom fra
  const t = F.nyVerden(tom(), [{ slags: 'trampolin', x: 500, y: 500, vinkel: 0 }]);
  let hoejest = 1e9;
  for (let i = 0; i < 4 / F.DT; i++) { F.trin(t); if (t.tid > 0.6) hoejest = Math.min(hoejest, t.kugle.y); }
  tjek('trampolinen kaster kuglen op igen', hoejest < 400, 'hoejest y = ' + Math.round(hoejest));
  // Baandet skal flytte kuglen til hoejre
  const ba = F.nyVerden(tom(), [{ slags: 'baand', x: 500, y: 520, vinkel: 0 }]);
  for (let i = 0; i < 3 / F.DT; i++) F.trin(ba);
  tjek('baandet traekker kuglen til hoejre', ba.kugle.x > 560, 'x = ' + Math.round(ba.kugle.x));
  const bv = F.nyVerden(tom(), [{ slags: 'baand', x: 500, y: 520, vinkel: 180 }]);
  for (let i = 0; i < 3 / F.DT; i++) F.trin(bv);
  tjek('et tryk vender baandet, saa kuglen koerer til venstre', bv.kugle.x < 440, 'x = ' + Math.round(bv.kugle.x));
  // Blaeseren skal puste kuglen til siden
  const bl = F.nyVerden(tom(), [{ slags: 'blaeser', x: 420, y: 300, vinkel: 90 }]);
  for (let i = 0; i < 2 / F.DT; i++) F.trin(bl);
  tjek('blaeseren puster kuglen den vej, den peger', bl.kugle.x > 560, 'x = ' + Math.round(bl.kugle.x));
  // Rampen skal sende kuglen ned ad
  const ra = F.nyVerden(tom(), [{ slags: 'rampe', x: 500, y: 300, vinkel: 40 }]);
  for (let i = 0; i < 2 / F.DT; i++) F.trin(ra);
  tjek('rampen sender kuglen ned ad til hoejre', ra.kugle.x > 560, 'x = ' + Math.round(ra.kugle.x));
  // Vippen skal tippe, naar kuglen lander i den ene ende
  const vi = F.nyVerden(tom(), [{ slags: 'vippe', x: 560, y: 400, vinkel: 0 }]);
  for (let i = 0; i < 2 / F.DT; i++) F.trin(vi);
  tjek('vippen tipper, naar kuglen lander i den ene side', Math.abs(vi.vipper[0].vinkel) > 4, 'vinkel = ' + vi.vipper[0].vinkel.toFixed(1));
  // Kanonen fanger kuglen og skyder den den vej, den peger — én gang
  const ka = F.koer(tom(), [{ slags: 'kanon', x: 500, y: 300, vinkel: 90 }], 3);
  tjek('kanonen skyder kuglen til hoejre', ka.kanoner[0].skudt && ka.kugle.x > 800, 'x = ' + Math.round(ka.kugle.x));
  const kv = F.koer(tom(), [{ slags: 'kanon', x: 500, y: 300, vinkel: 270 }], 3);
  tjek('drejet om skyder den til venstre', kv.kugle.x < 200, 'x = ' + Math.round(kv.kugle.x));
  // Tragten fanger kuglen og slipper den lige ned
  const tr = F.nyVerden(tom(), [{ slags: 'tragt', x: 560, y: 300, vinkel: 0 }]);
  tr.kugle.vx = 90;                                             // kuglen kommer skraat ind i tragten
  for (let i = 0; i < 3 / F.DT && !tr.stoppet; i++) F.trin(tr);
  tjek('tragten fanger kuglen og slipper den lige ned under sig', Math.abs(tr.kugle.x - 560) < 2 && tr.kugle.y > 400, 'x = ' + Math.round(tr.kugle.x) + ', y = ' + Math.round(tr.kugle.y));
}

/* Stoffet i murene: is er glat, sne bremser, aakandebladet kaster op */
{
  const bane = (stof) => ({ navn: 'proeve', start: { x: 100, y: 40 }, maal: null, mur: [{ x: 0, y: 200, b: 1000, h: 40, stof }], hylde: {}, loesning: [] });
  const rul = (stof) => F.koer(bane(stof), [{ slags: 'rampe', x: 120, y: 120, vinkel: 20 }], 6).kugle.x;
  tjek('paa is glider kuglen laengere end paa trae, og i sne kortere', rul('is') > rul('trae') && rul('sne') < rul('trae'), 'is ' + Math.round(rul('is')) + ', trae ' + Math.round(rul('trae')) + ', sne ' + Math.round(rul('sne')));
  const aa = F.nyVerden({ navn: 'aa', start: { x: 200, y: 40 }, maal: null, mur: [{ x: 140, y: 400, b: 120, h: 16, stof: 'aakande' }, { x: 0, y: 600, b: 1000, h: 40 }], hylde: {}, loesning: [] }, []);
  let top = 1e9;
  for (let i = 0; i < 3 / F.DT; i++) { F.trin(aa); if (aa.tid > 0.8) top = Math.min(top, aa.kugle.y); }
  tjek('aakandebladet kaster kuglen hoejt op igen', top < 150, 'hoejest y = ' + Math.round(top));
  tjek('alle stoffer har hop og gnid', Object.keys(F.STOF).every(k => F.STOF[k].hop >= 0 && F.STOF[k].gnid >= 0));
}

/* Kapitlerne: hver bane hoerer til et kapitel, og hvert kapitel har baner */
{
  const ider = F.KAPITLER.map(k => k.id);
  const udenKapitel = F.BANER.filter(b => ider.indexOf(b.kapitel) < 0).map(b => b.navn);
  tjek('alle baner hoerer til et kapitel', udenKapitel.length === 0, udenKapitel.join());
  const tomme = ider.filter(id => F.banerI(id).length < 6);
  tjek('hvert af de ' + ider.length + ' kapitler har mindst seks baner', tomme.length === 0, tomme.join());
  tjek('hvert kapitel har sin egen kugle', F.KAPITLER.every(k => typeof k.kugle === 'string' && k.kugle.length > 0));
  const nyeDele = F.BANER.filter(b => b.hylde.kanon || b.hylde.tragt).length;
  tjek('kanonen og tragten bruges i baner', nyeDele >= 6, nyeDele + ' baner');
  const stoffer = new Set(); F.BANER.forEach(b => b.mur.forEach(m => stoffer.add(m.stof || 'trae')));
  tjek('is, sne og aakande bruges i terraenet', stoffer.has('is') && stoffer.has('sne') && stoffer.has('aakande'), [...stoffer].join());
  const kuglenavne = F.KAPITLER.map(k => k.kugle);
  const figurer = fs.readFileSync(path.join(ROD, 'games', 'maskinen', 'js', 'figurer.js'), 'utf8');
  const udenBillede = kuglenavne.filter(n => !new RegExp(n + ': true').test(figurer));
  tjek('hvert kapitels kugle har et malet billede', udenBillede.length === 0, udenBillede.join());
}

/* Fri leg */
{
  tjek('fri leg har ingen klokke og masser af dele', F.FRI.maal === null && Object.keys(F.FRI.hylde).length >= 5);
  const v = F.koer(F.FRI, [], 6);
  tjek('fri leg kan ikke klares — der er ikke noget at klare', !v.loest);
}

/* Filer og offline-cache */
{
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const filer = ['games/maskinen/index.html', 'games/maskinen/js/figurer.js', 'games/maskinen/js/fysik.js', 'games/maskinen/js/game.js', 'games/maskinen/lyd/klip.json'];
  const ikkeICache = filer.filter(f => !sw.includes("'" + f + "'"));
  tjek('spillets filer er med i service workerens FILER', ikkeICache.length === 0, ikkeICache.join());
  // Figurerne er malede billeder i billeder/, resten er SVG skrevet i koden
  const figurer = fs.readFileSync(path.join(ROD, 'games', 'maskinen', 'js', 'figurer.js'), 'utf8');
  const side = fs.readFileSync(path.join(ROD, 'games', 'maskinen', 'index.html'), 'utf8');
  const malede = [...figurer.matchAll(/(\w+): true/g)].map(m => m[1]);
  const uden = malede.filter(n => !fs.existsSync(path.join(ROD, 'games', 'maskinen', 'billeder', n + '.png')) || !sw.includes("'games/maskinen/billeder/" + n + ".png'"));
  tjek('alle malede billeder findes og er i FILER', malede.length >= 17 && uden.length === 0, uden.join());
  const stoerrelse = malede.reduce((sum, n) => sum + (fs.existsSync(path.join(ROD, 'games', 'maskinen', 'billeder', n + '.png')) ? fs.statSync(path.join(ROD, 'games', 'maskinen', 'billeder', n + '.png')).size : 0), 0);
  tjek('billederne fylder under 800 KB i alt', stoerrelse < 800 * 1024, Math.round(stoerrelse / 1024) + ' KB');
  tjek('billederne har en NOTICE med licens', fs.existsSync(path.join(ROD, 'games', 'maskinen', 'billeder', 'NOTICE.md')));
  const kode = fs.readFileSync(path.join(ROD, 'games', 'maskinen', 'js', 'game.js'), 'utf8');
  // Ingen emojier eller billeder fra andre mapper: kun spillets egne malede billeder
  const fremmede = ((kode + side + figurer).match(/[\w./-]+\.(png|jpe?g|svg|webp|gif)/g) || []).filter(f => f.indexOf('icons/') < 0 && f.indexOf('billeder/') < 0);
  tjek('spillet henter ingen billeder uden for sin egen billedmappe', fremmede.length === 0, fremmede.join());
  tjek('delene er SVG skrevet i koden', /<svg xmlns/.test(figurer) && figurer.indexOf('assets/') < 0);
  const fig = ['kanin', 'pindsvin', 'aeble', 'svamp', 'trae', 'klokke', 'planke'].filter(n => !new RegExp('\\n    ' + n + ':').test(figurer));
  tjek('kanin, pindsvin, aeble, svamp, trae, klokke og planke findes', fig.length === 0, fig.join());
  const brugte = [...new Set([...kode.matchAll(/Figurer\.tegn(?:Ved)?\(\s*\w+,\s*'([a-z]+)'/g)].map(m => m[1]))];
  const ukendte = brugte.filter(n => !new RegExp('\\n    ' + n + ':').test(figurer));
  tjek('alle figurer spillet beder om er tegnet', ukendte.length === 0, ukendte.join());
  const naevnte = [...new Set([...kode.matchAll(/'([a-z_0-9]+\.mp3)'/g)].map(m => m[1]))];
  const udenKlip = naevnte.filter(f => !klip.includes(f));
  tjek('alle klip spillet naevner direkte er lavet', udenKlip.length === 0, udenKlip.join());
  const spil = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  tjek('spillet staar i spil-registret', spil.includes("id: 'maskinen'"));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
