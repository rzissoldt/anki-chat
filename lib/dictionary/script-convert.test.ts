import { describe, expect, it } from "vitest";
import { convertChineseScript } from "@/lib/dictionary/script-convert";

describe("script convert (OpenCC)", () => {
  it("converts simplified to Taiwan traditional without variant junk", () => {
    expect(convertChineseScript("他看起来不太高兴，只是没有分享这个消息", "traditional")).toBe(
      "他看起來不太高興，只是沒有分享這個消息",
    );
    expect(
      convertChineseScript("只有他的家族还崇拜祖先，他才觉得自己还有根。", "traditional"),
    ).toBe("只有他的家族還崇拜祖先，他才覺得自己還有根。");
  });

  it("keeps aspect 了 and converts compounds with phrase context", () => {
    expect(convertChineseScript("他喝了酒以后一点儿也不清醒。了解情况。", "traditional")).toBe(
      "他喝了酒以後一點兒也不清醒。瞭解情況。",
    );
  });

  it("converts traditional back to simplified", () => {
    expect(convertChineseScript("我喜歡中國", "simplified")).toBe("我喜欢中国");
  });

  it("leaves Latin, punctuation, and digits untouched", () => {
    const input = "Hello, 我喜欢中国! HSK 4 — 100%.";
    expect(convertChineseScript(input, "traditional")).toBe("Hello, 我喜歡中國! HSK 4 — 100%.");
  });

  it("is stable when text is already in the target script", () => {
    expect(convertChineseScript("我喜歡中國", "traditional")).toBe("我喜歡中國");
    expect(convertChineseScript("我喜欢中国", "simplified")).toBe("我喜欢中国");
  });
});
