import { proxyStatsRequest } from "@/lib/stats/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyStatsRequest("structures", request);
}
