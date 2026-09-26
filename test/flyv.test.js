/**
 * Test af Himmelvejen — koeres med `npm test`. Kraever ingen browser.
 * Oeen, floden, broen og dyrene tjekkes, og en robot flyver alle fire breve
 * ud paa alle tre stjerner: én gang ved at trykke paa dyrene (ogsaa et
 * forkert foerst), og én gang ved selv at flyve hen til dem, under broen og
 * rundt om traeet.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'flyv');
const { Oe } = require(path.join(ROD, 'js', 'oe.js'));
const { Flyvning } = require(path.join(ROD, 'js', 'flyvning.js'));
const { Stemme } = require(path.join(__dirname, '..', 'js', 'stemme.js'));
const ALT_SAGT = new Set();   // alt, robotterne hoerte, til tjekket af stemmen

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nHimmelvejen\n');

const { hoejde, STED, ALLE, BRO, TRAE, BUD, klem, vinkelForskel } = Oe;
const steder = Oe.lavSteder();
const mitte = Flyvning.mitte;

/* Oeen, floden og broen */
{
  tjek('der er ti steder paa oeen', ALLE.length === 10);
  const vaade = ALLE.filter(s => hoejde(s.x, s.z) < 1).map(s => s.id);
  tjek('alle steder ligger paa land', vaade.length === 0, vaade.join());
  tjek('floden loeber ud i havet', hoejde(0, -235) < 0);
  tjek('der er vand under broen', hoejde(0, BRO.z) < 0);
  let mindst = 99;
  for (let x = -8; x <= 8; x += 2) mindst = Math.min(mindst, (BRO.y - 1) - (Math.max(hoejde(x, BRO.z), 0) + 3.2));
  tjek('der er plads til Sanne under broen', mindst >= 4, mindst.toFixed(1));
  tjek('broen hviler paa land i begge ender', hoejde(BRO.x0 - 1, BRO.z) > 1 && hoejde(BRO.x1 + 1, BRO.z) > 1);
}

/* Brevene og dyrene */
{
  tjek('der er fire breve', BUD.length === 4);
  tjek('det sidste brev er rundt om traeet hjemme hos Pelle', BUD[3].ord === 'rundtom' && BUD[3].sted === 'noeddeskoven');
  tjek('hvert brev naevner stedet, det skal til', BUD.every(b => b.start.includes(Oe.STEDNAVN[b.sted])), BUD.map(b => b.sted).join());
  tjek('alle ordene har et brev eller broen', Oe.ORDENE.every(o => o === 'under' || BUD.some(b => b.ord === o)));
  for (const b of BUD.filter(b => b.ord !== 'rundtom')) {
    const dyr = steder.dyr[b.sted];
    const rigtige = dyr.filter(m => m.ord === b.ord);
    tjek(b.sted + ': tre dyr, og præcis ét sidder dér, hvor brevet siger', dyr.length === 3 && rigtige.length === 1);
    tjek(b.sted + ': dyrene sidder hver sit sted og siger det forskelligt', new Set(dyr.map(m => m.ord)).size === 3 && new Set(dyr.map(m => m.hvor)).size === 3);
    tjek(b.sted + ': de tre dyr er ens, saa kun pladsen skiller dem ad', new Set(dyr.map(m => m.tx)).size === 1 && dyr[0].tx === b.vaert);
    tjek(b.sted + ': spoergsmaalet siger det samme som det rigtige dyr', b.spoerg.includes(rigtige[0].hvor) && b.tak.includes(rigtige[0].hvor));
    const s = STED[b.sted];
    tjek(b.sted + ': dyrene er paa stedet og paa land', dyr.every(m => Math.hypot(m.x - s.x, m.z - s.z) < 50 && hoejde(m.x, m.z) > 1 && Oe.flodAfstand(m.x, m.z) > 20));
    const oven = dyr.filter(m => m.ord === 'ovenpaa');
    tjek(b.sted + ': den, der sidder oven paa, sidder hoejt', oven.every(m => m.y - hoejde(m.x, m.z) > 5));
    const mellem = dyr.find(m => m.ord === 'mellem');
    if (mellem) {
      const v = steder.pynt.find(t => t.venstre === 'mellem' && Math.hypot(t.x - s.x, t.z - s.z) < 60);
      const h = steder.pynt.find(t => t.hoejre === 'mellem' && Math.hypot(t.x - s.x, t.z - s.z) < 60);
      const lx = t => Oe.lokaleKoord(s, t.x, t.z)[0];
      tjek(b.sted + ': den, der sidder mellem, sidder mellem de to, set forfra', v && h && lx(v) < lx(mellem) - 5 && lx(mellem) + 5 < lx(h));
    }
  }
  tjek('Pelle bor ved det store trae', Math.hypot(steder.dyr.noeddeskoven[0].x - TRAE.x, steder.dyr.noeddeskoven[0].z - TRAE.z) < 20);
}

/* Robotterne */
function styrMod(fu, x, z, hukommelse) {
  const dx = x - fu.x, dz = z - fu.z, d = Math.hypot(dx, dz), dv = vinkelForskel(fu.h, Math.atan2(dx, dz));
  if (!hukommelse.ud && d < 30 && Math.abs(dv) > 1.0) hukommelse.ud = true;   // for taet paa: flyv lidt vaek og kom igen
  if (hukommelse.ud && d > 58) hukommelse.ud = false;
  return hukommelse.ud ? 0 : klem(-dv * 2.2, -1, 1);
}
function spil(niveau, maade) {
  const sagt = [];
  const F = Flyvning.ny(steder.dyr, { sig: t => { sagt.push(t); ALT_SAGT.add(t); } });
  F.nulstil(niveau);
  const dt = 1 / 30, fu = F.fugl, hu = {};
  let forkertFoerst = maade === 'tryk', broFase = maade === 'flyv' ? 0 : -1, t = 0, tryk = 0, fjernest = 0;
  while (!F.slut && t < 1200) {
    t += dt;
    const b = F.detteBud(), bud = F.bud;
    let styr = { drej: 0, stig: null };
    if (broFase >= 0 && !F.bro.klaret) {
      /* Under broen selv, uden hjaelp: ind langs floden og dyk */
      const ind = { x: 0, z: BRO.z + 75 }, ud = { x: 0, z: BRO.z - 90 };
      if (broFase === 0 && Math.hypot(fu.x - ind.x, fu.z - ind.z) < 10) broFase = 1;
      const m = broFase ? ud : ind;
      styr = { drej: styrMod(fu, m.x, m.z, hu), stig: broFase ? klem((BRO.y - 5 - fu.y) / 3, -1, 1) : null };
      if (broFase === 1 && fu.z < BRO.z - 80) broFase = -1;
    } else if (b && b.ord === 'rundtom') {
      const dT = Math.hypot(fu.x - TRAE.x, fu.z - TRAE.z);
      if (maade === 'tryk') {
        if (dT < 150 && !bud.rundtSelv) { F.rundtOmTrae(); tryk++; }
        styr = { drej: styrMod(fu, TRAE.x, TRAE.z, hu), stig: null };
      } else {
        const v = Math.atan2(fu.x - TRAE.x, fu.z - TRAE.z) + (dT < 50 ? 0.7 : 0);
        styr = { drej: styrMod(fu, TRAE.x + Math.sin(v) * 32, TRAE.z + Math.cos(v) * 32, hu), stig: null };
      }
    } else if (b && (bud.fase === 'afsted' || bud.fase === 'finde')) {
      const s = STED[b.sted], dyr = steder.dyr[b.sted];
      const maal = forkertFoerst ? dyr.find(m => m.ord !== b.ord) : dyr.find(m => m.ord === b.ord);
      if (maade === 'tryk') {
        if (Math.hypot(fu.x - s.x, fu.z - s.z) < 130 && !bud.valgt && F.vaelg(maal)) tryk++;
        if (!bud.valgt) styr = { drej: styrMod(fu, s.x, s.z, hu), stig: null };
      } else {
        const d = Math.hypot(fu.x - maal.x, fu.z - maal.z);
        styr = { drej: styrMod(fu, maal.x, maal.z, hu), stig: d < 70 ? klem((mitte(maal) - fu.y) / 3, -1, 1) : null };
      }
      if (forkertFoerst && sagt.some(x => /^Nej, jeg sidder/.test(x))) forkertFoerst = false;
    }
    F.skridt(dt, styr);
    fjernest = Math.max(fjernest, Math.hypot(fu.x, fu.z));
  }
  return { F, sagt, t, tryk, fjernest };
}

for (const niveau of [1, 2, 3]) {
  const a = spil(niveau, 'tryk');
  tjek(niveau + ' stjerne(r), tryk: alle fire breve kommer frem', a.F.slut && ['ovenpaa', 'indei', 'mellem', 'rundtom'].every(o => a.F.klaret[o]),
    Object.keys(a.F.klaret).join() + ' efter ' + Math.round(a.t) + ' s');
  tjek(niveau + ' stjerne(r), tryk: et forkert dyr siger selv, hvor det sidder', a.sagt.includes('Nej, jeg sidder mellem de to huse. Brevet skal til kaninen oven på taget.'));
  tjek(niveau + ' stjerne(r), tryk: turen tager under ti minutter', a.t < 600, Math.round(a.t) + ' s');
  tjek(niveau + ' stjerne(r), tryk: Sanne kommer aldrig langt ud over havet', a.fjernest < 300, Math.round(a.fjernest) + '');
  const b = spil(niveau, 'flyv');
  tjek(niveau + ' stjerne(r), flyv selv: alle fem ord, ogsaa under broen og rundt om traeet', b.F.slut && Oe.ORDENE.every(o => b.F.klaret[o]),
    Object.keys(b.F.klaret).join() + ' efter ' + Math.round(b.t) + ' s');
}

/* Havet: holder man fingeren i den forkerte side ude ved kysten, drejer Sanne alligevel hjem */
{
  const F = Flyvning.ny(steder.dyr, { sig: t => ALT_SAGT.add(t) });
  F.nulstil(2);
  F.fugl.x = 0; F.fugl.z = 220; F.fugl.h = 0;   // paa vej ud mod syd
  let fjernest = 0;
  for (let i = 0; i < 30 * 60; i++) {
    const hjem = vinkelForskel(F.fugl.h, Math.atan2(-F.fugl.x, -F.fugl.z));
    F.skridt(1 / 30, { drej: hjem > 0 ? 1 : -1, stig: null });   // altid den forkerte vej
    fjernest = Math.max(fjernest, Math.hypot(F.fugl.x, F.fugl.z));
  }
  tjek('drejer man vaek fra oeen, kommer Sanne alligevel hjem', fjernest < 300 && Math.hypot(F.fugl.x, F.fugl.z) < 290, Math.round(fjernest) + '');
}

/* Stemmen: hver saetning er ét klip, og alt, Himmelvejen siger, kan saettes sammen af dem */
{
  const S = Oe.saetninger(), kendt = {};
  S.forEach(t => { kendt[t] = true; });
  tjek('hver saetning staar én gang', new Set(S).size === S.length);
  const udenKlip = [...ALT_SAGT].filter(t => !Stemme.del(t, kendt));
  tjek('alt, robotterne hoerte, kan siges med klippene (' + ALT_SAGT.size + ' replikker)', ALT_SAGT.size > 10 && udenKlip.length === 0, udenKlip.slice(0, 3).join(' | '));
  const klip = JSON.parse(fs.readFileSync(path.join(ROD, 'lyd', 'klip.json'), 'utf8'));
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const filer = Object.values(klip);
  tjek('klip.json og hvert klip er i service workeren', sw.includes("'games/flyv/lyd/klip.json'") && filer.every(f => fs.existsSync(path.join(ROD, 'lyd', f)) && sw.includes("'games/flyv/lyd/" + f + "'")));
  const gamle = Object.keys(klip).filter(t => !kendt[t]);
  tjek('ingen klip til saetninger, spillet ikke laengere siger', gamle.length === 0, gamle.slice(0, 3).join(' | '));
  const uindtalt = S.filter(t => !klip[t]);
  tjek('alt, Himmelvejen siger, er indtalt (' + filer.length + ' klip)', uindtalt.length === 0, uindtalt.length + ' mangler, fx: ' + uindtalt.slice(0, 3).join(' | '));
}

/* Filerne */
{
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const html = fs.readFileSync(path.join(ROD, 'index.html'), 'utf8');
  const kode = fs.readFileSync(path.join(ROD, 'js', 'game.js'), 'utf8');
  tjek('siden hedder Himmelvejen', html.includes('<title>Himmelvejen</title>') && kode.includes('<h2>Himmelvejen</h2>'));
  tjek('siden henter oeen, flyvningen og spillet', ['js/oe.js', 'js/flyvning.js', 'js/game.js'].every(f => html.includes('src="' + f + '"')));
  const egne = ['', 'index.html', 'js/oe.js', 'js/flyvning.js', 'js/game.js'].map(f => 'games/flyv/' + f);
  tjek('spillets filer er i service workeren', egne.every(f => sw.includes("'" + f + "'")), egne.filter(f => !sw.includes("'" + f + "'")).join());
  const billeder = [...kode.matchAll(/'(\.\.\/[^']+\.png)'/g)].map(m => path.posix.normalize(path.posix.join('games/flyv', m[1])));
  tjek('der er malede billeder med', billeder.length >= 20, billeder.length + ' billeder');
  const mangler = billeder.filter(f => !fs.existsSync(path.join(__dirname, '..', f)) || !sw.includes("'" + f + "'"));
  tjek('alle laante billeder findes og er i service workeren', mangler.length === 0, mangler.join());
  tjek('ingen egne billedfiler: alt er laant eller tegnet i kode', !fs.existsSync(path.join(ROD, 'billeder')));
  const alt = kode + fs.readFileSync(path.join(ROD, 'js', 'oe.js'), 'utf8') + fs.readFileSync(path.join(ROD, 'js', 'flyvning.js'), 'utf8');
  const stemme = fs.readFileSync(path.join(__dirname, '..', 'js', 'stemme.js'), 'utf8');
  tjek('ingen netvaerk: ingen adresser, og kun spillets egne klip hentes', !/https?:\/\//.test(alt + stemme) && !/fetch\(/.test(alt));
  tjek('stemmen er klip eller en stemme, der ligger paa enheden', /localService/.test(stemme) && kode.includes('Stemme.ny(') && html.includes('src="../../js/stemme.js"'));
  const hudKode = kode.slice(kode.indexOf('function tegnHud'), kode.indexOf('function pil('));
  tjek('der er ingen tekst at laese, mens man flyver', hudKode.length > 100 && !/fillText/.test(hudKode));
  tjek('pilen i hjoernet foerer tilbage til menuen', /Skal\.menuKnap\(/.test(kode));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
