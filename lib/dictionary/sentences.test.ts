import { describe, expect, it } from "vitest";
import {
  annotateSentences,
  extractChineseSentences,
  extractSpeakableChineseSentences,
  findEnclosingSentence,
  isSpeakableChineseSentence,
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

describe("speakable Chinese sentences", () => {
  it("accepts terminated sentences and rejects bare vocabulary", () => {
    expect(isSpeakableChineseSentence("我喜欢中国。")).toBe(true);
    expect(isSpeakableChineseSentence("你呢？")).toBe(true);
    expect(isSpeakableChineseSentence("中国")).toBe(false);
    expect(isSpeakableChineseSentence("好。")).toBe(false);
  });

  it("filters mixed text down to terminated Chinese sentences", () => {
    const text = "Word: 中国. Sentence: 我喜欢中国。 Also 你好！";
    expect(extractSpeakableChineseSentences(text).map((sentence) => sentence.surface)).toEqual([
      "我喜欢中国。",
      "你好！",
    ]);
  });

  it("keeps Chinese commas inside one speakable sentence", () => {
    const text = "主角是爸爸，为了看水手比赛，他不到五点就起床了。";
    expect(extractSpeakableChineseSentences(text)).toEqual([
      {
        surface: "主角是爸爸，为了看水手比赛，他不到五点就起床了。",
        start: 0,
        end: text.length,
      },
    ]);
  });
});
