import { beforeEach, describe, expect, it, vi } from "vitest";

const { getServerConfig } = vi.hoisted(() => ({
  getServerConfig: vi.fn(),
}));

vi.mock("@/lib/config", () => ({ getServerConfig }));

import { GET } from "./route";

describe("GET /api/stats/vocabulary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns 503 when stats API is not configured", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: false, url: undefined },
    });

    const response = await GET(new Request("http://localhost/api/stats/vocabulary"));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(body.code).toBe("not_configured");
    expect(body.error).toContain("STATS_API_URL");
  });

  it("proxies allowlisted query params to the upstream stats API", async () => {
    getServerConfig.mockReturnValue({
      stats: { enabled: true, url: "http://127.0.0.1:8780" },
    });

    const upstreamBody = {
      words: [
        {
          word_id: 1,
          word: "你好",
          pinyin: "ni3 hao3",
          known: true,
          evaluation_count: 1,
          total_points: 2,
          normalized_score: 1,
        },
      ],
    };

    const fetchMock = vi.fn(async () =>
      Response.json(upstreamBody, {
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await GET(
      new Request(
        "http://localhost/api/stats/vocabulary?mode=all&only_known=true&limit=50&evil=no",
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual(upstreamBody);
    expect(fetchMock).toHaveBeenCalledWith(
      "http://127.0.0.1:8780/api/stats/vocabulary?mode=all&only_known=true&limit=50",
      expect.objectContaining({ method: "GET" }),
    );
  });
});
