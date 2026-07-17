/**
 * Persistance locale (base cumulée mois après mois).
 * La base réelle vit dans le répertoire de données de l'app (hors repo).
 */
import type { Tournoi } from "@/parsing/types";

export interface Settings {
  /** Bankroll de départ (défaut 50 €), persistée. */
  startingBankroll: number;
  /** Dossier history sélectionné/détecté. */
  folder: string | null;
  /** Dernier scan (ISO). */
  lastScan: string | null;
  /** Empreinte des fichiers déjà scannés (nom → mtime) pour le scan incrémental. */
  scannedFiles: Record<string, number>;
}

export interface AppData {
  version: number;
  settings: Settings;
  /** Tournois cumulés, indexés par clé de déduplication. */
  tournois: Record<string, Tournoi>;
}

export const DEFAULT_APP_DATA: AppData = {
  version: 1,
  settings: {
    startingBankroll: 50,
    folder: null,
    lastScan: null,
    scannedFiles: {},
  },
  tournois: {},
};

export interface Storage {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
