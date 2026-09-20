import { generateObject } from "ai";
import { z } from "zod";
import { createVllmModel } from "@/lib/ai/vllm";
import { getServerConfig } from "@/lib/config";
import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";
import type { GlossLanguage } from "@/lib/dictionary/language";
import type { TextSpan } from "@/lib/dictionary/practice-spans";
import { surfaceMatchesAt } from "@/lib/dictionary/text";

export const contextualGlossSchema = z.object({
  sentences: z.array(
    z.object({
      text: z.string().describe("Exact practice sentence text"),
      glosses: z.array(
        z.object({
          surface: z.string().describe("Contiguous substring copied verbatim from the sentence"),
          zh: z.string().describe("Chinese equivalent for this surface in context"),
          pinyin: z.string().describe("Tone-mark pinyin for the Chinese equivalent"),
        }),
      ),
    }),
  ),
});

export type ContextualGlossResult = z.infer<typeof contextualGlossSchema>;

const SYSTEM_PROMPT = `You annotate L1 practice sentences for Chinese learners.
For each sentence, return useful learning chunks (words or short phrases) with their
Chinese meaning in THIS sentence context.

Rules:
- Copy every surface verbatim as a contiguous substring of the sentence (no ellipsis, no reordering).
- Prefer meaningful chunks (verbs, nouns, useful phrases). Skip bare articles and copulas unless they carry meaning.
- Give one Chinese equivalent as used in this sentence; pinyin with tone marks.
- Do not invent surfaces that are not in the sentence.
- Keep glosses non-overlapping when possible; prefer longer meaningful phrases.

Return JSON matching this shape exactly:
{
  "sentences": [
    {
      "text": "Ich habe Tee getrunken.",
      "glosses": [
        { "surface": "Tee", "zh": "茶", "pinyin": "chá" },
        { "surface": "getrunken", "zh": "喝了", "pinyin": "hē le" }
      ]
    }
  ]
}`;

/** First word-boundary (Latin) / prefix (Han) match of surface inside text. */
export function findSurfaceOffset(text: string, surface: string): number | null {
  if (!surface || !text) return null;
  let cursor = 0;
  while (cursor < text.length) {
    if (surfaceMatchesAt(text, surface, cursor)) return cursor;
    cursor += String.fromCodePoint(text.codePointAt(cursor)!).length;
  }
  return null;
}

/**
 * Map LLM glosses onto absolute offsets in the full assistant message.
 * Skips surfaces that do not appear in the matching practice span.
 */
export function alignContextualGlosses(
  text: string,
  spans: TextSpan[],
  result: ContextualGlossResult,
): DictionaryAnnotation[] {
  const annotations: DictionaryAnnotation[] = [];
  const used = new Set<string>();

  for (const sentence of result.sentences) {
    const span =
      spans.find((item) => text.slice(item.start, item.end) === sentence.text) ??
      spans.find((item) => text.slice(item.start, item.end).includes(sentence.text));
    if (!span) continue;

    const localText = text.slice(span.start, span.end);
    const searchIn = localText.includes(sentence.text) ? sentence.text : localText;
    const baseOffset =
      searchIn === localText ? span.start : span.start + localText.indexOf(sentence.text);

    for (const gloss of sentence.glosses) {
      const surface = gloss.surface.trim();
      const zh = gloss.zh.trim();
      const pinyin = gloss.pinyin.trim();
      if (!surface || !zh) continue;

      const localOffset = findSurfaceOffset(searchIn, surface);
      if (localOffset == null) continue;

      const start = baseOffset + localOffset;
      const end = start + surface.length;
      const key = `${start}:${end}`;
      if (used.has(key)) continue;
      used.add(key);

      annotations.push({
        surface: text.slice(start, end),
        start,
        end,
        pinyin,
        definitions: [zh],
      });
    }
  }

  return annotations;
}

function buildUserPrompt(sentences: string[], lang: GlossLanguage): string {
  const label = lang === "de" ? "German" : "English";
  const numbered = sentences.map((sentence, index) => `${index + 1}. ${sentence}`).join("\n");
  return `Annotate these ${label} practice sentences for Chinese translation practice.\nRespond with JSON only, using keys sentences / text / glosses / surface / zh / pinyin.\n\n${numbered}`;
}

/**
 * Call vLLM (thinking off) to produce contextual L1→ZH glosses for practice spans.
 * Returns [] when there are no spans or the model call fails.
 */
export async function annotateContextualGlosses(
  text: string,
  spans: TextSpan[],
  lang: GlossLanguage,
  signal?: AbortSignal,
): Promise<DictionaryAnnotation[]> {
  if (spans.length === 0) return [];

  const sentences = spans.map((span) => text.slice(span.start, span.end)).filter(Boolean);
  if (sentences.length === 0) return [];

  try {
    const config = getServerConfig();
    if (!config.chat.baseUrl || !config.chat.model) return [];

    const model = createVllmModel(config, {
      enableThinking: false,
      supportsStructuredOutputs: true,
    });
    const { object } = await generateObject({
      model,
      schema: contextualGlossSchema,
      schemaName: "contextual_glosses",
      schemaDescription: "Contextual Chinese glosses for L1 practice sentences",
      system: SYSTEM_PROMPT,
      prompt: buildUserPrompt(sentences, lang),
      abortSignal: signal,
      temperature: 0,
    });

    return alignContextualGlosses(text, spans, object);
  } catch (error) {
    console.error("Contextual gloss generation failed:", error);
    return [];
  }
}
