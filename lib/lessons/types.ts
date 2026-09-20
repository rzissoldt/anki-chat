import type { ChineseScript } from "@/lib/dictionary/script-convert";
import type { StructureFamily, StructureRole } from "@/lib/grammar/types";
import { isStructureFamily, isStructureRole } from "@/lib/grammar/types";
import { isHskLevel, maxHskLevel, type HskLevel } from "@/lib/hsk-level";

export type LessonConfig = {
  chineseScript: ChineseScript;
  showPinyin: boolean;
  showGrammarTips: boolean;
  useAnkiVocab: boolean;
  /**
   * When true (new lessons), selection is role/family + HSK max.
   * When false (pre-role IndexedDB lessons), selection is HSK-band opt-out.
   */
  useRoleSelection: boolean;
  /** UI bands or derived 1..max for the HSK max filter. */
  enabledHskLevels: HskLevel[];
  enabledRoles: StructureRole[];
  enabledFamilies: StructureFamily[];
  excludedStructureIds: number[];
  /** Resolved at save time so chat requests do not need the catalog. */
  selectedStructureIds: number[];
  /** Subset of selectedStructureIds with role=core. */
  selectedFrameIds: number[];
  /** Subset of selectedStructureIds with role=focus. */
  selectedFocusIds: number[];
};

export type LessonRecord = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  config: LessonConfig;
  messages: unknown;
};

export const DEFAULT_LESSON_CONFIG: LessonConfig = {
  chineseScript: "simplified",
  showPinyin: true,
  showGrammarTips: true,
  useAnkiVocab: true,
  useRoleSelection: true,
  enabledHskLevels: [],
  enabledRoles: [],
  enabledFamilies: [],
  excludedStructureIds: [],
  selectedStructureIds: [],
  selectedFrameIds: [],
  selectedFocusIds: [],
};

function asNumberArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is number => typeof item === "number" && Number.isInteger(item));
}

function asHskLevels(value: unknown): HskLevel[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isHskLevel);
}

function asRoles(value: unknown): StructureRole[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStructureRole);
}

function asFamilies(value: unknown): StructureFamily[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isStructureFamily);
}

/** Normalize persisted configs (tolerant of pre-role IndexedDB records). */
export function normalizeLessonConfig(value: unknown): LessonConfig | null {
  if (!value || typeof value !== "object") return null;
  const config = value as Partial<LessonConfig>;
  if (
    !(config.chineseScript === "simplified" || config.chineseScript === "traditional") ||
    typeof config.showPinyin !== "boolean" ||
    typeof config.showGrammarTips !== "boolean" ||
    typeof config.useAnkiVocab !== "boolean"
  ) {
    return null;
  }
  return {
    chineseScript: config.chineseScript,
    showPinyin: config.showPinyin,
    showGrammarTips: config.showGrammarTips,
    useAnkiVocab: config.useAnkiVocab,
    useRoleSelection:
      typeof config.useRoleSelection === "boolean"
        ? config.useRoleSelection
        : asRoles(config.enabledRoles).length > 0,
    enabledHskLevels: asHskLevels(config.enabledHskLevels),
    enabledRoles: asRoles(config.enabledRoles),
    enabledFamilies: asFamilies(config.enabledFamilies),
    excludedStructureIds: asNumberArray(config.excludedStructureIds),
    selectedStructureIds: asNumberArray(config.selectedStructureIds),
    selectedFrameIds: asNumberArray(config.selectedFrameIds),
    selectedFocusIds: asNumberArray(config.selectedFocusIds),
  };
}

export function isLessonConfig(value: unknown): value is LessonConfig {
  return normalizeLessonConfig(value) !== null;
}

export function lessonHskLevel(config: LessonConfig): HskLevel {
  return maxHskLevel(config.enabledHskLevels);
}
