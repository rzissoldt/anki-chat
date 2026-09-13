import { ApiSpeechSynthesisAdapter, clearTtsAudioCache } from "@/lib/tts/speech-adapter";
import { afterEach, describe, expect, it, vi } from "vitest";

class FakeAudio {
  static instance: FakeAudio | null = null;

  readonly src: string;
  onended: (() => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  play = vi.fn(async () => undefined);
  pause = vi.fn();

  constructor(src: string) {
    this.src = src;
    FakeAudio.instance = this;
  }
}

afterEach(() => {
  clearTtsAudioCache();
  FakeAudio.instance = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ApiSpeechSynthesisAdapter", () => {
  it("loads, plays, and finishes an utterance", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );

    const utterance = new ApiSpeechSynthesisAdapter().speak("你好");
    const subscriber = vi.fn();
    utterance.subscribe(subscriber);

    expect(utterance.status).toEqual({ type: "starting" });
    await vi.waitFor(() => expect(FakeAudio.instance).not.toBeNull());
    expect(utterance.status).toEqual({ type: "running" });
    expect(FakeAudio.instance?.play).toHaveBeenCalledOnce();

    FakeAudio.instance?.onended?.();

    expect(utterance.status).toEqual({ type: "ended", reason: "finished", error: undefined });
    expect(subscriber).toHaveBeenCalledTimes(2);
  });

  it("reuses cached audio on repeat playback without refetching", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    const fetchMock = vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ApiSpeechSynthesisAdapter();
    const first = adapter.speak("你好");
    await vi.waitFor(() => expect(FakeAudio.instance).not.toBeNull());
    FakeAudio.instance?.onended?.();
    await vi.waitFor(() => expect(first.status.type).toBe("ended"));

    FakeAudio.instance = null;
    const second = adapter.speak("你好");
    await vi.waitFor(() => expect(FakeAudio.instance).not.toBeNull());
    expect(second.status).toEqual({ type: "running" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("ends as cancelled when stopped before audio arrives", () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    const utterance = new ApiSpeechSynthesisAdapter().speak("Hello");
    utterance.cancel();

    expect(utterance.status).toEqual({ type: "ended", reason: "cancelled", error: undefined });
  });

  it("keeps filling the cache when an utterance is cancelled mid-fetch", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    let resolveFetch!: (value: Response) => void;
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const adapter = new ApiSpeechSynthesisAdapter();
    const first = adapter.speak("缓存");
    first.cancel();
    expect(first.status).toEqual({ type: "ended", reason: "cancelled", error: undefined });

    resolveFetch(new Response(new Uint8Array([9, 9, 9]), { status: 200 }));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());

    const second = adapter.speak("缓存");
    await vi.waitFor(() => expect(FakeAudio.instance).not.toBeNull());
    expect(second.status).toEqual({ type: "running" });
    expect(fetchMock).toHaveBeenCalledOnce();
  });

  it("reports upstream failures as speech errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 500 })),
    );

    const utterance = new ApiSpeechSynthesisAdapter().speak("Hallo");

    await vi.waitFor(() => expect(utterance.status.type).toBe("ended"));
    expect(utterance.status).toMatchObject({ type: "ended", reason: "error" });
  });
});
