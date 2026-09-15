// Best-effort category suggestion for AI-proposed transactions. Deliberately
// dumb (keyword matching) — it only ever produces a *suggestion* that is
// shown in the preview and can be overridden before confirming; it never
// picks a category "silently" (see AGENTS' instruction on this). If nothing
// matches, it falls back to an "Outros" bucket for the transaction's type
// and marks the suggestion as low-confidence so the caller can say so.
import type { Category, TransactionType } from "@/lib/finance/types";
import { capitalCategoryFor } from "@/lib/finance/categories";

const KEYWORD_RULES: { keywords: string[]; categoryId: string }[] = [
  { keywords: ["anuncio", "ads", "meta", "instagram ads", "google ads", "trafego", "impulsionamento"], categoryId: "marketing" },
  { keywords: ["frete", "correios", "envio", "transportadora"], categoryId: "frete" },
  { keywords: ["embalagem", "caixa", "sacola"], categoryId: "embalagem" },
  { keywords: ["etiqueta", "tag"], categoryId: "etiqueta" },
  { keywords: ["estampa", "silk", "sublimacao"], categoryId: "estampa" },
  { keywords: ["pod", "print on demand"], categoryId: "produto_pod" },
  { keywords: ["software", "assinatura", "saas", "app"], categoryId: "software" },
  { keywords: ["nuvemshop", "shopify", "plataforma"], categoryId: "plataforma" },
  { keywords: ["contador", "contabilidade", "imposto", "das"], categoryId: "contabilidade" },
  { keywords: ["taxa", "gateway", "maquininha"], categoryId: "taxas" },
  { keywords: ["venda", "pedido"], categoryId: "venda" },
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

export type CategorySuggestion = {
  categoryId: string;
  label: string;
  confident: boolean;
};

export function suggestCategory(description: string, type: TransactionType, categories: Category[]): CategorySuggestion {
  const capitalCategory = capitalCategoryFor(type);
  if (capitalCategory) {
    const category = categories.find((c) => c.id === capitalCategory);
    return { categoryId: capitalCategory, label: category?.label ?? capitalCategory, confident: true };
  }

  const normalizedDescription = normalize(description);
  for (const rule of KEYWORD_RULES) {
    if (rule.keywords.some((keyword) => normalizedDescription.includes(keyword))) {
      const category = categories.find((c) => c.id === rule.categoryId);
      if (category) return { categoryId: category.id, label: category.label, confident: true };
    }
  }

  const fallbackId = type === "income" ? "outros_recebimentos" : "outras_despesas";
  const fallback = categories.find((c) => c.id === fallbackId);
  return { categoryId: fallbackId, label: fallback?.label ?? fallbackId, confident: false };
}
