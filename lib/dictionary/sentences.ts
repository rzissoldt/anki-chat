import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";

export type SentenceSpan = {
  surface: string;
  start: number;
  end: number;
};

export type SentenceAnnotation = SentenceSpan & {
  words: DictionaryAnnotation[];
};

const HAN_RUN = /[\p{Script=Han}]+(?:[^\S\r\n]*[\p{Script=Han}]+)*(?:[^\S\r\n]*[。！？!?；;])?/gu;

/**
 * Extracts Chinese sentence/clause spans from mixed assistant text.
 * Skips pure Latin/pinyin lines and keeps punctuation attached when present.
 */
export function extractChineseSentences(text: string): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];

  for (const match of text.matchAll(HAN_RUN)) {
    const surface = match[0]?.trim();
    if (!surface) continue;
    const start = match.index ?? 0;
    const trimmedStart = start + (match[0].length - match[0].trimStart().length);
    sentences.push({
      surface,
      start: trimmedStart,
      end: trimmedStart + surface.length,
    });
  }

  return sentences;
}

export function annotateSentences(
  text: string,
  words: DictionaryAnnotation[],
): SentenceAnnotation[] {
  return extractChineseSentences(text).map((sentence) => ({
    ...sentence,
    words: words.filter((word) => word.start >= sentence.start && word.end <= sentence.end),
  }));
}

export function findEnclosingSentence(
  sentences: SentenceAnnotation[],
  wordStart: number,
  wordEnd: number,
): SentenceAnnotation | undefined {
  return sentences.find((sentence) => sentence.start <= wordStart && sentence.end >= wordEnd);
}
