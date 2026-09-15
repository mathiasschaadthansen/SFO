/**
 * Spil-registret.
 *
 * Tilføj et nyt spil ved at lægge en mappe under /games/<navn>/
 * og skrive én blok her. Menuen bygger sig selv ud fra listen.
 *
 * farve: kortets baggrund. Vælg fra paletten i css/shell.css.
 * art:   valgfrit inline-SVG der tegnes i kortets højre side.
 */
window.SPIL = [
  {
    id: 'racer',
    navn: 'Racerbanen',
    tekst: 'Hold fingeren i siden for at styre. 1 eller 2 spillere.',
    sti: 'games/racer/',
    farve: '#ffd23f',
    art: '<svg class="art" width="120" height="120" viewBox="0 0 60 60">' +
         '<rect x="18" y="8" width="24" height="44" rx="9" fill="#e8442e" stroke="#12261f" stroke-width="3"/>' +
         '<rect x="22" y="16" width="16" height="12" rx="4" fill="#f7f3e8" stroke="#12261f" stroke-width="3"/>' +
         '<circle cx="18" cy="20" r="5" fill="#12261f"/><circle cx="42" cy="20" r="5" fill="#12261f"/>' +
         '<circle cx="18" cy="44" r="5" fill="#12261f"/><circle cx="42" cy="44" r="5" fill="#12261f"/>' +
         '</svg>'
  },
  {
    id: 'klatbold',
    navn: 'Klatbold',
    tekst: 'To klatter og én bold. Løb, hop og skyd. 1 eller 2 spillere.',
    sti: 'games/klatbold/',
    farve: '#7fd0f5',
    art: '<svg class="art" width="120" height="120" viewBox="0 0 60 60">' +
         '<path d="M6 44a14 14 0 0 1 28 0z" fill="#e8442e" stroke="#12261f" stroke-width="3"/>' +
         '<circle cx="24" cy="36" r="3.5" fill="#fff" stroke="#12261f" stroke-width="2"/>' +
         '<circle cx="25.5" cy="36.5" r="1.5" fill="#12261f"/>' +
         '<circle cx="44" cy="24" r="8" fill="#fff" stroke="#12261f" stroke-width="3"/>' +
         '<circle cx="44" cy="24" r="2" fill="#12261f"/>' +
         '<rect x="4" y="44" width="52" height="6" rx="3" fill="#4cb944"/>' +
         '</svg>'
  }
];
