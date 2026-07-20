/**
 * Parser des fichiers HAND-HISTORY Winamax (source du modèle `Main`).
 *
 * Format : texte à plat. Un fichier = plusieurs mains, chacune démarrant par
 * `Winamax Poker - Tournament "…"`. Chaque main enchaîne des sections
 * `*** ANTE/BLINDS ***`, `*** PRE-FLOP ***`, `*** FLOP *** [..]`, etc.
 *
 * On ne devine rien : chaque champ est lu tel quel. La seule normalisation est
 * le calcul du `montant` d'un raise (« raises X to Y » → jetons ajoutés), car
 * le format donne le total de street, pas l'incrément. Tout le reste (cote,
 * équité, position…) est laissé au module d'analyse.
 */
import type {
  Action,
  ActionType,
  Carte,
  Joueur,
  Main,
  ParseHandsResult,
  Street,
  StreetData,
} from "./handTypes";
import { toIsoUtc } from "./derive";

const BLOCK_MARKER = 'Winamax Poker - Tournament "';

/** Découpe le contenu d'un fichier en blocs (une main par bloc). */
function splitHands(text: string): string[] {
  return text
    .split(new RegExp(`(?=${BLOCK_MARKER})`))
    .map((b) => b.trim())
    .filter((b) => b.startsWith(BLOCK_MARKER));
}

/** Cartes d'un groupe « [Ts 2c 6d] » → ["Ts","2c","6d"]. */
function parseCards(group: string): Carte[] {
  return group.trim().split(/\s+/).filter(Boolean);
}

/** Associe une street Winamax à son marqueur de section. */
const STREET_OF: Record<string, Street> = {
  "PRE-FLOP": "preflop",
  FLOP: "flop",
  TURN: "turn",
  RIVER: "river",
};

/** Parse une seule main en `Main` (ou null si en-tête introuvable). */
function parseHand(block: string, sourceFile: string): Main | null {
  const lines = block.split("\n").map((l) => l.trimEnd());

  // --- En-tête : nom, buy-in, level, HandId, blinds, date ---
  // Winamax Poker - Tournament "Expresso" buyIn: … level: 1 - HandId: #…-1-… - Holdem no limit (10/20) - 2026/07/18 20:42:58 UTC
  const head = lines[0].match(
    /Tournament "(.+?)".*level: (\d+) - HandId: (#(\d+)-(\d+)-\d+) - .+?\(([\d/]+)\) - (\d{4}\/\d{2}\/\d{2}) (\d{2}:\d{2}:\d{2}) UTC/,
  );
  if (!head) return null;
  const level = parseInt(head[2], 10);
  const id = head[3];
  const numero = parseInt(head[5], 10);
  const blindParts = head[6].split("/").map((n) => parseInt(n, 10));
  // 2 valeurs = sb/bb (Expresso) ; 3 valeurs = ante/sb/bb (KO/MTT).
  const blinds =
    blindParts.length >= 3
      ? { ante: blindParts[0], sb: blindParts[1], bb: blindParts[2] }
      : { ante: 0, sb: blindParts[0], bb: blindParts[1] };
  const startedAt = toIsoUtc(head[7], head[8]);

  // --- Table : id de tournoi, maxSeats, bouton ---
  // Table: 'Expresso(1151681541)#0' 3-max (real money) Seat #3 is the button
  const table = block.match(
    /Table: '.*?\((\d+)\)[^']*'\s+(\d+)-max.*?Seat #(\d+) is the button/,
  );
  const tournoiId = table ? table[1] : "";
  const maxSeats = table ? parseInt(table[2], 10) : 0;
  const buttonSeat = table ? parseInt(table[3], 10) : 0;

  // --- Sièges : Seat 1: Nom (500) | Seat 1: Nom (20000, 1€ bounty) ---
  const joueurs: Joueur[] = [];
  const seatByName = new Map<string, number>();
  for (const l of lines) {
    const m = l.match(/^Seat (\d+): (.+) \((\d+)(?:, ([\d.,]+)€ bounty)?\)$/);
    if (!m) continue;
    const seat = parseInt(m[1], 10);
    const nom = m[2];
    joueurs.push({
      seat,
      nom,
      tapisDebut: parseInt(m[3], 10),
      isHero: false,
      cartes: null,
      bounty: m[4] ? parseFloat(m[4].replace(",", ".")) : null,
    });
    seatByName.set(nom, seat);
  }

  // Noms triés par longueur décroissante : résoudre l'acteur d'une ligne même
  // si un pseudo contient des espaces (« G Ouine40 ») ou est préfixe d'un autre.
  const namesByLength = [...seatByName.keys()].sort((a, b) => b.length - a.length);
  const actorOf = (line: string): { seat: number; rest: string } | null => {
    for (const nom of namesByLength) {
      if (line.startsWith(nom + " ")) {
        return { seat: seatByName.get(nom)!, rest: line.slice(nom.length + 1) };
      }
    }
    return null;
  };

  const setCards = (seat: number, cards: Carte[]) => {
    const j = joueurs.find((p) => p.seat === seat);
    if (j && cards.length === 2) j.cartes = [cards[0], cards[1]];
  };

  // --- Parcours des sections ---
  const streets: StreetData[] = [];
  let current: StreetData | null = null;
  const blindActions: Action[] = []; // post_* de la section ANTE/BLINDS
  const gainsBySeat = new Map<number, number>();
  let totalPot = 0;
  // Jetons engagés par siège SUR LA STREET COURANTE (hors ante), pour normaliser
  // « raises X to Y » : montant ajouté = Y − committed[seat].
  let committed = new Map<number, number>();

  const pushAction = (a: Action) => {
    if (current) current.actions.push(a);
    else blindActions.push(a); // avant PRE-FLOP : blindes/antes
  };

  for (const l of lines) {
    // Nouvelle section ?
    const sec = l.match(/^\*\*\* ([A-Z-]+(?: [A-Z]+)*) \*\*\*(.*)$/);
    if (sec) {
      const label = sec[1].trim();
      const street = STREET_OF[label];
      if (street) {
        // Board : dernier groupe [..] de la ligne (flop: 3 cartes, turn/river: 1).
        const groups = [...sec[2].matchAll(/\[([^\]]+)\]/g)];
        const cartes = groups.length ? parseCards(groups[groups.length - 1][1]) : [];
        current = { street, cartes, actions: [] };
        streets.push(current);
        // Nouvelle street postflop → remise à zéro des engagements. En preflop,
        // on NE réinitialise PAS : les blindes/antes déjà engagées comptent pour
        // normaliser le 1er raise (« raises X to Y »).
        if (street !== "preflop") committed = new Map();
        else current.actions.push(...blindActions);
      }
      // ANTE/BLINDS, SHOW DOWN, SUMMARY : pas de StreetData dédié.
      continue;
    }

    // Cartes du Hero : « Dealt to Hero [5s 4h] »
    const dealt = l.match(/^Dealt to (.+) \[([^\]]+)\]$/);
    if (dealt) {
      const seat = seatByName.get(dealt[1]);
      if (seat != null) {
        const j = joueurs.find((p) => p.seat === seat);
        if (j) j.isHero = true;
        setCards(seat, parseCards(dealt[2]));
      }
      continue;
    }

    // Showdown : « Hero shows [Ts Kh] (…) »
    const shows = l.match(/^(.+) shows \[([^\]]+)\]/);
    if (shows) {
      const seat = seatByName.get(shows[1]);
      if (seat != null) setCards(seat, parseCards(shows[2]));
      continue;
    }

    // Gains : « X collected 120 from pot | from main pot | from side pot 1 »
    const collected = l.match(/^(.+) collected (\d+) from /);
    if (collected) {
      const seat = seatByName.get(collected[1]);
      if (seat != null)
        gainsBySeat.set(seat, (gainsBySeat.get(seat) ?? 0) + parseInt(collected[2], 10));
      continue;
    }

    // Total pot (SUMMARY) : « Total pot 120 | No rake »
    const pot = l.match(/^Total pot (\d+)/);
    if (pot) {
      totalPot = parseInt(pot[1], 10);
      continue;
    }

    // Sinon : une action de joueur ?
    const actor = actorOf(l);
    if (!actor) continue;
    const action = parseAction(actor.seat, actor.rest, committed);
    if (action) pushAction(action);
  }

  return {
    id,
    numero,
    tournoiId,
    startedAt,
    level,
    blinds,
    maxSeats,
    buttonSeat,
    joueurs,
    streets,
    gains: [...gainsBySeat.entries()].map(([seat, montant]) => ({ seat, montant })),
    totalPot,
    sourceFile,
  };
}

/**
 * Parse le reste d'une ligne d'action (après le pseudo) en `Action`.
 * Met à jour `committed` (jetons engagés sur la street, hors ante).
 */
function parseAction(
  seat: number,
  rest: string,
  committed: Map<number, number>,
): Action | null {
  const allIn = rest.includes("all-in");
  const num = (): number => {
    const m = rest.match(/(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const add = (type: ActionType, montant: number, bumpCommitted = montant): Action => {
    committed.set(seat, (committed.get(seat) ?? 0) + bumpCommitted);
    return { seat, type, montant, allIn };
  };

  if (rest === "folds") return { seat, type: "fold", montant: 0, allIn: false };
  if (rest === "checks") return { seat, type: "check", montant: 0, allIn: false };
  if (rest.startsWith("calls ")) return add("call", num());
  if (rest.startsWith("bets ")) return add("bet", num());
  if (rest.startsWith("raises ")) {
    // « raises 30 to 50 » : Y = total street. Montant ajouté = Y − déjà engagé.
    const to = rest.match(/raises \d+ to (\d+)/);
    const total = to ? parseInt(to[1], 10) : num();
    const montant = total - (committed.get(seat) ?? 0);
    committed.set(seat, total);
    return { seat, type: "raise", montant, allIn };
  }
  if (rest.startsWith("posts small blind ")) return add("post_sb", num());
  if (rest.startsWith("posts big blind ")) return add("post_bb", num());
  // Ante : ajoutée au pot mais NON comptée dans « déjà engagé » (bumpCommitted = 0).
  if (rest.startsWith("posts ante ")) return add("post_ante", num(), 0);
  return null;
}

/** Parse le contenu texte d'un fichier hand-history → une ou plusieurs mains. */
export function parseHandsText(text: string, sourceFile = ""): ParseHandsResult {
  const result: ParseHandsResult = { mains: [], errors: [] };
  const blocks = splitHands(text);

  if (blocks.length === 0) {
    result.errors.push({
      sourceFile,
      reason: "Aucune main « Winamax Poker - Tournament » reconnue",
      raw: text.slice(0, 500),
    });
    return result;
  }

  blocks.forEach((block, i) => {
    const m = parseHand(block, sourceFile);
    if (m) result.mains.push(m);
    else
      result.errors.push({
        sourceFile,
        reason: `Main #${i} non exploitable (en-tête introuvable)`,
        raw: block.slice(0, 500),
      });
  });

  return result;
}
