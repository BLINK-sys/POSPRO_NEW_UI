"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"
import {
  ArrowLeft, CheckCircle2, XCircle, Loader2, Play, Save,
  Clock, AlertCircle, WifiOff, Wifi, Calendar, StopCircle, Ban,
} from "lucide-react"
import {
  type IntegrationDetail,
  type IntegrationRun,
  type IntegrationType,
  type ScheduleMode,
  type ScheduleData,
  triggerIntegration,
  cancelIntegration,
  updateIntegrationSettings,
} from "@/app/actions/integrations"

const TYPE_LABELS: Record<IntegrationType, string> = {
  bio: "BIO — bioshop.ru",
  equip: "Equip — equip.me",
}

const WEEKDAYS = [
  { key: "mon", label: "Пн" },
  { key: "tue", label: "Вт" },
  { key: "wed", label: "Ср" },
  { key: "thu", label: "Чт" },
  { key: "fri", label: "Пт" },
  { key: "sat", label: "Сб" },
  { key: "sun", label: "Вс" },
]

const PHASE_LABELS: Record<string, string> = {
  starting: "Запуск",
  fetch_categories: "Сбор: категории",
  fetch_properties: "Сбор: характеристики",
  fetch_brands: "Сбор: бренды",
  fetch_products: "Сбор: товары",
  update_images: "Обновление изображений категорий",
  upload_categories: "Выгрузка в магазин: категории",
  upload_brands: "Выгрузка в магазин: бренды",
  upload_products: "Выгрузка в магазин: товары",
  done: "Завершено",
}

// Отображаемое сообщение по каждому step-name (для списка выполненных шагов).
const STEP_LABELS: Record<string, string> = {
  fetch_categories: "Сбор категорий",
  fetch_properties: "Сбор характеристик",
  fetch_brands: "Сбор брендов",
  fetch_products: "Сбор товаров",
  update_images: "Обновление изображений",
  upload_categories: "Загрузка категорий в магазин",
  upload_brands: "Загрузка брендов в магазин",
  upload_products: "Загрузка товаров в магазин",
}

interface StepData {
  status?: "running" | "done" | "failed" | "pending"
  count?: number
  done?: number
  total?: number
  success?: number
  failed?: number
  error?: string
}

interface ProgressData {
  current_step?: string
  current_message?: string
  steps?: Record<string, StepData>
  upload?: { done: number; total: number; success: number; failed: number }
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "medium" })
}

function fmtDuration(startIso: string, endIso: string | null): string {
  const start = new Date(startIso).getTime()
  const end = endIso ? new Date(endIso).getTime() : Date.now()
  const sec = Math.round((end - start) / 1000)
  if (sec < 60) return `${sec} сек`
  if (sec < 3600) return `${Math.floor(sec / 60)} мин ${sec % 60} сек`
  return `${Math.floor(sec / 3600)} ч ${Math.floor((sec % 3600) / 60)} мин`
}

function statusColor(status: string) {
  return status === "success"   ? "text-emerald-700 bg-emerald-100 border-emerald-200" :
         status === "failed"    ? "text-red-700 bg-red-100 border-red-200" :
         status === "cancelled" ? "text-orange-700 bg-orange-100 border-orange-200" :
         status === "running"   ? "text-blue-700 bg-blue-100 border-blue-200" :
                                  "text-gray-700 bg-gray-100 border-gray-200"
}

function statusLabel(status: string): string {
  return status === "success"   ? "Успех" :
         status === "failed"    ? "Ошибка" :
         status === "cancelled" ? "Отменено" :
         status === "running"   ? "Идёт" :
                                  status
}

interface Props {
  type: IntegrationType
  initial: IntegrationDetail
}

export default function IntegrationDetailClient({ type, initial }: Props) {
  const router = useRouter()
  const { toast } = useToast()

  // Общее состояние
  const [online, setOnline] = useState(initial.online)
  const [settings, setSettings] = useState(initial.settings)
  const [activeRun, setActiveRun] = useState<IntegrationRun | null>(initial.active_run)
  const [history, setHistory] = useState<IntegrationRun[]>(initial.history)
  const [pendingCommand, setPendingCommand] = useState<any>(null)
  // Соседняя интеграция (другой тип) сейчас работает — приходит из SSE snapshot.
  // Если да, значит наш trigger встанет в глобальную FIFO очередь воркера
  // (не запустится параллельно). Меняем UX кнопки соответственно.
  const [otherRunning, setOtherRunning] = useState<{ type: IntegrationType; run_id: number; phase: string | null } | null>(null)

  // Форма расписания (локальный черновик)
  const [draftEnabled, setDraftEnabled] = useState(initial.settings.enabled)
  const [draftMode, setDraftMode] = useState<ScheduleMode>(initial.settings.schedule_mode)
  const [draftDays, setDraftDays] = useState<string[]>(
    initial.settings.schedule_mode === "weekly" && Array.isArray((initial.settings.schedule_data as any).days)
      ? ((initial.settings.schedule_data as any).days as string[])
      : []
  )
  const [draftIntervalDays, setDraftIntervalDays] = useState<number>(
    initial.settings.schedule_mode === "interval" && typeof (initial.settings.schedule_data as any).days === "number"
      ? ((initial.settings.schedule_data as any).days as number)
      : 14
  )
  const [draftTime, setDraftTime] = useState<string>(
    (initial.settings.schedule_data as any).time || "03:00"
  )
  const [draftAnchor, setDraftAnchor] = useState<string>(
    initial.settings.schedule_mode === "interval" && (initial.settings.schedule_data as any).anchor
      ? ((initial.settings.schedule_data as any).anchor as string)
      : new Date().toISOString().slice(0, 10)
  )

  const [saving, setSaving] = useState(false)
  const [triggering, setTriggering] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  // ── SSE подключение ─────────────────────────────
  const esRef = useRef<EventSource | null>(null)
  useEffect(() => {
    const es = new EventSource(`/api/admin/integrations/${type}/stream`)
    esRef.current = es

    const handleSnapshot = (raw: string) => {
      try {
        const data = JSON.parse(raw)
        setOnline(data.online ?? false)
        if (data.settings) setSettings(data.settings)
        setActiveRun(data.active_run ?? null)
        setPendingCommand(data.pending_command ?? null)
        setOtherRunning(data.other_running ?? null)
      } catch (e) {
        console.error("SSE parse error:", e)
      }
    }

    es.addEventListener("initial", (e) => handleSnapshot((e as MessageEvent).data))
    es.addEventListener("update", (e) => handleSnapshot((e as MessageEvent).data))
    es.onerror = () => {
      // ошибка соединения — не спамим тостом, EventSource сам ретраит
    }

    return () => {
      es.close()
      esRef.current = null
    }
  }, [type])

  // Когда activeRun финиширует — обновим историю (перезагрузим страницу)
  const prevActiveIdRef = useRef<number | null>(initial.active_run?.id ?? null)
  useEffect(() => {
    if (prevActiveIdRef.current && !activeRun) {
      router.refresh()
    }
    prevActiveIdRef.current = activeRun?.id ?? null
  }, [activeRun, router])

  // ── Actions ─────────────────────────────────────
  const handleSaveSettings = useCallback(async () => {
    setSaving(true)
    const scheduleData: ScheduleData =
      draftMode === "weekly"
        ? { days: draftDays, time: draftTime }
        : { days: draftIntervalDays, time: draftTime, anchor: draftAnchor }
    const res = await updateIntegrationSettings(type, {
      enabled: draftEnabled,
      schedule_mode: draftMode,
      schedule_data: scheduleData,
    })
    setSaving(false)
    if (res.success && res.data) {
      setSettings(res.data)
      toast({ title: "Сохранено", description: "Расписание обновлено" })
    } else {
      toast({ title: "Ошибка", description: res.message || "Не удалось сохранить", variant: "destructive" })
    }
  }, [type, draftEnabled, draftMode, draftDays, draftIntervalDays, draftTime, draftAnchor, toast])

  const handleTrigger = useCallback(async () => {
    setTriggering(true)
    const res = await triggerIntegration(type)
    setTriggering(false)
    if (res.success) {
      toast({ title: "Команда отправлена", description: res.message || "Воркер подхватит в ближайшие секунды" })
    } else {
      toast({ title: "Ошибка", description: res.message || "Не удалось запустить", variant: "destructive" })
    }
  }, [type, toast])

  const handleCancel = useCallback(async () => {
    if (!confirm(
      "Отменить выгрузку?\n\n" +
      "Текущий процесс на локальном сервере будет прерван. " +
      "Данные, собранные до этого момента, останутся в staging-БД — " +
      "при следующем запуске всё стартует заново с чистого листа."
    )) return
    setCancelling(true)
    const res = await cancelIntegration(type)
    setCancelling(false)
    if (res.success) {
      toast({ title: "Отмена отправлена", description: res.message || "Воркер получит сигнал в течение 10 сек" })
    } else {
      toast({ title: "Ошибка", description: res.message || "Не удалось отменить", variant: "destructive" })
    }
  }, [type, toast])

  const toggleDay = (day: string) => {
    setDraftDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day])
  }

  const hasActiveRun = !!activeRun
  const settingsChanged =
    draftEnabled !== settings.enabled ||
    draftMode !== settings.schedule_mode ||
    JSON.stringify(
      draftMode === "weekly"
        ? { days: draftDays, time: draftTime }
        : { days: draftIntervalDays, time: draftTime, anchor: draftAnchor }
    ) !== JSON.stringify(settings.schedule_data)

  return (
    <div className="p-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/integrations" className="text-gray-500 hover:text-gray-800">
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1 className="text-2xl font-semibold">{TYPE_LABELS[type]}</h1>

        {/* Online индикатор реалтайм через SSE */}
        <div className={cn(
          "ml-4 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full border",
          online ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-red-50 text-red-700 border-red-200"
        )}>
          {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
          {online ? "Локальный сервер онлайн" : "Локальный сервер оффлайн"}
        </div>
      </div>
      <p className="text-sm text-gray-500 mb-6 ml-8">
        Реалтайм подключение по SSE — статус, прогресс и настройки обновляются автоматически.
      </p>

      {/* Реалтайм прогресс */}
      {activeRun && (() => {
        const progress = (activeRun.progress as ProgressData | null) || {}
        const steps = progress.steps || {}
        const upload = progress.upload
        const currentMessage = progress.current_message
        // Порядок для отображения — если что-то не в списке, покажется в конце
        // в порядке появления в объекте.
        const knownOrder = [
          "fetch_categories", "fetch_properties", "fetch_brands", "fetch_products", "update_images",
          "upload_categories", "upload_brands", "upload_products",
        ]
        const orderedStepKeys = [
          ...knownOrder.filter(k => k in steps),
          ...Object.keys(steps).filter(k => !knownOrder.includes(k)),
        ]

        return (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-3">
            <Loader2 className="h-5 w-5 text-blue-600 animate-spin" />
            <div>
              <div className="text-sm font-semibold text-blue-900">Идёт выгрузка</div>
              <div className="text-xs text-blue-700">
                Запущена {fmtDate(activeRun.started_at)} · длится {fmtDuration(activeRun.started_at, null)} · {activeRun.trigger === "manual" ? `запустил ${activeRun.triggered_by || "админ"}` : "по расписанию"}
              </div>
            </div>
          </div>

          {/* Текущее человекочитаемое сообщение */}
          {currentMessage && (
            <div className="text-sm font-medium text-blue-900 mb-3">
              {currentMessage}
            </div>
          )}

          {/* Список шагов */}
          {orderedStepKeys.length > 0 && (
            <div className="space-y-1 mb-3">
              {orderedStepKeys.map(key => {
                const s = steps[key]
                const label = STEP_LABELS[key] || key
                const isDone = s.status === "done"
                const isRunning = s.status === "running"
                const isFailed = s.status === "failed"
                return (
                  <div key={key} className="flex items-center gap-2 text-sm">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                    ) : isRunning ? (
                      <Loader2 className="h-4 w-4 text-blue-600 animate-spin shrink-0" />
                    ) : isFailed ? (
                      <XCircle className="h-4 w-4 text-red-600 shrink-0" />
                    ) : (
                      <div className="h-4 w-4 rounded-full border-2 border-gray-300 shrink-0" />
                    )}
                    <span className={cn(
                      isDone && "text-gray-700",
                      isRunning && "text-blue-900 font-medium",
                      isFailed && "text-red-700",
                    )}>
                      {label}
                      {isRunning && !isDone && "..."}
                      {isDone && typeof s.count === "number" && (
                        <span className="text-gray-500 ml-2">— окончен, кол-во {s.count}</span>
                      )}
                      {isRunning && typeof s.count === "number" && (
                        <span className="text-gray-500 ml-2">— собрано {s.count}</span>
                      )}
                      {isFailed && s.error && (
                        <span className="text-red-600 ml-2 text-xs">— {s.error}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}

          {/* Прогрессбар выгрузки товаров */}
          {upload && upload.total > 0 && (
            <div className="mt-3 p-3 bg-white/70 rounded-lg border border-blue-200">
              <div className="flex items-center justify-between text-sm mb-1">
                <span className="font-medium text-gray-800">
                  Загружаем товары в магазин: {upload.done} / {upload.total}
                </span>
                <span className="text-xs text-gray-500">
                  {Math.round((upload.done / upload.total) * 100)}%
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 transition-all duration-300"
                  style={{ width: `${(upload.done / upload.total) * 100}%` }}
                />
              </div>
              <div className="flex gap-4 mt-2 text-xs">
                <span className="text-emerald-700">
                  <CheckCircle2 className="h-3 w-3 inline mr-1" />
                  Успешные: <b>{upload.success}</b>
                </span>
                <span className="text-red-700">
                  <XCircle className="h-3 w-3 inline mr-1" />
                  Ошибка: <b>{upload.failed}</b>
                </span>
              </div>
            </div>
          )}
        </div>
        )
      })()}

      {pendingCommand && !activeRun && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-900 flex items-center gap-2">
          <Clock className="h-4 w-4" />
          Команда «Запустить сейчас» в очереди. Воркер должен подхватить в течение 10 секунд.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Расписание */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="h-4 w-4 text-gray-600" />
            <h3 className="font-semibold">Расписание автозапуска</h3>
          </div>

          <div className="flex items-center gap-3 mb-4">
            <Switch checked={draftEnabled} onCheckedChange={setDraftEnabled} />
            <Label className="cursor-pointer">Автозапуск включён</Label>
          </div>

          {/* Режим расписания */}
          <div className="mb-3">
            <Label className="text-xs text-gray-500 mb-2 block">Режим</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant={draftMode === "weekly" ? "default" : "outline"}
                onClick={() => setDraftMode("weekly")}
                className={draftMode === "weekly" ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
              >
                По дням недели
              </Button>
              <Button
                type="button"
                size="sm"
                variant={draftMode === "interval" ? "default" : "outline"}
                onClick={() => setDraftMode("interval")}
                className={draftMode === "interval" ? "bg-yellow-400 hover:bg-yellow-500 text-black" : ""}
              >
                Каждые N дней
              </Button>
            </div>
          </div>

          {draftMode === "weekly" && (
            <div className="mb-3">
              <Label className="text-xs text-gray-500 mb-2 block">Дни недели</Label>
              <div className="flex flex-wrap gap-1.5">
                {WEEKDAYS.map(d => {
                  const on = draftDays.includes(d.key)
                  return (
                    <button
                      key={d.key}
                      type="button"
                      onClick={() => toggleDay(d.key)}
                      className={cn(
                        "px-3 py-1.5 rounded-md text-xs font-medium border transition-colors",
                        on ? "bg-yellow-100 border-yellow-300 text-yellow-900"
                           : "bg-white border-gray-200 text-gray-500 hover:bg-gray-50"
                      )}
                    >
                      {d.label}
                    </button>
                  )
                })}
              </div>
              {draftDays.length === 0 && (
                <p className="text-xs text-red-500 mt-1">Выберите хотя бы один день</p>
              )}
            </div>
          )}

          {draftMode === "interval" && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Каждые N дней</Label>
                <Input
                  type="number"
                  min={1}
                  max={365}
                  value={draftIntervalDays}
                  onChange={e => setDraftIntervalDays(Math.max(1, parseInt(e.target.value) || 1))}
                />
              </div>
              <div>
                <Label className="text-xs text-gray-500 mb-1 block">Первый запуск</Label>
                <Input
                  type="date"
                  value={draftAnchor}
                  onChange={e => setDraftAnchor(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="mb-4">
            <Label className="text-xs text-gray-500 mb-1 block">Время (24ч)</Label>
            <Input
              type="time"
              value={draftTime}
              onChange={e => setDraftTime(e.target.value)}
              className="w-32"
            />
          </div>

          <Button
            onClick={handleSaveSettings}
            disabled={saving || !settingsChanged || (draftMode === "weekly" && draftDays.length === 0)}
            className="bg-yellow-400 hover:bg-yellow-500 text-black rounded-full"
          >
            {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
            Сохранить
          </Button>

          {!settings.enabled && (
            <div className="mt-3 text-xs text-gray-500 flex items-start gap-1">
              <AlertCircle className="h-3 w-3 shrink-0 mt-0.5" />
              Автозапуск сейчас выключен — воркер игнорирует расписание, но кнопка «Запустить сейчас» работает.
            </div>
          )}
        </div>

        {/* Ручной запуск */}
        <div className="bg-white rounded-xl border shadow-sm p-5">
          <div className="flex items-center gap-2 mb-4">
            <Play className="h-4 w-4 text-gray-600" />
            <h3 className="font-semibold">Ручной запуск</h3>
          </div>
          <p className="text-sm text-gray-600 mb-4">
            Кнопка ниже поставит команду в очередь. Воркер на локальном сервере проверяет очередь каждые ~10 сек
            и запустит выгрузку. Прогресс появится в верхнем блоке автоматически.
            {otherRunning && (
              <>
                <br /><span className="text-amber-700">
                  ⚠ Сейчас идёт выгрузка <b>{TYPE_LABELS[otherRunning.type]}</b> —
                  ваш запуск встанет в очередь и стартует автоматически после её завершения.
                  Параллельно две выгрузки не запускаются (нагрузка на локальный сервер).
                </span>
              </>
            )}
          </p>
          <div className="flex gap-2">
            <Button
              onClick={handleTrigger}
              disabled={triggering || hasActiveRun || !!pendingCommand || !online}
              className={cn(
                "text-white rounded-full",
                otherRunning
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-emerald-500 hover:bg-emerald-600",
              )}
            >
              {triggering ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
              {pendingCommand
                ? "В очереди…"
                : otherRunning
                  ? `Запустить после завершения ${TYPE_LABELS[otherRunning.type]}`
                  : "Запустить сейчас"}
            </Button>

            {/* Отмена — только когда есть что отменять (active_run своего типа
                или pending команда). Второй сценарий = юзер поставил в очередь,
                но передумал до старта. */}
            {(hasActiveRun || pendingCommand) && (
              <Button
                onClick={handleCancel}
                disabled={cancelling}
                variant="outline"
                className="rounded-full border-red-300 text-red-700 hover:bg-red-50 hover:text-red-800"
              >
                {cancelling ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : (
                  hasActiveRun ? <StopCircle className="h-4 w-4 mr-1" /> : <Ban className="h-4 w-4 mr-1" />
                )}
                {hasActiveRun ? "Отменить выгрузку" : "Снять из очереди"}
              </Button>
            )}
          </div>
          {!online && (
            <p className="mt-2 text-xs text-red-600">Локальный сервер оффлайн — команда не будет получена.</p>
          )}
          {hasActiveRun && (
            <p className="mt-2 text-xs text-gray-500">Идёт выгрузка. «Отменить» пришлёт воркеру сигнал прервать в течение ~10 сек.</p>
          )}
        </div>
      </div>

      {/* История */}
      <div className="bg-white rounded-xl border shadow-sm p-5 mt-4">
        <h3 className="font-semibold mb-3">История выгрузок</h3>
        {history.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Ещё нет запусков.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-gray-500 border-b">
                  <th className="text-left py-2 px-2">Начало</th>
                  <th className="text-left py-2 px-2">Длительность</th>
                  <th className="text-left py-2 px-2">Триггер</th>
                  <th className="text-left py-2 px-2">Этап</th>
                  <th className="text-left py-2 px-2">Статус</th>
                  <th className="text-left py-2 px-2">Ошибка</th>
                </tr>
              </thead>
              <tbody>
                {history.map(r => (
                  <tr key={r.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="py-2 px-2">{fmtDate(r.started_at)}</td>
                    <td className="py-2 px-2 text-gray-600">
                      {r.finished_at ? fmtDuration(r.started_at, r.finished_at) : "…"}
                    </td>
                    <td className="py-2 px-2 text-gray-600">
                      {r.trigger === "manual" ? `Вручную (${r.triggered_by || "—"})` : "По расписанию"}
                    </td>
                    <td className="py-2 px-2 text-gray-600">{PHASE_LABELS[r.phase || ""] || r.phase || "—"}</td>
                    <td className="py-2 px-2">
                      <span className={cn("text-xs px-2 py-0.5 rounded-full border", statusColor(r.status))}>
                        {statusLabel(r.status)}
                      </span>
                    </td>
                    <td className="py-2 px-2 text-xs text-red-600 max-w-md truncate">
                      {r.error || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
