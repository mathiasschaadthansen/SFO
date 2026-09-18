/**
 * Test af Restauranten — koeres med `npm test`. Kraever ingen browser.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { Koekken } = require(path.join(__dirname, '..', 'games', 'restaurant', 'js', 'koekken.js'));
const K = Koekken;

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nRestauranten\n');

/* Bestillingerne haenger sammen med retter og ingredienser */
{
  const ukendt = [], udenforHylde = [];
  K.BESTILLINGER.forEach(b => b.ting.forEach(t => {
    if (!K.INGREDIENSER[t]) ukendt.push(b.id + ':' + t);
    else if (!K.RETTER[b.ret].hylde.includes(t)) udenforHylde.push(b.id + ':' + t);
  }));
  tjek('alle bestillinger bruger kendte ingredienser', ukendt.length === 0, ukendt.join(' '));
  tjek('alle ingredienser staar paa rettens hylde', udenforHylde.length === 0, udenforHylde.join(' '));
  tjek('ingen to bestillinger har samme id', new Set(K.BESTILLINGER.map(b => b.id)).size === K.BESTILLINGER.length);
  [1, 2, 3].forEach(s => Object.keys(K.RETTER).forEach(r => {
    const n = K.BESTILLINGER.filter(b => b.stjerner === s && b.ret === r).length;
    if (n < 3) { console.log('  FEJL  for faa bestillinger: ' + r + ' paa ' + s + ' stjerner (' + n + ')'); fejl++; }
  }));
  tjek('1 stjerne er to ingredienser, 2 stjerner tre, 3 stjerner fire med en dobbelt',
    K.BESTILLINGER.every(b => b.ting.length === b.stjerner + 1 && (b.stjerner < 3 || new Set(b.ting).size === 3)));
}

/* Saetningerne */
{
  const b = K.BESTILLINGER.find(x => x.id === 'p3a');
  tjek('saetningen naevner retten og alle ingredienser, med "dobbelt"', K.saetning(b) === 'En pizza med dobbelt ost, tomat og champignon, tak!', K.saetning(b));
  tjek('to ingredienser bindes med "og"', K.saetning(K.BESTILLINGER.find(x => x.id === 'k1a')) === 'Pandekager med jordbær og banan, tak!');
  tjek('ingen to bestillinger giver samme saetning', new Set(K.BESTILLINGER.map(K.saetning)).size === K.BESTILLINGER.length);
}

/* Tegninger og cache */
{
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const brugt = Object.keys(K.INGREDIENSER).concat(Object.keys(K.RETTER), K.KUNDER, ['klokke', 'hjerte']);
  const manglerFil = brugt.filter(n => !fs.existsSync(path.join(__dirname, '..', 'assets', 'noto', n + '.svg')));
  const ikkeICache = brugt.filter(n => !sw.includes("'assets/noto/" + n + ".svg'"));
  tjek('der er en tegning til hver ret, ingrediens og kunde', manglerFil.length === 0, 'mangler: ' + manglerFil);
  tjek('alle tegninger er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache);
  tjek('licensen ligger ved siden af tegningerne', fs.existsSync(path.join(__dirname, '..', 'assets', 'noto', 'LICENSE')));
}

/* En forkert ingrediens bliver ikke lagt paa, og der er ingen straf */
{
  const dag = K.nyDag(1, 0);
  const s = dag.stationer[0];
  const forkert = K.RETTER[s.bestilling.ret].hylde.find(t => !s.bestilling.ting.includes(t));
  tjek('en forkert ingrediens afvises', K.laeg(dag, 0, forkert) === 'forkert' && s.lagt.length === 0);
  tjek('man kan ikke servere foer retten er klar', K.server(dag, 0) === false && dag.serveret === 0);
  tjek('hylden har alt hvad bestillingen kraever', s.bestilling.ting.every(t => s.hylde.includes(t)), s.hylde + ' / ' + s.bestilling.ting);
  tjek('hylden har 4 ting paa 1 stjerne', s.hylde.length === 4, s.hylde.length + '');
  s.bestilling.ting.forEach(t => K.laeg(dag, 0, t));
  tjek('den samme ingrediens kan ikke laegges paa for mange gange', K.laeg(dag, 0, s.bestilling.ting[0]) === 'forkert');
  tjek('retten er klar naar alt er lagt paa', K.klar(dag, 0));
  const foer = s.bestilling.id;
  tjek('klokken serverer og henter en ny kunde', K.server(dag, 0) === true && dag.serveret === 1 && s.lagt.length === 0 && s.bestilling.id !== foer);
  tjek('der findes ingen straf, tid eller point', dag.liv === undefined && dag.tid === undefined && dag.point === undefined);
}

/* Dobbelt ingrediens paa 3 stjerner skal laegges paa to gange */
{
  const dag = K.nyDag(1, 2);
  const s = dag.stationer[0];
  const dobbelt = s.bestilling.ting.find((t, i) => s.bestilling.ting.indexOf(t) !== i);
  s.bestilling.ting.filter(t => t !== dobbelt).forEach(t => K.laeg(dag, 0, t));
  K.laeg(dag, 0, dobbelt);
  tjek('én af den dobbelte er ikke nok', !K.klar(dag, 0) && K.mangler(dag, 0).join() === dobbelt, 'mangler: ' + K.mangler(dag, 0));
  K.laeg(dag, 0, dobbelt);
  tjek('to af den dobbelte goer retten klar', K.klar(dag, 0));
  tjek('hylden har 6 ting paa 3 stjerner', s.hylde.length === 6);
}

/* En robot klarer en hel dag paa alle niveauer, alene og to sammen */
[1, 2].forEach(spillere => [0, 1, 2].forEach(niveau => {
  const dag = K.nyDag(spillere, niveau);
  let tryk = 0, gentagelser = 0, sidste = [];
  while (!dag.faerdig && tryk < 2000) {
    for (let st = 0; st < spillere && !dag.faerdig; st++) {
      const s = dag.stationer[st];
      if (K.klar(dag, st)) {
        const id = s.bestilling.id;
        if (sidste[st] === id) gentagelser++;
        sidste[st] = id;
        K.server(dag, st);
      } else {
        const t = K.mangler(dag, st)[0];
        if (!s.hylde.includes(t)) { tryk = 9999; break; }
        K.laeg(dag, st, t);
      }
      tryk++;
    }
  }
  tjek(spillere + ' spiller(e), ' + (niveau + 1) + ' stjerne(r): dagen kan gennemfoeres',
    dag.faerdig && dag.serveret === dag.maal && gentagelser === 0, 'serveret ' + dag.serveret + '/' + dag.maal + ', gentagelser ' + gentagelser);
}));

/* To stationer faar ikke samme kunde eller samme bestilling paa samme tid */
{
  let ens = 0;
  for (let i = 0; i < 200; i++) {
    const dag = K.nyDag(2, 0);
    if (dag.stationer[0].kunde === dag.stationer[1].kunde || dag.stationer[0].bestilling.id === dag.stationer[1].bestilling.id) ens++;
  }
  tjek('to stationer faar forskellige kunder og bestillinger', ens === 0, ens + ' af 200');
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
