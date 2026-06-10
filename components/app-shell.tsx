"use client";

import { useEffect, useState } from "react";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { AppSidebar, type ViewKey } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { ActionAccountDialog } from "@/components/action-account-dialog";
import { OverviewView } from "@/components/views/overview-view";
import { HistoryView } from "@/components/views/history-view";
import { SearchProfileView } from "@/components/views/search-profile-view";
import { LikersView } from "@/components/views/likers-view";
import { FavoritesView } from "@/components/views/favorites-view";
import { CategoriesView } from "@/components/views/categories-view";
import { clearMain, runMigrations } from "@/lib/store";
import type { Session } from "@/lib/types";

const TITLES: Record<ViewKey, string> = {
  overview: "Dashboard",
  history: "Cronologia",
  search: "Cerca profilo",
  likers: "Like di un post",
  favorites: "Preferiti",
  categories: "Categorie",
};

export function AppShell({
  session,
  onLogout,
}: {
  session: Session;
  onLogout: () => void;
}) {
  const [view, setView] = useState<ViewKey>("overview");

  useEffect(() => {
    runMigrations(); // one-time: restore "f" with a flower 🌸
  }, []);

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
        username={session.username}
        onLogout={() => {
          clearMain();
          onLogout();
        }}
      />
      <SidebarInset>
        <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear">
          <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
            <h1 className="text-base font-medium">{TITLES[view]}</h1>
            <div className="ml-auto flex items-center gap-2">
              <ActionAccountDialog />
              <ThemeToggle />
            </div>
          </div>
        </header>

        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 px-4 py-4 md:gap-6 md:py-6 lg:px-6">
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
    </SidebarProvider>
  );
}
