import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  close,
  connectMcp,
  createVllmModel,
  streamText,
  convertToModelMessages,
  stepCountIs,
  toUIMessageStream,
  createUIMessageStreamResponse,
} = vi.hoisted(() => ({
  close: vi.fn(async () => undefined),
  connectMcp: vi.fn(),
  createVllmModel: vi.fn(() => ({ modelId: "qwen38-chat" })),
  streamText: vi.fn(),
  convertToModelMessages: vi.fn(async (messages) => messages),
  stepCountIs: vi.fn((steps: number) => ({ steps })),
  toUIMessageStream: vi.fn(() => new ReadableStream()),
  createUIMessageStreamResponse: vi.fn(() => new Response("stream")),
}));

vi.mock("@/lib/config", () => ({
  getServerConfig: () => ({
    chat: {
      url: "http://localhost:8001/v1/chat/completions",
      baseUrl: "http://localhost:8001/v1",
      model: "qwen38-chat",
      authHeader: "Authorization",
      authScheme: "Bearer",
      maxSteps: 10,
      maxContext: 32_768,
    },
    mcp: {
      url: "http://localhost:8002/mcp",
      timeoutMs: 15_000,
      enabled: true,
    },
  }),
}));

vi.mock("@/lib/ai/vllm", () => ({ createVllmModel }));
vi.mock("@/lib/mcp/client", () => ({ connectMcp }));
vi.mock("ai", () => ({
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
}));

import { POST } from "./route";

describe("POST /api/chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    connectMcp.mockResolvedValue({
      client: { close },
      tools: { lookup_word: { execute: vi.fn() } },
    });
    streamText.mockReturnValue({ stream: new ReadableStream() });
  });

  it("wires MCP tools and the bounded multi-step loop into streamText", async () => {
    const messages = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "Use the vocabulary tool" }],
      },
    ];
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, chineseScript: "traditional", hskLevel: 4 }),
    });

    const response = await POST(request);

    expect(response.status).toBe(200);
    expect(connectMcp).toHaveBeenCalledOnce();
    expect(convertToModelMessages).toHaveBeenCalledWith([
      {
        ...messages[0],
        parts: [
          { type: "text", text: "traditional" },
          { type: "text", text: "hsk-max: 4" },
          { type: "text", text: "pinyin: on" },
          { type: "text", text: "Use the vocabulary tool" },
        ],
      },
    ]);
    expect(messages[0]?.parts).toEqual([{ type: "text", text: "Use the vocabulary tool" }]);
    expect(stepCountIs).toHaveBeenCalledWith(10);
    expect(streamText).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Du bist ein Chinesischlehrer für Übersetzungsübungen"),
        tools: expect.objectContaining({ lookup_word: expect.anything() }),
        stopWhen: { steps: 10 },
        abortSignal: request.signal,
      }),
    );
    expect(toUIMessageStream).toHaveBeenCalledWith(
      expect.objectContaining({
        messageMetadata: expect.any(Function),
        sendReasoning: true,
      }),
    );

    const streamCall = vi.mocked(toUIMessageStream).mock.calls.at(0)?.at(0) as
      | { messageMetadata?: (args: { part: unknown }) => unknown }
      | undefined;
    expect(streamCall?.messageMetadata).toEqual(expect.any(Function));
    expect(
      streamCall?.messageMetadata?.({
        part: {
          type: "finish",
          totalUsage: {
            inputTokens: 100,
            outputTokens: 20,
            totalTokens: 120,
            inputTokenDetails: {
              noCacheTokens: 100,
              cacheReadTokens: undefined,
              cacheWriteTokens: undefined,
            },
            outputTokenDetails: { textTokens: 20, reasoningTokens: undefined },
          },
        },
      }),
    ).toEqual(
      expect.objectContaining({
        usage: expect.objectContaining({ totalTokens: 120 }),
        contextTokens: 100,
        agentSteps: 0,
        toolCallCount: 0,
      }),
    );

    const options = streamText.mock.calls[0]?.[0];
    await options.onEnd();
    await options.onAbort();
    expect(close).toHaveBeenCalledOnce();
  });

  it("returns a safe error when MCP connection setup fails", async () => {
    connectMcp.mockRejectedValueOnce(new Error("private MCP detail"));
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        messages: [
          {
            id: "user-1",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
          },
        ],
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(502);
    await expect(response.json()).resolves.toEqual({
      error: "The model or MCP service is currently unavailable.",
    });
  });

  it("rejects empty message arrays", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(400);
  });

  it("rejects an invalid Chinese script", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
        chineseScript: "both",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(connectMcp).not.toHaveBeenCalled();
  });

  it("rejects an invalid HSK level", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
        hskLevel: 7,
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(connectMcp).not.toHaveBeenCalled();
  });

  it("rejects an invalid pinyin setting", async () => {
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({
        messages: [{ id: "user-1", role: "user", parts: [{ type: "text", text: "hello" }] }],
        showPinyin: "maybe",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    expect(connectMcp).not.toHaveBeenCalled();
  });

  it("prepends pinyin: off when showPinyin is false", async () => {
    const messages = [
      {
        id: "user-1",
        role: "user",
        parts: [{ type: "text", text: "next sentence" }],
      },
    ];
    const request = new Request("http://localhost/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages, showPinyin: false }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(convertToModelMessages).toHaveBeenCalledWith([
      {
        ...messages[0],
        parts: [
          { type: "text", text: "simplified" },
          { type: "text", text: "hsk-max: 3" },
          { type: "text", text: "pinyin: off" },
          { type: "text", text: "next sentence" },
        ],
      },
    ]);
  });
});
