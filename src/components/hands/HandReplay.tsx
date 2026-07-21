/**
 * Écran « rejouer une main » — disposition « fiche décision » (hybride).
 * Colonne principale : bandeau des sièges + tableau + carte de décision
 * (pot / à suivre / cote / SPR) + journal. Colonne de droite : liste cliquable
 * des mains. On avance décision par décision. Consomme le moteur pur
 * `analysis/replay`. Les montants sont doublés en BB (repère de profondeur).
 */
import { useEffect, useMemo, useState } from "react";
import type { Main, Carte as CarteT } from "@/parsing/handTypes";
import { rejouer, type EtapeRejeu } from "@/analysis/replay";
import { derivePositions } from "@/analysis/positions";
import { verdictEquite } from "@/analysis/verdict";
import { alternatives, type RangAlt } from "@/analysis/alternatives";
import { eur } from "@/lib/format";

const CARD: React.CSSProperties = {
  border: "1px solid #27272A",
  borderRadius: 12,
  background: "#131316",
};
const MONO = "var(--font-mono)";
const overline: React.CSSProperties = {
  fontSize: 11,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "#C7C7CE",
  fontWeight: 600,
};

/* ---------------- Conversion en big blinds ---------------- */
/** "10 BB" / "1,5 BB" (arrondi au dixième, virgule FR). "" si bb inconnu. */
function toBB(chips: number, bb: number): string {
  if (!bb) return "";
  const v = Math.round((chips / bb) * 10) / 10;
  return `${v.toString().replace(".", ",")} BB`;
}
/** "+35 BB" / "−12 BB" (signe explicite). */
function signedBB(chips: number, bb: number): string {
  if (!bb) return "";
  const v = Math.round((chips / bb) * 10) / 10;
  const sign = v > 0 ? "+" : v < 0 ? "−" : "";
  return `${sign}${Math.abs(v).toString().replace(".", ",")} BB`;
}

/* ---------------- Carte à jouer ---------------- */
const SUITS: Record<string, { sym: string; red: boolean }> = {
  h: { sym: "♥", red: true },
  d: { sym: "♦", red: true },
  c: { sym: "♣", red: false },
  s: { sym: "♠", red: false },
};

function Carte({ c, size = "board" }: { c: CarteT | null; size?: "board" | "seat" }) {
  const d =
    size === "board"
      ? { w: 52, h: 72, suit: 26, corner: 12, radius: 8 }
      : { w: 40, h: 56, suit: 20, corner: 10, radius: 7 };

  if (!c) {
    // Dos de carte (inconnue).
    return (
      <div
        style={{
          width: d.w,
          height: d.h,
          borderRadius: d.radius,
          border: "1px solid #2C2C31",
          background:
            "repeating-linear-gradient(45deg,#1A1A1E,#1A1A1E 5px,#212127 5px,#212127 10px)",
        }}
      />
    );
  }
  const rank = c[0] === "T" ? "10" : c[0];
  const suit = SUITS[c[1]] ?? { sym: "?", red: false };
  const color = suit.red ? "#DC2626" : "#18181B";
  const corner: React.CSSProperties = {
    position: "absolute",
    fontSize: d.corner,
    fontWeight: 700,
    lineHeight: 1,
    letterSpacing: "-0.02em",
  };
  return (
    <div
      style={{
        position: "relative",
        width: d.w,
        height: d.h,
        borderRadius: d.radius,
        background: "#FAFAFA",
        color,
        fontFamily: MONO,
        boxShadow: "0 1px 3px rgba(0,0,0,0.45)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span style={{ ...corner, top: 4, left: 5 }}>{rank}{suit.sym}</span>
      <span style={{ fontSize: d.suit, lineHeight: 1 }}>{suit.sym}</span>
      <span style={{ ...corner, bottom: 4, right: 5 }}>{rank}{suit.sym}</span>
    </div>
  );
}

/* ---------------- Bandeau d'un siège ---------------- */
function SeatCard({
  nom,
  position,
  tapis,
  bb,
  cartes,
  isHero,
  couche,
  actif,
  engage,
}: {
  nom: string;
  position: string;
  tapis: number;
  bb: number;
  cartes: [CarteT, CarteT] | null;
  isHero: boolean;
  couche: boolean;
  actif: boolean;
  engage: number;
}) {
  return (
    <div
      style={{
        ...CARD,
        flex: 1,
        minWidth: 0,
        padding: "12px 14px",
        opacity: couche ? 0.4 : 1,
        borderColor: actif ? "var(--accent-indigo)" : isHero ? "#3F3F46" : "#27272A",
        boxShadow: actif ? "0 0 0 1px var(--accent-indigo)" : "none",
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
          <span
            style={{
              ...overline,
              fontSize: 10,
              padding: "1px 5px",
              borderRadius: 5,
              background: "#1F1F23",
              color: "#C7C7CE",
            }}
          >
            {position}
          </span>
          <span
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: isHero ? "var(--accent-indigo)" : "#FAFAFA",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {nom}
          </span>
        </span>
        {engage > 0 && !couche && (
          <span style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE", whiteSpace: "nowrap" }}>
            mise {engage} ({toBB(engage, bb)})
          </span>
        )}
      </div>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 8 }}>
        <span style={{ display: "flex", gap: 5 }}>
          <Carte c={cartes ? cartes[0] : null} size="seat" />
          <Carte c={cartes ? cartes[1] : null} size="seat" />
        </span>
        <span style={{ textAlign: "right", lineHeight: 1.25 }}>
          <div style={{ fontFamily: MONO, fontSize: 15, color: "#FAFAFA", fontVariantNumeric: "tabular-nums" }}>
            {tapis.toLocaleString("fr-FR")}
          </div>
          <div style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE" }}>{toBB(tapis, bb)}</div>
        </span>
      </div>
    </div>
  );
}

/* ---------------- Formatage d'action ---------------- */
const STREET_LABEL: Record<string, string> = {
  preflop: "PRÉFLOP",
  flop: "FLOP",
  turn: "TURN",
  river: "RIVER",
};

function libelleAction(e: EtapeRejeu, bb: number): string {
  const { type, montant } = e.action;
  const engageAvant = e.sieges.find((s) => s.seat === e.seat)?.engage ?? 0;
  switch (type) {
    case "fold":
      return "se couche";
    case "check":
      return "check";
    case "call":
      return `call ${montant} (${toBB(montant, bb)})`;
    case "bet":
      return `mise ${montant} (${toBB(montant, bb)})`;
    case "raise": {
      const total = engageAvant + montant;
      return `relance → ${total} (${toBB(total, bb)})`;
    }
    default:
      return type;
  }
}
/** Version courte pour le journal : montants en BB (prioritaires sur les jetons). */
function libelleCourt(e: EtapeRejeu, bb: number): string {
  const { type, montant } = e.action;
  const engageAvant = e.sieges.find((s) => s.seat === e.seat)?.engage ?? 0;
  switch (type) {
    case "fold":
      return "fold";
    case "check":
      return "check";
    case "call":
      return `call ${toBB(montant, bb)}`;
    case "bet":
      return `mise ${toBB(montant, bb)}`;
    case "raise":
      return `raise ${toBB(engageAvant + montant, bb)}`;
    default:
      return type;
  }
}

function pct(x: number): string {
  return `${Math.round(x * 100)} %`;
}

/** Dégradé vert→rouge des rangs d'alternative + ordre d'affichage (meilleur d'abord). */
const RANG_COULEUR: Record<RangAlt, string> = {
  bon: "var(--gain)",
  moyen: "#D4A017",
  mauvais: "var(--loss)",
  indetermine: "var(--accent-indigo)",
};
const RANG_ORDRE: Record<RangAlt, number> = { bon: 0, moyen: 1, indetermine: 2, mauvais: 3 };

/** Catégorie de format déduite du nom de tournoi (pour le filtre de la liste). */
function categorieFormat(nom: string): string {
  const n = nom.toLowerCase();
  if (n.includes("expresso")) return "Expresso";
  if (n.includes("ko") || n.includes("knockout") || n.includes("bounty")) return "KO";
  return "MTT";
}

/** Bilan du Hero sur une main (jetons) : gains − contributions. */
function heroNet(main: Main): number {
  const hero = main.joueurs.find((j) => j.isHero);
  if (!hero) return 0;
  const contrib = main.streets
    .flatMap((s) => s.actions)
    .filter((a) => a.seat === hero.seat)
    .reduce((s, a) => s + a.montant, 0);
  const gain = main.gains.find((g) => g.seat === hero.seat)?.montant ?? 0;
  return gain - contrib;
}

/* ---------------- Écran ---------------- */
export function HandReplay({ mains, demo = false }: { mains: Main[]; demo?: boolean }) {
  const [handIdx, setHandIdx] = useState(0);
  const [step, setStep] = useState(0);
  const [filtre, setFiltre] = useState<string | null>(null); // format sélectionné (null = tous)
  // Tournois dépliés (repliés par défaut). Celui de la main courante s'ouvre auto.
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());

  const main = mains[handIdx];
  const etapes = useMemo(() => (main ? rejouer(main) : []), [main]);
  const positions = useMemo(
    () => (main ? derivePositions(main) : new Map<number, string>()),
    [main],
  );
  // Mains groupées par tournoi (ordre d'apparition), en gardant l'index global.
  const groupes = useMemo(() => {
    const map = new Map<
      string,
      { tournoiId: string; nom: string; buyIn: number; format: string; items: { m: Main; i: number }[] }
    >();
    mains.forEach((m, i) => {
      let g = map.get(m.tournoiId);
      if (!g) {
        g = { tournoiId: m.tournoiId, nom: m.tournoiNom, buyIn: m.buyIn, format: categorieFormat(m.tournoiNom), items: [] };
        map.set(m.tournoiId, g);
      }
      g.items.push({ m, i });
    });
    return [...map.values()];
  }, [mains]);

  // Formats présents (pour les chips de filtre) + groupes visibles selon le filtre.
  const formats = useMemo(() => [...new Set(groupes.map((g) => g.format))], [groupes]);
  const groupesVisibles = filtre ? groupes.filter((g) => g.format === filtre) : groupes;

  // Déplie automatiquement le tournoi de la main courante (les autres restent repliés).
  const tournoiCourant = mains[handIdx]?.tournoiId;
  useEffect(() => {
    if (tournoiCourant) setOuverts((prev) => (prev.has(tournoiCourant) ? prev : new Set(prev).add(tournoiCourant)));
  }, [tournoiCourant]);

  // Verdicts d'équité pré-calculés pour TOUTES les étapes de la main (une fois par
  // main) → le passage d'une étape à l'autre est ensuite instantané (simple lookup).
  const verdicts = useMemo(
    () => (main ? etapes.map((et) => verdictEquite(main, et)) : []),
    [main, etapes],
  );

  if (!main || etapes.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "#C7C7CE", fontFamily: MONO, fontSize: 13 }}>
        Aucune main à rejouer.
      </div>
    );
  }

  const bb = main.blinds.bb;
  const s = Math.min(step, etapes.length - 1);
  const e = etapes[s];
  const verdict = verdicts[s] ?? null;
  const acteur = main.joueurs.find((j) => j.seat === e.seat);
  const anteTxt = main.blinds.ante > 0 ? ` (ante ${main.blinds.ante})` : "";
  const heroJoueur = main.joueurs.find((j) => j.isHero);
  const heroActe = e.seat === heroJoueur?.seat;
  const heroTapis = e.sieges.find((si) => si.seat === heroJoueur?.seat)?.tapis ?? 0;

  // Décision d'agression (mise/relance) → taux de fold requis pour un bluff pur.
  const estAgression = e.action.type === "bet" || e.action.type === "raise";
  const foldRequis = estAgression && e.action.montant > 0 ? e.action.montant / (e.potAvant + e.action.montant) : null;
  // Ce que l'adversaire a fait juste après la mise du Hero (on connaît le déroulé).
  const next = etapes[s + 1];
  let reaction: { texte: string; ton: "gain" | "neutre" } | null = null;
  if (heroActe && estAgression) {
    if (!next || next.action.type === "fold")
      reaction = { texte: "l'adversaire s'est couché — la mise a emporté le coup", ton: "gain" };
    else if (next.action.type === "call")
      reaction = { texte: "l'adversaire a suivi — le coup se juge plus loin", ton: "neutre" };
    else if (next.action.type === "raise")
      reaction = { texte: "l'adversaire a relancé", ton: "neutre" };
  }
  const netMain = heroNet(main);
  const netColor = netMain > 0 ? "var(--gain)" : netMain < 0 ? "var(--loss)" : "#FAFAFA";
  const netChips = `${netMain > 0 ? "+" : netMain < 0 ? "−" : ""}${Math.abs(netMain).toLocaleString("fr-FR")}`;

  // Alternatives du spot (pour le Hero uniquement). Préflop non relancé = "limp".
  const preflopUnraised =
    e.street === "preflop" &&
    !e.sieges.some((si) => (si.engage ?? 0) > main.blinds.bb);
  const alts =
    heroActe && verdict
      ? alternatives(e, verdict.equity, verdict.base === "montree", preflopUnraised)
      : heroActe
        ? alternatives(e, null, false, preflopUnraised)
        : [];

  const selectHand = (i: number) => {
    setHandIdx(i);
    setStep(0);
  };
  const goHand = (d: number) => selectHand((handIdx + d + mains.length) % mains.length);
  const goStep = (d: number) => setStep((v) => Math.max(0, Math.min(etapes.length - 1, v + d)));

  const navBtn: React.CSSProperties = {
    font: "inherit",
    fontSize: 13,
    color: "#C7C7CE",
    background: "transparent",
    border: "1px solid #27272A",
    borderRadius: 8,
    padding: "5px 11px",
    cursor: "pointer",
  };

  return (
    <div style={{ flex: 1, display: "flex", minHeight: 0 }}>
      {/* Colonne principale */}
      <div style={{ flex: 1, padding: 28, display: "flex", flexDirection: "column", gap: 16, boxSizing: "border-box", overflowY: "auto" }}>
        {/* Bandeau de contexte : tournoi + tapis du Hero */}
        <div style={{ ...CARD, padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <button style={navBtn} onClick={() => goHand(-1)}>◀</button>
            <div>
              <div style={{ display: "flex", alignItems: "baseline", gap: 10, flexWrap: "wrap" }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#FAFAFA" }}>{main.tournoiNom}</span>
                <span style={{ fontFamily: MONO, fontSize: 13, color: "#C7C7CE" }}>{eur(main.buyIn)}</span>
                <span style={{ fontSize: 13, color: "#C7C7CE" }}>· Main #{main.numero}</span>
                {demo && <span style={{ fontFamily: MONO, fontSize: 11, color: "#C7C7CE" }}>démo</span>}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE", marginTop: 3 }}>
                niveau {main.level} · blindes {main.blinds.sb}/{main.blinds.bb}{anteTxt} · {main.maxSeats}-max
              </div>
            </div>
            <button style={navBtn} onClick={() => goHand(1)}>▶</button>
          </div>
          <div style={{ display: "flex", alignItems: "flex-start", gap: 26 }}>
            <div style={{ textAlign: "right" }}>
              <div style={overline}>Ton tapis</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: "#FAFAFA", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {heroTapis.toLocaleString("fr-FR")}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>{toBB(heroTapis, bb)}</div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={overline}>Bilan main</div>
              <div style={{ fontFamily: MONO, fontSize: 22, fontWeight: 600, color: netColor, fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
                {signedBB(netMain, bb)}
              </div>
              <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>{netChips}</div>
            </div>
          </div>
        </div>

        {/* Bandeau des sièges */}
        <div style={{ display: "flex", gap: 12 }}>
          {e.sieges.map((si) => {
            const j = main.joueurs.find((p) => p.seat === si.seat)!;
            return (
              <SeatCard
                key={si.seat}
                nom={j.nom}
                position={positions.get(si.seat) ?? ""}
                tapis={si.tapis}
                bb={bb}
                cartes={j.cartes}
                isHero={j.isHero}
                couche={si.couche}
                actif={si.seat === e.seat}
                engage={si.engage}
              />
            );
          })}
        </div>

        {/* Tableau + pot */}
        <div style={{ ...CARD, padding: "18px 22px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ ...overline, marginRight: 6 }}>Board</span>
            {[0, 1, 2, 3, 4].map((i) => (
              <Carte key={i} c={e.board[i] ?? null} />
            ))}
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={overline}>Pot</div>
            <div style={{ fontFamily: MONO, fontSize: 26, fontWeight: 500, color: "#FAFAFA", fontVariantNumeric: "tabular-nums", marginTop: 4 }}>
              {e.potAvant.toLocaleString("fr-FR")}
            </div>
            <div style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE", marginTop: 2 }}>{toBB(e.potAvant, bb)}</div>
          </div>
        </div>

        {/* Fiche décision */}
        <div style={{ ...CARD, padding: "22px 24px" }}>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>
              {STREET_LABEL[e.street]} — à <span style={{ color: acteur?.isHero ? "var(--accent-indigo)" : "#FAFAFA" }}>{acteur?.nom}</span> de jouer
            </span>
            <span style={{ fontFamily: MONO, fontSize: 13, color: "#C7C7CE" }}>
              a joué : <span style={{ color: "#C7C7CE" }}>{libelleAction(e, bb)}</span>
            </span>
          </div>

          <div style={{ marginTop: 20, display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }}>
            <Stat
              label="À suivre"
              value={e.aSuivre > 0 ? e.aSuivre.toLocaleString("fr-FR") : "—"}
              hint={e.aSuivre > 0 ? toBB(e.aSuivre, bb) : undefined}
            />
            <Stat
              label="Cote (pot odds)"
              value={e.cote != null ? pct(e.cote) : "—"}
              hint={e.cote != null ? `≥ ${pct(e.cote)} d'équité pour suivre` : "rien à payer"}
              accent
            />
            <Stat
              label="SPR"
              value={e.street !== "preflop" && e.spr != null ? e.spr.toFixed(1) : "—"}
              hint={e.street === "preflop" ? "dès le flop" : undefined}
            />
          </div>

          {/* Analyse de la décision — visuelle et colorée */}
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid #27272A", display: "flex", flexDirection: "column", gap: 10 }}>
            {!heroActe ? (
              <div style={{ fontSize: 12, color: "#C7C7CE" }}>Décision de {acteur?.nom} — l'analyse ne porte que sur tes décisions (★ Hero).</div>
            ) : estAgression ? (
              // MISE / RELANCE : combien l'adversaire doit se coucher + ce qu'il a fait
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={overline}>Ta mise — pour être rentable en bluff</span>
                  <span style={{ fontFamily: MONO, fontSize: 15, fontWeight: 600, color: "var(--accent-indigo)" }}>
                    il doit se coucher ≥ {pct(foldRequis ?? 0)}
                  </span>
                </div>
                <Barre fill={foldRequis} couleur="var(--accent-indigo)" />
                {reaction && (
                  <div style={{ fontSize: 13, fontWeight: 600, color: reaction.ton === "gain" ? "var(--gain)" : "#C7C7CE" }}>
                    {reaction.ton === "gain" ? "✓ " : "• "}{reaction.texte}
                  </div>
                )}
                {verdict && (
                  <div style={{ fontSize: 11, color: "#C7C7CE" }}>
                    Ton équité : {pct(verdict.equity)} — {verdict.base === "montree" ? "vs les cartes montrées (a posteriori)" : "vs une main au hasard (indicatif)"}.
                  </div>
                )}
              </>
            ) : e.action.type === "check" ? (
              <div style={{ fontSize: 13, color: "#C7C7CE" }}>Check — tu vois la suite sans rien payer.</div>
            ) : (
              // CALL / FOLD : jauge équité vs seuil
              (() => {
                const estCall = e.action.type === "call";
                const seuil = e.cote ?? 0;
                const montree = verdict?.base === "montree";
                const rentable = verdict?.rentable ?? null; // équité ≥ seuil
                const bon = verdict ? (estCall ? rentable! : !rentable) : null;
                // Vert/rouge seulement au showdown (verdict ferme) ; indigo si vs hasard (indicatif).
                const couleur = !verdict ? "#3F3F46" : montree ? (bon ? "var(--gain)" : "var(--loss)") : "var(--accent-indigo)";
                return (
                  <>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={overline}>{estCall ? "Ton call" : "Ton fold"} — équité vs seuil</span>
                      {montree ? (
                        <span style={{ fontSize: 14, fontWeight: 700, color: couleur }}>
                          {estCall
                            ? rentable
                              ? "✓ call rentable"
                              : "✗ call non rentable"
                            : rentable
                              ? "✗ fold d'un call rentable"
                              : "✓ fold correct"}
                        </span>
                      ) : verdict ? (
                        <span style={{ fontSize: 12, color: "#C7C7CE" }}>indicatif · vs main au hasard</span>
                      ) : (
                        <span style={{ fontSize: 12, color: "#C7C7CE" }}>équité inconnue</span>
                      )}
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: MONO, fontSize: 12 }}>
                      <span style={{ color: verdict ? couleur : "#C7C7CE" }}>
                        ta main&nbsp;: {verdict ? pct(verdict.equity) : "?"}
                      </span>
                      <span style={{ color: "#C7C7CE" }}>seuil&nbsp;: {pct(seuil)}</span>
                    </div>
                    <Barre fill={verdict ? verdict.equity : null} couleur={couleur} seuil={seuil} hachure={!verdict} />
                    <div style={{ fontSize: 12, color: "#C7C7CE" }}>
                      {!verdict
                        ? `Équité inconnue — seul le prix (seuil ${pct(seuil)}) est connu.`
                        : montree
                          ? estCall
                            ? rentable
                              ? `Tu avais ${pct(verdict.equity)} ≥ ${pct(seuil)} → payer était rentable.`
                              : `Tu n'avais que ${pct(verdict.equity)} < ${pct(seuil)} → coucher était mieux.`
                            : rentable
                              ? `Tu avais ${pct(verdict.equity)} ≥ ${pct(seuil)} → tu as lâché un call rentable.`
                              : `Tu n'avais que ${pct(verdict.equity)} < ${pct(seuil)} → coucher était correct.`
                          : `Contre une main au hasard : ${pct(verdict.equity)} (seuil ${pct(seuil)}). Indicatif — un adversaire qui mise a souvent mieux, ton équité réelle est sans doute plus basse.`}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </div>

        {/* Alternatives du spot — dégradé vert→rouge (ordre du meilleur au pire) */}
        {heroActe && alts.length > 0 && (
          <div style={{ ...CARD, padding: "16px 20px" }}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
              <span style={overline}>Alternatives à ce moment</span>
              <span style={{ fontSize: 11, color: "#C7C7CE" }}>
                {verdict?.base === "montree" ? "classées par EV (abattage connu)" : "indicatif — équité non fiable"}
              </span>
            </div>
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              {[...alts]
                .sort((a, b) => RANG_ORDRE[a.rang] - RANG_ORDRE[b.rang])
                .map((a) => {
                  const c = RANG_COULEUR[a.rang];
                  const joue = a.type === e.action.type;
                  return (
                    <div
                      key={a.type}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 12,
                        padding: "9px 12px",
                        borderRadius: 9,
                        background: "#0E0E11",
                        border: "1px solid",
                        borderColor: joue ? c : "#1F1F23",
                        borderLeft: `3px solid ${c}`,
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: c, flex: "none" }} />
                      <span style={{ minWidth: 92, flex: "none" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "#FAFAFA" }}>{a.label}</span>
                        {joue && <span style={{ fontSize: 10, color: "#C7C7CE", marginLeft: 6 }}>· joué</span>}
                      </span>
                      <span style={{ flex: 1, fontSize: 12, color: "#C7C7CE", lineHeight: 1.45 }}>{a.note}</span>
                      <span style={{ fontFamily: MONO, fontSize: 12, color: c, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
                        {a.evChips != null
                          ? `${a.evChips > 0 ? "+" : a.evChips < 0 ? "−" : ""}${Math.abs(Math.round(a.evChips))} j.`
                          : a.foldRequis != null
                            ? `fold ${pct(a.foldRequis)}`
                            : ""}
                      </span>
                    </div>
                  );
                })}
            </div>
            <div style={{ fontSize: 11, color: "#C7C7CE", marginTop: 10, lineHeight: 1.5 }}>
              EV en jetons = gain moyen immédiat vs se coucher (sans miser davantage). La relance dépend
              de la réaction adverse → non chiffrable sans hypothèse, laissée en indigo.
            </div>
          </div>
        )}

        {/* Contrôles */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <button style={navBtn} onClick={() => goStep(-1)} disabled={s === 0}>◀ précédent</button>
          <span style={{ fontFamily: MONO, fontSize: 12, color: "#C7C7CE" }}>étape {s + 1}/{etapes.length}</span>
          <button style={navBtn} onClick={() => goStep(1)} disabled={s === etapes.length - 1}>suivant ▶</button>
        </div>

        {/* Journal — déroulé regroupé par street */}
        <div style={{ ...CARD, padding: "14px 18px", display: "flex", flexDirection: "column", gap: 10 }}>
          {(["preflop", "flop", "turn", "river"] as const).map((st) => {
            const items = etapes.map((et, i) => ({ et, i })).filter((x) => x.et.street === st);
            if (!items.length) return null;
            return (
              <div key={st} style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <span style={{ ...overline, width: 62, flex: "none" }}>{STREET_LABEL[st]}</span>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 8px" }}>
                  {items.map(({ et, i }) => {
                    const j = main.joueurs.find((p) => p.seat === et.seat);
                    const cur = i === s;
                    return (
                      <button
                        key={i}
                        onClick={() => setStep(i)}
                        style={{
                          font: "inherit",
                          fontFamily: MONO,
                          fontSize: 12,
                          border: "1px solid",
                          borderColor: cur ? "var(--accent-indigo)" : "#27272A",
                          background: cur ? "rgba(99,102,241,0.12)" : "transparent",
                          color: cur ? "#FAFAFA" : "#C7C7CE",
                          borderRadius: 7,
                          padding: "3px 8px",
                          cursor: "pointer",
                        }}
                      >
                        {j?.isHero ? "★ " : ""}{j?.nom.slice(0, 8)} {libelleCourt(et, bb)}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Colonne de droite : mains groupées par tournoi */}
      <aside style={{ width: 250, flex: "none", borderLeft: "1px solid #27272A", overflowY: "auto", background: "#0C0C0E" }}>
        <div style={{ ...overline, padding: "18px 18px 10px" }}>
          Tournois · {groupesVisibles.length}{filtre ? `/${groupes.length}` : ""}
        </div>

        {/* Filtre par format */}
        {formats.length > 1 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 16px 12px" }}>
            {[null, ...formats].map((f) => {
              const actif = filtre === f;
              return (
                <button
                  key={f ?? "tous"}
                  onClick={() => setFiltre(f)}
                  style={{
                    font: "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    color: actif ? "#09090B" : "#C7C7CE",
                    background: actif ? "var(--accent-indigo)" : "transparent",
                    border: "1px solid",
                    borderColor: actif ? "var(--accent-indigo)" : "#27272A",
                    borderRadius: 999,
                    padding: "3px 10px",
                    cursor: "pointer",
                  }}
                >
                  {f ?? "Tous"}
                </button>
              );
            })}
          </div>
        )}

        {groupesVisibles.map((g) => {
          const netTournoi = g.items.reduce((s, x) => s + heroNet(x.m), 0);
          const dotG = netTournoi > 0 ? "var(--gain)" : netTournoi < 0 ? "var(--loss)" : "#C7C7CE";
          const replie = !ouverts.has(g.tournoiId);
          const toggle = () =>
            setOuverts((prev) => {
              const next = new Set(prev);
              next.has(g.tournoiId) ? next.delete(g.tournoiId) : next.add(g.tournoiId);
              return next;
            });
          return (
            <div key={g.tournoiId}>
              {/* En-tête de tournoi (collant, repliable) */}
              <button
                onClick={toggle}
                style={{
                  width: "100%",
                  textAlign: "left",
                  font: "inherit",
                  position: "sticky",
                  top: 0,
                  background: "#101014",
                  borderTop: "1px solid #27272A",
                  borderBottom: "1px solid #1F1F23",
                  borderLeft: "none",
                  borderRight: "none",
                  padding: "9px 16px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                }}
              >
                <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                  <span style={{ fontSize: 10, color: "#C7C7CE", flex: "none", width: 8 }}>{replie ? "▸" : "▾"}</span>
                  <span style={{ minWidth: 0 }}>
                    <span style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#FAFAFA", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {g.nom}
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 10, color: "#C7C7CE" }}>
                      {eur(g.buyIn)} · {g.items.length} main{g.items.length > 1 ? "s" : ""}
                    </span>
                  </span>
                </span>
                <span style={{ fontFamily: MONO, fontSize: 11, fontWeight: 600, color: dotG, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                  {signedBB(netTournoi, g.items[0].m.blinds.bb)}
                </span>
              </button>

              {!replie && g.items.map(({ m, i }) => {
                const net = heroNet(m);
                const cur = i === handIdx;
                const dot = net > 0 ? "var(--gain)" : net < 0 ? "var(--loss)" : "#C7C7CE";
                return (
                  <button
                    key={m.id}
                    onClick={() => selectHand(i)}
                    style={{
                      width: "100%",
                      textAlign: "left",
                      font: "inherit",
                      background: cur ? "rgba(99,102,241,0.12)" : "transparent",
                      borderLeft: `2px solid ${cur ? "var(--accent-indigo)" : "transparent"}`,
                      borderTop: "none",
                      borderRight: "none",
                      borderBottom: "1px solid #18181B",
                      padding: "10px 16px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 8,
                    }}
                  >
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flex: "none" }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: cur ? "#FAFAFA" : "#D4D4D8" }}>
                          Main #{m.numero}
                        </span>
                      </span>
                      <span style={{ display: "block", fontFamily: MONO, fontSize: 11, color: "#C7C7CE", marginTop: 3, marginLeft: 13 }}>
                        niv.{m.level} · {m.blinds.sb}/{m.blinds.bb}
                      </span>
                    </span>
                    <span style={{ fontFamily: MONO, fontSize: 12, color: dot, fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>
                      {signedBB(net, m.blinds.bb)}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </aside>
    </div>
  );
}

/** Jauge horizontale 0–100 % : remplissage coloré + repère de seuil (trait blanc). */
function Barre({
  fill,
  couleur,
  seuil,
  hachure,
}: {
  fill?: number | null;
  couleur?: string;
  seuil?: number | null;
  hachure?: boolean;
}) {
  const p = (x: number) => `${Math.max(0, Math.min(1, x)) * 100}%`;
  return (
    <div style={{ position: "relative", height: 12, background: "#1F1F23", borderRadius: 999 }}>
      {hachure && (
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, background: "repeating-linear-gradient(45deg,#1F1F23,#1F1F23 5px,#2A2A30 5px,#2A2A30 10px)" }} />
      )}
      {!hachure && fill != null && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: p(fill), background: couleur, borderRadius: 999 }} />
      )}
      {seuil != null && (
        <div
          style={{ position: "absolute", left: p(seuil), top: -4, bottom: -4, width: 2, background: "#FAFAFA", borderRadius: 1 }}
          title={`seuil ${Math.round(seuil * 100)} %`}
        />
      )}
    </div>
  );
}

function Stat({ label, value, hint, accent }: { label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div>
      <div style={overline}>{label}</div>
      <div
        style={{
          fontFamily: MONO,
          fontSize: 28,
          fontWeight: 500,
          color: accent ? "var(--accent-indigo)" : "#FAFAFA",
          marginTop: 8,
          letterSpacing: "-0.02em",
          fontVariantNumeric: "tabular-nums",
        }}
      >
        {value}
      </div>
      {hint && <div style={{ fontSize: 11, color: "#C7C7CE", marginTop: 6 }}>{hint}</div>}
    </div>
  );
}
