/*
 * innhold.js
 * ==========
 * Opplæringsinnhold: oppdrag (guidede øvelser med automatisk avkrysning og kontrollspørsmål),
 * eksperimenter (gjett først, test etterpå), skjulte feil, fagstoff og ekstra spørsmål.
 *
 * Et steg har en sjekk ok(k) som kalles hver bildeoppdatering mens oppdraget er aktivt.
 * k.m er modellen, k.har(/regex/) søker i loggen siden oppdraget startet, k.antall(/regex/)
 * teller treff, og k.holdt(navn, betingelse, sekunder) er sann når betingelsen har vart
 * sammenhengende i så mange simulerte sekunder. Steg uten ok krysses av manuelt.
 */
(function (global) {
  "use strict";

  const OPPDRAG = [
    {
      id: "fylle",
      tittel: "Fylle systemet fra tomt",
      niva: "Grunnleggende",
      maal: "Se hvordan systemet bygger opp trykk, og i hvilken rekkefølge kretsene fylles.",
      oppsett: { fyll: false, motor: false, haand: 100, fart: 5 },
      steg: [
        { t: "Systemet er tomt. Se at lampen <b>LAVT LUFTTRYKK</b> lyser.", ok: (k) => k.m.varsel },
        { t: "Start motoren.", ok: (k) => k.m.motor_paa },
        { t: "Se at krets 1 og 2 fylles før krets 3 og 4.", ok: (k) => k.m.tanker.K1.trykk > 6.5 },
        {
          t: "Prøv å løse parkeringsbremsen (spak til KJØR) før krets 3 har nådd 5,5 bar. Les loggen.",
          ok: (k) => k.har(/fjærbremsen kan ikke løses helt/),
        },
        { t: "Varsellampen slukker når krets 1 og 2 er over ca. 6 bar.", ok: (k) => k.har(/Varsellampen slukket/) },
        { t: "Vent til regulatoren kutter ut ved 10 bar. Tiden står i loggen.", ok: (k) => k.har(/Tid fra motorstart/) },
        {
          t: "Tøm systemet, sett turtallet til 2000 o/min og fyll på nytt. Går det raskere?",
          ok: (k) => k.antall(/Tid fra motorstart/) >= 2,
        },
      ],
      sporsmal: [
        {
          q: "Hvorfor fylles krets 1 og 2 før krets 3 og 4?",
          a: ["Firekretsventilen prioriterer driftsbremsene", "Tankene i krets 1 og 2 er minst",
            "Kompressoren er koblet direkte til krets 1", "Det er tilfeldig"],
          r: 0,
          f: "Firekretsventilen åpner mot krets 1 og 2 ved et lavere trykk enn mot krets 3 og 4. Da får driftsbremsene luft først.",
        },
        {
          q: "Ved hvilket trykk kutter regulatoren ut i simulatoren?",
          a: ["6 bar", "8,5 bar", "10 bar", "14 bar"],
          r: 2,
          f: "Regulatoren kutter ut ved 10 bar og inn igjen ved 8,5 bar. Verdiene varierer mellom bilmerker, så sjekk instruksjonsboka.",
        },
        {
          q: "Varsellampen for lavt lufttrykk lyser fortsatt. Kan du kjøre?",
          a: ["Ja, hvis parkeringsbremsen er løst", "Nei, vent til lampen har slukket og trykket er normalt",
            "Ja, men bare sakte", "Ja, fjærbremsen er nok"],
          r: 1,
          f: "Med lavt trykk har du ikke nok luft til sikre bremser. Vent til lampen slukker og trykket er normalt.",
        },
      ],
    },
    {
      id: "lekkasje",
      tittel: "Lekkasjekontroll med motoren av",
      niva: "Grunnleggende",
      maal: "Kontrollere at systemet er tett, både med og uten bremsepedalen nede.",
      oppsett: { fyll: true, motor: false, haand: 100, fart: 5 },
      steg: [
        { t: "Løs parkeringsbremsen (spak til KJØR). I virkeligheten skal hjulene være sikret med klosser.", ok: (k) => k.m.haandbrems < 0.05 },
        {
          t: "Følg med på manometeret i 1 minutt uten å bremse. Trykket skal stå stille.",
          ok: (k) => k.holdt("uten", k.m.haandbrems < 0.05 && k.m.pedal < 0.05, 60),
        },
        {
          t: "Tråkk bremsen helt ned og hold i 1 minutt. Trykket faller litt med en gang, men skal så stå stille. Bruk pedalskyveren eller hold B.",
          ok: (k) => k.holdt("med", k.m.pedal > 0.9, 60),
        },
        {
          t: "Sett lekkasje i <b>Bremsesylinder bak</b> til Middels (fanen Verksted). Gjenta med pedalen nede i 30 s.",
          ok: (k) => k.holdt("lekk", k.m.lekkasje.Bak !== "Ingen" && k.m.pedal > 0.9, 30),
        },
      ],
      sporsmal: [
        {
          q: "Trykket faller litt i det du tråkker bremsen, selv i et tett system. Hvorfor?",
          a: ["Systemet lekker alltid litt", "Luft går fra tankene til bremsesylindrene",
            "Kompressoren stopper", "Manometeret viser feil"],
          r: 1,
          f: "Sylindrene skal fylles med luft. Den lufta kommer fra tankene, så trykket der faller litt.",
        },
        {
          q: "Trykket faller bare når pedalen er nede. Hvor sitter lekkasjen sannsynligvis?",
          a: ["I kompressoren", "I tanken i krets 4", "Etter fotbremsventilen, f.eks. i en bremsesylinder",
            "I lufttørkeren"],
          r: 2,
          f: "Delen etter fotbremsventilen har bare luft når du bremser. Da merkes en lekkasje der bare med pedalen nede.",
        },
        {
          q: "Hvor finner du tillatt trykkfall for kjøretøyet du kjører?",
          a: ["Det er alltid 1 bar", "I instruksjonsboka eller hos instruktøren",
            "Det finnes ingen grense", "På manometeret"],
          r: 1,
          f: "Grenseverdiene varierer. Bruk produsentens verdier eller det instruktøren oppgir.",
        },
      ],
    },
    {
      id: "pumpe",
      tittel: "Pumpetest og varsellampe",
      niva: "Grunnleggende",
      maal: "Kontrollere at varsellampen virker, og se hvor mye luft hver bremsing bruker.",
      oppsett: { fyll: true, motor: false, haand: 100, fart: 1 },
      steg: [
        { t: "Pump bremsen: tråkk helt ned og slipp, flere ganger (hold B ca. 1 s, slipp ca. 1 s).", ok: (k) => k.m.pumpetall >= 3 },
        { t: "Fortsett til varsellampen tennes. Hvor mange tråkk trengte du?", ok: (k) => k.har(/VARSEL: Lavt/) },
        { t: "Start motoren og se at lampen slukker igjen.", ok: (k) => k.m.motor_paa && k.har(/Varsellampen slukket/) },
      ],
      sporsmal: [
        {
          q: "Omtrent hvor mye faller trykket i krets 2 per fullt bremsetråkk i simulatoren?",
          a: ["0,05 bar", "0,5 bar", "2 bar", "5 bar"],
          r: 1,
          f: "Ett fullt tråkk bruker omtrent 0,5 bar fra en full tank. Etter 10–12 tråkk tennes varsellampen.",
        },
        {
          q: "Hvorfor skal du unngå å pumpe bremsene i en lang nedoverbakke?",
          a: ["Det sliter på pedalen", "Hvert tråkk bruker luft, og systemet kan tappes",
            "Det gir dårligere styring", "Det er greit å pumpe"],
          r: 1,
          f: "Hvert tråkk tømmer sylindrene og fyller dem på nytt. Bruk jevn bremsing, motorbrems og retarder i lange bakker.",
        },
        {
          q: "Varsellampen for lavt lufttrykk tennes under kjøring. Hva gjør du?",
          a: ["Kjører videre til neste verksted", "Gir mer gass så kompressoren lader",
            "Stopper trygt så fort som mulig og finner feilen", "Pumper bremsen"],
          r: 2,
          f: "Lampen betyr at bremsene kan svikte. Stopp trygt og kjør ikke videre før feilen er funnet.",
        },
      ],
    },
    {
      id: "nodbrems",
      tittel: "Nødbrems ved lekkasje i krets 3",
      niva: "Grunnleggende",
      maal: "Forstå hvorfor fjærbremsen er en feilsikker brems.",
      oppsett: { fyll: true, motor: false, haand: 0, lekk: { K3: "Stor" }, fart: 1 },
      steg: [
        { t: "Øvelsen har lagt inn en STOR lekkasje i krets 3. Se trykket i krets 3 falle.", ok: (k) => k.m.tanker.K3.trykk < 5.5 },
        { t: "Under ca. 5,5 bar begynner fjærbremsen å slå inn.", ok: (k) => k.har(/begynner å slå inn/) },
        { t: "Under ca. 2 bar er fjærbremsen helt på – bilen nødbremser.", ok: (k) => k.har(/NØDBREMS: Fjærbremsen/) },
        { t: "Se at krets 1 og 2 fortsatt har trykk. Driftsbremsene virker fortsatt.", ok: null },
      ],
      sporsmal: [
        {
          q: "Hva holder fjærbremsen PÅ?",
          a: ["Lufttrykk", "Kraftige fjærer", "Hydraulikkolje", "Strøm fra batteriet"],
          r: 1,
          f: "Fjærene presser bremsen på. Det trengs luft for å trykke fjærene sammen og løse bremsen.",
        },
        {
          q: "Hvorfor kalles fjærbremsen «feilsikker»?",
          a: ["Den kan ikke bli slitt", "Mister den lufta, bremser den av seg selv",
            "Den virker bare når motoren går", "Den har to kretser"],
          r: 1,
          f: "Ved luftlekkasje faller trykket, og fjærene setter bremsen på. Bilen stopper i stedet for å miste bremsene.",
        },
      ],
    },
    {
      id: "vann",
      tittel: "Vann i tankene",
      niva: "Grunnleggende",
      maal: "Forstå hvorfor lufttørkeren er viktig, og hvorfor du tapper tankene.",
      oppsett: { fyll: false, motor: true, haand: 100, torker: true, fart: 5 },
      steg: [
        { t: "Lufttørkeren er defekt. Se at det samler seg vann i tankene mens kompressoren lader.", ok: (k) => k.vann() > 5 },
        { t: "Tapp vann fra tankene (knapp i Verksted eller under skjemaet).", ok: (k) => k.har(/ml vann kom ut/) },
        { t: "Reparer lufttørkeren (fjern haken i Verksted) og tapp på nytt. Kommer det bare luft?", ok: (k) => !k.m.torker_defekt && k.har(/bare luft kom ut/) },
      ],
      sporsmal: [
        {
          q: "Hvorfor er vann i trykkluftsystemet farlig?",
          a: ["Det gir høyere trykk", "Det kan fryse om vinteren og ødelegge ventiler",
            "Det gjør bremsene sterkere", "Det er ufarlig"],
          r: 1,
          f: "Vann kan fryse og blokkere ventiler og ledninger, og det gir rust og slitasje.",
        },
        {
          q: "Det kommer vann når du tapper tankene. Hva tyder det på?",
          a: ["Alt er normalt", "Lufttørkeren virker ikke og må sjekkes", "Kompressoren er for liten",
            "Tanken lekker"],
          r: 1,
          f: "Lufttørkeren skal fjerne fuktigheten. Kommer det vann, må tørkeren (patronen) sjekkes.",
        },
      ],
    },
    {
      id: "kretser",
      tittel: "Kretssikring med firekretsventilen",
      niva: "Viderekommen",
      maal: "Se at en lekkasje i én krets ikke tømmer de andre.",
      oppsett: { fyll: true, motor: true, turtall: 1500, haand: 100, lekk: { K1: "Stor" }, fart: 2 },
      steg: [
        { t: "Øvelsen har lagt inn en STOR lekkasje i krets 1 (bremsene foran). Se at krets 1 tømmes.", ok: (k) => k.m.tanker.K1.trykk < 2 },
        {
          t: "Se at krets 2, 3 og 4 holder trykket over 6 bar i 20 s.",
          ok: (k) => k.holdt("andre", k.m.tanker.K1.trykk < 2 && ["K2", "K3", "K4"].every((x) => k.m.tanker[x].trykk > 6), 20),
        },
        { t: "Varsellampen lyser – du skal stoppe trygt.", ok: (k) => k.m.varsel && k.m.tanker.K1.trykk < 2 },
        {
          t: "Løs parkeringsbremsen og tråkk på bremsen. Se på hjulene: hvilken aksel bremser?",
          ok: (k) => k.m.haandbrems < 0.05 && k.m.bak.trykk > 3,
        },
      ],
      sporsmal: [
        {
          q: "Krets 1 har en stor lekkasje. Hvilke bremser virker fortsatt?",
          a: ["Ingen", "Bare bremsene foran", "Bremsene bak (krets 2), fjærbremsen og tilhengeren",
            "Bare tilhengeren"],
          r: 2,
          f: "Firekretsventilen stenger mot krets 1 når trykket faller. Krets 2 og 3 holder trykket, så du kan fortsatt stoppe.",
        },
        {
          q: "Hva er firekretsventilens viktigste jobb?",
          a: ["Tørke lufta", "Fordele luft og hindre at en lekkasje tømmer de andre kretsene",
            "Regulere bremsekraften", "Varsle om lavt trykk"],
          r: 1,
          f: "Ventilen deler systemet i fire kretser som er sikret mot hverandre, og fyller driftsbremsene først.",
        },
      ],
    },
    {
      id: "tilkobling",
      tittel: "Koble til tilhengeren",
      niva: "Tilhenger",
      maal: "Koble til i riktig rekkefølge og fylle tilhengeren.",
      oppsett: { fyll: true, motor: true, haand: 100, rod: false, gul: false, rodknapp: true, tomTilhenger: true, fart: 5 },
      steg: [
        { t: "Koble til <b>GUL</b> kobling (styreledning) først. Klikk på den gule koblingen på bilen.", ok: (k) => k.m.gul_koblet && !k.har(/Rød er koblet før gul/) },
        { t: "Koble til <b>RØD</b> kobling (forsyning).", ok: (k) => k.m.rod_koblet && k.m.gul_koblet },
        { t: "Vent til tilhengertanken er fylt over 7 bar.", ok: (k) => k.m.t_tank.trykk > 7 },
        { t: "Trykk inn den <b>røde knappen</b> på tilhengeren. Fjærbremsen løses.", ok: (k) => !k.m.t_rod_knapp_ute && k.m.tilh_fjaer_andel < 0.02 },
        { t: "Løs parkeringsbremsen og tråkk på bremsen. Bremser tilhengeren også?", ok: (k) => k.m.haandbrems < 0.05 && k.m.t_drift.trykk > 3 },
      ],
      sporsmal: [
        {
          q: "Hva er riktig rekkefølge når du kobler til?",
          a: ["Rød først, så gul", "Gul først, så rød", "Begge samtidig", "Det spiller ingen rolle"],
          r: 1,
          f: "Gul (styreledning) først, så rød (forsyning). Når rød kobles, løses nødbremsen, og da skal tilhengeren allerede kunne bremses.",
        },
        {
          q: "Hva skjer med tilhengerens nødbrems når rød ledning får over ca. 5 bar?",
          a: ["Den slår inn", "Den løses", "Ingenting", "Den sorte knappen spretter inn"],
          r: 1,
          f: "Nødreléet holder bremsen på så lenge rød ledning mangler trykk. Med nok trykk løses den.",
        },
        {
          q: "Hvorfor kan nødbremsen slå inn igjen mens en tom tilhenger fylles?",
          a: ["Gul ledning lekker", "Trykket i rød ledning faller mens den tomme tanken fylles",
            "Kompressoren stopper", "Den røde knappen er feil"],
          r: 1,
          f: "En tom 60-liters tank trekker mye luft. Vent til tilhengertanken er full før du kjører.",
        },
      ],
    },
    {
      id: "frakobling",
      tittel: "Koble fra tilhengeren",
      niva: "Tilhenger",
      maal: "Parkere og koble fra tilhengeren trygt.",
      oppsett: { fyll: true, motor: false, haand: 100, fart: 1 },
      steg: [
        { t: "Parkeringsbremsen er på. Trekk ut den <b>røde knappen</b> på tilhengeren (fjærbremsen på).", ok: (k) => k.m.t_rod_knapp_ute },
        { t: "Koble fra <b>RØD</b> først. Hør «pssst», og se at tilhengerens nødbrems slår inn.", ok: (k) => k.har(/Rød kobling frakoblet/) && !k.har(/Rød er fortsatt tilkoblet/) },
        { t: "Koble fra <b>GUL</b>.", ok: (k) => !k.m.gul_koblet && !k.m.rod_koblet },
      ],
      sporsmal: [
        {
          q: "Hva er riktig rekkefølge når du kobler fra?",
          a: ["Gul først, så rød", "Rød først, så gul", "Begge samtidig", "Det spiller ingen rolle"],
          r: 1,
          f: "Rød først (tilhengeren nødbremser), så gul.",
        },
        {
          q: "Hva skjer med tilhengeren når rød ledning kobles fra?",
          a: ["Den ruller fritt", "Den nødbremser automatisk", "Den røde knappen spretter ut",
            "Ingenting før gul kobles fra"],
          r: 1,
          f: "Uten trykk i rød ledning slår nødreléet inn og bremser tilhengeren med luft fra tilhengertanken.",
        },
      ],
    },
    {
      id: "kontroll",
      tittel: "Kontrollstilling",
      niva: "Tilhenger",
      maal: "Kontrollere at trekkbilens parkeringsbrems alene holder vogntoget.",
      oppsett: { fyll: true, motor: false, haand: 100, fart: 1 },
      steg: [
        { t: "Vogntoget er parkert. Se at tilhengerens bremsesylindre har trykk (tilhengeren bremses via gul ledning).", ok: (k) => k.m.t_drift.trykk > 7 },
        { t: "Slå på <b>kontrollstilling</b> (ved håndbremsspaken).", ok: (k) => k.m.kontrollstilling },
        {
          t: "Se at tilhengerens sylindre luftes ut, mens trekkbilens fjærbrems fortsatt er på.",
          ok: (k) => k.m.kontrollstilling && k.m.t_drift.trykk < 0.5 && k.m.fjaerbrems_andel > 0.98,
        },
        { t: "I virkeligheten prøver du nå forsiktig å kjøre. Vogntoget skal stå stille. Slå av kontrollstillingen.", ok: (k) => k.har(/Kontrollstilling av/) },
      ],
      sporsmal: [
        {
          q: "Hva sjekker du med kontrollstillingen?",
          a: ["At tilhengeren alene holder vogntoget", "At trekkbilens parkeringsbrems alene holder vogntoget",
            "At kompressoren lader", "At gul ledning er tett"],
          r: 1,
          f: "Kontrollstillingen løser tilhengerens bremser. Da ser du om trekkbilen alene klarer å holde hele vogntoget.",
        },
        {
          q: "Hvorfor er det viktig at trekkbilen alene holder vogntoget?",
          a: ["Tilhengerens luftbremser kan lekke ut over tid", "Det sparer luft", "Det er påbudt å bruke kontrollstilling ved kjøring",
            "Tilhengeren har ingen bremser"],
          r: 0,
          f: "En tilhenger som bremses av luft, kan miste bremsekraften når lufta lekker ut. Fjærbremsen på trekkbilen gjør ikke det.",
        },
      ],
    },
    {
      id: "trekkbilbeskyttelse",
      tittel: "Revnet styreledning (trekkbilbeskyttelse)",
      niva: "Tilhenger",
      maal: "Forstå hva som skjer når den gule ledningen ryker.",
      oppsett: { fyll: true, motor: true, haand: 0, lekk: { Gul: "Stor" }, fart: 1 },
      steg: [
        { t: "Øvelsen har lagt inn en revnet gul slange. Tråkk bremsen helt ned og hold (B).", ok: (k) => k.m.pedal > 0.8 },
        { t: "Gul ledning bygger ikke trykk. Etter ca. 1 s slår trekkbilbeskyttelsen inn.", ok: (k) => k.har(/TREKKBILBESKYTTELSE/) },
        { t: "Rød ledning luftes ut, og tilhengeren nødbremser.", ok: (k) => k.har(/Tilhengerens NØDBREMS er på/) },
        { t: "Slipp pedalen. Rød ledning fylles igjen, og tilhengeren løser.", ok: (k) => k.har(/Bremsepedalen er sluppet/) },
      ],
      sporsmal: [
        {
          q: "Hva gjør trekkbilbeskyttelsen når gul ledning ikke bygger trykk ved bremsing?",
          a: ["Ingenting", "Lufter ut rød ledning, så tilhengeren nødbremser", "Slår av motoren",
            "Setter på trekkbilens fjærbrems"],
          r: 1,
          f: "Tilhengeren bremses likevel, via nødreléet. Samtidig sparer trekkbilen sin egen luft.",
        },
        {
          q: "Hvorfor forsynes tilhengeren via en overstrømningsventil?",
          a: ["For å gi tilhengeren høyere trykk", "Så en lekk eller tom tilhenger ikke tapper trekkbilens krets 3",
            "For å tørke lufta", "For å fylle gul ledning"],
          r: 1,
          f: "Ventilen sender bare luft videre når krets 3 har over ca. 6–7 bar. Da beholder trekkbilen luft til å løse sin egen fjærbrems.",
        },
      ],
    },
    {
      id: "skifting",
      tittel: "Skifte tilhenger (sort knapp)",
      niva: "Tilhenger",
      maal: "Flytte en frakoblet tilhenger, og forstå hvorfor dette er risikabelt.",
      oppsett: { fyll: true, motor: false, haand: 100, rod: false, gul: false, fart: 1 },
      steg: [
        { t: "Tilhengeren er frakoblet og nødbremser. Trykk inn den <b>sorte knappen</b>.", ok: (k) => k.m.t_sort_knapp_inne },
        { t: "Se at nødbremsen løses. Tilhengeren har nå INGEN brems.", ok: (k) => k.m.t_sort_knapp_inne && k.m.t_drift.trykk < 0.5 },
        { t: "Koble til gul og rød igjen.", ok: (k) => k.m.gul_koblet && k.m.rod_koblet },
        { t: "Se at den sorte knappen spretter ut av seg selv.", ok: (k) => k.har(/Sort knapp spratt ut/) },
      ],
      sporsmal: [
        {
          q: "Når kan du bruke den sorte knappen?",
          a: ["Ved vanlig kjøring", "Bare for å flytte tilhengeren på plassen, f.eks. med skiftetraktor",
            "For å fylle tilhengertanken", "Når du parkerer"],
          r: 1,
          f: "Den sorte knappen løser nødbremsen. Tilhengeren har da ingen brems, så den skal bare brukes ved skifting.",
        },
        {
          q: "Hvorfor spretter den sorte knappen ut når rød ledning kobles til?",
          a: ["Den er ødelagt", "Så nødbremsen virker igjen automatisk", "For å fylle tanken raskere",
            "For å varsle om lekkasje"],
          r: 1,
          f: "Knappen går tilbake av seg selv når rød ledning får trykk. Da kan ingen glemme den inne.",
        },
      ],
    },
  ];

  const EKSPERIMENTER = [
    {
      id: "turtall",
      tittel: "Turtall og fylletid",
      sporsmal: "Hvor mye raskere fylles systemet fra tomt på 2000 o/min enn på tomgang (600 o/min)?",
      valg: ["Omtrent like fort", "Litt raskere (10–20 %)", "Ca. 3 ganger raskere", "Over 10 ganger raskere"],
      riktig: 2,
      oppsett: { fyll: false, motor: false, haand: 100, turtall: 600, fart: 20 },
      fremgang: [
        "Start motoren på 600 o/min og vent til regulatoren kutter ut. Noter tiden i loggen.",
        "Trykk <b>Tøm</b>, sett turtallet til 2000 o/min og gjør det samme.",
      ],
      forklaring: "Kompressoren gir mer luft jo fortere den går. I simulatoren tar fylling med tilhenger ca. 470 s på tomgang og ca. 135 s på 2000 o/min. Trenger du luft fort, øk turtallet litt.",
    },
    {
      id: "tilhengerfylling",
      tittel: "Fylling med og uten tilhenger",
      sporsmal: "Hvor mye lenger tar det å fylle fra tomt når tilhengeren er tilkoblet?",
      valg: ["Ingen forskjell", "Ca. 10 % lenger", "Ca. 75 % lenger", "Dobbelt så lang tid eller mer"],
      riktig: 2,
      oppsett: { fyll: false, motor: false, haand: 100, fart: 20 },
      fremgang: [
        "Start motoren med tilhengeren tilkoblet. Noter tiden til utkobling.",
        "Trykk <b>Tøm</b>, koble fra rød og gul, og start på nytt.",
      ],
      forklaring: "Tilhengertanken er på 60 liter og skal også fylles. Det gir ca. 470 s mot ca. 270 s uten tilhenger, altså ca. 75 % lenger.",
    },
    {
      id: "pedal",
      tittel: "Pedal og bremsetrykk",
      sporsmal: "Du tråkker pedalen halvveis (50 %). Hvilket trykk får bremsesylindrene?",
      valg: ["Ca. 2,5 bar", "Ca. 5 bar", "Ca. 8,5 bar", "Fullt tanktrykk (10 bar)"],
      riktig: 1,
      oppsett: { fyll: true, motor: true, haand: 0, fart: 1 },
      fremgang: [
        "Sett pedalskyveren til 50 % og les trykket i bremsesylindrene foran og bak.",
        "Prøv 25 % og 100 %.",
      ],
      forklaring: "Fotbremsventilen er en doseringsventil: sylindertrykket følger pedalen. 50 % gir ca. 5 bar. Tilhengeren følger via gul ledning.",
    },
    {
      id: "lekkasje_k4",
      tittel: "Stor lekkasje i krets 4",
      sporsmal: "Motoren går. En slange i krets 4 (f.eks. luftfjæringen) ryker. Hva skjer med bremsekretsene?",
      valg: ["Alle kretser tømmes", "Krets 1 og 2 holder trykket, og kompressoren lader hele tiden",
        "Fjærbremsen slår inn med en gang", "Ingenting skjer"],
      riktig: 1,
      oppsett: { fyll: true, motor: true, haand: 100, fart: 5 },
      fremgang: [
        "Gå til <b>Verksted</b> og sett lekkasjen i krets 4 til Stor.",
        "Følg kretsene på grafen i 2–3 minutter (simulert tid).",
      ],
      forklaring: "Firekretsventilen stenger mot krets 4. Krets 1 og 2 holder 10 bar, men kompressoren går hele tiden fordi lufta lekker ut.",
    },
    {
      id: "rodknapp",
      tittel: "Glemt rød knapp",
      sporsmal: "Den røde knappen på tilhengeren er ute, og du løser trekkbilens parkeringsbrems. Hva skjer?",
      valg: ["Ingenting, du kan kjøre", "Tilhengeren står bremset av fjærbremsen, og KJØREKLAR lyser ikke",
        "Trekkbilens fjærbrems slår inn", "Tilhengerens nødbrems slår inn"],
      riktig: 1,
      oppsett: { fyll: true, motor: true, haand: 100, rodknapp: true, fart: 1 },
      fremgang: ["Sett håndbremsspaken til KJØR.", "Se på tilhengerens hjul og lampene i førerhuset."],
      forklaring: "Den røde knappen styrer tilhengerens fjærbrems. Står den ute, er tilhengeren parkert, uansett hva trekkbilen gjør.",
    },
    {
      id: "tilhengertank",
      tittel: "Frakoblet tilhenger med lekk tank",
      sporsmal: "En frakoblet tilhenger (rød knapp inne) har lekkasje i lufttanken. Står den bremset over natta?",
      valg: ["Nei, den mister bremsene", "Ja, fjærbremsen tar over når lufta lekker ut",
        "Bare hvis den sorte knappen er inne", "Bare hvis gul er tilkoblet"],
      riktig: 1,
      oppsett: { fyll: true, motor: false, haand: 100, rod: false, gul: false, fart: 5 },
      fremgang: [
        "Gå til <b>Verksted</b> og sett lekkasjen i tilhengerens lufttank til Stor.",
        "Følg tilhengerens tank, sylindre og fjærbrems.",
      ],
      forklaring: "Nødbremsen bruker luft fra tanken. Når tanken lekker, faller også trykket i fjærbremsdelen, og fjærene setter bremsen på. Uten fjærbrems ville tilhengeren mistet bremsene.",
    },
  ];

  // [feil for modellen, kort svaralternativ, fasit, hint]
  const SKJULTE_FEIL = [
    { feil: ["K1", "Middels"], navn: "Lekkasje i krets 1", fasit: "Lekkasje i krets 1 (tank/ledning, driftsbrems foran).",
      hint: "Gjør lekkasjekontroll med motoren av. Følg den røde viseren på manometeret." },
    { feil: ["K2", "Middels"], navn: "Lekkasje i krets 2", fasit: "Lekkasje i krets 2 (tank/ledning, driftsbrems bak).",
      hint: "Gjør lekkasjekontroll med motoren av. Følg den grønne viseren på manometeret." },
    { feil: ["K3", "Middels"], navn: "Lekkasje i krets 3", fasit: "Lekkasje i krets 3 (parkering/fjærbrems og tilhengerforsyning).",
      hint: "Følg krets 3 på grafen med motoren av og spaken i kjørestilling." },
    { feil: ["K4", "Middels"], navn: "Lekkasje i krets 4", fasit: "Lekkasje i krets 4 (tilleggsutstyr).",
      hint: "Kretsene for bremsene holder seg. Se på de andre kretsene." },
    { feil: ["Bak", "Middels"], navn: "Lekkasje i bremsesylinder bak", fasit: "Lekkasje i bremsesylinder bak – merkes bare når pedalen er nede.",
      hint: "Sammenlign trykkfallet med og uten pedalen nede." },
    { feil: ["torker", null], navn: "Defekt lufttørker", fasit: "Defekt lufttørker – det kommer vann når tankene tappes.",
      hint: "Systemet er tett. La kompressoren lade en stund og tapp tankene." },
    { feil: ["TT", "Middels"], navn: "Lekkasje i tilhengertanken", fasit: "Lekkasje i tilhengerens lufttank.",
      hint: "Koble fra rød ledning og følg tilhengertanken." },
    { feil: ["Gul", "Stor"], navn: "Revnet gul slange", fasit: "Revnet gul slange (styreledning) – trekkbilbeskyttelsen lufter ut rød ledning ved bremsing.",
      hint: "Løs parkeringsbremsen, start motoren og tråkk bremsen helt ned. Les loggen." },
    { feil: ["Rod", "Middels"], navn: "Lekkasje i rød ledning", fasit: "Lekkasje i rød ledning (forsyning til tilhengeren).",
      hint: "Sammenlign rød ledning og tilhengertanken med krets 3." },
  ];

  const FAGSTOFF = [
    { id: "kompressor", tittel: "Kompressor", tekst: "Drives av motoren og lager trykkluft. Jo høyere turtall, jo mer luft. Ytelsen synker når trykket stiger.",
      sjafor: "Kompressoren lader bare når motoren går. Trenger du luft fort, øk turtallet litt." },
    { id: "regulator", tittel: "Regulator og lufttørker", tekst: "Regulatoren kutter ut ladingen ved ca. 10 bar og inn igjen ved ca. 8,5 bar. Lufttørkeren fjerner fuktighet og blåser ut med et «pssst» ved utkobling.",
      sjafor: "Hør etter «pssst» ved utkobling. Tapp tankene jevnlig. Kommer det vann, må tørkeren sjekkes." },
    { id: "firekrets", tittel: "Firekretsventil", tekst: "Fordeler lufta på fire kretser og sikrer dem mot hverandre. Krets 1 og 2 (driftsbrems) fylles først. Lekker én krets, stenger ventilen mot den, så de andre beholder trykket.",
      sjafor: "Ved lekkasje i én krets har du fortsatt brems i de andre. Stopp likevel trygt." },
    { id: "tanker", tittel: "Lufttanker", tekst: "Hver krets har sin egen tank: krets 1 driftsbrems foran, krets 2 driftsbrems bak, krets 3 parkering/fjærbrems og tilhenger, krets 4 tilleggsutstyr (gir, luftfjæring m.m.).",
      sjafor: "Tapp tankene for vann etter instruksjonsboka. Klikk på en tank for å tappe den." },
    { id: "fotbrems", tittel: "Fotbremsventil", tekst: "En doseringsventil med to kretser. Pedalstillingen bestemmer trykket ut til bremsesylindrene: halv pedal gir ca. halvt trykk.",
      sjafor: "Bruk jevn bremsing. Pumping bruker luft." },
    { id: "foran", tittel: "Bremsesylindre foran", tekst: "Membransylindre som gjør trykkluft om til kraft på bremsene. 8 bar gir full bremsekraft i simulatoren.",
      sjafor: "En lekkasje her merkes bare når du bremser." },
    { id: "rele", tittel: "Reléventil", tekst: "Sitter nær bakakselen. Den får styresignal fra fotbremsventilen og fyller bremsesylindrene bak med luft direkte fra krets 2. Det gir raskere bremserespons.",
      sjafor: "Merkes som kortere responstid på bremsene bak." },
    { id: "kombi", tittel: "Kombisylindre bak (fjærbrems)", tekst: "To deler i én sylinder: en driftsbremsdel og en fjærbremsdel. Fjærene setter bremsen på, og luft over ca. 5,5 bar løser den. Under ca. 2 bar er bremsen helt på. Drift- og fjærbrems legges ikke sammen (overbelastningsvern).",
      sjafor: "Mister du luft i krets 3, stopper bilen av seg selv. For berging kan fjærbremsen løses mekanisk – se instruksjonsboka." },
    { id: "haandbrems", tittel: "Håndbremsventil", tekst: "Styrer trykket i fjærbremsdelen via et relé. Kjørestilling gir fullt trykk (bremsen løst), parkering lufter ut (bremsen på). Mellomstillinger gir gradert bremsing. Ventilen styrer også tilhengeren via gul ledning.",
      sjafor: "Sett alltid parkeringsbremsen når du forlater bilen." },
    { id: "kontrollstilling", tittel: "Kontrollstilling", tekst: "Spaken trekkes forbi parkeringsstilling. Da løses tilhengerens bremser, mens trekkbilens fjærbrems fortsatt er på.",
      sjafor: "Bruk den for å sjekke at trekkbilen alene holder vogntoget i en bakke." },
    { id: "tilleggsutstyr", tittel: "Krets 4 – tilleggsutstyr", tekst: "Forsyner gir, luftfjæring, førerhusutstyr og annet. Fylles etter bremsekretsene.",
      sjafor: "En lekkasje her påvirker ikke bremsene, men kompressoren må jobbe hardere." },
    { id: "tsv", tittel: "Tilhengerstyreventil", tekst: "Forsynes fra krets 3 via en overstrømningsventil (ca. 6–7 bar), så tilhengeren ikke tapper trekkbilen. Gul ledning følger fotbremsen og parkeringsbremsen. Rød ledning gir forsyning på maks 8,5 bar. Trekkbilbeskyttelsen lufter ut rød ledning hvis gul ikke bygger trykk ved bremsing.",
      sjafor: "Ved revnet gul slange nødbremser tilhengeren når du bremser." },
    { id: "koblinger", tittel: "Koblinger: rød og gul", tekst: "Rød er forsyning (fyller tilhengertanken og holder nødbremsen løst). Gul er styreledning (bremsesignal).",
      sjafor: "Koble til: gul, så rød. Koble fra: rød, så gul. Klikk på koblingene på bilen for å koble." },
    { id: "nodrele", tittel: "Nødrelé (tilhenger)", tekst: "Fyller tilhengertanken fra rød ledning og styrer tilhengerens bremsesylindre etter gul ledning. Faller rød under ca. 5 bar, bremser reléet tilhengeren med luft fra tanken. Under 2,5 bar er nødbremsen helt på.",
      sjafor: "Når rød kobles fra, nødbremser tilhengeren." },
    { id: "tilhtank", tittel: "Tilhengertank", tekst: "60 liter. Fylles via rød ledning. Gir luft til bremsesylindrene og løser fjærbremsen.",
      sjafor: "Vent til tanken er full før du kjører." },
    { id: "bremseklokke", tittel: "Bremseklokke, bremsearm og S-kam", tekst: "Bremseklokka (bremsesylinderen) gjør lufttrykk om til kraft. I driftsbremsdelen presser lufta en gummimembran og trykkstangen ut. I fjærbremsdelen holder lufta en kraftig fjær sammenpresset. Forsvinner lufta, skyver fjæren stempelet og trykkstangen ut. Trykkstangen dreier bremsearmen (slakkjustereren), som vrir kamakselen. S-kammen inne i trommelen presser bremsebakkene mot trommelen. Den første delen av slaget tar bare opp klaringen. Først når bakkene ligger an, bygges bremsekraften opp.",
      sjafor: "For langt slag på trykkstangen betyr slitte bremser eller feil på slakkjustereren. Se etter skader på membranhuset, og lytt etter lekkasjer når du bremser. Nødløsebolten må bare brukes ved berging." },
    { id: "tilhsyl", tittel: "Tilhengerens bremsesylindre", tekst: "Kombisylindre med driftsbremsdel og fjærbremsdel, som på trekkbilen.",
      sjafor: "Lekker tilhengertanken, setter fjærbremsen seg på når trykket faller." },
    { id: "knapper", tittel: "Rød og sort knapp", tekst: "Rød knapp: tilhengerens parkeringsbrems. Ute = fjærbremsen på. Sort knapp: løser nødbremsen med luft fra tanken, bare for skifting. Spretter ut av seg selv når rød ledning får trykk.",
      sjafor: "Trekk ut rød knapp før du kobler fra. Den sorte knappen skal ikke brukes ved kjøring." },
    { id: "manometer", tittel: "Manometer og lamper", tekst: "Dobbeltmanometeret viser krets 1 (rød viser) og krets 2 (grønn viser). Lampen LAVT LUFTTRYKK tennes under 5,5 bar og slukker over 6 bar.",
      sjafor: "Sjekk manometeret før avreise. Kjør aldri med varsellampen tent." },
  ];

  const EKSTRA_SPORSMAL = [
    {
      q: "Hvilken farge har forsyningsledningen til tilhengeren?",
      a: ["Gul", "Rød", "Blå", "Sort"], r: 1,
      f: "Rød er forsyning. Gul er styreledning.",
    },
    {
      q: "Ved hvilket trykk tennes varsellampen for lavt lufttrykk i simulatoren?",
      a: ["2 bar", "5,5 bar", "8,5 bar", "10 bar"], r: 1,
      f: "Lampen tennes under 5,5 bar i krets 1 eller 2.",
    },
    {
      q: "Hva betyr det når lampen KJØREKLAR lyser i simulatoren?",
      a: ["Motoren går", "Trykket er OK, og ingen fjær- eller tilhengerbrems er på", "Tankene er tappet",
        "Kompressoren lader"],
      r: 1,
      f: "Lampen er laget for simulatoren og sammenfatter sjekkene før avreise.",
    },
    {
      q: "Bremsene foran og bak har egne kretser. Hvorfor?",
      a: ["For å spare luft", "Svikter én krets, kan du fortsatt bremse med den andre",
        "For å bremse hardere", "Det er tilfeldig"],
      r: 1,
      f: "To uavhengige driftsbremskretser gir en reserve hvis én svikter.",
    },
  ];

  const Innhold = { OPPDRAG, EKSPERIMENTER, SKJULTE_FEIL, FAGSTOFF, EKSTRA_SPORSMAL };
  if (typeof module !== "undefined" && module.exports) module.exports = Innhold;
  else global.Innhold = Innhold;
})(typeof window !== "undefined" ? window : globalThis);
