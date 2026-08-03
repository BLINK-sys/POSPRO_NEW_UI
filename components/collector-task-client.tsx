"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  cancelCollectorTask,
  deleteCollectorTask,
  type CollectorTask,
} from "@/app/actions/collector"
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Clock,
  Wifi,
  WifiOff,
  StopCircle,
  Ban,
  FileSpreadsheet,
  Download,
  AlertCircle,
  MapPin,
  Search,
  Trash2,
} from "lucide-react"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"

interface Props {
  initialTask: CollectorTask
  initialWorkerOnline: boolean
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" })
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

function fmtBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} Б`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} КБ`
  return `${(bytes / 1024 / 1024).toFixed(2)} МБ`
}

function statusBadge(status: string, size: "sm" | "md" = "md") {
  const map: Record<string, [string, string]> = {
    queued:    ["В очереди",   "bg-amber-100 text-amber-700 border-amber-200"],
    running:   ["Выполняется", "bg-blue-100 text-blue-700 border-blue-200 animate-pulse"],
    success:   ["Успех",       "bg-emerald-100 text-emerald-700 border-emerald-200"],
    failed:    ["Ошибка",      "bg-red-100 text-red-700 border-red-200"],
    cancelled: ["Отменено",    "bg-orange-100 text-orange-700 border-orange-200"],
    ok:        ["ok",          "bg-emerald-100 text-emerald-700 border-emerald-200"],
    stopped:   ["Отменён",     "bg-orange-100 text-orange-700 border-orange-200"],
    skipped:   ["Пропущен",    "bg-gray-100 text-gray-600 border-gray-200"],
  }
  const [label, cls] = map[status] || [status, "bg-gray-100 text-gray-600 border-gray-200"]
  return (
    <span className={cn(
      "inline-flex items-center gap-1 rounded-full border",
      size === "sm" ? "text-xs px-2 py-0.5" : "text-sm px-2.5 py-1",
      cls,
    )}>
      {label}
    </span>
  )
}

export default function CollectorTaskClient({ initialTask, initialWorkerOnline }: Props) {
  const { toast } = useToast()
  const router = useRouter()

  const [task, setTask] = useState(initialTask)
  const [online, setOnline] = useState(initialWorkerOnline)
  const [cancelling, setCancelling] = useState(false)
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // ── SSE ────────────────────────────────────────
  const esRef = useRef<EventSource | null>(null)
  useEffect(() => {
    const es = new EventSource(`/api/admin/collector/tasks/${task.id}/stream`)
    esRef.current = es

    const applySnapshot = (raw: string) => {
      try {
        const data = JSON.parse(raw)
        setTask(prev => ({ ...prev, ...data }))
        if (typeof data.online === "boolean") setOnline(data.online)
      } catch (e) {
        console.error("SSE parse error:", e)
      }
    }

    es.addEventListener("initial", (e) => applySnapshot((e as MessageEvent).data))
    es.addEventListener("update", (e) => applySnapshot((e as MessageEvent).data))
    es.addEventListener("finished", () => es.close())
    es.addEventListener("gone", () => es.close())
    es.onerror = () => {
      // EventSource сам ретраит — не спамим тост
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [task.id])

  const handleCancelConfirmed = async () => {
    setCancelDialogOpen(false)
    setCancelling(true)
    const res = await cancelCollectorTask(task.id)
    setCancelling(false)
    if (res.success) {
      toast({
        title: "Отмена отправлена",
        description: res.message || "Воркер прервёт задачу в течение ~5 сек.",
      })
    } else {
      toast({ title: "Ошибка", description: res.message, variant: "destructive" })
    }
  }

  const handleDeleteConfirmed = async () => {
    setDeleteDialogOpen(false)
    setDeleting(true)
    const res = await deleteCollectorTask(task.id)
    setDeleting(false)
    if (res.success) {
      toast({ title: "Задача удалена" })
      router.push("/admin/collector")
    } else {
      toast({ title: "Не удалось удалить", description: res.message, variant: "destructive" })
    }
  }

  const canDelete = task.status !== "running" && task.status !== "queued"

  const isActive = task.status === "queued" || task.status === "running"
  const progress = task.progress
  const totalPairs = progress?.pair_total ?? Math.max(task.cities.length * task.queries.length, 1)
  const donePairs = task.files?.length ?? 0
  const percent = totalPairs > 0 ? Math.round((donePairs / totalPairs) * 100) : 0

  const filesOk = task.files?.filter(f => f.status === "ok") ?? []
  const filesFailed = task.files?.filter(f => f.status !== "ok") ?? []

  const taskSubtitle = task.custom_url
    ? task.custom_url
    : `${task.cities.length} городов × ${task.queries.length} запросов`

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/collector" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold truncate max-w-[600px]">
          {task.name || `Задача #${task.id}`}
          <span className="text-gray-400 text-lg ml-2">#{task.id}</span>
        </h1>
        {statusBadge(task.status)}
        <div className={cn(
          "ml-4 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
          online ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200",
        )}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {online ? "Локальный сервер онлайн" : "Локальный сервер оффлайн"}
        </div>
        {canDelete && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setDeleteDialogOpen(true)}
            disabled={deleting}
            className="ml-auto rounded-full border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
            title="Удалить задачу и все её файлы"
          >
            {deleting
              ? <Loader2 className="h-4 w-4 mr-1 animate-spin" />
              : <Trash2 className="h-4 w-4 mr-1" />}
            Удалить
          </Button>
        )}
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-8 truncate">{taskSubtitle}</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Прогресс */}
        <div className="lg:col-span-2 space-y-4">
          {isActive ? (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
              <div className="flex items-center gap-3 mb-3">
                {task.status === "running" ? (
                  <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
                ) : (
                  <Clock className="h-5 w-5 text-amber-600" />
                )}
                <div>
                  <div className="text-sm font-semibold text-blue-900">
                    {task.status === "queued" ? "Ждёт свою очередь" : "Идёт сбор"}
                  </div>
                  <div className="text-xs text-blue-700">
                    {task.started_at && (
                      <>Стартовала {fmtDate(task.started_at)} · длится {fmtDuration(task.started_at, null)}</>
                    )}
                  </div>
                </div>
              </div>

              {progress && (
                <>
                  {progress.message && (
                    <div className="text-sm font-medium text-blue-900 mb-3">{progress.message}</div>
                  )}
                  {progress.pair_index !== undefined && progress.pair_total !== undefined && (
                    <>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium text-gray-800">
                          Пара {progress.pair_index} / {progress.pair_total}
                          {progress.city && progress.query && (
                            <span className="text-gray-500 ml-2">
                              — {progress.city}, «{progress.query}»
                            </span>
                          )}
                        </span>
                        <span className="text-xs text-gray-500">{percent}%</span>
                      </div>
                      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-500 transition-all duration-300"
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </>
                  )}
                  {progress.records !== undefined && progress.records > 0 && (
                    <div className="mt-3 text-sm text-gray-700">
                      Собрано записей в текущей паре: <b>{progress.records}</b>
                      {progress.attempt && progress.attempt > 1 && (
                        <span className="text-amber-700 ml-2">(попытка {progress.attempt})</span>
                      )}
                    </div>
                  )}
                </>
              )}

              <div className="mt-4 flex gap-2">
                <Button
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelling}
                  variant="outline"
                  className="rounded-full border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
                >
                  {cancelling ? (
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                  ) : task.status === "queued" ? (
                    <Ban className="h-4 w-4 mr-1" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-1" />
                  )}
                  {task.status === "queued" ? "Снять из очереди" : "Отменить сбор"}
                </Button>
              </div>
            </div>
          ) : (
            <div className={cn(
              "border rounded-xl p-5",
              task.status === "success" && "bg-emerald-50 border-emerald-200",
              task.status === "failed" && "bg-red-50 border-red-200",
              task.status === "cancelled" && "bg-orange-50 border-orange-200",
            )}>
              <div className="flex items-center gap-3">
                {task.status === "success" && <CheckCircle2 className="h-6 w-6 text-emerald-600" />}
                {task.status === "failed" && <XCircle className="h-6 w-6 text-red-600" />}
                {task.status === "cancelled" && <Ban className="h-6 w-6 text-orange-600" />}
                <div>
                  <div className="text-sm font-semibold">
                    {task.status === "success" && "Завершено успешно"}
                    {task.status === "failed" && "Завершено с ошибкой"}
                    {task.status === "cancelled" && "Отменено"}
                  </div>
                  <div className="text-xs text-gray-600">
                    Длительность: {fmtDuration(task.started_at, task.finished_at)} ·
                    Файлов: {filesOk.length} успешно
                    {filesFailed.length > 0 && `, ${filesFailed.length} с ошибкой`}
                  </div>
                </div>
              </div>
              {task.error && (
                <div className="mt-3 text-sm text-red-700 bg-red-100/50 rounded p-2 flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  {task.error}
                </div>
              )}
            </div>
          )}

          {/* Файлы */}
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <FileSpreadsheet className="h-4 w-4" />
              Файлы ({task.files?.length ?? 0})
            </h3>
            {(!task.files || task.files.length === 0) ? (
              <p className="text-sm text-gray-400 italic">Пока ни одного файла.</p>
            ) : (
              <div className="space-y-2">
                {task.files.map(f => (
                  <div key={f.id} className="flex items-center gap-3 p-2 border rounded-lg hover:bg-gray-50">
                    <FileSpreadsheet className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {f.city_name || f.city} — «{f.query}»
                      </div>
                      <div className="text-xs text-gray-500 flex items-center gap-3">
                        <span>{f.rows} строк</span>
                        <span>{fmtBytes(f.bytes)}</span>
                        <span>Попыток: {f.attempts}</span>
                        <span>{f.duration_sec.toFixed(0)} сек</span>
                        {statusBadge(f.status, "sm")}
                      </div>
                      {f.error && (
                        <div className="text-xs text-red-600 mt-1 truncate">{f.error}</div>
                      )}
                    </div>
                    {f.status === "ok" && f.rel_path && (
                      <a
                        href={`/api/admin/collector/tasks/${task.id}/files/${f.id}`}
                        className="text-yellow-700 hover:text-yellow-900"
                        title="Скачать"
                      >
                        <Download className="h-5 w-5" />
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Лог */}
          {task.log_excerpt && (
            <div className="bg-white rounded-xl border p-5">
              <h3 className="font-semibold mb-3">Лог</h3>
              <pre className="text-xs bg-gray-50 border rounded p-3 max-h-64 overflow-auto whitespace-pre-wrap font-mono">
                {task.log_excerpt}
              </pre>
            </div>
          )}
        </div>

        {/* Настройки задачи */}
        <aside className="space-y-4">
          <div className="bg-white rounded-xl border p-5">
            <h3 className="font-semibold mb-3 text-sm">Настройки задачи</h3>
            <dl className="space-y-2 text-sm">
              <InfoRow label="Создана" value={fmtDate(task.created_at)} />
              {task.custom_url ? (
                <>
                  <div className="text-xs text-gray-500">Готовый URL</div>
                  <div className="text-xs font-mono bg-gray-50 border rounded p-2 break-all">
                    {task.custom_url}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" /> Города ({task.cities.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {task.cities.map((c, i) => (
                        <span key={c} className="text-xs bg-gray-100 rounded px-1.5 py-0.5">
                          {task.city_names?.[i] || c}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500 mb-1 flex items-center gap-1">
                      <Search className="h-3 w-3" /> Запросы ({task.queries.length})
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {task.queries.map(q => (
                        <span key={q} className="text-xs bg-yellow-100 border border-yellow-200 rounded px-1.5 py-0.5">
                          {q}
                        </span>
                      ))}
                    </div>
                  </div>
                </>
              )}
              <InfoRow label="Колонки" value={
                task.keep_columns
                  ? `${task.keep_columns.length} из выбранных`
                  : "все"
              } />
              <InfoRow label="Автоширина" value={task.autosize_columns ? "да" : "нет"} />
              <InfoRow label="Перенос текста" value={task.wrap_text ? "да" : "нет"} />
              <InfoRow label="Сортировка по имени" value={task.sort_by_name ? "да" : "нет"} />
              {task.networks_min_count && (
                <InfoRow label="Фильтр сетей" value={`от ${task.networks_min_count} точек`} />
              )}
              {task.max_records && (
                <InfoRow label="Макс. записей на URL" value={String(task.max_records)} />
              )}
              <InfoRow label="Пауза между кликами" value={`${task.delay_min_ms}–${task.delay_max_ms} мс`} />
            </dl>
          </div>
        </aside>
      </div>

      {/* Модалка отмены */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-red-600" />
              {task.status === "queued" ? "Снять задачу с очереди?" : "Отменить активный сбор?"}
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              {task.status === "queued" ? (
                <>Задача будет помечена как отменённая и не запустится. Собранные файлы отсутствуют.</>
              ) : (
                <>
                  Текущий процесс на локальном сервере прервётся на ближайшей карточке.
                  Уже собранные файлы (если есть) сохранятся и будут доступны для скачивания.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Не отменять</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirmed}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              {task.status === "queued" ? "Да, снять из очереди" : "Да, прервать сбор"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Модалка удаления */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-red-600" />
              Удалить задачу?
            </AlertDialogTitle>
            <AlertDialogDescription className="pt-2">
              Задача, вся её история и все собранные .xlsx-файлы будут удалены
              безвозвратно. Восстановить нельзя.
              {task.files && task.files.length > 0 && (
                <>
                  <br />
                  <b>Файлов будет удалено: {task.files.length}</b>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirmed}
              className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
            >
              Да, удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between text-xs">
      <dt className="text-gray-500">{label}</dt>
      <dd className="text-gray-800 text-right">{value}</dd>
    </div>
  )
}
