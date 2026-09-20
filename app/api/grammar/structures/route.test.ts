import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerConfig } = vi.hoisted(() => ({
  getServerConfig: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getServerConfig }));

import { GET } from "./route";

describe("GET /api/grammar/structures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 503 when stats API is not configured", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: false },
    });

    const response = await GET(new Request("http://localhost/api/grammar/structures"));
    expect(response.status).toBe(503);
  });

  it("proxies the grammar catalog from the upstream API", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: true, url: "http://127.0.0.1:8780" },
    });

    const upstreamBody = {
      structures: [{ id: 1, hsk_level: 1, band_label: "1", pattern: "是", category: "句子的类型" }],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(upstreamBody)),
    );

    const response = await GET(
      new Request("http://localhost/api/grammar/structures?max_hsk_level=2"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstreamBody);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8780/api/grammar/structures?max_hsk_level=2",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
