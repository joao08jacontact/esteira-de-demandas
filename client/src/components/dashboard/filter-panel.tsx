import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Filter, X } from "lucide-react";
import type { TicketFilters } from "@shared/schema";
import { GLPI_STATUS } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface FilterPanelProps {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  activeFilterCount: number;
}

interface Category {
  id: number;
  name: string;
}

interface User {
  id: number;
  name: string;
}

export function FilterPanel({ filters, onFiltersChange, activeFilterCount }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(filters.search || "");
  const [name, setName] = useState(filters.name || "");
  const [dateFrom, setDateFrom] = useState(filters.dateFrom || "");
  const [dateTo, setDateTo] = useState(filters.dateTo || "");
  const [closeDateFrom, setCloseDateFrom] = useState(filters.closeDateFrom || "");
  const [closeDateTo, setCloseDateTo] = useState(filters.closeDateTo || "");
  const [selectedStatus, setSelectedStatus] = useState<number[]>(filters.status || []);
  const [selectedCategories, setSelectedCategories] = useState<number[]>(filters.category || []);
  const [selectedRequesters, setSelectedRequesters] = useState<number[]>(filters.users_id_recipient || []);

  // Fetch categories
  const { data: categories } = useQuery<Category[]>({
    queryKey: ["/api/categories"],
  });

  // Fetch users
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search });
  };

  const handleApplyFilters = () => {
    onFiltersChange({
      ...filters,
      name: name || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      closeDateFrom: closeDateFrom || undefined,
      closeDateTo: closeDateTo || undefined,
      status: selectedStatus.length > 0 ? selectedStatus : undefined,
      category: selectedCategories.length > 0 ? selectedCategories : undefined,
      users_id_recipient: selectedRequesters.length > 0 ? selectedRequesters : undefined,
    });
  };

  const handleClearFilters = () => {
    setSearch("");
    setName("");
    setDateFrom("");
    setDateTo("");
    setCloseDateFrom("");
    setCloseDateTo("");
    setSelectedStatus([]);
    setSelectedCategories([]);
    setSelectedRequesters([]);
    onFiltersChange({});
  };

  const toggleStatus = (status: number) => {
    setSelectedStatus((prev) =>
      prev.includes(status) ? prev.filter((s) => s !== status) : [...prev, status]
    );
  };

  const toggleCategory = (categoryId: number) => {
    setSelectedCategories((prev) =>
      prev.includes(categoryId) ? prev.filter((c) => c !== categoryId) : [...prev, categoryId]
    );
  };

  const toggleRequester = (userId: number) => {
    setSelectedRequesters((prev) =>
      prev.includes(userId) ? prev.filter((u) => u !== userId) : [...prev, userId]
    );
  };

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Input
                  placeholder="Buscar em todos os campos..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
                  className="pr-20"
                  data-testid="input-search"
                />
                {search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7"
                    onClick={() => {
                      setSearch("");
                      onFiltersChange({ ...filters, search: undefined });
                    }}
                    data-testid="button-clear-search"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <CollapsibleTrigger asChild>
              <Button variant="outline" size="sm" data-testid="button-toggle-filters">
                <Filter className="h-4 w-4 mr-2" />
                Filtros
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ml-2">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </CollapsibleTrigger>

            {activeFilterCount > 0 && (
              <Button variant="ghost" size="sm" onClick={handleClearFilters} data-testid="button-clear-all">
                Limpar filtros
              </Button>
            )}
          </div>

          <CollapsibleContent className="mt-4">
            <div className="p-6 rounded-lg bg-card border border-border space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {/* Nome do Ticket */}
                <div className="space-y-2">
                  <Label htmlFor="filter-name">Nome do Ticket</Label>
                  <Input
                    id="filter-name"
                    placeholder="Filtrar por nome..."
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    data-testid="input-filter-name"
                  />
                </div>

                {/* Data de Abertura - De */}
                <div className="space-y-2">
                  <Label htmlFor="filter-date-from">Data de Abertura - De</Label>
                  <Input
                    id="filter-date-from"
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    data-testid="input-filter-date-from"
                  />
                </div>

                {/* Data de Abertura - Até */}
                <div className="space-y-2">
                  <Label htmlFor="filter-date-to">Data de Abertura - Até</Label>
                  <Input
                    id="filter-date-to"
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    data-testid="input-filter-date-to"
                  />
                </div>

                {/* Data de Fechamento - De */}
                <div className="space-y-2">
                  <Label htmlFor="filter-closedate-from">Data de Fechamento - De</Label>
                  <Input
                    id="filter-closedate-from"
                    type="date"
                    value={closeDateFrom}
                    onChange={(e) => setCloseDateFrom(e.target.value)}
                    data-testid="input-filter-closedate-from"
                  />
                </div>

                {/* Data de Fechamento - Até */}
                <div className="space-y-2">
                  <Label htmlFor="filter-closedate-to">Data de Fechamento - Até</Label>
                  <Input
                    id="filter-closedate-to"
                    type="date"
                    value={closeDateTo}
                    onChange={(e) => setCloseDateTo(e.target.value)}
                    data-testid="input-filter-closedate-to"
                  />
                </div>
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex flex-wrap gap-2">
                  {Object.entries(GLPI_STATUS).map(([statusNum, statusLabel]) => {
                    const status = parseInt(statusNum);
                    const isSelected = selectedStatus.includes(status);
                    return (
                      <Badge
                        key={status}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer hover-elevate active-elevate-2"
                        onClick={() => toggleStatus(status)}
                        data-testid={`badge-status-${status}`}
                      >
                        {statusLabel}
                      </Badge>
                    );
                  })}
                </div>
              </div>

              {/* Categorias */}
              {categories && categories.length > 0 && (
                <div className="space-y-2">
                  <Label>Categorias</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {categories.map((category) => {
                      const isSelected = selectedCategories.includes(category.id);
                      return (
                        <Badge
                          key={category.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer hover-elevate active-elevate-2"
                          onClick={() => toggleCategory(category.id)}
                          data-testid={`badge-category-${category.id}`}
                        >
                          {category.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Solicitantes */}
              {users && users.length > 0 && (
                <div className="space-y-2">
                  <Label>Solicitantes</Label>
                  <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto">
                    {users.slice(0, 20).map((user) => {
                      const isSelected = selectedRequesters.includes(user.id);
                      return (
                        <Badge
                          key={user.id}
                          variant={isSelected ? "default" : "outline"}
                          className="cursor-pointer hover-elevate active-elevate-2"
                          onClick={() => toggleRequester(user.id)}
                          data-testid={`badge-requester-${user.id}`}
                        >
                          {user.name}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Ações */}
              <div className="flex gap-2 pt-4 border-t">
                <Button onClick={handleApplyFilters} data-testid="button-apply-filters">
                  Aplicar Filtros
                </Button>
                <Button variant="outline" onClick={handleClearFilters} data-testid="button-clear-filters">
                  Limpar Tudo
                </Button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
