/**
 * Isvigen: Hvalrossen Helles lyde og flaskepost. Logikken, uden skaerm.
 * Kan koeres i node (testen og vaerktoej/lav-lyd-gemini.py) og i browseren.
 *
 * Ét spil fra at lytte til at laese, i to dele:
 *
 * Isflagerne: Pelle staar paa kysten og vil ud til Helle. Helle brummer et ord
 * i lyde ("Sss, ooo, lll."), og tre isflager med billeder flyder forbi. Den,
 * der passer, glider paa plads, og Pelle hopper ud paa den. Fem isflager, saa
 * er han ude hos Helle. Det traener lydsyntese: at lytte lyde sammen til et ord.
 *
 * Flaskeposten: hos Helle flyder en flaske ind med en seddel, som boernene
 * laeser. Et tryk paa et ord faar Helle til at lydere det og sige det.
 *
 * Stjernerne er en vej fra at lytte til at laese:
 *   *    isflagerne: kun lyde.            Sedlen: ét ord, find billedet.
 *   **   bogstaverne lyser, mens Helle    Sedlen: "Det er en sol." Find billedet.
 *        brummer.
 *   ***  ordet staar der, og man laeser   Sedlen: "Giv Helle en fisk." Traek tingen derhen.
 *        selv; lyden kommer ved et tryk.
 *
 * Ordene er Bogstavvejens ting (billede og ordklip "Her har du ordet sol."),
 * og kun ord, der staves, som de lyder, saa et barn kan lydere sig frem.
 */
(function (rod) {
  'use strict';

  var Rim = rod.Rim || (typeof require === 'function' ? require('../../rim/js/rim.js').Rim : null);

  var ISFLAGER = 5;     // isflager ud til Helle
  var SEDLER = 3;       // flaskeposter bagefter

  /*
   * Ordene. Alle staves, som de lyder: hvert bogstav er én lyd, ingen stumme
   * bogstaver og intet bloedt d eller v. Delt efter laengde.
   */
  var ORD = {
    kort: ['is', 'ko', 'bi', 'ur'],
    mellem: ['sol', 'mus', 'ost', 'bil', 'hus', 'orm', 'sko', 'pil', 'mur', 'hat', 'kat'],
    lang: ['fisk', 'gris', 'frø', 'stol', 'sky']
  };
  /* Hvilke ord isflagerne bruger pr. stjerne. */
  var FLAGEORD = [ORD.kort.concat(ORD.mellem.slice(0, 6)), ORD.mellem, ORD.mellem.concat(ORD.lang)];

  /* Ordenes form i saetninger: en/et og bestemt form. */
  var FORM = {
    is: ['en', 'isen'], ko: ['en', 'koen'], bi: ['en', 'bien'], ur: ['et', 'uret'],
    sol: ['en', 'solen'], mus: ['en', 'musen'], ost: ['en', 'osten'], bil: ['en', 'bilen'], hus: ['et', 'huset'],
    orm: ['en', 'ormen'], sko: ['en', 'skoen'], pil: ['en', 'pilen'], mur: ['en', 'muren'], hat: ['en', 'hatten'],
    kat: ['en', 'katten'], fisk: ['en', 'fisken'], gris: ['en', 'grisen'], 'frø': ['en', 'frøen'], stol: ['en', 'stolen'], sky: ['en', 'skyen']
  };

  /*
   * Lydene, som Helle brummer dem. Vokaler og lyde, der kan holdes, strakt
   * ("sss"), stoplydene korte ("k"). Det er det, stemmen indtaler.
   */
  var LYD = {
    a: 'aaa', e: 'eee', i: 'iii', o: 'ooo', u: 'uuu', y: 'yyy', 'æ': 'æææ', 'ø': 'øøø', 'å': 'ååå',
    f: 'fff', h: 'hhh', l: 'lll', m: 'mmm', n: 'nnn', r: 'rrr', s: 'sss', v: 'vvv', j: 'jjj',
    b: 'b', d: 'd', g: 'g', k: 'k', p: 'p', t: 't'
  };

  /* Ting, man kan give Helle og Pelle eller lægge på isflagen (tre stjerner). */
  var GIVE = ['fisk', 'ost', 'hat', 'is', 'sko', 'ur'];
  var MAAL = {
    helle: { navn: 'Helle', laeg: null },
    pelle: { navn: 'Pelle', laeg: null },
    isflage: { navn: 'isflagen', laeg: 'på isflagen' }
  };

  /* Det, Helle siger. Hver er én eller flere hele saetninger. */
  var TEKST = {
    hej: 'Hej, jeg er Hvalrossen Helle. Kom ud til mig på isen.',
    lyt: 'Lyt godt efter.',
    hvilket: 'Hvilket billede er det?',
    laesSelv: 'Kan du læse ordet?',
    hop: 'Ja. Hop ud på isflagen.',
    igen: 'Prøv igen.',
    fremme: 'Du kom helt ud til mig. Se, der kommer en flaske med post.',
    seddel: 'Kan du læse sedlen?',
    hjaelp: 'Tryk på et ord, hvis du vil høre det.',
    billede: 'Hvilket billede passer?',
    goer: 'Gør det, der står på sedlen.',
    rigtig: 'Ja, det er rigtigt.',
    tak: 'Tak.',
    naeste: 'Der kommer en flaske til.',
    slut: 'Du er god til at læse. Tak, fordi du besøgte mig.'
  };

  function bland(a) { a = a.slice(); for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function valgAf(a) { return a[Math.floor(Math.random() * a.length)]; }
  function stort(t) { return t.charAt(0).toUpperCase() + t.slice(1); }
  /** Hver saetning for sig, som js/stemme.js deler en replik. */
  function saetningerAf(t) { return (String(t).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean); }

  /** Ordets lyde, ét pr. bogstav. */
  function lyde(ord) { return Array.from(ord).map(function (b) { return LYD[b]; }); }
  /** Det, Helle brummer: "Sss, ooo, lll." Én hel saetning, saa den kan indtales for sig. */
  function brum(ord) { return stort(lyde(ord).join(', ')) + '.'; }
  /** Et ord, Helle siger alene, i en ramme, saa stemmen udtaler det rigtigt. */
  function ordet(ord) { return 'Det er ordet ' + ord + '.'; }

  /** Billede og ordklip fra Bogstavvejen, med stier fra spillets mappe (games/hvalros/). */
  function ting(ord) {
    var r = Rim && Rim.ORD[ord];
    if (!r) return null;
    var op = function (s) { return s ? '../rim/' + s : null; };
    return { ord: ord, billede: normal(op(r.fil)), klip: normal(op(r.klip)) };
  }
  function normal(sti) {
    if (!sti) return null;
    var ud = [];
    sti.split('/').forEach(function (d) { if (d === '..' && ud.length && ud[ud.length - 1] !== '..') ud.pop(); else if (d !== '.') ud.push(d); });
    return ud.join('/');
  }

  /** Tre forskellige ord: det rigtige og to andre med et andet forbogstav, saa man skal lytte hele ordet igennem. */
  function treValg(rigtigt, pulje) {
    var andre = bland(pulje.filter(function (o) { return o !== rigtigt && o.charAt(0) !== rigtigt.charAt(0); }));
    if (andre.length < 2) andre = bland(pulje.filter(function (o) { return o !== rigtigt; }));
    return bland([rigtigt, andre[0], andre[1]]);
  }

  /** Isflagernes runde: fem ord, aldrig det samme to gange. */
  function isflager(stjerner) {
    var pulje = FLAGEORD[stjerner], ord = bland(pulje).slice(0, ISFLAGER);
    return ord.map(function (o) {
      return { ord: o, valg: treValg(o, pulje), brum: brum(o), lyde: lyde(o), visBogstaver: stjerner >= 1, laesSelv: stjerner === 2 };
    });
  }

  /** Én seddel. type: 'ord' (én stjerne), 'saetning' (to) eller 'goer' (tre). */
  function seddel(stjerner, brugt) {
    brugt = brugt || [];
    if (stjerner < 2) {
      var pulje = stjerner === 0 ? ORD.kort.concat(ORD.mellem) : ORD.mellem.concat(ORD.lang);
      var o = valgAf(pulje.filter(function (x) { return brugt.indexOf(x) < 0; }));
      var tekst = stjerner === 0 ? o.toUpperCase() : (valgAf(['Det er', 'Her er']) + ' ' + FORM[o][0] + ' ' + o + '.');
      return { type: stjerner === 0 ? 'ord' : 'saetning', ord: o, tekst: tekst, ordene: tekst.replace(/\.$/, '').split(' '), valg: treValg(o, pulje) };
    }
    // Tre stjerner: giv nogen noget, eller laeg noget paa isflagen
    var t = valgAf(GIVE.filter(function (x) { return brugt.indexOf(x) < 0; }));
    var maal = valgAf(['helle', 'pelle', 'isflage']);
    var s = maal === 'isflage' ? 'Læg ' + FORM[t][1] + ' på isflagen.' : 'Giv ' + MAAL[maal].navn + ' ' + FORM[t][0] + ' ' + t + '.';
    var andre = bland(GIVE.filter(function (x) { return x !== t; })).slice(0, 2);
    return { type: 'goer', ord: t, maal: maal, tekst: s, ordene: s.replace(/\.$/, '').split(' '), ting: bland([t].concat(andre)) };
  }
  /** Sedlerne i en omgang: tre forskellige ting. */
  function sedler(stjerner) {
    var ud = [], brugt = [];
    for (var i = 0; i < SEDLER; i++) { var s = seddel(stjerner, brugt); brugt.push(s.ord); ud.push(s); }
    return ud;
  }

  /** Reglerne: er svaret rigtigt? Paa en seddel med "goer" er svaret { ting, maal }. */
  function svar(spm, valg) {
    if (spm.type === 'goer') return !!valg && valg.ting === spm.ord && valg.maal === spm.maal;
    return valg === spm.ord;
  }

  /** Alle ord paa sedlerne, og alle lyd-saetninger og ord-saetninger, et tryk kan give. */
  function sedlernesOrd() {
    var ord = {};
    ORD.kort.concat(ORD.mellem, ORD.lang).forEach(function (o) { ord[o] = 1; ord[FORM[o][0]] = 1; });
    GIVE.forEach(function (o) { ord[FORM[o][1]] = 1; });
    ['Det', 'er', 'Her', 'Giv', 'Helle', 'Pelle', 'Læg', 'på', 'isflagen'].forEach(function (o) { ord[o] = 1; });
    return Object.keys(ord);
  }
  /** Det, et ord paa sedlen lyderes som: kun bogstaver, smaat. */
  function lydOrd(o) { return o.toLowerCase(); }
  /*
   * Kan ordet lyderes? Kun de lydrette: tingene og de smaa ord en, et og paa.
   * "Det", "er" og "her" udtales ikke, som de staves, saa dem siger Helle bare.
   */
  var LYDRET = ['en', 'et', 'på'];
  function kanLyderes(o) {
    o = lydOrd(o);
    return (LYDRET.indexOf(o) >= 0 || !!FORM[o]) && Array.from(o).every(function (b) { return !!LYD[b]; });
  }

  /** Alt, Helle kan sige, som hele saetninger: til lydvaerktoejet og til testen. */
  function saetninger() {
    var ud = [];
    function laeg(t) { saetningerAf(t).forEach(function (s) { if (ud.indexOf(s) < 0) ud.push(s); }); }
    Object.keys(TEKST).forEach(function (k) { laeg(TEKST[k]); });
    sedlernesOrd().forEach(function (o) { if (kanLyderes(o)) laeg(brum(lydOrd(o))); laeg(ordet(lydOrd(o))); });
    Object.keys(LYD).forEach(function (b) { laeg(stort(LYD[b]) + '.'); });
    // Sedlerne selv, saa de kan siges, naar de er klaret
    ORD.kort.concat(ORD.mellem, ORD.lang).forEach(function (o) { laeg('Det er ' + FORM[o][0] + ' ' + o + '.'); laeg('Her er ' + FORM[o][0] + ' ' + o + '.'); });
    GIVE.forEach(function (t) { ['Helle', 'Pelle'].forEach(function (n) { laeg('Giv ' + n + ' ' + FORM[t][0] + ' ' + t + '.'); }); laeg('Læg ' + FORM[t][1] + ' på isflagen.'); });
    return ud;
  }

  rod.Helle = {
    ISFLAGER: ISFLAGER, SEDLER: SEDLER, ORD: ORD, FLAGEORD: FLAGEORD, FORM: FORM, LYD: LYD, GIVE: GIVE, MAAL: MAAL, TEKST: TEKST,
    lyde: lyde, brum: brum, ordet: ordet, ting: ting, treValg: treValg, isflager: isflager, seddel: seddel, sedler: sedler, svar: svar,
    sedlernesOrd: sedlernesOrd, lydOrd: lydOrd, kanLyderes: kanLyderes, saetninger: saetninger, saetningerAf: saetningerAf, stort: stort
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
