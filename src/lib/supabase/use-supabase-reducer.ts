"use client";

import * as React from "react";
import { toast } from "sonner";
import { useSupabaseUser } from "./use-supabase-user";
import { useReportDataLoading } from "./data-load-status";
import { canApplyRefresh } from "./can-apply-refresh";

/** How often an open, visible tab picks up what another login changed. */
const REFRESH_INTERVAL_MS = 60_000;

/**
 * Drop-in replacement for the old localStorage-backed `usePersistentReducer`:
 * same seed → hydrate → local-first dispatch shape, but the hydration source
 * and the persistence sink are now Supabase instead of `window.localStorage`.
 *
 * Every domain reducer stays untouched and still drives the UI instantly and
 * synchronously (`dispatch` never awaits a network round-trip) — `sync` runs
 * after the fact, comparing the previous and next state to persist only what
 * changed (see diffById). A failed sync surfaces a toast but never rolls back
 * the local state; this is a best-effort sync, not an offline queue or
 * conflict-resolution system: when two logins save the same record, the last
 * save wins. What another login changed is picked up when the tab regains
 * focus and once a minute while it is visible (see `autoRefresh`).
 */
export function useSupabaseReducer<State, Action>(
  reducer: (state: State, action: Action) => State,
  emptyState: State,
  hydrateAction: (state: State) => Action,
  fetchInitial: (userId: string) => Promise<State>,
  sync: (userId: string, previous: State, next: State) => Promise<void>,
  autoRefresh = true
): [State, React.Dispatch<Action>, { loading: boolean }] {
  const { userId, loading: userLoading } = useSupabaseUser();
  const [state, dispatch] = React.useReducer(reducer, emptyState);
  const [dataLoading, setDataLoading] = React.useState(true);

  const hydratedForUserId = React.useRef<string | undefined>(undefined);
  const lastSyncedRef = React.useRef(emptyState);
  const pendingSyncsRef = React.useRef(0);

  React.useEffect(() => {
    if (userLoading) return;
    let cancelled = false;

    if (!userId) {
      // Signed out: drop back to empty state so a different account signing
      // in next never briefly sees the previous user's data. Deferred to a
      // microtask (rather than called synchronously in the effect body) so
      // this reads the same way as the async fetch below to both React and
      // to anyone skimming this function — not an anti-pattern of deriving
      // state synchronously from props on every dependency change.
      hydratedForUserId.current = undefined;
      lastSyncedRef.current = emptyState;
      Promise.resolve().then(() => {
        if (cancelled) return;
        dispatch(hydrateAction(emptyState));
        setDataLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    if (hydratedForUserId.current === userId) return;

    setDataLoading(true);
    fetchInitial(userId)
      .then((fetched) => {
        if (cancelled) return;
        hydratedForUserId.current = userId;
        lastSyncedRef.current = fetched;
        dispatch(hydrateAction(fetched));
      })
      .catch(() => {
        toast.error("Não foi possível carregar seus dados agora. Tente recarregar a página.");
      })
      .finally(() => {
        if (!cancelled) setDataLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, userLoading]);

  React.useEffect(() => {
    if (!userId || hydratedForUserId.current !== userId) return;
    if (state === lastSyncedRef.current) return;

    const previous = lastSyncedRef.current;
    lastSyncedRef.current = state;
    pendingSyncsRef.current += 1;
    sync(userId, previous, state)
      .catch(() => {
        toast.error("Não foi possível salvar sua última alteração. Verifique sua conexão.");
      })
      .finally(() => {
        pendingSyncsRef.current -= 1;
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, userId]);

  React.useEffect(() => {
    if (!autoRefresh || !userId) return;
    let cancelled = false;

    function refresh() {
      if (!userId || document.visibilityState !== "visible") return;
      if (hydratedForUserId.current !== userId || pendingSyncsRef.current > 0) return;
      const syncedWhenFetchStarted = lastSyncedRef.current;
      fetchInitial(userId)
        .then((fetched) => {
          if (cancelled) return;
          const syncedNow = lastSyncedRef.current;
          if (!canApplyRefresh({ syncedWhenFetchStarted, syncedNow, pendingSyncs: pendingSyncsRef.current })) return;
          lastSyncedRef.current = fetched;
          dispatch(hydrateAction(fetched));
        })
        // Sem aviso: é uma atualização de fundo, e a próxima tenta de novo.
        .catch(() => {});
    }

    const interval = setInterval(refresh, REFRESH_INTERVAL_MS);
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelled = true;
      clearInterval(interval);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, autoRefresh]);

  const loading = userLoading || dataLoading;
  useReportDataLoading(loading);

  return [state, dispatch, { loading }];
}
