/**
 * Test af Rimhulen — koeres med `npm test`. Kraever ingen browser.
 * Reglerne i rim.js koeres igennem af en robot paa alle tre svaerhedsgrader,
 * og alle ord tjekkes for billede, stemme og stavelser.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'rim');
const { Rim: R } = require(path.join(ROD, 'js', 'rim.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nRimhulen\n');

const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const iFiler = f => sw.includes("'" + (f ? path.posix.normalize(path.posix.join('games/rim', f)) : 'games/rim/') + "'");
const paaDisk = f => fs.existsSync(path.join(ROD, f));

/* Ordene: alle har billede eller tegning, stemme og stavelser */
{
  const alle = R.ALLE;
  tjek('der er mindst 80 ord', alle.length >= 80, alle.length + ' ord');
  tjek('ingen to ord er ens', new Set(alle.map(o => o.ord)).size === alle.length);
  const udenBillede = alle.filter(o => !o.fil && !o.tegn).map(o => o.ord);
  tjek('alle ord har et billede eller en tegning i kode', udenBillede.length === 0, 'uden: ' + udenBillede);
  const manglerFil = alle.filter(o => o.fil && !paaDisk(o.fil)).map(o => o.ord);
  tjek('alle billeder findes paa disken', manglerFil.length === 0, 'mangler: ' + manglerFil);
  const ikkeICache = alle.filter(o => o.fil && !iFiler(o.fil)).map(o => o.ord);
  tjek('alle billeder er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache);
  const manglerKlip = alle.filter(o => !paaDisk(o.klip)).map(o => o.ord);
  tjek('alle ord er indtalt', manglerKlip.length === 0, 'mangler: ' + manglerKlip);
  const klipIkkeICache = alle.filter(o => !iFiler(o.klip)).map(o => o.ord);
  tjek('alle ordklip er med i FILER', klipIkkeICache.length === 0, 'mangler: ' + klipIkkeICache);
  const udenStavelser = alle.filter(o => !(R.STAVELSER[o.ord] >= 1 && R.STAVELSER[o.ord] <= 4)).map(o => o.ord);
  tjek('alle ord har 1-4 stavelser', udenStavelser.length === 0, 'uden: ' + udenStavelser);
  const loese = Object.keys(R.STAVELSER).filter(o => !R.ORD[o]);
  tjek('stavelsestabellen har kun ord, der findes', loese.length === 0, 'loese: ' + loese);
  Object.keys(R.KLIP).forEach(k => {
    tjek('klippet ' + k + ' findes og er i FILER', paaDisk(R.KLIP[k][0]) && iFiler(R.KLIP[k][0]));
  });
  tjek('klip.json staar i FILER', iFiler('lyd/klip.json'));
  const klipJson = JSON.parse(fs.readFileSync(path.join(ROD, 'lyd', 'klip.json'), 'utf8'));
  const mp3 = fs.readdirSync(path.join(ROD, 'lyd')).filter(f => f.endsWith('.mp3')).sort();
  tjek('klip.json svarer til filerne i lyd/', JSON.stringify(klipJson) === JSON.stringify(mp3));
}

/* Rimgrupperne */
{
  const iGruppe = [].concat(...R.RIM);
  tjek('der er mindst 15 rimgrupper', R.RIM.length >= 15, R.RIM.length + ' grupper');
  tjek('alle grupper har mindst to ord', R.RIM.every(g => g.length >= 2));
  tjek('ingen ord staar i to grupper', new Set(iGruppe).size === iGruppe.length);
  const ukendte = iGruppe.filter(o => !R.ORD[o]);
  tjek('alle ord i grupperne findes', ukendte.length === 0, 'ukendte: ' + ukendte);
  tjek('der er nok grupper til en hel omgang', R.RIM.length >= R.OMGANG);
  tjek('rimparrene lyder rigtigt', R.GRUPPE.kat === R.GRUPPE.hat && R.GRUPPE.hus === R.GRUPPE.mus && R.GRUPPE.fly === R.GRUPPE.paraply && R.GRUPPE.kat !== R.GRUPPE.hus);
}

/* Robotten spiller rim paa alle tre svaerhedsgrader */
{
  let problemer = [];
  for (let s = 0; s < 3; s++) {
    for (let runde = 0; runde < 20; runde++) {
      const omgang = R.nyRimOmgang(s);
      if (omgang.length !== R.OMGANG) problemer.push(s + ': ' + omgang.length + ' spoergsmaal');
      const ord = omgang.map(o => o.ord);
      if (new Set(ord).size !== ord.length) problemer.push(s + ': samme ord to gange');
      omgang.forEach(o => {
        const rigtige = o.kort.filter(k => k.rigtig);
        if (o.kort.length !== R.KORT[s]) problemer.push(s + ': ' + o.kort.length + ' kort ved ' + o.ord);
        if (rigtige.length !== 1) problemer.push(s + ': ' + rigtige.length + ' rigtige ved ' + o.ord);
        if (o.kort.some(k => k.ord === o.ord)) problemer.push(s + ': ordet selv er et kort ved ' + o.ord);
        o.kort.forEach(k => {
          const rimer = R.GRUPPE[k.ord] === R.GRUPPE[o.ord];
          if (rimer !== k.rigtig) problemer.push(s + ': ' + k.ord + ' ved ' + o.ord + ' er ' + (k.rigtig ? 'rigtig' : 'forkert'));
          if (R.svar(o, k.ord) !== (k.rigtig ? 'rigtig' : 'forkert')) problemer.push(s + ': svar() svarer forkert');
        });
        if (new Set(o.kort.map(k => k.ord)).size !== o.kort.length) problemer.push(s + ': samme kort to gange ved ' + o.ord);
      });
    }
  }
  tjek('robotten kan spille rim paa alle svaerhedsgrader: ét rigtigt kort, resten rimer ikke', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  tjek('svar paa et ord, der ikke er et kort, er forkert', R.svar({ ord: 'kat', kort: [{ ord: 'hat', rigtig: true }] }, 'bil') === 'forkert');
  // Tre stjerner: de forkerte kort har samme antal stavelser som det rigtige, naar det kan lade sig goere
  let ens = 0, alle = 0;
  for (let runde = 0; runde < 20; runde++) R.nyRimOmgang(2).forEach(o => {
    const rigtig = o.kort.find(k => k.rigtig);
    o.kort.forEach(k => { if (!k.rigtig) { alle++; if (R.STAVELSER[k.ord] === R.STAVELSER[rigtig.ord]) ens++; } });
  });
  tjek('ved tre stjerner ligner de forkerte kort det rigtige i stavelser', ens / alle > 0.9, Math.round(ens / alle * 100) + ' %');
}

/* Robotten klapper alle ord paa alle tre svaerhedsgrader */
{
  let problemer = [];
  for (let s = 0; s < 3; s++) {
    for (let runde = 0; runde < 20; runde++) {
      const omgang = R.nyKlapOmgang(s);
      if (omgang.length !== R.OMGANG) problemer.push(s + ': ' + omgang.length + ' ord');
      if (new Set(omgang.map(o => o.ord)).size !== omgang.length) problemer.push(s + ': samme ord to gange');
      omgang.forEach(o => {
        if (o.n > R.STAV_MAKS[s]) problemer.push(s + ': ' + o.ord + ' har ' + o.n + ' stavelser');
        if (o.n !== R.STAVELSER[o.ord]) problemer.push(s + ': n passer ikke ved ' + o.ord);
        // Klap praecis n gange: sidste klap melder fuld, de andre klap
        const t = { antal: 0 };
        for (let k = 1; k <= o.n; k++) {
          const r = R.klap(o, t);
          if (r !== (k === o.n ? 'fuld' : 'klap')) problemer.push(s + ': klap ' + k + ' af ' + o.n + ' gav ' + r);
        }
        // Ét klap for meget: forfra
        if (R.klap(o, t) !== 'for_mange' || t.antal !== 0) problemer.push(s + ': for mange klap nulstiller ikke ved ' + o.ord);
      });
    }
  }
  tjek('robotten kan klappe alle ord: n klap er fuld, n+1 starter forfra', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  tjek('én stjerne giver kun korte ord', R.nyKlapOmgang(0).every(o => o.n <= 2));
}

/* Billeder og tegninger: kvadratiske, smaa, med licens */
{
  const malede = fs.readdirSync(path.join(ROD, 'billeder')).filter(f => f.endsWith('.png'));
  const skaeve = malede.filter(f => { const d = fs.readFileSync(path.join(ROD, 'billeder', f)); return d.readUInt32BE(16) !== d.readUInt32BE(20); });
  const store = malede.filter(f => fs.statSync(path.join(ROD, 'billeder', f)).size > 40 * 1024);
  tjek('de malede billeder er kvadratiske', skaeve.length === 0, 'skaeve: ' + skaeve);
  tjek('ingen malet billede fylder over 40 KB', store.length === 0, 'for store: ' + store);
  tjek('billeder/ og ting/ har NOTICE.md, og ting/ har LICENSE', paaDisk('billeder/NOTICE.md') && paaDisk('ting/NOTICE.md') && paaDisk('ting/LICENSE'));
  const brugte = new Set(R.ALLE.map(o => o.fil));
  const ubrugte = fs.readdirSync(path.join(ROD, 'ting')).filter(f => f.endsWith('.svg') && !brugte.has('ting/' + f))
    .concat(malede.filter(f => !brugte.has('billeder/' + f)));
  tjek('alle billeder i ting/ og billeder/ bruges af et ord', ubrugte.length === 0, 'ubrugte: ' + ubrugte);
}

/* Siden og service workeren */
{
  const html = fs.readFileSync(path.join(ROD, 'index.html'), 'utf8');
  tjek('siden henter Bogstavvejens ting.js foer rim.js', html.indexOf('../bogstaver/js/ting.js') < html.indexOf('js/rim.js') && html.includes('js/game.js'));
  tjek('siden har titlen Rimhulen', html.includes('<title>Rimhulen</title>'));
  ['', 'index.html', 'js/rim.js', 'js/game.js'].forEach(f => tjek("'games/rim/" + f + "' staar i FILER", iFiler(f)));
  const games = fs.readFileSync(path.join(__dirname, '..', 'js', 'games.js'), 'utf8');
  tjek('forsiden har Rimhulen', /navn:\s*'Rimhulen'/.test(games) && games.includes("sti: 'games/rim/'"));
}

console.log('\n' + (fejl ? fejl + ' fejl' : 'Alle tests bestaaet.'));
process.exit(fejl ? 1 : 0);
