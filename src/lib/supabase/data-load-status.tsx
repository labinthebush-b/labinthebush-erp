"use client";

import * as React from "react";
import { createDataLoadStore, type DataLoadStore } from "./data-load-store";

const DataLoadContext = React.createContext<DataLoadStore | null>(null);

/** Mount once above every Supabase-backed provider (see app/(app)/layout.tsx). */
export function DataLoadStatusProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(createDataLoadStore);
  return <DataLoadContext.Provider value={store}>{children}</DataLoadContext.Provider>;
}

/**
 * Called by useSupabaseReducer on behalf of each provider. A no-op when no
 * DataLoadStatusProvider is mounted, so the hook still works standalone.
 */
export function useReportDataLoading(loading: boolean) {
  const store = React.useContext(DataLoadContext);
  const id = React.useId();

  React.useEffect(() => {
    store?.report(id, loading);
  }, [store, id, loading]);

  React.useEffect(() => {
    return () => store?.unregister(id);
  }, [store, id]);
}

/**
 * False on the server and during hydration (so the server-rendered HTML is the
 * skeleton, never an empty state), then true once the first load is complete.
 * Always true when no DataLoadStatusProvider is mounted.
 */
export function useAppDataReady(): boolean {
  const store = React.useContext(DataLoadContext);
  return React.useSyncExternalStore(
    store ? store.subscribe : noopSubscribe,
    () => (store ? store.isReady() : true),
    () => (store ? false : true)
  );
}

function noopSubscribe() {
  return () => {};
}
