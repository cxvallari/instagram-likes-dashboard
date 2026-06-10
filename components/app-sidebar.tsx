"use client";

import * as React from "react";
import {
  LayoutDashboardIcon, HistoryIcon, SearchIcon, HeartIcon, StarIcon, TagsIcon,
  ScanEyeIcon, LogOutIcon, LogInIcon,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { imgProxy } from "@/lib/api";
import type { Session } from "@/lib/types";

export type ViewKey =
  | "overview" | "history" | "search" | "likers" | "favorites" | "categories";

const GROUPS: {
  label: string;
  items: { key: ViewKey; title: string; icon: typeof HeartIcon }[];
}[] = [
  {
    label: "Home",
    items: [
      { key: "overview", title: "Dashboard", icon: LayoutDashboardIcon },
      { key: "history", title: "Cronologia", icon: HistoryIcon },
    ],
  },
  {
    label: "Strumenti",
    items: [
      { key: "search", title: "Cerca profilo", icon: SearchIcon },
      { key: "likers", title: "Like di un post", icon: HeartIcon },
    ],
  },
  {
    label: "Organizza",
    items: [
      { key: "favorites", title: "Preferiti", icon: StarIcon },
      { key: "categories", title: "Categorie", icon: TagsIcon },
    ],
  },
];

export function AppSidebar({
  view,
  onView,
  session,
  onLoginClick,
  onLogout,
  ...props
}: {
  view: ViewKey;
  onView: (v: ViewKey) => void;
  session: Session | null;
  onLoginClick: () => void;
  onLogout: () => void;
} & React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton className="data-[slot=sidebar-menu-button]:p-1.5!">
              <ScanEyeIcon className="size-5!" />
              <span className="text-base font-semibold">LikeLens</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {GROUPS.map((g) => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.map((it) => (
                  <SidebarMenuItem key={it.key}>
                    <SidebarMenuButton
                      tooltip={it.title}
                      isActive={view === it.key}
                      onClick={() => onView(it.key)}
                    >
                      <it.icon />
                      <span>{it.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            {session ? (
              <SidebarMenuButton size="lg" onClick={onLogout} tooltip="Esci">
                <Avatar className="h-8 w-8 rounded-lg">
                  {session.profile_pic_url && (
                    <AvatarImage src={imgProxy(session.profile_pic_url)} alt={session.username} />
                  )}
                  <AvatarFallback className="rounded-lg">
                    {session.username.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">@{session.username}</span>
                  <span className="truncate text-xs text-muted-foreground">Esci</span>
                </div>
                <LogOutIcon className="ml-auto size-4" />
              </SidebarMenuButton>
            ) : (
              <SidebarMenuButton size="lg" onClick={onLoginClick} tooltip="Accedi">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-muted">
                  <LogInIcon className="size-4" />
                </div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">Accedi</span>
                  <span className="truncate text-xs text-muted-foreground">
                    Connetti il tuo account
                  </span>
                </div>
              </SidebarMenuButton>
            )}
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
