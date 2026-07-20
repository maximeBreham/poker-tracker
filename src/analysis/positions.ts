/**
 * Dérivation des positions (BTN/SB/BB/…) d'une main.
 *
 * SB et BB sont lus des postes réels (`post_sb`/`post_bb`), pas supposés — donc
 * exacts, y compris en heads-up où le bouton EST la small blind. Les sièges
 * intermédiaires (tables 4-max et plus) sont étiquetés par ordre d'action
 * préflop : le premier = UTG, le dernier avant le bouton = CO, les autres = MP
 * (approximation lisible et suffisante ; l'Expresso 3-max n'en a aucun).
 */
import type { Main } from "../parsing/handTypes";

/** seat → libellé de position. */
export function derivePositions(main: Main): Map<number, string> {
  const labels = new Map<number, string>();
  const seats = main.joueurs.map((j) => j.seat);

  const preflop = main.streets.find((s) => s.street === "preflop");
  let sbSeat: number | undefined;
  let bbSeat: number | undefined;
  for (const a of preflop?.actions ?? []) {
    if (a.type === "post_sb") sbSeat = a.seat;
    if (a.type === "post_bb") bbSeat = a.seat;
  }

  const btn = main.buttonSeat;
  // Heads-up : le bouton poste la SB → il est la SB.
  labels.set(btn, btn === sbSeat ? "SB" : "BTN");
  if (sbSeat != null) labels.set(sbSeat, "SB");
  if (bbSeat != null) labels.set(bbSeat, "BB");

  // Sièges restants, dans l'ordre d'action préflop (juste après la BB, en boucle).
  const start = bbSeat != null ? seats.indexOf(bbSeat) : seats.length - 1;
  const ordered: number[] = [];
  for (let k = 1; k <= seats.length; k++) {
    const s = seats[(start + k) % seats.length];
    if (!labels.has(s)) ordered.push(s);
  }
  ordered.forEach((s, i) => {
    const label = i === 0 ? "UTG" : i === ordered.length - 1 ? "CO" : "MP";
    labels.set(s, label);
  });

  return labels;
}
