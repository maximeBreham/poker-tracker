/**
 * Verdict pédagogique d'une décision : compare l'équité RÉELLE du Hero (face aux
 * mains montrées à l'abattage) à sa cote (pot odds) sur l'étape considérée.
 *
 * Limite assumée : l'équité n'est calculable que si le Hero a des cartes connues
 * ET qu'au moins un adversaire a montré les siennes au showdown. Sinon → null
 * (on n'invente pas de verdict). C'est une équité A POSTERIORI (vs la main réelle
 * de l'adversaire), pas vs sa range — à présenter comme tel.
 */
import type { Main } from "../parsing/handTypes";
import type { EtapeRejeu } from "./replay";
import { equite } from "./equity";
import { equiteVsRange, topRangeClasses, profilParBuyIn } from "./ranges";

export interface VerdictEquite {
  /** Équité du Hero (0..1) sur cette étape. */
  equity: number;
  /**
   * Base du calcul :
   *  - "montree" : vs les cartes réellement montrées à l'abattage (a posteriori, fiable) ;
   *  - "range"   : vs une range adverse modélisée (largeur selon buy-in) — hypothèse, sans abattage.
   */
  base: "montree" | "range";
  /** true si énumération exacte, false si Monte-Carlo. */
  exact: boolean;
  /** Cote à payer (pot odds) sur cette étape, ou null si rien à suivre. */
  cote: number | null;
  /** Équité ≥ cote ? null s'il n'y a rien à suivre. (Indicatif si base = "range".) */
  rentable: boolean | null;
  /** Nombre d'adversaires pris en compte (montrés, ou encore en jeu pour la range). */
  nbAdversaires: number;
  /** Largeur de range utilisée (base "range"), fraction 0..1. */
  rangePct?: number;
}

/**
 * Analyse d'équité d'une étape. Toujours calculable dès que le Hero a des cartes :
 *  - s'il y a abattage → équité vs les mains montrées (fiable) ;
 *  - sinon → équité vs une RANGE adverse modélisée (largeur = profil par buy-in,
 *    ou `rangePct` fourni). Hypothèse, pas une vérité — à présenter comme tel.
 * Renvoie null seulement si les cartes du Hero sont inconnues.
 */
export function verdictEquite(
  main: Main,
  etape: EtapeRejeu,
  opts?: { samples?: number; rangePct?: number },
): VerdictEquite | null {
  const hero = main.joueurs.find((j) => j.isHero);
  if (!hero?.cartes) return null;
  const cote = etape.cote;

  const montres = main.joueurs.filter((j) => !j.isHero && j.cartes);
  if (montres.length > 0) {
    const e = equite(hero.cartes, montres.map((v) => v.cartes!), etape.board, opts?.samples ?? 8000);
    if (!e) return null;
    return {
      equity: e.equity,
      base: "montree",
      exact: e.exact,
      cote,
      rentable: cote != null ? e.equity >= cote : null,
      nbAdversaires: montres.length,
    };
  }

  // Pas d'abattage : équité vs une range modélisée (largeur selon le buy-in, ajustable).
  const pct = opts?.rangePct ?? profilParBuyIn(main.buyIn).pct;
  const actifs = Math.max(1, etape.sieges.filter((s) => !s.couche && s.seat !== hero.seat).length);
  const eq = equiteVsRange(hero.cartes, etape.board, topRangeClasses(pct), opts?.samples ?? 6000);
  if (eq == null) return null;
  return {
    equity: eq,
    base: "range",
    exact: false,
    cote,
    rentable: cote != null ? eq >= cote : null,
    nbAdversaires: actifs,
    rangePct: pct,
  };
}
