export type PracticeDirection = "recognition" | "production";

export type PracticeState = {
  /** Whether the thread has an active practice session (evaluated round or practice sentences) */
  hasPracticeSession: boolean;
  /** Whether the thread has at least one evaluated practice round */
  hasEvaluatedRound: boolean;
  /** Current detected batch size (1 to 5) */
  batchCount: number;
  /** Detected practice direction */
  direction: PracticeDirection | null;
  /** Grammar hint from the latest practice round, if any */
  grammarHint: string | null;
  /** Explicit prompt for "Weiter" preserving batch and direction */
  continuePrompt: string;
  /** Prompt for "Gleiche Grammatik", null if no grammar hint is present */
  repeatGrammarPrompt: string | null;
  /** Quick-start prompt: 5 sentences Chinese -> German */
  startChineseToGermanPrompt: string;
  /** Quick-start prompt: 5 sentences German -> Chinese */
  startGermanToChinesePrompt: string;
};

const GRAMMAR_HINT_REGEX = /<grammar-hint>([\s\S]*?)(?:<\/grammar-hint>|$)/gi;
const CHINESE_CHAR_REGEX = /[\u4e00-\u9fa5]/;

type GenericPart = {
  type?: string;
  text?: string;
  toolName?: string;
  args?: unknown;
  input?: unknown;
};

type GenericMessage = {
  role?: string;
  parts?: readonly GenericPart[];
  content?: unknown;
};

function getToolCallInfo(
  part: GenericPart,
): { toolName: string; args: Record<string, unknown> } | null {
  let toolName: string | undefined;

  if (part.type === "tool-call" && typeof part.toolName === "string") {
    toolName = part.toolName;
  } else if (part.type === "dynamic-tool" && typeof part.toolName === "string") {
    toolName = part.toolName;
  } else if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    toolName = part.type.slice("tool-".length);
  }

  if (!toolName) return null;

  const rawArgs = part.args ?? part.input;
  const args = rawArgs && typeof rawArgs === "object" ? (rawArgs as Record<string, unknown>) : {};

  return { toolName, args };
}

function extractGrammarHintsFromText(text: string): string[] {
  const hints: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(GRAMMAR_HINT_REGEX.source, "gi");

  while ((match = regex.exec(text)) !== null) {
    const hint = match[1]?.trim().replace(/\s+/g, " ");
    if (hint && !hints.includes(hint)) {
      hints.push(hint);
    }
  }

  return hints;
}

function getLastUserMessageText(messages: readonly GenericMessage[]): string {
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const msg = messages[i];
    if (!msg || msg.role !== "user" || !Array.isArray(msg.parts)) continue;

    const chunks: string[] = [];
    for (const part of msg.parts) {
      if (part.type === "text" && typeof part.text === "string") {
        chunks.push(part.text);
      }
    }
    if (chunks.length > 0) return chunks.join("\n");
  }
  return "";
}

/** Explicit direction cues in the latest user message (Weiter, Schnellstart, Richtungswechsel). */
export function inferPracticeDirectionFromUserText(text: string): PracticeDirection | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;

  if (
    /Deutsch\s*(?:→|->)\s*Chinesisch|Produktionsmodus|zum Übersetzen ins Chinesische/i.test(
      normalized,
    )
  ) {
    return "production";
  }
  if (
    /Chinesisch\s*(?:→|->)\s*Deutsch|Erkennungsmodus|zum Übersetzen ins Deutsche/i.test(normalized)
  ) {
    return "recognition";
  }
  return null;
}

/**
 * Practice direction for the model, derived from the full UI thread (before context pruning).
 * User text overrides thread inference so "Weiter (Deutsch → Chinesisch …)" wins over a
 * mistaken Chinese-only practice round in history.
 */
export function resolvePracticeDirectionForModel(
  messages: readonly GenericMessage[] = [],
): PracticeDirection | null {
  const fromUser = inferPracticeDirectionFromUserText(getLastUserMessageText(messages));
  if (fromUser) return fromUser;
  return detectPracticeState(messages).direction;
}

export function detectPracticeState(messages: readonly GenericMessage[] = []): PracticeState {
  const startChineseToGermanPrompt =
    "Starte Übersetzung: 5 Sätze Chinesisch → Deutsch (Erkennungsmodus: gib mir 5 chinesische Sätze zum Übersetzen ins Deutsche) mit Anki-Vokabeln";
  const startGermanToChinesePrompt =
    "Starte Übersetzung: 5 Sätze Deutsch → Chinesisch (Produktionsmodus: gib mir 5 deutsche Sätze zum Übersetzen ins Chinesische) mit Anki-Vokabeln";

  let lastEvalMessageIndex = -1;
  const evalCalls: Array<{ mode?: string }> = [];

  // 1. Scan backwards to find the last assistant message containing record_practice_evaluation
  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant" || !Array.isArray(msg.parts)) continue;

    const roundEvalCalls: Array<{ mode?: string }> = [];
    for (const part of msg.parts) {
      const tool = getToolCallInfo(part);
      if (tool && tool.toolName === "record_practice_evaluation") {
        const mode = typeof tool.args.mode === "string" ? tool.args.mode : undefined;
        roundEvalCalls.push({ mode });
      }
    }

    if (roundEvalCalls.length > 0) {
      lastEvalMessageIndex = i;
      evalCalls.push(...roundEvalCalls);
      break;
    }
  }

  const hasEvaluatedRound = evalCalls.length > 0;
  let batchCount = hasEvaluatedRound ? Math.min(5, Math.max(1, evalCalls.length)) : 5;
  let direction: PracticeDirection | null = null;

  if (hasEvaluatedRound) {
    const lastMode = evalCalls[evalCalls.length - 1]?.mode;
    if (lastMode === "production" || lastMode === "recognition") {
      direction = lastMode;
    }
  }

  // 2. Find the grammar hint and practice cues from the practice round
  let grammarHint: string | null = null;
  let foundPracticeMessage = false;
  const searchStart = lastEvalMessageIndex >= 0 ? lastEvalMessageIndex : messages.length - 1;

  for (let i = searchStart; i >= 0; i--) {
    const msg = messages[i];
    if (!msg || msg.role !== "assistant" || !Array.isArray(msg.parts)) continue;

    const hintsInMsg: string[] = [];
    let msgHasChinese = false;
    let hasSamplingTools = false;

    for (const part of msg.parts) {
      if (part.type === "text" && typeof part.text === "string") {
        hintsInMsg.push(...extractGrammarHintsFromText(part.text));
        if (CHINESE_CHAR_REGEX.test(part.text)) {
          msgHasChinese = true;
        }
      }
      const tool = getToolCallInfo(part);
      if (
        tool &&
        (tool.toolName === "sample_vocabulary" ||
          tool.toolName === "sample_sentence_frame" ||
          tool.toolName === "sample_focus_structure")
      ) {
        hasSamplingTools = true;
      }
    }

    const hasPracticeSentenceText = hintsInMsg.length > 0 || msgHasChinese;

    if (hasPracticeSentenceText || hasSamplingTools) {
      foundPracticeMessage = true;
      if (hintsInMsg.length > 0 && !grammarHint) {
        grammarHint = hintsInMsg.join(", ");
        if (!hasEvaluatedRound && hintsInMsg.length > 1) {
          batchCount = Math.min(5, hintsInMsg.length);
        }
      }

      if (!direction && hasPracticeSentenceText) {
        direction = msgHasChinese ? "recognition" : "production";
      }
      break;
    }
  }

  const hasPracticeSession = hasEvaluatedRound || foundPracticeMessage;

  // 3. Build Continue prompt
  let continuePrompt: string;
  const batchSuffix = batchCount > 1 ? ` (wieder ${batchCount} Sätze)` : "";

  if (direction === "production") {
    continuePrompt =
      batchCount > 1
        ? `Weiter (wieder ${batchCount} Sätze, Deutsch → Chinesisch: deutsche Sätze vorgeben)`
        : "Weiter (Deutsch → Chinesisch: deutsche Sätze vorgeben)";
  } else if (direction === "recognition") {
    continuePrompt =
      batchCount > 1
        ? `Weiter (wieder ${batchCount} Sätze, Chinesisch → Deutsch: chinesische Sätze vorgeben)`
        : "Weiter (Chinesisch → Deutsch: chinesische Sätze vorgeben)";
  } else {
    continuePrompt = batchCount > 1 ? `Weiter (wieder ${batchCount} Sätze)` : "Weiter";
  }

  // 4. Build Repeat Grammar prompt
  let repeatGrammarPrompt: string | null = null;
  if (grammarHint) {
    repeatGrammarPrompt = `Nochmal mit gleicher Grammatik (${grammarHint})${batchSuffix}`;
  }

  return {
    hasPracticeSession,
    hasEvaluatedRound,
    batchCount,
    direction,
    grammarHint,
    continuePrompt,
    repeatGrammarPrompt,
    startChineseToGermanPrompt,
    startGermanToChinesePrompt,
  };
}
