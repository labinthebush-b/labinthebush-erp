import { describe, expect, it } from "vitest";
import {
  buildSaleItem,
  calculateSaleCost,
  calculateSaleProfit,
  calculateItemsSubtotal,
  allocateItemRevenue,
  describeSaleItems,
  buildIncomeTransactionInput,
  buildShippingExpenseTransactionInput,
  buildNuvemshopFeeExpenseTransactionInput,
  reconcileShippingExpense,
  reconcileNuvemshopFeeExpense,
  calculateDiscountAmount,
  calculateDiscountsTotal,
  calculateShippingCharged,
  calculateNuvemshopFee,
  validateDiscounts,
  calculateSaleBreakdown,
  aggregateContactHistory,
} from "./calculations";
import { makeSale, makeSaleItem } from "./test-helpers";
import type { Product } from "@/lib/catalog/types";

const product: Product = {
  id: "prod-1",
  name: "Camiseta Oversized Preta",
  status: "ativo",
  price: 12900,
  costComponents: [
    { id: "c1", category: "produto_pod", amount: 4500 },
    { id: "c2", category: "frete", amount: 1200 },
  ],
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
};
const productB: Product = { ...product, id: "prod-2", name: "Moletom Cinza", price: 10000, costComponents: [{ id: "c3", category: "produto_pod", amount: 6000 }] };

const getProduct = (id: string) => [product, productB].find((p) => p.id === id);

describe("buildSaleItem", () => {
  it("subtotal é sempre quantidade × preço unitário", () => {
    const item = buildSaleItem({ productId: "prod-1", quantity: 3, unitPrice: 12900 });
    expect(item.subtotal).toBe(38700);
  });
});

describe("calculateSaleCost", () => {
  it("multiplica o custo unitário do produto pela quantidade", () => {
    expect(calculateSaleCost(product, 3)).toBe((4500 + 1200) * 3);
  });
});

describe("calculateItemsSubtotal", () => {
  it("soma o subtotal de todos os itens", () => {
    const items = [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 14800 }), buildSaleItem({ productId: "prod-2", quantity: 2, unitPrice: 10000 })];
    expect(calculateItemsSubtotal(items)).toBe(14800 + 20000);
  });
});

describe("calculateSaleProfit", () => {
  it("um item: lucro = total pago − custo do produto", () => {
    const sale = makeSale({ items: [buildSaleItem({ productId: "prod-1", quantity: 3, unitPrice: 12900 })], totalAmount: 38700 });
    expect(calculateSaleProfit(sale, getProduct)).toBe(38700 - (4500 + 1200) * 3);
  });

  it("múltiplos itens: soma o custo de todos os produtos da venda", () => {
    const sale = makeSale({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 14800 }), buildSaleItem({ productId: "prod-2", quantity: 2, unitPrice: 10000 })],
      totalAmount: 34800,
    });
    const custoEsperado = (4500 + 1200) * 1 + 6000 * 2;
    expect(calculateSaleProfit(sale, getProduct)).toBe(34800 - custoEsperado);
  });

  it("produto removido do catálogo: custo desse item é ignorado, não quebra", () => {
    const sale = makeSale({ items: [buildSaleItem({ productId: "produto-inexistente", quantity: 1, unitPrice: 5000 })], totalAmount: 5000 });
    expect(calculateSaleProfit(sale, getProduct)).toBe(5000);
  });
});

describe("allocateItemRevenue", () => {
  it("venda de um item só: recebe o totalAmount inteiro", () => {
    const sale = makeSale({ items: [makeSaleItem({ quantity: 1, unitPrice: 10000 })], totalAmount: 10000 });
    expect(allocateItemRevenue(sale, sale.items[0])).toBe(10000);
  });

  it("exemplo do enunciado: A R$148×1 + B R$100×2, com desconto e frete — cada item recebe sua fatia proporcional ao subtotal", () => {
    const itemA = buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 14800 });
    const itemB = buildSaleItem({ productId: "prod-2", quantity: 2, unitPrice: 10000 });
    // subtotal 348,00; 10% + R$20 de desconto = R$54,80; + frete R$30 => total R$323,20 => 32320 centavos (arred.)
    const breakdown = calculateSaleBreakdown({
      items: [itemA, itemB],
      discounts: [{ kind: "percentual", percent: 10 }, { kind: "valor_fixo", amount: 2000 }],
      shippingCost: 3000,
      channel: "instagram",
      nuvemshopFeePercent: 0,
    });
    const sale = makeSale({ items: [itemA, itemB], totalAmount: breakdown.totalAmount });
    const shareA = allocateItemRevenue(sale, itemA);
    const shareB = allocateItemRevenue(sale, itemB);
    expect(shareA + shareB).toBe(breakdown.totalAmount);
    expect(shareA).toBeGreaterThan(0);
    expect(shareB).toBeGreaterThan(shareA); // item B tem subtotal maior (20000 vs 14800)
  });
});

describe("describeSaleItems", () => {
  it("um item: mostra o nome do produto", () => {
    expect(describeSaleItems([makeSaleItem({ productId: "prod-1" })], (id) => getProduct(id)?.name)).toBe("Camiseta Oversized Preta");
  });

  it("múltiplos itens: mostra a contagem", () => {
    const items = [makeSaleItem({ productId: "prod-1" }), makeSaleItem({ productId: "prod-2" })];
    expect(describeSaleItems(items, (id) => getProduct(id)?.name)).toBe("2 produtos");
  });
});

describe("buildIncomeTransactionInput", () => {
  it("gera um input de receita compatível com o Financeiro (categoria venda)", () => {
    const input = buildIncomeTransactionInput({ date: "2026-09-10", totalAmount: 12900, description: "Camiseta Oversized Preta", channel: "Instagram" });
    expect(input.type).toBe("income");
    expect(input.category).toBe("venda");
    expect(input.amount).toBe(12900);
    expect(input.status).toBe("concluido");
    expect(input.description).toContain("Camiseta Oversized Preta");
  });

  it("sem saleId, não relaciona a transação a nenhuma venda", () => {
    const input = buildIncomeTransactionInput({ date: "2026-09-10", totalAmount: 12900, description: "Camiseta", channel: "Instagram" });
    expect(input.relations).toBeUndefined();
  });

  it("com saleId, relaciona a transação de receita à venda", () => {
    const input = buildIncomeTransactionInput({ date: "2026-09-10", totalAmount: 12900, description: "Camiseta", channel: "Instagram", saleId: "sale-1" });
    expect(input.relations).toEqual({ saleId: "sale-1" });
  });
});

describe("buildShippingExpenseTransactionInput", () => {
  it("gera uma despesa na categoria frete, vinculada à venda, pendente por padrão", () => {
    const input = buildShippingExpenseTransactionInput({ saleId: "sale-1", date: "2026-09-10", shippingCost: 3000, description: "Camiseta" });
    expect(input.type).toBe("expense");
    expect(input.category).toBe("frete");
    expect(input.amount).toBe(3000);
    expect(input.status).toBe("pendente");
    expect(input.dueDate).toBe("2026-09-10");
    expect(input.relations).toEqual({ saleId: "sale-1" });
    expect(input.description).toContain("Frete");
  });

  it("quando settled, a despesa já nasce paga e sem vencimento", () => {
    const input = buildShippingExpenseTransactionInput({ saleId: "sale-1", date: "2026-09-10", shippingCost: 3000, description: "Camiseta", settled: true });
    expect(input.status).toBe("concluido");
    expect(input.dueDate).toBeUndefined();
  });
});

describe("buildNuvemshopFeeExpenseTransactionInput", () => {
  it("gera uma despesa na categoria taxas, vinculada à venda", () => {
    const input = buildNuvemshopFeeExpenseTransactionInput({ saleId: "sale-1", date: "2026-09-10", feeAmount: 500 });
    expect(input.type).toBe("expense");
    expect(input.category).toBe("taxas");
    expect(input.amount).toBe(500);
    expect(input.relations).toEqual({ saleId: "sale-1" });
    expect(input.description).toContain("Nuvemshop");
  });
});

describe("reconcileShippingExpense", () => {
  const base = { saleId: "sale-1", date: "2026-09-10", description: "Camiseta Oversized Preta" };

  it("venda sem frete: nenhuma ação é necessária", () => {
    expect(reconcileShippingExpense({ ...base, shippingCost: 0 }).action).toBe("none");
  });

  it("frete cobrado, sem despesa vinculada ainda: cria a despesa", () => {
    const result = reconcileShippingExpense({ ...base, shippingCost: 3000 });
    expect(result).toMatchObject({ action: "create" });
    if (result.action === "create") {
      expect(result.input.amount).toBe(3000);
      expect(result.input.category).toBe("frete");
    }
  });

  it("edição (R$30 → R$35) com despesa já vinculada: atualiza em vez de criar (sem duplicar)", () => {
    const result = reconcileShippingExpense({ ...base, shippingCost: 3500, existingShippingTransactionId: "shipping-t1" });
    expect(result).toMatchObject({ action: "update", transactionId: "shipping-t1" });
    if (result.action === "update") expect(result.input.amount).toBe(3500);
  });

  it("remoção do custo de frete com despesa já vinculada: remove/desvincula", () => {
    const result = reconcileShippingExpense({ ...base, shippingCost: 0, existingShippingTransactionId: "shipping-t1" });
    expect(result).toEqual({ action: "delete", transactionId: "shipping-t1" });
  });
});

describe("reconcileNuvemshopFeeExpense", () => {
  it("sem taxa: nenhuma ação", () => {
    expect(reconcileNuvemshopFeeExpense({ saleId: "sale-1", date: "2026-09-10", feeAmount: 0 }).action).toBe("none");
  });

  it("com taxa e sem despesa vinculada: cria", () => {
    const result = reconcileNuvemshopFeeExpense({ saleId: "sale-1", date: "2026-09-10", feeAmount: 500 });
    expect(result).toMatchObject({ action: "create" });
  });

  it("taxa zerada com despesa já vinculada: remove", () => {
    const result = reconcileNuvemshopFeeExpense({ saleId: "sale-1", date: "2026-09-10", feeAmount: 0, existingFeeTransactionId: "fee-t1" });
    expect(result).toEqual({ action: "delete", transactionId: "fee-t1" });
  });
});

describe("calculateDiscountAmount", () => {
  it("calcula desconto percentual sobre o subtotal", () => {
    expect(calculateDiscountAmount(20000, { kind: "percentual", percent: 10 })).toBe(2000);
  });

  it("calcula desconto de valor fixo, sem passar do subtotal", () => {
    expect(calculateDiscountAmount(10000, { kind: "valor_fixo", amount: 3000 })).toBe(3000);
    expect(calculateDiscountAmount(1000, { kind: "valor_fixo", amount: 3000 })).toBe(1000);
  });

  it("frete grátis não desconta o subtotal", () => {
    expect(calculateDiscountAmount(14800, { kind: "frete_gratis" })).toBe(0);
  });

  it("sem cupom, não há desconto", () => {
    expect(calculateDiscountAmount(14800, undefined)).toBe(0);
  });
});

describe("calculateDiscountsTotal", () => {
  it("soma descontos independentes sobre o mesmo subtotal original (não em cascata)", () => {
    // 348,00: 10% = 34,80 (arred. 35) + R$20 fixo = R$55 de desconto total
    const total = calculateDiscountsTotal(34800, [{ kind: "percentual", percent: 10 }, { kind: "valor_fixo", amount: 2000 }]);
    expect(total).toBe(3480 + 2000);
  });

  it("sem descontos, total zero", () => {
    expect(calculateDiscountsTotal(10000, [])).toBe(0);
  });
});

describe("validateDiscounts", () => {
  it("permite nenhum ou um frete grátis", () => {
    expect(validateDiscounts([])).toBeNull();
    expect(validateDiscounts([{ kind: "frete_gratis" }])).toBeNull();
  });

  it("rejeita dois descontos de frete grátis na mesma venda", () => {
    expect(validateDiscounts([{ kind: "frete_gratis" }, { kind: "frete_gratis" }])).not.toBeNull();
  });

  it("permite frete grátis acumulado com percentual/valor fixo", () => {
    expect(validateDiscounts([{ kind: "frete_gratis" }, { kind: "percentual", percent: 10 }, { kind: "valor_fixo", amount: 500 }])).toBeNull();
  });
});

describe("calculateShippingCharged", () => {
  it("cobra o custo real de frete quando não há frete grátis", () => {
    expect(calculateShippingCharged(3000, [])).toBe(3000);
    expect(calculateShippingCharged(3000, [{ kind: "percentual", percent: 10 }])).toBe(3000);
  });

  it("zera o frete cobrado quando algum desconto é frete grátis, mesmo com custo real", () => {
    expect(calculateShippingCharged(3000, [{ kind: "frete_gratis" }])).toBe(0);
  });
});

describe("calculateNuvemshopFee", () => {
  it("não aplica taxa fora do canal Nuvemshop", () => {
    expect(calculateNuvemshopFee(10000, "instagram", 5)).toBe(0);
  });

  it("não aplica taxa quando não configurada (0%)", () => {
    expect(calculateNuvemshopFee(10000, "nuvemshop", 0)).toBe(0);
  });

  it("aplica a taxa configurada sobre o total pago pelo cliente, no canal Nuvemshop", () => {
    expect(calculateNuvemshopFee(10000, "nuvemshop", 5)).toBe(500);
  });
});

describe("calculateSaleBreakdown", () => {
  it("R$148 + frete grátis (custo real R$30 para a marca) → total R$148", () => {
    const breakdown = calculateSaleBreakdown({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 14800 })],
      discounts: [{ kind: "frete_gratis" }],
      shippingCost: 3000,
      channel: "instagram",
      nuvemshopFeePercent: 0,
    });
    expect(breakdown.discountAmount).toBe(0);
    expect(breakdown.shippingAmount).toBe(0);
    expect(breakdown.shippingCost).toBe(3000);
    expect(breakdown.totalAmount).toBe(14800);
  });

  it("R$200 + 10% de desconto → desconto R$20, total R$180", () => {
    const breakdown = calculateSaleBreakdown({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 20000 })],
      discounts: [{ kind: "percentual", percent: 10 }],
      shippingCost: 0,
      channel: "instagram",
      nuvemshopFeePercent: 0,
    });
    expect(breakdown.discountAmount).toBe(2000);
    expect(breakdown.totalAmount).toBe(18000);
  });

  it("exemplo do enunciado: A R$148×1 + B R$100×2 + frete R$30 + 10% + R$20 → total R$323,20", () => {
    const breakdown = calculateSaleBreakdown({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 14800 }), buildSaleItem({ productId: "prod-2", quantity: 2, unitPrice: 10000 })],
      discounts: [{ kind: "percentual", percent: 10 }, { kind: "valor_fixo", amount: 2000 }],
      shippingCost: 3000,
      channel: "instagram",
      nuvemshopFeePercent: 0,
    });
    expect(breakdown.subtotal).toBe(34800);
    expect(breakdown.discountAmount).toBe(3480 + 2000);
    expect(breakdown.totalAmount).toBe(34800 - (3480 + 2000) + 3000);
  });

  it("canal Nuvemshop com taxa configurada: taxa incide sobre o total pago, separada da receita", () => {
    const breakdown = calculateSaleBreakdown({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 10000 })],
      discounts: [],
      shippingCost: 0,
      channel: "nuvemshop",
      nuvemshopFeePercent: 5,
    });
    expect(breakdown.totalAmount).toBe(10000);
    expect(breakdown.nuvemshopFeeAmount).toBe(500);
  });

  it("sem cupom e com frete cobrado, o frete soma ao total", () => {
    const breakdown = calculateSaleBreakdown({
      items: [buildSaleItem({ productId: "prod-1", quantity: 1, unitPrice: 10000 })],
      discounts: [],
      shippingCost: 1500,
      channel: "instagram",
      nuvemshopFeePercent: 0,
    });
    expect(breakdown.discountAmount).toBe(0);
    expect(breakdown.shippingAmount).toBe(1500);
    expect(breakdown.totalAmount).toBe(11500);
  });
});

describe("aggregateContactHistory", () => {
  const sales = [
    makeSale({ id: "s1", date: "2026-09-01", contactId: "ct1", totalAmount: 12900 }),
    makeSale({ id: "s2", date: "2026-09-10", contactId: "ct1", totalAmount: 25800 }),
    makeSale({ id: "s3", date: "2026-09-05", contactId: "ct2", totalAmount: 12900 }),
  ];

  it("soma total comprado e quantidade de compras só do contato pedido", () => {
    const history = aggregateContactHistory(sales, "ct1");
    expect(history.totalPurchased).toBe(12900 + 25800);
    expect(history.purchaseCount).toBe(2);
    expect(history.lastPurchaseDate).toBe("2026-09-10");
  });

  it("retorna vazio para contato sem compras", () => {
    const history = aggregateContactHistory(sales, "ct-sem-compras");
    expect(history.totalPurchased).toBe(0);
    expect(history.purchaseCount).toBe(0);
    expect(history.lastPurchaseDate).toBeUndefined();
  });
});
