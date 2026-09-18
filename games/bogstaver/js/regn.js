/**
 * Regnestykker til tallene i Bogstaver.
 *
 * Naar et tal er tegnet, kommer der et regnestykke, hvor svaret er netop det
 * tal. Alle tal holder sig mellem 0 og 9, saa de kan vises med de samme
 * glyffer og aebler som resten af spillet.
 *
 *   niveau 0: kun plus
 *   niveau 1 og 2: plus eller minus
 *
 * Ingen DOM, saa filen kan testes i Node.
 */
(function (rod) {
  'use strict';

  function tilfaeldig(n) { return Math.floor(Math.random() * n); }

  /** Et regnestykke med det givne svar: { a, b, op: '+' | '-', svar }. */
  function opgave(svar, niveau) {
    svar = Math.max(0, Math.min(9, svar | 0));
    var minus = niveau > 0 && Math.random() < 0.5;
    if (svar === 0) minus = true;                 // 0 + 0 er ikke et regnestykke; 3 - 3 er
    if (svar === 9) minus = false;                // 9 kan ikke vaere svaret paa et minusstykke med tal op til 9
    if (minus) {
      var b = 1 + tilfaeldig(Math.min(4, 9 - svar));          // traek hoejst 4 fra, saa det er til at taelle
      return { a: svar + b, b: b, op: '-', svar: svar };
    }
    // Plus: undgaa 0 som led, naar det kan lade sig goere (1 kan kun vaere 1 + 0 eller 0 + 1)
    var a = svar <= 1 ? tilfaeldig(svar + 1) : 1 + tilfaeldig(svar - 1);
    return { a: a, b: svar - a, op: '+', svar: svar };
  }

  /** Tre forskellige svarmuligheder mellem 0 og 9, blandet, hvoraf en er den rigtige. */
  function valg(svar) {
    var mulige = [svar - 2, svar - 1, svar + 1, svar + 2].filter(function (n) { return n >= 0 && n <= 9; });
    var ud = [svar];
    while (ud.length < 3) ud.push(mulige.splice(tilfaeldig(mulige.length), 1)[0]);
    for (var i = ud.length - 1; i > 0; i--) { var j = tilfaeldig(i + 1); var t = ud[i]; ud[i] = ud[j]; ud[j] = t; }
    return ud;
  }

  rod.Regn = { opgave: opgave, valg: valg };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
