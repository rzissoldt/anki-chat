import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { chatAuthHeaders, type ServerConfig } from "@/lib/config";

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

export function createVllmModel(config: ServerConfig) {
  if (!config.chat.baseUrl) {
    throw new Error("CHAT_API_URL is required");
  }
  if (!config.chat.model) {
    throw new Error("CHAT_MODEL is required");
  }

  const provider = createOpenAICompatible({
    name: "vllm",
    baseURL: config.chat.baseUrl,
    headers: chatAuthHeaders(config),
    includeUsage: true,
    transformRequestBody(body) {
      return addThinkingConfig(body, config.chat.enableThinking);
    },
  });

  return provider.chatModel(config.chat.model);
}
