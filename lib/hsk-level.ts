export const HSK_LEVELS = [1, 2, 3, 4, 5, 6, 9] as const;

export type HskLevel = (typeof HSK_LEVELS)[number];

export const DEFAULT_HSK_LEVEL: HskLevel = 3;

export function isHskLevel(value: unknown): value is HskLevel {
  return typeof value === "number" && HSK_LEVELS.includes(value as HskLevel);
}

export function formatHskLevel(level: HskLevel): string {
  return level === 9 ? "HSK 7–9" : `HSK ${level}`;
}

/** Map a catalog/DB HSK level onto the UI band (7–9 collapse to `9`). */
export function catalogHskToUiBand(hskLevel: number): HskLevel | null {
  if (hskLevel >= 7 && hskLevel <= 9) return 9;
  if (isHskLevel(hskLevel)) return hskLevel;
  return null;
}

export function maxHskLevel(levels: readonly HskLevel[]): HskLevel {
  if (levels.length === 0) return DEFAULT_HSK_LEVEL;
  return Math.max(...levels) as HskLevel;
}
