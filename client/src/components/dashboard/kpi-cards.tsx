import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TicketStats } from "@shared/schema";
import { TrendingUp, Clock, CheckCircle2, AlertCircle, Timer, Hourglass, Zap, PauseCircle } from "lucide-react";
import { formatSecondsToHHMMSS } from "@/lib/utils";

interface KPICardsProps {
  stats?: TicketStats;
  isLoading: boolean;
}

export function KPICards({ stats, isLoading }: KPICardsProps) {
  const countKpis = [
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

  const timeKpis = [
    {
      label: "Tempo Médio de Fechamento",
      value: formatSecondsToHHMMSS(stats?.avgCloseDelay ?? 0),
      icon: Timer,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      testId: "kpi-avg-close-delay",
    },
    {
      label: "Tempo Médio de Resolução",
      value: formatSecondsToHHMMSS(stats?.avgSolveDelay ?? 0),
      icon: Zap,
      color: "text-cyan-500",
      bgColor: "bg-cyan-500/10",
      testId: "kpi-avg-solve-delay",
    },
    {
      label: "Tempo Até Primeiro Atendimento",
      value: formatSecondsToHHMMSS(stats?.avgTakeIntoAccountDelay ?? 0),
      icon: Hourglass,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      testId: "kpi-avg-takeintoaccount-delay",
    },
    {
      label: "Tempo Médio em Espera",
      value: formatSecondsToHHMMSS(stats?.avgWaitingDuration ?? 0),
      icon: PauseCircle,
      color: "text-rose-500",
      bgColor: "bg-rose-500/10",
      testId: "kpi-avg-waiting-duration",
    },
  ];

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={`count-${i}`}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={`time-${i}`}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-32 mb-4" />
                <Skeleton className="h-8 w-24" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Count KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {countKpis.map((kpi) => (
          <Card key={kpi.label} className="overflow-hidden hover-elevate">
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

      {/* Time KPIs */}
      <div>
        <h3 className="text-lg font-semibold mb-3">Métricas de Tempo</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {timeKpis.map((kpi) => (
            <Card key={kpi.label} className="overflow-hidden hover-elevate">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <div className={`p-2 rounded-lg ${kpi.bgColor}`}>
                    <kpi.icon className={`h-5 w-5 ${kpi.color}`} />
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.label}</p>
                  <p className="text-2xl font-mono font-bold" data-testid={kpi.testId}>
                    {kpi.value}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
