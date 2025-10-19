import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface KpiCardProps {
  label: string;
  value: number;
  variant: "default" | "success" | "danger" | "info";
}

export function KpiCard({ label, value, variant }: KpiCardProps) {
  const colorClasses = {
    default: "bg-muted",
    success: "bg-green-500",
    danger: "bg-red-500",
    info: "bg-blue-500",
  };

  return (
    <Card className="relative overflow-hidden">
      <div className={cn("absolute inset-y-0 left-0 w-1", colorClasses[variant])} />
      <CardContent className="p-4 pl-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
          <span className={cn("inline-block w-2 h-2 rounded-full", colorClasses[variant])} />
          <span>{label}</span>
        </div>
        <div className="text-3xl font-semibold" data-testid={`kpi-${label.toLowerCase().replace(/\s+/g, "-")}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
