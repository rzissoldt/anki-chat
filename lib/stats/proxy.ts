import { getServerConfig } from "@/lib/config";
import { statsNotConfiguredMessage, statsUnreachableMessage } from "@/lib/stats/errors";

const VOCABULARY_QUERY_KEYS = new Set([
  "mode",
  "only_known",
  "min_evaluations",
  "sort",
  "order",
  "limit",
  "script",
]);

const STRUCTURE_QUERY_KEYS = new Set([
  "mode",
  "max_hsk_level",
  "min_evaluations",
  "sort",
  "order",
  "limit",
]);

export type StatsProxyPath = "vocabulary" | "structures";

function allowedKeys(path: StatsProxyPath): Set<string> {
  return path === "vocabulary" ? VOCABULARY_QUERY_KEYS : STRUCTURE_QUERY_KEYS;
}

/** Forward only allowlisted query params to the upstream stats API. */
export function buildStatsUpstreamUrl(
  baseUrl: string,
  path: StatsProxyPath,
  searchParams: URLSearchParams,
): string {
  const upstream = new URL(`/api/stats/${path}`, baseUrl.replace(/\/$/, "") + "/");
  for (const key of allowedKeys(path)) {
    const value = searchParams.get(key);
    if (value !== null && value !== "") upstream.searchParams.set(key, value);
  }
  return upstream.toString();
}

export async function proxyStatsRequest(path: StatsProxyPath, request: Request): Promise<Response> {
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
  const upstreamUrl = buildStatsUpstreamUrl(config.stats.url, path, requestUrl.searchParams);

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
    const message = error instanceof Error ? error.message : "Stats request failed.";
    console.error(`Stats proxy (${path}) failed:`, message, `(upstream: ${upstreamUrl})`);
    return Response.json(
      { error: statsUnreachableMessage(upstreamUrl), code: "unreachable" },
      { status: 503 },
    );
  }
}
