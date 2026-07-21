import { describe, expect, it } from "vitest";
import { nashPushFold } from "./nashPushFold";

describe("nashPushFold — heads-up", () => {
  it("AA : shove à toutes les profondeurs couvertes (SB)", () => {
    for (const bb of [3, 8, 12, 20]) {
      expect(nashPushFold(["As", "Ah"], bb, "sb")!.recommandation).toBe("push");
    }
  });

  it("72o : fold en SB dès qu'on n'est plus ultra-court (20 BB)", () => {
    expect(nashPushFold(["7c", "2d"], 20, "sb")!.recommandation).toBe("fold");
  });

  it("la range de shove se resserre quand le tapis augmente", () => {
    const court = nashPushFold(["K", "9"].map((r) => r + "s") as [string, string], 5, "sb")!;
    const profond = nashPushFold(["K", "9"].map((r) => r + "s") as [string, string], 20, "sb")!;
    // Une main marginale doit être au moins aussi souvent shove court que profond.
    expect(Number(court.inRange)).toBeGreaterThanOrEqual(Number(profond.inRange));
  });

  it("BB paie plus serré que le SB ne shove (à profondeur égale)", () => {
    // Une main moyenne : plus susceptible d'être un shove SB que d'un call BB.
    const main: [string, string] = ["Q", "9"].map((r) => r + "o") as unknown as [string, string];
    // Construit Q9o proprement.
    const q9o: [string, string] = ["Qh", "9d"];
    const push = nashPushFold(q9o, 10, "sb")!;
    const call = nashPushFold(q9o, 10, "bb")!;
    expect(push.recommandation === "push" || call.recommandation === "fold").toBe(true);
    void main;
  });

  it("hors périmètre au-delà de 20 BB", () => {
    const r = nashPushFold(["As", "Ah"], 40, "sb")!;
    expect(r.applicable).toBe(false);
  });

  it("arrondit la profondeur à la grille (0,5 BB)", () => {
    const r = nashPushFold(["As", "Ah"], 9.7, "sb")!;
    expect(r.applicable).toBe(true);
    expect(r.depth).toBe(9.5);
  });
});
