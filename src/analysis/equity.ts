/**
 * Équité au Texas Hold'em — moteur pur.
 *
 * Deux briques :
 *  1. `evaluate7` : rang de la meilleure main de 5 cartes parmi 7 (tuple
 *     comparable [catégorie, kickers…]).
 *  2. `equite` : équité du Hero face à une ou plusieurs mains CONNUES, en
 *     complétant le board. Énumération EXACTE dès le flop (peu de combinaisons)
 *     et Monte-Carlo au préflop (trop de tirages : C(48,5) ≈ 1,7 M).
 *
 * Usage visé : au showdown on connaît les cartes adverses → équité RÉELLE a
 * posteriori (vs la main effectivement montrée, pas vs une range). Le verdict
 * pédagogique compare cette équité à la cote (pot odds).
 */

const RANK_IDX: Record<string, number> = {
  "2": 0, "3": 1, "4": 2, "5": 3, "6": 4, "7": 5, "8": 6,
  "9": 7, T: 8, J: 9, Q: 10, K: 11, A: 12,
};
const SUIT_IDX: Record<string, number> = { c: 0, d: 1, h: 2, s: 3 };

/** "Ah" → entier 0..51 (= rangIdx*4 + couleurIdx). null si carte invalide. */
export function parseCard(card: string): number | null {
  const r = RANK_IDX[card[0]];
  const s = SUIT_IDX[card[1]];
  if (r == null || s == null) return null;
  return r * 4 + s;
}
/** Catégorie d'un score (0 hauteur … 8 quinte flush). */
export const scoreCat = (score: number): number => Math.floor(score / 0x1000000);

// Scratch réutilisés (mono-thread, pas de réentrance) → zéro allocation par éval.
const RCNT = new Int8Array(15); // effectifs par rang (2..14)
const SCNT = new Int8Array(4); // effectifs par couleur
const SMASK = new Int32Array(4); // masque de rangs présents par couleur

/** Plus haute quinte dans un masque de rangs (gère la roue A-2-3-4-5). 0 sinon. */
function straightHigh(mask: number): number {
  let m = mask;
  if (m & (1 << 14)) m |= 1 << 1; // l'As joue aussi comme 1
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let j = 0; j < 5; j++)
      if (!(m & (1 << (hi - j)))) {
        ok = false;
        break;
      }
    if (ok) return hi;
  }
  return 0;
}

/**
 * Score entier de la meilleure main de 5 parmi 7 cartes (indices 0..51),
 * évaluation DIRECTE en une passe (pas de combinaisons). Plus le score est
 * grand, meilleure est la main. Packing : catégorie<<24 | départages (4 bits/rang).
 * Catégories : 8 quinte flush, 7 carré, 6 full, 5 couleur, 4 quinte, 3 brelan,
 * 2 double paire, 1 paire, 0 hauteur.
 */
export function score7(cards: number[]): number {
  RCNT.fill(0);
  SCNT.fill(0);
  SMASK.fill(0);
  let rankMask = 0;
  for (let k = 0; k < cards.length; k++) {
    const c = cards[k];
    const r = (c >> 2) + 2;
    const s = c & 3;
    RCNT[r]++;
    SCNT[s]++;
    SMASK[s] |= 1 << r;
    rankMask |= 1 << r;
  }

  // Quinte flush
  let flushSuit = -1;
  for (let s = 0; s < 4; s++) if (SCNT[s] >= 5) flushSuit = s;
  if (flushSuit >= 0) {
    const sf = straightHigh(SMASK[flushSuit]);
    if (sf) return 8 * 0x1000000 + (sf << 20);
  }

  // Groupes (carré / brelans / paires) + kickers, en parcourant du plus haut rang.
  let quad = 0;
  let trip1 = 0, trip2 = 0;
  let pair1 = 0, pair2 = 0;
  for (let r = 14; r >= 2; r--) {
    const c = RCNT[r];
    if (c === 4) quad = r;
    else if (c === 3) {
      if (!trip1) trip1 = r;
      else if (!trip2) trip2 = r;
    } else if (c === 2) {
      if (!pair1) pair1 = r;
      else if (!pair2) pair2 = r;
    }
  }
  const topKickers = (exclA: number, exclB: number, n: number): number => {
    let t = 0, got = 0;
    for (let r = 14; r >= 2 && got < n; r--) {
      if (r === exclA || r === exclB || RCNT[r] === 0) continue;
      t = (t << 4) | r;
      got++;
    }
    return t;
  };

  if (quad) return 7 * 0x1000000 + (quad << 20) + (topKickers(quad, 0, 1) << 16);
  if (trip1 && (trip2 || pair1)) {
    const paire = trip2 || pair1; // 2e brelan compte comme paire
    return 6 * 0x1000000 + (trip1 << 20) + (paire << 16);
  }
  if (flushSuit >= 0) {
    // 5 meilleurs rangs de la couleur
    let t = 0, got = 0;
    for (let r = 14; r >= 2 && got < 5; r--)
      if (SMASK[flushSuit] & (1 << r)) {
        t = (t << 4) | r;
        got++;
      }
    return 5 * 0x1000000 + t;
  }
  const st = straightHigh(rankMask);
  if (st) return 4 * 0x1000000 + (st << 20);
  if (trip1) return 3 * 0x1000000 + (trip1 << 20) + (topKickers(trip1, 0, 2) << 12);
  if (pair1 && pair2) return 2 * 0x1000000 + (pair1 << 20) + (pair2 << 16) + (topKickers(pair1, pair2, 1) << 12);
  if (pair1) return 1 * 0x1000000 + (pair1 << 20) + (topKickers(pair1, 0, 3) << 8);
  return 0 * 0x1000000 + topKickers(0, 0, 5);
}

export interface Equite {
  /** Part d'équité du Hero (0..1) : victoires + partages pondérés. */
  equity: number;
  /** true si énumération exacte, false si Monte-Carlo (préflop). */
  exact: boolean;
  /** Nombre de tableaux évalués. */
  echantillons: number;
}

/** Part du Hero sur UN tableau complet (1 si seul meilleur, 1/n si partage, 0 sinon). */
function partHero(hero7: number[], vilains7: number[][]): number {
  const heroScore = score7(hero7);
  let meilleurVilain = -1;
  let egaux = 0; // nb de vilains à égalité avec le meilleur score vilain
  for (const v of vilains7) {
    const vs = score7(v);
    if (vs > meilleurVilain) {
      meilleurVilain = vs;
      egaux = 1;
    } else if (vs === meilleurVilain) {
      egaux++;
    }
  }
  if (heroScore > meilleurVilain) return 1; // Hero seul devant
  if (heroScore < meilleurVilain) return 0; // Hero battu
  return 1 / (egaux + 1); // partage entre Hero et les vilains à égalité
}

/**
 * Équité du Hero face à des mains adverses connues, board partiel autorisé.
 * `hero` = 2 cartes, `vilains` = liste de mains de 2 cartes, `board` = 0/3/4/5 cartes.
 * Chaînes façon "Ah","Td". Renvoie null si cartes invalides/incohérentes.
 */
export function equite(
  hero: [string, string],
  vilains: [string, string][],
  board: string[],
  samples = 30000,
): Equite | null {
  const heroC = hero.map(parseCard);
  const vilC = vilains.map((v) => v.map(parseCard));
  const boardC = board.map(parseCard);
  const all = [...heroC, ...vilC.flat(), ...boardC];
  if (all.some((c) => c == null)) return null;
  const known = all as number[];
  if (new Set(known).size !== known.length) return null; // doublon de carte

  const heroInts = heroC as number[];
  const vilInts = vilC as number[][];
  const boardInts = boardC as number[];
  const uses = new Set(known);
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) if (!uses.has(i)) deck.push(i);

  const need = 5 - boardInts.length;
  let somme = 0;
  let n = 0;

  const scoreBoard = (extra: number[]) => {
    const full = [...boardInts, ...extra];
    somme += partHero([...heroInts, ...full], vilInts.map((v) => [...v, ...full]));
    n++;
  };

  if (need <= 0) {
    scoreBoard([]);
  } else if (boardInts.length >= 3) {
    // Flop (need 2) ou turn (need 1) : énumération exacte.
    const rec = (start: number, chosen: number[]) => {
      if (chosen.length === need) return scoreBoard(chosen);
      for (let i = start; i < deck.length; i++) rec(i + 1, [...chosen, deck[i]]);
    };
    rec(0, []);
  } else {
    // Préflop (need 5) : Monte-Carlo (énumération exacte ≈ 1,7 M de tableaux).
    for (let s = 0; s < samples; s++) {
      const pool = deck.slice();
      const extra: number[] = [];
      for (let k = 0; k < need; k++) {
        const j = Math.floor(Math.random() * pool.length);
        extra.push(pool[j]);
        pool[j] = pool[pool.length - 1];
        pool.pop();
      }
      scoreBoard(extra);
    }
  }

  return { equity: somme / n, exact: need <= 0 || boardInts.length >= 3, echantillons: n };
}

/**
 * Équité du Hero contre des adversaires aux cartes INCONNUES (mains au hasard,
 * tirées uniformément). Ne nécessite QUE les cartes du Hero + le board.
 * Toujours Monte-Carlo (on échantillonne à la fois les mains adverses et le
 * board restant). Repère « dans le vide » : un adversaire qui mise a en général
 * une range plus forte qu'une main au hasard → équité réelle souvent plus basse.
 */
export function equiteVsHasard(
  hero: [string, string],
  board: string[],
  nVilains = 1,
  samples = 15000,
): Equite | null {
  const heroC = hero.map(parseCard);
  const boardC = board.map(parseCard);
  const known = [...heroC, ...boardC];
  if (known.some((c) => c == null)) return null;
  const knownInts = known as number[];
  if (new Set(knownInts).size !== knownInts.length) return null;

  const heroInts = heroC as number[];
  const boardInts = boardC as number[];
  const uses = new Set(knownInts);
  const deck: number[] = [];
  for (let i = 0; i < 52; i++) if (!uses.has(i)) deck.push(i);

  const need = 5 - boardInts.length + 2 * nVilains; // mains adverses + complément de board
  if (need > deck.length) return null;

  let somme = 0;
  for (let s = 0; s < samples; s++) {
    const pool = deck.slice();
    const drawn: number[] = [];
    for (let k = 0; k < need; k++) {
      const j = Math.floor(Math.random() * pool.length);
      drawn.push(pool[j]);
      pool[j] = pool[pool.length - 1];
      pool.pop();
    }
    const vilains: number[][] = [];
    for (let v = 0; v < nVilains; v++) vilains.push([drawn[2 * v], drawn[2 * v + 1]]);
    const full = [...boardInts, ...drawn.slice(2 * nVilains)];
    somme += partHero([...heroInts, ...full], vilains.map((v) => [...v, ...full]));
  }
  return { equity: somme / samples, exact: false, echantillons: samples };
}
