import { z } from "zod";

const emptyToUndefined = (value: unknown) =>
  typeof value === "string" && value.trim() === "" ? undefined : value;

const boolFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return value;
}, z.boolean());

const serverEnvSchema = z.object({
  CHAT_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  CHAT_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  CHAT_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  CHAT_ENABLE_THINKING: boolFromEnv.default(true),
  CHAT_AUTH_HEADER: z.preprocess(emptyToUndefined, z.string().default("Authorization")),
  CHAT_AUTH_SCHEME: z.preprocess(emptyToUndefined, z.string().default("Bearer")),
  MCP_SERVER_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  MCP_AUTH_TOKEN: z.preprocess(emptyToUndefined, z.string().optional()),
  MCP_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  AGENT_MAX_STEPS: z.coerce.number().int().min(1).max(50).default(10),
  CHAT_MAX_CONTEXT: z.coerce.number().int().positive().default(12_000),
  STATS_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),

  STT_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  STT_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  STT_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  STT_LANGUAGE: z.preprocess(emptyToUndefined, z.string().optional()),
  STT_PROTOCOL: z.preprocess(emptyToUndefined, z.string().default("openai-compatible")),
  STT_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  STT_MAX_BYTES: z.coerce
    .number()
    .int()
    .positive()
    .default(25 * 1024 * 1024),

  TTS_API_URL: z.preprocess(emptyToUndefined, z.string().url().optional()),
  TTS_API_KEY: z.preprocess(emptyToUndefined, z.string().optional()),
  TTS_MODEL: z.preprocess(emptyToUndefined, z.string().optional()),
  TTS_VOICE: z.preprocess(emptyToUndefined, z.string().optional()),
  TTS_LANGUAGE: z.preprocess(emptyToUndefined, z.string().optional()),
  TTS_TASK_TYPE: z.preprocess(emptyToUndefined, z.string().optional()),
  TTS_FORMAT: z.preprocess(emptyToUndefined, z.string().default("mp3")),
  TTS_PROTOCOL: z.preprocess(emptyToUndefined, z.string().default("openai-compatible")),
  TTS_TIMEOUT_MS: z.coerce.number().int().positive().default(60_000),
  TTS_MAX_CHARS: z.coerce.number().int().positive().default(4_000),
});

export type ServerConfig = {
  chat: {
    url?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    enableThinking: boolean;
    authHeader: string;
    authScheme: string;
    maxSteps: number;
    maxContext: number;
  };
  mcp: {
    url?: string;
    authToken?: string;
    timeoutMs: number;
    enabled: boolean;
  };
  stats: {
    url?: string;
    enabled: boolean;
  };
  stt: {
    url?: string;
    apiKey?: string;
    model?: string;
    language?: string;
    protocol: string;
    timeoutMs: number;
    maxBytes: number;
    enabled: boolean;
  };
  tts: {
    url?: string;
    apiKey?: string;
    model?: string;
    voice?: string;
    language?: string;
    taskType?: string;
    format: string;
    protocol: string;
    timeoutMs: number;
    maxChars: number;
    enabled: boolean;
  };
};

function buildAuthHeader(
  headerName: string,
  scheme: string,
  apiKey?: string,
): Record<string, string> {
  if (!apiKey) return {};
  const value = scheme ? `${scheme} ${apiKey}`.trim() : apiKey;
  return { [headerName]: value };
}

let cachedConfig: ServerConfig | null = null;

export function chatCompletionsUrlToBaseUrl(url?: string): string | undefined {
  if (!url) return undefined;
  return url.replace(/\/chat\/completions\/?$/, "").replace(/\/$/, "");
}

export function getServerConfig(): ServerConfig {
  if (cachedConfig) return cachedConfig;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid server configuration: ${message}`);
  }

  const env = parsed.data;
  cachedConfig = {
    chat: {
      url: env.CHAT_API_URL,
      baseUrl: chatCompletionsUrlToBaseUrl(env.CHAT_API_URL),
      apiKey: env.CHAT_API_KEY,
      model: env.CHAT_MODEL,
      enableThinking: env.CHAT_ENABLE_THINKING,
      authHeader: env.CHAT_AUTH_HEADER,
      authScheme: env.CHAT_AUTH_SCHEME,
      maxSteps: env.AGENT_MAX_STEPS,
      maxContext: env.CHAT_MAX_CONTEXT,
    },
    mcp: {
      url: env.MCP_SERVER_URL,
      authToken: env.MCP_AUTH_TOKEN,
      timeoutMs: env.MCP_TIMEOUT_MS,
      enabled: Boolean(env.MCP_SERVER_URL),
    },
    stats: {
      url: env.STATS_API_URL,
      enabled: Boolean(env.STATS_API_URL),
    },
    stt: {
      url: env.STT_API_URL,
      apiKey: env.STT_API_KEY,
      model: env.STT_MODEL,
      language: env.STT_LANGUAGE,
      protocol: env.STT_PROTOCOL,
      timeoutMs: env.STT_TIMEOUT_MS,
      maxBytes: env.STT_MAX_BYTES,
      enabled: Boolean(env.STT_API_URL),
    },
    tts: {
      url: env.TTS_API_URL,
      apiKey: env.TTS_API_KEY,
      model: env.TTS_MODEL,
      voice: env.TTS_VOICE,
      language: env.TTS_LANGUAGE,
      taskType: env.TTS_TASK_TYPE,
      format: env.TTS_FORMAT,
      protocol: env.TTS_PROTOCOL,
      timeoutMs: env.TTS_TIMEOUT_MS,
      maxChars: env.TTS_MAX_CHARS,
      enabled: Boolean(env.TTS_API_URL),
    },
  };

  return cachedConfig;
}

export function chatAuthHeaders(config: ServerConfig = getServerConfig()) {
  return buildAuthHeader(config.chat.authHeader, config.chat.authScheme, config.chat.apiKey);
}

export function sttAuthHeaders(config: ServerConfig = getServerConfig()) {
  return buildAuthHeader("Authorization", "Bearer", config.stt.apiKey);
}

export function ttsAuthHeaders(config: ServerConfig = getServerConfig()) {
  return buildAuthHeader("Authorization", "Bearer", config.tts.apiKey);
}

/** Public, non-secret feature flags for the browser. */
export function getPublicFeatureFlags() {
  const enableReasoning = process.env.NEXT_PUBLIC_ENABLE_REASONING !== "false";
  const enableToolCalls = process.env.NEXT_PUBLIC_ENABLE_TOOL_CALLS !== "false";
  const enableStt = process.env.NEXT_PUBLIC_ENABLE_STT !== "false";
  const enableTts = process.env.NEXT_PUBLIC_ENABLE_TTS !== "false";
  const autoPlayTts = boolFromEnv.safeParse(process.env.NEXT_PUBLIC_AUTO_PLAY_TTS ?? "false");

  const maxContext = z.coerce
    .number()
    .int()
    .positive()
    .safeParse(process.env.NEXT_PUBLIC_CHAT_MAX_CONTEXT ?? process.env.CHAT_MAX_CONTEXT);

  return {
    appName: process.env.NEXT_PUBLIC_APP_NAME || "Anki Chat",
    enableReasoning,
    enableToolCalls,
    enableStt,
    enableTts,
    autoPlayTts: autoPlayTts.success ? autoPlayTts.data : false,
    maxContext: maxContext.success ? maxContext.data : 12_000,
  };
}

export function resetConfigCacheForTests() {
  cachedConfig = null;
}
