import { describe, expect, it } from "vitest";
import { topRangeClasses, profilParBuyIn, equiteVsRange } from "./ranges";

describe("topRangeClasses", () => {
  it("le top 5% contient les mains premium, pas les déchets", () => {
    const top = topRangeClasses(0.05);
    expect(top).toContain("AA");
    expect(top).toContain("KK");
    expect(top).not.toContain("72o");
  });

  it("plus large = surensemble", () => {
    const large = new Set(topRangeClasses(0.5));
    for (const h of topRangeClasses(0.2)) expect(large.has(h)).toBe(true);
  });
});

describe("profilParBuyIn", () => {
  it("micro plus large que high", () => {
    expect(profilParBuyIn(0.5).pct).toBeGreaterThan(profilParBuyIn(10).pct);
  });
});

describe("equiteVsRange", () => {
  it("AA écrase une range large préflop (> 80%)", () => {
    const e = equiteVsRange(["As", "Ah"], [], topRangeClasses(0.5))!;
    expect(e).toBeGreaterThan(0.8);
  });

  it("une main faible est sous 50% vs une range serrée", () => {
    const e = equiteVsRange(["7c", "2d"], [], topRangeClasses(0.15))!;
    expect(e).toBeLessThan(0.5);
  });

  it("gère un board (postflop) et le blocage de cartes", () => {
    // Hero a deux paires sur un board sec → forte équité vs une range large.
    const e = equiteVsRange(["Ah", "Kd"], ["As", "Kc", "2h"], topRangeClasses(0.5))!;
    expect(e).toBeGreaterThan(0.7);
    // Carte en double → null.
    expect(equiteVsRange(["Ah", "Kd"], ["Ah", "Kc", "2h"], topRangeClasses(0.5))).toBeNull();
  });
});
