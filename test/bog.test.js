/**
 * Test af Bogen om Noeddeskoven — koeres med `npm test`. Kraever ingen browser.
 * Tjekker de ti opslag (sted, spil, navne, tekst, rim, noegle og skade inden for
 * billedet), at alle laante billeder findes, at hver scene kan tegnes uden
 * fejl og laegger noeglen, hvor teksten siger, og at bogen er med paa forsiden
 * og i service workeren.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const ROD = path.join(__dirname, '..');
const BOG = path.join(ROD, 'bog');
const { Bog } = require(path.join(BOG, 'js', 'bog.js'));

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) console.log('  ok    ' + navn);
  else { console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : '')); fejl++; }
}

console.log('\nBogen om Nøddeskoven\n');

const O = Bog.OPSLAG, W = Bog.BREDDE, H = Bog.HOEJDE;

/* Opslagene */
{
  tjek('bogen har ti opslag', O.length === 10, O.length + ' opslag');
  const ids = O.map(o => o.id);
  tjek('alle opslag har hvert sit id', new Set(ids).size === ids.length);
  const spil = [...fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8').matchAll(/sti:\s*'(games\/[^']+)'/g)].map(m => m[1]);
  tjek('opslagene besoeger alle ti spil, hvert én gang', spil.length === 10 && spil.every(s => O.filter(o => o.spil === s).length === 1), O.map(o => o.spil).join());
  tjek('historien begynder i Noeddeskoven og ender i Skovkoekkenet', O[0].id === 'noeddeskoven' && O[9].id === 'skovkoekkenet');
  const stedForkert = O.filter(o => {
    const html = fs.readFileSync(path.join(ROD, o.spil, 'index.html'), 'utf8');
    return !html.includes('<title>' + o.sted + '</title>');
  }).map(o => o.id);
  tjek('hvert opslags sted hedder det samme som spillet', stedForkert.length === 0, stedForkert.join());
  const ukendt = O.flatMap(o => o.moeder.filter(n => !Bog.NAVNE[n]));
  tjek('alle, Pelle moeder, har et navn', ukendt.length === 0, ukendt.join());
  const ikkeNaevnt = O.flatMap(o => o.moeder.filter(n => !o.tekst.join(' ').includes(Bog.NAVNE[n].split(' ').pop())));
  tjek('den, Pelle moeder, naevnes i opslagets tekst', ikkeNaevnt.length === 0, ikkeNaevnt.join());
  tjek('hvert opslag har tre stykker tekst og to rimlinjer', O.every(o => o.tekst.length === 3 && o.rim.length === 2 && o.tekst.every(t => t.length > 20)));
  tjek('ingen tekst er laengere end en side kan baere', O.every(o => o.tekst.join(' ').length <= 420), O.map(o => o.tekst.join(' ').length).join());
  tjek('hvert opslag siger "Besoeg mig/os ..." i stedet for en knap', O.every(o => /^Besøg (mig|os) (i|på|ved) .+\.$/.test(o.besoeg)));
  tjek('teksten naevner ikke spillets knapper', O.every(o => !/tryk|knap|spil med/i.test(o.tekst.join(' '))));
  const noegleUde = O.filter(o => o.noegle.x < 20 || o.noegle.x > W - 20 || o.noegle.y < 20 || o.noegle.y > H - 20 || o.noegle.s < 14 || o.noegle.s > 40).map(o => o.id);
  tjek('noeglen ligger inden for billedet paa hvert opslag og er lille', noegleUde.length === 0, noegleUde.join());
  const skadeUde = O.filter(o => o.skade && (o.skade.x < 0 || o.skade.x > W || o.skade.y < 0 || o.skade.y > H)).map(o => o.id);
  tjek('skaden er inden for billedet, hvor hun er med', skadeUde.length === 0, skadeUde.join());
  tjek('skaden er med paa foerste og sidste opslag', !!(O[0].skade && O[9].skade));
  tjek('sidste opslag naevner alle vennerne', ['Rikke', 'Klaus', 'Klara', 'Emil', 'Ella', 'Ulla', 'Bo', 'Kaja', 'Rasmus', 'Milo', 'Gustav'].every(n => O[9].tekst.join(' ').includes(n)));
  tjek('Klaus er roed og Klara er blaa', /Klaus er rød, Klara er blå/.test(O[2].tekst.join(' ')));
}

/* Scenerne: tegnes i et lærred, der husker, hvad der sker */
{
  const hentet = [];
  const stub = {
    Image: function () { const i = { complete: true, naturalWidth: 100, naturalHeight: 120, addEventListener() {} }; Object.defineProperty(i, 'src', { set(v) { hentet.push(v); } }); return i; }
  };
  global.window = stub; global.Image = stub.Image;
  require(path.join(BOG, 'js', 'scener.js'));
  const S = stub.Scener;
  tjek('scener.js melder sig som window.Scener', !!(S && S.tegnOpslag && S.tegnForside && S.hentAlle));
  const manglerBillede = Object.keys(S.BILLEDER).filter(n => !fs.existsSync(path.join(BOG, S.BILLEDER[n])));
  tjek('alle billeder, bogen laaner, findes paa disken', manglerBillede.length === 0, manglerBillede.join());
  const skade = path.join(BOG, 'billeder', 'skade.png');
  tjek('skaden er bogens eget billede med NOTICE ved siden af', fs.existsSync(skade) && fs.existsSync(path.join(BOG, 'billeder', 'NOTICE.md')) && fs.statSync(skade).size < 60 * 1024);

  /* Et lærred, der tager imod alt og husker translate-kaldene i verdens-koordinater */
  function laerred() {
    const kald = { translate: [], drawImage: [], text: [] };
    let stak = [], nu = [0, 0];
    const c = new Proxy({}, {
      get(_, navn) {
        if (navn === 'kald') return kald;
        if (navn === 'save') return () => { stak.push(nu.slice()); };
        if (navn === 'restore') return () => { nu = stak.pop() || [0, 0]; };
        if (navn === 'translate') return (x, y) => { nu = [nu[0] + x, nu[1] + y]; kald.translate.push([nu[0], nu[1]]); };
        if (navn === 'drawImage') return (...a) => { kald.drawImage.push(a); };
        if (navn === 'fillText') return (t) => { kald.text.push(t); };
        if (navn === 'createLinearGradient' || navn === 'createRadialGradient') return () => ({ addColorStop() {} });
        if (navn === 'measureText') return () => ({ width: 10 });
        return () => {};
      },
      set() { return true; }
    });
    return c;
  }
  S.hentAlle(null);
  tjek('bogen henter alle billeder én gang', hentet.length === Object.keys(S.BILLEDER).length, hentet.length + ' hentet');
  const fejlede = [], udenNoegle = [], udenPelle = [];
  O.forEach(o => {
    const c = laerred();
    try { S.tegnOpslag(c, o); } catch (e) { fejlede.push(o.id + ': ' + e.message); return; }
    const ramt = c.kald.translate.some(p => Math.abs(p[0] - o.noegle.x) < 0.5 && Math.abs(p[1] - o.noegle.y) < 0.5);
    if (!ramt) udenNoegle.push(o.id);
    if (c.kald.drawImage.length < 2) udenPelle.push(o.id);
  });
  tjek('alle ti scener kan tegnes uden fejl', fejlede.length === 0, fejlede.join('; '));
  tjek('noeglen tegnes praecis dér, hvor opslaget siger', udenNoegle.length === 0, udenNoegle.join());
  tjek('hver scene bruger spillenes malede billeder', udenPelle.length === 0, udenPelle.join());
  const f = laerred(); let forsideOk = true;
  try { S.tegnForside(f); } catch (e) { forsideOk = false; }
  tjek('forsiden kan tegnes', forsideOk && f.kald.drawImage.length >= 2);
  tjek('bogens tekst skrives af siden, ikke i billedet', O.every(o => { const c = laerred(); S.tegnOpslag(c, o); return !c.kald.text.some(t => t.length > 3); }));
}

/* Skaermen, forsiden og service workeren */
{
  const html = fs.readFileSync(path.join(BOG, 'index.html'), 'utf8');
  const game = fs.readFileSync(path.join(BOG, 'js', 'game.js'), 'utf8');
  tjek('siden hedder det samme som bogen', html.includes('<title>' + Bog.TITEL + '</title>'));
  tjek('siden har skallen med hjem-knappen og bogens egen menu', html.includes('js/skal.js') && game.includes('Skal.menuKnap('));
  tjek('siden peger hjem paa forsiden (én mappe op)', game.includes("hjem.href = '../'"));
  tjek('bogen kan printes som A4 paa tvaers', /@page\{size:A4 landscape/.test(html) && game.includes('window.print()'));
  tjek('bogen laeser hoejt med klip eller enhedens egen stemme', game.includes("'lyd/' + o.id + '.mp3'") && game.includes('localService'));
  tjek('bogen bruger Vrimleskovens "du fandt den"', game.includes('../games/find/lyd/du_fandt_den.mp3') && fs.existsSync(path.join(ROD, 'games', 'find', 'lyd', 'du_fandt_den.mp3')));
  tjek('bogen gemmer intet i browseren', !/localStorage|sessionStorage|indexedDB|document\.cookie/.test(game));
  tjek('ingen netvaerkskald ud af huset', !/https?:\/\//.test(game + fs.readFileSync(path.join(BOG, 'js', 'scener.js'), 'utf8')));
  const klip = JSON.parse(fs.readFileSync(path.join(BOG, 'lyd', 'klip.json'), 'utf8'));
  const klipMangler = klip.filter(k => !fs.existsSync(path.join(BOG, 'lyd', k)));
  tjek('alle klip i lyd/klip.json findes', Array.isArray(klip) && klipMangler.length === 0, klipMangler.join());
  const sw = fs.readFileSync(path.join(ROD, 'sw.js'), 'utf8');
  const iFiler = ['bog/', 'bog/index.html', 'bog/js/bog.js', 'bog/js/scener.js', 'bog/js/game.js', 'bog/billeder/skade.png', 'bog/lyd/klip.json'].concat(klip.map(k => 'bog/lyd/' + k));
  const udenFiler = iFiler.filter(f => !sw.includes("'" + f + "'"));
  tjek('bogens filer er med i service workerens FILER', udenFiler.length === 0, udenFiler.join());
  const games = fs.readFileSync(path.join(ROD, 'js', 'games.js'), 'utf8');
  tjek('forsiden har bogen foerst', /window\.SPIL = \[\s*\{\s*id: 'bog'/.test(games) && games.includes("sti: 'bog/'"));
}

console.log('\n' + (fejl ? fejl + ' fejl' : 'Alle tests bestaaet.'));
process.exit(fejl ? 1 : 0);
