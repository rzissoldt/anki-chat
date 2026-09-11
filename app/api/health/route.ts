import { getPublicFeatureFlags, getServerConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  let chatConfigured = false;
  let mcpConfigured = false;
  let sttConfigured = false;
  let ttsConfigured = false;
  let maxContext = 32_768;

  try {
    const config = getServerConfig();
    chatConfigured = Boolean(config.chat.url && config.chat.model);
    mcpConfigured = config.mcp.enabled;
    sttConfigured = config.stt.enabled;
    ttsConfigured = config.tts.enabled;
    maxContext = config.chat.maxContext;
  } catch {
    chatConfigured = false;
  }

  const flags = getPublicFeatureFlags();

  return Response.json({
    status: "ok",
    features: {
      chat: chatConfigured,
      mcp: mcpConfigured,
      stt: sttConfigured && flags.enableStt,
      tts: ttsConfigured && flags.enableTts,
      reasoning: flags.enableReasoning,
      toolCalls: flags.enableToolCalls,
      maxContext,
    },
  });
}
