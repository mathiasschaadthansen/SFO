# Retningslinjer for arbejde i dette projekt

Reklamefri spil til en SFO's iPads. Målgruppen er 6-årige. Læs README.md for
struktur og opsætning.

## Kør altid testen

`npm test` efter enhver ændring i `games/racer/js/physics.js` eller i en bane.
Testen kører 3 fulde omgange på hver bane uden browser og fanger, hvis en
ændring gør en bane uigennemførlig. Den har allerede fanget den fejl én gang.

## Rammer der ikke skal brydes

**Ingen netværkskald.** Ingen analytics, ingen fonte fra CDN, ingen API'er,
intet login. Det er hele grundlaget for at der ikke skal en databehandleraftale
til, og det er projektets eksistensberettigelse. Alt indhold skal i repoet.

**Ingen browser-storage der ligner sporing.** Højscorelister og profiler pr.
barn skal ikke bygges. Det trækker persondata ind i noget der i dag er
fuldstændig neutralt.

**Ingen ophavsretsligt materiale.** Ingen figurer, navne, lyde eller grafik
fra kommercielle spil. Al grafik tegnes i kode eller er CC0.

**Ingen binære assets uden grund.** Grafik tegnes med canvas, lyd laves med
oscillatorer. Det holder repoet lille og offline-cachen hurtig.

## Designregler for 6-årige

- Ingen tekst der skal læses for at kunne spille. Omgangstælleren er cirkler,
  ikke tal.
- Ingen game over, ingen straf. Kører bilen fast i græsset, sættes den tilbage
  på banen efter et par sekunder.
- Ingen tidspres og ingen højscore. Børnene sidder typisk to ved en iPad, og
  konkurrenceelementer skaber skænderier som pædagogerne skal håndtere.
- Store trykflader. Styrezonerne fylder hele skærmhøjden.

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
- **Service worker.** Nye filer skal tilføjes til `FILER` i `sw.js`, og
  `VERSION` skal tælles op. Ellers henter iPad'en den gamle version.

## Sprog

Kode, kommentarer, commits og brugerflade er på dansk. Variabelnavne må gerne
være danske. Undgå æ, ø og å i filnavne og i felter der krydser filgrænser.
