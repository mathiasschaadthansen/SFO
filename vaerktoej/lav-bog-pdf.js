#!/usr/bin/env node
/**
 * Laver Bogen om Noeddeskoven som PDF: et A4-ark paa tvaers pr. side, forsiden
 * foerst. Bogen har ingen printknap i appen; PDF'en laves her én gang og
 * sendes til dem, der skal printe den.
 *
 * Kraever Playwright med Chromium (ligger ikke i repoet):
 *     npm install playwright && npx playwright install chromium
 *     node vaerktoej/lav-bog-pdf.js [ud.pdf]
 * Scriptet starter selv en lille server paa 127.0.0.1, aabner bog/, tegner
 * alle sider i #print (BogSkaerm.byggePrint) og skriver PDF'en.
 */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path');
const ROD = path.join(__dirname, '..');
const UD = path.resolve(process.argv[2] || path.join(ROD, 'bogen-om-noeddeskoven.pdf'));
const MIME = { html: 'text/html', js: 'application/javascript', json: 'application/json', png: 'image/png', mp3: 'audio/mpeg', css: 'text/css' };
const { chromium } = require(process.env.PLAYWRIGHT_MODUL || 'playwright');

const server = http.createServer((q, r) => {
  let p = decodeURIComponent(q.url.split('?')[0]); if (p.endsWith('/')) p += 'index.html';
  fs.readFile(path.join(ROD, p), (e, d) => {
    if (e) { r.writeHead(404); r.end(); return; }
    r.writeHead(200, { 'Content-Type': MIME[path.extname(p).slice(1)] || 'application/octet-stream' }); r.end(d);
  });
});
server.listen(0, '127.0.0.1', async () => {
  const port = server.address().port;
  const b = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
  const p = await b.newPage({ viewport: { width: 1024, height: 768 } });
  await p.goto('http://127.0.0.1:' + port + '/bog/');
  await p.waitForFunction(() => window.Scener && window.BogSkaerm && Object.keys(window.Scener.BILLEDER).every(n => window.Scener.klar(n)), null, { timeout: 20000 });
  await p.evaluate(() => window.BogSkaerm.byggePrint());
  await p.emulateMedia({ media: 'print' });
  await p.pdf({ path: UD, format: 'A4', landscape: true, printBackground: true, preferCSSPageSize: true });
  await b.close(); server.close();
  console.log('Skrev ' + UD + ' (' + Math.round(fs.statSync(UD).size / 1024) + ' KB)');
});
