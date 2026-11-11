import { describe, expect, it } from "vitest";
import { generateMissingOccurrences, recurrenceOccurrenceId } from "./recurrence";
import type { RecurringRule, Transaction } from "./types";

const baseRule: RecurringRule = {
  id: "r1",
  description: "ChatGPT",
  amount: 10000,
  category: "software",
  paymentSource: "cartao",
  type: "expense",
  frequency: "mensal",
  dayOfMonth: 5,
  startDate: "2026-01-05",
  active: true,
  createdAt: "2026-01-01T00:00:00.000Z",
};

let idCounter = 0;
const makeId = () => `gen-${++idCounter}`;

describe("recurrenceOccurrenceId", () => {
  const ruleId = "3f0e7900-7ae6-4ab6-b600-bbe8a86801ad";

  it("é o mesmo para a mesma regra e data, em qualquer login", () => {
    expect(recurrenceOccurrenceId(ruleId, "2026-11-05")).toBe(recurrenceOccurrenceId(ruleId, "2026-11-05"));
  });

  it("muda com a data e continua sendo um UUID válido", () => {
    const id = recurrenceOccurrenceId(ruleId, "2026-11-05");
    expect(id).not.toBe(recurrenceOccurrenceId(ruleId, "2026-12-05"));
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
  });
});

describe("generateMissingOccurrences", () => {
  it("gera uma ocorrência por mês entre o início e o horizonte", () => {
    const generated = generateMissingOccurrences(baseRule, [], "2026-03-31", makeId, "2026-01-01T00:00:00.000Z");

    expect(generated.map((t) => t.date)).toEqual(["2026-01-05", "2026-02-05", "2026-03-05"]);
    expect(generated.every((t) => t.relations?.recurrenceId === "r1")).toBe(true);
    expect(generated.every((t) => t.status === "pendente")).toBe(true);
  });

  it("não duplica meses que já possuem lançamento vinculado à regra", () => {
    const existing: Transaction[] = [
      {
        id: "existing-1",
        type: "expense",
        amount: 10000,
        date: "2026-02-05",
        category: "software",
        description: "ChatGPT",
        paymentSource: "cartao",
        status: "concluido",
        createdAt: "2026-02-01T00:00:00.000Z",
        updatedAt: "2026-02-01T00:00:00.000Z",
        edited: false,
        relations: { recurrenceId: "r1" },
      },
    ];

    const generated = generateMissingOccurrences(baseRule, existing, "2026-03-31", makeId, "2026-01-01T00:00:00.000Z");

    expect(generated.map((t) => t.date)).toEqual(["2026-01-05", "2026-03-05"]);
  });

  it("respeita a data de término da regra", () => {
    const rule: RecurringRule = { ...baseRule, endDate: "2026-02-05" };
    const generated = generateMissingOccurrences(rule, [], "2026-06-30", makeId, "2026-01-01T00:00:00.000Z");

    expect(generated.map((t) => t.date)).toEqual(["2026-01-05", "2026-02-05"]);
  });

  it("não gera nada para regras inativas", () => {
    const rule: RecurringRule = { ...baseRule, active: false };
    const generated = generateMissingOccurrences(rule, [], "2026-06-30", makeId, "2026-01-01T00:00:00.000Z");
    expect(generated).toEqual([]);
  });

  it("ajusta o dia quando o mês é mais curto (ex: dia 31 em fevereiro)", () => {
    const rule: RecurringRule = { ...baseRule, startDate: "2026-01-31", dayOfMonth: 31 };
    const generated = generateMissingOccurrences(rule, [], "2026-02-28", makeId, "2026-01-01T00:00:00.000Z");

    expect(generated.map((t) => t.date)).toEqual(["2026-01-31", "2026-02-28"]);
  });
});
