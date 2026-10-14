import { describe, expect, it } from "vitest";
import { deriveLowStockNotifications } from "./business";
import type { VariantStock } from "@/lib/stock/calculations";

const TODAY = "2026-10-13";
const names: Record<string, string> = { p1: "Camiseta NREM", p2: "Moletom Komodo" };
const getName = (id: string) => names[id];

function stock(overrides: Partial<VariantStock> & { variant: VariantStock["variant"] }): VariantStock {
  return { level: 10, status: "ok", undeclared: false, ...overrides };
}

describe("deriveLowStockNotifications", () => {
  it("variações em estoque normal não geram aviso", () => {
    expect(deriveLowStockNotifications([stock({ variant: { productId: "p1", size: "M" } })], getName, TODAY)).toEqual([]);
  });

  it("estoque baixo: um aviso do produto, com o saldo da variação", () => {
    const result = deriveLowStockNotifications(
      [stock({ variant: { productId: "p1", size: "M", color: "Preto" }, level: 2, status: "baixo" })],
      getName,
      TODAY
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: "low-stock-p1", title: "Estoque baixo", href: "/estoque", read: false });
    expect(result[0].description).toBe("Camiseta NREM: M · Preto (2 un.).");
  });

  it("qualquer variação esgotada muda o título para 'Estoque esgotado'", () => {
    const result = deriveLowStockNotifications(
      [
        stock({ variant: { productId: "p1", size: "P" }, level: 2, status: "baixo" }),
        stock({ variant: { productId: "p1", size: "M" }, level: 0, status: "esgotado" }),
      ],
      getName,
      TODAY
    );
    expect(result[0].title).toBe("Estoque esgotado");
    expect(result[0].description).toContain("M esgotado");
  });

  it("um aviso por produto, nunca um por tamanho/cor", () => {
    const result = deriveLowStockNotifications(
      [
        stock({ variant: { productId: "p1", size: "P" }, level: 0, status: "esgotado" }),
        stock({ variant: { productId: "p1", size: "M" }, level: 1, status: "baixo" }),
        stock({ variant: { productId: "p2" }, level: 0, status: "esgotado" }),
      ],
      getName,
      TODAY
    );
    expect(result.map((n) => n.id).sort()).toEqual(["low-stock-p1", "low-stock-p2"]);
  });

  it("mais de 3 variações: lista 3 e resume o resto", () => {
    const sizes = ["PP", "P", "M", "G", "GG"];
    const result = deriveLowStockNotifications(
      sizes.map((size) => stock({ variant: { productId: "p1", size }, level: 0, status: "esgotado" })),
      getName,
      TODAY
    );
    expect(result[0].description).toBe("Camiseta NREM: PP esgotado, P esgotado, M esgotado e mais 2.");
  });

  it("produto que não existe mais no catálogo não gera aviso", () => {
    const result = deriveLowStockNotifications([stock({ variant: { productId: "removido" }, level: 0, status: "esgotado" })], getName, TODAY);
    expect(result).toEqual([]);
  });
});
