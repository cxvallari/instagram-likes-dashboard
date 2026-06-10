"use client";

import { useEffect, useState } from "react";
import { LogInIcon } from "lucide-react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { AppSidebar, type ViewKey } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { imgProxy } from "@/lib/api";
import { ActionAccountDialog } from "@/components/action-account-dialog";
import { LoginDialog } from "@/components/login-dialog";
import { OverviewView } from "@/components/views/overview-view";
import { HistoryView } from "@/components/views/history-view";
import { SearchProfileView } from "@/components/views/search-profile-view";
import { LikersView } from "@/components/views/likers-view";
import { FavoritesView } from "@/components/views/favorites-view";
import { CategoriesView } from "@/components/views/categories-view";
import { clearMain, runMigrations, setMain } from "@/lib/store";
import { getProfile } from "@/lib/api";
import type { Session } from "@/lib/types";

const TITLES: Record<ViewKey, string> = {
  overview: "Dashboard",
  history: "Cronologia",
  search: "Cerca profilo",
  likers: "Like di un post",
  favorites: "Preferiti",
  categories: "Categorie",
};

const NEEDS_LOGIN: ViewKey[] = ["overview", "history", "search", "likers"];

export function AppShell({
  session,
  onSession,
}: {
  session: Session | null;
  onSession: (s: Session | null) => void;
}) {
  const [view, setView] = useState<ViewKey>("overview");
  const [loginOpen, setLoginOpen] = useState(false);

  useEffect(() => {
    runMigrations(); // one-time: restore "f" with a flower 🌸
  }, []);

  // Backfill the profile photo for restored sessions so the bottom-right avatar shows.
  useEffect(() => {
    if (session && !session.profile_pic_url) {
      getProfile(session.username)
        .then((r) => {
          if (r.success && r.profile?.profile_pic_url) {
            const upd = { ...session, profile_pic_url: r.profile.profile_pic_url };
            setMain(upd);
            onSession(upd);
          }
        })
        .catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.username]);

  const loggedIn = !!session;

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar
        variant="inset"
        view={view}
        onView={setView}
        session={session}
        onLoginClick={() => setLoginOpen(true)}
        onLogout={() => {
          clearMain();
          onSession(null);
        }}
      />
      <SidebarInset>
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <h1 className="text-base font-medium">{TITLES[view]}</h1>
            <div className="ml-auto flex items-center gap-2">
              {loggedIn ? (
                <ActionAccountDialog />
              ) : (
                <Button size="sm" onClick={() => setLoginOpen(true)}>
                  <LogInIcon className="mr-1.5 h-4 w-4" /> Accedi
                </Button>
              )}
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
              {!loggedIn && NEEDS_LOGIN.includes(view) && (
                <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">
                    Accedi con il tuo sessionid per usare questa sezione.
                  </p>
                  <Button onClick={() => setLoginOpen(true)}>
                    <LogInIcon className="mr-1.5 h-4 w-4" /> Accedi
                  </Button>
                </div>
              )}
              {view === "overview" && <OverviewView session={session} />}
              {view === "history" && <HistoryView session={session} />}
              {view === "search" && <SearchProfileView />}
              {view === "likers" && <LikersView />}
              {view === "favorites" && <FavoritesView />}
              {view === "categories" && <CategoriesView />}
            </div>
          </div>
        </div>
      </SidebarInset>

      <LoginDialog open={loginOpen} onOpenChange={setLoginOpen} onLoggedIn={onSession} />

      {/* Bottom-right: your IG profile photo (or login), replacing the Next badge. */}
      {loggedIn ? (
        <a
          href={`https://instagram.com/${session!.username}`}
          target="_blank"
          rel="noreferrer"
          title={`@${session!.username}`}
          className="fixed bottom-4 right-4 z-50 rounded-full ring-2 ring-border shadow-lg transition-transform hover:scale-105"
        >
          <Avatar className="h-11 w-11">
            {session!.profile_pic_url && (
              <AvatarImage src={imgProxy(session!.profile_pic_url)} alt={session!.username} />
            )}
            <AvatarFallback>{session!.username.slice(0, 2).toUpperCase()}</AvatarFallback>
          </Avatar>
        </a>
      ) : (
        <Button
          onClick={() => setLoginOpen(true)}
          className="fixed bottom-4 right-4 z-50 rounded-full shadow-lg"
          size="lg"
        >
          <LogInIcon className="mr-1.5 h-4 w-4" /> Accedi
        </Button>
      )}
    </SidebarProvider>
  );
}
