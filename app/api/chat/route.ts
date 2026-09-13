import { getServerConfig } from "@/lib/config";
import { createVllmModel } from "@/lib/ai/vllm";
import {
  hasPracticeSamplingCall,
  prunePracticeContext,
  stripHistoricalToolPayloads,
} from "@/lib/chat/prune-practice-context";
import { DEFAULT_HSK_LEVEL, isHskLevel, type HskLevel } from "@/lib/hsk-level";
import { connectMcp } from "@/lib/mcp/client";
import { systemPrompt } from "@/lib/system-prompt";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ClientChatBody = {
  messages?: UIMessage[];
  chineseScript?: unknown;
  hskLevel?: unknown;
};

type ChineseScript = "simplified" | "traditional";

function prependUserControls(
  messages: UIMessage[],
  script: ChineseScript,
  hskLevel: HskLevel,
): UIMessage[] {
  const lastUserMessageIndex = messages.findLastIndex((message) => message.role === "user");

  return messages.map((message, index) =>
    index === lastUserMessageIndex
      ? {
          ...message,
          parts: [
            { type: "text" as const, text: script },
            { type: "text" as const, text: `hsk-max: ${hskLevel}` },
            ...message.parts,
          ],
        }
      : message,
  );
}

export async function POST(req: Request) {
  let body: ClientChatBody;
  try {
    body = (await req.json()) as ClientChatBody;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return Response.json({ error: "messages are required" }, { status: 400 });
  }

  const chineseScript = body.chineseScript ?? "simplified";
  if (chineseScript !== "simplified" && chineseScript !== "traditional") {
    return Response.json({ error: "Invalid Chinese script" }, { status: 400 });
  }

  const hskLevel = body.hskLevel ?? DEFAULT_HSK_LEVEL;
  if (!isHskLevel(hskLevel)) {
    return Response.json({ error: "Invalid HSK level" }, { status: 400 });
  }

  let mcp: Awaited<ReturnType<typeof connectMcp>> = null;

  try {
    const config = getServerConfig();
    const model = createVllmModel(config);
    mcp = await connectMcp(config, req.signal);
    const tools = mcp?.tools ?? {};

    let closed = false;
    const closeMcp = async () => {
      if (closed) return;
      closed = true;
      await mcp?.client.close().catch((error) => {
        console.error("Failed to close MCP client:", error);
      });
    };

    const result = streamText({
      model,
      system: systemPrompt,
      messages: await convertToModelMessages(
        prependUserControls(prunePracticeContext(body.messages), chineseScript, hskLevel),
      ),
      tools,
      stopWhen: stepCountIs(config.chat.maxSteps),
      prepareStep({ steps, initialMessages, responseMessages }) {
        if (!hasPracticeSamplingCall(steps)) return undefined;

        return {
          // Drop completed-round tool payloads immediately inside this request.
          // Keep lightweight chat text plus every call/result used to build the
          // new sentence in the current response.
          messages: [...stripHistoricalToolPayloads(initialMessages), ...responseMessages],
        };
      },
      abortSignal: req.signal,
      onEnd: closeMcp,
      onAbort: closeMcp,
      onError({ error }) {
        console.error("Agent stream failed:", error);
      },
    });

    let lastStepUsage: LanguageModelUsage | undefined;
    let stepCount = 0;
    let toolCallCount = 0;

    const stream = toUIMessageStream({
      stream: result.stream,
      tools,
      originalMessages: body.messages,
      sendReasoning: true,
      messageMetadata: ({ part }) => {
        if (part.type === "finish-step") {
          lastStepUsage = part.usage;
          stepCount += 1;
          return undefined;
        }

        if (part.type === "tool-call") {
          toolCallCount += 1;
          return undefined;
        }

        if (part.type === "finish") {
          return {
            usage: part.totalUsage,
            contextTokens: lastStepUsage?.inputTokens ?? part.totalUsage.inputTokens,
            // Avoid reserved assistant-ui key `steps` (expects ThreadStep[]).
            agentSteps: stepCount,
            toolCallCount,
          };
        }
      },
      onError(error) {
        console.error("Agent UI stream failed:", error);
        return "The agent could not complete this request.";
      },
      onEnd: closeMcp,
    });

    return createUIMessageStreamResponse({ stream });
  } catch (error) {
    await mcp?.client.close().catch(() => undefined);
    const detail = error instanceof Error ? error.message : String(error);
    console.error("Agent setup failed:", detail);
    return Response.json(
      { error: "The model or MCP service is currently unavailable." },
      { status: 502 },
    );
  }
}
