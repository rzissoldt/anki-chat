import { describe, expect, it } from "vitest";
import { hasHan, surfaceMatchesAt } from "@/lib/dictionary/text";

describe("hasHan", () => {
  it("detects Chinese characters", () => {
    expect(hasHan("茶")).toBe(true);
    expect(hasHan("Tee")).toBe(false);
  });
});

describe("surfaceMatchesAt", () => {
  it("matches Chinese by prefix", () => {
    expect(surfaceMatchesAt("中国", "中", 0)).toBe(true);
  });

  it("requires word boundaries for Latin surfaces", () => {
    expect(surfaceMatchesAt("Tee bitte", "Tee", 0)).toBe(true);
    expect(surfaceMatchesAt("Teenager", "Tee", 0)).toBe(false);
    expect(surfaceMatchesAt("nach Hause", "nach Hause", 0)).toBe(true);
  });
});
