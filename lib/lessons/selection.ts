import type { GrammarStructure, StructureFamily, StructureRole } from "@/lib/grammar/types";
import {
  DEFAULT_OFF_FAMILIES,
  STRUCTURE_FAMILY_LABELS_DE,
  STRUCTURE_ROLE_LABELS_DE,
} from "@/lib/grammar/types";
import { catalogHskToUiBand, formatHskLevel, type HskLevel } from "@/lib/hsk-level";
import type { LessonConfig } from "@/lib/lessons/types";

export function structuresForLevel(
  structures: readonly GrammarStructure[],
  level: HskLevel,
): GrammarStructure[] {
  return structures.filter((structure) => catalogHskToUiBand(structure.hsk_level) === level);
}

export function structuresForRole(
  structures: readonly GrammarStructure[],
  role: StructureRole,
): GrammarStructure[] {
  return structures.filter((structure) => structure.role === role);
}

export function structuresForFamily(
  structures: readonly GrammarStructure[],
  role: StructureRole,
  family: StructureFamily,
): GrammarStructure[] {
  return structures.filter(
    (structure) => structure.role === role && structure.family === family,
  );
}

/** Max catalog HSK for the lesson (UI band 9 → allow up to level 9). */
export function lessonMaxCatalogHsk(enabledHskLevels: readonly HskLevel[]): number | null {
  if (enabledHskLevels.length === 0) return null;
  return Math.max(...enabledHskLevels);
}

export function passesHskFilter(
  structure: GrammarStructure,
  enabledHskLevels: readonly HskLevel[],
  roleMode: boolean,
): boolean {
  if (enabledHskLevels.length === 0) return false;
  if (roleMode) {
    const max = lessonMaxCatalogHsk(enabledHskLevels);
    return max !== null && structure.hsk_level <= max;
  }
  const band = catalogHskToUiBand(structure.hsk_level);
  return band !== null && enabledHskLevels.includes(band);
}

export function resolveSelectedStructureIds(
  structures: readonly GrammarStructure[],
  config: Pick<
    LessonConfig,
    | "useRoleSelection"
    | "enabledHskLevels"
    | "enabledRoles"
    | "enabledFamilies"
    | "excludedStructureIds"
  >,
): number[] {
  const roleMode = config.useRoleSelection || config.enabledRoles.length > 0;
  if (roleMode) {
    if (config.enabledRoles.length === 0 || config.enabledHskLevels.length === 0) {
      return [];
    }
  } else if (config.enabledHskLevels.length === 0) {
    return [];
  }

  const enabledRoles = new Set(config.enabledRoles);
  const enabledFamilies = new Set(config.enabledFamilies);
  const excluded = new Set(config.excludedStructureIds);
  const ids: number[] = [];

  for (const structure of structures) {
    if (!passesHskFilter(structure, config.enabledHskLevels, roleMode)) continue;
    if (excluded.has(structure.id)) continue;

    if (roleMode) {
      if (!structure.role || !enabledRoles.has(structure.role)) continue;
      if (!structure.family || !enabledFamilies.has(structure.family)) continue;
    }

    ids.push(structure.id);
  }
  return ids;
}

/** @deprecated Prefer resolveSelectedStructureIds(config). Kept for older call sites. */
export function resolveSelectedStructureIdsLegacy(
  structures: readonly GrammarStructure[],
  enabledHskLevels: readonly HskLevel[],
  excludedStructureIds: readonly number[],
): number[] {
  return resolveSelectedStructureIds(structures, {
    useRoleSelection: false,
    enabledHskLevels: [...enabledHskLevels],
    enabledRoles: [],
    enabledFamilies: [],
    excludedStructureIds: [...excludedStructureIds],
  });
}

export function groupStructuresByHsk(
  structures: readonly GrammarStructure[],
): Map<HskLevel, GrammarStructure[]> {
  const groups = new Map<HskLevel, GrammarStructure[]>();
  for (const structure of structures) {
    const band = catalogHskToUiBand(structure.hsk_level);
    if (band === null) continue;
    const list = groups.get(band);
    if (list) list.push(structure);
    else groups.set(band, [structure]);
  }
  return groups;
}

export function familiesForRole(
  structures: readonly GrammarStructure[],
  role: StructureRole,
): StructureFamily[] {
  const seen = new Set<StructureFamily>();
  const order: StructureFamily[] = [];
  for (const structure of structures) {
    if (structure.role !== role || !structure.family) continue;
    if (seen.has(structure.family)) continue;
    seen.add(structure.family);
    order.push(structure.family);
  }
  return order;
}

/** Default families to enable when turning a role on. */
export function defaultFamiliesForRole(
  structures: readonly GrammarStructure[],
  role: StructureRole,
): StructureFamily[] {
  return familiesForRole(structures, role).filter((family) => !DEFAULT_OFF_FAMILIES.has(family));
}

export function defaultLessonTitle(
  config: Pick<LessonConfig, "enabledRoles" | "enabledHskLevels" | "enabledFamilies">,
  selectedCount: number,
): string {
  if (selectedCount === 0) return "New Lesson";

  if (config.enabledRoles.length > 0) {
    const roleLabels = config.enabledRoles.map((role) => STRUCTURE_ROLE_LABELS_DE[role]);
    const max = lessonMaxCatalogHsk(config.enabledHskLevels);
    const hskPart =
      max !== null
        ? ` · ${formatHskLevel(max === 9 || max >= 7 ? 9 : (max as HskLevel))}`
        : "";
    return `${roleLabels.join(" + ")}${hskPart} · ${selectedCount} Strukturen`;
  }

  if (config.enabledHskLevels.length === 0) return "New Lesson";
  const labels = [...config.enabledHskLevels]
    .sort((a, b) => a - b)
    .map((level) => formatHskLevel(level))
    .join(", ");
  return `${labels} · ${selectedCount} Strukturen`;
}

export function withResolvedSelection(
  config: LessonConfig,
  structures: readonly GrammarStructure[],
): LessonConfig {
  const roleMode = config.useRoleSelection || config.enabledRoles.length > 0;
  const excluded = config.excludedStructureIds.filter((id) => {
    const structure = structures.find((item) => item.id === id);
    if (!structure) return false;
    if (!passesHskFilter(structure, config.enabledHskLevels, roleMode)) return false;
    if (roleMode) {
      if (!structure.role || !config.enabledRoles.includes(structure.role)) return false;
      if (!structure.family || !config.enabledFamilies.includes(structure.family)) return false;
    }
    return true;
  });

  const selectedStructureIds = resolveSelectedStructureIds(structures, {
    ...config,
    excludedStructureIds: excluded,
  });
  const selectedSet = new Set(selectedStructureIds);
  const selectedFrameIds: number[] = [];
  const selectedFocusIds: number[] = [];
  for (const structure of structures) {
    if (!selectedSet.has(structure.id)) continue;
    if (structure.role === "core") selectedFrameIds.push(structure.id);
    else if (structure.role === "focus") selectedFocusIds.push(structure.id);
  }

  return {
    ...config,
    excludedStructureIds: excluded,
    selectedStructureIds,
    selectedFrameIds,
    selectedFocusIds,
  };
}

export function levelsUpToMax(max: HskLevel): HskLevel[] {
  const all: HskLevel[] = [1, 2, 3, 4, 5, 6, 9];
  return all.filter((level) => level <= max);
}

export { STRUCTURE_FAMILY_LABELS_DE, STRUCTURE_ROLE_LABELS_DE };
