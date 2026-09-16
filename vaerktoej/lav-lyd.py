#!/usr/bin/env python3
"""
Laegger rigtige optagelser ind i Bogstaver.

    python3 vaerktoej/lav-lyd.py --optagelser <mappe med wav-filer>

WAV-filerne kommer fra vaerktoej/optag.html og har allerede de rigtige navne
(bogstav_B.wav, tal_5.wav, ord_bil.wav, spoerg_B.wav). Scriptet klipper
stilhed vaek i begge ender, saetter lydstyrken ens, laver MP3 i
games/bogstaver/lyd/ og skriver klip.json med de klip der findes. Spillet
bruger et klip naar det staar i klip.json, ellers enhedens egen talesyntese.

Kraever: pip install lameenc. Husk at taelle VERSION op i sw.js bagefter, og
at tilfoeje nye mp3-filer til FILER i sw.js (testen brokker sig ellers).
"""
import array, json, os, sys, wave

ROD = os.path.join(os.path.dirname(__file__), '..')
UD = os.path.join(ROD, 'games', 'bogstaver', 'lyd')


def fra_optagelser(mappe):
    import lameenc
    antal = 0
    for navn in sorted(os.listdir(mappe)):
        if not navn.lower().endswith('.wav'):
            continue
        w = wave.open(os.path.join(mappe, navn))
        rate, kanaler, bredde = w.getframerate(), w.getnchannels(), w.getsampwidth()
        if bredde != 2:
            raise SystemExit('%s: kun 16-bit WAV understoettes' % navn)
        pr = array.array('h', w.readframes(w.getnframes()))
        if kanaler > 1:
            pr = array.array('h', pr[::kanaler])
        top = max(1, max(abs(x) for x in pr))
        graense = top * 0.03
        foerste = next((k for k, x in enumerate(pr) if abs(x) > graense), 0)
        sidste = next((k for k in range(len(pr) - 1, -1, -1) if abs(pr[k]) > graense), len(pr) - 1)
        pad = int(rate * 0.08)
        pr = pr[max(0, foerste - pad):min(len(pr), sidste + pad)]
        faktor = 0.9 * 32767 / top
        pr = array.array('h', (int(max(-32768, min(32767, x * faktor))) for x in pr))
        enc = lameenc.Encoder()
        enc.set_bit_rate(48)
        enc.set_in_sample_rate(rate)
        enc.set_channels(1)
        enc.set_quality(2)
        mp3 = enc.encode(pr.tobytes()) + enc.flush()
        with open(os.path.join(UD, navn[:-4] + '.mp3'), 'wb') as f:
            f.write(mp3)
        antal += 1
        print('  %s -> %s.mp3 (%.2f s)' % (navn, navn[:-4], len(pr) / rate))
    klip = sorted(f for f in os.listdir(UD) if f.endswith('.mp3'))
    json.dump(klip, open(os.path.join(UD, 'klip.json'), 'w'), indent=0)
    print('%d optagelser lagt ind, %d klip i klip.json' % (antal, len(klip)))


if __name__ == '__main__':
    if '--optagelser' not in sys.argv:
        raise SystemExit(__doc__)
    fra_optagelser(sys.argv[sys.argv.index('--optagelser') + 1])
