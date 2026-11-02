/**
 * Test af Pelles julekalender — koeres med `npm test`. Kraever ingen browser.
 *
 * Tjekker de 24 dage (tre afsnit hver, ugernes emner), hvornaar laagerne kan
 * aabnes, at hver opgave er gyldig (forlyden, rimene, stavelserne, bogstavet,
 * tallene), at brikkerne ligger inde i billedet, og at puslespillets 24 brikker
 * daekker motivet og kan laegges. Til sidst: at ingen replik har
 * anfoerselstegn, at alt, der siges, er hele saetninger, og at alle billeder og
 * alt, der siges, findes paa disken og i lyd/klip.json. De to sidste fejler,
 * indtil billederne er malet og stemmen er indtalt — med vilje.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'jul');
const { Kalender: K } = require(path.join(MAPPE, 'js', 'kalender.js'));
const { Puslespil: P } = require(path.join(MAPPE, 'js', 'puslespil.js'));
const { Opgaver: O } = require(path.join(MAPPE, 'js', 'opgaver.js'));
const { Rim } = require(path.join(ROD, 'games', 'rim', 'js', 'rim.js'));
const { Glyffer } = require(path.join(ROD, 'games', 'bogstaver', 'js', 'glyffer.js'));
const { Spor } = require(path.join(ROD, 'games', 'bogstaver', 'js', 'spor.js'));
const { Stemme } = require(path.join(ROD, 'js', 'stemme.js'));
const SW = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
const FILER = [...SW.match(/const FILER = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);
const FILER_JUL = [...SW.match(/const FILER_JUL = \[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m => m[1]);

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}
const findes = rel => fs.existsSync(path.join(ROD, rel));

console.log('\nPelles julekalender\n');

/* Dagene */
{
  const D = K.DAGE;
  tjek('der er 24 dage', D.length === 24, D.length + ' dage');
  tjek('dagene er 1..24 i orden', D.every((d, i) => d.dag === i + 1));
  tjek('hver dag har tre afsnit med billede og tekst', D.every(d => d.afsnit.length === 3 && d.afsnit.every(a => /^billeder\/.+\.(jpg|png)$/.test(a.billede) && a.tekst.length > 0)),
    D.filter(d => d.afsnit.length !== 3).map(d => d.dag).join());
  const emne = n => n <= 7 ? 'tal' : n <= 14 ? 'bogstaver' : n <= 21 ? 'rim' : 'faellesskab';
  const forkert = D.filter(d => d.emne !== emne(d.dag));
  tjek('ugernes emner: 1-7 tal, 8-14 bogstaver, 15-21 rim, 22-24 faellesskab', forkert.length === 0, forkert.map(d => d.dag + ':' + d.emne).join());
  tjek('hver dag har sted, titel, brik og opgave', D.every(d => d.sted && d.titel && d.brik && d.opgave && d.opgave.type));
  tjek('figurerne, Pelle moeder, findes i NAVNE og har et billede (Nis tegnes i kode)', D.every(d => (d.moeder || []).every(n => K.NAVNE[n] && (O.FIGURER[n] === null ? n === 'nis' : findes(O.FIGURER[n])))));
  tjek('spoergsmaal i historien har baade spoerg og svar', D.every(d => d.afsnit.every(a => a.tekst.every(t => typeof t === 'string' ? t.trim() : t.spoerg && t.svar))));
}

/* Laagerne */
{
  const alle = (dato) => K.DAGE.map(d => K.aaben(d.dag, dato));
  const aar = 2026;
  tjek('i november er alle laager lukket', [1, 15, 30].every(n => alle(new Date(aar, 10, n)).every(a => !a)));
  tjek('i december aabner laagerne til og med dagen', [1, 5, 13, 23, 24].every(n => alle(new Date(aar, 11, n)).every((a, i) => a === (i + 1 <= n))));
  tjek('efter jul kan alle laager aabnes', [26, 31].map(n => new Date(aar, 11, n)).concat([new Date(aar + 1, 0, 6), new Date(aar + 1, 5, 1)]).every(d => alle(d).every(a => a)));
}

/* Opgaverne */
{
  const TYPER = ['tael', 'se', 'flest', 'spor', 'forlyd', 'rim', 'klap', 'pynt', 'venner', 'puslespil'];
  const problemer = [];
  K.DAGE.forEach(d => {
    const o = d.opgave, f = O.forbered(d), n = 'dag ' + d.dag + ' (' + o.type + ')';
    if (TYPER.indexOf(o.type) < 0) { problemer.push(n + ': ukendt type'); return; }
    if (o.type === 'forlyd') {
      const forlyd = w => w.charAt(0).toUpperCase();
      if (forlyd(o.eksempel) !== o.lyd) problemer.push(n + ': eksemplet ' + o.eksempel + ' starter ikke med ' + o.lyd);
      o.runder.forEach(r => {
        if (forlyd(r.rigtig) !== o.lyd) problemer.push(n + ': ' + r.rigtig + ' starter ikke med ' + o.lyd);
        r.andre.forEach(a => { if (forlyd(a) === o.lyd) problemer.push(n + ': ' + a + ' starter ogsaa med ' + o.lyd); });
        if (r.andre.length < 1) problemer.push(n + ': for faa kort');
      });
    }
    if (o.type === 'rim') o.runder.forEach(r => {
      const g = Rim.GRUPPE[r.ord];
      if (g === undefined || Rim.GRUPPE[r.rigtig] !== g || r.ord === r.rigtig) problemer.push(n + ': ' + r.rigtig + ' rimer ikke paa ' + r.ord + ' ifoelge Rim.RIM');
      r.andre.forEach(a => { if (Rim.GRUPPE[a] === g) problemer.push(n + ': ' + a + ' rimer ogsaa paa ' + r.ord); });
    });
    if (o.type === 'klap') o.runder.forEach(r => { if (!(Rim.STAVELSER[r.ord] > 0)) problemer.push(n + ': ' + r.ord + ' har ingen stavelser i Rim.STAVELSER'); });
    if (o.type === 'spor') {
      if (!Glyffer.GLYFFER[f.glyf] || Glyffer.BOGSTAVER.indexOf(f.glyf) < 0) problemer.push(n + ': ' + o.bogstav + ' findes ikke i Bogstavvejens bogstaver');
      else {
        // En finger, der foelger stregen (lidt skaevt), kan tegne bogstavet faerdigt
        const sp = new Spor(Glyffer.GLYFFER[f.glyf], 14);
        sp.streger.forEach(st => { sp.start(st[0][0] + 2, st[0][1] - 1); st.forEach(q => sp.flyt(q[0] + 2, q[1] - 1)); sp.slip(); });
        if (!sp.faerdig) problemer.push(n + ': ' + o.bogstav + ' kan ikke tegnes faerdigt');
      }
      if (!/^\S+ som i .+\.$/.test(o.ord) || o.ord.charAt(0) !== o.bogstav) problemer.push(n + ': ' + o.ord + ' er ikke i formen "S som i sne."');
    }
    if (o.type === 'tael') {
      if (!(o.antal >= 1 && o.antal <= 10 && o.antal % 1 === 0)) problemer.push(n + ': antal ' + o.antal);
      if (!O.tingFindes(o.ting)) problemer.push(n + ': tingen ' + o.ting + ' kendes ikke');
      if (f.pladser.pos.length !== o.antal) problemer.push(n + ': ' + f.pladser.pos.length + ' pladser til ' + o.antal);
      const pos = f.pladser.pos;
      pos.forEach((p, i) => {
        if (p.x < 0.05 || p.x > 0.95 || p.y < 0.05 || p.y > 0.95) problemer.push(n + ': en ting staar uden for feltet');
        for (let j = i + 1; j < pos.length; j++) if (Math.hypot(p.x - pos[j].x, p.y - pos[j].y) < 0.1) problemer.push(n + ': to ting staar oven i hinanden');
      });
    }
    if (o.type === 'se') {
      if (!(o.max >= 2 && o.max <= 10)) problemer.push(n + ': max ' + o.max);
      if (!o.runder.length) problemer.push(n + ': ingen runder');
      f.runder.forEach(r => {
        if (!(r.antal >= 1 && r.antal <= o.max && r.antal % 1 === 0)) problemer.push(n + ': antal ' + r.antal + ' ligger ikke paa talraekken 1..' + o.max);
        if (!O.tingFindes(r.ting)) problemer.push(n + ': tingen ' + r.ting + ' kendes ikke');
        if (r.moenster.pos.length !== r.antal) problemer.push(n + ': moensteret har ' + r.moenster.pos.length + ' ting');
        if ((r.antal <= 6) !== (r.moenster.navn === 'terning')) problemer.push(n + ': ' + r.antal + ' vises ikke som terning til seks og femmerstruktur over');
        r.moenster.pos.forEach((p, i) => r.moenster.pos.forEach((q, j) => { if (i < j && Math.hypot(p.x - q.x, p.y - q.y) < 0.74) problemer.push(n + ': to ting roerer hinanden'); }));
      });
    }
    if (o.type === 'flest') f.runder.forEach(r => {
      if (!(r.venstre >= 1 && r.hoejre >= 1 && r.venstre <= 10 && r.hoejre <= 10) || r.venstre === r.hoejre) problemer.push(n + ': ' + r.venstre + ' mod ' + r.hoejre);
      if (!O.tingFindes(r.ting)) problemer.push(n + ': tingen ' + r.ting + ' kendes ikke');
      if (r.bunker.venstre.length !== r.venstre || r.bunker.hoejre.length !== r.hoejre) problemer.push(n + ': bunkerne passer ikke');
    });
    if (o.type === 'venner') {
      if (!(f.venner.length >= 1 && f.venner.length <= 24)) problemer.push(n + ': ' + f.venner.length + ' venner');
      f.venner.forEach(v => { if (!O.FIGURER[v] || !findes(O.FIGURER[v])) problemer.push(n + ': ' + v + ' har intet billede'); });
    }
    if (o.type === 'puslespil' && !(f.loese.length >= 1 && f.loese.every(x => x >= 1 && x <= 24))) problemer.push(n + ': loese brikker ' + f.loese);
    if (['tael', 'se', 'flest', 'pynt', 'venner', 'puslespil'].indexOf(o.type) >= 0 && !f.spoerg) problemer.push(n + ': intet spoergsmaal');
  });
  tjek('hver opgave er gyldig (forlyd, rim, stavelser, bogstav, tal, ting, venner)', problemer.length === 0, problemer.slice(0, 4).join(' | '));
  tjek('alle ti slags opgaver er med i kalenderen', TYPER.every(t => K.DAGE.some(d => d.opgave.type === t)), TYPER.filter(t => !K.DAGE.some(d => d.opgave.type === t)).join());

  const ord = O.ordene(K), info = ord.map(o => O.ord(o));
  tjek('alle ord i forlyd, rim og klap findes i Bogstavvejen eller Rimhulen', info.every(Boolean), ord.filter((o, i) => !info[i]).join());
  const udenBillede = info.filter(i => i && !(i.billede && findes(i.billede)));
  tjek('alle ord har et billede paa disken', udenBillede.length === 0, udenBillede.map(i => i.ord).join());
  const udenKlip = info.filter(i => i && !findes(i.klip));
  tjek('alle ord har et ordklip ("Her har du ordet kat.") paa disken', udenKlip.length === 0, udenKlip.map(i => i.ord).join());
  const laant = info.filter(Boolean).reduce((a, i) => a.concat([i.billede, i.klip]), [])
    .concat(Object.values(O.FIGURER).filter(Boolean))
    .concat(Object.values(O.TING).map(t => t.billede).filter(Boolean))
    .concat(['games/bogstaver/js/glyffer.js', 'games/bogstaver/js/spor.js', 'games/bogstaver/js/ting.js', 'games/rim/js/rim.js']);
  const ikkeIFiler = [...new Set(laant)].filter(f => FILER.indexOf(f) < 0 || !findes(f));
  tjek('alt, julekalenderen laaner fra spillene, findes og er i FILER', ikkeIFiler.length === 0, ikkeIFiler.join());
}

/* Brikkerne i billederne */
{
  const ude = K.DAGE.filter(d => !(d.brik.x >= 0.06 && d.brik.x <= 0.94 && d.brik.y >= 0.08 && d.brik.y <= 0.92));
  tjek('hver dags brik ligger inde i det tredje billede', ude.length === 0, ude.map(d => d.dag + ': ' + d.brik.x + ',' + d.brik.y).join());
}

/* Puslespillet */
{
  const B = P.BRIKKER;
  tjek('puslespillet har 24 brikker, én pr. dag', B.length === 24 && B.every((b, i) => b.dag === i + 1));
  const celler = new Set(B.map(b => b.kol + ',' + b.raek));
  tjek('brikkerne fylder hver sin plads i 6 x 4', celler.size === 24 && B.every(b => b.kol >= 0 && b.kol < 6 && b.raek >= 0 && b.raek < 4));
  const kantfejl = [];
  B.forEach(b => {
    if ((b.raek === 0) !== (b.kanter.op === 0) || (b.raek === 3) !== (b.kanter.ned === 0) || (b.kol === 0) !== (b.kanter.venstre === 0) || (b.kol === 5) !== (b.kanter.hoejre === 0)) kantfejl.push(b.dag + ': kant');
    const h = P.paaPlads(b.kol + 1, b.raek), n = P.paaPlads(b.kol, b.raek + 1);
    if (h && h.kanter.venstre !== -b.kanter.hoejre) kantfejl.push(b.dag + ': tap mod hoejre');
    if (n && n.kanter.op !== -b.kanter.ned) kantfejl.push(b.dag + ': tap nedad');
  });
  tjek('yderkanterne er lige, og hver tap passer i sin nabos hak', kantfejl.length === 0, kantfejl.join());
  // Hvert punkt i motivet ligger i praecis én brik (tappene og hakkene passer sammen)
  const b = 120, h = 135, poly = B.map(br => P.polygon(br, b, h, 16).map(q => [q[0] + br.kol * b, q[1] + br.raek * h]));
  let daekket = 0, dobbelt = 0, tomme = 0, alle = 0;
  for (let x = 1.37; x < 6 * b; x += 7.31) for (let y = 1.61; y < 4 * h; y += 7.19) {
    alle++;
    const i = poly.filter(p => P.inde(p, x, y)).length;
    if (i === 1) daekket++; else if (i > 1) dobbelt++; else tomme++;
  }
  tjek('de 24 brikker daekker hele motivet uden huller og uden overlap', daekket === alle, daekket + ' af ' + alle + ' punkter, ' + dobbelt + ' dobbelt, ' + tomme + ' tomme');
  const ud = poly.some(p => p.some(q => q[0] < -0.01 || q[1] < -0.01 || q[0] > 6 * b + 0.01 || q[1] > 4 * h + 0.01));
  tjek('ingen tap stikker ud over billedets kant', !ud);
  tjek('de to sidste brikker ligger oppe i hjoernet, som historien siger', P.brik(24).raek === 0 && P.brik(24).kol === 5 && P.brik(23).raek === 0);
  tjek('i kalenderen ligger alle tidligere dages brikker, og dagens, naar den er fundet', P.lagt(5, false).join() === '1,2,3,4' && P.lagt(5, true).join() === '1,2,3,4,5');
  // Laeggelegen: en robot traekker de loese brikker paa plads, men slipper dem foerst forkert
  const spil = P.nytSpil([22, 23, 24], [[6.35, 1.4], [-1.35, 1.4], [6.35, 2.8]]);
  let robotOk = !spil.faerdig && spil.brikker.filter(x => !x.paa).length === 3;
  spil.brikker.filter(x => !x.paa).forEach((br, i) => {
    const id = 10 + i;
    robotOk = robotOk && P.tag(spil, br.x + 0.5, br.y + 0.5, id) === br;
    P.flyt(spil, br.kol + 2.5, br.raek + 0.5, id);
    robotOk = robotOk && !P.slip(spil, id) && !br.paa;
    P.tag(spil, br.x + 0.5, br.y + 0.5, id);
    P.flyt(spil, br.kol + 0.5 + 0.2, br.raek + 0.5 - 0.15, id);
    robotOk = robotOk && P.slip(spil, id) && br.paa && br.x === br.kol;
  });
  tjek('dag 24: de loese brikker kan traekkes paa plads, og puslespillet bliver helt', robotOk && spil.faerdig);
}

/* Det, der siges */
const SAETNINGER = O.saetninger(K);
const HISTORIER = K.replikker();
{
  const anf = /["“”„«»‘’]/;
  const med = HISTORIER.concat(SAETNINGER).concat(K.DAGE.map(d => d.opgave.spoerg || '')).filter(t => anf.test(t));
  tjek('ingen replik indeholder anfoerselstegn', med.length === 0, med.slice(0, 3).join(' | '));
  const dele = [...new Set(HISTORIER.reduce((a, t) => a.concat(Stemme.saetninger(t)), []).concat(SAETNINGER))];
  const ikkeHele = dele.filter(s => !/[.!?]$/.test(s));
  tjek('alt, der siges, er hele saetninger (med punktum, spoergsmaals- eller udraabstegn til sidst)', ikkeHele.length === 0, ikkeHele.slice(0, 3).join(' | '));
  // Ikke en fejl, men vaerd at vide: "Bjørn og ... en stor fugl" deles ved "..." i to klip, og det andet starter med lille bogstav
  const smaat = dele.filter(s => !/^(– )?[A-ZÆØÅÉ]/.test(s));
  if (smaat.length) console.log('  OBS   ' + smaat.length + ' saetninger starter med lille bogstav, fordi stemmen deler ved "..." (fx: ' + smaat.slice(0, 2).join(' | ') + ')');
  tjek('opgaverne kan taelle fra En. til Fireogtyve.', ['En.', 'To.', 'Fem.', 'Tolv.', 'Fireogtyve.'].every(t => SAETNINGER.indexOf(t) >= 0));
  tjek('opgaverne siger brik og puslespil, aldrig stykke', SAETNINGER.every(t => !/stykke/i.test(t)) && /brik/.test(O.TEKST.brikLagt) && /puslespil/.test(O.TEKST.brikLagt));
  // Alt, skaermen kan sige i opgaverne, er bygget af hele saetninger fra Opgaver.saetninger()
  const kendt = {}; SAETNINGER.forEach(t => { kendt[t] = 'x'; });
  const siges = [];
  Object.keys(O.TEKST).forEach(k => siges.push(O.TEKST[k]));
  for (let n = 1; n <= 24; n++) siges.push(O.tal(n));
  K.DAGE.forEach(d => {
    const f = O.forbered(d);
    [f.spoerg, f.slut, f.igen, f.rigtigTekst, f.fejring].forEach(t => { if (t) siges.push(t); });
    (f.runder || []).forEach(r => { if (r.svar) siges.push(r.svar); });
    if (f.type === 'se') { const s = O.saetningerAf(f.spoerg); siges.push(s[0], s.slice(1).join(' ')); }
  });
  const uden = siges.filter(t => t && !Stemme.del(t, kendt));
  tjek('alt, opgaverne siger, er hele saetninger fra Opgaver.saetninger()', uden.length === 0, uden.slice(0, 3).join(' | '));
}

/* Siden og service workeren */
{
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const kode = ['game.js', 'lege.js', 'maleri.js', 'opgaver.js', 'puslespil.js'].map(f => fs.readFileSync(path.join(MAPPE, 'js', f), 'utf8')).join('\n');
  const game = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  tjek('navnet staar de tre steder: <title>, overskriften og forsiden',
    html.includes('<title>Pelles julekalender</title>') && html.includes('<h2>Pelles julekalender</h2>') && games.includes("navn: 'Pelles julekalender'") && K.TITEL === 'Pelles julekalender');
  tjek('forsiden har kortet lige efter bogen, kun i november og december', /id: 'bog'[\s\S]*?\},\s*\{[^{]*?id: 'jul'/.test(games) && games.includes("sti: 'jul/'") && /maaneder: \[10, 11\]/.test(games));
  tjek('siden henter skallen, menuen, stemmen og Bogstavvejens og Rimhulens kode',
    ['../js/skal.js', '../js/menu.js', '../js/stemme.js', '../games/bogstaver/js/glyffer.js', '../games/bogstaver/js/spor.js', '../games/rim/js/rim.js', 'js/kalender.js', 'js/opgaver.js', 'js/game.js'].every(s => html.includes(s)));
  tjek('hjem-knappen foerer én mappe op, og pilen kender kalenderen', /hjem\.href = '\.\.\/'/.test(game) && /Skal\.menuKnap\(/.test(game));
  tjek('stemmen er js/stemme.js med lyd/klip.json', /Stemme\.ny\(\{ mappe: 'lyd\/'/.test(game));
  tjek('trykket er pointerdown, ikke click, saa to boern kan trykke samtidig', /scene\.addEventListener\('pointerdown'/.test(game) && /kal\.addEventListener\('pointerdown'/.test(game) && !/(scene|kal)\.addEventListener\('click'/.test(game));
  tjek('ingen browser-storage og ingen netvaerk', !/localStorage|sessionStorage|indexedDB|https?:\/\//.test(kode));
  tjek('roundRect har sin polyfill til gamle iPads', /prototype\.roundRect\s*=/.test(kode));
  const skal = ['jul/', 'jul/index.html', 'jul/js/kalender.js', 'jul/js/puslespil.js', 'jul/js/opgaver.js', 'jul/js/maleri.js', 'jul/js/lege.js', 'jul/js/game.js', 'jul/lyd/klip.json'];
  tjek('julekalenderens kode er med i FILER', skal.every(f => FILER.indexOf(f) >= 0), skal.filter(f => FILER.indexOf(f) < 0).join());
  tjek('billeder og lyd ligger kun i FILER_JUL, ikke i FILER', !FILER.some(f => /^jul\/(billeder\/|lyd\/.+\.mp3$)/.test(f)) && FILER_JUL.every(f => /^jul\/(billeder\/|lyd\/.+\.mp3$)/.test(f)));
  tjek('service workeren har sin egen cache til julen, der ikke skifter med VERSION', /const JUL = 'sfo-jul'/.test(SW) && /n !== VERSION && n !== JUL/.test(SW));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROD, 'package.json'), 'utf8'));
  tjek('testen er med i npm test', pkg.scripts.test.includes('test/jul.test.js'));
  tjek('lydvaerktoejet kender julekalenderen', /SAETNINGSSPIL = \([^)]*'jul'/.test(fs.readFileSync(path.join(ROD, 'vaerktoej', 'lav-lyd-gemini.py'), 'utf8')));
}

/* Billederne og stemmen: fejler, indtil de er lavet */
{
  const billeder = K.DAGE.reduce((a, d) => a.concat(d.afsnit.map(x => 'jul/' + x.billede)), []).concat(['jul/billeder/kalender.jpg', 'jul/billeder/puslespil.jpg']);
  const mangler = billeder.filter(b => !findes(b) || FILER_JUL.indexOf(b) < 0);
  tjek('alle billeder findes paa disken og i FILER_JUL', mangler.length === 0, mangler.length + ' af ' + billeder.length + ' mangler, fx ' + mangler.slice(0, 2).join(', '));
  let klip = {};
  try { klip = JSON.parse(fs.readFileSync(path.join(MAPPE, 'lyd', 'klip.json'), 'utf8')); } catch (e) { /* tom */ }
  const alt = HISTORIER.concat(SAETNINGER);
  const ikkeIndtalt = alt.filter(t => !Stemme.del(t, klip));
  const filer = Object.values(klip), udenFil = filer.filter(f => !fs.existsSync(path.join(MAPPE, 'lyd', f)) || FILER_JUL.indexOf('jul/lyd/' + f) < 0);
  tjek('alt, der siges (historierne og Opgaver.saetninger), er indtalt, findes paa disken og i FILER_JUL', ikkeIndtalt.length === 0 && udenFil.length === 0,
    ikkeIndtalt.length + ' af ' + alt.length + ' replikker mangler klip' + (udenFil.length ? ', ' + udenFil.length + ' filer mangler' : '') + (ikkeIndtalt.length ? ', fx: ' + ikkeIndtalt[0].slice(0, 60) : ''));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
