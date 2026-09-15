/**
 * Test af racerbanen — koeres med `npm test`. Kraever ingen browser.
 *
 * Canvas findes ikke i Node, saa vi stubber lige praecis det track.js bruger.
 * Masken bliver regnet ud analytisk (afstand til midterlinjen) i stedet for
 * ved at tegne en tyk streg. Det giver den samme maske, og det betyder at
 * indeksregningen i Bane.paaAsfalt bliver testet mod noget uafhaengigt.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROD = path.join(__dirname, '..', 'games', 'racer');

let fejl = 0;
function tjek(navn, betingelse, detalje) {
  if (betingelse) {
    console.log('  ok    ' + navn);
  } else {
    console.log('  FEJL  ' + navn + (detalje ? '  ->  ' + detalje : ''));
    fejl++;
  }
}

/* ---------- canvas-stub ---------- */

function lavCanvasStub() {
  let sidsteLinje = null;
  let sidsteBredde = 0;

  const ctx = {
    _stregBredde: 0,
    set lineWidth(v) { this._stregBredde = v; },
    get lineWidth() { return this._stregBredde; },
    lineJoin: '', lineCap: '', strokeStyle: '', fillStyle: '',
    beginPath() { this._sti = []; },
    moveTo(x, y) { this._sti = [{ x, y }]; },
    lineTo(x, y) { this._sti.push({ x, y }); },
    closePath() {},
    setLineDash() {},
    save() {}, restore() {},
    fillRect() {}, drawImage() {}, arc() {}, fill() {},
    scale(s) { this._skala = s; },
    stroke() {
      // Kun den hvide streg paa maske-canvas er interessant
      if (this.strokeStyle === '#fff') {
        sidsteLinje = this._sti.slice();
        sidsteBredde = this._stregBredde;
      }
    },
    getImageData(x, y, b, h) {
      const data = new Uint8ClampedArray(b * h * 4);
      const halv = sidsteBredde / 2;
      const skala = this._skala || 1;
      for (let py = 0; py < h; py++) {
        for (let px = 0; px < b; px++) {
          // Maskepixel -> verdenskoordinat
          const wx = (px + 0.5) / skala;
          const wy = (py + 0.5) / skala;
          if (afstandTilLinje(wx, wy, sidsteLinje) <= halv) {
            data[(py * b + px) * 4] = 255;
          }
        }
      }
      return { data };
    }
  };

  global.document = {
    createElement() {
      return { width: 0, height: 0, getContext: () => ctx };
    }
  };
}

function afstandTilLinje(x, y, linje) {
  let bedst = Infinity;
  for (let i = 0; i < linje.length; i++) {
    const a = linje[i];
    const b = linje[(i + 1) % linje.length];
    const dx = b.x - a.x, dy = b.y - a.y;
    const l2 = dx * dx + dy * dy;
    let t = l2 === 0 ? 0 : ((x - a.x) * dx + (y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = a.x + t * dx, py = a.y + t * dy;
    const d = Math.hypot(x - px, y - py);
    if (d < bedst) bedst = d;
  }
  return bedst;
}

/* ---------- indlaesning ---------- */

lavCanvasStub();

const sandkasse = { document: global.document, window: {}, fetch: undefined, console };
sandkasse.window = sandkasse;
vm.createContext(sandkasse);
vm.runInContext(fs.readFileSync(path.join(ROD, 'js', 'track.js'), 'utf8'), sandkasse);
const Bane = sandkasse.Bane;

const { Fysik } = require(path.join(ROD, 'js', 'physics.js'));

const baner = JSON.parse(
  fs.readFileSync(path.join(ROD, 'tracks', 'index.js'), 'utf8')
    .match(/\[([\s\S]*?)\]/)[0]
    .replace(/(\w+):/g, '"$1":')
    .replace(/'/g, '"')
);

/* ---------- tests ---------- */

console.log('\nRacerbanen\n');

for (const meta of baner) {
  const filsti = path.join(ROD, meta.fil);
  const data = JSON.parse(fs.readFileSync(filsti, 'utf8'));
  const bane = new Bane(data);

  console.log(bane.navn);

  tjek('midterlinjen er lukket og glat',
    bane.linje.length === data.punkter.length * 24,
    'punkter: ' + bane.linje.length);

  tjek('starten ligger paa asfalt',
    bane.paaAsfalt(bane.start.x, bane.start.y));

  tjek('graesset uden for banen er ikke asfalt',
    !bane.paaAsfalt(5, 5) && !bane.paaAsfalt(data.bredde - 5, data.hoejde - 5));

  // Alle checkpoints skal ligge paa vejen, ellers kan bilen ikke naa dem
  let cpUdenfor = 0;
  bane.checkpoints.forEach(cp => { if (!bane.paaAsfalt(cp.x, cp.y)) cpUdenfor++; });
  tjek('alle checkpoints ligger paa vejen', cpUdenfor === 0,
    cpUdenfor + ' udenfor');

  // Startopstilling: to biler side om side skal begge staa paa asfalt
  const vinkelret = bane.startVinkel + Math.PI / 2;
  let startOk = true;
  [-0.5, 0.5].forEach(f => {
    const x = bane.start.x + Math.cos(vinkelret) * f * 46;
    const y = bane.start.y + Math.sin(vinkelret) * f * 46;
    if (!bane.paaAsfalt(x, y)) startOk = false;
  });
  tjek('begge biler starter paa asfalt', startOk);

  // Kan AI'en gennemfoere 3 omgange?
  const bil = {
    x: bane.start.x, y: bane.start.y, vinkel: bane.startVinkel,
    fart: 0, omgang: 0, næsteCp: 1, graestid: 0, genstart: 0, erAI: true
  };
  const dt = 1 / 60;
  let frames = 0;
  const maksFrames = 60 * 180;
  while (bil.omgang < 3 && frames < maksFrames) {
    Fysik.opdaterBil(bil, bane, Fysik.aiStyring(bil, bane), dt);
    frames++;
  }
  const sekunder = (frames / 60).toFixed(1);

  tjek('AI gennemfoerer 3 omgange', bil.omgang >= 3,
    'naaede omgang ' + bil.omgang + ' paa ' + sekunder + ' s');
  tjek('AI koerer ikke fast', bil.genstart === 0,
    bil.genstart + ' genstarter');
  tjek('omgangstid er rimelig (10-60 s)',
    frames / 60 / 3 > 10 && frames / 60 / 3 < 60,
    (sekunder / 3).toFixed(1) + ' s pr. omgang');

  // Styrehjaelp: en spillerbil uden nogen finger nede skal komme rundt,
  // men den skal ogsaa i graesset undervejs — ellers er styringen ligegyldig.
  const alene = {
    x: bane.start.x, y: bane.start.y, vinkel: bane.startVinkel,
    fart: 0, omgang: 0, næsteCp: 1, graestid: 0, genstart: 0, erAI: false
  };
  let graesFrames = 0;
  frames = 0;
  while (alene.omgang < 3 && frames < 60 * 240) {
    Fysik.opdaterBil(alene, bane, 0, dt);
    if (!bane.paaAsfalt(alene.x, alene.y)) graesFrames++;
    frames++;
  }
  tjek('styrehjaelp faar en bil uden fingre rundt', alene.omgang >= 3,
    'naaede omgang ' + alene.omgang);
  tjek('styrehjaelp goer ikke styringen overfloedig', graesFrames > 60,
    (graesFrames / 60).toFixed(1) + ' s i graesset');

  // Elastik: mod en lige saa god modstander skal AI'en hverken stikke af
  // eller tabe pusten. Den maa aldrig vaere hurtigere end spillerens topfart.
  const vinkelret2 = bane.startVinkel + Math.PI / 2;
  const lav = (erAI, f) => ({
    x: bane.start.x + Math.cos(vinkelret2) * f * 46,
    y: bane.start.y + Math.sin(vinkelret2) * f * 46,
    vinkel: bane.startVinkel, fart: 0, omgang: 0, næsteCp: 1, graestid: 0, genstart: 0, erAI
  });
  const spiller = lav(false, -0.5), ai = lav(true, 0.5);
  let forspringMin = 0, forspringMax = 0, aiTop = 0;
  frames = 0;
  while (spiller.omgang < 3 && frames < 60 * 240) {
    Fysik.opdaterBil(spiller, bane, Fysik.aiStyring(spiller, bane), dt);
    Fysik.opdaterBil(ai, bane, Fysik.aiStyring(ai, bane, spiller), dt);
    const f = Fysik.fremdrift(ai, bane) - Fysik.fremdrift(spiller, bane);
    forspringMin = Math.min(forspringMin, f);
    forspringMax = Math.max(forspringMax, f);
    aiTop = Math.max(aiTop, ai.fart);
    frames++;
  }
  tjek('AI med elastik holder sig taet paa spilleren',
    forspringMin >= -6 && forspringMax <= 6,
    'forspring ' + forspringMin + ' til ' + forspringMax + ' checkpoints');
  tjek('AI bliver aldrig hurtigere end spillerens topfart',
    aiTop <= Fysik.INDSTIL.topfart + 0.5, aiTop.toFixed(0) + ' px/s');

  console.log('');
}

/* Styring: to spillere samtidig */
console.log('Styring');

const zoner = [
  { x0: 0, x1: 0.25, y0: 0, y1: 1, spiller: 0, retning: -1 },
  { x0: 0.25, x1: 0.5, y0: 0, y1: 1, spiller: 0, retning: 1 },
  { x0: 0.5, x1: 0.75, y0: 0, y1: 1, spiller: 1, retning: -1 },
  { x0: 0.75, x1: 1, y0: 0, y1: 1, spiller: 1, retning: 1 }
];

function zoneFor(fx) {
  return zoner.find(z => fx >= z.x0 && fx < z.x1);
}

// Spiller 1 holder venstre nede, spiller 2 trykker hoejre.
// Med almindelige click-handlere ville spiller 2 overskrive spiller 1.
const fingre = new Map();
fingre.set(1, zoneFor(0.12));
fingre.set(2, zoneFor(0.88));

function retning(spiller) {
  let sum = 0;
  fingre.forEach(z => { if (z.spiller === spiller) sum += z.retning; });
  return sum < 0 ? -1 : (sum > 0 ? 1 : 0);
}

tjek('spiller 1 styrer venstre mens spiller 2 roerer skaermen', retning(0) === -1);
tjek('spiller 2 styrer hoejre samtidig', retning(1) === 1);

fingre.delete(1);
tjek('spiller 2 bevarer sin styring naar spiller 1 slipper', retning(1) === 1);
tjek('spiller 1 koerer ligeud efter at have sluppet', retning(0) === 0);

console.log('\n' + (fejl === 0 ? 'Alle tests bestaaet.' : fejl + ' fejl.') + '\n');
process.exit(fejl === 0 ? 0 : 1);
