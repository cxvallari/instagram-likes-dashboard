import type { IgUser, Relation } from "./types";

export interface RelationSets {
  // everyone, keyed by pk, with follows_you / you_follow flags resolved
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

  // Union of both lists, de-duplicated by pk.
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

export type SortKey = "username" | "fullname" | "default";

export function filterAndSort(
  rows: Relation[],
  opts: {
    query: string;
    verifiedOnly: boolean;
    privateOnly: boolean;
    publicOnly: boolean;
    sort: SortKey;
  }
): Relation[] {
  const q = opts.query.trim().toLowerCase();
  let out = rows.filter((r) => {
    if (q && !r.username.toLowerCase().includes(q) && !r.full_name.toLowerCase().includes(q))
      return false;
    if (opts.verifiedOnly && !r.is_verified) return false;
    if (opts.privateOnly && !r.is_private) return false;
    if (opts.publicOnly && r.is_private) return false;
    return true;
  });
  if (opts.sort === "username")
    out = [...out].sort((a, b) => a.username.localeCompare(b.username));
  else if (opts.sort === "fullname")
    out = [...out].sort((a, b) => a.full_name.localeCompare(b.full_name));
  return out;
}

export function toCSV(rows: Relation[]): string {
  const header = "username,full_name,follows_you,you_follow,is_private,is_verified,pk";
  const lines = rows.map((r) =>
    [
      r.username,
      `"${(r.full_name || "").replace(/"/g, '""')}"`,
      r.follows_you,
      r.you_follow,
      r.is_private,
      r.is_verified,
      r.pk,
    ].join(",")
  );
  return [header, ...lines].join("\n");
}

export function download(filename: string, content: string, mime = "text/plain") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
