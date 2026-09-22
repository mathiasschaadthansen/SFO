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
oerer og skygge er klippet vaek; og de fem andre farver er lavet ved at flytte
kroppens roede toner til spillets farve, mens lys og moerke i penselstroegene
er bevaret. Hver fil er 8-bit PNG med palet paa 7-10 KB.

Skaermen laegger billedet oven paa den halvcirkel, koden tegner, klippet til
formen, saa klattens form og fysik er uaendret. Mangler et billede, staar
kodens gradient alene, og spillet virker alligevel. Nye billeder skal med i
`FILER` i `sw.js`.
