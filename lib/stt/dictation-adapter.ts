"use client";

import type { DictationAdapter } from "@assistant-ui/react";

export type DictationPhase = "idle" | "recording" | "transcribing";

export type DictationUiState = {
  phase: DictationPhase;
  error: string | null;
  completedTranscriptions: number;
};

const MIME_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type));
}

function fileExtension(mimeType: string): string {
  if (mimeType.includes("mp4")) return "mp4";
  if (mimeType.includes("ogg")) return "ogg";
  return "webm";
}

export class ApiDictationAdapter implements DictationAdapter {
  readonly disableInputDuringDictation = false;

  private state: DictationUiState = {
    phase: "idle",
    error: null,
    completedTranscriptions: 0,
  };
  private readonly subscribers = new Set<() => void>();

  constructor(private readonly apiUrl = "/api/stt") {}

  getState = (): DictationUiState => this.state;

  subscribe = (callback: () => void) => {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  };

  private setState(state: DictationUiState) {
    this.state = state;
    for (const callback of this.subscribers) callback();
  }

  listen(): DictationAdapter.Session {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.setState({
        ...this.state,
        error: "This browser does not support microphone recording.",
      });
      throw new Error("This browser does not support microphone recording.");
    }
    if (typeof MediaRecorder === "undefined") {
      this.setState({
        ...this.state,
        error: "This browser does not support microphone recording.",
      });
      throw new Error("This browser does not support microphone recording.");
    }

    this.setState({ ...this.state, phase: "idle", error: null });

    const speechStartCallbacks = new Set<() => void>();
    const speechCallbacks = new Set<(result: DictationAdapter.Result) => void>();
    const speechEndCallbacks = new Set<(result: DictationAdapter.Result) => void>();
    const chunks: BlobPart[] = [];

    let status: DictationAdapter.Status = { type: "starting" };
    let recorder: MediaRecorder | null = null;
    let stream: MediaStream | null = null;
    let stopRequested = false;
    let cancelled = false;
    let settled = false;
    let resolveCompletion!: () => void;
    const completion = new Promise<void>((resolve) => {
      resolveCompletion = resolve;
    });

    const cleanupStream = () => {
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
      recorder = null;
    };

    const finish = (
      reason: "stopped" | "cancelled" | "error",
      error: string | null = null,
      completed = false,
    ) => {
      if (settled) return;
      settled = true;
      status = { type: "ended", reason };
      cleanupStream();
      this.setState({
        phase: "idle",
        error,
        completedTranscriptions: this.state.completedTranscriptions + (completed ? 1 : 0),
      });
      resolveCompletion!();
    };

    const transcribe = async (blob: Blob) => {
      if (settled || cancelled) {
        finish("cancelled");
        return;
      }

      this.setState({ ...this.state, phase: "transcribing", error: null });
      try {
        const form = new FormData();
        form.append("file", blob, `recording.${fileExtension(blob.type)}`);
        const response = await fetch(this.apiUrl, { method: "POST", body: form });
        const data = (await response.json()) as { text?: string; error?: string };
        if (!response.ok || !data.text?.trim()) {
          throw new Error(data.error || "Speech recognition failed. Please try again.");
        }

        const result = { transcript: data.text.trim(), isFinal: true };
        for (const callback of speechCallbacks) callback(result);
        for (const callback of speechEndCallbacks) callback(result);
        finish("stopped", null, true);
      } catch (error) {
        finish(
          "error",
          error instanceof Error ? error.message : "Speech recognition failed. Please try again.",
        );
      }
    };

    const session: DictationAdapter.Session = {
      get status() {
        return status;
      },
      stop: async () => {
        stopRequested = true;
        if (recorder?.state === "recording") recorder.stop();
        await completion;
      },
      cancel: () => {
        cancelled = true;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        } else {
          finish("cancelled");
        }
      },
      onSpeechStart: (callback) => {
        speechStartCallbacks.add(callback);
        return () => speechStartCallbacks.delete(callback);
      },
      onSpeech: (callback) => {
        speechCallbacks.add(callback);
        return () => speechCallbacks.delete(callback);
      },
      onSpeechEnd: (callback) => {
        speechEndCallbacks.add(callback);
        return () => speechEndCallbacks.delete(callback);
      },
    };

    void navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          finish("cancelled");
          return;
        }

        stream = mediaStream;
        const mimeType = pickMimeType();
        recorder = mimeType
          ? new MediaRecorder(mediaStream, { mimeType })
          : new MediaRecorder(mediaStream);
        recorder.ondataavailable = (event) => {
          if (event.data.size > 0) chunks.push(event.data);
        };
        recorder.onerror = () => finish("error", "Recording failed. Please try again.");
        recorder.onstop = () => {
          const recordedMimeType = recorder?.mimeType || mimeType || "audio/webm";
          cleanupStream();
          if (cancelled) {
            finish("cancelled");
            return;
          }
          const blob = new Blob(chunks, { type: recordedMimeType });
          void transcribe(blob);
        };

        recorder.start();
        status = { type: "running" };
        this.setState({ ...this.state, phase: "recording", error: null });
        for (const callback of speechStartCallbacks) callback();
        if (stopRequested && recorder.state === "recording") recorder.stop();
      })
      .catch((error) => {
        const message =
          error instanceof DOMException && error.name === "NotAllowedError"
            ? "Microphone permission denied."
            : "Could not start recording.";
        finish("error", message);
      });

    return session;
  }
}
