/**
 * Scan incrémental d'un dossier history :
 *  - ne (re)parse que les fichiers nouveaux ou modifiés (comparaison nom + mtime)
 *  - déduplique par `dedupKey` (les re-entries d'un même id ne sont pas écrasées)
 * Critères du brief : rescanner ne double-compte pas ; dossier inchangé = 0 reparsing ;
 * N nouveaux fichiers = seulement N reparsés.
 */
import { parseSummaryText } from "@/parsing/parseSummary";
import { parseHandsText } from "@/parsing/parseHands";
import type { AppData } from "@/storage/types";
import type { DataSource } from "./types";

export interface ImportReport {
  totalFiles: number;
  reparsed: number; // fichiers (re)parsés cette passe (résumés + hand-histories)
  skipped: number; // fichiers inchangés ignorés
  parsedTournois: number; // tournois ajoutés/mis à jour
  parsedMains: number; // mains ajoutées/mises à jour
  ignored: number; // blocs non reconnus
  firstError: { sourceFile: string; reason: string; raw?: string } | null;
}

export async function scanFolder(
  source: DataSource,
  folder: string,
  prev: AppData,
): Promise<{ data: AppData; report: ImportReport }> {
  const summaryFiles = await source.listSummaryFiles(folder);
  const handFiles = await source.listHandFiles(folder);
  const tournois = { ...prev.tournois };
  const mains = { ...prev.mains };
  const scannedFiles = { ...prev.settings.scannedFiles };
  const report: ImportReport = {
    totalFiles: summaryFiles.length + handFiles.length,
    reparsed: 0,
    skipped: 0,
    parsedTournois: 0,
    parsedMains: 0,
    ignored: 0,
    firstError: null,
  };

  // Résumés → Tournoi (résultats, buy-in, gains).
  for (const f of summaryFiles) {
    if (scannedFiles[f.name] === f.mtime) {
      report.skipped++;
      continue;
    }
    const res = parseSummaryText(await source.readFile(f.path), f.name);
    for (const t of res.tournois) {
      tournois[t.dedupKey] = t; // upsert → dédup naturelle
      report.parsedTournois++;
    }
    if (res.errors.length) {
      report.ignored += res.errors.length;
      if (!report.firstError) report.firstError = res.errors[0];
    }
    scannedFiles[f.name] = f.mtime;
    report.reparsed++;
  }

  // Hand-histories → Main (mains jouées, street par street).
  for (const f of handFiles) {
    if (scannedFiles[f.name] === f.mtime) {
      report.skipped++;
      continue;
    }
    const res = parseHandsText(await source.readFile(f.path), f.name);
    for (const m of res.mains) {
      mains[m.id] = m; // upsert par HandId → dédup naturelle
      report.parsedMains++;
    }
    if (res.errors.length) {
      report.ignored += res.errors.length;
      if (!report.firstError) report.firstError = res.errors[0];
    }
    scannedFiles[f.name] = f.mtime;
    report.reparsed++;
  }

  const data: AppData = {
    ...prev,
    settings: {
      ...prev.settings,
      folder,
      scannedFiles,
      lastScan: new Date().toISOString(),
    },
    tournois,
    mains,
  };
  return { data, report };
}
