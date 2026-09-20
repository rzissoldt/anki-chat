import type { DictionaryEntry } from "@/lib/dictionary/cedict";

const NOISY_KEYS = new Set([
  "a",
  "an",
  "and",
  "das",
  "dem",
  "den",
  "der",
  "des",
  "die",
  "ein",
  "eine",
  "einem",
  "einen",
  "einer",
  "eines",
  "for",
  "in",
  "of",
  "on",
  "or",
  "oder",
  "the",
  "to",
  "und",
]);

const SUFFIXES = [
  "tem",
  "ten",
  "ter",
  "tes",
  "ern",
  "em",
  "en",
  "er",
  "es",
  "st",
  "te",
  "t",
  "e",
  "n",
  "s",
];

export function normalizeGlossKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[“”„"'`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Extract reverse-lookup keys from one dictionary gloss (DE or EN). */
export function reverseKeys(definition: string): string[] {
  const stripped = definition
    .replace(/\([^)]*\)/g, " ")
    .replace(/\b(?:etw|jdn|jdm|jds|sth|sb|sbd)\.?/gi, " ")
    .replace(/^(?:to|zu)\s+/i, "")
    .replace(/\s+/g, " ")
    .trim();

  const keys: string[] = [];
  for (const part of stripped.split(/[;,]/)) {
    const normalized = stripLeadingArticles(normalizeGlossKey(part));
    if (!normalized) continue;
    const words = normalized.split(" ");
    if (words.length === 0 || words.length > 4) continue;
    if (words.length === 1 && NOISY_KEYS.has(normalized)) continue;
    if (words.every((word) => NOISY_KEYS.has(word))) continue;
    keys.push(normalized);
  }
  return unique(keys);
}

const LEADING_ARTICLE = /^(?:der|die|das|dem|den|des|ein|eine|einer|eines|einem|einen|the|a|an)\s+/;

function stripLeadingArticles(normalized: string): string {
  const stripped = normalized.replace(LEADING_ARTICLE, "");
  return stripped || normalized;
}

/** Keys stored in the reverse index, including a light infinitive stem. */
export function indexKeys(definition: string): string[] {
  const keys = reverseKeys(definition);
  const extra: string[] = [];
  for (const key of keys) {
    if (key.includes(" ")) continue;
    if (key.endsWith("en") && key.length > 5) extra.push(key.slice(0, -2));
    else if (key.endsWith("n") && key.length > 4 && !key.endsWith("en"))
      extra.push(key.slice(0, -1));
  }
  return unique([...keys, ...extra]);
}

/** Surface variants to try when an exact L1 token misses. */
export function lookupVariants(word: string): string[] {
  const lower = normalizeGlossKey(word);
  if (!lower) return [];

  const variants = new Set<string>([lower]);

  for (const base of variants) {
    for (const suffix of SUFFIXES) {
      if (!base.endsWith(suffix)) continue;
      const stem = base.slice(0, -suffix.length);
      if (stem.length < 3) continue;
      variants.add(stem);
      variants.add(umlautToPlain(stem));
    }
  }

  variants.add(umlautToPlain(lower));
  return [...variants];
}

export type L1Token = {
  start: number;
  end: number;
  word: string;
};

export function tokenizeL1(text: string): L1Token[] {
  return [...text.matchAll(/\p{L}+/gu)].map((match) => {
    const word = match[0];
    const start = match.index ?? 0;
    return { start, end: start + word.length, word };
  });
}

export function annotateReverseText(
  text: string,
  lookup: (key: string) => DictionaryEntry[] | undefined,
): Array<{
  surface: string;
  start: number;
  end: number;
  pinyin: string;
  definitions: string[];
}> {
  const tokens = tokenizeL1(text);
  const annotations: Array<{
    surface: string;
    start: number;
    end: number;
    pinyin: string;
    definitions: string[];
  }> = [];
  let index = 0;

  while (index < tokens.length) {
    const maxN = Math.min(4, tokens.length - index);
    let matched = false;

    for (let n = maxN; n >= 1; n -= 1) {
      const start = tokens[index].start;
      const end = tokens[index + n - 1].end;
      const key = normalizeGlossKey(text.slice(start, end));
      let entries = lookup(key);

      if (!entries && n === 1) {
        for (const variant of lookupVariants(tokens[index].word)) {
          entries = lookup(variant);
          if (entries) break;
        }
      }

      if (!entries?.length) continue;

      const ranked = rankEntries(uniqueEntries(entries), key);
      annotations.push({
        surface: text.slice(start, end),
        start,
        end,
        pinyin: ranked[0].pinyin,
        definitions: unique(ranked.map((entry) => entry.simplified)),
      });
      index += n;
      matched = true;
      break;
    }

    if (!matched) index += 1;
  }

  return annotations;
}

function umlautToPlain(value: string): string {
  return value.replaceAll("ä", "a").replaceAll("ö", "o").replaceAll("ü", "u");
}

function rankEntries(entries: DictionaryEntry[], key: string): DictionaryEntry[] {
  return [...entries].sort((a, b) => {
    const aExact = reverseKeys(a.definitions[0] ?? "").includes(key) ? 0 : 1;
    const bExact = reverseKeys(b.definitions[0] ?? "").includes(key) ? 0 : 1;
    if (aExact !== bExact) return aExact - bExact;
    return a.simplified.length - b.simplified.length;
  });
}

function uniqueEntries(entries: DictionaryEntry[]): DictionaryEntry[] {
  const seen = new Set<string>();
  const out: DictionaryEntry[] = [];
  for (const entry of entries) {
    const id = `${entry.simplified}|${entry.pinyin}`;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(entry);
  }
  return out;
}

function unique(values: string[]) {
  return [...new Set(values)];
}
