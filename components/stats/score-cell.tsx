import { formatDisplayScore } from "@/lib/stats/types";
import { cn } from "@/lib/utils";

export function ScoreCell({
  normalizedScore,
  className,
}: {
  normalizedScore: number;
  className?: string;
}) {
  const display = formatDisplayScore(normalizedScore);
  const tone =
    normalizedScore < 0.4
      ? "text-destructive"
      : normalizedScore < 0.7
        ? "text-amber-500"
        : "text-emerald-500";

  return (
    <span
      className={cn("font-mono tabular-nums", tone, className)}
      title={`Score ${normalizedScore.toFixed(3)} (0–1)`}
    >
      {display}
    </span>
  );
}
