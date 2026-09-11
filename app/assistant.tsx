"use client";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { Button } from "@/components/ui/button";
import { useClientFeatures } from "@/lib/features";
import { DEFAULT_HSK_LEVEL, type HskLevel } from "@/lib/hsk-level";
import { ApiDictationAdapter } from "@/lib/stt/dictation-adapter";
import { ApiSpeechSynthesisAdapter } from "@/lib/tts/speech-adapter";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider, useAui } from "@assistant-ui/react";
import { useCallback, useMemo, useRef, useState } from "react";

export type ChineseScript = "simplified" | "traditional";

function ChatHeader({ appName, onNewChat }: { appName: string; onNewChat: () => void }) {
  return (
    <header className="border-border/60 flex items-center justify-between border-b px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <h1 className="text-base font-semibold tracking-tight">{appName}</h1>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="rounded-full"
        onClick={onNewChat}
      >
        New Chat
      </Button>
    </header>
  );
}

function ChatShell({
  appName,
  enableStt,
  enableTts,
  enableReasoning,
  maxContext,
  chineseScript,
  onChineseScriptChange,
  hskLevel,
  onHskLevelChange,
  showPinyin,
  onShowPinyinChange,
  dictationAdapter,
}: {
  appName: string;
  enableStt: boolean;
  enableTts: boolean;
  enableReasoning: boolean;
  maxContext: number;
  chineseScript: ChineseScript;
  onChineseScriptChange: (script: ChineseScript) => void;
  hskLevel: HskLevel;
  onHskLevelChange: (level: HskLevel) => void;
  showPinyin: boolean;
  onShowPinyinChange: (show: boolean) => void;
  dictationAdapter?: ApiDictationAdapter;
}) {
  const aui = useAui();

  const handleNewChat = useCallback(() => {
    aui.threads.switchToNewThread();
  }, [aui]);

  return (
    <div className="bg-background flex h-dvh flex-col">
      <ChatHeader appName={appName} onNewChat={handleNewChat} />
      <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <Thread
          enableStt={enableStt}
          enableTts={enableTts}
          enableReasoning={enableReasoning}
          maxContext={maxContext}
          chineseScript={chineseScript}
          onChineseScriptChange={onChineseScriptChange}
          hskLevel={hskLevel}
          onHskLevelChange={onHskLevelChange}
          showPinyin={showPinyin}
          onShowPinyinChange={onShowPinyinChange}
          dictationAdapter={dictationAdapter}
        />
      </div>
    </div>
  );
}

export const Assistant = () => {
  const features = useClientFeatures();
  const [chineseScript, setChineseScript] = useState<ChineseScript>("simplified");
  const chineseScriptRef = useRef(chineseScript);
  const [hskLevel, setHskLevel] = useState<HskLevel>(DEFAULT_HSK_LEVEL);
  const hskLevelRef = useRef(hskLevel);
  const [showPinyin, setShowPinyin] = useState(true);
  const showPinyinRef = useRef(showPinyin);

  const handleChineseScriptChange = useCallback((script: ChineseScript) => {
    chineseScriptRef.current = script;
    setChineseScript(script);
  }, []);

  const handleHskLevelChange = useCallback((level: HskLevel) => {
    hskLevelRef.current = level;
    setHskLevel(level);
  }, []);

  const handleShowPinyinChange = useCallback((show: boolean) => {
    showPinyinRef.current = show;
    setShowPinyin(show);
  }, []);

  const speechAdapter = useMemo(
    () => (features.tts ? new ApiSpeechSynthesisAdapter("/api/tts") : undefined),
    [features.tts],
  );
  const dictationAdapter = useMemo(
    () => (features.stt ? new ApiDictationAdapter("/api/stt") : undefined),
    [features.stt],
  );

  const runtime = useChatRuntime({
    transport: useMemo(
      () =>
        new AssistantChatTransport({
          api: "/api/chat",
          body: () => ({
            chineseScript: chineseScriptRef.current,
            hskLevel: hskLevelRef.current,
            showPinyin: showPinyinRef.current,
          }),
        }),
      [],
    ),
    adapters:
      speechAdapter || dictationAdapter
        ? {
            ...(speechAdapter ? { speech: speechAdapter } : {}),
            ...(dictationAdapter ? { dictation: dictationAdapter } : {}),
          }
        : undefined,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ChatShell
        appName={features.appName}
        enableStt={features.stt}
        enableTts={features.tts}
        enableReasoning={features.reasoning}
        maxContext={features.maxContext}
        chineseScript={chineseScript}
        onChineseScriptChange={handleChineseScriptChange}
        hskLevel={hskLevel}
        onHskLevelChange={handleHskLevelChange}
        showPinyin={showPinyin}
        onShowPinyinChange={handleShowPinyinChange}
        dictationAdapter={dictationAdapter}
      />
    </AssistantRuntimeProvider>
  );
};
