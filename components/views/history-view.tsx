"use client";

import { useMemo } from "react";
import { History, UserMinus, UserPlus, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { PeopleGrid } from "@/components/people-grid";
import { getSnapshots } from "@/lib/store";
import { usersFromCache } from "@/lib/grid-utils";
import type { Session } from "@/lib/types";

// Compares the two most recent snapshots to surface who unfollowed you and who's
// new — the single most-requested feature for a basic Instagram user.
export function HistoryView({ session }: { session: Session | null }) {
  const snaps = session ? getSnapshots(session.username) : [];

  const diff = useMemo(() => {
    if (snaps.length < 2) return null;
    const [latest, prev] = snaps;
    const prevSet = new Set(prev.followers);
    const latestSet = new Set(latest.followers);
    const lost = prev.followers.filter((u) => !latestSet.has(u)); // unfollowers
    const gained = latest.followers.filter((u) => !prevSet.has(u)); // new
    return { latest, prev, lost, gained };
  }, [snaps]);

  if (snaps.length === 0)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <Camera className="mx-auto mb-3 h-8 w-8" />
        Nessuno snapshot ancora. Vai su <strong>Panoramica</strong>, analizza il tuo
        account e premi <strong>Snapshot</strong>. Torna qui dopo qualche giorno e un
        secondo snapshot per vedere chi ti ha tolto il follow e i nuovi follower.
      </div>
    );

  if (!diff)
    return (
      <div className="space-y-4">
        <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
          Hai 1 snapshot ({snaps[0].follower_count.toLocaleString("it-IT")} follower,
          salvato il {new Date(snaps[0].takenAt).toLocaleString("it-IT")}). Fai un nuovo
          snapshot più avanti per confrontare e vedere chi ti ha tolto il follow.
        </div>
      </div>
    );

  const lostUsers = usersFromCache(diff.lost);
  const gainedUsers = usersFromCache(diff.gained);
  const net = diff.gained.length - diff.lost.length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground"><UserMinus className="h-5 w-5" /></div>
          <div><p className="text-xs uppercase text-muted-foreground">Unfollower</p>
            <p className="text-2xl font-bold tabular-nums">{diff.lost.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground"><UserPlus className="h-5 w-5" /></div>
          <div><p className="text-xs uppercase text-muted-foreground">Nuovi follower</p>
            <p className="text-2xl font-bold tabular-nums">{diff.gained.length}</p></div>
        </CardContent></Card>
        <Card><CardContent className="flex items-center gap-3 p-4">
          <div className="rounded-lg bg-muted p-2.5 text-muted-foreground"><History className="h-5 w-5" /></div>
          <div><p className="text-xs uppercase text-muted-foreground">Saldo</p>
            <p className="text-2xl font-bold tabular-nums">{net >= 0 ? "+" : ""}{net}</p></div>
        </CardContent></Card>
      </div>

      <p className="text-xs text-muted-foreground">
        Confronto tra {new Date(diff.prev.takenAt).toLocaleDateString("it-IT")} e{" "}
        {new Date(diff.latest.takenAt).toLocaleDateString("it-IT")}.
      </p>

      <Tabs defaultValue="lost">
        <TabsList>
          <TabsTrigger value="lost">Ti hanno tolto il follow
            <Badge variant="secondary" className="ml-1.5">{diff.lost.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="gained">Nuovi follower
            <Badge variant="secondary" className="ml-1.5">{diff.gained.length}</Badge>
          </TabsTrigger>
        </TabsList>
        <TabsContent value="lost" className="mt-4">
          {lostUsers.length ? <PeopleGrid users={lostUsers} enableFollowFilter={false} />
            : <p className="py-8 text-center text-sm text-muted-foreground">Nessun unfollower 🎉</p>}
        </TabsContent>
        <TabsContent value="gained" className="mt-4">
          {gainedUsers.length ? <PeopleGrid users={gainedUsers} enableFollowFilter={false} />
            : <p className="py-8 text-center text-sm text-muted-foreground">Nessun nuovo follower nel periodo.</p>}
        </TabsContent>
      </Tabs>
    </div>
  );
}
