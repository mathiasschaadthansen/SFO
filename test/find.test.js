/**
 * Test af Vrimleskoven — koeres med `npm test`. Kraever ingen browser.
 * En robot spiller alle steder paa alle tre stjerner og tjekker, at tingene
 * ligger frit, at alt kan findes, og at kategorierne holder.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'find');
const { Find: F } = require(path.join(ROD, 'js', 'find.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nVrimleskoven\n');

const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const iFiler = f => sw.includes("'" + (f ? path.posix.normalize(path.posix.join('games/find', f)) : 'games/find/') + "'");
const paaDisk = f => fs.existsSync(path.join(ROD, f));

/* Ordene: billede og stemme til alle */
{
  const alle = F.ALLE;
  tjek('der er mindst 75 ting', alle.length >= 75, alle.length + ' ting');
  const manglerFil = alle.filter(o => !paaDisk(o.fil)).map(o => o.ord);
  tjek('alle billeder findes paa disken', manglerFil.length === 0, 'mangler: ' + manglerFil);
  const ikkeICache = alle.filter(o => !iFiler(o.fil)).map(o => o.ord);
  tjek('alle billeder er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache);
  const manglerKlip = alle.filter(o => !paaDisk(o.klip)).map(o => o.ord);
  tjek('alle ord er indtalt', manglerKlip.length === 0, 'mangler: ' + manglerKlip);
  const klipIkkeICache = alle.filter(o => !iFiler(o.klip)).map(o => o.ord);
  tjek('alle ordklip er med i FILER', klipIkkeICache.length === 0, 'mangler: ' + klipIkkeICache);
  Object.keys(F.KLIP).forEach(k => tjek('klippet ' + k + ' findes og er i FILER', paaDisk(F.KLIP[k][0]) && iFiler(F.KLIP[k][0])));
  Object.keys(F.KATEGORIER).forEach(k => tjek('kategoriklippet ' + k + ' findes og er i FILER', paaDisk(F.KATEGORIER[k].klip) && iFiler(F.KATEGORIER[k].klip)));
  const klipJson = JSON.parse(fs.readFileSync(path.join(ROD, 'lyd', 'klip.json'), 'utf8'));
  const mp3 = fs.readdirSync(path.join(ROD, 'lyd')).filter(f => f.endsWith('.mp3')).sort();
  tjek('klip.json svarer til filerne i lyd/', JSON.stringify(klipJson) === JSON.stringify(mp3) && iFiler('lyd/klip.json'));
  tjek('lyd/ har en NOTICE.md', paaDisk('lyd/NOTICE.md'));
}

/* Kategorierne */
{
  const kat = F.KATEGORIER;
  const ukendte = [].concat(...Object.keys(kat).map(k => kat[k].ord.filter(o => !F.ORD[o]).map(o => k + ':' + o)));
  tjek('alle ord i kategorierne findes', ukendte.length === 0, 'ukendte: ' + ukendte);
  tjek('alle kategorier har mindst fem ord', Object.keys(kat).every(k => kat[k].ord.length >= 5));
  tjek('farvekategorierne har en farve, de andre et tegn', Object.keys(kat).every(k => kat[k].ikon === 'farve' ? /^#/.test(kat[k].farve) : ['vinge', 'pote', 'gaffel', 'hjul'].includes(kat[k].ikon)));
  tjek('ingen ord er baade roede og gule', !kat.roede.ord.some(o => kat.gule.ord.includes(o)));
}

/* Stederne */
{
  Object.keys(F.STEDER).forEach(s => {
    const st = F.STEDER[s];
    const inden = st.zoner.every(z => z.x >= 0 && z.y >= 0 && z.x + z.b <= 1000 && z.y + z.h <= 600);
    tjek(s + ': zonerne ligger i feltet', inden);
    const areal = st.zoner.reduce((a, z) => a + z.b * z.h, 0);
    tjek(s + ': der er plads nok til 34 ting', areal > 34 * 44 * 44 * 3, Math.round(areal));
    tjek(s + ': buskene ligger i feltet', st.buske.every(b => b.x > 0 && b.x < 1000 && b.y > 0 && b.y < 600));
  });
}

/* Robotten spiller alle steder paa alle tre stjerner, med én og to spillere */
{
  let problemer = [], bag = 0, alleTing = 0;
  F.STEDNAVNE.forEach(sted => {
    for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let runde = 0; runde < 15; runde++) {
      const o = F.nyOmgang(sted, s, sp), navn = sted + '/' + (s + 1) + '*/' + sp;
      const st = F.STEDER[sted], str = F.STR[s];
      if (o.ting.length < F.ANTAL[s] - 2) problemer.push(navn + ': kun ' + o.ting.length + ' ting');
      if (new Set(o.ting.map(t => t.ord)).size !== o.ting.length) problemer.push(navn + ': samme ting to gange');
      o.ting.forEach((t, i) => {
        alleTing++; if (t.bag) bag++;
        if (!st.zoner.some(z => t.x >= z.x - 1 && t.x <= z.x + z.b + 1 && t.y >= z.y - 1 && t.y <= z.y + z.h + 1)) problemer.push(navn + ': ' + t.ord + ' uden for zonerne');
        if (t.bag && !(t.skjul >= 0 && t.skjul < st.buske.length)) problemer.push(navn + ': ' + t.ord + ' bag et skjul, der ikke findes');
        if (t.x < t.str / 2 || t.x > 1000 - t.str / 2 || t.y < t.str / 2 || t.y > 600 - t.str / 2) problemer.push(navn + ': ' + t.ord + ' uden for feltet');
        if (Math.abs(t.str - str * F.skala(t.y)) > 1) problemer.push(navn + ': ' + t.ord + ' har forkert dybde');
        for (let j = i + 1; j < o.ting.length; j++) if (Math.hypot(t.x - o.ting[j].x, t.y - o.ting[j].y) < (t.str + o.ting[j].str) / 2 * 1.1) problemer.push(navn + ': ' + t.ord + ' oven i ' + o.ting[j].ord);
        st.buske.forEach(b => { if (Math.hypot(t.x - b.x, t.y - b.y) < b.r * 0.9) problemer.push(navn + ': ' + t.ord + ' helt bag en busk'); });
      });
      const iBilledet = new Set(o.ting.map(t => t.ord));
      if (o.spillere.length !== sp) problemer.push(navn + ': ' + o.spillere.length + ' spillere');
      const enkelt = [];
      o.spillere.forEach((spiller, p) => {
        if (spiller.spoergsmaal.length !== F.OMGANG) problemer.push(navn + ': ' + spiller.spoergsmaal.length + ' spoergsmaal');
        spiller.spoergsmaal.forEach((q, i) => {
          if (q.type === 'ord') {
            if (!iBilledet.has(q.ord)) problemer.push(navn + ': ' + q.ord + ' er ikke i billedet');
            enkelt.push(q.ord);
            if (F.tryk(o, p, 'xylofon') !== 'forkert') problemer.push(navn + ': forkert ting taeller');
          } else {
            if (s !== 2) problemer.push(navn + ': kategori ved ' + (s + 1) + ' stjerner');
            if (!F.KATEGORI_VED.includes(i)) problemer.push(navn + ': kategori paa plads ' + i);
            if (q.ord.length < 2 || q.ord.length > 4) problemer.push(navn + ': ' + q.kategori + ' har ' + q.ord.length + ' i billedet');
            const alleMedl = o.ting.filter(t => F.KATEGORIER[q.kategori].ord.includes(t.ord)).map(t => t.ord);
            if (alleMedl.length !== q.ord.length) problemer.push(navn + ': ' + q.kategori + ' mangler ' + (alleMedl.length - q.ord.length) + ' medlemmer');
          }
        });
      });
      if (new Set(enkelt).size !== enkelt.length) problemer.push(navn + ': samme enkeltord to gange');
      // Spil omgangen igennem: hvert svar er rigtigt, og til sidst er der ikke flere
      o.spillere.forEach((spiller, p) => {
        let mere = true, n = 0;
        while (mere && n++ < 20) {
          const q = spiller.spoergsmaal[spiller.i];
          if (q.type === 'ord') { if (F.tryk(o, p, q.ord) !== 'rigtig') problemer.push(navn + ': rigtigt svar afvist'); }
          else {
            q.ord.forEach((m, k) => { const r = F.tryk(o, p, m); const skal = k === q.ord.length - 1 ? 'alle' : 'rigtig'; if (r !== skal) problemer.push(navn + ': kategori-svar gav ' + r); });
            if (F.tryk(o, p, q.ord[0]) !== 'allerede') problemer.push(navn + ': fundet igen gav ikke allerede');
          }
          mere = F.naeste(o, p);
        }
        if (n !== F.OMGANG) problemer.push(navn + ': omgangen havde ' + n + ' spoergsmaal');
        if (F.tryk(o, p, 'kat') !== 'faerdig') problemer.push(navn + ': tryk efter slut');
      });
    }
  });
  tjek('robotten kan spille alle steder paa alle stjerner: alt kan findes, intet ligger oven i hinanden', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  tjek('cirka hver tredje ting ligger halvt bag et skjul', bag / alleTing > 0.15 && bag / alleTing < 0.45, Math.round(bag / alleTing * 100) + ' %');
  // Dybden: tingene bagest er mindre end forrest, og de er fordelt over hele hoejden
  const o0 = F.nyOmgang('eng', 0, 1), oev = o0.ting.filter(t => t.y < 230), ned = o0.ting.filter(t => t.y > 400);
  tjek('der ligger ting baade bagest og forrest', oev.length >= 3 && ned.length >= 3, oev.length + ' bagest, ' + ned.length + ' forrest');
  tjek('tingene bagest er mindre end tingene forrest', Math.max(...oev.map(t => t.str)) < Math.min(...ned.map(t => t.str)));
  tjek('ukendt sted falder tilbage til det foerste', F.nyOmgang('maanen', 0, 1).sted === F.STEDNAVNE[0]);
}

/* Siden og service workeren */
{
  const html = fs.readFileSync(path.join(ROD, 'index.html'), 'utf8');
  tjek('siden henter Bogstavvejens ting.js foer find.js', html.indexOf('../bogstaver/js/ting.js') < html.indexOf('js/find.js') && html.includes('js/game.js'));
  tjek('siden har titlen Vrimleskoven', html.includes('<title>Vrimleskoven</title>'));
  ['', 'index.html', 'js/find.js', 'js/game.js'].forEach(f => tjek("'games/find/" + f + "' staar i FILER", iFiler(f)));
  const games = fs.readFileSync(path.join(__dirname, '..', 'js', 'games.js'), 'utf8');
  tjek('forsiden har Vrimleskoven', /navn:\s*'Vrimleskoven'/.test(games) && games.includes("sti: 'games/find/'"));
}

console.log('\n' + (fejl ? fejl + ' fejl' : 'Alle tests bestaaet.'));
process.exit(fejl ? 1 : 0);
