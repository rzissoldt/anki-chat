import { describe, expect, it } from "vitest";
import { alignContextualGlosses, findSurfaceOffset } from "@/lib/dictionary/contextual-gloss";

describe("findSurfaceOffset", () => {
  it("finds Latin surfaces at word boundaries", () => {
    expect(findSurfaceOffset("Ich habe Tee getrunken.", "Tee")).toBe(9);
    expect(findSurfaceOffset("Teenager", "Tee")).toBeNull();
  });

  it("finds multi-word phrases", () => {
    expect(findSurfaceOffset("Geh nach Hause.", "nach Hause")).toBe(4);
  });
});

describe("alignContextualGlosses", () => {
  it("maps glosses onto absolute offsets in the full message", () => {
    const text =
      "1. Ich habe Tee getrunken. — <grammar-hint>Vergangenheit mit 了</grammar-hint>\n\nÜbersetze.";
    const spans = [{ start: 3, end: 26 }];
    expect(text.slice(3, 26)).toBe("Ich habe Tee getrunken.");

    const annotations = alignContextualGlosses(text, spans, {
      sentences: [
        {
          text: "Ich habe Tee getrunken.",
          glosses: [
            { surface: "Tee", zh: "茶", pinyin: "chá" },
            { surface: "getrunken", zh: "喝了", pinyin: "hē le" },
            { surface: "missing", zh: "无", pinyin: "wú" },
          ],
        },
      ],
    });

    expect(annotations).toEqual([
      {
        surface: "Tee",
        start: 12,
        end: 15,
        pinyin: "chá",
        definitions: ["茶"],
      },
      {
        surface: "getrunken",
        start: 16,
        end: 25,
        pinyin: "hē le",
        definitions: ["喝了"],
      },
    ]);
  });

  it("skips sentences that do not match any practice span", () => {
    const annotations = alignContextualGlosses("Hallo.", [{ start: 0, end: 6 }], {
      sentences: [
        {
          text: "Other sentence.",
          glosses: [{ surface: "Other", zh: "其他", pinyin: "qítā" }],
        },
      ],
    });
    expect(annotations).toEqual([]);
  });

  it("dedupes identical spans", () => {
    const text = "Tee bitte.";
    const annotations = alignContextualGlosses(text, [{ start: 0, end: 10 }], {
      sentences: [
        {
          text: "Tee bitte.",
          glosses: [
            { surface: "Tee", zh: "茶", pinyin: "chá" },
            { surface: "Tee", zh: "茗", pinyin: "míng" },
          ],
        },
      ],
    });
    expect(annotations).toHaveLength(1);
    expect(annotations[0].definitions).toEqual(["茶"]);
  });
});
