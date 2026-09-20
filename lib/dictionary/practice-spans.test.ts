import { describe, expect, it } from "vitest";
import { extractL1PracticeSpans } from "@/lib/dictionary/practice-spans";

describe("extractL1PracticeSpans", () => {
  it("takes the German sentence before an inline grammar hint", () => {
    const text =
      "1. Ich habe Tee getrunken. — <grammar-hint>Vergangenheit mit 了</grammar-hint>\n\nÜbersetze alle Sätze ins Chinesische.";

    expect(extractL1PracticeSpans(text)).toEqual([{ start: 3, end: 26 }]);
    expect(text.slice(3, 26)).toBe("Ich habe Tee getrunken.");
  });

  it("uses the previous line when the hint stands alone", () => {
    const text = "Komm her.\n<grammar-hint>Imperativ mit 吧</grammar-hint>";
    expect(extractL1PracticeSpans(text)).toEqual([{ start: 0, end: 9 }]);
    expect(text.slice(0, 9)).toBe("Komm her.");
  });

  it("skips Chinese recognition prompts", () => {
    const text = "1. **我喝茶。** — <grammar-hint>einfacher Aussagesatz</grammar-hint>";
    expect(extractL1PracticeSpans(text)).toEqual([]);
  });

  it("ignores the translate instruction footer", () => {
    const text =
      "Geh nach Hause. — <grammar-hint>Imperativ mit 吧</grammar-hint>\n\nÜbersetze den Satz ins Chinesische.";
    const spans = extractL1PracticeSpans(text);
    expect(spans).toHaveLength(1);
    expect(text.slice(spans[0].start, spans[0].end)).toBe("Geh nach Hause.");
  });
});
