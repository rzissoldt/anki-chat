import { describe, expect, it } from "vitest";
import { CedictDictionary, cleanDefinition, parseCedictLine } from "@/lib/dictionary/cedict";

const entries = [
  {
    traditional: "我",
    simplified: "我",
    pinyin: "wo3",
    definitions: ["I", "me"],
  },
  {
    traditional: "喜歡",
    simplified: "喜欢",
    pinyin: "xi3 huan5",
    definitions: ["to like"],
  },
  {
    traditional: "中國",
    simplified: "中国",
    pinyin: "Zhong1 guo2",
    definitions: ["China"],
  },
  {
    traditional: "中國人",
    simplified: "中国人",
    pinyin: "Zhong1 guo2 ren2",
    definitions: ["Chinese person"],
  },
  {
    traditional: "今天",
    simplified: "今天",
    pinyin: "jin1 tian1",
    definitions: ["today"],
  },
  {
    traditional: "天氣",
    simplified: "天气",
    pinyin: "tian1 qi4",
    definitions: ["weather"],
  },
];

describe("CC-CEDICT", () => {
  it("parses dictionary lines and ignores comments", () => {
    expect(parseCedictLine("中國 中国 [Zhong1 guo2] /China/Middle Kingdom/")).toEqual({
      traditional: "中國",
      simplified: "中国",
      pinyin: "Zhong1 guo2",
      definitions: ["China", "Middle Kingdom"],
    });
    expect(parseCedictLine("# comment")).toBeNull();
  });

  it("strips HanDeDict example clauses from definitions", () => {
    expect(
      cleanDefinition(
        "gern haben; mögen; lieben (V); Bsp.: 我喜歡音樂。 我喜欢音乐。 -- Ich habe Musik gern.",
      ),
    ).toBe("gern haben; mögen; lieben (V)");
  });

  it("segments Chinese with jieba and looks up CEDICT entries", () => {
    const dictionary = new CedictDictionary(entries);

    expect(dictionary.annotate("我喜欢中国。")).toEqual([
      {
        surface: "我",
        start: 0,
        end: 1,
        pinyin: "wo3",
        definitions: ["I", "me"],
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
    ]);
  });

  it("falls back to dictionary longest-match for unknown jieba compounds", () => {
    const dictionary = new CedictDictionary(entries);
    const annotated = dictionary.annotate("今天天气");

    expect(annotated.map((item) => item.surface)).toEqual(["今天", "天气"]);
  });

  it("indexes simplified and traditional spellings", () => {
    const dictionary = new CedictDictionary(entries);

    expect(dictionary.lookup("喜欢")[0].traditional).toBe("喜歡");
    expect(dictionary.lookup("喜歡")[0].simplified).toBe("喜欢");
  });

  it("reverse-looks up German glosses as Chinese annotations", () => {
    const dictionary = new CedictDictionary([
      ...entries,
      {
        traditional: "茶",
        simplified: "茶",
        pinyin: "cha2",
        definitions: ["Tee"],
      },
    ]);

    expect(dictionary.annotateReverse("Bitte Tee trinken.")).toEqual([
      {
        surface: "Tee",
        start: 6,
        end: 9,
        pinyin: "cha2",
        definitions: ["茶"],
      },
    ]);
  });

  it("limits reverse lookup to the given spans", () => {
    const dictionary = new CedictDictionary([
      {
        traditional: "茶",
        simplified: "茶",
        pinyin: "cha2",
        definitions: ["Tee"],
      },
    ]);

    expect(
      dictionary
        .annotateReverse("Tee bitte. Tee nochmal.", [{ start: 0, end: 10 }])
        .map((item) => item.start),
    ).toEqual([0]);
  });
});
