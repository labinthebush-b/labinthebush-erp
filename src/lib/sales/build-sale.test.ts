import { describe, expect, it } from "vitest";
import { buildSaleRecords, type SaleRecordsInput } from "./build-sale";
import { buildSaleItem } from "./calculations";
import { resolveProduct } from "@/lib/ai/tools/actions";
import type { Product } from "@/lib/catalog/types";

let n = 0;
const makeId = () => `id-${++n}`;
const NOW = "2026-10-14T12:00:00.000Z";

function input(overrides: Partial<SaleRecordsInput> = {}): SaleRecordsInput {
  return {
    date: "2026-10-14",
    items: [buildSaleItem({ id: "i1", productId: "p1", size: "M", color: "Preto", quantity: 2, unitPrice: 14200 })],
    discounts: [],
    shippingCost: 0,
    channel: "instagram",
    payment: "pago",
    ...overrides,
  };
}

function build(over: Partial<SaleRecordsInput> = {}, opts: { fee?: number; tracked?: boolean } = {}) {
  return buildSaleRecords({
    input: input(over),
    saleId: "s1",
    now: NOW,
    nuvemshopFeePercent: opts.fee ?? 0,
    productName: () => "NREM",
    isTracked: () => opts.tracked ?? false,
    makeId,
  });
}

describe("buildSaleRecords", () => {
  it("venda simples: uma receita concluída, ligada à venda, com o total certo", () => {
    const { sale, transactions, movements } = build();
    expect(sale).toMatchObject({ id: "s1", totalAmount: 28400, channel: "instagram", transactionId: transactions[0].id });
    expect(transactions).toHaveLength(1);
    expect(transactions[0]).toMatchObject({ type: "income", amount: 28400, status: "concluido", category: "venda", relations: { saleId: "s1" } });
    expect(movements).toEqual([]);
  });

  it("pendente vira 'a receber' no Financeiro", () => {
    const { transactions } = build({ payment: "pendente" });
    expect(transactions[0]).toMatchObject({ status: "pendente", dueDate: "2026-10-14" });
  });

  it("frete e taxa Nuvemshop viram despesas próprias ligadas à venda", () => {
    const { sale, transactions } = build({ channel: "nuvemshop", shippingCost: 2000 }, { fee: 5 });
    const shipping = transactions.find((t) => t.category === "frete");
    const fee = transactions.find((t) => t.category === "taxas");
    expect(shipping).toMatchObject({ type: "expense", amount: 2000, relations: { saleId: "s1" } });
    expect(fee).toMatchObject({ type: "expense", relations: { saleId: "s1" } });
    expect(sale.shippingTransactionId).toBe(shipping?.id);
    expect(sale.nuvemshopFeeTransactionId).toBe(fee?.id);
    // total = 28400 + frete cobrado 2000 = 30400; taxa = 5% disso
    expect(sale.totalAmount).toBe(30400);
    expect(fee?.amount).toBe(1520);
  });

  it("produto com estoque controlado: gera a saída de estoque do item", () => {
    const { movements } = build({}, { tracked: true });
    expect(movements).toHaveLength(1);
    expect(movements[0]).toMatchObject({ productId: "p1", size: "M", color: "Preto", quantity: -2, kind: "saida", saleId: "s1", saleItemId: "i1" });
  });

  it("produto sem controle de estoque não gera saída", () => {
    expect(build({}, { tracked: false }).movements).toEqual([]);
  });
});

describe("resolveProduct (IA indicando produto por nome)", () => {
  const p = (id: string, name: string): Product => ({ id, name, status: "ativo", costComponents: [], createdAt: NOW, updatedAt: NOW });
  const products = [p("1", "NREM — camiseta"), p("2", "Komodo — camiseta"), p("3", "Komodo — moletom")];

  it("acha por id ou por nome exato/parcial único, sem diferenciar maiúsculas", () => {
    expect(resolveProduct(products, { productId: "2" }).id).toBe("2");
    expect(resolveProduct(products, { productName: "nrem" }).id).toBe("1");
    expect(resolveProduct(products, { productName: "KOMODO — MOLETOM" }).id).toBe("3");
  });

  it("nome ambíguo ou inexistente é erro explícito, nunca um chute", () => {
    expect(() => resolveProduct(products, { productName: "komodo" })).toThrow(/Mais de um produto/);
    expect(() => resolveProduct(products, { productName: "inexistente" })).toThrow(/Nenhum produto/);
    expect(() => resolveProduct(products, { productId: "999" })).toThrow(/não encontrado/);
    expect(() => resolveProduct(products, {})).toThrow(/productId ou productName/);
  });
});
