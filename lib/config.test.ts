import { describe, expect, it } from "vitest";
import { chatCompletionsUrlToBaseUrl } from "@/lib/config";

describe("chatCompletionsUrlToBaseUrl", () => {
  it("derives the provider base URL from a complete Chat Completions URL", () => {
    expect(chatCompletionsUrlToBaseUrl("http://192.168.178.149:8001/v1/chat/completions")).toBe(
      "http://192.168.178.149:8001/v1",
    );
  });

  it("accepts an existing base URL", () => {
    expect(chatCompletionsUrlToBaseUrl("http://localhost:8001/v1/")).toBe(
      "http://localhost:8001/v1",
    );
  });
});
