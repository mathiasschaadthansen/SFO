#!/usr/bin/env python3
"""
Laver lydklip til Bogstaver med Piper (offline talesyntese) og pakker dem som
små MP3-filer i games/bogstaver/lyd/. Koeres én gang, resultatet ligger i
repoet, saa spillet aldrig kalder ud paa nettet.

Kraever: pip install piper-tts lameenc, og stemmen da_DK-talesyntese-medium
(onnx + json) i samme mappe som scriptet eller angivet med --stemme.

Filerne kan senere erstattes af rigtige optagelser med samme filnavne, fx en
paedagog der laeser ordene ind. Spillet er ligeglad med hvor lyden kommer fra.
"""
import json, subprocess, sys, wave, os, io
import lameenc

ROD = os.path.join(os.path.dirname(__file__), '..')
UD = os.path.join(ROD, 'games', 'bogstaver', 'lyd')
STEMME = sys.argv[sys.argv.index('--stemme') + 1] if '--stemme' in sys.argv else os.path.join(os.path.dirname(__file__), 'da.onnx')

# Bogstavernes navne som de siges, ikke som de skrives. Noeglen er glyf-navnet.
NAVNE = {
    'A': 'a', 'B': 'be', 'C': 'se', 'D': 'de', 'E': 'e', 'F': 'æf', 'G': 'ge', 'H': 'hå', 'I': 'i', 'J': 'jåd',
    'K': 'kå', 'L': 'æl', 'M': 'æm', 'N': 'æn', 'O': 'o', 'P': 'pe', 'Q': 'ku', 'R': 'ær', 'S': 'æs', 'T': 'te',
    'U': 'u', 'V': 've', 'W': 'dobbelt-ve', 'X': 'æks', 'Y': 'y', 'Z': 'sæt', 'AE': 'æ', 'OE': 'ø', 'AA': 'å'
}
TAL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni']

def sig(tekst, fil):
    r = subprocess.run([sys.executable, '-m', 'piper', '-m', STEMME, '-f', '/tmp/klip.wav'], input=tekst.encode('utf-8'),
                       capture_output=True)
    if r.returncode != 0:
        raise SystemExit('piper fejlede paa "%s": %s' % (tekst, r.stderr.decode()[-300:]))
    w = wave.open('/tmp/klip.wav')
    data = w.readframes(w.getnframes())
    enc = lameenc.Encoder()
    enc.set_bit_rate(40)
    enc.set_in_sample_rate(w.getframerate())
    enc.set_channels(1)
    enc.set_quality(2)
    mp3 = enc.encode(data) + enc.flush()
    with open(os.path.join(UD, fil), 'wb') as f:
        f.write(mp3)
    return len(mp3)

os.makedirs(UD, exist_ok=True)
antal, bytes_ = 0, 0
for navn, tekst in NAVNE.items():
    bytes_ += sig(tekst, 'bogstav_%s.mp3' % navn); antal += 1
    bytes_ += sig('Hvad starter med %s?' % tekst, 'spoerg_%s.mp3' % navn); antal += 1
for i, tekst in enumerate(TAL):
    bytes_ += sig(tekst, 'tal_%d.mp3' % i); antal += 1
for bogstav, ord, fil in json.load(open(sys.argv[sys.argv.index('--ord') + 1] if '--ord' in sys.argv else '/tmp/ord.json', encoding='utf-8')):
    bytes_ += sig(ord, 'ord_%s.mp3' % fil); antal += 1
print('%d klip, %d KB' % (antal, bytes_ // 1024))
