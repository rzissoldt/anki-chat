import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchGrammarStructures, grammarStructuresUrl } from "@/lib/grammar/client";

describe("grammar client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("builds catalog URLs", () => {
    expect(grammarStructuresUrl()).toBe("/api/grammar/structures");
    expect(grammarStructuresUrl({ max_hsk_level: 4 })).toBe(
      "/api/grammar/structures?max_hsk_level=4",
    );
  });

  it("parses catalog responses", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          structures: [
            {
              id: 42,
              hsk_level: 1,
              band_label: "1",
              pattern: "是字句",
              category: "句子的类型",
              subcategory: "特殊句型",
              detail: "是",
            },
          ],
        }),
      ),
    );

    const result = await fetchGrammarStructures();
    expect(result.structures[0]?.id).toBe(42);
  });
});
