import { describe, expect, it } from "vitest";
import type { GrammarStructure } from "@/lib/grammar/types";
import {
  defaultLessonTitle,
  resolveSelectedStructureIds,
  withResolvedSelection,
} from "@/lib/lessons/selection";
import { DEFAULT_LESSON_CONFIG } from "@/lib/lessons/types";

const structures: GrammarStructure[] = [
  {
    id: 1,
    hsk_level: 1,
    band_label: "1",
    pattern: "是字句",
    category: "句子的类型",
    subcategory: "特殊句型",
    detail: "是",
    role: "core",
    family: "shi_you",
  },
  {
    id: 2,
    hsk_level: 1,
    band_label: "1",
    pattern: "了",
    category: "动作的态",
    subcategory: "",
    detail: "了",
    role: "core",
    family: "aspect",
  },
  {
    id: 3,
    hsk_level: 3,
    band_label: "3",
    pattern: "把字句",
    category: "句子的类型",
    subcategory: "特殊句型",
    detail: "把",
    role: "focus",
    family: "ba",
  },
  {
    id: 7,
    hsk_level: 7,
    band_label: "7-9",
    pattern: "复合句",
    category: "语段（句群）",
    subcategory: "",
    detail: "复合",
    role: "focus",
    family: "discourse",
  },
];

describe("resolveSelectedStructureIds", () => {
  it("starts empty until roles or legacy HSK bands are enabled", () => {
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: true,
        enabledHskLevels: [],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [],
      }),
    ).toEqual([]);
  });

  it("keeps HSK-max idle until a role is enabled", () => {
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: true,
        enabledHskLevels: [1, 2, 3],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [],
      }),
    ).toEqual([]);
  });

  it("supports legacy HSK-band opt-out when role selection is off", () => {
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: false,
        enabledHskLevels: [1],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [],
      }),
    ).toEqual([1, 2]);
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: false,
        enabledHskLevels: [1],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [2],
      }),
    ).toEqual([1]);
  });

  it("maps catalog HSK 7–9 onto UI band 9 in legacy mode", () => {
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: false,
        enabledHskLevels: [9],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [],
      }),
    ).toEqual([7]);
  });

  it("selects by role + family with HSK max filter", () => {
    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: true,
        enabledHskLevels: [1, 2, 3],
        enabledRoles: ["core", "focus"],
        enabledFamilies: ["shi_you", "aspect", "ba"],
        excludedStructureIds: [],
      }),
    ).toEqual([1, 2, 3]);

    expect(
      resolveSelectedStructureIds(structures, {
        useRoleSelection: true,
        enabledHskLevels: [1, 2],
        enabledRoles: ["core", "focus"],
        enabledFamilies: ["shi_you", "aspect", "ba"],
        excludedStructureIds: [],
      }),
    ).toEqual([1, 2]);
  });
});

describe("withResolvedSelection", () => {
  it("splits selected ids into frame and focus pools", () => {
    const next = withResolvedSelection(
      {
        ...DEFAULT_LESSON_CONFIG,
        enabledHskLevels: [1, 2, 3],
        enabledRoles: ["core", "focus"],
        enabledFamilies: ["shi_you", "ba"],
        excludedStructureIds: [],
      },
      structures,
    );
    expect(next.selectedStructureIds).toEqual([1, 3]);
    expect(next.selectedFrameIds).toEqual([1]);
    expect(next.selectedFocusIds).toEqual([3]);
  });

  it("drops exclusions that no longer belong to the selection", () => {
    const next = withResolvedSelection(
      {
        ...DEFAULT_LESSON_CONFIG,
        useRoleSelection: false,
        enabledHskLevels: [3],
        enabledRoles: [],
        enabledFamilies: [],
        excludedStructureIds: [2, 3],
      },
      structures,
    );
    expect(next.excludedStructureIds).toEqual([3]);
    expect(next.selectedStructureIds).toEqual([]);
  });
});

describe("defaultLessonTitle", () => {
  it("summarizes roles and selected count", () => {
    expect(
      defaultLessonTitle(
        {
          enabledRoles: ["core", "focus"],
          enabledHskLevels: [1, 2, 3],
          enabledFamilies: ["shi_you"],
        },
        4,
      ),
    ).toBe("Grundstrukturen + Komplexe Strukturen · HSK 3 · 4 Strukturen");
  });
});
