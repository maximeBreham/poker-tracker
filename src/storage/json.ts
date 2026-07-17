/**
 * Implémentation JSON de la persistance (fichier dans le répertoire de données de l'app).
 * SQLite pourra remplacer cette impl plus tard sans toucher au reste (même interface Storage).
 */
import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { DEFAULT_APP_DATA, type AppData, type Storage } from "./types";

const DB_FILE = "poker-tracker-db.json";

async function dbPath(): Promise<string> {
  return join(await appDataDir(), DB_FILE);
}

export function createJsonStorage(): Storage {
  return {
    async load() {
      const path = await dbPath();
      if (!(await exists(path))) return structuredClone(DEFAULT_APP_DATA);
      try {
        const parsed = JSON.parse(await readTextFile(path)) as Partial<AppData>;
        return {
          ...DEFAULT_APP_DATA,
          ...parsed,
          settings: { ...DEFAULT_APP_DATA.settings, ...parsed.settings },
          tournois: parsed.tournois ?? {},
        };
      } catch {
        // Fichier corrompu → on repart d'une base vide plutôt que de crasher.
        return structuredClone(DEFAULT_APP_DATA);
      }
    },

    async save(data) {
      const dir = await appDataDir();
      if (!(await exists(dir))) await mkdir(dir, { recursive: true });
      await writeTextFile(await dbPath(), JSON.stringify(data, null, 2));
    },
  };
}
