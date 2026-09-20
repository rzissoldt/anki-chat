import { formatStatsErrorMessage, type StatsErrorPayload } from "@/lib/stats/errors";
import type {
  StructureStatsParams,
  StructureStatsResponse,
  VocabularyStatsParams,
  VocabularyStatsResponse,
} from "@/lib/stats/types";

function toSearchParams(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `?${qs}` : "";
}

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });
  if (!response.ok) {
    let message = `Stats request failed with ${response.status}`;
    try {
      const payload = (await response.json()) as StatsErrorPayload;
      message = formatStatsErrorMessage(payload);
    } catch {
      /* keep default */
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

export function vocabularyStatsUrl(params: VocabularyStatsParams = {}): string {
  return `/api/stats/vocabulary${toSearchParams({
    mode: params.mode,
    only_known: params.only_known,
    min_evaluations: params.min_evaluations,
    sort: params.sort,
    order: params.order,
    limit: params.limit,
    script: params.script,
  })}`;
}

export function structureStatsUrl(params: StructureStatsParams = {}): string {
  return `/api/stats/structures${toSearchParams({
    mode: params.mode,
    max_hsk_level: params.max_hsk_level,
    min_evaluations: params.min_evaluations,
    sort: params.sort,
    order: params.order,
    limit: params.limit,
  })}`;
}

export async function fetchVocabularyStats(
  params: VocabularyStatsParams = {},
  signal?: AbortSignal,
): Promise<VocabularyStatsResponse> {
  return fetchJson<VocabularyStatsResponse>(vocabularyStatsUrl(params), signal);
}

export async function fetchStructureStats(
  params: StructureStatsParams = {},
  signal?: AbortSignal,
): Promise<StructureStatsResponse> {
  return fetchJson<StructureStatsResponse>(structureStatsUrl(params), signal);
}
