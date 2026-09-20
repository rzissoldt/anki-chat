import { Reasoning } from "@/components/assistant/reasoning";
import { VoiceInputControl } from "@/components/audio/voice-input-control";
import { ContextUsageIndicator } from "@/components/assistant-ui/elements/context-usage";
import { MarkdownText } from "@/components/assistant-ui/elements/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/elements/tool-fallback.aui";
import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { PracticeQuickActions } from "@/components/assistant-ui/elements/practice-quick-actions";
import { SentenceLengthSlider } from "@/components/lessons/sentence-length-slider";
import { Button } from "@/components/ui/button";
import { useGlossStore } from "@/lib/dictionary/gloss-store";
import { detectGlossLanguage, glossLanguageFromNavigator } from "@/lib/dictionary/language";
import type { ChineseScript } from "@/lib/dictionary/script-convert";
import { formatHskLevel, HSK_LEVELS, type HskLevel } from "@/lib/hsk-level";
import type { SentenceLength } from "@/lib/lessons/types";
import type { ApiDictationAdapter } from "@/lib/stt/dictation-adapter";
import { useSttAutoSend } from "@/lib/stt/preferences";
import { cn } from "@/lib/utils";
import {
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  unstable_useComposerInput,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type FC } from "react";

export type ThreadProps = {
  enableStt?: boolean;
  enableTts?: boolean;
  enableReasoning?: boolean;
  maxContext?: number;
  chineseScript: ChineseScript;
  onChineseScriptChange: (script: ChineseScript) => void;
  hskLevel: HskLevel;
  onHskLevelChange: (level: HskLevel) => void;
  showPinyin: boolean;
  onShowPinyinChange: (show: boolean) => void;
  showGrammarTips: boolean;
  onShowGrammarTipsChange: (show: boolean) => void;
  dictationAdapter?: ApiDictationAdapter;
  hideComposerOptions?: boolean;
  isLesson?: boolean;
  sentenceLength?: SentenceLength;
  onSentenceLengthChange?: (value: SentenceLength) => void;
};

// Startup exposes a loading placeholder thread; treat it as a new chat so
// the composer mounts centered. Loads after startup keep the docked layout.
const isNewChatView = (s: AssistantState) =>
  s.thread.messages.length === 0 && (!s.thread.isLoading || s.threads.isLoading);

// A switched thread that is still fetching its history: skeleton, not welcome.
const isHistoryLoadingView = (s: AssistantState) =>
  s.thread.messages.length === 0 &&
  s.thread.isLoading &&
  !s.thread.isDisabled &&
  !s.threads.isLoading;

const ThreadHistorySkeleton: FC = () => (
  <div
    data-slot="aui_thread-history-skeleton"
    role="status"
    className="animate-in fade-in fill-mode-both flex flex-col [animation-delay:150ms] [animation-duration:200ms]"
  >
    <span className="sr-only">Loading conversation</span>
    <div className="flex animate-pulse flex-col gap-y-6 motion-reduce:animate-none">
      <div className="bg-muted ml-auto h-9 w-2/5 rounded-xl" />
      <div className="flex flex-col gap-y-2">
        <div className="bg-muted h-4 w-11/12 rounded-md" />
        <div className="bg-muted h-4 w-4/5 rounded-md" />
        <div className="bg-muted h-4 w-3/5 rounded-md" />
      </div>
      <div className="bg-muted ml-auto h-9 w-1/3 rounded-xl" />
      <div className="flex flex-col gap-y-2">
        <div className="bg-muted h-4 w-10/12 rounded-md" />
        <div className="bg-muted h-4 w-2/3 rounded-md" />
      </div>
    </div>
  </div>
);

export const Thread: FC<ThreadProps> = ({
  enableStt = false,
  enableTts = false,
  enableReasoning = true,
  maxContext = 12_000,
  chineseScript,
  onChineseScriptChange,
  hskLevel,
  onHskLevelChange,
  showPinyin,
  onShowPinyinChange,
  showGrammarTips,
  onShowGrammarTipsChange,
  dictationAdapter,
  hideComposerOptions = false,
  isLesson = false,
  sentenceLength,
  onSentenceLengthChange,
}) => {
  const isEmpty = useAuiState(isNewChatView);

  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "44rem",
        ["--composer-bg" as string]: "var(--color-card)",
        ["--composer-radius" as string]: "1.5rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div
          className={cn(
            "mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4",
            isEmpty && "justify-center",
          )}
        >
          <AuiIf condition={isNewChatView}>
            <ThreadWelcome isLesson={isLesson} />
          </AuiIf>
          <AuiIf condition={isHistoryLoadingView}>
            <ThreadHistorySkeleton />
          </AuiIf>

          <div data-slot="aui_message-group" className="mb-14 flex flex-col gap-y-6 empty:hidden">
            <ThreadPrimitive.Messages>
              {() => (
                <ThreadMessage
                  enableTts={enableTts}
                  enableReasoning={enableReasoning}
                  showPinyin={showPinyin}
                  showGrammarTips={showGrammarTips}
                  chineseScript={chineseScript}
                />
              )}
            </ThreadPrimitive.Messages>
          </div>

          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
            )}
          >
            <ThreadScrollToBottom />
            <Composer
              enableStt={enableStt}
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
              sentenceLength={sentenceLength}
              onSentenceLengthChange={onSentenceLengthChange}
            />
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC<{
  enableTts: boolean;
  enableReasoning: boolean;
  showPinyin: boolean;
  showGrammarTips: boolean;
  chineseScript: ChineseScript;
}> = ({ enableTts, enableReasoning, showPinyin, showGrammarTips, chineseScript }) => {
  const role = useAuiState((s) => s.message.role);
  const isEditing = useAuiState((s) => s.message.composer.isEditing);

  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return (
    <AssistantMessage
      enableTts={enableTts}
      enableReasoning={enableReasoning}
      showPinyin={showPinyin}
      showGrammarTips={showGrammarTips}
      chineseScript={chineseScript}
    />
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom dark:border-border dark:bg-background dark:hover:bg-accent absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC<{ isLesson: boolean }> = ({ isLesson }) => {
  return (
    <div className="aui-thread-welcome-root mb-6 flex flex-col items-center px-4 text-center">
      <h1 className="aui-thread-welcome-message-inner fade-in slide-in-from-bottom-1 animate-in fill-mode-both text-2xl font-medium tracking-tight duration-200">
        {isLesson ? "Start this lesson" : "Start practicing"}
      </h1>
      <p className="text-muted-foreground mt-2 max-w-md text-sm">
        {isLesson
          ? "Übungssätze folgen der Lesson-Konfiguration. Richtung wählst du über Schnellstart."
          : "Chat with your language learning assistant. Tool calls and thinking show up inline when the backend provides them."}
      </p>
    </div>
  );
};

const Composer: FC<{
  enableStt: boolean;
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
  sentenceLength?: SentenceLength;
  onSentenceLengthChange?: (value: SentenceLength) => void;
}> = ({
  enableStt,
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
  sentenceLength,
  onSentenceLengthChange,
}) => {
  const { send, canSend } = unstable_useComposerInput();
  const [audioError, setAudioError] = useState<string | null>(null);
  const [autoSendAfterVoice, setAutoSendAfterVoice] = useSttAutoSend();
  const isRunning = useAuiState((s) => s.thread.isRunning);
  const completedTranscriptions = useSyncExternalStore(
    dictationAdapter?.subscribe ?? (() => () => {}),
    () => dictationAdapter?.getState().completedTranscriptions ?? 0,
    () => 0,
  );
  const handledTranscriptions = useRef(completedTranscriptions);

  useEffect(() => {
    if (completedTranscriptions === handledTranscriptions.current) return;
    if (!autoSendAfterVoice) {
      handledTranscriptions.current = completedTranscriptions;
      return;
    }
    if (canSend) {
      handledTranscriptions.current = completedTranscriptions;
      send();
    }
  }, [autoSendAfterVoice, canSend, completedTranscriptions, send]);

  const handleAudioError = useCallback((message: string | null) => {
    setAudioError(message);
  }, []);

  return (
    <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col gap-2">
      <div
        data-slot="aui_composer-shell"
        className="border-border/60 focus-within:border-border dark:border-muted-foreground/15 dark:focus-within:border-muted-foreground/30 flex w-full cursor-text flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) transition-[border-color]"
      >
        <PracticeQuickActions />
        <ComposerPrimitive.Input
          placeholder="Message..."
          className="aui-composer-input placeholder:text-muted-foreground/60 max-h-48 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base leading-6 outline-none"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction
          enableStt={enableStt}
          disabled={isRunning}
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
          autoSendAfterVoice={autoSendAfterVoice}
          onAutoSendAfterVoiceChange={setAutoSendAfterVoice}
          onAudioError={handleAudioError}
          hideComposerOptions={hideComposerOptions}
          sentenceLength={sentenceLength}
          onSentenceLengthChange={onSentenceLengthChange}
        />
      </div>
      {audioError ? (
        <p className="text-destructive px-1 text-xs" role="alert">
          {audioError}
        </p>
      ) : null}
    </ComposerPrimitive.Root>
  );
};

const ComposerAction: FC<{
  enableStt: boolean;
  disabled: boolean;
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
  autoSendAfterVoice: boolean;
  onAutoSendAfterVoiceChange: (enabled: boolean) => void;
  onAudioError: (message: string | null) => void;
  hideComposerOptions: boolean;
  sentenceLength?: SentenceLength;
  onSentenceLengthChange?: (value: SentenceLength) => void;
}> = ({
  enableStt,
  disabled,
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
  autoSendAfterVoice,
  onAutoSendAfterVoiceChange,
  onAudioError,
  hideComposerOptions,
  sentenceLength,
  onSentenceLengthChange,
}) => {
  return (
    <div className="aui-composer-action-wrapper relative flex items-center justify-between">
      <div className="flex min-h-8 flex-wrap items-center gap-3">
        {hideComposerOptions ? (
          sentenceLength && onSentenceLengthChange ? (
            <SentenceLengthSlider
              value={sentenceLength}
              onChange={onSentenceLengthChange}
              disabled={disabled}
              compact
            />
          ) : null
        ) : (
          <div className="contents">
            <fieldset
              className="border-border/60 text-muted-foreground flex items-center rounded-md border p-0.5 text-sm disabled:opacity-50"
              disabled={disabled}
              aria-label="Chinese character set"
            >
              {(["simplified", "traditional"] as const).map((script) => (
                <label
                  key={script}
                  title={script === "simplified" ? "Simplified Chinese" : "Traditional Chinese"}
                  className="cursor-pointer"
                >
                  <input
                    type="radio"
                    name="chinese-script"
                    value={script}
                    checked={chineseScript === script}
                    onChange={() => onChineseScriptChange(script)}
                    aria-label={
                      script === "simplified" ? "Simplified Chinese" : "Traditional Chinese"
                    }
                    className="peer sr-only"
                  />
                  <span className="hover:text-foreground peer-checked:bg-accent peer-checked:text-foreground peer-focus-visible:ring-ring flex size-6 items-center justify-center rounded-sm transition-colors peer-focus-visible:ring-2">
                    {script === "simplified" ? "简" : "繁"}
                  </span>
                </label>
              ))}
            </fieldset>
            <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
              <span className="sr-only">Maximum sentence structure level</span>
              <select
                value={hskLevel}
                onChange={(event) => onHskLevelChange(Number(event.target.value) as HskLevel)}
                disabled={disabled}
                aria-label="Maximum HSK level for sentence structures"
                className="border-border/60 bg-background hover:text-foreground h-7 cursor-pointer rounded-md border px-2 outline-none transition-colors disabled:cursor-not-allowed disabled:opacity-50"
              >
                {HSK_LEVELS.map((level) => (
                  <option key={level} value={level}>
                    {formatHskLevel(level)}
                  </option>
                ))}
              </select>
            </label>
            <label
              className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              title={
                showPinyin
                  ? "Pinyin unter chinesischen Zeilen ausblenden"
                  : "Pinyin unter chinesischen Zeilen einblenden"
              }
            >
              <input
                type="checkbox"
                checked={showPinyin}
                onChange={(event) => onShowPinyinChange(event.target.checked)}
                disabled={disabled}
                aria-label="Pinyin unter chinesischen Zeilen ein- oder ausblenden"
                className="border-border/60 accent-foreground size-3.5 cursor-pointer rounded-sm disabled:cursor-not-allowed"
              />
              <span className="select-none">拼音</span>
            </label>
            <label
              className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
              title={
                showGrammarTips
                  ? "Grammatiktipps bei Übungssätzen ausblenden"
                  : "Grammatiktipps bei Übungssätzen einblenden"
              }
            >
              <input
                type="checkbox"
                checked={showGrammarTips}
                onChange={(event) => onShowGrammarTipsChange(event.target.checked)}
                disabled={disabled}
                aria-label="Grammatiktipps bei Übungssätzen ein- oder ausblenden"
                className="border-border/60 accent-foreground size-3.5 cursor-pointer rounded-sm disabled:cursor-not-allowed"
              />
              <span className="select-none">语法</span>
            </label>
          </div>
        )}
        {enableStt ? (
          <label
            className="text-muted-foreground flex cursor-pointer items-center gap-1.5 text-xs has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50"
            title="Send messages automatically after voice input"
          >
            <input
              type="checkbox"
              checked={autoSendAfterVoice}
              onChange={(event) => onAutoSendAfterVoiceChange(event.target.checked)}
              disabled={disabled}
              aria-label="Send messages automatically after voice input"
              className="border-border/60 accent-foreground size-3.5 cursor-pointer rounded-sm disabled:cursor-not-allowed"
            />
            <span className="select-none">Auto-send</span>
          </label>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5">
        <ContextUsageIndicator maxContext={maxContext} />
        {enableStt && dictationAdapter ? (
          <VoiceInputControl
            adapter={dictationAdapter}
            disabled={disabled}
            onError={onAudioError}
          />
        ) : null}
        <AuiIf condition={(s) => !s.thread.isRunning}>
          <ComposerPrimitive.Send asChild>
            <TooltipIconButton
              tooltip="Send message"
              side="bottom"
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-send size-8 rounded-full"
              aria-label="Send message"
            >
              <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
          </ComposerPrimitive.Send>
        </AuiIf>
        <AuiIf condition={(s) => s.thread.isRunning}>
          <ComposerPrimitive.Cancel asChild>
            <Button
              type="button"
              variant="default"
              size="icon"
              className="aui-composer-cancel size-8 rounded-full"
              aria-label="Stop generating"
            >
              <SquareIcon className="aui-composer-cancel-icon size-3.5 fill-current" />
            </Button>
          </ComposerPrimitive.Cancel>
        </AuiIf>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive dark:bg-destructive/5 mt-2 rounded-md border p-3 text-sm dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC<{
  enableTts: boolean;
  enableReasoning: boolean;
  showPinyin: boolean;
  showGrammarTips: boolean;
  chineseScript: ChineseScript;
}> = ({ enableTts, enableReasoning, showPinyin, showGrammarTips, chineseScript }) => {
  const ACTION_BAR_PT = "pt-1.5";
  const ACTION_BAR_HEIGHT = `min-h-7.5 ${ACTION_BAR_PT}`;
  const messageId = useAuiState((s) => s.message.id);
  const messageStatus = useAuiState((s) => s.message.status?.type);
  const messageText = useAuiState((s) =>
    s.message.parts
      .filter((part) => part.type === "text")
      .map((part) => part.text)
      .join("\n"),
  );
  const userTextBlob = useAuiState((s) =>
    s.thread.messages
      .filter((message) => message.role === "user")
      .flatMap((message) =>
        message.parts.filter((part) => part.type === "text").map((part) => part.text),
      )
      .join("\n\n"),
  );
  const annotateMessage = useGlossStore((state) => state.annotateMessage);

  useEffect(() => {
    if (!messageText || messageStatus === "running") return;

    const fallback = glossLanguageFromNavigator();
    const lang = detectGlossLanguage(userTextBlob ? [userTextBlob] : [], fallback);
    const controller = new AbortController();
    // Defer slightly so Strict Mode abort + message-id swaps settle first.
    const timer = window.setTimeout(() => {
      void annotateMessage(messageId, messageText, lang, controller.signal);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [annotateMessage, messageId, messageStatus, messageText, userTextBlob]);

  return (
    <MessagePrimitive.Root
      data-slot="aui_assistant-message-root"
      data-role="assistant"
      className="fade-in slide-in-from-bottom-1 animate-in relative -mb-7.5 pb-7.5 duration-150"
    >
      <div
        data-slot="aui_assistant-message-content"
        className="text-foreground max-w-full px-2 leading-relaxed wrap-break-word"
      >
        <MessagePrimitive.Parts>
          {({ part }) => {
            if (part.type === "reasoning") {
              return enableReasoning ? <Reasoning /> : null;
            }
            if (part.type === "text")
              return (
                <MarkdownText
                  messageId={messageId}
                  messageText={messageText}
                  enableSpeak={enableTts}
                  showPinyin={showPinyin}
                  showGrammarTips={showGrammarTips}
                  chineseScript={chineseScript}
                  enableScriptConvert={messageStatus !== "running"}
                />
              );
            if (part.type === "tool-call") return part.toolUI ?? <ToolFallback {...part} />;
            return null;
          }}
        </MessagePrimitive.Parts>
        <AuiIf
          condition={(s) => s.message.status?.type === "running" && s.message.parts.length === 0}
        >
          <span
            data-slot="aui_assistant-message-indicator"
            className="animate-pulse font-sans"
            aria-label="Assistant is working"
          >
            {"●"}
          </span>
        </AuiIf>
        <MessageError />
      </div>

      <div
        data-slot="aui_assistant-message-footer"
        className={cn("ms-2 flex items-center", ACTION_BAR_HEIGHT)}
      >
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-assistant-action-bar-root text-muted-foreground animate-in fade-in col-start-3 row-start-2 -ms-1 flex gap-1 duration-200"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <AuiIf condition={(s) => s.message.isCopied}>
            <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />
          </AuiIf>
          <AuiIf condition={(s) => !s.message.isCopied}>
            <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />
          </AuiIf>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Retry">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_user-message-root"
      className="fade-in slide-in-from-bottom-1 animate-in grid auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] content-start gap-y-2 px-2 duration-150 [contain-intrinsic-size:auto_200px] [content-visibility:auto] [&:where(>*)]:col-start-2"
      data-role="user"
    >
      <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
        <div className="aui-user-message-content peer bg-muted text-foreground rounded-xl px-4 py-2 wrap-break-word empty:hidden">
          <MessagePrimitive.Parts />
        </div>
        <div className="aui-user-action-bar-wrapper absolute start-0 top-1/2 -translate-x-full -translate-y-1/2 pe-2 peer-empty:hidden rtl:translate-x-full">
          <UserActionBar />
        </div>
      </div>

      <BranchPicker
        data-slot="aui_user-branch-picker"
        className="col-span-full col-start-1 row-start-3 -me-1 justify-end"
      />
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <MessagePrimitive.Root
      data-slot="aui_edit-composer-wrapper"
      className="flex flex-col px-2 [contain-intrinsic-size:auto_200px] [content-visibility:auto]"
    >
      <ComposerPrimitive.Root className="aui-edit-composer-root border-border/60 dark:border-muted-foreground/15 ms-auto flex w-full max-w-[85%] cursor-text flex-col rounded-(--composer-radius) border bg-(--composer-bg) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] dark:shadow-none">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input text-foreground min-h-14 w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base outline-none"
          autoFocus
        />
        <div className="aui-edit-composer-footer mx-2.5 mb-2.5 flex items-center gap-1.5 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" className="h-8 rounded-full px-3.5">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" className="h-8 rounded-full px-3.5">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </MessagePrimitive.Root>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn(
        "aui-branch-picker-root text-muted-foreground -ms-2 me-2 inline-flex items-center text-xs",
        className,
      )}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};
