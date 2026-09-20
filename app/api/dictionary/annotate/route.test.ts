import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDictionary, annotate, annotateContextualGlosses } = vi.hoisted(() => ({
  getDictionary: vi.fn(),
  annotate: vi.fn(),
  annotateContextualGlosses: vi.fn(),
}));

vi.mock("@/lib/dictionary/cedict", () => ({ getDictionary }));
vi.mock("@/lib/dictionary/contextual-gloss", () => ({ annotateContextualGlosses }));

import { POST } from "./route";

describe("POST /api/dictionary/annotate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    annotate.mockReturnValue([
      {
        surface: "茶",
        start: 0,
        end: 1,
        pinyin: "cha2",
        definitions: ["Tee"],
      },
    ]);
    annotateContextualGlosses.mockResolvedValue([
      {
        surface: "Tee",
        start: 12,
        end: 15,
        pinyin: "chá",
        definitions: ["茶"],
      },
    ]);
    getDictionary.mockResolvedValue({ annotate });
  });

  it("merges Chinese dictionary segments with contextual L1 glosses", async () => {
    const text = "1. Ich will Tee. — <grammar-hint>wollen mit 想</grammar-hint>";
    const request = new Request("http://localhost/api/dictionary/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "de" }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lang: "de",
      segments: [
        {
          surface: "茶",
          start: 0,
          end: 1,
          pinyin: "cha2",
          definitions: ["Tee"],
        },
        {
          surface: "Tee",
          start: 12,
          end: 15,
          pinyin: "chá",
          definitions: ["茶"],
        },
      ],
    });
    expect(getDictionary).toHaveBeenCalledWith("de");
    expect(annotate).toHaveBeenCalledWith(text);
    expect(annotateContextualGlosses).toHaveBeenCalledWith(
      text,
      [{ start: 3, end: 16 }],
      "de",
      request.signal,
    );
  });

  it("skips the LLM path when there are no production practice spans", async () => {
    const text = "1. **我喝茶。** — <grammar-hint>einfacher Aussagesatz</grammar-hint>";
    annotate.mockReturnValue([
      {
        surface: "我",
        start: 5,
        end: 6,
        pinyin: "wo3",
        definitions: ["I"],
      },
    ]);
    annotateContextualGlosses.mockResolvedValue([]);

    const request = new Request("http://localhost/api/dictionary/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: "de" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(annotateContextualGlosses).toHaveBeenCalledWith(text, [], "de", request.signal);
  });

  it("rejects invalid requests", async () => {
    const request = new Request("http://localhost/api/dictionary/annotate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(annotateContextualGlosses).not.toHaveBeenCalled();
  });
});
