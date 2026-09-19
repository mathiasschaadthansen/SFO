# Billederne i denne mappe

Malede figurer i billedbogsstil: pindsvinet Pelle (opfinderen), kaninen,
aeblet, svampen, traeet og klokken.

Lavet den 19. september 2026 med Canvas AI-billedgenerator gennem Canva-
connectoren, ud fra prompter skrevet i dette projekt (stilen er beskrevet med
ord — "warm hand-painted children's picture-book style, soft brushstrokes,
visible paper texture" — aldrig med navnet paa en kunstner, en bog eller et
spil). Canva giver den bruger, der laver et billede, ret til at bruge det, se
Canvas Content License Agreement. Der er ingen tredjepartsfigurer i dem.

Efterbehandling: den hvide baggrund er skaaret fra i kode (fyld fra kanterne
ind over de naesten-hvide pixels, bloed kant), billedet er beskaaret til
indholdet og skaleret til 256 px paa den lange led. Skriptet ligger ikke i
repoet; det er ti linjer canvas.

Nye billeder skal med i `FILER` i `sw.js` og i `BILLEDER` i `js/figurer.js`.
Mangler et billede, tegner `figurer.js` en SVG-udgave i stedet, saa spillet
virker alligevel.
