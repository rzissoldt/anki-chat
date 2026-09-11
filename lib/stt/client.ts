import { getServerConfig, sttAuthHeaders, type ServerConfig } from "@/lib/config";

export async function proxySpeechToText(
  file: File,
  config: ServerConfig = getServerConfig(),
  signal?: AbortSignal,
): Promise<{ text: string }> {
  if (!config.stt.url) {
    throw Object.assign(new Error("STT is not configured"), { status: 503 });
  }

  if (file.size <= 0) {
    throw Object.assign(new Error("Audio file is empty"), { status: 400 });
  }

  if (file.size > config.stt.maxBytes) {
    throw Object.assign(new Error("Audio file is too large"), { status: 413 });
  }

  const form = new FormData();
  form.append("file", file, file.name || "audio.webm");
  if (config.stt.model) form.append("model", config.stt.model);
  if (config.stt.language) form.append("language", config.stt.language);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.stt.timeoutMs);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort);

  try {
    const response = await fetch(config.stt.url, {
      method: "POST",
      headers: {
        ...sttAuthHeaders(config),
      },
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      console.error("STT upstream error:", response.status, detail.slice(0, 500));
      throw Object.assign(new Error("Speech recognition failed. Please try again."), {
        status: response.status >= 400 ? response.status : 502,
      });
    }

    const data = (await response.json()) as { text?: unknown; transcript?: unknown };
    const text =
      typeof data.text === "string"
        ? data.text
        : typeof data.transcript === "string"
          ? data.transcript
          : "";

    return { text: text.trim() };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw Object.assign(new Error("Speech recognition timed out."), {
        status: 504,
      });
    }
    throw error;
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}
