/**
 * Écran « rejouer une main » — disposition « fiche décision » (hybride).
 * Bandeau des sièges + tableau, puis une carte centrée sur la décision courante
 * (pot / à suivre / cote / SPR), et un journal des actions. On avance décision
 * par décision. Consomme le moteur pur `analysis/replay`.
 */
import { useMemo, useState } from "react";
import type { Main, Carte as CarteT } from "@/parsing/handTypes";
import { rejouer, type EtapeRejeu } from "@/analysis/replay";
import { derivePositions } from "@/analysis/positions";

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
  color: "#71717A",
  fontWeight: 600,
};

/* ---------------- Carte à jouer ---------------- */
const SUITS: Record<string, { sym: string; red: boolean }> = {
  h: { sym: "♥", red: true },
  d: { sym: "♦", red: true },
  c: { sym: "♣", red: false },
  s: { sym: "♠", red: false },
};

function Carte({ c, small }: { c: CarteT | null; small?: boolean }) {
  const w = small ? 30 : 40;
  const h = small ? 42 : 56;
  if (!c) {
    // Dos de carte (inconnue).
    return (
      <div
        style={{
          width: w,
          height: h,
          borderRadius: 6,
          border: "1px solid #27272A",
          background:
            "repeating-linear-gradient(45deg,#18181B,#18181B 4px,#1F1F23 4px,#1F1F23 8px)",
        }}
      />
    );
  }
  const rank = c[0] === "T" ? "10" : c[0];
  const suit = SUITS[c[1]] ?? { sym: "?", red: false };
  return (
    <div
      style={{
        width: w,
        height: h,
        borderRadius: 6,
        background: "#FAFAFA",
        color: suit.red ? "#DC2626" : "#18181B",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: MONO,
        fontWeight: 700,
        lineHeight: 1,
        boxShadow: "0 1px 2px rgba(0,0,0,0.4)",
      }}
    >
      <span style={{ fontSize: small ? 13 : 16 }}>{rank}</span>
      <span style={{ fontSize: small ? 12 : 15 }}>{suit.sym}</span>
    </div>
  );
}

/* ---------------- Bandeau d'un siège ---------------- */
function SeatCard({
  nom,
  position,
  tapis,
  cartes,
  isHero,
  couche,
  actif,
  engage,
}: {
  nom: string;
  position: string;
  tapis: number;
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
        gap: 8,
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
              color: "#A1A1AA",
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
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#71717A" }}>mise {engage}</span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", gap: 4 }}>
          <Carte c={cartes ? cartes[0] : null} small />
          <Carte c={cartes ? cartes[1] : null} small />
        </span>
        <span style={{ fontFamily: MONO, fontSize: 14, color: "#FAFAFA", fontVariantNumeric: "tabular-nums" }}>
          {tapis.toLocaleString("fr-FR")}
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

function libelleAction(e: EtapeRejeu): string {
  const { type, montant } = e.action;
  const engageAvant = e.sieges.find((s) => s.seat === e.seat)?.engage ?? 0;
  switch (type) {
    case "fold":
      return "se couche";
    case "check":
      return "check";
    case "call":
      return `call ${montant}`;
    case "bet":
      return `mise ${montant}`;
    case "raise":
      return `relance → ${engageAvant + montant}`;
    default:
      return type;
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

/* ---------------- Écran ---------------- */
export function HandReplay({ mains }: { mains: Main[] }) {
  const [handIdx, setHandIdx] = useState(0);
  const [step, setStep] = useState(0);

  const main = mains[handIdx];
  const etapes = useMemo(() => (main ? rejouer(main) : []), [main]);
  const positions = useMemo(() => (main ? derivePositions(main) : new Map()), [main]);

  if (!main || etapes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#52525B", fontFamily: MONO, fontSize: 13 }}>
        Aucune main à rejouer.
      </div>
    );
  }

  const s = Math.min(step, etapes.length - 1);
  const e = etapes[s];
  const acteur = main.joueurs.find((j) => j.seat === e.seat);
  const anteTxt = main.blinds.ante > 0 ? ` (ante ${main.blinds.ante})` : "";

  const goHand = (d: number) => {
    const n = (handIdx + d + mains.length) % mains.length;
    setHandIdx(n);
    setStep(0);
  };
  const goStep = (d: number) => setStep((v) => Math.max(0, Math.min(etapes.length - 1, v + d)));

  const navBtn: React.CSSProperties = {
    font: "inherit",
    fontSize: 13,
    color: "#A1A1AA",
    background: "transparent",
    border: "1px solid #27272A",
    borderRadius: 8,
    padding: "5px 11px",
    cursor: "pointer",
  };

  return (
    <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box" }}>
      {/* Sélecteur de main */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button style={navBtn} onClick={() => goHand(-1)}>◀</button>
          <span style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA" }}>
            Main #{main.numero}
          </span>
          <span style={{ fontFamily: MONO, fontSize: 12, color: "#71717A" }}>
            niveau {main.level} · {main.blinds.sb}/{main.blinds.bb}{anteTxt} · {main.maxSeats}-max
          </span>
          <button style={navBtn} onClick={() => goHand(1)}>▶</button>
        </div>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#52525B" }}>
          {handIdx + 1}/{mains.length} · démo
        </span>
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
        </div>
      </div>

      {/* Fiche décision */}
      <div style={{ ...CARD, padding: "22px 24px" }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>
            {STREET_LABEL[e.street]} — à <span style={{ color: acteur?.isHero ? "var(--accent-indigo)" : "#FAFAFA" }}>{acteur?.nom}</span> de jouer
          </span>
          <span style={{ fontFamily: MONO, fontSize: 13, color: "#71717A" }}>
            a joué : <span style={{ color: "#A1A1AA" }}>{libelleAction(e)}</span>
          </span>
        </div>

        <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
          <Stat label="À suivre" value={e.aSuivre > 0 ? e.aSuivre.toLocaleString("fr-FR") : "—"} />
          <Stat
            label="Cote (pot odds)"
            value={e.cote != null ? pct(e.cote) : "—"}
            hint={e.cote != null ? `≥ ${pct(e.cote)} d'équité pour suivre` : "rien à payer"}
            accent
          />
          <Stat label="SPR" value={e.spr != null ? e.spr.toFixed(1) : "—"} />
        </div>
      </div>

      {/* Contrôles + journal */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <button style={navBtn} onClick={() => goStep(-1)} disabled={s === 0}>◀ précédent</button>
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#71717A" }}>
          étape {s + 1}/{etapes.length}
        </span>
        <button style={navBtn} onClick={() => goStep(1)} disabled={s === etapes.length - 1}>suivant ▶</button>
      </div>

      <div style={{ ...CARD, padding: "14px 18px", display: "flex", flexWrap: "wrap", gap: "6px 10px" }}>
        {etapes.map((et, i) => {
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
                color: cur ? "#FAFAFA" : "#71717A",
                borderRadius: 7,
                padding: "3px 8px",
                cursor: "pointer",
              }}
              title={`${STREET_LABEL[et.street]}`}
            >
              {j?.isHero ? "★ " : ""}{j?.nom.slice(0, 8)} {libelleAction(et)}
            </button>
          );
        })}
      </div>
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
      {hint && <div style={{ fontSize: 11, color: "#52525B", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
