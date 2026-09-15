// Personal API keys that let an external AI assistant (ChatGPT, Claude, ...)
// call the ERP's AI integration API on the user's behalf — see
// src/app/api/ai/route.ts and src/lib/ai/context.ts.
//
// Design: one static, revocable, per-user key (like a GitHub PAT), not an
// OAuth flow. This app is single-user today and every existing provider
// already only ever knows about "the current user" — building a full OAuth
// client-registration dance for ChatGPT/Claude at this stage would be
// speculative complexity for a need that doesn't exist yet (see AGENTS'
// instruction not to invent abstractions). A static key is exactly what
// both ChatGPT Custom GPT Actions (API key auth) and Claude's remote MCP
// connectors (bearer token auth) already support natively, so nothing here
// is tied to one provider. Swapping this for real OAuth later only touches
// src/lib/ai/context.ts's `resolveUserFromRequest` — everything downstream
// (the tools) is unaffected.
import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";

const KEY_PREFIX = "sk_erp_";

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export type ApiKeySummary = {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt: string | null;
};

type ApiKeyRow = {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

function rowToSummary(row: ApiKeyRow): ApiKeySummary {
  return { id: row.id, name: row.name, keyPrefix: row.key_prefix, createdAt: row.created_at, lastUsedAt: row.last_used_at };
}

/** Called from Configurações (authenticated browser session) — insert respects RLS: user_id must equal auth.uid(). */
export async function listApiKeys(userId: string, client: AnySupabaseClient = createClient()): Promise<ApiKeySummary[]> {
  const { data, error } = await client
    .from("ai_api_keys")
    .select("id, name, key_prefix, created_at, last_used_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data as ApiKeyRow[]).map(rowToSummary);
}

/**
 * Creates a new key and returns the raw value ONCE — it is never stored and
 * can't be retrieved again, same as GitHub/Stripe-style tokens. Only the
 * hash is persisted.
 */
export async function createApiKey(
  userId: string,
  name: string,
  client: AnySupabaseClient = createClient()
): Promise<{ summary: ApiKeySummary; rawKey: string }> {
  const rawKey = `${KEY_PREFIX}${randomToken()}`;
  const keyHash = await sha256Hex(rawKey);
  const keyPrefix = rawKey.slice(0, KEY_PREFIX.length + 6);

  const { data, error } = await client
    .from("ai_api_keys")
    .insert({ user_id: userId, name, key_hash: keyHash, key_prefix: keyPrefix })
    .select("id, name, key_prefix, created_at, last_used_at")
    .single();
  if (error) throw error;

  return { summary: rowToSummary(data as ApiKeyRow), rawKey };
}

export async function revokeApiKey(userId: string, id: string, client: AnySupabaseClient = createClient()): Promise<void> {
  const { error } = await client.from("ai_api_keys").delete().eq("user_id", userId).eq("id", id);
  if (error) throw error;
}

/**
 * Resolves a raw API key (as presented by an external AI in an
 * `Authorization: Bearer <key>` header) to the owning user id. `client` MUST
 * be an admin (service-role) client here — at this point we don't yet know
 * who's calling, so there's no user session/JWT for RLS to key off of. This
 * is the one intentional, explicitly-scoped use of the admin client outside
 * scripts/seed-dev-data.ts.
 */
export async function resolveUserIdFromApiKey(rawKey: string, adminClient: AnySupabaseClient): Promise<string | null> {
  if (!rawKey.startsWith(KEY_PREFIX)) return null;
  const keyHash = await sha256Hex(rawKey);

  const { data, error } = await adminClient.from("ai_api_keys").select("id, user_id").eq("key_hash", keyHash).maybeSingle();
  if (error) throw error;
  if (!data) return null;

  // Best-effort — a failure to update last_used_at must never block the actual request.
  await adminClient.from("ai_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", data.id);

  return data.user_id as string;
}
