# SFO Spil

Reklamefri spil til SFO'ens iPads. Ingen login, ingen sporing, ingen netværkskald.
Alt kører lokalt i browseren, så der er ingen personoplysninger at indgå en
databehandleraftale om.

Spillene indtil nu:

- **Susebanen** (mappen `racer`): top-down racer med ét fingertryk, 1 eller 2 spillere på den
  samme iPad. Tre baner, tre sværhedsgrader, turbofelter.
- **Boldbanen** (mappen `klatbold`): to figurer, én bold, to mål. Løb med siderne, hop med midten,
  først til fem mål. 1 spiller mod AI eller 2 spillere.
- **Boblehavet** (mappen `bobler`): skyd boblerne med snoren, så de deler sig, til de er væk. Tolv
  baner i tre verdener med platforme og bobler der drypper ned, fire specials
  (dobbeltsnor, klæbesnor, frys, skjold), ingen liv. To spillere hjælper
  hinanden og vinder sammen.
- **Bogstavvejen** (mappen `bogstaver`): kør en bil, en raket eller en pensel langs A-Å, a-å og 0-9,
  find det rigtige bogstav blandt bobler, eller tegn hele ord bogstav for
  bogstav med billedet af tingen ved siden af. Tal vises også som æbler, der
  tælles. På 3 stjerner siger skyen bogstavet i stedet for at vise det. Navnene
  siges med iPad'ens indbyggede danske stemme, hvis der er en.
- **Himmelvejen** (mappen `flyv`): flyv med Skaden Sanne og brevene over hele
  øen i 3D. Stemmen siger, hvilket sted brevet skal til, og hvor modtageren
  sidder: oven på taget, inde i hulen, mellem de to skilte. Undervejs under
  broen og til sidst rundt om det store træ.
- **Årstidshaven** (mappen `have`): Pelle ønsker sig noget fra haven, fx tre
  tomater eller noget rødt. Find bedet med det rigtige skilt, så, vand og høst,
  og tæl med, når det lander hos Pelle. Hold kaninen og fuglen væk, og drej
  årstidsuret fra forår til vinter. I 3D som Himmelvejen.
- **Bæverdammen** (mappen `baever`): et skydepuslespil på 6 x 6 felter. Skub
  stammerne til side, så Bæveren Bodils lyse stamme kan glide ud til
  dæmningen. 36 baner på tre stjerner, 1 eller 2 spillere.
- **Egernreden** (mappen `egern`): tal som dele og helhed. **Se hurtigt**
  (subitizing): nødderne ses et øjeblik, og man vælger antallet; bagefter
  lyser delene: "Fem og to er syv." **Gemmeleg**: hvor mange gemmer sig under
  bladet? Med to spillere gemmer man for hinanden. **Ryst og hæld**: find alle
  måder at dele fem, syv eller ti på.

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
js/stemme.js            fælles stemme til spil, der taler i hele sætninger: klip fra lyd/klip.json, ellers enhedens stemme
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
  billeder/klat-*.png   klattens malede krop i de seks farver, uden ansigt

games/bobler/
  js/physics.js         bobler, snor, specials og de tolv baner — ingen DOM
  js/input.js           multi-touch med tre knapper pr. spiller
  js/game.js            menu, tegning, lyd
  billeder/*.png        de malede figurer på stranden; ét billede pr. figur

test/racer.test.js      kører 3 omgange på hver bane uden browser
test/klatbold.test.js   mål, overligger, hop, AI og en hel kamp mellem to AI'er
games/bogstaver/
  js/glyffer.js         A-Å og 0-9 som streger i skriveretning efter dansk grundskrift — ingen DOM
  js/spor.js            følger fingeren langs stregerne — ingen DOM
  js/ting.js            ting pr. bogstav til "hvad starter med" og til Ord
  billeder/*.png        tingenes malede billeder, kvadratiske (se billeder/NOTICE.md)
  ting/*.svg            de sidste syv tings tegninger, Noto Emoji (Apache 2.0, se ting/NOTICE.md)
  js/game.js            tegn- og find-legen, minispillet, menu, stemme
  lyd/klip.json         rigtige optagelser, hvis der er nogen (se lyd/NOTICE.md)
vaerktoej/lav-lyd.py    pakker optagelser som MP3 og skriver klip.json
vaerktoej/lav-lyd-elevenlabs.py  listerne over de faste spils klip (og ElevenLabs-udgaven, som lavede Camillas klip)
vaerktoej/lav-lyd-gemini.py      laver alle spillenes klip med Gemini (Kore); Himmelvejen, Årstidshaven og Bæverdammen ét pr. sætning
vaerktoej/lav-baever-baner.js    finder Bæverdammens baner og sorterer dem efter antal træk
vaerktoej/optag.html    optagerside: siger man de 146 ord ind, får man WAV-filer med rigtige navne

games/restaurant/
  js/koekken.js         retter, ingredienser, de 36 bestillinger og reglerne — ingen DOM
  js/game.js            kunder, tallerken, hylde, klokke, lyd og stemme
  lyd/klip.json         stemmeklip til bestillingerne, hvis der er nogen
  billeder/*.png        mad og gæster, malet (se billeder/NOTICE.md) — altid kvadratiske
assets/noto/*.svg       klokke, hjerte, ko, mælk, bi og Stjerneurets kort, Noto Emoji
                        (Apache 2.0, se assets/noto/NOTICE.md)

test/bobler.test.js     en robot spiller alle tolv baner igennem
test/bogstaver.test.js  alle 68 tegn kan tegnes af en finger langs stregen, ting, ord og regnestykker
games/tegn/
  js/figurer.js         16 figurer i fire universer som streger og farver — ingen DOM
  js/pusle.js           puslespillets brikker, tappe og klik-på-plads — ingen DOM
  js/game.js            tegning med fingeren, puslespil, menu, lyd (bruger bogstavernes spor.js)
test/tegn.test.js       alle figurer kan tegnes, og puslespillet kan samles på alle tre stjerner
games/rim/
  js/rim.js             ordene, rimgrupperne, stavelserne og reglerne — ingen DOM
  js/game.js            hulen, rim-legen, klap-legen, menu, stemme
  ting/*.svg            otte ekstra rimord, Noto Emoji (Apache 2.0, se ting/NOTICE.md)
  billeder/*.png        bjørn, kanin og salat, malede og kvadratiske (se billeder/NOTICE.md)
  lyd/*.mp3             de ekstra ord og hulens fire sætninger; resten er Bogstavvejens klip
test/rim.test.js        en robot spiller rim og klapper alle ord på alle tre stjerner
games/find/
  js/find.js            ordene, kategorierne, lookalikes, stederne med pladser og skjul, reglerne — ingen DOM
  js/game.js            engen og skoven, tingene, skyerne, menu, stemme
  billeder/*.png        byens malede stykker: tre huse på bakken, boden, brønden og bænken
  lyd/*.mp3             "Kan du finde den?" og kategorierne; ordene lånes fra Bogstavvejen
test/find.test.js       en robot spiller alle steder på alle tre stjerner og tjekker, at alt kan findes
games/flyv/
  js/oe.js              øen: landskab, steder, flod, bro, træet, pynten, dyrene og brevene — ingen DOM
  js/flyvning.js        Sannes flyvning, brevene, broen og rundt om træet — ingen DOM
  js/game.js            3D-tegningen (WebGL 1, ingen biblioteker), kortet, ordene, menu, stemme
  lyd/*.mp3             ét klip pr. sætning (Gemini, Kore); lyd/klip.json siger, hvilken fil der er hvilken sætning
test/flyv.test.js       en robot flyver alle breve ud på alle tre stjerner, med tryk og ved at flyve selv
games/have/
  js/haven.js           bedene, Pelles ønsker, ordene, vejret, årstiderne, kaninen og fuglen — ingen DOM
  js/game.js            3D-tegningen (samme tegner som Himmelvejen), boblen, redskaberne, årstidsuret, menu, stemme
  lyd/*.mp3             ét klip pr. sætning (Gemini, Kore); lyd/klip.json siger, hvilken fil der er hvilken sætning
test/have.test.js       en robot opfylder Pelles ønsker på alle tre stjerner og med to spillere
games/baever/
  js/daemning.js        pladsen, stammerne, banerne, løseren, hjælpen og det, der siges — ingen DOM
  js/game.js            pladsen og vandet tegnet i kode, træk med fingrene, Bodil, dæmningen, menu, stemme
  billeder/bodil.png    Bæveren Bodil, malet med Canva (se billeder/NOTICE.md)
  lyd/*.mp3             ét klip pr. sætning (Gemini, Kore); lyd/klip.json siger, hvilken fil der er hvilken sætning
games/egern/
  js/egern.js           mønstrene og delene, gemmelegen, kastet i Ryst og hæld, runderne og det, der siges — ingen DOM
  js/game.js            stubben, bladene, reden, tavlen, talrækken, Egon og kurven, menu, stemme
  lyd/*.mp3             ét klip pr. sætning (Gemini, Kore); lyd/klip.json siger, hvilken fil der er hvilken sætning
test/egern.test.js      en robot spiller alle tre lege på alle stjerner; talrækken, mønstrene, delene og alle måder i Ryst og hæld
test/baever.test.js     løser alle baner, lader en robot rode rundt og følge hjælpen ud, tjekker stemme og filer
bog/
  js/bog.js             de ti opslag: tekst, rim, hvem Pelle møder, hvor nøglen og skaden er — ingen DOM
  js/scener.js          billedet til hvert opslag, tegnet i kode med spillenes malede figurer
  js/game.js            forsiden, bladring, oplæsning og find-nøglen; print kun til PDF-værktøjet
  billeder/skade.png    Skaden Sanne, bogens eget billede (se billeder/NOTICE.md)
  billeder/opslag/*.jpg de ti malede opslag og forsiden fra Gemini, 600 x 780 (se NOTICE.md dér)
  udkast/*.png          skærmklip af Gemini-udkastet, kun til at sammenligne med; ikke i appen
  lyd/*.mp3             oplæsningen, ét klip pr. opslag (se lyd/NOTICE.md)
test/bog.test.js        tegner alle ti opslag uden browser og tjekker tekst, navne, nøgle og filer
test/restaurant.test.js en robot henter på gården, serverer og betaler en hel dag på alle tre stjerner
```

`physics.js` rører hverken DOM eller canvas. Det er derfor testen kan køre i
Node uden en browser, og det er den fil man skal ind i når noget skal føles
anderledes.

## Skrue på hvordan det føles

Alt ligger i `INDSTIL` øverst i `games/racer/js/physics.js`.

Banens udseende tegnes én gang i `games/racer/js/track.js` — malet eng, grussti,
midterstribe og turbopile. Vejen tegnes i præcis `vejbredde`, den samme bredde
som kollisionsmasken bruger, så det man ser er det man kan køre på. Bilerne er
tegnet i kode i `tegnKaross` i `game.js`, tre former i seks farver.

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

## Skrue på Boldbanen

`INDSTIL` øverst i `games/klatbold/js/physics.js`: tyngde, hoppehøjde, boldens
hop, målhøjde og hvor mange mål der skal til. `SVAERHED` sætter AI'ens fart,
reaktionstid og hoppelyst for 1, 2 og 3 stjerner. Kør `npm test` bagefter.

Klatterne er tegnet i kode i `games/klatbold/js/game.js`. `FARVER` er de seks
farver med en lys top, en grundfarve og en dyb bund, og `tegnKlatForm` tegner
kroppen og de fem ansigter: glad, sej og sød vælger barnet selv, og jubel og
sur kommer af sig selv, når der bliver scoret. Kroppen er en malet
akvarelklat fra `billeder/`, én pr. farve, med ører og uden ansigt; ét billede
er malet, de fem andre er farvet om i kode, og koden tegner ansigtet ovenpå,
så øjnene stadig følger bolden. Mangler billedet, tegnes klatten i kode som
før. Den malede krop er lige så bred som fysikkens halvcirkel med radius
`klatRadius` og lidt højere, som ørerne altid har været — ændrer man
tegningen, må den ikke blive bredere eller smallere end det, bolden rammer.

## Skrue på Boblehavet

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

## Skrue på Bogstavvejen

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
`games/bogstaver/js/ting.js` med ét ord, et malet billede i `billeder/` (eller
en Noto-SVG i `ting/` for de sidste syv) og en tegning i kode som reserve pr.
bogstav. Se `billeder/NOTICE.md` for hvordan man tilføjer en ting.
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

Biler, figurer og raketten er sprites fra Kenney (CC0), se
`assets/kenney/NOTICE.md`. Boldbanens klatter er malede, se
`games/klatbold/billeder/`, og Boblehavets figurer skiftes til malede én ad
gangen: dem, der står i `MALEDE` i `games/bobler/js/game.js`, tegnes fra ét
malet billede med gang, svimmelhed og jubel lavet i kode, resten er stadig
Kenney. Hvert spil har stadig sin tegning i kode som reserve,
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

## Stemmen: Gemini (Kore)

Hele appen taler med den samme stemme, Kore fra Google Gemini
(`gemini-3.8-flash-tts`). `vaerktoej/lav-lyd-gemini.py --spil <mappe>` laver
klippene én gang på en computer; spillene kalder aldrig Gemini, de spiller
bare MP3-filerne. Nøglen fra aistudio.google.com ligger i miljøvariablen
`GEMINI_API_KEY` (eller som API-credential i Claude Code) og aldrig i repoet.
Kræver `pip install lameenc`.

- `--spil bogstaver|rim|find|restaurant|klokken|maskinen|bog` laver klippene om
  i de samme filer, som spillene allerede kender. Listen over, hvad hver fil
  siger, står i `vaerktoej/lav-lyd-elevenlabs.py` (som lavede Camillas klip
  før september 2026). Bogstaver og tal siges rene ("A.", "Tre."), ordene i
  rammen "Her har du ordet kat.".
- `--spil have|flyv|baever|egern` laver ét klip pr. sætning ud fra spillets egen kode og
  skriver `lyd/klip.json` og `sw.js`.

`--proev` viser, hvad der ville blive lavet, og `--kun <tekst>` laver kun det,
der passer. Uden betaling på nøglen giver Gemini kun cirka 10 klip om dagen;
med betaling cirka 10 i minuttet, og hele appen (cirka 25 minutters tale)
koster få kroner.

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

Forsidens kort linker til mapper (`games/racer/`), men `FILER` i `sw.js`
indeholder filerne (`games/racer/index.html`). Derfor prøver `fetch`-handleren
`index.html` i mappen, før den giver op. Uden det kan forsiden åbnes uden net,
men ingen af spillene. Skal offline testes, skal serveren lukkes helt —
`setOffline` i en browser-automat blokerer ikke localhost og giver et falsk
grønt svar.

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

## Skovkøkkenet (mappen `restaurant`)

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
honning, og resten vokser på planter, buske og træer. Bøffen kommer også
fra koen (uden malkning), og bacon kommer fra grisen. Der var før en
slagterbod, men børnene trykkede på koen, når der blev spurgt om bøffen, og
de havde ret. En forkert kilde vipper og viser i en tankeboble, hvad den giver. Kilderne står i
`KILDER` i `koekken.js`, og tegningerne er i kode i `tegnKilde` i `game.js`.

**Regningen.** Når kunden har spist, kommer regningen i boblen: hver
ingrediens med sin pris i mønter, "=" og et felt til svaret. Barnet lægger
mønter i kassen på disken, til det passer. En mønt for meget hopper tilbage.
Priserne trækkes tilfældigt pr. kunde (`PRIS_MAKS`), så regnestykket
varierer. Regningen viser kun mønter, ingen billeder af maden: én 1-mønt pr.
krone, samlet i en gruppe pr. ting med plus imellem. Billederne af maden viser
ofte flere stykker (blåbær, oliven) og ville snyde, når man tæller. Én stjerne:
to ting til 1 eller 2, summen (2-4) vises som tomme mønter, og pungen har kun
1-mønter, så det er at tælle. To stjerner: tre ting til 1, 2 eller 3, og pungen
har 1- og 2-mønter. Tre stjerner: fire ting til 1, 2 eller 3, og pungen har 1, 2
og 5. Summen er højst 9 (`SUM_MAKS`), så alle tal kan siges med de indtalte
talklip, og to kunder i række ved samme station får aldrig det samme
regnestykke. Der er altid nok mønter af
hver, så man kan aldrig køre fast. Stemmen siger regnestykket med de indtalte talklip fra
bogstavspillet ("to plus to plus en er lig med"), tæller den løbende sum for
hver mønt og siger facit til sidst. Et tryk på kunden gentager stykket. Fri
leg har hverken gård eller regning.

**Grafikken.** Væg, fliser, vindue, hylde, disk og skab tegnes én gang til et
baggrundslag (`tegnLag`) og kopieres ind pr. frame. Kun det, der bevæger sig,
tegnes hver gang. Kasser, mønter og klokke får deres skygge fra små
fortegnede bunde (`kasseBund`). Vinduet vises kun med én spiller og god plads,
hylden kun når stationen er bred nok.

Maden og gæsterne er malede PNG'er i `billeder/`, én pr. ingrediens, ret og
gæst. `sti()` i `game.js` vælger mappen ud fra navnet, så resten af koden bare
siger `billede('ost')`. Filerne skal være kvadratiske: `tegnBillede` tegner
dem som `drawImage(img, -str/2, -str/2, str, str)`, så et aflangt billede
bliver trukket skævt. Klokken, hjertet, koen, mælken og bien er stadig Noto
Emoji i `assets/noto/`.

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


## Stjerneuret (mappen `klokken`)

Rummusen lærer, hvordan uret virker. Spillet ligger i `games/klokken/` og har
tre lege, som vælges med billedfliser øverst i menuen. Tider, låsning af
viserne, opgaver og dagens gøremål ligger i `js/ur.js`, som testes i Node
(`test/klokken.test.js`). `js/game.js` er kun skærm og lyd.

**Uret.** Begge visere er der altid: klokken 3 er den røde timeviser på 3 og
den blå minutviser på 12. De hænger sammen som på et rigtigt ur, så trækker
man den blå en omgang, går den røde en time frem, og ved halv fire står den
røde midt mellem 3 og 4. Viserne trækkes og låser på nærmeste tal med et tik.
Én stjerne: hele timer, kun den røde kan trækkes. To stjerner: også halve
timer ("halv fire" er 3:30). Tre stjerner: musen siger kun tiden uden at vise
det lille ur. Kvarter er med vilje ikke med. Tallene står på skiven, og der er
ingen digital tid.

**Planeturet (`stil`).** To slags opgaver skiftevis, så både det at stille
uret og det at aflæse det bliver øvet. `stil`: musen siger "Stil uret på
klokken tre", og barnet trækker viserne. `laes`: uret står allerede, musen
spørger "Hvad er klokken?", og barnet trykker på det tal, der siges —
"klokken tre" er 3, "halv fire" er 4 (`talFor` i `ur.js`). Én stjerne har kun
`stil`; to og tre har begge (`INDSTIL.laes`). På hver planet bor et rumvæsen,
der sover, til uret er rigtigt, og så vågner og hopper. Står det forkert, sker
der ingenting; efter to forsøg blinker det rigtige tal, musen peger, og hun
siger "Næsten!". Seks planeter til én spiller, otte til to.

**Musens dag (`dag`).** Uret viser en tid, en sol eller måne viser, om det er
dag eller nat, og barnet vælger kortet med det, musen gør nu: 7 tandbørste,
8 skole, 12 madpakke, 14 bold, 18 aftensmad, 19 bad, 20 seng (`DAGEN` i
`ur.js`). Én stjerne: tre kort langt fra hinanden på dagen. To stjerner: fire
tilfældige. Tre stjerner: de kort, der ligger tættest på uret, så 7 om
morgenen og 7 om aftenen ligger side om side.

**Jorden drejer (`sol`).** For én. Musen beder om et af dagens gøremål —
"Drej jorden, til musen børster tænder" — og barnet drejer jorden med
fingeren, til uret står der. Seks opgaver, ligesom de to andre lege, og
tælleren øverst er den samme. Solen står stille. Musens hus på kanten går fra
dag til skygge til nat, uret nederst følger med, og hele himlen skifter farve
med tidspunktet. Uden om jorden ligger dagens ring: døgnet som en cirkel med
et mærke pr. time og gøremålene, hvor de hører til, så det kan ses, at en dag
går rundt ligesom uret. Det gøremål, klokken er ved, lyser gult; efter to
forsøg blinker det, der skal findes, og musen peger.

Jorden drejer frit, men uret kan kun sige hele og halve timer. Derfor lander
jorden på et tidspunkt, uret kan sige, når fingeren slipper: på gøremålet,
hvis et er inden for tyve minutter, ellers på nærmeste halve time
(`landDoegn` i `ur.js`). Uden den regel kunne uret stå på 7:17, mens musen
sagde "halv otte". Et tryk på uret siger tiden: "Klokken syv om morgenen".
En hel omgang giver en gul stjerne: én dag.

**Stemme.** Klippene ligger i `games/klokken/lyd/` og laves med
`vaerktoej/lav-lyd-gemini.py --spil klokken`: `klokken_1.mp3` til
`klokken_12.mp3`, `halv_1.mp3` til `halv_12.mp3` (tallet er det, der siges),
`stil_uret.mp3`, `hvad_goer.mp3`, `om_morgen/dag/aften/nat.mp3`,
`goer_<kort>.mp3`, `drej_<kort>.mp3`, `flot_1-3.mp3`, `naesten.mp3` og
`rejse.mp3`. Sætningerne
sættes sammen af klip: "Stil uret på" + "klokken tre".

**Grafikken.** Stjernehimlen er tre lag, der glider forskelligt, så rummet får
dybde, når raketten flyver; en gang imellem går der et stjerneskud over.
Urskiver og planeter tegnes én gang til små billeder og kopieres ind pr.
frame — kun viserne og det, der bevæger sig, tegnes hver gang. De otte
planeter har hver sin farve og sit særpræg (ring, striber, kratere, is, måne,
plet) og deres egen lille melodi. Musen er en hel astronaut med dragt, arme
og glashjelm; hun peger på uret, når hun hjælper. Musen, jorden, solen, månen
og kortene er Noto Emoji (`assets/noto/`), raketten er fra Kenney. Alt andet
tegnes i kode.

## Nøddeskoven (mappen `maskinen`)

Byg en kædereaktion, så kuglen når ned til klokken. Spillet ligger i
`games/maskinen/` og er inspireret af Pettson og Findus' opfindelser,
Inventioneers og The Incredible Machine. Fysikken, delene og banerne ligger i
`js/fysik.js`, som testes i Node (`test/maskinen.test.js`). `js/game.js` er kun
skærm og lyd.

**Sådan spilles det.** Nederst er en hylde med de dele, banen har med. I banen
er der tegnet **faste pladser** — stiplede ringe — som i en opfinderbog, hvor
hullerne er tegnet på forhånd. Barnet trækker en del hen til en plads, hvor den
klikker fast og lægger sig, som pladsen vil have det; slipper man den uden for
en plads, ryger den tilbage på hylden. Gåden er, hvilken del der skal hvor: der
er altid én plads mere end der er dele. Så trykker man på den store grønne
knap, maskinen kører, og man ser, hvad der sker. Virkede det ikke, trykker man
på pilen, og delene bliver liggende, så man kan bytte om på én ting ad gangen.
Der er ingen tid, ingen forsøg der tælles, og ingen måde at tabe på. To børn
kan trække hver sin del samtidig. I **fri leg** er der ingen pladser: dér
lægger man delene, hvor man vil, og et tryk drejer dem.

**Delene.** `rampe` (fem skrå stillinger), `trampolin` (kaster kuglen op),
`klods` (spærrer), `baand` (trækker kuglen med, et tryk vender retningen),
`blaeser` (puster i fire retninger), `vippe` (drejer, når kuglen lander i den
ene ende), `kanon` (fanger kuglen og skyder den af sted i otte retninger, én
gang pr. kørsel) og `tragt` (fanger kuglen oppefra og sender den ud af tuden: lige
ned, til højre eller til venstre — et tryk drejer tuden).
Alt står i `DELE` i `fysik.js` med hop (elasticitet) og gnid (friktion).

**Fysikken.** Verden har faste mål (1000 × 620), så simulationen er den samme
på en iPad, en iPhone og i Node — skærmen skalerer kun billedet. Der køres med
et fast tidsskridt, så samme opstilling altid giver samme forløb. Alt er
linjestykker: kuglen skubbes ud af fladen og kaster sig tilbage efter fladens
hop, og mister fart langs den efter dens gnid. Gnidningen lægges kun på én gang
pr. skridt — gør man det i hver kollisionsomgang, stopper kuglen med det samme
og kan slet ikke trille.

**Universet.** Spillet foregår i Nøddeskoven, hvor pindsvinet Pelle er
opfinder. Han står altid til venstre i banen; til højre ser et af skovens dyr
på — kaninen, musen, bjørnen, ræven, frøen, uglen eller snemanden — et nyt for
hver bane. Der er fem kapitler, som vælges øverst i menuen med et billede af
stedet: **Engen** (Pelles have, de første tolv baner), **Skoven** (skrå grene
at trille på), **Søen** (åkandeblade der kaster kuglen op, og tragten der
fanger den), **Vinter** (is der er glat, sne der bremser, og kanonen) og
**Natten** (alt på én gang, i mørket, med en lygte som kugle). Kuglen skifter
med stedet: æble, kastanje, snebold, lygte. Intet er låst; alle kapitler kan
vælges fra start. `KAPITLER` og `banerI()` i `fysik.js`, `TEMA` i `game.js`.

**Stoffet i murene.** Hver mur har et `stof`: `trae` (det almindelige), `is`
(glat, kuglen glider langt), `sne` (bremser), `aakande` (blødt, kaster kuglen
op) og `sten`. Tallene står i `STOF` i `fysik.js`. Skrå grene er streger
`{x1, y1, x2, y2}` og tegnes som drejede planker.

**Banerne.** 36 baner plus fri leg: tolv på engen og seks i hvert af de fire
andre kapitler. Hver bane har `start`, `maal`, `mur`, `pladser` (de faste
steder, delene kan ligge, med den vinkel delen får dér), `hylde` (hvilke dele
og hvor mange) og `loesning` — én måde at klare den på. Pladserne er
løsningens steder plus én, der ikke er med i løsningen; de ligger i
`fysik.js`, og testen tjekker, at løsningen passer på dem. Testen bygger løsningen
og lader fysikken køre den, præcis som racertesten kører banerne igennem:
ændrer man en del eller en bane, så den bliver uløselig, siger testen fra.
Løsningerne er lavet i hånden ud fra én oplagt idé pr. bane ("læg rampen
som bro over hullet", "sæt kanonen under kuglen") og derefter finjusteret af
et lille program, der leder i nærheden af den tænkte plads efter den mest
tolerante opstilling. Testen kræver, at hver løsning stadig virker, når
delene flyttes op til 40 px i alle retninger (mindst hver femte forskydning
skal lykkes) — ellers er banen en nål i en høstak, som ingen kan finde med
fingeren. Den tjekker også, at ingen bane klarer sig selv uden dele. En kugle,
der lander på en flad hylde, bliver liggende: derfor hælder hylderne, hvor
kuglen skal trille videre af sig selv, og ellers skal det første redskab stå i
faldlinjen under kuglen.

**Grafikken.** Figurerne — Pelle, dyrene, snemanden, kuglerne, svampen,
træet, granen, sivene og klokken, 17 i alt — er malede billeder i akvarel-
billedbogsstil, lavet med Canvas AI-billedgenerator og skåret fri i kode. De
ligger i `billeder/` med en `NOTICE.md`, der siger hvordan og med hvilken ret.
Prompterne beskriver stilen med ord, aldrig med navnet på en kunstner, en bog
eller et spil.

Alt det, der skal kunne skaleres og drejes frit — planker, ramper, trampolin,
bånd, blæser, vippe, knapper og prikker — er SVG skrevet i `js/figurer.js`.
Hver figur er en funktion, der får bredde og højde ind og giver et lille SVG-
dokument tilbage; det males én gang over på et skjult lærred i dobbelt
størrelse og tegnes derefter med et `drawImage`, så spilløkken er lige så let
som før. Træet i delene har årer, korn og en kant med lidt uro i (SVG-filtre),
så det hører sammen med de malede billeder. Mangler et billede, tegnes en SVG-
udgave af figuren i stedet, så spillet virker alligevel.

Paletten står ét sted, i `PALET` i `figurer.js`, og er taget fra billederne:
træets brune, kronens grønne, æblets røde. Banen, hylden, menukortet,
forsidens billede og de fælles menuikoner henter alle deres farver derfra.
Testen tjekker, at alle malede billeder findes og er i `FILER`, at de ikke
løber løbsk i størrelse, at der ligger en NOTICE, og at spillet ikke henter
billeder fra andre mapper.

**Stemme.** Fire klip i `games/maskinen/lyd/`: `opgave.mp3`, `igen.mp3` og
`flot_1-2.mp3`. Resten af lyden er toner fra oscillatorer: et klik når kuglen
rammer noget, og to toner der klinger ud, når klokken bliver ramt.

## Tegnestuen (mappen `tegn`)

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

## Rimhulen (mappen `rim`)

Rim og stavelser: det, et barn hører i sproget, før det kan læse. Spillet
foregår i en hule, hvor ekkoet svarer, når stemmen taler. Billeder og ord er
Bogstavvejens ting, hentet fra `../bogstaver/`, så intet er malet eller
indtalt to gange. Ordklippene siger "Her har du ordet kat" med vilje: et
enkelt ord alene udtales forkert af stemmen, så alle sætninger er bygget, så
den ramme passer. Elleve ekstra ord, der rimer på dem (stol, mur, mål, bog,
pil, vand, mund, sky, bjørn, kanin, salat), ligger i spillets egne
mapper.

**Rim.** Stemmen siger "Her har du ordet kat. Hvad rimer på det?", og barnet
finder det kort, der rimer, og svarer med det grønne flueben under kortet,
som i Bogstavvejens minispil. Et tryk på kortet siger kortets ord, og et tryk
på skyen gentager spørgsmålet. Rigtigt svar: kortet bliver gult, og stemmen
siger "Ja, det rimer!". Forkert: kortet vipper, ordet siges, spørgsmålet
stilles igen. Ingen straf. Én stjerne giver to kort, to stjerner tre, tre
stjerner fire, og ved tre stjerner har de forkerte kort samme antal
stavelser som det rigtige, så man ikke kan høre sig frem på længden.
Rimgrupperne står i `RIM` i `rim.js` og er skrevet i hånden, fordi dansk
ikke kan rimes i kode. Med to spillere har hvert barn sin egen række kort i
sin egen farve.

**Klap.** Stemmen siger "Her har du ordet elefant. Klap det!", og barnet
klapper stavelserne på trommen. En prik pr. stavelse fyldes. Når prikkerne er
fulde, og der har været ro et øjeblik, pulserer prikkerne, og stemmen siger
"Flot klappet!". Ordene veksler mellem en, to og tre stavelser, også ved én
stjerne, så der er noget at høre efter. Klapper man én gang for meget, vipper prikkerne, og man starter
forfra. Stavelserne står i `STAVELSER` i `rim.js`. Én stjerne giver ord med
højst to stavelser, to stjerner tre, tre stjerner alle. Med to spillere er
der to trommer, en rød og en blå, og ordet er fælles.

En omgang er otte spørgsmål, talt med cirkler. Testen lader en robot spille
begge lege på alle tre stjerner og tjekker, at hvert spørgsmål har præcis ét
rigtigt kort, at ingen forkerte kort rimer, at alle ord har billede, stemme
og stavelser, og at n klap er fuld og n+1 starter forfra.

## Vrimleskoven (mappen `find`)

Find det, stemmen siger, i et stort billede: "Her har du ordet kat. Kan du
finde den?". Det er det klassiske finde-spil, og det bedste til to børn ved én
iPad, fordi de leder i det samme billede og hjælper hinanden.

**Billedet.** Stedet (engen, skoven, byen) tegnes i kode: himmel, skovbryn,
eng, sti, sø, huse, gade af brosten, og fyld og liv, der ikke er noget at
finde — blomster, græs, sten, fugle i himlen, røg fra skorstenene og tøj på
snoren. Boden, brønden, bænken og de tre huse på bakken bag byen er malede
billeder i `billeder/`; husene forrest i byen er tegnet i kode, fordi tingene
skal kunne sidde i vinduerne, og malede huse har alt for små vinduer til en
finger. Mangler et billede, tegnes stykket i kode. Tingene er Bogstavvejens malede ting plus kaninen og bjørnen, og de
lægges som i en vrimlebog i `laegTing` i `find.js` tre slags steder:

- **På en plads.** Hvert sted har faste pladser i `STEDER[...].pladser`: i
  husenes vinduer og døre (klippet, så kun det, der er i åbningen, ses), på
  boden, bænken og træstubbene, i båden og trillebøren, oppe i et træ, bag
  hegnet og oppe af brønden, og i hullet i den væltede stamme. Hver omgang
  bruger cirka en tredjedel af pladserne, tilfældigt valgt. Byens huse står i
  `huse`, og `husPladser` regner vinduer og dør om til pladser, så reglerne og
  skærmen er enige om, hvor de er.
- **Halvt bag et skjul.** Cirka hver fjerde ting ligger på kanten af et malet
  træ eller en gran, aldrig helt gemt. `daek` beskriver den ellipse, billedet
  dækker, og `skjulAfstand` måler, hvor langt en ting er fra kanten.
- **Løst** i rækker fra bagerst til forrest, små bagest og større forrest,
  aldrig oven i hinanden og aldrig oven i det, der er optaget (sø, bod, bænk,
  pindsvinet i hjørnet).

Alt på jorden tegnes bagfra og frem, så det nederste er nærmest; en ting bag
et hegn tegnes lige før hegnet, en ting oppe i et træ lige efter træet. Ingen
to omgange er ens. Én stjerne giver 18 store ting, to 26 mindre, tre 34 små.

**Legen.** Skyen øverst viser det, der skal findes, og et tryk på den gentager
stemmen. Et tryk på den rigtige ting giver en ring i spillerens farve og "Du
fandt den!". Et tryk på en forkert ting siger tingens ord, "Her har du ordet
hund", så et forkert tryk også lærer noget. Ingen straf. Har barnet ledt
længe, lyser et blødt skær omkring tingen. En omgang er seks spørgsmål, talt
med cirkler under skyen. Med to spillere er der to skyer, rød og blå, med hver
sit ord i det samme billede; finder man den andens ting, siges ordet bare.

**Tre stjerner** lægger desuden en lookalike tæt ved hver ting, der spørges
om: tigeren ved katten, lastbilen ved bilen, ræven ved hunden, så man skal se
ordentligt efter. Grupperne står i `LIGNER` i `find.js`; et ord står kun i én
gruppe, og hver gruppe bruges højst til ét spørgsmål pr. omgang. Ligger den
ting, der spørges om, i et vindue, får makkeren nabovinduet.

**Tre stjerner** skifter også to af spørgsmålene til kategorier: "Find alle de
røde", "Find alle, der kan flyve", "Find alle dyrene", "Find alt det, man kan
spise" og "Find alt det, man kan køre i". Skyen viser en farveplet eller et
lille tegn (vinge, pote, gaffel, hjul) og en prik pr. ting, der skal findes.
Kategorierne står i `KATEGORIER` i `find.js`. Farverne er dem, tingene
faktisk er malet i, målt på billederne, og `nyOmgang` sørger for, at hver
kategori har to til fire medlemmer i billedet, og at ingen af enkeltordene i
samme omgang også er medlem af en kategori.

Testen lader en robot spille alle steder på alle tre stjerner og tjekker, at
løse ting ligger inden for stedets zoner og uden for det optagne, at ting på
en plads ligger præcis dér med pladsens klip og skjul, at ingen ligger oven i
hinanden eller helt bag et skjul, at hvert spørgsmål kan besvares med det, der
er i billedet, at der ved tre stjerner ligger en lookalike tæt ved hvert
enkeltord, at kategorierne har to til fire medlemmer, og at alle ord har
billede og stemme.

## Himmelvejen (mappen `flyv`)

Skaden Sanne flyver breve ud på Nøddeskovens ø, og øen er den samme som i
bogen: Nøddeskoven i midten og de ni andre steder i en ring omkring den, med
spillenes egne figurer. Spillet øver to ting: **stedsans** (hvor på øen ligger
Vrimleskoven?) og **ord for placering** (oven på, inde i, mellem, under, rundt
om).

**Brevene.** Stemmen siger, hvem brevet er til, og hvor de sidder: "Det skal
til kaninen i Vrimleskoven. Kaninen sidder oven på taget." På stedet sidder
tre ens dyr, og kun ét sidder dér, hvor stemmen siger. Barnet trykker på det
dyr, det mener, og Sanne flyver selv derhen, for det er valget, der skal
læres, ikke at ramme med fuglen. Et forkert dyr siger selv, hvor det sidder:
"Nej, jeg sidder mellem de to huse. Brevet skal til kaninen oven på taget."
Ingen straf. Fire breve: kaninen oven på taget, bjørnen inde i hulen, uglen
mellem de to skilte og til sidst rundt om det store træ hjemme hos Pelle, hvor
et tryk på træet også sender Sanne rundt. Undervejs spørger stemmen, om hun
kan flyve under broen over floden. De fem ord står som billeder foroven og
bliver gyldne, når de er klaret. Brevene og dyrenes pladser står i `oe.js`.

**Stjernerne** er hjælpen til at finde vej: én stjerne giver en pil og et
kort, hvor målet lyser, og Sanne dykker selv under broen; to stjerner kun
kortet; tre stjerner ingen hjælp. Pilen peger aldrig på det rigtige dyr.

**Styring.** Man peger med fingeren derhen, hvor Sanne skal flyve: til siden
drejer hun, op og ned stiger og dykker hun. Slipper man, flyver hun selv
vandret over landskabet og daler ned mod dyrene, når hun leder. Ude over havet
drejer hun selv hjem; der er ingen mur og ingen måde at styrte på.

**3D.** En lille WebGL 1-tegner i `game.js` uden biblioteker, så det virker på
gamle iPads: landskabet er én form i appens palet med akvarelvask og
papirkorn, broen, målene og tårnet er kasser, og Sanne er bygget af simple
former med vinger, der slår. Figurerne er de malede billeder fra de andre spil,
sat op som udklip, der vender mod kameraet. Der er ingen nye billedfiler.
Bliver det for tungt, går tegningen selv ned i opløsning.

**Stemmen** er klip med Gemini (stemmen Kore), ét pr. sætning i `lyd/`, lavet
med `vaerktoej/lav-lyd-gemini.py --spil flyv` ud fra `Oe.saetninger()`. Et
forkert dyrs svar er to klip i træk: "Nej, jeg sidder mellem de to huse." og
brevets "Brevet skal til kaninen oven på taget.".

Testen tjekker øen, floden og pladsen under broen, at hvert sted har tre ens
dyr, hvor præcis ét sidder dér, hvor brevet siger, at den, der sidder mellem,
faktisk sidder mellem, set forfra, og lader en robot flyve alle breve ud på
alle tre stjerner, både ved at trykke (også på et forkert dyr først) og ved
selv at flyve, under broen og rundt om træet.

## Årstidshaven (mappen `have`)

Pelles egen have: otte bede i to rækker, et hegn, æbletræet, huset og kurven.
Hvert bed har et skilt med det, der gror dér: gulerod, tomat, jordbær,
salat, agurk og peberfrugt, og guleroden og salaten har to bede hver.

**Pelles ønsker driver spillet.** Stemmen siger fx "Pelle ønsker sig tre
tomater. Kan I finde bedet med skiltet?", og skiltet ved det rigtige bed
vipper. Barnet sår med frøposen, vander tre gange (frø, spire, plante,
grøntsag, og stemmen siger, hvad planten er blevet til) og høster med kurven.
Et bed giver én til tre, og stemmen siger, hvor mange der blev høstet. Det,
Pelle ønsker sig, flyver hen til ham, og stemmen tæller med: "en, to, tre".
Resten kommer i kurven. Hvert tredje ønske er en kategori: noget rødt, noget
grønt, noget, der gror nede i jorden, og så spørger stemmen "Hvad er rødt i
haven?". Guleroden gror nede i jorden, så kun toppen stikker op.

**Stjernerne** er, hvor meget der skal tælles: én stjerne 1-3 med billeder i
boblen, der får et flueben, når de er kommet; to stjerner 2-5 med prikker, der
bliver fyldt; tre stjerner to ting på én gang, fx to gulerødder og én agurk.
Et tryk på boblen siger ønsket igen.

**Dyrene** vil også have noget. Kaninen hopper hen og gnasker i et bed med
blade, og fuglen kommer, hvis frø venter for længe på vand. Et tryk, så går
de. Når de når at spise, går planten kun ét trin tilbage. Ingen straf.

**Årstidsuret** foroven skifter årstid ved et tryk. Forår: regnbyger vander
bedene. Sommer: en plante, der mangler vand, hænger, og en dråbe hopper over
den. Efterår: planterne giver nye frø til frøposen, æblerne kan plukkes med
kurven, og egernet hopper i træet. Vinter: sneen dækker det, der ikke blev
høstet, og Pelle sover (zzz tegnet med streger i boblen).

**To spillere** har hver sin række redskaber i hvert sit hjørne og deler
haven; Pelle står da i midten. Et tryk i venstre halvdel bruger den venstre
spillers redskab.

**3D** med samme WebGL 1-tegner som Himmelvejen. Alle figurer er lånt fra de
andre spil (Nøddeskoven, Bogstavvejen, Skovkøkkenet og forsiden); der er
ingen nye billedfiler. **Stemmen** er klip med Gemini (stemmen Kore), ét pr.
sætning, lavet med `vaerktoej/lav-lyd-gemini.py --spil have` ud fra
`Haven.saetninger()`. Ønsker og tællinger er hele sætninger for hver
mulighed ("Pelle ønsker sig tre tomater.", "Og så én agurk.", "To!"), og
`js/stemme.js` sætter dem sammen.

Testen lader en robot opfylde ni ønsker på hver stjerne og fire med to
spillere, og tjekker, at stemmen tæller med, at ønskerne har den rette
størrelse, at planten vokser ét trin pr. vand, at kaninen og fuglen kommer og
kan jages væk, sommerens tørke, regnen, efterårets frø, æblerne og vinteren,
og at ordene er rigtige (én tomat, ét jordbær, tre gulerødder).

## Bæverdammen (mappen `baever`)

Et skydepuslespil i samme ånd som de kendte med biler, men med vores egne baner
og vores egen verden: Bæveren Bodil bygger en dæmning og skal bruge den lyse
birkestamme med bladet. Den ligger på en plads på 6 x 6 felter set oppefra,
spærret af brune stammer på to og tre felter, og skal ud gennem åbningen i
højre side, hvor Bodil sidder i vandet.

**Stammerne** trækkes med fingeren. En stamme kan kun glide den vej, den
ligger, og kun så langt, der er plads; trækker man på tværs, rokker den, og
stemmen siger én gang imellem "Stammen kan kun glide den vej, den ligger."
Hver finger følges for sig, så to børn kan flytte hver sin stamme. Når den
lyse stamme når åbningen, glider den ud i vandet og flyver op på dæmningen.
Fem stammer, så er dæmningen færdig.

**Stjernerne** er, hvor mange træk en bane kræver: én stjerne 2-4, to
stjerner 5-8 og tre stjerner 9-14. Der er tolv baner pr. stjerne, fundet af
`vaerktoej/lav-baever-baner.js`: det lægger tilfældige stammer, finder alle
stillinger, de kan skubbes til, og hvor langt hver er fra at være løst, og
vælger en med det rigtige antal træk. En runde er fem baner, nemmeste først.
Der er ingen tæller, intet ur og ingen game over. Sidder man fast (14 sekunder
uden et træk, eller mange træk), lyser den stamme, der skal flyttes nu, med en
gul pil; løseren i `daemning.js` finder den korteste vej fra den stilling,
barnet står i.

**To spillere** har hver sin plads, og den højre er spejlet, så begge
åbninger vender ind mod vandet i midten. Bodil bygger én dæmning af begges
stammer; de to får forskellige baner fra den samme stjerne.

**Grafikken** er tegnet i kode (stammer med bark og årringe, bredden med
sten, vandet) på nær Bodil, der er malet med Canva. **Stemmen** er otte
sætninger med Gemini (Kore), lavet med `vaerktoej/lav-lyd-gemini.py --spil
baever` ud fra `Daemning.saetninger()`.

Testen løser alle 36 baner og kræver præcis det antal træk, der står ved dem,
lader en robot spille hver bane igennem, lader en anden robot rode rundt med
tilfældige træk og så følge hjælpen hele vejen ud, og tjekker runderne,
stemmen, billedet og filerne i service workeren.

## Egernreden (mappen `egern`)

Egernet Egon samler nødder på en stubbe. Spillet øver det, der i den tidlige
talforståelse kaldes del og helhed: at et tal kan ses som to dele ("tre og to
er fem"). Vejen ind er subitizing: at se små mængder med det samme uden at
tælle. Egon og nødden er Bogstavvejens malede billeder; resten er tegnet i
kode.

**Forskningen bag, og hvorfor det er ét spil.** Konceptuel subitizing, at se
7 som 5 og 2, er del og helhed set med øjnene (Clements 1999; NCETM), og
gemmelegen virker kun, hvis barnet hurtigt kan se den del, der ligger fremme.
Derfor er de to ikke hver sit spil. Seksårige ser ikke selv grupperne
(Starkey & McCandliss 2014), så delene vises i farver og siges. Faste mønstre
til fem kommer før femmer-strukturen til ti, og spredte mønstre kommer til
sidst (Clements & Sarama). Nødderne ses i cirka to sekunder (Building
Blocks' "Snapshots"), men selve svaret har ingen tidsgrænse. Del-helhedsmodellen
med tal i cirkler bruges ikke: stubben er helheden, og en streg deler den i
to. Ellers ser helheden og delene ud som dobbelt så mange (NCETM's advarsel).
Studierne er små, og effekten er moderat; se også Wästerlid (2020) og NCUM's
temaer om subitizing og del-del-helhed i børnehaveklassen.

**Svaret** gives på en talrække med alle antal, 1-5 eller 1-10 (to rækker:
1-5 og 6-10), som terning og tierramme. Et tilfældigt tryk er sjældent
rigtigt, og rækken viser femmer-strukturen. Et forkert svar rokker kortet,
stemmen siger dets tal og "Kig igen", og nødderne vises igen. Anden gang med
delene i hver sin farve, så man ser 5 og 2 i stedet for at tælle én ad gangen.

**Se hurtigt.** Bladene blæser væk, nødderne ses et øjeblik, og bladene
kommer tilbage. Én stjerne: 1-5 i faste mønstre (række, femmerramme, terning,
trekant). To stjerner: til 5 som før og hver anden gang 6-10 som "fem og"
(tierramme eller en søjle på fem og en terning). Tre stjerner: 1-10 i
tierramme, to grupper på alle måder og spredt til seks. Efter svaret lyser
delene, og stemmen siger, hvordan man kunne se det: "Ja! Fem og to er syv."
Et tryk på bladene viser nødderne igen.

**Gemmeleg.** Egon har fx syv nødder i en tierramme ("Egon har syv nødder").
De deler sig: nogle bliver på venstre side af stregen, resten gemmer sig under
et stort blad. Hvor mange gemmer sig? Bladet løfter sig, og stemmen siger "Ja!
Fire og tre er syv." Én stjerne 2-5 nødder, to 5-8, tre 6-10 med tiervennerne
dobbelt så tit. **Med to spillere** gemmer den ene for den anden: stubbens kant
har gemmerens farve, et tryk på en nød til venstre gemmer den, et tryk under
bladet henter én tilbage, og øjet siger "færdig". Så gætter den anden, med
kortene i sin farve, og næste gang bytter de.

**Ryst og hæld.** Egon har fx fem nødder; tryk på ham, så kaster han dem, og
nogle lander i reden. Hvor mange? Hver måde at dele tallet på skrives op på
tavlen til venstre som en trappe (én i reden og fire udenfor, to og tre …),
og legen slutter, når alle måder er fundet ("Nu er alle måderne fundet!").
Kommer en måde igen, siger stemmen "Den har vi allerede fundet". Én stjerne
fem, to syv, tre ti (tiervennerne). Kastet vælger oftest en måde, der mangler,
så det ikke trækker ud. Med to spillere skiftes man til at kaste.

En omgang Se hurtigt eller Gemmeleg er seks spørgsmål (otte med to spillere);
nødderne flyver op i Egons kurv, og cirklerne foroven tæller omgangen.
**Stemmen** er 84 sætninger med Gemini (Kore), lavet med
`vaerktoej/lav-lyd-gemini.py --spil egern` ud fra `Egern.saetninger()`;
replikkerne sættes sammen af hele sætninger ("Ja!" og "Tre og to er fem.").

## Bogen om Nøddeskoven (mappen `bog`)

En lille billedbog, der binder spillene sammen: Pelle Pindsvin har tabt sin
skruenøgle, Skaden Sanne har taget den, og Pelle leder efter den hos alle
spillenes figurer. Bogen ligger forrest på forsiden og har ti opslag i
historiens rækkefølge: Nøddeskoven, Susebanen, Boldbanen, Boblehavet,
Bogstavvejen, Rimhulen, Vrimleskoven, Tegnestuen, Stjerneuret og til sidst
Skovkøkkenet, hvor alle vennerne mødes, og nøglen kommer hjem.

Hvert opslag har billedet til venstre og teksten til højre: tre små stykker,
et rim i en boks, og linjen "Besøg mig på …", som fortæller, hvor figuren bor.
Der er ingen knap ind i spillet; bogen er en bog. På hvert opslag gemmer
nøglen sig et sted i billedet, og trykker barnet på den, får den en gul ring,
og stemmen siger "Du fandt den" (klippet lånes fra Vrimleskoven). Bogen
husker ikke noget mellem to læsninger.

Teksten læses højt, når man blader, og igen med højttaleren i hjørnet.
Klippene ligger i `bog/lyd/` som `<opslagets id>.mp3` og står i
`lyd/klip.json`. De er læst op af Gemini (Kore, som spillene) ud fra bogens
egen tekst, hele siden med rimet i ét stykke, som MP3 i mono — Ogg kan ikke
afspilles på ældre iPads. Mangler et klip, læser enhedens egen danske stemme
i stedet. Klippene laves med `vaerktoej/lav-lyd-gemini.py --spil bog`
(ét klip pr. opslag, teksten og rimet i én omgang). Der er ingen printknap i
appen: PDF'en laves én gang med `vaerktoej/lav-bog-pdf.js` (kræver
Playwright) og sendes til dem, der skal printe den. Den tegner alle sider i
`#print`, et A4-ark på tværs pr. opslag, forsiden først.

Opslagene vises med de malede billeder i `bog/billeder/opslag/`: hele scenen
malet i ét billede med Gemini Storybook, klippet ud af udkastet i `bog/udkast/`
og beskåret til 600 x 780. Nøglens plads i hvert billede står i `js/bog.js`
under `malet.noegle`. Mangler et billede, tegnes opslaget i kode i
`js/scener.js` i det samme felt, sat sammen af spillenes egne malede figurer (Pelle og skovens dyr fra
Nøddeskoven, husene fra Vrimleskoven, klatterne fra Boldbanen, Emil og Ella
fra Boblehavet, gæsterne fra Skovkøkkenet, robotten fra Bogstavvejen, bilen og
rummusen fra forsiden). Skaden er bogens egen (`bog/billeder/skade.png`,
malet i Canva, se NOTICE). Nøglen tegnes i kode, så den er den samme på
alle opslag, med træskaft som Pelles. Nøglens og skadens pladser står i
`js/bog.js` i de samme enheder.

Testen (`test/bog.test.js`) tegner alle ti opslag i et lærred uden browser
og tjekker, at nøglen tegnes præcis dér, hvor opslaget siger, at alle lånte
billeder findes, at hvert opslags sted hedder det samme som spillet, at den,
Pelle møder, nævnes i teksten, at Klaus er rød og Klara blå, og at bogens
filer er med i service workeren og forrest på forsiden.
