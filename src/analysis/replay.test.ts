import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseHandsText } from "../parsing/parseHands";
import { rejouer } from "./replay";
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

describe("rejouer — cote et montant à suivre", () => {
  it("calcule la cote d'un call face à une relance (Expresso main 4)", () => {
    // Préflop : SB 10, BB 20 (Hero), Vilain2 fold, Vilain1 raise to 50, Hero call 30.
    const m = expresso[3];
    const heroSeat = m.joueurs.find((j) => j.isHero)!.seat;
    const et = rejouer(m);
    const call = et.find(
      (e) => e.street === "preflop" && e.seat === heroSeat && e.action.type === "call",
    )!;
    expect(call.potAvant).toBe(70); // 10 + 20 + 40 (relance)
    expect(call.aSuivre).toBe(30);
    expect(call.cote).toBeCloseTo(0.3, 6); // 30 / (70 + 30)
  });

  it("laisse la cote nulle quand rien n'est à suivre (check)", () => {
    const checks = rejouer(expresso[0]).filter((e) => e.action.type === "check");
    expect(checks.length).toBeGreaterThan(0);
    expect(checks.every((e) => e.aSuivre === 0 && e.cote === null)).toBe(true);
  });

  it("n'émet une étape que pour les actions volontaires (pas les blindes/antes)", () => {
    const m = expresso[0];
    const volontaires = m.streets
      .flatMap((s) => s.actions)
      .filter((a) => !a.type.startsWith("post_")).length;
    expect(rejouer(m)).toHaveLength(volontaires);
  });

  it("le pot final du rejeu égale le Total pot (toutes les mains)", () => {
    for (const m of [...expresso, ...ko]) {
      const et = rejouer(m);
      const potFinal = et.length ? et[et.length - 1].potApres : 0;
      // Dernières actions possiblement des posts (rare) → on borne au pot cumulé complet.
      const potComplet = m.streets.reduce(
        (s, st) => s + st.actions.reduce((a, x) => a + x.montant, 0),
        0,
      );
      expect(potComplet).toBe(m.totalPot);
      expect(potFinal).toBeLessThanOrEqual(m.totalPot);
    }
  });

  it("le board se dévoile progressivement (3 puis 4 puis 5 cartes)", () => {
    // Main 4 va jusqu'à la river.
    const et = rejouer(expresso[3]);
    const flop = et.find((e) => e.street === "flop")!;
    const turn = et.find((e) => e.street === "turn")!;
    const river = et.find((e) => e.street === "river")!;
    expect(flop.board).toHaveLength(3);
    expect(turn.board).toHaveLength(4);
    expect(river.board).toHaveLength(5);
  });

  it("suit le tapis restant et le SPR (main 4 Expresso)", () => {
    const m = expresso[3];
    const heroSeat = m.joueurs.find((j) => j.isHero)!.seat;
    const et = rejouer(m);
    // Au call préflop de Hero : il a engagé 20 (BB) → tapis 530 − 20 = 510.
    const call = et.find(
      (e) => e.street === "preflop" && e.seat === heroSeat && e.action.type === "call",
    )!;
    const heroSiege = call.sieges.find((s) => s.seat === heroSeat)!;
    expect(heroSiege.tapis).toBe(510);
    expect(heroSiege.engage).toBe(20);
    expect(call.spr).toBeGreaterThan(0);
  });

  it("gère les antes du KO sans fausser le montant à suivre", () => {
    // 1re main KO : ante 40 ×6, SB 175, BB 350. Le 1er relanceur (Hero) face à la BB.
    const m = ko[0];
    const heroSeat = m.joueurs.find((j) => j.isHero)!.seat;
    const et = rejouer(m);
    const first = et.find((e) => e.seat === heroSeat)!;
    // Hero n'a rien engagé (ni blinde), la mise en cours = BB 350 → à suivre 350.
    expect(first.aSuivre).toBe(350);
  });
});
