import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TicketStats } from "@shared/schema";
import { TrendingUp, Clock, CheckCircle2, AlertCircle } from "lucide-react";

interface KPICardsProps {
  stats?: TicketStats;
  isLoading: boolean;
}

export function KPICards({ stats, isLoading }: KPICardsProps) {
  const kpis = [
    {
      label: "Total de Tickets",
      value: stats?.total ?? 0,
      icon: TrendingUp,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      testId: "kpi-total",
    },
    {
      label: "Novos",
      value: stats?.new ?? 0,
      icon: AlertCircle,
      color: "text-yellow-500",
      bgColor: "bg-yellow-500/10",
      testId: "kpi-new",
    },
    {
      label: "Em Processamento",
      value: stats?.inProgress ?? 0,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10",
      testId: "kpi-in-progress",
    },
    {
      label: "Resolvidos",
      value: stats?.solved ?? 0,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10",
      testId: "kpi-solved",
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-4 w-24 mb-4" />
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <Card key={kpi.label} className="overflow-hidden">
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
              </div>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">{kpi.label}</p>
              <p className="text-3xl font-bold" data-testid={kpi.testId}>
                {kpi.value}
              </p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
