import type { StructureStatItem, VocabularyStatItem } from "@/lib/stats/types";

function normalizeQuery(query: string): string {
  return query.trim().toLowerCase();
}

/** Client-side text filter for vocabulary rows (word + optional pinyin). */
export function filterVocabularyRows(
  rows: VocabularyStatItem[],
  query: string,
): VocabularyStatItem[] {
  const q = normalizeQuery(query);
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.word.toLowerCase().includes(q)) return true;
    if (row.pinyin?.toLowerCase().includes(q)) return true;
    return false;
  });
}

/** Client-side text filter for structure rows (pattern + German glosses). */
export function filterStructureRows(rows: StructureStatItem[], query: string): StructureStatItem[] {
  const q = normalizeQuery(query);
  if (!q) return rows;
  return rows.filter((row) => {
    if (row.pattern.toLowerCase().includes(q)) return true;
    if (row.hint_de?.toLowerCase().includes(q)) return true;
    if (row.category_de?.toLowerCase().includes(q)) return true;
    if (row.category.toLowerCase().includes(q)) return true;
    return false;
  });
}
