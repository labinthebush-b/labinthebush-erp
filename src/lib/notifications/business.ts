// Business-level notifications derived live from existing domain state —
// finance (contas a pagar/receber, fechamento mensal), catalog (margem) and
// sales (vendas do dia). Nothing here is stored: it's all computed fresh from
// the same data the rest of the app already reads, so there is no second
// source of truth to keep in sync.

import type { MonthClosing, Transaction } from "@/lib/finance/types";
import { formatMonthLabel } from "@/lib/finance/period";
import type { Product } from "@/lib/catalog/types";
import { productsBelowMargin } from "@/lib/reports/products-report";
import type { Sale } from "@/lib/sales/types";
import type { TaskNotification } from "@/lib/tasks/notifications";
import { variantLabel, type VariantStock } from "@/lib/stock/calculations";

function addDaysISO(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function formatDateBR(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

const UPCOMING_DUE_WINDOW_DAYS = 3;

export function deriveFinanceNotifications(transactions: Transaction[], todayISO: string): TaskNotification[] {
  const upcomingLimit = addDaysISO(todayISO, UPCOMING_DUE_WINDOW_DAYS);
  const pending = transactions.filter((t) => t.status === "pendente" && t.dueDate);

  const notifications: TaskNotification[] = [];
  for (const t of pending) {
    const tipo = t.type === "expense" || t.type === "owner_withdrawal" ? "a pagar" : "a receber";
    if (t.dueDate! < todayISO) {
      notifications.push({
        id: `finance-overdue-${t.id}`,
        title: `Conta ${tipo} atrasada`,
        description: `${t.description} • venceu em ${formatDateBR(t.dueDate!)}`,
        createdAt: t.dueDate!,
        read: false,
        href: "/financeiro",
      });
    } else if (t.dueDate! <= upcomingLimit) {
      notifications.push({
        id: `finance-upcoming-${t.id}`,
        title: `Conta ${tipo} vencendo`,
        description: `${t.description} • vence em ${formatDateBR(t.dueDate!)}`,
        createdAt: t.dueDate!,
        read: false,
        href: "/financeiro",
      });
    }
  }
  return notifications;
}

/** yyyy-MM of the month right before `todayISO`'s month. */
function previousMonthId(todayISO: string): string {
  const [year, month] = todayISO.slice(0, 7).split("-").map(Number);
  const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
  return prevMonthDate.toISOString().slice(0, 7);
}

export function deriveMonthClosingNotification(
  transactions: Transaction[],
  monthClosings: MonthClosing[],
  todayISO: string
): TaskNotification[] {
  const monthId = previousMonthId(todayISO);
  const alreadyClosed = monthClosings.find((m) => m.id === monthId)?.status === "fechado";
  const hasActivity = transactions.some((t) => t.date.slice(0, 7) === monthId);

  if (!hasActivity || alreadyClosed) return [];

  return [
    {
      id: `month-closing-${monthId}`,
      title: "Fechamento mensal disponível",
      description: `${formatMonthLabel(monthId)} está pronto para revisão e fechamento.`,
      createdAt: `${monthId}-28`,
      read: false,
      href: "/financeiro",
    },
  ];
}

export function deriveMarginNotifications(products: Product[], thresholdPercent: number, todayISO: string): TaskNotification[] {
  return productsBelowMargin(products, thresholdPercent).map((p) => ({
    id: `margin-${p.productId}`,
    title: "Margem baixa",
    description: `${p.nome} está com ${p.margemPercent.toFixed(0)}% de margem.`,
    createdAt: todayISO,
    read: false,
    href: "/produtos",
  }));
}

const MAX_VARIANTS_IN_NOTIFICATION = 3;

/**
 * Um aviso por produto (não por tamanho/cor, para não inundar a central):
 * lista as variações esgotadas ou com estoque baixo. Só produtos com estoque
 * controlado aparecem — quem nunca recebeu uma entrada nunca gera alerta.
 */
export function deriveLowStockNotifications(
  stocks: VariantStock[],
  getProductName: (productId: string) => string | undefined,
  todayISO: string
): TaskNotification[] {
  const byProduct = new Map<string, VariantStock[]>();
  for (const stock of stocks) {
    if (stock.status === "ok") continue;
    const list = byProduct.get(stock.variant.productId) ?? [];
    list.push(stock);
    byProduct.set(stock.variant.productId, list);
  }

  const notifications: TaskNotification[] = [];
  for (const [productId, list] of byProduct) {
    const name = getProductName(productId);
    if (!name) continue;
    const shown = list.slice(0, MAX_VARIANTS_IN_NOTIFICATION).map((s) =>
      s.status === "esgotado" ? `${variantLabel(s.variant)} esgotado` : `${variantLabel(s.variant)} (${s.level} un.)`
    );
    const extra = list.length - shown.length;
    notifications.push({
      id: `low-stock-${productId}`,
      title: list.some((s) => s.status === "esgotado") ? "Estoque esgotado" : "Estoque baixo",
      description: `${name}: ${shown.join(", ")}${extra > 0 ? ` e mais ${extra}` : ""}.`,
      createdAt: todayISO,
      read: false,
      href: "/estoque",
    });
  }
  return notifications;
}

export function deriveSalesTodayNotification(sales: Sale[], todayISO: string): TaskNotification[] {
  const todaySales = sales.filter((s) => s.date === todayISO);
  if (todaySales.length === 0) return [];
  return [
    {
      id: `sales-today-${todayISO}`,
      title: "Vendas registradas hoje",
      description:
        todaySales.length === 1 ? "1 venda registrada hoje." : `${todaySales.length} vendas registradas hoje.`,
      createdAt: todayISO,
      read: false,
      href: "/vendas",
    },
  ];
}
