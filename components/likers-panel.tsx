"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Heart, Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PeoplePanel } from "@/components/people-panel";
import { fetchAllLikers, checkFriendships } from "@/lib/api";
import type { IgUser, Relation } from "@/lib/types";

// Fetch likers of a post, then enrich with friendship status so the user can
// see which likers they already follow / are followed by, and act on them.
export function LikersPanel() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [count, setCount] = useState(0);
  const [total, setTotal] = useState(0);
  const [rows, setRows] = useState<Relation[] | null>(null);

  async function analyze() {
    if (!url.trim()) {
      toast.error("Incolla il link di un post Instagram");
      return;
    }
    setLoading(true);
    setRows(null);
    setCount(0);
    setTotal(0);
    try {
      const likers: IgUser[] = await fetchAllLikers(url.trim(), (all, tot) => {
        setCount(all.length);
        setTotal(tot);
      });
      if (!likers.length) {
        toast.error("Nessun like trovato (post privato o link errato?)");
        return;
      }
      // Enrich with relationship flags in batches.
      const statuses = await checkFriendships(likers.map((u) => u.pk));
      const enriched: Relation[] = likers.map((u) => {
        const st = statuses[u.pk] ?? {};
        return {
          ...u,
          you_follow: Boolean(st.following),
          follows_you: Boolean(st.followed_by),
        };
      });
      setRows(enriched);
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
          <Input
            placeholder="https://www.instagram.com/p/XXXXXXXXX/"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && analyze()}
            className="pl-8"
          />
        </div>
        <Button onClick={analyze} disabled={loading}>
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Analizza like
        </Button>
      </div>

      {loading && (
        <p className="text-sm text-muted-foreground">
          Caricamento like… {count}
          {total ? ` / ${total}` : ""}
        </p>
      )}

      {rows && <PeoplePanel rows={rows} />}
    </div>
  );
}
