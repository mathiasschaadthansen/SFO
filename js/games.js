/**
 * Spil-registret.
 *
 * Tilføj et nyt spil ved at lægge en mappe under /games/<navn>/
 * og skrive én blok her. Menuen bygger sig selv ud fra listen.
 *
 * farve: kortets baggrund. Dæmpede, malede toner — én pr. spil.
 * art:   valgfrit billede eller inline-SVG der tegnes i kortets højre side.
 *        Billederne ligger i assets/malet/ og er malet i samme stil som
 *        figurerne i Maskinen. Nye filer skal med i FILER i sw.js.
 */
window.SPIL = [
  {
    id: 'racer',
    navn: 'Susebanen',
    tekst: 'Hold fingeren i siden for at styre. 1 eller 2 spillere.',
    sti: 'games/racer/',
    farve: '#f5e0b0',
    art: '<div class="art">' +
         '<img src="assets/malet/bil.png" alt="" style="left:26px;top:2px;height:104px">' +
         '</div>'
  },
  {
    id: 'klatbold',
    navn: 'Boldbanen',
    tekst: 'To figurer og én bold. Løb, hop og skyd. 1 eller 2 spillere.',
    sti: 'games/klatbold/',
    farve: '#cde2ef',
    art: '<div class="art">' +
         '<img src="assets/malet/bold.png" alt="" style="left:20px;top:8px;width:92px">' +
         '</div>'
  },
  {
    id: 'bobler',
    navn: 'Boblehavet',
    tekst: 'Skyd boblerne, så de deler sig. Hjælp hinanden. 1 eller 2 spillere.',
    farve: '#f7d7c2',
    sti: 'games/bobler/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 112 108" style="position:absolute;left:0;top:0;width:112px;height:108px">' +
         '<defs>' +
         '<radialGradient id="b1" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#b5d6e6"/><stop offset="1" stop-color="#6d9bb3"/></radialGradient>' +
         '<radialGradient id="b2" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#f1bb92"/><stop offset="1" stop-color="#d99060"/></radialGradient>' +
         '<radialGradient id="b3" cx=".34" cy=".3" r=".85"><stop offset="0" stop-color="#ffffff"/><stop offset=".3" stop-color="#cbd99c"/><stop offset="1" stop-color="#7f9f5f"/></radialGradient>' +
         '</defs>' +
         '<circle cx="38" cy="44" r="32" fill="url(#b1)"/>' +
         '<ellipse cx="27" cy="31" rx="9" ry="5.5" fill="#fff" fill-opacity=".8" transform="rotate(-32 27 31)"/>' +
         '<circle cx="85" cy="30" r="22" fill="url(#b2)"/>' +
         '<ellipse cx="78" cy="21" rx="6" ry="3.6" fill="#fff" fill-opacity=".8" transform="rotate(-32 78 21)"/>' +
         '<circle cx="78" cy="79" r="17" fill="url(#b3)"/>' +
         '<ellipse cx="72" cy="72" rx="4.6" ry="2.8" fill="#fff" fill-opacity=".8" transform="rotate(-32 72 72)"/>' +
         '</svg>' +
         '</div>'
  },
  {
    id: 'bogstaver',
    navn: 'Bogstavvejen',
    tekst: 'Tegn bogstaver, ord og tal med fingeren, eller find det rigtige i boblerne.',
    farve: '#dbe8c4',
    sti: 'games/bogstaver/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 100 100" style="position:absolute;left:-4px;top:2px;width:76px;height:76px">' +
         '<path d="M20 90L50 10l30 80M32 62h36" fill="none" stroke="#cbb382" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>' +
         '<path d="M20 90L50 10l30 80M32 62h36" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5"/>' +
         '<path d="M20 90L50 10" fill="none" stroke="#e28a6d" stroke-width="15" stroke-linecap="round"/></svg>' +
         '<img src="assets/malet/aeble.png" alt="" style="left:50px;top:40px;width:62px">' +
         '</div>'
  },
  {
    id: 'restaurant',
    navn: 'Skovkøkkenet',
    tekst: 'Hent råvarer på gården, lav pizza, burger og pandekager, og tag imod betaling. To kan lave mad sammen.',
    farve: '#f2cfc0',
    sti: 'games/restaurant/',
    art: '<div class="art">' +
         '<img src="assets/malet/pizza.png" alt="" style="left:8px;top:6px;width:96px">' +
         '</div>'
  },
  {
    id: 'klokken',
    navn: 'Stjerneuret',
    tekst: 'Rummusen lærer klokken: stil uret på planeterne, find ud af hvad musen gør nu, og drej jorden fra dag til nat.',
    farve: '#dcd8f0',
    sti: 'games/klokken/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 100 100" style="position:absolute;left:-4px;top:16px;width:72px;height:72px">' +
         '<circle cx="50" cy="50" r="46" fill="#b0a8dc"/>' +
         '<circle cx="50" cy="50" r="37" fill="#f8f0e0"/>' +
         '<g fill="#6b5545" font-family="ui-rounded,system-ui,sans-serif" font-size="12" font-weight="800" text-anchor="middle">' +
         '<text x="50" y="25">12</text><text x="78" y="55">3</text><text x="50" y="85">6</text><text x="22" y="55">9</text></g>' +
         '<path d="M50 50V27" stroke="#6d9bb3" stroke-width="6" stroke-linecap="round"/>' +
         '<path d="M50 50h18" stroke="#c8624a" stroke-width="6" stroke-linecap="round"/>' +
         '<circle cx="50" cy="50" r="3.6" fill="#6b5545"/></svg>' +
         '<img src="assets/malet/rummus.png" alt="" style="left:48px;top:0;width:64px">' +
         '</div>'
  },
  {
    id: 'maskinen',
    navn: 'Nøddeskoven',
    tekst: 'Byg en kædereaktion med ramper, trampoliner, kanoner og blæsere, så kuglen ruller ned til klokken. Fem steder i Nøddeskoven, 36 baner.',
    farve: '#e6cfa8',
    sti: 'games/maskinen/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 112 108" style="position:absolute;left:0;top:0;width:112px;height:108px">' +
         '<defs><linearGradient id="mtr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f0dcb8"/><stop offset="1" stop-color="#b18a56"/></linearGradient>' +
         '<radialGradient id="mku" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e28a6d"/><stop offset="1" stop-color="#a04432"/></radialGradient></defs>' +
         '<rect x="-2" y="58" width="52" height="12" rx="6" fill="url(#mtr)" transform="rotate(22 24 64)"/>' +
         '<circle cx="9" cy="50" r="9" fill="url(#mku)"/>' +
         '<ellipse cx="6" cy="47" rx="3.6" ry="2.6" fill="#fff" opacity=".5"/>' +
         '</svg>' +
         '<img src="assets/malet/pindsvin.png" alt="" style="left:36px;top:14px;height:94px">' +
         '</div>'
  },
  {
    id: 'tegn',
    navn: 'Tegnestuen',
    tekst: 'Tegn en fisk, en raket eller et hus med fingeren, og saml den som puslespil.',
    farve: '#d3e8d8',
    sti: 'games/tegn/',
    art: '<div class="art">' +
         '<img src="assets/malet/hus.png" alt="" style="left:8px;top:14px;width:98px">' +
         '</div>'
  }
];
