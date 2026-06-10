"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, History, Search, Heart, Star, Tags, ScanEye, LogOut,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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

type ViewKey = "overview" | "history" | "search" | "likers" | "favorites" | "categories";

const NAV: { group: string; items: { key: ViewKey; label: string; icon: typeof Heart }[] }[] = [
  {
    group: "Principale",
    items: [
      { key: "overview", label: "Panoramica", icon: LayoutDashboard },
      { key: "history", label: "Cronologia", icon: History },
    ],
  },
  {
    group: "Esplora",
    items: [
      { key: "search", label: "Cerca profilo", icon: Search },
      { key: "likers", label: "Like di un post", icon: Heart },
    ],
  },
  {
    group: "Organizza",
    items: [
      { key: "favorites", label: "Preferiti", icon: Star },
      { key: "categories", label: "Categorie", icon: Tags },
    ],
  },
];

const TITLES: Record<ViewKey, string> = {
  overview: "Panoramica",
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
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2 px-2 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-fuchsia-500 to-sky-500 text-white">
              <ScanEye className="h-5 w-5" />
            </div>
            <div className="leading-tight">
              <p className="text-sm font-bold">LikeLens</p>
              <p className="text-xs text-muted-foreground">@{session.username}</p>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          {NAV.map((g) => (
            <SidebarGroup key={g.group}>
              <SidebarGroupLabel>{g.group}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {g.items.map((it) => (
                    <SidebarMenuItem key={it.key}>
                      <SidebarMenuButton
                        isActive={view === it.key}
                        onClick={() => setView(it.key)}
                      >
                        <it.icon />
                        <span>{it.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
        <SidebarFooter>
          <div className="flex items-center justify-between px-2">
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={() => { clearMain(); onLogout(); }} title="Esci">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/80 px-4 backdrop-blur">
          <SidebarTrigger />
          <Separator orientation="vertical" className="mr-1 h-5" />
          <h1 className="text-sm font-semibold">{TITLES[view]}</h1>
          <Badge variant="secondary" className="hidden sm:inline-flex">@{session.username}</Badge>
          <div className="ml-auto">
            <ActionAccountDialog />
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6">
          {view === "overview" && <OverviewView session={session} />}
          {view === "history" && <HistoryView session={session} />}
          {view === "search" && <SearchProfileView />}
          {view === "likers" && <LikersView />}
          {view === "favorites" && <FavoritesView />}
          {view === "categories" && <CategoriesView />}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
