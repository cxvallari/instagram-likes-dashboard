"use client";

import type { Session, Snapshot } from "./types";

// All credentials live only in the browser's localStorage. The server never
// persists them — it receives them per-request as headers and forwards to IG.

const MAIN_KEY = "ig_main_session";
const ACTION_KEY = "ig_action_session";
const SNAP_KEY = "ig_snapshots";
const WHITELIST_KEY = "ig_whitelist";

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
  }
}

export const getMain = () => read<Session>(MAIN_KEY);
export const setMain = (s: Session) => write(MAIN_KEY, s);
export const clearMain = () => localStorage.removeItem(MAIN_KEY);

export const getAction = () => read<Session>(ACTION_KEY);
export const setAction = (s: Session) => write(ACTION_KEY, s);
export const clearAction = () => localStorage.removeItem(ACTION_KEY);

// ── Whitelist: pks the user never wants flagged as "unfollow me" ──────────────

export function getWhitelist(): Set<string> {
  return new Set(read<string[]>(WHITELIST_KEY) ?? []);
}
export function toggleWhitelist(pk: string): Set<string> {
  const set = getWhitelist();
  if (set.has(pk)) set.delete(pk);
  else set.add(pk);
  write(WHITELIST_KEY, [...set]);
  return set;
}

// ── Snapshots: history of follower/following sets for gained/lost diffing ─────

export function getSnapshots(username: string): Snapshot[] {
  const all = read<Snapshot[]>(SNAP_KEY) ?? [];
  return all
    .filter((s) => s.username === username)
    .sort((a, b) => b.takenAt - a.takenAt);
}

export function saveSnapshot(snap: Snapshot) {
  const all = read<Snapshot[]>(SNAP_KEY) ?? [];
  all.push(snap);
  // Keep the 20 most recent per account to bound storage.
  const trimmed: Snapshot[] = [];
  const counts: Record<string, number> = {};
  for (const s of all.sort((a, b) => b.takenAt - a.takenAt)) {
    counts[s.username] = (counts[s.username] ?? 0) + 1;
    if (counts[s.username] <= 20) trimmed.push(s);
  }
  write(SNAP_KEY, trimmed);
}

// ── Auth headers for API calls ────────────────────────────────────────────────

export function authHeaders(): Record<string, string> {
  const main = getMain();
  const action = getAction();
  const h: Record<string, string> = {};
  if (main) {
    h["X-IG-Session-ID"] = main.sessionid;
    h["X-IG-CSRF-Token"] = main.csrftoken ?? "";
    h["X-IG-MID"] = main.mid ?? "";
    h["X-IG-Username"] = main.username ?? "";
  }
  if (action) {
    h["X-Act-Session-ID"] = action.sessionid;
    h["X-Act-CSRF-Token"] = action.csrftoken ?? "";
    h["X-Act-MID"] = action.mid ?? "";
    h["X-Act-Username"] = action.username ?? "";
  }
  return h;
}
