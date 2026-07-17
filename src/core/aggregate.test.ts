import { describe, expect, it } from "vitest";
import { aggregate } from "./aggregate";
import type { Tournoi } from "@/parsing/types";

function mk(partial: Partial<Tournoi>): Tournoi {
  return {
    id: "1",
    dedupKey: "1#0",
    entryIndex: 0,
    startedAt: "2026-07-01T19:00:00Z",
    format: "expresso",
    name: "Expresso",
    players: 3,
    buyIn: 0.5,
    entry: 0.46,
    bounty: 0,
    rake: 0.04,
    prizePool: 1.5,
    finishPlace: 2,
    winnings: 0,
    isWinningsEstimated: false,
    profit: -0.5,
    multiplier: 3,
    isMultiplierEstimated: false,
    sourceFile: "x",
    ...partial,
  };
}

describe("aggregate", () => {
  it("calcule net, ROI et bankroll correctement", () => {
    const t = [
      mk({ buyIn: 0.5, winnings: 1.5, profit: 1.0, startedAt: "2026-07-01T19:00:00Z" }),
      mk({ buyIn: 0.5, winnings: 0, profit: -0.5, startedAt: "2026-07-02T19:00:00Z" }),
    ];
    const a = aggregate(t, 50);
    expect(a.volume).toBe(2);
    expect(a.invested).toBe(1);
    expect(a.returned).toBe(1.5);
    expect(a.net).toBe(0.5);
    expect(a.roi).toBeCloseTo(0.5, 5); // 0.5 / 1
    expect(a.bankrollCurrent).toBe(50.5);
    expect(a.bankrollCurve).toHaveLength(2);
    expect(a.bankrollCurve[1].bankroll).toBe(50.5);
  });

  it("ne divise pas par zéro quand rien n'est investi (freerolls)", () => {
    const a = aggregate([mk({ buyIn: 0, winnings: 0, profit: 0 })], 50);
    expect(a.roi).toBe(0);
    expect(a.avgBuyIn).toBe(0);
    expect(a.bankrollCurrent).toBe(50);
  });

  it("gère une base vide", () => {
    const a = aggregate([], 50);
    expect(a.volume).toBe(0);
    expect(a.roi).toBe(0);
    expect(a.biggestMultiplier).toBeNull();
    expect(a.bankrollCurrent).toBe(50);
  });
});
