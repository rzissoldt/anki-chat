import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiDictationAdapter } from "@/lib/stt/dictation-adapter";

class FakeMediaRecorder {
  static instance: FakeMediaRecorder | null = null;
  static isTypeSupported = vi.fn(() => true);

  readonly mimeType: string;
  state: RecordingState = "inactive";
  ondataavailable: ((event: BlobEvent) => void) | null = null;
  onerror: (() => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(_stream: MediaStream, options?: MediaRecorderOptions) {
    this.mimeType = options?.mimeType || "audio/webm";
    FakeMediaRecorder.instance = this;
  }

  start() {
    this.state = "recording";
  }

  stop() {
    this.state = "inactive";
    this.ondataavailable?.({
      data: new Blob([new Uint8Array([1, 2, 3])], { type: this.mimeType }),
    } as BlobEvent);
    this.onstop?.();
  }
}

afterEach(() => {
  FakeMediaRecorder.instance = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ApiDictationAdapter", () => {
  it("records audio, transcribes it, and emits a final transcript", async () => {
    const stopTrack = vi.fn();
    vi.stubGlobal("navigator", {
      mediaDevices: {
        getUserMedia: vi.fn(async () => ({
          getTracks: () => [{ stop: stopTrack }],
        })),
      },
    });
    vi.stubGlobal("MediaRecorder", FakeMediaRecorder);

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const form = init?.body as FormData;
      expect(form.get("file")).toBeInstanceOf(Blob);
      return Response.json({ text: " 你好，世界 " });
    });
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ApiDictationAdapter("/api/stt");
    const session = adapter.listen();
    const onSpeech = vi.fn();
    const onSpeechEnd = vi.fn();
    session.onSpeech(onSpeech);
    session.onSpeechEnd(onSpeechEnd);

    await vi.waitFor(() => expect(FakeMediaRecorder.instance?.state).toBe("recording"));
    await session.stop();

    expect(fetchMock).toHaveBeenCalledWith("/api/stt", expect.objectContaining({ method: "POST" }));
    expect(onSpeech).toHaveBeenCalledWith({
      transcript: "你好，世界",
      isFinal: true,
    });
    expect(onSpeechEnd).toHaveBeenCalledOnce();
    expect(stopTrack).toHaveBeenCalledOnce();
    expect(adapter.getState()).toEqual({
      phase: "idle",
      error: null,
      completedTranscriptions: 1,
    });
  });
});
