"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Eye, Loader2, ScanEye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { login } from "@/lib/api";
import { setMain } from "@/lib/store";
import type { Session } from "@/lib/types";

export function LoginScreen({ onLoggedIn }: { onLoggedIn: (s: Session) => void }) {
  const [sessionid, setSessionid] = useState("");
  const [username, setUsername] = useState("");
  const [loading, setLoading] = useState(false);

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
      setMain(session);
      toast.success(`Connesso come @${r.username}`);
      onLoggedIn(session);
    } catch (e) {
      toast.error("Errore di rete: " + String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-sky-500 text-white">
            <ScanEye className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl">LikeLens</CardTitle>
          <CardDescription>
            Analytics e gestione follow per Instagram. Le tue credenziali restano
            nel browser (localStorage), mai salvate sul server.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sessionid">Session ID</Label>
            <Input
              id="sessionid"
              type="password"
              placeholder="cookie 'sessionid' di instagram.com"
              value={sessionid}
              onChange={(e) => setSessionid(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="username">Username (opzionale)</Label>
            <Input
              id="username"
              placeholder="rilevato automaticamente"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
            />
          </div>
          <Button className="w-full" onClick={submit} disabled={loading}>
            {loading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Eye className="mr-2 h-4 w-4" />
            )}
            Accedi
          </Button>

          <details className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <summary className="cursor-pointer font-medium text-foreground">
              Come trovo il sessionid?
            </summary>
            <ol className="mt-2 list-decimal space-y-1 pl-4">
              <li>Apri instagram.com loggato dal browser</li>
              <li>F12 → scheda Application (o Archiviazione) → Cookie</li>
              <li>
                Copia il valore del cookie <code className="font-mono">sessionid</code>
              </li>
              <li>Incollalo qui sopra</li>
            </ol>
          </details>
        </CardContent>
      </Card>
    </div>
  );
}
