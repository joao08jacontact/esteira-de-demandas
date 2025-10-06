"use client"

import type React from "react"
import { useEffect, useMemo, useState } from "react"
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
} from "firebase/firestore"
import { db, tasksCollection } from "../lib/firebase"

/* ===========================
   Tipos
=========================== */

type RecKind = "once" | "daily" | "weekly"

type Task = {
  id: string
  titulo: string
  inicio: string // HH:MM
  fim: string // HH:MM
  concluida: boolean
  responsavel: string
  operacao: string
  ymd: string // YYYY-MM-DD
  seriesId?: string
  recKind?: RecKind
  weekDay?: number // 0-6 (Sunday-Saturday)
  workspaceId: string
  createdAt: number
}

type Timeline = { startMin: number; endMin: number; totalMin: number }

/* ===========================
   Constantes (responsáveis e operações)
=========================== */

const RESPONSAVEIS = ["Bárbara Arruda", "Gabriel Bion", "Luciano Miranda"]

const OPERACOES = [
  "FMU",
  "INSPIRALI",
  "COGNA",
  "SINGULARIDADES",
  "PÓS COGNA",
  "UFEM",
  "TELECOM",
  "FGTS",
  "DIROMA",
  "ESTÁCIO",
]

const DAYS_OF_WEEK = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
]

/* ===========================
   Utils robustos
=========================== */

function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v)
}
function hhmmToMin(hhmm: string): number {
  if (!isHHMM(hhmm)) return 0
  const [h, m] = hhmm.split(":").map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
}
function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}
function buildTimeline(start: string, end: string): Timeline {
  const startMin = hhmmToMin(start)
  const endMin = hhmmToMin(end)
  return { startMin, endMin, totalMin: Math.max(1, endMin - startMin) }
}
function percentFromTime(hhmm: string, tl: Timeline): number {
  const pos = (isHHMM(hhmm) ? hhmmToMin(hhmm) : tl.startMin) - tl.startMin
  return clamp((pos / tl.totalMin) * 100, 0, 100)
}
function ymdToDate(ymd: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), d.getDate())
  }
  const [Y, M, D] = ymd.split("-").map(Number)
  return new Date(Y, (M || 1) - 1, D || 1)
}
function dateToYMD(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}

/* ===========================
   App
=========================== */

export default function App() {
  // workspace via ?ws=
  const [ws, setWs] = useState("demo")

  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      setWs(params.get("ws") || "demo")
    }
  }, [])

  const [selectedDate, setSelectedDate] = useState(() => dateToYMD(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])

  // filtros (lista suspensa no topo)
  const [filterResp, setFilterResp] = useState<string>("(todos)")
  const [filterOp, setFilterOp] = useState<string>("(todas)")

  // modais
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  // timeline base (mais "alto" = maiores espaços entre 30m)
  const dayStart = "08:00"
  const dayEnd = "20:00"
  const timeline = useMemo(() => buildTimeline(dayStart, dayEnd), [])

  const [currentTime, setCurrentTime] = useState(() => new Date().toTimeString().slice(0, 5))

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toTimeString().slice(0, 5))
    }, 60000) // Update every minute
    return () => clearInterval(interval)
  }, [])

  /* ===========================
     Carrega tarefas do dia
  =========================== */
  useEffect(() => {
    const loadTasks = async () => {
      // Load tasks for the selected date
      const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio"))

      return onSnapshot(qy, async (snap) => {
        const list: Task[] = []

        // Add tasks from the selected date
        snap.forEach((d) => {
          const data = d.data() as any
          const ini = data?.inicio
          const fim = data?.fim
          if (!isHHMM(ini) || !isHHMM(fim)) return

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
            weekDay: data?.weekDay,
            workspaceId: String(data?.workspaceId ?? ws),
            createdAt: Number(data?.createdAt ?? Date.now()),
          })
        })

        // Load recurring tasks (daily and weekly)
        try {
          const recurringQuery = query(
            collectionGroup(db, "tasks"),
            where("workspaceId", "==", ws),
            where("recKind", "in", ["daily", "weekly"]),
          )

          const recurringSnap = await getDocs(recurringQuery)
          const selectedDateObj = ymdToDate(selectedDate)
          const selectedDayOfWeek = selectedDateObj.getDay()

          recurringSnap.forEach((d) => {
            const data = d.data() as any
            const taskYmd = data?.ymd

            // Skip if it's already from the selected date (already loaded above)
            if (taskYmd === selectedDate) return

            const ini = data?.inicio
            const fim = data?.fim
            if (!isHHMM(ini) || !isHHMM(fim)) return

            const recKind = data?.recKind as RecKind

            // For daily tasks: show if the task was created before or on the selected date
            if (recKind === "daily") {
              const taskDate = ymdToDate(taskYmd)
              if (taskDate <= selectedDateObj) {
                list.push({
                  id: `${d.id}-recurring-${selectedDate}`,
                  titulo: String(data?.titulo ?? "Demanda"),
                  inicio: ini,
                  fim: fim,
                  concluida: false, // Recurring tasks start as not completed each day
                  responsavel: String(data?.responsavel ?? ""),
                  operacao: String(data?.operacao ?? ""),
                  ymd: selectedDate, // Use selected date for display
                  seriesId: data?.seriesId,
                  recKind: "daily",
                  workspaceId: String(data?.workspaceId ?? ws),
                  createdAt: Number(data?.createdAt ?? Date.now()),
                })
              }
            }

            // For weekly tasks: show if it matches the day of week
            if (recKind === "weekly" && data?.weekDay === selectedDayOfWeek) {
              const taskDate = ymdToDate(taskYmd)
              if (taskDate <= selectedDateObj) {
                list.push({
                  id: `${d.id}-recurring-${selectedDate}`,
                  titulo: String(data?.titulo ?? "Demanda"),
                  inicio: ini,
                  fim: fim,
                  concluida: false,
                  responsavel: String(data?.responsavel ?? ""),
                  operacao: String(data?.operacao ?? ""),
                  ymd: selectedDate,
                  seriesId: data?.seriesId,
                  recKind: "weekly",
                  weekDay: data?.weekDay,
                  workspaceId: String(data?.workspaceId ?? ws),
                  createdAt: Number(data?.createdAt ?? Date.now()),
                })
              }
            }
          })
        } catch (error) {
          console.error("[v0] Error loading recurring tasks:", error)
        }

        setTasks(list)
      })
    }

    return loadTasks()
  }, [ws, selectedDate])

  /* ===========================
     CRUD helpers
  =========================== */

  async function addTaskSafe(input: Omit<Task, "id" | "workspaceId" | "createdAt">) {
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
    }
    // Nunca envie undefined!
    if (input.seriesId) docData.seriesId = input.seriesId
    if (input.weekDay !== undefined) docData.weekDay = input.weekDay

    await addDoc(tasksCollection(ws, input.ymd), docData)
  }

  async function updateTaskSafe(tid: string, ymd: string, patch: Partial<Task>) {
    // remove chaves undefined
    const clean: any = {}
    Object.entries(patch).forEach(([k, v]) => {
      if (v !== undefined) clean[k] = v
    })
    await updateDoc(doc(tasksCollection(ws, ymd), tid), clean)
  }

  async function deleteTaskOne(tid: string, ymd: string) {
    await deleteDoc(doc(tasksCollection(ws, ymd), tid))
  }

  async function deleteAllOccurrences(seriesId: string) {
    // Apaga todas as ocorrências no workspace, independente do dia
    const qy = query(collectionGroup(db, "tasks"), where("workspaceId", "==", ws), where("seriesId", "==", seriesId))
    const snap = await getDocs(qy)
    const ops = snap.docs.map((d) => deleteDoc(d.ref))
    await Promise.all(ops)
  }

  /* ===========================
     Filtros e volumetria
  =========================== */

  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const okResp = filterResp === "(todos)" || t.responsavel === filterResp
      const okOp = filterOp === "(todas)" || t.operacao === filterOp
      return okResp && okOp
    })
  }, [tasks, filterResp, filterOp])

  const stats = useMemo(() => {
    const nowMin = hhmmToMin(currentTime)
    let c = 0,
      a = 0,
      p = 0
    filteredTasks.forEach((t) => {
      if (t.concluida) c++
      else if (hhmmToMin(t.fim) <= nowMin) a++
      else p++
    })
    return { total: filteredTasks.length, concluida: c, atrasada: a, noPrazo: p }
  }, [filteredTasks, currentTime])

  const volumetriaPorResp = useMemo(() => {
    const map = new Map<string, number>()
    filteredTasks.forEach((t) => map.set(t.responsavel, (map.get(t.responsavel) || 0) + 1))
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredTasks])

  /* ===========================
     Colunas por responsável
  =========================== */

  type Enriched = Task & { startMin: number; endMin: number; idx: number }

  function computeLanes(list: Enriched[]) {
    // interval partitioning por componente de sobreposição
    const overlaps = (a: Enriched, b: Enriched) => a.startMin < b.endMin && b.startMin < a.endMin
    const n = list.length
    const adj: number[][] = Array.from({ length: n }, () => [])
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        if (overlaps(list[i], list[j])) {
          adj[i].push(j)
          adj[j].push(i)
        }
      }
    }
    const comp: number[] = Array(n).fill(-1)
    let cc = 0
    for (let i = 0; i < n; i++) {
      if (comp[i] !== -1) continue
      const q = [i]
      comp[i] = cc
      while (q.length) {
        const u = q.shift()!
        for (const v of adj[u])
          if (comp[v] === -1) {
            comp[v] = cc
            q.push(v)
          }
      }
      cc++
    }
    const result: Record<number, { lane: number; lanesInComp: number }> = {}
    for (let c = 0; c < cc; c++) {
      const nodes = list.filter((_, i) => comp[i] === c).sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin)

      const lanesEnd: number[] = []
      for (const t of nodes) {
        let lane = -1
        for (let li = 0; li < lanesEnd.length; li++) {
          if (lanesEnd[li] <= t.startMin) {
            lane = li
            break
          }
        }
        if (lane === -1) {
          lanesEnd.push(t.endMin)
          lane = lanesEnd.length - 1
        } else {
          lanesEnd[lane] = t.endMin
        }
        result[t.idx] = { lane, lanesInComp: lanesEnd.length }
      }
    }
    return result
  }

  // quais colunas mostrar (todos ou 1 filtrado)
  const responsaveisVisiveis = useMemo(() => {
    return filterResp === "(todos)" ? RESPONSAVEIS : RESPONSAVEIS.filter((r) => r === filterResp)
  }, [filterResp])

  /* ===========================
     UI helpers
  =========================== */
  function shiftDate(days: number) {
    const d = ymdToDate(selectedDate)
    d.setDate(d.getDate() + days)
    setSelectedDate(dateToYMD(d))
  }

  /* ===========================
     Render
  =========================== */

  return (
    <div className="min-h-screen w-full bg-neutral-950 text-neutral-100 p-6">
      <div className="max-w-7xl mx-auto">
        <header className="flex flex-wrap items-center gap-3 justify-between mb-4">
          <h1 className="text-2xl md:text-3xl font-semibold">Esteira de Demandas</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => shiftDate(-1)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700"
            >
              ◀︎
            </button>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="bg-neutral-900 border border-neutral-700 rounded-lg px-2 py-1.5"
            />
            <button
              onClick={() => shiftDate(1)}
              className="px-2.5 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700"
            >
              ▶︎
            </button>
            <button
              onClick={() => setShowNew(true)}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
            >
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
                <option key={r}>{r}</option>
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
              {OPERACOES.map((o) => (
                <option key={o}>{o}</option>
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

        {/* Timeline em colunas por responsável */}
        <div className="rounded-2xl bg-neutral-900 p-4 shadow-xl overflow-x-auto">
          <div
            className="grid gap-6 min-w-max"
            style={{ gridTemplateColumns: `110px repeat(${responsaveisVisiveis.length}, minmax(200px, 1fr))` }}
          >
            {/* Escala de horas */}
            <HourScale timeline={timeline} currentTime={currentTime} />

            {/* Uma coluna para cada responsável */}
            {responsaveisVisiveis.map((resp) => {
              const only = filteredTasks
                .filter((t) => t.responsavel === resp)
                .map((t, i) => ({
                  ...t,
                  startMin: hhmmToMin(t.inicio),
                  endMin: hhmmToMin(t.fim),
                  idx: i,
                })) as Enriched[]

              const lanes = computeLanes(only)

              return (
                <div key={resp} className="relative">
                  {/* cabeçalho da coluna */}
                  <div className="text-sm text-neutral-200 font-medium mb-2 flex items-center justify-between">
                    <span>{resp}</span>
                    <span className="text-neutral-400">{only.length}</span>
                  </div>

                  <div className="relative h-[860px]">
                    {/* linhas de grade (apenas visuais) */}
                    {Array.from({ length: timeline.totalMin / 30 + 1 }).map((_, i) => {
                      const m = timeline.startMin + i * 30
                      const h = String(Math.floor(m / 60)).padStart(2, "0")
                      const mm = String(m % 60).padStart(2, "0")
                      const t = `${h}:${mm}`
                      return (
                        <div
                          key={i}
                          className={`absolute left-0 right-0 h-px ${t.endsWith(":00") ? "bg-neutral-700" : "bg-neutral-800/50"}`}
                          style={{ top: `${percentFromTime(t, timeline)}%` }}
                        />
                      )
                    })}

                    {isHHMM(currentTime) &&
                      hhmmToMin(currentTime) >= timeline.startMin &&
                      hhmmToMin(currentTime) <= timeline.endMin && (
                        <div
                          className="absolute left-0 right-0 h-0.5 bg-yellow-400 z-10 pointer-events-none"
                          style={{ top: `${percentFromTime(currentTime, timeline)}%` }}
                        >
                          <div className="absolute -left-1 -top-1 w-2 h-2 bg-yellow-400 rounded-full" />
                          <div className="absolute right-0 -top-3 text-xs text-yellow-400 font-medium">
                            AGORA {currentTime}
                          </div>
                        </div>
                      )}

                    {/* cartões da coluna */}
                    {only.map((t, i) => {
                      const top = percentFromTime(t.inicio, timeline)
                      const bottom = percentFromTime(t.fim, timeline)
                      const height = Math.max(1, bottom - top)

                      const info = lanes[i] ?? { lane: 0, lanesInComp: 1 }
                      const gap = 12
                      const left = `calc(${(info.lane / info.lanesInComp) * 100}% + ${info.lane * gap}px)`
                      const width = `calc(${100 / info.lanesInComp}% - ${((info.lanesInComp - 1) / info.lanesInComp) * gap}px)`

                      let bg = "bg-sky-500 text-neutral-900"
                      let badge = "NO PRAZO"
                      const nowMin = hhmmToMin(currentTime)
                      if (t.concluida) {
                        bg = "bg-emerald-500"
                        badge = "CONCLUÍDA"
                      } else if (nowMin >= t.endMin) {
                        bg = "bg-red-500"
                        badge = "ATRASADA"
                      }

                      return (
                        <div
                          key={t.id}
                          className="absolute rounded-xl shadow-lg overflow-hidden cursor-pointer"
                          style={{ top: `${top}%`, height: `${height}%`, left, width }}
                          onClick={() => setEditing(t)}
                        >
                          <div className={`w-full h-full ${bg} flex items-center justify-between px-3`}>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] uppercase tracking-wide bg-black/20 px-2 py-0.5 rounded-full">
                                {badge}
                              </span>
                              <span className="font-medium text-sm md:text-base line-clamp-2">
                                {t.titulo}
                                {t.operacao && <span className="ml-2 text-xs opacity-90">— {t.operacao}</span>}
                              </span>
                            </div>
                            <span className="text-xs md:text-sm opacity-80">
                              {t.inicio} – {t.fim}
                            </span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Modal Nova */}
      {showNew && (
        <TaskModal
          title="Nova demanda"
          onCancel={() => setShowNew(false)}
          onSubmit={async (payload) => {
            try {
              const seriesId = payload.recKind && payload.recKind !== "once" ? crypto.randomUUID() : undefined
              await addTaskSafe({
                titulo: payload.titulo.trim() || "Demanda",
                inicio: payload.inicio,
                fim: payload.fim,
                concluida: false,
                responsavel: payload.responsavel,
                operacao: payload.operacao,
                ymd: selectedDate,
                recKind: payload.recKind,
                weekDay: payload.weekDay,
                seriesId,
              } as any)
              setShowNew(false)
            } catch (e: any) {
              alert(`Não foi possível salvar a demanda.\n${String(e?.message || e)}`)
            }
          }}
        />
      )}

      {/* Modal Editar */}
      {editing && (
        <EditModal
          task={editing}
          onCancel={() => setEditing(null)}
          onDeleteOne={async () => {
            await deleteTaskOne(editing.id, editing.ymd)
            setEditing(null)
          }}
          onDeleteAll={
            editing.seriesId
              ? async () => {
                  if (confirm("Excluir TODAS as ocorrências desta demanda recorrente?")) {
                    await deleteAllOccurrences(editing.seriesId)
                    setEditing(null)
                  }
                }
              : undefined
          }
          onSubmit={async (patch) => {
            await updateTaskSafe(editing.id, editing.ymd, patch)
            setEditing(null)
          }}
        />
      )}
    </div>
  )
}

/* ===========================
   Componentes
=========================== */

function Kpi({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: "emerald" | "red" | "sky" | "slate"
}) {
  const bar =
    color === "emerald"
      ? "bg-emerald-500"
      : color === "red"
        ? "bg-red-500"
        : color === "sky"
          ? "bg-sky-500"
          : "bg-slate-400"
  return (
    <div className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-4 shadow-lg relative overflow-hidden">
      <div className={`absolute inset-y-0 left-0 w-1.5 ${bar}`} />
      <div className="text-sm text-neutral-400 flex items-center gap-2">
        <span className={`inline-block w-2 h-2 rounded-full ${bar}`} />
        <span>{label}</span>
      </div>
      <div className="mt-2 text-3xl font-semibold">{value}</div>
    </div>
  )
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
  )
}

function HourScale({ timeline, currentTime }: { timeline: Timeline; currentTime: string }) {
  const ticks: string[] = []
  for (let m = timeline.startMin; m <= timeline.endMin; m += 30) {
    const h = String(Math.floor(m / 60)).padStart(2, "0")
    const min = String(m % 60).padStart(2, "0")
    ticks.push(`${h}:${min}`)
  }
  return (
    <div className="relative select-none pr-2">
      <div className="absolute right-0 top-0 bottom-0 w-px bg-neutral-800" />
      <div className="h-[860px] flex flex-col justify-between text-xs text-neutral-400">
        {ticks.map((t) => (
          <div key={t} className="relative flex items-center">
            <span className={t === currentTime ? "text-yellow-400 font-bold" : ""}>{t}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

/* ---------- Modais ---------- */

type ModalTaskInput = {
  titulo: string
  responsavel: string
  operacao: string
  inicio: string
  fim: string
  recKind?: RecKind
  weekDay?: number
}

function TaskModal({
  title,
  onCancel,
  onSubmit,
}: {
  title: string
  onCancel: () => void
  onSubmit: (t: ModalTaskInput) => Promise<void>
}) {
  const [titulo, setTitulo] = useState("")
  const [responsavel, setResponsavel] = useState(RESPONSAVEIS[0])
  const [operacao, setOperacao] = useState(OPERACOES[0])
  const [inicio, setInicio] = useState("08:00")
  const [fim, setFim] = useState("09:00")
  const [recKind, setRecKind] = useState<RecKind>("once")
  const [weekDay, setWeekDay] = useState<number>(1) // Default to Monday

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
              <option key={r}>{r}</option>
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
            {OPERACOES.map((o) => (
              <option key={o}>{o}</option>
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
        </label>

        {recKind === "weekly" && (
          <label className="text-sm md:col-span-2">
            <span className="block mb-1 text-neutral-300">Dia da semana</span>
            <select
              value={weekDay}
              onChange={(e) => setWeekDay(Number(e.target.value))}
              className="w-full bg-neutral-900 border border-neutral-700 rounded-lg px-3 py-2"
            >
              {DAYS_OF_WEEK.map((day) => (
                <option key={day.value} value={day.value}>
                  {day.label}
                </option>
              ))}
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

      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
          Cancelar
        </button>
        <button
          onClick={async () => {
            if (!isHHMM(inicio) || !isHHMM(fim) || hhmmToMin(fim) <= hhmmToMin(inicio)) {
              alert("Verifique os horários.")
              return
            }
            await onSubmit({
              titulo: titulo.trim() || "Demanda",
              responsavel,
              operacao,
              inicio,
              fim,
              recKind,
              weekDay: recKind === "weekly" ? weekDay : undefined,
            })
          }}
          className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
        >
          Salvar
        </button>
      </div>
    </Modal>
  )
}

function EditModal({
  task,
  onCancel,
  onDeleteOne,
  onDeleteAll,
  onSubmit,
}: {
  task: Task
  onCancel: () => void
  onDeleteOne: () => Promise<void>
  onDeleteAll?: () => Promise<void>
  onSubmit: (patch: Partial<Task>) => Promise<void>
}) {
  const [titulo, setTitulo] = useState(task.titulo)
  const [responsavel, setResponsavel] = useState(task.responsavel || RESPONSAVEIS[0])
  const [operacao, setOperacao] = useState(task.operacao || OPERACOES[0])
  const [inicio, setInicio] = useState(task.inicio)
  const [fim, setFim] = useState(task.fim)
  const [concluida, setConcluida] = useState(task.concluida)

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
              <option key={r}>{r}</option>
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
            {OPERACOES.map((o) => (
              <option key={o}>{o}</option>
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
                  ? `uma vez por semana${task.weekDay !== undefined ? ` (${DAYS_OF_WEEK[task.weekDay]?.label})` : ""}`
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
        <div className="flex gap-2">
          <button onClick={onDeleteOne} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">
            Excluir esta
          </button>
          {onDeleteAll && (
            <button
              onClick={onDeleteAll}
              title="Remove todas as ocorrências desta série recorrente"
              className="px-3 py-2 rounded-lg bg-red-700 hover:bg-red-600"
            >
              Excluir todos os dias
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button onClick={onCancel} className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700">
            Cancelar
          </button>
          <button
            onClick={async () => {
              if (!isHHMM(inicio) || !isHHMM(fim) || hhmmToMin(fim) <= hhmmToMin(inicio)) {
                alert("Verifique os horários.")
                return
              }
              await onSubmit({
                titulo: titulo.trim() || "Demanda",
                inicio,
                fim,
                responsavel,
                operacao,
                concluida,
              })
            }}
            className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 font-medium"
          >
            Salvar
          </button>
        </div>
      </div>
    </Modal>
  )
}

function Modal({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-neutral-900 border border-neutral-700 rounded-2xl p-5 w-full max-w-2xl shadow-xl max-h-[90vh] overflow-y-auto">
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
  )
}
