import { describe, expect, it } from "vitest";
import { buildProductsReport, productsBelowMargin } from "./products-report";
import { makeSale, makeSaleItem } from "@/lib/sales/test-helpers";
import type { Product } from "@/lib/catalog/types";

const range = { start: "2026-09-01", end: "2026-09-30", label: "" };

const product: Product = {
  id: "p1",
  name: "Camiseta",
  status: "ativo",
  price: 10000,
  costComponents: [{ id: "c1", category: "produto_pod", amount: 6000 }],
  createdAt: "",
  updatedAt: "",
};
const productB: Product = { id: "p2", name: "Moletom", status: "ativo", price: 15000, costComponents: [{ id: "c2", category: "produto_pod", amount: 9000 }], createdAt: "", updatedAt: "" };

describe("buildProductsReport", () => {
  it("calcula quantidade, faturamento, custo e lucro por produto no período", () => {
    const sales = [makeSale({ items: [makeSaleItem({ productId: "p1", quantity: 2, unitPrice: 10000 })], totalAmount: 20000 })];
    const [row] = buildProductsReport(sales, [product], range);
    expect(row.quantidadeVendida).toBe(2);
    expect(row.faturamento).toBe(20000);
    expect(row.custoTotal).toBe(12000); // 6000 * 2
    expect(row.lucro).toBe(8000);
    expect(row.margemPercent).toBeCloseTo(40, 5);
  });

  it("não inclui produtos sem vendas no período", () => {
    const rows = buildProductsReport([], [product], range);
    expect(rows).toHaveLength(0);
  });

  it("venda com múltiplos produtos: atribui a receita proporcionalmente ao subtotal de cada item", () => {
    const itemA = makeSaleItem({ productId: "p1", quantity: 1, unitPrice: 10000 }); // subtotal 10000
    const itemB = makeSaleItem({ productId: "p2", quantity: 1, unitPrice: 15000 }); // subtotal 15000
    const sales = [makeSale({ items: [itemA, itemB], totalAmount: 25000 })]; // sem desconto/frete: total = subtotal
    const rows = buildProductsReport(sales, [product, productB], range);
    const rowA = rows.find((r) => r.productId === "p1")!;
    const rowB = rows.find((r) => r.productId === "p2")!;
    expect(rowA.faturamento).toBe(10000);
    expect(rowB.faturamento).toBe(15000);
    expect(rowA.faturamento + rowB.faturamento).toBe(25000);
  });
});

describe("productsBelowMargin", () => {
  it("retorna produtos com margem igual ou abaixo do limite", () => {
    const lowMargin: Product = { ...product, id: "p2", price: 6500, costComponents: [{ id: "c", category: "produto_pod", amount: 6000 }] };
    const result = productsBelowMargin([product, lowMargin], 10);
    expect(result.map((p) => p.productId)).toEqual(["p2"]);
  });

  it("ignora produtos sem preço definido", () => {
    const noPrice: Product = { ...product, id: "p3", price: undefined };
    expect(productsBelowMargin([noPrice], 50)).toEqual([]);
  });
});
