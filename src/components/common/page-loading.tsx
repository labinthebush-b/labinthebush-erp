import { CardSkeleton, TableSkeleton } from "@/components/common/loading";
import { Skeleton } from "@/components/ui/skeleton";

// Page-shaped placeholder shown while a route (or the first Supabase fetch)
// is still loading — see app/(app)/loading.tsx and DataLoadGate.
export function PageLoading() {
  return (
    <div className="flex flex-col gap-6" role="status" aria-busy="true">
      <span className="sr-only">Carregando seus dados…</span>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-64" />
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
      <div className="rounded-xl border border-border p-4">
        <TableSkeleton />
      </div>
    </div>
  );
}
