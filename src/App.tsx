import { useEffect, useMemo } from "react";
import { parseSummaryText } from "@/parsing/parseSummary";
import type { Tournoi } from "@/parsing/types";
import { aggregate } from "@/core/aggregate";
import { Hero } from "@/components/dashboard/Hero";
import {
  EmptyState,
  FormatSplit,
  KpiRow,
  MonthlyTable,
  MultiplierDistribution,
  TopBar,
} from "@/components/dashboard/Panels";

const STARTING_BANKROLL = 50;

// Aperçu de dev : charge les fixtures anonymisées à la compilation (Vite ?raw).
// Sera remplacé par la vraie source de données (dossier Winamax) plus tard.
const rawFixtures = import.meta.glob("./parsing/__fixtures__/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function useParsedTournois(): Tournoi[] {
  return useMemo(() => {
    const all: Tournoi[] = [];
    for (const [path, content] of Object.entries(rawFixtures)) {
      const name = path.split("/").pop() ?? path;
      all.push(...parseSummaryText(content, name).tournois);
    }
    return all;
  }, []);
}

function App() {
  const params = new URLSearchParams(window.location.search);
  const forceEmpty = params.has("empty");
  const mono = params.has("mono");

  useEffect(() => {
    document.documentElement.classList.toggle("mono", mono);
  }, [mono]);

  const tournois = useParsedTournois();
  const agg = useMemo(() => aggregate(tournois, STARTING_BANKROLL), [tournois]);
  const filled = !forceEmpty && agg.volume > 0;

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
        <TopBar
          connected={filled}
          sourceLabel="Fixtures (démo)"
          meta={`${agg.volume} tournois parsés`}
        />

        {filled ? (
          <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 20, boxSizing: "border-box" }}>
            <Hero agg={agg} startingBankroll={STARTING_BANKROLL} />
            <KpiRow agg={agg} />
            <div style={{ display: "grid", gridTemplateColumns: "1.15fr 1fr", gap: 16 }}>
              <MultiplierDistribution agg={agg} />
              <FormatSplit agg={agg} />
            </div>
            <MonthlyTable agg={agg} />
          </div>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}

export default App;
