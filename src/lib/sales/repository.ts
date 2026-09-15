import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Discount, Sale, SaleItem } from "./types";

type SaleRow = {
  id: string;
  user_id: string;
  date: string;
  contact_id: string | null;
  // Legado (pré-múltiplos-itens) — nulo em toda venda criada a partir de
  // agora; ver legacyRowToItems.
  product_id: string | null;
  quantity: number | null;
  coupon_code: string | null;
  subtotal: number | null;
  discount: Discount | null;
  // Atual.
  items: SaleItem[] | null;
  discounts: Discount[] | null;
  shipping_amount: number | null;
  shipping_cost: number | null;
  nuvemshop_fee_amount: number | null;
  nuvemshop_fee_transaction_id: string | null;
  total_amount: number;
  channel: string;
  notes: string | null;
  transaction_id: string;
  shipping_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

/**
 * Vendas registradas antes da introdução de `items` só têm as colunas
 * legadas (product_id/quantity/subtotal). Sintetiza um `items` de um item só
 * a partir delas para que o resto do app nunca precise saber que essa venda
 * é antiga — `subtotal` (ou total_amount, se nem subtotal existir) é mantido
 * como está, mesmo que não seja exatamente quantity*unitPrice depois do
 * arredondamento; isso é só uma leitura de compatibilidade, nunca é
 * regravado.
 */
function legacyRowToItems(row: SaleRow): SaleItem[] {
  if (row.items && row.items.length > 0) return row.items;
  if (!row.product_id) return [];
  const quantity = row.quantity ?? 1;
  const subtotal = row.subtotal ?? row.total_amount;
  const unitPrice = quantity > 0 ? Math.round(subtotal / quantity) : subtotal;
  return [{ id: `${row.id}-item-legado`, productId: row.product_id, quantity, unitPrice, subtotal }];
}

function legacyRowToDiscounts(row: SaleRow): Discount[] {
  if (row.discounts && row.discounts.length > 0) return row.discounts;
  return row.discount ? [row.discount] : [];
}

function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id,
    date: row.date,
    contactId: row.contact_id ?? undefined,
    items: legacyRowToItems(row),
    discounts: legacyRowToDiscounts(row),
    shippingAmount: row.shipping_amount ?? undefined,
    shippingCost: row.shipping_cost ?? undefined,
    nuvemshopFeeAmount: row.nuvemshop_fee_amount ?? undefined,
    totalAmount: row.total_amount,
    channel: row.channel as Sale["channel"],
    notes: row.notes ?? undefined,
    transactionId: row.transaction_id,
    shippingTransactionId: row.shipping_transaction_id ?? undefined,
    nuvemshopFeeTransactionId: row.nuvemshop_fee_transaction_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Vendas novas/editadas nunca voltam a escrever nas colunas legadas — só `items`/`discounts` a partir daqui. */
function saleToRow(userId: string, sale: Sale): SaleRow {
  return {
    id: sale.id,
    user_id: userId,
    date: sale.date,
    contact_id: sale.contactId ?? null,
    product_id: null,
    quantity: null,
    coupon_code: null,
    subtotal: null,
    discount: null,
    items: sale.items,
    discounts: sale.discounts,
    shipping_amount: sale.shippingAmount ?? null,
    shipping_cost: sale.shippingCost ?? null,
    nuvemshop_fee_amount: sale.nuvemshopFeeAmount ?? null,
    nuvemshop_fee_transaction_id: sale.nuvemshopFeeTransactionId ?? null,
    total_amount: sale.totalAmount,
    channel: sale.channel,
    notes: sale.notes ?? null,
    transaction_id: sale.transactionId,
    shipping_transaction_id: sale.shippingTransactionId ?? null,
    created_at: sale.createdAt,
    updated_at: sale.updatedAt,
  };
}

export async function fetchSales(userId: string, client: AnySupabaseClient = createClient()): Promise<Sale[]> {
  const { data, error } = await client.from("sales").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as SaleRow[]).map(rowToSale);
}

export async function upsertSales(userId: string, sales: Sale[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (sales.length === 0) return;
  const { error } = await client.from("sales").upsert(sales.map((s) => saleToRow(userId, s)));
  if (error) throw error;
}

export async function deleteSales(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("sales").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
