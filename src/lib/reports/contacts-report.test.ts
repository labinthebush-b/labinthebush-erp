import { describe, expect, it } from "vitest";
import { buildContactsReport } from "./contacts-report";
import { makeSale } from "@/lib/sales/test-helpers";
import type { Contact } from "@/lib/contacts/types";

const range = { start: "2026-09-01", end: "2026-09-30", label: "" };

function makeContact(overrides: Partial<Contact>): Contact {
  return {
    id: `c-${Math.random()}`,
    name: "Contato",
    status: "lead",
    customFields: [],
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("buildContactsReport", () => {
  it("conta novos contatos criados no período e por status", () => {
    const contacts = [
      makeContact({ id: "c1", status: "cliente", createdAt: "2026-09-05T00:00:00.000Z" }),
      makeContact({ id: "c2", status: "recorrente", createdAt: "2026-01-01T00:00:00.000Z" }),
      makeContact({ id: "c3", status: "inativo", createdAt: "2026-01-01T00:00:00.000Z" }),
    ];
    const report = buildContactsReport(contacts, [], range);
    expect(report.novos).toBe(1);
    expect(report.clientes).toBe(1);
    expect(report.recorrentes).toBe(1);
    expect(report.inativos).toBe(1);
  });

  it("lista os contatos que mais compraram no período", () => {
    const contacts = [makeContact({ id: "c1", name: "Ana" }), makeContact({ id: "c2", name: "Beto" })];
    const sales = [
      makeSale({ contactId: "c1", totalAmount: 5000 }),
      makeSale({ contactId: "c1", totalAmount: 5000 }),
      makeSale({ contactId: "c2", totalAmount: 3000 }),
    ];
    const report = buildContactsReport(contacts, sales, range);
    expect(report.topContacts[0]).toMatchObject({ contactId: "c1", totalComprado: 10000, quantidadeCompras: 2 });
  });
});
