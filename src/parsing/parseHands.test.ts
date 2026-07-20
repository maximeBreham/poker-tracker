import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseHandsText } from "./parseHands";
import type { Main } from "./handTypes";

/** Lit une fixture réelle anonymisée. */
function fx(name: string): string {
  return readFileSync(
    fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url)),
    "utf8",
  );
}
function parse(name: string) {
  return parseHandsText(fx(name), name);
}
/** Pot reconstruit = somme de tous les montants ajoutés au pot (toutes streets). */
function potReconstruit(m: Main): number {
  return m.streets.reduce(
    (s, st) => s + st.actions.reduce((a, act) => a + act.montant, 0),
    0,
  );
}

describe("parseHands — Expresso 3-max", () => {
  const r = parse("expresso_hands_3max.txt");

  it("extrait les 9 mains sans erreur", () => {
    expect(r.errors).toEqual([]);
    expect(r.mains).toHaveLength(9);
    expect(r.mains.map((m) => m.numero)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it("lit l'en-tête et la table de la 1re main", () => {
    const m = r.mains[0];
    expect(m.id).toBe("#4946434554001883137-1-1784407378");
    expect(m.tournoiId).toBe("1151681541");
    expect(m.level).toBe(1);
    expect(m.blinds).toEqual({ sb: 10, bb: 20, ante: 0 });
    expect(m.maxSeats).toBe(3);
    expect(m.buttonSeat).toBe(3);
    expect(m.joueurs).toHaveLength(3);
    expect(m.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
  });

  it("identifie le Hero et ses cartes", () => {
    const m = r.mains[0];
    const hero = m.joueurs.find((j) => j.isHero)!;
    expect(hero.nom).toBe("Hero");
    expect(hero.seat).toBe(2);
    expect(hero.cartes).toEqual(["5s", "4h"]);
    // Un seul Hero par main.
    expect(m.joueurs.filter((j) => j.isHero)).toHaveLength(1);
  });

  it("normalise « raises X to Y » en jetons ajoutés (main 4)", () => {
    // Vilain1 (SB, déjà 10 engagés) raises 30 to 50 → 40 ajoutés au pot.
    const preflop = r.mains[3].streets.find((s) => s.street === "preflop")!;
    const raise = preflop.actions.find((a) => a.type === "raise")!;
    expect(raise.montant).toBe(40);
    // La 1re action preflop est bien une blinde (post_sb/post_bb).
    expect(preflop.actions[0].type).toMatch(/^post_/);
  });

  it("capture les cartes adverses montrées au showdown (main 6)", () => {
    const m = r.mains[5];
    const v1 = m.joueurs.find((j) => j.nom === "Vilain1")!;
    const v2 = m.joueurs.find((j) => j.nom === "Vilain2")!;
    expect(v1.cartes).toEqual(["Ah", "Jd"]);
    expect(v2.cartes).toEqual(["5d", "9d"]);
  });

  it("gère le passage en heads-up (2 joueurs, main 7)", () => {
    expect(r.mains[6].joueurs).toHaveLength(2);
  });

  it("somme les gains main pot + side pot (main 8)", () => {
    const m = r.mains[7];
    const total = m.gains.reduce((s, g) => s + g.montant, 0);
    expect(m.gains.length).toBeGreaterThanOrEqual(2);
    expect(total).toBe(m.totalPot); // 120 (main) + 20 (side) = 140
  });

  it("reconstruit exactement le pot de chaque main", () => {
    for (const m of r.mains) {
      expect(potReconstruit(m)).toBe(m.totalPot);
    }
  });
});

describe("parseHands — SPACE KO 6-max", () => {
  const r = parse("mtt_ko_hands_6max.txt");

  it("extrait les 33 mains sans erreur", () => {
    expect(r.errors).toEqual([]);
    expect(r.mains).toHaveLength(33);
  });

  it("lit les blindes à 3 valeurs (ante/sb/bb) et la table 6-max", () => {
    const m = r.mains[0];
    expect(m.blinds).toEqual({ ante: 40, sb: 175, bb: 350 });
    expect(m.maxSeats).toBe(6);
    expect(m.joueurs).toHaveLength(6);
  });

  it("lit la prime (bounty) par siège", () => {
    const hero = r.mains[0].joueurs.find((j) => j.isHero)!;
    expect(hero.nom).toBe("Hero");
    expect(hero.bounty).toBe(1);
    // Un adversaire à 1.20€.
    expect(r.mains[0].joueurs.some((j) => j.bounty === 1.2)).toBe(true);
  });

  it("parse les antes comme actions (6 antes en 1re main, non comptées dans le raise)", () => {
    const preflop = r.mains[0].streets.find((s) => s.street === "preflop")!;
    const antes = preflop.actions.filter((a) => a.type === "post_ante");
    expect(antes).toHaveLength(6);
    expect(antes.every((a) => a.montant === 40)).toBe(true);
  });

  it("résout un pseudo contenant une espace comme acteur", () => {
    // « Vilain3 » (ex-« G Ouine40 ») agit préflop dès la 1re main.
    const preflop = r.mains[0].streets.find((s) => s.street === "preflop")!;
    const seatV3 = r.mains[0].joueurs.find((j) => j.nom === "Vilain3")!.seat;
    expect(preflop.actions.some((a) => a.seat === seatV3 && a.type === "raise")).toBe(true);
  });

  it("reconstruit exactement le pot de chaque main", () => {
    for (const m of r.mains) {
      expect(potReconstruit(m)).toBe(m.totalPot);
    }
  });
});

describe("parseHands — robustesse", () => {
  it("remonte une erreur sur un contenu non reconnu (sans throw)", () => {
    const r = parseHandsText("n'importe quoi", "junk.txt");
    expect(r.mains).toHaveLength(0);
    expect(r.errors).toHaveLength(1);
    expect(r.errors[0].raw).toBeTruthy();
  });
});
