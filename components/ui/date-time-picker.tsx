"use client"

/**
 * Пикер даты (+ опционально времени) в стиле `tasks-calendar-dialog`:
 * модалка с переключателем 2/4/6 месяцев, навигация ±1 месяц, легенда
 * внизу. Триггер — компактная кнопка размером с содержимое.
 *
 * Для `withTime=true` внизу — отдельное поле «Время HH:MM» + кнопка
 * «Готово» (без времени модалка закрывается сразу по клику на день).
 */

import { useEffect, useMemo, useRef, useState } from "react"
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"

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
import { cn } from "@/lib/utils"

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

function toDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

function shiftMonthsFrom(base: Date, delta: number): Date {
  return new Date(base.getFullYear(), base.getMonth() + delta, 1)
}

interface Props {
  value: string | null | undefined
  onChange: (iso: string | null) => void
  withTime?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
  /** Ярлык справа от даты. */
  hint?: React.ReactNode
}

export function DateTimePicker({
  value,
  onChange,
  withTime = false,
  placeholder = "Выбрать дату",
  disabled,
  className,
  hint,
}: Props) {
  const [open, setOpen] = useState(false)
  const [monthsCount, setMonthsCount] = useState(4)
  const [baseMonth, setBaseMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const date = useMemo(() => (value ? new Date(value) : null), [value])
  const hhmm = useMemo(() => {
    if (!date) return "09:00"
    const h = String(date.getHours()).padStart(2, "0")
    const m = String(date.getMinutes()).padStart(2, "0")
    return `${h}:${m}`
  }, [date])

  const display = date
    ? date.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }) + (withTime ? ` ${hhmm}` : "")
    : null

  const selectedKey = date ? toDayKey(date) : null

  const emit = (next: Date | null) => {
    if (!next) {
      onChange(null)
      return
    }
    onChange(next.toISOString())
  }

  const handleDayPick = (d: Date) => {
    const base = date ?? new Date()
    const next = new Date(d)
    if (withTime) {
      if (date) next.setHours(base.getHours(), base.getMinutes(), 0, 0)
      else next.setHours(9, 0, 0, 0)
    } else {
      next.setHours(0, 0, 0, 0)
    }
    emit(next)
    if (!withTime) setOpen(false)
  }

  const setHour = (h: number) => {
    const [, mStr] = hhmm.split(":")
    const m = Number(mStr || 0)
    const base = date ?? new Date()
    const next = new Date(base)
    next.setHours(h, m, 0, 0)
    emit(next)
  }
  const setMinute = (m: number) => {
    const [hStr] = hhmm.split(":")
    const h = Number(hStr || 0)
    const base = date ?? new Date()
    const next = new Date(base)
    next.setHours(h, m, 0, 0)
    emit(next)
  }
  const currentHour = Number(hhmm.split(":")[0] || 0)
  const currentMinute = Number(hhmm.split(":")[1] || 0)

  const months = useMemo(
    () => Array.from({ length: monthsCount }, (_, i) => shiftMonthsFrom(baseMonth, i)),
    [baseMonth, monthsCount],
  )

  // Сетка колонок месяцев: 2→2, 4→2, 6→3 — как в tasks-calendar-dialog.
  const colsClass =
    monthsCount === 2 ? "grid-cols-1 lg:grid-cols-2" :
    monthsCount === 4 ? "grid-cols-1 md:grid-cols-2" :
    "grid-cols-2 md:grid-cols-3"

  const resetToToday = () => {
    const d = new Date()
    setBaseMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  return (
    <div className={cn("flex items-center gap-1 w-auto", className)}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className={cn(
          "h-8 px-2.5 rounded-md text-sm font-normal gap-1.5 w-auto justify-start",
          !display && "text-gray-400",
        )}
      >
        <CalendarIcon className="h-3.5 w-3.5 shrink-0 text-gray-500" />
        <span className="tabular-nums">{display ?? placeholder}</span>
      </Button>

      {value && !disabled && (
        <button
          type="button"
          onClick={() => emit(null)}
          className="h-7 w-7 inline-flex items-center justify-center text-gray-400 hover:text-red-500 rounded"
          aria-label="Очистить"
          title="Очистить"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      {hint}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Выбор даты</DialogTitle>
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
              onClick={() => setBaseMonth(shiftMonthsFrom(baseMonth, -1))}
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
              onClick={() => setBaseMonth(shiftMonthsFrom(baseMonth, 1))}
              className="h-8 w-8"
              title="На месяц вперёд"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className={cn("grid gap-4 pt-2", colsClass)}>
            {months.map((m) => (
              <MonthCalendar
                key={`${m.getFullYear()}-${m.getMonth()}`}
                month={m}
                selectedKey={selectedKey}
                onPick={handleDayPick}
              />
            ))}
          </div>

          {/* Легенда + (опционально) поле времени и кнопка «Готово». */}
          <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded bg-brand-yellow border border-yellow-500" />
              Сегодня
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-3 w-3 rounded border-2 border-brand-yellow bg-brand-yellow/30" />
              Выбранная дата
            </span>

            {withTime && (
              <>
                <div className="flex-1" />
                <span className="inline-flex items-center gap-2">
                  <span className="uppercase tracking-wider">Время</span>
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className={cn(
                          "h-8 px-3 rounded-md border border-gray-300 bg-white text-sm font-medium tabular-nums",
                          "hover:bg-gray-50 focus:outline-none",
                        )}
                      >
                        {String(currentHour).padStart(2, "0")}:{String(currentMinute).padStart(2, "0")}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-auto p-2">
                      <div className="flex gap-2">
                        <TimeColumn
                          values={Array.from({ length: 24 }, (_, i) => i)}
                          selected={currentHour}
                          onPick={setHour}
                          label="час"
                        />
                        <TimeColumn
                          values={Array.from({ length: 60 }, (_, i) => i)}
                          selected={currentMinute}
                          onPick={setMinute}
                          label="мин"
                        />
                      </div>
                    </PopoverContent>
                  </Popover>
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    emit(null)
                    setOpen(false)
                  }}
                  disabled={!value}
                  className="h-8 rounded-lg"
                >
                  Очистить
                </Button>
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="h-8 rounded-lg bg-brand-yellow text-black hover:bg-yellow-500"
                >
                  Готово
                </Button>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function MonthCalendar({
  month,
  selectedKey,
  onPick,
}: {
  month: Date
  selectedKey: string | null
  onPick: (d: Date) => void
}) {
  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const first = new Date(year, monthIdx, 1)
  const lastDay = new Date(year, monthIdx + 1, 0).getDate()
  const firstWeekday = (first.getDay() + 6) % 7
  const cells: Array<{ date: Date | null; key: string }> = []
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, key: `pre-${monthIdx}-${i}` })
  }
  for (let d = 1; d <= lastDay; d++) {
    const date = new Date(year, monthIdx, d)
    cells.push({ date, key: toDayKey(date) })
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, key: `post-${monthIdx}-${cells.length}` })
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
              isSelected={c.key === selectedKey}
              onPick={onPick}
            />
          ) : (
            <div key={c.key} className="h-8" />
          ),
        )}
      </div>
    </div>
  )
}

/**
 * Вертикальная прокручиваемая колонка значений времени (часы/минуты).
 * Скролл независимый, кнопки крупные (`h-9 w-16 text-base`). Выбранное
 * значение — brand-yellow fill + border, как «Выбранная дата» в календаре.
 * Авто-скролл к выбранному при открытии popover.
 */
function TimeColumn({
  values,
  selected,
  onPick,
  label,
}: {
  values: number[]
  selected: number
  onPick: (v: number) => void
  label: string
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Скроллим выбранное значение в центр колонки. requestAnimationFrame
  // нужен чтобы popover успел смонтироваться и получить размеры —
  // без него clientHeight бывает 0, и расчёт даёт мимо. Срабатывает
  // один раз на монтирование компонента (popover при закрытии его
  // размонтирует, при следующем открытии будет новый instance).
  useEffect(() => {
    const scroll = () => {
      const el = scrollRef.current
      if (!el) return
      const row = el.querySelector<HTMLElement>(`[data-time-value="${selected}"]`)
      if (!row) return
      const target = row.offsetTop - el.clientHeight / 2 + row.clientHeight / 2
      el.scrollTop = Math.max(0, target)
    }
    const id = requestAnimationFrame(scroll)
    return () => cancelAnimationFrame(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Высота = 10 строк × (h-9=36 + gap-1=4) − последний gap = 10×36 + 9×4 = 396px.
  // Остальное скроллится.
  return (
    <div className="flex flex-col gap-1">
      <div className="text-[11px] uppercase tracking-wider text-gray-400 text-center">
        {label}
      </div>
      <div
        ref={scrollRef}
        // Останавливаем wheel вверх — иначе родительский DialogContent
        // (`overflow-y-auto`) съедает прокрутку. Нативный скролл внутри
        // продолжает работать как обычно, stopPropagation его не ломает.
        onWheel={(e) => e.stopPropagation()}
        className="h-[396px] w-16 overflow-y-auto flex flex-col gap-1 pr-1"
      >
        {values.map((v) => {
          const isSel = v === selected
          return (
            <button
              key={v}
              type="button"
              data-time-value={v}
              onClick={() => onPick(v)}
              className={cn(
                "h-9 flex items-center justify-center text-base font-medium rounded border transition-colors cursor-pointer tabular-nums shrink-0",
                isSel
                  ? "bg-brand-yellow/30 text-black border-2 border-brand-yellow font-semibold hover:bg-brand-yellow/50"
                  : "text-gray-700 hover:bg-gray-100 border-transparent",
              )}
            >
              {String(v).padStart(2, "0")}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function DayCell({
  date,
  isToday,
  isSelected,
  onPick,
}: {
  date: Date
  isToday: boolean
  isSelected: boolean
  onPick: (d: Date) => void
}) {
  const d = date.getDate()
  // Приоритет визуала: выбранный > сегодня > обычный.
  const base = "h-8 flex items-center justify-center text-xs font-medium rounded border transition-colors cursor-pointer"
  let cls = "text-gray-600 hover:bg-gray-100 border-transparent"
  if (isToday) cls = "bg-brand-yellow text-black border-yellow-500 hover:bg-yellow-400"
  if (isSelected) {
    cls = "bg-brand-yellow/30 text-black border-2 border-brand-yellow font-semibold hover:bg-brand-yellow/50"
  }

  return (
    <button
      type="button"
      onClick={() => onPick(date)}
      className={cn(base, cls)}
    >
      {d}
    </button>
  )
}
