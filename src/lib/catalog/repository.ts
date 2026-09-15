// The only file in lib/catalog allowed to talk to Supabase — catalog-provider
// calls these functions instead of touching the client directly, so the
// domain logic (catalog-reducer, calculations) never knows persistence
// exists at all.

import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Product } from "./types";

type ProductRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  price: number | null;
  cost_components: Product["costComponents"];
  image: string | null;
  category: string | null;
  collection: string | null;
  sku: string | null;
  sizes: string[] | null;
  colors: string[] | null;
  supplier: string | null;
  description: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function rowToProduct(row: ProductRow): Product {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Product["status"],
    price: row.price ?? undefined,
    costComponents: row.cost_components ?? [],
    image: row.image ?? undefined,
    category: row.category ?? undefined,
    collection: row.collection ?? undefined,
    sku: row.sku ?? undefined,
    sizes: row.sizes ?? undefined,
    colors: row.colors ?? undefined,
    supplier: row.supplier ?? undefined,
    description: row.description ?? undefined,
    notes: row.notes ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function productToRow(userId: string, product: Product): ProductRow {
  return {
    id: product.id,
    user_id: userId,
    name: product.name,
    status: product.status,
    price: product.price ?? null,
    cost_components: product.costComponents,
    image: product.image ?? null,
    category: product.category ?? null,
    collection: product.collection ?? null,
    sku: product.sku ?? null,
    sizes: product.sizes ?? null,
    colors: product.colors ?? null,
    supplier: product.supplier ?? null,
    description: product.description ?? null,
    notes: product.notes ?? null,
    created_at: product.createdAt,
    updated_at: product.updatedAt,
  };
}

export async function fetchProducts(userId: string, client: AnySupabaseClient = createClient()): Promise<Product[]> {
  const { data, error } = await client.from("products").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as ProductRow[]).map(rowToProduct);
}

/** `client` defaults to the browser client; the dev seed script (scripts/seed-dev-data.ts) passes an admin client instead, reusing this exact mapping. */
export async function upsertProducts(userId: string, products: Product[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (products.length === 0) return;
  const { error } = await client.from("products").upsert(products.map((p) => productToRow(userId, p)));
  if (error) throw error;
}

export async function deleteProducts(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("products").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
