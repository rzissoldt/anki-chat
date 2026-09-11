import { describe, expect, it } from "vitest";
import { detectGlossLanguage, glossLanguageFromNavigator } from "@/lib/dictionary/language";

describe("detectGlossLanguage", () => {
  it("detects German from umlauts and function words", () => {
    expect(detectGlossLanguage(["Bitte übersetze den Satz auf Deutsch."])).toBe("de");
  });

  it("detects English from common function words", () => {
    expect(detectGlossLanguage(["Please translate the sentence into English."])).toBe("en");
  });

  it("ignores Chinese text and uses the Latin parts", () => {
    expect(detectGlossLanguage(["今天天气很好。 Das ist richtig."])).toBe("de");
  });

  it("falls back when there is no signal", () => {
    expect(detectGlossLanguage([], "de")).toBe("de");
    expect(detectGlossLanguage(["123 !!!"], "en")).toBe("en");
  });
});

describe("glossLanguageFromNavigator", () => {
  it("maps de-* locales to German", () => {
    expect(glossLanguageFromNavigator("de-DE")).toBe("de");
    expect(glossLanguageFromNavigator("en-US")).toBe("en");
  });
});
