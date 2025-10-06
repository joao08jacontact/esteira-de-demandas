// src/App.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  getDoc,
  setDoc,
  getDocs,
  writeBatch,
  where,
  arrayUnion,
} from "firebase/firestore";
import {
  db,
  tasksCollection,
  dayDoc,
  settingsDoc,
  tasksCollectionGroup,
} from "./lib/firebase";
import { useWorkspaceId } from "./hooks/useWorkspace";

/* ===========================
   Tipos
=========================== */

type Recurrence =
  | { kind: "once" }
  | { kind: "daily" }
  | { kind: "weekly"; weekday: number };

type Task = {
  id: string;
  titulo: string;
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"
  concluida: boolean;
  responsavel: string;
  operacao: string;
  ymd: string; // dia da ocorrência
  seriesId?: string; // para excluir toda série
  recKind: "once" | "daily" | "weekly";
  workspaceId: string;
  createdAt: number;
};

type NewTaskPayload = {
  titulo: string;
  inicio: string;
  fim: string;
  concluida: boolean;
  responsavel: string;
  operacao: string;
};

type Timeline = {
  startMin: number;
  endMin: number;
  totalMin: number;
};

/* ===========================
   Utilitários
=========================== */

// Validador de HH:MM
function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}

function hhmmToMin(hhmm: string): number {
  if (!isHHMM(hhmm)) return 0; // evita exception se vier dado ruim
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return 0;
  return h * 60 + m;
}

function fmtHM(hhmm: string) {
  return hhmm;
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
  // guarda contra valores quebrados (ex.: undefined)
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
   Dados fixos / defaults
=========================== */

const RESPONSAVEIS = [
  "Bárbara Arruda",
  "Gabriel Bion",
  "Luciano Miranda",
  "João Vinicius",
  "Lucas Siqueira",
] as const;

const DEFAULT_OPERATIONS = ["FMU", "COGNA"];

/* ===========================
   UI Primitivas
=========================== */

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-2xl shadow-xl">
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

/* ===========================
   Timeline (grade + now/lanes)
=========================== */

function HourScaleVertical({ timeline }: { timeline: Timeline }) {
  // ticks de 30 em 30 com espaçamento maior (100px por hora)
  const ticks: string[] = [];
  for (let m = timeline.startMin; m <= timeline.endMin; m += 30) {
    const h = Math.floor(m / 60).toString().padStart(2, "0");
    const min = (m % 60).toString().padStart(2, "0");
    ticks.push(`${h}:${min}`);
  }
  return (
    <div className="relative select-none">
      <div className="h-[1200px] flex flex-col justify-between text-xs text-neutral-400 pr-2">
        {ticks.map((t) => (
          <div key={t} className="relative flex items-center">
            <div
              className={`absolute -left-2 top-1/2 -translate-y-1/2 h-px ${
                t.endsWith(":00") ? "w-8 bg-neutral-600" : "w-6 bg-neutral-700"
              }`}
            />
            <span>{t}</span>
            <div
              className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 w-full h-px ${
                t.endsWith(":00") ? "bg-neutral-700" : "bg-neutral-800/50"
              }`}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStackVertical({
  tasks,
  timeline,
  onClickTask,
}: {
  tasks: Task[];
  timeline: Timeline;
  onClickTask: (t: Task) => void;
}) {
  const gap = 10;

  // Garante que só entram tarefas com HH:MM válido
const safeTasks = tasks.filter((t) => isHHMM(t.inicio) && isHHMM(t.fim));

type Enriched = Task & { startMin: number; endMin: number; idx: number };
const enriched: Enriched[] = safeTasks.map((t, idx) => ({
  ...t,
  startMin: hhmmToMin(t.inicio),
  endMin: hhmmToMin(t.fim),
  idx,
  }));


  const overlap = (a: Enriched, b: Enriched) =>
    a.startMin < b.endMin && b.startMin < a.endMin;

  const n = enriched.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      if (overlap(enriched[i], enriched[j])) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  const compId: number[] = Array(n).fill(-1);
  let compCount = 0;
  for (let i = 0; i < n; i++) {
    if (compId[i] !== -1) continue;
    const q = [i];
    compId[i] = compCount;
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj[u]) {
        if (compId[v] === -1) {
          compId[v] = compCount;
          q.push(v);
        }
      }
    }
    compCount++;
  }

  type LaneInfo = { lane: number; lanesInComp: number };
  const laneInfo: Record<number, LaneInfo> = {};
  for (let c = 0; c < compCount; c++) {
    const nodes = enriched
      .filter((_, i) => compId[i] === c)
      .sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin);
    const lanesEnd: number[] = [];
    for (const t of nodes) {
      let placedLane = -1;
      for (let li = 0; li < lanesEnd.length; li++) {
        if (lanesEnd[li] <= t.startMin) {
          placedLane = li;
          break;
        }
      }
      if (placedLane === -1) {
        lanesEnd.push(t.endMin);
        placedLane = lanesEnd.length - 1;
      } else {
        lanesEnd[placedLane] = t.endMin;
      }
      laneInfo[t.idx] = { lane: placedLane, lanesInComp: lanesEnd.length };
    }
  }

  return (
    <div className="absolute inset-0">
      {enriched.map((t) => {
        const top = percentFromTime(t.inicio, timeline);
        const bottom = percentFromTime(t.fim, timeline);
        const height = Math.max(1, bottom - top);

        let bg = "bg-sky-500";
        let badge = "NO PRAZO";
        const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5));
        if (t.concluida) {
          bg = "bg-emerald-500";
          badge = "CONCLUÍDA";
        } else if (nowMin >= t.endMin) {
          bg = "bg-red-500";
          badge = "ATRASADA";
        }

        const info = laneInfo[t.idx] ?? { lane: 0, lanesInComp: 1 };
        const left = `calc(${(info.lane / info.lanesInComp) * 100}% + ${
          info.lane * gap
        }px)`;
        const width = `calc(${100 / info.lanesInComp}% - ${
          ((info.lanesInComp - 1) / info.lanesInComp) * gap
        }px)`;

        return (
          <div
            key={t.id}
            className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
            style={{ top: `${top}%`, height: `${height}%`, left, width }}
            onClick={() => onClickTask(t)}
            title={`${t.titulo} — ${t.inicio}–${t.fim}`}
          >
            <div
              className={`w-full h-full ${bg} flex items-center justify-between px-3`}
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">
                  {badge}
                </span>
                <span className="font-semibold text-sm md:text-base line-clamp-1">
                  {t.operacao} — {t.titulo}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs md:text-sm bg-black/25 px-2 py-0.5 rounded-full">
                  {t.responsavel}
                </span>
                <div className="text-xs md:text-sm opacity-90">
                  {fmtHM(t.inicio)} – {fmtHM(t.fim)}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ===========================
   Modais: Novo e Editar
=========================== */

function SelectOperacao({
  value,
  setValue,
  operations,
  onAddOperation,
  label = "Operação",
}: {
  value: string;
  setValue: (v: string) => void;
  operations: string[];
  onAddOperation: (name: string) => Promise<void>;
  label?: string;
}) {
  const ADD_VALUE = "__ADD__";
  return (
    <label className="text-sm block">
      <span className="block mb-1 text-neutral-300">{label}</span>
      <select
        value={value}
        onChange={async (e) => {
          if (e.target.value === ADD_VALUE) {
            const name = window.prompt("Nome da operação:")?.trim();
            if (!name) return;
            await onAddOperation(name);
            setValue(name);
          } else {
            setValue(e.target.value);
          }
        }}
        className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
      >
        {operations.map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
        <option value={ADD_VALUE}>+ Adicionar nova operação…</option>
      </select>
    </label>
  );
}

function NewTaskModal({
  ymd,
  ws,
  operations,
  onAddOperation,
  onClose,
  onCreated,
}: {
  ymd: string;
  ws: string;
  operations: string[];
  onAddOperation: (name: string) => Promise<void>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("09:00");
  const [responsavel, setResponsavel] = useState<string>(RESPONSAVEIS[0]);
  const [operacao, setOperacao] = useState<string>(operations[0] || "FMU");
  const [recurrence, setRecurrence] = useState<"once" | "daily" | "weekly">(
    "once"
  );

  async function createOccurrences(
    base: NewTaskPayload,
    rec: Recurrence,
    startYmd: string
  ) {
    const batch = writeBatch(db);
    const seriesId =
      rec.kind === "once" ? undefined : crypto.randomUUID().toString();

    const startDate = ymdToDate(startYmd);
    const maxDays = 60;
    for (let i = 0; i < maxDays; i++) {
      const d = new Date(startDate.getTime());
      d.setDate(d.getDate() + i);
      const ymd = dateToYMD(d);

      if (rec.kind === "daily") {
        // inclui todos os dias
      } else if (rec.kind === "weekly") {
        if (d.getDay() !== rec.weekday) continue;
      } else if (rec.kind === "once") {
        if (i > 0) break; // só o primeiro dia
      }

      const ref = doc(tasksCollection(ws, ymd));
      batch.set(ref, {
        ...base,
        ymd,
        recKind: rec.kind,
        seriesId,
        workspaceId: ws,
        createdAt: Date.now(),
      });
    }

    await batch.commit();
  }

  async function handleSave() {
    if (hhmmToMin(fim) <= hhmmToMin(inicio)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }

    const base: NewTaskPayload = {
      titulo: titulo.trim() || "Nova demanda",
      inicio,
      fim,
      concluida: false,
      responsavel,
      operacao,
    };

    const rec: Recurrence =
      recurrence === "once"
        ? { kind: "once" }
        : recurrence === "daily"
        ? { kind: "daily" }
        : { kind: "weekly", weekday: ymdToDate(ymd).getDay() };

    await createOccurrences(base, rec, ymd);
    onCreated();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold mb-4">Nova demanda</h3>

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

        <SelectOperacao
          value={operacao}
          setValue={setOperacao}
          operations={operations}
          onAddOperation={onAddOperation}
        />

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Recorrência</span>
          <select
            value={recurrence}
            onChange={(e) => setRecurrence(e.target.value as any)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            <option value="once">Apenas este dia ({ymd})</option>
            <option value="daily">Todos os dias</option>
            <option value="weekly">Uma vez por semana</option>
          </select>
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
        <button
          onClick={onClose}
          className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700"
        >
          Cancelar
        </button>
        <button
          onClick={handleSave}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
        >
          Salvar
        </button>
      </div>
    </Modal>
  );
}

function EditTaskModal({
  task,
  operations,
  onAddOperation,
  onClose,
}: {
  task: Task;
  operations: string[];
  onAddOperation: (name: string) => Promise<void>;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState(task.titulo);
  const [inicio, setInicio] = useState(task.inicio);
  const [fim, setFim] = useState(task.fim);
  const [responsavel, setResponsavel] = useState(task.responsavel);
  const [operacao, setOperacao] = useState(task.operacao);
  const [concluida, setConcluida] = useState(task.concluida);

  async function handleSave() {
    if (hhmmToMin(fim) <= hhmmToMin(inicio)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }
    await updateDoc(doc(tasksCollection(task.workspaceId, task.ymd), task.id), {
      titulo: titulo.trim() || "Demanda",
      inicio,
      fim,
      responsavel,
      operacao,
      concluida,
    });
    onClose();
  }

  async function deleteThis() {
    if (!confirm("Excluir somente esta ocorrência?")) return;
    await deleteDoc(doc(tasksCollection(task.workspaceId, task.ymd), task.id));
    onClose();
  }

  async function deleteAll() {
    if (!task.seriesId || task.recKind === "once") return;
    if (!confirm("Excluir TODAS as ocorrências desta série?")) return;
    const q = query(
      tasksCollectionGroup(),
      where("workspaceId", "==", task.workspaceId),
      where("seriesId", "==", task.seriesId)
    );
    const snap = await getDocs(q);
    const batch = writeBatch(db);
    snap.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    onClose();
  }

  return (
    <Modal onClose={onClose}>
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

        <SelectOperacao
          value={operacao}
          setValue={setOperacao}
          operations={operations}
          onAddOperation={onAddOperation}
        />

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
          <span className="block mb-1 text-neutral-300">
            Recorrência (apenas informativa para esta ocorrência)
          </span>
          <input
            value={
              task.recKind === "once"
                ? `apenas ${task.ymd}`
                : task.recKind === "daily"
                ? "diária"
                : "semanal"
            }
            readOnly
            className="w-full bg-neutral-900 border border-neutral-800 rounded-lg px-3 py-2 text-neutral-400"
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

      <div className="mt-2">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
          />
          Concluída
        </label>
      </div>

      <div className="flex flex-wrap justify-between gap-2 mt-4">
        <div className="flex gap-2">
          <button
            onClick={deleteThis}
            className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500"
          >
            Excluir esta
          </button>
          {task.seriesId && task.recKind !== "once" && (
            <button
              onClick={deleteAll}
              className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600"
            >
              Excluir toda a série
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* ===========================
   App
=========================== */

export default function App() {
  const ws = useWorkspaceId();

  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [tasks, setTasks] = useState<Task[]>([]);
  const [operations, setOperations] = useState<string[]>(DEFAULT_OPERATIONS);
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Task | null>(null);

  // Filtros
  const [filterResp, setFilterResp] = useState<string>("__ALL__");
  const [filterOp, setFilterOp] = useState<string>("__ALL__");

  // Relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15000);
    return () => clearInterval(t);
  }, []);

  // Carrega/escuta tarefas do dia
useEffect(() => {
  const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio"));

  return onSnapshot(qy, (snap) => {
    const list: Task[] = [];

    snap.forEach((d) => {
      const data = d.data() as any;

      // valida horários (evita erro de 'split' e tela preta)
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
        recKind: (data?.recKind ?? "once") as Task["recKind"],
        workspaceId: String(data?.workspaceId ?? ws),
        createdAt: Number(data?.createdAt ?? Date.now()),
      });
    });

    setTasks(list);
  });
}, [ws, selectedDate]);
  
  // Carrega configurações (operações)
  useEffect(() => {
    const unsub = onSnapshot(settingsDoc(ws), async (snap) => {
      if (!snap.exists()) {
        await setDoc(settingsDoc(ws), {
          operations: DEFAULT_OPERATIONS,
        });
        setOperations(DEFAULT_OPERATIONS);
      } else {
        const ops = (snap.data().operations || []) as string[];
        setOperations(ops.length ? ops : DEFAULT_OPERATIONS);
      }
    });
    return unsub;
  }, [ws]);

  // Adiciona nova operação (persiste em meta/settings)
  async function addOperation(name: string) {
    const sRef = settingsDoc(ws);
    await updateDoc(sRef, {
      operations: arrayUnion(name),
    }).catch(async (e) => {
      if (e.code === "not-found" || /No document to update/.test(String(e))) {
        await setDoc(sRef, { operations: arrayUnion(name) }, { merge: true });
      } else {
        throw e;
      }
    });
  }

  // Estatísticas com filtros
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (filterResp !== "__ALL__" && t.responsavel !== filterResp) return false;
      if (filterOp !== "__ALL__" && t.operacao !== filterOp) return false;
      return true;
    });
  }, [tasks, filterResp, filterOp]);

  const stats = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let concluida = 0,
      atrasada = 0,
      noPrazo = 0;
    for (const t of visibleTasks) {
      if (t.concluida) concluida++;
      else if (hhmmToMin(t.fim) <= nowMin) atrasada++;
      else noPrazo++;
    }
    return { total: visibleTasks.length, concluida, atrasada, noPrazo };
  }, [visibleTasks, now]);

  // timeline
  const timeline = useMemo(() => buildTimeline("08:00", "20:00"), []);

  // Navegação de data
  function shiftDate(days: number) {
    const d = ymdToDate(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(dateToYMD(d));
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-3xl font-semibold">Esteira de Demandas</h1>
          <span className="text-sm text-neutral-300">
            Janela do dia: <b>08:00–20:00</b>. Agora:{" "}
            {now.toTimeString().slice(0, 5)} | Workspace:{" "}
            <span className="bg-neutral-800 px-2 py-0.5 rounded">
              {ws}
            </span>
          </span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3 items-end mb-4">
          <label className="text-sm">
            <span className="block mb-1 text-neutral-300">Responsável</span>
            <select
              value={filterResp}
              onChange={(e) => setFilterResp(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="__ALL__">Todos</option>
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
              value={filterOp}
              onChange={(e) => setFilterOp(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="__ALL__">Todas</option>
              {operations.map((op) => (
                <option key={op} value={op}>
                  {op}
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={() => shiftDate(-1)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm"
              title="Dia anterior"
            >
              ◀︎
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm"
            />
            <button
              onClick={() => shiftDate(1)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm"
              title="Próximo dia"
            >
              ▶︎
            </button>

            <button
              onClick={() => setShowNew(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium"
            >
              + Nova demanda
            </button>
          </div>
        </div>

        {/* Cards topo */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <CardStat label="Demandas no dia" value={stats.total} accent="slate" />
          <CardStat label="Concluídas" value={stats.concluida} accent="emerald" />
          <CardStat label="Atrasadas" value={stats.atrasada} accent="red" />
          <CardStat label="No prazo" value={stats.noPrazo} accent="sky" />
        </div>

        {/* Timeline */}
        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[80px_1fr] gap-4">
          <HourScaleVertical timeline={timeline} />
          <div className="relative h-[1200px]">
            <TaskStackVertical
              tasks={visibleTasks}
              timeline={timeline}
              onClickTask={(t) => setSelected(t)}
            />
          </div>
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          ymd={selectedDate}
          ws={ws}
          operations={operations}
          onAddOperation={addOperation}
          onClose={() => setShowNew(false)}
          onCreated={() => {}}
        />
      )}

      {selected && (
        <EditTaskModal
          task={selected}
          operations={operations}
          onAddOperation={addOperation}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

/* ===========================
   Componentes auxiliares
=========================== */

function CardStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "emerald" | "red" | "sky" | "slate";
}) {
  const bar =
    accent === "emerald"
      ? "bg-emerald-500"
      : accent === "red"
      ? "bg-red-500"
      : accent === "sky"
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
