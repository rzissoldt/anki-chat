import { afterEach, describe, expect, it, vi } from "vitest";
import { proxySpeechToText } from "@/lib/stt/client";
import { proxyTextToSpeech } from "@/lib/tts/client";
import type { ServerConfig } from "@/lib/config";

const baseConfig: ServerConfig = {
  chat: {
    url: "http://localhost:8001/v1/chat/completions",
    baseUrl: "http://localhost:8001/v1",
    model: "qwen38-chat",
    enableThinking: false,
    authHeader: "Authorization",
    authScheme: "Bearer",
    maxSteps: 10,
    maxContext: 12_000,
  },
  mcp: {
    timeoutMs: 15_000,
    enabled: false,
  },
  stt: {
    url: "http://localhost:8001/v1/audio/transcriptions",
    apiKey: "stt-key",
    model: "whisper-large-v3",
    language: "zh",
    protocol: "openai-compatible",
    timeoutMs: 5000,
    maxBytes: 1024 * 1024,
    enabled: true,
  },
  tts: {
    url: "http://localhost:8006/v1/audio/speech",
    apiKey: "tts-key",
    voice: "vivian",
    language: "Chinese",
    taskType: "CustomVoice",
    format: "wav",
    protocol: "openai-compatible",
    timeoutMs: 5000,
    maxChars: 100,
    enabled: true,
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("STT proxy client", () => {
  it("rejects missing files by size", async () => {
    const empty = new File([], "empty.webm", { type: "audio/webm" });
    await expect(proxySpeechToText(empty, baseConfig)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("forwards multipart and normalizes text", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.headers).toMatchObject({
        Authorization: "Bearer stt-key",
      });
      const form = init?.body as FormData;
      expect(form.get("model")).toBe("whisper-large-v3");
      expect(form.get("language")).toBe("zh");
      return new Response(JSON.stringify({ text: " 你好 " }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    const file = new File([new Uint8Array([1, 2, 3])], "a.webm", {
      type: "audio/webm",
    });
    await expect(proxySpeechToText(file, baseConfig)).resolves.toEqual({
      text: "你好",
    });
  });

  it("maps upstream failures", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("nope", { status: 500 })),
    );
    const file = new File([new Uint8Array([1])], "a.webm");
    await expect(proxySpeechToText(file, baseConfig)).rejects.toMatchObject({
      status: 500,
    });
  });
});

describe("TTS proxy client", () => {
  it("rejects empty text", async () => {
    await expect(proxyTextToSpeech("   ", baseConfig)).rejects.toMatchObject({
      status: 400,
    });
  });

  it("forwards the Qwen3-TTS request and returns audio bytes", async () => {
    const bytes = new Uint8Array([9, 8, 7]);
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(JSON.parse(String(init?.body))).toEqual({
        input: "你好",
        voice: "vivian",
        language: "Chinese",
        task_type: "CustomVoice",
        response_format: "wav",
      });
      return new Response(bytes, {
        status: 200,
        headers: { "Content-Type": "audio/wav" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await proxyTextToSpeech("你好", baseConfig);
    expect(result.contentType).toBe("audio/wav");
    expect(new Uint8Array(result.body)).toEqual(bytes);
  });
});
