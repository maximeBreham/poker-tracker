import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseHandsText } from "../parsing/parseHands";
import { derivePositions } from "./positions";
import type { Main } from "../parsing/handTypes";

function mains(name: string): Main[] {
  const text = readFileSync(
    fileURLToPath(new URL(`../parsing/__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );
  return parseHandsText(text, name).mains;
}

const expresso = mains("expresso_hands_3max.txt");
const ko = mains("mtt_ko_hands_6max.txt");

describe("derivePositions", () => {
  it("Expresso 3-max : BTN / SB / BB exacts (main 1)", () => {
    // Main 1 : bouton siège 3 ; SB siège 1, BB siège 2 (postes réels).
    const pos = derivePositions(expresso[0]);
    expect(pos.get(3)).toBe("BTN");
    expect(pos.get(1)).toBe("SB");
    expect(pos.get(2)).toBe("BB");
  });

  it("heads-up : le bouton est la SB (main 7, 2 joueurs)", () => {
    const m = expresso[6];
    expect(m.joueurs).toHaveLength(2);
    const pos = derivePositions(m);
    expect(pos.get(m.buttonSeat)).toBe("SB");
    expect([...pos.values()].filter((p) => p === "BB")).toHaveLength(1);
  });

  it("6-max KO : étiquette les 6 sièges (UTG..CO + blindes + bouton)", () => {
    const pos = derivePositions(ko[0]);
    expect(pos.size).toBe(6);
    expect([...pos.values()]).toContain("UTG");
    expect([...pos.values()]).toContain("CO");
    expect([...pos.values()]).toContain("BTN");
  });
});
