/**
 * Bogstaver og tal som streger.
 *
 * Hvert tegn ligger i en kasse paa 100 x 100 (y nedad, som paa skaermen) og
 * bestaar af en eller flere streger i den raekkefoelge og retning, man
 * skriver dem efter dansk grundskrift: lodrette streger nedad, vandrette fra
 * venstre mod hoejre, runde former mod uret (o, c, a, 0), maver ud fra en
 * stamme med uret (b, p, B, D, P, R, 2, 3), og de smaa bogstaver med stamme
 * og bue i én streg, hvor man gaar tilbage op ad stammen. De store bogstaver
 * foelger skriveretningsplakaterne fra skolen: A og Å to streger ned fra
 * toppen og tvaerstregen til sidst (paa Å kommer ringen, med uret, foer
 * tvaerstregen), M og N stammen ned og saa resten i én streg (N slutter op ad
 * hoejre stamme), P og R stammen ned og saa bugen, og R's ben i samme streg
 * som bugen, T stammen foerst og taget bagefter. Kun V, W, U, midten af M og
 * sidste stykke af N gaar opad. Testen holder reglerne.
 * Buer laves med bue(), saa der ikke skal skrives 30 punkter i haanden.
 *
 * Store bogstaver, smaa bogstaver og tal. De smaa staar paa en grundlinje
 * ved y=80 med x-hoejde fra 45, opstreger til 12 og nedstreger til 98.
 * Ingen DOM, saa filen kan testes i Node.
 */
(function (rod) {
  'use strict';

  /** Punkter paa en ellipsebue fra a0 til a1 grader (uret rundt naar a1 > a0, da y peger nedad). */
  function bue(cx, cy, rx, ry, a0, a1) {
    var ud = [];
    var n = Math.max(6, Math.round(Math.abs(a1 - a0) / 10));
    for (var i = 0; i <= n; i++) {
      var a = (a0 + (a1 - a0) * i / n) * Math.PI / 180;
      ud.push([cx + Math.cos(a) * rx, cy + Math.sin(a) * ry]);
    }
    return ud;
  }
  function cirkel(cx, cy, r, a0, a1) { return bue(cx, cy, r, r, a0, a1); }
  function streg() { return Array.prototype.slice.call(arguments); }
  function sammen() {
    var ud = [];
    for (var i = 0; i < arguments.length; i++) ud = ud.concat(arguments[i]);
    return ud;
  }

  var P = cirkel(55, 32, 22, -90, 90);   // bugen paa P og R

  var GLYFFER = {
    A: { tegn: 'A', streger: [streg([50, 10], [20, 90]), streg([50, 10], [80, 90]), streg([32, 62], [68, 62])] },
    B: { tegn: 'B', streger: [streg([25, 10], [25, 90]),
                               sammen([[25, 10], [55, 10]], cirkel(55, 30, 20, -90, 90), [[25, 50], [57, 50]], cirkel(57, 70, 20, -90, 90), [[25, 90]])] },
    C: { tegn: 'C', streger: [cirkel(50, 50, 38, -50, -310)] },
    D: { tegn: 'D', streger: [streg([25, 10], [25, 90]),
                               sammen([[25, 10], [45, 10]], cirkel(45, 50, 40, -90, 90), [[25, 90]])] },
    E: { tegn: 'E', streger: [streg([25, 10], [25, 90], [75, 90]), streg([25, 10], [75, 10]), streg([25, 50], [65, 50])] },
    F: { tegn: 'F', streger: [streg([25, 10], [25, 90]), streg([25, 10], [75, 10]), streg([25, 50], [65, 50])] },
    G: { tegn: 'G', streger: [sammen(cirkel(50, 50, 38, -50, -360), [[56, 50]])] },
    H: { tegn: 'H', streger: [streg([25, 10], [25, 90]), streg([75, 10], [75, 90]), streg([25, 50], [75, 50])] },
    I: { tegn: 'I', streger: [streg([50, 10], [50, 90])] },
    J: { tegn: 'J', streger: [sammen([[65, 10], [65, 70]], cirkel(45, 70, 20, 0, 180))] },
    K: { tegn: 'K', streger: [streg([25, 10], [25, 90]), streg([75, 10], [25, 55]), streg([38, 50], [75, 90])] },
    L: { tegn: 'L', streger: [streg([25, 10], [25, 90], [75, 90])] },
    M: { tegn: 'M', streger: [streg([20, 10], [20, 90]), streg([20, 10], [50, 60], [80, 10], [80, 90])] },
    N: { tegn: 'N', streger: [streg([25, 10], [25, 90]), streg([25, 10], [75, 90], [75, 10])] },
    O: { tegn: 'O', streger: [cirkel(50, 50, 40, -90, -450)] },
    P: { tegn: 'P', streger: [streg([25, 10], [25, 90]), sammen([[25, 10], [55, 10]], P, [[25, 54]])] },
    Q: { tegn: 'Q', streger: [cirkel(50, 50, 40, -90, -450), streg([60, 65], [84, 92])] },
    R: { tegn: 'R', streger: [streg([25, 10], [25, 90]), sammen([[25, 10], [55, 10]], P, [[40, 54], [75, 90]])] },
    S: { tegn: 'S', streger: [sammen(cirkel(50, 30, 20, -40, -270), cirkel(50, 70, 20, -90, 150))] },
    T: { tegn: 'T', streger: [streg([50, 10], [50, 90]), streg([20, 10], [80, 10])] },
    U: { tegn: 'U', streger: [sammen([[25, 10], [25, 60]], cirkel(50, 60, 25, 180, 0), [[75, 10]])] },
    V: { tegn: 'V', streger: [streg([20, 10], [50, 90], [80, 10])] },
    W: { tegn: 'W', streger: [streg([15, 10], [33, 90], [50, 30], [67, 90], [85, 10])] },
    X: { tegn: 'X', streger: [streg([25, 10], [75, 90]), streg([75, 10], [25, 90])] },
    Y: { tegn: 'Y', streger: [streg([25, 10], [50, 50]), streg([75, 10], [50, 50], [50, 90])] },
    Z: { tegn: 'Z', streger: [streg([25, 10], [75, 10], [25, 90], [75, 90])] },
    AE: { tegn: 'Æ', streger: [streg([42, 10], [12, 90]), streg([42, 10], [42, 90]), streg([42, 10], [84, 10]), streg([24, 58], [42, 58], [74, 58]), streg([42, 90], [84, 90])] },
    OE: { tegn: 'Ø', streger: [cirkel(50, 50, 40, -90, -450), streg([76, 14], [24, 86])] },
    AA: { tegn: 'Å', streger: [streg([50, 30], [20, 92]), streg([50, 30], [80, 92]), cirkel(50, 13, 8, -90, 270), streg([33, 70], [67, 70])] },

    0: { tegn: '0', streger: [bue(50, 50, 28, 40, -90, -450)] },
    1: { tegn: '1', streger: [streg([35, 30], [52, 10], [52, 90])] },
    2: { tegn: '2', streger: [sammen(cirkel(50, 32, 22, -160, 50), [[25, 90], [75, 90]])] },
    3: { tegn: '3', streger: [sammen(cirkel(50, 30, 20, -150, 90), cirkel(50, 70, 20, -90, 150))] },
    4: { tegn: '4', streger: [streg([60, 10], [22, 65], [82, 65]), streg([60, 10], [60, 90])] },
    5: { tegn: '5', streger: [sammen([[30, 10], [28, 48], [42, 42]], cirkel(48, 66, 24, -80, 160)), streg([30, 10], [72, 10])] },   // ned og mave, saa hatten fra venstre mod hoejre
    6: { tegn: '6', streger: [sammen([[70, 10], [58, 18], [46, 30], [36, 42], [29, 54]], cirkel(50, 66, 24, -150, -500))] },   // ned ad venstre side og rundt mod uret
    7: { tegn: '7', streger: [streg([25, 10], [75, 10], [42, 90])] },
    8: { tegn: '8', streger: [sammen(cirkel(50, 30, 20, -45, -270), cirkel(50, 70, 22, -90, 270), cirkel(50, 30, 20, 90, -45))] },   // et S fra oeverst til hoejre, og op igen paa den anden side
    9: { tegn: '9', streger: [sammen(cirkel(50, 34, 24, 0, -360), [[74, 34], [58, 90]])] },

    // Smaa bogstaver. Prikker og ringe er smaa cirkler: dem "tegner" man med et tryk.
    // Grundskrift: a, d, g, q, aa er rundt mod uret og saa stammen ned i samme streg; b og p er ned, op ad stammen
    // og maven rundt med uret; h, n, m, r er ned, op ad stammen og over buen; u er ned, rundt, op og ned. Alt i én streg.
    a: { tegn: 'a', streger: [sammen(cirkel(48, 62, 18, -30, -330), [[66, 45], [66, 80]])] },
    b: { tegn: 'b', streger: [sammen([[30, 12], [30, 80], [30, 52]], cirkel(48, 62, 18, -150, 150))] },
    c: { tegn: 'c', streger: [cirkel(50, 62, 18, -45, -315)] },
    d: { tegn: 'd', streger: [sammen(cirkel(50, 62, 18, -30, -330), [[68, 12], [68, 80]])] },
    e: { tegn: 'e', streger: [sammen([[32, 62], [68, 62]], cirkel(50, 62, 18, 0, -300))] },
    f: { tegn: 'f', streger: [sammen(cirkel(58, 22, 12, -90, -180), [[46, 22], [46, 80]]), streg([34, 45], [60, 45])] },
    g: { tegn: 'g', streger: [sammen(cirkel(50, 62, 18, -30, -330), [[68, 45], [68, 86]], cirkel(54, 86, 14, 0, 180))] },
    h: { tegn: 'h', streger: [sammen([[32, 12], [32, 80], [32, 58]], bue(50, 58, 18, 13, -180, 0), [[68, 80]])] },
    i: { tegn: 'i', streger: [streg([50, 45], [50, 80]), cirkel(50, 30, 3, -90, 270)] },
    j: { tegn: 'j', streger: [sammen([[56, 45], [56, 86]], cirkel(44, 86, 12, 0, 180)), cirkel(56, 30, 3, -90, 270)] },
    k: { tegn: 'k', streger: [streg([32, 12], [32, 80]), streg([62, 45], [34, 66]), streg([42, 60], [64, 80])] },
    l: { tegn: 'l', streger: [streg([50, 12], [50, 80])] },
    m: { tegn: 'm', streger: [sammen([[24, 45], [24, 80], [24, 58]], bue(37, 58, 13, 13, -180, 0), [[50, 80], [50, 58]], bue(63, 58, 13, 13, -180, 0), [[76, 80]])] },
    n: { tegn: 'n', streger: [sammen([[32, 45], [32, 80], [32, 58]], bue(50, 58, 18, 13, -180, 0), [[68, 80]])] },
    o: { tegn: 'o', streger: [cirkel(50, 62, 18, -90, -450)] },
    p: { tegn: 'p', streger: [sammen([[32, 45], [32, 98], [32, 52]], cirkel(50, 62, 18, -150, 150))] },
    q: { tegn: 'q', streger: [sammen(cirkel(50, 62, 18, -30, -330), [[68, 45], [68, 98]])] },
    r: { tegn: 'r', streger: [sammen([[36, 45], [36, 80], [36, 58]], bue(52, 58, 16, 13, -180, -60))] },
    s: { tegn: 's', streger: [sammen(cirkel(50, 54, 9, -40, -270), cirkel(50, 72, 9, -90, 150))] },
    t: { tegn: 't', streger: [sammen([[46, 20], [46, 70]], cirkel(56, 70, 10, 180, 90)), streg([34, 45], [60, 45])] },
    u: { tegn: 'u', streger: [sammen([[32, 45], [32, 64]], cirkel(50, 64, 18, 180, 0), [[68, 45], [68, 80]])] },
    v: { tegn: 'v', streger: [streg([32, 45], [50, 80], [68, 45])] },
    w: { tegn: 'w', streger: [streg([24, 45], [37, 80], [50, 52], [63, 80], [76, 45])] },
    x: { tegn: 'x', streger: [streg([32, 45], [68, 80]), streg([68, 45], [32, 80])] },
    y: { tegn: 'y', streger: [streg([32, 45], [50, 80]), streg([68, 45], [44, 98])] },
    z: { tegn: 'z', streger: [streg([32, 45], [68, 45], [32, 80], [68, 80])] },
    ae: { tegn: 'æ', streger: [sammen(cirkel(34, 62, 18, -30, -330), [[52, 45], [52, 80]]), sammen([[50, 62], [84, 62]], cirkel(66, 62, 18, 0, -300))] },
    oe: { tegn: 'ø', streger: [cirkel(50, 62, 18, -90, -450), streg([64, 44], [36, 80])] },
    aa: { tegn: 'å', streger: [sammen(cirkel(48, 66, 16, -30, -330), [[64, 50], [64, 82]]), cirkel(56, 32, 4, -90, 270)] }
  };

  var BOGSTAVER = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', 'AE', 'OE', 'AA'];
  var SMAA = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', 'ae', 'oe', 'aa'];
  var TAL = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

  rod.Glyffer = { GLYFFER: GLYFFER, BOGSTAVER: BOGSTAVER, SMAA: SMAA, TAL: TAL, bue: bue };
})(typeof module !== 'undefined' && module.exports ? module.exports : window);
