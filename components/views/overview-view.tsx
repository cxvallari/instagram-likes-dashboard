"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { RefreshCw, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatCard } from "@/components/stat-card";
import { PeopleGrid } from "@/components/people-grid";
import { fetchAllConnections } from "@/lib/api";
import { computeRelations } from "@/lib/relations";
import { saveSnapshot, getSnapshots, getAnalysis, saveAnalysis } from "@/lib/store";
import type { IgUser, Session, Snapshot } from "@/lib/types";

export function OverviewView({ session }: { session: Session | null }) {
  const [followers, setFollowers] = useState<IgUser[]>([]);
  const [following, setFollowing] = useState<IgUser[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [progress, setProgress] = useState({ fol: 0, folg: 0 });

  const ownPk = session?.pk || "";

  // Restore the last saved analysis so we don't re-fetch everything each visit.
  useEffect(() => {
    if (!session) return;
    const saved = getAnalysis(session.username);
    if (saved) {
      setFollowers(saved.followers);
      setFollowing(saved.following);
      setLastUpdated(saved.takenAt);
      setAnalyzed(true);
    }
  }, [session]);

  async function analyze() {
    if (!ownPk || !session) {
      toast.error("ID account non disponibile — riprova il login");
      return;
    }
    setAnalyzing(true);
    setProgress({ fol: 0, folg: 0 });
    try {
      const fol = await fetchAllConnections(ownPk, "followers", (all) =>
        setProgress((p) => ({ ...p, fol: all.length }))
      );
      const folg = await fetchAllConnections(ownPk, "following", (all) =>
        setProgress((p) => ({ ...p, folg: all.length }))
      );
      setFollowers(fol);
      setFollowing(folg);
      // Saved analysis is the source of truth for categories/favorites/search.
      saveAnalysis(session.username, { takenAt: Date.now(), followers: fol, following: folg });
      setLastUpdated(Date.now());
      setAnalyzed(true);
      toast.success(`${fol.length} follower, ${folg.length} seguiti`);
    } catch (e) {
      toast.error("Errore analisi: " + String(e));
    } finally {
      setAnalyzing(false);
    }
  }

  const rel = useMemo(() => computeRelations(followers, following), [followers, following]);

  const followerCount = analyzed ? followers.length : 0;
  const followingCount = analyzed ? following.length : 0;
  const ratio = followingCount > 0 ? (followerCount / followingCount).toFixed(2) : "—";

  function snapshot() {
    if (!session) return;
    const snap: Snapshot = {
      takenAt: Date.now(), username: session.username,
      follower_count: followers.length, following_count: following.length,
      followers: followers.map((u) => u.username),
      following: following.map((u) => u.username),
    };
    saveSnapshot(snap);
    toast.success("Snapshot salvato");
  }
  const snaps = analyzed && session ? getSnapshots(session.username) : [];

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card *:data-[slot=card]:shadow-xs @xl/main:grid-cols-2 @5xl/main:grid-cols-4 dark:*:data-[slot=card]:bg-card">
        <StatCard label="Follower" value={followerCount}
          badge={{ text: `ratio ${ratio}`, up: Number(ratio) >= 1 }}
          footer="Chi ti segue" footerSub="Totale follower dell'account" />
        <StatCard label="Seguiti" value={followingCount}
          footer="Chi segui tu" footerSub="Account che segui" />
        <StatCard label="Non ti seguono"
          value={analyzed ? rel.notFollowingBack.length : "—"}
          badge={analyzed ? { text: "da gestire", up: false } : undefined}
          footer="Segui tu, non ricambiano" footerSub="Candidati all'unfollow" />
        <StatCard label="Fan" value={analyzed ? rel.fans.length : "—"}
          footer="Ti seguono, non ricambi" footerSub="Potresti seguirli" />
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
        <Button onClick={analyze} disabled={analyzing || !ownPk}>
          {analyzing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {analyzed ? "Aggiorna per confronto" : "Analizza follower & seguiti"}
        </Button>
        {analyzing && (
          <span className="text-sm text-muted-foreground">
            follower {progress.fol} · seguiti {progress.folg}
          </span>
        )}
        {analyzed && !analyzing && (
          <>
            <Button variant="outline" size="sm" onClick={snapshot}>
              <Save className="mr-1.5 h-4 w-4" /> Snapshot
            </Button>
            {lastUpdated && (
              <span className="text-xs text-muted-foreground">
                Ultimo aggiornamento: {new Date(lastUpdated).toLocaleString("it-IT")} · dati in
                cache, non serve ricaricare
              </span>
            )}
            {snaps.length > 0 && (
              <Badge variant="secondary">{snaps.length} snapshot</Badge>
            )}
          </>
        )}
      </div>

      {analyzed ? (
        <Tabs defaultValue="nfb">
          <TabsList className="flex-wrap">
            <TabsTrigger value="nfb">Non ti seguono
              <Badge variant="secondary" className="ml-1.5">{rel.notFollowingBack.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="fans">Fan
              <Badge variant="secondary" className="ml-1.5">{rel.fans.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="mutual">Mutual
              <Badge variant="secondary" className="ml-1.5">{rel.mutual.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="all">Tutti
              <Badge variant="secondary" className="ml-1.5">{rel.all.length}</Badge>
            </TabsTrigger>
          </TabsList>
          <TabsContent value="nfb" className="mt-4"><PeopleGrid users={rel.notFollowingBack} /></TabsContent>
          <TabsContent value="fans" className="mt-4"><PeopleGrid users={rel.fans} /></TabsContent>
          <TabsContent value="mutual" className="mt-4"><PeopleGrid users={rel.mutual} /></TabsContent>
          <TabsContent value="all" className="mt-4"><PeopleGrid users={rel.all} /></TabsContent>
        </Tabs>
      ) : (
        <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
          Avvia l&apos;analisi per scoprire chi non ti segue, i fan e i mutual.
        </div>
      )}
    </div>
  );
}
