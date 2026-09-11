"use client";

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuiState } from "@assistant-ui/react";
import { BrainIcon, ChevronDownIcon } from "lucide-react";
import { useEffect, useState, type FC } from "react";

export const Reasoning: FC = () => {
  const part = useAuiState((s) => {
    if (s.part.type !== "reasoning") return null;
    return s.part;
  });
  const text = part?.text ?? "";
  const running = part?.status?.type === "running";
  const [open, setOpen] = useState(running);

  useEffect(() => {
    if (running) setOpen(true);
  }, [running]);

  if (!text.trim()) return null;

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border/60 bg-muted/30 mb-3 w-full max-w-full rounded-xl border"
    >
      <CollapsibleTrigger className="text-muted-foreground hover:text-foreground flex w-full items-center gap-2 px-3 py-2 text-sm">
        <BrainIcon className="size-4 shrink-0" />
        <span className={cn(running && "shimmer")}>Thinking</span>
        <ChevronDownIcon
          className={cn("ml-auto size-4 transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border/40 max-h-64 overflow-auto border-t px-3 py-2">
        <pre className="text-muted-foreground whitespace-pre-wrap font-sans text-sm leading-relaxed">
          {text}
        </pre>
      </CollapsibleContent>
    </Collapsible>
  );
};
