#!/usr/bin/env node
/**
 * Laver opgavearkene til Pelles julekalender som PDF: A4 paa hoejkant, forsiden
 * til laereren foerst, saa en oversigt, ét eller to ark pr. dag og facit
 * bagerst. Arkene er ikke en del af appen (og ikke i sw.js); PDF'en laves her
 * og sendes til laererne. Den ligger ikke i repoet.
 *
 * Kraever Playwright med Chromium (ligger ikke i repoet):
 *     npm install playwright && npx playwright install chromium
 *     node vaerktoej/lav-jul-ark.js [ud.pdf]
 * Scriptet starter selv en lille server paa 127.0.0.1, aabner
 * vaerktoej/jul-ark/, venter paa, at alle ark er tegnet (window.KLAR), og
 * skriver PDF'en. Indholdet staar i vaerktoej/jul-ark/ark.js.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROD = path.join(__dirname, '..');
const UD = path.resolve(process.argv[2] || path.join(ROD, 'pelles-julekalender-opgaveark.pdf'));
const MIME = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', svg: 'image/svg+xml', css: 'text/css' };
const { chromium } = require(process.env.PLAYWRIGHT_MODUL || 'playwright');

const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  const fil = path.join(ROD, path.normalize(p));
  if (!fil.startsWith(ROD)) { r.writeHead(403); r.end(); return; }
  fs.readFile(fil, (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p).slice(1)] || 'application/octet-stream' }); r.end(d);
  });
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 1000, height: 1400 } });
  p.on('console', m => { if (m.type() === 'error' || /FEJL|For meget/.test(m.text())) console.log('  ' + m.text()); });
  p.on('pageerror', e => console.log('  Fejl paa siden: ' + e.message));
  await p.goto('http://127.0.0.1:' + port + '/vaerktoej/jul-ark/');
  await p.waitForFunction(() => window.KLAR === true, null, { timeout: 60000 });
  const { fejl, over, sider } = await p.evaluate(() => ({ fejl: window.FEJL || null, over: window.OVERLOEB || [], sider: window.SIDER }));
  if (fejl) console.log('  ' + fejl);
  over.forEach(o => console.log('  For meget paa siden: ' + o));
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: UD, format: 'A4', printBackground: true, preferCSSPageSize: true });
  await b.close(); server.close();
  console.log('Skrev ' + UD + ' (' + sider + ' sider, ' + Math.round(fs.statSync(UD).size / 1024) + ' KB)');
  if (fejl || over.length) process.exitCode = 1;
});
