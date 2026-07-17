import type { Aggregates } from "@/core/aggregate";
import { eur, signedEur, signedPct } from "@/lib/format";
import { BankrollCurve } from "./BankrollCurve";

const overline: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.09em",
  textTransform: "uppercase",
  color: "#71717A",
  fontWeight: 600,
};
const mono = "var(--font-mono)";

export function Hero({
  agg,
  startingBankroll,
  externalAdjustment = 0,
}: {
  agg: Aggregates;
  startingBankroll: number;
  externalAdjustment?: number;
}) {
  const gain = agg.net >= 0;
  const tone = gain ? "var(--gain)" : "var(--loss)";
  return (
    <div style={{ border: "1px solid #27272A", borderRadius: 12, background: "#131316", padding: "24px 26px" }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 24 }}>
        <div>
          <div style={{ ...overline, marginBottom: 8 }}>Bankroll actuelle</div>
          <div
            style={{
              fontFamily: mono,
              fontSize: 46,
              fontWeight: 500,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: "#FAFAFA",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {eur(agg.bankrollCurrent)}
          </div>
          <div style={{ marginTop: 10, fontSize: 13, color: "#A1A1AA", fontFamily: mono }}>
            Départ {eur(startingBankroll)} ·{" "}
            <span style={{ color: tone }}>{signedEur(agg.net)} net</span>
            {externalAdjustment !== 0 && (
              <>
                {" · "}
                <span style={{ color: externalAdjustment >= 0 ? "var(--gain)" : "var(--loss)" }}>
                  {signedEur(externalAdjustment)} externe
                </span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", gap: 28, paddingTop: 4 }}>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...overline, letterSpacing: "0.08em" }}>ROI</div>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 500, color: tone, marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              {signedPct(agg.roi)}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...overline, letterSpacing: "0.08em" }}>Volume</div>
            <div style={{ fontFamily: mono, fontSize: 22, fontWeight: 500, color: "#FAFAFA", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
              {agg.volume}
            </div>
          </div>
        </div>
      </div>

      {agg.volume > 0 && (
        <BankrollCurve points={agg.bankrollCurve} startingBankroll={startingBankroll} />
      )}
    </div>
  );
}
