/*
 * app.js
 * ======
 * Brukergrensesnittet: manometre, lamper, systemskjema, vogntog, graf, logg, betjening
 * og opplæringsfanene (oppdrag, eksperiment, finn feilen, test, verksted, fagstoff).
 */
(function () {
  "use strict";

  const bm = window.Bremsemodell;
  const I = window.Innhold;
  const SVGNS = "http://www.w3.org/2000/svg";
  const $ = (id) => document.getElementById(id);
  const klem = bm.klem;
  const fmt = (x, d = 1) => x.toFixed(d).replace(".", ",");
  const pst = (x) => Math.round(x * 100) + " %";

  function el(tag, attrs, parent, tekst) {
    const e = document.createElementNS(SVGNS, tag);
    for (const k in attrs || {}) e.setAttribute(k, attrs[k]);
    if (tekst !== undefined) e.textContent = tekst;
    if (parent) parent.appendChild(e);
    return e;
  }

  function h(tag, attrs, ...barn) {
    const e = document.createElement(tag);
    for (const k in attrs || {}) {
      if (k === "html") e.innerHTML = attrs[k];
      else if (k.startsWith("on")) e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] !== undefined) e.setAttribute(k, attrs[k] === true ? "" : attrs[k]);
    }
    for (const b of barn.flat()) if (b !== null && b !== undefined) e.append(b);
    return e;
  }

  // ================================================================= tilstand
  const app = {
    m: new bm.Bremsesystem(),
    fart: 1,
    pause: false,
    pedalHoldt: false,
    pedalVerdi: 0,
    dp: new Map(),
    sistDt: 0,
    historikk: [],
    nesteProve: 0,
    loggIndeks: 0,
    fane: "oppdrag",
    visning: null,      // {type, id} for detaljvisning i en fane
    oppdrag: null,      // aktivt oppdrag
    finnfeil: null,
    test: null,
    eksperimentVist: {},
  };
  app.m.tom_systemet();

  const LAGER = "bremsesim.v1";
  let lagret = { oppdrag: {}, sporsmal: {}, eksperiment: {}, finnfeil: { riktig: 0, forsok: 0, rekke: 0 }, test: { beste: null } };
  try {
    const s = JSON.parse(localStorage.getItem(LAGER));
    if (s) lagret = Object.assign(lagret, s);
  } catch (e) { /* lagring er valgfri */ }

  function lagre() {
    try { localStorage.setItem(LAGER, JSON.stringify(lagret)); } catch (e) { /* ignorer */ }
    oppdaterFremgang();
  }

  // ===================================================================== tema
  (function () {
    try {
      const t = localStorage.getItem("bremsesim.tema");
      if (t) document.documentElement.dataset.theme = t;
    } catch (e) { /* ignorer */ }
    $("tema").addEventListener("click", () => {
      const naa = document.documentElement.dataset.theme ||
        (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
      const ny = naa === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = ny;
      try { localStorage.setItem("bremsesim.tema", ny); } catch (e) { /* ignorer */ }
      tegnGraf();
    });
  })();

  // ================================================================ manometre
  function lagManometer(svg, viserFarger) {
    const cx = 100, cy = 100, r = 86;
    const polar = (p, rr) => {
      const a = ((225 - 270 * p / 12) * Math.PI) / 180;
      return [cx + rr * Math.cos(a), cy - rr * Math.sin(a)];
    };
    el("circle", { cx, cy, r: r + 8, fill: "#05080c" }, svg);
    el("circle", { cx, cy, r, fill: "#111a24", stroke: "#3a4756", "stroke-width": 2 }, svg);
    const bue = (fra, til, farge, br) => {
      const [x0, y0] = polar(fra, r - 9), [x1, y1] = polar(til, r - 9);
      el("path", { d: `M${x0} ${y0} A${r - 9} ${r - 9} 0 0 1 ${x1} ${y1}`, stroke: farge, "stroke-width": br, fill: "none", opacity: 0.85 }, svg);
    };
    bue(0, bm.VARSEL_PAA, "#ff4d4f", 6);
    bue(bm.INNKOBLING, bm.UTKOBLING, "#34d17a", 6);
    for (let i = 0; i <= 24; i++) {
      const p = i / 2, stor = i % 2 === 0;
      const [x0, y0] = polar(p, r - (stor ? 18 : 13)), [x1, y1] = polar(p, r - 4);
      el("line", { x1: x0, y1: y0, x2: x1, y2: y1, stroke: "#d8e1ea", "stroke-width": stor ? 2.2 : 1 }, svg);
      if (stor && p % 2 === 0) {
        const [tx, ty] = polar(p, r - 31);
        el("text", { x: tx, y: ty + 4, fill: "#d8e1ea", "font-size": 13, "text-anchor": "middle", "font-weight": 600 }, svg, String(p));
      }
    }
    el("text", { x: cx, y: cy + 30, fill: "#7f8fa0", "font-size": 11, "text-anchor": "middle" }, svg, "bar");
    const digital = el("text", { x: cx, y: cy + 54, "font-size": 13, "text-anchor": "middle", "font-weight": 700 }, svg);
    const spenn = viserFarger.map((f) => el("tspan", { fill: f }, digital));
    const visere = viserFarger.map((f) => {
      const g = el("g", {}, svg);
      el("line", { x1: cx, y1: cy + 14, x2: cx, y2: cy - r + 16, stroke: f, "stroke-width": 4, "stroke-linecap": "round" }, g);
      return g;
    });
    el("circle", { cx, cy, r: 8, fill: "#c9d3de", stroke: "#05080c", "stroke-width": 2 }, svg);
    return (verdier) => {
      verdier.forEach((p, i) => {
        visere[i].setAttribute("transform", `rotate(${-135 + 270 * Math.min(p, 12) / 12} ${cx} ${cy})`);
        spenn[i].textContent = (i ? "  " : "") + fmt(p, 1);
      });
    };
  }
  const mano1 = lagManometer($("mano1"), ["#ff5a5f", "#3ddc84"]);
  const mano2 = lagManometer($("mano2"), ["#5aa9ff", "#f472d0"]);

  // =================================================================== lamper
  const LAMPER = [
    { id: "lavt", navn: "LAVT LUFTTRYKK", ikon: "!", farge: "#ff4d4f", paa: (m) => m.varsel },
    { id: "park", navn: "PARKERINGSBREMS", ikon: "P", farge: "#ff4d4f", paa: (m) => m.fjaerbrems_andel > 0.02 },
    { id: "tilh", navn: "TILHENGER BREMSER", ikon: "T", farge: "#ff4d4f", paa: (m) => m.rod_koblet && m.bremsekraft_tilhenger > 0.02 },
    { id: "tp", navn: "TREKKBILBESKYTTELSE", ikon: "!", farge: "#ffb020", paa: (m) => m.tp_aktiv },
    { id: "komp", navn: "KOMPRESSOR LADER", ikon: "K", farge: "#ffb020", paa: (m) => m.motor_paa && m.lader },
    { id: "klar", navn: "KJØREKLAR", ikon: "✓", farge: "#34d17a", paa: (m) => m.kjoreklar },
  ];
  const lampeEl = {};
  for (const l of LAMPER) {
    lampeEl[l.id] = h("div", { class: "lampe", style: `--lampefarge:${l.farge}` }, h("i", {}, l.ikon), l.navn);
    $("lamper").append(lampeEl[l.id]);
  }
  const AVLESNING = [
    ["Simulert tid", (m) => fmt(m.tid, 0) + " s"],
    ["Bremsetråkk", (m) => String(m.pumpetall)],
    ["Kraft foran", (m) => pst(m.bremsekraft_foran)],
    ["Kraft bak", (m) => pst(m.bremsekraft_bak)],
    ["Kraft tilhenger", (m) => (m.rod_koblet || m.gul_koblet || m.bremsekraft_tilhenger > 0 ? pst(m.bremsekraft_tilhenger) : "–")],
    ["Fjærbrems bil", (m) => pst(m.fjaerbrems_andel)],
  ];
  const avlesEl = AVLESNING.map(([navn]) => {
    const dd = h("dd");
    $("avlesning").append(h("dt", {}, navn), dd);
    return dd;
  });

  // =================================================================== skjema
  const S = $("skjema");
  const lagGrupper = el("g", {}, S);
  const lagRor = el("g", {}, S);
  const lagBokser = el("g", {}, S);
  const lagPust = el("g", {}, S);
  const ror = [];
  const bokser = {};
  const m = app.m;

  const stiger = (node) => (app.dp.get(node) || 0) > 0.02;

  function rorlinje(punkter, trykk, flyt, bredde = 7) {
    const d = "M" + punkter.map((p) => p.join(" ")).join(" L");
    const g = el("g", {}, lagRor);
    el("path", { d, class: "ror-grunn", "stroke-width": bredde }, g);
    const p2 = el("path", { d, class: "ror-trykk", "stroke-width": bredde }, g);
    const p3 = el("path", { d, class: "ror-flyt", "stroke-width": Math.max(2, bredde - 3) }, g);
    ror.push({ p2, p3, trykk, flyt, sistFlyt: false });
  }

  function boks(id, x, y, w, hoyde, tittel, fagId) {
    const g = el("g", { class: "boks", "data-id": fagId || id }, lagBokser);
    el("rect", { x, y, width: w, height: hoyde, rx: 10, class: "ramme" }, g);
    const linjer = tittel.split("\n");
    linjer.forEach((t, i) => el("text", { x: x + w / 2, y: y + 19 + i * 15, class: "tittel", "text-anchor": "middle" }, g, t));
    const b = { g, x, y, w, h: hoyde, tekstY: y + 19 + linjer.length * 15 + 3, verdier: [] };
    b.verdi = (n) => {
      while (b.verdier.length <= n) {
        b.verdier.push(el("text", { x: x + w / 2, y: b.tekstY + b.verdier.length * 16, class: "verdi", "text-anchor": "middle" }, g));
      }
      return b.verdier[n];
    };
    g.addEventListener("click", () => visFagstoff(fagId || id));
    bokser[id] = b;
    return b;
  }

  function maaler(b, rad, etikett) {
    const x = b.x + 12, w = b.w - 24, y = b.tekstY + rad * 16 + 2;
    el("text", { x, y: y - 3, class: "etikett" }, b.g, etikett);
    el("rect", { x, y, width: w, height: 6, rx: 3, class: "maaler-bak" }, b.g);
    const fyll = el("rect", { x, y, width: 0, height: 6, rx: 3, class: "maaler-fyll" }, b.g);
    return (andel) => fyll.setAttribute("width", w * klem(andel));
  }

  function tank(id, node, x, y, w, hoyde, tittel) {
    const g = el("g", { class: "boks", "data-id": "tanker" }, lagBokser);
    const klipp = "klipp-" + id;
    const defs = el("defs", {}, g);
    el("rect", { x, y, width: w, height: hoyde, rx: hoyde / 2 }, el("clipPath", { id: klipp }, defs));
    el("rect", { x, y, width: w, height: hoyde, rx: hoyde / 2, class: "ramme" }, g);
    const niva = el("rect", { x, y, width: 0, height: hoyde, class: "tank-niva", "clip-path": `url(#${klipp})` }, g);
    const vann = el("rect", { x, y: y + hoyde, width: w, height: 0, class: "tank-vann", "clip-path": `url(#${klipp})` }, g);
    el("text", { x: x + w / 2, y: y + hoyde / 2 - 4, class: "tittel", "text-anchor": "middle" }, g, tittel);
    const verdi = el("text", { x: x + w / 2, y: y + hoyde / 2 + 13, class: "verdi sterk", "text-anchor": "middle" }, g);
    el("title", {}, g, "Klikk for å tappe vann fra tankene");
    g.addEventListener("click", () => { m.tapp_vann(); });
    bokser[id] = { g, oppdater: () => {
      niva.setAttribute("width", (w * Math.min(node.trykk, 12)) / 12);
      const vh = Math.min(hoyde * 0.6, node.vann / 6);
      vann.setAttribute("y", y + hoyde - vh);
      vann.setAttribute("height", vh);
      verdi.textContent = fmt(node.trykk, 2) + " bar" + (node.vann >= 1 ? "  ·  vann " + fmt(node.vann, 0) + " ml" : "");
      verdi.setAttribute("class", "verdi " + (node.vann >= 1 ? "alarm" : "sterk"));
    } };
  }

  function byggSkjema() {
    const T = m.tanker;
    const tankY = { K1: [30, 64], K2: [118, 64], K3: [250, 64], K4: [420, 50] };
    const tankMidt = (k) => tankY[k][0] + tankY[k][1] / 2;

    // Tilhengeren som gruppe
    el("rect", { x: 812, y: 350, width: 270, height: 262, rx: 14, class: "gruppe-ramme" }, lagGrupper);
    el("text", { x: 830, y: 372, class: "gruppe-tittel" }, lagGrupper, "TILHENGER");

    // --- rør --------------------------------------------------------------
    const lader = () => m.motor_paa && m.lader;
    rorlinje([[130, 285], [160, 285]], () => m.forsyning.trykk, lader);
    rorlinje([[280, 285], [310, 285]], () => m.forsyning.trykk, lader);
    for (const k of ["K1", "K2", "K3", "K4"]) {
      rorlinje([[390, tankMidt(k)], [420, tankMidt(k)]], () => T[k].trykk, () => stiger(T[k]));
    }
    rorlinje([[575, 62], [620, 62]], () => T.K1.trykk, () => stiger(m.foran));
    rorlinje([[575, 150], [600, 150], [600, 125], [620, 125]], () => T.K2.trykk, () => stiger(m.bak));
    rorlinje([[575, 170], [610, 170], [610, 190], [770, 190], [770, 152], [800, 152]], () => T.K2.trykk, () => stiger(m.bak));
    rorlinje([[740, 62], [800, 62]], () => m.foran.trykk, () => stiger(m.foran));
    rorlinje([[740, 125], [770, 125], [770, 135], [800, 135]], () => m.pedal * bm.P_STYR_MAKS, () => stiger(m.bak), 4);
    rorlinje([[860, 170], [860, 215]], () => m.bak.trykk, () => stiger(m.bak));
    rorlinje([[575, 275], [620, 275]], () => T.K3.trykk, () => stiger(m.fjaer));
    rorlinje([[740, 275], [800, 275]], () => m.fjaer.trykk, () => stiger(m.fjaer));
    rorlinje([[575, 300], [596, 300], [596, 560], [620, 560]], () => T.K3.trykk, () => stiger(m.rod) || stiger(m.gul));
    rorlinje([[575, 445], [620, 445]], () => T.K4.trykk, () => false);
    rorlinje([[740, 530], [760, 530]], () => m.rod.trykk, () => stiger(m.rod));
    rorlinje([[740, 575], [760, 575]], () => m.gul.trykk, () => stiger(m.gul));
    rorlinje([[784, 530], [800, 530], [800, 410], [835, 410]], () => m.rod_tilhengerside, () => m.rod_koblet && stiger(m.t_tank));
    rorlinje([[784, 575], [815, 575], [815, 440], [835, 440]], () => m.gul_tilhengerside, () => m.gul_koblet && stiger(m.gul));
    rorlinje([[945, 418], [960, 418]], () => m.t_tank.trykk, () => stiger(m.t_tank));
    rorlinje([[890, 455], [890, 490]], () => m.t_drift.trykk, () => stiger(m.t_drift));
    rorlinje([[1015, 446], [1015, 490]], () => m.t_tank.trykk, () => stiger(m.t_fjaer));
    rorlinje([[985, 540], [970, 540]], () => m.t_fjaer.trykk, () => stiger(m.t_fjaer));

    // --- komponenter ------------------------------------------------------
    const komp = boks("komp", 20, 245, 110, 80, "Kompressor", "kompressor");
    const vifte = el("g", { class: "vifte" }, komp.g);
    for (let i = 0; i < 6; i++) {
      el("ellipse", { cx: 75, cy: 283, rx: 3.2, ry: 7, fill: "var(--aksent)", transform: `rotate(${i * 60} 75 290)` }, vifte);
    }
    el("circle", { cx: 75, cy: 290, r: 3, fill: "var(--kort-2)" }, vifte);
    komp.vifte = vifte;
    komp.verdier.push(el("text", { x: 75, y: 318, class: "verdi", "text-anchor": "middle" }, komp.g));

    boks("reg", 160, 245, 120, 80, "Regulator +\nlufttørker", "regulator");
    const fire = boks("fire", 310, 22, 80, 460, "Fire-\nkrets-\nventil", "firekrets");
    fire.dotter = {};
    for (const k of ["K1", "K2", "K3", "K4"]) {
      fire.dotter[k] = el("circle", { cx: 380, cy: tankMidt(k), r: 5 }, fire.g);
    }
    el("text", { x: 350, y: 470, class: "etikett", "text-anchor": "middle" }, fire.g, "● = åpen");

    const tankNavn = { K1: "Krets 1 · foran", K2: "Krets 2 · bak", K3: "Krets 3 · park/tilh.", K4: "Krets 4 · utstyr" };
    for (const k of ["K1", "K2", "K3", "K4"]) tank(k, T[k], 420, tankY[k][0], 155, tankY[k][1], tankNavn[k]);

    boks("fot", 620, 30, 120, 120, "Fotbrems-\nventil", "fotbrems");
    const foran = boks("foran", 800, 22, 270, 82, "Bremsesylindre foran", "foran");
    foran.maaler = maaler(foran, 1, "bremsekraft");
    boks("rele", 800, 118, 120, 52, "Reléventil", "rele");
    const bak = boks("bak", 800, 215, 270, 112, "Kombisylindre bak", "kombi");
    bak.mDrift = maaler(bak, 1, "driftsbrems");
    bak.mFjaer = maaler(bak, 3, "fjærbrems");
    boks("haand", 620, 235, 120, 82, "Håndbrems-\nventil", "haandbrems");
    boks("ekstra", 620, 420, 120, 50, "Tilleggsutstyr", "tilleggsutstyr");
    boks("tsv", 620, 495, 120, 112, "Tilhenger-\nstyreventil", "tsv");

    // koblinger
    const kobling = (farge, y, fargeKode) => {
      const g = el("g", { class: "kobling" }, lagBokser);
      const c = el("circle", { cx: 772, cy: y, r: 11, stroke: fargeKode }, g);
      el("text", { x: 772, y: y + 27, class: "etikett", "text-anchor": "middle" }, g, farge === "rod" ? "rød" : "gul");
      el("title", {}, g, "Klikk for å koble til eller fra");
      g.addEventListener("click", () => m.sett_kobling(farge, !(farge === "rod" ? m.rod_koblet : m.gul_koblet)));
      return c;
    };
    bokser.koblRod = kobling("rod", 530, "#e5484d");
    bokser.koblGul = kobling("gul", 575, "#e3b008");

    const nod = boks("nod", 835, 385, 110, 70, "Nødrelé", "nodrele");
    nod.verdi(0);
    tank("TT", m.t_tank, 960, 390, 110, 56, "Tilh.tank");
    const tsyl = boks("tsyl", 835, 490, 135, 110, "Bremse-\nsylindre", "tilhsyl");
    tsyl.mDrift = maaler(tsyl, 1, "driftsbrems");
    tsyl.mFjaer = maaler(tsyl, 3, "fjærbrems");
    const kn = boks("knapper", 985, 490, 85, 110, "Knapper", "knapper");
    const knapp = (cx, fyll, hva) => {
      const g = el("g", { class: "knapp-tilh" }, kn.g);
      const ring = el("circle", { cx, cy: 545, r: 15, fill: "none", stroke: "var(--strek-sterk)", "stroke-width": 2 }, g);
      const c = el("circle", { cx, cy: 545, r: 10, fill: fyll, stroke: "#000", "stroke-opacity": 0.3 }, g);
      const t = el("text", { x: cx, y: 580, class: "etikett", "text-anchor": "middle" }, g);
      el("title", {}, g, hva === "rod" ? "Rød knapp: parkeringsbrems (fjærbrems)" : "Sort knapp: løser nødbremsen (skifting)");
      g.addEventListener("click", (e) => {
        e.stopPropagation();
        if (hva === "rod") m.sett_rod_knapp(!m.t_rod_knapp_ute);
        else m.sett_sort_knapp(!m.t_sort_knapp_inne);
      });
      return { ring, c, t };
    };
    kn.rod = knapp(1007, "#e5484d", "rod");
    kn.sort = knapp(1048, "#1b1f24", "sort");
  }
  byggSkjema();

  function pust(x, y, tekst) {
    const t = el("text", { x, y, class: "pust", "text-anchor": "middle" }, lagPust, tekst);
    setTimeout(() => t.remove(), 1700);
  }

  function oppdaterSkjema() {
    for (const r of ror) {
      r.p2.setAttribute("stroke-opacity", klem(r.trykk() / 10).toFixed(3));
      const f = !app.pause && r.flyt();
      if (f !== r.sistFlyt) {
        r.p3.classList.toggle("aktiv", f);
        r.sistFlyt = f;
      }
    }
    const B = bokser;
    B.komp.vifte.classList.toggle("snurrer", m.motor_paa && m.lader);
    B.komp.verdier[0].textContent = m.motor_paa ? (m.lader ? "lader" : "tomgang") : "står";
    B.reg.verdi(0).textContent = fmt(m.forsyning.trykk, 2) + " bar";
    B.reg.verdi(0).setAttribute("class", "verdi sterk");
    const torker = m.torker_defekt;
    B.reg.verdi(1).textContent = torker ? "TØRKER DEFEKT" : "ut 10,0 · inn 8,5";
    B.reg.verdi(1).setAttribute("class", "verdi" + (torker ? " alarm" : ""));
    for (const [k, [pL, pA]] of Object.entries(bm.FIREKRETS)) {
      const aapen = klem((m.forsyning.trykk - pL) / (pA - pL)) > 0;
      B.fire.dotter[k].setAttribute("fill", aapen ? "var(--gronn)" : "var(--strek-sterk)");
    }
    for (const k of ["K1", "K2", "K3", "K4", "TT"]) B[k].oppdater();
    B.fot.verdi(0).textContent = "pedal " + Math.round(m.pedal * 100) + " %";
    B.fot.verdi(1).textContent = "styretrykk";
    B.fot.verdi(2).textContent = fmt(m.pedal * bm.P_STYR_MAKS, 1) + " bar";
    B.foran.verdi(0).textContent = fmt(m.foran.trykk, 2) + " bar  ·  " + pst(m.bremsekraft_foran);
    B.foran.maaler(m.bremsekraft_foran);
    B.rele.verdi(0).textContent = fmt(m.bak.trykk, 2) + " bar";
    B.bak.verdi(0).textContent = "drift " + fmt(m.bak.trykk, 1) + " bar  ·  fjærdel " + fmt(m.fjaer.trykk, 1) + " bar";
    B.bak.mDrift(klem(m.bak.trykk / bm.P_FULL_BREMS));
    B.bak.mFjaer(m.fjaerbrems_andel);
    const spak = m.haandbrems >= 0.95 ? "PARK" : (m.haandbrems < 0.05 ? "KJØR" : Math.round(m.haandbrems * 100) + " %");
    B.haand.verdi(0).textContent = "spak " + spak;
    B.haand.verdi(1).textContent = "ut " + fmt(m.fjaer.trykk, 1) + " bar";
    B.ekstra.verdi(0).textContent = "";
    B.tsv.verdi(0).textContent = "gul " + fmt(m.gul.trykk, 1) + " bar";
    B.tsv.verdi(1).textContent = "rød " + fmt(m.rod.trykk, 1) + " bar";
    const tsvStatus = m.tp_aktiv ? "BESKYTTELSE!" : (m.kontrollstilling && m.haandbrems >= 0.95 ? "KONTROLL" : "");
    B.tsv.verdi(2).textContent = tsvStatus;
    B.tsv.verdi(2).setAttribute("class", "verdi" + (m.tp_aktiv ? " alarm" : " sterk"));
    for (const [c, koblet, farge] of [[B.koblRod, m.rod_koblet, "#e5484d"], [B.koblGul, m.gul_koblet, "#e3b008"]]) {
      c.setAttribute("fill", koblet ? farge : "var(--kort)");
      c.setAttribute("stroke-dasharray", koblet ? "" : "4 3");
    }
    const nodA = m.tilh_nod_andel;
    B.nod.verdi(0).textContent = "nødbrems " + pst(nodA);
    B.nod.verdi(0).setAttribute("class", "verdi" + (nodA > 0.02 ? " alarm" : ""));
    B.tsyl.verdi(0).textContent = fmt(m.t_drift.trykk, 1) + " · " + fmt(m.t_fjaer.trykk, 1) + " bar";
    B.tsyl.mDrift(klem(m.t_drift.trykk / bm.P_FULL_BREMS));
    B.tsyl.mFjaer(m.tilh_fjaer_andel);
    const kn = B.knapper;
    kn.rod.c.setAttribute("r", m.t_rod_knapp_ute ? 13 : 9);
    kn.rod.ring.setAttribute("stroke", m.t_rod_knapp_ute ? "#e5484d" : "var(--strek-sterk)");
    kn.rod.t.textContent = m.t_rod_knapp_ute ? "UTE" : "inne";
    kn.sort.c.setAttribute("r", m.t_sort_knapp_inne ? 9 : 13);
    kn.sort.ring.setAttribute("stroke", m.t_sort_knapp_inne ? "var(--oransje)" : "var(--strek-sterk)");
    kn.sort.t.textContent = m.t_sort_knapp_inne ? "INNE" : "ute";
  }

  // ================================================================== vogntog
  const K = $("kjoretoy");
  const kj = {};
  function byggKjoretoy() {
    el("line", { x1: 0, y1: 182, x2: 1000, y2: 182, stroke: "var(--strek)", "stroke-width": 2 }, K);
    // trekkbil (front mot venstre)
    el("rect", { x: 30, y: 136, width: 450, height: 16, rx: 4, class: "kj-ramme" }, K);
    el("path", { d: "M34 140 L34 64 Q34 40 58 38 L150 34 L150 140 Z", class: "kj-kabin" }, K);
    el("path", { d: "M46 62 Q46 50 58 50 L104 48 L104 92 L46 92 Z", class: "kj-vindu" }, K);
    el("rect", { x: 160, y: 26, width: 312, height: 106, rx: 6, class: "kj-karosseri" }, K);
    el("text", { x: 316, y: 86, class: "kj-liten" }, K, "TREKKBIL");
    // tilhenger
    el("rect", { x: 480, y: 142, width: 90, height: 7, rx: 3, class: "kj-ramme" }, K);
    el("rect", { x: 566, y: 136, width: 410, height: 16, rx: 4, class: "kj-ramme" }, K);
    el("rect", { x: 566, y: 26, width: 410, height: 106, rx: 6, class: "kj-karosseri" }, K);
    el("text", { x: 771, y: 86, class: "kj-liten" }, K, "TILHENGER");

    // slanger: tilkoblet og hengende
    kj.slanger = {};
    for (const [farge, y, kode] of [["rod", 112, "#e5484d"], ["gul", 128, "#e3b008"]]) {
      const tilkoblet = el("path", { d: `M486 ${y} C515 ${y + 22} 545 ${y + 22} 572 ${y - 4}`, class: "slange", stroke: kode }, K);
      const henger = el("path", { d: `M572 ${y - 4} C560 ${y + 20} 556 ${y + 34} 560 ${y + 46}`, class: "slange", stroke: kode }, K);
      const hode = el("g", { class: "kobling" }, K);
      el("rect", { x: 474, y: y - 9, width: 18, height: 18, rx: 5, fill: kode, stroke: "#000", "stroke-opacity": 0.3 }, hode);
      el("title", {}, hode, (farge === "rod" ? "Rød" : "Gul") + " kobling – klikk for å koble til eller fra");
      hode.addEventListener("click", () => m.sett_kobling(farge, !(farge === "rod" ? m.rod_koblet : m.gul_koblet)));
      kj.slanger[farge] = { tilkoblet, henger };
    }
    // knapper på tilhengerens front
    el("rect", { x: 578, y: 92, width: 52, height: 30, rx: 6, fill: "var(--kort)", stroke: "var(--strek-sterk)" }, K);
    const tk = (cx, fyll, hva) => {
      const g = el("g", { class: "knapp-tilh" }, K);
      const c = el("circle", { cx, cy: 107, r: 8, fill: fyll, stroke: "#000", "stroke-opacity": 0.3 }, g);
      el("title", {}, g, hva === "rod" ? "Rød knapp: parkeringsbrems" : "Sort knapp: løser nødbremsen (skifting)");
      g.addEventListener("click", () => {
        if (hva === "rod") m.sett_rod_knapp(!m.t_rod_knapp_ute);
        else m.sett_sort_knapp(!m.t_sort_knapp_inne);
      });
      return c;
    };
    kj.rodKnapp = tk(592, "#e5484d", "rod");
    kj.sortKnapp = tk(616, "#1b1f24", "sort");

    // hjul
    const hjul = (cx) => {
      el("circle", { cx, cy: 160, r: 23, class: "kj-dekk" }, K);
      el("circle", { cx, cy: 160, r: 11, class: "kj-felg" }, K);
      return el("circle", { cx, cy: 160, r: 17, class: "kj-brems", opacity: 0 }, K);
    };
    kj.foran = [hjul(96)];
    kj.bak = [hjul(372), hjul(424)];
    kj.tilh = [hjul(640), hjul(696), hjul(860), hjul(916)];
    kj.tForan = el("text", { x: 96, y: 204, class: "kj-tekst" }, K);
    kj.tBak = el("text", { x: 398, y: 204, class: "kj-tekst" }, K);
    kj.tTilh = el("text", { x: 778, y: 204, class: "kj-tekst" }, K);
    const pMerke = (x) => {
      const g = el("g", {}, K);
      el("circle", { cx: x, cy: 120, r: 10, fill: "#e5484d" }, g);
      el("text", { x, y: 124, class: "kj-p" }, g, "P");
      return g;
    };
    kj.pBil = pMerke(398);
    kj.pTilh = pMerke(888);
  }
  byggKjoretoy();

  function oppdaterKjoretoy() {
    const sett = (liste, kraft) => liste.forEach((c) => {
      c.setAttribute("opacity", kraft.toFixed(2));
      c.style.filter = kraft > 0.25 ? "drop-shadow(0 0 5px #e5484d)" : "";
    });
    sett(kj.foran, m.bremsekraft_foran);
    sett(kj.bak, m.bremsekraft_bak);
    sett(kj.tilh, m.bremsekraft_tilhenger);
    kj.tForan.textContent = "Foran " + pst(m.bremsekraft_foran);
    kj.tBak.textContent = "Bak " + pst(m.bremsekraft_bak);
    kj.tTilh.textContent = "Tilhenger " + pst(m.bremsekraft_tilhenger);
    kj.pBil.style.display = m.fjaerbrems_andel > 0.5 ? "" : "none";
    kj.pTilh.style.display = m.tilh_fjaer_andel > 0.5 ? "" : "none";
    for (const [f, koblet] of [["rod", m.rod_koblet], ["gul", m.gul_koblet]]) {
      kj.slanger[f].tilkoblet.style.display = koblet ? "" : "none";
      kj.slanger[f].henger.style.display = koblet ? "none" : "";
    }
    kj.rodKnapp.setAttribute("r", m.t_rod_knapp_ute ? 10 : 7);
    kj.sortKnapp.setAttribute("r", m.t_sort_knapp_inne ? 6 : 9);
  }

  // ===================================================================== graf
  const SERIER = [
    { navn: "Krets 1", farge: "#e5484d", f: (m) => m.tanker.K1.trykk },
    { navn: "Krets 2", farge: "#23a55a", f: (m) => m.tanker.K2.trykk },
    { navn: "Krets 3", farge: "#1d6fe0", f: (m) => m.tanker.K3.trykk },
    { navn: "Krets 4", farge: "#8b5cf6", f: (m) => m.tanker.K4.trykk, av: true },
    { navn: "Syl. foran", farge: "#f08c00", strek: [5, 3], f: (m) => m.foran.trykk },
    { navn: "Syl. bak", farge: "#b45309", strek: [5, 3], f: (m) => m.bak.trykk },
    { navn: "Fjærdel bak", farge: "#0ea5b7", strek: [5, 3], f: (m) => m.fjaer.trykk },
    { navn: "Tilhengertank", farge: "#db2777", f: (m) => m.t_tank.trykk },
    { navn: "Tilh. sylinder", farge: "#64748b", strek: [5, 3], f: (m) => m.t_drift.trykk, av: true },
  ];
  const HISTORIKK_S = 180, PROVE_S = 0.5;
  for (const s of SERIER) {
    const b = h("button", { class: s.av ? "av" : "", style: `--c:${s.farge}`, onclick: () => {
      s.av = !s.av;
      b.classList.toggle("av", s.av);
      tegnGraf();
    } }, h("i"), s.navn);
    $("serier").append(b);
  }

  function tegnGraf() {
    const c = $("graf");
    const dpr = window.devicePixelRatio || 1;
    const W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    if (c.width !== Math.round(W * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    const g = c.getContext("2d");
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, W, H);
    const st = getComputedStyle(document.documentElement);
    const strek = st.getPropertyValue("--strek").trim(), dempet = st.getPropertyValue("--dempet").trim();
    const x0 = 34, x1 = W - 8, y0 = 8, y1 = H - 22;
    const gy = (p) => y1 - ((y1 - y0) * Math.min(p, 12)) / 12;
    g.font = "11px system-ui, sans-serif";
    g.fillStyle = dempet;
    g.textAlign = "right";
    g.textBaseline = "middle";
    for (let p = 0; p <= 12; p += 2) {
      g.strokeStyle = strek;
      g.lineWidth = 1;
      g.beginPath(); g.moveTo(x0, gy(p)); g.lineTo(x1, gy(p)); g.stroke();
      g.fillText(String(p), x0 - 6, gy(p));
    }
    g.strokeStyle = "#e5484d"; g.setLineDash([3, 3]);
    g.beginPath(); g.moveTo(x0, gy(bm.VARSEL_PAA)); g.lineTo(x1, gy(bm.VARSEL_PAA)); g.stroke();
    g.setLineDash([]);
    g.textAlign = "center"; g.textBaseline = "top";
    const tSlutt = Math.max(m.tid, HISTORIKK_S), tStart = tSlutt - HISTORIKK_S;
    for (let s = 0; s <= 3; s++) {
      const t = tStart + s * 60;
      g.fillText(s === 3 ? "nå" : "−" + (3 - s) + " min", x0 + ((x1 - x0) * (t - tStart)) / HISTORIKK_S, y1 + 6);
    }
    SERIER.forEach((s, i) => {
      if (s.av) return;
      g.strokeStyle = s.farge; g.lineWidth = 2; g.setLineDash(s.strek || []);
      g.beginPath();
      let forst = true;
      for (const [t, v] of app.historikk) {
        if (t < tStart) continue;
        const x = x0 + ((x1 - x0) * (t - tStart)) / HISTORIKK_S, y = gy(v[i]);
        if (forst) { g.moveTo(x, y); forst = false; } else g.lineTo(x, y);
      }
      g.stroke();
    });
    g.setLineDash([]);
  }
  window.addEventListener("resize", tegnGraf);

  // ===================================================================== logg
  const ALARM = /VARSEL|NØDBREMS|ADVARSEL|TREKKBILBESKYTTELSE|vann kom ut/;
  function behandleLogg() {
    const liste = $("logg");
    let ny = false;
    while (app.loggIndeks < m.logg.length) {
      const [t, tekst] = m.logg[app.loggIndeks++];
      const li = h("li", {}, h("time", {}, fmt(t, 1) + " s"), h("span", { class: /^===/.test(tekst) ? "ovelse" : ALARM.test(tekst) ? "alarm" : "" }, tekst));
      liste.append(li);
      ny = true;
      if (/Regulatoren kutter ut/.test(tekst)) pust(220, 238, "pssst!");
      if (/Rød kobling frakoblet/.test(tekst)) pust(772, 512, "pssst!");
      if (/TREKKBILBESKYTTELSE/.test(tekst)) pust(680, 488, "pssst!");
      if (/Tappet tankene/.test(tekst)) pust(497, 412, /vann kom ut/.test(tekst) ? "splæsj!" : "pssst");
    }
    if (ny) {
      while (liste.children.length > 400) liste.firstChild.remove();
      liste.scrollTop = liste.scrollHeight;
    }
  }
  $("toemLogg").addEventListener("click", () => { $("logg").innerHTML = ""; });

  // ================================================================ betjening
  const motorKnapp = $("motor");
  motorKnapp.addEventListener("click", () => m.sett_motor(!m.motor_paa));
  $("turtall").addEventListener("input", (e) => { m.turtall = +e.target.value; $("turtallUt").textContent = e.target.value; });
  $("pedal").addEventListener("input", (e) => { app.pedalVerdi = +e.target.value; });

  const pedalKnapp = $("pedalknapp");
  const holdPedal = (nede) => { app.pedalHoldt = nede; pedalKnapp.classList.toggle("nede", nede); };
  pedalKnapp.addEventListener("pointerdown", (e) => { pedalKnapp.setPointerCapture(e.pointerId); holdPedal(true); });
  for (const ev of ["pointerup", "pointercancel", "lostpointercapture"]) pedalKnapp.addEventListener(ev, () => holdPedal(false));
  pedalKnapp.addEventListener("contextmenu", (e) => e.preventDefault());
  const erPedalTast = (e) => e.key === "b" || e.key === "B" || e.code === "Space";
  const iSkjema = (e) => /^(SELECT|TEXTAREA)$/.test(e.target.tagName) || (e.target.tagName === "INPUT" && e.target.type === "text");
  document.addEventListener("keydown", (e) => {
    if (!erPedalTast(e) || iSkjema(e) || e.ctrlKey || e.metaKey || e.altKey) return;
    e.preventDefault();
    holdPedal(true);
  });
  document.addEventListener("keyup", (e) => {
    if (!erPedalTast(e) || iSkjema(e)) return;
    e.preventDefault();
    holdPedal(false);
  });
  window.addEventListener("blur", () => holdPedal(false));

  const haand = $("haand");
  const settHaand = (v) => { haand.value = v; m.sett_haandbrems(v / 100); };
  haand.addEventListener("input", () => settHaand(+haand.value));
  document.querySelectorAll("[data-haand]").forEach((b) => b.addEventListener("click", () => settHaand(+b.dataset.haand)));
  $("kontroll").addEventListener("change", (e) => m.sett_kontrollstilling(e.target.checked));

  function settFart(f) {
    app.fart = f;
    document.querySelectorAll("[data-fart]").forEach((b) => b.classList.toggle("valgt", +b.dataset.fart === f));
  }
  document.querySelectorAll("[data-fart]").forEach((b) => b.addEventListener("click", () => settFart(+b.dataset.fart)));
  const pauseKnapp = $("pause");
  const settPause = (p) => { app.pause = p; pauseKnapp.textContent = p ? "Fortsett" : "Pause"; };
  pauseKnapp.addEventListener("click", () => settPause(!app.pause));
  $("fyll").addEventListener("click", () => m.fyll_systemet());
  $("tom").addEventListener("click", () => m.tom_systemet());

  function synkBetjening() {
    motorKnapp.textContent = m.motor_paa ? "Stopp motor" : "Start motor";
    motorKnapp.setAttribute("aria-pressed", String(m.motor_paa));
    $("kontroll").checked = m.kontrollstilling;
    const v = Math.round(m.haandbrems * 100);
    $("haandUt").textContent = v >= 95 ? "PARK" : v < 5 ? "KJØR" : v + " %";
    $("pedalUt").textContent = Math.round(m.pedal * 100);
  }

  /** Setter simulatoren i en bestemt starttilstand for et oppdrag, eksperiment eller en feilsøking. */
  function settOppsett(o) {
    app.oppdrag = null;
    m.rod_koblet = o.rod !== undefined ? o.rod : true;
    m.gul_koblet = o.gul !== undefined ? o.gul : true;
    m.t_rod_knapp_ute = !!o.rodknapp;
    m.t_sort_knapp_inne = !!o.sortknapp;
    m.kontrollstilling = !!o.kontroll;
    app.pedalVerdi = 0;
    $("pedal").value = 0;
    holdPedal(false);
    const rpm = o.turtall || 600;
    m.turtall = rpm;
    $("turtall").value = rpm;
    $("turtallUt").textContent = rpm;
    settHaand(o.haand !== undefined ? o.haand : 100);
    for (const k in m.lekkasje) m.lekkasje[k] = (o.lekk || {})[k] || "Ingen";
    m.sett_torker(!!o.torker);
    m.skjult_feil = null;
    m.pumpetall = 0;
    if (o.fyll === false) m.tom_systemet();
    else m.fyll_systemet();
    if (o.tomTilhenger) {
      m.t_tank.trykk = m.t_drift.trykk = m.t_fjaer.trykk = 0.0;
      m._t_fjaer_status = m._t_nod_status = "paa";
    }
    m.sett_motor(!!o.motor);
    settFart(o.fart || 1);
    settPause(false);
    if (app.fane === "verksted") visFane();
  }

  // ==================================================================== faner
  const faneinnhold = $("faneinnhold");
  document.querySelectorAll("[data-fane]").forEach((b) => b.addEventListener("click", () => {
    app.fane = b.dataset.fane;
    app.visning = null;
    visFane();
  }));

  function visFane() {
    document.querySelectorAll("[data-fane]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.fane === app.fane)));
    faneinnhold.innerHTML = "";
    faneinnhold.scrollTop = 0;
    ({ oppdrag: visOppdrag, eksperiment: visEksperiment, finnfeil: visFinnFeil, test: visTest,
      verksted: visVerksted, fagstoff: visFagstoffListe })[app.fane]();
  }

  const tilbakeKnapp = () => h("button", { class: "knapp diskret tilbake", onclick: () => { app.visning = null; visFane(); } }, "← Alle");

  /** Et flervalgsspørsmål. naarSvart(riktig, forsteForsok) kalles ved hvert svar. */
  function sporsmalKort(s, naarSvart, { tillatNyttForsok = true, lagretRiktig = false } = {}) {
    const boks = h("div", { class: "sporsmal" }, h("p", {}, s.q));
    const valg = h("div", { class: "valg" });
    const forklaring = h("div", { class: "forklaring", hidden: true });
    let forsok = 0;
    const knapper = s.a.map((tekst, i) => h("button", { onclick: () => {
      forsok++;
      const riktig = i === s.r;
      knapper[i].classList.add(riktig ? "riktig" : "feil");
      knapper[i].disabled = true;
      forklaring.hidden = false;
      forklaring.className = "forklaring " + (riktig ? "ok" : "nei");
      forklaring.innerHTML = (riktig ? "<b>Riktig.</b> " : "<b>Ikke helt.</b> ") + (riktig || !tillatNyttForsok ? s.f : "Prøv igjen.");
      if (riktig || !tillatNyttForsok) {
        knapper.forEach((k, j) => { k.disabled = true; if (j === s.r) k.classList.add("riktig"); });
        if (!riktig) forklaring.innerHTML = "<b>Feil.</b> " + s.f;
      }
      naarSvart(riktig, forsok === 1);
    } }, tekst));
    valg.append(...knapper);
    boks.append(valg, forklaring);
    if (lagretRiktig) {
      knapper.forEach((k, j) => { k.disabled = true; if (j === s.r) k.classList.add("riktig"); });
      forklaring.hidden = false;
      forklaring.className = "forklaring ok";
      forklaring.innerHTML = "<b>Besvart.</b> " + s.f;
    }
    return boks;
  }

  // ---------------------------------------------------------------- oppdrag
  function visOppdrag() {
    if (app.visning && app.visning.type === "oppdrag") return visOppdragDetalj(I.OPPDRAG.find((o) => o.id === app.visning.id));
    const antall = I.OPPDRAG.filter((o) => lagret.oppdrag[o.id]).length;
    faneinnhold.append(
      h("p", { class: "ingress" }, "Guidede oppgaver. Stegene krysses av automatisk når du gjør dem i simulatoren. Svar på kontrollspørsmålene for å fullføre."),
      h("div", { class: "framdrift" }, h("i", { style: `width:${(100 * antall) / I.OPPDRAG.length}%` })),
    );
    const liste = h("div", { class: "liste" });
    let niva = null;
    I.OPPDRAG.forEach((o, i) => {
      if (o.niva !== niva) { niva = o.niva; liste.append(h("div", { class: "seksjonstittel" }, niva)); }
      liste.append(h("button", { class: "element" + (lagret.oppdrag[o.id] ? " ferdig" : ""), onclick: () => { app.visning = { type: "oppdrag", id: o.id }; visFane(); } },
        h("span", { class: "nr" }, lagret.oppdrag[o.id] ? "✓" : String(i + 1)),
        h("span", { class: "tekst" }, h("b", {}, o.tittel), h("small", {}, o.maal)),
      ));
    });
    faneinnhold.append(liste);
  }

  function visOppdragDetalj(o) {
    const aktiv = app.oppdrag && app.oppdrag.id === o.id ? app.oppdrag : null;
    faneinnhold.append(
      tilbakeKnapp(),
      h("h3", {}, o.tittel),
      h("div", { class: "maal" }, h("b", {}, "Mål: "), o.maal),
      h("div", { class: "knapperad" },
        h("button", { class: "knapp primar", onclick: () => startOppdrag(o) }, aktiv ? "Start på nytt" : "Start oppdraget"),
        lagret.oppdrag[o.id] ? h("span", { class: "brikke" }, "✓ Fullført") : null),
    );
    const steg = h("ol", { class: "steg", id: "stegliste" });
    o.steg.forEach((s, i) => {
      const li = h("li", { "data-i": i }, h("span", { class: "boble" }), h("span", { html: s.t }));
      if (!s.ok) {
        li.append(h("button", { class: "knapp diskret", onclick: () => { if (app.oppdrag && app.oppdrag.id === o.id) { app.oppdrag.gjort[i] = true; oppdaterSteg(); } } }, "Gjort"));
      }
      steg.append(li);
    });
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Steg"), steg);
    if (!aktiv) faneinnhold.append(h("p", { class: "hjelp" }, "Trykk «Start oppdraget» for å sette opp simulatoren og begynne."));
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Kontrollspørsmål"));
    o.sporsmal.forEach((s, i) => {
      const nokkel = o.id + ":" + i;
      faneinnhold.append(sporsmalKort(s, (riktig) => {
        if (riktig) { lagret.sporsmal[nokkel] = true; lagre(); sjekkFullfort(o); }
      }, { lagretRiktig: !!lagret.sporsmal[nokkel] }));
    });
    faneinnhold.append(h("div", { class: "ferdigmelding", id: "ferdigmelding", hidden: !lagret.oppdrag[o.id] }, "Oppdraget er fullført. Godt jobbet!"));
    oppdaterSteg();
  }

  function startOppdrag(o) {
    settOppsett(o.oppsett);
    m._logg("=== Oppdrag startet: " + o.tittel + " ===");
    app.oppdrag = { id: o.id, start: m.logg.length, gjort: o.steg.map(() => false), holdt: {} };
    app.visning = { type: "oppdrag", id: o.id };
    visFane();
  }

  function oppdragKontekst(a) {
    const nyeLinjer = () => m.logg.slice(a.start).map((l) => l[1]);
    return {
      m,
      har: (re) => nyeLinjer().some((t) => re.test(t)),
      antall: (re) => nyeLinjer().filter((t) => re.test(t)).length,
      holdt: (navn, betingelse, sek) => {
        a.holdt[navn] = betingelse ? (a.holdt[navn] || 0) + app.sistDt : 0;
        return a.holdt[navn] >= sek;
      },
      vann: () => Object.values(m.tanker).reduce((s, t) => s + t.vann, 0),
    };
  }

  function sjekkOppdrag() {
    const a = app.oppdrag;
    if (!a) return;
    const o = I.OPPDRAG.find((x) => x.id === a.id);
    const k = oppdragKontekst(a);
    let endret = false;
    o.steg.forEach((s, i) => {
      if (!a.gjort[i] && s.ok && s.ok(k)) { a.gjort[i] = true; endret = true; }
    });
    if (endret) oppdaterSteg();
  }

  function oppdaterSteg() {
    const liste = $("stegliste");
    if (!liste || !app.visning) return;
    const a = app.oppdrag && app.oppdrag.id === app.visning.id ? app.oppdrag : null;
    const neste = a ? a.gjort.indexOf(false) : -1;
    [...liste.children].forEach((li, i) => {
      const gjort = !!(a && a.gjort[i]);
      li.classList.toggle("gjort", gjort);
      li.classList.toggle("neste", i === neste);
      li.querySelector(".boble").textContent = gjort ? "✓" : "";
      const b = li.querySelector("button");
      if (b) b.hidden = gjort || !a;
    });
    if (a) sjekkFullfort(I.OPPDRAG.find((o) => o.id === a.id));
  }

  function sjekkFullfort(o) {
    const a = app.oppdrag;
    const stegOk = a && a.id === o.id && a.gjort.every(Boolean);
    const sporsmalOk = o.sporsmal.every((_, i) => lagret.sporsmal[o.id + ":" + i]);
    if (stegOk && sporsmalOk && !lagret.oppdrag[o.id]) {
      lagret.oppdrag[o.id] = true;
      lagre();
    }
    const melding = $("ferdigmelding");
    if (melding) melding.hidden = !lagret.oppdrag[o.id];
  }

  // ------------------------------------------------------------- eksperiment
  function visEksperiment() {
    if (app.visning && app.visning.type === "eksperiment") return visEksperimentDetalj(I.EKSPERIMENTER.find((e) => e.id === app.visning.id));
    faneinnhold.append(h("p", { class: "ingress" }, "Gjett først, test etterpå. Velg hva du tror skjer, sett opp eksperimentet og finn svaret i simulatoren."));
    const liste = h("div", { class: "liste" });
    I.EKSPERIMENTER.forEach((e, i) => {
      const gjettet = lagret.eksperiment[e.id] !== undefined;
      liste.append(h("button", { class: "element" + (gjettet ? " ferdig" : ""), onclick: () => { app.visning = { type: "eksperiment", id: e.id }; visFane(); } },
        h("span", { class: "nr" }, gjettet ? "✓" : String(i + 1)),
        h("span", { class: "tekst" }, h("b", {}, e.tittel), h("small", {}, e.sporsmal)),
      ));
    });
    faneinnhold.append(liste);
  }

  function visEksperimentDetalj(e) {
    const gjett = lagret.eksperiment[e.id];
    faneinnhold.append(tilbakeKnapp(), h("h3", {}, e.tittel), h("div", { class: "maal" }, e.sporsmal));
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "1 · Hva tror du?"));
    const valg = h("div", { class: "valg" });
    e.valg.forEach((t, i) => valg.append(h("button", { class: gjett === i ? "valgt" : "", disabled: gjett !== undefined, onclick: () => {
      lagret.eksperiment[e.id] = i; lagre(); visFane();
    } }, t)));
    faneinnhold.append(valg);
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "2 · Test det"),
      h("div", { class: "knapperad" }, h("button", { class: "knapp primar", onclick: () => {
        settOppsett(e.oppsett);
        m._logg("=== Eksperiment: " + e.tittel + " ===");
      } }, "Sett opp eksperimentet")),
      h("ol", { class: "fremgangsmaate" }, e.fremgang.map((t) => h("li", { html: t }))));
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "3 · Svaret"));
    if (gjett === undefined) {
      faneinnhold.append(h("p", { class: "hjelp" }, "Velg hva du tror først."));
    } else if (!app.eksperimentVist[e.id]) {
      faneinnhold.append(h("button", { class: "knapp", onclick: () => { app.eksperimentVist[e.id] = true; visFane(); } }, "Vis svaret"));
    } else {
      const riktig = gjett === e.riktig;
      faneinnhold.append(h("div", { class: "forklaring " + (riktig ? "ok" : "nei"), html:
        (riktig ? "<b>Du gjettet riktig!</b> " : "<b>Riktig svar: " + e.valg[e.riktig] + ".</b> ") + e.forklaring }));
      faneinnhold.append(h("div", { class: "knapperad" }, h("button", { class: "lenkeknapp", onclick: () => {
        delete lagret.eksperiment[e.id]; app.eksperimentVist[e.id] = false; lagre(); visFane();
      } }, "Gjett på nytt")));
    }
  }

  // ------------------------------------------------------------- finn feilen
  function visFinnFeil() {
    const ff = lagret.finnfeil;
    faneinnhold.append(
      h("p", { class: "ingress" }, "Simulatoren legger inn en tilfeldig, skjult feil. Bruk kontrollene du har lært – lekkasjekontroll, pumpetest, tapping, til- og frakobling – og still diagnosen."),
      h("div", { class: "poeng" },
        h("div", {}, h("b", {}, String(ff.riktig)), h("small", {}, "riktige")),
        h("div", {}, h("b", {}, String(ff.forsok)), h("small", {}, "forsøk")),
        h("div", {}, h("b", {}, String(ff.rekke)), h("small", {}, "på rad"))),
      h("div", { class: "knapperad" }, h("button", { class: "knapp primar", onclick: nyFeil }, app.finnfeil ? "Ny skjult feil" : "Start feilsøking")),
    );
    const f = app.finnfeil;
    if (!f) return;
    faneinnhold.append(h("div", { class: "maal" }, "Systemet er fullt, motoren står og vogntoget er parkert. Feilen kan være på trekkbilen, på tilhengeren eller i slangene."));
    if (!f.besvart) {
      faneinnhold.append(h("div", { class: "knapperad" }, h("button", { class: "knapp diskret", onclick: () => { f.hint = true; visFane(); } }, "Vis et hint")));
      if (f.hint) faneinnhold.append(h("div", { class: "forklaring" }, h("b", {}, "Hint: "), f.feil.hint));
    }
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Hva er feilen?"));
    const valg = h("div", { class: "valg" });
    I.SKJULTE_FEIL.forEach((kandidat) => {
      const b = h("button", { disabled: f.besvart, onclick: () => {
        f.besvart = true;
        f.svar = kandidat;
        ff.forsok++;
        if (kandidat === f.feil) { ff.riktig++; ff.rekke++; } else ff.rekke = 0;
        lagre();
        visFane();
      } }, kandidat.navn);
      if (f.besvart) {
        if (kandidat === f.feil) b.className = "riktig";
        else if (kandidat === f.svar) b.className = "feil";
      }
      valg.append(b);
    });
    faneinnhold.append(valg);
    if (f.besvart) {
      const ok = f.svar === f.feil;
      faneinnhold.append(h("div", { class: "forklaring " + (ok ? "ok" : "nei") },
        h("b", {}, ok ? "Riktig diagnose! " : "Ikke riktig. "), "Fasit: " + f.feil.fasit));
    }
  }

  function nyFeil() {
    settOppsett({ fyll: true, motor: false, haand: 100 });
    const forrige = app.finnfeil && app.finnfeil.feil;
    let feil;
    do feil = I.SKJULTE_FEIL[Math.floor(Math.random() * I.SKJULTE_FEIL.length)]; while (feil === forrige);
    m.skjult_feil = feil.feil;
    m._logg("=== Finn feilen: en ny skjult feil er lagt inn ===");
    app.finnfeil = { feil, besvart: false, hint: false };
    visFane();
  }

  // -------------------------------------------------------------------- test
  function alleSporsmal() {
    return [...I.OPPDRAG.flatMap((o) => o.sporsmal), ...I.EKSTRA_SPORSMAL];
  }

  function visTest() {
    const t = app.test;
    if (!t) {
      const beste = lagret.test.beste;
      faneinnhold.append(
        h("p", { class: "ingress" }, "10 tilfeldige spørsmål om trykkluftbremser. Bare første svar teller."),
        beste !== null ? h("div", { class: "poeng" }, h("div", {}, h("b", {}, beste + " / 10"), h("small", {}, "beste resultat"))) : null,
        h("button", { class: "knapp primar", onclick: () => {
          const s = alleSporsmal().sort(() => Math.random() - 0.5).slice(0, 10);
          app.test = { sporsmal: s, i: 0, poeng: 0, svart: false };
          visFane();
        } }, "Start testen"),
      );
      return;
    }
    if (t.i >= t.sporsmal.length) {
      const ny = lagret.test.beste === null || t.poeng > lagret.test.beste;
      if (ny) { lagret.test.beste = t.poeng; lagre(); }
      faneinnhold.append(
        h("div", { class: "poeng" }, h("div", {}, h("b", {}, t.poeng + " / " + t.sporsmal.length), h("small", {}, ny ? "nytt beste resultat!" : "riktige svar"))),
        h("p", { class: "ingress" }, t.poeng >= 8 ? "Meget bra! Du har god kontroll på luftbremsene." : t.poeng >= 5 ? "Bra. Gå gjennom oppdragene der du var usikker." : "Prøv oppdragene og fagstoffet, og ta testen igjen."),
        h("button", { class: "knapp primar", onclick: () => { app.test = null; visFane(); } }, "Ta testen på nytt"),
      );
      return;
    }
    faneinnhold.append(
      h("div", { class: "kort-topp" }, h("span", { class: "brikke" }, "Spørsmål " + (t.i + 1) + " av " + t.sporsmal.length), h("span", { class: "brikke" }, t.poeng + " riktige")),
      h("div", { class: "framdrift" }, h("i", { style: `width:${(100 * t.i) / t.sporsmal.length}%` })),
    );
    const neste = h("button", { class: "knapp primar", hidden: true, onclick: () => { t.i++; visFane(); } }, t.i + 1 < t.sporsmal.length ? "Neste" : "Se resultatet");
    faneinnhold.append(sporsmalKort(t.sporsmal[t.i], (riktig) => {
      if (riktig) t.poeng++;
      neste.hidden = false;
    }, { tillatNyttForsok: false }), h("div", { class: "knapperad" }, neste));
  }

  // ---------------------------------------------------------------- verksted
  function visVerksted() {
    faneinnhold.append(h("p", { class: "ingress" }, "Legg inn feil og se hvordan systemet reagerer. «Liten» er en normal, akseptabel lekkasje, «Stor» er en revnet slange."));
    const rad = (punkt, navn) => {
      const sel = h("select", { "aria-label": navn, onchange: (e) => { m.lekkasje[punkt] = e.target.value; } },
        Object.keys(bm.LEKKASJENIVAA).map((n) => h("option", { value: n }, n)));
      sel.value = m.lekkasje[punkt];
      return h("div", { class: "verkstedrad" }, h("span", {}, navn), sel);
    };
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Lekkasjer – trekkbil"));
    for (const [p, n] of Object.entries(bm.LEKKASJEPUNKT)) faneinnhold.append(rad(p, n));
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Lekkasjer – tilhenger"));
    for (const [p, n] of Object.entries(bm.LEKKASJEPUNKT_TILHENGER)) faneinnhold.append(rad(p, n));
    faneinnhold.append(h("div", { class: "seksjonstittel" }, "Lufttørker"));
    const cb = h("input", { type: "checkbox", onchange: (e) => m.sett_torker(e.target.checked) });
    cb.checked = m.torker_defekt;
    faneinnhold.append(
      h("div", { class: "verkstedrad" }, h("label", { class: "bryter" }, cb, h("span"), "Lufttørker defekt"),
        h("button", { class: "knapp diskret", style: "flex:none", onclick: () => m.tapp_vann() }, "Tapp vann")),
      h("div", { class: "knapperad" }, h("button", { class: "knapp diskret", onclick: () => { settOppsett({ fyll: true, motor: false, haand: 100 }); visFane(); } }, "Nullstill alt")),
    );
  }

  // ---------------------------------------------------------------- fagstoff
  function visFagstoffListe() {
    faneinnhold.append(h("p", { class: "ingress" }, "Kort om hver komponent, og hva du som sjåfør skal passe på. Klikk på en komponent i skjemaet for å hoppe hit."));
    for (const f of I.FAGSTOFF) {
      faneinnhold.append(h("details", { class: "fag", id: "fag-" + f.id, open: app.visning && app.visning.id === f.id },
        h("summary", {}, f.tittel),
        h("div", {}, h("p", {}, f.tekst), h("p", { class: "sjafor" }, h("b", {}, "Sjåføren: "), f.sjafor))));
    }
    if (app.visning && app.visning.type === "fag") {
      const e = $("fag-" + app.visning.id);
      if (e) {
        e.classList.add("markert");
        e.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }
  }

  function visFagstoff(id) {
    app.fane = "fagstoff";
    app.visning = { type: "fag", id };
    visFane();
    document.querySelectorAll(".boks.markert").forEach((b) => b.classList.remove("markert"));
    document.querySelectorAll(`.boks[data-id="${id}"]`).forEach((b) => b.classList.add("markert"));
  }

  // ---------------------------------------------------------------- fremgang
  function oppdaterFremgang() {
    const n = I.OPPDRAG.filter((o) => lagret.oppdrag[o.id]).length;
    const ff = lagret.finnfeil;
    $("fremgang").innerHTML = "";
    $("fremgang").append(
      h("span", {}, "Oppdrag ", h("b", {}, n + "/" + I.OPPDRAG.length)),
      h("span", {}, "Finn feilen ", h("b", {}, ff.riktig + "/" + ff.forsok)),
      h("span", {}, "Test ", h("b", {}, lagret.test.beste === null ? "–" : lagret.test.beste + "/10")),
    );
  }

  // ==================================================================== løkke
  let sist = performance.now();
  let sistGraf = 0;
  const glatt = new Map();

  function ramme(naa) {
    const dtReell = Math.min(0.1, Math.max(0, (naa - sist) / 1000));
    sist = naa;
    if (!app.pause && dtReell > 0) {
      m.pedal = app.pedalHoldt ? 1.0 : app.pedalVerdi / 100;
      const dtSim = dtReell * app.fart;
      const noder = m.alleNoder();
      const for_ = noder.map((n) => n.trykk);
      m.kjor(dtSim);
      noder.forEach((n, i) => {
        const d = (n.trykk - for_[i]) / dtSim;
        const g = 0.8 * (glatt.get(n) || 0) + 0.2 * d;
        glatt.set(n, g);
        app.dp.set(n, g);
      });
      app.sistDt = dtSim;
      if (m.tid >= app.nesteProve) {
        app.historikk.push([m.tid, SERIER.map((s) => s.f(m))]);
        app.nesteProve = m.tid + PROVE_S;
        const grense = m.tid - HISTORIKK_S - 5;
        while (app.historikk.length && app.historikk[0][0] < grense) app.historikk.shift();
      }
      sjekkOppdrag();
    } else {
      app.sistDt = 0;
    }
    mano1([m.tanker.K1.trykk, m.tanker.K2.trykk]);
    mano2([m.tanker.K3.trykk, m.t_tank.trykk]);
    for (const l of LAMPER) lampeEl[l.id].classList.toggle("paa", l.paa(m));
    AVLESNING.forEach(([, f], i) => { avlesEl[i].textContent = f(m); });
    oppdaterSkjema();
    oppdaterKjoretoy();
    synkBetjening();
    behandleLogg();
    if (naa - sistGraf > 200) { tegnGraf(); sistGraf = naa; }
    requestAnimationFrame(ramme);
  }

  visFane();
  oppdaterFremgang();
  requestAnimationFrame(ramme);
})();
