"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search, Download, CheckSquare, Square, UserMinus, X, Tag, ImageIcon, Loader2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
  DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { ProfileCard, type GridUser } from "@/components/profile-card";
import { ProfileModal } from "@/components/profile-modal";
import {
  getFavorites, toggleFavorite, getCategories, getProfileCats, toggleCategory,
  assignCategory, getCached, setCached,
} from "@/lib/store";
import { followAction, getProfile, enrichWithFriendship } from "@/lib/api";
import type { FollowFilter, PrivacyFilter, SortKey } from "@/lib/types";

export function PeopleGrid({ users }: { users: GridUser[] }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("default");
  const [followFilter, setFollowFilter] = useState<FollowFilter>("all");
  const [privacy, setPrivacy] = useState<PrivacyFilter>("all");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [tick, setTick] = useState(0); // bump to re-read favorites/categories
  const refresh = () => setTick((t) => t + 1);

  const [selectionMode, setSelectionMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openUser, setOpenUser] = useState<GridUser | null>(null);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [delay, setDelay] = useState(6);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, err: 0, total: 0 });
  const stop = useState({ v: false })[0];

  // Fresh profile-pic URLs fetched on demand (IG CDN links expire over time).
  const [picOverride, setPicOverride] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [refDone, setRefDone] = useState(0);

  // Local copy of the rows so we can enrich them (friendship flags) and refresh
  // images in place, even for cached profiles that arrived without that data.
  const [rows, setRows] = useState<GridUser[]>(users);
  useEffect(() => setRows(users), [users]);
  const [enriching, setEnriching] = useState(false);
  const [enrichDone, setEnrichDone] = useState(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const favorites = useMemo(() => getFavorites(), [tick]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const categories = useMemo(() => getCategories(), [tick]);

  const visible = useMemo(() => {
    let base = rows;
    const q = query.trim().toLowerCase();
    if (catFilter !== "all")
      base = base.filter((u) => getProfileCats(u.username).includes(catFilter));
    if (privacy === "public") base = base.filter((u) => !u.is_private);
    if (privacy === "private") base = base.filter((u) => u.is_private);
    if (privacy === "verified") base = base.filter((u) => u.is_verified);
    if (q)
      base = base.filter((u) =>
        `${u.username} ${u.full_name ?? ""}`.toLowerCase().includes(q)
      );
    if (followFilter !== "all") {
      // Strict boolean checks: profiles whose relationship is still unknown
      // (not enriched) are excluded from both follows/non-follows, never guessed.
      base = base.filter((u) => {
        if (followFilter === "follows_me") return u.follows_you === true;
        if (followFilter === "not_follows_me") return u.follows_you === false;
        if (followFilter === "i_follow") return u.you_follow === true;
        if (followFilter === "not_following") return u.you_follow === false;
        return true;
      });
    }
    if (sort !== "default") {
      const fc = (u: GridUser) => u.follower_count ?? getCached(u.username)?.follower_count ?? 0;
      base = [...base];
      if (sort === "flw_desc") base.sort((a, b) => fc(b) - fc(a));
      if (sort === "flw_asc") base.sort((a, b) => fc(a) - fc(b));
      if (sort === "alpha") base.sort((a, b) => a.username.localeCompare(b.username));
    }
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort, followFilter, privacy, catFilter, tick]);

  // Re-fetch fresh profile pictures for the visible profiles (CDN links expire).
  async function refreshImages() {
    const targets = visible;
    if (!targets.length) return;
    setRefreshing(true);
    setRefDone(0);
    for (let i = 0; i < targets.length; i++) {
      const u = targets[i];
      try {
        const r = await getProfile(u.username);
        if (r.success && r.profile?.profile_pic_url) {
          setCached(u.username, {
            profile_pic_url: r.profile.profile_pic_url,
            full_name: r.profile.full_name, pk: r.profile.pk,
          });
          setPicOverride((p) => ({ ...p, [u.username]: r.profile!.profile_pic_url }));
        }
      } catch {
        /* skip */
      }
      setRefDone(i + 1);
      await new Promise((res) => setTimeout(res, 120));
    }
    setRefreshing(false);
    toast.success("Immagini ricaricate");
  }

  // Check, for the visible profiles, who follows you / who you follow.
  async function enrichFollow() {
    const targets = visible.filter((u) => u.pk || getCached(u.username)?.pk);
    if (!targets.length) {
      toast.error("Nessun ID disponibile — ricarica le immagini prima");
      return;
    }
    setEnriching(true);
    setEnrichDone(0);
    const withPk = targets.map((u) => ({ ...u, pk: u.pk || getCached(u.username)!.pk! }));
    try {
      const enriched = await enrichWithFriendship(withPk);
      const map = new Map(enriched.map((e) => [e.username, e]));
      setRows((prev) =>
        prev.map((u) => {
          const e = map.get(u.username);
          if (!e) return u;
          setCached(u.username, { follows_me: e.follows_you, i_follow: e.you_follow, _friendshipLoaded: true });
          return { ...u, follows_you: e.follows_you, you_follow: e.you_follow };
        })
      );
      setEnrichDone(enriched.length);
      toast.success("Stato follow aggiornato");
    } catch (e) {
      toast.error(String(e));
    } finally {
      setEnriching(false);
    }
  }

  function toggleSel(username: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(username) ? n.delete(username) : n.add(username);
      return n;
    });
  }
  function selectAllVisible() {
    if (selected.size >= visible.length && visible.length > 0) setSelected(new Set());
    else setSelected(new Set(visible.map((u) => u.username)));
  }

  async function singleFollow(u: GridUser, action: "follow" | "unfollow") {
    const id = u.pk || getCached(u.username)?.pk || "";
    if (!id) {
      toast.error("ID non disponibile per @" + u.username);
      return;
    }
    const r = await followAction(id, action);
    if (r.success)
      toast.success(`@${u.username} ${action === "unfollow" ? "rimosso" : "seguito"}`);
    else toast.error(`@${u.username}: ${r.error || "errore"}`);
  }

  function assignCatToSelected(catId: string) {
    selected.forEach((u) => assignCategory(u, catId));
    const c = categories.find((x) => x.id === catId);
    toast.success(`${selected.size} profili → ${c?.emoji} ${c?.name}`);
    refresh();
  }

  async function runBulk() {
    const targets = visible.filter((u) => selected.has(u.username));
    if (!targets.length) {
      toast.error("Nessun profilo selezionato");
      return;
    }
    setRunning(true);
    stop.v = false;
    setProgress({ done: 0, ok: 0, err: 0, total: targets.length });
    let ok = 0, err = 0;
    for (let i = 0; i < targets.length; i++) {
      if (stop.v) break;
      const u = targets[i];
      const id = u.pk || getCached(u.username)?.pk || "";
      try {
        const r = id ? await followAction(id, "unfollow") : { success: false };
        r.success ? ok++ : err++;
      } catch {
        err++;
      }
      setProgress({ done: i + 1, ok, err, total: targets.length });
      if (i < targets.length - 1 && !stop.v)
        await new Promise((res) => setTimeout(res, delay * 1000));
    }
    setRunning(false);
    toast.success(`Unfollow bulk: ${ok} ok, ${err} errori`);
  }

  function exportCSV() {
    const header = "username,full_name,follows_you,you_follow,is_private,is_verified,pk";
    const lines = visible.map((u) =>
      [u.username, `"${(u.full_name || "").replace(/"/g, '""')}"`, u.follows_you ?? "",
       u.you_follow ?? "", u.is_private, u.is_verified, u.pk].join(",")
    );
    const blob = new Blob([[header, ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "export.csv";
    a.click();
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Cerca…" className="pl-8" />
          {query && (
            <button onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[150px]" size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Ordine originale</SelectItem>
            <SelectItem value="flw_desc">Follower ↓</SelectItem>
            <SelectItem value="flw_asc">Follower ↑</SelectItem>
            <SelectItem value="alpha">Nome A→Z</SelectItem>
          </SelectContent>
        </Select>

        <Select value={followFilter} onValueChange={(v) => setFollowFilter(v as FollowFilter)}>
          <SelectTrigger className="w-[150px]" size="sm"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">👥 Tutti</SelectItem>
            <SelectItem value="follows_me">Mi seguono</SelectItem>
            <SelectItem value="not_follows_me">Non mi seguono</SelectItem>
            <SelectItem value="i_follow">Seguo</SelectItem>
            <SelectItem value="not_following">Non seguo</SelectItem>
          </SelectContent>
        </Select>

        {categories.length > 0 && (
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-[150px]" size="sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏷️ Tutte le cat.</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.emoji} {c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="flex gap-1">
          {(["all", "public", "private", "verified"] as PrivacyFilter[]).map((f) => (
            <Button key={f} size="sm" variant={privacy === f ? "default" : "outline"}
              onClick={() => setPrivacy(f)}>
              {f === "all" ? "Tutti" : f === "public" ? "🔓" : f === "private" ? "🔒" : "✓"}
            </Button>
          ))}
        </div>

        <Button size="sm" variant="outline" onClick={enrichFollow} disabled={enriching}>
          {enriching ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
          {enriching ? `Controllo ${enrichDone}/${visible.length}` : "Controlla chi ti segue"}
        </Button>
        <Button size="sm" variant="outline" onClick={refreshImages} disabled={refreshing}>
          {refreshing ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : <ImageIcon className="mr-1.5 h-4 w-4" />}
          {refreshing ? `Immagini ${refDone}/${visible.length}` : "Ricarica immagini"}
        </Button>
        <Button size="sm" variant="outline" onClick={exportCSV}>
          <Download className="mr-1.5 h-4 w-4" /> CSV
        </Button>
        <Button size="sm" variant={selectionMode ? "default" : "outline"}
          onClick={() => { setSelectionMode((s) => !s); setSelected(new Set()); }}>
          ☐ Selezione
        </Button>
      </div>

      {/* Selection bar */}
      {selectionMode && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
          <Button size="sm" variant="ghost" onClick={selectAllVisible}>
            {selected.size > 0 ? <CheckSquare className="mr-1.5 h-4 w-4" /> : <Square className="mr-1.5 h-4 w-4" />}
            {selected.size > 0 ? `${selected.size} selezionati` : "Seleziona tutti"}
          </Button>
          {categories.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" disabled={selected.size === 0}>
                  <Tag className="mr-1.5 h-4 w-4" /> Categoria
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Aggiungi a</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {categories.map((c) => (
                  <DropdownMenuItem key={c.id} onClick={() => assignCatToSelected(c.id)}>
                    {c.emoji} {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="destructive" disabled={selected.size === 0}
              onClick={() => setBulkOpen(true)}>
              <UserMinus className="mr-1.5 h-4 w-4" /> Unfollow selezionati
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{visible.length} profili</p>

      {/* Grid */}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">Nessun profilo.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {visible.map((u) => (
            <ProfileCard
              key={u.username}
              user={picOverride[u.username] ? { ...u, profile_pic_url: picOverride[u.username] } : u}
              isFav={favorites.has(u.username)}
              onToggleFav={() => { toggleFavorite(u.username); refresh(); }}
              assignedCatIds={getProfileCats(u.username)}
              categories={categories}
              onToggleCategory={(catId) => { toggleCategory(u.username, catId); refresh(); }}
              onOpen={() => setOpenUser(u)}
              selectionMode={selectionMode}
              selected={selected.has(u.username)}
              onToggleSelect={() => toggleSel(u.username)}
              onFollow={() => singleFollow(u, "follow")}
              onUnfollow={() => singleFollow(u, "unfollow")}
            />
          ))}
        </div>
      )}

      {/* Profile detail modal */}
      <ProfileModal user={openUser} onClose={() => setOpenUser(null)} />

      {/* Bulk dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !running && setBulkOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Smetti di seguire {selected.size} profili</DialogTitle>
            <DialogDescription>
              Un delay alto riduce il rischio di blocco anti-spam di Instagram.
              Le azioni usano l&apos;account azione se configurato.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Delay tra azioni: {delay}s</Label>
            <Slider min={2} max={60} step={1} value={[delay]}
              onValueChange={(v) => setDelay(v[0])} disabled={running} />
          </div>
          {running && (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>{progress.done}/{progress.total}</span>
                <span>
                  <Badge variant="secondary" className="mr-1">{progress.ok} ok</Badge>
                  {progress.err > 0 && <Badge variant="destructive">{progress.err} err</Badge>}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all"
                  style={{ width: `${(progress.done / Math.max(progress.total, 1)) * 100}%` }} />
              </div>
            </div>
          )}
          <DialogFooter>
            {running ? (
              <Button variant="outline" onClick={() => (stop.v = true)}>Ferma</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setBulkOpen(false)}>Annulla</Button>
                <Button variant="destructive" onClick={runBulk}>Avvia</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
