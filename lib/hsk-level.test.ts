import { describe, expect, it } from "vitest";
import { catalogHskToUiBand, maxHskLevel } from "@/lib/hsk-level";

describe("catalogHskToUiBand", () => {
  it("keeps HSK 1–6 and collapses 7–9", () => {
    expect(catalogHskToUiBand(3)).toBe(3);
    expect(catalogHskToUiBand(7)).toBe(9);
    expect(catalogHskToUiBand(9)).toBe(9);
    expect(catalogHskToUiBand(0)).toBeNull();
  });
});

describe("maxHskLevel", () => {
  it("returns the highest enabled band", () => {
    expect(maxHskLevel([1, 3, 9])).toBe(9);
    expect(maxHskLevel([])).toBe(3);
  });
});
