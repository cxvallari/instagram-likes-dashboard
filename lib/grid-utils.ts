import { getCached, getMain, getAnalysis } from "./store";
import type { GridUser } from "@/components/profile-card";
import type { IgUser } from "./types";

interface AnalysisLookup {
  followers: Set<string>;
  following: Set<string>;
  by: Map<string, IgUser>; // username(lower) -> richest record (pic, full_name…)
}

// Build fast lookup structures from the logged user's last full analysis. This
// is the GROUND TRUTH for follow-back (the followers/following endpoints work,
// unlike the friendship API which Instagram blocks).
export function analysisLookup(): AnalysisLookup | null {
  const me = getMain();
  const a = me ? getAnalysis(me.username) : null;
  if (!a) return null;
  const followers = new Set(a.followers.map((u) => u.username.toLowerCase()));
  const following = new Set(a.following.map((u) => u.username.toLowerCase()));
  const by = new Map<string, IgUser>();
  for (const u of [...a.followers, ...a.following]) {
    const k = u.username.toLowerCase();
    const prev = by.get(k);
    // prefer the record that carries a picture
    if (!prev || (!prev.profile_pic_url && u.profile_pic_url)) by.set(k, u);
  }
  return { followers, following, by };
}

// Build grid users for a list of usernames (Favorites / a Category), resolving
// follow-back status and pictures from the analysis first, cache second.
export function usersFromCache(usernames: string[]): GridUser[] {
  const look = analysisLookup();
  return usernames.map((username) => {
    const k = username.toLowerCase();
    const c = getCached(username) ?? {};
    const a = look?.by.get(k);
    return {
      pk: a?.pk || c.pk || "",
      username,
      full_name: a?.full_name ?? c.full_name ?? "",
      profile_pic_url: a?.profile_pic_url || c.profile_pic_url || "",
      is_private: a?.is_private ?? c.is_private ?? false,
      is_verified: a?.is_verified ?? c.is_verified ?? false,
      // Follow status strictly from the analysis (reliable); undefined when we
      // have no analysis yet, so nothing is mislabelled as "Non ti segue".
      follows_you: look ? look.followers.has(k) : undefined,
      you_follow: look ? look.following.has(k) : undefined,
      follower_count: c.follower_count,
      biography: c.biography,
    };
  });
}
