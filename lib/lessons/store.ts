import { create } from "zustand";
import { indexedDbLessonPersistence, type LessonPersistence } from "@/lib/lessons/persistence";
import { DEFAULT_LESSON_CONFIG, type LessonConfig, type LessonRecord } from "@/lib/lessons/types";

function createLessonId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `lesson-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

type LessonStoreState = {
  hydrated: boolean;
  lessons: LessonRecord[];
  activeLessonId: string | null;
  hydrate: () => Promise<void>;
  setActiveLessonId: (id: string | null) => void;
  createLesson: (input: { title: string; config: LessonConfig }) => Promise<LessonRecord>;
  updateLesson: (
    id: string,
    patch: Partial<Pick<LessonRecord, "title" | "config" | "messages">>,
  ) => Promise<LessonRecord | undefined>;
  deleteLesson: (id: string) => Promise<void>;
};

function sortLessons(lessons: LessonRecord[]): LessonRecord[] {
  return [...lessons].sort((a, b) => b.updatedAt - a.updatedAt);
}

export function createLessonStore(persistence: LessonPersistence) {
  return create<LessonStoreState>((set, get) => ({
    hydrated: false,
    lessons: [],
    activeLessonId: null,
    async hydrate() {
      const lessons = sortLessons(await persistence.list());
      set({ hydrated: true, lessons });
    },
    setActiveLessonId(id) {
      set({ activeLessonId: id });
    },
    async createLesson({ title, config }) {
      const now = Date.now();
      const record: LessonRecord = {
        id: createLessonId(),
        title: title.trim() || "New Lesson",
        createdAt: now,
        updatedAt: now,
        config: { ...DEFAULT_LESSON_CONFIG, ...config },
        messages: { messages: [] },
      };
      await persistence.put(record);
      set({
        lessons: sortLessons([...get().lessons, record]),
        activeLessonId: record.id,
      });
      return record;
    },
    async updateLesson(id, patch) {
      const current = get().lessons.find((lesson) => lesson.id === id);
      if (!current) return undefined;
      const next: LessonRecord = {
        ...current,
        ...patch,
        id: current.id,
        createdAt: current.createdAt,
        updatedAt: Date.now(),
      };
      await persistence.put(next);
      set({
        lessons: sortLessons(get().lessons.map((lesson) => (lesson.id === id ? next : lesson))),
      });
      return next;
    },
    async deleteLesson(id) {
      await persistence.delete(id);
      set((state) => ({
        lessons: state.lessons.filter((lesson) => lesson.id !== id),
        activeLessonId: state.activeLessonId === id ? null : state.activeLessonId,
      }));
    },
  }));
}

export const useLessonStore = createLessonStore(indexedDbLessonPersistence);

export function selectActiveLesson(state: LessonStoreState): LessonRecord | undefined {
  if (!state.activeLessonId) return undefined;
  return state.lessons.find((lesson) => lesson.id === state.activeLessonId);
}
