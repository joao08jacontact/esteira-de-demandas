import { useQuery } from "@tanstack/react-query";
import { AutomacaoForm } from "@/components/automacao/automacao-form";
import { AutomacaoTable } from "@/components/automacao/automacao-table";
import type { Automacao } from "@shared/schema";

export default function AutomacaoPage() {
  const { data: automacoes = [], isLoading } = useQuery<Automacao[]>({
    queryKey: ["/api/automacoes"],
  });

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-border">
        <h1 className="text-2xl font-bold text-foreground">Automação</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gerencie suas integrações e automações
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-7xl mx-auto space-y-6">
          {/* Formulário */}
          <AutomacaoForm />

          {/* Tabela */}
          <div>
            <h2 className="text-lg font-semibold text-foreground mb-4">
              Automações Cadastradas
            </h2>
            <AutomacaoTable automacoes={automacoes} isLoading={isLoading} />
          </div>
        </div>
      </div>
    </div>
  );
}
