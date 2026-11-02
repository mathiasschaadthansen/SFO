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

/* Opgaverne: hver dag er flere dele, let foerst og saa svaerere */
{
  const TYPER = ['tael', 'se', 'flest', 'regn', 'spor', 'forlyd', 'rim', 'klap', 'pynt', 'venner', 'puslespil'];
  const DELE = ['tael', 'regn', 'se', 'flest', 'spor', 'kort', 'klap', 'moenster', 'pynt', 'venner', 'sorter', 'puslespil'];
  const problemer = [];
  const lyd = w => w.charAt(0).toUpperCase();
  const talIOrd = (tekst, n) => new RegExp('(^|[^a-zæøå])(' + (n === 1 ? 'en|én|et' : O.TALORD[n]) + ')([^a-zæøå]|$)', 'i').test(tekst);
  // Begyndelser, hvor bogstav og lyd ikke passer for et barn: c (s eller k), hj/hv/gj (stumt h og g), q, w, x, z
  const UREN = /^(c|q|w|x|z|hj|hv|gj)/i;
  const G = Glyffer.GLYFFER;
  const drej = s => { let d = 0; for (let i = 0; i < s.length - 2; i++) { const ax = s[i + 1][0] - s[i][0], ay = s[i + 1][1] - s[i][1], bx = s[i + 2][0] - s[i + 1][0], by = s[i + 2][1] - s[i + 1][1]; d += ax * by - ay * bx; } return d; };
  const nedOgOp = s => { let bund = 0; for (let i = 1; i < s.length; i++) if (s[i][1] > s[bund][1]) bund = i; return bund > 0 && bund < s.length - 1 && s[bund][1] > s[0][1] + 20 && s[bund + 1][1] < s[bund][1]; };
  /** Dansk grundskrift (som i Bogstavvejens test): stammer nedad, runde former mod uret, og man begynder foroven. */
  function skrivemaade(n) {
    const st = G[n].streger, s = st[0], minY = Math.min(...st.reduce((a, x) => a.concat(x.map(q => q[1])), []));
    const fejl = [];
    if (s[0][1] > minY + 15) fejl.push('begynder ikke foroven');
    if (/^[BDEFHIKLMNPRT]$|^[bhknmprilt]$/.test(n) && !(s[1][1] > s[0][1] + 2 && Math.abs(s[1][0] - s[0][0]) < 6)) fejl.push('stammen gaar ikke nedad');
    if (/^[OCGQSocadgqes]$/.test(n) && !(drej(s.slice(0, 25)) < 0)) fejl.push('den runde form gaar ikke mod uret');
    if (/^[bhnmrp]$/.test(n) && !(st.length === 1 && nedOgOp(s))) fejl.push('ikke ned ad stammen og op igen i én streg');
    return fejl;
  }

  const dagTyper = {}, efterRegn = [];
  K.DAGE.forEach(d => {
    const o = d.opgave, f = O.forbered(d), n = 'dag ' + d.dag + ' (' + o.type + ')';
    dagTyper[d.dag] = f.dele.map(x => x.type);
    if (TYPER.indexOf(o.type) < 0) { problemer.push(n + ': ukendt type'); return; }
    if (f.type !== o.type) problemer.push(n + ': forbered giver typen ' + f.type);
    if (!(f.dele.length >= (o.type === 'puslespil' ? 2 : 3) && f.dele.length <= 8)) problemer.push(n + ': ' + f.dele.length + ' dele, ikke 3-8');
    f.dele.forEach((x, i) => {
      const m = n + ', del ' + (i + 1) + ' (' + x.type + (x.variant ? ':' + x.variant : '') + ')';
      if (DELE.indexOf(x.type) < 0) { problemer.push(m + ': ukendt del'); return; }
      if (x.type === 'tael') {
        if (!(x.antal >= 8 && x.antal <= 15 && x.antal % 1 === 0)) problemer.push(m + ': antal ' + x.antal + ', ikke 8-15');
        if (!O.tingFindes(x.ting)) problemer.push(m + ': tingen ' + x.ting + ' kendes ikke');
        if (x.pladser.pos.length !== x.antal) problemer.push(m + ': ' + x.pladser.pos.length + ' pladser til ' + x.antal);
      }
      if (x.type === 'tael' || (x.type === 'regn' && x.layout === 'felt')) {
        const pos = x.pladser.pos, fh = x.pladser.forhold, s = x.pladser.str;
        pos.forEach((p, a) => {
          if (p.x < 0.05 || p.x > 0.95 || p.y < 0.05 || p.y > 0.95) problemer.push(m + ': en ting staar uden for feltet');
          for (let b = a + 1; b < pos.length; b++) if (Math.hypot((p.x - pos[b].x) * fh, p.y - pos[b].y) < s) problemer.push(m + ': to ting staar oven i hinanden');
        });
        // Spredt, ikke paa raekke: tingene har mange forskellige hoejder
        if (new Set(pos.map(p => Math.round(p.y * 20))).size < Math.min(5, pos.length - 2)) problemer.push(m + ': tingene staar paa raekke, ikke spredt');
      }
      if (x.type === 'regn') {
        if (x.svar !== x.foer + x.plus - x.minus) problemer.push(m + ': svaret ' + x.svar + ' er ikke ' + x.foer + ' + ' + x.plus + ' - ' + x.minus);
        if (!(x.svar >= 1 && x.svar <= x.max)) problemer.push(m + ': svaret ' + x.svar + ' ligger ikke paa talraekken 1..' + x.max);
        if (!!x.plus === !!x.minus) problemer.push(m + ': enten plus eller minus');
        if (!x.spoerg || !/\?$/.test(x.spoerg)) problemer.push(m + ': intet spoergsmaal');
        const aendr = x.saetninger[x.saetninger.length - 1];
        if (!talIOrd(aendr, x.plus || x.minus)) problemer.push(m + ': "' + aendr + '" siger ikke ' + O.TALORD[x.plus || x.minus]);
        if (x.layout === 'gruppe') {
          if (O.saetningerAf(x.tekst).length !== 3) problemer.push(m + ': historien er ikke tre saetninger');
          if (!talIOrd(x.saetninger[0], x.foer)) problemer.push(m + ': "' + x.saetninger[0] + '" siger ikke ' + O.TALORD[x.foer]);
          if (x.max !== 10 || x.foer > 10) problemer.push(m + ': regnehistorierne bruger talraekken til ti');
          if (x.figurer) x.ting.forEach(v => { if (!O.FIGURER[v] || !findes(O.FIGURER[v])) problemer.push(m + ': ' + v + ' har intet billede'); });
          else if (!O.tingFindes(x.ting)) problemer.push(m + ': tingen ' + x.ting + ' kendes ikke');
          if (x.daek && ['klud', 'snemand'].indexOf(x.daek) < 0) problemer.push(m + ': ukendt daek ' + x.daek);
          (x.figur || []).forEach(v => { if (!O.FIGURER[v]) problemer.push(m + ': ' + v + ' er ikke en figur'); });
        }
      }
      if (x.type === 'se') {
        if (!(x.antal >= 1 && x.antal <= x.max && x.max <= 10)) problemer.push(m + ': antal ' + x.antal + ' ligger ikke paa talraekken 1..' + x.max);
        if (!O.tingFindes(x.ting)) problemer.push(m + ': tingen ' + x.ting + ' kendes ikke');
        if (x.moenster.pos.length !== x.antal) problemer.push(m + ': moensteret har ' + x.moenster.pos.length + ' ting');
        if (['terning', 'tierramme'].indexOf(x.moenster.navn) < 0 || (x.moenster.navn === 'terning' && x.antal > 6)) problemer.push(m + ': ' + x.antal + ' som ' + x.moenster.navn);
        x.moenster.pos.forEach((p, a) => x.moenster.pos.forEach((q, b) => { if (a < b && Math.hypot(p.x - q.x, p.y - q.y) < 0.74) problemer.push(m + ': to ting roerer hinanden'); }));
        if (x.mangler && (x.mangler.svar !== 10 - x.antal || x.moenster.navn !== 'tierramme')) problemer.push(m + ': mangler til ti er ' + x.mangler.svar);
      }
      if (x.type === 'flest') {
        if (!(x.venstre >= 1 && x.hoejre >= 1 && x.venstre <= 10 && x.hoejre <= 10) || x.venstre === x.hoejre) problemer.push(m + ': ' + x.venstre + ' mod ' + x.hoejre);
        if (!O.tingFindes(x.ting)) problemer.push(m + ': tingen ' + x.ting + ' kendes ikke');
        if (x.bunker.venstre.length !== x.venstre || x.bunker.hoejre.length !== x.hoejre) problemer.push(m + ': bunkerne passer ikke');
        if (x.flest !== (x.venstre > x.hoejre ? 'venstre' : 'hoejre') || x.flere.svar !== Math.abs(x.venstre - x.hoejre)) problemer.push(m + ': flest eller flere er forkert');
      }
      if (x.type === 'spor') {
        const liste = x.stor ? Glyffer.BOGSTAVER : Glyffer.SMAA;
        if (!G[x.glyf] || liste.indexOf(x.glyf) < 0) problemer.push(m + ': ' + x.bogstav + ' findes ikke i Bogstavvejens ' + (x.stor ? 'store' : 'smaa') + ' bogstaver');
        else {
          // En finger, der foelger stregen (lidt skaevt), kan tegne bogstavet faerdigt
          const sp = new Spor(G[x.glyf], 14);
          sp.streger.forEach(st => { sp.start(st[0][0] + 2, st[0][1] - 1); st.forEach(q => sp.flyt(q[0] + 2, q[1] - 1)); sp.slip(); });
          if (!sp.faerdig) problemer.push(m + ': ' + x.bogstav + ' kan ikke tegnes faerdigt');
          skrivemaade(x.glyf).forEach(e => problemer.push(m + ': ' + x.bogstav + ' ' + e));
        }
        if (x.stor && (!/^\S+ som i .+\.$/.test(x.slut) || x.slut.charAt(0) !== x.bogstav)) problemer.push(m + ': ' + x.slut + ' er ikke i formen "S som i sne."');
        if (x.stor !== (x.bogstav === x.bogstav.toUpperCase())) problemer.push(m + ': stort og lille er byttet om');
      }
      if (x.type === 'kort') {
        const ord = x.kort.map(k => k.ord).filter(Boolean);
        ord.forEach(w => { if (UREN.test(w)) problemer.push(m + ': ' + w + ' lyder ikke, som det staves'); });
        if (x.rigtige.some(r => !x.kort.some(k => k.noegle === r))) problemer.push(m + ': et rigtigt kort er ikke med');
        if (new Set(x.kort.map(k => k.noegle)).size !== x.kort.length) problemer.push(m + ': det samme kort to gange');
        if (x.variant === 'forlyd') {
          if (lyd(x.eksempel) !== x.lyd) problemer.push(m + ': eksemplet ' + x.eksempel + ' starter ikke med ' + x.lyd);
          if (x.kort.length !== 4 || x.rigtige.length < 1 || x.rigtige.length > 2) problemer.push(m + ': ' + x.rigtige.length + ' rigtige af ' + x.kort.length);
          ord.forEach(w => { const r = x.rigtige.indexOf(w) >= 0; if (r !== (lyd(w) === x.lyd)) problemer.push(m + ': ' + w + (r ? ' starter ikke med ' : ' starter ogsaa med ') + x.lyd); });
        }
        if (x.variant === 'bogstav') {
          if (x.rigtige.length !== 1 || x.rigtige[0] !== lyd(x.ord)) problemer.push(m + ': ' + x.ord + ' starter ikke med ' + x.rigtige[0]);
          if (x.kort.length !== 3 || x.kort.some(k => !/^[A-ZÆØÅ]$/.test(k.bogstav))) problemer.push(m + ': tre bogstaver at vaelge imellem');
          if (UREN.test(x.ord)) problemer.push(m + ': ' + x.ord + ' lyder ikke, som det staves');
        }
        if (x.variant === 'rim') {
          const g = Rim.GRUPPE[x.ord];
          if (x.kort.length !== 4 || x.rigtige.length !== 1) problemer.push(m + ': ikke 1 af 4');
          if (g === undefined || Rim.GRUPPE[x.rigtige[0]] !== g || x.ord === x.rigtige[0]) problemer.push(m + ': ' + x.rigtige[0] + ' rimer ikke paa ' + x.ord + ' ifoelge Rim.RIM');
          ord.forEach(w => { if (w !== x.rigtige[0] && Rim.GRUPPE[w] === g) problemer.push(m + ': ' + w + ' rimer ogsaa paa ' + x.ord); });
        }
        if (x.variant === 'rimIkke') {
          const andre = ord.filter(w => w !== x.rigtige[0]);
          if (x.kort.length !== 3 || x.rigtige.length !== 1) problemer.push(m + ': ikke praecis ét, der ikke rimer (' + x.rigtige.join() + ')');
          else if (Rim.GRUPPE[andre[0]] === undefined || Rim.GRUPPE[andre[0]] !== Rim.GRUPPE[andre[1]]) problemer.push(m + ': de to andre rimer ikke');
        }
        if (x.variant === 'rimPar') {
          const g = Rim.GRUPPE[x.rigtige[0]];
          if (x.kort.length !== 4 || x.rigtige.length !== 2 || g === undefined || Rim.GRUPPE[x.rigtige[1]] !== g) problemer.push(m + ': ikke praecis to, der rimer (' + x.rigtige.join() + ')');
        }
        if (x.variant === 'klapFlest') {
          if (x.kort.length !== 2 || x.rigtige.length !== 1 || x.stavelser.some(s => !(s > 0)) || x.stavelser[0] === x.stavelser[1]) problemer.push(m + ': ikke entydigt, hvilket ord har flest klap (' + ord.join(', ') + ')');
          if (x.rigtige[0] !== ord[x.stavelser.indexOf(Math.max(...x.stavelser))]) problemer.push(m + ': det forkerte ord har flest klap');
        }
      }
      if (x.type === 'klap' && !(x.stavelser >= 1 && x.stavelser <= 4)) problemer.push(m + ': ' + x.ord + ' har ' + x.stavelser + ' stavelser i Rim.STAVELSER');
      if (x.type === 'moenster') {
        const per = x.moenster.length;
        if (['AB', 'AAB', 'ABC'].indexOf(x.moenster) < 0) problemer.push(m + ': ukendt moenster ' + x.moenster);
        if (x.raekke.some(p => !O.PYNT[p]) || x.valg.some(p => !O.PYNT[p])) problemer.push(m + ': ukendt pynt');
        if (x.raekke.some((p, a) => a >= per && p !== x.raekke[a - per])) problemer.push(m + ': raekken gentager ikke moensteret');
        if (new Set(x.raekke.slice(0, per)).size !== new Set(x.moenster).size) problemer.push(m + ': moensteret ' + x.moenster + ' har ikke ' + new Set(x.moenster).size + ' slags pynt');
        if (x.vist < per * 2 - 1) problemer.push(m + ': moensteret ses ikke helt to gange');
        if (x.svar.some(v => x.valg.indexOf(v) < 0) || new Set(x.valg).size !== 3) problemer.push(m + ': svaret er ikke blandt tre forskellige valg');
      }
      if (x.type === 'venner') x.venner.forEach(v => { if (!O.FIGURER[v] || !findes(O.FIGURER[v])) problemer.push(m + ': ' + v + ' har intet billede'); });
      if (x.type === 'sorter') {
        x.figurer.forEach(v => { if (!O.FIGURER[v.navn] || !findes(O.FIGURER[v.navn]) || !(v.navn in O.FLYVER)) problemer.push(m + ': ' + v.navn + ' kan ikke sorteres'); });
        if (!x.figurer.some(v => v.op) || !x.figurer.some(v => !v.op)) problemer.push(m + ': der skal vaere nogen baade oppe og nede');
      }
      if (x.type === 'puslespil' && !(x.loese.length >= 1 && x.loese.every(b => b >= 1 && b <= 24))) problemer.push(m + ': loese brikker ' + x.loese);
      if (['tael', 'se', 'flest', 'pynt', 'venner', 'sorter', 'puslespil', 'moenster', 'regn'].indexOf(x.type) >= 0 && !x.spoerg) problemer.push(m + ': intet spoergsmaal');
    });
    // Let foerst, saa svaerere
    const se = f.dele.filter(x => x.type === 'se');
    if (se.length && (se.length < 4 || se.length > 5 || se.some((x, a) => a && x.vis > se[a - 1].vis) || !(se[se.length - 1].vis < se[0].vis) || !se.some(x => x.moenster.navn === 'tierramme') || !se.some(x => x.moenster.navn === 'terning'))) problemer.push(n + ': se skal have 4-5 runder med terning og tierramme, og de sidste vises kortere');
    const regn = f.dele.filter(x => x.type === 'regn' && x.layout === 'gruppe' && !x.figurer);
    if (regn.length && (regn.length < 2 || regn.length > 4 || !regn[regn.length - 1].daek || regn[0].daek)) problemer.push(n + ': 2-4 regnehistorier, de foerste kan ses, og de sidste er delvist daekket');
    const flest = f.dele.filter(x => x.type === 'flest');
    if (flest.length && !flest.some(x => Math.abs(x.venstre - x.hoejre) <= 1)) problemer.push(n + ': ingen bunker med taette tal');
    const klap = f.dele.filter(x => x.type === 'klap');
    if (klap.length && (klap.length !== 5 || klap.some((x, a) => a && x.stavelser < klap[a - 1].stavelser) || klap[0].stavelser !== 1 || klap[4].stavelser < 3)) problemer.push(n + ': fem klap-runder fra ét klap og op');
    const moen = f.dele.filter(x => x.type === 'moenster').map(x => ['AB', 'AAB', 'ABC'].indexOf(x.moenster));
    if (moen.some((v, a) => a && v < moen[a - 1]) || (moen.length && moen[moen.length - 1] !== 2)) problemer.push(n + ': moenstrene skal gaa fra AB over AAB til ABC');
    if (o.type === 'tael' && !f.dele.some(x => x.type === 'regn')) problemer.push(n + ': intet spoergsmaal efter optaellingen');
    if (o.type === 'flest' && f.dele.some(x => !x.flere)) problemer.push(n + ': intet "Hvor mange flere er der?"');
    if (o.type === 'spor' && !(f.dele[0].stor && !f.dele[1].stor && f.dele[0].glyf.toLowerCase() === f.dele[1].glyf && f.dele.some(x => x.variant === 'forlyd' && x.rigtige.length === 2))) problemer.push(n + ': stort, lille og to af fire billeder med lyden');
    if (o.type === 'forlyd' && !(f.dele.some(x => x.variant === 'forlyd' && x.rigtige.length === 2) && f.dele.some(x => x.variant === 'bogstav'))) problemer.push(n + ': forlyd med to rigtige og en runde med bogstaver');
    if (o.type === 'rim' && !['rim', 'rimIkke', 'rimPar'].every(v => f.dele.some(x => x.variant === v))) problemer.push(n + ': rim, rimer ikke og rimpar');
    if (o.type === 'klap' && !f.dele.some(x => x.variant === 'klapFlest')) problemer.push(n + ': "Hvilket ord har flest klap?" mangler');
    if (o.type === 'pynt' && (moen.length < 3 || f.dele[f.dele.length - 1].type !== 'pynt')) problemer.push(n + ': moenstre og saa fri pynt');
    if (o.type === 'venner' && !(f.dele.some(x => x.type === 'sorter') || f.dele.some(x => x.type === 'regn'))) problemer.push(n + ': tael og sorter, eller tael to grupper');
    if (o.type === 'puslespil') {
      const sidste = f.dele[f.dele.length - 1];
      if (f.dele.length !== 2 || f.dele[0].loese.length !== 5 || !sidste.nis || sidste.loese.join() !== '24' || f.dele[0].skjult.join() !== '24') problemer.push(n + ': fem loese brikker og saa Nis\' sidste brik');
    }
  });
  tjek('hver opgave er gyldig (tal, regnestykker, forlyd, bogstaver, rim, stavelser, moenstre, venner)', problemer.length === 0, problemer.length + ' problemer: ' + problemer.slice(0, 4).join(' | '));
  tjek('alle elleve slags opgaver er med i kalenderen', TYPER.every(t => K.DAGE.some(d => d.opgave.type === t)), TYPER.filter(t => !K.DAGE.some(d => d.opgave.type === t)).join());
  const uge1 = K.DAGE.slice(0, 7).map(d => d.opgave.type);
  tjek('uge 1 veksler: aldrig samme slags tal-opgave to dage i traek, og regn er med', uge1.every((t, i) => !i || t !== uge1[i - 1]) && uge1.indexOf('regn') >= 0, uge1.join());

  const ord = O.ordene(K), info = ord.map(o => O.ord(o));
  tjek('alle ord i opgaverne findes i Bogstavvejen eller Rimhulen', info.every(Boolean), ord.filter((o, i) => !info[i]).join());
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

/* En robot klarer alle opgaver paa alle 24 dage med opgaver.js' regler, ogsaa med et forkert svar foerst */
{
  const fejlR = [];
  let dele = 0, forkerte = 0, valg = 0;
  K.DAGE.forEach(d => {
    O.forbered(d).dele.forEach((x, i) => {
      const m = 'dag ' + d.dag + ', del ' + (i + 1) + ' (' + x.type + ')';
      const r = O.runde(x);
      dele++;
      // Et forkert svar foerst, hvor man kan svare forkert (i tael foerst efter den foerste ting)
      let forkert = r.forkert();
      if (!forkert && x.type === 'tael') { r.svar(r.loesning()); valg++; forkert = r.forkert(); }
      if (forkert) {
        const svar = forkert.map(v => r.svar(v));
        valg += forkert.length;
        if (svar[svar.length - 1].rigtig || svar.some(s => s.faerdig)) fejlR.push(m + ': det forkerte svar ' + JSON.stringify(forkert[forkert.length - 1]) + ' blev godtaget');
        else forkerte++;
      }
      let s = { faerdig: false }, n = 0;
      while (!s.faerdig && n++ < 100) {
        const v = r.loesning();
        s = r.svar(v); valg++;
        if (!s.rigtig) { fejlR.push(m + ': loesningen ' + JSON.stringify(v) + ' blev ikke godtaget'); break; }
      }
      if (!s.faerdig || !r.t.faerdig) fejlR.push(m + ': blev ikke faerdig');
      if (x.type === 'spor') {
        // Til sporet: fingeren tegner bogstavet med Bogstavvejens sporing
        const sp = new Spor(Glyffer.GLYFFER[x.glyf], 14);
        sp.streger.forEach(st => { sp.start(st[0][0], st[0][1]); st.forEach(q => sp.flyt(q[0] + 3, q[1])); sp.slip(); });
        if (!sp.faerdig) fejlR.push(m + ': fingeren tegnede ikke ' + x.bogstav + ' faerdigt');
      }
      if (x.type === 'puslespil') {
        // Og i puslespillet slippes hver brik foerst forkert og saa paa plads
        const spil = P.nytSpil(x.loese.concat(x.skjult), x.steder.concat(x.skjult.map(() => [99, 99])));
        x.loese.forEach((dag, k) => {
          const br = spil.brikker.filter(b => b.dag === dag)[0], id = 20 + k;
          P.tag(spil, br.x + 0.5, br.y + 0.5, id); P.flyt(spil, br.kol + 2.5, br.raek + 0.5, id);
          if (P.slip(spil, id)) fejlR.push(m + ': brik ' + dag + ' klikkede paa en forkert plads');
          P.tag(spil, br.x + 0.5, br.y + 0.5, id); P.flyt(spil, br.kol + 0.6, br.raek + 0.4, id);
          if (!P.slip(spil, id)) fejlR.push(m + ': brik ' + dag + ' kunne ikke laegges');
        });
        if (x.skjult.length ? spil.faerdig || spil.brikker.filter(b => !b.paa).map(b => b.dag).join() !== x.skjult.join() : !spil.faerdig) fejlR.push(m + ': puslespillet er ikke, som det skal vaere');
      }
    });
  });
  tjek('en robot klarer alle ' + dele + ' dele paa alle 24 dage (' + valg + ' tryk), ogsaa med et forkert svar foerst (' + forkerte + ' gange)', fejlR.length === 0, fejlR.slice(0, 4).join(' | '));
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
  tjek('opgaverne siger brik og puslespil, aldrig stykke', SAETNINGER.every(t => !/\bstykke/i.test(t)) && /brik/.test(O.TEKST.brikLagt) && /puslespil/.test(O.TEKST.brikLagt));
  // Alt, skaermen kan sige i opgaverne, er bygget af hele saetninger fra Opgaver.saetninger().
  // Hver del gennemsoeges for alle tekster med punktum, spoergsmaals- eller udraabstegn, ogsaa dem i raekker og under-spoergsmaal.
  const kendt = {}; SAETNINGER.forEach(t => { kendt[t] = 'x'; });
  const siges = [];
  Object.keys(O.TEKST).forEach(k => siges.push(O.TEKST[k]));
  for (let n = 1; n <= 24; n++) siges.push(O.tal(n));
  const saml = v => { if (typeof v === 'string') { if (/[.!?]$/.test(v)) siges.push(v); } else if (v && typeof v === 'object') Object.keys(v).forEach(k => saml(v[k])); };
  const raekker = [];
  K.DAGE.forEach(d => {
    const f = O.forbered(d);
    siges.push(f.fejring);
    f.dele.forEach(x => {
      saml(x);
      if (x.type === 'se' && x.foer) siges.push(x.foer, x.spoerg);
      if (x.type === 'regn') siges.push(x.saetninger.concat([x.spoerg]).join(' '));
      [x.spoerg, x.igen].forEach(s => { if (Array.isArray(s)) raekker.push(s); });
    });
  });
  const uden = siges.filter(t => t && !Stemme.del(t, kendt));
  tjek('alt, opgaverne siger, er hele saetninger fra Opgaver.saetninger()', uden.length === 0, uden.slice(0, 3).join(' | '));
  const cifre = SAETNINGER.filter(t => /\d/.test(t));
  tjek('tal siges med bogstaver, aldrig med cifre', cifre.length === 0, cifre.slice(0, 3).join(' | '));
  // Ordklippene ("Her har du ordet kat.") spilles alene, og spoergsmaalet bagefter er en hel saetning, der passer til rammen
  const RAMME = [O.TEKST.rimer, O.TEKST.hvilketBogstav, O.TEKST.klap];
  const forkertRamme = raekker.filter(r => r.some((t, i) => typeof t === 'object' && (!t.ord || (i + 1 < r.length && RAMME.indexOf(r[i + 1]) < 0))));
  const ordIEgne = SAETNINGER.filter(t => /Her har du ordet/.test(t));
  tjek('ordklippene spilles for sig, og spoergsmaalet bagefter passer til rammen ("Hvad rimer på det?")', forkertRamme.length === 0 && ordIEgne.length === 0, forkertRamme.map(r => JSON.stringify(r)).concat(ordIEgne).slice(0, 2).join(' | '));
  const lege = fs.readFileSync(path.join(MAPPE, 'js', 'lege.js'), 'utf8');
  tjek('legene siger kun det, opgaverne har lagt frem (ingen tekst i lege.js)', !/J\.(sige|raekke)\(\s*'/.test(lege) && !/J\.sige\(\s*"/.test(lege));
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
