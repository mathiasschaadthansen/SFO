# Tegningerne i denne mappe

Filerne er Noto Emoji fra Google, hentet fra
https://github.com/googlefonts/noto-emoji (mappen `2D/svg/`, tidligere `svg/`).

Licens: Apache License 2.0, se LICENSE i denne mappe.
Der er ikke ændret i filerne, kun filnavnene er oversat til danske ord.

Sådan tilføjes en ting: find emojien på https://github.com/googlefonts/noto-emoji/tree/main/2D/svg,
kopiér SVG-filen hertil med ordet som filnavn (uden æ, ø, å i navnet), og skriv
`fil: 'ting/<navn>.svg'` på tingen i js/ting.js. Tilføj filen i sw.js.

Hvert bogstav har flere ting, så det ikke altid er den samme. Listen `EKSTRA`
i js/ting.js er bogstav, ord og filnavn. Tilføj en ting ved at skrive en linje til.
