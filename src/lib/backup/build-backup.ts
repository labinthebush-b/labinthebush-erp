// Pure assembly of a full-data export — no Supabase calls here, just shaping
// whatever the caller already has (from the domain providers + one direct
// Canvas fetch, since CanvasProvider is page-scoped, not global). Kept
// separate from the download trigger so it's plain, testable data logic.

import type { Category, InstallmentGroup, MonthClosing, RecurringRule, Transaction } from "@/lib/finance/types";
import type { Sale } from "@/lib/sales/types";
import type { Product } from "@/lib/catalog/types";
import type { StockMovement } from "@/lib/stock/types";
import type { Contact } from "@/lib/contacts/types";
import type { Task } from "@/lib/tasks/types";
import type { CanvasElement } from "@/lib/canvas/types";
import type { Settings } from "@/lib/settings/types";
import type { CategoryBudget, ProfitAllocation } from "@/lib/planning/types";

export const BACKUP_VERSION = 1;

export type BackupPayload = {
  version: typeof BACKUP_VERSION;
  exportedAt: string;
  finance: {
    transactions: Transaction[];
    customCategories: Category[];
    installmentGroups: InstallmentGroup[];
    recurringRules: RecurringRule[];
    monthClosings: MonthClosing[];
  };
  sales: Sale[];
  products: Product[];
  /** Histórico de estoque (entradas, saídas, ajustes) — o saldo de cada variação é a soma dele. */
  stockMovements: StockMovement[];
  contacts: Contact[];
  tasks: Task[];
  canvas: CanvasElement[];
  settings: Settings;
  planning: {
    allocations: ProfitAllocation[];
    budgets: CategoryBudget[];
  };
};

export function buildBackupPayload(input: {
  now: string;
  finance: BackupPayload["finance"];
  sales: Sale[];
  products: Product[];
  stockMovements: StockMovement[];
  contacts: Contact[];
  tasks: Task[];
  canvas: CanvasElement[];
  settings: Settings;
  planning: BackupPayload["planning"];
}): BackupPayload {
  return {
    version: BACKUP_VERSION,
    exportedAt: input.now,
    finance: input.finance,
    sales: input.sales,
    products: input.products,
    stockMovements: input.stockMovements,
    contacts: input.contacts,
    tasks: input.tasks,
    canvas: input.canvas,
    settings: input.settings,
    planning: input.planning,
  };
}
