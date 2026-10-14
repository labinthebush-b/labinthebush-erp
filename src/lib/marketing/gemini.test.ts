import { describe, expect, it } from "vitest";
import { geminiTools, parseGeminiChunk, toGeminiContents } from "./gemini";

describe("toGeminiContents", () => {
  it("converte papéis (assistant → model) e põe o retrato só na última pergunta", () => {
    const contents = toGeminiContents(
      [
        { role: "user", content: "primeira" },
        { role: "assistant", content: "resposta" },
        { role: "user", content: "segunda" },
      ],
      "RETRATO"
    );
    expect(contents.map((c) => c.role)).toEqual(["user", "model", "user"]);
    expect(contents[0].parts).toEqual([{ text: "primeira" }]);
    expect(contents[2].parts).toEqual([{ text: "RETRATO" }, { text: "segunda" }]);
  });
});

describe("geminiTools", () => {
  it("declara a função de tarefas sem additionalProperties (não aceito pelo Gemini)", () => {
    const declaration = geminiTools()[0].functionDeclarations[0];
    expect(declaration.name).toBe("sugerir_tarefas");
    expect(JSON.stringify(declaration)).not.toContain("additionalProperties");
    expect(declaration.parameters.properties.tasks.items.required).toEqual(["title", "why", "stage"]);
  });
});

describe("parseGeminiChunk", () => {
  it("texto e chamada de função no mesmo pedaço", () => {
    const events = parseGeminiChunk({
      candidates: [
        { content: { parts: [{ text: "Seu gargalo é a bio." }, { functionCall: { name: "sugerir_tarefas", args: { tasks: [] } } }] } },
      ],
    });
    expect(events).toEqual([
      { type: "text", text: "Seu gargalo é a bio." },
      { type: "function_call", name: "sugerir_tarefas", args: { tasks: [] } },
    ]);
  });

  it("bloqueio por segurança no prompt ou na resposta vira 'blocked'", () => {
    expect(parseGeminiChunk({ promptFeedback: { blockReason: "SAFETY" } })).toEqual([{ type: "blocked", reason: "SAFETY" }]);
    expect(parseGeminiChunk({ candidates: [{ finishReason: "SAFETY" }] })).toEqual([{ type: "blocked", reason: "SAFETY" }]);
  });

  it("resposta cortada por tamanho é sinalizada; fim normal não gera evento", () => {
    expect(parseGeminiChunk({ candidates: [{ finishReason: "MAX_TOKENS" }] })).toEqual([{ type: "max_tokens" }]);
    expect(parseGeminiChunk({ candidates: [{ finishReason: "STOP" }] })).toEqual([]);
  });

  it("pedaço vazio não quebra", () => {
    expect(parseGeminiChunk({})).toEqual([]);
  });
});
