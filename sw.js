/**
 * Service worker.
 *
 * Cache-first: alt hentes fra cachen, saa spillene virker uden internet.
 * Naar du tilfoejer en fil til projektet, skal den med i FILER nedenfor,
 * og VERSION skal taelles op — ellers henter iPad'en den gamle version.
 */
const VERSION = 'sfo-spil-v17';

const FILER = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/shell.css',
  'js/games.js',
  'js/shell.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'games/racer/',
  'games/racer/index.html',
  'games/racer/js/track.js',
  'games/racer/js/physics.js',
  'games/racer/js/input.js',
  'games/racer/js/game.js',
  'games/racer/tracks/index.js',
  'games/racer/tracks/rundbanen.json',
  'games/racer/tracks/bakkebanen.json',
  'games/racer/tracks/slangen.json',
  'games/klatbold/',
  'games/klatbold/index.html',
  'games/klatbold/js/physics.js',
  'games/klatbold/js/input.js',
  'games/klatbold/js/game.js',
  'games/bobler/',
  'games/bobler/index.html',
  'games/bobler/js/physics.js',
  'games/bobler/js/input.js',
  'games/bobler/js/game.js',
  'games/bogstaver/',
  'games/bogstaver/index.html',
  'games/bogstaver/js/glyffer.js',
  'games/bogstaver/js/spor.js',
  'games/bogstaver/js/ting.js',
  'games/bogstaver/js/game.js',
  'games/bogstaver/ting/aeble.svg',
  'games/bogstaver/ting/and.svg',
  'games/bogstaver/ting/bold.svg',
  'games/bogstaver/ting/cykel.svg',
  'games/bogstaver/ting/drage.svg',
  'games/bogstaver/ting/elefant.svg',
  'games/bogstaver/ting/fisk.svg',
  'games/bogstaver/ting/gris.svg',
  'games/bogstaver/ting/hus.svg',
  'games/bogstaver/ting/is.svg',
  'games/bogstaver/ting/jordbaer.svg',
  'games/bogstaver/ting/kat.svg',
  'games/bogstaver/ting/loeve.svg',
  'games/bogstaver/ting/maane.svg',
  'games/bogstaver/ting/noegle.svg',
  'games/bogstaver/ting/oeje.svg',
  'games/bogstaver/ting/ost.svg',
  'games/bogstaver/ting/paraply.svg',
  'games/bogstaver/ting/regnbue.svg',
  'games/bogstaver/ting/sol.svg',
  'games/bogstaver/ting/trae.svg',
  'games/bogstaver/ting/ur.svg',
  'games/bogstaver/ting/vante.svg',
  'games/bogstaver/ting/yoyo.svg'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(VERSION)
      .then((c) => c.addAll(FILER))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((navne) => Promise.all(
        navne.filter((n) => n !== VERSION).map((n) => caches.delete(n))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then((traef) => traef || fetch(e.request))
  );
});
