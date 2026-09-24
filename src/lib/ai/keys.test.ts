import { describe, expect, it } from "vitest";
import { createApiKey, listApiKeys, resolveUserIdFromApiKey, revokeApiKey } from "./keys";
import type { AnySupabaseClient } from "@/lib/supabase/types";

// ---------------------------------------------------------------------------
// Fake mínimo do client do Supabase
//
// Guarda as linhas de `ai_api_keys` em memória e implementa só as cadeias de
// chamada que lib/ai/keys.ts realmente usa. O objetivo é exercitar o
// comportamento REAL da implementação — o hash é calculado de verdade, o
// prefixo é derivado de verdade, a chave crua nunca é persistida de verdade —
// sem precisar de um banco. Nada aqui existe para "facilitar" o teste: as
// funções testadas não foram alteradas.
//
// Colunas espelham supabase/migrations/0002_ai_integration.sql. Repare que não
// existe `revoked_at`/`expires_at`/`active`: nessa tabela, revogar é apagar a
// linha (a própria migration diz "uma chave é criada e revogada (deletada),
// nunca editada").
// ---------------------------------------------------------------------------

type KeyRow = {
  id: string;
  user_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
};

type QueryResult = { data: unknown; error: unknown };

type Operation = "select" | "insert" | "update" | "delete";

type Builder = {
  select: (columns?: string) => Builder;
  insert: (values: Record<string, unknown>) => Builder;
  update: (values: Record<string, unknown>) => Builder;
  delete: () => Builder;
  eq: (column: string, value: unknown) => Builder;
  order: (column: string, options?: { ascending?: boolean }) => Builder;
  single: () => Promise<QueryResult>;
  maybeSingle: () => Promise<QueryResult>;
  then: (onFulfilled: (value: QueryResult) => unknown, onRejected?: (reason: unknown) => unknown) => Promise<unknown>;
};

type FakeDb = {
  client: AnySupabaseClient;
  /** Linhas atualmente "persistidas" — usado para checar o que foi gravado. */
  rows: KeyRow[];
  /** Quantas vezes `.from()` foi chamado: prova se houve (ou não) ida ao banco. */
  queryCount: () => number;
};

/**
 * `failOn` simula o que o PostgREST faz quando a query falha: a promise
 * RESOLVE com `{ error }`. `rejectOn` simula uma falha de transporte (rede
 * caiu, fetch abortado): a promise REJEITA. São modos de falha diferentes e o
 * código reage a cada um de um jeito — por isso os dois existem aqui.
 */
function createFakeDb(options: { rows?: KeyRow[]; failOn?: Operation; rejectOn?: Operation } = {}): FakeDb {
  const rows: KeyRow[] = options.rows ? [...options.rows] : [];
  let queries = 0;
  let idCounter = 0;

  function makeBuilder(): Builder {
    let operation: Operation | null = null;
    let values: Record<string, unknown> = {};
    const filters: { column: string; value: unknown }[] = [];
    let descending = false;

    const matches = (row: KeyRow) =>
      filters.every(({ column, value }) => (row as unknown as Record<string, unknown>)[column] === value);

    function run(): QueryResult {
      const op: Operation = operation ?? "select";
      if (options.failOn === op) {
        return { data: null, error: { message: `falha simulada no ${op}` } };
      }

      if (op === "insert") {
        idCounter += 1;
        const row: KeyRow = {
          id: `key-${idCounter}`,
          created_at: new Date(2026, 0, idCounter).toISOString(),
          last_used_at: null,
          ...(values as unknown as Omit<KeyRow, "id" | "created_at" | "last_used_at">),
        };
        rows.push(row);
        return { data: [row], error: null };
      }

      if (op === "update") {
        const updated = rows.filter(matches);
        for (const row of updated) Object.assign(row, values);
        return { data: updated, error: null };
      }

      if (op === "delete") {
        const removed = rows.filter(matches);
        for (const row of removed) rows.splice(rows.indexOf(row), 1);
        return { data: removed, error: null };
      }

      const found = rows.filter(matches);
      if (descending) found.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return { data: found, error: null };
    }

    /** Executa a query, mas rejeitando (em vez de resolver) quando `rejectOn` casa com a operação. */
    function settle(): Promise<QueryResult> {
      const op: Operation = operation ?? "select";
      if (options.rejectOn === op) {
        return Promise.reject(new Error(`falha de transporte simulada no ${op}`));
      }
      return Promise.resolve(run());
    }

    function firstOf(result: QueryResult): QueryResult {
      if (result.error) return result;
      const list = result.data as KeyRow[];
      return { data: list[0] ?? null, error: null };
    }

    const builder: Builder = {
      select: () => {
        operation ??= "select";
        return builder;
      },
      insert: (nextValues) => {
        operation = "insert";
        values = nextValues;
        return builder;
      },
      update: (nextValues) => {
        operation = "update";
        values = nextValues;
        return builder;
      },
      delete: () => {
        operation = "delete";
        return builder;
      },
      eq: (column, value) => {
        filters.push({ column, value });
        return builder;
      },
      order: (_column, orderOptions) => {
        descending = orderOptions?.ascending === false;
        return builder;
      },
      single: () =>
        settle().then((raw) => {
          const result = firstOf(raw);
          // PostgREST devolve erro quando .single() não encontra exatamente uma linha.
          if (!result.error && result.data === null) {
            return { data: null, error: { message: "nenhuma linha encontrada" } };
          }
          return result;
        }),
      maybeSingle: () => settle().then(firstOf),
      then: (onFulfilled, onRejected) => settle().then(onFulfilled, onRejected),
    };

    return builder;
  }

  const client = {
    // O nome da tabela não é usado: este fake existe só para `ai_api_keys`.
    from: () => {
      queries += 1;
      return makeBuilder();
    },
  };

  return {
    client: client as unknown as AnySupabaseClient,
    rows,
    queryCount: () => queries,
  };
}

const USER = "user-1";
const OTHER_USER = "user-2";

// ---------------------------------------------------------------------------

describe("createApiKey", () => {
  it("devolve a chave crua uma única vez, com o prefixo sk_erp_", async () => {
    const db = createFakeDb();
    const { rawKey, summary } = await createApiKey(USER, "Claude", db.client);

    expect(rawKey.startsWith("sk_erp_")).toBe(true);
    expect(summary.name).toBe("Claude");
  });

  it("nunca persiste a chave crua — só o hash e o prefixo de exibição", async () => {
    const db = createFakeDb();
    const { rawKey } = await createApiKey(USER, "Claude", db.client);

    const stored = db.rows[0];
    expect(stored.key_hash).not.toBe(rawKey);
    expect(JSON.stringify(stored)).not.toContain(rawKey);
    // O prefixo guardado é curto o bastante para não reconstruir a chave.
    expect(stored.key_prefix).toBe(rawKey.slice(0, 13));
    expect(stored.key_prefix.length).toBeLessThan(rawKey.length);
  });

  it("duas chaves nunca são iguais (nem a chave crua, nem o hash)", async () => {
    const db = createFakeDb();
    const first = await createApiKey(USER, "Claude", db.client);
    const second = await createApiKey(USER, "ChatGPT", db.client);

    expect(first.rawKey).not.toBe(second.rawKey);
    expect(db.rows[0].key_hash).not.toBe(db.rows[1].key_hash);
  });

  it("propaga o erro do banco em vez de devolver uma chave que não foi salva", async () => {
    const db = createFakeDb({ failOn: "insert" });
    await expect(createApiKey(USER, "Claude", db.client)).rejects.toBeDefined();
  });
});

describe("resolveUserIdFromApiKey", () => {
  it("chave válida: resolve para o usuário dono da chave", async () => {
    const db = createFakeDb();
    const { rawKey } = await createApiKey(USER, "Claude", db.client);

    expect(await resolveUserIdFromApiKey(rawKey, db.client)).toBe(USER);
  });

  it("chave válida: registra o último uso (last_used_at)", async () => {
    const db = createFakeDb();
    const { rawKey } = await createApiKey(USER, "Claude", db.client);
    expect(db.rows[0].last_used_at).toBeNull();

    await resolveUserIdFromApiKey(rawKey, db.client);

    expect(db.rows[0].last_used_at).not.toBeNull();
  });

  it("chave com prefixo inválido: rejeita sem nem consultar o banco", async () => {
    const db = createFakeDb();
    const queriesBefore = db.queryCount();

    expect(await resolveUserIdFromApiKey("chave-qualquer", db.client)).toBeNull();
    expect(await resolveUserIdFromApiKey("", db.client)).toBeNull();
    expect(await resolveUserIdFromApiKey("Bearer sk_erp_abc", db.client)).toBeNull();
    expect(await resolveUserIdFromApiKey("sk_outro_abc", db.client)).toBeNull();

    expect(db.queryCount()).toBe(queriesBefore);
  });

  it("chave com prefixo certo mas inexistente: devolve null", async () => {
    const db = createFakeDb();
    expect(await resolveUserIdFromApiKey("sk_erp_naoexiste", db.client)).toBeNull();
  });

  it("chave revogada deixa de autenticar (revogar = apagar a linha, não desativar)", async () => {
    const db = createFakeDb();
    const { rawKey, summary } = await createApiKey(USER, "Claude", db.client);
    expect(await resolveUserIdFromApiKey(rawKey, db.client)).toBe(USER);

    await revokeApiKey(USER, summary.id, db.client);

    expect(await resolveUserIdFromApiKey(rawKey, db.client)).toBeNull();
  });

  it("erro na consulta da chave: propaga em vez de deixar passar como não autenticado", async () => {
    const db = createFakeDb({ failOn: "select" });
    await expect(resolveUserIdFromApiKey("sk_erp_abc", db.client)).rejects.toBeDefined();
  });

  it("last_used_at devolvendo { error } não impede a autenticação (best-effort)", async () => {
    const seeded = createFakeDb();
    const { rawKey } = await createApiKey(USER, "Claude", seeded.client);

    // Mesmo estado, mas agora toda UPDATE responde com erro do PostgREST.
    const db = createFakeDb({ rows: seeded.rows, failOn: "update" });

    expect(await resolveUserIdFromApiKey(rawKey, db.client)).toBe(USER);
  });

  it("last_used_at rejeitando a promise (falha de transporte) não impede a autenticação", async () => {
    const seeded = createFakeDb();
    const { rawKey } = await createApiKey(USER, "Claude", seeded.client);

    // A consulta da chave funciona, mas a gravação do último uso cai na rede.
    const db = createFakeDb({ rows: seeded.rows, rejectOn: "update" });

    expect(await resolveUserIdFromApiKey(rawKey, db.client)).toBe(USER);
  });

  it("o best-effort cobre só a gravação: uma falha de transporte na CONSULTA ainda propaga", async () => {
    // Guarda contra "consertar" o caso acima engolindo o erro da função inteira:
    // uma chave que não pôde ser verificada nunca pode virar autenticação ok.
    const db = createFakeDb({ rejectOn: "select" });
    await expect(resolveUserIdFromApiKey("sk_erp_abc", db.client)).rejects.toThrow("falha de transporte");
  });
});

describe("listApiKeys", () => {
  it("mapeia as colunas do banco para o formato da UI", async () => {
    const db = createFakeDb();
    await createApiKey(USER, "Claude", db.client);

    const [summary] = await listApiKeys(USER, db.client);

    expect(summary).toEqual({
      id: db.rows[0].id,
      name: "Claude",
      keyPrefix: db.rows[0].key_prefix,
      createdAt: db.rows[0].created_at,
      lastUsedAt: null,
    });
  });

  it("lista apenas as chaves do próprio usuário", async () => {
    const db = createFakeDb();
    await createApiKey(USER, "Minha", db.client);
    await createApiKey(OTHER_USER, "De outro usuário", db.client);

    const mine = await listApiKeys(USER, db.client);

    expect(mine).toHaveLength(1);
    expect(mine[0].name).toBe("Minha");
  });

  it("devolve lista vazia quando o usuário não tem chaves", async () => {
    const db = createFakeDb();
    expect(await listApiKeys(USER, db.client)).toEqual([]);
  });

  it("propaga o erro do banco", async () => {
    const db = createFakeDb({ failOn: "select" });
    await expect(listApiKeys(USER, db.client)).rejects.toBeDefined();
  });
});

describe("revokeApiKey", () => {
  it("remove a chave do usuário", async () => {
    const db = createFakeDb();
    const { summary } = await createApiKey(USER, "Claude", db.client);

    await revokeApiKey(USER, summary.id, db.client);

    expect(db.rows).toHaveLength(0);
  });

  it("não remove a chave de outro usuário, mesmo com o id correto", async () => {
    const db = createFakeDb();
    const { summary } = await createApiKey(OTHER_USER, "De outro usuário", db.client);

    await revokeApiKey(USER, summary.id, db.client);

    expect(db.rows).toHaveLength(1);
  });

  it("propaga o erro do banco", async () => {
    const db = createFakeDb({ failOn: "delete" });
    await expect(revokeApiKey(USER, "key-1", db.client)).rejects.toBeDefined();
  });
});
