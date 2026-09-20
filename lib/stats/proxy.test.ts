import { describe, expect, it } from "vitest";
import { buildStatsUpstreamUrl } from "@/lib/stats/proxy";

describe("buildStatsUpstreamUrl", () => {
  it("forwards allowlisted vocabulary query params", () => {
    const url = buildStatsUpstreamUrl(
      "http://127.0.0.1:8780",
      "vocabulary",
      new URLSearchParams({
        mode: "recognition",
        only_known: "true",
        sort: "normalized_score",
        order: "asc",
        limit: "100",
        script: "traditional",
        evil: "drop-me",
      }),
    );

    expect(url).toBe(
      "http://127.0.0.1:8780/api/stats/vocabulary?mode=recognition&only_known=true&sort=normalized_score&order=asc&limit=100&script=traditional",
    );
  });

  it("forwards allowlisted structure query params", () => {
    const url = buildStatsUpstreamUrl(
      "http://127.0.0.1:8780/",
      "structures",
      new URLSearchParams({
        mode: "all",
        max_hsk_level: "3",
        min_evaluations: "2",
        sort: "hsk_level",
        order: "desc",
        only_known: "true",
      }),
    );

    expect(url).toBe(
      "http://127.0.0.1:8780/api/stats/structures?mode=all&max_hsk_level=3&min_evaluations=2&sort=hsk_level&order=desc",
    );
  });
});
