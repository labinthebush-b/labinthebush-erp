// Assistente de marketing com IA (Claude) — partes puras: o que a IA sabe
// (instruções + retrato dos dados) e o formato das tarefas que ela sugere.
// A chamada à API fica em app/api/marketing/assistant/route.ts (servidor).

import { z } from "zod";

/** Retrato do momento que a tela já calculou — é o "conhecimento" vivo da IA. */
export const marketingSnapshotSchema = z.object({
  periodDays: z.union([z.literal(7), z.literal(30)]),
  today: z.string(),
  funnel: z.array(
    z.object({
      stage: z.string(),
      metrics: z.array(
        z.object({
          label: z.string(),
          source: z.string(),
          value: z.number().nullable(),
          ratePercentFromPrevious: z.number().nullable(),
          parallel: z.boolean(),
        })
      ),
    })
  ),
  diagnostics: z.array(z.object({ title: z.string(), description: z.string() })),
  instagram: z
    .object({ reach: z.number(), views: z.number(), accountsEngaged: z.number(), totalInteractions: z.number(), profileLinksTaps: z.number() })
    .nullable(),
  sales: z.object({
    count: z.number(),
    revenueBRL: z.number(),
    averageTicketBRL: z.number(),
    receivableCount: z.number(),
    receivableBRL: z.number(),
    byChannel: z.array(z.object({ channel: z.string(), count: z.number(), revenueBRL: z.number() })),
  }),
  products: z.array(
    z.object({ name: z.string(), priceBRL: z.number().nullable(), marginPercent: z.number().nullable(), unitsInStock: z.number().nullable(), soldInPeriod: z.number() })
  ),
  openLeads: z.number(),
  brandNotes: z.string().max(4000),
});
export type MarketingSnapshot = z.infer<typeof marketingSnapshotSchema>;

export const chatMessageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().min(1).max(8000),
});

export const assistantRequestSchema = z.object({
  messages: z.array(chatMessageSchema).min(1).max(30),
  snapshot: marketingSnapshotSchema,
});
export type AssistantRequest = z.infer<typeof assistantRequestSchema>;

export const suggestedTaskSchema = z.object({
  title: z.string().min(3).max(140),
  why: z.string().max(300),
  stage: z.enum(["topo", "meio", "fundo"]),
});
export const suggestTasksInputSchema = z.object({ tasks: z.array(suggestedTaskSchema).min(1).max(5) });
export type SuggestedTask = z.infer<typeof suggestedTaskSchema>;

/** Ferramenta que a IA usa para propor ações concretas — a tela vira cada uma num botão "Criar tarefa". */
export const SUGGEST_TASKS_TOOL = {
  name: "sugerir_tarefas",
  description:
    "Propõe até 5 ações concretas para o dono da marca executar, cada uma vira um botão 'Criar tarefa' no ERP. Use sempre que a resposta recomendar algo para fazer. Títulos curtos, no imperativo, específicos (ex.: 'Postar reels do drop NREM com link rastreável na bio').",
  input_schema: {
    type: "object" as const,
    additionalProperties: false,
    required: ["tasks"],
    properties: {
      tasks: {
        type: "array",
        minItems: 1,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["title", "why", "stage"],
          properties: {
            title: { type: "string", description: "Ação no imperativo, até ~100 caracteres." },
            why: { type: "string", description: "Uma frase: qual número do funil isso deve mexer." },
            stage: { type: "string", enum: ["topo", "meio", "fundo"] },
          },
        },
      },
    },
  },
};

/**
 * Instruções fixas (cacheáveis): quem é a marca, como o funil é medido e como
 * responder. Os dados do momento vão no fim da conversa, não aqui, para o
 * prefixo continuar igual entre perguntas.
 */
export const ASSISTANT_SYSTEM_PROMPT = `Você é o estrategista de marketing e vendas da Lab in the Bush, dentro do ERP da marca. Fala com o dono, em português do Brasil, de forma direta e prática.

Sobre a marca (o que se sabe com certeza):
- Pequena marca brasileira de moda/streetwear, operada pelo próprio dono, sem equipe.
- Produção sob demanda (POD): custo por peça registrado no ERP; camisetas em torno de R$ 142.
- Vende pela loja Nuvemshop, pelo Instagram (@labinthebush, conta pequena, ~100+ seguidores) e pelo WhatsApp.
- Não roda anúncios pagos hoje: todo o alcance é orgânico.
- Notas do dono sobre público, posicionamento e tom de voz chegam junto dos dados ("brandNotes"); trate como a fonte mais confiável sobre a marca.

Como os dados são medidos (o retrato chega como JSON a cada pergunta):
- Funil: topo = alcance do Instagram; meio = visitas à loja, produto visto, carrinho (GA4) e leads abertos no CRM; fundo = checkout (GA4), vendas e vendas pagas (ERP, todos os canais).
- As porcentagens seguem o caminho alcance → loja → produto → carrinho → checkout → venda → paga. Engajamento e leads são indicadores paralelos.
- Fontes diferentes contam pessoas de jeitos diferentes: leia como tendência. Vendas do ERP incluem Instagram/WhatsApp, por isso podem superar o checkout do site.
- Se o GA4 não registra "compra" mas o ERP tem vendas, o evento de compra provavelmente não está ativo na Nuvemshop.
- Valores em reais já vêm convertidos (BRL).

Como responder:
- Baseie cada afirmação nos números do retrato e cite-os ("58 visitas, 3 carrinhos"). Nunca invente número, meta, benchmark de mercado ou dado que não esteja no retrato; quando faltar dado, diga qual falta e como obtê-lo.
- Volume pequeno é normal para uma marca começando: com poucos eventos, aponte a tendência e evite conclusões estatísticas fortes.
- Priorize o gargalo de maior impacto e o que dá para fazer com tempo e dinheiro de uma pessoa só, sem anúncio pago (a menos que o dono pergunte de anúncio).
- Respostas curtas: no máximo ~180 palavras, em tópicos quando ajudar. Sem cabeçalhos grandes.
- Sempre que recomendar ações, chame a ferramenta sugerir_tarefas com 1 a 5 ações concretas, além do texto.`;

/** Mensagem final com o retrato do momento — fica depois do prefixo cacheado. */
export function renderSnapshotMessage(snapshot: MarketingSnapshot): string {
  return `Retrato atual do ERP (dados reais, últimos ${snapshot.periodDays} dias até ${snapshot.today}):\n${JSON.stringify(snapshot)}`;
}
