import type { ModelMessage, UIMessage } from "ai";

const EVAL_TOOL = "record_practice_evaluation";
export const PRACTICE_SAMPLING_TOOLS = new Set(["sample_sentence_structure", "sample_vocabulary"]);

function getPartToolName(part: UIMessage["parts"][number]): string | undefined {
  if (part.type === "dynamic-tool" && "toolName" in part && typeof part.toolName === "string") {
    return part.toolName;
  }
  if (typeof part.type === "string" && part.type.startsWith("tool-")) {
    return part.type.slice("tool-".length);
  }
  return undefined;
}

function messageHasTool(message: UIMessage, toolNames: ReadonlySet<string> | string): boolean {
  const names = typeof toolNames === "string" ? new Set([toolNames]) : toolNames;
  for (const part of message.parts) {
    const toolName = getPartToolName(part);
    if (toolName && names.has(toolName)) return true;
  }
  return false;
}

function findPrecedingUserIndex(messages: UIMessage[], fromIndex: number): number {
  for (let index = fromIndex - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") return index;
  }
  return 0;
}

/** Start of the round that contains `evalIndex` (sampling cluster → preceding user). */
function findRoundStartBeforeEval(messages: UIMessage[], evalIndex: number): number {
  let previousEvalIndex = -1;
  for (let index = evalIndex - 1; index >= 0; index -= 1) {
    if (messageHasTool(messages[index]!, EVAL_TOOL)) {
      previousEvalIndex = index;
      break;
    }
  }

  let firstSamplingIndex = -1;
  for (let index = previousEvalIndex + 1; index < evalIndex; index += 1) {
    if (messageHasTool(messages[index]!, PRACTICE_SAMPLING_TOOLS)) {
      firstSamplingIndex = index;
      break;
    }
  }

  if (firstSamplingIndex >= 0) {
    return findPrecedingUserIndex(messages, firstSamplingIndex);
  }

  if (previousEvalIndex >= 0) {
    for (let index = previousEvalIndex + 1; index <= evalIndex; index += 1) {
      if (messages[index]?.role === "user") return index;
    }
    return Math.min(previousEvalIndex + 1, evalIndex);
  }

  return 0;
}

/**
 * Dual-history prune: keep the UI thread intact, but send only the current
 * practice round to the model.
 *
 * - After `record_practice_evaluation`, keep that round (incl. follow-ups).
 * - Once a new sampling sequence appears after the last eval, drop older rounds.
 */
export function prunePracticeContext(messages: UIMessage[]): UIMessage[] {
  if (messages.length === 0) return messages;

  let lastEvalIndex = -1;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messageHasTool(messages[index]!, EVAL_TOOL)) {
      lastEvalIndex = index;
      break;
    }
  }

  if (lastEvalIndex < 0) return messages;

  let firstSamplingAfterEval = -1;
  for (let index = lastEvalIndex + 1; index < messages.length; index += 1) {
    if (messageHasTool(messages[index]!, PRACTICE_SAMPLING_TOOLS)) {
      firstSamplingAfterEval = index;
      break;
    }
  }

  const start =
    firstSamplingAfterEval >= 0
      ? findPrecedingUserIndex(messages, firstSamplingAfterEval)
      : findRoundStartBeforeEval(messages, lastEvalIndex);

  if (start <= 0) return messages;
  return messages.slice(start);
}

type StepWithToolCalls = {
  toolCalls: ReadonlyArray<{ toolName: string }>;
};

export function hasPracticeSamplingCall(steps: ReadonlyArray<StepWithToolCalls>): boolean {
  return steps.some((step) =>
    step.toolCalls.some((call) => PRACTICE_SAMPLING_TOOLS.has(call.toolName)),
  );
}

/**
 * Remove tool payloads from history while retaining lightweight conversation
 * text. Current-round response messages are appended separately by prepareStep.
 */
export function stripHistoricalToolPayloads(messages: ModelMessage[]): ModelMessage[] {
  return messages.flatMap((message): ModelMessage[] => {
    if (message.role === "tool") return [];
    if (message.role !== "assistant" || typeof message.content === "string") return [message];

    const textContent = message.content.filter((part) => part.type === "text");
    if (textContent.length === 0) return [];
    return [{ ...message, content: textContent }];
  });
}
