"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import {
  Children,
  cloneElement,
  createContext,
  isValidElement,
  type FC,
  type ReactNode,
  memo,
  useContext,
  useMemo,
  useState,
} from "react";
import { CheckIcon, CopyIcon } from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/elements/tooltip-icon-button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { DictionaryAnnotation } from "@/lib/dictionary/cedict";
import { useGlossStore } from "@/lib/dictionary/gloss-store";
import { cn } from "@/lib/utils";

type GlossContextValue = {
  segments: DictionaryAnnotation[];
};

const GlossContext = createContext<GlossContextValue>({
  segments: [],
});
const EMPTY_SEGMENTS: DictionaryAnnotation[] = [];

const MarkdownTextImpl = ({
  messageId,
  messageText,
}: {
  messageId: string;
  messageText: string;
}) => {
  const glossEntry = useGlossStore((state) => state.getGloss(messageId, messageText));
  const segments = glossEntry?.segments ?? EMPTY_SEGMENTS;
  const glossRevision = glossEntry?.status === "ready" ? glossEntry.requestId : 0;
  const value = useMemo<GlossContextValue>(() => {
    const bySurface = new Map<string, DictionaryAnnotation>();
    for (const segment of segments) {
      if (!bySurface.has(segment.surface)) bySurface.set(segment.surface, segment);
    }
    return {
      segments: [...bySurface.values()].sort((a, b) => b.surface.length - a.surface.length),
    };
  }, [segments]);

  return (
    <GlossContext.Provider value={value}>
      <MarkdownTextPrimitive
        // react-markdown's renderer is memoized on text/components identity.
        // Remount when dictionary glosses arrive so AnnotatedChildren can wrap words.
        key={`gloss-${glossRevision}`}
        remarkPlugins={[remarkGfm]}
        className="aui-md"
        components={defaultComponents}
        defer={glossRevision === 0}
      />
    </GlossContext.Provider>
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const ChineseGloss = ({ annotation }: { annotation: DictionaryAnnotation }) => (
  <Tooltip>
    <TooltipTrigger
      delay={200}
      render={
        <button
          type="button"
          lang="zh"
          className="decoration-primary/60 hover:decoration-primary focus-visible:ring-ring m-0 inline cursor-help border-0 bg-transparent p-0 font-inherit text-inherit underline decoration-dotted underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
        />
      }
    >
      {annotation.surface}
    </TooltipTrigger>
    <TooltipContent side="bottom" align="start" className="block max-w-80 px-3 py-2 text-left">
      <span className="block text-sm font-semibold">{annotation.surface}</span>
      <span className="block opacity-75">{annotation.pinyin}</span>
      <span className="mt-1 block">{annotation.definitions.slice(0, 3).join("; ")}</span>
    </TooltipContent>
  </Tooltip>
);

function AnnotatedChildren({ children }: { children: ReactNode }) {
  const { segments } = useContext(GlossContext);
  if (segments.length === 0) return children;
  return annotateNode(children, segments);
}

function annotateNode(node: ReactNode, segments: DictionaryAnnotation[]): ReactNode {
  if (node == null || typeof node === "boolean") return node;
  if (typeof node === "string") return annotateText(node, segments);
  if (typeof node === "number") return node;
  if (Array.isArray(node)) {
    return Children.map(node, (child) => annotateNode(child, segments));
  }
  if (!isValidElement<{ children?: ReactNode }>(node) || node.type === ChineseGloss) {
    return node;
  }
  if (node.type === "code" || (typeof node.type === "function" && node.type.name === "Code")) {
    return node;
  }
  if (node.props.children === undefined) return node;
  return cloneElement(node, undefined, annotateNode(node.props.children, segments));
}

function annotateText(text: string, segments: DictionaryAnnotation[]): ReactNode {
  const output: ReactNode[] = [];
  let cursor = 0;

  while (cursor < text.length) {
    const word = segments.find((item) => text.startsWith(item.surface, cursor));
    if (word) {
      output.push(<ChineseGloss key={`w-${cursor}-${word.surface}`} annotation={word} />);
      cursor += word.surface.length;
      continue;
    }

    const character = String.fromCodePoint(text.codePointAt(cursor)!);
    output.push(character);
    cursor += character.length;
  }

  return Children.toArray(output);
}

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root border-border/50 bg-muted/50 mt-3 flex items-center justify-between rounded-t-xl border border-b-0 px-3.5 py-1.5 text-xs">
      <span className="aui-code-header-language text-muted-foreground font-medium lowercase">
        {language}
      </span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {!isCopied && <CopyIcon className="animate-in zoom-in-75 fade-in duration-150" />}
        {isCopied && <CheckIcon className="animate-in zoom-in-50 fade-in duration-200 ease-out" />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value || typeof navigator === "undefined" || !navigator.clipboard) {
      return;
    }

    navigator.clipboard.writeText(value).then(
      () => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), copiedDuration);
      },
      () => {},
    );
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, children, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mt-5 mb-2 scroll-m-20 text-xl font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h1>
  ),
  h2: ({ className, children, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-5 mb-2 scroll-m-20 text-lg font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h2>
  ),
  h3: ({ className, children, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-4 mb-1.5 scroll-m-20 text-base font-semibold first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h3>
  ),
  h4: ({ className, children, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-3.5 mb-1 scroll-m-20 text-base font-medium first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h4>
  ),
  h5: ({ className, children, ...props }) => (
    <h5
      className={cn("aui-md-h5 mt-3 mb-1 text-sm font-semibold first:mt-0 last:mb-0", className)}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h5>
  ),
  h6: ({ className, children, ...props }) => (
    <h6
      className={cn("aui-md-h6 mt-3 mb-1 text-sm font-medium first:mt-0 last:mb-0", className)}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </h6>
  ),
  p: ({ className, children, ...props }) => (
    <p className={cn("aui-md-p my-3 leading-relaxed first:mt-0 last:mb-0", className)} {...props}>
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </p>
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a text-primary hover:text-primary/80 underline underline-offset-2",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, children, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote border-border text-foreground my-3 border-s-2 ps-4 font-semibold",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </blockquote>
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul marker:text-muted-foreground my-3 ms-5 list-disc [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol marker:text-muted-foreground my-3 ms-5 list-decimal [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr className={cn("aui-md-hr border-muted-foreground/20 my-3", className)} {...props} />
  ),
  table: ({ className, ...props }) => (
    <div className="aui-md-table-wrapper my-3 overflow-x-auto">
      <table
        className={cn("aui-md-table w-full border-separate border-spacing-0", className)}
        {...props}
      />
    </div>
  ),
  th: ({ className, children, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-3 py-1.5 text-start font-medium first:rounded-ss-lg last:rounded-se-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </th>
  ),
  td: ({ className, children, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-muted-foreground/20 border-s border-b px-3 py-1.5 text-start last:border-e [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    >
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </td>
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-es-lg [&:last-child>td:last-child]:rounded-ee-lg",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, children, ...props }) => (
    <li className={cn("aui-md-li leading-relaxed", className)} {...props}>
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </li>
  ),
  strong: ({ className, children, ...props }) => (
    <strong className={cn("aui-md-strong font-bold", className)} {...props}>
      <AnnotatedChildren>{children}</AnnotatedChildren>
    </strong>
  ),
  sup: ({ className, ...props }) => (
    <sup className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)} {...props} />
  ),
  pre: ({ className, ...props }) => (
    <pre
      className={cn(
        "aui-md-pre border-border/50 bg-muted/30 overflow-x-auto rounded-t-none rounded-b-xl border border-t-0 p-3.5 text-[13px] leading-relaxed",
        className,
      )}
      {...props}
    />
  ),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code bg-muted rounded-md px-1.5 py-0.5 font-mono text-[0.85em]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
