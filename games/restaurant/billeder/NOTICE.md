# Malede billeder til Skovkoekkenet

De 31 billeder — 16 ingredienser, 3 retter og 12 gaester — er lavet den
20. september 2026 med Canvas AI-billedgenerator gennem Canva-connectoren, ud
fra prompter skrevet i dette projekt (stilen er beskrevet med ord — "warm
hand-painted children's picture-book style, soft brushstrokes, visible paper
texture" — aldrig med navnet paa en kunstner, en bog eller et spil). Canva
giver den bruger, der laver et billede, ret til at bruge det, se Canvas
Content License Agreement. Der er ingen tredjepartsfigurer i dem.

Alle tolv gaester er lavet med den samme prompt, hvor kun dyret er skiftet ud.
Det er grunden til, at de ligner hinanden: samme flade penselstrog, samme
runde hovedform, samme rosa kinder. Bliver en gaest lavet om, skal den samme
prompt bruges igen.

`pizza.png` er det samme billede som i `assets/malet/`, beskaaret til et
kvadrat som de ovrige.

Efterbehandling: den hvide baggrund er skaaret fra i kode, billedet er
beskaaret til indholdet og lagt midt i et **kvadratisk** laerred paa 320 px,
og gemt som 8-bit PNG med palet. Kvadratet er ikke pynt: `tegnBillede` i
`game.js` tegner hvert billede som `drawImage(img, -str/2, -str/2, str, str)`,
saa et billede der ikke er kvadratisk, bliver trukket skaevt.

Klokken, hjertet, koen, maelken og bien er stadig Noto Emoji og ligger i
`assets/noto/`.

Nye billeder skal med i `FILER` i `sw.js`.
