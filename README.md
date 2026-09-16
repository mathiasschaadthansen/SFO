# SFO Spil

Reklamefri spil til SFO'ens iPads. Ingen login, ingen sporing, ingen netværkskald.
Alt kører lokalt i browseren, så der er ingen personoplysninger at indgå en
databehandleraftale om.

Spillene indtil nu:

- **Racerbanen**: top-down racer med ét fingertryk, 1 eller 2 spillere på den
  samme iPad. Tre baner, tre sværhedsgrader, turbofelter.
- **Klatbold**: to klatter, én bold, to mål. Løb med siderne, hop med midten,
  først til fem mål. 1 spiller mod AI eller 2 spillere.
- **Bobler**: skyd boblerne med snoren, så de deler sig, til de er væk. Tolv
  baner i tre verdener med platforme og bobler der drypper ned, fire specials
  (dobbeltsnor, klæbesnor, frys, skjold), ingen liv. To spillere hjælper
  hinanden og vinder sammen.
- **Bogstaver**: kør en bil, en raket eller en pensel langs A-Å, a-å og 0-9,
  eller find det rigtige bogstav blandt bobler. Tal vises også som æbler, der
  tælles. På 3 stjerner siger skyen bogstavet i stedet for at vise det. Navnene
  siges med iPad'ens indbyggede danske stemme, hvis der er en.

## Kom i gang

```bash
npm start     # server på http://localhost:3000
npm test      # kører fysik- og banetests, ingen browser nødvendig
```

I GitHub Codespaces starter serveren af sig selv, og port 3000 videresendes
automatisk. Åbn den videresendte adresse på en iPad for at teste på rigtigt
hardware — det er det eneste sted man kan mærke om styringen føles rigtig.

## Sådan hænger det sammen

```
index.html              menuen — bygges ud fra js/games.js
js/games.js             spil-registret. Tilføj et spil = én blok her
js/sprites.js           fælles indlæsning og omfarvning af sprites
assets/kenney/          sprites fra Kenney (CC0): biler, klatter, figurer, raket
sw.js                   offline-cache. Nye filer skal tilføjes til FILER
manifest.webmanifest    gør siden til en app på hjemmeskærmen

games/racer/
  js/track.js           bygger asfalt, kollisionsmaske og checkpoints
  js/physics.js         fysik, AI og alle tal der styrer hvordan det føles
  js/input.js           multi-touch — flere fingre samtidig
  js/game.js            menu, kamera, split screen og tegning
  tracks/*.json         banerne

games/klatbold/
  js/physics.js         bold, klatter, mål og AI — ingen DOM
  js/input.js           multi-touch med tre knapper pr. spiller
  js/game.js            menu, tegning, lyd

games/bobler/
  js/physics.js         bobler, snor, specials og de tolv baner — ingen DOM
  js/input.js           multi-touch med tre knapper pr. spiller
  js/game.js            menu, tegning, lyd

test/racer.test.js      kører 3 omgange på hver bane uden browser
test/klatbold.test.js   mål, overligger, hop, AI og en hel kamp mellem to AI'er
games/bogstaver/
  js/glyffer.js         A-Å og 0-9 som streger i skriveretning — ingen DOM
  js/spor.js            følger fingeren langs stregerne — ingen DOM
  js/ting.js            en ting pr. bogstav til "hvad starter med"
  ting/*.svg            tingenes tegninger, Noto Emoji (Apache 2.0, se ting/NOTICE.md)
  js/game.js            tegn- og find-legen, minispillet, menu, stemme
  lyd/klip.json         rigtige optagelser, hvis der er nogen (se lyd/NOTICE.md)
vaerktoej/lav-lyd.py    pakker optagelser som MP3 og skriver klip.json
vaerktoej/optag.html    optagerside: siger man de 146 ord ind, får man WAV-filer med rigtige navne

test/bobler.test.js     en robot spiller alle tolv baner igennem
test/bogstaver.test.js  alle 39 tegn kan tegnes af en finger langs stregen
```

`physics.js` rører hverken DOM eller canvas. Det er derfor testen kan køre i
Node uden en browser, og det er den fil man skal ind i når noget skal føles
anderledes.

## Skrue på hvordan det føles

Alt ligger i `INDSTIL` øverst i `games/racer/js/physics.js`.

| Værdi | Betyder |
|---|---|
| `topfart` | Hvor hurtigt bilen kører på asfalt |
| `graesfart` | Hvor meget græsset straffer |
| `drejehastighed` | Hvor skarpt der kan svinges |
| `svingBremse` | Hvor meget AI'en letter foden før et sving |
| `fastIGraes` | Sekunder i græsset før bilen sættes tilbage på banen |
| `aiElastik` | Hvor meget AI'en letter foden når den er foran, og giver gas når den er bagud |
| `styrehjaelp` | Hvor meget bilen selv trækker mod vejen, når ingen finger er nede. 0 slår det fra |
| `turboFaktor` | Hvor meget et turbofelt ganger farten op |
| `turboTid` | Sekunder turboen virker |

Sværhedsgraderne (1, 2 eller 3 stjerner i menuen) ligger i `SVAERHED` lige under
`INDSTIL`. Hver grad sætter `aiFart`, `aiElastik`, `styrehjaelp`, `svingBremse`,
`aiSigte`, om AI'en må tage turbo, og antallet af ekstra AI-biler. Testen kører
alle tre grader på alle baner.

`aiSigte` er den værdi der betyder mest for hvor hurtig AI'en er. Den bestemmer
hvor langt frem ad midterlinjen AI'en sigter. 30 giver en bred, langsom linje,
20 en stram og hurtig. Under 18 begynder den at køre i græsset.

Turbofelterne bygges i `track.js` ud fra checkpoints, forskudt skiftevis til højre
og venstre for midten. Man skal styre efter dem for at få skubbet. AI'en kører midt
på vejen og rammer dem sjældent, så de belønner den der styrer aktivt.
| `omgange` | Antal omgange i et løb |

Kør `npm test` bagefter. Testen fanger hvis en ændring gør banerne uigennemførlige
— den fandt allerede én gang, at bilerne ikke kunne tage svingene.

## Lave en ny bane

En bane er en lukket midterlinje af 6-10 punkter. Kurverne udjævnes automatisk,
og asfalt, kantsten, kollisionsmaske og checkpoints bygges ud fra linjen.

1. Lav `games/racer/tracks/minbane.json`:

```json
{
  "navn": "Min bane",
  "bredde": 1600,
  "hoejde": 1200,
  "vejbredde": 165,
  "checkpoints": 24,
  "punkter": [[320, 260], [880, 190], [1340, 400], [400, 920]]
}
```

2. Tilføj den i `games/racer/tracks/index.js`
3. Tilføj filstien i `FILER` i `sw.js` og tæl `VERSION` op
4. `npm test` — den tjekker at banen kan gennemføres

Hold `vejbredde` på mindst 150 hvis banen har skarpe sving. Smalle baner er ikke
sjove for 6-årige, og de er det første testen brokker sig over.

## Skrue på Klatbold

`INDSTIL` øverst i `games/klatbold/js/physics.js`: tyngde, hoppehøjde, boldens
hop, målhøjde og hvor mange mål der skal til. `SVAERHED` sætter AI'ens fart,
reaktionstid og hoppelyst for 1, 2 og 3 stjerner. Kør `npm test` bagefter.

## Skrue på Bobler

`INDSTIL` øverst i `games/bobler/js/physics.js`: boblernes størrelser, hvor højt
de hopper, snorens fart, hvor længe man er svimmel, og hvor tit og hvor længe
specials virker. Banerne ligger i `BANER` lige under. En bane har et tema
(`strand`, `nat` eller `bjerge`), et tempo, en liste af bobler (x, størrelse
med 0 = størst, retning, starthøjde og valgfrit hvor mange sekunder inde i
banen den drypper ned fra oven) og valgfrit platforme (x, højde, bredde), som
boblerne hopper på. Snoren går igennem platforme, så ingen boble kan blive
umulig at nå. Tilføj en bane ved at skrive en linje til. `npm test` lader en
robot spille alle baner igennem uden specials og brokker sig, hvis det tager
over ti minutter.

## Skrue på Bogstaver

Tegnene ligger i `games/bogstaver/js/glyffer.js` som streger i en kasse på
100 x 100, i den rækkefølge og retning man skriver dem. Buer laves med `bue()`.
Små bogstaver står på en grundlinje ved y=80. Tilføj et tegn ved at skrive en
linje til og sætte navnet ind i `BOGSTAVER`, `SMAA` eller `TAL`.

Efter et tegnet bogstav kommer et minispil: tre ting, og barnet skal trykke på
den, der starter med bogstavet. Tingene ligger i `games/bogstaver/js/ting.js`
med ét ord, en SVG i `ting/` og en tegning i kode som reserve pr. bogstav. Se
`ting/NOTICE.md` for hvordan man tilføjer en ting. Q, W og Z har ingen ting og
springer minispillet over.

Spillet skruer selv op og ned inden for en omgang: tegnes et tegn med højst én
afvej, bliver tolerancen strammere næste gang, og fingerhjælpen forsvinder.
Driller det, bliver den bredere igen. I Find giver tre rigtige i træk otte
bobler og blanding af store og små bogstaver, seks i træk giver lyt-og-find.
Tre stjerner øverst til højre viser trinnet. Intet gemmes, når siden lukkes. Hvor tæt fingeren skal følge stregen, styres af `TOLERANCE` i
`game.js`, én værdi pr. stjerne. `npm test` tjekker, at hvert tegn kan tegnes
færdigt af en finger, der følger stregen.

## Sprites

Biler, klatter, figurer og raketten er sprites fra Kenney (CC0), se
`assets/kenney/NOTICE.md`. Hvert spil har stadig sin tegning i kode som reserve,
så intet venter på et billede. Farver, der ikke findes i pakken, laves med
`Sprites.tint()`, der bytter farvetone og beholder lys og skygge. Nye sprites
skal med i `FILER` i `sw.js`; testen `test/assets.test.js` brokker sig ellers.

## Indtale stemmen selv

Bogstaver bruger iPad'ens egen stemme. Den kan erstattes af en rigtig på en time:

1. Åbn `vaerktoej/optag.html` i Chrome på en computer med mikrofon (via
   `npm start` eller den offentlige adresse). Siden viser hvert ord, og hvert
   klip gemmes i Overførsler med det rigtige filnavn. Mellemrumstasten
   starter og stopper, piletasterne skifter ord.
2. Læg WAV-filerne i én mappe og kør
   `python3 vaerktoej/lav-lyd.py --optagelser <mappen>`. Stilhed klippes væk,
   lydstyrken sættes ens, og MP3-filerne lægges i `games/bogstaver/lyd/`.
3. Tilføj de nye mp3-filer til `FILER` i `sw.js`, `npm test`, tæl `VERSION`
   op, commit.

Man behøver ikke indtale alt på én gang. Kun de ord, der er optaget, bruger
optagelsen, resten siges stadig af iPad'en.

## Lave et nyt spil

Lav `games/<navn>/` med sin egen `index.html`, tilføj en blok i `js/games.js`
og filerne i `sw.js`. Menuen bygger sig selv.

## Ud på SFO'ens iPads

Skole-iPads er næsten altid styret af en MDM (Jamf, Mosyle eller lignende).
Pædagogerne kan derfor ikke selv installere noget — det skal IT gøre. Til
gengæld er en webside nemmere for dem at udrulle end en app.

Afklar med den der styrer iPad'ene, før der bygges videre:

1. Kan I hviidliste domænet? Mange MDM'er filtrerer web som standard.
2. Kan I pushe en **web clip** ud til alle enheder? Det giver et ikon på
   hjemmeskærmen på alle iPads på én gang.
3. Bruger I Guided Access? Slå det til, så børnene ikke swiper ud af spillet.

Uden MDM: åbn siden i Safari, tryk Del og vælg Føj til hjemmeskærm.

Sitet skal serveres over HTTPS. Service workeren — og dermed offline-tilstand —
virker ikke over almindelig HTTP undtagen på localhost.

## Test på iPad

Simulatoren og desktop-Safari lyver om to ting, så de skal prøves på hardware:

- **Flere fingre samtidig.** To spillere betyder flere fingre nede på én gang.
  Koden følger hver finger via `pointerId`; med almindelige click-handlere
  ville spiller 2's tryk slå spiller 1's styring ud.
- **Lyd.** iOS afspiller først lyd efter et tryk. Derfor starter tonerne først
  når man har trykket på en knap i menuen.

`window.__debug()` i konsollen viser tilstand, bilernes position, fart, omgang
og om de er på asfalt.

## Ophavsret

Al grafik tegnes i kode. Der er ingen figurer, navne eller lyde fra
kommercielle spil i projektet, og der skal ikke lægges nogen ind.
