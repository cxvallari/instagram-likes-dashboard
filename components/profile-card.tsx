"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { BadgeCheck, Lock, Star, Check } from "lucide-react";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuSub,
  ContextMenuSubContent,
  ContextMenuSubTrigger,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { imgProxy } from "@/lib/api";
import type { Category } from "@/lib/types";

export interface GridUser {
  pk: string;
  username: string;
  full_name: string;
  profile_pic_url: string;
  is_private: boolean;
  is_verified: boolean;
  follows_you?: boolean;
  you_follow?: boolean;
  pending?: boolean;
  follower_count?: number;
  biography?: string;
}

export function ProfileCard({
  user,
  isFav,
  onToggleFav,
  assignedCatIds,
  categories,
  onToggleCategory,
  onOpen,
  selectionMode,
  selected,
  onToggleSelect,
  onFollow,
  onUnfollow,
}: {
  user: GridUser;
  isFav: boolean;
  onToggleFav: () => void;
  assignedCatIds: string[];
  categories: Category[];
  onToggleCategory: (catId: string) => void;
  onOpen: () => void;
  selectionMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onFollow: () => void;
  onUnfollow: () => void;
}) {
  const igUrl = `https://www.instagram.com/${user.username}/`;
  const pic = user.profile_pic_url ? imgProxy(user.profile_pic_url) : "";
  const assignedCats = categories.filter((c) => assignedCatIds.includes(c.id));
  // Broken/expired CDN links fall back to a placeholder instead of a blank box.
  const [errored, setErrored] = useState(false);
  useEffect(() => setErrored(false), [pic]);

  function handleMouseDown(e: React.MouseEvent) {
    // Middle-click opens the Instagram profile in a new tab.
    if (e.button === 1) {
      e.preventDefault();
      window.open(igUrl, "_blank", "noopener");
    }
  }

  function handleClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("[data-stop]")) return;
    if (selectionMode) {
      onToggleSelect();
      return;
    }
    onOpen();
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <div
          onClick={handleClick}
          onMouseDown={handleMouseDown}
          onAuxClick={(e) => e.button === 1 && e.preventDefault()}
          className={cn(
            "group relative aspect-square cursor-pointer overflow-hidden rounded-xl border bg-muted transition-all hover:ring-2 hover:ring-primary/40",
            selected && "ring-2 ring-primary"
          )}
        >
          {/* Avatar fills the square */}
          {pic && !errored ? (
            <Image
              src={pic}
              alt={user.username}
              fill
              sizes="(max-width:640px) 45vw, 180px"
              className="object-cover transition-transform duration-300 group-hover:scale-105"
              unoptimized
              onError={() => setErrored(true)}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-4xl text-muted-foreground">
              👤
            </div>
          )}

          {/* Star */}
          <button
            data-stop
            onClick={onToggleFav}
            title={isFav ? "Rimuovi dai preferiti" : "Salva nei preferiti"}
            className="absolute right-1.5 top-1.5 z-10 rounded-full bg-black/45 p-1.5 backdrop-blur transition-colors hover:bg-black/70"
          >
            <Star
              className={cn("h-4 w-4", isFav ? "fill-white text-white" : "text-white/70")}
            />
          </button>

          {/* Selection check */}
          {selectionMode && (
            <div
              data-stop
              onClick={onToggleSelect}
              className={cn(
                "absolute left-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md border-2 backdrop-blur",
                selected
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-white/80 bg-black/30"
              )}
            >
              {selected && <Check className="h-4 w-4" />}
            </div>
          )}

          {/* Category chips (top-left when not selecting) */}
          {!selectionMode && assignedCats.length > 0 && (
            <div className="absolute left-1.5 top-1.5 z-10 flex max-w-[70%] flex-wrap gap-1">
              {assignedCats.map((c) => (
                <span
                  key={c.id}
                  className="rounded-full px-1.5 py-0.5 text-[10px] font-medium backdrop-blur"
                  style={{
                    background: `${c.color}33`,
                    color: "#fff",
                    border: `1px solid ${c.color}`,
                  }}
                >
                  {c.emoji} {c.name}
                </span>
              ))}
            </div>
          )}

          {/* Bottom overlay */}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-2 pt-6">
            <div className="flex items-center gap-1">
              <span className="truncate text-sm font-semibold text-white">
                @{user.username}
              </span>
              {user.is_verified && (
                <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-white" />
              )}
              {user.is_private && (
                <Lock className="h-3 w-3 shrink-0 text-white/70" />
              )}
            </div>
            {user.full_name && (
              <p className="truncate text-xs text-white/70">{user.full_name}</p>
            )}
            <div className="mt-1 flex flex-wrap gap-1">
              {(() => {
                if (user.pending)
                  return (
                    <span className="rounded bg-white/15 px-1.5 py-0.5 text-[10px] font-medium text-white/90">
                      Richiesta inviata
                    </span>
                  );
                if (user.follows_you === undefined && user.you_follow === undefined)
                  return null;
                const fy = user.follows_you;
                const yf = user.you_follow;
                // One unambiguous relationship chip.
                if (yf && fy)
                  return (
                    <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Mutual
                    </span>
                  );
                if (yf && !fy)
                  return (
                    <span className="rounded border border-white/50 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Non ti segue
                    </span>
                  );
                if (!yf && fy)
                  return (
                    <span className="rounded bg-white/25 px-1.5 py-0.5 text-[10px] font-medium text-white">
                      Ti segue
                    </span>
                  );
                return (
                  <span className="rounded border border-white/30 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                    Nessuna relazione
                  </span>
                );
              })()}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>

      <ContextMenuContent className="w-56">
        <ContextMenuItem asChild>
          <a href={igUrl} target="_blank" rel="noreferrer">
            🔗 Apri profilo su Instagram
          </a>
        </ContextMenuItem>
        <ContextMenuItem
          onClick={() => navigator.clipboard?.writeText(user.username)}
        >
          📋 Copia username
        </ContextMenuItem>
        <ContextMenuSeparator />
        <ContextMenuItem onClick={onToggleFav}>
          {isFav ? "★ Rimuovi dai preferiti" : "☆ Salva nei preferiti"}
        </ContextMenuItem>
        <ContextMenuSub>
          <ContextMenuSubTrigger>🏷️ Categorie</ContextMenuSubTrigger>
          <ContextMenuSubContent className="w-48">
            {categories.length === 0 ? (
              <ContextMenuItem disabled>Nessuna categoria</ContextMenuItem>
            ) : (
              categories.map((c) => (
                <ContextMenuItem
                  key={c.id}
                  onClick={() => onToggleCategory(c.id)}
                >
                  <span className="mr-1">{c.emoji}</span>
                  {c.name}
                  {assignedCatIds.includes(c.id) && (
                    <Check className="ml-auto h-4 w-4" />
                  )}
                </ContextMenuItem>
              ))
            )}
          </ContextMenuSubContent>
        </ContextMenuSub>
        <ContextMenuSeparator />
        {user.you_follow ? (
          <ContextMenuItem onClick={onUnfollow} variant="destructive">
            ➖ Smetti di seguire
          </ContextMenuItem>
        ) : (
          <ContextMenuItem onClick={onFollow}>➕ Segui</ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
