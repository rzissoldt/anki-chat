import { beforeEach, describe, expect, it, vi } from "vitest";

const { generateObject, createVllmModel, getServerConfig } = vi.hoisted(() => ({
  generateObject: vi.fn(),
  createVllmModel: vi.fn(() => ({ modelId: "qwen38-chat" })),
  getServerConfig: vi.fn(() => ({
    chat: {
      baseUrl: "http://localhost:8001/v1",
      model: "qwen38-chat",
      enableThinking: true,
    },
  })),
}));

vi.mock("ai", () => ({ generateObject }));
vi.mock("@/lib/ai/vllm", () => ({ createVllmModel }));
vi.mock("@/lib/config", () => ({ getServerConfig }));

import { annotateContextualGlosses } from "@/lib/dictionary/contextual-gloss";

describe("annotateContextualGlosses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns [] when there are no practice spans", async () => {
    await expect(annotateContextualGlosses("Hallo.", [], "de")).resolves.toEqual([]);
    expect(generateObject).not.toHaveBeenCalled();
  });

  it("calls generateObject with thinking forced off and aligns glosses", async () => {
    const text = "1. Ich habe Tee getrunken. — <grammar-hint>Vergangenheit mit 了</grammar-hint>";
    const spans = [{ start: 3, end: 26 }];
    generateObject.mockResolvedValue({
      object: {
        sentences: [
          {
            text: "Ich habe Tee getrunken.",
            glosses: [
              { surface: "Tee", zh: "茶", pinyin: "chá" },
              { surface: "getrunken", zh: "喝了", pinyin: "hē le" },
            ],
          },
        ],
      },
    });

    const annotations = await annotateContextualGlosses(text, spans, "de");

    expect(createVllmModel).toHaveBeenCalledWith(expect.anything(), {
      enableThinking: false,
      supportsStructuredOutputs: true,
    });
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        schemaName: "contextual_glosses",
        temperature: 0,
      }),
    );
    expect(annotations).toEqual([
      {
        surface: "Tee",
        start: 12,
        end: 15,
        pinyin: "chá",
        definitions: ["茶"],
      },
      {
        surface: "getrunken",
        start: 16,
        end: 25,
        pinyin: "hē le",
        definitions: ["喝了"],
      },
    ]);
  });

  it("returns [] when the model call fails (no reverse-dict fallback)", async () => {
    generateObject.mockRejectedValue(new Error("vLLM unavailable"));
    await expect(
      annotateContextualGlosses(
        "Tee. — <grammar-hint>x</grammar-hint>",
        [{ start: 0, end: 4 }],
        "de",
      ),
    ).resolves.toEqual([]);
  });
});
