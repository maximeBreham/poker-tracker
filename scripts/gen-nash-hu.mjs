/**
 * Générateur de la table Nash push/fold HEADS-UP (chipEV).
 *
 * 1. Matrice d'équité préflop 169×169 (Monte-Carlo, combos réelles).
 * 2. Pour chaque profondeur effective S (BB, grille 1..25 par pas de 0,5),
 *    résout l'équilibre par point fixe :
 *      - SB open-shove si EV(shove) > EV(fold=-0,5) ;
 *      - BB call si équité ≥ (S-1)/(2S).
 * 3. Écrit src/analysis/data/nashHU.json : par profondeur, les ranges push (SB)
 *    et call (BB) en notation ("AA","AKs"…).
 *
 * Régénérer :  npx vite-node scripts/gen-nash-hu.mjs
 * (Monte-Carlo → léger bruit sur les mains marginales ; la table committée fait foi.)
 */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { allHandClasses, sampleCombo } from "../src/analysis/holdem169.ts";
import { score7 } from "../src/analysis/equity.ts";

const rnd = Math.random;
const classes = allHandClasses();
const N = classes.length; // 169
const SAMPLES = 2000; // tirages Monte-Carlo par matchup

/** Équité de la classe a contre la classe b, heads-up préflop (part de a : win + tie/2). */
function classEquity(a, b) {
  let acc = 0;
  let n = 0;
  for (let s = 0; s < SAMPLES; s++) {
    const used = new Set();
    const ca = sampleCombo(a, used, rnd);
    if (!ca) continue;
    used.add(ca[0]); used.add(ca[1]);
    const cb = sampleCombo(b, used, rnd);
    if (!cb) continue;
    used.add(cb[0]); used.add(cb[1]);
    // 5 cartes de board sans collision
    const board = [];
    while (board.length < 5) {
      const c = Math.floor(rnd() * 52);
      if (!used.has(c)) { used.add(c); board.push(c); }
    }
    const sa = score7([ca[0], ca[1], ...board]);
    const sb = score7([cb[0], cb[1], ...board]);
    acc += sa > sb ? 1 : sa < sb ? 0 : 0.5;
    n++;
  }
  return n ? acc / n : 0.5;
}

console.log("Calcul matrice d'équité 169×169 (Monte-Carlo)…");
const E = Array.from({ length: N }, () => new Float64Array(N));
for (let i = 0; i < N; i++) {
  E[i][i] = 0.5;
  for (let j = i + 1; j < N; j++) {
    const e = classEquity(classes[i], classes[j]);
    E[i][j] = e;
    E[j][i] = 1 - e;
  }
  if (i % 20 === 0) console.log(`  ligne ${i}/${N}`);
}

const totalCombos = classes.reduce((s, c) => s + c.combos, 0); // 1326

/** Équité de la main i contre une range PONDÉRÉE (poids w[j] ∈ [0,1] × combos). */
function eqVsWeighted(i, w) {
  let num = 0, den = 0;
  for (let j = 0; j < N; j++) {
    if (w[j] <= 0) continue;
    const c = classes[j].combos * w[j];
    num += c * E[i][j];
    den += c;
  }
  return den ? num / den : 0.5;
}

/**
 * Équilibre push/fold par FICTITIOUS PLAY : chaque joueur répond à la MOYENNE
 * temporelle de la stratégie adverse → converge sans osciller (contrairement à
 * la meilleure réponse brute qui cycle aux stacks profonds).
 */
function solve(S) {
  const seuil = (S - 1) / (2 * S); // équité mini pour que BB paie
  const pushAvg = new Float64Array(N).fill(0.5);
  const callAvg = new Float64Array(N).fill(0.5);
  const pushSum = new Float64Array(N);
  const callSum = new Float64Array(N);
  const ITERS = 300;
  for (let it = 1; it <= ITERS; it++) {
    const callFrac = classes.reduce((s, c, j) => s + c.combos * callAvg[j], 0) / totalCombos;
    for (let i = 0; i < N; i++) {
      // SB : shove si EV(shove) > EV(fold) = -0,5, vs la range de call moyenne
      const eSb = eqVsWeighted(i, callAvg);
      const evShove = (1 - callFrac) * 1 + callFrac * (S * (2 * eSb - 1));
      pushSum[i] += evShove > -0.5 ? 1 : 0;
      // BB : call si équité vs la range de push moyenne ≥ seuil
      const eBb = eqVsWeighted(i, pushAvg);
      callSum[i] += eBb >= seuil ? 1 : 0;
    }
    for (let i = 0; i < N; i++) {
      pushAvg[i] = pushSum[i] / it;
      callAvg[i] = callSum[i] / it;
    }
  }
  // Range finale = mains présentes ≥ 50 % du temps (majorité de l'équilibre).
  const push = new Set();
  const call = new Set();
  for (let i = 0; i < N; i++) {
    if (pushAvg[i] >= 0.5) push.add(i);
    if (callAvg[i] >= 0.5) call.add(i);
  }
  return { push, call };
}

const fracOf = (freq) => classes.reduce((s, c, j) => s + c.combos * freq[j], 0) / totalCombos;
const eqVsFreq = (i, freq) => {
  let num = 0, den = 0;
  for (let j = 0; j < N; j++) {
    const c = classes[j].combos * freq[j];
    if (c > 0) { num += c * E[i][j]; den += c; }
  }
  return den ? num / den : 0.5;
};
const merged = (a, b) => { const m = new Float64Array(N); for (let j = 0; j < N; j++) m[j] = Math.max(a[j], b[j]); return m; };

/**
 * Équilibre push/fold 3-MAX (tapis égaux S), approximation « calleurs
 * indépendants » + équité 3-way approximée (range fusionnée). chipEV.
 * Nodes : BTN open-jam, SB call vs BTN-jam, BB call vs BTN-jam.
 * (SB-open / BB-vs-SB restent couverts par la table heads-up.)
 */
function solve3max(S) {
  const btn = new Float64Array(N).fill(0.35);
  const sbc = new Float64Array(N).fill(0.25);
  const bbc = new Float64Array(N).fill(0.25);
  const bs = new Float64Array(N), ss = new Float64Array(N), bbs = new Float64Array(N);
  const ITERS = 300;
  for (let it = 1; it <= ITERS; it++) {
    const cSB = fracOf(sbc), cBB = fracOf(bbc);
    for (let i = 0; i < N; i++) {
      // BTN : jam si EV > 0 (fold = 0)
      const eSb = eqVsFreq(i, sbc), eBb = eqVsFreq(i, bbc), e3 = eqVsFreq(i, merged(sbc, bbc));
      const evJam =
        (1 - cSB) * (1 - cBB) * 1.5 +
        cSB * (1 - cBB) * (eSb * (2 * S + 1) - S) +
        (1 - cSB) * cBB * (eBb * (2 * S + 0.5) - S) +
        cSB * cBB * (e3 * 3 * S - S);
      bs[i] += evJam > 0 ? 1 : 0;
      // SB call vs BTN jam : call si EV > -0,5
      const e2s = eqVsFreq(i, btn), e3s = eqVsFreq(i, merged(btn, bbc));
      const evCallSb = (1 - cBB) * (e2s * (2 * S + 1) - S) + cBB * (e3s * 3 * S - S);
      ss[i] += evCallSb > -0.5 ? 1 : 0;
      // BB call vs BTN jam (SB couché) : call si EV > -1
      const e2b = eqVsFreq(i, btn);
      bbs[i] += e2b * (2 * S + 0.5) - S > -1 ? 1 : 0;
    }
    for (let i = 0; i < N; i++) { btn[i] = bs[i] / it; sbc[i] = ss[i] / it; bbc[i] = bbs[i] / it; }
  }
  const range = (f) => classes.filter((_, i) => f[i] >= 0.5).map((c) => c.name);
  return { btnJam: range(btn), sbCallVsBtn: range(sbc), bbCallVsBtn: range(bbc) };
}

// Push/fold pertinent en tapis court seulement → plafond 20 BB (au-delà : postflop).
const depths = [];
for (let x = 2; x <= 20; x += 0.5) depths.push(x);
const table = {};
for (const S of depths) {
  const { push, call } = solve(S);
  table[S] = {
    push: [...push].map((k) => classes[k].name),
    call: [...call].map((k) => classes[k].name),
  };
}

// Sanity ballparks
const pct = (S) => Math.round((table[S].push.reduce((s, n) => s + combosOf(n), 0) / totalCombos) * 100);
function combosOf(name) { return classes.find((c) => c.name === name).combos; }
console.log("Push % SB @10bb:", pct(10), "| @15bb:", pct(15), "| @20bb:", pct(20));
console.log("nb push classes @5bb:", table[5].push.length, "@10bb:", table[10].push.length, "@20bb:", table[20].push.length);
console.log("AA push @20bb ?", table[20].push.includes("AA"), "| 72o push @20bb ?", table[20].push.includes("72o"), "| 72o push @5bb ?", table[5].push.includes("72o"));

const out = fileURLToPath(new URL("../src/analysis/data/nashHU.json", import.meta.url));
writeFileSync(out, JSON.stringify({ generatedSamples: SAMPLES, depths, table }, null, 0));
console.log("Écrit :", out);

// Matrice d'équité préflop 169×169 (pour le solveur 3-max runtime) — arrondie 3 déc.
const names = classes.map((c) => c.name);
const combos = classes.map((c) => c.combos);
const Erounded = E.map((row) => Array.from(row, (v) => Math.round(v * 1000) / 1000));
const outE = fileURLToPath(new URL("../src/analysis/data/preflopEquity.json", import.meta.url));
writeFileSync(outE, JSON.stringify({ names, combos, E: Erounded }, null, 0));
console.log("Écrit :", outE);

// Table push/fold 3-MAX (par tapis effectif, tapis égaux).
console.log("Solve 3-max…");
const table3 = {};
for (const S of depths) table3[S] = solve3max(S);
const pctOf = (arr) => Math.round((arr.reduce((s, n) => s + combosOf(n), 0) / totalCombos) * 100);
console.log("BTN open-jam % @8bb:", pctOf(table3[8].btnJam), "@12bb:", pctOf(table3[12].btnJam), "@20bb:", pctOf(table3[20].btnJam));
console.log("BB call-vs-BTN % @10bb:", pctOf(table3[10].bbCallVsBtn), "| AA btnJam @20bb ?", table3[20].btnJam.includes("AA"));
const out3 = fileURLToPath(new URL("../src/analysis/data/nash3max.json", import.meta.url));
writeFileSync(out3, JSON.stringify({ generatedSamples: SAMPLES, depths, table: table3 }, null, 0));
console.log("Écrit :", out3);
