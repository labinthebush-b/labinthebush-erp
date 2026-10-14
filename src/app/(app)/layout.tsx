import { UIProvider } from "@/components/providers/ui-provider";
import { DataLoadStatusProvider } from "@/lib/supabase/data-load-status";
import { AppShell } from "@/components/layout/app-shell";
import { FinanceProvider } from "@/lib/finance/finance-provider";
import { CatalogProvider } from "@/lib/catalog/catalog-provider";
import { ContactsProvider } from "@/lib/contacts/contacts-provider";
import { SalesProvider } from "@/lib/sales/sales-provider";
import { TasksProvider } from "@/lib/tasks/tasks-provider";
import { SettingsProvider } from "@/lib/settings/settings-provider";
import { PlanningProvider } from "@/lib/planning/planning-provider";

// Every domain provider fetches from Supabase as soon as it mounts, so this
// tree is scoped to the authenticated app only — /login sits outside it
// entirely (see the root layout), never mounting a single provider or
// issuing a single query before a session exists.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <DataLoadStatusProvider>
      <SettingsProvider>
        <FinanceProvider>
          <PlanningProvider>
            <CatalogProvider>
              <ContactsProvider>
                <SalesProvider>
                  <TasksProvider>
                    <UIProvider>
                      <AppShell>{children}</AppShell>
                    </UIProvider>
                  </TasksProvider>
                </SalesProvider>
              </ContactsProvider>
            </CatalogProvider>
          </PlanningProvider>
        </FinanceProvider>
      </SettingsProvider>
    </DataLoadStatusProvider>
  );
}
