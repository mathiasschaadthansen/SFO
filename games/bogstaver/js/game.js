/**
 * Bogstaver.
 *
 * Tre lege: TEGN, hvor man foelger bogstavet med fingeren, FIND, hvor
 * bogstaver svaever rundt i bobler, og man popper det rigtige, og ORD, hvor
 * et helt ord tegnes bogstav for bogstav med billedet af tingen ved siden af.
 * Store bogstaver A-Å, smaa a-å og tallene 0-9.
 *
 * Bogstavernes navne siges med iPad'ens indbyggede danske stemme, hvis der
 * er en installeret lokalt. Ingen netvaerk: kun stemmer med localService.
 *
 * Denne fil er kun skaerm og lyd. Streger ligger i js/glyffer.js og
 * sporingen i js/spor.js.
 */
(function () {
  'use strict';

  var G = Glyffer.GLYFFER;

  if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, b, h, r) {
      r = Math.min(r, b / 2, h / 2);
      this.moveTo(x + r, y);
      this.arcTo(x + b, y, x + b, y + h, r);
      this.arcTo(x + b, y + h, x, y + h, r);
      this.arcTo(x, y + h, x, y, r);
      this.arcTo(x, y, x + b, y, r);
      this.closePath();
    };
  }

  var FARVER = ['#d95f45', '#5f9fc9', '#7ab648', '#f0c46a', '#9b7bd4', '#e08a52'];
  var TOLERANCE = [14, 10, 7];       // pr. stjerne, i kasse-enheder
  var STREGFARVE = '#e08a52';

  var svaerhed = 0;
  var lydTil = true;
  var kategori = 'bogstaver';        // bogstaver | smaa | tal: hvilke tegn der tegnes og findes
  var hvad = 'store';                // store | smaa | ord | tal: den oeverste raekke i menuen
  var stoerrelse = 'bogstaver';      // bogstaver | smaa: ord skrives med den stoerrelse, der sidst blev valgt
  var KOERETOEJER = ['bil', 'raket', 'pensel'];
  var KOERETOEJ_SPRITES = ['../../assets/kenney/bil_lille.png', '../../assets/kenney/raket.png'];
  Sprites.forhent(KOERETOEJ_SPRITES);

  // Tingenes SVG-tegninger hentes én gang. Ligger i cachen, saa det virker offline.
  var billeder = {};
  Object.keys(Ting.TING).forEach(function (n) {
    Ting.TING[n].forEach(function (t) {
      if (!t.fil || billeder[t.fil]) return;
      var img = new Image();
      img.src = t.fil;
      billeder[t.fil] = img;
    });
  });

  // Progression inden for denne omgang, kun i hukommelsen. Spillet skruer
  // selv op naar det gaar godt og ned naar det driller, saa barnet ikke selv
  // skal vaelge svaerhed. Stjernerne er stadig udgangspunktet.
  var flow = 0;                      // TEGN: -1..4, stiger naar et tegn tegnes med faa afveje
  var raekke = 0;                    // FIND: rigtige i traek uden fejl
  var koeretoej = 'bil';             // hvad fingeren koerer med langs bogstavet
  var tegnede = {};                  // tegn der er tegnet i denne omgang -> guldstjerne i gitteret (kun i hukommelsen)

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');

  var tilstand = 'venter';           // venter | tegn | vaelg | find | faerdig  (ORD koerer som tegn med ordet sat)
  var sidsteTid = 0;
  var tid = 0;
  var lyd = null;
  var partikler = [];
  var vinderCanvas = null;
  var konfetti = [];

  // TEGN
  var liste = [];                    // navne paa tegn der skal tegnes, i raekkefoelge
  var plads = 0;
  var spor = null;
  var kasse = { x: 0, y: 0, str: 100 };   // hvor tegnet staar paa skaermen
  var fingerId = null;
  var jubel = 0;                     // sekunder tilbage af jubel efter et faerdigt tegn
  var hint = 0;                      // hvor langt fingerhjaelpen er naaet (0-1)
  var tegnet = 0;                    // hvor mange tegn der er tegnet i denne omgang
  var sidsteNode = -1;               // sidste tone der blev spillet langs stregen
  var koerer = 0;                    // sekunder siden fingeren sidst flyttede koeretoejet (til flammer og stoev)

  // VAELG: hvad starter med bogstavet?
  var kort = [];                     // tre ting: { navn, ting, x, y, str, vip, vendt, drej, rigtig }
  var vaelgNavn = null;              // bogstavet der lige er tegnet
  var vaelgPause = 0;
  var vaelgLoest = false;
  var vaelgKnapR = 40;               // radius paa fluebenet under hvert kort

  // ORD: et helt ord, bogstav for bogstav
  var ordet = null;                  // { ting, kasser: [{ x, y, str }] } mens et ord tegnes, ellers null
  var ordListe = [];                 // tingene der skal tegnes i denne omgang
  var ordPlads = 0;
  var ORD_ANTAL = 6;

  // FIND
  var bobler = [];
  var maal = null;
  var fundet = 0;
  var FIND_ANTAL = 5;
  var findPause = 0;

  /* ---------- lyd og stemme ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state !== 'running') lyd.resume();      // iOS bruger ogsaa 'interrupted', fx efter et opkald
    return lyd;
  }
  // iOS laaser kun lyden op i et rigtigt tryk (touchend eller click), ikke i pointerdown, en timer
  // eller et svar fra fetch. Derfor vaekkes lyden ved hvert tryk, uanset hvad der ellers sker.
  ['touchend', 'click'].forEach(function (type) {
    document.addEventListener(type, function () { try { lydKontekst(); } catch (e) { /* lyd er pynt */ } }, true);
  });

  function tone(frekvens, længde, styrke, type) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      g.gain.value = styrke || 0.16;
      g.gain.exponentialRampToValueAtTime(0.0001, k.currentTime + længde);
      o.connect(g).connect(k.destination);
      o.start();
      o.stop(k.currentTime + længde);
    } catch (e) { /* lyd er pynt */ }
  }

  function melodi(toner, mellemrum) {
    toner.forEach(function (f, i) {
      setTimeout(function () { tone(f, 0.16, 0.14); }, i * mellemrum);
    });
  }

  var stemme = null;
  function findStemme() {
    if (!('speechSynthesis' in window)) return;
    var alle = window.speechSynthesis.getVoices();
    // Kun stemmer der ligger paa enheden — ingen netvaerk
    stemme = alle.filter(function (v) { return v.localService && /^da/i.test(v.lang); })[0] || null;
  }
  if ('speechSynthesis' in window) {
    findStemme();
    window.speechSynthesis.onvoiceschanged = findStemme;
  }

  /**
   * Stemmen er enhedens egen talesyntese (sig). Ligger der rigtige optagelser
   * i lyd/ (lavet med vaerktoej/optag.html og lav-lyd.py, listet i klip.json),
   * bruges de i stedet, afspillet gennem den samme AudioContext som tonerne,
   * saa iOS tillader dem efter det foerste tryk.
   */
  var buffere = {};
  var aktivtKlip = null;
  var afspillet = 0;
  var klipFindes = {};        // filnavne fra lyd/klip.json: rigtige optagelser, hvis der er nogen
  fetch('lyd/klip.json').then(function (r) { return r.ok ? r.json() : []; })
    .then(function (liste) { liste.forEach(function (f) { klipFindes[f] = true; }); })
    .catch(function () { /* ingen klip, enhedens stemme bruges */ });

  function hentKlip(fil) {
    if (!buffere[fil]) {
      buffere[fil] = fetch('lyd/' + fil)
        .then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
        .then(function (ab) {
          return new Promise(function (ok, nej) { lydKontekst().decodeAudioData(ab, ok, nej); });
        });
    }
    return buffere[fil];
  }

  function afspil(fil, reserveTekst) {
    if (!lydTil) return;
    if (!klipFindes[fil]) { sig(reserveTekst); return; }   // ingen optagelse: enhedens stemme
    hentKlip(fil).then(function (buf) {
      var k = lydKontekst();
      if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } }
      var kilde = k.createBufferSource();
      kilde.buffer = buf;
      kilde.connect(k.destination);
      kilde.start();
      aktivtKlip = kilde;
      afspillet++;
    }).catch(function () { sig(reserveTekst); });
  }

  /** Flere klip lige efter hinanden: "to", "plus", "tre". Mangler et af dem, siges ingenting. */
  function afspilRaekke(filer) {
    if (!lydTil) return;
    Promise.all(filer.map(hentKlip)).then(function (buffere) {
      var k = lydKontekst(), start = k.currentTime + 0.02;
      if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* allerede stoppet */ } }
      buffere.forEach(function (buf) {
        var kilde = k.createBufferSource();
        kilde.buffer = buf; kilde.connect(k.destination); kilde.start(start);
        start += buf.duration - 0.04;
        aktivtKlip = kilde;
      });
      afspillet++;
    }).catch(function () { /* lyd er pynt */ });
  }

  function stopKlip() {
    if (aktivtKlip) { try { aktivtKlip.stop(); } catch (e) { /* ignorer */ } aktivtKlip = null; }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* ignorer */ }
  }

  /** Siger navnet paa et tegn: glyf-navn som 'A', 'ae', '7'. */
  function sigNavn(navn) {
    var n = String(navn);
    if (/^\d$/.test(n)) afspil('tal_' + n + '.mp3', n);
    else afspil('bogstav_' + n.toUpperCase() + '.mp3', G[n] ? G[n].tegn : n);
  }
  function sigSpoerg(navn) {
    afspil('spoerg_' + String(navn).toUpperCase() + '.mp3', 'Hvad starter med ' + G[navn].tegn + '?');
  }
  function ordFil(t) {
    return t.fil ? t.fil.replace('ting/', '').replace('.svg', '') : ({ 'xylofon': 'xylofon', 'ål': 'aal' })[t.ord];
  }
  function sigOrd(t) { afspil('ord_' + ordFil(t) + '.mp3', t.ord); }

  function sig(tekst) {
    if (!lydTil || !stemme) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(tekst);
      u.voice = stemme;
      u.lang = stemme.lang;
      u.rate = 0.85;
      window.speechSynthesis.speak(u);
    } catch (e) { /* stemme er pynt */ }
  }

  /* ---------- laerred ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var B = window.innerWidth, H = window.innerHeight;
    kasse.str = standardStr();
    kasse.x = (B - kasse.str) / 2;
    kasse.y = (H - kasse.str) / 2 + H * 0.03;
    if (ordet) laegOrd();
  }

  /** Kassens stoerrelse for ét tegn. Landskab: tegnet fylder hoejden. Portraet (iPhone): tegnet fylder bredden. */
  function standardStr() {
    var B = window.innerWidth, H = window.innerHeight;
    return H > B ? Math.min(B * 0.86, H * 0.5) : Math.min(B * 0.55, H * 0.74);
  }

  /* ---------- tegning af glyffer ---------- */

  /**
   * Tegner et tegn i en kasse. indtil = { aktiv, indeks } tegner kun den del
   * der er tegnet (bruges til den farvede fyldning). spor giver de samplede
   * streger, ellers bruges glyffens egne.
   */
  function tegnGlyf(c, glyf, x, y, str, farve, bredde, indtil, sporet) {
    var streger = sporet ? sporet.streger : glyf.streger;
    c.save();
    c.translate(x, y);
    c.scale(str / 100, str / 100);
    c.strokeStyle = farve;
    c.lineWidth = bredde;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (var s = 0; s < streger.length; s++) {
      var streg = streger[s];
      var til = streg.length - 1;
      if (indtil) {
        if (s > indtil.aktiv) break;
        if (s === indtil.aktiv) til = indtil.indeks;
      }
      if (til < 1 && indtil && s === indtil.aktiv) {
        if (indtil.indeks === 0 && s === indtil.aktiv) continue;
      }
      c.beginPath();
      c.moveTo(streg[0][0], streg[0][1]);
      for (var i = 1; i <= til; i++) c.lineTo(streg[i][0], streg[i][1]);
      c.stroke();
    }
    c.restore();
  }

  /* ---------- partikler og konfetti ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 320) return;
      var v = Math.random() * Math.PI * 2;
      var f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f - fart * 0.3, liv: liv, maxLiv: liv,
        r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }

  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy += 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liv -= dt;
      if (p.liv <= 0) partikler.splice(i, 1);
    }
  }

  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv) * 0.9;
      ctx.fillStyle = p.farve;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function fest(x, y) {
    for (var c = 0; c < 6; c++) puf(x, y, FARVER[c], 12, 320, 5, 1.2);
  }

  /** Fyrvaerkeri over himlen: tre raketter nu og to lidt senere. */
  function fyrvaerkeri() {
    var B = window.innerWidth, H = window.innerHeight;
    function raket() {
      var x = B * (0.15 + Math.random() * 0.7), y = H * (0.1 + Math.random() * 0.3);
      var farve = FARVER[Math.floor(Math.random() * FARVER.length)];
      puf(x, y, farve, 40, 380, 4, 1.4);
      puf(x, y, '#fff', 14, 200, 3, 1.0);
      tone(180 + Math.random() * 120, 0.5, 0.12, 'sine');
    }
    raket(); raket(); raket();
    setTimeout(raket, 500);
    setTimeout(raket, 900);
  }

  /* ---------- TEGN ---------- */

  function startTegn(navne) {
    ordet = null;
    liste = navne;
    plads = 0;
    tegnet = 0;
    tilstand = 'tegn';
    partikler = [];
    tilpasStørrelse();
    nytTegn();
  }

  /** Tolerancen lige nu: stjernerne som udgangspunkt, strammere for hvert trin i flow. */
  function tolerance() {
    var t = TOLERANCE[svaerhed];
    t *= flow < 0 ? 1.3 : Math.pow(0.86, Math.min(3, flow));
    // Ord: kasserne er mindre, saa tolerancen skrues op, og fingeren faar omtrent samme plads paa skaermen
    if (ordet) t = Math.min(26, t * standardStr() / kasse.str);
    return t;
  }

  function nytTegn(stille) {
    if (ordet) laegOrd();
    spor = new Spor(G[liste[plads]], tolerance());
    jubel = 0;
    hint = 0;
    sidsteNode = -1;
    koerer = 0;
    fingerId = null;
    if (!stille) sigNavn(liste[plads]);
  }

  /** Hvor koeretoejet staar lige nu: naeste punkt paa stregen og stregens retning der. */
  function koeretoejPos() {
    var streg = spor.streger[Math.min(spor.aktiv, spor.streger.length - 1)];
    var i = spor.faerdig ? streg.length - 1 : spor.indeks;
    var p = streg[i];
    var q = streg[Math.min(streg.length - 1, i + 3)], o = streg[Math.max(0, i - 3)];
    var v = Math.atan2(q[1] - o[1], q[0] - o[0]);
    return { x: p[0], y: p[1], vinkel: v };
  }

  function kasseKoord(e) {
    var r = lærred.getBoundingClientRect();
    return [(e.clientX - r.left - kasse.x) / kasse.str * 100, (e.clientY - r.top - kasse.y) / kasse.str * 100];
  }

  function tegnNed(e) {
    if (tilstand !== 'tegn' || jubel > 0 || fingerId !== null) return;
    fingerId = e.pointerId;
    var p = kasseKoord(e);
    if (spor.start(p[0], p[1])) tone(440, 0.06, 0.06);
  }

  function tegnFlyt(e) {
    if (tilstand !== 'tegn' || e.pointerId !== fingerId || jubel > 0) return;
    var p = kasseKoord(e);
    var før = spor.andel();
    var aktivFør = spor.aktiv;
    if (spor.holder) spor.flyt(p[0], p[1]);
    else spor.start(p[0], p[1]);         // tag fat igen uden at loefte fingeren
    if (spor.andel() > før) {
      koerer = 0.15;
      var sk = kasse.str / 100;
      var pos = koeretoejPos();
      var px = kasse.x + pos.x * sk, py = kasse.y + pos.y * sk;
      // Spor efter koeretoejet
      if (koeretoej === 'raket') puf(px, py, Math.random() < 0.5 ? '#f0c46a' : '#e08a52', 2, 90, 3, 0.45);
      else if (koeretoej === 'bil') { if (Math.random() < 0.5) puf(px, py, '#cbb382', 1, 50, 3, 0.5); }
      else puf(px, py, 'hsl(' + Math.floor(spor.andel() * 360) + ',85%,60%)', 1, 40, 4, 0.5);
      // Toner der stiger langs stregen, som et instrument
      var streg = spor.streger[Math.min(spor.aktiv, spor.streger.length - 1)];
      var andelStreg = spor.aktiv > aktivFør ? 1 : spor.indeks / (streg.length - 1);
      var node = Math.floor(andelStreg * 8);
      if (node !== sidsteNode) {
        sidsteNode = node;
        var skala = [262, 294, 330, 349, 392, 440, 494, 523, 587];
        tone(skala[Math.min(8, node)], 0.18, 0.1, koeretoej === 'raket' ? 'square' : 'triangle');
      }
      if (spor.aktiv > aktivFør) sidsteNode = -1;
    }
    if (spor.faerdig) tegnFaerdigt();
  }

  function tegnOp(e) {
    if (e.pointerId !== fingerId) return;
    fingerId = null;
    if (spor) spor.slip();
  }

  var aebler = 0;                    // hvor mange aebler der er dukket op under jubel (kun tal)

  function tegnFaerdigt() {
    tegnet++;
    tegnede[liste[plads]] = true;
    // Gik det let? Saa skrues der op naeste gang. Drillede det? Saa ned.
    if (spor.afveje <= 1) flow = Math.min(4, flow + 1);
    else if (spor.afveje >= 4) flow = Math.max(-1, flow - 1);
    if (ordet) { ordBogstavFaerdigt(); return; }
    jubel = 2.4;
    melodi([660, 880, 1100, 1320], 90);
    fest(kasse.x + kasse.str / 2, kasse.y + kasse.str / 2);
    setTimeout(function () { sigNavn(liste[plads]); }, 350);
    if (tegnet % 5 === 0) setTimeout(fyrvaerkeri, 600);

    // Tal: aeblerne dukker op ét ad gangen, og stemmen taeller med
    var n = talVaerdi(liste[plads]);
    aebler = 0;
    if (n > 0) {
      // Hvert talord faar tid til at blive sagt faerdigt (klippene varer op til 0,8 s), foer det naeste aeble kommer
      var takt = 0.95;
      jubel = 1.6 + n * takt + 0.9;
      for (var i = 1; i <= n; i++) {
        (function (k) {
          setTimeout(function () {
            if (tilstand !== 'tegn') return;
            aebler = k;
            tone(440 + k * 60, 0.15, 0.12);
            sigNavn(String(k));
          }, (1.6 + (k - 1) * takt) * 1000);
        })(i);
      }
    }
  }

  function opdaterTegn(dt) {
    hint = (hint + dt * 0.35) % 1;
    koerer = Math.max(0, koerer - dt);
    if (jubel > 0) {
      jubel -= dt;
      if (jubel <= 0) {
        if (ordet) naesteOrdTrin();
        else if (kategori === 'tal') startRegn(parseInt(liste[plads], 10));
        else if (Ting.TING[liste[plads]]) startVaelg(liste[plads]);
        else naesteTegn();
      }
    }
  }

  function naesteTegn() {
    plads++;
    if (plads >= liste.length) afslut('tegn');
    else { tilstand = 'tegn'; nytTegn(); }
  }

  /* ---------- ORD: et helt ord, bogstav for bogstav ---------- */

  function tingNavn(ch) { return ({ 'æ': 'ae', 'ø': 'oe', 'å': 'aa' }[ch] || ch); }

  /** Bogstavnavnene i et ord: smaa i kategorien abc, ellers store (tal tegner ord med store). */
  function ordNavne(ord) {
    return ord.split('').map(function (ch) { return kategori === 'smaa' ? tingNavn(ch) : tingNavn(ch).toUpperCase(); });
  }

  function startOrd() {
    ordListe = bland(Ting.ordKandidater(svaerhed)).slice(0, ORD_ANTAL);
    ordPlads = 0;
    tegnet = 0;
    tilstand = 'tegn';
    regn = null;
    partikler = [];
    nytOrd();
  }

  function nytOrd() {
    var t = ordListe[ordPlads];
    ordet = { ting: t, kasser: [] };
    liste = ordNavne(t.ord);
    plads = 0;
    nytTegn(true);
    // Foerst ordet, saa det foerste bogstav. Ordklippene varer op til et sekund.
    setTimeout(function () { if (ordet && ordet.ting === t) sigOrd(t); }, 300);
    setTimeout(function () { if (ordet && ordet.ting === t && plads === 0 && tilstand === 'tegn') sigNavn(liste[0]); }, 1500);
  }

  /** Ordets kasser paa en raekke midt paa skaermen. kasse saettes til det bogstav, der tegnes nu. */
  function laegOrd() {
    var B = window.innerWidth, H = window.innerHeight;
    var n = liste.length, gab = 0.8;   // kasserne overlapper lidt, som naar ordet skrives i tegnOrd
    function stoerrelse(prRaekke, raekker) {
      return Math.min(standardStr() * 0.9, (B - 70) / (gab * (prRaekke - 1) + 1), H * 0.46 / raekker);
    }
    var raekker = 1, s = stoerrelse(n, 1);
    // Paa en smal skaerm bliver kasserne for smaa til en finger: saa deles ordet i to raekker
    if (s < 96 && n > 2) { raekker = 2; s = stoerrelse(Math.ceil(n / 2), 2); }
    var prRaekke = Math.ceil(n / raekker);
    // Landskab: raekken staar under skyen. Portraet: midt paa skaermen, saa der ikke bliver et stort hul.
    var midte = H > B ? H * 0.52 : H * 0.6;
    ordet.kasser = liste.map(function (_, i) {
      var r = Math.floor(i / prRaekke), j = i % prRaekke;
      var iRaekken = Math.min(prRaekke, n - r * prRaekke);
      var x0 = (B - s * (gab * (iRaekken - 1) + 1)) / 2;
      return { x: x0 + j * s * gab, y: midte - s / 2 + (r - (raekker - 1) / 2) * s * 1.1, str: s };
    });
    var k = ordet.kasser[Math.min(plads, n - 1)];
    kasse.x = k.x; kasse.y = k.y; kasse.str = k.str;
  }

  function ordBogstavFaerdigt() {
    fest(kasse.x + kasse.str / 2, kasse.y + kasse.str / 2);
    if (plads < liste.length - 1) {
      jubel = 0.8;
      melodi([660, 880], 80);
      return;
    }
    // Hele ordet staar der: stemmen siger det, og der er fest
    jubel = 3.0;
    melodi([660, 880, 1100, 1320], 90);
    setTimeout(function () { if (ordet) sigOrd(ordet.ting); }, 400);
    setTimeout(function () { if (ordet) fyrvaerkeri(); }, 700);
  }

  function naesteOrdTrin() {
    if (plads < liste.length - 1) { plads++; nytTegn(); return; }
    ordPlads++;
    if (ordPlads >= ordListe.length) afslut('ord');
    else nytOrd();
  }

  /** Billedet af ordets ting i en sky oeverst, saa man kan se, hvad man skriver. */
  function tegnOrdSky() {
    var B = window.innerWidth, H = window.innerHeight;
    var ms = Math.min(B, H) * 0.16;
    var hop = jubel > 0 && plads >= liste.length - 1 ? Math.abs(Math.sin(jubel * 6)) * 8 : 0;
    ctx.fillStyle = '#f8f1e6'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(B / 2 - ms * 0.7, 40 - hop, ms * 1.4, ms * 1.25, 24); ctx.fill(); ctx.stroke();
    tegnTing(ordet.ting, B / 2, 40 - hop + ms * 0.62, ms * 0.9);
  }

  /** Ord: de andre bogstaver i ordet. Faerdige i farve, kommende som blege skabeloner. */
  function tegnOrdRundtOm() {
    var skabelon = koeretoej === 'bil' ? '#a9a396' : (koeretoej === 'raket' ? 'rgba(255,255,255,0.22)' : '#e7ddc8');
    ordet.kasser.forEach(function (k, i) {
      if (i === plads) return;
      var glyf = G[liste[i]];
      if (i >= plads) { tegnGlyf(ctx, glyf, k.x, k.y, k.str, skabelon, 13); return; }
      if (koeretoej === 'pensel') tegnRegnbue(glyf.streger.map(Spor.sampl), k.x, k.y, k.str, null);
      else tegnGlyf(ctx, glyf, k.x, k.y, k.str, koeretoej === 'raket' ? '#f0c46a' : STREGFARVE, 13);
    });
  }

  /* ---------- VAELG: hvad starter med bogstavet? ---------- */

  function startVaelg(navn) {
    tilstand = 'vaelg';
    regn = null;
    vaelgNavn = navn;
    vaelgLoest = false;
    vaelgPause = 0.6;
    // Én ting der starter med bogstavet, og to fra andre bogstaver. Tingene
    // vaelges tilfaeldigt blandt bogstavets ting, saa det ikke altid er bold ved B.
    var andre = bland(navneI(kategori).filter(function (n) { return n !== navn && Ting.TING[n]; })).slice(0, 2);
    var navne = bland([navn].concat(andre));
    var B = window.innerWidth, H = window.innerHeight;
    var str = Math.min(B * 0.3, H * 0.34, 260);
    var gab = Math.min(34, B * 0.03);
    kort = navne.map(function (n, i) {
      return { navn: n, ting: Ting.vaelg(n), x: B / 2 + (i - 1) * (str + gab), y: H * 0.52, str: str, vip: 0, vendt: 0, drej: 0, rigtig: n === navn };
    });
    vaelgKnapR = Math.max(30, Math.min(44, str * 0.19));
    setTimeout(function () { if (tilstand === 'vaelg') sigSpoerg(navn); }, 300);
  }

  /** Skyen med bogstavet oeverst: hvor den staar, saa et tryk paa den kan gentage spoergsmaalet. */
  function skyRect() {
    var B = window.innerWidth, H = window.innerHeight;
    var ms = Math.min(B, H) * 0.14;
    return { x: B / 2 - ms * 0.75, y: 44, b: ms * 1.5, h: ms * 1.2, ms: ms };
  }

  /** Fluebenet sidder under kortet. */
  function knapY(k) { return k.y + k.str / 2 + 14 + vaelgKnapR; }

  /* ---------- REGN: et regnestykke, hvor svaret er det tal, man lige har tegnet ---------- */

  var regn = null;      // { a, b, op, svar, hjaelp } mens et regnestykke er fremme, ellers null

  function startRegn(svar) {
    tilstand = 'vaelg';
    vaelgNavn = String(svar);
    vaelgLoest = false;
    vaelgPause = 0.6;
    regn = Regn.opgave(svar, svaerhed);
    regn.hjaelp = svaerhed < 2;          // 3 stjerner: aeblerne kommer foerst frem efter et forkert svar
    var B = window.innerWidth, H = window.innerHeight;
    var str = Math.min(B * 0.22, H * 0.3, 200);
    var gab = Math.min(34, B * 0.03);
    kort = Regn.valg(svar).map(function (n, i) {
      return { navn: String(n), tal: n, x: B / 2 + (i - 1) * (str + gab), y: H * 0.74, str: str, vip: 0, rigtig: n === svar };
    });
    setTimeout(function () { if (tilstand === 'vaelg' && regn) sigRegn(regn); }, 300);
  }

  /** "to plus tre": med klip, hvis plus og minus er indtalt, ellers siger enhedens stemme hele stykket. */
  function sigRegn(o) {
    var op = o.op === '+' ? 'plus.mp3' : 'minus.mp3';
    if (klipFindes[op]) afspilRaekke(['tal_' + o.a + '.mp3', op, 'tal_' + o.b + '.mp3'].concat(klipFindes['er_lig_med.mp3'] ? ['er_lig_med.mp3'] : []));
    else sig(o.a + (o.op === '+' ? ' plus ' : ' minus ') + o.b);
  }

  function regnTryk(k) {
    if (k.rigtig) {
      vaelgLoest = true;
      sigNavn(k.navn);
      melodi([660, 880, 1100, 1320], 90);
      fest(k.x, k.y);
      setTimeout(function () { if (tilstand === 'vaelg' && regn) { regn = null; naesteTegn(); } }, 3000);
    } else {
      k.vip = 0.7;
      regn.hjaelp = true;                // forkert: ingen straf, men aeblerne kommer frem, saa man kan taelle
      melodi([880, 1046], 70);
    }
  }

  function tegnRegnSkaerm() {
    var B = window.innerWidth, H = window.innerHeight;
    var hh = Math.min(H * 0.2, B * 0.11);                 // taloejde i stykket
    var trin = hh * 1.15, y0 = Math.max(60, H * 0.1);
    var dele = [String(regn.a), regn.op, String(regn.b), '=', vaelgLoest ? String(regn.svar) : '?'];
    var bred = dele.length * trin, x0 = B / 2 - bred / 2;
    ctx.fillStyle = '#f8f1e6'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(x0 - hh * 0.3, y0 - hh * 0.2, bred + hh * 0.6, hh * (regn.hjaelp ? 2.15 : 1.4), 26); ctx.fill(); ctx.stroke();
    dele.forEach(function (d, i) {
      var cx = x0 + (i + 0.5) * trin, cy = y0 + hh / 2;
      ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = Math.max(5, hh * 0.09); ctx.lineCap = 'round';
      if (G[d]) tegnGlyf(ctx, G[d], cx - hh / 2, y0, hh, i === 4 ? '#e08a52' : '#5e4a3a', 11);
      else if (d === '?') {
        var p = 1 + Math.sin(tid * 5) * 0.06;
        ctx.strokeStyle = '#e08a52'; ctx.setLineDash([hh * 0.12, hh * 0.12]);
        ctx.beginPath(); ctx.roundRect(cx - hh * 0.36 * p, cy - hh * 0.42 * p, hh * 0.72 * p, hh * 0.84 * p, 14); ctx.stroke(); ctx.setLineDash([]);
      } else {
        var l = hh * 0.24;
        ctx.beginPath();
        if (d === '=') { ctx.moveTo(cx - l, cy - l * 0.45); ctx.lineTo(cx + l, cy - l * 0.45); ctx.moveTo(cx - l, cy + l * 0.45); ctx.lineTo(cx + l, cy + l * 0.45); }
        else { ctx.moveTo(cx - l, cy); ctx.lineTo(cx + l, cy); if (d === '+') { ctx.moveTo(cx, cy - l); ctx.lineTo(cx, cy + l); } }
        ctx.stroke();
      }
    });
    // Aebler at taelle paa. Plus: en bunke under hvert tal. Minus: alle aeblerne, og dem der traekkes fra, er streget over.
    if (regn.hjaelp) {
      var ay = y0 + hh * 1.5, r = Math.min(hh * 0.17, trin * 1.8 / (Math.max(regn.a, regn.b, 1) * 2.6));
      if (regn.op === '+') {
        tegnMaengde(ctx, regn.a, x0 + trin * 0.5, ay, r, undefined, true);
        tegnMaengde(ctx, regn.b, x0 + trin * 2.5, ay, r, undefined, true);
      } else {
        var n = regn.a, rr = Math.min(r, trin * 3 / n / 2.6);
        for (var i = 0; i < n; i++) {
          var ax = x0 + trin * 1.5 + (i - (n - 1) / 2) * rr * 2.6, vaek = i >= n - regn.b;
          ctx.globalAlpha = vaek ? 0.4 : 1; tegnAeble(ctx, ax, ay, rr); ctx.globalAlpha = 1;
          if (vaek) {
            ctx.strokeStyle = '#d95f45'; ctx.lineWidth = Math.max(3, rr * 0.3); ctx.lineCap = 'round';
            ctx.beginPath(); ctx.moveTo(ax - rr, ay - rr); ctx.lineTo(ax + rr, ay + rr); ctx.moveTo(ax + rr, ay - rr); ctx.lineTo(ax - rr, ay + rr); ctx.stroke();
          }
        }
      }
    }
    // Svarkortene
    kort.forEach(function (k) {
      ctx.save();
      ctx.translate(k.x, k.y);
      if (k.vip > 0) ctx.rotate(Math.sin(k.vip * 40) * 0.12);
      if (vaelgLoest && k.rigtig) ctx.scale(1 + Math.sin(tid * 8) * 0.04, 1 + Math.sin(tid * 8) * 0.04);
      ctx.globalAlpha = vaelgLoest && !k.rigtig ? 0.4 : 1;
      ctx.fillStyle = vaelgLoest && k.rigtig ? '#f0c46a' : '#f8f1e6'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(-k.str / 2, -k.str / 2, k.str, k.str, 26); ctx.fill(); ctx.stroke();
      tegnGlyf(ctx, G[k.navn], -k.str * 0.32, -k.str * 0.32, k.str * 0.64, '#5e4a3a', 11);
      ctx.restore();
    });
    ctx.globalAlpha = 1;
  }

  function opdaterVaelg(dt) {
    vaelgPause = Math.max(0, vaelgPause - dt);
    kort.forEach(function (k) {
      k.vip = Math.max(0, k.vip - dt);
      // Kortet drejer om sin lodrette akse, naar det vendes
      var maal = k.vendt || 0;
      if (k.drej < maal) k.drej = Math.min(maal, k.drej + dt * 4);
      else if (k.drej > maal) k.drej = Math.max(maal, k.drej - dt * 4);
    });
  }

  /**
   * Spoergsmaalet stilles foerst. Saa maa man vende kortene, saa tit man vil:
   * billede paa den ene side, ordet paa den anden. Svaret gives med fluebenet
   * under et kort. Saa er det at lytte og kigge, ikke at trykke sig frem.
   */
  function vaelgTryk(e) {
    if (tilstand !== 'vaelg' || vaelgPause > 0 || vaelgLoest) return;
    var r = lærred.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    var i, k;
    if (regn) {
      for (i = 0; i < kort.length; i++) {
        k = kort[i];
        if (Math.abs(x - k.x) < k.str / 2 && Math.abs(y - k.y) < k.str / 2) { regnTryk(k); return; }
      }
      return;
    }
    // Skyen med bogstavet: hoer spoergsmaalet igen
    var sky = skyRect();
    if (x > sky.x - 10 && x < sky.x + sky.b + 10 && y > sky.y - 10 && y < sky.y + sky.h + 10) { sigSpoerg(vaelgNavn); return; }
    for (i = 0; i < kort.length; i++) {
      k = kort[i];
      if (Math.hypot(x - k.x, y - knapY(k)) < vaelgKnapR * 1.3) { vaelgSvar(k); return; }
      if (Math.abs(x - k.x) < k.str / 2 && Math.abs(y - k.y) < k.str / 2) {
        k.vendt = k.vendt ? 0 : 1;
        tone(k.vendt ? 520 : 440, 0.06, 0.06);
        if (k.vendt) sigOrd(k.ting);
        return;
      }
    }
  }

  function vaelgSvar(k) {
    sigOrd(k.ting);
    if (k.rigtig) {
      vaelgLoest = true;
      k.vendt = 0;                       // billedet frem, ordet staar stort nedenunder
      melodi([660, 880, 1100, 1320], 90);
      fest(k.x, knapY(k));
      setTimeout(naesteTegn, 3400);      // tid til at hoere og se ordet
    } else {
      k.vip = 0.7;
      k.vendt = 1;                       // ordet vises, saa man kan se det starter med noget andet
      melodi([880, 1046], 70);
      vaelgPause = 1.2;
      setTimeout(function () { if (tilstand === 'vaelg' && !vaelgLoest && !regn) sigSpoerg(vaelgNavn); }, 1700);
    }
  }

  /** En ting (SVG, ellers tegningen i kode) centreret om (cx, cy). str er billedets bredde. */
  function tegnTing(t, cx, cy, str) {
    var img = t.fil && billeder[t.fil];
    ctx.save();
    ctx.translate(cx, cy);
    if (img && img.complete && img.naturalWidth > 0) {
      ctx.drawImage(img, -str / 2, -str / 2, str, str);
    } else if (t.tegn) {
      ctx.scale(str / 80, str / 80);
      ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      t.tegn(ctx);
    } else {
      // Billedet er ikke hentet endnu: en blid plads-holder
      ctx.fillStyle = '#e7ddc8';
      ctx.beginPath(); ctx.arc(0, 0, str * 0.4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  /** Groent flueben i en cirkel: knappen man svarer med. */
  function tegnFlueben(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#7ab648'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = '#f8f1e6'; ctx.lineWidth = r * 0.24; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(-r * 0.45, 0.02 * r); ctx.lineTo(-r * 0.12, r * 0.34); ctx.lineTo(r * 0.48, -r * 0.32); ctx.stroke();
    ctx.restore();
  }

  /** Lille hoejttaler i skyens hjoerne: her kan man hoere spoergsmaalet igen. */
  function tegnHoejttaler(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5e4a3a';
    ctx.beginPath(); ctx.moveTo(-s, -s * 0.35); ctx.lineTo(-s * 0.4, -s * 0.35); ctx.lineTo(s * 0.2, -s); ctx.lineTo(s * 0.2, s); ctx.lineTo(-s * 0.4, s * 0.35); ctx.lineTo(-s, s * 0.35); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = s * 0.22; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(s * 0.3, 0, s * 0.7, -0.9, 0.9); ctx.stroke();
    ctx.restore();
  }

  /** Et ord skrevet med spillets egne streger, centreret om (cx, cy). Store eller smaa efter kategori. */
  function tegnOrd(ord, cx, cy, hoejde, fremhaev) {
    var bogstaver = ord.split('').map(function (ch) { return kategori === 'smaa' ? tingNavn(ch) : tingNavn(ch).toUpperCase(); });
    var b = hoejde * 0.72;
    var x0 = cx - bogstaver.length * b / 2;
    bogstaver.forEach(function (n, i) {
      if (G[n]) tegnGlyf(ctx, G[n], x0 + i * b, cy - hoejde / 2, hoejde, fremhaev && i === 0 ? fremhaev : '#5e4a3a', fremhaev ? 11 : 9);
    });
  }

  function tegnVaelgSkaerm() {
    var B = window.innerWidth, H = window.innerHeight;
    // Bogstavet i en sky oeverst, som i Find. Et tryk paa skyen gentager spoergsmaalet.
    var sky = skyRect(), ms = sky.ms;
    ctx.fillStyle = '#f8f1e6'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(sky.x, sky.y, sky.b, sky.h, 24); ctx.fill(); ctx.stroke();
    tegnGlyf(ctx, G[vaelgNavn], B / 2 - ms / 2, 50 + ms * 0.1, ms, STREGFARVE, 12);
    tegnHoejttaler(sky.x + sky.b - 22, sky.y + sky.h - 20, 9);

    kort.forEach(function (k) {
      var t = k.ting;
      var ordSide = k.drej >= 0.5;
      ctx.save();
      ctx.translate(k.x, k.y);
      if (k.vip > 0) ctx.rotate(Math.sin(k.vip * 40) * 0.12);
      if (vaelgLoest && k.rigtig) ctx.scale(1 + Math.sin(tid * 8) * 0.04, 1 + Math.sin(tid * 8) * 0.04);
      ctx.scale(Math.max(0.03, Math.abs(Math.cos(k.drej * Math.PI))), 1);   // vendes om den lodrette akse
      ctx.fillStyle = vaelgLoest && k.rigtig ? '#f0c46a' : (ordSide ? '#fdf3d9' : '#f8f1e6');
      ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(-k.str / 2, -k.str / 2, k.str, k.str, 24); ctx.fill(); ctx.stroke();
      if (ordSide) tegnOrd(t.ord, 0, 0, Math.min(k.str * 0.3, k.str * 0.95 / (t.ord.length * 0.72 + 0.4)), '#e08a52');
      else tegnTing(t, 0, 0, k.str * 0.62);
      ctx.restore();
      if (!vaelgLoest) tegnFlueben(k.x, knapY(k), vaelgKnapR);
    });
    // Rigtigt svar: ordet staar stort paa skaermen med forbogstavet i farve, mens stemmen siger det
    if (vaelgLoest) {
      var rigtig = kort.filter(function (k) { return k.rigtig; })[0];
      if (rigtig) {
        var ord = rigtig.ting.ord, hh = Math.min(H * 0.12, B * 0.8 / (ord.length * 0.72 + 1));
        var bb = ord.length * hh * 0.72 + hh * 0.9, yy = H - hh * 1.6 - 12;
        ctx.fillStyle = '#f8f1e6'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.roundRect(B / 2 - bb / 2, yy, bb, hh * 1.6, 26); ctx.fill(); ctx.stroke();
        tegnOrd(ord, B / 2, yy + hh * 0.8, hh, '#e08a52');
      }
    }
  }

  /** Koeretoejet, tegnet omkring (0,0) med fronten mod +x, i kasse-enheder. */
  function tegnKoeretoej(c, hvad, iGang, andel) {
    c.strokeStyle = '#5e4a3a';
    c.lineWidth = 1.6;
    // Sprites fra Kenney for bil og raket. De peger opad, koeretoejet koerer mod +x.
    if (hvad === 'bil' || hvad === 'raket') {
      var img = Sprites.hent('../../assets/kenney/' + (hvad === 'bil' ? 'bil_lille' : 'raket') + '.png');
      if (Sprites.venter(img)) return;   // paa vej: tegn ingenting, saa den gamle tegning ikke blinker frem
      if (Sprites.klar(img)) {
        if (hvad === 'raket' && iGang) {
          c.fillStyle = '#e08a52';
          c.beginPath(); c.moveTo(-10, -3); c.lineTo(-18 - Math.random() * 6, 0); c.lineTo(-10, 3); c.closePath(); c.fill();
        }
        var l = hvad === 'bil' ? 26 : 28;
        var sk = l / img.naturalHeight, w = img.naturalWidth * sk;
        c.save();
        c.rotate(Math.PI / 2);
        c.drawImage(img, -w / 2, -l / 2, w, l);
        c.restore();
        return;
      }
    }
    if (hvad === 'bil') {
      c.fillStyle = '#5e4a3a';
      c.fillRect(-7, -6.5, 4, 13); c.fillRect(3, -6.5, 4, 13);
      c.fillStyle = '#d95f45';
      c.beginPath(); c.roundRect(-9, -5, 18, 10, 3.5); c.fill(); c.stroke();
      c.fillStyle = '#f0c46a';
      c.beginPath(); c.roundRect(-2, -3, 6, 6, 2); c.fill();
      if (iGang) { c.fillStyle = '#f0c46a'; c.beginPath(); c.arc(9.5, -3, 1.4, 0, Math.PI * 2); c.arc(9.5, 3, 1.4, 0, Math.PI * 2); c.fill(); }
    } else if (hvad === 'raket') {
      if (iGang) {
        c.fillStyle = '#e08a52';
        c.beginPath(); c.moveTo(-8, -3); c.lineTo(-16 - Math.random() * 5, 0); c.lineTo(-8, 3); c.closePath(); c.fill();
      }
      c.fillStyle = '#f8f1e6';
      c.beginPath(); c.moveTo(11, 0); c.lineTo(3, -5); c.lineTo(-8, -5); c.lineTo(-8, 5); c.lineTo(3, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#d95f45';
      c.beginPath(); c.moveTo(-8, -5); c.lineTo(-12, -9); c.lineTo(-5, -5); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-8, 5); c.lineTo(-12, 9); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#5f9fc9';
      c.beginPath(); c.arc(1, 0, 2.6, 0, Math.PI * 2); c.fill(); c.stroke();
    } else {
      c.save();
      c.rotate(-Math.PI / 4);
      c.fillStyle = '#b9874f';
      c.beginPath(); c.roundRect(-4, -2, 20, 4, 2); c.fill(); c.stroke();
      c.fillStyle = '#ddd4c0';
      c.beginPath(); c.roundRect(-11, -3.5, 8, 7, 1.5); c.fill(); c.stroke();
      c.fillStyle = 'hsl(' + Math.floor((andel || 0) * 360) + ',85%,60%)';
      c.beginPath(); c.arc(-12, 0, 3.5, 0, Math.PI * 2); c.fill();
      c.restore();
    }
  }

  /** Oejne og smil paa det faerdige tegn, saa det bliver levende. */
  function tegnAnsigt(glyf, s) {
    var minX = 100, maxX = 0, minY = 100, maxY = 0;
    glyf.streger.forEach(function (st) { st.forEach(function (p) {
      minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0]); minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1]);
    }); });
    var sk = s / 100;
    var cx = kasse.x + (minX + maxX) / 2 * sk, cy = kasse.y + (minY + (maxY - minY) * 0.42) * sk;
    var hop = Math.abs(Math.sin(jubel * 6)) * 6;
    ctx.save();
    ctx.translate(cx, cy - hop);
    [-1, 1].forEach(function (d) {
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(d * 9 * sk, 0, 7 * sk, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#5e4a3a';
      ctx.beginPath(); ctx.arc(d * 9 * sk + 1.5 * sk, 1.5 * sk, 3 * sk, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 8 * sk, 8 * sk, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }

  /** Regnbue til penslen: hver streg i sin egen farve, og farven glider undervejs. indtil = null tegner alt. */
  function tegnRegnbue(streger, x, y, s, indtil) {
    var sk = s / 100;
    ctx.save();
    var alleN = streger.reduce(function (a, st) { return a + st.length; }, 0), talt = 0;
    streger.forEach(function (streg, si) {
      if (indtil && si > indtil.aktiv) return;
      var til = indtil && si === indtil.aktiv ? indtil.indeks : streg.length - 1;
      ctx.lineWidth = 13 * sk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      for (var i = 1; i <= til; i++) {
        ctx.strokeStyle = 'hsl(' + Math.floor((talt + i) / alleN * 360) + ',85%,60%)';
        ctx.beginPath();
        ctx.moveTo(x + streg[i - 1][0] * sk, y + streg[i - 1][1] * sk);
        ctx.lineTo(x + streg[i][0] * sk, y + streg[i][1] * sk);
        ctx.stroke();
      }
      talt += streg.length;
    });
    ctx.restore();
  }

  function tegnTegnSkaerm() {
    var glyf = G[liste[plads]];
    var s = kasse.str, sk = s / 100;
    var bredde = 13;
    // Pladen daekker ét tegn, eller hele ordet naar et ord tegnes
    var pladeX = kasse.x, pladeY = kasse.y, pladeB = s, pladeH = s;
    if (ordet) {
      var x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
      ordet.kasser.forEach(function (k) { x1 = Math.min(x1, k.x); y1 = Math.min(y1, k.y); x2 = Math.max(x2, k.x + k.str); y2 = Math.max(y2, k.y + k.str); });
      pladeX = x1; pladeY = y1; pladeB = x2 - x1; pladeH = y2 - y1;
    }
    // Baggrundsplade: lys for bil og pensel, moerk stjernehimmel for raketten
    ctx.fillStyle = koeretoej === 'raket' ? '#2a3358' : '#f8f1e6';
    ctx.strokeStyle = '#5e4a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(pladeX - 24, pladeY - 24, pladeB + 48, pladeH + 48, 30);
    ctx.fill();
    ctx.stroke();
    if (koeretoej === 'raket') {
      ctx.fillStyle = '#f8f1e6';
      for (var st = 0; st < 30; st++) {
        var sx0 = pladeX + ((st * 137) % 100) / 100 * pladeB, sy0 = pladeY + ((st * 71) % 100) / 100 * pladeH;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(tid * 2 + st));
        ctx.beginPath(); ctx.arc(sx0, sy0, 1.5 + (st % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
    if (ordet) tegnOrdSky();

    // Jubel: tegnet hopper og vipper. Sidste bogstav i et ord: hele ordet hopper.
    var sidsteIOrd = ordet && plads >= liste.length - 1;
    ctx.save();
    if (jubel > 0) {
      var cx = sidsteIOrd ? pladeX + pladeB / 2 : kasse.x + s / 2, cy = sidsteIOrd ? pladeY + pladeH / 2 : kasse.y + s / 2;
      ctx.translate(cx, cy);
      ctx.rotate(Math.sin(jubel * 14) * (sidsteIOrd ? 0.03 : 0.08));
      ctx.scale(1 + Math.sin(jubel * 7) * 0.04, 1 + Math.sin(jubel * 7) * 0.04);
      ctx.translate(-cx, -cy);
    }
    if (ordet) tegnOrdRundtOm();
    // Skabelon: en vej for bilen, en stjernebane for raketten, et blegt strøg for penslen
    var skabelon = koeretoej === 'bil' ? '#a9a396' : (koeretoej === 'raket' ? 'rgba(255,255,255,0.22)' : '#e7ddc8');
    tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, skabelon, bredde);
    if (koeretoej === 'bil') {
      ctx.save(); ctx.setLineDash([4 * sk, 5 * sk]);
      tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, 'rgba(255,255,255,0.7)', 1.6);
      ctx.restore();
    }
    // Det der er tegnet
    var indtil = spor.faerdig ? null : { aktiv: spor.aktiv, indeks: spor.indeks };
    if (koeretoej === 'pensel') {
      tegnRegnbue(spor.streger, kasse.x, kasse.y, s, indtil);
    } else {
      tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, koeretoej === 'raket' ? '#f0c46a' : STREGFARVE, bredde, indtil, spor);
      if (koeretoej === 'bil') {
        // Hjulspor oven paa den koerte vej
        ctx.save(); ctx.setLineDash([3 * sk, 4 * sk]);
        tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, 'rgba(94,74,58,0.35)', 1.4, indtil, spor);
        ctx.restore();
      }
    }
    if (jubel > 0) tegnAnsigt(glyf, s);
    ctx.restore();

    // Tal: maengden vises i bunden af pladen, mens der taelles
    if (jubel > 0 && talVaerdi(liste[plads]) >= 0) {
      tegnMaengde(ctx, talVaerdi(liste[plads]), kasse.x + s / 2, kasse.y + s + 8, s * 0.045, aebler, true);
    }

    if (spor.faerdig || jubel > 0) return;

    var streg = spor.streger[spor.aktiv];
    // Fingerhjaelp: en prik der loeber langs resten af stregen. Forsvinder naar det gaar godt.
    if (svaerhed < 2 && flow < 2) {
      var fra = spor.indeks, n = streg.length - 1 - fra;
      if (n > 0) {
        var hp = streg[fra + Math.floor(hint * n)];
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.strokeStyle = '#5e4a3a';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(kasse.x + hp[0] * sk, kasse.y + hp[1] * sk, 5 * sk * 0.9, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
    // Maalflag for enden af stregen
    var slut = streg[streg.length - 1];
    ctx.save();
    ctx.translate(kasse.x + slut[0] * sk, kasse.y + slut[1] * sk);
    ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * sk * 0.9); ctx.stroke();
    for (var r = 0; r < 2; r++) for (var k = 0; k < 3; k++) {
      ctx.fillStyle = (r + k) % 2 ? '#5e4a3a' : '#f8f1e6';
      ctx.fillRect(k * 3.5 * sk, -16 * sk * 0.9 + r * 3.5 * sk, 3.5 * sk, 3.5 * sk);
    }
    ctx.restore();

    // Koeretoejet staar der hvor fingeren er naaet til. Naar det ikke koerer,
    // vipper det lidt, saa man kan se det er her, man skal tage fat.
    var pos = koeretoejPos();
    var puls = spor.holder ? 1 : 1 + Math.sin(tid * 5) * 0.08;
    if (!spor.holder) {
      ctx.fillStyle = 'rgba(76,185,68,0.55)';
      ctx.beginPath();
      ctx.arc(kasse.x + pos.x * sk, kasse.y + pos.y * sk, 13 * sk * puls, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(kasse.x + pos.x * sk, kasse.y + pos.y * sk);
    ctx.rotate(pos.vinkel);
    ctx.scale(sk * 0.75 * puls, sk * 0.75 * puls);
    tegnKoeretoej(ctx, koeretoej, koerer > 0, spor.andel());
    ctx.restore();
  }

  /** Hvor mange tegn der er tegnet i denne omgang, som prikker. */
  function tegnFremskridt(antal, gjort) {
    var B = window.innerWidth;
    var y = 28;
    var vis = Math.min(antal, 12);
    // Paa en smal skaerm (iPhone i portraet) skal prikkerne holde sig fri af
    // hjem-knappen til venstre og stjernerne til hoejre.
    var afstand = Math.min(26, (B - 230) / vis);
    var r = Math.min(8, afstand * 0.4);
    for (var i = 0; i < vis; i++) {
      var x = B / 2 + (i - (vis - 1) / 2) * afstand;
      var fyldt = antal <= 12 ? i < gjort : i < Math.round(gjort / antal * vis);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = fyldt ? '#f0c46a' : 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#5e4a3a';
      ctx.stroke();
    }
  }

  /* ---------- FIND ---------- */

  function navneI(kat) {
    return kat === 'tal' ? Glyffer.TAL.slice() : (kat === 'smaa' ? Glyffer.SMAA.slice() : Glyffer.BOGSTAVER.slice());
  }

  /** Vaerdien af et tal-tegn, ellers -1. */
  function talVaerdi(navn) { return kategori === 'tal' ? parseInt(navn, 10) : -1; }

  /** Et aeble tegnet i kode: roed cirkel med stilk og blad. */
  function tegnAeble(c, x, y, r) {
    c.fillStyle = '#d95f45';
    c.strokeStyle = '#5e4a3a';
    c.lineWidth = Math.max(2, r * 0.12);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.15, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#5e4a3a'; c.lineWidth = Math.max(2, r * 0.14); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y - r * 0.9); c.lineTo(x + r * 0.1, y - r * 1.35); c.stroke();
    c.fillStyle = '#7ab648';
    c.beginPath(); c.ellipse(x + r * 0.35, y - r * 1.15, r * 0.35, r * 0.18, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  /** n aebler i et lille gitter omkring (cx, cy). 0 aebler = en tom tallerken. */
  function tegnMaengde(c, n, cx, cy, plads, hvorMange, iRaekke) {
    if (n === 0) {
      c.fillStyle = '#fff'; c.strokeStyle = '#5e4a3a'; c.lineWidth = 3;
      c.beginPath(); c.ellipse(cx, cy, plads * 1.3, plads * 0.5, 0, 0, Math.PI * 2); c.fill(); c.stroke();
      return;
    }
    var kol = iRaekke ? n : (n <= 3 ? n : (n <= 6 ? 3 : (n <= 8 ? 4 : 3)));
    var rk = Math.ceil(n / kol);
    var r = iRaekke ? Math.min(plads, plads * 6 / n) : plads * (kol >= 4 ? 0.28 : 0.36);
    var vis = hvorMange === undefined ? n : hvorMange;
    for (var i = 0; i < vis; i++) {
      var x = cx + ((i % kol) - (kol - 1) / 2) * r * 2.6;
      var y = cy + (Math.floor(i / kol) - (rk - 1) / 2) * r * 2.8;
      tegnAeble(c, x, y, r);
    }
  }

  function bland(a) {
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function startFind() {
    tilstand = 'find';
    ordet = null;
    fundet = 0;
    partikler = [];
    nyFindRunde();
  }

  /** Hvor svaer er Find lige nu, ud fra raekken af rigtige: 0, 1 eller 2 trin op. */
  function findTrin() { return raekke >= 6 ? 2 : (raekke >= 3 ? 1 : 0); }

  function nyFindRunde() {
    var B = window.innerWidth, H = window.innerHeight;
    var trin = findTrin();
    var antal = trin > 0 ? 8 : 6;
    var egne = bland(navneI(kategori));
    maal = egne[0];
    var navne = egne.slice(0, antal);
    // Gaar det godt med bogstaver, blandes store og smaa, saa barnet skal kende begge
    if (trin > 0 && kategori !== 'tal') {
      var andre = bland(navneI(kategori === 'smaa' ? 'bogstaver' : 'smaa')).slice(0, Math.floor(antal / 2));
      navne = bland([maal].concat(egne.slice(1, antal - andre.length), andre));
    }
    var kol = antal > 6 ? 4 : 3;
    var r = Math.min(B, H) * (antal > 6 ? 0.08 : 0.09);
    bobler = navne.map(function (n, i) {
      var v = Math.random() * Math.PI * 2;
      return {
        navn: n, r: r,
        x: B * (kol === 4 ? 0.14 : 0.18) + (i % kol) * B * (kol === 4 ? 0.24 : 0.32) + (Math.random() - 0.5) * 40,
        y: H * 0.36 + Math.floor(i / kol) * H * 0.3 + (Math.random() - 0.5) * 40,
        vx: Math.cos(v) * 40 * (1 + svaerhed * 0.6), vy: Math.sin(v) * 40 * (1 + svaerhed * 0.6),
        vip: 0, farve: FARVER[i % FARVER.length]
      };
    });
    findPause = 0.4;
    sigNavn(maal);
  }

  function opdaterFind(dt) {
    var B = window.innerWidth, H = window.innerHeight;
    findPause = Math.max(0, findPause - dt);
    bobler.forEach(function (b) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.x < b.r + 10 && b.vx < 0) b.vx = -b.vx;
      if (b.x > B - b.r - 10 && b.vx > 0) b.vx = -b.vx;
      if (b.y < b.r + 130 && b.vy < 0) b.vy = -b.vy;
      if (b.y > H - b.r - 20 && b.vy > 0) b.vy = -b.vy;
      b.vip = Math.max(0, b.vip - dt);
    });
  }

  function findTryk(e) {
    if (tilstand !== 'find' || findPause > 0) return;
    var r = lærred.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    // Tryk paa skyen: hoer maalet igen
    var B = window.innerWidth, ms = Math.min(B, window.innerHeight) * 0.16;
    if (Math.abs(x - B / 2) < ms * 0.8 && y > 50 && y < 50 + ms * 1.25) { sigNavn(maal); return; }
    for (var i = 0; i < bobler.length; i++) {
      var b = bobler[i];
      if (Math.hypot(x - b.x, y - b.y) <= b.r * 1.15) {
        if (b.navn === maal) {
          fundet++;
          raekke++;
          if (raekke === 3 || raekke === 6) setTimeout(fyrvaerkeri, 400);   // et trin op fejres
          melodi([660, 880, 1100], 80);
          fest(b.x, b.y);
          puf(b.x, b.y, b.farve, 24, 420, 6, 0.7);
          setTimeout(function () { sigNavn(maal); }, 300);
          bobler.splice(i, 1);
          findPause = 1.3;
          if (fundet >= FIND_ANTAL) setTimeout(function () { afslut('find'); }, 900);
          else setTimeout(nyFindRunde, 1300);
        } else {
          // Forkert boble fniser og vipper. Ingen straf, men raekken starter forfra.
          b.vip = 0.7;
          raekke = 0;
          melodi([880, 1046], 70);
        }
        return;
      }
    }
  }

  function tegnFindSkaerm() {
    var B = window.innerWidth, H = window.innerHeight;
    // Maalet i en sky oeverst
    var ms = Math.min(B, H) * 0.16;
    ctx.fillStyle = '#f8f1e6';
    ctx.strokeStyle = '#5e4a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(B / 2 - ms * 0.8, 50, ms * 1.6, ms * 1.25, 26);
    ctx.fill();
    ctx.stroke();
    var n = talVaerdi(maal);
    var trin = findTrin();
    if (n >= 0) {
      // Tal: skyen viser maengden. Paa 1 stjerne ogsaa tallet, til det gaar godt.
      if (svaerhed === 0 && trin === 0) {
        tegnGlyf(ctx, G[maal], B / 2 - ms * 0.72, 58 + ms * 0.2, ms * 0.7, '#5e4a3a', 12);
        tegnMaengde(ctx, n, B / 2 + ms * 0.32, 50 + ms * 0.62, ms * 0.16);
      } else {
        tegnMaengde(ctx, n, B / 2, 50 + ms * 0.62, ms * 0.34);
      }
    } else if ((svaerhed === 2 || trin === 2) && lydTil && (stemme || klipFindes['bogstav_' + String(maal).toUpperCase() + '.mp3'])) {
      // Lyt og find: skyen siger bogstavet i stedet for at vise det. Tryk for at hoere igen.
      ctx.save();
      ctx.translate(B / 2, 50 + ms * 0.62);
      ctx.scale(ms / 60, ms / 60);
      ctx.fillStyle = '#5e4a3a';
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-6, -8); ctx.lineTo(4, -17); ctx.lineTo(4, 17); ctx.lineTo(-6, 8); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      var b1 = 1 + Math.sin(tid * 6) * 0.08;
      ctx.beginPath(); ctx.arc(6, 0, 9 * b1, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, 0, 15 * b1, -0.9, 0.9); ctx.stroke();
      ctx.restore();
    } else {
      tegnGlyf(ctx, G[maal], B / 2 - ms / 2, 58 + ms * 0.1, ms, '#5e4a3a', 12);
    }

    bobler.forEach(function (b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.vip > 0) ctx.rotate(Math.sin(b.vip * 40) * 0.15);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = b.farve;
      ctx.strokeStyle = '#5e4a3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath();
      ctx.ellipse(-b.r * 0.4, -b.r * 0.45, b.r * 0.25, b.r * 0.14, -0.6, 0, Math.PI * 2);
      ctx.fill();
      tegnGlyf(ctx, G[b.navn], -b.r * 0.55, -b.r * 0.55, b.r * 1.1, '#5e4a3a', 11);
      // Oejne oeverst paa boblen, der kigger mod maalet og klemmer sammen naar den fniser
      var blink = Math.sin(tid * 1.7 + b.x * 0.01) > 0.97 || b.vip > 0;
      [-1, 1].forEach(function (d) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#5e4a3a'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (blink) { ctx.moveTo(d * b.r * 0.3 - 6, -b.r * 0.72); ctx.lineTo(d * b.r * 0.3 + 6, -b.r * 0.72); ctx.stroke(); return; }
        ctx.arc(d * b.r * 0.3, -b.r * 0.72, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        var vx = window.innerWidth / 2 - b.x, vy = 120 - b.y, vl = Math.hypot(vx, vy) || 1;
        ctx.fillStyle = '#5e4a3a';
        ctx.beginPath(); ctx.arc(d * b.r * 0.3 + vx / vl * 3, -b.r * 0.72 + vy / vl * 3, 3.5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    });
  }

  /* ---------- faelles tegning ---------- */

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#8fc7e8');
    g.addColorStop(1, '#dfeef0');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, B, H);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    [[0.12, 0.14, 1], [0.5, 0.08, 0.8], [0.86, 0.16, 1.1]].forEach(function (s) {
      var x = B * s[0] + Math.sin(tid * 0.3 + s[0] * 9) * 12, y = H * s[1], r = 24 * s[2];
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.arc(x + r * 1.1, y + r * 0.2, r * 0.8, 0, Math.PI * 2);
      ctx.arc(x - r * 1.1, y + r * 0.25, r * 0.75, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  /** Tre smaa stjerner oeverst til hoejre, der fyldes naar spillet skruer op. */
  function tegnTrin(fyldt) {
    var B = window.innerWidth;
    for (var i = 0; i < 3; i++) {
      var cx = B - 86 + i * 30, cy = 30;
      ctx.beginPath();
      for (var k = 0; k < 10; k++) {
        var r = k % 2 ? 5 : 11, v = -Math.PI / 2 + k * Math.PI / 5;
        ctx.lineTo(cx + Math.cos(v) * r, cy + Math.sin(v) * r);
      }
      ctx.closePath();
      ctx.fillStyle = i < fyldt ? '#f0c46a' : 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#5e4a3a';
      ctx.stroke();
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnBaggrund();
    if (tilstand === 'tegn') {
      tegnTegnSkaerm();
      tegnPartikler();
      if (ordet) tegnFremskridt(ordListe.length, ordPlads);
      else tegnFremskridt(liste.length, tegnet);
      tegnTrin(Math.max(0, Math.min(3, Math.ceil(flow * 3 / 4))));
    } else if (tilstand === 'vaelg') {
      if (regn) tegnRegnSkaerm(); else tegnVaelgSkaerm();
      tegnPartikler();
      tegnFremskridt(liste.length, tegnet);
      tegnTrin(Math.max(0, Math.min(3, Math.ceil(flow * 3 / 4))));
    } else if (tilstand === 'find') {
      tegnFindSkaerm();
      tegnPartikler();
      tegnFremskridt(FIND_ANTAL, fundet);
      tegnTrin((raekke >= 3 ? 1 : 0) + (raekke >= 6 ? 1 : 0) + (raekke >= 9 ? 1 : 0));
    } else {
      tegnPartikler();
    }
  }

  /* ---------- slutskaerm ---------- */

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) {
      konfetti.push({
        x: Math.random() * canvas.width, y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
        b: 6 + Math.random() * 6, h: 4 + Math.random() * 4, farve: FARVER[i % FARVER.length]
      });
    }
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d');
    c.clearRect(0, 0, vinderCanvas.width, vinderCanvas.height);
    var navn = vinderCanvas._navn;
    if (navn) tegnGlyf(c, G[navn], vinderCanvas.width / 2 - 70, vinderCanvas.height / 2 - 70 + Math.sin(tid * 4) * 5, 140, STREGFARVE, 14);
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > vinderCanvas.height + 10) { k.y = -10; k.x = Math.random() * vinderCanvas.width; }
      c.save(); c.translate(k.x, k.y); c.rotate(k.rot);
      c.fillStyle = k.farve; c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h);
      c.restore();
    });
  }

  function afslut(hvad) {
    tilstand = 'faerdig';
    ordet = null;
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay(
      '<div class="kort">' +
      '<h2>Flot!</h2>' +
      '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '"></canvas>' +
      Menu.slutRaekke(hvad === 'find' ? 'find' : (hvad === 'ord' ? 'ord' : 'tegn-alle'), null) +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    vinderCanvas._navn = hvad === 'find' ? maal : (hvad === 'ord' ? liste[0] : liste[liste.length - 1]);
    startKonfetti(vinderCanvas);
  }

  /* ---------- loop ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t;
    tid += dt;
    if (tilstand === 'tegn') opdaterTegn(dt);
    else if (tilstand === 'vaelg') opdaterVaelg(dt);
    else if (tilstand === 'find') opdaterFind(dt);
    else if (tilstand === 'faerdig') tegnVinder(dt);
    opdaterPartikler(dt);
    tegn();
    requestAnimationFrame(løkke);
  }

  /* ---------- menu ---------- */

  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; overlay.innerHTML = ''; vinderCanvas = null; }


  /**
   * Menuen paa én skaerm i tre zoner. Oeverst hvilke tegn: A, a, KAT eller 123,
   * den valgte er blaa. I midten de groenne knapper Tegn og Find, eller én
   * startknap for ord. Nederst koeretoej og stjerner som smaa valg.
   */
  function visMenu() {
    tilstand = 'venter';
    regn = null;
    ordet = null;
    vinderCanvas = null;
    stopKlip();
    kategori = hvad === 'tal' ? 'tal' : (hvad === 'ord' ? stoerrelse : (hvad === 'smaa' ? 'smaa' : 'bogstaver'));
    var hvadKnapper = [['store', 'Store bogstaver'], ['smaa', 'Smaa bogstaver'], ['ord', 'Ord'], ['tal', 'Tal']].map(function (v) {
      return '<button class="knap smal ikon' + (hvad === v[0] ? ' valgt' : '') + '" data-handling="hvad" data-k="' + v[0] + '" aria-label="' + v[1] + '">' +
             '<canvas width="160" height="110" style="' + FLISE_STIL + '" data-leg="' + v[0] + '"></canvas></button>';
    }).join('');
    var startKnapper = hvad === 'ord'
      ? '<div class="raekke start"><button class="knap groen start" data-handling="ord" aria-label="Tegn ord">' + Menu.start() + '</button></div>'
      : '<div class="raekke lege">' +
        '<button class="knap groen" data-handling="gitter" aria-label="Tegn"><canvas width="220" height="170" style="' + FLISE_STIL + '" data-leg="tegn"></canvas></button>' +
        '<button class="knap groen" data-handling="find" aria-label="Find"><canvas width="220" height="170" style="' + FLISE_STIL + '" data-leg="find"></canvas></button>' +
        '</div>';
    visOverlay(
      '<div class="kort">' +
      '<h2>ABC og 123</h2>' +
      '<div class="raekke valg hvad">' + hvadKnapper + '</div>' +
      startKnapper +
      '<div class="raekke valg">' + KOERETOEJER.map(function (k) {
        return '<button class="knap smal ikon' + (k === koeretoej ? ' valgt' : '') + '" data-handling="koeretoej" data-k="' + k +
               '" aria-label="' + k + '"><canvas width="72" height="44" style="' + FLISE_STIL + ';width:56px;height:34px" data-koeretoej="' + k + '"></canvas></button>';
      }).join('') + '</div>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    tegnMenuBilleder();
    if (!visMenu.venter) {
      visMenu.venter = Sprites.naarKlar(KOERETOEJ_SPRITES, function () { visMenu.venter = false; if (tilstand === 'venter' && overlay.querySelector('canvas[data-koeretoej]')) visMenu(); });
    }
  }

  /** Tegner koeretoejer og legebilleder i den menu, der er fremme. */
  function tegnMenuBilleder() {
    overlay.querySelectorAll('canvas[data-koeretoej]').forEach(function (cv) {
      var c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.save(); c.translate(cv.width / 2, cv.height / 2); c.scale(1.7, 1.7);
      tegnKoeretoej(c, cv.dataset.koeretoej, cv.dataset.koeretoej === 'raket', 0.6);
      c.restore();
    });
    overlay.querySelectorAll('canvas[data-leg]').forEach(tegnLegIkon);
    // Kattens SVG kan vaere paa vej: tegn ordbilledet igen, naar den er hentet
    var kat = billeder['ting/kat.svg'];
    if (kat && !(kat.complete && kat.naturalWidth > 0)) {
      kat.addEventListener('load', function () { var cv = overlay.querySelector('canvas[data-leg="ord"]'); if (cv) tegnLegIkon(cv); }, { once: true });
    }
  }

  /**
   * Billederne i menuen, tegnet med spillets egne streger, saa man kan se, hvad
   * man vaelger, uden at laese. Oeverst: STORE er et A, SMAA et a, ORD katten
   * over KAT, TAL er 1 2 3 med aebler. I midten: TEGN er et A (eller 3-tal),
   * som bilen er ved at koere, FIND er bobler med bogstaver (eller tal), hvor
   * det rigtige er fremhaevet.
   */
  function tegnLegIkon(cv) {
    var c = cv.getContext('2d'), billede = cv.dataset.leg, B = cv.width, H = cv.height;
    c.clearRect(0, 0, B, H);
    // Den oeverste raekke: tegnet direkte paa knappen, der er blaa naar den er valgt
    var valgtFarve = cv.closest('.valgt') ? '#f8f1e6' : '#5e4a3a';
    if (billede === 'store' || billede === 'smaa') {
      tegnGlyf(c, billede === 'store' ? G.A : G.a, B / 2 - 42, 12, 84, valgtFarve, 12);
      return;
    }
    if (billede === 'tal') {
      ['1', '2', '3'].forEach(function (n, i) {
        tegnGlyf(c, G[n], 22 + i * 42, 14, 54, i === 1 ? STREGFARVE : valgtFarve, 9);
        tegnMaengde(c, i + 1, 49 + i * 42, 96, 6, i + 1, 3);
      });
      return;
    }
    if (billede === 'ord') {
      // Katten lille over KAT
      var kat = billeder['ting/kat.svg'];
      if (kat && kat.complete && kat.naturalWidth > 0) c.drawImage(kat, B / 2 - 24, 2, 48, 48);
      ['K', 'A', 'T'].forEach(function (n, i) {
        tegnGlyf(c, G[n], 34 + i * 34, 52, 46, i < 2 ? STREGFARVE : valgtFarve, 8);
      });
      return;
    }
    c.fillStyle = '#f8f1e6'; c.strokeStyle = '#5e4a3a'; c.lineWidth = 5;
    c.beginPath(); c.roundRect(3, 3, B - 6, H - 6, 22); c.fill(); c.stroke();
    // Er tal valgt, viser Tegn og Find tal i stedet for bogstaver
    var tal = hvad === 'tal';
    if (billede === 'tegn') {
      // Et A (eller et 3-tal): vej i graat, foerste streg koert i orange, og bilen for enden af den
      var gt = tal ? G['3'] : G.A, s = 130, x = B / 2 - s / 2, y = 20;
      tegnGlyf(c, gt, x, y, s, '#a9a396', 14);
      tegnGlyf(c, gt, x, y, s, STREGFARVE, 14, { aktiv: 0, indeks: Math.floor(gt.streger[0].length * 0.6) });
      var slut = gt.streger[0][Math.floor(gt.streger[0].length * 0.6)], fra = gt.streger[0][Math.max(0, Math.floor(gt.streger[0].length * 0.6) - 1)];
      c.save();
      c.translate(x + slut[0] * s / 100, y + slut[1] * s / 100);
      c.rotate(Math.atan2(slut[1] - fra[1], slut[0] - fra[0]));
      c.scale(1.8, 1.8);
      tegnKoeretoej(c, 'bil', true, 0.3);
      c.restore();
    } else if (billede === 'find') {
      // Tre bobler med bogstaver (eller tal); den midterste er fundet og lyser gult
      [[tal ? '5' : 'K', 44, 98, '#8fc7e8'], [tal ? '2' : 'A', 110, 72, '#f0c46a'], [tal ? '7' : 'S', 176, 100, '#dfeef0']].forEach(function (b) {
        c.fillStyle = b[3]; c.strokeStyle = '#5e4a3a'; c.lineWidth = 4;
        c.beginPath(); c.arc(b[1], b[2], 36, 0, Math.PI * 2); c.fill(); c.stroke();
        tegnGlyf(c, G[b[0]], b[1] - 23, b[2] - 24, 46, '#5e4a3a', 7);
      });
    }
  }

  var EKSEMPEL_STIL = 'position:static;display:block;width:150px;height:110px;align-self:center';
  var FLISE_STIL = 'position:static;display:block;width:100%;height:100%';

  /** Gitter med alle tegn. Tryk paa et for at tegne det, eller tegn dem alle i raekkefoelge. */
  function visGitter() {
    tilstand = 'venter';
    var navne = navneI(kategori);
    var fliser = navne.map(function (n) {
      return '<button class="flise" data-handling="tegn" data-navn="' + n + '" aria-label="' + G[n].tegn + '">' +
             '<canvas width="96" height="96" style="' + FLISE_STIL + '" data-navn="' + n + '"></canvas></button>';
    }).join('');
    visOverlay(
      '<div class="kort bred">' +
      '<div class="gitter' + (kategori === 'tal' ? ' tal' : '') + '">' + fliser + '</div>' +
      '<div class="raekke slut">' +
      '<button class="knap gul" data-handling="tegn-alle" aria-label="Tegn alle">' + Menu.tegnAlle() + '</button>' +
      '<button class="knap" data-handling="menu" aria-label="Menu">' + Menu.tilbage() + '</button>' +
      '</div>' +
      '</div>'
    );
    overlay.querySelectorAll('canvas[data-navn]').forEach(function (cv) {
      var c = cv.getContext('2d');
      tegnGlyf(c, G[cv.dataset.navn], 8, 8, 80, '#5e4a3a', 9);
      if (tegnede[cv.dataset.navn]) {
        // Guldstjerne i hjoernet for tegn der er tegnet i denne omgang
        c.fillStyle = '#f0c46a'; c.strokeStyle = '#5e4a3a'; c.lineWidth = 2;
        c.beginPath();
        for (var k = 0; k < 10; k++) {
          var r = k % 2 ? 5 : 11, v = -Math.PI / 2 + k * Math.PI / 5;
          c.lineTo(80 + Math.cos(v) * r, 16 + Math.sin(v) * r);
        }
        c.closePath(); c.fill(); c.stroke();
      }
    });
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'hvad') {
      hvad = knap.dataset.k;
      if (hvad === 'store') stoerrelse = 'bogstaver';
      if (hvad === 'smaa') stoerrelse = 'smaa';
      tone(520, 0.08);
      visMenu();
    } else if (h === 'svaerhed') {
      svaerhed = parseInt(knap.dataset.n, 10);
      melodi([520, 660, 780].slice(0, svaerhed + 1), 70);
      visMenu();
    } else if (h === 'koeretoej') {
      koeretoej = knap.dataset.k;
      melodi(koeretoej === 'raket' ? [440, 660, 880] : (koeretoej === 'bil' ? [330, 330, 440] : [523, 659, 784]), 70);
      visMenu();
    } else if (h === 'lyd') {
      lydTil = !lydTil;
      if (lydTil) tone(660, 0.12);
      visMenu();
    } else if (h === 'gitter') {
      tone(520, 0.08);
      visGitter();
    } else if (h === 'tegn') {
      skjulOverlay();
      var navne = navneI(kategori);
      var fra = navne.indexOf(knap.dataset.navn);
      startTegn(navne.slice(fra).concat(navne.slice(0, fra)));
    } else if (h === 'tegn-alle') {
      skjulOverlay();
      startTegn(navneI(kategori));
    } else if (h === 'find') {
      skjulOverlay();
      startFind();
    } else if (h === 'ord') {
      skjulOverlay();
      startOrd();
    } else if (h === 'menu') {
      visMenu();
    }
  });

  /* ---------- input paa laerredet ---------- */

  lærred.addEventListener('pointerdown', function (e) {
    e.preventDefault();
    if (tilstand === 'tegn') tegnNed(e);
    else if (tilstand === 'vaelg') vaelgTryk(e);
    else if (tilstand === 'find') findTryk(e);
  }, { passive: false });
  lærred.addEventListener('pointermove', function (e) { if (tilstand === 'tegn') tegnFlyt(e); }, { passive: false });
  lærred.addEventListener('pointerup', tegnOp);
  lærred.addEventListener('pointercancel', tegnOp);
  lærred.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, kategori: kategori, hvad: hvad, svaerhed: svaerhed, lyd: lydTil, stemme: stemme ? stemme.name : null, koeretoej: koeretoej, afspillet: afspillet,
      tegn: tilstand === 'tegn' ? { navn: liste[plads], plads: plads, andel: +spor.andel().toFixed(2), aktiv: spor.aktiv, holder: spor.holder, jubel: +jubel.toFixed(2) } : null,
      find: tilstand === 'find' ? { maal: maal, fundet: fundet, bobler: bobler.map(function (b) { return { navn: b.navn, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) }; }) } : null,
      aebler: aebler, flow: flow, raekke: raekke, tolerance: +tolerance().toFixed(1),
      regn: regn, vaelg: tilstand === 'vaelg' ? { navn: vaelgNavn, loest: vaelgLoest, kort: kort.map(function (k) { return { navn: k.navn, ord: k.ting ? k.ting.ord : k.navn, x: Math.round(k.x), y: Math.round(k.y), vendt: !!k.vendt, rigtig: k.rigtig }; }) } : null,
      ord: ordet ? { ord: ordet.ting.ord, nr: ordPlads, antal: ordListe.length, bogstav: plads, kasser: ordet.kasser.map(function (k) { return Math.round(k.x); }) } : null,
      kasse: kasse
    };
  };

  tilpasStørrelse();
  // Pilen oeverst til venstre foerer tilbage hertil, ogsaa midt i et spil.
  Skal.menuKnap(visMenu);

  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
