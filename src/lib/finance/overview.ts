// Visão geral do Financeiro numa página só (redesign 2026-11): o período que
// a tela inteira segue (Tudo / um ano / um mês), a série do gráfico de fluxo
// e as despesas por categoria. Puro — recebe transações, devolve números.
// Os cálculos de caixa e resultado continuam em calculations.ts; aqui só se
// escolhe o recorte e se agrupa.

import type { Category, Transaction } from "./types";
import { calculateCaixa, calculateCashFlow, type Period } from "./calculations";
import { formatMonthLabel, monthBounds } from "./period";

export type FinancePeriodSelection = { kind: "tudo" } | { kind: "ano"; year: string } | { kind: "mes"; monthId: string };

export type ResolvedFinancePeriod = {
  /** Recorte para os cálculos; vazio = sem limite (desde o início). */
  period: Period;
  label: string;
  /** Mês usado pelas partes que só existem por mês (planejamento, fechamento). */
  monthId: string;
  /** Mesmo tamanho, logo antes — para a variação. Undefined em "tudo". */
  previous?: Period;
};

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

export function resolveFinancePeriod(selection: FinancePeriodSelection, todayISO: string): ResolvedFinancePeriod {
  const currentMonth = todayISO.slice(0, 7);
  switch (selection.kind) {
    case "tudo":
      return { period: {}, label: "Desde o início", monthId: currentMonth };
    case "ano": {
      const year = Number(selection.year);
      return {
        period: { start: `${year}-01-01`, end: `${year}-12-31` },
        label: String(year),
        // Ano corrente: o mês de hoje; ano passado: dezembro dele.
        monthId: String(year) === todayISO.slice(0, 4) ? currentMonth : `${year}-12`,
        previous: { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` },
      };
    }
    case "mes": {
      const [y, m] = selection.monthId.split("-").map(Number);
      const prev = new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 7);
      return {
        period: monthBounds(selection.monthId),
        label: formatMonthLabel(selection.monthId),
        monthId: selection.monthId,
        previous: monthBounds(prev),
      };
    }
  }
}

/** Meses com dado, do mais recente ao mais antigo, sempre incluindo o mês de hoje. */
export function availableMonthIds(transactions: Transaction[], todayISO: string): string[] {
  const current = todayISO.slice(0, 7);
  const earliest = transactions.reduce((min, t) => (t.date.slice(0, 7) < min ? t.date.slice(0, 7) : min), current);
  const out: string[] = [];
  let [y, m] = current.split("-").map(Number);
  for (;;) {
    const id = `${y}-${String(m).padStart(2, "0")}`;
    out.push(id);
    if (id <= earliest) break;
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  return out;
}

export function availableYears(transactions: Transaction[], todayISO: string): string[] {
  return [...new Set(availableMonthIds(transactions, todayISO).map((id) => id.slice(0, 4)))];
}

export type CashflowPoint = {
  key: string;
  label: string;
  entradas: number;
  saidas: number;
  /** entradas − saídas do intervalo. */
  saldo: number;
  /** Caixa acumulado no fim do intervalo (todas as transações realizadas até ali). */
  caixa: number;
};

function lastDayOfMonth(monthId: string): string {
  return monthBounds(monthId).end;
}

/**
 * Fluxo de caixa realizado agrupado para o gráfico: por mês quando o recorte
 * passa de um mês (ano, tudo), por semana do mês (1–7, 8–14...) quando é um
 * mês só. Mesmas regras de calculateCashFlow (aporte entra, retirada sai).
 */
export function buildCashflowSeries(transactions: Transaction[], selection: FinancePeriodSelection, todayISO: string): CashflowPoint[] {
  const point = (key: string, label: string, start: string, end: string): CashflowPoint => {
    const flow = calculateCashFlow(transactions, { start, end }, 0);
    return { key, label, entradas: flow.entradas, saidas: flow.saidas, saldo: flow.entradas - flow.saidas, caixa: calculateCaixa(transactions, { end }) };
  };

  if (selection.kind === "mes") {
    const { start, end } = monthBounds(selection.monthId);
    const lastDay = Number(end.slice(8, 10));
    const points: CashflowPoint[] = [];
    for (let day = 1; day <= lastDay; day += 7) {
      const to = Math.min(day + 6, lastDay);
      const s = `${start.slice(0, 8)}${String(day).padStart(2, "0")}`;
      const e = `${start.slice(0, 8)}${String(to).padStart(2, "0")}`;
      points.push(point(s, `${day}–${to}`, s, e));
    }
    return points;
  }

  let monthIds = availableMonthIds(transactions, todayISO).reverse();
  if (selection.kind === "ano") {
    const lastMonth = selection.year === todayISO.slice(0, 4) ? todayISO.slice(5, 7) : "12";
    monthIds = Array.from({ length: Number(lastMonth) }, (_, i) => `${selection.year}-${String(i + 1).padStart(2, "0")}`);
  }
  const spansYears = new Set(monthIds.map((id) => id.slice(0, 4))).size > 1;
  return monthIds.map((id) => {
    const month = SHORT_MONTHS[Number(id.slice(5, 7)) - 1];
    return point(id, spansYears ? `${month}/${id.slice(2, 4)}` : month, `${id}-01`, lastDayOfMonth(id));
  });
}

export type CategoryTotal = { categoryId: string; label: string; amount: number; percent: number };

/** Despesas (competência, sem canceladas) por categoria, maior primeiro. */
export function expensesByCategory(transactions: Transaction[], period: Period, categories: Category[]): CategoryTotal[] {
  const totals = new Map<string, number>();
  for (const t of transactions) {
    if (t.type !== "expense" || t.status === "cancelado") continue;
    if (period.start && t.date < period.start) continue;
    if (period.end && t.date > period.end) continue;
    totals.set(t.category, (totals.get(t.category) ?? 0) + t.amount);
  }
  const total = [...totals.values()].reduce((a, b) => a + b, 0);
  return [...totals.entries()]
    .map(([categoryId, amount]) => ({
      categoryId,
      label: categories.find((c) => c.id === categoryId)?.label ?? categoryId,
      amount,
      percent: total > 0 ? (amount / total) * 100 : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}
