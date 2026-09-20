"use client";

import { ScoreCell } from "@/components/stats/score-cell";
import type { StatsOrder, VocabularyStatItem, VocabularyStatsSort } from "@/lib/stats/types";
import { cn } from "@/lib/utils";

type VocabularyStatsTableProps = {
  rows: VocabularyStatItem[];
  sort: VocabularyStatsSort;
  order: StatsOrder;
  onSortChange: (sort: VocabularyStatsSort) => void;
  loading: boolean;
  error: string | null;
};

function SortHeader({
  label,
  active,
  order,
  onClick,
  className,
}: {
  label: string;
  active: boolean;
  order: StatsOrder;
  onClick: () => void;
  className?: string;
}) {
  return (
    <th
      className={cn("px-3 py-2 text-left text-xs font-medium uppercase tracking-wide", className)}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "hover:text-foreground inline-flex items-center gap-1",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        {label}
        {active ? <span aria-hidden>{order === "asc" ? "↑" : "↓"}</span> : null}
      </button>
    </th>
  );
}

export function VocabularyStatsTable({
  rows,
  sort,
  order,
  onSortChange,
  loading,
  error,
}: VocabularyStatsTableProps) {
  if (error) {
    return (
      <p className="text-destructive px-4 py-8 text-sm" role="alert">
        {error}
      </p>
    );
  }

  if (loading && rows.length === 0) {
    return <p className="text-muted-foreground px-4 py-8 text-sm">Lade Vokabel-Scores…</p>;
  }

  if (!loading && rows.length === 0) {
    return (
      <p className="text-muted-foreground px-4 py-8 text-sm">Keine Vokabel-Scores gefunden.</p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead className="bg-background sticky top-0">
          <tr className="border-border/60 border-b">
            <th className="text-muted-foreground w-[70%] px-3 py-2 text-left text-xs font-medium uppercase tracking-wide">
              Vokabel
            </th>
            <SortHeader
              label="Score"
              active={sort === "normalized_score"}
              order={order}
              onClick={() => onSortChange("normalized_score")}
              className="w-[30%]"
            />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.word_id != null ? `id:${row.word_id}` : `surface:${row.word}`}
              className="border-border/40 hover:bg-muted/30 border-b"
            >
              <td className="px-3 py-2.5">
                <div className="font-medium" lang="zh">
                  {row.word}
                </div>
                {row.pinyin ? (
                  <div className="text-muted-foreground text-xs">{row.pinyin}</div>
                ) : null}
              </td>
              <td className="px-3 py-2.5">
                <ScoreCell normalizedScore={row.normalized_score} />
                <span className="text-muted-foreground ml-2 text-xs">n={row.evaluation_count}</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
