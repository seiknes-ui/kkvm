"""
bremsemodell.py
================
Fysikkmodell av trykkluftbremsesystemet på en lastebil (motorvogn, uten tilhenger).

Modellerte komponenter:
  * Kompressor (ytelse avhenger av turtall og mottrykk)
  * Trykkregulator med utkoblings-/innkoblingstrykk og lufttørker
  * Firekretsventil (sikrer at en lekkasje i én krets ikke tømmer de andre)
  * Lufttanker for krets 1-4
  * Fotbremsventil (to kretser) -> bremsesylindre foran (krets 1)
                                -> reléventil -> kombisylindre bak (krets 2)
  * Håndbremsventil + relé (krets 3) -> fjærbremsdelen i kombisylindrene bak
  * Lekkasjer, vann i tankene, varsellampe for lavt trykk

Enheter: trykk i bar overtrykk (manometertrykk), volum i liter,
luftmengde i normalliter (NL = liter luft ved atmosfæretrykk).

Verdiene er typiske/omtrentlige og ment for opplæring. Følg alltid
produsentens verdier og instruktørens anvisninger for et konkret kjøretøy.
"""

from dataclasses import dataclass

ATM = 1.0  # bar absolutt, atmosfæretrykk

# --- Kompressor og regulator -------------------------------------------------
UTKOBLING = 10.0          # regulator kutter ut (stopper lading) ved dette trykket
INNKOBLING = 8.5          # regulator kutter inn (starter lading) igjen
KOMP_NL_PER_RPM = 0.011   # NL/s per o/min  (600 o/min ~ 6,6 NL/s ~ 400 l/min)
KOMP_MAKS_TRYKK = 14.0    # kompressorens ytelse går mot null ved dette trykket

# --- Firekretsventil: (lukketrykk, åpningstrykk) per krets -------------------
# Krets 1 og 2 (driftsbrems) har prioritet og fylles først.
FIREKRETS = {
    "K1": (6.0, 7.0),
    "K2": (6.0, 7.0),
    "K3": (6.5, 7.5),
    "K4": (6.5, 7.5),
}
K_FIREKRETS = 3.0         # gjennomstrømning, NL/s per bar trykkforskjell

# --- Driftsbrems ---------------------------------------------------------------
P_STYR_MAKS = 10.0        # styretrykk ved helt nedtråkket pedal
P_FULL_BREMS = 8.0        # sylindertrykk som gir 100 % bremsekraft
K_FYLL = 5.0              # fylling av bremsesylindre, NL/s per bar
K_TOM = 6.0               # utlufting av bremsesylindre, NL/s per bar
DODBAND = 0.05            # bar, ventilens dødbånd

# --- Fjærbrems -----------------------------------------------------------------
P_FJAER_LOS = 5.5         # over dette trykket er fjærbremsen helt løst
P_FJAER_PAA = 2.0         # under dette trykket er fjærbremsen helt på
FJAER_KRAFT = 0.8         # fjærbremsens kraft i forhold til full driftsbrems bak

# --- Varsling ------------------------------------------------------------------
VARSEL_PAA = 5.5          # varsellampe tennes under dette trykket (krets 1 eller 2)
VARSEL_AV = 6.0           # varsellampe slukker over dette trykket

# --- Lekkasjer (NL/s per bar) og vann ------------------------------------------
LEKKASJENIVAA = {"Ingen": 0.0, "Liten": 0.004, "Middels": 0.03, "Stor": 4.0}
LEKKASJEPUNKT = {
    "K1": "Tank krets 1 (driftsbrems foran)",
    "K2": "Tank krets 2 (driftsbrems bak)",
    "K3": "Tank krets 3 (parkering/fjærbrems)",
    "K4": "Tank krets 4 (tilleggsutstyr)",
    "Bak": "Bremsesylinder bak (lekker bare ved bremsing)",
}
VANN_PER_NL = 0.05        # ml vann per NL luft når lufttørkeren er defekt


def _klem(x, lo=0.0, hi=1.0):
    return max(lo, min(hi, x))


@dataclass
class Beholder:
    """Et luftvolum (tank, ledning eller sylinder) med ett felles trykk."""
    navn: str
    volum: float           # liter
    trykk: float = 0.0     # bar overtrykk
    vann: float = 0.0      # ml

    def luft(self):
        return (self.trykk + ATM) * self.volum

    def tilfor(self, nl):
        """Tilfør (positiv) eller fjern (negativ) luftmengde i NL."""
        self.trykk = max(0.0, (self.luft() + nl) / self.volum - ATM)


def overfor(fra, til, k, dt, maks_til=None):
    """Luftstrøm fra et volum til et annet (kun i retning fra høyt til lavt trykk)."""
    dp = fra.trykk - til.trykk
    if dp <= 0 or k <= 0:
        return 0.0
    q = k * dp * dt
    q = min(q, dp * fra.volum * til.volum / (fra.volum + til.volum))  # ikke forbi utjevning
    if maks_til is not None:
        q = min(q, max(0.0, (maks_til - til.trykk) * til.volum))
    fra.tilfor(-q)
    til.tilfor(q)
    return q


def slipp_ut(node, k, dt, ned_til=0.0):
    """Luft slippes ut til atmosfæren (utlufting eller lekkasje)."""
    over = node.trykk - ned_til
    if over <= 0 or k <= 0:
        return 0.0
    q = min(k * node.trykk * dt, over * node.volum)
    node.tilfor(-q)
    return q


class Bremsesystem:
    def __init__(self):
        self.tid = 0.0
        self.forsyning = Beholder("Forsyningsledning / lufttørker", 5.0)
        self.tanker = {
            "K1": Beholder("Krets 1 - driftsbrems foran", 20.0),
            "K2": Beholder("Krets 2 - driftsbrems bak", 30.0),
            "K3": Beholder("Krets 3 - parkering/fjærbrems", 20.0),
            "K4": Beholder("Krets 4 - tilleggsutstyr", 10.0),
        }
        self.foran = Beholder("Bremsesylindre foran", 1.2)
        self.bak = Beholder("Kombisylindre bak - driftsbremsdel", 1.6)
        self.fjaer = Beholder("Kombisylindre bak - fjærbremsdel", 2.4)

        # Betjening
        self.motor_paa = False
        self.turtall = 600.0
        self.pedal = 0.0          # 0..1
        self.haandbrems = 1.0     # 0 = kjørestilling, 1 = parkert
        self.torker_defekt = False
        self.lekkasje = {k: "Ingen" for k in LEKKASJEPUNKT}
        self.skjult_feil = None   # f.eks. ("K2", "Middels") eller ("torker", None)

        # Tilstand
        self.lader = True
        self.varsel = True
        self.pumpetall = 0
        self.pumpet_nl = 0.0
        self.logg = []
        self._pedal_nede = False
        self._motor_start = None
        self._fjaer_status = "paa"

    # ------------------------------------------------------------------ hjelp
    def _logg(self, tekst):
        self.logg.append((self.tid, tekst))

    def alle_noder(self):
        return [self.forsyning, *self.tanker.values(), self.foran, self.bak, self.fjaer]

    def _lekk_k(self, punkt):
        k = LEKKASJENIVAA[self.lekkasje.get(punkt, "Ingen")]
        if self.skjult_feil and self.skjult_feil[0] == punkt:
            k = max(k, LEKKASJENIVAA[self.skjult_feil[1]])
        return k

    def _vann_inn(self):
        return self.torker_defekt or (self.skjult_feil is not None and self.skjult_feil[0] == "torker")

    # ------------------------------------------------------------ avlesninger
    @property
    def fjaerbrems_andel(self):
        """0 = fjærbremsen helt løst, 1 = helt på."""
        return _klem((P_FJAER_LOS - self.fjaer.trykk) / (P_FJAER_LOS - P_FJAER_PAA))

    @property
    def bremsekraft_foran(self):
        return _klem(self.foran.trykk / P_FULL_BREMS)

    @property
    def bremsekraft_bak(self):
        # Overbelastningsvern (anti-compound): drift- og fjærbrems legges ikke sammen.
        return max(_klem(self.bak.trykk / P_FULL_BREMS), self.fjaerbrems_andel * FJAER_KRAFT)

    @property
    def kjoreklar(self):
        return not self.varsel and self.fjaerbrems_andel < 0.02

    # ------------------------------------------------------------- betjening
    def sett_motor(self, paa):
        if paa and not self.motor_paa:
            self._motor_start = self.tid
            self._logg("Motoren startet.")
        elif not paa and self.motor_paa:
            self._motor_start = None
            self._logg("Motoren stoppet - kompressoren lader ikke lenger.")
        self.motor_paa = paa

    def sett_haandbrems(self, h):
        h = _klem(h)
        if h < 0.05 <= self.haandbrems:
            self._logg("Håndbremsspaken satt i kjørestilling.")
            if self.tanker["K3"].trykk < P_FJAER_LOS:
                self._logg("  ... men trykket i krets 3 er under %.1f bar - fjærbremsen kan ikke løses helt."
                           % P_FJAER_LOS)
        elif h >= 0.95 > self.haandbrems:
            self._logg("Håndbremsspaken satt i parkeringsstilling.")
        self.haandbrems = h

    def sett_torker(self, defekt):
        if defekt and not self.torker_defekt:
            self._logg("Lufttørkeren er defekt - fuktig luft sendes ut i tankene.")
        self.torker_defekt = defekt

    def tom_systemet(self):
        for n in self.alle_noder():
            n.trykk = 0.0
        self.lader = True
        self._oppdater_varsel(stille=True)
        self._fjaer_status = "paa"
        self._logg("Systemet er tømt for luft (0 bar).")

    def fyll_systemet(self):
        self.forsyning.trykk = UTKOBLING
        for t in self.tanker.values():
            t.trykk = UTKOBLING
        self.foran.trykk = self.bak.trykk = 0.0
        self.fjaer.trykk = 0.0 if self.haandbrems >= 0.95 else UTKOBLING * (1 - self.haandbrems)
        self.lader = False
        self._oppdater_varsel(stille=True)
        self._fjaer_status = "los" if self.fjaerbrems_andel < 0.02 else "paa"
        self._logg("Systemet er fylt til %.1f bar." % UTKOBLING)

    def tapp_vann(self):
        vann = sum(t.vann for t in self.tanker.values())
        for t in self.tanker.values():
            t.vann = 0.0
            t.tilfor(-2.0)  # litt luft går ut gjennom tappeventilen
        if vann >= 1:
            self._logg("Tappet tankene: %.0f ml vann kom ut! Lufttørkeren må sjekkes." % vann)
        else:
            self._logg("Tappet tankene: bare luft kom ut, ikke vann.")

    # ------------------------------------------------------------- simulering
    def kjor(self, sekunder, dt=0.005):
        n = max(1, int(round(sekunder / dt)))
        for _ in range(n):
            self.steg(sekunder / n)

    def steg(self, dt):
        self.tid += dt

        # 1) Regulator og kompressor
        p_s = self.forsyning.trykk
        if self.lader and p_s >= UTKOBLING:
            self.lader = False
            self._logg("Regulatoren kutter ut ved %.1f bar - lufttørkeren blåser ut (pssst!)." % p_s)
            if self._motor_start is not None:
                self._logg("  Tid fra motorstart til utkobling: %.0f s." % (self.tid - self._motor_start))
                self._motor_start = None
        elif not self.lader and p_s <= INNKOBLING:
            self.lader = True
            self._logg("Regulatoren kutter inn ved %.1f bar - %s" % (
                p_s, "kompressoren lader igjen." if self.motor_paa else "men motoren står, så ingen lading."))
        if self.motor_paa and self.lader:
            q = self.turtall * KOMP_NL_PER_RPM * max(0.0, 1 - p_s / KOMP_MAKS_TRYKK) * dt
            self.forsyning.tilfor(q)
            self.pumpet_nl += q

        # 2) Firekretsventil
        for nokkel, (p_lukk, p_aapen) in FIREKRETS.items():
            aapning = _klem((self.forsyning.trykk - p_lukk) / (p_aapen - p_lukk))
            if aapning > 0:
                tank = self.tanker[nokkel]
                q = overfor(self.forsyning, tank, K_FIREKRETS * aapning, dt)
                if self._vann_inn():
                    tank.vann += q * VANN_PER_NL

        # 3) Fotbremsventil: krets 1 -> foran, krets 2 -> reléventil -> bak
        maal = self.pedal * P_STYR_MAKS
        self._styr_sylinder(self.tanker["K1"], self.foran, maal, dt)
        self._styr_sylinder(self.tanker["K2"], self.bak, maal, dt)

        # 4) Håndbremsventil + relé: krets 3 -> fjærbremsdelen
        k3 = self.tanker["K3"]
        maal_fj = 0.0 if self.haandbrems >= 0.95 else k3.trykk * (1 - self.haandbrems)
        self._styr_sylinder(k3, self.fjaer, maal_fj, dt)

        # 5) Lekkasjer
        for punkt in ("K1", "K2", "K3", "K4"):
            slipp_ut(self.tanker[punkt], self._lekk_k(punkt), dt)
        slipp_ut(self.bak, self._lekk_k("Bak"), dt)

        # 6) Pumpetelling, varsling og fjærbremsstatus
        if self.pedal > 0.8 and not self._pedal_nede:
            self._pedal_nede = True
            self.pumpetall += 1
            self._logg("Bremsetråkk nr. %d  (krets 1: %.1f bar, krets 2: %.1f bar)"
                       % (self.pumpetall, self.tanker["K1"].trykk, self.tanker["K2"].trykk))
        elif self.pedal < 0.2:
            self._pedal_nede = False
        self._oppdater_varsel()
        self._oppdater_fjaer()

    def _styr_sylinder(self, tank, sylinder, maal, dt):
        """Balansert ventil: fyller fra tanken eller lufter ut til trykket er lik målet."""
        if sylinder.trykk < maal - DODBAND:
            overfor(tank, sylinder, K_FYLL, dt, maks_til=maal)
        elif sylinder.trykk > maal + DODBAND:
            slipp_ut(sylinder, K_TOM, dt, ned_til=maal)

    def _oppdater_varsel(self, stille=False):
        p_min = min(self.tanker["K1"].trykk, self.tanker["K2"].trykk)
        if not self.varsel and p_min < VARSEL_PAA:
            self.varsel = True
            if not stille:
                self._logg("VARSEL: Lavt lufttrykk! (krets 1: %.1f bar, krets 2: %.1f bar) - STOPP, ikke kjør!"
                           % (self.tanker["K1"].trykk, self.tanker["K2"].trykk))
        elif self.varsel and p_min > VARSEL_AV:
            self.varsel = False
            if not stille:
                self._logg("Varsellampen slukket - trykket i krets 1 og 2 er over %.1f bar." % VARSEL_AV)

    def _oppdater_fjaer(self):
        a = self.fjaerbrems_andel
        ny = "los" if a < 0.02 else ("paa" if a > 0.98 else "delvis")
        if ny == self._fjaer_status:
            return
        kjorestilling = self.haandbrems < 0.05
        if ny == "los":
            self._logg("Fjærbremsen er helt løst.")
        elif ny == "paa":
            if kjorestilling:
                self._logg("NØDBREMS: Fjærbremsen har slått seg på av lavt trykk i krets 3!")
            else:
                self._logg("Fjærbremsen er helt på (parkert).")
        elif kjorestilling and self._fjaer_status == "los":
            self._logg("Fjærbremsen begynner å slå inn - trykket i krets 3 er %.1f bar." % self.tanker["K3"].trykk)
        self._fjaer_status = ny
