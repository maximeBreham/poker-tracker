import { useEffect, useMemo, useState } from "react";
import { aggregate } from "@/core/aggregate";
import { dateTime } from "@/lib/format";
import { useDatabase } from "@/app/useDatabase";
import { Hero } from "@/components/dashboard/Hero";
import { SettingsPanel } from "@/components/dashboard/SettingsPanel";
import {
  ActionButton,
  EmptyState,
  FormatSplit,
  KpiRow,
  MonthlyTable,
  MultiplierDistribution,
  ReportBanner,
  TopBar,
} from "@/components/dashboard/Panels";

function shortFolder(p: string): string {
  const parts = p.split(/[\\/]/).filter(Boolean);
  return parts.length <= 2 ? p : "…/" + parts.slice(-2).join("/");
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ minHeight: "100vh", background: "var(--canvas)", padding: 16, boxSizing: "border-box" }}>
      <div
        style={{
          maxWidth: 1360,
          margin: "0 auto",
          minHeight: "calc(100vh - 32px)",
          background: "#09090B",
          color: "#FAFAFA",
          border: "1px solid #27272A",
          borderRadius: 14,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          fontFamily: "var(--font-sans)",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </div>
  );
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const forceEmpty = params.has("empty");
  const mono = params.has("mono");

  useEffect(() => {
    document.documentElement.classList.toggle("mono", mono);
  }, [mono]);

  const db = useDatabase();
  const [settingsOpen, setSettingsOpen] = useState(false);

  // La bankroll affichée = départ + net poker + ajustement externe (mouvements non-poker).
  // On injecte l'ajustement dans la base de calcul → bankroll & courbe collent au solde réel,
  // sans toucher au net/ROI poker (indépendants de la bankroll de départ).
  const effectiveStart = db.startingBankroll + db.externalAdjustment;
  const agg = useMemo(
    () => aggregate(db.tournois, effectiveStart),
    [db.tournois, effectiveStart],
  );

  if (db.mode === "loading") {
    return (
      <Frame>
        <TopBar connected={false} sourceLabel="" />
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#71717A", fontFamily: "var(--font-mono)", fontSize: 13 }}>
          Chargement…
        </div>
      </Frame>
    );
  }

  const isDemo = db.mode === "demo";
  const filled = !forceEmpty && agg.volume > 0;

  const sourceLabel = isDemo ? "Fixtures (démo)" : db.folder ? shortFolder(db.folder) : "Winamax";
  const meta = isDemo
    ? `${agg.volume} tournois (démo)`
    : db.lastScan
      ? `Scan · ${dateTime(db.lastScan)}`
      : `${agg.volume} tournois`;

  const actions = isDemo ? null : (
    <>
      <ActionButton onClick={() => setSettingsOpen(true)}>⚙ Réglages</ActionButton>
      <ActionButton onClick={db.rescan} disabled={db.busy || !db.folder}>
        {db.busy ? "…" : "⟳ Rescanner"}
      </ActionButton>
      <ActionButton onClick={db.pickFolder} disabled={db.busy}>
        Changer de dossier
      </ActionButton>
      {agg.volume > 0 && (
        <ActionButton onClick={db.resetData} tone="danger">
          Réinitialiser
        </ActionButton>
      )}
    </>
  );

  return (
    <Frame>
      <TopBar connected={filled} sourceLabel={sourceLabel} meta={meta} actions={actions} />

      {db.report && (db.report.reparsed > 0 || db.report.ignored > 0) && (
        <ReportBanner
          reparsed={db.report.reparsed}
          parsedTournois={db.report.parsedTournois}
          ignored={db.report.ignored}
          firstErrorRaw={db.report.firstError?.raw}
        />
      )}

      {filled ? (
        <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 20, boxSizing: "border-box" }}>
          <Hero agg={agg} startingBankroll={db.startingBankroll} externalAdjustment={db.externalAdjustment} />
          <KpiRow agg={agg} />
          <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16 }}>
            <MultiplierDistribution agg={agg} />
            <FormatSplit agg={agg} />
          </div>
          <MonthlyTable agg={agg} />
        </div>
      ) : (
        <EmptyState onPick={db.pickFolder} />
      )}

      {settingsOpen && (
        <SettingsPanel
          onClose={() => setSettingsOpen(false)}
          startingBankroll={db.startingBankroll}
          externalAdjustment={db.externalAdjustment}
          pokerNet={agg.net}
          onSave={(start, adj) => {
            void db.setStartingBankroll(start);
            void db.setExternalAdjustment(adj);
          }}
        />
      )}
    </Frame>
  );
}

export default App;
