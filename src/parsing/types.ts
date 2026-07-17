/**
 * Modèle de données — v1 (parsing des fichiers résumé de tournoi Winamax).
 *
 * Base : §Modèle de données du brief, AJUSTÉ après lecture de vrais fichiers
 * (voir src/parsing/__fixtures__/). Points notables issus du format réel :
 *  - Le résumé ne contient NI les gains NI le multiplicateur → dérivés (voir derive.ts).
 *  - Le Buy-In a 2 composantes (Expresso : entry + rake) ou 3 (KO : entry + bounty + rake).
 *  - Un même fichier peut contenir plusieurs blocs (re-entries late reg, même `id`)
 *    → la déduplication ne peut pas reposer sur `id` seul : voir `dedupKey`.
 */

export type Format = "expresso" | "expresso_nitro" | "mtt" | "other";

export interface Tournoi {
  /** Identifiant du tournoi = nombre entre parenthèses, ex. Expresso(1140809958) → "1140809958". */
  id: string;

  /**
   * Clé de déduplication. `id` seul ne suffit pas (re-entries partageant le même id).
   * Composite : `${id}#${entryIndex}` — ou hash(date+buyIn+prize+place) en fallback
   * si aucun id fiable. Voir points d'incertitude du brief.
   */
  dedupKey: string;

  /** Index de l'entrée dans le fichier (0 = 1re inscription, 1+ = re-entries). */
  entryIndex: number;

  /** ISO 8601 en UTC (tel que lu : "Tournament started YYYY/MM/DD HH:mm:ss UTC"). Conversion Europe/Paris à l'affichage. */
  startedAt: string;

  format: Format;
  name: string;

  /** Registered players. */
  players: number;

  /** Coût total en € (somme de toutes les composantes du Buy-In). */
  buyIn: number;
  /** Part entry (hors rake/bounty). */
  entry: number;
  /** Part « prime » (KO uniquement), sinon 0. */
  bounty: number;
  /** Part rake (dernier montant du Buy-In). */
  rake: number;

  prizePool: number | null;
  finishPlace: number | null;

  /**
   * Gains en €. Non présents dans le résumé → dérivés :
   *  - Expresso : place + grille de payout selon multiplicateur.
   *  - MTT/KO : partie ITM non fiable depuis le résumé seul (primes KO absentes) → à marquer.
   */
  winnings: number;
  /** true si `winnings` est une estimation (ex. MTT-KO sans détail de primes). */
  isWinningsEstimated: boolean;

  /** profit = winnings - buyIn. */
  profit: number;

  /** Expresso : multiplicateur = prizePool / buyIn. null hors Expresso. */
  multiplier: number | null;
  /** true si le multiplicateur est dérivé/estimé plutôt que lu. */
  isMultiplierEstimated: boolean;

  /** Chemin/nom du fichier source (pour le rapport d'import et le debug). */
  sourceFile: string;
}

/** Résultat du parsing d'un fichier (peut contenir plusieurs tournois : re-entries). */
export interface ParseResult {
  tournois: Tournoi[];
  /** Blocs non reconnus (pour le rapport d'import + aperçu brut du 1er fichier ignoré). */
  errors: { sourceFile: string; reason: string; raw?: string }[];
}
