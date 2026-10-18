"use client"

/**
 * Модалка выбора ДИАПАЗОНА дат в стиле tasks-calendar / DateTimePicker:
 *   - переключатель 2 / 4 / 6 месяцев, навигация ±1 месяц, «Сегодня»
 *   - два клика по дням: первый = начало, второй = конец (если второй
 *     раньше первого — свапается автоматически)
 *   - дни между подсвечены brand-yellow/30, границы — ярко-жёлтым
 *   - при выборе второй даты модалка закрывается и вызывает onApply
 *
 * Контролируется извне через `open`. Начальное состояние диапазона
 * передаётся в props (`from`/`to`), после закрытия сбрасывается.
 */

import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
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

function stripTime(d: Date): Date {
  const x = new Date(d)
  x.setHours(0, 0, 0, 0)
  return x
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** ISO datetime начала диапазона (или null). */
  from: string | null
  /** ISO datetime конца диапазона (или null). */
  to: string | null
  /** Срабатывает после выбора ОБЕИХ дат — передаёт ISO-строки. */
  onApply: (from: string, to: string) => void
}

export default function DateRangeDialog({
  open, onOpenChange, from, to, onApply,
}: Props) {
  const [monthsCount, setMonthsCount] = useState(4)
  const [baseMonth, setBaseMonth] = useState<Date>(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1)
  })

  const initialFrom = useMemo(() => (from ? stripTime(new Date(from)) : null), [from])
  const initialTo = useMemo(() => (to ? stripTime(new Date(to)) : null), [to])

  // Внутреннее состояние выбора: start (всегда есть первым), end может
  // быть null (ещё выбираем). При reopen модалки восстанавливаем из props.
  const [pickStart, setPickStart] = useState<Date | null>(initialFrom)
  const [pickEnd, setPickEnd] = useState<Date | null>(initialTo)
  // hover-предпросмотр второго конца диапазона — для «мерцания» подсветки.
  const [hover, setHover] = useState<Date | null>(null)

  useEffect(() => {
    if (open) {
      setPickStart(initialFrom)
      setPickEnd(initialTo)
      setHover(null)
    }
  }, [open, initialFrom, initialTo])

  const handleDayPick = (d: Date) => {
    const day = stripTime(d)
    // Если ни одного конца не выбрано ИЛИ оба уже стоят — начинаем новый диапазон.
    if (!pickStart || (pickStart && pickEnd)) {
      setPickStart(day)
      setPickEnd(null)
      setHover(null)
      return
    }
    // Если выбран только start — ставим end (с автосвапом если второй раньше).
    let a = pickStart
    let b = day
    if (b < a) {
      ;[a, b] = [b, a]
    }
    setPickStart(a)
    setPickEnd(b)
    // Применяем диапазон и закрываемся.
    const fromIso = new Date(
      a.getFullYear(), a.getMonth(), a.getDate(), 0, 0, 0, 0,
    ).toISOString()
    const toIso = new Date(
      b.getFullYear(), b.getMonth(), b.getDate(), 23, 59, 59, 999,
    ).toISOString()
    onApply(fromIso, toIso)
    onOpenChange(false)
  }

  const months = useMemo(
    () => Array.from({ length: monthsCount }, (_, i) => shiftMonthsFrom(baseMonth, i)),
    [baseMonth, monthsCount],
  )

  const colsClass =
    monthsCount === 2 ? "grid-cols-1 lg:grid-cols-2" :
    monthsCount === 4 ? "grid-cols-1 md:grid-cols-2" :
    "grid-cols-2 md:grid-cols-3"

  const resetToToday = () => {
    const d = new Date()
    setBaseMonth(new Date(d.getFullYear(), d.getMonth(), 1))
  }

  // Отображаемые границы диапазона с учётом hover-предпросмотра.
  const previewEnd = pickStart && !pickEnd && hover ? hover : pickEnd
  const rangeMin = pickStart && previewEnd
    ? (pickStart < previewEnd ? pickStart : previewEnd)
    : pickStart
  const rangeMax = pickStart && previewEnd
    ? (pickStart < previewEnd ? previewEnd : pickStart)
    : previewEnd

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Выбор периода</DialogTitle>
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

        {/* Подсказка пользователю что мы в режиме выбора */}
        <div className="text-xs text-gray-500 py-1">
          {pickStart && !pickEnd ? (
            <>
              Начало выбрано: <b className="text-gray-800">
                {pickStart.toLocaleDateString("ru-RU")}
              </b>. Кликните по второй дате для завершения.
            </>
          ) : (
            <>Кликните по первой дате диапазона, затем по второй — применится автоматически.</>
          )}
        </div>

        <div className={cn("grid gap-4", colsClass)}>
          {months.map((m) => (
            <MonthCalendar
              key={`${m.getFullYear()}-${m.getMonth()}`}
              month={m}
              rangeMin={rangeMin}
              rangeMax={rangeMax}
              pickStart={pickStart}
              pickEnd={pickEnd}
              onPick={handleDayPick}
              onHover={setHover}
            />
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap text-xs text-gray-500 pt-2 border-t border-gray-100">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-yellow border border-yellow-500" />
            Начало / конец
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-brand-yellow/30 border border-yellow-300" />
            Диапазон
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded border border-gray-300" />
            Сегодня
          </span>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ────────────────────────────────────────────────────────────────────────────

function MonthCalendar({
  month,
  rangeMin,
  rangeMax,
  pickStart,
  pickEnd,
  onPick,
  onHover,
}: {
  month: Date
  rangeMin: Date | null
  rangeMax: Date | null
  pickStart: Date | null
  pickEnd: Date | null
  onPick: (d: Date) => void
  onHover: (d: Date | null) => void
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
  const startKey = pickStart ? toDayKey(pickStart) : null
  const endKey = pickEnd ? toDayKey(pickEnd) : null

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
      <div
        className="grid grid-cols-7 gap-0.5"
        onMouseLeave={() => onHover(null)}
      >
        {cells.map((c) =>
          c.date ? (
            <DayCell
              key={c.key}
              date={c.date}
              isToday={c.key === todayKey}
              isStart={c.key === startKey}
              isEnd={c.key === endKey}
              inRange={
                !!rangeMin && !!rangeMax &&
                c.date.getTime() > rangeMin.getTime() &&
                c.date.getTime() < rangeMax.getTime()
              }
              onPick={onPick}
              onHover={onHover}
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
  date, isToday, isStart, isEnd, inRange, onPick, onHover,
}: {
  date: Date
  isToday: boolean
  isStart: boolean
  isEnd: boolean
  inRange: boolean
  onPick: (d: Date) => void
  onHover: (d: Date | null) => void
}) {
  const d = date.getDate()
  const base = "h-8 flex items-center justify-center text-xs font-medium border transition-colors cursor-pointer"
  let cls = "text-gray-600 hover:bg-gray-100 border-transparent rounded"
  if (isToday) cls = "text-gray-800 border-gray-300 hover:bg-gray-100 rounded"
  if (inRange) cls = "bg-brand-yellow/30 text-black border-transparent"
  if (isStart || isEnd) cls = "bg-brand-yellow text-black border-yellow-600 font-semibold rounded hover:bg-yellow-400"

  return (
    <button
      type="button"
      onClick={() => onPick(date)}
      onMouseEnter={() => onHover(date)}
      className={cn(base, cls)}
    >
      {d}
    </button>
  )
}
