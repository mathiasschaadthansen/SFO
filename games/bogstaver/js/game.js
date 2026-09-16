/**
 * Bogstaver.
 *
 * To lege: TEGN, hvor man foelger bogstavet med fingeren, og FIND, hvor
 * bogstaver svaever rundt i bobler, og man popper det rigtige.
 * Store bogstaver A-Å og tallene 0-9.
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

  var FARVER = ['#e8442e', '#3aa7e0', '#4cb944', '#ffd23f', '#9b5de5', '#ff8c42'];
  var TOLERANCE = [14, 10, 7];       // pr. stjerne, i kasse-enheder
  var STREGFARVE = '#ff8c42';

  var svaerhed = 0;
  var lydTil = true;
  var kategori = 'bogstaver';        // bogstaver | tal
  var KOERETOEJER = ['bil', 'raket', 'pensel'];

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

  var tilstand = 'venter';           // venter | tegn | vaelg | find | faerdig
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
  var kort = [];                     // tre ting: { navn, x, y, str, vip, vist, rigtig }
  var vaelgNavn = null;              // bogstavet der lige er tegnet
  var vaelgPause = 0;
  var vaelgLoest = false;

  // FIND
  var bobler = [];
  var maal = null;
  var fundet = 0;
  var FIND_ANTAL = 5;
  var findPause = 0;

  /* ---------- lyd og stemme ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state === 'suspended') lyd.resume();
    return lyd;
  }

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
   * Lydklip: bogstavnavne, tal, ord og spoergsmaal ligger som smaa MP3-filer i
   * lyd/ (lavet med vaerktoej/lav-lyd.py, kan erstattes af rigtige optagelser).
   * De afspilles gennem den samme AudioContext som tonerne, saa iOS tillader
   * dem efter det foerste tryk. Mangler et klip, bruges talesyntesen.
   */
  var buffere = {};
  var aktivtKlip = null;
  var afspillet = 0;

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
    // Landskab: tegnet fylder hoejden. Portraet (iPhone): tegnet fylder bredden.
    kasse.str = H > B ? Math.min(B * 0.86, H * 0.5) : Math.min(B * 0.55, H * 0.74);
    kasse.x = (B - kasse.str) / 2;
    kasse.y = (H - kasse.str) / 2 + H * 0.03;
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
    liste = navne;
    plads = 0;
    tegnet = 0;
    tilstand = 'tegn';
    partikler = [];
    nytTegn();
  }

  /** Tolerancen lige nu: stjernerne som udgangspunkt, strammere for hvert trin i flow. */
  function tolerance() {
    var t = TOLERANCE[svaerhed];
    if (flow < 0) return t * 1.3;
    return t * Math.pow(0.86, Math.min(3, flow));
  }

  function nytTegn() {
    spor = new Spor(G[liste[plads]], tolerance());
    jubel = 0;
    hint = 0;
    sidsteNode = -1;
    koerer = 0;
    fingerId = null;
    sigNavn(liste[plads]);
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
      if (koeretoej === 'raket') puf(px, py, Math.random() < 0.5 ? '#ffd23f' : '#ff8c42', 2, 90, 3, 0.45);
      else if (koeretoej === 'bil') { if (Math.random() < 0.5) puf(px, py, '#c9b27c', 1, 50, 3, 0.5); }
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
    jubel = 2.4;
    tegnet++;
    tegnede[liste[plads]] = true;
    // Gik det let? Saa skrues der op naeste gang. Drillede det? Saa ned.
    if (spor.afveje <= 1) flow = Math.min(4, flow + 1);
    else if (spor.afveje >= 4) flow = Math.max(-1, flow - 1);
    melodi([660, 880, 1100, 1320], 90);
    fest(kasse.x + kasse.str / 2, kasse.y + kasse.str / 2);
    setTimeout(function () { sigNavn(liste[plads]); }, 350);
    if (tegnet % 5 === 0) setTimeout(fyrvaerkeri, 600);

    // Tal: aeblerne dukker op ét ad gangen, og stemmen taeller med
    var n = talVaerdi(liste[plads]);
    aebler = 0;
    if (n > 0) {
      jubel = 1.2 + n * 0.45 + 1.2;
      for (var i = 1; i <= n; i++) {
        (function (k) {
          setTimeout(function () {
            if (tilstand !== 'tegn') return;
            aebler = k;
            tone(440 + k * 60, 0.15, 0.12);
            sigNavn(String(k));
          }, 1000 + k * 450);
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
        if (kategori !== 'tal' && Ting.TING[liste[plads]]) startVaelg(liste[plads]);
        else naesteTegn();
      }
    }
  }

  function naesteTegn() {
    plads++;
    if (plads >= liste.length) afslut('tegn');
    else { tilstand = 'tegn'; nytTegn(); }
  }

  /* ---------- VAELG: hvad starter med bogstavet? ---------- */

  function tingNavn(ch) { return ({ 'æ': 'ae', 'ø': 'oe', 'å': 'aa' }[ch] || ch); }

  function startVaelg(navn) {
    tilstand = 'vaelg';
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
      return { navn: n, ting: Ting.vaelg(n), x: B / 2 + (i - 1) * (str + gab), y: H * 0.6, str: str, vip: 0, vist: 0, rigtig: n === navn };
    });
    setTimeout(function () { if (tilstand === 'vaelg') sigSpoerg(navn); }, 300);
  }

  function opdaterVaelg(dt) {
    vaelgPause = Math.max(0, vaelgPause - dt);
    kort.forEach(function (k) { k.vip = Math.max(0, k.vip - dt); k.vist = Math.max(0, k.vist - dt); });
  }

  function vaelgTryk(e) {
    if (tilstand !== 'vaelg' || vaelgPause > 0 || vaelgLoest) return;
    var r = lærred.getBoundingClientRect();
    var x = e.clientX - r.left, y = e.clientY - r.top;
    for (var i = 0; i < kort.length; i++) {
      var k = kort[i];
      if (Math.abs(x - k.x) < k.str / 2 && Math.abs(y - k.y) < k.str / 2) {
        sigOrd(k.ting);
        if (k.rigtig) {
          vaelgLoest = true;
          k.vist = 99;
          melodi([660, 880, 1100, 1320], 90);
          fest(k.x, k.y);
          setTimeout(naesteTegn, 2600);
        } else {
          k.vip = 0.7;
          k.vist = 1.6;      // ordet vises kort, saa man kan se det starter med noget andet
          melodi([880, 1046], 70);
        }
        return;
      }
    }
  }

  /** Et ord skrevet med spillets egne streger, centreret om (cx, cy). Store eller smaa efter kategori. */
  function tegnOrd(ord, cx, cy, hoejde) {
    var bogstaver = ord.split('').map(function (ch) { return kategori === 'smaa' ? tingNavn(ch) : tingNavn(ch).toUpperCase(); });
    var b = hoejde * 0.72;
    var x0 = cx - bogstaver.length * b / 2;
    bogstaver.forEach(function (n, i) {
      if (G[n]) tegnGlyf(ctx, G[n], x0 + i * b, cy - hoejde / 2, hoejde, '#12261f', 9);
    });
  }

  function tegnVaelgSkaerm() {
    var B = window.innerWidth, H = window.innerHeight;
    // Bogstavet i en sky oeverst, som i Find
    var ms = Math.min(B, H) * 0.14;
    ctx.fillStyle = '#f7f3e8'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.roundRect(B / 2 - ms * 0.75, 44, ms * 1.5, ms * 1.2, 24); ctx.fill(); ctx.stroke();
    tegnGlyf(ctx, G[vaelgNavn], B / 2 - ms / 2, 50 + ms * 0.1, ms, STREGFARVE, 12);

    kort.forEach(function (k) {
      var t = k.ting;
      ctx.save();
      ctx.translate(k.x, k.y);
      if (k.vip > 0) ctx.rotate(Math.sin(k.vip * 40) * 0.12);
      if (vaelgLoest && k.rigtig) ctx.scale(1 + Math.sin(tid * 8) * 0.04, 1 + Math.sin(tid * 8) * 0.04);
      ctx.fillStyle = vaelgLoest && k.rigtig ? '#ffd23f' : '#f7f3e8';
      ctx.strokeStyle = '#12261f'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.roundRect(-k.str / 2, -k.str / 2, k.str, k.str, 24); ctx.fill(); ctx.stroke();
      ctx.save();
      ctx.translate(0, k.vist > 0 ? -k.str * 0.1 : 0);
      var img = t.fil && billeder[t.fil];
      if (img && img.complete && img.naturalWidth > 0) {
        var bs = k.str * 0.62;
        ctx.drawImage(img, -bs / 2, -bs / 2, bs, bs);
      } else if (t.tegn) {
        ctx.scale(k.str / 130, k.str / 130);
        ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
        t.tegn(ctx);
      } else {
        // Billedet er ikke hentet endnu: en blid plads-holder
        ctx.fillStyle = '#e6e1d4';
        ctx.beginPath(); ctx.arc(0, 0, k.str * 0.25, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      if (k.vist > 0) tegnOrd(t.ord, 0, k.str * 0.36, k.str * 0.17);
      ctx.restore();
    });
  }

  /** Koeretoejet, tegnet omkring (0,0) med fronten mod +x, i kasse-enheder. */
  function tegnKoeretoej(c, hvad, iGang, andel) {
    c.strokeStyle = '#12261f';
    c.lineWidth = 1.6;
    // Sprites fra Kenney for bil og raket. De peger opad, koeretoejet koerer mod +x.
    if (hvad === 'bil' || hvad === 'raket') {
      var img = Sprites.hent('../../assets/kenney/' + (hvad === 'bil' ? 'bil_lille' : 'raket') + '.png');
      if (Sprites.klar(img)) {
        if (hvad === 'raket' && iGang) {
          c.fillStyle = '#ff8c42';
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
      c.fillStyle = '#12261f';
      c.fillRect(-7, -6.5, 4, 13); c.fillRect(3, -6.5, 4, 13);
      c.fillStyle = '#e8442e';
      c.beginPath(); c.roundRect(-9, -5, 18, 10, 3.5); c.fill(); c.stroke();
      c.fillStyle = '#ffd23f';
      c.beginPath(); c.roundRect(-2, -3, 6, 6, 2); c.fill();
      if (iGang) { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(9.5, -3, 1.4, 0, Math.PI * 2); c.arc(9.5, 3, 1.4, 0, Math.PI * 2); c.fill(); }
    } else if (hvad === 'raket') {
      if (iGang) {
        c.fillStyle = '#ff8c42';
        c.beginPath(); c.moveTo(-8, -3); c.lineTo(-16 - Math.random() * 5, 0); c.lineTo(-8, 3); c.closePath(); c.fill();
      }
      c.fillStyle = '#f7f3e8';
      c.beginPath(); c.moveTo(11, 0); c.lineTo(3, -5); c.lineTo(-8, -5); c.lineTo(-8, 5); c.lineTo(3, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e8442e';
      c.beginPath(); c.moveTo(-8, -5); c.lineTo(-12, -9); c.lineTo(-5, -5); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.moveTo(-8, 5); c.lineTo(-12, 9); c.lineTo(-5, 5); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#3aa7e0';
      c.beginPath(); c.arc(1, 0, 2.6, 0, Math.PI * 2); c.fill(); c.stroke();
    } else {
      c.save();
      c.rotate(-Math.PI / 4);
      c.fillStyle = '#c98f4a';
      c.beginPath(); c.roundRect(-4, -2, 20, 4, 2); c.fill(); c.stroke();
      c.fillStyle = '#d9d4c7';
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
      ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(d * 9 * sk, 0, 7 * sk, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#12261f';
      ctx.beginPath(); ctx.arc(d * 9 * sk + 1.5 * sk, 1.5 * sk, 3 * sk, 0, Math.PI * 2); ctx.fill();
    });
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(0, 8 * sk, 8 * sk, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
    ctx.restore();
  }

  function tegnTegnSkaerm() {
    var glyf = G[liste[plads]];
    var s = kasse.str, sk = s / 100;
    var bredde = 13;
    // Baggrundsplade: lys for bil og pensel, moerk stjernehimmel for raketten
    ctx.fillStyle = koeretoej === 'raket' ? '#1b2f5c' : '#f7f3e8';
    ctx.strokeStyle = '#12261f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.roundRect(kasse.x - 24, kasse.y - 24, s + 48, s + 48, 30);
    ctx.fill();
    ctx.stroke();
    if (koeretoej === 'raket') {
      ctx.fillStyle = '#f7f3e8';
      for (var st = 0; st < 30; st++) {
        var sx0 = kasse.x + ((st * 137) % 100) * sk, sy0 = kasse.y + ((st * 71) % 100) * sk;
        ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(tid * 2 + st));
        ctx.beginPath(); ctx.arc(sx0, sy0, 1.5 + (st % 3) * 0.7, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // Jubel: tegnet hopper og vipper
    ctx.save();
    if (jubel > 0) {
      ctx.translate(kasse.x + s / 2, kasse.y + s / 2);
      ctx.rotate(Math.sin(jubel * 14) * 0.08);
      ctx.scale(1 + Math.sin(jubel * 7) * 0.04, 1 + Math.sin(jubel * 7) * 0.04);
      ctx.translate(-(kasse.x + s / 2), -(kasse.y + s / 2));
    }
    // Skabelon: en vej for bilen, en stjernebane for raketten, et blegt strøg for penslen
    var skabelon = koeretoej === 'bil' ? '#8a8f97' : (koeretoej === 'raket' ? 'rgba(255,255,255,0.22)' : '#e6e1d4');
    tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, skabelon, bredde);
    if (koeretoej === 'bil') {
      ctx.save(); ctx.setLineDash([4 * sk, 5 * sk]);
      tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, 'rgba(255,255,255,0.7)', 1.6);
      ctx.restore();
    }
    // Det der er tegnet
    var indtil = spor.faerdig ? null : { aktiv: spor.aktiv, indeks: spor.indeks };
    if (koeretoej === 'pensel') {
      // Regnbue: hver streg i sin egen farve, og farven glider undervejs
      ctx.save();
      var alleN = spor.streger.reduce(function (a, st) { return a + st.length; }, 0), talt = 0;
      spor.streger.forEach(function (streg, si) {
        if (indtil && si > indtil.aktiv) return;
        var til = indtil && si === indtil.aktiv ? indtil.indeks : streg.length - 1;
        ctx.lineWidth = bredde * sk; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        for (var i = 1; i <= til; i++) {
          ctx.strokeStyle = 'hsl(' + Math.floor((talt + i) / alleN * 360) + ',85%,60%)';
          ctx.beginPath();
          ctx.moveTo(kasse.x + streg[i - 1][0] * sk, kasse.y + streg[i - 1][1] * sk);
          ctx.lineTo(kasse.x + streg[i][0] * sk, kasse.y + streg[i][1] * sk);
          ctx.stroke();
        }
        talt += streg.length;
      });
      ctx.restore();
    } else {
      tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, koeretoej === 'raket' ? '#ffd23f' : STREGFARVE, bredde, indtil, spor);
      if (koeretoej === 'bil') {
        // Hjulspor oven paa den koerte vej
        ctx.save(); ctx.setLineDash([3 * sk, 4 * sk]);
        tegnGlyf(ctx, glyf, kasse.x, kasse.y, s, 'rgba(18,38,31,0.35)', 1.4, indtil, spor);
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
        ctx.strokeStyle = '#12261f';
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
    ctx.strokeStyle = '#12261f'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(0, -16 * sk * 0.9); ctx.stroke();
    for (var r = 0; r < 2; r++) for (var k = 0; k < 3; k++) {
      ctx.fillStyle = (r + k) % 2 ? '#12261f' : '#f7f3e8';
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
      ctx.fillStyle = fyldt ? '#ffd23f' : 'rgba(255,255,255,0.35)';
      ctx.fill();
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#12261f';
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
    c.fillStyle = '#e8442e';
    c.strokeStyle = '#12261f';
    c.lineWidth = Math.max(2, r * 0.12);
    c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill(); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.35)';
    c.beginPath(); c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.25, r * 0.15, -0.6, 0, Math.PI * 2); c.fill();
    c.strokeStyle = '#12261f'; c.lineWidth = Math.max(2, r * 0.14); c.lineCap = 'round';
    c.beginPath(); c.moveTo(x, y - r * 0.9); c.lineTo(x + r * 0.1, y - r * 1.35); c.stroke();
    c.fillStyle = '#4cb944';
    c.beginPath(); c.ellipse(x + r * 0.35, y - r * 1.15, r * 0.35, r * 0.18, -0.5, 0, Math.PI * 2); c.fill(); c.stroke();
  }

  /** n aebler i et lille gitter omkring (cx, cy). 0 aebler = en tom tallerken. */
  function tegnMaengde(c, n, cx, cy, plads, hvorMange, iRaekke) {
    if (n === 0) {
      c.fillStyle = '#fff'; c.strokeStyle = '#12261f'; c.lineWidth = 3;
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
    ctx.fillStyle = '#f7f3e8';
    ctx.strokeStyle = '#12261f';
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
        tegnGlyf(ctx, G[maal], B / 2 - ms * 0.72, 58 + ms * 0.2, ms * 0.7, '#12261f', 12);
        tegnMaengde(ctx, n, B / 2 + ms * 0.32, 50 + ms * 0.62, ms * 0.16);
      } else {
        tegnMaengde(ctx, n, B / 2, 50 + ms * 0.62, ms * 0.34);
      }
    } else if ((svaerhed === 2 || trin === 2) && lydTil) {
      // Lyt og find: skyen siger bogstavet i stedet for at vise det. Tryk for at hoere igen.
      ctx.save();
      ctx.translate(B / 2, 50 + ms * 0.62);
      ctx.scale(ms / 60, ms / 60);
      ctx.fillStyle = '#12261f';
      ctx.beginPath(); ctx.moveTo(-14, -8); ctx.lineTo(-6, -8); ctx.lineTo(4, -17); ctx.lineTo(4, 17); ctx.lineTo(-6, 8); ctx.lineTo(-14, 8); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#12261f'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      var b1 = 1 + Math.sin(tid * 6) * 0.08;
      ctx.beginPath(); ctx.arc(6, 0, 9 * b1, -0.9, 0.9); ctx.stroke();
      ctx.beginPath(); ctx.arc(6, 0, 15 * b1, -0.9, 0.9); ctx.stroke();
      ctx.restore();
    } else {
      tegnGlyf(ctx, G[maal], B / 2 - ms / 2, 58 + ms * 0.1, ms, '#12261f', 12);
    }

    bobler.forEach(function (b) {
      ctx.save();
      ctx.translate(b.x, b.y);
      if (b.vip > 0) ctx.rotate(Math.sin(b.vip * 40) * 0.15);
      ctx.globalAlpha = 0.9;
      ctx.fillStyle = b.farve;
      ctx.strokeStyle = '#12261f';
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
      tegnGlyf(ctx, G[b.navn], -b.r * 0.55, -b.r * 0.55, b.r * 1.1, '#12261f', 11);
      // Oejne oeverst paa boblen, der kigger mod maalet og klemmer sammen naar den fniser
      var blink = Math.sin(tid * 1.7 + b.x * 0.01) > 0.97 || b.vip > 0;
      [-1, 1].forEach(function (d) {
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#12261f'; ctx.lineWidth = 2.5;
        ctx.beginPath();
        if (blink) { ctx.moveTo(d * b.r * 0.3 - 6, -b.r * 0.72); ctx.lineTo(d * b.r * 0.3 + 6, -b.r * 0.72); ctx.stroke(); return; }
        ctx.arc(d * b.r * 0.3, -b.r * 0.72, 8, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        var vx = window.innerWidth / 2 - b.x, vy = 120 - b.y, vl = Math.hypot(vx, vy) || 1;
        ctx.fillStyle = '#12261f';
        ctx.beginPath(); ctx.arc(d * b.r * 0.3 + vx / vl * 3, -b.r * 0.72 + vy / vl * 3, 3.5, 0, Math.PI * 2); ctx.fill();
      });
      ctx.restore();
    });
  }

  /* ---------- faelles tegning ---------- */

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#7fd0f5');
    g.addColorStop(1, '#c9ecfb');
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
      ctx.fillStyle = i < fyldt ? '#ffd23f' : 'rgba(255,255,255,0.45)';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#12261f';
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
      tegnFremskridt(liste.length, tegnet);
      tegnTrin(Math.max(0, Math.min(3, Math.ceil(flow * 3 / 4))));
    } else if (tilstand === 'vaelg') {
      tegnVaelgSkaerm();
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
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay(
      '<div class="kort">' +
      '<h2>Flot!</h2>' +
      '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '"></canvas>' +
      '<button class="knap gul" data-handling="' + (hvad === 'find' ? 'find' : 'tegn-alle') + '">Igen</button>' +
      '<button class="knap" data-handling="menu">Menu</button>' +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    vinderCanvas._navn = hvad === 'find' ? maal : liste[liste.length - 1];
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

  function stjerner(fyldt) {
    var s = '<svg width="84" height="26" viewBox="0 0 84 26" aria-hidden="true">';
    for (var i = 0; i < 3; i++) {
      var cx = 13 + i * 29, cy = 13, d = '';
      for (var k = 0; k < 10; k++) {
        var r = k % 2 ? 5 : 12, v = -Math.PI / 2 + k * Math.PI / 5;
        d += (k ? 'L' : 'M') + (cx + Math.cos(v) * r).toFixed(1) + ' ' + (cy + Math.sin(v) * r).toFixed(1);
      }
      s += '<path d="' + d + 'Z" fill="' + (i < fyldt ? '#ffd23f' : '#d9d4c7') + '" stroke="#12261f" stroke-width="2" stroke-linejoin="round"/>';
    }
    return s + '</svg>';
  }

  function lydIkon(til) {
    return '<svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true">' +
      '<path d="M4 11h6l7-6v20l-7-6H4z" fill="#12261f"/>' +
      (til
        ? '<path d="M20 10c2 2.5 2 7.5 0 10M23.5 7c3.5 4.5 3.5 11.5 0 16" fill="none" stroke="#12261f" stroke-width="2.5" stroke-linecap="round"/>'
        : '<path d="M20 11l7 8M27 11l-7 8" fill="none" stroke="#e8442e" stroke-width="3" stroke-linecap="round"/>') +
      '</svg>';
  }

  function blyantIkon() {
    return '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">' +
      '<path d="M8 36l3-10L28 9l7 7-17 17z" fill="#ffd23f" stroke="#12261f" stroke-width="3" stroke-linejoin="round"/>' +
      '<path d="M8 36l3-10 7 7z" fill="#12261f"/><path d="M25 12l7 7" stroke="#12261f" stroke-width="3"/></svg>';
  }
  function luppIkon() {
    return '<svg width="44" height="44" viewBox="0 0 44 44" aria-hidden="true">' +
      '<circle cx="18" cy="18" r="11" fill="#7fd0f5" stroke="#12261f" stroke-width="3"/>' +
      '<path d="M26 26l11 11" stroke="#12261f" stroke-width="5" stroke-linecap="round"/></svg>';
  }

  function visMenu() {
    tilstand = 'venter';
    vinderCanvas = null;
    stopKlip();
    var stjerneKnapper = [0, 1, 2].map(function (n) {
      return '<button class="knap smal ikon' + (n === svaerhed ? ' valgt' : '') +
             '" data-handling="svaerhed" data-n="' + n + '" aria-label="' + (n + 1) + ' stjerner">' + stjerner(n + 1) + '</button>';
    }).join('');
    visOverlay(
      '<div class="kort">' +
      '<h2>Bogstaver</h2>' +
      '<div class="raekke">' +
      '<button class="knap smal' + (kategori === 'bogstaver' ? ' valgt' : '') + '" data-handling="kategori" data-k="bogstaver">ABC</button>' +
      '<button class="knap smal' + (kategori === 'smaa' ? ' valgt' : '') + '" data-handling="kategori" data-k="smaa">abc</button>' +
      '<button class="knap smal' + (kategori === 'tal' ? ' valgt' : '') + '" data-handling="kategori" data-k="tal">123</button>' +
      '</div>' +
      '<div class="raekke">' + stjerneKnapper + '</div>' +
      '<div class="raekke">' + KOERETOEJER.map(function (k) {
        return '<button class="knap smal ikon' + (k === koeretoej ? ' valgt' : '') + '" data-handling="koeretoej" data-k="' + k +
               '" aria-label="' + k + '"><canvas width="72" height="44" style="' + FLISE_STIL + ';width:56px;height:34px" data-koeretoej="' + k + '"></canvas></button>';
      }).join('') + '</div>' +
      '<div class="raekke to">' +
      '<button class="knap gul" data-handling="gitter">' + blyantIkon() + 'Tegn</button>' +
      '<button class="knap gul" data-handling="find">' + luppIkon() + 'Find</button>' +
      '</div>' +
      '<div class="raekke bund">' +
      '<button class="knap lille ikon" data-handling="lyd" aria-label="Lyd til eller fra">' + lydIkon(lydTil) + '</button>' +
      '</div>' +
      '</div>'
    );
    overlay.querySelectorAll('canvas[data-koeretoej]').forEach(function (cv) {
      var c = cv.getContext('2d');
      c.clearRect(0, 0, cv.width, cv.height);
      c.save(); c.translate(cv.width / 2, cv.height / 2); c.scale(1.7, 1.7);
      tegnKoeretoej(c, cv.dataset.koeretoej, cv.dataset.koeretoej === 'raket', 0.6);
      c.restore();
    });
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
      '<button class="knap gul stor" data-handling="tegn-alle">Tegn alle</button>' +
      '<button class="knap lille" data-handling="menu">Menu</button>' +
      '</div>'
    );
    overlay.querySelectorAll('canvas[data-navn]').forEach(function (cv) {
      var c = cv.getContext('2d');
      tegnGlyf(c, G[cv.dataset.navn], 8, 8, 80, '#12261f', 9);
      if (tegnede[cv.dataset.navn]) {
        // Guldstjerne i hjoernet for tegn der er tegnet i denne omgang
        c.fillStyle = '#ffd23f'; c.strokeStyle = '#12261f'; c.lineWidth = 2;
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
    if (h === 'svaerhed') {
      svaerhed = parseInt(knap.dataset.n, 10);
      melodi([520, 660, 780].slice(0, svaerhed + 1), 70);
      visMenu();
    } else if (h === 'kategori') {
      kategori = knap.dataset.k;
      tone(520, 0.08);
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
      tilstand: tilstand, kategori: kategori, svaerhed: svaerhed, lyd: lydTil, stemme: stemme ? stemme.name : null, koeretoej: koeretoej, afspillet: afspillet,
      tegn: tilstand === 'tegn' ? { navn: liste[plads], plads: plads, andel: +spor.andel().toFixed(2), aktiv: spor.aktiv, holder: spor.holder, jubel: +jubel.toFixed(2) } : null,
      find: tilstand === 'find' ? { maal: maal, fundet: fundet, bobler: bobler.map(function (b) { return { navn: b.navn, x: Math.round(b.x), y: Math.round(b.y), r: Math.round(b.r) }; }) } : null,
      aebler: aebler, flow: flow, raekke: raekke, tolerance: +tolerance().toFixed(1),
      vaelg: tilstand === 'vaelg' ? { navn: vaelgNavn, loest: vaelgLoest, kort: kort.map(function (k) { return { navn: k.navn, ord: k.ting.ord, x: Math.round(k.x), y: Math.round(k.y), rigtig: k.rigtig }; }) } : null,
      kasse: kasse
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
