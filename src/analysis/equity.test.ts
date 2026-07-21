import { describe, expect, it } from "vitest";
import { equite, equiteVsHasard, score7, scoreCat, parseCard } from "./equity";

const ev = (strs: string[]) => score7(strs.map((s) => parseCard(s) as number));

describe("score7 — hiérarchie des mains", () => {
  it("quinte flush > carré > full > couleur > quinte > brelan > double paire > paire > hauteur", () => {
    const sf = ev(["Th", "Jh", "Qh", "Kh", "Ah", "2c", "3d"]); // quinte flush
    const quads = ev(["As", "Ac", "Ad", "Ah", "Kc", "2d", "3h"]); // carré
    const full = ev(["As", "Ac", "Ad", "Kh", "Kc", "2d", "7h"]); // full
    const flush = ev(["2h", "5h", "8h", "Jh", "Kh", "3c", "4d"]); // couleur
    const straight = ev(["5c", "6d", "7h", "8s", "9c", "2d", "Kh"]); // quinte
    const trips = ev(["As", "Ac", "Ad", "Kh", "Qc", "2d", "7h"]); // brelan
    const twoPair = ev(["As", "Ac", "Kd", "Kh", "Qc", "2d", "7h"]); // double paire
    const pair = ev(["As", "Ac", "Qd", "Kh", "Jc", "2d", "7h"]); // paire
    const high = ev(["As", "Qc", "9d", "Kh", "Jc", "2d", "7h"]); // hauteur

    const ordre = [sf, quads, full, flush, straight, trips, twoPair, pair, high];
    const cats = [8, 7, 6, 5, 4, 3, 2, 1, 0];
    ordre.forEach((s, i) => expect(scoreCat(s)).toBe(cats[i]));
    for (let i = 0; i < ordre.length - 1; i++) {
      // score entier strictement décroissant
      expect(ordre[i]).toBeGreaterThan(ordre[i + 1]);
    }
  });

  it("départage la roue A-2-3-4-5 comme quinte à 5 (la plus basse)", () => {
    const roue = ev(["Ah", "2c", "3d", "4s", "5h", "Kd", "Qc"]);
    const straight6 = ev(["2h", "3c", "4d", "5s", "6h", "Kd", "Qc"]); // quinte à 6
    expect(scoreCat(roue)).toBe(4); // quinte
    expect(roue).toBeLessThan(straight6); // la roue est la quinte la plus faible
  });

  it("carré vs couleur : le carré gagne", () => {
    expect(scoreCat(ev(["7h", "7d", "7s", "7c", "2h", "3d", "9h"]))).toBe(7);
    expect(ev(["7h", "7d", "7s", "7c", "2h", "3d", "9h"])).toBeGreaterThan(
      ev(["Ah", "Kh", "9h", "5h", "2h", "3d", "7c"]),
    );
  });
});

describe("equite — cas exacts (board complet ou postflop)", () => {
  it("main gagnante à la river → 100 %", () => {
    // Hero brelan d'As vs paire de Rois, board terminé.
    const e = equite(["As", "Ac"], [["Kd", "Kh"]], ["Ah", "7d", "2s", "9c", "Qs"]);
    expect(e!.exact).toBe(true);
    expect(e!.equity).toBe(1);
  });

  it("board joué par tout le monde → partage 50 %", () => {
    // Quinte royale à cœur au board : les deux jouent le board.
    const e = equite(["2c", "3c"], [["2d", "3d"]], ["Ah", "Kh", "Qh", "Jh", "Th"]);
    expect(e!.equity).toBeCloseTo(0.5, 6);
  });

  it("brelan au flop très largement devant (énumération exacte)", () => {
    const e = equite(["As", "Ac"], [["Kd", "Kh"]], ["Ah", "7d", "2s"]);
    expect(e!.exact).toBe(true);
    expect(e!.equity).toBeGreaterThan(0.98);
  });

  it("rejette une carte en double", () => {
    expect(equite(["As", "Ac"], [["As", "Kh"]], [])).toBeNull();
  });
});

describe("equiteVsHasard — adversaire inconnu", () => {
  it("AA préflop vs une main au hasard ≈ 85 %", () => {
    const e = equiteVsHasard(["As", "Ah"], [], 1);
    expect(e!.exact).toBe(false);
    expect(e!.equity).toBeGreaterThan(0.8);
    expect(e!.equity).toBeLessThan(0.9);
  });

  it("l'équité baisse face à plusieurs adversaires", () => {
    const solo = equiteVsHasard(["As", "Ah"], [], 1)!.equity;
    const troisAdv = equiteVsHasard(["As", "Ah"], [], 3)!.equity;
    expect(troisAdv).toBeLessThan(solo);
  });
});

describe("equite — préflop (Monte-Carlo, tolérance)", () => {
  it("AA vs KK ≈ 82 %", () => {
    const e = equite(["As", "Ah"], [["Kd", "Kc"]], []);
    expect(e!.exact).toBe(false);
    expect(e!.equity).toBeGreaterThan(0.78);
    expect(e!.equity).toBeLessThan(0.86);
  });
});
