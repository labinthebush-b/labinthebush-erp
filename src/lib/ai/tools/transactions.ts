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
import {
  deleteTransactionRows,
  fetchCustomCategories,
  fetchMonthClosings,
  fetchTransactionById,
  upsertTransactions,
} from "@/lib/finance/repository";
import { diffTransactionFields } from "@/lib/finance/edit";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";
import { TRANSACTION_TYPE_LABELS } from "@/lib/finance/categories";
import type { PaymentSource, Transaction, TransactionStatus, TransactionType } from "@/lib/finance/types";
import { formatCurrencyCents } from "@/lib/currency";
import { suggestCategory } from "../category-suggestion";
import { createProposal, getOwnProposal, isExpired, markProposalCancelled, markProposalConfirmed, type Proposal } from "../proposals";

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

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function assertISODate(value: string | undefined, field: string) {
  if (value !== undefined && (!ISO_DATE.test(value) || Number.isNaN(Date.parse(value)))) {
    throw new Error(`${field} deve estar no formato yyyy-MM-dd.`);
  }
}

/** Mesma regra da tela do Financeiro: mês fechado não aceita lançamento novo, edição nem exclusão. */
async function assertMonthOpen(ctx: AiRequestContext, dates: string[]) {
  const closings = await fetchMonthClosings(ctx.userId, ctx.client);
  for (const date of dates) {
    const month = date.slice(0, 7);
    if (closings.some((m) => m.id === month && m.status === "fechado")) {
      throw new Error(`O mês ${month} está fechado no Financeiro. Reabra o mês no ERP antes de mexer nos lançamentos dele.`);
    }
  }
}

/** Lançamento gerado por uma venda é editado pela venda, igual à tela — senão venda e Financeiro divergem. */
async function loadEditableTransaction(ctx: AiRequestContext, id: string): Promise<Transaction> {
  const transaction = await fetchTransactionById(ctx.userId, id, ctx.client);
  if (!transaction) throw new Error("Lançamento não encontrado. Consulte get_receitas_despesas para ver os ids.");
  if (transaction.relations?.saleId) {
    throw new Error("Este lançamento foi gerado por uma venda. Edite ou exclua a venda no ERP, não o lançamento.");
  }
  return transaction;
}

function describeTransaction(t: Pick<Transaction, "type" | "amount" | "description" | "date" | "category" | "status" | "dueDate">): string {
  const lines = [
    `${TRANSACTION_TYPE_LABELS[t.type] ?? t.type} — ${formatCurrencyCents(t.amount)}`,
    `Descrição: ${t.description}`,
    `Data: ${t.date}`,
    `Categoria: ${t.category}`,
    `Status: ${t.status === "concluido" ? "realizado" : t.status}`,
  ];
  if (t.dueDate) lines.push(`Vencimento: ${t.dueDate}`);
  return lines.join("\n");
}

export async function proposeTransaction(ctx: AiRequestContext, args: ProposeTransactionArgs) {
  if (!Number.isFinite(args.amount) || args.amount <= 0) {
    throw new Error("amount deve ser um valor positivo em reais.");
  }
  if (!args.description?.trim()) {
    throw new Error("description é obrigatória.");
  }

  assertISODate(args.date, "date");
  assertISODate(args.dueDate, "dueDate");
  const amountCents = Math.round(args.amount * 100);
  const date = args.date ?? todayISO();
  await assertMonthOpen(ctx, [date]);
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

const TRANSACTION_KINDS = new Set(["transaction", "transaction_update", "transaction_delete"]);

export function isTransactionProposal(kind: string): boolean {
  return TRANSACTION_KINDS.has(kind);
}

export async function confirmTransaction(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal || !isTransactionProposal(proposal.kind)) {
    throw new Error("Proposta não encontrada.");
  }
  if (proposal.status !== "pending") {
    throw new Error(`Esta proposta já está com status "${proposal.status}" e não pode ser confirmada de novo.`);
  }
  if (isExpired(proposal)) {
    throw new Error("Esta proposta expirou. Peça para a IA gerar o lançamento novamente.");
  }

  if (proposal.kind === "transaction_update") return confirmUpdate(ctx, proposal);
  if (proposal.kind === "transaction_delete") return confirmDelete(ctx, proposal);

  const payload = proposal.payload as NewTransactionInput;
  await assertMonthOpen(ctx, [payload.date]);
  const transaction = buildTransaction(payload);
  await upsertTransactions(ctx.userId, [transaction], ctx.client);
  await markProposalConfirmed(proposal.id, ctx.client);

  return {
    transactionId: transaction.id,
    message: `Lançamento registrado: ${transaction.description} — ${formatCurrencyCents(transaction.amount)}.`,
  };
}

export async function cancelTransaction(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal || !isTransactionProposal(proposal.kind)) {
    throw new Error("Proposta não encontrada.");
  }
  if (proposal.status === "pending") {
    await markProposalCancelled(proposal.id, ctx.client);
  }
  return { message: "Proposta cancelada. Nada foi registrado." };
}

// ---------------------------------------------------------------------------
// Editar / excluir um lançamento existente — mesmo "propor → confirmar"
// ---------------------------------------------------------------------------

export type ProposeUpdateTransactionArgs = {
  transactionId: string;
  type?: TransactionType;
  /** Em reais. */
  amount?: number;
  description?: string;
  date?: string;
  category?: string;
  paymentSource?: PaymentSource;
  status?: Exclude<TransactionStatus, "cancelado">;
  dueDate?: string;
  notes?: string;
};

type UpdatePayload = { transactionId: string; changes: Partial<Transaction>; expectedUpdatedAt: string };

export async function proposeUpdateTransaction(ctx: AiRequestContext, args: ProposeUpdateTransactionArgs) {
  const current = await loadEditableTransaction(ctx, args.transactionId);
  if (args.amount !== undefined && (!Number.isFinite(args.amount) || args.amount <= 0)) {
    throw new Error("amount deve ser um valor positivo em reais.");
  }
  if (args.description !== undefined && !args.description.trim()) throw new Error("description não pode ficar vazia.");
  assertISODate(args.date, "date");
  assertISODate(args.dueDate, "dueDate");

  const requested: Partial<Transaction> = {
    type: args.type,
    amount: args.amount === undefined ? undefined : Math.round(args.amount * 100),
    description: args.description?.trim(),
    date: args.date,
    category: args.category,
    paymentSource: args.paymentSource,
    status: args.status,
    dueDate: args.dueDate,
    notes: args.notes,
  };
  const changes = Object.fromEntries(Object.entries(requested).filter(([, v]) => v !== undefined)) as Partial<Transaction>;
  const changedFields = diffTransactionFields(current, changes);
  if (changedFields.length === 0) throw new Error("Nada mudou: os valores informados são iguais aos do lançamento.");
  await assertMonthOpen(ctx, [current.date, changes.date ?? current.date]);

  const after = { ...current, ...changes };
  const previewText = `Antes:\n${describeTransaction(current)}\n\nDepois:\n${describeTransaction(after)}\n\nVou salvar essa alteração. Confirmar?`;
  const payload: UpdatePayload = { transactionId: current.id, changes, expectedUpdatedAt: current.updatedAt };
  const proposal = await createProposal(ctx.userId, "transaction_update", payload, previewText, ctx.client);
  return {
    proposalId: proposal.id,
    preview: previewText,
    camposAlterados: changedFields,
    expiresAt: proposal.expiresAt,
    requiresConfirmation: true as const,
  };
}

export async function proposeDeleteTransaction(ctx: AiRequestContext, args: { transactionId: string }) {
  const current = await loadEditableTransaction(ctx, args.transactionId);
  await assertMonthOpen(ctx, [current.date]);
  const extra =
    current.relations?.installmentGroupId || current.relations?.recurrenceId
      ? "\n\nObs.: é uma parcela/recorrência — só esta ocorrência será excluída."
      : "";
  const previewText = `${describeTransaction(current)}${extra}\n\nVou EXCLUIR este lançamento do Financeiro (não dá para desfazer). Confirmar?`;
  const payload: UpdatePayload = { transactionId: current.id, changes: {}, expectedUpdatedAt: current.updatedAt };
  const proposal = await createProposal(ctx.userId, "transaction_delete", payload, previewText, ctx.client);
  return { proposalId: proposal.id, preview: previewText, expiresAt: proposal.expiresAt, requiresConfirmation: true as const };
}

/** Recusa se alguém mudou o lançamento depois do preview: o usuário confirmou outra coisa. */
async function loadUnchanged(ctx: AiRequestContext, payload: UpdatePayload): Promise<Transaction> {
  const current = await loadEditableTransaction(ctx, payload.transactionId);
  if (current.updatedAt !== payload.expectedUpdatedAt) {
    throw new Error("Este lançamento mudou depois da proposta. Peça uma proposta nova para conferir os dados atuais.");
  }
  return current;
}

async function confirmUpdate(ctx: AiRequestContext, proposal: Proposal) {
  const payload = proposal.payload as UpdatePayload;
  const current = await loadUnchanged(ctx, payload);
  await assertMonthOpen(ctx, [current.date, payload.changes.date ?? current.date]);
  const changedFields = diffTransactionFields(current, payload.changes);
  const at = new Date().toISOString();
  const updated: Transaction = {
    ...current,
    ...payload.changes,
    edited: true,
    updatedAt: at,
    editHistory: [...(current.editHistory ?? []), { at, fields: changedFields }],
  };
  await upsertTransactions(ctx.userId, [updated], ctx.client);
  await markProposalConfirmed(proposal.id, ctx.client);
  return { transactionId: updated.id, message: `Lançamento atualizado: ${updated.description} — ${formatCurrencyCents(updated.amount)}.` };
}

async function confirmDelete(ctx: AiRequestContext, proposal: Proposal) {
  const payload = proposal.payload as UpdatePayload;
  const current = await loadUnchanged(ctx, payload);
  await assertMonthOpen(ctx, [current.date]);
  await deleteTransactionRows(ctx.userId, [current.id], ctx.client);
  await markProposalConfirmed(proposal.id, ctx.client);
  return { transactionId: current.id, message: `Lançamento excluído: ${current.description}.` };
}
