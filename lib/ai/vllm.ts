import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { chatAuthHeaders, type ServerConfig } from "@/lib/config";

/**
 * vLLM/Qwen accept `chat_template_kwargs`; strict OpenAI-compatible APIs
 * (e.g. Gemini) reject unknown fields with 400.
 */
export function shouldInjectThinkingKwargs(baseUrl?: string): boolean {
  if (!baseUrl) return true;
  try {
    const host = new URL(baseUrl).hostname;
    return host !== "generativelanguage.googleapis.com";
  } catch {
    return true;
  }
}

export function addThinkingConfig(
  body: Record<string, unknown>,
  enableThinking: boolean,
): Record<string, unknown> {
  const existing =
    body.chat_template_kwargs &&
    typeof body.chat_template_kwargs === "object" &&
    !Array.isArray(body.chat_template_kwargs)
      ? body.chat_template_kwargs
      : {};

  return {
    ...body,
    chat_template_kwargs: {
      ...existing,
      enable_thinking: enableThinking,
    },
  };
}

export type CreateVllmModelOptions = {
  /** Override chat.enableThinking (gloss / structured-output calls should force false). */
  enableThinking?: boolean;
  /**
   * Send OpenAI `json_schema` response_format for generateObject.
   * Defaults to true; required for reliable contextual glosses on vLLM.
   */
  supportsStructuredOutputs?: boolean;
};

export function createVllmModel(config: ServerConfig, options?: CreateVllmModelOptions) {
  if (!config.chat.baseUrl) {
    throw new Error("CHAT_API_URL is required");
  }
  if (!config.chat.model) {
    throw new Error("CHAT_MODEL is required");
  }

  const enableThinking = options?.enableThinking ?? config.chat.enableThinking;

  const provider = createOpenAICompatible({
    name: "vllm",
    baseURL: config.chat.baseUrl,
    headers: chatAuthHeaders(config),
    includeUsage: true,
    supportsStructuredOutputs: options?.supportsStructuredOutputs ?? true,
    transformRequestBody(body) {
      if (!shouldInjectThinkingKwargs(config.chat.baseUrl)) return body;
      return addThinkingConfig(body, enableThinking);
    },
  });

  return provider.chatModel(config.chat.model);
}
