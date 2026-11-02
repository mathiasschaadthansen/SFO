/**
 * Test af opgavearkene til Pelles julekalender (vaerktoej/jul-ark/) — koeres med
 * `npm test`. Kraever ingen browser.
 *
 * Tjekker, at der er 24 dage med ét eller to ark hver, at emnerne foelger
 * ugerne, at tal, svar og facit er rigtige (ogsaa regnestykkerne), at rimene
 * rimer ifoelge Rim.RIM, at stavelserne stemmer med Rim.STAVELSER, at
 * bogstaverne findes i Bogstavvejens streger med baade store og smaa, og at
 * alle billeder, der bruges, findes. Arkene er ikke en del af appen: de maa
 * ikke staa i sw.js, og PDF'en maa ikke ligge i repoet.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const { JulArk: A } = require(path.join(ROD, 'vaerktoej', 'jul-ark', 'ark.js'));
const { Tegn: T } = require(path.join(ROD, 'vaerktoej', 'jul-ark', 'tegn.js'));
const { Rim } = require(path.join(ROD, 'games', 'rim', 'js', 'rim.js'));
const { Glyffer } = require(path.join(ROD, 'games', 'bogstaver', 'js', 'glyffer.js'));
const { Kalender: K } = require(path.join(ROD, 'jul', 'js', 'kalender.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}
const findes = rel => fs.existsSync(path.join(ROD, rel));
const alle = [];      // [dag, ark, opgave]
A.DAGE.forEach(d => d.ark.forEach(a => a.opgaver.forEach(o => alle.push([d, a, o]))));
const af = type => alle.filter(x => x[2].type === type);
const navn = x => 'dag ' + x[0].dag + ' ' + x[2].type;
const rimer = (a, b) => Rim.GRUPPE[a] !== undefined && Rim.GRUPPE[a] === Rim.GRUPPE[b];
const lige = (a, b) => JSON.stringify(a) === JSON.stringify(b);

console.log('\nPelles julekalender: opgaveark\n');

/* Dagene og arkene */
{
  const D = A.DAGE;
  tjek('der er 24 dage, 1..24 i orden', D.length === 24 && D.every((d, i) => d.dag === i + 1));
  tjek('hver dag har ét eller to ark', D.every(d => d.ark.length >= 1 && d.ark.length <= 2), D.filter(d => !(d.ark.length >= 1 && d.ark.length <= 2)).map(d => d.dag).join());
  const emne = n => n <= 7 ? 'tal' : n <= 14 ? 'bogstaver' : n <= 21 ? 'rim' : 'faellesskab';
  tjek('emnerne foelger ugerne: 1-7 tal, 8-14 bogstaver, 15-21 rim, 22-24 faellesskab', D.every(d => d.emne === emne(d.dag) && A.ugeFor(d.dag).emne === d.emne),
    D.filter(d => d.emne !== emne(d.dag)).map(d => d.dag).join());
  tjek('titlerne og stederne er historiens (jul/js/kalender.js)', D.every((d, i) => K.DAGE[i] && K.DAGE[i].titel === d.titel && K.DAGE[i].sted === d.sted),
    D.filter((d, i) => !K.DAGE[i] || K.DAGE[i].titel !== d.titel || K.DAGE[i].sted !== d.sted).map(d => d.dag).join());
  const arkFejl = A.alleArk().filter(x => !(x.ark.navn && x.ark.laerer && x.ark.laerer.length > 40 && /Øver|Sig|Kalender/.test(x.ark.laerer) && x.ark.opgaver.length >= 1 && x.ark.opgaver.length <= 3));
  tjek('hvert ark har et navn, 1-3 opgaver og en linje til laereren om, hvad det oever, og hvad man kan sige', arkFejl.length === 0, arkFejl.map(x => x.dag.dag).join());
  const dagsark = D.filter(d => d.dag <= 21).every(d => d.ark.reduce((s, a) => s + a.opgaver.length, 0) >= 2);
  tjek('dag 1-21 har mindst to opgaver', dagsark);
}

/* Opgaverne: piktogram, tekst og en tegner */
{
  const TYPER = ['taelTrae', 'taelSkriv', 'forbindTal', 'tegnSaa', 'regne', 'farvSaa', 'flest', 'ligeMange', 'tierramme', 'talraekke', 'prikTilPrik', 'urTegn', 'urRing',
    'sporBogstav', 'skriveLinjer', 'forlydRing', 'skjult', 'forbindBogstav', 'rimForbind', 'rimRing', 'rimKryds', 'klapStreg', 'langstOrd', 'sorter',
    'guirlande', 'egenGuirlande', 'invitation', 'samtale', 'tegnRamme', 'tegnSelv', 'puslespilMotiv', 'kalenderArk'];
  const SIDER = fs.readFileSync(path.join(ROD, 'vaerktoej', 'jul-ark', 'sider.js'), 'utf8');
  const ukendt = alle.filter(x => TYPER.indexOf(x[2].type) < 0 || SIDER.indexOf('    ' + x[2].type + ': function') < 0);
  tjek('hver opgavetype har en tegner i sider.js', ukendt.length === 0, ukendt.map(navn).join());
  const ikon = alle.filter(x => !T.IKON[x[2].ikon] || !x[2].tekst);
  tjek('hver opgave har et piktogram (blyant, farve, saks, forbind, ring, kryds, klap, tale) og en tekst til den voksne', ikon.length === 0, ikon.map(navn).join());
  const ting = [];
  alle.forEach(x => { const o = x[2]; if (o.ting) [].concat(o.ting).forEach(t => ting.push(t)); (o.raekker || []).concat(o.stykker || []).forEach(r => { if (r.ting) [].concat(r.ting).forEach(t => ting.push(t)); }); });
  const mangler = ting.filter(t => typeof T.TING[t] !== 'function' || !/<(path|circle|ellipse|rect)/.test(T.TING[t](10, 10, 10)));
  tjek('alle ting, der taelles og tegnes, tegnes i kode (Tegn.TING)', mangler.length === 0, mangler.join());
  // Stigende svaerhed i taluge: tal til fem og prikkede tal at skrive efter foerst, tal til ti fra dag 5, minus og uret til sidst
  const tal = d => { const ud = []; JSON.stringify(d.ark).replace(/"(antal|facit|a|b|venstre|hoejre)":(\d+)/g, (m, k, v) => ud.push(+v)); JSON.stringify(d.ark).replace(/"raekke":\[([^\]]*)\]/g, (m, l) => l.split(',').forEach(v => { if (v !== 'null') ud.push(+v); })); return Math.max.apply(null, ud); };
  const maks = A.DAGE.slice(0, 7).map(tal);
  const prikket = A.DAGE.slice(0, 7).map(d => JSON.stringify(d.ark).indexOf('"prikket":true') >= 0);
  const minus = A.DAGE.slice(0, 7).map(d => JSON.stringify(d.ark).indexOf('"op":"-"') >= 0);
  tjek('talugen bliver svaerere: tal til 5 de foerste dage, til 10 fra dag 5, prikkede tal kun dag 1, minus foerst dag 7',
    maks[0] <= 5 && maks[1] <= 5 && maks.slice(4).every(v => v >= 7) && maks.slice(4).some(v => v >= 10) && prikket.join() === 'true,false,false,false,false,false,false' && minus.indexOf(true) === 6,
    maks.join() + ' / ' + prikket.join() + ' / ' + minus.join());
}

/* Tal og facit */
{
  const t = [];
  af('taelTrae').forEach(x => t.push([navn(x), x[2].facit === x[2].antal && x[2].antal <= 10]));
  af('taelSkriv').forEach(x => x[2].raekker.forEach(r => t.push([navn(x), r.facit === r.antal && r.antal >= 1])));
  af('forbindTal').forEach(x => {
    const o = x[2];
    t.push([navn(x), lige(o.facit, o.maengder.map(m => m.antal)) && lige(o.tal.slice().sort(), o.facit.slice().sort()) && o.maengder.every(m => m.antal >= 1 && m.antal <= 6)]);
  });
  af('tegnSaa').forEach(x => x[2].felter.forEach(f => t.push([navn(x), f.facit === f.antal])));
  af('farvSaa').forEach(x => x[2].raekker.forEach(r => t.push([navn(x), r.facit === r.antal && r.antal < r.vist])));
  af('flest').forEach(x => x[2].runder.forEach(r => {
    const flest = r.venstre > r.hoejre ? 'venstre' : 'hoejre', faerrest = r.venstre < r.hoejre ? 'venstre' : 'hoejre';
    t.push([navn(x), r.venstre !== r.hoejre && r.facit === (x[2].hvad === 'flest' ? flest : faerrest)]);
  }));
  af('ligeMange').forEach(x => t.push([navn(x), x[2].facit === x[2].antal]));
  af('tierramme').forEach(x => x[2].raekker.forEach(r => t.push([navn(x), r.facit === r.antal && r.antal <= 10])));
  af('talraekke').forEach(x => {
    const r = x[2].raekke, udfyldt = r.map((v, i) => v === null ? r[0] + i : v);
    t.push([navn(x), udfyldt.every((v, i) => v === r[0] + i) && lige(r.map((v, i) => v === null ? r[0] + i : null).filter(v => v !== null), x[2].facit)]);
  });
  af('prikTilPrik').forEach(x => t.push([navn(x), x[2].punkter.length === x[2].antal]));
  af('urTegn').forEach(x => t.push([navn(x), x[2].facit === x[2].time]));
  af('urRing').forEach(x => t.push([navn(x), x[2].ure[x[2].facit] === x[2].time && x[2].ure.filter(u => u === x[2].time).length === 1]));
  const forkert = t.filter(r => !r[1]).map(r => r[0]);
  tjek('tal, svar og facit passer i taelle-, flest-, tierramme-, talraekke- og uropgaverne (' + t.length + ' tjek)', forkert.length === 0, forkert.join());
  const st = af('regne').reduce((l, x) => l.concat(x[2].stykker.map(s => [navn(x), s])), []);
  const regn = s => s.op === '+' ? s.a + s.b : s.op === '-' ? s.a - s.b : NaN;
  const galt = st.filter(r => regn(r[1]) !== r[1].facit);
  tjek('regnestykkerne giver det, facit siger (' + st.map(r => r[1].a + r[1].op + r[1].b + '=' + r[1].facit).join(', ') + ')', galt.length === 0, galt.map(r => r[0]).join());
  tjek('der er baade plus og minus', st.some(r => r[1].op === '+') && st.some(r => r[1].op === '-'));
  tjek('dag 7 har klokken syv paa et ur', A.DAGE[6].ark.some(a => a.opgaver.some(o => o.type === 'urTegn' && o.time === 7)));
}

/* Bogstaverne */
{
  const BOGSTAVER = ['S', 'J', 'N', 'K', 'G', 'E', 'P'];
  const uge = A.DAGE.filter(d => d.emne === 'bogstaver');
  tjek('ugens bogstaver er S, J, N, K, G, E og P som i historierne', lige(uge.map(d => d.bogstav), BOGSTAVER), uge.map(d => d.bogstav).join());
  const glyf = b => !!(Glyffer.GLYFFER[b] && Glyffer.GLYFFER[b].streger.length);
  tjek('hvert bogstav findes i Bogstavvejens streger, baade stort og lille', BOGSTAVER.every(b => glyf(b) && glyf(b.toLowerCase())));
  tjek('hver bogstavdag har dagens bogstav med prikker og pile og linjer at skrive paa', uge.every(d => {
    const o = [].concat(...d.ark.map(a => a.opgaver));
    return o.some(x => x.type === 'sporBogstav' && x.bogstav === d.bogstav) && o.some(x => x.type === 'skriveLinjer' && x.bogstav === d.bogstav && x.raekker.some(r => r.lille) && x.raekker.some(r => !r.lille));
  }));
  // Alle tegn, der skrives, kan skrives med grundskriftens streger
  const tegn = [];
  A.DAGE.forEach(d => { tegn.push(...Array.from(d.titel)); tegn.push(...String(d.dag)); });
  alle.forEach(x => {
    const o = x[2];
    if (o.ord && typeof o.ord === 'string') tegn.push(...Array.from(o.ord));
    if (o.andre) tegn.push(...o.andre);
    if (o.bogstaver) tegn.push(...o.bogstaver);
    if (o.tal) tegn.push(...o.tal.join(''));
    (o.raekke || []).forEach(v => { if (v !== null) tegn.push(...String(v)); });
  });
  const ukendte = [...new Set(tegn)].filter(c => c !== ' ' && !T.glyf(c));
  tjek('alle bogstaver og tal paa arkene findes i glyffer.js (ogsaa titlerne)', ukendte.length === 0, ukendte.join(' '));
  let tegnet = true;
  BOGSTAVER.forEach(b => [b, b.toLowerCase()].forEach(c => { const s = T.skrift(c, { x: 0, base: 50, h: 40, stil: 'spor', numre: true }); if (!/<circle/.test(s.svg) || !/<path/.test(s.svg)) tegnet = false; }));
  tjek('bogstaverne tegnes prikket med startprik og pile', tegnet);

  const forlyd = af('forlydRing');
  const forlydFejl = forlyd.filter(x => {
    const o = x[2], l = o.lyd.toLowerCase(), starter = o.billeder.filter(w => w.charAt(0) === l);
    return !lige(starter, o.facit) || o.facit.length < 3 || o.billeder.length - o.facit.length < 3;
  });
  tjek('ring om lyden: facit er praecis de ord, der starter med lyden, og der er mindst tre af hver', forlydFejl.length === 0, forlydFejl.map(navn).join());
  // Ord, hvor bogstavet ikke er lyden: c (siges s eller k), og lyde, der ligner hinanden
  const LIGNER = { s: ['c'], k: ['c', 'g'], g: ['k'], e: ['æ', 'i'], p: ['b'], j: ['g', 'i'], n: ['m'] };
  const lumske = forlyd.filter(x => x[2].billeder.some(w => (LIGNER[x[2].lyd.toLowerCase()] || []).indexOf(w.charAt(0)) >= 0));
  tjek('ingen forkerte billeder, der starter med en lyd, der ligner (c ved S og K, g ved K, b ved P ...)', lumske.length === 0, lumske.map(navn).join());
  tjek('ring om lyden bliver svaerere: flere billeder hen over ugen', forlyd.map(x => x[2].billeder.length).every((v, i, l) => i === 0 || v >= l[i - 1]), forlyd.map(x => x[2].billeder.length).join());

  const skjult = af('skjult');
  const skjultFejl = skjult.filter(x => {
    const o = x[2], g = A.MOTIVER[o.motiv];
    if (!g || !g.every(r => r.length === g[0].length && /^[#.]+$/.test(r))) return true;
    const felter = g.join('');
    if (felter.indexOf('#') < 0 || felter.indexOf('.') < 0) return true;
    return o.andre.some(a => a.toUpperCase() === o.bogstav || !T.glyf(a));
  });
  tjek('skjulte billeder: motivet findes, er et rektangel, og de andre bogstaver er ikke dagens', skjultFejl.length === 0, skjultFejl.map(navn).join());
  const fb = af('forbindBogstav');
  tjek('forbind billede og bogstav: hvert ord starter med sit bogstav, og bogstaverne er de samme som parrene', fb.every(x => x[2].par.every(p => p[0].charAt(0).toUpperCase() === p[1]) &&
    lige(x[2].par.map(p => p[1]).sort(), x[2].bogstaver.slice().sort()) && x[2].par.every(p => BOGSTAVER.indexOf(p[1]) >= 0)));
}

/* Rim og stavelser */
{
  const t = [];
  af('rimForbind').forEach(x => {
    const o = x[2], f = o.facit;
    const ok = f.length === o.venstre.length && f.every(p => rimer(p[0], p[1]) && o.venstre.indexOf(p[0]) >= 0 && o.hoejre.indexOf(p[1]) >= 0) &&
      lige(f.map(p => p[1]).sort(), o.hoejre.slice().sort()) &&
      o.venstre.every(v => o.hoejre.filter(h => rimer(v, h)).length === 1) &&
      o.venstre.every((v, i) => o.hoejre[i] !== f.filter(p => p[0] === v)[0][1]);      // ikke lige overfor hinanden
    t.push([navn(x), ok]);
  });
  af('rimRing').forEach(x => x[2].raekker.forEach(r => t.push([navn(x), rimer(r.ord, r.facit) && r.kort.filter(k => rimer(r.ord, k)).length === 1 && r.kort.indexOf(r.facit) >= 0])));
  af('rimKryds').forEach(x => x[2].raekker.forEach(r => {
    const andre = r.kort.filter(k => k !== r.facit);
    t.push([navn(x), r.kort.indexOf(r.facit) >= 0 && andre.length >= 2 && andre.every(k => rimer(k, andre[0])) && !rimer(r.facit, andre[0])]);
  }));
  const forkert = t.filter(r => !r[1]).map(r => r[0]);
  tjek('rimene rimer ifoelge Rim.RIM, og ingen forkerte kort rimer (' + t.length + ' tjek)', forkert.length === 0, forkert.join());
  const rimpar = [].concat(...af('rimForbind').map(x => x[2].facit));
  const historien = { 15: ['bjørn', 'mus', 'sol'], 17: ['is', 'tog', 'ø'], 19: ['ko', 'bil', 'hund'], 21: ['fly', 'and', 'ur'] };
  tjek('rimene er historiernes rim (Bo, Egons sang, Klatternes sang, Rikkes rimetur)', Object.keys(historien).every(d => historien[d].every(w => rimpar.some(p => p[0] === w))));

  const s = [];
  af('klapStreg').forEach(x => x[2].ord.forEach((w, i) => s.push([navn(x) + ' ' + w, Rim.STAVELSER[w] === x[2].facit[i] && x[2].facit[i] <= (x[2].maade === 'prik' ? 4 : 6)])));
  af('langstOrd').forEach(x => x[2].raekker.forEach(r => {
    const n = r.kort.map(w => Rim.STAVELSER[w]), maks = Math.max.apply(null, n);
    s.push([navn(x), Rim.STAVELSER[r.facit] === maks && n.filter(v => v === maks).length === 1 && n.every(v => v > 0)]);
  }));
  af('sorter').forEach(x => {
    const o = x[2];
    const ok = o.ord.every(w => (o.facit[Rim.STAVELSER[w]] || []).indexOf(w) >= 0) && o.kolonner.every(k => o.facit[k].every(w => Rim.STAVELSER[w] === k)) &&
      [].concat(...o.kolonner.map(k => o.facit[k])).length === o.ord.length;
    s.push([navn(x), ok]);
  });
  const galt = s.filter(r => !r[1]).map(r => r[0]);
  tjek('stavelserne stemmer med Rim.STAVELSER (' + s.length + ' tjek)', galt.length === 0, galt.join());
}

/* Faellesskab */
{
  const g = af('guirlande');
  const gf = g.filter(x => x[2].raekker.some(r => {
    const naeste = []; for (let j = r.vist; j < r.vist + r.tomme; j++) naeste.push(r.ting[A.moensterIndeks(r.moenster, j)]);
    return !lige(naeste, r.facit) || new Set(r.moenster).size !== r.ting.length;
  }));
  tjek('guirlanden: facit fortsaetter moenstret', gf.length === 0, gf.map(navn).join());
  tjek('guirlanden har moenstrene AB, AAB og ABC', g.length && lige(g[0][2].raekker.map(r => r.moenster), ['AB', 'AAB', 'ABC']));
  const typer = af('invitation').length && af('samtale').length && af('tegnSelv').length && af('puslespilMotiv').length && af('kalenderArk').length;
  tjek('faellesskab: invitation, samtaleark, tegn dig selv, puslespillets motiv og kalender-ark', !!typer);
  const samtale = A.DAGE[21].ark.filter(a => a.opgaver.some(o => o.type === 'samtale'))[0];
  tjek('samtalearket har spoergsmaal til laereren, ogsaa om at blive glemt', !!samtale && samtale.spoergsmaal.length >= 3 && samtale.spoergsmaal.some(s => /glemt/.test(s)));
  tjek('dag 24 er puslespillet og kalender-arket', A.DAGE[23].ark.map(a => a.opgaver[0].type).join() === 'puslespilMotiv,kalenderArk');
}

/* Billederne */
{
  const ord = A.ordene();
  const utenBillede = ord.filter(w => !A.ordBillede(w));
  tjek('alle ord paa arkene har et billede i Bogstavvejen eller Rimhulen (' + ord.length + ' ord)', utenBillede.length === 0, utenBillede.join());
  const b = A.billeder();
  const mangler = b.filter(f => !findes(f));
  tjek('alle billeder, der bruges, findes paa disken (' + b.length + ' billeder)', mangler.length === 0, mangler.join());
  tjek('billederne er fra spillenes egne mapper', b.every(f => /^(games|bog|assets)\//.test(f)));
}

/* Ikke en del af appen */
{
  const SW = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('arkene og PDF\'en staar ikke i sw.js', SW.indexOf('jul-ark') < 0 && SW.indexOf('opgaveark') < 0);
  const gi = fs.readFileSync(path.join(ROD, '.gitignore'), 'utf8');
  tjek('PDF\'en staar i .gitignore', /pelles-julekalender-opgaveark\.pdf/.test(gi));
  const html = fs.readFileSync(path.join(ROD, 'vaerktoej', 'jul-ark', 'index.html'), 'utf8');
  const kode = html + ['ark.js', 'tegn.js', 'sider.js'].map(f => fs.readFileSync(path.join(ROD, 'vaerktoej', 'jul-ark', f), 'utf8')).join('');
  tjek('ingen netvaerkskald og ingen skrifter fra nettet', !/https?:\/\/(?!www\.w3\.org)/.test(kode) && !/@import|fonts\.googleapis/.test(kode));
  const pkg = JSON.parse(fs.readFileSync(path.join(ROD, 'package.json'), 'utf8'));
  tjek('testen koeres af npm test', /test\/jul-ark\.test\.js/.test(pkg.scripts.test));
  tjek('vaerktoejet findes', findes('vaerktoej/lav-jul-ark.js'));
}

console.log(fejl ? '\n' + fejl + ' fejl\n' : '\nAlt ok\n');
process.exit(fejl ? 1 : 0);
