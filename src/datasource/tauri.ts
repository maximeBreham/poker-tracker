/**
 * Implémentation Tauri de la source de données.
 * Accès système via les plugins JS (Rust minimal voire nul), cf. brief §Stack.
 */
import { isTauri } from "@tauri-apps/api/core";
import { configDir, join } from "@tauri-apps/api/path";
import { exists, readDir, readTextFile, stat, watchImmediate } from "@tauri-apps/plugin-fs";
import { open } from "@tauri-apps/plugin-dialog";
import type { DataSource, SummaryFile } from "./types";

const SUMMARY_SUFFIX = "_summary.txt";

/**
 * Base multi-OS via configDir() :
 *  - Linux   : ~/.config
 *  - Windows : %APPDATA% (Roaming)
 *  - macOS   : ~/Library/Application Support
 * → couvre le client natif sur les 3 OS. (Client Linux sous Wine : sélection manuelle.)
 */
async function findHistoryDirs(): Promise<string[]> {
  const base = await join(await configDir(), "winamax", "documents", "accounts");
  if (!(await exists(base))) return [];
  const out: string[] = [];
  for (const entry of await readDir(base)) {
    if (!entry.isDirectory) continue;
    const hist = await join(base, entry.name, "history");
    if (await exists(hist)) out.push(hist);
  }
  return out;
}

export function createTauriDataSource(): DataSource {
  return {
    isAvailable: () => isTauri(),

    async autoDetectDir() {
      const dirs = await findHistoryDirs();
      return dirs[0] ?? null;
    },

    async pickDir() {
      const res = await open({
        directory: true,
        multiple: false,
        title: "Dossier « history » Winamax",
      });
      return typeof res === "string" ? res : null;
    },

    async listSummaryFiles(dir) {
      const files: SummaryFile[] = [];
      for (const entry of await readDir(dir)) {
        if (!entry.isFile || !entry.name.endsWith(SUMMARY_SUFFIX)) continue;
        const path = await join(dir, entry.name);
        let mtime = 0;
        try {
          const info = await stat(path);
          mtime = info.mtime ? new Date(info.mtime).getTime() : 0;
        } catch {
          /* stat peut échouer ponctuellement (fichier en cours d'écriture) → mtime 0 */
        }
        files.push({ path, name: entry.name, mtime });
      }
      return files;
    },

    async readFile(path) {
      return readTextFile(path);
    },

    async watchDir(dir, onChange) {
      return watchImmediate(dir, () => onChange(), { recursive: false });
    },
  };
}
