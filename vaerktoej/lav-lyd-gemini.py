#!/usr/bin/env python3
"""
Laver stemmeklip med Gemini (stemmen Kore) — én gang, paa en computer.
Klippene laegges i games/<spil>/lyd/, lyd/klip.json skrives som
{ "saetning": "fil.mp3" }, og sw.js faar filerne ind i FILER. Spillet kalder
aldrig Gemini; js/stemme.js spiller bare filerne.

Bruges til alle spillets stemmer, paa to maader:

* have og flyv taler i hele saetninger. Saetningerne laeses fra spillets egen kode
  (Haven.saetninger() og Oe.saetninger()), filnavnene laves af saetningen, og
  lyd/klip.json skrives som { "saetning": "fil.mp3" }.
* bogstaver, restaurant, klokken, maskinen, find, rim og bog har faste filnavne
  (bogstav_A.mp3, bestil_b1a.mp3 ...), som spillene allerede kender. Her laves
  klippene om i de samme filer, og listen over dem er den samme som i
  lav-lyd-elevenlabs.py. Bogstaver og tal siges rene ("A.", "Tre."), og ordene
  i rammen "Her har du ordet kat.", fordi et kort ord alene bliver udtalt forkert.

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
    --spil have|flyv|bogstaver|restaurant|klokken|maskinen|find|rim|bog
    --stemme <navn>  Kore (standard). Andre: Aoede, Zephyr, Sulafat, Achernar ...
    --model <navn>   gemini-3.8-flash-tts (standard)
    --alle           lav ogsaa klip, der findes i forvejen (de faste spil laver altid alle,
                     men husker, hvor langt de naaede, hvis de bliver afbrudt)
    --kun <tekst>    lav kun saetninger, der indeholder teksten (fx --kun gulerød)
    --proev          vis, hvad der ville blive lavet, uden at kalde Gemini
    --pr-kald <n>    saetninger i ét kald (standard 12); de deles op ved pauserne bagefter
    --registrer      lav ikke noget, men skriv klip.json og sw.js ud fra filerne

Gemini giver kun 100 kald om dagen til gemini-3.8-flash-tts, ogsaa med betaling (uden
betaling 10). Derfor laeses op til 12 saetninger i ét kald, med en lang pause efter hver
linje, og optagelsen deles op ved pauserne. Gaar det ikke op (for faa eller for mange
stykker, eller laengderne passer ikke til teksterne), deles bundtet i to og proeves igen,
ned til én saetning ad gangen. Er dagens kald brugt, stopper vaerktoejet, og naeste dag
fortsaetter det, hvor det slap.
"""
import base64, hashlib, io, json, os, re, subprocess, sys, time, urllib.error, urllib.request, wave, array

ROD = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))


def arg(navn, standard=None):
    return sys.argv[sys.argv.index(navn) + 1] if navn in sys.argv else standard


SAETNINGSSPIL = ('have', 'flyv', 'baever', 'egern', 'tegn')
FASTE_SPIL = ('bogstaver', 'restaurant', 'klokken', 'maskinen', 'find', 'rim', 'bog')
SPIL = arg('--spil', 'have')
if SPIL not in SAETNINGSSPIL + FASTE_SPIL:
    raise SystemExit('--spil skal vaere en af: ' + ', '.join(SAETNINGSSPIL + FASTE_SPIL))
MAPPE = 'bog' if SPIL == 'bog' else 'games/' + SPIL
UD = os.path.join(ROD, MAPPE, 'lyd')
MODEL = arg('--model', 'gemini-3.8-flash-tts')
STEMME = arg('--stemme', 'Kore')

# Stilen ligger i en note foran selve teksten. Skrives den som "Laes varmt: <tekst>", laeser
# stemmen ogsaa beskrivelsen hoejt, og et separat felt til stilen tager modellen ikke imod.
STIL = ("Voice: warm, calm, friendly female preschool teacher speaking to a six-year-old. "
        "Clear and slightly slow. Standard Danish pronunciation, no dialect.")
if SPIL == 'bogstaver':
    STIL += (" Single letters are said with their Danish alphabet names, the way Danish children learn the alphabet in school "
             "(A is \"a\", F is \"æf\", H is \"hå\", J is \"jåd\", K is \"kå\", Q is \"ku\", R is \"ær\", W is \"dobbelt-ve\", Z is \"sæt\"). "
             "Numbers are said as plain Danish number words.")
if SPIL == 'bog':
    STIL = ("Voice: warm, calm, friendly female storyteller reading a Danish picture book aloud to six-year-olds. "
            "Unhurried, with natural pauses between sentences and a little extra warmth in the rhymes. "
            "Standard Danish pronunciation, no dialect.")
NOTE = "### DIRECTOR'S NOTES\n" + STIL + "\n\n### TRANSCRIPT\n"


def saetninger():
    """Saetningerne fra spillets egen kode, via node."""
    if SPIL == 'have':
        kode = "const { Haven } = require(%r); console.log(JSON.stringify(Haven.saetninger()));" % os.path.join(ROD, 'games', 'have', 'js', 'haven.js')
    elif SPIL == 'tegn':
        kode = "const { Figurer } = require(%r); console.log(JSON.stringify(Figurer.saetninger()));" % os.path.join(ROD, 'games', 'tegn', 'js', 'figurer.js')
    elif SPIL == 'egern':
        kode = "const { Egern } = require(%r); console.log(JSON.stringify(Egern.saetninger()));" % os.path.join(ROD, 'games', 'egern', 'js', 'egern.js')
    elif SPIL == 'baever':
        kode = "const { Daemning } = require(%r); console.log(JSON.stringify(Daemning.saetninger()));" % os.path.join(ROD, 'games', 'baever', 'js', 'daemning.js')
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


def kald(tekst, note=None):
    """Tekst til Gemini. Svarer med (pcm, samplerate) eller rejser en fejl."""
    url = 'https://generativelanguage.googleapis.com/v1beta/models/%s:generateContent' % MODEL
    krop = {'contents': [{'parts': [{'text': (note or NOTE) + tekst}]}],
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
    # Der skaeres aldrig ord vaek: en kort lyd efter en lang pause kan vaere et rigtigt ord ("Klap ... det!").
    # Et klip med en lang pause (over 0,6 s) meldes i stedet, saa det kan lyttes igennem og laves om.
    huller = [b - a for a, b in zip(tale, tale[1:]) if b - a > 30]
    if huller:
        print('        OBS: lang pause i klippet (%.1f s); lyt efter, om det skal laves om' % (max(huller) * 0.02))
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
    # Bogens sider er op til 40 sekunder lange; med 40 kbit/s holder de sig under 200 KB, og tale lyder stadig rent
    k.set_bit_rate(40 if SPIL == 'bog' else 48); k.set_in_sample_rate(sr); k.set_channels(1); k.set_quality(2)
    ud = array.array('h', pcm)
    if sys.byteorder == 'big':
        ud.byteswap()
    return k.encode(ud.tobytes()) + k.flush()


class Stop(Exception):
    """Gemini har sagt stop laenge; koer igen senere."""


def vent_paa_gemini(krop, ventet):
    """Et 429-svar. Graensen pr. minut: vent og proev igen. Graensen pr. dag (100 kald til
    gemini-3.8-flash-tts, ogsaa med betaling): stop, og koer igen i morgen."""
    if 'PerDay' in krop and re.search(r'"retryDelay":\s*"(\d{4,})', krop):
        raise Stop()
    m = re.search(r'"retryDelay":\s*"(\d+)', krop)
    pause = min(int(m.group(1)) + 2 if m else 30, 120)
    if ventet > 1800:
        raise Stop()
    print('        venter %d s paa Gemini ...' % pause)
    time.sleep(pause)
    return pause



def lav_et(tekst, sti):
    """Lav ét klip og gem det som MP3 i sti. Venter selv, naar Gemini beder om det. Svarer med sekunderne."""
    forventet = 1.0 + len(tekst) * 0.085   # saa laenge taler hun cirka; meget laengere betyder, at noten kom med
    forsoeg, ventet = 0, 0
    while True:
        try:
            pcm, sr = kald(tekst)
            lydd, sek = klargoer(pcm, sr)
            if sek > forventet * 2.2 + 1.5:
                raise ValueError('%.1f s er for langt til teksten; noten blev nok laest op' % sek)
            data = mp3(lydd, sr)
            with open(sti, 'wb') as f:
                f.write(data)
            return sek
        except urllib.error.HTTPError as e:
            krop = e.read().decode('utf-8', 'replace')
            if e.code != 429:
                raise ValueError('HTTP %d: %s' % (e.code, krop[:300]))
            ventet += vent_paa_gemini(krop, ventet)
        except (ValueError, KeyError, IndexError) as e:
            forsoeg += 1
            if forsoeg == 3:
                raise ValueError(str(e))
            time.sleep(1)


PR_KALD = int(arg('--pr-kald', '12'))   # saetninger i ét kald; Gemini giver kun 100 kald om dagen
NOTE_FLERE = NOTE.replace("\n\n### TRANSCRIPT", " Read every line of the transcript as its own separate utterance, "
                          "and leave a long pause of about two seconds of silence after every line.\n\n### TRANSCRIPT")


def stilhed(a, sr):
    """Lydstyrken i blokke af 20 ms for samples i a."""
    blok = int(sr * 0.02)
    return blok, [(sum(x * x for x in a[i:i + blok]) / max(1, len(a[i:i + blok]))) ** 0.5 for i in range(0, len(a), blok)]


def del_op(pcm, sr, tekster):
    """Del en lang optagelse op ved de lange pauser, i praecis ét stykke pr. tekst.
    Svarer med en liste af PCM-stykker, eller None, hvis det ikke gaar op."""
    a = array.array('h', pcm)
    if sys.byteorder == 'big':
        a.byteswap()
    blok, rms = stilhed(a, sr)
    if not rms or max(rms) < 50:
        return None
    tale = [r > max(rms) * 0.03 for r in rms]
    # Pauserne: raekker af stille blokke mellem tale, som (start, laengde)
    pauser, i = [], 0
    while i < len(tale):
        if not tale[i]:
            j = i
            while j < len(tale) and not tale[j]:
                j += 1
            if i > 0 and j < len(tale):
                pauser.append((i, j - i))
            i = j
        else:
            i += 1
    n = len(tekster)
    if len(pauser) < n - 1:
        return None
    # De n-1 laengste pauser er skellene mellem linjerne; de skal vaere tydeligt laengere end resten
    laengst = sorted(pauser, key=lambda p: -p[1])
    skel = sorted(laengst[:n - 1])
    if n > 1:
        kortest_skel = laengst[n - 2][1]
        naeste = laengst[n - 1][1] if len(laengst) >= n else 0
        if kortest_skel * 0.02 < 1.0 or naeste > kortest_skel * 0.75:
            return None
    graenser = [0] + [(p[0] + p[1] // 2) * blok for p in skel] + [len(a)]
    stykker = [a[graenser[k]:graenser[k + 1]] for k in range(n)]
    # Laengderne skal passe nogenlunde til teksterne, ellers er noget blevet byttet om eller sprunget over
    forhold = []
    for st, t in zip(stykker, tekster):
        sek = sum(1 for r in stilhed(st, sr)[1] if r > max(rms) * 0.03) * 0.02
        forhold.append(sek / (0.6 + len(t) * 0.06))
    if max(forhold) > 2.2 * min(forhold):   # i den rigtige raekkefoelge ligger de inden for 1,5 af hinanden
        return None
    if sys.byteorder == 'big':
        for st in stykker:
            st.byteswap()
    return [st.tobytes() for st in stykker]


def lav_flere(opgaver, ventet=0):
    """Lav flere klip i ét kald: opgaver er (tekst, sti). Gaar opdelingen ikke op, deles
    opgaverne i to og proeves igen, ned til ét ad gangen. Svarer med (lavet, fejl)."""
    if len(opgaver) == 1:
        t, sti = opgaver[0]
        try:
            return [(t, sti, lav_et(t, sti))], []
        except ValueError as e:
            return [], [(t, sti, str(e))]
    tekster = [t for t, _ in opgaver]
    while True:
        try:
            pcm, sr = kald('\n\n'.join(tekster), NOTE_FLERE)
            break
        except urllib.error.HTTPError as e:
            krop = e.read().decode('utf-8', 'replace')
            if e.code != 429:
                return [], [(t, sti, 'HTTP %d: %s' % (e.code, krop[:200])) for t, sti in opgaver]
            ventet += vent_paa_gemini(krop, ventet)
        except (ValueError, KeyError, IndexError) as e:
            pcm = None
            break
    stykker = del_op(pcm, sr, tekster) if pcm else None
    if stykker is None:
        halv = len(opgaver) // 2
        print('        %d linjer i ét kald gik ikke op; proever %d og %d' % (len(opgaver), halv, len(opgaver) - halv))
        a1, f1 = lav_flere(opgaver[:halv])
        a2, f2 = lav_flere(opgaver[halv:])
        return a1 + a2, f1 + f2
    lavet, fejl = [], []
    for (t, sti), st in zip(opgaver, stykker):
        try:
            lydd, sek = klargoer(st, sr)
            with open(sti, 'wb') as f:
                f.write(mp3(lydd, sr))
            lavet.append((t, sti, sek))
        except ValueError as e:
            fejl.append((t, sti, str(e)))
    return lavet, fejl


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
    # Ogsaa den sidste linje i FILER, som ikke har komma; ellers kom den med to gange, og addAll afviser dubletter
    s = re.sub(r"  '%s/lyd/[^']+\.mp3',?\n" % MAPPE, '', s)
    linjer = ''.join("  '%s/lyd/%s',\n" % (MAPPE, f) for f in sorted(brugt))
    anker = "  '%s/lyd/klip.json',\n" % MAPPE
    if anker not in s:
        raise SystemExit('Tilfoej %s i FILER i sw.js foerst.' % anker.strip())
    s = s.replace(anker, anker + linjer)
    s = re.sub(r"',\n\];", "'\n];", s)
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
    for k in range(0, len(opgaver), PR_KALD):
        bundt = [(t, os.path.join(UD, filnavn(t))) for t in opgaver[k:k + PR_KALD]]
        try:
            ok, f = lav_flere(bundt)
        except Stop:
            print('Gemini har brugt dagens kald (100 om dagen for denne model). Koer igen i morgen; de klip, der er lavet, bliver liggende.')
            break
        for t, sti, sek in ok:
            lavet += 1
            print('  %3d/%d %4.1f s  %s' % (lavet, len(opgaver), sek, t))
        fejl += [(t, e) for t, sti, e in f]
    antal = registrer(liste)
    print('%d klip lavet, %d i klip.json.' % (lavet, antal))
    for t, f in fejl:
        print('  FEJL %s: %s' % (t, f))
    print('Husk: npm test, tael VERSION op i sw.js, commit.')



def el():
    """lav-lyd-elevenlabs.py har listerne over de faste spils klip; de bruges herfra, saa de kun findes ét sted."""
    import importlib.util
    spec = importlib.util.spec_from_file_location('lav_lyd_elevenlabs', os.path.join(ROD, 'vaerktoej', 'lav-lyd-elevenlabs.py'))
    m = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(m)
    return m


def node_json(kode):
    return json.loads(subprocess.check_output(['node', '-e', kode]))


BOGSTAV = {'AE': 'Æ', 'OE': 'Ø', 'AA': 'Å'}
# Bogstaver, som stemmen siger forkert, skrives, som de udtales. "F." blev til "fem".
UDTALE = {'F': 'Æf'}
TALORD = ['Nul', 'En', 'To', 'Tre', 'Fire', 'Fem', 'Seks', 'Syv', 'Otte', 'Ni']


def faste_klip():
    """(fil, tekst) for hvert klip i de faste spil. Filnavnene er dem, spillene allerede bruger."""
    E = el()
    if SPIL == 'bogstaver':
        ud = [('bogstav_%s.mp3' % n, UDTALE.get(n, BOGSTAV.get(n, n)) + '.') for n in E.NAVNE]    # rent bogstav
        ud += [('tal_%d.mp3' % i, t + '.') for i, t in enumerate(TALORD)]                             # rent tal
        ud += [('ord_%s.mp3' % fil, 'Her har du ordet %s.' % ord) for ord, fil in E.ting()]          # ordet i sin ramme
        ud += [('plus.mp3', 'Plus.'), ('minus.mp3', 'Minus.'), ('er_lig_med.mp3', 'Er lig med.')]
        ud += [('spoerg_%s.mp3' % n, 'Hvad starter med %s?' % BOGSTAV.get(n, n)) for n in E.NAVNE]
        return ud
    if SPIL == 'restaurant':
        return E.restaurant()
    if SPIL == 'klokken':
        return E.klokken()
    if SPIL == 'maskinen':
        return E.maskinen()
    if SPIL == 'bog':
        return E.bog()
    if SPIL == 'find':
        d = node_json("const { Find } = require(%r); const ud = [];"
                      "Object.keys(Find.KLIP).forEach(k => ud.push(Find.KLIP[k]));"
                      "Object.keys(Find.KATEGORIER).forEach(k => ud.push([Find.KATEGORIER[k].klip, Find.KATEGORIER[k].tekst]));"
                      "console.log(JSON.stringify(ud));" % os.path.join(ROD, 'games', 'find', 'js', 'find.js'))
        return [(f.replace('lyd/', ''), t) for f, t in d]
    if SPIL == 'rim':
        d = node_json("const { Rim } = require(%r); const ud = [];"
                      "Object.keys(Rim.KLIP).forEach(k => ud.push(Rim.KLIP[k]));"
                      "Rim.ALLE.forEach(o => { if (o.klip.indexOf('lyd/') === 0) ud.push([o.klip, Rim.ORDET + o.ord + '.']); });"
                      "console.log(JSON.stringify(ud));" % os.path.join(ROD, 'games', 'rim', 'js', 'rim.js'))
        return [(f.replace('lyd/', ''), t) for f, t in d]
    raise SystemExit('Ukendt spil')


def lav_faste():
    """Lav de faste spils klip om i de samme filer. Husker, hvor langt den naaede, hvis den bliver afbrudt."""
    import tempfile
    liste = faste_klip()
    kun = arg('--kun')
    if kun:
        liste = [(f, t) for f, t in liste if kun in t or kun in f]
    husk = os.path.join(tempfile.gettempdir(), 'lav-lyd-gemini-%s.json' % SPIL)
    lavet = set(json.load(open(husk))) if os.path.exists(husk) and not kun else set()
    opgaver = [(f, t) for f, t in liste if f not in lavet]
    print('%s: %d klip, %d skal laves (%d tegn). Model %s, stemmen %s.' % (SPIL, len(liste), len(opgaver), sum(len(t) for f, t in opgaver), MODEL, STEMME))
    if '--proev' in sys.argv:
        for f, t in opgaver:
            print('  %-24s %s' % (f, t))
        return
    fandtes = set(os.listdir(UD)) if os.path.isdir(UD) else set()
    fejl, nr = [], 0
    for k in range(0, len(opgaver), PR_KALD):
        bundt = opgaver[k:k + PR_KALD]
        try:
            ok, fl = lav_flere([(t, os.path.join(UD, f)) for f, t in bundt])
        except Stop:
            print('Gemini har brugt dagens kald (100 om dagen for denne model). Koer igen i morgen; den fortsaetter, hvor den slap.')
            return
        for t, sti, sek in ok:
            nr += 1
            lavet.add(os.path.basename(sti))
            print('  %3d/%d %4.1f s  %-22s %s' % (nr, len(opgaver), sek, os.path.basename(sti), t))
        if not kun:
            json.dump(sorted(lavet), open(husk, 'w'))
        fejl += [(os.path.basename(sti), e) for t, sti, e in fl]
    nye = sorted(f for f, t in liste if f not in fandtes and os.path.exists(os.path.join(UD, f)))
    if nye and os.path.exists(os.path.join(UD, 'klip.json')):
        # Nye filer skal i klip.json og i FILER i sw.js; de gamle ligger der allerede
        klip = sorted(x for x in os.listdir(UD) if x.endswith('.mp3'))
        json.dump(klip, open(os.path.join(UD, 'klip.json'), 'w'), indent=0)
        p = os.path.join(ROD, 'sw.js')
        s = open(p, encoding='utf-8').read()
        anker = "  '%s/lyd/klip.json',\n" % MAPPE
        s = s.replace(anker, anker + ''.join("  '%s/lyd/%s',\n" % (MAPPE, x) for x in nye))
        open(p, 'w', encoding='utf-8').write(s)
        print('%d nye klip lagt i klip.json og sw.js: %s' % (len(nye), ', '.join(nye)))
    if not fejl and not kun and os.path.exists(husk):
        os.remove(husk)
    print('%d klip lavet i %s.' % (len(opgaver) - len(fejl), MAPPE + '/lyd'))
    for f, e in fejl:
        print('  FEJL %s: %s' % (f, e))
    print('Husk: npm test, tael VERSION op i sw.js, commit.')


if __name__ == '__main__':
    if SPIL in FASTE_SPIL:
        lav_faste()
    elif '--registrer' in sys.argv:
        print('%d klip i klip.json og sw.js.' % registrer())
    else:
        lav()
