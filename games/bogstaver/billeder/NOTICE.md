# Malede billeder til Bogstavvejen

De 69 billeder er tingene i minispillet "hvad starter med" og i Ord-legen, i
den samme malede billedbogsstil som resten af spillene. De er lavet den 20. og
21. september 2026 ud fra prompter skrevet i dette projekt (stilen er beskrevet
med ord — "warm, muted storybook watercolour style, soft brush edges" og
palettens farver — aldrig med navnet paa en kunstner, en bog eller et spil).
Der er ingen tredjepartsfigurer i dem.

Kilder:

- **Canvas AI-billedgenerator** gennem Canva-connectoren: alle billeder undtagen
  de tre nedenfor. Canva giver den bruger, der laver et billede, ret til at
  bruge det, se Canvas Content License Agreement.
- **ElevenLabs' billedgenerator** (modellen gpt-image-2) gennem ElevenLabs-
  connectoren: `robot.png`, `regnbue.png` og `sko.png`. ElevenLabs giver den
  bruger, der laver et billede, ret til at bruge det, se ElevenLabs' Terms of
  Service.

Genbrugte billeder: `abe`, `ananas`, `banan`, `froe`, `gris`, `hund`,
`jordbaer`, `kat`, `loeve`, `ost`, `pizza`, `raev`, `tiger` og `tomat` er de
samme som i `games/restaurant/billeder/`; `aeble`, `bold` og `hus` er de samme
som i `assets/malet/`; `mus`, `ugle` og `trae` er de samme som i
`games/maskinen/billeder/`. De ligger her igen, saa spillet ikke henter noget
fra en anden mappe, og de er beskaaret til kvadrater som de oevrige.

Efterbehandling: den hvide baggrund er skaaret fra i kode, billedet er
beskaaret til indholdet og lagt midt i et **kvadratisk** laerred paa 320 px
med 4 % luft, og gemt som 8-bit PNG med palet, saa hver fil fylder 12-34 KB.
`tegnTing` i `js/game.js` tegner billedet med samme bredde og hoejde, saa et
billede, der ikke er kvadratisk, bliver trukket skaevt. Testen fanger det.

Sol, sommerfugl, ur, vandmelon, vante, vulkan og yoyo er endnu ikke malet og
bruger stadig Noto Emoji fra `../ting/`. Listen `MALET` i `js/ting.js`
bestemmer, hvilke ting der bruger et malet billede. Tilfoej et billede ved at
laegge det her som kvadratisk PNG, skrive navnet i `MALET` og tilfoeje filen i
`FILER` i `sw.js`.
