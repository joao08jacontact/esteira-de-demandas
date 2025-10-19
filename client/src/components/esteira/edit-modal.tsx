import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RESPONSAVEIS, OPERACOES } from "@shared/schema";
import type { Task } from "@shared/schema";
import { Trash2 } from "lucide-react";

interface EditModalProps {
  task: Task;
  onCancel: () => void;
  onDeleteOne: () => Promise<void>;
  onDeleteAll?: () => Promise<void>;
  onSubmit: (patch: Partial<Task>) => Promise<void>;
}

export function EditModal({ task, onCancel, onDeleteOne, onDeleteAll, onSubmit }: EditModalProps) {
  const [titulo, setTitulo] = useState(task.titulo);
  const [responsavel, setResponsavel] = useState(task.responsavel);
  const [operacao, setOperacao] = useState(task.operacao);
  const [inicio, setInicio] = useState(task.inicio);
  const [fim, setFim] = useState(task.fim);
  const [concluida, setConcluida] = useState(task.concluida);
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
        concluida,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (confirm("Excluir esta demanda?")) {
      await onDeleteOne();
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Editar demanda</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="titulo">Nome da demanda</Label>
            <Input
              id="titulo"
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              data-testid="input-edit-title"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="responsavel">Responsável</Label>
            <Select value={responsavel} onValueChange={setResponsavel}>
              <SelectTrigger id="responsavel" data-testid="select-edit-responsible">
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
              <SelectTrigger id="operacao" data-testid="select-edit-operation">
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
            <Label htmlFor="inicio">Hora de início</Label>
            <Input
              id="inicio"
              type="time"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
              data-testid="input-edit-start-time"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="fim">Hora de término</Label>
            <Input
              id="fim"
              type="time"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
              data-testid="input-edit-end-time"
            />
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="concluida"
              checked={concluida}
              onCheckedChange={(checked) => setConcluida(Boolean(checked))}
              data-testid="checkbox-completed"
            />
            <Label htmlFor="concluida" className="cursor-pointer">
              Marcar como concluída
            </Label>
          </div>
        </div>

        <div className="flex justify-between mt-4">
          <div className="flex gap-2">
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting} data-testid="button-delete-one">
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir esta
            </Button>
            {onDeleteAll && (
              <Button variant="destructive" onClick={onDeleteAll} disabled={isSubmitting} data-testid="button-delete-all">
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir série
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onCancel} disabled={isSubmitting} data-testid="button-cancel-edit">
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSubmitting} data-testid="button-save-edit">
              {isSubmitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
