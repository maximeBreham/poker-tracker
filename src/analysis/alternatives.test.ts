import { describe, expect, it } from "vitest";
import { alternatives } from "./alternatives";
import type { EtapeRejeu } from "./replay";

/** Étape minimale pour les tests (seuls pot/àSuivre comptent ici). */
function etape(potAvant: number, aSuivre: number): EtapeRejeu {
  return {
    index: 0,
    street: "flop",
    board: [],
    seat: 1,
    potAvant,
    aSuivre,
    cote: aSuivre > 0 ? aSuivre / (potAvant + aSuivre) : null,
    spr: null,
    sieges: [],
    action: { seat: 1, type: aSuivre > 0 ? "call" : "check", montant: aSuivre, allIn: false },
    potApres: potAvant + aSuivre,
  };
}

describe("alternatives — face à une mise", () => {
  it("liste fold / call / relance", () => {
    const alts = alternatives(etape(70, 30), null, false);
    expect(alts.map((a) => a.type)).toEqual(["fold", "call", "raise"]);
  });

  it("EV du call = équité×(pot+àSuivre) − àSuivre", () => {
    const alts = alternatives(etape(70, 30), 0.5, true);
    const call = alts.find((a) => a.type === "call")!;
    expect(call.evChips).toBeCloseTo(0.5 * 100 - 30, 6); // = 20
  });

  it("au showdown : équité > cote → call vert, fold rouge", () => {
    const alts = alternatives(etape(70, 30), 0.5, true); // cote 30 %, équité 50 %
    expect(alts.find((a) => a.type === "call")!.rang).toBe("bon");
    expect(alts.find((a) => a.type === "fold")!.rang).toBe("mauvais");
  });

  it("au showdown : équité < cote → fold vert, call rouge", () => {
    const alts = alternatives(etape(70, 30), 0.2, true); // cote 30 %, équité 20 %
    expect(alts.find((a) => a.type === "call")!.rang).toBe("mauvais");
    expect(alts.find((a) => a.type === "fold")!.rang).toBe("bon");
  });

  it("la relance reste indéterminée (pas d'EV sans modèle d'adversaire)", () => {
    const alts = alternatives(etape(70, 30), 0.5, true);
    const raise = alts.find((a) => a.type === "raise")!;
    expect(raise.rang).toBe("indetermine");
    expect(raise.foldRequis).toBeGreaterThan(0);
  });

  it("sans équité fiable : tout reste indéterminé (aucun faux verdict)", () => {
    const alts = alternatives(etape(70, 30), 0.5, false); // équité connue mais non fiable
    expect(alts.every((a) => a.rang === "indetermine")).toBe(true);
  });

  it("préflop non relancé : le call est étiqueté « limp »", () => {
    const alts = alternatives(etape(30, 20), null, false, true);
    expect(alts.find((a) => a.type === "call")!.label).toMatch(/limp/i);
  });
});

describe("alternatives — rien à suivre", () => {
  it("liste check / mise / fold, avec le check « bon » et le fold « mauvais » (dominé)", () => {
    const alts = alternatives(etape(100, 0), 0.5, true);
    expect(alts.map((a) => a.type)).toEqual(["check", "raise", "fold"]);
    expect(alts.find((a) => a.type === "check")!.rang).toBe("bon");
    expect(alts.find((a) => a.type === "fold")!.rang).toBe("mauvais");
  });
});
