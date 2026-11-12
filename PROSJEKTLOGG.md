# Prosjektlogg – Bremsesimulator for lastebil

Prosjektloggen beskriver hva som er bestilt, hvilke valg som er tatt, hva som er laget og hvordan det er testet. Den bygger på samtalen mellom bruker og Claude (Claude Code) 11. november 2026.

| | |
|---|---|
| **Repo** | https://github.com/seiknes-ui/kkvm |
| **Kode** | `lastebil_brems/` |
| **Formål** | Opplæring til førerkort C/CE: forstå trykkluftbremsene på lastebil og tilhenger |
| **Teknologi** | Python 3 med tkinter (bare standardbiblioteket) |
| **Status** | Ferdig og pushet. 18 av 18 tester bestått. |

---

## 1. Bestilling og avklaringer

**Opprinnelig ønske:** «Kan du lage en fungerende modell av bremsesystemet på en lastebil. Still meg spørsmål.»

Claude stilte fire spørsmål. Svarene ble:

| Spørsmål | Svar |
|---|---|
| Hva skal modellen brukes til? | Opplæring (førerkort C/CE) |
| Hvilken form? | Python-simulering |
| Hvilke deler? | Luftforsyning, driftsbrems og fjærbrems |
| Hvor realistisk fysikk? | Middels: realistiske trykk, fylletid, lekkasje og varsellampe |

Senere bestillinger:
1. Legg til tilhengerbremsen.
2. Post til GitHub-repoet `seiknes-ui/kkvm`.
3. Lag tilhengerbremsen med fjærbrems og alle funksjonene.
4. Lag en prosjektfil (tolket som `pyproject.toml`).
5. Lag en prosjektfil som beskriver samtalen og hva som er gjort (denne filen).

---

## 2. Tidslinje

| # | Bestilling / hendelse | Hva ble gjort | Commit |
|---|---|---|---|
| 1 | Fungerende modell av bremsesystemet | Spørsmål om formål, format, omfang og detaljnivå. | – |
| 2 | Python fantes ikke på PC-en | Koden ble skrevet først. Med brukerens godkjenning ble Python 3.12.10 installert med `winget` (bare for brukeren). | – |
| 3 | Første versjon | Fysikkmodell, GUI og 10 tester. Kompressorytelsen ble justert opp (fylletid fra 386 s til 264 s), og «stor lekkasje» ble gjort kraftigere, så firekretsventil-testen virket. | – |
| 4 | Røyktest av GUI | Skjermen er skalert til 150 % (1280×720 logisk), og vinduet var for høyt. Layouten ble gjort kompakt med faner (Betjening / Feil / Øvelser). | – |
| 5 | «Legg til tilhengerbremsen» | Claude spurte om type tilhenger og funksjoner. Brukeren ville avklare først. | – |
| 6 | «Post til GitHub» | Git-repo opprettet. Brukeren valgte selv navn og e-post for commits. Pushet til `main`. | `7471512` |
| 7 | «Tilhengerbrems med fjærbrems og alle funksjonene» | Tilhenger, koblinger, knapper, kontrollstilling, trekkbilbeskyttelse, 5 nye øvelser og 8 nye tester. Layouten justert igjen så alt får plass. | `1dd47d8` |
| 8 | Samme bestilling gjentatt to ganger | Claude sjekket og bekreftet at tilhengeren allerede var laget og pushet, og ba om avklaring. | – |
| 9 | «Push til git» | Ingenting nytt å pushe. Lokal `main` var lik `origin/main`. | – |
| 10 | «Lag en prosjektfil» | `pyproject.toml` med kommandoen `bremsesimulator` og oppsett for pytest. Testet i et eget miljø (venv). | `1910643` |
| 11 | «Push to git» | Ingenting nytt å pushe. | – |
| 12 | Prosjektlogg | Denne filen. | `bf092d3` |
| 13 | «Push til git» | Ingenting nytt å pushe. | – |
| 14 | «Pull fra git» | Hentet tre commits brukeren hadde laget utenom denne samtalen: oppskrift for frittstående exe med PyInstaller, nettversjon i `web/` og elevrapport. | `3dcee5c`, `a889340`, `015868d` |
| 15 | «Kjør nettversjonen» | JS-testene kjørt (18/18), og siden er åpnet i nettleseren. Sjekket med en Edge uten vindu at den vises. | – |
| 16 | Modul: bremseklokke i aksjon | Nytt kort i nettversjonen med gjennomskåret bremseklokke, bremsearm og bremsetrommel som følger simulatoren. Ny fagstoff-oppføring. | (se git-loggen) |

---

## 3. Hva er laget

### Filer

| Fil | Innhold |
|---|---|
| `lastebil_brems/bremsemodell.py` | Fysikkmodellen. Ingen GUI, kan testes alene. |
| `lastebil_brems/bremsesimulator.py` | Det grafiske programmet (tkinter): skjema, manometer, lamper, graf, logg, faner og øvelser. |
| `lastebil_brems/test_bremsemodell.py` | 18 tester. Kjøres med `python test_bremsemodell.py` eller `pytest`. |
| `lastebil_brems/pyproject.toml` | Prosjektfil for Python: installasjon, kommandoen `bremsesimulator` og pytest-oppsett. |
| `lastebil_brems/README.md` | Brukerveiledning. |
| `.gitignore` | Holder midlertidige filer fra Python, pytest og installasjon utenfor git. |
| `PROSJEKTLOGG.md` | Denne filen. |
| `web/` | Nettversjonen (HTML/CSS/JS), med samme fysikkmodell, oppdrag, test, elevrapport og bremseklokke-modulen. Se `web/README.md`. |

### Bremseklokke i aksjon (nettversjonen)

Et animert, gjennomskåret bilde av en bremseklokke, rett under «Vogntoget». Bildet følger trykkene i simulatoren:

- **Fjærbremsdel:** fjæren presses sammen når det er luft bak stempelet, og strekker seg ut når lufta forsvinner (parkering eller nødbrems).
- **Driftsbremsdel:** lufta presser membranen mot returfjæren og skyver trykkstangen ut.
- **Trykkstang, bremsearm (slakkjusterer) og kamaksel:** bremsearmen dreies etter slaglengden.
- **Bremsetrommel:** S-kammen presser bakkene ut. Halve slaget tar opp klaringen, og deretter bygges kraften opp. Trommelen gløder etter bremsekraften.
- **Valg:** kombisylinder bak, membransylinder foran eller tilhengerens kombisylinder.
- **Avlesning og forklaring:** trykk, slaglengde (ca. 0–60 mm) og bremsekraft, med en tekst som forklarer hva som skjer. Inkludert overbelastningsvernet når fjær og luft virker samtidig.

### Komponenter i modellen

**Trekkbil**
- **Kompressor:** ytelsen øker med turtallet og synker når trykket stiger.
- **Regulator og lufttørker:** kutter ut ved 10,0 bar og inn ved 8,5 bar. Er tørkeren defekt, samler det seg vann i tankene.
- **Firekretsventil:** krets 1 og 2 fylles først. En lekkasje i én krets tømmer ikke de andre.
- **Krets 1 og 2:** fotbremsventil med to kretser til bremsesylindrene foran, og via reléventil til kombisylindrene bak.
- **Krets 3:** håndbremsventil og relé til fjærbremsdelen. Fjærbremsen er helt løst over ca. 5,5 bar og helt på under ca. 2 bar.
- **Krets 4:** tilleggsutstyr.
- **Varsellampe:** tennes under 5,5 bar i krets 1 eller 2.

**Tilhengerbremsen**
- **Tilhengerstyreventil:** får luft fra krets 3 via en overstrømningsventil (6–7 bar), så tilhengeren ikke tapper trekkbilen.
- **Rød ledning (forsyning):** maks 8,5 bar.
- **Gul ledning (styreledning):** følger fotbremsen, og håndbremsen i parkeringsstilling.
- **Kontrollstilling:** løser tilhengerens bremser, så du kan sjekke at trekkbilen alene holder vogntoget.
- **Trekkbilbeskyttelse:** bygger ikke gul ledning trykk når du bremser, luftes rød ledning ut etter ca. 1 s, og tilhengeren nødbremser.
- **Tilhenger:** nødrelé, tank på 60 liter, bremsesylindre og fjærbrems.
  - Nødbremsen slår inn når rød ledning faller under ca. 5 bar (helt på under 2,5 bar).
  - **Rød knapp:** parkeringsbrems (fjærbrems).
  - **Sort knapp:** løser nødbremsen ved skifting, og spretter ut når rød ledning får trykk.
- **Koblinger:** rød og gul kobles hver for seg. Loggen advarer ved feil rekkefølge (koble til: gul, så rød; koble fra: rød, så gul).

**Feil som kan simuleres:** lekkasje i krets 1–4, i bremsesylinderen bak (merkes bare ved bremsing), i rød og gul ledning og i tilhengertanken. I tillegg defekt lufttørker. Lekkasjene kan settes til Ingen, Liten, Middels eller Stor.

### Øvelser i simulatoren

1. Fylle systemet fra tomt
2. Lekkasjekontroll (motor av)
3. Pumpetest og varsellampe
4. Nødbrems: luftlekkasje i krets 3
5. Kretssikring (firekretsventil)
6. Finn feilen (tilfeldig skjult feil, med fasit)
7. Vann i tankene (lufttørker)
8. Koble til tilhengeren
9. Koble fra tilhengeren
10. Kontrollstilling (trekkbilen alene)
11. Revnet styreledning (trekkbilbeskyttelse)
12. Skifte tilhenger (sort knapp)

---

## 4. Viktige valg og forutsetninger

| Valg | Begrunnelse |
|---|---|
| Bare standardbiblioteket (tkinter) | Ingen ekstra pakker å installere. Programmet kjører rett etter at Python er installert. |
| Modellen er skilt fra GUI-et | Fysikken kan testes automatisk uten vindu. |
| Typiske verdier, ikke en bestemt bil | Programmet er for opplæring. Grenseverdier skal hentes fra produsent eller instruktør. |
| Luftmengde regnes i normalliter, strøm ∝ trykkforskjell | Enkelt og stabilt, men gir realistiske fylletider og trykkfall. |
| Overstrømningsventil mot tilhengeren | Uten den ville kobling av en tom tilhenger med motoren av tappe krets 3 og sette på trekkbilens fjærbrems. |
| «Stor» lekkasje = 4,0 NL/s per bar | Med den sterkere kompressoren må en stor lekkasje være større enn det kompressoren klarer å fylle. |
| Kompakt layout, vinduet åpnes øverst til venstre | Brukerens skjerm er 1280×720 logisk ved 150 % skalering. |
| Tilhenger med fjærbrems og rød/sort knapp | Brukerens bestilling, «med fjærbrems og alle funksjonene». |

---

## 5. Testing

- **Automatiske tester:** 18 av 18 bestått, både med `python test_bremsemodell.py` og `pytest`.
  - **Trekkbil:** fylling fra tomt, prioritet for driftsbremsene, pumpetest og varsel, bremsekraft, tett system, lekkasje i bremsesylinder, nødbrems ved tap av luft i krets 3, fjærbrems ved lavt trykk, firekretsventil, vann ved defekt tørker.
  - **Tilhenger:** følger pedalen, parkering og kontrollstilling, nødbrems når rød kobles fra, advarsel ved feil rekkefølge, trekkbilbeskyttelse, sort knapp, rød knapp, overstrømningsventil.
- **Røyktest av GUI:** alle 12 øvelsene kjørt automatisk, med skjermbilde og uten feil.
- **Prosjektfil:** `pip install -e .[test]` testet i et eget venv-miljø. Kommandoen `bremsesimulator.exe` ble laget.

**Målte verdier:**

| Måling | Resultat |
|---|---|
| Fylling fra tomt til 10 bar på tomgang | ca. 264 s uten tilhenger, ca. 467 s med tilhenger |
| Varsellampe ved pumping med motoren av | etter ca. 12 bremsetråkk |

---

## 6. Slik kjører du

```
cd lastebil_brems
python bremsesimulator.py          # start
python test_bremsemodell.py        # tester
```

Eller som installert prosjekt:

```
cd lastebil_brems
pip install -e .[test]
bremsesimulator
pytest
```

Hold tasten **B** inne for å tråkke bremsen helt ned.

---

## 7. Begrensninger og mulige neste steg

**Ikke med i dag:**
- ABS/EBS
- Lastavhengig bremsekraft (ALB)
- Retarder og motorbrems
- Bilens bevegelse, fart og bremselengde
- Tilhenger uten fjærbrems og flere akseltyper

**Mulige utvidelser:**
- Kjøremodus med fart, last og bremselengde
- ABS/EBS og retarder
- Lagring av resultater fra øvelsene, f.eks. for en instruktør
