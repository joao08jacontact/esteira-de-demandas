import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Automacao } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface AutomacaoTableProps {
  automacoes: Automacao[];
  isLoading: boolean;
}

export function AutomacaoTable({ automacoes, isLoading }: AutomacaoTableProps) {
  const { toast } = useToast();

  const deleteAutomacao = async (id: string) => {
    try {
      await apiRequest("DELETE", `/api/automacoes/${id}`, {});
      queryClient.invalidateQueries({ queryKey: ["/api/automacoes"] });
      toast({
        title: "Automação excluída",
        description: "A automação foi removida com sucesso.",
      });
    } catch (error) {
      toast({
        title: "Erro ao excluir automação",
        description: "Ocorreu um erro ao tentar excluir a automação.",
        variant: "destructive",
      });
    }
  };

  const formatDataHora = (dataHora: string) => {
    try {
      const date = new Date(dataHora);
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      return dataHora;
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

  if (automacoes.length === 0) {
    return (
      <Card className="p-8">
        <div className="text-center text-muted-foreground">
          Nenhuma automação cadastrada ainda.
        </div>
      </Card>
    );
  }

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50">
            <tr className="border-b border-border">
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Nome da Integração
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Recorrência
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Data e Hora
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Repetir 1h
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Executável
              </th>
              <th className="text-left py-3 px-4 text-sm font-semibold text-foreground">
                Pasta Atualização
              </th>
              <th className="text-center py-3 px-4 text-sm font-semibold text-foreground">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {automacoes.map((automacao) => (
              <tr
                key={automacao.id}
                className="border-b border-border last:border-0 hover-elevate"
                data-testid={`row-automacao-${automacao.id}`}
              >
                <td className="py-3 px-4 text-sm text-foreground" data-testid={`text-nome-${automacao.id}`}>
                  {automacao.nomeIntegracao}
                </td>
                <td className="py-3 px-4 text-sm">
                  <Badge variant="secondary" className="text-xs" data-testid={`badge-recorrencia-${automacao.id}`}>
                    {automacao.recorrencia}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-sm text-foreground" data-testid={`text-data-hora-${automacao.id}`}>
                  {formatDataHora(automacao.dataHora)}
                </td>
                <td className="py-3 px-4 text-sm">
                  <Badge
                    variant={automacao.repetirUmaHora ? "default" : "secondary"}
                    className="text-xs"
                    data-testid={`badge-repetir-${automacao.id}`}
                  >
                    {automacao.repetirUmaHora ? "Sim" : "Não"}
                  </Badge>
                </td>
                <td className="py-3 px-4 text-sm text-foreground" data-testid={`text-executavel-${automacao.id}`}>
                  {automacao.nomeExecutavel}
                </td>
                <td className="py-3 px-4 text-sm text-foreground" data-testid={`text-pasta-${automacao.id}`}>
                  {automacao.pastaFimAtualizacao}
                </td>
                <td className="py-3 px-4 text-center">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteAutomacao(automacao.id)}
                    data-testid={`button-delete-${automacao.id}`}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
