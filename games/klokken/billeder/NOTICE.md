# Malet billede til Stjerneuret

`milo.png` er rummusen Milo, den samme figur som paa Stjerneurets opslag i
Bogen om Noeddeskoven (`bog/billeder/opslag/stjerneuret.jpg`). Han er malet den
2. oktober 2026 med Googles billedmodel Gemini (`gemini-3.1-flash-image`) ud fra
en prompt skrevet i dette projekt, med Milo fra bogens opslag som forlaeg, saa
han ser ens ud i bogen og i spillet. Googles vilkaar for Gemini API giver
brugeren retten til det, der laves. Der er ingen tredjepartsfigurer i billedet.

Efterbehandling: den hvide baggrund er skaaret fra i kode, billedet er lagt
midt i et kvadratisk laerred paa 320 px og gemt som 8-bit PNG med palet (20 KB).

`tegnMus` i `js/game.js` tegner billedet i musens felt (`p.mus`) og laegger
den arm, der peger, ovenpaa, naar musen hjaelper. Mangler billedet, tegnes
musen i kode som foer.
