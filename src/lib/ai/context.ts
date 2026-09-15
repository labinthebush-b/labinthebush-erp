// Turns an incoming HTTP request from an external AI assistant into a
// resolved (userId, client) pair, or null if it isn't authenticated. This is
// the ONLY place the AI integration layer decides who's calling — swapping
// the static-API-key scheme for a real OAuth flow later only touches this
// file; every tool in src/lib/ai/tools/* just receives a userId + client and
// doesn't know or care how they were resolved.
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnySupabaseClient } from "@/lib/supabase/types";
import { resolveUserIdFromApiKey } from "./keys";

export type AiRequestContext = {
  userId: string;
  /**
   * Service-role client. Every call made with it in the tools layer filters
   * explicitly by `userId` (never relies on RLS alone) — see the comment on
   * resolveUserIdFromApiKey for why this is the one sanctioned exception to
   * "repositories run under the user's own session".
   */
  client: AnySupabaseClient;
};

export async function resolveAiRequestContext(request: Request): Promise<AiRequestContext | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const match = /^Bearer\s+(.+)$/i.exec(authHeader);
  if (!match) return null;

  const rawKey = match[1].trim();
  const client = createAdminClient();
  const userId = await resolveUserIdFromApiKey(rawKey, client);
  if (!userId) return null;

  return { userId, client };
}
