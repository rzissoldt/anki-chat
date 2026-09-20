import { getServerConfig } from "@/lib/config";
import { statsNotConfiguredMessage, statsUnreachableMessage } from "@/lib/stats/errors";

const GRAMMAR_QUERY_KEYS = new Set(["max_hsk_level"]);

/** Forward only allowlisted query params to the upstream grammar catalog. */
export function buildGrammarStructuresUpstreamUrl(
  baseUrl: string,
  searchParams: URLSearchParams,
): string {
  const upstream = new URL("/api/grammar/structures", baseUrl.replace(/\/$/, "") + "/");
  for (const key of GRAMMAR_QUERY_KEYS) {
    const value = searchParams.get(key);
    if (value !== null && value !== "") upstream.searchParams.set(key, value);
  }
  return upstream.toString();
}

export async function proxyGrammarStructuresRequest(request: Request): Promise<Response> {
  let config;
  try {
    config = getServerConfig();
  } catch {
    return Response.json(
      { error: statsNotConfiguredMessage(), code: "not_configured" },
      { status: 503 },
    );
  }

  if (!config.stats.enabled || !config.stats.url) {
    return Response.json(
      { error: statsNotConfiguredMessage(), code: "not_configured" },
      { status: 503 },
    );
  }

  const requestUrl = new URL(request.url);
  const upstreamUrl = buildGrammarStructuresUpstreamUrl(config.stats.url, requestUrl.searchParams);

  try {
    const upstream = await fetch(upstreamUrl, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: request.signal,
    });

    const body = await upstream.text();
    return new Response(body, {
      status: upstream.status,
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
      },
    });
  } catch (error) {
    if (request.signal.aborted) {
      return Response.json({ error: "Request aborted." }, { status: 499 });
    }
    const message = error instanceof Error ? error.message : "Grammar catalog request failed.";
    console.error(`Grammar catalog proxy failed:`, message, `(upstream: ${upstreamUrl})`);
    return Response.json(
      { error: statsUnreachableMessage(upstreamUrl), code: "unreachable" },
      { status: 503 },
    );
  }
}
