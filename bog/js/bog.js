/**
 * Bogen om Noeddeskoven: de ti opslag uden skaerm, saa de kan testes i Node.
 *
 * Pelle Pindsvin har tabt sin skruenoegle. Skaden Sanne har taget den og
 * flyver forud, saa noeglen gemmer sig et nyt sted paa hvert opslag, og
 * boernene kan finde den, selvom Pelle ikke kan. Hvert opslag er et af
 * spillenes steder, og den, Pelle moeder, er stedets egen figur.
 *
 * Billedet paa venstre side er 600 x 780 enheder; noeglens og skadens
 * pladser staar i de enheder. Teksten laeses hoejt af stemmen (klip i lyd/,
 * ellers enhedens egen stemme).
 */
(function (rod) {
  'use strict';

  var TITEL = 'Bogen om Nøddeskoven';
  var NAVNE = {
    pelle: 'Pelle Pindsvin', sanne: 'Skaden Sanne', rikke: 'Ræven Rikke', klaus: 'Klaus', klara: 'Klara',
    emil: 'Emil', ella: 'Ella', ulla: 'Uglen Ulla', bo: 'Bjørnen Bo', kaja: 'Kaninen Kaja',
    rasmus: 'Robotten Rasmus', milo: 'Rummusen Milo', gustav: 'Grisen Gustav'
  };

  /* noegle: hvor skruenoeglen gemmer sig i det kodetegnede billede (x, y, stoerrelse, drejning). skade: hvor Sanne er, hvis hun er med.
     malet: det malede billede af hele opslaget (billeder/opslag/) og noeglens plads i det; bruges, naar billedet er hentet. */
  var OPSLAG = [
    {
      id: 'noeddeskoven', sted: 'Nøddeskoven', spil: 'games/maskinen/', moeder: [],
      tekst: [
        'Pelle Pindsvin bor i Nøddeskoven. Han bygger de skøreste maskiner af alt, hvad han finder.',
        'Men i dag er hans skruenøgle væk! "Hvem har set min nøgle?" råber Pelle. Ingen svarer.',
        'Højt oppe flyver Skaden Sanne forbi med noget blankt i næbbet. Pelle ser det ikke. Gør du?'
      ],
      rim: ['Nøglen er væk, hvor kan den dog være?', 'Pelle går ud i verden. Der er meget at lære.'],
      besoeg: 'Besøg mig i Nøddeskoven.',
      skade: { x: 480, y: 150, s: 110, flyver: true }, noegle: { x: 496, y: 92, s: 26, v: 0.4 },
      malet: { fil: 'billeder/opslag/noeddeskoven.jpg', noegle: { x: 370, y: 90, s: 60 } }
    },
    {
      id: 'susebanen', sted: 'Susebanen', spil: 'games/racer/', moeder: ['rikke'],
      tekst: [
        'På Susebanen kører Ræven Rikke. Hun er den hurtigste i hele skoven.',
        '"Hop ind!" siger Rikke. "Så leder vi, mens vi kører." Bilen suser rundt i svingene. Rundt og rundt og rundt.',
        '"Jeg blev helt svimmel," siger Pelle. "Men nøglen så jeg ikke."'
      ],
      rim: ['Rikke kører rundt om sø og skov,', 'så hurtigt, at man siger: hov!'],
      besoeg: 'Besøg mig på Susebanen.',
      skade: null, noegle: { x: 525, y: 572, s: 26, v: -0.4 },
      malet: { fil: 'billeder/opslag/susebanen.jpg', noegle: { x: 200, y: 625, s: 70 } }
    },
    {
      id: 'boldbanen', sted: 'Boldbanen', spil: 'games/klatbold/', moeder: ['klaus', 'klara'],
      tekst: [
        'På Boldbanen bor Klatterne. Klaus er rød, Klara er blå, og de er runde og bløde og elsker at spille bold.',
        '"Har I set min nøgle?" spørger Pelle. "Nej," siger Klara, "men du må gerne være målmand!"',
        'Bolden flyver højt, højt op ... og lige over overliggeren.'
      ],
      rim: ['Bolden flyver op mod sky,', 'og Klaus råber: "Prøv på ny!"'],
      besoeg: 'Besøg mig på Boldbanen.',
      skade: null, noegle: { x: 566, y: 536, s: 24, v: -0.4 },
      malet: { fil: 'billeder/opslag/boldbanen.jpg', noegle: { x: 80, y: 590, s: 70 } }
    },
    {
      id: 'boblehavet', sted: 'Boblehavet', spil: 'games/bobler/', moeder: ['emil', 'ella'],
      tekst: [
        'Ved Boblehavet går solen ned. Store bobler stiger op af vandet, og inde i boblerne gemmer der sig ting.',
        'Emil og Ella står på stranden. "Vi hjælper dig," siger Ella. Pop! I den grønne boble ligger en muslingeskal. Pop! I den blå en sok.',
        'Og i den sidste boble, helt derude ... "Åh nej," siger Emil. "Den fløj væk."'
      ],
      rim: ['Bobler, bobler, op de går.', 'Pop dem én for én, så ser vi, hvad vi får.'],
      besoeg: 'Besøg os ved Boblehavet.',
      skade: { x: 520, y: 110, s: 60, flyver: true }, noegle: { x: 528, y: 300, s: 22, v: 0.5 },
      malet: { fil: 'billeder/opslag/boblehavet.jpg', noegle: { x: 400, y: 260, s: 70 } }
    },
    {
      id: 'bogstavvejen', sted: 'Bogstavvejen', spil: 'games/bogstaver/', moeder: ['ulla'],
      tekst: [
        'På Bogstavvejen bor Uglen Ulla. Hun kender alle bogstaverne og skriver dem med en fjer i sandet.',
        '"N som i nøgle," siger Ulla og skriver et stort N. "P som i Pelle. S som i ..." "Skade!" råber Pelle.',
        'For dér, på skiltet, sidder Skaden Sanne. Og hun har noget blankt i næbbet.'
      ],
      rim: ['Ulla skriver N og P,', 'og pludselig kan Pelle se.'],
      besoeg: 'Besøg mig på Bogstavvejen.',
      skade: { x: 470, y: 290, s: 110, flyver: false }, noegle: { x: 514, y: 158, s: 26, v: 0.5 },
      malet: { fil: 'billeder/opslag/bogstavvejen.jpg', noegle: { x: 500, y: 280, s: 60 } }
    },
    {
      id: 'rimhulen', sted: 'Rimhulen', spil: 'games/rim/', moeder: ['bo'],
      tekst: [
        'I Rimhulen brummer Bjørnen Bo. Alt, hvad han siger, rimer, og det er svært at lade være.',
        '"Kat og hat," brummer Bo. "Mus og hus. Skade og ..." "Kage?" prøver Pelle. "Nej," siger Bo. "Skade og ... lade!"',
        'Skaden flyver ud af hulen og hen mod laden.'
      ],
      rim: ['Bo brummer rim i sin mørke hule,', 'mens skaden flyver med noget, den vil skjule.'],
      besoeg: 'Besøg mig i Rimhulen.',
      skade: { x: 505, y: 260, s: 90, flyver: true }, noegle: { x: 517, y: 210, s: 24, v: 0.4 },
      malet: { fil: 'billeder/opslag/rimhulen.jpg', noegle: { x: 380, y: 184, s: 70 } }
    },
    {
      id: 'vrimleskoven', sted: 'Vrimleskoven', spil: 'games/find/', moeder: ['kaja'],
      tekst: [
        'I Vrimleskoven er der fyldt med alt muligt. Ting i vinduerne, ting bag hegnet, ting oppe i træerne.',
        '"Kan du finde skaden?" spørger Kaninen Kaja. Der er så mange, der ligner. En ugle. En and. En sort fugl. Og der!',
        'Men da Pelle løber derhen, er der bare en fjer tilbage.'
      ],
      rim: ['Vrimle, vrimle, kig engang,', 'hvor er skaden, sort og lang?'],
      besoeg: 'Besøg mig i Vrimleskoven.',
      skade: { x: 520, y: 95, s: 60, flyver: true }, noegle: { x: 528, y: 62, s: 22, v: 0.4 },
      malet: { fil: 'billeder/opslag/vrimleskoven.jpg', noegle: { x: 48, y: 280, s: 60 } }
    },
    {
      id: 'tegnestuen', sted: 'Tegnestuen', spil: 'games/tegn/', moeder: ['rasmus'],
      tekst: [
        'I Tegnestuen tegner Robotten Rasmus. "Fortæl, hvordan den ser ud," siger Rasmus, "så tegner jeg den."',
        '"Den er grå og lang," siger Pelle. "Og i hver ende har den en mund, der kan bide fast om en møtrik." Rasmus tegner. "Sådan?" "Præcis sådan!"',
        '"Så laver vi plakater," siger Rasmus. "Så kan alle lede."'
      ],
      rim: ['Rasmus tegner grå og lang,', 'nu leder alle på én gang.'],
      besoeg: 'Besøg mig i Tegnestuen.',
      skade: null, noegle: { x: 552, y: 626, s: 26, v: -0.35 },
      malet: { fil: 'billeder/opslag/tegnestuen.jpg', noegle: { x: 392, y: 98, s: 60 } }
    },
    {
      id: 'stjerneuret', sted: 'Stjerneuret', spil: 'games/klokken/', moeder: ['milo'],
      tekst: [
        'Nu er det blevet nat. Højt oppe ved Stjerneuret svæver Rummusen Milo. Deroppefra kan man se alt.',
        '"Jeg så din nøgle," siger Milo. "Klokken syv fløj en skade forbi. Klokken otte sad hun på et tag. Og taget var Skovkøkkenets."',
        '"Skovkøkkenet!" siger Pelle. "Men jeg er så træt." "Så sov," siger Milo. "Jeg vækker dig klokken syv."'
      ],
      rim: ['Milo ser alt fra sin stjernenat,', 'han ved, hvor skaden har gemt sin skat.'],
      besoeg: 'Besøg mig ved Stjerneuret.',
      skade: { x: 100, y: 494, s: 44, flyver: false }, noegle: { x: 119, y: 474, s: 16, v: 0.3 },
      malet: { fil: 'billeder/opslag/stjerneuret.jpg', noegle: { x: 462, y: 110, s: 60 } }
    },
    {
      id: 'skovkoekkenet', sted: 'Skovkøkkenet', spil: 'games/restaurant/', moeder: ['gustav'],
      tekst: [
        'Om morgenen står Grisen Gustav i Skovkøkkenet og bager. Alle vennerne er kommet: Rikke, Klaus og Klara, Emil og Ella, Ulla, Bo, Kaja, Rasmus og Milo.',
        'Oppe på taget sidder Skaden Sanne med nøglen i næbbet. "Den var så blank," siger hun. "Jeg ville bare have den lidt."',
        '"Du skal spørge først," siger Pelle. "Kom ned, så får du en pandekage." Og så er nøglen hjemme.'
      ],
      rim: ['Nøglen er fundet, nu er der fest,', 'og pandekager smager allerbedst.'],
      besoeg: 'Besøg mig i Skovkøkkenet.',
      skade: { x: 210, y: 222, s: 90, flyver: false }, noegle: { x: 245, y: 160, s: 24, v: 0.6 },
      malet: { fil: 'billeder/opslag/skovkoekkenet.jpg', noegle: { x: 200, y: 695, s: 70 } }
    }
  ];

  rod.Bog = { TITEL: TITEL, NAVNE: NAVNE, OPSLAG: OPSLAG, FORSIDE: 'billeder/opslag/hus.jpg', BREDDE: 600, HOEJDE: 780 };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
