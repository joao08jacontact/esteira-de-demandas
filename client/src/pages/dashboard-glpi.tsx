import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { KPICards } from "@/components/dashboard/kpi-cards";
import { FilterPanel } from "@/components/dashboard/filter-panel";
import { ChartsSection } from "@/components/dashboard/charts-section";
import { TicketsTable } from "@/components/dashboard/tickets-table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";
import type { GlpiTicket, TicketFilters, TicketStats } from "@shared/schema";

const ITEMS_PER_PAGE = 20;
const AUTO_REFRESH_INTERVAL = 30000; // 30 seconds

export default function DashboardGlpi() {
  const [filters, setFilters] = useState<TicketFilters>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Build query params for API
  const buildQueryString = (filters: TicketFilters, page?: number) => {
    const params = new URLSearchParams();
    if (filters.search) params.append("search", filters.search);
    if (filters.status) params.append("status", JSON.stringify(filters.status));
    if (filters.priority) params.append("priority", JSON.stringify(filters.priority));
    if (filters.category) params.append("category", JSON.stringify(filters.category));
    if (filters.type) params.append("type", JSON.stringify(filters.type));
    if (filters.dateFrom) params.append("dateFrom", filters.dateFrom);
    if (filters.dateTo) params.append("dateTo", filters.dateTo);
    if (filters.closeDateFrom) params.append("closeDateFrom", filters.closeDateFrom);
    if (filters.closeDateTo) params.append("closeDateTo", filters.closeDateTo);
    if (filters.name) params.append("name", filters.name);
    if (filters.users_id_recipient) params.append("users_id_recipient", JSON.stringify(filters.users_id_recipient));
    if (page) params.append("page", page.toString());
    params.append("limit", ITEMS_PER_PAGE.toString());
    return params.toString();
  };

  // Fetch tickets
  const {
    data: tickets,
    isLoading: isLoadingTickets,
    refetch: refetchTickets,
    isFetching: isFetchingTickets,
    error: ticketsError,
  } = useQuery<GlpiTicket[]>({
    queryKey: [`/api/tickets?${buildQueryString(filters, currentPage)}`],
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Fetch stats
  const {
    data: stats,
    isLoading: isLoadingStats,
    refetch: refetchStats,
    error: statsError,
  } = useQuery<TicketStats>({
    queryKey: [`/api/tickets/stats?${buildQueryString(filters)}`],
    refetchInterval: autoRefresh ? AUTO_REFRESH_INTERVAL : false,
    refetchOnWindowFocus: true,
    retry: 2,
  });

  // Update last update time
  useEffect(() => {
    if (tickets || stats) {
      setLastUpdate(new Date());
    }
  }, [tickets, stats]);

  const handleRefresh = () => {
    refetchTickets();
    refetchStats();
  };

  const handleFiltersChange = (newFilters: TicketFilters) => {
    setFilters(newFilters);
    setCurrentPage(1); // Reset to first page when filters change
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Calculate active filter count
  const activeFilterCount = [
    filters.search,
    filters.status?.length,
    filters.priority?.length,
    filters.category?.length,
    filters.type?.length,
    filters.dateFrom,
    filters.dateTo,
    filters.closeDateFrom,
    filters.closeDateTo,
    filters.name,
    filters.users_id_recipient?.length,
  ].filter(Boolean).length;

  // Calculate total pages
  const totalPages = tickets && stats ? Math.max(1, Math.ceil(stats.total / ITEMS_PER_PAGE)) : 1;

  // Error state
  const hasError = ticketsError || statsError;

  return (
    <div className="flex-1 overflow-auto">
      <DashboardHeader
        lastUpdate={lastUpdate}
        isRefreshing={isFetchingTickets}
        onRefresh={handleRefresh}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
      />

      <FilterPanel
        filters={filters}
        onFiltersChange={handleFiltersChange}
        activeFilterCount={activeFilterCount}
      />

      <main className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-8 space-y-8">
        {hasError && (
          <Alert variant="destructive" data-testid="alert-error">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Erro ao carregar dados</AlertTitle>
            <AlertDescription className="flex items-center justify-between">
              <span>
                Não foi possível conectar com a API GLPI. Verifique as credenciais e tente novamente.
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                data-testid="button-retry"
              >
                Tentar Novamente
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <KPICards stats={stats} isLoading={isLoadingStats} />
        
        <ChartsSection stats={stats} isLoading={isLoadingStats} />
        
        <div>
          <h2 className="text-xl font-semibold mb-4">Tickets Recentes</h2>
          <TicketsTable
            tickets={tickets}
            isLoading={isLoadingTickets}
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      </main>
    </div>
  );
}
