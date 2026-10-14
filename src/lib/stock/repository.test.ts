import { describe, expect, it } from "vitest";
import { deleteStockMovements, fetchStockMovements, upsertStockMovements } from "./repository";
import type { StockMovement } from "./types";
import type { AnySupabaseClient } from "@/lib/supabase/types";

// Fake em memória do client do Supabase, só para `stock_movements` — mesmo
// padrão de src/lib/sales/repository.test.ts.
type Row = Record<string, unknown>;

function createFakeDb(seed: Row[] = []) {
  const rows: Row[] = [...seed];

  function builder() {
    let operation: "select" | "upsert" | "delete" = "select";
    let upsertRows: Row[] = [];
    const eqFilters: { column: string; value: unknown }[] = [];
    let inFilter: { column: string; values: unknown[] } | null = null;

    const matches = (row: Row) =>
      eqFilters.every(({ column, value }) => row[column] === value) && (!inFilter || inFilter.values.includes(row[inFilter.column]));

    function run() {
      if (operation === "upsert") {
        for (const row of upsertRows) {
          const i = rows.findIndex((r) => r.id === row.id);
          if (i >= 0) rows[i] = row;
          else rows.push(row);
        }
        return { data: upsertRows, error: null };
      }
      if (operation === "delete") {
        const removed = rows.filter(matches);
        for (const row of removed) rows.splice(rows.indexOf(row), 1);
        return { data: removed, error: null };
      }
      return { data: rows.filter(matches), error: null };
    }

    const b = {
      select: () => b,
      upsert: (v: Row[]) => {
        operation = "upsert";
        upsertRows = v;
        return b;
      },
      delete: () => {
        operation = "delete";
        return b;
      },
      eq: (column: string, value: unknown) => {
        eqFilters.push({ column, value });
        return b;
      },
      in: (column: string, values: unknown[]) => {
        inFilter = { column, values };
        return b;
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) => Promise.resolve(run()).then(onFulfilled, onRejected),
    };
    return b;
  }

  return {
    rows,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake de teste
    client: { from: () => builder() } as any as AnySupabaseClient,
  };
}

const USER = "user-1";

const manual: StockMovement = {
  id: "m1",
  productId: "p1",
  size: "M",
  color: "Preto",
  quantity: 10,
  kind: "entrada",
  date: "2026-10-01",
  note: "lote de outubro",
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
};

describe("stock repository", () => {
  it("grava com user_id e nomes de coluna do banco; opcionais ausentes viram null", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [{ ...manual, size: undefined, color: undefined, note: undefined }], db.client);
    expect(db.rows).toEqual([
      {
        id: "m1",
        user_id: USER,
        product_id: "p1",
        size: null,
        color: null,
        quantity: 10,
        kind: "entrada",
        date: "2026-10-01",
        note: null,
        sale_id: null,
        sale_item_id: null,
        created_at: "2026-10-01T00:00:00.000Z",
        updated_at: "2026-10-01T00:00:00.000Z",
      },
    ]);
  });

  it("ida e volta: o que se grava é exatamente o que se lê (inclusive a ligação com a venda)", async () => {
    const db = createFakeDb();
    const sale: StockMovement = { ...manual, id: "m2", quantity: -2, kind: "saida", saleId: "s1", saleItemId: "i1", note: undefined };
    await upsertStockMovements(USER, [manual, sale], db.client);
    const read = await fetchStockMovements(USER, db.client);
    expect(read).toEqual([manual, sale]);
  });

  it("opcionais nulos voltam como undefined (não como null)", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [{ ...manual, size: undefined, color: undefined, note: undefined }], db.client);
    const [read] = await fetchStockMovements(USER, db.client);
    expect(read.size).toBeUndefined();
    expect(read.color).toBeUndefined();
    expect(read.note).toBeUndefined();
    expect(read.saleId).toBeUndefined();
  });

  it("só devolve as movimentações do próprio usuário", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [manual], db.client);
    await upsertStockMovements("outro-usuario", [{ ...manual, id: "m9" }], db.client);
    const read = await fetchStockMovements(USER, db.client);
    expect(read.map((m) => m.id)).toEqual(["m1"]);
  });

  it("gravar de novo o mesmo id atualiza em vez de duplicar", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [manual], db.client);
    await upsertStockMovements(USER, [{ ...manual, quantity: 12 }], db.client);
    expect(db.rows).toHaveLength(1);
    expect((await fetchStockMovements(USER, db.client))[0].quantity).toBe(12);
  });

  it("lista vazia não toca o banco", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [], db.client);
    await deleteStockMovements(USER, [], db.client);
    expect(db.rows).toEqual([]);
  });

  it("apagar remove só os ids pedidos, e só do próprio usuário", async () => {
    const db = createFakeDb();
    await upsertStockMovements(USER, [manual, { ...manual, id: "m2" }], db.client);
    await upsertStockMovements("outro-usuario", [{ ...manual, id: "m3" }], db.client);
    await deleteStockMovements(USER, ["m1", "m3"], db.client); // m3 é de outro usuário: não pode cair
    expect(db.rows.map((r) => r.id).sort()).toEqual(["m2", "m3"]);
  });
});
