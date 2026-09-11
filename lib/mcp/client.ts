import { createMCPClient, type MCPClient } from "@ai-sdk/mcp";
import type { ServerConfig } from "@/lib/config";

export type ConnectedMcp = {
  client: MCPClient;
  tools: Awaited<ReturnType<MCPClient["tools"]>>;
};

function createTimeoutFetch(timeoutMs: number): typeof fetch {
  return (input, init = {}) => {
    const timeoutSignal = AbortSignal.timeout(timeoutMs);
    const signal = init.signal ? AbortSignal.any([init.signal, timeoutSignal]) : timeoutSignal;
    return fetch(input, { ...init, signal });
  };
}

export async function connectMcp(
  config: ServerConfig,
  signal?: AbortSignal,
): Promise<ConnectedMcp | null> {
  if (!config.mcp.url) return null;

  const headers: Record<string, string> = {};
  if (config.mcp.authToken) {
    headers.Authorization = `Bearer ${config.mcp.authToken}`;
  }

  const client = await createMCPClient({
    clientName: "anki-chat",
    transport: {
      type: "http",
      url: config.mcp.url,
      headers,
      fetch: createTimeoutFetch(config.mcp.timeoutMs),
    },
    initializationOptions: {
      signal,
      timeout: config.mcp.timeoutMs,
      maxTotalTimeout: config.mcp.timeoutMs,
    },
    onUncaughtError(error) {
      console.error("Uncaught MCP client error:", error);
    },
  });

  try {
    const tools = await client.tools();
    return { client, tools };
  } catch (error) {
    await client.close().catch(() => undefined);
    throw error;
  }
}
