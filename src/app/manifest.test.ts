import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import path from "node:path";
import manifest from "./manifest";
import { config } from "../proxy";

describe("manifest (app instalável)", () => {
  const m = manifest();

  it("abre como app independente, na raiz", () => {
    expect(m.display).toBe("standalone");
    expect(m.start_url).toBe("/");
    expect(m.name).toBeTruthy();
    expect(m.short_name).toBeTruthy();
  });

  it("declara os ícones mínimos para ser instalável (192, 512 e maskable)", () => {
    const icons = m.icons ?? [];
    expect(icons.some((i) => i.sizes === "192x192" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
    expect(icons.some((i) => i.sizes === "512x512" && i.purpose === "maskable")).toBe(true);
  });

  it("todos os ícones declarados existem em public/", () => {
    for (const icon of m.icons ?? []) {
      const file = path.join(process.cwd(), "public", icon.src);
      expect(existsSync(file), `${icon.src} não existe em public/`).toBe(true);
    }
  });
});

describe("proxy.config.matcher (login obrigatório)", () => {
  // Next compila o matcher como path-to-regexp; para o padrão usado aqui
  // (um único grupo com lookahead negativo) um RegExp equivalente basta.
  const matcher = new RegExp(`^${config.matcher[0]}$`);

  it("deixa o manifesto passar SEM exigir login (o navegador busca sem cookie)", () => {
    expect(matcher.test("/manifest.webmanifest")).toBe(false);
  });

  it("deixa os ícones e o favicon passarem sem login", () => {
    expect(matcher.test("/icons/icon-192.png")).toBe(false);
    expect(matcher.test("/apple-icon.png")).toBe(false);
    expect(matcher.test("/favicon.ico")).toBe(false);
  });

  it("passa pelas rotas /api (para renovar a sessão); /api/mcp é tratada dentro do proxy", () => {
    expect(matcher.test("/api/marketing")).toBe(true);
    expect(matcher.test("/api/mcp")).toBe(true);
  });

  it("continua protegendo as páginas do app", () => {
    for (const route of ["/", "/financeiro", "/vendas", "/configuracoes", "/login"]) {
      expect(matcher.test(route), route).toBe(true);
    }
  });
});
