import { normalizeLessonConfig, type LessonRecord } from "@/lib/lessons/types";

const DB_NAME = "anki-chat:lessons";
const DB_VERSION = 1;
const STORE_NAME = "lessons";

export type LessonPersistence = {
  list(): Promise<LessonRecord[]>;
  get(id: string): Promise<LessonRecord | undefined>;
  put(record: LessonRecord): Promise<void>;
  delete(id: string): Promise<void>;
};

function normalizeLessonRecord(value: unknown): LessonRecord | null {
  if (!value || typeof value !== "object") return null;
  const record = value as LessonRecord;
  const config = normalizeLessonConfig(record.config);
  if (
    typeof record.id !== "string" ||
    typeof record.title !== "string" ||
    typeof record.createdAt !== "number" ||
    typeof record.updatedAt !== "number" ||
    !config
  ) {
    return null;
  }
  return {
    id: record.id,
    title: record.title,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    config,
    messages: record.messages,
  };
}

function openLessonsDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Failed to open lesson database."));
  });
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Lesson database request failed."));
  });
}

export const indexedDbLessonPersistence: LessonPersistence = {
  async list() {
    const db = await openLessonsDb();
    try {
      const rows = await requestToPromise(
        db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll(),
      );
      return (Array.isArray(rows) ? rows : [])
        .map(normalizeLessonRecord)
        .filter((row): row is LessonRecord => row !== null);
    } finally {
      db.close();
    }
  },
  async get(id) {
    const db = await openLessonsDb();
    try {
      const row = await requestToPromise(
        db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(id),
      );
      return normalizeLessonRecord(row) ?? undefined;
    } finally {
      db.close();
    }
  },
  async put(record) {
    const db = await openLessonsDb();
    try {
      await requestToPromise(
        db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record),
      );
    } finally {
      db.close();
    }
  },
  async delete(id) {
    const db = await openLessonsDb();
    try {
      await requestToPromise(
        db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).delete(id),
      );
    } finally {
      db.close();
    }
  },
};

export function createMemoryLessonPersistence(initial: LessonRecord[] = []): LessonPersistence {
  const records = new Map(initial.map((record) => [record.id, record]));
  return {
    async list() {
      return [...records.values()];
    },
    async get(id) {
      return records.get(id);
    },
    async put(record) {
      records.set(record.id, record);
    },
    async delete(id) {
      records.delete(id);
    },
  };
}
