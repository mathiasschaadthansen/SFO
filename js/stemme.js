/**
 * Stemmen til spil, der taler i hele saetninger: rigtige klip, hvor de
 * findes, ellers enhedens egen danske stemme.
 *
 * Klippene ligger i spillets lyd/ og staar i lyd/klip.json som
 * { "saetning": "fil.mp3" }. En replik deles i saetninger, og den laengste
 * raekke saetninger, der har ét klip, bruges ad gangen. Saa spilles en hel
 * replik, der er indtalt i ét stykke, som ét klip, mens en sammensat replik
 * ("Pelle ønsker sig to gulerødder. Og så én agurk.") spilles som flere
 * klip lige efter hinanden. Mangler et klip, siger enhedens stemme hele
 * replikken, og kun en stemme, der ligger paa enheden (localService), saa
 * intet gaar over nettet.
 *
 * Klippene laves én gang med vaerktoej/lav-lyd-gemini.py.
 */
(function (rod) {
  'use strict';

  /** Replikken delt i saetninger, hver med sit tegn til sidst. Uden lookbehind, som gamle iPads ikke kan. */
  function saetninger(tekst) {
    return (String(tekst).match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).map(function (s) { return s.trim(); }).filter(Boolean);
  }
  /** Filerne til en replik: den laengste kendte raekke saetninger ad gangen. null, hvis noget mangler. */
  function del(tekst, kendt) {
    var s = saetninger(tekst), ud = [], i = 0;
    while (i < s.length) {
      var til = 0;
      for (var j = s.length; j > i; j--) {
        var fil = kendt[s.slice(i, j).join(' ')];
        if (fil) { ud.push(fil); til = j; break; }
      }
      if (!til) return null;
      i = til;
    }
    return ud.length ? ud : null;
  }

  /**
   * valg: mappe (fx 'lyd/'), kontekst() giver spillets AudioContext eller null,
   * til() siger, om lyden er slaaet til, og rate er enhedens taletempo.
   */
  function ny(valg) {
    var mappe = valg.mappe || 'lyd/', kendt = {}, buffere = {}, kilder = [], slut = 0, gen = 0, kaede = Promise.resolve();
    var stemme = null;

    if (typeof fetch === 'function') {
      fetch(mappe + 'klip.json').then(function (r) { return r.ok ? r.json() : {}; })
        .then(function (m) { kendt = m || {}; }).catch(function () { /* ingen klip, enhedens stemme bruges */ });
    }
    function findStemme() {
      try { stemme = window.speechSynthesis.getVoices().filter(function (s) { return /^da/i.test(s.lang) && s.localService; })[0] || null; } catch (e) { stemme = null; }
    }
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      findStemme();
      window.speechSynthesis.addEventListener ? window.speechSynthesis.addEventListener('voiceschanged', findStemme) : (window.speechSynthesis.onvoiceschanged = findStemme);
    }

    function hent(fil) {
      if (!buffere[fil]) {
        buffere[fil] = fetch(mappe + fil).then(function (r) { if (!r.ok) throw new Error(fil); return r.arrayBuffer(); })
          .then(function (ab) { return new Promise(function (ok, nej) { valg.kontekst().decodeAudioData(ab, ok, nej); }); });
        buffere[fil].catch(function () { delete buffere[fil]; });
      }
      return buffere[fil];
    }
    function enhedensStemme(tekst, afbryd, faerdig) {
      if (!window.speechSynthesis || !stemme) return;
      try {
        if (afbryd) window.speechSynthesis.cancel();
        var u = new SpeechSynthesisUtterance(tekst);
        u.voice = stemme; u.lang = stemme.lang; u.rate = valg.rate || 0.9; u.pitch = 1.05;
        var g = gen;
        if (faerdig) u.onend = function () { if (g === gen) faerdig(); };
        window.speechSynthesis.speak(u);
      } catch (e) { /* stemmen er pynt */ }
    }
    function tie() {
      gen++;
      kilder.forEach(function (k) { try { k.stop(); } catch (e) { /* allerede stoppet */ } });
      kilder = []; slut = 0; kaede = Promise.resolve();
      try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* intet */ }
    }
    /* afbryd: det, der bliver sagt nu, stopper. Ellers kommer replikken i koe efter det, der allerede siges. */
    function tal(tekst, afbryd, faerdig, varer) {
      if (valg.til && !valg.til()) return;
      if (afbryd) tie();
      var filer = del(tekst, kendt), k = valg.kontekst && valg.kontekst();
      if (!filer || !k) { enhedensStemme(tekst, afbryd, faerdig); return; }
      var g = gen;
      kaede = kaede.then(function () { return Promise.all(filer.map(hent)); }).then(function (bufs) {
        if (g !== gen) return;
        var t = Math.max(k.currentTime + 0.03, slut), sidste = null, start = t;
        bufs.forEach(function (b) {
          var kilde = k.createBufferSource(); kilde.buffer = b; kilde.connect(k.destination); kilde.start(t);
          t += b.duration; kilder.push(kilde); sidste = kilde;
          kilde.onended = function () { kilder = kilder.filter(function (x) { return x !== kilde; }); if (kilde === sidste && faerdig && g === gen) faerdig(); };
        });
        slut = t + 0.15;   // en lille pause mellem replikker
        if (varer) varer(t - k.currentTime, start - k.currentTime);
      }).catch(function () { if (g === gen) enhedensStemme(tekst, false, faerdig); });
    }

    return {
      sig: function (tekst, faerdig, varer) { tal(tekst, true, faerdig, varer); },
      koe: function (tekst, faerdig, varer) { tal(tekst, false, faerdig, varer); },
      tie: tie,
      antalKlip: function () { return Object.keys(kendt).length; },
      stemme: function () { return stemme ? stemme.name : null; }
    };
  }

  var Stemme = { saetninger: saetninger, del: del, ny: ny };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Stemme: Stemme };
  else rod.Stemme = Stemme;
})(this);
