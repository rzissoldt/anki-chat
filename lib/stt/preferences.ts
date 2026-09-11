"use client";

import { useCallback, useEffect, useState } from "react";

export const STT_AUTO_SEND_STORAGE_KEY = "anki-chat:stt-auto-send";

export function readSttAutoSend(storage: Pick<Storage, "getItem">): boolean {
  try {
    return storage.getItem(STT_AUTO_SEND_STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

export function writeSttAutoSend(storage: Pick<Storage, "setItem">, enabled: boolean): void {
  try {
    storage.setItem(STT_AUTO_SEND_STORAGE_KEY, String(enabled));
  } catch {
    // Keep the in-memory preference when browser storage is unavailable.
  }
}

export function useSttAutoSend(): [boolean, (enabled: boolean) => void] {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(readSttAutoSend(window.localStorage));
  }, []);

  const update = useCallback((nextEnabled: boolean) => {
    setEnabled(nextEnabled);
    writeSttAutoSend(window.localStorage, nextEnabled);
  }, []);

  return [enabled, update];
}
