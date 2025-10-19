import { useState, useEffect, useMemo } from "react";
import {
  addDoc,
  collectionGroup,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  where,
} from "firebase/firestore";
import { db, tasksCollection } from "@/lib/firebase";
import { dateToYMD, hhmmToMin, isHHMM } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {  ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Task, RecKind } from "@shared/schema";
import { RESPONSAVEIS, OPERACOES } from "@shared/schema";
import { TaskModal } from "@/components/esteira/task-modal";
import { EditModal } from "@/components/esteira/edit-modal";
import { KpiCard } from "@/components/esteira/kpi-card";
import { VolumeCard } from "@/components/esteira/volume-card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const HORIZON_DAYS = 30;
const WEEKS_COUNT = 8;

export default function EsteiraDemandas() {
  const params = new URLSearchParams(window.location.search);
  const ws = params.get("ws") || "demo";

  const [selectedDate, setSelectedDate] = useState(() => dateToYMD(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filterResp, setFilterResp] = useState<string>("(todos)");
  const [filterOp, setFilterOp] = useState<string>("(todas)");
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  // Load tasks for selected date
  useEffect(() => {
    const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio"));
    return onSnapshot(qy, (snap) => {
      const list: Task[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        const ini = data?.inicio;
        const fim = data?.fim;
        if (!isHHMM(ini) || !isHHMM(fim)) return;
        list.push({
          id: d.id,
          titulo: String(data?.titulo ?? "Demanda"),
          inicio: ini,
          fim: fim,
          concluida: Boolean(data?.concluida),
          responsavel: String(data?.responsavel ?? ""),
          operacao: String(data?.operacao ?? ""),
          ymd: String(data?.ymd ?? selectedDate),
          seriesId: data?.seriesId,
          recKind: (data?.recKind ?? "once") as RecKind,
          workspaceId: String(data?.workspaceId ?? ws),
          createdAt: Number(data?.createdAt ?? Date.now()),
        });
      });
      setTasks(list);
    });
  }, [ws, selectedDate]);

  // CRUD operations
  async function addOne(input: Omit<Task, "id" | "workspaceId" | "createdAt">) {
    const docData: any = {
      titulo: input.titulo,
      inicio: input.inicio,
      fim: input.fim,
      concluida: Boolean(input.concluida),
      responsavel: input.responsavel,
      operacao: input.operacao,
      ymd: input.ymd,
      recKind: input.recKind || "once",
      workspaceId: ws,
      createdAt: Date.now(),
    };
    if (input.seriesId) docData.seriesId = input.seriesId;
    await addDoc(tasksCollection(ws, input.ymd), docData);
  }

  function generateOccurrences(kind: RecKind | undefined, startYmd: string, weekDay?: number): string[] {
    const occs: string[] = [];
    const d0 = new Date(startYmd);

    if (!kind || kind === "once") {
      occs.push(startYmd);
      return occs;
    }

    if (kind === "daily") {
      for (let i = 0; i < HORIZON_DAYS; i++) {
        const d = new Date(d0);
        d.setDate(d0.getDate() + i);
        occs.push(dateToYMD(d));
      }
      return occs;
    }

    if (kind === "weekly") {
      if (weekDay !== undefined) {
        const currentDay = d0.getDay();
        const daysUntilTarget = (weekDay - currentDay + 7) % 7;
        const firstOccurrence = new Date(d0);
        firstOccurrence.setDate(d0.getDate() + daysUntilTarget);

        for (let w = 0; w < WEEKS_COUNT; w++) {
          const d = new Date(firstOccurrence);
          d.setDate(firstOccurrence.getDate() + w * 7);
          occs.push(dateToYMD(d));
        }
      } else {
        for (let w = 0; w < WEEKS_COUNT; w++) {
          const d = new Date(d0);
          d.setDate(d0.getDate() + w * 7);
          occs.push(dateToYMD(d));
        }
      }
    }
    return occs;
  }

  async function addTaskWithRecurrence(base: Omit<Task, "id" | "workspaceId" | "createdAt">, weekDay?: number) {
    const seriesId = base.recKind && base.recKind !== "once" ? crypto.randomUUID() : undefined;
    const occs = generateOccurrences(base.recKind, base.ymd, weekDay);

    await Promise.all(
      occs.map((ymd) =>
        addOne({
          ...base,
          ymd,
          seriesId,
        })
      )
    );
  }

  async function updateTaskSafe(tid: string, ymd: string, patch: Partial<Task>) {
    const clean: any = {};
    Object.entries(patch).forEach(([k, v]) => {
      if (v !== undefined) clean[k] = v;
    });
    await updateDoc(doc(tasksCollection(ws, ymd), tid), clean);
  }

  async function deleteTaskOne(tid: string, ymd: string) {
    await deleteDoc(doc(tasksCollection(ws, ymd), tid));
  }

  async function deleteAllOccurrences(seriesId: string) {
    try {
      const qy = query(
        collectionGroup(db, "tasks"),
        where("workspaceId", "==", ws),
        where("seriesId", "==", seriesId)
      );

      const snap = await getDocs(qy);

      if (snap.docs.length === 0) {
        alert("Nenhuma ocorrência encontrada para excluir.");
        return;
      }

      await Promise.all(snap.docs.map((d) => deleteDoc(d.ref)));
      alert(`${snap.docs.length} ocorrência(s) excluída(s) com sucesso!`);
    } catch (error: any) {
      console.error("Erro ao excluir todas as ocorrências:", error);
      const errorMessage = error?.message || String(error);
      alert(`Erro ao excluir: ${errorMessage}`);
    }
  }

  // Filters and stats
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const okResp = filterResp === "(todos)" || t.responsavel === filterResp;
      const okOp = filterOp === "(todas)" || t.operacao === filterOp;
      return okResp && okOp;
    });
  }, [tasks, filterResp, filterOp]);

  const stats = useMemo(() => {
    const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5));
    let c = 0, a = 0, p = 0;
    filteredTasks.forEach((t) => {
      if (t.concluida) c++;
      else if (hhmmToMin(t.fim) <= nowMin) a++;
      else p++;
    });
    return { total: filteredTasks.length, concluida: c, atrasada: a, noPrazo: p };
  }, [filteredTasks]);

  const volumetriaPorResp = useMemo(() => {
    const map = new Map<string, number>();
    filteredTasks.forEach((t) => map.set(t.responsavel, (map.get(t.responsavel) || 0) + 1));
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredTasks]);

  const responsaveisVisiveis = useMemo(() => {
    return filterResp === "(todos)" ? RESPONSAVEIS : RESPONSAVEIS.filter((r) => r === filterResp);
  }, [filterResp]);

  function shiftDate(days: number) {
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(dateToYMD(d));
  }

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <h1 className="text-3xl font-semibold">Esteira de Demandas</h1>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftDate(-1)}
              data-testid="button-prev-day"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-background border border-input rounded-md px-3 py-2 text-sm"
              data-testid="input-date"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => shiftDate(1)}
              data-testid="button-next-day"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button onClick={() => setShowNew(true)} data-testid="button-new-demand">
              <Plus className="h-4 w-4 mr-2" />
              Nova demanda
            </Button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Responsável</label>
            <Select value={filterResp} onValueChange={setFilterResp}>
              <SelectTrigger className="w-48" data-testid="select-responsible">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="(todos)">(todos)</SelectItem>
                {RESPONSAVEIS.map((r) => (
                  <SelectItem key={r} value={r}>
                    {r}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-sm text-muted-foreground">Operação</label>
            <Select value={filterOp} onValueChange={setFilterOp}>
              <SelectTrigger className="w-48" data-testid="select-operation">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="(todas)">(todas)</SelectItem>
                {OPERACOES.map((o) => (
                  <SelectItem key={o} value={o}>
                    {o}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard label="Demandas no dia" value={stats.total} variant="default" />
          <KpiCard label="Concluídas" value={stats.concluida} variant="success" />
          <KpiCard label="Atrasadas" value={stats.atrasada} variant="danger" />
          <KpiCard label="No prazo" value={stats.noPrazo} variant="info" />
        </div>

        {/* Volumetry */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <VolumeCard title="Por responsável" rows={volumetriaPorResp} />
        </div>

        {/* Kanban Columns */}
        <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${responsaveisVisiveis.length}, minmax(0, 1fr))` }}>
          {responsaveisVisiveis.map((resp) => {
            const list = filteredTasks
              .filter((t) => t.responsavel === resp)
              .sort((a, b) =>
                hhmmToMin(a.inicio) - hhmmToMin(b.inicio) ||
                hhmmToMin(a.fim) - hhmmToMin(b.fim) ||
                a.titulo.localeCompare(b.titulo)
              );

            return (
              <Card key={resp} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{resp}</CardTitle>
                    <Badge variant="secondary" data-testid={`count-${resp}`}>
                      {list.length}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {list.length === 0 && (
                    <p className="text-sm text-muted-foreground">Sem demandas neste dia</p>
                  )}

                  {list.map((t) => {
                    let badge = "NO PRAZO";
                    let badgeVariant: "default" | "secondary" | "destructive" | "outline" = "default";
                    const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5));
                    if (t.concluida) {
                      badge = "CONCLUÍDA";
                      badgeVariant = "secondary";
                    } else if (hhmmToMin(t.fim) <= nowMin) {
                      badge = "ATRASADA";
                      badgeVariant = "destructive";
                    }

                    return (
                      <button
                        key={t.id}
                        onClick={() => setEditing(t)}
                        className="w-full text-left rounded-lg bg-card hover-elevate active-elevate-2 border border-card-border p-3 space-y-2"
                        data-testid={`task-${t.id}`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <Badge variant={badgeVariant} className="text-[10px] uppercase">
                            {badge}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {t.inicio} – {t.fim}
                          </span>
                        </div>
                        <div className="font-medium text-sm">{t.titulo}</div>
                        {t.operacao && (
                          <div className="text-xs text-muted-foreground">Operação: {t.operacao}</div>
                        )}
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {showNew && (
        <TaskModal
          title="Nova demanda"
          onCancel={() => setShowNew(false)}
          onSubmit={async (payload) => {
            try {
              await addTaskWithRecurrence(
                {
                  titulo: payload.titulo.trim() || "Demanda",
                  inicio: payload.inicio,
                  fim: payload.fim,
                  concluida: false,
                  responsavel: payload.responsavel,
                  operacao: payload.operacao,
                  ymd: selectedDate,
                  recKind: payload.recKind,
                  seriesId: undefined,
                  workspaceId: ws,
                  createdAt: Date.now(),
                } as any,
                payload.weekDay
              );
              setShowNew(false);
            } catch (e: any) {
              alert(`Não foi possível salvar a demanda.\n${String(e?.message || e)}`);
            }
          }}
        />
      )}

      {editing && (
        <EditModal
          task={editing}
          onCancel={() => setEditing(null)}
          onDeleteOne={async () => {
            await deleteTaskOne(editing.id, editing.ymd);
            setEditing(null);
          }}
          onDeleteAll={
            editing.seriesId
              ? async () => {
                  if (confirm("Excluir TODAS as ocorrências desta demanda recorrente?")) {
                    try {
                      await deleteAllOccurrences(editing.seriesId!);
                      setEditing(null);
                    } catch (error: any) {
                      console.error("Erro ao excluir todas as ocorrências:", error);
                      alert(`Erro: ${error?.message || error}`);
                    }
                  }
                }
              : undefined
          }
          onSubmit={async (patch) => {
            await updateTaskSafe(editing.id, editing.ymd, patch);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
