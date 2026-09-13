import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";

export type SentenceSpan = {
  surface: string;
  start: number;
  end: number;
};

export type SentenceAnnotation = SentenceSpan & {
  words: DictionaryAnnotation[];
};

/**
 * One Chinese sentence: starts on Han, may include commas/digits/quotes,
 * and must end on a real terminator. Latin prose is not absorbed across `.`.
 */
const CHINESE_SENTENCE =
  /[\p{Script=Han}][\p{Script=Han}0-9\s，、：；“”‘’「」『』（）()《》〈〉…—\-·%％]*[。！？!?]/gu;
const SENTENCE_END = /[。！？!?]$/;
const HAN_CHAR = /\p{Script=Han}/gu;

/**
 * Extracts terminated Chinese sentence spans from mixed assistant text.
 * Keeps commas/clauses (，) inside one sentence until 。！？ / !?
 */
export function extractChineseSentences(text: string): SentenceSpan[] {
  const sentences: SentenceSpan[] = [];

  for (const match of text.matchAll(CHINESE_SENTENCE)) {
    const surface = match[0]?.trimEnd();
    if (!surface) continue;
    const start = match.index ?? 0;
    sentences.push({
      surface,
      start,
      end: start + surface.length,
    });
  }

  return sentences;
}

/** True for terminated Chinese sentences, not bare vocabulary fragments. */
export function isSpeakableChineseSentence(surface: string): boolean {
  if (!SENTENCE_END.test(surface)) return false;
  const hanChars = surface.match(HAN_CHAR) ?? [];
  return hanChars.length >= 2;
}

export function extractSpeakableChineseSentences(text: string): SentenceSpan[] {
  return extractChineseSentences(text).filter((sentence) =>
    isSpeakableChineseSentence(sentence.surface),
  );
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
