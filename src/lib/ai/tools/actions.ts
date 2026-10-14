// "Propor → preview → confirmar" para venda, tarefa e contato — mesmo contrato
// de tools/transactions.ts: a IA nunca grava direto; ela cria uma proposta,
// mostra o preview e só o passo de confirmação escreve no banco, usando os
// mesmos construtores que a tela usa (buildSaleRecords, Task, Contact).

import { z } from "zod";
import type { AiRequestContext } from "../context";
import { createProposal, getOwnProposal, isExpired, markProposalCancelled, markProposalConfirmed, type Proposal } from "../proposals";
import { loadAiSettings } from "./queries";
import { confirmTransaction } from "./transactions";
import { fetchProducts } from "@/lib/catalog/repository";
import { fetchContacts, upsertContacts } from "@/lib/contacts/repository";
import { fetchStockMovements, upsertStockMovements } from "@/lib/stock/repository";
import { upsertSales } from "@/lib/sales/repository";
import { upsertTransactions } from "@/lib/finance/repository";
import { upsertTasks } from "@/lib/tasks/repository";
import { buildSaleItem, calculateSaleBreakdown } from "@/lib/sales/calculations";
import { buildSaleRecords } from "@/lib/sales/build-sale";
import { findStockShortages, missingVariantChoice, trackedProductIds, variantLabel } from "@/lib/stock/calculations";
import { deriveStatusFromStage } from "@/lib/contacts/pipeline";
import { formatCurrencyCents } from "@/lib/currency";
import type { Product } from "@/lib/catalog/types";
import type { Task } from "@/lib/tasks/types";
import type { Contact } from "@/lib/contacts/types";

function makeId(): string {
  return crypto.randomUUID();
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

const CHANNEL_LABEL = { nuvemshop: "Nuvemshop", instagram: "Instagram", whatsapp: "WhatsApp", outro: "Outro" } as const;

/** Acha o produto por id ou por nome (sem diferenciar maiúsculas); nome ambíguo é erro explícito, nunca um chute. */
export function resolveProduct(products: Product[], ref: { productId?: string; productName?: string }): Product {
  if (ref.productId) {
    const byId = products.find((p) => p.id === ref.productId);
    if (byId) return byId;
    throw new Error(`Produto ${ref.productId} não encontrado.`);
  }
  const name = ref.productName?.trim().toLowerCase();
  if (!name) throw new Error("Informe productId ou productName de cada item.");
  const exact = products.filter((p) => p.name.toLowerCase() === name);
  if (exact.length === 1) return exact[0];
  const partial = products.filter((p) => p.name.toLowerCase().includes(name));
  if (partial.length === 1) return partial[0];
  if (partial.length === 0) throw new Error(`Nenhum produto com o nome "${ref.productName}". Consulte get_produtos.`);
  throw new Error(`Mais de um produto combina com "${ref.productName}": ${partial.map((p) => p.name).join(", ")}. Use o productId.`);
}

/** Tamanho/cor precisam ser opções do cadastro (sem diferenciar maiúsculas); devolve a grafia do cadastro. */
function resolveOption(options: string[] | undefined, value: string | undefined, what: string, productName: string): string | undefined {
  if (!value) return undefined;
  const match = (options ?? []).find((o) => o.trim().toLowerCase() === value.trim().toLowerCase());
  if (!match) throw new Error(`"${value}" não é ${what} de ${productName}. Opções: ${(options ?? []).join(", ") || "nenhuma"}.`);
  return match.trim();
}

// ---------------------------------------------------------------------------
// Venda
// ---------------------------------------------------------------------------

const salePayloadSchema = z.object({
  date: z.string(),
  contactId: z.string().optional(),
  items: z.array(
    z.object({ id: z.string(), productId: z.string(), size: z.string().optional(), color: z.string().optional(), quantity: z.number(), unitPrice: z.number(), subtotal: z.number() })
  ),
  discounts: z.array(z.any()),
  shippingCost: z.number(),
  channel: z.enum(["nuvemshop", "instagram", "whatsapp", "outro"]),
  notes: z.string().optional(),
  payment: z.enum(["pago", "pendente"]),
});

export type ProposeSaleArgs = {
  items: { productId?: string; productName?: string; size?: string; color?: string; quantity: number; unitPrice?: number }[];
  date?: string;
  channel: "nuvemshop" | "instagram" | "whatsapp" | "outro";
  contactId?: string;
  payment?: "pago" | "pendente";
  shippingCost?: number;
  notes?: string;
};

export async function proposeSale(ctx: AiRequestContext, args: ProposeSaleArgs) {
  if (!args.items?.length) throw new Error("Informe ao menos um item.");
  const [products, movements, contacts, settings] = await Promise.all([
    fetchProducts(ctx.userId, ctx.client),
    fetchStockMovements(ctx.userId, ctx.client),
    fetchContacts(ctx.userId, ctx.client),
    loadAiSettings(ctx),
  ]);

  const items = args.items.map((raw) => {
    if (!Number.isInteger(raw.quantity) || raw.quantity < 1) throw new Error("quantity deve ser um inteiro maior que zero.");
    const product = resolveProduct(products, raw);
    const size = resolveOption(product.sizes, raw.size, "um tamanho", product.name);
    const color = resolveOption(product.colors, raw.color, "uma cor", product.name);
    const missing = missingVariantChoice(product, { size, color });
    if (missing) throw new Error(`Informe ${missing === "cor" ? "a cor" : "o tamanho"} de ${product.name}. Opções: ${(missing === "cor" ? product.colors : product.sizes)?.join(", ")}.`);
    const unitPrice = raw.unitPrice !== undefined ? Math.round(raw.unitPrice * 100) : product.price;
    if (!unitPrice || unitPrice <= 0) throw new Error(`${product.name} não tem preço cadastrado: informe unitPrice em reais.`);
    return buildSaleItem({ productId: product.id, size, color, quantity: raw.quantity, unitPrice });
  });

  if (args.contactId && !contacts.some((c) => c.id === args.contactId)) throw new Error("Contato não encontrado. Consulte get_contatos ou proponha um contato novo.");
  if (args.shippingCost !== undefined && (!Number.isFinite(args.shippingCost) || args.shippingCost < 0)) throw new Error("shippingCost inválido.");

  const payload = {
    date: args.date ?? todayISO(),
    contactId: args.contactId,
    items,
    discounts: [],
    shippingCost: Math.round((args.shippingCost ?? 0) * 100),
    channel: args.channel,
    notes: args.notes,
    payment: args.payment ?? "pago",
  };
  const breakdown = calculateSaleBreakdown({ ...payload, nuvemshopFeePercent: settings.nuvemshopFeePercent });
  const shortages = findStockShortages({ items, movements });
  const name = (id: string) => products.find((p) => p.id === id)?.name ?? "Produto";

  const lines = [
    `Venda — ${CHANNEL_LABEL[args.channel]} — ${payload.date}`,
    ...items.map((i) => `• ${i.quantity}× ${name(i.productId)}${i.size || i.color ? ` (${variantLabel(i)})` : ""} — ${formatCurrencyCents(i.unitPrice)} = ${formatCurrencyCents(i.subtotal)}`),
    payload.shippingCost ? `Frete: ${formatCurrencyCents(payload.shippingCost)}` : null,
    `Total: ${formatCurrencyCents(breakdown.totalAmount)}`,
    breakdown.nuvemshopFeeAmount ? `Taxa Nuvemshop (despesa): ${formatCurrencyCents(breakdown.nuvemshopFeeAmount)}` : null,
    `Pagamento: ${payload.payment === "pago" ? "pago" : "pendente (a receber)"}`,
    args.contactId ? `Cliente: ${contacts.find((c) => c.id === args.contactId)?.name}` : "Cliente: não informado",
    ...shortages.map((s) => `⚠ Estoque insuficiente: ${name(s.productId)} (${variantLabel(s)}) — pedido ${s.requested}, em estoque ${Math.max(s.available, 0)}. A venda pode ser registrada mesmo assim.`),
  ].filter(Boolean);
  const previewText = `${lines.join("\n")}\n\nVou registrar a venda (entra no Financeiro e baixa o estoque). Confirmar?`;

  const proposal = await createProposal(ctx.userId, "sale", payload, previewText, ctx.client);
  return { proposalId: proposal.id, preview: previewText, expiresAt: proposal.expiresAt, requiresConfirmation: true as const };
}

async function confirmSale(ctx: AiRequestContext, proposal: Proposal) {
  const input = salePayloadSchema.parse(proposal.payload);
  const [products, movements, settings] = await Promise.all([
    fetchProducts(ctx.userId, ctx.client),
    fetchStockMovements(ctx.userId, ctx.client),
    loadAiSettings(ctx),
  ]);
  const tracked = trackedProductIds(movements);
  const records = buildSaleRecords({
    input,
    saleId: makeId(),
    now: new Date().toISOString(),
    nuvemshopFeePercent: settings.nuvemshopFeePercent,
    productName: (id) => products.find((p) => p.id === id)?.name,
    isTracked: (id) => tracked.has(id),
    makeId,
  });
  // Ordem: financeiro → venda → estoque (sem FK entre eles; ver migrations).
  await upsertTransactions(ctx.userId, records.transactions, ctx.client);
  await upsertSales(ctx.userId, [records.sale], ctx.client);
  await upsertStockMovements(ctx.userId, records.movements, ctx.client);
  return {
    saleId: records.sale.id,
    message: `Venda registrada: ${formatCurrencyCents(records.sale.totalAmount)}${records.movements.length ? `, estoque baixado em ${records.movements.length} ${records.movements.length === 1 ? "item" : "itens"}` : ""}.`,
  };
}

// ---------------------------------------------------------------------------
// Tarefa e contato
// ---------------------------------------------------------------------------

const taskPayloadSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["baixa", "media", "alta"]).optional(),
});

export async function proposeTask(ctx: AiRequestContext, args: z.infer<typeof taskPayloadSchema>) {
  const payload = taskPayloadSchema.parse({ ...args, title: args.title?.trim() });
  const previewText = [
    `Tarefa: ${payload.title}`,
    payload.dueDate ? `Prazo: ${payload.dueDate}` : null,
    payload.priority ? `Prioridade: ${payload.priority}` : null,
    payload.description ? `Detalhes: ${payload.description}` : null,
  ]
    .filter(Boolean)
    .join("\n") + "\n\nVou criar essa tarefa. Confirmar?";
  const proposal = await createProposal(ctx.userId, "task", payload, previewText, ctx.client);
  return { proposalId: proposal.id, preview: previewText, expiresAt: proposal.expiresAt, requiresConfirmation: true as const };
}

async function confirmTask(ctx: AiRequestContext, proposal: Proposal) {
  const input = taskPayloadSchema.parse(proposal.payload);
  const now = new Date().toISOString();
  const task: Task = { id: makeId(), title: input.title, status: "a_fazer", description: input.description, dueDate: input.dueDate, priority: input.priority, createdAt: now, updatedAt: now };
  await upsertTasks(ctx.userId, [task], ctx.client);
  return { taskId: task.id, message: `Tarefa criada: ${task.title}.` };
}

const contactPayloadSchema = z.object({
  name: z.string().min(1),
  whatsapp: z.string().optional(),
  instagram: z.string().optional(),
  email: z.string().optional(),
});

export async function proposeContact(ctx: AiRequestContext, args: z.infer<typeof contactPayloadSchema>) {
  const payload = contactPayloadSchema.parse({ ...args, name: args.name?.trim() });
  const contacts = await fetchContacts(ctx.userId, ctx.client);
  const duplicate = contacts.find(
    (c) =>
      c.name.toLowerCase() === payload.name.toLowerCase() ||
      (payload.whatsapp && c.whatsapp === payload.whatsapp) ||
      (payload.instagram && c.instagram?.replace(/^@/, "").toLowerCase() === payload.instagram.replace(/^@/, "").toLowerCase())
  );
  const previewText = [
    `Contato novo: ${payload.name}`,
    payload.whatsapp ? `WhatsApp: ${payload.whatsapp}` : null,
    payload.instagram ? `Instagram: ${payload.instagram}` : null,
    payload.email ? `E-mail: ${payload.email}` : null,
    duplicate ? `⚠ Já existe um contato parecido: ${duplicate.name} (id ${duplicate.id}). Talvez seja melhor usar esse.` : null,
  ]
    .filter(Boolean)
    .join("\n") + "\n\nVou criar esse contato (estágio: novo contato). Confirmar?";
  const proposal = await createProposal(ctx.userId, "contact", payload, previewText, ctx.client);
  return { proposalId: proposal.id, preview: previewText, expiresAt: proposal.expiresAt, possivelDuplicado: duplicate?.id ?? null, requiresConfirmation: true as const };
}

async function confirmContact(ctx: AiRequestContext, proposal: Proposal) {
  const input = contactPayloadSchema.parse(proposal.payload);
  const now = new Date().toISOString();
  const contact: Contact = {
    id: makeId(),
    name: input.name,
    status: deriveStatusFromStage("novo"),
    stageId: "novo",
    whatsapp: input.whatsapp,
    instagram: input.instagram,
    email: input.email,
    customFields: [],
    createdAt: now,
    updatedAt: now,
  };
  await upsertContacts(ctx.userId, [contact], ctx.client);
  return { contactId: contact.id, message: `Contato criado: ${contact.name}.` };
}

// ---------------------------------------------------------------------------
// Confirmar / cancelar qualquer proposta
// ---------------------------------------------------------------------------

export async function confirmProposal(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal) throw new Error("Proposta não encontrada.");
  if (proposal.kind === "transaction") return confirmTransaction(ctx, args);
  if (proposal.status !== "pending") throw new Error(`Esta proposta já está com status "${proposal.status}" e não pode ser confirmada de novo.`);
  if (isExpired(proposal)) throw new Error("Esta proposta expirou. Peça para a IA gerar de novo.");

  // Mesma ordem de confirmTransaction: grava e só então marca como confirmada
  // (uma falha no meio deixa a proposta pendente, nunca "confirmada" sem registro).
  const result =
    proposal.kind === "sale" ? await confirmSale(ctx, proposal) : proposal.kind === "task" ? await confirmTask(ctx, proposal) : await confirmContact(ctx, proposal);
  await markProposalConfirmed(proposal.id, ctx.client);
  return result;
}

export async function cancelProposal(ctx: AiRequestContext, args: { proposalId: string }) {
  const proposal = await getOwnProposal(ctx.userId, args.proposalId, ctx.client);
  if (!proposal) throw new Error("Proposta não encontrada.");
  if (proposal.status === "pending") await markProposalCancelled(proposal.id, ctx.client);
  return { message: "Proposta cancelada. Nada foi registrado." };
}
