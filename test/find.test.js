/**
 * Test af Vrimleskoven — koeres med `npm test`. Kraever ingen browser.
 * En robot spiller alle steder paa alle tre stjerner og tjekker, at tingene
 * ligger frit eller paa deres pladser, at alt kan findes, at lookalikes ligger
 * taet paa, og at kategorierne holder.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..', 'games', 'find');
const { Find: F } = require(path.join(ROD, 'js', 'find.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nVrimleskoven\n');

const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
const iFiler = f => sw.includes("'" + (f ? path.posix.normalize(path.posix.join('games/find', f)) : 'games/find/') + "'");
const paaDisk = f => fs.existsSync(path.join(ROD, f));

/* Ordene: billede og stemme til alle */
{
  const alle = F.ALLE;
  tjek('der er mindst 75 ting', alle.length >= 75, alle.length + ' ting');
  const manglerFil = alle.filter(o => !paaDisk(o.fil)).map(o => o.ord);
  tjek('alle billeder findes paa disken', manglerFil.length === 0, 'mangler: ' + manglerFil);
  const ikkeICache = alle.filter(o => !iFiler(o.fil)).map(o => o.ord);
  tjek('alle billeder er med i service workerens FILER', ikkeICache.length === 0, 'mangler: ' + ikkeICache);
  const manglerKlip = alle.filter(o => !paaDisk(o.klip)).map(o => o.ord);
  tjek('alle ord er indtalt', manglerKlip.length === 0, 'mangler: ' + manglerKlip);
  const klipIkkeICache = alle.filter(o => !iFiler(o.klip)).map(o => o.ord);
  tjek('alle ordklip er med i FILER', klipIkkeICache.length === 0, 'mangler: ' + klipIkkeICache);
  Object.keys(F.KLIP).forEach(k => tjek('klippet ' + k + ' findes og er i FILER', paaDisk(F.KLIP[k][0]) && iFiler(F.KLIP[k][0])));
  Object.keys(F.KATEGORIER).forEach(k => tjek('kategoriklippet ' + k + ' findes og er i FILER', paaDisk(F.KATEGORIER[k].klip) && iFiler(F.KATEGORIER[k].klip)));
  const klipJson = JSON.parse(fs.readFileSync(path.join(ROD, 'lyd', 'klip.json'), 'utf8'));
  const mp3 = fs.readdirSync(path.join(ROD, 'lyd')).filter(f => f.endsWith('.mp3')).sort();
  tjek('klip.json svarer til filerne i lyd/', JSON.stringify(klipJson) === JSON.stringify(mp3) && iFiler('lyd/klip.json'));
  tjek('lyd/ har en NOTICE.md', paaDisk('lyd/NOTICE.md'));
}

/* Kategorierne */
{
  const kat = F.KATEGORIER;
  const ukendte = [].concat(...Object.keys(kat).map(k => kat[k].ord.filter(o => !F.ORD[o]).map(o => k + ':' + o)));
  tjek('alle ord i kategorierne findes', ukendte.length === 0, 'ukendte: ' + ukendte);
  tjek('alle kategorier har mindst fem ord', Object.keys(kat).every(k => kat[k].ord.length >= 5));
  tjek('farvekategorierne har en farve, de andre et tegn', Object.keys(kat).every(k => kat[k].ikon === 'farve' ? /^#/.test(kat[k].farve) : ['vinge', 'pote', 'gaffel', 'hjul'].includes(kat[k].ikon)));
  tjek('ingen ord er baade roede og gule', !kat.roede.ord.some(o => kat.gule.ord.includes(o)));
}

/* Lookalikes */
{
  const set = {};
  const dobbelt = [].concat(...F.LIGNER).filter(o => set[o] ? true : (set[o] = 1, false));
  tjek('ingen ting staar i to lookalike-grupper', dobbelt.length === 0, dobbelt.join(','));
  const ukendte = [].concat(...F.LIGNER).filter(o => !F.ORD[o]);
  tjek('alle lookalikes findes', ukendte.length === 0, ukendte.join(','));
  tjek('alle grupper har mindst to', F.LIGNER.every(g => g.length >= 2));
}

/* Stederne */
{
  tjek('der er tre steder: eng, skov og by', F.STEDNAVNE.join(',') === 'eng,skov,by');
  Object.keys(F.STEDER).forEach(s => {
    const st = F.STEDER[s];
    const inden = st.zoner.every(z => z.x >= 0 && z.y >= 0 && z.x + z.b <= 1000 && z.y + z.h <= 600);
    tjek(s + ': zonerne ligger i feltet', inden);
    const areal = st.zoner.reduce((a, z) => a + z.b * z.h, 0);
    tjek(s + ': der er plads nok til 34 ting', areal > 34 * 44 * 44 * 3, Math.round(areal));
    tjek(s + ': skjulene ligger i feltet', st.skjul.every(b => b.x > 0 && b.x < 1000 && b.y > 0 && b.y <= 600));
    tjek(s + ': der er mindst syv pladser', st.pladser.length >= 7, st.pladser.length + ' pladser');
    const udenfor = st.pladser.filter(p => p.x < p.s / 2 || p.x > 1000 - p.s / 2 || p.y < p.s / 2 || p.y > 600 - p.s / 2);
    tjek(s + ': pladserne ligger i feltet', udenfor.length === 0, udenfor.map(p => p.type).join(','));
    const klipForkert = st.pladser.filter(p => p.klip && !(p.x >= p.klip.x && p.x <= p.klip.x + p.klip.b && p.y >= p.klip.y && p.y <= p.klip.y + p.klip.h));
    tjek(s + ': pladser med klip ligger inden i deres klip', klipForkert.length === 0);
    tjek(s + ': pladser bag eller paa et skjul peger paa et skjul, der findes', st.pladser.every(p => (p.bag === undefined || st.skjul[p.bag]) && (p.paa === undefined || st.skjul[p.paa])));
    const tætte = [];
    const fod = p => Math.min(p.s * F.PLADS_FAKTOR[0], p.klip ? p.klip.b : 999);
    st.pladser.forEach((p, i) => st.pladser.forEach((q, j) => { if (j > i && Math.hypot(p.x - q.x, p.y - q.y) < (fod(p) + fod(q)) / 2 * 1.1) tætte.push(p.type + '/' + q.type); }));
    tjek(s + ': to pladser ligger aldrig saa taet, at tingene overlapper', tætte.length === 0, tætte.join(' '));
  });
  const by = F.STEDER.by;
  tjek('byens huse har vinduer og en doer som pladser', by.huse.reduce((a, h) => a + h.vind + 1, 0) === by.pladser.filter(p => p.type === 'vindue' || p.type === 'doer').length);
  tjek('husene i byen staar over gaden, ikke i zonerne', by.huse.every(h => by.zoner.every(z => h.y + h.h <= z.y)));
}

/* Robotten spiller alle steder paa alle tre stjerner, med én og to spillere */
{
  let problemer = [], bag = 0, paaPlads = 0, alleTing = 0, enkelt3 = 0, udenLookalike = 0;
  F.STEDNAVNE.forEach(sted => {
    for (let s = 0; s < 3; s++) for (let sp = 1; sp <= 2; sp++) for (let runde = 0; runde < 15; runde++) {
      const o = F.nyOmgang(sted, s, sp), navn = sted + '/' + (s + 1) + '*/' + sp;
      const st = F.STEDER[sted], str = F.STR[s];
      if (o.ting.length < F.ANTAL[s] - 2) problemer.push(navn + ': kun ' + o.ting.length + ' ting');
      if (new Set(o.ting.map(t => t.ord)).size !== o.ting.length) problemer.push(navn + ': samme ting to gange');
      const brugtePladser = new Set();
      o.ting.forEach((t, i) => {
        alleTing++; if (t.bag) bag++;
        if (t.x < t.str / 2 || t.x > 1000 - t.str / 2 || t.y < t.str / 2 || t.y > 600 - t.str / 2) problemer.push(navn + ': ' + t.ord + ' uden for feltet');
        if (t.bag && !(t.skjul >= 0 && t.skjul < st.skjul.length)) problemer.push(navn + ': ' + t.ord + ' bag et skjul, der ikke findes');
        if (t.plads >= 0) {
          // Paa en plads: praecis dér, én ting pr. plads, klippet som pladsen
          paaPlads++;
          const p = st.pladser[t.plads];
          if (!p) problemer.push(navn + ': ' + t.ord + ' paa en plads, der ikke findes');
          else {
            if (brugtePladser.has(t.plads)) problemer.push(navn + ': to ting paa plads ' + t.plads); brugtePladser.add(t.plads);
            if (t.x !== p.x || t.y !== p.y) problemer.push(navn + ': ' + t.ord + ' ligger ikke paa sin plads');
            if (Math.abs(t.str - p.s * F.PLADS_FAKTOR[s]) > 1) problemer.push(navn + ': ' + t.ord + ' har forkert stoerrelse paa pladsen');
            if ((p.klip || null) !== t.klip) problemer.push(navn + ': ' + t.ord + ' har ikke pladsens klip');
            if ((p.bag !== undefined) !== t.bag || (p.bag !== undefined && t.skjul !== p.bag)) problemer.push(navn + ': ' + t.ord + ' ligger ikke bag pladsens skjul');
            if ((p.paa !== undefined ? p.paa : -1) !== t.paa) problemer.push(navn + ': ' + t.ord + ' ligger ikke paa pladsens skjul');
          }
        } else {
          // Loes: i zonerne, uden for det optagne, med dybde, og aldrig helt bag et skjul
          if (!st.zoner.some(z => t.x >= z.x - 1 && t.x <= z.x + z.b + 1 && t.y >= z.y - 1 && t.y <= z.y + z.h + 1)) problemer.push(navn + ': ' + t.ord + ' uden for zonerne');
          if (st.optaget.some(k => t.x > k.x && t.x < k.x + k.b && t.y > k.y && t.y < k.y + k.h)) problemer.push(navn + ': ' + t.ord + ' ligger paa noget optaget');
          if (Math.abs(t.str - str * F.skala(t.y)) > 1) problemer.push(navn + ': ' + t.ord + ' har forkert dybde');
          st.skjul.forEach(b => { if (F.skjulAfstand(b, t.x, t.y) < 0.93) problemer.push(navn + ': ' + t.ord + ' helt bag et skjul'); });
          st.skjul.forEach(b => { if (F.bagStamme(b, t.x, t.y)) problemer.push(navn + ': ' + t.ord + ' bag en stamme'); });
          if (t.bag && (F.skjulAfstand(st.skjul[t.skjul], t.x, t.y) > 1.25 || t.klip)) problemer.push(navn + ': ' + t.ord + ' skulle vaere halvt bag et skjul');
        }
        for (let j = i + 1; j < o.ting.length; j++) if (F.afstand(t.x, t.y, o.ting[j].x, o.ting[j].y) < (F.fod(t) + F.fod(o.ting[j])) / 2 * 1.1) problemer.push(navn + ': ' + t.ord + ' oven i ' + o.ting[j].ord);
      });
      const iBilledet = new Set(o.ting.map(t => t.ord));
      if (o.spillere.length !== sp) problemer.push(navn + ': ' + o.spillere.length + ' spillere');
      const enkelt = [];
      o.spillere.forEach((spiller, p) => {
        if (spiller.spoergsmaal.length !== F.OMGANG) problemer.push(navn + ': ' + spiller.spoergsmaal.length + ' spoergsmaal');
        spiller.spoergsmaal.forEach((q, i) => {
          if (q.type === 'ord') {
            if (!iBilledet.has(q.ord)) problemer.push(navn + ': ' + q.ord + ' er ikke i billedet');
            enkelt.push(q.ord);
            if (F.tryk(o, p, 'xylofon') !== 'forkert') problemer.push(navn + ': forkert ting taeller');
            if (s === 2) {
              // Ved tre stjerner ligger en lookalike taet ved: tigeren ved katten
              enkelt3++;
              const t = o.ting.find(x => x.ord === q.ord), g = F.LIGNER_AF[q.ord] || [];
              if (!o.ting.some(x => x !== t && g.includes(x.ord) && Math.hypot(x.x - t.x, x.y - t.y) <= F.NAER)) udenLookalike++;
            }
          } else {
            if (s !== 2) problemer.push(navn + ': kategori ved ' + (s + 1) + ' stjerner');
            if (!F.KATEGORI_VED.includes(i)) problemer.push(navn + ': kategori paa plads ' + i);
            if (q.ord.length < 2 || q.ord.length > 4) problemer.push(navn + ': ' + q.kategori + ' har ' + q.ord.length + ' i billedet');
            const alleMedl = o.ting.filter(t => F.KATEGORIER[q.kategori].ord.includes(t.ord)).map(t => t.ord);
            if (alleMedl.length !== q.ord.length) problemer.push(navn + ': ' + q.kategori + ' mangler ' + (alleMedl.length - q.ord.length) + ' medlemmer');
          }
        });
      });
      if (new Set(enkelt).size !== enkelt.length) problemer.push(navn + ': samme enkeltord to gange');
      // Spil omgangen igennem: hvert svar er rigtigt, og til sidst er der ikke flere
      o.spillere.forEach((spiller, p) => {
        let mere = true, n = 0;
        while (mere && n++ < 20) {
          const q = spiller.spoergsmaal[spiller.i];
          if (q.type === 'ord') { if (F.tryk(o, p, q.ord) !== 'rigtig') problemer.push(navn + ': rigtigt svar afvist'); }
          else {
            q.ord.forEach((m, k) => { const r = F.tryk(o, p, m); const skal = k === q.ord.length - 1 ? 'alle' : 'rigtig'; if (r !== skal) problemer.push(navn + ': kategori-svar gav ' + r); });
            if (F.tryk(o, p, q.ord[0]) !== 'allerede') problemer.push(navn + ': fundet igen gav ikke allerede');
          }
          mere = F.naeste(o, p);
        }
        if (n !== F.OMGANG) problemer.push(navn + ': omgangen havde ' + n + ' spoergsmaal');
        if (F.tryk(o, p, 'kat') !== 'faerdig') problemer.push(navn + ': tryk efter slut');
      });
    }
  });
  tjek('robotten kan spille alle steder paa alle stjerner: alt kan findes, intet ligger oven i hinanden', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  tjek('cirka hver fjerde ting ligger halvt bag et skjul', bag / alleTing > 0.15 && bag / alleTing < 0.45, Math.round(bag / alleTing * 100) + ' %');
  tjek('cirka hver tredje ting sidder paa en plads: i et vindue, paa baenken, i et trae', paaPlads / alleTing > 0.2 && paaPlads / alleTing < 0.5, Math.round(paaPlads / alleTing * 100) + ' %');
  tjek('ved tre stjerner ligger der en lookalike taet ved hver ting, der spoerges om', udenLookalike === 0, udenLookalike + ' af ' + enkelt3 + ' uden');
  // Dybden: tingene bagest er mindre end forrest, og de er fordelt over hele hoejden
  const loese = [].concat(...[0, 1, 2, 3, 4].map(() => F.nyOmgang('eng', 1, 1).ting.filter(t => t.plads < 0)));
  const oev = loese.filter(t => t.y < 230), ned = loese.filter(t => t.y > 400);
  tjek('der ligger ting baade bagest og forrest', oev.length >= 12 && ned.length >= 12, oev.length + ' bagest, ' + ned.length + ' forrest af ' + loese.length);
  tjek('tingene bagest er mindre end tingene forrest', Math.max(...oev.map(t => t.str)) < Math.min(...ned.map(t => t.str)));
  tjek('ukendt sted falder tilbage til det foerste', F.nyOmgang('maanen', 0, 1).sted === F.STEDNAVNE[0]);
}

/* Fingeren: alt, der kan ses, kan trykkes paa, og trykket rammer det, man ser oeverst */
{
  // Feltet paa en iPad (1024 x 768) og en stor iPad (1180 x 820), som i game.js
  const proj = (B, H) => ({ fx: X => X / 1000 * B, fy: Y => H * 0.4 + Y / 600 * H * 0.6, fs: S => S / 1000 * B, fh: S => S / 600 * H * 0.6 });
  const skaerme = [proj(1024, 768), proj(1180, 820)];
  tjek('LODRET passer til en iPad paa tvaers', Math.abs(F.LODRET - 768 / 1024) < 0.01);
  let problemer = [], smaa = 0, alle = 0, andel = 0;
  F.STEDNAVNE.forEach(sted => {
    for (let s = 0; s < 3; s++) for (let runde = 0; runde < 12; runde++) {
      const o = F.nyOmgang(sted, s, 1), navn = sted + '/' + (s + 1) + '*';
      skaerme.forEach(p => {
        o.ting.forEach(t => {
          // Proev fingeren i et gitter over tingen: hvor stor en del af den, der rammer den
          const r = p.fs(t.str) * 0.46, cx = p.fx(t.x), cy = p.fy(t.y) + (t.klip ? p.fs(t.str) * 0.12 : 0);
          let ser = 0, rammer = 0;
          for (let gx = -1; gx <= 1; gx += 0.2) for (let gy = -1; gy <= 1; gy += 0.2) {
            const x = cx + gx * r, y = cy + gy * r;
            if (!F.serTing(t, x, y, p)) continue;
            ser++;
            const hit = F.rammer(o, sted, x, y, p);
            if (hit === t) rammer++;
          }
          alle++;
          const a = ser ? rammer / ser : 0; andel += a;
          if (a < 0.4) { smaa++; if (a < 0.2) problemer.push(navn + ': ' + t.ord + ' kan kun rammes paa ' + Math.round(a * 100) + ' %'); }
        });
      });
      // Midt i et tomt stykke jord rammes intet
      const p = skaerme[0];
      for (let n = 0; n < 40; n++) {
        const X = Math.random() * 1000, Y = Math.random() * 600, x = p.fx(X), y = p.fy(Y);
        const hit = F.rammer(o, sted, x, y, p);
        if (hit && Math.hypot(x - p.fx(hit.x), y - p.fy(hit.y)) > p.fs(hit.str) * 0.62) problemer.push(navn + ': et tryk langt fra ' + hit.ord + ' ramte den');
      }
    }
  });
  tjek('hver ting kan rammes paa mindst en femtedel af det, man ser af den', problemer.length === 0, problemer.slice(0, 5).join(' | '));
  tjek('naesten alle ting kan rammes paa det meste af sig selv', smaa / alle < 0.03, smaa + ' af ' + alle + ' under 40 %, gennemsnit ' + Math.round(andel / alle * 100) + ' %');

  // Et lille, fast eksempel: katten staar lige bag hunden. Trykket paa hundens midte giver hunden,
  // trykket paa kattens synlige top giver katten, ikke hunden, som den gamle maade gjorde
  const p = skaerme[0], st = F.STEDER.eng;
  const kat = { ord: 'kat', x: 500, y: 300, str: 80, plads: -1, klip: null, bag: false, skjul: -1, paa: -1 };
  const hund = { ord: 'hund', x: 500, y: 340, str: 80, plads: -1, klip: null, bag: false, skjul: -1, paa: -1 };
  const o = { ting: [kat, hund], spillere: [] };
  tjek('hunden foran rammes paa sin midte', F.rammer(o, 'eng', p.fx(500), p.fy(340), p) === hund);
  tjek('katten bagved rammes paa det, der stikker op', F.rammer(o, 'eng', p.fx(500), p.fy(300) - p.fs(80) * 0.4, p) === kat);
  tjek('lagene tegnes i samme raekkefoelge, som trykket bruger', F.lagOrden(o, 'eng').filter(l => l.ting).map(l => l.ting.ord).join(',') === 'kat,hund' && st.skjul.length > 0);
}

/* De malede stykker i byen */
{
  const mappe = path.join(ROD, 'billeder');
  const png = fs.readdirSync(mappe).filter(f => f.endsWith('.png')).sort();
  tjek('byen har seks malede stykker', png.join(',') === 'baenk.png,bod.png,broend.png,hus1.png,hus2.png,hus3.png', png.join(','));
  const store = png.filter(f => fs.statSync(path.join(mappe, f)).size > 40 * 1024);
  tjek('ingen af dem fylder over 40 KB', store.length === 0, store.join(','));
  const ikkeICache = png.filter(f => !iFiler('billeder/' + f));
  tjek('alle malede stykker er med i FILER', ikkeICache.length === 0, ikkeICache.join(','));
  tjek('billeder/ har en NOTICE.md', paaDisk('billeder/NOTICE.md'));
  const game = fs.readFileSync(path.join(ROD, 'js', 'game.js'), 'utf8');
  tjek('skaermen henter dem fra billeder/', png.every(f => game.includes("'" + f.replace('.png', '') + "'")) && game.includes("'billeder/'"));
}

/* Siden og service workeren */
{
  const html = fs.readFileSync(path.join(ROD, 'index.html'), 'utf8');
  tjek('siden henter Bogstavvejens ting.js foer find.js', html.indexOf('../bogstaver/js/ting.js') < html.indexOf('js/find.js') && html.includes('js/game.js'));
  tjek('siden har titlen Vrimleskoven', html.includes('<title>Vrimleskoven</title>'));
  ['', 'index.html', 'js/find.js', 'js/game.js'].forEach(f => tjek("'games/find/" + f + "' staar i FILER", iFiler(f)));
  const games = fs.readFileSync(path.join(__dirname, '..', 'js', 'games.js'), 'utf8');
  tjek('forsiden har Vrimleskoven', /navn:\s*'Vrimleskoven'/.test(games) && games.includes("sti: 'games/find/'"));
}

console.log('\n' + (fejl ? fejl + ' fejl' : 'Alle tests bestaaet.'));
process.exit(fejl ? 1 : 0);
