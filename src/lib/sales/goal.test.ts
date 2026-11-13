import { describe, expect, it } from "vitest";
import { buildMonthlyRevenue, buildSalesGoalProgress } from "./goal";
import { makeSale } from "./test-helpers";
import type { SalePaymentStatus } from "./payment";
import type { Sale } from "./types";

describe("buildSalesGoalProgress", () => {
  it("mês corrente: % da meta, quanto falta e quanto vender por dia (contando hoje)", () => {
    // Novembro tem 30 dias; dia 13 → restam 18 dias contando hoje.
    const p = buildSalesGoalProgress(300000, 120000, "2026-11", "2026-11-13");
    expect(p.percent).toBe(40);
    expect(p.remaining).toBe(180000);
    expect(p.daysLeft).toBe(18);
    expect(p.perDayNeeded).toBe(10000);
    expect(p.expectedByToday).toBe(130000);
    expect(p.onPace).toBe(false);
  });

  it("bateu a meta: falta zero e passa de 100%", () => {
    const p = buildSalesGoalProgress(100000, 150000, "2026-11", "2026-11-13");
    expect(p.remaining).toBe(0);
    expect(p.perDayNeeded).toBe(0);
    expect(p.percent).toBe(150);
    expect(p.onPace).toBe(true);
  });

  it("mês passado: nenhum dia restante, o que faltou fica como faltou", () => {
    const p = buildSalesGoalProgress(100000, 40000, "2026-10", "2026-11-13");
    expect(p.daysLeft).toBe(0);
    expect(p.perDayNeeded).toBe(60000);
    expect(p.expectedByToday).toBe(100000);
  });

  it("último dia do mês ainda conta como 1 dia", () => {
    expect(buildSalesGoalProgress(100000, 0, "2026-11", "2026-11-30").daysLeft).toBe(1);
  });
});

describe("buildMonthlyRevenue", () => {
  const status = new Map<string, SalePaymentStatus>();
  const sale = (date: string, total: number, st: SalePaymentStatus): Sale => {
    const s = makeSale({ date, totalAmount: total });
    status.set(s.id, st);
    return s;
  };
  const statusOf = (s: Sale) => status.get(s.id) ?? "pago";

  it("um ponto por mês da primeira venda até hoje; canceladas não contam", () => {
    const sales = [sale("2026-09-10", 14990, "pago"), sale("2026-11-02", 14990, "pendente"), sale("2026-11-05", 9999, "cancelado")];
    const series = buildMonthlyRevenue(sales, statusOf, "2026-11-13");
    expect(series.map((p) => [p.label, p.revenue, p.count])).toEqual([
      ["set", 14990, 1],
      ["out", 0, 0],
      ["nov", 14990, 1],
    ]);
  });

  it("sem vendas: só o mês de hoje; limita a quantidade de meses", () => {
    expect(buildMonthlyRevenue([], statusOf, "2026-11-13").map((p) => p.monthId)).toEqual(["2026-11"]);
    const old = [sale("2024-01-10", 100, "pago")];
    const series = buildMonthlyRevenue(old, statusOf, "2026-11-13", 6);
    expect(series).toHaveLength(6);
    expect(series.at(-1)?.monthId).toBe("2026-11");
    expect(series[0].label).toBe("jun");
  });

  it("meses de anos diferentes ganham o ano no rótulo", () => {
    const series = buildMonthlyRevenue([sale("2025-12-01", 100, "pago")], statusOf, "2026-01-05");
    expect(series.map((p) => p.label)).toEqual(["dez/25", "jan/26"]);
  });
});
