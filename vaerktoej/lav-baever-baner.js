/**
 * Finder banerne til Bæverdammen (games/baever/js/daemning.js).
 *
 *   node vaerktoej/lav-baever-baner.js [antal pr. stjerne]
 *
 * Der laegges tilfaeldige stammer paa pladsen. Saa findes alle stillinger, de
 * kan skubbes til, og hvor mange traek hver af dem er fra at vaere loest (alle
 * traek kan goeres om, saa det er en bredde-foerst-soegning fra de loeste
 * stillinger). En stilling med det rigtige antal traek bliver en bane. Til sidst
 * skrives listen, der kan saettes ind som BANER i daemning.js.
 */
'use strict';
const { Daemning: D } = require('../games/baever/js/daemning.js');
const N = D.N, ANTAL = +(process.argv[2] || 12);

const STAMMER = [[3, 5], [6, 8], [8, 11]];      // andre stammer end Bodils ved 1, 2 og 3 stjerner

function tilfaeldig(antal) {
  const p = { stammer: [{ x: Math.floor(Math.random() * 3), y: D.UD_RAEKKE, len: 2, lodret: false, maal: true }] };
  let forsoeg = 0;
  while (p.stammer.length < antal + 1 && forsoeg++ < 400) {
    const len = Math.random() < 0.7 ? 2 : 3, lodret = Math.random() < 0.55;
    const x = Math.floor(Math.random() * (lodret ? N : N - len + 1)), y = Math.floor(Math.random() * (lodret ? N - len + 1 : N));
    if (!lodret && y === D.UD_RAEKKE) continue;       // en stamme paa tvaers i Bodils raekke kan aldrig komme af vejen
    const s = { x, y, len, lodret, maal: false };
    const o = new Set();
    p.stammer.forEach(t => { for (let k = 0; k < t.len; k++) o.add((t.y + (t.lodret ? k : 0)) * N + t.x + (t.lodret ? 0 : k)); });
    let fri = true;
    for (let k = 0; k < len; k++) if (o.has((y + (lodret ? k : 0)) * N + x + (lodret ? 0 : k))) fri = false;
    if (fri) p.stammer.push(s);
  }
  return p;
}

/** Alle stillinger, stammerne kan skubbes til, med antal traek til loest. */
function afstande(start) {
  const stillinger = new Map(), koe = [start];
  stillinger.set(D.noegle(start), { p: start, d: -1 });
  for (let i = 0; i < koe.length && koe.length < 80000; i++) {
    D.traek(koe[i]).forEach(t => {
      const n = D.kopi(koe[i]); D.saet(n, t);
      const k = D.noegle(n);
      if (!stillinger.has(k)) { stillinger.set(k, { p: n, d: -1 }); koe.push(n); }
    });
  }
  const bfs = [];
  stillinger.forEach(v => { if (D.loest(v.p)) { v.d = 0; bfs.push(v); } });
  for (let i = 0; i < bfs.length; i++) {
    D.traek(bfs[i].p).forEach(t => {
      const n = D.kopi(bfs[i].p); D.saet(n, t);
      const v = stillinger.get(D.noegle(n));
      if (v && v.d < 0) { v.d = bfs[i].d + 1; bfs.push(v); }
    });
  }
  return [...stillinger.values()];
}

const ud = [[], [], []], set = new Set();
for (let s = 0; s < 3; s++) {
  const [lo, hi] = D.TRAEK[s];
  // Spred banerne jaevnt over antallet af traek
  const oensket = []; for (let i = 0; i < ANTAL; i++) oensket.push(lo + Math.floor(i * (hi - lo + 1) / ANTAL));
  oensket.forEach(maal => {
    for (let forsoeg = 0; forsoeg < 4000; forsoeg++) {
      const [a, b] = STAMMER[s], p = tilfaeldig(a + Math.floor(Math.random() * (b - a + 1)));
      const kandidater = afstande(p).filter(v => v.d === maal && v.p.stammer[0].x <= 2);
      if (!kandidater.length) continue;
      const v = kandidater[Math.floor(Math.random() * kandidater.length)];
      const t = D.tekst(v.p);
      if (set.has(t)) continue;
      // Kontrol: loeseren i spillet er enig
      if (D.loes(D.lav(t)).length !== maal) throw new Error('uenig om ' + t);
      set.add(t); ud[s].push({ bane: t, traek: maal });
      break;
    }
  });
}
console.log('  var BANER = [');
ud.forEach((l, s) => console.log('    [' + l.map(b => "\n      { bane: '" + b.bane + "', traek: " + b.traek + ' }').join(',') + '\n    ]' + (s < 2 ? ',' : '')));
console.log('  ];');
