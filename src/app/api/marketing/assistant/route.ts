import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import {
  ASSISTANT_SYSTEM_PROMPT,
  SUGGEST_TASKS_TOOL,
  assistantRequestSchema,
  renderSnapshotMessage,
  suggestTasksInputSchema,
} from "@/lib/marketing/assistant";

// Resposta em NDJSON (uma linha JSON por evento) para a tela ir mostrando o
// texto enquanto a IA escreve:
//   {"type":"text","text":"..."}      pedaços do texto
//   {"type":"tasks","tasks":[...]}    ações sugeridas (validadas)
//   {"type":"error","message":"..."}  falha legível
//   {"type":"done"}
type StreamEvent =
  | { type: "text"; text: string }
  | { type: "tasks"; tasks: unknown }
  | { type: "error"; message: string }
  | { type: "done" };

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Não autenticado." }, { status: 401 });

  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json(
      { error: "A IA ainda não está configurada: falta a variável ANTHROPIC_API_KEY no servidor." },
      { status: 503 }
    );
  }

  const parsed = assistantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const { messages, snapshot } = parsed.data;
  if (messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "A última mensagem precisa ser do usuário." }, { status: 400 });
  }

  // O retrato dos dados entra junto da ÚLTIMA pergunta (não no system), para
  // as instruções fixas continuarem cacheadas entre perguntas.
  const history: Anthropic.Beta.BetaMessageParam[] = messages.map((m, index) =>
    index === messages.length - 1
      ? {
          role: "user",
          content: [
            { type: "text", text: renderSnapshotMessage(snapshot) },
            { type: "text", text: m.content },
          ],
        }
      : { role: m.role, content: m.content }
  );

  const client = new Anthropic();
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        const stream = client.beta.messages.stream(
          {
            model: "claude-opus-5-5",
            max_tokens: 8000,
            // Recusa por segurança é reencaminhada no servidor para outro modelo (ver skill claude-api).
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
            output_config: { effort: "medium" },
            system: [{ type: "text", text: ASSISTANT_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
            tools: [{ ...SUGGEST_TASKS_TOOL, strict: true, eager_input_streaming: true }],
            tool_choice: { type: "auto" },
            messages: history,
          },
          { signal: request.signal }
        );

        stream.on("text", (text) => send({ type: "text", text }));
        const final = await stream.finalMessage();

        if (final.stop_reason === "refusal") {
          send({ type: "error", message: "A IA não pôde responder a essa pergunta. Tente reformular." });
        } else {
          for (const block of final.content) {
            if (block.type !== "tool_use" || block.name !== SUGGEST_TASKS_TOOL.name) continue;
            // Com eager_input_streaming a API não valida o input: validamos aqui.
            const tasks = suggestTasksInputSchema.safeParse(block.input);
            if (tasks.success) send({ type: "tasks", tasks: tasks.data.tasks });
          }
          if (final.stop_reason === "max_tokens") {
            send({ type: "error", message: "A resposta ficou longa demais e foi cortada." });
          }
        }
        send({ type: "done" });
      } catch (error) {
        let message = "Não foi possível falar com a IA agora.";
        if (error instanceof Anthropic.AuthenticationError) message = "A chave da IA (ANTHROPIC_API_KEY) é inválida.";
        else if (error instanceof Anthropic.RateLimitError) message = "Muitas perguntas seguidas — espere um pouco e tente de novo.";
        else if (error instanceof Anthropic.APIError) message = `A IA respondeu com erro ${error.status}.`;
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
