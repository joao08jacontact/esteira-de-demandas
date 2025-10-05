import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  writeBatch,
} from "firebase/firestore";
import { db, tasksCollection, templatesCollection } from "./lib/firebase";
import useWorkspaceParam from "./hooks/useWorkspaceParam";

/* ================================
   Tipos
   ================================ */
type Recurrence =
  | { kind: "daily" }
  | { kind: "weekly"; weekday: number }; // 0=Dom, 1=Seg, ...

type BaseTask = {
  titulo: string;
  inicio: string; // "HH:MM"
  fim: string;    // "HH:MM"
  concluida: boolean;
};

type DayTask = BaseTask & { id: string }; // tarefa salva no dia
type TemplateTask = BaseTask & { id: string; rec: Recurrence }; // modelo recorrente

type VisibleTask = (DayTask | (Omit<TemplateTask, "rec"> & { id: string })) & {
  source: "day" | "template";
  rec?: Recurrence;
};

type Timeline = { startMin: number; endMin: number; totalMin: number };

/* ================================
   Helpers de data/hora
   ================================ */
function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}
function buildTimeline(start: string, end: string): Timeline {
  const s = hhmmToMin(start);
  const e = hhmmToMin(end);
  return { startMin: s, endMin: e, totalMin: Math.max(1, e - s) };
}
function percentFromTime(hhmm: string, tl: Timeline) {
  const pos = hhmmToMin(hhmm) - tl.startMin;
  return clamp((pos / tl.totalMin) * 100, 0, 100);
}
function percentFromDate(d: Date, tl: Timeline) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const pos = mins - tl.startMin;
  return clamp((pos / tl.totalMin) * 100, 0, 100);
}
function dateFromYMD(ymd: string, h = 0, m = 0, s = 0): Date {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h, m, s, 0);
}
function fmtTime(d: Date) {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function fmtDateTime(d: Date) {
  return d.toLocaleString([], {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
function getRefNow(selectedYmd: string, realNow: Date): Date {
  const todayYmd = new Date().toISOString().slice(0, 10);
  if (selectedYmd === todayYmd) {
    return dateFromYMD(selectedYmd, realNow.getHours(), realNow.getMinutes(), realNow.getSeconds());
  }
  const isPast = dateFromYMD(selectedYmd).getTime() < dateFromYMD(todayYmd).getTime();
  return isPast ? dateFromYMD(selectedYmd, 23, 59, 0) : dateFromYMD(selectedYmd, 0, 0, 0);
}
function applyRecurrence(all: TemplateTask[], ymd: string): TemplateTask[] {
  const weekday = dateFromYMD(ymd).getDay();
  return all.filter((t) => {
    if (t.rec.kind === "daily") return true;
    if (t.rec.kind === "weekly") return t.rec.weekday === weekday;
    return false;
  });
}

/* ================================
   UI menores
   ================================ */
function NowLineHorizontal({ now, timeline }: { now: Date; timeline: Timeline }) {
  const top = percentFromDate(now, timeline);
  const stamp = fmtDateTime(now);
  return (
    <div
      className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]"
      style={{ top: `${top}%` }}
    >
      <span className="absolute -top-3 left-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold shadow">
        {stamp}
      </span>
    </div>
  );
}

function HourScaleVertical({ timeline }: { timeline: Timeline }) {
  const ticks: string[] = [];
  for (let m = timeline.startMin; m <= timeline.endMin; m += 30) {
    const h = Math.floor(m / 60).toString().padStart(2, "0");
    const min = (m % 60).toString().padStart(2, "0");
    ticks.push(`${h}:${min}`);
  }
  return (
    <div className="relative select-none">
      <div className="absolute left-1/2 -translate-x-1/2 top-0 bottom-0 w-px bg-neutral-800" />
      <div className="h-[560px] md:h-[720px] flex flex-col justify-between text-xs text-neutral-400 pr-2">
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

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-md shadow-xl">
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

/* ================================
   Modal Nova Demanda (com recorrência)
   ================================ */
function NewTaskModal({
  selectedYmd,
  workspaceId,
  onClose,
}: {
  selectedYmd: string;
  workspaceId: string;
  onClose: () => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState("08:00");
  const [fim, setFim] = useState("09:00");

  const [kind, setKind] = useState<"once" | "daily" | "weekly">("once");
  const [weekday, setWeekday] = useState<number>(1);

  async function handleSave() {
    if (hhmmToMin(fim) <= hhmmToMin(inicio)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }
    const base: BaseTask = {
      titulo: (titulo || "Nova demanda").trim(),
      inicio,
      fim,
      concluida: false,
    };

    if (kind === "once") {
      await addDoc(tasksCollection(workspaceId, selectedYmd), base);
    } else {
      const rec: Recurrence =
        kind === "daily" ? { kind: "daily" } : { kind: "weekly", weekday };
      await addDoc(templatesCollection(workspaceId), { ...base, rec });
    }
    onClose();
  }

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Nova demanda</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm md:col-span-2">
            <span className="block mb-1 text-neutral-300">Nome da demanda</span>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
              placeholder="Ex.: Enviar funil diário"
            />
          </label>

          <label className="text-sm">
            <span className="block mb-1 text-neutral-300">Recorrência</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="once">Apenas este dia ({selectedYmd})</option>
              <option value="daily">Todos os dias</option>
              <option value="weekly">Uma vez por semana</option>
            </select>
          </label>

          {kind === "weekly" && (
            <label className="text-sm">
              <span className="block mb-1 text-neutral-300">Dia da semana</span>
              <select
                value={weekday}
                onChange={(e) => setWeekday(parseInt(e.target.value))}
                className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
              >
                <option value={0}>Domingo</option>
                <option value={1}>Segunda</option>
                <option value={2}>Terça</option>
                <option value={3}>Quarta</option>
                <option value={4}>Quinta</option>
                <option value={5}>Sexta</option>
                <option value={6}>Sábado</option>
              </select>
            </label>
          )}

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

        <div className="flex justify-end gap-2">
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
    </Modal>
  );
}

/* ================================
   Pilha de cartões
   ================================ */
function TaskStackVertical({
  tasks,
  timeline,
  nowRef,
  onClickTask,
}: {
  tasks: VisibleTask[];
  timeline: Timeline;
  nowRef: Date;
  onClickTask: (t: VisibleTask) => void;
}) {
  const gap = 10;

  type Enriched = VisibleTask & { startMin: number; endMin: number; idx: number };
  const enriched: Enriched[] = tasks.map((t, idx) => ({
    ...t,
    startMin: hhmmToMin(t.inicio),
    endMin: hhmmToMin(t.fim),
    idx,
  }));

  const overlap = (a: Enriched, b: Enriched) => a.startMin < b.endMin && b.startMin < a.endMin;

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
    const q: number[] = [i];
    compId[i] = compCount;
    while (q.length) {
      const u = q.shift()!;
      for (const v of adj[u]) if (compId[v] === -1) { compId[v] = compCount; q.push(v); }
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
      let placed = -1;
      for (let li = 0; li < lanesEnd.length; li++) {
        if (lanesEnd[li] <= t.startMin) { placed = li; break; }
      }
      if (placed === -1) {
        lanesEnd.push(t.endMin);
        placed = lanesEnd.length - 1;
      } else {
        lanesEnd[placed] = t.endMin;
      }
      laneInfo[t.idx] = { lane: placed, lanesInComp: lanesEnd.length };
    }
  }

  const nowMin = nowRef.getHours() * 60 + nowRef.getMinutes();

  return (
    <div className="absolute inset-0">
      {enriched.map((t) => {
        const top = percentFromTime(t.inicio, timeline);
        const bottom = percentFromTime(t.fim, timeline);
        const height = Math.max(1, bottom - top);

        let bg = "bg-sky-500 text-neutral-900";
        let badge = t.source === "template" ? "RECORRENTE" : "No prazo";
        if (t.source === "day") {
          if (t.concluida) { bg = "bg-emerald-500"; badge = "Concluída"; }
          else if (nowMin >= hhmmToMin(t.fim)) { bg = "bg-red-500"; badge = "Atrasada"; }
        }

        const info = laneInfo[t.idx] ?? { lane: 0, lanesInComp: 1 };
        const left = `calc(${(info.lane / info.lanesInComp) * 100}% + ${info.lane * gap}px)`;
        const width = `calc(${100 / info.lanesInComp}% - ${((info.lanesInComp - 1) / info.lanesInComp) * gap}px)`;

        return (
          <div
            key={`${t.source}:${t.id}`}
            className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
            style={{ top: `${top}%`, height: `${height}%`, left, width }}
            onClick={() => onClickTask(t)}
            title={`${t.titulo} — ${t.inicio}–${t.fim}`}
          >
            <div className={`w-full h-full ${bg} flex items-center justify-between px-3`}>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">{badge}</span>
                <span className="font-medium text-sm md:text-base line-clamp-2">{t.titulo}</span>
              </div>
              <div className="text-xs md:text-sm opacity-80">
                {t.inicio} – {t.fim}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ================================
   APP
   ================================ */
export default function App() {
  const workspaceId = useWorkspaceParam();

  const [now, setNow] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>(() => new Date().toISOString().slice(0, 10));

  // coleções reais
  const [dayTasks, setDayTasks] = useState<DayTask[]>([]);
  const [templates, setTemplates] = useState<TemplateTask[]>([]);

  // seleção para modal de ação
  const [selected, setSelected] = useState<VisibleTask | null>(null);
  const [showNew, setShowNew] = useState(false);

  // tick do relógio
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // subscribe tarefas do dia
  useEffect(() => {
    if (!workspaceId) return;
    const qy = query(tasksCollection(workspaceId, selectedDate), orderBy("inicio"));
    return onSnapshot(qy, (snap) => {
      const list: DayTask[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as BaseTask) }));
      setDayTasks(list);
    });
  }, [workspaceId, selectedDate]);

  // subscribe templates recorrentes
  useEffect(() => {
    if (!workspaceId) return;
    const col = templatesCollection(workspaceId);
    return onSnapshot(col, (snap) => {
      const list: TemplateTask[] = snap.docs.map((d) => ({ id: d.id, ...(d.data() as TemplateTask) }));
      setTemplates(list);
    });
  }, [workspaceId]);

  // timeline e "agora"
  const dayStart = "08:00";
  const dayEnd = "20:00";
  const timeline = useMemo(() => buildTimeline(dayStart, dayEnd), []);
  const refNow = useMemo(() => getRefNow(selectedDate, now), [selectedDate, now]);

  // junta: tarefas do dia + modelos recorrentes válidos para a data
  const visibleTasks: VisibleTask[] = useMemo(() => {
    const rec = applyRecurrence(templates, selectedDate).map<VisibleTask>((t) => ({
      id: t.id,
      titulo: t.titulo,
      inicio: t.inicio,
      fim: t.fim,
      concluida: false,
      rec: t.rec,
      source: "template",
    }));
    const day = dayTasks.map<VisibleTask>((t) => ({ ...t, source: "day" as const }));
    return [...rec, ...day].sort((a, b) => hhmmToMin(a.inicio) - hhmmToMin(b.inicio));
  }, [templates, dayTasks, selectedDate]);

  // cards de estatística (contam o que está visível)
  const stats = useMemo(() => {
    const nowMin = refNow.getHours() * 60 + refNow.getMinutes();
    let concl = 0, atraso = 0, prazo = 0;
    for (const t of visibleTasks) {
      if (t.source === "template") { prazo++; continue; }
      if (t.concluida) concl++;
      else if (hhmmToMin(t.fim) <= nowMin) atraso++;
      else prazo++;
    }
    return { total: visibleTasks.length, concluida: concl, atrasada: atraso, noPrazo: prazo };
  }, [visibleTasks, refNow]);

  // apaga a seleção
  async function handleDeleteSelected() {
    if (!selected) return;
    if (selected.source === "template") {
      await deleteDoc(doc(templatesCollection(workspaceId), selected.id));
    } else {
      await deleteDoc(doc(tasksCollection(workspaceId, selectedDate), selected.id));
    }
    setSelected(null);
  }

  // limpar TODAS as tarefas do DIA (não mexe nos modelos recorrentes)
  async function handleClearAll() {
    if (!confirm(`Apagar TODAS as tarefas de ${selectedDate}? (recorrentes continuam)`)) return;
    const qy = query(tasksCollection(workspaceId, selectedDate));
    const unsub = onSnapshot(qy, async (snap) => {
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      unsub(); // dispara uma vez só
    });
  }

  function shiftDate(days: number) {
    const d = dateFromYMD(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(d.toISOString().slice(0, 10));
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Esteira de Demandas</h1>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <p className="text-sm md:text-base text-neutral-300">
            Janela do dia: <strong>{dayStart}</strong>–<strong>{dayEnd}</strong>.
            Agora: {fmtTime(refNow)} | Workspace: <code>{workspaceId}</code>
          </p>
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">◀︎</button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5 text-sm"
            />
            <button onClick={() => shiftDate(1)} className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 text-sm">▶︎</button>
            <button onClick={() => setShowNew(true)} className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium">
              + Nova demanda
            </button>
            <button onClick={handleClearAll} className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-sm font-medium">
              🗑 Limpar tudo (dia)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Demandas no dia" value={stats.total} accent="slate" />
          <StatCard label="Concluídas" value={stats.concluida} accent="emerald" />
          <StatCard label="Atrasadas" value={stats.atrasada} accent="red" />
          <StatCard label="No prazo" value={stats.noPrazo} accent="sky" />
        </div>

        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[80px_1fr] gap-4">
          <HourScaleVertical timeline={timeline} />
          <div className="relative h-[560px] md:h-[720px]">
            <NowLineHorizontal now={refNow} timeline={timeline} />
            <TaskStackVertical
              tasks={visibleTasks}
              timeline={timeline}
              nowRef={refNow}
              onClickTask={(t) => setSelected(t)}
            />
          </div>
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          selectedYmd={selectedDate}
          workspaceId={workspaceId}
          onClose={() => setShowNew(false)}
        />
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Detalhes / Excluir</h3>
            <p className="text-sm text-neutral-300">
              {selected.titulo}
              <br />
              Período: {selected.inicio}–{selected.fim}
            </p>

            {selected.source === "template" ? (
              <p className="text-xs text-red-300">
                Esta é uma demanda <strong>recorrente</strong>. Excluir irá removê-la de <strong>todos os dias</strong>.
              </p>
            ) : (
              <div className="flex items-center gap-2 text-xs text-neutral-400">
                <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> <span>Concluída (verde)</span>
                <span className="inline-block w-3 h-3 rounded bg-sky-500 ml-3" /> <span>No prazo (azul)</span>
                <span className="inline-block w-3 h-3 rounded bg-red-500 ml-3" /> <span>Atrasada (vermelho)</span>
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <button
                onClick={handleDeleteSelected}
                className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500"
              >
                {selected.source === "template" ? "Excluir recorrente" : "Excluir"}
              </button>
              {/* Para manter simples, conclusão só para tarefas do DIA */}
              {/* (marcar recorrente como concluída exigiria exceções por data) */}
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
