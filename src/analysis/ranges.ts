/**
 * Ranges adverses paramétrées par le buy-in + équité vs range.
 *
 * MODÈLE assumé (≠ vérité, ≠ équilibre) : on assigne à l'adversaire une range
 * = les « top X% » mains, où X dépend du buy-in (micro = large/passif, plus
 * cher = plus serré). Plus réaliste que « vs une main au hasard », mais c'est
 * une hypothèse — ajustable, et étiquetée comme telle dans l'UI.
 *
 * Le classement de force des mains est dérivé de la matrice d'équité préflop
 * (force = équité moyenne vs le champ). L'équité du Hero vs la range est
 * calculée par Monte-Carlo (pré/postflop, gère les cartes bloquées).
 */
import { allHandClasses, sampleCombo, type HandClass } from "./holdem169";
import { score7, parseCard } from "./equity";
import eqData from "./data/preflopEquity.json";

const NAMES = (eqData as { names: string[] }).names;
const COMBOS = (eqData as { combos: number[] }).combos;
const E = (eqData as { E: number[][] }).E;
const TOTAL_COMBOS = COMBOS.reduce((s, c) => s + c, 0); // 1326
const IDX = new Map(NAMES.map((n, i) => [n, i]));
const CLASSES: HandClass[] = allHandClasses();
const CLASS_BY_NAME = new Map(CLASSES.map((c) => [c.name, c]));

/** Force préflop d'une classe = équité moyenne vs le champ (pondérée combos). */
const STRENGTH = NAMES.map((_, i) => {
  let num = 0;
  for (let j = 0; j < NAMES.length; j++) num += COMBOS[j] * E[i][j];
  return num / TOTAL_COMBOS;
});
/** Classes triées de la plus forte à la plus faible. */
const RANKED = NAMES.map((n, i) => ({ n, s: STRENGTH[i] })).sort((a, b) => b.s - a.s);

/** Les noms de classes couvrant les « top pct » (0..1) mains, par force décroissante. */
export function topRangeClasses(pct: number): string[] {
  const target = Math.max(0, Math.min(1, pct)) * TOTAL_COMBOS;
  const out: string[] = [];
  let acc = 0;
  for (const { n } of RANKED) {
    if (acc >= target) break;
    out.push(n);
    acc += COMBOS[IDX.get(n)!];
  }
  return out.length ? out : [RANKED[0].n]; // au moins la meilleure main
}

export interface ProfilAdverse {
  cle: string;
  label: string;
  /** Largeur de range (fraction des mains). */
  pct: number;
}

/** Profil par défaut déduit du buy-in total (€). Micro = large, cher = serré. */
export function profilParBuyIn(buyIn: number): ProfilAdverse {
  if (buyIn <= 0.5) return { cle: "micro", label: "Micro", pct: 0.55 };
  if (buyIn <= 2) return { cle: "low", label: "Faible", pct: 0.45 };
  if (buyIn <= 5) return { cle: "mid", label: "Moyen", pct: 0.38 };
  return { cle: "high", label: "Élevé", pct: 0.3 };
}

/** Tous les profils (pour un sélecteur manuel). */
export const PROFILS: ProfilAdverse[] = [
  { cle: "micro", label: "Micro", pct: 0.55 },
  { cle: "low", label: "Faible", pct: 0.45 },
  { cle: "mid", label: "Moyen", pct: 0.38 },
  { cle: "high", label: "Élevé", pct: 0.3 },
];

/**
 * Équité du Hero (0..1) vs une range (liste de classes), sur le board donné.
 * Monte-Carlo : tire une main adverse dans la range (pondérée combos, cartes
 * bloquées évitées) + complète le board. Renvoie null si entrées invalides.
 */
export function equiteVsRange(
  hero: [string, string],
  board: string[],
  rangeClasses: string[],
  samples = 6000,
): number | null {
  const h = hero.map(parseCard);
  const b = board.map(parseCard);
  if ([...h, ...b].some((c) => c == null)) return null;
  const heroInts = h as number[];
  const boardInts = b as number[];
  const base = new Set<number>([...heroInts, ...boardInts]);
  if (base.size !== heroInts.length + boardInts.length) return null;

  const classes = rangeClasses.map((n) => CLASS_BY_NAME.get(n)).filter((c): c is HandClass => !!c);
  if (!classes.length) return null;
  const poidsTotal = classes.reduce((s, c) => s + c.combos, 0);

  let somme = 0;
  let n = 0;
  const rnd = Math.random;
  for (let s = 0; s < samples; s++) {
    // Choix pondéré d'une classe adverse.
    let r = rnd() * poidsTotal;
    let cls = classes[0];
    for (const c of classes) {
      r -= c.combos;
      if (r <= 0) { cls = c; break; }
    }
    const used = new Set(base);
    const vil = sampleCombo(cls, used, rnd);
    if (!vil) continue;
    used.add(vil[0]); used.add(vil[1]);
    // Complète le board à 5.
    const extra: number[] = [];
    while (boardInts.length + extra.length < 5) {
      const c = Math.floor(rnd() * 52);
      if (!used.has(c)) { used.add(c); extra.push(c); }
    }
    const full = [...boardInts, ...extra];
    const sh = score7([...heroInts, ...full]);
    const sv = score7([vil[0], vil[1], ...full]);
    somme += sh > sv ? 1 : sh < sv ? 0 : 0.5;
    n++;
  }
  return n ? somme / n : null;
}
