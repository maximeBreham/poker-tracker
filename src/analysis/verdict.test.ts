import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseHandsText } from "../parsing/parseHands";
import { rejouer } from "./replay";
import { verdictEquite } from "./verdict";
import type { Main } from "../parsing/handTypes";

function mains(name: string): Main[] {
  const text = readFileSync(
    fileURLToPath(new URL(`../parsing/__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );
  return parseHandsText(text, name).mains;
}
const expresso = mains("expresso_hands_3max.txt");

describe("verdictEquite", () => {
  it("base « montree » quand des adversaires ont montré (main 6, abattage)", () => {
    const m = expresso[5]; // showdown : deux vilains montrent leurs cartes
    const et = rejouer(m);
    const v = verdictEquite(m, et[0]);
    expect(v).not.toBeNull();
    expect(v!.base).toBe("montree");
    expect(v!.equity).toBeGreaterThanOrEqual(0);
    expect(v!.equity).toBeLessThanOrEqual(1);
    expect(v!.nbAdversaires).toBeGreaterThanOrEqual(1);
  });

  it("base « range » sans abattage (main 4 : l'adversaire se couche)", () => {
    const m = expresso[3];
    const et = rejouer(m);
    const v = verdictEquite(m, et[0]);
    expect(v).not.toBeNull();
    expect(v!.base).toBe("range");
    expect(v!.rangePct).toBeGreaterThan(0);
    expect(v!.equity).toBeGreaterThan(0);
    expect(v!.equity).toBeLessThan(1);
  });

  it("une range plus serrée baisse l'équité du Hero (main faible)", () => {
    const m = expresso[3];
    const et = rejouer(m);
    const large = verdictEquite(m, et[0], { rangePct: 0.7 })!.equity;
    const serre = verdictEquite(m, et[0], { rangePct: 0.15 })!.equity;
    expect(serre).toBeLessThanOrEqual(large + 0.02); // vs range serrée = plus dur (tolérance MC)
  });

  it("qualifie la rentabilité d'un call quand il y a une cote", () => {
    const m = expresso[5];
    const et = rejouer(m);
    const avecCote = et.map((e) => verdictEquite(m, e)).find((v) => v?.cote != null);
    if (avecCote) {
      expect(typeof avecCote.rentable).toBe("boolean");
      expect(avecCote.rentable).toBe(avecCote.equity >= (avecCote.cote as number));
    }
  });
});
