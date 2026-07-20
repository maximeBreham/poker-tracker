/**
 * Modèle de MAIN — parsing des fichiers HAND-HISTORY Winamax.
 *
 * Frère du modèle `Tournoi` (résumé, voir types.ts), relié par `tournoiId`.
 * Un fichier hand-history contient PLUSIEURS mains, chacune commençant par
 * `Winamax Poker - Tournament "…"`. Chaque main est jouée street par street.
 *
 * PRINCIPE (identique à types.ts) : ne contient que des FAITS lus dans le
 * fichier. Tout ce qui se calcule — cote, équité, pot odds, tapis effectif en
 * BB, position, SPR — est DÉRIVÉ par le module d'analyse, jamais stocké ici.
 * Ainsi le rejeu (repli des actions) reconstruit le pot et le montant à suivre
 * à chaque décision sans redondance.
 */

/** Carte = 2 caractères : rang + couleur. Ex. "Ah", "Td", "7s". */
export type Carte = string;

export type Street = "preflop" | "flop" | "turn" | "river";

export type ActionType =
  | "post_sb"
  | "post_bb"
  | "post_ante"
  | "fold"
  | "check"
  | "call"
  | "bet"
  | "raise";

export interface Action {
  /** Siège qui agit (référence stable vers Joueur.seat). */
  seat: number;
  type: ActionType;
  /**
   * Jetons AJOUTÉS au pot par cette action. 0 pour fold/check.
   * Le parser normalise « raises X to Y » : montant = Y − déjà engagé sur la
   * street (l'ante ne compte pas dans « déjà engagé »).
   */
  montant: number;
  /** true si l'action met le joueur à tapis (« and is all-in »). */
  allIn: boolean;
}

export interface Joueur {
  seat: number;
  /** "Hero" ou pseudo adverse (anonymisé dans les fixtures). */
  nom: string;
  /** Tapis en JETONS au début de la main. */
  tapisDebut: number;
  isHero: boolean;
  /**
   * Cartes connues. Hero : toujours (via « Dealt to »). Adversaire :
   * seulement s'il les montre au showdown. null sinon.
   */
  cartes: [Carte, Carte] | null;
  /** Prime en € (KO uniquement, ex. « 1€ bounty »), sinon null. */
  bounty: number | null;
}

export interface StreetData {
  street: Street;
  /** Cartes NOUVELLES révélées à cette street (flop: 3, turn/river: 1, preflop: []). */
  cartes: Carte[];
  /**
   * Actions dans l'ordre chronologique. En preflop, commence par les
   * post_sb / post_bb / post_ante.
   */
  actions: Action[];
}

export interface Main {
  /** HandId Winamax complet, unique. Ex. "#4946434554001883137-1-1784407378". */
  id: string;
  /** N° de la main dans le tournoi (segment central du HandId) — ordre canonique. */
  numero: number;
  /** Lien vers Tournoi.id (nombre entre parenthèses du nom de table). */
  tournoiId: string;
  /** Nom du tournoi lu dans l'en-tête (ex. "Expresso", "SPACE KO"). */
  tournoiNom: string;
  /** Buy-in total en € (somme des composantes de l'en-tête). */
  buyIn: number;

  /** ISO 8601 UTC, tel que lu. */
  startedAt: string;
  /** Niveau de blinds. */
  level: number;
  blinds: { sb: number; bb: number; ante: number };

  /** Nombre max de sièges de la table (ex. 3 pour un Expresso, 6 pour un MTT 6-max). */
  maxSeats: number;
  buttonSeat: number;

  /** Joueurs présents à CETTE main (les bustés ont disparu), ordre des sièges. */
  joueurs: Joueur[];
  /** preflop toujours présent ; flop/turn/river présents si la main y va. */
  streets: StreetData[];

  /** Lignes « collected » sommées par siège (gère main pot + side pots). */
  gains: { seat: number; montant: number }[];
  /** « Total pot » du SUMMARY — sert de contrôle : pot reconstruit == totalPot. */
  totalPot: number;

  /** Fichier source (rapport d'import + debug). */
  sourceFile: string;
}

/** Résultat du parsing d'un fichier hand-history (plusieurs mains). */
export interface ParseHandsResult {
  mains: Main[];
  /** Mains non exploitables (pour le rapport d'import + debug). */
  errors: { sourceFile: string; reason: string; raw?: string }[];
}
