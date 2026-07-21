/**
 * Push/fold 3-MAX (chipEV) — consultation de la table pré-calculée
 * (src/analysis/data/nash3max.json, générée par scripts/gen-nash-hu.mjs).
 *
 * APPROXIMATION assumée (≠ solveur exact type HRC) :
 *  - paramétré par tapis EFFECTIF, hypothèse tapis ÉGAUX (convention des charts
 *    Nash 3-max) ; pour des tapis inégaux on prend le tapis effectif = min ;
 *  - « calleurs indépendants » + équité 3-way (double-call) approximée ;
 *  - chipEV = ICM sous winner-take-all (Expresso x2–x6) ;
 *  - équités par Monte-Carlo → bruit sur les mains marginales.
 *  - Profondeur 2..20 BB (au-delà : postflop).
 *
 * Nodes couverts : BTN open-jam, SB call vs BTN-jam, BB call vs BTN-jam.
 * (SB-open et BB-vs-SB restent gérés par nashPushFold — heads-up / fold-to-SB.)
 */
import { classOf } from "./holdem169";
import data from "./data/nash3max.json";

export type Node3 = "btnJam" | "sbCallVsBtn" | "bbCallVsBtn";

type Table = Record<string, Record<Node3, string[]>>;
const TABLE = (data as { table: Table }).table;
const DEPTHS = (data as { depths: number[] }).depths;
const MIN_BB = DEPTHS[0];
const MAX_BB = DEPTHS[DEPTHS.length - 1];

const SETS = new Map<string, Record<Node3, Set<string>>>();
for (const [d, nodes] of Object.entries(TABLE)) {
  SETS.set(d, {
    btnJam: new Set(nodes.btnJam),
    sbCallVsBtn: new Set(nodes.sbCallVsBtn),
    bbCallVsBtn: new Set(nodes.bbCallVsBtn),
  });
}

export interface Nash3Result {
  applicable: boolean;
  depth: number;
  inRange: boolean;
  recommandation: "push" | "call" | "fold";
  node: Node3;
}

/**
 * @param cartes  2 cartes du joueur.
 * @param effBB   tapis effectif en BB (= plus petit tapis impliqué / BB).
 * @param node    "btnJam" (open-shove BTN) | "sbCallVsBtn" | "bbCallVsBtn".
 */
export function nash3max(cartes: [string, string], effBB: number, node: Node3): Nash3Result | null {
  const cls = classOf(cartes[0], cartes[1]);
  if (!cls) return null;
  if (effBB > MAX_BB + 0.25) {
    return { applicable: false, depth: effBB, inRange: false, recommandation: "fold", node };
  }
  const depth = Math.min(MAX_BB, Math.max(MIN_BB, Math.round(effBB * 2) / 2));
  const set = SETS.get(String(depth));
  if (!set) return null;
  const inRange = set[node].has(cls);
  const recommandation = inRange ? (node === "btnJam" ? "push" : "call") : "fold";
  return { applicable: true, depth, inRange, recommandation, node };
}
