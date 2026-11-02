/**
 * Pelles julekalender: de 24 dage uden skaerm, saa de kan testes i Node.
 *
 * Én fortaelling i 24 dele. Pelle Pindsvin har lavet et julepuslespil af
 * trae med 24 brikker og malet alle vennerne om juletraeet paa det. Men
 * vinterstormen blaeser brikkerne ud over hele den lille verden. Hver dag
 * besoeger Pelle et af spillenes steder sammen med Skaden Sanne, moeder
 * stedets figur og finder én brik, og boernene laegger den i puslespillet.
 * Juleaften er puslespillet samlet, og billedet paa det bliver til virkelighed.
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
   *   brik:   hvor dagens puslespilsbrik ligger i det tredje billede (broekdele af bredde og hoejde),
   *           saa boernene kan trykke paa den og laegge den i puslespillet.
   *   opgave: den lille opgave efter historien, se nedenfor.
   *   udkast: true, saa laenge teksten kun er et resume.
   *
   * Opgaverne (alt, de siger, staar her, saa det kan indtales). Hver opgave er 2-4 minutter
   * i flere dele, let foerst og saa svaerere; opgaver.js goer dem til dele (se dér):
   *   tael   { runder: [{ ting, antal, spoerg, efter: [{ plus | minus, tekst, stil, spoerg }] }] }
   *          tael 8-15 ting, og bagefter "Der kommer to til. Hvor mange er der nu?" paa en talraekke
   *   se     { ting, max, spoerg, runder: [{ antal, moenster, vis, mangler }] }
   *          tingene ses kort (terning, tierramme), svaret paa en talraekke; mangler: "... foer der er ti?"
   *   flest  { ting, spoerg, runder: [{ venstre, hoejre, raekke }] }  flest, og saa "Hvor mange flere er der?"
   *   regn   { ting, runder: [{ tekst, foer, plus | minus, daek, figur }] }
   *          en regnehistorie i tre saetninger; daek: tingene ligger under noget, saa man skal taenke
   *   spor   { bogstav, ord, eksempel, find: [{ rigtige, andre }], hvilket: [{ ord, valg }] }
   *          det store og det lille bogstav, to billeder med lyden, og hvilket bogstav et ord starter med
   *   forlyd { lyd, eksempel, runder: [{ rigtige, andre }], hvilket: [{ ord, valg }] }
   *   rim    { runder: [{ ord, rigtig, andre }], ikke: [[tre ord]], par: [[fire ord]] }
   *   klap   { runder: [{ ord }], flest: [[to ord]] }
   *   pynt   { spoerg, moenstre: [{ moenster: 'AB' | 'AAB' | 'ABC', dele, vist, mangler, valg }] }
   *          guirlandens moenstre, og saa fri pynt paa juletraeet
   *   venner { spoerg, grupper: [{ tekst, ting, foer }], sorter: [figurer] }
   *   puslespil { spoergLoese, spoerg }   fem loese brikker og saa Nis' sidste brik
   * Ordene i forlyd, rim og klap er Bogstavvejens og Rimhulens ting, saa billeder og ordklip findes.
   */
  var DAGE = [
    /* ---------- Uge 1: tal og maengder ---------- */
    {
      dag: 1, titel: 'Stormen', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'tal', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag01-1.jpg',
          tekst: [
            'Det er den første december, og der ligger sne over hele Nøddeskoven. Inde i sit værksted sidder Pelle Pindsvin og maler de sidste streger på noget meget fint.',
            'Det er et julepuslespil. Pelle har savet det ud af træ, og det har fireogtyve brikker. Hver brik har sin egen form og en tynd, gylden kant, der glimter.',
            'På puslespillet har Pelle malet et billede af alle sine venner. De står om juletræet og holder hinanden i hånden, og det er juleaften.',
            '– Det er min julegave til dem alle sammen, siger Pelle. Juleaften lægger vi det sammen.',
            'Pelle bærer puslespillet ud i sneen og lægger det på den store stub under juletræet. Træet er det største i hele skoven, og der hænger kogler og kastanjer og små røde æbler på grenene.',
            'Oppe i en gren sidder Skaden Sanne. Hun elsker alt, der glimter, og de gyldne kanter glimter i det sidste lys fra solen.',
            '– Hvor er det smukt, siger Sanne. Må jeg se?'
          ]
        },
        {
          billede: 'billeder/dag01-2.jpg',
          tekst: [
            'Sanne hopper ned på stubben. Hun kigger på brikkerne, og så kigger hun på hjørnerne.',
            '– Brikkerne i hjørnerne er de letteste, siger Pelle. De har to lige kanter.',
            { spoerg: 'Hvor mange hjørner har et puslespil?', svar: 'Fire. Ét, to, tre, fire hjørner.' },
            'Men lige i det samme kommer der et vindstød. Et stort, koldt vindstød. Det er vinterstormen.',
            'Træet svajer frem og tilbage, sneen hvirvler op, og alle brikkerne letter fra stubben. Fireogtyve små brikker flyver op i luften. Stormen tager dem med sig, ud over skoven, ud over bakkerne og ud i hele verden.',
            'Og så er det stille igen.',
            '– Åh nej, siger Pelle stille. Mit puslespil.',
            'Sanne sætter sig ved siden af ham i sneen. Pelle er ked af det, og det er helt i orden at være ked af det. Sanne sætter sig tæt op ad ham, så han ikke er alene.',
            { spoerg: 'Hvor mange brikker ligger der på stubben nu?', svar: 'Ingen. Stubben er tom.' }
          ]
        },
        {
          billede: 'billeder/dag01-3.jpg',
          tekst: [
            'Så ser Sanne noget. Nede i sneen, lige under træet, er der noget, der glimter.',
            '– Pelle, se. Dernede.',
            'Pelle graver forsigtigt med poterne. Og dér ligger den: én lille brik med en gylden kant.',
            'Kan I se den? Den glimter i sneen.',
            '– Når vi kan finde én, siger Sanne, så kan vi også finde resten. Jeg kan se alt, der glimter, når jeg flyver højt oppe. Jeg leder hver eneste dag.',
            '– Og jeg går med, siger Pelle. Vi finder en brik om dagen, til vi har dem alle sammen. Og juleaften lægger vi puslespillet sammen.',
            'Pelle lægger brikken i en lille æske.',
            { spoerg: 'Hvor mange brikker har Pelle i æsken nu?', svar: 'Én. Én brik er fundet.' },
            'Da Pelle går hjem, ser han noget mærkeligt i sneen. Små, bitte små fodspor. Meget mindre end hans egne. Hvem mon har gået her?',
            'Højt oppe flyver Sanne en sidste tur. Hun kalder ned til Pelle, at hun kan se noget glimte. Langt væk, oppe i en gammel stub, hvor der bor et egern.',
            '– Så går vi derhen i morgen, siger Pelle. God nat, Sanne.',
            '– God nat, Pelle.',
            'I morgen åbner vi låge nummer to.'
          ]
        }
      ],
      brik: { x: 0.76, y: 0.87 },
      opgave: {
        type: 'tael',
        runder: [
          { ting: 'julekugle', antal: 8, spoerg: 'Kan I tælle kuglerne på juletræet? Tryk på dem én ad gangen.',
            efter: [{ plus: 2 }, { minus: 1, tekst: 'Sanne tager én.' }] },
          { ting: 'æble', antal: 12, spoerg: 'Stormen har blæst æblerne ned i sneen. Kan I tælle dem?',
            efter: [{ minus: 4, tekst: 'Pelle samler fire op.' }] }
        ]
      }
    },
    {
      dag: 2, titel: 'Egons nøddelager', sted: 'Egernreden', spil: 'games/egern/', emne: 'tal', moeder: ['egon'],
      afsnit: [
        {
          billede: 'billeder/dag02-1.jpg',
          tekst: [
            'Det er morgen, og det er koldt. Pelle har sit tykke halstørklæde på og den lille æske under armen. Inde i æsken ligger brikken fra i går.',
            'Skaden Sanne flyver foran og viser vejen. Over bakken, forbi det frosne vandløb og hen til en gammel, gammel stub. Den er så stor, at der er plads til et helt hjem inde i den.',
            'Her bor Egernet Egon. Han har en stor, rød hale og et lille hul i stubben til hver eneste ting, han ejer.',
            '– Godmorgen, Egon, siger Pelle.',
            '– Godmorgen, godmorgen, siger Egon. Undskyld, jeg har så travlt. Jeg skal tælle mine nødder.',
            'Hele efteråret har Egon samlet nødder til vinteren. Han har gemt dem i små huller rundt om i stubben, og over hvert hul har han lagt et lille låg af bark.',
            '– I nat kom stormen, siger Egon. Den blæste alle mine låg af. Nu ved jeg ikke, om der stadig er nødder nok.',
            '– Så tæller vi sammen, siger Pelle. Og så kigger vi efter noget, der glimter.'
          ]
        },
        {
          billede: 'billeder/dag02-2.jpg',
          tekst: [
            'Egon løfter det første låg. Men kun et kort øjeblik, for nødderne må ikke blive kolde.',
            '– Man kan godt se, hvor mange der er, uden at tælle, siger Egon. Hvis man kigger rigtig godt.',
            { spoerg: 'Der lå nødderne på række. Hvor mange var der?', svar: 'Tre. Tre nødder på en lige række.' },
            'Egon løfter det næste låg. Her ligger nødderne ligesom prikkerne på en terning. Én i hvert hjørne og én i midten.',
            { spoerg: 'Hvor mange nødder er der, når de ligger som på en terning?', svar: 'Fem. Fire i hjørnerne og én i midten.' },
            '– Du er god til det, siger Pelle.',
            '– Det er fordi, jeg altid lægger dem pænt, siger Egon og retter på sin hale. Når de ligger pænt, kan man se det med det samme.',
            'Under det tredje låg ligger der to nødder øverst og to nødder nederst.',
            { spoerg: 'To og to. Hvor mange er det?', svar: 'Fire. To og to er fire.' },
            '– Der er nok, siger Egon glad. Der er nok til hele vinteren.'
          ]
        },
        {
          billede: 'billeder/dag02-3.jpg',
          tekst: [
            'Der er kun ét hul tilbage. Det sidder helt oppe i toppen af stubben, og låget er væk. Sanne flyver derop og kigger ned.',
            '– Der ligger nødder, siger hun. Og der ligger noget mere. Noget, der glimter.',
            'Egon klatrer op med sin store hale bag sig. Han stikker poten ned i hullet, og så kommer den op igen med en lille brik med gylden kant.',
            'Kan I se den? Den ligger lige dér mellem nødderne.',
            '– Den faldt ned i nat, siger Egon. Jeg troede, det var en meget mærkelig nød.',
            'Pelle griner. Han lægger brikken i sin æske, ved siden af den fra i går.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'To. Én fra i går og én fra i dag.' },
            'Egon giver Pelle tre nødder med på vejen. En til Pelle, en til Sanne, og en til den, der har brug for den.',
            'Da de går, kigger Sanne op i luften. Langt væk stiger der røg op fra en skorsten. Det dufter af kanel og sirup. Og midt i røgen glimter det.',
            '– Det er Skovkøkkenet, siger Sanne. Der skal vi hen i morgen.',
            'I morgen åbner vi låge nummer tre.'
          ]
        }
      ],
      brik: { x: 0.53, y: 0.2 },
      opgave: {
        type: 'se', ting: 'nød', max: 10, spoerg: 'Kig godt. Hvor mange nødder så I?',
        runder: [
          { antal: 5, moenster: 'terning', vis: 2.5 }, { antal: 6, moenster: 'terning', vis: 2 },
          { antal: 7, moenster: 'tierramme', vis: 2, mangler: true }, { antal: 9, moenster: 'tierramme', vis: 1.5, mangler: true },
          { antal: 8, moenster: 'tierramme', vis: 1, mangler: true }
        ]
      }
    },
    {
      dag: 3, titel: 'Brunkager hos Gustav', sted: 'Skovkøkkenet', spil: 'games/restaurant/', emne: 'tal', moeder: ['gustav'],
      afsnit: [
        {
          billede: 'billeder/dag03-1.jpg',
          tekst: [
            'Allerede på vejen kan Pelle og Sanne dufte det. Kanel og sirup og smør. Det dufter af jul.',
            'I Skovkøkkenet står Grisen Gustav ved bordet med mel på trynen og et stort forklæde på. Han bager brunkager til julefesten.',
            '– Kom ind, kom ind, siger Gustav. Luk døren, så kulden bliver ude.',
            'Inde i køkkenet er det varmt. Ovnen knitrer, og vinduerne er duggede. Gustav ruller dejen ud, så den bliver tynd og flad. Så stikker han kager ud med små forme. En stjerne. Et hjerte. Et juletræ.',
            '– Må vi hjælpe, spørger Pelle.',
            '– Det må I gerne, siger Gustav. Man skal være mange om at bage til jul.'
          ]
        },
        {
          billede: 'billeder/dag03-2.jpg',
          tekst: [
            'Gustav lægger kagerne på bagepladen. Tre på den første række.',
            '– Og tre på den næste række, siger han.',
            { spoerg: 'Tre kager og tre kager. Hvor mange kager er der på pladen?', svar: 'Seks. Tre og tre er seks.' },
            'Pladen kommer i ovnen, og de venter. Det er svært at vente, når det dufter så godt. Pelle tæller langsomt til ti, og så tæller han til ti igen.',
            'Endelig er kagerne færdige. Gustav sætter pladen i vindueskarmen, så de kan blive kolde.',
            'Men da de kigger igen, er der noget, der ikke passer. På den ene række ligger der stadig tre kager. På den anden række ligger der kun to.',
            { spoerg: 'Hvor mange kager mangler der?', svar: 'Én. Der mangler én kage.' },
            'På bordet ligger der bitte små krummer. De går hen over bordet, op ad vindueskarmen og ud gennem en lille sprække i vinduet.',
            'Pelle tænker på de små fodspor i sneen. Mon det er den samme, der har været her?',
            '– Så var der én, der var sulten, siger Gustav og smiler. Det er i orden. I julen deler man.'
          ]
        },
        {
          billede: 'billeder/dag03-3.jpg',
          tekst: [
            'Gustav vil bage en plade til. Han stikker armen ned i den store melsæk og ...',
            '– Hov, siger han. Der er noget hårdt i melet.',
            'Han trækker poten op. Den er hvid af mel, og i den holder han en lille brik med gylden kant. Den må være faldet ned gennem skorstenen i stormen.',
            'Kan I se den? Den glimter i melsækken.',
            'Pelle blæser melet af brikken og lægger den i sin æske.',
            { spoerg: 'I går havde Pelle to brikker. Nu får han én til. Hvor mange har han så?', svar: 'Tre. To og én er tre.' },
            'Gustav pakker brunkager ind i et viskestykke til dem. Tre til Pelle, tre til Sanne, og én ekstra, som Pelle lægger i sneen uden for døren. Til den, der var sulten.',
            'Da de går hjem, er solen ved at gå ned. Sanne flyver højt op og kigger ud over landet. Langt væk ligger et vand, der er frosset til is. Og nede i isen glimter det.',
            '– Det er ved Bæverdammen, siger Sanne.',
            'I morgen åbner vi låge nummer fire.'
          ]
        }
      ],
      brik: { x: 0.72, y: 0.66 },
      opgave: {
        type: 'regn', ting: 'kage',
        foerst: { antal: 9, spoerg: 'Gustav har bagt brunkager. Kan I tælle dem? Tryk på dem én ad gangen.' },
        runder: [
          { tekst: 'Gustav har fem kager. Han bager tre mere. Hvor mange har han nu?', foer: 5, plus: 3, figur: ['gustav'] },
          { tekst: 'Der ligger syv kager på pladen. Nogen spiser to. Hvor mange er der tilbage?', foer: 7, minus: 2 },
          { tekst: 'Seks kager ligger under viskestykket. Gustav bager tre mere. Hvor mange er der nu?', foer: 6, plus: 3, daek: 'klud', figur: ['gustav'] },
          { tekst: 'Ti kager ligger under viskestykket. Nogen tager tre. Hvor mange er der tilbage?', foer: 10, minus: 3, daek: 'klud' }
        ]
      }
    },
    {
      dag: 4, titel: 'Den frosne dæmning', sted: 'Bæverdammen', spil: 'games/baever/', emne: 'tal', moeder: ['bodil'],
      afsnit: [
        {
          billede: 'billeder/dag04-1.jpg',
          tekst: [
            'I nat har frosten været der. Græsset er hvidt og stift, og det knaser, når Pelle går.',
            'Ved Bæverdammen er vandet frosset til is. Det er blankt som et spejl, og man kan se sit eget ansigt i det.',
            'Midt på isen sidder Bæveren Bodil. Hun har en flad hale, to store tænder og en masse træstammer omkring sig.',
            '– Hej Bodil, siger Pelle. Hvad laver du?',
            '– Jeg rydder op, siger Bodil. Stormen har væltet min dæmning, og nu ligger mine stammer i to bunker. Til foråret skal jeg bygge den op igen. Så jeg skal vide, hvor jeg har flest.',
            'Sanne lander på en af stammerne og ser sig omkring.'
          ]
        },
        {
          billede: 'billeder/dag04-2.jpg',
          tekst: [
            'I den ene bunke ligger der mange stammer. I den anden bunke ligger der kun få.',
            { spoerg: 'Hvilken bunke har flest stammer, den store eller den lille?', svar: 'Den store bunke. Det kan man se uden at tælle.' },
            '– Når den ene bunke er meget større, kan man se det med det samme, siger Bodil. Men nu bliver det svært.',
            'Hun skubber stammerne rundt med halen. Nu ligger der fire stammer i den ene bunke og fem stammer i den anden.',
            '– Når de næsten er lige store, så må man tælle, siger Bodil.',
            { spoerg: 'Fire stammer og fem stammer. Hvor er der flest?', svar: 'Ved de fem. Fem er én mere end fire.' },
            'Til sidst lægger Bodil tre stammer i hver bunke.',
            { spoerg: 'Tre og tre. Hvor er der flest nu?', svar: 'Ingen af dem. Der er lige mange.' },
            '– Lige mange, siger Bodil tilfreds. Så er det retfærdigt.'
          ]
        },
        {
          billede: 'billeder/dag04-3.jpg',
          tekst: [
            'Pludselig stopper Sanne. Hun stirrer ned i isen.',
            '– Se, hvisker hun. Dernede.',
            'Under isen, ikke ret langt nede, ligger der en lille brik med gylden kant. Den er frosset fast.',
            'Kan I se den? Den glimter under isen.',
            '– Den kan vi ikke nå, siger Pelle. Isen er for hård.',
            '– Det kan jeg klare, siger Bodil. Hun løfter sin store, flade hale og slår den ned i isen.',
            { spoerg: 'Tæl med, hver gang Bodil slår. Bank. Bank. Bank.', svar: 'Tre. Tre gange, og så knækker isen.' },
            'Isen knækker med et lille knæk, og Bodil fisker brikken op med poten. Den er kold og våd, men den er hel.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Fire. Én for hver dag.' },
            '– Tak, Bodil, siger Pelle. Og til foråret kommer jeg og hjælper dig med dæmningen.',
            'På vejen hjem hører de nogen grine. Langt væk, på en stor, hvid bane, ruller der to runde væsner rundt i sneen. Det ene er rødt, og det andet er blåt.',
            '– Klatterne, siger Sanne. Og der er noget, der glimter hos dem.',
            'I morgen åbner vi låge nummer fem.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.7 },
      opgave: {
        type: 'flest', ting: 'stamme', spoerg: 'Hvor er der flest stammer?',
        runder: [{ venstre: 7, hoejre: 4, raekke: true }, { venstre: 5, hoejre: 9, raekke: true }, { venstre: 6, hoejre: 8 }, { venstre: 10, hoejre: 7 }, { venstre: 8, hoejre: 9 }]
      }
    },
    {
      dag: 5, titel: 'Sneboldene', sted: 'Boldbanen', spil: 'games/klatbold/', emne: 'tal', moeder: ['klaus', 'klara'],
      afsnit: [
        {
          billede: 'billeder/dag05-1.jpg',
          tekst: [
            'Boldbanen er helt hvid. Målene har fået hvide huer på, og sneen er så dyb, at den når Pelle til knæene.',
            'Midt på banen ruller Klaus og Klara rundt. Klaus er rød, og Klara er blå. De er runde og bløde, og når de ruller i sneen, bliver de til to store snebolde med øjne.',
            '– Pelle, råber Klara. Vi laver snebolde. Vil du være med?',
            '– Ja tak, siger Pelle. Men vi leder også efter en brik med gylden kant.',
            '– Så leder vi, mens vi laver snebolde, siger Klaus.',
            'Klaus og Klara er rigtig gode til at lave snebolde. De triller dem bare rundt i sneen, så bliver de runde af sig selv.'
          ]
        },
        {
          billede: 'billeder/dag05-2.jpg',
          tekst: [
            'Efter lidt tid har Klaus lavet fem snebolde. De ligger på en lang række. Klara har lavet tre.',
            { spoerg: 'Klaus har fem, og Klara har tre. Hvem har flest?', svar: 'Klaus. Fem er flere end tre.' },
            'Klara kigger på sine snebolde. Hun synes, det er lidt snyd.',
            '– Jeg vil have lige så mange som dig, siger hun.',
            { spoerg: 'Klara har tre. Hvor mange skal hun lave, før hun har fem?', svar: 'To. Tre og to er fem.' },
            'Klara triller to snebolde mere, og så har de fem hver.',
            '– Nu har vi lige mange, siger Klara glad.',
            'Pelle holder sine poter op. Fem fingre på den ene pote og fem på den anden.',
            { spoerg: 'Fem og fem. Hvor mange er det?', svar: 'Ti. Lige så mange som fingrene på to hænder.' }
          ]
        },
        {
          billede: 'billeder/dag05-3.jpg',
          tekst: [
            'Af alle ti snebolde bygger de en stor snemand. To store kugler forneden, en mindre ovenpå, og et hoved med to kastanjer til øjne.',
            'Men da de sætter den midterste kugle på plads, ser Sanne noget. Inde i sneen, lige midt i snemandens mave, glimter det.',
            'Kan I se det? Det glimter i snemandens mave.',
            '– Den må være blevet trillet med, siger Klaus. Da jeg lavede den store snebold.',
            'Klara graver forsigtigt med sin bløde, blå arm. Og så kommer den frem: en lille brik med gylden kant.',
            'Pelle tager imod den og lægger den i sin æske.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Fem. Lige så mange som fingrene på én hånd.' },
            'Snemanden har nu et lille hul i maven. Klara stopper en kastanje i hullet. Så ser det ud, som om snemanden har en navle. Alle griner.',
            'Sanne flyver højt op. Bag bakken ligger der en lang, snoet bane med juletræer langs kanten.',
            '– Susebanen, siger Sanne. Dér glimter det.',
            'I morgen åbner vi låge nummer seks.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.6 },
      opgave: {
        type: 'regn', ting: 'snebold',
        foerst: { antal: 10, spoerg: 'Klaus og Klara har lavet snebolde. Kan I tælle dem?' },
        runder: [
          { tekst: 'Klaus har fem snebolde. Klara har tre. Hvor mange har de tilsammen?', foer: 5, plus: 3, figur: ['klaus', 'klara'] },
          { tekst: 'Der ligger ni snebolde. Klaus kaster fire. Hvor mange er der tilbage?', foer: 9, minus: 4, figur: ['klaus'] },
          { tekst: 'Fire snebolde ligger bag snemanden. Klaus triller fem til. Hvor mange er der nu?', foer: 4, plus: 5, daek: 'snemand', figur: ['klaus'] },
          { tekst: 'Otte snebolde ligger bag snemanden. Klara triller to væk. Hvor mange er der tilbage?', foer: 8, minus: 2, daek: 'snemand', figur: ['klara'] }
        ]
      }
    },
    {
      dag: 6, titel: 'Kælketuren', sted: 'Susebanen', spil: 'games/racer/', emne: 'tal', moeder: ['rikke'],
      afsnit: [
        {
          billede: 'billeder/dag06-1.jpg',
          tekst: [
            'Susebanen er dækket af sne. Om sommeren kører Ræven Rikke bil her, men om vinteren kan bilen ikke køre i sneen.',
            'Så nu har Rikke en kælk. En rød kælk med to lange meder og et reb foran.',
            '– Hop op, siger Rikke. Så leder vi, mens vi kører.',
            'Pelle sætter sig forrest, og Rikke sætter sig bagerst. Sanne flyver ved siden af. Rikke skubber fra, og så går det ned ad bakken.',
            'Det suser i ørerne. Sneen sprøjter til siden. Pelles halstørklæde blafrer bag ham.',
            '– Hurtigere, råber Pelle. Nej, langsommere. Nej, hurtigere.'
          ]
        },
        {
          billede: 'billeder/dag06-2.jpg',
          tekst: [
            'Langs banen står der små juletræer. Rikke kører lidt langsommere, så de kan tælle dem.',
            { spoerg: 'Tæl med. En. To. Tre. Fire. Fem. Seks.', svar: 'Seks juletræer langs banen.' },
            '– Seks, siger Rikke. Det er en hel hånd og én finger mere.',
            'Pelle holder alle fem fingre op på den ene pote og én finger på den anden.',
            { spoerg: 'Fem og én. Hvor mange er det?', svar: 'Seks. Fem og én er seks.' },
            'Så stopper Rikke kælken. Hun sætter snuden ned i sneen og snuser.',
            '– Se her, siger hun. Ved siden af vores spor.',
            'I sneen er der små, bitte små fodspor. De samme som Pelle så i Nøddeskoven. De går ved siden af kælkesporet hele vejen.',
            '– Det lugter af kanel, siger Rikke. Og lidt af grød.',
            'Hvem kan det være, der går rundt med så små fødder og lugter af kanel?'
          ]
        },
        {
          billede: 'billeder/dag06-3.jpg',
          tekst: [
            'For enden af banen står målflaget. Det blafrer i vinden, og nede ved flagstangen, i sneen, glimter det.',
            'Kan I se det? Det glimter ved målflaget.',
            'Rikke graver med snuden, og så har hun den. En lille brik med gylden kant.',
            '– Du vandt, siger Pelle. Du kom først i mål.',
            '– Vi kom alle sammen i mål, siger Rikke. Det er det bedste.',
            { spoerg: 'I går havde Pelle fem brikker. Nu får han én til. Hvor mange har han så?', svar: 'Seks. Fem og én er seks.' },
            'De små fodspor går hen til målflaget og så ind i skoven. Der forsvinder de.',
            'Det er ved at blive mørkt, og de første stjerner kommer frem. Sanne kigger op. Højt oppe, helt oppe mellem stjernerne, er der noget, der glimter.',
            '– Stjerneuret, siger Sanne. Men det er så højt oppe. Hvordan skal vi komme derop?',
            '– Det ved jeg, hvem der kan hjælpe med, siger Pelle.',
            'I morgen åbner vi låge nummer syv.'
          ]
        }
      ],
      brik: { x: 0.72, y: 0.62 },
      opgave: {
        type: 'tael',
        runder: [
          { ting: 'gran', antal: 11, spoerg: 'Kan I tælle juletræerne langs banen? Tryk på dem én ad gangen.',
            efter: [{ plus: 2, tekst: 'Rikke planter to til.' }, { minus: 3, stil: 'sne', tekst: 'Sneen dækker tre.', spoerg: 'Hvor mange kan I se nu?' }] },
          { ting: 'stjerne', antal: 14, spoerg: 'Nu kommer stjernerne frem. Kan I tælle dem?' }
        ]
      }
    },
    {
      dag: 7, titel: 'Syv stjerner', sted: 'Stjerneuret', spil: 'games/klokken/', emne: 'tal', moeder: ['milo'],
      afsnit: [
        {
          billede: 'billeder/dag07-1.jpg',
          tekst: [
            'Det er aften, og himlen er fuld af stjerner. Pelle og Sanne står på den højeste bakke og kigger op.',
            'Så kommer der en lille raket ned fra himlen. Den lander blødt i sneen, og ud kommer Rummusen Milo i sin hvide rumdragt.',
            '– Jeg så jer fra Stjerneuret, siger Milo. I leder efter noget, der glimter.',
            '– Ja, siger Pelle. En brik til mit puslespil. Sanne så den heroppe.',
            '– Så hop ind, siger Milo.',
            'Pelle kravler ind i raketten, og Sanne flyver bagefter. Raketten summer og ryster, og så stiger den op. Op over skoven, op over skyerne, helt op til Stjerneuret.',
            'Stjerneuret er et stort ur, der svæver mellem stjernerne. Det har to visere, en lille og en stor.'
          ]
        },
        {
          billede: 'billeder/dag07-2.jpg',
          tekst: [
            '– Se derovre, siger Milo og peger. Det er mit yndlingsstjernebillede. Jeg kalder det Pindsvinet.',
            'Pelle kigger. Fem stjerner sidder i en bue, ligesom piggene på en ryg. Og to stjerner sidder lidt foran, som en lille snude.',
            { spoerg: 'Hvor mange stjerner sidder der i buen?', svar: 'Fem. Fem stjerner til piggene.' },
            { spoerg: 'Og så to til snuden. Fem og to. Hvor mange er det?', svar: 'Syv. Fem og to er syv.' },
            '– Det ligner faktisk mig, siger Pelle og griner.',
            'Milo peger på Stjerneuret. Den lille viser står på syv, og den store viser står lige op.',
            { spoerg: 'Den lille viser står på syv. Hvad er klokken?', svar: 'Klokken er syv.' },
            '– Klokken syv, siger Milo. Så er det snart sengetid for pindsvin.'
          ]
        },
        {
          billede: 'billeder/dag07-3.jpg',
          tekst: [
            'Mellem stjernerne i Pindsvinet er der noget, der glimter. Det svæver helt stille.',
            'Kan I se det? Det glimter mellem stjernerne.',
            'Milo svæver ud fra raketten i sin rumdragt. Han tager forsigtigt brikken og svæver tilbage.',
            '– Den har svævet heroppe siden stormen, siger Milo. Den lignede næsten en stjerne.',
            'Pelle lægger brikken i sin æske. Han kigger på dem alle sammen.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Syv. En hel uge.' },
            '– Syv dage er en uge, siger Milo. Mandag, tirsdag, onsdag, torsdag, fredag, lørdag og søndag.',
            'Raketten flyver ned igen og lander blødt på bakken. Pelle gaber. Det har været en lang dag.',
            'Men før han går ind, kigger Sanne ned over landet. Langt væk, på en vej, hvor der står store bogstaver i sneen, glimter det.',
            '– Bogstavvejen, siger Sanne. Der skal vi hen i morgen.',
            'I morgen åbner vi låge nummer otte.'
          ]
        }
      ],
      brik: { x: 0.38, y: 0.32 },
      opgave: {
        type: 'se', ting: 'stjerne', max: 10, spoerg: 'Kig godt. Hvor mange stjerner så I?',
        runder: [
          { antal: 6, moenster: 'terning', vis: 2 }, { antal: 7, vis: 2, mangler: true }, { antal: 10, vis: 1.5 },
          { antal: 8, vis: 1.2, mangler: true }, { antal: 9, vis: 1, mangler: true }
        ]
      }
    },

    /* ---------- Uge 2: bogstaver og lyde ---------- */
    {
      dag: 8, titel: 'S i sneen', sted: 'Bogstavvejen', spil: 'games/bogstaver/', emne: 'bogstaver', moeder: ['ulla'],
      afsnit: [
        {
          billede: 'billeder/dag08-1.jpg',
          tekst: [
            'På Bogstavvejen står der store skilte langs vejen. På hvert skilt står der et bogstav. Men i nat har det sneet, og nu er alle skiltene hvide.',
            'Midt på vejen står Uglen Ulla med en lang fjer. Hun har store, runde øjne, og hun kender alle bogstaverne.',
            '– Godmorgen, Pelle, siger Ulla. Godmorgen, Sanne. Sneen har gemt alle mine bogstaver. Nu skriver jeg dem i sneen i stedet.',
            'Ulla tegner med fjeren i sneen. Hun tegner langsomt og pænt, og hvert bogstav bliver stort og tydeligt.',
            '– I dag skal I lære et bogstav, der passer perfekt til vinter, siger Ulla.'
          ]
        },
        {
          billede: 'billeder/dag08-2.jpg',
          tekst: [
            'Ulla tegner en lang, snoet streg i sneen. Den starter oppe og bugter sig ned, frem og tilbage, ligesom en slange.',
            '– Det er et S, siger Ulla. S siger en lang, hvislende lyd. Ligesom en slange, der hvisler.',
            '– S som i sne, siger Ulla. Sne starter med S.',
            { spoerg: 'Hvad starter med S, sne eller mus?', svar: 'Sne. Sne starter med S.' },
            '– S som i sol, siger Ulla. S som i sok. Og S som i slæde.',
            'Sanne hopper op og ned på et af skiltene.',
            { spoerg: 'Én af vennerne har et navn, der starter med S. Hvem er det?', svar: 'Sanne. Skaden Sanne starter med S.' },
            '– Det er mig, siger Sanne stolt. Mit navn starter med S. To gange endda. Skaden Sanne.',
            { spoerg: 'Kan I finde på noget mere, der starter med S?', svar: 'Måske sko eller slange eller sukker. Der er mange.' }
          ]
        },
        {
          billede: 'billeder/dag08-3.jpg',
          tekst: [
            'Ulla er færdig med sit store S. Hun træder et skridt tilbage for at se på det.',
            'Og dér, nede i den nederste bue af S, glimter det.',
            'Kan I se det? Det glimter i bunden af S.',
            'Pelle graver forsigtigt. Det er en brik med gylden kant.',
            '– Den har ligget her hele tiden, siger Ulla. Lige under sneen. Den ville gerne findes af et S.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Otte. Én for hver dag.' },
            'Pelle takker Ulla. Hun vinker farvel med fjeren og begynder på næste bogstav.',
            'Sanne ser lidt alvorlig ud.',
            '– I morgen har jeg en vigtig opgave, siger hun. Jeg skal flyve julebreve ud på Himmelvejen. Men jeg så noget glimte derude. Vil du med, Pelle?',
            '– Kan jeg det, spørger Pelle. Jeg kan jo ikke flyve.',
            '– Du kan sidde på min ryg, siger Sanne. Du er lille nok.',
            'I morgen åbner vi låge nummer ni.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.68 },
      opgave: {
        type: 'spor', bogstav: 'S', ord: 'S som i sne.', eksempel: 'sne',
        find: [{ rigtige: ['sol', 'slange'], andre: ['kat', 'hus'] }, { rigtige: ['sko', 'stol'], andre: ['mus', 'bil'] }]
      }
    },
    {
      dag: 9, titel: 'Julebrevene', sted: 'Himmelvejen', spil: 'games/flyv/', emne: 'bogstaver', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag09-1.jpg',
          tekst: [
            'I dag er det Sannes arbejdsdag. Hun er postfugl på Himmelvejen, og i julen er der mange breve.',
            'Hun har en lille taske om halsen, og den er fuld af julebreve. Pelle kravler op på hendes ryg og holder godt fast i fjerene.',
            '– Er du klar, spørger Sanne.',
            '– Jeg tror det, siger Pelle. Måske. Ja.',
            'Sanne letter. Hun flyver op over træerne, ud over havet og hen over en lang bro. Vinden suser, og alt dernede bliver småt. Husene ligner legetøj, og træerne ligner små grønne kegler.',
            '– Det er fantastisk, råber Pelle. Jeg flyver.'
          ]
        },
        {
          billede: 'billeder/dag09-2.jpg',
          tekst: [
            'Sanne lander på et tag og åbner sin taske. Brevene har ingen bogstaver uden på. De har små billeder i stedet, så Sanne kan se, hvem de skal til.',
            '– Det her brev skal til en, der starter med J, siger Sanne. J ligesom jul.',
            '– J siger en blød lyd, siger Pelle. Ligesom når man siger ja.',
            { spoerg: 'Hvad starter med J, ligesom jul, juletræ eller kat?', svar: 'Juletræ. Juletræ starter med J.' },
            'Sanne flyver hen til et hus med et juletræ i vinduet og lægger brevet i postkassen.',
            '– Næste brev, siger Sanne. Det skal også til noget med J.',
            { spoerg: 'Hvad starter med J, jakke eller sol?', svar: 'Jakke. Jakke starter med J.' },
            { spoerg: 'Og jordbær eller tog?', svar: 'Jordbær. Jordbær starter med J.' },
            '– Ja, jul, juletræ, jakke og jordbær, siger Pelle. Det er mange ord med J.',
            '– Og ja, siger Sanne. Ja starter også med J.'
          ]
        },
        {
          billede: 'billeder/dag09-3.jpg',
          tekst: [
            'Til sidst er tasken tom. Alle brevene er kommet frem. Sanne flyver ned under broen for at hvile vingerne.',
            'Under broen hænger et lille fuglehus. Og i fuglehuset glimter det.',
            'Kan I se det? Det glimter i fuglehuset under broen.',
            'Pelle strækker sig og tager den. En brik med gylden kant.',
            '– Den må være blæst herind i stormen, siger Sanne. Godt den havde et hus at være i.',
            { spoerg: 'I går havde Pelle otte brikker. Nu får han én til. Hvor mange har han så?', svar: 'Ni. Otte og én er ni.' },
            'De flyver hjem i det sidste lys. Pelle holder fast i fjerene og smiler hele vejen.',
            'Over skoven kan de se et hus med store vinduer og lys indenfor. Derinde bevæger der sig noget med lange, blanke arme.',
            '– Det er Tegnestuen, siger Sanne. Og inde ved vinduet glimter det.',
            'I morgen åbner vi låge nummer ti.'
          ]
        }
      ],
      brik: { x: 0.62, y: 0.42 },
      opgave: {
        type: 'forlyd', lyd: 'J', eksempel: 'jul',
        runder: [{ rigtige: ['juletræ'], andre: ['hus', 'bil', 'sol'] }, { rigtige: ['jakke', 'jordbær'], andre: ['kat', 'tog'] }],
        hvilket: [{ ord: 'jordbær', valg: ['J', 'S', 'O'] }, { ord: 'sol', valg: ['S', 'J', 'A'] }, { ord: 'juletræ', valg: ['S', 'O', 'J'] }]
      }
    },
    {
      dag: 10, titel: 'Julekort hos Rasmus', sted: 'Tegnestuen', spil: 'games/tegn/', emne: 'bogstaver', moeder: ['rasmus'],
      afsnit: [
        {
          billede: 'billeder/dag10-1.jpg',
          tekst: [
            'Inde i Tegnestuen er der varmt og lyst. Der hænger tegninger på alle væggene. Huse og dyr og fisk og raketter.',
            'Ved det store bord sidder Robotten Rasmus. Han har lange, blanke arme og en lille lampe på hovedet, der blinker, når han tænker.',
            '– Bip, siger Rasmus. Velkommen. Jeg tegner julekort.',
            'Rasmus tegner med begge arme på én gang. Med den ene tegner han et juletræ, og med den anden tegner han en gave. Hans lampe blinker grønt.',
            '– Jeg laver et julekort til hver af vennerne, siger Rasmus. Og på hvert kort skriver jeg et bogstav.'
          ]
        },
        {
          billede: 'billeder/dag10-2.jpg',
          tekst: [
            'Rasmus tager et nyt kort og tegner et bogstav. Først en streg lige ned. Så en skrå streg ned til den anden side. Og så en streg lige op igen.',
            '– Det er et N, siger Rasmus. N som i nisse.',
            'N siger en lyd, der summer i næsen. Prøv selv at holde munden lukket og sige N.',
            { spoerg: 'Hvad starter med N, næse eller fisk?', svar: 'Næse. Næse starter med N.' },
            '– N som i nød, siger Rasmus. Og N som i nøgle.',
            { spoerg: 'Hvad hedder skoven, hvor Pelle bor? Den starter også med N.', svar: 'Nøddeskoven. Nøddeskoven starter med N.' },
            'Pelle kigger på bunken med julekort. Nederst i bunken ligger der et kort, som er meget mindre end de andre.',
            'På kortet er der tegnet en lille, rød nissehue. Den er tegnet med en meget lille blyant.',
            '– Den har jeg ikke tegnet, siger Rasmus. Min lampe blinker gult, fordi jeg undrer mig.',
            'Pelle tænker på de små fodspor og på krummerne hos Gustav. Hvem er det, der går rundt og hjælper i det skjulte?'
          ]
        },
        {
          billede: 'billeder/dag10-3.jpg',
          tekst: [
            'Sanne hopper hen til farvekassen. Den er fuld af farvekridt i alle farver.',
            '– Der, siger hun. Mellem det røde og det grønne.',
            'Kan I se det? Det glimter i farvekassen.',
            'Rasmus tager den med sin lange arm. En brik med gylden kant.',
            '– Bip, siger Rasmus. Den fløj ind ad vinduet i stormen og landede i mine farver.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Ti. Lige så mange som fingrene på to hænder.' },
            'Rasmus giver Pelle et julekort. Der er tegnet et stort P på det. P som i Pelle.',
            'Sanne flyver op på taget og kigger ud. Langt væk ligger en skov fyldt med små huse og masser af ting. I et af vinduerne glimter det.',
            '– Vrimleskoven, siger Sanne.',
            'I morgen åbner vi låge nummer elleve.'
          ]
        }
      ],
      brik: { x: 0.3, y: 0.7 },
      opgave: {
        type: 'spor', bogstav: 'N', ord: 'N som i nisse.', eksempel: 'nisse',
        find: [{ rigtige: ['næse', 'nøgle'], andre: ['fisk', 'bil'] }],
        hvilket: [{ ord: 'nød', valg: ['N', 'J', 'S'] }, { ord: 'slange', valg: ['S', 'N', 'J'] }]
      }
    },
    {
      dag: 11, titel: 'Kajas kane', sted: 'Vrimleskoven', spil: 'games/find/', emne: 'bogstaver', moeder: ['kaja'],
      afsnit: [
        {
          billede: 'billeder/dag11-1.jpg',
          tekst: [
            'I Vrimleskoven vrimler det med ting. Der står ting i vinduerne, ting på bænkene og ting oppe i træerne. Nu er der også sne på det hele.',
            'Kaninen Kaja kommer kørende på en lille kane. Hun har lange ører og et rødt halstørklæde.',
            '– Hej Pelle, hej Sanne, siger Kaja. Vil I køre med? Min kane kan sagtens have tre.',
            'Pelle sætter sig bag Kaja, og Sanne sætter sig på kanten. Kaja hopper foran og trækker, og kanen glider gennem sneen.',
            'De kører forbi huse med lys i vinduerne og forbi små træer med sne på grenene.'
          ]
        },
        {
          billede: 'billeder/dag11-2.jpg',
          tekst: [
            '– Ved I hvad, siger Kaja. Mit navn starter med K. Kaja. Og kane starter også med K.',
            'K siger en kort, hård lyd, lidt ligesom når man knækker en kvist.',
            '– Lad os lede efter ting, der starter med K, siger Kaja.',
            'I et vindue sidder der en kat og kigger ud.',
            { spoerg: 'Hvad starter med K, kat eller sol?', svar: 'Kat. Kat starter med K.' },
            'På en bænk står der en tallerken med en kage.',
            { spoerg: 'Hvad starter med K, kage eller mus?', svar: 'Kage. Kage starter med K.' },
            'Kaja kigger på Pelle og fniser.',
            { spoerg: 'Pelle har noget på hovedet, der starter med K. Hvad er det?', svar: 'En kasket. Kasket starter med K.' },
            '– Det har jeg aldrig tænkt på, siger Pelle og tager sin kasket af og kigger på den. Kasket. Kaja. Kane. Kage. Kat.'
          ]
        },
        {
          billede: 'billeder/dag11-3.jpg',
          tekst: [
            'Kanen stopper ved et hus med et stort vindue. Inde bag ruden sidder katten. Og ved siden af katten glimter det.',
            'Kan I se det? Det glimter i vinduet ved katten.',
            'Kaja banker forsigtigt på. En gammel mus åbner døren og smiler.',
            '– Den fløj ind ad min skorsten i stormen, siger musen. Jeg har passet godt på den.',
            'Musen giver Pelle en brik med gylden kant.',
            { spoerg: 'I går havde Pelle ti brikker. Nu får han én til. Hvor mange har han så?', svar: 'Elleve. Ti og én er elleve.' },
            'Kaja kører dem hjem på kanen. Da de kommer forbi Pelles have, kigger Sanne ned. Haven er helt hvid. Men midt i sneen glimter det.',
            '– Den er i din egen have, Pelle, siger Sanne.',
            'I morgen åbner vi låge nummer tolv.'
          ]
        }
      ],
      brik: { x: 0.6, y: 0.4 },
      opgave: {
        type: 'forlyd', lyd: 'K', eksempel: 'kane',
        runder: [
          { rigtige: ['kat'], andre: ['sol', 'mus', 'bi'] }, { rigtige: ['kage', 'krone'], andre: ['hat', 'ugle'] },
          { rigtige: ['ko', 'kanin'], andre: ['gave', 'fisk'] }
        ],
        hvilket: [{ ord: 'kage', valg: ['K', 'J', 'N'] }, { ord: 'næse', valg: ['N', 'K', 'S'] }, { ord: 'jakke', valg: ['K', 'J', 'S'] }]
      }
    },
    {
      dag: 12, titel: 'Snemanden i haven', sted: 'Årstidshaven', spil: 'games/have/', emne: 'bogstaver', moeder: [],
      afsnit: [
        {
          billede: 'billeder/dag12-1.jpg',
          tekst: [
            'Om sommeren vokser der tomater og jordbær i Pelles have. Men nu er det vinter, og haven sover.',
            'Bedene er dækket af sne, og æbletræet har ingen blade. Det er helt stille.',
            '– Sover haven virkelig, spørger Sanne.',
            '– Ja, siger Pelle. Om vinteren hviler planterne sig. Frøene ligger nede i jorden og venter. Når det bliver forår, og solen bliver varm, så vågner de og begynder at gro.',
            'Pelle går en tur rundt i haven. Han kigger på sit bed med gulerødder. Han har ladet nogle stykker blive i jorden. Der kan de holde sig friske hele vinteren.'
          ]
        },
        {
          billede: 'billeder/dag12-2.jpg',
          tekst: [
            '– Lad os bygge en snemand, siger Sanne.',
            'Pelle ruller en stor snebold til maven og en lille til hovedet. Sanne finder to sten til øjnene. Men snemanden mangler noget.',
            '– Den mangler en næse, siger Pelle. Og jeg ved, hvad den skal have. En gulerod.',
            '– Gulerod starter med G, siger Sanne. G som i gulerod.',
            'G siger en lyd, der kommer helt nede fra halsen.',
            { spoerg: 'Hvad starter med G, gulerod eller hat?', svar: 'Gulerod. Gulerod starter med G.' },
            '– G som i gave, siger Pelle. Og G som i gran.',
            { spoerg: 'Én af vennerne starter også med G. Han bager brunkager. Hvem er det?', svar: 'Gustav. Grisen Gustav starter med G.' },
            '– G, G, G, synger Sanne. Gulerod, gave, gran og Gustav.'
          ]
        },
        {
          billede: 'billeder/dag12-3.jpg',
          tekst: [
            'Pelle graver i gulerodsbedet. Sneen er kold, og jorden er hård. Men så får han fat i den grønne top, og han trækker. Og trækker.',
            'Pop. Guleroden kommer op. Og i hullet efter den glimter det.',
            'Kan I se det? Det glimter i hullet efter guleroden.',
            'Det er en brik med gylden kant. Den har ligget i Pelles egen have hele tiden.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Tolv. Halvdelen af alle brikkerne.' },
            '– Halvdelen, siger Pelle. Vi har fundet halvdelen. Tolv er fundet, og tolv mangler.',
            'Pelle sætter guleroden på snemanden. Nu har den en flot, orange næse. Snemanden ser ud, som om den smiler.',
            'Sanne flyver op i æbletræet. Herfra kan hun se helt ud til havet. Langs stranden er vandet frosset, og ude på isen glimter det.',
            '– Boblehavet, siger Sanne.',
            'I morgen åbner vi låge nummer tretten.'
          ]
        }
      ],
      brik: { x: 0.45, y: 0.78 },
      opgave: {
        type: 'spor', bogstav: 'G', ord: 'G som i gulerod.', eksempel: 'gulerod',
        find: [{ rigtige: ['gris', 'gave'], andre: ['hat', 'sol'] }],
        hvilket: [{ ord: 'gulerod', valg: ['G', 'K', 'N'] }, { ord: 'kat', valg: ['K', 'G', 'S'] }]
      }
    },
    {
      dag: 13, titel: 'Is på havet', sted: 'Boblehavet', spil: 'games/bobler/', emne: 'bogstaver', moeder: ['emil', 'ella'],
      afsnit: [
        {
          billede: 'billeder/dag13-1.jpg',
          tekst: [
            'Ved Boblehavet er det koldt. Vandet langs stranden er frosset til is. Og ude i isen sidder boblerne fast. De ligner store kugler af glas.',
            'På stranden står Emil og Ella. De har huer og vanter på og røde kinder af kulden.',
            '– Pelle, råber Ella. Kom og se. Boblerne er frosset.',
            'Emil glider ud på isen på sine støvler. Han er god til at glide.',
            '– Inde i boblerne kan man se ting, siger Emil. En muslingeskal. En lille fisk. Og en sten.'
          ]
        },
        {
          billede: 'billeder/dag13-2.jpg',
          tekst: [
            '– Ved I hvad, siger Pelle. Jeres navne starter med det samme bogstav.',
            { spoerg: 'Emil og Ella. Hvilket bogstav starter begge navne med?', svar: 'E. Emil og Ella starter begge med E.' },
            '– E som i Emil, siger Emil.',
            '– Og E som i Ella, siger Ella.',
            { spoerg: 'Hvad starter med E, elefant eller tog?', svar: 'Elefant. Elefant starter med E.' },
            { spoerg: 'Og hvem bor i den store, gamle stub? Han starter også med E.', svar: 'Egon. Egernet Egon starter med E.' },
            'Mens de snakker, finder Ella noget i sandet. Det er en lang, rød tråd af uld. Den har sat sig fast i en pind.',
            '– Den ligner tråd fra en hue, siger Ella. En meget lille hue.',
            'Pelle tænker på tegningen hos Rasmus. En lille, rød nissehue. Han putter tråden i sin lomme.'
          ]
        },
        {
          billede: 'billeder/dag13-3.jpg',
          tekst: [
            'Ude på isen, lidt længere ude end de andre, sidder der en boble. Inde i den glimter det.',
            'Kan I se det? Det glimter inde i boblen.',
            '– Den er frosset fast, siger Emil. Vi kan ikke få den op.',
            '– Så varmer vi den, siger Ella.',
            'Emil og Ella tager deres vanter af og lægger hænderne på boblen. Pelle puster varm luft på den. Det tager lang tid. Men så siger det pop.',
            'Boblen springer, og ud kommer en brik med gylden kant.',
            { spoerg: 'I går havde Pelle tolv brikker. Nu får han én til. Hvor mange har han så?', svar: 'Tretten. Tolv og én er tretten.' },
            'Emil og Ella tager vanterne på igen. Deres hænder er røde og kolde, men de smiler.',
            'Sanne flyver højt op og kigger hjem mod skoven. Hun kigger og kigger. Og så glimter det. Lige ved Pelles eget hus.',
            '– Pelle, siger hun. Der er noget ved din dør.',
            'I morgen åbner vi låge nummer fjorten.'
          ]
        }
      ],
      brik: { x: 0.58, y: 0.48 },
      opgave: {
        type: 'forlyd', lyd: 'E', eksempel: 'Emil',
        runder: [{ rigtige: ['elefant'], andre: ['tog', 'ko', 'hus'] }, { rigtige: ['egern', 'edderkop'], andre: ['sko', 'bil'] }],
        hvilket: [{ ord: 'egern', valg: ['E', 'K', 'G'] }, { ord: 'gave', valg: ['G', 'E', 'J'] }, { ord: 'nøgle', valg: ['N', 'S', 'E'] }]
      }
    },
    {
      dag: 14, titel: 'Pakken på trappen', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'bogstaver', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag14-1.jpg',
          tekst: [
            'I dag er Pelle hjemme i sit værksted. Det er fyldt med skruer og hjul og fjedre og alt muligt, han har fundet.',
            'Pelle pakker julegaver ind. Han har lavet en gave til hver af vennerne, og nu pakker han dem ind i brunt papir med rød snor.',
            'Sanne sidder på en hylde og kigger på. Hun elsker gavepapir, men mest elsker hun snoren.',
            '– Hvad er der i den store pakke, spørger Sanne.',
            '– Det er en hemmelighed, siger Pelle. Man må ikke vide, hvad der er i en julegave.'
          ]
        },
        {
          billede: 'billeder/dag14-2.jpg',
          tekst: [
            'På hver pakke skriver Pelle et stort P. Først en lang streg lige ned. Så en lille, rund mave øverst.',
            '– Hvorfor skriver du P på dem alle sammen, spørger Sanne.',
            '– Fordi gaverne er fra mig, siger Pelle. P som i Pelle.',
            'P siger en lille, hoppende lyd. Ligesom en lille boble, der springer.',
            { spoerg: 'Hvad starter med P, ligesom Pelle, pandekage eller sol?', svar: 'Pandekage. Pandekage starter med P.' },
            '– P som i pakke, siger Pelle. P som i papir. Og P som i pynt.',
            { spoerg: 'Pelle siger pakke. Hvilken lyd hører I først?', svar: 'P. Pakke starter med P.' },
            '– Og P som i puslespil, siger Sanne. Det er jo det, vi leder efter.'
          ]
        },
        {
          billede: 'billeder/dag14-3.jpg',
          tekst: [
            'Så banker det på døren. Bank, bank. Pelle løber hen og åbner. Men der er ingen.',
            'Der er bare sne og stilhed. Og på trappen står der en lille, bitte lille pakke. Den er pakket ind i et blad og bundet med en rød tråd.',
            'Den røde tråd ligner præcis den, Ella fandt på stranden.',
            'Pelle åbner pakken. Indeni ligger der en brik med gylden kant. Og en lillebitte tegning af en nissehue.',
            'Kan I se brikken? Den glimter i den lille pakke.',
            '– Der er nogen, der hjælper os, hvisker Pelle. Nogen, der er meget lille og meget venlig.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Fjorten. Ti og fire er fjorten.' },
            'Pelle kigger ud i mørket. Små fodspor går ned ad trappen og forsvinder ind mellem træerne.',
            '– Tak, råber Pelle ud i skoven. Hvem du end er.',
            'Sanne kigger mod bakkerne. Inde i en mørk hule langt væk glimter det svagt.',
            '– Rimhulen, siger Sanne. Men der skal vi være meget stille. Der sover nogen.',
            'I morgen åbner vi låge nummer femten.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.75 },
      opgave: {
        type: 'spor', bogstav: 'P', ord: 'P som i Pelle.', eksempel: 'Pelle',
        find: [{ rigtige: ['pingvin', 'pandekage'], andre: ['sol', 'mus'] }, { rigtige: ['pizza', 'pil'], andre: ['kat', 'egern'] }],
        hvilket: [{ ord: 'paraply', valg: ['P', 'K', 'E'] }]
      }
    },

    /* ---------- Uge 3: rim og stavelser ---------- */
    {
      dag: 15, titel: 'Bo sover', sted: 'Rimhulen', spil: 'games/rim/', emne: 'rim', moeder: ['bo'],
      afsnit: [
        {
          billede: 'billeder/dag15-1.jpg',
          tekst: [
            'Rimhulen ligger inde i en bakke. Ved indgangen hænger der små lygter, der lyser i mørket.',
            'Pelle og Sanne lister ind. Det er varmt derinde, og det dufter af mos og jord. Og så hører de noget. En dyb, langsom lyd. Snorken.',
            'Bagerst i hulen ligger Bjørnen Bo. Han er stor og brun og rund, og han sover så tungt, at hans mave går op og ned som en bølge.',
            '– Hvorfor sover han midt på dagen, hvisker Sanne.',
            '– Bjørne sover det meste af vinteren, hvisker Pelle. Om efteråret spiser de og spiser, til de er rigtig tykke. Og så lægger de sig i en hule og sover, til det bliver forår.',
            '– Hele vinteren, hvisker Sanne. Så går han jo glip af julen.',
            '– Måske drømmer han om den, hvisker Pelle.'
          ]
        },
        {
          billede: 'billeder/dag15-2.jpg',
          tekst: [
            'Bo vender sig i søvne og mumler noget. Bo elsker rim. Selv når han sover, taler han i rim.',
            '– Bjørn, mumler Bo. Bjørn og ...',
            'Ord rimer, når de lyder ens til sidst. Bjørn og ørn rimer, fordi de begge slutter med ørn.',
            { spoerg: 'Bjørn og en stor fugl, der flyver højt. Hvad rimer på bjørn?', svar: 'Ørn. Bjørn og ørn rimer.' },
            'Bo smiler i søvne og mumler videre.',
            '– Mus, mumler Bo. Mus og ...',
            { spoerg: 'Mus og noget, man bor i. Hvad rimer på mus?', svar: 'Hus. Mus og hus rimer.' },
            '– Sol, mumler Bo. Sol og ...',
            { spoerg: 'Sol og noget, man sidder på. Hvad rimer på sol?', svar: 'Stol. Sol og stol rimer.' },
            'Pelle og Sanne må holde sig for munden for ikke at grine. Bo er sjov, selv når han sover.'
          ]
        },
        {
          billede: 'billeder/dag15-3.jpg',
          tekst: [
            'Så ser Sanne det. Bo holder noget i sin store pote, ligesom en bamse. Det glimter.',
            'Kan I se det? Det glimter i Bos pote.',
            'Det er en brik med gylden kant. Bo må have fundet den, før han faldt i søvn.',
            '– Hvordan får vi den uden at vække ham, hvisker Sanne.',
            'Pelle tager sin bløde vante af. Langsomt, langsomt lægger han vanten i Bos pote, og langsomt, langsomt tager han brikken.',
            'Bo knuger vanten ind til sig og smiler. Vante og tante, mumler han. Og så snorker han videre.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Femten. Ti og fem er femten.' },
            'De lister ud af hulen. Udenfor dufter det af noget sødt og varmt. Det kommer helt fra Skovkøkkenet.',
            '– Det dufter af risengrød, siger Sanne. Og ved skorstenen glimter det.',
            'I morgen åbner vi låge nummer seksten.'
          ]
        }
      ],
      brik: { x: 0.52, y: 0.62 },
      opgave: {
        type: 'rim',
        runder: [{ ord: 'bjørn', rigtig: 'ørn', andre: ['hus', 'kage', 'fisk'] }, { ord: 'mus', rigtig: 'hus', andre: ['sko', 'ugle', 'bil'] }],
        ikke: [['sol', 'stol', 'kat'], ['kat', 'hat', 'fisk']],
        par: [['ko', 'sko', 'bil', 'fisk']]
      }
    },
    {
      dag: 16, titel: 'Risengrød', sted: 'Skovkøkkenet', spil: 'games/restaurant/', emne: 'rim', moeder: ['gustav'],
      afsnit: [
        {
          billede: 'billeder/dag16-1.jpg',
          tekst: [
            'I Skovkøkkenet står Grisen Gustav og rører i en stor gryde. Det bobler og dufter af mælk og ris.',
            '– Risengrød, siger Gustav. Det skal man have i julen.',
            'Gustav fortæller, at i gamle dage satte man en skål risengrød ud til nissen. Så var nissen glad og hjalp til på gården.',
            '– I aftes satte jeg en lille skål grød ud ved døren, siger Gustav. Bare for sjov. Og i morges var den slikket helt ren.',
            'Pelle og Sanne kigger på hinanden. Den lille hue. De små fodspor. Pakken på trappen.',
            '– Måske var det ikke for sjov, siger Pelle.'
          ]
        },
        {
          billede: 'billeder/dag16-2.jpg',
          tekst: [
            'Mens grøden koger, lærer Gustav dem en leg. Man klapper ordene, et klap for hver del af ordet.',
            '– Risengrød, siger Gustav og klapper. Ri. Sen. Grød.',
            { spoerg: 'Klap med på risengrød. Ri. Sen. Grød. Hvor mange klap var det?', svar: 'Tre. Risengrød har tre klap.' },
            '– Smør, siger Gustav og klapper én gang.',
            { spoerg: 'Klap med på kage. Ka. Ge. Hvor mange klap?', svar: 'To. Kage har to klap.' },
            '– Og nu et langt ord, siger Gustav. Pandekage.',
            { spoerg: 'Klap med på pandekage. Pan. De. Ka. Ge. Hvor mange klap?', svar: 'Fire. Pandekage har fire klap.' },
            '– Gustav, siger Sanne og klapper. Gus. Tav. Det er to.',
            '– Og Pelle, siger Pelle. Pel. Le. Også to.'
          ]
        },
        {
          billede: 'billeder/dag16-3.jpg',
          tekst: [
            'Gustav øser grøden op i skåle. Da han kommer til bunden af gryden, siger det klink.',
            'Der ligger noget i bunden. Det glimter.',
            'Kan I se det? Det glimter i bunden af gryden.',
            'Gustav fisker det op med en stor ske. Det er en brik med gylden kant. Den må være faldet ned i risen, da han fik sækken hjem fra markedet.',
            '– Heldigvis fik den ikke grød på, siger Gustav. Kun lidt kanel.',
            { spoerg: 'I går havde Pelle femten brikker. Nu får han én til. Hvor mange har han så?', svar: 'Seksten. Femten og én er seksten.' },
            'Før de går, sætter Gustav en ny lille skål grød ud ved døren. Med en klat smør i midten.',
            'Sanne flyver op på taget. Over skoven kan hun se den gamle stub og øverst i træet ved siden af en rund rede. Dér glimter det.',
            '– Egon, siger Sanne. Vi skal hen til Egon igen.',
            'I morgen åbner vi låge nummer sytten.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.6 },
      opgave: {
        type: 'klap',
        runder: [{ ord: 'gris' }, { ord: 'kage' }, { ord: 'æble' }, { ord: 'gulerod' }, { ord: 'pandekage' }],
        flest: [['is', 'juletræ'], ['tomat', 'ananas']]
      }
    },
    {
      dag: 17, titel: 'Egons julesang', sted: 'Egernreden', spil: 'games/egern/', emne: 'rim', moeder: ['egon'],
      afsnit: [
        {
          billede: 'billeder/dag17-1.jpg',
          tekst: [
            'Højt oppe i træet ved den gamle stub har Egernet Egon en rede. Den er lavet af kviste og mos og blade, og den er rund som en bold.',
            'Egon sidder i reden og synger. Han synger højt og lidt falsk, men han synger med hele hjertet.',
            '– Hej Egon, råber Pelle. Hvad synger du?',
            '– Jeg skriver en julesang, siger Egon. Til festen juleaften. Men jeg mangler nogle ord. Ord, der rimer.',
            '– Det kan vi hjælpe med, siger Sanne. Vi har lige været hos Bo.'
          ]
        },
        {
          billede: 'billeder/dag17-2.jpg',
          tekst: [
            '– Min sang starter sådan her, siger Egon og synger. Ude er det koldt, og vi spiser is. Og i stalden står en lille ...',
            { spoerg: 'Is og et dyr, der siger øf. Hvad rimer på is?', svar: 'Gris. Is og gris rimer.' },
            '– Gris, synger Egon glad. Og så videre.',
            '– Julemanden kommer med et tog. Og han har med sig en ...',
            { spoerg: 'Tog og noget, man læser i. Hvad rimer på tog?', svar: 'Bog. Tog og bog rimer.' },
            '– Og så det sidste vers, siger Egon. Ude på en ø, der sidder en lille ...',
            { spoerg: 'Ø og et lille, grønt dyr, der hopper. Hvad rimer på ø?', svar: 'Frø. Ø og frø rimer.' },
            '– Nu er sangen færdig, siger Egon. Is og gris, tog og bog, ø og frø. Det er den bedste sang, jeg har lavet.'
          ]
        },
        {
          billede: 'billeder/dag17-3.jpg',
          tekst: [
            'Egon er så glad, at han hopper rundt i reden. Og da han hopper, kommer der noget til syne mellem mosset. Det glimter.',
            'Kan I se det? Det glimter i reden.',
            '– Nå, siger Egon. Den har jeg siddet på hele tiden. Jeg troede, det var en hård kvist.',
            'Han giver Pelle en brik med gylden kant.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Sytten. Ti og syv er sytten.' },
            'Egon synger sangen én gang til, så de kan lære den. Pelle nynner med hele vejen ned ad træet.',
            'Det er blevet mørkt. Månen står stor og rund på himlen. Og lige ved siden af månen glimter det.',
            '– Ved månen, siger Sanne. Så skal vi have fat i Milo igen.',
            'I morgen åbner vi låge nummer atten.'
          ]
        }
      ],
      brik: { x: 0.45, y: 0.5 },
      opgave: {
        type: 'rim',
        runder: [{ ord: 'is', rigtig: 'gris', andre: ['bil', 'måne', 'hat'] }, { ord: 'tog', rigtig: 'bog', andre: ['kat', 'sol', 'ugle'] }],
        ikke: [['ø', 'frø', 'hund'], ['ko', 'sko', 'bil']],
        par: [['kat', 'hat', 'sol', 'ko']]
      }
    },
    {
      dag: 18, titel: 'Turen til månen', sted: 'Stjerneuret', spil: 'games/klokken/', emne: 'rim', moeder: ['milo'],
      afsnit: [
        {
          billede: 'billeder/dag18-1.jpg',
          tekst: [
            'Rummusen Milo lander sin raket på bakken igen. Han har en lille paraply under armen.',
            '– Hvorfor har du en paraply med, spørger Pelle.',
            '– Ude i rummet drysser der stjernestøv, siger Milo. Det kilder i næsen. Så har jeg paraplyen.',
            'Pelle og Sanne kravler ind, og raketten stiger op. Op forbi Stjerneuret, forbi skyerne og hen mod den store, runde måne.',
            'Månen er hvid og fuld af små huller. Den lyser så stærkt, at Pelle må knibe øjnene sammen.'
          ]
        },
        {
          billede: 'billeder/dag18-2.jpg',
          tekst: [
            '– Mens vi flyver, kan vi klappe ord, siger Milo. Det lærte jeg af Gustav.',
            '– Raket, siger Milo og klapper. Ra. Ket.',
            { spoerg: 'Klap med på raket. Ra. Ket. Hvor mange klap?', svar: 'To. Raket har to klap.' },
            { spoerg: 'Klap med på måne. Må. Ne. Hvor mange klap?', svar: 'To. Måne har to klap.' },
            '– Og mit navn, siger Milo. Mi. Lo.',
            '– Også to, siger Sanne.',
            { spoerg: 'Klap med på paraply. Pa. Ra. Ply. Hvor mange klap?', svar: 'Tre. Paraply har tre klap.' },
            '– Og rumdragt, siger Pelle. Rum. Dragt. To.',
            '– Og stjernestøv, siger Sanne. Stjer. Ne. Støv. Tre.'
          ]
        },
        {
          billede: 'billeder/dag18-3.jpg',
          tekst: [
            'Raketten svæver helt tæt på månen. Nede i et af de små huller glimter det.',
            'Kan I se det? Det glimter i et hul på månen.',
            'Milo svæver ud med sin paraply over hovedet og samler brikken op. Den er dækket af fint, sølvagtigt støv.',
            '– Hvordan kom den helt herop, spørger Pelle.',
            '– Det var en meget stærk storm, siger Milo.',
            { spoerg: 'I går havde Pelle sytten brikker. Nu får han én til. Hvor mange har han så?', svar: 'Atten. Sytten og én er atten.' },
            'Raketten lander blødt på bakken. Milo vinker farvel og flyver tilbage til Stjerneuret.',
            'Fra bakken kan de høre sang. Det kommer fra Boldbanen. To stemmer, en høj og en dyb. Og ved målet glimter det.',
            '– Klatterne, siger Sanne. De øver på noget.',
            'I morgen åbner vi låge nummer nitten.'
          ]
        }
      ],
      brik: { x: 0.68, y: 0.35 },
      opgave: {
        type: 'klap',
        runder: [{ ord: 'sol' }, { ord: 'måne' }, { ord: 'raket' }, { ord: 'paraply' }, { ord: 'regnbue' }],
        flest: [['fly', 'raket'], ['robot', 'paraply']]
      }
    },
    {
      dag: 19, titel: 'Klatternes sang', sted: 'Boldbanen', spil: 'games/klatbold/', emne: 'rim', moeder: ['klaus', 'klara'],
      afsnit: [
        {
          billede: 'billeder/dag19-1.jpg',
          tekst: [
            'Snemanden fra forleden står stadig på Boldbanen. Han har kastanjen i maven og en lille hat på, som nogen har givet ham.',
            'Ved siden af snemanden står Klaus og Klara og synger. Klaus synger dybt, og Klara synger højt.',
            '– Vi øver en sang til juleaften, siger Klara. Men vi kan ikke huske slutningen af linjerne.',
            '– Vi mangler ordene, der rimer, siger Klaus. Vil I hjælpe?',
            '– Det er vi blevet gode til, siger Pelle.'
          ]
        },
        {
          billede: 'billeder/dag19-2.jpg',
          tekst: [
            'Klara synger den første linje. På marken står en ko. Den har fået nye ...',
            { spoerg: 'Ko og noget, man har på fødderne. Hvad rimer på ko?', svar: 'Sko. Ko og sko rimer.' },
            'Klaus synger den næste linje. Julemanden kører i bil. Og han skyder med en ...',
            { spoerg: 'Bil og noget, der flyver fra en bue. Hvad rimer på bil?', svar: 'Pil. Bil og pil rimer.' },
            'Klara synger den sidste linje. I sneen sidder en hund. Den har en kage i ...',
            { spoerg: 'Hund og det, man spiser med. Hvad rimer på hund?', svar: 'Mund. Hund og mund rimer.' },
            '– Nu kan vi hele sangen, siger Klaus og Klara. Og de synger den fra start til slut, så højt, at sneen falder af træerne.',
            'Mens de synger, ser Pelle noget i sneen ved målet. Små fodspor. Der er nogen, der har stået og lyttet.'
          ]
        },
        {
          billede: 'billeder/dag19-3.jpg',
          tekst: [
            'Fodsporene går hen til målet. Og oppe i målnettet, der hvor bolden plejer at ramme, sidder der noget fast. Det glimter.',
            'Kan I se det? Det glimter i målnettet.',
            'Klara hopper op og triller den ned med sin bløde, blå arm. Det er en brik med gylden kant.',
            '– Mål, råber Klaus.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Nitten. Ti og ni er nitten.' },
            'Pelle kigger efter fodsporene. De går ud af målet, rundt om snemanden og ind i skoven. Ved snemanden ligger der en lille, rød tråd.',
            'Sanne flyver op over træerne. Ved Bæverdammen sidder Bodil og gnaver i noget. Spånerne flyver omkring hende, og mellem spånerne glimter det.',
            '– Bodil laver noget, siger Sanne.',
            'I morgen åbner vi låge nummer tyve.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.45 },
      opgave: {
        type: 'rim',
        runder: [{ ord: 'ko', rigtig: 'sko', andre: ['hat', 'fisk', 'måne'] }, { ord: 'bil', rigtig: 'pil', andre: ['sol', 'mus', 'kage'] }],
        ikke: [['hund', 'mund', 'tog'], ['sol', 'stol', 'and']],
        par: [['is', 'gris', 'bog', 'ur']]
      }
    },
    {
      dag: 20, titel: 'Bodils gaver', sted: 'Bæverdammen', spil: 'games/baever/', emne: 'rim', moeder: ['bodil'],
      afsnit: [
        {
          billede: 'billeder/dag20-1.jpg',
          tekst: [
            'Ved Bæverdammen sidder Bæveren Bodil på sin bunke stammer. Hun gnaver med sine store tænder, og spånerne flyver.',
            '– Hvad laver du, Bodil, spørger Pelle.',
            '– Julegaver, siger Bodil. Jeg gnaver dem ud af træ. Man behøver ikke købe gaver. Man kan lave dem selv.',
            'Bodil holder en lille træsommerfugl op. Den har tynde vinger og små prikker. Ved siden af ligger et lille hjerte og en lille fugl.',
            '– Den er til dig, Sanne, siger Bodil og giver hende fuglen. Så har du en ven, når du er ude at flyve.',
            'Sanne bliver helt stille. Hun har aldrig fået en gave før.'
          ]
        },
        {
          billede: 'billeder/dag20-2.jpg',
          tekst: [
            '– Vil I klappe navnene på gaverne, spørger Bodil. Det har jeg hørt, at I er gode til.',
            { spoerg: 'Klap med på gave. Ga. Ve. Hvor mange klap?', svar: 'To. Gave har to klap.' },
            { spoerg: 'Klap med på sommerfugl. Som. Mer. Fugl. Hvor mange klap?', svar: 'Tre. Sommerfugl har tre klap.' },
            { spoerg: 'Klap med på træ. Hvor mange klap?', svar: 'Ét. Træ har ét klap.' },
            '– Og mit navn, siger Bodil. Bo. Dil.',
            '– To, siger Pelle. Og Bo, der sover i Rimhulen, har kun ét.',
            'Bodil griner. Hun tager et sidste stykke træ og gnaver lidt i det. Det bliver til en lillebitte skål. Så lille, at kun en meget lille en kan spise af den.',
            '– Den er til den, der går med de små fodspor, siger Bodil. Jeg har også set dem.'
          ]
        },
        {
          billede: 'billeder/dag20-3.jpg',
          tekst: [
            'Bodil fejer spånerne sammen med halen. Og midt i bunken af spåner glimter det.',
            'Kan I se det? Det glimter mellem spånerne.',
            '– Den var inde i en af mine stammer, siger Bodil. Jeg gnavede den fri, da jeg lavede sommerfuglen.',
            'Hun giver Pelle en brik med gylden kant.',
            { spoerg: 'I går havde Pelle nitten brikker. Nu får han én til. Hvor mange har han så?', svar: 'Tyve. Ti og ti er tyve.' },
            '– Tyve, siger Pelle. Nu mangler der kun fire.',
            'Sanne holder sin lille træfugl i næbbet hele vejen hjem.',
            'Fra bakken kan de se Susebanen. Rikke kører sin sidste tur med kælken før jul. Og i et af svingene glimter det.',
            'I morgen åbner vi låge nummer enogtyve.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.68 },
      opgave: {
        type: 'klap',
        runder: [{ ord: 'træ' }, { ord: 'gave' }, { ord: 'egern' }, { ord: 'sommerfugl' }, { ord: 'edderkop' }],
        flest: [['bi', 'sommerfugl'], ['æble', 'elefant']]
      }
    },
    {
      dag: 21, titel: 'Rikkes rimetur', sted: 'Susebanen', spil: 'games/racer/', emne: 'rim', moeder: ['rikke'],
      afsnit: [
        {
          billede: 'billeder/dag21-1.jpg',
          tekst: [
            'Ræven Rikke står klar ved toppen af Susebanen med sin røde kælk.',
            '– Sidste tur før jul, siger Rikke. Hop op.',
            'Pelle sætter sig forrest, og Sanne sætter sig på hans skulder. Og så går det ned ad bakken, gennem svingene, så sneen står om dem.',
            '– Når jeg kører hurtigt, får jeg lyst til at lave rim, råber Rikke. Kan I følge med?'
          ]
        },
        {
          billede: 'billeder/dag21-2.jpg',
          tekst: [
            'Højt oppe flyver et fly forbi. Rikke råber: Fly, fly, oppe i en ...',
            { spoerg: 'Fly og noget hvidt og blødt på himlen. Hvad rimer på fly?', svar: 'Sky. Fly og sky rimer.' },
            'De suser forbi søen. På isen står en and og kigger ned.',
            '– And, and, du står på frosset ...',
            { spoerg: 'And og det, der er i søen. Hvad rimer på and?', svar: 'Vand. And og vand rimer.' },
            'De kører forbi Gustavs gård. På muren hænger et stort ur.',
            '– Ur, ur, du hænger på en ...',
            { spoerg: 'Ur og det, uret hænger på. Hvad rimer på ur?', svar: 'Mur. Ur og mur rimer.' },
            '– Fly og sky, and og vand, ur og mur, råber Rikke. Det er den hurtigste rimetur i verden.'
          ]
        },
        {
          billede: 'billeder/dag21-3.jpg',
          tekst: [
            'I det sidste sving kører kælken lidt for tæt på kanten og ind i en snedrive. Puf. Alle tre ligger i sneen og griner.',
            'Og lige foran Pelles næse, i snedriven, glimter det.',
            'Kan I se det? Det glimter i snedriven.',
            'Pelle børster sneen af sin kasket og samler den op. En brik med gylden kant.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Enogtyve. Tyve og én er enogtyve.' },
            '– Nu mangler der kun tre, siger Rikke.',
            'De trækker kælken op ad bakken sammen. Det er tungt, men det går, når man er tre.',
            'På toppen stopper Sanne og kigger ud over hele verden.',
            '– I morgen skal jeg flyve en vigtig tur, siger hun. Jeg skal invitere alle vennerne til juleaften. Og der er noget, jeg vil fortælle dig undervejs, Pelle.',
            'I morgen åbner vi låge nummer toogtyve.'
          ]
        }
      ],
      brik: { x: 0.35, y: 0.65 },
      opgave: {
        type: 'rim',
        runder: [{ ord: 'fly', rigtig: 'sky', andre: ['ko', 'hat', 'bil'] }, { ord: 'and', rigtig: 'vand', andre: ['mus', 'ugle', 'fisk'] }],
        ikke: [['ur', 'mur', 'sol'], ['salat', 'tomat', 'kanin']],
        par: [['pingvin', 'banan', 'kanin', 'tomat']]
      }
    },

    /* ---------- Faellesskab og jul ---------- */
    {
      dag: 22, titel: 'Invitationerne', sted: 'Himmelvejen', spil: 'games/flyv/', emne: 'faellesskab', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag22-1.jpg',
          tekst: [
            'Sannes taske er fuld igen. Men i dag er det ikke julebreve. Det er invitationer. Pelle har tegnet dem selv. På hver invitation er der et juletræ og et stort puslespil.',
            'Kom til juletræet i Nøddeskoven juleaften, står der. Så lægger vi puslespillet sammen.',
            'Pelle sidder på Sannes ryg, og de flyver ud over Himmelvejen. De lander hos Egon og Gustav, hos Bodil og Klaus og Klara, hos Rikke og Milo, Ulla og Rasmus, Kaja og Emil og Ella.',
            'Ved Rimhulen lægger de en invitation helt stille ved Bo. Hvis han nu skulle vågne.'
          ]
        },
        {
          billede: 'billeder/dag22-2.jpg',
          tekst: [
            'På vej hjem flyver Sanne langsommere. Hun er stille.',
            '– Hvad er der, Sanne, spørger Pelle.',
            '– Der er noget, jeg vil sige, siger Sanne. Engang tog jeg din skruenøgle. Fordi den var blank. Jeg tænkte ikke på, at du blev ked af det.',
            '– Det er længe siden, siger Pelle. Og du sagde undskyld.',
            '– Ja, siger Sanne. Men før havde jeg ingen venner. Nu har jeg en masse. Og jeg vil ikke have, at nogen bliver glemt. Ligesom jeg var.',
            'Pelle tænker sig om. Har de inviteret alle sammen?',
            { spoerg: 'Hvordan tror I, det føles, hvis alle de andre er til fest, og man ikke selv er inviteret?', svar: 'Det føles trist og ensomt. Derfor skal alle være med.' },
            { spoerg: 'Hvad kan man gøre, hvis man ser én, der står alene?', svar: 'Man kan gå hen og spørge: Vil du være med?' }
          ]
        },
        {
          billede: 'billeder/dag22-3.jpg',
          tekst: [
            'Så kommer Pelle i tanke om det. De små fodspor. Den lille hue. Skålen med grød. Pakken på trappen.',
            '– Der er én, vi har glemt, siger Pelle. Én, der har hjulpet os hele tiden. Men vi ved ikke, hvem det er, og vi ved ikke, hvor den bor.',
            'Pelle tager den sidste invitation og skriver på den med sin fineste blyant. Han tegner en lillebitte, rød hue. Og et hjerte.',
            '– Den lægger vi der, hvor fodsporene starter, siger Sanne. Under juletræet.',
            'De flyver hjem. Og da de flyver hen over Gustavs tag, ser Sanne det. Oppe på vejrhanen, der drejer i vinden, sidder der noget fast. Det glimter.',
            'Kan I se det? Det glimter på vejrhanen.',
            'Sanne napper det med næbbet. En brik med gylden kant.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Toogtyve. Nu mangler der kun to.' },
            'Pelle lægger den lille invitation under juletræet. Lige der, hvor de så de første fodspor.',
            'I morgen åbner vi låge nummer treogtyve.'
          ]
        }
      ],
      brik: { x: 0.58, y: 0.3 },
      opgave: {
        type: 'pynt', spoerg: 'Hjælp med at pynte juletræet til festen. Træk pynten op på grenene.',
        moenstre: [
          { moenster: 'AB', dele: ['roed', 'blaa'], vist: 5, valg: ['roed', 'blaa', 'gul'] },
          { moenster: 'AB', dele: ['stjerne', 'klokke'], vist: 6, valg: ['klokke', 'stjerne', 'lys'] },
          { moenster: 'AAB', dele: ['gul', 'roed'], vist: 5, valg: ['gul', 'roed', 'blaa'] },
          { moenster: 'AAB', dele: ['stjerne', 'lys'], vist: 7, valg: ['lys', 'stjerne', 'klokke'] },
          { moenster: 'ABC', dele: ['roed', 'blaa', 'gul'], vist: 7, mangler: 2, valg: ['gul', 'roed', 'blaa'] }
        ]
      }
    },
    {
      dag: 23, titel: 'Lillejuleaften', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'faellesskab', moeder: ['sanne'],
      afsnit: [
        {
          billede: 'billeder/dag23-1.jpg',
          tekst: [
            'Det er lillejuleaften. I morgen er det juleaften, og det er så svært at vente.',
            'Pelle kan ikke sidde stille. Han går fra værkstedet ud til juletræet og tilbage igen. Han tæller sine brikker igen og igen.',
            '– Det er svært at vente, siger Pelle. Det føles, som om i morgen aldrig kommer.',
            { spoerg: 'Hvad gør I, når det er svært at vente?', svar: 'Man kan synge, hjælpe til eller lege noget. Så går tiden hurtigere.' },
            '– Lad os hjælpe hinanden med at gøre klar, siger Sanne. Så går tiden hurtigere.'
          ]
        },
        {
          billede: 'billeder/dag23-2.jpg',
          tekst: [
            'Og så kommer vennerne. Én efter én kommer de gennem sneen for at hjælpe.',
            'Gustav kommer med en kurv brunkager. Egon kommer med nødder. Bodil har sine træfigurer med, og Klaus og Klara triller ind og synger deres sang. Rikke trækker kælken fuld af grangrene. Ulla, Rasmus, Kaja, Emil og Ella kommer sammen. Og Milo lander med sin raket.',
            'Alle hjælper. Nogen hænger pynt op. Nogen fejer sne. Nogen sætter lys i vinduerne.',
            'Så lægger de alle brikkerne frem på den store stub under juletræet. De lægger dem sammen, én efter én, og billedet kommer langsomt frem.',
            { spoerg: 'I går havde Pelle toogtyve brikker. Hvor mange mangler der, før der er fireogtyve?', svar: 'To. Toogtyve og to er fireogtyve.' },
            'Puslespillet er næsten helt. Men oppe i hjørnet er der to huller. To brikker mangler stadig.'
          ]
        },
        {
          billede: 'billeder/dag23-3.jpg',
          tekst: [
            'Det bliver mørkt. Vennerne går hjem for at sove, så de er friske i morgen.',
            'Pelle og Sanne sidder alene ved juletræet. Sanne kigger op i grenene. Helt oppe i toppen af træet, hvor stormen begyndte, glimter det.',
            'Kan I se det? Det glimter i toppen af juletræet.',
            'Sanne flyver op og henter den. En brik med gylden kant. Den har siddet fast i træet hele tiden, lige over deres hoveder.',
            { spoerg: 'Hvor mange brikker har Pelle nu?', svar: 'Treogtyve. Kun én mangler.' },
            'Pelle lægger brikken i puslespillet. Nu er der kun ét hul tilbage, oppe i hjørnet.',
            'Invitationen under juletræet er væk. Nogen har taget den.',
            'Før han går i seng, sætter Pelle en lille skål risengrød ud ved døren. Han bruger den lillebitte skål, som Bodil har lavet. Med en klat smør i midten.',
            '– God nat, hvem du end er, hvisker Pelle. Vi ses i morgen, håber jeg.',
            'I morgen åbner vi den sidste låge. Låge nummer fireogtyve.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.18 },
      opgave: {
        type: 'venner', spoerg: 'Nu kommer vennerne for at hjælpe. Kan I tælle dem?',
        grupper: [
          { tekst: 'Fire venner hænger pynt op. Tre venner fejer sne. Hvor mange venner er der i alt?', ting: ['gustav', 'egon', 'bodil', 'rikke', 'kaja', 'emil', 'ella'], foer: 4 },
          { tekst: 'Fem venner bærer grangrene. Fire venner sætter lys i vinduerne. Hvor mange venner er der i alt?', ting: ['klaus', 'klara', 'milo', 'rasmus', 'bo', 'ulla', 'sanne', 'gustav', 'egon'], foer: 5 }
        ],
        sorter: ['egon', 'sanne', 'bo', 'kaja', 'ulla', 'gustav']
      }
    },
    {
      dag: 24, titel: 'Juleaften', sted: 'Nøddeskoven', spil: 'games/maskinen/', emne: 'faellesskab', moeder: ['sanne', 'nis'],
      afsnit: [
        {
          billede: 'billeder/dag24-1.jpg',
          tekst: [
            'Det er juleaften. Sneen ligger blød og hvid over hele Nøddeskoven, og det er helt stille.',
            'Lysene i juletræet brænder, og alle vennerne er kommet. Gustav, Egon, Bodil, Klaus og Klara, Rikke, Milo, Ulla, Rasmus, Kaja, Emil og Ella. Selv Bo er vågnet og kommet, gabende og glad, med Pelles vante i poten.',
            'Puslespillet ligger på stubben under træet. Treogtyve brikker. Kun én mangler.',
            'Pelle har lige set, at skålen ved døren er tom. Slikket helt ren.',
            'Så rasler det i grenene, helt nede ved jorden. Alle bliver stille.'
          ]
        },
        {
          billede: 'billeder/dag24-2.jpg',
          tekst: [
            'Ud under de nederste grene kommer der en lille, bitte lille nisse. Han har en rød hue på, og på huen mangler der lidt uld. Under armen har han Pelles invitation.',
            '– Hej, siger nissen stille. Jeg hedder Nis.',
            'Han går hen til Pelle og rækker ham noget. Det er en brik med gylden kant.',
            '– Jeg fandt den den første aften, siger Nis. Lige efter stormen. Jeg har passet på den hele tiden. Men jeg turde ikke komme frem. Jeg troede ikke, at nogen ville have mig med.',
            '– Det var dig, siger Pelle. Dig med fodsporene. Dig, der lagde pakken på trappen.',
            'Nis nikker og bliver rød i kinderne.',
            '– Og nu fik jeg en invitation, siger Nis. Med en hue og et hjerte. Så vidste jeg, at den var til mig.',
            { spoerg: 'Hvordan tror I, Nis har det nu?', svar: 'Glad. Han er glad, fordi han er med.' }
          ]
        },
        {
          billede: 'billeder/dag24-3.jpg',
          tekst: [
            'Pelle tager Nis i hånden. Sammen lægger de den sidste brik i puslespillet.',
            'Klik.',
            'Kan I hjælpe? Læg den sidste brik i puslespillet.',
            { spoerg: 'Hvor mange brikker er der i puslespillet nu?', svar: 'Fireogtyve. Alle brikkerne er fundet.' },
            'Puslespillet er helt. Og det er præcis det billede, Pelle malede: alle vennerne om juletræet, juleaften.',
            'Men Pelle tager sin pensel frem. Og helt nede i hjørnet maler han en lille nisse med en rød hue. Så er alle med på billedet.',
            'Så tager alle hinanden i hånden. Pelle og Sanne, Nis og Bo, Gustav og Egon og Bodil, Klaus og Klara, Rikke og Milo, Ulla og Rasmus, Kaja og Emil og Ella. De danser om juletræet og synger Egons sang og Klatternes sang. Is og gris, tog og bog, ko og sko.',
            'Sanne flyver en tur op over træet og kigger ned på dem alle sammen.',
            '– Det bedste er ikke puslespillet, siger hun. Det bedste er, at vi fandt det sammen.',
            'Glædelig jul, Pelle. Glædelig jul, Sanne. Glædelig jul, Nis.',
            'Og glædelig jul til jer.'
          ]
        }
      ],
      brik: { x: 0.5, y: 0.7 },
      opgave: {
        type: 'puslespil', spoergLoese: 'Vennerne har lagt fem brikker frem. Læg dem i puslespillet.',
        spoerg: 'Læg den sidste brik i puslespillet.'
      }
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
