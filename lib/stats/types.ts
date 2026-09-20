export type PracticeStatsMode = "recognition" | "production" | "all";
export type StatsOrder = "asc" | "desc";
export type StructureStatsSort = "normalized_score" | "evaluation_count" | "hsk_level";
export type VocabularyStatsSort = "normalized_score" | "evaluation_count";
export type ChineseScript = "simplified" | "traditional";

export type VocabularyStatItem = {
  word_id: number | null;
  word: string;
  pinyin: string | null;
  known: boolean;
  evaluation_count: number;
  total_points: number;
  normalized_score: number;
};

export type VocabularyStatsResponse = {
  words: VocabularyStatItem[];
};

export type StructureStatItem = {
  grammar_point_id: number;
  pattern: string;
  hsk_level: number;
  category: string;
  evaluation_count: number;
  total_points: number;
  normalized_score: number;
  hint_de?: string | null;
  category_de?: string | null;
  subcategory_de?: string | null;
};

export type StructureStatsResponse = {
  structures: StructureStatItem[];
};

export type VocabularyStatsParams = {
  mode?: PracticeStatsMode;
  only_known?: boolean;
  min_evaluations?: number;
  sort?: VocabularyStatsSort;
  order?: StatsOrder;
  limit?: number;
  script?: ChineseScript;
};

export type StructureStatsParams = {
  mode?: PracticeStatsMode;
  max_hsk_level?: number;
  min_evaluations?: number;
  sort?: StructureStatsSort;
  order?: StatsOrder;
  limit?: number;
};

/** Display score on the normalized 0–1 scale from the stats API. */
export function displayScore(normalizedScore: number): number {
  return Math.round(normalizedScore * 100) / 100;
}

export function formatDisplayScore(normalizedScore: number): string {
  return displayScore(normalizedScore).toFixed(2);
}
