import { describe, expect, it } from "vitest";
import { suggestCategory } from "./category-suggestion";
import { DEFAULT_CATEGORIES } from "@/lib/finance/categories";

describe("suggestCategory", () => {
  it("reconhece uma despesa de marketing por palavra-chave", () => {
    const result = suggestCategory("Anúncio da Meta", "expense", DEFAULT_CATEGORIES);
    expect(result.categoryId).toBe("marketing");
    expect(result.confident).toBe(true);
  });

  it("nunca inventa categoria silenciosamente: sem palavra-chave, cai no fallback e marca baixa confiança", () => {
    const result = suggestCategory("Coisa aleatória sem contexto", "expense", DEFAULT_CATEGORIES);
    expect(result.confident).toBe(false);
  });

  it("aporte/retirada sempre resolvem para a categoria de capital, com alta confiança", () => {
    const result = suggestCategory("qualquer coisa", "owner_contribution", DEFAULT_CATEGORIES);
    expect(result.categoryId).toBe("aporte");
    expect(result.confident).toBe(true);
  });
});
