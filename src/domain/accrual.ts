/**
 * Ferie- og flekstidsberegning.
 *
 * Ferie: samtidighedsferie efter ferieloven (LBK nr. 152 af 20/02/2024) —
 * 2,08 feriedage pr. måneds ansættelse (§5, stk. 1), 0,07 dage pr. dags
 * ansættelse for perioder kortere end en måned, dog højst 2,08. Et fuldt
 * ferieår (1/9–31/8) giver 25 dage (§4), så 12 fulde måneder afrundes op
 * fra 24,96 til 25.
 *
 * Flekstid: der findes ingen lovbestemt overarbejdsregel i Danmark — sats og
 * afspadsering afhænger af overenskomst/kontrakt. Appen beregner derfor en
 * neutral flekssaldo: præsteret tid minus norm (37 t/uge som standard,
 * konfigurerbar), fordelt som norm/5 på hverdage. Weekendarbejde tæller
 * fuldt som plus. Dage uden registrering påvirker ikke saldoen.
 */

export type ISODate = string; // 'YYYY-MM-DD'

export type EntryType = 'work' | 'vacation' | 'feriefridag' | 'sick' | 'holiday';

export interface DayEntry {
  date: ISODate;
  type: EntryType;
  workedMinutes: number; // 0 for alt andet end 'work'
}

const DAYS_PER_MONTH = 2.08;
const DAYS_PER_DAY = 0.07;
const FULL_YEAR_DAYS = 25;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUTC(date: ISODate): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toISO(date: Date): ISODate {
  return date.toISOString().slice(0, 10);
}

/** Måneder lagt til med clamp til månedens sidste dag (31/1 + 1 md = 28/2). */
export function addMonths(date: ISODate, months: number): ISODate {
  const d = toUTC(date);
  const targetMonth = d.getUTCMonth() + months;
  const result = new Date(Date.UTC(d.getUTCFullYear(), targetMonth, 1));
  const daysInTarget = new Date(
    Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0),
  ).getUTCDate();
  result.setUTCDate(Math.min(d.getUTCDate(), daysInTarget));
  return toISO(result);
}

/** Antal kalenderdage fra `from` til `to`, begge inklusive. */
export function daysInclusive(from: ISODate, to: ISODate): number {
  return Math.round((toUTC(to).getTime() - toUTC(from).getTime()) / MS_PER_DAY) + 1;
}

/** Ferieårets start (1/9) for det ferieår, der indeholder `date`. */
export function ferieYearStart(date: ISODate): ISODate {
  const d = toUTC(date);
  const year = d.getUTCMonth() >= 8 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  return `${year}-09-01`;
}

/** Ferieårets slutning (31/8) for det ferieår, der indeholder `date`. */
export function ferieYearEnd(date: ISODate): ISODate {
  const start = toUTC(ferieYearStart(date));
  return `${start.getUTCFullYear() + 1}-08-31`;
}

/**
 * Optjente feriedage i det ferieår, der indeholder `asOf`.
 *
 * Optjening løber fra den seneste af ansættelsesdato og ferieårets start:
 * 2,08 dage pr. fuldendt ansættelsesmåned plus 0,07 pr. dag i en påbegyndt
 * måned (dog højst 2,08). 12 fuldendte måneder = 25 dage. Bemærk: dage kan
 * afholdes fra måneden efter, de er optjent — det viser saldoen ikke.
 */
export function vacationDaysEarned(employmentStart: ISODate, asOf: ISODate): number {
  const anchor =
    employmentStart > ferieYearStart(asOf) ? employmentStart : ferieYearStart(asOf);
  if (anchor > asOf) return 0;

  // En ansættelsesmåned er fuldendt, når dens sidste dag (dagen før næste
  // månedsdag) er nået: fx 15/6-ansat har fuldendt første måned den 14/7.
  let fullMonths = 0;
  while (fullMonths < 12) {
    const nextAnniversary = toUTC(addMonths(anchor, fullMonths + 1));
    const lastDayOfMonth = toISO(new Date(nextAnniversary.getTime() - MS_PER_DAY));
    if (lastDayOfMonth <= asOf) fullMonths += 1;
    else break;
  }
  if (fullMonths >= 12) return FULL_YEAR_DAYS;

  const partialStart = addMonths(anchor, fullMonths);
  const partialDays = partialStart <= asOf ? daysInclusive(partialStart, asOf) : 0;
  const partial = Math.min(partialDays * DAYS_PER_DAY, DAYS_PER_MONTH);

  return Math.round((fullMonths * DAYS_PER_MONTH + partial) * 100) / 100;
}

/** Afholdte dage af en given type i vinduet [from, to] (begge inklusive). */
export function daysTaken(
  entries: DayEntry[],
  type: EntryType,
  from: ISODate,
  to: ISODate,
): number {
  const dates = new Set(
    entries.filter((e) => e.type === type && e.date >= from && e.date <= to).map((e) => e.date),
  );
  return dates.size;
}

/** Præsterede minutter ud fra start/slut/pause; håndterer vagter over midnat. */
export function workedMinutes(
  startMinutes: number,
  endMinutes: number,
  breakMinutes: number,
): number {
  const span = endMinutes >= startMinutes ? endMinutes - startMinutes : endMinutes + 24 * 60 - startMinutes;
  return Math.max(0, span - breakMinutes);
}

/**
 * Flekssaldo i minutter: sum over datoer med arbejdsregistrering af
 * (præsteret − dagsnorm), hvor dagsnorm = ugenorm/5 på hverdage og 0 i
 * weekender. Fravær (ferie, sygdom m.v.) og dage uden registrering
 * påvirker ikke saldoen.
 */
export function flexBalanceMinutes(entries: DayEntry[], weeklyNormMinutes: number): number {
  const dailyNorm = weeklyNormMinutes / 5;
  const byDate = new Map<ISODate, number>();
  for (const e of entries) {
    if (e.type !== 'work') continue;
    byDate.set(e.date, (byDate.get(e.date) ?? 0) + e.workedMinutes);
  }
  let balance = 0;
  for (const [date, worked] of byDate) {
    const weekday = toUTC(date).getUTCDay(); // 0 = søndag, 6 = lørdag
    const norm = weekday === 0 || weekday === 6 ? 0 : dailyNorm;
    balance += worked - norm;
  }
  return Math.round(balance);
}
