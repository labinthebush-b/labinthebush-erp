import { describe, expect, it } from "vitest";
import {
  buildCustomCategory,
  buildInstallmentTransactions,
  buildRecurringRule,
  buildTransaction,
} from "./actions";

describe("buildTransaction", () => {
  it("preenche id/timestamps e marca como não editada", () => {
    const t = buildTransaction({
      type: "expense",
      amount: 8000,
      date: "2026-09-14",
      category: "marketing",
      description: "Anúncio da Meta",
      paymentSource: "cartao",
      status: "concluido",
    });

    expect(t.id).toBeTruthy();
    expect(t.amount).toBe(8000);
    expect(t.edited).toBe(false);
    expect(t.createdAt).toBe(t.updatedAt);
  });
});

describe("buildInstallmentTransactions", () => {
  it("divide o total em N parcelas sem perder centavos e liga todas ao mesmo grupo", () => {
    const { group, transactions } = buildInstallmentTransactions({
      type: "expense",
      totalAmount: 60000,
      installmentsCount: 3,
      date: "2026-10-01",
      category: "outros_custos",
      description: "Material em 3x",
      paymentSource: "cartao",
      firstInstallmentSettled: false,
    });

    expect(transactions).toHaveLength(3);
    expect(transactions.reduce((sum, t) => sum + t.amount, 0)).toBe(60000);
    expect(transactions.every((t) => t.relations?.installmentGroupId === group.id)).toBe(true);
    expect(transactions.every((t) => t.status === "pendente")).toBe(true);
  });

  it("marca a primeira parcela como concluída quando firstInstallmentSettled é true", () => {
    const { transactions } = buildInstallmentTransactions({
      type: "expense",
      totalAmount: 300,
      installmentsCount: 3,
      date: "2026-10-01",
      category: "outros_custos",
      description: "x",
      paymentSource: "cartao",
      firstInstallmentSettled: true,
    });

    expect(transactions[0].status).toBe("concluido");
    expect(transactions[1].status).toBe("pendente");
  });
});

describe("buildRecurringRule", () => {
  it("cria a regra ativa, com frequência mensal", () => {
    const rule = buildRecurringRule({
      description: "Assinatura",
      amount: 5000,
      category: "software",
      paymentSource: "cartao",
      type: "expense",
      dayOfMonth: 5,
      startDate: "2026-01-01",
    });
    expect(rule.active).toBe(true);
    expect(rule.frequency).toBe("mensal");
  });
});

describe("buildCustomCategory", () => {
  it("gera um id derivado do grupo e do label, marcado como custom", () => {
    const category = buildCustomCategory("Tráfego Pago", "despesa");
    expect(category.custom).toBe(true);
    expect(category.id.startsWith("despesa-")).toBe(true);
  });
});
