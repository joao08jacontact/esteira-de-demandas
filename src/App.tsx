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
  updateDoc as updateDocRaw,
  arrayUnion,
} from "firebase/firestore";
import { db, tasksCollection, workspaceSettingsRef } from "./lib/firebase";

/* =========================================================
 * Helpers de tempo / timeline
 * =======================================================*/

type Task = {
  id?: string;
  titulo: string;
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"
  responsavel: string;
  operacao: string;
  concluida: boolean;
  createdAt?: number;
};

function hhmmToMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function dateFromYMD(ymd: string, h = 0, m = 0) {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h, m);
}
function minToPct(min: number, start: number, total: number) {
  return clamp(((min - start) / total) * 100, 0, 100);
}

/* =========================================================
 * Constantes
 * =======================================================*/

const RESPONSAVEIS = [
  "Bárbara Arruda",
  "Gabriel Bion",
  "Luciano Miranda",
  "João Vinicius",
  "Lucas Siqueira",
];

/* =========================================================
 * App
 * =======================================================*/

export default function App() {
  // Workspace pela URL (?ws=…)
  const params = new URLSearchParams(location.search);
  const wsId = params.get("ws") || "demo";

  // Data selecionada
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [now, setNow] = useState(new Date());

  // Filtros
  const [fResp, setFResp] = useState<string>("__ALL__");
  const [fOp, setFOp] = useState<string>("__ALL__");

  // Operações (persistentes por workspace)
  const [operations, setOperations] = useState<string[]>(["FMU", "COGNA"]);

  // Tasks (snapshot do Firestore)
  const [tasks, setTasks] = useState<Task[]>([]);

  // Atualiza relógio (linha do "agora")
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // Carregar operações persistidas do workspace
  useEffect(() => {
    let live = true;
    async function loadOps() {
      try {
        const ref = workspaceSettingsRef(wsId);
        const snap = await getDoc(ref);
        const ops = snap.exists() ? (snap.data().operations as string[] | undefined) : undefined;
        if (live) {
          setOperations(ops && ops.length ? ops : ["FMU", "COGNA"]);
        }
      } catch (e) {
        console.error("Erro lendo operações:", e);
        if (live) setOperations(["FMU", "COGNA"]);
      }
    }
    loadOps();
    return () => { live = false; };
  }, [wsId]);

  // Assinar tasks do dia
  useEffect(() => {
    const col = tasksCollection(wsId, selectedDate);
    const qy = query(col, orderBy("createdAt", "asc"));
    const unsub = onSnapshot(qy, (snap) => {
      const arr: Task[] = [];
      snap.forEach((d) => {
        const data = d.data() as Task;
        arr.push({ ...data, id: d.id });
      });
      setTasks(arr);
    });
    return () => unsub();
  }, [wsId, selectedDate]);

  // Timeline
  const dayStart = "08:00";
  const dayEnd = "20:00";
  const startMin = hhmmToMin(dayStart);
  const endMin = hhmmToMin(dayEnd);
  const total = Math.max(1, endMin - startMin);

  // Filtro aplicado
  const visibleTasks = useMemo(() => {
    return tasks.filter((t) => {
      if (fResp !== "__ALL__" && t.responsavel !== fResp) return false;
      if (fOp !== "__ALL__" && t.operacao !== fOp) return false;
      return true;
    });
  }, [tasks, fResp, fOp]);

  // Estatísticas
  const stats = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let concl = 0, atr = 0, nop = 0;
    for (const t of visibleTasks) {
      const end = hhmmToMin(t.fim);
      if (t.concluida) concl++;
      else if (end <= nowMin) atr++;
      else nop++;
    }
    return { total: visibleTasks.length, concl, atr, nop };
  }, [visibleTasks, now]);

  // Salvar nova operação (persistente)
  async function addNewOperationFlow(): Promise<string | null> {
    const name = (prompt("Nome da operação:") || "").trim();
    if (!name) return null;
    const lower = operations.map((o) => o.toLowerCase());
    if (lower.includes(name.toLowerCase())) return name;

    try {
      const ref = workspaceSettingsRef(wsId);
      // garante que o doc exista
      await setDoc(ref, { operations: [] }, { merge: true });
      // adiciona sem duplicar
      await updateDocRaw(ref, { operations: arrayUnion(name) });
      setOperations((prev) => [...prev, name]);
      return name;
    } catch (e) {
      console.error("Erro salvando nova operação:", e);
      alert("Não consegui salvar a nova operação no Firestore.");
      return null;
    }
  }

  // Criar / Atualizar / Excluir tarefa
  async function createTask(data: Omit<Task, "id">) {
    const col = tasksCollection(wsId, selectedDate);
    await addDoc(col, { ...data, createdAt: Date.now() });
  }
  async function saveTask(id: string, patch: Partial<Task>) {
    const ref = doc(tasksCollection(wsId, selectedDate), id);
    await updateDoc(ref, patch as any);
  }
  async function deleteTask(id: string) {
    const ref = doc(tasksCollection(wsId, selectedDate), id);
    await deleteDoc(ref);
  }

  // Navegação dia
  function shiftDate(days: number) {
    const d = dateFromYMD(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  /* ===========================
   * UI
   * =========================*/

  const [showNew, setShowNew] = useState(false);
  const [edit, setEdit] = useState<Task | null>(null);

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <header className="flex flex-wrap gap-3 items-center justify-between">
          <h1 className="text-3xl font-semibold">Esteira de Demandas</h1>
          <div className="flex items-center gap-2">
            <span className="text-neutral-300">
              Janela do dia: <b>{dayStart}</b>–<b>{dayEnd}</b>. Agora:{" "}
              {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              {"  "} | Workspace:
            </span>
            <span className="px-2 py-1 rounded bg-neutral-800">{wsId}</span>
          </div>
        </header>

        {/* Barra de data + ações */}
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => shiftDate(-1)} className="px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700">◀︎</button>
          <input
            type="date"
            className="bg-neutral-900 border border-neutral-700 rounded px-2 py-1.5"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
          />
          <button onClick={() => shiftDate(1)} className="px-2.5 py-1.5 rounded bg-neutral-800 hover:bg-neutral-700">▶︎</button>

          <div className="flex-1" />

          {/* Filtro por Responsável */}
          <select
            value={fResp}
            onChange={(e) => setFResp(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5"
          >
            <option value="__ALL__">Filtrar por responsável (todos)</option>
            {RESPONSAVEIS.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>

          {/* Filtro por Operação */}
          <select
            value={fOp}
            onChange={(e) => setFOp(e.target.value)}
            className="bg-neutral-900 border border-neutral-700 rounded px-3 py-1.5"
          >
            <option value="__ALL__">Filtrar por operação (todas)</option>
            {operations.map((o) => (
              <option key={o} value={o}>{o}</option>
            ))}
          </select>

          <button
            onClick={() => setShowNew(true)}
            className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            + Nova demanda
          </button>
        </div>

        {/* Cards de estatística */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Demandas no dia" value={stats.total} accent="slate" />
          <StatCard label="Concluídas" value={stats.concl} accent="emerald" />
          <StatCard label="Atrasadas" value={stats.atr} accent="red" />
          <StatCard label="No prazo" value={stats.nop} accent="sky" />
        </div>

        {/* Timeline */}
        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[100px_1fr] gap-4">
          <HourScale startMin={startMin} endMin={endMin} />
          <div className="relative h-[720px]">
            <NowLine now={now} startMin={startMin} total={total} />
            <TaskStack
              tasks={visibleTasks}
              startMin={startMin}
              total={total}
              onClick={(t) => setEdit(t)}
            />
          </div>
        </div>
      </div>

      {showNew && (
        <TaskModal
          title="Nova demanda"
          operations={operations}
          onAddOperation={addNewOperationFlow}
          onClose={() => setShowNew(false)}
          onSave={async (payload) => {
            await createTask(payload);
            setShowNew(false);
          }}
        />
      )}

      {edit && (
        <TaskModal
          title="Editar demanda"
          initial={edit}
          operations={operations}
          onAddOperation={addNewOperationFlow}
          onClose={() => setEdit(null)}
          onDelete={async () => {
            if (edit?.id) await deleteTask(edit.id);
            setEdit(null);
          }}
          onSave={async (payload) => {
            if (edit?.id) await saveTask(edit.id, payload);
            setEdit(null);
          }}
        />
      )}
    </div>
  );
}

/* =========================================================
 * Componentes de UI auxiliares
 * =======================================================*/

function StatCard({
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

function HourScale({ startMin, endMin }: { startMin: number; endMin: number }) {
  const ticks: string[] = [];
  for (let m = startMin; m <= endMin; m += 30) {
    const h = Math.floor(m / 60).toString().padStart(2, "0");
    const mm = (m % 60).toString().padStart(2, "0");
    ticks.push(`${h}:${mm}`);
  }
  return (
    <div className="relative select-none">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-neutral-800" />
      <div className="h-[720px] flex flex-col justify-between text-xs text-neutral-400 pr-2">
        {ticks.map((t) => (
          <div key={t} className="relative flex items-center">
            <div
              className={`absolute -left-4 top-1/2 -translate-y-1/2 h-px ${
                t.endsWith(":00") ? "w-10 bg-neutral-600" : "w-8 bg-neutral-700"
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

function NowLine({ now, startMin, total }: { now: Date; startMin: number; total: number }) {
  const pos = now.getHours() * 60 + now.getMinutes();
  const top = clamp(((pos - startMin) / total) * 100, 0, 100);
  return (
    <div
      className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
      style={{ top: `${top}%` }}
    >
      <span className="absolute -top-3 left-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold shadow">
        {now.toLocaleString([], {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })}
      </span>
    </div>
  );
}

/**
 * Distribui tarefas em "lanes" para que, se houver sobreposição,
 * elas fiquem lado a lado (não uma em cima da outra).
 */
function TaskStack({
  tasks,
  startMin,
  total,
  onClick,
}: {
  tasks: Task[];
  startMin: number;
  total: number;
  onClick: (t: Task) => void;
}) {
  const gap = 10;

  type T = Task & { idx: number; s: number; e: number };
  const arr: T[] = tasks.map((t, idx) => ({
    ...t,
    idx,
    s: hhmmToMin(t.inicio),
    e: hhmmToMin(t.fim),
  }));

  // Grafo de sobreposição
  const n = arr.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const ov = arr[i].s < arr[j].e && arr[j].s < arr[i].e;
      if (ov) {
        adj[i].push(j);
        adj[j].push(i);
      }
    }
  }

  // Componentes conectados -> alocar lanes por componente
  const comp = Array(n).fill(-1);
  let cc = 0;
  for (let i = 0; i < n; i++) {
    if (comp[i] !== -1) continue;
    const q = [i];
    comp[i] = cc;
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj[u]) if (comp[v] === -1) {
        comp[v] = cc;
        q.push(v);
      }
    }
    cc++;
  }

  const laneInfo: Record<number, { lane: number; lanes: number }> = {};
  for (let c = 0; c < cc; c++) {
    const group = arr
      .filter((_, i) => comp[i] === c)
      .sort((a, b) => a.s - b.s || a.e - b.e);

    const ends: number[] = [];
    for (const t of group) {
      let lane = -1;
      for (let li = 0; li < ends.length; li++) {
        if (ends[li] <= t.s) { lane = li; break; }
      }
      if (lane === -1) {
        ends.push(t.e);
        lane = ends.length - 1;
      } else {
        ends[lane] = t.e;
      }
      laneInfo[t.idx] = { lane, lanes: ends.length };
    }
  }

  return (
    <div className="absolute inset-0">
      {arr.map((t) => {
        const top = minToPct(t.s, startMin, total);
        const bottom = minToPct(t.e, startMin, total);
        const height = Math.max(1, bottom - top);

        let bg = "bg-sky-500 text-neutral-900";
        let badge = "NO PRAZO";
        const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
        if (t.concluida) { bg = "bg-emerald-500"; badge = "CONCLUÍDA"; }
        else if (t.e <= nowMin) { bg = "bg-red-500"; badge = "ATRASADA"; }

        const info = laneInfo[t.idx] ?? { lane: 0, lanes: 1 };
        const left = `calc(${(info.lane / info.lanes) * 100}% + ${info.lane * gap}px)`;
        const width = `calc(${100 / info.lanes}% - ${((info.lanes - 1) / info.lanes) * gap}px)`;

        return (
          <div
            key={t.id || t.titulo + t.inicio}
            className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
            style={{ top: `${top}%`, height: `${height}%`, left, width }}
            title={`${t.titulo} — ${t.inicio}–${t.fim}`}
            onClick={() => onClick(t)}
          >
            <div className={`w-full h-full ${bg} flex items-center justify-between px-3`}>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">{badge}</span>
                <span className="font-medium text-sm md:text-base line-clamp-2">{t.titulo}</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-black/25">{t.responsavel}</span>
              </div>
              <div className="text-xs md:text-sm opacity-80">{t.inicio} – {t.fim}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================================================
 * Modal de Nova/Editar Demanda
 * =======================================================*/

function TaskModal({
  title,
  initial,
  operations,
  onAddOperation,
  onClose,
  onSave,
  onDelete,
}: {
  title: string;
  initial?: Task | null;
  operations: string[];
  onAddOperation: () => Promise<string | null>;
  onClose: () => void;
  onSave: (payload: Omit<Task, "id">) => Promise<void>;
  onDelete?: () => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(initial?.titulo ?? "");
  const [responsavel, setResponsavel] = useState(initial?.responsavel ?? RESPONSAVEIS[0]);
  const [operacao, setOperacao] = useState(initial?.operacao ?? operations[0] ?? "");
  const [inicio, setInicio] = useState(initial?.inicio ?? "08:00");
  const [fim, setFim] = useState(initial?.fim ?? "09:00");
  const [concluida, setConcluida] = useState(Boolean(initial?.concluida));

  async function handleSave() {
    if (!titulo.trim()) {
      alert("Informe o nome da demanda.");
      return;
    }
    if (hhmmToMin(fim) <= hhmmToMin(inicio)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }
    const payload: Omit<Task, "id"> = {
      titulo: titulo.trim(),
      responsavel,
      operacao,
      inicio,
      fim,
      concluida,
    };
    await onSave(payload);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-2xl shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button className="text-neutral-400 hover:text-neutral-200" onClick={onClose}>✕</button>
        </div>

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
              onChange={async (e) => {
                const v = e.target.value;
                if (v === "__ADD__") {
                  const created = await onAddOperation();
                  if (created) setOperacao(created);
                } else {
                  setOperacao(v);
                }
              }}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              {operations.map((o) => (
                <option key={o} value={o}>{o}</option>
              ))}
              <option value="__ADD__">+ Adicionar nova operação…</option>
            </select>
          </label>

          <div className="grid grid-cols-2 gap-3">
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
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={concluida}
            onChange={(e) => setConcluida(e.target.checked)}
          />
          Concluída
        </label>

        <div className="flex justify-between">
          {onDelete ? (
            <button
              onClick={onDelete}
              className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500"
            >
              Excluir esta
            </button>
          ) : <span />}

          <div className="flex gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
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
      </div>
    </div>
  );
}
