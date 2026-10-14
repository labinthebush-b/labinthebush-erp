import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { DataLoadGate } from "@/components/layout/data-load-gate";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh w-full overflow-hidden bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-(--breakpoint-content) flex-col gap-6 p-4 sm:p-6">
            <DataLoadGate>{children}</DataLoadGate>
          </div>
        </main>
      </div>
    </div>
  );
}
