/**
 * Abstraction « source de données » : découple le cœur (parsing/calculs/UI)
 * de l'API Tauri, pour pouvoir sortir plus tard une version web (import only)
 * sans réécrire le reste (cf. brief §Note portabilité).
 */

export interface SummaryFile {
  path: string; // chemin absolu
  name: string; // nom de fichier
  mtime: number; // date de modif (ms) — pour le scan incrémental
}

export interface DataSource {
  /** true si cette source est disponible dans l'environnement courant (Tauri présent). */
  isAvailable(): boolean;
  /** Auto-détection du dossier history Winamax selon l'OS ; null si introuvable. */
  autoDetectDir(): Promise<string | null>;
  /** Sélecteur natif de dossier ; null si annulé. */
  pickDir(): Promise<string | null>;
  /** Liste les fichiers résumé (*_summary.txt) d'un dossier. */
  listSummaryFiles(dir: string): Promise<SummaryFile[]>;
  /** Lit le contenu texte d'un fichier. */
  readFile(path: string): Promise<string>;
  /** Surveille le dossier ; renvoie une fonction pour arrêter la surveillance. */
  watchDir(dir: string, onChange: () => void): Promise<() => void>;
}
