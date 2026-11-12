# Luftbrems – treningssimulator (web)

Nettversjonen av bremsesimulatoren, laget for opplæring til førerkort C/CE. Den bruker samme fysikkmodell som Python-versjonen i `lastebil_brems/`, overført til JavaScript.

## Kjøre

Åpne `index.html` i en nettleser. Siden trenger ingen server, ingen installasjon og ingen internettforbindelse.

Siden kan også legges ut som en statisk nettside, for eksempel med GitHub Pages.

## Innhold

- **Førerhus:** to manometre (krets 1/2 og krets 3/tilhengertank), varsellamper og avlesninger.
- **Systemskjema:** rørene farges etter trykk, og prikker viser hvor lufta strømmer. Klikk på en komponent for å lese om den, på en tank for å tappe den, og på koblingene for å koble til eller fra.
- **Vogntoget:** hjulene gløder rødt etter bremsekraft. Slangene og den røde og sorte knappen på tilhengeren kan klikkes.
- **Bremseklokke i aksjon:** gjennomskåret bremseklokke som følger simulatoren. Den viser fjærbremsdelen (fjær, stempel og luft), driftsbremsdelen (membran og returfjær), trykkstangen, bremsearmen (slakkjustereren), kamakselen, S-kammen og bakkene i bremsetrommelen. Velg kombisylinder bak, membransylinder foran eller tilhengerens kombisylinder. Trykk, slaglengde og bremsekraft vises, og en tekst forklarer hva som skjer.
- **Betjening:** motor, turtall, bremsepedal (hold B eller mellomrom), håndbrems med kontrollstilling, og simuleringsfart opptil 20×.
- **Oppdrag:** 11 guidede øvelser. Stegene krysses av automatisk, og kontrollspørsmålene må besvares.
- **Eksperiment:** 6 oppgaver der eleven gjetter først og tester etterpå.
- **Finn feilen:** en tilfeldig, skjult feil som eleven skal diagnostisere, med hint og poengtelling.
- **Test:** 10 tilfeldige flervalgsspørsmål.
- **Verksted:** legg inn lekkasjer og defekt lufttørker.
- **Fagstoff:** kort om hver komponent, og hva sjåføren skal passe på.

Fremgangen lagres i nettleseren (localStorage) på den maskinen eleven bruker.

## Rapport for levering

Knappen **Rapport** øverst til høyre lager en rapport over alt eleven har gjort:

- navn, klasse og tidspunkt
- sammendrag: oppdrag fullført, kontrollspørsmål riktig på første forsøk, eksperimenter, Finn feilen, beste test og tid brukt
- tabeller for oppdrag (status, dato og steg), eksperimenter (gjetning og riktig svar), alle feilsøkinger og alle testforsøk
- elevens egen refleksjon og linjer for underskrift fra elev og lærer

Eleven kan skrive ut rapporten eller lagre den som PDF, eller laste den ned som en HTML-fil. Navn må fylles inn før levering. Knappen **Nullstill all fremgang** sletter alt fra nettleseren, for eksempel på delte maskiner.

Resultatene ligger bare i elevens nettleser, så rapporten er ikke et sikkert bevis. Den er ment som dokumentasjon av arbeidet.

## Tester

```
node web/test/test_bremsemodell.js
```

Testene er de samme 18 som for Python-modellen.

## Filer

| Fil | Innhold |
|---|---|
| `index.html` | Siden |
| `css/stil.css` | Utseende, lyst og mørkt tema |
| `js/bremsemodell.js` | Fysikkmodellen |
| `js/innhold.js` | Oppdrag, eksperimenter, skjulte feil, fagstoff og spørsmål |
| `js/app.js` | Grensesnitt og logikk |
| `test/test_bremsemodell.js` | Tester av modellen |
