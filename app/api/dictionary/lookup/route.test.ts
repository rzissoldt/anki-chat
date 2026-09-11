import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDictionary, lookup } = vi.hoisted(() => ({
  getDictionary: vi.fn(),
  lookup: vi.fn(),
}));

vi.mock("@/lib/dictionary/cedict", () => ({ getDictionary }));

import { POST } from "./route";

describe("POST /api/dictionary/lookup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    lookup.mockImplementation((word: string) =>
      word === "中国"
        ? [
            {
              traditional: "中國",
              simplified: "中国",
              pinyin: "Zhong1 guo2",
              definitions: ["China"],
            },
          ]
        : [],
    );
    getDictionary.mockResolvedValue({ lookup });
  });

  it("looks up a deduplicated batch of words", async () => {
    const request = new Request("http://localhost/api/dictionary/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: ["中国", "未知", "中国"] }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      lang: "en",
      results: [
        {
          word: "中国",
          entries: [
            {
              traditional: "中國",
              simplified: "中国",
              pinyin: "Zhong1 guo2",
              definitions: ["China"],
            },
          ],
        },
        { word: "未知", entries: [] },
      ],
    });
    expect(getDictionary).toHaveBeenCalledWith("en");
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it("rejects invalid requests", async () => {
    const request = new Request("http://localhost/api/dictionary/lookup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ words: [] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
  });
});
