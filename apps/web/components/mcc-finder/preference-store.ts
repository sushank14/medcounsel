"use client";

import { useEffect, useState } from "react";

const KEY = "medcounsel-mcc-finder-prefs-v1";

export function readPreferenceIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(KEY) || "[]") as unknown;
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

export function writePreferenceIds(ids: string[]) {
  window.localStorage.setItem(KEY, JSON.stringify(ids));
  window.dispatchEvent(new Event("mcc-finder-prefs"));
}

export function usePreferenceIds(): [string[], (ids: string[]) => void] {
  const [ids, setIds] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setIds(readPreferenceIds());
    sync();
    window.addEventListener("mcc-finder-prefs", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("mcc-finder-prefs", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);
  return [ids, (next) => writePreferenceIds(next)];
}
