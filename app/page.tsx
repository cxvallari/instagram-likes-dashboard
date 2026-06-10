"use client";

import { useEffect, useState } from "react";
import { LoginScreen } from "@/components/login-screen";
import { AppShell } from "@/components/app-shell";
import { getMain } from "@/lib/store";
import type { Session } from "@/lib/types";

// Derive the numeric account id from the sessionid (ds_user_id), so accounts
// logged in via the legacy app — which never stored pk — still work.
function withPk(s: Session): Session {
  if (s.pk) return s;
  try {
    const pk = decodeURIComponent(s.sessionid).split(":")[0];
    return { ...s, pk };
  } catch {
    return s;
  }
}

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const s = getMain();
    setSession(s ? withPk(s) : null);
    setReady(true);
  }, []);

  if (!ready) return null;

  return session ? (
    <AppShell session={session} onLogout={() => setSession(null)} />
  ) : (
    <LoginScreen onLoggedIn={(s) => setSession(withPk(s))} />
  );
}
