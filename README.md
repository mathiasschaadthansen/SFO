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
- **ABC og 123** (mappen `bogstaver`): kør en bil, en raket eller en pensel langs A-Å, a-å og 0-9,
  find det rigtige bogstav blandt bobler, eller tegn hele ord bogstav for
  bogstav med billedet af tingen ved siden af. Tal vises også som æbler, der
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
js/menu.js              fælles menuikoner: stjerner, spillere, start, igen, tilbage
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
  js/ting.js            ting pr. bogstav til "hvad starter med" og til Ord
  ting/*.svg            tingenes tegninger, Noto Emoji (Apache 2.0, se ting/NOTICE.md)
  js/game.js            tegn- og find-legen, minispillet, menu, stemme
  lyd/klip.json         rigtige optagelser, hvis der er nogen (se lyd/NOTICE.md)
vaerktoej/lav-lyd.py    pakker optagelser som MP3 og skriver klip.json
vaerktoej/lav-lyd-elevenlabs.py  laver klippene med ElevenLabs, én gang, med din egen nøgle
vaerktoej/optag.html    optagerside: siger man de 146 ord ind, får man WAV-filer med rigtige navne

games/restaurant/
  js/koekken.js         retter, ingredienser, de 36 bestillinger og reglerne — ingen DOM
  js/game.js            kunder, tallerken, hylde, klokke, lyd og stemme
  lyd/klip.json         stemmeklip til bestillingerne, hvis der er nogen
assets/noto/*.svg       mad og dyr, Noto Emoji (Apache 2.0, se assets/noto/NOTICE.md)

test/bobler.test.js     en robot spiller alle tolv baner igennem
test/bogstaver.test.js  alle 68 tegn kan tegnes af en finger langs stregen, ting, ord og regnestykker
games/tegn/
  js/figurer.js         16 figurer i fire universer som streger og farver — ingen DOM
  js/pusle.js           puslespillets brikker, tappe og klik-på-plads — ingen DOM
  js/game.js            tegning med fingeren, puslespil, menu, lyd (bruger bogstavernes spor.js)
test/tegn.test.js       alle figurer kan tegnes, og puslespillet kan samles på alle tre stjerner
test/restaurant.test.js en robot henter på gården, serverer og betaler en hel dag på alle tre stjerner
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

AI'en sigter et antal punkter frem ad midterlinjen, og der er 24 punkter mellem
to af banens punkter. Ligger punkterne langt fra hinanden i en kurve, sigter
AI'en for langt og skærer ind over græsset: læg flere punkter i kurven. Har
banen lange lige stykker, kan `"aiSigteFaktor": 1.3` i JSON-filen give AI'en
et længere sigte på netop den bane.

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

Efter et tegnet bogstav kommer et minispil: tre ting, og barnet skal finde
den, der starter med bogstavet. Spørgsmålet stilles først. Et tryk på et kort
vender det, så ordet står på bagsiden med forbogstavet i farve, og stemmen
siger ordet. Kortene må vendes så tit man vil. Svaret gives med det grønne
flueben under kortet, og et tryk på skyen gentager spørgsmålet. Forkert svar
vender kortet og stiller spørgsmålet igen, ingen straf. Tingene ligger i
`games/bogstaver/js/ting.js` med ét ord, en SVG i `ting/` og en tegning i kode
som reserve pr. bogstav. Se `ting/NOTICE.md` for hvordan man tilføjer en ting.
Q, W og Z har ingen ting og springer minispillet over.

Menuen er én skærm i tre zoner: øverst hvilke tegn (A, a, katten med KAT,
eller 1 2 3 med æbler, den valgte er blå), i midten de grønne knapper Tegn og
Find (eller én startknap for ord), og nederst køretøj og stjerner som små valg.
Ord skrives med den størrelse, der sidst blev valgt.

**Ord** tegner hele ord: billedet af tingen står i en sky, stemmen siger ordet,
og bogstaverne tegnes ét ad gangen på en række med det samme køretøj som i Tegn.
Færdige bogstaver bliver stående i farve, og til sidst siges ordet igen. Store
eller små bogstaver følger ABC/abc i menuen. Stjernerne vælger ordlængden
(`Ting.ORD_LAENGDE`): én stjerne er ord på højst tre bogstaver, to stjerner op
til fem, tre stjerner alle 78. Kasserne er mindre end i Tegn, så tolerancen
skrues op, så fingeren får omtrent samme plads på skærmen.

Efter et tal kommer et regnestykke, hvor svaret er netop det tal, man har
tegnet (`js/regn.js`): tre svarkort, og æbler under tallene at tælle på. En
stjerne er kun plus, to stjerner er plus og minus, og på tre stjerner kommer
æblerne først frem, hvis man svarer forkert. Ved minus er de æbler, der trækkes
fra, streget over. Er `plus.mp3`, `minus.mp3` og eventuelt `er_lig_med.mp3`
indtalt, siges stykket med klip ("to", "plus", "tre"); ellers siger enhedens
stemme det.

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

## Stemme fra ElevenLabs

Alternativ til at indtale selv: `vaerktoej/lav-lyd-elevenlabs.py` laver de 146
klip med en stemme fra ElevenLabs. Det sker én gang på din computer med din
egen nøgle i miljøvariablen `ELEVENLABS_API_KEY`; nøglen ligger aldrig i
repoet, og spillet kalder aldrig ElevenLabs. Kør `--stemmer` for at finde en
dansk kvindestemme, lav bogstaverne først med `--kun bogstaver`, lyt, ret
udtalen i `NAVNE` om nødvendigt, og lav så resten. Scriptet skriver
`klip.json` og lægger filerne i `sw.js`. Gratis-planen kræver kreditering,
den står i `lyd/NOTICE.md`.

## Lave et nyt spil

Lav `games/<navn>/` med sin egen `index.html`, tilføj en blok i `js/games.js`
og filerne i `sw.js`. Menuen bygger sig selv.

Spillets egen menu bygges med `js/menu.js`, så knapperne ser ens ud i alle
spil og kan forstås uden at læse: `Menu.stjerneRaekke(svaerhed)` giver de tre
stjerneknapper, `Menu.startRaekke('start')` de to grønne knapper med én og to
figurer, `Menu.lydRaekke(lydTil)` lydknappen og `Menu.slutRaekke('igen', skift,
menu)` slutskærmens igen, palet og tilbage-pil. Enkelte ikoner findes som
`Menu.start()`, `Menu.igen()`, `Menu.tilbage()`, `Menu.palet()`, `Menu.bane()`,
`Menu.fri()` og `Menu.tegnAlle()`.

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

## Restauranten

En dyrekunde bestiller pizza, burger eller pandekager. Boblen viser retten og
ingredienserne som billeder, og stemmen siger bestillingen. Barnet trykker
ingredienserne op på tallerkenen og ringer på klokken. En forkert ingrediens
hopper bare tilbage, der er ingen tid og ingen sure kunder. To børn har hver
sin station og serverer mod det samme mål, så de arbejder sammen.

**Gården.** Én ingrediens pr. bestilling mangler på hylden. Kassen er tom og
har en grøn spire, og både i boblen og på hylden kan man se, hvad der mangler.
Et tryk på kassen sender barnet ud på gården, hvor kunden spørger "Hvor kommer
osten fra?". Gården viser kilderne til alt på rettens hylde: koen giver mælk,
som bliver til ost og smør (tryk to gange: først malkes der), bien giver
honning, og resten vokser på planter, buske og træer. Kød kommer fra
slagteren, en bod med et gris-skilt, ikke fra et dyr på gården. En forkert
kilde vipper og viser i en tankeboble, hvad den giver. Kilderne står i
`KILDER` i `koekken.js`, og tegningerne er i kode i `tegnKilde` i `game.js`.

**Regningen.** Når kunden har spist, kommer regningen i boblen: hver
ingrediens med sin pris i mønter, "=" og et felt til svaret. Barnet lægger
mønter i kassen på disken, til det passer. En mønt for meget hopper tilbage.
Priserne trækkes tilfældigt pr. kunde (`PRIS_MAKS`), så regnestykket
varierer. Én stjerne: alt koster 1, summen vises som mønter, og pungen har kun
1-mønter, så det er at tælle. To stjerner: en ting koster 1 eller 2, og pungen
har 1- og 2-mønter. Tre stjerner: 1, 2 eller 3, priserne står som tal på
mønterne, og pungen har 1, 2 og 5. Der er altid nok mønter af hver, så man kan
aldrig køre fast. Stemmen siger regnestykket med Camillas talklip fra
bogstavspillet ("to plus to plus en er lig med"), tæller den løbende sum for
hver mønt og siger facit til sidst. Et tryk på kunden gentager stykket. Fri
leg har hverken gård eller regning.

**Grafikken.** Væg, fliser, vindue, hylde, disk og skab tegnes én gang til et
baggrundslag (`tegnLag`) og kopieres ind pr. frame. Kun det, der bevæger sig,
tegnes hver gang. Kasser, mønter og klokke får deres skygge fra små
fortegnede bunde (`kasseBund`). Vinduet vises kun med én spiller og god plads,
hylden kun når stationen er bred nok.

Hver ret laves først, og hver ret bruger fingeren på sin egen måde: pizzadejen
rulles ud ved at gnide frem og tilbage, bøffen svirpes op i luften for at blive
vendt, og pandekagedejen hældes på panden ved at holde fingeren nede. Tre trin
pr. ret. Et almindeligt tryk tæller altid som et trin, så ingen sidder fast,
hvis bevægelsen driller. Ingredienser kan trykkes eller trækkes op på retten.
Kunden spiser retten i tre bidder, og bagefter tørres tallerken og disk af med
svampen, før den næste kunde kommer. Alle fingre følges via `pointerId`, så to
børn kan rulle og tørre af samtidig. I **Fri leg** er der
ingen bestilling: kunden vil bare have en pizza, burger eller pandekager, og
barnet bestemmer selv, hvad der kommer på.

En stjerne er to-tre ingredienser og fire ting på hylden. To stjerner er flere
ingredienser og seks ting på hylden. Tre stjerner har dobbelte ingredienser, og
boblen forsvinder efter fem sekunder, så bestillingen skal huskes. Et tryk på
kunden viser og siger den igen.

Bestillingerne er en fast liste i `koekken.js` med et id hver (`p1a`, `b2c` ...),
så hver bestilling kan få sit eget stemmeklip: `lyd/bestil_<id>.mp3`, plus
`tak_1.mp3` til `tak_3.mp3`, `ups.mp3`, `dag.mp3`, `fri.mp3`, `regning.mp3`
("Hvad koster det?"), `hvor_<ting>.mp3` ("Hvor kommer osten fra?") og
`fra_<ting>.mp3` ("Ja! Osten kommer fra koen."). Filer der står i
`lyd/klip.json` bruges; resten siges af enhedens egen stemme.


## Tegn og pusl

Barnet vælger et univers (Havet, Dyrene, Maskiner, Haven) og tegner en figur
ved at følge de stiplede streger med fingeren. Hver del får farve, så snart
den er tegnet, og til sidst kommer øjne, smil og andet pynt af sig selv.
Stemmen siger, hvad det blev til. Så bliver billedet til et puslespil med
rigtige tappe, som samles ved at trække brikkerne ind på brættet. De klikker
på plads, når de slippes tæt nok på. Fire figurer pr. univers, og til sidst
hopper de alle fire på række.

En stjerne er 4 brikker og et tydeligt skyggebillede på brættet, to stjerner
er 6 brikker og et svagt, tre stjerner er 9 brikker og kun et gitter.
Tegne-tolerancen strammes også pr. stjerne (`TOLERANCE` i `game.js`). Hver
finger følges via `pointerId`, så to børn kan trække hver sin brik.

En ny figur er en liste af dele i `figurer.js` i en kasse på 100 x 100: lukkede
former får fyld, åbne streger bliver tykke farvede linjer, og dele med
`pynt` skal ikke tegnes. `npm test` tjekker, at den kan tegnes af en præcis, en
skæv og en hurtig finger.
