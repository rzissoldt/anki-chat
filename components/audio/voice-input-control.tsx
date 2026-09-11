"use client";

import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { type ApiDictationAdapter, type DictationUiState } from "@/lib/stt/dictation-adapter";
import { ComposerPrimitive } from "@assistant-ui/react";
import { MicIcon, SquareIcon } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

const SERVER_STATE: DictationUiState = {
  phase: "idle",
  error: null,
  completedTranscriptions: 0,
};

function formatElapsed(seconds: number) {
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

export function VoiceInputControl({
  adapter,
  disabled,
  onError,
}: {
  adapter: ApiDictationAdapter;
  disabled?: boolean;
  onError?: (message: string | null) => void;
}) {
  const state = useSyncExternalStore(adapter.subscribe, adapter.getState, () => SERVER_STATE);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    onError?.(state.error);
  }, [onError, state.error]);

  useEffect(() => {
    if (state.phase !== "recording") {
      setElapsed(0);
      return;
    }

    const timer = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state.phase]);

  if (state.phase === "recording") {
    return (
      <div className="flex items-center gap-1.5" role="status" aria-label="Recording voice input">
        <span className="bg-destructive size-2 animate-pulse rounded-full motion-reduce:animate-none" />
        <span className="text-destructive text-xs font-medium tabular-nums">
          {formatElapsed(elapsed)}
        </span>
        <ComposerPrimitive.StopDictation asChild>
          <Button
            type="button"
            size="icon"
            variant="destructive"
            className="size-8 rounded-full"
            aria-label="Stop voice input"
          >
            <SquareIcon className="size-3 fill-current" />
          </Button>
        </ComposerPrimitive.StopDictation>
      </div>
    );
  }

  if (state.phase === "transcribing") {
    return (
      <span className="text-muted-foreground px-1 text-xs" role="status">
        Transcribing…
      </span>
    );
  }

  return (
    <ComposerPrimitive.Dictate asChild>
      <TooltipIconButton
        tooltip="Voice input"
        side="bottom"
        type="button"
        variant="ghost"
        size="icon"
        disabled={disabled}
        className="text-muted-foreground hover:text-foreground size-8 rounded-full"
        aria-label="Start voice input"
      >
        <MicIcon className="size-4" />
      </TooltipIconButton>
    </ComposerPrimitive.Dictate>
  );
}
