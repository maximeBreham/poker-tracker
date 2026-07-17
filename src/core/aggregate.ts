/**
 * Agrégats & KPIs à partir d'une liste de tournois (TS pur, testable sans UI).
 * Base : §Agrégats calculés du brief.
 */
import type { Format, Tournoi } from "@/parsing/types";
import { parisMonthKey, parisMonthLabel } from "@/lib/format";

export interface BankrollPoint {
  date: string; // ISO UTC du tournoi
  bankroll: number; // bankroll cumulée après ce tournoi
  profit: number;
  multiplier: number | null;
}

export interface MultiplierBucket {
  multiplier: number;
  buyIn: number; // niveau de buy-in (Expresso 0,50 € vs Nitro 1 € peuvent partager un multiplicateur)
  count: number;
  wins: number; // parties gagnées (profit > 0)
  losses: number;
  net: number; // résultat net cumulé pour ce multiplicateur
}

export interface FormatStat {
  key: "expresso" | "mtt" | "other";
  label: string;
  parties: number;
  invested: number;
  net: number;
  roi: number;
}

export interface MonthStat {
  key: string; // "2026-07"
  label: string; // "Juillet 2026"
  parties: number;
  net: number;
  roi: number;
}

export interface Aggregates {
  volume: number;
  invested: number;
  returned: number;
  net: number;
  roi: number;
  bankrollCurrent: number;
  avgBuyIn: number;
  biggestMultiplier: number | null;
  biggestWin: number;
  bankrollCurve: BankrollPoint[];
  distribution: MultiplierBucket[];
  formatSplit: FormatStat[];
  monthly: MonthStat[];
}

const FORMAT_GROUP: Record<Format, FormatStat["key"]> = {
  expresso: "expresso",
  expresso_nitro: "expresso",
  mtt: "mtt",
  other: "other",
};
const FORMAT_GROUP_LABEL: Record<FormatStat["key"], string> = {
  expresso: "Expresso",
  mtt: "MTT",
  other: "Autre",
};

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
    return { date: t.startedAt, bankroll: running, profit: t.profit, multiplier: t.multiplier };
  });

  // Distribution des multiplicateurs (Expressos uniquement), par buy-in + multiplicateur
  const distMap = new Map<string, { buyIn: number; multiplier: number; count: number; wins: number; net: number }>();
  for (const t of tournois) {
    if (t.multiplier === null) continue;
    const key = `${t.buyIn}#${t.multiplier}`;
    const e = distMap.get(key) ?? { buyIn: t.buyIn, multiplier: t.multiplier, count: 0, wins: 0, net: 0 };
    e.count += 1;
    if (t.profit > 0) e.wins += 1;
    e.net = round2(e.net + t.profit);
    distMap.set(key, e);
  }
  const distribution: MultiplierBucket[] = [...distMap.values()]
    .map((e) => ({
      multiplier: e.multiplier,
      buyIn: e.buyIn,
      count: e.count,
      wins: e.wins,
      losses: e.count - e.wins,
      net: e.net,
    }))
    .sort((a, b) => a.buyIn - b.buyIn || a.multiplier - b.multiplier);

  // Répartition par format
  const fmtMap = new Map<FormatStat["key"], { parties: number; invested: number; net: number }>();
  for (const t of tournois) {
    const key = FORMAT_GROUP[t.format];
    const cur = fmtMap.get(key) ?? { parties: 0, invested: 0, net: 0 };
    cur.parties += 1;
    cur.invested = round2(cur.invested + t.buyIn);
    cur.net = round2(cur.net + t.profit);
    fmtMap.set(key, cur);
  }
  const formatSplit: FormatStat[] = [...fmtMap.entries()]
    .map(([key, v]) => ({
      key,
      label: FORMAT_GROUP_LABEL[key],
      parties: v.parties,
      invested: v.invested,
      net: v.net,
      roi: v.invested > 0 ? v.net / v.invested : 0,
    }))
    .sort((a, b) => b.parties - a.parties);

  // Bilan mensuel (Europe/Paris)
  const monMap = new Map<string, { label: string; parties: number; invested: number; net: number }>();
  for (const t of tournois) {
    if (!t.startedAt) continue;
    const key = parisMonthKey(t.startedAt);
    const cur = monMap.get(key) ?? {
      label: parisMonthLabel(t.startedAt),
      parties: 0,
      invested: 0,
      net: 0,
    };
    cur.parties += 1;
    cur.invested = round2(cur.invested + t.buyIn);
    cur.net = round2(cur.net + t.profit);
    monMap.set(key, cur);
  }
  const monthly: MonthStat[] = [...monMap.entries()]
    .map(([key, v]) => ({
      key,
      label: v.label,
      parties: v.parties,
      net: v.net,
      roi: v.invested > 0 ? v.net / v.invested : 0,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));

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
    distribution,
    formatSplit,
    monthly,
  };
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
