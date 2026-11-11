// The only file in lib/activity allowed to talk to Supabase.

import { createClient } from "@/lib/supabase/client";
import type { ActivityAction } from "./format";

export type UserProfile = {
  userId: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type ActivityEntry = {
  id: number;
  actorId: string | null;
  actorEmail: string | null;
  entity: string;
  action: ActivityAction;
  summary: string | null;
  createdAt: string;
};

type ProfileRow = { user_id: string; display_name: string | null; avatar_url: string | null };
type ActivityRow = {
  id: number;
  actor_id: string | null;
  actor_email: string | null;
  entity: string;
  action: ActivityAction;
  summary: string | null;
  created_at: string;
};

const BUCKET = "user-avatars";

function rowToProfile(row: ProfileRow): UserProfile {
  return { userId: row.user_id, displayName: row.display_name, avatarUrl: row.avatar_url };
}

export async function fetchActivity(accountId: string, limit: number): Promise<ActivityEntry[]> {
  const { data, error } = await createClient()
    .from("activity_log")
    .select("id, actor_id, actor_email, entity, action, summary, created_at")
    .eq("user_id", accountId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as ActivityRow[]).map((row) => ({
    id: row.id,
    actorId: row.actor_id,
    actorEmail: row.actor_email,
    entity: row.entity,
    action: row.action,
    summary: row.summary,
    createdAt: row.created_at,
  }));
}

export async function fetchAccountProfiles(accountId: string): Promise<UserProfile[]> {
  const { data, error } = await createClient()
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .eq("account_id", accountId);
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map(rowToProfile);
}

/** The signed-in login's own profile (not the account owner's). */
export async function fetchMyProfile(): Promise<UserProfile | null> {
  const supabase = createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data, error } = await supabase
    .from("user_profiles")
    .select("user_id, display_name, avatar_url")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : { userId: auth.user.id, displayName: null, avatarUrl: null };
}

export async function saveMyProfile(accountId: string, profile: UserProfile): Promise<void> {
  const { error } = await createClient().from("user_profiles").upsert({
    user_id: profile.userId,
    account_id: accountId,
    display_name: profile.displayName,
    avatar_url: profile.avatarUrl,
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

/** Returns the public URL, with a version so a replaced photo isn't served from cache. */
export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const storage = createClient().storage.from(BUCKET);
  const path = `${userId}/avatar`;
  const { error } = await storage.upload(path, file, { upsert: true, contentType: file.type });
  if (error) throw error;
  return `${storage.getPublicUrl(path).data.publicUrl}?v=${Date.now()}`;
}
