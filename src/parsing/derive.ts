/**
 * Dérivations à partir des champs bruts d'un résumé Winamax.
 * Le résumé ne contient ni le multiplicateur ni les gains → on les reconstruit ici.
 */
import type { Format } from "./types";

/** Convertit une chaîne monétaire FR ("0.46€", "1", "539.20") en nombre. */
export function parseAmount(raw: string): number {
  const n = parseFloat(raw.replace(",", ".").replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : 0;
}

/** Extrait tous les montants € d'une ligne Buy-In, dans l'ordre. Ex. "0.80€ + 1€ + 0.20€" → [0.8, 1, 0.2]. */
export function parseBuyInAmounts(line: string): number[] {
  const matches = line.match(/[\d]+(?:[.,]\d+)?\s*€/g) ?? [];
  return matches.map(parseAmount);
}

/** Décompose le Buy-In en entry / bounty / rake selon le nombre de composantes. */
export function splitBuyIn(amounts: number[]): {
  buyIn: number;
  entry: number;
  bounty: number;
  rake: number;
} {
  const buyIn = round2(amounts.reduce((a, b) => a + b, 0));
  if (amounts.length >= 3) {
    // KO : entry + bounty + rake
    return { buyIn, entry: amounts[0], bounty: amounts[1], rake: amounts[2] };
  }
  if (amounts.length === 2) {
    // Standard : entry + rake
    return { buyIn, entry: amounts[0], bounty: 0, rake: amounts[1] };
  }
  if (amounts.length === 1) {
    return { buyIn, entry: amounts[0], bounty: 0, rake: 0 };
  }
  return { buyIn: 0, entry: 0, bounty: 0, rake: 0 };
}

/** Déduit le format à partir du nom du tournoi et des champs Mode/Type. */
export function deriveFormat(name: string, mode?: string, type?: string): Format {
  const n = name.toLowerCase();
  if (n.startsWith("expresso nitro")) return "expresso_nitro";
  if (n.startsWith("expresso")) return "expresso";
  if (type === "knockout" || mode === "tt") return "mtt";
  return "other";
}

/**
 * Multiplicateur Expresso = prizePool / buyIn (toujours dérivé, jamais écrit dans le résumé).
 * Retourne null hors Expresso ou si buyIn nul (garde anti-division par zéro).
 */
export function deriveMultiplier(
  format: Format,
  prizePool: number | null,
  buyIn: number,
): number | null {
  if (format !== "expresso" && format !== "expresso_nitro") return null;
  if (!prizePool || buyIn <= 0) return null;
  return Math.round(prizePool / buyIn);
}

/**
 * Gains dérivés.
 *  - Expresso : winner-take-all pour les multiplicateurs de la plage courante (≤ 5).
 *    Au-delà, la structure peut payer 2e/3e → marqué estimé (à affiner si de gros hits apparaissent).
 *  - MTT/KO : la partie ITM et les primes KO ne sont PAS dans le résumé → non calculable ici
 *    (winnings = 0, marqué estimé). Limite documentée.
 */
export function deriveWinnings(
  format: Format,
  finishPlace: number | null,
  prizePool: number | null,
  multiplier: number | null,
): { winnings: number; isEstimated: boolean } {
  if (format === "expresso" || format === "expresso_nitro") {
    const winnerTakeAll = multiplier !== null && multiplier <= 5;
    const winnings = finishPlace === 1 && prizePool ? prizePool : 0;
    // Fiable si winner-take-all connu ; sinon on estime (gros multiplicateurs à structure inconnue).
    return { winnings, isEstimated: !winnerTakeAll };
  }
  // MTT / KO / autre : gains non dérivables du seul résumé.
  return { winnings: 0, isEstimated: true };
}

/** "2026/07/01 19:35:24" (UTC) → "2026-07-01T19:35:24Z". */
export function toIsoUtc(datePart: string, timePart: string): string {
  const [y, mo, d] = datePart.split("/");
  return `${y}-${mo}-${d}T${timePart}Z`;
}

/** Clé de déduplication : id + index d'entrée (re-entries partagent le même id). */
export function makeDedupKey(id: string, entryIndex: number): string {
  return `${id}#${entryIndex}`;
}

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
