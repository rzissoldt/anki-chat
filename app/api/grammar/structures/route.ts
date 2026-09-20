import { proxyGrammarStructuresRequest } from "@/lib/grammar/proxy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return proxyGrammarStructuresRequest(request);
}
