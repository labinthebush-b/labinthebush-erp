import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { AnySupabaseClient } from "./types";
import { getSupabaseServiceRoleKey, getSupabaseUrl } from "./env";

// Service-role ("admin") client — bypasses Row Level Security entirely.
// Server-only: it calls getSupabaseServiceRoleKey(), which reads
// SUPABASE_SERVICE_ROLE_KEY — an env var deliberately never prefixed with
// NEXT_PUBLIC_, so it doesn't exist in the browser bundle at all. Only
// import this file from Route Handlers/Server Actions/scripts, never from a
// "use client" component.
//
// Only two callers exist on purpose:
//   - scripts/seed-dev-data.ts (dev/local data only, never production)
//   - src/lib/ai/keys.ts, to resolve a raw API key -> user id, which by
//     definition happens before we have any Supabase session/JWT for that
//     user. Every query made with this client MUST filter by the resolved
//     user_id explicitly (RLS isn't there to save you here) — see
//     src/lib/ai/keys.ts and src/lib/ai/context.ts for the pattern.
export function createAdminClient(): AnySupabaseClient {
  return createSupabaseClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
