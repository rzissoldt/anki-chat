"use client";

import { SentenceLengthSlider } from "@/components/lessons/sentence-length-slider";
import { StructurePicker } from "@/components/lessons/structure-picker";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { fetchGrammarStructures } from "@/lib/grammar/client";
import type { GrammarStructure, StructureFamily, StructureRole } from "@/lib/grammar/types";
import type { ChineseScript } from "@/lib/dictionary/script-convert";
import { type HskLevel } from "@/lib/hsk-level";
import {
  defaultFamiliesForRole,
  defaultLessonTitle,
  levelsUpToMax,
  withResolvedSelection,
} from "@/lib/lessons/selection";
import { DEFAULT_LESSON_CONFIG, type LessonConfig } from "@/lib/lessons/types";
import { useEffect, useMemo, useState } from "react";

type LessonDialogProps = {
  open: boolean;
  mode: "create" | "edit";
  initialConfig?: LessonConfig;
  initialTitle?: string;
  onOpenChange: (open: boolean) => void;
  onSave: (input: { title: string; config: LessonConfig }) => void;
};

export function LessonDialog({
  open,
  mode,
  initialConfig,
  initialTitle,
  onOpenChange,
  onSave,
}: LessonDialogProps) {
  const [config, setConfig] = useState<LessonConfig>(initialConfig ?? DEFAULT_LESSON_CONFIG);
  const [title, setTitle] = useState(initialTitle ?? "");
  const [structures, setStructures] = useState<GrammarStructure[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setConfig(initialConfig ?? DEFAULT_LESSON_CONFIG);
    setTitle(initialTitle ?? "");
    setError(null);

    const controller = new AbortController();
    setLoading(true);
    void fetchGrammarStructures({}, controller.signal)
      .then((response) => {
        setStructures(response.structures ?? []);
      })
      .catch((caught: unknown) => {
        if (controller.signal.aborted) return;
        setStructures([]);
        setError(
          caught instanceof Error
            ? caught.message
            : "Grammatikstrukturen konnten nicht geladen werden.",
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [open, initialConfig, initialTitle]);

  const resolved = useMemo(() => withResolvedSelection(config, structures), [config, structures]);
  const canSave = resolved.selectedStructureIds.length > 0 && !loading && !error;

  const generatedTitle = defaultLessonTitle(resolved, resolved.selectedStructureIds.length);

  const handleMaxHskChange = (max: HskLevel | null) => {
    setConfig((current) => ({
      ...current,
      enabledHskLevels: max === null ? [] : levelsUpToMax(max),
    }));
  };

  const handleToggleRole = (role: StructureRole, enabled: boolean) => {
    setConfig((current) => {
      const enabledRoles = enabled
        ? [...new Set([...current.enabledRoles, role])]
        : current.enabledRoles.filter((item) => item !== role);

      let enabledFamilies = [...current.enabledFamilies];
      if (enabled) {
        const defaults = defaultFamiliesForRole(structures, role);
        enabledFamilies = [...new Set([...enabledFamilies, ...defaults])];
      } else {
        const roleFamilies = new Set(
          structures.filter((s) => s.role === role && s.family).map((s) => s.family!),
        );
        // Keep families still needed by the other role
        const otherRole = role === "core" ? "focus" : "core";
        const keepFromOther = new Set(
          structures
            .filter((s) => s.role === otherRole && s.family && enabledRoles.includes(otherRole))
            .map((s) => s.family!),
        );
        enabledFamilies = enabledFamilies.filter(
          (family) => !roleFamilies.has(family) || keepFromOther.has(family),
        );
      }

      return { ...current, enabledRoles, enabledFamilies };
    });
  };

  const handleToggleFamily = (family: StructureFamily, enabled: boolean) => {
    setConfig((current) => {
      const enabledFamilies = enabled
        ? [...new Set([...current.enabledFamilies, family])]
        : current.enabledFamilies.filter((item) => item !== family);
      const familyIds = new Set(structures.filter((s) => s.family === family).map((s) => s.id));
      const excludedStructureIds = enabled
        ? current.excludedStructureIds.filter((id) => !familyIds.has(id))
        : current.excludedStructureIds;
      return { ...current, enabledFamilies, excludedStructureIds };
    });
  };

  const handleToggleStructure = (id: number, selected: boolean) => {
    setConfig((current) => {
      const excluded = new Set(current.excludedStructureIds);
      if (selected) excluded.delete(id);
      else excluded.add(id);
      return { ...current, excludedStructureIds: [...excluded] };
    });
  };

  const handleSave = () => {
    if (!canSave) return;
    onSave({
      title: title.trim() || generatedTitle,
      config: resolved,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-full max-w-[calc(100%-2rem)] flex-col overflow-hidden sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{mode === "create" ? "New Lesson" : "Lesson bearbeiten"}</DialogTitle>
          <DialogDescription>
            Wähle Grundstrukturen und/oder Fokusstrukturen für diese Lesson. HSK begrenzt den Pool.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pr-1">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-muted-foreground text-xs">Titel</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={generatedTitle}
              className="border-border/60 bg-background h-8 rounded-md border px-2.5 text-sm outline-none"
            />
          </label>

          <div className="flex flex-wrap items-center gap-3">
            <fieldset
              className="border-border/60 text-muted-foreground flex items-center rounded-md border p-0.5 text-sm"
              aria-label="Chinese character set"
            >
              {(["simplified", "traditional"] as const).map((script) => (
                <label key={script} className="cursor-pointer">
                  <input
                    type="radio"
                    name="lesson-chinese-script"
                    value={script}
                    checked={config.chineseScript === script}
                    onChange={() =>
                      setConfig((current) => ({
                        ...current,
                        chineseScript: script as ChineseScript,
                      }))
                    }
                    className="peer sr-only"
                  />
                  <span className="hover:text-foreground peer-checked:bg-accent peer-checked:text-foreground flex size-6 items-center justify-center rounded-sm">
                    {script === "simplified" ? "简" : "繁"}
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.showPinyin}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, showPinyin: event.target.checked }))
                }
                className="border-border/60 accent-foreground size-3.5 rounded-sm"
              />
              <span>拼音</span>
            </label>
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.showGrammarTips}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, showGrammarTips: event.target.checked }))
                }
                className="border-border/60 accent-foreground size-3.5 rounded-sm"
              />
              <span>语法</span>
            </label>
            <label className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="checkbox"
                checked={config.useAnkiVocab}
                onChange={(event) =>
                  setConfig((current) => ({ ...current, useAnkiVocab: event.target.checked }))
                }
                className="border-border/60 accent-foreground size-3.5 rounded-sm"
              />
              <span>Anki-Vokabeln</span>
            </label>
          </div>

          <SentenceLengthSlider
            value={config.sentenceLength}
            onChange={(sentenceLength) => setConfig((current) => ({ ...current, sentenceLength }))}
          />

          {loading ? (
            <p className="text-muted-foreground text-sm">Lade Grammatikstrukturen…</p>
          ) : error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : (
            <StructurePicker
              structures={structures}
              enabledHskLevels={config.enabledHskLevels}
              enabledRoles={config.enabledRoles}
              enabledFamilies={config.enabledFamilies}
              excludedStructureIds={config.excludedStructureIds}
              onMaxHskChange={handleMaxHskChange}
              onToggleRole={handleToggleRole}
              onToggleFamily={handleToggleFamily}
              onToggleStructure={handleToggleStructure}
            />
          )}
        </div>

        <DialogFooter className="shrink-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Abbrechen
          </Button>
          <Button type="button" onClick={handleSave} disabled={!canSave}>
            {mode === "create" ? "Lesson starten" : "Speichern"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
