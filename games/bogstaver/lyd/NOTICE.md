# Lydklip

Her ligger rigtige optagelser til Bogstaver, hvis der er nogen. `klip.json`
er listen over de klip, der findes; spillet bruger et klip, når det står der,
og ellers iPad'ens egen talesyntese.

Filnavne:

- `bogstav_<NAVN>.mp3` bogstavets navn, NAVN som i glyffer.js (A, AE, OE, AA)
- `spoerg_<NAVN>.mp3` "Hvad starter med ...?"
- `tal_<0-9>.mp3` talord
- `ord_<navn>.mp3` tingene, navn som SVG-filen i ting/

Optag med `vaerktoej/optag.html`, pak med `vaerktoej/lav-lyd.py --optagelser`,
eller lav klippene med `vaerktoej/lav-lyd-elevenlabs.py`, se README.
Optagelser lavet til projektet er projektets egne. Er klippene lavet med
ElevenLabs på gratis-planen, gælder deres krav om kreditering: stemmen er
genereret med elevenlabs.io.

**Status september 2026:** Klippene er lavet med ElevenLabs, stemmen Camilla
(`4RklGmuxoAskAbGXplXN`), og pakket ned til mono 22 kHz, 48 kbps med stilheden
klippet væk. Stemmen er genereret med elevenlabs.io.
