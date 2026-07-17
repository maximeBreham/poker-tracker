/**
 * Agrégats & KPIs à partir d'une liste de tournois (TS pur, testable sans UI).
 * Base : §Agrégats calculés du brief.
 */
import type { Tournoi } from "@/parsing/types";

export interface BankrollPoint {
  date: string; // ISO UTC du tournoi
  bankroll: number; // bankroll cumulée après ce tournoi
  profit: number;
  multiplier: number | null;
}

export interface Aggregates {
  volume: number; // nombre de tournois
  invested: number; // total misé
  returned: number; // total récupéré
  net: number; // returned - invested
  roi: number; // net / invested (0 si rien investi)
  bankrollCurrent: number; // startingBankroll + net
  avgBuyIn: number; // invested / volume
  biggestMultiplier: number | null;
  biggestWin: number; // plus gros profit sur un tournoi
  bankrollCurve: BankrollPoint[];
}

export function aggregate(
  tournois: Tournoi[],
  startingBankroll = 50,
): Aggregates {
  const volume = tournois.length;
  const invested = round2(tournois.reduce((s, t) => s + t.buyIn, 0));
  const returned = round2(tournois.reduce((s, t) => s + t.winnings, 0));
  const net = round2(returned - invested);
  const roi = invested > 0 ? net / invested : 0; // garde anti-division par zéro (freerolls)
  const avgBuyIn = volume > 0 ? round2(invested / volume) : 0;

  const multipliers = tournois
    .map((t) => t.multiplier)
    .filter((m): m is number => m !== null);
  const biggestMultiplier = multipliers.length ? Math.max(...multipliers) : null;
  const biggestWin = volume ? round2(Math.max(...tournois.map((t) => t.profit))) : 0;

  // Courbe chronologique
  const sorted = [...tournois].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
  let running = startingBankroll;
  const bankrollCurve: BankrollPoint[] = sorted.map((t) => {
    running = round2(running + t.profit);
    return {
      date: t.startedAt,
      bankroll: running,
      profit: t.profit,
      multiplier: t.multiplier,
    };
  });

  return {
    volume,
    invested,
    returned,
    net,
    roi,
    bankrollCurrent: round2(startingBankroll + net),
    avgBuyIn,
    biggestMultiplier,
    biggestWin,
    bankrollCurve,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
