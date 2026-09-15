import { describe, expect, it } from "vitest";
import { salesReducer, EMPTY_SALES_STATE } from "./sales-reducer";
import { makeSale } from "./test-helpers";

const sale = makeSale({ id: "s1", contactId: "ct1", transactionId: "t1" });

describe("salesReducer", () => {
  it("ADD_SALE adiciona a venda com a relação de transactionId preservada", () => {
    const state = salesReducer(EMPTY_SALES_STATE, { type: "ADD_SALE", sale });
    expect(state.sales).toHaveLength(1);
    expect(state.sales[0].transactionId).toBe("t1");
    expect(state.sales[0].items[0].productId).toBe("p1");
    expect(state.sales[0].contactId).toBe("ct1");
  });

  it("UPDATE_SALE atualiza a venda existente sem criar uma segunda entrada (sem duplicar)", () => {
    let state = salesReducer(EMPTY_SALES_STATE, { type: "ADD_SALE", sale });
    state = salesReducer(state, {
      type: "UPDATE_SALE",
      id: "s1",
      changes: { shippingCost: 3500, shippingTransactionId: "shipping-t1" },
      at: "2026-09-11T00:00:00.000Z",
    });
    expect(state.sales).toHaveLength(1);
    expect(state.sales[0].shippingCost).toBe(3500);
    expect(state.sales[0].shippingTransactionId).toBe("shipping-t1");
    expect(state.sales[0].updatedAt).toBe("2026-09-11T00:00:00.000Z");
  });

  it("UPDATE_SALE remove o vínculo de frete quando o custo é zerado", () => {
    let state = salesReducer(EMPTY_SALES_STATE, {
      type: "ADD_SALE",
      sale: { ...sale, shippingCost: 3000, shippingTransactionId: "shipping-t1" },
    });
    state = salesReducer(state, {
      type: "UPDATE_SALE",
      id: "s1",
      changes: { shippingCost: 0, shippingTransactionId: undefined },
      at: "2026-09-11T00:00:00.000Z",
    });
    expect(state.sales[0].shippingCost).toBe(0);
    expect(state.sales[0].shippingTransactionId).toBeUndefined();
  });

  it("DELETE_SALE remove a venda", () => {
    let state = salesReducer(EMPTY_SALES_STATE, { type: "ADD_SALE", sale });
    state = salesReducer(state, { type: "DELETE_SALE", id: "s1" });
    expect(state.sales).toHaveLength(0);
  });

  it("HYDRATE substitui o estado inteiro com os dados persistidos", () => {
    const persisted = { sales: [{ ...sale, id: "persisted-1" }] };
    const state = salesReducer(EMPTY_SALES_STATE, { type: "HYDRATE", state: persisted });
    expect(state.sales).toHaveLength(1);
    expect(state.sales[0].id).toBe("persisted-1");
  });
});
