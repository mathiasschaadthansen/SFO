/**
 * Tegn og pusl uden browser: alle figurer kan tegnes af en finger der foelger
 * stregen, og puslespillet kan samles paa alle tre stjerner.
 */
const path = require('path');
const fs = require('fs');
const { Spor } = require('../games/bogstaver/js/spor.js');
const { Figurer } = require('../games/tegn/js/figurer.js');
const { Pusle } = require('../games/tegn/js/pusle.js');

let fejl = 0;
function tjek(navn, ok, ekstra) {
  console.log((ok ? '  ok    ' : '  FEJL  ') + navn + (ok || !ekstra ? '' : '  (' + ekstra + ')'));
  if (!ok) fejl++;
}

const TOLERANCE = [15, 12, 10];      // samme tal som game.js

function tegnFigur(figur, tolerance, skaevX, skaevY, spring) {
  const glyf = Figurer.glyf(figur);
  const spor = new Spor(glyf, tolerance);
  let vagt = 0;
  while (!spor.faerdig && vagt++ < 50) {
    const streg = spor.streger[spor.aktiv];
    const start = spor.naeste();
    const aktiv = spor.aktiv;
    // En kort streg kan blive faerdig allerede i start(); det taeller som tegnet
    if (!spor.start(start[0] + skaevX, start[1] + skaevY) && spor.aktiv === aktiv && !spor.faerdig) return 'kunne ikke starte streg ' + spor.aktiv;
    for (let k = spor.indeks; k < streg.length && spor.aktiv === aktiv && !spor.faerdig; k += spring) {
      spor.flyt(streg[k][0] + skaevX, streg[k][1] + skaevY);
    }
    if (spor.aktiv === aktiv && !spor.faerdig) spor.flyt(streg[streg.length - 1][0] + skaevX, streg[streg.length - 1][1] + skaevY);
    spor.slip();
  }
  return spor.faerdig ? null : 'blev ikke faerdig, stod paa streg ' + spor.aktiv + ' punkt ' + spor.indeks;
}

console.log('\nTegn og pusl\n');

{
  const alle = [];
  Figurer.UNIVERSER.forEach(u => u.figurer.forEach(f => alle.push(f)));
  tjek('fire universer med fire figurer hver', Figurer.UNIVERSER.length === 4 && Figurer.UNIVERSER.every(u => u.figurer.length === 4));
  tjek('alle figurer har unikt id uden ae, oe, aa', new Set(alle.map(f => f.id)).size === alle.length && alle.every(f => /^[a-z]+$/.test(f.id)));

  const udenfor = [];
  alle.forEach(f => f.dele.forEach(d => d.sti.forEach(p => { if (p[0] < 1 || p[0] > 99 || p[1] < 1 || p[1] > 99) udenfor.push(f.id); })));
  tjek('alle punkter ligger inden for kassen', udenfor.length === 0, [...new Set(udenfor)].join(', '));

  const mange = alle.filter(f => Figurer.glyf(f).streger.length > 7).map(f => f.id);
  tjek('ingen figur har mere end 7 streger der skal tegnes', mange.length === 0, mange.join(', '));

  const korte = [];
  alle.forEach(f => Figurer.glyf(f).streger.forEach((s, i) => { let l = 0; for (let k = 1; k < s.length; k++) l += Math.hypot(s[k][0] - s[k - 1][0], s[k][1] - s[k - 1][1]); if (l < 12) korte.push(f.id + ':' + i); }));
  tjek('ingen streg er for kort til en finger', korte.length === 0, korte.join(', '));

  TOLERANCE.forEach((t, n) => {
    const d = alle.map(f => [f.id, tegnFigur(f, t, 0, 0, 1)]).filter(x => x[1]);
    tjek((n + 1) + ' stjerne(r): alle figurer kan tegnes af en praecis finger', d.length === 0, d.map(x => x.join(': ')).join('; '));
    const s = alle.map(f => [f.id, tegnFigur(f, t, t * 0.4, -t * 0.3, 1)]).filter(x => x[1]);
    tjek((n + 1) + ' stjerne(r): ... og af en skaev finger', s.length === 0, s.map(x => x.join(': ')).join('; '));
    const h = alle.map(f => [f.id, tegnFigur(f, t, 0, 0, 3)]).filter(x => x[1]);
    tjek((n + 1) + ' stjerne(r): ... og af en hurtig finger', h.length === 0, h.map(x => x.join(': ')).join('; '));
  });
}

{
  const pladser = [[-30, 10], [-30, 40], [-30, 70], [-30, 95], [130, 10], [130, 40], [130, 70], [130, 95], [-30, 55]];
  [0, 1, 2].forEach(niveau => {
    const spil = Pusle.nyt(niveau, pladser);
    const g = Pusle.INDSTIL.gitter[niveau];
    tjek((niveau + 1) + ' stjerne(r): ' + g[0] * g[1] + ' brikker, alle starter uden for deres hjem',
      spil.brikker.length === g[0] * g[1] && spil.brikker.every(b => !b.paa && Math.hypot(b.x - Pusle.hjem(spil, b)[0], b.y - Pusle.hjem(spil, b)[1]) > Pusle.INDSTIL.snap[niveau]));

    // Tappe: naboer skal passe sammen (den enes ud er den andens ind)
    let passer = true;
    spil.brikker.forEach(a => spil.brikker.forEach(b => {
      if (a.raek === b.raek && b.kol === a.kol + 1 && a.kanter.hoejre + b.kanter.venstre !== 0) passer = false;
      if (a.kol === b.kol && b.raek === a.raek + 1 && a.kanter.ned + b.kanter.op !== 0) passer = false;
    }));
    tjek((niveau + 1) + ' stjerne(r): tappene passer sammen, og yderkanten er glat',
      passer && spil.brikker.every(b => (b.kol > 0 || b.kanter.venstre === 0) && (b.raek > 0 || b.kanter.op === 0)));

    // En brik sluppet langt fra hjemmet bliver liggende
    const foerste = Pusle.tag(spil, spil.brikker[0].x + 5, spil.brikker[0].y + 5, 1);      // den brik der ligger oeverst dér
    const h0 = Pusle.hjem(spil, foerste);
    Pusle.flyt(spil, h0[0] + foerste.dx + 25, h0[1] + foerste.dy + 25, 1);
    tjek((niveau + 1) + ' stjerne(r): sluppet langt fra hjemmet klikker brikken ikke paa', Pusle.slip(spil, 1) === false && !foerste.paa);

    // Robot: tag hver brik i midten og slip den lidt skaevt for hjemmet
    let vagt = 0;
    while (!spil.faerdig && vagt++ < 50) {
      const loes = spil.brikker.filter(b => !b.paa);
      // Tag den brik der faktisk ligger oeverst det sted
      const br = Pusle.tag(spil, loes[0].x + spil.b / 2, loes[0].y + spil.h / 2, 7);
      const h = Pusle.hjem(spil, br);
      Pusle.flyt(spil, h[0] + br.dx + 6, h[1] + br.dy - 5, 7);
      Pusle.slip(spil, 7);
    }
    tjek((niveau + 1) + ' stjerne(r): puslespillet kan samles', spil.faerdig, vagt + ' forsoeg');
    tjek((niveau + 1) + ' stjerne(r): brikker paa plads kan ikke tages igen', Pusle.tag(spil, 50, 50, 9) === null);
  });

  // To fingre kan holde hver sin brik
  const spil = Pusle.nyt(2, pladser);
  const a = Pusle.tag(spil, spil.brikker[0].x + 3, spil.brikker[0].y + 3, 1);
  const b = Pusle.tag(spil, spil.brikker[0].x + 3, spil.brikker[0].y + 3, 2);
  tjek('to fingre faar ikke fat i den samme brik', a && a !== b);
}

{
  const sw = fs.readFileSync(path.join(__dirname, '..', 'sw.js'), 'utf8');
  const mangler = ['games/tegn/index.html', 'games/tegn/js/figurer.js', 'games/tegn/js/pusle.js', 'games/tegn/js/game.js'].filter(f => !sw.includes("'" + f + "'"));
  tjek('spillets filer er med i service workerens FILER', mangler.length === 0, mangler.join(', '));
}

console.log(fejl ? '\n' + fejl + ' test(s) fejlede.' : '\nAlle tests bestaaet.');
process.exit(fejl ? 1 : 0);
