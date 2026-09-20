import { describe, expect, it, vi } from "vitest";
import { applyLessonTools } from "@/lib/lessons/tools";

describe("applyLessonTools", () => {
  const frame = { execute: vi.fn(async (input: unknown) => input) };
  const focus = { execute: vi.fn(async (input: unknown) => input) };
  const vocab = { execute: vi.fn() };
  const related = { execute: vi.fn() };
  const inspect = { execute: vi.fn() };
  const record = { execute: vi.fn() };

  const tools = {
    sample_sentence_frame: frame,
    sample_focus_structure: focus,
    sample_vocabulary: vocab,
    find_related_vocabulary: related,
    inspect_vocabulary: inspect,
    record_practice_evaluation: record,
  };

  it("leaves tools unchanged outside a lesson", () => {
    expect(applyLessonTools(tools, null)).toBe(tools);
  });

  it("pins frame and focus allowlists and drops empty pools", async () => {
    const next = applyLessonTools(tools, {
      useAnkiVocab: true,
      structureIds: [4, 8, 9],
      frameIds: [4, 8],
      focusIds: [9],
    });
    const wrappedFrame = next.sample_sentence_frame as {
      execute: (input: unknown) => Promise<unknown>;
    };
    const wrappedFocus = next.sample_focus_structure as {
      execute: (input: unknown) => Promise<unknown>;
    };
    await wrappedFrame.execute({ max_hsk_level: 3, count: 2 });
    await wrappedFocus.execute({ max_hsk_level: 3, count: 1 });
    expect(frame.execute).toHaveBeenCalledWith(
      { max_hsk_level: 3, count: 2, ids: [4, 8] },
      undefined,
    );
    expect(focus.execute).toHaveBeenCalledWith(
      { max_hsk_level: 3, count: 1, ids: [9] },
      undefined,
    );
    expect(next.sample_vocabulary).toBe(vocab);
  });

  it("removes focus tool when the focus pool is empty", () => {
    const next = applyLessonTools(tools, {
      useAnkiVocab: true,
      structureIds: [1],
      frameIds: [1],
      focusIds: [],
    });
    expect(next.sample_sentence_frame).toBeDefined();
    expect(next.sample_focus_structure).toBeUndefined();
  });

  it("drops Anki vocabulary tools when anki is off", () => {
    const next = applyLessonTools(tools, {
      useAnkiVocab: false,
      structureIds: [1],
      frameIds: [1],
      focusIds: [],
    });
    expect(next.sample_vocabulary).toBeUndefined();
    expect(next.find_related_vocabulary).toBeUndefined();
    expect(next.inspect_vocabulary).toBeUndefined();
    expect(next.record_practice_evaluation).toBe(record);
  });
});
