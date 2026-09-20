import { describe, expect, it } from "vitest";
import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";
import {
  buildTonePinyin,
  getPlainText,
  isChineseDominantLine,
  syllableToToneMarks,
  toToneMarks,
} from "@/lib/dictionary/pinyin";

describe("syllableToToneMarks", () => {
  it("applies tones on the correct vowel", () => {
    expect(syllableToToneMarks("Zhong1")).toBe("Zhōng");
    expect(syllableToToneMarks("guo2")).toBe("guó");
    expect(syllableToToneMarks("xi3")).toBe("xǐ");
    expect(syllableToToneMarks("hao3")).toBe("hǎo");
    expect(syllableToToneMarks("liu2")).toBe("liú");
  });

  it("maps v and u: to ü and drops neutral tone marks", () => {
    expect(syllableToToneMarks("nv3")).toBe("nǚ");
    expect(syllableToToneMarks("lu:4")).toBe("lǜ");
    expect(syllableToToneMarks("huan5")).toBe("huan");
  });
});

describe("toToneMarks", () => {
  it("converts multi-syllable CEDICT pinyin", () => {
    expect(toToneMarks("Zhong1 guo2")).toBe("Zhōng guó");
    expect(toToneMarks("xi3 huan5")).toBe("xǐ huan");
  });
});

describe("isChineseDominantLine", () => {
  it("accepts practice sentences and rejects mixed prose", () => {
    expect(isChineseDominantLine("他打算坐火车去北京。")).toBe(true);
    expect(isChineseDominantLine("Übersetze den Satz **中国** bitte.")).toBe(false);
    expect(isChineseDominantLine("我")).toBe(false);
  });
});

describe("getPlainText", () => {
  it("skips italic grammar-hint nodes so tip wording does not spoil Chinese detection", () => {
    const children = [
      { props: { children: "如果明天下雨，我就不去公园。" } },
      " — ",
      {
        type: "em",
        props: {
          children: "Bedingung mit 如果 … 就",
        },
      },
    ];
    const plain = getPlainText(children);
    expect(plain).toBe("如果明天下雨，我就不去公园。 — ");
    expect(isChineseDominantLine(plain)).toBe(true);
  });
});

describe("buildTonePinyin", () => {
  const segments: DictionaryAnnotation[] = [
    {
      surface: "我",
      start: 0,
      end: 1,
      pinyin: "wo3",
      definitions: ["I"],
    },
    {
      surface: "喜欢",
      start: 1,
      end: 3,
      pinyin: "xi3 huan5",
      definitions: ["to like"],
    },
    {
      surface: "中国",
      start: 3,
      end: 5,
      pinyin: "Zhong1 guo2",
      definitions: ["China"],
    },
  ];

  it("builds a tone-mark line with punctuation attached", () => {
    expect(buildTonePinyin("我喜欢中国。", segments)).toBe("wǒ xǐ huan Zhōng guó。");
  });

  it("returns null without matches", () => {
    expect(buildTonePinyin("你好。", [])).toBeNull();
    expect(buildTonePinyin("你好。", segments)).toBeNull();
  });
});
