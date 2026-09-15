/**
 * Bobler.
 *
 * Skyd boblerne med snoren, saa deler de sig, til de er vaek. Loeb med
 * siderne, skyd med midten. To spillere hjaelper hinanden — banen er
 * klaret sammen, og begge vinder. Ingen liv: rammer en boble dig, er du
 * svimmel et par sekunder.
 *
 * Denne fil er kun skaerm og lyd. Fysik og baner ligger i js/physics.js.
 */
(function () {
  'use strict';

  var INDSTIL = Bobler.INDSTIL;

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

  var FARVER = [
    { lak: '#e8442e', navn: 'Rød' },
    { lak: '#3aa7e0', navn: 'Blå' },
    { lak: '#4cb944', navn: 'Grøn' },
    { lak: '#ffd23f', navn: 'Gul' },
    { lak: '#9b5de5', navn: 'Lilla' },
    { lak: '#ff8c42', navn: 'Orange' }
  ];
  var HATTE = ['kasket', 'hjelm', 'sloejfe'];
  var BOBLEFARVER = ['#3aa7e0', '#4cb944', '#ffd23f'];

  var valg = [{ farve: 0, form: 0 }, { farve: 1, form: 0 }];
  var svaerhed = 0;
  var lydTil = true;

  var lærred = document.getElementById('spil');
  var ctx = lærred.getContext('2d');
  var overlay = document.getElementById('overlay');
  var styring = new Styring(lærred);

  var spil = null;
  var tilstand = 'venter';     // venter | spiller | faerdig
  var antalSpillere = 1;
  var udseende = [null, null];
  var sidsteTid = 0;
  var lyd = null;
  var tid = 0;                 // samlet spilletid til animation
  var flotTekst = 0;           // sekunder tilbage hvor "Flot!" vises
  var partikler = [];
  var vinderCanvas = null;
  var konfetti = [];
  var visning = { skala: 1, ox: 0, oy: 0 };

  /* ---------- lyd ---------- */

  function lydKontekst() {
    if (!lyd) lyd = new (window.AudioContext || window.webkitAudioContext)();
    if (lyd.state === 'suspended') lyd.resume();
    return lyd;
  }

  function tone(frekvens, længde, styrke, type, glid) {
    if (!lydTil) return;
    try {
      var k = lydKontekst();
      var o = k.createOscillator();
      var g = k.createGain();
      o.type = type || 'triangle';
      o.frequency.value = frekvens;
      if (glid) o.frequency.exponentialRampToValueAtTime(glid, k.currentTime + længde);
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

  /* ---------- laerred og zoner ---------- */

  function tilpasStørrelse() {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    lærred.width = Math.floor(window.innerWidth * dpr);
    lærred.height = Math.floor(window.innerHeight * dpr);
    lærred.style.width = window.innerWidth + 'px';
    lærred.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var B = window.innerWidth, H = window.innerHeight;
    visning.skala = Math.min(B / INDSTIL.bredde, H / (INDSTIL.hoejde + 90));
    visning.ox = (B - INDSTIL.bredde * visning.skala) / 2;
    visning.oy = (H - (INDSTIL.hoejde + 90) * visning.skala) / 2;
    opdaterZoner();
  }

  function opdaterZoner() {
    var zoner = [];
    var knapper = ['venstre', 'skyd', 'hoejre'];
    var spillere = antalSpillere === 1 ? 1 : 2;
    for (var s = 0; s < spillere; s++) {
      for (var k = 0; k < 3; k++) {
        var start = s / spillere + k / (3 * spillere);
        zoner.push({ x0: start, x1: start + 1 / (3 * spillere), y0: 0, y1: 1, spiller: s, knap: knapper[k] });
      }
    }
    styring.saetZoner(zoner);
  }

  function sx(x) { return visning.ox + x * visning.skala; }
  function sy(y) { return visning.oy + (INDSTIL.hoejde - y) * visning.skala; }

  /* ---------- spil ---------- */

  function nytSpil(spillere) {
    antalSpillere = spillere;
    Bobler.saetSvaerhed(svaerhed);
    spil = Bobler.nytSpil(spillere);
    for (var i = 0; i < spillere; i++) udseende[i] = { farve: FARVER[valg[i].farve], hat: HATTE[valg[i].form] };
    partikler = [];
    flotTekst = 0;
    tilstand = 'spiller';
    styring.nulstil();
    opdaterZoner();
    melodi([520, 660], 90);
  }

  /* ---------- partikler ---------- */

  function puf(x, y, farve, antal, fart, r, liv) {
    for (var i = 0; i < antal; i++) {
      if (partikler.length > 320) return;
      var v = Math.random() * Math.PI * 2;
      var f = fart * (0.4 + Math.random() * 0.6);
      partikler.push({ x: x, y: y, vx: Math.cos(v) * f, vy: Math.sin(v) * f, liv: liv, maxLiv: liv,
        r: r * (0.6 + Math.random() * 0.8), farve: farve });
    }
  }

  function opdaterPartikler(dt) {
    for (var i = partikler.length - 1; i >= 0; i--) {
      var p = partikler[i];
      p.vy -= 500 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.liv -= dt;
      if (p.liv <= 0 || p.y < -20) partikler.splice(i, 1);
    }
  }

  /* ---------- opdatering ---------- */

  function opdater(dt) {
    tid += dt;
    var inputs = [styring.input(0), styring.input(1)];
    Bobler.opdater(spil, inputs, dt);

    spil.spillere.forEach(function (s) {
      if (s.skoed) tone(500, 0.12, 0.08, 'square', 1400);
      if (s.ramt) {
        tone(200, 0.35, 0.14, 'triangle', 90);
        puf(s.x, INDSTIL.spillerRadius, '#fff', 10, 120, 3, 0.4);
      }
    });
    spil.poppet.forEach(function (p) {
      tone(420 + p.str * 240, 0.14, 0.14, 'sine');
      puf(p.x, p.y, BOBLEFARVER[p.str], 12 + (2 - p.str) * 6, 220, 4, 0.6);
    });
    if (spil.baneKlaret) {
      flotTekst = 1.6;
      melodi([660, 880, 1100], 90);
      for (var c = 0; c < 6; c++) puf(200 + c * 120, 420, FARVER[c].lak, 12, 260, 5, 1.3);
      if (spil.faerdig) afslut();
    }

    flotTekst = Math.max(0, flotTekst - dt);
    opdaterPartikler(dt);
  }

  /* ---------- tegning ---------- */

  function tegnBaggrund() {
    var B = window.innerWidth, H = window.innerHeight;
    var himmel = ctx.createLinearGradient(0, 0, 0, H);
    himmel.addColorStop(0, '#5b4b9e');
    himmel.addColorStop(0.55, '#e8735a');
    himmel.addColorStop(1, '#ffd08a');
    ctx.fillStyle = himmel;
    ctx.fillRect(0, 0, B, H);

    // Aftensol
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.arc(sx(780), sy(120), 60 * visning.skala, 0, Math.PI * 2);
    ctx.fill();

    // Hav
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(0, sy(70), B, 70 * visning.skala);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    for (var i = 0; i < 12; i++) {
      var wx = sx(i * 90 + ((tid * 30) % 90)), wy = sy(40 + (i % 3) * 8);
      ctx.beginPath();
      ctx.ellipse(wx, wy, 30 * visning.skala, 4 * visning.skala, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Sand (jorden)
    ctx.fillStyle = '#f2d69b';
    ctx.fillRect(0, sy(0), B, H - sy(0));
    ctx.fillStyle = '#e4c27f';
    ctx.fillRect(0, sy(0), B, 8 * visning.skala);
  }

  function tegnBoble(b) {
    var s = visning.skala, r = b.r * s;
    var x = sx(b.x), y = sy(b.y);
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = BOBLEFARVER[b.str];
    ctx.strokeStyle = '#12261f';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.35, y - r * 0.4, r * 0.28, r * 0.16, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** Figuren: rund krop, oejne der kigger mod naermeste boble, hat, ben. */
  function tegnFigurForm(c, farve, hat, kigX, kigY, gang, svimmel) {
    var R = INDSTIL.spillerRadius;
    c.save();
    if (svimmel > 0) c.rotate(Math.sin(tid * 12) * 0.12);

    // Ben
    c.strokeStyle = '#12261f';
    c.lineWidth = 4;
    c.lineCap = 'round';
    [-1, 1].forEach(function (d) {
      var sving = Math.sin(gang * 0.12 + (d > 0 ? Math.PI : 0)) * 6;
      c.beginPath();
      c.moveTo(d * 9, -R * 0.2);
      c.lineTo(d * 9 + sving, R * 0.95);
      c.stroke();
    });

    // Krop
    c.fillStyle = farve.lak;
    c.beginPath();
    c.arc(0, 0, R, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.3)';
    c.beginPath();
    c.ellipse(-R * 0.35, -R * 0.45, R * 0.22, R * 0.12, -0.5, 0, Math.PI * 2);
    c.fill();

    // Oejne
    var vinkel = Math.atan2(kigY, kigX);
    [-1, 1].forEach(function (d) {
      var cx = d * 9, cy = -4;
      c.fillStyle = '#fff';
      c.lineWidth = 2;
      c.beginPath(); c.arc(cx, cy, 7, 0, Math.PI * 2); c.fill(); c.stroke();
      c.fillStyle = '#12261f';
      c.beginPath();
      if (svimmel > 0) {
        c.arc(cx + Math.cos(tid * 15 + d) * 3, cy + Math.sin(tid * 15) * 3, 3, 0, Math.PI * 2);
      } else {
        c.arc(cx + Math.cos(vinkel) * 3, cy + Math.sin(vinkel) * 3, 3.2, 0, Math.PI * 2);
      }
      c.fill();
    });
    // Mund
    c.lineWidth = 2.5;
    c.beginPath();
    if (svimmel > 0) c.arc(0, 12, 5, 0, Math.PI * 2);
    else c.arc(0, 6, 7, 0.2 * Math.PI, 0.8 * Math.PI);
    c.stroke();

    // Hat
    c.fillStyle = '#12261f';
    if (hat === 'kasket') {
      c.fillStyle = farve.lak === '#12261f' ? '#f7f3e8' : '#12261f';
      c.beginPath(); c.arc(0, -R * 0.55, R * 0.72, Math.PI, 0); c.closePath(); c.fill();
      c.fillRect(-R * 0.2, -R * 0.6, R * 1.1, 6);
    } else if (hat === 'hjelm') {
      c.fillStyle = '#f7f3e8';
      c.beginPath(); c.arc(0, -R * 0.4, R * 0.8, Math.PI, 0); c.closePath(); c.fill(); c.stroke();
      c.fillStyle = '#e8442e';
      c.fillRect(-4, -R * 1.2, 8, R * 0.7);
    } else {
      c.fillStyle = '#e8442e';
      [-1, 1].forEach(function (d) {
        c.beginPath();
        c.moveTo(0, -R * 0.95);
        c.lineTo(d * 16, -R * 1.25);
        c.lineTo(d * 16, -R * 0.65);
        c.closePath();
        c.fill();
        c.stroke();
      });
      c.beginPath(); c.arc(0, -R * 0.95, 4, 0, Math.PI * 2); c.fill();
    }

    // Svimmel: stjerner over hovedet
    if (svimmel > 0) {
      c.fillStyle = '#ffd23f';
      for (var k = 0; k < 3; k++) {
        var v = tid * 5 + k * Math.PI * 2 / 3;
        var x = Math.cos(v) * 22, y = -R * 1.35 + Math.sin(v) * 6;
        c.beginPath();
        for (var j = 0; j < 10; j++) {
          var rr = j % 2 ? 2.5 : 6, vv = -Math.PI / 2 + j * Math.PI / 5;
          c.lineTo(x + Math.cos(vv) * rr, y + Math.sin(vv) * rr);
        }
        c.closePath();
        c.fill();
      }
    }
    c.restore();
  }

  function naermesteBoble(x) {
    var bedst = null;
    spil.bobler.forEach(function (b) { if (!bedst || Math.abs(b.x - x) < Math.abs(bedst.x - x)) bedst = b; });
    return bedst;
  }

  function tegnSpiller(s, i) {
    var u = udseende[i];
    var sk = visning.skala, R = INDSTIL.spillerRadius;
    // Snor
    if (s.skud) {
      ctx.save();
      ctx.strokeStyle = '#12261f';
      ctx.lineWidth = 6 * sk;
      ctx.lineCap = 'round';
      ctx.beginPath();
      var fra = R * 1.6, til = s.skud.y;
      for (var y = fra; y <= til; y += 8) {
        var x = s.skud.x + Math.sin(y * 0.15 + tid * 30) * 4;
        if (y === fra) ctx.moveTo(sx(x), sy(y)); else ctx.lineTo(sx(x), sy(y));
      }
      ctx.stroke();
      ctx.strokeStyle = '#ffd23f';
      ctx.lineWidth = 2.5 * sk;
      ctx.stroke();
      // Spids
      ctx.fillStyle = '#ffd23f';
      ctx.beginPath();
      ctx.moveTo(sx(s.skud.x), sy(til + 14));
      ctx.lineTo(sx(s.skud.x - 8), sy(til));
      ctx.lineTo(sx(s.skud.x + 8), sy(til));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    // Skygge
    ctx.fillStyle = 'rgba(0,0,0,0.15)';
    ctx.beginPath();
    ctx.ellipse(sx(s.x), sy(0) + 2 * sk, R * sk, 5 * sk, 0, 0, Math.PI * 2);
    ctx.fill();

    var b = naermesteBoble(s.x);
    ctx.save();
    ctx.translate(sx(s.x), sy(R));
    ctx.scale(sk, sk);
    tegnFigurForm(ctx, u.farve, u.hat, b ? b.x - s.x : 1, b ? -(b.y - R) : -0.3, s.vx !== 0 ? s.x : 0, s.svimmel);
    ctx.restore();
  }

  function tegnFremskridt() {
    var s = visning.skala;
    var antal = Bobler.BANER.length;
    var y = visning.oy + 26 * s;
    var midt = window.innerWidth / 2;
    for (var i = 0; i < antal; i++) {
      var x = midt + (i - (antal - 1) / 2) * 30 * s;
      var aktuel = i === spil.bane && !spil.faerdig;
      ctx.beginPath();
      ctx.arc(x, y, (aktuel ? 11 + Math.sin(tid * 6) : 9) * s, 0, Math.PI * 2);
      ctx.fillStyle = i < spil.bane || spil.faerdig ? '#ffd23f' : (aktuel ? '#f7f3e8' : 'rgba(255,255,255,0.35)');
      ctx.fill();
      ctx.lineWidth = 3 * s;
      ctx.strokeStyle = '#12261f';
      ctx.stroke();
    }
  }

  function tegnPartikler() {
    partikler.forEach(function (p) {
      ctx.globalAlpha = Math.max(0, p.liv / p.maxLiv) * 0.9;
      ctx.fillStyle = p.farve;
      ctx.beginPath();
      ctx.arc(sx(p.x), sy(p.y), p.r * visning.skala, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function tegnKnapper() {
    var B = window.innerWidth, H = window.innerHeight;
    var y = H - 60;
    styring.zoner.forEach(function (z) {
      var aktiv = styring.trykket(z.spiller, z.knap);
      var midt = (z.x0 + z.x1) / 2 * B;
      var s = aktiv ? 1.3 : 1;
      ctx.save();
      ctx.globalAlpha = aktiv ? 1 : 0.55;
      ctx.fillStyle = aktiv ? '#ffd23f' : udseende[z.spiller].farve.lak;
      ctx.strokeStyle = '#12261f';
      ctx.lineWidth = aktiv ? 4 : 0;
      ctx.lineJoin = 'round';
      ctx.beginPath();
      if (z.knap === 'skyd') {
        ctx.moveTo(midt, y - 22 * s);
        ctx.lineTo(midt + 20 * s, y + 14 * s);
        ctx.lineTo(midt - 20 * s, y + 14 * s);
      } else {
        var d = z.knap === 'hoejre' ? 1 : -1;
        ctx.moveTo(midt - 16 * s * d, y - 20 * s);
        ctx.lineTo(midt + 14 * s * d, y);
        ctx.lineTo(midt - 16 * s * d, y + 20 * s);
      }
      ctx.closePath();
      if (aktiv) ctx.stroke();
      ctx.fill();
      ctx.restore();
    });
    if (antalSpillere === 2) {
      ctx.fillStyle = 'rgba(18,38,31,0.4)';
      ctx.fillRect(B / 2 - 2, H - 100, 4, 90);
    }
  }

  function tegn() {
    var B = window.innerWidth, H = window.innerHeight;
    ctx.clearRect(0, 0, B, H);
    tegnBaggrund();
    if (!spil) return;
    tegnPartikler();
    spil.bobler.forEach(tegnBoble);
    spil.spillere.forEach(tegnSpiller);
    tegnFremskridt();
    tegnKnapper();

    if (flotTekst > 0 && !spil.faerdig) {
      var t = Math.min(1, (1.6 - flotTekst) * 4);
      ctx.save();
      ctx.translate(B / 2, H * 0.4);
      ctx.scale(t, t);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = '800 120px ui-rounded, system-ui, sans-serif';
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#12261f';
      ctx.fillStyle = '#ffd23f';
      ctx.strokeText('Flot!', 0, 0);
      ctx.fillText('Flot!', 0, 0);
      ctx.restore();
    }
  }

  /* ---------- slutskaerm ---------- */

  function tegnEksempel(canvas, farve, hat, skala) {
    var c = canvas.getContext('2d');
    c.clearRect(0, 0, canvas.width, canvas.height);
    c.save();
    c.translate(canvas.width / 2, canvas.height * 0.58);
    c.scale(skala, skala);
    tegnFigurForm(c, farve, hat, 1, -0.3, 0, 0);
    c.restore();
  }

  function startKonfetti(canvas) {
    konfetti = [];
    for (var i = 0; i < 70; i++) {
      konfetti.push({
        x: Math.random() * canvas.width, y: -Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 40, vy: 60 + Math.random() * 90,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 6,
        b: 6 + Math.random() * 6, h: 4 + Math.random() * 4, farve: FARVER[i % FARVER.length].lak
      });
    }
  }

  function tegnVinder(dt) {
    if (!vinderCanvas || !vinderCanvas.isConnected) { vinderCanvas = null; return; }
    var c = vinderCanvas.getContext('2d');
    c.clearRect(0, 0, vinderCanvas.width, vinderCanvas.height);
    var n = antalSpillere;
    for (var i = 0; i < n; i++) {
      c.save();
      c.translate(vinderCanvas.width * (n === 1 ? 0.5 : 0.3 + i * 0.4), vinderCanvas.height * 0.58);
      c.scale(2.2, 2.2);
      tegnFigurForm(c, udseende[i].farve, udseende[i].hat, i === 0 ? 1 : -1, -0.3, 0, 0);
      c.restore();
    }
    konfetti.forEach(function (k) {
      k.x += k.vx * dt; k.y += k.vy * dt; k.rot += k.vr * dt;
      if (k.y > vinderCanvas.height + 10) { k.y = -10; k.x = Math.random() * vinderCanvas.width; }
      c.save(); c.translate(k.x, k.y); c.rotate(k.rot);
      c.fillStyle = k.farve; c.fillRect(-k.b / 2, -k.h / 2, k.b, k.h);
      c.restore();
    });
  }

  function afslut() {
    tilstand = 'faerdig';
    melodi([660, 880, 1100, 1320, 1760], 110);
    visOverlay(
      '<div class="kort">' +
      '<h2>' + (antalSpillere === 1 ? 'Du klarede alle baner!' : 'I klarede alle baner!') + '</h2>' +
      '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '"></canvas>' +
      '<button class="knap gul" data-handling="igen">Spil igen</button>' +
      '<button class="knap" data-handling="figurvalg">Vælg figur</button>' +
      '<button class="knap" data-handling="menu">Menu</button>' +
      '</div>'
    );
    vinderCanvas = overlay.querySelector('canvas.eksempel');
    startKonfetti(vinderCanvas);
  }

  /* ---------- loop ---------- */

  function løkke(t) {
    var dt = Math.min((t - sidsteTid) / 1000, 0.05);
    sidsteTid = t;
    if (tilstand === 'spiller') opdater(dt);
    else if (tilstand === 'faerdig') { tid += dt; opdaterPartikler(dt); tegnVinder(dt); }
    else tid += dt;
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

  function visMenu() {
    tilstand = 'venter';
    vinderCanvas = null;
    var stjerneKnapper = [0, 1, 2].map(function (n) {
      return '<button class="knap smal ikon' + (n === svaerhed ? ' valgt' : '') +
             '" data-handling="svaerhed" data-n="' + n + '" aria-label="' + (n + 1) + ' stjerner">' + stjerner(n + 1) + '</button>';
    }).join('');
    visOverlay(
      '<div class="kort">' +
      '<h2>Bobler</h2>' +
      '<p class="hjaelp">Løb med siderne, skyd med midten. Skyd alle boblerne sammen.</p>' +
      '<div class="raekke">' + stjerneKnapper + '</div>' +
      '<button class="knap gul" data-handling="start" data-spillere="1">1 spiller</button>' +
      '<button class="knap gul" data-handling="start" data-spillere="2">2 spillere</button>' +
      '<div class="raekke bund">' +
      '<a class="knap lille" href="../../">Tilbage</a>' +
      '<button class="knap lille ikon" data-handling="lyd" aria-label="Lyd til eller fra">' + lydIkon(lydTil) + '</button>' +
      '</div>' +
      '</div>'
    );
  }

  var EKSEMPEL_STIL = 'position:static;display:block;width:150px;height:110px;align-self:center';
  var MINI_STIL = 'position:static;display:block;width:100%;height:100%';

  function visFigurValg() {
    tilstand = 'venter';
    var soejler = '';
    for (var s = 0; s < antalSpillere; s++) {
      var v = valg[s];
      var anden = antalSpillere === 2 ? valg[1 - s] : null;
      var former = HATTE.map(function (f, i) {
        return '<button class="form' + (i === v.form ? ' valgt' : '') + '" data-handling="form" data-spiller="' + s +
               '" data-i="' + i + '" aria-label="' + f + '">' +
               '<canvas width="128" height="104" style="' + MINI_STIL + '" data-form="' + i + '" data-farve="' + v.farve + '"></canvas></button>';
      }).join('');
      var farver = FARVER.map(function (f, i) {
        var optaget = anden && anden.farve === i;
        return '<button class="farve' + (i === v.farve ? ' valgt' : '') + (optaget ? ' optaget' : '') +
               '" style="background:' + f.lak + '" data-handling="farve" data-spiller="' + s + '" data-i="' + i + '"' +
               (optaget ? ' disabled' : '') + ' aria-label="' + f.navn + '"></button>';
      }).join('');
      soejler += '<div class="spiller" style="border-color:' + FARVER[v.farve].lak + '">' +
                 '<canvas class="eksempel" width="300" height="220" style="' + EKSEMPEL_STIL + '" data-spiller="' + s + '"></canvas>' +
                 '<div class="former">' + former + '</div>' +
                 '<div class="farver">' + farver + '</div></div>';
    }
    visOverlay(
      '<div class="kort' + (antalSpillere === 2 ? ' bred' : '') + '">' +
      '<h2>Vælg din figur</h2>' +
      '<div class="valg">' + soejler + '</div>' +
      '<button class="knap gul stor" data-handling="spil">Spil!</button>' +
      '</div>'
    );
    overlay.querySelectorAll('canvas[data-form]').forEach(function (cv) {
      tegnEksempel(cv, FARVER[+cv.dataset.farve], HATTE[+cv.dataset.form], 1.3);
    });
    overlay.querySelectorAll('canvas.eksempel[data-spiller]').forEach(function (cv) {
      var v = valg[+cv.dataset.spiller];
      tegnEksempel(cv, FARVER[v.farve], HATTE[v.form], 2.6);
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
    } else if (h === 'lyd') {
      lydTil = !lydTil;
      if (lydTil) tone(660, 0.12);
      visMenu();
    } else if (h === 'start') {
      antalSpillere = parseInt(knap.dataset.spillere, 10);
      tone(520, 0.08);
      visFigurValg();
    } else if (h === 'form' || h === 'farve') {
      var v = valg[parseInt(knap.dataset.spiller, 10)];
      v[h] = parseInt(knap.dataset.i, 10);
      tone(h === 'form' ? 600 : 700, 0.08);
      visFigurValg();
    } else if (h === 'figurvalg') {
      visFigurValg();
    } else if (h === 'spil' || h === 'igen') {
      skjulOverlay();
      nytSpil(antalSpillere);
    } else if (h === 'menu') {
      visMenu();
    }
  });

  /* ---------- start ---------- */

  window.addEventListener('resize', tilpasStørrelse);
  window.addEventListener('orientationchange', function () { setTimeout(tilpasStørrelse, 220); });

  window.__debug = function () {
    return {
      tilstand: tilstand, spillere: antalSpillere, svaerhed: svaerhed, lyd: lydTil,
      bane: spil ? spil.bane : null, faerdig: spil ? spil.faerdig : null,
      bobler: spil ? spil.bobler.map(function (b) { return { x: Math.round(b.x), y: Math.round(b.y), str: b.str }; }) : null,
      spillere_: spil ? spil.spillere.map(function (s) { return { x: Math.round(s.x), svimmel: +s.svimmel.toFixed(2), skud: !!s.skud, poppede: s.poppede }; }) : null,
      input: [styring.input(0), styring.input(1)]
    };
  };

  tilpasStørrelse();
  visMenu();
  requestAnimationFrame(function (t) { sidsteTid = t; løkke(t); });
})();
