"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { BadgeCheck, Lock, Loader2, ExternalLink } from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getProfile, fetchAllConnections, imgProxy } from "@/lib/api";
import { setCached, getCached } from "@/lib/store";
import type { GridUser } from "@/components/profile-card";
import type { IgUser } from "@/lib/types";

// Lightweight profile detail: bio + load this user's followers/following as a
// compact grid. Restores the legacy in-app profile modal.
export function ProfileModal({
  user,
  onClose,
}: {
  user: GridUser | null;
  onClose: () => void;
}) {
  const [bio, setBio] = useState<{
    full_name: string; biography: string; follower_count: number;
    following_count: number; profile_pic_url: string; pk: string;
  } | null>(null);
  const [loadingBio, setLoadingBio] = useState(false);
  const [conns, setConns] = useState<IgUser[]>([]);
  const [connType, setConnType] = useState<"followers" | "following" | null>(null);
  const [loadingConns, setLoadingConns] = useState(false);

  useEffect(() => {
    if (!user) return;
    setBio(null);
    setConns([]);
    setConnType(null);
    const cached = getCached(user.username);
    setBio({
      full_name: cached?.full_name ?? user.full_name ?? "",
      biography: cached?.biography ?? "",
      follower_count: cached?.follower_count ?? 0,
      following_count: cached?.following_count ?? 0,
      profile_pic_url: cached?.profile_pic_url ?? user.profile_pic_url ?? "",
      pk: cached?.pk ?? user.pk ?? "",
    });
    setLoadingBio(true);
    getProfile(user.username)
      .then((r) => {
        if (r.success && r.profile) {
          setCached(user.username, {
            pk: r.profile.pk, full_name: r.profile.full_name,
            biography: r.profile.biography, follower_count: r.profile.follower_count,
            following_count: r.profile.following_count,
            profile_pic_url: r.profile.profile_pic_url, _bioLoaded: true,
          });
          setBio({
            full_name: r.profile.full_name, biography: r.profile.biography,
            follower_count: r.profile.follower_count,
            following_count: r.profile.following_count,
            profile_pic_url: r.profile.profile_pic_url, pk: r.profile.pk,
          });
        }
      })
      .finally(() => setLoadingBio(false));
  }, [user]);

  async function load(type: "followers" | "following") {
    if (!user) return;
    const id = bio?.pk || user.pk || getCached(user.username)?.pk || "";
    if (!id) {
      toast.error("ID profilo non disponibile (Instagram throttla i profili da cloud)");
      return;
    }
    setConnType(type);
    setConns([]);
    setLoadingConns(true);
    try {
      const all = await fetchAllConnections(id, type, (u) => setConns([...u]));
      setConns(all);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setLoadingConns(false);
    }
  }

  const open = !!user;
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {user && (
          <>
            <DialogHeader>
              <DialogTitle className="sr-only">@{user.username}</DialogTitle>
            </DialogHeader>
            <div className="flex items-center gap-4">
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full bg-muted">
                {bio?.profile_pic_url && (
                  <Image src={imgProxy(bio.profile_pic_url)} alt={user.username}
                    fill sizes="80px" className="object-cover" unoptimized />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <a href={`https://instagram.com/${user.username}`} target="_blank"
                    rel="noreferrer" className="text-lg font-bold hover:underline">
                    @{user.username}
                  </a>
                  {user.is_verified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
                  {user.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                {bio?.full_name && <p className="text-sm text-muted-foreground">{bio.full_name}</p>}
                {bio?.biography && <p className="mt-1 line-clamp-3 text-xs text-muted-foreground">{bio.biography}</p>}
                <div className="mt-2 flex gap-4 text-sm">
                  <span><strong>{bio?.follower_count?.toLocaleString("it-IT") || "—"}</strong> follower</span>
                  <span><strong>{bio?.following_count?.toLocaleString("it-IT") || "—"}</strong> seguiti</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button size="sm" variant={connType === "followers" ? "default" : "outline"}
                onClick={() => load("followers")} disabled={loadingConns}>
                👥 Followers
              </Button>
              <Button size="sm" variant={connType === "following" ? "default" : "outline"}
                onClick={() => load("following")} disabled={loadingConns}>
                ➡️ Following
              </Button>
              {(loadingBio || loadingConns) && <Loader2 className="h-4 w-4 animate-spin self-center" />}
              {connType && <span className="self-center text-xs text-muted-foreground">{conns.length} caricati</span>}
            </div>

            {conns.length > 0 && (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {conns.map((c) => (
                  <a key={c.pk} href={`https://instagram.com/${c.username}`} target="_blank"
                    rel="noreferrer"
                    onMouseDown={(e) => e.button === 1 && window.open(`https://instagram.com/${c.username}`, "_blank")}
                    className="flex flex-col items-center gap-1 rounded-lg border p-2 text-center hover:bg-muted/50">
                    <div className="relative h-12 w-12 overflow-hidden rounded-full bg-muted">
                      {c.profile_pic_url && (
                        <Image src={imgProxy(c.profile_pic_url)} alt={c.username}
                          fill sizes="48px" className="object-cover" unoptimized />
                      )}
                    </div>
                    <span className="w-full truncate text-[11px] font-medium">@{c.username}</span>
                  </a>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
