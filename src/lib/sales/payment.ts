import type { Transaction, TransactionStatus } from "@/lib/finance/types";
import type { Sale } from "./types";

/**
 * O status de pagamento de uma venda NÃO é guardado na venda: é o status da
 * transação de receita vinculada (`Sale.transactionId`). Assim o Financeiro
 * continua sendo a única fonte de verdade — "A receber" já soma as
 * transações de receita pendentes, sem nenhuma sincronização extra.
 */
export type SalePaymentInput = "pago" | "pendente";

export type SalePaymentStatus =
  | SalePaymentInput
  /** A transação de receita foi cancelada no Financeiro. */
  | "cancelado"
  /** A transação de receita vinculada não existe mais (apagada direto no Financeiro). */
  | "sem_lancamento";

export const PAYMENT_LABELS: Record<SalePaymentStatus, string> = {
  pago: "Pago",
  pendente: "A receber",
  cancelado: "Cancelado",
  sem_lancamento: "Sem lançamento",
};

/** Campos da transação de receita que expressam a escolha "pago"/"pendente" do formulário. */
export function paymentToTransactionFields(
  payment: SalePaymentInput,
  saleDate: string
): { status: TransactionStatus; dueDate: string | undefined } {
  return payment === "pago"
    ? { status: "concluido", dueDate: undefined }
    : { status: "pendente", dueDate: saleDate };
}

export function indexTransactionsById(transactions: Transaction[]): Map<string, Transaction> {
  return new Map(transactions.map((t) => [t.id, t]));
}

export function getSalePaymentStatus(sale: Sale, transactionsById: Map<string, Transaction>): SalePaymentStatus {
  const transaction = transactionsById.get(sale.transactionId);
  if (!transaction) return "sem_lancamento";
  if (transaction.status === "concluido") return "pago";
  if (transaction.status === "pendente") return "pendente";
  return "cancelado";
}
