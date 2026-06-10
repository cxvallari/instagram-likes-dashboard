"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Search,
  Download,
  UserMinus,
  CheckSquare,
  Square,
  Loader2,
  X,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { UserRow } from "@/components/user-row";
import { filterAndSort, toCSV, download, type SortKey } from "@/lib/relations";
import { followAction } from "@/lib/api";
import { getWhitelist, toggleWhitelist } from "@/lib/store";
import type { Relation } from "@/lib/types";

export function PeoplePanel({ rows }: { rows: Relation[] }) {
  const [query, setQuery] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [privacy, setPrivacy] = useState<"all" | "private" | "public">("all");
  const [sort, setSort] = useState<SortKey>("default");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [whitelist, setWhitelist] = useState<Set<string>>(() => getWhitelist());
  const [busyPk, setBusyPk] = useState<string | null>(null);
  const [done, setDone] = useState<Set<string>>(new Set()); // pks already actioned this session

  // Bulk dialog state
  const [bulkOpen, setBulkOpen] = useState(false);
  const [delay, setDelay] = useState(6);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, ok: 0, err: 0, total: 0 });
  const stopRef = useState({ stop: false })[0];

  const visible = useMemo(
    () =>
      filterAndSort(rows, {
        query,
        verifiedOnly,
        privateOnly: privacy === "private",
        publicOnly: privacy === "public",
        sort,
      }).filter((r) => !done.has(r.pk)),
    [rows, query, verifiedOnly, privacy, sort, done]
  );

  const selectableUnfollow = visible.filter(
    (r) => r.you_follow && !whitelist.has(r.pk)
  );

  function toggleOne(pk: string) {
    setSelected((s) => {
      const n = new Set(s);
      n.has(pk) ? n.delete(pk) : n.add(pk);
      return n;
    });
  }

  function selectAllVisible() {
    if (selected.size >= selectableUnfollow.length && selectableUnfollow.length > 0) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableUnfollow.map((r) => r.pk)));
    }
  }

  async function singleAction(user: Relation, action: "follow" | "unfollow") {
    setBusyPk(user.pk);
    try {
      const r = await followAction(user.pk, action);
      if (!r.success) {
        toast.error(`@${user.username}: ${r.error || "errore"}`);
        return;
      }
      toast.success(`@${user.username} ${action === "unfollow" ? "rimosso" : "seguito"}`);
      if (action === "unfollow") setDone((d) => new Set(d).add(user.pk));
    } finally {
      setBusyPk(null);
    }
  }

  function toggleWl(pk: string) {
    setWhitelist(toggleWhitelist(pk));
  }

  async function runBulk() {
    const targets = visible.filter(
      (r) => selected.has(r.pk) && r.you_follow && !whitelist.has(r.pk)
    );
    if (!targets.length) {
      toast.error("Nessun utente selezionato da rimuovere");
      return;
    }
    setRunning(true);
    stopRef.stop = false;
    setProgress({ done: 0, ok: 0, err: 0, total: targets.length });
    let ok = 0;
    let err = 0;
    for (let i = 0; i < targets.length; i++) {
      if (stopRef.stop) break;
      const u = targets[i];
      setBusyPk(u.pk);
      try {
        const r = await followAction(u.pk, "unfollow");
        if (r.success) {
          ok++;
          setDone((d) => new Set(d).add(u.pk));
          setSelected((s) => {
            const n = new Set(s);
            n.delete(u.pk);
            return n;
          });
        } else {
          err++;
        }
      } catch {
        err++;
      }
      setProgress({ done: i + 1, ok, err, total: targets.length });
      if (i < targets.length - 1 && !stopRef.stop) {
        await new Promise((res) => setTimeout(res, delay * 1000));
      }
    }
    setBusyPk(null);
    setRunning(false);
    toast.success(`Bulk unfollow finito — ${ok} ok, ${err} errori`);
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[180px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Cerca username o nome…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-8"
          />
          {query && (
            <button
              onClick={() => setQuery("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <Button
          variant={verifiedOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setVerifiedOnly((v) => !v)}
        >
          Verificati
        </Button>

        <Select value={privacy} onValueChange={(v) => setPrivacy(v as typeof privacy)}>
          <SelectTrigger className="w-[130px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="public">Pubblici</SelectItem>
            <SelectItem value="private">Privati</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[150px]" size="sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default">Ordine IG</SelectItem>
            <SelectItem value="username">Username A→Z</SelectItem>
            <SelectItem value="fullname">Nome A→Z</SelectItem>
          </SelectContent>
        </Select>

        <Button
          variant="outline"
          size="sm"
          onClick={() => download("export.csv", toCSV(visible), "text/csv")}
        >
          <Download className="mr-1.5 h-4 w-4" /> CSV
        </Button>
      </div>

      {/* Bulk bar */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <Button variant="ghost" size="sm" onClick={selectAllVisible}>
          {selected.size > 0 ? (
            <CheckSquare className="mr-1.5 h-4 w-4" />
          ) : (
            <Square className="mr-1.5 h-4 w-4" />
          )}
          {selected.size > 0 ? `${selected.size} selezionati` : "Seleziona tutti"}
        </Button>
        <span className="text-xs text-muted-foreground">
          {visible.length} mostrati · {selectableUnfollow.length} unfollowabili
        </span>
        <div className="ml-auto">
          <Button
            variant="destructive"
            size="sm"
            disabled={selected.size === 0}
            onClick={() => setBulkOpen(true)}
          >
            <UserMinus className="mr-1.5 h-4 w-4" />
            Unfollow selezionati
          </Button>
        </div>
      </div>

      {/* List */}
      {visible.length === 0 ? (
        <p className="py-10 text-center text-sm text-muted-foreground">
          Nessun utente in questa categoria.
        </p>
      ) : (
        <div className="space-y-0.5">
          {visible.map((u) => (
            <UserRow
              key={u.pk}
              user={u}
              selected={selected.has(u.pk)}
              onToggleSelect={() => toggleOne(u.pk)}
              onAction={(a) => singleAction(u, a)}
              busy={busyPk === u.pk}
              whitelisted={whitelist.has(u.pk)}
              onToggleWhitelist={() => toggleWl(u.pk)}
            />
          ))}
        </div>
      )}

      {/* Bulk confirm dialog */}
      <Dialog open={bulkOpen} onOpenChange={(o) => !running && setBulkOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conferma unfollow di massa</DialogTitle>
            <DialogDescription>
              Stai per smettere di seguire{" "}
              <strong>
                {
                  visible.filter(
                    (r) => selected.has(r.pk) && r.you_follow && !whitelist.has(r.pk)
                  ).length
                }
              </strong>{" "}
              account. Gli account in whitelist (⭐) vengono saltati. Un delay
              alto riduce il rischio di blocco anti-spam di Instagram.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="delay">Delay tra azioni: {delay}s</Label>
            <input
              id="delay"
              type="range"
              min={2}
              max={60}
              value={delay}
              onChange={(e) => setDelay(Number(e.target.value))}
              disabled={running}
              className="w-full accent-foreground"
            />
          </div>

          {running && (
            <div className="space-y-1 rounded-lg border bg-muted/40 p-3 text-sm">
              <div className="flex justify-between">
                <span>
                  {progress.done}/{progress.total}
                </span>
                <span>
                  <Badge variant="secondary" className="mr-1">
                    {progress.ok} ok
                  </Badge>
                  {progress.err > 0 && (
                    <Badge variant="destructive">{progress.err} err</Badge>
                  )}
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-foreground transition-all"
                  style={{
                    width: `${(progress.done / Math.max(progress.total, 1)) * 100}%`,
                  }}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            {running ? (
              <Button variant="outline" onClick={() => (stopRef.stop = true)}>
                Ferma
              </Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setBulkOpen(false)}>
                  Annulla
                </Button>
                <Button variant="destructive" onClick={runBulk}>
                  {running && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Avvia
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
