import { tokenize } from "jieba-wasm";
import { readFile } from "node:fs/promises";
import path from "node:path";
import type { GlossLanguage } from "@/lib/dictionary/language";

export type DictionaryEntry = {
  traditional: string;
  simplified: string;
  pinyin: string;
  definitions: string[];
};

export type DictionaryAnnotation = {
  surface: string;
  start: number;
  end: number;
  pinyin: string;
  definitions: string[];
};

type TrieNode = {
  children: Map<string, TrieNode>;
  entries?: DictionaryEntry[];
};

const CEDICT_LINE = /^(\S+)\s+(\S+)\s+\[([^\]]+)\]\s+\/(.+)\/$/;
const HAN_CHARACTER = /\p{Script=Han}/u;

const DICTIONARY_PATHS: Record<GlossLanguage, string> = {
  en: path.join(process.cwd(), "data", "cedict_ts.u8"),
  de: path.join(process.cwd(), "data", "handedict.u8"),
};

export function parseCedictLine(line: string): DictionaryEntry | null {
  const normalized = line.replace(/^\uFEFF/, "");
  if (!normalized || normalized.startsWith("#")) return null;

  const match = CEDICT_LINE.exec(normalized);
  if (!match) return null;

  const [, traditional, simplified, pinyin, definitionText] = match;
  const definitions = definitionText
    .split("/")
    .map((value) => cleanDefinition(value))
    .filter(Boolean);
  if (definitions.length === 0) return null;

  return { traditional, simplified, pinyin, definitions };
}

/** Drop example clauses and noisy trailing metadata for compact hover glosses. */
export function cleanDefinition(definition: string): string {
  return definition
    .split(/;\s*Bsp\.:/i)[0]
    .replace(/\s+/g, " ")
    .trim();
}

export class CedictDictionary {
  private readonly root: TrieNode = { children: new Map() };
  private readonly entriesByWord = new Map<string, DictionaryEntry[]>();

  constructor(entries: Iterable<DictionaryEntry>) {
    for (const entry of entries) {
      this.addWord(entry.simplified, entry);
      if (entry.traditional !== entry.simplified) this.addWord(entry.traditional, entry);
    }
  }

  lookup(word: string): DictionaryEntry[] {
    return this.entriesByWord.get(word) ?? [];
  }

  /**
   * Segments Chinese with jieba-wasm, then resolves each token against the dictionary.
   * Unknown jieba tokens fall back to dictionary longest-match.
   */
  annotate(text: string): DictionaryAnnotation[] {
    if (!text) return [];

    const annotations: DictionaryAnnotation[] = [];
    const tokens = tokenize(text, "default", true);

    for (const token of tokens) {
      if (![...token.word].some((character) => HAN_CHARACTER.test(character))) continue;

      const entries = this.lookup(token.word);
      if (entries.length > 0) {
        annotations.push(toAnnotation(token.word, token.start, token.end, entries));
        continue;
      }

      for (const local of this.annotateLongestMatch(token.word)) {
        annotations.push({
          ...local,
          start: token.start + local.start,
          end: token.start + local.end,
        });
      }
    }

    return annotations;
  }

  private annotateLongestMatch(text: string): DictionaryAnnotation[] {
    const annotations: DictionaryAnnotation[] = [];
    let cursor = 0;

    while (cursor < text.length) {
      const current = String.fromCodePoint(text.codePointAt(cursor)!);
      if (!HAN_CHARACTER.test(current)) {
        cursor += current.length;
        continue;
      }

      const match = this.longestMatch(text, cursor);
      if (!match) {
        cursor += current.length;
        continue;
      }

      annotations.push(
        toAnnotation(text.slice(cursor, match.end), cursor, match.end, match.entries),
      );
      cursor = match.end;
    }

    return annotations;
  }

  private addWord(word: string, entry: DictionaryEntry) {
    const existing = this.entriesByWord.get(word);
    if (existing) existing.push(entry);
    else this.entriesByWord.set(word, [entry]);

    let node = this.root;
    for (const character of word) {
      let child = node.children.get(character);
      if (!child) {
        child = { children: new Map() };
        node.children.set(character, child);
      }
      node = child;
    }

    if (node.entries) node.entries.push(entry);
    else node.entries = [entry];
  }

  private longestMatch(text: string, start: number) {
    let node = this.root;
    let cursor = start;
    let best: { end: number; entries: DictionaryEntry[] } | undefined;

    while (cursor < text.length) {
      const character = String.fromCodePoint(text.codePointAt(cursor)!);
      const child = node.children.get(character);
      if (!child) break;

      cursor += character.length;
      node = child;
      if (node.entries) best = { end: cursor, entries: node.entries };
    }

    return best;
  }
}

function toAnnotation(
  surface: string,
  start: number,
  end: number,
  entries: DictionaryEntry[],
): DictionaryAnnotation {
  return {
    surface,
    start,
    end,
    pinyin: entries[0].pinyin,
    definitions: unique(entries.flatMap((entry) => entry.definitions)),
  };
}

function unique(values: string[]) {
  return [...new Set(values)];
}

export function parseCedict(contents: string): CedictDictionary {
  const entries: DictionaryEntry[] = [];
  for (const line of contents.split(/\r?\n/)) {
    const entry = parseCedictLine(line);
    if (entry) entries.push(entry);
  }
  return new CedictDictionary(entries);
}

const dictionaryPromises = new Map<GlossLanguage, Promise<CedictDictionary>>();

export function getDictionary(lang: GlossLanguage = "en"): Promise<CedictDictionary> {
  const existing = dictionaryPromises.get(lang);
  if (existing) return existing;

  const promise = readFile(DICTIONARY_PATHS[lang], "utf8").then(parseCedict);
  dictionaryPromises.set(lang, promise);
  return promise;
}
