# Bogens oplæsning

Ti klip, ét pr. opslag, navngivet efter opslagets id i `js/bog.js`
(`noeddeskoven.mp3` og så videre): hele siden, teksten og rimet, læst i ét
stykke.

De er lavet til projektet i september 2026 med Google Gemini
(`gemini-3.8-flash-tts`, stemmen Kore, den samme stemme som i spillene) med
`vaerktoej/lav-lyd-gemini.py --spil bog`, ud fra bogens egen tekst. Bogstaver
i teksten skrives, som de siges (æn, pe, æs). Tidligere var bogen læst af en
anden Gemini-stemme i Gemini Storybook.

Filerne er MP3, mono, 48 kbit/s, med stilhed klippet af enderne og ens
lydstyrke — det samme format som spillenes klip. Ogg kan ikke afspilles på
ældre iPads, MP3 kan.
