"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { NotificationItem } from "@/components/common/notification-item";
import { EmptyState } from "@/components/common/empty-state";
import { useUI } from "@/components/providers/ui-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { useFinance } from "@/lib/finance/finance-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { deriveTaskNotifications } from "@/lib/tasks/notifications";
import { useStock } from "@/lib/stock/stock-provider";
import { listVariantStocks } from "@/lib/stock/calculations";
import {
  deriveFinanceNotifications,
  deriveLowStockNotifications,
  deriveMarginNotifications,
  deriveMonthClosingNotification,
  deriveSalesTodayNotification,
} from "@/lib/notifications/business";

function nowMs(): number {
  return Date.now();
}

export function NotificationsMenu() {
  const [open, setOpen] = React.useState(false);
  const router = useRouter();
  const { notifications, markAllNotificationsRead } = useUI();
  const { tasks } = useTasks();
  const { transactions, monthClosings } = useFinance();
  const { products } = useCatalog();
  const { sales } = useSales();
  const { settings } = useSettings();
  const { movements } = useStock();

  const businessNotifications = React.useMemo(() => {
    const now = nowMs();
    const today = new Date(now).toISOString().slice(0, 10);
    const stocks = listVariantStocks(
      products.filter((p) => p.status !== "arquivado"),
      movements,
      settings.lowStockThreshold
    );
    return [
      ...deriveTaskNotifications(tasks, today, now),
      ...deriveFinanceNotifications(transactions, today),
      ...deriveMonthClosingNotification(transactions, monthClosings, today),
      ...deriveMarginNotifications(products, settings.marginThresholdPercent, today),
      ...deriveLowStockNotifications(stocks, (id) => products.find((p) => p.id === id)?.name, today),
      ...deriveSalesTodayNotification(sales, today),
    ].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
  }, [tasks, transactions, monthClosings, products, sales, movements, settings.marginThresholdPercent, settings.lowStockThreshold]);

  const allNotifications = [...businessNotifications, ...notifications];
  const unreadCount = allNotifications.filter((n) => !n.read).length;

  function handleNavigate(href: string) {
    setOpen(false);
    router.push(href);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label="Notificações">
          <Bell className="size-4" />
          {unreadCount > 0 ? (
            <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-electric-blue text-[10px] font-medium text-white">
              {unreadCount}
            </span>
          ) : null}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b border-border px-3 py-2.5">
          <span className="text-body font-medium text-foreground">Notificações</span>
          {notifications.some((n) => !n.read) ? (
            <button
              onClick={markAllNotificationsRead}
              className="text-caption text-electric-blue hover:underline"
            >
              Marcar todas como lidas
            </button>
          ) : null}
        </div>
        {allNotifications.length === 0 ? (
          <EmptyState
            className="border-0 py-8"
            title="Sem notificações"
            description="Você está em dia."
          />
        ) : (
          <div className="max-h-96 overflow-y-auto">
            {allNotifications.map((n) => (
              <NotificationItem key={n.id} notification={n} onNavigate={handleNavigate} />
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
