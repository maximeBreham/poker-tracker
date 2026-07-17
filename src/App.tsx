import { useMemo } from "react";
import { parseSummaryText } from "@/parsing/parseSummary";
import type { Tournoi } from "@/parsing/types";
import { aggregate } from "@/core/aggregate";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

// Aperçu de dev : charge les fixtures anonymisées à la compilation (Vite ?raw).
// Sera remplacé par la vraie source de données (dossier Winamax) plus tard.
const rawFixtures = import.meta.glob("./parsing/__fixtures__/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

const eur = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});
const dt = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const FORMAT_LABEL: Record<Tournoi["format"], string> = {
  expresso: "Expresso",
  expresso_nitro: "Nitro",
  mtt: "MTT",
  other: "Autre",
};

function useParsedTournois(): Tournoi[] {
  return useMemo(() => {
    const all: Tournoi[] = [];
    for (const [path, content] of Object.entries(rawFixtures)) {
      const name = path.split("/").pop() ?? path;
      all.push(...parseSummaryText(content, name).tournois);
    }
    return all.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  }, []);
}

function Kpi({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "gain" | "loss";
}) {
  const color =
    tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-foreground";
  return (
    <Card className="bg-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-tertiary">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`font-mono text-[26px] font-medium tnum ${color}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}

function App() {
  const tournois = useParsedTournois();
  const agg = useMemo(() => aggregate(tournois, 50), [tournois]);

  return (
    <main className="min-h-screen bg-canvas px-7 py-8 text-foreground">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6">
          <h1 className="text-lg font-semibold">Poker Tracker — aperçu de dev</h1>
          <p className="text-sm text-text-secondary">
            {tournois.length} tournois parsés depuis les fixtures anonymisées ·
            bankroll de départ 50&nbsp;€
          </p>
        </header>

        <section className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
          <Kpi
            label="Net"
            value={eur.format(agg.net)}
            tone={agg.net >= 0 ? "gain" : "loss"}
          />
          <Kpi label="ROI" value={`${(agg.roi * 100).toFixed(1)} %`} tone={agg.roi >= 0 ? "gain" : "loss"} />
          <Kpi label="Volume" value={String(agg.volume)} />
          <Kpi label="Bankroll" value={eur.format(agg.bankrollCurrent)} />
          <Kpi label="Buy-in moyen" value={eur.format(agg.avgBuyIn)} />
          <Kpi
            label="Plus gros mult."
            value={agg.biggestMultiplier ? `×${agg.biggestMultiplier}` : "—"}
          />
          <Kpi label="Plus gros gain" value={eur.format(agg.biggestWin)} tone="gain" />
          <Kpi label="Investi" value={eur.format(agg.invested)} />
        </section>

        <Card className="bg-card">
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Tournois</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Format</TableHead>
                  <TableHead className="text-right">Buy-in</TableHead>
                  <TableHead className="text-right">Place</TableHead>
                  <TableHead className="text-right">Mult.</TableHead>
                  <TableHead className="text-right">Profit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournois.map((t) => (
                  <TableRow key={t.dedupKey}>
                    <TableCell className="font-mono text-xs text-text-secondary tnum">
                      {t.startedAt ? dt.format(new Date(t.startedAt)) : "—"}
                    </TableCell>
                    <TableCell>{FORMAT_LABEL[t.format]}</TableCell>
                    <TableCell className="text-right font-mono tnum">
                      {eur.format(t.buyIn)}
                    </TableCell>
                    <TableCell className="text-right font-mono tnum">
                      {t.finishPlace ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono tnum">
                      {t.multiplier ? `×${t.multiplier}` : "—"}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono tnum ${
                        t.profit >= 0 ? "text-gain" : "text-loss"
                      }`}
                    >
                      {t.profit >= 0 ? "+" : ""}
                      {eur.format(t.profit)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default App;
