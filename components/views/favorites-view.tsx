"use client";

import { Star } from "lucide-react";
import { PeopleGrid } from "@/components/people-grid";
import { getFavorites } from "@/lib/store";
import { usersFromCache } from "@/lib/grid-utils";

export function FavoritesView() {
  const favs = [...getFavorites()];
  const users = usersFromCache(favs);

  if (!favs.length)
    return (
      <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
        <Star className="mx-auto mb-3 h-8 w-8" />
        Nessun preferito. Premi la ⭐ su una card per salvarla qui.
      </div>
    );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{favs.length} profili salvati nei preferiti.</p>
      <PeopleGrid users={users} />
    </div>
  );
}
