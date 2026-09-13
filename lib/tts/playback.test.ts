import {
  getSentencePlaybackSnapshot,
  speakChineseSentence,
  stopChineseSentenceSpeech,
  subscribeSentencePlayback,
} from "@/lib/tts/playback";
import { clearTtsAudioCache } from "@/lib/tts/speech-adapter";
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
  stopChineseSentenceSpeech();
  clearTtsAudioCache();
  FakeAudio.instance = null;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sentence playback", () => {
  it("tracks starting and running state for the active sentence", async () => {
    vi.stubGlobal("Audio", FakeAudio);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(new Uint8Array([1, 2, 3]), { status: 200 })),
    );

    const snapshots: string[] = [];
    const unsubscribe = subscribeSentencePlayback(() => {
      const snapshot = getSentencePlaybackSnapshot();
      snapshots.push(`${snapshot.status}:${snapshot.text ?? ""}`);
    });

    speakChineseSentence("我喜欢中国。");
    expect(getSentencePlaybackSnapshot()).toEqual({
      text: "我喜欢中国。",
      status: "starting",
    });

    await vi.waitFor(() => expect(FakeAudio.instance).not.toBeNull());
    expect(getSentencePlaybackSnapshot()).toEqual({
      text: "我喜欢中国。",
      status: "running",
    });

    FakeAudio.instance?.onended?.();
    expect(getSentencePlaybackSnapshot()).toEqual({ text: null, status: "idle" });
    expect(snapshots).toContain("starting:我喜欢中国。");
    expect(snapshots).toContain("running:我喜欢中国。");
    unsubscribe();
  });
});
