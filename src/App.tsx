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
import { db, tasksCollection } from "./lib/firebase"

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
  workspaceId: string
  createdAt: number
}

/* ===========================
   Constantes
=========================== */
// Colunas do Kanban (apenas esses três)
const RESPONSAVEIS = ["Bárbara Arruda", "Gabriel Bion", "Luciano Miranda"]

// Lista fixa de operações
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

// Recorrência: horizontes padrão
const HORIZON_DAYS = 30 // daily -> próximos 30 dias
const WEEKS_COUNT = 8 // weekly -> 8 semanas

/* ===========================
   Utils
=========================== */
function isHHMM(v: any): v is string {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v)
}
function hhmmToMin(hhmm: string): number {
  if (!isHHMM(hhmm)) return 0
  const [h, m] = hhmm.split(":").map(Number)
  return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0)
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
  const params = new URLSearchParams(window.location.search)
  const ws = params.get("ws") || "demo"

  const [selectedDate, setSelectedDate] = useState(() => dateToYMD(new Date()))
  const [tasks, setTasks] = useState<Task[]>([])

  // filtros
  const [filterResp, setFilterResp] = useState<string>("(todos)")
  const [filterOp, setFilterOp] = useState<string>("(todas)")

  // modais
  const [showNew, setShowNew] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)

  /* ===========================
     Carrega tarefas do dia
  =========================== */
  useEffect(() => {
    const qy = query(tasksCollection(ws, selectedDate), orderBy("inicio"))
    return onSnapshot(qy, (snap) => {
      const list: Task[] = []
      snap.forEach((d) => {
        const data = d.data() as any
        const ini = data?.inicio
        const fim = data?.fim
        if (!isHHMM(ini) || !isHHMM(fim)) return // ignora registros inválidos
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
        })
      })
      setTasks(list)
    })
  }, [ws, selectedDate])

  /* ===========================
     CRUD helpers + recorrência real
  =========================== */
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
    }
    if (input.seriesId) docData.seriesId = input.seriesId // nunca undefined
    await addDoc(tasksCollection(ws, input.ymd), docData)
  }

  function generateOccurrences(kind: RecKind | undefined, startYmd: string, weekDay?: number): string[] {
    const occs: string[] = []
    const d0 = ymdToDate(startYmd)

    if (!kind || kind === "once") {
      occs.push(startYmd)
      return occs
    }

    if (kind === "daily") {
      for (let i = 0; i < HORIZON_DAYS; i++) {
        const d = new Date(d0)
        d.setDate(d0.getDate() + i)
        occs.push(dateToYMD(d))
      }
      return occs
    }

    if (kind === "weekly") {
      // Se weekDay foi especificado, encontra a próxima ocorrência desse dia
      if (weekDay !== undefined) {
        const currentDay = d0.getDay()
        const daysUntilTarget = (weekDay - currentDay + 7) % 7
        const firstOccurrence = new Date(d0)
        firstOccurrence.setDate(d0.getDate() + daysUntilTarget)

        for (let w = 0; w < WEEKS_COUNT; w++) {
          const d = new Date(firstOccurrence)
          d.setDate(firstOccurrence.getDate() + w * 7)
          occs.push(dateToYMD(d))
        }
      } else {
        // Comportamento antigo: usa o dia atual
        for (let w = 0; w < WEEKS_COUNT; w++) {
          const d = new Date(d0)
          d.setDate(d0.getDate() + w * 7)
          occs.push(dateToYMD(d))
        }
      }
    }
    return occs
  }

  async function addTaskWithRecurrence(base: Omit<Task, "id" | "workspaceId" | "createdAt">, weekDay?: number) {
    const seriesId = base.recKind && base.recKind !== "once" ? crypto.randomUUID() : undefined
    const occs = generateOccurrences(base.recKind, base.ymd, weekDay)

    // grava cada ocorrência (uma por dia)
    await Promise.all(
      occs.map((ymd) =>
        addOne({
          ...base,
          ymd,
          seriesId,
        }),
      ),
    )
  }

  async function updateTaskSafe(tid: string, ymd: string, patch: Partial<Task>) {
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
    try {
      console.log("[v0] Iniciando exclusão de todas as ocorrências para seriesId:", seriesId)

      const qy = query(collectionGroup(db, "tasks"), where("workspaceId", "==", ws), where("seriesId", "==", seriesId))

      console.log("[v0] Executando query collectionGroup...")
      const snap = await getDocs(qy)
      console.log("[v0] Encontradas", snap.docs.length, "ocorrências para excluir")

      if (snap.docs.length === 0) {
        alert("Nenhuma ocorrência encontrada para excluir.")
        return
      }

      await Promise.all(
        snap.docs.map((d) => {
          console.log("[v0] Excluindo documento:", d.id)
          return deleteDoc(d.ref)
        }),
      )

      console.log("[v0] Todas as ocorrências foram excluídas com sucesso!")
      alert(`${snap.docs.length} ocorrência(s) excluída(s) com sucesso!`)
    } catch (error: any) {
      console.error("[v0] Erro ao excluir todas as ocorrências:", error)

      const errorMessage = error?.message || String(error)
      const linkMatch = errorMessage.match(/(https:\/\/console\.firebase\.google\.com\/[^\s]+)/)

      if (linkMatch && linkMatch[1]) {
        const indexLink = linkMatch[1]
        console.log("[v0] Link para criar índice:", indexLink)

        // Mostrar modal com link clicável
        const shouldOpenLink = confirm(
          `Esta operação precisa de um índice no Firestore.\n\n` +
            `Clique em OK para abrir o Firebase Console e criar o índice automaticamente.\n\n` +
            `Depois de criar o índice (leva 1-2 minutos), tente novamente.`,
        )

        if (shouldOpenLink) {
          window.open(indexLink, "_blank")
        }
      } else {
        alert(`Erro ao excluir: ${errorMessage}\n\nVerifique as regras do Firestore para collectionGroup.`)
      }
    }
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
    const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5))
    let c = 0,
      a = 0,
      p = 0
    filteredTasks.forEach((t) => {
      if (t.concluida) c++
      else if (hhmmToMin(t.fim) <= nowMin) a++
      else p++
    })
    return { total: filteredTasks.length, concluida: c, atrasada: a, noPrazo: p }
  }, [filteredTasks])

  const volumetriaPorResp = useMemo(() => {
    const map = new Map<string, number>()
    filteredTasks.forEach((t) => map.set(t.responsavel, (map.get(t.responsavel) || 0) + 1))
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filteredTasks])

  // Quais colunas mostrar (filtro de responsável)
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
        {/* Header */}
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

        {/* Volumetria por responsável (voltou) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
          <VolumeCard title="Por responsável" rows={volumetriaPorResp} />
        </div>

        {/* KANBAN por responsável (não usa posicionamento vertical por hora) */}
        <div
          className="grid gap-4"
          style={{ gridTemplateColumns: `repeat(${responsaveisVisiveis.length}, minmax(0, 1fr))` }}
        >
          {responsaveisVisiveis.map((resp) => {
            const list = filteredTasks
              .filter((t) => t.responsavel === resp)
              .sort(
                (a, b) =>
                  hhmmToMin(a.inicio) - hhmmToMin(b.inicio) ||
                  hhmmToMin(a.fim) - hhmmToMin(b.fim) ||
                  a.titulo.localeCompare(b.titulo),
              )

            return (
              <div key={resp} className="rounded-2xl border border-neutral-800 bg-neutral-900/60 p-3">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium">{resp}</h3>
                  <span className="text-sm text-neutral-400">{list.length}</span>
                </div>

                <div className="space-y-3">
                  {list.length === 0 && <div className="text-sm text-neutral-500">Sem demandas neste dia</div>}

                  {list.map((t) => {
                    let badge = "NO PRAZO"
                    let badgeCls = "bg-sky-500"
                    const nowMin = hhmmToMin(new Date().toTimeString().slice(0, 5))
                    if (t.concluida) {
                      badge = "CONCLUÍDA"
                      badgeCls = "bg-emerald-500"
                    } else if (hhmmToMin(t.fim) <= nowMin) {
                      badge = "ATRASADA"
                      badgeCls = "bg-red-500"
                    }

                    return (
                      <button
                        key={t.id}
                        onClick={() => setEditing(t)}
                        className="w-full text-left rounded-xl bg-neutral-800/70 hover:bg-neutral-800 border border-neutral-700 px-3 py-2 shadow-sm"
                        title={`${t.titulo} • ${t.inicio}-${t.fim}`}
                      >
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[10px] uppercase tracking-wide text-neutral-900 px-2 py-0.5 rounded-full ${badgeCls}`}
                          >
                            {badge}
                          </span>
                          <span className="text-xs text-neutral-300">
                            {t.inicio} – {t.fim}
                          </span>
                        </div>
                        <div className="mt-1 font-medium">{t.titulo}</div>
                        {t.operacao && <div className="text-xs text-neutral-400 mt-0.5">Operação: {t.operacao}</div>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Modal Nova */}
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
                payload.weekDay,
              )
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
                    try {
                      await deleteAllOccurrences(editing.seriesId)
                    } catch (error: any) {
                      console.error("[v0] Erro ao excluir todas as ocorrências:", error)
                      alert(`Erro: ${error?.message || error}`)
                    }
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
   Componentes UI
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

/* ---------- Modais ---------- */
type ModalTaskInput = {
  titulo: string
  responsavel: string
  operacao: string
  inicio: string
  fim: string
  recKind?: RecKind
  weekDay?: number // Adicionado para escolher o dia da semana
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
  const [weekDay, setWeekDay] = useState<number>(1) // Segunda-feira por padrão

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
              <option value={0}>Domingo</option>
              <option value={1}>Segunda-feira</option>
              <option value={2}>Terça-feira</option>
              <option value={3}>Quarta-feira</option>
              <option value={4}>Quinta-feira</option>
              <option value={5}>Sexta-feira</option>
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
        <div className="flex gap-2">
          <button onClick={onDeleteOne} className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-500">
            Excluir esta
          </button>
          {onDeleteAll && (
            <button
              onClick={async () => {
                if (confirm("Excluir TODAS as ocorrências desta demanda recorrente?")) {
                  try {
                    await onDeleteAll()
                  } catch (error: any) {
                    console.error("[v0] Erro ao excluir todas as ocorrências:", error)
                    alert(`Erro: ${error?.message || error}`)
                  }
                }
              }}
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
  )
}
