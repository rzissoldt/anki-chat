export type GlossLanguage = "en" | "de";

const GERMAN_CHARS = /[äöüÄÖÜß]/g;
const GERMAN_WORDS =
  /\b(?:und|oder|nicht|ich|du|er|sie|es|wir|ihr|mein|dein|sein|ein|eine|einer|eines|der|die|das|dem|den|des|mit|auf|für|von|zu|bei|nach|über|unter|ist|sind|war|waren|haben|hat|hatte|werden|wird|kann|können|möchte|muss|soll|bitte|danke|heute|morgen|gestern|deutsch|übersetz(?:en|ung)?|richtig|falsch|nochmal|nochmals|satz|übung)\b/gi;
const ENGLISH_WORDS =
  /\b(?:the|and|or|not|i|you|he|she|it|we|they|my|your|his|her|a|an|of|to|in|on|for|with|from|is|are|was|were|have|has|had|will|can|would|could|should|please|thanks|thank|today|tomorrow|yesterday|english|translat(?:e|ion)|correct|wrong|again|sentence|exercise)\b/gi;

function countMatches(text: string, pattern: RegExp): number {
  const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return [...text.matchAll(global)].length;
}

/**
 * Lightweight L1 heuristic for dictionary gloss language.
 * Prefers recent user text; falls back to navigator/UI hints.
 */
export function detectGlossLanguage(
  texts: string[],
  fallback: GlossLanguage = "en",
): GlossLanguage {
  const sample = texts
    .join("\n")
    .replace(/\p{Script=Han}+/gu, " ")
    .slice(-4_000);

  if (!sample.trim()) return fallback;

  const germanChars = countMatches(sample, GERMAN_CHARS);
  const germanWords = countMatches(sample, GERMAN_WORDS);
  const englishWords = countMatches(sample, ENGLISH_WORDS);

  const germanScore = germanWords + germanChars * 2;
  const englishScore = englishWords;

  if (germanScore === 0 && englishScore === 0) return fallback;
  if (germanScore === englishScore) return fallback;
  return germanScore > englishScore ? "de" : "en";
}

export function glossLanguageFromNavigator(
  language = typeof navigator !== "undefined" ? navigator.language : "en",
): GlossLanguage {
  return language.toLowerCase().startsWith("de") ? "de" : "en";
}
