/**
 * Årstidshaven: haven, Pelles ønsker, vejret og dyrene.
 *
 * Rene tal og funktioner uden browser, saa testen kan spille haven igennem
 * i node. Tegningen, lyden og stemmen ligger i game.js og faar besked
 * gennem de kroge, der gives til Haven.ny: sig, sigKoe, lyd, gnist, vand,
 * sne og froe.
 *
 * Laeringen ligger i Pelles oensker. Et oenske har én eller to dele, og en
 * del er en afgroede (tre tomater) eller en kategori (noget roedt, noget,
 * der gror nede i jorden). Stjernerne bestemmer, hvor meget der skal
 * taelles. Planten vokser i tre tydelige trin, ét for hver gang den faar
 * vand, og stemmen siger, hvad den er blevet til.
 */
(function (rod) {
  'use strict';

  /* ---------- regnestykker ---------- */
  function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function cross(a, b) { return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]; }
  function norm(a) { var l = Math.sqrt(a[0] * a[0] + a[1] * a[1] + a[2] * a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; }
  function mix(a, b, t) { return a + (b - a) * t; }
  function klem(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function jaevn(a, b, x) { var t = klem((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); }
  function tilfaeldig(s) {
    return function () {
      s |= 0; s = s + 0x6D2B79F5 | 0;
      var t = Math.imul(s ^ s >>> 15, 1 | s);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  function hash(i, j) { var n = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return n - Math.floor(n); }
  function stoej(x, z) {
    var i = Math.floor(x), j = Math.floor(z), fx = x - i, fz = z - j;
    fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
    var a = hash(i, j), b = hash(i + 1, j), c = hash(i, j + 1), d = hash(i + 1, j + 1);
    return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
  }
  function hex(h) { return [parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255]; }
  function blend(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }

  /* ---------- haven ---------- */
  var AAR = ['foraar', 'sommer', 'efteraar', 'vinter'];
  var AAR_SIG = {
    foraar: 'Det er forår. Nu kan vi så frø i bedene.',
    sommer: 'Det er sommer. Husk at vande, så vokser det.',
    efteraar: 'Det er efterår. Høst det hele, før vinteren kommer.',
    vinter: 'Det er vinter. Haven sover under sneen, og Pelle sover vintersøvn.'
  };
  /* Otte bede i to raekker. Hver afgroede har mindst ét bed, saa hvert oenske kan opfyldes. */
  var AFGROEDER = ['gulerod', 'tomat', 'jordbaer', 'salat', 'agurk', 'peberfrugt', 'gulerod', 'salat'];
  var BED_X = [-21, -7, 7, 21], BED_Z = [-9, 4];
  var BED_B = 10, BED_D = 6, BED_H = 1.2;
  var KURV = { x: 17, z: 15 };
  var PELLE = { x: -13, z: 24 };
  var PELLE_TO = { x: 0, z: 24 };   // med to spillere staar Pelle i midten, mellem de to raekker redskaber
  var AEBLER = [[-29, 14.5], [-25, 16], [-27.5, 11.5], [-23.5, 12.5], [-30.5, 10.5]];   // x og hoejde i traeet
  var AEBLE_Z = -25.2;
  var TRIN = ['saaet', 'spire', 'plante', 'moden'];
  var VAEKST = { saaet: 0.5, spire: 2, plante: 2.4, moden: 3 };   // sekunder om at vokse faerdig i hvert trin
  var TOERST_EFTER = 16;   // sommer: saa laenge uden vand, og planten haenger
  var POS = [[0], [-2.2, 2.2], [-3, 0, 3]];   // hvor afgroederne sidder i bedet, naar der er 1, 2 eller 3

  /* ---------- ordene ---------- */
  var AFGR_ALLE = ['gulerod', 'tomat', 'jordbaer', 'salat', 'agurk', 'peberfrugt'];
  var ORD = {   // ental, flertal, intetkoen
    gulerod: ['gulerod', 'gulerødder', 0], tomat: ['tomat', 'tomater', 0], jordbaer: ['jordbær', 'jordbær', 1],
    salat: ['salathoved', 'salathoveder', 1], agurk: ['agurk', 'agurker', 0], peberfrugt: ['peberfrugt', 'peberfrugter', 0]
  };
  var TAL = ['nul', 'én', 'to', 'tre', 'fire', 'fem', 'seks'];
  var KATEGORI = {
    roed:  { navn: 'noget rødt', en: 'rød ting', flere: 'røde ting', spoerg: 'Hvad er rødt i haven?', medlemmer: ['tomat', 'jordbaer', 'peberfrugt'], farve: '#d95f45' },
    groen: { navn: 'noget grønt', en: 'grøn ting', flere: 'grønne ting', spoerg: 'Hvad er grønt i haven?', medlemmer: ['salat', 'agurk'], farve: '#7fa955' },
    jord:  { navn: 'noget, der gror nede i jorden', en: 'ting, der gror nede i jorden', flere: 'ting, der gror nede i jorden', spoerg: 'Hvad gror nede i jorden?', medlemmer: ['gulerod'], farve: '#8a663d' }
  };
  var TAK = {
    gulerod: 'Tak! Nu kan jeg lave gulerodssuppe.', tomat: 'Tak! Tomater er gode i suppen.', jordbaer: 'Tak! Jordbær er det bedste, jeg ved.',
    salat: 'Tak! Så får jeg salat til maden.', agurk: 'Tak! Agurk er dejligt sprødt.', peberfrugt: 'Tak! Peberfrugt giver farve i gryden.'
  };
  var TAK_BLANDET = 'Tak! Det bliver en lækker suppe.';

  function antalOrd(n, afgr) { var o = ORD[afgr]; return (n === 1 ? (o[2] ? 'ét' : 'én') : TAL[n]) + ' ' + (n === 1 ? o[0] : o[1]); }
  function passer(del, afgr) { return del.afgr ? del.afgr === afgr : KATEGORI[del.kat].medlemmer.indexOf(afgr) >= 0; }
  function delTekst(d, n) {
    if (d.afgr) return antalOrd(n, d.afgr);
    var k = KATEGORI[d.kat];
    return n === 1 ? (d.kat === 'jord' ? 'én ting, der gror nede i jorden' : 'én ' + k.en) : TAL[n] + ' ' + k.flere;
  }
  function oenskeTekst(oenske, nyt) {
    var tekst = 'Pelle ønsker sig ' + oenske.dele.map(function (d) { return d.afgr || d.antal > 1 ? delTekst(d, d.antal) : KATEGORI[d.kat].navn; }).join(' og ') + '.';
    var kat = oenske.dele.filter(function (d) { return d.kat; })[0];
    if (kat) tekst += ' ' + KATEGORI[kat.kat].spoerg;
    else if (nyt) tekst += ' Kan I finde bedet med skiltet?';
    return tekst;
  }
  function stort(t) { return t.replace(/^./, function (c) { return c.toUpperCase(); }); }

  /* ---------- en have ---------- */
  function ny(kroge) {
    var k = kroge || {};
    var tal = k.tilfaeldig || Math.random;
    function tilf(a, b) { return a + Math.floor(tal() * (b - a + 1)); }
    function vaelg(liste) { return liste[Math.floor(tal() * liste.length)]; }

    var H = {
      tid: 0, aar: 'foraar', niveau: 1, bede: [], oenske: null, naesteOenske: 0, sidsteOenske: '', oenskeNr: 0,
      pelleFaaet: [], pelleHop: 0, pelleDy: 0, kurv: [], flyvere: [], gemteFroe: {}, regn: null, naesteRegn: 0, skift: null,
      kanin: { x: -12, z: 17, dy: 0, fase: 'rundt', naeste: 20 },
      fugl: { x: 12, y: 0, z: 17, dy: 0, alfa: 0, flyver: false, fase: 'vaek' },
      aebler: AEBLER.map(function (p) { return { x: p[0], y: p[1], z: AEBLE_Z, alfa: 1 }; }),
      hint: {}, sagt: '', oenskerFaaet: 0, pelle: { x: PELLE.x, z: PELLE.z }
    };
    BED_Z.forEach(function (z, r) {
      BED_X.forEach(function (x, i) { H.bede.push({ nr: H.bede.length, x: x, z: z, afgr: AFGROEDER[r * 4 + i], fase: 'tom', vaekst: 1, vaad: 0, rys: 0, antal: 0, siden: 0 }); });
    });

    function sig(t) { H.sagt = t; if (k.sig) k.sig(t); }
    function sigKoe(t) { H.sagt = t; if (k.sigKoe) k.sigKoe(t); else if (k.sig) k.sig(t); }
    function lyd(navn, n) { if (k.lyd) k.lyd(navn, n); }
    function gnist(x, y, z, n) { if (k.gnist) k.gnist(x, y, z, n); }
    /* En hjaelp siges én gang, eller igen efter et stykke tid */
    function hint(noegle, tekst) {
      if (H.hint[noegle] !== undefined && H.tid - H.hint[noegle] < 25) return;
      H.hint[noegle] = H.tid; sig(tekst);
    }
    function vandPaa(bd, kraft) { bd.vaad = 5; bd.siden = 0; if (k.vand) k.vand(bd, kraft || 26); }
    function rys(bd) { bd.rys = 1; lyd('nej'); }

    function oenskerSig(afgr) { return !!H.oenske && H.oenske.dele.some(function (d) { return d.faaet + d.paaVej < d.antal && passer(d, afgr); }); }

    function nytOenske() {
      var nr = H.oenskeNr++, dele = [], n = H.niveau;
      var en = vaelg(AFGR_ALLE.filter(function (a) { return a !== H.sidsteOenske; }));
      var kat = nr % 3 === 2 ? vaelg(['roed', 'groen', 'jord']) : null;
      if (n === 1) dele.push(kat ? { kat: kat, antal: 1 } : { afgr: en, antal: tilf(1, 3) });
      else if (n === 2) dele.push(kat ? { kat: kat, antal: tilf(2, 3) } : { afgr: en, antal: tilf(2, 5) });
      else {
        var anden = AFGR_ALLE.filter(function (a) { return a !== en && (!kat || KATEGORI[kat].medlemmer.indexOf(a) < 0); });
        dele.push(kat ? { kat: kat, antal: tilf(1, 2) } : { afgr: en, antal: tilf(1, 3) });
        dele.push({ afgr: vaelg(anden), antal: tilf(1, 3) });
      }
      dele.forEach(function (d) { d.faaet = 0; d.paaVej = 0; });
      H.oenske = { dele: dele }; H.sidsteOenske = dele[0].afgr || '';
      sig(oenskeTekst(H.oenske, true));
    }
    function sigOenske() {
      if (H.oenske) sig(oenskeTekst(H.oenske, false));
      else if (H.aar === 'vinter') sig('Pelle sover vintersøvn.');
    }

    /* Et tryk paa et bed med et redskab. Forkert redskab er aldrig straf: bedet rokker, og stemmen hjaelper. */
    function arbejd(bd, redskab) {
      if (H.skift) return;
      if (H.aar === 'vinter') { rys(bd); if (k.sne) k.sne(bd); hint('vinter', 'Haven sover. Vi venter til foråret.'); return; }
      var klar = bd.vaekst >= 1, trin = TRIN.indexOf(bd.fase);
      if (redskab === 'froe') {
        if (bd.fase === 'tom') {
          bd.fase = 'saaet'; bd.vaekst = 0; bd.saaetTid = H.tid; bd.antal = tilf(1, 3); lyd('saa');
          hint('saaet', 'Frøene er i jorden. Nu skal de have vand.');
        } else { rys(bd); hint('harFroe', bd.fase === 'moden' ? 'Den er klar. Tag kurven og høst.' : 'Her er der allerede frø. Giv dem vand.'); }
      } else if (redskab === 'vand') {
        if (bd.fase === 'tom') { vandPaa(bd, 12); lyd('plask'); hint('ingenFroe', 'Her er ingen frø endnu. Tag frøposen først.'); }
        else if (bd.toerst) { vandPaa(bd); lyd('plask'); bd.toerst = false; gnist(bd.x, 3, bd.z, 8); lyd('glad'); hint('glad', 'Ah, nu er den glad igen.'); }
        else if (trin >= 0 && trin < 3 && klar) {
          vandPaa(bd); lyd('plask'); bd.fase = TRIN[trin + 1]; bd.vaekst = 0;
          lyd('trin', trin);   // hvert trin sin tone, hoejere og hoejere
          if (bd.fase === 'spire') hint('trinSpire', 'Frøet er blevet til en spire.');
          else if (bd.fase === 'plante') hint('trinPlante', 'Spiren er blevet til en plante med blade. Én gang vand mere.');
        } else { vandPaa(bd, 10); lyd('plask'); if (bd.fase === 'moden') hint('nokVand', 'Den har fået vand nok. Nu kan den høstes.'); }
      } else if (redskab === 'kurv') {
        if (bd.fase === 'moden' && klar && bd.toerst) { rys(bd); hint('toerstHoest', 'Den er tørstig. Giv den vand først.'); }
        else if (bd.fase === 'moden' && klar) hoest(bd);
        else { rys(bd); hint('ikkeKlar', bd.fase === 'tom' ? 'Her er ikke noget at høste. Så nogle frø.' : 'Den er ikke færdig endnu. Giv den vand.'); }
      }
    }

    /* Hoest: bedet giver 1 til 3. Det, Pelle oensker sig, flyver hen til ham, og stemmen taeller med. Resten kommer i kurven. */
    function hoest(bd) {
      var n = bd.antal || 2, afgr = bd.afgr, tilPelle = 0, sidste = null;
      POS[n - 1].forEach(function (dx, i) {
        var del = H.oenske ? H.oenske.dele.filter(function (d) { return d.faaet + d.paaVej < d.antal && passer(d, afgr); })[0] : null;
        var f = { tx: afgr, fra: [bd.x + dx, afgr === 'gulerod' ? 0 : 1.3, bd.z], t: -i * 0.35, h: 3.2 };
        if (del) { del.paaVej++; f.del = del; f.til = [H.pelle.x + 1.5, 4, H.pelle.z]; tilPelle++; sidste = f; }
        else f.til = [KURV.x + (tal() - 0.5) * 2, 2.6, KURV.z];
        H.flyvere.push(f);
      });
      if (sidste) sidste.sidste = true;
      bd.fase = 'tom'; bd.vaekst = 1; bd.toerst = false; bd.antal = 0;
      lyd('hoest'); gnist(bd.x, 3, bd.z, 24);
      /* Stemmen siger, hvor mange der blev hoestet, og hvad det hedder */
      var linje = stort(antalOrd(n, afgr)) + '!';
      if (afgr === 'gulerod' && H.hint.opAfJorden === undefined) { H.hint.opAfJorden = H.tid; linje += ' Guleroden kom op af jorden.'; }
      sig(linje);
      if (!tilPelle) hint('hoestet', 'Den kommer i kurven.');
      /* Om efteraaret giver planten nye frø til naeste aar */
      if (H.aar === 'efteraar' && !H.gemteFroe[afgr]) {
        H.gemteFroe[afgr] = true;
        if (k.froe) k.froe(bd);
        sigKoe('Planten gav også nye frø. Dem gemmer vi i frøposen til foråret.');
      }
    }
    /* Hver gang én lander hos Pelle, taeller stemmen, og en prik i boblen bliver fyldt */
    function landetHosPelle(f) {
      var d = f.del; d.paaVej--; d.faaet++;
      if (!H.oenske || H.oenske.dele.indexOf(d) < 0) { H.kurv.push(f.tx); return; }   // aarstiden skiftede undervejs
      H.pelleFaaet.push(f.tx); H.pelleHop = 0.6; lyd('tael', d.faaet);
      sigKoe(TAL[d.faaet].replace('é', 'e'));
      if (!f.sidste) return;
      if (H.oenske.dele.every(function (x) { return x.faaet >= x.antal; })) { pelleFaar(); return; }
      var mangler = H.oenske.dele.filter(function (x) { return x.faaet < x.antal; }).map(function (x) { return delTekst(x, x.antal - x.faaet); });
      sigKoe('Tak! Jeg mangler ' + mangler.join(' og ') + ' mere.');
    }
    /* Pelle faar hele sit oenske: han hopper, takker, og lidt efter oensker han sig noget nyt */
    function pelleFaar() {
      var d = H.oenske.dele;
      H.pelleHop = 1; H.oenske = null; H.naesteOenske = H.tid + 7; H.oenskerFaaet++;
      lyd('pelle'); gnist(H.pelle.x, 6, H.pelle.z, 30);
      sigKoe(d.length === 1 && d[0].afgr ? TAK[d[0].afgr] : TAK_BLANDET);
    }
    function modenLinje(bd) {
      var a = bd.afgr;
      if (a === 'gulerod') hint('modenGulerod', 'Guleroden er færdig. Den gror nede i jorden. Kun de grønne blade er oppe.');
      else if (a === 'salat') hint('modenSalat', 'Salaten er færdig. Den gror oven på jorden.');
      else hint('moden' + a, 'Nu hænger der ' + ORD[a][1] + ' på planten. Tag kurven og høst.');
    }

    /* Dyrene, der vil have noget fra haven: tryk paa dem, saa gaar de. Aldrig straf, kun et trin tilbage. */
    function jagKanin() {
      var K = H.kanin;
      if (K.fase !== 'hen' && K.fase !== 'spiser') return false;
      K.fase = 'flygter'; if (K.bed) K.bed.gnav = 0;
      lyd('kanin'); hint('kaninVaek', 'Hop hop! Kaninen hopper hjem.');
      return true;
    }
    function jagFugl() {
      var T = H.fugl;
      if (T.fase !== 'kommer' && T.fase !== 'pikker') return false;
      T.fase = 'flyver'; T.t = 0;
      lyd('fugl'); hint('fuglVaek', 'Fuglen flyver væk. Giv frøene vand, så er de sikre.');
      return true;
    }
    /* Aeblerne i traeet om efteraaret: med kurven plukkes de */
    function aeble(a, redskab) {
      if (H.aar !== 'efteraar' || a.alfa <= 0) return false;
      if (redskab !== 'kurv') { hint('aeble', 'Tag kurven, så kan du plukke æblet.'); return false; }
      a.alfa = 0;
      H.flyvere.push({ tx: 'aeble', fra: [a.x, a.y, a.z], til: [KURV.x, 2.6, KURV.z], t: 0, h: 2 });
      lyd('aeble');
      return true;
    }

    /* Aarstiden skifter: kameraet glider en smule rundt, og midtvejs er det den nye aarstid */
    function naesteAar() {
      if (H.skift) return;
      H.skift = { t: 0, til: AAR[(AAR.indexOf(H.aar) + 1) % 4], skiftet: false };
      lyd('aar');
    }
    function saetAar(a) {
      H.aar = a;
      var daekket = a === 'vinter' && H.bede.some(function (bd) { return bd.fase !== 'tom'; });
      if (a === 'vinter' || a === 'foraar') H.bede.forEach(function (bd) { bd.fase = 'tom'; bd.vaekst = 1; bd.antal = 0; });   // haven sover: sneen daekker bedene
      if (a === 'foraar') H.kurv = [];
      if (a === 'foraar' || a === 'efteraar') H.aebler.forEach(function (x) { x.alfa = 1; });
      H.bede.forEach(function (bd) { bd.toerst = false; bd.siden = 0; bd.gnav = 0; });
      H.kanin.fase = 'rundt'; H.kanin.naeste = H.tid + 22; H.kanin.bed = null;
      H.fugl.fase = 'vaek'; H.fugl.bed = null;
      H.oenske = null; H.naesteOenske = a === 'vinter' ? 1e9 : H.tid + 5;
      H.regn = null; H.naesteRegn = H.tid + 18;
      var froeLinje = a === 'foraar' && Object.keys(H.gemteFroe).length ? ' Vi har frø fra sidste år i frøposen.' : '';
      if (a === 'foraar') H.gemteFroe = {};
      sig(AAR_SIG[a] + (daekket ? ' Sneen dækkede det, der ikke blev høstet.' : '') + froeLinje);
    }
    /* En ny have: foraar, tomme bede, den valgte svaerhed og én eller to spillere */
    function nulstil(niveau, spillere) {
      var pl = spillere === 2 ? PELLE_TO : PELLE;
      H.pelle = { x: pl.x, z: pl.z };
      H.niveau = niveau || 1; H.oenskeNr = 0; H.sidsteOenske = ''; H.pelleFaaet = []; H.flyvere = []; H.kurv = [];
      H.gemteFroe = {}; H.skift = null; H.hint = {}; H.oenskerFaaet = 0;
      H.bede.forEach(function (bd) { bd.vaad = 0; bd.rys = 0; bd.meldt = false; });
      H.kanin.x = -12; H.kanin.z = 17;
      saetAar('foraar');
    }

    function mod(u, x, z, fart, dt) {   // gaa hen mod et punkt med hoejst en fart; sand, naar man er der
      var dx = x - u.x, dz = z - u.z, d = Math.hypot(dx, dz);
      if (d < 0.3) return true;
      var s = Math.min(1, fart * dt / d); u.x += dx * s; u.z += dz * s;
      return false;
    }
    /* Kaninen: hopper langs stien, og en gang imellem hen og gnasker i et bed med blade */
    function opdaterKanin(dt) {
      var K = H.kanin, tid = H.tid;
      if (H.aar === 'vinter') return;
      K.dy = Math.abs(Math.sin(tid * (K.fase === 'flygter' ? 9 : 5))) * (K.fase === 'spiser' ? 0.2 : 1.4);
      if (K.fase === 'rundt') {
        mod(K, Math.sin(tid * 0.22) * 26, 17 + Math.sin(tid * 0.5) * 1.2, 7, dt);
        if (tid > K.naeste && !H.skift) {
          var mad = H.bede.filter(function (bd) { return (bd.fase === 'plante' || bd.fase === 'moden') && bd.vaekst >= 1; });
          if (mad.length) { K.bed = vaelg(mad); K.fase = 'hen'; }
          else K.naeste = tid + 6;
        }
      } else if (K.fase === 'hen') {
        if (K.bed.fase !== 'plante' && K.bed.fase !== 'moden') { K.fase = 'rundt'; K.naeste = tid + 10; return; }
        if (mod(K, K.bed.x + 3, K.bed.z + BED_D / 2 + 1.3, 8, dt)) {
          K.fase = 'spiser'; K.t = 0;
          hint('kanin', 'Åh nej, kaninen gnasker i bedet! Tryk på den, så hopper den væk.');
        }
      } else if (K.fase === 'spiser') {
        K.t += dt; K.bed.gnav = K.t / 8;
        if (K.bed.fase !== 'plante' && K.bed.fase !== 'moden') { K.fase = 'flygter'; K.bed.gnav = 0; return; }
        if (K.t > 8) {   // kaninen fik et par blade: planten gaar et trin tilbage, og kaninen hopper maet hjem
          K.bed.fase = K.bed.fase === 'moden' ? 'plante' : 'spire'; K.bed.vaekst = 1; K.bed.gnav = 0; K.bed.rys = 1;
          lyd('spiste'); K.fase = 'flygter';
          hint('kaninSpiste', 'Kaninen spiste lidt. Giv planten vand, så vokser den igen.');
        }
      } else if (K.fase === 'flygter') {
        if (mod(K, 48, 19, 16, dt)) { K.fase = 'rundt'; K.naeste = tid + 26 + tal() * 12; K.x = -48; }
      }
    }
    /* Fuglen: kommer, hvis frø ligger og venter paa vand, og pikker dem op, hvis ingen jager den */
    function opdaterFugl(dt) {
      var f = H.fugl, tid = H.tid;
      if (H.aar === 'vinter') { f.alfa = 1; f.flyver = false; f.y = 0; f.x = 12 + Math.sin(tid * 0.5) * 6; f.z = 17; f.dy = Math.max(0, Math.sin(tid * 7)) * 0.8; return; }
      if (f.fase === 'vaek') {
        f.alfa = 0;
        var ventende = H.bede.filter(function (bd) { return bd.fase === 'saaet' && bd.vaekst >= 1 && tid - (bd.saaetTid === undefined ? tid : bd.saaetTid) > 7; });
        if (ventende.length && !H.skift) {
          f.bed = ventende[0]; f.fase = 'kommer'; f.t = 0; f.x = f.bed.x + 30; f.z = f.bed.z - 20; f.y = 26;
          hint('fugl', 'Se, fuglen vil spise frøene! Tryk på den.');
        }
        return;
      }
      f.alfa = 1; f.flyver = f.fase !== 'pikker';
      if (f.fase === 'kommer') {
        f.t += dt / 2.2; var t = Math.min(1, f.t);
        f.x = mix(f.bed.x + 30, f.bed.x + 1, t); f.z = mix(f.bed.z - 20, f.bed.z, t); f.y = mix(26, 1.1, t) + Math.sin(t * Math.PI) * 4;
        if (f.bed.fase !== 'saaet') { f.fase = 'flyver'; f.t = 0; }
        else if (t >= 1) { f.fase = 'pikker'; f.t = 0; }
      } else if (f.fase === 'pikker') {
        f.t += dt; f.dy = Math.max(0, Math.sin(tid * 12)) * 0.5;
        if (f.bed.fase !== 'saaet') { f.fase = 'flyver'; f.t = 0; }
        else if (f.t > 6) {
          f.bed.fase = 'tom'; f.bed.vaekst = 1; f.bed.rys = 1; f.bed.antal = 0; f.fase = 'flyver'; f.t = 0; lyd('spiste');
          hint('fuglSpiste', 'Fuglen spiste frøene. Så nye, og giv dem vand.');
        }
      } else if (f.fase === 'flyver') {
        f.t += dt; f.dy = 0; f.y += dt * 14; f.x += dt * 16; f.z -= dt * 8;
        if (f.t > 2.5) { f.fase = 'vaek'; H.bede.forEach(function (bd) { if (bd.fase === 'saaet') bd.saaetTid = tid; }); }
      }
    }

    function opdater(dt) {
      H.tid += dt;
      var tid = H.tid;
      if (H.skift) {
        H.skift.t += dt / 3.2;
        if (!H.skift.skiftet && H.skift.t > 0.5) { H.skift.skiftet = true; saetAar(H.skift.til); }
        if (H.skift.t >= 1) H.skift = null;
      }
      H.bede.forEach(function (bd) {
        if (bd.vaekst < 1 && H.aar !== 'vinter') bd.vaekst = Math.min(1, bd.vaekst + dt / (VAEKST[bd.fase] || 1));
        bd.vaad = Math.max(0, bd.vaad - dt); bd.rys = Math.max(0, bd.rys - dt * 2.5); bd.siden += dt;
        /* Sommerens sol: en plante, der ikke har faaet vand laenge, haenger, indtil nogen vander den */
        if (H.aar === 'sommer' && !bd.toerst && bd.vaekst >= 1 && (bd.fase === 'spire' || bd.fase === 'plante' || bd.fase === 'moden') && bd.siden > TOERST_EFTER) {
          bd.toerst = true; hint('toerst', 'Solen skinner varmt, og planten hænger. Giv den vand.');
        }
        if (bd.fase === 'moden' && bd.vaekst >= 1 && !bd.meldt) { bd.meldt = true; gnist(bd.x, 3.5, bd.z, 10); lyd('moden'); modenLinje(bd); }
        if (bd.fase !== 'moden') bd.meldt = false;
      });
      /* Foraarets byger vander alle saaede bede: naturen hjaelper */
      if (H.aar === 'foraar' && !H.regn && tid > H.naesteRegn && H.bede.some(function (bd) { return bd.fase === 'saaet' || bd.fase === 'spire' || bd.fase === 'plante'; })) {
        H.regn = { t: 0 }; hint('regn', 'Det regner. Regnen vander haven.');
      }
      if (H.regn) {
        H.regn.t += dt;
        if (H.regn.t > 2 && !H.regn.vandet) {
          H.regn.vandet = true;
          H.bede.forEach(function (bd) {
            var tr = TRIN.indexOf(bd.fase);
            if (tr >= 0 && tr < 3 && bd.vaekst >= 1) { bd.fase = TRIN[tr + 1]; bd.vaekst = 0; }
            if (bd.fase !== 'tom') { bd.vaad = 5; bd.siden = 0; bd.toerst = false; }
          });
        }
        if (H.regn.t > 5) { H.regn = null; H.naesteRegn = tid + 30; }
      }
      H.flyvere.forEach(function (f) {
        f.t += dt / 0.9;
        if (f.t >= 1 && !f.landet) {
          f.landet = true;
          if (f.del) landetHosPelle(f); else { H.kurv.push(f.tx); lyd('kurv'); }
        }
      });
      H.flyvere = H.flyvere.filter(function (f) { return !f.landet; });
      /* Pelle hopper, naar han faar noget, og vugger lidt, mens han venter. Om vinteren sover han. */
      H.pelleHop = Math.max(0, H.pelleHop - dt * 1.6);
      H.pelleDy = H.pelleHop > 0 ? Math.sin(H.pelleHop * Math.PI) * 3 : (H.aar === 'vinter' ? 0 : Math.abs(Math.sin(tid * 1.5)) * 0.25);
      if (!H.oenske && H.aar !== 'vinter' && !H.skift && tid > H.naesteOenske) nytOenske();
      opdaterKanin(dt); opdaterFugl(dt);
    }

    H.opdater = opdater; H.arbejd = arbejd; H.jagKanin = jagKanin; H.jagFugl = jagFugl; H.aeble = aeble;
    H.naesteAar = naesteAar; H.saetAar = saetAar; H.nulstil = nulstil; H.sigOenske = sigOenske; H.oenskerSig = oenskerSig;
    return H;
  }

  var Haven = {
    sub: sub, dot: dot, cross: cross, norm: norm, mix: mix, klem: klem, jaevn: jaevn, tilfaeldig: tilfaeldig, stoej: stoej, hex: hex, blend: blend,
    AAR: AAR, AAR_SIG: AAR_SIG, AFGROEDER: AFGROEDER, AFGR_ALLE: AFGR_ALLE, BED_B: BED_B, BED_D: BED_D, BED_H: BED_H,
    KURV: KURV, PELLE: PELLE, PELLE_TO: PELLE_TO, TRIN: TRIN, POS: POS, ORD: ORD, TAL: TAL, KATEGORI: KATEGORI, TAK: TAK, TAK_BLANDET: TAK_BLANDET,
    antalOrd: antalOrd, delTekst: delTekst, oenskeTekst: oenskeTekst, passer: passer, ny: ny
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Haven: Haven };
  else rod.Haven = Haven;
})(this);
