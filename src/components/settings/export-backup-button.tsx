"use client";

import * as React from "react";
import { toast } from "sonner";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildBackupPayload } from "@/lib/backup/build-backup";
import { useFinance } from "@/lib/finance/finance-provider";
import { useSales } from "@/lib/sales/sales-provider";
import { useCatalog } from "@/lib/catalog/catalog-provider";
import { useStock } from "@/lib/stock/stock-provider";
import { useContacts } from "@/lib/contacts/contacts-provider";
import { useTasks } from "@/lib/tasks/tasks-provider";
import { useSettings } from "@/lib/settings/settings-provider";
import { usePlanning } from "@/lib/planning/planning-provider";
import { useSupabaseUser } from "@/lib/supabase/use-supabase-user";
import { fetchCanvasElements } from "@/lib/canvas/repository";

/**
 * Client-side only: every domain provider except Canvas is already global
 * (see app/(app)/layout.tsx), so this reads straight from context — no extra
 * request needed. Canvas is fetched once here since CanvasProvider is scoped
 * to the /canvas page. The download itself is a plain Blob + object URL,
 * exactly like any other browser download (this is the real deployed app,
 * not a sandboxed preview).
 */
export function ExportBackupButton() {
  const { transactions, categories, recurringRules, monthClosings, installmentGroups } = useFinance();
  const { sales } = useSales();
  const { products } = useCatalog();
  const { movements: stockMovements } = useStock();
  const { contacts } = useContacts();
  const { tasks } = useTasks();
  const { settings } = useSettings();
  const { allocations, budgets } = usePlanning();
  const { userId } = useSupabaseUser();
  const [exporting, setExporting] = React.useState(false);

  async function handleExport() {
    if (!userId) return;
    setExporting(true);
    try {
      const canvas = await fetchCanvasElements(userId);
      const payload = buildBackupPayload({
        now: new Date().toISOString(),
        finance: {
          transactions,
          customCategories: categories.filter((c) => c.custom),
          installmentGroups,
          recurringRules,
          monthClosings,
        },
        sales,
        products,
        stockMovements,
        contacts,
        tasks,
        canvas,
        settings,
        planning: { allocations, budgets },
      });

      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `erp-da-marca-backup-${payload.exportedAt.slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success("Backup exportado.");
    } catch {
      toast.error("Não foi possível gerar o backup agora.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={exporting}>
      <Download className="size-4" />
      {exporting ? "Exportando..." : "Exportar backup (JSON)"}
    </Button>
  );
}
