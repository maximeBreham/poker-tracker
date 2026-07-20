/**
 * Écran « rejouer une main » — disposition « fiche décision » (hybride).
 * Colonne principale : bandeau des sièges + tableau + carte de décision
 * (pot / à suivre / cote / SPR) + journal. Colonne de droite : liste cliquable
 * des mains. On avance décision par décision. Consomme le moteur pur
 * `analysis/replay`. Les montants sont doublés en BB (repère de profondeur).
 */
import { useMemo, useState } from "react";
import type { Main, Carte as CarteT } from "@/parsing/handTypes";
import { rejouer, type EtapeRejeu } from "@/analysis/replay";
import { derivePositions } from "@/analysis/positions";
import { eur } from "@/lib/format";

const CARD: React.CSSProperties = {
  border: "1px solid #27272A",
  borderRadius: 12,
  background: "#131316",
};
const MONO = "var(--font-mono)";
const overline: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#C7C7CE",
  fontWeight: 600,
};

/* ---------------- Conversion en big blinds ---------------- */
/** "10 BB" / "1,5 BB" (arrondi au dixième, virgule FR). "" si bb inconnu. */
function toBB(chips: number, bb: number): string {
  if (!bb) return "";
  const v = Math.round((chips / bb) * 10) / 10;
  return `${v.toString().replace(".", ",")} BB`;
}
/** "+35 BB" / "−12 BB" (signe explicite). */
function signedBB(chips: number, bb: number): string {
  if (!bb) return "";
  const v = Math.round((chips / bb) * 10) / 10;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toString().replace(".", ",")} BB`;
}

/* ---------------- Carte à jouer ---------------- */
const SUITS: Record<string, { sym: string; red: boolean }> = {
  h: { sym: "♥", red: true },
  d: { sym: "♦", red: true },
  c: { sym: "♣", red: false },
  s: { sym: "♠", red: false },
};

function Carte({ c, size = "board" }: { c: CarteT | null; size?: "board" | "seat" }) {
  const d =
    size === "board"
      ? { w: 52, h: 72, suit: 26, corner: 12, radius: 8 }
      : { w: 40, h: 56, suit: 20, corner: 10, radius: 7 };

  if (!c) {
    // Dos de carte (inconnue).
    return (
      <div
        style={{
          width: d.w,
          height: d.h,
          borderRadius: d.radius,
          border: "1px solid #2C2C31",
          background:
            "repeating-linear-gradient(45deg,#1A1A1E,#1A1A1E 5px,#212127 5px,#212127 10px)",
        }}
      />
    );
  }
  const rank = c[0] === "T" ? "10" : c[0];
  const suit = SUITS[c[1]] ?? { sym: "?", red: false };
  const color = suit.red ? "#DC2626" : "#18181B";
  const corner: React.CSSProperties = {
    position: "absolute",
    fontSize: d.corner,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  };
  return (
    <div
      style={{
        position: "relative",
        width: d.w,
        height: d.h,
        borderRadius: d.radius,
        background: "#FAFAFA",
        color,
        fontFamily: MONO,
        boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ ...corner, top: 4, left: 5 }}>{rank}{suit.sym}</span>
      <span style={{ fontSize: d.suit, lineHeight: 1 }}>{suit.sym}</span>
      <span style={{ ...corner, bottom: 4, right: 5 }}>{rank}{suit.sym}</span>
    </div>
  );
}

/* ---------------- Bandeau d'un siège ---------------- */
function SeatCard({
  nom,
  position,
  tapis,
  bb,
  cartes,
  isHero,
  couche,
  actif,
  engage,
}: {
  nom: string;
  position: string;
  tapis: number;
  bb: number;
  cartes: [CarteT, CarteT] | null;
  isHero: boolean;
  couche: boolean;
  actif: boolean;
  engage: number;
}) {
  return (
    <div
      style={{
        ...CARD,
        flex: 1,
        minWidth: 0,
        padding: "12px 14px",
        opacity: couche ? 0.4 : 1,
        borderColor: actif ? "var(--accent-indigo)" : isHero ? "#3F3F46" : "#27272A",
        boxShadow: actif ? "0 0 0 1px var(--accent-indigo)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              ...overline,
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 5,
              background: "#1F1F23",
              color: "#C7C7CE",
            }}
          >
            {position}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isHero ? "var(--accent-indigo)" : "#FAFAFA",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nom}
          </span>
        </span>
        {engage > 0 && !couche && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE", whiteSpace: "nowrap" }}>
            mise {engage} ({toBB(engage, bb)})
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", gap: 5 }}>
          <Carte c={cartes ? cartes[0] : null} size="seat" />
          <Carte c={cartes ? cartes[1] : null} size="seat" />
        </span>
        <span style={{ textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ fontFamily: MONO, fontSize: 15, color: "#FAFAFA", fontVariantNumeric: "tabular-nums" }}>
            {tapis.toLocaleString("fr-FR")}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE" }}>{toBB(tapis, bb)}</div>
        </span>
      </div>
    </div>
  );
}

/* ---------------- Formatage d'action ---------------- */
const STREET_LABEL: Record<string, string> = {
  preflop: "PRÉFLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
};

function libelleAction(e: EtapeRejeu, bb: number): string {
  const { type, montant } = e.action;
  const engageAvant = e.sieges.find((s) => s.seat === e.seat)?.engage ?? 0;
  switch (type) {
    case "fold":
      return "se couche";
    case "check":
      return "check";
    case "call":
      return `call ${montant} (${toBB(montant, bb)})`;
    case "bet":
      return `mise ${montant} (${toBB(montant, bb)})`;
    case "raise": {
      const total = engageAvant + montant;
      return `relance → ${total} (${toBB(total, bb)})`;
    }
    default:
      return type;
  }
}
/** Version courte pour le journal : montants en BB (prioritaires sur les jetons). */
function libelleCourt(e: EtapeRejeu, bb: number): string {
  const { type, montant } = e.action;
  const engageAvant = e.sieges.find((s) => s.seat === e.seat)?.engage ?? 0;
  switch (type) {
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "call":
      return `call ${toBB(montant, bb)}`;
    case "bet":
      return `mise ${toBB(montant, bb)}`;
    case "raise":
      return `raise ${toBB(engageAvant + montant, bb)}`;
    default:
      return type;
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

/** Bilan du Hero sur une main (jetons) : gains − contributions. */
function heroNet(main: Main): number {
  const hero = main.joueurs.find((j) => j.isHero);
  if (!hero) return 0;
  const contrib = main.streets
    .flatMap((s) => s.actions)
    .filter((a) => a.seat === hero.seat)
    .reduce((s, a) => s + a.montant, 0);
  const gain = main.gains.find((g) => g.seat === hero.seat)?.montant ?? 0;
  return gain - contrib;
}

/* ---------------- Écran ---------------- */
export function HandReplay({ mains }: { mains: Main[] }) {
  const [handIdx, setHandIdx] = useState(0);
  const [step, setStep] = useState(0);

  const main = mains[handIdx];
  const etapes = useMemo(() => (main ? rejouer(main) : []), [main]);
  const positions = useMemo(
    () => (main ? derivePositions(main) : new Map<number, string>()),
    [main],
  );

  if (!main || etapes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#C7C7CE", fontFamily: MONO, fontSize: 13 }}>
        Aucune main à rejouer.
      </div>
    );
  }

  const bb = main.blinds.bb;
  const s = Math.min(step, etapes.length - 1);
  const e = etapes[s];
  const acteur = main.joueurs.find((j) => j.seat === e.seat);
  const anteTxt = main.blinds.ante > 0 ? ` (ante ${main.blinds.ante})` : "";
  const heroJoueur = main.joueurs.find((j) => j.isHero);
  const heroTapis = e.sieges.find((si) => si.seat === heroJoueur?.seat)?.tapis ?? 0;
  const netMain = heroNet(main);
  const netColor = netMain > 0 ? "var(--gain)" : netMain < 0 ? "var(--loss)" : "#FAFAFA";
  const netChips = `${netMain > 0 ? "+" : netMain < 0 ? "−" : ""}${Math.abs(netMain).toLocaleString("fr-FR")}`;

  const selectHand = (i: number) => {
    setHandIdx(i);
    setStep(0);
  };
  const goHand = (d: number) => selectHand((handIdx + d + mains.length) % mains.length);
  const goStep = (d: number) => setStep((v) => Math.max(0, Math.min(etapes.length - 1, v + d)));

  const navBtn: React.CSSProperties = {
    font: "inherit",
    fontSize: 13,
    color: "#C7C7CE",
    background: "transparent",
    border: "1px solid #27272A",
    borderRadius: 8,
    padding: "5px 11px",
    cursor: "pointer",
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* Colonne principale */}
      <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box", overflowY: "auto" }}>
        {/* Bandeau de contexte : tournoi + tapis du Hero */}
        <div style={{ ...CARD, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={navBtn} onClick={() => goHand(-1)}>◀</button>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#FAFAFA" }}>{main.tournoiNom}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "#C7C7CE" }}>{eur(main.buyIn)}</span>
                <span style={{ fontSize: 13, color: "#C7C7CE" }}>· Main #{main.numero}</span>
                <span style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE" }}>démo</span>
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE", marginTop: 3 }}>
                niveau {main.level} · blindes {main.blinds.sb}/{main.blinds.bb}{anteTxt} · {main.maxSeats}-max
              </div>
            </div>
            <button style={navBtn} onClick={() => goHand(1)}>▶</button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 26 }}>
            <div style={{ textAlign: "right" }}>
              <div style={overline}>Ton tapis</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: "#FAFAFA", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {heroTapis.toLocaleString("fr-FR")}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>{toBB(heroTapis, bb)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={overline}>Bilan main</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: netColor, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {signedBB(netMain, bb)}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>{netChips}</div>
            </div>
          </div>
        </div>

        {/* Bandeau des sièges */}
        <div style={{ display: "flex", gap: 12 }}>
          {e.sieges.map((si) => {
            const j = main.joueurs.find((p) => p.seat === si.seat)!;
            return (
              <SeatCard
                key={si.seat}
                nom={j.nom}
                position={positions.get(si.seat) ?? ""}
                tapis={si.tapis}
                bb={bb}
                cartes={j.cartes}
                isHero={j.isHero}
                couche={si.couche}
                actif={si.seat === e.seat}
                engage={si.engage}
              />
            );
          })}
        </div>

        {/* Tableau + pot */}
        <div style={{ ...CARD, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ ...overline, marginRight: 6 }}>Board</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Carte key={i} c={e.board[i] ?? null} />
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={overline}>Pot</div>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color: "#FAFAFA", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {e.potAvant.toLocaleString("fr-FR")}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE", marginTop: 2 }}>{toBB(e.potAvant, bb)}</div>
          </div>
        </div>

        {/* Fiche décision */}
        <div style={{ ...CARD, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>
              {STREET_LABEL[e.street]} — à <span style={{ color: acteur?.isHero ? "var(--accent-indigo)" : "#FAFAFA" }}>{acteur?.nom}</span> de jouer
            </span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#C7C7CE" }}>
              a joué : <span style={{ color: "#C7C7CE" }}>{libelleAction(e, bb)}</span>
            </span>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            <Stat
              label="À suivre"
              value={e.aSuivre > 0 ? e.aSuivre.toLocaleString("fr-FR") : "—"}
              hint={e.aSuivre > 0 ? toBB(e.aSuivre, bb) : undefined}
            />
            <Stat
              label="Cote (pot odds)"
              value={e.cote != null ? pct(e.cote) : "—"}
              hint={e.cote != null ? `≥ ${pct(e.cote)} d'équité pour suivre` : "rien à payer"}
              accent
            />
            <Stat
              label="SPR"
              value={e.street !== "preflop" && e.spr != null ? e.spr.toFixed(1) : "—"}
              hint={e.street === "preflop" ? "dès le flop" : undefined}
            />
          </div>
        </div>

        {/* Contrôles */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button style={navBtn} onClick={() => goStep(-1)} disabled={s === 0}>◀ précédent</button>
          <span style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>étape {s + 1}/{etapes.length}</span>
          <button style={navBtn} onClick={() => goStep(1)} disabled={s === etapes.length - 1}>suivant ▶</button>
        </div>

        {/* Journal — déroulé regroupé par street */}
        <div style={{ ...CARD, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {(["preflop", "flop", "turn", "river"] as const).map((st) => {
            const items = etapes.map((et, i) => ({ et, i })).filter((x) => x.et.street === st);
            if (!items.length) return null;
            return (
              <div key={st} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ ...overline, width: 62, flex: "none" }}>{STREET_LABEL[st]}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px" }}>
                  {items.map(({ et, i }) => {
                    const j = main.joueurs.find((p) => p.seat === et.seat);
                    const cur = i === s;
                    return (
                      <button
                        key={i}
                        onClick={() => setStep(i)}
                        style={{
                          font: "inherit",
                          fontFamily: MONO,
                          fontSize: 12,
                          border: "1px solid",
                          borderColor: cur ? "var(--accent-indigo)" : "#27272A",
                          background: cur ? "rgba(99,102,241,0.12)" : "transparent",
                          color: cur ? "#FAFAFA" : "#C7C7CE",
                          borderRadius: 7,
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                      >
                        {j?.isHero ? "★ " : ""}{j?.nom.slice(0, 8)} {libelleCourt(et, bb)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Colonne de droite : liste des mains */}
      <aside style={{ width: 236, flex: "none", borderLeft: "1px solid #27272A", overflowY: "auto", background: "#0C0C0E" }}>
        <div style={{ ...overline, padding: "18px 18px 10px" }}>Mains · {mains.length}</div>
        {mains.map((m, i) => {
          const net = heroNet(m);
          const cur = i === handIdx;
          const dot = net > 0 ? "var(--gain)" : net < 0 ? "var(--loss)" : "#C7C7CE";
          return (
            <button
              key={m.id}
              onClick={() => selectHand(i)}
              style={{
                width: "100%",
                textAlign: "left",
                font: "inherit",
                background: cur ? "rgba(99,102,241,0.12)" : "transparent",
                borderLeft: `2px solid ${cur ? "var(--accent-indigo)" : "transparent"}`,
                borderTop: "none",
                borderRight: "none",
                borderBottom: "1px solid #18181B",
                padding: "11px 16px",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
              }}
            >
              <span style={{ minWidth: 0 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flex: "none" }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: cur ? "#FAFAFA" : "#D4D4D8" }}>
                    Main #{m.numero}
                  </span>
                </span>
                <span style={{ display: "block", fontFamily: MONO, fontSize: 11, color: "#C7C7CE", marginTop: 3, marginLeft: 13 }}>
                  {m.blinds.sb}/{m.blinds.bb} · {m.maxSeats}-max
                </span>
              </span>
              <span style={{ fontFamily: MONO, fontSize: 12, color: dot, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                {signedBB(net, m.blinds.bb)}
              </span>
            </button>
          );
        })}
      </aside>
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div>
      <div style={overline}>{label}</div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 28,
          fontWeight: 500,
          color: accent ? "var(--accent-indigo)" : "#FAFAFA",
          marginTop: 8,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: "#C7C7CE", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
