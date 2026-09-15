// "Propor → preview → confirmar" storage for AI-originated financial entries
// (public.ai_action_proposals — see supabase/migrations/0002_ai_integration.sql).
// The AI never writes to `transactions` directly: it creates a proposal here,
// shows the user the preview text, and only src/lib/ai/tools/transactions.ts's
// confirm step calls the real finance repository.
import type { AnySupabaseClient } from "@/lib/supabase/types";
import type { NewTransactionInput } from "@/lib/finance/actions";

export type ProposalKind = "transaction";

export type Proposal = {
  id: string;
  userId: string;
  kind: ProposalKind;
  payload: NewTransactionInput;
  previewText: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  createdAt: string;
  expiresAt: string;
};

type ProposalRow = {
  id: string;
  user_id: string;
  kind: string;
  payload: NewTransactionInput;
  preview_text: string;
  status: Proposal["status"];
  created_at: string;
  expires_at: string;
};

function rowToProposal(row: ProposalRow): Proposal {
  return {
    id: row.id,
    userId: row.user_id,
    kind: row.kind as ProposalKind,
    payload: row.payload,
    previewText: row.preview_text,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
  };
}

export async function createProposal(
  userId: string,
  kind: ProposalKind,
  payload: NewTransactionInput,
  previewText: string,
  client: AnySupabaseClient
): Promise<Proposal> {
  const { data, error } = await client
    .from("ai_action_proposals")
    .insert({ user_id: userId, kind, payload, preview_text: previewText })
    .select("*")
    .single();
  if (error) throw error;
  return rowToProposal(data as ProposalRow);
}

/** Returns null if the proposal doesn't exist or doesn't belong to `userId` — callers must treat that the same as "not found", never leak which case it was. */
export async function getOwnProposal(userId: string, id: string, client: AnySupabaseClient): Promise<Proposal | null> {
  const { data, error } = await client.from("ai_action_proposals").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data ? rowToProposal(data as ProposalRow) : null;
}

export async function markProposalConfirmed(id: string, client: AnySupabaseClient): Promise<void> {
  const { error } = await client
    .from("ai_action_proposals")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function markProposalCancelled(id: string, client: AnySupabaseClient): Promise<void> {
  const { error } = await client.from("ai_action_proposals").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export function isExpired(proposal: Proposal): boolean {
  return new Date(proposal.expiresAt).getTime() < Date.now();
}
