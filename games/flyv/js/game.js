/**
 * Himmelvejen: Sanne flyver breve ud paa Noeddeskovens oe.
 *
 * Stedsans: stemmen siger, hvilket sted brevet skal til. Stjernerne
 * bestemmer hjaelpen: én stjerne giver en pil og et kort, hvor maalet
 * lyser, to stjerner kun kortet, tre stjerner ingen hjaelp.
 * Ord for placering: paa stedet sidder tre ens dyr, og kun det, der sidder
 * dér, hvor stemmen siger (oven paa, inde i, mellem), skal have brevet.
 * Barnet trykker paa det dyr, det mener, og Sanne flyver selv derhen. Et
 * forkert dyr siger selv, hvor det sidder. Undervejs: under broen, og til
 * sidst rundt om det store trae.
 *
 * 3D med en lille WebGL 1-tegner skrevet til formaalet, uden biblioteker,
 * saa det virker paa gamle iPads. Landskabet er former i appens palet, og
 * figurerne er de malede billeder fra de andre spil, sat op som udklip.
 * Oeen og brevene ligger i oe.js, flyvningen i flyvning.js.
 */
(function () {
  'use strict';

  var Oe = window.FlyvOe, Fl = window.Flyvning;
  var sub = Oe.sub, cross = Oe.cross, norm = Oe.norm, dot = Oe.dot, mix = Oe.mix, klem = Oe.klem, jaevn = Oe.jaevn;
  var tilfaeldig = Oe.tilfaeldig, stoej = Oe.stoej, hex = Oe.hex, blend = Oe.blend, P = Oe.P;
  var STED = Oe.STED, ALLE = Oe.ALLE, BRO = Oe.BRO, TRAE = Oe.TRAE, BAKKE = Oe.BAKKE;
  var hoejde = Oe.hoejde, jordFarve = Oe.jordFarve, flodAfstand = Oe.flodAfstand, ORDENE = Oe.ORDENE;
  var mitte = Fl.mitte;

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
    overlay.innerHTML = '<div class="kort"><h2>Himmelvejen</h2><p>Denne iPad kan ikke vise 3D.</p></div>';
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

  /* Landskabet: et gitter paa 160 x 160 felter over 560 x 560. */
  function lavLandskab() {
    var N = 160, S = 560, trin = S / N, F = new Former();
    for (var j = 0; j <= N; j++) for (var i = 0; i <= N; i++) {
      var x = -S / 2 + i * trin, z = -S / 2 + j * trin, h = hoejde(x, z);
      var n = norm([hoejde(x - 1, z) - hoejde(x + 1, z), 2, hoejde(x, z - 1) - hoejde(x, z + 1)]);
      F.punkt([x, h, z], n, jordFarve(x, z, h, 1 - n[1]));
    }
    for (j = 0; j < N; j++) for (i = 0; i < N; i++) {
      var a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1;
      F.i.push(a, c, b, b, c, d);
    }
    return F.faerdig();
  }
  function lavVand() {
    var F = new Former(), S = 1600;
    F.firkant([-S, 0, -S], [S, 0, -S], [S, 0, S], [-S, 0, S], P.vand, [0, 1, 0]);
    return F.faerdig();
  }
  /* Det faa, der er bygget i 3D: broen over floden, maalene paa Boldbanen, taarnet ved Stjerneuret. */
  function lavBygninger() {
    var F = new Former(), s = STED.boldbanen, g = s.h;
    [-1, 1].forEach(function (side) {
      var x = s.x + side * 27;
      F.kasse(x, g + 2.6, s.z - 5, 0.7, 5.2, 0.7, P.hvid); F.kasse(x, g + 2.6, s.z + 5, 0.7, 5.2, 0.7, P.hvid);
      F.kasse(x, g + 5.2, s.z, 0.7, 0.7, 10.7, P.hvid);
    });
    var L = 0.09;
    F.kasse(s.x, g + L, s.z - 17, 54, 0.12, 0.6, P.hvid); F.kasse(s.x, g + L, s.z + 17, 54, 0.12, 0.6, P.hvid);
    F.kasse(s.x - 27, g + L, s.z, 0.6, 0.12, 34, P.hvid); F.kasse(s.x + 27, g + L, s.z, 0.6, 0.12, 34, P.hvid);
    F.kasse(s.x, g + L, s.z, 0.6, 0.12, 34, P.hvid);
    s = STED.stjerneuret; g = s.h;
    F.kasse(s.x, g + 12, s.z, 8, 24, 8, P.mur);
    F.kasse(s.x, g + 24.4, s.z, 9.4, 1.2, 9.4, hex('#d9ba8a'));
    for (var k = 0; k < 3; k++) F.kasse(s.x, g + 5 + k * 7, s.z, 8.3, 0.8, 8.3, hex('#d9ba8a'));
    /* Broen: et daek af planker, et gelaender og en pille i hver ende. Under den er der plads til Sanne. */
    var traeLys = hex('#b18a56'), traeMoerk = hex('#8a663d'), b = BRO.x1 - BRO.x0;
    F.kasse(0, BRO.y - 0.7, BRO.z, b + 2, 1.4, 8, traeLys);
    for (var p = 0; p < 11; p++) F.kasse(BRO.x0 + 1 + p * (b - 2) / 10, BRO.y + 0.04, BRO.z, 0.25, 0.1, 8.02, traeMoerk);
    [-1, 1].forEach(function (side) {
      var zz = BRO.z + side * 3.7;
      F.kasse(0, BRO.y + 2.1, zz, b + 2, 0.45, 0.45, traeMoerk);
      for (var q = 0; q <= 8; q++) F.kasse(BRO.x0 + q * b / 8, BRO.y + 1.05, zz, 0.45, 2.1, 0.45, traeMoerk);
      var px = side * (BRO.x1 + 0.5), bund = Math.min(hoejde(px, BRO.z), BRO.y - 3) - 2;
      F.kasse(px, (bund + BRO.y - 1.4) / 2, BRO.z, 3, BRO.y - 1.4 - bund, 8.4, traeMoerk);
    });
    return F.faerdig();
  }


  /* Skaden: krop, hoved, naeb og hale i én form, vingerne for sig, saa de kan slaa. */
  var SORT = hex('#2b2a33'), HVID = hex('#f1ece2'), VINGEBLAA = hex('#2f4566'), HALE = hex('#27464f'), NAEB = hex('#4a4239');
  function lavKrop() {
    var F = new Former();
    F.ellipsoide(0, 0, 0, 1.5, 1.35, 3.0, function (ux, uy, uz) {
      if (uy < -0.25 && uz < 0.6) return HVID;
      if (uy > 0.0 && Math.abs(ux) > 0.62 && uz > -0.5 && uz < 0.5) return HVID;
      return SORT;
    }, 16, 12);
    F.ellipsoide(0, 0.55, 3.25, 1.12, 1.08, 1.2, function () { return SORT; }, 12, 9);
    var b = 0.34, zb = 4.25, y0 = 0.42, spids = [0, 0.32, 5.7];
    F.trekant([-b, y0 + b, zb], [b, y0 + b, zb], spids, NAEB);
    F.trekant([b, y0 + b, zb], [b, y0 - b, zb], spids, NAEB);
    F.trekant([b, y0 - b, zb], [-b, y0 - b, zb], spids, NAEB);
    F.trekant([-b, y0 - b, zb], [-b, y0 + b, zb], spids, NAEB);
    var hale = [[0.55, 0.1, -2.3], [0.8, 0.22, -5.8], [0.5, 0.3, -9.4]], op = [0, 1, 0];
    for (var i = 0; i < 2; i++) {
      var a = hale[i], c = hale[i + 1];
      F.firkant([-a[0], a[1], a[2]], [a[0], a[1], a[2]], [c[0], c[1], c[2]], [-c[0], c[1], c[2]], HALE, op);
    }
    return F.faerdig();
  }
  function lavVinge(side) {
    var F = new Former(), s = side, op = [0, 1, 0];
    var rod = [[0, 0, 1.1], [0, 0, -1.3]], mid = [[3.0 * s, 0.25, 0.95], [3.0 * s, 0.15, -1.8]];
    var ude = [[5.4 * s, 0.25, 0.45], [5.6 * s, 0.05, -2.1]], spids = [7.2 * s, 0.1, -1.1];
    F.firkant(rod[0], mid[0], mid[1], rod[1], VINGEBLAA, op);
    F.firkant(mid[0], ude[0], ude[1], mid[1], HVID, op);
    F.trekant(ude[0], spids, ude[1], SORT, op);
    return F.faerdig();
  }

  /* ---------- billeder til udklip ---------- */
  /* De malede figurer laanes fra de andre spil, saa der ikke kommer nye billeder til */
  var BILLEDER = {
    trae: '../maskinen/billeder/trae.png', gran: '../maskinen/billeder/gran.png', pindsvin: '../maskinen/billeder/pindsvin.png',
    raev: '../maskinen/billeder/raev.png', bjoern: '../maskinen/billeder/bjoern.png', ugle: '../maskinen/billeder/ugle.png',
    kanin: '../maskinen/billeder/kanin.png', klokke: '../maskinen/billeder/klokke.png', aeble: '../maskinen/billeder/aeble.png',
    hus1: '../find/billeder/hus1.png', hus2: '../find/billeder/hus2.png', hus3: '../find/billeder/hus3.png',
    bod: '../find/billeder/bod.png', broend: '../find/billeder/broend.png', baenk: '../find/billeder/baenk.png',
    bil: '../../assets/malet/bil.png', hus: '../../assets/malet/hus.png', rummus: '../../assets/malet/rummus.png',
    bold: '../../assets/malet/bold.png', klatRoed: '../klatbold/billeder/klat-roed.png', klatBlaa: '../klatbold/billeder/klat-blaa.png',
    dreng: '../bobler/billeder/dreng.png', pige: '../bobler/billeder/pige.png', gris: '../restaurant/billeder/gris.png',
    pandekager: '../restaurant/billeder/pandekager.png', robot: '../bogstaver/billeder/robot.png'
  };
  var STORE = { trae: 1, gran: 1, hus1: 1, hus2: 1, hus3: 1, hus: 1, bod: 1 };
  var billede = {}, tekstur = {}, forhold = {};

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
  var KANT = '#5e4a3a', SKRIFT = '800 %spx ui-rounded, "SF Pro Rounded", system-ui, sans-serif';
  function skrift(px) { return SKRIFT.replace('%s', px); }

  function lavKodeTeksturer() {
    ['N', 'P', 'S'].forEach(function (bogstav, i) {
      var farver = ['#d9ba8a', '#aed3e4', '#f0c46a'];
      kodeTekstur('skilt' + bogstav, 256, 256, function (c, b, h) {
        c.fillStyle = '#8a663d'; c.fillRect(b / 2 - 8, 110, 16, 146);
        rr(c, 36, 20, b - 72, 110, 18); c.fillStyle = farver[i]; c.fill(); c.lineWidth = 6; c.strokeStyle = KANT; c.stroke();
        c.fillStyle = KANT; c.font = skrift(84); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(bogstav, b / 2, 78);
      });
    });
    kodeTekstur('hule', 512, 384, function (c, b, h) {
      c.fillStyle = '#8a8377';
      c.beginPath(); c.moveTo(0, h); c.quadraticCurveTo(10, 60, b / 2, 30); c.quadraticCurveTo(b - 10, 60, b, h); c.closePath(); c.fill();
      var g = c.createRadialGradient(b / 2, h, 10, b / 2, h, 260); g.addColorStop(0, '#1f1a16'); g.addColorStop(1, '#4a3a2c');
      c.fillStyle = g; c.beginPath(); c.moveTo(90, h); c.quadraticCurveTo(100, 110, b / 2, 100); c.quadraticCurveTo(b - 100, 110, b - 90, h); c.closePath(); c.fill();
      c.fillStyle = 'rgba(240,196,106,.35)'; c.beginPath(); c.ellipse(b / 2, h - 30, 70, 40, 0, 0, 7); c.fill();
      c.fillStyle = '#b8b2a4'; [[40, h - 20, 34], [470, h - 26, 40], [120, h - 10, 20], [400, h - 8, 22]].forEach(function (s) { c.beginPath(); c.ellipse(s[0], s[1], s[2], s[2] * 0.7, 0, 0, 7); c.fill(); });
    });
    kodeTekstur('ur', 256, 256, function (c, b) {
      var r = 104, m = b / 2;
      c.fillStyle = 'rgba(240,196,106,.35)'; c.beginPath(); c.arc(m, m, 126, 0, 7); c.fill();
      c.fillStyle = '#f3e9d8'; c.beginPath(); c.arc(m, m, r, 0, 7); c.fill(); c.lineWidth = 14; c.strokeStyle = '#f0c46a'; c.stroke();
      c.lineWidth = 3; c.strokeStyle = KANT; c.stroke();
      for (var t = 0; t < 12; t++) { var v = t * Math.PI / 6; c.fillStyle = KANT; c.beginPath(); c.arc(m + Math.cos(v) * 84, m + Math.sin(v) * 84, t % 3 ? 4 : 7, 0, 7); c.fill(); }
      c.strokeStyle = KANT; c.lineCap = 'round'; c.lineWidth = 11;
      var vt = Math.PI * 7 / 6 - Math.PI / 2; c.beginPath(); c.moveTo(m, m); c.lineTo(m + Math.cos(vt) * 52, m + Math.sin(vt) * 52); c.stroke();
      c.lineWidth = 7; c.beginPath(); c.moveTo(m, m); c.lineTo(m, m - 76); c.stroke();
      c.fillStyle = KANT; c.beginPath(); c.arc(m, m, 9, 0, 7); c.fill();
    });
    kodeTekstur('staffeli', 256, 384, function (c, b, h) {
      c.strokeStyle = '#8a663d'; c.lineCap = 'round'; c.lineWidth = 12;
      c.beginPath(); c.moveTo(60, h - 6); c.lineTo(100, 40); c.moveTo(b - 60, h - 6); c.lineTo(b - 100, 40); c.moveTo(b / 2, h - 6); c.lineTo(b / 2, 250); c.stroke();
      rr(c, 30, 40, b - 60, 220, 10); c.fillStyle = '#f8f1e6'; c.fill(); c.lineWidth = 5; c.strokeStyle = KANT; c.stroke();
      c.save(); c.translate(b / 2, 150); c.rotate(0.5);
      c.strokeStyle = '#6a4a2c'; c.lineWidth = 26; c.beginPath(); c.moveTo(0, -30); c.lineTo(0, 80); c.stroke();
      c.strokeStyle = '#a5683a'; c.lineWidth = 18; c.stroke();
      c.fillStyle = '#b6b9bd'; c.strokeStyle = '#4f5559'; c.lineWidth = 5;
      c.beginPath(); c.arc(0, -46, 34, -Math.PI / 2 + 0.36, Math.PI * 1.5 - 0.36); c.lineTo(-12, -46 - 34 + 34); c.lineTo(12, -46); c.closePath(); c.fill(); c.stroke();
      c.restore();
      c.strokeStyle = '#d95f45'; c.lineWidth = 5; c.beginPath(); c.arc(b / 2, 150, 92, 0, 7); c.stroke();
    });
    ['#7ab648', '#3f9ad6', '#f2c14e', '#ef94b8', '#9b7bd4'].forEach(function (f, i) {
      kodeTekstur('boble' + i, 128, 128, function (c, b) {
        var g = c.createRadialGradient(44, 42, 6, 64, 64, 60); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.3, f); g.addColorStop(1, f);
        c.globalAlpha = 0.78; c.fillStyle = g; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill();
        c.globalAlpha = 1; c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 4; c.stroke();
      });
    });
    kodeTekstur('sky', 256, 128, function (c) {
      c.fillStyle = 'rgba(255,255,255,.92)';
      [[70, 80, 42], [120, 58, 54], [178, 76, 44], [140, 92, 40], [92, 96, 34]].forEach(function (s) { c.beginPath(); c.arc(s[0], s[1], s[2], 0, 7); c.fill(); });
    });
    kodeTekstur('sol', 256, 256, function (c) {
      var g = c.createRadialGradient(128, 128, 20, 128, 128, 128); g.addColorStop(0, 'rgba(252,236,180,1)'); g.addColorStop(0.35, 'rgba(247,214,130,.95)'); g.addColorStop(0.4, 'rgba(247,214,130,.35)'); g.addColorStop(1, 'rgba(247,214,130,0)');
      c.fillStyle = g; c.fillRect(0, 0, 256, 256);
    });
    kodeTekstur('gnist', 64, 64, function (c) {
      c.fillStyle = '#f0c46a'; c.beginPath();
      for (var j = 0; j < 10; j++) { var r = j % 2 ? 11 : 30, v = -Math.PI / 2 + j * Math.PI / 5; c.lineTo(32 + Math.cos(v) * r, 32 + Math.sin(v) * r); }
      c.closePath(); c.fill(); c.strokeStyle = 'rgba(94,74,58,.6)'; c.lineWidth = 2; c.stroke();
    });
    kodeTekstur('skygge', 64, 64, function (c) {
      var g = c.createRadialGradient(32, 32, 2, 32, 32, 32); g.addColorStop(0, 'rgba(60,48,38,.4)'); g.addColorStop(1, 'rgba(60,48,38,0)');
      c.fillStyle = g; c.fillRect(0, 0, 64, 64);
    });
    /* Klatterne faar ansigt paa, som i Boldbanen: billedet er uden ansigt, koden tegner det */
    ['klatRoed', 'klatBlaa'].forEach(function (n, i) {
      var img = billede[n], rigtigtForhold = forhold[n];
      kodeTekstur(n, 256, 256, function (c, b, h) {
        c.drawImage(img, 0, 0, b, h);
        var ox = b * (0.5 + (i ? -0.08 : 0.08)), oy = h * 0.46;
        [-1, 1].forEach(function (d) {
          c.fillStyle = '#fff'; c.beginPath(); c.arc(ox + d * 22, oy, 15, 0, 7); c.fill();
          c.fillStyle = KANT; c.beginPath(); c.arc(ox + d * 22 + (i ? -4 : 4), oy + 2, 7.5, 0, 7); c.fill();
        });
        c.strokeStyle = KANT; c.lineWidth = 5; c.lineCap = 'round'; c.beginPath(); c.arc(ox, oy + 22, 14, 0.2, Math.PI - 0.2); c.stroke();
      });
      forhold[n] = rigtigtForhold;
    });
    /* Glorien under dyrene, naar man leder, og brevet i Sannes naeb */
    kodeTekstur('glod', 128, 128, function (c) {
      var g = c.createRadialGradient(64, 64, 10, 64, 64, 63);
      g.addColorStop(0, 'rgba(252,236,180,.05)'); g.addColorStop(0.55, 'rgba(240,196,106,.6)'); g.addColorStop(0.72, 'rgba(240,196,106,.4)'); g.addColorStop(1, 'rgba(240,196,106,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128);
    });
    kodeTekstur('brev', 128, 128, function (c) {
      c.save(); c.translate(64, 64); c.rotate(-0.12);
      rr(c, -52, -34, 104, 68, 8); c.fillStyle = '#f8f1e6'; c.fill(); c.lineWidth = 5; c.strokeStyle = KANT; c.stroke();
      c.lineJoin = 'round'; c.beginPath(); c.moveTo(-49, -30); c.lineTo(0, 6); c.lineTo(49, -30); c.stroke();
      c.fillStyle = '#d95f45'; c.beginPath(); c.arc(0, 6, 9, 0, 7); c.fill();
      c.restore();
    });
  }

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


  /* ---------- udklippene i verden ---------- */
  var udklip = [];    // { tx, x, y, z, h, b, alfa, taet, flad, hoejre, op, hop, opdater, foran }
  function udklipAf(u) {
    u.b = u.h * (forhold[u.tx] || 1); u.alfa = 1; u.taet = null; u.hop = 0; u.dy = u.dy || 0;
    udklip.push(u); return u;
  }
  function staa(tx, x, z, h, ekstra) {
    var u = { tx: tx, x: x, y: hoejde(x, z) - 0.4, z: z, h: h };
    for (var k in ekstra) u[k] = ekstra[k];
    return udklipAf(u);
  }

  var steder = Oe.lavSteder(), F = null;
  function byggVerden() {
    var r = tilfaeldig(7), s;
    /* Stederne i brevene: pynten og dyrene, som flyvningen ogsaa kender */
    steder.pynt.forEach(udklipAf);
    Object.keys(steder.dyr).forEach(function (k) { steder.dyr[k].forEach(udklipAf); });
    staa('klokke', 9, 12, 4.5); staa('aeble', -8, 12, 3.4);

    /* De andre steder: deres figurer som pynt */
    var sb = STED.susebanen;
    staa('raev', sb.x - 42, sb.z - 2, 10);
    var bil = staa('bil', sb.x + 34, sb.z, 7.6, { flad: true });
    bil.opdater = function (t) {
      var v = t * 0.55, x = sb.x + Math.cos(v) * 34, z = sb.z + Math.sin(v) * 22;
      var fx = -Math.sin(v) * 34, fz = Math.cos(v) * 22, l = Math.sqrt(fx * fx + fz * fz); fx /= l; fz /= l;
      bil.op = [fx, 0, fz]; bil.hoejre = [fz, 0, -fx];
      bil.x = x - fx * 3.8; bil.z = z - fz * 3.8; bil.y = sb.h + 0.35; bil.b = 4.9;
    };
    var bb = STED.boldbanen;
    staa('klatRoed', bb.x - 8, bb.z + 2, 7.5); staa('klatBlaa', bb.x + 9, bb.z - 3, 7);
    var bold = staa('bold', bb.x, bb.z + 4, 3.2);
    bold.opdater = function (t) { bold.x = bb.x + Math.sin(t * 0.9) * 8; bold.dy = 1 + Math.abs(Math.sin(t * 2.4)) * 7; };
    s = STED.boblehavet;
    var ud = s.ud, tv = [-ud[1], ud[0]];
    staa('dreng', s.x - tv[0] * 5, s.z - tv[1] * 5, 8.5); staa('pige', s.x + tv[0] * 5, s.z + tv[1] * 5, 9.5);
    for (var i = 0; i < 10; i++) {
      (function (i) {
        var afst = 18 + r() * 30, sid = (r() - 0.5) * 50, fase = r() * 40, fart = 2.5 + r() * 2, str = 3.5 + r() * 4;
        var bx = s.x + ud[0] * afst + tv[0] * sid, bz = s.z + ud[1] * afst + tv[1] * sid;
        var b = staa('boble' + (i % 5), bx, bz, str);
        b.opdater = function (t) { var y = (t * fart + fase) % 42; b.y = y; b.alfa = klem((42 - y) / 10, 0, 1) * klem(y / 3, 0, 1); };
      })(i);
    }
    s = STED.tegnestuen;
    staa('staffeli', s.x + 4, s.z, 14); staa('robot', s.x - 6, s.z + 2, 10);
    var su = STED.stjerneuret;
    var ur = staa('ur', su.x, su.z, 13); ur.y = su.h + 25;
    var mus = staa('rummus', su.x + 9, su.z, 10);
    mus.opdater = function (t) { mus.x = su.x + Math.cos(t * 0.5) * 11; mus.z = su.z + Math.sin(t * 0.5) * 11; mus.y = su.h + 26 + Math.sin(t * 1.3) * 2; };
    s = STED.skovkoekkenet;
    staa('hus', s.x, s.z - 11, 24); staa('gris', s.x - 9, s.z + 3, 6.5);
    staa('baenk', s.x + 9, s.z + 6, 5.5); var pk = staa('pandekager', s.x + 9, s.z + 6.4, 3.6); pk.y += 3.2;

    /* Skov: tæt ring om Noeddeskoven og pletter rundt paa oeen, men aldrig ind over stederne eller floden */
    var n = 0;
    for (var k = 0; k < 4000 && n < 270; k++) {
      var x = (r() - 0.5) * 470, z = (r() - 0.5) * 470, h = hoejde(x, z), dn = Math.sqrt(x * x + z * z);
      if (h < 3.2) continue;
      var ring = dn > 21 && dn < 64 && r() < 0.6, plet = stoej(x * 0.018 + 3, z * 0.018 + 9) > 0.58;
      if (!ring && !plet) continue;
      var fri = flodAfstand(x, z) > 24 && Math.hypot(x - TRAE.x, z - TRAE.z) > 24;
      for (var j = 1; j < ALLE.length && fri; j++) { if (Math.hypot(x - ALLE[j].x, z - ALLE[j].z) < ALLE[j].flad + 10) fri = false; }
      if (Math.hypot(x - BAKKE.x, z - BAKKE.z) < 22) fri = false;
      if (!fri) continue;
      staa(r() < 0.58 ? 'trae' : 'gran', x, z, 11 + r() * 7); n++;
    }
    /* Himlen */
    for (i = 0; i < 16; i++) {
      var v = r() * Math.PI * 2, afs = 120 + r() * 420, sky = staa('sky', Math.sin(v) * afs, Math.cos(v) * afs, 22 + r() * 16);
      sky.y = 88 + r() * 40; sky.taet = 0.0007;
    }
    var sol = staa('sol', 700, -900, 260); sol.y = 260; sol.taet = 0;
  }

  /* ---------- lyd ---------- */
  var lyd = null, vind = null, lydTil = true;
  function startLyd() {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    if (!lyd) {
      lyd = new AC();
      var n = lyd.sampleRate * 2, buf = lyd.createBuffer(1, n, lyd.sampleRate), d = buf.getChannelData(0), s = 0;
      for (var i = 0; i < n; i++) { s = s * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = s * 3.2; }
      var kilde = lyd.createBufferSource(); kilde.buffer = buf; kilde.loop = true;
      var lp = lyd.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520;
      vind = lyd.createGain(); vind.gain.value = 0;
      kilde.connect(lp); lp.connect(vind); vind.connect(lyd.destination); kilde.start(0);
    }
    if (lyd.state !== 'running') lyd.resume();
  }
  function tone(fr, l, st, forsink) {
    if (!lyd || !lydTil) return;
    var t0 = lyd.currentTime + (forsink || 0), o = lyd.createOscillator(), g = lyd.createGain();
    o.type = 'triangle'; o.frequency.value = fr;
    g.gain.setValueAtTime(st || 0.1, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + l);
    o.connect(g); g.connect(lyd.destination); o.start(t0); o.stop(t0 + l + 0.05);
  }
  function melodi(toner, mellem) { toner.forEach(function (f, i) { tone(f, 0.22, 0.09, i * mellem); }); }
  var LYDE = {
    valgt: function () { tone(784, 0.12, 0.06); },
    forkert: function () { tone(330, 0.2, 0.07); },
    rigtig: function () { melodi([523, 659, 784, 1047], 110); },
    bro: function () { melodi([659, 784, 988, 1319], 90); },
    slut: function () { melodi([523, 659, 784, 1047, 1319], 120); }
  };

  /* Stemmen: enhedens egen danske stemme, og kun en, der ligger paa enheden, saa intet gaar
     over nettet. Naar Camillas klip er lavet, afspilles de i stedet. */
  var stemme = null, taleNr = 0;
  function findStemme() {
    try {
      stemme = window.speechSynthesis.getVoices().filter(function (s) { return /^da/i.test(s.lang) && s.localService; })[0] || null;
    } catch (e) { stemme = null; }
  }
  if (window.speechSynthesis) { findStemme(); window.speechSynthesis.onvoiceschanged = findStemme; }
  function sig(tekst) {
    var nr = ++taleNr;
    if (!lydTil || !window.speechSynthesis || !stemme) return;
    try {
      window.speechSynthesis.cancel();
      var u = new SpeechSynthesisUtterance(tekst);
      u.voice = stemme; u.lang = stemme.lang; u.rate = 0.88; u.pitch = 1.05;
      u.onend = function () { if (nr === taleNr && F) F.taleFaerdig(); };
      window.speechSynthesis.speak(u);
    } catch (e) { /* stemmen er pynt; boblen viser, hvem brevet er til */ }
  }
  function tie() { taleNr++; try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch (e) { /* intet */ } }

  /* ---------- spillet ---------- */
  var tilstand = 'menu', tid = 0, svaerhed = 0;
  var kam = { pos: [0, 90, -200], maal: [0, 10, 0] };
  var gnister = [], fingre = {}, fingerOrden = [], taster = {}, hjaelpTil = 0;
  var fugl, bud, klaret, bro;
  var krop, vingeV, vingeH, landskab, vand, bygninger;

  F = Fl.ny(steder.dyr, {
    sig: sig,
    lyd: function (n) { if (LYDE[n]) LYDE[n](); },
    gnist: function (x, y, z, antal) {
      for (var i = 0; i < antal; i++) {
        var v = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, f = 7 + Math.random() * 9;
        gnister.push({ x: x, y: y, z: z, vx: Math.cos(v) * f * Math.sqrt(1 - u * u), vy: u * f + 4, vz: Math.sin(v) * f * Math.sqrt(1 - u * u), liv: 1.1 + Math.random() * 0.5, str: 1.4 + Math.random() * 1.4 });
      }
    },
    hop: function (m) { m.hop = 1; }
  });
  fugl = F.fugl;

  function nyTur() {
    gnister = []; hjaelpTil = 6;
    F.nulstil(svaerhed + 1);
    bud = F.bud; klaret = F.klaret; bro = F.bro;
    kam.pos = [fugl.x - Math.sin(fugl.h) * 34, fugl.y + 13, fugl.z - Math.cos(fugl.h) * 34];
    kam.maal = [fugl.x, fugl.y, fugl.z];
  }

  /* Pegestyring: hvor fingeren er i forhold til midten. Til siden drejer, op og ned stiger og dykker. */
  function doed(v, d) { var a = Math.abs(v); return a < d ? 0 : Math.sign(v) * (a - d) / (1 - d); }
  function styring() {
    if (window.__styr) return window.__styr;   // kun til afproevning
    var drej = 0, stig = null, id = fingerOrden[fingerOrden.length - 1], f = id !== undefined ? fingre[id] : null;
    if (f) {
      var W = window.innerWidth, H = window.innerHeight;
      drej = klem(doed((f.x - W / 2) / (W / 2), 0.12) * 1.4, -1, 1);
      stig = klem(-doed((f.y - H * 0.52) / (H / 2), 0.16) * 1.5, -1, 1);
    }
    if (taster.v) drej -= 1; if (taster.h) drej += 1;
    if (taster.o || taster.n) stig = (taster.o ? 1 : 0) - (taster.n ? 1 : 0);
    return { drej: klem(drej, -1, 1), stig: stig };
  }

  function opdater(dt) {
    tid += dt;
    udklip.forEach(function (u) { if (u.opdater) u.opdater(tid); if (u.hop > 0) u.hop = Math.max(0, u.hop - dt * 1.4); });
    if (tilstand !== 'flyv') {
      var v = tid * 0.05;
      kam.pos = [Math.sin(v) * 270, 105, Math.cos(v) * 270]; kam.maal = [0, 8, 0];
      return;
    }
    hjaelpTil = Math.max(0, hjaelpTil - dt);
    F.skridt(dt, styring());
    gnister.forEach(function (g) { g.x += g.vx * dt; g.y += g.vy * dt; g.z += g.vz * dt; g.vy -= 9 * dt; g.liv -= dt; });
    gnister = gnister.filter(function (g) { return g.liv > 0; });
    if (F.slut) { visSlut(); return; }

    /* Kameraet foelger selv efter; barnet styrer aldrig kameraet */
    var fx = Math.sin(fugl.h), fz = Math.cos(fugl.h), gulv = Math.max(hoejde(fugl.x, fugl.z), 0) + 3.2;
    var op = 5 + 8 * klem((fugl.y - gulv) / 14, 0, 1);
    var oensket = [fugl.x - fx * 34, fugl.y + op, fugl.z - fz * 34];
    oensket[1] = Math.max(oensket[1], Math.max(hoejde(oensket[0], oensket[2]), 0) + 2.5);
    if (fugl.y < BRO.y - 1 && Math.abs(fugl.x) < 24 && Math.abs(fugl.z - BRO.z) < 40) oensket[1] = Math.min(oensket[1], BRO.y - 2.2);
    var k = 1 - Math.exp(-dt * 3.5);
    for (var a = 0; a < 3; a++) kam.pos[a] = mix(kam.pos[a], oensket[a], k);
    var mo = [fugl.x + fx * 24, fugl.y - 1, fugl.z + fz * 24];
    if (bud.fase === 'rundt') {   // rundt om traeet: kameraet kigger lidt ind mod traeet, saa det ikke forsvinder ud til siden
      var mt = [TRAE.x, TRAE.h * 0.45, TRAE.z];
      for (a = 0; a < 3; a++) mo[a] = mix(mo[a], mt[a], 0.35);
    }
    for (a = 0; a < 3; a++) kam.maal[a] = mix(kam.maal[a], mo[a], 1 - Math.exp(-dt * 6));

    if (vind) vind.gain.value = lydTil ? mix(vind.gain.value, 0.035 + Math.abs(fugl.drej) * 0.03, 0.05) : 0;
  }

  /* ---------- tegning ---------- */
  var SOL = norm([0.45, 0.8, -0.35]), TAET = 0.0021;
  var vp = null, kamHoejre = [1, 0, 0];

  function bindForm(m) {
    gl.bindBuffer(gl.ARRAY_BUFFER, m.p); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.n); gl.vertexAttribPointer(1, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.f); gl.vertexAttribPointer(2, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, m.i);
  }
  function tegnForm(m, model, tone, erVand) {
    bindForm(m);
    gl.uniformMatrix4fv(LYS.u.m, false, model);
    gl.uniform4fv(LYS.u.tone, tone || [1, 1, 1, 0]);
    gl.uniform1f(LYS.u.vand, erVand ? 1 : 0);
    gl.drawElements(gl.TRIANGLES, m.antal, gl.UNSIGNED_SHORT, 0);
  }

  function tegn() {
    var W = cv.width, H = cv.height;
    gl.viewport(0, 0, W, H);
    gl.clearColor(P.horisont[0], P.horisont[1], P.horisont[2], 1);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    var asp = W / H, fov = (asp < 1 ? 74 : 58) * Math.PI / 180;
    var proj = M.persp(fov, asp, 0.8, 1600), kig = M.kig(kam.pos, kam.maal, [0, 1, 0]);
    vp = M.gange(proj, kig.m); kamHoejre = kig.hoejre;

    /* Himlen: horisonten der, hvor et vandret blik rammer skaermen */
    var fr = norm(sub(kam.maal, kam.pos)), vf = norm([fr[0], 0, fr[2]]);
    var hp = [kam.pos[0] + vf[0] * 1000, kam.pos[1], kam.pos[2] + vf[2] * 1000], c = projicer(hp);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false);
    gl.useProgram(HIMMEL.p);
    gl.bindBuffer(gl.ARRAY_BUFFER, SKAERM); gl.enableVertexAttribArray(0); gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, HJ_IDX);
    gl.uniform1f(HIMMEL.u.hor, c ? klem(c.ny * 0.5 + 0.5, -0.5, 1.5) : 0.5);
    gl.uniform3fv(HIMMEL.u.top, P.himmelTop); gl.uniform3fv(HIMMEL.u.bund, P.horisont);
    gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);

    /* Faste former */
    gl.enable(gl.DEPTH_TEST); gl.depthMask(true); gl.disable(gl.BLEND);
    gl.useProgram(LYS.p);
    gl.enableVertexAttribArray(0); gl.enableVertexAttribArray(1); gl.enableVertexAttribArray(2);
    gl.uniformMatrix4fv(LYS.u.vp, false, vp);
    gl.uniform3fv(LYS.u.sol, SOL); gl.uniform3fv(LYS.u.taage, P.horisont); gl.uniform3fv(LYS.u.kam, kam.pos);
    gl.uniform1f(LYS.u.taet, TAET); gl.uniform1f(LYS.u.tid, tid);
    var id = M.en();
    tegnForm(landskab, id); tegnForm(vand, id, null, true); tegnForm(bygninger, id);

    if (tilstand !== 'menu') {
      var klap = F.spilTid * 7.5, fald = 0.22 + 0.26 * Math.max(0, Math.sin(F.spilTid * 0.9));
      var slag = 0.08 + Math.sin(klap) * fald, pitch = -fugl.vy * 0.035;
      var fm = kaede(M.flyt(fugl.x, fugl.y, fugl.z), M.rotY(fugl.h), M.rotZ(fugl.bank), M.rotX(pitch), M.skala(0.95));
      tegnForm(krop, fm);
      tegnForm(vingeV, kaede(fm, M.flyt(1.1, 0.35, 0.4), M.rotZ(slag)));
      tegnForm(vingeH, kaede(fm, M.flyt(-1.1, 0.35, 0.4), M.rotZ(-slag)));
    }

    /* Udklip: bagfra og frem, blødt blandet ind */
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    gl.useProgram(UDKLIP.p);
    gl.disableVertexAttribArray(1); gl.disableVertexAttribArray(2); gl.enableVertexAttribArray(0);
    gl.bindBuffer(gl.ARRAY_BUFFER, HJOERNER); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, HJ_IDX);
    gl.uniformMatrix4fv(UDKLIP.u.vp, false, vp);
    gl.uniform3fv(UDKLIP.u.taage, P.horisont); gl.uniform3fv(UDKLIP.u.kam, kam.pos);
    gl.activeTexture(gl.TEXTURE0); gl.uniform1i(UDKLIP.u.tx, 0);

    var liste = [];
    var kx = kam.pos[0], ky = kam.pos[1], kz = kam.pos[2];
    function afstand(x, y, z) { return (x - kx) * (x - kx) + (y - ky) * (y - ky) + (z - kz) * (z - kz); }
    udklip.forEach(function (u) {
      var d = (u.x - kx) * (u.x - kx) + (u.z - kz) * (u.z - kz);
      if (u.taet === null && d > 700 * 700) return;
      var dd = Math.sqrt(d + (u.y - ky) * (u.y - ky)) - (u.foran || 0);
      liste.push({ u: u, d: dd * Math.abs(dd) });
    });
    if (tilstand !== 'menu') {
      var gy = Math.max(hoejde(fugl.x, fugl.z), 0), sk = klem(9 - (fugl.y - gy) * 0.12, 3, 9);
      liste.push({ u: { tx: 'skygge', x: fugl.x, y: gy + 0.5, z: fugl.z - sk / 2, h: sk, b: sk, alfa: 1, flad: true, hoejre: [1, 0, 0], op: [0, 0, 1] }, d: 1e9 });
      if (F.baererBrev()) {
        var fx = Math.sin(fugl.h), fz = Math.cos(fugl.h), bx = fugl.x + fx * 6.1, bz = fugl.z + fz * 6.1, by = fugl.y - 1.5 + Math.sin(F.spilTid * 7.5) * 0.15;
        liste.push({ u: { tx: 'brev', x: bx, y: by, z: bz, h: 2.4, b: 2.4, alfa: 1 }, d: afstand(bx, by, bz) - 4 });
      }
      var b = F.detteBud();
      if (b && bud.fase === 'finde') steder.dyr[b.sted].forEach(function (m) {
        var u = m, s = (m === bud.valgt ? 13 : 10) + Math.sin(tid * 3) * 0.8;
        liste.push({ u: { tx: 'glod', x: u.x, y: u.y + 0.45, z: u.z - s / 2, h: s, b: s, alfa: m === bud.valgt ? 1 : 0.85, flad: true, hoejre: [1, 0, 0], op: [0, 0, 1] }, d: afstand(u.x, u.y, u.z) + 30 });
      });
    }
    gnister.forEach(function (g) {
      liste.push({ u: { tx: 'gnist', x: g.x, y: g.y - g.str / 2, z: g.z, h: g.str, b: g.str, alfa: klem(g.liv, 0, 1) }, d: afstand(g.x, g.y, g.z) });
    });
    liste.sort(function (a, b) { return b.d - a.d; });
    liste.forEach(function (e) {
      var u = e.u, t = tekstur[u.tx]; if (!t) return;
      gl.bindTexture(gl.TEXTURE_2D, t);
      var y = u.y + (u.dy || 0) + (u.hop ? Math.sin(u.hop * Math.PI) * 4 : 0);
      if (u.flad) { gl.uniform3fv(UDKLIP.u.hoejre, u.hoejre); gl.uniform3fv(UDKLIP.u.op, u.op); }
      else { gl.uniform3fv(UDKLIP.u.hoejre, u.fast || kamHoejre); gl.uniform3fv(UDKLIP.u.op, [0, 1, 0]); }
      gl.uniform3f(UDKLIP.u.pos, u.x, y, u.z);
      gl.uniform2f(UDKLIP.u.str, u.b, u.h);
      gl.uniform1f(UDKLIP.u.alfa, u.alfa);
      gl.uniform1f(UDKLIP.u.taet, u.taet === null || u.taet === undefined ? TAET : u.taet);
      gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
    });
    gl.depthMask(true); gl.disable(gl.BLEND);
  }

  function projicer(p) {
    if (!vp) return null;
    var x = vp[0] * p[0] + vp[4] * p[1] + vp[8] * p[2] + vp[12];
    var y = vp[1] * p[0] + vp[5] * p[1] + vp[9] * p[2] + vp[13];
    var w = vp[3] * p[0] + vp[7] * p[1] + vp[11] * p[2] + vp[15];
    return { nx: x / Math.abs(w || 1e-6), ny: y / Math.abs(w || 1e-6), bag: w <= 0 };
  }

  /* ---------- HUD: ordene, brevet, kortet, pilen ---------- */
  var hudSkala = 1, boble = null, kortBillede = null, VERDEN = 520;
  var IKON = { noeddeskoven: 'pindsvin', susebanen: 'raev', boblehavet: 'pige', boldbanen: 'klatRoed', bogstavvejen: 'ugle', rimhulen: 'bjoern', vrimleskoven: 'kanin', tegnestuen: 'robot', stjerneuret: 'rummus', skovkoekkenet: 'gris' };

  /* Oeen set oppefra, malet én gang. Nord (minus z) er opad, ligesom paa et kort. */
  function lavKort() {
    var N = 200, c = document.createElement('canvas'); c.width = c.height = N;
    var x2 = c.getContext('2d'), data = x2.createImageData(N, N), d = data.data, hav = hex('#8fc7e8');
    for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
      var x = (i + 0.5) / N * VERDEN - VERDEN / 2, z = (j + 0.5) / N * VERDEN - VERDEN / 2, h = hoejde(x, z);
      var f = h < 0.3 ? blend(hav, [1, 1, 1], klem(h + 2, 0, 1) * 0.25) : jordFarve(x, z, h, 0);
      if (h >= 0.3) f = blend(f, [1, 1, 1], klem((h - 12) / 30, 0, 0.3));
      var o = (j * N + i) * 4;
      d[o] = f[0] * 255; d[o + 1] = f[1] * 255; d[o + 2] = f[2] * 255; d[o + 3] = 255;
    }
    x2.putImageData(data, 0, 0);
    /* Broen og det store trae */
    var sk = N / VERDEN;
    x2.strokeStyle = '#8a663d'; x2.lineWidth = 3; x2.lineCap = 'round';
    x2.beginPath(); x2.moveTo((BRO.x0 + VERDEN / 2) * sk, (BRO.z + VERDEN / 2) * sk); x2.lineTo((BRO.x1 + VERDEN / 2) * sk, (BRO.z + VERDEN / 2) * sk); x2.stroke();
    kortBillede = c;
  }

  /* Billedord for placering: en kasse og en roed bold. Samme tegning i boblen og i raekken foroven. */
  function pikto(c, ord, x, y, s) {
    var k = s / 40;
    c.save(); c.translate(x, y); c.scale(k, k);
    c.lineWidth = 2.2; c.strokeStyle = KANT; c.lineJoin = 'round'; c.lineCap = 'round';
    function kasse(x0, y0, b, h) { c.fillStyle = '#d9ba8a'; c.beginPath(); c.rect(x0, y0, b, h); c.fill(); c.stroke(); }
    function bold(bx, by, r) { c.fillStyle = '#d95f45'; c.beginPath(); c.arc(bx, by, r || 5.5, 0, 7); c.fill(); c.stroke(); }
    if (ord === 'ovenpaa') { kasse(-12, -1, 24, 15); bold(0, -7); }
    else if (ord === 'indei') { kasse(-15, -12, 30, 26); c.fillStyle = '#6b5545'; c.beginPath(); c.rect(-9, -5, 18, 19); c.fill(); bold(0, 8, 5); }
    else if (ord === 'under') {
      c.fillStyle = '#b18a56'; c.beginPath(); c.rect(-17, -11, 34, 5); c.fill(); c.stroke();
      c.lineWidth = 3; c.beginPath(); c.moveTo(-13, -6); c.lineTo(-13, 14); c.moveTo(13, -6); c.lineTo(13, 14); c.stroke();
      c.lineWidth = 2.2; bold(0, 8.5);
    }
    else if (ord === 'mellem') { kasse(-19, -4, 11, 18); kasse(8, -4, 11, 18); bold(0, 8.5); }
    else if (ord === 'rundtom') {
      kasse(-6, -5, 12, 12);
      var a1 = Math.PI * 1.35, R = 15;
      c.lineWidth = 2.8; c.beginPath(); c.arc(0, 1, R, -Math.PI * 0.45, a1); c.stroke();
      var px = Math.cos(a1) * R, py = 1 + Math.sin(a1) * R, tx = -Math.sin(a1), ty = Math.cos(a1);
      c.fillStyle = KANT; c.beginPath(); c.moveTo(px + tx * 7, py + ty * 7); c.lineTo(px - ty * 5, py + tx * 5); c.lineTo(px + ty * 5, py - tx * 5); c.closePath(); c.fill();
      bold(Math.cos(-Math.PI * 0.45) * R, 1 + Math.sin(-Math.PI * 0.45) * R, 4.5);
    }
    else if (ord === 'vedsiden') { kasse(-15, -1, 18, 15); bold(10, 8.5); }
    c.restore();
  }

  function tegnHud() {
    var W = hud.width / hudSkala, H = hud.height / hudSkala;
    hx.setTransform(hudSkala, 0, 0, hudSkala, 0, 0);
    hx.clearRect(0, 0, W, H);
    if (tilstand !== 'flyv') return;
    var smal = W < 640, sikTop = 12, b = F.detteBud();

    /* De fem ord foroven: gyldne, naar de er klaret. Det, der gaelder lige nu, har en blaa kant. */
    var sl = smal ? 38 : 48, gab = smal ? 6 : 9, bred = ORDENE.length * sl + (ORDENE.length - 1) * gab;
    var x0 = smal ? Math.max(76, W / 2 - bred / 2) : W / 2 - bred / 2, y0 = sikTop + 4;
    ORDENE.forEach(function (ord, i) {
      var x = x0 + i * (sl + gab), nu = (b && b.ord === ord && bud.fase !== 'tak') || (ord === 'under' && bro.aktiv && !bro.klaret);
      hx.save();
      hx.shadowColor = 'rgba(107,85,68,.18)'; hx.shadowOffsetY = 4;
      rr(hx, x, y0, sl, sl, sl * 0.3); hx.fillStyle = klaret[ord] ? '#f0c46a' : 'rgba(248,241,230,.78)'; hx.fill(); hx.restore();
      if (nu) { hx.lineWidth = 3.5; hx.strokeStyle = 'rgba(95,159,201,' + (0.65 + 0.35 * Math.sin(tid * 5)) + ')'; rr(hx, x - 2, y0 - 2, sl + 4, sl + 4, sl * 0.32); hx.stroke(); }
      hx.globalAlpha = klaret[ord] || nu ? 1 : 0.4;
      pikto(hx, ord, x + sl / 2, y0 + sl / 2, sl * 0.82);
      hx.globalAlpha = 1;
    });

    /* Boblen: hvem brevet er til, og hvor de sidder. Tryk for at hoere det igen. */
    boble = null;
    if (b) {
      var bb = smal ? 150 : 184, bh = smal ? 76 : 92, bx = W - bb - 14, by = smal && x0 + bred > bx - 8 ? y0 + sl + 12 : sikTop + 4;
      boble = { x: bx, y: by, b: bb, h: bh };
      hx.save();
      hx.shadowColor = 'rgba(107,85,68,.22)'; hx.shadowOffsetY = 5; hx.shadowBlur = 10;
      rr(hx, bx, by, bb, bh, 22); hx.fillStyle = bud.fase === 'tak' ? '#fbe7b8' : '#f8f1e6'; hx.fill(); hx.restore();
      var vi = billede[b.vaert]; if (vi) { var vh = bh - 14; hx.drawImage(vi, bx + 10, by + 7, vh * forhold[b.vaert], vh); }
      var mx = bx + bb * 0.6, my = by + bh / 2, ps = bh * 0.62;
      if (b.ord === 'rundtom' && bud.fase === 'rundt') {
        var andel = klem(Math.abs(bud.rundt) / (0.95 * 2 * Math.PI), 0, 1);
        hx.lineWidth = 6; hx.lineCap = 'round'; hx.strokeStyle = 'rgba(94,74,58,.15)'; hx.beginPath(); hx.arc(mx, my, ps * 0.62, 0, 7); hx.stroke();
        hx.strokeStyle = '#8fae86'; hx.beginPath(); hx.arc(mx, my, ps * 0.62, -Math.PI / 2, -Math.PI / 2 + andel * 2 * Math.PI); hx.stroke();
      }
      pikto(hx, b.ord, mx, my, ps);
      if (bud.fase !== 'tak') { var bv = billede.brev; if (bv) hx.drawImage(bv, bx + bb * 0.12, by + bh - 34, 30, 30); }
      hoejtaler(bx + bb - 22, by + bh - 20);
    }

    /* Kortet: med én og to stjerner. Med én stjerne lyser maalet. */
    if (F.niveau <= 2 && kortBillede) {
      var ks = smal ? 118 : 158, cx = W - ks / 2 - 14, cy = H - ks / 2 - 14, sk = ks / VERDEN;
      hx.save();
      hx.shadowColor = 'rgba(107,85,68,.25)'; hx.shadowOffsetY = 5; hx.shadowBlur = 10;
      hx.fillStyle = '#f8f1e6'; hx.beginPath(); hx.arc(cx, cy, ks / 2 + 5, 0, 7); hx.fill(); hx.restore();
      hx.save(); hx.beginPath(); hx.arc(cx, cy, ks / 2, 0, 7); hx.clip();
      hx.drawImage(kortBillede, cx - ks / 2, cy - ks / 2, ks, ks);
      var ir = smal ? 8 : 10.5;
      ALLE.forEach(function (s) {
        var px = cx + s.x * sk, py = cy + s.z * sk;
        var maal = F.niveau === 1 && b && b.sted === s.id && bud.fase !== 'tak';
        if (maal) { hx.strokeStyle = 'rgba(240,196,106,' + (0.7 + 0.3 * Math.sin(tid * 5)) + ')'; hx.lineWidth = 4; hx.beginPath(); hx.arc(px, py, ir + 4 + Math.sin(tid * 5) * 1.5, 0, 7); hx.stroke(); }
        hx.fillStyle = 'rgba(248,241,230,.9)'; hx.beginPath(); hx.arc(px, py, ir, 0, 7); hx.fill();
        var im = billede[IKON[s.id]];
        if (im) { var ih = ir * 1.65, iw = ih * forhold[IKON[s.id]]; hx.drawImage(im, px - iw / 2, py - ih / 2, iw, ih); }
      });
      /* Sanne */
      var sx = cx + fugl.x * sk, sy = cy + fugl.z * sk;
      hx.translate(sx, sy); hx.rotate(Math.atan2(Math.cos(fugl.h), Math.sin(fugl.h)));
      hx.beginPath(); hx.moveTo(9, 0); hx.lineTo(-6, -6); hx.lineTo(-3, 0); hx.lineTo(-6, 6); hx.closePath();
      hx.fillStyle = '#2b2a33'; hx.fill(); hx.lineWidth = 1.6; hx.strokeStyle = '#f8f1e6'; hx.stroke();
      hx.restore();
      hx.lineWidth = 2.5; hx.strokeStyle = 'rgba(94,74,58,.45)'; hx.beginPath(); hx.arc(cx, cy, ks / 2, 0, 7); hx.stroke();
    }

    /* Pilen: kun med én stjerne, mod stedet (aldrig mod det rigtige dyr) */
    var maal = F.niveau === 1 ? F.pilMaal() : null;
    if (maal) {
      var p = projicer([maal.x, maal.y, maal.z]);
      if (p) {
        var qx = (p.nx * 0.5 + 0.5) * W, qy = (0.5 - p.ny * 0.5) * H, kant = 74;
        var inde = !p.bag && qx > kant && qx < W - kant && qy > kant + 40 && qy < H - kant;
        if (inde) pil(qx, qy - 50 - Math.sin(tid * 5) * 5, Math.PI / 2, 0.8);
        else {
          var dx = qx - W / 2, dy = qy - H / 2;
          if (p.bag) { dx = -dx; dy = Math.abs(dy) + 40; }
          var v = Math.atan2(dy, dx), ex = W / 2 - kant, ey = H / 2 - kant;
          var t = 1 / Math.sqrt(Math.pow(Math.cos(v) / ex, 2) + Math.pow(Math.sin(v) / ey, 2));
          pil(W / 2 + Math.cos(v) * t, H / 2 + Math.sin(v) * t, v, 1);
        }
      }
    }

    /* De foerste sekunder: peg derhen, hvor Sanne skal flyve */
    if (hjaelpTil > 0) {
      hx.globalAlpha = Math.min(1, hjaelpTil) * 0.9;
      var hcx = W / 2, hcy = H * 0.52, rad = Math.min(W, H) * 0.3, puls = Math.sin(tid * 4) * 6;
      [[1, 0], [-1, 0], [0, -1], [0, 1]].forEach(function (d) {
        var cx2 = hcx + d[0] * (rad + puls), cy2 = hcy + d[1] * (rad * 0.8 + puls);
        hx.fillStyle = 'rgba(248,241,230,.72)'; hx.beginPath(); hx.arc(cx2, cy2, 34, 0, 7); hx.fill();
        hx.save(); hx.translate(cx2, cy2); hx.rotate(Math.atan2(d[1], d[0]));
        hx.strokeStyle = '#5e4a3a'; hx.lineWidth = 6; hx.lineCap = 'round'; hx.lineJoin = 'round';
        hx.beginPath(); hx.moveTo(-7, -14); hx.lineTo(8, 0); hx.lineTo(-7, 14); hx.stroke();
        hx.restore();
      });
      hx.globalAlpha = 1;
    }
  }
  function pil(x, y, v, s) {
    hx.save(); hx.translate(x, y); hx.rotate(v); hx.scale(s, s);
    hx.beginPath(); hx.moveTo(22, 0); hx.lineTo(-10, -18); hx.lineTo(-3, 0); hx.lineTo(-10, 18); hx.closePath();
    hx.fillStyle = '#f0c46a'; hx.fill(); hx.lineWidth = 3.5; hx.lineJoin = 'round'; hx.strokeStyle = '#5e4a3a'; hx.stroke();
    hx.restore();
  }
  function hoejtaler(x, y) {
    hx.fillStyle = '#6b5545'; hx.beginPath(); hx.moveTo(x - 9, y - 4); hx.lineTo(x - 4, y - 4); hx.lineTo(x + 2, y - 9); hx.lineTo(x + 2, y + 9); hx.lineTo(x - 4, y + 4); hx.lineTo(x - 9, y + 4); hx.closePath(); hx.fill();
    hx.strokeStyle = '#6b5545'; hx.lineWidth = 2.2; hx.lineCap = 'round'; hx.beginPath(); hx.arc(x + 3, y, 6, -0.8, 0.8); hx.stroke(); hx.beginPath(); hx.arc(x + 3, y, 10.5, -0.8, 0.8); hx.stroke();
  }
  /* ---------- skaerm og styring ---------- */
  var skala = Math.min(window.devicePixelRatio || 1, 1.5);
  function tilpas() {
    var b = window.innerWidth, h = window.innerHeight;
    cv.width = Math.round(b * skala); cv.height = Math.round(h * skala);
    hudSkala = Math.min(window.devicePixelRatio || 1, 2);
    hud.width = Math.round(b * hudSkala); hud.height = Math.round(h * hudSkala);
  }
  window.addEventListener('resize', tilpas);
  window.addEventListener('orientationchange', function () { setTimeout(tilpas, 220); });

  /* Hvilket dyr paa stedet har man trykket paa? Store trykflader: mindst 46 px fra dyrets midte. */
  function skaermPunkt(x, y, z) {
    var p = projicer([x, y, z]); if (!p || p.bag) return null;
    return { x: (p.nx * 0.5 + 0.5) * window.innerWidth, y: (0.5 - p.ny * 0.5) * window.innerHeight };
  }
  function dyrVed(px, py) {
    var b = F.detteBud();
    if (!b || b.ord === 'rundtom' || (bud.fase !== 'afsted' && bud.fase !== 'finde')) return null;
    var bedst = null, bd = 1e9;
    steder.dyr[b.sted].forEach(function (m) {
      if (Math.hypot(m.x - fugl.x, m.z - fugl.z) > 140) return;
      var c = skaermPunkt(m.x, mitte(m), m.z), top = skaermPunkt(m.x, m.y + m.h, m.z);
      if (!c || !top) return;
      var r = Math.max(46, Math.abs(c.y - top.y) * 1.4), d = Math.hypot(px - c.x, py - c.y);
      if (d < r && d < bd) { bd = d; bedst = m; }
    });
    return bedst;
  }
  function traeVed(px, py) {
    var b = F.detteBud();
    if (!b || b.ord !== 'rundtom' || Math.hypot(TRAE.x - fugl.x, TRAE.z - fugl.z) > 160) return false;
    var c = skaermPunkt(TRAE.x, TRAE.h * 0.55, TRAE.z), top = skaermPunkt(TRAE.x, TRAE.h, TRAE.z);
    if (!c || !top) return false;
    return Math.hypot(px - c.x, py - c.y) < Math.max(60, Math.abs(c.y - top.y) * 1.3);
  }

  /* Hver finger foelges for sig; den sidste, der kom ned, styrer */
  hud.addEventListener('pointerdown', function (e) {
    if (tilstand !== 'flyv') return;
    e.preventDefault();
    if (boble && e.clientX >= boble.x && e.clientX <= boble.x + boble.b && e.clientY >= boble.y && e.clientY <= boble.y + boble.h) { F.gentag(); return; }
    var dyr = dyrVed(e.clientX, e.clientY);
    if (dyr) { F.vaelg(dyr); return; }
    if (traeVed(e.clientX, e.clientY) && F.rundtOmTrae()) return;
    fingre[e.pointerId] = { x: e.clientX, y: e.clientY }; fingerOrden.push(e.pointerId);
    try { hud.setPointerCapture(e.pointerId); } catch (fejl) { /* ikke noedvendigt */ }
  }, { passive: false });
  hud.addEventListener('pointermove', function (e) { var f = fingre[e.pointerId]; if (f) { f.x = e.clientX; f.y = e.clientY; } });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (t) {
    hud.addEventListener(t, function (e) { delete fingre[e.pointerId]; fingerOrden = fingerOrden.filter(function (id) { return id !== e.pointerId; }); });
  });
  hud.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  var TASTER = { ArrowLeft: 'v', a: 'v', ArrowRight: 'h', d: 'h', ArrowUp: 'o', w: 'o', ArrowDown: 'n', s: 'n' };
  window.addEventListener('keydown', function (e) {
    if (TASTER[e.key]) { taster[TASTER[e.key]] = true; if (tilstand === 'flyv') e.preventDefault(); }
    if (e.key === ' ' && tilstand === 'flyv') { F.gentag(); e.preventDefault(); }
  });
  window.addEventListener('keyup', function (e) { if (TASTER[e.key]) taster[TASTER[e.key]] = false; });

  /* ---------- menuen ---------- */
  function visOverlay(html) { overlay.innerHTML = html; overlay.hidden = false; }
  function skjulOverlay() { overlay.hidden = true; }
  function stop() { tie(); fingre = {}; fingerOrden = []; if (vind) vind.gain.value = 0; }

  /* Menuens billede: Sanne med et brev over oeen, tegnet i kode */
  function tegnEksempel(c) {
    var x = c.getContext('2d'), w = c.width, h = c.height;
    x.fillStyle = '#cfe3ec'; rr(x, 0, 0, w, h, 18); x.fill();
    x.fillStyle = '#93bc63'; x.beginPath(); x.ellipse(w / 2, h + 40, w * 0.62, 95, 0, 0, 7); x.fill();
    x.fillStyle = '#5f9fc9'; x.beginPath(); x.moveTo(w * 0.47, h); x.quadraticCurveTo(w * 0.5, h - 30, w * 0.55, h - 44); x.lineTo(w * 0.58, h - 44); x.quadraticCurveTo(w * 0.55, h - 26, w * 0.56, h); x.fill();
    if (billede.kanin) x.drawImage(billede.kanin, w * 0.14, h - 70, 40, 56);
    if (billede.trae) x.drawImage(billede.trae, w * 0.7, h - 96, 74, 80);
    var sx = w * 0.46, sy = h * 0.34;
    x.fillStyle = '#2f4566'; x.beginPath(); x.moveTo(sx - 60, sy - 6); x.lineTo(sx, sy + 4); x.lineTo(sx + 60, sy - 6); x.lineTo(sx + 50, sy + 6); x.lineTo(sx, sy + 12); x.lineTo(sx - 50, sy + 6); x.fill();
    x.fillStyle = '#f1ece2'; x.beginPath(); x.moveTo(sx - 60, sy - 6); x.lineTo(sx - 36, sy); x.lineTo(sx - 48, sy + 6); x.fill(); x.beginPath(); x.moveTo(sx + 60, sy - 6); x.lineTo(sx + 36, sy); x.lineTo(sx + 48, sy + 6); x.fill();
    x.fillStyle = '#2b2a33'; x.beginPath(); x.ellipse(sx, sy + 6, 13, 17, 0, 0, 7); x.fill();
    x.fillStyle = '#f1ece2'; x.beginPath(); x.ellipse(sx, sy + 12, 7, 9, 0, 0, 7); x.fill();
    if (billede.brev) x.drawImage(billede.brev, sx - 16, sy + 16, 32, 32);
  }

  function visMenu() {
    tilstand = 'menu'; stop();
    visOverlay(
      '<div class="kort">' +
      '<h2>Himmelvejen</h2>' +
      '<canvas class="eksempel" width="440" height="220"></canvas>' +
      Menu.stjerneRaekke(svaerhed) +
      '<div class="raekke start"><button class="knap groen start" data-handling="start" aria-label="Flyv">' + Menu.start() + '</button></div>' +
      Menu.lydRaekke(lydTil) +
      '</div>'
    );
    var eks = overlay.querySelector('canvas.eksempel');
    if (eks) tegnEksempel(eks);
  }
  /* Slut: de fem ord, gyldne naar de er klaret, og så igen eller menuen */
  function visSlut() {
    tilstand = 'slut'; stop();
    visOverlay(
      '<div class="kort">' +
      '<h2>Himmelvejen</h2>' +
      '<canvas class="ordene" width="440" height="110"></canvas>' +
      Menu.slutRaekke('igen', null) +
      '</div>'
    );
    var c = overlay.querySelector('canvas.ordene');
    if (c) {
      var x = c.getContext('2d'), sl = 76, gab = 11, x0 = (c.width - 5 * sl - 4 * gab) / 2;
      ORDENE.forEach(function (ord, i) {
        var px = x0 + i * (sl + gab);
        rr(x, px, 16, sl, sl, 22); x.fillStyle = klaret[ord] ? '#f0c46a' : '#efe3d0'; x.fill();
        x.globalAlpha = klaret[ord] ? 1 : 0.35; pikto(x, ord, px + sl / 2, 16 + sl / 2, sl * 0.8); x.globalAlpha = 1;
      });
    }
  }

  overlay.addEventListener('click', function (e) {
    var knap = e.target.closest('[data-handling]');
    if (!knap) return;
    var h = knap.dataset.handling;
    if (h === 'svaerhed') { svaerhed = +knap.dataset.n; visMenu(); }
    else if (h === 'lyd') { lydTil = !lydTil; if (!lydTil) tie(); visMenu(); }
    else if (h === 'start' || h === 'igen') {
      startLyd(); tone(523, 0.1, 0.1);
      skjulOverlay();
      nyTur();          // foerste saetning siges i selve trykket, ellers er iOS stum
      tilstand = 'flyv';
    }
    else if (h === 'menu') visMenu();
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
  landskab = lavLandskab(); vand = lavVand(); bygninger = lavBygninger();
  krop = lavKrop(); vingeV = lavVinge(1); vingeH = lavVinge(-1);
  Skal.menuKnap(visMenu);      // pilen i hjoernet foerer tilbage til menuen, ogsaa midt i en flyvetur
  visMenu();
  hentBilleder(function () {
    lavKodeTeksturer();
    byggVerden();
    lavKort();
    if (tilstand === 'menu') visMenu();
  });
  requestAnimationFrame(loekke);

  /* Kun til afproevning */
  window.__debug = function () {
    var b = F.detteBud();
    return {
      tilstand: tilstand, svaerhed: svaerhed, fugl: fugl, stemme: stemme ? stemme.name : null,
      bud: bud ? { nr: bud.nr, fase: bud.fase, rundt: bud.rundt } : null, bro: bro ? { klaret: bro.klaret, aktiv: bro.aktiv, y: BRO.y, z: BRO.z } : null,
      klaret: klaret ? Object.keys(klaret) : [], billeder: Object.keys(tekstur).length, udklip: udklip.length,
      dyr: b && b.sted && steder.dyr[b.sted] && tilstand === 'flyv' ? steder.dyr[b.sted].map(function (m) {
        var c = skaermPunkt(m.x, mitte(m), m.z); return { ord: m.ord, ret: m.ord === b.ord, x: m.x, y: mitte(m), z: m.z, sx: c && c.x, sy: c && c.y };
      }) : [],
      trae: tilstand === 'flyv' ? skaermPunkt(TRAE.x, TRAE.h * 0.55, TRAE.z) : null,
      maal: F.pilMaal()
    };
  };
})();
