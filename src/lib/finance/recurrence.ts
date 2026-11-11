import type { RecurringRule, Transaction } from "./types";

function clampDay(year: number, monthIndex0: number, day: number): number {
  const daysInMonth = new Date(Date.UTC(year, monthIndex0 + 1, 0)).getUTCDate();
  return Math.min(day, daysInMonth);
}

function isoDateForMonth(year: number, monthIndex0: number, day: number): string {
  const clampedDay = clampDay(year, monthIndex0, day);
  return new Date(Date.UTC(year, monthIndex0, clampedDay)).toISOString().slice(0, 10);
}

function yearMonth(isoDate: string): string {
  return isoDate.slice(0, 7);
}

/**
 * Generates the missing occurrences of a recurring rule between its start date
 * and `horizonDate` (inclusive), skipping months that already have a
 * transaction linked to this rule so the history is never duplicated.
 */
/**
 * Same rule + same date = same id, so two logins (or two tabs) generating the
 * same month at once write one transaction instead of a duplicate.
 */
export function recurrenceOccurrenceId(ruleId: string, date: string): string {
  return `${ruleId.slice(0, -8)}${date.replaceAll("-", "")}`;
}

export function generateMissingOccurrences(
  rule: RecurringRule,
  existingTransactions: Transaction[],
  horizonDate: string,
  makeId: (date: string) => string,
  nowISO: string
): Transaction[] {
  if (!rule.active) return [];

  const existingMonths = new Set(
    existingTransactions
      .filter((t) => t.relations?.recurrenceId === rule.id)
      .map((t) => yearMonth(t.date))
  );

  const [startYear, startMonth] = rule.startDate.split("-").map(Number);
  const endBoundary = rule.endDate && rule.endDate < horizonDate ? rule.endDate : horizonDate;
  const [endYear, endMonth] = endBoundary.split("-").map(Number);

  const generated: Transaction[] = [];
  let year = startYear;
  let monthIndex0 = startMonth - 1; // 0-based

  while (year < endYear || (year === endYear && monthIndex0 <= endMonth - 1)) {
    const date = isoDateForMonth(year, monthIndex0, rule.dayOfMonth);
    const monthKey = yearMonth(date);

    if (date <= horizonDate && !existingMonths.has(monthKey)) {
      generated.push({
        id: makeId(date),
        type: rule.type,
        amount: rule.amount,
        date,
        dueDate: date,
        category: rule.category,
        description: rule.description,
        paymentSource: rule.paymentSource,
        status: "pendente",
        createdAt: nowISO,
        updatedAt: nowISO,
        edited: false,
        relations: { recurrenceId: rule.id },
      });
    }

    monthIndex0 += 1;
    if (monthIndex0 > 11) {
      monthIndex0 = 0;
      year += 1;
    }
  }

  return generated;
}
