import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, X, Calendar as CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { RESPONSAVEIS, OPERACOES } from "@shared/schema";

const biFormSchema = z.object({
  nome: z.string().min(1, "Nome é obrigatório"),
  dataInicio: z.string().min(1, "Data de início é obrigatória"),
  dataFinal: z.string().min(1, "Data final é obrigatória"),
  responsavel: z.string().min(1, "Responsável é obrigatório"),
  operacao: z.string().min(1, "Operação é obrigatória"),
  bases: z.array(z.object({
    nomeBase: z.string().min(1, "Nome da base é obrigatório"),
    temApi: z.boolean(),
  })).min(1, "Adicione pelo menos uma base de origem"),
});

type BiFormData = z.infer<typeof biFormSchema>;

export function BiForm() {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [dataInicioOpen, setDataInicioOpen] = useState(false);
  const [dataFinalOpen, setDataFinalOpen] = useState(false);
  const [dataInicio, setDataInicio] = useState<Date>();
  const [dataFinal, setDataFinal] = useState<Date>();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<BiFormData>({
    resolver: zodResolver(biFormSchema),
    defaultValues: {
      nome: "",
      dataInicio: "",
      dataFinal: "",
      responsavel: "",
      operacao: "",
      bases: [{ nomeBase: "", temApi: false }],
    },
  });

  const bases = watch("bases");

  const addBase = () => {
    setValue("bases", [...bases, { nomeBase: "", temApi: false }]);
  };

  const removeBase = (index: number) => {
    if (bases.length > 1) {
      setValue("bases", bases.filter((_, i) => i !== index));
    }
  };

  const onSubmit = async (data: BiFormData) => {
    setIsSubmitting(true);
    try {
      await apiRequest("POST", "/api/bis", data);
      toast({
        title: "BI cadastrado com sucesso!",
        description: `${data.nome} foi adicionado à lista de BIs em aberto.`,
      });
      reset();
      setValue("bases", [{ nomeBase: "", temApi: false }]);
      setDataInicio(undefined);
      setDataFinal(undefined);
      queryClient.invalidateQueries({ queryKey: ["/api/bis"] });
    } catch (error) {
      toast({
        title: "Erro ao cadastrar BI",
        description: "Ocorreu um erro ao tentar cadastrar o BI. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="shadow-md">
      <CardHeader className="space-y-0 pb-4 gap-1">
        <CardTitle className="text-lg">Cadastrar Novo BI</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Nome */}
          <div>
            <Label htmlFor="nome" className="text-sm font-medium">
              Nome
            </Label>
            <Input
              id="nome"
              data-testid="input-nome"
              {...register("nome")}
              className="mt-1"
              placeholder="Ex: Dashboard de Vendas"
            />
            {errors.nome && (
              <p className="text-xs text-destructive mt-1">{errors.nome.message}</p>
            )}
          </div>

          {/* Data Início */}
          <div>
            <Label className="text-sm font-medium">
              Data Início
            </Label>
            <Popover open={dataInicioOpen} onOpenChange={setDataInicioOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1"
                  data-testid="button-data-inicio"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataInicio ? format(dataInicio, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataInicio}
                  onSelect={(date) => {
                    setDataInicio(date);
                    if (date) {
                      setValue("dataInicio", format(date, "yyyy-MM-dd"));
                    }
                    setDataInicioOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {errors.dataInicio && (
              <p className="text-xs text-destructive mt-1">{errors.dataInicio.message}</p>
            )}
          </div>

          {/* Data Final */}
          <div>
            <Label className="text-sm font-medium">
              Data Final
            </Label>
            <Popover open={dataFinalOpen} onOpenChange={setDataFinalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-start text-left font-normal mt-1"
                  data-testid="button-data-final"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {dataFinal ? format(dataFinal, "PPP", { locale: ptBR }) : "Selecione a data"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={dataFinal}
                  onSelect={(date) => {
                    setDataFinal(date);
                    if (date) {
                      setValue("dataFinal", format(date, "yyyy-MM-dd"));
                    }
                    setDataFinalOpen(false);
                  }}
                  locale={ptBR}
                />
              </PopoverContent>
            </Popover>
            {errors.dataFinal && (
              <p className="text-xs text-destructive mt-1">{errors.dataFinal.message}</p>
            )}
          </div>

          {/* Responsável */}
          <div>
            <Label htmlFor="responsavel" className="text-sm font-medium">
              Responsável
            </Label>
            <Select
              value={watch("responsavel")}
              onValueChange={(value) => setValue("responsavel", value)}
            >
              <SelectTrigger className="mt-1" data-testid="select-responsavel">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {RESPONSAVEIS.map((resp) => (
                  <SelectItem key={resp} value={resp}>
                    {resp}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.responsavel && (
              <p className="text-xs text-destructive mt-1">{errors.responsavel.message}</p>
            )}
          </div>

          {/* Operação */}
          <div>
            <Label htmlFor="operacao" className="text-sm font-medium">
              Operação
            </Label>
            <Select
              value={watch("operacao")}
              onValueChange={(value) => setValue("operacao", value)}
            >
              <SelectTrigger className="mt-1" data-testid="select-operacao">
                <SelectValue placeholder="Selecione a operação" />
              </SelectTrigger>
              <SelectContent>
                {OPERACOES.map((op) => (
                  <SelectItem key={op} value={op}>
                    {op}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.operacao && (
              <p className="text-xs text-destructive mt-1">{errors.operacao.message}</p>
            )}
          </div>

          {/* Bases de Origem */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label className="text-sm font-medium">Bases de Origem</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addBase}
                data-testid="button-add-base"
              >
                <Plus className="h-4 w-4 mr-1" />
                Adicionar Base
              </Button>
            </div>
            <div className="space-y-3">
              {bases.map((base, index) => (
                <div key={index} className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <Input
                      {...register(`bases.${index}.nomeBase`)}
                      placeholder="Nome da base"
                      data-testid={`input-base-${index}`}
                    />
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id={`api-${index}`}
                        checked={base.temApi}
                        onCheckedChange={(checked) => {
                          const newBases = [...bases];
                          newBases[index].temApi = checked as boolean;
                          setValue("bases", newBases);
                        }}
                        data-testid={`checkbox-api-${index}`}
                      />
                      <Label
                        htmlFor={`api-${index}`}
                        className="text-sm text-muted-foreground cursor-pointer"
                      >
                        Tem API
                      </Label>
                    </div>
                  </div>
                  {bases.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeBase(index)}
                      data-testid={`button-remove-base-${index}`}
                      className="h-8 w-8 text-destructive hover:text-destructive"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
            {errors.bases && (
              <p className="text-xs text-destructive mt-1">
                {Array.isArray(errors.bases) ? "Preencha todas as bases" : errors.bases.message}
              </p>
            )}
          </div>

          {/* Submit Button */}
          <Button
            type="submit"
            className="w-full"
            disabled={isSubmitting}
            data-testid="button-submit"
          >
            {isSubmitting ? "Cadastrando..." : "Cadastrar BI"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
