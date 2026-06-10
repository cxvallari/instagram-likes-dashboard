"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeopleGrid } from "@/components/people-grid";
import { fetchAllLikers } from "@/lib/api";
import { analysisLookup } from "@/lib/grid-utils";
import type { GridUser } from "@/components/profile-card";

export function LikersView() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<GridUser[] | null>(null);

  async function analyze() {
    if (!url.trim()) {
      toast.error("Incolla il link di un post Instagram");
      return;
    }
    setLoading(true);
    setUsers(null);
    setCount(0);
    setTotal(0);
    try {
      const likers = await fetchAllLikers(url.trim(), (all, tot) => {
        setCount(all.length);
        setTotal(tot);
      });
      if (!likers.length) {
        toast.error("Nessun like trovato (post privato o link errato?)");
        return;
      }
      const look = analysisLookup();
      const enriched: GridUser[] = likers.map((u) => {
        const k = u.username.toLowerCase();
        return {
          ...u,
          follows_you: look ? look.followers.has(k) : undefined,
          you_follow: look ? look.following.has(k) : undefined,
        };
      });
      setUsers(enriched);
      toast.success(`${enriched.length} like analizzati`);
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
          <Heart className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={url} onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            placeholder="https://www.instagram.com/p/XXXXXXXXX/" className="pl-8" />
        </div>
        <Button onClick={analyze} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
          Analizza like
        </Button>
      </div>
      {loading && (
        <p className="text-sm text-muted-foreground">
          Caricamento like… {count}{total ? ` / ${total}` : ""}
        </p>
      )}
      {users && <PeopleGrid users={users} />}
    </div>
  );
}
