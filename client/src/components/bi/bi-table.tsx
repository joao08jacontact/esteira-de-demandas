import { useState } from "react";
import { ChevronDown, ChevronRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { BiWithBases, BaseOrigem } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface BiTableProps {
  bis: BiWithBases[];
  isLoading: boolean;
  type: "em_aberto" | "concluido";
}

const statusColors = {
  aguardando: "bg-blue-500/20 text-blue-700 dark:text-blue-300 border-blue-500/30",
  em_andamento: "bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border-yellow-500/30",
  pendente: "bg-orange-500/20 text-orange-700 dark:text-orange-300 border-orange-500/30",
  concluido: "bg-green-500/20 text-green-700 dark:text-green-300 border-green-500/30",
};

const statusLabels = {
  aguardando: "Aguardando",
  em_andamento: "Em Andamento",
  pendente: "Pendente",
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

  const updateBaseStatus = async (
    baseId: string,
    status: string,
    observacao?: string
  ) => {
    try {
      await apiRequest("PATCH", `/api/bases/${baseId}/status`, {
        status,
        observacao,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bis"] });
      toast({
        title: "Status atualizado",
        description: "O status da base foi atualizado com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao atualizar status",
        description: "Ocorreu um erro ao tentar atualizar o status.",
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
                <h3 className="font-semibold text-base text-foreground mb-2" data-testid={`text-nome-${bi.id}`}>
                  {bi.nome}
                </h3>
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
                          Base
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          API
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          Status
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-foreground">
                          Observação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {bi.bases.map((base) => (
                        <BaseRow
                          key={base.id}
                          base={base}
                          onStatusChange={updateBaseStatus}
                          isReadOnly={type === "concluido"}
                        />
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

interface BaseRowProps {
  base: BaseOrigem;
  onStatusChange: (baseId: string, status: string, observacao?: string) => void;
  isReadOnly: boolean;
}

function BaseRow({ base, onStatusChange, isReadOnly }: BaseRowProps) {
  const [localObservacao, setLocalObservacao] = useState(base.observacao || "");
  const [isEditingObs, setIsEditingObs] = useState(false);

  const handleStatusChange = (newStatus: string) => {
    onStatusChange(base.id, newStatus, localObservacao);
  };

  const handleObservacaoBlur = () => {
    if (localObservacao !== base.observacao) {
      onStatusChange(base.id, base.status, localObservacao);
    }
    setIsEditingObs(false);
  };

  return (
    <tr className="border-b border-border last:border-0" data-testid={`row-base-${base.id}`}>
      <td className="py-3 px-3 text-sm text-foreground" data-testid={`text-base-nome-${base.id}`}>
        {base.nomeBase}
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
      <td className="py-3 px-3">
        {isReadOnly ? (
          <Badge
            className={`text-xs border ${statusColors[base.status as keyof typeof statusColors]}`}
            data-testid={`badge-status-${base.id}`}
          >
            {statusLabels[base.status as keyof typeof statusLabels]}
          </Badge>
        ) : (
          <Select value={base.status} onValueChange={handleStatusChange}>
            <SelectTrigger
              className="w-[140px] h-8 text-xs"
              data-testid={`select-status-${base.id}`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="aguardando">Aguardando</SelectItem>
              <SelectItem value="em_andamento">Em Andamento</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
            </SelectContent>
          </Select>
        )}
      </td>
      <td className="py-3 px-3">
        {base.status === "pendente" && !isReadOnly ? (
          isEditingObs ? (
            <Textarea
              value={localObservacao}
              onChange={(e) => setLocalObservacao(e.target.value)}
              onBlur={handleObservacaoBlur}
              placeholder="Motivo da pendência..."
              className="min-h-[60px] text-xs"
              data-testid={`textarea-obs-${base.id}`}
              autoFocus
            />
          ) : (
            <div
              onClick={() => setIsEditingObs(true)}
              className="text-sm text-muted-foreground cursor-pointer hover:text-foreground transition-colors min-h-[40px] p-2 rounded-md hover-elevate"
              data-testid={`text-obs-${base.id}`}
            >
              {localObservacao || "Clique para adicionar observação..."}
            </div>
          )
        ) : base.observacao ? (
          <div className="text-sm text-muted-foreground" data-testid={`text-obs-readonly-${base.id}`}>
            {base.observacao}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">—</div>
        )}
      </td>
    </tr>
  );
}
