/**
 * Test af Kropshuset — koeres med `npm test`. Kraever ingen browser.
 *
 * En robot spiller de tre lege paa alle tre stjerner og tjekker: at hver
 * kropsdel har en plads paa baade Emil og Ella, inde i billedet, og at et tryk
 * midt paa pladsen er rigtigt; at et forkert tryk siger den del, man ramte; at
 * hvert organ kan findes, ogsaa naar det ligger inden i et andet (hjernen i
 * kraniet); at hver ting har ét rigtigt sansekort (to med tre stjerner); og at
 * alt, der siges, er hele saetninger og indtalt. Til sidst siden og filerne.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'games', 'krop');
const { Krop: K } = require(path.join(MAPPE, 'js', 'krop.js'));
const { Stemme } = require(path.join(ROD, 'js', 'stemme.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nKropshuset\n');

/* Kropsdelene paa Emil og Ella */
{
  const problemer = [];
  for (const f of Object.keys(K.FIGURER)) {
    const F = K.FIGURER[f], P = K.PLADS[f];
    for (const d of Object.keys(K.DELE)) {
      if (!P[d] || !P[d].length) { problemer.push(f + ': ' + d + ' har ingen plads'); continue; }
      P[d].forEach(([x, y, r]) => {
        if (x - r < 0 || x + r > F.b || y - r < 0 || y + r > F.h) problemer.push(f + ': ' + d + ' ligger uden for billedet');
        if (!K.rigtigtTryk(f, d, x, y)) problemer.push(f + ': et tryk midt paa ' + d + ' er ikke rigtigt');
      });
    }
    Object.keys(P).forEach(d => { if (!K.DELE[d]) problemer.push(f + ': ' + d + ' er ikke en kropsdel'); });
  }
  tjek('alle ' + Object.keys(K.DELE).length + ' kropsdele har en plads paa Emil og Ella, og et tryk midt paa er rigtigt', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  // Et tryk paa en lille del (naesen) er den lille del, ikke hovedet omkring den
  const smaa = ['oeje', 'naese', 'mund', 'albue', 'knae', 'ankel', 'haandled', 'taeer'];
  const forkert = [];
  for (const f of Object.keys(K.FIGURER)) smaa.forEach(d => K.PLADS[f][d].forEach(([x, y]) => { if (K.ramte(f, x, y) !== d) forkert.push(f + ': ' + d + ' -> ' + K.ramte(f, x, y)); }));
  tjek('et tryk paa en lille del er den del og ikke den store omkring den', forkert.length === 0, forkert.join(', '));
  tjek('alle kropsdele har form, bestemt form og noget, Rasmus siger', Object.keys(K.DELE).every(d => /^(din|dit|dine) /.test(K.DELE[d].form) && K.DELE[d].bestemt && /[.!?]$/.test(K.DELE[d].robot)));
  tjek('hver stjerne har nok kropsdele til en omgang', [0, 1, 2].every(n => Object.keys(K.DELE).filter(d => K.DELE[d].niveau === n).length >= 6));
  tjek('ingen kropsdele, der ikke passer til 6-aarige', !Object.keys(K.DELE).some(d => /numse|tissemand|tissekone|bryster|balle/.test(d + K.DELE[d].form)));
}

/* Robotten spiller "Hvor er din albue?" */
{
  const problemer = [], sete = new Set();
  for (let s = 0; s < 3; s++) for (let r = 0; r < 200; r++) {
    const runde = K.pegRunde(s);
    if (runde.length !== K.RUNDE || new Set(runde).size !== runde.length) problemer.push((s + 1) + '*: ' + runde.join());
    runde.forEach(d => {
      sete.add(d);
      if (K.DELE[d].niveau > s || K.DELE[d].niveau < s - 1) problemer.push((s + 1) + '*: ' + d + ' hoerer ikke til stjernen');
    });
    if (s > 0 && runde.filter(d => K.DELE[d].niveau === s).length < 4) problemer.push((s + 1) + '*: for faa nye');
  }
  tjek('seks forskellige kropsdele pr. omgang, mest fra stjernens eget niveau', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('alle kropsdele kommer frem', sete.size === Object.keys(K.DELE).length, Object.keys(K.DELE).filter(d => !sete.has(d)).join());
  tjek('spoergsmaalene lyder rigtigt paa dansk',
    K.hvorEr('albue') === 'Hvor er din albue?' && K.hvorEr('taeer') === 'Hvor er dine tæer?' &&
    K.trykPaa('knae', ['emil']) === 'Tryk så på Emils knæ.' && K.trykPaa('albue', ['emil', 'ella']) === 'Tryk så på Emils og Ellas albue.' &&
    K.detEr('knae') === 'Det er knæet.' && K.derEr('haand') === 'Ja, der er hånden.');
}

/* Robotten bruger roentgenoejet */
{
  const problemer = [];
  for (const f of Object.keys(K.FIGURER)) for (const o of Object.keys(K.ORGANER)) {
    const P = K.INDRE[f][o];
    if (!P) { problemer.push(f + ': ' + o + ' mangler'); continue; }
    if (!P.some(([x, y]) => K.paaOrgan(f, o, x, y))) problemer.push(f + ': ' + o + ' kan ikke findes');
  }
  for (let s = 0; s < 3; s++) for (let r = 0; r < 100; r++) {
    const runde = K.roentgenRunde(s);
    if (runde.length !== 3 + s * 2 || new Set(runde).size !== runde.length) problemer.push((s + 1) + '*: ' + runde.join());
    if (runde.some(o => K.ORGANER[o].niveau > s)) problemer.push((s + 1) + '*: for svaert organ');
  }
  tjek('alle organer kan findes paa begge figurer, ogsaa kraniet om hjernen', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('et organ under fingeren siges, naar det er det forkerte', K.organ('emil', ...K.INDRE.emil.hjerte[0].slice(0, 2)) === 'hjerte' && K.organ('ella', ...K.INDRE.ella.hjerne[0].slice(0, 2)) === 'hjerne');
  tjek('hjertet og maven sidder til kroppens venstre side (til hoejre paa billedet)',
    Object.keys(K.FIGURER).every(f => K.INDRE[f].hjerte[0][0] > K.INDRE[f].rygrad[0][0] && K.INDRE[f].mavesaek[0][0] > K.INDRE[f].rygrad[0][0]));
}

/* Robotten bruger sanserne */
{
  const problemer = [];
  for (let s = 0; s < 3; s++) for (let r = 0; r < 200; r++) {
    K.sanseRunde(s).forEach(q => {
      const rigtige = q.kort.filter(k => q.sanser.includes(k));
      if (rigtige.length !== q.sanser.length) problemer.push((s + 1) + '*: ' + q.ting + ' mangler et rigtigt kort');
      if (q.kort.length !== (s === 0 ? 3 : 5) || new Set(q.kort).size !== q.kort.length) problemer.push((s + 1) + '*: kortene ' + q.kort);
      if (q.to !== (s === 2) || q.sanser.length !== (s === 2 ? 2 : 1)) problemer.push((s + 1) + '*: antal sanser');
      if (!K.sanseSvar(q, q.sanser.slice())) problemer.push((s + 1) + '*: det rigtige svar godtages ikke');
      if (q.kort.some(k => !q.sanser.includes(k) && K.sanseSvar(q, q.to ? [q.sanser[0], k] : [k]))) problemer.push((s + 1) + '*: et forkert svar godtages');
      if (!fs.existsSync(path.join(MAPPE, q.billede))) problemer.push(q.ting + ': billedet findes ikke');
    });
  }
  tjek('hver ting har det rigtige antal rigtige kort, og kun de rigtige godtages', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('alle fem sanser bruges', K.SANS_RAEKKE.every(s => K.TING.some(t => t.sanser.includes(s))));
  tjek('sansekortene findes', Object.keys(K.SANSER).every(s => fs.existsSync(path.join(MAPPE, K.SANSER[s].kort))));
}

/* Robotten foelger maden og lever en sund dag */
{
  const problemer = [];
  for (const f of Object.keys(K.FIGURER)) {
    const v = K.madVej(f), F = K.FIGURER[f];
    [...v.spiseroer, ...v.tarme].forEach(([x, y]) => { if (x < 0 || x > F.b || y < 0 || y > F.h) problemer.push(f + ': vejen gaar uden for billedet'); });
    for (let i = 1; i < v.spiseroer.length; i++) if (v.spiseroer[i][1] < v.spiseroer[i - 1][1] - 1) problemer.push(f + ': spiseroeret gaar opad');
    for (let i = 1; i < v.tarme.length; i++) if (Math.hypot(v.tarme[i][0] - v.tarme[i - 1][0], v.tarme[i][1] - v.tarme[i - 1][1]) > 30) problemer.push(f + ': hul i tarmene ved punkt ' + i);
    if (Math.hypot(v.spiseroer[v.spiseroer.length - 1][0] - v.tarme[0][0], v.spiseroer[v.spiseroer.length - 1][1] - v.tarme[0][1]) > 1) problemer.push(f + ': spiseroeret og tarmene moedes ikke i maven');
    K.VEJ.forEach(w => { const c = v.steder[w.sted][0]; if (K.vejSted(f, c[0], c[1]) !== w.sted) problemer.push(f + ': ' + w.sted + ' kan ikke trykkes paa'); });
  }
  for (let s = 0; s < 3; s++) for (let r = 0; r < 50; r++) { const m = K.madRunde(s); if (m.length !== (s === 0 ? 1 : 2) || new Set(m.map(x => x.ting)).size !== m.length) problemer.push((s + 1) + '*: maden'); }
  tjek('madens vej er sammenhaengende og inde i Emil og Ella, og vejen kan huskes', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('al maden har et malet billede', K.MAD.every(m => fs.existsSync(path.join(ROD, 'games', 'bogstaver', 'billeder', m.ting + '.png'))));
  const dag = [];
  for (let s = 0; s < 3; s++) for (let r = 0; r < 100; r++) K.dagRunde(s).forEach(q => {
    if (q.kort.length !== [3, 4, 6][s] || new Set(q.kort).size !== q.kort.length || q.kort.filter(k => k === q.svar).length !== 1) dag.push((s + 1) + '*: kortene ' + q.kort);
  });
  tjek('dagen gaar fra morgen til aften, og hvert spoergsmaal har ét rigtigt kort', dag.length === 0 && K.DAG[0].tid === 'morgen' && K.DAG[K.DAG.length - 1].tid === 'aften', dag.slice(0, 3).join(' | '));
  tjek('alle kortene til dagen findes', Object.keys(K.DAG_KORT).every(k => fs.existsSync(path.join(MAPPE, K.DAG_KORT[k]))));
  tjek('haandvasken er vand, saebe, gnid, skyl og toer i den raekkefoelge', K.VASK.map(v => v.trin).join() === 'vand,saebe,gnid,skyl,toer');
  tjek('ingen mad kaldes sund eller usund, og intet om vaegt', !/usund|fed|tyk|slank|vægt|kalorie/i.test(JSON.stringify([K.DAG, K.MAD_TEKST, K.DAG_TEKST])));
}

/* Stemmen */
{
  const alle = K.saetninger();
  tjek('saetningerne er hele saetninger uden dubletter', alle.every(t => /[.!?]$/.test(t) && Stemme.saetninger(t).length === 1) && new Set(alle).size === alle.length);
  const replikker = [];
  Object.keys(K.TEKST).forEach(k => replikker.push(K.TEKST[k]));
  Object.keys(K.DELE).forEach(d => {
    replikker.push(K.hvorEr(d) + ' ' + K.pegPaa(d), K.derEr(d) + ' ' + K.DELE[d].robot, K.detEr(d) + ' ' + K.TEKST.igen);
    [['emil'], ['ella'], ['emil', 'ella']].forEach(f => replikker.push(K.trykPaa(d, f)));
  });
  Object.keys(K.ORGANER).forEach(o => replikker.push(K.find(o), K.fundet(o).join(' '), 'Det er ' + K.ORGANER[o].bestemt + '. ' + K.find(o)));
  Object.keys(K.SANSER).forEach(s => replikker.push(K.SANSER[s].ja + ' ' + K.SANSER[s].robot, K.SANSER[s].ja + ' ' + K.TEKST.enTil));
  Object.keys(K.FIGURER).forEach(f => K.MAD.forEach(m => replikker.push(K.spiser(f, m) + ' ' + K.MAD_TEKST.tygge)));
  replikker.push(K.MAD_TEKST.ud + ' ' + K.MAD_TEKST.robot);
  K.VEJ.forEach(v => replikker.push(v.ja));
  K.DAG.forEach(d => replikker.push(d.situation + ' ' + d.spoerg, d.ja + ' ' + d.robot, K.TEKST.igen + ' ' + d.spoerg));
  K.VASK.forEach(v => replikker.push(K.DAG_TEKST.vask + ' ' + v.siges, K.DAG_TEKST.foerst + ' ' + v.siges));
  replikker.push(K.DAG_TEKST.vask + ' ' + K.DAG_TEKST.nu, K.DAG_TEKST.rene);
  K.TING.concat(K.TING_TO).forEach(t => replikker.push(t.saetning + ' ' + K.TEKST.hvad, t.saetning + ' ' + K.TEKST.hvilkeTo, K.TEKST.igen + ' ' + t.saetning));
  const kendt = {}; alle.forEach(t => { kendt[t] = 'x'; });
  const udenFor = [...new Set(replikker)].filter(t => !Stemme.del(t, kendt));
  tjek('alle replikker er bygget af saetninger fra Krop.saetninger()', udenFor.length === 0, udenFor.slice(0, 3).join(' | '));
  const klip = JSON.parse(fs.readFileSync(path.join(MAPPE, 'lyd', 'klip.json'), 'utf8'));
  const filer = Object.values(klip), sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('alle klip findes og er med i FILER', filer.every(f => fs.existsSync(path.join(MAPPE, 'lyd', f)) && sw.includes("'games/krop/lyd/" + f + "'")));
  const mangler = alle.filter(t => !klip[t]);
  if (filer.length === 0) console.log('  info  ' + alle.length + ' saetninger venter paa at blive indtalt (vaerktoej/lav-lyd-gemini.py --spil krop)');
  else tjek('alt, spillet kan sige, er indtalt', mangler.length === 0, mangler.length + ' mangler, fx: ' + mangler.slice(0, 2).join(' | '));
}

/* Siden, billederne og service workeren */
{
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const game = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const logik = fs.readFileSync(path.join(MAPPE, 'js', 'krop.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('navnet staar de tre steder: <title>, menuen og forsiden',
    html.includes('<title>Kropshuset</title>') && game.includes('<h2>Kropshuset</h2>') && games.includes("navn: 'Kropshuset'"));
  tjek('siden henter skallen, menuen, stemmen og logikken', ['../../js/skal.js', '../../js/menu.js', '../../js/stemme.js', 'js/krop.js', 'js/game.js'].every(s => html.includes(s)));
  tjek('trykket er pointerdown, ikke click, saa to boern kan trykke samtidig', /laerred\.addEventListener\('pointerdown'/.test(game) && !/laerred\.addEventListener\('click'/.test(game));
  tjek('pilen i hjoernet kender menuen', /Skal\.menuKnap\(visMenu\)/.test(game));
  tjek('ingen browser-storage og ingen netvaerk', !/localStorage|sessionStorage|indexedDB|https?:\/\//.test(game + logik));
  tjek('spillet gaar ikke i staa uden lyd: en vagt sender det videre', /var vagt = setTimeout\(videre/.test(game));
  const billeder = Object.keys(K.FIGURER).map(f => 'games/krop/' + K.FIGURER[f].billede).concat(Object.keys(K.DAG_KORT).map(k => path.normalize('games/krop/' + K.DAG_KORT[k])), ['games/krop/ting/vandhane.svg']);
  const laant = ['games/bogstaver/billeder/robot.png'].concat(Object.keys(K.SANSER).map(s => path.normalize('games/krop/' + K.SANSER[s].kort)))
    .concat(K.TING.concat(K.TING_TO).map(t => 'games/bogstaver/billeder/' + t.ting + '.png'));
  const alleFiler = billeder.concat(laant);
  tjek('Emil, Ella, Rasmus, sansekortene og tingene findes og er i FILER',
    alleFiler.every(f => fs.existsSync(path.join(ROD, f)) && sw.includes("'" + f + "'")), alleFiler.filter(f => !sw.includes("'" + f + "'")).join());
  tjek('licensen ligger ved Noto-tegningerne og Canva-billederne', fs.existsSync(path.join(MAPPE, 'ting', 'LICENSE')) && fs.existsSync(path.join(MAPPE, 'ting', 'NOTICE.md')) && fs.existsSync(path.join(MAPPE, 'billeder', 'NOTICE.md')));
  const skal = ['games/krop/', 'games/krop/index.html', 'games/krop/js/krop.js', 'games/krop/js/game.js', 'games/krop/lyd/klip.json'];
  tjek('spillets filer er med i FILER', skal.every(f => sw.includes("'" + f + "'")), skal.filter(f => !sw.includes("'" + f + "'")).join());
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
