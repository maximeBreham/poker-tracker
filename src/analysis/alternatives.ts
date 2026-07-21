/**
 * Alternatives d'une décision : liste les coups LÉGAUX du spot et, pour chacun,
 * le fait mathématique de référence + un rang qualitatif (bon / moyen / mauvais /
 * indéterminé) destiné à un dégradé vert→rouge.
 *
 * Rigueur assumée :
 *  - fold / check / call se comparent par leur EV immédiat (équité connue) :
 *    EV(fold)=0, EV(call)=équité×(pot+àSuivre)−àSuivre, check gratuit ≥ 0.
 *    Ce classement coïncide avec la cote : EV(call)>0 ⟺ équité>cote.
 *  - relance / mise : EV non calculable sans modèle d'adversaire (fréquence de
 *    fold) → rang "indetermine", on n'affiche que le fait (taux de fold requis).
 *  - si l'équité n'est pas fiable (pas d'abattage), TOUT est "indetermine".
 */
import type { EtapeRejeu } from "./replay";

export type RangAlt = "bon" | "moyen" | "mauvais" | "indetermine";

export interface Alternative {
  type: "fold" | "check" | "call" | "raise";
  /** Libellé affiché ("Se coucher", "Suivre (limp)", "Relancer"…). */
  label: string;
  /** EV immédiat en jetons, relatif au fold (0). null si non calculable. */
  evChips: number | null;
  /** Cote à battre pour le call (pot odds), si pertinent. */
  seuil?: number;
  /** Fraction de fold adverse requise pour rentabiliser une mise/relance. */
  foldRequis?: number;
  rang: RangAlt;
  /** Explication courte, honnête sur les limites. */
  note: string;
}

/**
 * @param etape       l'étape de décision (donne pot, àSuivre, action jouée).
 * @param equity      équité du Hero (0..1) ou null si inconnue.
 * @param equiteFiable true seulement au showdown (cartes adverses connues).
 * @param preflopUnraised true si préflop non relancé (le call est un "limp").
 */
export function alternatives(
  etape: EtapeRejeu,
  equity: number | null,
  equiteFiable: boolean,
  preflopUnraised = false,
): Alternative[] {
  const pot = etape.potAvant;
  const aSuivre = etape.aSuivre;
  const faceMise = aSuivre > 0;

  // EV du call (immédiat, sans miser davantage) relatif au fold.
  const evCall = equity != null ? equity * (pot + aSuivre) - aSuivre : null;
  const seuil = faceMise ? aSuivre / (pot + aSuivre) : undefined;

  // Taille de mise "type" pour illustrer une relance quand aucune n'est en cours
  // (ex. 2/3 pot) → sert uniquement à donner le taux de fold requis indicatif.
  const miseType = faceMise ? aSuivre * 3 : Math.round(pot * 0.66);
  const foldRequis = miseType / (pot + miseType);

  const list: Alternative[] = [];

  if (faceMise) {
    // Face à une mise : fold / call / relance.
    list.push({
      type: "fold",
      label: "Se coucher",
      evChips: 0,
      rang: "indetermine",
      note: "Référence : tu n'investis rien de plus, tu abandonnes le pot.",
    });
    list.push({
      type: "call",
      label: preflopUnraised ? "Suivre (limp)" : "Suivre",
      evChips: evCall,
      seuil,
      rang: "indetermine",
      note:
        equity != null
          ? `Rentable si équité ≥ ${(seuil! * 100).toFixed(0)} % (ta cote).`
          : "Équité inconnue — seul le seuil (cote) est connu.",
    });
    list.push({
      type: "raise",
      label: "Relancer",
      evChips: null,
      foldRequis,
      rang: "indetermine",
      note: `Dépend de l'adversaire : rentable en bluff s'il se couche ≥ ${(foldRequis * 100).toFixed(0)} % (mise ~3×).`,
    });
  } else {
    // Rien à suivre : check / mise. (Fold montré comme dominé.)
    list.push({
      type: "check",
      label: "Checker",
      evChips: 0,
      rang: "bon",
      note: "Gratuit : tu vois la suite sans rien payer — jamais pire que se coucher.",
    });
    list.push({
      type: "raise",
      label: "Miser",
      evChips: null,
      foldRequis,
      rang: "indetermine",
      note: `Dépend de l'adversaire : rentable en bluff s'il se couche ≥ ${(foldRequis * 100).toFixed(0)} % (mise ~2/3 pot).`,
    });
    list.push({
      type: "fold",
      label: "Se coucher",
      evChips: 0,
      rang: "mauvais",
      note: "Dominé : checker est gratuit, se coucher ici n'a aucun intérêt.",
    });
  }

  // Classement vert→rouge UNIQUEMENT si l'équité est fiable (showdown).
  if (equiteFiable && evCall != null && faceMise) {
    const callBon = evCall > 0;
    for (const a of list) {
      if (a.type === "call") {
        a.rang = callBon ? "bon" : "mauvais";
        a.note = callBon
          ? `+${evCall.toFixed(0)} jetons en moyenne (équité ${(equity! * 100).toFixed(0)} % ≥ cote ${(seuil! * 100).toFixed(0)} %).`
          : `${evCall.toFixed(0)} jetons en moyenne (équité ${(equity! * 100).toFixed(0)} % < cote ${(seuil! * 100).toFixed(0)} %).`;
      } else if (a.type === "fold") {
        a.rang = callBon ? "mauvais" : "bon";
        a.note = callBon
          ? "0 jeton — tu renonces à un call pourtant rentable."
          : "0 jeton — mieux que suivre à perte ici.";
      }
      // La relance reste "indetermine" : pas d'EV sans modèle d'adversaire.
    }
  }

  return list;
}
