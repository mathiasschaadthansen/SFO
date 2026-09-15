/**
 * Service worker.
 *
 * Cache-first: alt hentes fra cachen, saa spillene virker uden internet.
 * Naar du tilfoejer en fil til projektet, skal den med i FILER nedenfor,
 * og VERSION skal taelles op — ellers henter iPad'en den gamle version.
 */
const VERSION = 'sfo-spil-v2';

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
  'games/racer/tracks/slangen.json'
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
