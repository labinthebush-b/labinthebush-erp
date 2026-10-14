// "Propor → preview → confirmar" for a single Financeiro transaction. This is
// the only way the AI integration can create a real lançamento — see
// AGENTS' instruction that the AI must never persist without an explicit
// confirmation step, and must never reimplement financial rules.
//
// buildTransaction (src/lib/finance/actions.ts) is the exact same builder
// FinanceProvider uses for a manually-typed transaction — a proposal turns
// into a real Transaction using that one function, never a parallel one.
import type { AiRequestContext } from "../context";
import { buildTransaction, type NewTransactionInput } from "@/lib/finance/actions";
import { upsertTransactions, fetchCustomCategories } from "@/lib/finance/repository";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { TRANSACTION_TYPE_LABELS } from "@/lib/finance/categories";
import type { PaymentSource, TransactionType } from "@/lib/finance/types";
import { formatCurrencyCents } from "@/lib/currency";
import { suggestCategory } from "../category-suggestion";
import { createProposal, getOwnProposal, isExpired, markProposalCancelled, markProposalConfirmed } from "../proposals";

export type ProposeTransactionArgs = {
  type: TransactionType;
  /** Valor em reais (ex.: 80 ou 79.9) — a própria IA já interpretou o valor a partir da linguagem natural. */
  amount: number;
  description: string;
  /** yyyy-MM-dd; default: hoje. */
  date?: string;
  /** Se omitido, uma categoria é sugerida (e sinalizada como sugestão, nunca aplicada silenciosamente). */
  category?: string;
  paymentSource?: PaymentSource;
  /** yyyy-MM-dd. Presença implica um lançamento pendente (a pagar/a receber) a menos que já esteja liquidado. */
  dueDate?: string;
  notes?: string;
};

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export async function proposeTransaction(ctx: AiRequestContext, args: ProposeTransactionArgs) {
  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    throw new Error("amount deve ser um valor positivo em reais.");
  }
  if (!args.description?.trim()) {
    throw new Error("description é obrigatória.");
  }

  const amountCents = Math.round(args.amount * 100);
  const date = args.date ?? todayISO();
  const paymentSource: PaymentSource = args.paymentSource ?? "outro";
  const status = args.dueDate && args.dueDate > todayISO() ? "pendente" : "concluido";

  let categoryId = args.category;
  let categorySuggested = false;
  let categoryLabel = categoryId ?? "";
  if (!categoryId) {
    const categories = [...DEFAULT_CATEGORIES, ...(await fetchCustomCategories(ctx.userId, ctx.client))];
    const suggestion = suggestCategory(args.description, args.type, categories);
    categoryId = suggestion.categoryId;
    categoryLabel = suggestion.label;
    categorySuggested = true;
  }

  const payload: NewTransactionInput = {
    type: args.type,
    amount: amountCents,
    date,
    category: categoryId,
    description: args.description,
    paymentSource,
    status,
    dueDate: status === "pendente" ? args.dueDate : undefined,
    notes: args.notes,
  };

  const typeLabel = TRANSACTION_TYPE_LABELS[args.type] ?? args.type;
  const lines = [
    typeLabel,
    formatCurrencyCents(amountCents),
    categorySuggested ? `Categoria sugerida: ${categoryLabel}` : `Categoria: ${categoryLabel || categoryId}`,
    `Descrição: ${args.description}`,
    `Data: ${date}`,
    `Status: ${status === "concluido" ? "realizado" : "pendente"}`,
  ];
  if (args.dueDate) lines.push(`Vencimento: ${args.dueDate}`);
  const previewText = `${lines.join("\n")}\n\nVou registrar esse lançamento. Confirmar?`;

  const proposal = await createProposal(ctx.userId, "transaction", payload, previewText, ctx.client);

  return {
    proposalId: proposal.id,
    preview: previewText,
    categorySuggested,
    expiresAt: proposal.expiresAt,
    requiresConfirmation: true as const,
  };
}

export async function confirmTransaction(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal || proposal.kind !== "transaction") {
    throw new Error("Proposta não encontrada.");
  }
  if (proposal.status !== "pending") {
    throw new Error(`Esta proposta já está com status "${proposal.status}" e não pode ser confirmada de novo.`);
  }
  if (isExpired(proposal)) {
    throw new Error("Esta proposta expirou. Peça para a IA gerar o lançamento novamente.");
  }

  const transaction = buildTransaction(proposal.payload as NewTransactionInput);
  await upsertTransactions(ctx.userId, [transaction], ctx.client);
  await markProposalConfirmed(proposal.id, ctx.client);

  return {
    transactionId: transaction.id,
    message: `Lançamento registrado: ${transaction.description} — ${formatCurrencyCents(transaction.amount)}.`,
  };
}

export async function cancelTransaction(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal || proposal.kind !== "transaction") {
    throw new Error("Proposta não encontrada.");
  }
  if (proposal.status === "pending") {
    await markProposalCancelled(proposal.id, ctx.client);
  }
  return { message: "Proposta cancelada. Nada foi registrado." };
}
