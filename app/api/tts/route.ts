import { proxyTextToSpeech } from "@/lib/tts/client";
import { getServerConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const config = getServerConfig();
    if (!config.tts.enabled) {
      return Response.json({ error: "Speech synthesis is not configured." }, { status: 503 });
    }

    const body = (await req.json()) as { text?: unknown };
    const text = typeof body.text === "string" ? body.text : "";
    if (!text.trim()) {
      return Response.json({ error: "Text is required" }, { status: 400 });
    }

    const result = await proxyTextToSpeech(text, config, req.signal);
    return new Response(result.body, {
      headers: {
        "Content-Type": result.contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 500;
    const message =
      error instanceof Error ? error.message : "Speech synthesis failed. Please try again.";
    console.error("TTS proxy failed:", message);
    return Response.json({ error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
