/*
 * bremsemodell.js
 * ===============
 * Fysikkmodell av trykkluftbremsesystemet på en lastebil med tilhenger.
 * Direkte overføring av lastebil_brems/bremsemodell.py til JavaScript, med samme
 * komponenter, konstanter og loggmeldinger.
 *
 * Enheter: trykk i bar overtrykk, volum i liter, luftmengde i normalliter (NL).
 * Verdiene er typiske/omtrentlige og ment for opplæring.
 */
(function (global) {
  "use strict";

  const ATM = 1.0;

  // --- Kompressor og regulator ---------------------------------------------
  const UTKOBLING = 10.0;
  const INNKOBLING = 8.5;
  const KOMP_NL_PER_RPM = 0.011;
  const KOMP_MAKS_TRYKK = 14.0;

  // --- Firekretsventil: [lukketrykk, åpningstrykk] per krets ---------------
  const FIREKRETS = { K1: [6.0, 7.0], K2: [6.0, 7.0], K3: [6.5, 7.5], K4: [6.5, 7.5] };
  const K_FIREKRETS = 3.0;

  // --- Driftsbrems ---------------------------------------------------------
  const P_STYR_MAKS = 10.0;
  const P_FULL_BREMS = 8.0;
  const K_FYLL = 5.0;
  const K_TOM = 6.0;
  const DODBAND = 0.05;

  // --- Fjærbrems -----------------------------------------------------------
  const P_FJAER_LOS = 5.5;
  const P_FJAER_PAA = 2.0;
  const FJAER_KRAFT = 0.8;

  // --- Varsling ------------------------------------------------------------
  const VARSEL_PAA = 5.5;
  const VARSEL_AV = 6.0;

  // --- Lekkasjer (NL/s per bar) og vann ------------------------------------
  const LEKKASJENIVAA = { Ingen: 0.0, Liten: 0.004, Middels: 0.03, Stor: 4.0 };
  const LEKKASJEPUNKT = {
    K1: "Tank krets 1 (driftsbrems foran)",
    K2: "Tank krets 2 (driftsbrems bak)",
    K3: "Tank krets 3 (parkering/fjærbrems)",
    K4: "Tank krets 4 (tilleggsutstyr)",
    Bak: "Bremsesylinder bak (lekker bare ved bremsing)",
  };
  const VANN_PER_NL = 0.05;

  // --- Tilhenger -----------------------------------------------------------
  const P_ROD = 8.5;
  const OVERSTROM = [6.0, 7.0];
  const K_ROD = 4.0;
  const K_GUL_FYLL = 2.0;
  const K_TILH_TANK = 3.0;
  const P_NOD_LOS = 5.0;
  const P_NOD_PAA = 2.5;
  const TP_TID = 1.0;
  const LEKKASJEPUNKT_TILHENGER = {
    Rod: "Rød ledning (forsyning)",
    Gul: "Gul ledning (styreledning) - revnet slange",
    TT: "Tilhengerens lufttank",
  };

  function klem(x, lo = 0.0, hi = 1.0) {
    return Math.max(lo, Math.min(hi, x));
  }

  function fmt(x, d) {
    return x.toFixed(d).replace(".", ",");
  }

  class Beholder {
    constructor(navn, volum, trykk = 0.0) {
      this.navn = navn;
      this.volum = volum;
      this.trykk = trykk;
      this.vann = 0.0;
    }
    luft() {
      return (this.trykk + ATM) * this.volum;
    }
    tilfor(nl) {
      this.trykk = Math.max(0.0, (this.luft() + nl) / this.volum - ATM);
    }
  }

  function overfor(fra, til, k, dt, maksTil) {
    const dp = fra.trykk - til.trykk;
    if (dp <= 0 || k <= 0) return 0.0;
    let q = k * dp * dt;
    q = Math.min(q, (dp * fra.volum * til.volum) / (fra.volum + til.volum));
    if (maksTil !== undefined) q = Math.min(q, Math.max(0.0, (maksTil - til.trykk) * til.volum));
    fra.tilfor(-q);
    til.tilfor(q);
    return q;
  }

  function slippUt(node, k, dt, nedTil = 0.0) {
    const over = node.trykk - nedTil;
    if (over <= 0 || k <= 0) return 0.0;
    const q = Math.min(k * node.trykk * dt, over * node.volum);
    node.tilfor(-q);
    return q;
  }

  class Bremsesystem {
    constructor() {
      this.tid = 0.0;
      this.forsyning = new Beholder("Forsyningsledning / lufttørker", 5.0);
      this.tanker = {
        K1: new Beholder("Krets 1 - driftsbrems foran", 20.0),
        K2: new Beholder("Krets 2 - driftsbrems bak", 30.0),
        K3: new Beholder("Krets 3 - parkering/fjærbrems", 20.0),
        K4: new Beholder("Krets 4 - tilleggsutstyr", 10.0),
      };
      this.foran = new Beholder("Bremsesylindre foran", 1.2);
      this.bak = new Beholder("Kombisylindre bak - driftsbremsdel", 1.6);
      this.fjaer = new Beholder("Kombisylindre bak - fjærbremsdel", 2.4);
      this.rod = new Beholder("Rød ledning (forsyning)", 1.0);
      this.gul = new Beholder("Gul ledning (styreledning)", 0.5);
      this.t_tank = new Beholder("Tilhengertank", 60.0);
      this.t_drift = new Beholder("Tilhenger - bremsesylindre", 4.0);
      this.t_fjaer = new Beholder("Tilhenger - fjærbremsdel", 4.8);

      // Betjening
      this.motor_paa = false;
      this.turtall = 600.0;
      this.pedal = 0.0;
      this.haandbrems = 1.0;
      this.torker_defekt = false;
      this.lekkasje = {};
      for (const k of [...Object.keys(LEKKASJEPUNKT), ...Object.keys(LEKKASJEPUNKT_TILHENGER)]) {
        this.lekkasje[k] = "Ingen";
      }
      this.skjult_feil = null; // f.eks. ["K2", "Middels"] eller ["torker", null]
      this.rod_koblet = true;
      this.gul_koblet = true;
      this.t_rod_knapp_ute = false;
      this.t_sort_knapp_inne = false;
      this.kontrollstilling = false;

      // Tilstand
      this.lader = true;
      this.varsel = true;
      this.pumpetall = 0;
      this.pumpet_nl = 0.0;
      this.logg = [];
      this._pedal_nede = false;
      this._motor_start = null;
      this._fjaer_status = "paa";
      this.tp_aktiv = false;
      this._tp_teller = 0.0;
      this._t_nod_status = "paa";
      this._t_fjaer_status = "los";
    }

    // ---------------------------------------------------------------- hjelp
    _logg(tekst) {
      this.logg.push([this.tid, tekst]);
    }

    alleNoder() {
      return [this.forsyning, ...Object.values(this.tanker), this.foran, this.bak, this.fjaer,
        this.rod, this.gul, this.t_tank, this.t_drift, this.t_fjaer];
    }

    _lekk_k(punkt) {
      let k = LEKKASJENIVAA[this.lekkasje[punkt] || "Ingen"];
      if (this.skjult_feil && this.skjult_feil[0] === punkt) {
        k = Math.max(k, LEKKASJENIVAA[this.skjult_feil[1]]);
      }
      return k;
    }

    _vann_inn() {
      return this.torker_defekt || (this.skjult_feil !== null && this.skjult_feil[0] === "torker");
    }

    // ---------------------------------------------------------- avlesninger
    get fjaerbrems_andel() {
      return klem((P_FJAER_LOS - this.fjaer.trykk) / (P_FJAER_LOS - P_FJAER_PAA));
    }
    get bremsekraft_foran() {
      return klem(this.foran.trykk / P_FULL_BREMS);
    }
    get bremsekraft_bak() {
      // Overbelastningsvern: drift- og fjærbrems legges ikke sammen.
      return Math.max(klem(this.bak.trykk / P_FULL_BREMS), this.fjaerbrems_andel * FJAER_KRAFT);
    }
    get rod_tilhengerside() {
      return this.rod_koblet ? this.rod.trykk : 0.0;
    }
    get gul_tilhengerside() {
      return this.gul_koblet ? this.gul.trykk : 0.0;
    }
    get tilh_nod_andel() {
      if (this.t_sort_knapp_inne) return 0.0;
      return klem((P_NOD_LOS - this.rod_tilhengerside) / (P_NOD_LOS - P_NOD_PAA));
    }
    get tilh_fjaer_andel() {
      return klem((P_FJAER_LOS - this.t_fjaer.trykk) / (P_FJAER_LOS - P_FJAER_PAA));
    }
    get bremsekraft_tilhenger() {
      return Math.max(klem(this.t_drift.trykk / P_FULL_BREMS), this.tilh_fjaer_andel * FJAER_KRAFT);
    }
    get kjoreklar() {
      const tilhengerOk = !this.rod_koblet || this.bremsekraft_tilhenger < 0.02;
      return !this.varsel && this.fjaerbrems_andel < 0.02 && tilhengerOk;
    }

    // ------------------------------------------------------------ betjening
    sett_motor(paa) {
      if (paa && !this.motor_paa) {
        this._motor_start = this.tid;
        this._logg("Motoren startet.");
      } else if (!paa && this.motor_paa) {
        this._motor_start = null;
        this._logg("Motoren stoppet - kompressoren lader ikke lenger.");
      }
      this.motor_paa = paa;
    }

    sett_haandbrems(h) {
      h = klem(h);
      if (h < 0.05 && this.haandbrems >= 0.05) {
        this._logg("Håndbremsspaken satt i kjørestilling.");
        if (this.tanker.K3.trykk < P_FJAER_LOS) {
          this._logg("  ... men trykket i krets 3 er under " + fmt(P_FJAER_LOS, 1) +
            " bar - fjærbremsen kan ikke løses helt.");
        }
      } else if (h >= 0.95 && this.haandbrems < 0.95) {
        this._logg("Håndbremsspaken satt i parkeringsstilling.");
      }
      this.haandbrems = h;
    }

    sett_kobling(farge, koblet) {
      if (farge === "rod") {
        if (koblet === this.rod_koblet) return;
        this.rod_koblet = koblet;
        if (koblet) {
          this._logg("Rød kobling (forsyning) tilkoblet.");
          if (!this.gul_koblet) {
            this._logg("  ADVARSEL: Rød er koblet før gul! Nødbremsen løses, men tilhengeren kan ikke " +
              "driftsbremses uten styreledning" + (this.t_rod_knapp_ute ? "" : " - og den er ikke parkert") +
              ". Riktig rekkefølge: gul først, så rød.");
          }
        } else {
          this._logg("Rød kobling frakoblet - tilhengerens nødbrems slår inn (pssst!).");
        }
      } else {
        if (koblet === this.gul_koblet) return;
        this.gul_koblet = koblet;
        if (koblet) {
          this._logg("Gul kobling (styreledning) tilkoblet.");
        } else {
          this._logg("Gul kobling (styreledning) frakoblet.");
          if (this.rod_koblet) {
            this._logg("  ADVARSEL: Rød er fortsatt tilkoblet - tilhengeren kan ikke driftsbremses! " +
              "Riktig rekkefølge ved frakobling: rød først, så gul.");
          }
        }
      }
    }

    sett_rod_knapp(ute) {
      if (ute === this.t_rod_knapp_ute) return;
      this.t_rod_knapp_ute = ute;
      if (ute) {
        this._logg("Rød knapp på tilhengeren trukket ut - tilhengerens fjærbrems settes på.");
      } else {
        this._logg("Rød knapp på tilhengeren trykket inn - fjærbremsen løses (krever luft i tilhengertanken).");
      }
    }

    sett_sort_knapp(inne) {
      if (inne === this.t_sort_knapp_inne) return;
      if (inne && this.rod_tilhengerside > P_NOD_LOS) {
        this._logg("Sort knapp: rød ledning har trykk, så knappen spretter ut igjen.");
        return;
      }
      this.t_sort_knapp_inne = inne;
      if (inne) {
        this._logg("Sort knapp trykket inn - nødbremsen løses med luft fra tilhengertanken (bare for skifting!).");
      } else {
        this._logg("Sort knapp trukket ut - nødbremsen virker igjen.");
      }
    }

    sett_kontrollstilling(paa) {
      if (paa === this.kontrollstilling) return;
      this.kontrollstilling = paa;
      if (paa) {
        this._logg("Kontrollstilling: tilhengerens bremser løses" +
          (this.haandbrems >= 0.95 ? " - sjekk at trekkbilen alene holder vogntoget."
            : " (virker bare når spaken står i parkeringsstilling)."));
      } else {
        this._logg("Kontrollstilling av - tilhengeren bremses igjen av parkeringsbremsen.");
      }
    }

    sett_torker(defekt) {
      if (defekt && !this.torker_defekt) {
        this._logg("Lufttørkeren er defekt - fuktig luft sendes ut i tankene.");
      }
      this.torker_defekt = defekt;
    }

    tom_systemet() {
      for (const n of this.alleNoder()) n.trykk = 0.0;
      this.lader = true;
      this._oppdater_varsel(true);
      this._fjaer_status = "paa";
      this.tp_aktiv = false;
      this._tp_teller = 0.0;
      this._t_nod_status = this.tilh_nod_andel > 0.98 ? "paa" : "los";
      this._t_fjaer_status = "paa";
      this._logg("Systemet er tømt for luft (0 bar).");
    }

    fyll_systemet() {
      this.forsyning.trykk = UTKOBLING;
      for (const t of Object.values(this.tanker)) t.trykk = UTKOBLING;
      this.foran.trykk = this.bak.trykk = 0.0;
      this.fjaer.trykk = this.haandbrems >= 0.95 ? 0.0 : UTKOBLING * (1 - this.haandbrems);
      this.lader = false;
      this._oppdater_varsel(true);
      this._fjaer_status = this.fjaerbrems_andel < 0.02 ? "los" : "paa";
      this.rod.trykk = P_ROD;
      this.gul.trykk = this.t_drift.trykk = 0.0;
      this.t_tank.trykk = P_ROD;
      this.t_fjaer.trykk = this.t_rod_knapp_ute ? 0.0 : P_ROD;
      this.tp_aktiv = false;
      this._tp_teller = 0.0;
      this._t_nod_status = this.tilh_nod_andel > 0.98 ? "paa" : "los";
      this._t_fjaer_status = this.tilh_fjaer_andel < 0.02 ? "los" : "paa";
      this._logg("Systemet er fylt til " + fmt(UTKOBLING, 1) + " bar (tilhengeren til " + fmt(P_ROD, 1) + " bar).");
    }

    tapp_vann() {
      let vann = 0;
      for (const t of Object.values(this.tanker)) vann += t.vann;
      for (const t of Object.values(this.tanker)) {
        t.vann = 0.0;
        t.tilfor(-2.0);
      }
      if (vann >= 1) {
        this._logg("Tappet tankene: " + fmt(vann, 0) + " ml vann kom ut! Lufttørkeren må sjekkes.");
      } else {
        this._logg("Tappet tankene: bare luft kom ut, ikke vann.");
      }
    }

    // ----------------------------------------------------------- simulering
    kjor(sekunder, dt = 0.005) {
      const n = Math.max(1, Math.round(sekunder / dt));
      for (let i = 0; i < n; i++) this.steg(sekunder / n);
    }

    steg(dt) {
      this.tid += dt;

      // 1) Regulator og kompressor
      const pS = this.forsyning.trykk;
      if (this.lader && pS >= UTKOBLING) {
        this.lader = false;
        this._logg("Regulatoren kutter ut ved " + fmt(pS, 1) + " bar - lufttørkeren blåser ut (pssst!).");
        if (this._motor_start !== null) {
          this._logg("  Tid fra motorstart til utkobling: " + fmt(this.tid - this._motor_start, 0) + " s.");
          this._motor_start = null;
        }
      } else if (!this.lader && pS <= INNKOBLING) {
        this.lader = true;
        this._logg("Regulatoren kutter inn ved " + fmt(pS, 1) + " bar - " +
          (this.motor_paa ? "kompressoren lader igjen." : "men motoren står, så ingen lading."));
      }
      if (this.motor_paa && this.lader) {
        const q = this.turtall * KOMP_NL_PER_RPM * Math.max(0.0, 1 - pS / KOMP_MAKS_TRYKK) * dt;
        this.forsyning.tilfor(q);
        this.pumpet_nl += q;
      }

      // 2) Firekretsventil
      for (const [nokkel, [pLukk, pAapen]] of Object.entries(FIREKRETS)) {
        const aapning = klem((this.forsyning.trykk - pLukk) / (pAapen - pLukk));
        if (aapning > 0) {
          const tank = this.tanker[nokkel];
          const q = overfor(this.forsyning, tank, K_FIREKRETS * aapning, dt);
          if (this._vann_inn()) tank.vann += q * VANN_PER_NL;
        }
      }

      // 3) Fotbremsventil: krets 1 -> foran, krets 2 -> reléventil -> bak
      const maal = this.pedal * P_STYR_MAKS;
      this._styr_sylinder(this.tanker.K1, this.foran, maal, dt);
      this._styr_sylinder(this.tanker.K2, this.bak, maal, dt);

      // 4) Håndbremsventil + relé: krets 3 -> fjærbremsdelen
      const k3 = this.tanker.K3;
      const maalFj = this.haandbrems >= 0.95 ? 0.0 : k3.trykk * (1 - this.haandbrems);
      this._styr_sylinder(k3, this.fjaer, maalFj, dt);

      // 4b) Tilhengerstyreventil (krets 3 via overstrømningsventil)
      const styrFot = this.pedal * P_STYR_MAKS;
      let styrHaand;
      if (this.haandbrems >= 0.95) {
        styrHaand = this.kontrollstilling ? 0.0 : P_ROD;
      } else {
        styrHaand = P_ROD * this.haandbrems;
      }
      const maalGul = Math.min(Math.max(styrFot, styrHaand), P_ROD);
      this._styr_sylinder(k3, this.gul, maalGul, dt, K_GUL_FYLL);

      // Trekkbilbeskyttelse
      if (styrFot > 1.0 && this.gul.trykk < 0.5 * Math.min(maalGul, k3.trykk)) {
        this._tp_teller += dt;
      }
      if (this.pedal < 0.1) {
        this._tp_teller = 0.0;
        if (this.tp_aktiv) {
          this.tp_aktiv = false;
          this._logg("Bremsepedalen er sluppet - rød ledning fylles igjen.");
        }
      }
      if (!this.tp_aktiv && this._tp_teller >= TP_TID) {
        this.tp_aktiv = true;
        this._logg("TREKKBILBESKYTTELSE: Styreledningen (gul) holder ikke trykk - rød ledning luftes ut, " +
          "tilhengeren nødbremser!");
      }
      if (this.tp_aktiv) {
        slippUt(this.rod, K_TOM, dt);
      } else {
        const aapning = klem((k3.trykk - OVERSTROM[0]) / (OVERSTROM[1] - OVERSTROM[0]));
        this._styr_sylinder(k3, this.rod, P_ROD, dt, K_ROD * aapning);
      }

      // 4c) Tilhengeren
      if (this.rod_koblet) overfor(this.rod, this.t_tank, K_TILH_TANK, dt);
      if (this.t_sort_knapp_inne && this.rod_tilhengerside > P_NOD_LOS) {
        this.t_sort_knapp_inne = false;
        this._logg("Sort knapp spratt ut - rød ledning har trykk, nødbremsen virker igjen.");
      }
      const maalT = Math.max(this.gul_tilhengerside, this.tilh_nod_andel * P_STYR_MAKS);
      this._styr_sylinder(this.t_tank, this.t_drift, maalT, dt);
      const maalTf = this.t_rod_knapp_ute ? 0.0 : this.t_tank.trykk;
      this._styr_sylinder(this.t_tank, this.t_fjaer, maalTf, dt);

      // 5) Lekkasjer
      for (const punkt of ["K1", "K2", "K3", "K4"]) slippUt(this.tanker[punkt], this._lekk_k(punkt), dt);
      slippUt(this.bak, this._lekk_k("Bak"), dt);
      slippUt(this.rod, this._lekk_k("Rod"), dt);
      slippUt(this.gul, this._lekk_k("Gul"), dt);
      slippUt(this.t_tank, this._lekk_k("TT"), dt);

      // 6) Pumpetelling, varsling og fjærbremsstatus
      if (this.pedal > 0.8 && !this._pedal_nede) {
        this._pedal_nede = true;
        this.pumpetall += 1;
        this._logg("Bremsetråkk nr. " + this.pumpetall + "  (krets 1: " + fmt(this.tanker.K1.trykk, 1) +
          " bar, krets 2: " + fmt(this.tanker.K2.trykk, 1) + " bar)");
      } else if (this.pedal < 0.2) {
        this._pedal_nede = false;
      }
      this._oppdater_varsel();
      this._oppdater_fjaer();
      this._oppdater_tilhenger();
    }

    _styr_sylinder(tank, sylinder, maal, dt, kFyll = K_FYLL) {
      if (sylinder.trykk < maal - DODBAND) {
        overfor(tank, sylinder, kFyll, dt, maal);
      } else if (sylinder.trykk > maal + DODBAND) {
        slippUt(sylinder, K_TOM, dt, maal);
      }
    }

    _oppdater_varsel(stille = false) {
      const pMin = Math.min(this.tanker.K1.trykk, this.tanker.K2.trykk);
      if (!this.varsel && pMin < VARSEL_PAA) {
        this.varsel = true;
        if (!stille) {
          this._logg("VARSEL: Lavt lufttrykk! (krets 1: " + fmt(this.tanker.K1.trykk, 1) + " bar, krets 2: " +
            fmt(this.tanker.K2.trykk, 1) + " bar) - STOPP, ikke kjør!");
        }
      } else if (this.varsel && pMin > VARSEL_AV) {
        this.varsel = false;
        if (!stille) this._logg("Varsellampen slukket - trykket i krets 1 og 2 er over " + fmt(VARSEL_AV, 1) + " bar.");
      }
    }

    _oppdater_fjaer() {
      const a = this.fjaerbrems_andel;
      const ny = a < 0.02 ? "los" : (a > 0.98 ? "paa" : "delvis");
      if (ny === this._fjaer_status) return;
      const kjorestilling = this.haandbrems < 0.05;
      if (ny === "los") {
        this._logg("Fjærbremsen er helt løst.");
      } else if (ny === "paa") {
        if (kjorestilling) this._logg("NØDBREMS: Fjærbremsen har slått seg på av lavt trykk i krets 3!");
        else this._logg("Fjærbremsen er helt på (parkert).");
      } else if (kjorestilling && this._fjaer_status === "los") {
        this._logg("Fjærbremsen begynner å slå inn - trykket i krets 3 er " + fmt(this.tanker.K3.trykk, 1) + " bar.");
      }
      this._fjaer_status = ny;
    }

    _oppdater_tilhenger() {
      let a = this.tilh_nod_andel;
      let ny = a > 0.98 ? "paa" : (a < 0.02 ? "los" : this._t_nod_status);
      if (ny !== this._t_nod_status) {
        if (ny === "paa") {
          this._logg("Tilhengerens NØDBREMS er på (rød ledning: " + fmt(this.rod_tilhengerside, 1) + " bar).");
        } else {
          this._logg("Tilhengerens nødbrems er løst.");
        }
        this._t_nod_status = ny;
      }
      a = this.tilh_fjaer_andel;
      ny = a > 0.98 ? "paa" : (a < 0.02 ? "los" : this._t_fjaer_status);
      if (ny !== this._t_fjaer_status) {
        if (ny === "paa") {
          this._logg("Tilhengerens fjærbrems er på" + (this.t_rod_knapp_ute ? " (rød knapp er ute)."
            : " - for lite luft i tilhengertanken!"));
        } else {
          this._logg("Tilhengerens fjærbrems er løst.");
        }
        this._t_fjaer_status = ny;
      }
    }
  }

  const Bremsemodell = {
    Bremsesystem, Beholder, klem,
    UTKOBLING, INNKOBLING, FIREKRETS, P_STYR_MAKS, P_FULL_BREMS, P_FJAER_LOS, P_FJAER_PAA,
    VARSEL_PAA, VARSEL_AV, LEKKASJENIVAA, LEKKASJEPUNKT, LEKKASJEPUNKT_TILHENGER, P_ROD, OVERSTROM,
    P_NOD_LOS, P_NOD_PAA, TP_TID,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = Bremsemodell;
  else global.Bremsemodell = Bremsemodell;
})(typeof window !== "undefined" ? window : globalThis);
