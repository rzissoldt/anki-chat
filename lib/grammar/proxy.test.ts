import { describe, expect, it } from "vitest";
import { buildGrammarStructuresUpstreamUrl } from "@/lib/grammar/proxy";

describe("buildGrammarStructuresUpstreamUrl", () => {
  it("forwards allowlisted max_hsk_level and drops other params", () => {
    const url = buildGrammarStructuresUpstreamUrl(
      "http://127.0.0.1:8780/",
      new URLSearchParams({ max_hsk_level: "3", evil: "drop-me" }),
    );
    expect(url).toBe("http://127.0.0.1:8780/api/grammar/structures?max_hsk_level=3");
  });
});
