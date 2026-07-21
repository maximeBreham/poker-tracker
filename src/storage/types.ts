/**
 * Persistance locale (base cumulée mois après mois).
 * La base réelle vit dans le répertoire de données de l'app (hors repo).
 */
import type { Tournoi } from "@/parsing/types";
import type { Main } from "@/parsing/handTypes";

export interface Settings {
  /** Bankroll de départ (défaut 50 €), persistée. */
  startingBankroll: number;
  /**
   * Ajustement externe en € (mouvements non-poker : paris sportifs, dépôts/retraits).
   * Le portefeuille Winamax étant partagé, ce delta recale la bankroll affichée sur le solde réel
   * sans polluer le net/ROI poker. Calculé depuis le « solde réel actuel » saisi par l'utilisateur.
   */
  externalAdjustment: number;
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
  /** Mains jouées cumulées, indexées par HandId (parsées des hand-histories). */
  mains: Record<string, Main>;
}

export const DEFAULT_APP_DATA: AppData = {
  version: 2,
  settings: {
    startingBankroll: 50,
    externalAdjustment: 0,
    folder: null,
    lastScan: null,
    scannedFiles: {},
  },
  tournois: {},
  mains: {},
};

export interface Storage {
  load(): Promise<AppData>;
  save(data: AppData): Promise<void>;
}
