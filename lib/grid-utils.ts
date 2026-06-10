import { getCached } from "./store";
import type { GridUser } from "@/components/profile-card";

// Build grid users from cached profile data (for Favorites / Category views,
// which work cross-session entirely from the local cache).
export function usersFromCache(usernames: string[]): GridUser[] {
  return usernames.map((username) => {
    const c = getCached(username) ?? {};
    return {
      pk: c.pk ?? "",
      username,
      full_name: c.full_name ?? "",
      profile_pic_url: c.profile_pic_url ?? "",
      is_private: c.is_private ?? false,
      is_verified: c.is_verified ?? false,
      follows_you: c.follows_me,
      you_follow: c.i_follow,
      follower_count: c.follower_count,
      biography: c.biography,
    };
  });
}
