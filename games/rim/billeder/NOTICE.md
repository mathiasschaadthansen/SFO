# Malede billeder til Rimhulen

Elleve ord, der rimer paa Bogstavvejens ting, men som ikke findes dér.

Tre af dem: bjoern og kanin er de samme
malede figurer som i `games/maskinen/billeder/` (se NOTICE.md dér), lagt midt
i et kvadratisk laerred paa 320 px som Skovkoekkenets. Salat er den samme som
i `games/restaurant/billeder/`. Alle tre er lavet med Canvas AI-billedgenerator
ud fra prompter skrevet i dette projekt; Canva giver den bruger, der laver et
billede, ret til at bruge det.

De otte andre — stol, mur, maal, bog, pil, vand, mund og sky — er malet til
Rimhulen den 2. oktober 2026 med Googles billedmodel Gemini
(`gemini-3.1-flash-image`) ud fra prompter skrevet i dette projekt, med tre af
Bogstavvejens billeder (bold, hat, doer) som forlaeg for stilen ("warm, muted
storybook watercolour style, soft brush edges" og palettens farver — aldrig
navnet paa en kunstner, en bog eller et spil). Googles vilkaar for Gemini API
giver brugeren retten til det, der laves. Foer var de otte ord Noto Emoji.
Efterbehandlingen er den samme som Bogstavvejens: den hvide baggrund er
skaaret fra i kode, og billedet er lagt midt i et kvadratisk laerred paa 320 px
med 4 % luft og gemt som 8-bit PNG med palet (10-33 KB).

`tegnTing` i `js/game.js` tegner billedet med samme bredde og hoejde, saa et
billede, der ikke er kvadratisk, bliver trukket skaevt. Testen fanger det.

Ordklippene til de tolv ekstra ord og hulens fire saetninger ligger i
`../lyd/` og er indtalt med Gemini (stemmen Kore), som alle andre klip.
