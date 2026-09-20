import { describe, expect, it } from "vitest";
import {
  DEFAULT_LESSON_CONFIG,
  DEFAULT_SENTENCE_LENGTH,
  isSentenceLength,
  normalizeLessonConfig,
} from "@/lib/lessons/types";

const validConfig = {
  chineseScript: "simplified",
  showPinyin: true,
  showGrammarTips: true,
  useAnkiVocab: false,
  useRoleSelection: true,
  enabledHskLevels: [1],
  enabledRoles: ["core"],
  enabledFamilies: ["shi_you"],
  excludedStructureIds: [],
  selectedStructureIds: [1],
  selectedFrameIds: [1],
  selectedFocusIds: [],
};

describe("isSentenceLength", () => {
  it("accepts the three lesson length stages", () => {
    expect(isSentenceLength("short")).toBe(true);
    expect(isSentenceLength("medium")).toBe(true);
    expect(isSentenceLength("long")).toBe(true);
    expect(isSentenceLength("tiny")).toBe(false);
    expect(isSentenceLength(2)).toBe(false);
  });
});

describe("normalizeLessonConfig", () => {
  it("defaults missing sentenceLength to short for older lessons", () => {
    const normalized = normalizeLessonConfig(validConfig);
    expect(normalized?.sentenceLength).toBe(DEFAULT_SENTENCE_LENGTH);
  });

  it("keeps a valid sentenceLength", () => {
    const normalized = normalizeLessonConfig({ ...validConfig, sentenceLength: "long" });
    expect(normalized?.sentenceLength).toBe("long");
  });

  it("falls back to short when sentenceLength is invalid", () => {
    const normalized = normalizeLessonConfig({ ...validConfig, sentenceLength: "huge" });
    expect(normalized?.sentenceLength).toBe("short");
  });

  it("includes sentenceLength on the default config", () => {
    expect(DEFAULT_LESSON_CONFIG.sentenceLength).toBe("short");
  });
});
