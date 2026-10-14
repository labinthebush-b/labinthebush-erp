import type { Sale, SaleItem } from "./types";
import { buildSaleItem } from "./calculations";

let counter = 0;

/** Builds a valid single-item SaleItem for tests, with sensible defaults that can be overridden. */
export function makeSaleItem(overrides: Partial<Pick<SaleItem, "productId" | "size" | "color" | "quantity" | "unitPrice">> = {}): SaleItem {
  return buildSaleItem({ productId: "p1", quantity: 1, unitPrice: 10000, ...overrides });
}

/** Builds a valid Sale for tests (one item by default), with sensible defaults that can be overridden. */
export function makeSale(overrides: Partial<Sale> = {}): Sale {
  counter += 1;
  return {
    id: `s${counter}`,
    date: "2026-09-10",
    items: [makeSaleItem()],
    discounts: [],
    totalAmount: 10000,
    channel: "instagram",
    transactionId: `t${counter}`,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    ...overrides,
  };
}
