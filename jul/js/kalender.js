/**
 * Pelles julekalender: de 24 dage uden skaerm, saa de kan testes i Node.
 *
 * Én fortaelling i 24 dele. Pelle Pindsvin har bygget en julestjerne af 24
 * smaa stykker glas, men vinterstormen blaeser den ned fra juletraeet, og
 * stykkerne flyver ud over hele den lille verden. Hver dag besoeger Pelle
 * et af spillenes steder sammen med Skaden Sanne, moeder stedets figur og
 * finder ét stykke. Juleaften lyser stjernen igen.
 *
 * Hver dag er tre afsnit med hvert sit malede billede (billeder/, 4:3) og
 * en lille opgave bagefter. Der er en uge pr. emne: 1.-7. tal og maengder,
 * 8.-14. bogstaver og lyde, 15.-21. rim og stavelser, 22.-24. faellesskab
 * og jul. I teksten stiller historien et spoergsmaal ({ spoerg, svar }),
 * holder en pause, saa boernene kan svare hoejt, og siger saa svaret.
 *
 * Teksten laeses af stemmen i hele saetninger (lyd/klip.json). Derfor er
 * replikkerne skrevet med tankestreg og uden anfoerselstegn, og der staar
 * aldrig "?" eller "!" midt i en saetning foer "siger Pelle": saetninger()
 * i js/stemme.js deler ved hvert punktum, spoergsmaalstegn og udraabstegn.
 * Tal staar med bogstaver, saa stemmen siger dem rigtigt.
 */
(function (rod) {
  'use strict';

  var TITEL = 'Pelles julekalender';

  var NAVNE = {
    pelle: 'Pelle Pindsvin', sanne: 'Skaden Sanne', egon: 'Egernet Egon', gustav: 'Grisen Gustav',
    bodil: 'Bæveren Bodil', klaus: 'Klaus', klara: 'Klara', rikke: 'Ræven Rikke', milo: 'Rummusen Milo',
    ulla: 'Uglen Ulla', rasmus: 'Robotten Rasmus', kaja: 'Kaninen Kaja', emil: 'Emil', ella: 'Ella',
    bo: 'Bjørnen Bo', nis: 'Nissen Nis'
  };

  /*
   * Hver dag:
   *   dag, titel, sted, spil (stien til spillet), emne (tal | bogstaver | rim | faellesskab), moeder (figurerne)
   *   afsnit: tre afsnit, hvert med billede og tekst. tekst er en liste af replikker (strenge) og
   *           spoergsmaal { spoerg, svar }, hvor der holdes en pause efter spoerg.
   *   stykke: hvor stjernestykket ligger i det tredje billede (broekdele af bredde og hoejde), saa
   *           boernene kan trykke paa det.
   *   opgave: den lille opgave efter historien, se nedenfor.
   *   udkast: true, saa laenge teksten kun er et resume.
   *
   * Opgaverne (alt, de siger, staar her, saa det kan indtales):
   *   tael   { ting, antal, spoerg }                       tryk paa hver ting, stemmen taeller med
   *   se     { runder: [{ ting, antal }], max, spoerg }    tingene vises kort, svaret gives paa en talraekke 1..max
   *   flest  { runder: [{ venstre, hoejre, ting }], spoerg } tryk paa den bunke, der er flest i
   *   spor   { bogstav, ord }                               tegn bogstavet med fingeren; bagefter "S som i sne."
   *   forlyd { lyd, eksempel, runder: [{ rigtig, andre }] } "Hvad starter med J, ligesom jul?"
   *   rim    { runder: [{ ord, rigtig, andre }] }          "Her har du ordet kat. Hvad rimer på det?"
   *   klap   { runder: [{ ord }] }                          klap stavelserne paa trommen
   *   pynt   { spoerg }                                     haeng pynt paa juletraeet, intet rigtigt eller forkert
   *   venner { spoerg }                                     vennerne kommer, og man taeller dem
   *   stjerne { spoerg }                                    saet det sidste stykke i, og stjernen lyser
   * Ordene i forlyd, rim og klap er Bogstavvejens og Rimhulens ting, saa billeder og ordklip findes.
   */
  var DAGE = [
    /* ---------- Uge 1: tal og maengder ---------- */
    {
      dag: 1, titel: 'Stjernen går i stykker', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'tal', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag01-1.jpg',
          tekst: [
            'Det er den første december, og der ligger sne over hele Nøddeskoven. Inde i sit værksted sidder Pelle Pindsvin og skruer de sidste skruer i noget meget fint.',
            'Det er en julestjerne. Pelle har bygget den af fireogtyve små stykker gyldent glas. Når den bliver tændt, lyser den som en lille sol.',
            '– Nu skal den op i toppen af juletræet, siger Pelle.',
            'Juletræet står midt i Nøddeskoven. Det er det største træ i hele skoven, og alle vennerne har været med til at pynte det. Der hænger kogler og kastanjer og små røde æbler på grenene. Men toppen er tom. Den venter på stjernen.',
            'Pelle bærer stjernen ud i sneen. Den glimter i det sidste lys fra solen. Oppe i en gren sidder Skaden Sanne. Hun elsker alt, der glimter.',
            '– Hvor er den smuk, siger Sanne. Må jeg hjælpe?',
            '– Ja tak, siger Pelle. Du kan flyve, og det kan jeg ikke. Kan du sætte den helt op i toppen?'
          ]
        },
        {
          billede: 'billeder/dag01-2.jpg',
          tekst: [
            'Sanne tager forsigtigt fat i stjernen med næbbet. Hun flyver op, op, op, forbi alle grenene, og sætter stjernen i toppen af træet.',
            '– Nu tænder vi den, siger Pelle. Vil I hjælpe med at tælle ned?',
            { spoerg: 'Tæl med. Fem. Fire. Tre. To. En.', svar: 'Nu!' },
            'Pelle trykker på knappen, og stjernen lyser. Den lyser så klart, at hele skoven bliver gylden.',
            'Men lige i det samme kommer der et vindstød. Et stort, koldt vindstød. Det er vinterstormen. Træet svajer frem og tilbage, stjernen vipper, og så falder den. Klirr!',
            'Stjernen går i stykker. Fireogtyve små, gyldne stykker flyver op i luften. Stormen tager dem med sig, ud over skoven, ud over bakkerne og ud i hele verden. Og så er det mørkt igen.',
            '– Åh nej, siger Pelle stille. Min stjerne.',
            'Sanne lander ved siden af ham i sneen. Pelle er ked af det, og det er helt i orden at være ked af det. Sanne sætter sig tæt op ad ham, så han ikke er alene.',
            { spoerg: 'Pelle kigger op i toppen af træet. Hvor mange stjerner er der nu?', svar: 'Ingen. Toppen er tom igen.' }
          ]
        },
        {
          billede: 'billeder/dag01-3.jpg',
          tekst: [
            'Så ser Sanne noget. Nede i sneen, lige under træet, er der noget, der glimter.',
            '– Pelle, se. Dernede.',
            'Pelle graver forsigtigt med poterne. Og dér ligger det: ét lille, gyldent stykke af stjernen. Det er lunt og lyser svagt, som en glød.',
            'Kan I se det? Det glimter i sneen.',
            '– Når vi kan finde ét, siger Sanne, så kan vi også finde resten. Jeg kan se alt, der glimter, når jeg flyver højt oppe. Jeg leder hver eneste dag.',
            '– Og jeg går med, siger Pelle. Vi finder et stykke om dagen, til vi har dem alle sammen. Og juleaften sætter vi stjernen sammen igen.',
            'Pelle lægger stykket i en lille æske med vat.',
            { spoerg: 'Hvor mange stykker har Pelle i æsken nu?', svar: 'Ét. Ét stykke er fundet.' },
            'Da Pelle går hjem, ser han noget mærkeligt i sneen. Små, bitte små fodspor. Meget mindre end hans egne. Hvem mon har gået her?',
            'Højt oppe flyver Sanne en sidste tur. Hun kalder ned til Pelle, at hun kan se noget glimte. Langt væk, oppe i en gammel stub, hvor der bor et egern.',
            '– Så går vi derhen i morgen, siger Pelle. God nat, Sanne.',
            '– God nat, Pelle.',
            'I morgen åbner vi låge nummer to.'
          ]
        }
      ],
      stykke: { x: 0.5, y: 0.8 },
      opgave: { type: 'tael', ting: 'julekugle', antal: 5, spoerg: 'Kan I tælle kuglerne på juletræet? Tryk på dem én ad gangen.' }
    },
    {
      dag: 2, titel: 'Egons nøddelager', sted: 'Egernreden', spil: 'games/egern/', emne: 'tal', moeder: ['egon'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag02-1.jpg', tekst: ['Pelle og Sanne kommer til Egernreden. Egernet Egon har samlet nødder til vinteren og gemt dem mange steder.'] },
        { billede: 'billeder/dag02-2.jpg', tekst: ['Egon viser nødderne et kort øjeblik. Man kan se, hvor mange de er, uden at tælle: to, tre, fire. Terningens mønstre.'] },
        { billede: 'billeder/dag02-3.jpg', tekst: ['Stykket ligger i Egons nøddelager mellem nødderne. Små krummer på stubben. Sanne ser noget glimte ved Skovkøkkenet.'] }
      ],
      stykke: { x: 0.55, y: 0.6 },
      opgave: { type: 'se', ting: 'nød', max: 5, runder: [{ antal: 3 }, { antal: 5 }, { antal: 4 }], spoerg: 'Kig godt. Hvor mange nødder så I?' }
    },
    {
      dag: 3, titel: 'Brunkager hos Gustav', sted: 'Skovkøkkenet', spil: 'games/restaurant/', emne: 'tal', moeder: ['gustav'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag03-1.jpg', tekst: ['Grisen Gustav bager brunkager til jul. Han lægger tre på hver række.'] },
        { billede: 'billeder/dag03-2.jpg', tekst: ['Pelle hjælper med at tælle. Tre og tre. En kage er væk, og der er bitte små krummer på bordet.'] },
        { billede: 'billeder/dag03-3.jpg', tekst: ['Stykket er bagt ind i dejen og glimter i ovnens lys. Sanne ser noget glimte ved dæmningen.'] }
      ],
      stykke: { x: 0.6, y: 0.55 },
      opgave: { type: 'tael', ting: 'kage', antal: 6, spoerg: 'Kan I tælle kagerne på pladen?' }
    },
    {
      dag: 4, titel: 'Den frosne dæmning', sted: 'Bæverdammen', spil: 'games/baever/', emne: 'tal', moeder: ['bodil'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag04-1.jpg', tekst: ['Vandet ved Bæverdammen er frosset. Bæveren Bodil har to bunker stammer.'] },
        { billede: 'billeder/dag04-2.jpg', tekst: ['Hvilken bunke har flest? Flere og færre. Man kan se det uden at tælle, når forskellen er stor.'] },
        { billede: 'billeder/dag04-3.jpg', tekst: ['Stykket sidder fast i isen. Bodil gnaver det fri. Sanne ser noget glimte ved Boldbanen.'] }
      ],
      stykke: { x: 0.45, y: 0.7 },
      opgave: { type: 'flest', ting: 'stamme', runder: [{ venstre: 4, hoejre: 2 }, { venstre: 3, hoejre: 6 }, { venstre: 5, hoejre: 4 }], spoerg: 'Hvor er der flest stammer?' }
    },
    {
      dag: 5, titel: 'Sneboldkampen', sted: 'Boldbanen', spil: 'games/klatbold/', emne: 'tal', moeder: ['klaus', 'klara'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag05-1.jpg', tekst: ['Klaus og Klara laver snebolde på Boldbanen. Klaus har fem, Klara har tre.'] },
        { billede: 'billeder/dag05-2.jpg', tekst: ['Hvem har flest? Hvor mange er der i alt? Fem og tre er otte.'] },
        { billede: 'billeder/dag05-3.jpg', tekst: ['Stykket er inde i en snebold. Sanne ser noget glimte ved Susebanen.'] }
      ],
      stykke: { x: 0.4, y: 0.75 },
      opgave: { type: 'flest', ting: 'snebold', runder: [{ venstre: 5, hoejre: 3 }, { venstre: 2, hoejre: 4 }, { venstre: 6, hoejre: 5 }], spoerg: 'Hvem har flest snebolde?' }
    },
    {
      dag: 6, titel: 'Kælketuren', sted: 'Susebanen', spil: 'games/racer/', emne: 'tal', moeder: ['rikke'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag06-1.jpg', tekst: ['Susebanen er dækket af sne. Ræven Rikke kører kælk i stedet for bil.'] },
        { billede: 'billeder/dag06-2.jpg', tekst: ['De tæller juletræerne langs banen. Seks er fem og én til. Bitte små fodspor ved siden af sporet.'] },
        { billede: 'billeder/dag06-3.jpg', tekst: ['Stykket ligger under målflaget. Sanne ser noget glimte højt oppe ved Stjerneuret.'] }
      ],
      stykke: { x: 0.7, y: 0.65 },
      opgave: { type: 'tael', ting: 'gran', antal: 6, spoerg: 'Kan I tælle juletræerne langs banen?' }
    },
    {
      dag: 7, titel: 'Syv stjerner', sted: 'Stjerneuret', spil: 'games/klokken/', emne: 'tal', moeder: ['milo'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag07-1.jpg', tekst: ['Om natten svæver Rummusen Milo ved Stjerneuret. Han viser Pelle et stjernebillede.'] },
        { billede: 'billeder/dag07-2.jpg', tekst: ['Stjernebilledet har syv stjerner: fem i en bue og to til. Fem og to er syv. Pelle har nu syv stykker, én for hver dag.'] },
        { billede: 'billeder/dag07-3.jpg', tekst: ['Stykket svæver mellem stjernerne, og Milo henter det. Sanne ser noget glimte på Bogstavvejen.'] }
      ],
      stykke: { x: 0.35, y: 0.3 },
      opgave: { type: 'se', ting: 'stjerne', max: 10, runder: [{ antal: 7 }, { antal: 5 }, { antal: 8 }], spoerg: 'Kig godt. Hvor mange stjerner så I?' }
    },

    /* ---------- Uge 2: bogstaver og lyde ---------- */
    {
      dag: 8, titel: 'S i sneen', sted: 'Bogstavvejen', spil: 'games/bogstaver/', emne: 'bogstaver', moeder: ['ulla'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag08-1.jpg', tekst: ['Uglen Ulla skriver bogstaver i sneen på Bogstavvejen.'] },
        { billede: 'billeder/dag08-2.jpg', tekst: ['S som i sne, stjerne og Sanne. Hvad starter ellers med S? Sol, sok, slæde.'] },
        { billede: 'billeder/dag08-3.jpg', tekst: ['Stykket ligger i krummen på det store S. Sanne ser noget glimte ved Himmelvejen.'] }
      ],
      stykke: { x: 0.5, y: 0.6 },
      opgave: { type: 'spor', bogstav: 'S', ord: 'S som i sne.' }
    },
    {
      dag: 9, titel: 'Julebrevene', sted: 'Himmelvejen', spil: 'games/flyv/', emne: 'bogstaver', moeder: ['sanne'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag09-1.jpg', tekst: ['Sanne flyver julebreve ud til alle dyrene på Himmelvejen. Pelle sidder på hendes ryg.'] },
        { billede: 'billeder/dag09-2.jpg', tekst: ['J som i jul, juletræ og jakke. Brevene skal til dem, hvis navn starter med J.'] },
        { billede: 'billeder/dag09-3.jpg', tekst: ['Stykket sidder i et fuglehus ved broen. Sanne ser noget glimte ved Tegnestuen.'] }
      ],
      stykke: { x: 0.6, y: 0.45 },
      opgave: { type: 'forlyd', lyd: 'J', eksempel: 'jul', runder: [{ rigtig: 'juletræ', andre: ['hus', 'bil'] }, { rigtig: 'jakke', andre: ['sol', 'fisk'] }, { rigtig: 'jordbær', andre: ['kat', 'tog'] }] }
    },
    {
      dag: 10, titel: 'Julekort hos Rasmus', sted: 'Tegnestuen', spil: 'games/tegn/', emne: 'bogstaver', moeder: ['rasmus'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag10-1.jpg', tekst: ['Robotten Rasmus tegner julekort i Tegnestuen.'] },
        { billede: 'billeder/dag10-2.jpg', tekst: ['N som i nisse, nød og næse. Rasmus finder en bitte lille tegning af en nissehue, som han ikke selv har tegnet.'] },
        { billede: 'billeder/dag10-3.jpg', tekst: ['Stykket ligger i farvekassen. Sanne ser noget glimte i Vrimleskoven.'] }
      ],
      stykke: { x: 0.3, y: 0.7 },
      opgave: { type: 'spor', bogstav: 'N', ord: 'N som i nisse.' }
    },
    {
      dag: 11, titel: 'Kaninens kane', sted: 'Vrimleskoven', spil: 'games/find/', emne: 'bogstaver', moeder: ['kaja'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag11-1.jpg', tekst: ['Kaninen Kaja kører kane gennem Vrimleskoven.'] },
        { billede: 'billeder/dag11-2.jpg', tekst: ['K som i Kaja, kane, kage og kat. Find tingene, der starter med K.'] },
        { billede: 'billeder/dag11-3.jpg', tekst: ['Stykket hænger i et vindue. Sanne ser noget glimte i Pelles have.'] }
      ],
      stykke: { x: 0.65, y: 0.4 },
      opgave: { type: 'forlyd', lyd: 'K', eksempel: 'kane', runder: [{ rigtig: 'kage', andre: ['sol', 'mus'] }, { rigtig: 'kat', andre: ['bi', 'tog'] }, { rigtig: 'krone', andre: ['hat', 'ugle'] }] }
    },
    {
      dag: 12, titel: 'Snemanden i haven', sted: 'Årstidshaven', spil: 'games/have/', emne: 'bogstaver', moeder: [], udkast: true,
      afsnit: [
        { billede: 'billeder/dag12-1.jpg', tekst: ['Pelles have er dækket af sne. Haven sover om vinteren.'] },
        { billede: 'billeder/dag12-2.jpg', tekst: ['Pelle og Sanne bygger en snemand. G som i gulerod, gave og gran.'] },
        { billede: 'billeder/dag12-3.jpg', tekst: ['Stykket ligger, hvor de graver en gulerod op. Sanne ser noget glimte ved Boblehavet.'] }
      ],
      stykke: { x: 0.5, y: 0.75 },
      opgave: { type: 'spor', bogstav: 'G', ord: 'G som i gulerod.' }
    },
    {
      dag: 13, titel: 'Is på havet', sted: 'Boblehavet', spil: 'games/bobler/', emne: 'bogstaver', moeder: ['emil', 'ella'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag13-1.jpg', tekst: ['Boblehavet er frosset langs kanten. Emil og Ella står på stranden.'] },
        { billede: 'billeder/dag13-2.jpg', tekst: ['E som i Emil og Ella, elefant og egern. Begge deres navne starter med E. En rød tråd på stranden.'] },
        { billede: 'billeder/dag13-3.jpg', tekst: ['Stykket er inde i en frossen boble. Sanne ser noget glimte hjemme i Nøddeskoven.'] }
      ],
      stykke: { x: 0.55, y: 0.5 },
      opgave: { type: 'forlyd', lyd: 'E', eksempel: 'Emil', runder: [{ rigtig: 'elefant', andre: ['tog', 'ko'] }, { rigtig: 'egern', andre: ['sko', 'hund'] }, { rigtig: 'edderkop', andre: ['bil', 'måne'] }] }
    },
    {
      dag: 14, titel: 'Pakker og pynt', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'bogstaver', moeder: ['sanne'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag14-1.jpg', tekst: ['Pelle er hjemme i værkstedet og pakker gaver ind. Halvvejs: fjorten stykker.'] },
        { billede: 'billeder/dag14-2.jpg', tekst: ['P som i Pelle, pakke, pynt og pandekage.'] },
        { billede: 'billeder/dag14-3.jpg', tekst: ['Stykket ligger i en pakke, der står på trappen. Hvem har sat den der? Sanne ser noget glimte ved Rimhulen.'] }
      ],
      stykke: { x: 0.45, y: 0.7 },
      opgave: { type: 'spor', bogstav: 'P', ord: 'P som i Pelle.' }
    },

    /* ---------- Uge 3: rim og stavelser ---------- */
    {
      dag: 15, titel: 'Bo sover', sted: 'Rimhulen', spil: 'games/rim/', emne: 'rim', moeder: ['bo'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag15-1.jpg', tekst: ['Bjørnen Bo sover i Rimhulen. Bjørne sover det meste af vinteren.'] },
        { billede: 'billeder/dag15-2.jpg', tekst: ['Bo taler i søvne, og alt han siger, rimer. Bjørn og ørn. Sol og stol.'] },
        { billede: 'billeder/dag15-3.jpg', tekst: ['Stykket ligger i Bos pote. De lister ud uden at vække ham. Sanne ser noget glimte ved Skovkøkkenet.'] }
      ],
      stykke: { x: 0.5, y: 0.65 },
      opgave: { type: 'rim', runder: [{ ord: 'bjørn', rigtig: 'ørn', andre: ['hus', 'kage'] }, { ord: 'sol', rigtig: 'stol', andre: ['bil', 'fisk'] }, { ord: 'mus', rigtig: 'hus', andre: ['sko', 'ugle'] }] }
    },
    {
      dag: 16, titel: 'Risengrød', sted: 'Skovkøkkenet', spil: 'games/restaurant/', emne: 'rim', moeder: ['gustav'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag16-1.jpg', tekst: ['Gustav koger risengrød. Ri-sen-grød. Tre klap.'] },
        { billede: 'billeder/dag16-2.jpg', tekst: ['De klapper ordene: kage, to klap. Pandekage, fire klap. Om natten er grødskålen ved døren slikket ren.'] },
        { billede: 'billeder/dag16-3.jpg', tekst: ['Stykket ligger i bunden af gryden. Sanne ser noget glimte ved Egernreden.'] }
      ],
      stykke: { x: 0.5, y: 0.6 },
      opgave: { type: 'klap', runder: [{ ord: 'kage' }, { ord: 'juletræ' }, { ord: 'pandekage' }] }
    },
    {
      dag: 17, titel: 'Egons rimesang', sted: 'Egernreden', spil: 'games/egern/', emne: 'rim', moeder: ['egon'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag17-1.jpg', tekst: ['Egon synger en sang, hvor alt rimer.'] },
        { billede: 'billeder/dag17-2.jpg', tekst: ['Is og gris. Tog og bog. Ø og frø.'] },
        { billede: 'billeder/dag17-3.jpg', tekst: ['Stykket ligger i reden. Sanne ser noget glimte ved Stjerneuret.'] }
      ],
      stykke: { x: 0.4, y: 0.5 },
      opgave: { type: 'rim', runder: [{ ord: 'is', rigtig: 'gris', andre: ['bil', 'måne'] }, { ord: 'tog', rigtig: 'bog', andre: ['kat', 'sol'] }, { ord: 'ø', rigtig: 'frø', andre: ['hund', 'ko'] }] }
    },
    {
      dag: 18, titel: 'Raketten', sted: 'Stjerneuret', spil: 'games/klokken/', emne: 'rim', moeder: ['milo'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag18-1.jpg', tekst: ['Milo tager Pelle med i sin raket.'] },
        { billede: 'billeder/dag18-2.jpg', tekst: ['Ra-ket, to klap. Må-ne, to klap. Mi-lo, to klap. Pa-ra-ply, tre klap.'] },
        { billede: 'billeder/dag18-3.jpg', tekst: ['Stykket svæver ved månen. Sanne ser noget glimte ved Boldbanen.'] }
      ],
      stykke: { x: 0.7, y: 0.3 },
      opgave: { type: 'klap', runder: [{ ord: 'raket' }, { ord: 'måne' }, { ord: 'paraply' }] }
    },
    {
      dag: 19, titel: 'Klatternes julesang', sted: 'Boldbanen', spil: 'games/klatbold/', emne: 'rim', moeder: ['klaus', 'klara'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag19-1.jpg', tekst: ['Klaus og Klara øver en julesang.'] },
        { billede: 'billeder/dag19-2.jpg', tekst: ['Sangen mangler et ord, der rimer. Ko og sko. Bil og pil. Hund og mund.'] },
        { billede: 'billeder/dag19-3.jpg', tekst: ['Stykket ligger i målet. Sanne ser noget glimte ved Bæverdammen.'] }
      ],
      stykke: { x: 0.5, y: 0.55 },
      opgave: { type: 'rim', runder: [{ ord: 'ko', rigtig: 'sko', andre: ['hat', 'fisk'] }, { ord: 'bil', rigtig: 'pil', andre: ['sol', 'mus'] }, { ord: 'hund', rigtig: 'mund', andre: ['kage', 'tog'] }] }
    },
    {
      dag: 20, titel: 'Bodils gaver', sted: 'Bæverdammen', spil: 'games/baever/', emne: 'rim', moeder: ['bodil'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag20-1.jpg', tekst: ['Bodil laver gaver af træ.'] },
        { billede: 'billeder/dag20-2.jpg', tekst: ['Bo-dil, to klap. Gave, to klap. Sommerfugl, tre klap. Træ, ét klap.'] },
        { billede: 'billeder/dag20-3.jpg', tekst: ['Stykket ligger i dæmningen. Sanne ser noget glimte ved Susebanen.'] }
      ],
      stykke: { x: 0.5, y: 0.6 },
      opgave: { type: 'klap', runder: [{ ord: 'gave' }, { ord: 'sommerfugl' }, { ord: 'træ' }] }
    },
    {
      dag: 21, titel: 'Rikkes rim', sted: 'Susebanen', spil: 'games/racer/', emne: 'rim', moeder: ['rikke'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag21-1.jpg', tekst: ['Rikke kører den sidste tur før jul.'] },
        { billede: 'billeder/dag21-2.jpg', tekst: ['Fly og sky. And og vand. Ur og mur.'] },
        { billede: 'billeder/dag21-3.jpg', tekst: ['Stykket ligger i et sving. Sanne ser noget glimte ved Himmelvejen.'] }
      ],
      stykke: { x: 0.3, y: 0.6 },
      opgave: { type: 'rim', runder: [{ ord: 'fly', rigtig: 'sky', andre: ['ko', 'hat'] }, { ord: 'and', rigtig: 'vand', andre: ['bil', 'mus'] }, { ord: 'ur', rigtig: 'mur', andre: ['sol', 'fisk'] }] }
    },

    /* ---------- Faellesskab og jul ---------- */
    {
      dag: 22, titel: 'Invitationerne', sted: 'Himmelvejen', spil: 'games/flyv/', emne: 'faellesskab', moeder: ['sanne'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag22-1.jpg', tekst: ['Sanne flyver invitationer ud til alle vennerne: kom til juletræet juleaften.'] },
        { billede: 'billeder/dag22-2.jpg', tekst: ['Sanne er bekymret for, om nogen bliver glemt. Alle skal være med.'] },
        { billede: 'billeder/dag22-3.jpg', tekst: ['Stykket sidder i en sky. Én invitation er uden navn: til den lille, der går med de små fodspor.'] }
      ],
      stykke: { x: 0.5, y: 0.35 },
      opgave: { type: 'pynt', spoerg: 'Hæng pynt på juletræet. Tryk på pynten, og træk den op på en gren.' }
    },
    {
      dag: 23, titel: 'Lillejuleaften', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'faellesskab', moeder: ['sanne'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag23-1.jpg', tekst: ['Alle vennerne kommer til Nøddeskoven og hjælper. Det er svært at vente.'] },
        { billede: 'billeder/dag23-2.jpg', tekst: ['De lægger stykkerne sammen. Treogtyve. Ét mangler stadig.'] },
        { billede: 'billeder/dag23-3.jpg', tekst: ['Om aftenen sætter Pelle en skål risengrød ud ved døren. I morgen er det juleaften.'] }
      ],
      stykke: { x: 0.5, y: 0.7 },
      opgave: { type: 'venner', spoerg: 'Nu kommer vennerne. Kan I tælle dem?' }
    },
    {
      dag: 24, titel: 'Juleaften', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'faellesskab', moeder: ['sanne', 'nis'], udkast: true,
      afsnit: [
        { billede: 'billeder/dag24-1.jpg', tekst: ['Juleaften. Alle står om juletræet. Så kommer en lille nisse frem: Nissen Nis.'] },
        { billede: 'billeder/dag24-2.jpg', tekst: ['Nis har passet på det sidste stykke siden stormen. Han turde ikke komme frem, men invitationen var til ham.'] },
        { billede: 'billeder/dag24-3.jpg', tekst: ['Stjernen bliver sat sammen, og den lyser. Alle danser om juletræet. Glædelig jul.'] }
      ],
      stykke: { x: 0.5, y: 0.2 },
      opgave: { type: 'stjerne', spoerg: 'Sæt det sidste stykke i stjernen. Tryk på det.' }
    }
  ];

  /**
   * Maa lagen aabnes paa denne dato? I december aabner lagerne frem til i dag, i november er
   * de alle lukket, og resten af aaret (efter jul) kan de alle aabnes. dato er en Date.
   */
  function aaben(dag, dato) {
    var m = dato.getMonth();
    if (m === 11) return dag <= dato.getDate();
    if (m === 10) return false;
    return true;
  }

  /** Alt, kalenderen kan sige, som saetninger: til lydvaerktoejet og til testen. */
  function replikker() {
    var ud = [];
    DAGE.forEach(function (d) {
      d.afsnit.forEach(function (a) {
        a.tekst.forEach(function (t) {
          if (typeof t === 'string') ud.push(t);
          else { ud.push(t.spoerg); ud.push(t.svar); }
        });
      });
    });
    return ud;
  }

  rod.Kalender = { TITEL: TITEL, NAVNE: NAVNE, DAGE: DAGE, aaben: aaben, replikker: replikker };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
