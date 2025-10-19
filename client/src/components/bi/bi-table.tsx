import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { BiWithBases } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BiTableProps {
  bis: BiWithBases[];
  isLoading: boolean;
  type: "em_aberto" | "concluido";
}

const biStatusColors = {
  em_aberto: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  concluido: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
};

const biStatusLabels = {
  em_aberto: "Em Aberto",
  concluido: "Concluído",
};

export function BiTable({ bis, isLoading, type }: BiTableProps) {
  const [expandedBis, setExpandedBis] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const toggleExpanded = (biId: string) => {
    const newExpanded = new Set(expandedBis);
    if (newExpanded.has(biId)) {
      newExpanded.delete(biId);
    } else {
      newExpanded.add(biId);
    }
    setExpandedBis(newExpanded);
  };

  const concluirBi = async (biId: string) => {
    try {
      // Marcar todas as bases como concluídas
      const bi = bis.find(b => b.id === biId);
      if (bi) {
        for (const base of bi.bases) {
          await apiRequest("PATCH", `/api/bases/${base.id}/status`, {
            status: "concluido",
          });
        }
      }
      queryClient.invalidateQueries({ queryKey: ["/api/bis"] });
      toast({
        title: "BI concluído",
        description: "O BI foi marcado como concluído.",
      });
    } catch (error) {
      toast({
        title: "Erro ao concluir BI",
        description: "Ocorreu um erro ao tentar concluir o BI.",
        variant: "destructive",
      });
    }
  };

  const inativarBi = async (biId: string) => {
    try {
      await apiRequest("PATCH", `/api/bis/${biId}/inativar`, {
        inativo: true,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bis"] });
      toast({
        title: "BI inativado",
        description: "O BI foi marcado como inativo.",
      });
    } catch (error) {
      toast({
        title: "Erro ao inativar BI",
        description: "Ocorreu um erro ao tentar inativar o BI.",
        variant: "destructive",
      });
    }
  };

  if (isLoading) {
    return (
      <Card className="p-8">
        <div className="flex items-center justify-center">
          <div className="text-muted-foreground">Carregando...</div>
        </div>
      </Card>
    );
  }

  if (bis.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          {type === "em_aberto"
            ? "Nenhum BI em aberto no momento."
            : "Nenhum BI concluído ainda."}
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {bis.map((bi) => (
        <Card key={bi.id} className="overflow-hidden" data-testid={`card-bi-${bi.id}`}>
          <div className="p-4">
            {/* Header com informações principais */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="font-semibold text-base text-foreground" data-testid={`text-nome-${bi.id}`}>
                    {bi.nome}
                  </h3>
                  <Badge
                    className={`text-xs border ${biStatusColors[bi.status as keyof typeof biStatusColors]}`}
                    data-testid={`badge-status-${bi.id}`}
                  >
                    {biStatusLabels[bi.status as keyof typeof biStatusLabels]}
                  </Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
                  <div className="text-muted-foreground">
                    <span className="font-medium">Responsável:</span>{" "}
                    <span className="text-foreground" data-testid={`text-responsavel-${bi.id}`}>
                      {bi.responsavel}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Operação:</span>{" "}
                    <span className="text-foreground" data-testid={`text-operacao-${bi.id}`}>
                      {bi.operacao}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Início:</span>{" "}
                    <span className="text-foreground" data-testid={`text-data-inicio-${bi.id}`}>
                      {format(new Date(bi.dataInicio), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    <span className="font-medium">Final:</span>{" "}
                    <span className="text-foreground" data-testid={`text-data-final-${bi.id}`}>
                      {format(new Date(bi.dataFinal), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleExpanded(bi.id)}
                  data-testid={`button-toggle-${bi.id}`}
                  className="flex-shrink-0"
                >
                  {expandedBis.has(bi.id) ? (
                    <ChevronDown className="h-4 w-4 mr-1" />
                  ) : (
                    <ChevronRight className="h-4 w-4 mr-1" />
                  )}
                  Bases ({bi.bases.length})
                </Button>
                {type === "em_aberto" && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => concluirBi(bi.id)}
                    data-testid={`button-concluir-${bi.id}`}
                    className="text-green-600 hover:text-green-700"
                  >
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Concluir
                  </Button>
                )}
                {type === "concluido" && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => inativarBi(bi.id)}
                    data-testid={`button-inativar-${bi.id}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            {/* Tabela de bases expandida */}
            {expandedBis.has(bi.id) && (
              <div className="mt-4 pt-4 border-t border-border">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-border">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          Nome da Ferramenta
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          Pasta Origem
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          Tem API
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bi.bases.map((base) => (
                        <tr key={base.id} className="border-b border-border last:border-0" data-testid={`row-base-${base.id}`}>
                          <td className="py-3 px-3 text-sm text-foreground" data-testid={`text-ferramenta-${base.id}`}>
                            {base.nomeFerramenta}
                          </td>
                          <td className="py-3 px-3 text-sm text-foreground" data-testid={`text-pasta-${base.id}`}>
                            {base.pastaOrigem}
                          </td>
                          <td className="py-3 px-3 text-sm">
                            <Badge
                              variant={base.temApi ? "default" : "secondary"}
                              className="text-xs"
                              data-testid={`badge-api-${base.id}`}
                            >
                              {base.temApi ? "Sim" : "Não"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </Card>
      ))}
    </div>
  );
}

