import { describe, expect, it } from "vitest";
import { canApplyRefresh } from "./can-apply-refresh";

describe("canApplyRefresh", () => {
  const state = { items: [] };

  it("aplica quando nada mudou localmente", () => {
    expect(canApplyRefresh({ syncedWhenFetchStarted: state, syncedNow: state, pendingSyncs: 0 })).toBe(true);
  });

  it("descarta quando houve alteração local durante a busca", () => {
    expect(canApplyRefresh({ syncedWhenFetchStarted: state, syncedNow: { items: [] }, pendingSyncs: 0 })).toBe(false);
  });

  it("descarta enquanto um salvamento está em andamento", () => {
    expect(canApplyRefresh({ syncedWhenFetchStarted: state, syncedNow: state, pendingSyncs: 1 })).toBe(false);
  });
});
