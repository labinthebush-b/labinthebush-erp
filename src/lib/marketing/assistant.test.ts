import { describe, expect, it } from "vitest";
import {
  ASSISTANT_SYSTEM_PROMPT,
  SUGGEST_TASKS_TOOL,
  assistantRequestSchema,
  renderSnapshotMessage,
  suggestTasksInputSchema,
  type MarketingSnapshot,
} from "./assistant";

const snapshot: MarketingSnapshot = {
  periodDays: 30,
  today: "2026-10-14",
  funnel: [
    {
      stage: "Topo — Atração",
      metrics: [{ label: "Alcance no Instagram", source: "instagram", value: 5844, ratePercentFromPrevious: null, parallel: false }],
    },
  ],
  diagnostics: [{ title: "Ninguém tocou no link da bio", description: "..." }],
  instagram: { reach: 5844, views: 15698, accountsEngaged: 92, totalInteractions: 285, profileLinksTaps: 0 },
  sales: { count: 1, revenueBRL: 142, averageTicketBRL: 142, receivableCount: 0, receivableBRL: 0, byChannel: [{ channel: "nuvemshop", count: 1, revenueBRL: 142 }] },
  products: [{ name: "NREM — camiseta", priceBRL: 142, marginPercent: 68, unitsInStock: 10, soldInPeriod: 1 }],
  openLeads: 5,
  brandNotes: "Público 18-30, streetwear autoral.",
};

describe("assistantRequestSchema", () => {
  it("aceita um pedido real (histórico + retrato)", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "Onde está o gargalo?" }], snapshot }).success).toBe(true);
  });

  it("aceita valores ausentes como null (fonte fora do ar)", () => {
    const withNull = { ...snapshot, instagram: null, funnel: [{ stage: "Topo", metrics: [{ ...snapshot.funnel[0].metrics[0], value: null }] }] };
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "oi" }], snapshot: withNull }).success).toBe(true);
  });

  it("recusa histórico vazio, papel desconhecido, mensagem vazia e período fora de 7/30", () => {
    expect(assistantRequestSchema.safeParse({ messages: [], snapshot }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "system", content: "x" }], snapshot }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "" }], snapshot }).success).toBe(false);
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "x" }], snapshot: { ...snapshot, periodDays: 90 } }).success).toBe(false);
  });

  it("limita o tamanho das notas da marca e da conversa (custo e abuso)", () => {
    expect(assistantRequestSchema.safeParse({ messages: [{ role: "user", content: "x" }], snapshot: { ...snapshot, brandNotes: "a".repeat(4001) } }).success).toBe(false);
    const many = Array.from({ length: 31 }, () => ({ role: "user" as const, content: "x" }));
    expect(assistantRequestSchema.safeParse({ messages: many, snapshot }).success).toBe(false);
  });
});

describe("suggestTasksInputSchema", () => {
  it("aceita de 1 a 5 tarefas com etapa válida", () => {
    expect(suggestTasksInputSchema.safeParse({ tasks: [{ title: "Colocar o link da loja na bio", why: "toques no link = 0", stage: "topo" }] }).success).toBe(true);
  });

  it("recusa etapa inventada, título vazio e mais de 5 tarefas", () => {
    expect(suggestTasksInputSchema.safeParse({ tasks: [{ title: "Fazer algo", why: "", stage: "lateral" }] }).success).toBe(false);
    expect(suggestTasksInputSchema.safeParse({ tasks: [{ title: "", why: "", stage: "topo" }] }).success).toBe(false);
    const six = Array.from({ length: 6 }, (_, i) => ({ title: `Tarefa ${i}`, why: "", stage: "meio" }));
    expect(suggestTasksInputSchema.safeParse({ tasks: six }).success).toBe(false);
  });

  it("o JSON Schema da ferramenta enviado à IA bate com a validação local", () => {
    const item = SUGGEST_TASKS_TOOL.input_schema.properties.tasks.items;
    expect(item.required).toEqual(["title", "why", "stage"]);
    expect(item.properties.stage.enum).toEqual(["topo", "meio", "fundo"]);
    expect(SUGGEST_TASKS_TOOL.input_schema.properties.tasks.maxItems).toBe(5);
    expect(SUGGEST_TASKS_TOOL.input_schema.additionalProperties).toBe(false);
  });
});

describe("instruções e retrato", () => {
  it("as instruções proíbem inventar números e mandam citar os dados", () => {
    expect(ASSISTANT_SYSTEM_PROMPT).toContain("Nunca invente número");
    expect(ASSISTANT_SYSTEM_PROMPT).toContain("sugerir_tarefas");
  });

  it("as instruções não carregam nada que mude a cada pergunta (mantém o cache)", () => {
    expect(ASSISTANT_SYSTEM_PROMPT).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it("o retrato vai como JSON completo, com período e data", () => {
    const message = renderSnapshotMessage(snapshot);
    expect(message).toContain("últimos 30 dias até 2026-10-14");
    expect(JSON.parse(message.slice(message.indexOf("{")))).toEqual(snapshot);
  });
});
