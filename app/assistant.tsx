"use client";

import { Thread } from "@/components/assistant-ui/elements/thread.aui";
import { LessonSidebar } from "@/components/lessons/lesson-sidebar";
import { StatsPanel } from "@/components/stats/stats-panel";
import { Button } from "@/components/ui/button";
import { useClientFeatures } from "@/lib/features";
import type { ChineseScript } from "@/lib/dictionary/script-convert";
import { useScriptConvertStore } from "@/lib/dictionary/script-convert-store";
import { DEFAULT_HSK_LEVEL, type HskLevel } from "@/lib/hsk-level";
import { selectActiveLesson, useLessonStore } from "@/lib/lessons/store";
import type { LessonConfig, SentenceLength } from "@/lib/lessons/types";
import { DEFAULT_SENTENCE_LENGTH, lessonHskLevel } from "@/lib/lessons/types";
import { ApiDictationAdapter } from "@/lib/stt/dictation-adapter";
import { cn } from "@/lib/utils";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/ai-sdk";
import { AssistantRuntimeProvider, useAui, useAuiState } from "@assistant-ui/react";
import { PanelLeftIcon } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type { ChineseScript };

const SIDEBAR_OPEN_KEY = "anki-chat:lesson-sidebar-open";

type AppTab = "chat" | "stats";

function restoreThread(aui: ReturnType<typeof useAui>, snapshot: unknown) {
  if (
    snapshot &&
    typeof snapshot === "object" &&
    Array.isArray((snapshot as { messages?: unknown }).messages)
  ) {
    aui.thread.import(snapshot as Parameters<typeof aui.thread.import>[0]);
    return;
  }
  aui.thread.reset();
}

function AppHeader({
  appName,
  activeTab,
  onTabChange,
  sidebarOpen,
  onToggleSidebar,
}: {
  appName: string;
  activeTab: AppTab;
  onTabChange: (tab: AppTab) => void;
  sidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  return (
    <header className="border-border/60 flex items-center justify-between gap-3 border-b px-3 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <div className="flex min-w-0 items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={sidebarOpen ? "Sidebar schließen" : "Sidebar öffnen"}
          aria-pressed={sidebarOpen}
          onClick={onToggleSidebar}
        >
          <PanelLeftIcon className="size-4" />
        </Button>
        <h1 className="truncate text-base font-semibold tracking-tight">{appName}</h1>
        <div
          role="tablist"
          aria-label="App navigation"
          className="bg-muted/50 inline-flex shrink-0 rounded-full p-0.5"
        >
          <Button
            type="button"
            role="tab"
            aria-selected={activeTab === "chat"}
            variant={activeTab === "chat" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onTabChange("chat")}
          >
            Chat
          </Button>
          <Button
            type="button"
            role="tab"
            aria-selected={activeTab === "stats"}
            variant={activeTab === "stats" ? "default" : "ghost"}
            size="sm"
            className="rounded-full"
            onClick={() => onTabChange("stats")}
          >
            Stats
          </Button>
        </div>
      </div>
    </header>
  );
}

function ChatShell({
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
  showGrammarTips,
  onShowGrammarTipsChange,
  dictationAdapter,
  hideComposerOptions,
  isLesson,
  sentenceLength,
  onSentenceLengthChange,
}: {
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
  showGrammarTips: boolean;
  onShowGrammarTipsChange: (show: boolean) => void;
  dictationAdapter?: ApiDictationAdapter;
  hideComposerOptions: boolean;
  isLesson: boolean;
  sentenceLength: SentenceLength;
  onSentenceLengthChange: (value: SentenceLength) => void;
}) {
  return (
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
      showGrammarTips={showGrammarTips}
      onShowGrammarTipsChange={onShowGrammarTipsChange}
      dictationAdapter={dictationAdapter}
      hideComposerOptions={hideComposerOptions}
      isLesson={isLesson}
      sentenceLength={sentenceLength}
      onSentenceLengthChange={onSentenceLengthChange}
    />
  );
}

function AppShell({
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
  showGrammarTips,
  onShowGrammarTipsChange,
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
  showGrammarTips: boolean;
  onShowGrammarTipsChange: (show: boolean) => void;
  dictationAdapter?: ApiDictationAdapter;
}) {
  const aui = useAui();
  const [activeTab, setActiveTab] = useState<AppTab>("chat");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const lessons = useLessonStore((s) => s.lessons);
  const activeLessonId = useLessonStore((s) => s.activeLessonId);
  const activeLesson = useLessonStore(selectActiveLesson);
  const setActiveLessonId = useLessonStore((s) => s.setActiveLessonId);
  const createLesson = useLessonStore((s) => s.createLesson);
  const updateLesson = useLessonStore((s) => s.updateLesson);
  const deleteLesson = useLessonStore((s) => s.deleteLesson);

  useEffect(() => {
    const stored = window.localStorage.getItem(SIDEBAR_OPEN_KEY);
    if (window.matchMedia("(max-width: 767px)").matches) {
      setSidebarOpen(false);
      return;
    }
    if (stored === "false") setSidebarOpen(false);
  }, []);

  const handleToggleSidebar = useCallback(() => {
    setSidebarOpen((open) => {
      const next = !open;
      window.localStorage.setItem(SIDEBAR_OPEN_KEY, String(next));
      return next;
    });
  }, []);

  const persistLesson = useCallback(
    async (id: string | null) => {
      if (!id) return;
      if (!useLessonStore.getState().lessons.some((lesson) => lesson.id === id)) return;
      await updateLesson(id, { messages: aui.thread.export() });
    },
    [aui, updateLesson],
  );

  const threadMessages = useAuiState((s) => s.thread.messages);
  useEffect(() => {
    if (!activeLessonId) return;
    const id = activeLessonId;
    const timer = window.setTimeout(() => {
      void persistLesson(id);
    }, 400);
    return () => window.clearTimeout(timer);
  }, [activeLessonId, persistLesson, threadMessages]);

  const handleNewChat = useCallback(async () => {
    await persistLesson(useLessonStore.getState().activeLessonId);
    setActiveLessonId(null);
    await aui.threads.switchToNewThread();
    setActiveTab("chat");
  }, [aui, persistLesson, setActiveLessonId]);

  const handleSelectLesson = useCallback(
    async (id: string) => {
      if (id === useLessonStore.getState().activeLessonId) {
        setActiveTab("chat");
        return;
      }
      await persistLesson(useLessonStore.getState().activeLessonId);
      const lesson = useLessonStore.getState().lessons.find((item) => item.id === id);
      if (!lesson) return;
      await aui.threads.switchToNewThread();
      restoreThread(aui, lesson.messages);
      setActiveLessonId(id);
      setActiveTab("chat");
    },
    [aui, persistLesson, setActiveLessonId],
  );

  const handleCreateLesson = useCallback(
    async (input: { title: string; config: LessonConfig }) => {
      await persistLesson(useLessonStore.getState().activeLessonId);
      await aui.threads.switchToNewThread();
      await createLesson(input);
      setActiveTab("chat");
    },
    [aui, createLesson, persistLesson],
  );

  const handleUpdateLesson = useCallback(
    async (id: string, input: { title: string; config: LessonConfig }) => {
      await updateLesson(id, input);
    },
    [updateLesson],
  );

  const handleRenameLesson = useCallback(
    async (id: string, title: string) => {
      await updateLesson(id, { title });
    },
    [updateLesson],
  );

  const handleDeleteLesson = useCallback(
    async (id: string) => {
      const wasActive = useLessonStore.getState().activeLessonId === id;
      await deleteLesson(id);
      if (wasActive) {
        await aui.threads.switchToNewThread();
        setActiveTab("chat");
      }
    },
    [aui, deleteLesson],
  );

  const effectiveScript = activeLesson?.config.chineseScript ?? chineseScript;
  const effectiveHsk = activeLesson ? lessonHskLevel(activeLesson.config) : hskLevel;
  const effectivePinyin = activeLesson?.config.showPinyin ?? showPinyin;
  const effectiveGrammar = activeLesson?.config.showGrammarTips ?? showGrammarTips;
  const effectiveSentenceLength = activeLesson?.config.sentenceLength ?? DEFAULT_SENTENCE_LENGTH;

  const handleLessonScriptChange = useCallback(
    (script: ChineseScript) => {
      if (activeLesson) {
        void updateLesson(activeLesson.id, {
          config: { ...activeLesson.config, chineseScript: script },
        });
        return;
      }
      onChineseScriptChange(script);
    },
    [activeLesson, onChineseScriptChange, updateLesson],
  );

  const handleSentenceLengthChange = useCallback(
    (sentenceLength: SentenceLength) => {
      if (!activeLesson) return;
      void updateLesson(activeLesson.id, {
        config: { ...activeLesson.config, sentenceLength },
      });
    },
    [activeLesson, updateLesson],
  );

  return (
    <div className="bg-background flex h-dvh flex-col">
      <AppHeader
        appName={appName}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        sidebarOpen={sidebarOpen}
        onToggleSidebar={handleToggleSidebar}
      />
      <div className="relative flex min-h-0 flex-1">
        {sidebarOpen && (
          <button
            type="button"
            className="bg-background/40 absolute inset-0 z-30 md:hidden"
            aria-label="Sidebar schließen"
            onClick={handleToggleSidebar}
          />
        )}
        <div
          className={cn(
            "z-40 h-full",
            sidebarOpen ? "max-md:absolute max-md:inset-y-0 max-md:left-0" : "hidden md:block",
          )}
        >
          <LessonSidebar
            collapsed={!sidebarOpen}
            lessons={lessons}
            activeLessonId={activeLessonId}
            onNewChat={() => void handleNewChat()}
            onSelectLesson={(id) => void handleSelectLesson(id)}
            onCreateLesson={(input) => void handleCreateLesson(input)}
            onUpdateLesson={(id, input) => void handleUpdateLesson(id, input)}
            onRenameLesson={(id, title) => void handleRenameLesson(id, title)}
            onDeleteLesson={(id) => void handleDeleteLesson(id)}
          />
        </div>
        <div className="min-h-0 min-w-0 flex-1 pb-[env(safe-area-inset-bottom)]">
          {activeTab === "chat" ? (
            <ChatShell
              enableStt={enableStt}
              enableTts={enableTts}
              enableReasoning={enableReasoning}
              maxContext={maxContext}
              chineseScript={effectiveScript}
              onChineseScriptChange={handleLessonScriptChange}
              hskLevel={effectiveHsk}
              onHskLevelChange={onHskLevelChange}
              showPinyin={effectivePinyin}
              onShowPinyinChange={onShowPinyinChange}
              showGrammarTips={effectiveGrammar}
              onShowGrammarTipsChange={onShowGrammarTipsChange}
              dictationAdapter={dictationAdapter}
              hideComposerOptions={Boolean(activeLesson)}
              isLesson={Boolean(activeLesson)}
              sentenceLength={effectiveSentenceLength}
              onSentenceLengthChange={handleSentenceLengthChange}
            />
          ) : (
            <StatsPanel
              chineseScript={effectiveScript}
              onChineseScriptChange={handleLessonScriptChange}
            />
          )}
        </div>
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
  const [showGrammarTips, setShowGrammarTips] = useState(true);
  const showGrammarTipsRef = useRef(showGrammarTips);
  const activeLesson = useLessonStore(selectActiveLesson);
  const lessonRef = useRef(activeLesson);
  lessonRef.current = activeLesson;

  const handleChineseScriptChange = useCallback((script: ChineseScript) => {
    chineseScriptRef.current = script;
    setChineseScript(script);
  }, []);

  const handleHskLevelChange = useCallback((level: HskLevel) => {
    hskLevelRef.current = level;
    setHskLevel(level);
  }, []);

  const handleShowPinyinChange = useCallback((show: boolean) => {
    setShowPinyin(show);
  }, []);

  const handleShowGrammarTipsChange = useCallback((show: boolean) => {
    showGrammarTipsRef.current = show;
    setShowGrammarTips(show);
  }, []);

  useEffect(() => {
    void useScriptConvertStore.getState().ensureLoaded();
  }, []);

  useEffect(() => {
    void useLessonStore.getState().hydrate();
  }, []);

  const dictationAdapter = useMemo(
    () => (features.stt ? new ApiDictationAdapter("/api/stt") : undefined),
    [features.stt],
  );

  const runtime = useChatRuntime({
    transport: useMemo(
      () =>
        new AssistantChatTransport({
          api: "/api/chat",
          body: () => {
            const lesson = lessonRef.current;
            if (lesson) {
              return {
                chineseScript: lesson.config.chineseScript,
                hskLevel: lessonHskLevel(lesson.config),
                grammarTips: lesson.config.showGrammarTips,
                lesson: true,
                ankiVocab: lesson.config.useAnkiVocab,
                sentenceLength: lesson.config.sentenceLength,
                structureIds: lesson.config.selectedStructureIds,
                frameIds: lesson.config.selectedFrameIds,
                focusIds: lesson.config.selectedFocusIds,
              };
            }
            return {
              chineseScript: chineseScriptRef.current,
              hskLevel: hskLevelRef.current,
              grammarTips: showGrammarTipsRef.current,
            };
          },
        }),
      [],
    ),
    adapters: dictationAdapter ? { dictation: dictationAdapter } : undefined,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <AppShell
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
        showGrammarTips={showGrammarTips}
        onShowGrammarTipsChange={handleShowGrammarTipsChange}
        dictationAdapter={dictationAdapter}
      />
    </AssistantRuntimeProvider>
  );
};
