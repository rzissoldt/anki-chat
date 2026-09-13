import { ApiSpeechSynthesisAdapter } from "@/lib/tts/speech-adapter";
import type { SpeechSynthesisAdapter } from "@assistant-ui/react";

export type SentencePlaybackState = {
  text: string | null;
  status: "idle" | "starting" | "running";
};

const adapter = new ApiSpeechSynthesisAdapter("/api/tts");
const listeners = new Set<() => void>();

let state: SentencePlaybackState = { text: null, status: "idle" };
let activeUtterance: SpeechSynthesisAdapter.Utterance | null = null;
let activeUnsub: (() => void) | null = null;

function notify() {
  for (const listener of listeners) listener();
}

function setState(next: SentencePlaybackState) {
  state = next;
  notify();
}

export function getSentencePlaybackSnapshot(): SentencePlaybackState {
  return state;
}

export function subscribeSentencePlayback(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function speakChineseSentence(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return;

  activeUnsub?.();
  activeUnsub = null;

  const utterance = adapter.speak(trimmed);
  activeUtterance = utterance;
  setState({ text: trimmed, status: "starting" });

  activeUnsub = utterance.subscribe(() => {
    if (utterance.status.type === "ended") {
      if (activeUtterance === utterance) {
        activeUtterance = null;
        activeUnsub = null;
        setState({ text: null, status: "idle" });
      }
      return;
    }

    if (activeUtterance === utterance) {
      setState({ text: trimmed, status: utterance.status.type });
    }
  });
}

export function stopChineseSentenceSpeech() {
  activeUtterance?.cancel();
}
