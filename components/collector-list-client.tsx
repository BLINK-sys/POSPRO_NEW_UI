"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  listCollectorTasks,
  type CollectorTask,
  type TaskStatus,
} from "@/app/actions/collector"
import { Button } from "@/components/ui/button"
import CollectorNewTaskForm from "@/components/collector-new-task-form"
import {
  Loader2,
  Wifi,
  WifiOff,
  Clock,
  Ban,
  ArrowRight,
  FileSpreadsheet,
  Settings2,
} from "lucide-react"
import { cn } from "@/lib/utils"

// Обновляем список каждые 5 сек — как у BIO/Equip.
const REFRESH_MS = 5_000

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })
}

function fmtDuration(startIso: string | null, endIso: string | null): string {
  if (!startIso) return "—"
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const sec = Math.round((end - start) / 1000)
  if (sec < 60) return `${sec} сек`
  if (sec < 3600) return `${Math.floor(sec / 60)} мин ${sec % 60} сек`
  return `${Math.floor(sec / 3600)} ч ${Math.floor((sec % 3600) / 60)} мин`
}

function statusBadge(status: TaskStatus) {
  const map: Record<TaskStatus, [string, string]> = {
    queued:    ["В очереди",   "bg-amber-100 text-amber-700 border-amber-200"],
    running:   ["Выполняется", "bg-blue-100 text-blue-700 border-blue-200 animate-pulse"],
    success:   ["Успех",       "bg-emerald-100 text-emerald-700 border-emerald-200"],
    failed:    ["Ошибка",      "bg-red-100 text-red-700 border-red-200"],
    cancelled: ["Отменено",    "bg-orange-100 text-orange-700 border-orange-200"],
  }
  const [label, cls] = map[status] || [status, "bg-gray-100 text-gray-600 border-gray-200"]
  return (
    <span className={cn("inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full border", cls)}>
      {label}
    </span>
  )
}

function taskSubtitle(task: CollectorTask): string {
  // Второстепенная строка под именем задачи — цитата что именно собирается.
  if (task.custom_url) return `Готовый URL: ${task.custom_url.slice(0, 60)}${task.custom_url.length > 60 ? "…" : ""}`
  const cityNames = task.city_names && task.city_names.length > 0 ? task.city_names : task.cities
  const cities = cityNames.slice(0, 2).join(", ") + (cityNames.length > 2 ? `, +${cityNames.length - 2}` : "")
  const queries = task.queries.slice(0, 2).join(", ") + (task.queries.length > 2 ? `, +${task.queries.length - 2}` : "")
  return `${cities} × ${queries}`
}

interface Props {
  initialTasks: CollectorTask[]
  initialWorkerOnline: boolean
}

export default function CollectorListClient({ initialTasks, initialWorkerOnline }: Props) {
  const [tasks, setTasks] = useState(initialTasks)
  const [online, setOnline] = useState(initialWorkerOnline)

  // is_owner из готового endpoint /api/admin/kp-super-admin-access/check
  // (тот же гейт что в admin-sidebar для «Управление КП»). Настройки
  // «Максимум записей» + «Пауза между кликами» — только для владельца.
  const [isOwner, setIsOwner] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  useEffect(() => {
    fetch("/api/admin/kp-super-admin-access/check")
      .then((r) => r.json())
      .then((d) => setIsOwner(Boolean(d?.is_owner)))
      .catch(() => setIsOwner(false))
  }, [])

  useEffect(() => {
    let stopped = false
    const tick = async () => {
      try {
        const { tasks: fresh, online: on } = await listCollectorTasks()
        if (!stopped) {
          setTasks(fresh)
          setOnline(on)
        }
      } catch {
        // тихо
      }
    }
    const id = setInterval(tick, REFRESH_MS)
    return () => { stopped = true; clearInterval(id) }
  }, [])

  const reloadTasks = () => {
    listCollectorTasks().then(({ tasks: fresh, online: on }) => {
      setTasks(fresh)
      setOnline(on)
    })
  }

  const active = tasks.filter(t => t.status === "queued" || t.status === "running")
  const finished = tasks.filter(t => t.status !== "queued" && t.status !== "running")

  return (
    <div className="space-y-6">
      {/* Статус воркера + owner-only «Настройки» */}
      <div className="flex items-center justify-between bg-white border rounded-xl p-4">
        <div className="flex items-center gap-2 text-sm">
          {online ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Локальный сервер онлайн</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-red-600" />
              <span className="text-red-700 font-medium">Локальный сервер оффлайн</span>
              <span className="text-gray-500 text-xs ml-2">
                — задачи создаются, но не запустятся пока сервер не оживёт
              </span>
            </>
          )}
        </div>
        {isOwner && (
          <Button
            variant={showAdvanced ? "default" : "outline"}
            size="sm"
            onClick={() => setShowAdvanced(v => !v)}
            className={cn(
              "rounded-full",
              showAdvanced && "bg-yellow-400 hover:bg-yellow-500 text-black border-yellow-400",
            )}
          >
            <Settings2 className="h-4 w-4 mr-1" />
            {showAdvanced ? "Скрыть настройки" : "Настройки"}
          </Button>
        )}
      </div>

      {/* Форма нового сбора — прямо на странице, не в модалке */}
      <div className="bg-white border rounded-xl p-5">
        <h2 className="text-lg font-semibold mb-4">Новый сбор</h2>
        <CollectorNewTaskForm
          showAdvancedSettings={isOwner && showAdvanced}
          onCreated={reloadTasks}
        />
      </div>

      {/* Активные — если есть, отдельным блоком (выделяются на фоне истории) */}
      {active.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 mb-2">Идут сейчас</h2>
          <div className="space-y-2">
            {active.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        </div>
      )}

      {/* История — снизу */}
      <div>
        <h2 className="text-sm font-semibold text-gray-600 mb-2">
          История ({finished.length})
        </h2>
        {finished.length === 0 && active.length === 0 ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-500">
            Пока нет ни одной задачи. Заполни форму выше и запусти первый сбор.
          </div>
        ) : finished.length === 0 ? (
          <div className="text-sm text-gray-400 italic px-2">Пока нет завершённых.</div>
        ) : (
          <div className="space-y-2">
            {finished.map(task => (
              <TaskRow key={task.id} task={task} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task }: { task: CollectorTask }) {
  const progress = task.progress
  const pairInfo = progress?.pair_index && progress?.pair_total
    ? `${progress.pair_index}/${progress.pair_total}`
    : null
  const records = progress?.records ?? 0

  return (
    <Link
      href={`/admin/collector/${task.id}`}
      className={cn(
        "flex items-center justify-between bg-white border rounded-xl p-4 hover:shadow-md hover:border-yellow-300 transition-all",
        task.status === "running" && "border-blue-300",
        task.status === "queued" && "border-amber-300",
      )}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          {statusBadge(task.status)}
          <span className="text-xs text-gray-500">#{task.id}</span>
          {task.files_count !== undefined && task.files_count > 0 && (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <FileSpreadsheet className="h-3 w-3" />
              {task.files_ok}/{task.files_count} готово
            </span>
          )}
        </div>
        <div className="text-sm font-medium truncate">
          {task.name || <span className="text-gray-400 italic">без названия</span>}
        </div>
        <div className="text-xs text-gray-600 truncate">{taskSubtitle(task)}</div>
        <div className="flex items-center gap-3 text-xs text-gray-500 mt-1">
          <span>Создана {fmtDate(task.created_at)}</span>
          {task.started_at && (
            <span>· Длится {fmtDuration(task.started_at, task.finished_at)}</span>
          )}
          {task.status === "running" && pairInfo && (
            <span className="text-blue-700">
              · Пара {pairInfo}, собрано {records}
            </span>
          )}
          {task.status === "running" && !pairInfo && (
            <span className="text-blue-700 inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Запуск...
            </span>
          )}
          {task.status === "cancelled" && (
            <span className="text-orange-700 inline-flex items-center gap-1">
              <Ban className="h-3 w-3" /> Отменено
            </span>
          )}
          {task.status === "queued" && (
            <span className="text-amber-700 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> Ждёт свою очередь
            </span>
          )}
        </div>
      </div>
      <ArrowRight className="h-5 w-5 text-gray-400 shrink-0 ml-3" />
    </Link>
  )
}
