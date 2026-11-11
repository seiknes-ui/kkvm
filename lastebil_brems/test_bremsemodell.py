"""Tester av bremsemodellen. Kjør:  python test_bremsemodell.py   (eller pytest)"""

import bremsemodell as bm


def ny(fylt=True, haand=1.0):
    m = bm.Bremsesystem()
    m.sett_haandbrems(haand)
    m.fyll_systemet() if fylt else m.tom_systemet()
    return m


def test_fylling_fra_tomt():
    m = ny(fylt=False)
    m.sett_motor(True)
    t = 0
    while m.lader and t < 900:
        m.kjor(1.0)
        t += 1
    assert not m.lader, "regulatoren kuttet aldri ut"
    assert 90 < t < 600, t
    assert all(tk.trykk > 9.3 for tk in m.tanker.values()), [tk.trykk for tk in m.tanker.values()]
    assert not m.varsel
    print("Fylling fra tomt til utkobling på tomgang: %d s" % t)


def test_driftsbrems_fylles_forst():
    m = ny(fylt=False)
    m.sett_motor(True)
    while m.tanker["K1"].trykk < 4.0:
        m.kjor(0.5)
    assert m.tanker["K3"].trykk < m.tanker["K1"].trykk


def test_pumpetest_gir_varsel():
    m = ny()
    while not m.varsel and m.pumpetall < 50:
        m.pedal = 1.0
        m.kjor(1.0)
        m.pedal = 0.0
        m.kjor(1.0)
    assert m.varsel
    assert 5 <= m.pumpetall <= 20, m.pumpetall
    print("Varsellampe etter %d bremsetråkk" % m.pumpetall)


def test_bremsing_gir_bremsekraft():
    m = ny(haand=0.0)
    m.kjor(2)
    assert m.fjaerbrems_andel < 0.02
    m.pedal = 0.5
    m.kjor(2)
    assert abs(m.foran.trykk - 5.0) < 0.2 and abs(m.bak.trykk - 5.0) < 0.2
    m.pedal = 0.0
    m.kjor(2)
    assert m.foran.trykk < 0.1 and m.bak.trykk < 0.1


def test_tett_system_holder_trykket():
    m = ny(haand=0.0)
    m.pedal = 1.0
    m.kjor(5)
    p0 = m.tanker["K2"].trykk
    m.kjor(60)
    assert p0 - m.tanker["K2"].trykk < 0.3


def test_lekkasje_bremsesylinder_merkes_bare_ved_bremsing():
    m = ny(haand=0.0)
    m.lekkasje["Bak"] = "Middels"
    m.kjor(5)
    p0 = m.tanker["K2"].trykk
    m.kjor(60)
    assert abs(p0 - m.tanker["K2"].trykk) < 0.01
    m.pedal = 1.0
    m.kjor(5)
    p1 = m.tanker["K2"].trykk
    m.kjor(60)
    assert p1 - m.tanker["K2"].trykk > 0.4


def test_nodbrems_ved_lekkasje_i_krets_3():
    m = ny(haand=0.0)
    m.kjor(2)
    assert m.fjaerbrems_andel < 0.02
    m.lekkasje["K3"] = "Stor"
    m.kjor(30)
    assert m.fjaerbrems_andel > 0.95
    assert any("NØDBREMS" in t for _, t in m.logg)


def test_fjaerbrems_kan_ikke_loses_med_lavt_trykk():
    m = ny(fylt=False)
    m.tanker["K3"].trykk = 4.0
    m.sett_haandbrems(0.0)
    m.kjor(10)
    assert m.fjaerbrems_andel > 0.3


def test_firekretsventil_beskytter_andre_kretser():
    m = ny()
    m.sett_motor(True)
    m.turtall = 1500
    m.lekkasje["K1"] = "Stor"
    m.kjor(120)
    assert m.tanker["K1"].trykk < 4.0
    for k in ("K2", "K3", "K4"):
        assert m.tanker[k].trykk > 6.0, (k, m.tanker[k].trykk)
    assert m.varsel


def test_vann_ved_defekt_torker():
    m = ny(fylt=False)
    m.sett_torker(True)
    m.sett_motor(True)
    m.kjor(120)
    vann = sum(t.vann for t in m.tanker.values())
    assert vann > 5
    m.tapp_vann()
    assert sum(t.vann for t in m.tanker.values()) == 0


if __name__ == "__main__":
    tester = [(n, f) for n, f in sorted(globals().items()) if n.startswith("test_")]
    feil = 0
    for navn, f in tester:
        try:
            f()
            print("OK    ", navn)
        except AssertionError as e:
            feil += 1
            print("FEIL  ", navn, e)
    print("\n%d av %d tester bestått" % (len(tester) - feil, len(tester)))
    raise SystemExit(1 if feil else 0)
