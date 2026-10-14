import { describe, expect, it } from "vitest";
import {
  adjustmentDelta,
  computeStockLevels,
  findStockShortages,
  getStockLevel,
  listProductVariants,
  listVariantStocks,
  missingVariantChoice,
  planSaleMovements,
  productHasVariants,
  signedQuantity,
  stockLevelStatus,
  summarizeProductStock,
  summarizeStock,
  trackedProductIds,
  variantKey,
  variantLabel,
} from "./calculations";
import { buildSaleItem } from "@/lib/sales/calculations";
import type { StockMovement } from "./types";

let counter = 0;
function movement(overrides: Partial<StockMovement> = {}): StockMovement {
  counter += 1;
  return {
    id: `m${counter}`,
    productId: "p1",
    quantity: 10,
    kind: "entrada",
    date: "2026-10-01",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

const shirt = { id: "p1", sizes: ["P", "M"], colors: ["Preto", "Branco"] };

describe("variantKey / variantLabel", () => {
  it("ignora maiúsculas e espaços nas pontas — 'm ' e 'M' são o mesmo tamanho", () => {
    expect(variantKey({ productId: "p1", size: "m ", color: "PRETO" })).toBe(variantKey({ productId: "p1", size: "M", color: "Preto" }));
  });

  it("produtos diferentes nunca compartilham chave", () => {
    expect(variantKey({ productId: "p1", size: "M" })).not.toBe(variantKey({ productId: "p2", size: "M" }));
  });

  it("tamanho ausente e tamanho vazio são a mesma variante", () => {
    expect(variantKey({ productId: "p1" })).toBe(variantKey({ productId: "p1", size: "", color: undefined }));
  });

  it("rótulo legível", () => {
    expect(variantLabel({ size: "M", color: "Preto" })).toBe("M · Preto");
    expect(variantLabel({ size: "M" })).toBe("M");
    expect(variantLabel({ color: "Preto" })).toBe("Preto");
    expect(variantLabel({})).toBe("Único");
  });
});

describe("listProductVariants", () => {
  it("tamanhos × cores", () => {
    expect(listProductVariants(shirt)).toEqual([
      { productId: "p1", size: "P", color: "Preto" },
      { productId: "p1", size: "P", color: "Branco" },
      { productId: "p1", size: "M", color: "Preto" },
      { productId: "p1", size: "M", color: "Branco" },
    ]);
  });

  it("só tamanhos ou só cores", () => {
    expect(listProductVariants({ id: "p1", sizes: ["P", "M"] })).toEqual([
      { productId: "p1", size: "P" },
      { productId: "p1", size: "M" },
    ]);
    expect(listProductVariants({ id: "p1", colors: ["Preto"] })).toEqual([{ productId: "p1", color: "Preto" }]);
  });

  it("sem tamanho nem cor: uma única variante", () => {
    expect(listProductVariants({ id: "p1" })).toEqual([{ productId: "p1" }]);
    expect(listProductVariants({ id: "p1", sizes: [" ", ""], colors: [] })).toEqual([{ productId: "p1" }]);
  });

  it("descarta espaços sobrando", () => {
    expect(listProductVariants({ id: "p1", sizes: [" P ", "M"] }).map((v) => v.size)).toEqual(["P", "M"]);
  });
});

describe("productHasVariants / missingVariantChoice", () => {
  it("produto com tamanho/cor exige a escolha", () => {
    expect(productHasVariants(shirt)).toBe(true);
    expect(productHasVariants({})).toBe(false);
    expect(missingVariantChoice(shirt, {})).toBe("tamanho");
    expect(missingVariantChoice(shirt, { size: "M" })).toBe("cor");
    expect(missingVariantChoice(shirt, { size: "M", color: "Preto" })).toBeNull();
  });

  it("produto sem opções, ou produto desconhecido, nunca exige nada", () => {
    expect(missingVariantChoice({}, {})).toBeNull();
    expect(missingVariantChoice(undefined, {})).toBeNull();
  });

  it("só tamanhos: não exige cor", () => {
    expect(missingVariantChoice({ sizes: ["P"] }, { size: "P" })).toBeNull();
  });
});

describe("computeStockLevels / getStockLevel", () => {
  it("o saldo é a soma, com sinal, das movimentações da variante", () => {
    const levels = computeStockLevels([
      movement({ size: "M", color: "Preto", quantity: 10 }),
      movement({ size: "M", color: "Preto", quantity: -3, kind: "saida" }),
      movement({ size: "P", color: "Preto", quantity: 5 }),
    ]);
    expect(getStockLevel(levels, { productId: "p1", size: "M", color: "Preto" })).toBe(7);
    expect(getStockLevel(levels, { productId: "p1", size: "P", color: "Preto" })).toBe(5);
  });

  it("variante nunca movimentada: zero", () => {
    expect(getStockLevel(computeStockLevels([]), { productId: "p1", size: "G" })).toBe(0);
  });

  it("o saldo pode ficar negativo (vendeu mais do que havia registrado)", () => {
    const levels = computeStockLevels([movement({ quantity: 2 }), movement({ quantity: -5, kind: "saida" })]);
    expect(getStockLevel(levels, { productId: "p1" })).toBe(-3);
  });
});

describe("trackedProductIds", () => {
  it("só produtos que já receberam alguma movimentação são controlados", () => {
    const tracked = trackedProductIds([movement({ productId: "p1" }), movement({ productId: "p3" })]);
    expect(tracked.has("p1")).toBe(true);
    expect(tracked.has("p2")).toBe(false);
  });
});

describe("stockLevelStatus", () => {
  it("esgotado em zero ou negativo, baixo até o limite, ok acima", () => {
    expect(stockLevelStatus(0, 3)).toBe("esgotado");
    expect(stockLevelStatus(-2, 3)).toBe("esgotado");
    expect(stockLevelStatus(1, 3)).toBe("baixo");
    expect(stockLevelStatus(3, 3)).toBe("baixo");
    expect(stockLevelStatus(4, 3)).toBe("ok");
  });

  it("limite zero: só zero conta como problema", () => {
    expect(stockLevelStatus(1, 0)).toBe("ok");
    expect(stockLevelStatus(0, 0)).toBe("esgotado");
  });
});

describe("listVariantStocks", () => {
  it("produto sem nenhuma movimentação não aparece (estoque não controlado)", () => {
    expect(listVariantStocks([shirt], [], 3)).toEqual([]);
  });

  it("lista todas as variantes declaradas do produto controlado, inclusive as zeradas", () => {
    const stocks = listVariantStocks([shirt], [movement({ size: "M", color: "Preto", quantity: 10 })], 3);
    expect(stocks).toHaveLength(4);
    const mPreto = stocks.find((s) => s.variant.size === "M" && s.variant.color === "Preto");
    expect(mPreto).toMatchObject({ level: 10, status: "ok", undeclared: false });
    const pBranco = stocks.find((s) => s.variant.size === "P" && s.variant.color === "Branco");
    expect(pBranco).toMatchObject({ level: 0, status: "esgotado" });
  });

  it("variante com saldo que não consta mais no produto (renomeada) continua visível", () => {
    const stocks = listVariantStocks([{ id: "p1", sizes: ["P"] }], [movement({ size: "PP", quantity: 4 })], 3);
    const orphan = stocks.find((s) => s.variant.size === "PP");
    expect(orphan).toMatchObject({ level: 4, undeclared: true });
  });

  it("variante antiga já zerada não polui a lista", () => {
    const stocks = listVariantStocks(
      [{ id: "p1", sizes: ["P"] }],
      [movement({ size: "PP", quantity: 4 }), movement({ size: "PP", quantity: -4, kind: "saida" })],
      3
    );
    expect(stocks.find((s) => s.variant.size === "PP")).toBeUndefined();
  });

  it("não mistura movimentações de produtos diferentes", () => {
    const stocks = listVariantStocks(
      [{ id: "p1" }, { id: "p2" }],
      [movement({ productId: "p1", quantity: 8 }), movement({ productId: "p2", quantity: 2 })],
      3
    );
    expect(stocks.find((s) => s.variant.productId === "p1")?.level).toBe(8);
    expect(stocks.find((s) => s.variant.productId === "p2")).toMatchObject({ level: 2, status: "baixo" });
  });
});

describe("summarizeProductStock / summarizeStock", () => {
  const stocks = listVariantStocks(
    [{ id: "p1", sizes: ["P", "M"] }],
    [movement({ size: "P", quantity: 10 }), movement({ size: "M", quantity: 2 })],
    3
  );

  it("produto sem controle: undefined", () => {
    expect(summarizeProductStock(stocks, "outro")).toBeUndefined();
  });

  it("soma as peças e conta as variações que pedem atenção", () => {
    expect(summarizeProductStock(stocks, "p1")).toEqual({ units: 12, attentionCount: 1 });
  });

  it("totais: peças, valor ao custo, baixo e esgotado — saldo negativo conta como zero", () => {
    const withNegative = listVariantStocks(
      [{ id: "p1", sizes: ["P", "M", "G"] }],
      [movement({ size: "P", quantity: 10 }), movement({ size: "M", quantity: 2 }), movement({ size: "G", quantity: -4, kind: "saida" })],
      3
    );
    const totals = summarizeStock(withNegative, () => 4500);
    expect(totals.units).toBe(12);
    expect(totals.value).toBe(12 * 4500);
    expect(totals.lowCount).toBe(1);
    expect(totals.outCount).toBe(1);
  });
});

describe("signedQuantity / adjustmentDelta", () => {
  it("entrada soma, saída subtrai — qualquer que seja o sinal digitado", () => {
    expect(signedQuantity("entrada", 5)).toBe(5);
    expect(signedQuantity("entrada", -5)).toBe(5);
    expect(signedQuantity("saida", 5)).toBe(-5);
    expect(signedQuantity("saida", -5)).toBe(-5);
  });

  it("contagem real vira só a diferença", () => {
    expect(adjustmentDelta(8, 10)).toBe(-2);
    expect(adjustmentDelta(12, 10)).toBe(2);
    expect(adjustmentDelta(10, 10)).toBe(0);
    expect(adjustmentDelta(0, 3)).toBe(-3);
  });

  it("contagem sobre um saldo negativo corrige para o número contado", () => {
    expect(adjustmentDelta(5, -3)).toBe(8);
  });
});

describe("planSaleMovements", () => {
  const item = (overrides: Partial<Parameters<typeof buildSaleItem>[0]> = {}) =>
    buildSaleItem({ id: "i1", productId: "p1", size: "M", color: "Preto", quantity: 2, unitPrice: 10000, ...overrides });
  const base = { saleId: "s1", date: "2026-10-10", previousItemIds: new Set<string>(), existing: [] as StockMovement[], isTracked: () => true };

  it("venda nova de produto controlado: cria uma saída negativa por item, ligada à venda e ao item", () => {
    const plan = planSaleMovements({ ...base, items: [item()] });
    expect(plan.create).toEqual([
      { productId: "p1", size: "M", color: "Preto", quantity: -2, date: "2026-10-10", kind: "saida", saleId: "s1", saleItemId: "i1" },
    ]);
    expect(plan.update).toEqual([]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("produto SEM controle de estoque: nada é criado (vender continua funcionando como antes)", () => {
    const plan = planSaleMovements({ ...base, items: [item()], isTracked: () => false });
    expect(plan).toEqual({ create: [], update: [], deleteIds: [] });
  });

  it("vários itens: uma saída para cada, só dos controlados", () => {
    const plan = planSaleMovements({
      ...base,
      items: [item({ id: "a", productId: "p1" }), item({ id: "b", productId: "p2" })],
      isTracked: (id) => id === "p1",
    });
    expect(plan.create.map((m) => m.saleItemId)).toEqual(["a"]);
  });

  it("editar a quantidade atualiza a MESMA saída — nunca cria uma segunda", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", size: "M", color: "Preto", quantity: -2, kind: "saida", date: "2026-10-10" })];
    const plan = planSaleMovements({ ...base, items: [item({ quantity: 5 })], previousItemIds: new Set(["i1"]), existing });
    expect(plan.create).toEqual([]);
    expect(plan.update).toEqual([{ id: "mv", changes: { productId: "p1", size: "M", color: "Preto", quantity: -5, date: "2026-10-10" } }]);
    expect(plan.deleteIds).toEqual([]);
  });

  it("editar sem mudar nada relevante não gera atualização", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", size: "M", color: "Preto", quantity: -2, kind: "saida", date: "2026-10-10" })];
    const plan = planSaleMovements({ ...base, items: [item()], previousItemIds: new Set(["i1"]), existing });
    expect(plan).toEqual({ create: [], update: [], deleteIds: [] });
  });

  it("trocar tamanho/cor ou a data da venda atualiza a saída", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", size: "M", color: "Preto", quantity: -2, kind: "saida", date: "2026-10-10" })];
    const plan = planSaleMovements({
      ...base,
      date: "2026-10-12",
      items: [item({ size: "P" })],
      previousItemIds: new Set(["i1"]),
      existing,
    });
    expect(plan.update[0].changes).toMatchObject({ size: "P", date: "2026-10-12" });
  });

  it("item removido da venda: a saída dele é removida (a peça volta ao estoque)", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", quantity: -2, kind: "saida" })];
    const plan = planSaleMovements({ ...base, items: [item({ id: "i2", productId: "p9" })], previousItemIds: new Set(["i1"]), existing, isTracked: (id) => id === "p1" });
    expect(plan.deleteIds).toEqual(["mv"]);
  });

  it("item novo adicionado numa edição ganha a sua própria saída", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", size: "M", color: "Preto", quantity: -2, kind: "saida", date: "2026-10-10" })];
    const plan = planSaleMovements({
      ...base,
      items: [item(), item({ id: "novo", size: "P" })],
      previousItemIds: new Set(["i1"]),
      existing,
    });
    expect(plan.create.map((m) => m.saleItemId)).toEqual(["novo"]);
  });

  it("item ANTIGO sem saída (venda feita antes do controle) não baixa estoque retroativamente ao ser editado", () => {
    const plan = planSaleMovements({ ...base, items: [item({ quantity: 9 })], previousItemIds: new Set(["i1"]), existing: [] });
    expect(plan).toEqual({ create: [], update: [], deleteIds: [] });
  });

  it("item que passa para um produto SEM controle perde a saída antiga em vez de torná-lo 'controlado' com saldo negativo", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", productId: "p1", quantity: -2, kind: "saida" })];
    const plan = planSaleMovements({
      ...base,
      items: [item({ productId: "p2" })],
      previousItemIds: new Set(["i1"]),
      existing,
      isTracked: (id) => id === "p1",
    });
    expect(plan.deleteIds).toEqual(["mv"]);
    expect(plan.update).toEqual([]);
    expect(plan.create).toEqual([]);
  });

  it("item que passa para outro produto JÁ controlado move a saída para ele", () => {
    const existing = [movement({ id: "mv", saleId: "s1", saleItemId: "i1", productId: "p1", quantity: -2, kind: "saida", date: "2026-10-10", size: "M", color: "Preto" })];
    const plan = planSaleMovements({
      ...base,
      items: [item({ productId: "p2" })],
      previousItemIds: new Set(["i1"]),
      existing,
      isTracked: () => true,
    });
    expect(plan.update[0]).toMatchObject({ id: "mv", changes: { productId: "p2" } });
  });

  it("item sem produto escolhido ainda é ignorado", () => {
    const plan = planSaleMovements({ ...base, items: [item({ productId: "" })] });
    expect(plan.create).toEqual([]);
  });
});

describe("findStockShortages", () => {
  const entry = movement({ size: "M", color: "Preto", quantity: 5 });
  const item = (overrides: Partial<Parameters<typeof buildSaleItem>[0]> = {}) =>
    buildSaleItem({ id: "i1", productId: "p1", size: "M", color: "Preto", quantity: 2, unitPrice: 10000, ...overrides });

  it("pedido dentro do estoque: sem aviso", () => {
    expect(findStockShortages({ items: [item({ quantity: 5 })], movements: [entry] })).toEqual([]);
  });

  it("pedido maior que o estoque: avisa com o que foi pedido e o que há", () => {
    const shortages = findStockShortages({ items: [item({ quantity: 6 })], movements: [entry] });
    expect(shortages).toEqual([{ productId: "p1", size: "M", color: "Preto", requested: 6, available: 5 }]);
  });

  it("produto sem controle de estoque nunca gera aviso", () => {
    expect(findStockShortages({ items: [item({ quantity: 99 })], movements: [] })).toEqual([]);
  });

  it("duas linhas da mesma variante somam o pedido", () => {
    const shortages = findStockShortages({ items: [item({ id: "a", quantity: 3 }), item({ id: "b", quantity: 3 })], movements: [entry] });
    expect(shortages).toHaveLength(1);
    expect(shortages[0]).toMatchObject({ requested: 6, available: 5 });
  });

  it("variantes diferentes são avaliadas separadamente", () => {
    const shortages = findStockShortages({
      items: [item({ id: "a", quantity: 2 }), item({ id: "b", size: "P", quantity: 1 })],
      movements: [entry],
    });
    expect(shortages).toEqual([{ productId: "p1", size: "P", color: "Preto", requested: 1, available: 0 }]);
  });

  it("ao editar, a saída da própria venda é devolvida ao saldo antes de comparar", () => {
    const own = movement({ saleId: "s1", saleItemId: "i1", size: "M", color: "Preto", quantity: -4, kind: "saida" });
    // estoque físico: 5 − 4 = 1 sobrando; a venda de 4 quer virar 5 → cabe (1 + 4 = 5)
    const ok = findStockShortages({ items: [item({ quantity: 5 })], movements: [entry, own], editingSaleId: "s1", previousItemIds: new Set(["i1"]) });
    expect(ok).toEqual([]);
    const over = findStockShortages({ items: [item({ quantity: 6 })], movements: [entry, own], editingSaleId: "s1", previousItemIds: new Set(["i1"]) });
    expect(over).toEqual([{ productId: "p1", size: "M", color: "Preto", requested: 6, available: 5 }]);
  });

  it("item antigo sem saída (venda de antes do controle) não conta contra o estoque", () => {
    const shortages = findStockShortages({
      items: [item({ quantity: 50 })],
      movements: [entry],
      editingSaleId: "s1",
      previousItemIds: new Set(["i1"]),
    });
    expect(shortages).toEqual([]);
  });
});
