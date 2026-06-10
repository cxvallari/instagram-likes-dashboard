import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  accent,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  accent?: "default" | "green" | "red" | "amber" | "blue";
}) {
  const accentClass = {
    default: "text-foreground",
    green: "text-emerald-500",
    red: "text-red-500",
    amber: "text-amber-500",
    blue: "text-sky-500",
  }[accent ?? "default"];

  return (
    <Card className="overflow-hidden">
      <CardContent className="flex items-center gap-4 p-4">
        <div className={cn("rounded-lg bg-muted p-2.5", accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {label}
          </p>
          <p className={cn("text-2xl font-bold tabular-nums leading-tight", accentClass)}>
            {typeof value === "number" ? value.toLocaleString("it-IT") : value}
          </p>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
