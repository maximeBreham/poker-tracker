/**
 * Parser des fichiers RÉSUMÉ de tournoi Winamax (source de la v1).
 *
 * Format : texte à plat, une clé par ligne. Un fichier peut contenir PLUSIEURS blocs
 * "Winamax Poker - Tournament summary : …" (re-entries late reg, même id).
 * On ne devine rien : chaque champ est lu tel quel, les dérivations sont dans derive.ts.
 */
import type { ParseResult, Tournoi } from "./types";
import {
  deriveFormat,
  deriveMultiplier,
  deriveWinnings,
  makeDedupKey,
  parseBuyInAmounts,
  parseAmount,
  round2,
  splitBuyIn,
  toIsoUtc,
} from "./derive";

const BLOCK_MARKER = "Winamax Poker - Tournament summary :";

/** Découpe le contenu d'un fichier en blocs (un par tournoi/entrée). */
function splitBlocks(text: string): string[] {
  return text
    .split(new RegExp(`(?=${BLOCK_MARKER})`))
    .map((b) => b.trim())
    .filter((b) => b.startsWith(BLOCK_MARKER));
}

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[1] : null;
}

/** Parse un seul bloc en Tournoi (ou null si le bloc n'est pas exploitable). */
function parseBlock(block: string, sourceFile: string, entryIndex: number): Tournoi | null {
  // Nom + id : "… summary : PLASMA - SPACE KO(1124466874) - Late Registration"
  const head = block.match(/Tournament summary : (.+?)\((\d+)\)/);
  if (!head) return null;
  const name = head[1].trim();
  const id = head[2];

  const buyInLine = firstMatch(block, /Buy-In : (.+)/);
  const { buyIn, entry, bounty, rake } = splitBuyIn(
    buyInLine ? parseBuyInAmounts(buyInLine) : [],
  );

  const playersRaw = firstMatch(block, /Registered players : (\d+)/);
  const players = playersRaw ? parseInt(playersRaw, 10) : 0;

  const mode = firstMatch(block, /Mode : (\S+)/) ?? undefined;
  const type = firstMatch(block, /Type : (\S+)/) ?? undefined;

  const prizeRaw = firstMatch(block, /Prizepool : ([\d.,]+)\s*€/);
  const prizePool = prizeRaw !== null ? round2(parseAmount(prizeRaw)) : null;

  const started = block.match(
    /Tournament started (\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2}) UTC/,
  );
  const startedAt = started ? toIsoUtc(started[1], started[2]) : "";

  const placeRaw = firstMatch(block, /You finished in (\d+)\w* place/);
  const finishPlace = placeRaw ? parseInt(placeRaw, 10) : null;

  const format = deriveFormat(name, mode, type);
  const multiplier = deriveMultiplier(format, prizePool, buyIn);
  const isMultiplierEstimated = false; // dérivé exactement de prizePool/buyIn quand présent
  const { winnings, isEstimated: isWinningsEstimated } = deriveWinnings(
    format,
    finishPlace,
    prizePool,
    multiplier,
  );

  return {
    id,
    dedupKey: makeDedupKey(id, entryIndex),
    entryIndex,
    startedAt,
    format,
    name,
    players,
    buyIn,
    entry,
    bounty,
    rake,
    prizePool,
    finishPlace,
    winnings,
    isWinningsEstimated,
    profit: round2(winnings - buyIn),
    multiplier,
    isMultiplierEstimated,
    sourceFile,
  };
}

/** Parse le contenu texte d'un fichier résumé → un ou plusieurs Tournoi. */
export function parseSummaryText(text: string, sourceFile = ""): ParseResult {
  const result: ParseResult = { tournois: [], errors: [] };
  const blocks = splitBlocks(text);

  if (blocks.length === 0) {
    result.errors.push({
      sourceFile,
      reason: "Aucun bloc « Tournament summary » reconnu",
      raw: text.slice(0, 500),
    });
    return result;
  }

  blocks.forEach((block, i) => {
    const t = parseBlock(block, sourceFile, i);
    if (t) result.tournois.push(t);
    else
      result.errors.push({
        sourceFile,
        reason: `Bloc #${i} non exploitable (id/nom introuvable)`,
        raw: block.slice(0, 500),
      });
  });

  return result;
}
