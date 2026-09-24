#!/usr/bin/env python3
"""
Laver stemmeklip med Gemini (stemmen Kore) — én gang, paa en computer.
Klippene laegges i games/<spil>/lyd/, lyd/klip.json skrives som
{ "saetning": "fil.mp3" }, og sw.js faar filerne ind i FILER. Spillet kalder
aldrig Gemini; js/stemme.js spiller bare filerne.

Bruges til de spil, der taler i hele saetninger: Årstidshaven (have) og
Himmelvejen (flyv). Saetningerne laeses fra spillets egen kode
(Haven.saetninger() og Oe.saetninger()), saa listen kun findes ét sted.

Foerste gang:
    pip install lameenc                 (MP3-koderen)
    export GEMINI_API_KEY=...           (noeglen fra aistudio.google.com, aldrig i repoet;
                                         i Claude Code paa nettet kan den i stedet ligge som
                                         API-credential med headeren x-goog-api-key)
    python3 vaerktoej/lav-lyd-gemini.py --spil have --proev
    python3 vaerktoej/lav-lyd-gemini.py --spil have
Bagefter: npm test, tael VERSION op i sw.js, commit.

Koer igen, naar en saetning er aendret: kun de nye laves, og klip til
saetninger, spillet ikke laengere siger, slettes.

Valg:
    --spil have|flyv
    --stemme <navn>  Kore (standard). Andre: Aoede, Zephyr, Sulafat, Achernar ...
    --model <navn>   gemini-3.8-flash-tts (standard)
    --alle           lav ogsaa klip, der findes i forvejen
    --kun <tekst>    lav kun saetninger, der indeholder teksten (fx --kun gulerød)
    --proev          vis, hvad der ville blive lavet, uden at kalde Gemini
    --registrer      lav ikke noget, men skriv klip.json og sw.js ud fra filerne

Gratisnoeglen giver cirka ét klip i minuttet; vaerktoejet venter selv, saa et helt spil
tager et par timer. Med betaling slaaet til paa noeglen i AI Studio gaar det hurtigt.
"""
import base64, hashlib, io, json, os, re, subprocess, sys, time, urllib.error, urllib.request, wave, array

ROD = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


def arg(navn, standard=None):
    return sys.argv[sys.argv.index(navn) + 1] if navn in sys.argv else standard


SPIL = arg('--spil', 'have')
if SPIL not in ('have', 'flyv'):
    raise SystemExit('--spil skal vaere have eller flyv')
MAPPE = 'games/' + SPIL
UD = os.path.join(ROD, MAPPE, 'lyd')
MODEL = arg('--model', 'gemini-3.8-flash-tts')
STEMME = arg('--stemme', 'Kore')

# Stilen ligger i en note foran selve teksten. Skrives den som "Laes varmt: <tekst>", laeser
# stemmen ogsaa beskrivelsen hoejt, og et separat felt til stilen tager modellen ikke imod.
NOTE = ("### DIRECTOR'S NOTES\n"
        "Voice: warm, calm, friendly female preschool teacher speaking to a six-year-old. "
        "Clear and slightly slow. Standard Danish pronunciation, no dialect.\n\n"
        "### TRANSCRIPT\n")


def saetninger():
    """Saetningerne fra spillets egen kode, via node."""
    if SPIL == 'have':
        kode = "const { Haven } = require(%r); console.log(JSON.stringify(Haven.saetninger()));" % os.path.join(ROD, 'games', 'have', 'js', 'haven.js')
    else:
        kode = "const { Oe } = require(%r); console.log(JSON.stringify(Oe.saetninger()));" % os.path.join(ROD, 'games', 'flyv', 'js', 'oe.js')
    return json.loads(subprocess.check_output(['node', '-e', kode]))


def filnavn(tekst):
    """Et kort navn uden æ, ø og å, og et stykke af en hash, saa to saetninger aldrig faar samme fil."""
    t = tekst.lower()
    for a, b in (('æ', 'ae'), ('ø', 'oe'), ('å', 'aa'), ('é', 'e')):
        t = t.replace(a, b)
    t = re.sub(r'[^a-z0-9]+', '_', t).strip('_')
    t = '_'.join(t.split('_')[:6])[:36].strip('_')
    return '%s_%s.mp3' % (t, hashlib.sha1(tekst.encode('utf-8')).hexdigest()[:6])


def kald(tekst):
    """Én saetning til Gemini. Svarer med (pcm, samplerate) eller rejser en fejl."""
    url = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % MODEL
    krop = {'contents': [{'parts': [{'text': NOTE + tekst}]}],
            'generationConfig': {'responseModalities': ['AUDIO'],
                                 'speechConfig': {'voiceConfig': {'prebuiltVoiceConfig': {'voiceName': STEMME}}}}}
    hoved = {'Content-Type': 'application/json'}
    if os.environ.get('GEMINI_API_KEY'):
        hoved['x-goog-api-key'] = os.environ['GEMINI_API_KEY']
    req = urllib.request.Request(url, data=json.dumps(krop).encode(), headers=hoved)
    with urllib.request.urlopen(req, timeout=120) as r:
        d = json.load(r)
    del_ = d['candidates'][0]['content']['parts'][0]['inlineData']
    raa = base64.b64decode(del_['data'])
    if raa[:4] == b'RIFF':
        w = wave.open(io.BytesIO(raa))
        if w.getsampwidth() != 2 or w.getnchannels() != 1:
            raise ValueError('uventet lydformat')
        return w.readframes(w.getnframes()), w.getframerate()
    m = re.search(r'rate=(\d+)', del_.get('mimeType', ''))   # raa PCM, fx audio/L16;rate=24000
    return raa, int(m.group(1)) if m else 24000


def klargoer(pcm, sr):
    """Klip stilhed af enderne, og saet lydstyrken, saa alle klip er lige hoeje."""
    a = array.array('h', pcm)
    if sys.byteorder == 'big':
        a.byteswap()
    blok = int(sr * 0.02)
    rms = []
    for i in range(0, len(a), blok):
        stk = a[i:i + blok]
        rms.append((sum(x * x for x in stk) / max(1, len(stk))) ** 0.5)
    if not rms or max(rms) < 50:
        raise ValueError('tavst klip')
    graense = max(rms) * 0.03
    tale = [i for i, r in enumerate(rms) if r > graense]
    start = max(0, tale[0] * blok - int(sr * 0.05))
    slut = min(len(a), (tale[-1] + 1) * blok + int(sr * 0.12))
    a = a[start:slut]
    # Lydstyrken maales paa talen alene, og toppen maa ikke over -1 dB
    taleRms = (sum(r * r for r in rms if r > graense) / max(1, len(tale))) ** 0.5
    top = max(abs(x) for x in a) or 1
    gang = min(3000.0 / taleRms, 0.89 * 32767 / top)
    ud = array.array('h', (max(-32767, min(32767, int(x * gang))) for x in a))
    return ud, (slut - start) / sr


def mp3(pcm, sr):
    import lameenc
    k = lameenc.Encoder()
    k.set_bit_rate(48); k.set_in_sample_rate(sr); k.set_channels(1); k.set_quality(2)
    ud = array.array('h', pcm)
    if sys.byteorder == 'big':
        ud.byteswap()
    return k.encode(ud.tobytes()) + k.flush()


def laes_klip():
    sti = os.path.join(UD, 'klip.json')
    if os.path.exists(sti):
        try:
            return json.load(open(sti, encoding='utf-8'))
        except ValueError:
            pass
    return {}


def registrer(liste=None):
    """Skriv klip.json og FILER i sw.js ud fra de filer, der ligger i lyd/. Klip til gamle saetninger slettes."""
    liste = liste if liste is not None else saetninger()
    os.makedirs(UD, exist_ok=True)
    klip = {t: filnavn(t) for t in liste if os.path.exists(os.path.join(UD, filnavn(t)))}
    brugt = set(klip.values())
    for f in os.listdir(UD):
        if f.endswith('.mp3') and f not in brugt:
            os.remove(os.path.join(UD, f))
            print('  slettet gammelt klip %s' % f)
    with open(os.path.join(UD, 'klip.json'), 'w', encoding='utf-8') as f:
        json.dump(klip, f, ensure_ascii=False, indent=0, sort_keys=True)
        f.write('\n')
    p = os.path.join(ROD, 'sw.js')
    s = open(p, encoding='utf-8').read()
    s = re.sub(r"  '%s/lyd/[^']+\.mp3',\n" % MAPPE, '', s)
    linjer = ''.join("  '%s/lyd/%s',\n" % (MAPPE, f) for f in sorted(brugt))
    anker = "  '%s/lyd/klip.json',\n" % MAPPE
    if anker not in s:
        raise SystemExit('Tilfoej %s i FILER i sw.js foerst.' % anker.strip())
    s = s.replace(anker, anker + linjer)
    open(p, 'w', encoding='utf-8').write(s)
    mangler = [t for t in liste if t not in klip]
    if mangler:
        print('%d saetninger mangler stadig klip (enhedens stemme siger dem): %s' % (len(mangler), ' | '.join(mangler[:4])))
    return len(klip)


def lav():
    liste = saetninger()
    kun = arg('--kun')
    alle, proev = '--alle' in sys.argv, '--proev' in sys.argv
    os.makedirs(UD, exist_ok=True)
    opgaver = [t for t in liste if (alle or not os.path.exists(os.path.join(UD, filnavn(t)))) and (not kun or kun in t)]
    print('%s: %d saetninger, %d skal laves (%d tegn). Model %s, stemmen %s.' % (SPIL, len(liste), len(opgaver), sum(len(t) for t in opgaver), MODEL, STEMME))
    if proev:
        for t in opgaver:
            print('  %-44s %s' % (filnavn(t), t))
        return
    lavet, fejl = 0, []
    for nr, t in enumerate(opgaver, 1):
        forventet = 1.0 + len(t) * 0.085   # saa laenge taler hun cirka; meget laengere betyder, at noten kom med
        forsoeg, ventet = 0, 0
        while forsoeg < 3:
            try:
                pcm, sr = kald(t)
                lydd, sek = klargoer(pcm, sr)
                if sek > forventet * 2.2 + 1.5:
                    raise ValueError('%.1f s er for langt til saetningen; noten blev nok laest op' % sek)
                with open(os.path.join(UD, filnavn(t)), 'wb') as f:
                    f.write(mp3(lydd, sr))
                lavet += 1
                print('  %3d/%d %4.1f s  %s' % (nr, len(opgaver), sek, t))
                break
            except urllib.error.HTTPError as e:
                krop = e.read().decode('utf-8', 'replace')
                if e.code == 429:
                    # Gratisnoeglen giver cirka ét klip i minuttet og siger selv, hvor laenge der skal ventes.
                    # Kommer der slet ikke noget igennem i en halv time, er dagens kvote brugt: stop.
                    pause = 30
                    m = re.search(r'"retryDelay":\s*"(\d+)', krop)
                    if m:
                        pause = int(m.group(1)) + 2
                    if ventet > 1800:
                        print('Gemini har sagt stop i en halv time (429). Koer igen senere; de klip, der er lavet, bliver liggende.')
                        registrer(liste)
                        return
                    print('        venter %d s paa Gemini ...' % pause)
                    time.sleep(pause); ventet += pause
                    continue
                fejl.append((t, 'HTTP %d: %s' % (e.code, krop[:300])))
                break
            except (ValueError, KeyError, IndexError) as e:
                forsoeg += 1
                if forsoeg == 3:
                    fejl.append((t, str(e)))
                time.sleep(1)
        time.sleep(0.5)
    antal = registrer(liste)
    print('%d klip lavet, %d i klip.json.' % (lavet, antal))
    for t, f in fejl:
        print('  FEJL %s: %s' % (t, f))
    print('Husk: npm test, tael VERSION op i sw.js, commit.')


if __name__ == '__main__':
    if '--registrer' in sys.argv:
        print('%d klip i klip.json og sw.js.' % registrer())
    else:
        lav()
