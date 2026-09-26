/**
 * Test af Egernreden — koeres med `npm test`. Kraever ingen browser.
 *
 * En robot spiller begge lege paa alle tre stjerner med én og to spillere og
 * tjekker hvert spoergsmaal: at der er praecis ét rigtigt kort, at noedderne
 * ligger paa stubben uden at roere hinanden, at Se hurtigt holder sig til
 * de smaa maengder, og at Gemmelegens to dele altid giver helheden. Til
 * sidst: at alt, der siges, er hele saetninger og indtalt, og filerne.
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

/* Robotten spiller begge lege */
{
  const problemer = [], sete = [new Set(), new Set(), new Set()], moenstre = new Set();
  E.LEGE.forEach(leg => {
    for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let r = 0; r < 40; r++) {
      const runde = E.nyRunde(leg, s, sp), navn = leg + '/' + (s + 1) + '*/' + sp;
      if (runde.length !== E.RUNDE[sp - 1]) problemer.push(navn + ': ' + runde.length + ' spoergsmaal');
      runde.forEach((q, i) => {
        if (q.spiller !== (sp === 2 ? i % 2 : 0)) problemer.push(navn + ': spillerne skiftes ikke');
        if (new Set(q.svar).size !== 3) problemer.push(navn + ': to ens kort');
        if (q.svar.filter(x => E.svar(q, x)).length !== 1) problemer.push(navn + ': ikke praecis ét rigtigt kort');
        if (q.svar.some(x => x < 1 || x > 10)) problemer.push(navn + ': et kort uden for 1-10');
        if (leg === 'se') {
          const [lo, hi] = E.SE_ANTAL[s];
          sete[s].add(q.antal);
          moenstre.add(q.moenster.split(' ')[0]);
          if (q.antal < lo || q.antal > hi) problemer.push(navn + ': ' + q.antal + ' noedder');
          if (q.pos.length !== q.antal) problemer.push(navn + ': moenstret har ' + q.pos.length + ' noedder, ikke ' + q.antal);
          if (i && q.antal === runde[i - 1].antal) problemer.push(navn + ': samme antal to gange i traek');
          if (q.rigtig !== q.antal) problemer.push(navn + ': forkert rigtigt svar');
          ligger(q.pos, q.str, navn, problemer);
          // Ved tre stjerner ses 7 som 5 og 2: to grupper paa to til seks eller en tierramme
          if (s === 2) {
            const m = q.moenster.match(/^grupper (\d+)\+(\d+)$/);
            if (!m && q.moenster !== 'tierramme') problemer.push(navn + ': ' + q.moenster + ' ved tre stjerner');
            if (m && (+m[1] > 6 || +m[2] < 2 || +m[1] < +m[2] || +m[1] + +m[2] !== q.antal)) problemer.push(navn + ': grupperne ' + m[1] + '+' + m[2]);
          }
        } else {
          const [lo, hi] = E.GEM_HEL[s];
          if (q.hel < lo || q.hel > hi) problemer.push(navn + ': Egon har ' + q.hel);
          if (q.synlig + q.skjult !== q.hel || q.synlig < 1 || q.skjult < 1) problemer.push(navn + ': delene giver ikke helheden');
          if (q.rigtig !== q.skjult) problemer.push(navn + ': det rigtige svar er ikke de gemte');
          if (runde.filter(x => x.hel === q.hel && x.skjult === q.skjult).length > 1) problemer.push(navn + ': samme opgave to gange');
        }
      });
    }
  });
  tjek('robotten spiller begge lege paa alle stjerner: ét rigtigt kort, noedderne ligger frit, delene giver helheden', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  tjek('alle antal fra 1 til 4 ses ved én stjerne, 1 til 6 ved to og 4 til 10 ved tre',
    [[1, 4], [1, 6], [4, 10]].every(([lo, hi], s) => { for (let n = lo; n <= hi; n++) if (!sete[s].has(n)) return false; return true; }),
    sete.map(s => [...s].sort((a, b) => a - b).join(',')).join(' / '));
  tjek('noedderne ligger paa mange maader: terning, raekke, trekant, spredt, tierramme og to grupper',
    ['terning', 'raekke', 'trekant', 'spredt', 'tierramme', 'grupper'].every(m => moenstre.has(m)), [...moenstre].join(','));
  tjek('man ser noedderne kortere, jo flere stjerner (og lidt laengere ved to grupper)', E.VIS[0] > E.VIS[1] && E.VIS[2] >= E.VIS[1] && E.VIS[0] <= 2.5);
}

/* Gemmelegens to dele paa stubben: dem, der ses, til venstre, de gemte til hoejre under bladet (som i game.js) */
{
  const problemer = [];
  for (let n = 1; n <= 9; n++) {
    const store = n > 6, str = store ? 0.13 : 0.18;
    [-0.46, 0.46].forEach(sx => {
      const pos = (n <= 6 ? E.terning(n, 0.2) : E.tierramme(n, 0.16)).map(p => ({ x: p.x + sx, y: p.y }));
      ligger(pos, str, 'del paa ' + n, problemer);
      if (pos.some(p => Math.sign(p.x) !== Math.sign(sx))) problemer.push('del paa ' + n + ' gaar over midten');
    });
  }
  for (let hel = 2; hel <= 10; hel++) ligger(E.tierramme(hel, hel <= 5 ? 0.3 : 0.26), hel <= 5 ? 0.26 : 0.2, 'helhed ' + hel, problemer);
  tjek('begge dele og helheden kan ligge paa stubben, uden at noedderne roerer hinanden eller gaar over midten', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('kortenes terning og tierramme viser det rigtige antal', [1, 2, 3, 4, 5, 6].every(n => E.terning(n, 1).length === n) && [7, 8, 9, 10].every(n => E.tierramme(n, 1).length === n));
}

/* Stemmen */
{
  const alle = E.saetninger();
  const Stemme = require(path.join(ROD, 'js', 'stemme.js')).Stemme;
  const ikkeHele = alle.filter(t => !/[.!?]$/.test(t));
  tjek('alt, spillet siger, er hele saetninger', ikkeHele.length === 0, ikkeHele.join(' | '));
  tjek('"Ja! Tre og to er fem." og "Egon har fem noedder." siges rigtigt',
    E.rigtigTekst({ leg: 'gem', synlig: 3, skjult: 2 }) === 'Ja! Tre og to er fem.' && E.egonHar(5) === 'Egon har fem nødder.' && E.rigtigTekst({ leg: 'se', antal: 1 }) === 'Ja! En.');
  // Alt, der kan siges i spillet, kan deles i saetninger, der har et klip
  const replikker = [];
  E.LEGE.forEach(leg => { for (let s = 0; s < 3; s++) for (let r = 0; r < 20; r++) E.nyRunde(leg, s, 1).forEach((q, i) => {
    replikker.push(E.spoergTekst(q, i === 0), E.rigtigTekst(q));
    q.svar.forEach(x => replikker.push(E.tal(x) + ' ' + E.TEKST.kigIgen));
  }); });
  replikker.push(E.TEKST.seSpoerg, E.TEKST.gemSkjul + ' ' + E.TEKST.gemSpoerg, E.TEKST.proevIgen, E.TEKST.faerdig);
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
