import React, { useEffect, useMemo, useState } from "react";
import {
  addDoc,
  onSnapshot,
  updateDoc,
  deleteDoc,
  doc,
  writeBatch,
  getDocs,
  query,
  orderBy,
} from "firebase/firestore";
import { db, tasksCollection } from "./lib/firebase";

/* ===========================================================
   CONFIG
   =========================================================== */

const DAY_START = "08:00";
const DAY_END = "20:00";
const REC_WINDOW_DAYS = 60; // janela para gerar recorrência

// Responsáveis fixos
export const RESPONSAVEIS = [
  "Bárbara Arruda",
  "Gabriel Bion",
  "Luciano Miranda",
  "João Vinicius",
  "Lucas Siqueira",
] as const;
export type Responsavel = typeof RESPONSAVEIS[number];

/* ===========================================================
   TIPOS
   =========================================================== */

type Recurrence =
  | { kind: "once"; date: string }            // apenas este dia
  | { kind: "daily" }                          // todos os dias
  | { kind: "weekly"; weekday: number };       // 0-dom ... 6-sáb

type Task = {
  id: string;
  titulo: string;
  inicio: string;
  fim: string;
  concluida: boolean;
  responsavel: Responsavel;
};

/* ===========================================================
   HELPERS DE DATA / TIMELINE
   =========================================================== */

function hhmmToMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}
function fmtTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
function dateFromYMD(ymd: string, h = 0, m = 0, s = 0): Date {
  const [Y, M, D] = ymd.split("-").map(Number);
  return new Date(Y, (M || 1) - 1, D || 1, h, m, s, 0);
}
function ymdFromDate(d: Date) {
  return d.toISOString().slice(0, 10);
}
function buildTimeline(start: string, end: string) {
  const startMin = hhmmToMin(start);
  const endMin = hhmmToMin(end);
  return { startMin, endMin, totalMin: Math.max(1, endMin - startMin) };
}
function percentFromTime(hhmm: string, tl: ReturnType<typeof buildTimeline>) {
  const pos = hhmmToMin(hhmm) - tl.startMin;
  return clamp((pos / tl.totalMin) * 100, 0, 100);
}
function percentFromDate(d: Date, tl: ReturnType<typeof buildTimeline>) {
  const mins = d.getHours() * 60 + d.getMinutes();
  const pos = mins - tl.startMin;
  return clamp((pos / tl.totalMin) * 100, 0, 100);
}
function getRefNow(selectedYmd: string, realNow: Date): Date {
  const todayYmd = ymdFromDate(new Date());
  if (selectedYmd === todayYmd) {
    return dateFromYMD(selectedYmd, realNow.getHours(), realNow.getMinutes(), realNow.getSeconds());
  }
  const isPast = dateFromYMD(selectedYmd).getTime() < dateFromYMD(todayYmd).getTime();
  return isPast ? dateFromYMD(selectedYmd, 23, 59, 0) : dateFromYMD(selectedYmd, 0, 0, 0);
}

/* ===========================================================
   COMPONENTES VISUAIS
   =========================================================== */

function NowLineHorizontal({ now, timeline }: { now: Date; timeline: ReturnType<typeof buildTimeline> }) {
  const top = percentFromDate(now, timeline);
  const stamp = now.toLocaleString([], { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
  return (
    <div className="absolute left-0 right-0 h-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]" style={{ top: `${top}%` }}>
      <span className="absolute -top-3 left-2 text-[10px] bg-red-500 text-white px-1.5 py-0.5 rounded font-semibold shadow">
        {stamp}
      </span>
    </div>
  );
}

function HourScaleVertical({ timeline }: { timeline: ReturnType<typeof buildTimeline> }) {
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
            <div className={`absolute -left-2 top-1/2 -translate-y-1/2 h-px ${t.endsWith(":00") ? "w-8 bg-neutral-600" : "w-6 bg-neutral-700"}`} />
            <span>{t}</span>
            <div className={`absolute left-full ml-2 top-1/2 -translate-y-1/2 w-full h-px ${t.endsWith(":00") ? "bg-neutral-700" : "bg-neutral-800/50"}`} />
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskStackVertical({
  tasks,
  timeline,
  nowRef,
  onClickTask,
}: {
  tasks: Task[];
  timeline: ReturnType<typeof buildTimeline>;
  nowRef: Date;
  onClickTask: (t: Task) => void;
}) {
  const gap = 10;

  type Enriched = Task & { startMin: number; endMin: number; idx: number };
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
    const q = [i];
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

  const nowMin = nowRef.getHours() * 60 + nowRef.getMinutes();

  return (
    <div className="absolute inset-0">
      {enriched.map((t) => {
        const top = percentFromTime(t.inicio, timeline);
        const bottom = percentFromTime(t.fim, timeline);
        const height = Math.max(1, bottom - top);

        let bg = "bg-sky-500 text-neutral-900";
        let badge = "No prazo";
        if (t.concluida) {
          bg = "bg-emerald-500";
          badge = "Concluída";
        } else if (nowMin >= t.endMin) {
          bg = "bg-red-500";
          badge = "Atrasada";
        }

        const info = laneInfo[t.idx] ?? { lane: 0, lanesInComp: 1 };
        const left = `calc(${(info.lane / info.lanesInComp) * 100}% + ${info.lane * gap}px)`;
        const width = `calc(${100 / info.lanesInComp}% - ${((info.lanesInComp - 1) / info.lanesInComp) * gap}px)`;

        return (
          <div
            key={t.id}
            className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
            style={{ top: `${top}%`, height: `${height}%`, left, width }}
            onClick={() => onClickTask(t)}
            title={`${t.titulo} — ${t.inicio}–${t.fim}`}
          >
            <div className={`w-full h-full ${bg} flex items-center justify-between px-3`}>
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">{badge}</span>
                <span className="font-medium text-sm md:text-base line-clamp-2">{t.titulo}</span>
                <span className="ml-2 text-[11px] md:text-xs bg-neutral-800/60 px-2 py-0.5 rounded-full">
                  {t.responsavel}
                </span>
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

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-md shadow-xl">
        <button className="absolute right-3 top-3 text-neutral-400 hover:text-neutral-200" onClick={onClose} aria-label="Fechar">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent: "emerald"|"red"|"sky"|"slate" }) {
  const bar = {
    emerald: "bg-emerald-500",
    red: "bg-red-500",
    sky: "bg-sky-500",
    slate: "bg-slate-400",
  }[accent];
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

/* ===========================================================
   MODAL: NOVA DEMANDA
   =========================================================== */

function NewTaskModal({
  selectedDate,
  onClose,
  onSaveMany,
}: {
  selectedDate: string;
  onClose: () => void;
  onSaveMany: (dates: string[], base: Omit<Task, "id">) => void;
}) {
  const [titulo, setTitulo] = useState("");
  const [inicio, setInicio] = useState(DAY_START);
  const [fim, setFim] = useState("09:00");
  const [kind, setKind] = useState<"once" | "daily" | "weekly">("once");
  const [weekday, setWeekday] = useState<number>(dateFromYMD(selectedDate).getDay());
  const [responsavel, setResponsavel] = useState<Responsavel>(RESPONSAVEIS[0]);

  function generateDates(): string[] {
    if (kind === "once") return [selectedDate];

    const start = dateFromYMD(selectedDate);
    const out: string[] = [];
    for (let i = 0; i < REC_WINDOW_DAYS; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      if (kind === "daily") {
        out.push(ymdFromDate(d));
      } else {
        if (d.getDay() === weekday) out.push(ymdFromDate(d));
      }
    }
    return out;
  }

  function handleSave() {
    if (hhmmToMin(fim) <= hhmmToMin(inicio)) {
      alert("Hora fim deve ser maior que a hora início.");
      return;
    }
    const base: Omit<Task, "id"> = {
      titulo: titulo.trim() || "Nova demanda",
      inicio,
      fim,
      concluida: false,
      responsavel,
    };
    onSaveMany(generateDates(), base);
  }

  const weekLabels = ["Domingo","Segunda","Terça","Quarta","Quinta","Sexta","Sábado"];

  return (
    <Modal onClose={onClose}>
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Nova demanda</h3>

        <label className="text-sm block">
          <span className="block mb-1 text-neutral-300">Nome da demanda</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            placeholder="Ex.: Enviar funil diário"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">
            <span className="block mb-1 text-neutral-300">Recorrência</span>
            <select
              value={kind}
              onChange={(e) => setKind(e.target.value as any)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              <option value="once">Apenas este dia ({selectedDate})</option>
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
                {weekLabels.map((w, i) => (
                  <option key={i} value={i}>{w}</option>
                ))}
              </select>
            </label>
          )}

          <label className="text-sm">
            <span className="block mb-1 text-neutral-300">Responsável</span>
            <select
              value={responsavel}
              onChange={(e) => setResponsavel(e.target.value as Responsavel)}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              {RESPONSAVEIS.map((r) => (
                <option key={r} value={r}>{r}</option>
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

        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">Cancelar</button>
          <button onClick={handleSave} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">Salvar</button>
        </div>
      </div>
    </Modal>
  );
}

/* ===========================================================
   APP
   =========================================================== */

export default function App() {
  const [now, setNow] = useState(new Date());
  const [selected, setSelected] = useState<Task | null>(null);
  const [showNew, setShowNew] = useState(false);

  // workspaceId pela URL (?ws=...)
  const ws = useMemo(() => {
    const url = new URL(window.location.href);
    return url.searchParams.get("ws") || "demo";
  }, []);

  // data selecionada
  const [selectedDate, setSelectedDate] = useState<string>(() => ymdFromDate(new Date()));

  // listener do "agora"
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 10000);
    return () => clearInterval(t);
  }, []);

  // subscribe tarefas do dia
  const [tasks, setTasks] = useState<Task[]>([]);
  useEffect(() => {
    const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio", "asc"));
    return onSnapshot(qy, (snap) => {
      const arr: Task[] = snap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          titulo: data.titulo,
          inicio: data.inicio,
          fim: data.fim,
          concluida: !!data.concluida,
          responsavel: (data.responsavel ?? "João Vinicius") as Responsavel, // fallback
        };
      });
      setTasks(arr);
    });
  }, [ws, selectedDate]);

  // timeline e "agora" na referência da data selecionada
  const timeline = useMemo(() => buildTimeline(DAY_START, DAY_END), []);
  const refNow = useMemo(() => getRefNow(selectedDate, now), [selectedDate, now]);

  // stats principais
  const stats = useMemo(() => {
    const nowMin = refNow.getHours() * 60 + refNow.getMinutes();
    let concluida = 0, atrasada = 0, noPrazo = 0;
    for (const t of tasks) {
      if (t.concluida) concluida++;
      else if (hhmmToMin(t.fim) <= nowMin) atrasada++;
      else noPrazo++;
    }
    return { total: tasks.length, concluida, atrasada, noPrazo };
  }, [tasks, refNow]);

  // volumetria por responsável
  const porResponsavel = useMemo(() => {
    const acc = Object.fromEntries(RESPONSAVEIS.map(r => [r, 0])) as Record<Responsavel, number>;
    for (const t of tasks) {
      acc[t.responsavel] = (acc[t.responsavel] ?? 0) + 1;
    }
    return acc;
  }, [tasks]);

  // navegar dias
  function shiftDate(days: number) {
    const d = dateFromYMD(selectedDate);
    d.setDate(d.getDate() + days);
    setSelectedDate(ymdFromDate(d));
  }

  // apagar tudo do dia
  async function handleClearAll() {
    if (!confirm("Tem certeza que deseja apagar TODAS as demandas do dia?")) return;
    const snap = await getDocs(tasksCollection(ws, selectedDate));
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  // salvar (várias datas, para recorrência)
  async function saveMany(dates: string[], base: Omit<Task, "id">) {
    // validação simples (se quiser, trate overlaps etc.)
    const batch = writeBatch(db);
    for (const ymd of dates) {
      const col = tasksCollection(ws, ymd);
      const newRef = doc(col); // id auto
      batch.set(newRef, {
        ...base,
        concluida: !!base.concluida,
        responsavel: base.responsavel,
      });
    }
    await batch.commit();
    setShowNew(false);
  }

  // concluir / excluir seleção
  async function handleConfirmConcluir(concluir: boolean) {
    if (!selected) return;
    const ref = doc(tasksCollection(ws, selectedDate), selected.id);
    await updateDoc(ref, { concluida: concluir });
    setSelected(null);
  }
  async function handleDeleteSelected() {
    if (!selected) return;
    const ref = doc(tasksCollection(ws, selectedDate), selected.id);
    await deleteDoc(ref);
    setSelected(null);
  }

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl md:text-3xl font-semibold mb-2">Esteira de Demandas</h1>

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-4">
          <p className="text-sm md:text-base text-neutral-300">
            Janela do dia: <strong>{DAY_START}</strong>–<strong>{DAY_END}</strong>. Agora: {fmtTime(refNow)} | Workspace:{" "}
            <span className="px-2 py-0.5 rounded bg-neutral-800">{ws}</span>
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
              🗑 Limpar tudo
            </button>
          </div>
        </div>

        {/* Cards principais */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <StatCard label="Demandas no dia" value={stats.total} accent="slate" />
          <StatCard label="Concluídas" value={stats.concluida} accent="emerald" />
          <StatCard label="Atrasadas" value={stats.atrasada} accent="red" />
          <StatCard label="No prazo" value={stats.noPrazo} accent="sky" />
        </div>

        {/* Volumetria por responsável */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
          {RESPONSAVEIS.map((r) => (
            <StatCard key={r} label={r} value={porResponsavel[r] ?? 0} accent="slate" />
          ))}
        </div>

        {/* Timeline */}
        <div className="relative bg-neutral-900 rounded-2xl p-4 shadow-xl grid grid-cols-[80px_1fr] gap-4">
          <HourScaleVertical timeline={timeline} />
          <div className="relative h-[560px] md:h-[720px]">
            <NowLineHorizontal now={refNow} timeline={timeline} />
            <TaskStackVertical tasks={tasks} timeline={timeline} nowRef={refNow} onClickTask={(t) => setSelected(t)} />
          </div>
        </div>
      </div>

      {showNew && (
        <NewTaskModal
          selectedDate={selectedDate}
          onClose={() => setShowNew(false)}
          onSaveMany={saveMany}
        />
      )}

      {selected && (
        <Modal onClose={() => setSelected(null)}>
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Concluir / Excluir demanda</h3>
            <p className="text-sm text-neutral-300">
              <strong>{selected.titulo}</strong> — {selected.responsavel}
              <br />
              Período: {selected.inicio}–{selected.fim}
            </p>
            <div className="flex items-center gap-2 text-xs text-neutral-400">
              <span className="inline-block w-3 h-3 rounded bg-emerald-500" /> <span>Concluída (verde)</span>
              <span className="inline-block w-3 h-3 rounded bg-sky-500 ml-3" /> <span>No prazo (azul)</span>
              <span className="inline-block w-3 h-3 rounded bg-red-500 ml-3" /> <span>Atrasada (vermelho)</span>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button onClick={handleDeleteSelected} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">Excluir</button>
              <button onClick={() => handleConfirmConcluir(false)} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
                Manter não concluída
              </button>
              <button onClick={() => handleConfirmConcluir(true)} className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium">
                Marcar como concluída
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
