/**
 * Moteur de REJEU — dérive l'état de jeu à chaque décision d'une main.
 *
 * Pur et testé, à l'image de `parsing/derive.ts` : il ne stocke rien de plus
 * que la `Main`, il RECALCULE. En repliant les actions street par street, il
 * produit, pour chaque décision volontaire, le pot, le montant à suivre et la
 * COTE (pot odds) — le socle numérique de l'écran « rejouer une main » et, plus
 * tard, du module équité.
 *
 * Rappels de comptage (cohérents avec parseHands) :
 *  - `montant` d'une action = jetons ajoutés au pot.
 *  - l'ante alimente le pot mais NE compte PAS dans « engagé sur la street »
 *    (donc pas dans le montant à suivre).
 */
import type { Action, Carte, Main, Street } from "../parsing/handTypes";

/** État d'un siège juste AVANT l'action de l'étape (pour l'affichage de la table). */
export interface EtatSiege {
  seat: number;
  /** Jetons restants dans le tapis. */
  tapis: number;
  /** true si le joueur s'est déjà couché. */
  couche: boolean;
  /** Jetons engagés par ce joueur sur la street courante (hors ante). */
  engage: number;
}

export interface EtapeRejeu {
  /** Rang de la décision dans la main (0-based). */
  index: number;
  street: Street;
  /** Cartes visibles au tableau à cet instant (cumulées). */
  board: Carte[];
  /** Siège du joueur qui agit. */
  seat: number;
  /** Pot avant l'action. */
  potAvant: number;
  /** Jetons à ajouter pour suivre la mise en cours (0 si rien à suivre). */
  aSuivre: number;
  /**
   * Cote = pot odds du call : aSuivre / (potAvant + aSuivre). C'est l'équité
   * minimale (0..1) pour que suivre soit rentable. null si rien à suivre
   * (check possible). Sur un raise, reflète le prix que le joueur AVAIT à payer
   * avant de relancer.
   */
  cote: number | null;
  /**
   * SPR = tapis effectif / pot (tapis effectif = plus petit tapis parmi les
   * joueurs encore en jeu). null si le pot est nul. Repère de profondeur.
   */
  spr: number | null;
  /** État de tous les sièges avant l'action. */
  sieges: EtatSiege[];
  /** L'action réellement jouée. */
  action: Action;
  /** Pot après l'action. */
  potApres: number;
}

const VOLONTAIRE: ReadonlySet<Action["type"]> = new Set([
  "fold",
  "check",
  "call",
  "bet",
  "raise",
]);

/** Déroule une main en la suite de ses décisions volontaires (blindes/antes exclues). */
export function rejouer(main: Main): EtapeRejeu[] {
  const etapes: EtapeRejeu[] = [];
  const board: Carte[] = [];
  let pot = 0;
  // Jetons engagés par siège SUR LA STREET COURANTE (hors ante).
  let committed = new Map<number, number>();
  // Contributions cumulées sur toute la main (pour le tapis restant) + couchés.
  const contrib = new Map<number, number>();
  const couches = new Set<number>();

  const snapshotSieges = (): EtatSiege[] =>
    main.joueurs.map((j) => ({
      seat: j.seat,
      tapis: j.tapisDebut - (contrib.get(j.seat) ?? 0),
      couche: couches.has(j.seat),
      engage: committed.get(j.seat) ?? 0,
    }));

  for (const st of main.streets) {
    if (st.street !== "preflop") committed = new Map(); // les engagements se remettent à zéro
    board.push(...st.cartes);

    for (const a of st.actions) {
      if (!VOLONTAIRE.has(a.type)) {
        // Blinde / ante : alimente le pot ; l'ante ne compte pas comme engagement.
        pot += a.montant;
        contrib.set(a.seat, (contrib.get(a.seat) ?? 0) + a.montant);
        if (a.type !== "post_ante")
          committed.set(a.seat, (committed.get(a.seat) ?? 0) + a.montant);
        continue;
      }

      const maxEngage = Math.max(0, ...committed.values());
      const monEngage = committed.get(a.seat) ?? 0;
      const aSuivre = Math.max(0, maxEngage - monEngage);
      const cote = aSuivre > 0 ? aSuivre / (pot + aSuivre) : null;
      const sieges = snapshotSieges();
      const tapisActifs = sieges.filter((s) => !s.couche).map((s) => s.tapis);
      const eff = tapisActifs.length ? Math.min(...tapisActifs) : 0;
      const spr = pot > 0 ? eff / pot : null;
      const potApres = pot + a.montant;

      etapes.push({
        index: etapes.length,
        street: st.street,
        board: [...board],
        seat: a.seat,
        potAvant: pot,
        aSuivre,
        cote,
        spr,
        sieges,
        action: a,
        potApres,
      });

      pot = potApres;
      committed.set(a.seat, monEngage + a.montant);
      contrib.set(a.seat, (contrib.get(a.seat) ?? 0) + a.montant);
      if (a.type === "fold") couches.add(a.seat);
    }
  }

  return etapes;
}
