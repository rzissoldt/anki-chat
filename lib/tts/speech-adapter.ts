import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

let activeAudio: HTMLAudioElement | null = null;
let activeCancel: (() => void) | null = null;

/** LRU cache of synthesized audio blobs, keyed by trimmed text. */
const MAX_CACHE_ENTRIES = 50;
const audioCache = new Map<string, Blob>();
const inflightFetches = new Map<string, Promise<Blob>>();

function getCachedAudio(text: string): Blob | undefined {
  const blob = audioCache.get(text);
  if (!blob) return undefined;
  // Refresh LRU position.
  audioCache.delete(text);
  audioCache.set(text, blob);
  return blob;
}

function setCachedAudio(text: string, blob: Blob) {
  if (audioCache.has(text)) audioCache.delete(text);
  audioCache.set(text, blob);
  while (audioCache.size > MAX_CACHE_ENTRIES) {
    const oldest = audioCache.keys().next().value;
    if (oldest === undefined) break;
    audioCache.delete(oldest);
  }
}

async function fetchAudioBlob(
  apiUrl: string,
  text: string,
  signal: AbortSignal,
): Promise<Blob> {
  const cached = getCachedAudio(text);
  if (cached) return cached;

  const existing = inflightFetches.get(text);
  if (existing) {
    // Share the in-flight request; still honor this utterance's abort.
    return await abortable(existing, signal);
  }

  const request = (async () => {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      // Do not abort the shared cache fill when one utterance cancels —
      // another click on the same text can reuse the result.
    });
    if (!response.ok) {
      throw new Error("Speech synthesis failed");
    }
    const blob = await response.blob();
    setCachedAudio(text, blob);
    return blob;
  })().finally(() => {
    inflightFetches.delete(text);
  });

  inflightFetches.set(text, request);
  return await abortable(request, signal);
}

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) {
    return Promise.reject(new DOMException("Aborted", "AbortError"));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        reject(error);
      },
    );
  });
}

function stopActivePlayback() {
  activeCancel?.();
  activeCancel = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
}

/** Clears the client-side TTS audio cache (tests / rare resets). */
export function clearTtsAudioCache() {
  audioCache.clear();
  inflightFetches.clear();
}

/**
 * Custom TTS adapter that posts plain text to /api/tts and plays the audio.
 * Caches synthesized blobs so repeat playback skips the network.
 * Ensures only one utterance plays at a time.
 */
export class ApiSpeechSynthesisAdapter implements SpeechSynthesisAdapter {
  constructor(private readonly apiUrl = "/api/tts") {}

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    stopActivePlayback();

    const trimmed = text.trim();
    const subscribers = new Set<() => void>();
    let status: SpeechSynthesisAdapter.Status = { type: "starting" };
    let audio: HTMLAudioElement | null = null;
    let objectUrl: string | null = null;
    let cancelled = false;
    const controller = new AbortController();

    const notify = () => {
      for (const callback of subscribers) callback();
    };

    const finish = (reason: "finished" | "cancelled" | "error", error?: unknown) => {
      if (status.type === "ended") return;
      status = { type: "ended", reason, error };
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
        objectUrl = null;
      }
      if (activeAudio === audio) {
        activeAudio = null;
        activeCancel = null;
      }
      notify();
    };

    const cancel = () => {
      cancelled = true;
      controller.abort();
      audio?.pause();
      finish("cancelled");
    };

    activeCancel = cancel;

    void fetchAudioBlob(this.apiUrl, trimmed, controller.signal)
      .then((blob) => {
        if (cancelled || status.type === "ended") return;
        objectUrl = URL.createObjectURL(blob);
        audio = new Audio(objectUrl);
        activeAudio = audio;
        status = { type: "running" };
        notify();
        audio.onended = () => finish("finished");
        audio.onerror = (event) => finish("error", event);
        return audio.play();
      })
      .catch((error) => {
        if (!cancelled) finish("error", error);
      });

    return {
      get status() {
        return status;
      },
      cancel,
      subscribe: (callback) => {
        subscribers.add(callback);
        return () => {
          subscribers.delete(callback);
        };
      },
    };
  }
}
