# Billederne i denne mappe

`emil.png` og `ella.png` er Emil og Ella fra Boblehavet, set forfra i hele
figur, så børnene kan trykke på en albue, en ankel eller et øjenbryn. De er
lavet af Canvas AI-billedgenerator (17. november 2026, gennem
Canva-connectoren) med Boblehavets egne malede figurer
(`../../bobler/billeder/dreng.png` og `pige.png`) som forlæg og en prompt
skrevet i dette projekt: samme dreng/pige i samme bløde akvarelstil, stående
forfra, armene lidt ud fra kroppen med åbne hænder, barfodet, i t-shirt og
shorts, hvid baggrund — aldrig med navnet på en kunstner, en bog eller et
spil. Canva giver den bruger, der laver et billede, ret til at bruge det, se
Canvas Content License Agreement. Der er ingen tredjepartsfigurer i dem.

Efterbehandling i kode (ImageMagick): eksporteret i fuld størrelse, den hvide
baggrund skåret fra fra hjørnerne, kanten blødt op mod væggens farve,
beskåret og skaleret til 1000 px høje og gemt som 8-bit PNG med palet
(80–86 KB).

Hvor kropsdelene sidder på billederne, står i `../js/krop.js` (`PLADS`), og
organerne til røntgenøjet i `INDRE`. Laves et billede om, skal pladserne
aflæses igen; testen tjekker, at et tryk midt på hver del rammer den.
