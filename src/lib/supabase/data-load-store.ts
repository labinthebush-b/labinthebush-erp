/**
 * Tracks whether the app's first round of Supabase fetches is done, so the UI
 * can show a skeleton instead of misleading "Nenhuma venda registrada" empty
 * states while data is still on its way.
 *
 * Pure (no React) so it can be unit-tested in the node-only vitest setup.
 * `ready` is a one-way latch: once every provider that registered has finished
 * its first load it stays true for the life of the store. Providers that mount
 * later (e.g. the Canvas provider, scoped to its own page) therefore never send
 * the user back to a full-page skeleton.
 */
export type DataLoadStore = {
  /** A provider reports whether its fetch is in flight (true) or done (false). */
  report(id: string, loading: boolean): void;
  /** A provider unmounted — forget it without counting it as "finished loading". */
  unregister(id: string): void;
  subscribe(listener: () => void): () => void;
  isReady(): boolean;
};

export function createDataLoadStore(): DataLoadStore {
  const pending = new Set<string>();
  const listeners = new Set<() => void>();
  let seenAny = false;
  let ready = false;

  return {
    report(id, loading) {
      if (ready) return;
      if (loading) {
        pending.add(id);
        seenAny = true;
        return;
      }
      pending.delete(id);
      if (seenAny && pending.size === 0) {
        ready = true;
        listeners.forEach((listener) => listener());
      }
    },
    // Not a "loaded" signal: React Strict Mode unmounts and remounts every
    // effect once in dev, and that must not latch `ready` early.
    unregister(id) {
      pending.delete(id);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    isReady() {
      return ready;
    },
  };
}
