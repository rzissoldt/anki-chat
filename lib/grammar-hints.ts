const GRAMMAR_HINT_TAG = /\s*(?:—|--|-)?\s*<grammar-hint>([\s\S]*?)(?:<\/grammar-hint>|$)/g;

/** Strip grammar-hint tags (and an optional leading dash) from markdown. */
export function stripGrammarHints(text: string): string {
  return text.replace(GRAMMAR_HINT_TAG, "").replace(/[ \t]+\n/g, "\n");
}

/**
 * Turn `<grammar-hint>…</grammar-hint>` into italic markdown after an em dash.
 */
export function revealGrammarHints(text: string): string {
  return text.replace(GRAMMAR_HINT_TAG, (_match, hint: string) => {
    const cleaned = hint
      .trim()
      .replace(/\s+/g, " ")
      .replace(/([*_])/g, "\\$1");
    if (!cleaned) return "";
    return ` — *${cleaned}*`;
  });
}

/** Preprocess assistant markdown for the current grammar-tips visibility. */
export function preprocessGrammarHints(text: string, showGrammarTips: boolean): string {
  return showGrammarTips ? revealGrammarHints(text) : stripGrammarHints(text);
}
