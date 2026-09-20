"use client";

import { StatsToolbar, type StatsSection } from "@/components/stats/stats-toolbar";
import { StructureStatsTable } from "@/components/stats/structure-stats-table";
import { VocabularyStatsTable } from "@/components/stats/vocabulary-stats-table";
import type { ChineseScript } from "@/lib/dictionary/script-convert";
import { DEFAULT_HSK_LEVEL, type HskLevel } from "@/lib/hsk-level";
import { fetchStructureStats, fetchVocabularyStats } from "@/lib/stats/client";
import { filterStructureRows, filterVocabularyRows } from "@/lib/stats/filter";
import type {
  PracticeStatsMode,
  StatsOrder,
  StructureStatItem,
  StructureStatsSort,
  VocabularyStatItem,
  VocabularyStatsSort,
} from "@/lib/stats/types";
import { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_LIMIT = 1000;

type StatsPanelProps = {
  chineseScript: ChineseScript;
  onChineseScriptChange: (script: ChineseScript) => void;
};

export function StatsPanel({ chineseScript, onChineseScriptChange }: StatsPanelProps) {
  const [section, setSection] = useState<StatsSection>("vocabulary");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<PracticeStatsMode>("all");
  const [onlyKnown, setOnlyKnown] = useState(false);
  const [maxHskLevel, setMaxHskLevel] = useState<HskLevel>(DEFAULT_HSK_LEVEL);

  const [vocabSort, setVocabSort] = useState<VocabularyStatsSort>("normalized_score");
  const [vocabOrder, setVocabOrder] = useState<StatsOrder>("asc");
  const [structSort, setStructSort] = useState<StructureStatsSort>("normalized_score");
  const [structOrder, setStructOrder] = useState<StatsOrder>("asc");

  const [vocabRows, setVocabRows] = useState<VocabularyStatItem[]>([]);
  const [structRows, setStructRows] = useState<StructureStatItem[]>([]);
  const [vocabLoading, setVocabLoading] = useState(false);
  const [structLoading, setStructLoading] = useState(false);
  const [vocabError, setVocabError] = useState<string | null>(null);
  const [structError, setStructError] = useState<string | null>(null);

  useEffect(() => {
    if (section !== "vocabulary") return;
    const controller = new AbortController();
    setVocabLoading(true);
    setVocabError(null);
    void fetchVocabularyStats(
      {
        mode,
        only_known: onlyKnown,
        sort: vocabSort,
        order: vocabOrder,
        limit: DEFAULT_LIMIT,
        script: chineseScript,
      },
      controller.signal,
    )
      .then((response) => {
        setVocabRows(response.words);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Vokabel-Scores konnten nicht geladen werden.";
        setVocabError(message);
        setVocabRows([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setVocabLoading(false);
      });
    return () => controller.abort();
  }, [section, mode, onlyKnown, vocabSort, vocabOrder, chineseScript]);

  useEffect(() => {
    if (section !== "structures") return;
    const controller = new AbortController();
    setStructLoading(true);
    setStructError(null);
    void fetchStructureStats(
      {
        mode,
        max_hsk_level: maxHskLevel,
        sort: structSort,
        order: structOrder,
        limit: DEFAULT_LIMIT,
      },
      controller.signal,
    )
      .then((response) => {
        setStructRows(response.structures);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const message =
          error instanceof Error ? error.message : "Struktur-Scores konnten nicht geladen werden.";
        setStructError(message);
        setStructRows([]);
      })
      .finally(() => {
        if (!controller.signal.aborted) setStructLoading(false);
      });
    return () => controller.abort();
  }, [section, mode, maxHskLevel, structSort, structOrder]);

  const filteredVocab = useMemo(() => filterVocabularyRows(vocabRows, search), [vocabRows, search]);
  const filteredStruct = useMemo(
    () => filterStructureRows(structRows, search),
    [structRows, search],
  );

  const handleVocabSortChange = useCallback(
    (next: VocabularyStatsSort) => {
      if (next === vocabSort) {
        setVocabOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setVocabSort(next);
        setVocabOrder("asc");
      }
    },
    [vocabSort],
  );

  const handleStructSortChange = useCallback(
    (next: StructureStatsSort) => {
      if (next === structSort) {
        setStructOrder((prev) => (prev === "asc" ? "desc" : "asc"));
      } else {
        setStructSort(next);
        setStructOrder("asc");
      }
    },
    [structSort],
  );

  const handleSectionChange = useCallback((next: StatsSection) => {
    setSection(next);
    setSearch("");
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StatsToolbar
        section={section}
        onSectionChange={handleSectionChange}
        search={search}
        onSearchChange={setSearch}
        mode={mode}
        onModeChange={setMode}
        onlyKnown={onlyKnown}
        onOnlyKnownChange={setOnlyKnown}
        maxHskLevel={maxHskLevel}
        onMaxHskLevelChange={setMaxHskLevel}
        chineseScript={chineseScript}
        onChineseScriptChange={onChineseScriptChange}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {section === "vocabulary" ? (
          <VocabularyStatsTable
            rows={filteredVocab}
            sort={vocabSort}
            order={vocabOrder}
            onSortChange={handleVocabSortChange}
            loading={vocabLoading}
            error={vocabError}
          />
        ) : (
          <StructureStatsTable
            rows={filteredStruct}
            sort={structSort}
            order={structOrder}
            onSortChange={handleStructSortChange}
            loading={structLoading}
            error={structError}
          />
        )}
      </div>
    </div>
  );
}
