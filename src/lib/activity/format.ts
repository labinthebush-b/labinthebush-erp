export type ActivityAction = "created" | "updated" | "deleted";

const ACTION_LABELS: Record<ActivityAction, string> = {
  created: "adicionou",
  updated: "editou",
  deleted: "apagou",
};

const ENTITY_LABELS: Record<string, string> = {
  products: "o produto",
  contacts: "o contato",
  transactions: "o lançamento",
  sales: "a venda",
  tasks: "a tarefa",
  campaigns: "a campanha",
  stock_movements: "a movimentação de estoque",
};

/** "adicionou a venda 2026-11-04" — the part of the sentence after the actor's name. */
export function describeActivity(action: ActivityAction, entity: string, summary: string | null): string {
  const what = ENTITY_LABELS[entity] ?? "o registro";
  return [ACTION_LABELS[action], what, summary].filter(Boolean).join(" ");
}

/** Up to two letters for the avatar when there's no photo: "Ana Lima" → "AL", "ana@x.com" → "A". */
export function actorInitials(name: string): string {
  const words = name.split("@")[0].trim().split(/\s+/).filter(Boolean);
  return words.slice(0, 2).map((word) => word[0].toUpperCase()).join("") || "?";
}

/** "pela IA (Claude)" when the change came through /api/mcp with a key named "Claude"; null otherwise. */
export function viaLabel(via: string | null): string | null {
  if (!via) return null;
  return via.trim().toLowerCase() === "ia" ? "pela IA" : `pela IA (${via.trim()})`;
}
