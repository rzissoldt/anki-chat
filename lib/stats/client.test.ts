import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchStructureStats,
  fetchVocabularyStats,
  structureStatsUrl,
  vocabularyStatsUrl,
} from "@/lib/stats/client";

describe("stats client URL builders", () => {
  it("builds vocabulary URLs with optional params", () => {
    expect(vocabularyStatsUrl()).toBe("/api/stats/vocabulary");
    expect(
      vocabularyStatsUrl({
        mode: "production",
        only_known: true,
        sort: "normalized_score",
        order: "asc",
        limit: 1000,
        script: "simplified",
      }),
    ).toBe(
      "/api/stats/vocabulary?mode=production&only_known=true&sort=normalized_score&order=asc&limit=1000&script=simplified",
    );
  });

  it("builds structure URLs with optional params", () => {
    expect(
      structureStatsUrl({
        mode: "all",
        max_hsk_level: 4,
        sort: "evaluation_count",
        order: "desc",
      }),
    ).toBe("/api/stats/structures?mode=all&max_hsk_level=4&sort=evaluation_count&order=desc");
  });
});

describe("stats client fetch helpers", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("parses vocabulary responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          words: [
            {
              word_id: 1,
              word: "你好",
              pinyin: "ni3 hao3",
              known: true,
              evaluation_count: 2,
              total_points: 3,
              normalized_score: 0.75,
            },
          ],
        }),
      ),
    );

    const result = await fetchVocabularyStats({ limit: 10 });
    expect(result.words).toHaveLength(1);
    expect(result.words[0]?.word).toBe("你好");
    expect(fetch).toHaveBeenCalledWith(
      "/api/stats/vocabulary?limit=10",
      expect.objectContaining({ method: "GET" }),
    );
  });

  it("parses structure responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          structures: [
            {
              grammar_point_id: 9,
              pattern: "是……的",
              hsk_level: 2,
              category: "emphasis",
              evaluation_count: 1,
              total_points: 2,
              normalized_score: 1,
            },
          ],
        }),
      ),
    );

    const result = await fetchStructureStats({ mode: "recognition" });
    expect(result.structures[0]?.pattern).toBe("是……的");
  });

  it("surfaces API error messages", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ error: "Stats API is not configured." }, { status: 503 })),
    );

    await expect(fetchVocabularyStats()).rejects.toThrow("Stats API is not configured.");
  });
});
