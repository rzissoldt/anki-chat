"use client";

import { LessonDialog } from "@/components/lessons/lesson-dialog";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { LessonConfig, LessonRecord } from "@/lib/lessons/types";
import { cn } from "@/lib/utils";
import { PencilIcon, PlusIcon, Settings2Icon, SquarePen, Trash2Icon } from "lucide-react";
import { useState } from "react";

type LessonSidebarProps = {
  collapsed: boolean;
  lessons: LessonRecord[];
  activeLessonId: string | null;
  onNewChat: () => void;
  onSelectLesson: (id: string) => void;
  onCreateLesson: (input: { title: string; config: LessonConfig }) => void;
  onUpdateLesson: (id: string, input: { title: string; config: LessonConfig }) => void;
  onRenameLesson: (id: string, title: string) => void;
  onDeleteLesson: (id: string) => void;
};

export function LessonSidebar({
  collapsed,
  lessons,
  activeLessonId,
  onNewChat,
  onSelectLesson,
  onCreateLesson,
  onUpdateLesson,
  onRenameLesson,
  onDeleteLesson,
}: LessonSidebarProps) {
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<LessonRecord | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const commitRename = (id: string) => {
    const next = renameValue.trim();
    if (next) onRenameLesson(id, next);
    setRenamingId(null);
  };

  return (
    <aside
      className={cn(
        "border-border/60 bg-background flex h-full shrink-0 flex-col border-r transition-[width]",
        collapsed ? "w-12" : "w-64",
      )}
    >
      <div className={cn("flex flex-col gap-1 p-2", collapsed && "items-center")}>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
                className={cn(!collapsed && "w-full justify-start gap-2")}
                onClick={onNewChat}
                aria-label="New Chat"
              />
            }
          >
            <SquarePen className="size-4" />
            {collapsed ? null : <span>New Chat</span>}
          </TooltipTrigger>
          <TooltipContent side="right">New Chat</TooltipContent>
        </Tooltip>
        <Tooltip>
          <TooltipTrigger
            render={
              <Button
                type="button"
                variant="ghost"
                size={collapsed ? "icon" : "sm"}
                className={cn(!collapsed && "w-full justify-start gap-2")}
                onClick={() => setCreateOpen(true)}
                aria-label="New Lesson"
              />
            }
          >
            <PlusIcon className="size-4" />
            {collapsed ? null : <span>New Lesson</span>}
          </TooltipTrigger>
          <TooltipContent side="right">New Lesson</TooltipContent>
        </Tooltip>
      </div>

      {collapsed ? null : (
        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <p className="text-muted-foreground px-2 pb-1.5 text-xs font-medium tracking-wide uppercase">
            Lessons
          </p>
          {lessons.length === 0 ? (
            <p className="text-muted-foreground px-2 text-xs">Noch keine Lessons.</p>
          ) : (
            <ul className="flex flex-col gap-0.5">
              {lessons.map((lesson) => {
                const active = lesson.id === activeLessonId;
                return (
                  <li key={lesson.id} className="group/lesson relative">
                    {renamingId === lesson.id ? (
                      <input
                        value={renameValue}
                        autoFocus
                        onChange={(event) => setRenameValue(event.target.value)}
                        onBlur={() => commitRename(lesson.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") commitRename(lesson.id);
                          if (event.key === "Escape") setRenamingId(null);
                        }}
                        className="border-border bg-background h-8 w-full rounded-md border px-2 text-sm outline-none"
                        aria-label="Lesson umbenennen"
                      />
                    ) : (
                      <button
                        type="button"
                        onClick={() => onSelectLesson(lesson.id)}
                        className={cn(
                          "hover:bg-muted/70 flex h-8 w-full items-center rounded-md px-2 pr-20 text-left text-sm",
                          active && "bg-muted",
                        )}
                      >
                        <span className="truncate">{lesson.title}</span>
                      </button>
                    )}
                    {renamingId === lesson.id ? null : (
                      <div className="absolute top-0.5 right-1 flex items-center opacity-0 group-hover/lesson:opacity-100 group-focus-within/lesson:opacity-100 max-md:opacity-100">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Lesson umbenennen"
                          onClick={() => {
                            setRenamingId(lesson.id);
                            setRenameValue(lesson.title);
                          }}
                        >
                          <PencilIcon className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Lesson bearbeiten"
                          onClick={() => setEditing(lesson)}
                        >
                          <Settings2Icon className="size-3" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-xs"
                          aria-label="Lesson löschen"
                          onClick={() => {
                            if (window.confirm(`Lesson „${lesson.title}“ löschen?`)) {
                              onDeleteLesson(lesson.id);
                            }
                          }}
                        >
                          <Trash2Icon className="size-3" />
                        </Button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      <LessonDialog
        open={createOpen}
        mode="create"
        onOpenChange={setCreateOpen}
        onSave={onCreateLesson}
      />
      <LessonDialog
        open={Boolean(editing)}
        mode="edit"
        initialConfig={editing?.config}
        initialTitle={editing?.title}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
        onSave={(input) => {
          if (!editing) return;
          onUpdateLesson(editing.id, input);
        }}
      />
    </aside>
  );
}
