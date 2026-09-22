# Retningslinjer for arbejde i dette projekt

Reklamefri spil til en SFO's iPads. Målgruppen er 6-årige. Læs README.md for
struktur og opsætning.

## Kør altid testen

`npm test` efter enhver ændring i et spils `physics.js` eller i en bane.
Susebane-testen kører 3 fulde omgange på hver bane uden browser og fanger, hvis en
ændring gør en bane uigennemførlig. Den har allerede fanget den fejl én gang.
Boldbane-testen tjekker mål, overligger, hop og at AI'en kan nå bolden.
Boblehav-testen lader en robot spille alle tolv baner igennem på alle tre
sværhedsgrader, så ingen bane kan blive umulig. Bogstavvejs-testen tjekker, at alle
68 tegn kan tegnes færdige af en finger, der følger stregen, også en skæv og en
hurtig finger, og at alle ord i Ord-legen kan tegnes og er indtalt. Skovkøkken-testen lader en robot hente på gården, servere og betale en hel
dag og tjekker, at alle bestillinger kan laves med det, der står på hylden, at
alle ingredienser har en kilde, og at alle regninger kan betales med pungens
mønter. Den tjekker også, at hver ret, ingrediens og gæst har en malet tegning,
at tegningerne er kvadratiske, og at ingen af dem fylder over 40 KB. Tegnestue-testen tjekker, at
alle 16 figurer kan tegnes, og at puslespillet kan samles. Stjerneur-testen lader en
robot stille alle ure og vælge alle kort på alle niveauer og tjekker, at viserne
låser rigtigt og hænger sammen, og at tiden siges rigtigt på dansk. Nøddeskovs-testen
gennemspiller alle 36 baners gemte løsning i fysikken og fanger, hvis en
ændring gør en bane uløselig — præcis som susebane-testen. Den kræver også, at
løsningen tåler, at delene ligger op til 40 px skævt, så ingen bane er en nål i
en høstak, og at hver bane har faste pladser, som løsningen passer på. Den tjekker også de
enkelte dele (kanon, tragt, vippe, bånd, blæser), stoffet i murene (is, sne,
åkande) og at hvert kapitel har sine baner og sin kugle. Rimhule-testen lader en
robot spille rim og klappe stavelser på alle tre stjerner og tjekker, at hvert
spørgsmål har præcis ét rigtigt kort, at ingen forkerte kort rimer, og at alle
ord har billede, stemme og stavelser. Vrimleskov-testen lader en robot spille alle
steder på alle tre stjerner og tjekker, at tingene ligger frit og inden for
stedet eller præcis på deres plads (vindue, bænk, båd, træ), at ingen er helt
gemt bag et skjul, at hvert spørgsmål kan besvares med det, der er i billedet,
at der ved tre stjerner ligger en lookalike tæt ved hver ting, der spørges om,
og at kategorierne har to til fire medlemmer.

**Stemme.** Bogstavvejen (og Rimhulen, som låner dens ordklip) bruger rigtige
klip med en dansk stemme fra ElevenLabs (Camilla) til bogstavnavne, tal, ord og
spørgsmål. Klippene ligger som små
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

- **Se den rigtige spilleplade først.** Boblehavet blev tegnet om som et helt
  andet spil, fordi kun menuen var åbnet. Start spillet, før du tegner.
- **Tydeligere er ikke det samme som pænere.** At gøre Susebanens styrezoner
  synlige er en ændring af spillet, ikke af grafikken — uanset hvor godt det
  lyder.

Boblehavet blev set efter og beholdt, som det er. Nøddeskovens faste pladser er den
ene undtagelse: dér blev spillet ændret, fordi det var det, der blev bedt om.

## Spillenes navne

Navnene er steder i den samme lille verden, og mappen hedder noget andet end
spillet. Koden er ikke doebt om: modulerne hedder stadig `Klatbold`, `Bobler`,
`Ur` og så videre.

| Spillet hedder | Mappen | Testen |
|---|---|---|
| Susebanen | `games/racer/` | `test/racer.test.js` |
| Boldbanen | `games/klatbold/` | `test/klatbold.test.js` |
| Boblehavet | `games/bobler/` | `test/bobler.test.js` |
| Bogstavvejen | `games/bogstaver/` | `test/bogstaver.test.js` |
| Skovkøkkenet | `games/restaurant/` | `test/restaurant.test.js` |
| Stjerneuret | `games/klokken/` | `test/klokken.test.js` |
| Nøddeskoven | `games/maskinen/` | `test/maskinen.test.js` |
| Tegnestuen | `games/tegn/` | `test/tegn.test.js` |
| Rimhulen | `games/rim/` | `test/rim.test.js` |
| Vrimleskoven | `games/find/` | `test/find.test.js` |

Navnet står tre steder pr. spil: `<title>` i `index.html`, `<h2>` i `visMenu`
og `navn` i `js/games.js`. App-ikonet er pindsvinet Pelle, den samme figur som
i Nøddeskoven; det ligger i `icons/` og bruges også som mærke på forsiden.

## Den malede palet

Alle spil bruger den samme dæmpede, malede palet. Skal noget have en farve,
tages den herfra i stedet for en ny neonfarve:

| Rolle | Farve |
|---|---|
| Blæk (streger, tekst) | `#5e4a3a`, lysere `#6b5545` |
| Papir og kort | `#f8f1e6`, knapper `#efe3d0` |
| Sand og træ | `#e5d3ae`, `#d9ba8a`, `#b18a56`, `#8a663d` |
| Grøn | `#93bc63`, dyb `#5f8240`, salvie til startknapper `#8fae86` |
| Blå | `#8fc7e8`, `#5f9fc9`, valgt-blå `#aed3e4` |
| Rød og fersken | `#d95f45`, `#e08a52`, `#f0c46a` |
| Lilla | `#9b7bd4` |

Kort og knapper har bløde skygger, ikke sorte kanter: `0 6px 0 rgba(107,85,68,.18)`
og `inset 0 3px 0 rgba(255,255,255,.85)`. Menuikonerne ligger i `js/menu.js` og
hjem-knappen i `js/skal.js`, så en ændring dér slår igennem i alle spil.

Malede billeder ligger i `assets/malet/` (forsiden),
`games/maskinen/billeder/` (Nøddeskoven), `games/restaurant/billeder/`
(Skovkøkkenets 16 ingredienser, 3 retter og 12 gæster) og
`games/bogstaver/billeder/` (Bogstavvejens 69 ting, kvadratiske som
Skovkøkkenets; listen `MALET` i `ting.js` siger, hvilke ting der er malet).
Rimhulen og Vrimleskoven genbruger Bogstavvejens billeder og ordklip fra
`../bogstaver/`; Rimhulen har kun sine elleve ekstra rimord selv, og
Vrimleskoven har byens seks malede stykker i `games/find/billeder/` (husene
forrest i byen er tegnet i kode, fordi tingene skal kunne sidde i vinduerne).
Boldbanens klatter har en malet krop i `games/klatbold/billeder/`: ét
Canva-billede, farvet om i kode til de seks farver, med ansigtet fjernet, så
koden tegner ansigt og øjne. Canvas AI-tilladelse er cirka 200 billeder om
måneden og bliver brugt op; farv hellere om i kode end at bede om et nyt.
Noto Emoji bruges stadig, hvor et barn skal kunne genkende en ting med det
samme: kortene i Stjerneuret, de sidste syv ting i Bogstavvejen (sol,
sommerfugl, ur, vandmelon, vante, vulkan, yoyo) og de få rekvisitter i
Skovkøkkenet, der ikke er mad — klokken, hjertet, koen, mælken og bien.

Skovkøkkenets tolv gæster er lavet med den samme prompt, hvor kun dyret er
skiftet ud. Det er grunden til, at de ligner hinanden. Skal en gæst laves om,
skal den samme prompt bruges igen — prompten står i
`games/restaurant/billeder/NOTICE.md`.

## Designregler for 6-årige

- Ingen tekst der skal læses for at kunne spille. Omgangstælleren er cirkler,
  ikke tal.
- Ingen game over, ingen straf. Kører bilen fast i græsset, sættes den tilbage
  på banen efter et par sekunder.
- Ingen tidspres og ingen højscore. Børnene sidder typisk to ved en iPad, og
  konkurrenceelementer skaber skænderier som pædagogerne skal håndtere.
- Store trykflader. Styrezonerne fylder hele skærmhøjden.
- To knapper i hjørnet hele tiden: huset øverst fører til forsiden, pilen
  under fører tilbage til spillets egen menu. Pilen ligger i `js/skal.js`, og
  hvert spil melder sig til med `Skal.menuKnap(visMenu)`. Den viser sig kun,
  mens man spiller, så man aldrig skal spille færdig for at skifte bane.
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
- **Skovkøkkenets billeder skal være kvadratiske.** `tegnBillede` tegner hvert
  billede som `drawImage(img, -str/2, -str/2, str, str)`. Et billede, der ikke
  er kvadratisk, bliver trukket skævt — det ses tydeligst på en gæst med høje
  ører. Læg tegningen midt i et kvadratisk lærred, i stedet for at ændre
  `tegnBillede`. Testen fanger det.
- **Ordklippene siger "Her har du ordet kat" med vilje.** Et enkelt kort ord
  alene bliver udtalt forkert af stemmen (ski blev til "skie"), så ordene er
  indtalt inde i den sætning. Nye sætninger, der bruger et ordklip, skal
  bygges, så rammen passer: "Her har du ordet kat. Hvad rimer på det?" —
  aldrig "Hvad rimer på" + ordklip. Rimhulen faldt i den fælde i v80.
- **Service worker.** Nye filer skal tilføjes til `FILER` i `sw.js`, og
  `VERSION` skal tælles op. Ellers henter iPad'en den gamle version.
- **Offline skal testes med serveren slukket.** Playwrights `setOffline(true)`
  blokerer ikke 127.0.0.1: `navigator.onLine` bliver falsk, men filerne kommer
  stadig fra serveren, så alt ser ud til at virke. Luk serverprocessen i
  stedet, og kontrollér med et kald til en fil, der ikke findes, før du måler
  noget. Den fælde gav én gang et forkert svar begge veje.
- **Forsiden linker til mapper, `FILER` indeholder filer.** Kortene peger på
  `games/racer/`, men i cachen ligger `games/racer/index.html`. De to adresser
  er ikke den samme, så `caches.match` rammer forbi. Uden et fald tilbage til
  `index.html` i `fetch`-handleren kunne forsiden åbnes uden net, men ingen af
  spillene. Det stod der fra begyndelsen og blev først fanget i september 2026.
- **Alle filer i `FILER` skal findes.** `addAll` fejler på én 404, og så
  installerer den nye version aldrig: iPad'en beholder den gamle i stilhed,
  uden fejl nogen ser. Det samme sker, hvis en fil står to gange. Sletter
  man filer, skal deres linjer ud af `FILER` — og listen kan have samme
  mappe to steder, så søg på hele listen. Det skete med Bogstavvejens
  SVG'er i v77. `test/assets.test.js` fanger begge dele nu.
- **Service workeren må ikke hente fra browserens egen cache.** Filerne i
  `install` hentes med `cache: 'reload'`. Uden det fyldte den nye version sin
  cache med de gamle filer: cachen skiftede navn til den nye `VERSION`, men
  indholdet var uændret, og iPad'en viste det gamle spil. Kun helt nye filer
  kom igennem, så det lignede, at "kun ikonerne" var skiftet. Det skete én
  gang i september 2026 og kostede en hel udgivelse.

## Sprog

Kode, kommentarer, commits og brugerflade er på dansk. Variabelnavne må gerne
være danske. Undgå æ, ø og å i filnavne og i felter der krydser filgrænser.
