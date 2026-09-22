# Bogens oplæsning

Ti klip, ét pr. opslag, navngivet efter opslagets id i `js/bog.js`
(`noeddeskoven.mp3` og så videre). De er lavet til projektet med Gemini
Storybook i september 2026 ud fra bogens egen tekst: hele siden, teksten og
rimet, læst i ét stykke.

Stemmen er en anden end Camillas fra ElevenLabs, som spillene bruger, fordi
bogen er læst højt ét sted fra ende til anden. Skal den en dag læses af
Camilla i stedet, laves klippene med
`vaerktoej/lav-lyd-elevenlabs.py --spil bog`, som skriver de samme filnavne.

Filerne kom som Ogg Opus og er lavet om til MP3, mono, 22 kHz, 48 kbit/s,
med stilhed klippet af enderne og ens lydstyrke — det samme format som
spillenes klip. Ogg kan ikke afspilles på ældre iPads, MP3 kan.
