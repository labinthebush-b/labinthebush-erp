import { describe, expect, it } from "vitest";
import { buildSalesReport } from "./sales-report";
import { makeSale, makeSaleItem } from "@/lib/sales/test-helpers";
import type { Product } from "@/lib/catalog/types";
import type { Contact } from "@/lib/contacts/types";

const range = { start: "2026-09-01", end: "2026-09-30", label: "" };

const products: Product[] = [
  { id: "p1", name: "Camiseta", status: "ativo", costComponents: [], createdAt: "", updatedAt: "" },
];
const contacts: Contact[] = [
  { id: "c1", name: "Ana", status: "cliente", customFields: [], createdAt: "", updatedAt: "" },
];

describe("buildSalesReport", () => {
  it("calcula faturamento, quantidade e ticket médio do período", () => {
    const sales = [makeSale({ totalAmount: 10000 }), makeSale({ totalAmount: 20000 })];
    const report = buildSalesReport(sales, products, contacts, range);
    expect(report.faturamento).toBe(30000);
    expect(report.quantidade).toBe(2);
    expect(report.ticketMedio).toBe(15000);
  });

  it("ignora vendas fora do período", () => {
    const sales = [makeSale({ date: "2026-08-15", totalAmount: 5000 })];
    const report = buildSalesReport(sales, products, contacts, range);
    expect(report.quantidade).toBe(0);
    expect(report.faturamento).toBe(0);
  });

  it("agrupa por canal, produto, contato e cupom", () => {
    const sales = [
      makeSale({ channel: "instagram", contactId: "c1", discounts: [{ kind: "percentual", percent: 10, code: "PROMO10" }], totalAmount: 10000 }),
      makeSale({ channel: "whatsapp", totalAmount: 5000 }),
    ];
    const report = buildSalesReport(sales, products, contacts, range);
    expect(report.porCanal.find((c) => c.canal === "instagram")?.faturamento).toBe(10000);
    expect(report.porProduto[0]).toMatchObject({ productId: "p1", nome: "Camiseta", faturamento: 15000 });
    expect(report.porContato[0]).toMatchObject({ contactId: "c1", nome: "Ana", faturamento: 10000 });
    expect(report.cupons[0]).toMatchObject({ codigo: "PROMO10", usos: 1 });
  });

  it("venda com múltiplos produtos: soma a quantidade de cada produto e reparte a receita", () => {
    const itemA = makeSaleItem({ productId: "p1", quantity: 1, unitPrice: 14800 });
    const itemB = makeSaleItem({ productId: "p1", quantity: 2, unitPrice: 10000 }); // mesmo produto, dois itens (ex.: variação)
    const sale = makeSale({ items: [itemA, itemB], totalAmount: 34800 });
    const report = buildSalesReport([sale], products, contacts, range);
    expect(report.porProduto[0].quantidade).toBe(3);
    expect(report.porProduto[0].faturamento).toBe(34800);
  });
});
