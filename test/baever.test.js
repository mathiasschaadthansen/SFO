/**
 * Test af Bæverdammen — koeres med `npm test`. Kraever ingen browser.
 *
 * Alle baner skal kunne loeses med praecis det antal traek, der staar ved dem,
 * og antallet skal passe til stjernerne. En robot spiller hver bane igennem med
 * loeserens traek, og en anden robot roder foerst rundt paa pladsen og skal
 * saa stadig kunne faa hjaelp hele vejen ud. Til sidst: stemmen, billedet og
 * filerne i service workeren.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'games', 'baever');
const { Daemning: D } = require(path.join(MAPPE, 'js', 'daemning.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nBæverdammen\n');

/* Banerne */
{
  const N = D.N, problemer = [], set = new Set();
  tjek('tre stjerner med mindst ti baner hver', D.BANER.length === 3 && D.BANER.every(l => l.length >= 10), D.BANER.map(l => l.length).join(','));
  D.BANER.forEach((liste, s) => liste.forEach((b, k) => {
    const navn = (s + 1) + '*/' + k;
    if (b.bane.length !== N * N) { problemer.push(navn + ': ' + b.bane.length + ' tegn'); return; }
    if (set.has(b.bane)) problemer.push(navn + ': samme bane to gange'); set.add(b.bane);
    // Hvert bogstav er én lige stamme paa 2 eller 3 felter
    const felter = {};
    [...b.bane].forEach((c, i) => { if (c !== '.') (felter[c] = felter[c] || []).push(i); });
    Object.keys(felter).forEach(c => {
      const f = felter[c], rk = f.map(i => Math.floor(i / N)), kl = f.map(i => i % N);
      const vandret = rk.every(r => r === rk[0]) && kl.every((x, j) => j === 0 || x === kl[j - 1] + 1);
      const lodret = kl.every(x => x === kl[0]) && rk.every((r, j) => j === 0 || r === rk[j - 1] + 1);
      if (!(vandret || lodret) || f.length < 2 || f.length > 3) problemer.push(navn + ': stammen ' + c + ' er ikke lige eller har forkert laengde');
    });
    const p = D.lav(b.bane), a = p.stammer[0];
    if (!a.maal || a.lodret || a.len !== 2 || a.y !== D.UD_RAEKKE) problemer.push(navn + ': Bodils stamme ligger forkert');
    if (D.loest(p)) problemer.push(navn + ': allerede loest');
    if (D.tekst(D.lav(D.tekst(p))) !== D.tekst(p)) problemer.push(navn + ': tekst og lav passer ikke sammen');
    const l = D.loes(p);
    if (!l) { problemer.push(navn + ': kan ikke loeses'); return; }
    if (l.length !== b.traek) problemer.push(navn + ': kraever ' + l.length + ' traek, ikke ' + b.traek);
    const [lo, hi] = D.TRAEK[s];
    if (l.length < lo || l.length > hi) problemer.push(navn + ': ' + l.length + ' traek passer ikke til ' + (s + 1) + ' stjerner');
    // Robotten spiller banen med loeserens traek; hvert traek skal vaere lovligt
    const q = D.kopi(p);
    l.forEach(t => { if (!D.flyt(q, t.i, t.til)) problemer.push(navn + ': ulovligt traek i loesningen'); });
    if (!D.loest(q)) problemer.push(navn + ': robotten fik ikke stammen ud');
  }));
  tjek('alle baner kan loeses med praecis det antal traek, der staar, og det passer til stjernerne', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  const snit = D.BANER.map(l => l.reduce((x, b) => x + b.traek, 0) / l.length);
  tjek('flere stjerner er svaerere', snit[0] < snit[1] && snit[1] < snit[2], snit.map(x => x.toFixed(1)).join(' < '));
}

/* Traekkene: en stamme glider kun den vej, den ligger, og kun saa langt, der er plads */
{
  const p = D.lav('.....B' + '.....B' + 'AA.C..' + '...C..' + 'DD....' + '......');
  tjek('Bodils stamme kan glide til hoejre op til stammen paa langs', D.fri(p, 0).min === 0 && D.fri(p, 0).max === 1);
  const c = p.stammer.findIndex(s => s.x === 3 && s.lodret);
  tjek('stammen paa langs kan glide op og ned, til den rammer kanten', D.fri(p, c).min === 0 && D.fri(p, c).max === 4);
  tjek('et traek ud over kanten afvises', !D.flyt(D.kopi(p), c, 5));
  tjek('et traek gennem en anden stamme afvises', !D.flyt(D.kopi(p), 0, 3));
  const q = D.kopi(p); D.flyt(q, c, 4);
  tjek('naar vejen er fri, kan Bodils stamme glide helt ud til aabningen', D.fri(q, 0).max === 4 && D.flyt(q, 0, 4) && D.loest(q));
}

/* Hjaelpen: fra hvilken som helst stilling er der et naeste traek, og det bringer stammen naermere */
{
  let problemer = [], n = 0;
  D.BANER.forEach((liste, s) => liste.forEach((b, k) => {
    const p = D.lav(b.bane);
    // Robotten roder rundt med tilfaeldige traek, som et barn der proever sig frem
    for (let r = 0; r < 12; r++) { const alle = D.traek(p); if (!alle.length) break; D.saet(p, alle[Math.floor(Math.random() * alle.length)]); }
    let foer = D.loes(p), skridt = 0;
    if (!foer) { problemer.push((s + 1) + '*/' + k + ': kan ikke loeses efter rod'); return; }
    while (!D.loest(p) && skridt++ < 40) {
      const h = D.hjaelp(p);
      if (!h || !D.flyt(p, h.i, h.til)) { problemer.push((s + 1) + '*/' + k + ': hjaelpen gav et ulovligt traek'); return; }
      const efter = D.loes(p);
      if (efter.length !== foer.length - 1) { problemer.push((s + 1) + '*/' + k + ': hjaelpen bragte ikke stammen naermere'); return; }
      foer = efter; n++;
    }
    if (!D.loest(p)) problemer.push((s + 1) + '*/' + k + ': hjaelpen naaede ikke ud');
  }));
  tjek('hjaelpen finder altid et traek, der bringer Bodils stamme naermere, ogsaa efter rod', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('hjaelpen er intet traek, naar banen er loest', D.hjaelp(D.lav('......' + '......' + '....AA' + '......' + '......' + '......')) === null);
}

/* Runderne */
{
  let problemer = [];
  for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let r = 0; r < 20; r++) {
    const runde = D.nyRunde(s, sp);
    if (runde.length !== sp) problemer.push('forkert antal spillere');
    runde.forEach(b => {
      if (b.length !== D.RUNDE) problemer.push(b.length + ' baner');
      if (new Set(b).size !== b.length) problemer.push('samme bane to gange');
      b.forEach((x, i) => { if (!D.BANER[s][x]) problemer.push('bane findes ikke'); if (i && D.BANER[s][x].traek < D.BANER[s][b[i - 1]].traek) problemer.push('ikke nemmeste foerst'); });
    });
    if (sp === 2 && runde[0].some(x => runde[1].includes(x))) problemer.push('de to spillere faar samme bane');
  }
  tjek('en runde er ' + D.RUNDE + ' baner pr. spiller, nemmeste foerst, forskellige for to spillere', problemer.length === 0, problemer.slice(0, 3).join(' | '));
}

/* Stemmen: hele saetninger, og alle er indtalt */
{
  const alle = D.saetninger();
  tjek('stemmen har noget at sige', alle.length >= 8, alle.length + ' saetninger');
  const Stemme = require(path.join(ROD, 'js', 'stemme.js')).Stemme;
  const ikkeHele = alle.filter(t => !/[.!?]$/.test(t));
  tjek('alt, spillet siger, er hele saetninger', ikkeHele.length === 0, ikkeHele.join(' | '));
  const klip = JSON.parse(fs.readFileSync(path.join(MAPPE, 'lyd', 'klip.json'), 'utf8'));
  const mangler = alle.filter(t => !Stemme.del(t, klip));
  tjek('alt, spillet kan sige, er indtalt', mangler.length === 0, mangler.length + ' mangler, fx: ' + mangler.slice(0, 2).join(' | '));
  const filer = Object.values(klip);
  tjek('alle klip findes', filer.every(f => fs.existsSync(path.join(MAPPE, 'lyd', f))));
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('alle klip er med i FILER', filer.every(f => sw.includes("'games/baever/lyd/" + f + "'")));
}

/* Siden, billedet og service workeren */
{
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const game = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('navnet staar de tre steder: <title>, menuen og forsiden',
    html.includes('<title>Bæverdammen</title>') && game.includes('<h2>Bæverdammen</h2>') && games.includes("navn: 'Bæverdammen'"));
  tjek('siden henter skallen, menuen, stemmen og logikken', ['../../js/skal.js', '../../js/menu.js', '../../js/stemme.js', 'js/daemning.js', 'js/game.js'].every(s => html.includes(s)));
  tjek('hver finger foelges for sig (pointerId)', /pointerId/.test(game) && /pointermove/.test(game) && !/addEventListener\('click', function \(e\) \{\s*tryk/.test(game));
  tjek('pilen i hjoernet kender menuen', /Skal\.menuKnap\(visMenu\)/.test(game));
  tjek('ingen browser-storage og ingen netvaerk', !/localStorage|sessionStorage|indexedDB|https?:\/\//.test(game + fs.readFileSync(path.join(MAPPE, 'js', 'daemning.js'), 'utf8')));
  const png = path.join(MAPPE, 'billeder', 'bodil.png');
  tjek('Bodil er malet og fylder under 40 KB', fs.existsSync(png) && fs.statSync(png).size < 40 * 1024, fs.existsSync(png) ? Math.round(fs.statSync(png).size / 1024) + ' KB' : 'mangler');
  tjek('billeder/ har en NOTICE.md', fs.existsSync(path.join(MAPPE, 'billeder', 'NOTICE.md')));
  const skal = ['games/baever/', 'games/baever/index.html', 'games/baever/js/daemning.js', 'games/baever/js/game.js', 'games/baever/billeder/bodil.png', 'games/baever/lyd/klip.json'];
  tjek('spillets filer er med i FILER', skal.every(f => sw.includes("'" + f + "'")), skal.filter(f => !sw.includes("'" + f + "'")).join());
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
