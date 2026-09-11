import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

let activeAudio: HTMLAudioElement | null = null;
let activeCancel: (() => void) | null = null;

function stopActivePlayback() {
  activeCancel?.();
  activeCancel = null;
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.src = "";
    activeAudio = null;
  }
}

/**
 * Custom TTS adapter that posts plain text to /api/tts and plays the audio.
 * Ensures only one utterance plays at a time.
 */
export class ApiSpeechSynthesisAdapter implements SpeechSynthesisAdapter {
  constructor(private readonly apiUrl = "/api/tts") {}

  speak(text: string): SpeechSynthesisAdapter.Utterance {
    stopActivePlayback();

    const subscribers = new Set<() => void>();
    let status: SpeechSynthesisAdapter.Status = { type: "starting" };
    let audio: HTMLAudioElement | null = null;
    let objectUrl: string | null = null;
    let cancelled = false;

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
      audio?.pause();
      finish("cancelled");
    };

    activeCancel = cancel;

    void fetch(this.apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Speech synthesis failed");
        }
        return response.blob();
      })
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
