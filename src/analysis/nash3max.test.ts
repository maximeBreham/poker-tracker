import { describe, expect, it } from "vitest";
import { nash3max } from "./nash3max";

describe("nash3max — 3-handed push/fold (≈)", () => {
  it("AA : open-jam BTN à toutes les profondeurs", () => {
    for (const bb of [3, 8, 14, 20]) {
      expect(nash3max(["As", "Ah"], bb, "btnJam")!.recommandation).toBe("push");
    }
  });

  it("72o : pas d'open-jam BTN à 20 BB", () => {
    expect(nash3max(["7c", "2d"], 20, "btnJam")!.recommandation).toBe("fold");
  });

  it("le range d'open-jam BTN se resserre avec la profondeur", () => {
    const court: [string, string] = ["Jh", "8d"]; // J8o marginale
    const c = nash3max(court, 6, "btnJam")!;
    const p = nash3max(court, 20, "btnJam")!;
    expect(Number(c.inRange)).toBeGreaterThanOrEqual(Number(p.inRange));
  });

  it("BB paie plus serré qu'il n'y a d'open-jam BTN (mêmes cartes/profondeur)", () => {
    // Une main moyenne devrait plus souvent être un open-jam qu'un call.
    let jamOnly = 0, both = 0;
    for (const h of [["Kh", "9d"], ["Qc", "9s"], ["Jd", "9c"], ["Tc", "8h"]] as [string, string][]) {
      const jam = nash3max(h, 12, "btnJam")!.inRange;
      const call = nash3max(h, 12, "bbCallVsBtn")!.inRange;
      if (jam && !call) jamOnly++;
      if (jam && call) both++;
    }
    expect(jamOnly).toBeGreaterThanOrEqual(both === 0 ? 0 : 1);
    expect(jamOnly + both).toBeGreaterThan(0);
  });

  it("hors périmètre au-delà de 20 BB", () => {
    expect(nash3max(["As", "Ah"], 40, "btnJam")!.applicable).toBe(false);
  });
});
