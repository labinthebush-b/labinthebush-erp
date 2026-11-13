import { describe, expect, it } from "vitest";
import { availableMonthIds, availableYears, buildCashflowSeries, expensesByCategory, resolveFinancePeriod } from "./overview";
import { makeTransaction } from "./test-helpers";
import { DEFAULT_CATEGORIES } from "./categories";

const TODAY = "2026-11-13";

describe("resolveFinancePeriod", () => {
  it("tudo: sem limite, mês de hoje para planejamento, sem comparação", () => {
    const r = resolveFinancePeriod({ kind: "tudo" }, TODAY);
    expect(r.period).toEqual({});
    expect(r.monthId).toBe("2026-11");
    expect(r.previous).toBeUndefined();
    expect(r.label).toBe("Desde o início");
  });

  it("um mês: limites do mês e o mês anterior para comparar (virando o ano)", () => {
    const r = resolveFinancePeriod({ kind: "mes", monthId: "2026-01" }, TODAY);
    expect(r.period).toEqual({ start: "2026-01-01", end: "2026-01-31" });
    expect(r.previous).toEqual({ start: "2025-12-01", end: "2025-12-31" });
    expect(r.monthId).toBe("2026-01");
    expect(r.label).toBe("Janeiro de 2026");
  });

  it("ano corrente usa o mês de hoje; ano passado usa dezembro", () => {
    expect(resolveFinancePeriod({ kind: "ano", year: "2026" }, TODAY).monthId).toBe("2026-11");
    const past = resolveFinancePeriod({ kind: "ano", year: "2025" }, TODAY);
    expect(past.monthId).toBe("2025-12");
    expect(past.period).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(past.previous).toEqual({ start: "2024-01-01", end: "2024-12-31" });
  });
});

describe("availableMonthIds / availableYears", () => {
  it("do mês de hoje até o mês mais antigo com dado, atravessando o ano", () => {
    const txs = [makeTransaction({ date: "2025-11-20" }), makeTransaction({ date: "2026-03-02" })];
    const ids = availableMonthIds(txs, TODAY);
    expect(ids[0]).toBe("2026-11");
    expect(ids.at(-1)).toBe("2025-11");
    expect(ids).toHaveLength(13);
    expect(availableYears(txs, TODAY)).toEqual(["2026", "2025"]);
  });

  it("sem transações: só o mês de hoje (nunca lista vazia)", () => {
    expect(availableMonthIds([], TODAY)).toEqual(["2026-11"]);
  });

  it("dado no futuro não estica a lista para trás", () => {
    expect(availableMonthIds([makeTransaction({ date: "2027-02-01" })], TODAY)).toEqual(["2026-11"]);
  });
});

describe("buildCashflowSeries", () => {
  const txs = [
    makeTransaction({ type: "income", amount: 10000, date: "2026-09-05" }),
    makeTransaction({ type: "expense", amount: 3000, date: "2026-09-20" }),
    makeTransaction({ type: "owner_contribution", amount: 5000, date: "2026-10-01", category: "aporte" }),
    makeTransaction({ type: "expense", amount: 2000, date: "2026-11-03" }),
    makeTransaction({ type: "income", amount: 9999, date: "2026-11-04", status: "pendente" }),
    makeTransaction({ type: "expense", amount: 500, date: "2026-11-10", status: "cancelado" }),
  ];

  it("tudo: um ponto por mês desde o primeiro dado, com caixa acumulado", () => {
    const series = buildCashflowSeries(txs, { kind: "tudo" }, TODAY);
    expect(series.map((p) => p.key)).toEqual(["2026-09", "2026-10", "2026-11"]);
    expect(series.map((p) => p.label)).toEqual(["set", "out", "nov"]);
    expect(series[0]).toMatchObject({ entradas: 10000, saidas: 3000, saldo: 7000, caixa: 7000 });
    expect(series[1]).toMatchObject({ entradas: 5000, saidas: 0, caixa: 12000 }); // aporte entra no caixa
    expect(series[2]).toMatchObject({ entradas: 0, saidas: 2000, caixa: 10000 }); // pendente e cancelado fora
  });

  it("um mês: semanas 1–7, 8–14... até o último dia do mês", () => {
    const series = buildCashflowSeries(txs, { kind: "mes", monthId: "2026-11" }, TODAY);
    expect(series.map((p) => p.label)).toEqual(["1–7", "8–14", "15–21", "22–28", "29–30"]);
    expect(series[0].saidas).toBe(2000);
    expect(series[4].caixa).toBe(10000);
  });

  it("ano corrente vai de janeiro até o mês de hoje; anos diferentes ganham sufixo", () => {
    const year = buildCashflowSeries(txs, { kind: "ano", year: "2026" }, TODAY);
    expect(year).toHaveLength(11);
    expect(year[0].key).toBe("2026-01");
    const spanning = buildCashflowSeries([makeTransaction({ date: "2025-12-10" })], { kind: "tudo" }, TODAY);
    expect(spanning[0].label).toBe("dez/25");
  });
});

describe("expensesByCategory", () => {
  it("só despesas não canceladas no período, maior primeiro, com %", () => {
    const txs = [
      makeTransaction({ type: "expense", category: "frete", amount: 3000, date: "2026-11-02" }),
      makeTransaction({ type: "expense", category: "marketing", amount: 1000, date: "2026-11-03" }),
      makeTransaction({ type: "expense", category: "frete", amount: 999, date: "2026-11-04", status: "cancelado" }),
      makeTransaction({ type: "income", category: "vendas", amount: 50000, date: "2026-11-05" }),
      makeTransaction({ type: "expense", category: "marketing", amount: 7777, date: "2026-10-30" }),
    ];
    const rows = expensesByCategory(txs, { start: "2026-11-01", end: "2026-11-30" }, DEFAULT_CATEGORIES);
    expect(rows.map((r) => [r.categoryId, r.amount, r.percent])).toEqual([
      ["frete", 3000, 75],
      ["marketing", 1000, 25],
    ]);
  });

  it("categoria desconhecida mostra o id em vez de sumir", () => {
    const rows = expensesByCategory([makeTransaction({ type: "expense", category: "xyz" })], {}, DEFAULT_CATEGORIES);
    expect(rows[0].label).toBe("xyz");
  });
});
