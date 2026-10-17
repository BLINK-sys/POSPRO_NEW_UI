"use client"

/**
 * Модалка «Календарь задач» — показывает N месяцев (2 / 4 / 6 / 12) в
 * решётке дней, в каждой ячейке — все задачи с `due_at` на этот день.
 *
 * - Дни с задачами подсвечены (просроченные — красным, сегодня — жёлтым,
 *   будущие — зелёным).
 * - Hover по ячейке → Popover со списком задач. Клик по задаче → переход
 *   на /admin/tasks/<id>.
 *
 * Данные тянутся собственным запросом (`/api/admin/tasks?limit=1000`) —
 * чтобы не зависеть от текущих фильтров списка. Если задач больше —
 * можно расширить лимит, но реалистично 1000 покрывает кейс.
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { useToast } from "@/hooks/use-toast"
import { crmGet } from "@/lib/crm-fetch"
import { cn } from "@/lib/utils"
import type { TaskListItem, TasksListResponse } from "@/lib/tasks-types"

const MONTHS_RU = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
]
const WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]

const VIEW_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 2, label: "2 мес" },
  { value: 4, label: "4 мес" },
  { value: 6, label: "6 мес" },
]

interface Props {
  open: boolean
  onOpenChange: (v: boolean) => void
}

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

export default function TasksCalendarDialog({ open, onOpenChange }: Props) {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [tasks, setTasks] = useState<TaskListItem[]>([])
  const [monthsCount, setMonthsCount] = useState(4)
  // Базовая точка — месяц, с которого начинаем показ (можно листать).
  const [baseMonth, setBaseMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  useEffect(() => {
    if (!open) return
    setLoading(true)
    crmGet<TasksListResponse>("/api/admin/tasks?limit=1000")
      .then((res) => {
        const list = (res.tasks || []).filter((t) => t.due_at)
        setTasks(list)
      })
      .catch((e) =>
        toast({
          variant: "destructive",
          title: "Не удалось загрузить задачи",
          description: e?.message,
        }),
      )
      .finally(() => setLoading(false))
  }, [open, toast])

  // Карта «день → список задач», одноразово при изменении tasks.
  const tasksByDay = useMemo(() => {
    const map = new Map<string, TaskListItem[]>()
    for (const t of tasks) {
      if (!t.due_at) continue
      const d = new Date(t.due_at)
      if (Number.isNaN(d.getTime())) continue
      const key = toDayKey(d)
      const arr = map.get(key) || []
      arr.push(t)
      map.set(key, arr)
    }
    return map
  }, [tasks])

  const months = useMemo(() => {
    const list: Date[] = []
    for (let i = 0; i < monthsCount; i++) {
      list.push(
        new Date(baseMonth.getFullYear(), baseMonth.getMonth() + i, 1),
      )
    }
    return list
  }, [baseMonth, monthsCount])

  const openTask = useCallback(
    (id: number) => {
      onOpenChange(false)
      router.push(`/admin/tasks/${id}`)
    },
    [onOpenChange, router],
  )

  const shiftMonths = (delta: number) => {
    setBaseMonth(
      (prev) => new Date(prev.getFullYear(), prev.getMonth() + delta, 1),
    )
  }
  const resetToToday = () => {
    const d = new Date()
    setBaseMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  // Сетка колонок месяцев: 2→2, 4→2, 6→3.
  const colsClass =
    monthsCount === 2 ? "grid-cols-1 lg:grid-cols-2" :
    monthsCount === 4 ? "grid-cols-1 md:grid-cols-2" :
    "grid-cols-2 md:grid-cols-3"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Календарь задач</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            {VIEW_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={monthsCount === opt.value ? "default" : "outline"}
                onClick={() => setMonthsCount(opt.value)}
                className={cn(
                  "rounded-lg h-8",
                  monthsCount === opt.value &&
                    "bg-brand-yellow text-black hover:bg-yellow-500",
                )}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          <div className="flex-1" />
          <Button
            size="icon"
            variant="outline"
            onClick={() => shiftMonths(-1)}
            className="h-8 w-8"
            title="На месяц назад"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={resetToToday}
            className="h-8"
          >
            Сегодня
          </Button>
          <Button
            size="icon"
            variant="outline"
            onClick={() => shiftMonths(1)}
            className="h-8 w-8"
            title="На месяц вперёд"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {loading && (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
          </div>
        )}

        {!loading && (
          <div className={cn("grid gap-4 pt-2", colsClass)}>
            {months.map((m) => (
              <MonthCalendar
                key={`${m.getFullYear()}-${m.getMonth()}`}
                month={m}
                tasksByDay={tasksByDay}
                onOpenTask={openTask}
              />
            ))}
          </div>
        )}

        {/* Легенда */}
        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-red-500" />
            Просрочено
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-yellow border border-yellow-500" />
            Сегодня
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-emerald-500" />
            Будет
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-gray-400" />
            Выполнено
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function MonthCalendar({
  month,
  tasksByDay,
  onOpenTask,
}: {
  month: Date
  tasksByDay: Map<string, TaskListItem[]>
  onOpenTask: (id: number) => void
}) {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const first = new Date(year, monthIdx, 1)
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  // getDay(): воскресенье=0, понедельник=1. Нормализуем «пн-первая».
  const firstWeekday = (first.getDay() + 6) % 7
  const cells: Array<{ date: Date | null; key: string }> = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, key: `pre-${i}` })
  }
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, monthIdx, d)
    cells.push({ date, key: toDayKey(date) })
  }
  // Добить до кратного 7 — чтобы сетка выравнивалась.
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `post-${cells.length}` })
  }

  const today = startOfToday()
  const todayKey = toDayKey(today)

  return (
    <div className="rounded-xl border border-gray-200 p-3">
      <div className="text-sm font-semibold text-gray-800 mb-2">
        {MONTHS_RU[monthIdx]} {year}
      </div>
      <div className="grid grid-cols-7 gap-0.5 text-[10px] text-gray-400 uppercase tracking-wider mb-1">
        {WEEKDAYS.map((w) => (
          <div key={w} className="text-center py-0.5">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {cells.map((c) =>
          c.date ? (
            <DayCell
              key={c.key}
              date={c.date}
              isToday={c.key === todayKey}
              isPast={c.date < today}
              tasks={tasksByDay.get(c.key) || []}
              onOpenTask={onOpenTask}
            />
          ) : (
            <div key={c.key} className="h-8" />
          ),
        )}
      </div>
    </div>
  )
}

function DayCell({
  date,
  isToday,
  isPast,
  tasks,
  onOpenTask,
}: {
  date: Date
  isToday: boolean
  isPast: boolean
  tasks: TaskListItem[]
  onOpenTask: (id: number) => void
}) {
  const d = date.getDate()
  // Приоритет цвета дня: сегодня → жёлтый, с задачами в прошлом (есть
  // открытые) → красный, с задачами в будущем → зелёный, все задачи
  // уже done → серый (просто «факт был»).
  let color: "today" | "overdue" | "future" | "done" | "none" = "none"
  if (tasks.length > 0) {
    const anyOpen = tasks.some((t) => t.status !== "done")
    if (isToday) color = "today"
    else if (isPast) color = anyOpen ? "overdue" : "done"
    else color = anyOpen ? "future" : "done"
  } else if (isToday) {
    color = "today"
  }

  const palette: Record<typeof color, string> = {
    today: "bg-brand-yellow text-black border-yellow-500 hover:bg-yellow-400",
    overdue: "bg-red-500 text-white border-red-600 hover:bg-red-600",
    future: "bg-emerald-500 text-white border-emerald-600 hover:bg-emerald-600",
    done: "bg-gray-400 text-white border-gray-500 hover:bg-gray-500",
    none: "text-gray-600 hover:bg-gray-100 border-transparent",
  }

  const cell = (
    <div
      className={cn(
        "h-8 flex items-center justify-center text-xs font-medium rounded border transition-colors cursor-default",
        palette[color],
      )}
    >
      {d}
      {tasks.length > 1 && (
        <span className="ml-0.5 text-[9px] opacity-80">·{tasks.length}</span>
      )}
    </div>
  )

  if (tasks.length === 0) return cell

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="cursor-pointer">
          {cell}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2">
        <div className="text-[11px] text-gray-500 mb-1.5">
          {date.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
          {" · "}
          {tasks.length} {tasks.length === 1 ? "задача" : "задач"}
        </div>
        <ul className="space-y-1 max-h-72 overflow-y-auto">
          {tasks.map((t) => (
            <li key={t.id}>
              <button
                type="button"
                onClick={() => onOpenTask(t.id)}
                className="w-full text-left px-2 py-1.5 rounded hover:bg-gray-100 text-sm flex items-start gap-2"
              >
                <span
                  className={cn(
                    "h-2 w-2 rounded-full mt-1.5 shrink-0",
                    t.status === "done"
                      ? "bg-gray-400"
                      : t.priority === "urgent" || t.priority === "high"
                      ? "bg-red-500"
                      : "bg-emerald-500",
                  )}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate font-medium">{t.title}</span>
                  <span className="text-[11px] text-gray-500">
                    {statusLabel(t.status)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  )
}

function statusLabel(s: string): string {
  switch (s) {
    case "pending": return "Ожидает"
    case "in_progress": return "В работе"
    case "waiting_check": return "На проверке"
    case "done": return "Выполнена"
    case "paused": return "На паузе"
    default: return s
  }
}
