#!/usr/bin/env python3
"""
Laver stemmeklip til Bogstaver med ElevenLabs — én gang, paa din computer.
Klippene lægges i games/bogstaver/lyd/, klip.json opdateres, og sw.js faar
filerne ind i FILER. Spillet kalder aldrig ElevenLabs; det spiller bare filerne.

Foerste gang:
    export ELEVENLABS_API_KEY=...          (din noegle, aldrig i repoet)
    python3 vaerktoej/lav-lyd-elevenlabs.py --stemmer        # find en dansk kvindestemme, kopier dens id
    python3 vaerktoej/lav-lyd-elevenlabs.py --stemme <id> --kun bogstaver
Lyt til de 29 bogstaver i games/bogstaver/lyd/. Driller et navn, ret det i
NAVNE nedenfor og koer igen med --alle. Naar bogstaverne er gode:
    python3 vaerktoej/lav-lyd-elevenlabs.py --stemme <id>
Bagefter: npm test, tael VERSION op i sw.js, commit.

Valg:
    --tilfoej <id>   laeg en stemme fra biblioteket ind paa din konto (API'et kan kun bruge "My Voices")
    --model <navn>   eleven_turbo_v2_5 (standard, tvinger dansk) eller eleven_multilingual_v2
    --kun bogstaver|tal|ord|spoerg|regn
    --alle           lav ogsaa klip der findes i forvejen
    --registrer      lav ikke noget, men skriv klip.json og sw.js ud fra de mp3-filer der ligger i lyd/
                     (bruges naar klippene er lavet et andet sted, fx i en Claude-chat med ElevenLabs)
    --spil <navn>    bogstaver (standard), restaurant, klokken, maskinen eller bog (Bogen om Noeddeskoven, bog/lyd/)
    --proev          vis hvad der ville blive lavet, uden at kalde ElevenLabs
"""
import json, os, re, sys, time, urllib.parse, urllib.request, urllib.error

ROD = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
SPIL = sys.argv[sys.argv.index('--spil') + 1] if '--spil' in sys.argv else 'bogstaver'   # bogstaver | restaurant | klokken | maskinen | bog
MAPPE = 'bog' if SPIL == 'bog' else 'games/' + SPIL      # bogen ligger ikke under games/
UD = os.path.join(ROD, MAPPE, 'lyd')
API = 'https://api.elevenlabs.io/v1'

# Bogstavernes navne som de siges. Ret her hvis et navn udtales forkert.
NAVNE = {
    'A': 'a', 'B': 'be', 'C': 'se', 'D': 'de', 'E': 'e', 'F': 'æf', 'G': 'ge', 'H': 'hå', 'I': 'i', 'J': 'jåd',
    'K': 'kå', 'L': 'æl', 'M': 'æm', 'N': 'æn', 'O': 'o', 'P': 'pe', 'Q': 'ku', 'R': 'ær', 'S': 'æs', 'T': 'te',
    'U': 'u', 'V': 've', 'W': 'dobbelt-ve', 'X': 'æks', 'Y': 'y', 'Z': 'sæt', 'AE': 'æ', 'OE': 'ø', 'AA': 'å'
}
TAL = ['nul', 'en', 'to', 'tre', 'fire', 'fem', 'seks', 'syv', 'otte', 'ni']


def arg(navn, standard=None):
    return sys.argv[sys.argv.index(navn) + 1] if navn in sys.argv else standard


def ting():
    """Ord og filnavne fra ting.js, laest via node saa listen kun findes ét sted."""
    import subprocess
    kode = (
        "const { Ting } = require(%r); const { Glyffer } = require(%r);"
        "const ud = []; Glyffer.BOGSTAVER.forEach(n => (Ting.TING[n] || []).forEach(t => {"
        "const fil = t.fil ? t.fil.replace('ting/', '').replace('.svg', '') : ({'xylofon': 'xylofon', 'ål': 'aal'})[t.ord];"
        "ud.push([t.ord, fil]); })); console.log(JSON.stringify(ud));"
    ) % (os.path.join(ROD, 'games', 'bogstaver', 'js', 'ting.js'), os.path.join(ROD, 'games', 'bogstaver', 'js', 'glyffer.js'))
    return json.loads(subprocess.check_output(['node', '-e', kode]))


def restaurant():
    """Bestillingerne fra koekken.js, laest via node saa listen kun findes ét sted."""
    import subprocess
    kode = ("const { Koekken: K } = require(%r);"
            "const ud = K.BESTILLINGER.map(b => ['bestil_' + b.id + '.mp3', K.saetning(b)]);"
            "Object.keys(K.INGREDIENSER).forEach(t => ud.push(['ting', t, K.INGREDIENSER[t].navn, K.KILDER[K.kildeFor(t)].navn]));"
            "console.log(JSON.stringify(ud));"
            ) % os.path.join(ROD, 'games', 'restaurant', 'js', 'koekken.js')
    raa = json.loads(subprocess.check_output(['node', '-e', kode]))
    # Bestemt form, saa stemmen kan spoerge "Hvor kommer osten fra?" (samme tabel som BESTEMT i game.js)
    bestemt = {'ost': 'osten', 'tomat': 'tomaten', 'champignon': 'champignonen', 'peberfrugt': 'peberfrugten', 'ananas': 'ananassen',
               'oliven': 'olivenerne', 'boef': 'bøffen', 'salat': 'salaten', 'agurk': 'agurken', 'bacon': 'baconen', 'jordbaer': 'jordbærrene',
               'banan': 'bananen', 'blaabaer': 'blåbærrene', 'chokolade': 'chokoladen', 'honning': 'honningen', 'smoer': 'smørret'}
    ud = [tuple(x) for x in raa if x[0] != 'ting']
    for x in raa:
        if x[0] != 'ting':
            continue
        t, kilde = x[1], x[3]
        b = bestemt.get(t, x[2])
        ud.append(('hvor_%s.mp3' % t, 'Hvor kommer %s fra?' % b))
        ud.append(('fra_%s.mp3' % t, 'Ja! %s kommer fra %s.' % (b[0].upper() + b[1:], kilde)))
    return ud + [
        ('tak_1.mp3', 'Mmm, tak!'), ('tak_2.mp3', 'Det smager dejligt!'), ('tak_3.mp3', 'Tusind tak!'),
        ('ups.mp3', 'Ups, det bestilte jeg ikke.'), ('dag.mp3', 'Sikke en god dag i restauranten!'), ('fri.mp3', 'Overrask mig!'),
        ('regning.mp3', 'Hvad koster det?')]


def klokken():
    """Klippene til Klokken: tiderne, musens spoergsmaal og dagens goeremaal fra ur.js."""
    import subprocess
    kode = ("const { Ur: U } = require(%r);"
            "const ud = [];"
            "for (let h = 1; h <= 12; h++) { ud.push(['klokken_' + h + '.mp3', 'Klokken ' + U.TIMEORD[h %% 12] + '.']); ud.push(['halv_' + h + '.mp3', 'Halv ' + U.TIMEORD[h %% 12] + '.']); }"
            "U.DAGEN.forEach(d => ud.push(['goer_' + d.kort + '.mp3', d.tekst]));"
            "U.DAGEN.forEach(d => ud.push(['drej_' + d.kort + '.mp3', 'Drej jorden, til ' + d.tekst[0].toLowerCase() + d.tekst.slice(1)]));"
            "Object.keys(U.HIMMELORD).forEach(h => ud.push(['om_' + h + '.mp3', U.HIMMELORD[h] + '.']));"
            "console.log(JSON.stringify(ud));"
            ) % os.path.join(ROD, 'games', 'klokken', 'js', 'ur.js')
    ud = [tuple(x) for x in json.loads(subprocess.check_output(['node', '-e', kode]))]
    return ud + [
        ('stil_uret.mp3', 'Stil uret på'), ('hvad_goer.mp3', 'Hvad gør musen'),
        ('hvad_klokken.mp3', 'Hvad er klokken?'),
        ('flot_1.mp3', 'Flot!'), ('flot_2.mp3', 'Sådan!'), ('flot_3.mp3', 'Rigtigt!'),
        ('naesten.mp3', 'Næsten!'), ('rejse.mp3', 'Sikke en rumrejse!')]


def maskinen():
    """De faa klip, Maskinen bruger. Resten af lyden er toner fra oscillatorer."""
    return [('opgave.mp3', 'Kan du få kuglen ned til klokken?'), ('igen.mp3', 'Prøv igen!'),
            ('flot_1.mp3', 'Flot!'), ('flot_2.mp3', 'Sådan! Maskinen virker!'),
            ('kap_skoven.mp3', 'Nu er vi i skoven.'), ('kap_soeen.mp3', 'Nu er vi ved søen.'),
            ('kap_vinter.mp3', 'Nu er det vinter.'), ('kap_natten.mp3', 'Nu er det nat.'),
            ('del_kanon.mp3', 'Kanonen skyder kuglen af sted!'), ('del_tragt.mp3', 'Tragten fanger kuglen.')]


def bog():
    """Bogen om Noeddeskoven: ét klip pr. opslag, teksten og rimet i én omgang, laest fra bog.js.
    Bogstavnavne skrives, som de siges (æn, pe, æs), og "..." bliver til en laengere pause."""
    import subprocess
    kode = ("const { Bog } = require(%r);"
            "console.log(JSON.stringify(Bog.OPSLAG.map(o => [o.id + '.mp3', o.tekst.join(' ') + ' … ' + o.rim.join(' ')])));"
            ) % os.path.join(ROD, 'bog', 'js', 'bog.js')
    ret = [('...', '…'), ('N som i nøgle', 'Æn som i nøgle'), ('et stort N', 'et stort æn'), ('P som i Pelle', 'Pe som i Pelle'),
           ('S som i …', 'Æs som i …'), ('Ulla skriver N og P,', 'Ulla skriver æn og pe,')]
    ud = []
    for fil, tekst in json.loads(subprocess.check_output(['node', '-e', kode])):
        for a, b in ret:
            tekst = tekst.replace(a, b)
        ud.append((fil, tekst))
    return ud


def opgaver(kun):
    if SPIL == 'bog':
        return bog()
    if SPIL == 'maskinen':
        return maskinen()
    if SPIL == 'restaurant':
        return restaurant()
    if SPIL == 'klokken':
        return klokken()
    ud = []
    if kun in (None, 'bogstaver'):
        ud += [('bogstav_%s.mp3' % n, t) for n, t in NAVNE.items()]
    if kun in (None, 'tal'):
        ud += [('tal_%d.mp3' % i, t) for i, t in enumerate(TAL)]
    if kun in (None, 'ord'):
        ud += [('ord_%s.mp3' % fil, ord) for ord, fil in ting()]
    if kun in (None, 'regn'):
        ud += [('plus.mp3', 'plus'), ('minus.mp3', 'minus'), ('er_lig_med.mp3', 'er lig med')]
    if kun in (None, 'spoerg'):
        ud += [('spoerg_%s.mp3' % n, 'Hvad starter med %s?' % t) for n, t in NAVNE.items()]
    return ud


def kald(sti, data=None, noegle=None):
    req = urllib.request.Request(API + sti, data=json.dumps(data).encode() if data else None,
                                 headers={'xi-api-key': noegle, 'Content-Type': 'application/json', 'Accept': 'audio/mpeg, application/json'})
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.read()
    except urllib.error.HTTPError as e:
        raise SystemExit('ElevenLabs svarede %d paa %s: %s' % (e.code, sti, e.read().decode()[:300]))


def tilfoej(noegle, stemme_id):
    """Find stemmen i det offentlige bibliotek og laeg den ind under My Voices."""
    d = json.loads(kald('/shared-voices?page_size=100&search=' + urllib.parse.quote(stemme_id), noegle=noegle))
    fund = [v for v in d.get('voices', []) if v.get('voice_id') == stemme_id]
    if not fund:
        # Soegning paa id giver ikke altid traef; proev at hente hele listen med danske stemmer
        d = json.loads(kald('/shared-voices?page_size=100&language=da', noegle=noegle))
        fund = [v for v in d.get('voices', []) if v.get('voice_id') == stemme_id]
    if not fund:
        raise SystemExit('Fandt ikke stemmen %s i biblioteket. Tjek id\'et paa elevenlabs.io under Voices > Library.' % stemme_id)
    v = fund[0]
    svar = kald('/voices/add/%s/%s' % (v['public_owner_id'], v['voice_id']), {'new_name': v.get('name', 'Stemme')}, noegle)
    print('Lagt ind: %s (%s). Svar: %s' % (v.get('name'), v['voice_id'], svar.decode()[:120]))
    print('Brug den nu med --stemme %s' % v['voice_id'])


def stemmer(noegle):
    d = json.loads(kald('/voices', noegle=noegle))
    print('Stemmer paa kontoen (navn, id, sprog/koen hvis oplyst):')
    for v in d.get('voices', []):
        lab = v.get('labels', {}) or {}
        print('  %-24s %s  %s %s' % (v['name'], v['voice_id'], lab.get('language', ''), lab.get('gender', '')))
    print('\nFlere stemmer: Voices > Library paa elevenlabs.io, soeg "Danish", tilfoej til My Voices, koer igen.')


def lav(noegle, stemme, model, kun, alle, proev):
    os.makedirs(UD, exist_ok=True)
    liste = opgaver(kun)
    krop_std = {'model_id': model, 'voice_settings': {'stability': 0.6, 'similarity_boost': 0.8, 'style': 0.0, 'use_speaker_boost': True}}
    if 'multilingual_v2' not in model:
        krop_std['language_code'] = 'da'
    lavet, sprunget, tegn = 0, 0, 0
    for fil, tekst in liste:
        sti = os.path.join(UD, fil)
        if os.path.exists(sti) and not alle:
            sprunget += 1
            continue
        tegn += len(tekst)
        if proev:
            print('  ville lave %-22s "%s"' % (fil, tekst))
            continue
        lyd = kald('/text-to-speech/%s?output_format=mp3_22050_32' % stemme, dict(krop_std, text=tekst), noegle)
        with open(sti, 'wb') as f:
            f.write(lyd)
        lavet += 1
        print('  %-22s "%s"  %d KB' % (fil, tekst, len(lyd) // 1024))
        time.sleep(0.4)   # gratis-planen taaler ikke mange kald i traek
    if proev:
        print('%d klip ville blive lavet (%d tegn), %d findes i forvejen' % (len(liste) - sprunget, tegn, sprunget))
        return
    antalKlip = registrer()
    print('%d klip lavet, %d sprunget over, %d tegn brugt. %d klip i klip.json og sw.js.' % (lavet, sprunget, tegn, antalKlip))
    print('Husk: npm test, tael VERSION op i sw.js, commit.')


def registrer():
    """Skriv klip.json og FILER i sw.js ud fra de mp3-filer der ligger i lyd/."""
    klip = sorted(f for f in os.listdir(UD) if f.endswith('.mp3'))
    json.dump(klip, open(os.path.join(UD, 'klip.json'), 'w'), indent=0)
    p = os.path.join(ROD, 'sw.js')
    s = open(p, encoding='utf-8').read()
    s = re.sub(r"  '%s/lyd/[^']+\.mp3',\n" % MAPPE, '', s)
    linjer = ''.join("  '%s/lyd/%s',\n" % (MAPPE, f) for f in klip)
    s = s.replace("  '%s/lyd/klip.json',\n" % MAPPE, "  '%s/lyd/klip.json',\n" % MAPPE + linjer)
    open(p, 'w', encoding='utf-8').write(s)
    forventet = set(f for f, _ in opgaver(None))
    mangler = sorted(forventet - set(klip))
    if mangler:
        print('%d klip mangler stadig (bruger enhedens stemme): %s%s' % (len(mangler), ', '.join(mangler[:8]), ' ...' if len(mangler) > 8 else ''))
    return len(klip)


if __name__ == '__main__':
    proev = '--proev' in sys.argv
    noegle = os.environ.get('ELEVENLABS_API_KEY')
    if not noegle and not proev and '--registrer' not in sys.argv:
        raise SystemExit('Saet ELEVENLABS_API_KEY foerst: export ELEVENLABS_API_KEY=...')
    if '--registrer' in sys.argv:
        print('%d klip i klip.json og sw.js. Husk: npm test, tael VERSION op i sw.js, commit.' % registrer())
    elif '--stemmer' in sys.argv:
        stemmer(noegle)
    elif '--tilfoej' in sys.argv:
        tilfoej(noegle, arg('--tilfoej'))
    else:
        stemme = arg('--stemme')
        if not stemme and not proev:
            raise SystemExit('Angiv --stemme <voice id>. Find den med --stemmer.')
        lav(noegle, stemme, arg('--model', 'eleven_turbo_v2_5'), arg('--kun'), '--alle' in sys.argv, proev)
