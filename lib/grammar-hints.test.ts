import { describe, expect, it } from "vitest";
import { preprocessGrammarHints, revealGrammarHints, stripGrammarHints } from "@/lib/grammar-hints";

describe("stripGrammarHints", () => {
  it("removes tagged hints and the leading dash", () => {
    expect(
      stripGrammarHints(
        "**如果明天下雨，我就不去公园。** — <grammar-hint>Bedingung mit 如果 … 就</grammar-hint>",
      ),
    ).toBe("**如果明天下雨，我就不去公园。**");
  });

  it("handles incomplete tags while streaming", () => {
    expect(stripGrammarHints("Satz. — <grammar-hint>Vergangenheit mit 了")).toBe("Satz.");
  });
});

describe("revealGrammarHints", () => {
  it("converts tags to italic markdown after an em dash", () => {
    expect(
      revealGrammarHints(
        "Ich habe Tee getrunken. — <grammar-hint>Vergangenheit mit 了</grammar-hint>",
      ),
    ).toBe("Ich habe Tee getrunken. — *Vergangenheit mit 了*");
  });

  it("escapes markdown emphasis markers in the hint", () => {
    expect(revealGrammarHints("<grammar-hint>A * B_C</grammar-hint>")).toBe(" — *A \\* B\\_C*");
  });
});

describe("preprocessGrammarHints", () => {
  it("strips when tips are hidden and reveals when shown", () => {
    const raw = "1. **他比弟弟高。** — <grammar-hint>Vergleich mit 比</grammar-hint>\n\nÜbersetze.";
    expect(preprocessGrammarHints(raw, false)).toBe("1. **他比弟弟高。**\n\nÜbersetze.");
    expect(preprocessGrammarHints(raw, true)).toBe(
      "1. **他比弟弟高。** — *Vergleich mit 比*\n\nÜbersetze.",
    );
  });
});
