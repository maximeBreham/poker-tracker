/**
 * Jeu de démonstration : les fixtures anonymisées, utilisées uniquement hors Tauri
 * (ex. `npm run dev` dans un navigateur) où l'accès disque n'est pas disponible.
 */
import { parseSummaryText } from "@/parsing/parseSummary";
import type { Tournoi } from "@/parsing/types";

const raw = import.meta.glob("../parsing/__fixtures__/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

export function loadFixtureTournois(): Tournoi[] {
  const all: Tournoi[] = [];
  for (const [path, content] of Object.entries(raw)) {
    const name = path.split("/").pop() ?? path;
    all.push(...parseSummaryText(content, name).tournois);
  }
  return all;
}
