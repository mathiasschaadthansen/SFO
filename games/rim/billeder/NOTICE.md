# Malede billeder til Rimhulen

Tre ord, der rimer paa Bogstavvejens ting: bjoern og kanin er de samme
malede figurer som i `games/maskinen/billeder/` (se NOTICE.md dér), lagt midt
i et kvadratisk laerred paa 320 px som Skovkoekkenets. Salat er den samme som
i `games/restaurant/billeder/`. Alle tre er lavet med Canvas AI-billedgenerator
ud fra prompter skrevet i dette projekt; Canva giver den bruger, der laver et
billede, ret til at bruge det.

`tegnTing` i `js/game.js` tegner billedet med samme bredde og hoejde, saa et
billede, der ikke er kvadratisk, bliver trukket skaevt. Testen fanger det.

Ordklippene til de tolv ekstra ord og hulens fire saetninger ligger i
`../lyd/` og er indtalt med Gemini (stemmen Kore), som alle andre klip.
