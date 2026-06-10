"use client";

import { authHeaders } from "./store";
import type { IgProfile, IgUser } from "./types";

async function jget(url: string) {
  const r = await fetch(url, { headers: authHeaders(), cache: "no-store" });
  return r.json();
}
async function jpost(url: string, body: unknown) {
  const r = await fetch(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  return r.json();
}

export const imgProxy = (url: string) =>
  url ? `/api/proxy-image?url=${encodeURIComponent(url)}` : "";

export async function login(sessionid: string, username: string) {
  return jpost("/api/login", { sessionid, username });
}

export async function getProfile(username: string): Promise<{
  success: boolean;
  profile?: IgProfile;
  error?: string;
}> {
  return jget(`/api/profile/${encodeURIComponent(username)}`);
}

// Fetch every page of followers/following, calling onPage as it streams.
export async function fetchAllConnections(
  userId: string,
  type: "followers" | "following",
  onPage: (users: IgUser[], total: number) => void,
  shouldStop?: () => boolean
): Promise<IgUser[]> {
  const all: IgUser[] = [];
  const seen = new Set<string>();
  let maxId = "";
  for (let guard = 0; guard < 500; guard++) {
    if (shouldStop?.()) break;
    const params = new URLSearchParams({ user_id: userId, type, count: "200" });
    if (maxId) params.set("max_id", maxId);
    const data = await jget(`/api/connections?${params.toString()}`);
    if (!data.success) throw new Error(data.error || "Errore caricamento");
    for (const u of data.users as IgUser[]) {
      if (seen.has(u.pk)) continue;
      seen.add(u.pk);
      all.push(u);
    }
    onPage(all, all.length);
    maxId = data.next_max_id || "";
    if (!maxId || !data.users.length) break;
  }
  return all;
}

export async function fetchAllLikers(
  postUrl: string,
  onPage: (users: IgUser[], total: number) => void,
  shouldStop?: () => boolean
): Promise<IgUser[]> {
  const all: IgUser[] = [];
  const seen = new Set<string>();
  let minId = "";
  for (let guard = 0; guard < 500; guard++) {
    if (shouldStop?.()) break;
    const params = new URLSearchParams({ post_url: postUrl });
    if (minId) params.set("min_id", minId);
    const data = await jget(`/api/likers?${params.toString()}`);
    if (!data.success) throw new Error(data.error || "Errore caricamento likers");
    for (const u of data.users as IgUser[]) {
      if (seen.has(u.pk)) continue;
      seen.add(u.pk);
      all.push(u);
    }
    onPage(all, data.user_count || all.length);
    minId = data.next_min_id || "";
    if (!minId || !data.users.length) break;
  }
  return all;
}

export async function followAction(
  userId: string,
  action: "follow" | "unfollow"
): Promise<{ success: boolean; error?: string; pending?: boolean }> {
  return jpost("/api/follow", { user_id: userId, action });
}

export interface FriendshipStatus {
  following?: boolean;
  followed_by?: boolean;
  outgoing_request?: boolean;
  is_private?: boolean;
}

export async function checkFriendships(
  userIds: string[]
): Promise<Record<string, FriendshipStatus>> {
  const data = await jpost("/api/friendships", { user_ids: userIds });
  return data.success ? data.statuses : {};
}

// Enrich a list of users with follows_you / you_follow relative to the logged-in
// account, by batch-querying friendship status.
export async function enrichWithFriendship<
  T extends { pk: string }
>(users: T[]): Promise<(T & { follows_you: boolean; you_follow: boolean })[]> {
  let statuses: Record<string, FriendshipStatus> = {};
  try {
    statuses = await checkFriendships(users.map((u) => u.pk).filter(Boolean));
  } catch {
    /* degraded — flags default to false */
  }
  return users.map((u) => {
    const st = statuses[u.pk] ?? {};
    return { ...u, follows_you: Boolean(st.followed_by), you_follow: Boolean(st.following) };
  });
}
