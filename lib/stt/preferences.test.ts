import { describe, expect, it, vi } from "vitest";
import {
  readSttAutoSend,
  STT_AUTO_SEND_STORAGE_KEY,
  writeSttAutoSend,
} from "@/lib/stt/preferences";

describe("STT auto-send preference", () => {
  it("round-trips through browser storage", () => {
    const values = new Map<string, string>();
    const storage = {
      getItem: vi.fn((key: string) => values.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => values.set(key, value)),
    };

    expect(readSttAutoSend(storage)).toBe(false);

    writeSttAutoSend(storage, true);
    expect(values.get(STT_AUTO_SEND_STORAGE_KEY)).toBe("true");
    expect(readSttAutoSend(storage)).toBe(true);

    writeSttAutoSend(storage, false);
    expect(readSttAutoSend(storage)).toBe(false);
  });
});
