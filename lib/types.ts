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
  // true if this user appears in *your* followers list
  follows_you: boolean;
  // true if you appear to follow this user (in your following list)
  you_follow: boolean;
}

export interface Session {
  username: string;
  pk?: string;
  sessionid: string;
  csrftoken?: string;
  mid?: string;
}

export interface Snapshot {
  takenAt: number; // epoch ms
  username: string;
  follower_count: number;
  following_count: number;
  followerPks: string[];
  followingPks: string[];
}
