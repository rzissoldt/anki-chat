import { getServerConfig, ttsAuthHeaders, type ServerConfig } from "@/lib/config";

export async function proxyTextToSpeech(
  text: string,
  config: ServerConfig = getServerConfig(),
  signal?: AbortSignal,
): Promise<{ body: ArrayBuffer; contentType: string }> {
  if (!config.tts.url) {
    throw Object.assign(new Error("TTS is not configured"), { status: 503 });
  }

  const trimmed = text.trim();
  if (!trimmed) {
    throw Object.assign(new Error("Text is required"), { status: 400 });
  }

  if (trimmed.length > config.tts.maxChars) {
    throw Object.assign(new Error("Text is too long for speech synthesis"), {
      status: 413,
    });
  }

  const payload: Record<string, string> = {
    input: trimmed,
  };
  if (config.tts.model) payload.model = config.tts.model;
  if (config.tts.voice) payload.voice = config.tts.voice;
  if (config.tts.format) payload.response_format = config.tts.format;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.tts.timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(config.tts.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...ttsAuthHeaders(config),
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("TTS upstream error:", response.status, detail.slice(0, 500));
      throw Object.assign(new Error("Speech synthesis failed. Please try again."), {
        status: response.status >= 400 ? response.status : 502,
      });
    }

    const contentType =
      response.headers.get("Content-Type") ||
      (config.tts.format === "mp3" ? "audio/mpeg" : `audio/${config.tts.format}`);
    const body = await response.arrayBuffer();
    return { body, contentType };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Speech synthesis timed out."), {
        status: 504,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
