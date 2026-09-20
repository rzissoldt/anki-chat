import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";

const HAN_CHAR = /\p{Script=Han}/gu;
const LATIN_CHAR = /[A-Za-zÀ-ÿ]/g;
const SYLLABLE = /^([a-zA-ZüÜvV:]+)([1-5])$/;

const TONE_MARKS: Record<string, string[]> = {
  a: ["a", "ā", "á", "ǎ", "à"],
  e: ["e", "ē", "é", "ě", "è"],
  i: ["i", "ī", "í", "ǐ", "ì"],
  o: ["o", "ō", "ó", "ǒ", "ò"],
  u: ["u", "ū", "ú", "ǔ", "ù"],
  ü: ["ü", "ǖ", "ǘ", "ǚ", "ǜ"],
};

/** Convert one CEDICT syllable (`Zhong1`, `xi3`) to tone-mark form. */
export function syllableToToneMarks(syllable: string): string {
  const match = SYLLABLE.exec(syllable);
  if (!match) return syllable;

  const [, letters, toneText] = match;
  const tone = Number(toneText);
  let body = letters.replace(/[vV]/g, (char) => (char === "V" ? "Ü" : "ü"));
  body = body.replace(/u:/g, "ü").replace(/U:/g, "Ü");

  if (tone < 1 || tone > 4) return body;

  const lower = body.toLowerCase();
  let vowelIndex = -1;
  if (lower.includes("a")) vowelIndex = lower.indexOf("a");
  else if (lower.includes("e")) vowelIndex = lower.indexOf("e");
  else if (lower.includes("ou")) vowelIndex = lower.indexOf("o");
  else {
    for (let i = lower.length - 1; i >= 0; i -= 1) {
      if ("aeiouü".includes(lower[i]!)) {
        vowelIndex = i;
        break;
      }
    }
  }
  if (vowelIndex < 0) return body;

  const vowel = lower[vowelIndex]!;
  const marked = TONE_MARKS[vowel]?.[tone];
  if (!marked) return body;

  const original = body[vowelIndex]!;
  const replacement = original === original.toUpperCase() ? marked.toUpperCase() : marked;
  return `${body.slice(0, vowelIndex)}${replacement}${body.slice(vowelIndex + 1)}`;
}

/** Convert CEDICT numbered pinyin (`Zhong1 guo2`) to tone marks (`Zhōng guó`). */
export function toToneMarks(numbered: string): string {
  return numbered.trim().split(/\s+/).filter(Boolean).map(syllableToToneMarks).join(" ");
}

/**
 * True for practice-style lines: mostly Han / CJK punctuation, little Latin.
 * Mixed DE/EN paragraphs with a single gloss word stay false.
 */
export function isChineseDominantLine(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return false;

  const hanChars = trimmed.match(HAN_CHAR) ?? [];
  if (hanChars.length < 2) return false;

  const latinChars = trimmed.match(LATIN_CHAR) ?? [];
  return hanChars.length >= latinChars.length * 2;
}

function isEmphasisNode(node: object): boolean {
  const type = "type" in node ? (node as { type: unknown }).type : undefined;
  if (type === "em" || type === "i") return true;
  if (typeof type === "function" && (type.name === "em" || type.name === "Emphasis")) return true;
  const props =
    "props" in node ? (node as { props?: { node?: { tagName?: string } } }).props : undefined;
  const tagName = props?.node?.tagName;
  return tagName === "em" || tagName === "i";
}

function plainTextFromNode(node: unknown): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(plainTextFromNode).join("");
  if (typeof node === "object" && node !== null && "props" in node) {
    // Grammar tips render as italic markdown; exclude them so German wording
    // does not spoil Chinese-dominant detection for pinyin lines.
    if (isEmphasisNode(node)) return "";
    const props = (node as { props?: { children?: unknown } }).props;
    return plainTextFromNode(props?.children);
  }
  return "";
}

/** Collect plain text from React children (markdown nodes). */
export function getPlainText(children: unknown): string {
  return plainTextFromNode(children);
}

const KEEP_PUNCTUATION = /[，、：；。！？!?,.…—\-·（）()《》〈〉“”‘’「」『』]/u;

/**
 * Walk `text` matching annotation surfaces (longest-first preferred via caller sort)
 * and join tone-mark pinyin. Returns null when nothing matched.
 */
export function buildTonePinyin(text: string, segments: DictionaryAnnotation[]): string | null {
  if (!text || segments.length === 0) return null;

  const parts: string[] = [];
  let cursor = 0;
  let matched = false;

  while (cursor < text.length) {
    const word = segments.find((item) => text.startsWith(item.surface, cursor));
    if (word) {
      const tone = toToneMarks(word.pinyin);
      if (tone) {
        parts.push(tone);
        matched = true;
      }
      cursor += word.surface.length;
      continue;
    }

    const character = String.fromCodePoint(text.codePointAt(cursor)!);
    if (KEEP_PUNCTUATION.test(character) && parts.length > 0) {
      parts[parts.length - 1] += character;
    }
    cursor += character.length;
  }

  if (!matched) return null;
  return parts.join(" ").trim();
}
