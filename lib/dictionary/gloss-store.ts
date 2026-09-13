"use client";

import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";
import type { GlossLanguage } from "@/lib/dictionary/language";
import { create } from "zustand";

type GlossCacheEntry = {
  text: string;
  lang: GlossLanguage;
  segments: DictionaryAnnotation[];
  status: "loading" | "ready" | "error";
  requestId: number;
};

type GlossStore = {
  messages: Record<string, GlossCacheEntry>;
  byText: Record<string, GlossCacheEntry>;
  getGloss: (messageId: string, text?: string, lang?: GlossLanguage) => GlossCacheEntry | undefined;
  annotateMessage: (
    messageId: string,
    text: string,
    lang: GlossLanguage,
    signal?: AbortSignal,
  ) => Promise<void>;
};

let nextRequestId = 1;

function textKey(lang: GlossLanguage, text: string) {
  return `${lang}:${text}`;
}

export const useGlossStore = create<GlossStore>((set, get) => ({
  messages: {},
  byText: {},

  getGloss(messageId, text, lang) {
    const byId = get().messages[messageId];
    if (byId && (!lang || byId.lang === lang) && (!text || byId.text === text)) return byId;
    if (text && lang) return get().byText[textKey(lang, text)];
    return undefined;
  },

  async annotateMessage(messageId, text, lang, signal) {
    const cached = get().getGloss(messageId, text, lang);
    if (cached?.text === text && cached.lang === lang && cached.status === "ready") {
      const current = get().messages[messageId];
      if (!current || current.lang !== lang || current.text !== text || current !== cached) {
        set((state) => ({
          messages: { ...state.messages, [messageId]: cached },
        }));
      }
      return;
    }

    const requestId = nextRequestId++;
    const loadingEntry: GlossCacheEntry = {
      text,
      lang,
      segments: [],
      status: "loading",
      requestId,
    };
    set((state) => ({
      messages: { ...state.messages, [messageId]: loadingEntry },
      byText: { ...state.byText, [textKey(lang, text)]: loadingEntry },
    }));

    try {
      const response = await fetch("/api/dictionary/annotate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, lang }),
        signal,
      });
      if (!response.ok) throw new Error(`Dictionary request failed with ${response.status}`);

      const payload = (await response.json()) as {
        segments: DictionaryAnnotation[];
      };

      const current = get().messages[messageId];
      if (
        !current ||
        current.requestId !== requestId ||
        current.text !== text ||
        current.lang !== lang
      ) {
        return;
      }

      const readyEntry: GlossCacheEntry = {
        text,
        lang,
        segments: payload.segments,
        status: "ready",
        requestId,
      };
      set((state) => ({
        messages: { ...state.messages, [messageId]: readyEntry },
        byText: { ...state.byText, [textKey(lang, text)]: readyEntry },
      }));
    } catch (error) {
      const current = get().messages[messageId];
      if (!current || current.requestId !== requestId) return;

      if (signal?.aborted) {
        set((state) => {
          if (state.messages[messageId]?.requestId !== requestId) return state;
          const { [messageId]: _removed, ...messages } = state.messages;
          const byText = { ...state.byText };
          if (byText[textKey(lang, text)]?.requestId === requestId) {
            delete byText[textKey(lang, text)];
          }
          return { messages, byText };
        });
        return;
      }

      console.error("Could not annotate assistant message:", error);
      const errorEntry: GlossCacheEntry = {
        text,
        lang,
        segments: [],
        status: "error",
        requestId,
      };
      set((state) => ({
        messages: { ...state.messages, [messageId]: errorEntry },
        byText: { ...state.byText, [textKey(lang, text)]: errorEntry },
      }));
    }
  },
}));
