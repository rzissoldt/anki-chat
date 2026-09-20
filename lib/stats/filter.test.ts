import { describe, expect, it } from "vitest";
import { filterStructureRows, filterVocabularyRows } from "@/lib/stats/filter";
import { displayScore, formatDisplayScore } from "@/lib/stats/types";
import type { StructureStatItem, VocabularyStatItem } from "@/lib/stats/types";

const words: VocabularyStatItem[] = [
  {
    word_id: 1,
    word: "你好",
    pinyin: "ni3 hao3",
    known: true,
    evaluation_count: 2,
    total_points: 3,
    normalized_score: 0.75,
  },
  {
    word_id: 2,
    word: "谢谢",
    pinyin: "xie4 xie5",
    known: true,
    evaluation_count: 1,
    total_points: 1,
    normalized_score: 0.5,
  },
];

const structures: StructureStatItem[] = [
  {
    grammar_point_id: 1,
    pattern: "是……的",
    hsk_level: 2,
    category: "emphasis",
    evaluation_count: 1,
    total_points: 2,
    normalized_score: 1,
    hint_de: "Fokus: Zeit, Ort oder Agens betonen",
    category_de: "Satztypen",
  },
  {
    grammar_point_id: 2,
    pattern: "把字句",
    hsk_level: 3,
    category: "disposal",
    evaluation_count: 3,
    total_points: 3,
    normalized_score: 0.5,
    hint_de: "把-Satz: Objekt vor das Verb",
    category_de: "Sonderkonstruktionen",
  },
];

describe("filterVocabularyRows", () => {
  it("returns all rows for empty query", () => {
    expect(filterVocabularyRows(words, "  ")).toEqual(words);
  });

  it("filters by word surface", () => {
    expect(filterVocabularyRows(words, "谢")).toEqual([words[1]]);
  });

  it("filters by pinyin", () => {
    expect(filterVocabularyRows(words, "hao")).toEqual([words[0]]);
  });
});

describe("filterStructureRows", () => {
  it("filters by pattern substring", () => {
    expect(filterStructureRows(structures, "把")).toEqual([structures[1]]);
  });

  it("filters by German hint", () => {
    expect(filterStructureRows(structures, "fokus")).toEqual([structures[0]]);
  });

  it("filters by German category label", () => {
    expect(filterStructureRows(structures, "sonder")).toEqual([structures[1]]);
  });
});

describe("displayScore", () => {
  it("displays normalized scores on the 0–1 scale", () => {
    expect(displayScore(0.75)).toBe(0.75);
    expect(formatDisplayScore(0.75)).toBe("0.75");
    expect(formatDisplayScore(1)).toBe("1.00");
  });
});
