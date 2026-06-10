export interface IgUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
}

export interface IgProfile extends IgUser {
  biography: string;
  follower_count: number;
  following_count: number;
  media_count: number;
}

// A connection row enriched with the relationship flags we compute client-side.
export interface Relation extends IgUser {
  follows_you: boolean; // appears in your followers list
  you_follow: boolean; // appears in your following list
}

export interface Session {
  username: string;
  pk?: string;
  sessionid: string;
  csrftoken?: string;
  mid?: string;
}

// Saved category (matches the legacy data model exactly for 1:1 recovery).
export interface Category {
  id: string;
  name: string;
  emoji: string;
  color: string;
}

// Per-username cached profile info (legacy `likelens_cache` shape).
export interface CachedProfile {
  pk?: string;
  username?: string;
  full_name?: string;
  biography?: string;
  profile_pic_url?: string;
  follower_count?: number;
  following_count?: number;
  is_private?: boolean;
  is_verified?: boolean;
  follows_me?: boolean;
  i_follow?: boolean;
  _bioLoaded?: boolean;
  _friendshipLoaded?: boolean;
}

export interface Snapshot {
  takenAt: number;
  username: string;
  follower_count: number;
  following_count: number;
  followers: string[]; // usernames, for cross-snapshot diffing + display
  following: string[];
}

export type FollowFilter =
  | "all"
  | "follows_me"
  | "not_follows_me"
  | "i_follow"
  | "not_following";

export type PrivacyFilter = "all" | "public" | "private" | "verified";

export type SortKey = "default" | "flw_desc" | "flw_asc" | "alpha";
