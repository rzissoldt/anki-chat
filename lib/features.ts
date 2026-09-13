"use client";

import { useEffect, useState } from "react";

export type ClientFeatures = {
  stt: boolean;
  tts: boolean;
  reasoning: boolean;
  toolCalls: boolean;
  appName: string;
  maxContext: number;
};

const DEFAULT_MAX_CONTEXT = Number.parseInt(
  process.env.NEXT_PUBLIC_CHAT_MAX_CONTEXT || "12000",
  10,
);

const DEFAULT_FEATURES: ClientFeatures = {
  stt: false,
  tts: false,
  reasoning: process.env.NEXT_PUBLIC_ENABLE_REASONING !== "false",
  toolCalls: process.env.NEXT_PUBLIC_ENABLE_TOOL_CALLS !== "false",
  appName: process.env.NEXT_PUBLIC_APP_NAME || "Anki Chat",
  maxContext:
    Number.isFinite(DEFAULT_MAX_CONTEXT) && DEFAULT_MAX_CONTEXT > 0 ? DEFAULT_MAX_CONTEXT : 12_000,
};

export function useClientFeatures() {
  const [features, setFeatures] = useState<ClientFeatures>(DEFAULT_FEATURES);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/health")
      .then((response) => response.json())
      .then((data: { features?: Partial<ClientFeatures> & { maxContext?: number } }) => {
        if (cancelled) return;
        setFeatures((prev) => ({
          ...prev,
          stt: Boolean(data.features?.stt),
          tts: Boolean(data.features?.tts),
          reasoning:
            data.features?.reasoning ?? process.env.NEXT_PUBLIC_ENABLE_REASONING !== "false",
          toolCalls:
            data.features?.toolCalls ?? process.env.NEXT_PUBLIC_ENABLE_TOOL_CALLS !== "false",
          maxContext:
            typeof data.features?.maxContext === "number" && data.features.maxContext > 0
              ? data.features.maxContext
              : prev.maxContext,
        }));
      })
      .catch(() => {
        /* keep defaults */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return features;
}
