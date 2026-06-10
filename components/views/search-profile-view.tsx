"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Search, Loader2, BadgeCheck, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PeopleGrid } from "@/components/people-grid";
import { getProfile, fetchAllConnections, enrichWithFriendship, imgProxy } from "@/lib/api";
import { cacheMany, setCached } from "@/lib/store";
import type { GridUser } from "@/components/profile-card";
import type { IgProfile } from "@/lib/types";

// Analyze ANY profile: search → load their followers/following → grid (enriched
// with your own relationship so the follow filter / badges still mean something).
export function SearchProfileView() {
  const [input, setInput] = useState("");
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [searching, setSearching] = useState(false);
  const [loading, setLoading] = useState(false);
  const [type, setType] = useState<"followers" | "following" | null>(null);
  const [users, setUsers] = useState<GridUser[]>([]);
  const [count, setCount] = useState(0);

  async function search() {
    const u = input.trim().replace(/^@/, "");
    if (!u) return;
    setSearching(true);
    setProfile(null);
    setUsers([]);
    setType(null);
    try {
      const r = await getProfile(u);
      if (r.success && r.profile) {
        setProfile(r.profile);
        setCached(u, {
          pk: r.profile.pk, full_name: r.profile.full_name, biography: r.profile.biography,
          follower_count: r.profile.follower_count, following_count: r.profile.following_count,
          profile_pic_url: r.profile.profile_pic_url, is_private: r.profile.is_private,
          is_verified: r.profile.is_verified, _bioLoaded: true,
        });
      } else {
        toast.error(r.error || "Profilo non trovato (Instagram throttla i profili da cloud)");
      }
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSearching(false);
    }
  }

  async function load(t: "followers" | "following") {
    if (!profile?.pk) {
      toast.error("ID profilo non disponibile");
      return;
    }
    setType(t);
    setLoading(true);
    setUsers([]);
    setCount(0);
    try {
      const all = await fetchAllConnections(profile.pk, t, (u) => setCount(u.length));
      cacheMany(all);
      const enriched = await enrichWithFriendship(all);
      setUsers(enriched);
      toast.success(`${all.length} ${t}`);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={input} onChange={(e) => setInput(e.target.value.replace("@", ""))}
            onKeyDown={(e) => e.key === "Enter" && search()}
            placeholder="Username Instagram (es. cristiano)" className="pl-8" />
        </div>
        <Button onClick={search} disabled={searching}>
          {searching ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Cerca
        </Button>
      </div>

      {profile && (
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
              {profile.profile_pic_url && (
                <Image src={imgProxy(profile.profile_pic_url)} alt={profile.username}
                  fill sizes="64px" className="object-cover" unoptimized />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="font-bold">@{profile.username}</span>
                {profile.is_verified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
                {profile.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
              </div>
              {profile.full_name && <p className="text-sm text-muted-foreground">{profile.full_name}</p>}
              <div className="mt-1 flex gap-4 text-sm">
                <span><strong>{profile.follower_count.toLocaleString("it-IT")}</strong> follower</span>
                <span><strong>{profile.following_count.toLocaleString("it-IT")}</strong> seguiti</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button size="sm" variant={type === "followers" ? "default" : "outline"}
                onClick={() => load("followers")} disabled={loading}>👥 Followers</Button>
              <Button size="sm" variant={type === "following" ? "default" : "outline"}
                onClick={() => load("following")} disabled={loading}>➡️ Following</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading && (
        <p className="text-sm text-muted-foreground">
          Caricamento {type}… {count}
        </p>
      )}
      {users.length > 0 && <PeopleGrid users={users} />}
    </div>
  );
}
