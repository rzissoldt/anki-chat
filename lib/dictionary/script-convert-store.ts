"use client";

import type { ChineseScript } from "@/lib/dictionary/script-convert";
import { create } from "zustand";

type ScriptConvertStatus = "idle" | "loading" | "ready" | "error";

type ScriptConvertStore = {
  status: ScriptConvertStatus;
  ensureLoaded: () => Promise<void>;
  convert: (text: string, script: ChineseScript) => string;
};

let convertFn: ((text: string, script: ChineseScript) => string) | undefined;
let loadPromise: Promise<void> | undefined;

/**
 * OpenCC ships its dictionaries in the JS bundle. We lazy-import so the chat
 * shell can boot without pulling conversion tables until needed.
 * Conversion is applied after streaming finishes (and immediately on 简/繁 toggle).
 */
export const useScriptConvertStore = create<ScriptConvertStore>((set, get) => ({
  status: "idle",

  async ensureLoaded() {
    if (get().status === "ready") return;
    if (loadPromise) return loadPromise;

    set({ status: "loading" });
    loadPromise = (async () => {
      try {
        const mod = await import("@/lib/dictionary/script-convert");
        convertFn = mod.convertChineseScript;
        set({ status: "ready" });
      } catch (error) {
        console.error("Failed to load OpenCC script converter:", error);
        convertFn = undefined;
        loadPromise = undefined;
        set({ status: "error" });
      }
    })();

    return loadPromise;
  },

  convert(text, script) {
    if (!convertFn || get().status !== "ready") return text;
    return convertFn(text, script);
  },
}));
