import { describe, expect, it } from "vitest";
import { summarizeSales } from "./summary";
import { makeSale, makeSaleItem } from "./test-helpers";
import type { SalePaymentStatus } from "./payment";
import type { Sale } from "./types";
import type { Product } from "@/lib/catalog/types";
import type { PeriodRange } from "@/lib/reports/period-range";

const october: PeriodRange = { start: "2026-10-01", end: "2026-10-31", label: "Este mês" };

const product: Product = {
  id: "p1",
  name: "Camiseta",
  status: "ativo",
  price: 14200,
  costComponents: [{ id: "c1", category: "produto_pod", amount: 4500 }],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const getProduct = (id: string) => (id === "p1" ? product : undefined);

function sale(id: string, date: string, total: number): Sale {
  return makeSale({ id, date, totalAmount: total, items: [makeSaleItem({ productId: "p1", quantity: 1, unitPrice: total })] });
}

function statusFrom(map: Record<string, SalePaymentStatus>) {
  return (s: Sale) => map[s.id] ?? "pago";
}

describe("summarizeSales", () => {
  it("sem vendas: tudo zerado, sem dividir por zero", () => {
    const summary = summarizeSales([], () => "pago", getProduct, october);
    expect(summary).toEqual({ count: 0, revenue: 0, averageTicket: 0, profit: 0, receivable: 0, receivableCount: 0 });
  });

  it("conta só as vendas do período, e ticket médio = receita ÷ nº de vendas", () => {
    const sales = [sale("a", "2026-10-05", 14200), sale("b", "2026-10-20", 28400), sale("fora", "2026-09-30", 99999)];
    const summary = summarizeSales(sales, () => "pago", getProduct, october);
    expect(summary.count).toBe(2);
    expect(summary.revenue).toBe(14200 + 28400);
    expect(summary.averageTicket).toBe(21300);
    expect(summary.profit).toBe(14200 - 4500 + (28400 - 4500));
  });

  it("os limites do período são inclusivos", () => {
    const sales = [sale("ini", "2026-10-01", 10000), sale("fim", "2026-10-31", 10000)];
    expect(summarizeSales(sales, () => "pago", getProduct, october).count).toBe(2);
  });

  it("venda pendente conta como venda do mês e também como a receber", () => {
    const sales = [sale("paga", "2026-10-05", 10000), sale("pend", "2026-10-06", 5000)];
    const summary = summarizeSales(sales, statusFrom({ pend: "pendente" }), getProduct, october);
    expect(summary.count).toBe(2);
    expect(summary.revenue).toBe(15000);
    expect(summary.receivable).toBe(5000);
    expect(summary.receivableCount).toBe(1);
  });

  it("a receber olha TODAS as pendentes, mesmo de meses anteriores — dívida de cliente não vence ao virar o mês", () => {
    const sales = [sale("velha", "2026-08-10", 7000), sale("nova", "2026-10-10", 3000)];
    const summary = summarizeSales(sales, () => "pendente", getProduct, october);
    expect(summary.receivable).toBe(10000);
    expect(summary.receivableCount).toBe(2);
    expect(summary.count).toBe(1); // só a de outubro é "venda do mês"
  });

  it("vendas canceladas ou sem lançamento não entram em nada", () => {
    const sales = [sale("ok", "2026-10-05", 10000), sale("canc", "2026-10-06", 50000), sale("sem", "2026-10-07", 60000)];
    const summary = summarizeSales(sales, statusFrom({ canc: "cancelado", sem: "sem_lancamento" }), getProduct, october);
    expect(summary.count).toBe(1);
    expect(summary.revenue).toBe(10000);
    expect(summary.receivable).toBe(0);
  });

  it("média arredondada para o centavo", () => {
    const sales = [sale("a", "2026-10-01", 10000), sale("b", "2026-10-02", 10000), sale("c", "2026-10-03", 10001)];
    expect(summarizeSales(sales, () => "pago", getProduct, october).averageTicket).toBe(10000); // 30001 / 3 = 10000,33
  });
});
