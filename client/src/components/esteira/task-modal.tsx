import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESPONSAVEIS, OPERACOES } from "@shared/schema";
import type { RecKind } from "@shared/schema";

type ModalTaskInput = {
  titulo: string;
  responsavel: string;
  operacao: string;
  inicio: string;
  fim: string;
  recKind?: RecKind;
  weekDay?: number;
};

interface TaskModalProps {
  title: string;
  onCancel: () => void;
  onSubmit: (t: ModalTaskInput) => Promise<void>;
}

export function TaskModal({ title, onCancel, onSubmit }: TaskModalProps) {
  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState(RESPONSAVEIS[0]);
  const [operacao, setOperacao] = useState(OPERACOES[0]);
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("09:00");
  const [recKind, setRecKind] = useState<RecKind>("once");
  const [weekDay, setWeekDay] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        titulo,
        responsavel,
        operacao,
        inicio,
        fim,
        recKind,
        weekDay: recKind === "weekly" ? weekDay : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Nome da demanda</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="Ex.: Enviar funil diário"
              data-testid="input-task-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger id="responsavel" data-testid="select-responsible">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESPONSAVEIS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="operacao">Operação</Label>
            <Select value={operacao} onValueChange={setOperacao}>
              <SelectTrigger id="operacao" data-testid="select-operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {OPERACOES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="recKind">Recorrência</Label>
            <Select value={recKind} onValueChange={(v) => setRecKind(v as RecKind)}>
              <SelectTrigger id="recKind" data-testid="select-recurrence">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="once">Apenas este dia</SelectItem>
                <SelectItem value="daily">Todos os dias</SelectItem>
                <SelectItem value="weekly">Uma vez por semana</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recKind === "weekly" && (
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="weekDay">Dia da semana</Label>
              <Select value={String(weekDay)} onValueChange={(v) => setWeekDay(Number(v))}>
                <SelectTrigger id="weekDay" data-testid="select-weekday">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Domingo</SelectItem>
                  <SelectItem value="1">Segunda-feira</SelectItem>
                  <SelectItem value="2">Terça-feira</SelectItem>
                  <SelectItem value="3">Quarta-feira</SelectItem>
                  <SelectItem value="4">Quinta-feira</SelectItem>
                  <SelectItem value="5">Sexta-feira</SelectItem>
                  <SelectItem value="6">Sábado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="inicio">Hora de início</Label>
            <Input
              id="inicio"
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              data-testid="input-start-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fim">Hora de término</Label>
            <Input
              id="fim"
              type="time"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              data-testid="input-end-time"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          <Button variant="outline" onClick={onCancel} disabled={isSubmitting} data-testid="button-cancel">
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-save">
            {isSubmitting ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
