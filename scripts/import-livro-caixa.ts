/**
 * Importação única do livro-caixa (`_Docs/livro-caixa-lab-in-the-bush.xlsx`)
 * para o Financeiro/Vendas do ERP. A planilha é a fonte principal: o script
 * SUBSTITUI os lançamentos, vendas e recorrências da conta pelos da
 * planilha, menos os ids passados em --keep (lançamentos que só existem no
 * ERP e devem continuar). Produtos, contatos e categorias são reaproveitados
 * pelo nome (só cria o que falta).
 *
 * Monta tudo com as mesmas funções do app (buildTransaction, helpers de
 * venda, recorrência, repositórios), então os registros ficam iguais aos
 * feitos pela tela.
 *
 * Uso (sempre DEV primeiro; sem --apply só mostra o plano):
 *   npx tsx --env-file=.env.local scripts/import-livro-caixa.ts <lancamentos.json> <email-ou-user-id> [--keep=id1,id2] [--apply]
 *
 * <lancamentos.json> = aba "Lançamentos" exportada em JSON (uma linha por objeto, colunas da planilha + "linha").
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import type { AnySupabaseClient } from "../src/lib/supabase/types";

import { buildCustomCategory, buildRecurringRule, buildTransaction, makeId, nowISO } from "../src/lib/finance/actions";
import { DEFAULT_CATEGORIES } from "../src/lib/finance/categories";
import { calculateCaixa, calculateCapital, calculateResultado } from "../src/lib/finance/calculations";
import { generateMissingOccurrences, recurrenceOccurrenceId } from "../src/lib/finance/recurrence";
import {
  fetchCustomCategories,

  fetchTransactions,
  upsertCustomCategories,
  upsertRecurringRules,
  upsertTransactions,
} from "../src/lib/finance/repository";
import type { Category, PaymentSource, RecurringRule, Transaction } from "../src/lib/finance/types";
import {
  buildIncomeTransactionInput,
  buildNuvemshopFeeExpenseTransactionInput,
  buildSaleItem,
  buildShippingExpenseTransactionInput,
  calculateSaleBreakdown,
  describeSaleItems,
} from "../src/lib/sales/calculations";
import { fetchSales, upsertSales } from "../src/lib/sales/repository";
import type { Discount, Sale, SaleItem, SalesChannel } from "../src/lib/sales/types";
import { fetchProducts } from "../src/lib/catalog/repository";
import { fetchContacts, upsertContacts } from "../src/lib/contacts/repository";
import type { Contact } from "../src/lib/contacts/types";

// ---------------------------------------------------------------------------
// Planilha
// ---------------------------------------------------------------------------

type Row = {
  linha: number;
  Data: string | null;
  Tipo: "Entrada" | "Saída";
  Categoria: string;
  "Descrição": string;
  Qtd: number | null;
  "Valor (R$)": number | null;
  "Quem pagou/recebeu": string;
  Forma: string | null;
  "Produto / drop": string | null;
  Status: "Realizado" | "A confirmar" | "Previsto";
  "Rateado na jaqueta?": "Sim" | "Não";
  Fonte: string | null;
  "Observação": string | null;
};

/** Datas que faltavam na planilha, informadas pelo Berpz em 12/11/2026. */
const DATE_OVERRIDES: Record<string, string> = {
  "Instagram Ads (até 28/10)": "2026-10-28",
  "Sacos de envio pretos": "2026-11-07",
  "Tinta branca para carimbo": "2026-11-07",
  "Kit canetas de tecido (3)": "2026-11-07",
  Carimbo: "2026-11-07",
  "Venda direta (amigos) — Neutron Star + Komodo, 15% de desconto": "2026-09-08",
  "Venda direta (amigos) — Neutron Star": "2026-10-14",
};

const cents = (reais: number) => Math.round(reais * 100);
const brl = (c: number) => `R$ ${(c / 100).toFixed(2).replace(".", ",")}`;

// ---------------------------------------------------------------------------
// Categorias: planilha → ERP
// ---------------------------------------------------------------------------

const CUSTOM_LABELS = { producao: "Produção", formalizacao: "Formalização e impostos" } as const;

function categoryFor(row: Row, custom: Record<keyof typeof CUSTOM_LABELS, string>): string {
  switch (row.Categoria) {
    case "Produção":
      return custom.producao;
    case "Formalização e impostos":
      return custom.formalizacao;
    case "Plataforma e ferramentas":
      return row["Descrição"].startsWith("Claude") ? "software" : "plataforma";
    case "Marketing":
      return "marketing";
    case "Taxas de venda":
      return "taxas";
    case "Frete e envio":
      return "frete";
    case "Embalagem e aviamentos":
      return "embalagem";
    default:
      throw new Error(`Linha ${row.linha}: categoria sem mapeamento "${row.Categoria}"`);
  }
}

/** Quem pagou do próprio bolso: a despesa sai da conta pessoal e vira aporte. Taxa do Nuvem Pago é descontada na hora, não sai do bolso de ninguém. */
function paidByOwner(row: Row): boolean {
  return ["Berpz", "Sócio"].includes(row["Quem pagou/recebeu"]) && row.Categoria !== "Taxas de venda";
}

function notesFor(row: Row): string | undefined {
  const parts = [
    row["Produto / drop"] && `Drop: ${row["Produto / drop"]}`,
    row["Rateado na jaqueta?"] === "Sim" && "Rateado na jaqueta",
    row["Quem pagou/recebeu"] !== "Berpz" && row["Quem pagou/recebeu"] !== "Cliente" && `Pago por: ${row["Quem pagou/recebeu"]}`,
    row["Observação"] && !/data a confirmar/i.test(row["Observação"]) && row["Observação"],
    row["Observação"] && /reutiliz/i.test(row["Observação"]) && !row["Observação"].startsWith("Reutiliz") && "Reutilizável",
    "Importado do livro-caixa",
  ].filter(Boolean);
  return parts.join(" · ").replace(/\. Data a confirmar/g, "");
}

// ---------------------------------------------------------------------------
// Recorrências
// ---------------------------------------------------------------------------

const RECURRING = [
  { match: "Nuvemshop — mensalidade", description: "Nuvemshop — mensalidade", dayOfMonth: 31, startDate: "2026-08-31" },
  { match: "Claude — assinatura", description: "Claude — assinatura", dayOfMonth: 16, startDate: "2026-09-16" },
  { match: "MEI — DAS", description: "MEI — DAS", dayOfMonth: 20, startDate: "2026-10-15" },
];

// ---------------------------------------------------------------------------
// Vendas (com frete e taxa vinculados)
// ---------------------------------------------------------------------------

type SaleSpec = {
  incomeDescription: string;
  date?: string;
  channel: SalesChannel;
  contactName: string;
  items: { product: string; size?: string; quantity: number; unitPrice: number }[];
  discounts: Discount[];
  shippingCost: number;
  shippingPaidBy?: "Berpz";
  feeAmount: number;
  /** Linhas da planilha que viram parte desta venda (frete cobrado, taxa, etiqueta). */
  linkedDescriptions: string[];
  notes?: string;
};

const SALES: SaleSpec[] = [
  {
    incomeDescription: "Pedido #100 — NREM Camiseta (M)",
    channel: "nuvemshop",
    contactName: "Matheus Gomes",
    items: [{ product: "NREM", size: "M", quantity: 1, unitPrice: 14200 }],
    discounts: [{ kind: "frete_gratis", code: "NREMFREE" }],
    shippingCost: 3092,
    shippingPaidBy: "Berpz",
    feeAmount: 141,
    linkedDescriptions: ["Taxa Nuvem Pago — pedido #100", "Etiqueta de envio — pedido #100 (frete grátis)"],
    notes: "Pedido Nuvemshop #100 · Cupom NREMFREE: frete grátis, a marca pagou a etiqueta",
  },
  {
    incomeDescription: "Pedido #103 — Komodo Camiseta (M)",
    channel: "nuvemshop",
    contactName: "Gabriel Cárnio",
    items: [{ product: "Komodo", size: "M", quantity: 1, unitPrice: 14990 }],
    discounts: [{ kind: "percentual", percent: 5, description: "Desconto Pix" }],
    shippingCost: 2095,
    shippingPaidBy: "Berpz",
    feeAmount: 162,
    linkedDescriptions: ["Frete cobrado do cliente — pedido #103", "Taxa Nuvem Pago — pedido #103", "Etiqueta de envio — pedido #103"],
    notes: "Pedido Nuvemshop #103 · R$ 149,90 com R$ 7,50 de desconto + R$ 20,95 de frete cobrado",
  },
  {
    incomeDescription: "Venda direta (amigos) — Neutron Star + Komodo, 15% de desconto",
    channel: "outro",
    contactName: "Marcelo Bellan",
    items: [
      { product: "Neutron", quantity: 1, unitPrice: 12400 },
      { product: "Komodo", quantity: 1, unitPrice: 12400 },
    ],
    discounts: [],
    shippingCost: 0,
    feeAmount: 0,
    linkedDescriptions: [],
    notes: "Venda direta para amigos, já com 15% de desconto (R$ 248,00 as duas)",
  },
  {
    incomeDescription: "Venda direta (amigos) — Neutron Star",
    channel: "outro",
    contactName: "Lorenzo Gallon",
    items: [{ product: "Neutron", quantity: 1, unitPrice: 14000 }],
    discounts: [],
    shippingCost: 0,
    feeAmount: 0,
    linkedDescriptions: [],
    notes: "Venda direta para amigos",
  },
];

// ---------------------------------------------------------------------------
// Plano
// ---------------------------------------------------------------------------

type Plan = {
  categories: Category[];
  contacts: Contact[];
  rules: RecurringRule[];
  sales: Sale[];
  transactions: Transaction[];
  skipped: { row: Row; reason: string }[];
};

function buildPlan(params: {
  rows: Row[];
  existingCategories: Category[];
  products: { id: string; name: string }[];
  contacts: Contact[];
  horizon: string;
}): Plan {
  const now = nowISO();
  const rows = params.rows.map((r) => ({ ...r, Data: r.Data ?? DATE_OVERRIDES[r["Descrição"]] ?? null }));
  const used = new Set<number>();
  const skipped: Plan["skipped"] = [];
  const transactions: Transaction[] = [];

  // Categorias próprias (reaproveita se já existir com o mesmo nome).
  const categories: Category[] = [];
  const customIds = {} as Record<keyof typeof CUSTOM_LABELS, string>;
  const group = { producao: "custo", formalizacao: "despesa" } as const;
  for (const key of Object.keys(CUSTOM_LABELS) as (keyof typeof CUSTOM_LABELS)[]) {
    const found = params.existingCategories.find((c) => c.label === CUSTOM_LABELS[key] && c.group === group[key]);
    const category = found ?? buildCustomCategory(CUSTOM_LABELS[key], group[key]);
    if (!found) categories.push(category);
    customIds[key] = category.id;
  }

  // Aportes: um por pessoa por dia, somando o que ela pagou do bolso.
  const aportes = new Map<string, { date: string; who: string; amount: number; items: string[] }>();
  function addAporte(date: string, who: string, amount: number, item: string) {
    const key = `${date}|${who}`;
    const a = aportes.get(key) ?? { date, who, amount: 0, items: [] };
    a.amount += amount;
    a.items.push(item);
    aportes.set(key, a);
  }

  // 1. Linhas sem valor ficam de fora (ex.: Ads do sócio, ainda não aconteceu).
  for (const row of rows) {
    if (row["Valor (R$)"] == null) {
      skipped.push({ row, reason: "sem valor na planilha" });
      used.add(row.linha);
    } else if (!row.Data) {
      throw new Error(`Linha ${row.linha} sem data: "${row["Descrição"]}"`);
    }
  }

  // 2. Recorrências: regras + ocorrências já realizadas; as previstas o próprio app gera.
  const rules: RecurringRule[] = [];
  for (const spec of RECURRING) {
    const matches = rows.filter((r) => !used.has(r.linha) && r["Descrição"] === spec.match);
    if (matches.length === 0) throw new Error(`Nenhuma linha para a recorrência "${spec.match}"`);
    const first = matches[0];
    const rule = buildRecurringRule({
      description: spec.description,
      amount: cents(first["Valor (R$)"]!),
      category: categoryFor(first, customIds),
      paymentSource: "conta_pessoal",
      type: "expense",
      dayOfMonth: spec.dayOfMonth,
      startDate: spec.startDate,
    });
    rules.push(rule);
    for (const row of matches) {
      used.add(row.linha);
      if (row.Status !== "Realizado") continue; // Previsto: gerado abaixo, igual ao app
      const amount = cents(row["Valor (R$)"]!);
      transactions.push({
        ...buildTransaction({
          type: "expense",
          amount,
          date: row.Data!,
          category: rule.category,
          description: rule.description,
          paymentSource: "conta_pessoal",
          status: "concluido",
          notes: notesFor(row),
          relations: { recurrenceId: rule.id },
        }),
        id: recurrenceOccurrenceId(rule.id, row.Data!),
      });
      addAporte(row.Data!, row["Quem pagou/recebeu"], amount, rule.description);
    }
  }

  // 3. Vendas.
  const contacts: Contact[] = [];
  const allContacts = [...params.contacts];
  const productByKey = (key: string) => {
    const found = params.products.filter((p) => p.name.toLowerCase().startsWith(key.toLowerCase()));
    if (found.length !== 1) throw new Error(`Produto "${key}": ${found.length} encontrados (precisa ser 1)`);
    return found[0];
  };
  const sales: Sale[] = [];
  for (const spec of SALES) {
    const row = rows.find((r) => r["Descrição"] === spec.incomeDescription);
    if (!row) throw new Error(`Venda não encontrada na planilha: "${spec.incomeDescription}"`);
    used.add(row.linha);
    const linked = spec.linkedDescriptions.map((d) => {
      const r = rows.find((x) => x["Descrição"] === d);
      if (!r) throw new Error(`Linha vinculada não encontrada: "${d}"`);
      used.add(r.linha);
      return r;
    });
    const date = row.Data!;

    let contact = allContacts.find((c) => c.name === spec.contactName);
    if (!contact) {
      contact = { id: makeId(), name: spec.contactName, status: "cliente", stageId: "cliente", customFields: [], createdAt: now, updatedAt: now };
      contacts.push(contact);
      allContacts.push(contact);
    }

    const items: SaleItem[] = spec.items.map((i) =>
      buildSaleItem({ productId: productByKey(i.product).id, size: i.size, quantity: i.quantity, unitPrice: i.unitPrice })
    );
    const breakdown = calculateSaleBreakdown({ items, discounts: spec.discounts, shippingCost: spec.shippingCost, channel: spec.channel, nuvemshopFeePercent: 0 });

    // Confere com a planilha: receita (+ frete cobrado) tem que bater.
    const expectedTotal = cents(row["Valor (R$)"]!) + linked.filter((l) => l.Tipo === "Entrada").reduce((s, l) => s + cents(l["Valor (R$)"]!), 0);
    if (breakdown.totalAmount !== expectedTotal) {
      throw new Error(`Venda "${spec.incomeDescription}": total ${brl(breakdown.totalAmount)} ≠ planilha ${brl(expectedTotal)}`);
    }
    const linkedFee = linked.find((l) => l.Categoria === "Taxas de venda");
    if (linkedFee && cents(linkedFee["Valor (R$)"]!) !== spec.feeAmount) throw new Error(`Taxa de "${spec.incomeDescription}" não bate`);
    const linkedShipping = linked.find((l) => l.Tipo === "Saída" && l.Categoria === "Frete e envio");
    if (linkedShipping && cents(linkedShipping["Valor (R$)"]!) !== spec.shippingCost) throw new Error(`Frete de "${spec.incomeDescription}" não bate`);

    const saleId = makeId();
    const description = describeSaleItems(items, (id) => params.products.find((p) => p.id === id)?.name);
    const income = buildTransaction(
      buildIncomeTransactionInput({ date, totalAmount: breakdown.totalAmount, description, channel: spec.channel, saleId, payment: "pago" })
    );
    transactions.push(income);

    let shippingTx: Transaction | undefined;
    if (spec.shippingCost > 0) {
      const input = buildShippingExpenseTransactionInput({ saleId, date, shippingCost: spec.shippingCost, description, settled: true });
      shippingTx = buildTransaction({ ...input, paymentSource: spec.shippingPaidBy ? "conta_pessoal" : input.paymentSource });
      transactions.push(shippingTx);
      if (spec.shippingPaidBy) addAporte(date, spec.shippingPaidBy, spec.shippingCost, shippingTx.description);
    }
    let feeTx: Transaction | undefined;
    if (spec.feeAmount > 0) {
      feeTx = buildTransaction(buildNuvemshopFeeExpenseTransactionInput({ saleId, date, feeAmount: spec.feeAmount, settled: true }));
      transactions.push(feeTx);
    }

    sales.push({
      id: saleId,
      date,
      contactId: contact.id,
      items,
      discounts: spec.discounts,
      shippingAmount: breakdown.shippingAmount,
      shippingCost: spec.shippingCost || undefined,
      nuvemshopFeeAmount: spec.feeAmount || undefined,
      totalAmount: breakdown.totalAmount,
      channel: spec.channel,
      notes: spec.notes ? `${spec.notes} · Importado do livro-caixa` : "Importado do livro-caixa",
      transactionId: income.id,
      shippingTransactionId: shippingTx?.id,
      nuvemshopFeeTransactionId: feeTx?.id,
      createdAt: now,
      updatedAt: now,
    });
  }

  // 4. Demais saídas: uma despesa por linha.
  for (const row of rows) {
    if (used.has(row.linha)) continue;
    if (row.Tipo !== "Saída") throw new Error(`Linha ${row.linha} de entrada sem tratamento: "${row["Descrição"]}"`);
    if (row.Status !== "Realizado") throw new Error(`Linha ${row.linha} com status "${row.Status}" sem tratamento`);
    used.add(row.linha);
    const amount = cents(row["Valor (R$)"]!);
    const ownerPaid = paidByOwner(row);
    const paymentSource: PaymentSource = ownerPaid ? "conta_pessoal" : "conta_marca";
    transactions.push(
      buildTransaction({
        type: "expense",
        amount,
        date: row.Data!,
        category: categoryFor(row, customIds),
        description: row["Descrição"],
        paymentSource,
        status: "concluido",
        notes: notesFor(row),
      })
    );
    if (ownerPaid) addAporte(row.Data!, row["Quem pagou/recebeu"], amount, row["Descrição"]);
  }

  // 5. Aportes.
  for (const a of aportes.values()) {
    transactions.push(
      buildTransaction({
        type: "owner_contribution",
        amount: a.amount,
        date: a.date,
        category: "aporte",
        description: `Aporte ${a.who} — pago do próprio bolso`,
        paymentSource: "conta_pessoal",
        status: "concluido",
        notes: `${a.items.join("; ")} · Importado do livro-caixa`,
      })
    );
  }

  // 6. Previstos das recorrências, exatamente como o app gera ao abrir.
  for (const rule of rules) {
    transactions.push(...generateMissingOccurrences(rule, transactions, params.horizon, (d) => recurrenceOccurrenceId(rule.id, d), now));
  }

  return { categories, contacts, rules, sales, transactions, skipped };
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function resolveUserId(admin: AnySupabaseClient, identifier: string): Promise<string> {
  if (UUID_RE.test(identifier)) return identifier;
  const { data, error } = await admin.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email === identifier);
  if (!user) throw new Error(`Usuário "${identifier}" não encontrado.`);
  return user.id;
}

function summarize(label: string, transactions: Transaction[], categories: Category[]) {
  const r = calculateResultado(transactions, {}, categories);
  const c = calculateCapital(transactions);
  const realized = transactions.filter((t) => t.status === "concluido");
  const sum = (type: Transaction["type"]) => realized.filter((t) => t.type === type).reduce((s, t) => s + t.amount, 0);
  console.log(`\n${label}`);
  console.log(`  Saídas realizadas:   ${brl(sum("expense"))}`);
  console.log(`  Entradas realizadas: ${brl(sum("income"))}`);
  console.log(`  Aportes:             ${brl(c.capitalAportado)}`);
  console.log(`  Caixa:               ${brl(calculateCaixa(transactions))}`);
  console.log(`  Resultado (competência, inclui previstos): receita ${brl(r.receita)} · custos ${brl(r.custoProdutos)} · despesas ${brl(r.despesasOperacionais)} · lucro ${brl(r.lucroLiquido)}`);
  return { expense: sum("expense"), income: sum("income"), aportes: c.capitalAportado };
}

async function main() {
  const [file, identifier] = process.argv.slice(2).filter((a) => !a.startsWith("--"));
  const apply = process.argv.includes("--apply");
  const keep = new Set((process.argv.find((a) => a.startsWith("--keep="))?.slice(7) ?? "").split(",").filter(Boolean));
  if (!file || !identifier) {
    console.error("Uso: tsx --env-file=<env> scripts/import-livro-caixa.ts <lancamentos.json> <email-ou-user-id> [--keep=id1,id2] [--apply]");
    process.exit(1);
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const admin = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { autoRefreshToken: false, persistSession: false } });
  const userId = await resolveUserId(admin, identifier);
  console.log(`Banco: ${new URL(url).hostname.split(".")[0]} · conta ${userId} · ${apply ? "APLICANDO" : "só plano (sem --apply)"}`);

  const rows: Row[] = JSON.parse(readFileSync(file, "utf-8"));
  const [existingTx, existingSales, existingRules, existingCategories, products, contacts] = await Promise.all([
    fetchTransactions(userId, admin),
    fetchSales(userId, admin),
    // fetchRecurringRules só usa o client do navegador; aqui só precisamos dos ids.
    admin
      .from("recurring_rules")
      .select("id")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (error) throw error;
        return data as { id: string }[];
      }),
    fetchCustomCategories(userId, admin),
    fetchProducts(userId, admin),
    fetchContacts(userId, admin),
  ]);

  const missingKeep = [...keep].filter((id) => !existingTx.some((t) => t.id === id));
  if (missingKeep.length) throw new Error(`--keep com ids que não existem: ${missingKeep.join(", ")}`);
  const kept = existingTx.filter((t) => keep.has(t.id));
  const toDelete = existingTx.filter((t) => !keep.has(t.id));

  const horizon = (() => {
    const d = new Date();
    d.setUTCMonth(d.getUTCMonth() + 2);
    return d.toISOString().slice(0, 10);
  })();
  const plan = buildPlan({ rows, existingCategories, products, contacts, horizon });

  console.log(`\nSai do ERP (${toDelete.length} lançamentos, ${existingSales.length} vendas, ${existingRules.length} recorrências):`);
  for (const t of toDelete.sort((a, b) => a.date.localeCompare(b.date))) console.log(`  - ${t.date} ${t.type.padEnd(18)} ${brl(t.amount).padStart(11)}  ${t.status.padEnd(9)} ${t.description}`);
  console.log(`\nContinua no ERP (--keep, ${kept.length}):`);
  for (const t of kept) console.log(`  = ${t.date} ${t.type.padEnd(18)} ${brl(t.amount).padStart(11)}  ${t.status.padEnd(9)} ${t.description}`);
  console.log(`\nEntra no ERP: ${plan.transactions.length} lançamentos, ${plan.sales.length} vendas, ${plan.rules.length} recorrências, ${plan.categories.length} categorias novas, ${plan.contacts.length} contatos novos`);
  const allCategories = [...DEFAULT_CATEGORIES, ...existingCategories, ...plan.categories];
  const catLabel = (id: string) => allCategories.find((c) => c.id === id)?.label ?? id;
  for (const t of [...plan.transactions].sort((a, b) => a.date.localeCompare(b.date))) {
    console.log(`  + ${t.date} ${t.type.padEnd(18)} ${brl(t.amount).padStart(11)}  ${t.status.padEnd(9)} ${catLabel(t.category).padEnd(24)} ${t.description}`);
  }
  for (const s of plan.skipped) console.log(`  (fora) linha ${s.row.linha}: ${s.row["Descrição"]} — ${s.reason}`);

  const planned = summarize("Totais só do livro-caixa no ERP:", plan.transactions, allCategories);
  const expected = rows.filter((r) => r.Status === "Realizado" && r["Valor (R$)"] != null);
  const expExpense = expected.filter((r) => r.Tipo === "Saída").reduce((s, r) => s + cents(r["Valor (R$)"]!), 0);
  const expIncome = expected.filter((r) => r.Tipo === "Entrada").reduce((s, r) => s + cents(r["Valor (R$)"]!), 0);
  const expAportes = expected.filter((r) => r.Tipo === "Saída" && paidByOwner(r)).reduce((s, r) => s + cents(r["Valor (R$)"]!), 0);
  const checks = [
    ["Saídas realizadas", planned.expense, expExpense],
    ["Entradas realizadas", planned.income, expIncome],
    ["Aportes", planned.aportes, expAportes],
  ] as const;
  console.log("\nConferência com a planilha:");
  let ok = true;
  for (const [label, got, want] of checks) {
    const pass = got === want;
    ok &&= pass;
    console.log(`  ${pass ? "OK " : "ERRO"} ${label}: ERP ${brl(got)} · planilha ${brl(want)}`);
  }
  if (!ok) throw new Error("Totais não batem com a planilha — nada foi gravado.");
  summarize("Totais finais da conta (livro-caixa + mantidos):", [...plan.transactions, ...kept], allCategories);

  if (!apply) {
    console.log("\nNada gravado. Rode de novo com --apply para gravar.");
    return;
  }

  // Apaga o que a planilha substitui (filhos antes dos pais) e grava o novo.
  const del = async (table: string, column: string, ids: string[]) => {
    if (ids.length === 0) return;
    const { error } = await admin.from(table).delete().eq("user_id", userId).in(column, ids);
    if (error) throw error;
  };
  await del("sale_items", "sale_id", existingSales.map((s) => s.id));
  await del("sales", "id", existingSales.map((s) => s.id));
  await del("transactions", "id", toDelete.map((t) => t.id));
  await del("recurring_rules", "id", existingRules.map((r) => r.id));

  await upsertCustomCategories(userId, plan.categories, admin);
  await upsertContacts(userId, plan.contacts, admin);
  await upsertRecurringRules(userId, plan.rules, admin);
  await upsertTransactions(userId, plan.transactions, admin);
  await upsertSales(userId, plan.sales, admin);

  // Lê de volta e confere.
  const after = await fetchTransactions(userId, admin);
  const afterSales = await fetchSales(userId, admin);
  const final = summarize("Gravado — lido de volta do banco:", after, allCategories);
  const expectedFinal = summarize("(esperado)", [...plan.transactions, ...kept], allCategories);
  if (final.expense !== expectedFinal.expense || final.income !== expectedFinal.income || final.aportes !== expectedFinal.aportes || afterSales.length !== plan.sales.length) {
    throw new Error("O que foi gravado não bate com o plano.");
  }
  console.log(`\nConcluído: ${after.length} lançamentos e ${afterSales.length} vendas na conta.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
