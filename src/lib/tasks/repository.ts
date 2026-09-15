import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Task } from "./types";

type TaskRow = {
  id: string;
  user_id: string;
  title: string;
  status: string;
  description: string | null;
  priority: string | null;
  due_date: string | null;
  category: string | null;
  checklist: Task["checklist"];
  attachments: Task["attachments"];
  relations: Task["relations"] | null;
  completed_at: string | null;
  order: number | null;
  tags: Task["tags"];
  created_at: string;
  updated_at: string;
};

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    status: row.status as Task["status"],
    description: row.description ?? undefined,
    priority: (row.priority as Task["priority"]) ?? undefined,
    dueDate: row.due_date ?? undefined,
    category: row.category ?? undefined,
    checklist: row.checklist ?? undefined,
    attachments: row.attachments ?? undefined,
    relations: row.relations ?? undefined,
    completedAt: row.completed_at ?? undefined,
    order: row.order ?? undefined,
    tags: row.tags ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function taskToRow(userId: string, task: Task): TaskRow {
  return {
    id: task.id,
    user_id: userId,
    title: task.title,
    status: task.status,
    description: task.description ?? null,
    priority: task.priority ?? null,
    due_date: task.dueDate ?? null,
    category: task.category ?? null,
    checklist: task.checklist ?? [],
    attachments: task.attachments ?? [],
    relations: task.relations ?? null,
    completed_at: task.completedAt ?? null,
    order: task.order ?? null,
    tags: task.tags ?? [],
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  };
}

export async function fetchTasks(userId: string, client: AnySupabaseClient = createClient()): Promise<Task[]> {
  const { data, error } = await client.from("tasks").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as TaskRow[]).map(rowToTask);
}

export async function upsertTasks(userId: string, tasks: Task[], client: AnySupabaseClient = createClient()): Promise<void> {
  if (tasks.length === 0) return;
  const { error } = await client.from("tasks").upsert(tasks.map((t) => taskToRow(userId, t)));
  if (error) throw error;
}

export async function deleteTasks(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("tasks").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
