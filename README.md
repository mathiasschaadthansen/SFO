# SFO Spil

Reklamefri spil til SFO'ens iPads. Ingen login, ingen sporing, ingen netværkskald.
Alt kører lokalt i browseren, så der er ingen personoplysninger at indgå en
databehandleraftale om.

Første spil er **Racerbanen**: top-down racer med ét fingertryk, 1 eller 2
spillere på den samme iPad.

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
sw.js                   offline-cache. Nye filer skal tilføjes til FILER
manifest.webmanifest    gør siden til en app på hjemmeskærmen

games/racer/
  js/track.js           bygger asfalt, kollisionsmaske og checkpoints
  js/physics.js         fysik, AI og alle tal der styrer hvordan det føles
  js/input.js           multi-touch — flere fingre samtidig
  js/game.js            menu, kamera, split screen og tegning
  tracks/*.json         banerne

test/racer.test.js      kører 3 omgange på hver bane uden browser
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
