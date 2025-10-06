import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
  getDocs,
  // para excluir série inteira:
  collectionGroup,
  where,
  writeBatch,
} from "firebase/firestore";
import { db, tasksCollection } from "./lib/firebase";

/* ===========================
   Tipos
=========================== */
type RecKind = "once" | "daily" | "weekly";

type Task = {
  id: string;
  titulo: string;
  inicio: string; // "HH:MM"
  fim: string; // "HH:MM"
  concluida: boolean;
  responsavel: string;
  operacao: string;
  ymd: string; // "YYYY-MM-DD"
  seriesId?: string;
  recKind?: RecKind;
  workspaceId: string;
  createdAt: number;
};

type Timeline = { startMin: number; endMin: number; totalMin: number };

/* ===========================
   Utilitários robustos
=========================== */
function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}
function hhmmToMin(hhmm: string): number {
  if (!isHHMM(hhmm)) return 0;
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function buildTimeline(start: string, end: string): Timeline {
  const startMin = hhmmToMin(start);
  const endMin = hhmmToMin(end);
  return { startMin, endMin, totalMin: Math.max(1, endMin - startMin) };
}
function percentFromTime(hhmm: string, tl: Timeline): number {
  const pos = (isHHMM(hhmm) ? hhmmToMin(hhmm) : tl.startMin) - tl.startMin;
  return clamp((pos / tl.totalMin) * 100, 0, 100);
}
function ymdToDate(ymd: string) {
  if (typeof ymd !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    }
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, 0, 0, 0, 0);
}
function dateToYMD(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/* ===========================
   Dados base
=========================== */
const RESPONSAVEIS = [
  "Bárbara Arruda",
  "Gabriel Bion",
  "Luciano Miranda",
  // “João Vinicius” e “Lucas Siqueira” não aparecem em coluna se você não quiser,
  // mas mantive para filtros e cadastro. Se quiser, remova daqui.
  "João Vinicius",
  "Lucas Siqueira",
];

// Lista fixa de operações (sem “adicionar”)
const OPS = [
  "FMU",
  "INPISRALI",
  "COGNA",
  "SINGULARIDADES",
  "PÓS COGNA",
  "UFEM",
  "TELECOM",
  "FGTS",
  "DIROMA",
  "ESTÁCIO",
];

/* ===========================
   App
=========================== */
export default function App() {
  // workspace via URL ?ws=...
  const params = new URLSearchParams(window.location.search);
  const ws = params.get("ws") || "demo";

  const [selectedDate, setSelectedDate] = useState(() => dateToYMD(new Date()));
  const [tasks, setTasks] = useState<Task[]>([]);

  // filtros
  const [filterResp, setFilterResp] = useState<string>("(todos)");
  const [filterOp, setFilterOp] = useState<string>("(todas)");

  // UI
  const [showNew, setShowNew] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);

  // timeline
  const dayStart = "08:00";
  const dayEnd = "20:00";
  const timeline = useMemo(() => buildTimeline(dayStart, dayEnd), []);

  /* ===========================
     Carrega/escuta tarefas do dia
  =========================== */
  useEffect(() => {
    const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio"));
    return onSnapshot(qy, (snap) => {
      const list: Task[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;

        const ini = data?.inicio;
        const fim = data?.fim;
        if (!isHHMM(ini) || !isHHMM(fim)) {
          console.warn("Ignorando tarefa com horários inválidos", d.id, data);
          return;
        }

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

  /* ===========================
     Helpers de CRUD
  =========================== */
  async function addTask(input: Omit<Task, "id" | "workspaceId" | "createdAt">) {
    await addDoc(tasksCollection(ws, input.ymd), {
      ...input,
      workspaceId: ws,
      createdAt: Date.now(),
    });
  }
  async function updateTask(tid: string, ymd: string, patch: Partial<Task>) {
    await updateDoc(doc(tasksCollection(ws, ymd), tid), patch as any);
  }
  async function deleteTask(tid: string, ymd: string) {
    await deleteDoc(doc(tasksCollection(ws, ymd), tid));
  }

  // Exclui TODAS as ocorrências de uma série
  async function deleteSeriesAll(seriesId: string) {
    if (!seriesId) return;
    const qy = query(
      collectionGroup(db, "tasks"),
      where("workspaceId", "==", ws),
      where("seriesId", "==", seriesId)
    );
    const snap = await getDocs(qy);
    if (snap.empty) return;

    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  /* ===========================
     Criação por recorrência
  =========================== */
  const DAYS_TO_GENERATE = 60; // gere para frente por 60 dias

  async function createTasksFromRecurrence(base: {
    titulo: string;
    responsavel: string;
    operacao: string;
    inicio: string;
    fim: string;
    recKind: RecKind;
    weeklyDay?: number; // 0..6
  }) {
    const seriesId = base.recKind === "once" ? undefined : crypto.randomUUID();
    const start = ymdToDate(selectedDate);

    for (let i = 0; i < (base.recKind === "once" ? 1 : DAYS_TO_GENERATE); i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);

      const shouldCreate =
        base.recKind === "once" ||
        base.recKind === "daily" ||
        (base.recKind === "weekly" && d.getDay() === (base.weeklyDay ?? d.getDay()));

      if (!shouldCreate) continue;

      const ymd = dateToYMD(d);
      const data: any = {
        titulo: base.titulo.trim() || "Demanda",
        inicio: base.inicio,
        fim: base.fim,
        concluida: false,
        responsavel: base.responsavel,
        operacao: base.operacao,
        ymd,
        recKind: base.recKind,
        workspaceId: ws,
        createdAt: Date.now(),
      };
      if (seriesId) data.seriesId = seriesId;

      await addDoc(tasksCollection(ws, ymd), data);
    }
  }

  /* ===========================
     Filtros e estatísticas
  =========================== */
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      const okResp = filterResp === "(todos)" || t.responsavel === filterResp;
      const okOp = filterOp === "(todas)" || t.operacao === filterOp;
      return okResp && okOp;
    });
  }, [tasks, filterResp, filterOp]);

  const stats = useMemo(() => {
    const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5));
    let c = 0,
      a = 0,
      p = 0;
    visibleTasks.forEach((t) => {
      if (t.concluida) c++;
      else if (hhmmToMin(t.fim) <= nowMin) a++;
      else p++;
    });
    return { total: visibleTasks.length, concluida: c, atrasada: a, noPrazo: p };
  }, [visibleTasks]);

  const volumetriaPorResp = useMemo(() => {
    const map = new Map<string, number>();
    visibleTasks.forEach((t) => {
      map.set(t.responsavel, (map.get(t.responsavel) || 0) + 1);
    });
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleTasks]);

  /* ===========================
     Layout lado a lado (sem sobrepor)
  =========================== */
  type Enriched = Task & { startMin: number; endMin: number; idx: number };
  const enriched = useMemo<Enriched[]>(() => {
    return visibleTasks.map((t, i) => ({
      ...t,
      startMin: hhmmToMin(t.inicio),
      endMin: hhmmToMin(t.fim),
      idx: i,
    }));
  }, [visibleTasks]);

  const lanesInfo = useMemo(() => {
    const overlaps = (a: Enriched, b: Enriched) => a.startMin < b.endMin && b.startMin < a.endMin;
    const n = enriched.length;
    const adj: number[][] = Array.from({ length: n }, () => []);
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (overlaps(enriched[i], enriched[j])) {
          adj[i].push(j);
          adj[j].push(i);
        }
      }
    }
    // componentes
    const comp: number[] = Array(n).fill(-1);
    let cc = 0;
    for (let i = 0; i < n; i++) {
      if (comp[i] !== -1) continue;
      const q = [i];
      comp[i] = cc;
      while (q.length) {
        const u = q.shift()!;
        for (const v of adj[u]) if (comp[v] === -1) { comp[v] = cc; q.push(v); }
      }
      cc++;
    }
    // alocação de lanes por componente
    const result: Record<number, { lane: number; lanesInComp: number }> = {};
    for (let c = 0; c < cc; c++) {
      const nodes = enriched
        .filter((_, i) => comp[i] === c)
        .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
      const lanesEnd: number[] = [];
      for (const t of nodes) {
        let lane = -1;
        for (let li = 0; li < lanesEnd.length; li++) {
          if (lanesEnd[li] <= t.startMin) {
            lane = li;
            break;
          }
        }
        if (lane === -1) {
          lanesEnd.push(t.endMin);
          lane = lanesEnd.length - 1;
        } else {
          lanesEnd[lane] = t.endMin;
        }
        result[t.idx] = { lane, lanesInComp: lanesEnd.length };
      }
    }
    return result;
  }, [enriched]);

  /* ===========================
     UI helpers
  =========================== */
  function shiftDate(days: number) {
    const d = ymdToDate(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(dateToYMD(d));
  }

  /* ===========================
     Render
  =========================== */
  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-wrap items-center gap-3 justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-semibold">Esteira de Demandas</h1>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">◀︎</button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5"
            />
            <button onClick={() => shiftDate(1)} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">▶︎</button>
            <button onClick={() => setShowNew(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">
              + Nova demanda
            </button>
          </div>
        </header>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 mb-4">
          <div>
            <span className="block text-sm text-neutral-400 mb-1">Filtrar por responsável</span>
            <select
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5"
            >
              <option>(todos)</option>
              {RESPONSAVEIS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <span className="block text-sm text-neutral-400 mb-1">Filtrar por operação</span>
            <select
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5"
            >
              <option>(todas)</option>
              {OPS.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
            </select>
          </div>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <Kpi label="Demandas no dia" value={stats.total} color="slate" />
          <Kpi label="Concluídas" value={stats.concluida} color="emerald" />
          <Kpi label="Atrasadas" value={stats.atrasada} color="red" />
          <Kpi label="No prazo" value={stats.noPrazo} color="sky" />
        </div>

        {/* Volumetria por responsável */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <VolumeCard title="Por responsável" rows={volumetriaPorResp} />
        </div>

        {/* Timeline */}
        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[110px_1fr] gap-6">
          <HourScale timeline={timeline} />
          <div className="relative h-[860px]">
            {enriched.map((t, i) => {
              const top = percentFromTime(t.inicio, timeline);
              const bottom = percentFromTime(t.fim, timeline);
              const height = Math.max(1, bottom - top);

              const info = lanesInfo[i] ?? { lane: 0, lanesInComp: 1 };
              const gap = 12;
              const left = `calc(${(info.lane / info.lanesInComp) * 100}% + ${info.lane * gap}px)`;
              const width = `calc(${100 / info.lanesInComp}% - ${((info.lanesInComp - 1) / info.lanesInComp) * gap}px)`;

              let bg = "bg-sky-500 text-neutral-900";
              let badge = "NO PRAZO";
              const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5));
              if (t.concluida) {
                bg = "bg-emerald-500";
                badge = "CONCLUÍDA";
              } else if (nowMin >= t.endMin) {
                bg = "bg-red-500";
                badge = "ATRASADA";
              }

              return (
                <div
                  key={t.id}
                  className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
                  style={{ top: `${top}%`, height: `${height}%`, left, width }}
                  onClick={() => setEditing(t)}
                  title={`${t.titulo} — ${t.inicio}–${t.fim}`}
                >
                  <div className={`w-full h-full ${bg} flex items-center justify-between px-3`}>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">{badge}</span>
                      <span className="font-medium text-sm md:text-base line-clamp-2">
                        {t.titulo}
                        {t.operacao ? (
                          <span className="ml-2 text-xs opacity-90">— {t.operacao}</span>
                        ) : null}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.responsavel && (
                        <span className="text-xs md:text-sm opacity-90 bg-black/20 px-2 py-0.5 rounded-full">
                          {t.responsavel}
                        </span>
                      )}
                      <span className="text-xs md:text-sm opacity-80">
                        {t.inicio} – {t.fim}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Modal Nova */}
      {showNew && (
        <TaskModal
          title="Nova demanda"
          ops={OPS}
          onCancel={() => setShowNew(false)}
          currentYmd={selectedDate}
          onSubmit={async (payload) => {
            await createTasksFromRecurrence({
              titulo: payload.titulo,
              inicio: payload.inicio,
              fim: payload.fim,
              responsavel: payload.responsavel,
              operacao: payload.operacao,
              recKind: payload.recKind ?? "once",
              weeklyDay: payload.weeklyDay,
            });
            setShowNew(false);
          }}
        />
      )}

      {/* Modal Editar */}
      {editing && (
        <EditModal
          task={editing}
          ops={OPS}
          onCancel={() => setEditing(null)}
          onDelete={async () => {
            await deleteTask(editing.id, editing.ymd);
            setEditing(null);
          }}
          onSubmit={async (patch) => {
            await updateTask(editing.id, editing.ymd, patch);
            setEditing(null);
          }}
          onDeleteSeries={async (seriesId) => {
            await deleteSeriesAll(seriesId);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/* ===========================
   Componentes de UI
=========================== */
function Kpi({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "emerald" | "red" | "sky" | "slate";
}) {
  const bar =
    color === "emerald"
      ? "bg-emerald-500"
      : color === "red"
      ? "bg-red-500"
      : color === "sky"
      ? "bg-sky-500"
      : "bg-slate-400";
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-lg relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} />
      <div className="text-sm text-neutral-400 flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${bar}`} />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  );
}

function VolumeCard({ title, rows }: { title: string; rows: [string, number][] }) {
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-lg">
      <h3 className="text-sm text-neutral-300 mb-2">{title}</h3>
      <div className="space-y-2">
        {rows.length === 0 && <div className="text-sm text-neutral-500">Sem dados</div>}
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between text-sm">
            <span className="text-neutral-300">{k || "—"}</span>
            <span className="text-neutral-100 font-medium">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function HourScale({ timeline }: { timeline: Timeline }) {
  const ticks: string[] = [];
  for (let m = timeline.startMin; m <= timeline.endMin; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const min = String(m % 60).padStart(2, "0");
    ticks.push(`${h}:${min}`);
  }
  return (
    <div className="relative select-none pr-2">
      <div className="absolute right-0 top-0 bottom-0 w-px bg-neutral-800" />
      <div className="h-[860px] flex flex-col justify-between text-xs text-neutral-400">
        {ticks.map((t) => (
          <div key={t} className="relative flex items-center">
            <span>{t}</span>
            <div className={`absolute left-full ml-4 top-1/2 -translate-y-1/2 w-[9999px] h-px ${t.endsWith(":00") ? "bg-neutral-700" : "bg-neutral-800/50"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ---------- Modais ---------- */
type ModalTaskInput = {
  titulo: string;
  responsavel: string;
  operacao: string;
  inicio: string;
  fim: string;
  recKind?: RecKind;
  weeklyDay?: number;
};

function TaskModal({
  title,
  ops,
  onCancel,
  onSubmit,
  currentYmd,
}: {
  title: string;
  ops: string[];
  onCancel: () => void;
  onSubmit: (t: ModalTaskInput) => Promise<void>;
  currentYmd: string;
}) {
  const [titulo, setTitulo] = useState("");
  const [responsavel, setResponsavel] = useState(RESPONSAVEIS[0]);
  const [operacao, setOperacao] = useState(ops[0] || "");
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("09:00");
  const [recKind, setRecKind] = useState<RecKind>("once");

  const startDOW = ymdToDate(currentYmd).getDay(); // 0..6
  const [weeklyDay, setWeeklyDay] = useState<number>(startDOW);
  const WEEKDAYS = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

  return (
    <Modal onClose={onCancel}>
      <h3 className="text-lg font-semibold mb-4">{title}</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Nome da demanda</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            placeholder="Ex.: Enviar funil diário"
          />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Responsável</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            {RESPONSAVEIS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Operação</span>
          <select
            value={operacao}
            onChange={(e) => setOperacao(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            {ops.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Recorrência</span>
          <select
            value={recKind}
            onChange={(e) => setRecKind(e.target.value as RecKind)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            <option value="once">Apenas este dia</option>
            <option value="daily">Todos os dias</option>
            <option value="weekly">Uma vez por semana</option>
          </select>

          {recKind === "weekly" && (
            <div className="mt-2">
              <span className="block mb-1 text-neutral-300">Dia da semana</span>
              <select
                value={weeklyDay}
                onChange={(e) => setWeeklyDay(parseInt(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
              >
                {WEEKDAYS.map((d, idx) => (
                  <option key={idx} value={idx}>{d}</option>
                ))}
              </select>
            </div>
          )}
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora início</span>
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora fim</span>
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
          Cancelar
        </button>
        <button
          onClick={async () => {
            if (!isHHMM(inicio) || !isHHMM(fim) || hhmmToMin(fim) <= hhmmToMin(inicio)) {
              alert("Verifique os horários.");
              return;
            }
            await onSubmit({
              titulo: titulo.trim() || "Demanda",
              responsavel,
              operacao,
              inicio,
              fim,
              recKind,
              weeklyDay,
            });
          }}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
}

function EditModal({
  task,
  ops,
  onCancel,
  onDelete,
  onSubmit,
  onDeleteSeries,
}: {
  task: Task;
  ops: string[];
  onCancel: () => void;
  onDelete: () => Promise<void>;
  onSubmit: (patch: Partial<Task>) => Promise<void>;
  onDeleteSeries?: (seriesId: string) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(task.titulo);
  const [responsavel, setResponsavel] = useState(task.responsavel || RESPONSAVEIS[0]);
  const [operacao, setOperacao] = useState(task.operacao || ops[0] || "");
  const [inicio, setInicio] = useState(task.inicio);
  const [fim, setFim] = useState(task.fim);
  const [concluida, setConcluida] = useState(task.concluida);

  return (
    <Modal onClose={onCancel}>
      <h3 className="text-lg font-semibold mb-4">Editar demanda</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Nome da demanda</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Responsável</span>
          <select
            value={responsavel}
            onChange={(e) => setResponsavel(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            {RESPONSAVEIS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Operação</span>
          <select
            value={operacao}
            onChange={(e) => setOperacao(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            {ops.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Recorrência (informativo)</span>
          <input
            disabled
            value={
              task.recKind === "daily"
                ? "todos os dias"
                : task.recKind === "weekly"
                ? "uma vez por semana"
                : `apenas ${task.ymd}`
            }
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-500"
          />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora início</span>
          <input
            type="time"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          />
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora fim</span>
          <input
            type="time"
            value={fim}
            onChange={(e) => setFim(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          />
        </label>
      </div>

      <label className="mt-2 flex items-center gap-2 text-sm">
        <input type="checkbox" checked={concluida} onChange={(e) => setConcluida(e.target.checked)} />
        Concluída
      </label>

      <div className="flex flex-wrap justify-between gap-2 mt-4">
        <button onClick={onDelete} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">
          Excluir esta
        </button>

        {task.seriesId && (
          <button
            title="Remove todas as ocorrências desta série recorrente"
            onClick={async () => {
              if (confirm("Excluir TODAS as ocorrências desta demanda recorrente?")) {
                await onDeleteSeries?.(task.seriesId!);
              }
            }}
            className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600"
          >
            Excluir todos os dias
          </button>
        )}

        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!isHHMM(inicio) || !isHHMM(fim) || hhmmToMin(fim) <= hhmmToMin(inicio)) {
                alert("Verifique os horários.");
                return;
              }
              await onSubmit({
                titulo: titulo.trim() || "Demanda",
                inicio,
                fim,
                responsavel,
                operacao,
                concluida,
              });
            }}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-xl shadow-xl">
        <button
          className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-200"
          onClick={onClose}
          aria-label="Fechar"
        >
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}
