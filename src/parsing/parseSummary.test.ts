import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseSummaryText } from "./parseSummary";

/** Lit une fixture réelle anonymisée. */
function fx(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );
}
/** Parse une fixture et renvoie le 1er tournoi. */
function one(name: string) {
  const r = parseSummaryText(fx(name), name);
  expect(r.errors).toEqual([]);
  expect(r.tournois).toHaveLength(1);
  return r.tournois[0];
}

describe("parseSummary — Expresso", () => {
  it("décompose le buy-in 2 composantes (entry + rake)", () => {
    const t = one("expresso_x3_1st_win.txt");
    expect(t.format).toBe("expresso");
    expect(t.buyIn).toBe(0.5);
    expect(t.entry).toBe(0.46);
    expect(t.bounty).toBe(0);
    expect(t.rake).toBe(0.04);
    expect(t.players).toBe(3);
  });

  it("dérive le multiplicateur (x3) et les gains d'une victoire (winner-take-all)", () => {
    const t = one("expresso_x3_1st_win.txt");
    expect(t.multiplier).toBe(3);
    expect(t.prizePool).toBe(1.5);
    expect(t.finishPlace).toBe(1);
    expect(t.winnings).toBe(1.5);
    expect(t.profit).toBe(1.0);
    expect(t.isWinningsEstimated).toBe(false);
  });

  it("compte 0 gain et un profit négatif sur une défaite (x2)", () => {
    const t = one("expresso_x2_lost.txt");
    expect(t.multiplier).toBe(2);
    expect(t.finishPlace).not.toBe(1);
    expect(t.winnings).toBe(0);
    expect(t.profit).toBe(-0.5);
  });

  it("gère un gros multiplicateur x5 gagné", () => {
    const t = one("expresso_x5_1st_win.txt");
    expect(t.multiplier).toBe(5);
    expect(t.prizePool).toBe(2.5);
    expect(t.winnings).toBe(2.5);
    expect(t.profit).toBe(2.0);
    expect(t.isWinningsEstimated).toBe(false);
  });

  it("parse un ISO 8601 UTC valide", () => {
    const t = one("expresso_x5_lost.txt");
    expect(t.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
    expect(new Date(t.startedAt).toString()).not.toBe("Invalid Date");
  });
});

describe("parseSummary — Expresso Nitro", () => {
  it("reconnaît le format Nitro et son buy-in à 1€", () => {
    const t = one("expresso_nitro.txt");
    expect(t.format).toBe("expresso_nitro");
    expect(t.buyIn).toBe(1.0);
    expect(t.entry).toBe(0.93);
    expect(t.rake).toBe(0.07);
    expect(t.multiplier).toBe(4);
  });
});

describe("parseSummary — MTT (SPACE KO)", () => {
  it("décompose le buy-in 3 composantes (entry + bounty + rake)", () => {
    const t = one("mtt_spaceko_single.txt");
    expect(t.format).toBe("mtt");
    expect(t.entry).toBe(0.8);
    expect(t.bounty).toBe(1);
    expect(t.rake).toBe(0.2);
    expect(t.buyIn).toBe(2.0);
    expect(t.players).toBe(548);
  });

  it("ne dérive pas de multiplicateur et marque les gains comme estimés", () => {
    const t = one("mtt_spaceko_single.txt");
    expect(t.multiplier).toBeNull();
    expect(t.finishPlace).toBe(312);
    expect(t.winnings).toBe(0);
    expect(t.isWinningsEstimated).toBe(true);
  });
});

describe("parseSummary — re-entries (multi-blocs dans un fichier)", () => {
  it("extrait plusieurs tournois avec le même id mais des clés de dédup distinctes", () => {
    const r = parseSummaryText(
      fx("mtt_plasma_spaceko_reentry_MULTI.txt"),
      "plasma",
    );
    expect(r.tournois).toHaveLength(2);
    const [a, b] = r.tournois;
    expect(a.id).toBe(b.id); // même tournoi
    expect(a.entryIndex).toBe(0);
    expect(b.entryIndex).toBe(1);
    expect(a.dedupKey).not.toBe(b.dedupKey); // dédup ne les écrase pas
    expect(new Set([a.dedupKey, b.dedupKey]).size).toBe(2);
    expect(a.finishPlace).toBe(632);
    expect(b.finishPlace).toBe(676);
  });
});

describe("parseSummary — robustesse", () => {
  it("remonte une erreur sur un contenu non reconnu (sans throw)", () => {
    const r = parseSummaryText("n'importe quoi", "junk.txt");
    expect(r.tournois).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].raw).toBeTruthy();
  });

  it("ne divise pas par zéro sur un freeroll (buy-in 0)", () => {
    const freeroll = [
      "Winamax Poker - Tournament summary : Freeroll(999)",
      "Player : Hero",
      "Buy-In : 0€",
      "Registered players : 100",
      "Mode : tt",
      "Type : normal",
      "Prizepool : 50€",
      "Tournament started 2026/07/01 20:00:00 UTC",
      "You finished in 10th place",
    ].join("\n");
    const r = parseSummaryText(freeroll, "freeroll.txt");
    expect(r.tournois).toHaveLength(1);
    expect(r.tournois[0].buyIn).toBe(0);
    expect(r.tournois[0].multiplier).toBeNull(); // pas de division par zéro
    expect(r.tournois[0].profit).toBe(0);
  });
});
