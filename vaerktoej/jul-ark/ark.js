/**
 * Pelles julekalender — opgaveark til 0. klasse: indholdet.
 *
 * Arkene er ikke en del af appen. De printes fra vaerktoej/jul-ark/ og laves
 * til en PDF med `node vaerktoej/lav-jul-ark.js`, som sendes til laererne.
 * Her staar kun indholdet, saa det kan rettes uden at roere tegnekoden
 * (tegn.js tegner tingene, sider.js stiller arkene op).
 *
 * Hver dag har ét eller to ark, og hvert ark har 1-3 opgaver og en linje til
 * laereren i bunden. En opgave er { type, ikon, tekst, ... }:
 *   ikon   piktogrammet, der viser barnet, hvad man goer: blyant (skriv/tegn),
 *          farve (farvelaeg), saks (klip), forbind, ring (saet ring om),
 *          kryds (saet kryds), klap, tale (vi taler sammen)
 *   tekst  en kort instruks til den voksne; boernene skal ikke laese den
 *   facit  svaret, hvor der er et. Testen regner det efter (test/jul-ark.test.js).
 *
 * Ord (billeder til ring om, forbind, rim og klap) er Bogstavvejens og
 * Rimhulens ting: billedet tages fra Rim.ORD og tegnes som stregtegning.
 * Ting, der taelles (kugle, kage, noed ...), tegnes i kode (Tegn.TING).
 * Bogstaver og tal skrives med Bogstavvejens streger (glyffer.js), saa det er
 * praecis den grundskrift og de skriveretninger, boernene kender fra appen.
 */
(function (rod) {
  'use strict';

  var TITEL = 'Pelles julekalender';
  var UNDERTITEL = 'opgaveark til 0. klasse';

  var UGER = [
    { emne: 'tal', navn: 'Tal og mængder', fra: 1, til: 7 },
    { emne: 'bogstaver', navn: 'Bogstaver og lyde', fra: 8, til: 14 },
    { emne: 'rim', navn: 'Rim og stavelser', fra: 15, til: 21 },
    { emne: 'faellesskab', navn: 'Fællesskab og jul', fra: 22, til: 24 }
  ];

  /* Figurerne fra spillene, som stregtegninger (til puslespillets motiv og festen). */
  var FIGURER = {
    pelle: 'games/maskinen/billeder/pindsvin.png',
    sanne: 'bog/billeder/skade.png',
    egon: 'games/bogstaver/billeder/egern.png',
    gustav: 'games/restaurant/billeder/gris.png',
    bodil: 'games/baever/billeder/bodil.png',
    klaus: 'games/klatbold/billeder/klat-roed.png',
    klara: 'games/klatbold/billeder/klat-blaa.png',
    rikke: 'games/maskinen/billeder/raev.png',
    milo: 'assets/malet/rummus.png',
    ulla: 'games/maskinen/billeder/ugle.png',
    rasmus: 'games/bogstaver/billeder/robot.png',
    kaja: 'games/maskinen/billeder/kanin.png',
    emil: 'games/bobler/billeder/dreng.png',
    ella: 'games/bobler/billeder/pige.png',
    bo: 'games/maskinen/billeder/bjoern.png'
  };

  /* De skjulte billeder: '#' er felter med dagens bogstav, '.' er felter med andre bogstaver. 9 x 11. */
  var MOTIVER = {
    snemand: ['...###...', '...###...', '..#####..', '...###...', '...###...', '..#####..', '.#######.', '.#######.', '.#######.', '..#####..', '.........'],
    juletrae: ['....#....', '...###...', '..#####..', '...###...', '..#####..', '.#######.', '..#####..', '.#######.', '#########', '....#....', '....#....'],
    nissehue: ['.......##', '......##.', '.....###.', '....####.', '....####.', '...#####.', '..######.', '..######.', '.#######.', '#########', '#########'],
    krone: ['.........', '.........', '#...#...#', '##.###.##', '#########', '#########', '#########', '#########', '.........', '#########', '.........'],
    gulerod: ['......#.#', '.....#.#.', '......#..', '.....##..', '....###..', '....##...', '...###...', '...##....', '..##.....', '..#......', '.#.......'],
    stjerne: ['....#....', '....#....', '...###...', '#########', '.#######.', '..#####..', '..#####..', '.###.###.', '.##...##.', '.#.....#.', '.........'],
    pakke: ['.##...##.', '..##.##..', '...###...', '#########', '#########', '.#######.', '.#######.', '.#######.', '.#######.', '.#######.', '.........']
  };

  var DAGE = [
    /* ---------- Uge 1: tal og maengder ---------- */
    {
      dag: 1, titel: 'Stormen', sted: 'Nøddeskoven', emne: 'tal',
      ark: [{
        navn: 'Tæl og skriv 1–5',
        opgaver: [
          { type: 'taelTrae', ikon: 'blyant', tekst: 'Tæl kuglerne på Pelles juletræ. Skriv tallet efter de prikkede streger.', ting: 'kugle', antal: 5, prikket: true, facit: 5 },
          { type: 'taelSkriv', ikon: 'blyant', tekst: 'Tæl tingene i hver række. Skriv tallet.', prikket: true,
            raekker: [{ ting: 'brik', antal: 4, facit: 4 }, { ting: 'stjerne', antal: 2, facit: 2 }, { ting: 'kugle', antal: 3, facit: 3 }] }
        ],
        laerer: 'Øver: at tælle en mængde til fem og skrive tallet. Sig: „Stormen tog Pelles brikker. Tæl kuglerne på hans træ – sæt en prik på hver kugle, mens I tæller. Hvor mange var der?“ Startprikken viser, hvor blyanten skal begynde.'
      }]
    },
    {
      dag: 2, titel: 'Egons nøddelager', sted: 'Egernreden', emne: 'tal',
      ark: [{
        navn: 'Terningmønstre og tegn så mange',
        opgaver: [
          { type: 'forbindTal', ikon: 'forbind', tekst: 'Se på nødderne i hvert hul. Tegn en streg til det rigtige tal.', ting: 'noed',
            maengder: [{ antal: 3, moenster: 'raekke' }, { antal: 5, moenster: 'terning' }, { antal: 4, moenster: 'terning' }, { antal: 2, moenster: 'terning' }],
            tal: [4, 2, 5, 3], facit: [3, 5, 4, 2] },
          { type: 'tegnSaa', ikon: 'blyant', tekst: 'Tegn lige så mange nødder i hullet, som tallet siger.', ting: 'noed', ramme: 'hul',
            felter: [{ antal: 3, facit: 3 }, { antal: 4, facit: 4 }] }
        ],
        laerer: 'Øver: at se en mængde uden at tælle (terningmønstre) og koble den til tallet. Sig: „Egon lægger altid sine nødder pænt. Kan I se, hvor mange der er, uden at tælle én ad gangen?“ Vis evt. en terning først.'
      }]
    },
    {
      dag: 3, titel: 'Brunkager hos Gustav', sted: 'Skovkøkkenet', emne: 'tal',
      ark: [{
        navn: 'Plus med billeder og farv så mange',
        opgaver: [
          { type: 'regne', ikon: 'blyant', tekst: 'Tre kager og tre kager. Hvor mange er der i alt? Skriv tallet.', stykker: [{ ting: 'kage', a: 3, op: '+', b: 3, facit: 6 }] },
          { type: 'taelSkriv', ikon: 'blyant', tekst: 'Én kage er væk fra pladen. Tæl kagerne, der er tilbage. Skriv tallet.', prikket: false,
            raekker: [{ ting: 'kage', antal: 5, mangler: 1, facit: 5 }] },
          { type: 'farvSaa', ikon: 'farve', tekst: 'Farvelæg lige så mange kager, som tallet siger.', ting: 'kage',
            raekker: [{ antal: 2, vist: 5, facit: 2 }, { antal: 4, vist: 6, facit: 4 }, { antal: 6, vist: 7, facit: 6 }] }
        ],
        laerer: 'Øver: at lægge to mængder sammen og at tælle et bestemt antal fra en større mængde. Sig: „Gustav lægger tre kager på den ene række og tre på den anden. Hvor mange er det?“ Første gang uden prikkede tal.'
      }]
    },
    {
      dag: 4, titel: 'Den frosne dæmning', sted: 'Bæverdammen', emne: 'tal',
      ark: [{
        navn: 'Flest, færrest og lige mange',
        opgaver: [
          { type: 'flest', ikon: 'ring', hvad: 'flest', tekst: 'Sæt ring om den bunke, der har flest stammer.', ting: 'stamme',
            runder: [{ venstre: 6, hoejre: 2, facit: 'venstre' }, { venstre: 4, hoejre: 5, facit: 'hoejre' }] },
          { type: 'flest', ikon: 'ring', hvad: 'faerrest', tekst: 'Sæt ring om den bunke, der har færrest stammer.', ting: 'stamme',
            runder: [{ venstre: 3, hoejre: 6, facit: 'venstre' }, { venstre: 5, hoejre: 4, facit: 'hoejre' }] },
          { type: 'ligeMange', ikon: 'blyant', tekst: 'Tegn lige så mange stammer i den tomme bunke. Så er det retfærdigt.', ting: 'stamme', antal: 4, facit: 4 }
        ],
        laerer: 'Øver: at sammenligne mængder (flest, færrest, lige mange). Sig: „Bodil vil vide, hvor hun har flest stammer. Når bunkerne er lige store, må vi tælle.“ Piktogrammet med den store eller lille bunke viser, om der spørges om flest eller færrest.'
      }]
    },
    {
      dag: 5, titel: 'Sneboldene', sted: 'Boldbanen', emne: 'tal',
      ark: [{
        navn: 'Tierrammer og plus',
        opgaver: [
          { type: 'tierramme', ikon: 'farve', tekst: 'Farv lige så mange felter i tierrammen, som der er snebolde.', ting: 'snebold',
            raekker: [{ antal: 5, facit: 5 }, { antal: 7, facit: 7 }, { antal: 10, facit: 10 }] },
          { type: 'regne', ikon: 'blyant', tekst: 'Klara har tre snebolde og laver to mere. Klaus har fem og fem. Skriv, hvor mange.', stykker: [{ ting: 'snebold', a: 3, op: '+', b: 2, facit: 5 }, { ting: 'snebold', a: 5, op: '+', b: 5, facit: 10 }] }
        ],
        laerer: 'Øver: tierrammen (fem og noget mere) og at lægge sammen til ti. Sig: „Klara har tre snebolde. Hvor mange skal hun lave, før hun har fem?“ Tierrammen fyldes fra venstre i øverste række først.'
      }]
    },
    {
      dag: 6, titel: 'Kælketuren', sted: 'Susebanen', emne: 'tal',
      ark: [{
        navn: 'Talrække og tegn 6',
        opgaver: [
          { type: 'talraekke', ikon: 'blyant', tekst: 'Juletræerne langs kælkebanen har tal. Skriv de tal, der mangler.', raekke: [1, 2, null, 4, 5, null, 7, null, 9, 10], facit: [3, 6, 8] },
          { type: 'tegnSaa', ikon: 'blyant', tekst: 'Tegn seks kugler på juletræet.', ting: 'kugle', ramme: 'trae', felter: [{ antal: 6, facit: 6 }] },
          { type: 'regne', ikon: 'blyant', tekst: 'Fem juletræer og ét mere. Hvor mange er det?', stykker: [{ ting: 'gran', a: 5, op: '+', b: 1, facit: 6 }] }
        ],
        laerer: 'Øver: talrækken til ti og fem og én. Sig: „Rikke kører langsomt, så vi kan tælle juletræerne langs banen. Tæl højt med, og find de tal, sneen har dækket.“'
      }]
    },
    {
      dag: 7, titel: 'Syv stjerner', sted: 'Stjerneuret', emne: 'tal',
      ark: [{
        navn: 'Stjernebilledet og minus',
        opgaver: [
          { type: 'prikTilPrik', ikon: 'forbind', tekst: 'Forbind stjernerne fra 1 til 7. Så kommer Milos stjernebillede frem.', antal: 7,
            punkter: [[18, 62], [30, 30], [52, 16], [74, 18], [92, 34], [112, 52], [124, 64]], facit: 'et pindsvin' },
          { type: 'regne', ikon: 'blyant', tekst: 'Fem stjerner og to stjerner. Syv stjerner, og én falder ned. Skriv tallet.', stykker: [{ ting: 'stjerne', a: 5, op: '+', b: 2, facit: 7 }, { ting: 'stjerne', a: 7, op: '-', b: 1, facit: 6 }] }
        ],
        laerer: 'Øver: tallene til syv, at forbinde i rækkefølge og første minus. Sig: „Milo kalder stjernebilledet Pindsvinet. Fem stjerner til piggene og to til snuden. Hvor mange er det?“ Ved minus: „En stjerne falder ned – streg den ud.“'
      }, {
        navn: 'Klokken syv',
        opgaver: [
          { type: 'urTegn', ikon: 'blyant', tekst: 'Klokken er syv. Den store viser står lige op. Tegn den lille viser.', time: 7, facit: 7 },
          { type: 'urRing', ikon: 'ring', tekst: 'Sæt ring om det ur, hvor klokken er syv.', ure: [3, 7, 12], time: 7, facit: 1 },
          { type: 'farvSaa', ikon: 'farve', tekst: 'Syv dage er en uge. Farvelæg syv stjerner – én for hver dag.', ting: 'stjerne', raekker: [{ antal: 7, vist: 10, facit: 7 }] }
        ],
        laerer: 'Øver: hele timer på uret og tallet syv. Sig: „På Stjerneuret står den lille viser på syv, og den store viser står lige op. Så er klokken syv – snart sengetid for pindsvin.“ Brug gerne et rigtigt ur i klassen.'
      }]
    },

    /* ---------- Uge 2: bogstaver og lyde ---------- */
    {
      dag: 8, titel: 'S i sneen', sted: 'Bogstavvejen', emne: 'bogstaver', bogstav: 'S',
      ark: [{
        navn: 'Skriv S og s',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. Start ved den sorte prik, og følg pilen.', bogstav: 'S' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv S og s på linjerne. Til sidst ordet sko.', bogstav: 'S',
            raekker: [{ lille: false, prikket: 6, tomme: 1 }, { lille: true, prikket: 7, tomme: 1 }, { lille: true, prikket: 3, tomme: 5 }], ord: 'sko' }
        ],
        laerer: 'Øver: bogstavet S i grundskrift (start øverst og bugt ned som en slange). Sig: „Ulla tegner et S i sneen. S siger en lang, hvislende lyd – ssss.“ Skriv bogstavet stort i luften sammen først.'
      }, {
        navn: 'Lyden S',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med S.', lyd: 'S',
            billeder: ['sko', 'hat', 'slange', 'bil', 'stol', 'ugle'], facit: ['sko', 'slange', 'stol'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med S eller s. Hvad kommer frem?', bogstav: 'S', andre: ['A', 'T', 'L', 'o', 'i'], motiv: 'snemand', facit: 'en snemand' }
        ],
        laerer: 'Øver: at høre lyden S først i et ord og at kende S og s. Sig: „S som i sne, sol og sok. Hvad hedder tingene? Kan I høre ssss i starten?“ Sig ordene sammen med børnene: sko, hat, slange, bil, stol, ugle.'
      }]
    },
    {
      dag: 9, titel: 'Julebrevene', sted: 'Himmelvejen', emne: 'bogstaver', bogstav: 'J',
      ark: [{
        navn: 'Skriv J og j',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. Prikken over j sættes til sidst.', bogstav: 'J' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv J og j på linjerne. Til sidst ordet jakke.', bogstav: 'J',
            raekker: [{ lille: false, prikket: 6, tomme: 1 }, { lille: true, prikket: 6, tomme: 2 }, { lille: true, prikket: 3, tomme: 5 }], ord: 'jakke' }
        ],
        laerer: 'Øver: bogstavet J (ned og en lille bue til venstre). Sig: „Sanne har breve til nogen, der starter med J – J ligesom jul. J siger en blød lyd, ligesom når man siger ja.“'
      }, {
        navn: 'Lyden J',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med J.', lyd: 'J',
            billeder: ['hus', 'jakke', 'fisk', 'jordbær', 'tog', 'juletræ', 'kat'], facit: ['jakke', 'jordbær', 'juletræ'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med J eller j. Hvad kommer frem?', bogstav: 'J', andre: ['U', 'L', 'f', 'l', 'A'], motiv: 'juletrae', facit: 'et juletræ' }
        ],
        laerer: 'Øver: at høre lyden J først i et ord. Sig: „Brevene har billeder i stedet for bogstaver. Hvilke breve skal til noget med J?“ Sig ordene: hus, jakke, fisk, jordbær, tog, juletræ, kat.'
      }]
    },
    {
      dag: 10, titel: 'Julekort hos Rasmus', sted: 'Tegnestuen', emne: 'bogstaver', bogstav: 'N',
      ark: [{
        navn: 'Skriv N og n',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. N: først stammen ned, så skråt ned og op igen.', bogstav: 'N' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv N og n på linjerne. Til sidst ordet nød.', bogstav: 'N',
            raekker: [{ lille: false, prikket: 4, tomme: 3 }, { lille: true, prikket: 5, tomme: 3 }, { lille: true, prikket: 2, tomme: 6 }], ord: 'nød' }
        ],
        laerer: 'Øver: bogstavet N som på skriveplakaten: stammen ned, så skråt ned og op ad højre stamme i én streg. Lille n: ned, op ad stammen og over buen. Sig: „N som i nisse. Hold munden lukket og sig nnnn – det summer i næsen.“'
      }, {
        navn: 'Lyden N',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med N.', lyd: 'N',
            billeder: ['nød', 'fisk', 'næse', 'hat', 'tog', 'nøgle', 'ko'], facit: ['nød', 'næse', 'nøgle'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med N eller n. Hvad kommer frem?', bogstav: 'N', andre: ['M', 'H', 'u', 'm', 'A'], motiv: 'nissehue', facit: 'en nissehue' }
        ],
        laerer: 'Øver: at høre N først og at skelne N fra M og n fra m og u. Sig: „Rasmus fandt et lille kort med en nissehue. Nisse starter med N.“ Sig ordene: nød, fisk, næse, hat, tog, nøgle, ko.'
      }]
    },
    {
      dag: 11, titel: 'Kajas kane', sted: 'Vrimleskoven', emne: 'bogstaver', bogstav: 'K',
      ark: [{
        navn: 'Skriv K og k',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. Stammen først, så de to skrå streger.', bogstav: 'K' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv K og k på linjerne. Til sidst ordet kat.', bogstav: 'K',
            raekker: [{ lille: false, prikket: 4, tomme: 3 }, { lille: true, prikket: 4, tomme: 4 }, { lille: true, prikket: 2, tomme: 6 }], ord: 'kat' }
        ],
        laerer: 'Øver: bogstavet K i tre streger: stammen ned, skråt ind til stammen og skråt ud. Sig: „Kaja og kane starter med K. K siger en kort, hård lyd – som når man knækker en kvist.“'
      }, {
        navn: 'Lyden K',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med K.', lyd: 'K',
            billeder: ['kat', 'sko', 'kage', 'mus', 'krone', 'bi', 'ko', 'ugle'], facit: ['kat', 'kage', 'krone', 'ko'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med K eller k. Hvad kommer frem?', bogstav: 'K', andre: ['R', 'X', 'h', 'x', 'L'], motiv: 'krone', facit: 'en krone' }
        ],
        laerer: 'Øver: at høre K først i et ord (fire af otte). Sig: „Kaja leder efter ting, der starter med K. Hvad sidder i vinduet? En kat!“ Sig ordene: kat, sko, kage, mus, krone, bi, ko, ugle.'
      }]
    },
    {
      dag: 12, titel: 'Snemanden i haven', sted: 'Årstidshaven', emne: 'bogstaver', bogstav: 'G',
      ark: [{
        navn: 'Skriv G og g',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. G går rundt mod uret.', bogstav: 'G' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv G og g på linjerne. Til sidst ordet gave.', bogstav: 'G',
            raekker: [{ lille: false, prikket: 3, tomme: 4 }, { lille: true, prikket: 3, tomme: 5 }, { lille: true, prikket: 1, tomme: 7 }], ord: 'gave' }
        ],
        laerer: 'Øver: bogstavet G rundt mod uret og lille g med hale under linjen. Sig: „Snemanden mangler en næse – en gulerod. Gulerod starter med G. G kommer helt nede fra halsen.“'
      }, {
        navn: 'Lyden G',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med G.', lyd: 'G',
            billeder: ['and', 'gave', 'gris', 'mus', 'gulerod', 'sko', 'giraf', 'fisk'], facit: ['gave', 'gris', 'gulerod', 'giraf'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med G eller g. Hvad kommer frem?', bogstav: 'G', andre: ['C', 'O', 'q', 'a', 'c'], motiv: 'gulerod', facit: 'en gulerod' }
        ],
        laerer: 'Øver: at høre G først og at skelne G fra C og O og g fra q og a. Sig: „G som i gave og G som i gran. Og Grisen Gustav!“ Sig ordene: and, gave, gris, mus, gulerod, sko, giraf, fisk.'
      }]
    },
    {
      dag: 13, titel: 'Is på havet', sted: 'Boblehavet', emne: 'bogstaver', bogstav: 'E',
      ark: [{
        navn: 'Skriv E og e',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. E: ned og ud, så taget og til sidst midten.', bogstav: 'E' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv E og e på linjerne. Til sidst ordet egern.', bogstav: 'E',
            raekker: [{ lille: false, prikket: 3, tomme: 4 }, { lille: true, prikket: 3, tomme: 5 }, { lille: true, prikket: 1, tomme: 7 }], ord: 'egern' }
        ],
        laerer: 'Øver: bogstavet E i tre streger og lille e (først tværs, så rundt). Sig: „Emil og Ella – begge navne starter med E.“ Lad børnene finde E i deres egne navne.'
      }, {
        navn: 'Lyden E',
        opgaver: [
          { type: 'forlydRing', ikon: 'ring', tekst: 'Sig ordene højt. Sæt ring om det, der starter med E.', lyd: 'E',
            billeder: ['tog', 'elefant', 'ko', 'hund', 'egern', 'bil', 'måne', 'edderkop', 'ugle'], facit: ['elefant', 'egern', 'edderkop'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med E eller e. Hvad kommer frem?', bogstav: 'E', andre: ['F', 'L', 'B', 'c', 'o', 'a'], motiv: 'stjerne', facit: 'en stjerne' }
        ],
        laerer: 'Øver: at høre E først (tre af ni) og at skelne E fra F og e fra c og o. Sig: „E som i Emil, elefant og Egon.“ Sig ordene: tog, elefant, ko, hund, egern, bil, måne, edderkop, ugle.'
      }]
    },
    {
      dag: 14, titel: 'Pakken på trappen', sted: 'Nøddeskoven', emne: 'bogstaver', bogstav: 'P',
      ark: [{
        navn: 'Skriv P og p',
        opgaver: [
          { type: 'sporBogstav', ikon: 'blyant', tekst: 'Følg prikkerne med fingeren, og skriv så med blyant. Stammen ned, så maven med uret.', bogstav: 'P' },
          { type: 'skriveLinjer', ikon: 'blyant', tekst: 'Skriv P og p på linjerne. Til sidst ordet pil.', bogstav: 'P',
            raekker: [{ lille: false, prikket: 2, tomme: 5 }, { lille: true, prikket: 2, tomme: 6 }, { lille: true, prikket: 1, tomme: 7 }], ord: 'pil' }
        ],
        laerer: 'Øver: bogstavet P (stammen ned, så maven rundt med uret) og lille p med stammen under linjen. Sig: „Pelle skriver P på alle sine pakker. P som i Pelle. P siger en lille hoppende lyd.“'
      }, {
        navn: 'Ugens bogstaver',
        opgaver: [
          { type: 'forbindBogstav', ikon: 'forbind', tekst: 'Sig ordet. Hvilket bogstav starter det med? Tegn en streg til bogstavet.',
            par: [['pizza', 'P'], ['sko', 'S'], ['gris', 'G'], ['egern', 'E'], ['næse', 'N'], ['kage', 'K']], bogstaver: ['N', 'K', 'S', 'P', 'E', 'G'] },
          { type: 'skjult', ikon: 'farve', tekst: 'Farvelæg alle felter med P eller p. Hvad kommer frem?', bogstav: 'P', andre: ['B', 'R', 'F', 'b', 'd', 'q'], motiv: 'pakke', facit: 'en pakke' }
        ],
        laerer: 'Øver: ugens bogstaver S, J, N, K, G, E og P og at skelne P fra B og R og p fra b, d og q. Sig: „Der står en lille pakke på trappen. Pakke starter med P. Kan I huske alle ugens bogstaver?“'
      }]
    },

    /* ---------- Uge 3: rim og stavelser ---------- */
    {
      dag: 15, titel: 'Bo sover', sted: 'Rimhulen', emne: 'rim',
      ark: [{
        navn: 'Forbind rim',
        opgaver: [
          { type: 'rimForbind', ikon: 'forbind', tekst: 'Sig ordene. Tegn en streg mellem de to, der rimer.',
            venstre: ['bjørn', 'mus', 'sol'], hoejre: ['stol', 'ørn', 'hus'], facit: [['bjørn', 'ørn'], ['mus', 'hus'], ['sol', 'stol']] },
          { type: 'rimRing', ikon: 'ring', tekst: 'Sig ordet til venstre. Sæt ring om det, der rimer på det.',
            raekker: [{ ord: 'kat', kort: ['bil', 'hat', 'fisk'], facit: 'hat' }, { ord: 'ko', kort: ['sko', 'ugle', 'kage'], facit: 'sko' }] }
        ],
        laerer: 'Øver: at høre rim – ord, der lyder ens til sidst. Sig: „Bo taler i rim, når han sover. Bjørn og … ørn! Mus og … hus!“ Sig ordene langsomt og tydeligt med børnene.'
      }]
    },
    {
      dag: 16, titel: 'Risengrød', sted: 'Skovkøkkenet', emne: 'rim',
      ark: [{
        navn: 'Klap stavelser',
        opgaver: [
          { type: 'klapStreg', ikon: 'klap', maade: 'streg', tekst: 'Sig ordet, og klap det. Tegn en streg for hvert klap.',
            ord: ['mælk', 'kage', 'juletræ', 'pandekage'], facit: [1, 2, 3, 4] },
          { type: 'langstOrd', ikon: 'ring', tekst: 'Klap ordene i rækken. Sæt ring om det ord, der har flest klap.',
            raekker: [{ kort: ['is', 'pandekage', 'kage'], facit: 'pandekage' }, { kort: ['gave', 'ko', 'gulerod'], facit: 'gulerod' }] }
        ],
        laerer: 'Øver: at dele ord i stavelser ved at klappe. Sig: „Gustav klapper risengrød: ri-sen-grød. Tre klap! Kan I klappe kage?“ Klap med hele klassen, før de tegner stregerne.'
      }]
    },
    {
      dag: 17, titel: 'Egons julesang', sted: 'Egernreden', emne: 'rim',
      ark: [{
        navn: 'Rim og ikke-rim',
        opgaver: [
          { type: 'rimForbind', ikon: 'forbind', tekst: 'Sig ordene. Tegn en streg mellem de to, der rimer.',
            venstre: ['is', 'tog', 'ø', 'ko'], hoejre: ['bog', 'sko', 'gris', 'frø'], facit: [['is', 'gris'], ['tog', 'bog'], ['ø', 'frø'], ['ko', 'sko']] },
          { type: 'rimKryds', ikon: 'kryds', tekst: 'To af ordene rimer. Sæt kryds ved det, der ikke rimer.',
            raekker: [{ kort: ['is', 'gris', 'bil'], facit: 'bil' }, { kort: ['kat', 'tog', 'bog'], facit: 'kat' }] }
        ],
        laerer: 'Øver: at finde rim og at høre, når et ord ikke rimer. Sig: „Egon skriver en julesang. Ude er det koldt, og vi spiser is. I stalden står en lille … gris!“ Syng gerne Egons linjer.'
      }]
    },
    {
      dag: 18, titel: 'Turen til månen', sted: 'Stjerneuret', emne: 'rim',
      ark: [{
        navn: 'Klap og sortér',
        opgaver: [
          { type: 'klapStreg', ikon: 'klap', maade: 'prik', tekst: 'Sig ordet, og klap det. Farv en prik for hvert klap.',
            ord: ['fly', 'raket', 'måne', 'paraply'], facit: [1, 2, 2, 3] },
          { type: 'sorter', ikon: 'saks', maade: 'klip', tekst: 'Klip billederne ud. Klap ordet, og lim billedet i kassen med lige så mange klap.',
            kolonner: [1, 2, 3], ord: ['elefant', 'hus', 'robot', 'regnbue', 'bil', 'gave'], facit: { 1: ['hus', 'bil'], 2: ['robot', 'gave'], 3: ['elefant', 'regnbue'] } }
        ],
        laerer: 'Øver: stavelser og at sortere ord efter antal klap. Sig: „Milo klapper raket: ra-ket. To klap. Hvad med paraply?“ Klip og lim kan også gøres i grupper på gulvet med tre kasser.'
      }]
    },
    {
      dag: 19, titel: 'Klatternes sang', sted: 'Boldbanen', emne: 'rim',
      ark: [{
        navn: 'Flere rim',
        opgaver: [
          { type: 'rimForbind', ikon: 'forbind', tekst: 'Sig ordene. Tegn en streg mellem de to, der rimer.',
            venstre: ['ko', 'bil', 'hund', 'kat', 'hus'], hoejre: ['mund', 'hat', 'mus', 'sko', 'pil'], facit: [['ko', 'sko'], ['bil', 'pil'], ['hund', 'mund'], ['kat', 'hat'], ['hus', 'mus']] },
          { type: 'rimKryds', ikon: 'kryds', tekst: 'To af ordene rimer. Sæt kryds ved det, der ikke rimer.',
            raekker: [{ kort: ['hund', 'sko', 'mund'], facit: 'sko' }, { kort: ['mus', 'bil', 'pil'], facit: 'mus' }, { kort: ['ko', 'fisk', 'sko'], facit: 'fisk' }] }
        ],
        laerer: 'Øver: rim med flere ord at vælge imellem. Sig: „Klaus og Klara har glemt slutningen. På marken står en ko. Den har fået nye … sko!“ Lad børnene finde på flere rimord selv.'
      }]
    },
    {
      dag: 20, titel: 'Bodils gaver', sted: 'Bæverdammen', emne: 'rim',
      ark: [{
        navn: 'Klap og forbind',
        opgaver: [
          { type: 'klapStreg', ikon: 'klap', maade: 'streg', tekst: 'Sig ordet, og klap det. Tegn en streg for hvert klap.',
            ord: ['træ', 'gave', 'sommerfugl', 'bjørn', 'krone'], facit: [1, 2, 3, 1, 2] },
          { type: 'sorter', ikon: 'forbind', maade: 'forbind', tekst: 'Klap ordet. Tegn en streg til trommen med lige så mange slag.',
            kolonner: [1, 2, 3], ord: ['fugl', 'gulerod', 'cykel', 'hest', 'edderkop', 'pizza'], facit: { 1: ['fugl', 'hest'], 2: ['cykel', 'pizza'], 3: ['gulerod', 'edderkop'] } }
        ],
        laerer: 'Øver: stavelser i lidt længere ord. Sig: „Bodil gnaver gaver. Klap gave: ga-ve. Sommerfugl: som-mer-fugl. Og træ – kun ét klap.“'
      }]
    },
    {
      dag: 21, titel: 'Rikkes rimetur', sted: 'Susebanen', emne: 'rim',
      ark: [{
        navn: 'Den hurtige rimetur',
        opgaver: [
          { type: 'rimForbind', ikon: 'forbind', tekst: 'Sig ordene. Tegn en streg mellem de to, der rimer.',
            venstre: ['fly', 'and', 'ur', 'salat', 'banan'], hoejre: ['tomat', 'mur', 'vulkan', 'sky', 'vand'], facit: [['fly', 'sky'], ['and', 'vand'], ['ur', 'mur'], ['salat', 'tomat'], ['banan', 'vulkan']] },
          { type: 'rimKryds', ikon: 'kryds', tekst: 'Tre af ordene rimer. Sæt kryds ved det, der ikke rimer.',
            raekker: [{ kort: ['fly', 'sky', 'ko', 'paraply'], facit: 'ko' }, { kort: ['pingvin', 'sol', 'delfin', 'kanin'], facit: 'sol' }] }
        ],
        laerer: 'Øver: rim i et højere tempo og rim på længere ord. Sig: „Fly, fly, oppe i en … sky! And, and, du står på frosset … vand!“ Rimene på paraply og pingvin er de sværeste.'
      }]
    },

    /* ---------- Faellesskab og jul ---------- */
    {
      dag: 22, titel: 'Invitationerne', sted: 'Himmelvejen', emne: 'faellesskab',
      ark: [{
        navn: 'Invitation til en ven',
        opgaver: [
          { type: 'invitation', ikon: 'saks', tekst: 'Klip kortet ud langs den stiplede streg, og fold det to gange. Tegn dig selv og din ven, og farvelæg forsiden.' }
        ],
        laerer: 'Øver: at tænke på andre og invitere. Fold kortet på midten med tegningerne udenpå (den øverste halvdel bagud), og fold det så på midten igen, så juletræet er forsiden. Sig: „Pelle laver en invitation til alle. Hvem vil I invitere?“'
      }, {
        navn: 'Samtaleark',
        opgaver: [
          { type: 'samtale', ikon: 'tale', tekst: 'Hvordan føles det at blive glemt? Sæt ring om ansigtet.', ansigter: ['glad', 'ked', 'vred', 'bange'] },
          { type: 'tegnRamme', ikon: 'blyant', tekst: 'Tegn, hvad man kan gøre, når én står alene.', motiv: 'alene' }
        ],
        spoergsmaal: [
          'Hvordan føles det at blive glemt?',
          'Hvordan tror I, Nis har det, når han ikke tør komme frem?',
          'Hvad kan vi gøre, hvis vi ser én, der står alene?',
          'Hvordan kan man spørge: Vil du være med?',
          'Har I prøvet at blive inviteret? Hvordan føltes det?'
        ],
        laerer: 'Øver: at sætte ord på følelser og at tage ansvar for fællesskabet. Læs spørgsmålene i boksen højt, og lad børnene svare på skift. Der er ingen forkerte ansigter.'
      }]
    },
    {
      dag: 23, titel: 'Lillejuleaften', sted: 'Nøddeskoven', emne: 'faellesskab',
      ark: [{
        navn: 'Guirlanden',
        opgaver: [
          { type: 'guirlande', ikon: 'blyant', tekst: 'Se mønstret på guirlanden. Tegn de næste i de tomme ringe.',
            raekker: [
              { moenster: 'AB', ting: ['kugle', 'stjerne'], vist: 5, tomme: 3, facit: ['stjerne', 'kugle', 'stjerne'] },
              { moenster: 'AAB', ting: ['hjerte', 'kugle'], vist: 5, tomme: 4, facit: ['kugle', 'hjerte', 'hjerte', 'kugle'] },
              { moenster: 'ABC', ting: ['stjerne', 'kugle', 'hjerte'], vist: 5, tomme: 4, facit: ['hjerte', 'stjerne', 'kugle', 'hjerte'] }
            ] },
          { type: 'egenGuirlande', ikon: 'blyant', tekst: 'Find på dit eget mønster, og tegn det på guirlanden.', tomme: 10 }
        ],
        laerer: 'Øver: at se og fortsætte et mønster (AB, AAB, ABC). Sig: „Vennerne hjælper med at pynte. Sig mønstret højt: kugle, stjerne, kugle, stjerne … Hvad kommer så?“'
      }, {
        navn: 'Tegn dig selv til festen',
        opgaver: [
          { type: 'tegnSelv', ikon: 'blyant', tekst: 'Alle vennerne er kommet til juletræet. Tegn dig selv på den tomme plads, og farvelæg.' }
        ],
        laerer: 'Øver: at høre til i et fællesskab. Sig: „Lillejuleaften kommer vennerne og hjælper. Hvem ville I hjælpe – og hvad ville I tage med?“ Hæng tegningerne op som én stor fest.'
      }]
    },
    {
      dag: 24, titel: 'Juleaften', sted: 'Nøddeskoven', emne: 'faellesskab',
      ark: [{
        navn: 'Puslespillet',
        opgaver: [
          { type: 'puslespilMotiv', ikon: 'farve', tekst: 'Farvelæg Pelles puslespil. Tegn Nis i hjørnet. Klip langs de tykke streger (12 brikker) eller alle streger (24 brikker).' }
        ],
        laerer: 'Øver: at samle et billede og at alle er med. Sig: „Pelle maler en lille nisse nede i hjørnet. Så er alle med på billedet.“ Klip de tykke streger for 12 brikker, alle streger for 24.'
      }, {
        navn: 'Kalender-ark',
        opgaver: [
          { type: 'kalenderArk', ikon: 'farve', tekst: 'Farv dagens brik hver dag i december. Tallet viser dagen.' }
        ],
        laerer: 'Kalender-arket kan med fordel deles ud den 1. december. Hver dag farver børnene brikken med dagens tal – den samme plads, som brikken får i appens puslespil. Juleaften er det hele farvet.'
      }]
    }
  ];

  /* ---------- hjaelpere, der ogsaa bruges af testen ---------- */

  var Rim = rod.Rim || (typeof require === 'function' ? require('../../games/rim/js/rim.js').Rim : null);

  /** Rimhulens stier er fra games/rim/. Her goeres de til stier fra roden af repoet. */
  function fraRim(rel) {
    if (!rel) return null;
    var dele = ('games/rim/' + rel).split('/'), ud = [];
    dele.forEach(function (d) { if (d === '..') ud.pop(); else if (d !== '.') ud.push(d); });
    return ud.join('/');
  }
  /** Billedet til et ord (fra roden af repoet), eller null. */
  function ordBillede(o) { var r = Rim && Rim.ORD[o]; return r ? fraRim(r.fil) : null; }

  /** Alle ord med billede, der bruges paa arkene. */
  function ordene() {
    var ud = [];
    function laeg(o) { if (o && ud.indexOf(o) < 0) ud.push(o); }
    DAGE.forEach(function (d) {
      d.ark.forEach(function (a) {
        a.opgaver.forEach(function (o) {
          (o.billeder || []).forEach(laeg);
          (o.venstre || []).forEach(laeg); (o.hoejre || []).forEach(laeg);
          (o.raekker || []).forEach(function (r) { if (r.ord) laeg(r.ord); (r.kort || []).forEach(laeg); });
          if (o.type === 'klapStreg' || o.type === 'sorter') o.ord.forEach(laeg);
          if (o.type === 'skriveLinjer' && o.ord) laeg(o.ord);
          (o.par || []).forEach(function (p) { laeg(p[0]); });
        });
      });
    });
    return ud;
  }
  /** Alle billedfiler (fra roden af repoet), der skal hentes: ordenes og figurernes. */
  function billeder() {
    var ud = ordene().map(ordBillede);
    Object.keys(FIGURER).forEach(function (k) { ud.push(FIGURER[k]); });
    return ud.filter(function (b, i) { return b && ud.indexOf(b) === i; });
  }
  /** Alle ark i raekkefoelge, med dagen ved hvert. */
  function alleArk() {
    var ud = [];
    DAGE.forEach(function (d) { d.ark.forEach(function (a, i) { ud.push({ dag: d, ark: a, nr: i }); }); });
    return ud;
  }
  /** Hvilken ting (indeks i ting) der haenger paa plads j i et moenster som 'AAB'. */
  function moensterIndeks(moenster, j) { return moenster.charCodeAt(j % moenster.length) - 65; }
  function ugeFor(dag) { return UGER.filter(function (u) { return dag >= u.fra && dag <= u.til; })[0]; }

  rod.JulArk = {
    TITEL: TITEL, UNDERTITEL: UNDERTITEL, UGER: UGER, FIGURER: FIGURER, MOTIVER: MOTIVER, DAGE: DAGE,
    fraRim: fraRim, ordBillede: ordBillede, ordene: ordene, billeder: billeder, alleArk: alleArk, ugeFor: ugeFor, moensterIndeks: moensterIndeks
  };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
