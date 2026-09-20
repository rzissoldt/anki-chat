import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerConfig } = vi.hoisted(() => ({
  getServerConfig: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getServerConfig }));

import { GET } from "./route";

describe("GET /api/stats/structures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 503 when stats API is not configured", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: false },
    });

    const response = await GET(new Request("http://localhost/api/stats/structures"));
    expect(response.status).toBe(503);
  });

  it("proxies structure stats from the upstream API", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: true, url: "http://127.0.0.1:8780" },
    });

    const upstreamBody = {
      structures: [
        {
          grammar_point_id: 1,
          pattern: "是……的",
          hsk_level: 2,
          category: "emphasis",
          evaluation_count: 1,
          total_points: 1,
          normalized_score: 0.5,
        },
      ],
    };

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(upstreamBody)),
    );

    const response = await GET(
      new Request("http://localhost/api/stats/structures?max_hsk_level=3&sort=normalized_score"),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstreamBody);
    expect(fetch).toHaveBeenCalledWith(
      "http://127.0.0.1:8780/api/stats/structures?max_hsk_level=3&sort=normalized_score",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
