export type StructureRole = "core" | "focus";

export const STRUCTURE_FAMILIES = [
  "predicate",
  "shi_you",
  "question",
  "aspect",
  "existence",
  "serial",
  "ba",
  "bei",
  "bi",
  "shi_de",
  "pivotal",
  "compound",
  "fixed_pattern",
  "fixed_phrase",
  "numbers_time",
  "discourse",
] as const;

export type StructureFamily = (typeof STRUCTURE_FAMILIES)[number];

/** Families that stay off when enabling a role parent checkbox. */
export const DEFAULT_OFF_FAMILIES: ReadonlySet<StructureFamily> = new Set([
  "fixed_pattern",
  "fixed_phrase",
]);

export const STRUCTURE_FAMILY_LABELS_DE: Record<StructureFamily, string> = {
  predicate: "Prädikat / Einfachsatz",
  shi_you: "是 / 有",
  question: "Fragen",
  aspect: "Aspekt",
  existence: "Existenzsätze",
  serial: "连动 / 双宾",
  ba: "把",
  bei: "被",
  bi: "比",
  shi_de: "是……的",
  pivotal: "兼语",
  compound: "Komplexsätze",
  fixed_pattern: "Feste Muster",
  fixed_phrase: "Feste Wendungen",
  numbers_time: "Zahlen / Zeit",
  discourse: "Textabschnitte",
};

export const STRUCTURE_ROLE_LABELS_DE: Record<StructureRole, string> = {
  core: "Grundstrukturen",
  focus: "Komplexe Strukturen",
};

export function isStructureRole(value: unknown): value is StructureRole {
  return value === "core" || value === "focus";
}

export function isStructureFamily(value: unknown): value is StructureFamily {
  return typeof value === "string" && (STRUCTURE_FAMILIES as readonly string[]).includes(value);
}

export type GrammarStructure = {
  id: number;
  hsk_level: number;
  band_label: string;
  pattern: string;
  category: string;
  subcategory: string;
  detail: string;
  hint_de?: string | null;
  category_de?: string | null;
  subcategory_de?: string | null;
  role?: StructureRole | null;
  family?: StructureFamily | null;
};

export type GrammarStructuresResponse = {
  structures: GrammarStructure[];
};

export type GrammarStructuresParams = {
  max_hsk_level?: number;
};
