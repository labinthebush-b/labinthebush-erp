import { describe, expect, it } from "vitest";
import {
  buildCaixaKpi,
  buildVendasKpi,
  buildLucroKpi,
  buildDespesasKpi,
  buildTarefasKpi,
  buildWeeklyCashFlowSeries,
  buildSalesTrendSeries,
} from "./calculations";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { makeTransaction } from "@/lib/finance/test-helpers";
import { makeSale } from "@/lib/sales/test-helpers";
import type { Product } from "@/lib/catalog/types";
import type { Task } from "@/lib/tasks/types";

const range = { start: "2026-09-01", end: "2026-09-30", label: "" };
const TODAY = "2026-09-15";

describe("buildCaixaKpi", () => {
  it("separa saldo atual (geral) de entradas/saídas do período", () => {
    const transactions = [
      makeTransaction({ type: "income", amount: 10000, status: "concluido", date: "2026-08-01" }),
      makeTransaction({ type: "income", amount: 5000, status: "concluido", date: "2026-09-10" }),
      makeTransaction({ type: "expense", amount: 2000, status: "concluido", date: "2026-09-11" }),
    ];
    const kpi = buildCaixaKpi(transactions, range);
    expect(kpi.saldoAtual).toBe(10000 + 5000 - 2000);
    expect(kpi.entradas).toBe(5000);
    expect(kpi.saidas).toBe(2000);
  });
});

describe("buildLucroKpi", () => {
  it("nunca deixa aporte/retirada contaminar o lucro (regra crítica do Financeiro)", () => {
    const transactions = [
      makeTransaction({ type: "income", amount: 10000, category: "venda", date: "2026-09-05" }),
      makeTransaction({ type: "owner_contribution", amount: 50000, category: "aporte", date: "2026-09-05" }),
      makeTransaction({ type: "owner_withdrawal", amount: 20000, category: "retirada", date: "2026-09-05" }),
    ];
    const kpi = buildLucroKpi(transactions, DEFAULT_CATEGORIES, range);
    expect(kpi.receita).toBe(10000);
    expect(kpi.lucroLiquido).toBe(10000);
  });

  it("calcula margem sobre a receita", () => {
    const transactions = [
      makeTransaction({ type: "income", amount: 10000, category: "venda", date: "2026-09-05" }),
      makeTransaction({ type: "expense", amount: 4000, category: "produto_pod", date: "2026-09-05" }),
    ];
    const kpi = buildLucroKpi(transactions, DEFAULT_CATEGORIES, range);
    expect(kpi.margemPercent).toBeCloseTo(60, 5);
  });
});

describe("buildDespesasKpi", () => {
  it("calcula total, pendentes e vencidas", () => {
    const transactions = [
      makeTransaction({ type: "expense", amount: 1000, status: "concluido", date: "2026-09-05" }),
      makeTransaction({ type: "expense", amount: 2000, status: "pendente", dueDate: "2026-09-20", date: "2026-09-05" }),
      makeTransaction({ type: "expense", amount: 3000, status: "pendente", dueDate: "2026-09-01", date: "2026-09-01" }),
    ];
    const kpi = buildDespesasKpi(transactions, DEFAULT_CATEGORIES, range, TODAY);
    expect(kpi.total).toBe(6000);
    expect(kpi.pendentes).toBe(5000);
    expect(kpi.vencidas).toBe(3000);
  });
});

describe("buildVendasKpi", () => {
  const products: Product[] = [{ id: "p1", name: "Camiseta", status: "ativo", costComponents: [], createdAt: "", updatedAt: "" }];

  it("calcula variação percentual quando há dados no período anterior", () => {
    const sales = [makeSale({ date: "2026-09-10", totalAmount: 20000 }), makeSale({ date: "2026-08-10", totalAmount: 10000 })];
    const kpi = buildVendasKpi(sales, products, [], range);
    expect(kpi.faturamento).toBe(20000);
    expect(kpi.variacaoFaturamentoPercent).toBeCloseTo(100, 5);
  });

  it("omite a variação quando não há dados suficientes no período anterior", () => {
    const sales = [makeSale({ date: "2026-09-10" })];
    const kpi = buildVendasKpi(sales, products, [], range);
    expect(kpi.variacaoFaturamentoPercent).toBeUndefined();
  });
});

describe("buildTarefasKpi", () => {
  function makeTask(overrides: Partial<Task>): Task {
    return {
      id: `t-${Math.random()}`,
      title: "Tarefa",
      status: "a_fazer",
      createdAt: "",
      updatedAt: "",
      ...overrides,
    };
  }

  it("separa hoje, atrasadas, próximas e concluídas", () => {
    const tasks = [
      makeTask({ dueDate: TODAY }),
      makeTask({ dueDate: "2026-09-10" }), // atrasada
      makeTask({ dueDate: "2026-09-18" }), // próxima (esta semana)
      makeTask({ status: "concluido" }),
    ];
    const kpi = buildTarefasKpi(tasks, TODAY);
    expect(kpi.hoje).toBe(1);
    expect(kpi.atrasadas).toBe(1);
    expect(kpi.proximas).toBe(1);
    expect(kpi.concluidas).toBe(1);
  });
});

describe("buildWeeklyCashFlowSeries", () => {
  it("soma só entradas realizadas (receita/aporte) de cada dia", () => {
    const transactions = [
      makeTransaction({ type: "income", amount: 1000, status: "concluido", date: TODAY }),
      makeTransaction({ type: "owner_contribution", amount: 500, status: "concluido", date: TODAY }),
      makeTransaction({ type: "expense", amount: 300, status: "concluido", date: TODAY }),
      makeTransaction({ type: "income", amount: 999, status: "pendente", date: TODAY }),
    ];
    const series = buildWeeklyCashFlowSeries(transactions, TODAY, 1);
    expect(series).toHaveLength(1);
    expect(series[0].value).toBe(1500);
  });
});

describe("buildSalesTrendSeries", () => {
  it("conta vendas por dia no período pedido", () => {
    const sales = [makeSale({ id: "s1", date: TODAY, totalAmount: 100 })];
    const series = buildSalesTrendSeries(sales, TODAY, 3);
    expect(series).toEqual([0, 0, 1]);
  });
});
