import { getServerConfig } from "@/lib/config";
import { createVllmModel } from "@/lib/ai/vllm";
import {
  hasPracticeSamplingCall,
  prunePracticeContext,
  stripHistoricalToolPayloads,
} from "@/lib/chat/prune-practice-context";
import { resolvePracticeDirectionForModel } from "@/lib/chat/practice-state";
import { DEFAULT_HSK_LEVEL, isHskLevel, type HskLevel } from "@/lib/hsk-level";
import { applyLessonTools } from "@/lib/lessons/tools";
import { connectMcp } from "@/lib/mcp/client";
import { buildSystemPrompt } from "@/lib/system-prompt";
import {
  convertToModelMessages,
  createUIMessageStreamResponse,
  stepCountIs,
  streamText,
  toUIMessageStream,
  type LanguageModelUsage,
  type ToolSet,
  type UIMessage,
} from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type ClientChatBody = {
  messages?: UIMessage[];
  chineseScript?: unknown;
  hskLevel?: unknown;
  grammarTips?: unknown;
  lesson?: unknown;
  ankiVocab?: unknown;
  structureIds?: unknown;
  frameIds?: unknown;
  focusIds?: unknown;
};

type ChineseScript = "simplified" | "traditional";

function parseStructureIds(value: unknown): number[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return null;
  const ids: number[] = [];
  for (const item of value) {
    if (typeof item !== "number" || !Number.isInteger(item) || item < 1) return null;
    if (!ids.includes(item)) ids.push(item);
  }
  return ids;
}

function prependUserControls(
  messages: UIMessage[],
  script: ChineseScript,
  hskLevel: HskLevel,
  grammarTips: boolean,
  practiceMode: ReturnType<typeof resolvePracticeDirectionForModel>,
  lesson: { useAnkiVocab: boolean } | null,
): UIMessage[] {
  const lastUserMessageIndex = messages.findLastIndex((message) => message.role === "user");

  const controlParts: Array<{ type: "text"; text: string }> = [
    { type: "text", text: script },
    { type: "text", text: `hsk-max: ${hskLevel}` },
    { type: "text", text: `grammar-tips: ${grammarTips ? "on" : "off"}` },
  ];
  if (lesson) {
    controlParts.push({ type: "text", text: "lesson: on" });
    controlParts.push({ type: "text", text: `anki-vocab: ${lesson.useAnkiVocab ? "on" : "off"}` });
  }
  if (practiceMode) {
    controlParts.push({ type: "text", text: `practice-mode: ${practiceMode}` });
  }

  return messages.map((message, index) =>
    index === lastUserMessageIndex
      ? {
          ...message,
          parts: [...controlParts, ...message.parts],
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

  const grammarTips = body.grammarTips ?? true;
  if (typeof grammarTips !== "boolean") {
    return Response.json({ error: "Invalid grammarTips flag" }, { status: 400 });
  }

  const lessonEnabled = body.lesson ?? false;
  if (typeof lessonEnabled !== "boolean") {
    return Response.json({ error: "Invalid lesson flag" }, { status: 400 });
  }

  const ankiVocab = body.ankiVocab ?? true;
  if (typeof ankiVocab !== "boolean") {
    return Response.json({ error: "Invalid ankiVocab flag" }, { status: 400 });
  }

  const structureIds = parseStructureIds(body.structureIds);
  if (structureIds === null) {
    return Response.json({ error: "Invalid structureIds" }, { status: 400 });
  }

  const frameIds = parseStructureIds(body.frameIds);
  if (frameIds === null) {
    return Response.json({ error: "Invalid frameIds" }, { status: 400 });
  }

  const focusIds = parseStructureIds(body.focusIds);
  if (focusIds === null) {
    return Response.json({ error: "Invalid focusIds" }, { status: 400 });
  }

  if (lessonEnabled && structureIds.length === 0) {
    return Response.json({ error: "Lesson requires at least one structure id" }, { status: 400 });
  }

  const lesson = lessonEnabled
    ? {
        useAnkiVocab: ankiVocab,
        structureIds,
        frameIds,
        focusIds,
      }
    : null;

  let mcp: Awaited<ReturnType<typeof connectMcp>> = null;

  try {
    const config = getServerConfig();
    const model = createVllmModel(config);
    mcp = await connectMcp(config, req.signal);
    const tools = applyLessonTools((mcp?.tools ?? {}) as ToolSet, lesson) as ToolSet;

    let closed = false;
    const closeMcp = async () => {
      if (closed) return;
      closed = true;
      await mcp?.client.close().catch((error) => {
        console.error("Failed to close MCP client:", error);
      });
    };

    const practiceMode = resolvePracticeDirectionForModel(body.messages);

    const result = streamText({
      model,
      system: buildSystemPrompt(Boolean(lesson)),
      messages: await convertToModelMessages(
        prependUserControls(
          prunePracticeContext(body.messages),
          chineseScript,
          hskLevel,
          grammarTips,
          practiceMode,
          lesson,
        ),
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
