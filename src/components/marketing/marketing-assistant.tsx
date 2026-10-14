"use client";

import * as React from "react";
import { ArrowUp, ChevronDown, ChevronRight, ListPlus, Sparkles, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useUI } from "@/components/providers/ui-provider";
import { TaskForm } from "@/components/tasks/task-form";
import { cn } from "@/lib/utils";
import type { MarketingSnapshot, SuggestedTask } from "@/lib/marketing/assistant";

const BRAND_NOTES_KEY = "erp-marketing-brand-notes";

const QUICK_QUESTIONS = [
  "Onde está o maior gargalo do meu funil agora?",
  "Monte um plano de 7 dias para vender mais.",
  "O que devo postar esta semana?",
  "Como transformar alcance do Instagram em visitas à loja?",
];

type ChatTurn = { role: "user" | "assistant"; content: string; tasks?: SuggestedTask[]; error?: string };

function readNotes(): string {
  try {
    return window.localStorage.getItem(BRAND_NOTES_KEY) ?? "";
  } catch {
    return "";
  }
}

/**
 * Assistente de marketing com IA. Cada pergunta vai com o retrato atual do
 * funil (snapshot) — a IA responde com base nos números de verdade e propõe
 * ações que viram tarefas com um clique.
 */
export function MarketingAssistant({ buildSnapshot, ready }: { buildSnapshot: (brandNotes: string) => MarketingSnapshot; ready: boolean }) {
  const { openDrawer, closeDrawer } = useUI();
  const [turns, setTurns] = React.useState<ChatTurn[]>([]);
  const [input, setInput] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [notes, setNotes] = React.useState(readNotes);
  const [notesOpen, setNotesOpen] = React.useState(() => readNotes().trim() === "");
  const abortRef = React.useRef<AbortController | null>(null);
  const endRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [turns]);

  function saveNotes(value: string) {
    setNotes(value);
    try {
      window.localStorage.setItem(BRAND_NOTES_KEY, value);
    } catch {
      // sem armazenamento: as notas valem só nesta visita
    }
  }

  function updateLast(update: (turn: ChatTurn) => ChatTurn) {
    setTurns((prev) => prev.map((turn, i) => (i === prev.length - 1 ? update(turn) : turn)));
  }

  async function ask(question: string) {
    const text = question.trim();
    if (!text || busy || !ready) return;
    const history: ChatTurn[] = [...turns, { role: "user", content: text }];
    setTurns([...history, { role: "assistant", content: "" }]);
    setInput("");
    setBusy(true);
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/marketing/assistant", {
        method: "POST",
        headers: { "content-type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          // Só texto vai de volta como histórico; respostas vazias/erros ficam de fora.
          messages: history.filter((t) => t.content.trim()).map((t) => ({ role: t.role, content: t.content })),
          snapshot: buildSnapshot(notes),
        }),
      });
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}));
        updateLast((t) => ({ ...t, error: body.error ?? `Erro ${res.status}.` }));
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          const event = JSON.parse(line) as { type: string; text?: string; tasks?: SuggestedTask[]; message?: string };
          if (event.type === "text" && event.text) updateLast((t) => ({ ...t, content: t.content + event.text }));
          else if (event.type === "tasks" && event.tasks) updateLast((t) => ({ ...t, tasks: event.tasks }));
          else if (event.type === "error") updateLast((t) => ({ ...t, error: event.message }));
        }
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") updateLast((t) => ({ ...t, error: "Falha de conexão com a IA." }));
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  }

  function createTask(task: SuggestedTask) {
    openDrawer({
      title: "Nova tarefa",
      description: task.why,
      content: <TaskForm defaultTitle={task.title} onDone={closeDrawer} />,
    });
  }

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="size-4 text-electric-blue" /> Estrategista com IA
        </CardTitle>
        <CardDescription>Responde com base nos números do seu funil e sugere ações que viram tarefas.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="rounded-lg border border-border">
          <button
            type="button"
            className="flex w-full items-center gap-1.5 px-3 py-2 text-left text-caption font-medium text-foreground"
            onClick={() => setNotesOpen((open) => !open)}
          >
            {notesOpen ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
            Sobre a marca {notes.trim() ? "" : "— preencha para respostas mais precisas"}
          </button>
          {notesOpen ? (
            <div className="flex flex-col gap-1.5 px-3 pb-3">
              <Textarea
                rows={4}
                value={notes}
                onChange={(e) => saveNotes(e.target.value)}
                maxLength={4000}
                placeholder="Público (idade, estilo, cidade), posicionamento, tom de voz, preço, próximos drops, o que já testou e não funcionou…"
              />
              <span className="text-caption text-muted-foreground">Fica salvo neste aparelho e vai junto de cada pergunta.</span>
            </div>
          ) : null}
        </div>

        <div className="flex max-h-[28rem] min-h-24 flex-col gap-3 overflow-y-auto">
          {turns.length === 0 ? (
            <div className="flex flex-col gap-2">
              {QUICK_QUESTIONS.map((q) => (
                <button
                  key={q}
                  type="button"
                  disabled={!ready || busy}
                  onClick={() => ask(q)}
                  className="rounded-lg border border-border px-3 py-2 text-left text-caption text-foreground transition-colors hover:bg-paper-mist disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>
          ) : (
            turns.map((turn, index) => (
              <div key={index} className={cn("flex flex-col gap-2", turn.role === "user" && "items-end")}>
                {turn.role === "user" ? (
                  <div className="max-w-[90%] rounded-lg bg-primary px-3 py-2 text-body text-primary-foreground">{turn.content}</div>
                ) : (
                  <div className="flex w-full flex-col gap-2">
                    {turn.content ? (
                      <div className="whitespace-pre-wrap text-body text-foreground">{turn.content.replace(/\*\*(.+?)\*\*/g, "$1")}</div>
                    ) : busy && index === turns.length - 1 && !turn.error ? (
                      <span className="animate-pulse text-caption text-muted-foreground">Analisando seu funil…</span>
                    ) : null}
                    {turn.tasks?.length ? (
                      <div className="flex flex-col gap-1.5 rounded-lg bg-paper-mist p-2">
                        <span className="text-caption font-medium text-muted-foreground">Ações sugeridas</span>
                        {turn.tasks.map((task) => (
                          <div key={task.title} className="flex items-center justify-between gap-2">
                            <div className="flex min-w-0 flex-col">
                              <span className="text-caption text-foreground">{task.title}</span>
                              <span className="text-[11px] text-muted-foreground">{task.stage} · {task.why}</span>
                            </div>
                            <Button size="sm" variant="outline" onClick={() => createTask(task)}>
                              <ListPlus className="size-3.5" /> Tarefa
                            </Button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {turn.error ? <span className="text-caption text-destructive">{turn.error}</span> : null}
                  </div>
                )}
              </div>
            ))
          )}
          <div ref={endRef} />
        </div>

        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            ask(input);
          }}
        >
          <Textarea
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                ask(input);
              }
            }}
            placeholder={ready ? "Pergunte sobre seu funil, posts, campanhas…" : "Carregando os dados do funil…"}
            disabled={!ready}
            className="min-h-0 flex-1 resize-none"
          />
          {busy ? (
            <Button type="button" size="icon" variant="outline" aria-label="Parar" onClick={() => abortRef.current?.abort()}>
              <Square className="size-3.5" />
            </Button>
          ) : (
            <Button type="submit" size="icon" aria-label="Enviar" disabled={!ready || !input.trim()}>
              <ArrowUp className="size-4" />
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
