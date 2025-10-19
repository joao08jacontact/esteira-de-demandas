import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RECORRENCIAS } from "@shared/schema";

const automacaoFormSchema = z.object({
  nomeIntegracao: z.string().min(1, "Nome da integração é obrigatório"),
  recorrencia: z.string().min(1, "Recorrência é obrigatória"),
  dataHora: z.string().min(1, "Data e hora são obrigatórias"),
  repetirUmaHora: z.boolean(),
  nomeExecutavel: z.string().min(1, "Nome do executável é obrigatório"),
  pastaFimAtualizacao: z.string().min(1, "Pasta fim de atualização é obrigatória"),
});

type AutomacaoFormData = z.infer<typeof automacaoFormSchema>;

export function AutomacaoForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<AutomacaoFormData>({
    resolver: zodResolver(automacaoFormSchema),
    defaultValues: {
      nomeIntegracao: "",
      recorrencia: "",
      dataHora: "",
      repetirUmaHora: false,
      nomeExecutavel: "",
      pastaFimAtualizacao: "",
    },
  });

  const onSubmit = async (data: AutomacaoFormData) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/automacoes", data);
      toast({
        title: "Automação cadastrada com sucesso!",
        description: `${data.nomeIntegracao} foi adicionada à lista.`,
      });
      reset();
      queryClient.invalidateQueries({ queryKey: ["/api/automacoes"] });
    } catch (error) {
      toast({
        title: "Erro ao cadastrar automação",
        description: "Ocorreu um erro ao tentar cadastrar a automação. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="space-y-0 pb-4 gap-1">
        <CardTitle className="text-lg">Cadastrar Nova Automação</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome da Integração */}
          <div>
            <Label htmlFor="nomeIntegracao" className="text-sm font-medium">
              Nome da Integração
            </Label>
            <Input
              id="nomeIntegracao"
              data-testid="input-nome-integracao"
              {...register("nomeIntegracao")}
              className="mt-1"
              placeholder="Ex: Integração com CRM"
            />
            {errors.nomeIntegracao && (
              <p className="text-xs text-destructive mt-1">{errors.nomeIntegracao.message}</p>
            )}
          </div>

          {/* Recorrência */}
          <div>
            <Label htmlFor="recorrencia" className="text-sm font-medium">
              Recorrência
            </Label>
            <Select
              value={watch("recorrencia")}
              onValueChange={(value) => setValue("recorrencia", value)}
            >
              <SelectTrigger className="mt-1" data-testid="select-recorrencia">
                <SelectValue placeholder="Selecione a recorrência" />
              </SelectTrigger>
              <SelectContent>
                {RECORRENCIAS.map((rec) => (
                  <SelectItem key={rec} value={rec}>
                    {rec}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.recorrencia && (
              <p className="text-xs text-destructive mt-1">{errors.recorrencia.message}</p>
            )}
          </div>

          {/* Data e Hora */}
          <div>
            <Label htmlFor="dataHora" className="text-sm font-medium">
              Data e Hora
            </Label>
            <Input
              id="dataHora"
              type="datetime-local"
              data-testid="input-data-hora"
              {...register("dataHora")}
              className="mt-1"
            />
            {errors.dataHora && (
              <p className="text-xs text-destructive mt-1">{errors.dataHora.message}</p>
            )}
          </div>

          {/* Repetir de 1 em 1 hora */}
          <div className="flex items-center space-x-2">
            <Checkbox
              id="repetirUmaHora"
              checked={watch("repetirUmaHora")}
              onCheckedChange={(checked) => setValue("repetirUmaHora", checked as boolean)}
              data-testid="checkbox-repetir-uma-hora"
            />
            <Label
              htmlFor="repetirUmaHora"
              className="text-sm font-medium cursor-pointer"
            >
              Repetir de 1 em 1 hora
            </Label>
          </div>

          {/* Nome do Executável */}
          <div>
            <Label htmlFor="nomeExecutavel" className="text-sm font-medium">
              Nome do Executável
            </Label>
            <Input
              id="nomeExecutavel"
              data-testid="input-nome-executavel"
              {...register("nomeExecutavel")}
              className="mt-1"
              placeholder="Ex: script_integracao.exe"
            />
            {errors.nomeExecutavel && (
              <p className="text-xs text-destructive mt-1">{errors.nomeExecutavel.message}</p>
            )}
          </div>

          {/* Pasta Fim de Atualização */}
          <div>
            <Label htmlFor="pastaFimAtualizacao" className="text-sm font-medium">
              Pasta Fim de Atualização
            </Label>
            <Input
              id="pastaFimAtualizacao"
              data-testid="input-pasta-fim-atualizacao"
              {...register("pastaFimAtualizacao")}
              className="mt-1"
              placeholder="Ex: C:/dados/atualizacao"
            />
            {errors.pastaFimAtualizacao && (
              <p className="text-xs text-destructive mt-1">{errors.pastaFimAtualizacao.message}</p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting ? "Cadastrando..." : "Cadastrar Automação"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
