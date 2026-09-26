/**
 * Test af Egernreden — koeres med `npm test`. Kraever ingen browser.
 *
 * En robot spiller alle tre lege paa alle tre stjerner med én og to spillere
 * og tjekker hvert spoergsmaal: at svaret gives paa en talraekke med ét
 * rigtigt, at noedderne ligger paa stubben uden at roere hinanden, at Se
 * hurtigt gaar fra faste moenstre til fem mod femmer-struktur og spredt, at
 * delene giver helheden, og at Ryst og haeld finder alle maader. Til sidst:
 * at alt, der siges, er hele saetninger og indtalt, og filerne.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'games', 'egern');
const { Egern: E } = require(path.join(MAPPE, 'js', 'egern.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nEgernreden\n');

/** Ligger noedderne inde paa stubben, uden at roere hinanden? */
function ligger(pos, str, navn, problemer) {
  pos.forEach((p, i) => {
    if (Math.hypot(p.x, p.y) + str / 2 > 0.9) problemer.push(navn + ': en noed ligger ude paa barken');
    for (let j = i + 1; j < pos.length; j++) if (Math.hypot(p.x - pos[j].x, p.y - pos[j].y) < str * 1.02) problemer.push(navn + ': to noedder roerer hinanden');
  });
}

/* Robotten spiller Se hurtigt og Gemmeleg */
{
  const problemer = [], sete = [new Set(), new Set(), new Set()], moenstre = [new Set(), new Set(), new Set()];
  ['se', 'gem'].forEach(leg => {
    for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let r = 0; r < 40; r++) {
      const runde = E.nyRunde(leg, s, sp), navn = leg + '/' + (s + 1) + '*/' + sp;
      if (runde.length !== E.RUNDE[sp - 1]) problemer.push(navn + ': ' + runde.length + ' spoergsmaal');
      runde.forEach((q, i) => {
        if (sp === 2 && q.spiller !== (leg === 'gem' ? 1 - (i % 2) : i % 2)) problemer.push(navn + ': spillerne skiftes ikke');
        // Svaret gives paa en talraekke: 1-5 eller 1-10
        const n = q.svar.length;
        if ((n !== 5 && n !== 10) || q.svar.some((x, k) => x !== k + 1)) problemer.push(navn + ': svarene er ikke en talraekke');
        if (leg === 'se') {
          const [lo, hi] = E.SE_ANTAL[s];
          sete[s].add(q.antal);
          const familie = q.moenster.split(' ')[0];
          moenstre[s].add(familie);
          if (q.antal < lo || q.antal > hi) problemer.push(navn + ': ' + q.antal + ' noedder');
          if (q.svar.filter(x => E.svar(q, x)).length !== 1) problemer.push(navn + ': ikke praecis ét rigtigt svar');
          if (q.svar.length < hi) problemer.push(navn + ': talraekken naar ikke ' + hi);
          if (q.pos.length !== q.antal) problemer.push(navn + ': moenstret har ' + q.pos.length + ' noedder, ikke ' + q.antal);
          if (i && q.antal === runde[i - 1].antal) problemer.push(navn + ': samme antal to gange i traek');
          ligger(q.pos, q.str, navn, problemer);
          // Faste moenstre til fem foerst; spredt foerst ved tre stjerner
          if (s < 2 && familie === 'spredt') problemer.push(navn + ': spredt ved ' + (s + 1) + ' stjerner');
          if (s === 1 && q.antal > 5 && familie !== 'tierramme' && q.moenster.indexOf('grupper 5+') !== 0) problemer.push(navn + ': ' + q.moenster + ' er ikke "fem og"');
          if (s === 1 && i % 2 === 0 && q.antal <= 5) problemer.push(navn + ': hver anden skal vaere fra 6 til 10');
          // Delene, der lyser bagefter: de giver antallet, og den foerste del ligger for sig
          if (q.dele) {
            const [a, b] = q.dele;
            if (a + b !== q.antal || a < 1 || b < 1) problemer.push(navn + ': delene ' + a + '+' + b + ' giver ikke ' + q.antal);
            if (familie === 'grupper' && !(q.pos.slice(0, a).every(p => p.x < 0) && q.pos.slice(a).every(p => p.x > 0))) problemer.push(navn + ': grupperne ligger ikke hver for sig');
            if (familie === 'tierramme' && !q.pos.slice(0, a).every(p => p.y < 0)) problemer.push(navn + ': femmeren er ikke oeverste raekke');
            if (a > 6 || b > 6) problemer.push(navn + ': en del paa over seks');
          }
          if (familie === 'grupper' && !q.dele) problemer.push(navn + ': grupper uden dele');
          if (familie === 'tierramme' && q.antal > 5 && !q.dele) problemer.push(navn + ': tierramme uden "fem og"');
        } else if (q.selv) {
          // To spillere: den ene gemmer, den anden gaetter
          if (q.hel !== E.GEM_TO[s] || q.gemmer !== i % 2 || q.rigtig !== null) problemer.push(navn + ': gemmelegen med to er forkert sat op');
          const k = 1 + (i % (q.hel - 1));
          E.gemt(q, k);
          if (q.synlig + q.skjult !== q.hel || q.rigtig !== k || q.svar.filter(x => E.svar(q, x)).length !== 1) problemer.push(navn + ': det gemte taeller forkert');
        } else {
          const [lo, hi] = E.GEM_HEL[s];
          if (q.hel < lo || q.hel > hi) problemer.push(navn + ': Egon har ' + q.hel);
          if (q.synlig + q.skjult !== q.hel || q.synlig < 1 || q.skjult < 1) problemer.push(navn + ': delene giver ikke helheden');
          if (q.rigtig !== q.skjult || q.svar.filter(x => E.svar(q, x)).length !== 1) problemer.push(navn + ': det rigtige svar er ikke de gemte');
          if (runde.filter(x => x.hel === q.hel && x.skjult === q.skjult).length > 1) problemer.push(navn + ': samme opgave to gange');
        }
      });
    }
  });
  tjek('robotten spiller Se hurtigt og Gemmeleg paa alle stjerner: talraekke med ét rigtigt svar, noedderne ligger frit, delene giver helheden', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  tjek('Se hurtigt: 1-5 ved én stjerne, 3-10 ved to og 1-10 ved tre',
    [[1, 5], [3, 10], [1, 10]].every(([lo, hi], s) => { for (let n = lo; n <= hi; n++) if (!sete[s].has(n)) return false; return true; }),
    sete.map(x => [...x].sort((a, b) => a - b).join(',')).join(' / '));
  tjek('faste moenstre til fem ved én stjerne: raekke, femmerramme, terning og trekant', ['raekke', 'femmer', 'terning', 'trekant'].every(m => moenstre[0].has(m)) && !moenstre[0].has('spredt'), [...moenstre[0]].join(','));
  tjek('tre stjerner blander tierramme, to grupper og spredt', ['tierramme', 'grupper', 'spredt'].every(m => moenstre[2].has(m)), [...moenstre[2]].join(','));
  tjek('man ser noedderne i cirka to sekunder, lidt kortere ved tre stjerner', E.VIS[0] === 2 && E.VIS[1] === 2 && E.VIS[2] >= 1.2 && E.VIS[2] < 2);
}

/* Robotten spiller Ryst og haeld: kast, svar, til alle maader er fundet */
{
  const problemer = [];
  for (let s = 0; s < 3; s++) for (let r = 0; r < 60; r++) {
    const runde = E.nyRunde('ryst', s, 1), q = runde[0], navn = 'ryst/' + (s + 1) + '*';
    if (runde.length !== 1 || q.hel !== E.RYST_HEL[s]) problemer.push(navn + ': forkert sat op');
    let kast = 0, nye = 0;
    while (!E.alleFundet(q) && kast < 100) {
      const k = E.kast(q); kast++;
      if (k < 1 || k >= q.hel) problemer.push(navn + ': ' + k + ' i reden');
      if (q.svar.filter(x => E.svar(q, x)).length !== 1) problemer.push(navn + ': ikke ét rigtigt svar');
      const foer = q.fundet.length, ny = E.fundet(q);
      if (ny !== (q.fundet.length === foer + 1)) problemer.push(navn + ': fundet taeller forkert');
      if (ny) nye++;
    }
    if (nye !== q.hel - 1 || new Set(q.fundet).size !== q.hel - 1) problemer.push(navn + ': ikke alle maader fundet');
    if (kast > (q.hel - 1) * 4) problemer.push(navn + ': ' + kast + ' kast for ' + (q.hel - 1) + ' maader');
  }
  tjek('Ryst og haeld: hvert kast lander med mindst én i og udenfor reden, og alle maader findes uden at det trakker ud', problemer.length === 0, problemer.slice(0, 3).join(' | '));
}

/* Stemmen */
{
  const alle = E.saetninger();
  const Stemme = require(path.join(ROD, 'js', 'stemme.js')).Stemme;
  const ikkeHele = alle.filter(t => !/[.!?]$/.test(t));
  tjek('alt, spillet siger, er hele saetninger', ikkeHele.length === 0, ikkeHele.join(' | '));
  tjek('svaret siges som dele og helhed: "Ja! Fem og to er syv." (og "Ja! Tre.", naar der ingen dele er)',
    E.rigtigTekst({ leg: 'gem', synlig: 3, skjult: 2 }) === 'Ja! Tre og to er fem.' && E.egonHar(5) === 'Egon har fem nødder.' &&
    E.rigtigTekst({ leg: 'se', antal: 7, dele: [5, 2] }) === 'Ja! Fem og to er syv.' && E.rigtigTekst({ leg: 'se', antal: 3, dele: null }) === 'Ja! Tre.' &&
    E.rigtigTekst({ leg: 'ryst', hel: 5, iReden: 1 }) === 'Ja! En og fire er fem.');
  // Alt, der kan siges i spillet, kan deles i saetninger, der har et klip
  const replikker = [];
  ['se', 'gem'].forEach(leg => { for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let r = 0; r < 20; r++) E.nyRunde(leg, s, sp).forEach((q, i) => {
    if (q.selv) E.gemt(q, 1 + (r % (q.hel - 1)));
    replikker.push(E.spoergTekst(q, i === 0), E.rigtigTekst(q));
    q.svar.forEach(x => replikker.push(E.tal(x) + ' ' + E.TEKST.kigIgen));
  }); });
  for (let s = 0; s < 3; s++) { const q = E.nyRunde('ryst', s, 1)[0]; replikker.push(E.spoergTekst(q)); for (let k = 1; k < q.hel; k++) { q.iReden = k; replikker.push(E.rigtigTekst(q), E.rigtigTekst(q) + ' ' + E.TEKST.rystIgen, E.rigtigTekst(q) + ' ' + E.TEKST.rystAlle); } }
  replikker.push(E.TEKST.seSpoerg, E.TEKST.gemSkjul + ' ' + E.TEKST.gemSpoerg, E.TEKST.proevIgen, E.TEKST.faerdig, E.TEKST.gemToStart, E.TEKST.kigNu + ' ' + E.TEKST.gemSpoerg, E.TEKST.rystSpoerg);
  const kendt = {}; alle.forEach(t => { kendt[t] = 'x'; });
  const udenFor = [...new Set(replikker)].filter(t => !Stemme.del(t, kendt));
  tjek('alle replikker er bygget af saetninger fra Egern.saetninger()', udenFor.length === 0, udenFor.slice(0, 3).join(' | '));
  const klip = JSON.parse(fs.readFileSync(path.join(MAPPE, 'lyd', 'klip.json'), 'utf8'));
  const mangler = alle.filter(t => !klip[t]);
  tjek('alt, spillet kan sige, er indtalt', mangler.length === 0, mangler.length + ' mangler, fx: ' + mangler.slice(0, 2).join(' | '));
  const filer = Object.values(klip), sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('alle klip findes og er med i FILER', filer.every(f => fs.existsSync(path.join(MAPPE, 'lyd', f)) && sw.includes("'games/egern/lyd/" + f + "'")));
}

/* Siden, billederne og service workeren */
{
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const game = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const logik = fs.readFileSync(path.join(MAPPE, 'js', 'egern.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('navnet staar de tre steder: <title>, menuen og forsiden',
    html.includes('<title>Egernreden</title>') && game.includes('<h2>Egernreden</h2>') && games.includes("navn: 'Egernreden'"));
  tjek('siden henter skallen, menuen, stemmen og logikken', ['../../js/skal.js', '../../js/menu.js', '../../js/stemme.js', 'js/egern.js', 'js/game.js'].every(s => html.includes(s)));
  tjek('trykket er pointerdown, ikke click, saa to boern kan trykke samtidig', /lærred\.addEventListener\('pointerdown'/.test(game) && !/lærred\.addEventListener\('click'/.test(game));
  tjek('pilen i hjoernet kender menuen', /Skal\.menuKnap\(visMenu\)/.test(game));
  tjek('ingen browser-storage og ingen netvaerk', !/localStorage|sessionStorage|indexedDB|https?:\/\//.test(game + logik));
  const laant = ['games/bogstaver/billeder/egern.png', 'games/bogstaver/billeder/noed.png'];
  tjek('Egon og noedden er laant fra Bogstavvejen, findes og er i FILER', laant.every(f => fs.existsSync(path.join(ROD, f)) && sw.includes("'" + f + "'")));
  const skal = ['games/egern/', 'games/egern/index.html', 'games/egern/js/egern.js', 'games/egern/js/game.js', 'games/egern/lyd/klip.json'];
  tjek('spillets filer er med i FILER', skal.every(f => sw.includes("'" + f + "'")), skal.filter(f => !sw.includes("'" + f + "'")).join());
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
