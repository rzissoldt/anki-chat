import { isChineseDominantLine } from "@/lib/dictionary/pinyin";

/** Keep in sync with the tag matcher in `lib/grammar-hints.ts`. */
const GRAMMAR_HINT_TAG = /\s*(?:—|--|-)?\s*<grammar-hint>[\s\S]*?(?:<\/grammar-hint>|$)/g;

export type TextSpan = {
  start: number;
  end: number;
};

/**
 * Prompt text in production practice lines: the German/English sentence before
 * a `<grammar-hint>` tag (or the previous line when the tag stands alone).
 * Recognition lines (Chinese-dominant) are skipped.
 */
export function extractL1PracticeSpans(text: string): TextSpan[] {
  const spans: TextSpan[] = [];

  for (const match of text.matchAll(new RegExp(GRAMMAR_HINT_TAG.source, GRAMMAR_HINT_TAG.flags))) {
    const tagStart = match.index ?? 0;
    const lineStart = text.lastIndexOf("\n", tagStart - 1) + 1;
    const beforeOnLine = text.slice(lineStart, tagStart);

    let rawStart: number;
    let rawEnd: number;
    if (beforeOnLine.trim() === "" || /^[\s—–-]+$/.test(beforeOnLine)) {
      if (lineStart === 0) continue;
      rawEnd = lineStart - 1;
      rawStart = text.lastIndexOf("\n", rawEnd - 1) + 1;
    } else {
      rawStart = lineStart;
      rawEnd = tagStart;
    }

    const raw = text.slice(rawStart, rawEnd);
    const prefix = raw.match(/^\s*(?:\d+\.\s+)?/)?.[0] ?? "";
    const start = rawStart + prefix.length;
    const end = rawStart + raw.trimEnd().length;
    if (end <= start) continue;

    const prompt = text.slice(start, end);
    if (!prompt.trim() || isChineseDominantLine(prompt)) continue;

    spans.push({ start, end });
  }

  return spans;
}
