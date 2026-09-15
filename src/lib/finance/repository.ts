// The only file in lib/finance allowed to talk to Supabase. Finance has five
// sub-collections (transactions, custom categories, installment groups,
// recurring rules, month closings) instead of one — each gets its own
// row/mapper pair below, but the shape mirrors every other domain's
// repository (fetch/upsert/delete).

import type { AnySupabaseClient } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/client";
import type { Category, InstallmentGroup, MonthClosing, RecurringRule, Transaction } from "./types";

// ---------------------------------------------------------------------------
// Transactions
// ---------------------------------------------------------------------------

type TransactionRow = {
  id: string;
  user_id: string;
  type: string;
  amount: number;
  date: string;
  category: string;
  description: string;
  payment_source: string;
  status: string;
  due_date: string | null;
  notes: string | null;
  attachments: Transaction["attachments"];
  relations: Transaction["relations"] | null;
  installment: Transaction["installment"] | null;
  edited: boolean;
  edit_history: Transaction["editHistory"];
  created_at: string;
  updated_at: string;
};

function rowToTransaction(row: TransactionRow): Transaction {
  return {
    id: row.id,
    type: row.type as Transaction["type"],
    amount: row.amount,
    date: row.date,
    category: row.category,
    description: row.description,
    paymentSource: row.payment_source as Transaction["paymentSource"],
    status: row.status as Transaction["status"],
    dueDate: row.due_date ?? undefined,
    notes: row.notes ?? undefined,
    attachments: row.attachments ?? undefined,
    relations: row.relations ?? undefined,
    installment: row.installment ?? undefined,
    edited: row.edited,
    editHistory: row.edit_history ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function transactionToRow(userId: string, t: Transaction): TransactionRow {
  return {
    id: t.id,
    user_id: userId,
    type: t.type,
    amount: t.amount,
    date: t.date,
    category: t.category,
    description: t.description,
    payment_source: t.paymentSource,
    status: t.status,
    due_date: t.dueDate ?? null,
    notes: t.notes ?? null,
    attachments: t.attachments ?? [],
    relations: t.relations ?? null,
    installment: t.installment ?? null,
    edited: t.edited,
    edit_history: t.editHistory ?? [],
    created_at: t.createdAt,
    updated_at: t.updatedAt,
  };
}

export async function fetchTransactions(
  userId: string,
  client: AnySupabaseClient = createClient()
): Promise<Transaction[]> {
  const { data, error } = await client.from("transactions").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as TransactionRow[]).map(rowToTransaction);
}

export async function upsertTransactions(
  userId: string,
  transactions: Transaction[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (transactions.length === 0) return;
  const { error } = await client.from("transactions").upsert(transactions.map((t) => transactionToRow(userId, t)));
  if (error) throw error;
}

export async function deleteTransactionRows(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("transactions").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Custom categories (DEFAULT_CATEGORIES stays an app constant, never persisted)
// ---------------------------------------------------------------------------

type CustomCategoryRow = { id: string; user_id: string; label: string; group: Category["group"] };

export async function fetchCustomCategories(
  userId: string,
  client: AnySupabaseClient = createClient()
): Promise<Category[]> {
  const { data, error } = await client.from("custom_categories").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as CustomCategoryRow[]).map((row) => ({ id: row.id, label: row.label, group: row.group, custom: true }));
}

export async function upsertCustomCategories(
  userId: string,
  categories: Category[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (categories.length === 0) return;
  const { error } = await client
    .from("custom_categories")
    .upsert(categories.map((c) => ({ id: c.id, user_id: userId, label: c.label, group: c.group })));
  if (error) throw error;
}

export async function deleteCustomCategories(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("custom_categories").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Installment groups
// ---------------------------------------------------------------------------

type InstallmentGroupRow = {
  id: string;
  user_id: string;
  description: string;
  total_amount: number;
  installments_count: number;
  created_at: string;
};

export async function fetchInstallmentGroups(userId: string): Promise<InstallmentGroup[]> {
  const { data, error } = await createClient().from("installment_groups").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as InstallmentGroupRow[]).map((row) => ({
    id: row.id,
    description: row.description,
    totalAmount: row.total_amount,
    installmentsCount: row.installments_count,
    createdAt: row.created_at,
  }));
}

export async function upsertInstallmentGroups(
  userId: string,
  groups: InstallmentGroup[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (groups.length === 0) return;
  const { error } = await client
    .from("installment_groups")
    .upsert(
      groups.map((g) => ({
        id: g.id,
        user_id: userId,
        description: g.description,
        total_amount: g.totalAmount,
        installments_count: g.installmentsCount,
        created_at: g.createdAt,
      }))
    );
  if (error) throw error;
}

export async function deleteInstallmentGroups(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("installment_groups").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Recurring rules
// ---------------------------------------------------------------------------

type RecurringRuleRow = {
  id: string;
  user_id: string;
  description: string;
  amount: number;
  category: string;
  payment_source: string;
  type: string;
  frequency: string;
  day_of_month: number;
  start_date: string;
  end_date: string | null;
  active: boolean;
  created_at: string;
};

function rowToRecurringRule(row: RecurringRuleRow): RecurringRule {
  return {
    id: row.id,
    description: row.description,
    amount: row.amount,
    category: row.category,
    paymentSource: row.payment_source as RecurringRule["paymentSource"],
    type: row.type as RecurringRule["type"],
    frequency: row.frequency as RecurringRule["frequency"],
    dayOfMonth: row.day_of_month,
    startDate: row.start_date,
    endDate: row.end_date ?? undefined,
    active: row.active,
    createdAt: row.created_at,
  };
}

export async function fetchRecurringRules(userId: string): Promise<RecurringRule[]> {
  const { data, error } = await createClient().from("recurring_rules").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as RecurringRuleRow[]).map(rowToRecurringRule);
}

export async function upsertRecurringRules(
  userId: string,
  rules: RecurringRule[],
  client: AnySupabaseClient = createClient()
): Promise<void> {
  if (rules.length === 0) return;
  const { error } = await client
    .from("recurring_rules")
    .upsert(
      rules.map((r) => ({
        id: r.id,
        user_id: userId,
        description: r.description,
        amount: r.amount,
        category: r.category,
        payment_source: r.paymentSource,
        type: r.type,
        frequency: r.frequency,
        day_of_month: r.dayOfMonth,
        start_date: r.startDate,
        end_date: r.endDate ?? null,
        active: r.active,
        created_at: r.createdAt,
      }))
    );
  if (error) throw error;
}

export async function deleteRecurringRules(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("recurring_rules").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Month closings
// ---------------------------------------------------------------------------

type MonthClosingRow = {
  id: string;
  user_id: string;
  status: string;
  closed_at: string | null;
  reopened_at: string | null;
};

export async function fetchMonthClosings(userId: string): Promise<MonthClosing[]> {
  const { data, error } = await createClient().from("month_closings").select("*").eq("user_id", userId);
  if (error) throw error;
  return (data as MonthClosingRow[]).map((row) => ({
    id: row.id,
    status: row.status as MonthClosing["status"],
    closedAt: row.closed_at ?? undefined,
    reopenedAt: row.reopened_at ?? undefined,
  }));
}

export async function upsertMonthClosings(userId: string, closings: MonthClosing[]): Promise<void> {
  if (closings.length === 0) return;
  const { error } = await createClient()
    .from("month_closings")
    .upsert(
      closings.map((m) => ({
        id: m.id,
        user_id: userId,
        status: m.status,
        closed_at: m.closedAt ?? null,
        reopened_at: m.reopenedAt ?? null,
      }))
    );
  if (error) throw error;
}

export async function deleteMonthClosings(userId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const { error } = await createClient().from("month_closings").delete().eq("user_id", userId).in("id", ids);
  if (error) throw error;
}
