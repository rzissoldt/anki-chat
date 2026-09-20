export type StatsErrorCode = "not_configured" | "unreachable" | "upstream_error";

export type StatsErrorPayload = {
  error: string;
  code?: StatsErrorCode;
};

const START_HINT = "Starte die Stats-API in anki-mcp mit: uv run sprachapp-api (oder: make api)";

export function statsNotConfiguredMessage(): string {
  return `Stats-API ist nicht konfiguriert. Setze STATS_API_URL in .env (z. B. http://127.0.0.1:8780). ${START_HINT}`;
}

export function statsUnreachableMessage(upstreamUrl?: string): string {
  const target = upstreamUrl ? ` (${upstreamUrl})` : "";
  return `Stats-API nicht erreichbar${target}. ${START_HINT}`;
}

/** Map proxy/client error payloads to user-facing German messages. */
export function formatStatsErrorMessage(payload: StatsErrorPayload | string): string {
  if (typeof payload === "string") return payload;

  switch (payload.code) {
    case "not_configured":
      return statsNotConfiguredMessage();
    case "unreachable":
      return payload.error || statsUnreachableMessage();
    default:
      return payload.error || "Stats konnten nicht geladen werden.";
  }
}
