"use client";

import { useEffect, useState } from "react";
import { LoginScreen } from "@/components/login-screen";
import { Dashboard } from "@/components/dashboard";
import { getMain } from "@/lib/store";
import type { Session } from "@/lib/types";

export default function Home() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  // Restore an existing session from localStorage on first paint.
  useEffect(() => {
    setSession(getMain());
    setReady(true);
  }, []);

  if (!ready) return null;

  return session ? (
    <Dashboard session={session} onLogout={() => setSession(null)} />
  ) : (
    <LoginScreen onLoggedIn={setSession} />
  );
}
