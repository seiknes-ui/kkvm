# Bremsesimulator – lastebil med trykkluftbrems

En simulering av luftbremsesystemet på en lastebil med tilhenger, laget for opplæring til førerkort C/CE.

## Kjøre

Det trengs bare Python 3 (fra python.org, med standardvalget «tcl/tk» huket av). Ingen andre pakker.

```
python bremsesimulator.py      # starter simulatoren
python test_bremsemodell.py    # kjører testene av fysikkmodellen
```

### Installere som prosjekt (valgfritt)

Prosjektet er beskrevet i `pyproject.toml`. Fra denne mappen:

```
pip install -e .[test]         # installerer, med pytest for testene
bremsesimulator                # starter simulatoren fra hvor som helst
pytest                         # kjører testene
```

### Lage en frittstående .exe (uten Python)

`Bremsesimulator.exe` kan kopieres til en hvilken som helst Windows-PC og startes med dobbeltklikk, uten at Python er installert. Bygg den fra denne mappen:

```
pip install pyinstaller
pyinstaller --onefile --windowed --name Bremsesimulator bremsesimulator.py
```

Ferdig fil havner i `dist\Bremsesimulator.exe` (ca. 10 MB). Første oppstart tar noen sekunder.

## Hva som er med

| Del | Hva den gjør i modellen |
|---|---|
| Kompressor | Leverer luft. Mengden øker med turtallet og synker når trykket stiger. |
| Regulator + lufttørker | Kutter ut ved 10,0 bar og inn igjen ved 8,5 bar. Er tørkeren defekt, samler det seg vann i tankene. |
| Firekretsventil | Fyller krets 1 og 2 først. En lekkasje i én krets tømmer ikke de andre. |
| Krets 1 / 2 | Driftsbremsen foran og bak, styrt av fotbremsventilen med to kretser. Bak går luften via en reléventil. |
| Krets 3 | Håndbremsventil og relé til fjærbremsdelen i kombisylindrene bak. Fjærbremsen er på når det er lite luft, og trenger minst ca. 5,5 bar for å bli helt løst. |
| Krets 4 | Tilleggsutstyr. |
| Varsling | Lampen for lavt lufttrykk tennes under 5,5 bar i krets 1 eller 2. |
| Tilhengerstyreventil | Forsynes fra krets 3 via en overstrømningsventil, slik at tilhengeren ikke tapper trekkbilen under ca. 6 bar. Gir trykk i rød ledning (maks 8,5 bar) og gul ledning (styres av fotbrems og håndbrems). |
| Trekkbilbeskyttelse | Klarer ikke gul ledning å bygge trykk når du bremser (revnet slange), luftes rød ledning ut etter ca. 1 s, og tilhengeren nødbremser. |
| Kontrollstilling | Løser tilhengerens bremser når håndbremsen står i parkering, så du kan sjekke at trekkbilen alene holder vogntoget. |
| Tilhenger | Nødrelé, 60 liters tank, bremsesylindre og fjærbrems. Nødbremsen slår inn når rød ledning faller under ca. 5 bar (helt på under 2,5 bar). Rød knapp setter på parkeringsbremsen. Sort knapp løser nødbremsen ved skifting, og spretter ut av seg selv når rød kobles til. |

Betjening: motor av/på og turtall, bremsepedal (hold **B** for å tråkke helt ned), håndbremsspak med kontrollstilling, rød og gul kobling, rød og sort knapp på tilhengeren, lekkasjer (i hver krets, i bremsesylinderen bak, i rød og gul ledning og i tilhengertanken), defekt lufttørker, tapping av vann, og simuleringsfart opp til 20x.

## Øvelser

1. Fylle systemet fra tomt
2. Lekkasjekontroll (motor av)
3. Pumpetest og varsellampe
4. Nødbrems: luftlekkasje i krets 3
5. Kretssikring (firekretsventil)
6. Finn feilen (skjult, tilfeldig feil, med fasit)
7. Vann i tankene (lufttørker)
8. Koble til tilhengeren (gul først, så rød)
9. Koble fra tilhengeren (rød først, så gul)
10. Kontrollstilling (trekkbilen alene holder vogntoget)
11. Revnet styreledning (trekkbilbeskyttelse)
12. Skifte tilhenger (sort knapp)

## Forbehold

Trykk, volumer og tider er typiske verdier, ikke verdier for en bestemt bil. Modellen er forenklet: ABS/EBS, lastavhengig bremsekraft (ALB), retarder og bilens bevegelse er ikke med. Grenseverdier ved kontroll skal du alltid hente fra produsenten eller instruktøren.
