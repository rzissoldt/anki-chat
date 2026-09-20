import { describe, expect, it } from "vitest";
import {
  detectPracticeState,
  inferPracticeDirectionFromUserText,
  resolvePracticeDirectionForModel,
} from "./practice-state";

describe("inferPracticeDirectionFromUserText", () => {
  it("reads Weiter and Schnellstart production cues", () => {
    expect(
      inferPracticeDirectionFromUserText(
        "Weiter (wieder 4 Sätze, Deutsch → Chinesisch: deutsche Sätze vorgeben)",
      ),
    ).toBe("production");
    expect(
      inferPracticeDirectionFromUserText(
        "Starte Übersetzung: 5 Sätze Deutsch → Chinesisch (Produktionsmodus: gib mir 5 deutsche Sätze zum Übersetzen ins Chinesische) mit Anki-Vokabeln",
      ),
    ).toBe("production");
  });

  it("reads recognition cues", () => {
    expect(
      inferPracticeDirectionFromUserText(
        "Weiter (Chinesisch → Deutsch: chinesische Sätze vorgeben)",
      ),
    ).toBe("recognition");
  });
});

describe("resolvePracticeDirectionForModel", () => {
  it("prefers explicit user direction over mistaken Chinese-only practice round", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "1. **他在写。** <grammar-hint>进行态</grammar-hint>",
          },
        ],
      },
      {
        role: "user",
        parts: [
          {
            type: "text",
            text: "Weiter (wieder 4 Sätze, Deutsch → Chinesisch: deutsche Sätze vorgeben)",
          },
        ],
      },
    ];

    expect(resolvePracticeDirectionForModel(messages)).toBe("production");
  });

  it("falls back to last evaluation mode when user message has no direction cue", () => {
    const messages = [
      {
        role: "assistant",
        parts: [{ type: "text", text: "1. Geh nach Hause." }],
      },
      { role: "user", parts: [{ type: "text", text: "回家吧" }] },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolName: "record_practice_evaluation",
            args: { mode: "production" },
          },
        ],
      },
      { role: "user", parts: [{ type: "text", text: "回家吧" }] },
    ];

    expect(resolvePracticeDirectionForModel(messages)).toBe("production");
  });
});

describe("detectPracticeState", () => {
  it("handles empty or new conversation", () => {
    const state = detectPracticeState([]);
    expect(state.hasPracticeSession).toBe(false);
    expect(state.hasEvaluatedRound).toBe(false);
    expect(state.batchCount).toBe(5);
    expect(state.direction).toBeNull();
    expect(state.grammarHint).toBeNull();
    expect(state.continuePrompt).toBe("Weiter (wieder 5 Sätze)");
    expect(state.repeatGrammarPrompt).toBeNull();
    expect(state.startChineseToGermanPrompt).toContain("5 Sätze Chinesisch → Deutsch");
    expect(state.startGermanToChinesePrompt).toContain("5 Sätze Deutsch → Chinesisch");
  });

  it("detects single evaluated sentence recognition mode", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "**我喝咖啡。**\n<grammar-hint>einfacher Aussagesatz</grammar-hint>",
          },
        ],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "Ich trinke Kaffee." }],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolName: "record_practice_evaluation",
            args: { mode: "recognition", source_text: "我喝咖啡。" },
          },
          { type: "text", text: "Sehr gut! Alles richtig." },
        ],
      },
    ];

    const state = detectPracticeState(messages);
    expect(state.hasPracticeSession).toBe(true);
    expect(state.hasEvaluatedRound).toBe(true);
    expect(state.batchCount).toBe(1);
    expect(state.direction).toBe("recognition");
    expect(state.grammarHint).toBe("einfacher Aussagesatz");
    expect(state.continuePrompt).toBe("Weiter (Chinesisch → Deutsch: chinesische Sätze vorgeben)");
    expect(state.repeatGrammarPrompt).toBe(
      "Nochmal mit gleicher Grammatik (einfacher Aussagesatz)",
    );
  });

  it("detects batch of 3 evaluated sentences in production mode", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "1. Satz A\n<grammar-hint>Vergleich mit 比</grammar-hint>\n2. Satz B\n3. Satz C",
          },
        ],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "1. Antwort A\n2. Antwort B\n3. Antwort C" }],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "tool-call",
            toolName: "record_practice_evaluation",
            args: { mode: "production" },
          },
          {
            type: "tool-call",
            toolName: "record_practice_evaluation",
            args: { mode: "production" },
          },
          {
            type: "tool-call",
            toolName: "record_practice_evaluation",
            args: { mode: "production" },
          },
          { type: "text", text: "Alle drei Sätze bewertet!" },
        ],
      },
    ];

    const state = detectPracticeState(messages);
    expect(state.hasPracticeSession).toBe(true);
    expect(state.hasEvaluatedRound).toBe(true);
    expect(state.batchCount).toBe(3);
    expect(state.direction).toBe("production");
    expect(state.grammarHint).toBe("Vergleich mit 比");
    expect(state.continuePrompt).toBe(
      "Weiter (wieder 3 Sätze, Deutsch → Chinesisch: deutsche Sätze vorgeben)",
    );
    expect(state.repeatGrammarPrompt).toBe(
      "Nochmal mit gleicher Grammatik (Vergleich mit 比) (wieder 3 Sätze)",
    );
  });

  it("supports dynamic-tool parts and multiple rounds by taking the latest", () => {
    const messages = [
      // Round 1: Recognition batch 1
      {
        role: "assistant",
        parts: [{ type: "text", text: "**你好**\n<grammar-hint>Grußformel</grammar-hint>" }],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "Hallo" }],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "record_practice_evaluation",
            input: { mode: "recognition" },
          },
        ],
      },
      // Round 2: Production batch 2
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "1. Geh nach Hause.\n<grammar-hint>Imperativ mit 吧</grammar-hint>\n2. Komm her.",
          },
        ],
      },
      {
        role: "user",
        parts: [{ type: "text", text: "1. 回家吧 2. 过来" }],
      },
      {
        role: "assistant",
        parts: [
          {
            type: "dynamic-tool",
            toolName: "record_practice_evaluation",
            input: { mode: "production" },
          },
          {
            type: "dynamic-tool",
            toolName: "record_practice_evaluation",
            input: { mode: "production" },
          },
        ],
      },
    ];

    const state = detectPracticeState(messages);
    expect(state.hasPracticeSession).toBe(true);
    expect(state.hasEvaluatedRound).toBe(true);
    expect(state.batchCount).toBe(2);
    expect(state.direction).toBe("production");
    expect(state.grammarHint).toBe("Imperativ mit 吧");
    expect(state.continuePrompt).toBe(
      "Weiter (wieder 2 Sätze, Deutsch → Chinesisch: deutsche Sätze vorgeben)",
    );
  });

  it("detects batch count and direction before evaluation when practice sentences are presented", () => {
    const messages = [
      {
        role: "assistant",
        parts: [
          {
            type: "text",
            text: "1. **他去商店。** <grammar-hint>Struktur 1</grammar-hint>\n2. **我买苹果。** <grammar-hint>Struktur 2</grammar-hint>",
          },
        ],
      },
    ];

    const state = detectPracticeState(messages);
    expect(state.hasPracticeSession).toBe(true);
    expect(state.hasEvaluatedRound).toBe(false);
    expect(state.batchCount).toBe(2);
    expect(state.direction).toBe("recognition");
    expect(state.grammarHint).toBe("Struktur 1, Struktur 2");
    expect(state.continuePrompt).toBe(
      "Weiter (wieder 2 Sätze, Chinesisch → Deutsch: chinesische Sätze vorgeben)",
    );
  });
});
