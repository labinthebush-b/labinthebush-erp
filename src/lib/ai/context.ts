// Turns an incoming HTTP request from an external AI assistant into a
// resolved (userId, client) pair, or null if it isn't authenticated. This is
// the ONLY place the AI integration layer decides who's calling — swapping
// the static-API-key scheme for a real OAuth flow later only touches this
// file; every tool in src/lib/ai/tools/* just receives a userId + client and
// doesn't know or care how they were resolved.
import { createAdminClient } from "@/lib/supabase/admin";
import type { AnySupabaseClient } from "@/lib/supabase/types";
import { resolveAccountId, resolveApiKey } from "./keys";

/** Header que o gatilho log_activity lê para saber qual chave de IA mudou o dado (0008). */
export const AI_KEY_HEADER = "x-erp-ai-key-id";

export type AiRequestContext = {
  /** A conta cujos dados são lidos e gravados: o dono, mesmo quando a chave é de um sócio. */
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
  const lookup = createAdminClient();
  const key = await resolveApiKey(rawKey, lookup);
  if (!key) return null;

  const userId = await resolveAccountId(key.userId, lookup);
  return { userId, client: createAdminClient({ [AI_KEY_HEADER]: key.keyId }) };
}
