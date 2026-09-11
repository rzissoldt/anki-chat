import { proxySpeechToText } from "@/lib/stt/client";
import { getServerConfig } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const config = getServerConfig();
    if (!config.stt.enabled) {
      return Response.json({ error: "Speech recognition is not configured." }, { status: 503 });
    }

    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return Response.json({ error: "Audio file is required" }, { status: 400 });
    }

    const result = await proxySpeechToText(file, config, req.signal);
    if (!result.text) {
      return Response.json({ error: "Empty transcript. Please try again." }, { status: 422 });
    }

    return Response.json({ text: result.text });
  } catch (error) {
    const status =
      error && typeof error === "object" && "status" in error
        ? Number((error as { status: number }).status)
        : 500;
    const message =
      error instanceof Error ? error.message : "Speech recognition failed. Please try again.";
    console.error("STT proxy failed:", message);
    return Response.json({ error: message }, { status: Number.isFinite(status) ? status : 500 });
  }
}
