"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getMain } from "@/lib/store";
import type { Session } from "@/lib/types";

// Derive the numeric account id from the sessionid (ds_user_id) for legacy
// sessions that never stored pk.
function withPk(s: Session | null): Session | null {
  if (!s) return null;
  if (s.pk) return s;
  try {
    return { ...s, pk: decodeURIComponent(s.sessionid).split(":")[0] };
  } catch {
    return s;
  }
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setSession(withPk(getMain()));
    setReady(true);
  }, []);

  if (!ready) return null;

  return (
    <AppShell session={session} onSession={(s) => setSession(withPk(s))} />
  );
}
