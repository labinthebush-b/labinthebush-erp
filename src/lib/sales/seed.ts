import type { Sale } from "./types";
import { buildSaleItem } from "./calculations";

// Mirrors the "Venda ..." income transactions already seeded in
// lib/finance/seed.ts (same id, amount and date) so the Vendas module and the
// Financeiro/Dashboard numbers agree from the very first run — otherwise the
// Dashboard would show "Vendas: R$ 0,00" while Financeiro already has
// revenue, which is exactly the kind of cross-module inconsistency Fase 5
// exists to remove.

const now = new Date().toISOString();

function iso(daysFromNow: number): string {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  return date.toISOString().slice(0, 10);
}

export const SEED_SALES: Sale[] = [
  {
    id: "seed-sale-1",
    date: iso(-5),
    contactId: "seed-contact-1", // Ana Beatriz Souza
    items: [buildSaleItem({ id: "seed-sale-1-item-1", productId: "seed-product-1", quantity: 1, unitPrice: 34900 })], // Camiseta Oversized Preta
    discounts: [],
    totalAmount: 34900,
    channel: "nuvemshop",
    transactionId: "seed-2",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "seed-sale-2",
    date: iso(-3),
    contactId: "seed-contact-3", // Juliana Prado
    items: [buildSaleItem({ id: "seed-sale-2-item-1", productId: "seed-product-2", quantity: 1, unitPrice: 52000 })], // Moletom Canguru Cinza
    discounts: [],
    totalAmount: 52000,
    channel: "whatsapp",
    transactionId: "seed-3",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: "seed-sale-3",
    date: iso(1),
    contactId: "seed-contact-2", // Carlos Mendes
    items: [buildSaleItem({ id: "seed-sale-3-item-1", productId: "seed-product-1", quantity: 1, unitPrice: 18990 })],
    discounts: [{ kind: "percentual", percent: 10, code: "BEMVINDO10" }],
    totalAmount: 18990,
    channel: "instagram",
    transactionId: "seed-4",
    createdAt: now,
    updatedAt: now,
  },
];
