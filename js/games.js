/**
 * Spil-registret.
 *
 * Tilføj et nyt spil ved at lægge en mappe under /games/<navn>/
 * og skrive én blok her. Menuen bygger sig selv ud fra listen.
 *
 * farve: kortets baggrund. Vælg fra paletten i css/shell.css.
 * art:   valgfrit inline-SVG der tegnes i kortets højre side.
 */
window.SPIL = [
  {
    id: 'racer',
    navn: 'Racerbanen',
    tekst: 'Hold fingeren i siden for at styre. 1 eller 2 spillere.',
    sti: 'games/racer/',
    farve: '#ffd23f',
    art: '<div class="art">' +
         '<img src="assets/kenney/bil_red_1.png" alt="" style="left:6px;top:4px;height:96px;transform:rotate(-14deg)">' +
         '<img src="assets/kenney/bil_blue_2.png" alt="" style="left:52px;top:14px;height:96px;transform:rotate(10deg)">' +
         '</div>'
  },
  {
    id: 'klatbold',
    navn: 'Klatbold',
    tekst: 'To klatter og én bold. Løb, hop og skyd. 1 eller 2 spillere.',
    sti: 'games/klatbold/',
    farve: '#7fd0f5',
    art: '<div class="art">' +
         '<img src="assets/kenney/klat_red.png" alt="" style="left:2px;top:22px;width:78px;clip-path:inset(0 0 50% 0)">' +
         '<img src="assets/kenney/ansigt_a.png" alt="" style="left:14px;top:30px;width:54px">' +
         '<svg viewBox="0 0 40 40" style="position:absolute;left:68px;top:4px;width:38px;height:38px">' +
         '<circle cx="20" cy="20" r="17" fill="#fff" stroke="#12261f" stroke-width="3"/>' +
         '<circle cx="20" cy="20" r="4" fill="#12261f"/><circle cx="20" cy="9" r="3" fill="#12261f"/><circle cx="30" cy="16" r="3" fill="#12261f"/>' +
         '<circle cx="27" cy="29" r="3" fill="#12261f"/><circle cx="13" cy="29" r="3" fill="#12261f"/><circle cx="10" cy="16" r="3" fill="#12261f"/>' +
         '</svg>' +
         '</div>'
  },
  {
    id: 'bobler',
    navn: 'Bobler',
    tekst: 'Skyd boblerne, så de deler sig. Hjælp hinanden. 1 eller 2 spillere.',
    farve: '#ffb38a',
    sti: 'games/bobler/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 40 40" style="position:absolute;left:58px;top:0;width:50px;height:50px">' +
         '<circle cx="20" cy="20" r="17" fill="#3aa7e0" fill-opacity=".85" stroke="#12261f" stroke-width="3"/>' +
         '<ellipse cx="13" cy="12" rx="5" ry="3" fill="#fff" fill-opacity=".6" transform="rotate(-30 13 12)"/></svg>' +
         '<svg viewBox="0 0 40 40" style="position:absolute;left:44px;top:44px;width:30px;height:30px">' +
         '<circle cx="20" cy="20" r="17" fill="#4cb944" fill-opacity=".85" stroke="#12261f" stroke-width="3"/></svg>' +
         '<img src="assets/kenney/dreng_idle.png" alt="" style="left:0;top:22px;height:84px">' +
         '</div>'
  },
  {
    id: 'bogstaver',
    navn: 'ABC og 123',
    tekst: 'Tegn bogstaver, ord og tal med fingeren, eller find det rigtige i boblerne.',
    farve: '#c9ecfb',
    sti: 'games/bogstaver/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 100 100" style="position:absolute;left:4px;top:0;width:100px;height:100px">' +
         '<path d="M20 90L50 10l30 80M32 62h36" fill="none" stroke="#8a8f97" stroke-width="15" stroke-linecap="round" stroke-linejoin="round"/>' +
         '<path d="M20 90L50 10l30 80M32 62h36" fill="none" stroke="rgba(255,255,255,.7)" stroke-width="2" stroke-linecap="round" stroke-dasharray="4 5"/>' +
         '<path d="M20 90L50 10" fill="none" stroke="#ff8c42" stroke-width="15" stroke-linecap="round"/></svg>' +
         '<img src="assets/kenney/bil_lille.png" alt="" style="left:36px;top:2px;height:44px;transform:rotate(20deg)">' +
         '<img src="games/bogstaver/ting/aeble.svg" alt="" style="left:64px;top:56px;width:44px">' +
         '</div>'
  },
  {
    id: 'restaurant',
    navn: 'Restauranten',
    tekst: 'Hent råvarer på gården, lav pizza, burger og pandekager, og tag imod betaling. To kan lave mad sammen.',
    farve: '#ffe0b8',
    sti: 'games/restaurant/',
    art: '<div class="art">' +
         '<img src="assets/noto/pizza.svg" alt="" style="left:0;top:26px;width:74px">' +
         '<img src="assets/noto/bjoern.svg" alt="" style="left:56px;top:0;width:54px">' +
         '<img src="assets/noto/klokke.svg" alt="" style="left:70px;top:64px;width:40px">' +
         '</div>'
  },
  {
    id: 'klokken',
    navn: 'Klokken',
    tekst: 'Rummusen lærer klokken: stil uret på planeterne, find ud af hvad musen gør nu, og drej jorden fra dag til nat.',
    farve: '#c9c4f5',
    sti: 'games/klokken/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 100 100" style="position:absolute;left:0;top:6px;width:88px;height:88px">' +
         '<circle cx="50" cy="50" r="46" fill="#9b5de5" stroke="#12261f" stroke-width="3"/>' +
         '<circle cx="50" cy="50" r="36" fill="#fff" stroke="#12261f" stroke-width="3"/>' +
         '<text x="50" y="24" font-size="11" font-weight="800" text-anchor="middle" fill="#12261f" font-family="ui-rounded,system-ui,sans-serif">12</text>' +
         '<text x="78" y="54" font-size="11" font-weight="800" text-anchor="middle" fill="#12261f" font-family="ui-rounded,system-ui,sans-serif">3</text>' +
         '<text x="50" y="84" font-size="11" font-weight="800" text-anchor="middle" fill="#12261f" font-family="ui-rounded,system-ui,sans-serif">6</text>' +
         '<text x="22" y="54" font-size="11" font-weight="800" text-anchor="middle" fill="#12261f" font-family="ui-rounded,system-ui,sans-serif">9</text>' +
         '<path d="M50 50V24" stroke="#12261f" stroke-width="7" stroke-linecap="round"/><path d="M50 50V24" stroke="#3aa7e0" stroke-width="4" stroke-linecap="round"/>' +
         '<path d="M50 50h18" stroke="#12261f" stroke-width="9" stroke-linecap="round"/><path d="M50 50h18" stroke="#e8442e" stroke-width="6" stroke-linecap="round"/>' +
         '<circle cx="50" cy="50" r="3.5" fill="#12261f"/></svg>' +
         '<img src="assets/noto/mus.svg" alt="" style="left:62px;top:0;width:48px">' +
         '</div>'
  },
  {
    id: 'maskinen',
    navn: 'Maskinen',
    tekst: 'Byg en kædereaktion med ramper, trampoliner og blæsere, så kuglen ruller ned til klokken.',
    farve: '#f2d9a6',
    sti: 'games/maskinen/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 110 110" style="position:absolute;left:0;top:0;width:110px;height:110px">' +
         '<defs><linearGradient id="mtr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#efd9b4"/><stop offset="1" stop-color="#bb9a6e"/></linearGradient>' +
         '<radialGradient id="mku" cx=".35" cy=".3" r=".8"><stop offset="0" stop-color="#e0a18c"/><stop offset="1" stop-color="#a85c48"/></radialGradient></defs>' +
         '<rect x="4" y="17" width="58" height="13" rx="6.5" fill="url(#mtr)" transform="rotate(20 33 23)"/>' +
         '<rect x="44" y="61" width="54" height="13" rx="6.5" fill="url(#mtr)" transform="rotate(-18 71 67)"/>' +
         '<circle cx="18" cy="14" r="10" fill="url(#mku)"/>' +
         '<ellipse cx="15" cy="11" rx="4" ry="3" fill="#fff" opacity=".45"/>' +
         '<path d="M75 96a11 11 0 0 1 22 0z" fill="#e0c49c"/>' +
         '<rect x="72" y="94" width="28" height="6" rx="3" fill="#d2bd9c"/>' +
         '</svg></div>'
  },
  {
    id: 'tegn',
    navn: 'Tegn og pusl',
    tekst: 'Tegn en fisk, en raket eller et hus med fingeren, og saml den som puslespil.',
    farve: '#d9f2c4',
    sti: 'games/tegn/',
    art: '<div class="art">' +
         '<svg viewBox="0 0 100 100" style="position:absolute;left:6px;top:4px;width:100px;height:100px">' +
         '<path d="M72 50L94 30v40z" fill="#ff8c42" stroke="#12261f" stroke-width="4" stroke-linejoin="round"/>' +
         '<ellipse cx="44" cy="50" rx="32" ry="21" fill="#ffb13d" stroke="#12261f" stroke-width="4"/>' +
         '<circle cx="28" cy="45" r="3.4" fill="#12261f"/>' +
         '<path d="M44 29v14c6 0 6 8 0 8v20M12 50h12c0-6 8-6 8 0h12" fill="none" stroke="#12261f" stroke-width="2.5" stroke-dasharray="1 0"/>' +
         '</svg></div>'
  }
];
