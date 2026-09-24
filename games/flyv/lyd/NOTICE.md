# Stemmeklip

Hver sætning, spillet siger, er ét lille MP3-klip, lavet til projektet i
september 2026 med Google Gemini (modellen `gemini-3.8-flash-tts`, stemmen
Kore) ud fra spillets egen tekst. `klip.json` siger, hvilken fil der hører til
hvilken sætning, og `js/stemme.js` sætter klippene sammen, når en replik
består af flere sætninger. Mangler et klip, siger enhedens egen danske stemme
replikken.

Klippene laves med `vaerktoej/lav-lyd-gemini.py --spil <mappe>`. Den læser
sætningerne fra spillets kode, laver kun dem, der mangler, klipper stilhed af
enderne, udjævner lydstyrken og gemmer MP3, mono, 48 kbit/s. Filnavnene er
en del af sætningen og et stykke af en hash, så de aldrig støder sammen.

Stemmen er en anden end Camillas fra ElevenLabs, som Bogstavvejen og Rimhulen
bruger. Et spil har altid kun én stemme.
