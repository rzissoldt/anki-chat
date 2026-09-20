import { describe, expect, it } from "vitest";
import {
  formatStatsErrorMessage,
  statsNotConfiguredMessage,
  statsUnreachableMessage,
} from "@/lib/stats/errors";

describe("stats error messages", () => {
  it("includes setup hint when not configured", () => {
    expect(statsNotConfiguredMessage()).toContain("STATS_API_URL");
    expect(statsNotConfiguredMessage()).toContain("sprachapp-api");
  });

  it("includes upstream URL when unreachable", () => {
    expect(statsUnreachableMessage("http://127.0.0.1:8780")).toContain("127.0.0.1:8780");
  });

  it("formats structured error payloads", () => {
    expect(formatStatsErrorMessage({ code: "not_configured", error: "ignored" })).toContain(
      "STATS_API_URL",
    );
    expect(formatStatsErrorMessage({ error: "Custom failure" })).toBe("Custom failure");
  });
});
