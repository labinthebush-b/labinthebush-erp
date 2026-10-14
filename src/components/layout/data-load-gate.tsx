"use client";

import { PageLoading } from "@/components/common/page-loading";
import { useAppDataReady } from "@/lib/supabase/data-load-status";

// Holds the page back behind a skeleton until the first Supabase fetch of every
// provider has finished. Without it each screen briefly renders its empty state
// ("Nenhuma venda registrada…") and then jumps to the real data, which reads as
// "my data is gone". Sidebar and header stay visible; only the page waits.
export function DataLoadGate({ children }: { children: React.ReactNode }) {
  const ready = useAppDataReady();
  return ready ? <>{children}</> : <PageLoading />;
}
