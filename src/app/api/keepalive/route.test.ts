import { beforeEach, describe, expect, it, vi } from "vitest";

const limit = vi.fn();
const select = vi.fn(() => ({ limit }));
const from = vi.fn(() => ({ select }));
vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn(() => ({ from })) }));

import { GET } from "./route";

describe("GET /api/keepalive", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemplo.supabase.co");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon");
  });

  it("consulta o banco e responde ok sem devolver dados", async () => {
    limit.mockResolvedValue({ data: [{ id: "segredo" }], error: null });
    const response = await GET();
    expect(from).toHaveBeenCalledWith("products");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("responde 503 quando o banco devolve erro", async () => {
    limit.mockResolvedValue({ data: null, error: { message: "paused" } });
    const response = await GET();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false });
  });

  it("responde 503 quando a conexão falha", async () => {
    limit.mockRejectedValue(new Error("fetch failed"));
    expect((await GET()).status).toBe(503);
  });
});
