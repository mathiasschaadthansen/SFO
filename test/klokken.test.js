/**
 * Test af Klokken — koeres med `npm test`. Kraever ingen browser.
 *
 * En robot stiller alle ure og vaelger alle kort paa alle niveauer, saa ingen
 * opgave kan vaere umulig. Viserne tjekkes: de laaser rigtigt, haenger sammen
 * som paa et rigtigt ur, og tiden siges rigtigt paa dansk ("halv fire" er 3:30).
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const { Ur: U } = require(path.join(ROD, 'games', 'klokken', 'js', 'ur.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nKlokken\n');

/* Tiden siges rigtigt */
tjek('klokken 3 siges "klokken tre"', U.tekst(180) === 'klokken tre', U.tekst(180));
tjek('3:30 siges "halv fire"', U.tekst(210) === 'halv fire', U.tekst(210));
tjek('klokken 12 siges "klokken tolv", og 12:30 er "halv et"', U.tekst(0) === 'klokken tolv' && U.tekst(30) === 'halv et', U.tekst(0) + ' / ' + U.tekst(30));
tjek('11:30 er "halv tolv", og klokken 1 er "klokken et"', U.tekst(690) === 'halv tolv' && U.tekst(60) === 'klokken et');
tjek('klippene hedder klokken_3 og halv_4', U.klip(180) === 'klokken_3.mp3' && U.klip(210) === 'halv_4.mp3' && U.klip(690) === 'halv_12.mp3' && U.klip(30) === 'halv_1.mp3');
tjek('tiden gaar rundt: 720 er igen klokken 12', U.time(720) === 12 && U.norm(-60) === 660);

/* Viserne */
tjek('viserne laaser paa naermeste hele eller halve time', U.laas(62, 60) === 60 && U.laas(44, 60) === 60 && U.laas(44, 30) === 30 && U.laas(719, 30) === 0);
tjek('klokken 3: den roede viser paa 3 og den blaa paa 12', Math.abs(U.timeVinkel(180) - Math.PI / 2) < 1e-9 && U.minutVinkel(180) === 0);
tjek('halv fire: den roede viser staar midt mellem 3 og 4, den blaa paa 6', Math.abs(U.timeVinkel(210) - Math.PI * 3.5 / 6) < 1e-9 && Math.abs(U.minutVinkel(210) - Math.PI) < 1e-9);
{
  const ur = { t: 170 };                                    // 2:50
  U.traek(ur, 'minut', U.minutVinkel(5), 30);               // den blaa traekkes forbi 12 til 5 minutter over
  tjek('traekkes den blaa forbi 12, gaar den roede en time frem (2:50 -> 3:00)', ur.t === 180, ur.t);
  ur.t = 10;                                                // 12:10
  U.traek(ur, 'minut', U.minutVinkel(55), 30);              // den blaa traekkes baglaens forbi 12
  tjek('traekkes den blaa baglaens forbi 12, gaar den roede en time tilbage (12:10 -> 11:30 eller 12:00)', ur.t === 0 || ur.t === 690, ur.t);
  ur.t = 180;
  U.traek(ur, 'time', U.timeVinkel(210), 30);
  tjek('traekkes den roede til midt mellem 3 og 4, bliver det halv fire', ur.t === 210, ur.t);
  ur.t = 180;
  U.traek(ur, 'time', U.timeVinkel(200), 60);
  tjek('paa hele timer laaser den roede paa 3, ikke paa 3:20', ur.t === 180, ur.t);
  ur.t = 180;
  U.traek(ur, 'minut', U.minutVinkel(30), 60);
  tjek('paa hele timer kan den blaa ikke traekkes; den bliver paa 12', ur.t === 180, ur.t);
  ur.t = 690;                                               // 11:30
  U.traek(ur, 'time', U.timeVinkel(30), 30);                // den roede over 12 til halv et
  tjek('den roede kan traekkes over 12 (11:30 -> 12:30)', ur.t === 30, ur.t);
}

/* Planeturet: robotten loeser baade 'stil'- og 'laes'-opgaver paa alle niveauer */
{
  let problemer = [], runder = 0, slags = { stil: 0, laes: 0 };
  for (let runde = 0; runde < 15; runde++) [0, 1, 2].forEach(niveau => [1, 2].forEach(spillere => {
    const r = U.nyRejse(spillere, niveau, 'stil');
    let vagt = 0;
    while (!r.faerdig && vagt++ < 100) {
      r.stationer.forEach((s, i) => {
        if (!s.opgave || r.faerdig) return;
        const o = s.opgave, foer = o.t;
        slags[o.slags]++;
        if (o.t % r.trin !== 0) problemer.push('tid uden for gitteret ' + o.t + ' niveau ' + niveau);
        if (niveau === 0 && o.slags !== 'stil') problemer.push('1 stjerne har laese-opgaver');
        if (niveau === 0 && (o.t % 60 !== 0 || s.ur.t % 60 !== 0)) problemer.push('1 stjerne har halve timer');
        if (o.slags === 'stil') {
          if (s.ur.t === o.t) problemer.push('uret staar allerede rigtigt ' + o.t);
          if (U.tjek(r, i)) problemer.push('tjek sagde ja, foer uret var stillet');
          // Robotten traekker den roede viser til den rigtige vinkel; den blaa foelger med
          U.traek(s.ur, 'time', U.timeVinkel(o.t), r.trin);
          if (s.ur.t !== o.t) problemer.push('kunne ikke stille uret paa ' + o.t + ' fra ' + s.ur.t);
          if (!U.tjek(r, i)) problemer.push('tjek sagde nej, da uret stod rigtigt');
        } else {
          if (s.ur.t !== o.t) problemer.push('laese-opgaven viser ikke sin egen tid');
          if (o.svar !== U.talFor(o.t)) problemer.push('forkert svar paa ' + o.t);
          const forkert = o.svar === 12 ? 1 : o.svar + 1;
          if (U.tjekTal(r, i, forkert) !== 'forkert') problemer.push('et forkert tal blev godtaget');
          if (s.opgave !== o) problemer.push('opgaven skiftede efter et forkert tal');
          if (U.tjek(r, i)) problemer.push('tjek loeste en laese-opgave');
          if (U.tjekTal(r, i, o.svar) !== 'rigtigt') problemer.push('det rigtige tal blev afvist');
        }
        if (s.opgave && s.opgave.t === foer) problemer.push('samme opgave to gange i raekke');
      });
    }
    if (!r.faerdig || r.klaret !== r.maal) problemer.push('rejsen blev ikke faerdig: ' + r.klaret + '/' + r.maal);
    runder++;
  }));
  tjek('robotten loeser alle opgaver paa alle niveauer (' + runder + ' rejser)', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  tjek('baade "stil uret" og "hvad er klokken" bliver brugt', slags.stil > 0 && slags.laes > 0, JSON.stringify(slags));
  const r1 = U.nyRejse(1, 0, 'stil'), r2 = U.nyRejse(2, 2, 'stil');
  tjek('6 planeter til én spiller, 8 til to', r1.maal === 6 && r2.maal === 8 && r2.stationer.length === 2);
  tjek('3 stjerner viser ikke det lille ur, 1 og 2 goer', !U.INDSTIL.visUr[2] && U.INDSTIL.visUr[0] && U.INDSTIL.visUr[1]);
  tjek('1 stjerne har kun "stil uret", 2 og 3 har begge slags', !U.INDSTIL.laes[0] && U.INDSTIL.laes[1] && U.INDSTIL.laes[2]);
  // Det tal, der siges: "klokken tre" er 3, "halv fire" er 4
  tjek('tallet i tiden: klokken 3 er 3, halv fire er 4, halv et er 1, halv tolv er 12',
    U.talFor(180) === 3 && U.talFor(210) === 4 && U.talFor(30) === 1 && U.talFor(690) === 12 && U.talFor(0) === 12);
  // Der findes halve timer paa 2 og 3 stjerner (ellers er stjernerne ens)
  let halve = 0;
  for (let i = 0; i < 40; i++) { const r = U.nyRejse(1, 1, 'stil'); if (r.stationer[0].opgave.t % 60 === 30) halve++; }
  tjek('2 stjerner har baade hele og halve timer', halve > 5 && halve < 35, halve + ' af 40 var halve');
}

/* Musens dag */
{
  let problemer = [];
  for (let runde = 0; runde < 15; runde++) [0, 1, 2].forEach(niveau => [1, 2].forEach(spillere => {
    const r = U.nyRejse(spillere, niveau, 'dag');
    let vagt = 0;
    while (!r.faerdig && vagt++ < 100) {
      r.stationer.forEach((s, i) => {
        if (!s.opgave || r.faerdig) return;
        const o = s.opgave;
        if (o.kortene.length !== U.INDSTIL.kortAntal[niveau]) problemer.push('forkert antal kort ' + o.kortene.length);
        if (o.kortene.filter(k => k === o.kort).length !== 1) problemer.push('det rigtige kort er der ikke praecis én gang: ' + o.kortene.join());
        if (new Set(o.kortene).size !== o.kortene.length) problemer.push('samme kort to gange');
        if (s.ur.t !== U.doegnTilUr(o.t)) problemer.push('uret viser ikke opgavens tid');
        if (o.slags !== 'kort') problemer.push('Musens dag har en forkert slags opgave');
        const forkert = o.kortene.find(k => k !== o.kort);
        if (U.vaelg(r, i, forkert) !== 'forkert' || s.forsoeg !== 1) problemer.push('forkert kort blev ikke afvist');
        if (s.opgave !== o) problemer.push('opgaven skiftede efter et forkert kort');
        if (U.vaelg(r, i, o.kort) !== 'rigtigt') problemer.push('rigtigt kort blev afvist');
        if (s.opgave && s.opgave.t === o.t) problemer.push('samme dagstid to gange i raekke');
      });
    }
    if (!r.faerdig) problemer.push('dagen blev ikke faerdig');
  }));
  tjek('robotten finder det rigtige kort paa alle niveauer, og forkerte kort afvises uden straf', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  // 3 stjerner: naar uret viser 7, er baade tandboersten (7) og badet (19) med
  let tvillinger = 0, forsoeg = 0;
  for (let i = 0; i < 60; i++) {
    const r = U.nyRejse(1, 2, 'dag'), o = r.stationer[0].opgave;
    if (o.kort === 'tandboerste' || o.kort === 'bad') { forsoeg++; if (o.kortene.indexOf('tandboerste') >= 0 && o.kortene.indexOf('bad') >= 0) tvillinger++; }
  }
  tjek('3 stjerner: 7 om morgenen og 7 om aftenen ligger side om side', forsoeg > 0 && tvillinger === forsoeg, tvillinger + '/' + forsoeg);
  // 1 stjerne: kortene ligger langt fra hinanden paa uret
  let taette = 0;
  for (let i = 0; i < 60; i++) {
    const o = U.nyRejse(1, 0, 'dag').stationer[0].opgave;
    const tid = k => U.DAGEN.find(d => d.kort === k).t;
    for (let a = 0; a < o.kortene.length; a++) for (let b = a + 1; b < o.kortene.length; b++) if (U.skiveAfstand(tid(o.kortene[a]), tid(o.kortene[b])) < 2) taette++;
  }
  tjek('1 stjerne: kortene ligger mindst 2 timer fra hinanden paa uret', taette === 0, taette + ' par for taet');
  tjek('7 og 19 ligger paa samme sted paa uret', U.skiveAfstand(7 * 60, 19 * 60) === 0 && U.skiveAfstand(7 * 60, 10 * 60) === 3);
  tjek('himlen: nat, morgen, dag og aften', U.himmel(3 * 60) === 'nat' && U.himmel(7 * 60) === 'morgen' && U.himmel(14 * 60) === 'dag' && U.himmel(19 * 60) === 'aften' && U.himmel(22 * 60) === 'nat');
  const kort = U.DAGEN.map(d => d.kort), mangler = kort.filter(k => !fs.existsSync(path.join(ROD, 'assets', 'noto', k + '.svg')));
  tjek('alle kort i Musens dag har en tegning i assets/noto', mangler.length === 0, mangler.join());
  tjek('hvert kort har sin egen tid, og alle tider er hele timer', new Set(U.DAGEN.map(d => d.t)).size === U.DAGEN.length && U.DAGEN.every(d => d.t % 60 === 0));
}

/* Jorden drejer */
{
  const naer = (a, b) => Math.abs(a - b) < 1e-6;
  tjek('huset mod solen er middag, vaek fra solen er midnat', U.vinkelTilDoegn(0) === 720 && U.vinkelTilDoegn(Math.PI) === 0);
  tjek('huset i bunden er klokken 6, i toppen klokken 18', U.vinkelTilDoegn(Math.PI / 2) === 360 && U.vinkelTilDoegn(-Math.PI / 2) === 1080);
  { const d = ((U.doegnTilVinkel(U.vinkelTilDoegn(1.1)) - 1.1) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    tjek('vinkel og doegn er hinandens modsatte (paa et minut naer)', Math.min(d, Math.PI * 2 - d) < 0.005, d); }
  tjek('klokken 15 vises som 3 paa uret', U.doegnTilUr(15 * 60) === 180 && U.tekst(U.doegnTilUr(15 * 60)) === 'klokken tre');
  tjek('ved klokken 7 boerster musen taender, ved klokken 10 sker der ikke noget', U.goeremaal(7 * 60 + 20).kort === 'tandboerste' && U.goeremaal(10 * 60) === null);

  // Jorden drejer frit, men uret kan kun sige hele og halve timer. Slipper man
  // jorden paa 7:17, skal den lande paa 7:00 — ikke blive staaende, mens musen
  // siger "halv otte".
  {
    const daarlige = [];
    for (let t = 0; t < 1440; t++) {
      const L = U.landDoegn(t), ur = U.doegnTilUr(L);
      if (U.minut(ur) !== 0 && U.minut(ur) !== 30) daarlige.push(t + ' -> ' + L);
      const gm = U.goeremaal(L);
      if (gm && gm.t !== L) daarlige.push('goeremaal passer ikke ved ' + t);
      const spring = Math.abs((((L - t + 720) % 1440) + 1440) % 1440 - 720);
      if (spring > U.NAER) daarlige.push('landede ' + spring + ' minutter vaek ved ' + t);
    }
    tjek('jorden lander altid paa en tid, uret kan sige, og hoejst 20 minutter vaek', daarlige.length === 0, daarlige.slice(0, 3).join(' | '));
    tjek('landingen rammer dagens goeremaal: 7:17 bliver 7:00, og 13:41 bliver 14:00',
      U.landDoegn(7 * 60 + 17) === 7 * 60 && U.landDoegn(13 * 60 + 41) === 14 * 60 && U.landDoegn(23 * 60 + 50) === 0,
      U.landDoegn(7 * 60 + 17) + ' / ' + U.landDoegn(13 * 60 + 41) + ' / ' + U.landDoegn(23 * 60 + 50));
    tjek('uret og stemmen er enige efter en landing',
      [0, 137, 431, 760, 1111, 1439].every(t => { const ur = U.doegnTilUr(U.landDoegn(t)); return /^(klokken|halv)_/.test(U.klip(ur)) && (U.minut(ur) === 0 || U.minut(ur) === 30); }));
  }

  // Legen har en opgave: musen beder om et goeremaal, og barnet drejer derhen
  {
    const problemer = [];
    for (let runde = 0; runde < 15; runde++) {
      const r = U.nyRejse(1, 0, 'sol');
      if (r.maal !== 6) problemer.push('forkert antal opgaver: ' + r.maal);
      let vagt = 0;
      while (!r.faerdig && vagt++ < 100) {
        const s = r.stationer[0], o = s.opgave;
        if (!o) { problemer.push('ingen opgave, men legen var ikke faerdig'); break; }
        if (o.slags !== 'drej') problemer.push('forkert slags opgave: ' + o.slags);
        if (!U.DAGEN.some(d => d.t === o.t && d.kort === o.kort)) problemer.push('opgaven er ikke et af dagens goeremaal');
        const forkert = U.DAGEN.find(d => d.t !== o.t).t;
        if (U.tjekDrej(r, 0, forkert)) problemer.push('et forkert tidspunkt blev godkendt');
        if (s.forsoeg !== 1) problemer.push('forsoeget blev ikke talt');
        if (s.opgave !== o) problemer.push('opgaven skiftede efter et forkert forsoeg');
        if (!U.tjekDrej(r, 0, o.t + 14)) problemer.push('det rigtige tidspunkt blev afvist, fordi fingeren ramte lidt skaevt');
        if (s.opgave && s.opgave.t === o.t) problemer.push('samme goeremaal to gange i raekke');
      }
      if (!r.faerdig) problemer.push('legen blev ikke faerdig');
    }
    tjek('robotten drejer jorden hen til alle seks goeremaal', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  }
}

/* Filer og offline-cache */
{
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const filer = ['games/klokken/index.html', 'games/klokken/js/ur.js', 'games/klokken/js/game.js', 'games/klokken/lyd/klip.json'];
  const ikkeICache = filer.filter(f => !sw.includes("'" + f + "'"));
  tjek('spillets filer er med i service workerens FILER', ikkeICache.length === 0, ikkeICache.join());
  const noto = ['mus', 'jord', 'sol', 'maane'].concat(U.DAGEN.map(d => d.kort)).map(n => 'assets/noto/' + n + '.svg');
  const notoMangler = noto.filter(f => !fs.existsSync(path.join(ROD, f)) || !sw.includes("'" + f + "'"));
  tjek('alle Noto-tegninger findes og er i FILER', notoMangler.length === 0, notoMangler.join());
  const klip = JSON.parse(fs.readFileSync(path.join(ROD, 'games', 'klokken', 'lyd', 'klip.json'), 'utf8'));
  const klipMangler = klip.filter(f => !fs.existsSync(path.join(ROD, 'games', 'klokken', 'lyd', f)) || !sw.includes("'games/klokken/lyd/" + f + "'"));
  tjek('alle klip i klip.json findes og er i FILER', klipMangler.length === 0, klipMangler.join());
  const drej = U.DAGEN.map(d => 'drej_' + d.kort + '.mp3').filter(f => !klip.includes(f));
  tjek('hvert goeremaal har et klip til "drej jorden"-opgaven', drej.length === 0, drej.join());
  const kode = fs.readFileSync(path.join(ROD, 'games', 'klokken', 'js', 'game.js'), 'utf8');
  const naevnte = [...kode.matchAll(/'([a-z_0-9]+\.mp3)'/g)].map(m => m[1])
    .filter(f => !/^(klokken|halv)_/.test(f));
  const udenKlip = [...new Set(naevnte)].filter(f => !klip.includes(f));
  tjek('alle klip spillet naevner direkte er lavet', udenKlip.length === 0, udenKlip.join());
  const spil = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  tjek('spillet staar i spil-registret', spil.includes("id: 'klokken'"));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
