"use client";

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useThreadTokenUsage } from "@assistant-ui/ai-sdk";
import { useAuiState } from "@assistant-ui/react";
import { useMemo, type FC } from "react";

export type ContextUsageProps = {
  maxContext: number;
};

type ContextExtras = {
  contextTokens?: number;
  agentSteps?: number;
  toolCallCount?: number;
};

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function asPositiveInt(value: unknown): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
  return Math.floor(value);
}

function readExtras(metadata: unknown): ContextExtras | undefined {
  const record = asRecord(metadata);
  if (!record) return undefined;
  const custom = asRecord(record.custom) ?? record;
  const contextTokens = asPositiveInt(custom.contextTokens);
  const agentSteps = asPositiveInt(custom.agentSteps);
  const toolCallCount = asPositiveInt(custom.toolCallCount);
  if (contextTokens === undefined && agentSteps === undefined && toolCallCount === undefined) {
    return undefined;
  }
  return { contextTokens, agentSteps, toolCallCount };
}

function formatTokens(value: number | undefined): string {
  if (value === undefined) return "—";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 10_000) return `${Math.round(value / 1_000)}k`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}k`;
  return value.toLocaleString();
}

function usageColor(percent: number): string {
  if (percent >= 90) return "stroke-destructive text-destructive";
  if (percent >= 75) return "stroke-amber-500 text-amber-500";
  return "stroke-foreground/70 text-muted-foreground";
}

function UsageRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="text-background/70">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}

export const ContextUsageIndicator: FC<ContextUsageProps> = ({ maxContext }) => {
  const usage = useThreadTokenUsage();
  // Select a store-stable metadata reference — never a fresh object literal.
  const latestMetadata = useAuiState((s) => {
    for (let index = s.thread.messages.length - 1; index >= 0; index -= 1) {
      const message = s.thread.messages[index];
      if (message?.role !== "assistant") continue;
      if (readExtras(message.metadata)) return message.metadata;
    }
    return undefined;
  });
  const extras = useMemo(() => readExtras(latestMetadata), [latestMetadata]);

  // Window fill = last model step input tokens only (not turn totals).
  const contextUsed = extras?.contextTokens;
  const percent =
    contextUsed !== undefined && maxContext > 0
      ? Math.min(100, Math.round((contextUsed / maxContext) * 100))
      : 0;
  const hasWindow = contextUsed !== undefined;
  const hasTurnUsage = Boolean(usage);

  const radius = 10;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (percent / 100) * circumference;
  const colorClass = usageColor(percent);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger
          type="button"
          className={cn(
            "aui-context-usage inline-flex size-8 items-center justify-center rounded-full transition-opacity hover:opacity-80",
            colorClass,
          )}
          aria-label={`Context usage ${percent}%`}
        >
          <svg width="28" height="28" viewBox="0 0 28 28" className="-rotate-90" aria-hidden="true">
            <circle
              cx="14"
              cy="14"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              className="opacity-20"
            />
            <circle
              cx="14"
              cy="14"
              r={radius}
              fill="none"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={cn(colorClass)}
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
            />
          </svg>
          <span className="sr-only">
            {formatTokens(contextUsed)} of {formatTokens(maxContext)} tokens
          </span>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="bg-foreground text-background flex w-52 flex-col gap-1.5 px-3 py-2.5 text-xs"
        >
          <div className="mb-0.5 flex items-center justify-between gap-4 font-medium">
            <span>Context</span>
            <span className="tabular-nums">{hasWindow ? `${percent}%` : "—"}</span>
          </div>
          <UsageRow
            label="Window"
            value={`${formatTokens(contextUsed)} / ${formatTokens(maxContext)}`}
          />
          {hasTurnUsage ? (
            <>
              <UsageRow label="Turn input" value={formatTokens(usage?.inputTokens)} />
              <UsageRow label="Turn output" value={formatTokens(usage?.outputTokens)} />
              {usage?.reasoningTokens !== undefined ? (
                <UsageRow label="Reasoning" value={formatTokens(usage.reasoningTokens)} />
              ) : null}
              {usage?.cachedInputTokens !== undefined ? (
                <UsageRow label="Cached" value={formatTokens(usage.cachedInputTokens)} />
              ) : null}
              <UsageRow label="Turn total" value={formatTokens(usage?.totalTokens)} />
            </>
          ) : null}
          {extras?.toolCallCount !== undefined ? (
            <UsageRow label="Tool calls" value={String(extras.toolCallCount)} />
          ) : null}
          {extras?.agentSteps !== undefined && extras.agentSteps > 0 ? (
            <UsageRow label="Agent steps" value={String(extras.agentSteps)} />
          ) : null}
          {!hasWindow && !hasTurnUsage ? (
            <p className="text-background/70">Token usage appears after the first reply.</p>
          ) : null}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
