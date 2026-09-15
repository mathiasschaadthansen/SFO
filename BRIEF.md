# Brief: SFO Spil

Mine egne inputs til projektet, samlet. Læs sammen med CLAUDE.md og README.md.

## Formål

Jeg vil bygge nogle børnevenlige spil til et fritidshjem/SFO, som de kan have
på deres iPads.

Jeg bygger det **gratis** til dem. Baggrunden er, at de i dag har en del spil
med en masse reklamer gemt i sig, hvilket jeg ikke synes er passende for
børnene. Jeg vil give dem et bedre alternativ.

## Målgruppe

6-årige til at starte med.

## Hvilke spil jeg vil have

Jeg synes ikke rolige spil som memory, lyt-og-find, bogstav- og tælleøvelser
er sjove nok — de er for kedelige. Jeg tænker mere i retning af rigtige
arkadespil:

- Slime Soccer
- Bomberman
- Bubble Struggle
- Mario

Mario nævnte jeg kun på grund af **stilen**, ikke figurerne.

Jeg har vedhæftet et skærmbillede af en Slime Soccer-remake som eksempel på
den slags spil jeg mener.

Peddersen og Findus-spillene (Pettsons uppfinningar) er også gode: man skal
sætte en kædereaktion korrekt sammen for at løse en bane/gåde.

Jeg har også spurgt om man kan bygge noget i stil med DR Ramasjangs
**Mus & Kran** — den håndtegnede havneverden med mini-spil.

**Første spil: et simpelt racerspil.** Det er det vi er gået i gang med.

## Tekniske ønsker

Det skal ligge i **GitHub**, og jeg vil arbejde i **Codespaces** med
**Claude Code** derfra.

## Rammer jeg har accepteret undervejs

Disse er begrundelser, ikke bare regler — de er hele pointen med projektet.

- **PWA, ikke native app.** Skole-iPads er MDM-styret, så pædagogerne kan
  ikke selv installere apps. En web clip kan IT pushe ud til alle enheder
  på én gang.
- **Ingen netværkskald, ingen login, ingen analytics.** Så er der ingen
  personoplysninger, og dermed ingen databehandleraftale. Det er også det
  argument der virker over for en skoleleder.
- **Skal virke offline.** Dårligt wifi i SFO'en må ikke vælte det.
- **Ingen ophavsretsligt materiale.** Ingen Mario, ingen Bomberman, ingen
  Mus & Kran-figurer. Mekanik er frit, figurer og navne er ikke.
- **Jeg beholder ejerskabet.** Det ligger på mit eget domæne, så det kan
  genbruges til andre institutioner.
- **Indholdet skal kunne udskiftes.** Datadrevet, så en anden SFO kan få sin
  egen version ved at skifte en mappe ud. Gerne så børnene selv kan tegne
  eller fotografere indholdet.

## Sådan vil jeg have hjælpen

- Direkte svar uden en masse forbehold.
- Udfordr mine antagelser i stedet for at give mig ret.
- Byg videre på det der allerede er, frem for at starte forfra.
