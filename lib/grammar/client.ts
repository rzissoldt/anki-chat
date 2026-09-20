import { formatStatsErrorMessage, type StatsErrorPayload } from "@/lib/stats/errors";
import type { GrammarStructuresParams, GrammarStructuresResponse } from "@/lib/grammar/types";

function toSearchParams(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

export function grammarStructuresUrl(params: GrammarStructuresParams = {}): string {
  return `/api/grammar/structures${toSearchParams({
    max_hsk_level: params.max_hsk_level,
  })}`;
}

export async function fetchGrammarStructures(
  params: GrammarStructuresParams = {},
  signal?: AbortSignal,
): Promise<GrammarStructuresResponse> {
  const response = await fetch(grammarStructuresUrl(params), {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    let message = `Grammar catalog request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as StatsErrorPayload;
      message = formatStatsErrorMessage(payload);
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await response.json()) as GrammarStructuresResponse;
}
