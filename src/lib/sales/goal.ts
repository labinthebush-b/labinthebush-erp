// Meta de vendas do mês e série de receita para o gráfico da tela de Vendas.
//
// A meta NÃO é uma estrutura nova: é a meta mensal (CategoryBudget, do
// Planejamento) da categoria de receita "venda" — a mesma categoria em que
// toda venda é lançada no Financeiro (ver lib/sales/calculations.ts).

import type { Sale } from "./types";
import type { SalePaymentStatus } from "./payment";
import { monthBounds } from "@/lib/finance/period";

export const SALES_GOAL_CATEGORY_ID = "venda";

export type SalesGoalProgress = {
  goal: number;
  revenue: number;
  /** 0–100+ (pode passar de 100 quando bate a meta). */
  percent: number;
  /** Quanto falta (0 quando já bateu). */
  remaining: number;
  /** Dias do mês que ainda restam contando hoje (mínimo 1 no mês corrente). */
  daysLeft: number;
  /** Quanto vender por dia, a partir de hoje, para fechar a meta. */
  perDayNeeded: number;
  /** Onde a receita "deveria" estar hoje num ritmo linear. */
  expectedByToday: number;
  onPace: boolean;
};

export function buildSalesGoalProgress(goal: number, revenue: number, monthId: string, todayISO: string): SalesGoalProgress {
  const { end } = monthBounds(monthId);
  const daysInMonth = Number(end.slice(8, 10));
  const isCurrent = todayISO.slice(0, 7) === monthId;
  const isPast = todayISO.slice(0, 7) > monthId;
  const today = Number(todayISO.slice(8, 10));
  const elapsed = isPast ? daysInMonth : isCurrent ? today : 0;
  const daysLeft = isPast ? 0 : isCurrent ? daysInMonth - today + 1 : daysInMonth;
  const remaining = Math.max(0, goal - revenue);
  const expectedByToday = Math.round((goal * elapsed) / daysInMonth);
  return {
    goal,
    revenue,
    percent: goal > 0 ? (revenue / goal) * 100 : 0,
    remaining,
    daysLeft,
    perDayNeeded: daysLeft > 0 ? Math.ceil(remaining / daysLeft) : remaining,
    expectedByToday,
    onPace: revenue >= expectedByToday,
  };
}

export type RevenuePoint = { monthId: string; label: string; revenue: number; count: number };

const SHORT_MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

/**
 * Receita de vendas por mês (só vendas pagas ou a receber — canceladas e sem
 * lançamento não contam, como em summarizeSales), do mês da primeira venda até
 * o mês de hoje, no máximo `maxMonths` meses.
 */
export function buildMonthlyRevenue(
  sales: Sale[],
  statusOf: (sale: Sale) => SalePaymentStatus,
  todayISO: string,
  maxMonths = 12
): RevenuePoint[] {
  const counted = sales.filter((s) => {
    const status = statusOf(s);
    return status === "pago" || status === "pendente";
  });
  const current = todayISO.slice(0, 7);
  const first = counted.reduce((min, s) => (s.date.slice(0, 7) < min ? s.date.slice(0, 7) : min), current);
  const months: string[] = [];
  let [y, m] = current.split("-").map(Number);
  while (months.length < maxMonths) {
    const id = `${y}-${String(m).padStart(2, "0")}`;
    months.unshift(id);
    if (id <= first) break;
    m -= 1;
    if (m === 0) {
      m = 12;
      y -= 1;
    }
  }
  const spansYears = new Set(months.map((id) => id.slice(0, 4))).size > 1;
  return months.map((monthId) => {
    const inMonth = counted.filter((s) => s.date.slice(0, 7) === monthId);
    const month = SHORT_MONTHS[Number(monthId.slice(5, 7)) - 1];
    return {
      monthId,
      label: spansYears ? `${month}/${monthId.slice(2, 4)}` : month,
      revenue: inMonth.reduce((sum, s) => sum + s.totalAmount, 0),
      count: inMonth.length,
    };
  });
}
