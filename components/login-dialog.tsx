"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, LogIn } from "lucide-react";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login, getProfile } from "@/lib/api";
import { setMain, getMain } from "@/lib/store";
import type { Session } from "@/lib/types";

// Modern, self-contained login dialog. Pre-fills any saved sessionid and always
// persists credentials to localStorage on success.
export function LoginDialog({
  open,
  onOpenChange,
  onLoggedIn,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onLoggedIn: (s: Session) => void;
}) {
  const [sessionid, setSessionid] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

  // Pre-fill from a previously saved session whenever the dialog opens.
  useEffect(() => {
    if (open) {
      const saved = getMain();
      if (saved) {
        setSessionid(saved.sessionid ?? "");
        setUsername(saved.username ?? "");
      }
    }
  }, [open]);

  async function submit() {
    const sid = sessionid.trim();
    if (!sid) {
      toast.error("Inserisci il sessionid");
      return;
    }
    setLoading(true);
    try {
      const r = await login(sid, username.trim());
      if (!r.success) {
        toast.error(r.error || "Login fallito");
        return;
      }
      const session: Session = {
        username: r.username,
        pk: r.pk,
        sessionid: r.sessionid,
        csrftoken: r.csrftoken,
        mid: r.mid,
      };
      // Best-effort: fetch the profile picture for the sidebar avatar.
      try {
        const p = await getProfile(r.username);
        if (p.success && p.profile?.profile_pic_url)
          session.profile_pic_url = p.profile.profile_pic_url;
      } catch {
        /* throttled — fine */
      }
      setMain(session); // persist to localStorage
      toast.success(
        r.confirmed ? `Connesso come @${r.username}` : `Salvato @${r.username} (profilo non verificato)`
      );
      onLoggedIn(session);
      onOpenChange(false);
    } catch (e) {
      toast.error("Errore di rete: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Accedi a Instagram</DialogTitle>
          <DialogDescription>
            Le credenziali restano solo nel tuo browser (localStorage), mai sul server.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="ld-sid">Session ID</Label>
            <Input id="ld-sid" type="password"
              placeholder="cookie 'sessionid' di instagram.com"
              value={sessionid} onChange={(e) => setSessionid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ld-user">Username</Label>
            <Input id="ld-user" placeholder="il_tuo_account"
              value={username} onChange={(e) => setUsername(e.target.value.replace("@", ""))}
              onKeyDown={(e) => e.key === "Enter" && submit()} />
          </div>
          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <LogIn className="mr-2 h-4 w-4" />}
            Accedi
          </Button>

          <details className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">Come trovo il sessionid?</summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Apri instagram.com loggato dal browser</li>
              <li>F12 → Application (o Archiviazione) → Cookie</li>
              <li>Copia il valore del cookie <code className="font-mono">sessionid</code></li>
              <li>Incollalo qui e scrivi il tuo username</li>
            </ol>
          </details>
        </div>
      </DialogContent>
    </Dialog>
  );
}
