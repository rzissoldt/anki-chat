import { describe, expect, it } from "vitest";
import {
  annotateReverseText,
  indexKeys,
  lookupVariants,
  reverseKeys,
} from "@/lib/dictionary/reverse-gloss";
import type { DictionaryEntry } from "@/lib/dictionary/cedict";

const tea: DictionaryEntry = {
  traditional: "茶",
  simplified: "茶",
  pinyin: "cha2",
  definitions: ["Tee"],
};
const drink: DictionaryEntry = {
  traditional: "喝",
  simplified: "喝",
  pinyin: "he1",
  definitions: ["trinken"],
};
const home: DictionaryEntry = {
  traditional: "家",
  simplified: "家",
  pinyin: "jia1",
  definitions: ["nach Hause", "Heim", "Familie"],
};
const like: DictionaryEntry = {
  traditional: "喜歡",
  simplified: "喜欢",
  pinyin: "xi3 huan5",
  definitions: ["to like", "gern haben"],
};

describe("reverseKeys", () => {
  it("keeps short German and English glosses", () => {
    expect(reverseKeys("Tee")).toEqual(["tee"]);
    expect(reverseKeys("to like")).toEqual(["like"]);
    expect(reverseKeys("gern haben; mögen")).toEqual(["gern haben", "mögen"]);
  });

  it("drops articles and POS markup", () => {
    expect(reverseKeys("der Tee (N)")).toEqual(["tee"]);
    expect(reverseKeys("etw. trinken")).toEqual(["trinken"]);
    expect(reverseKeys("the")).toEqual([]);
  });
});

describe("indexKeys", () => {
  it("adds an infinitive stem for -en verbs", () => {
    expect(indexKeys("trinken")).toEqual(["trinken", "trink"]);
  });
});

describe("lookupVariants", () => {
  it("strips common German endings and umlauts", () => {
    expect(lookupVariants("Häuser")).toContain("haus");
    expect(lookupVariants("trinke")).toContain("trink");
  });

  it("does not treat ge- participles as the adjective stem", () => {
    expect(lookupVariants("getrunken")).not.toContain("trunken");
  });
});

describe("annotateReverseText", () => {
  const byGloss = new Map<string, DictionaryEntry[]>();
  for (const entry of [tea, drink, home, like]) {
    for (const definition of entry.definitions) {
      for (const key of indexKeys(definition)) {
        const existing = byGloss.get(key) ?? [];
        existing.push(entry);
        byGloss.set(key, existing);
      }
    }
  }
  const lookup = (key: string) => byGloss.get(key);

  it("matches words and multi-word glosses", () => {
    expect(annotateReverseText("Ich gehe nach Hause.", lookup).map((item) => item.surface)).toEqual(
      ["nach Hause"],
    );
    expect(annotateReverseText("Tee trinken", lookup)).toEqual([
      {
        surface: "Tee",
        start: 0,
        end: 3,
        pinyin: "cha2",
        definitions: ["茶"],
      },
      {
        surface: "trinken",
        start: 4,
        end: 11,
        pinyin: "he1",
        definitions: ["喝"],
      },
    ]);
  });

  it("uses a verb stem for inflected forms", () => {
    const annotated = annotateReverseText("Ich trinke Tee.", lookup);
    expect(annotated.map((item) => item.surface)).toEqual(["trinke", "Tee"]);
    expect(annotated[0].definitions).toEqual(["喝"]);
  });

  it("returns Chinese lemmas for English glosses", () => {
    expect(annotateReverseText("I like tea.", lookup).map((item) => item.definitions[0])).toEqual([
      "喜欢",
    ]);
  });
});
