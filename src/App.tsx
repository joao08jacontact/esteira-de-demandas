import React, { useEffect, useMemo, useState } from "react";
import {
  db,
  ensureWorkspaceConfig,
  configDoc,
  addOperation,
  saveOccurrence,
  removeOccurrenceByPath,
  removeWholeSeries,
  tasksCollection,
} from "./lib/firebase";
import {
  onSnapshot,
  query,
  orderBy,
  updateDoc,
  doc,
  writeBatch,
  getDocs,
} from "firebase/firestore";

/* =========================
   Tipos
========================= */

type Recurrence =
  | { kind: "once"; date: string } // yyyy-mm-dd
  | { kind: "daily" }
  | { kind: "weekly"; weekday: number }; // 0..6

type Task = {
  id: string;             // Firestore ID
  title: string;
  start: string;          // "HH:MM"
  end: string;            // "HH:MM"
  done: boolean;
  assignee: string;       // responsável
  operation: string;      // operação
  seriesId: string;       // liga as ocorrências de uma série
  rec: Recurrence;        // como foi gerada
  ymd: string;            // dia desta ocorrência
  _path: string;          // caminho para apagar/editar rápido
};

type Timeline = { startMin: number; endMin: number; totalMin: number };

/* =========================
   Constantes
========================= */

const DAY_START = "08:00";
const DAY_END = "20:00";

const RESPONSAVEIS = [
  "Bárbara Arruda",
  "Gabriel Bion",
  "Luciano Miranda",
  "João Vinicius",
  "Lucas Siqueira",
] as const;

const DEFAULT_WORKSPACE = new URLSearchParams(location.search).get("ws") || "demo";

/* =========================
   Utilitários de tempo
========================= */

function hhmmToMin(hhmm: string) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function buildTimeline(start: string, end: string): Timeline {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  return { startMin: s, endMin: e, totalMin: Math.max(1, e - s) };
}
function pctFromHHMM(h: string, tl: Timeline) {
  const pos = hhmmToMin(h) - tl.startMin;
  return Math.max(0, Math.min(100, (pos / tl.totalMin) * 100));
}
function dateToYmd(d: Date) {
  return d.toISOString().slice(0, 10);
}
function addDays(ymd: string, delta: number) {
  const d = new Date(ymd + "T00:00:00");
  d.setDate(d.getDate() + delta);
  return dateToYmd(d);
}
function weekday(ymd: string) {
  return new Date(ymd + "T00:00:00").getDay();
}

/* =========================
   UI Auxiliares
========================= */

function Pill({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) {
  return (
    <span className={`text-xs uppercase tracking-wide rounded-full px-2 py-0.5 ${className}`}>{children}</span>
  );
}

function Section({ children }: React.PropsWithChildren) {
  return <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-lg">{children}</div>;
}

/* =========================
   App
========================= */

export default function App() {
  const [workspace, setWorkspace] = useState(DEFAULT_WORKSPACE);
  const [selectedDate, setSelectedDate] = useState(dateToYmd(new Date()));
  const [now, setNow] = useState(new Date());

  const [ops, setOps] = useState<string[]>(["FMU", "COGNA"]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);

  // filtros
  const [filterAssignee, setFilterAssignee] = useState<string>("__all__");
  const [filterOperation, setFilterOperation] = useState<string>("__all__");

  const timeline = useMemo(() => buildTimeline(DAY_START, DAY_END), []);

  // agora “vivo”
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10_000);
    return () => clearInterval(t);
  }, []);

  // carrega operações e garante config
  useEffect(() => {
    (async () => {
      await ensureWorkspaceConfig(workspace);
      const snap = await (await import("firebase/firestore")).getDoc(configDoc(workspace));
      const conf = snap.data() as { operations?: string[] } | undefined;
      if (conf?.operations?.length) setOps(conf.operations);
    })();
  }, [workspace]);

  // assinatura das tarefas do dia
  useEffect(() => {
    const q = query(tasksCollection(workspace, selectedDate), orderBy("start"));
    const unsub = onSnapshot(q, (snap) => {
      const arr: Task[] = [];
      snap.forEach((d) => {
        const data = d.data() as any;
        arr.push({
          id: d.id,
          title: data.title,
          start: data.start,
          end: data.end,
          done: !!data.done,
          assignee: data.assignee,
          operation: data.operation,
          rec: data.rec,
          seriesId: data.seriesId,
          ymd: selectedDate,
          _path: d.ref.path,
        });
      });
      setTasks(arr);
    });
    return () => unsub();
  }, [workspace, selectedDate]);

  /* ========= Filtros aplicados ======== */
  const visibleTasks = useMemo(() => {
    let arr = tasks;
    if (filterAssignee !== "__all__") arr = arr.filter((t) => t.assignee === filterAssignee);
    if (filterOperation !== "__all__") arr = arr.filter((t) => t.operation === filterOperation);
    return arr;
  }, [tasks, filterAssignee, filterOperation]);

  /* ======== Cards (contagens) ========= */
  const stats = useMemo(() => {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    let total = 0, done = 0, late = 0, inTime = 0;
    for (const t of visibleTasks) {
      total++;
      if (t.done) done++;
      else if (hhmmToMin(t.end) <= nowMin) late++;
      else inTime++;
    }
    return { total, done, late, inTime };
  }, [visibleTasks, now]);

  const byAssignee = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of visibleTasks) {
      map.set(t.assignee, (map.get(t.assignee) || 0) + 1);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [visibleTasks]);

  /* ========= Ações ========= */

  function prevDay() { setSelectedDate(addDays(selectedDate, -1)); }
  function nextDay() { setSelectedDate(addDays(selectedDate, 1)); }

  async function toggleDone(t: Task, val: boolean) {
    await updateDoc(doc(db, t._path), { done: val });
  }

  async function deleteOne(t: Task) {
    await removeOccurrenceByPath(t._path);
    setEditTask(null);
  }

  async function deleteSeries(t: Task) {
    await removeWholeSeries(workspace, t.seriesId);
    setEditTask(null);
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto space-y-5">

        {/* Cabeçalho e filtros */}
        <div className="flex items-center gap-3 justify-between">
          <h1 className="text-3xl font-semibold">Esteira de Demandas</h1>
          <div className="flex items-center gap-2">
            <button onClick={prevDay} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">◀︎</button>
            <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5"/>
            <button onClick={nextDay} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700">▶︎</button>
            <button onClick={() => setShowNew(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">
              + Nova demanda
            </button>
          </div>
        </div>

        <div className="text-sm text-neutral-300">
          Janela do dia: <strong>{DAY_START}</strong>–<strong>{DAY_END}</strong>. Agora:{" "}
          {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} | Workspace:{" "}
          <span className="px-2 py-0.5 rounded bg-neutral-800">{workspace}</span>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-3">
          <Section>
            <div className="text-sm text-neutral-400 mb-2">Filtrar por responsável</div>
            <select
              value={filterAssignee}
              onChange={(e) => setFilterAssignee(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="__all__">Todos</option>
              {RESPONSAVEIS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </Section>
          <Section>
            <div className="text-sm text-neutral-400 mb-2">Filtrar por operação</div>
            <select
              value={filterOperation}
              onChange={(e) => setFilterOperation(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="__all__">Todas</option>
              {ops.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
          </Section>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Section>
            <div className="text-sm text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-slate-400" />
              <span>Demandas no dia</span>
            </div>
            <div className="mt-2 text-3xl font-semibold">{stats.total}</div>
          </Section>
          <Section>
            <div className="text-sm text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
              <span>Concluídas</span>
            </div>
            <div className="mt-2 text-3xl font-semibold">{stats.done}</div>
          </Section>
          <Section>
            <div className="text-sm text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-red-500" />
              <span>Atrasadas</span>
            </div>
            <div className="mt-2 text-3xl font-semibold">{stats.late}</div>
          </Section>
          <Section>
            <div className="text-sm text-neutral-400 flex items-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-sky-500" />
              <span>No prazo</span>
            </div>
            <div className="mt-2 text-3xl font-semibold">{stats.inTime}</div>
          </Section>
        </div>

        {/* Cards de volumetria por responsável */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {byAssignee.map(([name, qtd]) => (
            <Section key={name}>
              <div className="text-sm text-neutral-400">{name}</div>
              <div className="mt-2 text-2xl font-semibold">{qtd}</div>
            </Section>
          ))}
        </div>

        {/* Timeline */}
        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[90px_1fr] gap-6">
          <HourScaleVertical timeline={timeline} />
          <div className="relative h-[960px]"> {/* mais alto para espaçamento maior */}
            <NowLine now={now} timeline={timeline} />
            <TaskLanes
              tasks={visibleTasks}
              timeline={timeline}
              onClick={(t) => setEditTask(t)}
            />
          </div>
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          workspace={workspace}
          ymd={selectedDate}
          ops={ops}
          setOps={setOps}
          onClose={() => setShowNew(false)}
        />
      )}

      {editTask && (
        <EditTaskModal
          task={editTask}
          ops={ops}
          setOps={setOps}
          onClose={() => setEditTask(null)}
          onToggleDone={(v) => toggleDone(editTask, v)}
          onDeleteOne={() => deleteOne(editTask)}
          onDeleteSeries={() => deleteSeries(editTask)}
        />
      )}
    </div>
  );
}

/* =========================
   Componentes: escala e now
========================= */

function HourScaleVertical({ timeline }: { timeline: Timeline }) {
  const ticks: string[] = [];
  for (let m = timeline.startMin; m <= timeline.endMin; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, "0");
    const mm = String(m % 60).padStart(2, "0");
    ticks.push(`${h}:${mm}`);
  }
  return (
    <div className="relative select-none">
      <div className="absolute left-[calc(50%)] -translate-x-1/2 top-0 bottom-0 w-px bg-neutral-800" />
      <div className="h-[960px] flex flex-col justify-between text-xs text-neutral-400 pr-2">
        {ticks.map((t) => (
          <div key={t} className="relative flex items-center">
            <div className={`absolute -left-3 top-1/2 -translate-y-1/2 h-px ${t.endsWith(":00") ? "w-10 bg-neutral-600" : "w-6 bg-neutral-700"}`} />
            <span>{t}</span>
            <div className={`absolute left-full ml-3 top-1/2 -translate-y-1/2 w-full h-px ${t.endsWith(":00") ? "bg-neutral-700" : "bg-neutral-800/50"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function NowLine({ now, timeline }: { now: Date; timeline: Timeline }) {
  const mins = now.getHours() * 60 + now.getMinutes();
  const pos = Math.max(0, Math.min(100, ((mins - timeline.startMin) / timeline.totalMin) * 100));
  const stamp = now.toLocaleString([], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{ top: `${pos}%` }}>
      <span className="absolute -top-3 left-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold shadow">{stamp}</span>
    </div>
  );
}

/* =========================
   Lanes (lado a lado)
========================= */

function TaskLanes({
  tasks,
  timeline,
  onClick,
}: {
  tasks: Task[];
  timeline: Timeline;
  onClick: (t: Task) => void;
}) {
  const gap = 12;

  type E = Task & { s: number; e: number; idx: number };
  const list: E[] = tasks.map((t, i) => ({ ...t, s: hhmmToMin(t.start), e: hhmmToMin(t.end), idx: i }));

  const overlap = (a: E, b: E) => a.s < b.e && b.s < a.e;

  // componente conectado (graph coloring simples)
  const n = list.length;
  const adj: number[][] = Array.from({ length: n }, () => []);
  for (let i = 0; i < n; i++)
    for (let j = i + 1; j < n; j++)
      if (overlap(list[i], list[j])) { adj[i].push(j); adj[j].push(i); }

  const comp: number[] = Array(n).fill(-1);
  let comps = 0;
  for (let i = 0; i < n; i++) if (comp[i] === -1) {
    const q = [i]; comp[i] = comps;
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj[u]) if (comp[v] === -1) { comp[v] = comps; q.push(v); }
    }
    comps++;
  }

  const laneInfo: Record<number, { lane: number; total: number }> = {};
  for (let c = 0; c < comps; c++) {
    const nodes = list.filter((_, i) => comp[i] === c).sort((a, b) => a.s - b.s || a.e - b.e);
    const laneEnd: number[] = [];
    for (const t of nodes) {
      let pos = -1;
      for (let k = 0; k < laneEnd.length; k++) if (laneEnd[k] <= t.s) { pos = k; break; }
      if (pos === -1) { laneEnd.push(t.e); pos = laneEnd.length - 1; }
      else laneEnd[pos] = t.e;
      laneInfo[t.idx] = { lane: pos, total: laneEnd.length };
    }
  }

  return (
    <div className="absolute inset-0">
      {list.map((t) => {
        const top = pctFromHHMM(t.start, timeline);
        const bottom = pctFromHHMM(t.end, timeline);
        const height = Math.max(1, bottom - top);
        const li = laneInfo[t.idx] ?? { lane: 0, total: 1 };

        const left = `calc(${(li.lane / li.total) * 100}% + ${li.lane * gap}px)`;
        const width = `calc(${100 / li.total}% - ${((li.total - 1) / li.total) * gap}px)`;

        const state =
          t.done ? { bg: "bg-emerald-500", label: "Concluída" } :
          (new Date().setHours(...t.end.split(":").map(Number) as any) <= Date.now()
            ? { bg: "bg-red-500", label: "Atrasada" }
            : { bg: "bg-sky-500", label: "No prazo" });

        return (
          <div
            key={t.id}
            className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
            style={{ top: `${top}%`, height: `${height}%`, left, width }}
            onClick={() => onClick(t)}
            title={`${t.title} — ${t.start}–${t.end}`}
          >
            <div className={`w-full h-full ${state.bg} flex items-center justify-between px-3`}>
              <div className="flex items-center gap-2">
                <Pill className="bg-black/20">{state.label}</Pill>
                <span className="font-medium text-sm md:text-base line-clamp-1">{t.operation} — {t.title}</span>
              </div>
              <div className="flex items-center gap-2 text-xs md:text-sm opacity-90">
                <span className="px-2 py-0.5 rounded-full bg-black/25">{t.assignee}</span>
                <span>{t.start} – {t.end}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* =========================
   Modais (novo / editar)
========================= */

type BaseForm = {
  title: string;
  assignee: string;
  operation: string;
  start: string;
  end: string;
  rec: Recurrence;
};

const ASSIGNEES = [...RESPONSAVEIS];

function NewTaskModal({
  workspace, ymd, ops, setOps, onClose,
}: {
  workspace: string;
  ymd: string;
  ops: string[];
  setOps: (v: string[]) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<BaseForm>({
    title: "",
    assignee: ASSIGNEES[0],
    operation: ops[0] ?? "FMU",
    start: "08:00",
    end: "09:00",
    rec: { kind: "once", date: ymd },
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BaseForm>(k: K, v: BaseForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleOperationChange(v: string) {
    if (v === "__add__") {
      const name = prompt("Nome da operação:");
      if (!name) return;
      const list = await addOperation(workspace, name.trim());
      setOps(list);
      setForm((f) => ({ ...f, operation: name.trim() }));
    } else {
      setForm((f) => ({ ...f, operation: v }));
    }
  }

  async function save() {
    if (!form.title.trim()) { alert("Informe o nome da demanda."); return; }
    if (hhmmToMin(form.end) <= hhmmToMin(form.start)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }
    setSaving(true);
    try {
      // criamos uma série
      const seriesId = crypto.randomUUID();
      const batch = writeBatch(db);

      // gera ocorrências por 60 dias
      const DAYS_AHEAD = 60;
      const shouldInclude = (date: string) => {
        if (form.rec.kind === "once") return date === (form.rec as any).date;
        if (form.rec.kind === "daily") return true;
        if (form.rec.kind === "weekly") return weekday(date) === form.rec.weekday;
        return false;
      };

      for (let d = 0; d <= DAYS_AHEAD; d++) {
        const day = addDays(ymd, d);
        if (!shouldInclude(day)) continue;
        const ref = doc(tasksCollection(workspace, day));
        batch.set(ref, {
          title: form.title.trim(),
          assignee: form.assignee,
          operation: form.operation,
          start: form.start,
          end: form.end,
          done: false,
          rec: form.rec,
          seriesId,
          workspace,
          ymd: day,
          createdAt: new Date(),
        });
      }
      await batch.commit();
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold mb-3">Nova demanda</h3>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Nome da demanda</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2" placeholder="Ex.: Enviar funil diário"/>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Responsável</span>
          <select value={form.assignee} onChange={(e) => set("assignee", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2">
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Operação</span>
          <select value={form.operation} onChange={(e) => handleOperationChange(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2">
            {ops.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__add__">+ Adicionar nova operação…</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Recorrência</span>
          <select
            value={JSON.stringify(form.rec)}
            onChange={(e) => set("rec", JSON.parse(e.target.value))}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
          >
            <option value={JSON.stringify({ kind: "once", date: ymd })}>
              Apenas este dia ({ymd})
            </option>
            <option value={JSON.stringify({ kind: "daily" })}>Todos os dias</option>
            {/* segunda como padrão */}
            <option value={JSON.stringify({ kind: "weekly", weekday: 1 })}>Semanal — Segunda</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 2 })}>Semanal — Terça</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 3 })}>Semanal — Quarta</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 4 })}>Semanal — Quinta</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 5 })}>Semanal — Sexta</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 6 })}>Semanal — Sábado</option>
            <option value={JSON.stringify({ kind: "weekly", weekday: 0 })}>Semanal — Domingo</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora início</span>
          <input type="time" value={form.start} onChange={(e) => set("start", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"/>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora fim</span>
          <input type="time" value={form.end} onChange={(e) => set("end", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"/>
        </label>
      </div>

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">Cancelar</button>
        <button onClick={save} disabled={saving}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium disabled:opacity-60">
          {saving ? "Salvando…" : "Salvar"}
        </button>
      </div>
    </Modal>
  );
}

function EditTaskModal({
  task, ops, setOps, onClose, onToggleDone, onDeleteOne, onDeleteSeries,
}: {
  task: Task;
  ops: string[];
  setOps: (v: string[]) => void;
  onClose: () => void;
  onToggleDone: (v: boolean) => void;
  onDeleteOne: () => void;
  onDeleteSeries: () => void;
}) {
  const [form, setForm] = useState<BaseForm>({
    title: task.title,
    assignee: task.assignee,
    operation: task.operation,
    start: task.start,
    end: task.end,
    rec: task.rec,
  });
  const [saving, setSaving] = useState(false);

  function set<K extends keyof BaseForm>(k: K, v: BaseForm[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleOperationChange(v: string) {
    if (v === "__add__") {
      const name = prompt("Nome da operação:");
      if (!name) return;
      const list = await addOperation(task.workspace, name.trim());
      setOps(list);
      setForm((f) => ({ ...f, operation: name.trim() }));
    } else {
      setForm((f) => ({ ...f, operation: v }));
    }
  }

  async function saveThis() {
    if (!form.title.trim()) { alert("Informe o nome da demanda."); return; }
    if (hhmmToMin(form.end) <= hhmmToMin(form.start)) { alert("Hora fim deve ser maior que hora início."); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, task._path), {
        title: form.title.trim(),
        assignee: form.assignee,
        operation: form.operation,
        start: form.start,
        end: form.end,
      });
      onClose();
    } catch (e) {
      console.error(e);
      alert("Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-semibold mb-3">Editar demanda</h3>

      <div className="grid md:grid-cols-2 gap-3">
        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Nome da demanda</span>
          <input value={form.title} onChange={(e) => set("title", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"/>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Responsável</span>
          <select value={form.assignee} onChange={(e) => set("assignee", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2">
            {ASSIGNEES.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Operação</span>
          <select value={form.operation} onChange={(e) => handleOperationChange(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2">
            {ops.map((o) => <option key={o} value={o}>{o}</option>)}
            <option value="__add__">+ Adicionar nova operação…</option>
          </select>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Recorrência (apenas informativa para esta ocorrência)</span>
          <input disabled value={
            form.rec.kind === "once" ? `apenas ${task.ymd}` :
            form.rec.kind === "daily" ? "todos os dias" :
            `semanal — ${["Dom","Seg","Ter","Qua","Qui","Sex","Sáb"][form.rec.weekday]}`
          } className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2 opacity-70"/>
        </label>

        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora início</span>
          <input type="time" value={form.start} onChange={(e) => set("start", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"/>
        </label>
        <label className="text-sm">
          <span className="block mb-1 text-neutral-300">Hora fim</span>
          <input type="time" value={form.end} onChange={(e) => set("end", e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"/>
        </label>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-2 mt-4">
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={task.done} onChange={(e) => onToggleDone(e.target.checked)} />
            Concluída
          </label>
        </div>

        <div className="flex gap-2">
          <button onClick={onDeleteOne} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">Excluir esta</button>
          {task.rec.kind !== "once" && (
            <button onClick={onDeleteSeries} className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600">
              Excluir todos os dias
            </button>
          )}
          <button onClick={saveThis} disabled={saving}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium disabled:opacity-60">
            {saving ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/* =========================
   Modal genérico
========================= */

function Modal({ children, onClose }: React.PropsWithChildren<{ onClose: () => void }>) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-2xl shadow-xl">
        <button className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-200" onClick={onClose} aria-label="Fechar">✕</button>
        {children}
      </div>
    </div>
  );
}
