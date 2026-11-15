/**
 * Test af Isvigen — koeres med `npm test`. Kraever ingen browser.
 *
 * En robot spiller isflagerne og flaskeposten paa alle tre stjerner og
 * tjekker hvert spoergsmaal: at der er tre forskellige valg med praecis ét
 * rigtigt, at Helles brum er ordets lyde i raekkefoelge, at hvert ord har et
 * billede og et ordklip, at sedlerne kun bruger ord, der kan lyderes eller
 * siges, og at hver "goer"-seddel kan loeses med de ting og maal, der er. Til
 * sidst: at alt, der siges, er hele saetninger, og siden og filerne.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'games', 'hvalros');
const { Helle: H } = require(path.join(MAPPE, 'js', 'helle.js'));
const { Stemme } = require(path.join(ROD, 'js', 'stemme.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nIsvigen\n');

const ALLE = H.ORD.kort.concat(H.ORD.mellem, H.ORD.lang);

/* Ordene: billede, klip, form og lyde */
{
  const udenBillede = ALLE.filter(o => { const t = H.ting(o); return !t || !t.billede || !fs.existsSync(path.join(MAPPE, t.billede)); });
  tjek('alle ' + ALLE.length + ' ord har et malet billede fra Bogstavvejen', udenBillede.length === 0, udenBillede.join());
  const udenKlip = ALLE.filter(o => { const t = H.ting(o); return !t || !t.klip || !fs.existsSync(path.join(MAPPE, t.klip)); });
  tjek('alle ord har et ordklip ("Her har du ordet ...")', udenKlip.length === 0, udenKlip.join());
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const udenforCache = ALLE.map(o => H.ting(o)).flatMap(t => [t.billede, t.klip]).map(f => f.replace(/^\.\.\//, 'games/')).filter(f => !sw.includes("'" + f + "'"));
  tjek('billederne og ordklippene er med i FILER', udenforCache.length === 0, udenforCache.slice(0, 3).join());
  tjek('alle ord har en form (en/et og bestemt)', ALLE.every(o => H.FORM[o] && /^(en|et)$/.test(H.FORM[o][0]) && H.FORM[o][1].indexOf(o) === 0));
  const udenLyd = ALLE.filter(o => !Array.from(o).every(b => H.LYD[b]));
  tjek('hvert bogstav i ordene har en lyd', udenLyd.length === 0, udenLyd.join());
  // De lange er svaere at lydere: fire bogstaver eller to medlyde i starten (frø, sky)
  const vokal = b => 'aeiouyæøå'.includes(b);
  tjek('de korte ord har to bogstaver, de mellemste tre, de lange fire eller to medlyde foerst',
    H.ORD.kort.every(o => o.length === 2) && H.ORD.mellem.every(o => o.length === 3) &&
    H.ORD.lang.every(o => o.length === 4 || (!vokal(o[0]) && !vokal(o[1]))));
  tjek('ingen ord staar to gange', new Set(ALLE).size === ALLE.length);
  tjek('brum er lydene i raekkefoelge: "Sss, ooo, lll."', H.brum('sol') === 'Sss, ooo, lll.' && H.lyde('is').length === 2);
}

/* Robotten spiller isflagerne */
{
  const problemer = [], sete = [new Set(), new Set(), new Set()];
  for (let s = 0; s < 3; s++) for (let r = 0; r < 200; r++) {
    const flager = H.isflager(s), navn = (s + 1) + '*';
    if (flager.length !== H.ISFLAGER) problemer.push(navn + ': ' + flager.length + ' isflager');
    if (new Set(flager.map(q => q.ord)).size !== flager.length) problemer.push(navn + ': samme ord to gange');
    flager.forEach(q => {
      sete[s].add(q.ord);
      if (q.valg.length !== 3 || new Set(q.valg).size !== 3) problemer.push(navn + ': ikke tre forskellige valg ' + q.valg);
      if (q.valg.filter(v => v === q.ord).length !== 1) problemer.push(navn + ': ikke ét rigtigt valg');
      if (H.FLAGEORD[s].indexOf(q.ord) < 0) problemer.push(navn + ': ' + q.ord + ' hoerer ikke til stjernen');
      if (q.brum !== H.brum(q.ord)) problemer.push(navn + ': brum passer ikke til ' + q.ord);
      // Et forkert valg maa ikke begynde med samme lyd, saa man skal lytte efter det foerste, naar det kan lade sig goere
      if (q.valg.some(v => v !== q.ord && v.charAt(0) === q.ord.charAt(0))) problemer.push(navn + ': ' + q.valg + ' har to med samme forlyd');
      if (q.visBogstaver !== (s >= 1) || q.laesSelv !== (s === 2)) problemer.push(navn + ': bogstaverne vises forkert');
    });
  }
  tjek('fem isflager pr. omgang, tre forskellige valg og ét rigtigt, forskellig forlyd', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('alle ord i stjernens pulje kommer frem', [0, 1, 2].every(s => sete[s].size === H.FLAGEORD[s].length));
  tjek('én stjerne har de korte ord, tre stjerner de lange',
    H.ORD.kort.every(o => H.FLAGEORD[0].includes(o)) && H.ORD.lang.every(o => H.FLAGEORD[2].includes(o) && !H.FLAGEORD[0].includes(o)));
}

/* Robotten laeser flaskeposten */
{
  const problemer = [], typer = [new Set(), new Set(), new Set()], maal = new Set();
  for (let s = 0; s < 3; s++) for (let r = 0; r < 200; r++) {
    const sedler = H.sedler(s), navn = (s + 1) + '*';
    if (sedler.length !== H.SEDLER) problemer.push(navn + ': ' + sedler.length + ' sedler');
    if (new Set(sedler.map(x => x.ord)).size !== sedler.length) problemer.push(navn + ': samme ting to gange');
    sedler.forEach(x => {
      typer[s].add(x.type);
      if (x.ordene.join(' ') + (x.type === 'ord' ? '' : '.') !== x.tekst) problemer.push(navn + ': ordene passer ikke til teksten ' + x.tekst);
      const ukendte = x.ordene.filter(o => !H.sedlernesOrd().includes(o) && !H.sedlernesOrd().includes(o.toLowerCase()));
      if (ukendte.length) problemer.push(navn + ': ukendt ord paa sedlen ' + ukendte);
      if (x.type === 'goer') {
        maal.add(x.maal);
        if (x.ting.length !== 3 || x.ting.filter(t => t === x.ord).length !== 1) problemer.push(navn + ': tingene ' + x.ting);
        if (!H.svar(x, { ting: x.ord, maal: x.maal })) problemer.push(navn + ': det rigtige svar godtages ikke');
        const forkert = ['helle', 'pelle', 'isflage'].filter(m => m !== x.maal);
        if (forkert.some(m => H.svar(x, { ting: x.ord, maal: m }))) problemer.push(navn + ': rigtig ting til forkert maal godtages');
        if (x.ting.some(t => t !== x.ord && H.svar(x, { ting: t, maal: x.maal }))) problemer.push(navn + ': forkert ting godtages');
        if (H.GIVE.indexOf(x.ord) < 0) problemer.push(navn + ': ' + x.ord + ' kan ikke gives');
      } else {
        if (x.valg.length !== 3 || new Set(x.valg).size !== 3 || x.valg.filter(v => v === x.ord).length !== 1) problemer.push(navn + ': valgene ' + x.valg);
        if (!H.svar(x, x.ord) || x.valg.some(v => v !== x.ord && H.svar(x, v))) problemer.push(navn + ': svaret ' + x.ord);
      }
    });
  }
  tjek('tre sedler pr. omgang, og hver kan loeses med det, der er', problemer.length === 0, problemer.slice(0, 3).join(' | '));
  tjek('én stjerne er ét ord, to en saetning, tre en ting at goere',
    typer[0].size === 1 && typer[0].has('ord') && typer[1].size === 1 && typer[1].has('saetning') && typer[2].size === 1 && typer[2].has('goer'));
  tjek('alle tre maal bruges (Helle, Pelle og isflagen)', maal.size === 3);
  tjek('kun lydrette ord lyderes ("det" og "er" siges bare)', H.kanLyderes('sol') && H.kanLyderes('en') && H.kanLyderes('på') && !H.kanLyderes('Det') && !H.kanLyderes('er') && !H.kanLyderes('osten'));
}

/* Stemmen */
{
  const alle = H.saetninger();
  tjek('saetningerne er hele saetninger med tegn til sidst og uden dubletter',
    alle.every(t => /[.!?]$/.test(t) && Stemme.saetninger(t).length === 1) && new Set(alle).size === alle.length);
  // Alt, spillet kan sige, kan deles i saetninger fra Helle.saetninger()
  const replikker = [];
  Object.keys(H.TEKST).forEach(k => replikker.push(H.TEKST[k]));
  Object.keys(H.LYD).forEach(b => replikker.push(H.stort(H.LYD[b]) + '.'));
  for (let s = 0; s < 3; s++) for (let r = 0; r < 60; r++) {
    H.isflager(s).forEach(q => replikker.push(q.brum, H.TEKST.igen + ' ' + q.brum));
    H.sedler(s).forEach(x => {
      x.ordene.forEach(o => { const lo = H.lydOrd(o.replace(/[.,]/g, '')); if (H.kanLyderes(lo)) replikker.push(H.brum(lo)); replikker.push(H.ordet(lo)); });
      if (x.type !== 'ord') replikker.push(x.tekst);
    });
  }
  const kendt = {}; alle.forEach(t => { kendt[t] = 'x'; });
  const udenFor = [...new Set(replikker)].filter(t => !Stemme.del(t, kendt));
  tjek('alle replikker er bygget af saetninger fra Helle.saetninger()', udenFor.length === 0, udenFor.slice(0, 3).join(' | '));
  const klip = JSON.parse(fs.readFileSync(path.join(MAPPE, 'lyd', 'klip.json'), 'utf8'));
  const filer = Object.values(klip), sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('alle klip findes og er med i FILER', filer.every(f => fs.existsSync(path.join(MAPPE, 'lyd', f)) && sw.includes("'games/hvalros/lyd/" + f + "'")));
  const mangler = alle.filter(t => !klip[t]);
  // Stemmen er ikke indtalt endnu (kreditten gaar foerst til julekalenderen). Indtil da siger enhedens
  // egen stemme det hele. Saa snart der er ét klip, skal alt vaere indtalt.
  if (filer.length === 0) console.log('  info  ' + alle.length + ' saetninger venter paa at blive indtalt (vaerktoej/lav-lyd-gemini.py --spil hvalros)');
  else tjek('alt, spillet kan sige, er indtalt', mangler.length === 0, mangler.length + ' mangler, fx: ' + mangler.slice(0, 2).join(' | '));
}

/* Siden, billederne og service workeren */
{
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const game = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const logik = fs.readFileSync(path.join(MAPPE, 'js', 'helle.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  tjek('navnet staar de tre steder: <title>, menuen og forsiden',
    html.includes('<title>Isvigen</title>') && game.includes('<h2>Isvigen</h2>') && games.includes("navn: 'Isvigen'"));
  tjek('siden henter skallen, menuen, stemmen, Bogstavvejens ting og logikken',
    ['../../js/skal.js', '../../js/menu.js', '../../js/stemme.js', '../bogstaver/js/ting.js', '../rim/js/rim.js', 'js/helle.js', 'js/game.js'].every(s => html.includes(s)));
  tjek('trykket er pointerdown, ikke click, saa to boern kan trykke samtidig', /laerred\.addEventListener\('pointerdown'/.test(game) && !/laerred\.addEventListener\('click'/.test(game));
  tjek('pilen i hjoernet kender menuen', /Skal\.menuKnap\(visMenu\)/.test(game));
  tjek('ingen browser-storage og ingen netvaerk', !/localStorage|sessionStorage|indexedDB|https?:\/\//.test(game + logik));
  tjek('spillet gaar ikke i staa uden lyd: en vagt sender det videre', /var vagt = setTimeout\(videre/.test(game));
  const laant = ['games/maskinen/billeder/pindsvin.png', 'games/bogstaver/js/ting.js', 'games/rim/js/rim.js'];
  tjek('Pelle og ordlisten er laant, findes og er i FILER', laant.every(f => fs.existsSync(path.join(ROD, f)) && sw.includes("'" + f + "'")));
  const helle = path.join(MAPPE, 'billeder', 'helle.png');
  tjek('Helles billede er med i FILER, hvis det er malet', !fs.existsSync(helle) || sw.includes("'games/hvalros/billeder/helle.png'"));
  if (!fs.existsSync(helle)) console.log('  info  Helle er tegnet i kode, til billeder/helle.png er malet (se billeder/PROMPT.md)');
  const skal = ['games/hvalros/', 'games/hvalros/index.html', 'games/hvalros/js/helle.js', 'games/hvalros/js/game.js', 'games/hvalros/lyd/klip.json'];
  tjek('spillets filer er med i FILER', skal.every(f => sw.includes("'" + f + "'")), skal.filter(f => !sw.includes("'" + f + "'")).join());
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
