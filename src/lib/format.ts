/** Helpers de formatage (€, %, dates) — affichage FR, montants en Europe/Paris. */

const EUR = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
});

const DT = new Intl.DateTimeFormat("fr-FR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "Europe/Paris",
});

const MONTH = new Intl.DateTimeFormat("fr-FR", {
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

/** "68,20 €" */
export function eur(n: number): string {
  return EUR.format(n);
}

/** "+18,20 €" / "−6,40 €" (signe explicite, vrai signe moins). */
export function signedEur(n: number): string {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}${EUR.format(Math.abs(n))}`;
}

/** ratio 0.037 → "+3,7 %". */
export function signedPct(ratio: number): string {
  const sign = ratio >= 0 ? "+" : "−";
  return `${sign}${(Math.abs(ratio) * 100).toFixed(1).replace(".", ",")} %`;
}

/** ISO UTC → "01/07/2026 21:35" (Europe/Paris). */
export function dateTime(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : DT.format(d);
}

/** ISO UTC → clé de mois "2026-07" (basée sur le fuseau Europe/Paris). */
export function parisMonthKey(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    timeZone: "Europe/Paris",
  }).formatToParts(new Date(iso));
  const y = parts.find((p) => p.type === "year")?.value ?? "0000";
  const m = parts.find((p) => p.type === "month")?.value ?? "00";
  return `${y}-${m}`;
}

/** ISO UTC → "juillet 2026" (Europe/Paris), avec majuscule initiale. */
export function parisMonthLabel(iso: string): string {
  const s = MONTH.format(new Date(iso));
  return s.charAt(0).toUpperCase() + s.slice(1);
}
