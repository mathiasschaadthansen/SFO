/**
 * Himmelvejen: selve flyvningen og brevene, uden tegning.
 *
 * Sanne flyver med en fast fart. Styringen er et drej (-1 til 1) og et
 * stig (-1 til 1, eller null, saa flyver hun selv i marchhoejde og ned mod
 * dyrene, naar hun leder). Trykker barnet paa et dyr, flyver hun selv
 * derhen: det, barnet skal laere, er at vaelge ud fra ordet, ikke at ramme.
 *
 * Alt, der skal ses eller hoeres, meldes som haendelser: sig(tekst),
 * lyd(navn), gnist(x, y, z, antal) og hop(dyr). Saa kan testen spille
 * hele turen igennem uden browser.
 */
(function (rod) {
  'use strict';

  var Oe = rod.FlyvOe || (typeof require !== 'undefined' ? require('./oe.js').Oe : null);
  var klem = Oe.klem, mix = Oe.mix, jaevn = Oe.jaevn, vinkelForskel = Oe.vinkelForskel, hoejde = Oe.hoejde;
  var BUD = Oe.BUD, BRO = Oe.BRO, TRAE = Oe.TRAE, STED = Oe.STED;

  var FART = 22, DREJ = 1.05, LOFT = 95, TRAEF = 11;

  function mitte(m) { return m.y + (m.dy || 0) + m.h * 0.5; }

  function ny(dyr, h) {
    h = h || {};
    function sig(t) { if (h.sig) h.sig(t); }
    function lyd(n) { if (h.lyd) h.lyd(n); }
    function gnist(x, y, z, n) { if (h.gnist) h.gnist(x, y, z, n); }
    function hop(m) { if (h.hop) h.hop(m); }

    var F = {
      niveau: 1, spilTid: 0, taleSlut: 0,
      fugl: { x: 0, y: 30, z: 0, h: 0, vy: 0, drej: 0, bank: 0 },
      bud: null, klaret: {}, bro: null, slut: false, dyr: dyr
    };

    /* Hvor lang tid en saetning tager. Stemmen melder selv, naar den er faerdig, hvis den kan. */
    function snak(t) { F.taleSlut = F.spilTid + 1.2 + t.length * 0.072; sig(t); }
    F.taleFaerdig = function () { F.taleSlut = Math.min(F.taleSlut, F.spilTid + 0.2); };

    F.detteBud = function () { return F.bud && F.bud.nr < BUD.length ? BUD[F.bud.nr] : null; };
    F.baererBrev = function () { var f = F.bud && F.bud.fase; return !!F.detteBud() && (f === 'afsted' || f === 'finde' || f === 'rundt'); };

    F.nulstil = function (niveau) {
      F.niveau = niveau || 1; F.spilTid = 0; F.taleSlut = 0; F.slut = false; F.klaret = {};
      F.bud = { nr: 0, fase: 'afsted', rundt: 0, sidstV: null, naeste: 0, valgt: null, valgtTid: 0, rundtSelv: false };
      F.bro = { klaret: false, sagt: false, aktiv: false, sidst: -99 };
      Object.keys(dyr).forEach(function (k) { dyr[k].forEach(function (m) { m.naeste = 0; }); });
      var fu = F.fugl, mS = STED[BUD[0].sted];
      fu.x = Oe.START.x; fu.z = Oe.START.z; fu.h = Math.atan2(mS.x - fu.x, mS.z - fu.z);
      fu.y = Oe.krydsHoejde(fu.x, fu.z); fu.vy = 0; fu.drej = 0; fu.bank = 0;
      snak(BUD[0].start);
    };

    /* Tryk paa et dyr: Sanne flyver selv derhen */
    F.vaelg = function (m) {
      var b = F.detteBud();
      if (!b || b.ord === 'rundtom' || dyr[b.sted].indexOf(m) < 0) return false;
      if (F.bud.fase !== 'afsted' && F.bud.fase !== 'finde') return false;
      F.bud.valgt = m; F.bud.valgtTid = F.spilTid;
      if (F.bud.fase === 'afsted') F.bud.fase = 'finde';
      lyd('valgt');
      return true;
    };
    /* Tryk paa det store trae: Sanne flyver selv en tur rundt om det */
    F.rundtOmTrae = function () {
      var b = F.detteBud();
      if (!b || b.ord !== 'rundtom' || F.bud.rundtSelv || (F.bud.fase !== 'afsted' && F.bud.fase !== 'rundt')) return false;
      F.bud.rundtSelv = true; lyd('valgt');
      return true;
    };
    /* Tryk paa boblen: hoer det, der sidst blev sagt om brevet, igen */
    F.gentag = function () {
      var b = F.detteBud(); if (!b) return;
      snak(F.bud.fase === 'afsted' ? b.start : (F.bud.fase === 'tak' ? b.tak : b.spoerg));
    };

    function leveret(m) {
      var b = F.detteBud();
      F.klaret[b.ord] = true; F.bud.fase = 'tak'; F.bud.naeste = F.spilTid + 2.2; F.bud.valgt = null;
      hop(m); gnist(m.x, mitte(m), m.z, 40); lyd('rigtig');
      snak(b.tak);
    }

    /* Hvor pilen peger hen (kun med én stjerne): mod stedet, aldrig mod det rigtige dyr */
    F.pilMaal = function () {
      var b = F.detteBud();
      if (F.bro && F.bro.aktiv && !F.bro.klaret) return { x: 0, y: BRO.y - 5, z: BRO.z };
      if (!b || F.bud.fase !== 'afsted') return null;
      if (b.ord === 'rundtom') return { x: TRAE.x, y: TRAE.h * 0.6, z: TRAE.z };
      var s = STED[b.sted]; return { x: s.x, y: s.h + 12, z: s.z };
    };

    F.skridt = function (dt, styr) {
      if (F.slut) return;
      F.spilTid += dt;
      var fu = F.fugl, bud = F.bud, b = F.detteBud(), st = styr || { drej: 0, stig: null };
      var valgt = bud.valgt, dV = 0;
      if (valgt && (F.spilTid - bud.valgtTid > 9 || bud.fase !== 'finde')) valgt = bud.valgt = null;
      if (valgt) {   // paa vej hen til det valgte dyr: det styrer sig selv
        var vx = valgt.x - fu.x, vz = valgt.z - fu.z;
        dV = Math.sqrt(vx * vx + vz * vz);
        st = { drej: klem(-vinkelForskel(fu.h, Math.atan2(vx, vz)) * 2.5, -1, 1), stig: klem((mitte(valgt) - fu.y) / 3, -1, 1) };
      }
      if (b && b.ord === 'rundtom' && bud.rundtSelv && (bud.fase === 'afsted' || bud.fase === 'rundt')) {
        var vr = Math.atan2(fu.x - TRAE.x, fu.z - TRAE.z), ret = bud.rundt < 0 ? -1 : 1;
        var dT0 = Math.hypot(fu.x - TRAE.x, fu.z - TRAE.z), frem = dT0 > 45 ? 0 : ret * 0.75;
        var rx = TRAE.x + Math.sin(vr + frem) * 30 - fu.x, rz = TRAE.z + Math.cos(vr + frem) * 30 - fu.z;
        st = { drej: klem(-vinkelForskel(fu.h, Math.atan2(rx, rz)) * 2.2, -1, 1), stig: null };
      }

      /* Drej. Ude over havet drejer hun selv hjem, uanset fingeren; der er ingen mur.
         (Blev fingeren bare lagt oveni, kunne et drej vaek fra oeen gaa lige op, og saa fløj hun ligeud til havs.) */
      var ind = st.drej, afst = Math.sqrt(fu.x * fu.x + fu.z * fu.z);
      if (afst > 232) {
        var dv = vinkelForskel(fu.h, Math.atan2(-fu.x, -fu.z));
        ind = mix(ind, dv > 0 ? -1 : 1, klem((afst - 232) / 25, 0, 1));
      }
      fu.drej = mix(fu.drej, ind, 1 - Math.exp(-dt * 3));
      fu.h -= fu.drej * (valgt ? 2.4 : DREJ) * dt;
      fu.bank = mix(fu.bank, fu.drej * 0.6, 1 - Math.exp(-dt * 4));
      var fart = valgt ? mix(11, FART, klem((dV - 8) / 40, 0, 1)) : FART, fx = Math.sin(fu.h), fz = Math.cos(fu.h);
      fu.x += fx * fart * dt; fu.z += fz * fart * dt;
      if (valgt && dV < 30) {   // det sidste stykke traekkes hun blidt helt hen til dyret
        var trak = (1 - Math.exp(-dt * 3)) * jaevn(30, 6, dV);
        fu.x = mix(fu.x, valgt.x, trak); fu.z = mix(fu.z, valgt.z, trak); fu.y = mix(fu.y, mitte(valgt), trak);
      }

      /* Hoejde */
      var gulv = Math.max(hoejde(fu.x, fu.z), 0) + 3.2, oensketVy;
      if (st.stig !== null && st.stig !== undefined) oensketVy = st.stig * 15;
      else {
        var maalY = Math.max(Oe.krydsHoejde(fu.x, fu.z), Oe.krydsHoejde(fu.x + fx * 25, fu.z + fz * 25), Oe.krydsHoejde(fu.x + fx * 50, fu.z + fz * 50));
        if (b && bud.fase === 'finde') {
          var bedst = null, bd = 1e9;
          dyr[b.sted].forEach(function (m) {
            var dx = m.x - fu.x, dz = m.z - fu.z, d = Math.sqrt(dx * dx + dz * dz);
            if (d > 60 || ((dx * fx + dz * fz) / (d || 1) < 0.6 && d > 10)) return;
            if (d < bd) { bd = d; bedst = m; }
          });
          if (bedst) maalY = mix(maalY, mitte(bedst), jaevn(60, 22, bd));
        }
        if (F.niveau === 1 && !F.bro.klaret && Math.abs(fz) > 0.75 && Math.abs(fu.x) < 20) {   // én stjerne: hun dykker selv under broen
          var dzb = (BRO.z - fu.z) * Math.sign(fz);
          if (dzb > -6 && dzb < 115) maalY = mix(maalY, BRO.y - 4.8, jaevn(115, 60, dzb));
        }
        oensketVy = klem((maalY - fu.y) * 1.4, -17, 14);
      }
      fu.vy = mix(fu.vy, oensketVy, 1 - Math.exp(-dt * 3));
      fu.y += fu.vy * dt;
      if (fu.y < gulv) { fu.y = gulv; fu.vy = Math.max(fu.vy, 0); }
      if (fu.y > LOFT) { fu.y = LOFT; fu.vy = Math.min(fu.vy, 0); }
      /* Broen er fast: man flyver over eller under den, aldrig igennem */
      if (Math.abs(fu.x) < BRO.x1 + 1 && Math.abs(fu.z - BRO.z) < 4.8 && fu.y > BRO.y - 2.6 && fu.y < BRO.y + 2.6) {
        if (fu.y < BRO.y - 0.4) { fu.y = BRO.y - 2.6; fu.vy = Math.min(fu.vy, 0); }
        else { fu.y = BRO.y + 2.6; fu.vy = Math.max(fu.vy, 0); }
      }

      /* Brevet */
      if (b && F.baererBrev()) {
        var mS = STED[b.sted], dS = Math.hypot(fu.x - mS.x, fu.z - mS.z);
        if (b.ord === 'rundtom') {
          var dT = Math.hypot(fu.x - TRAE.x, fu.z - TRAE.z);
          if (bud.fase === 'afsted' && dT < 80) { bud.fase = 'rundt'; bud.rundt = 0; bud.sidstV = null; snak(b.spoerg); }
          else if (bud.fase === 'rundt') {
            if (dT > 118) bud.fase = 'afsted';
            else if (dT > 6 && dT < 85) {
              var vt = Math.atan2(fu.x - TRAE.x, fu.z - TRAE.z);
              if (bud.sidstV !== null) bud.rundt += vinkelForskel(bud.sidstV, vt);
              bud.sidstV = vt;
              if (Math.abs(bud.rundt) > 0.95 * 2 * Math.PI) leveret(dyr.noeddeskoven[0]);
            } else bud.sidstV = null;
          }
        } else {
          if (bud.fase === 'afsted' && dS < 64) { bud.fase = 'finde'; snak(b.spoerg); }
          else if (bud.fase === 'finde' && dS > 118 && !bud.valgt) bud.fase = 'afsted';
          if (bud.fase === 'finde') dyr[b.sted].forEach(function (m) {
            var dx = m.x - fu.x, dz = m.z - fu.z, dy = mitte(m) - fu.y;
            if (dx * dx + dz * dz > TRAEF * TRAEF || Math.abs(dy) > TRAEF || bud.fase !== 'finde') return;
            if (m.ord === b.ord) leveret(m);
            else if (F.spilTid > m.naeste || bud.valgt === m) {
              /* Et forkert dyr: det siger selv, hvor det sidder. Ingen straf. */
              if (bud.valgt === m) bud.valgt = null;
              m.naeste = F.spilTid + 3; hop(m); lyd('forkert');
              snak('Nej, jeg sidder ' + m.hvor + '. ' + b.mangler);
            }
          });
        }
      }
      if (bud.fase === 'tak' && F.spilTid > Math.max(bud.naeste, F.taleSlut + 0.8)) {
        bud.nr++; bud.rundtSelv = false;
        if (bud.nr >= BUD.length) { bud.fase = 'slut'; bud.slutTid = F.spilTid + 0.6; gnist(fu.x, fu.y + 4, fu.z, 60); lyd('slut'); }
        else { bud.fase = 'afsted'; snak(BUD[bud.nr].start); }
      }
      if (bud.fase === 'slut' && F.spilTid > bud.slutTid && F.spilTid > F.taleSlut + 0.5) F.slut = true;

      /* Broen: en udfordring for sig, naar man kommer forbi */
      var bro = F.bro;
      if (!bro.klaret) {
        var dB = Math.hypot(fu.x, fu.z - BRO.z);
        if (Math.abs(fu.x) < 18 && Math.abs(fu.z - BRO.z) < 5 && fu.y < BRO.y - 1) {
          bro.klaret = true; bro.aktiv = false; F.klaret.under = true;
          gnist(fu.x, fu.y, fu.z, 30); lyd('bro'); snak(Oe.BRO_ROS);
        } else {
          if (!bro.sagt && dB < 85 && bud.fase !== 'tak' && bud.fase !== 'slut' && F.spilTid > F.taleSlut + 0.5 && F.spilTid - bro.sidst > 40) {
            bro.sagt = true; bro.aktiv = true; bro.sidst = F.spilTid; snak(Oe.BRO_SPOERG);
          }
          if (bro.aktiv && dB > 115) bro.aktiv = false;
          if (bro.sagt && dB > 170) bro.sagt = false;
        }
      }
    };

    return F;
  }

  var Flyvning = { ny: ny, mitte: mitte, FART: FART };
  if (typeof module !== 'undefined' && module.exports) module.exports = { Flyvning: Flyvning };
  else rod.Flyvning = Flyvning;
})(this);
