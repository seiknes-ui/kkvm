// Tester av JavaScript-modellen, de samme som lastebil_brems/test_bremsemodell.py.
// Kjør:  node web/test/test_bremsemodell.js
"use strict";

const bm = require("../js/bremsemodell.js");

function ny(fylt = true, haand = 1.0) {
  const m = new bm.Bremsesystem();
  m.sett_haandbrems(haand);
  if (fylt) m.fyll_systemet();
  else m.tom_systemet();
  return m;
}

function sjekk(betingelse, melding) {
  if (!betingelse) throw new Error(melding === undefined ? "påstand feilet" : String(melding));
}

const loggHar = (m, tekst) => m.logg.some(([, t]) => t.includes(tekst));
const vannTotalt = (m) => Object.values(m.tanker).reduce((s, t) => s + t.vann, 0);

const tester = {
  fylling_fra_tomt() {
    const m = ny(false);
    m.sett_motor(true);
    let t = 0;
    while (m.lader && t < 900) {
      m.kjor(1.0);
      t += 1;
    }
    sjekk(!m.lader, "regulatoren kuttet aldri ut");
    sjekk(t > 90 && t < 600, t);
    sjekk(Object.values(m.tanker).every((tk) => tk.trykk > 9.3));
    sjekk(!m.varsel);
    console.log("      Fylling fra tomt til utkobling på tomgang: " + t + " s");
  },

  driftsbrems_fylles_forst() {
    const m = ny(false);
    m.sett_motor(true);
    while (m.tanker.K1.trykk < 4.0) m.kjor(0.5);
    sjekk(m.tanker.K3.trykk < m.tanker.K1.trykk);
  },

  pumpetest_gir_varsel() {
    const m = ny();
    while (!m.varsel && m.pumpetall < 50) {
      m.pedal = 1.0;
      m.kjor(1.0);
      m.pedal = 0.0;
      m.kjor(1.0);
    }
    sjekk(m.varsel);
    sjekk(m.pumpetall >= 5 && m.pumpetall <= 20, m.pumpetall);
    console.log("      Varsellampe etter " + m.pumpetall + " bremsetråkk");
  },

  bremsing_gir_bremsekraft() {
    const m = ny(true, 0.0);
    m.kjor(2);
    sjekk(m.fjaerbrems_andel < 0.02);
    m.pedal = 0.5;
    m.kjor(2);
    sjekk(Math.abs(m.foran.trykk - 5.0) < 0.2 && Math.abs(m.bak.trykk - 5.0) < 0.2);
    m.pedal = 0.0;
    m.kjor(2);
    sjekk(m.foran.trykk < 0.1 && m.bak.trykk < 0.1);
  },

  tett_system_holder_trykket() {
    const m = ny(true, 0.0);
    m.pedal = 1.0;
    m.kjor(5);
    const p0 = m.tanker.K2.trykk;
    m.kjor(60);
    sjekk(p0 - m.tanker.K2.trykk < 0.3);
  },

  lekkasje_bremsesylinder_merkes_bare_ved_bremsing() {
    const m = ny(true, 0.0);
    m.lekkasje.Bak = "Middels";
    m.kjor(5);
    const p0 = m.tanker.K2.trykk;
    m.kjor(60);
    sjekk(Math.abs(p0 - m.tanker.K2.trykk) < 0.01);
    m.pedal = 1.0;
    m.kjor(5);
    const p1 = m.tanker.K2.trykk;
    m.kjor(60);
    sjekk(p1 - m.tanker.K2.trykk > 0.4);
  },

  nodbrems_ved_lekkasje_i_krets_3() {
    const m = ny(true, 0.0);
    m.kjor(2);
    sjekk(m.fjaerbrems_andel < 0.02);
    m.lekkasje.K3 = "Stor";
    m.kjor(30);
    sjekk(m.fjaerbrems_andel > 0.95);
    sjekk(loggHar(m, "NØDBREMS"));
  },

  fjaerbrems_kan_ikke_loses_med_lavt_trykk() {
    const m = ny(false);
    m.tanker.K3.trykk = 4.0;
    m.sett_haandbrems(0.0);
    m.kjor(10);
    sjekk(m.fjaerbrems_andel > 0.3);
  },

  firekretsventil_beskytter_andre_kretser() {
    const m = ny();
    m.sett_motor(true);
    m.turtall = 1500;
    m.lekkasje.K1 = "Stor";
    m.kjor(120);
    sjekk(m.tanker.K1.trykk < 4.0);
    for (const k of ["K2", "K3", "K4"]) sjekk(m.tanker[k].trykk > 6.0, k + " " + m.tanker[k].trykk);
    sjekk(m.varsel);
  },

  vann_ved_defekt_torker() {
    const m = ny(false);
    m.sett_torker(true);
    m.sett_motor(true);
    m.kjor(120);
    sjekk(vannTotalt(m) > 5);
    m.tapp_vann();
    sjekk(vannTotalt(m) === 0);
  },

  tilhenger_folger_bremsepedalen() {
    const m = ny(true, 0.0);
    m.kjor(5);
    sjekk(m.bremsekraft_tilhenger < 0.02 && m.kjoreklar);
    m.pedal = 0.5;
    m.kjor(3);
    sjekk(Math.abs(m.gul.trykk - 5.0) < 0.2 && Math.abs(m.t_drift.trykk - 5.0) < 0.3, [m.gul.trykk, m.t_drift.trykk]);
    m.pedal = 0.0;
    m.kjor(3);
    sjekk(m.t_drift.trykk < 0.1);
  },

  parkering_bremser_tilhengeren_og_kontrollstilling_loser() {
    const m = ny(true, 1.0);
    m.kjor(5);
    sjekk(m.t_drift.trykk > 8.0);
    m.sett_kontrollstilling(true);
    m.kjor(5);
    sjekk(m.t_drift.trykk < 0.1 && m.bremsekraft_tilhenger < 0.02);
    sjekk(m.fjaerbrems_andel > 0.98);
  },

  frakobling_av_rod_gir_nodbrems() {
    const m = ny(true, 0.0);
    m.kjor(5);
    m.sett_kobling("rod", false);
    m.kjor(3);
    sjekk(m.tilh_nod_andel > 0.98 && m.t_drift.trykk > 7.5);
    sjekk(loggHar(m, "NØDBREMS er på"));
  },

  feil_rekkefolge_varsles() {
    const m = ny();
    m.sett_kobling("rod", false);
    m.sett_kobling("gul", false);
    m.sett_kobling("rod", true);
    sjekk(loggHar(m, "Rød er koblet før gul"));
    const m2 = ny();
    m2.sett_kobling("gul", false);
    sjekk(loggHar(m2, "Rød er fortsatt tilkoblet"));
  },

  trekkbilbeskyttelse_ved_revnet_gul_ledning() {
    const m = ny(true, 0.0);
    m.kjor(5);
    m.lekkasje.Gul = "Stor";
    m.pedal = 1.0;
    m.kjor(5);
    sjekk(m.tp_aktiv);
    sjekk(m.rod.trykk < 1.0 && m.tilh_nod_andel > 0.98);
    m.pedal = 0.0;
    m.kjor(10);
    sjekk(!m.tp_aktiv && m.rod.trykk > 6.0);
  },

  sort_knapp_loser_nodbrems_ved_skifting() {
    const m = ny(true, 0.0);
    m.kjor(5);
    m.sett_kobling("rod", false);
    m.sett_kobling("gul", false);
    m.kjor(3);
    sjekk(m.t_drift.trykk > 7.5);
    m.sett_sort_knapp(true);
    m.kjor(3);
    sjekk(m.t_drift.trykk < 0.1);
    m.sett_kobling("gul", true);
    m.sett_kobling("rod", true);
    m.kjor(3);
    sjekk(!m.t_sort_knapp_inne);
  },

  rod_knapp_parkerer_tilhengeren() {
    const m = ny(true, 0.0);
    m.kjor(5);
    m.sett_rod_knapp(true);
    m.kjor(5);
    sjekk(m.tilh_fjaer_andel > 0.98);
  },

  tilhenger_tappes_ikke_for_trekkbilen() {
    const m = ny(true, 0.0);
    m.t_tank.trykk = 0.0;
    m.kjor(30);
    sjekk(m.tanker.K3.trykk > 5.9, m.tanker.K3.trykk);
    sjekk(m.fjaerbrems_andel < 0.2);
  },
};

let feil = 0;
const navn = Object.keys(tester).sort();
for (const n of navn) {
  try {
    tester[n]();
    console.log("OK     test_" + n);
  } catch (e) {
    feil += 1;
    console.log("FEIL   test_" + n + "  " + e.message);
  }
}
console.log("\n" + (navn.length - feil) + " av " + navn.length + " tester bestått");
process.exit(feil ? 1 : 0);
