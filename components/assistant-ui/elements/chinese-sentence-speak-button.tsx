"use client";

import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import {
  getSentencePlaybackSnapshot,
  speakChineseSentence,
  stopChineseSentenceSpeech,
  subscribeSentencePlayback,
} from "@/lib/tts/playback";
import { cn } from "@/lib/utils";
import { LoaderCircleIcon, SquareIcon, Volume2Icon } from "lucide-react";
import { useSyncExternalStore, type FC } from "react";

export const ChineseSentenceSpeakButton: FC<{ text: string }> = ({ text }) => {
  const playback = useSyncExternalStore(subscribeSentencePlayback, getSentencePlaybackSnapshot);
  const isActive = playback.text === text && playback.status !== "idle";
  const isStarting = isActive && playback.status === "starting";
  const isRunning = isActive && playback.status === "running";

  return (
    <TooltipIconButton
      tooltip={isActive ? "Stop speaking" : "Speak sentence"}
      side="top"
      className={cn(
        "text-muted-foreground hover:text-foreground ms-0.5 inline-flex size-4 align-text-bottom",
        isActive && "text-foreground",
      )}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (isActive) {
          stopChineseSentenceSpeech();
          return;
        }
        speakChineseSentence(text);
      }}
    >
      {isStarting ? (
        <LoaderCircleIcon className="size-3.5 animate-spin" />
      ) : isRunning ? (
        <SquareIcon className="size-3 fill-current" />
      ) : (
        <Volume2Icon className="size-3.5" />
      )}
    </TooltipIconButton>
  );
};
