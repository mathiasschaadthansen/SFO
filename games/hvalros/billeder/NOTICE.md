# Billederne i denne mappe

`helle.png` er Hvalrossen Helle. Hun er lavet af Canvas AI-billedgenerator
(15. november 2026, gennem Canva-connectoren) ud fra prompten i `PROMPT.md`,
skrevet i dette projekt: en "warm gouache picture-book painting" af en rund,
glad hvalros på hvid baggrund — aldrig med navnet på en kunstner, en bog
eller et spil. Canva giver den bruger, der laver et billede, ret til at bruge
det, se Canvas Content License Agreement. Der er ingen tredjepartsfigurer i
billedet.

Forlæggene (Pelle og Egon) kunne ikke sendes med, så stilen er kun beskrevet
i prompten. Originalen er 2048 x 2048 og ligger i Canva-designet "Cute Walrus
with Soft Texture on White Background".

Efterbehandling i kode (ImageMagick): den hvide baggrund er skåret fra fra
hjørnerne, kanten er blødt lidt op og blandet med isens lyse farve, billedet
er beskåret til hvalrossen og skaleret til 480 x 335, og det er gemt som
8-bit PNG med palet (cirka 40 KB).

Spillet tegner Helle på sit isflag i `js/game.js` (`tegnHelle`). Mangler
billedet, tegnes hun i kode, og spillet virker alligevel.
