/**
 * Jeu de démonstration : les fixtures anonymisées, utilisées uniquement hors Tauri
 * (ex. `npm run dev` dans un navigateur) où l'accès disque n'est pas disponible.
 */
import { parseSummaryText } from "@/parsing/parseSummary";
import { parseHandsText } from "@/parsing/parseHands";
import type { Tournoi } from "@/parsing/types";
import type { Main } from "@/parsing/handTypes";

const raw = import.meta.glob("../parsing/__fixtures__/*.txt", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

/** Une hand-history contient des « HandId », un résumé des blocs « summary ». */
function isHandHistory(content: string): boolean {
  return content.includes(" - HandId: #");
}

export function loadFixtureTournois(): Tournoi[] {
  const all: Tournoi[] = [];
  for (const [path, content] of Object.entries(raw)) {
    if (isHandHistory(content)) continue;
    const name = path.split("/").pop() ?? path;
    all.push(...parseSummaryText(content, name).tournois);
  }
  return all;
}

/** Mains de démonstration (fixtures hand-history), triées par n° de main. */
export function loadFixtureMains(): Main[] {
  const all: Main[] = [];
  for (const [path, content] of Object.entries(raw)) {
    if (!isHandHistory(content)) continue;
    const name = path.split("/").pop() ?? path;
    all.push(...parseHandsText(content, name).mains);
  }
  return all.sort((a, b) => a.numero - b.numero);
}
