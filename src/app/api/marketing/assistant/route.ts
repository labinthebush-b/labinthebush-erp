import { createClient } from "@/lib/supabase/server";
import { SUGGEST_TASKS_TOOL, assistantRequestSchema, renderSnapshotMessage, suggestTasksInputSchema } from "@/lib/marketing/assistant";
import { GeminiError, streamGemini } from "@/lib/marketing/gemini";

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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "A IA ainda não está configurada: falta a variável GEMINI_API_KEY no servidor." }, { status: 503 });
  }

  const parsed = assistantRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Pedido inválido." }, { status: 400 });
  const { messages, snapshot } = parsed.data;
  if (messages[messages.length - 1].role !== "user") {
    return Response.json({ error: "A última mensagem precisa ser do usuário." }, { status: 400 });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      try {
        for await (const event of streamGemini({ apiKey, messages, snapshotText: renderSnapshotMessage(snapshot), signal: request.signal })) {
          if (event.type === "text") send({ type: "text", text: event.text });
          else if (event.type === "function_call" && event.name === SUGGEST_TASKS_TOOL.name) {
            // O Gemini não garante o formato: validamos antes de mostrar.
            const tasks = suggestTasksInputSchema.safeParse(event.args);
            if (tasks.success) send({ type: "tasks", tasks: tasks.data.tasks });
          } else if (event.type === "blocked") {
            send({ type: "error", message: "A IA não pôde responder a essa pergunta. Tente reformular." });
          } else if (event.type === "max_tokens") {
            send({ type: "error", message: "A resposta ficou longa demais e foi cortada." });
          }
        }
        send({ type: "done" });
      } catch (error) {
        let message = "Não foi possível falar com a IA agora.";
        if (error instanceof GeminiError) {
          if (error.status === 400 || error.status === 401 || error.status === 403) message = "A chave do Gemini (GEMINI_API_KEY) foi recusada.";
          else if (error.status === 429) message = "Limite de uso do Gemini atingido — espere um pouco e tente de novo.";
          else message = `A IA respondeu com erro ${error.status}.`;
        } else if ((error as Error).name === "AbortError") {
          message = "Resposta interrompida.";
        }
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(body, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
