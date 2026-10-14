// The only file in lib/stock allowed to talk to Supabase — stock-provider calls
// these functions, so the domain logic (calculations, reducer) never knows
// persistence exists.

import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { StockMovement } from "./types";

type StockMovementRow = {
  id: string;
  user_id: string;
  product_id: string;
  size: string | null;
  color: string | null;
  quantity: number;
  kind: string;
  date: string;
  note: string | null;
  sale_id: string | null;
  sale_item_id: string | null;
  created_at: string;
  updated_at: string;
};

function rowToMovement(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    size: row.size ?? undefined,
    color: row.color ?? undefined,
    quantity: row.quantity,
    kind: row.kind as StockMovement["kind"],
    date: row.date,
    note: row.note ?? undefined,
    saleId: row.sale_id ?? undefined,
    saleItemId: row.sale_item_id ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function movementToRow(userId: string, movement: StockMovement): StockMovementRow {
  return {
    id: movement.id,
    user_id: userId,
    product_id: movement.productId,
    size: movement.size ?? null,
    color: movement.color ?? null,
    quantity: movement.quantity,
    kind: movement.kind,
    date: movement.date,
    note: movement.note ?? null,
    sale_id: movement.saleId ?? null,
    sale_item_id: movement.saleItemId ?? null,
    created_at: movement.createdAt,
    updated_at: movement.updatedAt,
  };
}

export async function fetchStockMovements(userId: string, client: AnySupabaseClient = createClient()): Promise<StockMovement[]> {
  const { data, error } = await client.from("stock_movements").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as StockMovementRow[]).map(rowToMovement);
}

export async function upsertStockMovements(
  userId: string,
  movements: StockMovement[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (movements.length === 0) return;
  const { error } = await client.from("stock_movements").upsert(movements.map((m) => movementToRow(userId, m)));
  if (error) throw error;
}

export async function deleteStockMovements(
  userId: string,
  ids: string[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from("stock_movements").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
