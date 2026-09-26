/**
 * Årstidshaven: Pelle ønsker sig noget fra haven.
 *
 * Barnet finder bedet med det rigtige skilt, sår, vander og høster, og
 * stemmen tæller med, når afgrøderne lander hos Pelle. Stjernerne
 * bestemmer, hvor meget der skal tælles: én stjerne 1-3 med billeder i
 * boblen, to stjerner 2-5 med prikker, tre stjerner to ting på én gang.
 * Kaninen og fuglen vil også have noget, men et tryk jager dem væk, og det
 * værste, der sker, er at planten går et trin tilbage. Årstidsuret skifter
 * mellem forår, sommer, efterår og vinter.
 *
 * 3D med den samme lille WebGL 1-tegner som Himmelvejen, uden biblioteker.
 * Figurerne er de malede billeder fra de andre spil, sat op som udklip.
 * Haven, ønskerne, vejret og dyrene ligger i haven.js, så testen kan
 * spille det hele igennem uden browser.
 */
(function () {
  'use strict';

  var Hv = window.Haven;
  var sub = Hv.sub, cross = Hv.cross, norm = Hv.norm, dot = Hv.dot, mix = Hv.mix, klem = Hv.klem, jaevn = Hv.jaevn;
  var tilfaeldig = Hv.tilfaeldig, stoej = Hv.stoej, hex = Hv.hex, blend = Hv.blend;
  var AAR = Hv.AAR, BED_B = Hv.BED_B, BED_D = Hv.BED_D, BED_H = Hv.BED_H, KURV = Hv.KURV, POS = Hv.POS, KATEGORI = Hv.KATEGORI;

  var M = {
    en: function () { var o = new Float32Array(16); o[0] = o[5] = o[10] = o[15] = 1; return o; },
    gange: function (a, b) {
      var o = new Float32Array(16);
      for (var c = 0; c < 4; c++) for (var r = 0; r < 4; r++) {
        var s = 0; for (var k = 0; k < 4; k++) s += a[k * 4 + r] * b[c * 4 + k];
        o[c * 4 + r] = s;
      }
      return o;
    },
    persp: function (fov, asp, n, f) {
      var t = 1 / Math.tan(fov / 2), o = new Float32Array(16);
      o[0] = t / asp; o[5] = t; o[10] = (f + n) / (n - f); o[11] = -1; o[14] = 2 * f * n / (n - f);
      return o;
    },
    kig: function (e, c, u) {
      var z = norm(sub(e, c)), x = norm(cross(u, z)), y = cross(z, x), o = new Float32Array(16);
      o[0] = x[0]; o[4] = x[1]; o[8] = x[2];
      o[1] = y[0]; o[5] = y[1]; o[9] = y[2];
      o[2] = z[0]; o[6] = z[1]; o[10] = z[2];
      o[12] = -dot(x, e); o[13] = -dot(y, e); o[14] = -dot(z, e); o[15] = 1;
      return { m: o, hoejre: x };
    },
    flyt: function (x, y, z) { var o = M.en(); o[12] = x; o[13] = y; o[14] = z; return o; },
    rotY: function (a) { var c = Math.cos(a), s = Math.sin(a), o = M.en(); o[0] = c; o[2] = -s; o[8] = s; o[10] = c; return o; },
    rotX: function (a) { var c = Math.cos(a), s = Math.sin(a), o = M.en(); o[5] = c; o[6] = s; o[9] = -s; o[10] = c; return o; },
    rotZ: function (a) { var c = Math.cos(a), s = Math.sin(a), o = M.en(); o[0] = c; o[1] = s; o[4] = -s; o[5] = c; return o; },
    skala: function (s) { var o = M.en(); o[0] = o[5] = o[10] = s; return o; }
  };
  function kaede() { var o = arguments[0]; for (var i = 1; i < arguments.length; i++) o = M.gange(o, arguments[i]); return o; }

  /* ---------- WebGL ---------- */
  var cv = document.getElementById('verden'), hud = document.getElementById('hud'), hx = hud.getContext('2d');
  var overlay = document.getElementById('overlay');
  var gl = cv.getContext('webgl', { antialias: true, alpha: false }) || cv.getContext('experimental-webgl', { antialias: true, alpha: false });
  if (!gl) {
    overlay.hidden = false;
    overlay.innerHTML = '<div class="kort"><h2>Årstidshaven</h2><p>Denne iPad kan ikke vise 3D.</p></div>';
    return;
  }

  function shader(type, kilde) {
    var s = gl.createShader(type); gl.shaderSource(s, kilde); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
    return s;
  }
  function program(vs, fs, attr) {
    var p = gl.createProgram();
    gl.attachShader(p, shader(gl.VERTEX_SHADER, vs)); gl.attachShader(p, shader(gl.FRAGMENT_SHADER, fs));
    attr.forEach(function (a, i) { gl.bindAttribLocation(p, i, a); });
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    var u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (var i = 0; i < n; i++) { var info = gl.getActiveUniform(p, i); u[info.name] = gl.getUniformLocation(p, info.name); }
    return { p: p, u: u };
  }

  var STOEJ_GLSL = [
    'float hs(vec2 q){ return fract(sin(dot(q, vec2(127.1, 311.7))) * 43758.5453); }',
    'float st(vec2 q){ vec2 i = floor(q); vec2 u = fract(q); u = u*u*(3.0-2.0*u);',
    '  return mix(mix(hs(i), hs(i+vec2(1.0,0.0)), u.x), mix(hs(i+vec2(0.0,1.0)), hs(i+vec2(1.0,1.0)), u.x), u.y); }'
  ].join('\n');

  /* Oplyste former: landskab, vand, ringe, skaden, taarnet. Akvarelvask og papirkorn i farven. */
  var LYS = program([
    'attribute vec3 p; attribute vec3 n; attribute vec3 f;',
    'uniform mat4 vp; uniform mat4 m;',
    'varying vec3 vf; varying vec3 vn; varying vec3 vw;',
    'void main(){ vec4 w = m*vec4(p,1.0); vw = w.xyz; vn = (m*vec4(n,0.0)).xyz; vf = f; gl_Position = vp*w; }'
  ].join('\n'), [
    'precision highp float;',
    'varying vec3 vf; varying vec3 vn; varying vec3 vw;',
    'uniform vec3 sol; uniform vec3 taage; uniform vec3 kam; uniform float taet; uniform float tid; uniform float vand; uniform vec4 tone;',
    STOEJ_GLSL,
    'void main(){',
    '  vec3 nn = normalize(vn);',
    '  float l = 0.62 + 0.45*max(dot(nn, sol), 0.0) - 0.06*max(-nn.y, 0.0);',
    '  vec3 c = vf*tone.rgb;',
    '  if (vand > 0.5) {',
    '    float b = st(vw.xz*0.045 + vec2(tid*0.06, tid*0.04))*0.6 + st(vw.xz*0.11 - vec2(tid*0.05, 0.0))*0.4;',
    '    c = mix(c, vec3(0.64, 0.82, 0.92), smoothstep(0.52, 0.8, b)*0.5);',
    '    l = 1.0;',
    '  }',
    '  float w = st(vw.xz*0.021)*0.6 + st(vw.xz*0.083)*0.4;',
    '  c *= 0.9 + 0.2*w;',
    '  c = c*l + vf*tone.a;',
    '  c *= 0.97 + 0.06*hs(floor(gl_FragCoord.xy*0.5));',
    '  c = mix(c, taage, clamp(1.0 - exp(-length(vw - kam)*taet), 0.0, 1.0));',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n'), ['p', 'n', 'f']);

  /* Udklip: de malede figurer. Staar op mod kameraet, eller ligger fast (bilen, skygger, hulen). */
  var UDKLIP = program([
    'attribute vec2 k;',
    'uniform mat4 vp; uniform vec3 pos; uniform vec3 hoejre; uniform vec3 op; uniform vec2 str;',
    'varying vec2 uv; varying vec3 vw;',
    'void main(){ vec3 w = pos + hoejre*(k.x*str.x) + op*(k.y*str.y); vw = w; uv = vec2(k.x + 0.5, 1.0 - k.y); gl_Position = vp*vec4(w, 1.0); }'
  ].join('\n'), [
    'precision highp float;',
    'varying vec2 uv; varying vec3 vw;',
    'uniform sampler2D tx; uniform vec3 taage; uniform vec3 kam; uniform float taet; uniform float alfa;',
    'void main(){',
    '  vec4 t = texture2D(tx, uv); if (t.a < 0.01) discard;',
    '  float fo = clamp(1.0 - exp(-length(vw - kam)*taet), 0.0, 1.0);',
    '  t.rgb = mix(t.rgb, taage*t.a, fo);',
    '  gl_FragColor = t*alfa;',
    '}'
  ].join('\n'), ['k']);

  var HIMMEL = program(
    'attribute vec2 k; varying float y; void main(){ y = k.y*0.5 + 0.5; gl_Position = vec4(k, 0.9999, 1.0); }',
    'precision highp float; varying float y; uniform float hor; uniform vec3 top; uniform vec3 bund; void main(){ float t = smoothstep(hor - 0.03, hor + 0.6, y); gl_FragColor = vec4(mix(bund, top, t), 1.0); }',
    ['k']);

  function buffer(data, type) {
    var b = gl.createBuffer(); gl.bindBuffer(type || gl.ARRAY_BUFFER, b);
    gl.bufferData(type || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b;
  }
  var HJOERNER = buffer(new Float32Array([-0.5, 0, 0.5, 0, 0.5, 1, -0.5, 1]));
  var HJ_IDX = buffer(new Uint16Array([0, 1, 2, 0, 2, 3]), gl.ELEMENT_ARRAY_BUFFER);
  var SKAERM = buffer(new Float32Array([-1, -1, 1, -1, 1, 1, -1, 1]));

  /* ---------- former ---------- */
  function Former() { this.p = []; this.n = []; this.f = []; this.i = []; }
  Former.prototype.punkt = function (p, n, f) { this.p.push(p[0], p[1], p[2]); this.n.push(n[0], n[1], n[2]); this.f.push(f[0], f[1], f[2]); return this.p.length / 3 - 1; };
  Former.prototype.firkant = function (a, b, c, d, f, n) {
    n = n || norm(cross(sub(b, a), sub(d, a)));
    var i = this.punkt(a, n, f); this.punkt(b, n, f); this.punkt(c, n, f); this.punkt(d, n, f);
    this.i.push(i, i + 1, i + 2, i, i + 2, i + 3);
  };
  Former.prototype.trekant = function (a, b, c, f, n) {
    n = n || norm(cross(sub(b, a), sub(c, a)));
    var i = this.punkt(a, n, f); this.punkt(b, n, f); this.punkt(c, n, f);
    this.i.push(i, i + 1, i + 2);
  };
  Former.prototype.kasse = function (x, y, z, b, h, d, f) {
    var X0 = x - b / 2, X1 = x + b / 2, Y0 = y - h / 2, Y1 = y + h / 2, Z0 = z - d / 2, Z1 = z + d / 2;
    this.firkant([X0, Y1, Z0], [X1, Y1, Z0], [X1, Y1, Z1], [X0, Y1, Z1], f, [0, 1, 0]);
    this.firkant([X0, Y0, Z1], [X1, Y0, Z1], [X1, Y1, Z1], [X0, Y1, Z1], f, [0, 0, 1]);
    this.firkant([X1, Y0, Z0], [X0, Y0, Z0], [X0, Y1, Z0], [X1, Y1, Z0], f, [0, 0, -1]);
    this.firkant([X1, Y0, Z1], [X1, Y0, Z0], [X1, Y1, Z0], [X1, Y1, Z1], f, [1, 0, 0]);
    this.firkant([X0, Y0, Z0], [X0, Y0, Z1], [X0, Y1, Z1], [X0, Y1, Z0], f, [-1, 0, 0]);
  };
  Former.prototype.pyramide = function (x, y, z, b, h, f) {
    var t = [x, y + h, z], a = [x - b / 2, y, z - b / 2], c = [x + b / 2, y, z - b / 2], d = [x + b / 2, y, z + b / 2], e = [x - b / 2, y, z + b / 2];
    this.trekant(a, t, c, f); this.trekant(c, t, d, f); this.trekant(d, t, e, f); this.trekant(e, t, a, f);
  };
  Former.prototype.ellipsoide = function (cx, cy, cz, rx, ry, rz, farve, su, sv) {
    var start = this.p.length / 3;
    for (var j = 0; j <= sv; j++) {
      var th = j / sv * Math.PI;
      for (var i = 0; i <= su; i++) {
        var ph = i / su * 2 * Math.PI, ux = Math.sin(th) * Math.cos(ph), uy = Math.cos(th), uz = Math.sin(th) * Math.sin(ph);
        this.punkt([cx + rx * ux, cy + ry * uy, cz + rz * uz], norm([ux / rx, uy / ry, uz / rz]), farve(ux, uy, uz));
      }
    }
    for (j = 0; j < sv; j++) for (i = 0; i < su; i++) {
      var a = start + j * (su + 1) + i, b = a + 1, c = a + su + 1, d = c + 1;
      this.i.push(a, c, b, b, c, d);
    }
  };
  Former.prototype.torus = function (R, r, su, sv, f) {
    var start = this.p.length / 3;
    for (var j = 0; j <= sv; j++) {
      var v = j / sv * 2 * Math.PI;
      for (var i = 0; i <= su; i++) {
        var u = i / su * 2 * Math.PI, cu = Math.cos(u), s = Math.sin(u), cvv = Math.cos(v);
        this.punkt([(R + r * cvv) * cu, (R + r * cvv) * s, r * Math.sin(v)], [cvv * cu, cvv * s, Math.sin(v)], f);
      }
    }
    for (j = 0; j < sv; j++) for (i = 0; i < su; i++) {
      var a = start + j * (su + 1) + i, b = a + 1, c = a + su + 1, d = c + 1;
      this.i.push(a, c, b, b, c, d);
    }
  };
  Former.prototype.faerdig = function () {
    return {
      p: buffer(new Float32Array(this.p)), n: buffer(new Float32Array(this.n)), f: buffer(new Float32Array(this.f)),
      i: buffer(new Uint16Array(this.i), gl.ELEMENT_ARRAY_BUFFER), antal: this.i.length
    };
  };

  function potens(n) { var p = 1; while (p < n) p *= 2; return p; }
  function lavTekstur(kilde, b, h) {
    b = potens(b); h = potens(h);   // WebGL 1 kan kun lave mipmaps paa 2^n
    var c = document.createElement('canvas'); c.width = b; c.height = h;
    c.getContext('2d').drawImage(kilde, 0, 0, b, h);
    var t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }
  /* Tegnet i kode: et laerred paa b x h, som tegnefunktionen maler paa. */
  function kodeTekstur(navn, b, h, tegn) {
    var c = document.createElement('canvas'); c.width = b; c.height = h;
    tegn(c.getContext('2d'), b, h);
    tekstur[navn] = lavTekstur(c, b, h); forhold[navn] = b / h;
    billede[navn] = c;
  }

  function rr(c, x, y, b, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + b, y, x + b, y + h, r); c.arcTo(x + b, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + b, y, r); c.closePath(); }
  var KANT = '#5e4a3a';

  /* ---------- billeder: laant fra de andre spil ---------- */
  var BILLEDER = {
    trae: '../maskinen/billeder/trae.png', gran: '../maskinen/billeder/gran.png', hus: '../../assets/malet/hus.png',
    kanin: '../maskinen/billeder/kanin.png', pindsvin: '../maskinen/billeder/pindsvin.png', snemand: '../maskinen/billeder/snemand.png',
    ugle: '../maskinen/billeder/ugle.png', aeble: '../maskinen/billeder/aeble.png',
    fugl: '../bogstaver/billeder/fugl.png', bi: '../bogstaver/billeder/bi.png', egern: '../bogstaver/billeder/egern.png',
    gulerod: '../bogstaver/billeder/gulerod.png', froe: '../restaurant/billeder/froe.png', tomat: '../restaurant/billeder/tomat.png',
    jordbaer: '../restaurant/billeder/jordbaer.png', salat: '../restaurant/billeder/salat.png', agurk: '../restaurant/billeder/agurk.png',
    peberfrugt: '../restaurant/billeder/peberfrugt.png'
  };
  var STORE = { trae: 1, gran: 1, hus: 1 };
  var billede = {}, tekstur = {}, forhold = {};

  function hentBilleder(faerdig) {
    var navne = Object.keys(BILLEDER), mangler = navne.length;
    navne.forEach(function (n) {
      var img = new Image();
      img.onload = img.onerror = function () {
        if (img.naturalWidth) {
          billede[n] = img; forhold[n] = img.naturalWidth / img.naturalHeight;
          var s = STORE[n] ? 512 : 256; tekstur[n] = lavTekstur(img, s, s);
        }
        if (--mangler === 0) faerdig();
      };
      img.src = BILLEDER[n];
    });
  }

  /* Tegnet i kode: traeet i de fire aarstider, kurven, draaber, blade, fnug, frø og en sommerfugl */
  function lavKodeTeksturer() {
    var trae = billede.trae, gran = billede.gran;
    function farvetTrae(navn, kilde, farve, alfa, pynt) {
      kodeTekstur(navn, 512, 512, function (c, b, h) {
        c.drawImage(kilde, 0, 0, b, h);
        if (farve) {   // farv kronen om, men behold stammen: kun den oeverste del
          c.globalCompositeOperation = 'source-atop';
          var g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, farve); g.addColorStop(0.62, farve); g.addColorStop(0.7, 'rgba(0,0,0,0)');
          c.globalAlpha = alfa; c.fillStyle = g; c.fillRect(0, 0, b, h);
          c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
        }
        if (pynt) pynt(c, b, h);
      });
      forhold[navn] = forhold.trae;
    }
    if (trae) {
      farvetTrae('traeForaar', trae, '#b9d98a', 0.25, function (c, b, h) {
        var r = tilfaeldig(3);
        for (var i = 0; i < 70; i++) {
          var v = r() * Math.PI * 2, d = Math.sqrt(r()), x = b * 0.5 + Math.cos(v) * d * b * 0.36, y = h * 0.33 + Math.sin(v) * d * h * 0.24;
          c.fillStyle = i % 3 ? '#f7d5dc' : '#fbe9ec'; c.beginPath(); c.arc(x, y, 7 + r() * 5, 0, 7); c.fill();
        }
      });
      farvetTrae('traeSommer', trae, null, 0);
      farvetTrae('traeEfteraar', trae, '#e08a52', 0.55);
      farvetTrae('traeVinter', trae, '#dfe7ec', 0.8, function (c, b, h) {
        var r = tilfaeldig(5); c.fillStyle = 'rgba(255,255,255,.9)';
        for (var i = 0; i < 40; i++) { var x = b * (0.18 + r() * 0.64), y = h * (0.12 + r() * 0.45); c.beginPath(); c.ellipse(x, y, 14 + r() * 12, 6 + r() * 4, 0, 0, 7); c.fill(); }
      });
    }
    if (gran) {
      kodeTekstur('granSne', 512, 512, function (c, b, h) {
        c.drawImage(gran, 0, 0, b, h);
        var r = tilfaeldig(9); c.globalCompositeOperation = 'source-atop'; c.fillStyle = 'rgba(255,255,255,.92)';
        for (var i = 0; i < 16; i++) { var y = h * (0.15 + i * 0.045), bb = b * (0.08 + i * 0.022); c.beginPath(); c.ellipse(b / 2 + (r() - 0.5) * 30, y, bb, 7, 0, 0, 7); c.fill(); }
        c.globalCompositeOperation = 'source-over';
      });
      forhold.granSne = forhold.gran;
    }
    kodeTekstur('kurv', 256, 256, function (c) {
      c.lineWidth = 12; c.strokeStyle = '#8a663d'; c.beginPath(); c.arc(128, 128, 84, Math.PI, 0); c.stroke();
      c.fillStyle = '#d9ba8a'; c.strokeStyle = KANT; c.lineWidth = 7;
      c.beginPath(); c.moveTo(30, 120); c.lineTo(226, 120); c.lineTo(200, 240); c.lineTo(56, 240); c.closePath(); c.fill(); c.stroke();
      c.strokeStyle = 'rgba(94,74,58,.35)'; c.lineWidth = 4;
      [80, 128, 176].forEach(function (x) { c.beginPath(); c.moveTo(x, 124); c.lineTo(x + (x - 128) * -0.15, 236); c.stroke(); });
      [160, 200].forEach(function (y) { c.beginPath(); c.moveTo(40 + (y - 120) * 0.2, y); c.lineTo(216 - (y - 120) * 0.2, y); c.stroke(); });
    });
    kodeTekstur('draabe', 64, 64, function (c) {
      c.fillStyle = '#8fc7e8'; c.beginPath(); c.moveTo(32, 4); c.quadraticCurveTo(54, 40, 32, 60); c.quadraticCurveTo(10, 40, 32, 4); c.fill();
      c.fillStyle = 'rgba(255,255,255,.7)'; c.beginPath(); c.ellipse(26, 40, 5, 8, 0, 0, 7); c.fill();
    });
    ['#e08a52', '#d95f45', '#f0c46a'].forEach(function (f, i) {
      kodeTekstur('blad' + i, 64, 64, function (c) {
        c.fillStyle = f; c.beginPath(); c.moveTo(32, 4); c.quadraticCurveTo(60, 30, 32, 60); c.quadraticCurveTo(4, 30, 32, 4); c.fill();
        c.strokeStyle = 'rgba(94,74,58,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(32, 8); c.lineTo(32, 58); c.stroke();
      });
    });
    kodeTekstur('fnug', 64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 2, 32, 32, 30); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.8)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    kodeTekstur('froerk', 256, 128, function (c) {
      c.fillStyle = '#e5d3ae'; c.strokeStyle = 'rgba(60,40,25,.7)'; c.lineWidth = 4;
      [40, 128, 216].forEach(function (x) { [[-15, 2], [13, 12], [0, -15]].forEach(function (d) { c.beginPath(); c.ellipse(x + d[0], 64 + d[1], 13, 8.5, 0.4, 0, 7); c.fill(); c.stroke(); }); });
    });
    kodeTekstur('sommerfugl', 128, 128, function (c) {
      c.fillStyle = '#e08a52'; c.strokeStyle = KANT; c.lineWidth = 4;
      [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(64 + s * 28, 48, 26, 30, s * 0.5, 0, 7); c.fill(); c.stroke(); });
      c.fillStyle = '#f0c46a'; [-1, 1].forEach(function (s) { c.beginPath(); c.ellipse(64 + s * 22, 86, 18, 20, -s * 0.4, 0, 7); c.fill(); c.stroke(); });
      c.fillStyle = KANT; c.beginPath(); c.ellipse(64, 66, 6, 30, 0, 0, 7); c.fill();
    });
    kodeTekstur('sol', 256, 256, function (c) {
      var g = c.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(252,236,180,1)'); g.addColorStop(0.35, 'rgba(247,214,130,.95)'); g.addColorStop(0.4, 'rgba(247,214,130,.35)'); g.addColorStop(1, 'rgba(247,214,130,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    });
    function sky(navn, farve) {
      kodeTekstur(navn, 256, 128, function (c) {
        c.fillStyle = farve;
        [[70, 80, 42], [120, 58, 54], [178, 76, 44], [140, 92, 40], [92, 96, 34]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 7); c.fill(); });
      });
    }
    sky('sky', 'rgba(255,255,255,.92)'); sky('regnsky', 'rgba(176,190,200,.95)');
    kodeTekstur('gnist', 64, 64, function (c) {
      c.fillStyle = '#f0c46a'; c.beginPath();
      for (var j = 0; j < 10; j++) { var r = j % 2 ? 11 : 30, v = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(32 + Math.cos(v) * r, 32 + Math.sin(v) * r); }
      c.closePath(); c.fill(); c.strokeStyle = 'rgba(94,74,58,.6)'; c.lineWidth = 2; c.stroke();
    });
    kodeTekstur('skygge', 64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(60,48,38,.35)'); g.addColorStop(1, 'rgba(60,48,38,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
  }

  /* ---------- haven i de fire aarstider ---------- */
  var SAESON = {
    foraar:   { top: '#a9d3ec', bund: '#e8f1ea', graes: ['#a9c97a', '#93bc63'], sti: '#e5d3ae', lys: 1.0, solH: 0.55, trae: 'traeForaar' },
    sommer:   { top: '#8fc7e8', bund: '#dcebf2', graes: ['#93bc63', '#7fa955'], sti: '#e5d3ae', lys: 1.06, solH: 0.8, trae: 'traeSommer' },
    efteraar: { top: '#bcd3dd', bund: '#f1e3c8', graes: ['#c2b465', '#a99a55'], sti: '#d9ba8a', lys: 0.96, solH: 0.42, trae: 'traeEfteraar' },
    vinter:   { top: '#b5cad8', bund: '#eef2f5', graes: ['#f3f6f8', '#dde6ec'], sti: '#e6ecf0', lys: 1.0, solH: 0.25, trae: 'traeVinter' }
  };

  function hoejde(x, z) {
    var ud = Math.max(Math.abs(x) - 36, 0) + Math.max(-z - 22, 0) * 1.2 + Math.max(z - 24, 0);
    if (ud <= 0) return 0;
    var bakker = 5 + 5 * Math.sin(x * 0.045 + 1.3) + 4 * Math.cos(z * 0.05 - 0.7) + 5 * (stoej(x * 0.05, z * 0.05) - 0.5);
    return jaevn(0, 30, ud) * Math.max(bakker, 1.5) + jaevn(20, 90, ud) * 10;
  }
  function jordFarve(s, x, z) {
    var S = SAESON[s], a = hex(S.graes[0]), b = hex(S.graes[1]);
    var n = stoej(x * 0.08 + 7, z * 0.08 - 3), n2 = stoej(x * 0.3, z * 0.3);
    var c = blend(a, b, klem(n * 1.4 - 0.2, 0, 1));
    c = blend(c, b, klem(0.35 - n2, 0, 0.35));
    /* Stien mellem bedene og foran, og en lille plet sand ved kurven */
    var sti = (Math.abs(z + 2.5) < 1.6 && Math.abs(x) < 32) || (Math.abs(x) < 1.6 && z > -12 && z < 20) || (z > 11 && z < 13.5 && Math.abs(x) < 32);
    if (sti) c = blend(c, hex(S.sti), 0.85);
    if (s === 'efteraar' && n2 > 0.78) c = blend(c, hex('#e08a52'), 0.25);   // visne blade paa graesset
    return c;
  }
  function lavLandskab(s) {
    var N = 96, S = 240, trin = S / N, F = new Former();
    for (var j = 0; j <= N; j++) for (var i = 0; i <= N; i++) {
      var x = -S / 2 + i * trin, z = -S / 2 + j * trin - 30;
      var n = norm([hoejde(x - 1, z) - hoejde(x + 1, z), 2, hoejde(x, z - 1) - hoejde(x, z + 1)]);
      F.punkt([x, hoejde(x, z), z], n, jordFarve(s, x, z));
    }
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      F.i.push(a, c, b, b, c, d);
    }
    return F.faerdig();
  }
  /* Hegnet om haven: stolper og to rafter. Om vinteren ligger der sne paa. */
  function lavHegn(sne) {
    var F = new Former(), stolpe = hex('#8a663d'), raft = hex('#b18a56'), hvid = hex('#f8fbfc');
    function stykke(x0, z0, x1, z1) {
      var l = Math.hypot(x1 - x0, z1 - z0), n = Math.round(l / 4);
      for (var k = 0; k <= n; k++) {
        var x = mix(x0, x1, k / n), z = mix(z0, z1, k / n);
        if (!sne) F.kasse(x, 1.6, z, 0.6, 3.2, 0.6, stolpe); else F.kasse(x, 3.3, z, 0.8, 0.25, 0.8, hvid);
      }
      var mx = (x0 + x1) / 2, mz = (z0 + z1) / 2, bx = Math.abs(x1 - x0) + 0.3, bz = Math.abs(z1 - z0) + 0.3;
      [1.2, 2.5].forEach(function (y) {
        if (!sne) F.kasse(mx, y, mz, Math.max(bx, 0.3), 0.35, Math.max(bz, 0.3), raft);
        else F.kasse(mx, y + 0.28, mz, Math.max(bx, 0.42), 0.2, Math.max(bz, 0.42), hvid);
      });
    }
    stykke(-34, -18, 34, -18); stykke(-34, -18, -34, 16); stykke(34, -18, 34, 16);
    return F.faerdig();
  }
  /* Et bed: ramme af braedder og muld med furer. Muld og ramme er hver sin form, saa mulden kan blive vaad. */
  function lavBedRamme() {
    var F = new Former(), trae = hex('#8a663d'), kant = hex('#b18a56'), t = 0.55;
    F.kasse(0, BED_H / 2, -BED_D / 2, BED_B, BED_H, t, trae); F.kasse(0, BED_H / 2, BED_D / 2, BED_B, BED_H, t, trae);
    F.kasse(-BED_B / 2, BED_H / 2, 0, t, BED_H, BED_D, trae); F.kasse(BED_B / 2, BED_H / 2, 0, t, BED_H, BED_D, trae);
    F.kasse(0, BED_H + 0.06, -BED_D / 2, BED_B + 0.2, 0.12, t + 0.2, kant); F.kasse(0, BED_H + 0.06, BED_D / 2, BED_B + 0.2, 0.12, t + 0.2, kant);
    F.kasse(-BED_B / 2 + 0.7, 1.5, BED_D / 2 + 0.1, 0.22, 3, 0.22, kant);   // pinden til skiltet med det, der gror
    return F.faerdig();
  }
  function lavMuld() {
    var F = new Former(), muld = hex('#6b4a2e'), fure = hex('#553a24');
    F.kasse(0, 0.5, 0, BED_B - 0.5, 0.9, BED_D - 0.5, muld);
    [-1.5, 0, 1.5].forEach(function (z) { F.kasse(0, 0.97, z, BED_B - 1.4, 0.06, 0.35, fure); });
    return F.faerdig();
  }
  function lavSneBed() { var F = new Former(); F.ellipsoide(0, 1.1, 0, BED_B / 2 - 0.1, 0.7, BED_D / 2 - 0.1, function () { return hex('#f8fbfc'); }, 16, 8); return F.faerdig(); }
  /* En spire: stilk og to blade. En plante: flere store blade. */
  function lavSpire() {
    var F = new Former(), stilk = hex('#5f8240'), blad = hex('#93bc63');
    F.kasse(0, 0.7, 0, 0.18, 1.4, 0.18, stilk);
    F.ellipsoide(-0.45, 1.35, 0, 0.55, 0.16, 0.3, function () { return blad; }, 8, 5);
    F.ellipsoide(0.45, 1.5, 0, 0.55, 0.16, 0.3, function () { return blad; }, 8, 5);
    return F.faerdig();
  }
  function lavPlante() {
    var F = new Former(), a = hex('#5f8240'), b = hex('#7fa955');
    for (var k = 0; k < 6; k++) {
      var v = k / 6 * Math.PI * 2, f = k % 2 ? a : b;
      F.ellipsoide(Math.cos(v) * 0.7, 0.55, Math.sin(v) * 0.7, 0.9, 0.22, 0.45, function () { return f; }, 8, 5);
    }
    return F.faerdig();
  }

  /* ---------- lyd og stemme ---------- */
  var lyd = null, lydTil = true;
  function startLyd() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!lyd) lyd = new AC();
    if (lyd.state !== 'running') lyd.resume();
  }
  function tone(fr, l, st, forsink, type) {
    if (!lyd || !lydTil) return;
    var t0 = lyd.currentTime + (forsink || 0), o = lyd.createOscillator(), g = lyd.createGain();
    o.type = type || 'triangle'; o.frequency.value = fr;
    g.gain.setValueAtTime(st || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + l);
    o.connect(g); g.connect(lyd.destination); o.start(t0); o.stop(t0 + l + 0.05);
  }
  function melodi(toner, mellem) { toner.forEach(function (f, i) { tone(f, 0.22, 0.09, i * mellem / 1000); }); }   // mellem i millisekunder
  var LYDE = {
    vaelg: function () { tone(660, 0.08, 0.06); },
    saa: function () { tone(523, 0.12, 0.08); tone(659, 0.12, 0.06, 0.08); },
    nej: function () { tone(330, 0.15, 0.05); },
    plask: function () { for (var i = 0; i < 5; i++) tone(900 + Math.random() * 600, 0.08, 0.03, i * 0.07, 'sine'); },
    glad: function () { tone(784, 0.15, 0.06); },
    trin: function (n) { tone([523, 659, 784][n], 0.2, 0.08, 0.35); },   // hvert trin sin tone, hoejere og hoejere
    moden: function () { tone(1047, 0.2, 0.05); },
    hoest: function () { melodi([523, 659, 784, 1047], 100); },
    tael: function (n) { tone(523 + n * 110, 0.14, 0.07); },
    kurv: function () { tone(784, 0.1, 0.05); },
    pelle: function () { melodi([659, 784, 988, 1319], 110); },
    kanin: function () { tone(880, 0.1, 0.07); tone(1175, 0.12, 0.06, 0.1); },
    fugl: function () { tone(1319, 0.08, 0.06); tone(1568, 0.08, 0.05, 0.08); },
    spiste: function () { tone(262, 0.25, 0.06); },
    aeble: function () { melodi([659, 784, 988], 90); },
    aar: function () { melodi([392, 523, 659], 140); }
  };

  /* Stemmen: klippene i lyd/ (Gemini, stemmen Kore), ellers enhedens egen danske stemme. Se js/stemme.js. */
  var stemme = Stemme.ny({ mappe: 'lyd/', kontekst: function () { return lyd; }, til: function () { return lydTil; }, rate: 0.9 });
  function tie() { stemme.tie(); }

  /* ---------- tilstanden ---------- */
  var tilstand = 'menu', tid = 0, spillere = 1, svaerhed = 0;
  var valg = ['froe', 'froe'];
  var partikler = [], froeFlyv = [];
  var kam = { pos: [0, 34, 50], maal: [0, 0, -3] };
  var landskab = {}, hegn, sneHegn, bedRamme, muld, sneBed, spire, plante;
  var udklip = [], dyr = {};

  function gnister(x, y, z, n) {
    for (var i = 0; i < n; i++) {
      var v = Math.random() * Math.PI * 2, u = Math.random(), f = 5 + Math.random() * 6;
      partikler.push({ tx: 'gnist', x: x, y: y, z: z, vx: Math.cos(v) * f * 0.6, vy: 5 + u * 7, vz: Math.sin(v) * f * 0.6, g: 12, liv: 1 + Math.random() * 0.4, str: 1 + Math.random() });
    }
  }
  /* Haven selv: ønsker, vejr og dyr. Den siger til, naar der skal tales, spilles en lyd eller drysses noget. */
  var H = Hv.ny({
    sig: function (t) { stemme.sig(t); },
    sigKoe: function (t) { stemme.koe(t); },   // taellingen og tak siges efter hinanden, ikke oven i hinanden
    lyd: function (n, x) { if (LYDE[n]) LYDE[n](x); },
    gnist: gnister,
    vand: function (bd, kraft) {
      for (var i = 0; i < kraft; i++) {
        partikler.push({ tx: 'draabe', x: bd.x + (Math.random() - 0.5) * (BED_B - 2), y: 7 + Math.random() * 4, z: bd.z + (Math.random() - 0.5) * (BED_D - 2),
          vx: 0, vy: -14 - Math.random() * 4, vz: 0, g: 0, liv: 0.5 + Math.random() * 0.25, str: 0.7, bund: 1.1 });
      }
    },
    sne: function (bd) {
      for (var i = 0; i < 16; i++) partikler.push({ tx: 'fnug', x: bd.x + (Math.random() - 0.5) * 6, y: 2, z: bd.z + (Math.random() - 0.5) * 3, vx: (Math.random() - 0.5) * 6, vy: 4 + Math.random() * 4, vz: (Math.random() - 0.5) * 4, g: 9, liv: 0.9, str: 1.2 });
    },
    froe: function (bd) { var s = skaerm([bd.x, 2, bd.z]); if (s) froeFlyv.push({ x: s.x, y: s.y, t: 0 }); }
  });

  function udklipAf(u) { u.b = u.h * (forhold[u.tx] || 1); u.alfa = u.alfa === undefined ? 1 : u.alfa; u.dy = u.dy || 0; udklip.push(u); return u; }
  function staa(tx, x, z, h, ekstra) { var u = { tx: tx, x: x, y: hoejde(x, z) - 0.3, z: z, h: h }; for (var k in ekstra) u[k] = ekstra[k]; return udklipAf(u); }

  function byggVerden() {
    var r = tilfaeldig(11);
    staa('traeSommer', -27, -26, 24, { skiftTrae: true, foran: -2 });
    staa('hus', 20, -30, 17);
    /* Traeer paa bakkerne bag haven */
    for (var i = 0; i < 46; i++) {
      var x = (r() - 0.5) * 220, z = -30 - r() * 80;
      if (i % 3 === 0) { x = (r() < 0.5 ? -1 : 1) * (42 + r() * 50); z = -20 + r() * 50; }
      if (Math.abs(x) < 36 && z > -24) continue;
      var gran = r() < 0.45;
      staa(gran ? 'gran' : 'traeSommer', x, z, 12 + r() * 9, gran ? { granTrae: true } : { skiftTrae: true });
    }
    /* Himlen */
    for (i = 0; i < 9; i++) { var sky = staa('sky', -120 + i * 30 + r() * 10, -150 - r() * 60, 20 + r() * 12, { sky: true }); sky.y = 55 + r() * 30; sky.taet = 0.0004; sky.fase = r() * 10; }
    var sol = staa('sol', 60, -260, 70, { solen: true }); sol.taet = 0;
    /* Kurven foran til hoejre */
    staa('kurv', KURV.x, KURV.z, 6.5, { foran: -1 });
    /* Dyrene: hver aarstid har sine */
    dyr.pelle = staa('pindsvin', H.pelle.x, H.pelle.z, 5.5, { foran: 1 });
    dyr.kanin = staa('kanin', H.kanin.x, H.kanin.z, 4.2, { aar: { foraar: 1, sommer: 1, efteraar: 1 }, foran: 2 });
    dyr.fugl = staa('fugl', H.fugl.x, H.fugl.z, 3, { foran: 2 });
    var froe = staa('froe', -24, 13, 3, { aar: { foraar: 1 } });
    froe.opdater = function (t) { froe.dy = Math.max(0, Math.sin(t * 1.3)) * 2.5; };
    var bi = staa('bi', 0, 0, 2.2, { aar: { sommer: 1 }, flyver: true });
    bi.opdater = function (t) { var v = t * 0.7; bi.x = Math.sin(v) * 22; bi.z = -2 + Math.sin(v * 1.7) * 8; bi.y = 5 + Math.sin(t * 3); };
    var sf = staa('sommerfugl', 0, 0, 2.4, { aar: { sommer: 1 }, flyver: true });
    sf.opdater = function (t) { var v = t * 0.4 + 2; sf.x = Math.cos(v) * 18; sf.z = 2 + Math.sin(v * 1.3) * 9; sf.y = 6 + Math.sin(t * 2.2) * 1.5; sf.b = 2.4 * (0.6 + 0.4 * Math.abs(Math.sin(t * 9))); };
    var egern = staa('egern', -24, -24.5, 3.6, { aar: { efteraar: 1 } });
    egern.opdater = function (t) { egern.y = 6 + Math.abs(Math.sin(t * 0.8)) * 8; };
    staa('snemand', -17, 14, 7, { aar: { vinter: 1 } });
    staa('ugle', -25.5, -25.6, 3.4, { aar: { vinter: 1 } }).y = 13;
    /* Aebler i traeet om efteraaret: hvert udklip foelger sit aeble i haven */
    dyr.aebler = H.aebler.map(function (a) { var u = staa('aeble', a.x, a.z, 1.9, { aar: { efteraar: 1 }, aebleI: true }); u.y = a.y; u.aeble = a; return u; });
  }
  /* Dyrene staar dér, hvor haven siger */
  function synkDyr() {
    if (!dyr.pelle) return;
    dyr.pelle.x = H.pelle.x; dyr.pelle.z = H.pelle.z; dyr.pelle.dy = H.pelleDy;
    dyr.kanin.x = H.kanin.x; dyr.kanin.z = H.kanin.z; dyr.kanin.dy = H.kanin.dy;
    var f = H.fugl; dyr.fugl.x = f.x; dyr.fugl.y = f.y; dyr.fugl.z = f.z; dyr.fugl.dy = f.dy; dyr.fugl.alfa = f.alfa; dyr.fugl.flyver = f.flyver;
    dyr.aebler.forEach(function (u) { u.alfa = u.aeble.alfa; });
  }

  function opdater(dt) {
    tid += dt;
    udklip.forEach(function (u) { if (u.opdater) u.opdater(tid); });
    /* Kameraet: fast, med en blid vuggen. Ved et aarstidsskifte glider det en halv tur ud og tilbage. */
    var drej = Math.sin(tid * 0.12) * 0.05, h = 0;
    if (H.skift) { var st = Math.min(H.skift.t, 1); drej += Math.sin(st * Math.PI) * 0.55; h = Math.sin(st * Math.PI) * 6; }
    if (tilstand === 'menu') drej = tid * 0.08;
    kam.pos = [Math.sin(drej) * 50, 25 + h, Math.cos(drej) * 50 - 4]; kam.maal = [0, 1, -5];
    if (tilstand !== 'have') return;

    H.opdater(dt);
    synkDyr();
    var aar = H.aar;
    /* Regn, blade og sne */
    if (H.regn) for (var i = 0; i < 6; i++) partikler.push({ tx: 'draabe', x: (Math.random() - 0.5) * 70, y: 26, z: -16 + Math.random() * 34, vx: -2, vy: -26, vz: 0, g: 0, liv: 1.1, str: 0.8, bund: 0.2 });
    if (aar === 'efteraar' && Math.random() < dt * 3) partikler.push({ tx: 'blad' + Math.floor(Math.random() * 3), x: -27 + (Math.random() - 0.5) * 16, y: 20, z: -24 + Math.random() * 8, vx: 1.5, vy: -2.2, vz: 2, g: 0, liv: 9, str: 1.1, svaj: Math.random() * 6, bund: 0.2 });
    if (aar === 'vinter' && Math.random() < dt * 14) partikler.push({ tx: 'fnug', x: (Math.random() - 0.5) * 90, y: 30, z: -30 + Math.random() * 60, vx: 0, vy: -3.5, vz: 0, g: 0, liv: 10, str: 0.6 + Math.random() * 0.5, svaj: Math.random() * 6, bund: 0.2 });
    partikler.forEach(function (p) {
      p.vy -= (p.g || 0) * dt; p.x += (p.vx + (p.svaj !== undefined ? Math.sin(tid * 2 + p.svaj) * 1.5 : 0)) * dt; p.y += p.vy * dt; p.z += p.vz * dt; p.liv -= dt;
      if (p.bund !== undefined && p.y < p.bund) p.liv = Math.min(p.liv, 0);
    });
    partikler = partikler.filter(function (p) { return p.liv > 0; });
  }

  /* ---------- tegning ---------- */
  var SOL = norm([0.45, 0.8, 0.35]), TAET = 0.0032;
  var vp = null, kamHoejre = [1, 0, 0];
  function bindForm(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.n); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.f); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
  }
  function tegnForm(m, model, farve) {
    bindForm(m);
    gl.uniformMatrix4fv(LYS.u.m, false, model);
    gl.uniform4fv(LYS.u.tone, farve || [1, 1, 1, 0]);
    gl.uniform1f(LYS.u.vand, 0);
    gl.drawElements(gl.TRIANGLES, m.antal, gl.UNSIGNED_SHORT, 0);
  }
  function projicer(p) {
    if (!vp) return null;
    var x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    var y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    var w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    return { nx: x / Math.abs(w || 1e-6), ny: y / Math.abs(w || 1e-6), bag: w <= 0 };
  }
  function bedRys(bd) { return bd.rys > 0 ? Math.sin(bd.rys * 28) * 0.35 * bd.rys : 0; }

  function tegn() {
    var W = cv.width, Hh = cv.height, aar = H.aar, S = SAESON[aar];
    var top = hex(S.top), bund = hex(S.bund);
    gl.viewport(0, 0, W, Hh);
    gl.clearColor(bund[0], bund[1], bund[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var asp = W / Hh, fov = (asp < 1 ? 68 : 48) * Math.PI / 180;
    var proj = M.persp(fov, asp, 1, 900), kig = M.kig(kam.pos, kam.maal, [0, 1, 0]);
    vp = M.gange(proj, kig.m); kamHoejre = kig.hoejre;

    var fr = norm(sub(kam.maal, kam.pos)), vf = norm([fr[0], 0, fr[2]]);
    var c = projicer([kam.pos[0] + vf[0] * 800, kam.pos[1], kam.pos[2] + vf[2] * 800]);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(HIMMEL.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, SKAERM); gl.enableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, HJ_IDX);
    gl.uniform1f(HIMMEL.u.hor, c ? klem(c.ny * 0.5 + 0.5, -0.5, 1.5) : 0.5);
    gl.uniform3fv(HIMMEL.u.top, top); gl.uniform3fv(HIMMEL.u.bund, bund);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.useProgram(LYS.p);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.uniformMatrix4fv(LYS.u.vp, false, vp);
    gl.uniform3fv(LYS.u.sol, SOL); gl.uniform3fv(LYS.u.taage, bund); gl.uniform3fv(LYS.u.kam, kam.pos);
    gl.uniform1f(LYS.u.taet, TAET); gl.uniform1f(LYS.u.tid, tid);
    var id = M.en(), lys = S.lys;
    tegnForm(landskab[aar], id, [lys, lys, lys, 0]);
    tegnForm(hegn, id, [lys, lys, lys, 0]);
    if (aar === 'vinter') tegnForm(sneHegn, id, [1, 1, 1, 0.08]);
    H.bede.forEach(function (bd) {
      var m = kaede(M.flyt(bd.x + bedRys(bd), 0, bd.z));
      tegnForm(bedRamme, m, [lys, lys, lys, 0]);
      var v = bd.vaad > 0 ? 0.72 + 0.28 * (1 - Math.min(1, bd.vaad / 2)) : 1;
      if (bd.toerst) v = 1.14;
      tegnForm(muld, m, [v, v, v * (bd.toerst ? 0.92 : 1.02), 0]);
      if (aar === 'vinter') tegnForm(sneBed, m, [1, 1, 1, 0.08]);
      var haeng = bd.toerst ? 0.8 : 0, farve = bd.toerst ? [1.25, 1.02, 0.42, 0] : [lys, lys, lys, 0];
      var gnav = bd.gnav ? 1 - bd.gnav * 0.35 : 1;
      if (bd.fase === 'spire' || bd.fase === 'plante') {
        var g = bd.fase === 'spire' ? 0.35 + 0.65 * bd.vaekst : 1;
        [-3, 0, 3].forEach(function (dx) { tegnForm(spire, kaede(m, M.flyt(dx, 0.95, 0), M.rotY(dx * 0.4 + Math.sin(tid + dx) * 0.08), M.rotX(haeng), M.skala(g * gnav)), farve); });
      }
      if (bd.fase === 'plante' || bd.fase === 'moden') {
        var g2 = bd.fase === 'plante' ? 0.3 + 0.35 * bd.vaekst : 0.65 + 0.35 * bd.vaekst;
        [-2.2, 2.2].forEach(function (dx) { tegnForm(plante, kaede(m, M.flyt(dx, 0.95, 0.3), M.rotY(dx), M.rotX(haeng * 0.6), M.skala(g2 * gnav)), farve); });
      }
    });

    /* Udklip */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(UDKLIP.p);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, HJOERNER); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, HJ_IDX);
    gl.uniformMatrix4fv(UDKLIP.u.vp, false, vp);
    gl.uniform3fv(UDKLIP.u.taage, bund); gl.uniform3fv(UDKLIP.u.kam, kam.pos);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(UDKLIP.u.tx, 0);
    var liste = [], kx = kam.pos[0], ky = kam.pos[1], kz = kam.pos[2];
    function afst(x, y, z) { return Math.sqrt((x - kx) * (x - kx) + (y - ky) * (y - ky) + (z - kz) * (z - kz)); }
    function laeg(u, foran) { liste.push({ u: u, d: afst(u.x, u.y, u.z) - (foran || 0) }); }
    udklip.forEach(function (u) {
      if (u.aar && !u.aar[aar]) return;
      if (u.alfa <= 0) return;
      var v = u;
      if (u.skiftTrae) { v = Object.create(u); v.tx = S.trae; }
      if (u.granTrae && aar === 'vinter') { v = Object.create(u); v.tx = 'granSne'; }
      if (u.sky) { v = Object.create(u); v.tx = aar === 'foraar' && H.regn ? 'regnsky' : 'sky'; v.x = u.x + ((tid * 1.5 + u.fase * 20) % 260) - 130; }
      if (u.solen) { v = Object.create(u); v.y = 20 + S.solH * 140; v.alfa = aar === 'vinter' ? 0.7 : 1; }
      laeg(v, u.foran || 0);
      if (!u.flyver && !u.sky && !u.solen && u.h < 8 && !u.aebleI) laeg({ tx: 'skygge', x: u.x, y: 0.12, z: u.z - u.h * 0.35, h: u.h * 0.7, b: u.h * 0.7, alfa: 0.9, flad: true, hoejre: [1, 0, 0], op: [0, 0, 1] }, -50);
    });
    /* Afgroederne i bedene, frøene i jorden og det, der er i kurven */
    H.bede.forEach(function (bd) {
      var r = bedRys(bd);
      if (bd.fase === 'saaet') laeg({ tx: 'froerk', x: bd.x + r, y: 1.02, z: bd.z - 1.5 * bd.vaekst, h: 3 * bd.vaekst, b: 8 * bd.vaekst, alfa: 1, flad: true, hoejre: [1, 0, 0], op: [0, 0, 1] }, -30);
      /* Skiltet ved bedet viser, hvad der gror. Oensker Pelle sig det, vipper det. */
      var vip = H.oenskerSig(bd.afgr) && aar !== 'vinter' ? Math.abs(Math.sin(tid * 4)) * 0.7 : 0;
      laeg({ tx: bd.afgr, x: bd.x - BED_B / 2 + 0.7 + r, y: 2.6 + vip, z: bd.z + BED_D / 2 + 0.1, h: 2.4, b: 2.4, alfa: 1 }, 2);
      /* En toerstig plante: en vanddraabe hopper over bedet */
      if (bd.toerst) laeg({ tx: 'draabe', x: bd.x + r, y: 5.2 + Math.abs(Math.sin(tid * 3)) * 1.2, z: bd.z, h: 2.6, b: 2.6, alfa: 1 }, 4);
      if (bd.fase === 'moden' && bd.vaekst > 0.3) {
        var g = (bd.vaekst - 0.3) / 0.7 * (bd.gnav ? 1 - bd.gnav * 0.3 : 1);
        /* Guleroden gror nede i jorden: kun toppen stikker op. Resten haenger paa planten eller ligger oven paa jorden. */
        var jord = bd.afgr === 'gulerod';
        POS[(bd.antal || 2) - 1].forEach(function (dx) {
          var hh = 3.4 * g;
          laeg({ tx: bd.afgr, x: bd.x + dx + r, y: jord ? 0.95 - hh * 0.6 : 1.1 - (bd.toerst ? 0.7 : 0), z: bd.z + 0.3, h: hh, b: hh * (forhold[bd.afgr] || 1), alfa: 1 }, 1);
        });
      }
    });
    H.pelleFaaet.slice(-6).forEach(function (tx, i) {
      laeg({ tx: tx, x: H.pelle.x + 3 + (i % 3) * 1.1, y: 0.1 + Math.floor(i / 3) * 0.9, z: H.pelle.z + 0.4, h: 1.5, b: 1.5, alfa: 1 }, 1.5);
    });
    H.kurv.slice(-8).forEach(function (tx, i) {
      laeg({ tx: tx, x: KURV.x - 1.6 + (i % 4) * 1.05, y: 2.4 + Math.floor(i / 4) * 0.7, z: KURV.z - 0.2, h: 1.8, b: 1.8, alfa: 1 }, 0.5);
    });
    H.flyvere.forEach(function (f) {
      var t = klem(f.t, 0, 1);
      laeg({ tx: f.tx, x: mix(f.fra[0], f.til[0], t), y: mix(f.fra[1], f.til[1], t) + Math.sin(t * Math.PI) * 9, z: mix(f.fra[2], f.til[2], t), h: f.h * (1 - t * 0.45), b: f.h * (1 - t * 0.45), alfa: f.t < 0 ? 0 : 1 }, 3);
    });
    partikler.forEach(function (p) { laeg({ tx: p.tx, x: p.x, y: p.y, z: p.z, h: p.str, b: p.str, alfa: klem(p.liv * 2, 0, 1) }, 0); });
    liste.sort(function (a, b) { return b.d - a.d; });
    liste.forEach(function (e) {
      var u = e.u, t = tekstur[u.tx]; if (!t) return;
      gl.bindTexture(gl.TEXTURE_2D, t);
      if (u.flad) { gl.uniform3fv(UDKLIP.u.hoejre, u.hoejre); gl.uniform3fv(UDKLIP.u.op, u.op); }
      else { gl.uniform3fv(UDKLIP.u.hoejre, kamHoejre); gl.uniform3fv(UDKLIP.u.op, [0, 1, 0]); }
      gl.uniform3f(UDKLIP.u.pos, u.x, u.y + (u.dy || 0), u.z);
      gl.uniform2f(UDKLIP.u.str, u.b || u.h, u.h);
      gl.uniform1f(UDKLIP.u.alfa, u.alfa === undefined ? 1 : u.alfa);
      gl.uniform1f(UDKLIP.u.taet, u.taet === null || u.taet === undefined ? TAET : u.taet);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  /* ---------- HUD: aarstidsuret, redskaberne og Pelles boble ---------- */
  var hudSkala = 1, knapper = [], uret = null, boble = null;
  var UR_FARVER = { foraar: '#a9c97a', sommer: '#f0c46a', efteraar: '#e08a52', vinter: '#aed3e4' };
  function tegnRedskab(c, hvad, x, y, r) {
    c.save(); c.translate(x, y); c.lineWidth = 3.5; c.strokeStyle = KANT; c.lineJoin = 'round'; c.lineCap = 'round';
    if (hvad === 'froe') {
      rr(c, -r * 0.36, -r * 0.42, r * 0.72, r * 0.86, 10); c.fillStyle = '#e5d3ae'; c.fill(); c.stroke();
      c.fillStyle = '#d95f45'; c.beginPath(); c.arc(0, 0, r * 0.17, 0, 7); c.fill();
      c.fillStyle = '#8a663d'; [-0.18, 0.02, 0.2].forEach(function (d) { c.beginPath(); c.ellipse(d * r, r * 0.25, 5, 3.5, 0, 0, 7); c.fill(); });
      c.fillStyle = '#93bc63'; c.beginPath(); c.ellipse(-r * 0.12, -r * 0.2, 10, 6, -0.7, 0, 7); c.ellipse(r * 0.12, -r * 0.2, 10, 6, 0.7, 0, 7); c.fill();
    } else if (hvad === 'vand') {
      rr(c, -r * 0.4, -r * 0.1, r * 0.7, r * 0.5, 8); c.fillStyle = '#5f9fc9'; c.fill(); c.stroke();
      c.beginPath(); c.moveTo(r * 0.3, 0); c.lineTo(r * 0.62, -r * 0.3); c.stroke();
      c.beginPath(); c.arc(-r * 0.05, -r * 0.2, r * 0.22, Math.PI, 0); c.stroke();
      c.fillStyle = '#8fc7e8'; [[r * 0.7, -r * 0.5], [r * 0.82, -r * 0.35], [r * 0.6, -r * 0.62]].forEach(function (p) { c.beginPath(); c.ellipse(p[0], p[1], 4, 6, 0, 0, 7); c.fill(); });
    } else {
      c.fillStyle = '#d9ba8a'; c.beginPath(); c.moveTo(-r * 0.5, -r * 0.1); c.lineTo(r * 0.5, -r * 0.1); c.lineTo(r * 0.36, r * 0.42); c.lineTo(-r * 0.36, r * 0.42); c.closePath(); c.fill(); c.stroke();
      c.beginPath(); c.arc(0, -r * 0.12, r * 0.36, Math.PI, 0); c.stroke();
    }
    c.restore();
  }
  function flueben(x, y, r) {
    hx.fillStyle = '#8fae86'; hx.beginPath(); hx.arc(x, y, r, 0, 7); hx.fill();
    hx.strokeStyle = '#f8f1e6'; hx.lineWidth = r * 0.35; hx.lineCap = 'round'; hx.lineJoin = 'round';
    hx.beginPath(); hx.moveTo(x - r * 0.45, y); hx.lineTo(x - r * 0.1, y + r * 0.38); hx.lineTo(x + r * 0.5, y - r * 0.35); hx.stroke();
  }
  /* Soevn: et Z tegnet med tre streger, saa der ikke er bogstaver at laese */
  function tegnZ(x, y, s) {
    hx.beginPath(); hx.moveTo(x - s / 2, y - s / 2); hx.lineTo(x + s / 2, y - s / 2); hx.lineTo(x - s / 2, y + s / 2); hx.lineTo(x + s / 2, y + s / 2); hx.stroke();
  }
  /* Kategorien i boblen: en farveklat for roedt og groent, og et snit af jorden med en rod for det, der gror nede i jorden */
  function ikonKat(kat, x, y, r) {
    hx.save(); hx.lineWidth = 2.5; hx.strokeStyle = KANT;
    if (kat === 'jord') {
      hx.fillStyle = '#8a663d'; rr(hx, x - r, y - r * 0.1, r * 2, r * 1.1, 6); hx.fill(); hx.stroke();
      hx.fillStyle = '#e08a52'; hx.beginPath(); hx.moveTo(x - r * 0.3, y - r * 0.05); hx.lineTo(x + r * 0.3, y - r * 0.05); hx.lineTo(x, y + r * 0.85); hx.closePath(); hx.fill();
      hx.strokeStyle = '#5f8240'; hx.lineWidth = 3.5; hx.lineCap = 'round';
      hx.beginPath(); hx.moveTo(x, y - r * 0.1); hx.lineTo(x - r * 0.35, y - r * 0.8); hx.moveTo(x, y - r * 0.1); hx.lineTo(x, y - r * 0.95); hx.moveTo(x, y - r * 0.1); hx.lineTo(x + r * 0.35, y - r * 0.8); hx.stroke();
    } else {
      hx.fillStyle = KATEGORI[kat].farve; hx.beginPath();
      for (var i = 0; i <= 12; i++) { var v = i / 12 * Math.PI * 2, r2 = r * (0.85 + 0.15 * Math.sin(i * 2.3)); hx.lineTo(x + Math.cos(v) * r2, y + Math.sin(v) * r2); }
      hx.closePath(); hx.fill(); hx.stroke();
      hx.fillStyle = 'rgba(255,255,255,.5)'; hx.beginPath(); hx.ellipse(x - r * 0.3, y - r * 0.3, r * 0.22, r * 0.14, -0.6, 0, 7); hx.fill();
    }
    hx.restore();
  }
  /* Hvor boblen skal staa: lige over Pelle, men aldrig oven paa et bed, redskaberne eller uret.
     Rammer den noget, rykker den til siden, saa langt halen stadig kan pege paa Pelle. */
  var bobleSted = null;
  function placerBoble(ph, b, h, W, noegle, ik) {
    var px = ph.x, by = ph.y - h - 12, luft = 10;   // lidt luft, saa kameraets vuggen ikke skubber boblen ind over et bed
    var forhindringer = H.bede.map(bedKasse).filter(Boolean).map(function (k) { return { x0: k.x0 - luft, y0: k.y0 - luft, x1: k.x1 + luft, y1: k.y1 + luft }; });
    knapper.forEach(function (k) { forhindringer.push({ x0: k.x - k.r, y0: k.y - k.r, x1: k.x + k.r, y1: k.y + k.r }); });
    if (uret) forhindringer.push({ x0: uret.x - uret.r, y0: uret.y - uret.r, x1: uret.x + uret.r, y1: uret.y + uret.r });
    function overlap(x) {
      var sum = 0;
      forhindringer.forEach(function (o) {
        var dx = Math.min(x + b, o.x1) - Math.max(x, o.x0), dy = Math.min(by + h + 12, o.y1) - Math.max(by, o.y0);
        if (dx > 0 && dy > 0) sum += dx * dy;
      });
      return sum;
    }
    var bedst = klem(px - b / 2, 8, W - b - 8), mindst = overlap(bedst);
    for (var skub = 20; mindst > 0 && skub <= b / 2 - 10; skub += 20) {
      [-skub, skub].forEach(function (d) {
        var x = klem(px - b / 2 + d, 8, W - b - 8), o = overlap(x);
        if (o < mindst) { mindst = o; bedst = x; }
      });
    }
    if (mindst === 0 && by > 0) return { noegle: noegle, dx: bedst - px };
    /* Ingen fri plads over Pelle (fx en telefon paa siden): boblen staar fast oppe mod himlen, ved siden af uret.
       Helst til hoejre med et lille billede af Pelle, ellers uden billedet, ellers til venstre, og kun til sidst under uret. */
    var portraet = ik + 8, uretV = uret ? uret.x - uret.r - 8 : W, uretH = uret ? uret.x + uret.r + 8 : 0, venstre = 84;
    var muligheder = [
      { x: W - b - portraet - 12, b: b + portraet, portraet: true },
      { x: W - b - 12, b: b, portraet: false },
      { x: venstre, b: b + portraet, portraet: true },
      { x: venstre, b: b, portraet: false }
    ];
    for (var i = 0; i < muligheder.length; i++) {
      var m = muligheder[i], fri = m.x >= uretH || m.x + m.b <= uretV;
      if (fri && m.x >= venstre - 1 && m.x + m.b <= W - 8) return { noegle: noegle, fast: true, x: m.x, y: 12, portraet: m.portraet };
    }
    return { noegle: noegle, fast: true, x: W - b - portraet - 12, y: uret ? uret.y + uret.r + 8 : 12, portraet: true };
  }
  function tegnHud() {
    var W = hud.width / hudSkala, Hh = hud.height / hudSkala, aar = H.aar, skift = H.skift;
    hx.setTransform(hudSkala, 0, 0, hudSkala, 0, 0);
    hx.clearRect(0, 0, W, Hh);
    knapper = []; uret = null; boble = null;
    if (tilstand !== 'have') return;
    var smal = W < 700 || Hh < 500;   // en telefon paa siden er bred, men lav
    /* Aarstidsuret: fire farvede felter og en viser. Tryk, og det bliver naeste aarstid. */
    var ur = smal ? 34 : 44, ux = W / 2, uy = 16 + ur;
    uret = { x: ux, y: uy, r: ur + 8 };
    hx.save(); hx.shadowColor = 'rgba(107,85,68,.22)'; hx.shadowOffsetY = 5; hx.shadowBlur = 8;
    hx.fillStyle = '#f8f1e6'; hx.beginPath(); hx.arc(ux, uy, ur + 7, 0, 7); hx.fill(); hx.restore();
    AAR.forEach(function (a, i) {
      hx.fillStyle = UR_FARVER[a]; hx.beginPath(); hx.moveTo(ux, uy);
      hx.arc(ux, uy, ur, -Math.PI / 2 + i * Math.PI / 2, -Math.PI / 2 + (i + 1) * Math.PI / 2); hx.closePath(); hx.fill();
    });
    var ai = AAR.indexOf(aar) + (skift && !skift.skiftet ? klem(skift.t * 2, 0, 1) : 0);
    var vv = -Math.PI / 2 + (ai + 0.5) * Math.PI / 2;
    hx.strokeStyle = KANT; hx.lineWidth = 5; hx.lineCap = 'round';
    hx.beginPath(); hx.moveTo(ux, uy); hx.lineTo(ux + Math.cos(vv) * ur * 0.78, uy + Math.sin(vv) * ur * 0.78); hx.stroke();
    hx.fillStyle = KANT; hx.beginPath(); hx.arc(ux, uy, 5, 0, 7); hx.fill();
    hx.lineWidth = 3; hx.beginPath(); hx.arc(ux, uy, ur, 0, 7); hx.stroke();

    /* Redskaberne: én raekke pr. spiller. Den valgte er blaa. */
    var r = smal ? 30 : 40, gab = r * 2.35, y = Hh - r - 18;
    for (var p = 0; p < spillere; p++) {
      var x0 = spillere === 1 ? W / 2 - gab : (p === 0 ? r + 24 : W - r - 24 - gab * 2);
      ['froe', 'vand', 'kurv'].forEach(function (hvad, i) {
        var x = x0 + i * gab, valgt = valg[p] === hvad;
        hx.save(); hx.shadowColor = 'rgba(107,85,68,.22)'; hx.shadowOffsetY = 5; hx.shadowBlur = 8;
        hx.fillStyle = spillere === 2 ? ['#d95f45', '#5f9fc9'][p] : '#efe3d0'; hx.beginPath(); hx.arc(x, y, r + 6, 0, 7); hx.fill(); hx.restore();
        hx.fillStyle = valgt ? '#aed3e4' : '#f8f1e6'; hx.beginPath(); hx.arc(x, y + (valgt ? 2 : 0), r, 0, 7); hx.fill();
        hx.lineWidth = 3; hx.strokeStyle = KANT; hx.stroke();
        tegnRedskab(hx, hvad, x, y + (valgt ? 2 : 0), r * (smal ? 0.9 : 1));
        knapper.push({ x: x, y: y, r: r + 8, spiller: p, hvad: hvad });
      });
    }
    /* Pelles boble: det, han oensker sig, med én prik for hver, der skal taelles. Fyldte prikker er dem, han har faaet.
       Med én stjerne staar tingene der i stedet for prikker, og de faar et flueben, naar de er kommet. Om vinteren sover han. */
    var ph = skaerm([H.pelle.x, 5.9, H.pelle.z]), oenske = H.oenske;   // boblen foelger ikke Pelles hop
    if (ph && (oenske || aar === 'vinter') && !skift) {
      /* Delene staar ved siden af hinanden, saa boblen kun er én raekke hoej og holder sig nede ved Pelle */
      var ik = smal ? 38 : 48, prik = smal ? 8 : 10, pad = 10, gab = 18, dele = oenske ? oenske.dele : [];
      var delB = dele.map(function (d) { return H.niveau === 1 && d.afgr ? d.antal * ik * 0.86 : ik + 8 + d.antal * (prik * 2 + 5); });
      var bredde = aar === 'vinter' ? (smal ? 64 : 78) : pad * 2 + delB.reduce(function (a, b) { return a + b; }, 0) + gab * (dele.length - 1);
      var hoej = aar === 'vinter' ? bredde : pad * 2 + ik;
      /* Pladsen vaelges én gang pr. oenske og skaermstoerrelse, saa boblen aldrig hopper frem og tilbage */
      var noegle = [W, Hh, bredde, hoej, spillere].join(':');
      if (!bobleSted || bobleSted.noegle !== noegle) bobleSted = placerBoble(ph, bredde, hoej, W, noegle, ik);
      var fast = !!bobleSted.fast, portraet = fast && bobleSted.portraet ? ik : 0;
      if (portraet) bredde += portraet + 8;
      var bx = fast ? bobleSted.x : klem(ph.x + bobleSted.dx, 8, W - bredde - 8), by = fast ? bobleSted.y : ph.y - hoej - 12;
      boble = { x: bx, y: by, b: bredde, h: hoej };
      hx.save(); hx.shadowColor = 'rgba(107,85,68,.22)'; hx.shadowOffsetY = 4; hx.shadowBlur = 8;
      hx.fillStyle = '#f8f1e6'; rr(hx, bx, by, bredde, hoej, 18); hx.fill();
      if (!fast) {   // halen peger ned paa Pelle
        var halen = klem(ph.x, bx + 20, bx + bredde - 20);
        hx.beginPath(); hx.moveTo(halen - 9, by + hoej - 1); hx.lineTo(ph.x, by + hoej + 11); hx.lineTo(halen + 9, by + hoej - 1); hx.fill();
      }
      hx.restore();
      if (portraet && billede.pindsvin) {   // oppe ved himlen viser et lille billede af Pelle, hvem der oensker sig noget
        var pb = billede.pindsvin, ph2 = ik * 1.05, pw = ph2 * (forhold.pindsvin || 1);
        hx.drawImage(pb, bx + pad + (ik - pw) / 2, by + (hoej - ph2) / 2, pw, ph2);
        bx += portraet + 8;
      }
      if (aar === 'vinter') {
        var zz = Math.sin(tid * 2) * 3, vb = hoej;   // vinterboblen er kvadratisk; portraettet staar foran den i hjoernet
        hx.strokeStyle = '#6b5545'; hx.lineWidth = Math.max(2.5, vb * 0.05); hx.lineCap = 'round'; hx.lineJoin = 'round';
        tegnZ(bx + vb * 0.32, by + vb * 0.68 + zz, vb * 0.14); tegnZ(bx + vb * 0.5, by + vb * 0.5 - zz, vb * 0.18); tegnZ(bx + vb * 0.7, by + vb * 0.3 + zz, vb * 0.24);
      } else dele.forEach(function (d, i) {
        var cy = by + pad + ik / 2, x = bx + pad;
        for (var f = 0; f < i; f++) x += delB[f] + gab;
        if (i > 0) { hx.strokeStyle = 'rgba(94,74,58,.25)'; hx.lineWidth = 2; hx.beginPath(); hx.moveTo(x - gab / 2, by + pad + 4); hx.lineTo(x - gab / 2, by + hoej - pad - 4); hx.stroke(); }
        if (H.niveau === 1 && d.afgr) {
          for (var k = 0; k < d.antal; k++) {
            var ix = x + k * ik * 0.86, bi = billede[d.afgr], s = ik * 0.9;
            hx.globalAlpha = k < d.faaet ? 0.45 : 1;
            if (bi) hx.drawImage(bi, ix, cy - s / 2, s, s);
            hx.globalAlpha = 1;
            if (k < d.faaet) flueben(ix + s * 0.62, cy + s * 0.2, s * 0.26);
          }
          return;
        }
        if (d.afgr) { var b2 = billede[d.afgr]; if (b2) hx.drawImage(b2, x, cy - ik / 2, ik, ik); }
        else ikonKat(d.kat, x + ik / 2, cy, ik * 0.42);
        for (var j = 0; j < d.antal; j++) {
          var px = x + ik + 8 + prik + j * (prik * 2 + 5);
          hx.beginPath(); hx.arc(px, cy, prik, 0, 7);
          if (j < d.faaet) { hx.fillStyle = '#f0c46a'; hx.fill(); }
          hx.lineWidth = 2.5; hx.strokeStyle = KANT; hx.stroke();
        }
      });
    }
    /* Frø fra efteraarets hoest flyver ned i frøposen, og posen viser, hvor mange slags der er gemt */
    var fk = knapper.filter(function (k) { return k.hvad === 'froe'; })[0];
    froeFlyv.forEach(function (f) {
      f.t = Math.min(1, f.t + 1 / 70);
      if (!fk) return;
      var x = mix(f.x, fk.x, f.t), y = mix(f.y, fk.y, f.t) - Math.sin(f.t * Math.PI) * 80;
      hx.fillStyle = '#e5d3ae'; hx.strokeStyle = KANT; hx.lineWidth = 2;
      [[-8, 2], [6, 6], [0, -8]].forEach(function (q) { hx.beginPath(); hx.ellipse(x + q[0], y + q[1], 6, 4, 0.4, 0, 7); hx.fill(); hx.stroke(); });
    });
    froeFlyv = froeFlyv.filter(function (f) { return f.t < 1; });
    var gemt = Object.keys(H.gemteFroe).length;
    if (gemt && aar !== 'foraar') knapper.filter(function (k) { return k.hvad === 'froe'; }).forEach(function (k) {
      for (var g = 0; g < gemt; g++) { hx.fillStyle = '#e5d3ae'; hx.strokeStyle = KANT; hx.lineWidth = 2; hx.beginPath(); hx.ellipse(k.x - (gemt - 1) * 6 + g * 12, k.y - k.r - 4, 5, 3.5, 0.4, 0, 7); hx.fill(); hx.stroke(); }
    });
    /* Aarstidsskiftet: et bloedt sloer midtvejs */
    if (skift) {
      var a = Math.max(0, 1 - Math.abs(skift.t - 0.5) * 5);
      if (a > 0) { hx.fillStyle = 'rgba(248,241,230,' + (a * 0.85) + ')'; hx.fillRect(0, 0, W, Hh); }
    }
  }

  /* ---------- tryk ---------- */
  function skaerm(p) { var q = projicer(p); if (!q || q.bag) return null; return { x: (q.nx * 0.5 + 0.5) * window.innerWidth, y: (0.5 - q.ny * 0.5) * window.innerHeight }; }
  function indeI(pkt, poly) {
    var inde = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      var a = poly[i], b = poly[j];
      if ((a.y > pkt.y) !== (b.y > pkt.y) && pkt.x < (b.x - a.x) * (pkt.y - a.y) / (b.y - a.y) + a.x) inde = !inde;
    }
    return inde;
  }
  /* Hvilket bed er trykket paa? Hele bedet med lidt luft omkring, og planterne over det. */
  function bedVed(x, y) {
    var pkt = { x: x, y: y }, bedst = null, bd0 = 1e9;
    H.bede.forEach(function (bd) {
      var hb = BED_B / 2 + 0.8, hd = BED_D / 2 + 0.8;
      var poly = [[-hb, -hd], [hb, -hd], [hb, hd], [-hb, hd]].map(function (k) { return skaerm([bd.x + k[0], BED_H, bd.z + k[1]]); });
      var over = [-hb, hb].map(function (dx) { return skaerm([bd.x + dx, 4.5, bd.z]); });
      if (poly.some(function (q) { return !q; })) return;
      var m = skaerm([bd.x, BED_H, bd.z]), d = Math.hypot(x - m.x, y - m.y);
      if ((indeI(pkt, poly) || indeI(pkt, [poly[0], poly[1], over[1] || poly[1], over[0] || poly[0]])) && d < bd0) { bd0 = d; bedst = bd; }
    });
    return bedst;
  }
  /* Store trykflader paa dyrene: mindst 55 px fra midten */
  function dyrVed(u, x, y) {
    if (!u || u.alfa <= 0) return false;
    var c = skaerm([u.x, u.y + (u.dy || 0) + u.h * 0.5, u.z]), t = skaerm([u.x, u.y + (u.dy || 0) + u.h, u.z]);
    if (!c || !t) return false;
    return Math.hypot(x - c.x, y - c.y) < Math.max(55, Math.abs(c.y - t.y) * 1.6);
  }
  /* Hvor et bed ligger paa skaermen: rammen, planterne over det og skiltet. Boblen maa ikke dække det. */
  function bedKasse(bd) {
    var hb = BED_B / 2 + 0.8, hd = BED_D / 2 + 0.8, xs = [], ys = [];
    [[-hb, BED_H, -hd], [hb, BED_H, -hd], [hb, BED_H, hd], [-hb, BED_H, hd], [-hb, 4.5, 0], [hb, 4.5, 0], [-BED_B / 2 + 0.7, 4, BED_D / 2]].forEach(function (k) {
      var q = skaerm([bd.x + k[0], k[1], bd.z + k[2]]); if (q) { xs.push(q.x); ys.push(q.y); }
    });
    if (!xs.length) return null;
    return { x0: Math.min.apply(null, xs), y0: Math.min.apply(null, ys), x1: Math.max.apply(null, xs), y1: Math.max.apply(null, ys) };
  }
  function pelleKasse() {
    if (!dyr.pelle) return null;
    var h = dyr.pelle.h, b = dyr.pelle.b || h, t = skaerm([H.pelle.x, dyr.pelle.y + h + H.pelleDy, H.pelle.z]), f = skaerm([H.pelle.x, dyr.pelle.y + H.pelleDy, H.pelle.z]);
    var v = skaerm([H.pelle.x - b / 2, dyr.pelle.y, H.pelle.z]), hj = skaerm([H.pelle.x + b / 2, dyr.pelle.y, H.pelle.z]);
    if (!t || !f || !v || !hj) return null;
    return { x0: v.x, y0: t.y, x1: hj.x, y1: f.y };
  }
  function aebleVed(x, y) {
    if (H.aar !== 'efteraar' || !dyr.aebler) return null;
    var bedst = null, bd0 = 60;
    dyr.aebler.forEach(function (u) { if (u.alfa <= 0) return; var s = skaerm([u.x, u.y + 1, u.z]); if (!s) return; var d = Math.hypot(x - s.x, y - s.y); if (d < bd0) { bd0 = d; bedst = u.aeble; } });
    return bedst;
  }
  function tryk(x, y) {
    if (tilstand !== 'have') return;
    for (var i = 0; i < knapper.length; i++) {
      var k = knapper[i];
      if (Math.hypot(x - k.x, y - k.y) < k.r) { valg[k.spiller] = k.hvad; LYDE.vaelg(); return; }
    }
    if (uret && Math.hypot(x - uret.x, y - uret.y) < uret.r) { H.naesteAar(); return; }
    if (H.aar !== 'vinter' && dyrVed(dyr.kanin, x, y) && H.jagKanin()) return;
    if (dyrVed(dyr.fugl, x, y) && H.jagFugl()) return;
    var spiller = spillere === 2 && x > window.innerWidth / 2 ? 1 : 0;
    var bd = bedVed(x, y);
    if (bd) { H.arbejd(bd, valg[spiller]); return; }
    /* Boblen kommer efter bedene: et tryk paa et bed er altid havearbejde, ogsaa hvis boblen staar taet paa */
    if (boble && x > boble.x - 10 && x < boble.x + boble.b + 10 && y > boble.y - 10 && y < boble.y + boble.h + 20) { H.sigOenske(); return; }
    var a = aebleVed(x, y);
    if (a) H.aeble(a, valg[spiller]);
  }

  /* ---------- skaerm og input ---------- */
  var skala = Math.min(window.devicePixelRatio || 1, 1.5);
  function tilpas() {
    var b = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(b * skala); cv.height = Math.round(h * skala);
    hudSkala = Math.min(window.devicePixelRatio || 1, 2);
    hud.width = Math.round(b * hudSkala); hud.height = Math.round(h * hudSkala);
  }
  window.addEventListener('resize', tilpas);
  /* Hvert tryk er sit eget pointerdown, saa to boern kan trykke samtidig */
  hud.addEventListener('pointerdown', function (e) { if (tilstand !== 'have') return; e.preventDefault(); tryk(e.clientX, e.clientY); }, { passive: false });
  hud.addEventListener('contextmenu', function (e) { e.preventDefault(); });

  /* ---------- menuen ---------- */
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }

  /* Menuens billede: Pelle ved et bed, med et oenske i boblen, tegnet med de malede billeder */
  function tegnEksempel(c) {
    var x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#dcebf2'; rr(x, 0, 0, w, h, 18); x.fill();
    x.save(); rr(x, 0, 0, w, h, 18); x.clip();
    x.fillStyle = '#93bc63'; x.beginPath(); x.ellipse(w / 2, h + 60, w * 0.75, 150, 0, 0, 7); x.fill();
    x.fillStyle = '#8a663d'; rr(x, w * 0.36, h * 0.6, w * 0.5, h * 0.24, 12); x.fill();
    x.fillStyle = '#6b4a2e'; rr(x, w * 0.38, h * 0.63, w * 0.46, h * 0.16, 8); x.fill();
    if (billede.tomat) [0.44, 0.56, 0.68].forEach(function (p) { x.drawImage(billede.tomat, w * p, h * 0.42, 44, 44); });
    if (billede.trae) x.drawImage(billede.trae, w * 0.74, h * 0.02, 110, 110);
    if (billede.pindsvin) x.drawImage(billede.pindsvin, w * 0.06, h * 0.5, 96, 96 / (forhold.pindsvin || 1));
    x.restore();
    x.fillStyle = '#f8f1e6'; rr(x, w * 0.05, h * 0.1, 128, 64, 16); x.fill();
    x.beginPath(); x.moveTo(w * 0.05 + 44, h * 0.1 + 63); x.lineTo(w * 0.05 + 54, h * 0.1 + 78); x.lineTo(w * 0.05 + 64, h * 0.1 + 63); x.fill();
    if (billede.tomat) x.drawImage(billede.tomat, w * 0.05 + 8, h * 0.1 + 8, 48, 48);
    for (var j = 0; j < 3; j++) { x.beginPath(); x.arc(w * 0.05 + 70 + j * 18, h * 0.1 + 32, 7, 0, 7); x.lineWidth = 2.5; x.strokeStyle = KANT; x.stroke(); }
  }

  function visMenu() {
    tilstand = 'menu'; tie();
    visOverlay(
      '<div class="kort">' +
      '<h2>Årstidshaven</h2>' +
      '<canvas class="eksempel" width="440" height="220"></canvas>' +
      Menu.stjerneRaekke(svaerhed) +
      Menu.startRaekke('start') +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    var eks = overlay.querySelector('canvas.eksempel');
    if (eks) tegnEksempel(eks);
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) tie(); visMenu(); }
    else if (h === 'start') {
      startLyd(); LYDE.saa();
      spillere = +knap.dataset.spillere || 1; valg = ['froe', 'froe']; partikler = []; froeFlyv = [];
      skjulOverlay();
      H.nulstil(svaerhed + 1, spillere); bobleSted = null;   // foerste saetning siges i selve trykket, ellers er iOS stum
      synkDyr();
      tilstand = 'have';
    }
  });

  /* ---------- loekken ---------- */
  var sidst = 0, fpsSum = 0, fpsN = 0;
  function loekke(nu) {
    var dt = sidst ? Math.min(0.05, (nu - sidst) / 1000) : 0.016; sidst = nu;
    if (window.__fart) dt *= window.__fart;   // kun til afproevning
    fpsSum += dt; fpsN++;
    if (fpsSum > 1) {
      if (fpsN / fpsSum < 32 && skala > 1) { skala = 1; tilpas(); }   // for tungt? Saa faerre pixels
      fpsSum = 0; fpsN = 0;
    }
    opdater(dt);
    tegn(); tegnHud();
    requestAnimationFrame(loekke);
  }

  tilpas();
  AAR.forEach(function (a) { landskab[a] = lavLandskab(a); });
  hegn = lavHegn(false); sneHegn = lavHegn(true);
  bedRamme = lavBedRamme(); muld = lavMuld(); sneBed = lavSneBed(); spire = lavSpire(); plante = lavPlante();
  Skal.menuKnap(visMenu);      // pilen i hjoernet foerer tilbage til menuen, ogsaa midt i haven
  visMenu();
  hentBilleder(function () {
    lavKodeTeksturer();
    byggVerden();
    if (tilstand === 'menu') visMenu();
  });
  requestAnimationFrame(loekke);

  /* Kun til afproevning */
  window.__debug = function () {
    function s(p) { return skaerm(p); }
    return {
      tilstand: tilstand, aar: H.aar, skift: !!H.skift, regn: !!H.regn, kurv: H.kurv.length, sagt: H.sagt, niveau: H.niveau, spillere: spillere,
      stemme: stemme.stemme(), klip: stemme.antalKlip(), billeder: Object.keys(tekstur).length,
      bede: H.bede.map(function (bd) { var q = s([bd.x, BED_H, bd.z]); return { afgr: bd.afgr, fase: bd.fase, vaekst: +bd.vaekst.toFixed(2), antal: bd.antal, toerst: !!bd.toerst, sx: q && q.x, sy: q && q.y }; }),
      knapper: knapper.map(function (k) { return { x: k.x, y: k.y, r: k.r, spiller: k.spiller, hvad: k.hvad }; }), ur: uret, boble: boble,
      bedKasser: H.bede.map(bedKasse), pelle: pelleKasse(),
      oenske: H.oenske ? H.oenske.dele.map(function (d) { return { afgr: d.afgr, kat: d.kat, antal: d.antal, faaet: d.faaet }; }) : null,
      pelleFaaet: H.pelleFaaet.length, oenskerFaaet: H.oenskerFaaet,
      kanin: { fase: H.kanin.fase, s: dyr.kanin ? s([dyr.kanin.x, dyr.kanin.y + dyr.kanin.dy + dyr.kanin.h * 0.5, dyr.kanin.z]) : null },
      fugl: { fase: H.fugl.fase, s: dyr.fugl ? s([dyr.fugl.x, dyr.fugl.y + dyr.fugl.dy + dyr.fugl.h * 0.5, dyr.fugl.z]) : null },
      aebler: dyr.aebler ? dyr.aebler.filter(function (u) { return u.alfa > 0; }).map(function (u) { return s([u.x, u.y + 1, u.z]); }) : []
    };
  };
})();
