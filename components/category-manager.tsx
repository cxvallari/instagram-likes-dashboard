"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  getCategories, createCategory, updateCategory, deleteCategory,
  countInCategory, PRESET_EMOJI, PRESET_COLORS,
} from "@/lib/store";
import type { Category } from "@/lib/types";

export function CategoryManager({ onView }: { onView?: (catId: string) => void }) {
  const [tick, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cats = getCategories();

  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📁");
  const [customEmoji, setCustomEmoji] = useState("");
  const [color, setColor] = useState(PRESET_COLORS[0]);

  function openNew() {
    setEditId(null); setName(""); setEmoji("📁"); setCustomEmoji(""); setColor(PRESET_COLORS[0]);
    setShowForm(true);
  }
  function openEdit(c: Category) {
    setEditId(c.id); setName(c.name);
    if (PRESET_EMOJI.includes(c.emoji)) { setEmoji(c.emoji); setCustomEmoji(""); }
    else { setEmoji("📁"); setCustomEmoji(c.emoji); }
    setColor(c.color); setShowForm(true);
  }
  function save() {
    const finalName = name.trim();
    if (!finalName) { toast.error("Inserisci un nome"); return; }
    const finalEmoji = customEmoji.trim() || emoji;
    if (editId) updateCategory(editId, finalName, finalEmoji, color);
    else createCategory(finalName, finalEmoji, color);
    toast.success(editId ? "Categoria aggiornata" : "Categoria creata");
    setShowForm(false); refresh();
  }
  function remove(c: Category) {
    if (!confirm(`Eliminare la categoria "${c.name}"?`)) return;
    deleteCategory(c.id); toast.success("Categoria eliminata"); refresh();
  }

  return (
    <div className="space-y-4" key={tick}>
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Le tue categorie</h2>
        <Button size="sm" onClick={openNew}><Plus className="mr-1.5 h-4 w-4" /> Nuova</Button>
      </div>

      {cats.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Nessuna categoria. Creane una per organizzare i profili.
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {cats.map((c) => (
            <Card key={c.id}>
              <CardContent className="flex items-center gap-3 p-3">
                <span className="text-2xl">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold" style={{ color: c.color }}>{c.name}</p>
                  <p className="text-xs text-muted-foreground">{countInCategory(c.id)} profili</p>
                </div>
                {onView && (
                  <Button size="icon" variant="ghost" onClick={() => onView(c.id)} title="Mostra profili">
                    <Eye className="h-4 w-4" />
                  </Button>
                )}
                <Button size="icon" variant="ghost" onClick={() => openEdit(c)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => remove(c)}><Trash2 className="h-4 w-4 text-red-500" /></Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <Card>
          <CardContent className="space-y-3 p-4">
            <p className="font-semibold">{editId ? "Modifica categoria" : "Nuova categoria"}</p>
            <div className="space-y-1.5">
              <Label>Nome</Label>
              <Input value={name} maxLength={30} onChange={(e) => setName(e.target.value)}
                placeholder="Es. Ragazze anime" />
            </div>
            <div className="space-y-1.5">
              <Label>Emoji</Label>
              <div className="flex flex-wrap gap-1">
                {PRESET_EMOJI.map((em) => (
                  <button key={em} onClick={() => { setEmoji(em); setCustomEmoji(""); }}
                    className={cn("rounded-md border p-1.5 text-lg leading-none",
                      emoji === em && !customEmoji && "ring-2 ring-primary")}>
                    {em}
                  </button>
                ))}
              </div>
              <Input value={customEmoji} maxLength={2} onChange={(e) => setCustomEmoji(e.target.value)}
                placeholder="✏️ emoji personalizzata" className="mt-1 w-40" />
            </div>
            <div className="space-y-1.5">
              <Label>Colore</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRESET_COLORS.map((cl) => (
                  <button key={cl} onClick={() => setColor(cl)}
                    style={{ background: cl }}
                    className={cn("h-7 w-7 rounded-full border-2",
                      color === cl ? "border-foreground" : "border-transparent")} />
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={save} className="flex-1">Salva</Button>
              <Button variant="ghost" onClick={() => setShowForm(false)}>Annulla</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
