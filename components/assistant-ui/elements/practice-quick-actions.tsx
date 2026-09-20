"use client";

import { useMemo, useCallback, type FC } from "react";
import { useAui, useAuiState } from "@assistant-ui/react";
import { ArrowRightIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { detectPracticeState } from "@/lib/chat/practice-state";
import { selectActiveLesson, useLessonStore } from "@/lib/lessons/store";

export const PracticeQuickActions: FC = () => {
  const aui = useAui();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const composerText = useAuiState((s) => s.composer.text);
  const messages = useAuiState((s) => s.thread.messages);

  const practiceState = useMemo(() => detectPracticeState(messages), [messages]);
  const useAnkiVocab = useLessonStore((s) => selectActiveLesson(s)?.config.useAnkiVocab ?? true);

  const withAnki = useCallback(
    (prompt: string) =>
      useAnkiVocab
        ? prompt
        : prompt.replace(" mit Anki-Vokabeln", " ohne Anki-Vokabeln, mit Alltagsvokabeln"),
    [useAnkiVocab],
  );

  const handleSendPrompt = useCallback(
    (promptText: string) => {
      const { isRunning: running, capabilities } = aui.thread.getState();
      if (running && !capabilities.queue) return;

      aui.thread.append({
        content: [{ type: "text", text: promptText }],
        runConfig: aui.composer.getState().runConfig,
      });
      aui.composer.setText("");
    },
    [aui],
  );

  // Auto-hide when thread is running or user has started typing their translation/message
  if (isRunning || composerText.trim().length > 0) {
    return null;
  }

  const {
    hasPracticeSession,
    continuePrompt,
    startChineseToGermanPrompt,
    startGermanToChinesePrompt,
  } = practiceState;

  return (
    <div
      data-slot="aui_practice-quick-actions"
      className="flex items-center gap-1.5 overflow-x-auto border-b border-border/40 px-1 pt-0.5 pb-1.5 mb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden text-xs"
      aria-label="Übungs-Schnellaktionen"
    >
      {hasPracticeSession ? (
        <>
          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => handleSendPrompt(withAnki(continuePrompt))}
            className="h-6.5 gap-1 rounded-full px-2.5 font-medium shadow-xs hover:bg-secondary/80 shrink-0"
            title={continuePrompt}
          >
            <span>Weiter</span>
            <ArrowRightIcon className="size-3 text-muted-foreground" />
          </Button>

          <div className="h-3.5 w-px bg-border/60 mx-0.5 shrink-0" aria-hidden="true" />

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleSendPrompt(withAnki(startChineseToGermanPrompt))}
            className="h-6.5 gap-1 rounded-full px-2 text-muted-foreground hover:text-foreground shrink-0 text-[0.75rem]"
            title="5 Sätze Chinesisch → Deutsch starten"
          >
            <span>Chinesisch → Deutsch</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="xs"
            onClick={() => handleSendPrompt(withAnki(startGermanToChinesePrompt))}
            className="h-6.5 gap-1 rounded-full px-2 text-muted-foreground hover:text-foreground shrink-0 text-[0.75rem]"
            title="5 Sätze Deutsch → Chinesisch starten"
          >
            <span>Deutsch → Chinesisch</span>
          </Button>
        </>
      ) : (
        <>
          <span className="text-muted-foreground text-[0.75rem] pl-1 pr-0.5 shrink-0 select-none font-medium">
            Schnellstart:
          </span>

          <Button
            type="button"
            variant="secondary"
            size="xs"
            onClick={() => handleSendPrompt(withAnki(startChineseToGermanPrompt))}
            className="h-6.5 gap-1 rounded-full px-2.5 font-medium shadow-xs shrink-0 text-[0.75rem]"
            title="5 Sätze Chinesisch → Deutsch starten"
          >
            <span>Chinesisch → Deutsch</span>
          </Button>

          <Button
            type="button"
            variant="outline"
            size="xs"
            onClick={() => handleSendPrompt(withAnki(startGermanToChinesePrompt))}
            className="h-6.5 gap-1 rounded-full border-border/70 px-2.5 text-muted-foreground hover:text-foreground shrink-0 text-[0.75rem]"
            title="5 Sätze Deutsch → Chinesisch starten"
          >
            <span>Deutsch → Chinesisch</span>
          </Button>
        </>
      )}
    </div>
  );
};
