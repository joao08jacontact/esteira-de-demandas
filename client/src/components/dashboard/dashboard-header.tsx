import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { formatTime } from "@/lib/utils";

interface DashboardHeaderProps {
  lastUpdate: Date | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  autoRefresh: boolean;
  onAutoRefreshChange: (enabled: boolean) => void;
}

export function DashboardHeader({
  lastUpdate,
  isRefreshing,
  onRefresh,
  autoRefresh,
  onAutoRefreshChange,
}: DashboardHeaderProps) {
  return (
    <div className="border-b border-border bg-card">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold">Dashboard GLPI</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Monitoramento de tickets em tempo real
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {lastUpdate && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" data-testid="badge-last-update">
                  Última atualização: {formatTime(lastUpdate)}
                </Badge>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Switch
                id="auto-refresh"
                checked={autoRefresh}
                onCheckedChange={onAutoRefreshChange}
                data-testid="switch-auto-refresh"
              />
              <Label htmlFor="auto-refresh" className="cursor-pointer text-sm">
                Atualização automática
              </Label>
            </div>

            <Button
              onClick={onRefresh}
              disabled={isRefreshing}
              size="sm"
              variant="outline"
              data-testid="button-refresh"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
