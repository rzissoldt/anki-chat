import { describe, expect, it } from "vitest";
import {
  addThinkingConfig,
  createVllmModel,
  shouldInjectThinkingKwargs,
} from "@/lib/ai/vllm";
import type { ServerConfig } from "@/lib/config";

const baseConfig = {
  chat: {
    baseUrl: "http://localhost:8001/v1",
    model: "qwen38-chat",
    enableThinking: true,
    authHeader: "Authorization",
    authScheme: "Bearer",
    maxSteps: 10,
    maxContext: 12_000,
  },
  mcp: { enabled: false, timeoutMs: 15_000 },
  stats: { enabled: false },
  stt: {
    enabled: false,
    protocol: "openai-compatible",
    timeoutMs: 60_000,
    maxBytes: 1,
  },
  tts: {
    enabled: false,
    format: "mp3",
    protocol: "openai-compatible",
    timeoutMs: 60_000,
    maxChars: 4_000,
  },
} as ServerConfig;

describe("shouldInjectThinkingKwargs", () => {
  it("injects for local vLLM base URLs", () => {
    expect(shouldInjectThinkingKwargs("http://localhost:8001/v1")).toBe(true);
  });

  it("skips Gemini OpenAI-compatible host", () => {
    expect(
      shouldInjectThinkingKwargs("https://generativelanguage.googleapis.com/v1beta/openai"),
    ).toBe(false);
  });
});

describe("addThinkingConfig", () => {
  it("disables Qwen thinking through vLLM chat template kwargs", () => {
    expect(addThinkingConfig({ stream: true }, false)).toEqual({
      stream: true,
      chat_template_kwargs: {
        enable_thinking: false,
      },
    });
  });

  it("preserves other chat template kwargs", () => {
    expect(addThinkingConfig({ chat_template_kwargs: { custom_option: "value" } }, true)).toEqual({
      chat_template_kwargs: {
        custom_option: "value",
        enable_thinking: true,
      },
    });
  });
});

describe("createVllmModel", () => {
  it("creates a chat model for the configured id", () => {
    const model = createVllmModel(baseConfig);
    expect(model.modelId).toBe("qwen38-chat");
  });

  it("allows forcing thinking off for structured gloss calls", () => {
    expect(() => createVllmModel(baseConfig, { enableThinking: false })).not.toThrow();
  });
});
