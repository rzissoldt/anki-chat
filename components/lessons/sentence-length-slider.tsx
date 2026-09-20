"use client";

import {
  SENTENCE_LENGTH_LABELS_DE,
  SENTENCE_LENGTHS,
  type SentenceLength,
} from "@/lib/lessons/types";
import { cn } from "@/lib/utils";

type SentenceLengthSliderProps = {
  value: SentenceLength;
  onChange: (value: SentenceLength) => void;
  disabled?: boolean;
  compact?: boolean;
};

export function SentenceLengthSlider({
  value,
  onChange,
  disabled = false,
  compact = false,
}: SentenceLengthSliderProps) {
  const index = Math.max(0, SENTENCE_LENGTHS.indexOf(value));

  return (
    <div
      className={cn("flex flex-col", compact ? "min-w-36 gap-0.5" : "max-w-xs gap-1")}
      role="group"
      aria-label="Satzlänge"
      title="Satzlänge der Übungssätze"
    >
      {compact ? null : <span className="text-muted-foreground text-xs">Satzlänge</span>}
      <input
        type="range"
        min={0}
        max={SENTENCE_LENGTHS.length - 1}
        step={1}
        value={index}
        disabled={disabled}
        aria-label="Satzlänge"
        aria-valuetext={SENTENCE_LENGTH_LABELS_DE[value]}
        onChange={(event) => {
          const next = SENTENCE_LENGTHS[Number(event.target.value)];
          if (next) onChange(next);
        }}
        className="accent-foreground h-5 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
      />
      <div className="text-muted-foreground flex justify-between gap-1 text-xs">
        {SENTENCE_LENGTHS.map((length) => (
          <button
            key={length}
            type="button"
            disabled={disabled}
            onClick={() => onChange(length)}
            className={cn(
              "hover:text-foreground cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
              length === value && "text-foreground font-medium",
            )}
          >
            {SENTENCE_LENGTH_LABELS_DE[length]}
          </button>
        ))}
      </div>
    </div>
  );
}
