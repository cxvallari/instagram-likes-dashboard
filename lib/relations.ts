import type { IgUser, Relation } from "./types";

export interface RelationSets {
  all: Relation[];
  notFollowingBack: Relation[]; // you follow them, they don't follow you
  fans: Relation[]; // they follow you, you don't follow back
  mutual: Relation[]; // both
}

export function computeRelations(
  followers: IgUser[],
  following: IgUser[]
): RelationSets {
  const followerPks = new Set(followers.map((u) => u.pk));
  const followingPks = new Set(following.map((u) => u.pk));

  const byPk = new Map<string, IgUser>();
  for (const u of followers) byPk.set(u.pk, u);
  for (const u of following) if (!byPk.has(u.pk)) byPk.set(u.pk, u);

  const all: Relation[] = [...byPk.values()].map((u) => ({
    ...u,
    follows_you: followerPks.has(u.pk),
    you_follow: followingPks.has(u.pk),
  }));

  return {
    all,
    notFollowingBack: all.filter((r) => r.you_follow && !r.follows_you),
    fans: all.filter((r) => r.follows_you && !r.you_follow),
    mutual: all.filter((r) => r.follows_you && r.you_follow),
  };
}
