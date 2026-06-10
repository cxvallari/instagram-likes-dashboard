import { Badge } from "@/components/ui/badge";
import {
  Card, CardAction, CardDescription, CardFooter, CardHeader, CardTitle,
} from "@/components/ui/card";
import { TrendingUpIcon, TrendingDownIcon } from "lucide-react";

// Stat card matching the shadcn dashboard-01 example exactly (neutral, no color).
export function StatCard({
  label,
  value,
  badge,
  footer,
  footerSub,
}: {
  label: string;
  value: string | number;
  badge?: { text: string; up?: boolean };
  footer?: string;
  footerSub?: string;
}) {
  const Trend = badge?.up === false ? TrendingDownIcon : TrendingUpIcon;
  return (
    <Card className="@container/card">
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
          {typeof value === "number" ? value.toLocaleString("it-IT") : value}
        </CardTitle>
        {badge && (
          <CardAction>
            <Badge variant="outline">
              <Trend className="size-3.5" />
              {badge.text}
            </Badge>
          </CardAction>
        )}
      </CardHeader>
      {(footer || footerSub) && (
        <CardFooter className="flex-col items-start gap-1.5 text-sm">
          {footer && (
            <div className="line-clamp-1 flex gap-2 font-medium">{footer}</div>
          )}
          {footerSub && <div className="text-muted-foreground">{footerSub}</div>}
        </CardFooter>
      )}
    </Card>
  );
}
