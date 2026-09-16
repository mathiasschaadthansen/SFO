# Lydklip

Bogstavnavne, tal, ord og spørgsmål som små MP3-filer. Lavet med
`vaerktoej/lav-lyd.py` og Piper, en offline talesyntese, med den danske stemme
`da_DK-talesyntese-medium`. Stemmen er trænet på data fra Nasjonalbiblioteket
(Sprakbanken) udgivet under CC0. Piper selv er MIT-licens. Klippene her er
projektets egne.

Filnavne:

- `bogstav_<NAVN>.mp3` bogstavets navn, NAVN som i glyffer.js (A, AE, OE, AA)
- `spoerg_<NAVN>.mp3` "Hvad starter med ...?"
- `tal_<0-9>.mp3` talord
- `ord_<navn>.mp3` tingene, navn som SVG-filen i ting/

Vil man have en rigtig stemme, fx en pædagog, optager man de samme ord og
gemmer dem under de samme filnavne. Spillet er ligeglad med, hvor lyden kommer
fra. Mangler et klip, bruger spillet enhedens egen talesyntese.
