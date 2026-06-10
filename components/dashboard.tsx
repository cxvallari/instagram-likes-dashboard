"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import {
  Users,
  UserCheck,
  UserX,
  Heart,
  Percent,
  ScanEye,
  LogOut,
  RefreshCw,
  Loader2,
  Camera,
  BadgeCheck,
  Lock,
  Save,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { PeoplePanel } from "@/components/people-panel";
import { LikersPanel } from "@/components/likers-panel";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActionAccountDialog } from "@/components/action-account-dialog";
import { getProfile, fetchAllConnections, imgProxy } from "@/lib/api";
import { computeRelations } from "@/lib/relations";
import {
  clearMain,
  getWhitelist,
  getSnapshots,
  saveSnapshot,
} from "@/lib/store";
import { download, toCSV } from "@/lib/relations";
import type { IgProfile, IgUser, Relation, Session, Snapshot } from "@/lib/types";

export function Dashboard({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [profile, setProfile] = useState<IgProfile | null>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [followers, setFollowers] = useState<IgUser[]>([]);
  const [following, setFollowing] = useState<IgUser[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ fol: 0, folg: 0 });
  const [analyzed, setAnalyzed] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);

  useEffect(() => {
    loadProfile();
    setSnapshots(getSnapshots(session.username));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadProfile() {
    setLoadingProfile(true);
    const r = await getProfile(session.username);
    if (r.success && r.profile) {
      setProfile(r.profile);
    } else {
      // Instagram throttles profile data on datacenter IPs. Fall back to a
      // minimal profile from the session so analysis still works.
      setProfile((prev) =>
        prev ?? {
          pk: session.pk ?? "",
          username: session.username,
          full_name: "",
          biography: "",
          profile_pic_url: "",
          is_private: false,
          is_verified: false,
          follower_count: 0,
          following_count: 0,
          media_count: 0,
        }
      );
    }
    setLoadingProfile(false);
  }

  // pk for API calls: prefer the resolved profile, fall back to the session.
  const ownPk = profile?.pk || session.pk || "";

  async function analyze() {
    if (!ownPk) {
      toast.error("ID account non disponibile — riprova il login");
      return;
    }
    setAnalyzing(true);
    setAnalyzed(false);
    setProgress({ fol: 0, folg: 0 });
    try {
      const fol = await fetchAllConnections(ownPk, "followers", (all) =>
        setProgress((p) => ({ ...p, fol: all.length }))
      );
      setFollowers(fol);
      const folg = await fetchAllConnections(ownPk, "following", (all) =>
        setProgress((p) => ({ ...p, folg: all.length }))
      );
      setFollowing(folg);
      setAnalyzed(true);
      toast.success(`Analisi completa: ${fol.length} follower, ${folg.length} seguiti`);
    } catch (e) {
      toast.error("Errore analisi: " + String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const rel = useMemo(
    () => computeRelations(followers, following),
    [followers, following]
  );

  const whitelistRows: Relation[] = useMemo(() => {
    const wl = getWhitelist();
    return rel.all.filter((r) => wl.has(r.pk));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rel.all, analyzed]);

  function snapshotNow() {
    if (!analyzed || !profile) return;
    const snap: Snapshot = {
      takenAt: Date.now(),
      username: session.username,
      follower_count: followers.length,
      following_count: following.length,
      followerPks: followers.map((u) => u.pk),
      followingPks: following.map((u) => u.pk),
    };
    saveSnapshot(snap);
    setSnapshots(getSnapshots(session.username));
    toast.success("Snapshot salvato");
  }

  // Diff vs the most recent previous snapshot (lost followers).
  const lostFollowers = useMemo(() => {
    if (!analyzed || snapshots.length === 0) return [];
    const prev = snapshots[0];
    const now = new Set(followers.map((u) => u.pk));
    return prev.followerPks.filter((pk) => !now.has(pk));
  }, [analyzed, snapshots, followers]);

  // Prefer counts from the analysis (reliable) over the profile endpoint
  // (often throttled to 0 on datacenter IPs).
  const followerCount = analyzed ? followers.length : profile?.follower_count ?? 0;
  const followingCount = analyzed ? following.length : profile?.following_count ?? 0;

  const ratio =
    followingCount > 0 ? (followerCount / followingCount).toFixed(2) : "—";

  return (
    <div className="flex flex-1 flex-col">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-sky-500 text-white">
            <ScanEye className="h-5 w-5" />
          </div>
          <span className="font-bold">LikeLens</span>
          <Badge variant="secondary" className="hidden sm:inline">
            @{session.username}
          </Badge>
          <div className="ml-auto flex items-center gap-2">
            <ActionAccountDialog />
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => { clearMain(); onLogout(); }} aria-label="Logout">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 space-y-5 px-4 py-5">
        {/* Profile header */}
        <div className="flex items-center gap-4 rounded-xl border bg-card p-4">
          <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
            {profile?.profile_pic_url && (
              <Image
                src={imgProxy(profile.profile_pic_url)}
                alt={session.username}
                fill
                sizes="64px"
                className="object-cover"
                unoptimized
              />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <h1 className="truncate text-lg font-bold">
                {profile?.full_name || session.username}
              </h1>
              {profile?.is_verified && <BadgeCheck className="h-4 w-4 text-sky-500" />}
              {profile?.is_private && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
            </div>
            <p className="text-sm text-muted-foreground">@{session.username}</p>
            {profile?.biography && (
              <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                {profile.biography}
              </p>
            )}
          </div>
          <Button onClick={loadProfile} variant="ghost" size="icon" disabled={loadingProfile}>
            <RefreshCw className={loadingProfile ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
          </Button>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard icon={Users} label="Follower" value={followerCount} accent="blue" />
          <StatCard icon={UserCheck} label="Seguiti" value={followingCount} />
          <StatCard icon={Percent} label="Ratio" value={ratio} accent="amber" />
          <StatCard
            icon={UserX}
            label="Non ti seguono"
            value={analyzed ? rel.notFollowingBack.length : "—"}
            accent="red"
            hint={analyzed ? undefined : "avvia analisi"}
          />
          <StatCard
            icon={Heart}
            label="Fan"
            value={analyzed ? rel.fans.length : "—"}
            accent="green"
            hint={analyzed ? undefined : "non ricambiati"}
          />
        </div>

        {/* Analyze action */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          <Button onClick={analyze} disabled={analyzing || !profile?.pk}>
            {analyzing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            {analyzed ? "Ri-analizza" : "Analizza follower & seguiti"}
          </Button>
          {analyzing && (
            <span className="text-sm text-muted-foreground">
              follower {progress.fol} · seguiti {progress.folg}
            </span>
          )}
          {analyzed && (
            <>
              <Button variant="outline" size="sm" onClick={snapshotNow}>
                <Save className="mr-1.5 h-4 w-4" /> Snapshot
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => download("all-relations.csv", toCSV(rel.all), "text/csv")}
              >
                <Download className="mr-1.5 h-4 w-4" /> Export tutto
              </Button>
              {snapshots.length > 0 && (
                <Badge variant="secondary" className="gap-1">
                  <Camera className="h-3 w-3" />
                  {snapshots.length} snapshot · {lostFollowers.length} persi dall'ultimo
                </Badge>
              )}
            </>
          )}
        </div>

        {/* Tabs */}
        {analyzed ? (
          <Tabs defaultValue="not-following-back">
            <TabsList className="flex-wrap">
              <TabsTrigger value="not-following-back">
                Non ti seguono
                <Badge variant="secondary" className="ml-1.5">
                  {rel.notFollowingBack.length}
                </Badge>
              </TabsTrigger>
              <TabsTrigger value="fans">
                Fan
                <Badge variant="secondary" className="ml-1.5">{rel.fans.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="mutual">
                Mutual
                <Badge variant="secondary" className="ml-1.5">{rel.mutual.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="all">
                Tutti
                <Badge variant="secondary" className="ml-1.5">{rel.all.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="whitelist">
                Whitelist
                <Badge variant="secondary" className="ml-1.5">{whitelistRows.length}</Badge>
              </TabsTrigger>
              <TabsTrigger value="likers">Like post</TabsTrigger>
            </TabsList>

            <TabsContent value="not-following-back" className="mt-4">
              <PeoplePanel rows={rel.notFollowingBack} />
            </TabsContent>
            <TabsContent value="fans" className="mt-4">
              <PeoplePanel rows={rel.fans} />
            </TabsContent>
            <TabsContent value="mutual" className="mt-4">
              <PeoplePanel rows={rel.mutual} />
            </TabsContent>
            <TabsContent value="all" className="mt-4">
              <PeoplePanel rows={rel.all} />
            </TabsContent>
            <TabsContent value="whitelist" className="mt-4">
              <PeoplePanel rows={whitelistRows} />
            </TabsContent>
            <TabsContent value="likers" className="mt-4">
              <LikersPanel />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="rounded-xl border border-dashed p-10 text-center">
            <ScanEye className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Avvia l&apos;analisi per scoprire chi non ti segue, i tuoi fan, i mutual,
              e gestire gli unfollow.
            </p>
            <div className="mt-4">
              <LikersTeaser />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t py-4 text-center text-xs text-muted-foreground">
        LikeLens · credenziali solo nel tuo browser · usa con account secondari per i bulk
      </footer>
    </div>
  );
}

// Likers work without a full analysis, so expose them even before analyzing.
function LikersTeaser() {
  const [open, setOpen] = useState(false);
  if (!open)
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Heart className="mr-1.5 h-4 w-4" /> Analizza i like di un post
      </Button>
    );
  return (
    <div className="mx-auto max-w-2xl text-left">
      <LikersPanel />
    </div>
  );
}
