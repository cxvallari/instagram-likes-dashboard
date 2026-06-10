"use client";

import type { CachedProfile, Category, Session, Snapshot } from "./types";

// IMPORTANT: these are the SAME localStorage keys the legacy app used. By reusing
// them, the user's existing session, categories ("f" included), category
// assignments and favorites are picked up automatically — nothing was lost, it
// all still lives in the browser under these keys.
const SESS_KEY = "likelens_session";
const ACT_KEY = "likelens_action";
const CAT_KEY = "likelens_categories";
const ASSIGN_KEY = "likelens_profile_cats";
const FAV_KEY = "likelens_favs";
const CACHE_KEY = "likelens_cache";
const SNAP_KEY = "likelens_snapshots";
const MIGRATED_F = "likelens_migrated_f_v1";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
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

// Returns false instead of throwing when the quota is exceeded.
function tryWrite(key: string, value: unknown): boolean {
  if (typeof window === "undefined") return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

// ── Sessions ───────────────────────────────────────────────────────────────────

export const getMain = (): Session | null => {
  const s = read<Session | null>(SESS_KEY, null);
  return s && s.sessionid ? s : null;
};
export const setMain = (s: Session) => write(SESS_KEY, s);
export const clearMain = () => localStorage.removeItem(SESS_KEY);

export const getAction = (): Session | null => {
  const s = read<Session | null>(ACT_KEY, null);
  return s && s.sessionid ? s : null;
};
export const setAction = (s: Session) => write(ACT_KEY, s);
export const clearAction = () => localStorage.removeItem(ACT_KEY);

// ── Favorites (set of usernames, legacy-compatible) ────────────────────────────

export const getFavorites = (): Set<string> =>
  new Set(read<string[]>(FAV_KEY, []));
export const saveFavorites = (favs: Set<string>) => write(FAV_KEY, [...favs]);
export function toggleFavorite(username: string): boolean {
  const favs = getFavorites();
  const added = !favs.has(username);
  if (added) favs.add(username);
  else favs.delete(username);
  saveFavorites(favs);
  return added;
}

// ── Profile cache (per username) ───────────────────────────────────────────────

export const getCache = (): Record<string, CachedProfile> =>
  read<Record<string, CachedProfile>>(CACHE_KEY, {});
export function getCached(username: string): CachedProfile | null {
  return getCache()[username] ?? null;
}
export function setCached(username: string, patch: CachedProfile) {
  const c = getCache();
  c[username] = { ...(c[username] ?? {}), ...patch };
  write(CACHE_KEY, c);
}
export function cacheMany<T extends { username: string }>(profiles: T[]) {
  const c = getCache();
  for (const p of profiles) {
    c[p.username] = { ...(c[p.username] ?? {}), ...(p as Partial<CachedProfile>) };
  }
  write(CACHE_KEY, c);
}

// ── Categories (legacy CatManager, assignments keyed by username) ──────────────

export const PRESET_EMOJI = [
  "👩", "👨", "🌟", "🎨", "💼", "🔥", "💫", "🎮", "🏋️", "🌸",
  "🤖", "🎭", "❤️", "🐱", "🎵", "📸", "💎", "🌙", "🦋", "🎯",
];
export const PRESET_COLORS = [
  "#833ab4", "#fd1d1d", "#fcb045", "#4dff90", "#0095f6",
  "#ff69b4", "#ff6b35", "#c3f73a", "#7ee8fa", "#eecda3",
];

export const getCategories = (): Category[] => read<Category[]>(CAT_KEY, []);
export const saveCategories = (cats: Category[]) => write(CAT_KEY, cats);
export const getCategoryById = (id: string): Category | null =>
  getCategories().find((c) => c.id === id) ?? null;

export const getAssignments = (): Record<string, string[]> =>
  read<Record<string, string[]>>(ASSIGN_KEY, {});
export const saveAssignments = (a: Record<string, string[]>) =>
  write(ASSIGN_KEY, a);

export const getProfileCats = (username: string): string[] =>
  getAssignments()[username] ?? [];

export function createCategory(name: string, emoji: string, color: string): string {
  const cats = getCategories();
  const id = "cat_" + Date.now().toString(36);
  cats.push({ id, name, emoji: emoji || "📁", color: color || "#833ab4" });
  saveCategories(cats);
  return id;
}
export function updateCategory(id: string, name: string, emoji: string, color: string) {
  saveCategories(
    getCategories().map((c) => (c.id === id ? { ...c, name, emoji, color } : c))
  );
}
export function deleteCategory(id: string) {
  saveCategories(getCategories().filter((c) => c.id !== id));
  const a = getAssignments();
  for (const u of Object.keys(a)) a[u] = a[u].filter((cid) => cid !== id);
  saveAssignments(a);
}
export function assignCategory(username: string, catId: string) {
  const a = getAssignments();
  if (!a[username]) a[username] = [];
  if (!a[username].includes(catId)) {
    a[username].push(catId);
    saveAssignments(a);
  }
}
export function unassignCategory(username: string, catId: string) {
  const a = getAssignments();
  if (a[username]) {
    a[username] = a[username].filter((id) => id !== catId);
    saveAssignments(a);
  }
}
export function toggleCategory(username: string, catId: string): boolean {
  const assigned = getProfileCats(username).includes(catId);
  if (assigned) unassignCategory(username, catId);
  else assignCategory(username, catId);
  return !assigned;
}
export function countInCategory(catId: string): number {
  return Object.values(getAssignments()).filter((cats) => cats.includes(catId))
    .length;
}
export function usernamesInCategory(catId: string): string[] {
  const a = getAssignments();
  return Object.keys(a).filter((u) => (a[u] ?? []).includes(catId));
}

// ── One-time recovery: give the "f" category a flower emoji ────────────────────
// The user asked specifically for category "f" to come back with a flower.
export function runMigrations() {
  if (typeof window === "undefined") return;
  if (localStorage.getItem(MIGRATED_F)) return;
  const cats = getCategories();
  let changed = false;
  for (const c of cats) {
    if (c.name.trim().toLowerCase() === "f" && c.emoji !== "🌸") {
      c.emoji = "🌸";
      changed = true;
    }
  }
  if (changed) saveCategories(cats);
  localStorage.setItem(MIGRATED_F, "1");
}

// ── Snapshots ──────────────────────────────────────────────────────────────────

export function getSnapshots(username: string): Snapshot[] {
  return read<Snapshot[]>(SNAP_KEY, [])
    .filter((s) => s.username === username)
    .sort((a, b) => b.takenAt - a.takenAt);
}
export function saveSnapshot(snap: Snapshot) {
  const all = read<Snapshot[]>(SNAP_KEY, []);
  all.push(snap);
  const trimmed: Snapshot[] = [];
  const counts: Record<string, number> = {};
  for (const s of all.sort((a, b) => b.takenAt - a.takenAt)) {
    counts[s.username] = (counts[s.username] ?? 0) + 1;
    if (counts[s.username] <= 10) trimmed.push(s);
  }
  write(SNAP_KEY, trimmed);
}

// ── Persisted analysis (last followers/following load) ────────────────────────
// Cached so the user doesn't re-fetch everything on each visit; a fresh fetch is
// only needed for a new comparison/snapshot.
import type { IgUser } from "./types";

const ANALYSIS_KEY = "likelens_analysis";

export interface SavedAnalysis {
  takenAt: number;
  followers: IgUser[];
  following: IgUser[];
}

export function getAnalysis(username: string): SavedAnalysis | null {
  const all = read<Record<string, SavedAnalysis>>(ANALYSIS_KEY, {});
  return all[username] ?? null;
}

const stripPic = (u: IgUser): IgUser => ({ ...u, profile_pic_url: "" });

// Persist the analysis. Profile-pic URLs are heavy, so if the full payload
// exceeds the localStorage quota we retry without them — the follow-back data
// (usernames/pks) is what matters and always fits.
export function saveAnalysis(username: string, a: SavedAnalysis) {
  const all = read<Record<string, SavedAnalysis>>(ANALYSIS_KEY, {});
  all[username] = a;
  if (tryWrite(ANALYSIS_KEY, all)) return;
  all[username] = {
    ...a,
    followers: a.followers.map(stripPic),
    following: a.following.map(stripPic),
  };
  if (!tryWrite(ANALYSIS_KEY, all)) {
    // Last resort: keep only this account's analysis.
    tryWrite(ANALYSIS_KEY, { [username]: all[username] });
  }
}

// ── Auth headers ───────────────────────────────────────────────────────────────

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
