import { describe, expect, it } from "vitest";
import {
  annotateSentences,
  extractChineseSentences,
  findEnclosingSentence,
} from "@/lib/dictionary/sentences";

describe("extractChineseSentences", () => {
  it("extracts Chinese sentences and keeps punctuation", () => {
    expect(extractChineseSentences("Translate this: 我喜欢中国。 More text")).toEqual([
      { surface: "我喜欢中国。", start: 16, end: 22 },
    ]);
  });

  it("supports multiple sentences and traditional characters", () => {
    const text = "今天天气很好！你呢？\nJīntiān tiānqì hěn hǎo!";
    expect(extractChineseSentences(text)).toEqual([
      { surface: "今天天气很好！", start: 0, end: 7 },
      { surface: "你呢？", start: 7, end: 10 },
    ]);
  });

  it("attaches dictionary words to each sentence", () => {
    const text = "我喜欢中国。";
    const words = [
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

    expect(annotateSentences(text, words)).toEqual([
      {
        surface: "我喜欢中国。",
        start: 0,
        end: 6,
        words,
      },
    ]);
  });

  it("finds the enclosing sentence for a word span", () => {
    const sentences = annotateSentences("我喜欢中国。", []);
    expect(findEnclosingSentence(sentences, 1, 3)?.surface).toBe("我喜欢中国。");
  });
});
