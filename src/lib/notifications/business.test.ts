import { describe, expect, it } from "vitest";
import {
  deriveFinanceNotifications,
  deriveMonthClosingNotification,
  deriveMarginNotifications,
  deriveSalesTodayNotification,
} from "./business";
import { makeTransaction } from "@/lib/finance/test-helpers";
import { makeSale } from "@/lib/sales/test-helpers";
import type { Product } from "@/lib/catalog/types";

const TODAY = "2026-09-15";

describe("deriveFinanceNotifications", () => {
  it("gera 'conta a pagar atrasada' para despesa pendente vencida", () => {
    const transactions = [makeTransaction({ type: "expense", status: "pendente", dueDate: "2026-09-10", description: "Aluguel" })];
    const notifications = deriveFinanceNotifications(transactions, TODAY);
    expect(notifications[0].title).toBe("Conta a pagar atrasada");
  });

  it("gera 'conta a receber vencendo' para receita pendente nos próximos 3 dias", () => {
    const transactions = [makeTransaction({ type: "income", status: "pendente", dueDate: "2026-09-17", description: "Venda a prazo" })];
    const notifications = deriveFinanceNotifications(transactions, TODAY);
    expect(notifications[0].title).toBe("Conta a receber vencendo");
  });

  it("ignora contas pendentes distantes no futuro", () => {
    const transactions = [makeTransaction({ type: "expense", status: "pendente", dueDate: "2026-10-15" })];
    expect(deriveFinanceNotifications(transactions, TODAY)).toEqual([]);
  });

  it("ignora transações já concluídas", () => {
    const transactions = [makeTransaction({ type: "expense", status: "concluido", dueDate: "2026-09-10" })];
    expect(deriveFinanceNotifications(transactions, TODAY)).toEqual([]);
  });
});

describe("deriveMonthClosingNotification", () => {
  it("notifica quando o mês anterior teve atividade e ainda não foi fechado", () => {
    const transactions = [makeTransaction({ date: "2026-08-10" })];
    const notifications = deriveMonthClosingNotification(transactions, [], TODAY);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].title).toBe("Fechamento mensal disponível");
  });

  it("não notifica se o mês já está fechado", () => {
    const transactions = [makeTransaction({ date: "2026-08-10" })];
    const notifications = deriveMonthClosingNotification(transactions, [{ id: "2026-08", status: "fechado" }], TODAY);
    expect(notifications).toEqual([]);
  });

  it("não notifica se não houve nenhuma atividade no mês anterior", () => {
    expect(deriveMonthClosingNotification([], [], TODAY)).toEqual([]);
  });
});

describe("deriveMarginNotifications", () => {
  it("notifica produtos com margem igual ou abaixo do limite", () => {
    const products: Product[] = [
      { id: "p1", name: "Baixa margem", status: "ativo", price: 6500, costComponents: [{ id: "c", category: "produto_pod", amount: 6000 }], createdAt: "", updatedAt: "" },
    ];
    const notifications = deriveMarginNotifications(products, 10, TODAY);
    expect(notifications[0].title).toBe("Margem baixa");
    expect(notifications[0].description).toContain("Baixa margem");
  });
});

describe("deriveSalesTodayNotification", () => {
  it("resume as vendas do dia em uma única notificação (sem spam)", () => {
    const notifications = deriveSalesTodayNotification([makeSale({ date: TODAY, totalAmount: 1000 }), makeSale({ date: TODAY, totalAmount: 1000 })], TODAY);
    expect(notifications).toHaveLength(1);
    expect(notifications[0].description).toContain("2 vendas");
  });

  it("não notifica quando não há vendas hoje", () => {
    expect(deriveSalesTodayNotification([makeSale({ date: "2026-09-14" })], TODAY)).toEqual([]);
  });
});
