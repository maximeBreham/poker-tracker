/**
 * Les 169 classes de mains de départ du Hold'em (13 paires + 78 suited + 78 offsuit)
 * et leur nombre de combinaisons. Sert de base au push/fold Nash heads-up.
 *
 * Notation standard : "AA", "AKs" (assortie), "AKo" (dépareillée).
 */
export const RANKS = ["A", "K", "Q", "J", "T", "9", "8", "7", "6", "5", "4", "3", "2"] as const;
const RANK_VAL: Record<string, number> = Object.fromEntries(RANKS.map((r, i) => [r, 14 - i]));

export interface HandClass {
  /** Notation, ex. "AKs". */
  name: string;
  /** true si paire. */
  pair: boolean;
  /** true si assortie (même couleur). */
  suited: boolean;
  /** Nombre de combinaisons possibles (paire 6, suited 4, offsuit 12). */
  combos: number;
  hi: number; // rang haut (2..14)
  lo: number; // rang bas
}

/** Construit la liste ordonnée des 169 classes (paires, puis suited, puis offsuit). */
export function allHandClasses(): HandClass[] {
  const out: HandClass[] = [];
  for (let i = 0; i < RANKS.length; i++) {
    for (let j = i; j < RANKS.length; j++) {
      const hi = 14 - i;
      const lo = 14 - j;
      if (i === j) {
        out.push({ name: `${RANKS[i]}${RANKS[j]}`, pair: true, suited: false, combos: 6, hi, lo });
      } else {
        out.push({ name: `${RANKS[i]}${RANKS[j]}s`, pair: false, suited: true, combos: 4, hi, lo });
        out.push({ name: `${RANKS[i]}${RANKS[j]}o`, pair: false, suited: false, combos: 12, hi, lo });
      }
    }
  }
  return out;
}

/** Deux cartes ("Ah","Kd") → classe ("AKo"). null si invalide. */
export function classOf(c1: string, c2: string): string | null {
  const r1 = RANK_VAL[c1[0]];
  const r2 = RANK_VAL[c2[0]];
  if (r1 == null || r2 == null) return null;
  const suited = c1[1] === c2[1];
  if (r1 === r2) return `${c1[0]}${c2[0]}`;
  const [hi, lo] = r1 > r2 ? [c1[0], c2[0]] : [c2[0], c1[0]];
  return `${hi}${lo}${suited ? "s" : "o"}`;
}

/**
 * Deux combinaisons de cartes concrètes (indices 0..51) tirées AU HASARD pour une
 * classe donnée (couleurs variables). Utilisé par le générateur d'équité Monte-Carlo.
 * `exclude` : cartes déjà utilisées (à éviter). Renvoie null si impossible.
 */
export function sampleCombo(cls: HandClass, exclude: Set<number>, rnd: () => number): [number, number] | null {
  const rHi = cls.hi - 2; // index de rang 0..12
  const rLo = cls.lo - 2;
  for (let tries = 0; tries < 40; tries++) {
    if (cls.pair) {
      const s1 = Math.floor(rnd() * 4);
      let s2 = Math.floor(rnd() * 3);
      if (s2 >= s1) s2++;
      const a = rHi * 4 + s1;
      const b = rHi * 4 + s2;
      if (!exclude.has(a) && !exclude.has(b)) return [a, b];
    } else if (cls.suited) {
      const s = Math.floor(rnd() * 4);
      const a = rHi * 4 + s;
      const b = rLo * 4 + s;
      if (!exclude.has(a) && !exclude.has(b)) return [a, b];
    } else {
      const s1 = Math.floor(rnd() * 4);
      let s2 = Math.floor(rnd() * 4);
      if (s2 === s1) s2 = (s2 + 1) % 4;
      const a = rHi * 4 + s1;
      const b = rLo * 4 + s2;
      if (!exclude.has(a) && !exclude.has(b)) return [a, b];
    }
  }
  return null;
}
