"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, ShieldCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api";
import { getAction, setAction, clearAction } from "@/lib/store";
import type { Session } from "@/lib/types";

// Optional separate account that performs follow/unfollow, so the browsing
// account isn't the one taking write actions (useful to avoid action-blocks).
export function ActionAccountDialog() {
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<Session | null>(null);
  const [sessionid, setSessionid] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => setCurrent(getAction()), [open]);

  async function save() {
    if (!sessionid.trim()) {
      toast.error("Inserisci il sessionid");
      return;
    }
    setLoading(true);
    try {
      const r = await login(sessionid.trim(), username.trim());
      if (!r.success) {
        toast.error(r.error || "Login fallito");
        return;
      }
      const s: Session = {
        username: r.username,
        pk: r.pk,
        sessionid: r.sessionid,
        csrftoken: r.csrftoken,
        mid: r.mid,
      };
      setAction(s);
      setCurrent(s);
      setSessionid("");
      setUsername("");
      toast.success(`Account azione: @${r.username}`);
    } finally {
      setLoading(false);
    }
  }

  function remove() {
    clearAction();
    setCurrent(null);
    toast.success("Account azione rimosso — userò l'account principale");
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <ShieldCheck className="mr-1.5 h-4 w-4" />
          {current ? `@${current.username}` : "Account azione"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Account azione (opzionale)</DialogTitle>
          <DialogDescription>
            Se impostato, follow e unfollow vengono eseguiti da questo account
            invece che dal principale. Lascia vuoto per usare il principale.
          </DialogDescription>
        </DialogHeader>

        {current ? (
          <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
            <span className="text-sm">
              Attivo: <strong>@{current.username}</strong>
            </span>
            <Button variant="destructive" size="sm" onClick={remove}>
              Rimuovi
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="act-sid">Session ID</Label>
              <Input
                id="act-sid"
                type="password"
                value={sessionid}
                onChange={(e) => setSessionid(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="act-user">Username (opzionale)</Label>
              <Input
                id="act-user"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={save} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Salva account azione
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
