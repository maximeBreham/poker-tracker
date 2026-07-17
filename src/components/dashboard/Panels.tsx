import type { Aggregates } from "@/core/aggregate";
import { eur, signedEur, signedPct } from "@/lib/format";

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
const tone = (n: number) => (n >= 0 ? "var(--gain)" : "var(--loss)");

/* ---------------- Top bar ---------------- */
export function TopBar({
  connected,
  sourceLabel,
  meta,
}: {
  connected: boolean;
  sourceLabel: string;
  meta?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 56,
        padding: "0 24px",
        borderBottom: "1px solid #27272A",
        flex: "none",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ width: 8, height: 8, borderRadius: 999, background: "var(--accent-indigo)" }} />
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: "-0.01em", color: "#FAFAFA" }}>Bankroll</span>
        <span style={{ fontSize: 11, color: "#52525B", fontWeight: 500 }}>/ suivi personnel</span>
      </div>
      {connected ? (
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ width: 6, height: 6, borderRadius: 999, background: "var(--gain)" }} />
            <span style={{ fontFamily: MONO, fontSize: 12, color: "#A1A1AA" }}>{sourceLabel}</span>
          </div>
          {meta && <span style={{ fontFamily: MONO, fontSize: 12, color: "#71717A" }}>{meta}</span>}
        </div>
      ) : (
        <span style={{ fontFamily: MONO, fontSize: 12, color: "#52525B" }}>Aucune source connectée</span>
      )}
    </div>
  );
}

/* ---------------- KPI row ---------------- */
function Kpi({ label, value, color = "#FAFAFA" }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ ...CARD, padding: "18px 20px" }}>
      <div style={overline}>{label}</div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 26,
          fontWeight: 500,
          color,
          marginTop: 10,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
    </div>
  );
}

export function KpiRow({ agg }: { agg: Aggregates }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16 }}>
      <Kpi label="Net" value={signedEur(agg.net)} color={tone(agg.net)} />
      <Kpi label="Buy-in moyen" value={eur(agg.avgBuyIn)} />
      <Kpi label="Plus gros multiplicateur" value={agg.biggestMultiplier ? `×${agg.biggestMultiplier}` : "—"} />
      <Kpi label="Plus gros gain" value={signedEur(agg.biggestWin)} color={tone(agg.biggestWin)} />
    </div>
  );
}

/* ---------------- Distribution des multiplicateurs ---------------- */
export function MultiplierDistribution({ agg }: { agg: Aggregates }) {
  const total = agg.distribution.reduce((s, b) => s + b.count, 0);
  const maxCount = Math.max(1, ...agg.distribution.map((b) => b.count));
  const topMult = agg.biggestMultiplier;
  return (
    <div style={{ ...CARD, padding: "22px 24px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>Distribution des multiplicateurs</div>
      <div style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>Expressos · {total} parties</div>
      <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 13 }}>
        {agg.distribution.length === 0 && (
          <div style={{ fontSize: 13, color: "#52525B" }}>Aucun Expresso.</div>
        )}
        {agg.distribution.map((b) => {
          const isTop = b.multiplier === topMult;
          return (
            <div key={b.multiplier} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 38, fontFamily: MONO, fontSize: 13, color: "#A1A1AA", textAlign: "right" }}>×{b.multiplier}</span>
              <div style={{ flex: 1, height: 8, background: "#1A1A1E", borderRadius: 999, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${(b.count / maxCount) * 100}%`,
                    height: "100%",
                    background: isTop ? "var(--point)" : "var(--accent-indigo)",
                    opacity: isTop ? 1 : 0.85,
                    borderRadius: 999,
                  }}
                />
              </div>
              <span style={{ width: 44, fontFamily: MONO, fontSize: 13, color: "#FAFAFA", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------------- Répartition par format ---------------- */
export function FormatSplit({ agg }: { agg: Aggregates }) {
  const total = agg.formatSplit.reduce((s, f) => s + f.parties, 0);
  return (
    <div style={{ ...CARD, padding: "22px 24px" }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>Répartition par format</div>
      <div style={{ fontSize: 12, color: "#71717A", marginTop: 3 }}>{total} parties au total</div>
      <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 22 }}>
        {agg.formatSplit.map((f, i) => (
          <div key={f.key}>
            {i > 0 && <div style={{ height: 1, background: "#27272A", margin: "0 0 22px" }} />}
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={{ fontSize: 14, fontWeight: 500, color: "#FAFAFA" }}>{f.label}</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: "#A1A1AA", fontVariantNumeric: "tabular-nums" }}>{f.parties} parties</span>
            </div>
            <div style={{ marginTop: 10, height: 8, background: "#1A1A1E", borderRadius: 999, overflow: "hidden" }}>
              <div style={{ width: `${total ? (f.parties / total) * 100 : 0}%`, height: "100%", background: "var(--accent-indigo)", opacity: 0.85, borderRadius: 999 }} />
            </div>
            <div style={{ marginTop: 10, display: "flex", gap: 24, fontFamily: MONO, fontSize: 13 }}>
              <span style={{ color: "#71717A" }}>Net <span style={{ color: tone(f.net) }}>{signedEur(f.net)}</span></span>
              <span style={{ color: "#71717A" }}>ROI <span style={{ color: tone(f.roi) }}>{signedPct(f.roi)}</span></span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------------- Bilan mensuel ---------------- */
export function MonthlyTable({ agg }: { agg: Aggregates }) {
  const head: React.CSSProperties = { ...overline, letterSpacing: "0.07em" };
  return (
    <div style={{ ...CARD, overflow: "hidden" }}>
      <div style={{ padding: "18px 24px 12px", fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>Bilan mensuel</div>
      <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr 1fr 1fr", padding: "0 24px 10px", borderBottom: "1px solid #27272A" }}>
        <span style={head}>Mois</span>
        <span style={{ ...head, textAlign: "right" }}>Parties</span>
        <span style={{ ...head, textAlign: "right" }}>Net</span>
        <span style={{ ...head, textAlign: "right" }}>ROI</span>
      </div>
      {agg.monthly.map((m, i) => (
        <div
          key={m.key}
          style={{
            display: "grid",
            gridTemplateColumns: "1.4fr 1fr 1fr 1fr",
            padding: "16px 24px",
            borderBottom: i < agg.monthly.length - 1 ? "1px solid #1F1F23" : "none",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 14, color: "#FAFAFA" }}>{m.label}</span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: "#A1A1AA", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{m.parties}</span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: tone(m.net), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{signedEur(m.net)}</span>
          <span style={{ fontFamily: MONO, fontSize: 14, color: tone(m.roi), textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{signedPct(m.roi)}</span>
        </div>
      ))}
    </div>
  );
}

/* ---------------- État vide ---------------- */
export function EmptyState({ onPick }: { onPick?: () => void }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40, boxSizing: "border-box" }}>
      <div
        style={{
          width: "100%",
          maxWidth: 520,
          border: "1px dashed #3F3F46",
          borderRadius: 16,
          background: "#0E0E11",
          padding: "48px 40px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ width: 56, height: 56, border: "1px solid #27272A", borderRadius: 14, background: "#131316", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h6a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H6.5L5 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
            <circle cx="16.5" cy="14.5" r="3.5" />
            <path d="m21 19-2-2" />
          </svg>
        </div>
        <div style={{ marginTop: 22, fontSize: 20, fontWeight: 600, letterSpacing: "-0.01em", color: "#FAFAFA" }}>Aucune donnée importée</div>
        <p style={{ margin: "12px 0 0", fontSize: 14, lineHeight: 1.55, color: "#A1A1AA", maxWidth: "38ch" }}>
          Pointez le dossier d'historique Winamax pour analyser vos parties. L'analyse reste locale, sur votre machine.
        </p>
        <button
          onClick={onPick}
          style={{
            marginTop: 26,
            display: "inline-flex",
            alignItems: "center",
            gap: 9,
            background: "var(--accent-indigo)",
            color: "#09090B",
            font: "inherit",
            fontSize: 14,
            fontWeight: 600,
            border: "none",
            borderRadius: 10,
            padding: "11px 20px",
            cursor: "pointer",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z" />
          </svg>
          Sélectionner le dossier…
        </button>
        <div style={{ marginTop: 16, fontFamily: MONO, fontSize: 12, color: "#52525B" }}>~/.config/winamax/…/history/</div>
      </div>
    </div>
  );
}
