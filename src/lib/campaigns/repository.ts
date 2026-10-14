// The only file in lib/campaigns allowed to talk to Supabase.

import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Campaign, InstagramPostLink } from "./types";

type CampaignRow = {
  id: string;
  user_id: string;
  name: string;
  channel: string;
  start_date: string;
  end_date: string | null;
  cost: number | null;
  notes: string | null;
  utm_source: string;
  utm_medium: string;
  utm_campaign: string;
  created_at: string;
  updated_at: string;
};

type PostRow = {
  id: string;
  user_id: string;
  campaign_id: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

function rowToCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    channel: row.channel as Campaign["channel"],
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    cost: row.cost ?? undefined,
    notes: row.notes ?? undefined,
    utmSource: row.utm_source,
    utmMedium: row.utm_medium,
    utmCampaign: row.utm_campaign,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function campaignToRow(userId: string, c: Campaign): CampaignRow {
  return {
    id: c.id,
    user_id: userId,
    name: c.name,
    channel: c.channel,
    start_date: c.startDate,
    end_date: c.endDate ?? null,
    cost: c.cost ?? null,
    notes: c.notes ?? null,
    utm_source: c.utmSource,
    utm_medium: c.utmMedium,
    utm_campaign: c.utmCampaign,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  };
}

function rowToPost(row: PostRow): InstagramPostLink {
  return { id: row.id, campaignId: row.campaign_id ?? undefined, tags: row.tags ?? [], createdAt: row.created_at, updatedAt: row.updated_at };
}

function postToRow(userId: string, p: InstagramPostLink): PostRow {
  return { id: p.id, user_id: userId, campaign_id: p.campaignId ?? null, tags: p.tags, created_at: p.createdAt, updated_at: p.updatedAt };
}

export async function fetchCampaigns(userId: string, client: AnySupabaseClient = createClient()): Promise<Campaign[]> {
  const { data, error } = await client.from("campaigns").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as CampaignRow[]).map(rowToCampaign);
}

export async function upsertCampaigns(userId: string, campaigns: Campaign[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (campaigns.length === 0) return;
  const { error } = await client.from("campaigns").upsert(campaigns.map((c) => campaignToRow(userId, c)));
  if (error) throw error;
}

export async function deleteCampaigns(userId: string, ids: string[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await client.from("campaigns").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

export async function fetchPostLinks(userId: string, client: AnySupabaseClient = createClient()): Promise<InstagramPostLink[]> {
  const { data, error } = await client.from("instagram_posts").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as PostRow[]).map(rowToPost);
}

/** Chave primária é (user_id, id): o upsert precisa saber disso. */
export async function upsertPostLinks(userId: string, posts: InstagramPostLink[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (posts.length === 0) return;
  const { error } = await client.from("instagram_posts").upsert(posts.map((p) => postToRow(userId, p)), { onConflict: "user_id,id" });
  if (error) throw error;
}
