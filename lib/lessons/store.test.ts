import { describe, expect, it } from "vitest";
import { createMemoryLessonPersistence } from "@/lib/lessons/persistence";
import { createLessonStore } from "@/lib/lessons/store";
import { DEFAULT_LESSON_CONFIG } from "@/lib/lessons/types";

describe("lesson store", () => {
  it("creates, updates, and deletes lessons", async () => {
    const store = createLessonStore(createMemoryLessonPersistence());
    const created = await store.getState().createLesson({
      title: "HSK 1",
      config: { ...DEFAULT_LESSON_CONFIG, enabledHskLevels: [1], selectedStructureIds: [1] },
    });

    expect(store.getState().activeLessonId).toBe(created.id);
    expect(store.getState().lessons).toHaveLength(1);

    await store.getState().updateLesson(created.id, { title: "HSK 1 Drill" });
    expect(store.getState().lessons[0]?.title).toBe("HSK 1 Drill");

    await store.getState().deleteLesson(created.id);
    expect(store.getState().lessons).toHaveLength(0);
    expect(store.getState().activeLessonId).toBeNull();
  });
});
