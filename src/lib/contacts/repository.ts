import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Contact } from "./types";

type ContactRow = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  stage_id: string | null;
  tags: Contact["tags"];
  whatsapp: string | null;
  instagram: string | null;
  email: string | null;
  custom_fields: Contact["customFields"];
  created_at: string;
  updated_at: string;
};

function rowToContact(row: ContactRow): Contact {
  return {
    id: row.id,
    name: row.name,
    status: row.status as Contact["status"],
    stageId: row.stage_id ?? undefined,
    tags: row.tags ?? undefined,
    whatsapp: row.whatsapp ?? undefined,
    instagram: row.instagram ?? undefined,
    email: row.email ?? undefined,
    customFields: row.custom_fields ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function contactToRow(userId: string, contact: Contact): ContactRow {
  return {
    id: contact.id,
    user_id: userId,
    name: contact.name,
    status: contact.status,
    stage_id: contact.stageId ?? null,
    tags: contact.tags ?? [],
    whatsapp: contact.whatsapp ?? null,
    instagram: contact.instagram ?? null,
    email: contact.email ?? null,
    custom_fields: contact.customFields,
    created_at: contact.createdAt,
    updated_at: contact.updatedAt,
  };
}

export async function fetchContacts(userId: string, client: AnySupabaseClient = createClient()): Promise<Contact[]> {
  const { data, error } = await client.from("contacts").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as ContactRow[]).map(rowToContact);
}

export async function upsertContacts(userId: string, contacts: Contact[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (contacts.length === 0) return;
  const { error } = await client.from("contacts").upsert(contacts.map((c) => contactToRow(userId, c)));
  if (error) throw error;
}

export async function deleteContacts(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("contacts").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
