/**
 * Test af Årstidshaven — koeres med `npm test`. Kraever ingen browser.
 * En robot opfylder Pelles oensker paa alle tre stjerner og med én og to
 * spillere: den finder bedet med det rigtige skilt, saar, vander, hoester
 * og jager kaninen og fuglen vaek. Dyrene, sommerens toerke, vinteren og
 * efteraarets frø tjekkes for sig, og det samme goer ordene, stemmen siger.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const MAPPE = path.join(ROD, 'games', 'have');
const { Haven } = require(path.join(MAPPE, 'js', 'haven.js'));
const { Stemme } = require(path.join(ROD, 'js', 'stemme.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nÅrstidshaven\n');

const { AFGROEDER, AFGR_ALLE, KATEGORI, ORD, TAK, TRIN, antalOrd, oenskeTekst } = Haven;

/* En have med styr paa alt, der bliver sagt. ALT_SAGT samler alt fra alle haverne til tjekket af stemmen. */
const ALT_SAGT = new Set();
function nyHave(seed) {
  const sagt = [], taelt = [];
  const H = Haven.ny({
    tilfaeldig: Haven.tilfaeldig(seed),
    sig: t => { sagt.push(t); ALT_SAGT.add(t); },
    sigKoe: t => { sagt.push(t); ALT_SAGT.add(t); if (/^(En|To|Tre|Fire|Fem)!$/.test(t)) taelt.push(t); }
  });
  return { H, sagt, taelt };
}
function vent(H, sek, dt = 0.1) { for (let t = 0; t < sek; t += dt) H.opdater(dt); }
function bedMed(H, afgr) { return H.bede.find(b => b.afgr === afgr); }
/* Gro et bed hele vejen op: saa og vand tre gange */
function gro(H, bd, til = 'moden') {
  if (bd.fase === 'tom') H.arbejd(bd, 'froe');
  let n = 0;
  while (bd.fase !== til && n++ < 20) { vent(H, 3.5); if (bd.fase !== til) H.arbejd(bd, 'vand'); }
  vent(H, 3.5);
}

/* Ordene */
{
  tjek('hver afgroede har mindst ét bed', AFGR_ALLE.every(a => AFGROEDER.includes(a)));
  tjek('hver afgroede har ord, tak og billede i spillet', AFGR_ALLE.every(a => ORD[a] && TAK[a]));
  const kat = Object.keys(KATEGORI);
  tjek('hver kategori har medlemmer, der gror i haven', kat.every(k => KATEGORI[k].medlemmer.length && KATEGORI[k].medlemmer.every(a => AFGROEDER.includes(a))));
  const roed = ['tomat', 'jordbaer', 'peberfrugt'], groen = ['salat', 'agurk'];
  tjek('det roede er roedt, og det groenne er groent', roed.every(a => KATEGORI.roed.medlemmer.includes(a)) && groen.every(a => KATEGORI.groen.medlemmer.includes(a)));
  tjek('kun guleroden gror nede i jorden', KATEGORI.jord.medlemmer.join() === 'gulerod');
  tjek('én, ét og flertal passer', antalOrd(1, 'tomat') === 'én tomat' && antalOrd(1, 'jordbaer') === 'ét jordbær' && antalOrd(1, 'salat') === 'ét salathoved' &&
    antalOrd(3, 'gulerod') === 'tre gulerødder' && antalOrd(5, 'peberfrugt') === 'fem peberfrugter', [antalOrd(1, 'salat'), antalOrd(3, 'gulerod')].join());
  tjek('oensket siges som en hel saetning', oenskeTekst({ dele: [{ afgr: 'tomat', antal: 3 }] }, true) === 'Pelle ønsker sig tre tomater. Kan I finde bedet med skiltet?');
  tjek('en kategori spoerger, hvad der passer', oenskeTekst({ dele: [{ kat: 'roed', antal: 1 }] }, true) === 'Pelle ønsker sig noget rødt. Hvad er rødt i haven?');
  tjek('to ting paa én gang siges som to saetninger', oenskeTekst({ dele: [{ afgr: 'gulerod', antal: 2 }, { afgr: 'agurk', antal: 1 }] }, false) === 'Pelle ønsker sig to gulerødder. Og så én agurk.');
}

/* Robotten: opfylder oensker, som et barn ville, og jager dyrene vaek */
function spil(niveau, spillere, antalOensker, seed) {
  const { H, sagt, taelt } = nyHave(seed);
  H.nulstil(niveau, spillere);
  const oensker = [];
  let forrige = null, faaetFoer = 0, taeltFoer = 0, taellingOk = true;
  for (let skridt = 0; skridt < 40000 && H.oenskerFaaet < antalOensker; skridt++) {
    H.opdater(0.1);
    if (H.oenske && H.oenske !== forrige) { forrige = H.oenske; oensker.push(H.oenske.dele.map(d => ({ afgr: d.afgr, kat: d.kat, antal: d.antal }))); taeltFoer = taelt.length; }
    if (H.oenskerFaaet > faaetFoer) {
      // stemmen talte én, to, tre ... for hver del, og aldrig forbi det, Pelle oenskede sig
      const dele = oensker[oensker.length - 1], talt = taelt.slice(taeltFoer);
      const ventet = dele.reduce((s, d) => s + d.antal, 0);
      if (talt.length !== ventet) taellingOk = false;
      faaetFoer = H.oenskerFaaet;
    }
    if (H.kanin.fase === 'spiser' || H.kanin.fase === 'hen') H.jagKanin();
    if (H.fugl.fase === 'kommer' || H.fugl.fase === 'pikker') H.jagFugl();
    if (!H.oenske || skridt % 5) continue;
    const del = H.oenske.dele.find(d => d.faaet + d.paaVej < d.antal);
    if (!del) continue;
    const kandidater = H.bede.filter(b => Haven.passer(del, b.afgr) && b.vaekst >= 1);
    const orden = ['moden', 'plante', 'spire', 'saaet', 'tom'];
    kandidater.sort((a, b) => orden.indexOf(a.fase) - orden.indexOf(b.fase));
    const bd = kandidater[0];
    if (!bd) continue;
    if (bd.toerst) H.arbejd(bd, 'vand');
    else if (bd.fase === 'moden') H.arbejd(bd, 'kurv');
    else if (bd.fase === 'tom') H.arbejd(bd, 'froe');
    else H.arbejd(bd, 'vand');
  }
  return { H, sagt, oensker, taellingOk };
}

for (const niveau of [1, 2, 3]) {
  const r = spil(niveau, 1, 9, 100 + niveau);
  tjek(niveau + ' stjerne(r): robotten opfylder ni oensker', r.H.oenskerFaaet >= 9, r.H.oenskerFaaet + ' oensker paa ' + Math.round(r.H.tid) + ' s');
  tjek(niveau + ' stjerne(r): stemmen taeller med for hver, der lander hos Pelle', r.taellingOk);
  const dele = r.oensker.flat();
  let ok;
  if (niveau === 1) ok = r.oensker.every(o => o.length === 1) && dele.every(d => d.afgr ? d.antal >= 1 && d.antal <= 3 : d.antal === 1);
  else if (niveau === 2) ok = r.oensker.every(o => o.length === 1) && dele.every(d => d.afgr ? d.antal >= 2 && d.antal <= 5 : d.antal >= 2 && d.antal <= 3);
  else ok = r.oensker.every(o => o.length === 2 && o[0].afgr !== o[1].afgr && o[1].afgr && (!o[0].kat || !KATEGORI[o[0].kat].medlemmer.includes(o[1].afgr))) && dele.every(d => d.antal >= 1 && d.antal <= 3);
  tjek(niveau + ' stjerne(r): oenskerne har den rette stoerrelse', ok, JSON.stringify(r.oensker.slice(0, 4)));
  tjek(niveau + ' stjerne(r): hvert tredje oenske er en kategori', r.oensker.filter((o, i) => i % 3 === 2).every(o => o[0].kat) && r.oensker.filter((o, i) => i % 3 !== 2).every(o => o[0].afgr));
  const daarlig = r.sagt.filter(t => /undefined|NaN|null|\bnul\b/.test(t));
  tjek(niveau + ' stjerne(r): alt, der siges, er hele ord', daarlig.length === 0, daarlig.slice(0, 3).join(' | '));
}
{
  const r = spil(2, 2, 4, 7);
  tjek('to spillere: robotten opfylder fire oensker', r.H.oenskerFaaet >= 4, r.H.oenskerFaaet);
  tjek('to spillere: Pelle staar i midten mellem redskaberne', r.H.pelle.x === 0);
  const en = nyHave(1).H; en.nulstil(1, 1);
  tjek('én spiller: Pelle staar ude til venstre', en.pelle.x < -5);
}

/* Planten vokser i tre trin, ét for hver gang den faar vand */
{
  const { H, sagt } = nyHave(3); H.nulstil(1);
  H.naesteRegn = 1e9;   // ingen regn, saa det kun er vandkanden, der vander
  const bd = bedMed(H, 'tomat'), faser = [];
  H.arbejd(bd, 'froe'); faser.push(bd.fase);
  for (let i = 0; i < 3; i++) { vent(H, 3.5); H.arbejd(bd, 'vand'); faser.push(bd.fase); }
  tjek('frø, spire, plante og moden: ét trin pr. vand', faser.join() === TRIN.join(), faser.join());
  tjek('stemmen siger, hvad frøet er blevet til', sagt.includes('Frøet er blevet til en spire.') && sagt.some(t => t.startsWith('Spiren er blevet til en plante')));
  const foer = bd.fase; H.arbejd(bd, 'froe');
  tjek('forkert redskab er ingen straf: bedet rokker bare', bd.fase === foer && bd.rys > 0);
  vent(H, 3.5);
  tjek('en moden plante siges', sagt.some(t => t.startsWith('Nu hænger der tomater')));
  const kurvFoer = H.kurv.length + H.flyvere.length;
  H.oenske = null; H.naesteOenske = 1e9;
  H.arbejd(bd, 'kurv');
  tjek('hoesten giver én til tre', H.flyvere.length - kurvFoer >= 1 && H.flyvere.length - kurvFoer <= 3 && bd.fase === 'tom');
  vent(H, 2);
  tjek('det, Pelle ikke oensker sig, kommer i kurven', H.kurv.length >= 1 && H.flyvere.length === 0);
  const g = bedMed(H, 'gulerod'); gro(H, g); H.arbejd(g, 'kurv');
  tjek('guleroden kommer op af jorden', sagt.some(t => t.includes('Guleroden kom op af jorden.')));
}

/* Foraarets regn vander alle saaede bede */
{
  const { H } = nyHave(4); H.nulstil(1);
  const a = H.bede[0], b = H.bede[5];
  H.arbejd(a, 'froe'); H.arbejd(b, 'froe');
  vent(H, 20);
  tjek('regnen kommer om foraaret og vander', a.fase !== 'saaet' && b.fase !== 'saaet', a.fase + ' ' + b.fase);
}

/* Kaninen og fuglen */
{
  const { H } = nyHave(5); H.nulstil(1); H.naesteRegn = 1e9;
  const bd = bedMed(H, 'salat'); gro(H, bd, 'plante');
  H.kanin.naeste = 0;
  let n = 0; while (H.kanin.fase !== 'spiser' && n++ < 400) H.opdater(0.1);
  tjek('kaninen hopper hen og gnasker i et bed med blade', H.kanin.fase === 'spiser' && H.kanin.bed === bd);
  tjek('et tryk jager kaninen hjem', H.jagKanin() && H.kanin.fase === 'flygter');
  n = 0; while (H.kanin.fase !== 'rundt' && n++ < 400) H.opdater(0.1);
  H.kanin.naeste = 0; n = 0;
  while (H.kanin.fase !== 'spiser' && n++ < 400) H.opdater(0.1);
  vent(H, 9);
  tjek('naar kaninen naar at spise, gaar planten kun ét trin tilbage', bd.fase === 'spire', bd.fase);

  const { H: F } = nyHave(6); F.nulstil(1); F.saetAar('sommer');
  const fb = bedMed(F, 'tomat'); F.arbejd(fb, 'froe');
  n = 0; while (F.fugl.fase !== 'kommer' && n++ < 200) F.opdater(0.1);
  tjek('fuglen kommer, hvis frøene venter paa vand', F.fugl.fase === 'kommer' && F.fugl.bed === fb);
  tjek('et tryk faar fuglen til at flyve', F.jagFugl() && F.fugl.fase === 'flyver' && fb.fase === 'saaet');
  n = 0; while (F.fugl.fase !== 'pikker' && n++ < 400) F.opdater(0.1);
  vent(F, 7);
  tjek('naar fuglen naar at spise, er frøene vaek, og man saar igen', fb.fase === 'tom' && F.fugl.fase !== 'pikker');
  F.arbejd(fb, 'froe'); vent(F, 1); F.arbejd(fb, 'vand'); vent(F, 12);
  tjek('vandede frø er sikre for fuglen', F.fugl.fase === 'vaek' && fb.fase !== 'tom');
}

/* Sommerens toerke */
{
  const { H, sagt } = nyHave(8); H.nulstil(1); H.saetAar('sommer');
  const bd = bedMed(H, 'agurk'); gro(H, bd);
  H.kanin.naeste = 1e9; vent(H, 17);
  tjek('om sommeren haenger en plante, der mangler vand', bd.toerst && sagt.some(t => t.includes('planten hænger')));
  H.arbejd(bd, 'kurv');
  tjek('en toerstig plante vil have vand, foer den hoestes', bd.fase === 'moden');
  H.arbejd(bd, 'vand');
  tjek('vand, og den er glad igen', !bd.toerst);
}

/* Aarstidsuret, efteraarets frø og vinteren */
{
  const { H, sagt } = nyHave(9); H.nulstil(1);
  const aar = [];
  for (let i = 0; i < 4; i++) { H.naesteAar(); vent(H, 3.5); aar.push(H.aar); }
  tjek('uret gaar foraar, sommer, efteraar, vinter og rundt', aar.join() === 'sommer,efteraar,vinter,foraar', aar.join());
  H.saetAar('efteraar'); H.oenske = null; H.naesteOenske = 1e9;
  const bd = bedMed(H, 'jordbaer'); gro(H, bd); H.arbejd(bd, 'kurv');
  tjek('om efteraaret giver planten nye frø', H.gemteFroe.jordbaer && sagt.some(t => t.includes('nye frø')));
  const a = H.aebler[0];
  tjek('aeblerne plukkes kun med kurven', !H.aeble(a, 'froe') && H.aeble(a, 'kurv') && a.alfa === 0);
  const p = bedMed(H, 'tomat'); gro(H, p, 'spire');
  H.saetAar('vinter');
  tjek('vinteren daekker det, der ikke blev hoestet', H.bede.every(b => b.fase === 'tom') && sagt[sagt.length - 1].includes('Sneen dækkede'));
  vent(H, 20);
  tjek('om vinteren sover Pelle og oensker sig intet', !H.oenske);
  H.arbejd(H.bede[0], 'froe');
  tjek('om vinteren kan man ikke saa', H.bede[0].fase === 'tom');
  H.sigOenske();
  tjek('et tryk paa boblen om vinteren siger, at Pelle sover', sagt[sagt.length - 1] === 'Pelle sover vintersøvn.');
  H.saetAar('foraar');
  tjek('om foraaret er frøene fra sidste aar i frøposen', sagt[sagt.length - 1].includes('frø fra sidste år'));
}

/* Stemmen: hver saetning er ét klip, og alt, haven kan sige, kan saettes sammen af dem */
{
  const S = Haven.saetninger(), kendt = {};
  S.forEach(t => { kendt[t] = true; });
  tjek('hver saetning staar én gang', new Set(S).size === S.length);
  tjek('saetningerne er hele saetninger med tegn til sidst', S.every(t => /^[A-ZÆØÅÉ].*[.!?]$/.test(t) && Stemme.saetninger(t).join(' ') === t), S.filter(t => !/[.!?]$/.test(t)).join(' | '));
  const udenKlip = [...ALT_SAGT].filter(t => !Stemme.del(t, kendt));
  tjek('alt, robotterne hoerte, kan siges med klippene (' + ALT_SAGT.size + ' replikker)', udenKlip.length === 0, udenKlip.slice(0, 3).join(' | '));
  // Og alle oensker og alt, Pelle kan mangle, ogsaa dem, robotterne ikke moedte
  const alle = [];
  const dele = [];
  AFGR_ALLE.forEach(a => { for (let n = 1; n <= 5; n++) dele.push({ afgr: a, antal: n }); });
  Object.keys(KATEGORI).forEach(k => { for (let n = 1; n <= 3; n++) dele.push({ kat: k, antal: n }); });
  dele.forEach(d => {
    alle.push(oenskeTekst({ dele: [d] }, true), oenskeTekst({ dele: [d] }, false));
    AFGR_ALLE.filter(a => a !== d.afgr).forEach(a => { for (let n = 1; n <= 3; n++) alle.push(oenskeTekst({ dele: [d, { afgr: a, antal: n }] }, true)); });
    for (let f = 1; f < d.antal; f++) alle.push(Haven.manglerTekst([{ afgr: d.afgr, kat: d.kat, antal: d.antal, faaet: f }]));
  });
  AFGR_ALLE.forEach(a => { for (let n = 1; n <= 3; n++) alle.push(Haven.manglerTekst([{ afgr: 'tomat', antal: 3, faaet: 1 }, { afgr: a, antal: n, faaet: 0 }])); });
  const mangler = alle.filter(t => !Stemme.del(t, kendt));
  tjek('alle oensker og alt, Pelle kan mangle, kan siges med klippene', mangler.length === 0, mangler.slice(0, 3).join(' | '));
  tjek('en indtalt replik bruges hel, og en sammensat deles', Stemme.del('Det er forår. Nu kan vi så frø i bedene.', { 'Det er forår. Nu kan vi så frø i bedene.': 'a.mp3', 'Det er forår.': 'b.mp3' }).join() === 'a.mp3' &&
    Stemme.del('Pelle ønsker sig to gulerødder. Og så én agurk.', { 'Pelle ønsker sig to gulerødder.': 'a.mp3', 'Og så én agurk.': 'b.mp3' }).join() === 'a.mp3,b.mp3' &&
    Stemme.del('Noget helt nyt.', {}) === null);
  const klipSti = path.join(MAPPE, 'lyd', 'klip.json');
  const klip = fs.existsSync(klipSti) ? JSON.parse(fs.readFileSync(klipSti, 'utf8')) : {};
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const filer = Object.values(klip);
  tjek('klip.json er i service workeren', sw.includes("'games/have/lyd/klip.json'"));
  tjek('hvert klip findes og er i service workeren', filer.every(f => fs.existsSync(path.join(MAPPE, 'lyd', f)) && sw.includes("'games/have/lyd/" + f + "'")), filer.filter(f => !fs.existsSync(path.join(MAPPE, 'lyd', f))).slice(0, 3).join());
  tjek('klippenes filnavne er uden æ, ø og å', filer.every(f => /^[a-z0-9_]+\.mp3$/.test(f)));
  const gamle = Object.keys(klip).filter(t => !kendt[t]);
  tjek('ingen klip til saetninger, haven ikke laengere siger', gamle.length === 0, gamle.slice(0, 3).join(' | '));
  const uindtalt = S.filter(t => !klip[t]);
  tjek('alt, haven siger, er indtalt (' + filer.length + ' klip)', uindtalt.length === 0, uindtalt.length + ' mangler, fx: ' + uindtalt.slice(0, 3).join(' | '));
}

/* Filerne og rammerne */
{
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(MAPPE, 'index.html'), 'utf8');
  const kode = fs.readFileSync(path.join(MAPPE, 'js', 'game.js'), 'utf8');
  const haven = fs.readFileSync(path.join(MAPPE, 'js', 'haven.js'), 'utf8');
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  tjek('spillet hedder Årstidshaven de tre steder', html.includes('<title>Årstidshaven</title>') && kode.includes('<h2>Årstidshaven</h2>') && /navn:\s*'Årstidshaven'/.test(games));
  const egne = ['games/have/', 'games/have/index.html', 'games/have/js/haven.js', 'games/have/js/game.js'];
  tjek('spillets filer er i service workeren', egne.every(f => sw.includes("'" + f + "'")), egne.filter(f => !sw.includes("'" + f + "'")).join());
  const laant = [...kode.matchAll(/'\.\.\/([^']+\.png)'/g)].map(m => path.normalize(path.join('games/have', '..', m[1])).split(path.sep).join('/'));
  tjek('de laante billeder findes', laant.length >= 18 && laant.every(f => fs.existsSync(path.join(ROD, f))), laant.filter(f => !fs.existsSync(path.join(ROD, f))).join());
  tjek('de laante billeder er i service workeren', laant.every(f => sw.includes("'" + f + "'")), laant.filter(f => !sw.includes("'" + f + "'")).join());
  const stemme = fs.readFileSync(path.join(ROD, 'js', 'stemme.js'), 'utf8');
  const alt = html + kode + haven + stemme;
  tjek('ingen netvaerkskald: kun spillets egne filer hentes', !/https?:\/\/|XMLHttpRequest|WebSocket|sendBeacon/.test(alt) && !/fetch\(/.test(html + kode + haven) &&
    [...stemme.matchAll(/fetch\(([^)]*)\)/g)].every(m => /^mappe \+/.test(m[1])));
  tjek('ingen browser-storage', !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(alt));
  tjek('stemmen er klip eller en stemme, der ligger paa enheden', stemme.includes('localService') && kode.includes('Stemme.ny(') && html.includes('src="../../js/stemme.js"') && sw.includes("'js/stemme.js'"));
  tjek('ingen tekst at laese i haven (intet fillText)', !/fillText|strokeText/.test(kode));
  tjek('pilen i hjoernet foerer tilbage til menuen', kode.includes('Skal.menuKnap(visMenu)'));
  tjek('menuen: stjerner foer de groenne startknapper', kode.indexOf('Menu.stjerneRaekke') > 0 && kode.indexOf('Menu.stjerneRaekke') < kode.indexOf('Menu.startRaekke'));
  tjek('lyden starter foerst efter et tryk', /data-handling|handling === 'start'[\s\S]*startLyd\(\)/.test(kode) && !/^\s*startLyd\(\);/m.test(kode.split('overlay.addEventListener')[0]));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
