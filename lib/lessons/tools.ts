const ANKI_VOCAB_TOOLS = [
  "sample_vocabulary",
  "find_related_vocabulary",
  "inspect_vocabulary",
] as const;
const SAMPLE_FRAME_TOOL = "sample_sentence_frame";
const SAMPLE_FOCUS_TOOL = "sample_focus_structure";

type ToolLike = {
  execute?: (input: unknown, options?: unknown) => unknown;
  [key: string]: unknown;
};

export type LessonToolOptions = {
  useAnkiVocab: boolean;
  structureIds: number[];
  frameIds?: number[];
  focusIds?: number[];
};

function wrapSampleTool(tool: ToolLike, ids: number[]): ToolLike {
  if (typeof tool.execute !== "function") return tool;
  const execute = tool.execute;
  return {
    ...tool,
    execute: (input: unknown, options?: unknown) => {
      const args =
        input && typeof input === "object"
          ? { ...(input as Record<string, unknown>), ids }
          : { ids };
      return execute(args, options);
    },
  };
}

/** Drop Anki vocab tools and pin structure sampling to the lesson allowlists. */
export function applyLessonTools(
  tools: Record<string, unknown>,
  lesson: LessonToolOptions | null,
): Record<string, unknown> {
  if (!lesson) return tools;

  const next = { ...tools };
  if (!lesson.useAnkiVocab) {
    for (const name of ANKI_VOCAB_TOOLS) {
      delete next[name];
    }
  }

  const frameIds = lesson.frameIds ?? [];
  const focusIds = lesson.focusIds ?? [];
  // Fall back: if only structureIds provided, pin both tools to the full list
  // (legacy). Prefer explicit frame/focus splits when present.
  const hasSplit = lesson.frameIds !== undefined || lesson.focusIds !== undefined;
  const frameAllow = hasSplit ? frameIds : lesson.structureIds;
  const focusAllow = hasSplit ? focusIds : lesson.structureIds;

  const frame = next[SAMPLE_FRAME_TOOL];
  if (frame && typeof frame === "object") {
    if (frameAllow.length > 0) {
      next[SAMPLE_FRAME_TOOL] = wrapSampleTool(frame as ToolLike, frameAllow);
    } else {
      delete next[SAMPLE_FRAME_TOOL];
    }
  }

  const focus = next[SAMPLE_FOCUS_TOOL];
  if (focus && typeof focus === "object") {
    if (focusAllow.length > 0) {
      next[SAMPLE_FOCUS_TOOL] = wrapSampleTool(focus as ToolLike, focusAllow);
    } else {
      delete next[SAMPLE_FOCUS_TOOL];
    }
  }

  // Legacy tool name must never remain exposed in lesson mode.
  delete next.sample_sentence_structure;

  return next;
}
