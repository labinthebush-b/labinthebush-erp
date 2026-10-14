import { describe, expect, it } from "vitest";
import { EMPTY_STOCK_STATE, stockReducer } from "./stock-reducer";
import type { StockMovement } from "./types";

function movement(id: string, overrides: Partial<StockMovement> = {}): StockMovement {
  return {
    id,
    productId: "p1",
    quantity: 5,
    kind: "entrada",
    date: "2026-10-01",
    createdAt: "2026-10-01T00:00:00.000Z",
    updatedAt: "2026-10-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("stockReducer", () => {
  it("HYDRATE substitui o estado", () => {
    const state = stockReducer(EMPTY_STOCK_STATE, { type: "HYDRATE", state: { movements: [movement("a")] } });
    expect(state.movements.map((m) => m.id)).toEqual(["a"]);
  });

  it("ADD_MOVEMENT e ADD_MOVEMENTS acrescentam sem mexer nas existentes", () => {
    const first = movement("a");
    let state = stockReducer(EMPTY_STOCK_STATE, { type: "ADD_MOVEMENT", movement: first });
    state = stockReducer(state, { type: "ADD_MOVEMENTS", movements: [movement("b"), movement("c")] });
    expect(state.movements.map((m) => m.id)).toEqual(["a", "b", "c"]);
    expect(state.movements[0]).toBe(first); // mesma referência: o diff do Supabase não reenvia o que não mudou
  });

  it("ADD_MOVEMENTS vazio devolve o MESMO estado (nada a sincronizar)", () => {
    const state = { movements: [movement("a")] };
    expect(stockReducer(state, { type: "ADD_MOVEMENTS", movements: [] })).toBe(state);
  });

  it("UPDATE_MOVEMENT altera só a movimentação pedida e carimba updatedAt", () => {
    const a = movement("a");
    const b = movement("b");
    const state = stockReducer({ movements: [a, b] }, { type: "UPDATE_MOVEMENT", id: "a", changes: { quantity: -2 }, at: "2026-10-02T00:00:00.000Z" });
    expect(state.movements[0]).toMatchObject({ id: "a", quantity: -2, updatedAt: "2026-10-02T00:00:00.000Z" });
    expect(state.movements[1]).toBe(b);
  });

  it("DELETE_MOVEMENTS remove várias de uma vez; lista vazia não muda nada", () => {
    const state = { movements: [movement("a"), movement("b"), movement("c")] };
    expect(stockReducer(state, { type: "DELETE_MOVEMENTS", ids: ["a", "c"] }).movements.map((m) => m.id)).toEqual(["b"]);
    expect(stockReducer(state, { type: "DELETE_MOVEMENTS", ids: [] })).toBe(state);
  });

  it("DELETE_SALE_MOVEMENTS remove só as saídas daquela venda — a peça volta ao estoque", () => {
    const state = {
      movements: [
        movement("entrada"),
        movement("s1-a", { saleId: "s1", saleItemId: "i1", quantity: -1, kind: "saida" }),
        movement("s1-b", { saleId: "s1", saleItemId: "i2", quantity: -2, kind: "saida" }),
        movement("s2-a", { saleId: "s2", saleItemId: "i3", quantity: -1, kind: "saida" }),
      ],
    };
    expect(stockReducer(state, { type: "DELETE_SALE_MOVEMENTS", saleId: "s1" }).movements.map((m) => m.id)).toEqual(["entrada", "s2-a"]);
  });

  it("DELETE_SALE_MOVEMENTS de uma venda sem saídas devolve o mesmo estado", () => {
    const state = { movements: [movement("entrada")] };
    expect(stockReducer(state, { type: "DELETE_SALE_MOVEMENTS", saleId: "sem-saidas" })).toBe(state);
  });
});
