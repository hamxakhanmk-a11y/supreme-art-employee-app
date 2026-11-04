"use client";
// Where the user left a screen: its search, sort, dates, dropdowns, toggles and view tabs, kept for the
// browser session so that going to another tab and coming back finds the screen as it was.
//
// usePageState works like useState, but the value is also saved (sessionStorage, keyed by the page's path
// and a name) and put back the next time the page opens. The first paint shows the initial value; the saved
// one follows straight after mount, since the server cannot see sessionStorage. Only for view state: never
// for form drafts, open dialogs, loaded data or anything that must start fresh.
import { useCallback, useEffect, useState, type Dispatch, type SetStateAction } from "react";
import { usePathname } from "next/navigation";

const PREFIX = "ps:";

function read<T>(key: string): { found: boolean; value?: T } {
  try {
    const raw = sessionStorage.getItem(key);
    return raw == null ? { found: false } : { found: true, value: JSON.parse(raw) as T };
  } catch { return { found: false }; }
}
function write(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode / full: just not kept */ }
}

export function usePageState<T>(name: string, initial: T): [T, Dispatch<SetStateAction<T>>] {
  const pathname = usePathname();
  const key = `${PREFIX}${pathname}:${name}`;
  const [value, setValue] = useState<T>(initial);
  useEffect(() => {
    const saved = read<T>(key);
    if (saved.found) setValue(saved.value as T);
  }, [key]);
  const set = useCallback<Dispatch<SetStateAction<T>>>(next => {
    setValue(prev => {
      const v = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
      write(key, v);
      return v;
    });
  }, [key]);
  return [value, set];
}

// Forget every screen's saved state and the remembered places (used on sign-out, so the next person
// to sign in on this browser starts clean).
export function clearPageState() {
  try {
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const k = sessionStorage.key(i);
      // "store-keep:" is the Store's own (public/store/index.html), same browser tab.
      if (k && (k.startsWith(PREFIX) || k.startsWith("store-keep:") || k === NAV_KEY)) sessionStorage.removeItem(k);
    }
  } catch { /* nothing kept */ }
}

// ---- Remembered places ----
// The last address (path + query) seen in each top-bar section, and the last query seen on each path,
// so the top tabs and the sidebar links lead back to where the user was.
export const NAV_KEY = "nav-memory";
export type NavMemory = { section: Record<string, string>; query: Record<string, string> };

export function readNavMemory(): NavMemory {
  try {
    const m = JSON.parse(sessionStorage.getItem(NAV_KEY) || "null");
    if (m && typeof m === "object") return { section: m.section || {}, query: m.query || {} };
  } catch { /* fall through */ }
  return { section: {}, query: {} };
}
export function rememberPlace(section: string, pathname: string, search: string) {
  const m = readNavMemory();
  m.section[section] = pathname + search;
  if (search) m.query[pathname] = search; else delete m.query[pathname];
  try { sessionStorage.setItem(NAV_KEY, JSON.stringify(m)); } catch { /* not kept */ }
}
