import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlpiTicket } from "@shared/schema";
import { GLPI_STATUS, GLPI_PRIORITY, GLPI_TYPE } from "@shared/schema";
import { formatDateTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface TicketsTableProps {
  tickets?: GlpiTicket[];
  isLoading: boolean;
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

export function TicketsTable({ tickets, isLoading, currentPage, totalPages, onPageChange }: TicketsTableProps) {
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <div className="p-6 space-y-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (!tickets || tickets.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-muted-foreground">Nenhum ticket encontrado</p>
      </Card>
    );
  }

  const getStatusBadgeVariant = (status: number): "default" | "secondary" | "destructive" | "outline" => {
    if (status === 4 || status === 5) return "secondary";
    if (status === 1) return "default";
    if (status === 3) return "outline";
    return "outline";
  };

  const getPriorityBadgeVariant = (priority: number): "default" | "secondary" | "destructive" | "outline" => {
    if (priority >= 5) return "destructive";
    if (priority >= 4) return "default";
    return "secondary";
  };

  return (
    <div className="space-y-4">
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-muted/50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium">ID</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Título</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Status</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Prioridade</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Tipo</th>
                <th className="text-left px-4 py-3 text-sm font-medium">Data de Criação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {tickets.map((ticket) => (
                <tr
                  key={ticket.id}
                  className="hover-elevate"
                  data-testid={`ticket-row-${ticket.id}`}
                >
                  <td className="px-4 py-3 text-sm font-mono">#{ticket.id}</td>
                  <td className="px-4 py-3 text-sm max-w-md truncate" title={ticket.name}>
                    {ticket.name}
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getStatusBadgeVariant(ticket.status)}>
                      {GLPI_STATUS[ticket.status as keyof typeof GLPI_STATUS] || `Status ${ticket.status}`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={getPriorityBadgeVariant(ticket.priority)}>
                      {GLPI_PRIORITY[ticket.priority as keyof typeof GLPI_PRIORITY] || `P${ticket.priority}`}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {GLPI_TYPE[ticket.type as keyof typeof GLPI_TYPE] || "-"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {formatDateTime(ticket.date)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Página {currentPage} de {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage - 1)}
              disabled={currentPage === 1}
              data-testid="button-prev-page"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Anterior
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onPageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              data-testid="button-next-page"
            >
              Próxima
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
