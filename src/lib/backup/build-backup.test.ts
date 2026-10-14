import { describe, expect, it } from "vitest";
import { buildBackupPayload, BACKUP_VERSION } from "./build-backup";
import { DEFAULT_SETTINGS } from "@/lib/settings/types";

describe("buildBackupPayload", () => {
  it("monta um payload com versão, timestamp e todos os domínios", () => {
    const payload = buildBackupPayload({
      now: "2026-09-14T12:00:00.000Z",
      finance: { transactions: [], customCategories: [], installmentGroups: [], recurringRules: [], monthClosings: [] },
      sales: [],
      products: [],
      stockMovements: [],
      contacts: [],
      tasks: [],
      canvas: [],
      settings: DEFAULT_SETTINGS,
      planning: { allocations: [], budgets: [] },
    });

    expect(payload.version).toBe(BACKUP_VERSION);
    expect(payload.exportedAt).toBe("2026-09-14T12:00:00.000Z");
    expect(payload.settings).toEqual(DEFAULT_SETTINGS);
    expect(payload).toHaveProperty("finance");
    expect(payload).toHaveProperty("sales");
    expect(payload).toHaveProperty("products");
    expect(payload).toHaveProperty("stockMovements");
    expect(payload).toHaveProperty("contacts");
    expect(payload).toHaveProperty("tasks");
    expect(payload).toHaveProperty("canvas");
    expect(payload).toHaveProperty("planning");
  });

  it("inclui o histórico de estoque tal como recebido (o saldo é a soma dele)", () => {
    const movement = {
      id: "m1",
      productId: "p1",
      size: "M",
      color: "Preto",
      quantity: 10,
      kind: "entrada" as const,
      date: "2026-10-01",
      createdAt: "2026-10-01T00:00:00.000Z",
      updatedAt: "2026-10-01T00:00:00.000Z",
    };
    const payload = buildBackupPayload({
      now: "2026-10-13T12:00:00.000Z",
      finance: { transactions: [], customCategories: [], installmentGroups: [], recurringRules: [], monthClosings: [] },
      sales: [],
      products: [],
      stockMovements: [movement],
      contacts: [],
      tasks: [],
      canvas: [],
      settings: DEFAULT_SETTINGS,
      planning: { allocations: [], budgets: [] },
    });
    expect(payload.stockMovements).toEqual([movement]);
  });
});
