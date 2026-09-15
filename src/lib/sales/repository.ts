import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Sale } from "./types";

type SaleRow = {
  id: string;
  user_id: string;
  date: string;
  contact_id: string | null;
  product_id: string;
  quantity: number;
  coupon_code: string | null;
  subtotal: number | null;
  discount: Sale["discount"] | null;
  shipping_amount: number | null;
  shipping_cost: number | null;
  total_amount: number;
  channel: string;
  notes: string | null;
  transaction_id: string;
  shipping_transaction_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToSale(row: SaleRow): Sale {
  return {
    id: row.id,
    date: row.date,
    contactId: row.contact_id ?? undefined,
    productId: row.product_id,
    quantity: row.quantity,
    couponCode: row.coupon_code ?? undefined,
    subtotal: row.subtotal ?? undefined,
    discount: row.discount ?? undefined,
    shippingAmount: row.shipping_amount ?? undefined,
    shippingCost: row.shipping_cost ?? undefined,
    totalAmount: row.total_amount,
    channel: row.channel as Sale["channel"],
    notes: row.notes ?? undefined,
    transactionId: row.transaction_id,
    shippingTransactionId: row.shipping_transaction_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function saleToRow(userId: string, sale: Sale): SaleRow {
  return {
    id: sale.id,
    user_id: userId,
    date: sale.date,
    contact_id: sale.contactId ?? null,
    product_id: sale.productId,
    quantity: sale.quantity,
    coupon_code: sale.couponCode ?? null,
    subtotal: sale.subtotal ?? null,
    discount: sale.discount ?? null,
    shipping_amount: sale.shippingAmount ?? null,
    shipping_cost: sale.shippingCost ?? null,
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
