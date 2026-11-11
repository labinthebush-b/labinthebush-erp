/**
 * A background refresh only replaces local state when nothing happened locally
 * since the fetch started: no save still in flight (the fetch might not include
 * it) and no new local change (replacing the state would discard it).
 */
export function canApplyRefresh<State>(params: {
  syncedWhenFetchStarted: State;
  syncedNow: State;
  pendingSyncs: number;
}): boolean {
  return params.pendingSyncs === 0 && params.syncedWhenFetchStarted === params.syncedNow;
}
