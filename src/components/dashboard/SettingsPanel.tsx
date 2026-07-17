import { useState } from "react";
import { eur, signedEur } from "@/lib/format";

const MONO = "var(--font-mono)";

function parseNum(s: string, fallback: number): number {
  const n = parseFloat(s.replace(",", "."));
  return Number.isFinite(n) ? n : fallback;
}
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

const label: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#71717A",
  fontWeight: 600,
};
const input: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  marginTop: 8,
  background: "#1A1A1E",
  border: "1px solid #27272A",
  borderRadius: 10,
  color: "#FAFAFA",
  fontFamily: MONO,
  fontSize: 18,
  padding: "10px 12px",
  fontVariantNumeric: "tabular-nums",
};

export function SettingsPanel({
  onClose,
  startingBankroll,
  externalAdjustment,
  pokerNet,
  onSave,
}: {
  onClose: () => void;
  startingBankroll: number;
  externalAdjustment: number;
  pokerNet: number;
  /** (nouvelle bankroll de départ, nouvel ajustement externe) */
  onSave: (startingBankroll: number, externalAdjustment: number) => void;
}) {
  const currentReal = round2(startingBankroll + pokerNet + externalAdjustment);
  const [startStr, setStartStr] = useState(String(startingBankroll));
  const [realStr, setRealStr] = useState(String(currentReal));

  const start = parseNum(startStr, startingBankroll);
  const real = parseNum(realStr, currentReal);
  const adjustment = round2(real - start - pokerNet);

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5,5,6,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 50,
        padding: 20,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 440,
          background: "#131316",
          border: "1px solid #27272A",
          borderRadius: 14,
          padding: 24,
          boxSizing: "border-box",
        }}
      >
        <div style={{ fontSize: 15, fontWeight: 600, color: "#FAFAFA" }}>Réglages</div>

        {/* Bankroll de départ */}
        <div style={{ marginTop: 20 }}>
          <label style={label}>Bankroll de départ (€)</label>
          <input
            style={input}
            value={startStr}
            onChange={(e) => setStartStr(e.target.value)}
            inputMode="decimal"
          />
          <div style={{ marginTop: 6, fontSize: 12, color: "#71717A" }}>
            Ton solde au tout début du suivi.
          </div>
        </div>

        {/* Solde réel actuel */}
        <div style={{ marginTop: 18 }}>
          <label style={label}>Solde réel actuel sur Winamax (€)</label>
          <input
            style={input}
            value={realStr}
            onChange={(e) => setRealStr(e.target.value)}
            inputMode="decimal"
          />
          <div style={{ marginTop: 6, fontSize: 12, color: "#71717A" }}>
            Ce qu'affiche Winamax maintenant (poker + paris sportifs). L'app recale la bankroll dessus.
          </div>
        </div>

        {/* Aperçu du calcul */}
        <div
          style={{
            marginTop: 18,
            padding: "12px 14px",
            background: "#0E0E11",
            border: "1px solid #27272A",
            borderRadius: 10,
            fontFamily: MONO,
            fontSize: 12.5,
            color: "#A1A1AA",
            lineHeight: 1.7,
          }}
        >
          <div>
            Net poker : <span style={{ color: pokerNet >= 0 ? "var(--gain)" : "var(--loss)" }}>{signedEur(pokerNet)}</span>{" "}
            <span style={{ color: "#52525B" }}>(inchangé)</span>
          </div>
          <div>
            Ajustement externe :{" "}
            <span style={{ color: adjustment >= 0 ? "var(--gain)" : "var(--loss)" }}>{signedEur(adjustment)}</span>{" "}
            <span style={{ color: "#52525B" }}>(paris sportifs, dépôts/retraits)</span>
          </div>
          <div style={{ color: "#FAFAFA", marginTop: 4 }}>
            → Bankroll affichée : {eur(round2(start + pokerNet + adjustment))}
          </div>
        </div>

        {/* Actions */}
        <div style={{ marginTop: 22, display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            onClick={onClose}
            style={{
              font: "inherit",
              fontSize: 13,
              color: "#A1A1AA",
              background: "transparent",
              border: "1px solid #27272A",
              borderRadius: 10,
              padding: "9px 16px",
              cursor: "pointer",
            }}
          >
            Annuler
          </button>
          <button
            onClick={() => {
              onSave(round2(start), adjustment);
              onClose();
            }}
            style={{
              font: "inherit",
              fontSize: 13,
              fontWeight: 600,
              color: "#09090B",
              background: "var(--accent-indigo)",
              border: "none",
              borderRadius: 10,
              padding: "9px 18px",
              cursor: "pointer",
            }}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </div>
  );
}
