# Billederne i denne mappe

Klattens malede krop i seks farver: roed, blaa, groen, gul, lilla og pink.
Det er spillets egne farver fra `FARVER` i `js/game.js`.

Kun den roede er lavet af Canvas AI-billedgenerator (22. september 2026,
gennem Canva-connectoren, ud fra en prompt skrevet i dette projekt: "soft
watercolor storybook painting of a cute round half-dome blob creature" —
aldrig med navnet paa en kunstner, en bog eller et spil). Canva giver den
bruger, der laver et billede, ret til at bruge det, se Canvas Content License
Agreement. Der er ingen tredjepartsfigurer i den.

Efterbehandling i kode (Pillow): den hvide baggrund er skaaret fra; det
malede ansigt er daekket med et stykke af kroppen laengere nede, med bloed
kant, saa spillet selv kan tegne de tre ansigter og oejne, der foelger bolden;
skyggen paa jorden er klippet vaek, oererne er med; og de fem andre farver er lavet ved at flytte
kroppens roede toner til spillets farve, mens lys og moerke i penselstroegene
er bevaret. Hver fil er 8-bit PNG med palet paa 7-10 KB.

Skaermen tegner billedet som klattens krop, lige saa bred som fysikkens
halvcirkel og lidt hoejere, som oererne altid har vaeret, saa bolden rammer,
hvor man ser den. Mangler et billede, tegnes klatten i kode som foer, og
spillet virker alligevel. Nye billeder skal med i
`FILER` i `sw.js`.
