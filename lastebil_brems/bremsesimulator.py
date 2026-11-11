"""
bremsesimulator.py
==================
Interaktiv simulator av trykkluftbremsene på en lastebil - for opplæring til førerkort C/CE.

Start:  python bremsesimulator.py
Krever kun Python 3 (tkinter følger med standardinstallasjonen på Windows).

Hold tasten B (eller knappen "TRÅKK") inne for å tråkke bremsepedalen helt ned.
"""

import math
import random
import tkinter as tk
from collections import deque
from tkinter import messagebox, ttk

import bremsemodell as bm

TICK_MS = 50
HISTORIKK_S = 180.0
PROVE_S = 0.5
FONT = ("Segoe UI", 9)
FONT_FET = ("Segoe UI", 9, "bold")

SERIER = [  # (navn, farge, strek, funksjon)
    ("Krets 1", "#d62728", None, lambda m: m.tanker["K1"].trykk),
    ("Krets 2", "#2ca02c", None, lambda m: m.tanker["K2"].trykk),
    ("Krets 3", "#1f77b4", None, lambda m: m.tanker["K3"].trykk),
    ("Krets 4", "#9467bd", None, lambda m: m.tanker["K4"].trykk),
    ("Sylinder foran", "#ff7f0e", (4, 2), lambda m: m.foran.trykk),
    ("Sylinder bak", "#8c564b", (4, 2), lambda m: m.bak.trykk),
    ("Fjærbremsdel", "#17becf", (4, 2), lambda m: m.fjaer.trykk),
]

OVELSER = {
    "1. Fylle systemet fra tomt": (
        "MÅL: Se hvordan systemet bygger opp trykk.\n"
        "1) Systemet er tomt og parkeringsbremsen er på. Legg merke til at varsellampen lyser.\n"
        "2) Start motoren (huk av 'Motor går').\n"
        "3) Se at krets 1 og 2 fylles først (firekretsventilen prioriterer driftsbremsene).\n"
        "4) Varsellampen slukker når krets 1 og 2 er over 6 bar.\n"
        "5) Prøv å løse parkeringsbremsen (spak til 0) før krets 3 har nådd 5,5 bar - hva skjer?\n"
        "6) Vent til regulatoren kutter ut ved 10 bar. Les av tiden i loggen.\n"
        "7) Prøv igjen med høyt turtall. Går det raskere?\n"
        "TIPS: Sett simuleringsfarten til 5x for å slippe å vente."
    ),
    "2. Lekkasjekontroll (motor av)": (
        "MÅL: Kontrollere at systemet er tett.\n"
        "1) Systemet er fullt, motoren står og hjulene skal være sikret (klosser).\n"
        "2) Løs parkeringsbremsen (spak til 0). Følg med på manometeret i 1 minutt.\n"
        "3) Tråkk bremsen helt ned (hold B eller sett pedalen til 100) og hold i 1 minutt.\n"
        "   Trykket faller litt med en gang (luft går til sylindrene), men skal så stå stille.\n"
        "4) Sett en lekkasje på 'Bremsesylinder bak' (Middels) og gjenta. Ser du forskjellen?\n"
        "   Den lekkasjen merkes BARE når du bremser.\n"
        "Bruk produsentens/instruktørens grenseverdier for tillatt trykkfall."
    ),
    "3. Pumpetest og varsellampe": (
        "MÅL: Kontrollere at varsellampen virker og se hvor mye luft hver bremsing bruker.\n"
        "1) Systemet er fullt og motoren står.\n"
        "2) Pump bremsen: trykk og slipp B gjentatte ganger (ca. 1 sekund nede, 1 sekund oppe).\n"
        "3) Tell bremsetråkkene til varsellampen tennes (ca. 5,5 bar). Loggen teller for deg.\n"
        "4) Start motoren og se at lampen slukker igjen.\n"
        "LÆRDOM: Unødvendig pumping i bratte bakker tapper systemet for luft!"
    ),
    "4. Nødbrems: luftlekkasje i krets 3": (
        "MÅL: Forstå hvorfor fjærbremsen er en 'feilsikker' brems.\n"
        "1) Systemet er fullt, motoren står og parkeringsbremsen er løst.\n"
        "2) Øvelsen har lagt inn en STOR lekkasje i krets 3.\n"
        "3) Se trykket i krets 3 og fjærbremsdelen falle.\n"
        "4) Under ca. 5,5 bar begynner fjærbremsen å slå inn, under ca. 2 bar er den helt på.\n"
        "LÆRDOM: Fjærene holder bremsen på - det trengs LUFT for å løse dem. "
        "Mister du lufta, stopper bilen."
    ),
    "5. Kretssikring (firekretsventil)": (
        "MÅL: Se at en lekkasje i én krets ikke tømmer de andre.\n"
        "1) Systemet er fullt og motoren går på høyt turtall.\n"
        "2) Øvelsen har lagt inn en STOR lekkasje i krets 1 (bremsene foran).\n"
        "3) Se at krets 1 tømmes, mens krets 2, 3 og 4 holder trykket.\n"
        "4) Varsellampen lyser - du har fortsatt brems bak, men skal stoppe trygt!\n"
        "5) Tråkk på bremsen: hvilken aksel bremser nå?"
    ),
    "6. Finn feilen (skjult feil)": (
        "MÅL: Feilsøke som en sjåfør.\n"
        "Simulatoren har lagt inn en tilfeldig, skjult feil. Systemet er fullt, motoren står.\n"
        "Bruk det du har lært: lekkasjekontroll med og uten pedal, pumpetest, motorstart,\n"
        "tapping av tankene osv. Hvilken krets eller komponent er det noe galt med?\n"
        "Trykk 'Vis fasit' når du har en teori."
    ),
    "7. Vann i tankene (lufttørker)": (
        "MÅL: Forstå hvorfor lufttørkeren er viktig.\n"
        "1) Lufttørkeren er defekt. Systemet er tomt og motoren går.\n"
        "2) Se at det samler seg vann i tankene mens kompressoren lader.\n"
        "3) Trykk 'Tapp vann fra tankene'.\n"
        "LÆRDOM: Vann i systemet kan fryse om vinteren og ødelegge ventiler. "
        "Kommer det vann ved tapping, må lufttørkeren sjekkes."
    ),
}

SKJULTE_FEIL = [
    (("K1", "Middels"), "Lekkasje i krets 1 (tank/ledning, driftsbrems foran)."),
    (("K2", "Middels"), "Lekkasje i krets 2 (tank/ledning, driftsbrems bak)."),
    (("K3", "Middels"), "Lekkasje i krets 3 (parkering/fjærbrems)."),
    (("K4", "Middels"), "Lekkasje i krets 4 (tilleggsutstyr)."),
    (("Bak", "Middels"), "Lekkasje i bremsesylinder bak - merkes bare når pedalen er nede."),
    (("torker", None), "Defekt lufttørker - det kommer vann når tankene tappes."),
]


def trykkfarge(p):
    t = max(0.0, min(1.0, p / 10.0))
    c0, c1 = (205, 205, 205), (0, 80, 210)
    return "#%02x%02x%02x" % tuple(int(a + (b - a) * t) for a, b in zip(c0, c1))


class Simulator(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title("Bremsesimulator - lastebil med trykkluftbrems")
        self.m = bm.Bremsesystem()
        self.m.tom_systemet()
        self.pause = False
        self.pedal_holdt = False
        self.historikk = deque(maxlen=int(HISTORIKK_S / PROVE_S) + 1)
        self._neste_prove = 0.0
        self._logg_indeks = 0
        self._fasit = None
        self._bygg_gui()
        self.after(TICK_MS, self._tick)

    # ================================================================ GUI
    def _bygg_gui(self):
        venstre = ttk.Frame(self, padding=4)
        venstre.grid(row=0, column=0, sticky="nw")
        hoyre = ttk.Frame(self, padding=4)
        hoyre.grid(row=0, column=1, sticky="nsew")
        self.columnconfigure(1, weight=1)
        self.rowconfigure(0, weight=1)

        self.skjema = tk.Canvas(venstre, width=900, height=400, bg="white", highlightthickness=1,
                                highlightbackground="#999")
        self.skjema.pack()
        self.graf = tk.Canvas(venstre, width=900, height=150, bg="white", highlightthickness=1,
                              highlightbackground="#999")
        self.graf.pack(pady=(4, 0))
        self._tegn_skjema()
        self._tegn_graf_bakgrunn()

        self.faner = ttk.Notebook(hoyre)
        self.faner.pack(fill="x")
        fane_betjening = ttk.Frame(self.faner, padding=4)
        fane_feil = ttk.Frame(self.faner, padding=4)
        fane_ovelse = ttk.Frame(self.faner, padding=4)
        self.faner.add(fane_betjening, text="Betjening")
        self.faner.add(fane_feil, text="Feil")
        self.faner.add(fane_ovelse, text="Øvelser")
        self._bygg_betjening(fane_betjening)
        self._bygg_feil(fane_feil)
        self._bygg_ovelser(fane_ovelse)

        ttk.Label(hoyre, text="Hendelseslogg", font=FONT_FET).pack(anchor="w", pady=(6, 0))
        self.loggtekst = tk.Text(hoyre, width=48, height=6, font=("Consolas", 8), state="disabled",
                                 wrap="word")
        self.loggtekst.pack(fill="both", expand=True)
        self._vis_ovelsestekst("Velg en øvelse over og trykk 'Start øvelse', eller eksperimenter fritt.\n\n"
                               "Hold tasten B inne for å tråkke bremsepedalen helt ned.")

        self.bind_all("<KeyPress-b>", lambda e: self._pedal(True))
        self.bind_all("<KeyRelease-b>", lambda e: self._pedal(False))
        self.bind_all("<KeyPress-B>", lambda e: self._pedal(True))
        self.bind_all("<KeyRelease-B>", lambda e: self._pedal(False))

    def _boks(self, x0, y0, x1, y1, tittel, fyll="#f4f4f4"):
        c = self.skjema
        c.create_rectangle(x0, y0, x1, y1, fill=fyll, outline="#555", width=2)
        c.create_text((x0 + x1) / 2, y0 + 4, text=tittel, font=FONT_FET, anchor="n", width=x1 - x0 - 6,
                      justify="center")
        return c.create_text((x0 + x1) / 2, y1 - 4, text="", font=FONT, anchor="s", width=x1 - x0 - 6,
                             justify="center")

    def _linje(self, punkter, funksjon):
        item = self.skjema.create_line(*punkter, width=6, fill="#ccc", capstyle="round", joinstyle="round")
        self.linjer.append((item, funksjon))

    def _tegn_skjema(self):
        c = self.skjema
        m = self.m
        self.linjer = []
        self.tekst = {}

        tank_y = {"K1": (30, 90), "K2": (120, 180), "K3": (210, 270), "K4": (300, 360)}

        # Ledninger (tegnes først, så ligger boksene over)
        self._linje((120, 200, 145, 200), lambda: m.forsyning.trykk)
        self._linje((265, 200, 280, 200), lambda: m.forsyning.trykk)
        for k, (y0, y1) in tank_y.items():
            yc = (y0 + y1) / 2
            self._linje((360, yc, 390, yc), lambda k=k: m.tanker[k].trykk)
        self._linje((530, 60, 560, 80), lambda: m.tanker["K1"].trykk)
        self._linje((530, 150, 560, 140), lambda: m.tanker["K2"].trykk)
        self._linje((680, 80, 720, 50), lambda: m.foran.trykk)
        self._linje((680, 140, 720, 145), lambda: m.bak.trykk)
        self._linje((765, 170, 765, 220), lambda: m.bak.trykk)
        self._linje((530, 240, 560, 250), lambda: m.tanker["K3"].trykk)
        self._linje((680, 255, 720, 290), lambda: m.fjaer.trykk)
        self._linje((530, 330, 560, 340), lambda: m.tanker["K4"].trykk)

        # Komponenter
        self.tekst["komp"] = self._boks(15, 165, 120, 235, "Kompressor")
        self.tekst["tork"] = self._boks(145, 165, 265, 235, "Regulator + lufttørker")
        self.tekst["fire"] = self._boks(280, 30, 360, 360, "Fire-krets-\nventil")
        self.nivaa = {}
        for k, (y0, y1) in tank_y.items():
            c.create_rectangle(390, y0, 530, y1, fill="#f4f4f4", outline="#555", width=2)
            self.nivaa[k] = c.create_rectangle(392, y0 + 2, 392, y1 - 1, fill="#cfe0ff", outline="")
            c.create_text(460, y0 + 4, text=m.tanker[k].navn, font=FONT_FET, anchor="n", width=134,
                          justify="center")
            self.tekst[k] = c.create_text(460, y1 - 4, text="", font=FONT, anchor="s")
        self.tekst["fot"] = self._boks(560, 50, 680, 170, "Fotbrems-ventil (2 kretser)")
        self.tekst["foran"] = self._boks(720, 15, 890, 85, "Bremsesylindre foran")
        self.tekst["rele"] = self._boks(720, 120, 810, 170, "Relé-ventil")
        c.create_text(815, 145, text="luft fra\nkrets 2", font=("Segoe UI", 8), anchor="w", fill="#666")
        self.tekst["bak"] = self._boks(720, 220, 890, 325, "Kombisylindre bak")
        self.tekst["haand"] = self._boks(560, 215, 680, 290, "Håndbrems-ventil + relé")
        self.tekst["ekstra"] = self._boks(560, 315, 680, 365, "Gir, luftfjæring m.m.")

        # Manometer (dobbeltviser som i førerhuset)
        cx, cy, r = 75, 85, 58
        c.create_oval(cx - r, cy - r, cx + r, cy + r, fill="#222", outline="#888", width=3)
        for bar in range(0, 13):
            a = math.radians(225 - 270 * bar / 12)
            ri = r - (10 if bar % 2 == 0 else 6)
            c.create_line(cx + ri * math.cos(a), cy - ri * math.sin(a),
                          cx + (r - 2) * math.cos(a), cy - (r - 2) * math.sin(a), fill="white", width=2)
            if bar % 2 == 0:
                c.create_text(cx + (r - 19) * math.cos(a), cy - (r - 19) * math.sin(a), text=str(bar),
                              fill="white", font=("Segoe UI", 7))
        # rød sone under varselgrensen
        c.create_arc(cx - r + 3, cy - r + 3, cx + r - 3, cy + r - 3, start=225 - 270 * bm.VARSEL_PAA / 12,
                     extent=270 * bm.VARSEL_PAA / 12, style="arc", outline="#c33", width=3)
        c.create_text(cx, cy + 25, text="bar", fill="white", font=("Segoe UI", 7))
        self.viser1 = c.create_line(cx, cy, cx, cy, fill="#ff4040", width=3, arrow="last")
        self.viser2 = c.create_line(cx, cy, cx, cy, fill="#40ff40", width=3, arrow="last")
        c.create_oval(cx - 4, cy - 4, cx + 4, cy + 4, fill="#ddd")
        self.manometer = (cx, cy, r - 12)
        c.create_text(cx, cy + r + 9, text="rød = krets 1   grønn = krets 2", font=("Segoe UI", 7), fill="#444")

        self.tekst["status"] = c.create_text(145, 22, text="", font=FONT, anchor="nw", width=135)

        # Varsellamper
        self.lamper = {}
        for i, (nokkel, navn) in enumerate([("lavt", "LAVT LUFTTRYKK"), ("park", "FJÆRBREMS PÅ"),
                                            ("komp", "KOMPRESSOR LADER"), ("klar", "KJØREKLAR")]):
            y = 262 + i * 34
            self.lamper[nokkel] = c.create_oval(20, y, 44, y + 24, fill="#444", outline="#222")
            c.create_text(52, y + 12, text=navn, font=FONT_FET, anchor="w")

    def _tegn_graf_bakgrunn(self):
        g = self.graf
        self.gx0, self.gx1, self.gy0, self.gy1 = 40, 890, 25, 140
        for bar in range(0, 13, 2):
            y = self._gy(bar)
            g.create_line(self.gx0, y, self.gx1, y, fill="#eee")
            g.create_text(self.gx0 - 4, y, text=str(bar), anchor="e", font=("Segoe UI", 8))
        g.create_line(self.gx0, self._gy(bm.VARSEL_PAA), self.gx1, self._gy(bm.VARSEL_PAA), fill="#f99",
                      dash=(2, 2))
        g.create_rectangle(self.gx0, self.gy0, self.gx1, self.gy1, outline="#999")
        g.create_text(8, self.gy0 - 8, text="bar", anchor="w", font=("Segoe UI", 8))
        x = 70
        for navn, farge, strek, _ in SERIER:
            g.create_line(x, 10, x + 18, 10, fill=farge, width=2, dash=strek)
            t = g.create_text(x + 22, 10, text=navn, anchor="w", font=("Segoe UI", 8))
            x = g.bbox(t)[2] + 14
        g.create_text(self.gx1, 10, text="siste %d s" % HISTORIKK_S, anchor="e", font=("Segoe UI", 8),
                      fill="#666")

    def _gy(self, p):
        return self.gy1 - (self.gy1 - self.gy0) * min(p, 12) / 12

    def _bygg_betjening(self, f):
        rad = 0

        def overskrift(tekst):
            nonlocal rad
            ttk.Label(f, text=tekst, font=FONT_FET).grid(row=rad, column=0, columnspan=2, sticky="w",
                                                          pady=(6, 0))
            rad += 1

        overskrift("Motor")
        self.motor_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(f, text="Motor går", variable=self.motor_var,
                        command=lambda: self.m.sett_motor(self.motor_var.get())).grid(row=rad, column=0,
                                                                                    sticky="w")
        rad += 1
        self.turtall_var = tk.DoubleVar(value=600)
        tk.Scale(f, from_=600, to=2000, resolution=100, orient="horizontal", variable=self.turtall_var,
                 label="Turtall (o/min)", length=270).grid(row=rad, column=0, columnspan=2, sticky="w")
        rad += 1

        overskrift("Bremser")
        self.pedal_var = tk.DoubleVar(value=0)
        tk.Scale(f, from_=0, to=100, orient="horizontal", variable=self.pedal_var,
                 label="Bremsepedal (%)", length=270).grid(row=rad, column=0, columnspan=2, sticky="w")
        rad += 1
        knapp = tk.Button(f, text="TRÅKK (hold inne)  - eller hold tasten B", bg="#fdd", takefocus=0)
        knapp.grid(row=rad, column=0, columnspan=2, sticky="we", pady=2)
        knapp.bind("<ButtonPress-1>", lambda e: self._pedal(True))
        knapp.bind("<ButtonRelease-1>", lambda e: self._pedal(False))
        rad += 1
        self.haand_var = tk.DoubleVar(value=100)
        tk.Scale(f, from_=0, to=100, orient="horizontal", variable=self.haand_var,
                 label="Håndbremsspak (0 = kjør, 100 = parkert)", length=270).grid(row=rad, column=0,
                                                                                 columnspan=2, sticky="w")
        rad += 1

        overskrift("Simulering")
        ttk.Label(f, text="Fart:").grid(row=rad, column=0, sticky="w")
        self.fart_var = tk.StringVar(value="1x")
        ttk.Combobox(f, textvariable=self.fart_var, values=["1x", "2x", "5x", "10x", "20x"], state="readonly",
                     width=6).grid(row=rad, column=1, sticky="w")
        rad += 1
        knapper = ttk.Frame(f)
        knapper.grid(row=rad, column=0, columnspan=2, sticky="we", pady=2)
        self.pause_knapp = ttk.Button(knapper, text="Pause", command=self._veksle_pause, takefocus=0)
        self.pause_knapp.pack(side="left", expand=True, fill="x")
        ttk.Button(knapper, text="Tøm systemet", command=self.m.tom_systemet, takefocus=0).pack(
            side="left", expand=True, fill="x")
        ttk.Button(knapper, text="Fyll (10 bar)", command=self.m.fyll_systemet, takefocus=0).pack(
            side="left", expand=True, fill="x")

    def _bygg_feil(self, f):
        ttk.Label(f, text="Lekkasjer", font=FONT_FET).grid(row=0, column=0, columnspan=2, sticky="w")
        self.lekk_var = {}
        for i, (punkt, navn) in enumerate(bm.LEKKASJEPUNKT.items(), start=1):
            ttk.Label(f, text=navn, font=("Segoe UI", 8), wraplength=190).grid(row=i, column=0, sticky="w",
                                                                              pady=2)
            v = tk.StringVar(value="Ingen")
            ttk.Combobox(f, textvariable=v, values=list(bm.LEKKASJENIVAA), state="readonly",
                         width=9).grid(row=i, column=1, sticky="e", padx=(6, 0))
            self.lekk_var[punkt] = v
        rad = len(bm.LEKKASJEPUNKT) + 1
        ttk.Label(f, text="Lufttørker", font=FONT_FET).grid(row=rad, column=0, columnspan=2, sticky="w",
                                                            pady=(10, 0))
        self.torker_var = tk.BooleanVar(value=False)
        ttk.Checkbutton(f, text="Lufttørker defekt", variable=self.torker_var, takefocus=0,
                        command=lambda: self.m.sett_torker(self.torker_var.get())).grid(row=rad + 1, column=0,
                                                                                       sticky="w", pady=2)
        ttk.Button(f, text="Tapp vann fra tankene", command=self.m.tapp_vann, takefocus=0).grid(
            row=rad + 2, column=0, columnspan=2, sticky="we")

    def _bygg_ovelser(self, f):
        self.ovelse_var = tk.StringVar(value=list(OVELSER)[0])
        ttk.Combobox(f, textvariable=self.ovelse_var, values=list(OVELSER), state="readonly", width=44).pack(
            fill="x")
        knapper = ttk.Frame(f)
        knapper.pack(fill="x", pady=2)
        ttk.Button(knapper, text="Start øvelse", command=self._start_ovelse, takefocus=0).pack(
            side="left", expand=True, fill="x")
        ttk.Button(knapper, text="Vis fasit", command=self._vis_fasit, takefocus=0).pack(
            side="left", expand=True, fill="x")
        self.ovelsestekst = tk.Text(f, width=44, height=16, font=FONT, state="disabled", wrap="word",
                                    bg="#fffbe8")
        self.ovelsestekst.pack(fill="both", expand=True)

    # ============================================================ handlinger
    def _pedal(self, nede):
        self.pedal_holdt = nede

    def _veksle_pause(self):
        self.pause = not self.pause
        self.pause_knapp.config(text="Fortsett" if self.pause else "Pause")

    def _sett_kontroller(self, motor=False, turtall=600, haand=100, lekk=None, torker=False, fyll=True):
        self.pedal_var.set(0)
        self.pedal_holdt = False
        self.turtall_var.set(turtall)
        self.haand_var.set(haand)
        self.m.sett_haandbrems(haand / 100)
        for punkt, v in self.lekk_var.items():
            v.set((lekk or {}).get(punkt, "Ingen"))
        self.torker_var.set(torker)
        self.m.sett_torker(torker)
        self.m.skjult_feil = None
        self._fasit = None
        self.m.pumpetall = 0
        if fyll:
            self.m.fyll_systemet()
        else:
            self.m.tom_systemet()
        self.motor_var.set(motor)
        self.m.sett_motor(motor)

    def _start_ovelse(self):
        navn = self.ovelse_var.get()
        nr = navn.split(".")[0]
        self.m._logg("=== Øvelse startet: %s ===" % navn)
        if nr == "1":
            self._sett_kontroller(motor=False, haand=100, fyll=False)
        elif nr == "2":
            self._sett_kontroller(motor=False, haand=100)
        elif nr == "3":
            self._sett_kontroller(motor=False, haand=100)
        elif nr == "4":
            self._sett_kontroller(motor=False, haand=0, lekk={"K3": "Stor"})
        elif nr == "5":
            self._sett_kontroller(motor=True, turtall=1500, haand=100, lekk={"K1": "Stor"})
        elif nr == "6":
            self._sett_kontroller(motor=False, haand=100)
            feil, self._fasit = random.choice(SKJULTE_FEIL)
            self.m.skjult_feil = feil
        elif nr == "7":
            self._sett_kontroller(motor=False, haand=100, torker=True, fyll=False)
            self.motor_var.set(True)
            self.m.sett_motor(True)
            self.fart_var.set("5x")
        self._vis_ovelsestekst(navn + "\n\n" + OVELSER[navn])

    def _vis_fasit(self):
        if self._fasit:
            messagebox.showinfo("Fasit", "Den skjulte feilen var:\n\n" + self._fasit)
        else:
            messagebox.showinfo("Fasit", "Ingen skjult feil er lagt inn. Start øvelse 6 først.")

    def _vis_ovelsestekst(self, tekst):
        self.ovelsestekst.config(state="normal")
        self.ovelsestekst.delete("1.0", "end")
        self.ovelsestekst.insert("1.0", tekst)
        self.ovelsestekst.config(state="disabled")

    # ============================================================== løkke
    def _tick(self):
        try:
            if not self.pause:
                m = self.m
                m.pedal = 1.0 if self.pedal_holdt else self.pedal_var.get() / 100.0
                m.turtall = self.turtall_var.get()
                m.sett_haandbrems(self.haand_var.get() / 100.0)
                for punkt, v in self.lekk_var.items():
                    m.lekkasje[punkt] = v.get()
                faktor = float(self.fart_var.get().rstrip("x"))
                m.kjor(TICK_MS / 1000.0 * faktor)
                if m.tid >= self._neste_prove:
                    self.historikk.append((m.tid, [f(m) for _, _, _, f in SERIER]))
                    self._neste_prove = m.tid + PROVE_S
            self._oppdater_visning()
        finally:
            self.after(TICK_MS, self._tick)

    def _oppdater_visning(self):
        m = self.m
        c = self.skjema
        for item, f in self.linjer:
            c.itemconfig(item, fill=trykkfarge(f()))

        for k, t in m.tanker.items():
            x0, y0, _, y1 = c.coords(self.nivaa[k])
            c.coords(self.nivaa[k], x0, y0, x0 + 136 * min(t.trykk, 12) / 12, y1)
            vann = "   vann: %.0f ml" % t.vann if t.vann >= 1 else ""
            c.itemconfig(self.tekst[k], text="%.2f bar%s" % (t.trykk, vann),
                         fill="#c00" if t.vann >= 1 else "black")

        komp = ("LADER" if m.lader else "tomgang") if m.motor_paa else "står"
        c.itemconfig(self.tekst["komp"], text=komp)
        c.itemconfig(self.tekst["tork"], text="%.2f bar\n%s" % (
            m.forsyning.trykk, "DEFEKT" if m.torker_defekt else "ut %.1f / inn %.1f" % (bm.UTKOBLING,
                                                                                         bm.INNKOBLING)))
        c.itemconfig(self.tekst["fire"], text="sikrer\nkretsene\nhver for\nseg")
        c.itemconfig(self.tekst["fot"], text="pedal %.0f %%\nstyretrykk %.1f bar" % (
            m.pedal * 100, m.pedal * bm.P_STYR_MAKS))
        c.itemconfig(self.tekst["foran"], text="%.2f bar   bremsekraft %.0f %%" % (
            m.foran.trykk, m.bremsekraft_foran * 100))
        c.itemconfig(self.tekst["rele"], text="%.2f bar" % m.bak.trykk)
        c.itemconfig(self.tekst["bak"], text="driftsbremsdel: %.2f bar\nfjærbremsdel: %.2f bar\n"
                                             "fjærbrems %.0f %% på\nbremsekraft bak %.0f %%" % (
                         m.bak.trykk, m.fjaer.trykk, m.fjaerbrems_andel * 100, m.bremsekraft_bak * 100))
        c.itemconfig(self.tekst["haand"], text="spak %.0f %%\n%.2f bar ut" % (m.haandbrems * 100, m.fjaer.trykk))
        c.itemconfig(self.tekst["ekstra"], text="")

        cx, cy, r = self.manometer
        for viser, p in ((self.viser1, m.tanker["K1"].trykk), (self.viser2, m.tanker["K2"].trykk)):
            a = math.radians(225 - 270 * min(p, 12) / 12)
            c.coords(viser, cx, cy, cx + r * math.cos(a), cy - r * math.sin(a))
        c.itemconfig(self.tekst["status"], text="Tid: %.0f s\nMotor: %s\n%.0f o/min\nBremsetråkk: %d" % (
            m.tid, "går" if m.motor_paa else "av", m.turtall, m.pumpetall))

        c.itemconfig(self.lamper["lavt"], fill="#ff2020" if m.varsel else "#444")
        c.itemconfig(self.lamper["park"], fill="#ff2020" if m.fjaerbrems_andel > 0.02 else "#444")
        c.itemconfig(self.lamper["komp"], fill="#ffbf00" if (m.motor_paa and m.lader) else "#444")
        c.itemconfig(self.lamper["klar"], fill="#20c020" if m.kjoreklar else "#444")

        self._tegn_graf()

        if self._logg_indeks < len(m.logg):
            self.loggtekst.config(state="normal")
            for t, tekst in m.logg[self._logg_indeks:]:
                self.loggtekst.insert("end", "[%6.1f s] %s\n" % (t, tekst))
            self._logg_indeks = len(m.logg)
            self.loggtekst.see("end")
            self.loggtekst.config(state="disabled")

    def _tegn_graf(self):
        g = self.graf
        g.delete("kurve")
        if len(self.historikk) < 2:
            return
        t_slutt = self.m.tid
        t_start = t_slutt - HISTORIKK_S
        bredde = self.gx1 - self.gx0
        for i, (_, farge, strek, _) in enumerate(SERIER):
            pkt = []
            for t, verdier in self.historikk:
                if t < t_start:
                    continue
                pkt += [self.gx0 + bredde * (t - t_start) / HISTORIKK_S, self._gy(verdier[i])]
            if len(pkt) >= 4:
                g.create_line(*pkt, fill=farge, width=2, dash=strek, tags="kurve")


if __name__ == "__main__":
    Simulator().mainloop()
