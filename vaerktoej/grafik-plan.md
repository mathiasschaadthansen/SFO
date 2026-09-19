# Plan for Maskinens grafik (AI-figurer via Pollinations)

Skrevet i den session, hvor ler-stilen blev bygget og forkastet. Denne fil er
til den naeste session, hvor `image.pollinations.ai` er aabnet i miljoeets
netvaerksindstillinger. Alt hertil ligger paa branchen
`claude/spilkoder-tilgang-s1wziq`; `main` har stadig den gamle udgave.

## Dommen over det, der er nu

Ler-stilen (claymorphism, `games/maskinen/js/figurer.js`) er bygget faerdig og
virker teknisk — men den blev forkastet:

- for kedeligt og fladt
- figurerne er for simple
- selve stilen rammer ikke

Behold koden som reserve: `figurer.js` tegner stadig alt, hvis et billede
mangler. Men figurerne (kanin, pindsvin, aeble, svamp, trae, klokke) skal
skiftes ud med rigtige tegninger.

## Retningen

Varm, haandmalet billedbogsstil med dybde og karakter — taettere paa Storm P,
Pettson og Findus og Hakkebakkeskoven end paa app-ikoner. Tykke, bloede
penselstroeg, synligt papir, varme farver, tydelige ansigter med personlighed.
Ingen ophavsretsligt materiale: prompt aldrig med navnet paa en kunstner, en
bogserie eller et spil. Stilen beskrives med ord, ikke med navne.

## Saadan hentes et billede

    https://image.pollinations.ai/prompt/<prompt urlencoded>?width=1024&height=1024&seed=<tal>&model=flux&nologo=true

Gratis, ingen noegle. Den samme `seed` + den samme stil-hale giver figurer, der
ligner hinanden. Hent med curl, og gem i `vaerktoej/raa/` foerst — intet gaar i
spillet, foer det er set efter.

**Stil-halen** (samme tekst paa alle figurer, saa de hoerer sammen):

> warm hand-painted children's book illustration, thick soft brushstrokes,
> visible paper texture, gentle warm daylight, friendly rounded shapes,
> expressive face, full body, centered, plain flat white background,
> no text, no border, no shadow on the ground

**Figurerne** (én ad gangen, samme seed):

| fil | prompt foran stil-halen |
|---|---|
| pelle | an elderly hedgehog inventor wearing small round glasses and a green flat cap, holding a wooden wrench, kind smile |
| mus | a small grey mouse with a red knitted cap, curious, standing upright |
| bjoern | a round friendly brown bear sitting down, holding a wicker basket |
| kanin | a soft grey rabbit with long ears, sitting, looking up |
| raev | a small red fox sitting, bushy tail curled around its paws |
| froe | a plump green frog sitting on its haunches, wide happy mouth |
| ugle | a brown owl with big amber eyes, perched, feathers detailed |

**Delene** (samme stil-hale, men "a wooden ..." saa de hoerer til samme verden):
rampe (a smooth wooden plank ramp), trampolin (a small round trampoline with
springs), klods (a wooden crate), baand (a small conveyor belt with rollers),
blaeser (a wooden box fan with four blades), vippe (a wooden seesaw on a
triangular block), kanon (a small wooden cannon), tragt (a metal funnel).

**Tingene:** aeble, agern, svamp, klokke (a brass hand bell), kurv.

**Baggrunde** (16:9, `width=1344&height=768`, uden figurer og uden dele, med
plads i midten): vaerksted, skov, soe, vinter, nat.

## Fra billede til spil

1. Hent med curl til `vaerktoej/raa/`. Se dem efter, foer noget bruges.
2. Skaer den hvide baggrund fra. Den enkleste vej, der allerede er brugt i
   dette projekt: et lille Playwright-skript, der tegner billedet paa et
   canvas, saetter alle pixels over ca. 240 i alle kanaler til gennemsigtige,
   bloeder kanten og gemmer som PNG.
3. Skaler ned til det, spillet bruger (figurer ca. 256 px, dele ca. 512 px
   bred), og gem i `games/maskinen/billeder/`. Hold den samlede stoerrelse
   under ca. 1,5 MB — `test/assets.test.js` holder oeje med, at sprites ikke
   loeber loebsk.
4. I `figurer.js`: laeg et opslag `BILLEDER = { kanin: 'billeder/kanin.png', ... }`
   ind foran `TEGNINGER`. Er der et billede, bruges det; ellers tegnes SVG'en
   som nu. Saa kan figurer skiftes ud én ad gangen, og spillet virker hele
   vejen.
5. Nye filer skal med i `FILER` i `sw.js`, og `VERSION` skal taelles op.
6. `vaerktoej/raa/` maa ikke committes. Kun de faerdige, beskaarne filer.

## Licens

Et rent AI-genereret billede har formentlig ingen ophavsret i EU, og
Pollinations laegger ingen begraensning paa brugen. Skriv det ned i
`games/maskinen/billeder/NOTICE.md`: hvad der er brugt (Pollinations, model
flux), hvornaar, og at prompterne staar her i filen. Prompt aldrig i navnet paa
en kunstner eller en figur fra et kommercielt vaerk.

## Naar billederne er inde

Baggrunden, bakkerne og hylden kan blive ved med at vaere tegnet i kode — men
farverne skal saettes efter billederne, ikke omvendt. `PALET` i `figurer.js` er
stedet, det aendres.
