import { describe, expect, it } from "vitest";
import { fetchSales, upsertSales } from "./repository";
import { makeSale, makeSaleItem } from "./test-helpers";
import type { AnySupabaseClient } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Fake do client do Supabase cobrindo `sales` e `sale_items` — mesmo padrão
// de src/lib/ai/keys.test.ts e src/lib/ai/tools/transactions.test.ts: um
// fake em memória, roteado por tabela, exercitando o comportamento REAL de
// fetchSales/upsertSales (as únicas funções exportadas — legacyRowToItems,
// legacyRowToDiscounts, rowToSale e saleToRow são privadas ao módulo, então
// só dá pra testá-las através das funções públicas, sem mockar nada interno).
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function createFakeDb(seed: { sales?: Row[]; sale_items?: Row[] } = {}) {
  const tables: Record<string, Row[]> = {
    sales: seed.sales ? [...seed.sales] : [],
    sale_items: seed.sale_items ? [...seed.sale_items] : [],
  };

  function builderFor(table: string) {
    let operation: "select" | "upsert" | "delete" = "select";
    let upsertRows: Row[] = [];
    const eqFilters: { column: string; value: unknown }[] = [];
    let inFilter: { column: string; values: unknown[] } | null = null;

    const matches = (row: Row) =>
      eqFilters.every(({ column, value }) => row[column] === value) &&
      (!inFilter || (inFilter.values as unknown[]).includes(row[inFilter.column]));

    function run() {
      const rows = tables[table];
      if (operation === "upsert") {
        for (const row of upsertRows) {
          const i = rows.findIndex((r) => r.id === row.id);
          if (i >= 0) rows[i] = row;
          else rows.push(row);
        }
        return { data: upsertRows, error: null };
      }
      if (operation === "delete") {
        const toRemove = rows.filter(matches);
        for (const row of toRemove) rows.splice(rows.indexOf(row), 1);
        return { data: toRemove, error: null };
      }
      return { data: rows.filter(matches), error: null };
    }

    const builder = {
      select: () => builder,
      upsert: (v: Row[]) => {
        operation = "upsert";
        upsertRows = v;
        return builder;
      },
      insert: (v: Row[]) => {
        // sale_items usa .insert() puro (não upsert) em upsertSales.
        tables[table].push(...v);
        return Promise.resolve({ data: v, error: null });
      },
      delete: () => {
        operation = "delete";
        return builder;
      },
      eq: (column: string, value: unknown) => {
        eqFilters.push({ column, value });
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        inFilter = { column, values };
        return builder;
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  return {
    tables,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake de teste
    client: { from: (t: string) => builderFor(t) } as any as AnySupabaseClient,
  };
}

const USER = "user-1";

function baseSaleRow(overrides: Row = {}): Row {
  return {
    id: "sale-1",
    user_id: USER,
    date: "2026-09-01",
    contact_id: null,
    product_id: null,
    quantity: null,
    coupon_code: null,
    subtotal: null,
    discount: null,
    discounts: null,
    shipping_amount: null,
    shipping_cost: null,
    nuvemshop_fee_amount: null,
    nuvemshop_fee_transaction_id: null,
    total_amount: 10000,
    channel: "instagram",
    notes: null,
    transaction_id: "t1",
    shipping_transaction_id: null,
    created_at: "2026-09-01T00:00:00.000Z",
    updated_at: "2026-09-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("fetchSales — compatibilidade com vendas legadas (legacyRowToItems)", () => {
  it("venda legada (product_id/quantity/subtotal, sem linhas em sale_items) gera exatamente um item com esses valores", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ product_id: "prod-1", quantity: 3, subtotal: 300, total_amount: 300 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items).toHaveLength(1);
    expect(sale.items[0]).toMatchObject({ productId: "prod-1", quantity: 3, subtotal: 300 });
  });

  it("unitPrice legado é subtotal/quantity, mesmo quando a divisão não é exata (nunca regravado)", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ product_id: "prod-1", quantity: 3, subtotal: 100, total_amount: 100 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    // 100 / 3 = 33.33... arredondado para 33; subtotal do item continua 100 (o valor real da venda), não 99.
    expect(sale.items[0].unitPrice).toBe(33);
    expect(sale.items[0].subtotal).toBe(100);
  });

  it("venda legada sem subtotal usa total_amount como subtotal do item", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ product_id: "prod-1", quantity: 1, subtotal: null, total_amount: 5000 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items[0].subtotal).toBe(5000);
  });

  it("venda legada sem quantity assume 1", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ product_id: "prod-1", quantity: null, subtotal: 200, total_amount: 200 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items[0].quantity).toBe(1);
  });

  it("quantity: 0 (falsy, mas não null/undefined) não cai no default de 1 — e não divide por zero", async () => {
    // 0 é diferente de null/undefined para `??`; o código depende disso para
    // não tentar dividir subtotal por 0 (usa o subtotal como unitPrice nesse caso).
    const db = createFakeDb({
      sales: [baseSaleRow({ product_id: "prod-1", quantity: 0, subtotal: 500, total_amount: 500 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items[0].quantity).toBe(0);
    expect(sale.items[0].unitPrice).toBe(500);
    expect(Number.isFinite(sale.items[0].unitPrice)).toBe(true);
  });

  it("id do item sintetizado segue o formato '<id-da-venda>-item-legado'", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ id: "venda-xyz", product_id: "prod-1", quantity: 1, subtotal: 100, total_amount: 100 })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items[0].id).toBe("venda-xyz-item-legado");
  });

  it("venda sem product_id e sem sale_items não tem nenhum item (nunca inventa um produto)", async () => {
    const db = createFakeDb({ sales: [baseSaleRow({ product_id: null })] });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items).toEqual([]);
  });
});

describe("fetchSales — venda atual (com linhas em sale_items ignora as colunas legadas)", () => {
  it("quando existem linhas em sale_items, as colunas legadas de sales são ignoradas mesmo se preenchidas", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ id: "sale-1", product_id: "prod-legado", quantity: 99, subtotal: 999900 })],
      sale_items: [
        { id: "item-1", sale_id: "sale-1", user_id: USER, product_id: "prod-real-1", quantity: 2, unit_price: 5000, subtotal: 10000 },
        { id: "item-2", sale_id: "sale-1", user_id: USER, product_id: "prod-real-2", quantity: 1, unit_price: 3000, subtotal: 3000 },
      ],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.items).toHaveLength(2);
    expect(sale.items.map((i) => i.productId)).toEqual(["prod-real-1", "prod-real-2"]);
    // A coluna legada "prod-legado" não aparece em lugar nenhum.
    expect(sale.items.some((i) => i.productId === "prod-legado")).toBe(false);
  });

  it("agrupa os itens da tabela sale_items pela venda certa quando há mais de uma venda", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ id: "sale-1" }), baseSaleRow({ id: "sale-2" })],
      sale_items: [
        { id: "item-1", sale_id: "sale-1", user_id: USER, product_id: "p1", quantity: 1, unit_price: 100, subtotal: 100 },
        { id: "item-2", sale_id: "sale-2", user_id: USER, product_id: "p2", quantity: 1, unit_price: 200, subtotal: 200 },
      ],
    });

    const sales = await fetchSales(USER, db.client);
    const sale1 = sales.find((s) => s.id === "sale-1")!;
    const sale2 = sales.find((s) => s.id === "sale-2")!;

    expect(sale1.items.map((i) => i.productId)).toEqual(["p1"]);
    expect(sale2.items.map((i) => i.productId)).toEqual(["p2"]);
  });
});

describe("fetchSales — compatibilidade de descontos (legacyRowToDiscounts)", () => {
  it("discount singular (legado) vira um array de um elemento", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ discount: { kind: "percentual", percent: 10 }, discounts: null })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.discounts).toEqual([{ kind: "percentual", percent: 10 }]);
  });

  it("discounts (array, novo) é usado como está, ignorando discount legado", async () => {
    const novosDescontos = [{ kind: "percentual" as const, percent: 10 }, { kind: "valor_fixo" as const, amount: 500 }];
    const db = createFakeDb({
      sales: [baseSaleRow({ discount: { kind: "frete_gratis" }, discounts: novosDescontos })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.discounts).toEqual(novosDescontos);
  });

  it("sem discount e sem discounts, o array fica vazio", async () => {
    const db = createFakeDb({ sales: [baseSaleRow({ discount: null, discounts: null })] });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.discounts).toEqual([]);
  });

  it("discounts como array vazio (não null) ainda cai no fallback do discount legado", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow({ discount: { kind: "valor_fixo", amount: 200 }, discounts: [] })],
    });

    const [sale] = await fetchSales(USER, db.client);

    expect(sale.discounts).toEqual([{ kind: "valor_fixo", amount: 200 }]);
  });
});

describe("upsertSales — vendas novas nunca escrevem nas colunas legadas", () => {
  it("grava os itens em sale_items e null nas colunas legadas de sales", async () => {
    const db = createFakeDb();
    const sale = makeSale({ id: "sale-1", items: [makeSaleItem({ productId: "prod-1", quantity: 2, unitPrice: 1000 })] });

    await upsertSales(USER, [sale], db.client);

    const savedSale = db.tables.sales.find((r) => r.id === "sale-1")!;
    expect(savedSale.product_id).toBeNull();
    expect(savedSale.quantity).toBeNull();
    expect(savedSale.discount).toBeNull();
    expect(db.tables.sale_items).toHaveLength(1);
    expect(db.tables.sale_items[0]).toMatchObject({ product_id: "prod-1", quantity: 2, unit_price: 1000 });
  });

  it("uma venda relida depois do upsert não usa mais a via legada (tem sale_items, não sintetiza)", async () => {
    const db = createFakeDb();
    const sale = makeSale({ id: "sale-1", items: [makeSaleItem({ productId: "prod-1" })] });

    await upsertSales(USER, [sale], db.client);
    const [reloaded] = await fetchSales(USER, db.client);

    expect(reloaded.items).toHaveLength(1);
    expect(reloaded.items[0].productId).toBe("prod-1");
  });

  it("editar uma venda substitui os itens por completo (sem duplicar nem sobrar item antigo)", async () => {
    const db = createFakeDb();
    const original = makeSale({
      id: "sale-1",
      items: [makeSaleItem({ productId: "prod-1" }), makeSaleItem({ productId: "prod-2" })],
    });
    await upsertSales(USER, [original], db.client);
    expect(db.tables.sale_items).toHaveLength(2);

    const editado = { ...original, items: [makeSaleItem({ productId: "prod-3" })] };
    await upsertSales(USER, [editado], db.client);

    expect(db.tables.sale_items).toHaveLength(1);
    expect(db.tables.sale_items[0].product_id).toBe("prod-3");
  });

  it("não faz nada quando a lista de vendas está vazia", async () => {
    const db = createFakeDb();
    await upsertSales(USER, [], db.client);
    expect(db.tables.sales).toHaveLength(0);
  });
});

describe("tamanho e cor do item (migration 0004)", () => {
  it("grava o tamanho e a cor vendidos em sale_items e os devolve na leitura", async () => {
    const db = createFakeDb();
    const sale = makeSale({ id: "sale-1", items: [makeSaleItem({ productId: "prod-1", size: "M", color: "Preto" })] });

    await upsertSales(USER, [sale], db.client);

    expect(db.tables.sale_items[0]).toMatchObject({ size: "M", color: "Preto" });
    const [reloaded] = await fetchSales(USER, db.client);
    expect(reloaded.items[0]).toMatchObject({ size: "M", color: "Preto" });
  });

  it("produto sem variação grava null e relê como undefined (nunca a string 'null')", async () => {
    const db = createFakeDb();
    await upsertSales(USER, [makeSale({ id: "sale-1", items: [makeSaleItem({ productId: "prod-1" })] })], db.client);

    expect(db.tables.sale_items[0]).toMatchObject({ size: null, color: null });
    const [reloaded] = await fetchSales(USER, db.client);
    expect(reloaded.items[0].size).toBeUndefined();
    expect(reloaded.items[0].color).toBeUndefined();
  });

  it("vendas antigas (linhas sem as colunas novas) continuam legíveis", async () => {
    const db = createFakeDb({
      sales: [baseSaleRow()],
      sale_items: [{ id: "i1", sale_id: "sale-1", user_id: USER, product_id: "prod-1", quantity: 1, unit_price: 10000, subtotal: 10000 }],
    });
    const [sale] = await fetchSales(USER, db.client);
    expect(sale.items[0]).toMatchObject({ productId: "prod-1", quantity: 1 });
    expect(sale.items[0].size).toBeUndefined();
  });
});
