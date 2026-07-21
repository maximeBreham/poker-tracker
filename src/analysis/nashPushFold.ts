/**
 * Push/fold Nash HEADS-UP (chipEV) — consultation de la table pré-calculée
 * (src/analysis/data/nashHU.json, générée par scripts/gen-nash-hu.mjs).
 *
 * Rigueur & limites :
 *  - Équilibre Nash du sous-jeu jam-or-fold heads-up, chipEV. En Expresso
 *    winner-take-all heads-up, le chipEV ≈ ICM → verdict pertinent.
 *  - Équités par Monte-Carlo → léger bruit sur les mains marginales.
 *  - Profondeur couverte : 2 à 20 BB (au-delà, le push/fold ne s'applique plus).
 *  - Heads-up UNIQUEMENT (2 joueurs). Le 3-max n'est pas couvert ici.
 */
import { classOf } from "./holdem169";
import nashData from "./data/nashHU.json";

type NashTable = Record<string, { push: string[]; call: string[] }>;
const TABLE = (nashData as { table: NashTable }).table;
const DEPTHS = (nashData as { depths: number[] }).depths;
const MIN_BB = DEPTHS[0];
const MAX_BB = DEPTHS[DEPTHS.length - 1];

// Sets par profondeur (O(1) à la consultation).
const SETS = new Map<string, { push: Set<string>; call: Set<string> }>();
for (const [d, r] of Object.entries(TABLE)) {
  SETS.set(d, { push: new Set(r.push), call: new Set(r.call) });
}

/** Arrondit une profondeur au pas de 0,5 de la grille. */
function snapDepth(bb: number): number {
  return Math.round(bb * 2) / 2;
}

export interface NashResult {
  /** false si hors périmètre (profondeur > 20 BB → jeu postflop). */
  applicable: boolean;
  /** Profondeur retenue (BB, arrondie à la grille). */
  depth: number;
  /** La main est-elle dans la range Nash (push si SB, call si BB) ? */
  inRange: boolean;
  /** Action recommandée par l'équilibre. */
  recommandation: "push" | "call" | "fold";
}

/**
 * @param cartes  les 2 cartes du joueur (ex. ["Ah","Kd"]).
 * @param effBB   tapis effectif en BB (= plus petit tapis / BB).
 * @param role    "sb" = open-shove (bouton/SB), "bb" = payer un shove.
 */
export function nashPushFold(
  cartes: [string, string],
  effBB: number,
  role: "sb" | "bb",
): NashResult | null {
  const cls = classOf(cartes[0], cartes[1]);
  if (!cls) return null;

  // Au-delà de la profondeur max : hors cadre push/fold.
  if (effBB > MAX_BB + 0.25) {
    return { applicable: false, depth: effBB, inRange: false, recommandation: "fold" };
  }
  const depth = Math.min(MAX_BB, Math.max(MIN_BB, snapDepth(effBB)));
  const set = SETS.get(String(depth));
  if (!set) return null;

  const inRange = role === "sb" ? set.push.has(cls) : set.call.has(cls);
  const recommandation = inRange ? (role === "sb" ? "push" : "call") : "fold";
  return { applicable: true, depth, inRange, recommandation };
}
