// Cliente mínimo da API do Gemini (Google AI) para o assistente de marketing.
// Só roda no servidor (a chave nunca vai ao navegador). Sem SDK: a API REST é
// simples e o projeto evita dependência nova.

import { ASSISTANT_SYSTEM_PROMPT, SUGGEST_TASKS_TOOL } from "./assistant";

export const GEMINI_MODEL = "gemini-flash-latest";
const BASE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

export type ChatMessage = { role: "user" | "assistant"; content: string };

type GeminiPart = { text?: string; functionCall?: { name: string; args?: unknown } };
type GeminiChunk = {
  candidates?: { content?: { parts?: GeminiPart[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string };
};

export type GeminiEvent =
  | { type: "text"; text: string }
  | { type: "function_call"; name: string; args: unknown }
  | { type: "blocked"; reason: string }
  | { type: "max_tokens" };

/** Converte o histórico do chat para o formato do Gemini (assistant → "model"). */
export function toGeminiContents(messages: ChatMessage[], snapshotText: string) {
  return messages.map((m, index) => ({
    role: m.role === "assistant" ? "model" : "user",
    parts:
      index === messages.length - 1 && m.role === "user"
        ? [{ text: snapshotText }, { text: m.content }]
        : [{ text: m.content }],
  }));
}

/** A função de sugerir tarefas, no formato do Gemini (OpenAPI sem additionalProperties). */
export function geminiTools() {
  const items = SUGGEST_TASKS_TOOL.input_schema.properties.tasks.items;
  return [
    {
      functionDeclarations: [
        {
          name: SUGGEST_TASKS_TOOL.name,
          description: SUGGEST_TASKS_TOOL.description,
          parameters: {
            type: "object",
            required: ["tasks"],
            properties: {
              tasks: {
                type: "array",
                maxItems: 5,
                items: {
                  type: "object",
                  required: items.required,
                  properties: items.properties,
                },
              },
            },
          },
        },
      ],
    },
  ];
}

/** Interpreta um pedaço do stream SSE do Gemini em eventos para a tela. */
export function parseGeminiChunk(chunk: GeminiChunk): GeminiEvent[] {
  const events: GeminiEvent[] = [];
  if (chunk.promptFeedback?.blockReason) {
    events.push({ type: "blocked", reason: chunk.promptFeedback.blockReason });
    return events;
  }
  const candidate = chunk.candidates?.[0];
  for (const part of candidate?.content?.parts ?? []) {
    if (part.text) events.push({ type: "text", text: part.text });
    if (part.functionCall) events.push({ type: "function_call", name: part.functionCall.name, args: part.functionCall.args });
  }
  const finish = candidate?.finishReason;
  if (finish === "SAFETY" || finish === "PROHIBITED_CONTENT" || finish === "BLOCKLIST" || finish === "SPII") {
    events.push({ type: "blocked", reason: finish });
  } else if (finish === "MAX_TOKENS") {
    events.push({ type: "max_tokens" });
  }
  return events;
}

export class GeminiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Faz a chamada em streaming (SSE) e devolve os eventos conforme chegam. */
export async function* streamGemini(params: {
  apiKey: string;
  messages: ChatMessage[];
  snapshotText: string;
  signal?: AbortSignal;
}): AsyncGenerator<GeminiEvent> {
  const res = await fetch(`${BASE_URL}/${GEMINI_MODEL}:streamGenerateContent?alt=sse`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": params.apiKey },
    signal: params.signal,
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: ASSISTANT_SYSTEM_PROMPT }] },
      contents: toGeminiContents(params.messages, params.snapshotText),
      tools: geminiTools(),
      toolConfig: { functionCallingConfig: { mode: "AUTO" } },
      generationConfig: { maxOutputTokens: 4096, temperature: 0.6 },
    }),
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as GeminiChunk;
    throw new GeminiError(res.status, body.error?.message ?? `HTTP ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.startsWith("data:")) continue;
      const payload = line.slice(5).trim();
      if (!payload) continue;
      yield* parseGeminiChunk(JSON.parse(payload) as GeminiChunk);
    }
  }
}
