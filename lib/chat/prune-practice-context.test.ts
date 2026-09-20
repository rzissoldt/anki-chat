import { describe, expect, it } from "vitest";
import type { ModelMessage, UIMessage } from "ai";
import {
  hasPracticeSamplingCall,
  prunePracticeContext,
  stripHistoricalToolPayloads,
} from "./prune-practice-context";

function textMessage(id: string, role: "user" | "assistant", text: string): UIMessage {
  return { id, role, parts: [{ type: "text", text }] };
}

function toolMessage(id: string, toolName: string): UIMessage {
  return {
    id,
    role: "assistant",
    parts: [
      {
        type: "dynamic-tool",
        toolName,
        toolCallId: `${id}-${toolName}`,
        state: "output-available",
        input: {},
        output: { ok: true },
      },
    ],
  };
}

describe("prunePracticeContext", () => {
  it("leaves messages without practice tools unchanged", () => {
    const messages = [textMessage("u1", "user", "hello"), textMessage("a1", "assistant", "hi")];
    expect(prunePracticeContext(messages)).toEqual(messages);
  });

  it("leaves the first unfinished practice round unchanged", () => {
    const messages = [
      textMessage("u1", "user", "start"),
      toolMessage("a1", "sample_vocabulary"),
      textMessage("a2", "assistant", "**你好**"),
      textMessage("u2", "user", "hello"),
    ];
    expect(prunePracticeContext(messages)).toEqual(messages);
  });

  it("keeps the evaluated round for post-eval follow-ups", () => {
    const messages = [
      textMessage("u0", "user", "intro chatter"),
      textMessage("a0", "assistant", "ok"),
      textMessage("u1", "user", "give me a sentence"),
      toolMessage("a1", "sample_sentence_frame"),
      toolMessage("a2", "sample_vocabulary"),
      textMessage("a3", "assistant", "**你好**"),
      textMessage("u2", "user", "hello"),
      toolMessage("a4", "record_practice_evaluation"),
      textMessage("a5", "assistant", "Good."),
      textMessage("u3", "user", "why was that wrong?"),
    ];

    const pruned = prunePracticeContext(messages);
    expect(pruned.map((m) => m.id)).toEqual(["u1", "a1", "a2", "a3", "u2", "a4", "a5", "u3"]);
  });

  it("drops the previous round once new sampling starts after an eval", () => {
    const messages = [
      textMessage("u1", "user", "first sentence please"),
      toolMessage("a1", "sample_vocabulary"),
      textMessage("a2", "assistant", "**第一句**"),
      textMessage("u2", "user", "first translation"),
      toolMessage("a3", "record_practice_evaluation"),
      textMessage("a4", "assistant", "Good."),
      textMessage("u3", "user", "next please"),
      toolMessage("a5", "sample_focus_structure"),
      toolMessage("a6", "sample_vocabulary"),
      textMessage("a7", "assistant", "**第二句**"),
      textMessage("u4", "user", "second translation"),
    ];

    const pruned = prunePracticeContext(messages);
    expect(pruned.map((m) => m.id)).toEqual(["u3", "a5", "a6", "a7", "u4"]);
  });

  it("does not prune while awaiting the next sentence after eval", () => {
    const messages = [
      textMessage("u1", "user", "sentence"),
      toolMessage("a1", "sample_vocabulary"),
      textMessage("a2", "assistant", "**句**"),
      textMessage("u2", "user", "translation"),
      toolMessage("a3", "record_practice_evaluation"),
      textMessage("a4", "assistant", "ok"),
      textMessage("u3", "user", "next please"),
    ];

    const pruned = prunePracticeContext(messages);
    expect(pruned.map((m) => m.id)).toEqual(["u1", "a1", "a2", "u2", "a3", "a4", "u3"]);
  });

  it("recognizes static tool-* part types", () => {
    const messages: UIMessage[] = [
      textMessage("old", "user", "old round"),
      textMessage("u1", "user", "next"),
      {
        id: "a1",
        role: "assistant",
        parts: [
          {
            type: "tool-sample_vocabulary",
            toolCallId: "c1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      } as UIMessage,
      textMessage("a2", "assistant", "**新**"),
    ];

    // No eval yet → unchanged
    expect(prunePracticeContext(messages)).toEqual(messages);

    const withEval: UIMessage[] = [
      textMessage("u0", "user", "prior"),
      {
        id: "eval",
        role: "assistant",
        parts: [
          {
            type: "tool-record_practice_evaluation",
            toolCallId: "e1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      } as UIMessage,
      textMessage("u1", "user", "next"),
      {
        id: "sample",
        role: "assistant",
        parts: [
          {
            type: "tool-sample_vocabulary",
            toolCallId: "s1",
            state: "output-available",
            input: {},
            output: {},
          },
        ],
      } as UIMessage,
      textMessage("a2", "assistant", "**新**"),
    ];

    expect(prunePracticeContext(withEval).map((m) => m.id)).toEqual(["u1", "sample", "a2"]);
  });

  it("detects sampling in completed stream steps", () => {
    expect(
      hasPracticeSamplingCall([
        { toolCalls: [{ toolName: "record_practice_evaluation" }] },
        { toolCalls: [{ toolName: "sample_vocabulary" }] },
      ]),
    ).toBe(true);
    expect(
      hasPracticeSamplingCall([{ toolCalls: [{ toolName: "find_related_vocabulary" }] }]),
    ).toBe(false);
  });

  it("strips historical tool payloads but retains conversation text", () => {
    const messages: ModelMessage[] = [
      { role: "user", content: "next sentence" },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Preparing a sentence." },
          {
            type: "tool-call",
            toolCallId: "old-call",
            toolName: "sample_vocabulary",
            input: {},
          },
        ],
      },
      {
        role: "tool",
        content: [
          {
            type: "tool-result",
            toolCallId: "old-call",
            toolName: "sample_vocabulary",
            output: { type: "json", value: { large: "payload" } },
          },
        ],
      },
    ];

    expect(stripHistoricalToolPayloads(messages)).toEqual([
      { role: "user", content: "next sentence" },
      {
        role: "assistant",
        content: [{ type: "text", text: "Preparing a sentence." }],
      },
    ]);
  });
});
