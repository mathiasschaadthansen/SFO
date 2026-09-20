# Retningslinjer for arbejde i dette projekt

Reklamefri spil til en SFO's iPads. Målgruppen er 6-årige. Læs README.md for
struktur og opsætning.

## Kør altid testen

`npm test` efter enhver ændring i et spils `physics.js` eller i en bane.
Racertesten kører 3 fulde omgange på hver bane uden browser og fanger, hvis en
ændring gør en bane uigennemførlig. Den har allerede fanget den fejl én gang.
Klatbold-testen tjekker mål, overligger, hop og at AI'en kan nå bolden.
Bobler-testen lader en robot spille alle tolv baner igennem på alle tre
sværhedsgrader, så ingen bane kan blive umulig. Bogstav-testen tjekker, at alle
68 tegn kan tegnes færdige af en finger, der følger stregen, også en skæv og en
hurtig finger, og at alle ord i Ord-legen kan tegnes og er indtalt. Restaurant-testen lader en robot hente på gården, servere og betale en hel
dag og tjekker, at alle bestillinger kan laves med det, der står på hylden, at
alle ingredienser har en kilde, og at alle regninger kan betales med pungens
mønter. Tegn-testen tjekker, at
alle 16 figurer kan tegnes, og at puslespillet kan samles. Klokke-testen lader en
robot stille alle ure og vælge alle kort på alle niveauer og tjekker, at viserne
låser rigtigt og hænger sammen, og at tiden siges rigtigt på dansk. Maskin-testen
gennemspiller alle 36 baners gemte løsning i fysikken og fanger, hvis en
ændring gør en bane uløselig — præcis som racertesten. Den kræver også, at
løsningen tåler, at delene ligger op til 40 px skævt, så ingen bane er en nål i
en høstak, og at hver bane har faste pladser, som løsningen passer på. Den tjekker også de
enkelte dele (kanon, tragt, vippe, bånd, blæser), stoffet i murene (is, sne,
åkande) og at hvert kapitel har sine baner og sin kugle.

**Stemme.** Bogstaver bruger rigtige klip med en dansk stemme fra ElevenLabs
(Camilla) til bogstavnavne, tal, ord og spørgsmål. Klippene ligger som små
MP3-filer i `games/bogstaver/lyd/` og står i `lyd/klip.json`. Mangler et klip,
siger enhedens egen talesyntese det i stedet, og kun stemmer med `localService`
bruges, så der aldrig går noget over nettet. Klip laves én gang med
`vaerktoej/lav-lyd-elevenlabs.py` eller lægges ind med `--registrer`. Piper blev
prøvet og forkastet på udtalen.

## Rammer der ikke skal brydes

**Ingen netværkskald.** Ingen analytics, ingen fonte fra CDN, ingen API'er,
intet login. Det er hele grundlaget for at der ikke skal en databehandleraftale
til, og det er projektets eksistensberettigelse. Alt indhold skal i repoet.

**Ingen browser-storage der ligner sporing.** Højscorelister og profiler pr.
barn skal ikke bygges. Det trækker persondata ind i noget der i dag er
fuldstændig neutralt.

**Ingen ophavsretsligt materiale.** Ingen figurer, navne, lyde eller grafik
fra kommercielle spil. Al grafik tegnes i kode eller har en fri licens (CC0,
Apache 2.0, CC BY) med licensteksten liggende i repoet ved siden af filerne.
Eksempel: `games/bogstaver/ting/` bruger Noto Emoji under Apache 2.0.

**Ingen binære assets uden grund.** Grafik tegnes med canvas eller er SVG
(tekst, små filer), lyd laves med oscillatorer. Det holder repoet lille og
offline-cachen hurtig. Nye filer skal med i `FILER` i `sw.js`.

## Grafik og spil er to ting

**En grafikændring må ikke ændre spillet.** Skal et spil se anderledes ud, er
det kun malingen, der skiftes: farver, billeder, skygger, baggrund. Banerne,
reglerne, styringen, knappernes placering og det, der kan trykkes på, bliver
som de er. Vil man ændre selve spillet, er det en anden opgave, som skal
aftales for sig.

To fælder, der allerede er trådt i:

- **Se den rigtige spilleplade først.** Bobler blev tegnet om som et helt
  andet spil, fordi kun menuen var åbnet. Start spillet, før du tegner.
- **Tydeligere er ikke det samme som pænere.** At gøre Racerbanens styrezoner
  synlige er en ændring af spillet, ikke af grafikken — uanset hvor godt det
  lyder.

Bobler blev set efter og beholdt, som det er. Maskinens faste pladser er den
ene undtagelse: dér blev spillet ændret, fordi det var det, der blev bedt om.

## Designregler for 6-årige

- Ingen tekst der skal læses for at kunne spille. Omgangstælleren er cirkler,
  ikke tal.
- Ingen game over, ingen straf. Kører bilen fast i græsset, sættes den tilbage
  på banen efter et par sekunder.
- Ingen tidspres og ingen højscore. Børnene sidder typisk to ved en iPad, og
  konkurrenceelementer skaber skænderier som pædagogerne skal håndtere.
- Store trykflader. Styrezonerne fylder hele skærmhøjden.
- Menuknapper er billeder, ikke ord. Ikonerne ligger i `js/menu.js` og bruges
  af alle spil: én eller to figurer for antal spillere, en trekant for start,
  en pil rundt for igen, en pil tilbage for menuen, og én, to eller tre
  stjerner for sværhed. Rækkefølgen er ens overalt: spillets egne valg,
  stjerner, og nederst de store grønne startknapper. Grøn betyder "gå i gang".

## Tekniske faldgruber der allerede er løst — lav dem ikke om

- **Multi-touch.** `input.js` følger hver finger via `pointerId`. Bruger man
  almindelige click-handlere eller kun én aktiv touch, dør spiller 2's input
  så snart spiller 1 holder en finger nede.
- **Kollision.** Banemasken læses som ét array-opslag pr. bil pr. frame.
  Kald ikke `getImageData` i spilløkken.
- **roundRect.** Polyfill ligger i `game.js`, fordi skole-iPads kan køre
  Safari under version 16.
- **Lyd på iOS.** Første tone skal udløses af et tryk. Derfor starter lyden
  først efter menuknappen.
- **Lydløs-knappen på iPhone.** Web Audio er stum, når knappen på siden står på
  lydløs. `js/skal.js` sætter `navigator.audioSession.type = 'playback'` (og en
  løkke af stilhed på ældre iOS), så lyden følger lydstyrken som i andre spil.
  AudioContext genoptages ved enhver tilstand, der ikke er `running`, fordi iOS
  også bruger `interrupted`.
- **Service worker.** Nye filer skal tilføjes til `FILER` i `sw.js`, og
  `VERSION` skal tælles op. Ellers henter iPad'en den gamle version.

## Sprog

Kode, kommentarer, commits og brugerflade er på dansk. Variabelnavne må gerne
være danske. Undgå æ, ø og å i filnavne og i felter der krydser filgrænser.
