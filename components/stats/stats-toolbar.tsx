"use client";

import { Button } from "@/components/ui/button";
import { DEFAULT_HSK_LEVEL, formatHskLevel, HSK_LEVELS, type HskLevel } from "@/lib/hsk-level";
import type { ChineseScript, PracticeStatsMode } from "@/lib/stats/types";
import { cn } from "@/lib/utils";

export type StatsSection = "vocabulary" | "structures";

type StatsToolbarProps = {
  section: StatsSection;
  onSectionChange: (section: StatsSection) => void;
  search: string;
  onSearchChange: (value: string) => void;
  mode: PracticeStatsMode;
  onModeChange: (mode: PracticeStatsMode) => void;
  onlyKnown: boolean;
  onOnlyKnownChange: (value: boolean) => void;
  maxHskLevel: HskLevel;
  onMaxHskLevelChange: (level: HskLevel) => void;
  chineseScript: ChineseScript;
  onChineseScriptChange: (script: ChineseScript) => void;
};

const MODE_OPTIONS: { value: PracticeStatsMode; label: string }[] = [
  { value: "all", label: "Alle" },
  { value: "recognition", label: "Erkennen" },
  { value: "production", label: "Produzieren" },
];

export function StatsToolbar({
  section,
  onSectionChange,
  search,
  onSearchChange,
  mode,
  onModeChange,
  onlyKnown,
  onOnlyKnownChange,
  maxHskLevel,
  onMaxHskLevelChange,
  chineseScript,
  onChineseScriptChange,
}: StatsToolbarProps) {
  return (
    <div className="border-border/60 flex flex-col gap-3 border-b px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <div
          role="tablist"
          aria-label="Stats section"
          className="bg-muted/50 inline-flex rounded-full p-0.5"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={section === "vocabulary"}
            variant={section === "vocabulary" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onSectionChange("vocabulary")}
          >
            Vokabeln
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={section === "structures"}
            variant={section === "structures" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onSectionChange("structures")}
          >
            Satzstrukturen
          </Button>
        </div>

        <input
          type="search"
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder={section === "vocabulary" ? "Vokabel suchen…" : "Struktur suchen…"}
          aria-label="Suche"
          className="border-border/60 bg-muted/40 placeholder:text-muted-foreground/60 h-8 min-w-[12rem] flex-1 rounded-lg border px-3 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="text-muted-foreground flex items-center gap-1.5">
          <span className="sr-only">Modus</span>
          <select
            value={mode}
            onChange={(event) => onModeChange(event.target.value as PracticeStatsMode)}
            className="border-border/60 bg-muted/40 h-7 rounded-md border px-2 text-sm"
            aria-label="Practice-Modus"
          >
            {MODE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        {section === "vocabulary" ? (
          <>
            <label className="text-muted-foreground flex items-center gap-1.5">
              <input
                type="checkbox"
                checked={onlyKnown}
                onChange={(event) => onOnlyKnownChange(event.target.checked)}
                className="size-3.5 accent-primary"
              />
              Nur bekannte
            </label>

            <fieldset className="inline-flex items-center gap-0.5">
              <legend className="sr-only">Schrift</legend>
              {(["simplified", "traditional"] as const).map((script) => (
                <Button
                  key={script}
                  type="button"
                  size="xs"
                  variant={chineseScript === script ? "secondary" : "ghost"}
                  className={cn("rounded-full px-2", chineseScript === script && "font-semibold")}
                  onClick={() => onChineseScriptChange(script)}
                  aria-pressed={chineseScript === script}
                >
                  {script === "simplified" ? "简" : "繁"}
                </Button>
              ))}
            </fieldset>
          </>
        ) : (
          <label className="text-muted-foreground flex items-center gap-1.5">
            <span>HSK ≤</span>
            <select
              value={maxHskLevel}
              onChange={(event) => {
                const value = Number(event.target.value);
                onMaxHskLevelChange(
                  HSK_LEVELS.includes(value as HskLevel) ? (value as HskLevel) : DEFAULT_HSK_LEVEL,
                );
              }}
              className="border-border/60 bg-muted/40 h-7 rounded-md border px-2 text-sm"
              aria-label="Maximaler HSK-Level"
            >
              {HSK_LEVELS.map((level) => (
                <option key={level} value={level}>
                  {formatHskLevel(level)}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
    </div>
  );
}
