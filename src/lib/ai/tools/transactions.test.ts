import { describe, expect, it } from "vitest";
import {
  cancelTransaction,
  confirmTransaction,
  proposeDeleteTransaction,
  proposeTransaction,
  proposeUpdateTransaction,
} from "./transactions";
import type { AiRequestContext } from "../context";
import type { AnySupabaseClient } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Fake do client do Supabase cobrindo as 3 tabelas que o fluxo propose→
// confirm→cancel realmente toca: `ai_action_proposals` (proposals.ts),
// `custom_categories` (fetchCustomCategories, só quando category é omitida)
// e `transactions` (upsertTransactions, no confirm). Um fake por tabela,
// roteado por nome — mesmo espírito de src/lib/ai/keys.test.ts, mas
// multi-tabela porque este fluxo atravessa duas camadas de verdade
// (proposals.ts + finance/repository.ts), exatamente como o código real faz.
// Nada aqui mocka funções do próprio módulo — createProposal, getOwnProposal,
// buildTransaction etc. rodam de verdade.
// ---------------------------------------------------------------------------

type Row = Record<string, unknown>;

function createFakeClient() {
  const tables: Record<string, Row[]> = {
    ai_action_proposals: [],
    custom_categories: [],
    transactions: [],
    month_closings: [],
  };
  let idCounter = 0;

  function builderFor(table: string) {
    let operation: "select" | "insert" | "update" | "upsert" | "delete" = "select";
    let values: Record<string, unknown> = {};
    let upsertRows: Row[] = [];
    const filters: { column: string; value: unknown }[] = [];
    const inFilters: { column: string; values: unknown[] }[] = [];

    const matches = (row: Row) =>
      filters.every(({ column, value }) => row[column] === value) &&
      inFilters.every(({ column, values }) => values.includes(row[column]));

    function run() {
      const rows = tables[table];
      if (operation === "insert") {
        idCounter += 1;
        const now = new Date();
        const row: Row = {
          id: `${table}-${idCounter}`,
          created_at: now.toISOString(),
          // Mesma regra da migration 0002 (default now() + 30min) — precisa
          // ser relativa ao relógio real, não uma data fixa, senão vira
          // "expirada" para sempre à medida que o tempo passa.
          expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          status: "pending",
          ...values,
        };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (operation === "update") {
        const updated = rows.filter(matches);
        for (const row of updated) Object.assign(row, values);
        return { data: updated, error: null };
      }
      if (operation === "delete") {
        const removed = rows.filter(matches);
        tables[table] = rows.filter((row) => !matches(row));
        return { data: removed, error: null };
      }
      if (operation === "upsert") {
        for (const row of upsertRows) {
          const existingIndex = rows.findIndex((r) => r.id === row.id);
          if (existingIndex >= 0) rows[existingIndex] = row;
          else rows.push(row);
        }
        return { data: upsertRows, error: null };
      }
      return { data: rows.filter(matches), error: null };
    }

    const builder = {
      select: () => builder,
      insert: (v: Record<string, unknown>) => {
        operation = "insert";
        values = v;
        return builder;
      },
      update: (v: Record<string, unknown>) => {
        operation = "update";
        values = v;
        return builder;
      },
      upsert: (v: Row[]) => {
        operation = "upsert";
        upsertRows = v;
        return builder;
      },
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      },
      in: (column: string, values: unknown[]) => {
        inFilters.push({ column, values });
        return builder;
      },
      delete: () => {
        operation = "delete";
        return builder;
      },
      single: () => {
        const result = run();
        return Promise.resolve({ data: (result.data as Row[])[0] ?? null, error: null });
      },
      maybeSingle: () => {
        const result = run();
        return Promise.resolve({ data: (result.data as Row[])[0] ?? null, error: null });
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  return {
    tables,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake de teste
    client: { from: (table: string) => builderFor(table) } as any as AnySupabaseClient,
  };
}

const USER = "user-1";

function makeCtx(): AiRequestContext & { rawClient: ReturnType<typeof createFakeClient> } {
  const fake = createFakeClient();
  return { userId: USER, client: fake.client, rawClient: fake };
}

describe("proposeTransaction", () => {
  it("cria uma proposta pendente sem gravar nenhuma transação", async () => {
    const ctx = makeCtx();

    const result = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    expect(result.requiresConfirmation).toBe(true);
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
    expect(ctx.rawClient.tables.ai_action_proposals).toHaveLength(1);
    expect(ctx.rawClient.tables.ai_action_proposals[0].status).toBe("pending");
  });

  it("sugere categoria por palavra-chave quando category é omitida, e sinaliza a sugestão", async () => {
    const ctx = makeCtx();
    const result = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    expect(result.categorySuggested).toBe(true);
    expect(result.preview).toContain("Categoria sugerida");
  });

  it("não sugere quando category é informada explicitamente", async () => {
    const ctx = makeCtx();
    const result = await proposeTransaction(ctx, {
      type: "expense",
      amount: 80,
      description: "Anúncio da Meta",
      category: "marketing",
    });

    expect(result.categorySuggested).toBe(false);
    expect(result.preview).toContain("Categoria:");
  });

  it("rejeita amount não positivo", async () => {
    const ctx = makeCtx();
    await expect(proposeTransaction(ctx, { type: "expense", amount: 0, description: "x" })).rejects.toThrow(
      "amount deve ser um valor positivo"
    );
    await expect(proposeTransaction(ctx, { type: "expense", amount: -10, description: "x" })).rejects.toThrow();
  });

  it("rejeita description vazia", async () => {
    const ctx = makeCtx();
    await expect(proposeTransaction(ctx, { type: "expense", amount: 10, description: "   " })).rejects.toThrow(
      "description é obrigatória"
    );
  });
});

describe("confirmTransaction", () => {
  it("proposta pendente confirmada vira uma transação real no Financeiro", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    const result = await confirmTransaction(ctx, { proposalId });

    expect(result.transactionId).toBeTruthy();
    expect(ctx.rawClient.tables.transactions).toHaveLength(1);
    expect(ctx.rawClient.tables.transactions[0].amount).toBe(8000); // 80 reais em centavos
    expect(ctx.rawClient.tables.ai_action_proposals[0].status).toBe("confirmed");
  });

  it("confirmar a mesma proposta duas vezes não duplica a transação", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    await confirmTransaction(ctx, { proposalId });
    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow(/já está com status "confirmed"/);

    expect(ctx.rawClient.tables.transactions).toHaveLength(1);
  });

  it("uma proposta expirada não pode ser confirmada", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    // Simula o relógio: força expires_at para o passado, exatamente como a
    // migration faria naturalmente depois de 30 minutos.
    const row = ctx.rawClient.tables.ai_action_proposals[0];
    row.expires_at = "2000-01-01T00:00:00.000Z";

    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow("expirou");
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
  });

  it("proposta inexistente é rejeitada", async () => {
    const ctx = makeCtx();
    await expect(confirmTransaction(ctx, { proposalId: "nao-existe" })).rejects.toThrow("não encontrada");
  });

  it("não confirma a proposta de outro usuário", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    const outroUsuario: AiRequestContext = { userId: "user-2", client: ctx.client };
    await expect(confirmTransaction(outroUsuario, { proposalId })).rejects.toThrow("não encontrada");
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
  });
});

describe("cancelTransaction", () => {
  it("proposta cancelada nunca vira transação", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    await cancelTransaction(ctx, { proposalId });

    expect(ctx.rawClient.tables.ai_action_proposals[0].status).toBe("cancelled");
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
  });

  it("uma proposta cancelada não pode mais ser confirmada", async () => {
    const ctx = makeCtx();
    const { proposalId } = await proposeTransaction(ctx, { type: "expense", amount: 80, description: "Anúncio da Meta" });

    await cancelTransaction(ctx, { proposalId });

    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow(/já está com status "cancelled"/);
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
  });

  it("proposta inexistente é rejeitada", async () => {
    const ctx = makeCtx();
    await expect(cancelTransaction(ctx, { proposalId: "nao-existe" })).rejects.toThrow("não encontrada");
  });
});

// ---------------------------------------------------------------------------
// Data do gasto, mês fechado, edição e exclusão
// ---------------------------------------------------------------------------

async function createdTransaction(ctx: ReturnType<typeof makeCtx>, extra: Record<string, unknown> = {}) {
  const { proposalId } = await proposeTransaction(ctx, {
    type: "expense",
    amount: 80,
    description: "Embalagem",
    category: "embalagem",
    date: "2026-11-03",
  });
  const { transactionId } = await confirmTransaction(ctx, { proposalId });
  Object.assign(ctx.rawClient.tables.transactions[0], extra);
  return transactionId;
}

describe("data do gasto", () => {
  it("grava na data informada (ex.: a anotada no papel), não em hoje", async () => {
    const ctx = makeCtx();
    await createdTransaction(ctx);
    expect(ctx.rawClient.tables.transactions[0].date).toBe("2026-11-03");
    expect(ctx.rawClient.tables.transactions[0].status).toBe("concluido");
  });

  it("rejeita data fora do formato yyyy-MM-dd", async () => {
    const ctx = makeCtx();
    await expect(
      proposeTransaction(ctx, { type: "expense", amount: 10, description: "x", category: "outros", date: "03/11/2026" })
    ).rejects.toThrow("yyyy-MM-dd");
  });

  it("recusa lançar em mês fechado, igual à tela", async () => {
    const ctx = makeCtx();
    ctx.rawClient.tables.month_closings.push({ id: "2026-10", user_id: USER, status: "fechado" });
    await expect(
      proposeTransaction(ctx, { type: "expense", amount: 10, description: "x", category: "outros", date: "2026-10-20" })
    ).rejects.toThrow("2026-10 está fechado");
  });
});

describe("proposeUpdateTransaction", () => {
  it("só grava depois de confirmar, e registra o histórico de edição", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);

    const proposal = await proposeUpdateTransaction(ctx, { transactionId, amount: 95, description: "Embalagem kraft" });
    expect(proposal.preview).toContain("Antes:");
    expect(proposal.preview).toContain("95,00");
    expect(proposal.camposAlterados).toEqual(["amount", "description"]);
    expect(ctx.rawClient.tables.transactions[0].amount).toBe(8000);

    await confirmTransaction(ctx, { proposalId: proposal.proposalId });
    const row = ctx.rawClient.tables.transactions[0];
    expect(row.amount).toBe(9500);
    expect(row.description).toBe("Embalagem kraft");
    expect(row.edited).toBe(true);
    expect((row.edit_history as { fields: string[] }[])[0].fields).toEqual(["amount", "description"]);
    expect(ctx.rawClient.tables.transactions).toHaveLength(1);
  });

  it("recusa quando nada muda", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    await expect(proposeUpdateTransaction(ctx, { transactionId, amount: 80 })).rejects.toThrow("Nada mudou");
  });

  it("não encontra lançamento de outra conta", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    const outraConta: AiRequestContext = { userId: "user-2", client: ctx.client };
    await expect(proposeUpdateTransaction(outraConta, { transactionId, amount: 1 })).rejects.toThrow("não encontrado");
  });

  it("recusa lançamento gerado por venda", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx, { relations: { saleId: "venda-1" } });
    await expect(proposeUpdateTransaction(ctx, { transactionId, amount: 1 })).rejects.toThrow("gerado por uma venda");
    await expect(proposeDeleteTransaction(ctx, { transactionId })).rejects.toThrow("gerado por uma venda");
  });

  it("recusa mover um lançamento para um mês fechado", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    ctx.rawClient.tables.month_closings.push({ id: "2026-10", user_id: USER, status: "fechado" });
    await expect(proposeUpdateTransaction(ctx, { transactionId, date: "2026-10-31" })).rejects.toThrow("fechado");
  });

  it("não confirma se o lançamento mudou depois do preview", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    const { proposalId } = await proposeUpdateTransaction(ctx, { transactionId, amount: 95 });
    ctx.rawClient.tables.transactions[0].updated_at = "2099-01-01T00:00:00.000Z";
    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow("mudou depois da proposta");
    expect(ctx.rawClient.tables.transactions[0].amount).toBe(8000);
  });
});

describe("proposeDeleteTransaction", () => {
  it("só apaga depois de confirmar", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);

    const { proposalId, preview } = await proposeDeleteTransaction(ctx, { transactionId });
    expect(preview).toContain("EXCLUIR");
    expect(ctx.rawClient.tables.transactions).toHaveLength(1);

    await confirmTransaction(ctx, { proposalId });
    expect(ctx.rawClient.tables.transactions).toHaveLength(0);
    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow(/já está com status "confirmed"/);
  });

  it("proposta de exclusão cancelada não apaga nada", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    const { proposalId } = await proposeDeleteTransaction(ctx, { transactionId });
    await cancelTransaction(ctx, { proposalId });
    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow(/cancelled/);
    expect(ctx.rawClient.tables.transactions).toHaveLength(1);
  });

  it("recusa excluir em mês fechado", async () => {
    const ctx = makeCtx();
    const transactionId = await createdTransaction(ctx);
    const { proposalId } = await proposeDeleteTransaction(ctx, { transactionId });
    ctx.rawClient.tables.month_closings.push({ id: "2026-11", user_id: USER, status: "fechado" });
    await expect(confirmTransaction(ctx, { proposalId })).rejects.toThrow("fechado");
    expect(ctx.rawClient.tables.transactions).toHaveLength(1);
  });
});
