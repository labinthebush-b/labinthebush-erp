import { describe, expect, it, vi } from "vitest";
import { createDataLoadStore } from "./data-load-store";

describe("createDataLoadStore", () => {
  it("começa não-pronto, mesmo sem nenhum provedor registrado", () => {
    const store = createDataLoadStore();
    expect(store.isReady()).toBe(false);
  });

  it("só fica pronto quando TODOS os provedores terminaram de carregar", () => {
    const store = createDataLoadStore();
    store.report("finance", true);
    store.report("sales", true);
    store.report("tasks", true);

    store.report("finance", false);
    store.report("sales", false);
    expect(store.isReady()).toBe(false);

    store.report("tasks", false);
    expect(store.isReady()).toBe(true);
  });

  it("avisa quem assinou exatamente uma vez, quando fica pronto", () => {
    const store = createDataLoadStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.report("a", true);
    store.report("b", true);
    store.report("a", false);
    expect(listener).not.toHaveBeenCalled();

    store.report("b", false);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("depois de pronto, nunca volta atrás (provedor que monta depois não reabre o skeleton)", () => {
    const store = createDataLoadStore();
    store.report("finance", true);
    store.report("finance", false);
    expect(store.isReady()).toBe(true);

    // ex.: CanvasProvider monta só dentro da página do Canvas
    store.report("canvas", true);
    expect(store.isReady()).toBe(true);
    store.report("canvas", false);
    expect(store.isReady()).toBe(true);
  });

  it("unregister (Strict Mode / desmontagem) não conta como 'terminou de carregar'", () => {
    const store = createDataLoadStore();
    store.report("a", true);
    store.report("b", true);

    // React Strict Mode em dev: desmonta e remonta todos os efeitos uma vez.
    store.unregister("a");
    store.unregister("b");
    expect(store.isReady()).toBe(false);

    store.report("a", true);
    store.report("b", true);
    store.report("a", false);
    expect(store.isReady()).toBe(false);
    store.report("b", false);
    expect(store.isReady()).toBe(true);
  });

  it("um provedor que desmonta enquanto carregava não trava os demais", () => {
    const store = createDataLoadStore();
    store.report("a", true);
    store.report("b", true);
    store.unregister("a");
    store.report("b", false);
    expect(store.isReady()).toBe(true);
  });

  it("cancelar a assinatura impede notificações futuras", () => {
    const store = createDataLoadStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.report("a", true);
    store.report("a", false);
    expect(store.isReady()).toBe(true);
    expect(listener).not.toHaveBeenCalled();
  });
});
