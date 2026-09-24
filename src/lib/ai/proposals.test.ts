import { describe, expect, it } from "vitest";
import { createProposal, getOwnProposal, isExpired, markProposalCancelled, markProposalConfirmed } from "./proposals";
import type { AnySupabaseClient } from "@/lib/supabase/types";
import type { NewTransactionInput } from "@/lib/finance/actions";

// ---------------------------------------------------------------------------
// Fake mínimo do client do Supabase para `ai_action_proposals` — mesmo
// padrão de src/lib/ai/keys.test.ts (fake em memória, exercitando o
// comportamento real da implementação, sem alterar nada em proposals.ts).
// Colunas espelham supabase/migrations/0002_ai_integration.sql.
// ---------------------------------------------------------------------------

type ProposalRow = {
  id: string;
  user_id: string;
  kind: string;
  payload: NewTransactionInput;
  preview_text: string;
  status: "pending" | "confirmed" | "cancelled" | "expired";
  created_at: string;
  expires_at: string;
  confirmed_at?: string | null;
};

function createFakeDb(seed: ProposalRow[] = []) {
  const rows: ProposalRow[] = [...seed];
  let idCounter = 0;

  function makeBuilder() {
    let operation: "select" | "insert" | "update" = "select";
    let values: Record<string, unknown> = {};
    const filters: { column: string; value: unknown }[] = [];

    const matches = (row: ProposalRow) =>
      filters.every(({ column, value }) => (row as unknown as Record<string, unknown>)[column] === value);

    function run() {
      if (operation === "insert") {
        idCounter += 1;
        const now = new Date();
        const row: ProposalRow = {
          id: `proposal-${idCounter}`,
          created_at: now.toISOString(),
          // 30 minutos à frente, mesma regra da migration (default now() + 30min) —
          // relativa ao relógio real, não uma data fixa.
          expires_at: new Date(now.getTime() + 30 * 60 * 1000).toISOString(),
          status: "pending",
          ...(values as unknown as Omit<ProposalRow, "id" | "created_at" | "expires_at" | "status">),
        };
        rows.push(row);
        return { data: [row], error: null };
      }
      if (operation === "update") {
        const updated = rows.filter(matches);
        for (const row of updated) Object.assign(row, values);
        return { data: updated, error: null };
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
      eq: (column: string, value: unknown) => {
        filters.push({ column, value });
        return builder;
      },
      single: () => {
        const result = run();
        const list = result.data as ProposalRow[];
        return Promise.resolve({ data: list[0] ?? null, error: null });
      },
      maybeSingle: () => {
        const result = run();
        const list = result.data as ProposalRow[];
        return Promise.resolve({ data: list[0] ?? null, error: null });
      },
      then: (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
        Promise.resolve(run()).then(onFulfilled, onRejected),
    };
    return builder;
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- fake de teste
    client: { from: () => makeBuilder() } as any as AnySupabaseClient,
    rows,
  };
}

const USER = "user-1";
const OTHER_USER = "user-2";

const PAYLOAD: NewTransactionInput = {
  type: "expense",
  amount: 8000,
  date: "2026-09-24",
  category: "marketing",
  description: "Anúncio da Meta",
  paymentSource: "outro",
  status: "concluido",
};

describe("createProposal", () => {
  it("cria a proposta com status pending e o payload/preview informados", async () => {
    const db = createFakeDb();
    const proposal = await createProposal(USER, "transaction", PAYLOAD, "preview de texto", db.client);

    expect(proposal.status).toBe("pending");
    expect(proposal.userId).toBe(USER);
    expect(proposal.payload).toEqual(PAYLOAD);
    expect(proposal.previewText).toBe("preview de texto");
  });
});

describe("getOwnProposal", () => {
  it("encontra a proposta do próprio usuário", async () => {
    const db = createFakeDb();
    const created = await createProposal(USER, "transaction", PAYLOAD, "x", db.client);

    const found = await getOwnProposal(USER, created.id, db.client);

    expect(found?.id).toBe(created.id);
  });

  it("devolve null quando a proposta pertence a outro usuário (mesmo com o id certo)", async () => {
    const db = createFakeDb();
    const created = await createProposal(OTHER_USER, "transaction", PAYLOAD, "x", db.client);

    expect(await getOwnProposal(USER, created.id, db.client)).toBeNull();
  });

  it("devolve null quando o id não existe", async () => {
    const db = createFakeDb();
    expect(await getOwnProposal(USER, "id-inexistente", db.client)).toBeNull();
  });
});

describe("markProposalConfirmed / markProposalCancelled", () => {
  it("marca como confirmed e grava confirmed_at", async () => {
    const db = createFakeDb();
    const created = await createProposal(USER, "transaction", PAYLOAD, "x", db.client);

    await markProposalConfirmed(created.id, db.client);

    const row = db.rows.find((r) => r.id === created.id)!;
    expect(row.status).toBe("confirmed");
    expect(row.confirmed_at).toBeTruthy();
  });

  it("marca como cancelled", async () => {
    const db = createFakeDb();
    const created = await createProposal(USER, "transaction", PAYLOAD, "x", db.client);

    await markProposalCancelled(created.id, db.client);

    expect(db.rows.find((r) => r.id === created.id)!.status).toBe("cancelled");
  });
});

describe("isExpired", () => {
  it("uma proposta com expiresAt no passado está expirada", () => {
    const proposal = {
      id: "p1",
      userId: USER,
      kind: "transaction" as const,
      payload: PAYLOAD,
      previewText: "x",
      status: "pending" as const,
      createdAt: "2020-01-01T00:00:00.000Z",
      expiresAt: "2020-01-01T00:30:00.000Z",
    };
    expect(isExpired(proposal)).toBe(true);
  });

  it("uma proposta com expiresAt no futuro não está expirada", () => {
    const farFuture = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    const proposal = {
      id: "p1",
      userId: USER,
      kind: "transaction" as const,
      payload: PAYLOAD,
      previewText: "x",
      status: "pending" as const,
      createdAt: new Date().toISOString(),
      expiresAt: farFuture,
    };
    expect(isExpired(proposal)).toBe(false);
  });
});
