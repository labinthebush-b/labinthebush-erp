import { describe, expect, it } from "vitest";
import { getSalePaymentStatus, indexTransactionsById, paymentToTransactionFields } from "./payment";
import { makeSale } from "./test-helpers";
import type { Transaction, TransactionStatus } from "@/lib/finance/types";

function makeIncome(id: string, status: TransactionStatus): Transaction {
  return {
    id,
    type: "income",
    amount: 10000,
    date: "2026-09-10",
    category: "venda",
    description: "Venda",
    paymentSource: "conta_marca",
    status,
    createdAt: "2026-09-10T00:00:00.000Z",
    updatedAt: "2026-09-10T00:00:00.000Z",
    edited: false,
  };
}

describe("paymentToTransactionFields", () => {
  it("pago: concluído e sem vencimento", () => {
    expect(paymentToTransactionFields("pago", "2026-09-10")).toEqual({ status: "concluido", dueDate: undefined });
  });

  it("pendente: pendente com vencimento na data da venda", () => {
    expect(paymentToTransactionFields("pendente", "2026-09-10")).toEqual({ status: "pendente", dueDate: "2026-09-10" });
  });
});

describe("getSalePaymentStatus — o status vem da transação de receita vinculada", () => {
  const sale = makeSale({ transactionId: "t-venda" });

  it("transação concluída = pago", () => {
    const byId = indexTransactionsById([makeIncome("t-venda", "concluido")]);
    expect(getSalePaymentStatus(sale, byId)).toBe("pago");
  });

  it("transação pendente = pendente (a receber)", () => {
    const byId = indexTransactionsById([makeIncome("t-venda", "pendente")]);
    expect(getSalePaymentStatus(sale, byId)).toBe("pendente");
  });

  it("transação cancelada = cancelado", () => {
    const byId = indexTransactionsById([makeIncome("t-venda", "cancelado")]);
    expect(getSalePaymentStatus(sale, byId)).toBe("cancelado");
  });

  it("transação apagada direto no Financeiro = sem lançamento (nunca finge que está paga)", () => {
    const byId = indexTransactionsById([makeIncome("outra", "concluido")]);
    expect(getSalePaymentStatus(sale, byId)).toBe("sem_lancamento");
  });

  it("só olha a transação da própria venda, mesmo havendo outras no Financeiro", () => {
    const byId = indexTransactionsById([makeIncome("outra", "pendente"), makeIncome("t-venda", "concluido")]);
    expect(getSalePaymentStatus(sale, byId)).toBe("pago");
  });
});
