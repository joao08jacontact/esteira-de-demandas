import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Filter, X } from "lucide-react";
import type { TicketFilters } from "@shared/schema";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface FilterPanelProps {
  filters: TicketFilters;
  onFiltersChange: (filters: TicketFilters) => void;
  activeFilterCount: number;
}

export function FilterPanel({ filters, onFiltersChange, activeFilterCount }: FilterPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState(filters.search || "");

  const handleSearchSubmit = () => {
    onFiltersChange({ ...filters, search });
  };

  const handleClearFilters = () => {
    setSearch("");
    onFiltersChange({});
  };

  return (
    <div className="border-b border-border bg-muted/30">
      <div className="max-w-screen-2xl mx-auto px-6 lg:px-8 py-4">
        <Collapsible open={isOpen} onOpenChange={setIsOpen}>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Input
                  placeholder="Buscar tickets..."
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
            <div className="p-4 rounded-lg bg-card border border-border">
              <p className="text-sm text-muted-foreground">
                Filtros avançados em desenvolvimento. Use a busca acima para encontrar tickets.
              </p>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </div>
    </div>
  );
}
