"use client";

import Image from "next/image";
import { BadgeCheck, Lock, ExternalLink, UserMinus, UserPlus, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { imgProxy } from "@/lib/api";
import type { Relation } from "@/lib/types";

export function UserRow({
  user,
  selected,
  onToggleSelect,
  onAction,
  busy,
  whitelisted,
  onToggleWhitelist,
}: {
  user: Relation;
  selected: boolean;
  onToggleSelect: () => void;
  onAction: (action: "follow" | "unfollow") => void;
  busy: boolean;
  whitelisted: boolean;
  onToggleWhitelist: () => void;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg border border-transparent px-3 py-2 transition-colors hover:bg-muted/50",
        selected && "bg-muted/70 border-border"
      )}
    >
      <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Seleziona" />

      <a
        href={`https://instagram.com/${user.username}`}
        target="_blank"
        rel="noreferrer"
        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full bg-muted"
      >
        {user.profile_pic_url ? (
          <Image
            src={imgProxy(user.profile_pic_url)}
            alt={user.username}
            fill
            sizes="40px"
            className="object-cover"
            unoptimized
          />
        ) : null}
      </a>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <a
            href={`https://instagram.com/${user.username}`}
            target="_blank"
            rel="noreferrer"
            className="truncate text-sm font-semibold hover:underline"
          >
            {user.username}
          </a>
          {user.is_verified && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-500" />}
          {user.is_private && <Lock className="h-3 w-3 shrink-0 text-muted-foreground" />}
        </div>
        {user.full_name && (
          <p className="truncate text-xs text-muted-foreground">{user.full_name}</p>
        )}
      </div>

      <div className="flex items-center gap-2">
        {user.follows_you ? (
          <span className="hidden rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-500 sm:inline">
            ti segue
          </span>
        ) : (
          <span className="hidden rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-medium text-red-500 sm:inline">
            non ti segue
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={whitelisted ? "Rimuovi da whitelist" : "Aggiungi a whitelist (mai unfollow)"}
          onClick={onToggleWhitelist}
        >
          <span className={cn("text-base leading-none", whitelisted ? "opacity-100" : "opacity-30")}>
            ⭐
          </span>
        </Button>

        <a
          href={`https://instagram.com/${user.username}`}
          target="_blank"
          rel="noreferrer"
          className="hidden text-muted-foreground hover:text-foreground sm:block"
        >
          <ExternalLink className="h-4 w-4" />
        </a>

        {user.you_follow ? (
          <Button
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => onAction("unfollow")}
            className="min-w-[96px]"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserMinus className="mr-1 h-3.5 w-3.5" /> Unfollow
              </>
            )}
          </Button>
        ) : (
          <Button
            size="sm"
            disabled={busy}
            onClick={() => onAction("follow")}
            className="min-w-[96px]"
          >
            {busy ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <>
                <UserPlus className="mr-1 h-3.5 w-3.5" /> Follow
              </>
            )}
          </Button>
        )}
      </div>
    </div>
  );
}
