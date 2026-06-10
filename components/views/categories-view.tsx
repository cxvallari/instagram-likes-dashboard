"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CategoryManager } from "@/components/category-manager";
import { PeopleGrid } from "@/components/people-grid";
import { getCategoryById, usernamesInCategory } from "@/lib/store";
import { usersFromCache } from "@/lib/grid-utils";

export function CategoriesView() {
  const [viewing, setViewing] = useState<string | null>(null);

  if (viewing) {
    const cat = getCategoryById(viewing);
    const users = usersFromCache(usernamesInCategory(viewing));
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => setViewing(null)}>
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Tutte le categorie
        </Button>
        <h2 className="text-lg font-semibold" style={{ color: cat?.color }}>
          {cat?.emoji} {cat?.name} <span className="text-sm text-muted-foreground">({users.length})</span>
        </h2>
        {users.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nessun profilo in questa categoria, o i profili non sono ancora in cache.
            Analizza/cerca i profili per popolarli.
          </p>
        ) : (
          <PeopleGrid users={users} />
        )}
      </div>
    );
  }

  return <CategoryManager onView={setViewing} />;
}
